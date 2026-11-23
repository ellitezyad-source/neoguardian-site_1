/* NeoGuardian website: landing motion choreography + live nurse dashboard (Bed 1) + checklist assistant */

// Enable progressive-enhancement motion classes only when JS runs
document.documentElement.classList.add('js-motion');

// ---------- Landing page scroll motion, counters, chain sequence & phone preview ----------
function initLandingMotion() {
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Assign stagger delays to children inside [data-stagger] containers
  document.querySelectorAll('[data-stagger]').forEach((group) => {
    const step = Number(group.dataset.stagger) || 100;
    const targets = group.querySelectorAll('[data-reveal]');
    targets.forEach((el, idx) => {
      if (!el.style.getPropertyValue('--reveal-delay')) {
        el.style.setProperty('--reveal-delay', `${idx * step}ms`);
      }
    });
  });

  // Assign left-to-right step delays to hardware chain nodes and arrows
  document.querySelectorAll('[data-chain]').forEach((chain) => {
    chain.querySelectorAll('.chain-step').forEach((node, idx) => {
      node.style.setProperty('--step-delay', `${idx * 95}ms`);
    });
  });

  function animateCounter(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (Number.isNaN(target) || prefersReduced) {
      el.textContent = `${target}${suffix}`;
      return;
    }
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = `${target}${suffix}`;
    }
    requestAnimationFrame(tick);
  }

  function revealElement(el) {
    el.classList.add('is-visible');
    el.querySelectorAll('[data-count]').forEach(animateCounter);
    if (el.hasAttribute('data-count')) animateCounter(el);
    const meter = el.querySelector('.preview-meter') || (el.classList.contains('preview-meter') ? el : null);
    if (meter) meter.classList.add('is-filled');
  }

  const revealTargets = Array.from(document.querySelectorAll('#view-home [data-reveal], #view-home [data-chain]'));

  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealTargets.forEach(revealElement);
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealElement(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -36px 0px' });

    revealTargets.forEach((el) => observer.observe(el));

    // Reveal items already in or above the viewport (e.g. after hash anchor jumps)
    window.syncHomeReveals = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      revealTargets.forEach((el) => {
        if (el.classList.contains('is-visible')) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < vh * 0.92) {
          revealElement(el);
          observer.unobserve(el);
        }
      });
    };
  }

  // Top scroll progress bar (compositor-only scaleX)
  const progressBar = document.getElementById('scroll-progress');
  let rafPending = false;
  function updateScrollProgress() {
    rafPending = false;
    if (!progressBar) return;
    if (view !== 'home') {
      progressBar.style.opacity = '0';
      return;
    }
    progressBar.style.opacity = '1';
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
    progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
  }
  window.addEventListener('scroll', () => {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(updateScrollProgress);
    }
  }, { passive: true });
  window.updateScrollProgress = updateScrollProgress;

  // Interactive Phone Preview card controls (no dead clicks)
  const previewCard = document.getElementById('preview-card');
  const previewPill = document.getElementById('preview-pill');
  const previewTitle = document.getElementById('preview-title');
  const previewLabel = document.getElementById('preview-meter-label');
  const previewMeter = document.getElementById('preview-meter');
  const previewTip = document.getElementById('preview-tip');
  const ackBtn = document.getElementById('preview-ack');
  const resolveBtn = document.getElementById('preview-resolve');

  if (previewCard && ackBtn && resolveBtn) {
    let previewState = 'urgent'; // urgent | ack | resolved
    const setPreview = (next) => {
      previewState = next;
      if (next === 'urgent') {
        previewCard.className = 'baby red';
        previewPill.className = 'pill red';
        previewPill.textContent = 'URGENT · BED 1';
        previewTitle.textContent = 'Urgent cry detected';
        previewLabel.textContent = 'Pain or fear likely · AI urgency 82%';
        previewMeter.hidden = false;
        previewTip.textContent = 'Also check: maybe hungry';
        ackBtn.textContent = 'On my way';
        resolveBtn.textContent = 'Resolved';
      } else if (next === 'ack') {
        previewCard.className = 'baby yellow';
        previewPill.className = 'pill yellow';
        previewPill.textContent = 'ATTENDING · BED 1';
        previewTitle.textContent = 'Nurse on the way';
        previewLabel.textContent = 'Acknowledged · AI urgency 82%';
        previewMeter.hidden = false;
        previewTip.textContent = 'Check feeding & comfort when arriving';
        ackBtn.textContent = 'On my way ✓';
        resolveBtn.textContent = 'Resolved';
      } else {
        previewCard.className = 'baby calm-ack';
        previewPill.className = 'pill green';
        previewPill.textContent = 'RESOLVED · BED 1';
        previewTitle.textContent = 'Baby settled';
        previewLabel.textContent = 'Alert cleared by nurse';
        previewMeter.hidden = true;
        previewTip.textContent = 'Tap Reset preview to replay alert';
        ackBtn.textContent = 'On my way';
        resolveBtn.textContent = 'Reset preview';
      }
    };
    ackBtn.addEventListener('click', () => setPreview(previewState === 'ack' ? 'urgent' : 'ack'));
    resolveBtn.addEventListener('click', () => setPreview(previewState === 'resolved' ? 'urgent' : 'resolved'));
  }
}

