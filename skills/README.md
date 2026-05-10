# Symbalyx — Skills directory

Catalogue des Skills (capacités IA spécialisées) que les agents Symbalyx peuvent invoquer. Format compatible avec [Claude Skills](https://officialskills.sh/).

## Architecture

Un **Skill** = un fichier markdown avec frontmatter qui décrit :
- Ce que fait le skill (`description`)
- Quand l'invoquer (`When to Use`)
- Inputs / outputs structurés
- Le prompt pour Claude
- Garde-fous (GDPR, coûts, fallbacks)
- Coût estimé

Un **Workflow n8n** (WFxx) = l'implémentation runtime qui appelle un Skill avec un context précis.

## Skills livrés (V8.7)

| Skill | Fichier | Workflow lié | Coût/run |
|---|---|---|---|
| Site Builder | `site-builder.md` | WF50 | ~0,10 € |
| Email Draft | `email-draft.md` | WF2 (extension) | ~0,01 € |
| Lead Qualifier (voix) | `lead-qualifier-bland.md` | WF51 (à créer) | ~0,40 € |
| Prospect Finder | `prospect-finder-leadgenius.md` | WF52 (à créer) | ~0,20 € / lead |

## Comment utiliser un Skill dans n8n

1. **Lis** le skill markdown — c'est ta spec.
2. **Crée** un workflow n8n qui implémente la chaîne : webhook → validation → appel LLM/API externe → write Sheets → notify WF40.
3. **Charge le system prompt** du skill dans le node "Anthropic Chat" (champ `system`).
4. **Utilise prompt caching** pour les system prompts longs : économie de 90 % sur les exécutions répétées.
5. **Logue** chaque exécution dans `agent_messages` via WF40 pour traçabilité.

## Comment utiliser un Skill avec Claude Code (CLI)

```bash
# Charge le skill dans la session
cat skills/site-builder.md

# Demande à Claude d'agir selon le skill
"Utilise le skill site-builder pour générer le site de Salon Élégance, niche coiffure, Lyon, tone élégant or sur noir"
```

Claude Code lit le skill, applique les contraintes, génère le HTML.

## Skills à créer plus tard (P2)

| Skill | Pourquoi | Estimation |
|---|---|---|
| `morning-digest` | Résumé matinal IA top 5 sur tablette/SMS | 1h |
| `client-report` | Rapport mensuel auto pour client (PDF) | 2h |
| `niche-research` | Étude de niche en 3 minutes (concurrence, prix marché, angles) | 2h |
| `objection-handler` | Reformule objections client en pivots (sales playbook) | 1h |
| `invoice-chase` | Relance factures avec ton qui escalate (lvl 1 → 3) | 1h |
| `social-poster` | Poste résumé semaine sur LinkedIn/Twitter | 1h |

## Conventions

- **Tous les Skills doivent être idempotents** : un même input produit le même output (sauf temperature LLM).
- **Tous les Skills doivent loguer** dans `agent_messages` (via WF40 relay).
- **Aucun Skill n'envoie d'email/SMS automatiquement** — toujours brouillon ou validation humaine.
- **Aucun Skill ne supprime de données** — soft-delete uniquement.
- **Toute génération coûteuse** (>0,10 €) doit être traçable et budgetable mensuellement (table `ai_costs` à créer).

## Sécurité Skills

- API keys → variables n8n chiffrées, jamais en clair dans les workflows JSON.
- Ne jamais coller `client_secret`, `BLAND_API_KEY`, `LEADGENIUS_API_KEY`, `ANTHROPIC_API_KEY` dans une conversation Claude.
- Chaque appel API externe doit avoir un timeout (30-90s) et un retry max 1.
- Rate limiting global : ne jamais dépasser 30 appels Claude par minute (limite API par défaut).

## Inspirations

- [officialskills.sh](https://officialskills.sh/) — catalogue Claude Skills officiels
- [Bland.ai](https://bland.ai/) — voice AI agents
- [LeadGenius](https://last.leadgenius.app/) — prospect enrichment

## Roadmap

- **V8.7 (livrée)** : 4 skills + WF50 site builder
- **V8.8** : WF51 (qualifier-bland) + WF52 (prospect-finder)
- **V9.0** : Skills marketplace dans le CRM (browse, install, run from UI)
