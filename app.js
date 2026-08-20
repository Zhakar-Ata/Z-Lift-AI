/* ============================================================
   Z LIFT AI — UI CONTROLLER (standalone)
   ============================================================ */
'use strict';
const $ = s => document.querySelector(s);
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- modes (spec §32) ---------------- */
const MODES = [
  { id: 'auto', fa: '🤖 خودکار' },
  { id: 'diagnose', fa: '🔧 عیب‌یابی' },
  { id: 'standard', fa: '📚 استاندارد' },
  { id: 'calc', fa: '🧮 محاسبه' },
  { id: 'vvvf', fa: '📟 خطای درایو' },
  { id: 'learn', fa: '🎓 آموزش' }
];
let currentMode = 'auto';

const QUICK = [
  { icon: '🔧', label: 'عیب‌یابی آسانسور', send: 'آسانسور حرکت نمی‌کند، از کجا شروع کنم؟' },
  { icon: '📚', label: 'سؤال از استاندارد', send: 'درگیری قفل درب طبقه طبق استاندارد چقدر باید باشد؟' },
  { icon: '📟', label: 'خطای VVVF', send: 'درایو خطای OC می‌دهد' },
  { icon: '📐', label: 'زاویه آلفا 1:1', send: 'زاویه آلفا برای سیستم 1:1 چطوری حساب میشه؟' },
  { icon: '🚪', label: 'مشکل درب', send: 'درب طبقه قفل نمی‌کند' },
  { icon: '🎯', label: 'مشکل لولینگ', send: 'آسانسور لولینگ دقیق ندارد' },
  { icon: '🛑', label: 'مشکل ترمز', send: 'بریک آزاد نمی‌کند از کجا شروع کنم؟' },
  { icon: '🛢️', label: 'هیدرولیک', send: 'آسانسور هیدرولیک ریزش دارد' },
  { icon: '🔗', label: 'مدار ایمنی', send: 'مدار سری ایمنی چه اجزایی دارد؟' },
  { icon: '⚡', label: 'بررسی سیم‌بکسل', send: 'سیم بکسل را چطور بازرسی کنم و کی باید تعویض شود؟' },
  { icon: '🎓', label: 'فرق 1:1 و 2:1', send: 'فرق 1:1 و 2:1 چیه؟' },
  { icon: '⚠️', label: 'ایمنی کار', send: 'نکات ایمنی کار روی آسانسور را بگو' }
];

/* ---------------- render helpers ---------------- */
const INTENT_FA = { standard: '📚 حالت استاندارد', vvvf: '📟 خطای درایو', calc: '🧮 محاسبه', diagnose: '🔧 عیب‌یابی', learn: '🎓 آموزش', safety: '⚠️ ایمنی' };

/* Source-card status codes are internal English enums; showing them raw makes
   the Persian UI read as half-translated. Localize, with a safe fallback. */
const STATUS_FA = {
  VERIFIED: 'تأییدشده', MIXED: 'ترکیبی', PUBLISHED: 'منتشرشده', NONE: 'بدون منبع',
  DRAFT: 'پیش‌نویس', REVIEW: 'در حال بازبینی', ARCHIVED: 'بایگانی‌شده',
  verified: 'تأییدشده', high_confidence: 'اطمینان بالا'
};
const statusFa = s => STATUS_FA[s] || STATUS_FA[String(s).toUpperCase()] || s;

