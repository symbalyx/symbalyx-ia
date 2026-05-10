---
name: symbalyx-prospect-finder-leadgenius
description: Find new prospects in a target niche + city via LeadGenius (last.leadgenius.app). Returns enriched leads with email, phone, website, decision-maker name. Feeds the prospection pipeline (WF1) with high-quality, GDPR-friendly leads. Use when prospects_in is dry or when launching a new niche campaign.
compatibility: Requires LeadGenius API key + a configured niche template
metadata:
  author: symbalyx
  version: "1.0"
  consumes: niche + geo input from user
  produces: prospects_in rows ready for WF1 prioritization
allowed-tools: leadgenius-search, sheets-append, anthropic-chat-enrich
---

# Prospect Finder — LeadGenius

Remplace la phase manuelle de scraping. LeadGenius livre des leads B2B enrichis avec email vérifié, téléphone, nom du décideur, signaux d'achat.

## When to Use

- Démarrage d'une nouvelle niche (ex: "lance la niche coiffeurs Lyon")
- Pipeline `prospects_in` < 20 leads frais
- Décideur Symbalyx valide un volume cible (ex: "trouve-moi 50 plombiers à Bordeaux")
- Besoin de signaux : "trouve les artisans qui ont un site WordPress de 2018"

## Inputs

```json
{
  "niche": "plombier",
  "city": "Bordeaux",
  "radius_km": 20,
  "limit": 50,
  "filters": {
    "has_website": true,
    "website_age_min_years": 4,    // signal "site vieux"
    "employees_max": 10,           // TPE/artisans
    "revenue_max_eur": 500000,
    "tech_stack_includes": ["wordpress", "joomla"]  // hot leads
  },
  "must_have_email": true,
  "must_have_phone": true
}
```

## Workflow

### 1. Validation

- `limit` <= 100 par run (cost control)
- `niche` doit matcher une de vos niches actives (`memory_niches` table)
- Quota mensuel : 500 leads max (LeadGenius pricing tier)

### 2. API call

```bash
POST https://api.leadgenius.app/v1/search
Authorization: Bearer {{LEADGENIUS_API_KEY}}
Content-Type: application/json

{
  "query": {
    "industry": "{{niche}}",
    "location": "{{city}}",
    "radius_km": {{radius_km}},
    "limit": {{limit}}
  },
  "filters": { ... },
  "enrich": ["email", "phone", "website", "owner_name", "tech_stack", "rev_estimate"]
}
```

### 3. Output normalization

LeadGenius retourne :
```json
{
  "leads": [
    {
      "company_name": "Plomberie Dupont",
      "owner_name": "Marc Dupont",
      "email": "marc@plomberie-dupont.fr",
      "email_confidence": 0.92,
      "phone": "+33556789012",
      "phone_validated": true,
      "website": "https://plomberie-dupont.fr",
      "tech_stack": ["wordpress", "elementor"],
      "city": "Bordeaux",
      "rev_estimate_eur": 180000,
      "employees": 3,
      "buying_signals": ["website_outdated", "no_ssl"]
    }
  ]
}
```

Map vers le schéma `prospects_in` (Symbalyx) :

```js
{
  id: 'p_' + hash(company_name + email),
  ts: now(),
  company_name, niche, city, email, phone, website_url: website,
  contact_name: owner_name,
  source: 'leadgenius',
  signals: tech_stack.join(',') + ',' + buying_signals.join(','),
  rev_estimate_eur, employees,
  email_confidence, phone_validated,
  status: 'pending_research'  // → entrera dans WF1 prochain cron
}
```

### 4. Dedup avant insert

Avant `sheets.append`, vérifie qu'aucun prospect existant n'a le même `email` OU le même `company_name + city` (matche `symbFindDuplicates` côté CRM).

### 5. Enrichissement Claude (optionnel)

Pour chaque lead à fort score :

```
Lis le snippet du site web {{website}} et extrait :
- 1 angle d'attaque commercial spécifique (max 15 mots)
- 1 fait observable qui pourrait servir d'icebreaker (max 20 mots)
- niveau de friction ressenti (low|med|high) en première impression

JSON only.
```

→ Stocké dans `memory_commercial` (table déjà prête) avec `subject_id=prospect_id`, `type=fact`, `confidence`.

### 6. Notification

WF40 agent_relay :
- `level=progress`, `from_workflow=WF52`, `title=N leads frais ajoutés à prospects_in`
- `body=N leads enrichis dans la niche {{niche}}/{{city}}, top score : X`
- `escalated_to_human=true` SI quota mensuel atteint (>= 480 sur 500)

## Coût LeadGenius

Tier "Starter" : ~99 USD/mois pour 500 leads enrichis.

ROI :
- 500 leads × 5% reply rate = 25 réponses
- 25 × 30% interested = 7-8 leads chauds
- 7-8 × 30% conversion = 2-3 sites livrés à 2 500€ = **5-7 500€ CA pour 99$ de coût**

10x à 50x ROI selon ton taux de conversion.

## Workflow n8n (WF52_prospect_finder)

À créer plus tard. Squelette :

1. Webhook `/symbalyx-find-prospects` reçoit `{ niche, city, limit }`
2. Auth + quota check
3. HTTP Request → LeadGenius
4. Code node : normalisation + dedup
5. Sheets append → `prospects_in`
6. (Optionnel) Loop sur les leads à score >= 7 → enrichissement Claude
7. WF40 notify
8. Réponse webhook avec `{ count, top_5_preview }`

## Garde-fous

1. **GDPR / B2B uniquement** : LeadGenius source des données B2B publiques (annuaires pro, registre du commerce). Tu peux contacter en cold B2B sans opt-in préalable, mais inclus toujours un opt-out clair dans tes emails.
2. **Quota mensuel** : alerte à 80% (`level=blocked` dans agent_messages) pour éviter de découvrir le 1er du mois que tu as épuisé ton quota.
3. **Email confidence < 0.7** → marque `status=needs_verification` au lieu de `pending_research`. Email validation séparée (ex: NeverBounce).
4. **Bloctel** : si tu utilises le `phone` pour cold call, vérifie Bloctel avant. Sinon, garde-le juste pour le rappel post-réponse.
5. **No fake personalization** : si `owner_name` n'est pas dispo (confidence basse), n'écris jamais "Bonjour {{first_name}}", écris "Bonjour" générique. Le LLM doit refuser de fabriquer un prénom.

## Alternative

- **Apollo.io** : plus connu, plus cher, plus orienté SaaS US. Moins bon pour artisans français.
- **PhantomBuster + Sales Navigator** : si tu veux du LinkedIn. Plus technique, demande LinkedIn Sales Nav account.
- **Pages Jaunes scraping** : gratuit mais bricolé, qualité variable, risque légal selon pratique.

LeadGenius reste le meilleur trade-off coût/qualité/légalité pour artisans/TPE FR.

## Setup (~15 min)

1. Compte sur **last.leadgenius.app** → choix tier Starter ou Pro.
2. API key depuis le dashboard.
3. Variable n8n : `LEADGENIUS_API_KEY`.
4. Import WF52 (à créer en session dédiée) ou test manuel via curl :
   ```bash
   curl -X POST https://api.leadgenius.app/v1/search \
     -H "Authorization: Bearer XXX" \
     -d '{ "query": { "industry": "plombier", "location": "Bordeaux", "limit": 5 } }'
   ```
