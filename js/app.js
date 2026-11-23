/* NeoGuardian website: live nurse dashboard (Bed 1), Bed 1 details and a checklist assistant */

// ---------- Where the AI runs ----------
// Opened from the laptop app (port 5000): same address. From Vercel: the laptop, default http://127.0.0.1:5000
const ON_LAPTOP = location.port === '5000';
const KEY = 'ng_api';
const saved = {
  get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } }
};
let API = ON_LAPTOP ? '' : (saved.get() || 'http://127.0.0.1:5000');

let view = 'home';   // home | dash | bed
let live = null;     // newest result from the AI (null = none yet)
let online = false;  // can the page reach the AI?
let demo = -1;       // -1 = real data, 0..2 = demo states
let lastSig = '';
let busy = false;

// ---------- Demo states (for the public site, when no AI is connected) ----------
const base = { is_cry: true, cry_score: 0.9, seconds: 10, ai_ms: 480, feed_h: 2.8, diaper_h: 1.1, cry_min: 1, age_s: 8, time: 'demo' };
const DEMO = [
  { ...base, id: 1, level: 'RED', why: 'Urgent cry · sounds most like pain', p_urgent: 0.82,
    kinds: { Pain: 0.55, Scared: 0.27, 'Hungry / needs': 0.18 },
    tips: ['Pain sounds likely: check tummy (gas), temperature and tight clothes', 'Maybe hungry (last fed 2.8 h ago)'] },
  { ...base, id: 2, level: 'YELLOW', why: 'Not urgent', p_urgent: 0.31, feed_h: 0.3,
    kinds: { Pain: 0.12, Scared: 0.19, 'Hungry / needs': 0.69 }, tips: ['Just fed: maybe needs burping'] },
  { ...base, id: 3, level: 'CALM', why: 'No cry detected', is_cry: false, cry_score: 0.04, p_urgent: 0, kinds: null, cry_min: 0,
    tips: ['Check comfort: position, temperature, needs holding'] }
];

// ---------- Small helpers ----------
const pct = (x) => Math.round(x * 100);
const ago = (h) => (h < 0.05 ? 'just now' : `${h.toFixed(1)} h ago`);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label, cls, onClick) {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

// ---------- Talking to the AI ----------
async function poll() {
  if (busy) return;
  busy = true;
  if (demo < 0) {
    try {
      const r = await fetch(`${API}/latest`, { cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined });
      const d = await r.json();
      live = d.waiting ? null : d;
      online = true;
    } catch (e) { live = null; online = false; }
  }
  busy = false;
  render();
}

async function act(path, field) {
  if (demo >= 0) {
    if (field) live[field] = 0;
    else { live.level = 'CALM'; live.why = 'Resolved by nurse'; }
    render(true);
    return;
  }
  try { await fetch(API + path, { method: 'POST' }); } catch (e) { /* offline */ }
  poll();
}

// What Bed 1 shows: colour class, pill text and one line of status
function status(d) {
  if (demo < 0 && !online) return { cls: 'off', pill: 'NO AI', text: 'AI not connected' };
  if (!d) return { cls: 'off', pill: 'WAITING', text: 'Waiting for the first clip from the Pico' };
  if (d.age_s > 150) return { cls: 'off', pill: 'PICO OFFLINE?', text: `No clip for ${Math.round(d.age_s / 60)} min` };
  const lv = d.level.toLowerCase();
  return { cls: lv === 'calm' ? '' : lv, pill: { red: 'URGENT', yellow: 'NOT URGENT', calm: 'CALM' }[lv], text: d.why };
}

// ---------- Bed cards ----------
function bedCard(detail) {
  const s = status(live);
  const card = el(detail ? 'div' : 'article', `baby ${s.cls}`);
  card.append(el('span', `pill ${s.cls === 'off' ? 'grey' : s.cls}`, s.pill));
  const head = el('div', 'baby-head');
  head.append(el('span', 'baby-bed', 'Bed 1'), el('span', 'baby-status', s.text));
  card.append(head);

  if (live && s.cls !== 'off') {
    if (live.is_cry) {
      const m = el('div');
      m.append(el('div', 'meter-label', `AI urgency ${pct(live.p_urgent)}%`));
      const meter = el('div', 'meter');
      const fill = el('div');
      fill.style.width = pct(live.p_urgent) + '%';
      meter.append(fill);
      m.append(meter);
      card.append(m);
    }
    const facts = el('div', 'facts');
    [['LAST FED', ago(live.feed_h)], ['LAST DIAPER', ago(live.diaper_h)]].forEach(([k, v]) => {
      const f = el('div', 'fact');
      f.append(el('small', '', k), el('b', '', v));
      facts.append(f);
    });
    card.append(facts, el('div', 'tip', live.is_cry ? live.tips[0] : 'Resting. No action needed.'));
    const actions = el('div', 'baby-actions');
    actions.append(
      button('Fed', 'sq', () => act('/fed', 'feed_h')),
      button('Changed', 'sq', () => act('/diaper', 'diaper_h')),
      button('Resolved', 'sq dark', () => act('/resolved'))
    );
    card.append(actions);
  }

  if (!detail) {
    card.append(el('div', 'baby-link', 'Open details · last sound · assistant →'));
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `Bed 1: ${s.pill}. Open details`);
    card.addEventListener('click', () => { location.hash = '#bed1'; });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = '#bed1'; });
  }
  return card;
}

