# Symbalyx — Déploiement iPad-only

Tu es sur iPad, pas de terminal, pas de laptop. Ce guide te fait passer du repo GitHub à un système Symbalyx vivant en moins d'une heure, en n'ouvrant que **Safari**.

---

## TL;DR — 8 étapes, 6 onglets Safari ouverts en parallèle

| # | Étape | Outil | ~Temps |
|---|---|---|---|
| 1 | Créer la Google Sheet (le "DB") | sheets.google.com | 10 min |
| 2 | Créer le projet Google Cloud + activer Sheets/Drive APIs | console.cloud.google.com | 10 min |
| 3 | Créer l'OAuth client | console.cloud.google.com | 5 min |
| 4 | Créer le compte n8n Cloud | n8n.cloud (essai 14j gratuit) | 5 min |
| 5 | Importer les 4 workflows essentiels | n8n web UI | 10 min |
| 6 | Brancher les credentials Google + le secret webhook | n8n web UI | 5 min |
| 7 | Activer GitHub Pages pour le CRM | github.com (Settings du repo) | 2 min |
| 8 | Premier login + bouton **Smoke test** | URL GitHub Pages | 3 min |

Si à l'étape 8 le smoke test passe en vert, **tu es en prod**. Sinon le test te dit lequel des 4 webhooks a un souci.

---

## Étape 1 — Google Sheet "Symbalyx DB"

