// Reproduit la logique des Code nodes des workflows WF18/19/21 pour tester la boucle
// décision → mémoire et la synchro équipe sans n8n réel. Lit les workflows JSON et
// extrait le `jsCode` de chaque node nommé pour le rejouer.
const fs = require('fs');
const path = require('path');

const WF_DIR = path.resolve(__dirname, '../n8n/workflows');
const SECRET = 'test-secret-32-chars-aaaaaaaaaaaa';

function loadWf(file){ return JSON.parse(fs.readFileSync(path.join(WF_DIR, file), 'utf8')); }
function nodeByName(wf, name){
  const n = wf.nodes.find(n => n.name === name);
  if (!n) throw new Error('node not found: ' + name);
  return n;
}

// Émule un node Code n8n :
// - $json   = items[0].json
// - items   = tableau d'entrées
// - $env    = env n8n
// - $('NODE').first().json = lookup contextuel
// - retourne la sortie (array<{json}>)
function runCodeNode(jsCode, ctx) {
  const items = ctx.items || [{ json: ctx.input || {} }];
  const $json = items[0].json;
  const $env = ctx.env || {};
  const lookup = ctx.upstream || {};
  function $(name){
    if (!(name in lookup)) throw new Error('upstream not provided in test: ' + name);
    return { first: () => ({ json: lookup[name] }), all: () => lookup[name + '.all'] || [{ json: lookup[name] }] };
  }
  // Wrapper IIFE.
  const fn = new Function('items', '$json', '$env', '$', `${jsCode}`);
  return fn(items, $json, $env, $);
}

const tests = [];
function test(name, fn){ tests.push({ name, fn }); }
function assert(cond, msg){ if (!cond) throw new Error('assert: ' + msg); }
function assertEq(a, b, msg){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`assertEq ${msg}\n  expected: ${JSON.stringify(b)}\n  got:      ${JSON.stringify(a)}`); }

const wf18 = loadWf('18_decision_executor.json');
const wf19 = loadWf('19_team_sync.json');
const wf21 = loadWf('21_team_members.json');

// ==================== WF18 ====================
test('WF18: rejette token absent → 500 (secret missing)', () => {
  const node = nodeByName(wf18, 'Auth & validate');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: {}, body: { bcl_id: 'bcl_1', decision: 'approved', decided_by: 'X' } },
    env: {}
  });
  assertEq(out[0].json._ok, false, 'should fail');
  assertEq(out[0].json._status, 500, 'should be 500');
});

test('WF18: rejette token invalide → 401', () => {
  const node = nodeByName(wf18, 'Auth & validate');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': 'wrong' }, body: { bcl_id: 'bcl_1', decision: 'approved', decided_by: 'X' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._status, 401, 'should be 401');
});

test('WF18: rejette decision invalide → 400', () => {
  const node = nodeByName(wf18, 'Auth & validate');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { bcl_id: 'bcl_1', decision: 'maybe', decided_by: 'X' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, false);
  assertEq(out[0].json._status, 400);
  assert(/invalid decision/.test(out[0].json._error), 'error mentions decision');
});

test('WF18: rejette decided_by manquant → 400', () => {
  const node = nodeByName(wf18, 'Auth & validate');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { bcl_id: 'bcl_1', decision: 'approved' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._status, 400);
});

test('WF18: payload valide → ok + decider_id propagé', () => {
  const node = nodeByName(wf18, 'Auth & validate');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { bcl_id: 'bcl_42', decision: 'approved', decided_by: 'Arsène', decider_id: 'tm_arsene', reason: 'fit niche' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, true);
  assertEq(out[0].json.bcl_id, 'bcl_42');
  assertEq(out[0].json.decision, 'approved');
  assertEq(out[0].json.decided_by, 'Arsène');
  assertEq(out[0].json.decider_id, 'tm_arsene');
  assertEq(out[0].json.reason, 'fit niche');
});

