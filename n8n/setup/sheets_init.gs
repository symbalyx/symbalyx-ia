/**
 * Symbalyx DB — Init automatique
 *
 * UTILISATION :
 *   1. Ouvre la Google Sheet "Symbalyx DB" (ou crée-en une vide).
 *   2. Extensions → Apps Script → colle ce fichier entier → Enregistrer.
 *   3. Sélectionne la fonction "initSymbalyxDB" dans le menu déroulant.
 *   4. Clique ▶ Exécuter.
 *   5. Autorise les permissions (accès à la feuille en cours).
 *   6. Terminé en ~10 secondes. Tous les onglets sont créés avec leurs en-têtes.
 *
 * IMPORTANT :
 *   - Si un onglet existe déjà, le script le laisse intact (pas d'écrasement).
 *   - Seuls les onglets manquants sont créés.
 *   - Les lignes de seed (Arsène, Kentin, config) ne sont ajoutées
 *     QUE si la feuille est vide après l'en-tête.
 */

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

const TABS = {
  team_members: {
    headers: ['id','name','email','role','initials','color','is_active','created_at','whatsapp_number'],
    seed: [
      ['tm_arsene','Arsène','arsene@symbalyx.com','founder','AR','#3a86ff','TRUE', today(), ''],
      ['tm_kentin','Kentin','kentin@symbalyx.com','admin',  'KE','#ff8c42','TRUE', today(), ''],
    ]
  },
  business_control: {
    headers: [
      'id','ts','run_id','source_workflow','item_type','item_id','title',
      'recommendation','recommended_action','priority_score','priority_level',
      'expected_impact','effort_level','assigned_to','assignee_id',
      'requires_human_validation','decision_status','decided_by','decider_id',
      'decided_at','notes'
    ],
    seed: []
  },
  memory_decisions: {
    headers: [
      'id','ts','bcl_id','item_type','item_id','recommended_action',
      'ai_initial_priority','decision','decided_by','decider_id',
      'reason','outcome','outcome_observed_at'
    ],
    seed: []
  },
  team_comments: {
    headers: ['id','ts','item_type','item_id','author','author_id','body','resolved','parent_id'],
    seed: []
  },
  config: {
    headers: ['key','value','notes'],
    seed: [
      ['KILL_SWITCH','false','stop tout si true'],
      ['MAX_BATCH','30','limite par run'],
    ]
  },
  logs: {
    headers: ['ts','prospect_id','phase','status','level','message','meta'],
    seed: []
  },
  // Onglets pour les workflows de prospection (créés vides, remplis par n8n)
  review_queue: {
    headers: [
      'id','ts','run_id','prospect_id','company_name','contact_name','email',
      'phone','niche','source','status','assigned_to','assignee_id','notes','created_at'
    ],
    seed: []
  },
  project_queue: {
    headers: [
      'id','ts','prospect_id','company_name','project_type','budget_estimate',
      'status','assigned_to','assignee_id','started_at','delivered_at','notes'
    ],
    seed: []
  },
  kpi_snapshots: {
    headers: [
      'id','ts','run_id','metric_name','metric_value','period','source_workflow','notes'
    ],
    seed: []
  },
  notifications_inbox: {
    headers: [
      'id','ts','type','title','body','item_type','item_id',
      'for_member_id','read','read_at'
    ],
    seed: []
  },
  invoices: {
    headers: [
      'id','ts','project_id','client_name','amount_ht','currency','status',
      'sent_at','paid_at','stripe_id','notes'
    ],
    seed: []
  },
  // Tables mémoire long-terme pour les LLMs
  memory_prospects: {
    headers: [
      'id','prospect_id','company_name','niche','last_contact_ts',
      'total_touches','outcome','notes','updated_at'
    ],
    seed: []
  },
  memory_niches: {
    headers: [
      'id','niche','total_contacted','total_interested','total_converted',
      'avg_response_rate','best_angle','notes','updated_at'
    ],
    seed: []
  },
  // Finance (V8.3)
  finance_ledger: {
    headers: [
      'id','ts','type','amount','currency','category','description',
      'status','due_date','paid_at','created_by','created_by_id',
      'decided_at','vendor','invoice_ref','notes'
    ],
    seed: []
  },
  wishlist: {
    headers: [
      'id','ts','item','category','price_estimate','priority',
      'justification','recommended_by','recommended_by_id',
      'decided','decided_at','decided_by','decided_by_id',
      'linked_ledger_id','notes'
    ],
    seed: []
  },
  // WhatsApp bot (V8.3, optionnel)
  whatsapp_log: {
    headers: [
      'id','ts','direction','from_number','to_number','member_id',
      'intent','raw_message','parsed_args','response','status','error','trace_id'
    ],
    seed: []
  },
  // Bot-to-bot inter-workflow communication (V8.4)
  agent_messages: {
    headers: [
      'id','ts','from_workflow','to_workflow','level','title','body',
      'item_type','item_id','escalated_to_human',
      'acknowledged_by','acknowledged_at','trace_id'
    ],
    seed: []
  },
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function initSymbalyxDB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existingSheets = {};
  ss.getSheets().forEach(s => { existingSheets[s.getName()] = s; });

  let created = 0;
  let skipped = 0;

  for (const [tabName, cfg] of Object.entries(TABS)) {
    let sheet = existingSheets[tabName];
    let isNew = false;

    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      isNew = true;
      created++;
      Logger.log(`✓ Créé : ${tabName}`);
    } else {
      skipped++;
      Logger.log(`→ Existant (ignoré) : ${tabName}`);
    }

    // En-tête : toujours sur row 1 si la feuille est neuve
    if (isNew) {
      sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
      sheet.getRange(1, 1, 1, cfg.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);

      // Seed data si définie
      if (cfg.seed && cfg.seed.length > 0) {
        sheet.getRange(2, 1, cfg.seed.length, cfg.headers.length).setValues(cfg.seed);
        Logger.log(`  → ${cfg.seed.length} ligne(s) de seed ajoutée(s)`);
      }
    }
  }

  // Supprimer "Feuille 1" / "Sheet1" si elle est vide et qu'on en a créé d'autres
  const defaultSheet = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
    Logger.log('→ Feuille par défaut vide supprimée');
  }

  const msg = `Symbalyx DB initialisée !\n${created} onglet(s) créé(s), ${skipped} existant(s) ignoré(s).\n\nProchaine étape : copie l'ID de cette Sheet depuis l'URL et colle-le dans n8n.`;
  SpreadsheetApp.getUi().alert('✅ ' + msg);
  Logger.log(msg);
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
