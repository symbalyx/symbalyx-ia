---
name: symbalyx-email-draft
description: Draft professional French replies and cold emails for prospects, clients, and team. Generates 2 variants (concise + warmer), lists assumptions, asks clarifying questions before sending. Use when a prospect replies (interested/needs_quote/objection), when relaunching cold leads, or composing client updates. Adapté pour Symbalyx (web agency 2 personnes).
compatibility: Requires Anthropic API (Claude 4.7) + Gmail OAuth in n8n
metadata:
  author: symbalyx
  version: "1.0"
  consumes: review_queue rows with reply_received, business_control rows with item_type=prospect
  produces: Gmail drafts (never auto-sent)
allowed-tools: anthropic-chat, gmail-drafts-create
---

# Email Draft Skill (Symbalyx)

Génère des brouillons d'emails contextuels en français pro, avec deux tons et une transparence sur les hypothèses faites.

Adapté du format `gog-email-draft` officiel, intégré au pipeline Symbalyx.

## When to Use

- WF4 reply_classifier marque un prospect `interested` ou `needs_quote` → drafter une réponse
- Relance d'un lead "no_reply > 14j"
- Update client en cours de projet (jalon, retard, livrable)
- Demande l'utilisateur dans le CRM : "draft une réponse à p_0042"

## Inputs You Need

### Pour une réponse
- `email_id` Gmail OU thread_id
- Contexte du prospect (extrait de `review_queue` + `memory_prospects`) :
  - `company_name`, `niche`, `city`
  - Historique : combien de touches, dernier outcome
  - `reply_category` (interested / needs_quote / objection / not_interested)

### Pour un cold ou relance
- Cible : `email`, `company_name`, `niche`
- Contexte : raison du contact (mini-audit, niche fit, signal détecté)
- Historique : a-t-on déjà envoyé X il y a Y jours ?

## Workflow

### 1. Fetch contexte

```bash
# Email original
gmail.get(email_id)
# Mémoire prospect
sheets.read('memory_prospects', filter: { prospect_id: id })
```

### 2. Compose system prompt

```
Tu es l'assistant email d'Arsène et Kentin (Symbalyx, agence web 2 personnes basée en France).

Style maison :
- Tutoiement si la personne nous a déjà tutoyés, sinon vouvoiement
- Pas de promesse sur le prix / le délai / le SEO
- Pas de "n'hésitez pas à" ni "votre projet me tient à cœur"
- Concret : valeur livrée, prochaine étape, tu disponibilité
- Signature : "Arsène · Symbalyx" ou "Kentin · Symbalyx" selon l'auteur
- Jamais plus de 4 paragraphes
- Si on demande un devis, on propose un appel 20 min d'abord (jamais un prix par email)

Garde-fous :
- Si le prospect est un concurrent direct → flag pour validation humaine
- Si demande tarif : "On chiffre après un appel court pour bien comprendre"
- Si demande délai : "Selon scope, dispo dans 2-4 semaines en général"
```

### 3. Generate 2 variants

**Variant A — Concise** : 3-5 phrases, va droit au but.

**Variant B — Warmer** : 6-9 phrases, plus de contexte, plus humain.

### 4. Output structure (toujours)

```markdown
# Brouillon email — {{subject}}

**À** : {{to}}
**Sujet** : {{subject}}

---

## Variant A — Concise

{{draft_a}}

## Variant B — Warmer

{{draft_b}}

---

## Hypothèses faites

- ...

## Questions à confirmer

1. ...

---

**Prochaines étapes** : choisis A ou B, je sauve en brouillon Gmail. Aucun envoi automatique.
```

### 5. Save draft (jamais send)

Sur confirmation utilisateur :
```bash
gmail.drafts.create({
  to, cc, subject, body: chosen_variant,
  threadId: original_thread_id  // si reply
})
```

Append row dans `logs` : `phase=email_draft, status=saved, prospect_id, draft_id`.

### 6. Si le prospect contient un lien WhatsApp ou téléphone

Suggère en plus : "Veux-tu que je qualifie ce lead par voix via Bland.ai (skill `lead-qualifier-bland`) avant de répondre ?"

## Cas spéciaux

### Prospect "interested"
Variant A focus : remercier + proposer un créneau d'appel 20 min sous 48h.
Variant B : ajouter 1 phrase de contexte (audit du site rapide) + 2 créneaux concrets.

### Prospect "needs_quote"
Refuse poliment de chiffrer par email. Propose un appel court pour cadrer scope.
"On préfère cadrer ensemble 15 min avant de chiffrer, pour ne pas te donner un prix qui dérape."

### Prospect "objection" (trop cher / pas le moment / déjà un site)
Variant A : empathie courte + porte ouverte ("On est là quand le moment sera bon").
Variant B : reformule l'objection + propose une alternative légère (audit gratuit, ressource).

### Cold / relance
Variant A : réveil court ("Toujours d'actualité ?")
Variant B : ajoute un signal observé (ex: "j'ai vu que votre site n'a plus de SSL valide depuis 3 mois").

## Coût estimé

- ~1500 input + 800 output tokens / email
- Sonnet 4.6 : ~0,01 € / draft
- Avec prompt caching : ~0,003 € / draft

Imbattable.

## Garde-fous (strict)

1. **JAMAIS d'envoi automatique**. Le skill crée des brouillons Gmail uniquement.
2. **Toujours 2 variants** + hypothèses + questions visibles.
3. **Pas de promesse** prix / délai / résultat SEO.
4. **Sanitize** : retire emojis si le client est B2B corporate, garde-les si artisan/local.
5. **Audit** : chaque draft génère une ligne `logs` avec phase=email_draft.

## Lecture conjointe

- `skills/lead-qualifier-bland.md` — qualification voix après réponse intéressée
- WF2 (create_draft_after_review) — workflow n8n qui appelle ce skill
- WF4 (reply_classifier) — détecte `interested`/`needs_quote` et déclenche
