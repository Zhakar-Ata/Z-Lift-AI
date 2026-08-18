/* ============================================================
   Z LIFT AI — STANDARDS ENGINE
   Version-aware, source-honest registry.
   RULE (non-negotiable): clause numbers appear ONLY where the curated
   source provided them. Everything else → "requires official text".
   ============================================================ */

const STD_REGISTRY = {
  families: [
    {
      id: 'en81',
      name: 'EN 81 (اروپا)',
      parts: [
        { id: 'en81-20', title: 'EN 81-20', topic: 'الزامات ایمنی ساخت و نصب — آسانسورهای مسافربر و مسافربر-باربر', status: 'curated-summary' },
        { id: 'en81-50', title: 'EN 81-50', topic: 'قواعد طراحی، محاسبات و آزمون اجزای آسانسور', status: 'metadata-only' },
        { id: 'en81-21', title: 'EN 81-21', topic: 'آسانسورهای جدید در ساختمان‌های موجود', status: 'metadata-only' },
        { id: 'en81-28', title: 'EN 81-28', topic: 'سیستم زنگ اضطراری راه دور', status: 'metadata-only' },
        { id: 'en81-58', title: 'EN 81-58', topic: 'آزمون مقاومت درب‌های طبقه در برابر آتش', status: 'metadata-only' },
        { id: 'en81-70', title: 'EN 81-70', topic: 'دسترس‌پذیری برای افراد دارای معلولیت', status: 'metadata-only' },
        { id: 'en81-71', title: 'EN 81-71', topic: 'آسانسورهای مقاوم در برابر خرابکاری', status: 'metadata-only' },
        { id: 'en81-72', title: 'EN 81-72', topic: 'آسانسور آتش‌نشان', status: 'metadata-only' },
        { id: 'en81-73', title: 'EN 81-73', topic: 'رفتار آسانسور در حریق', status: 'metadata-only' },
        { id: 'en81-77', title: 'EN 81-77', topic: 'آسانسورها در شرایط زلزله', status: 'metadata-only' },
        { id: 'en81-22', title: 'EN 81-22', topic: 'آسانسورهای با مسیر حرکت شیب‌دار', status: 'metadata-only' }
      ]
    },
    {
      id: 'isiri',
      name: 'استاندارد ملی ایران (ISIRI)',
      parts: [
        { id: 'isiri-6303-20', title: 'استاندارد ملی ۶۳۰۳-۲۰', topic: 'الزامات ایمنی ساخت و نصب آسانسور (بر مبنای EN 81-20)', status: 'curated-summary' },
        { id: 'isiri-6303-50', title: 'استاندارد ملی ۶۳۰۳-۵۰', topic: 'قواعد طراحی و آزمون (بر مبنای EN 81-50)', status: 'metadata-only' },
        { id: 'isiri-6303-1', title: 'استاندارد ملی ۶۳۰۳-۱ (قدیمی)', topic: 'نسخه قدیمی مبتنی بر EN 81-1 — برای آسانسورهای نصب‌شده پیش از جایگزینی', status: 'metadata-only' }
      ]
    }
  ],
  editionNote: 'ویرایش دقیق (سال انتشار) سند در دسترس این سامانه تأیید نشده است؛ خلاصه‌های ارائه‌شده از محتوای فنی گردآوری‌شده Z Lift است، نه متن رسمی استاندارد. برای استناد قانونی همیشه متن رسمی ویرایش معتبر را ملاک قرار دهید.'
};

/* ---- curated requirement topics (each entry carries its own source honesty) ----
   sourceStatus: 'curated' = clause came with the curated summary
                 'unverified' = topic known, clause NOT verifiable here */
