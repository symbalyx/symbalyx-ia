---
name: symbalyx-site-builder
description: Generate complete, beautiful, responsive HTML websites for client projects. Takes a project brief (niche, business name, pages, style preferences) and outputs a self-contained index.html using Tailwind CDN, French content, premium aesthetics. Use when a project is approved (decision_status=approved, item_type=project) and needs a first deliverable, or when user asks to "build a site for X" or "generate the home page for Y".
compatibility: Requires Anthropic API key (Claude 4.7) configured in n8n credentials
metadata:
  author: symbalyx
  version: "1.0"
  consumes: project_queue rows, business_control rows where item_type=project
  produces: HTML files written to Google Drive folder + entry in project_deliverables
allowed-tools: anthropic-chat, google-drive-write, sheets-append
---

# Site Builder Skill

Generate production-ready HTML sites from a project brief. The output must be visually impressive (think Apple, Linear, Stripe) while pragmatic (single file, no build step, deployable on any static host).

## When to Use

- A project in `project_queue` has `status=in_progress` and no first deliverable yet
- User says "génère le site pour Salon Élégance" / "build the home for proj_0007"
- After WF11 client_onboarding completes a brief
- Manual trigger from the CRM project detail (button "Générer le site")

## Inputs You Need

Before generating, gather from the project brief:

### Required
- **Client name** (ex: "Salon Élégance")
- **Niche** (ex: "coiffure premium")
- **City** (ex: "Lyon")
- **Tone** : élégant / dynamique / artisanal / corporate / éditorial
- **Couleurs** : palette principale (2 couleurs hex max) ou keyword (or, vert sapin, bleu nuit)
- **Pages requested** : `home` toujours, optionnel `services`, `about`, `contact`, `gallery`

### Optional
- Logo (URL ou texte)
- Photos (URLs)
- Témoignages clients
- Horaires
- Adresse + téléphone

## Workflow

### 1. Validate brief
Si une info critique manque, retourne `{ status: "needs_input", missing: [...] }`. Ne devine jamais le nom de l'entreprise ou la niche.

### 2. Compose the prompt for Claude

Use this system prompt (copy-paste into the Anthropic node in WF50) :

```
Tu es un designer web français senior spécialisé dans les sites premium pour artisans et indépendants.

Génère un fichier HTML COMPLET et AUTONOME pour le client suivant.

Règles strictes :
1. UN SEUL FICHIER index.html, aucune dépendance locale.
2. Utilise Tailwind via CDN : <script src="https://cdn.tailwindcss.com"></script>
3. Utilise des fonts Google Fonts via <link>. Choisis 1 serif + 1 sans-serif accordées au tone.
4. Le hero doit faire effet "wow" en 2 secondes : grand titre, sous-titre courageux, CTA clair.
5. Mobile-first (sm/md/lg breakpoints Tailwind).
6. Dark/light : adapte selon le tone (corporate=light, premium=dark/contrasté).
7. Sections obligatoires : Hero, Services (3 cards min), À propos, Contact (form simple).
8. Pas de Lorem ipsum. Écris du vrai contenu en français pour la niche du client.
9. Pas de JS framework. Vanilla JS uniquement si interaction (menu mobile, smooth scroll).
10. Inclus : <meta description> SEO localisée, OpenGraph tags, favicon emoji inline.
11. Form contact : action="mailto:" en fallback, vrai email du client si fourni.
12. Accessibilité : alt sur toutes images, contraste WCAG AA, navigation au clavier.
13. Performance : zéro image > 200KB. Préfère SVG inline ou unsplash optimisé.
14. Pied de page : mentions légales placeholder + © année + ville.

Retourne UNIQUEMENT le HTML, sans markdown, sans commentaires, sans préambule.
```

User prompt template:

```
Client : {{client_name}}
Niche : {{niche}}
Ville : {{city}}
Tone : {{tone}}
Couleurs : {{colors}}
Pages demandées : {{pages}}
Email contact : {{email}}
Téléphone : {{phone}}
Horaires : {{hours}}
Brief libre : {{brief_summary}}

Génère index.html.
```

