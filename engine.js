/* ============================================================
   Z LIFT AI — CORE ENGINE
   Deterministic local brain: Persian NLU → intent → retrieval →
   structured answer. No hallucination by construction: it can only
   answer from the curated brain, and says so when it can't.
   ============================================================ */

/* ---------------- AIProvider abstraction (spec §52) ---------------- */
const AIProviders = {
  local: {
    id: 'local',
    name: 'موتور محلی Z Lift (آفلاین)',
    available: () => true,
    async generate(q, ctx) { return LocalBrain.answer(q, ctx); },
    async answer(q, ctx) { return this.generate(q, ctx); },   /* alias kept for UI compat */
    stream: null,      /* NOT IMPLEMENTED — deterministic local engine answers atomically */
    embed: null,       /* NOT IMPLEMENTED — retrieval is lexical, no embeddings needed locally */
    async healthCheck() { return { ok: true, provider: 'local', knowledge: KNOWLEDGE_META }; }
  }
  /* future cloud providers plug in via a secure backend proxy.
     NEVER put an API key in this file — it ships to the client. */
};
let activeProvider = AIProviders.local;

/* knowledge governance metadata (spec §16, §22) */
const KNOWLEDGE_META = {
  version: '2.0',
  status: 'PUBLISHED',            /* DRAFT→REVIEW→VERIFIED→PUBLISHED→ARCHIVED */
  quality: 'curated-summary',     /* خلاصه گردآوری‌شده — نه متن رسمی استاندارد/سازنده */
  language: 'fa',
  updated: '2026-08',
  publisher: 'Z Lift curated technical knowledge'
};

/* ---------------- Persian normalization + slang map (spec §24-25) ---------------- */
const SLANG = [
  // [pattern (normalized persian), canonical concept tokens]
  ['راه نمیفته', 'حرکت نمیکند'], ['راه نمی افته', 'حرکت نمیکند'], ['روشن نمیشه', 'حرکت نمیکند برق'],
  ['کار نمیکنه', 'حرکت نمیکند'], ['نمیره بالا', 'یک جهت بالا'], ['نمیاد پایین', 'یک جهت پایین'],
  ['بریک', 'ترمز'], ['ول نمیکنه', 'باز نمیشود'], ['آزاد نمیکنه', 'باز نمیشود'],
  ['میچسبه', 'جوش خوردگی کنتاکت'], ['می چسبه', 'جوش خوردگی کنتاکت'],
  ['لولینگ', 'همسطح سازی'], ['لول', 'همسطح سازی'], ['تراز نمیشه', 'همسطح سازی'],
  ['اورکارنت', 'OC اضافه جریان'], ['اور کارنت', 'OC اضافه جریان'], ['اوورکارنت', 'OC اضافه جریان'],
  ['اوروولتاژ', 'OV اضافه ولتاژ'], ['سری ه', 'مدار ایمنی'], ['مدار سریه', 'مدار ایمنی قطع'],
  ['سری قطعه', 'مدار ایمنی قطع'], ['فتوسل', 'پرده نوری فتوسل'], ['درایو', 'VVVF درایو'],
  ['تابلو', 'تابلو فرمان'], ['گیربکسی', 'گیربکس موتور'], ['گرلس', 'گیرلس'],
  ['دو به یک', '2:1'], ['یک به یک', '1:1'], ['وایر', 'سیم بکسل'], ['بکسل', 'سیم بکسل'],
  ['فلکه', 'فلکه کشش'], ['وزنه', 'وزنه تعادل'], ['پاراشوت', 'پاراشوت ایمنی'],
  ['جک', 'جک هیدرولیک سیلندر'], ['پاور یونیت', 'پاوریونیت'], ['یونیت', 'پاوریونیت'],
  ['ریزش داره', 'ریزش پایین آمدن تدریجی'], ['نشتی', 'نشت روغن'],
  ['قفل نمیکنه', 'قفل درب درگیر نمیشود'], ['درب نمیبنده', 'درب بسته نمیشود'],
  ['درب باز نمیشه', 'درب باز نمیشود'], ['برمیگرده', 'درب برگشت'],
  ['صدا میده', 'صدای غیرعادی'], ['تق تق', 'صدای غیرعادی'], ['ویبره', 'لرزش'],
  ['داغ میکنه', 'داغ شدن'], ['جوش میاره', 'داغ شدن'], ['آمپر میکشه', 'جریان بالا'],
  ['برد', 'برد الکترونیکی'], ['شستی', 'شستی احضار'], ['ارور', 'خطا'], ['فالت', 'خطا'],
  ['کف نمیشه', 'همسطح سازی'], ['شفت', 'چاه'], ['موتورخونه', 'موتورخانه']
];
function normFa(s) {
  return String(s || '')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/\u200c/g, '')                      /* ZWNJ joins: نمی‌کند → نمیکند */
    .replace(/(^|\s)نمی\s+/g, '$1نمی')          /* real-space variants too */
    .replace(/(^|\s)می\s+(?=[\u0600-\u06FF])/g, '$1می')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
function expandSlang(q) {
  let out = q;
  for (const [pat, canon] of SLANG) if (q.includes(normFa(pat))) out += ' ' + canon;
  return out;
}