const STD_TOPICS = [
  {
    id: 'lock-engagement',
    keys: ['قفل', 'درگیری قفل', 'قفل درب', 'اینترلاک', 'lock', '7 میل', '۷ میل'],
    title: 'درگیری قفل درب طبقه',
    standard: 'en81-20', clause: '5.3.9.1', sourceStatus: 'curated',
    requirement: 'کنتاکت برقی قفل تنها زمانی مجاز است بسته شود که قفل مکانیکی حداقل ۷ میلی‌متر درگیر شده باشد.',
    applicability: 'همه درب‌های طبقات آسانسورهای مشمول EN 81-20 / معادل ملی ۶۳۰۳-۲۰',
    practicalCheck: 'با درب بسته، درگیری قلاب را با چشم اندازه بگیرید؛ کنتاکت نباید قبل از ۷ میلی‌متر بسته شود. با مولتی‌متر لحظه بسته شدن کنتاکت را نسبت به درگیری کنترل کنید.',
    exceptions: null
  },
  {
    id: 'refuge-pit',
    keys: ['جان پناه', 'جان‌پناه', 'چاهک', 'فضای ایمنی چاهک', 'refuge', 'pit'],
    title: 'فضای جان‌پناه چاهک',
    standard: 'en81-20', clause: '5.2.5', sourceStatus: 'curated',
    requirement: 'با کابین نشسته روی بافر کاملاً فشرده، باید حداقل یک فضای جان‌پناه (بلوک خوابیده 0.5×0.6×1.0 متر) در چاهک باقی بماند.',
    applicability: 'چاهک همه آسانسورهای مشمول',
    practicalCheck: 'عمق چاهک را اندازه بگیرید و ابعاد فضای آزاد زیر کابین در پایین‌ترین وضعیت را کنترل کنید.',
    exceptions: 'برای چاهک‌های کم‌عمق در ساختمان‌های موجود، EN 81-21 راهکارهای جبرانی دارد (متن رسمی لازم است).'
  },
  {
    id: 'door-force',
    keys: ['نیروی بستن', 'نیروی درب', 'فشار درب', '150 نیوتن', '۱۵۰ نیوتن', 'door force'],
    title: 'نیروی بستن درب',
    standard: 'en81-20', clause: '5.3.6.2', sourceStatus: 'curated',
    requirement: 'نیروی لازم برای جلوگیری از بسته شدن درب نباید از ۱۵۰ نیوتن بیشتر باشد؛ انرژی جنبشی درب نیز محدود است.',
    applicability: 'درب‌های اتوماتیک افقی',
    practicalCheck: 'با نیروسنج فنری در میانه مسیر بسته شدن اندازه بگیرید. پس از هر تنظیم برد سردرب، دوباره کنترل کنید.',
    exceptions: null
  },
  {
    id: 'panel-gaps',
    keys: ['فاصله لته', 'گپ درب', 'درز درب', '6 میل', '۶ میل'],
    title: 'فاصله مجاز لته‌های درب',
    standard: 'en81-20', clause: null, sourceStatus: 'curated',
    requirement: 'فاصله بین لته‌ها و بین لته و چارچوب حداکثر ۶ میلی‌متر (با احتساب سایش تا ۱۰ میلی‌متر).',
    applicability: 'درب‌های طبقه و کابین',
    practicalCheck: 'با فیلر یا کولیس در چند نقطه اندازه بگیرید.',
    exceptions: null
  },
  {
    id: 'brake-125',
    keys: ['تست ترمز', 'ترمز 125', '۱۲۵', 'brake test', 'تست بار'],
    title: 'آزمون ترمز ماشین',
    standard: 'en81-20', clause: '5.9.2.2', sourceStatus: 'curated',
    requirement: 'ترمز باید بتواند کابین را با ۱۲۵٪ بار نامی متوقف کرده و نگه دارد.',
    applicability: 'آسانسورهای کششی',
    practicalCheck: 'تست با بار ۱۲۵٪ در راه‌اندازی و پس از هر کار اساسی روی ترمز؛ خلاصی لنت‌ها طبق سازنده تنظیم شود.',
    exceptions: null
  },
  {
    id: 'rope-sf',
    keys: ['ضریب اطمینان', 'ضریب اطمینان بکسل', 'سیم بکسل ضریب', 'safety factor'],
    title: 'ضریب اطمینان سیم‌بکسل',
    standard: 'en81-20', clause: null, sourceStatus: 'curated',
    requirement: 'ضریب اطمینان سیم‌بکسل‌های تعلیق حداقل ۱۲ (برای آرایش‌های معمول). نسبت قطر فلکه به قطر بکسل حداقل ۴۰.',
    applicability: 'تعلیق سیم‌بکسلی',
    practicalCheck: 'نیروی گسیختگی را از گواهی بکسل بخوانید و با بار استاتیک مقایسه کنید (محاسبه‌گر Z Lift موجود است).',
    exceptions: 'مقادیر دقیق برای آرایش‌های خاص در EN 81-50 محاسبه می‌شود (متن رسمی لازم است).'
  },
  {
    id: 'overspeed',
    keys: ['گاورنر', 'اضافه سرعت', 'پاراشوت', 'governor', 'سرعت تریپ'],
    title: 'حفاظت اضافه‌سرعت (گاورنر و پاراشوت)',
    standard: 'en81-20', clause: '5.6.2', sourceStatus: 'curated',
    requirement: 'گاورنر باید حداکثر در ۱۱۵٪ سرعت نامی به بالا عمل کند؛ پاراشوت لحظه‌ای تا سرعت نامی 0.63 m/s و بالاتر از آن پاراشوت تدریجی لازم است.',
    applicability: 'آسانسورهای کششی؛ هیدرولیک غیرمستقیم نیز پاراشوت/کنتاکت شلی بکسل دارد',
    practicalCheck: 'تست دستی کنتاکت گاورنر + تست درگیری با سرعت بازرسی طبق دستور سازنده؛ علائم درگیری روی ریل باید قرینه باشد.',
    exceptions: null
  },
  {
    id: 'shaft-light',
    keys: ['روشنایی چاه', 'نور چاه', '50 لوکس', '۵۰ لوکس'],
    title: 'روشنایی چاه',
    standard: 'en81-20', clause: null, sourceStatus: 'curated',
    requirement: 'حداقل ۵۰ لوکس در ۱ متری سقف کابین و در کف چاهک.',
    applicability: 'چاه همه آسانسورهای مشمول',
    practicalCheck: 'با لوکس‌متر در نقاط تعیین‌شده اندازه بگیرید.',
    exceptions: null
  },
  {
    id: 'capacity-area',
    keys: ['مساحت کابین', 'ظرفیت کابین', 'جدول ظرفیت', 'اضافه بار مساحت'],
    title: 'رابطه ظرفیت و مساحت کابین',
    standard: 'en81-20', clause: null, sourceStatus: 'curated',
    requirement: 'مساحت مفید کابین برای جلوگیری از اضافه‌بار فیزیکی محدود است (مثلاً 630kg→1.66m²، 1000kg→2.40m²؛ هر نفر ۷۵ کیلوگرم).',
    applicability: 'آسانسورهای مسافربر',
    practicalCheck: 'مساحت واقعی کف کابین را متر کنید و با جدول (محاسبه‌گر Z Lift) مقایسه کنید.',
    exceptions: null
  },
  {
    id: 'overload-device',
    keys: ['اضافه بار', 'سنسور وزن', 'اورلود', 'overload'],
    title: 'وسیله تشخیص اضافه‌بار',
    standard: 'en81-20', clause: '5.12.1.2', sourceStatus: 'curated',
    requirement: 'در اضافه‌بار (معمولاً از ۱۰٪ بیش از بار نامی، حداقل ۷۵kg) آسانسور نباید حرکت کند؛ علامت دیداری/شنیداری داخل کابین و درب‌ها باز بمانند.',
    applicability: 'آسانسورهای مشمول EN 81-20',
    practicalCheck: 'با وزنه تست کنید: آلارم، عدم استارت و باز ماندن درب.',
    exceptions: null
  },
  {
    id: 'hyd-relief',
    keys: ['شیر اطمینان', 'رلیف', 'فشار رلیف', '140'],
    title: 'تنظیم شیر اطمینان هیدرولیک',
    standard: 'en81-20', clause: '5.9.3.5.3', sourceStatus: 'curated',
    requirement: 'شیر اطمینان (رلیف) حداکثر روی ۱۴۰٪ فشار بار کامل تنظیم می‌شود.',
    applicability: 'آسانسورهای هیدرولیک',
    practicalCheck: 'فقط با مانومتر و طبق دستور سازنده بلوک شیر تنظیم کنید.',
    exceptions: 'در صورت افت فشار داخلی بالا، تا ۱۷۰٪ با شرایط خاص — نیازمند متن رسمی.'
  },
  {
    id: 'hyd-static-test',
    keys: ['تست فشار', 'تست استاتیک', '200 درصد', '۲۰۰'],
    title: 'آزمون فشار استاتیک هیدرولیک',
    standard: 'en81-20', clause: '6.3.11', sourceStatus: 'curated',
    requirement: 'آزمون فشار استاتیک با ۲۰۰٪ فشار بار کامل به مدت ۵ دقیقه، بدون افت غیرمجاز.',
    applicability: 'راه‌اندازی آسانسور هیدرولیک',
    practicalCheck: 'در تحویل اولیه انجام و ثبت کنید؛ افت فشار و نشتی را کنترل کنید.',
    exceptions: null
  },
  {
    id: 'rupture-valve',
    keys: ['شیر پاراشوت', 'rupture', 'پارگی لوله'],
    title: 'شیر پاراشوت (Rupture Valve)',
    standard: 'en81-20', clause: '5.6.3', sourceStatus: 'curated',
    requirement: 'در صورت پارگی لوله و افزایش ناگهانی دبی، شیر پاراشوت روی سیلندر باید مسیر را ببندد و از سقوط کابین جلوگیری کند.',
    applicability: 'آسانسورهای هیدرولیک',
    practicalCheck: 'تست دوره‌ای تریپ طبق دستور سازنده؛ پس از تست ریست صحیح.',
    exceptions: null
  },
  {
    id: 'safety-contacts',
    keys: ['کنتاکت ایمنی', 'اجباری گسست', 'positive opening', 'مدار ایمنی الزام'],
    title: 'نوع کنتاکت‌های ایمنی',
    standard: 'en81-20', clause: null, sourceStatus: 'curated',
    requirement: 'کنتاکت‌های مدار ایمنی باید از نوع اجباری-گسست (positive opening) باشند.',
    applicability: 'کل زنجیره ایمنی',
    practicalCheck: 'هنگام تعویض، فقط قطعه با علامت ⊖ (positive opening) استفاده کنید؛ رله معمولی مجاز نیست.',
    exceptions: null
  },
  {
    id: 'final-limit',
    keys: ['لیمیت نهایی', 'حد نهایی', 'final limit'],
    title: 'لیمیت سوییچ نهایی',
    standard: 'en81-20', clause: '5.12.2', sourceStatus: 'curated',
    requirement: 'لیمیت نهایی باید پس از لیمیت‌های عملیاتی و قبل از برخورد به بافر عمل کند و مدار را به‌صورت اجباری قطع کند.',
    applicability: 'انتهای بالا و پایین مسیر',
    practicalCheck: 'ترتیب عملکرد (کندکننده → حد → نهایی) را با حرکت بازرسی کنترل کنید.',
    exceptions: null
  },
  {
    id: 'emergency-alarm',
    keys: ['زنگ اضطراری', 'اینترکام', 'آیفون کابین', 'alarm'],
    title: 'سیستم احضار کمک',
    standard: 'en81-20', clause: '5.4.10', sourceStatus: 'curated',
    requirement: 'وسیله احضار کمک دوطرفه (زنگ/اینترکام) با تغذیه اضطراری الزامی است. (الزامات کامل سیستم راه دور در EN 81-28.)',
    applicability: 'کابین همه آسانسورهای مسافربر',
    practicalCheck: 'با برق قطع تست کنید؛ باطری پشتیبان را دوره‌ای کنترل کنید.',
    exceptions: null
  }
];

