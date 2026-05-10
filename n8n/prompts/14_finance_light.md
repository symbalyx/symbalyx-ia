# A14 Finance Light

**Pas de LLM**. Volontaire : aucune décision financière, aucune génération
de montant ou d'engagement. Templates de relance en JS dans WF14.

## Niveaux de relance
| Délai depuis échéance | Niveau       | Ton                      |
|-----------------------|--------------|--------------------------|
| ≥ 7 jours             | reminder_1   | amical                   |
| ≥ 14 jours            | reminder_2   | neutre                   |
| ≥ 30 jours            | reminder_3   | ferme                    |

Toutes les relances passent par **business_control** + Gmail Create Draft.
Aucun envoi automatique.

## Garde-fous
- Aucun montant inventé : tiré exclusivement de `invoices.amount_eur`.
- Si `ALLOW_FINANCE_REMINDERS=false` dans `config`, le workflow doit être
  désactivé (ou la branche initiale ignorée — à câbler côté kill-switch).
- `decision_status='pending'` jusqu'à validation humaine.