/* ---------------- intent detection (spec §20 pipeline) ---------------- */
const INTENTS = [
  { id: 'STANDARD',   keys: ['استاندارد', 'en 81', 'en81', '6303', '۶۳۰۳', 'بند', 'الزام', 'طبق استاندارد', 'مقررات', 'isiri', 'بازرسی چه'] },
  { id: 'VVVF',       keys: ['vvvf', 'درایو', 'اینورتر', 'فالت', 'کد خطا', ' oc', ' ov', ' oh', ' lv', ' uv', 'pg ', 'اضافه جریان', 'اضافه ولتاژ', 'دلتا', 'یاسکاوا', 'yaskawa', 'invt', 'آرکل', 'arkel', 'altivar', 'اشنایدر'] },
  { id: 'CALCULATION',keys: ['محاسبه', 'حساب', 'فرمول', 'چقدر میشه', 'چطوری حساب', 'زاویه', 'آلفا', 'الفا', 'توان موتور', 'وزنه تعادل چند', 'ضریب اطمینان', 'قطر سیلندر', 'دبی', 'افت ولتاژ', 'kw', 'اسب بخار', 'تبدیل واحد'] },
  { id: 'DOOR',       keys: ['درب', 'فتوسل', 'پرده نوری', 'سردرب', 'قفل طبقه', 'کوپلر', 'لته'] },
  { id: 'BRAKE',      keys: ['ترمز', 'بریک', 'لنت', 'باز نمیشود ترمز'] },
  { id: 'TRACTION',   keys: ['کشش', 'بکسل', 'فلکه', 'وزنه تعادل', 'گیرلس', 'گیربکس', '1:1', '2:1', 'ریل', 'کفشک'] },
  { id: 'HYDRAULIC',  keys: ['هیدرولیک', 'پاوریونیت', 'جک ', 'سیلندر', 'پمپ', 'روغن', 'شیر ', 'ریزش', 'فشار روغن'] },
  { id: 'MEASUREMENT',keys: ['اندازه گیری', 'اندازه‌گیری', 'مولتی متر', 'کلمپ', 'میگر', 'چطور تست کنم', 'چطوری تست', 'ولتاژ بگیرم'] },
  { id: 'SAFETY',     keys: ['ایمنی کار', 'خطرناک', 'برق گرفتگی', 'لوتو', 'loto', 'نجات', 'مسافر گیر', 'محبوس'] },
  { id: 'TRAINING',   keys: ['یاد بده', 'آموزش', 'از صفر', 'توضیح کامل', 'یادم بده'] },
  { id: 'DIAGNOSTIC', keys: ['حرکت نمیکند', 'خرابه', 'مشکل', 'عیب', 'ایراد', 'چرا', 'خطا میده', 'کار نمیکنه', 'قطع میشه', 'میسوزه', 'صدای غیرعادی', 'لرزش', 'داغ شدن', 'همسطح سازی', 'باز نمیشود', 'بسته نمیشود', 'درگیر نمیشود', 'از کجا شروع'] },
  { id: 'COMPONENT',  keys: ['قطعه', 'کنتاکتور', 'رله', 'انکودر', 'سنسور', 'لیمیت', 'گاورنر', 'پاراشوت', 'بافر', 'تابلو فرمان'] },
  { id: 'KNOWLEDGE',  keys: ['یعنی چی', 'چیست', 'چیه', 'فرق', 'تفاوت', 'چطور کار', 'چجوری کار', 'اجزای', 'وظیفه', 'کاربرد'] },
  { id: 'GENERAL_TECHNICAL', keys: [] }
];
/* intent → handler routing. Component/system intents route to diagnose
   when phrased as a problem, otherwise to learn. */