/* ---- Standards Engine API ---- */
function stdFindTopic(query) {
  const q = query.replace(/\u200c/g, ' ').toLowerCase();
  let best = null, bestScore = 0;
  for (const tp of STD_TOPICS) {
    let score = 0;
    for (const k of tp.keys) if (q.includes(k.toLowerCase())) score += k.length;
    if (q.includes(tp.title)) score += 20;
    if (score > bestScore) { bestScore = score; best = tp; }
  }
  return bestScore >= 3 ? best : null;
}
function stdPartInfo(partId) {
  for (const fam of STD_REGISTRY.families)
    for (const p of fam.parts)
      if (p.id === partId) return { family: fam, part: p };
  return null;
}
function stdListParts() {
  return STD_REGISTRY.families.map(f =>
    '📚 ' + f.name + ':\n' + f.parts.map(p =>
      '  • ' + p.title + ' — ' + p.topic + (p.status === 'curated-summary' ? ' ✅(خلاصه گردآوری‌شده)' : ' 📋(فقط شناسنامه)')
    ).join('\n')
  ).join('\n\n');
}
/* format a standards answer per spec §5 */
function stdAnswer(topic) {
  const info = stdPartInfo(topic.standard);
  const iri = topic.standard === 'en81-20' ? 'استاندارد ملی ایران ۶۳۰۳-۲۰ (بر مبنای همین سند تدوین شده)' : null;
  const L = [];
  L.push('📚 استاندارد: ' + (info ? info.part.title : topic.standard));
  L.push('🗓 ویرایش: تأییدنشده در این سامانه — ' + STD_REGISTRY.editionNote.split('؛')[0]);
  L.push('📌 موضوع: ' + topic.title);
  if (topic.clause && topic.sourceStatus === 'curated') {
    L.push('🔖 مرجع: بند ' + topic.clause + ' (طبق خلاصه گردآوری‌شده — با متن رسمی تطبیق دهید)');
  } else {
    L.push('🔖 مرجع: شماره بند دقیق از منبع در دسترس قابل تأیید نیست — برای استناد، متن رسمی استاندارد لازم است.');
  }
  L.push('');
  L.push('⚙️ الزام: ' + topic.requirement);
  L.push('');
  L.push('✅ کاربرد: ' + topic.applicability);
  if (topic.exceptions) L.push('⚠️ استثنا: ' + topic.exceptions);
  L.push('🔧 کنترل عملی: ' + topic.practicalCheck);
  if (iri) L.push('🇮🇷 ' + iri + ' — الزام معادل دارد؛ شماره‌گذاری بندها ممکن است متفاوت باشد و از متن ملی تأیید نشده است.');
  L.push('');
  L.push('📎 منبع: محتوای فنی گردآوری‌شده Z Lift (خلاصه آموزشی) — جایگزین متن رسمی استاندارد نیست.');
  return L.join('\n');
}
