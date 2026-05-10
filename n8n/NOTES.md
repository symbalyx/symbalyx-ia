# Symbalyx — NOTES.md (V8)

## Ce qui est fait
- **Prospection (V1)** : WF1 ingestion + 3 agents (analyse, score, email) → `review_queue`.
- **Réponses & briefs (V2)** : WF2 draft creator, WF4 reply classifier, WF5 brief, WF6 ops.
- **Pilotage central (V3)** : WF7 prioritization, WF8 advisor, WF9 weekly summary + `business_control` + `kpi_snapshots`.
- **Agence ops (V4)** :
  - WF10 client onboarding (welcome draft + intake)
  - WF11 project delivery watch (détection blocages/deadlines, append BCL)
  - WF12 client reporting hebdo (vendredi 16h)
  - WF13 knowledge base (retrieval lexical, sans coût LLM)
  - WF14 finance light (relances 3 niveaux, sans LLM, montants depuis sheet)
- **Reliability (V4)** :
  - WF99 Error Handler (Error Trigger global → logs)
  - WF00 Kill Switch (sub-workflow lecteur de `config`)
  - 6 statuts `decision_status` standardisés (pending/approved/rejected/done/snoozed/error)
- **Boucle de décision + équipe (V7)** :
  - **WF18 Decision Executor** : webhook `POST /webhook/symbalyx-decision`. Reçoit `{bcl_id, decision, decided_by, decider_id?, reason?}`, met à jour `business_control` (decision_status, decided_by, decider_id, decided_at), écrit dans `memory_decisions` (avec `ai_initial_priority` capturée + decider_id), route l'action approuvée (`follow_up_24h` → flag `human_decision=approved` dans review_queue pour que WF2 crée le draft Gmail ; `quote` → log pour WF5 ; `reminder_*` → log pour WF14 ; rejected/snoozed/abandoned → noop).
  - **WF19 Team Sync** : 2 webhooks (`POST /webhook/symbalyx-comments`, `GET /webhook/symbalyx-comments?item_type=…&item_id=…`). Permet à l'équipe de partager des commentaires sur n'importe quel item BCL/prospect/projet/facture, persistés dans la sheet `team_comments` (avec `author_id` lié à `team_members`).
  - **Auth** : header `x-symbalyx-token`, secret `SYMBALYX_WEBHOOK_SECRET` (env n8n) à recopier dans le CRM (Réglages).
- **Boucle d'apprentissage (V8.1)** :
  - **WF22 Outcome Reconciliation** : cron quotidien (3h matin) qui rapproche `memory_decisions` (decision=approved) avec `review_queue` / `project_queue` pour remplir `outcome` + `outcome_observed_at`. Mappings : prospect interested/needs_quote → `reply_received` ; not_interested/opt_out → `rejected_by_prospect` ; pas de reply après 30j → `no_reply` ; project delivered → `delivered` ; abandoned → `abandoned` ; blocked >30j → `stuck`. Idempotent (skip outcome déjà rempli), capé à 50 par run, kill switch + log.
  - **Fix critique WF21 PATCH** : ajout d'un node `Read team_members (PATCH)` + `Merge patch with existing` avant `Update`. Évite l'effacement des colonnes non renseignées lors d'un PATCH partiel (cas du bouton Désactiver qui n'envoie que `{id, is_active:false}`).
  - **CRM** : la modale détail BCL affiche désormais `decided_by` + `decided_at` quand la décision est prise, et masque les boutons Approuver/Rejeter pour éviter une double action.

