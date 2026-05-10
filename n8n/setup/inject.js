#!/usr/bin/env node
/**
 * Symbalyx — Injection des placeholders dans les workflows n8n
 *
 * UTILISATION :
 *   node n8n/setup/inject.js <GOOGLE_SHEET_ID> <WF00_ID>
 *
 * EXEMPLE :
 *   node n8n/setup/inject.js 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms 12345678
 *
 * RÉSULTAT :
 *   Modifie les fichiers JSON dans n8n/workflows/ directement.
 *   Les fichiers originaux sont sauvegardés dans n8n/workflows/.backup/
 *   avant modification.
 *
 * APRÈS :
 *   Importe les fichiers depuis ton disque dans n8n (File → Import from File).
 *   Plus de remplacement manuel dans l'interface n8n.
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const [,, SHEET_ID, WF00_ID] = process.argv;

if (!SHEET_ID || !WF00_ID) {
  console.error('Usage: node inject.js <GOOGLE_SHEET_ID> <WF00_ID>');
  console.error('');
  console.error('  GOOGLE_SHEET_ID  → l\'ID de ta Google Sheet (depuis l\'URL)');
  console.error('  WF00_ID          → l\'ID du workflow WF00 dans n8n (depuis l\'URL n8n)');
  process.exit(1);
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const BACKUP_DIR    = path.join(WORKFLOWS_DIR, '.backup');

// Seuls les workflows essentiels du smoke test V8
const TARGET_FILES = [
  '00_kill_switch.json',
  '18_decision_executor.json',
  '19_team_sync.json',
  '21_team_members.json',
  '22_outcome_reconciliation.json',
  '99_error_handler.json',
];

const REPLACEMENTS = [
  { from: /GOOGLE_SHEET_ID/g,      to: SHEET_ID },
  { from: /REPLACE_WITH_WF00_ID/g, to: WF00_ID  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(BACKUP_DIR, { recursive: true });

let totalReplacements = 0;
const results = [];

for (const file of TARGET_FILES) {
  const filePath   = path.join(WORKFLOWS_DIR, file);
  const backupPath = path.join(BACKUP_DIR, file);

  if (!fs.existsSync(filePath)) {
    results.push({ file, status: 'MISSING', count: 0 });
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let count   = 0;

  // Backup avant de toucher
  fs.writeFileSync(backupPath, content);

  for (const { from, to } of REPLACEMENTS) {
    const matches = content.match(from);
    if (matches) count += matches.length;
    content = content.replace(from, to);
  }

  if (count > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalReplacements += count;
    results.push({ file, status: 'OK', count });
  } else {
    results.push({ file, status: 'NO_PLACEHOLDER', count: 0 });
  }
}

// ─── Rapport ──────────────────────────────────────────────────────────────────

console.log('');
console.log('Symbalyx — Injection des placeholders');
console.log('═'.repeat(50));
console.log(`  GOOGLE_SHEET_ID → ${SHEET_ID}`);
console.log(`  WF00_ID         → ${WF00_ID}`);
console.log('');

for (const { file, status, count } of results) {
  const icon = status === 'OK' ? '✓' : status === 'MISSING' ? '✗' : '·';
  const label = status === 'OK'
    ? `${count} remplacement(s)`
    : status === 'MISSING'
    ? 'fichier introuvable'
    : 'aucun placeholder';
  console.log(`  ${icon} ${file.padEnd(35)} ${label}`);
}

console.log('');
console.log(`  Total : ${totalReplacements} remplacement(s) dans ${results.filter(r => r.status === 'OK').length} fichier(s)`);
console.log(`  Backups dans : n8n/workflows/.backup/`);
console.log('');

if (totalReplacements > 0) {
  console.log('Prochaine étape :');
  console.log('  1. Dans n8n : Workflows → Import from File');
  console.log('  2. Importe chaque fichier depuis n8n/workflows/');
  console.log('  3. Branche le credential Google Sheets sur chaque workflow');
  console.log('  4. Active les workflows');
  console.log('');
  console.log('✓ Terminé — plus de remplacement manuel dans n8n.');
} else {
  console.log('Aucune modification. Les placeholders sont peut-être déjà remplacés.');
}
