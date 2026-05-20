/* ============================================================
 *  Symbalyx — Données du mode leurre (decoy).
 *  Conversations factices crédibles, affichées quand on
 *  passe le téléphone à un inconnu.
 *
 *  ⚠ ÉDITEZ LIBREMENT pour personnaliser à votre contexte.
 *  Plus c'est cohérent avec votre vie, plus c'est crédible.
 *
 *  Format :
 *    {
 *      id:        identifiant unique
 *      name:      nom affiché
 *      avatar:    1 ou 2 lettres
 *      color:     dégradé d'avatar
 *      lastSeen:  texte d'activité ("il y a 2h", "vu hier", ...)
 *      pinned:    true pour épingler en haut
 *      muted:     true pour afficher icône cloche barrée
 *      messages:  liste {from, text, time, day?}
 *                 from = "me" (vous) ou "them" (l'autre)
 *      autoreply: patterns d'auto-réponses si l'inconnu tape un message
 *  ============================================================
 */
window.DECOY_DATA = {
  myName: "Alex",
  myAvatar: "A",
  conversations: [
    {
      id: "d_mom",
      name: "Maman",
      avatar: "M",
      color: "linear-gradient(135deg, #e8a87c, #c38d9e)",
      lastSeen: "il y a 12 min",
      pinned: true,
      messages: [
        { from: "them", text: "Tu rentres dîner ce soir ?", time: "18:42", day: "Hier" },
        { from: "me",   text: "Oui je serai là vers 19h30", time: "18:45" },
        { from: "them", text: "Super j'ai fait des lasagnes 😊", time: "18:46" },
        { from: "them", text: "N'oublie pas de prendre du pain en passant", time: "18:47" },
        { from: "me",   text: "Ok 👍", time: "18:50" },
        { from: "them", text: "Tu as pensé au RDV chez le Dr Marchand vendredi ?", time: "09:14", day: "Aujourd'hui" },
        { from: "me",   text: "Oui c'est noté, 16h30", time: "09:22" },
        { from: "them", text: "Parfait. Bonne journée mon chéri ❤️", time: "09:23" }
      ],
      autoreply: [
        { match: /merci|merci beaucoup/i, reply: "De rien 😘", delay: 3500 },
        { match: /\boui\b|d'accord|ok/i,  reply: "👍", delay: 2200 },
        { match: /demain|à demain/i,      reply: "À demain mon chéri", delay: 3000 },
        { match: /bisous|coeur|love/i,    reply: "Bisous ❤️", delay: 2800 }
      ]
    },
    {
      id: "d_leo",
      name: "Léo",
      avatar: "L",
      color: "linear-gradient(135deg, #4a90e2, #5fa8d3)",
      lastSeen: "actif·ve",
      messages: [
        { from: "them", text: "Tu es chaud pour le foot samedi ?", time: "Sam.", day: "Cette semaine" },
        { from: "me",   text: "Carrément, à quelle heure ?", time: "Sam." },
        { from: "them", text: "10h au city stade habituel", time: "Sam." },
        { from: "me",   text: "Cool je serai là", time: "Sam." },
        { from: "them", text: "Au fait t'as vu le match hier soir ?", time: "Lun." },
        { from: "me",   text: "Ouais quel scénario de fou", time: "Lun." },
        { from: "them", text: "😂 j'ai pas dormi de la nuit", time: "Lun." }
      ],
      autoreply: [
        { match: /foot|match|stade/i, reply: "On va leur mettre 5-0 🏆", delay: 3000 },
        { match: /\b(salut|hey|yo)\b/i, reply: "Yo ça va ?", delay: 1500 },
        { match: /soirée|weekend/i, reply: "Carrément, je te tiens au jus", delay: 4000 }
      ]
    },
    {
      id: "d_marie",
      name: "Marie · Yoga",
      avatar: "MY",
      color: "linear-gradient(135deg, #b8b0e8, #a3c9e8)",
      lastSeen: "vu hier",
      messages: [
        { from: "them", text: "Bonjour, petit rappel du cours de demain à 18h", time: "11:02", day: "Mardi" },
        { from: "them", text: "N'oubliez pas votre tapis 🧘‍♀️", time: "11:02" },
        { from: "me",   text: "Bien noté merci !", time: "11:14" },
        { from: "them", text: "Planning des cours de la semaine prochaine :\n• Lun 18h Yin\n• Mer 19h Vinyasa\n• Ven 12h30 Pause-déj", time: "16:30", day: "Hier" }
      ],
      autoreply: [
        { match: /annulé|reporter|absent/i, reply: "Pas de souci, on se rattrape la semaine prochaine !", delay: 3500 },
        { match: /question|comment|combien/i, reply: "Je vous appelle demain pour en discuter 🙏", delay: 4000 }
      ]
    },
    {
      id: "d_pressing",
      name: "Pressing Madeleine",
      avatar: "PM",
      color: "linear-gradient(135deg, #2c3e50, #4ca1af)",
      lastSeen: "vu il y a 2 jours",
      messages: [
        { from: "them", text: "Bonjour, votre commande #4821 est prête. Bonne journée.", time: "14:20", day: "Lundi" },
        { from: "me",   text: "Merci je passe demain", time: "14:35" },
        { from: "them", text: "Parfait, à demain.", time: "14:36" }
      ],
      autoreply: [
        { match: /.*/, reply: "Bonjour, nous prenons en compte votre message. Bonne journée.", delay: 5000 }
      ]
    },
    {
      id: "d_amelie",
      name: "Amélie",
      avatar: "AM",
      color: "linear-gradient(135deg, #ff9a9e, #fad0c4)",
      lastSeen: "il y a 3h",
      messages: [
        { from: "them", text: "Hâte de te voir vendredi 😊", time: "22:14", day: "Mercredi" },
        { from: "me",   text: "Moi aussi, on fait quoi ?", time: "22:18" },
        { from: "them", text: "Le resto thaï à côté du parc, ça te dit ?", time: "22:19" },
        { from: "me",   text: "Validé ! 20h ?", time: "22:21" },
        { from: "them", text: "20h parfait 🥰", time: "22:22" },
        { from: "them", text: "Au fait j'ai vu la série dont tu m'avais parlé, c'est génial", time: "13:40", day: "Aujourd'hui" }
      ],
      autoreply: [
        { match: /série|film|cinéma/i, reply: "Faut absolument qu'on en parle 😄", delay: 3000 },
        { match: /resto|restaurant|manger/i, reply: "Tu choisis, je te suis 🍜", delay: 3200 },
        { match: /weekend|samedi|dimanche/i, reply: "Je suis libre, t'as une idée ?", delay: 4000 }
      ]
    },
    {
      id: "d_bank",
      name: "Banque · Conseiller",
      avatar: "BC",
      color: "linear-gradient(135deg, #56ab2f, #a8e063)",
      lastSeen: "vu il y a 5 jours",
      messages: [
        { from: "them", text: "Bonjour, votre virement de 250€ a bien été reçu.", time: "10:12", day: "Vendredi dernier" },
        { from: "them", text: "Cordialement.", time: "10:12" },
        { from: "me",   text: "Merci pour la confirmation", time: "10:30" }
      ]
    },
    {
      id: "d_pharma",
      name: "Pharmacie de la Place",
      avatar: "PP",
      color: "linear-gradient(135deg, #00b09b, #96c93d)",
      lastSeen: "il y a 1 semaine",
      messages: [
        { from: "them", text: "Rappel : votre ordonnance est disponible.", time: "09:00", day: "Lun. dernier" }
      ]
    },
    {
      id: "d_team",
      name: "Équipe projet",
      avatar: "EP",
      color: "linear-gradient(135deg, #667eea, #764ba2)",
      lastSeen: "actif·ve",
      muted: true,
      messages: [
        { from: "them", text: "Sami : Réunion repoussée à 15h", time: "10:45", day: "Aujourd'hui" },
        { from: "them", text: "Camille : Ok pour moi 👍", time: "10:46" },
        { from: "me",   text: "Idem, ça me va", time: "10:48" },
        { from: "them", text: "Sami : Je partage le doc dans 2 min", time: "10:51" },
        { from: "them", text: "Camille : Merci !", time: "10:52" }
      ],
      autoreply: [
        { match: /\?$/, reply: "Camille : Je regarde et je reviens vers toi", delay: 5000 }
      ]
    }
  ]
};