function addMsg(role, text, extra) {
  const chat = $('#chat');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  let inner = '';
  if (role === 'ai' && extra && extra.intent) {
    inner += `<span class="badge-intent">${INTENT_FA[extra.intent] || ''}</span>`;
    if (extra.confBadge) inner += ` <span class="badge-intent" style="background:transparent;border:1px solid var(--border);color:var(--text3)">${esc(extra.confBadge)}</span>`;
  }
  inner += `<div class="bubble">${esc(text)}</div>`;
  if (role === 'ai' && extra && extra.sourceCard) {
    inner += `<div class="source-card">
      <span class="sc-ico">📎</span>
      <span class="sc-body"><b>${esc(extra.sourceCard.title)}</b><br>
      <span class="sc-sub">وضعیت: ${esc(statusFa(extra.sourceCard.status))} · نسخه ${esc(extra.sourceCard.version)} — ${esc(extra.sourceCard.quality)}</span></span>
    </div>`;
  }
  if (role === 'ai' && extra && extra.actions && extra.actions.length) {
    inner += `<div class="actions">${extra.actions.map((a, i) =>
      `<button class="action-chip" data-ai="${i}">${esc(a.label)}</button>`).join('')}</div>`;
  }
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  inner += `<div class="meta">${time}${role === 'ai' ? ' · <button class="copy-link" data-copy>کپی 📋</button>' : ''}</div>`;
  div.innerHTML = inner;
  chat.appendChild(div);
  const cp = div.querySelector('[data-copy]');
  if (cp) cp.onclick = async () => {
    try { await navigator.clipboard.writeText(text); cp.textContent = 'کپی شد ✓'; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); cp.textContent = 'کپی شد ✓'; } catch (e2) {}
      ta.remove();
    }
    setTimeout(() => { cp.textContent = 'کپی 📋'; }, 1500);
  };
  // wire action chips
  if (extra && extra.actions) {
    div.querySelectorAll('[data-ai]').forEach(btn => {
      btn.onclick = () => {
        const a = extra.actions[+btn.dataset.ai];
        // disable siblings after choice
        div.querySelectorAll('.action-chip').forEach(b => { b.disabled = true; b.style.opacity = .4; });
        btn.style.opacity = 1; btn.style.background = 'var(--ai)'; btn.style.color = '#fff';
        if (a.diagStep) {
          addMsg('user', a.label);
          think(() => {
            const res = LocalBrain.diagStep(a.diagStep.flowId, a.diagStep.nodeId);
            res.confBadge = '🟠 علت محتمل — تا اندازه‌گیری، قطعی نیست';
            addMsg('ai', res.text, res);
            Memory.history.push({ role: 'ai', text: res.text, intent: 'diagnose', ts: Date.now() });
            persist();
          });
        } else if (a.calcStart) {
          addMsg('user', a.label);
          think(() => {
            const res = LocalBrain.startCalc(a.calcStart);
            res.intent = 'calc';
            addMsg('ai', res.text, res);
            Memory.history.push({ role: 'ai', text: res.text, intent: 'calc', ts: Date.now() });
            persist();
          });
        } else if (a.send) {
          send(a.send);
        }
      };
    });
  }
  chat.scrollTop = chat.scrollHeight;
  return div;
}

let typingEl = null;
function showTyping() {
  typingEl = document.createElement('div');
  typingEl.className = 'msg ai';
  typingEl.innerHTML = '<div class="bubble typing"><i></i><i></i><i></i></div>';
  $('#chat').appendChild(typingEl);
  $('#chat').scrollTop = $('#chat').scrollHeight;
}
function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }
function think(fn) {
  showTyping();
  setTimeout(() => { hideTyping(); fn(); }, 350 + Math.random() * 350);
}

/* ---------------- welcome screen ---------------- */
function renderWelcome() {
  const chat = $('#chat');
  chat.innerHTML = `
    <div class="welcome">
      <div class="big-logo"><svg viewBox="0 0 32 32" width="40" height="40"><path d="M10 6h12l-8 8h8L10 26l4-8h-6z" fill="#fff"/></svg></div>
      <h1>Z Lift AI</h1>
      <p>دستیار هوشمند تکنسین آسانسور — عیب‌یابی قدم‌به‌قدم، استاندارد، محاسبات و خطاهای درایو</p>
      <div class="honesty">🎯 اصل کاری من: «دقت مهم‌تر از اعتمادبه‌نفس» — اگر چیزی را از منبع معتبر ندانم، صادقانه می‌گویم و حدس نمی‌زنم.</div>
    </div>
    <div class="quick-grid">
      ${QUICK.map((x, i) => `<button class="quick" data-q="${i}"><span class="qi">${x.icon}</span><span>${esc(x.label)}</span></button>`).join('')}
    </div>`;
  chat.querySelectorAll('[data-q]').forEach(b => b.onclick = () => send(QUICK[+b.dataset.q].send));
}