test('WF18: Find row & snapshot capture ai_initial_priority depuis BCL', () => {
  const node = nodeByName(wf18, 'Find row & snapshot');
  const bclRows = [
    { id: 'bcl_42', item_type: 'prospect', item_id: 'p_0042', recommended_action: 'follow_up_24h', priority_level: 'critical', title: 'Plomberie X', email: 'x@y.fr', decision_status: 'pending' },
    { id: 'bcl_99', item_type: 'project', item_id: 'proj_99', recommended_action: 'schedule', priority_level: 'medium' }
  ];
  const out = runCodeNode(node.parameters.jsCode, {
    items: bclRows.map(r => ({ json: r })),
    upstream: { 'Auth & validate': { bcl_id: 'bcl_42', decision: 'approved', decided_by: 'Arsène', decider_id: 'tm_arsene', reason: 'fit' } }
  });
  assertEq(out[0].json._ok, true);
  assertEq(out[0].json.ai_initial_priority, 'critical', 'priority captured before update');
  assertEq(out[0].json.recommended_action, 'follow_up_24h');
  assertEq(out[0].json.item_type, 'prospect');
  assertEq(out[0].json.item_id, 'p_0042');
  assertEq(out[0].json.decider_id, 'tm_arsene');
});

test('WF18: bcl_id introuvable → _ok false / 404', () => {
  const node = nodeByName(wf18, 'Find row & snapshot');
  const out = runCodeNode(node.parameters.jsCode, {
    items: [{ json: { id: 'bcl_other' } }],
    upstream: { 'Auth & validate': { bcl_id: 'bcl_42', decision: 'approved', decided_by: 'Arsène', decider_id: '', reason: '' } }
  });
  assertEq(out[0].json._ok, false);
  assertEq(out[0].json._status, 404);
});

test('WF18: Build memory_decision row contient tous les champs critiques', () => {
  const node = nodeByName(wf18, 'Build memory_decision row');
  const snapshot = {
    bcl_id: 'bcl_42', item_type: 'prospect', item_id: 'p_0042',
    recommended_action: 'follow_up_24h', ai_initial_priority: 'critical',
    decision: 'approved', decided_by: 'Arsène', decider_id: 'tm_arsene', reason: 'fit'
  };
  const out = runCodeNode(node.parameters.jsCode, {
    input: { /* anything */ irrelevant: true },
    upstream: { 'Find row & snapshot': snapshot }
  });
  const row = out[0].json;
  for (const k of ['id','ts','bcl_id','item_type','item_id','recommended_action','ai_initial_priority','decision','decided_by','decider_id','reason','outcome','outcome_observed_at']) {
    assert(k in row, 'missing key ' + k);
  }
  assertEq(row.bcl_id, 'bcl_42');
  assertEq(row.ai_initial_priority, 'critical');
  assertEq(row.decider_id, 'tm_arsene');
  assert(row.id.startsWith('dec_'), 'id prefix');
  assert(/T\d/.test(row.ts), 'ts is iso');
});

// ==================== WF19 ====================
test('WF19 POST: payload valide avec author_id', () => {
  const node = nodeByName(wf19, 'Auth & validate POST');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { item_type: 'BCL', item_id: 'bcl_42', author: 'Arsène', author_id: 'tm_arsene', body: 'à relancer demain matin' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, true);
  assertEq(out[0].json.item_type, 'bcl', 'lowercased');
  assertEq(out[0].json.author_id, 'tm_arsene');
});

test('WF19 POST: refuse item_type hors liste', () => {
  const node = nodeByName(wf19, 'Auth & validate POST');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { item_type: 'unknown', item_id: 'x', author: 'A', body: 'hi' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, false);
  assertEq(out[0].json._status, 400);
});

test('WF19 POST: refuse body > 2000 chars', () => {
  const node = nodeByName(wf19, 'Auth & validate POST');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { item_type: 'bcl', item_id: 'x', author: 'A', body: 'a'.repeat(2001) } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, false);
});

test('WF19 Build comment row stocke author_id', () => {
  const node = nodeByName(wf19, 'Build comment row');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { item_type: 'bcl', item_id: 'bcl_42', author: 'Arsène', author_id: 'tm_arsene', body: 'go' }
  });
  const row = out[0].json;
  assertEq(row.author_id, 'tm_arsene');
  assertEq(row.author, 'Arsène');
  assert(row.id.startsWith('cmt_'));
});

