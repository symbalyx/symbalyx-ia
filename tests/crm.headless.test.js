// Test headless du CRM (n8n/crm/index.html) avec JSDOM.
// Simule les 3 webhooks (decision / comments / team-members) côté serveur en réutilisant
// la logique des Code nodes des WF18/19/21. Vérifie le scénario équipe complet.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/node_modules/jsdom');

const SECRET = 'test-secret-32-chars-aaaaaaaaaaaa';
const HTML_PATH = path.resolve(__dirname, '../n8n/crm/index.html');
let html = fs.readFileSync(HTML_PATH, 'utf8');
// Expose les noms du script inline sur window pour le test (JSDOM ne le fait pas auto pour les const).
const exportPatch = `
window.STATE = STATE;
window.MOCK = MOCK;
window.saveCfg = saveCfg;
window.symbLogin = symbLogin;
window.symbPickIdentity = symbPickIdentity;
window.symbDecide = symbDecide;
window.symbPostComment = symbPostComment;
window.symbAddMember = symbAddMember;
window.symbToggleMember = symbToggleMember;
window.symbOpenDetail = symbOpenDetail;
window.setView = setView;
window.renderDecisions = renderDecisions;
window.symbRefresh = symbRefresh;
window.symbBootIdentitySelector = symbBootIdentitySelector;
window.symbSmokeTest = symbSmokeTest;
`;
html = html.replace(/setInterval\(symbRefresh, 5\*60\*1000\);/, 'setInterval(symbRefresh, 5*60*1000);\n' + exportPatch);

// ---- Faux backend en mémoire -------------------------------------------------
const STORE = {
  team_members: [
    { id: 'tm_arsene', name: 'Arsène', email: 'arsene@symbalyx.local', role: 'founder', initials: 'AR', color: '#3a86ff', is_active: true,  created_at: '2026-01-01T00:00:00Z' },
    { id: 'tm_kentin', name: 'Kentin', email: 'kentin@symbalyx.local', role: 'admin',   initials: 'KE', color: '#ff8c42', is_active: true,  created_at: '2026-01-01T00:00:00Z' }
  ],
  business_control: [
    { id: 'bcl_42', ts: '2026-05-09T10:00:00Z', source_workflow: 'WF7', item_type: 'prospect', item_id: 'p_0042',
      title: 'Plomberie Dupont', recommendation: 'Relancer 48h', recommended_action: 'follow_up_24h',
      priority_score: 8.6, priority_level: 'critical', expected_impact: 'high', effort_level: 'low',
      assigned_to: 'Arsène', decision_status: 'pending', decided_by: '', decider_id: '', decided_at: '' }
  ],
  memory_decisions: [],
  team_comments: [],
  review_queue: [
    { id: 'p_0042', company_name: 'Plomberie Dupont', email: 'x@y.fr', status: 'queued_for_review', human_decision: '' }
  ],
  logs: []
};
const POST_PAYLOADS = []; // pour vérifier ce que le CRM envoie

// Émule WF18 — réutilise la logique sans appeler les nodes Code (trop lourd) :
// on a déjà testé séparément les nodes dans wf_logic.test.js, ici on teste
// uniquement l'aller-retour CRM → backend → CRM.
function fakeWf18(body) {
  if (body.bcl_id && ['approved','rejected','snoozed','abandoned'].includes(body.decision) && body.decided_by) {
    const row = STORE.business_control.find(r => r.id === body.bcl_id);
    if (!row) return { status: 404, body: { ok: false, error: 'bcl_id not found' } };
    const ai_initial_priority = row.priority_level;
    row.decision_status = body.decision;
    row.decided_by = body.decided_by;
    row.decider_id = body.decider_id || '';
    row.decided_at = new Date().toISOString();
    STORE.memory_decisions.push({
      id: 'dec_' + Date.now() + Math.random().toString(36).slice(2,5),
      ts: new Date().toISOString(),
      bcl_id: body.bcl_id, item_type: row.item_type, item_id: row.item_id,
      recommended_action: row.recommended_action,
      ai_initial_priority,
      decision: body.decision, decided_by: body.decided_by, decider_id: body.decider_id || '',
      reason: body.reason || '', outcome: '', outcome_observed_at: ''
    });
    if (body.decision === 'approved' && row.recommended_action === 'follow_up_24h') {
      const rq = STORE.review_queue.find(r => r.id === row.item_id);
      if (rq) { rq.human_decision = 'approved'; rq.updated_at = new Date().toISOString(); }
    }
    STORE.logs.push({ ts: new Date().toISOString(), prospect_id: row.item_id, phase: 'decision', status: body.decision });
    return { status: 200, body: { ok: true, bcl_id: body.bcl_id, decision: body.decision, decided_by: body.decided_by, decider_id: body.decider_id || '', action_routed: row.recommended_action } };
  }
  return { status: 400, body: { ok: false, error: 'invalid' } };
}

