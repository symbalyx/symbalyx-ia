---
name: symbalyx-lead-qualifier-bland
description: Qualify a hot lead by phone via Bland.ai voice agent. Calls the prospect with a short scripted conversation (3-4 minutes) to confirm budget, timeline, decision-maker status, and project type. Returns a structured qualification report. Use AFTER a prospect replies "interested" but before sending a quote, OR for high-score cold leads where email-only is too slow.
compatibility: Requires Bland.ai API key + a French voice configured
metadata:
  author: symbalyx
  version: "1.0"
  consumes: review_queue rows where reply_category=interested AND opportunity_score >= 7
  produces: lead_qualifications rows + memory_prospects updates
allowed-tools: bland-call, sheets-append, anthropic-chat-summarize
---

# Lead Qualifier — Bland.ai

Externalise la qualification téléphonique d'un lead chaud à un agent vocal IA, en français, en 3-4 minutes. Économise 1 appel humain par lead, le système te livre un compte-rendu actionnable.

## When to Use

Conditions cumulatives :
1. Le prospect a répondu **interested** ou **needs_quote**
2. `opportunity_score >= 7`
3. On a son **téléphone validé** (pas juste une URL "+33 X X X X X")
4. Le prospect est en France métropolitaine ou DOM-TOM
5. Heure légale d'appel : 10h-13h ou 14h-19h (jours ouvrés)

## Inputs

```json
{
  "prospect_id": "p_0042",
  "phone": "+33612345678",
  "company_name": "Plomberie Dupont",
  "first_name": "Marc",        // optionnel mais recommandé
  "niche": "plombier",
  "city": "Bordeaux",
  "context": "site web actuel obsolète, copyright 2017"
}
```

## Conversation flow (script Bland.ai)

```
Bonjour, je suis Camille, l'assistante d'Arsène et Kentin de Symbalyx, est-ce que je parle bien à {{first_name}} ?

[Si oui]
{{first_name}}, tu nous as répondu suite à notre message sur ton site web. On souhaite te qualifier en 3 minutes pour voir si on peut t'aider concrètement, ça te va ?

[Si oui]
1. Aujourd'hui, ton site, c'est plutôt une priorité ce trimestre, ou plus loin dans l'année ?
   → capture: TIMELINE (this_quarter | h2 | next_year | not_priority)

2. Côté budget, sans engagement, tu te vois plutôt sur :
   - moins de 1500 €
   - 1500-3000 €
   - 3000-6000 €
   - plus de 6000 €
   → capture: BUDGET_RANGE

3. Tu décides seul, ou tu impliques quelqu'un d'autre dans le choix (associé, banquier, conjoint) ?
   → capture: DECISION_MAKER (sole | shared | needs_approval)

4. Si on te dit "site vitrine 5 pages + formulaire contact + photos pro fournies par toi" :
   ça matche tes besoins, ou il manque un truc important pour toi ?
   → capture: SCOPE_FIT (good_match | needs_more | wants_less | wrong)

5. Dernière question : tu préfères qu'on te rappelle pour cadrer, ou qu'on t'envoie d'abord 2-3 exemples de sites qu'on a faits dans ta niche ?
   → capture: NEXT_STEP (call | examples_first)

Parfait, je transmets à Arsène ou Kentin. Tu auras des nouvelles {{commit_when}}.
Bonne journée {{first_name}} !
```

**Si refus à la première question** : "Pas de souci, on te rappelle un autre jour. Bonne journée." → fin propre.

## Output schema (lead_qualifications)

```
id, ts, prospect_id, agent (bland|human), phone, duration_sec, completed,
timeline, budget_range, decision_maker, scope_fit, next_step,
qualification_score (1-10), transcript, recording_url, notes
```

## Scoring post-call (Anthropic)

Après l'appel, passe le transcript à Claude pour calculer un `qualification_score` :

```
Tu es analyste commercial. Score de 1 à 10 ce lead selon :
- Timeline serrée (this_quarter = 4 pts, h2 = 2 pts, next_year = 0 pt)
- Budget range cohérent avec scope (3-6k€ = 3 pts, autres = 1 pt)
- Decision maker (sole = 2 pts, shared = 1 pt, needs_approval = 0 pt)
- Scope fit (good_match = 1 pt)
+1 si "next_step = call" (engagement fort)

Output JSON: { score, recommendation: "go_call_now" | "send_examples_first" | "low_priority" | "discard", reasoning }
```

## Workflow n8n (WF51_lead_qualifier)

À créer plus tard. Squelette :

1. Webhook `/symbalyx-qualify` reçoit `{ prospect_id, phone }`
2. Auth + check des conditions (score, timeline, format phone)
3. POST à Bland.ai `/v1/calls` avec le pathway scripted
4. Webhook callback Bland → réceptionne le transcript
5. Claude résume + score → `lead_qualifications`
6. WF40 agent_relay : `level=blocked` + `escalated_to_human=true` si `recommendation=go_call_now`
7. CRM affiche le report dans la fiche prospect

## Coût

- Bland.ai : ~0,09 USD par minute → ~0,30-0,40 € par appel qualifié
- Claude scoring : ~0,01 €
- Total : **~0,40 € pour qualifier un lead à 1500€+ de potentiel**. ROI imbattable.

## Garde-fous

1. **Conformité RGPD** : le prospect t'a explicitement répondu (consent implicite à la suite). Pour un cold, ajoute une clause d'opt-out claire au début.
2. **Heure légale** : ne jamais appeler avant 10h, après 19h, dimanche, jours fériés. Cron + check `nationalHoliday`.
3. **Bloctel** : checker la base Bloctel avant d'appeler en cold (obligation légale française). Pas requis si le prospect t'a déjà contacté.
4. **Transcript = preuve** : conserve 1 an minimum, IP-traçable.
5. **Voix transparente** : Camille dit dès la 1ère phrase "je suis l'assistante de" — pas un humain. Si le prospect demande "tu es un robot ?", la voix répond honnêtement "je suis une IA, mais je transmets bien à Arsène".

## Setup Bland.ai (~30 min)

1. Compte sur **bland.ai** → API key.
2. **Pathways** → New → import le script JSON ci-dessus (Bland a un format JSON pour les conversations branches).
3. Voix : choisis "French Female - Camille" ou similaire.
4. Webhook callback URL : `https://TON-SOUS-DOMAINE.app.n8n.cloud/webhook/bland-callback`.
5. Test en t'appelant toi-même avant de mettre en prod.

## Compatibilité avec le pipeline

```
WF1 (prospection) → WF2 (draft) → [PROSPECT REPLY] → WF4 (classify reply)
   ↓ if interested + score >= 7
WF51 (qualifier-bland) → lead_qualifications
   ↓ if qualification_score >= 7
WF50 (site-builder) bench un mockup pour démo
   ↓
WF18 (decision) → human approves → call client → close
```

## Alternative low-cost

Si Bland.ai trop cher : **Twilio Programmable Voice + custom TTS** (~0,015 €/min) mais demande 1 jour de dev pour répliquer le pathway. Bland.ai vaut son coût pour MVP.
