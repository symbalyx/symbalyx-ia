# Symbalyx · Messagerie chiffrée locale

Stack Matrix Synapse + Element Web + UI custom, 100% locale, chiffrement E2E natif, jusqu'à 10 utilisateurs, appels voix/vidéo.

---

## Prérequis

- Windows 10/11
- Docker Desktop **démarré** (icône baleine active dans le systray)
- PowerShell ouvert **en administrateur**
- Connaître l'IP locale de votre PC (`ipconfig` → `Adresse IPv4`)

---

## ÉTAPE 1 — Récupérer le projet

```powershell
cd $env:USERPROFILE
git clone https://github.com/symbalyx/symbalyx-ia.git
cd symbalyx-ia\matrix
```

> Si Git n'est pas installé : téléchargez le dossier `matrix/` depuis le repo et placez-le dans `%USERPROFILE%\symbalyx-ia\matrix`.

**Validation :** `dir` doit afficher `docker-compose.yml`, `element/`, `ui/`, `config/`.

---

## ÉTAPE 2 — Générer la configuration Synapse

Cette commande crée `homeserver.yaml`, les clés de signature et la base.

```powershell
docker run -it --rm `
  -v "${PWD}\data\synapse:/data" `
  -e SYNAPSE_SERVER_NAME=localhost `
  -e SYNAPSE_REPORT_STATS=no `
  matrixdotorg/synapse:latest generate
```

**Validation :** un fichier `data\synapse\homeserver.yaml` est créé.

---

## ÉTAPE 3 — Patcher homeserver.yaml

Ouvrez `data\synapse\homeserver.yaml` dans le Bloc-notes et **remplacez intégralement la section `database`** par :

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

Puis **ajoutez ces lignes à la fin du fichier** :

```yaml
# === Symbalyx overrides ===
enable_registration: false
enable_registration_without_verification: false
password_config:
  enabled: true

# Écoute publique (utile pour accès LAN/téléphone)
listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    bind_addresses: ['0.0.0.0']
    resources:
      - names: [client, federation]
        compress: false

# Chiffrement E2E activé par défaut dans toutes les conversations
encryption_enabled_by_default_for_room_type: all

# Pas de fédération avec d'autres serveurs Matrix
federation_domain_whitelist: []

# CORS pour autoriser l'UI custom
serve_server_wellknown: true

# TURN (appels audio/vidéo) — IP à remplacer par celle de votre PC
turn_uris: ["turn:VOTRE_IP_LOCALE:3478?transport=udp"]
turn_shared_secret: "symbalyx_turn_secret_change_me"
turn_user_lifetime: 86400000
turn_allow_guests: false

# Limites raisonnables pour 10 users
max_upload_size: 50M
```

> Remplacez `VOTRE_IP_LOCALE` par votre IPv4 (ex : `192.168.1.42`). Pour un usage purement localhost sans appels, vous pouvez laisser les 4 lignes `turn_*` commentées.

**Validation :** le fichier contient bien le bloc `# === Symbalyx overrides ===`.

---

## ÉTAPE 4 — Démarrer la stack

```powershell
docker compose up -d
```

Le premier lancement télécharge ~600 Mo d'images (1-3 minutes).

**Validation :**

```powershell
docker compose ps
```

Les 5 conteneurs doivent être en `running` ou `healthy` :
- `symbalyx_postgres`
- `symbalyx_synapse`
- `symbalyx_element`
- `symbalyx_coturn`
- `symbalyx_ui`

Test rapide :

```powershell
curl http://localhost:8008/health
```

Doit répondre `OK`.

---

## ÉTAPE 5 — Créer les 10 comptes utilisateurs

L'enregistrement public est désactivé : on crée chaque compte via la CLI admin du conteneur.

**Compte admin (1er) :**

```powershell
docker exec -it symbalyx_synapse register_new_matrix_user `
  -u admin `
  -p ChangeMoiAdmin2026 `
  -a `
  -c /data/homeserver.yaml `
  http://localhost:8008
```

**Comptes utilisateurs (à exécuter 9 fois en changeant `-u` et `-p`) :**

```powershell
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

**Validation :** chaque commande affiche `Sending registration request... Success.`

---

## ÉTAPE 6 — Accéder à l'interface

3 entrées possibles :

| URL                          | Quoi                          |
| ---------------------------- | ----------------------------- |
| `http://localhost:8090`      | **UI custom Symbalyx**        |
| `http://localhost:8080`      | Element Web (officiel)        |
| `http://localhost:8008`      | API Synapse (santé/admin)     |

Connectez-vous avec un identifiant créé à l'étape 5 (`alice` / `MotDePasseFort1`).