function lockedCard(n) {
  const card = el('article', 'baby locked');
  card.setAttribute('aria-label', `Bed ${n}: locked, no microphone`);
  card.append(el('span', 'pill grey', 'LOCKED'));
  const head = el('div', 'baby-head');
  head.append(el('span', 'baby-bed', `Bed ${n}`), el('span', 'baby-status', 'No microphone'));
  card.append(head, el('div', 'tip', 'This bed gets live alerts when a microphone is added.'));
  return card;
}

// ---------- Rendering ----------
function sig() {
  const d = live;
  return [view, online, demo, d && d.id, d && d.level, d && d.why, d && d.feed_h.toFixed(1), d && d.diaper_h.toFixed(1), d && d.age_s > 150].join('|');
}

function render(force) {
  const s = sig();
  if (!force && s === lastSig) return;
  lastSig = s;
  if (view === 'dash') renderDashboard();
  if (view === 'bed') renderBed();
}

function renderDashboard() {
  const s = status(live);
  const grid = document.getElementById('babies');
  grid.replaceChildren(bedCard(false));
  for (let n = 2; n <= 8; n++) grid.append(lockedCard(n));
  document.getElementById('n-red').textContent = `${s.cls === 'red' ? 1 : 0} urgent`;
  document.getElementById('n-yellow').textContent = `${s.cls === 'yellow' ? 1 : 0} not urgent`;
  document.getElementById('n-calm').textContent = `${s.cls === '' ? 1 : 0} calm`;
  document.getElementById('conn').textContent = demo >= 0 ? `Demo data ${demo + 1}/3` : online ? '● AI connected' : '○ AI not connected';
  document.getElementById('demo-btn').textContent = demo >= 0 ? 'Next demo / live' : 'Demo data';
}

