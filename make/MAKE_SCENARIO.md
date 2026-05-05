# Scénario Make — première version stable

## Module 1 — Webhook

App : Webhooks
Action : Custom webhook
Nom : `symbalyx_prepare_draft_v1`

## Module 2 — Filtres sécurité

Bloquer si :

- `human_validation_required` n'est pas `true`
- `gmail_mode` n'est pas `create_draft_only`
- `no_auto_send` n'est pas `true`
- `prospect.source_url` est vide
- `prospect.opt_out` vaut `true`
- `prospect.name` est vide
- `prospect.sector` est vide
- `prospect.city` est vide

## Module 3 — Google Sheets

Action : Add a Row ou Update a Row.
Sheet : `Symbalyx CRM`
Onglet : `CRM`

Champs à mapper :

- date
- prospect_name
- sector
- city
- email
- phone
- website
- source_url
- need
- score
- money_score
- status = brouillon créé
- assigned_to
- last_action = draft_created
- opt_out
- notes

## Module 4 — Gmail

Action : Create a draft email.
Ne jamais utiliser Send email.

## Module 5 — Réponse webhook

Répondre :

```json
{
  "ok": true,
  "crm_updated": true,
  "draft_created": true,
  "email_sent": false,
  "next_action": "Relire le brouillon Gmail avant envoi manuel."
}
```
