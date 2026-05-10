# Symbalyx — Bot WhatsApp (WF30)

Pilote Symbalyx depuis WhatsApp : approuver une décision, ajouter une dépense, demander le solde, sans ouvrir le CRM. Squelette livré, à brancher quand tu veux.

---

## Pourquoi

- Décider en mobilité, sans ouvrir l'app.
- Logger une dépense en 5 secondes ("/expense 25 vercel pro").
- Demander le solde / runway au bot ("/balance").
- Commenter une carte client en marchant ("/comment p_0042 rappel : voir photos").

---

## Architecture

```
Téléphone (toi) ──WhatsApp──> Provider (Twilio | Meta Cloud API) ──webhook──> n8n WF30
                                                                      │
                                                                      ├─ parse Twilio OU Meta payload
                                                                      ├─ auth via team_members.whatsapp_number
                                                                      ├─ parse intent (/decide /expense /balance ...)
                                                                      ├─ log dans whatsapp_log
                                                                      └─ répond text/plain (Twilio TwiML) ou JSON (Meta)
```

WF30 est livré en **mode squelette** : il authentifie, parse les intents, log, et **répond avec une instruction** indiquant comment activer la commande (HTTP request vers les autres workflows). Le pas suivant = brancher chaque intent à son vrai workflow.

---

## Choix du provider

| Provider | Coût démarrage | Avantages | Inconvénients |
|---|---|---|---|
| **Twilio Sandbox WhatsApp** | gratuit, 0€ | 5 min de setup, pas de validation Meta, idéal POC | Numéro partagé (sandbox), users doivent rejoindre avec un code |
| **Twilio Production** | ~5€/mois + 0,005€/msg | Numéro dédié, pas de friction utilisateur | Validation Meta business (3-7 jours) |
| **Meta WhatsApp Cloud API** | gratuit jusqu'à 1000 conv/mois | Numéro pro WhatsApp Business, gratuit petit volume | Setup plus technique, validation Meta business |

**Recommandation** : commence par **Twilio Sandbox** pour valider le flow avec toi + Kentin, puis passe à Meta Cloud API quand tu veux ouvrir à des clients (notifications, support).

WF30 supporte les deux formats (Twilio form ou Meta JSON) — le node "Normalize payload" auto-détecte.

---

## Setup Twilio Sandbox (10 minutes)

1. Crée un compte sur **twilio.com/try-twilio**.
2. Console Twilio → **Messaging → Try it out → Send a WhatsApp message**.
3. Tu vois un numéro Twilio (ex: `+1 415 523 8886`) et un code à envoyer (ex: `join open-fish`) depuis ton WhatsApp pour rejoindre la sandbox.
4. Dans la même page → **Sandbox Configuration**.
5. Champ **"When a message comes in"** :
   - Method : **POST**
   - URL : `https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook/symbalyx-whatsapp`
6. Save.
7. Ajoute ton numéro WhatsApp à `team_members.whatsapp_number` au format E.164 sans espaces (ex: `+33612345678`).
8. Importe et active WF30 dans n8n.
9. Depuis ton WhatsApp, envoie `/help` au numéro Twilio → tu dois recevoir la liste des commandes.

---

## Setup Meta WhatsApp Cloud API (30-60 min, en prod)

1. **business.facebook.com** → crée un Business Manager (si pas déjà).
2. **developers.facebook.com** → New App → type **Business** → ajoute le produit **WhatsApp**.
3. WhatsApp → **API Setup** : tu reçois un numéro de test gratuit + un access token temporaire (24h).
4. **Configuration → Webhooks** :
   - Callback URL : `https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook/symbalyx-whatsapp`
   - Verify token : choisis une chaîne (ex: `symbalyx_meta_verify_xyz`) et place-la dans n8n Variables si tu veux activer le challenge GET (pas inclus dans WF30 v1, à ajouter).
   - Subscribe à : **messages**.
5. Pour passer en prod : ajoute un numéro WhatsApp Business dédié, fais valider ton business Meta (KYC), génère un token long terme.

---

## Intents implémentés (squelette)

| Intent | Format | Statut |
|---|---|---|
| `/help` | `/help` | ✅ répond la liste |
| `/balance` | `/balance` | 🔧 stub — branche un HTTP node vers `GET /symbalyx-finance` |
| `/pending` | `/pending` | 🔧 stub — read `business_control` filtré |
| `/wishlist` | `/wishlist` | 🔧 stub — read `wishlist` filtré |
| `/decide` | `/decide bcl_42 approve fit niche` | 🔧 stub — branche vers `POST /symbalyx-decision` |
| `/comment` | `/comment p_0042 rappel photos` | 🔧 stub — branche vers `POST /symbalyx-comments` |
| `/expense` | `/expense 25 vercel pro` | 🔧 stub — branche vers `POST /symbalyx-finance` (kind=ledger, type=expense) |
| `/income` | `/income 1200 acompte salon` | 🔧 stub — idem (type=income) |

**Activer un intent = remplacer la réponse stub par un HTTP Request node** dans WF30, qui appelle le webhook ciblé avec les `args` parsés. Le pattern est le même pour les 6 intents stub.

---

## Sécurité

- **Whitelist par numéro** : seul un numéro listé dans `team_members.whatsapp_number` (membre actif) peut piloter le bot. Tout autre numéro reçoit "Numéro non autorisé." et est loggé dans `whatsapp_log` avec `status=denied`.
- **Pas de mot de passe** : la possession du téléphone = preuve d'identité (comme pour le SMS).
- **Logs centralisés** : chaque message inbound + outbound est tracé dans `whatsapp_log` (numéro, intent, raw_message, response, status).
- **Pas d'exécution de code arbitraire** : les intents sont une whitelist stricte. Tout autre texte → `/help` automatique.
- **Kill switch global** : tu peux ajouter un check `KILL_SWITCH=true` dans WF30 (calque WF18/19/21) pour suspendre le bot sans le désactiver.

---

## Limites du squelette

- Pas de réponses riches (boutons interactifs WhatsApp List/Buttons) — text/plain pour l'instant.
- Pas de séquences multi-tours (le bot ne se souvient pas du message précédent). Ajoute un cache via Redis ou une colonne dans `whatsapp_log` si besoin.
- Pas de validation cryptographique du webhook signature Twilio/Meta — à ajouter pour la prod.
- Le challenge GET de Meta (verify token) n'est pas implémenté dans WF30 v1 — ajoute un Webhook GET node si tu pars sur Meta direct.

---

## Test rapide quand activé

```bash
# Simule un message Twilio depuis le terminal
curl -X POST https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook/symbalyx-whatsapp \
  -d "From=whatsapp:+33612345678" \
  -d "To=whatsapp:+14155238886" \
  -d "Body=/help" \
  -d "MessageSid=SM_test_001"
```

Réponse attendue : la liste des commandes en text/plain. Et une ligne dans la Sheet `whatsapp_log`.

---

## Roadmap

- **V1 (squelette livré)** : auth, parse intent, log, réponse stub.
- **V2** : brancher `/balance`, `/pending`, `/wishlist` sur les workflows existants (lecture).
- **V3** : brancher `/decide`, `/comment`, `/expense`, `/income` (mutation).
- **V4** : notifications push proactives WhatsApp (alerte critical, relance facture). Nécessite l'approbation Meta des templates de message ("template messages").
- **V5** : LLM tool-use — l'utilisateur écrit en langage naturel ("approuve plomberie dupont"), Claude/GPT décide quel intent appeler avec quels args.
