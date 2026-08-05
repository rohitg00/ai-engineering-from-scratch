/* Landing-page localization. Keep locale data here; keep rendering generic. */
(function () {
  'use strict';

  var LOCALES = {
    fa: {
      'meta.title': 'AI Engineering from Scratch — فارسی',
      'meta.description': 'AI Engineering from Scratch یک دوره‌ی آموزشی رایگان و متن‌باز است که هر الگوریتم اصلی AI را از صفر می‌سازد — 503 درس، 20 مرحله و چهار زبان. ریاضیات، model، tokenizer و agent loop؛ یک‌بار، از پایه.',
      'meta.og_title': 'AI Engineering from Scratch — فارسی',
      'meta.og_description': '503 درس، 20 مرحله. backprop، tokenizer، attention mechanism و agent loop را پیش از وارد شدن هر چارچوب، از صفر بنویس.',
      'meta.twitter_title': 'AI Engineering from Scratch — فارسی',
      'meta.twitter_description': '503 درس، 20 مرحله. backprop، tokenizer، attention mechanism و agent loop را از صفر بنویس.',

      'nav.contents': 'محتوا',
      'nav.books': 'کتاب‌ها',
      'nav.catalog': 'فهرست',
      'nav.roadmap': 'نقشه‌راه',
      'nav.glossary': 'واژه‌نامه',
      'nav.about': 'درباره',
      'header.search': 'جست‌وجو (⌘K)',
      'header.theme': 'تغییر پوسته',
      'picker.label': 'زبان',
      'picker.filter_placeholder': 'فیلتر زبان‌ها…',
      'picker.filter_aria': 'فیلتر زبان‌ها',

      'meta.curriculum': 'دوره‌ی آموزشی',
      'meta.open_source': 'متن‌باز · MIT',
      'hero.tagline': '503 درس، 20 مرحله. هر الگوریتم پیش از آن‌که حتی یک چارچوب وارد شود، از دل ریاضیات خام ساخته می‌شود.',
      'hero.attribution': 'به‌کوشش Rohit Ghumare و مشارکت‌کنندگان. روی سیستم خودت اجراش کن.',
      'hero.star': 'Star در GitHub',
      'hero.follow': 'Follow @rohitg00',
      'hero.aria_star': 'ثبت Star برای ai-engineering-from-scratch در GitHub',
      'hero.aria_follow': 'Follow کردن Rohit Ghumare در GitHub',
      'hero.install': 'یادگیری با terminal',
      'hero.aria_copy': 'کپی‌کردن command نصب',
      'hero.aria_agents': 'با هر coding agent کار می‌کند',
      'hero.caption': 'agent شما نقش یک مدرس را دارد: آزمون تعیین سطح می‌گیرد، مسیر یادگیری شخصی‌سازی‌شده می‌سازد و درس‌ها را به‌صورت تعاملی در terminal آموزش می‌دهد.',
      'hero.fig1': 'در این نمودار، هر لایه درسی است که خودت از صفر پیاده‌سازی می‌کنی.',
      'hero.fig2': 'اولین دوره‌ی AI-native: agent به تو آموزش می‌دهد، از تو آزمون می‌گیرد و مسیر یادگیری‌ات را دنبال می‌کند.',
      'hero.fig3': 'به‌جای تکه‌های پراکنده، یک ستون فقرات منسجم؛ مهارتی که با هر مرحله عمیق‌تر می‌شود، نه این‌که متوقف شود.',
      'hero.figcaption': 'در این نمودار، هر لایه درسی است که خودت از صفر پیاده‌سازی می‌کنی.',

      'learners.aria': 'مکان‌هایی که خوانندگان دوره در آن یاد می‌گیرند و درباره‌اش گفتگو می‌کنند',
      'learners.eyebrow': 'این دوره را مهندسان و دانشجویانِ این مجموعه‌ها می‌خوانند',
      'learners.quote': '«شیفته‌ی مخزن (repo) AI Engineering from Scratch شده‌ام.»',
      'learners.quote_attr': '— مهندس AI در Google',

      'preface.eyebrow': 'این دوره چگونه کار می‌کند؟',
      'preface.p1': 'بیشتر مطالب AI، پراکنده و تکه‌تکه آموزش می‌دهند: یک مقاله این‌جا، یک پست درباره‌ی fine-tuning آن‌جا و یک demo پرزرق‌وبرق از agent جایی دیگر. این تکه‌ها به‌ندرت کنار هم می‌نشینند. chatbot می‌سازی، اما نمی‌توانی منحنی loss آن را توضیح بدهی. یک function به agent وصل می‌کنی، اما نمی‌توانی بگویی attention درون مدلی که آن function را فراخوانی می‌کند چه می‌کند.',
      'preface.p2': 'این دوره‌ی آموزشی ستون فقرات مسیر یادگیری است: 20 مرحله، 503 درس و چهار زبان Python، TypeScript، Rust و Julia. از جبر خطی تا گروه‌های خودگردان (swarmها). هر الگوریتم ابتدا از ریاضیات خام ساخته می‌شود: backprop، tokenizer، attention و agent loop. وقتی نوبت PyTorch برسد، از قبل می‌دانی در پشت صحنه چطور کار می‌کند.',
      'preface.p3': 'هر درس همین loop را طی می‌کند: مسئله را بخوان، ریاضیات را derive کن، code را بنویس، test را اجرا کن و artifact را نگه دار. خبری از ویدئوهای پنج‌دقیقه‌ای، deployهای copy-paste یا راه‌حل‌های لقمه‌جویده نیست. این دوره رایگان و متن‌باز است و روی لپ‌تاپ خودت اجرا می‌شود.',

      'stats.title': 'پیشرفت فعلی',
      'stats.finished': 'درس‌های تکمیل‌شده',
      'stats.phases': 'مراحل',
      'stats.languages': 'زبان‌های برنامه‌نویسی',
      'stats.glossary': 'مدخل‌های واژه‌نامه',
      'toc.title': 'برنامه‌ی آموزشی · 20 مرحله · 503 درس',
      'toc.subtitle': 'برای دیدن درس‌های هر مرحله روی آن کلیک کن. هر درس زمانی آماده‌ی انتشار است که ریاضیات، code و test آن نوشته شده باشند.',
      'legend.complete': 'کامل‌شده',
      'legend.in_progress': 'در حال انجام',
      'legend.planned': 'برنامه‌ریزی‌شده',

      'modal.progress_saved': 'پیشرفت فقط در مرورگر ذخیره می‌شود',
      'modal.reset': 'بازنشانی پیشرفت',
      'modal.completed': 'تکمیل‌شده',
      'modal.read': 'مطالعه',
      'modal.review': 'مرور',
      'modal.mark_complete': 'به‌عنوان تکمیل‌شده علامت بزن',
      'modal.mark_not_done': 'به‌عنوان ناتمام علامت بزن',
      'modal.completed_lesson': 'این درس را کامل کرده‌ای',
      'modal.confirm_reset': 'همه‌ی پیشرفت محلی‌ات (پاسخ‌های آزمون و درس‌های تکمیل‌شده) پاک شود؟ این کار برگشت‌پذیر نیست.',

      'books.title': 'نسخه‌ی کتاب · شش جلد',
      'books.subtitle': 'دوره در قالب کتاب، یک‌جا گردآوری شده است. فایل‌های EPUB و PDF از همین درس‌ها ساخته می‌شوند و در هر GitHub release قرار می‌گیرند. سایت نسخه‌ی زنده است؛ هر فصل برای شکل‌های متحرک، آزمون‌ها و code به این‌جا برمی‌گردد.',
      'books.note_prefix': 'لینک‌ها به جدیدترین نسخه‌ی',
      'books.note_middle': '· در هر release توسط CI از درس‌ها بازسازی می‌شوند ·',
      'books.how_made': 'چطور ساخته شده است',

      'colophon.eyebrow': 'درباره‌ی این نسخه',
      'colophon.text': 'کل دوره‌ی آموزشی روی GitHub قرار دارد. آن را clone یا fork کن و با سرعت خودت پیش برو. خبری از پرداخت یا ثبت‌نام نیست. هر درس، بسته به مفهوم، code قابل‌اجرا در Python، TypeScript، Rust یا Julia دارد.',
      'colophon.copy_command': 'کپی‌کردن command',
      'footer.note': '© 2026 · متن‌باز · رایگان برای همیشه',
      'footer.report': 'گزارش',
      'ui.copy': 'کپی',
      'ui.copied': 'کپی شد',
      'ui.phase_prefix': 'مرحله',

      'book.1.title': 'مبانی (Foundations)',
      'book.1.subtitle': 'ریاضیات، ابزارهای توسعه و ML کلاسیک · مراحل 00–02',
      'book.2.title': 'یادگیری عمیق (Deep Learning)',
      'book.2.subtitle': 'شبکه‌ها، بینایی (Vision) و گفتار (Speech) · مراحل 03، 04 و 06',
      'book.3.title': 'زبان (Language)',
      'book.3.subtitle': 'مبانی NLP و Transformer · مراحل 05 و 07',
      'book.4.title': 'مدل‌های زبانی بزرگ (Large Language Models)',
      'book.4.subtitle': 'Generation، Reinforcement، Pretraining و Engineering · مراحل 08–11',
      'book.5.title': 'agentها (Agents)',
      'book.5.subtitle': 'کار با ورودی‌های چندوجهی (Multimodality)، پروتکل‌ها (Protocol)، خودمختاری (Autonomy) و swarmها · مراحل 12–16',
      'book.6.title': 'محصول‌سازی (Production)',
      'book.6.subtitle': 'زیرساخت (Infrastructure)، ایمنی (Safety) و پروژه‌های نهایی (Capstone) · مراحل 17–19',

      'phase.0.name': 'راه‌اندازی و ابزارها',
      'phase.0.desc': 'محیطت را برای همه‌ی مراحل بعدی آماده کن.',
      'phase.1.name': 'مبانی ریاضیات',
      'phase.1.desc': 'شهود پشت هر الگوریتم AI را با نوشتن code بساز.',
      'phase.2.name': 'مبانی ML',
      'phase.2.desc': 'ML کلاسیک؛ هنوز ستون فقرات بخش بزرگی از AI در production است.',
      'phase.3.name': 'هسته‌ی یادگیری عمیق (Deep Learning)',
      'phase.3.desc': 'شبکه‌های عصبی را از اصول اولیه بساز. تا وقتی خودت یکی را نساخته‌ای، چارچوب وارد نمی‌شود.',
      'phase.4.name': 'بینایی ماشین (Computer Vision)',
      'phase.4.desc': 'از pixel تا درک معنا — image، video، 3D، VLM و مدل‌های جهان (world model).',
      'phase.5.name': 'NLP — از مبانی تا پیشرفته',
      'phase.5.desc': 'زبان رابط هوش است.',
      'phase.6.name': 'گفتار و صوت (Speech & Audio)',
      'phase.6.desc': 'بشنو، درک کن، صحبت کن.',
      'phase.7.name': 'بررسی عمیق Transformer',
      'phase.7.desc': 'معماری‌ای که همه‌چیز را تغییر داد.',
      'phase.8.name': 'هوش مصنوعی مولد (Generative AI)',
      'phase.8.desc': 'image، video، audio و 3D بساز و فراتر برو.',
      'phase.9.name': 'یادگیری تقویتی (Reinforcement Learning)',
      'phase.9.desc': 'پایه‌های RLHF و AI بازی‌کننده را بساز.',
      'phase.10.name': 'LLMها از صفر',
      'phase.10.desc': 'LLMهای بزرگ را از صفر بساز، train کن و بشناس.',
      'phase.11.name': 'مهندسی LLM (LLM Engineering)',
      'phase.11.desc': 'LLMها را در production به کار بگیر.',
      'phase.12.name': 'هوش مصنوعی چندوجهی (Multimodal AI)',
      'phase.12.desc': 'در modalityهای گوناگون ببین، بشنو، بخوان و استدلال کن؛ از patchهای ViT تا agentهای computer-use.',
      'phase.13.name': 'ابزارها و پروتکل‌ها (Tools & Protocols)',
      'phase.13.desc': 'رابط (interface) میان AI و دنیای واقعی را طراحی کن.',
      'phase.14.name': 'مهندسی agent (Agent Engineering)',
      'phase.14.desc': 'agentها را از پایه بساز: loop، memory، planning، چارچوب، benchmark، production و workbench.',
      'phase.15.name': 'سامانه‌های خودکار (Autonomous Systems)',
      'phase.15.desc': 'agentهای افق‌بلند بساز، self-improvement را بررسی کن و stack ایمنی 2026 را بشناس.',
      'phase.16.name': 'سیستم‌های چندعاملی و swarmها (Multi-Agent & Swarms)',
      'phase.16.desc': 'هماهنگی، emergence و هوش جمعی را بررسی کن.',
      'phase.17.name': 'زیرساخت و production (Infrastructure & Production)',
      'phase.17.desc': 'AI را به دنیای واقعی ship کن.',
      'phase.18.name': 'اخلاق، ایمنی و alignment (Ethics, Safety & Alignment)',
      'phase.18.desc': 'سیستم AI بساز که به بشریت کمک کند. این بخش اختیاری نیست.',
      'phase.19.name': 'پروژه‌های نهایی (Capstone Projects)',
      'phase.19.desc': '17 محصول end-to-end + 9 مسیر deep-build. برای هر پروژه 20–40 ساعت و برای هر مسیر 4–12 درس.'
    }
  };

  function base(code) {
    return String(code || 'en').toLowerCase().split('-')[0];
  }

  function locale() {
    return base(document.documentElement.getAttribute('lang') || document.documentElement.getAttribute('data-lang') || 'en');
  }

  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function text(key, fallback) {
    var strings = LOCALES[locale()] || {};
    return own(strings, key) ? strings[key] : fallback;
  }

  var HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return HTML_ESCAPES[char];
    });
  }

  /*
   * Keep mixed Persian/Latin copy in logical source order and isolate each
   * Latin run at the DOM boundary. Locale strings are plain text here; the
   * renderer escapes them before adding the semantic <bdi> wrappers.
   */
  function isolateLatinRuns(value) {
    var source = String(value == null ? '' : value);
    var token = /[A-Za-z0-9][A-Za-z0-9_+#./:@-]*(?:\s+[A-Za-z0-9][A-Za-z0-9_+#./:@-]*)*/g;
    var output = '';
    var cursor = 0;
    var match;

    while ((match = token.exec(source)) !== null) {
      output += escapeHTML(source.slice(cursor, match.index));
      output += '<bdi dir="ltr">' + escapeHTML(match[0]) + '</bdi>';
      cursor = match.index + match[0].length;
    }
    return output + escapeHTML(source.slice(cursor));
  }

  function bidi(key, fallback) {
    var value = text(key, fallback);
    return locale() === 'fa' ? isolateLatinRuns(value) : escapeHTML(value);
  }

  function rememberText(el) {
    if (!el.hasAttribute('data-i18n-default')) {
      el.setAttribute('data-i18n-default', el.textContent);
    }
    return el.getAttribute('data-i18n-default');
  }

  function rememberContent(el) {
    if (!el.hasAttribute('data-i18n-default-content')) {
      el.setAttribute('data-i18n-default-content', el.getAttribute('content') || '');
    }
    return el.getAttribute('data-i18n-default-content');
  }

  function apply() {
    document.querySelectorAll('[data-i18n-bidi]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-bidi');
      var value = text(key, rememberText(el));
      if (locale() === 'fa') {
        el.innerHTML = isolateLatinRuns(value);
      } else {
        el.textContent = value;
      }
    });
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      el.textContent = text(key, rememberText(el));
    });
    document.querySelectorAll('[data-i18n-content]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-content');
      el.setAttribute('content', text(key, rememberContent(el)));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      var fallback = el.getAttribute('aria-label') || '';
      if (!el.hasAttribute('data-i18n-default-aria')) el.setAttribute('data-i18n-default-aria', fallback);
      el.setAttribute('aria-label', text(key, el.getAttribute('data-i18n-default-aria')));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      var fallback = el.getAttribute('title') || '';
      if (!el.hasAttribute('data-i18n-default-title')) el.setAttribute('data-i18n-default-title', fallback);
      el.setAttribute('title', text(key, el.getAttribute('data-i18n-default-title')));
    });
    document.querySelectorAll('[data-caption-key]').forEach(function (el) {
      var key = el.getAttribute('data-caption-key');
      if (!el.hasAttribute('data-caption-default')) {
        el.setAttribute('data-caption-default', el.getAttribute('data-caption') || '');
      }
      el.setAttribute('data-caption', text(key, el.getAttribute('data-caption-default')));
    });
    if (typeof window.AIFS_refreshLanding === 'function') window.AIFS_refreshLanding();
  }

  window.AIFS_landingText = text;
  window.AIFS_landingBidi = bidi;
  window.AIFS_langPickerText = function (key, fallback) {
    return text('picker.' + key, fallback);
  };
  window.AIFS_applyLandingLang = apply;
  window.AIFS_onLangChange = apply;
  apply();
}());
