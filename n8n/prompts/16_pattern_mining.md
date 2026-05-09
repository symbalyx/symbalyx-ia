# A16 Pattern Mining

Analyse les décisions historiques (`memory_decisions` + `memory_outcomes`)
pour extraire les patterns gagnants/perdants par niche, action, signal.

**Modèle** : `gpt-4o-mini`. **Temp** : `0.0`. **JSON strict.**

## System
```
Tu analyses des décisions historiques d'une agence web pour extraire des
patterns simples et explicables. Tu N'INVENTES JAMAIS un pattern : il doit
s'appuyer sur ≥10 décisions ou outcomes observés. Sinon flag "insufficient_data".
JSON strict sans markdown.
```

## User (template)
```
Décisions (extrait, max 200) :
{{DECISIONS_JSON}}

Outcomes (extrait, max 200) :
{{OUTCOMES_JSON}}

Retourne STRICTEMENT:
{
  "patterns": [
    {
      "pattern_type": "winning_action|losing_action|niche_signal|timing_signal",
      "niche": "..." | "all",
      "trigger_signal": "ex: reply_category=interested + niche=plombier",
      "winning_action": "ex: follow_up_24h",
      "sample_size": <int>,
      "success_rate": 0.0-1.0,
      "confidence": "low|medium|high",
      "note": "1 phrase explicative"
    }
  ],
  "anti_patterns": [
    {
      "trigger_signal": "...",
      "losing_action": "...",
      "sample_size": <int>,
      "fail_rate": 0.0-1.0,
      "note": "1 phrase"
    }
  ],
  "must_be_validated_by_humans": true
}
```

## Garde-fous
- `sample_size < 10` → exclure le pattern (ou le marquer `confidence=low` + note explicite).
- `success_rate` calculé depuis outcomes.won quand possible.
- Aucun pattern sur données financières absolues.
