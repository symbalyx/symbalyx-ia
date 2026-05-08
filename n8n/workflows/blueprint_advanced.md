# Blueprint — Version avancée (6 sous-workflows)

> Ce document décrit la **cible évolutive**. Il n'est pas livré sous forme de
> JSON importable car il dépend de choix d'infra que tu n'as pas encore faits
> (DB Postgres ou Sheets ? Slack ou UI custom ? OpenAI ou multi-provider ?).
>
> Une fois le MVP stable et utilisé, on transforme ce blueprint en 6 fichiers
> JSON séparés.

---

## Convention de nommage des workflows

| Fichier                            | Workflow                       | Trigger                                      |
|------------------------------------|--------------------------------|----------------------------------------------|
| `10_ingestion.json`                | Ingestion + enrichissement     | Manual / Schedule (cron 6h) / Webhook upload |
| `20_qualification.json`            | Qualification + score          | `Execute Workflow` depuis `10`               |
| `30_copywriting.json`              | Rédaction multi-variantes      | `Execute Workflow` depuis `20`               |
| `40_reply_classifier.json`         | Classification réponses        | Webhook Gmail push / IMAP poll               |
| `50_project_brief.json`            | Brief projet                   | `Execute Workflow` depuis `40` si interested |
| `60_internal_ops.json`             | Ops internes (Arsène/Kentin)   | Manual hebdomadaire / commande Slack         |

Tous écrivent dans la même base (Sheets ou Postgres). Tous loggent dans
`logs`.

---

## WF1 — `10_ingestion.json`

**Objectif** : transformer une source (Sheet, CSV, API) en lignes propres et
enrichies, prêtes à être qualifiées.

```
[Manual Trigger | Schedule Trigger | Webhook]
   │
   ▼
[Switch source] ──▶ Google Sheets read
                 ──▶ CSV file read (Read/Write Files from Disk)
                 ──▶ HTTP Request (API tierce ex. SerpAPI Maps)
   │
   ▼
[Code: Validate & Normalize]
   │
   ▼
[Split In Batches (1)]
   │
   ▼
[Agent A1.0 — Enrichissement]    ← sub-agent
   │
   ▼
[Code: Build prospect record]
   │
   ▼
[Append → DB / Sheets `prospects`]
   │
   ▼
[Execute Workflow → 20_qualification]
```

### Agent A1.0 — Enrichissement (détail)

Pour chaque prospect :

1. **Si `website_url` présent** :
   - `HTTP Request` GET sur l'URL avec `timeout: 8s`, `followRedirects: true`.
   - Capture : status code, taille HTML, présence de `<meta viewport>`,
     présence de `https`, présence de keywords `wordpress|wix|squarespace|...`,
     date copyright dans le footer.
2. **Si pas de `website_url`** :
   - LLM avec recherche web (si tu as un provider qui le supporte type
     OpenAI tools) ou Google Places API pour confirmer absence.
3. Sortie : `digital_maturity_signals` (objet riche).

### Champs ajoutés vs MVP

```
website_present        : bool
website_https          : bool
website_responsive     : bool       (heuristique sur viewport meta)
website_likely_cms     : "wordpress|wix|...|unknown"
website_last_visible_year : int|null
google_business_present  : bool
sector_keywords        : [string]   (extraits du HTML / notes)
```

---

## WF2 — `20_qualification.json`

**Objectif** : scorer commercialement le prospect, filtrer les cas peu
pertinents avant de payer un appel LLM de copywriting.

```
[Trigger: Execute Workflow]
   │
   ▼
[Code: rules pré-LLM]
   │  ├── opt_out=true        → status=rejected, log, fin
   │  ├── email invalide      → status=rejected, log, fin
   │  ├── niche inconnue      → status=rejected, log, fin
   │  └── pass                ↓
   ▼
[LLM: Score opportunité]      ← prompts/01_analyze_prospect.md
   │
   ▼
[LLM: Score difficulté]       ← prompts/02_score_project.md
   │
   ▼
[Code: Combine score final]
   │   final_score = 0.6*opportunity + 0.4*(11-difficulty)
   │
   ▼
[If: final_score >= seuil ?]
   │   yes → status=qualified  → Execute Workflow → 30_copywriting
   │   no  → status=disqualified → log, fin
```

---

## WF3 — `30_copywriting.json`

**Objectif** : générer **plusieurs** variantes d'email pour permettre A/B
test ou choix humain.