const QUESTION_WORDS = ['یعنی چی', 'چیست', 'چیه', 'چطور کار', 'چجوری کار', 'اجزای', 'فرق', 'تفاوت', 'وظیفه', 'کاربرد', 'یاد بده', 'آموزش'];
const PROBLEM_WORDS = ['نمیکند', 'نمیشود', 'نمیکنه', 'نمیشه', 'خرابه', 'مشکل', 'عیب', 'خطا', 'میچسبه', 'قطع', 'داغ', 'صدا', 'لرزش', 'ریزش', 'از کجا شروع'];
function routeIntent(intentId, q) {
  const isQuestion = QUESTION_WORDS.some(w => q.includes(normFa(w)));
  const isProblem = PROBLEM_WORDS.some(w => q.includes(normFa(w)));
  /* explicit calculation verbs override component/system intents */
  if (/حساب|محاسبه|فرمول|چقدر میشه/.test(q)) return 'calc';
  /* explicit standard reference overrides */
  if (/طبق استاندارد|طبق en|بند استاندارد/.test(q)) return 'standard';
  switch (intentId) {
    case 'STANDARD': return 'standard';
    case 'VVVF': return 'vvvf';
    case 'CALCULATION': return 'calc';
    case 'SAFETY': return 'safety';
    case 'TRAINING': return 'learn';
    case 'DIAGNOSTIC': return 'diagnose';
    case 'DOOR': case 'BRAKE': case 'TRACTION': case 'HYDRAULIC': case 'COMPONENT':
      return isProblem && !isQuestion ? 'diagnose' : 'learn';
    case 'MEASUREMENT': return isProblem ? 'diagnose' : 'learn';
    case 'KNOWLEDGE': case 'GENERAL_TECHNICAL': default:
      return isProblem && !isQuestion ? 'diagnose' : 'learn';
  }
}
function detectIntent(q) {
  const scores = {};
  for (const it of INTENTS) {
    scores[it.id] = 0;
    for (const k of it.keys) if (q.includes(normFa(k))) scores[it.id] += Math.max(2, k.length / 2);
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 2 ? best[0] : 'GENERAL_TECHNICAL';
}

/* ---------------- retrieval scoring ---------------- */
function scoreText(q, text) {
  const words = q.split(' ').filter(w => w.length >= 2);
  const t = normFa(text);
  let s = 0;
  for (const w of words) if (t.includes(w)) s += w.length;
  return s;
}
function kbSearchTextAI(k) {
  let s = k.title.fa + ' ' + (k.summary ? k.summary.fa : '') + ' ' + (k.tags || []).join(' ');
  ['what', 'where', 'safety', 'diag'].forEach(f => { if (k[f]) s += ' ' + k[f]; });
  ['symptoms', 'inspect', 'test', 'causes', 'related'].forEach(f => { if (k[f]) s += ' ' + k[f].join(' '); });
  if (k.body && k.body.fa) s += ' ' + k.body.fa.replace(/<[^>]+>/g, ' ');
  return s;
}
function retrieveKB(q, n) {
  return KNOWLEDGE.map(k => ({ k, s: scoreText(q, kbSearchTextAI(k)) }))
    .filter(x => x.s >= 4).sort((a, b) => b.s - a.s).slice(0, n || 2);
}
function retrieveFlows(q, n) {
  return DIAG_FLOWS.map(f => {
    /* symptom-title matches dominate; body matches only break ties */
    const titleScore = scoreText(q, f.symptom.fa + ' ' + (f.first ? f.first.fa : '')) * 4;
    let body = '';
    Object.values(f.nodes).forEach(nd => {
      if (nd.q) body += ' ' + nd.q.fa;
      if (nd.title) body += ' ' + nd.title.fa;
      (nd.causes || []).forEach(c => body += ' ' + c.fa);
    });
    const bodyScore = Math.min(10, scoreText(q, body)); /* cap body influence */
    return { f, s: titleScore + bodyScore };
  }).filter(x => x.s >= 6).sort((a, b) => b.s - a.s).slice(0, n || 3);
}
function retrieveCalcs(q, n) {
  return CALCULATORS.map(c => ({ c, s: scoreText(q, c.title.fa + ' ' + c.desc.fa + ' ' + c.formula) }))
    .filter(x => x.s >= 4).sort((a, b) => b.s - a.s).slice(0, n || 3);
}
function retrieveVVVF(q) {
  const hits = [];
  for (const d of VVVF_DB) {
    const brandHit = q.includes(normFa(d.brand)) || (d.model && q.includes(normFa(d.model.split(' ')[0])));
    for (const c of d.codes) {
      let s = 0;
      const codeTokens = c.code.toLowerCase().split(/[\s/]+/);
      for (const tk of codeTokens) if (tk.length >= 2 && q.includes(tk)) s += 6;
      s += scoreText(q, c.meaning + ' ' + c.causes.join(' '));
      if (brandHit) s += 4;
      if (s >= 6) hits.push({ d, c, s });
    }
  }
  return hits.sort((a, b) => b.s - a.s).slice(0, 3);
}

/* ---------------- session memory (spec §26-27) ---------------- */
const Memory = {
  ctx: {}, // elevator context: type, brand, model, roping...
  history: [],
  setCtx(patch) { Object.assign(this.ctx, patch); saveSession(); },
  describe() {
    const c = this.ctx;
    const parts = [];
    if (c.type) parts.push(c.type === 'hydraulic' ? 'هیدرولیک' : 'کششی');
    if (c.roping) parts.push('بکسل‌بندی ' + c.roping);
    if (c.driveBrand) parts.push('درایو ' + c.driveBrand + (c.driveModel ? ' ' + c.driveModel : ''));
    if (c.controller) parts.push('تابلو ' + c.controller);
    if (c.capacity) parts.push(c.capacity + 'kg');
    if (c.floors) parts.push(c.floors + ' طبقه');
    return parts.join('، ');
  }
};
/* auto-extract context from every user message */
function extractContext(q) {
  const found = {};
  if (/هیدرولیک|پاوریونیت|جک /.test(q)) found.type = 'hydraulic';
  else if (/کشش|گیرلس|گیربکس|وزنه تعادل/.test(q)) found.type = 'traction';
  if (q.includes('2:1') || q.includes('دو به یک')) found.roping = '2:1';
  else if (q.includes('1:1') || q.includes('یک به یک')) found.roping = '1:1';
  const brands = [['دلتا', 'Delta'], ['delta', 'Delta'], ['یاسکاوا', 'Yaskawa'], ['yaskawa', 'Yaskawa'], ['invt', 'INVT'], ['اشنایدر', 'Schneider'], ['altivar', 'Schneider'], ['آرکل', 'Arkel'], ['arkel', 'Arkel'], ['ال اس', 'LS'], [' ls ', 'LS']];
  for (const [k, v] of brands) if (q.includes(normFa(k))) { found.driveBrand = v; break; }
  const model = q.match(/vfd[- ]?(e[dl]|ed)|l1000|is7|atv\d*|adrive|gd\d+/i);
  if (model) found.driveModel = model[0].toUpperCase();
  if (Object.keys(found).length) Memory.setCtx(found);
  return found;
}

/* ---------------- confidence labels (spec §16, §43) ---------------- */
const CONF = {
  curated: '📎 منبع: دانش فنی گردآوری‌شده Z Lift (کیفیت: متوسط — خلاصه آموزشی، نه سند رسمی)',
  generic: '📎 منبع: دانش عمومی مهندسی (کیفیت: پایه) — با مدارک سازنده تطبیق دهید',
  none: 'ℹ️ برای این سؤال منبع تأییدشده‌ای در دسترس ندارم و حدس نمی‌زنم.'
};

/* ---------------- the local brain ---------------- */
const LocalBrain = {
  async answer(raw, mode) {
    /* ORCHESTRATOR pipeline (spec §5-6):
       normalize → slang → context-extract → intent(14) → route → handler →
       source metadata → confidence label */
    const q0 = normFa(raw);
    const q = expandSlang(q0);
    extractContext(q);
    /* pending in-chat calculation takes priority */
    const finished = this.tryFinishCalc(q, raw);
    if (finished) { finished.intent = 'calc'; finished.intent14 = 'CALCULATION'; finished.confBadge = '🟡 دانش گردآوری‌شده'; return finished; }

    let handler, intent14;
    if (mode && mode !== 'auto') { handler = mode; intent14 = mode.toUpperCase(); }
    else { intent14 = detectIntent(q); handler = routeIntent(intent14, q); }

    let res;
    if (handler === 'standard') res = this.standardAnswer(q, raw);
    else if (handler === 'vvvf') res = this.vvvfAnswer(q, raw);
    else if (handler === 'calc') res = this.calcAnswer(q, raw);
    else if (handler === 'diagnose') res = this.diagnoseAnswer(q, raw);
    else if (handler === 'safety') res = this.safetyAnswer(q);
    else res = this.learnAnswer(q, raw);

    res.intent = handler;
    res.intent14 = intent14;
    /* structured source card (spec §14, §30) */
    if (!res.sourceCard) {
      if (res.conf === 'curated') res.sourceCard = { title: KNOWLEDGE_META.publisher, status: KNOWLEDGE_META.status, version: KNOWLEDGE_META.version, quality: 'متوسط — خلاصه آموزشی، نه سند رسمی' };
      else if (res.conf === 'none') res.sourceCard = { title: 'بدون منبع تأییدشده', status: 'NONE', version: '—', quality: 'پاسخ صادقانه: اطلاعات کافی موجود نیست' };
    }
    /* confidence badge (spec §19) */
    res.confBadge = res.conf === 'none' ? '🔴 داده ناکافی' : (res.diagActive || handler === 'diagnose' ? '🟠 علت محتمل — تا اندازه‌گیری، قطعی نیست' : '🟡 دانش گردآوری‌شده');
    return res;
  },

  /* ---- STANDARD MODE (spec §35): strict ---- */
  standardAnswer(q) {
    const topic = stdFindTopic(q);
    if (topic) {
      return { text: stdAnswer(topic), actions: [], conf: 'curated' };
    }
    // list request?
    if (/چه استاندارد|کدوم استاندارد|لیست|بخش های|پارت های|قسمت های/.test(q)) {
      return { text: 'ساختار استانداردهای پشتیبانی‌شده در معماری این سامانه:\n\n' + stdListParts() + '\n\n' + STD_REGISTRY.editionNote, actions: [], conf: 'curated' };
    }
    return {
      text: '📚 حالت استاندارد — پاسخ سخت‌گیرانه:\n\nبرای این موضوع، بند تأییدشده‌ای در خلاصه‌های گردآوری‌شده‌ی من پیدا نشد.\n\n' +
        '⚠️ طبق قاعده «دقت مهم‌تر از اعتمادبه‌نفس»، شماره بند یا الزامی را حدس نمی‌زنم.\n\n' +
        'برای پاسخ دقیق:\n' +
        '۱. متن رسمی استاندارد (EN 81-20 یا ملی ۶۳۰۳-۲۰، ویرایش معتبر) را ملاک قرار دهید.\n' +
        '۲. موضوع را دقیق‌تر بگویید (مثلاً: «درگیری قفل درب»، «فضای جان‌پناه چاهک»، «نیروی بستن درب»، «تست ترمز»...) — برای ' + STD_TOPICS.length + ' موضوع پرکاربرد، خلاصه گردآوری‌شده دارم.\n\n' +
        'موضوعات موجود: ' + STD_TOPICS.map(t2 => t2.title).join('، '),
      actions: [], conf: 'none'
    };
  },

  /* ---- VVVF MODE (spec §14, §23): never invent codes ---- */
  vvvfAnswer(q, raw) {
    const hits = retrieveVVVF(q);
    const ctxLine = Memory.ctx.driveBrand ? 'ℹ️ زمینه گفتگو: درایو ' + Memory.ctx.driveBrand + (Memory.ctx.driveModel ? ' ' + Memory.ctx.driveModel : '') + '\n\n' : '';
    if (!hits.length) {
      const ask = [];
      if (!Memory.ctx.driveBrand) ask.push('برند درایو (دلتا، یاسکاوا، INVT، LS، اشنایدر، آرکل...)');
      ask.push('مدل دقیق');
      ask.push('کد خطای نمایش داده‌شده (عین همان چیزی که روی نمایشگر است)');
      return {
        text: ctxLine + '📟 برای تفسیر دقیق خطای درایو، این اطلاعات لازم است:\n' + ask.map((a, i) => (i + 1) + '. ' + a).join('\n') +
          '\n\n⚠️ معنی دقیق هر کد به مدل و نسخه فرمور بستگی دارد — کدی را از خودم نمی‌سازم. الگوهای عمومی (OC/OV/UV/OH/PG) را در پایگاه دارم؛ کد را بفرست تا الگوی مربوطه را با مراحل بررسی بدهم.',
        actions: [], conf: 'none'
      };
    }
    const L = [ctxLine + '📟 تفسیر خطای درایو (الگوی مستندشده در پایگاه Z Lift):\n'];
    for (const h of hits.slice(0, 2)) {
      L.push('▪️ ' + h.d.brand + ' ' + h.d.model + ' — کد «' + h.c.code + '»');
      L.push('   معنی: ' + h.c.meaning);
      L.push('   علل محتمل: ' + h.c.causes.join('؛ '));
      L.push('   بررسی‌ها به ترتیب: ' + h.c.checks.map((c, i) => (i + 1) + ') ' + c).join(' '));
      if (h.c.meas && h.c.meas.length) {
        const mm = h.c.meas.map(id => { const f = MEASURE_FIELDS.find(x => x.id === id); return f ? f.fa + ' (' + f.unit + ')' : id; });
        L.push('   📏 اندازه‌گیری لازم: ' + mm.join('، '));
      }
      L.push('');
    }
    L.push('⚠️ سطح اطمینان: «الگوی متداول خانواده درایو» — نه سند رسمی سازنده. معنی دقیق به مدل/فرمور بستگی دارد؛ با منوال همان مدل تطبیق دهید.');
    L.push(CONF.curated);
    return { text: L.join('\n'), actions: [], conf: 'curated' };
  },

  /* ---- in-chat calculator execution state ---- */
  pendingCalc: null,   /* { calId, inputs: {}, askedAt } */

  startCalc(calId) {
    const cal = CALCULATORS.find(c => c.id === calId);
    if (!cal) return { text: 'محاسبه‌گر پیدا نشد.', actions: [], conf: 'none' };
    this.pendingCalc = { calId, inputs: {} };
    const L = ['🧮 ' + cal.title.fa + '\n'];
    L.push('فرمول: ' + cal.formula);
    if (cal.assume) L.push('📌 فرضیات: ' + cal.assume.fa);
    L.push('\nورودی‌ها را به همین شکل بفرست (همه در یک پیام):');
    L.push(cal.inputs.map(i => '• ' + i.label.fa + (i.unit ? ' (' + i.unit + ')' : '') + ' — مثال: ' + i.value).join('\n'));
    L.push('\nمثلاً: «' + cal.inputs.map(i => i.value).join('، ') + '» یا با برچسب: «' + cal.inputs.slice(0, 2).map(i => i.label.fa.split(' ')[0] + '=' + i.value).join(' ') + ' ...»');
    return { text: L.join('\n'), actions: [], conf: 'curated', calcPending: calId };
  },

  tryFinishCalc(q, raw) {
    if (!this.pendingCalc) return null;
    const cal = CALCULATORS.find(c => c.id === this.pendingCalc.calId);
    if (!cal) { this.pendingCalc = null; return null; }
    /* extract numbers (persian digits already normalized) */
    const nums = (q.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (!nums.length) return null; /* not an answer to the pending calc */
    const vals = {};
    /* labeled inputs first: label=value */
    let labeled = 0;
    for (const inp of cal.inputs) {
      const lw = normFa(inp.label.fa.split(' ')[0]);
      const m = q.match(new RegExp(lw.replace(/[.*+?^${}()|[\]\\]/g, '') + '\\s*=?\\s*(-?\\d+(?:\\.\\d+)?)'));
      if (m) { vals[inp.id] = parseFloat(m[1]); labeled++; }
    }
    if (labeled < cal.inputs.length) {
      /* positional fallback */
      if (nums.length < cal.inputs.length) {
        return { text: '⚠️ این محاسبه ' + faNum(cal.inputs.length) + ' ورودی لازم دارد ولی ' + faNum(nums.length) + ' عدد فرستادی:\n' + cal.inputs.map(i => '• ' + i.label.fa + (i.unit ? ' (' + i.unit + ')' : '')).join('\n') + '\n\nهمه را در یک پیام بفرست.', actions: [], conf: 'curated' };
      }
      cal.inputs.forEach((inp, i) => { if (vals[inp.id] === undefined) vals[inp.id] = nums[i]; });
    }
    /* validation (spec §23) */
    for (const inp of cal.inputs) {
      const v = vals[inp.id];
      if (!isFinite(v)) return { text: '⚠️ مقدار «' + inp.label.fa + '» نامعتبر است.', actions: [], conf: 'curated' };
      if (v < 0 && !/تخفیف|اختلاف/.test(inp.label.fa)) return { text: '⚠️ مقدار «' + inp.label.fa + '» نمی‌تواند منفی باشد (' + v + ').', actions: [], conf: 'curated' };
    }
    let rows;
    try { rows = cal.compute(vals); } catch (e) { this.pendingCalc = null; return { text: '⚠️ خطا در محاسبه — ورودی‌ها را کنترل کن.', actions: [], conf: 'none' }; }
    if (!rows || rows.some(r => /NaN|Infinity/.test(String(r.val)))) {
      return { text: '⚠️ با این ورودی‌ها نتیجه معتبر نیست (تقسیم بر صفر یا مقدار غیرممکن). ورودی‌ها را اصلاح کن.', actions: [], conf: 'curated' };
    }
    this.pendingCalc = null;
    const L = ['🧮 نتیجه — ' + cal.title.fa + '\n'];
    L.push('ورودی‌ها: ' + cal.inputs.map(i => i.label.fa + '=' + vals[i.id] + (i.unit ? i.unit : '')).join('، '));
    L.push('فرمول: ' + cal.formula + '\n');
    rows.forEach(r => L.push('▪️ ' + (r.label.fa || '') + ': ' + r.val));
    if (cal.assume) L.push('\n📌 فرضیات: ' + cal.assume.fa);
    L.push('⚠️ ' + (cal.note ? cal.note.fa : 'راهنمای تکنسین — نه طراحی مهندسی نهایی.'));
    return { text: L.join('\n'), actions: [{ label: '🔄 محاسبه دوباره با اعداد دیگر', calcStart: cal.id }], conf: 'curated' };
  },

  /* ---- CALC MODE (spec §36) ---- */
  calcAnswer(q, raw) {
    // Alpha angle special handling (spec §11, §36)
    if (/آلفا|الفا|زاویه پیچش|alpha/.test(q)) {
      const is21 = Memory.ctx.roping === '2:1' || q.includes('2:1');
      const is11 = Memory.ctx.roping === '1:1' || q.includes('1:1');
      if (is21) {
        return {
          text: '📐 زاویه آلفا — هشدار مهم:\n\nمحاسبه‌گر آلفای موجود در این سامانه مخصوص سیستم «کششی 1:1» است.\n\nسیستم شما 2:1 اعلام شده — هندسه مسیر بکسل در 2:1 متفاوت است (فلکه‌های کابین و وزنه، مسیرهای اضافه) و فرمول 1:1 را نباید مستقیم به آن اعمال کرد.\n\nبرای 2:1 به نقشه هندسی پروژه و محاسبات کشش EN 81-50 (متن رسمی) مراجعه کنید.',
          actions: [], conf: 'curated'
        };
      }
      if (!is11) {
        return {
          text: '📐 زاویه آلفا (α):\n\nاول باید مطمئن شوم: سیستم شما «کششی 1:1» است؟\n\n(فرمول موجود فقط برای 1:1 معتبر است — در 2:1 هندسه فرق دارد.)\n\nاگر 1:1 است، بنویس «1:1» تا فرمول، ورودی‌ها و فرضیات را بدهم.',
          actions: [{ label: 'بله، سیستم 1:1 است', send: 'سیستم 1:1 است، زاویه آلفا را توضیح بده' }], conf: 'curated'
        };
      }
      const cal = CALCULATORS.find(c => c.id === 'r2');
      return {
        text: '📐 زاویه آلفا (α) — کششی 1:1\n\n' +
          'تعریف: زاویه پیچش سیم‌بکسل روی فلکه کشش وقتی فلکه هرزگرد (گردون) وجود دارد.\n\n' +
          '🔢 فرمول: β = arctan(X / Y) ، سپس α = 180° − β\n' +
          '• X = فاصله افقی مرکز فلکه کشش تا مرکز فلکه هرزگرد\n' +
          '• Y = فاصله عمودی همان دو مرکز\n\n' +
          'مثال عددی: X=60cm و Y=25cm ← β=67.4° ← α=112.6°\n\n' +
          '📌 فرضیات (مدل ساده‌شده): رشته سمت کابین قائم فرض شده و از قطر فلکه‌ها صرف‌نظر شده است.\n\n' +
          '⚠️ تمایز مهم: این یک «محاسبه هندسی» است، نه «تأیید مهندسی». کفایت α برای قابلیت کشش باید طبق محاسبات کشش EN 81-50 / مدارک سازنده تأیید شود — این عدد به‌تنهایی ایمنی کشش را اثبات نمی‌کند.\n\n' +
          '🧮 برای محاسبه با اعداد خودت، X و Y را همین‌جا بنویس (مثلاً: «آلفا با X=55 و Y=30»).\n' + CONF.curated,
        actions: [], conf: 'curated'
      };
    }
    // numeric alpha execution: "آلفا با X=55 و Y=30"
    const xy = q.match(/x\s*=?\s*([\d.]+).{0,25}?y\s*=?\s*([\d.]+)/);
    if (xy && /آلفا|الفا|alpha/.test(q)) {
      const x = parseFloat(xy[1]), y = parseFloat(xy[2]);
      if (!y || y <= 0) return { text: '⚠️ مقدار Y باید بزرگ‌تر از صفر باشد (فاصله عمودی دو مرکز).', actions: [], conf: 'curated' };
      const beta = Math.atan(x / y) * 180 / Math.PI;
      const alpha = 180 - beta;
      return {
        text: '📐 نتیجه (1:1):\n\nX=' + x + ' ، Y=' + y + '\nβ = arctan(' + x + '/' + y + ') = ' + beta.toFixed(1) + '°\nα = 180 − β = ' + alpha.toFixed(1) + '°\n\n⚠️ محاسبه هندسی است؛ کفایت کشش را جداگانه طبق EN 81-50/سازنده تأیید کنید.',
        actions: [], conf: 'curated'
      };
    }
    const hits = retrieveCalcs(q, 3);
    if (!hits.length) {
      return { text: '🧮 محاسبه موردنظر را دقیق‌تر بگو (مثلاً: توان موتور کششی، وزنه تعادل، ضریب اطمینان بکسل، فشار جک، دبی پمپ، افت ولتاژ، جریان موتور، زاویه آلفا...).\n\n' + faNum(CALCULATORS.length) + ' محاسبه‌گر معتبر در پایگاه موجود است.', actions: [], conf: 'none' };
    }
    if (hits.length === 1) return this.startCalc(hits[0].c.id);
    return {
      text: '🧮 کدام محاسبه؟ یکی را انتخاب کن تا ورودی‌هایش را بگیرم و همین‌جا حساب کنم:',
      actions: hits.map(h => ({ label: '🧮 ' + h.c.title.fa, calcStart: h.c.id })),
      conf: 'curated'
    };
  },

  /* ---- DIAGNOSTIC MODE (spec §15, §34): interactive, few questions ---- */
  diagnoseAnswer(q, raw) {
    const flows = retrieveFlows(q, 2);
    const ctxLine = Memory.describe();
    if (!flows.length) {
      return {
        text: '🔧 برای عیب‌یابی دقیق، علامت خرابی را کمی دقیق‌تر بگو.\n\nمثلاً: «حرکت نمی‌کند»، «فقط بالا نمی‌رود»، «بین طبقات می‌ایستد»، «درب باز نمی‌شود»، «ترمز آزاد نمی‌کند»، «هیدرولیک ریزش دارد»...\n\n' + faNum(DIAG_FLOWS.length) + ' مسیر عیب‌یابی قدم‌به‌قدم در پایگاه موجود است.',
        actions: [], conf: 'none'
      };
    }
    const f = flows[0].f;
    const start = f.nodes[f.start];
    const L = [];
    if (ctxLine) L.push('ℹ️ زمینه: ' + ctxLine + '\n');
    L.push('🔧 عیب‌یابی: «' + f.symptom.fa + '»\n');
    if (f.safety) L.push('⚠️ ایمنی اول: ' + f.safety.fa + '\n');
    if (f.tools) L.push('🧰 ابزار لازم: ' + f.tools.fa);
    if (f.first) L.push('🔍 نقطه شروع: ' + f.first.fa + '\n');
    L.push('❓ قدم اول: ' + start.q.fa);
    if (start.how) L.push('   روش: ' + start.how.fa);
    if (start.expect) L.push('   نتیجه سالم: ' + start.expect.fa);
    L.push('\n👇 نتیجه بررسی‌ات را انتخاب کن تا قدم بعدی را بگویم:');
    const actions = start.opts.map(o => ({
      label: o.l.fa,
      diagStep: { flowId: f.id, nodeId: o.n }
    }));
    if (flows[1]) actions.push({ label: '🔄 علامت من بیشتر شبیه «' + flows[1].f.symptom.fa + '» است', diagStep: { flowId: flows[1].f.id, nodeId: flows[1].f.start } });
    return { text: L.join('\n'), actions, conf: 'curated', diagActive: { flowId: f.id, nodeId: f.start } };
  },

  /* continue a diagnostic flow from a chosen node */
  diagStep(flowId, nodeId) {
    const f = DIAG_FLOWS.find(x => x.id === flowId);
    if (!f || !f.nodes[nodeId]) return { text: CONF.none, actions: [] };
    const node = f.nodes[nodeId];
    const L = [];
    if (node.q) {
      L.push('❓ قدم بعدی: ' + node.q.fa);
      if (node.how) L.push('   روش: ' + node.how.fa);
      if (node.expect) L.push('   نتیجه سالم: ' + node.expect.fa);
      L.push('\n👇 نتیجه:');
      return { text: L.join('\n'), actions: node.opts.map(o => ({ label: o.l.fa, diagStep: { flowId, nodeId: o.n } })), conf: 'curated' };
    }
    // result node
    L.push('🎯 جمع‌بندی: ' + node.title.fa + '\n');
    if (node.causes && node.causes.length) L.push('🔎 علل محتمل (سطح اطمینان: «احتمال» — تا اندازه‌گیری تأیید نشده، قطعی نیست):\n' + node.causes.map((c, i) => '  ' + (i + 1) + '. ' + c.fa).join('\n'));
    if (node.actions && node.actions.length) L.push('\n🛠 اقدامات به ترتیب:\n' + node.actions.map((a, i) => '  ' + (i + 1) + '. ' + a.fa).join('\n'));
    if (node.parts && node.parts.length) L.push('\n📦 قطعات محتمل: ' + node.parts.map(p => p.fa).join('، '));
    if (node.next) L.push('\n⏭ قدم بعد: ' + node.next.fa);
    L.push('\n' + CONF.curated);
    return { text: L.join('\n'), actions: [{ label: '🔄 شروع دوباره همین عیب', diagStep: { flowId, nodeId: f.start } }], conf: 'curated' };
  },

  /* ---- LEARN / TRAINING MODE (spec §33) ---- */
  learnAnswer(q, raw) {
    // special: 1:1 vs 2:1
    if (/فرق|تفاوت/.test(q) && (q.includes('1:1') || q.includes('2:1'))) {
      return {
        text: '📚 تفاوت بکسل‌بندی 1:1 و 2:1:\n\n' +
          '▪️ 1:1 (مستقیم): سر بکسل مستقیم به کابین و وزنه وصل است. سرعت کابین = سرعت خطی بکسل. نیروی وارده به موتور بیشتر، طول بکسل کمتر.\n\n' +
          '▪️ 2:1 (قرقره‌ای): بکسل از روی فلکه‌های کابین و وزنه عبور می‌کند و دو سر آن به نقاط ثابت مهار می‌شود. سرعت کابین = نصف سرعت بکسل، نیروی موتور ≈ نصف؛ در عوض طول بکسل و تعداد فلکه بیشتر.\n\n' +
          '🔧 نکته عملی: در 2:1 دور موتور/فلکه برای همان سرعت کابین دو برابر معادل 1:1 است؛ در محاسبات (توان، آلفا، سرعت) حتماً نوع بکسل‌بندی را لحاظ کن — فرمول 1:1 را مستقیم به 2:1 نزن.\n\n' + CONF.curated,
        actions: [], conf: 'curated'
      };
    }
    const hits = retrieveKB(q, 2);
    if (!hits.length) {
      const flows = retrieveFlows(q, 1);
      if (flows.length) return this.diagnoseAnswer(q, raw);
      return {
        text: 'ℹ️ ' + CONF.none + '\n\nمی‌توانی:\n• سؤال را دقیق‌تر یا با اصطلاح دیگری بپرسی\n• از موضوعات موجود بپرسی: ' +
          KNOWLEDGE.slice(0, 10).map(k => k.title.fa).join('، ') + ' و...\n\n' +
          '(پایگاه فعلی: ' + faNum(KNOWLEDGE.length) + ' مبحث فنی، ' + faNum(DIAG_FLOWS.length) + ' مسیر عیب‌یابی، ' + faNum(CALCULATORS.length) + ' محاسبه‌گر، ' + faNum(VVVF_DB.reduce((a, d) => a + d.codes.length, 0)) + ' الگوی خطای درایو)',
        actions: [], conf: 'none'
      };
    }
    const k = hits[0].k;
    const L = ['📚 ' + k.title.fa + '\n'];
    if (k.what) {
      L.push('⚙️ چیست و چه می‌کند: ' + k.what);
      if (k.where) L.push('\n📍 کجاست: ' + k.where);
      if (k.symptoms) L.push('\n🚨 علائم رایج خرابی:\n' + k.symptoms.map((s, i) => '  ' + (i + 1) + '. ' + s).join('\n'));
      if (k.test) L.push('\n🧪 روش تست:\n' + k.test.map((s, i) => '  ' + (i + 1) + '. ' + s).join('\n'));
      if (k.causes) L.push('\n💥 علل رایج خرابی: ' + k.causes.join('؛ '));
      if (k.safety) L.push('\n⚠️ ایمنی: ' + k.safety);
      if (k.related) L.push('\n🔗 مرتبط: ' + k.related.join('، '));
    } else if (k.body && k.body.fa) {
      L.push(k.body.fa.replace(/<h4>/g, '\n▪️ ').replace(/<\/h4>/g, ':').replace(/<li>/g, '\n  • ').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim());
    }
    if (hits[1]) L.push('\n📖 مبحث مرتبط دیگر: ' + hits[1].k.title.fa + ' (بپرس تا توضیح بدهم)');
    L.push('\n' + CONF.curated);
    return { text: L.join('\n'), actions: [], conf: 'curated' };
  },

  /* ---- SAFETY (spec §17) ---- */
  safetyAnswer(q) {
    const k = KNOWLEDGE.find(x => x.id === 'k7');
    let body = '';
    if (k && k.body) body = k.body.fa.replace(/<h4>/g, '\n▪️ ').replace(/<\/h4>/g, ':').replace(/<li>/g, '\n  • ').replace(/<[^>]+>/g, '').trim();
    return {
      text: '⚠️ ایمنی کار تکنسین آسانسور:\n\n' + body + '\n\n⛔ قاعده مطلق: مدار ایمنی، قفل درب، گاورنر، پاراشوت و لیمیت‌ها هرگز به‌عنوان روش تعمیر بای‌پس نمی‌شوند.\n' + CONF.curated,
      actions: [], conf: 'curated'
    };
  }
};

/* ---------------- session persistence (lightweight, localStorage OK per spec §3) ---------------- */
const STORE_VERSION = 2;
let _storeWarned = false;
function saveSession() {
  try {
    localStorage.setItem('zliftai_session', JSON.stringify({ v: STORE_VERSION, ctx: Memory.ctx, history: Memory.history.slice(-60) }));
    _storeWarned = false;
  } catch (e) {
    /* quota exceeded: shrink history progressively, warn once (spec §35) */
    try {
      Memory.history = Memory.history.slice(-15);
      localStorage.setItem('zliftai_session', JSON.stringify({ v: STORE_VERSION, ctx: Memory.ctx, history: Memory.history }));
    } catch (e2) {
      if (!_storeWarned) {
        _storeWarned = true;
        console.error('[ZLiftAI] storage full — session not persisted');
        try { if (typeof addMsg === 'function') addMsg('ai', '⚠️ حافظه دستگاه پر است — گفتگو ذخیره نمی‌شود. تاریخچه را پاک کنید.'); } catch (e3) {}
      }
    }
  }
}
function loadSession() {
  try {
    const raw = localStorage.getItem('zliftai_session');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') throw new Error('corrupt');
    /* v1 → v2 migration: identical shape, just stamp version */
    Memory.ctx = (s.ctx && typeof s.ctx === 'object') ? s.ctx : {};
    Memory.history = Array.isArray(s.history) ? s.history.filter(m => m && typeof m.text === 'string') : [];
  } catch (e) {
    /* corrupted session: preserve the bad blob for inspection, start clean */
    try { localStorage.setItem('zliftai_session_corrupt', localStorage.getItem('zliftai_session') || ''); } catch (e2) {}
    try { localStorage.removeItem('zliftai_session'); } catch (e2) {}
    Memory.ctx = {}; Memory.history = [];
    console.error('[ZLiftAI] corrupted session recovered (backup kept in zliftai_session_corrupt)');
  }
}