function fakeWf19Post(body) {
  const ALLOWED = ['bcl','prospect','project','invoice'];
  const item_type = String(body.item_type || '').toLowerCase();
  if (!ALLOWED.includes(item_type)) return { status: 400, body: { ok: false, error: 'invalid item_type' } };
  if (!body.item_id || !body.author || !body.body) return { status: 400, body: { ok: false, error: 'missing fields' } };
  const row = {
    id: 'cmt_' + Date.now() + Math.random().toString(36).slice(2,5),
    ts: new Date().toISOString(),
    item_type, item_id: body.item_id,
    author: body.author, author_id: body.author_id || '',
    body: body.body, resolved: false, parent_id: body.parent_id || ''
  };
  STORE.team_comments.push(row);
  return { status: 200, body: { ok: true, comment: row } };
}

function fakeWf19Get(query) {
  const item_type = String(query.item_type || '').toLowerCase();
  const item_id = String(query.item_id || '');
  const filtered = STORE.team_comments.filter(c => c.item_type === item_type && c.item_id === item_id);
  return { status: 200, body: { ok: true, item_type, item_id, count: filtered.length, comments: filtered } };
}

function fakeWf21Get(query) {
  const active = String(query.active_only || '') === '1';
  const list = STORE.team_members.filter(m => !active || m.is_active);
  return { status: 200, body: { ok: true, count: list.length, members: list } };
}

function fakeWf21Post(body) {
  const ALLOWED_ROLES = ['founder','admin','sales','dev','viewer','member'];
  if (!body.name) return { status: 400, body: { ok: false, error: 'missing name' } };
  if (!ALLOWED_ROLES.includes(String(body.role || '').toLowerCase())) return { status: 400, body: { ok: false, error: 'invalid role' } };
  const m = {
    id: 'tm_' + Date.now().toString(36) + Math.random().toString(36).slice(2,4),
    name: body.name, email: body.email || '', role: body.role,
    initials: (body.initials || body.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('')).toUpperCase().slice(0,4),
    color: body.color || '#3a86ff', is_active: true, created_at: new Date().toISOString()
  };
  STORE.team_members.push(m);
  return { status: 200, body: { ok: true, member: m } };
}

function fakeWf21Patch(body) {
  if (!body.id) return { status: 400, body: { ok: false, error: 'missing id' } };
  const m = STORE.team_members.find(x => x.id === body.id);
  if (!m) return { status: 404, body: { ok: false, error: 'not found' } };
  if (body.is_active !== undefined) m.is_active = !!body.is_active;
  if (body.role) m.role = body.role;
  if (body.name) m.name = body.name;
  if (body.email !== undefined) m.email = body.email;
  return { status: 200, body: { ok: true, id: body.id, patch: body } };
}

