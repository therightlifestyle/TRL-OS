const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
function boot(t, hash = "") {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(html, {url:'https://example.test/'+hash, runScripts:'dangerously', virtualConsole:console});
  dom.window.eval(fs.readFileSync('assets/workspace.js', 'utf8'));
  t.after(() => {dom.window.close(); assert.deepEqual(errors, []);});
  return dom.window;
}
test('onboarding has honest local-data disclosure and labelled controls', async t => {
  const w = boot(t);
  assert.equal(w.document.title, 'TRL Lead OS');
  assert.match(w.document.querySelector('.local-notice').textContent, /not secure authentication/);
  w.nextOnboard();
  await new Promise(r => setImmediate(r));
  assert.equal(w.document.querySelector('label[for="obName"]').textContent, 'Full name *');
  assert.equal(w.document.querySelectorAll('.local-notice').length, 1);
  assert.equal(w.document.querySelectorAll('main').length, 1);
  assert.ok(w.document.querySelector('main #shell'));
});
test('demo profile, all views, sample data, search and persistent density work', t => {
  const w = boot(t);
  w.quickUnlock();
  assert.equal(w.document.getElementById('shell').style.display, 'block');
  w.seedStarter();
  assert.equal(JSON.parse(w.localStorage.getItem('trl-lead-os-v1')).length, 20);
  for (const tab of ['leads','crm','analytics','loop','day','settings']) {
    w.switchTab(tab);
    assert.equal(w.location.hash, '#'+tab);
    assert.equal(w.document.getElementById('tab-'+tab).style.display, 'block');
  }
  w.setDensity('compact');
  assert.equal(w.document.body.dataset.density, 'compact');
  assert.equal(w.localStorage.getItem('trl-density'), 'compact');
  w.switchTab('leads');
  w.document.getElementById('search').value = 'nonexistent business';
  w.render();
  assert.match(w.document.body.textContent, /No leads match your filters/);
  w.clearFilters();
  assert.equal(w.document.getElementById('search').value, '');
});
test('lead validation, creation, editing and JSON export preserve records', t => {
  const w = boot(t);
  w.quickUnlock(); w.openModal(); w.saveLead();
  assert.equal(w.document.getElementById('modalErr').textContent, 'Name required');
  w.document.getElementById('fName').value = 'Example Studio';
  w.document.getElementById('fNext').value = 'Schedule discovery call';
  w.saveLead();
  let lead = JSON.parse(w.localStorage.getItem('trl-lead-os-v1'))[0];
  assert.equal(lead.name, 'Example Studio');
  w.editLead(lead.id);
  w.document.getElementById('fNext').value = 'Send proposal';
  w.saveLead();
  lead = JSON.parse(w.localStorage.getItem('trl-lead-os-v1'))[0];
  assert.equal(lead.nextAction, 'Send proposal');
  let exported;
  w.download = (content, name, type) => { exported = {content, name, type}; };
  w.exportJSON();
  assert.equal(JSON.parse(exported.content)[0].name, 'Example Studio');
  assert.equal(exported.type, 'application/json');
});
test('undated sample leads are not counted twice as overdue', t => {
  const w = boot(t);
  w.quickUnlock(); w.seedStarter(); w.switchTab('analytics');
  assert.equal(w.document.getElementById('anHealthText').textContent, '0 overdue + 15 no-date');
});

test('direct links to every workspace view initialise without errors', t => {
  for (const tab of ['leads', 'crm', 'analytics', 'loop', 'day', 'settings']) {
    const w = boot(t, '#' + tab);
    assert.equal(w.document.getElementById('tab-' + tab).style.display, 'block');
  }
});