// ---------- Where the AI runs ----------
// Opened from the laptop app (port 5000): same address. From hosted site: the laptop, default http://127.0.0.1:5000
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

// ---------- Patient profile state (synced from Firestore) ----------
let currentUser = null;
let userProfile = null;
let patients = [];
let patientsLoading = false;
let patientsError = '';
let patientFilter = 'all';
let editingPatientId = '';
let pendingDeleteId = '';
let patientsUnsub = null;

function activePatientForBed(bedLabel) {
  return patients.find((p) => p.status === 'active' && p.bedNumber === bedLabel) || null;
}

// ---------- Bed cards ----------
function bedCard(detail) {
  const s = status(live);
  const assigned = activePatientForBed('Bed 1');
  const card = el(detail ? 'div' : 'article', `baby ${s.cls}`);
  card.append(el('span', `pill ${s.cls === 'off' ? 'grey' : s.cls}`, s.pill));
  const head = el('div', 'baby-head');
  head.append(el('span', 'baby-bed', assigned ? `Bed 1 · ${assigned.babyName}` : 'Bed 1'), el('span', 'baby-status', s.text));
  card.append(head);
  if (assigned) {
    card.append(el('div', 'baby-patient-meta', `${assigned.ageDays}d · ${assigned.weightKg} kg · Feed every ${assigned.feedingIntervalHours} h · Diaper ${assigned.diaperIntervalHours} h`));
  }

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
  const bedLabel = `Bed ${n}`;
  const assigned = activePatientForBed(bedLabel);
  if (assigned) {
    const card = el('article', 'baby assigned');
    card.setAttribute('aria-label', `${bedLabel}: ${assigned.babyName}, waiting for microphone`);
    card.append(el('span', 'pill', 'PATIENT ASSIGNED'));
    const head = el('div', 'baby-head');
    head.append(el('span', 'baby-bed', `${bedLabel} · ${assigned.babyName}`), el('span', 'baby-status', 'Waiting for mic'));
    card.append(head);
    card.append(el('div', 'baby-patient-meta', `${assigned.ageDays} days · ${assigned.weightKg} kg · Feed every ${assigned.feedingIntervalHours} h`));
    if (assigned.medicalNotes) {
      card.append(el('div', 'tip', assigned.medicalNotes));
    } else {
      card.append(el('div', 'tip', `Diaper check every ${assigned.diaperIntervalHours} h. Add a microphone for live cry alerts.`));
    }
    const actions = el('div', 'baby-actions');
    const manageBtn = button('Edit profile', 'sq', () => {
      if (window.loadPatientForEdit) window.loadPatientForEdit(assigned.id);
      location.hash = '#patients';
    });
    actions.append(manageBtn);
    card.append(actions);
    return card;
  }

  const card = el('article', 'baby locked');
  card.setAttribute('aria-label', `Bed ${n}: locked, no microphone`);
  card.append(el('span', 'pill grey', 'LOCKED'));
  const head = el('div', 'baby-head');
  head.append(el('span', 'baby-bed', bedLabel), el('span', 'baby-status', 'No microphone'));
  card.append(head, el('div', 'tip', 'This bed gets live alerts when a microphone is added.'));
  return card;
}