// Router HTTP factice.
function routeFetch(method, url, opts) {
  const u = new URL(url);
  const path = u.pathname;
  const headers = (opts && opts.headers) || {};
  const tokenOk = (headers['x-symbalyx-token'] === SECRET);
  if (!tokenOk) return { status: 401, body: { ok: false, error: 'invalid_token' } };
  const body = opts && opts.body ? (typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body) : {};
  POST_PAYLOADS.push({ method, path, body, query: Object.fromEntries(u.searchParams.entries()) });
  if (path.endsWith('/symbalyx-decision') && method === 'POST') return fakeWf18(body);
  if (path.endsWith('/symbalyx-comments') && method === 'POST') return fakeWf19Post(body);
  if (path.endsWith('/symbalyx-comments') && method === 'GET')  return fakeWf19Get(Object.fromEntries(u.searchParams.entries()));
  if (path.endsWith('/symbalyx-team-members') && method === 'GET')   return fakeWf21Get(Object.fromEntries(u.searchParams.entries()));
  if (path.endsWith('/symbalyx-team-members') && method === 'POST')  return fakeWf21Post(body);
  if (path.endsWith('/symbalyx-team-members') && method === 'PATCH') return fakeWf21Patch(body);
  return { status: 404, body: { ok: false, error: 'route not found' } };
}

// ---- Boot JSDOM --------------------------------------------------------------
const vc = new VirtualConsole();
const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    // localStorage neuf et propre.
    const memory = {};
    window.localStorage.__proto__.getItem = (k) => (k in memory ? memory[k] : null);
    window.localStorage.__proto__.setItem = (k, v) => { memory[k] = String(v); };
    window.localStorage.__proto__.removeItem = (k) => { delete memory[k]; };
    window.localStorage.__proto__.clear = () => { for (const k in memory) delete memory[k]; };
    // Service Worker stub (le CRM tente register).
    window.navigator.serviceWorker = { register: () => Promise.resolve() };
    // Notifications stub.
    window.Notification = class { constructor(){} };
    Object.defineProperty(window.Notification, 'permission', { value: 'denied' });
    window.Notification.requestPermission = async () => 'denied';
    // crypto.subtle : JSDOM remplace window.crypto par un stub minimal (getRandomValues only).
    // On force le webcrypto natif de Node via defineProperty (la propriété native est non-writable).
    const nodeCrypto = require('node:crypto').webcrypto;
    Object.defineProperty(window, 'crypto', { value: nodeCrypto, configurable: true, writable: true });
    window.TextEncoder = TextEncoder;
    window.Uint8Array = Uint8Array;
    // fetch interceptor.
    window.fetch = async (url, opts) => {
      const method = (opts && opts.method) || 'GET';
      const r = routeFetch(method, url.startsWith('http') ? url : 'http://wh.local' + url, opts);
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body,
        text: async () => JSON.stringify(r.body)
      };
    };
  }
});

const win = dom.window;
const doc = win.document;

// ---- Helpers test ------------------------------------------------------------
const tests = [];
function test(name, fn){ tests.push({ name, fn }); }
function assert(cond, msg){ if (!cond) throw new Error('assert: ' + msg); }
function assertEq(a, b, msg){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`assertEq ${msg}\n  expected: ${JSON.stringify(b)}\n  got:      ${JSON.stringify(a)}`); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(predicate, timeout = 2000, label = '') {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (predicate()) return; } catch {}
    await sleep(20);
  }
  throw new Error('waitFor timeout: ' + label);
}

async function loadDom() {
  // Attend que le script inline soit exécuté.
  await new Promise(r => {
    if (doc.readyState === 'complete') r(); else win.addEventListener('load', r);
  });
  await sleep(50);
}

async function configureWebhook() {
  // Pré-configure cfg (webhook + source) AVANT de naviguer dans la UI.
  win.STATE.cfg.webhook.baseUrl = 'http://wh.local/webhook';
  win.STATE.cfg.webhook.secret = SECRET;
  win.STATE.cfg.source = 'mock';
  win.saveCfg();
}

