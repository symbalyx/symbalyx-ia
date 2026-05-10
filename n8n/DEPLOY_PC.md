# Symbalyx — Déploiement PC (30 minutes)

Tu as ton PC ce soir. Ce guide est la version rapide de DEPLOY_IPAD.md — même étapes, zéro friction iPad.

---

## Étape 1 — Google Sheet (5 min au lieu de 10)

1. Ouvre **sheets.google.com** → Nouvelle feuille → renomme-la `Symbalyx DB`.
2. **Note l'ID** depuis l'URL : `…/spreadsheets/d/**CEL-ID-ICI**/edit`.
3. **Extensions → Apps Script** → colle le contenu de [`n8n/setup/sheets_init.gs`](setup/sheets_init.gs) → ▶ Exécuter la fonction `initSymbalyxDB`.
4. Autorise les permissions → OK → attends ~10 secondes.
5. Tous les 13 onglets sont créés avec leurs en-têtes. Arsène + Kentin sont déjà dans `team_members`. `config` a KILL_SWITCH et MAX_BATCH.

> **Ne modifie pas les emails de seed** tant que tu n'as pas de vrai compte email — ils sont juste des identifiants.

---

## Étape 2 — Google Cloud (10 min, identique iPad)

Suis DEPLOY_IPAD.md §Étape 2 et §Étape 3 — c'est identique sur PC.

Astuce PC : dans la popup client ID, tu peux **télécharger le JSON** pour garder le client_id/secret en local (ne commit PAS ce fichier).

---

## Étape 3 — n8n Cloud (5 min)

1. **n8n.cloud** → compte → sous-domaine → note-le.
2. Settings → Variables → `SYMBALYX_WEBHOOK_SECRET` = génère avec :
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   (tu as un terminal sur PC !)
3. Garde cette valeur dans un fichier local `secrets.local.txt` (jamais commité).

---

## Étape 4 — Préparer les workflows avec tes IDs (2 min)

Workflows essentiels du smoke test : WF00, WF18, WF19, WF21, WF22, WF99.
Workflows optionnels (V8.3) : WF20 finance, WF30 WhatsApp (skeleton, désactivé par défaut).

Avant d'importer dans n8n, injecte tes vraies valeurs dans les JSONs :

```bash
# Clone le repo si pas déjà fait
git clone https://github.com/symbalyx/symbalyx-ia
cd symbalyx-ia
git checkout claude/symbalyx-decision-team-sync-ZyoMB

# Lance le script d'injection (remplace les placeholders dans les 6 fichiers)
# WF00_ID = l'ID que tu verras dans l'URL n8n après avoir importé WF00 en premier
node n8n/setup/inject.js TON_GOOGLE_SHEET_ID ID_DU_WF00_DANS_N8N
```

**Ordre d'import dans n8n :**
1. Importe WF00 en premier → note son ID depuis l'URL (`/workflow/XXXX`).
2. Lance `node n8n/setup/inject.js SHEET_ID XXXX`.
3. Importe les 5 autres workflows depuis les fichiers modifiés sur ton disque.

n8n : **Workflows → + Add Workflow → Import from File** (pas Import from URL — tu veux les fichiers déjà patchés).

Pour chaque workflow importé :
- **N'active pas encore** (attends les credentials étape 5).

---

## Étape 5 — Credentials Google + Sheet ID (5 min)

1. n8n → Credentials → Google Sheets OAuth2 API → copie l'URL de callback.
2. Colle-la dans Google Cloud OAuth client → URIs de redirection → Save.
3. Colle client_id + secret dans n8n → Sign in with Google → autorise.
4. Dans **chaque** node Google Sheets de chaque workflow :
   - Credential → `Google Sheets Symbalyx`
   - Document ID → remplace `{{GOOGLE_SHEET_ID}}` par l'ID noté à l'étape 1

   **Astuce PC** : utilise Ctrl+F dans n8n pour trouver les nodes, ou ouvre les workflows en JSON brut (Settings → Download) et fais un Find & Replace avec VS Code avant de ré-importer.

5. Active les workflows (toggle **Active**).
6. Note les URLs webhook :
   - `/webhook/symbalyx-team-members`
   - `/webhook/symbalyx-comments`
   - `/webhook/symbalyx-decision`

---

## Étape 6 — CRM via GitHub Pages (2 min)

1. github.com/symbalyx/symbalyx-ia → Settings → Pages.
2. Source : branche `claude/symbalyx-decision-team-sync-ZyoMB`, dossier `/ (root)`.
3. Save → attends 1-2 min.
4. URL du CRM : `https://symbalyx.github.io/symbalyx-ia/n8n/crm/index.html`

---

## Étape 7 — Smoke test (3 min)

1. Ouvre le CRM → choisis un mot de passe local → Entrer.
2. Choisis Arsène dans la liste.
3. **Réglages** → URL webhook : `https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook` → Secret : la valeur générée → Enregistrer.
4. **Smoke test complet** → tout doit être ✓.

Si ✗ : voir DEPLOY_IPAD.md §Étape 8 pour le diagnostic par code HTTP.

---

## Ce qui est prêt une fois le smoke test vert

| Feature | État |
|---|---|
| Login 2 étapes (mdp + membre) | ✅ |
| Décisions BCL avec mémoire | ✅ |
| Commentaires d'équipe | ✅ |
| Gestion des membres (admin) | ✅ |
| Réconciliation des outcomes (WF22, 3h du mat) | ✅ |
| **Prospection automatique** (WF1/2/4/5/7) | ⏳ prochaine session |
| RBAC par rôle, mdp par membre | ⏳ palier suivant |

---

## Checklist "avant ce soir" — ce que j'ai préparé pour toi

- [x] `n8n/setup/sheets_init.gs` — Apps Script prêt à coller, crée les 13 onglets en 10 secondes
- [x] `n8n/DEPLOY_PC.md` — ce fichier, guide 30 minutes
- [x] Tous les workflows JSON dans `n8n/workflows/` — prêts à importer via URL raw
- [x] Le CRM `n8n/crm/index.html` — smoke test intégré, rien à modifier avant le test
- [x] 53 tests passants (35 logique WF + 18 CRM headless)

**La seule chose que je ne peux PAS faire à ta place** : connecter ton compte Google à n8n (OAuth) et entrer ton `SYMBALYX_WEBHOOK_SECRET`. Ces deux opérations nécessitent ta présence — par design.

---

## Combien de temps sur PC ce soir ?

| Scénario | Durée estimée |
|---|---|
| Smoke test vert + test à 2 (toi + Kentin) | 30 min |
| + Activer WF22 (cron outcomes) | +5 min |
| + Tester scénario complet BCL→décision→mémoire | +10 min |
| + Préparer WF1 prospection (next session) | Session dédiée |
