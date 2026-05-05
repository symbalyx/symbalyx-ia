# Symbalyx IA — Pack complet V14.2

Pack interne pour Arsène et Kentin.

## Contenu

- `index.html` : interface Symbalyx IA complète à mettre en ligne.
- `docs/GUIDE_DEBUTANT.md` : procédure débutant étape par étape.
- `docs/REGLES_SECURITE.md` : règles absolues à respecter.
- `docs/ARCHITECTURE.md` : comment l'IA doit parler à Make / Sheets / Gmail.
- `make/SCHEMA_WEBHOOK_REQUEST.json` : exemple de payload envoyé vers Make.
- `make/SCHEMA_WEBHOOK_RESPONSE.json` : réponse attendue depuis Make.
- `make/PROMPT_GMAIL_DRAFT.md` : prompt type pour préparer un brouillon Gmail.
- `make/MAKE_SCENARIO.md` : scénario Make à construire.
- `sheets/CRM_HEADERS.csv` : colonnes à copier dans Google Sheets.
- `tests/TEST_PLAN.md` : tests à faire avant d'utiliser sur de vrais prospects.
- `robots.txt` : bloque l'indexation Google, car c'est un outil interne.
- `_headers` : headers de sécurité basiques pour Cloudflare Pages.

## Déploiement rapide

1. Crée un repo GitHub privé `symbalyx-ia`.
2. Upload tous les fichiers de ce dossier, pas le ZIP.
3. Vérifie que `index.html` est à la racine du repo.
4. Connecte le repo à Cloudflare Pages.
5. Réglages Cloudflare : framework `None`, build command vide, output `/`.

## Important

Ce pack ne contient aucune vraie clé API et aucun mot de passe. C'est volontaire.
Ne mets jamais de clé Gemini, Gmail, Google Places ou Make directement dans `index.html`.