/* ---------------- send pipeline ---------------- */
let busy = false;
async function send(text) {
  const raw = (text !== undefined ? text : $('#input').value).trim();
  if (!raw || busy) return;
  busy = true;
  $('#sendBtn').disabled = true;
  $('#input').value = '';
  autoGrow();
  // clear welcome on first message
  if ($('#chat').querySelector('.welcome')) $('#chat').innerHTML = '';
  addMsg('user', raw);
  Memory.history.push({ role: 'user', text: raw, ts: Date.now() });
  showTyping();
  try {
    const provider = (typeof pickProvider === 'function') ? pickProvider() : activeProvider;
    const res = await provider.answer(raw, currentMode);
    hideTyping();
    addMsg('ai', res.text, res);
    Memory.history.push({ role: 'ai', text: res.text, intent: res.intent, ts: Date.now() });
    updateCtxPill();
    persist();
  } catch (e) {
    hideTyping();
    addMsg('ai', '⚠️ خطایی در پردازش رخ داد. دوباره تلاش کن.\n(جزئیات فنی در کنسول ثبت شد)');
    console.error('[ZLiftAI]', e);
  }
  busy = false;
  $('#sendBtn').disabled = false;
}
function persist() { saveSession(); }

/* ---------------- restore previous conversation ---------------- */
function restoreHistory() {
  if (!Memory.history.length) { renderWelcome(); return; }
  $('#chat').innerHTML = '';
  for (const m of Memory.history.slice(-40)) {
    addMsg(m.role === 'user' ? 'user' : 'ai', m.text, m.role === 'ai' ? { intent: m.intent } : null);
  }
}