- **Multi-utilisateurs / équipe (V8)** :
  - **Référentiel `team_members`** (sheet + Supabase) : id, name, email, role (founder/admin/sales/dev/viewer/member), initials, color, is_active, created_at.
  - **WF21 Team Members CRUD** : webhooks `GET/POST/PATCH /webhook/symbalyx-team-members` avec auth header. Liste, ajout, activation/désactivation. Validation : nom requis, email format, rôle dans l'enum, color hex.
  - **CRM en mode équipe** :
    - **Login en 2 étapes** : mot de passe local (existant) → choix du membre actif. Si l'identité enregistrée est encore valide dans la liste, l'étape 2 est sautée.
    - **Identité courante** = objet `{id, name, role, initials, color}` stocké dans `localStorage`. `symbDecide` envoie `decider_id`, `symbPostComment` envoie `author_id`.
    - **Section "Équipe"** (admin only — fondateur/admin) : ajout d'un membre (formulaire), liste des membres avec activer/désactiver, signe les actions avec l'identité courante.
    - **Filtre "À moi"** sur Décisions : matche `assignee_id == identity.id` (si présent) ou `assigned_to.includes(identity.name)` (rétro-compat).
    - **Badge identité** dans le header (initiales + couleur).
  - **Schémas** : nouvelle table/onglet `team_members`. `business_control` gagne `assignee_id` + `decider_id`. `memory_decisions` gagne `decider_id`. `team_comments` gagne `author_id`. Les champs texte (`assigned_to`, `decided_by`, `author`) restent pour la rétro-compat et l'affichage.
- **Data layer** :
  - `n8n/schemas/*.csv` — 12 onglets Sheets
  - `n8n/schemas/supabase_schema.sql` — schéma Postgres compatible (V5 migration)
- **Dashboard privé** : `n8n/dashboard/index.html` (vanilla JS + Chart.js, lecture seule, mock/Sheets/Supabase, dark mode, filtres, export CSV, notifications).

## Ce qu'il reste à brancher (manuel après import)
1. **Credentials n8n** :
   - Google Sheets OAuth2
   - Gmail OAuth2 (pour Create Draft + Trigger)
   - HTTP Header Auth (LLM Bearer)
2. **Variables d'env** dans n8n : voir `ENV.example`.
3. **IDs de sub-workflows** à remplacer dans :
   - `04_reply_classifier.json` → `REPLACE_WITH_WF5_ID`
   - `09_weekly_summary.json` → `REPLACE_WITH_WF7_ID`, `REPLACE_WITH_WF8_ID`
   - `18_decision_executor.json` → `REPLACE_WITH_WF00_ID` (sub-workflow kill switch)
   - `22_outcome_reconciliation.json` → `REPLACE_WITH_WF00_ID` (kill switch)
4. **Onglets Google Sheets** à créer — headers dans `n8n/schemas/`. **Nouveaux V7/V8** :
   - `team_comments` (id, ts, item_type, item_id, author, author_id, body, resolved, parent_id)
   - `team_members` (id, name, email, role, initials, color, is_active, created_at)
   - `memory_decisions` : ajouter colonnes `ai_initial_priority` et `decider_id`
   - `business_control` : ajouter colonnes `assignee_id` et `decider_id`
5. **Webhooks V7/V8** :
   - Variable d'env n8n : `SYMBALYX_WEBHOOK_SECRET` (≥ 32 chars aléatoires, jamais commité).
   - Activer WF18 + WF19 + WF21 → noter les URLs `/webhook/symbalyx-decision`, `/webhook/symbalyx-comments`, `/webhook/symbalyx-team-members`.
   - Dans le CRM : Réglages → renseigner URL de base (sans suffixe) + secret. Bouton "Tester la connexion" disponible. Identité courante choisie au login.
6. **Activer `99_error_handler`** comme **Error Workflow** dans les settings de chaque workflow critique (Settings → Error Workflow).
7. **Cron** : laisser actif uniquement WF9 (lundi 8h) qui chaîne WF7+WF8. Désactiver crons WF7/WF8 pour éviter doubles exécutions.

