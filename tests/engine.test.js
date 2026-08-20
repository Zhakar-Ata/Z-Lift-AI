/* ============================================================
   Z LIFT AI — engine regression tests
   Zero dependencies. Run:  node tests/engine.test.js
   Loads the browser scripts into a VM sandbox with a minimal
   DOM/localStorage shim, then asserts routing + retrieval.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['brain.js', 'standards.js', 'knowledge.js', 'engine.js', 'arena.js'];
const SOURCE = FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');

/* Each test gets a clean sandbox so session Memory never leaks between cases. */
function loadEngine() {
  const store = {};
  const ctx = {
    console,
    setTimeout, clearTimeout, Date, Math, JSON,
    navigator: { onLine: true },
    location: { origin: 'http://localhost', href: 'http://localhost/' },
    fetch: () => Promise.reject(new Error('network disabled in tests')),
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    SOURCE + '\n;window.__api = { LocalBrain, Memory, normFa, expandSlang, scoreText, ' +
    'detectIntent, routeIntent, retrieveFlows, retrieveKB, retrieveCalcs, retrieveVVVF, ' +
    'DIAG_FLOWS, KNOWLEDGE, CALCULATORS, VVVF_DB, ZLiftKnowledgeEngine, AIProviders };',
    ctx, { filename: 'zliftai-bundle.js' }
  );
  return ctx.__api;
}

/* ---------------- tiny test harness ---------------- */
let passed = 0, failed = 0;
const failures = [];