// ---------- Rendering ----------
function sig() {
  const d = live;
  const pSig = patients.map((p) => `${p.id}:${p.babyName}:${p.bedNumber}:${p.status}:${p.feedingIntervalHours}:${p.diaperIntervalHours}`).join(',');
  return [view, online, demo, pSig, d && d.id, d && d.level, d && d.why, d && d.feed_h.toFixed(1), d && d.diaper_h.toFixed(1), d && d.age_s > 150].join('|');
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

// ---------- Auth & Patient Profiles Controller (Firebase Auth + Firestore) ----------
function initAuthAndPatients() {
  const fb = window.NGFirebase;
  if (!fb) return;

  let authMode = 'signin'; // signin | signup
  let pendingWardName = 'Ward A';

  const navAuthBtn = document.getElementById('nav-auth-btn');
  const authSignedOut = document.getElementById('auth-signed-out');
  const authVerifyCard = document.getElementById('auth-verify-card');
  const authSignedIn = document.getElementById('auth-signed-in');
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  const authLabel = document.getElementById('auth-panel-label');
  const authHeading = document.getElementById('auth-heading');
  const authSub = document.getElementById('auth-sub');
  const signupFields = document.getElementById('signup-fields');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authFeedback = document.getElementById('auth-feedback');
  const verifyFeedback = document.getElementById('verify-feedback');
  const authPasswordInput = document.getElementById('auth-password');

  const patientsAuthGate = document.getElementById('patients-auth-gate');
  const patientsWorkspace = document.getElementById('patients-workspace');
  const patientsUserChip = document.getElementById('patients-user-chip');
  const patientsAuthLink = document.getElementById('patients-auth-link');
  const patientsSignoutBtn = document.getElementById('patients-signout-btn');
  const patientsWardBadge = document.getElementById('patients-ward-badge');
  const dashWardPill = document.getElementById('dash-ward-pill');

  const patientForm = document.getElementById('patient-form');
  const patientEditIdInput = document.getElementById('patient-edit-id');
  const patientFormLabel = document.getElementById('patient-form-label');
  const patientFormHeading = document.getElementById('patient-form-heading');
  const patientSaveBtn = document.getElementById('patient-save-btn');
  const patientCancelBtn = document.getElementById('patient-cancel-btn');
  const patientFormMsg = document.getElementById('patient-form-msg');
  const patientCardsEl = document.getElementById('patient-cards');
  const patientsCountLine = document.getElementById('patients-count-line');
  const patientsListError = document.getElementById('patients-list-error');

  function showMsg(box, text, type = 'info') {
    if (!box) return;
    if (!text) {
      box.hidden = true;
      box.textContent = '';
      box.className = 'form-feedback';
      return;
    }
    box.hidden = false;
    box.textContent = text;
    box.className = `form-feedback${type === 'error' ? ' is-error' : type === 'ok' ? ' is-ok' : ''}`;
  }

  function friendlyAuthError(err) {
    const code = err?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not enabled yet in Firebase Console (Authentication → Sign-in method → Email/Password). You can use "Continue with Google" right away.';
    }
    if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Switch to Sign in.';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Incorrect email or password. Please check your credentials and try again.';
    }
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/popup-closed-by-user') return 'Google sign-in window was closed before completing.';
    if (code === 'auth/popup-blocked') return 'Pop-up was blocked by the browser. Please allow pop-ups and try again.';
    return err?.message || 'Authentication failed. Please try again.';
  }

  function setAuthMode(mode) {
    authMode = mode;
    const isSignup = mode === 'signup';
    tabSignin.classList.toggle('is-active', !isSignup);
    tabSignup.classList.toggle('is-active', isSignup);
    tabSignin.setAttribute('aria-selected', String(!isSignup));
    tabSignup.setAttribute('aria-selected', String(isSignup));
    authLabel.textContent = isSignup ? 'CREATE ACCOUNT' : 'SIGN IN';
    authHeading.textContent = isSignup ? 'Create caregiver account' : 'Welcome back';
    authSub.textContent = isSignup
      ? 'Set up your nurse or caregiver account to manage newborn patient profiles.'
      : 'Sign in to create and manage newborn patient profiles across sessions.';
    signupFields.hidden = !isSignup;
    authSubmitBtn.textContent = isSignup ? 'Create account' : 'Sign in';
    authPasswordInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    showMsg(authFeedback, '');
  }

  tabSignin.addEventListener('click', () => setAuthMode('signin'));
  tabSignup.addEventListener('click', () => setAuthMode('signup'));

  document.getElementById('google-signin-btn').addEventListener('click', async () => {
    showMsg(authFeedback, '');
    try {
      await fb.signInWithGoogle();
      if (view === 'auth') location.hash = '#patients';
    } catch (err) {
      showMsg(authFeedback, friendlyAuthError(err), 'error');
    }
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg(authFeedback, '');
    const email = document.getElementById('auth-email').value.trim();
    const password = authPasswordInput.value;
    if (!email || !email.includes('@')) {
      showMsg(authFeedback, 'Please enter a valid email address.', 'error');
      return;
    }
    if (!password || password.length < 6) {
      showMsg(authFeedback, 'Password must be at least 6 characters.', 'error');
      return;
    }
    authSubmitBtn.disabled = true;
    try {
      if (authMode === 'signup') {
        const displayName = document.getElementById('auth-name').value.trim();
        const wardName = document.getElementById('auth-ward').value.trim() || 'Ward A';
        if (!displayName) {
          showMsg(authFeedback, 'Please enter your full name.', 'error');
          authSubmitBtn.disabled = false;
          return;
        }
        pendingWardName = wardName;
        const res = await fb.signUpWithEmail({ displayName, wardName, email, password });
        if (res.user.emailVerified && view === 'auth') {
          location.hash = '#patients';
        }
      } else {
        const user = await fb.signInWithEmail({ email, password });
        if (user.emailVerified && view === 'auth') {
          location.hash = '#patients';
        }
      }
    } catch (err) {
      showMsg(authFeedback, friendlyAuthError(err), 'error');
    } finally {
      authSubmitBtn.disabled = false;
    }
  });

  document.getElementById('verify-resend-btn').addEventListener('click', async () => {
    showMsg(verifyFeedback, '');
    try {
      await fb.resendVerificationEmail();
      showMsg(verifyFeedback, 'Verification email sent. Check your inbox and spam folder.', 'ok');
    } catch (err) {
      showMsg(verifyFeedback, friendlyAuthError(err), 'error');
    }
  });

  document.getElementById('verify-refresh-btn').addEventListener('click', async () => {
    showMsg(verifyFeedback, '');
    try {
      const user = await fb.reloadCurrentUser();
      if (user && user.emailVerified) {
        await fb.ensureUserProfile(user, { wardName: pendingWardName });
        updateAuthUI(user);
        location.hash = '#patients';
      } else {
        showMsg(verifyFeedback, 'Your email is not verified yet. Open the link in your inbox, then click again.', 'error');
      }
    } catch (err) {
      showMsg(verifyFeedback, friendlyAuthError(err), 'error');
    }
  });

  const handleSignOut = async () => {
    try {
      await fb.signOutUser();
      resetPatientForm();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };
  document.getElementById('auth-signout-btn').addEventListener('click', handleSignOut);
  document.getElementById('verify-signout-btn').addEventListener('click', handleSignOut);
  patientsSignoutBtn.addEventListener('click', handleSignOut);

  function resetPatientForm() {
    editingPatientId = '';
    patientEditIdInput.value = '';
    patientForm.reset();
    document.getElementById('patient-age').value = '3';
    document.getElementById('patient-weight').value = '3.2';
    document.getElementById('patient-feed').value = '2.5';
    document.getElementById('patient-diaper').value = '3';
    document.getElementById('patient-status').value = 'active';
    patientFormLabel.textContent = 'NEW PATIENT';
    patientFormHeading.textContent = 'Add patient profile';
    patientSaveBtn.textContent = 'Save patient profile';
    patientCancelBtn.hidden = true;
  }

  window.loadPatientForEdit = (id) => {
    const p = patients.find((item) => item.id === id);
    if (!p) return;
    editingPatientId = p.id;
    patientEditIdInput.value = p.id;
    document.getElementById('patient-name').value = p.babyName || '';
    document.getElementById('patient-bed').value = p.bedNumber || 'Bed 1';
    document.getElementById('patient-age').value = String(p.ageDays ?? 1);
    document.getElementById('patient-weight').value = String(p.weightKg ?? 3.2);
    document.getElementById('patient-feed').value = String(p.feedingIntervalHours ?? 2.5);
    document.getElementById('patient-diaper').value = String(p.diaperIntervalHours ?? 3);
    document.getElementById('patient-status').value = p.status || 'active';
    document.getElementById('patient-notes').value = p.medicalNotes || '';
    patientFormLabel.textContent = 'EDIT PATIENT';
    patientFormHeading.textContent = `Edit ${p.babyName}`;
    patientSaveBtn.textContent = 'Update patient profile';
    patientCancelBtn.hidden = false;
    showMsg(patientFormMsg, '');
  };

  patientCancelBtn.addEventListener('click', () => {
    resetPatientForm();
    showMsg(patientFormMsg, '');
  });

  patientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg(patientFormMsg, '');
    const babyName = document.getElementById('patient-name').value.trim();
    const bedNumber = document.getElementById('patient-bed').value;
    const ageDays = Number(document.getElementById('patient-age').value);
    const weightKg = Number(document.getElementById('patient-weight').value);
    const feedingIntervalHours = Number(document.getElementById('patient-feed').value);
    const diaperIntervalHours = Number(document.getElementById('patient-diaper').value);
    const statusVal = document.getElementById('patient-status').value;
    const medicalNotes = document.getElementById('patient-notes').value.trim();

    if (!babyName) {
      showMsg(patientFormMsg, 'Please enter the baby name or patient ID.', 'error');
      return;
    }
    if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > 365) {
      showMsg(patientFormMsg, 'Age must be between 0 and 365 days.', 'error');
      return;
    }
    if (!Number.isFinite(weightKg) || weightKg < 0.4 || weightKg > 12) {
      showMsg(patientFormMsg, 'Weight must be between 0.4 and 12 kg.', 'error');
      return;
    }

    patientSaveBtn.disabled = true;
    try {
      if (editingPatientId) {
        const existing = patients.find((p) => p.id === editingPatientId);
        const existingStatus = existing ? existing.status : 'active';
        await fb.updatePatient(editingPatientId, existingStatus, {
          babyName,
          bedNumber,
          ageDays,
          weightKg,
          feedingIntervalHours,
          diaperIntervalHours,
          medicalNotes,
          status: statusVal
        });
        resetPatientForm();
        showMsg(patientFormMsg, 'Patient profile updated.', 'ok');
      } else {
        await fb.createPatient({
          babyName,
          bedNumber,
          ageDays,
          weightKg,
          feedingIntervalHours,
          diaperIntervalHours,
          medicalNotes
        });
        resetPatientForm();
        showMsg(patientFormMsg, 'Patient profile saved.', 'ok');
      }
    } catch (err) {
      showMsg(patientFormMsg, err?.message || 'Could not save patient profile.', 'error');
    } finally {
      patientSaveBtn.disabled = false;
    }
  });

  document.querySelectorAll('[data-pfilter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      patientFilter = btn.dataset.pfilter || 'all';
      document.querySelectorAll('[data-pfilter]').forEach((b) => b.classList.toggle('dark', b === btn));
      renderPatientsList();
    });
  });

  function renderPatientsList() {
    if (!patientCardsEl) return;
    const activeCount = patients.filter((p) => p.status === 'active').length;
    patientsCountLine.textContent = `${activeCount} active · ${patients.length} total`;
    showMsg(patientsListError, patientsError ? `Could not load patient profiles: ${patientsError}` : '', patientsError ? 'error' : 'info');

    if (patientsLoading) {
      patientCardsEl.replaceChildren(el('div', 'patient-empty', 'Loading patient profiles…'));
      return;
    }

    const filtered = patients.filter((p) => (patientFilter === 'all' ? true : p.status === patientFilter));
    if (!filtered.length) {
      const msg = patients.length
        ? `No ${patientFilter} patient profiles.`
        : 'No patient profiles yet. Add your first newborn profile using the form.';
      patientCardsEl.replaceChildren(el('div', 'patient-empty', msg));
      return;
    }

    const cards = filtered.map((p) => {
      const isDischarged = p.status === 'discharged';
      const card = el('article', `patient-card${isDischarged ? ' is-discharged' : ''}`);
      card.append(el('span', `pill ${isDischarged ? 'grey' : 'green'}`, isDischarged ? 'DISCHARGED' : 'ACTIVE'));

      const head = el('div', 'patient-card-head');
      head.append(el('span', 'patient-card-name', p.babyName), el('span', 'patient-card-bed', p.bedNumber));
      card.append(head);

      const metrics = el('div', 'patient-metrics');
      [
        ['AGE', `${p.ageDays} days`],
        ['WEIGHT', `${p.weightKg} kg`],
        ['FEED EVERY', `${p.feedingIntervalHours} h`],
        ['DIAPER CHECK', `${p.diaperIntervalHours} h`]
      ].forEach(([k, v]) => {
        const box = el('div', 'fact');
        box.append(el('small', '', k), el('b', '', v));
        metrics.append(box);
      });
      card.append(metrics);

      if (p.medicalNotes) {
        card.append(el('div', 'patient-notes', p.medicalNotes));
      }

      const actions = el('div', 'row');
      if (!isDischarged) {
        actions.append(button('Edit', 'sq', () => {
          window.loadPatientForEdit(p.id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }));
        actions.append(button('Discharge', 'sq', async () => {
          try {
            await fb.updatePatient(p.id, p.status, { ...p, status: 'discharged' });
          } catch (err) {
            showMsg(patientsListError, err?.message || 'Could not update status.', 'error');
          }
        }));
      } else {
        actions.append(button('Re-admit', 'sq dark', async () => {
          try {
            await fb.updatePatient(p.id, 'discharged', { bedNumber: p.bedNumber });
          } catch (err) {
            showMsg(patientsListError, err?.message || 'Could not re-admit patient.', 'error');
          }
        }));
      }

      const isConfirming = pendingDeleteId === p.id;
      const delBtn = button(isConfirming ? 'Confirm delete' : 'Delete', `sq${isConfirming ? ' dark' : ''}`, async () => {
        if (pendingDeleteId !== p.id) {
          pendingDeleteId = p.id;
          renderPatientsList();
          return;
        }
        try {
          pendingDeleteId = '';
          await fb.deletePatient(p.id);
          if (editingPatientId === p.id) resetPatientForm();
        } catch (err) {
          showMsg(patientsListError, err?.message || 'Could not delete patient profile.', 'error');
        }
      });
      actions.append(delBtn);

      if (!isDischarged) {
        actions.append(button('View on dashboard', 'sq', () => {
          location.hash = p.bedNumber === 'Bed 1' ? '#bed1' : '#dashboard';
        }));
      }

      card.append(actions);
      return card;
    });

    patientCardsEl.replaceChildren(...cards);
  }

  function updateAuthUI(user) {
    currentUser = user;
    const isVerified = Boolean(user && user.emailVerified);
    const shortName = user?.displayName ? user.displayName.split(' ')[0] : user?.email?.split('@')[0] || 'Account';

    navAuthBtn.textContent = user ? shortName : 'Sign in';
    navAuthBtn.href = isVerified ? '#patients' : '#auth';

    authSignedOut.hidden = Boolean(user);
    authVerifyCard.hidden = !(user && !isVerified);
    authSignedIn.hidden = !isVerified;

    if (user && !isVerified) {
      document.getElementById('auth-verify-text').textContent = `We sent a verification link to ${user.email}. Verify your email before saving patient profiles.`;
    }
    if (isVerified) {
      const ward = userProfile?.wardName || pendingWardName || 'Ward A';
      document.getElementById('signed-in-name').textContent = user.displayName || user.email;
      document.getElementById('signed-in-meta').textContent = `${user.email} · ${ward}`;
      patientsUserChip.textContent = `● ${user.displayName || user.email}`;
      patientsAuthLink.hidden = true;
      patientsSignoutBtn.hidden = false;
      patientsWardBadge.textContent = `${ward} · Patient profiles`;
      dashWardPill.textContent = `${ward} · Newborn room`;
    } else {
      patientsUserChip.textContent = user ? 'Verify email required' : 'Not signed in';
      patientsAuthLink.hidden = false;
      patientsSignoutBtn.hidden = true;
      patientsWardBadge.textContent = 'Ward A · Patient profiles';
      dashWardPill.textContent = 'Ward A · Newborn room';
    }

    patientsAuthGate.hidden = isVerified;
    patientsWorkspace.hidden = !isVerified;
  }

  fb.subscribeAuth(async (user) => {
    if (patientsUnsub) {
      patientsUnsub();
      patientsUnsub = null;
    }
    userProfile = null;
    patientsError = '';

    if (user && user.emailVerified) {
      patientsLoading = true;
      updateAuthUI(user);
      renderPatientsList();
      try {
        userProfile = await fb.ensureUserProfile(user, { wardName: pendingWardName });
        updateAuthUI(user);
      } catch (err) {
        console.error('Could not load caregiver profile:', err);
      }
      patientsUnsub = fb.subscribePatients(
        user.uid,
        (list) => {
          patients = list;
          patientsLoading = false;
          patientsError = '';
          renderPatientsList();
          render(true);
        },
        (err) => {
          patientsLoading = false;
          patientsError = err?.message || 'Permission denied';
          renderPatientsList();
        }
      );
    } else {
      patients = [];
      patientsLoading = false;
      updateAuthUI(user);
      renderPatientsList();
      render(true);
    }
  });
}

