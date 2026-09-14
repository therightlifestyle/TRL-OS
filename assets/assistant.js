/* TRL Assistant — one local helper for the whole workspace. No AI API. No extra roles. */
(() => {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('trl-agent-history') || '[]'); } catch { history = []; }

  function esc(s){ return window.esc ? window.esc(String(s||'')) : String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function todayISO(){ return window.todayISO ? window.todayISO() : new Date().toISOString().slice(0,10); }
  function firstName(){ const n = typeof window.getName === 'function' ? window.getName() : ''; return (n || 'there').split(' ')[0]; }
  function leads(){ return typeof window.getLeads === 'function' ? (window.getLeads() || []) : []; }
  function toast(m,t){ if (window.toast) window.toast(m,t); }
  function isOverdue(l){ return !!(l.nextActionDate && l.nextActionDate < todayISO() && !['closed-won','closed-lost'].includes(l.status)); }

  function snapshot(){
    const list = leads();
    const today = todayISO();
    const overdue = list.filter(isOverdue);
    const due = list.filter(l => l.nextActionDate === today);
    const noDate = list.filter(l => !l.nextActionDate);
    const next = list.filter(l => (l.nextActionDate || '') > today);
    const replied = list.filter(l => ['replied','call booked','proposal sent','closed-won'].includes(l.status));
    let value = 0;
    list.forEach(l => { if (l.value) value += Number(l.value); });
    let flows = [];
    try {
      if (window.TRLFlow && typeof TRLFlow.loadStore === 'function') flows = TRLFlow.loadStore().workflows || [];
      else flows = (JSON.parse(localStorage.getItem('trl-flows-v1') || '{}').workflows) || [];
    } catch { flows = []; }
    const conv = list.length ? Math.round(replied.length / list.length * 100) : 0;
    const reli = list.length ? Math.round(list.filter(l => !!l.nextActionDate).length / list.length * 100) : 0;
    return { name: firstName(), list, overdue, due, noDate, next, replied, total: list.length, value, conv, reli, flows, enabledFlows: flows.filter(f => f.enabled).length, today };
  }

  function day1(lead){
    const first = ((lead && lead.name) || 'there').split(' ')[0];
    const biz = (lead && lead.businessType) || 'your business';
    const me = firstName() === 'there' ? 'I' : firstName();
    return `Hi ${first}, it's ${me} — I build simple systems so enquiries never get lost. Quick question: when someone reaches out to ${biz}, how does follow-up happen?`;
  }
  function followUp(lead){
    const first = ((lead && lead.name) || 'there').split(' ')[0];
    const next = (lead && lead.nextAction) || 'that next step';
    return `Hi ${first}, circling back — still good to ${String(next).toLowerCase()}? Happy to keep it to a short call if easier.`;
  }
  function findLead(text){
    const list = leads();
    if (!list.length) return null;
    const t = text.toLowerCase();
    const named = list.find(l => l.name && t.includes(String(l.name).toLowerCase()));
    if (named) return named;
    const words = t.split(/[^a-z0-9]+/).filter(w => w.length > 3);
    return list.find(l => words.some(w => `${l.name||''} ${l.businessType||''}`.toLowerCase().includes(w))) || null;
  }
  function listBlock(arr, empty){
    if (!arr.length) return empty;
    return arr.slice(0, 6).map(l => `• **${l.name}** — ${l.status || '—'} — ${l.nextAction || 'no next action'} (${l.nextActionDate || 'no date'})`).join('\n')
      + (arr.length > 6 ? `\n• +${arr.length - 6} more` : '');
  }
  function score(text, needles){
    let s = 0;
    needles.forEach(n => { if (text.includes(n)) s += n.length > 8 ? 3 : n.length > 4 ? 2 : 1; });
    return s;
  }

  function reply(raw){
    const s = snapshot();
    const text = String(raw || '').trim();
    const t = text.toLowerCase();
    const lead = findLead(text);
    const actions = [];
    const chips = [];
    const out = (body) => ({ text: body, actions, chips });

    if (!text) return out('Say what you need. Try “what should I do today?”');

    if (/^(hi|hello|hey|salam|salaam|assalam)\b/.test(t) && t.length < 24) {
      chips.push('What should I do today?', 'Who is overdue?', 'Explain Flow');
      return out(`**Hi${s.name && s.name !== 'there' ? ' ' + s.name : ''}.** I’m TRL Assistant. I help with this workspace: pipeline, CRM, Daily Loop, automations, drafts, and settings.\n\nRight now: **${s.total}** leads, **${s.overdue.length}** overdue, **${s.due.length}** due today.\n\nWhat do you want to do?`);
    }
    if (/^(thanks|thank you|shukriya|ok thanks)\b/.test(t) && t.length < 40) {
      return out('Anytime. Logged → owned → next action. If a lead has no date, that’s the leak.');
    }

    const intents = [
      { id:'today', n: score(t, ['today','priority','what should i','plan','kya karun','kya karoon','do first','next move','start my day']) },
      { id:'overdue', n: score(t, ['overdue','forgotten','red first','past due','late follow']) },
      { id:'due', n: score(t, ['due today','yellow','today follow']) },
      { id:'nodate', n: score(t, ['no date','undated','no-date','missing date','at risk']) },
      { id:'draft', n: score(t, ['whatsapp','day-1','day 1','draft','message','outreach','copy','wa ']) },
      { id:'flow', n: score(t, ['flow','n8n','automat','recipe','canvas','wizard','when this','boxes']) },
      { id:'loop', n: score(t, ['daily loop','run loop','run check','operations loop']) },
      { id:'analytics', n: score(t, ['analytics','conversion','reliability','health','time saved']) },
      { id:'crm', n: score(t, ['crm','kanban','pipeline value','deal value','stages']) },
      { id:'addlead', n: score(t, ['add lead','new lead','create lead','log a name']) },
      { id:'day', n: score(t, ['today view','how to run the day','schedule']) },
      { id:'settings', n: score(t, ['settings','export','backup','import','access code','factory reset']) },
      { id:'howto', n: score(t, ['how does this','what is trl','how to use','getting started','onboarding']) },
      { id:'help', n: score(t, ['help','what can you','what do you do','commands','menu']) },
      { id:'install', n: score(t, ['install','turn on','add recipe','never forgets','day-1 auto']) }
    ];
    intents.sort((a,b) => b.n - a.n);
    let id = intents[0].n > 0 ? intents[0].id : 'general';
    if (lead && lead.name && t.includes(String(lead.name).toLowerCase())) id = 'leadcard';
    else if (t.startsWith('lead:')) id = 'leadcard';

    if (id === 'help') {
      chips.push('What should I do today?', 'Draft Day-1', 'Explain Flow', 'Run Daily Loop');
      return out(`I help with **TRL Lead OS** — local, in this browser.\n\n• **Pipeline / CRM** — who to contact, stages\n• **Daily Loop** — overdue → today → next → no-date\n• **Flow** — When → If → Then recipes\n• **Drafts** — follow-up text to copy (not sent)\n• **Analytics, Today, settings, export**\n\nAsk in normal words.`);
    }
    if (id === 'howto') {
      actions.push({ label:'Add a lead', kind:'modal' });
      return out(`**How this works**\n1. Answer a few setup questions, then you enter the workspace.\n2. Every enquiry is a lead with a **next action + date**.\n3. Pipeline and CRM are the same records.\n4. Run Daily Loop: red (overdue) first, then yellow (today).\n5. Optional automations run recipes when something happens.\n6. Export JSON from Settings — data stays in this browser.\n\nThe access code is a convenience lock, not real security.`);
    }
    if (id === 'today') {
      actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
      if (!s.total) actions.push({ label:'Add first lead', kind:'modal' }, { label:'Load sample leads', kind:'seed' });
      chips.push('Who is overdue?', 'Draft Day-1', 'Explain Flow');
      const steps = !s.total
        ? ['1. Add your first real names (or load samples to learn the board).']
        : [
            `1. **Fix red:** ${s.overdue.length} overdue`,
            `2. **Then yellow:** ${s.due.length} due today`,
            `3. Give a date to ${s.noDate.length} undated lead(s)`,
            '4. Send two follow-ups. End with a question.',
            '5. Export JSON before you close.'
          ];
      const top = s.overdue[0] || s.due[0] || s.list[0];
      return out(`**Today — ${s.today}**\n${s.total} leads · ${s.overdue.length} overdue · ${s.due.length} due · ${s.noDate.length} no-date.\n\n${steps.join('\n')}\n\n**Done when:** 0 overdue, every open lead has a date.${top ? `\n\nStart with **${top.name}** — ${top.nextAction || top.status}.` : ''}`);
    }
    if (id === 'overdue') {
      actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
      if (s.overdue[0]) actions.push({ label:'Edit ' + s.overdue[0].name, kind:'edit', payload:String(s.overdue[0].id) });
      actions.push({ label:'Add never-forgets recipe', kind:'flow', payload:'never-forget' });
      return out(`**Overdue — ${s.overdue.length}**\nFix these before anything new.\n\n${listBlock(s.overdue, 'None overdue.')}\n\nRule: call booked / clear no / next action + date.`);
    }
    if (id === 'due') {
      actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
      return out(`**Due today — ${s.due.length}**\n\n${listBlock(s.due, 'Nothing due today. Check overdue and no-date next.')}`);
    }
    if (id === 'nodate') {
      actions.push({ label:'Open Pipeline', kind:'nav', payload:'leads' });
      return out(`**No date — ${s.noDate.length}**\nUndated leads are not counted as overdue. They still leak.\n\n${listBlock(s.noDate, 'Every lead has a date.')}`);
    }
    if (id === 'draft') {
      const target = lead || s.overdue[0] || s.due[0] || s.list[0];
      const msg = (target && isOverdue(target) && !/day-1|day 1/.test(t)) ? followUp(target) : day1(target || { name:'there' });
      actions.push({ label:'Copy message', kind:'copy', payload: msg });
      if (target) actions.push({ label:'Edit ' + target.name, kind:'edit', payload:String(target.id) });
      return out(`**Draft**${target ? ` for **${target.name}**` : ''}\n\n${msg}\n\nEnd with a question. Copy it — this workspace does not send WhatsApp.`);
    }
    if (id === 'flow' || id === 'install') {
      actions.push({ label:'Open Automations', kind:'nav', payload:'flow' });
      actions.push({ label:'Add Day-1 auto', kind:'flow', payload:'day1' });
      actions.push({ label:'Add never-forgets', kind:'flow', payload:'never-forget' });
      const fl = s.flows.map(f => `• ${f.enabled ? 'ON' : 'OFF'} **${f.name}**`).join('\n') || 'No recipes yet.';
      return out(`**Flow** is When → If → Then automation for this pipeline. You do not need to know n8n.\n\nGreen = when, yellow = only if, blue = then. Recipes stay OFF until you turn them on. They update local leads only.\n\n**Your flows**\n${fl}`);
    }
    if (id === 'loop') {
      actions.push({ label:'Run Daily Loop', kind:'loop' });
      return out(`**Daily Loop · 10 minutes**\nOverdue **${s.overdue.length}** → due today **${s.due.length}** → next **${s.next.length}** → no-date **${s.noDate.length}** → export.\n\nRed first, then yellow.`);
    }
    if (id === 'analytics') {
      actions.push({ label:'Open Analytics', kind:'nav', payload:'analytics' });
      const health = (s.overdue.length + s.noDate.length) === 0 ? 'Healthy' : (s.overdue.length + s.noDate.length) <= 2 ? 'At risk' : 'Needs fix';
      return out(`**Analytics**\n• Conversion **${s.conv}%** — replied / booked / proposal / won (not a win rate)\n• Reliability **${s.reli}%** — share with a next-action date\n• Health **${health}** — ${s.overdue.length} overdue + ${s.noDate.length} no-date`);
    }
    if (id === 'crm') {
      actions.push({ label:'Open CRM', kind:'nav', payload:'crm' });
      const stages = ['not contacted','message sent','replied','call booked','proposal sent','closed-won','closed-lost'];
      const lines = stages.map(st => `• ${st}: **${s.list.filter(l => l.status === st).length}**`).join('\n');
      return out(`**CRM** is the same leads as Pipeline, in seven columns.\nValue **$${s.value.toLocaleString()}**.\n\n${lines}`);
    }
    if (id === 'addlead') {
      actions.push({ label:'Add lead', kind:'modal' });
      return out('**Add a lead:** name, next action, and next date are required. Pipeline and CRM both show it after save.');
    }
    if (id === 'day') {
      actions.push({ label:'Open Today', kind:'nav', payload:'day' });
      return out('**Today:** run Daily Loop, then follow-ups, then give undated leads a date, then export. Done when overdue is zero.');
    }
    if (id === 'settings') {
      actions.push({ label:'Open Settings', kind:'nav', payload:'settings' }, { label:'Export JSON', kind:'export' });
      return out('**Settings:** profile, access code, density, export/import, clear, factory reset.\n\nFactory reset wipes local data. Export first. The access code is stored in this browser — not a security boundary.');
    }
    if (lead) {
      actions.push({ label:'Edit lead', kind:'edit', payload:String(lead.id) });
      actions.push({ label:'Copy draft', kind:'copy', payload: day1(lead) });
      const flag = isOverdue(lead) ? 'OVERDUE' : lead.nextActionDate === s.today ? 'DUE TODAY' : (lead.nextActionDate ? lead.nextActionDate : 'NO DATE');
      return out(`**${lead.name}** · ${lead.businessType || '—'} · ${lead.status}\nNext: **${lead.nextAction || '—'}** · **${flag}**\n\nMove: call booked / clear no / next action + date.`);
    }

    actions.push({ label:'Today’s plan', kind:'ask', payload:'What should I do today?' });
    actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
    chips.push('Who is overdue?', 'Explain Flow', 'Draft Day-1');
    return out(`I read that as: “${text.slice(0,120)}”.\n\n**Workspace:** ${s.total} leads · ${s.overdue.length} overdue · ${s.due.length} due today · ${s.noDate.length} no-date.\n\nAsk about a name, overdue, Flow, Daily Loop, drafts, or settings — or tap a chip.`);
  }

  function md(text){ return esc(text).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
  function saveHistory(){ try { localStorage.setItem('trl-agent-history', JSON.stringify(history.slice(-40))); } catch {} }
  function chatEl(){ return document.getElementById('agentChat'); }
  function hideEmpty(){ const e = document.getElementById('agentEmpty'); if (e) e.style.display = 'none'; }

  function appendUser(text){
    const c = chatEl(); if (!c) return;
    hideEmpty();
    const d = document.createElement('div');
    d.className = 'bubble bubble-user';
    d.textContent = text;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }
  function appendAgent(result){
    const c = chatEl(); if (!c) return;
    hideEmpty();
    const d = document.createElement('div');
    d.className = 'bubble bubble-agent';
    d.innerHTML = md(result.text || '');
    if (result.actions && result.actions.length) {
      const acts = document.createElement('div');
      acts.className = 'acts';
      result.actions.forEach(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = a.label;
        b.addEventListener('click', () => runAction(a));
        acts.appendChild(b);
      });
      d.appendChild(acts);
    }
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }

  function runAction(a){
    const kind = a.kind, payload = a.payload;
    if (kind === 'nav' && typeof window.switchTab === 'function') { window.switchTab(payload); toast('Opened ' + payload, 'info'); return; }
    if (kind === 'modal' && typeof window.openModal === 'function') { window.openModal(); return; }
    if (kind === 'loop') {
      if (typeof window.switchTab === 'function') window.switchTab('loop');
      if (typeof window.runLoopCheck === 'function') window.runLoopCheck(true);
      return;
    }
    if (kind === 'copy') {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).catch(() => {});
      toast('Copied — messages are not sent from here', 'ok');
      return;
    }
    if (kind === 'edit' && typeof window.editLead === 'function') {
      window.editLead(isNaN(Number(payload)) ? payload : Number(payload));
      return;
    }
    if (kind === 'flow' && window.TRLFlow) {
      window.TRLFlow.useTemplate(payload);
      if (typeof window.switchTab === 'function') window.switchTab('flow');
      return;
    }
    if (kind === 'export' && typeof window.exportJSON === 'function') { window.exportJSON(); return; }
    if (kind === 'seed' && typeof window.seedStarter === 'function') { window.seedStarter(); return; }
    if (kind === 'ask') { ask(payload); }
  }

  function paintSnap(){
    const el = document.getElementById('agentSnap');
    if (!el) return;
    const s = snapshot();
    el.innerHTML = `<span>${s.total} leads</span><span class="${s.overdue.length?'bad':''}">${s.overdue.length} overdue</span><span>${s.due.length} due</span>`;
  }

  function toggle(open){
    const p = document.getElementById('agentPanel');
    if (!p) return;
    if (open) {
      p.style.display = 'flex';
      p.classList.add('open');
      paintSnap();
      const input = document.getElementById('agentInput');
      if (input) setTimeout(() => input.focus(), 50);
    } else {
      p.style.display = 'none';
      p.classList.remove('open');
    }
  }

  function send(){
    const input = document.getElementById('agentInput');
    const text = (input && input.value || '').trim();
    if (!text) return;
    if (input) input.value = '';
    ask(text);
  }

  function ask(text){
    appendUser(text);
    history.push({ role:'user', text });
    const chat = chatEl();
    const typing = document.createElement('div');
    typing.className = 'bubble bubble-agent';
    typing.textContent = '…';
    if (chat) { chat.appendChild(typing); chat.scrollTop = chat.scrollHeight; }
    setTimeout(() => {
      typing.remove();
      const result = reply(text);
      appendAgent(result);
      history.push({ role:'agent', text: result.text });
      saveHistory();
      paintSnap();
    }, 160);
  }

  function aboutLead(id){
    const l = leads().find(x => x.id === id);
    if (!l) return;
    toggle(true);
    ask(`Lead: ${l.name} — ${l.businessType || ''} — ${l.status} — next "${l.nextAction || ''}" on ${l.nextActionDate || 'no date'}. What should I do?`);
  }

  window.TRLAssistant = { reply, snapshot, ask, send, toggle, aboutLead, runAction };
  window.generateAgentReply = function(text){ return reply(text).text; };
  window.sendAgent = send;
  window.toggleAgent = toggle;
  window.setAgentRole = function(){};
  window.askAgentAboutLead = aboutLead;
  window.detectRole = function(){ return 'assistant'; };

  document.addEventListener('click', e => {
    const chip = e.target.closest && e.target.closest('[data-ask]');
    if (chip && chip.closest('#agentPanel')) {
      e.preventDefault();
      ask(chip.getAttribute('data-ask'));
    }
  });
})();
