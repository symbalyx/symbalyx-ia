# Symbalyx — NOTES.md (V7)

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
  - **WF18 Decision Executor** : webhook `POST /webhook/symbalyx-decision`. Reçoit `{bcl_id, decision, decided_by, reason?}`, met à jour `business_control`, écrit dans `memory_decisions` (avec `ai_initial_priority` capturée), route l'action approuvée (`follow_up_24h` → flag review_queue pour WF2 ; `quote` → log pour WF5 ; `reminder_*` → log pour WF14 ; rejected/snoozed/abandoned → noop).
  - **WF19 Team Sync** : 2 webhooks (`POST /webhook/symbalyx-comments`, `GET /webhook/symbalyx-comments?item_type=…&item_id=…`). Permet à Arsène et Kentin de partager des commentaires sur n'importe quel item BCL/prospect/projet/facture, persistés dans la sheet `team_comments`.
  - **Auth** : header `x-symbalyx-token`, secret `SYMBALYX_WEBHOOK_SECRET` (env n8n) à recopier dans le CRM (Réglages).
  - **CRM** : Réglages exposent identité courante (Arsène/Kentin/Équipe) + URL webhook + secret. `symbDecide` POST le webhook avec optimistic UI et fallback localStorage si KO. Modale détail affiche un fil de commentaires partagés (cache local pour réactivité).
  - **Schémas** : `memory_decisions` gagne la colonne `ai_initial_priority`. Nouveau onglet `team_comments` (`id, ts, item_type, item_id, author, body, resolved, parent_id`).
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
4. **Onglets Google Sheets** à créer — headers dans `n8n/schemas/`. **Nouveaux V7** : `team_comments`, `memory_decisions` (colonne `ai_initial_priority` ajoutée).
5. **Webhooks V7** :
   - Variable d'env n8n : `SYMBALYX_WEBHOOK_SECRET` (≥ 32 chars aléatoires).
   - Activer WF18 + WF19 → noter les URLs `/webhook/symbalyx-decision` et `/webhook/symbalyx-comments`.
   - Dans le CRM : Réglages → renseigner URL de base (sans suffixe) + secret + identité courante. Bouton "Tester la connexion" disponible.
5. **Activer `99_error_handler`** comme **Error Workflow** dans les settings de chaque workflow critique (Settings → Error Workflow).
6. **Cron** : laisser actif uniquement WF9 (lundi 8h) qui chaîne WF7+WF8. Désactiver crons WF7/WF8 pour éviter doubles exécutions.

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