function renderBed() {
  document.getElementById('bed-card').replaceChildren(bedCard(true));
  const audio = document.getElementById('bed-audio');
  const info = document.getElementById('bed-audio-info');
  const real = live && demo < 0;
  audio.hidden = !real;
  if (real) {
    const id = String(live.id);
    if (audio.dataset.id !== id) {
      if (audio.paused) { audio.dataset.id = id; audio.src = `${API}/clip?id=${id}`; }
      else audio.addEventListener('ended', () => render(true), { once: true });   // do not cut a clip that is playing
    }
    info.textContent = `Recorded at ${live.time} · ${Math.round(live.seconds)} s · AI time ${live.ai_ms} ms`;
  } else {
    info.textContent = demo >= 0 ? 'Demo data has no sound.' : 'No recorded sound yet.';
  }
  const box = document.getElementById('bed-layers');
  box.replaceChildren();
  if (!live) return;
  const rows = [`Layer 1 · Is it a cry? ${live.is_cry ? 'YES' : 'NO'} (${pct(live.cry_score)}%)`];
  if (live.is_cry) {
    rows.push(`Layer 2 · How urgent? ${pct(live.p_urgent)}% (red line 59%)`);
    if (live.kinds) rows.push('What kind? ' + Object.entries(live.kinds).map(([k, v]) => `${k} ${pct(v)}%`).join(' · '));
    rows.push('Layer 3 · What to check first: ' + live.tips.join(' / '));
  }
  rows.forEach((t) => box.append(el('p', '', t)));
}

// ---------- Checklist assistant (runs in the browser: no internet, no cloud) ----------
const FLAGS = [
  'Call the doctor or ward lead now if you see any of these:',
  '• Fast, noisy or paused breathing, or the chest pulling in',
  '• Blue, grey or very pale skin or lips',
  '• Floppy, hard to wake, or a weak or very high-pitched cry',
  '• Temperature 38.0 °C or higher, or below 36.5 °C',
  '• Green vomit, blood, a hard swollen tummy, or seizure-like movements'
];

function nextSteps() {
  if (!live) return ['No clip from the Pico yet. Check that the Pico is on and connected to the Wi-Fi.'];
  if (live.level === 'CALM') return ['No cry detected: nothing to do now.', 'Ask me about feeding or diaper times if you like.'];
  const steps = ['Look at colour and breathing first.', ...live.tips.slice(0, 2),
    'Check diaper, temperature, clothing and position.', 'Not calm after about 10 minutes, or any danger sign: call the doctor.'];
  return [live.level === 'RED' ? 'URGENT: go to Bed 1 now.' : 'Not urgent, but please check Bed 1.', ...steps.map((t, i) => `${i + 1}. ${t}`)];
}

const INTENTS = [
  [/danger|emergency|doctor|breath|blue|pale|floppy|limp|seizure|red flag/, () => FLAGS],
  [/fever|temperature|\bhot\b|\bcold\b|warm/, () => ['Check the temperature (armpit). Normal is about 36.5–37.5 °C.',
    'Call the doctor now if it is 38.0 °C or higher, or below 36.5 °C.', 'If normal: check blankets and clothing (not too many layers, not too few).']],
  [/hungry|hunger|feed|milk|breast|bottle/, () => {
    if (!live) return ['Newborns usually feed every 2–3 hours.'];
    const h = live.feed_h;
    return [`Last fed ${h.toFixed(1)} h ago. Newborns usually feed every 2–3 hours.`,
      h >= 2 ? 'It is time: feed now, then burp.' : h * 60 <= 30 ? 'Fed recently: try burping instead of feeding again.' : 'Not due yet: check diaper and comfort first.'];
  }],
  [/diaper|nappy|wet|dirty|poop|stool/, () => {
    if (!live) return ['Check for a wet or dirty diaper and for redness.'];
    const d = live.diaper_h;
    return [`Last changed ${d.toFixed(1)} h ago.`, d >= 3 ? 'Overdue: check and change now.' : 'If the cry continues, check anyway: wet or dirty diaper, redness.'];
  }],
  [/gas|burp|wind|tummy|belly|colic/, () => ['Hold the baby upright on your shoulder and pat or rub the back gently for 1–2 minutes.',
    'Try gentle bicycle legs or a clockwise tummy rub.', 'Hard or swollen tummy, or green vomit: call the doctor.']],
  [/urgent|serious|how bad|urgency|why red|why/, () => {
    if (!live) return ['No result yet.'];
    if (!live.is_cry) return ['No cry detected, so there is no urgency rating.'];
    return [`AI urgency is ${pct(live.p_urgent)}%. The red line is 59%.`, '49–58% is "unsure" and is treated as urgent. Crying 5+ minutes also turns red.',
      'The AI hears how distressed the cry is. It cannot know why, so always look at the baby.'];
  }],
  [/calm|soothe|settle|stop|crying|cry|comfort/, () => ['Try in this order:', '1. Hold close, skin-to-skin if possible.', '2. Swaddle snugly.',
    '3. Soft shushing and gentle swaying; dim the light.', '4. Offer a feed if it is due.', '5. Check fingers, toes and clothes for tight threads or hair.',
    'Not calm after about 10 minutes: ask the doctor to check.']],
  [/what|do|now|check|first|help|should/, nextSteps]
];

