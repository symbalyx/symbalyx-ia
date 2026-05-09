# Tests Symbalyx V8

Deux suites de tests, exécutables sans n8n ni Google Sheets réelle.

```bash
# 1. Logique des Code nodes des workflows WF18 / WF19 / WF21
node tests/wf_logic.test.js

# 2. CRM headless via JSDOM (login 2 étapes, identité, décisions, commentaires, équipe)
#    Pré-requis : npm i jsdom (dans /tmp ou ailleurs).
node tests/crm.headless.test.js
```

## Couverture

**WF logic (20 tests)**
- Auth (token absent, invalide, secret manquant)
- Validation payload (decision invalide, decided_by manquant, item_type hors liste, body trop long, role invalide, email invalide, id manquant)
- Capture `ai_initial_priority` depuis BCL avant update
- Construction `memory_decisions` row complète
- POST/GET commentaires (filter par item, author_id présent)
- POST/PATCH/GET team_members (initiales auto, désactivation, filtre actifs)

**CRM headless (14 tests)**
- Login 2 étapes : pwd → choix membre → app
- Identité riche `{id, name, role, initials, color}` propagée + chip header
- Onglet Équipe visible pour `founder` / `admin`
- Décision Approve par Arsène → POST avec `decider_id=tm_arsene`
- Round trip BCL → memory_decisions (ai_initial_priority capturée)
- Commentaire signé `author_id`
- Ajouter / désactiver un membre via UI
- Logout + login en tant qu'autre membre → payloads changent
- Filtre "À moi" matche par identité courante
- Aucun envoi auto (review_queue juste flagué)
- Membre désactivé absent du sélecteur de login
- Auth header obligatoire

## Limites

Ces tests **ne touchent pas** Google Sheets / Supabase / n8n réels. Ils valident :
- la logique JS des Code nodes (extraite et exécutée),
- les payloads que le CRM envoie aux 3 webhooks,
- la cohérence colonnes ↔ payloads.

Ils ne valident pas :
- le comportement exact du node `Google Sheets → Update` (cf. bug WF21 PATCH partiel décrit dans `TEST_REPORT.md`),
- la propagation Sheets → Supabase,
- les credentials OAuth Google,
- le service worker (PWA),
- les notifications navigateur.
