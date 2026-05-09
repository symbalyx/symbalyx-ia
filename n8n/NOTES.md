# Symbalyx — NOTES.md (V4)

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
4. **Onglets Google Sheets** à créer (12 au total) — headers dans `n8n/schemas/`.
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

## Roadmap V5
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