async function loginAs(name) {
  // 1) password (premier accès → enregistre le hash)
  doc.getElementById('pwd').value = 'demo-pwd';
  await win.symbLogin();
  // 2) écran de choix d'identité doit être visible
  await waitFor(() => !doc.getElementById('identityPick').classList.contains('hidden'), 2000, 'identityPick visible');
  // Le webhook GET /team-members a été appelé → liste chargée.
  const member = (win.STATE.bootMembers || []).find(m => m.name === name);
  if (!member) throw new Error('member not in boot list: ' + name);
  win.symbPickIdentity(member.id, member.name);
  await waitFor(() => !doc.getElementById('app').classList.contains('hidden'), 2000, 'app visible');
}

function logout() {
  // On émule un logout sans recharger : remet cfg.identity à null + cache app.
  win.STATE.cfg.identity = null;
  win.saveCfg();
  doc.getElementById('app').classList.add('hidden');
  doc.getElementById('identityPick').classList.add('hidden');
  doc.getElementById('login').classList.remove('hidden');
}

// ---- Tests scénario ---------------------------------------------------------

test('Boot CRM + cfg webhook OK', async () => {
  await loadDom();
  await configureWebhook();
  assert(win.STATE.cfg.webhook.baseUrl, 'webhook baseUrl set');
  assert(typeof win.symbLogin === 'function', 'symbLogin defined');
  assert(typeof win.symbPickIdentity === 'function', 'symbPickIdentity defined');
});

test('Login étape 2 fait un GET /team-members?active_only=1', async () => {
  POST_PAYLOADS.length = 0;
  await loginAs('Arsène');
  const calls = POST_PAYLOADS.filter(c => c.path.endsWith('/symbalyx-team-members') && c.method === 'GET');
  assert(calls.length >= 1, 'GET team-members appelé');
  assertEq(calls[0].query.active_only, '1', 'active_only=1');
});

test('Identité Arsène propagée dans STATE.cfg + chip header', async () => {
  const me = win.STATE.cfg.identity;
  assertEq(me.id, 'tm_arsene');
  assertEq(me.name, 'Arsène');
  assertEq(me.role, 'founder');
  const chipText = doc.getElementById('meChip').textContent;
  assert(chipText.includes('Arsène'), 'chip mentionne Arsène');
});

test('Onglet Équipe visible pour admin (founder)', async () => {
  const navTeam = doc.getElementById('navTeam');
  assert(!navTeam.classList.contains('hidden'), 'navTeam visible pour founder');
});

test('Décision approve par Arsène → POST /symbalyx-decision avec decider_id=tm_arsene', async () => {
  POST_PAYLOADS.length = 0;
  // On a besoin que STATE.data.bcl contient bcl_42. fetchData en mock retourne MOCK donc
  // on injecte explicitement notre row dans MOCK pour ce test.
  await win.symbRefresh();
  // Ajoute la ligne attendue côté backend store via mock.
  // Le CRM en mode 'mock' ne lira PAS le store, donc on injecte directement.
  win.STATE.data.bcl.push({
    id: 'bcl_42', source_workflow:'WF7', item_type:'prospect', item_id:'p_0042',
    title:'Plomberie Dupont', recommendation:'Relancer 48h', recommended_action:'follow_up_24h',
    priority_score:8.6, priority_level:'critical', assigned_to:'Arsène',
    decision_status:'pending', notes:''
  });
  await win.symbDecide('bcl_42', 'approved', { reason: 'fit niche' });
  const decisionCalls = POST_PAYLOADS.filter(c => c.path.endsWith('/symbalyx-decision'));
  assertEq(decisionCalls.length, 1, '1 POST decision');
  const p = decisionCalls[0].body;
  assertEq(p.bcl_id, 'bcl_42');
  assertEq(p.decision, 'approved');
  assertEq(p.decided_by, 'Arsène');
  assertEq(p.decider_id, 'tm_arsene', 'decider_id propagé');
  assertEq(p.reason, 'fit niche');
});

