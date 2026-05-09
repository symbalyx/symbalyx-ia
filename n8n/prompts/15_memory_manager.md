# A15 Memory Manager (sub-workflow, sans LLM)

Sub-workflow utilitaire utilisé par les autres agents pour lire/écrire la
mémoire. Pas de LLM (déterministe) — anti-coût.

## Modes
- `READ_BY_SUBJECT` : retourne les faits pour un `subject_id` (prospect/projet).
- `READ_BY_NICHE` : retourne patterns et outcomes filtrés par niche.
- `READ_RECENT_DECISIONS` : derniers approved/rejected (utile pour calibrer A7).
- `WRITE_FACT` : ajoute une ligne dans `memory_commercial`.
- `WRITE_DECISION` : ajoute une ligne dans `memory_decisions` (typiquement appelé
  quand `decision_status` passe de pending à approved/rejected dans BCL).

## Inputs
```
{ "mode": "...", "subject_id": "...", "subject_type": "prospect|project",
  "niche": "...", "limit": 20, "fact": "...", "confidence": 0.0-1.0,
  "source": "..." }
```

## Outputs
```
{ "results": [...], "count": N, "mode": "..." }
```

## Garde-fous
- Aucun fait ne peut être écrit sans `source` non vide.
- Confidence < 0.3 → fait stocké mais marqué `low_conf=true` dans `note`.
- TTL : si `expires_at` passé → fait ignoré en lecture (déterministe).
