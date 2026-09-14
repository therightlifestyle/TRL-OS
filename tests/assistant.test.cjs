const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

function boot(t) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(html, {url:'https://example.test/', runScripts:'dangerously', virtualConsole:console});
  dom.window.eval(fs.readFileSync('assets/workspace.js', 'utf8'));
  dom.window.eval(fs.readFileSync('assets/assistant.js', 'utf8'));
  t.after(() => {dom.window.close(); assert.deepEqual(errors, []);});
  return dom.window;
}

test('assistant answers today, overdue, flow and drafts without keyword gates', t => {
  const w = boot(t);
  w.quickUnlock();
  w.setLeads([{
    id: 7,
    name: 'Al-Falah Clinic',
    businessType: 'Clinic',
    status: 'message sent',
    nextAction: 'Follow up',
    nextActionDate: '2020-01-01',
    source: 'warm — local business',
    channel: 'WhatsApp'
  }]);
  const today = w.generateAgentReply('What should I do today?', 'chief');
  assert.match(today, /overdue/i);
  assert.doesNotMatch(today, /Ask clearer/);
  const overdue = w.generateAgentReply('who is overdue?', 'ops');
  assert.match(overdue, /Al-Falah Clinic/);
  const flow = w.generateAgentReply("explain flow like I don't know n8n", 'builder');
  assert.match(flow, /n8n/i);
  assert.match(flow, /When/i);
  const draft = w.generateAgentReply('draft a Day-1 WhatsApp', 'sales');
  assert.match(draft, /Hi /);
  assert.match(draft, /does not send WhatsApp/);
  const help = w.generateAgentReply('what can you help with?');
  assert.match(help, /pipeline/i);
  assert.match(help, /Flow/);
});

test('assistant looks up a named lead and never dumps the old fallback', t => {
  const w = boot(t);
  w.quickUnlock();
  w.setLeads([{
    id: 9,
    name: 'Ayesha Khan',
    businessType: 'Salon',
    status: 'replied',
    nextAction: 'Book a call',
    nextActionDate: '2099-01-01'
  }]);
  const r = w.TRLAssistant.reply('What should I do about Ayesha Khan?', 'sales');
  assert.match(r.text, /Ayesha Khan/);
  assert.match(r.text, /replied/);
  assert.ok(r.actions.some(a => a.kind === 'edit'));
  const nonsense = w.generateAgentReply('random leftover noodles', 'research');
  assert.doesNotMatch(nonsense, /Ask clearer/);
  assert.match(nonsense, /Workspace:/);
});

test('assistant panel opens and chips exist', t => {
  const w = boot(t);
  w.quickUnlock();
  w.toggleAgent(true);
  const panel = w.document.getElementById('agentPanel');
  assert.ok(panel.classList.contains('open'));
  assert.match(w.document.getElementById('agentChat').textContent, /TRL Assistant/);
  assert.ok(w.document.querySelector('[data-ask="What should I do today?"]'));
});