## Placeholders à remplacer
| Placeholder | Où | Exemple |
|---|---|---|
| `{{LLM_API_URL}}` | URL HTTP Request | `https://api.openai.com/v1/chat/completions` |
| `{{LLM_API_KEY}}` | Credential Header Auth | `sk-...` |
| `{{GOOGLE_SHEET_ID}}` | tous nodes Sheets | `1AbCdEf...` |
| `REPLACE_WITH_WF5_ID` | WF4 → Execute WF5 | ID généré par n8n |
| `REPLACE_WITH_WF7_ID` | WF9 → Execute WF7 | ID généré par n8n |
| `REPLACE_WITH_WF8_ID` | WF9 → Execute WF8 | ID généré par n8n |

## Credentials nécessaires
| Credential | Type n8n | Où |
|---|---|---|
| Google Sheets | googleSheetsOAuth2Api | tous WF (lecture/écriture) |
| Gmail | gmailOAuth2 | WF2, WF9, WF10, WF12, WF14 (Create Draft) + WF4 (Trigger) |
| LLM | httpHeaderAuth | tous WF avec HTTP Request → LLM |

## Dépendances inter-workflows
```
WF1 → review_queue → WF2 (draft) → Gmail (humain envoie)
WF4 (Gmail Trigger) → review_queue → WF5 (brief) → project_queue
WF10 (onboarding) ← project_queue (manuel ou trigger)
WF11 (delivery watch, cron 12h) → business_control
WF12 (reporting, cron vendredi 16h) → client_reports + Gmail draft
WF7 (cron 6h ou via WF9) → business_control
WF8 (via WF9) → business_control + kpi_snapshots
WF9 (cron lundi 8h) → exec WF7 → exec WF8 → digest Gmail interne
WF13 ← appelé en sub-workflow (KB)
WF14 (cron 9h) → business_control + Gmail draft (relance)
WF00 ← appelé par tous les WF critiques (kill switch)
WF99 ← Error Workflow global de tous les WF critiques
```

## Garde-fous (non négociables)
- Aucun envoi automatique d'email vers prospect. Gmail = `Create Draft only` partout.
- `requires_human_validation = true` sur 100% des recos.
- `KILL_SWITCH=true` dans `config` doit pouvoir tout arrêter en 1 clic.
- Aucune décision financière, RH ou juridique automatisée.
- `opt_out=true` → action `abandon` forcée, jamais de relance.
- Réponse `interested`/`needs_quote` ne peut JAMAIS atterrir dans `leads_to_drop`.

## Roadmap restante (priorités passation V7)
- **P2 Vraie source de données** : configurer Sheets API (lecture seule) ou Supabase (RLS) dans le CRM. Lancer WF1 sur 5–10 vrais prospects.
- **P4 Research agent renforcé (WF03)** : ajouter Brave Search ou SerpAPI dans le node Fetch website (~10–30 €/mois).
- **P5 Auto-critique (A7+)** : remplacer le body du node `A7 — LLM Prioritization` (WF7) par `prompts/07b_prioritization_with_critique.md`.
- **P6 Site builder (WF20)** : à créer — brancher en sortie de WF5 pour qu'à chaque réponse `interested`, un blueprint soit généré et stocké dans `site_blueprints`.

## Roadmap V5 (legacy)
**V5.0 — Productivité**
- Brancher décisions du dashboard sur webhook n8n (vraie écriture dans `business_control`).
- WF15 : `decision_executor` qui exécute concrètement les `approved` (créer draft, snooze, abandon).

