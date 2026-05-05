# Guide débutant — faire marcher Symbalyx IA

## Objectif de la première vraie version

Ne cherche pas à tout automatiser d'un coup.
La première version qui marche doit faire seulement ceci :

1. Ouvrir Symbalyx IA en ligne.
2. Choisir un prospect.
3. Cliquer sur Préparer / Mini-audit.
4. Envoyer un payload à Make.
5. Make vérifie les règles de sécurité.
6. Make ajoute une ligne dans Google Sheets CRM.
7. Make crée un brouillon Gmail.
8. Arsène ou Kentin relit et valide manuellement.

## Étape 1 — Mettre en ligne

- Créer repo GitHub privé `symbalyx-ia`.
- Upload tous les fichiers du pack.
- `index.html` doit être à la racine.
- Déployer avec Cloudflare Pages.

## Étape 2 — Créer le Google Sheet CRM

Créer un Google Sheet nommé `Symbalyx CRM`.
Créer un onglet `CRM`.
Copier les colonnes du fichier `sheets/CRM_HEADERS.csv`.

## Étape 3 — Créer le webhook Make

Dans Make :

`Webhooks -> Custom webhook -> symbalyx_prepare_draft_v1`

Copier l'URL du webhook.

## Étape 4 — Construire le scénario Make

Ordre :

`Webhook -> sécurité -> Google Sheets -> Gmail Create Draft -> Webhook response`

Important : Gmail doit créer un brouillon uniquement.
Ne jamais utiliser Send Email.

## Étape 5 — Tester avec un faux prospect

Utiliser :

- Nom : Salon Test Bordeaux
- Secteur : coiffeur
- Ville : Bordeaux
- Source : https://example.com
- Opt-out : false

Résultat attendu :

- une ligne CRM créée
- un brouillon Gmail créé
- aucun email envoyé

## Ce que tu ne dois pas faire maintenant

- Ne branche pas Google Places tout de suite.
- Ne branche pas Gemini tout de suite.
- Ne mets pas de clé API dans index.html.
- Ne fais pas d'envoi automatique.
- Ne contacte pas de vrais prospects avant d'avoir testé.
