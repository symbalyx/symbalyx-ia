# Symbalyx — Système multi-agents n8n (V4)

Système d'exploitation d'agence IA modulaire, opéré par 2 personnes
(Arsène + Kentin). Vente de sites web IA aux TPE/PME locales.

> **Règle absolue** : Gmail = `Create Draft only`. Aucun envoi automatique.
> `requires_human_validation = true` sur 100% des recommandations.

## Workflows livrés (V4 — 13 workflows)

| Code | Trigger | Rôle |
|---|---|---|
| `01_mvp_prospecting` | Manuel | Ingestion + analyse + score + brouillon → review_queue |
| `02_create_draft_after_review` | Schedule 15min + Manuel | review_queue (approved) → Gmail Create Draft |
| `04_reply_classifier` | Gmail Trigger | Classe réponses → 6 catégories → exec WF5 |
| `05_project_brief` | Sub-workflow + Manuel | Brief structuré → project_queue |
| `06_internal_ops` | Manuel | Table de répartition Arsène/Kentin |
| `07_prioritization_engine` | Schedule 6h + Manuel | Score déterministe + LLM batch → business_control |
| `08_business_advisor` | Schedule lundi 7h + Manuel | Vue stratégique + KPI snapshot |
| `09_weekly_summary` | Schedule lundi 8h + Manuel | Chaîne WF7→WF8 + digest Gmail interne |
| `10_client_onboarding` ✨ | Sub-workflow + Manuel | Welcome draft + intake checklist |
| `11_project_delivery` ✨ | Schedule 12h + Manuel | Détection blocages/deadlines → BCL |
| `12_client_reporting` ✨ | Schedule vendredi 16h + Manuel | Rapport hebdo client (draft) |
| `13_knowledge_base` ✨ | Sub-workflow + Manuel | Retrieval lexical (sans coût LLM) |
| `14_finance_light` ✨ | Schedule 9h + Manuel | Relances factures (3 niveaux, sans LLM) |
| `00_kill_switch` ✨ | Sub-workflow | Lit `config`, throw si KILL_SWITCH=true |
| `99_error_handler` ✨ | Error Trigger global | Centralise erreurs → logs |

## Sheets / tables (12)
`prospects_in`, `review_queue`, `project_queue`, `team_state`, `weekly_recommendations`, `business_control`, `kpi_snapshots`, `logs`, `client_onboarding`, `client_reports`, `kb_articles`, `invoices`, `users`, `config`.

Headers dans `n8n/schemas/*.csv`. Schéma SQL Postgres : `n8n/schemas/supabase_schema.sql`.

## Dashboard privé
`n8n/dashboard/index.html` — vanilla JS + Chart.js.

- Top 10 priorités du jour
- KPIs (courbes hebdo)
- Charge équipe (bar chart)
- Digest hebdo
- Filtres personne/priorité, dark mode, export CSV, notifications browser
- Lecture seule (mock / Sheets API / Supabase)
- Mot de passe local (hash localStorage)

## Install rapide
1. Créer le Google Sheet "Symbalyx CRM" + 14 onglets (headers dans `schemas/`).
2. Importer les 13 JSON dans n8n.
3. Configurer credentials : Google Sheets, Gmail, HTTP Header Auth (LLM).
4. Variables d'env : voir `ENV.example`.
5. Régler les 3 placeholders de sub-workflow IDs (voir `NOTES.md`).
6. Définir `99_error_handler` comme Error Workflow sur les WF critiques.
7. Test : run manuel WF1 sur 2-3 prospects.

## Documentation
- `NOTES.md` — état complet, dépendances, roadmap V5.
- `prompts/*.md` — 14 prompts LLM avec garde-fous.
- `schemas/*.csv` + `supabase_schema.sql` — schéma data.
- `dashboard/README.md` — install dashboard.

## Architecture
```
Sources ──▶ Prospection (1) ──▶ Validation humaine ──▶ Drafts (2)
              │                          │
              ▼                          ▼
         Briefs (5) ◄── Réponses (4) ◄── Gmail (humain)
              │
              ▼
       project_queue ──┬──▶ Onboarding (10)
                       ├──▶ Delivery watch (11) ──┐
                       └──▶ Reporting (12)        │
                                                  ▼
            Prioritization (7) + Advisor (8) ──▶ business_control ◄── Finance light (14)
                       │                                ▲
                       ▼                                │
              Weekly summary (9) ──▶ Dashboard / Gmail digest interne
                       
            KB (13) appelable par n'importe quel agent
            Kill switch (00) + Error handler (99) en transverse
```