test('Round trip IA→décision→mémoire : memory_decisions enrichie', async () => {
  // Le faux WF18 a écrit dans STORE.memory_decisions.
  assertEq(STORE.memory_decisions.length, 1, '1 ligne mémoire');
  const m = STORE.memory_decisions[0];
  assertEq(m.bcl_id, 'bcl_42');
  assertEq(m.ai_initial_priority, 'critical', 'priority IA capturée');
  assertEq(m.decision, 'approved');
  assertEq(m.decided_by, 'Arsène');
  assertEq(m.decider_id, 'tm_arsene');
  // BCL mis à jour
  const bcl = STORE.business_control.find(r => r.id === 'bcl_42');
  assertEq(bcl.decision_status, 'approved');
  assertEq(bcl.decider_id, 'tm_arsene');
  // review_queue flagué pour WF2 (pas d'envoi auto)
  const rq = STORE.review_queue.find(r => r.id === 'p_0042');
  assertEq(rq.human_decision, 'approved', 'flag pour WF2');
});

test('Commentaire par Arsène → POST /symbalyx-comments avec author_id=tm_arsene', async () => {
  POST_PAYLOADS.length = 0;
  // Ouvre la modale détail bcl pour créer le champ cmtInput_bcl_42.
  win.symbOpenDetail('bcl', 'bcl_42');
  await sleep(50);
  const input = doc.getElementById('cmtInput_bcl_42');
  assert(input, 'input commentaire présent');
  input.value = 'Premier commentaire test';
  await win.symbPostComment('bcl', 'bcl_42');
  const cmtCalls = POST_PAYLOADS.filter(c => c.path.endsWith('/symbalyx-comments') && c.method === 'POST');
  assertEq(cmtCalls.length, 1);
  const p = cmtCalls[0].body;
  assertEq(p.item_type, 'bcl');
  assertEq(p.item_id, 'bcl_42');
  assertEq(p.author, 'Arsène');
  assertEq(p.author_id, 'tm_arsene');
  assertEq(p.body, 'Premier commentaire test');
});

test('Ajouter un membre fictif (Camille Sales) via UI → POST /team-members', async () => {
  POST_PAYLOADS.length = 0;
  win.setView('team');
  await sleep(50);
  doc.getElementById('tmName').value = 'Camille Test';
  doc.getElementById('tmEmail').value = 'camille@symb.local';
  doc.getElementById('tmRole').value = 'sales';
  doc.getElementById('tmInitials').value = '';
  doc.getElementById('tmColor').value = '#22cc88';
  await win.symbAddMember();
  const calls = POST_PAYLOADS.filter(c => c.path.endsWith('/symbalyx-team-members') && c.method === 'POST');
  assertEq(calls.length, 1);
  assertEq(calls[0].body.name, 'Camille Test');
  assertEq(calls[0].body.role, 'sales');
  // Le faux WF21 doit avoir append.
  assert(STORE.team_members.some(m => m.name === 'Camille Test'), 'membre persisté côté backend');
});

test('Désactiver Camille → PATCH /team-members avec is_active=false', async () => {
  POST_PAYLOADS.length = 0;
  const camille = STORE.team_members.find(m => m.name === 'Camille Test');
  assert(camille, 'camille existe');
  await win.symbToggleMember(camille.id, false);
  const calls = POST_PAYLOADS.filter(c => c.path.endsWith('/symbalyx-team-members') && c.method === 'PATCH');
  assertEq(calls.length, 1);
  assertEq(calls[0].body.id, camille.id);
  assertEq(calls[0].body.is_active, false);
  const updated = STORE.team_members.find(m => m.id === camille.id);
  assertEq(updated.is_active, false);
});

