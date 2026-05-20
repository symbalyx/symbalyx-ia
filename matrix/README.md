# Symbalyx · Messagerie chiffrée locale

Stack Matrix Synapse + Element Web + Element Call + UI custom, 100% locale,
chiffrement E2E natif (Megolm + MatrixRTC), jusqu'à 10 utilisateurs.

**Features livrées :**
- ✅ Messagerie 1-1 et groupe E2E (Olm/Megolm)
- ✅ Groupes privés créés depuis la UI custom (preset `private_chat` + encryption forcée + history `invited` + guests interdits)
- ✅ Messages éphémères (rétention serveur via `m.room.retention`, configurable par groupe : 1h → 30j)
- ✅ Appels voix et vidéo de groupe E2EE (Element Call + LiveKit SFU, jusqu'à 8 participants)
- ✅ **Mode visiteur (leurre)** : fausses conversations crédibles avec auto-réponses scriptées, quand on passe le téléphone à un inconnu. Activation discrète via 5 taps sur le badge "Chiffré E2E". Aucune connexion réseau pendant le leurre.
- ✅ **Transcription locale** des messages vocaux et **résumé d'appels** via Whisper (100% local, zéro cloud)
- ✅ **PWA installable** sur iOS et Android (manifest + service worker, ajout à l'écran d'accueil)
- ✅ Messages vocaux supportés nativement (Element)
- ✅ Recherche d'utilisateurs / invitations
- ✅ UI custom dark/glassmorphism inspirée Signal (sidebar, badges chiffrement, actions rapides)
- ✅ **Coffre** : conversations masquées accessibles uniquement via code PIN secret (bouton secret dans le profil)
- ✅ **Mode discret** : push silencieux global, read receipts désactivés, typing notifications désactivés
- ✅ **Auto-verrouillage** : session verrouillée après inactivité (1/5/15/30 min), réauth par mot de passe
- ✅ **Sortie de secours** : panic button (logout + effacement local + redirection vers about:blank), raccourci `Ctrl+Shift+Q`
- ✅ **Menu contextuel** sur les rooms (clic droit / long-press mobile) : masquer, couper notifs, quitter
- ✅ Présence (online/last_active) désactivée côté serveur · URL previews désactivés · profils restreints aux salons communs · redactions purgées · devices stales nettoyés
- ✅ Responsive mobile, accès LAN possible

---

## Prérequis

- Windows 10/11
- Docker Desktop **démarré**
- PowerShell en administrateur
- Connaître votre IP locale (`ipconfig` → `Adresse IPv4`)

---

## ÉTAPE 1 — Récupérer le projet

```powershell
cd $env:USERPROFILE
git clone https://github.com/symbalyx/symbalyx-ia.git
cd symbalyx-ia\matrix
```

**Validation :** `dir` affiche `docker-compose.yml`, `element/`, `element-call/`, `ui/`, `config/`.

---

## ÉTAPE 2 — Générer la configuration Synapse

```powershell
docker run -it --rm `
  -v "${PWD}\data\synapse:/data" `
  -e SYNAPSE_SERVER_NAME=localhost `
  -e SYNAPSE_REPORT_STATS=no `
  matrixdotorg/synapse:latest generate
```

**Validation :** `data\synapse\homeserver.yaml` existe.

---

## ÉTAPE 3 — Patcher homeserver.yaml

### 3a. Remplacez la section `database` par :

```yaml
database:
  name: psycopg2
  args:
    user: synapse
    password: synapse_local_pw_change_me
    database: synapse
    host: postgres
    port: 5432
    cp_min: 5
    cp_max: 10
```

### 3b. Ajoutez ce bloc à la fin du fichier :

```yaml
# === Symbalyx base overrides ===
enable_registration: false
enable_registration_without_verification: false
password_config:
  enabled: true

listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    bind_addresses: ['0.0.0.0']
    resources:
      - names: [client, federation]
        compress: false

encryption_enabled_by_default_for_room_type: all
federation_domain_whitelist: []
serve_server_wellknown: true

turn_uris: ["turn:VOTRE_IP_LOCALE:3478?transport=udp"]
turn_shared_secret: "symbalyx_turn_secret_change_me"
turn_user_lifetime: 86400000
turn_allow_guests: false

max_upload_size: 50M
```

> Remplacez `VOTRE_IP_LOCALE` par votre IPv4 (ex `192.168.1.42`).

### 3c. Ajoutez **aussi** le contenu de `config/synapse-overrides-v2.yaml` à la fin :

```powershell
Get-Content config\synapse-overrides-v2.yaml | Add-Content data\synapse\homeserver.yaml
```

Ce bloc active :
- l'annonce du focus MatrixRTC (Element Call) via `.well-known/matrix/client`
- la rétention serveur des messages (`m.room.retention`)
- le durcissement vie privée (profils restreints, salons publics fédérés interdits)

**Validation :**

```powershell
Select-String -Path data\synapse\homeserver.yaml -Pattern "rtc_foci"
Select-String -Path data\synapse\homeserver.yaml -Pattern "retention"
```

Les deux doivent renvoyer une ligne.

---

## ÉTAPE 4 — Démarrer la stack

```powershell
docker compose up -d
```

Premier lancement : ~1 Go d'images (Synapse + Element + Element Call + LiveKit + lk-jwt-service + Postgres + coturn + nginx). 2-5 min selon votre connexion.

**Validation :**

```powershell
docker compose ps
```

9 conteneurs attendus, tous `running` / `healthy` :

| Conteneur                 | Rôle                                  |
| ------------------------- | ------------------------------------- |
| `symbalyx_postgres`       | base Matrix                           |
| `symbalyx_synapse`        | homeserver Matrix                     |
| `symbalyx_element`        | client Element Web                    |
| `symbalyx_livekit`        | SFU média (appels groupe)             |
| `symbalyx_lk_jwt`         | bridge auth Matrix ↔ LiveKit          |
| `symbalyx_element_call`   | client appel vidéo groupe E2EE        |
| `symbalyx_coturn`         | TURN/STUN appels 1-1                  |
| `symbalyx_whisper`        | transcription vocale locale           |
| `symbalyx_ui`             | UI custom Symbalyx                    |

Tests rapides :

```powershell
curl http://localhost:8008/health         # OK
curl http://localhost:8008/.well-known/matrix/client   # JSON avec rtc_foci
curl http://localhost:8881/healthz        # OK (lk-jwt-service)
```

---

## ÉTAPE 5 — Créer les 10 comptes utilisateurs

L'enregistrement public est désactivé : on crée chaque compte via la CLI admin du conteneur.

```powershell
# Admin
docker exec -it symbalyx_synapse register_new_matrix_user `
  -u admin -p ChangeMoiAdmin2026 -a `
  -c /data/homeserver.yaml http://localhost:8008

# 9 utilisateurs
docker exec -it symbalyx_synapse register_new_matrix_user -u alice  -p MotDePasseFort1 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u bob    -p MotDePasseFort2 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u carol  -p MotDePasseFort3 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u david  -p MotDePasseFort4 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u eve    -p MotDePasseFort5 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u frank  -p MotDePasseFort6 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u grace  -p MotDePasseFort7 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u henry  -p MotDePasseFort8 --no-admin -c /data/homeserver.yaml http://localhost:8008
docker exec -it symbalyx_synapse register_new_matrix_user -u iris   -p MotDePasseFort9 --no-admin -c /data/homeserver.yaml http://localhost:8008
```

---

## ÉTAPE 6 — Utiliser la messagerie

| URL                          | Quoi                          |
| ---------------------------- | ----------------------------- |
| **`http://localhost:8090`**  | **UI custom Symbalyx**        |
| `http://localhost:8080`      | Element Web officiel          |
| `http://localhost:8181`      | Element Call standalone       |
| `http://localhost:8008`      | API Synapse                   |

### Créer un groupe privé chiffré

1. Connectez-vous sur `http://localhost:8090` avec `alice / MotDePasseFort1`
2. Cliquez **+ Nouveau groupe privé**
3. Saisissez un nom (ex `Équipe`)
4. Tapez les pseudos à inviter (`bob`, `carol`, …) — autocomplétion via le user directory
5. **Créer le groupe** → chiffrement E2E activé automatiquement

### Activer les messages éphémères sur un groupe

1. Sélectionnez le groupe dans la sidebar
2. Cliquez l'icône **horloge** dans le header
3. Choisissez la durée (1h / 6h / 24h / 7j / 30j) → **Appliquer**

Le badge `Auto-suppression Xh` apparaît sous le nom du groupe. Le serveur purge les anciens events à chaque cycle (1×/jour).

### Mode visiteur (leurre) — quand on passe le téléphone à un inconnu

Pensé pour les moments où quelqu'un te demande "ton téléphone pour appeler" / "regarder une info". Tu actives le mode visiteur **en 1 seconde** et l'appli affiche **uniquement des fausses conversations crédibles** (Maman, Léo, le pressing, le club de yoga, etc.) avec un fake chat fonctionnel.

**Activation (2 méthodes au choix)** :
- **5 taps rapides** sur le badge « Chiffré E2E » en haut à droite (le plus discret)
- Menu profil → **Mode visiteur**

**Au 1er usage** : un prompt demande un code à 4 chiffres pour le mode (différent du code coffre). C'est ce code qui servira aussi à **sortir** du mode visiteur.

**Pendant le mode visiteur** :
- Sidebar : 8 conversations factices (Maman, Léo, Amélie, Pressing, Yoga, Banque, Pharmacie, Équipe projet)
- Tu peux **ouvrir n'importe laquelle, lire des messages crédibles, taper et envoyer un message** — il s'affiche normalement, comme dans une vraie messagerie
- Certains contacts répondent automatiquement à des mots-clés (auto-replies scriptés, ex : "merci" → "De rien 😘")
- **Aucune connexion réseau vers Matrix** : tout est local. Impossible que l'inconnu tombe sur tes vraies conversations.
- Le menu profil, l'avatar, le label de l'utilisateur affichent un nom factice (configurable dans `ui/decoy-data.js` → `myName`)
- Pas de badge "Coffre" visible (rien ne révèle l'existence du mode normal)

**Pour sortir du mode visiteur** (toi seul) :
- 5 taps sur le badge "Chiffré E2E" → prompt code → entrer le code de leurre ou le code coffre

**Personnaliser les fausses conversations** :

Édite `matrix/ui/decoy-data.js`. Le fichier est documenté ; tu peux :
- Changer ton "nom" en mode visiteur (`myName`, `myAvatar`)
- Modifier les contacts (nom, couleur, dernière activité)
- Modifier les messages (texte, expéditeur, heure)
- Ajouter des auto-réponses par regex (`autoreply`)

Plus c'est cohérent avec ta vie réelle, plus c'est indétectable.

> **Conseil de crédibilité** : pré-remplir avec des conversations qui ressemblent à ta vie. Un inconnu qui regarderait la liste cherche des incohérences (langue, ton, dates). Les messages factices fournis sont volontairement banals et datés (hier, semaine dernière) pour ne pas paraître "trop frais".

`docker compose restart ui` après modification du fichier.

---

### Conversations masquées (Coffre)

Symbalyx propose un **mode coffre** : certaines conversations sont entièrement cachées de la sidebar et accessibles uniquement après avoir entré un code PIN secret.

**Comment masquer une conversation**

1. Dans la sidebar, **clic droit** sur la conversation à masquer (ou **long-press** sur mobile)
2. Cliquer **Masquer la conversation**

La conversation disparaît immédiatement de la liste visible. Elle n'est plus accessible qu'en ouvrant le coffre.

**Comment ouvrir le coffre**

Deux gestes secrets équivalents (au choix) :

- **Long-press 2 secondes** sur votre avatar (gros rond coloré dans le menu profil)
- **5 taps rapides** sur la mention « Symbalyx · v1 » tout en bas du menu profil

Au premier accès, vous choisissez un code à 4 chiffres. Aux suivants, vous le saisissez.

> Le code est stocké **hashé en SHA-256, salé avec votre user_id, en localStorage**. Personne d'autre que vous ne peut le récupérer. Si vous l'oubliez : effacez les données locales depuis le menu profil → vous pouvez en créer un nouveau, mais perdrez l'accès rapide aux conversations masquées (elles restent accessibles via Element Web qui ignore le tag custom).

Quand le coffre est ouvert :
- L'interface bascule en thème rouge/orange discret
- Un badge **Coffre** apparaît à côté du badge Chiffré E2E
- La sidebar n'affiche **que** les conversations masquées
- Pour quitter : re-long-press l'avatar (ou 5 taps secret zone)

> **Limite honnête** : ce verrou protège l'écran de Symbalyx UI. Si quelqu'un accède à Element Web (`localhost:8080`) sur la même machine et se connecte avec votre compte, il verra toutes les conversations. Pour aller plus loin, créez un compte Matrix dédié pour les conversations sensibles.

### Mode discret

Menu profil → **Mode discret** (toggle).

Lorsqu'il est actif :
- Une règle push globale `dont_notify` est ajoutée → aucune notification système
- Element n'envoie ni read receipts ni typing notifications (les autres ne voient pas que vous avez lu / que vous tapez)

### Verrouillage automatique

Menu profil → **Verrouillage auto** (cycle : Désactivé / 1 / 5 / 15 / 30 min).

Après le délai d'inactivité (souris, clavier, scroll), un écran de verrouillage couvre toute l'application. Pour déverrouiller, ressaisissez votre mot de passe Matrix.

Bouton **cadenas** à côté de votre avatar = verrouiller manuellement.

### Sortie de secours (panic)

Trois moyens de déclencher :
- Menu profil → **Sortie de secours**
- Raccourci clavier **Ctrl+Shift+Q** (depuis n'importe où dans l'app)
- (Documenté seulement ici : le panic n'a pas de bouton visible, par discrétion)

Effets :
- Logout via API (invalide le token côté serveur)
- `localStorage` vidé (sauf le hash du code coffre, gardé pour la prochaine session)
- `sessionStorage` vidé
- Redirection vers `about:blank` (la page Symbalyx disparaît de l'historique récent)

### Transcription vocale & résumé d'appel (Whisper local)

Un service Docker `whisper` (image `onerahmet/openai-whisper-asr-webservice`, modèle `small` par défaut) tourne sur le port `9000` en local. Tout transit reste sur ta machine.

**Transcrire un message vocal** :
1. Dans une conversation, clique l'icône **document** (à côté de l'horloge) dans le header
2. **Transcrire le dernier vocal** → l'app récupère le dernier `m.audio` du salon, le télécharge, le passe à Whisper, affiche le texte

**Enregistrer + résumer un appel** :
1. Pendant l'appel (ou juste après), icône **document** → **Enregistrer & résumer**
2. Autorise le micro la 1ère fois
3. À la fin, clique **Arrêter et résumer**
4. Whisper transcrit → un résumé heuristique (intro + mots-clés) s'affiche dans la modale
5. Tu peux copier-coller dans la conversation

> **Modèle plus précis** : édite `docker-compose.yml`, change `ASR_MODEL: "small"` en `"medium"` ou `"large-v3"`. Compromis : plus précis = plus lent et plus de RAM (`small` ~1 Go, `large-v3` ~6 Go).

> **Résumé par LLM local** : la version actuelle utilise une heuristique simple (sujet + mots-clés). Pour un vrai résumé en langage naturel, on peut ajouter Ollama (Mistral 7B ou Llama 3.1 8B). À demander si tu veux que je l'ajoute.

---

### Installer l'app sur ton téléphone (PWA)

L'app Symbalyx est installable comme une vraie app sur iOS, Android et desktop, sans passer par un store.

**iOS (Safari)** :
1. Ouvre `http://IP_PC:8090` dans Safari
2. Appuie sur **Partager** → **Sur l'écran d'accueil**
3. L'icône Symbalyx apparaît sur ton écran d'accueil, comme une vraie app

**Android (Chrome)** :
1. Ouvre `http://IP_PC:8090` dans Chrome
2. Un bandeau "Installer Symbalyx" apparaît en bas → clique-le
3. Ou : menu ⋮ → "Ajouter à l'écran d'accueil"

**Desktop (Chrome/Edge)** :
1. Ouvre l'URL
2. Icône d'installation dans la barre d'URL (à droite) → clique

L'app installée s'ouvre **sans barre de navigateur**, comme une app native. Plus discrète. Le service worker met en cache l'UI ; les conversations restent toujours fetched live depuis le serveur.

> **Limite iOS** : Apple bride certaines fonctions PWA (notifications push, accès micro en background). Pour caméra/micro pendant les appels, il faut HTTPS (voir section dédiée plus bas).

---

### Lancer un appel voix ou vidéo de groupe (chiffré)

1. Sélectionnez le groupe
2. Icône **téléphone** = appel voix, icône **caméra** = appel vidéo
3. Une fenêtre Element Call s'ouvre, demandez aux autres membres de cliquer le même bouton de leur côté
4. Jusqu'à 8 participants simultanés, flux E2EE bout-en-bout (LiveKit ne voit que du chiffré)

---

## ÉTAPE 7 — Accès depuis un téléphone (même WiFi)

1. IP du PC :

   ```powershell
   ipconfig | findstr IPv4
   ```

2. Ouvrir le pare-feu :

   ```powershell
   New-NetFirewallRule -DisplayName "Symbalyx HTTP" -Direction Inbound -Protocol TCP -LocalPort 8008,8080,8090,8181,8881 -Action Allow
   New-NetFirewallRule -DisplayName "Symbalyx LiveKit" -Direction Inbound -Protocol TCP -LocalPort 7880,7881 -Action Allow
   New-NetFirewallRule -DisplayName "Symbalyx Media UDP" -Direction Inbound -Protocol UDP -LocalPort 3478,49152-49172,50000-60000 -Action Allow
   ```

3. Remplacer `localhost` par votre IP locale dans :
   - `ui/index.html` → bloc `CONFIG` (3 URLs : `homeserver`, `elementUrl`, `elementCall`)
   - `element/config.json` → `base_url`
   - `element-call/config.json` → `base_url` et `livekit_service_url`
   - `data/synapse/homeserver.yaml` → `extra_well_known_client_content.org.matrix.msc4143.rtc_foci[0].livekit_service_url`

4. Relancer :

   ```powershell
   docker compose restart synapse element element-call ui
   ```

5. Sur le téléphone : `http://VOTRE_IP:8090`

> **Limite** : sans HTTPS, les navigateurs mobiles refusent l'accès caméra/micro pour les appels vidéo. Pour les appels vidéo depuis mobile, voir la section HTTPS plus bas.

---

## ÉTAPE 8 — Vérifier que tout est chiffré

### Vérif messages (Megolm)

1. Connectez `alice` et `bob` dans deux navigateurs
2. Alice crée un groupe privé avec bob
3. Échangez des messages
4. Vérification serveur :

   ```powershell
   docker exec -it symbalyx_postgres psql -U synapse -d synapse -c `
     "SELECT type, content::text FROM events WHERE type='m.room.encrypted' ORDER BY received_ts DESC LIMIT 3;"
   ```

   Les contenus sont du type `{"algorithm":"m.megolm.v1.aes-sha2","ciphertext":"AwgAEnA..."}` — chiffré illisible.

### Vérif appels (MatrixRTC + PerParticipantE2EE)

1. Lancez un appel vidéo entre alice et bob
2. Dans la fenêtre Element Call, cliquez l'icône **i** ou regardez le bandeau du haut : doit afficher "End-to-end encrypted"
3. Vérification serveur LiveKit :

   ```powershell
   docker logs symbalyx_livekit --tail 20
   ```

   Les logs montrent les sessions WebRTC mais aucun contenu média n'est déchiffrable côté serveur (clés Megolm partagées hors-bande entre participants Matrix).

### Vérif rétention

1. Activez `1 heure` sur un groupe
2. Vérification de l'event state :

   ```powershell
   docker exec -it symbalyx_postgres psql -U synapse -d synapse -c `
     "SELECT room_id, content::text FROM events WHERE type='m.room.retention' ORDER BY received_ts DESC LIMIT 3;"
   ```

   Vous voyez `{"max_lifetime": 3600000}`.

3. Synapse purge les events anciens à chaque exécution du job (1×/jour par défaut, configurable).

---

## Commandes utiles

```powershell
# Logs
docker compose logs -f synapse
docker compose logs -f element-call
docker compose logs -f livekit

# Stop / restart
docker compose down
docker compose up -d
docker compose restart synapse

# Reset total (⚠ efface comptes + messages)
docker compose down -v
Remove-Item -Recurse -Force .\data\

# Liste users
docker exec -it symbalyx_postgres psql -U synapse -d synapse -c "SELECT name FROM users;"

# Forcer un purge de rétention immédiat
docker exec -it symbalyx_synapse curl -X POST `
  -H "Authorization: Bearer TOKEN_ADMIN" `
  "http://localhost:8008/_synapse/admin/v1/purge_history/!ROOMID:localhost" `
  -d '{"delete_local_events": true, "purge_up_to_ts": 0}'
```

---

## HTTPS local (requis pour appels vidéo mobile)

Les navigateurs Chrome/Safari/Firefox refusent l'accès caméra/micro hors HTTPS (sauf `localhost`). Pour passer en HTTPS local :

```powershell
# 1. Installer mkcert
scoop install mkcert
mkcert -install

# 2. Générer les certificats
mkdir certs
cd certs
mkcert 192.168.1.42 localhost 127.0.0.1
cd ..
```

Puis ajoutez un service `caddy` au compose (peut être demandé à Claude au moment où vous êtes prêt à passer en HTTPS).

---

## Personnaliser le branding

Éditez `matrix/ui/index.html` → bloc `CONFIG` en haut du `<script>` :

```js
const CONFIG = {
  brandName:    "VotreNom",
  brandSuffix:  "· chiffré",
  brandLetter:  "V",
  homeserver:   "http://localhost:8008",
  elementUrl:   "http://localhost:8080",
  elementCall:  "http://localhost:8181",
  serverName:   "localhost"
};
```

Couleurs : variables CSS `--accent`, `--accent-2`, `--signal-blue` en haut du `<style>`.

Pas besoin de rebuild : `docker compose restart ui` (ou recharger la page).

---

## Architecture

```
┌─────────────────┐
│  UI Symbalyx    │ :8090
│  (sidebar +     │
│   actions)      │
└────────┬────────┘
         │
         ├──► API Matrix ────► Synapse :8008 ────► Postgres
         │    (login, rooms,
         │     retention,
         │     invitations)
         │
         ├──► iframe Element :8080 (chat E2E)
         │
         └──► iframe Element Call :8181
                 │
                 ├──► lk-jwt-service :8881 (auth Matrix → JWT)
                 │
                 └──► LiveKit SFU :7880 (relais média chiffré)
```

Tous les flux restent locaux. Aucun port n'est exposé sur Internet.
Le chiffrement Megolm (messages) et PerParticipantE2EE (média) s'effectue dans le navigateur ; les serveurs ne relayent que du chiffré.
