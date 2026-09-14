const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const flowJs = fs.readFileSync('assets/flow.js', 'utf8');

function boot(t, hash = '') {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(html, {url:'https://example.test/'+hash, runScripts:'dangerously', virtualConsole:console});
  dom.window.eval(fs.readFileSync('assets/workspace.js', 'utf8'));
  dom.window.eval(flowJs);
  t.after(() => {dom.window.close(); assert.deepEqual(errors, []);});
  return dom.window;
}

function overdueLead(extra) {
  return Object.assign({
    id: 101,
    name: 'Overdue Clinic',
    businessType: 'Clinic',
    source: 'warm — local business',
    status: 'message sent',
    channel: 'WhatsApp',
    nextAction: 'Follow up',
    nextActionDate: '2020-01-01',
    value: 35,
    notes: ''
  }, extra);
}

test('automations tab is a first-class workspace view', t => {
  const w = boot(t);
  w.quickUnlock();
  w.switchTab('flow');
  assert.equal(w.location.hash, '#flow');
  assert.equal(w.document.getElementById('tab-flow').style.display, 'block');
  assert.match(w.document.getElementById('flowApp').textContent, /No n8n knowledge needed/);
  assert.match(w.document.getElementById('flowApp').textContent, /WHEN/);
});

test('learn view explains n8n in plain language', t => {
  const w = boot(t);
  w.quickUnlock();
  w.switchTab('flow');
  w.TRLFlow.page('learn');
  const text = w.document.getElementById('flowApp').textContent;
  assert.match(text, /n8n/);
  assert.match(text, /trigger/);
  assert.match(text, /Nothing is sent to the cloud|no cloud/i);
});

test('ready-made recipe installs into local storage and stays off', t => {
  const w = boot(t);
  w.quickUnlock();
  const wf = w.TRLFlow.installTemplate('never-forget');
  assert.equal(wf.enabled, false);
  assert.ok(wf.nodes.some(n => n.type === 'trigger.overdue'));
  assert.ok(wf.nodes.some(n => n.type === 'action.setPriority'));
  const stored = JSON.parse(w.localStorage.getItem('trl-flows-v1'));
  assert.equal(stored.workflows[0].name, 'Follow-up never forgets');
});

test('overdue recipe marks matching leads High without touching others', t => {
  const w = boot(t);
  w.quickUnlock();
  w.setLeads([
    overdueLead(),
    {id:202, name:'Fresh Lead', status:'not contacted', nextAction:'Send Day-1', nextActionDate:'2099-01-01'}
  ]);
  const wf = w.TRLFlow.installTemplate('never-forget');
  const result = w.TRLFlow.executeAndSave(wf, {event:'manual'});
  assert.equal(result.targets, 1);
  assert.equal(result.mutated, true);
  const leads = JSON.parse(w.localStorage.getItem('trl-lead-os-v1'));
  assert.equal(leads.find(l => l.id === 101).priority, 'High');
  assert.notEqual(leads.find(l => l.id === 202).priority, 'High');
});

test('preview runs the graph but does not write lead changes', t => {
  const w = boot(t);
  w.quickUnlock();
  w.setLeads([overdueLead({priority:'Low'})]);
  const wf = w.TRLFlow.installTemplate('never-forget');
  w.TRLFlow.executeAndSave(wf, {event:'preview', preview:true});
  const leads = JSON.parse(w.localStorage.getItem('trl-lead-os-v1'));
  assert.equal(leads[0].priority, 'Low');
});

test('saving a new lead fires an enabled Day-1 flow', t => {
  const w = boot(t);
  w.quickUnlock();
  const wf = w.TRLFlow.installTemplate('day1', {enabled:true});
  assert.equal(wf.enabled, true);
  w.openModal();
  w.document.getElementById('fName').value = 'Ayesha Khan';
  w.document.getElementById('fNext').value = 'Placeholder';
  w.document.getElementById('fDate').value = '2026-01-01';
  w.saveLead();
  const leads = JSON.parse(w.localStorage.getItem('trl-lead-os-v1'));
  assert.equal(leads.length, 1);
  assert.equal(leads[0].nextAction, 'Send Day-1 message');
  assert.match(leads[0].nextActionDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(leads[0].nextActionDate, '2026-01-01');
});

test('direct link to #flow initialises without errors', t => {
  const w = boot(t, '#flow');
  assert.equal(w.document.getElementById('tab-flow').style.display, 'block');
  assert.ok(w.TRLFlow);
});
