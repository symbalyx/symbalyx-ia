# Architecture cible Symbalyx IA

## Version actuelle

`index.html` contient l'interface autonome :

- chat central
- cards prospects dynamiques
- todo intelligente Arsène/Kentin
- scores
- payload Make copiable
- boutons métier
- règles sécurité visibles

## Version branchée réelle

Flux recommandé :

```txt
Symbalyx IA
   ↓
Webhook Make
   ↓
Checks sécurité Make
   ↓
Google Sheets CRM
   ↓
Gmail Create Draft
   ↓
Réponse Make vers l'interface
```

## Brancher progressivement

Ordre recommandé :

1. Bouton Préparer -> Make -> Sheets -> Gmail Draft.
2. Bouton Mini-audit gratuit.
3. Bouton Pitch téléphone.
4. Google Places pour chercher des prospects publics.
5. Gemini pour améliorer la rédaction.
6. Historique réel persistant.
7. Login privé propre.

## Rôles

Arsène : sites, design, HTML/CSS, SEO, livraison client, commercial.

Kentin : recherche, tests, Make, API, Google Sheets, QA technique.

Ne pas inverser les rôles.
