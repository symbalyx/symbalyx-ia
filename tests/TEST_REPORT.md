# Rapport de test V8 — Symbalyx team pro

**Méthode.** J'ai testé sans n8n ni Google Sheets réelle (impossible depuis cet environnement) :
- Logique des Code nodes des WF18 / WF19 / WF21 extraite et rejouée en Node.js.
- CRM (`n8n/crm/index.html`) chargé dans un navigateur headless (JSDOM), avec un faux backend en mémoire qui rejoue la logique des 3 webhooks.

**Résultat global.** 34 tests verts sur 34 (`tests/wf_logic.test.js` 20/20, `tests/crm.headless.test.js` 14/14).

---

## 1. Ce qui marche nickel

- **Login 2 étapes** : mot de passe local → sélecteur d'identité → app. Si l'identité enregistrée est encore valide, l'étape 2 est sautée (testé avec deux comptes Arsène + Kentin sur le même navigateur, une session après l'autre).
- **Boucle décision IA → humain → mémoire** : `ai_initial_priority` est bien lu dans `business_control` AVANT l'update, propagé dans `memory_decisions`. Le payload contient `decider_id`, `decided_by`, `bcl_id`, `decision`, `reason`. Aucun email envoyé : pour `follow_up_24h` approuvé, on flagge juste `human_decision=approved` dans `review_queue`, et c'est WF2 (cron 15 min) qui crée le brouillon Gmail.
- **Garde-fous** : token absent → 500, token faux → 401, decision invalide → 400, decided_by manquant → 400, item_type hors liste → 400, body > 2000 chars → 400, rôle inconnu → 400, email invalide → 400. Tout est strict.
- **Synchro commentaires** : POST écrit dans `team_comments` avec `author_id`, GET filtre par `item_type` + `item_id` et trie chronologiquement. L'item_type est lowercase normalisé.
- **Identité riche** : objet `{id, name, role, initials, color}` au lieu d'une string. Persistée par navigateur. Le chip header montre les initiales colorées. Switch entre identités sans recharger la page (fonctionne).
- **Filtre "À moi"** : matche `assignee_id == identity.id` OU `assigned_to.toLowerCase().includes(identity.name.toLowerCase())`. Quand on ajoute Kentin et qu'on filtre "À moi", on voit bien la BCL "Coach Lyon" et pas celles d'Arsène.
- **Section Équipe (admin)** : nav onglet caché pour les non-admins, visible pour `founder`/`admin`. Le formulaire envoie le bon payload, le bouton Désactiver envoie `PATCH {id, is_active:false}`.
- **Membre désactivé** : disparaît du sélecteur du login, l'historique reste.
- **Alignement colonnes** : 100 % des champs des payloads matchent les headers CSV (`business_control`, `memory_decisions`, `team_comments`, `team_members`).
- **Validation côté serveur** : initiales auto si vide, couleur défaut, regex email + hex color, enum rôles.

## 2. Ce qui coince (irritants)

### Bug critique — WF21 PATCH efface les colonnes non renseignées
**Sévérité : haute.** Le node `Update team_members` mappe chaque colonne avec `={{ $json.patch.X }}`. Quand le CRM envoie juste `{id, is_active:false}` (bouton Désactiver), les expressions `$json.patch.name`, `.email`, `.role`, etc. renvoient `undefined`. n8n écrit alors une **chaîne vide** dans la cellule, ce qui **efface le nom, l'email, le rôle, les initiales et la couleur** du membre désactivé. Mes tests ne le voient pas (le faux backend ne reproduit pas ce comportement n8n spécifique), mais c'est ce qui se passera en prod.

**Fix recommandé** (à faire avant le test équipe) : ajouter un node "Read team_members → Find row" + "Code merge" entre `Auth & build PATCH` et `Update team_members`, qui complète le patch avec les valeurs existantes. Ou plus simple : passer en mode `mappingMode: "autoMapInputData"` après avoir construit l'objet complet.

