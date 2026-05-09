# Prompt — A20 Site Builder Skills (Design Taste + UI Patterns)

Pack de skills à coller dans le `system` prompt du générateur de site Symbalyx
(ou à appeler comme sub-prompt avant la génération).

Inspiré de :
- **tasteskill.dev** — entraîner le goût design : hiérarchie, typo, contraste, sobriété.
- **uupm.cc (UUPM)** — patterns d'UI/UX éprouvés : layouts, composants, micro-interactions.

Objectif : transformer un brief client en un **prompt de génération** qui produit
des sites visuellement cohérents, modernes, sobres, mobile-first, sans tomber
dans le générique IA bullshit.

---

## SKILL 1 — DESIGN TASTE (tasteskill-style)

### Règles non-négociables
1. **Hiérarchie d'abord, déco après.** Un titre énorme + un texte court > 12 sections décoratives.
2. **Typographie : 1 famille pour les titres, 1 pour le corps.** Maximum.
   Sans-serif moderne (Inter, Söhne-like, IBM Plex, Geist) sauf si la niche
   l'exige (avocat → serif élégant, restau gastro → serif éditorial).
3. **Échelle typographique** : 4xl/3xl/2xl/xl/base/sm. Pas plus.
4. **Contraste** : ratio AAA pour le corps (>= 7:1), AA pour les titres.
5. **Couleurs** : 1 neutre (bg + 2 nuances), 1 accent unique. Pas de dégradé sauf
   bouton CTA principal. Pas de palette arc-en-ciel.
6. **Espace blanc** : si tu hésites, doublé. Padding section ≥ 96px desktop,
   ≥ 48px mobile.
7. **Alignement** : grille 12 colonnes desktop, 4 colonnes mobile. Aligner
   chaque élément sur la grille.
8. **Mobile-first** : le hero doit fonctionner sur 375px de large sans pinch-zoom.
9. **CTA primaire UNIQUE par page** (sauf header sticky). Si tu veux plus, t'as
   pas réfléchi.
10. **Pas de stock photos génériques.** Si pas de photos client : illustrations
    abstraites monochromes ou rien.

### Anti-patterns interdits
- ❌ Texte sur image floue avec gradient sombre.
- ❌ "Welcome to [niche]" comme H1.
- ❌ Carrousels marketing en hero.
- ❌ Plus de 3 boutons côte à côte.
- ❌ Emojis dans titres pro.
- ❌ "Scroll for more" / arrow animée — usagé.
- ❌ Sections "Our values" avec 3 icônes génériques.
- ❌ Police italique pour "élégance" sur tout un paragraphe.

