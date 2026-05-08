# Symbalyx — Système multi-agents n8n (V2)

Architecture pragmatique d'un pipeline de prospection B2B pour TPE/PME locales,
opéré par une équipe de 2 personnes (Arsène / Kentin), avec validation humaine
obligatoire avant tout envoi.

> **Règle d'or héritée du système Make** : Gmail = **Create Draft only**.
> Le système ne doit JAMAIS envoyer un email automatiquement. La file
> `review_queue` est la frontière entre l'IA et l'humain.

## Workflows livrés (V2)

| Fichier | Trigger | Rôle |
|---|---|---|
| `workflows/01_mvp_prospecting.json` | Manual | Ingestion + 3 agents (analyse/score/email) → review_queue |
| `workflows/02_create_draft_after_review.json` | Schedule 15min + Manual | Lit review_queue (approved) → Gmail Create Draft → update statut |
| `workflows/04_reply_classifier.json` | Gmail Trigger | Classe les réponses entrantes en 6 catégories → update review_queue → exec WF5 si interested/needs_quote |
| `workflows/05_project_brief.json` | Execute Workflow + Manual | Génère brief projet structuré → append project_queue |
| `workflows/06_internal_ops.json` | Manual | Lit project_queue + team_state → table de répartition Arsène/Kentin |

## Sheets requis

| Onglet | Écrit par |
|---|---|
| `prospects_in` | toi (à la main) |
| `review_queue` | WF1 (append), WF2 (update), WF4 (update) |
| `project_queue` ✨ | WF5 (append), WF6 (read) |
| `team_state` ✨ | toi (à la main) |
| `weekly_recommendations` ✨ | WF6 (append) |
| `logs` | tous |

> ✨ = nouveaux en V2. Headers exacts dans `schemas/*.csv`.

## Colonnes à ajouter à `review_queue` pour V2

En plus des 23 colonnes V1, ajoute pour le tracking des réponses :

`reply_category, reply_text, reply_received_at, reply_opt_out, follow_up_date`

---

## 1. Vue d'ensemble du système

```txt
            ┌──────────────────────────────────────────────────┐
            │                   SOURCES PROSPECTS              │
            │   Google Sheets `prospects_in`  |  CSV  |  API   │
            └──────────────────────────┬───────────────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │  WF1 — Ingestion    │
                            │  (validate+normalize)│
                            └──────────┬──────────┘
                                       │ status=pending
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
        ┌────────────────┐   ┌──────────────────┐   ┌────────────────┐
        │ Agent Analyse  │   │ Agent Score      │   │ Agent Rédaction│
        │ (LLM)          │──▶│ Projet (LLM)     │──▶│ Email (LLM)    │
        └────────────────┘   └──────────────────┘   └────────┬───────┘
              status=analyzed     status=scored       status=drafted
                                                              │
                                                ┌─────────────▼────────────┐
                                                │ WF2 — Review Queue       │
                                                │ Google Sheets review_queue│
                                                └─────────────┬────────────┘
                                                  status=queued_for_review
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
                          ┌────────────────────────┐                  ┌──────────────────────────┐
                          │ Validation humaine     │                  │ WF3 — Logs / Erreurs      │
                          │ (Sheets / Slack / UI)  │                  │ Google Sheets `logs`      │
                          └───────────┬────────────┘                  └──────────────────────────┘
                                      │ approuvé
                                      ▼
                          ┌────────────────────────┐
                          │ Gmail Create Draft     │
                          │ (jamais d'envoi auto)  │
                          └────────────────────────┘

                     ─── puis, après réponse du prospect ───

                          ┌────────────────────────┐
                          │ WF4 — Classification   │   (interested / ask_later / …)
                          │ Réponse (LLM)          │
                          └───────────┬────────────┘
                                      │ interested
                                      ▼
                          ┌────────────────────────┐
                          │ WF5 — Brief Projet     │
                          │ (LLM)                  │
                          └───────────┬────────────┘
                                      │ brief créé
                                      ▼
                          ┌────────────────────────┐
                          │ WF6 — Opérations       │  (recommande Arsène/Kentin,
                          │ Internes (LLM)         │   charge, priorités)
                          └────────────────────────┘
```

Le système est conçu en **6 sous-workflows** indépendants reliés par :