test('WF19 GET filter par item', () => {
  const auth = nodeByName(wf19, 'Auth & validate GET');
  const filter = nodeByName(wf19, 'Filter & sort');
  const authOut = runCodeNode(auth.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, query: { item_type: 'bcl', item_id: 'bcl_42' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(authOut[0].json._ok, true);
  const all = [
    { item_type: 'bcl', item_id: 'bcl_42', author: 'A', body: 'old', ts: '2026-01-01T00:00:00Z' },
    { item_type: 'bcl', item_id: 'bcl_42', author: 'K', body: 'new', ts: '2026-02-01T00:00:00Z' },
    { item_type: 'project', item_id: 'proj_1', author: 'A', body: 'other', ts: '2026-02-15T00:00:00Z' }
  ];
  const out = runCodeNode(filter.parameters.jsCode, {
    items: all.map(r => ({ json: r })),
    upstream: { 'Auth & validate GET': authOut[0].json }
  });
  assertEq(out[0].json.count, 2);
  assertEq(out[0].json.comments.map(c => c.body), ['old', 'new']);
});

// ==================== WF21 ====================
test('WF21 POST: génère id + initiales auto + couleur défaut', () => {
  const node = nodeByName(wf21, 'Auth & build POST');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { name: 'Camille Dubois', email: 'cd@symb.local', role: 'sales' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, true);
  const m = out[0].json;
  assert(m.id.startsWith('tm_'), 'id prefix');
  assertEq(m.initials, 'CD');
  assertEq(m.role, 'sales');
  assertEq(m.is_active, true);
  assertEq(m.color, '#3a86ff');
});

test('WF21 POST: respecte initiales fournies', () => {
  const node = nodeByName(wf21, 'Auth & build POST');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { name: 'X Y', role: 'dev', initials: 'xy', color: '#ff8c42' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json.initials, 'XY', 'uppercased');
  assertEq(out[0].json.color, '#ff8c42');
});

test('WF21 POST: rôle invalide → 400', () => {
  const node = nodeByName(wf21, 'Auth & build POST');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { name: 'X', role: 'pirate' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, false);
});

test('WF21 POST: email invalide → 400', () => {
  const node = nodeByName(wf21, 'Auth & build POST');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { name: 'X', email: 'pasok', role: 'sales' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, false);
});

test('WF21 PATCH: désactiver un membre', () => {
  const node = nodeByName(wf21, 'Auth & build PATCH');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { id: 'tm_arsene', is_active: false } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, true);
  assertEq(out[0].json.id, 'tm_arsene');
  assertEq(out[0].json.patch.is_active, false);
});

test('WF21 PATCH: id manquant → 400', () => {
  const node = nodeByName(wf21, 'Auth & build PATCH');
  const out = runCodeNode(node.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, body: { is_active: false } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  assertEq(out[0].json._ok, false);
});

test('WF21 GET active_only filtre les inactifs', () => {
  const auth = nodeByName(wf21, 'Auth GET');
  const filt = nodeByName(wf21, 'Filter active');
  const authOut = runCodeNode(auth.parameters.jsCode, {
    input: { headers: { 'x-symbalyx-token': SECRET }, query: { active_only: '1' } },
    env: { SYMBALYX_WEBHOOK_SECRET: SECRET }
  });
  const rows = [
    { id: 'tm_a', name: 'Arsène', role: 'founder', is_active: 'TRUE' },
    { id: 'tm_k', name: 'Kentin', role: 'admin', is_active: 'FALSE' }
  ];
  const out = runCodeNode(filt.parameters.jsCode, {
    items: rows.map(r => ({ json: r })),
    upstream: { 'Auth GET': authOut[0].json }
  });
  assertEq(out[0].json.count, 1);
  assertEq(out[0].json.members[0].name, 'Arsène');
  assertEq(out[0].json.members[0].is_active, true, 'normalized to bool');
});

// ==================== Run ====================
let pass = 0, fail = 0;
const failures = [];
for (const t of tests) {
  try { t.fn(); console.log('  ✓', t.name); pass++; }
  catch (e) { console.log('  ✗', t.name, '\n     →', e.message); failures.push({ name: t.name, err: e.message }); fail++; }
}
console.log(`\n${pass}/${tests.length} OK, ${fail} fail`);
if (fail) process.exit(1);
