/* TRL Flow — local visual automation for leads. No n8n knowledge required. */
(() => {
  const STORE = 'trl-flows-v1';
  const RUNS = 'trl-flow-runs-v1';
  const STATUSES = ['not contacted','message sent','replied','call booked','proposal sent','closed-won','closed-lost'];
  const SOURCES = ['warm — local business','warm — creator','warm — existing contact','warm','cold','referral','inbound'];
  const CHANNELS = ['WhatsApp','Email','Phone','In-person'];
  const PRIORITIES = ['High','Medium','Low'];
  const OFFERS = ['Micro Audit $35','Automation Sprint $499','Founder OS $1,297'];

  const NODES = {
    'trigger.newLead': { kind:'trigger', group:'When', title:'New lead added', hint:'Starts when you save a brand-new lead.', icon:'＋', accent:'#34d399', inputs:[], outputs:['out'], fields:[] },
    'trigger.statusChanged': { kind:'trigger', group:'When', title:'Status changed', hint:'Starts when a lead moves to a stage.', icon:'↻', accent:'#34d399', inputs:[], outputs:['out'], fields:[{key:'status', label:'To this status (blank = any)', type:'status', optional:true}] },
    'trigger.overdue': { kind:'trigger', group:'When', title:'Lead is overdue', hint:'Starts for open leads past their next-action date.', icon:'!', accent:'#34d399', inputs:[], outputs:['out'], fields:[] },
    'trigger.dueToday': { kind:'trigger', group:'When', title:'Due today', hint:'Starts for leads whose next action is today.', icon:'●', accent:'#34d399', inputs:[], outputs:['out'], fields:[] },
    'trigger.dailyLoop': { kind:'trigger', group:'When', title:'Daily Loop check', hint:'Starts when you press Run check on Daily Loop.', icon:'◉', accent:'#34d399', inputs:[], outputs:['out'], fields:[] },
    'trigger.manual': { kind:'trigger', group:'When', title:'Run myself', hint:'Starts only when you press Run. Good for testing.', icon:'▶', accent:'#34d399', inputs:[], outputs:['out'], fields:[] },
    'if.status': { kind:'condition', group:'Only if', title:'If status is', hint:'Yes path if the lead is on this stage.', icon:'?', accent:'#fbbf24', inputs:['in'], outputs:['yes','no'], fields:[{key:'status', label:'Status', type:'status'}] },
    'if.source': { kind:'condition', group:'Only if', title:'If source is', hint:'Yes path if the lead came from this source.', icon:'?', accent:'#fbbf24', inputs:['in'], outputs:['yes','no'], fields:[{key:'source', label:'Source', type:'source'}] },
    'if.priority': { kind:'condition', group:'Only if', title:'If priority is', hint:'Yes path if priority matches.', icon:'?', accent:'#fbbf24', inputs:['in'], outputs:['yes','no'], fields:[{key:'priority', label:'Priority', type:'priority'}] },
    'if.valueGt': { kind:'condition', group:'Only if', title:'If value is over', hint:'Yes path if deal value is greater than this.', icon:'?', accent:'#fbbf24', inputs:['in'], outputs:['yes','no'], fields:[{key:'amount', label:'USD amount', type:'number'}] },
    'if.noDate': { kind:'condition', group:'Only if', title:'If no next date', hint:'Yes path if the lead has no next-action date.', icon:'?', accent:'#fbbf24', inputs:['in'], outputs:['yes','no'], fields:[] },
    'if.channel': { kind:'condition', group:'Only if', title:'If channel is', hint:'Yes path if they prefer this channel.', icon:'?', accent:'#fbbf24', inputs:['in'], outputs:['yes','no'], fields:[{key:'channel', label:'Channel', type:'channel'}] },
    'action.setStatus': { kind:'action', group:'Then', title:'Update status', hint:'Move the lead to a pipeline stage.', icon:'→', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[{key:'status', label:'New status', type:'status'}] },
    'action.setNext': { kind:'action', group:'Then', title:'Set next action + date', hint:'Give the lead a clear next step.', icon:'→', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[{key:'nextAction', label:'Next action', type:'text', placeholder:'Send Day-1 message'},{key:'days', label:'Days from today', type:'number', placeholder:'1'}] },
    'action.setPriority': { kind:'action', group:'Then', title:'Set priority', hint:'Mark High / Medium / Low.', icon:'→', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[{key:'priority', label:'Priority', type:'priority'}] },
    'action.addNote': { kind:'action', group:'Then', title:'Add a note', hint:'Append a timestamped note on the lead.', icon:'→', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[{key:'note', label:'Note', type:'textarea', placeholder:'Followed up from Flow'}] },
    'action.setOffer': { kind:'action', group:'Then', title:'Set offer', hint:'Attach a TRL offer to the lead.', icon:'→', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[{key:'offer', label:'Offer', type:'offer'}] },
    'action.draftWA': { kind:'action', group:'Then', title:'Draft WhatsApp', hint:'Prepare a Day-1 style message. Copies when you run it.', icon:'→', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[{key:'template', label:'Message (use {{name}} {{business}} {{me}})', type:'textarea', placeholder:''}] },
    'action.toast': { kind:'action', group:'Then', title:'Show a reminder', hint:'Pop a reminder in this workspace.', icon:'→', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[{key:'message', label:'Reminder', type:'text', placeholder:'Check overdue leads'}] }
  };

  const GROUPS = ['When','Only if','Then'];

  function nid(){ return 'n'+Math.random().toString(36).slice(2,9); }
  function wid(){ return 'w'+Math.random().toString(36).slice(2,9); }
  function eid(){ return 'e'+Math.random().toString(36).slice(2,9); }
  function todayISO(){ return window.todayISO ? window.todayISO() : new Date().toISOString().slice(0,10); }
  function esc(s){ return window.esc ? window.esc(String(s||'')) : String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function toast(m,t){ if (window.toast) window.toast(m,t); }
  function meta(type){ return NODES[type] || { kind:'action', title:type, hint:'', accent:'#60a5fa', inputs:['in'], outputs:['out'], fields:[], icon:'•' }; }

  function addDays(n){
    const d = new Date(); d.setDate(d.getDate() + (parseInt(n,10)||0));
    return d.toISOString().slice(0,10);
  }

  function linear(types, configs = []){
    const nodes = types.map((type, i) => ({
      id: nid(), type, x: 80 + i * 300, y: 180, config: configs[i] || {}
    }));
    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const fromMeta = meta(nodes[i].type);
      const port = fromMeta.outputs.includes('yes') ? 'yes' : 'out';
      edges.push({ id: eid(), from: nodes[i].id, to: nodes[i+1].id, port });
    }
    return { nodes, edges };
  }

  const TEMPLATES = [
    {
      id:'never-forget',
      name:'Follow-up never forgets',
      blurb:'When a lead is overdue, mark it High and prepare a WhatsApp nudge.',
      pipe:[['w','Overdue'],['t','High priority'],['t','Draft WhatsApp']],
      build(){ return linear(
        ['trigger.overdue','action.setPriority','action.draftWA'],
        [{}, {priority:'High'}, {template:''}]
      ); }
    },
    {
      id:'day1',
      name:'Day-1 auto',
      blurb:'Every new lead gets “Send Day-1 message” dated tomorrow. No silent drift.',
      pipe:[['w','New lead'],['t','Next action tomorrow']],
      build(){ return linear(
        ['trigger.newLead','action.setNext'],
        [{}, {nextAction:'Send Day-1 message', days:'1'}]
      ); }
    },
    {
      id:'book-call',
      name:'Replied → book the call',
      blurb:'When someone replies, set the next step to book a call and raise priority.',
      pipe:[['w','Status = replied'],['t','Book a call'],['t','High']],
      build(){ return linear(
        ['trigger.statusChanged','action.setNext','action.setPriority'],
        [{status:'replied'}, {nextAction:'Book a discovery call', days:'1'}, {priority:'High'}]
      ); }
    },
    {
      id:'daily-ping',
      name:'Daily Loop ping',
      blurb:'When you run Daily Loop, remind yourself how many leads are overdue.',
      pipe:[['w','Daily Loop'],['t','Show reminder']],
      build(){ return linear(
        ['trigger.dailyLoop','action.toast'],
        [{}, {message:'Loop complete — fix red (overdue) first, then yellow (today).'}]
      ); }
    },
    {
      id:'high-value',
      name:'High-value alert',
      blurb:'New leads worth over $499 are marked High and you get a reminder.',
      pipe:[['w','New lead'],['i','Value > $499'],['t','High + remind']],
      build(){
        const t = nid(), c = nid(), a = nid(), r = nid();
        return {
          nodes:[
            {id:t, type:'trigger.newLead', x:80, y:180, config:{}},
            {id:c, type:'if.valueGt', x:380, y:180, config:{amount:'499'}},
            {id:a, type:'action.setPriority', x:680, y:120, config:{priority:'High'}},
            {id:r, type:'action.toast', x:980, y:120, config:{message:'High-value lead — treat as priority.'}}
          ],
          edges:[
            {id:eid(), from:t, to:c, port:'out'},
            {id:eid(), from:c, to:a, port:'yes'},
            {id:eid(), from:a, to:r, port:'out'}
          ]
        };
      }
    },
    {
      id:'won-note',
      name:'Won deal note',
      blurb:'When a lead is closed-won, stamp a delivery note so work actually starts.',
      pipe:[['w','Closed-won'],['t','Add note']],
      build(){ return linear(
        ['trigger.statusChanged','action.addNote'],
        [{status:'closed-won'}, {note:'Closed-won — send invoice / start delivery. Logged by Flow.'}]
      ); }
    },
  ];

  const ui = {
    page:'home',
    editing:null,
    selected:null,
    connecting:null,
    pan:{x:40,y:40},
    zoom:1,
    drag:null,
    panDrag:null,
    lastRun:null,
    wizard:{step:1, trigger:'trigger.newLead', condition:'', action:'action.setNext', config:{}, name:''}
  };

  function blankStore(){ return { version:1, workflows:[] }; }
  function loadStore(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!raw || !Array.isArray(raw.workflows)) return blankStore();
      return raw;
    } catch { return blankStore(); }
  }
  function saveStore(s){ localStorage.setItem(STORE, JSON.stringify(s)); }
  function loadRuns(){
    try { return JSON.parse(localStorage.getItem(RUNS) || '{"runs":[]}'); }
    catch { return { runs:[] }; }
  }
  function saveRun(run){
    const box = loadRuns();
    box.runs = [run, ...(box.runs||[])].slice(0, 50);
    localStorage.setItem(RUNS, JSON.stringify(box));
  }

  function readLeads(){
    if (typeof window.getLeads === 'function') return window.getLeads() || [];
    try { return JSON.parse(localStorage.getItem('trl-lead-os-v1') || '[]'); } catch { return []; }
  }
  function writeLeads(next){
    if (typeof window.setLeads === 'function') { window.setLeads(next); return; }
    localStorage.setItem('trl-lead-os-v1', JSON.stringify(next));
    if (typeof window.load === 'function') window.load();
    if (typeof window.render === 'function') window.render();
  }

  function isOverdue(l){
    return !!(l.nextActionDate && l.nextActionDate < todayISO() && !['closed-won','closed-lost'].includes(l.status));
  }
  function interpolate(str, lead){
    const me = (typeof window.getName === 'function' ? window.getName() : 'You').split(' ')[0];
    return String(str || '')
      .replace(/\{\{name\}\}/gi, lead.name || '')
      .replace(/\{\{business\}\}/gi, lead.businessType || 'your business')
      .replace(/\{\{status\}\}/gi, lead.status || '')
      .replace(/\{\{nextAction\}\}/gi, lead.nextAction || '')
      .replace(/\{\{me\}\}/gi, me);
  }
  function defaultWA(lead){
    const me = (typeof window.getName === 'function' ? window.getName() : 'You').split(' ')[0];
    const first = (lead.name || 'there').split(' ')[0];
    return `Hi ${first}, it's ${me} — I build simple systems so enquiries never get lost. Quick question: when someone reaches out to ${lead.businessType || 'your business'}, how does follow-up happen?`;
  }

  function triggerMatches(node, ctx){
    const t = node.type;
    const lead = ctx.lead;
    if (t === 'trigger.manual') return ctx.event === 'manual' || ctx.event === 'preview';
    if (t === 'trigger.newLead') return ctx.event === 'newLead' || ctx.event === 'manual' || ctx.event === 'preview';
    if (t === 'trigger.statusChanged') {
      const want = (node.config || {}).status;
      if (ctx.event === 'statusChanged') return !want || ctx.to === want;
      if (ctx.event === 'manual' || ctx.event === 'preview') return !want || (lead && lead.status === want);
      return false;
    }
    if (t === 'trigger.overdue') {
      if (!(ctx.event === 'overdue' || ctx.event === 'manual' || ctx.event === 'preview')) return false;
      return !!(lead && isOverdue(lead));
    }
    if (t === 'trigger.dueToday') {
      if (!(ctx.event === 'dueToday' || ctx.event === 'manual' || ctx.event === 'preview')) return false;
      return !!(lead && lead.nextActionDate === todayISO());
    }
    if (t === 'trigger.dailyLoop') return ctx.event === 'dailyLoop' || ctx.event === 'manual' || ctx.event === 'preview';
    return false;
  }

  function evalCondition(node, lead){
    const c = node.config || {};
    if (!lead) return false;
    switch (node.type) {
      case 'if.status': return lead.status === c.status;
      case 'if.source': return lead.source === c.source;
      case 'if.priority': return lead.priority === c.priority;
      case 'if.channel': return lead.channel === c.channel;
      case 'if.noDate': return !lead.nextActionDate;
      case 'if.valueGt': return Number(lead.value || 0) > Number(c.amount || 0);
      default: return true;
    }
  }

  function execAction(node, lead, ctx){
    const c = node.config || {};
    const detail = { type: node.type };
    if (!lead) return { detail: { error:'No lead' }, mutated:false };
    switch (node.type) {
      case 'action.setStatus':
        lead.status = c.status || lead.status;
        detail.text = 'Status → ' + lead.status;
        return { detail, mutated:true };
      case 'action.setNext':
        lead.nextAction = c.nextAction || lead.nextAction || 'Follow up';
        lead.nextActionDate = addDays(c.days == null || c.days === '' ? 1 : c.days);
        detail.text = lead.nextAction + ' on ' + lead.nextActionDate;
        return { detail, mutated:true };
      case 'action.setPriority':
        lead.priority = c.priority || 'High';
        detail.text = 'Priority → ' + lead.priority;
        return { detail, mutated:true };
      case 'action.addNote': {
        const stamp = todayISO() + ' · Flow: ' + interpolate(c.note || 'Updated by Flow', lead);
        lead.notes = lead.notes ? (lead.notes + '\n' + stamp) : stamp;
        detail.text = stamp;
        return { detail, mutated:true };
      }
      case 'action.setOffer':
        lead.offer = c.offer || lead.offer;
        detail.text = 'Offer → ' + lead.offer;
        return { detail, mutated:true };
      case 'action.draftWA': {
        const msg = interpolate(c.template, lead) || defaultWA(lead);
        detail.text = msg;
        detail.clipboard = msg;
        if (!ctx.preview && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(msg).catch(() => {});
        }
        return { detail, mutated:false };
      }
      case 'action.toast':
        detail.text = interpolate(c.message || 'Flow ran', lead);
        if (!ctx.preview && !ctx.silentToast) toast(detail.text, 'info');
        return { detail, mutated:false };
      default:
        detail.text = 'Unknown action';
        return { detail, mutated:false };
    }
  }

  function collectTargets(wf, ctx){
    if (ctx.lead) return [ctx.lead];
    const leads = readLeads();
    const trigger = (wf.nodes || []).find(n => meta(n.type).kind === 'trigger');
    if (!trigger) return [];
    switch (trigger.type) {
      case 'trigger.newLead': return leads.slice(-1);
      case 'trigger.statusChanged': {
        const want = (trigger.config || {}).status;
        return want ? leads.filter(l => l.status === want) : leads.slice(-5);
      }
      case 'trigger.overdue': return leads.filter(isOverdue);
      case 'trigger.dueToday': return leads.filter(l => l.nextActionDate === todayISO());
      case 'trigger.dailyLoop':
      case 'trigger.manual':
        return leads.filter(l => !['closed-won','closed-lost'].includes(l.status)).slice(0, 25);
      default: return leads.slice(0, 1);
    }
  }

  function runWorkflow(wf, ctx = {}){
    ctx = { event: ctx.event || 'manual', preview: !!ctx.preview, silentToast: !!ctx.silentToast, lead: ctx.lead, to: ctx.to, from: ctx.from };
    const nodes = {};
    (wf.nodes || []).forEach(n => { nodes[n.id] = n; });
    const outs = {};
    (wf.edges || []).forEach(e => {
      if (!outs[e.from]) outs[e.from] = {};
      const port = e.port || 'out';
      if (!outs[e.from][port]) outs[e.from][port] = [];
      outs[e.from][port].push(e.to);
    });
    const log = [];
    let mutated = false;
    const seen = new Set();
    function fire(nodeId, lead, depth){
      if (depth > 20 || seen.has(nodeId + ':' + (lead && lead.id))) return;
      seen.add(nodeId + ':' + (lead && lead.id));
      const node = nodes[nodeId];
      if (!node) return;
      const m = meta(node.type);
      const entry = { nodeId, type: node.type, title: m.title, status:'ok', detail:'' };
      if (m.kind === 'trigger') {
        if (!triggerMatches(node, Object.assign({}, ctx, { lead }))) {
          entry.status = 'skipped';
          log.push(entry);
          return;
        }
        log.push(entry);
        (outs[nodeId] && outs[nodeId].out || []).forEach(id => fire(id, lead, depth + 1));
        return;
      }
      if (m.kind === 'condition') {
        const pass = evalCondition(node, lead);
        entry.status = pass ? 'yes' : 'no';
        entry.detail = pass ? 'Yes' : 'No';
        log.push(entry);
        const port = pass ? 'yes' : 'no';
        (outs[nodeId] && outs[nodeId][port] || []).forEach(id => fire(id, lead, depth + 1));
        return;
      }
      const result = execAction(node, lead, ctx);
      entry.detail = (result.detail && (result.detail.text || result.detail.error)) || '';
      if (result.detail && result.detail.clipboard) entry.clipboard = result.detail.clipboard;
      if (result.mutated) mutated = true;
      log.push(entry);
      (outs[nodeId] && outs[nodeId].out || []).forEach(id => fire(id, lead, depth + 1));
    }
    const triggers = (wf.nodes || []).filter(n => meta(n.type).kind === 'trigger');
    const targets = collectTargets(wf, ctx);
    if (!targets.length) {
      log.push({ nodeId:'', type:'system', title:'No matching leads', status:'skipped', detail:'Nothing to run against.' });
    } else {
      targets.forEach(lead => {
        const working = ctx.preview ? JSON.parse(JSON.stringify(lead)) : lead;
        triggers.forEach(t => fire(t.id, working, 0));
      });
    }
    return { log, mutated, targets: targets.length };
  }

  function persistLeadChanges(changed){
    if (!changed.length) return;
    const all = readLeads();
    const map = {};
    changed.forEach(l => { if (l && l.id != null) map[l.id] = l; });
    const next = all.map(l => map[l.id] != null ? map[l.id] : l);
    window._flowSilent = true;
    try { writeLeads(next); }
    finally { window._flowSilent = false; }
  }

  function executeAndSave(wf, ctx){
    const leads = readLeads();
    const byId = {};
    leads.forEach(l => { byId[l.id] = l; });
    if (ctx.lead && ctx.lead.id != null && byId[ctx.lead.id]) ctx.lead = byId[ctx.lead.id];
    const result = runWorkflow(wf, ctx);
    if (result.mutated && !ctx.preview) persistLeadChanges(leads);
    const run = {
      id: 'r' + Date.now(),
      workflowId: wf.id,
      name: wf.name,
      at: new Date().toISOString(),
      event: ctx.event,
      preview: !!ctx.preview,
      status: result.log.some(x => x.status === 'ok' || x.status === 'yes') ? 'ok' : 'skipped',
      targets: result.targets,
      log: result.log
    };
    if (!ctx.preview) saveRun(run);
    ui.lastRun = run;
    return result;
  }

  function dispatch(event, payload = {}){
    if (window._flowSilent) return;
    const store = loadStore();
    const enabled = store.workflows.filter(w => w.enabled);
    if (!enabled.length) return;
    let ran = 0, changed = 0;
    enabled.forEach(wf => {
      const has = (wf.nodes || []).some(n => {
        if (event === 'newLead') return n.type === 'trigger.newLead';
        if (event === 'statusChanged') return n.type === 'trigger.statusChanged';
        if (event === 'overdue') return n.type === 'trigger.overdue';
        if (event === 'dueToday') return n.type === 'trigger.dueToday';
        if (event === 'dailyLoop') return n.type === 'trigger.dailyLoop';
        if (event === 'manual') return true;
        return false;
      });
      if (!has) return;
      const result = executeAndSave(wf, Object.assign({ event, silentToast: true }, payload));
      ran++;
      if (result.mutated) changed++;
    });
    if (ran && event !== 'preview' && !payload.quiet) {
      const msg = ran + ' flow' + (ran===1?'':'s') + ' ran' + (changed ? ' · leads updated' : '');
      toast(msg, changed ? 'ok' : 'info');
      paint();
    } else if (ran && payload.quiet && location.hash.replace('#','') === 'flow') {
      paint();
    }
  }

  function createWorkflow(partial){
    const store = loadStore();
    const wf = Object.assign({
      id: wid(),
      name: 'Untitled flow',
      enabled: false,
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0
    }, partial);
    store.workflows.unshift(wf);
    saveStore(store);
    return wf;
  }

  function installTemplate(id, opts = {}){
    const t = TEMPLATES.find(x => x.id === id);
    if (!t) return null;
    const graph = t.build();
    return createWorkflow({
      name: t.name,
      description: t.blurb,
      templateId: t.id,
      enabled: !!opts.enabled,
      nodes: graph.nodes,
      edges: graph.edges
    });
  }

  function updateWorkflow(id, patch){
    const store = loadStore();
    const i = store.workflows.findIndex(w => w.id === id);
    if (i < 0) return null;
    store.workflows[i] = Object.assign({}, store.workflows[i], patch, { updatedAt: new Date().toISOString() });
    saveStore(store);
    return store.workflows[i];
  }

  function removeWorkflow(id){
    const store = loadStore();
    store.workflows = store.workflows.filter(w => w.id !== id);
    saveStore(store);
  }

  function summarize(wf){
    const when = (wf.nodes || []).filter(n => meta(n.type).kind === 'trigger').map(n => meta(n.type).title);
    const then = (wf.nodes || []).filter(n => meta(n.type).kind === 'action').map(n => meta(n.type).title);
    return (when[0] || 'When…') + ' → ' + (then[0] || 'do something');
  }

  /* ---------------- UI ---------------- */
  function root(){ return document.getElementById('flowApp'); }

  function paint(){
    const el = root();
    if (!el) return;
    if (ui.page === 'editor' && ui.editing) paintEditor(el);
    else if (ui.page === 'wizard') paintWizard(el);
    else if (ui.page === 'learn') paintLearn(el);
    else if (ui.page === 'runs') paintRuns(el);
    else paintHome(el);
    const n = loadStore().workflows.filter(w => w.enabled).length;
    const badge = document.getElementById('sCountFlow');
    if (badge) badge.textContent = n;
    const tabCount = document.getElementById('countFlow');
    if (tabCount) tabCount.textContent = String(loadStore().workflows.length);
  }

  function homeSeg(which){
    return `<div class="flow-seg" role="tablist">
      <button type="button" class="${which==='home'?'on':''}" onclick="TRLFlow.page('home')">Flows</button>
      <button type="button" class="${which==='learn'?'on':''}" onclick="TRLFlow.page('learn')">What is this?</button>
      <button type="button" class="${which==='runs'?'on':''}" onclick="TRLFlow.page('runs')">Run history</button>
    </div>`;
  }

  function paintHome(el){
    const store = loadStore();
    const list = store.workflows;
    el.innerHTML = `
      <div class="flow-hero">
        <div class="flow-kicker">TRL Flow · Automations</div>
        <h2>When this happens, do that.<br>No n8n knowledge needed.</h2>
        <p>n8n is a tool where you connect boxes: <b>when</b> something happens, <b>then</b> something else runs. TRL Flow is that idea, built for your leads, inside this browser. Nothing is sent to the cloud.</p>
        <div class="flow-steps">
          <div class="flow-step"><span class="flow-chip when">1 · WHEN</span><b>A lead event</b><span>New lead, overdue, status change, or you press Run.</span></div>
          <div class="flow-step"><span class="flow-chip iff">2 · ONLY IF</span><b>An optional filter</b><span>Skip unless status, source, or value matches.</span></div>
          <div class="flow-step"><span class="flow-chip then">3 · THEN</span><b>An action</b><span>Update the lead, draft a message, or show a reminder.</span></div>
        </div>
      </div>
      <div class="flow-toolbar-home">
        <div><h3>Start with a ready-made recipe</h3><div style="font-size:12px;color:var(--gray-500)">One click adds it. It stays off until you turn it on.</div></div>
        ${homeSeg('home')}
      </div>
      <div class="flow-templates">
        ${TEMPLATES.map(t => `
          <button type="button" class="flow-tcard" onclick="TRLFlow.useTemplate('${t.id}')">
            <h4>${esc(t.name)}</h4>
            <p>${esc(t.blurb)}</p>
            <div class="flow-pipe">${t.pipe.map((p,i)=>`${i?'<em>→</em>':''}<i class="${p[0]}">${esc(p[1])}</i>`).join('')}</div>
            <div style="font-size:12px;font-weight:800;color:var(--blue)">Add this recipe →</div>
          </button>`).join('')}
      </div>
      <div class="flow-toolbar-home" style="margin-top:8px">
        <h3>Your flows <span style="color:var(--gray-500);font-size:12px;font-weight:700">${list.length}</span></h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="TRLFlow.page('wizard')">Simple wizard</button>
          <button class="btn btn-primary" onclick="TRLFlow.newCanvas()">New visual flow</button>
        </div>
      </div>
      <div class="flow-list">
        ${list.length ? list.map(wf => `
          <div class="flow-row">
            <div class="mark" style="background:${wf.enabled?'#059669':'#334155'}">${wf.enabled?'ON':'OFF'}</div>
            <div class="meta">
              <b>${esc(wf.name)}</b>
              <span>${esc(summarize(wf))} · ${(wf.nodes||[]).length} boxes</span>
            </div>
            <div class="acts">
              <button class="toggle ${wf.enabled?'on':''}" title="Turn on or off" onclick="TRLFlow.toggle('${wf.id}')"><i></i></button>
              <button class="btn btn-secondary" style="padding:6px 10px;font-size:11px" onclick="TRLFlow.run('${wf.id}')">Run</button>
              <button class="btn btn-secondary" style="padding:6px 10px;font-size:11px" onclick="TRLFlow.edit('${wf.id}')">Edit</button>
              <button class="btn" style="padding:6px 10px;font-size:11px;background:var(--red-50);color:var(--red);border:1px solid var(--red-100)" onclick="TRLFlow.remove('${wf.id}')">Delete</button>
            </div>
          </div>`).join('') : `<div class="flow-empty"><b>No flows yet</b><p style="margin-top:6px">Add a recipe above, or build one with the wizard. Think: when a lead is overdue → mark it High.</p></div>`}
      </div>
    `;
  }

  function paintLearn(el){
    el.innerHTML = `
      <div class="flow-toolbar-home">${homeSeg('learn')}<button class="btn btn-primary" onclick="TRLFlow.page('home')">Back to flows</button></div>
      <div class="flow-help">
        <h3>What is n8n — in one minute</h3>
        <p>n8n (said “n-eight-n”) is a popular <b>workflow automation</b> app. Instead of writing code, you drop boxes on a canvas and draw lines between them. Each box is either a <b>trigger</b> (when) or an <b>action</b> (then). When the trigger fires, data flows along the lines and each action runs.</p>
        <p>People use n8n to connect Gmail, Slack, Sheets, CRMs… TRL Flow uses the same picture — boxes and lines — but only talks to <b>your local leads</b>. There is no account, no cloud, and no API key.</p>
        <div class="flow-vs">
          <div><b>n8n</b>Hundreds of apps. You host it or pay for cloud. Powerful, easy to get lost.</div>
          <div><b>TRL Flow</b>Your pipeline only. Recipes for follow-ups, status, and message drafts.</div>
        </div>
        <h3>How to use it</h3>
        <ol>
          <li><b>Pick a recipe</b> on the Flows tab — it is added but switched OFF, so nothing surprises you.</li>
          <li><b>Press Edit</b> to see the boxes. Green = when, yellow = only if, blue = then.</li>
          <li><b>Press Run</b> to try it on matching leads right now. Watch the run history.</li>
          <li><b>Flip the toggle ON</b> if you want it to fire automatically next time that event happens (new lead, status change, Daily Loop check).</li>
        </ol>
        <p>The Simple wizard builds a 2–3 box flow without touching the canvas. The visual canvas is there when you want to chain more steps, the same way n8n does.</p>
        <p style="font-size:12px;color:var(--gray-500)">Local workspace: flows are stored in this browser next to your leads. Export leads regularly. Automations update the same local records — they do not send WhatsApp, email, or payments.</p>
      </div>
    `;
  }

  function paintRuns(el){
    const runs = (loadRuns().runs || []);
    el.innerHTML = `
      <div class="flow-toolbar-home">${homeSeg('runs')}<button class="btn btn-secondary" onclick="TRLFlow.page('home')">Back to flows</button></div>
      <div class="flow-runs">
        ${runs.length ? runs.map(r => `
          <div class="flow-run">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <b>${esc(r.name || 'Flow')}</b>
              <span style="color:var(--gray-500)">${esc((r.at||'').replace('T',' ').slice(0,16))} · ${esc(r.event)}${r.preview?' · preview':''}</span>
            </div>
            <div style="margin-top:6px;color:var(--gray-600)">${r.targets||0} lead(s) · ${esc(r.status)}</div>
            <div style="margin-top:8px;display:grid;gap:4px">${(r.log||[]).slice(0,8).map(s => `<div style="font-size:11px">${esc(s.title)} — <b>${esc(s.status)}</b> ${esc(String(s.detail||'').slice(0,120))}</div>`).join('')}</div>
          </div>`).join('') : `<div class="flow-empty">No runs yet. Open a flow and press Run.</div>`}
      </div>
    `;
  }

  function paintWizard(el){
    const w = ui.wizard;
    const step = w.step;
    const triggerList = Object.keys(NODES).filter(k => NODES[k].kind === 'trigger');
    const condList = [''].concat(Object.keys(NODES).filter(k => NODES[k].kind === 'condition'));
    const actionList = Object.keys(NODES).filter(k => NODES[k].kind === 'action');
    function picks(list, current, attr){
      return `<div class="flow-wgrid">${list.map(k => {
        if (!k) return `<button type="button" class="flow-wpick ${current===''?'on':''}" onclick="TRLFlow.wizSet('${attr}','')"><b>No filter</b><span>Always continue</span></button>`;
        const n = NODES[k];
        return `<button type="button" class="flow-wpick ${current===k?'on':''}" onclick="TRLFlow.wizSet('${attr}','${k}')"><b>${esc(n.title)}</b><span>${esc(n.hint)}</span></button>`;
      }).join('')}</div>`;
    }
    function fieldsFor(type){
      const m = meta(type);
      if (!m.fields || !m.fields.length) return '<p style="font-size:12px;color:var(--gray-500)">No extra settings for this box.</p>';
      return m.fields.map(f => fieldHTML(f, (w.config[type]||{})[f.key], `TRLFlow.wizField('${type}','${f.key}', this.value)`)).join('');
    }
    el.innerHTML = `
      <div class="flow-wizard">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div>
            <div class="flow-progress">
              <span class="${step>=1?'on':''}">1 When</span> →
              <span class="${step>=2?'on':''}">2 Only if</span> →
              <span class="${step>=3?'on':''}">3 Then</span> →
              <span class="${step>=4?'on':''}">4 Name</span>
            </div>
            <h3 style="font-family:'Sora',sans-serif;margin-top:6px">Simple wizard</h3>
          </div>
          <button class="btn btn-secondary" onclick="TRLFlow.page('home')">Cancel</button>
        </div>
        ${step===1?`<div><b>When should this run?</b><p style="font-size:12px;color:var(--gray-500);margin:4px 0 10px">Pick the starting moment. You can change it later on the canvas.</p>${picks(triggerList, w.trigger, 'trigger')}</div>`:''}
        ${step===2?`<div><b>Only run if… (optional)</b><p style="font-size:12px;color:var(--gray-500);margin:4px 0 10px">Skip this to always continue after the trigger.</p>${picks(condList, w.condition, 'condition')}${w.condition?`<div style="margin-top:12px;display:grid;gap:8px">${fieldsFor(w.condition)}</div>`:''}</div>`:''}
        ${step===3?`<div><b>Then do what?</b><p style="font-size:12px;color:var(--gray-500);margin:4px 0 10px">This is the action that updates a lead or drafts a message.</p>${picks(actionList, w.action, 'action')}<div style="margin-top:12px;display:grid;gap:8px">${fieldsFor(w.action)}</div></div>`:''}
        ${step===4?`<div class="field"><label>Name this flow</label><input class="input" value="${esc(w.name)}" oninput="TRLFlow.wizName(this.value)" placeholder="e.g. Overdue WhatsApp nudge"></div>
          <div style="padding:12px;background:var(--gray-50);border-radius:12px;font-size:13px">
            <b>Recipe preview</b>
            <div class="flow-pipe" style="margin-top:8px">
              <i class="w">${esc(meta(w.trigger).title)}</i><em>→</em>
              ${w.condition?`<i class="i">${esc(meta(w.condition).title)}</i><em>→</em>`:''}
              <i class="t">${esc(meta(w.action).title)}</i>
            </div>
          </div>`:''}
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${step>1?`<button class="btn btn-secondary" onclick="TRLFlow.wizStep(-1)">Back</button>`:''}
          ${step<4?`<button class="btn btn-primary" onclick="TRLFlow.wizStep(1)">Continue →</button>`:`<button class="btn btn-primary" onclick="TRLFlow.wizSave()">Create flow →</button>`}
        </div>
      </div>
    `;
  }

  function fieldHTML(f, value, onchange){
    const v = value == null ? '' : value;
    const label = `<label>${esc(f.label||f.key)}</label>`;
    if (f.type === 'textarea') return `<div class="field">${label}<textarea class="input" oninput="${onchange}">${esc(v)}</textarea></div>`;
    if (f.type === 'number') return `<div class="field">${label}<input class="input" type="number" value="${esc(v)}" oninput="${onchange}" placeholder="${esc(f.placeholder||'')}"></div>`;
    const opts = f.type==='status'?STATUSES:f.type==='source'?SOURCES:f.type==='channel'?CHANNELS:f.type==='priority'?PRIORITIES:f.type==='offer'?OFFERS:null;
    if (opts) {
      return `<div class="field">${label}<select class="input" onchange="${onchange}"><option value="">Choose</option>${opts.map(o=>`<option ${String(v)===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
    }
    return `<div class="field">${label}<input class="input" value="${esc(v)}" oninput="${onchange}" placeholder="${esc(f.placeholder||'')}"></div>`;
  }

  function paintEditor(el){
    const wf = loadStore().workflows.find(w => w.id === ui.editing);
    if (!wf) { ui.page = 'home'; paintHome(el); return; }
    const sel = (wf.nodes || []).find(n => n.id === ui.selected);
    const grouped = GROUPS.map(g => ({
      g, items: Object.keys(NODES).filter(k => NODES[k].group === g)
    }));
    el.innerHTML = `
      <div class="flow-toolbar-home">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="TRLFlow.page('home')">← All flows</button>
          <span style="font-size:12px;color:var(--gray-500)">Drag a box in. Click a round port, then another, to draw a line — the same idea as n8n.</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="TRLFlow.preview()">Preview</button>
          <button class="btn btn-primary" onclick="TRLFlow.run('${wf.id}')">Run now</button>
        </div>
      </div>
      <div class="flow-editor" id="flowEditor">
        <aside class="flow-palette">
          <div class="flow-pane-h">Add a box</div>
          ${grouped.map(gr => `
            <div class="flow-pal-group">
              <div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--flow-muted);margin:6px 4px">${esc(gr.g)}</div>
              ${gr.items.map(k => {
                const n = NODES[k];
                return `<button type="button" class="flow-pal-item" draggable="true" data-type="${k}" ondragstart="TRLFlow.dragType(event,'${k}')" onclick="TRLFlow.addNode('${k}')">
                  <span class="dot" style="background:${n.accent}22;color:${n.accent}">${esc(n.icon)}</span>
                  <span><b>${esc(n.title)}</b><span>${esc(n.hint)}</span></span>
                </button>`;
              }).join('')}
            </div>`).join('')}
        </aside>
        <section class="flow-stage">
          <div class="flow-stage-bar">
            <input id="flowName" value="${esc(wf.name)}" onchange="TRLFlow.rename(this.value)" aria-label="Flow name">
            <button class="flow-iconbtn" title="Zoom out" onclick="TRLFlow.zoom(-0.1)">−</button>
            <button class="flow-iconbtn" title="Zoom in" onclick="TRLFlow.zoom(0.1)">+</button>
            <button class="flow-iconbtn" title="Reset view" onclick="TRLFlow.resetView()">⌂</button>
            <button class="toggle ${wf.enabled?'on':''}" title="Enable" onclick="TRLFlow.toggle('${wf.id}')"><i></i></button>
          </div>
          ${(wf.nodes||[]).length?'' : `<div class="flow-hint"><b>Start with a green WHEN box</b>Click one on the left, or drag it in. Then add a blue THEN box and connect the dots.</div>`}
          <div class="flow-world-wrap" id="flowWrap">
            <div class="flow-world" id="flowWorld" style="transform:translate(${ui.pan.x}px,${ui.pan.y}px) scale(${ui.zoom})">
              <svg class="flow-svg" id="flowSvg"></svg>
            </div>
          </div>
        </section>
        <aside class="flow-inspector">
          <div class="flow-pane-h">${sel ? 'Box settings' : 'Inspector'}</div>
          <div class="box" id="flowInspectorBody"></div>
          <div class="flow-pane-h">Last run</div>
          <div class="box"><div class="flow-log" id="flowLog"></div></div>
        </aside>
      </div>
    `;
    mountNodes(wf);
    paintInspector(wf, sel);
    paintLog();
    bindCanvas(wf);
  }

  function mountNodes(wf){
    const world = document.getElementById('flowWorld');
    if (!world) return;
    (wf.nodes || []).forEach(node => {
      const m = meta(node.type);
      const div = document.createElement('div');
      div.className = 'flow-node' + (ui.selected === node.id ? ' sel' : '');
      if (ui.lastRun && ui.editing === (loadStore().workflows.find(w=>w.id===ui.editing)||{}).id) {
        const hit = (ui.lastRun.log || []).find(s => s.nodeId === node.id);
        if (hit) div.classList.add(hit.status === 'skipped' ? 'run-skip' : hit.status === 'no' ? 'run-no' : 'run-ok');
      }
      div.dataset.id = node.id;
      div.style.left = (node.x || 80) + 'px';
      div.style.top = (node.y || 80) + 'px';
      const sub = nodeSub(node);
      const cond = m.outputs.includes('yes');
      div.innerHTML = `
        <div class="flow-node-bar" style="background:${m.accent}"></div>
        ${m.inputs.length ? `<div class="flow-port in" data-port="in" data-node="${node.id}"></div>` : ''}
        <div class="flow-node-body">
          <div class="flow-node-kind">${m.kind === 'trigger' ? 'WHEN' : m.kind === 'condition' ? 'ONLY IF' : 'THEN'}</div>
          <div class="flow-node-title">${esc(m.title)}</div>
          <div class="flow-node-sub">${esc(sub)}</div>
        </div>
        ${cond ? `<div class="flow-port-label yes">YES</div><div class="flow-port-label no">NO</div>
          <div class="flow-port out yes" data-port="yes" data-node="${node.id}"></div>
          <div class="flow-port out no" data-port="no" data-node="${node.id}"></div>`
          : `<div class="flow-port out" data-port="out" data-node="${node.id}"></div>`}
      `;
      world.appendChild(div);
    });
    drawWires(wf);
  }

  function nodeSub(node){
    const c = node.config || {};
    return c.status || c.source || c.priority || c.channel || c.nextAction || c.offer || c.role || c.message || c.note || c.amount || meta(node.type).hint;
  }

  function drawWires(wf, draft){
    const svg = document.getElementById('flowSvg');
    const world = document.getElementById('flowWorld');
    if (!svg || !world) return;
    svg.setAttribute('width', '4000');
    svg.setAttribute('height', '3000');
    const paths = [];
    function portCenter(nodeId, port){
      const el = world.querySelector(`.flow-port[data-node="${nodeId}"][data-port="${port}"]`);
      const nodeEl = world.querySelector(`.flow-node[data-id="${nodeId}"]`);
      if (!el || !nodeEl) return null;
      return {
        x: nodeEl.offsetLeft + el.offsetLeft + el.offsetWidth/2,
        y: nodeEl.offsetTop + el.offsetTop + el.offsetHeight/2
      };
    }
    function bezier(a,b){
      const dx = Math.max(60, Math.abs(b.x - a.x) * 0.45);
      return `M ${a.x} ${a.y} C ${a.x+dx} ${a.y}, ${b.x-dx} ${b.y}, ${b.x} ${b.y}`;
    }
    (wf.edges || []).forEach(e => {
      const a = portCenter(e.from, e.port || 'out');
      const b = portCenter(e.to, 'in');
      if (!a || !b) return;
      const active = ui.lastRun && (ui.lastRun.log || []).some(s => s.nodeId === e.from && (s.status === 'ok' || s.status === 'yes'));
      paths.push(`<path class="${active?'active':''}" d="${bezier(a,b)}"></path>`);
    });
    if (draft && draft.from && draft.to) {
      paths.push(`<path class="draft" d="${bezier(draft.from, draft.to)}"></path>`);
    }
    svg.innerHTML = paths.join('');
  }

  function paintInspector(wf, sel){
    const box = document.getElementById('flowInspectorBody');
    if (!box) return;
    if (!sel) {
      box.innerHTML = `<p style="font-size:12px;color:var(--flow-muted)">Click a box to edit it. Drag from a round port to another to connect. Delete removes the selected box.</p>
        <p style="font-size:12px;color:var(--flow-muted)">${(wf.nodes||[]).length} boxes · ${(wf.edges||[]).length} lines</p>`;
      return;
    }
    const m = meta(sel.type);
    const fields = (m.fields || []).map(f => fieldHTML(f, (sel.config||{})[f.key], `TRLFlow.nodeField('${sel.id}','${f.key}', this.value)`)).join('')
      || '<p style="font-size:12px;color:var(--flow-muted)">This box has no extra settings.</p>';
    box.innerHTML = `
      <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${m.accent}">${esc(m.kind)}</div>
      <div style="font-weight:800">${esc(m.title)}</div>
      <p style="font-size:12px;color:var(--flow-muted)">${esc(m.hint)}</p>
      ${fields}
      <div class="flow-mini-actions">
        <button class="btn btn-secondary" style="padding:6px 10px;font-size:11px" onclick="TRLFlow.deleteNode('${sel.id}')">Delete box</button>
      </div>
    `;
  }

  function paintLog(){
    const el = document.getElementById('flowLog');
    if (!el) return;
    const run = ui.lastRun;
    if (!run) { el.innerHTML = '<div class="item">Run or preview to see each box light up.</div>'; return; }
    el.innerHTML = (run.log || []).map(s => `<div class="item ${s.status==='ok'||s.status==='yes'?'ok':s.status==='no'?'no':''}"><b>${esc(s.title)}</b> · ${esc(s.status)}<div>${esc(String(s.detail||'').slice(0,220))}</div></div>`).join('') || '<div class="item">Empty log</div>';
  }

  function bindCanvas(wf){
    const wrap = document.getElementById('flowWrap');
    const world = document.getElementById('flowWorld');
    if (!wrap || !world) return;
    wrap.addEventListener('dragover', e => { e.preventDefault(); });
    wrap.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer && e.dataTransfer.getData('text/trl-node');
      if (!type || !NODES[type]) return;
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left - ui.pan.x) / ui.zoom - 110;
      const y = (e.clientY - r.top - ui.pan.y) / ui.zoom - 30;
      addNodeAt(type, x, y);
    });
    wrap.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      ui.zoom = Math.min(1.6, Math.max(0.45, ui.zoom + (e.deltaY > 0 ? -0.08 : 0.08)));
      applyTransform();
    }, { passive:false });
    wrap.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('flow-port')) {
        const nodeId = e.target.dataset.node;
        const port = e.target.dataset.port;
        if (port === 'in') {
          if (ui.connecting) finishConnect(wf, ui.connecting, { nodeId, port:'in' });
          return;
        }
        ui.connecting = { nodeId, port };
        wrap.setPointerCapture(e.pointerId);
        return;
      }
      const nodeEl = e.target.closest('.flow-node');
      if (nodeEl) {
        ui.selected = nodeEl.dataset.id;
        const node = wf.nodes.find(n => n.id === ui.selected);
        ui.drag = {
          id: node.id,
          dx: e.clientX - (node.x * ui.zoom + ui.pan.x + wrap.getBoundingClientRect().left),
          dy: e.clientY - (node.y * ui.zoom + ui.pan.y + wrap.getBoundingClientRect().top)
        };
        paintInspector(wf, node);
        world.querySelectorAll('.flow-node').forEach(n => n.classList.toggle('sel', n.dataset.id === node.id));
        wrap.setPointerCapture(e.pointerId);
        return;
      }
      ui.selected = null;
      paintInspector(wf, null);
      ui.panDrag = { x: e.clientX - ui.pan.x, y: e.clientY - ui.pan.y };
      wrap.classList.add('panning');
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (ui.connecting) {
        const r = wrap.getBoundingClientRect();
        const to = {
          x: (e.clientX - r.left - ui.pan.x) / ui.zoom,
          y: (e.clientY - r.top - ui.pan.y) / ui.zoom
        };
        const fromEl = world.querySelector(`.flow-port[data-node="${ui.connecting.nodeId}"][data-port="${ui.connecting.port}"]`);
        const nodeEl = world.querySelector(`.flow-node[data-id="${ui.connecting.nodeId}"]`);
        if (fromEl && nodeEl) {
          const from = {
            x: nodeEl.offsetLeft + fromEl.offsetLeft + fromEl.offsetWidth/2,
            y: nodeEl.offsetTop + fromEl.offsetTop + fromEl.offsetHeight/2
          };
          drawWires(wf, { from, to });
        }
        return;
      }
      if (ui.drag) {
        const r = wrap.getBoundingClientRect();
        const node = wf.nodes.find(n => n.id === ui.drag.id);
        if (!node) return;
        node.x = Math.round((e.clientX - r.left - ui.pan.x) / ui.zoom - 110);
        node.y = Math.round((e.clientY - r.top - ui.pan.y) / ui.zoom - 20);
        const el = world.querySelector(`.flow-node[data-id="${node.id}"]`);
        if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
        drawWires(wf);
        return;
      }
      if (ui.panDrag) {
        ui.pan.x = e.clientX - ui.panDrag.x;
        ui.pan.y = e.clientY - ui.panDrag.y;
        applyTransform();
      }
    });
    wrap.addEventListener('pointerup', e => {
      if (ui.connecting) {
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const port = t && t.classList && t.classList.contains('flow-port') ? t : null;
        if (port && port.dataset.port === 'in') finishConnect(wf, ui.connecting, { nodeId: port.dataset.node, port:'in' });
        ui.connecting = null;
        drawWires(wf);
      }
      if (ui.drag) {
        updateWorkflow(wf.id, { nodes: wf.nodes, edges: wf.edges });
        ui.drag = null;
      }
      ui.panDrag = null;
      wrap.classList.remove('panning');
    });
  }

  function applyTransform(){
    const world = document.getElementById('flowWorld');
    if (world) world.style.transform = `translate(${ui.pan.x}px,${ui.pan.y}px) scale(${ui.zoom})`;
  }

  function finishConnect(wf, from, to){
    if (!from || !to || from.nodeId === to.nodeId) return;
    wf.edges = wf.edges || [];
    const dup = wf.edges.some(e => e.from === from.nodeId && e.to === to.nodeId && e.port === from.port);
    if (dup) return;
    wf.edges.push({ id: eid(), from: from.nodeId, to: to.nodeId, port: from.port });
    updateWorkflow(wf.id, { nodes: wf.nodes, edges: wf.edges });
    drawWires(wf);
  }

  function addNodeAt(type, x, y){
    const wf = loadStore().workflows.find(w => w.id === ui.editing);
    if (!wf) return;
    const node = { id: nid(), type, x: Math.max(20, x||120 + wf.nodes.length * 40), y: Math.max(20, y||160 + (wf.nodes.length % 3) * 30), config:{} };
    wf.nodes.push(node);
    ui.selected = node.id;
    updateWorkflow(wf.id, { nodes: wf.nodes, edges: wf.edges });
    paint();
  }

  function hookLeadEvents(){
    if (typeof window.saveLead === 'function' && !window.saveLead.__trlFlowHooked) {
      const orig = window.saveLead;
      window.saveLead = function(){
        const snapshot = readLeads().map(l => ({id:l.id, status:l.status}));
        orig.apply(this, arguments);
        if (window._flowSilent) return;
        const after = readLeads();
        const idsBefore = new Set(snapshot.map(s => s.id));
        if (after.length > snapshot.length) {
          const added = after.find(l => !idsBefore.has(l.id)) || after[after.length - 1];
          dispatch('newLead', { lead: added });
        } else {
          after.forEach(lead => {
            const prev = snapshot.find(s => s.id === lead.id);
            if (prev && prev.status !== lead.status) dispatch('statusChanged', { lead, from: prev.status, to: lead.status });
          });
        }
      };
      window.saveLead.__trlFlowHooked = true;
    }
    if (typeof window.runLoopCheck === 'function' && !window.runLoopCheck.__trlFlowHooked) {
      const orig = window.runLoopCheck;
      window.runLoopCheck = function(showToast){
        orig.apply(this, arguments);
        if (showToast && !window._flowSilent) {
          dispatch('dailyLoop', { quiet:true });
          dispatch('overdue', { quiet:true });
          dispatch('dueToday', { quiet:true });
        }
      };
      window.runLoopCheck.__trlFlowHooked = true;
    }
  }

  function openEditor(id){
    ui.page = 'editor';
    ui.editing = id;
    ui.selected = null;
    ui.pan = { x: 40, y: 60 };
    ui.zoom = 1;
    ui.lastRun = null;
    paint();
  }

  const API = {
    NODES, TEMPLATES, dispatch, runWorkflow, executeAndSave, installTemplate, createWorkflow,
    loadStore, summarize, todayISO,
    page(name){ ui.page = name; paint(); },
    useTemplate(id){
      const wf = installTemplate(id, { enabled:false });
      toast('Recipe added — it is OFF until you turn it on', 'ok');
      openEditor(wf.id);
    },
    newCanvas(){
      const wf = createWorkflow({ name:'New flow', nodes:[], edges:[] });
      openEditor(wf.id);
    },
    edit(id){ openEditor(id); },
    toggle(id){
      const wf = loadStore().workflows.find(w => w.id === id);
      if (!wf) return;
      updateWorkflow(id, { enabled: !wf.enabled });
      toast(!wf.enabled ? 'Flow ON — will run on the next matching event' : 'Flow OFF', 'ok');
      paint();
    },
    remove(id){
      if (!confirm('Delete this flow? Leads stay. Only the recipe is removed.')) return;
      removeWorkflow(id);
      if (ui.editing === id) { ui.page = 'home'; ui.editing = null; }
      toast('Flow deleted', 'ok');
      paint();
    },
    run(id){
      const wf = loadStore().workflows.find(w => w.id === id);
      if (!wf) return;
      const result = executeAndSave(wf, { event:'manual' });
      updateWorkflow(id, { runCount: (wf.runCount||0)+1, lastRunAt: new Date().toISOString() });
      toast('Ran on ' + result.targets + ' lead(s)', result.mutated ? 'ok' : 'info');
      paint();
    },
    preview(){
      const wf = loadStore().workflows.find(w => w.id === ui.editing);
      if (!wf) return;
      const result = executeAndSave(wf, { event:'preview', preview:true });
      toast('Preview only — leads were not changed · ' + result.targets + ' match(es)', 'info');
      paint();
    },
    rename(name){
      if (!ui.editing) return;
      updateWorkflow(ui.editing, { name: name || 'Untitled flow' });
    },
    addNode(type){ addNodeAt(type); },
    dragType(event, type){
      event.dataTransfer.setData('text/trl-node', type);
      event.dataTransfer.effectAllowed = 'copy';
    },
    nodeField(id, key, value){
      const wf = loadStore().workflows.find(w => w.id === ui.editing);
      if (!wf) return;
      const node = wf.nodes.find(n => n.id === id);
      if (!node) return;
      node.config = node.config || {};
      node.config[key] = value;
      updateWorkflow(wf.id, { nodes: wf.nodes });
      const el = document.querySelector(`.flow-node[data-id="${id}"] .flow-node-sub`);
      if (el) el.textContent = nodeSub(node);
    },
    deleteNode(id){
      const wf = loadStore().workflows.find(w => w.id === ui.editing);
      if (!wf) return;
      wf.nodes = wf.nodes.filter(n => n.id !== id);
      wf.edges = (wf.edges || []).filter(e => e.from !== id && e.to !== id);
      ui.selected = null;
      updateWorkflow(wf.id, { nodes: wf.nodes, edges: wf.edges });
      paint();
    },
    zoom(d){ ui.zoom = Math.min(1.6, Math.max(0.45, ui.zoom + d)); applyTransform(); },
    resetView(){ ui.pan = {x:40,y:60}; ui.zoom = 1; applyTransform(); },
    wizSet(attr, value){
      ui.wizard[attr] = value;
      paint();
    },
    wizField(type, key, value){
      ui.wizard.config[type] = ui.wizard.config[type] || {};
      ui.wizard.config[type][key] = value;
    },
    wizName(v){ ui.wizard.name = v; },
    wizStep(d){ ui.wizard.step = Math.min(4, Math.max(1, ui.wizard.step + d)); paint(); },
    wizSave(){
      const w = ui.wizard;
      const types = [w.trigger, w.condition, w.action].filter(Boolean);
      const configs = types.map(t => w.config[t] || {});
      const graph = linear(types, configs);
      const wf = createWorkflow({
        name: w.name || (meta(w.trigger).title + ' → ' + meta(w.action).title),
        nodes: graph.nodes,
        edges: graph.edges
      });
      ui.wizard = {step:1, trigger:'trigger.newLead', condition:'', action:'action.setNext', config:{}, name:''};
      toast('Flow created — turn it ON when you are happy', 'ok');
      openEditor(wf.id);
    },
    show(){ hookLeadEvents(); paint(); },
    paint
  };

  window.TRLFlow = API;

  document.addEventListener('keydown', e => {
    if (ui.page !== 'editor') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ui.selected) { e.preventDefault(); API.deleteNode(ui.selected); }
    }
    if (e.key === 'Escape') ui.connecting = null;
  });

  function boot(){
    hookLeadEvents();
    if (location.hash.replace('#','') === 'flow') paint();
  }
  hookLeadEvents();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