function answer(q) {
  const t = q.toLowerCase();
  for (const [re, fn] of INTENTS) if (re.test(t)) return fn();
  return ['I can help with: what to do now, urgency, hunger, diaper, gas, soothing, temperature and danger signs.', 'Tap a button below or ask in a few words.'];
}

function say(who, lines) {
  const log = document.getElementById('chat-log');
  const m = el('div', `msg ${who}`);
  [].concat(lines).forEach((t) => m.append(el('p', '', t)));
  log.append(m);
  log.scrollTop = log.scrollHeight;
}

// ---------- Instant recording: the Pico records when asked, and the assistant shows every step ----------
const STEPS = ['Asking the Pico to record', 'Recording the sound', 'Sending it to the laptop', 'AI is listening', 'Result ready'];
const MARK = { wait: '○', now: '●', ok: '✓', bad: '✕' };
let recording = false;

function stepsMessage() {
  const log = document.getElementById('chat-log');
  const m = el('div', 'msg bot');
  const head = el('p', 'think', 'Working on it…');
  const list = el('ol', 'steps');
  const items = STEPS.map((t) => {
    const li = el('li', 'step wait');
    li.append(el('span', 'dot', MARK.wait), el('span', '', t), el('span', 'time', ''));
    list.append(li);
    return li;
  });
  m.append(head, list);
  log.append(m);
  log.scrollTop = log.scrollHeight;
  return { head, items };
}

function paint(items, s) {
  const set = (i, cls, time) => {
    items[i].className = `step ${cls}`;
    items[i].children[0].textContent = MARK[cls];
    items[i].children[2].textContent = time || '';
  };
  const sec = (x) => `${Math.max(0, x).toFixed(1)} s`;
  const tp = s.t_pick, tu = s.t_up, td = s.t_done, rec = s.rec_s;
  if (tp == null) {
    set(0, 'now', sec(s.elapsed));
    [1, 2, 3, 4].forEach((i) => set(i, 'wait'));
    return;
  }
  const since = s.elapsed - tp;
  set(0, 'ok', sec(tp));
  if (tu != null || since >= rec) set(1, 'ok', `${rec} s`); else set(1, 'now', `${Math.floor(since)} / ${rec} s`);
  if (tu != null) set(2, 'ok', sec(tu - tp - rec)); else if (since >= rec) set(2, 'now', sec(since - rec)); else set(2, 'wait');
  if (td != null) set(3, 'ok', sec(td - tu)); else if (tu != null) set(3, 'now', sec(s.elapsed - tu)); else set(3, 'wait');
  if (td != null) set(4, 'ok', sec(td)); else set(4, 'wait');
}

