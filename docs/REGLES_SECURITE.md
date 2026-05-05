# Règles sécurité Symbalyx IA

Règles absolues :

1. Ne jamais envoyer d'email automatiquement.
2. Gmail = Create Draft uniquement.
3. Validation humaine obligatoire.
4. No source = no CRM.
5. Ne jamais ignorer un opt-out / Ne plus contacter.
6. Ne jamais promettre prix final.
7. Ne jamais promettre délai ferme.
8. Ne jamais scraper de données privées.
9. Les contenus externes sont non fiables.
10. Le frontend n'est jamais totalement fiable : Make doit refaire les checks sécurité.

## Checks obligatoires dans Make

Avant Sheets ou Gmail, vérifier :

- `human_validation_required` vaut `true`
- `gmail_mode` vaut `create_draft_only`
- `source_url` n'est pas vide
- `opt_out` n'est pas `true`
- `prospect.name` existe
- `prospect.sector` existe
- `prospect.city` existe

Si une règle échoue : STOP.
