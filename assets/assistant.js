/* TRL Assistant — local workspace helper. No AI API. Helps with every area of Lead OS. */
(() => {
  const ROLES = ['chief','sales','content','builder','ops','research'];
  const ROLE_LABEL = { chief:'Chief', sales:'Sales', content:'Content', builder:'Builder', ops:'Ops', research:'Research' };
  let agentRole = 'chief';
  let history = [];
  try { history = JSON.parse(localStorage.getItem('trl-agent-history') || '[]'); } catch { history = []; }

  function esc(s){ return window.esc ? window.esc(String(s||'')) : String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function todayISO(){ return window.todayISO ? window.todayISO() : new Date().toISOString().slice(0,10); }
  function firstName(){ const n = typeof window.getName === 'function' ? window.getName() : 'Builder'; return (n || 'Builder').split(' ')[0]; }
  function leads(){ return typeof window.getLeads === 'function' ? (window.getLeads() || []) : []; }
  function toast(m,t){ if (window.toast) window.toast(m,t); }

  function isOverdue(l){
    return !!(l.nextActionDate && l.nextActionDate < todayISO() && !['closed-won','closed-lost'].includes(l.status));
  }
  function isOpen(l){ return !['closed-won','closed-lost'].includes(l.status); }

  function snapshot(){
    const list = leads();
    const today = todayISO();
    const overdue = list.filter(isOverdue);
    const due = list.filter(l => l.nextActionDate === today);
    const noDate = list.filter(l => !l.nextActionDate);
    const next = list.filter(l => (l.nextActionDate || '') > today);
    const replied = list.filter(l => ['replied','call booked','proposal sent','closed-won'].includes(l.status));
    const won = list.filter(l => l.status === 'closed-won');
    const contacted = list.filter(l => ['message sent','replied','call booked','proposal sent','closed-won','closed-lost'].includes(l.status));
    const calls = list.filter(l => ['call booked','proposal sent','closed-won'].includes(l.status));
    let value = 0;
    const price = {'Micro Audit $35':35,'Automation Sprint $499':499,'Founder OS $1,297':1297};
    list.forEach(l => { if (l.value) value += Number(l.value); else if (l.offer && price[l.offer]) value += price[l.offer]; });
    let flows = [];
    try {
      if (window.TRLFlow && typeof TRLFlow.loadStore === 'function') flows = TRLFlow.loadStore().workflows || [];
      else flows = (JSON.parse(localStorage.getItem('trl-flows-v1') || '{}').workflows) || [];
    } catch { flows = []; }
    const conv = list.length ? Math.round(replied.length / list.length * 100) : 0;
    const reli = list.length ? Math.round(list.filter(l => !!l.nextActionDate).length / list.length * 100) : 0;
    return {
      name: firstName(),
      fullName: typeof window.getName === 'function' ? window.getName() : 'Builder',
      list, overdue, due, noDate, next, replied, won, contacted, calls,
      total: list.length, value, conv, reli, flows,
      enabledFlows: flows.filter(f => f.enabled).length,
      today
    };
  }

  function day1(lead){
    const first = ((lead && lead.name) || 'there').split(' ')[0];
    const biz = (lead && lead.businessType) || 'your business';
    return `Hi ${first}, it's ${firstName()} — I run TRL, we build simple systems so enquiries never get lost. Quick question: when someone reaches out to ${biz}, how does follow-up happen?`;
  }

  function followUp(lead){
    const first = ((lead && lead.name) || 'there').split(' ')[0];
    const next = (lead && lead.nextAction) || 'that next step';
    return `Hi ${first}, circling back from ${firstName()} at TRL — still good to ${next.toLowerCase()}? Happy to keep it to a 10-minute call if easier.`;
  }

  function findLead(text){
    const list = leads();
    if (!list.length) return null;
    const t = text.toLowerCase();
    const named = list.find(l => l.name && t.includes(String(l.name).toLowerCase()));
    if (named) return named;
    const words = t.split(/[^a-z0-9]+/).filter(w => w.length > 2);
    return list.find(l => {
      const hay = `${l.name||''} ${l.businessType||''}`.toLowerCase();
      return words.some(w => hay.includes(w) && w.length > 3);
    }) || null;
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

  function decideRole(text, current){
    const t = text.toLowerCase();
    if (/(whatsapp|day-1|day 1|outreach|message|draft)/.test(t)) return 'sales';
    if (/(overdue|loop|14:00|operations|no-date|due today)/.test(t)) return 'ops';
    if (/(post|content|caption|instagram|linkedin)/.test(t)) return 'content';
    if (/(flow|n8n|automat|canvas|wizard|recipe)/.test(t)) return 'builder';
    if (/(research|compare|should i offer|decision)/.test(t)) return 'research';
    if (/(priority|today|plan|what should i)/.test(t)) return 'chief';
    return current || 'chief';
  }

  function reply(raw, role){
    const s = snapshot();
    const text = String(raw || '').trim();
    const t = text.toLowerCase();
    role = role || agentRole || 'chief';
    const lead = findLead(text);
    const actions = [];
    const chips = [];

    function out(body, extra){
      extra = extra || {};
      return {
        text: body,
        actions: extra.actions || actions,
        chips: extra.chips || chips,
        role
      };
    }

    if (!text) {
      return out(`**${ROLE_LABEL[role] || role} —** Say what you need. Try “what should I do today?”`);
    }

    // Greetings
    if (/^(hi|hello|hey|salam|salaam|assalam)\b/.test(t) && t.length < 24) {
      chips.push('What should I do today?', 'Who is overdue?', 'Explain Flow');
      return out(`**Hi ${s.name}.** I’m TRL Assistant — I help with this whole workspace: pipeline, CRM, Daily Loop, Flow automations, WhatsApp drafts, offers, and settings.\n\nRight now: **${s.total}** leads, **${s.overdue.length}** overdue, **${s.due.length}** due today, **${s.enabledFlows}** flow(s) on.\n\nWhat do you want to do?`);
    }

    // Thanks
    if (/^(thanks|thank you|shukriya|ok thanks)\b/.test(t) && t.length < 40) {
      return out(`Anytime. Logged → owned → next action. If a lead still has no date, that’s the leak.`);
    }

    const intents = [
      { id:'today', n: score(t, ['today','priority','what should i','plan','kya karun','kya karoon','do first','next move','start my day']) },
      { id:'overdue', n: score(t, ['overdue','forgotten','red first','past due','late follow']) },
      { id:'due', n: score(t, ['due today','yellow','today follow']) },
      { id:'nodate', n: score(t, ['no date','undated','no-date','missing date','at risk']) },
      { id:'draft', n: score(t, ['whatsapp','day-1','day 1','draft','message','outreach','copy','wa ']) },
      { id:'flow', n: score(t, ['flow','n8n','automat','recipe','canvas','wizard','when this','boxes']) },
      { id:'loop', n: score(t, ['daily loop','run loop','run check','14:00','14:00 pkt','operations loop']) },
      { id:'analytics', n: score(t, ['analytics','conversion','reliability','health','north star','time saved']) },
      { id:'crm', n: score(t, ['crm','kanban','pipeline value','deal value','stages']) },
      { id:'addlead', n: score(t, ['add lead','new lead','create lead','log a name']) },
      { id:'day', n: score(t, ['founder','schedule','working hours','deep work','rest break','14:00–04:00','14:00-04:00']) },
      { id:'settings', n: score(t, ['settings','export','backup','import','access code','factory reset']) },
      { id:'offers', n: score(t, ['offer','price','pricing','$35','$499','1297','micro audit','sprint','founder os']) },
      { id:'howto', n: score(t, ['how does this','what is trl','how to use','getting started','onboarding']) },
      { id:'help', n: score(t, ['help','what can you','what do you do','commands','menu']) },
      { id:'content', n: score(t, ['caption','post 1','instagram','linkedin','content idea']) },
      { id:'install', n: score(t, ['install','turn on','add recipe','never forgets','day-1 auto']) }
    ];
    intents.sort((a,b) => b.n - a.n);
    let id = intents[0].n > 0 ? intents[0].id : 'general';
    if (lead && lead.name && t.includes(String(lead.name).toLowerCase())) id = 'leadcard';
    else if (t.startsWith('lead:') || (lead && /draft wa|what should i do/.test(t) && (id === 'draft' || id === 'today' || id === 'general'))) id = 'leadcard';

    if (id === 'help') {
      chips.push('What should I do today?', 'Draft Day-1', 'Explain Flow', 'Run Daily Loop');
      return out(`I help with **everything in TRL Lead OS** — still local, no AI cloud.\n\n• **Pipeline / CRM** — who to contact, stages, deal value\n• **Daily Loop** — overdue → today → next → no-date\n• **Flow** — When → If → Then recipes (like n8n, for your leads)\n• **Drafts** — Day-1 and follow-up WhatsApp text to copy\n• **Analytics, schedule, offers, export**\n\nAsk in normal words. Roles (Chief, Sales…) only change the lens, not whether I can answer.`);
    }

    if (id === 'howto') {
      actions.push({ label:'Add a lead', kind:'modal' }, { label:'Open Flow', kind:'nav', payload:'flow' });
      return out(`**TRL Lead OS in 30 seconds**\n1. Every enquiry is a lead with a **next action + date**.\n2. Pipeline and CRM are the same records, two views.\n3. At **14:00 PKT** run Daily Loop: red (overdue) first, then yellow (today).\n4. Optional: Automations (Flow) run recipes when something happens.\n5. Export JSON from Settings — data lives only in this browser.\n\nDemo access uses code **TRL-2026**. The code is a convenience lock, not real security.`);
    }

    if (id === 'today') {
      actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
      if (s.overdue.length) actions.push({ label:'Fix overdue first', kind:'nav', payload:'loop' });
      if (!s.total) actions.push({ label:'Add first lead', kind:'modal' }, { label:'Load sample leads', kind:'seed' });
      chips.push('Who is overdue?', 'Draft Day-1', 'Explain Flow');
      const steps = [];
      if (!s.total) steps.push('1. Add 5 real names (or load samples to learn the board).');
      else {
        steps.push(`1. **Fix red:** ${s.overdue.length} overdue`);
        steps.push(`2. **Then yellow:** ${s.due.length} due today`);
        steps.push(`3. Give a date to ${s.noDate.length} undated lead(s)`);
        steps.push('4. Send two Day-1 messages. End with a question.');
        steps.push('5. Export JSON before you close the laptop.');
      }
      const top = (s.overdue[0] || s.due[0] || s.list[0]);
      return out(`**Today’s command — ${s.today}**\n${s.total} leads · ${s.overdue.length} overdue · ${s.due.length} due · ${s.noDate.length} no-date · conversion ${s.conv}%.\n\n${steps.join('\n')}\n\n**Done when:** 0 overdue, every open lead has a date.${top ? `\n\nStart with **${top.name}** — ${top.nextAction || top.status}.` : ''}`);
    }

    if (id === 'overdue') {
      actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
      if (s.overdue[0]) actions.push({ label:'Edit ' + s.overdue[0].name, kind:'edit', payload:String(s.overdue[0].id) });
      actions.push({ label:'Add “never forgets” recipe', kind:'flow', payload:'never-forget' });
      return out(`**Overdue (red) — ${s.overdue.length}**\nFix these before anything new.\n\n${listBlock(s.overdue, 'None overdue. Good — keep dates honest.')}\n\nRule: call booked / clear no / next action + date. No limbo.`);
    }

    if (id === 'due') {
      actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
      return out(`**Due today — ${s.due.length}**\n\n${listBlock(s.due, 'Nothing due today. Check overdue and no-date next.')}`);
    }

    if (id === 'nodate') {
      actions.push({ label:'Open Pipeline', kind:'nav', payload:'leads' });
      return out(`**No date = at risk — ${s.noDate.length}**\nUndated leads are not counted as overdue. They still leak.\n\n${listBlock(s.noDate, 'Every lead has a date. Reliability is holding.')}\n\nGive each one a next action dated tomorrow.`);
    }

    if (id === 'draft') {
      const target = lead || s.overdue[0] || s.due[0] || s.list[0];
      const msg = (target && isOverdue(target) && !/day-1|day 1/.test(t)) ? followUp(target) : day1(target || { name:'there' });
      actions.push({ label:'Copy message', kind:'copy', payload: msg });
      if (target) actions.push({ label:'Edit ' + target.name, kind:'edit', payload:String(target.id) });
      actions.push({ label:'Open Pipeline', kind:'nav', payload:'leads' });
      return out(`**${/follow/.test(t) ? 'Follow-up' : 'Day-1'} draft**${target ? ` for **${target.name}**` : ''}\n\n${msg}\n\nEnd with a question. Copy it — this workspace does not send WhatsApp.`);
    }

    if (id === 'flow' || id === 'install') {
      actions.push({ label:'Open Automations', kind:'nav', payload:'flow' });
      actions.push({ label:'Add Day-1 auto', kind:'flow', payload:'day1' });
      actions.push({ label:'Add never-forgets', kind:'flow', payload:'never-forget' });
      const fl = s.flows.map(f => `• ${f.enabled ? 'ON' : 'OFF'} **${f.name}**`).join('\n') || 'No recipes yet.';
      return out(`**TRL Flow** is n8n-style automation for *this* pipeline. You do not need to know n8n.\n\nConnect boxes: **When** (green) → **Only if** (yellow) → **Then** (blue). Recipes stay OFF until you flip them on. They update local leads only — they do not send WhatsApp or email.\n\n**Your flows**\n${fl}\n\nReady-made: Follow-up never forgets, Day-1 auto, Replied → book the call, Daily Loop ping, high-value alert, won-deal note.`);
    }

    if (id === 'loop') {
      actions.push({ label:'Run Daily Loop', kind:'loop' });
      return out(`**Daily Loop · 10 min · 14:00 PKT**\nOverdue **${s.overdue.length}** → due today **${s.due.length}** → next **${s.next.length}** → no-date **${s.noDate.length}** → export.\n\nRed first, then yellow. Then give undated leads a date. That’s the whole operating system.`);
    }

    if (id === 'analytics') {
      actions.push({ label:'Open Analytics', kind:'nav', payload:'analytics' });
      const health = (s.overdue.length + s.noDate.length) === 0 ? 'Healthy' : (s.overdue.length + s.noDate.length) <= 2 ? 'At risk' : 'Needs fix';
      return out(`**Analytics snapshot**\n• Conversion **${s.conv}%** — share of leads at replied / booked / proposal / won (not a win rate)\n• Reliability **${s.reli}%** — share with a next-action date\n• Health **${health}** — ${s.overdue.length} overdue + ${s.noDate.length} no-date\n• Est. time saved **${Math.round(s.replied.length * 0.25)}h** — heuristic, 15m per response-stage lead\n• Pipeline value **$${s.value.toLocaleString()}** (planning, 280 PKR/USD)`);
    }

    if (id === 'crm') {
      actions.push({ label:'Open CRM', kind:'nav', payload:'crm' });
      const stages = ['not contacted','message sent','replied','call booked','proposal sent','closed-won','closed-lost'];
      const lines = stages.map(st => `• ${st}: **${s.list.filter(l => l.status === st).length}**`).join('\n');
      return out(`**CRM** is the same leads as Pipeline, in seven columns.\nValue **$${s.value.toLocaleString()}** · won **${s.won.length}** · next 7-day actions live on the CRM tab.\n\n${lines}`);
    }

    if (id === 'addlead') {
      actions.push({ label:'Add lead', kind:'modal' });
      return out(`**Add a lead:** name, next action, and next date are required. Status starts at “not contacted”. After save, Pipeline and CRM both show it.\n\nIf Day-1 auto is ON in Flow, the next action becomes “Send Day-1 message” dated tomorrow.`);
    }

    if (id === 'day') {
      actions.push({ label:"Open Founder's Day", kind:'nav', payload:'day' });
      return out(`**Founder’s Day · 14:00–04:00 PKT** (with a rest break)\n• 14:00 Loop — 10m\n• 14:15–15:45 Outbound — 90m\n• 15:45–16:15 Rest — 30m\n• 16:15–18:30 Delivery\n• 22:00–04:00 Deep work\n\nWeek-1 targets: **20 names, 10 conversations, 3 audits**.\nYou have **${s.total}/20** names, **${s.contacted.length}/10** conversations, **${s.calls.length}/3** audits.\nGates on the page: 27 Sep (14-day habit), 13 Oct (first payment) — planning references, not auto-deadlines.`);
    }

    if (id === 'settings') {
      actions.push({ label:'Open Settings', kind:'nav', payload:'settings' }, { label:'Export JSON', kind:'export' });
      return out(`**Settings & backup**\nProfile, access code (6+ chars, stored in this browser in plaintext), density, export JSON/CSV, import JSON, clear, factory reset.\n\nFactory reset wipes leads, profile, Flow recipes, and this chat history. Export first. Guest access opens the same local data — not a security boundary.`);
    }

    if (id === 'offers') {
      return out(`**TRL offers** (planning values, not checkout)\n• Micro Audit — **$35**\n• Automation Sprint — **$499**\n• Founder OS — **$1,297**\n\nPKR on screen uses a fixed **280 PKR per USD**, not a live rate. Attach an offer on the lead form; Flow can set it automatically.`);
    }

    if (id === 'content') {
      return out(`**Content · Post 1 idea**\nMost local businesses don’t lose leads because they’re bad at sales. They lose them because follow-up lives in someone’s head.\n\nCaption: “If an enquiry comes in at 9pm, who owns the next message — and by when?”\n\nThat’s the TRL loop. Offer the $35 Micro Audit as the next step.`);
    }

    if (lead) {
      actions.push({ label:'Edit lead', kind:'edit', payload:String(lead.id) });
      actions.push({ label:'Copy Day-1', kind:'copy', payload: day1(lead) });
      const flag = isOverdue(lead) ? 'OVERDUE' : lead.nextActionDate === s.today ? 'DUE TODAY' : (lead.nextActionDate ? lead.nextActionDate : 'NO DATE');
      return out(`**${lead.name}** · ${lead.businessType || '—'} · ${lead.status}\nSource ${lead.source || '—'} · ${lead.channel || 'WhatsApp'} · ${lead.priority || 'no priority'} · $${Number(lead.value||0).toLocaleString()}\nNext: **${lead.nextAction || '—'}** · **${flag}**\n${lead.notes ? 'Notes: ' + lead.notes.slice(0,180) : ''}\n\nMove: call booked / clear no / next action + date.`);
    }

    // Role-flavoured general — always useful, never "ask clearer"
    actions.push({ label:'Today’s plan', kind:'ask', payload:'What should I do today?' });
    actions.push({ label:'Open Daily Loop', kind:'nav', payload:'loop' });
    chips.push('Who is overdue?', 'Explain Flow', 'Draft Day-1');
    const lens = {
      chief: 'Chief lens: sequence the day. Red, then yellow, then two conversations.',
      sales: 'Sales lens: send Day-1, end with a question, book the call.',
      content: 'Content lens: one post that names the follow-up leak.',
      builder: 'Builder lens: Flow recipes and the lead form — keep it local.',
      ops: 'Ops lens: run the 10-minute loop, then export.',
      research: 'Research lens: pick one offer and one next action, not ten ideas.'
    }[role] || '';
    return out(`I read that as: “${text.slice(0,120)}”.\n\n**Workspace:** ${s.total} leads · ${s.overdue.length} overdue · ${s.due.length} due today · ${s.noDate.length} no-date · ${s.enabledFlows} flow(s) on.\n${lens}\n\nAsk me about a name, overdue, Flow, Daily Loop, drafts, offers, analytics, or settings — or tap a chip.`);
  }

  function md(text){
    return esc(text).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }

  function saveHistory(){
    try { localStorage.setItem('trl-agent-history', JSON.stringify(history.slice(-40))); } catch {}
  }

  function chatEl(){ return document.getElementById('agentChat'); }

  function hideEmpty(){
    const e = document.getElementById('agentEmpty');
    if (e) e.style.display = 'none';
  }

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
    if (kind === 'nav' && typeof window.switchTab === 'function') {
      window.switchTab(payload);
      toast('Opened ' + payload, 'info');
      return;
    }
    if (kind === 'modal' && typeof window.openModal === 'function') { window.openModal(); return; }
    if (kind === 'loop') {
      if (typeof window.switchTab === 'function') window.switchTab('loop');
      if (typeof window.runLoopCheck === 'function') window.runLoopCheck(true);
      return;
    }
    if (kind === 'copy') {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).catch(() => {});
      toast('Copied — WhatsApp is not sent from here', 'ok');
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
    if (kind === 'ask') { ask(payload); return; }
  }

  function paintSnap(){
    const el = document.getElementById('agentSnap');
    if (!el) return;
    const s = snapshot();
    el.innerHTML = `<span>${s.total} leads</span><span class="${s.overdue.length?'bad':''}">${s.overdue.length} overdue</span><span>${s.due.length} due</span><span>${s.enabledFlows} flow on</span>`;
  }

  function paintEmpty(){
    const c = chatEl(); if (!c) return;
    c.innerHTML = `<div class="agent-empty" id="agentEmpty">
      <b>TRL Assistant</b>
      I help with pipeline, CRM, Daily Loop, Flow automations, WhatsApp drafts, offers, and settings. Local — nothing leaves this browser.
      <div class="agent-chips">
        <button type="button" class="agent-chip" data-ask="What should I do today?">What should I do today?</button>
        <button type="button" class="agent-chip" data-ask="Who is overdue?">Who is overdue?</button>
        <button type="button" class="agent-chip" data-ask="Draft a Day-1 WhatsApp">Draft Day-1</button>
        <button type="button" class="agent-chip" data-ask="Explain Flow like I don't know n8n">Explain Flow</button>
        <button type="button" class="agent-chip" data-ask="Run the Daily Loop">Daily Loop</button>
        <button type="button" class="agent-chip" data-ask="What can you help with?">What can you do?</button>
      </div>
    </div>`;
    c.querySelectorAll('[data-ask]').forEach(btn => btn.addEventListener('click', () => ask(btn.getAttribute('data-ask'))));
  }

  function setRole(r, silent){
    if (!ROLES.includes(r)) r = 'chief';
    agentRole = r;
    document.querySelectorAll('.agent-role').forEach(el => {
      const on = el.dataset.role === r;
      el.classList.toggle('active', on);
      el.style.background = on ? 'var(--black)' : '#fff';
      el.style.color = on ? '#fff' : '';
    });
    const lab = document.getElementById('agentRoleLabel');
    if (lab) lab.textContent = ROLE_LABEL[r] || r;
    if (!silent) toast('Lens: ' + (ROLE_LABEL[r] || r), 'info');
  }

  function toggle(open){
    const p = document.getElementById('agentPanel');
    if (!p) return;
    if (open) {
      p.style.display = 'flex';
      p.classList.add('open');
      paintSnap();
      const c = chatEl();
      if (c && !c.querySelector('.bubble') && !c.querySelector('#agentEmpty')) paintEmpty();
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
    const detected = decideRole(text, agentRole);
    if (detected !== agentRole) setRole(detected, true);
    appendUser(text);
    history.push({ role:'user', text });
    const chat = chatEl();
    const typing = document.createElement('div');
    typing.className = 'bubble bubble-agent';
    typing.textContent = '…';
    if (chat) { chat.appendChild(typing); chat.scrollTop = chat.scrollHeight; }
    setTimeout(() => {
      typing.remove();
      const result = reply(text, detected);
      appendAgent(result);
      history.push({ role:'agent', text: result.text });
      saveHistory();
      paintSnap();
    }, 180);
  }

  function aboutLead(id){
    const l = leads().find(x => x.id === id);
    if (!l) return;
    toggle(true);
    setRole('sales', true);
    ask(`Lead: ${l.name} — ${l.businessType || ''} — ${l.status} — next "${l.nextAction || ''}" on ${l.nextActionDate || 'no date'}. What should I do?`);
  }

  window.TRLAssistant = { reply, snapshot, ask, send, toggle, setRole, aboutLead, runAction, decideRole };
  window.generateAgentReply = function(text, role){ return reply(text, role).text; };
  window.sendAgent = send;
  window.toggleAgent = toggle;
  window.setAgentRole = function(r){ setRole(r, false); };
  window.askAgentAboutLead = aboutLead;
  window.detectRole = function(t){ return decideRole(t, agentRole); };

  document.addEventListener('click', e => {
    const chip = e.target.closest && e.target.closest('[data-ask]');
    if (chip && chip.closest('#agentPanel')) {
      e.preventDefault();
      ask(chip.getAttribute('data-ask'));
    }
  });
})();