### Petits irritants
- **Test webhook (Réglages → "Tester la connexion")** : utilise `GET /symbalyx-comments?item_id=__ping__`. Si seulement WF18 est activé et pas WF19, le test renvoie `HTTP 404` plutôt qu'un message clair "WF19 non activé". Pas grave mais source de confusion.
- **Kill switch côté webhook** : si `KILL_SWITCH=true` dans `config`, WF00 throw, WF18 stoppe via `onError: stopWorkflow` → **le webhook ne renvoie aucune réponse au CRM** (pas de 503, pas de message). Le CRM tombe en timeout puis fallback localStorage. Mieux : un node `respondToWebhook 503` quand kill switch actif.
- **Mode "mock" + ajout de membre** : le toast dit "Ajouté en local". Mais le membre est ajouté à l'instance en mémoire, pas persisté entre reloads. Comportement attendu mais pas évident pour l'utilisateur.
- **`decided_by` est une string libre, pas un id** dans le payload. Fonctionnel (rétro-compat) mais redondant avec `decider_id`. Au moins c'est documenté.
- **Le filtre "À moi" ne filtre que sur `assigned_to` qui contient le nom**. Si à terme `assigned_to` devient vide (migration vers `assignee_id`), il faudra que le filtre tombe sur `assignee_id` exclusivement. C'est déjà géré dans le code mais à vérifier après migration.
- **JSDOM** : tu n'es pas concerné, mais pour info — JSDOM remplace `window.crypto` par un stub. Le test polyfille `webcrypto` de Node ; c'est une singularité du harnais, pas un souci en navigateur réel (Safari/Chrome ont `crypto.subtle` natif).

## 3. Ce qui manque pour l'utiliser vraiment en équipe

### Sécurité
- **Un seul mot de passe partagé** entre tous les membres + un seul secret webhook. Si un secret fuite, tout le monde est compromis. Pour 5 personnes en interne c'est OK ; au-delà, il faut un mot de passe par membre.
- **Pas de RBAC fonctionnel** : `isAdminRole()` cache l'onglet Équipe aux non-admins, mais un sales malicieux qui connaît les URLs webhook + le secret peut quand même appeler `POST /symbalyx-team-members` directement et créer des membres. Le webhook ne sait pas qui appelle. À corriger avec un champ `caller_id` signé ou une auth par membre.
- **Pas d'audit log** : qui a désactivé qui, quand, depuis quelle IP — rien n'est tracé.

### Ergonomie pour 3-5 personnes
- **Pas d'affichage de qui a décidé** dans la liste BCL après décision (`decided_by` n'est pas montré dans `itemRow`). Quand Kentin se reconnecte demain et voit "approved", il ne sait pas si c'était lui ou Arsène sans cliquer.
- **Pas de "@mentions" dans les commentaires** ni de notification push à l'auteur ciblé. Un commentaire "@Kentin tu peux check ?" ne notifie pas Kentin.
- **Pas d'indicateur "nouveau commentaire depuis ma dernière visite"** sur les items.
- **Pas de "Réassigner à"** dans la modale détail. Pour passer une BCL d'Arsène à Kentin, il faut éditer la sheet à la main.
- **Liste équipe sans pagination** : OK pour 5, problématique à 50.
- **Pas d'undo après désactivation accidentelle** (mais le bouton "Réactiver" reste visible — partiellement OK).

### Boucle apprentissage
- **`outcome` reste vide** dans `memory_decisions`. Personne ne le remplit (ni IA, ni humain). Sans ça, l'IA ne sait pas si une décision approuvée a effectivement converti. Il faudrait un WF22 qui repasse périodiquement sur les décisions et rapproche avec `review_queue.reply_category` ou `project_queue.status`.
- **`decider_id` n'est pas exploité par WF7/WF8 (prioritization/advisor)**. L'IA pourrait apprendre que "Kentin approuve plus volontiers les coiffeurs" par exemple — pour l'instant c'est juste stocké, pas utilisé.

### Données
- **`team_members` doit être créé manuellement** dans Google Sheets avant le premier login (sinon WF21 GET renvoie liste vide → écran "Aucun membre actif"). À ajouter au script de seed (ou le mock embarqué fait l'affaire en dev).
- **Migration `assigned_to` → `assignee_id`** non faite dans WF1/WF7/WF8. Donc tant que ces WF ne posent pas l'`assignee_id`, le filtre "À moi" repose uniquement sur le nom (fonctionne tant que les noms sont uniques).
- **Pas de backup automatique des Sheets** vers Drive. Documenté en roadmap, pas livré.

---

## Si tu veux corriger juste le critique avant d'inviter l'équipe

1. **Patch WF21 PATCH** : insérer un Code node "Read & merge" qui lit la ligne existante par id et fusionne avec le patch reçu, avant l'update Sheets. (1 h de boulot, gros impact.)
2. **Afficher `decided_by` + `decided_at` dans la liste BCL** une fois la décision prise. (15 min de CRM.)
3. **Toast plus clair quand kill switch actif** : ajouter un node `respondToWebhook 503` dans WF18 sur la branche kill switch onError. (10 min.)
4. **Seed `team_members`** dans la doc d'install (NOTES.md précise déjà la création de l'onglet, juste ajouter "ajoute toi en première ligne avant le premier login", ou un WF utilitaire de seed.)

Avec ça en place, le système est solide pour 3-5 personnes en interne. Pour aller plus loin (SaaS), il faut s'attaquer au RBAC, au mot de passe par membre et au tenant.