### 3. Call Claude

Model : `claude-opus-4-7` (best quality) ou `claude-sonnet-4-6` (3x cheaper, encore très bon).

`max_tokens: 16000` (un site complet fait 8-12k tokens HTML).

`temperature: 0.6` (créatif mais pas chaotique).

**Prompt caching** : cache le system prompt → 90 % de réduction sur les générations suivantes pour le même brief retravaillé.

### 4. Validate output
- Doit commencer par `<!doctype html>` ou `<html`
- Doit contenir `<title>` non vide
- Doit contenir `cdn.tailwindcss.com`
- Doit contenir le nom du client au moins 2 fois
- Si validation KO → retry une fois avec température 0.4

### 5. Save
- Drive folder : `/Symbalyx/Sites/{{client_id}}/index_v{{N}}.html`
- Append row to `project_deliverables` Sheet (cf schema ci-dessous)
- Optionnel : déploie sur Vercel/Netlify via leur API (skill séparé)

### 6. Notify
- WF40 agent_relay : `level=progress`, `from_workflow=WF50`, `title=Site v{{N}} généré pour {{client_name}}`, `body=Lien Drive : {{url}}`, `escalated_to_human=false`
- Si l'IA a flag des incertitudes (ex: "couleur non précisée, j'ai assumé or sur noir") → `escalated_to_human=true` pour validation humaine

## Output schema (project_deliverables)

```
id, ts, project_id, client_id, type, version, file_url, generated_by,
status (draft|reviewed|delivered), reviewed_by, reviewed_at, notes
```

## Examples

### Example 1 — Salon de coiffure premium

Input :
```json
{
  "client_name": "Salon Élégance",
  "niche": "coiffure premium",
  "city": "Lyon",
  "tone": "élégant",
  "colors": "or sur noir profond",
  "pages": ["home", "services", "contact"],
  "email": "contact@salon-elegance.fr",
  "phone": "04 78 00 00 00",
  "hours": "Mar-Sam 9h-19h"
}
```

Le résultat doit avoir :
- Hero noir avec typographie serif dorée
- Sections "Coupe & Couleur", "Soins", "Mariage" avec icônes inline
- Photos via unsplash query "luxury hair salon"
- Contact form avec mailto fallback
- Pied de page mentions Salon Élégance · Lyon

### Example 2 — Plombier artisan

Tone "artisanal robuste", couleurs "bleu acier + jaune sécurité", emphasis sur "intervention 24/7" et "devis gratuit".

## Failure modes

- **API timeout** : Claude met 30-60s pour générer un site complet. Augmente le timeout du node HTTP à 90 secondes.
- **Tokens dépassés** : si `max_tokens` insuffisant, le HTML est tronqué. Vérifie que la réponse se termine par `</html>`.
- **Style générique** : si plusieurs sites se ressemblent, ajoute "Évite absolument les patterns génériques de templates Wix/Squarespace" au prompt.
- **Texte en anglais malgré la consigne** : ajoute "RAPPEL : tout en français de France, jamais d'anglicisme commercial" en fin de prompt user.

## Coût estimé

- Site complet ~10k tokens output, ~2k input.
- Opus 4.7 : ~0,30 € / site
- Sonnet 4.6 : ~0,10 € / site
- Avec prompt caching après le premier brief : ~0,03 € / itération

À 50 € de marge minimum par site livré, le coût IA est négligeable.

## Notes

- Couplage avec WF11 (project_delivery) : WF11 reçoit l'HTML, le pousse sur Vercel via leur API, retourne l'URL au CRM.
- Couplage avec WF40 : la chaîne complète "WF11 → WF50 → WF11 → Vercel API" est entièrement traçée dans `agent_messages`. Tu vois en temps réel : "WF50 a généré v1, WF11 a déployé sur preview-abc123.vercel.app, en attente validation client".
- Tu peux remplacer Tailwind CDN par un build local (Vite + Tailwind) si tu veux des sites encore plus propres — mais le single-file est imbattable pour un POC client.
