# Symbalyx Control Room — dashboard privé

Page unique, lecture seule, **aucun envoi externe**.

## Install (2 lignes)
1. Ouvre `index.html` dans ton navigateur (double-clic ou `python3 -m http.server` puis http://localhost:8000).
2. Choisis ton mot de passe au premier accès (stocké hashé dans `localStorage`, jamais envoyé).

## Sources de données (CONFIG.source dans le HTML)
- `mock` (défaut) : données factices pour tester l'UI.
- `sheets` : Google Sheets API (clé en lecture seule). Renseigne `apiKey` + `sheetId`.
- `supabase` : PostgREST. Renseigne `url` + `anonKey` (avec RLS read-only).

## Décisions
Le dashboard est **lecture seule**. Les boutons approve/reject sont mémorisés en `localStorage` et exportables. Pour propager dans `business_control`, brancher plus tard un webhook n8n qui reçoit la décision (workflow à créer en V5).

## Sécurité
- Pas de credentials serveur dans la page : utilise une clé API Sheets restreinte au `sheetId` ou un anon key Supabase avec RLS strict.
- Mot de passe = simple gate UI locale, pas une vraie auth. Pour usage en équipe, mets le dashboard derrière Cloudflare Access ou Vercel Password.