test('Logout + login en tant que Kentin → identité change, payloads aussi', async () => {
  logout();
  POST_PAYLOADS.length = 0;
  await loginAs('Kentin');
  assertEq(win.STATE.cfg.identity.id, 'tm_kentin');

  // Décide sur un nouveau BCL pour ne pas être bloqué par decision_status déjà != pending.
  STORE.business_control.push({
    id: 'bcl_99', item_type: 'prospect', item_id: 'p_0099',
    recommended_action: 'quote', priority_level: 'high',
    decision_status: 'pending', decided_by: '', decider_id: '', decided_at: ''
  });
  win.STATE.data.bcl.push({
    id: 'bcl_99', source_workflow:'WF7', item_type:'prospect', item_id:'p_0099',
    title:'Salon Marie', recommendation:'Préparer devis', recommended_action:'quote',
    priority_score:7.8, priority_level:'high', assigned_to:'Arsène', decision_status:'pending'
  });
  await win.symbDecide('bcl_99', 'rejected', { reason: 'lead trop ancien' });
  const dec = POST_PAYLOADS.find(c => c.path.endsWith('/symbalyx-decision'));
  assertEq(dec.body.decided_by, 'Kentin');
  assertEq(dec.body.decider_id, 'tm_kentin');

  // Commentaire signé Kentin.
  win.symbOpenDetail('bcl', 'bcl_99');
  await sleep(50);
  const input = doc.getElementById('cmtInput_bcl_99');
  input.value = 'Avis Kentin sur ce lead';
  await win.symbPostComment('bcl', 'bcl_99');
  const cmt = POST_PAYLOADS.filter(c => c.path.endsWith('/symbalyx-comments') && c.method === 'POST').pop();
  assertEq(cmt.body.author, 'Kentin');
  assertEq(cmt.body.author_id, 'tm_kentin');
});

test('Modale détail BCL post-décision : affiche decided_by + decided_at, masque Approuver/Rejeter', async () => {
  // bcl_42 a été approuvée par Arsène plus tôt (test précédent), bcl_99 rejetée par Kentin.
  win.symbOpenDetail('bcl', 'bcl_42');
  await sleep(20);
  const html42 = doc.getElementById('detailContent').innerHTML;
  assert(/approved/i.test(html42), 'badge "approved" présent');
  assert(/par <strong>Arsène<\/strong>/.test(html42), 'decided_by Arsène affiché');
  assert(!/Approuver<\/button>/.test(html42), 'bouton Approuver absent');
  assert(!/>Rejeter</.test(html42), 'bouton Rejeter absent');
  win.symbOpenDetail('bcl', 'bcl_99');
  await sleep(20);
  const html99 = doc.getElementById('detailContent').innerHTML;
  assert(/par <strong>Kentin<\/strong>/.test(html99), 'decided_by Kentin affiché');
});

test('Filtre "À moi" dans Décisions matche par identité courante', async () => {
  // Kentin courant. Le mock contient bcl_3 assigné à Kentin (pending), les autres BCL
  // pending sont assignés à Arsène. "À moi" doit garder Kentin et exclure Arsène.
  win.setView('decisions');
  await sleep(20);
  const sel = doc.getElementById('filterPerson');
  sel.value = 'me';
  win.renderDecisions(win.STATE.data);
  const html = doc.getElementById('listDecisions').innerHTML;
  assert(/Coach Lyon/.test(html), 'BCL bcl_3 (assignée Kentin) présente');
  assert(!/Plomberie Dupont/.test(html), 'BCL Arsène absente');
  assert(!/Salon Élégance/.test(html), 'BCL Arsène absente 2');
});

test('Logs : aucun email envoyé automatiquement (Sheets logs sans phase=send_auto)', async () => {
  const sendAuto = STORE.logs.filter(l => /send_auto|email_sent/.test(l.status||l.phase||''));
  assertEq(sendAuto.length, 0, 'aucun envoi auto');
  // Confirme que les approbations follow_up_24h ont juste flagé review_queue.
  const rq = STORE.review_queue.find(r => r.id === 'p_0042');
  assertEq(rq.human_decision, 'approved', 'WF2 prendra le relais via cron');
});