**Validation :** vous arrivez sur l'écran de connexion Symbalyx, vous vous connectez, l'iframe Element se charge.

---

## ÉTAPE 7 — Accès depuis un téléphone (même WiFi)

1. Récupérez l'IP de votre PC :

   ```powershell
   ipconfig | findstr IPv4
   ```

   Exemple : `192.168.1.42`.

2. Autorisez les ports 8008, 8080, 8090, 3478 dans le pare-feu Windows :

   ```powershell
   New-NetFirewallRule -DisplayName "Symbalyx Matrix" -Direction Inbound -Protocol TCP -LocalPort 8008,8080,8090 -Action Allow
   New-NetFirewallRule -DisplayName "Symbalyx TURN UDP" -Direction Inbound -Protocol UDP -LocalPort 3478,49152-49172 -Action Allow
   ```

3. Modifiez `matrix\ui\index.html` ligne `CONFIG` :

   ```js
   homeserver: "http://192.168.1.42:8008",
   elementUrl: "http://192.168.1.42:8080"
   ```

4. Et `matrix\element\config.json` :

   ```json
   "base_url": "http://192.168.1.42:8008"
   ```

5. Relancez :

   ```powershell
   docker compose restart element ui
   ```

6. Sur le téléphone, ouvrez le navigateur : `http://192.168.1.42:8090`

> Limite : sans HTTPS, certains navigateurs mobiles bloqueront la caméra/micro. Pour les appels vidéo depuis mobile, voir la section "HTTPS local" en bas.

**Validation :** la page Symbalyx s'affiche sur le téléphone, login fonctionne.

---

## ÉTAPE 8 — Vérifier que le chiffrement E2E fonctionne

1. Connectez **alice** et **bob** dans deux navigateurs distincts (ou un navigateur + une fenêtre privée).
2. Avec alice → **Nouvelle conversation directe** → inviter `@bob:localhost`.
3. Dans la conversation, regardez l'icône en haut à droite (Element) : un **cadenas vert** doit apparaître.
4. Cliquez le cadenas → "Chiffrement de bout en bout activé".
5. Envoyez un message → il s'affiche avec une **icône cadenas** à côté.

**Test serveur (preuve technique) :**

```powershell
docker exec -it symbalyx_postgres psql -U synapse -d synapse -c "SELECT type, content::text FROM events WHERE type='m.room.encrypted' ORDER BY received_ts DESC LIMIT 3;"
```

Le contenu des messages dans la base est de la forme `{"algorithm":"m.megolm.v1.aes-sha2","ciphertext":"AwgAEnA..."}` — du **chiffré illisible**. Le serveur n'a aucun moyen de lire les messages.

**Vérification croisée (signature des appareils) :**

Dans Element → **Profil → Sécurité et confidentialité → Vérifier cet appareil** entre alice et bob, en scannant le QR ou comparant les emojis. Une fois fait, un **bouclier vert** s'affiche à côté du nom.

---

## Commandes utiles

```powershell
# Voir les logs
docker compose logs -f synapse
docker compose logs -f element

# Arrêter la stack
docker compose down

# Tout supprimer (⚠ efface aussi les comptes et messages)
docker compose down -v
Remove-Item -Recurse -Force .\data\

# Redémarrer après modif config
docker compose restart synapse

# Lister les utilisateurs
docker exec -it symbalyx_postgres psql -U synapse -d synapse -c "SELECT name FROM users;"
```

---

## HTTPS local (optionnel, requis pour appels vidéo mobile)

Pour les appels vidéo depuis téléphone, les navigateurs exigent HTTPS. Solution rapide : `mkcert` + reverse proxy Caddy.

```powershell
# Installer mkcert via Scoop
scoop install mkcert
mkcert -install
mkcert 192.168.1.42 localhost
```

Puis ajoutez un service `caddy` dans `docker-compose.yml` qui sert les ports 8008/8080/8090 en HTTPS avec les certificats générés. À demander à Claude lorsque vous serez prêt à passer en HTTPS.

---

## Personnaliser le branding

Éditez `matrix/ui/index.html` → bloc `CONFIG` en haut du `<script>` :

```js
const CONFIG = {
  brandName:   "VotreNom",
  brandSuffix: "· chiffré",
  brandLetter: "V",
  homeserver:  "http://localhost:8008",
  elementUrl:  "http://localhost:8080"
};
```

Pour changer les couleurs : variables CSS `--accent` et `--accent-2` en haut du `<style>`.

Pas besoin de rebuild : `docker compose restart ui` suffit (ou rechargez la page).