- **Google Sheets** comme source de vérité (pas de DB pour le MVP),
- **un statut explicite** par prospect (machine à états simple),
- **un appel HTTP générique** vers le LLM (provider-agnostic),
- **une file `review_queue`** comme point de validation humaine.

---

## 2. Différence MVP vs Version avancée

| Dimension              | MVP                              | Version avancée                                 |
|------------------------|----------------------------------|-------------------------------------------------|
| Workflows              | 1 workflow monolithique          | 6 sous-workflows orchestrés                     |
| Source prospects       | Google Sheets uniquement         | + CSV upload, + API enrichissement              |
| Détection site web     | Heuristique sur `website_url`    | Fetch HTTP + analyse HTML + Lighthouse-like     |
| Score opportunité      | 1 prompt LLM                     | LLM + features déterministes + règles métier    |
| Email                  | 1 brouillon                      | 3 variantes A/B + ton adapté à la niche         |
| Validation             | Manuelle dans Sheets             | + UI dédiée (Symbalyx index.html), + Slack      |
| Réponses entrantes     | Pas géré                         | WF4 classification IMAP/Gmail webhook           |
| Brief projet           | Pas géré                         | WF5 sur réponses `interested`                   |
| Ops internes           | Pas géré                         | WF6 répartition Arsène/Kentin                   |
| Erreurs                | Log dans Sheets `logs`           | + Error Trigger global + retry exponentiel      |
| Provider LLM           | 1 (variable d'env)               | Routing multi-provider (cheap/qualité)          |
| Throttling             | `splitInBatches` 1 à 1           | Queue Redis + rate limit par domaine            |

> **Choix du MVP** : on garde **un seul workflow `01_mvp_prospecting`** pour
> rester simple à comprendre/débugger, mais le code est déjà structuré en
> "phases" qui sont les futurs sous-workflows.

---

## 3. Liste précise des workflows / agents

### MVP (1 workflow, 3 agents)

| Code      | Nom                                | Rôle                                    | Statut sortie         |
|-----------|------------------------------------|-----------------------------------------|-----------------------|
| `WF1`     | `01_mvp_prospecting`               | Pipeline complet bout-en-bout           | `queued_for_review`   |
| `A1`      | Agent Analyse Prospect             | Résumé, statut site, opportunité        | `analyzed`            |
| `A2`      | Agent Score Projet                 | Difficulté technique, label, raison     | `scored`              |
| `A3`      | Agent Rédaction Email              | Sujet + corps brouillon                 | `drafted`             |

### Version avancée (6 workflows, 6 agents)

| Code      | Nom                                | Déclencheur                             |
|-----------|------------------------------------|-----------------------------------------|
| `WF1`     | `10_ingestion`                     | Manuel / Cron / Webhook                 |
| `WF2`     | `20_qualification`                 | WF1 sortie + nouvelle ligne `prospects` |
| `WF3`     | `30_copywriting`                   | Statut = `scored`                       |
| `WF4`     | `40_reply_classifier`              | Webhook Gmail / IMAP poll               |
| `WF5`     | `50_project_brief`                 | Réponse classée `interested`            |
| `WF6`     | `60_internal_ops`                  | Manuel hebdomadaire / commande Slack    |
| `A1`      | Agent Recherche/Enrichissement     | sub de WF1                              |
| `A2`      | Agent Qualification                | sub de WF2                              |
| `A3`      | Agent Copywriting                  | sub de WF3                              |
| `A4`      | Agent Classification Réponses      | sub de WF4                              |
| `A5`      | Agent Brief Projet                 | sub de WF5                              |
| `A6`      | Agent Opérations Internes          | sub de WF6                              |

---

## 4. Liste des nœuds n8n recommandés

Tous nœuds **standards** (pas de custom node nécessaire pour le MVP).

| Nœud                              | Usage                                             |
|-----------------------------------|---------------------------------------------------|
| `Manual Trigger`                  | Démarrer le pipeline                              |
| `Schedule Trigger`                | (avancé) cron pour ingestion régulière            |
| `Webhook`                         | (avancé) entrée externe / réponses Gmail          |
| `Google Sheets`                   | Lecture `prospects_in`, append `review_queue`/`logs` |
| `Read/Write Files from Disk`      | Variante CSV (sans Google)                        |
| `Code` (JavaScript)               | Validation, normalisation, parsing JSON LLM       |
| `Set`                             | Construction de payloads LLM, status & timestamps |
| `If`                              | Branchements conditionnels (status, opt-out)      |
| `Switch`                          | Routage par niche / par statut                    |
| `Split In Batches`                | Boucle prospect-par-prospect (rate limit)         |
| `HTTP Request`                    | Appels LLM (provider-agnostic)                    |
| `Merge`                           | Recombiner résultats des 3 agents                 |
| `Wait`                            | Pause entre appels (anti rate-limit)              |
| `Error Trigger`                   | (avancé) workflow d'erreurs global                |
| `Execute Workflow`                | (avancé) chaîner les sous-workflows               |
| `Gmail`                           | (validé manuellement) `Create Draft` uniquement   |
| `LangChain Agent` (`@n8n/n8n-nodes-langchain`) | (avancé optionnel) si tu veux des agents avec tools/memory |

---

## 5. Structure de données

### 5.1 Entrée — `prospects_in` (Google Sheet)

| Colonne         | Type    | Obligatoire | Exemple                              |
|-----------------|---------|-------------|--------------------------------------|
| `id`            | string  | non*        | `p_0001` (généré si vide)            |
| `company_name`  | string  | **oui**     | `Salon Élégance`                     |
| `contact_name`  | string  | non         | `Marie Dupont`                       |
| `email`         | string  | **oui**     | `contact@salon-elegance.fr`          |
| `website_url`   | string  | non         | `https://salon-elegance.fr`          |
| `city`          | string  | **oui**     | `Bordeaux`                           |
| `niche`         | string  | **oui**     | `coiffeur`                           |
| `notes`         | string  | non         | `Vu sur Google Maps, 4.6 étoiles`    |
| `source_url`    | string  | non         | `https://maps.google.com/...`        |
| `opt_out`       | bool    | non         | `false`                              |

### 5.2 Objet prospect normalisé (interne au workflow)

```json
{
  "id": "p_0001",
  "company_name": "Salon Élégance",
  "contact_name": "Marie Dupont",
  "email": "contact@salon-elegance.fr",
  "website_url": "https://salon-elegance.fr",
  "city": "Bordeaux",
  "niche": "coiffeur",
  "notes": "Vu sur Google Maps, 4.6 étoiles",
  "source_url": "https://maps.google.com/...",
  "opt_out": false,
  "status": "pending",
  "created_at": "2026-05-08T10:12:00Z",
  "updated_at": "2026-05-08T10:12:00Z",
  "errors": []
}
```

### 5.3 Sortie — `review_queue` (Google Sheet)

| Colonne                       | Source                       |
|-------------------------------|------------------------------|
| `id`                          | prospect.id                  |
| `created_at`                  | timestamp                    |
| `updated_at`                  | timestamp                    |
| `status`                      | `queued_for_review`          |
| `company_name`                | prospect                     |
| `contact_name`                | prospect                     |
| `email`                       | prospect                     |
| `website_url`                 | prospect                     |
| `city`                        | prospect                     |
| `niche`                       | prospect                     |
| `business_summary`            | A1                           |
| `website_status`              | A1                           |
| `opportunity_score`           | A1                           |
| `opportunity_reason`          | A1                           |
| `suggested_angle`             | A1                           |
| `project_difficulty_score`    | A2                           |
| `project_difficulty_label`    | A2                           |
| `project_difficulty_reason`   | A2                           |
| `draft_email_subject`         | A3                           |
| `draft_email_body`            | A3                           |
| `assigned_to`                 | règle simple (Arsène/Kentin) |
| `human_decision`              | (vide → rempli par humain)   |
| `human_notes`                 | (vide → rempli par humain)   |

### 5.4 Sortie — `logs` (Google Sheet)

| Colonne       | Exemple                                            |
|---------------|----------------------------------------------------|
| `ts`          | `2026-05-08T10:12:43Z`                             |
| `prospect_id` | `p_0001`                                           |
| `phase`       | `analyze` / `score` / `draft` / `review` / `done`  |
| `status`      | `analyzed` / `scored` / `drafted` / `error`       |
| `level`       | `info` / `warn` / `error`                          |
| `message`     | texte court                                        |
| `meta`        | JSON détail (request_id LLM, tokens, etc.)         |

### 5.5 Machine à états

```
pending → analyzed → scored → drafted → queued_for_review → approved → drafted_in_gmail
                                                          → rejected
   │
   └─(error à n'importe quelle étape)→ error
```

---

## 6. Prompts LLM exacts

Voir `n8n/prompts/`. Tous les prompts respectent les conventions :

- **Sortie strictement JSON** (pas de markdown, pas de texte autour) → permet
  un `JSON.parse` fiable dans le node `Code`.
- **Température 0.2** par défaut (sauf rédaction email : 0.7).
- **Système court + utilisateur structuré** (les données prospect en JSON).
- **Pas de promesses** (prix, délais, garanties Google) — règle Symbalyx.

| Fichier                                   | Agent                              |
|-------------------------------------------|------------------------------------|
| `prompts/01_analyze_prospect.md`          | A1 — Analyse prospect              |
| `prompts/02_score_project.md`             | A2 — Score projet                  |
| `prompts/03_draft_email.md`               | A3 — Rédaction email               |
| `prompts/04_classify_reply.md`            | A4 — Classification réponse        |
| `prompts/05_build_brief.md`               | A5 — Brief projet                  |
| `prompts/06_internal_ops.md`              | A6 — Opérations internes           |

---

## 7. Schéma logique du pipeline (MVP)

```
[Manual Trigger]
      │
      ▼
[Lire Prospects (Google Sheets)]
      │
      ▼
[Valider & Normaliser (Code)]                   ← rejette les lignes invalides
      │                                            écrit `error` dans logs
      ▼
[Boucle Prospect (Split In Batches: 1)]
      │ ─────────────────────────────────── (done)──▶ [Fin]
      ▼
[Log: started → logs sheet]
      │
      ▼
[A1: HTTP LLM Analyze Prospect]
      │  (onError → [Log: error] → continue)
      ▼
[Parse Analyze (Code)]
      │
      ▼
[A2: HTTP LLM Score Project]
      │  (onError → [Log: error] → continue)
      ▼
[Parse Score (Code)]
      │
      ▼
[A3: HTTP LLM Draft Email]
      │  (onError → [Log: error] → continue)
      ▼
[Parse Email (Code)]
      │
      ▼
[Build Review Row (Code)]                       ← assemble toutes les colonnes
      │                                            attribue assigned_to
      ▼
[Append → review_queue (Google Sheets)]
      │
      ▼
[Log: done → logs sheet]
      │
      └──▶ [Boucle Prospect] (next item)
```

Aucune étape n'envoie d'email. La sortie finale est **toujours** une ligne dans
`review_queue` à statut `queued_for_review`.

---

## 8. Workflow MVP n8n (JSON importable)

Voir `n8n/workflows/01_mvp_prospecting.json`.

### Comment importer

1. Ouvre n8n → **Workflows** → **Import from File** → sélectionne le JSON.
2. Crée 1 credential **Google Sheets OAuth2** et 1 credential **HTTP Header
   Auth** (header `Authorization` = `Bearer {{LLM_API_KEY}}`).
3. Sur chaque nœud Google Sheets, sélectionne la credential et remplace le
   `documentId` par ton vrai ID de Sheet (placeholder `{{GOOGLE_SHEET_ID}}`).
4. Sur chaque nœud HTTP Request LLM, sélectionne ta credential et remplace
   l'`url` par `{{LLM_API_URL}}` (ex. `https://api.openai.com/v1/chat/completions`).
5. Vérifie les variables d'env (voir `ENV.example`).
6. Clique **Execute Workflow** avec un Sheet de 1-2 lignes pour tester.

### Compatibilité providers LLM

Le body est **OpenAI-compatible** (`messages[]`, `response_format: json_object`).
Fonctionne tel quel avec :

- **OpenAI** (GPT-4o, GPT-4o-mini)
- **Mistral**, **Groq**, **Together**, **OpenRouter**
- **Anthropic** via gateway (LiteLLM, OpenRouter) ou en remplaçant le node
  `HTTP Request` par un node `Anthropic Chat Model` natif si tu utilises
  `@n8n/n8n-nodes-langchain`.

> **À adapter manuellement après import** : credentials, IDs de Sheets, modèle
> LLM (`gpt-4o-mini` par défaut), sender Gmail (non utilisé dans MVP mais prévu
> pour la version avancée).

---

## 9. Placeholders à remplacer

Tous regroupés dans `n8n/ENV.example`.

| Placeholder              | Où                                    | Exemple                                          |
|--------------------------|---------------------------------------|--------------------------------------------------|
| `{{LLM_API_URL}}`        | nœuds HTTP Request URL                | `https://api.openai.com/v1/chat/completions`     |
| `{{LLM_API_KEY}}`        | credential Header Auth                | `sk-...`                                         |
| `{{LLM_MODEL}}`          | body des HTTP Requests                | `gpt-4o-mini`                                    |
| `{{GOOGLE_SHEET_ID}}`    | nœuds Google Sheets                   | `1AbCdEf...`                                     |
| `{{REVIEW_QUEUE_SHEET}}` | nom d'onglet                          | `review_queue`                                   |
| `{{LOGS_SHEET}}`         | nom d'onglet                          | `logs`                                           |
| `{{PROSPECTS_SHEET}}`    | nom d'onglet                          | `prospects_in`                                   |
| `{{ARSENE_NAME}}`        | règle d'attribution dans `Code`       | `Arsène`                                         |
| `{{KENTIN_NAME}}`        | règle d'attribution dans `Code`       | `Kentin`                                         |

---

## 10. Limites, risques et points à surveiller

### Sécurité / délivrabilité
- **Aucun envoi automatique**. Gmail = `Create Draft only` (règle absolue
  héritée de `docs/REGLES_SECURITE.md`).
- Vérifier `opt_out` à 2 endroits (ingestion + avant la mise en file review).
- Pas de scraping de données privées. `source_url` doit être une page publique.
- Mettre un volume max par jour (`maxItems` dans Split In Batches) pour éviter
  un envoi de masse de brouillons qui dégraderait la délivrabilité Gmail si
  envoyés tous le même jour.
- SPF/DKIM/DMARC + warm-up Gmail à faire séparément.

### IA
- Les LLM peuvent halluciner sur les sites obsolètes : ne pas faire confiance
  au `website_status` sans vérification humaine pour les enjeux > 1k€.
- Toujours forcer `response_format: json_object` côté LLM (sinon parsing KO).
- **Garde-fou de coût** : limiter `max_tokens` à 600 pour analyse/score, 800
  pour email.

### Robustesse n8n
- Sur chaque HTTP LLM, mettre `Continue On Fail` + retry max 2 (back-off).
- Les credentials Google Sheets expirent : prévoir un check mensuel.
- Workflow ne doit pas dépasser ~50 lignes par exécution sans le mode "queue"
  de n8n (sinon timeout). Utiliser `Split In Batches` + reprise.
- Une exécution qui plante laisse le prospect au statut intermédiaire :
  prévoir un workflow "reprise" qui relit `review_queue` et `logs`.

### Données
- Pas de DB → tout est dans Sheets. OK jusqu'à ~5000 lignes. Au-delà, migrer
  vers Postgres / Supabase.
- Bien dédupliquer `email` (clé unique) à l'ingestion.

---

## 11. Prochaines étapes après import

1. **Créer le Google Sheet** "Symbalyx CRM" avec 3 onglets : `prospects_in`,
   `review_queue`, `logs` (voir `schemas/*.csv` pour les en-têtes).
2. **Configurer credentials n8n** : Google Sheets OAuth2, HTTP Header Auth pour
   le LLM.
3. **Mettre 2-3 lignes de test** dans `prospects_in` (un avec website, un sans,
   un avec opt_out=true).
4. **Run le workflow manuellement** et vérifier dans `review_queue` que les 3
   sorties (analyse / score / email) sont cohérentes.
5. **Ajuster les prompts** dans `prompts/` selon le ton qui te plaît
   réellement (l'email surtout).
6. **Brancher le node Gmail Create Draft** dans une V1.1 (workflow
   `02_create_draft_after_review`) — déclenché quand `human_decision = approved`.
7. **Implémenter WF4 (réponse classifier)** dès que des réponses arrivent.
8. **WF5 brief projet** : à faire en priorité après WF4 — c'est ça qui te fait
   gagner du temps en delivery.
9. **WF6 ops internes** : seulement quand tu as 10+ projets en parallèle,
   sinon overkill.
