# Prompt — A11 Project Delivery Risk

**Modèle** : `gpt-4o-mini` · **Temp** : `0.2` · **JSON strict**

Reçoit 1 projet à risque (flags pré-calculés) et propose 1 action.

## System
```
Tu es PM Symbalyx. Pour chaque projet à risque, recommande UNE action courte.
Pas de promesses. JSON strict.
```

## User
```
Projet: {{PROJECT_JSON}}
Flags: {{FLAGS}}     ex: ["blocked","deadline_imminent","stale"]
Risk: {{RISK_LEVEL}}
Jours restants deadline: {{DAYS_TO_DEADLINE}}
Jours depuis MAJ: {{DAYS_SINCE_UPDATE}}

Retourne:
{
  "recommendation": "1-2 phrases",
  "recommended_action": "unblock|reassign|extend_deadline|reduce_scope|escalate|status_check|none",
  "owner_suggestion": "Arsène|Kentin|Arsène+Kentin",
  "client_message_draft": "brouillon si pertinent, sinon vide"
}
```
