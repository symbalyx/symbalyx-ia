# Symbalyx — Guide complet pour ce soir

Tu as ton PC ce soir. Suis ce guide dans l'ordre. Toutes les étapes sont indispensables sauf celles marquées **[optionnel]**.

---

## Sommaire

1. [Ce que tu vas déployer](#ce-que-tu-vas-déployer)
2. [Pré-requis](#pré-requis)
3. [Étape 1 — Google Sheet (5 min)](#étape-1--google-sheet-5-min)
4. [Étape 2 — Google Cloud OAuth (10 min)](#étape-2--google-cloud-oauth-10-min)
5. [Étape 3 — n8n Cloud (5 min)](#étape-3--n8n-cloud-5-min)
6. [Étape 4 — Patcher les workflows (2 min)](#étape-4--patcher-les-workflows-2-min)
7. [Étape 5 — Importer les workflows (5 min)](#étape-5--importer-les-workflows-5-min)
8. [Étape 6 — GitHub Pages (2 min)](#étape-6--github-pages-2-min)
9. [Étape 7 — Smoke test (3 min)](#étape-7--smoke-test-3-min)
10. [Étape 8 — Tester le chat bot↔bot (3 min)](#étape-8--tester-le-chat-botbot-3-min)
11. [Tour des features qui font "wow"](#tour-des-features-qui-font-wow)
12. [Quoi faire après ce soir](#quoi-faire-après-ce-soir)
13. [Si ça casse](#si-ça-casse)

---

## Ce que tu vas déployer

**11 workflows n8n :**

| WF | Nom | Rôle | Webhook |
|---|---|---|---|
| WF00 | Kill Switch | Lit `config!KILL_SWITCH` pour stopper tout en urgence | sub-workflow |
| WF18 | Decision Executor | Boucle IA→humain→mémoire | `POST /symbalyx-decision` |
| WF19 | Team Sync | Commentaires partagés | `POST/GET /symbalyx-comments` |
| WF20 | Finance Manager | Ledger + wishlist + état calculé (runway, burn) | `POST/GET /symbalyx-finance` |
| WF21 | Team Members CRUD | Ajouter / désactiver / lister membres | `GET/POST/PATCH /symbalyx-team-members` |
| WF22 | Outcome Reconciliation | Cron 3h du mat : remplit `outcome` dans memory_decisions | cron |
| WF23 | BCL Reassign | Réassigner une décision BCL avec audit | `POST /symbalyx-reassign` |
| WF30 | WhatsApp Bot | Squelette Twilio/Meta — désactivé par défaut | `POST /symbalyx-whatsapp` |
| WF40 | Agent Relay | Bus de messages bot↔bot avec inbox + ack | `POST /symbalyx-agents` |
| **WF50** | **Site Builder** | **Génère un index.html complet via Claude Opus 4.7 depuis un brief projet** | `POST /symbalyx-build-site` |
| WF99 | Error Handler | Capture les erreurs des autres WF | sub-workflow |

**4 Skills livrés** (dossier `skills/`) :
- `site-builder.md` — la spec du générateur de sites HTML (utilisé par WF50)
- `email-draft.md` — composition emails 2 variants (concise/warmer)
- `lead-qualifier-bland.md` — qualification voix via Bland.ai (à brancher)
- `prospect-finder-leadgenius.md` — découverte de leads B2B (à brancher)

**1 CRM web (single-page, hébergé sur GitHub Pages) :**

8 vues — Aujourd'hui · Prospects · Décisions · Projets · **Argent** · Mémoire · Logs · Équipe (admin) + Réglages.

**18 onglets Google Sheets :**

`team_members`, `business_control`, `memory_decisions`, `team_comments`, `config`, `logs`, `review_queue`, `project_queue`, `kpi_snapshots`, `notifications_inbox`, `invoices`, `memory_prospects`, `memory_niches`, `finance_ledger`, `wishlist`, `whatsapp_log`, `agent_messages`. Tous créés en 1 clic par l'Apps Script.

---

## Pré-requis

- **PC avec terminal** (Windows/Mac/Linux)
- **Node.js 18+** installé (`node --version`)
- **Compte Google** (le même que tu utiliseras dans n8n)
- **Compte n8n.cloud** (essai 14 jours gratuit, ~20 €/mois ensuite — alternative self-hosting plus tard)
- **Repo cloné** :
  ```bash
  git clone https://github.com/symbalyx/symbalyx-ia
  cd symbalyx-ia
  git checkout claude/symbalyx-decision-team-sync-ZyoMB
  ```

---

## Étape 1 — Google Sheet (5 min)

1. **sheets.google.com** → Nouvelle feuille → renomme-la `Symbalyx DB`.
2. **Note l'ID** depuis l'URL : `…/spreadsheets/d/CET-ID-ICI/edit` → copie cet ID, tu en auras besoin.
3. **Extensions → Apps Script**.
4. Supprime le code par défaut, colle le contenu de `n8n/setup/sheets_init.gs` (depuis ton repo cloné).
5. Sauve (Ctrl+S), puis **▶ Run** sur la fonction `initSymbalyxDB`.
6. Autorise les permissions → ~10 secondes plus tard, **18 onglets sont créés** avec leurs en-têtes, plus Arsène et Kentin déjà dans `team_members`.
7. Si tu veux tester WhatsApp plus tard, ajoute ton numéro dans la colonne `whatsapp_number` de la ligne Arsène (format `+33612345678`).

---

## Étape 2 — Google Cloud OAuth (10 min)

1. **console.cloud.google.com** → nouveau projet `symbalyx-prod`.
2. Menu → **APIs et services → Bibliothèque**.
3. Active **Google Sheets API** ET **Google Drive API**.
4. **APIs et services → Écran de consentement OAuth** → Externe → nom de l'app `Symbalyx`, ton email partout → Save.
5. Section **Utilisateurs de test** → Ajoute ton email + celui de Kentin → Save.
6. **APIs et services → Identifiants → + Créer → ID client OAuth → Application Web → Symbalyx n8n**.
7. **URI de redirection autorisé** : laisse vide pour l'instant, tu y reviendras à l'étape 5.
8. **Créer**. Garde la popup ouverte (ou télécharge le JSON) — tu auras besoin de `client_id` + `client_secret`.

---

## Étape 3 — n8n Cloud (5 min)

1. **n8n.cloud** → Get started → crée ton compte → choisis un sous-domaine (ex: `symbalyx.app.n8n.cloud`). **Note-le**.
2. **Settings → Variables → + Add Variable** :
   - Key : `SYMBALYX_WEBHOOK_SECRET`
   - Value : génère 32+ caractères aléatoires depuis ton terminal :
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - **Note la valeur** dans un fichier local (jamais dans Git) — tu la coleras dans le CRM à l'étape 7.
3. Save.

---

## Étape 4 — Patcher les workflows (2 min)

Dans ton terminal, dans le repo :

1. Importe **WF00 d'abord** dans n8n (étape 5 ci-dessous, juste WF00) → ouvre-le → note son ID dans l'URL n8n (`/workflow/XXXX`).
2. Reviens au terminal :
   ```bash
   node n8n/setup/inject.js TON_GOOGLE_SHEET_ID L_ID_DU_WF00
   ```
   Ça remplace `{{GOOGLE_SHEET_ID}}` et `REPLACE_WITH_WF00_ID` dans **les 10 workflows essentiels** (un backup est sauvé dans `n8n/workflows/.backup/`).
3. Tu verras `✓ X remplacements dans 10 fichiers`.

---

## Étape 5 — Importer les workflows (5 min)

Dans n8n : **Workflows → + Add Workflow → Import from File** pour chacun :

```
n8n/workflows/00_kill_switch.json          (importe-le en PREMIER pour avoir l'ID)
n8n/workflows/18_decision_executor.json
n8n/workflows/19_team_sync.json
n8n/workflows/20_finance_manager.json
n8n/workflows/21_team_members.json
n8n/workflows/22_outcome_reconciliation.json
n8n/workflows/23_bcl_reassign.json
n8n/workflows/30_whatsapp_bot.json         (laisse désactivé)
n8n/workflows/40_agent_relay.json
n8n/workflows/99_error_handler.json
```

**Configuration des credentials Google Sheets** (à faire UNE fois) :

1. n8n → **Credentials → + Add Credential → Google Sheets OAuth2 API**.
2. Champ **OAuth Redirect URL** : copie cette valeur (ex: `https://symbalyx.app.n8n.cloud/rest/oauth2-credential/callback`).
3. Retourne dans Google Cloud (étape 2 popup) → **Modifier l'OAuth client** → ajoute cette URL dans "URIs de redirection autorisés" → Save.
4. Reviens dans n8n → colle `client_id` + `client_secret` → **Sign in with Google** → autorise → renomme le credential `Google Sheets Symbalyx`.

**Pour chaque workflow importé** :
- Ouvre-le → chaque node Google Sheets → **Credential** = `Google Sheets Symbalyx`.
- Active le workflow (toggle en haut à droite). **Sauf WF30** que tu laisses désactivé.

---

## Étape 6 — GitHub Pages (2 min)

1. **github.com/symbalyx/symbalyx-ia** → Settings → Pages.
2. **Source** : Deploy from a branch.
3. **Branch** : `claude/symbalyx-decision-team-sync-ZyoMB` · **Folder** : `/ (root)`.
4. Save → attends 1-2 min.
5. URL du CRM : `https://symbalyx.github.io/symbalyx-ia/n8n/crm/index.html`

> Le fichier `.nojekyll` à la racine garantit que GitHub Pages serve le CRM sans filtrage Jekyll.

---

## Étape 7 — Smoke test (3 min)

1. Ouvre l'URL du CRM dans Safari/Chrome → premier accès = tu choisis un mot de passe local → Entrer.
2. Choisis Arsène dans la liste.
3. **Réglages** :
   - URL webhook : `https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook` (sans `/symbalyx-...` à la fin)
   - Secret : la valeur générée à l'étape 3
   - Source : `mock` (on changera à `sheets` après le smoke test)
4. **Enregistrer**.
5. Bouton **Smoke test complet** → 4 lignes doivent être ✓ :
   ```
   ✓ WF21 GET /team-members          200 OK
   ✓ WF19 POST /comments             200 OK
   ✓ WF19 GET  /comments?item=smoke  200 OK
   ✓ WF18 POST /decision (404 attendu) · webhook répond
   ```
6. Si tout est ✓, repasse en source `sheets` dans Réglages → mets ton Sheet ID + ta clé API Google Sheets (générée dans Google Cloud → Identifiants → + Créer → Clé API publique) → enregistre.

---

## Étape 7bis — Activer WF50 Site Builder (5 min) [optionnel mais wow]

Le générateur de sites IA. C'est ce qui te livre des HTML clients en 30 secondes pour 0,10 €.

1. Va sur **console.anthropic.com** → API Keys → Create Key → copie la clé.
2. n8n → **Settings → Variables → + Add** :
   - Key : `ANTHROPIC_API_KEY`
   - Value : `sk-ant-api03-...` (ta clé)
3. Active **WF50** dans n8n (toggle).
4. Test rapide depuis le terminal :
   ```bash
   curl -X POST https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook/symbalyx-build-site \
     -H "Content-Type: application/json" \
     -H "x-symbalyx-token: TON_SECRET" \
     -d '{
       "project_id":"proj_test",
       "client_name":"Salon Élégance",
       "niche":"coiffure premium",
       "city":"Lyon",
       "tone":"élégant",
       "colors":"or sur noir profond",
       "pages":["home","services","contact"],
       "email":"contact@salon-elegance.fr"
     }'
   ```
5. Réponse : `{ ok:true, deliverable_id:"del_...", html_size:12000+, cost_eur:"0.18", html:"<!doctype html>..." }`. 30-60 secondes d'attente.
6. Une ligne apparaît dans la Sheet `project_deliverables`, et un message dans `agent_messages` (silent, level=progress).
7. Dans le CRM → ouvre n'importe quel projet → bouton **✨ Générer le site** → tu auras une fenêtre avec l'aperçu live du HTML.

> Coût d'usage : ~0,18 € en Opus 4.7 (qualité max), ou ~0,06 € en Sonnet 4.6 (excellent aussi). Pour passer en Sonnet, change `model` dans le workflow node `Claude — Generate HTML`.

---

## Étape 8 — Tester le chat bot↔bot (3 min)

C'est le truc le plus impressionnant — tes workflows se parlent entre eux et n'escaladent vers toi que si nécessaire.

1. Dans n8n, ouvre WF40 Agent Relay → **Execute Workflow** manuellement OU utilise un terminal :
   ```bash
   curl -X POST https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook/symbalyx-agents \
     -H "Content-Type: application/json" \
     -H "x-symbalyx-token: TON_SECRET" \
     -d '{
       "kind":"post",
       "from_workflow":"WF99",
       "level":"blocked",
       "title":"Test escalade vers humain",
       "body":"Si tu vois ce message dans le CRM, le bus bot↔bot fonctionne."
     }'
   ```
2. Réponse attendue : `{"ok":true,"kind":"post","id":"agt_..."}`. Une ligne apparaît dans la Sheet `agent_messages` avec `escalated_to_human=true`.
3. Ouvre le CRM → **Aujourd'hui** → tu dois voir une carte "Échanges entre bots — escalades" avec ton message.
4. Clique **✓ Pris en compte** → la ligne disparaît du CRM, et dans la Sheet `agent_messages` la colonne `acknowledged_by` contient ton nom.
5. Refais un POST avec `level=progress` au lieu de `blocked` → tu verras qu'il N'apparaît PAS dans le CRM (silent), il est juste loggé dans la Sheet → c'est exactement le comportement voulu.

**Pattern à appliquer dans tes futurs workflows** : à chaque étape importante, ajoute un node HTTP Request qui POST vers `/symbalyx-agents` avec :
- `level=progress` pour les avancées silencieuses
- `level=blocked` quand le workflow ne peut pas continuer (escalade auto)
- `escalated_to_human=true` si tu veux forcer l'escalade

---

## Tour des features qui font "wow"

### 1. Synthèse du matin IA sur "Aujourd'hui"

Quand tu ouvres le CRM le matin, en haut tu vois :

> **Bonjour Arsène, voici ce que je te recommande de regarder en premier ce matin :**
>
> ⚠ **Plomberie Dupont — Bordeaux** · décision critical
> → Relancer sous 48h, projet vitrine simple, fit niche
>
> ✉ **Salon Marie — interested** · réponse chaude
> → Relancer sous 48h
>
> ⛔ **Atelier Marc bloqué** · projet
> → Identifier le bloqueur (input client / dépendance) et débloquer.
>
> € **Facture INV_2026_011** · 16j de retard
> → Relance niveau 2 (16j de retard).

L'IA mélange BCL critical, réponses chaudes, projets bloqués, factures en retard, wishlist priority high — top 5, trié par score, click = ouvre la fiche directement.

### 2. Cmd+K command palette

`Cmd+K` (Mac) / `Ctrl+K` (Windows) ouvre une palette qui cherche dans **toutes les fiches** : décisions, prospects, projets, membres, commandes (rafraîchir, smoke test, theme, logout). Tape "plomberie" → hop, tu cliques sur la fiche.

### 3. Onglet Argent avec sparklines + projection 30j

4 cartes KPI : Solde, Revenus du mois, Dépenses du mois, **Runway en mois** (coloré rouge <1 mois, ambre <3 mois, vert >3 mois). Chaque carte a une **sparkline 6 mois** SVG inline (zéro lib).

Recommandation IA dynamique :
> ⚠ Wishlist (1 950 €) > solde (840 €). Encaisse d'abord ou priorise.
>
> ℹ 850 € à encaisser. Relance les factures impayées d'abord.
>
> → Projection 30j : 1 245 € (+405 € vs aujourd'hui).

Wishlist avec badge "**finançable**" / "**attendre**" / "**trop tôt**" calculé en live contre `solde - 3 × burn`.

### 4. Auto-catégorisation des dépenses

Tape "Vercel Pro" → catégorie "hosting" suggérée auto. Tape "URSSAF mars" → "tax". Tape "SNCF Paris-Bordeaux" → "travel". Tu peux toujours surcharger manuellement, l'IA ne t'écrase jamais. 11 règles regex couvrent les vendors français les plus courants.

### 5. Détection des dépenses récurrentes

Si tu paies "Vercel Pro" 25 € chaque mois, après 2 occurrences le système l'étiquette **récurrent** (badge violet). La reco IA t'affiche :
> ℹ Dépenses récurrentes détectées : ~155 €/mois fixes. Audite-les si runway baisse.

### 6. Détection overdue automatique

Toute facture client ou dépense `pending` avec `due_date < aujourd'hui` reçoit un badge rouge **"en retard"**. La reco IA escalade :
> ⚠ 2 factures client en retard (1 200 €). Relance prioritaire.

### 7. @mentions dans les commentaires

Tape `@` dans un commentaire → popup avec la liste de l'équipe, flèches haut/bas, Enter pour insérer. À l'affichage, `@Arsène` est colorié en vert accent. Sur mobile/iPad, le popup est clampé pour ne jamais déborder.

### 8. Résumé IA + historique d'activité dans la modale BCL

Quand tu ouvres une décision, tu vois immédiatement :

```
Plomberie Dupont — Bordeaux · prospect
priorité critical · assigné Arsène · IA : follow_up_24h
en attente depuis 3h · 0 commentaire
```

Plus bas, un dépliant "Historique d'activité" qui te montre la chronologie :

> 🟣 IA a proposé priorité critical · action : follow_up_24h *(il y a 3h)*
> 🟣 Assignée à Arsène *(il y a 3h)*
> 🟢 Arsène a approuvé · "fit niche, lead chaud" *(il y a 1h)*
> 🔵 Kentin a commenté · "OK je m'en occupe demain" *(il y a 30 min)*

### 9. Détection de doublons prospects

Si tu reçois un nouveau prospect "Plomberie Dupont SARL" alors qu'il y a déjà "Plomberie Dupont" en base, la fiche affiche en haut :

> ⚠ **Doublon possible**
> Match sur : nom avec **Plomberie Dupont**

Comparaison sur company_name normalisé (sans accent/casse/ponctuation) ET email domaine.

### 10. Bot inbox + acknowledge

Tes workflows écrivent leur progression dans `agent_messages`. Le CRM ne te montre QUE les `level=blocked` ou `escalated_to_human=true`. Tu cliques **✓ Pris en compte** → la ligne disparaît du CRM mais reste dans la Sheet (audit trail).

### 11. Réassignation rapide avec audit

Sur n'importe quelle décision BCL, bouton **↪ Réassigner**. WF23 fait un Read+Merge (anti-wipe) sur la ligne, met à jour `assigned_to` + `assignee_id`, ajoute une annotation dans `notes` ("réassigné de X à Y par Z le 2026-05-10"), et logge l'événement dans `agent_messages`.

### 12. Smoke test 1-clic

Dans Réglages, le bouton "Smoke test complet" exécute 4 appels webhook séquentiels (WF21 GET, WF19 POST, WF19 GET, WF18 404 attendu) et te dit en 30 secondes si la chaîne est verte ou exactement quel webhook a un souci avec le code HTTP.

### 13. Export CSV pour le comptable

Sur l'onglet Argent, bouton "↓ CSV" → fichier `symbalyx_finance_2026-05-10.csv` avec toutes les colonnes (id, ts, type, montant, catégorie, description, status, échéance, paiement, créateur, vendor, n° facture, notes). Échappe correctement virgules et guillemets.

### 14. Soft-delete sécurisé

Quand tu supprimes une opération financière, elle n'est PAS effacée — son statut passe à `deleted` avec une note "soft-deleted by Arsène". Audit trail intact, historique de la Sheet préservé. Seul le créateur ou un admin/founder peut supprimer.

### 15. PWA installable

Sur iPad, Safari → bouton partage → "Sur l'écran d'accueil". L'app s'installe en mode standalone, theme sombre, icônes 512px, raccourcis vers Décisions/Aujourd'hui/Activité au long press de l'icône.

### 16. Raccourcis clavier

`g+t` → Aujourd'hui · `g+p` → Prospects · `g+d` → Décisions · `g+a` → Argent · `g+m` → Mémoire · `g+l` → Logs · `g+e` → Équipe · `g+s` → Réglages · `/` → palette · `a/r` → approuver/rejeter dans une fiche · `?` → aide.

---

## Quoi faire après ce soir

**Demain matin** :
- Vérifie que WF22 (cron 3h) a bien tourné — regarde la Sheet `memory_decisions`, la colonne `outcome` doit commencer à se remplir.

**Cette semaine** :
- Test à 2 avec Kentin : il s'identifie comme Kentin, fait un commentaire, tu le vois apparaître chez toi avec sa couleur orange.
- Active **WF1 prospection** dans une session dédiée — c'est ce qui te ramène les leads.

**Plus tard (P2)** :
- Branche WF30 WhatsApp : Twilio sandbox = 10 min gratuit pour POC. Voir `n8n/WHATSAPP_SETUP.md`.
- Migration Supabase quand tu dépasses 5k prospects (schéma SQL prêt dans `n8n/schemas/supabase_schema.sql`).
- RBAC enforced (actuellement c'est juste sémantique UI).

---

## Si ça casse

**Smoke test rouge** :
- WF21 ✗ 401 → secret webhook mismatch entre n8n Variables et CRM Réglages.
- WF21 ✗ 500 "secret not configured" → la variable d'env n'est pas accessible. Re-vérifie n8n Settings → Variables.
- WF19 POST ✗ 500 → l'onglet `team_comments` n'existe pas OU la Sheet n'est pas partagée avec ton compte Google.
- WF18 ✗ timeout → WF18 n'est pas activé.

**Le CRM montre "mock" malgré ma config sheets** :
- Vérifie dans Réglages que `Source = sheets` ET que ta clé API Google Sheets est bien collée.
- La clé API Sheets est différente du client OAuth ! Va sur Google Cloud → Identifiants → + Créer → **Clé API** publique → restreins-la à Sheets/Drive APIs.

**Le bot inbox reste vide alors que j'ai posté** :
- Vérifie WF40 est activé.
- Vérifie que la ligne dans `agent_messages` a bien `escalated_to_human=true` ou `level=blocked`. Sinon c'est volontairement silencieux.

**Réassigner échoue** :
- Vérifie WF23 est activé.
- Vérifie que tous les nodes WF23 ont le credential `Google Sheets Symbalyx`.

**Question/blocage** : reviens vers moi avec le message d'erreur exact + la ligne de la Sheet `logs` correspondante. Je diagnostique en 5 min.

---

## Sécurité rappel

- **Jamais** tu me colles `client_secret`, `client_id`, ou `SYMBALYX_WEBHOOK_SECRET` dans la conversation.
- **Jamais** tu commit `client_secret.json` dans Git (`.gitignore` couvre déjà les patterns standard).
- Le mot de passe local du CRM est **haché en local** (jamais envoyé), mais ne mets pas `1234` quand même.
- Tous les webhooks sont protégés par `x-symbalyx-token`. Sans ce header, c'est 401 systématique.

---

## Stats finales du système

- **10 workflows n8n** (8 actifs + 2 désactivés : WF30, WF99)
- **18 onglets Google Sheets** (créés en 1 clic)
- **8 vues + 2 écrans login** dans le CRM (single-page, ~3000 lignes)
- **59 tests automatisés** (35 logique workflows + 24 CRM headless)
- **0 dépendance JS runtime** (vanilla JS, Chart.js juste pour les KPI futurs)
- **PWA installable** iOS / Android / Desktop
- **2 thèmes** (dark par défaut, light toggle)

Bon déploiement.