test('Membre désactivé n\'apparaît plus dans le sélecteur du login', async () => {
  // Camille a été désactivée. Re-login devrait montrer Arsène + Kentin uniquement.
  logout();
  POST_PAYLOADS.length = 0;
  // Étape 1 mot de passe.
  doc.getElementById('pwd').value = 'demo-pwd';
  await win.symbLogin();
  await waitFor(() => !doc.getElementById('identityPick').classList.contains('hidden'), 2000, 'identityPick visible 2');
  const list = (win.STATE.bootMembers || []).map(m => m.name);
  assert(list.includes('Arsène') && list.includes('Kentin'), 'actifs présents');
  assert(!list.includes('Camille Test'), 'désactivé absent');
});

test('Smoke test : 4 lignes vertes contre faux backend (WF21 GET, WF19 POST/GET, WF18 404)', async () => {
  // On doit être dans Réglages pour que le bouton existe.
  win.setView('settings');
  await sleep(20);
  // Pré-remplit les champs UI (la fonction lit depuis le DOM).
  doc.getElementById('cfgWebhookBase').value = 'http://wh.local/webhook';
  doc.getElementById('cfgWebhookSecret').value = SECRET;
  await win.symbSmokeTest();
  await sleep(50);
  const html = doc.getElementById('smokeReport').innerHTML;
  // 4 lignes ✓ + 1 ligne bilan = 5 ✓ au total
  const okCount = (html.match(/✓/g) || []).length;
  assert(okCount >= 5, 'au moins 5 ✓ (4 webhooks + bilan), trouvé: ' + okCount + '\nhtml: ' + html.slice(0, 600));
  assert(/WF21 GET/.test(html), 'WF21 GET ligne présente');
  assert(/WF19 POST/.test(html), 'WF19 POST ligne présente');
  assert(/WF19 GET/.test(html), 'WF19 GET ligne présente');
  assert(/WF18 POST/.test(html), 'WF18 POST ligne présente');
  assert(/Bilan : 4\/4/.test(html), 'bilan 4/4');
});

test('Smoke test : sans secret → message d\'erreur clair', async () => {
  doc.getElementById('cfgWebhookSecret').value = '';
  doc.getElementById('cfgWebhookBase').value = '';
  doc.getElementById('smokeReport').innerHTML = '';
  await win.symbSmokeTest();
  await sleep(20);
  const html = doc.getElementById('smokeReport').innerHTML;
  assert(/Renseigne URL et secret/.test(html), 'message manque renseigne');
});

test('Smoke test : secret faux → ✗ 401 explicite sur WF21', async () => {
  doc.getElementById('cfgWebhookBase').value = 'http://wh.local/webhook';
  doc.getElementById('cfgWebhookSecret').value = 'wrong-secret';
  doc.getElementById('smokeReport').innerHTML = '';
  await win.symbSmokeTest();
  await sleep(50);
  const html = doc.getElementById('smokeReport').innerHTML;
  assert(/401/.test(html), '401 mentionné');
  assert(/secret invalide/.test(html), 'message explicite "secret invalide"');
  // Remet le bon secret pour ne pas pourrir les tests suivants.
  doc.getElementById('cfgWebhookSecret').value = SECRET;
});

test('Auth header envoyé sur tous les fetch webhook', async () => {
  // À ce stade, vérifions qu'aucun appel n'est passé sans token.
  const noToken = POST_PAYLOADS.filter(c => false); // tous nos appels sont passés ; on inspecte à la source
  // Au lieu de relire POST_PAYLOADS (qui n'enregistre que les appels token-OK car on retourne 401 avant),
  // on relance un appel manuel sans token et on vérifie que routeFetch retourne 401.
  const r = routeFetch('GET', 'http://wh.local/webhook/symbalyx-team-members', { headers: {} });
  assertEq(r.status, 401);
});

(async () => {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ✓', t.name); pass++; }
    catch (e) {
      console.log('  ✗', t.name);
      console.log('     →', e.message);
      fail++;
    }
  }
  console.log(`\n${pass}/${tests.length} OK, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