### Sobriété par niche (presets)
| Niche | Vibe | Couleur accent suggérée | Typo titres |
|---|---|---|---|
| plombier / artisan | confiance, terrain | bleu profond (#1e3a8a) ou vert sapin | Inter / Geist |
| coiffeur salon | propre, lumineux | nude / terracotta doux | Inter / DM Serif Display sur H1 |
| coach / consultant | net, premium | noir + accent unique | Söhne-like / Inter |
| restaurant gastro | éditorial, chaleureux | crème + brun chaud | serif (Cormorant, Fraunces) |
| restaurant quick | énergique, lisible | accent vif unique | Inter bold |
| photographe | image-first, blanc | full noir/blanc | sans-serif minimaliste |
| immobilier local | sérieux, accessible | bleu marine + sable | Inter / Söhne |

---

## SKILL 2 — UI PATTERNS (UUPM-style)

### Layouts éprouvés (ne pas réinventer)
1. **Hero "value prop + CTA + preuve"** (mobile : empilé, desktop : 2 col).
   - H1 : 6-12 mots, bénéfice client. Pas le nom de la boîte.
   - Sub-H1 : 1 phrase, pour qui + comment.
   - 1 CTA primaire + 1 lien secondaire texte.
   - Preuve : note Google / nombre de clients / années d'expérience. Pas de logos clients factices.
2. **Section "Pour qui c'est"** : 3 cards avec persona + douleur résolue. Pas "Our Services".
3. **Section "Comment ça se passe"** : 3 à 5 étapes numérotées. Verbe à l'infinitif.
4. **Section "Avis"** : 1 à 3 témoignages courts avec nom + ville (jamais "Marie D., heureuse cliente").
5. **FAQ** : 4 à 8 questions vraies. Si tu en as 12, c'est trop.
6. **CTA final** : un bloc plein écran avec H2 + CTA primaire répété.
7. **Footer minimal** : 3 colonnes max (contact / liens utiles / mentions). Pas de mini-sitemap.

### Composants standards
- **Bouton primaire** : background accent, texte blanc, padding 14x24, radius 10-12px,
  hover : opacité 0.9 ou translate -1px. Aucun ombrage massif.
- **Bouton secondaire** : ghost, border 1px, même padding.
- **Card** : background neutre clair, border 1px très subtile, radius 14-16px,
  padding 24px. Hover : ombre douce + lift -2px.
- **Input** : hauteur ≥ 44px, focus ring accent, label au-dessus pas placeholder.
- **Header** : fixe, blur backdrop, hauteur 64px, logo gauche + 3-5 liens + CTA droite.
- **Section divider** : padding plutôt que ligne. Si ligne : 1px très subtile.
- **Image** : ratio fixe (16:9, 4:3, 1:1), object-fit cover, radius 12-16px.

### Micro-interactions (légères, jamais clinquantes)
- Fade-in 200ms à l'apparition (pas plus).
- Hover boutons : scale 1.02 ou opacity 0.9. Pas de bounce.
- Smooth scroll sur ancres internes uniquement.
- Pas de parallax. Pas d'animations on-scroll lourdes.

### Performance & accessibilité
- LCP < 2.5s. Donc : pas d'image hero > 200kb compressée.
- `<img alt="...">` sur toutes les images.
- Contraste vérifié.
- Tab order logique.
- Bouton CTA : minimum 44x44px de surface tactile.

---

## SKILL 3 — TONE OF VOICE (FR, TPE/PME locale)

- **Vouvoiement** par défaut (sauf coach lifestyle / niche jeune sur demande explicite).
- **Phrases courtes**. 12-18 mots.
- **Pas de jargon** : "boostez", "explosez", "révolutionnez", "next-gen", "AI-powered" → INTERDIT.
- **Concret** > vague. "Site livré en 2 semaines" > "rapide". Mais sans engagement
  ferme côté Symbalyx (cf. règles agence : pas de promesse de délai).
- **Pas de superlatifs** non chiffrés. Si tu dis "le meilleur", il faut une source.
- **Local** : mentionner la ville quand c'est pertinent.

---

## OUTPUT ATTENDU (quand on appelle ce skill)

Quand on injecte ce pack au générateur, demander en sortie :

```json
{
  "site_blueprint": {
    "design_system": {
      "font_heading": "...",
      "font_body": "...",
      "accent_color_hex": "#...",
      "neutral_palette": ["#...", "#...", "#..."],
      "vibe": "1 phrase"
    },
    "layout_sections": [
      {"name": "hero", "h1": "...", "sub": "...", "cta_primary": "...", "cta_secondary_text": "...", "proof": "..."},
      {"name": "pour_qui", "items": [{"persona":"...", "pain":"...", "promise":"..."}]},
      {"name": "comment", "steps": ["...", "..."]},
      {"name": "avis", "testimonials": [{"text":"...", "name":"...", "city":"..."}]},
      {"name": "faq", "items": [{"q":"...", "a":"..."}]},
      {"name": "cta_final", "h2": "...", "cta": "..."},
      {"name": "footer", "columns": [["..."], ["..."], ["..."]]}
    ],
    "tone": "court / chaleureux / sobre / etc.",
    "interdictions": ["pas de stock photos génériques", "..."]
  },
  "review_notes": [
    "self-critique en 3 points : ce qui pourrait clocher ici"
  ],
  "requires_human_validation": true
}
```

---

## Comment l'utiliser

1. **Manuel** : copier ce fichier dans le `system` prompt du générateur de site
   Symbalyx (`index.html` actuel ou outil suivant).
2. **Automatique via WF20** (à câbler) : workflow qui prend un brief de
   `project_queue` et appelle un LLM avec ce skill en `system` + le brief en
   `user`, et stocke le `site_blueprint` dans une nouvelle sheet `site_blueprints`.

## Garde-fous
- Pas de promesse prix/délai/SEO dans le contenu généré.
- `requires_human_validation = true` — Arsène valide avant livraison client.
- Si la niche n'est pas dans le tableau preset, demander en clarification au
  lieu d'inventer.