function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') throw new Error('use checkAsync for async tests');
    passed++; process.stdout.write('  \x1b[32m✓\x1b[0m ' + name + '\n');
  } catch (e) {
    failed++; failures.push(name + ' — ' + e.message);
    process.stdout.write('  \x1b[31m✗\x1b[0m ' + name + '\n      ' + e.message + '\n');
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed++; process.stdout.write('  \x1b[32m✓\x1b[0m ' + name + '\n');
  } catch (e) {
    failed++; failures.push(name + ' — ' + e.message);
    process.stdout.write('  \x1b[31m✗\x1b[0m ' + name + '\n      ' + e.message + '\n');
  }
}
function eq(actual, expected, what) {
  if (actual !== expected) throw new Error((what || 'value') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }
function group(title) { process.stdout.write('\n\x1b[1m' + title + '\x1b[0m\n'); }

/* first line of an answer, used to identify which flow/article was chosen */
const head = res => String(res.text || '').split('\n')[0].trim();

(async function run() {
  process.stdout.write('\n\x1b[1mZ Lift AI — engine regression suite\x1b[0m\n');

  /* ========== knowledge base integrity ========== */
  group('پایگاه دانش (knowledge base integrity)');
  const api = loadEngine();

  check('all five scripts evaluate without error', () => ok(api.LocalBrain, 'LocalBrain missing'));
  check('diagnostic flows are loaded', () => ok(api.DIAG_FLOWS.length >= 22, 'got ' + api.DIAG_FLOWS.length));
  check('knowledge articles are loaded', () => ok(api.KNOWLEDGE.length >= 22, 'got ' + api.KNOWLEDGE.length));
  check('calculators are loaded', () => ok(api.CALCULATORS.length >= 23, 'got ' + api.CALCULATORS.length));
  check('VVVF brand database is loaded', () => ok(api.VVVF_DB.length >= 7, 'got ' + api.VVVF_DB.length));
  check('ZLiftKnowledgeEngine normalizes every source', () => {
    api.ZLiftKnowledgeEngine.build();
    ok(api.ZLiftKnowledgeEngine.records.length >= 100, 'got ' + api.ZLiftKnowledgeEngine.records.length);
  });
  check('every flow has a reachable start node', () => {
    for (const f of api.DIAG_FLOWS) {
      ok(f.nodes[f.start], 'flow ' + f.id + ' start node "' + f.start + '" missing');
      ok(f.nodes[f.start].opts && f.nodes[f.start].opts.length, 'flow ' + f.id + ' start has no options');
    }
  });
  check('every flow option points at an existing node', () => {
    for (const f of api.DIAG_FLOWS) {
      for (const [id, node] of Object.entries(f.nodes)) {
        for (const o of (node.opts || [])) {
          ok(f.nodes[o.n], 'flow ' + f.id + ' node ' + id + ' → unknown node "' + o.n + '"');
        }
      }
    }
  });
  check('flow ids are unique', () => {
    const ids = api.DIAG_FLOWS.map(f => f.id);
    eq(new Set(ids).size, ids.length, 'unique flow ids');
  });

  /* ========== normalization (regression: punctuation bug) ========== */
  group('نرمال‌سازی فارسی (normFa)');
  check('strips the Persian comma that broke shortcut routing', () => {
    eq(api.normFa('آسانسور حرکت نمی‌کند، از کجا؟'), 'آسانسور حرکت نمیکند از کجا');
  });
  check('normalizes Arabic yeh/kaf to Persian', () => {
    eq(api.normFa('ي ك'), 'ی ک');
  });
  check('removes ZWNJ', () => eq(api.normFa('نمی‌کند'), 'نمیکند'));
  check('converts Persian digits to ASCII', () => eq(api.normFa('۳۸۰ ولت'), '380 ولت'));
  check('preserves the colon in roping notation', () => {
    ok(api.normFa('سیستم 2:1 است').includes('2:1'), 'roping 2:1 lost');
  });
  check('collapses repeated whitespace', () => eq(api.normFa('  درب    طبقه  '), 'درب طبقه'));

  /* ========== scoring (regression: substring bug) ========== */
  group('امتیازدهی بازیابی (scoreText)');
  check('«کند» must NOT match inside «نمیکند»', () => {
    eq(api.scoreText('کند', 'آسانسور حرکت نمیکند'), 0, 'substring false positive');
  });
  check('exact token still scores', () => {
    ok(api.scoreText('ترمز', 'ترمز باز نمیشود') > 0, 'exact token lost');
  });
  check('stopwords contribute nothing', () => {
    eq(api.scoreText('از به با در', 'از این به آن با هم در جا'), 0, 'stopwords scored');
  });
  check('a repeated query word is not counted twice', () => {
    eq(api.scoreText('ترمز ترمز', 'ترمز'), api.scoreText('ترمز', 'ترمز'), 'duplicate inflation');
  });

  /* ========== intent routing ========== */
  group('تشخیص و مسیریابی نیت');
  await checkAsync('shortcut «حرکت نمی‌کند، از کجا شروع کنم؟» → correct flow', async () => {
    const r = await loadEngine().LocalBrain.answer('آسانسور حرکت نمی‌کند، از کجا شروع کنم؟', 'auto');
    eq(r.intent, 'diagnose', 'intent');
    ok(head(r).includes('اصلاً حرکت نمی‌کند'), 'chose wrong flow: ' + head(r));
  });
  await checkAsync('same question without punctuation resolves identically', async () => {
    const r = await loadEngine().LocalBrain.answer('آسانسور حرکت نمیکند از کجا شروع کنم', 'auto');
    ok(head(r).includes('اصلاً حرکت نمی‌کند'), 'got: ' + head(r));
  });
  await checkAsync('«آسانسور کند حرکت می‌کند» routes to diagnosis, not learn', async () => {
    const r = await loadEngine().LocalBrain.answer('آسانسور کند حرکت می‌کند', 'auto');
    eq(r.intent, 'diagnose', 'intent');
    ok(head(r).includes('کند حرکت'), 'got: ' + head(r));
  });
  await checkAsync('«بریک آزاد نمی‌کند» → brake flow (formal slang form)', async () => {
    const r = await loadEngine().LocalBrain.answer('بریک آزاد نمی‌کند از کجا شروع کنم؟', 'auto');
    eq(r.intent, 'diagnose', 'intent');
    ok(head(r).includes('ترمز'), 'got: ' + head(r));
  });
  await checkAsync('«درب طبقه قفل نمی‌کند» → a door flow', async () => {
    const r = await loadEngine().LocalBrain.answer('درب طبقه قفل نمی‌کند', 'auto');
    eq(r.intent, 'diagnose', 'intent');
    ok(head(r).includes('درب'), 'got: ' + head(r));
  });
  await checkAsync('drive fault question → vvvf', async () => {
    const r = await loadEngine().LocalBrain.answer('درایو خطای OC می‌دهد', 'auto');
    eq(r.intent, 'vvvf', 'intent');
  });
  await checkAsync('alpha angle question → calc', async () => {
    const r = await loadEngine().LocalBrain.answer('زاویه آلفا برای سیستم 1:1 چطوری حساب میشه؟', 'auto');
    eq(r.intent, 'calc', 'intent');
  });
  await checkAsync('«طبق استاندارد» → standard', async () => {
    const r = await loadEngine().LocalBrain.answer('درگیری قفل درب طبقه طبق استاندارد چقدر باید باشد؟', 'auto');
    eq(r.intent, 'standard', 'intent');
  });
  await checkAsync('conceptual «فرق 1:1 و 2:1» stays in learn', async () => {
    const r = await loadEngine().LocalBrain.answer('فرق 1:1 و 2:1 چیه؟', 'auto');
    eq(r.intent, 'learn', 'intent');
  });
  await checkAsync('explicit mode always overrides auto-detection', async () => {
    const r = await loadEngine().LocalBrain.answer('درب طبقه قفل نمی‌کند', 'standard');
    eq(r.intent, 'standard', 'explicit mode ignored');
  });

  /* ========== installation-type steering ========== */
  group('هدایت بر اساس نوع آسانسور');
  await checkAsync('hydraulic wording selects a hydraulic flow', async () => {
    const r = await loadEngine().LocalBrain.answer('آسانسور هیدرولیک ریزش دارد', 'auto');
    ok(head(r).includes('هیدرولیک'), 'got: ' + head(r));
  });
  await checkAsync('traction context suppresses hydraulic flows for a shared symptom', async () => {
    const a = loadEngine();
    await a.LocalBrain.answer('آسانسور کششی گیرلس با بکسل‌بندی 2:1 دارم', 'auto');
    eq(a.Memory.ctx.type, 'traction', 'context not captured');
    const flows = a.retrieveFlows(a.expandSlang(a.normFa('آسانسور لولینگ دقیق ندارد')), 3);
    ok(flows.length, 'no flows retrieved');
    eq(flows[0].f.type === 'hydraulic', false, 'hydraulic flow won despite traction context');
  });
  await checkAsync('hydraulic context is remembered across turns', async () => {
    const a = loadEngine();
    await a.LocalBrain.answer('آسانسور هیدرولیک دارم', 'auto');
    eq(a.Memory.ctx.type, 'hydraulic', 'context not remembered');
  });
  await checkAsync('roping and drive brand are extracted into memory', async () => {
    const a = loadEngine();
    await a.LocalBrain.answer('درایو دلتا با بکسل‌بندی 2:1', 'auto');
    eq(a.Memory.ctx.roping, '2:1', 'roping');
    eq(a.Memory.ctx.driveBrand, 'Delta', 'drive brand');
  });

  /* ========== honesty guarantees ========== */
  group('صداقت پاسخ (no hallucination)');
  await checkAsync('off-domain question refuses instead of inventing', async () => {
    const r = await loadEngine().LocalBrain.answer('دستور پخت قرمه سبزی چیه؟', 'auto');
    eq(r.conf, 'none', 'confidence');
    ok(r.confBadge.includes('🔴'), 'expected low-confidence badge, got ' + r.confBadge);
  });
  await checkAsync('unknown standard topic does not fabricate a clause number', async () => {
    const r = await loadEngine().LocalBrain.answer('بند استاندارد برای رنگ کابین چیست؟', 'standard');
    eq(r.conf, 'none', 'confidence');
    ok(!/بند\s*\d+\.\d/.test(r.text), 'a clause number was invented');
  });
  await checkAsync('unknown drive code asks for details rather than guessing', async () => {
    const r = await loadEngine().LocalBrain.answer('درایو خطای ZZ99 می‌دهد', 'vvvf');
    eq(r.conf, 'none', 'confidence');
  });
  await checkAsync('every answer carries a confidence badge', async () => {
    const a = loadEngine();
    for (const q of ['آسانسور حرکت نمی‌کند', 'درایو خطای OC می‌دهد', 'فرق 1:1 و 2:1 چیه؟', 'اصلا نامربوط']) {
      const r = await a.LocalBrain.answer(q, 'auto');
      ok(r.confBadge, 'missing badge for: ' + q);
      ok(r.intent, 'missing intent for: ' + q);
    }
  });
  check('no API key is hardcoded in any shipped script', () => {
    for (const f of FILES.concat(['app.js', 'sw.js'])) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      ok(!/sk-[A-Za-z0-9]{16,}/.test(src), 'possible API key committed in ' + f);
    }
  });

  /* ========== diagnostic flow walking ========== */
  group('پیمایش مسیر عیب‌یابی');
  await checkAsync('answering the first question advances the flow', async () => {
    const a = loadEngine();
    const r = await a.LocalBrain.answer('آسانسور حرکت نمی‌کند، از کجا شروع کنم؟', 'auto');
    ok(r.actions && r.actions.length >= 2, 'start node offered no choices');
    const step = r.actions[0].diagStep;
    ok(step && step.flowId && step.nodeId, 'malformed diagStep payload');
    const next = a.LocalBrain.diagStep(step.flowId, step.nodeId);
    ok(next.text && next.text.length > 20, 'next step returned nothing');
  });
  await checkAsync('every flow reaches a result node with causes and actions', async () => {
    const a = loadEngine();
    for (const f of a.DIAG_FLOWS) {
      let node = f.start, guard = 0, reachedResult = false;
      while (guard++ < 40) {
        const n = f.nodes[node];
        if (!n.opts) { reachedResult = true; break; }
        node = n.opts[0].n;
      }
      ok(reachedResult, 'flow ' + f.id + ' never reaches a result following first options');
      const res = a.LocalBrain.diagStep(f.id, node);
      ok(res.text && res.text.includes('جمع‌بندی'), 'flow ' + f.id + ' result node renders no summary');
    }
  });

  /* ========== provider layer ========== */
  group('لایه Provider');
  await checkAsync('local provider is available and healthy offline', async () => {
    const a = loadEngine();
    eq(a.AIProviders.local.available(), true, 'availability');
    const h = await a.AIProviders.local.healthCheck();
    eq(h.ok, true, 'healthCheck.ok');
  });
  await checkAsync('provider.answer matches LocalBrain.answer (UI compat alias)', async () => {
    const a = loadEngine();
    const viaProvider = await a.AIProviders.local.answer('آسانسور حرکت نمی‌کند', 'auto');
    ok(viaProvider.text, 'provider alias returned nothing');
    eq(viaProvider.intent, 'diagnose', 'intent through provider');
  });

  /* ========== curated HTML → chat text ========== */
  group('تبدیل HTML به متن چت');

  check('table rows are separated, not glued together', () => {
    const a = loadEngine();
    const k = a.KNOWLEDGE.find(x => x.id === 'k8');
    ok(k, 'article k8 (traction vs hydraulic) missing');
    const out = a.LocalBrain.learnAnswer(a.normFa('انتخاب کششی یا هیدرولیک'), 'انتخاب کششی یا هیدرولیک').text;
    ok(!out.includes('معیارکششیهیدرولیک'), 'table header cells are glued: found «معیارکششیهیدرولیک»');
    ok(!out.includes('طبقات مناسببدون'), 'table body cells are glued');
    ok(out.includes('معیار — کششی — هیدرولیک'), 'header row not rendered with separators');
  });
  check('no curated article leaks raw HTML tags into chat text', () => {
    const a = loadEngine();
    for (const k of a.KNOWLEDGE) {
      if (!k.body || !k.body.fa) continue;
      const out = a.LocalBrain.learnAnswer(a.normFa(k.title.fa), k.title.fa).text;
      ok(!/<(table|tr|td|th|ul|li|h[1-6]|p|br)[\s/>]/i.test(out), 'raw HTML tag survived in ' + k.id);
      ok(!/&(nbsp|amp|lt|gt|quot);/.test(out), 'undecoded HTML entity in ' + k.id);
    }
  });
  check('safety answer renders its lists as bullets', () => {
    const a = loadEngine();
    const out = a.LocalBrain.safetyAnswer(a.normFa('نکات ایمنی')).text;
    ok(out.includes('•'), 'no bullets rendered');
    ok(!/<li>|<h4>/i.test(out), 'raw list markup survived');
    ok(!/\n{3,}/.test(out), 'excessive blank lines in safety answer');
  });
  check('headings stay attached to the list they introduce', () => {
    const a = loadEngine();
    const out = a.LocalBrain.safetyAnswer(a.normFa('نکات ایمنی')).text;
    ok(!/:\n\n[ \t]*•/.test(out), 'blank line between a heading and its first bullet');
  });

  /* ========== cloud (Arena) provider path ========== */
  group('مسیر ابری Arena');

  /* Sandbox with a configured endpoint and a stubbed successful cloud reply. */
  function loadCloud(reply, opts) {
    opts = opts || {};
    const store = { zliftai_provider_cfg: JSON.stringify({ endpoint: 'https://example.test/v1/chat/completions', model: 'test' }) };
    const calls = [];
    const ctx = {
      console, setTimeout, clearTimeout, Date, Math, JSON, AbortController,
      navigator: { onLine: true },
      location: { origin: 'http://localhost' },
      localStorage: {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }
      },
      fetch: async (url, init) => {
        calls.push(JSON.parse(init.body));
        if (opts.fail) throw new Error('network down');
        return { ok: true, json: async () => ({ choices: [{ message: { content: reply } }] }) };
      }
    };
    ctx.window = ctx; ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(SOURCE + '\n;window.__api={ArenaProvider,AIProviders,pickProvider,LocalBrain,ResponseValidator,ZLiftKnowledgeEngine};', ctx, { filename: 'cloud.js' });
    return { api: ctx.__api, calls };
  }

  await checkAsync('a configured endpoint selects the Arena provider', async () => {
    const { api } = loadCloud('پاسخ.');
    eq(api.pickProvider().id, 'arena', 'provider');
  });
  await checkAsync('cloud diagnosis keeps the interactive step buttons', async () => {
    const { api } = loadCloud('توضیح مدل ابری درباره عدم حرکت.');
    const r = await api.ArenaProvider.answer('آسانسور حرکت نمی‌کند، از کجا شروع کنم؟', 'auto');
    eq(r.intent, 'diagnose', 'intent');
    ok(r.actions.length >= 2, 'cloud path lost the diagnostic buttons (got ' + r.actions.length + ')');
    ok(r.diagActive && r.diagActive.flowId, 'cloud path lost diagActive state');
    ok(r.actions.every(a => a.diagStep && a.diagStep.flowId && a.diagStep.nodeId), 'malformed diagStep in cloud actions');
  });
  await checkAsync('cloud buttons drive the same local deterministic flow', async () => {
    const { api } = loadCloud('توضیح مدل ابری.');
    const r = await api.ArenaProvider.answer('آسانسور حرکت نمی‌کند، از کجا شروع کنم؟', 'auto');
    const step = r.actions[0].diagStep;
    const next = api.LocalBrain.diagStep(step.flowId, step.nodeId);
    ok(next.text && next.text.length > 20, 'stepping a cloud-provided button returned nothing');
  });
  await checkAsync('calculations never leave the device', async () => {
    const { api, calls } = loadCloud('نباید استفاده شود.');
    const r = await api.ArenaProvider.answer('زاویه آلفا برای سیستم 1:1 چطوری حساب میشه؟', 'auto');
    eq(calls.length, 0, 'a calculation was sent to the cloud');
    eq(r.providerUsed, 'local-deterministic', 'providerUsed');
  });
  await checkAsync('cloud failure falls back to the local brain', async () => {
    const { api } = loadCloud('unused', { fail: true });
    const r = await api.ArenaProvider.answer('آسانسور حرکت نمی‌کند', 'auto');
    eq(r.providerUsed, 'local', 'should fall back locally');
    ok(r.text && r.text.length > 20, 'fallback produced no answer');
  });
  await checkAsync('retrieved knowledge is sent as data, not instructions', async () => {
    const { api, calls } = loadCloud('پاسخ.');
    await api.ArenaProvider.answer('مدار ایمنی چیست؟', 'auto');
    ok(calls.length === 1, 'expected exactly one cloud call');
    const userMsg = calls[0].messages.find(m => m.role === 'user').content;
    ok(userMsg.includes('KNOWLEDGE>>>'), 'knowledge not delimited as data');
    ok(calls[0].messages[0].role === 'system', 'missing system prompt');
  });
  await checkAsync('validator flags an invented clause number', async () => {
    const { api } = loadCloud('طبق بند 9.9.9 این کار مجاز است.');
    const pkg = api.ZLiftKnowledgeEngine.buildContextPackage('مدار ایمنی');
    const v = api.ResponseValidator.validate('طبق بند 9.9.9 مجاز است.', pkg);
    eq(v.ok, false, 'fabricated clause passed validation');
  });
  await checkAsync('validator blocks safety-circuit bypass advice', async () => {
    const { api } = loadCloud('x');
    const pkg = api.ZLiftKnowledgeEngine.buildContextPackage('مدار ایمنی');
    const v = api.ResponseValidator.validate('مدار ایمنی را پل کن تا حرکت کند.', pkg);
    eq(v.ok, false, 'unsafe bypass advice passed validation');
  });

  /* ---------------- summary ---------------- */
  const total = passed + failed;
  process.stdout.write('\n' + '─'.repeat(52) + '\n');
  if (failed === 0) {
    process.stdout.write('\x1b[32m\x1b[1m  ✓ همه ' + total + ' تست موفق بود\x1b[0m\n\n');
  } else {
    process.stdout.write('\x1b[31m\x1b[1m  ✗ ' + failed + ' از ' + total + ' تست شکست خورد\x1b[0m\n');
    failures.forEach(f => process.stdout.write('    • ' + f + '\n'));
    process.stdout.write('\n');
  }
  process.exit(failed === 0 ? 0 : 1);
})();