```
[Trigger: Execute Workflow]
   │
   ▼
[Switch sur niche] (coiffeur / plombier / coach / ...)
   │
   ▼
[LLM: Variant A — ton "humain de quartier"]
[LLM: Variant B — ton "pro et concis"]
[LLM: Variant C — ton "résultat concret"]
   │
   ▼
[Merge]
   │
   ▼
[Append → review_queue avec 3 colonnes draft_A / draft_B / draft_C]
```

> **Coût** : 3 appels LLM par prospect. Ne génère ces variantes que si
> `final_score >= 7` pour limiter le coût.

---

## WF4 — `40_reply_classifier.json`

**Objectif** : classer automatiquement les réponses entrantes.

### Trigger : Gmail push notification (recommandé) OU IMAP Poll

```
[Webhook Gmail OR Email Trigger (IMAP)]
   │
   ▼
[Code: extract from / subject / plain_text_body / message_id]
   │
   ▼
[Google Sheets: lookup by email]   ← est-ce un prospect connu ?
   │
   ▼
[If: connu ?]
   │   no  → log "réponse hors campagne", fin
   │   yes ↓
   ▼
[LLM: Classify reply]              ← prompts/04_classify_reply.md
   │
   ▼
[Switch sur category]
   │   interested    → Execute Workflow → 50_project_brief
   │   not_interested + opt_out=true → marquer opt_out dans DB
   │   ask_later     → set follow_up_date = +90 jours
   │   needs_quote   → assign Arsène + notification Slack
   │   wrong_contact → flag pour Kentin recherche
   │   unclear       → flag pour relecture humaine
```

---

## WF5 — `50_project_brief.json`

**Objectif** : transformer une réponse positive en brief actionnable.

```
[Trigger: Execute Workflow]
   │
   ▼
[Code: Charger contexte complet du prospect]
   │   (analyse, score, draft envoyé, réponse reçue)
   │
   ▼
[LLM: Build brief]                 ← prompts/05_build_brief.md
   │
   ▼
[Code: Validation du JSON brief (champs obligatoires présents)]
   │
   ▼
[Append → Sheet `briefs` avec tout le contenu structuré]
   │
   ▼
[Notification Slack à l'owner suggéré]
   │
   ▼
[Pré-créer un dossier Drive du projet] (optionnel)
```

---

## WF6 — `60_internal_ops.json`

**Objectif** : recommander la répartition de tâches dans l'équipe (jamais
décider seul).

```
[Manual Trigger OR Slack /symbalyx-week]
   │
   ▼
[Google Sheets read: tasks, briefs, review_queue]
   │
   ▼
[Code: build TEAM_STATE_JSON]
   │
   ▼
[LLM: Recommandations]             ← prompts/06_internal_ops.md
   │
   ▼
[Code: Format human-friendly]
   │
   ▼
[Slack post → canal #symbalyx-pilotage]
   │
   ▼
[En option : append → Sheet `weekly_recommendations` pour historique]
```

### Garde-fous

- Aucun envoi automatique de tâche, aucun reassign sans clic humain.
- Pas de décisions sur frais réels ; uniquement des **suggestions de ratio**.
- Le LLM ne voit jamais d'info financière sensible (montants exacts).

---

## Choix d'infrastructure pour la version avancée

| Sujet              | MVP                | Avancé recommandé                            |
|--------------------|--------------------|----------------------------------------------|
| Stockage           | Google Sheets      | Postgres (Supabase) avec schéma stable       |
| Queue              | Split In Batches   | Redis / BullMQ ou n8n Queue mode             |
| Erreurs            | Append `logs`      | Error Trigger global + alerte Slack          |
| Provider LLM       | 1 (env var)        | Routeur par tâche (mini pour score, full pour brief) |
| Email entrant      | n/a                | Gmail Push Pub/Sub ou IMAP poll              |
| UI revue           | Sheet              | Page dédiée dans `index.html` Symbalyx       |
| Secrets            | `.env`             | Vault / 1Password Connect / Doppler          |
| Auth               | n/a                | Restreindre n8n derrière Cloudflare Access   |

---

## Ordre de construction conseillé

1. ✅ **MVP** (livré dans `01_mvp_prospecting.json`).
2. WF4 reply classifier — sans ça, le pipeline est aveugle aux réponses.
3. WF5 brief projet — fait gagner du temps en delivery dès la 1ère vente.
4. WF1+WF2 séparés (extraire de MVP) — quand le volume justifie.
5. WF3 copywriting multi-variantes — quand tu sens un plafond de réponse.
6. WF6 ops internes — seulement avec ≥10 projets en parallèle.