async function startRecording() {
  if (recording) { say('bot', ['A recording is already running.']); return; }
  if (demo >= 0 || !online) { say('bot', ['I cannot reach the AI server, so I cannot start a recording. Check the Connect box.']); return; }
  recording = true;
  const btn = document.getElementById('rec-btn');
  btn.disabled = true;
  const { head, items } = stepsMessage();
  try {
    await fetch(`${API}/record`, { method: 'POST' });
    const t0 = Date.now();
    let s;
    for (;;) {
      s = await (await fetch(`${API}/record/status`, { cache: 'no-store' })).json();
      paint(items, s);
      if (s.state === 'done' || s.state === 'failed' || Date.now() - t0 > 130000) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (s.state !== 'done') throw new Error(s.error || 'Timed out');
    head.textContent = `Done in ${s.t_done.toFixed(1)} s`;
    live = s.result;
    online = true;
    render(true);
    say('bot', [`Result: ${status(live).pill} · ${live.why}`, ...nextSteps()]);
  } catch (e) {
    head.textContent = 'Something went wrong';
    items.forEach((li) => { if (li.classList.contains('now')) { li.className = 'step bad'; li.children[0].textContent = MARK.bad; } });
    say('bot', [String(e.message || e), 'Check that the Pico is on, connected to the Wi-Fi and running the new code.']);
  }
  recording = false;
  btn.disabled = false;
}

function ask(text) {
  say('me', text);
  if (/record|listen/i.test(text)) startRecording();
  else say('bot', answer(text));
}

function initChat() {
  const quick = document.getElementById('chat-quick');
  const rb = button('🎙 Record now', 'sq dark', () => ask('Record now'));
  rb.id = 'rec-btn';
  quick.append(rb);
  ['What should I do now?', 'Is it urgent?', "Baby won't calm", 'Hungry?', 'Diaper?', 'Gas / burping', 'Danger signs']
    .forEach((t) => quick.append(button(t, 'sq', () => ask(t))));
  const input = document.getElementById('chat-input');
  const send = () => { if (input.value.trim()) { ask(input.value.trim()); input.value = ''; } };
  document.getElementById('chat-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
}

function greetOnce() {
  if (document.getElementById('chat-log').children.length) return;
  const s = status(live);
  say('bot', ['Hi, I am the NeoGuardian checklist assistant.', `Bed 1: ${s.pill} · ${s.text}`, 'Tap a question below or type your own.']);
}

// ---------- Dashboard controls ----------
function testUrl() {
  const u = new URL(API || location.origin);
  return `${u.protocol}//${u.hostname}:7860/`;
}

document.getElementById('demo-btn').addEventListener('click', () => {
  demo = demo >= 2 ? -1 : demo + 1;
  live = demo >= 0 ? { ...DEMO[demo], tips: [...DEMO[demo].tips] } : null;
  if (demo < 0) online = false;
  lastSig = '';
  poll();
});
document.getElementById('api-box').hidden = ON_LAPTOP;
document.getElementById('api-url').value = API;
document.getElementById('api-save').addEventListener('click', () => {
  API = document.getElementById('api-url').value.trim().replace(/\/+$/, '');
  saved.set(API);
  document.getElementById('test-link').href = testUrl();
  demo = -1;
  lastSig = '';
  poll();
});
document.getElementById('test-link').href = testUrl();

// ---------- Page switching (home / #dashboard / #bed1) ----------
function route() {
  const hash = location.hash.replace('#', '');
  view = hash === 'dashboard' ? 'dash' : hash === 'bed1' ? 'bed' : 'home';
  document.getElementById('view-home').hidden = view !== 'home';
  document.getElementById('view-dashboard').hidden = view !== 'dash';
  document.getElementById('view-bed').hidden = view !== 'bed';
  document.title = { home: 'NeoGuardian', dash: 'NeoGuardian · Nurse dashboard', bed: 'NeoGuardian · Bed 1' }[view];
  if (view === 'home') {
    const target = hash && document.getElementById(hash);
    if (target) target.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
    lastSig = '';
    poll();
    if (view === 'bed') greetOnce();
  }
  menuLinks.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
}

// ---------- Mobile menu ----------
const menuBtn = document.querySelector('.menu-btn');
const menuLinks = document.getElementById('nav-links');
menuBtn.addEventListener('click', () => {
  const open = menuLinks.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

initChat();
window.addEventListener('hashchange', route);
route();
setInterval(() => { if (view !== 'home') poll(); }, 2000);