/* ---------------- context drawer (spec §27) ---------------- */
function openDrawer() {
  const c = Memory.ctx;
  const root = $('#drawerRoot');
  root.innerHTML = `
    <div class="drawer-bg" onclick="closeDrawer()"></div>
    <div class="drawer">
      <h3>🛗 زمینه آسانسور (Context)</h3>
      <p style="font-size:11.5px;color:var(--text3);margin-bottom:12px">این اطلاعات به من کمک می‌کند پاسخ‌ها را دقیق‌تر بدهم. بعداً به دیتابیس Z Lift اصلی متصل خواهد شد.</p>
      <div class="field"><label>نوع آسانسور</label>
        <select id="cx_type">
          <option value="">—</option>
          <option value="traction" ${c.type === 'traction' ? 'selected' : ''}>کششی</option>
          <option value="hydraulic" ${c.type === 'hydraulic' ? 'selected' : ''}>هیدرولیک</option>
        </select></div>
      <div class="field"><label>بکسل‌بندی</label>
        <select id="cx_roping">
          <option value="">—</option>
          <option value="1:1" ${c.roping === '1:1' ? 'selected' : ''}>1:1</option>
          <option value="2:1" ${c.roping === '2:1' ? 'selected' : ''}>2:1</option>
        </select></div>
      <div class="field"><label>برند درایو (VVVF)</label><input id="cx_driveBrand" value="${esc(c.driveBrand || '')}" placeholder="مثلاً Delta" /></div>
      <div class="field"><label>مدل درایو</label><input id="cx_driveModel" value="${esc(c.driveModel || '')}" placeholder="مثلاً VFD-ED" /></div>
      <div class="field"><label>تابلو فرمان</label><input id="cx_controller" value="${esc(c.controller || '')}" placeholder="مثلاً آریان" /></div>
      <div class="field"><label>ظرفیت (kg)</label><input id="cx_capacity" type="number" value="${esc(c.capacity || '')}" /></div>
      <div class="field"><label>تعداد طبقات</label><input id="cx_floors" type="number" value="${esc(c.floors || '')}" /></div>
      <button class="btn" onclick="saveCtx()">💾 ذخیره زمینه</button>
      <hr class="sep" />
      <button class="btn ghost" onclick="clearCtx()">🗑 پاک کردن زمینه</button>
      <hr class="sep" />
      <h3>🤖 اتصال Arena (مدل ابری)</h3>
      <p style="font-size:11px;color:var(--text3);margin-bottom:10px">
        Arena موتور استدلال می‌شود و دانش آسانسوری Z Lift قبل از هر پاسخ به آن تزریق می‌شود (RAG).
        ⚠️ کلید API فقط روی همین دستگاه ذخیره می‌شود — هرگز در کد یا سرور Z Lift قرار نمی‌گیرد.
        روش امن‌تر: آدرس یک proxy شخصی که کلید را خودش نگه می‌دارد.
      </p>
      <div class="field"><label>آدرس Endpoint (سازگار با OpenAI، https)</label>
        <input id="ar_endpoint" dir="ltr" placeholder="https://your-proxy.example.com/v1/chat/completions" value="${esc(ArenaConfig.load().endpoint || '')}" /></div>
      <div class="field"><label>نام مدل (اختیاری)</label>
        <input id="ar_model" dir="ltr" placeholder="default" value="${esc(ArenaConfig.load().model || '')}" /></div>
      <div class="field"><label>کلید API (اختیاری — اگر proxy خودش کلید ندارد)</label>
        <input id="ar_key" dir="ltr" type="password" placeholder="فقط روی این دستگاه ذخیره می‌شود" value="${esc(ArenaConfig.load().apiKey || '')}" /></div>
      <button class="btn" onclick="saveArenaCfg()">💾 ذخیره و تست اتصال</button>
      <div id="ar_status" style="font-size:11.5px;margin-top:8px;color:var(--text2)"></div>
      <button class="btn ghost" style="margin-top:8px" onclick="clearArenaCfg()">🗑 قطع اتصال Arena</button>
      <hr class="sep" />
      <h3>📚 وضعیت دانش</h3>
      <p style="font-size:11.5px;color:var(--text2);line-height:2">
        ${faNum(KNOWLEDGE.length)} مبحث فنی گردآوری‌شده<br>
        ${faNum(DIAG_FLOWS.length)} مسیر عیب‌یابی قدم‌به‌قدم<br>
        ${faNum(CALCULATORS.length)} محاسبه‌گر معتبر<br>
        ${faNum(VVVF_DB.reduce((a, d) => a + d.codes.length, 0))} الگوی خطای درایو (${faNum(VVVF_DB.length)} خانواده)<br>
        ${faNum(STD_TOPICS.length)} موضوع استاندارد (خلاصه گردآوری‌شده)<br>
        ${faNum(STD_REGISTRY.families.reduce((a, f) => a + f.parts.length, 0))} سند استاندارد در رجیستری نسخه‌دار
      </p>
      <p style="font-size:10.5px;color:var(--text3)">⚖️ خلاصه‌های استاندارد جنبه آموزشی دارند و جایگزین متن رسمی نیستند.</p>
    </div>`;
}
function closeDrawer() { $('#drawerRoot').innerHTML = ''; }
function saveCtx() {
  Memory.setCtx({
    type: $('#cx_type').value || undefined,
    roping: $('#cx_roping').value || undefined,
    driveBrand: $('#cx_driveBrand').value.trim() || undefined,
    driveModel: $('#cx_driveModel').value.trim() || undefined,
    controller: $('#cx_controller').value.trim() || undefined,
    capacity: $('#cx_capacity').value || undefined,
    floors: $('#cx_floors').value || undefined
  });
  // drop undefined keys
  Object.keys(Memory.ctx).forEach(k => Memory.ctx[k] === undefined && delete Memory.ctx[k]);
  saveSession();
  updateCtxPill();
  closeDrawer();
}
async function saveArenaCfg() {
  const endpoint = $('#ar_endpoint').value.trim();
  const model = $('#ar_model').value.trim();
  const apiKey = $('#ar_key').value.trim();
  const st = $('#ar_status');
  if (!endpoint) { ArenaConfig.clear(); st.textContent = 'پیکربندی پاک شد — موتور محلی فعال است.'; window.updNet && window.updNet(); return; }
  if (!endpoint.startsWith('https://')) { st.textContent = '⚠️ آدرس باید با https:// شروع شود.'; return; }
  ArenaConfig.save({ endpoint, model: model || undefined, apiKey: apiKey || undefined });
  st.textContent = '⏳ در حال تست اتصال...';
  const hc = await ArenaProvider.healthCheck();
  st.textContent = hc.ok ? '✅ اتصال برقرار شد — Arena فعال است.' : ('❌ اتصال برقرار نشد: ' + (hc.reason || '') + ' — موتور محلی فعال می‌ماند.');
  window.updNet && window.updNet();
}
function clearArenaCfg() {
  ArenaConfig.clear();
  const st = $('#ar_status');
  if (st) st.textContent = 'اتصال Arena حذف شد — موتور محلی فعال است.';
  window.updNet && window.updNet();
}
function clearCtx() { Memory.ctx = {}; saveSession(); updateCtxPill(); closeDrawer(); }
function updateCtxPill() {
  const d = Memory.describe();
  const pill = $('#ctxPill');
  if (d) { pill.textContent = '🛗 ' + d; pill.classList.remove('hidden'); }
  else pill.classList.add('hidden');
}

