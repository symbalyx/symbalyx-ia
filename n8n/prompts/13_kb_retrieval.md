# A13 Knowledge Base Retrieval

**Note** : MVP **sans LLM**, pour ne pas brûler de tokens sur du retrieval.
Implémentation en JS dans le node `Retrieve (lexical)` du WF13.

## Algorithme
- Tokenisation simple (FR/EN, accents conservés).
- Filtrage stopwords FR.
- Score = +1 par token en commun + 0.3 par match partiel + 0.5 si match dans `tags`.
- Top K (default 5).

## Évolution future (V5)
Migrer vers embeddings :
1. Ajouter colonne `embedding` (`vector(1536)`) sur `kb_articles` (Postgres + pgvector).
2. Workflow batch d'indexation qui appelle `text-embedding-3-small`.
3. Remplacer le score lexical par cosine similarity côté SQL ou côté Code node.