1. Ouvre **sheets.google.com**, crée une nouvelle feuille de calcul.
2. Renomme-la `Symbalyx DB`.
3. **Note l'ID de la feuille** depuis l'URL : `https://docs.google.com/spreadsheets/d/AAA_C-EST-CET-ID_BBB/edit`. Cet ID va dans n8n + dans le CRM (Réglages).
4. Crée les onglets ci-dessous (clic droit sur l'onglet du bas → Insérer une feuille). Pour chaque onglet, **colle la ligne d'en-tête fournie dans la cellule A1** (Sheets séparera automatiquement par les virgules si tu colles depuis une cellule unique : utilise plutôt **Ctrl-V plein** depuis ce guide après "Données → Diviser le texte en colonnes" si nécessaire, ou copie chaque header dans sa propre cellule manuellement).

**Onglets minimaux pour le démarrage (les 4 essentiels) :**

```
team_members
id,name,email,role,initials,color,is_active,created_at
```

Ajoute toi-même comme première ligne (sinon impossible de te logger) :
- **A2** : `tm_arsene`
- **B2** : `Arsène`
- **C2** : `arsene@symbalyx.local` (ou ton vrai email)
- **D2** : `founder`
- **E2** : `AR`
- **F2** : `#3a86ff`
- **G2** : `TRUE`
- **H2** : laisse vide (ou colle la date du jour)

Et idem ligne 3 pour Kentin (`tm_kentin`, `Kentin`, …, `admin`, `KE`, `#ff8c42`, `TRUE`).

```
business_control
id,ts,run_id,source_workflow,item_type,item_id,title,recommendation,recommended_action,priority_score,priority_level,expected_impact,effort_level,assigned_to,assignee_id,requires_human_validation,decision_status,decided_by,decider_id,decided_at,notes
```

```
memory_decisions
id,ts,bcl_id,item_type,item_id,recommended_action,ai_initial_priority,decision,decided_by,decider_id,reason,outcome,outcome_observed_at
```

```
team_comments
id,ts,item_type,item_id,author,author_id,body,resolved,parent_id
```

```
config
key,value,notes
```

Ajoute deux lignes dans `config` :
- A2=`KILL_SWITCH`, B2=`false`, C2=`stop tout si true`
- A3=`MAX_BATCH`, B3=`30`, C3=`limite par run`

```
logs
ts,prospect_id,phase,status,level,message,meta
```

> Les autres onglets (`review_queue`, `project_queue`, `kpi_snapshots`, `notifications_inbox`, `invoices`, `memory_*`, etc.) sont nécessaires pour les workflows de prospection/projet/finance. Tu peux les créer plus tard quand tu activeras les WF correspondants. Pour le smoke test V8, ces 6 onglets suffisent.

5. Vérifie que l'**email du compte Google** que tu utilises dans n8n a accès à cette Sheet (en éditeur). Tu vas justement l'authentifier à l'étape 3.

---

## Étape 2 — Google Cloud Console : projet + APIs

1. Ouvre **console.cloud.google.com** dans un nouvel onglet Safari.
2. En haut, dropdown projet → **Nouveau projet** → nom : `symbalyx-prod` → Créer.
3. Une fois sur le projet : menu hamburger → **APIs et services → Bibliothèque**.
4. Cherche **Google Sheets API** → **Activer**.
5. Cherche **Google Drive API** → **Activer**.

---

## Étape 3 — OAuth consent screen + client ID

1. Dans le même projet : **APIs et services → Écran de consentement OAuth**.
2. Type d'utilisateur : **Externe** → Créer.
3. Remplis : nom de l'app `Symbalyx`, email d'assistance = ton email, email développeur = ton email. **Enregistrer et continuer**.
4. Étape "Champs d'application" : Skip → **Enregistrer et continuer**.
5. Étape "Utilisateurs de test" : **Ajouter** ton email (et celui de Kentin). Sans ça, l'app refusera la connexion en mode test. **Enregistrer**.
6. Maintenant : **APIs et services → Identifiants → + Créer des identifiants → ID client OAuth**.
7. Type d'application : **Application Web**.
8. Nom : `Symbalyx n8n`.
9. **URI de redirection autorisé** : tu vas le récupérer depuis n8n à l'étape 6. Pour l'instant, mets-en un placeholder ou laisse vide et tu reviendras.
10. **Créer**. Une popup affiche `client_id` + `client_secret`. **Ne ferme pas cette popup**, tu vas les coller dans n8n à l'étape 6.

> ⚠ Tu ne dois **jamais** me coller ces deux valeurs ici. Elles vont uniquement dans n8n (chiffrées côté serveur).

---

## Étape 4 — Compte n8n Cloud

1. Ouvre **n8n.cloud** → **Get started** → crée un compte (essai 14 jours gratuit, puis ~20 €/mois pour le plan le plus bas).
   - Alternative gratuite mais plus technique : self-hosting via Render / Railway / un VPS. Demande à Kentin (qui a un laptop) si vous voulez économiser ces 20 €. Pour le test équipe, Cloud est plus simple.
2. Choisis un sous-domaine (ex: `symbalyx.app.n8n.cloud`). **Note-le** : c'est le préfixe de tes URLs webhook.
3. Une fois dans n8n, va dans **Settings → Variables → + Add Variable**.
4. Crée la variable :
   - Key : `SYMBALYX_WEBHOOK_SECRET`
   - Value : génère une chaîne aléatoire de **32+ caractères** (par exemple va sur `passwordsgenerator.net` ou tape `openssl rand -hex 32` dans la console JavaScript de Safari : `[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('')` — exécutable depuis l'inspecteur web).
   - **Note cette valeur dans tes notes Apple en local**, tu vas la recopier dans le CRM à l'étape 8.
5. **Save**.

---

## Étape 5 — Importer les workflows

Dans n8n, pour chaque workflow listé ci-dessous :

1. **Workflows → + Add Workflow → Import from File** (ou bouton **Import** dans le menu trois points).
2. Tu peux **coller le JSON brut** (n8n a une option "Import from URL" ou "Import from clipboard").
3. URLs raw GitHub à copier-coller (depuis Safari iPad, longue pression sur le lien → Copier le lien) :

| Workflow | URL raw |
|---|---|
| WF00 Kill Switch | `https://raw.githubusercontent.com/symbalyx/symbalyx-ia/claude/symbalyx-decision-team-sync-ZyoMB/n8n/workflows/00_kill_switch.json` |
| WF18 Decision Executor | `…/18_decision_executor.json` |
| WF19 Team Sync | `…/19_team_sync.json` |
| WF21 Team Members | `…/21_team_members.json` |
| WF22 Outcome Reconciliation (optionnel pour smoke test) | `…/22_outcome_reconciliation.json` |
| WF99 Error Handler | `…/99_error_handler.json` |

Pour chaque workflow importé :
- Ouvre-le, **note l'ID de workflow** (visible dans l'URL après `/workflow/`).
- Active-le avec le toggle **Active** en haut à droite (ne le fais qu'**après** avoir branché les credentials, étape 6).
- Si le workflow contient un node "Execute Workflow" qui pointe vers `REPLACE_WITH_WF00_ID` (cas de WF18 et WF22), édite le node et sélectionne le workflow WF00 que tu viens d'importer.

---

## Étape 6 — Credentials Google + retour sur l'OAuth client

1. Dans n8n : **Credentials → + Add Credential**.
2. Cherche **Google Sheets OAuth2 API**.
3. Clique sur le champ **OAuth Redirect URL** : il affiche quelque chose comme `https://symbalyx.app.n8n.cloud/rest/oauth2-credential/callback`. **Copie-le**.
4. Retourne sur la popup Google Cloud (étape 3 point 10) : édite l'OAuth client → **Ajoute cette URL** dans "URIs de redirection autorisés" → Enregistrer.
5. Récupère le **Client ID** et **Client Secret** depuis Google Cloud → colle-les dans n8n.
6. Clique **Sign in with Google** → connecte-toi avec le compte Google qui a accès à la Sheet → autorise.
7. Le credential est sauvegardé. **Renomme-le** `Google Sheets Symbalyx`.
8. Retourne sur chaque workflow : ouvre les nodes **Google Sheets** (il y en a plusieurs) → champ **Credential** → sélectionne `Google Sheets Symbalyx`. Sauve.
9. Dans chaque node Google Sheets, le champ **Document ID** contient `{{GOOGLE_SHEET_ID}}` → remplace par l'ID Sheet noté à l'étape 1.
10. Active maintenant les workflows (toggle **Active**). Pour chacun, **note l'URL du webhook** affichée dans le node Webhook (ex: `https://symbalyx.app.n8n.cloud/webhook/symbalyx-decision`). Tu en as 5 :
   - `/webhook/symbalyx-decision`
   - `/webhook/symbalyx-comments`
   - `/webhook/symbalyx-team-members` (3 méthodes : GET, POST, PATCH — même URL)

> Le **base URL** côté CRM = `https://symbalyx.app.n8n.cloud/webhook` (sans le suffixe).

---

## Étape 7 — Héberger le CRM via GitHub Pages

1. Ouvre **github.com/symbalyx/symbalyx-ia** dans Safari.
2. **Settings → Pages**.
3. Source : **Deploy from a branch**.
4. Branche : `claude/symbalyx-decision-team-sync-ZyoMB` (ou `main` après merge).
5. Folder : **`/ (root)`** — comme on veut juste `n8n/crm/index.html`, on va plutôt :
   - Créer un fichier `index.html` à la racine qui redirige vers `/n8n/crm/index.html`. Plus simple : utilise directement l'URL `https://symbalyx.github.io/symbalyx-ia/n8n/crm/index.html`.
6. Sauvegarde. GitHub Pages met 1-2 minutes à publier.
7. **Note l'URL publique** : `https://symbalyx.github.io/symbalyx-ia/n8n/crm/index.html`.

> Alternatives si GitHub Pages refuse (repo privé sur free tier, etc.) :
> - **Netlify Drop** : `app.netlify.com/drop`. Tu dragues le dossier `n8n/crm/` (zip-en-ligne via les Fichiers iPad) → URL HTTPS instantanée.
> - **Vercel** : importer le repo GitHub, output dir = `n8n/crm/`.

---

## Étape 8 — Premier login + smoke test

1. Ouvre l'URL du CRM dans Safari iPad.
2. Mot de passe local : choisis-en un (il est juste haché en local, pas envoyé). Tape-le, **Entrer**.
3. L'écran de choix d'identité ne va PAS encore charger la liste depuis n8n (parce que tu n'as pas encore configuré le webhook côté CRM). Il prendra le mock embarqué (Arsène + Kentin). Choisis Arsène.
4. Tu arrives dans l'app. **Réglages**.
5. Section **Webhook n8n** :
   - URL : `https://symbalyx.app.n8n.cloud/webhook` (ton sous-domaine + `/webhook`).
   - Secret : colle la valeur générée à l'étape 4.
6. **Enregistrer**.
7. Toujours dans Réglages, clique **Smoke test complet** (le nouveau bouton à côté de "Tester la connexion").
8. Le test exécute 4 appels et affiche un mini-rapport :

   ```
   ✓ WF21 GET /team-members          200 OK · 2 membres actifs
   ✓ WF19 POST /comments             200 OK · cmt_xxxx créé
   ✓ WF19 GET  /comments?item=smoke  200 OK · 1 commentaire récupéré
   ✓ WF18 POST /decision (404 attendu) · webhook répond
   ```

   Si tout est ✓, **tu es en prod**. Tu peux te re-logger : cette fois, l'écran d'identité chargera la liste depuis ta Sheet `team_members`.

9. Si une ligne est ✗ :
   - **WF21 ✗ 401** → secret webhook mal configuré côté n8n ou côté CRM. Vérifie qu'ils sont strictement identiques.
   - **WF21 ✗ 500 "secret not configured"** → la variable d'env n8n n'est pas accessible au workflow. Edite le workflow : Settings → Variables.
   - **WF19 POST ✗ 401** → idem.
   - **WF19 POST ✗ 500** → l'onglet `team_comments` n'existe pas dans la Sheet, ou la Sheet n'est pas partagée avec le compte Google connecté à n8n.
   - **WF18 ✗ timeout** → le workflow WF18 n'est pas activé dans n8n.

---

## Que tester en équipe ensuite

Une fois le smoke test vert, fais ce mini-scénario à 2 navigateurs (toi + Kentin) :

1. Toi : Settings → identité = Arsène. Crée un membre fictif "Test Demo" rôle `viewer` via l'onglet **Équipe**.
2. Kentin (sur son téléphone/laptop) : ouvre l'URL CRM, login, choisis Kentin.
3. Kentin : crée un commentaire sur n'importe quel item BCL mock (ouvre une carte, écris dans la zone commentaires, **Envoyer**).
4. Toi : ouvre la même carte. Le commentaire de Kentin doit apparaître (signé Kentin, avec son orange).
5. Toi : **Désactive** le membre "Test Demo" via l'onglet Équipe.
6. Vérifie dans la Sheet `team_members` (web) : la ligne Test Demo a bien `is_active=FALSE`, et **toutes les autres colonnes sont intactes** (le fix V8.1 du bug PATCH).
7. Toi : prends une décision Approuver sur la BCL mock "Plomberie Dupont". Vérifie dans Sheet `business_control` : `decision_status=approved`, `decided_by=Arsène`, `decider_id=tm_arsene`. Vérifie dans `memory_decisions` : nouvelle ligne avec `ai_initial_priority=critical`.

Si ces 7 points marchent, **tu peux brancher les workflows de prospection** (WF1, WF2, WF4, WF5, WF7) — ils écriront dans la même Sheet et tout le pipeline tournera.

---

## Quand revenir vers moi

- **Smoke test rouge** → colle-moi le message d'erreur exact, je diagnostique.
- **Onglet manquant dans Sheet** → dis-le moi, je te génère la liste exacte des colonnes.
- **Workflow de prospection à activer (WF1/WF2/WF4/WF5)** → on attaque dans une session dédiée, c'est plus de complexité (LLM credentials, niches, etc.).
- **Tests en équipe OK** → on passe aux features du palier suivant : RBAC fonctionnel, mot de passe par membre, backup Drive auto.

---

## Ce qu'il NE faut PAS faire

- Ne me copie/colle **jamais** ton `client_id`, `client_secret`, ou `SYMBALYX_WEBHOOK_SECRET` ici.
- Ne commit pas le `client_secret.json` dans Git si Google Cloud t'en propose le téléchargement.
- Ne désactive pas l'option "Test users" de l'écran OAuth (elle te protège tant que tu n'as pas publié l'app).
- Ne mets pas le mot de passe local du CRM à `1234` même pour tester — un appui sur F12 et c'est lisible côté navigateur partagé.