**V5.1 — Données**
- Migration Sheets → Supabase (script d'import + bascule progressive).
- Ajout `embedding` sur `kb_articles` + workflow d'indexation (text-embedding-3-small).
- pgvector pour retrieval sémantique (remplace WF13 lexical).

**V5.2 — Interfaces**
- Layer commande WhatsApp (WF20 webhook bot, commandes : `/top`, `/approve <id>`, `/digest`).
- RBAC simple via table `users` (owner/operator/viewer) + check sur dashboard.
- Audit trail immuable (table `audit_log` append-only).

**V5.3 — Productisation**
- Multi-tenant : `org_id` partout, configs par org.
- Onboarding agence en 1 click (script de seed Sheets/Supabase).
- Documentation marketing : pricing page, démo client, vidéo Loom.

## Choix d'architecture
- **Sheets** comme source de vérité jusqu'à ~5000 lignes par table.
- **Schéma SQL fourni** pour migration directe quand le volume justifiera (script SQL prêt).
- **Aucun custom node n8n** : tout en standard, portable.
- **Provider LLM** : 1 variable d'env, modèle par défaut `gpt-4o-mini`, premium `gpt-4o` pour A5/A8.
- **Erreurs** : LLM en `neverError + retryOnFail`, pipelines en `splitInBatches` pour résilience.
- **Coût** : `MAX_BATCH=30` côté WF7 (1 seul appel LLM par run), prompts batchés.

---

## Connexion Google (Drive + Sheets) — guide pas-à-pas

> **Important** : ne jamais coller de `client_id`, `client_secret`, ou refresh token dans la conversation, dans Git, ou dans les workflows JSON. Tout passe par les credentials n8n (chiffrés).

### 1. Côté Google Cloud Console (une fois)
1. Crée un projet GCP dédié (ex: `symbalyx-prod`). [console.cloud.google.com](https://console.cloud.google.com)
2. Active les APIs : **Google Sheets API** et **Google Drive API** (APIs & Services → Library).
3. **OAuth consent screen** : External, scope minimum (`auth/spreadsheets`, `auth/drive.file`), ajoute ton email comme test user (mode test suffit pour 5 personnes).
4. **Credentials → Create Credentials → OAuth client ID** : type *Web application*. Dans "Authorized redirect URIs", ajoute l'URL fournie par n8n (visible dans la modale de création de credential côté n8n, format `https://<ton-n8n>/rest/oauth2-credential/callback`).
5. Note le `Client ID` + `Client secret` — tu les colles **uniquement** dans n8n, jamais ailleurs.

### 2. Côté n8n
1. **Credentials → New → Google Sheets OAuth2 API** : colle Client ID + Secret. Clique *Sign in with Google*. Autorise. Le credential est sauvegardé chiffré.
2. **Credentials → New → Google Drive OAuth2 API** : même procédure (peut réutiliser le même OAuth client).
3. Dans chaque workflow (WF1, WF7, WF18, WF19, WF21, etc.) : ouvrir chaque node "Google Sheets" → sélectionner le credential créé. Idem pour les nodes Drive si tu en ajoutes.
4. **Variable d'env** `SYMBALYX_WEBHOOK_SECRET` : Settings → Variables (n8n cloud) ou via `.env` (self-host). 32 chars aléatoires minimum. Recopier la même valeur dans le CRM (Réglages → Webhook).

### 3. Structure Google Drive recommandée
À créer manuellement dans ton Drive partagé d'agence :
```
📁 Symbalyx/
├── 📁 1_Data/                 ← Sheets (DB partagée)
│   ├── business_control       (Sheet)
│   ├── review_queue           (Sheet)
│   ├── project_queue          (Sheet)
│   ├── memory_*               (Sheets)
│   ├── team_members           (Sheet)  ← V8
│   ├── team_comments          (Sheet)  ← V7
│   └── notifications_inbox    (Sheet)
├── 📁 2_Exports/              ← CSV exportés depuis le CRM
├── 📁 3_Backups/              ← Snapshots manuels (ou WF Drive backup futur)
├── 📁 4_Assets_Clients/       ← logos, photos, briefs reçus
└── 📁 5_KB/                   ← knowledge base (briefs internes, templates)
```
Partage le dossier `Symbalyx/` à tous les membres avec droits **Éditeur**. Le compte Google qui a authentifié n8n doit y avoir accès en écriture.

### 4. Bascule vers Supabase (plus tard)
Quand le volume dépasse ~3000 lignes par table : appliquer `n8n/schemas/supabase_schema.sql`, ouvrir chaque WF, remplacer le node Google Sheets par un node Postgres / Supabase pointant sur la même structure. Le format des données reste identique (champs alignés), donc les Code nodes ne bougent pas.

---

## Ajouter une personne dans la boîte

### Côté boîte (admin / fondateur)
1. **Login** dans le CRM avec ton mot de passe.
2. Onglet **Équipe** (visible seulement si ton rôle est `founder` ou `admin`).
3. Remplis le formulaire : Nom, Email (optionnel), Rôle (founder/admin/sales/dev/viewer/member), Initiales (auto si vide), Couleur.
4. Clique **Ajouter**. Le webhook WF21 crée la ligne dans `team_members`.
5. Si la nouvelle personne est dev/n8n : ajoute-la aussi dans **n8n → Settings → Users** comme *Member* (voir section ci-dessous).
6. Donne-lui :
   - le mot de passe local du CRM (changeable au premier login),
   - l'URL du CRM (page web statique),
   - éventuellement un email Symbalyx + accès Drive.

### Côté nouvelle personne (non-tech)
1. Ouvre l'URL du CRM dans son navigateur.
2. Saisit le mot de passe partagé.
3. Sur l'écran "Qui es-tu ?", clique sur son nom dans la liste. C'est tout — son identité est mémorisée pour ce navigateur.
4. Toutes les décisions / commentaires qu'elle fait sont signés à son nom et stockés dans `business_control`, `memory_decisions`, `team_comments`.

### Désactiver quelqu'un (départ)
- Onglet Équipe → bouton **Désactiver** sur sa ligne. Son historique reste, mais elle disparaît des sélecteurs (login + assignation).

---

## n8n User Management (Owner / Member)

n8n self-host (>= 0.220) et n8n Cloud supportent le multi-user. Recommandation pour Symbalyx :

| Rôle n8n     | Qui                                       | Droits                                                                    |
|--------------|-------------------------------------------|---------------------------------------------------------------------------|
| **Owner**    | Fondateur (1 seul)                        | Tout : credentials, settings, billing, suppression de WF.                 |
| **Admin**    | Lead tech (Kentin)                        | Workflows, credentials, mais pas billing.                                 |
| **Member**   | Sales / dev junior                        | Voir et exécuter des workflows, ne peut PAS lire/modifier les credentials.|

### Organisation des dossiers de workflows (n8n Folders / Projects)
Crée 4 dossiers (ou Projects en n8n Cloud) :
- `00_infra/` : WF00 Kill Switch, WF99 Error Handler.
- `10_prospection/` : WF1, WF2, WF4, WF5, WF6.
- `20_ops/` : WF7, WF8, WF9, WF10, WF11, WF12, WF13, WF14, WF17.
- `30_team/` : WF18, WF19, WF21 (les webhooks team).

### Sécurité credentials
- **Ne partage jamais** les credentials Google Sheets / Gmail / LLM avec un Member. Owner+Admin only.
- Active **2FA** sur le compte Google qui a authentifié n8n.
- Si tu fais tourner n8n en self-host derrière un reverse proxy : whiteliste les IPs admin sur `/settings/`.
- Les webhooks (`/webhook/symbalyx-*`) sont publics par design → l'auth header `x-symbalyx-token` les protège. Si le secret fuite : régénère-le côté n8n (variable d'env) et côté CRM (Réglages).

### Évolutions futures (non livrées dans cette V8)
- RBAC fonctionnel dans le CRM (gating des sections par rôle, pas seulement l'affichage).
- Migration `assigned_to` (texte) → `assignee_id` (référence team_members) dans tous les WF amont (WF1, WF7, WF8…).
- Backup hebdo Drive (WF22) : zip des Sheets → upload Drive `3_Backups/`.
- Multi-tenant (`org_id`) si on vend Symbalyx à d'autres agences.