/* ---------------- mode bar ---------------- */
function renderModes() {
  $('#modeBar').innerHTML = MODES.map(m =>
    `<button class="mode ${currentMode === m.id ? 'active' : ''}" data-m="${m.id}">${m.fa}</button>`).join('');
  $('#modeBar').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    currentMode = b.dataset.m;
    renderModes();
  });
}

/* ---------------- misc UI ---------------- */
function autoGrow() {
  const ta = $('#input');
  ta.style.height = 'auto';
  ta.style.height = Math.min(110, ta.scrollHeight) + 'px';
}

/* ---------------- init ---------------- */
(function init() {
  loadSession();
  renderModes();
  restoreHistory();
  updateCtxPill();

  $('#sendBtn').onclick = () => send();
  $('#input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $('#input').addEventListener('input', autoGrow);

  $('#themeBtn').onclick = () => {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('zliftai_theme', t); } catch (e) {}
  };
  try {
    const t = localStorage.getItem('zliftai_theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}

  $('#clearBtn').onclick = () => {
    if (Memory.history.length && !confirm('گفتگوی فعلی پاک شود؟ (زمینه آسانسور حفظ می‌شود)')) return;
    Memory.history = [];
    saveSession();
    renderWelcome();
  };

  // online/offline indicator (spec §38)
  function updNet() {
    const on = navigator.onLine;
    const arenaOn = (typeof ArenaProvider !== 'undefined') && ArenaProvider.available();
    $('#statusDot').classList.toggle('off', false);
    $('#statusDot').style.background = arenaOn ? 'var(--ai)' : 'var(--ok)';
    $('#providerLabel').textContent = arenaOn
      ? 'Arena + دانش Z Lift — متصل'
      : ('موتور محلی — ' + (on ? 'آنلاین (Arena: پیکربندی نشده)' : 'آفلاین ✓'));
  }
  window.updNet = updNet;
  window.addEventListener('online', updNet);
  window.addEventListener('offline', updNet);
  updNet();
})();