// ---------- Page switching (home / #auth / #patients / #dashboard / #bed1) ----------
function route() {
  const hash = location.hash.replace('#', '');
  view =
    hash === 'dashboard'
      ? 'dash'
      : hash === 'bed1'
        ? 'bed'
        : hash === 'auth'
          ? 'auth'
          : hash === 'patients'
            ? 'patients'
            : 'home';
  document.getElementById('view-home').hidden = view !== 'home';
  document.getElementById('view-auth').hidden = view !== 'auth';
  document.getElementById('view-patients').hidden = view !== 'patients';
  document.getElementById('view-dashboard').hidden = view !== 'dash';
  document.getElementById('view-bed').hidden = view !== 'bed';
  document.title = {
    home: 'NeoGuardian',
    auth: 'NeoGuardian · Sign in',
    patients: 'NeoGuardian · Patient profiles',
    dash: 'NeoGuardian · Nurse dashboard',
    bed: 'NeoGuardian · Bed 1'
  }[view];

  if (view === 'home') {
    const target = hash && document.getElementById(hash);
    if (target) target.scrollIntoView();
    requestAnimationFrame(() => {
      if (window.syncHomeReveals) window.syncHomeReveals();
      if (window.updateScrollProgress) window.updateScrollProgress();
    });
  } else {
    window.scrollTo(0, 0);
    if (view === 'dash' || view === 'bed') {
      lastSig = '';
      poll();
      if (view === 'bed') greetOnce();
    }
    if (window.updateScrollProgress) window.updateScrollProgress();
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

initLandingMotion();
initAuthAndPatients();
initChat();
window.addEventListener('hashchange', route);
route();
setInterval(() => { if (view === 'dash' || view === 'bed') poll(); }, 2000);

