/**
 * Shared i18n layer for all pages.
 * - language state (aiefs:lang) + getLang/setLang
 * - L(obj, field): per-field fallback for data.js _zh fields
 * - I18N dictionary + t(key) for static UI strings
 * - applyI18n(): replace [data-i18n] / [data-i18n-attr] in the DOM
 * - initLangToggle(): wire up the header 中/EN button on every page
 */
(function (global) {
  var LANG_KEY = 'aiefs:lang';

  function getLang() {
    try { return localStorage.getItem(LANG_KEY) === 'zh' ? 'zh' : 'en'; }
    catch (e) { return 'en'; }
  }
  function setLang(l) {
    try { localStorage.setItem(LANG_KEY, l === 'zh' ? 'zh' : 'en'); } catch (e) {}
  }

  // Per-field localized read: zh + has _zh → zh, else English.
  function L(obj, field) {
    if (!obj) return '';
    return (getLang() === 'zh' && obj[field + '_zh']) ? obj[field + '_zh'] : obj[field];
  }

  var I18N = {
    en: {
      'nav.contents': 'Contents',
      'nav.catalog': 'Catalog',
      'nav.roadmap': 'Roadmap',
      'nav.glossary': 'Glossary',
      'footer.tagline': '2026 · open source · free forever',

      // shared header / a11y
      'a11y.skipToContent': 'Skip to content',
      'a11y.githubStars': 'GitHub stars',
      'a11y.search': 'Search (⌘K)',
      'a11y.toggleTheme': 'Toggle theme',

      // footer
      'footer.taglineFull': 'AI Engineering from Scratch · open source · free forever.',
      'footer.home': 'Home',
      'footer.github': 'GitHub',
      'footer.catalog': 'Catalog',
      'footer.glossary': 'Glossary',
      'footer.report': 'Report',
      'footer.reportSuggest': 'Report / Suggest',

      // index — masthead / preface
      'home.metaCurriculum': 'curriculum v1.0 · 2026',
      'home.metaOpenSource': 'open source · MIT',
      'home.tagline': '473 lessons. 20 phases. Every algorithm built from raw math before a single framework gets imported.',
      'home.attribution': 'Maintained by Rohit Ghumare and contributors. Run on your own machine.',
      'home.starOnGithub': 'Star on GitHub',
      'home.starAria': 'Star ai-engineering-from-scratch on GitHub',
      'home.followAuthor': 'Follow @rohitg00',
      'home.followAria': 'Follow Rohit Ghumare on GitHub',
      'home.howEyebrow': 'How this works',
      'home.prefaceP1': "Most AI material teaches in scattered pieces. A paper here, a fine-tuning post there, a flashy agent demo somewhere else. The pieces rarely line up. You ship a chatbot but can't explain its loss curve. You hook a function to an agent but can't say what attention does inside the model that's calling it.",
      'home.prefaceP2': 'This curriculum is the spine. 20 phases, 473 lessons, four languages: Python, TypeScript, Rust, Julia. Linear algebra at one end, autonomous swarms at the other. Every algorithm gets built from raw math first. Backprop. Tokenizer. Attention. Agent loop. By the time PyTorch shows up, you already know what it\'s doing under the hood.',
      'home.prefaceP3': 'Each lesson runs the same loop: read the problem, derive the math, write the code, run the test, keep the artifact. No five-minute videos, no copy-paste deploys, no hand-holding. Free, open source, and built to run on your own laptop.',

      // index — stats / toc / legend / modal / colophon
      'stats.title': 'Current Progress',
      'stats.finishedLessons': 'Finished Lessons',
      'stats.phases': 'Phases',
      'stats.languages': 'Languages',
      'stats.glossaryTerms': 'Glossary Terms',
      'toc.title': 'Curriculum · 20 phases · 473 lessons',
      'toc.subtitle': 'Tap a phase to expand its lessons. Each one ships when its math, code, and test are all written.',
      'legend.complete': 'Complete',
      'legend.inProgress': 'In progress',
      'legend.planned': 'Planned',
      'modal.footerNote': 'Progress saved in browser only',
      'modal.reset': 'Reset progress',
      'colophon.title': 'Colophon',
      'colophon.body': 'The entire curriculum is on GitHub. Clone it, fork it, learn at your own pace. No paywall, no signup. Every lesson has runnable code in Python, TypeScript, Rust, or Julia, depending on what fits the concept best.',
      'colophon.copyAria': 'Copy command',

      // index — app.js
      'modal.phasePrefix': 'PHASE',
      'modal.confirmReset': 'Clear all your local progress (quiz answers and completed lessons)? This cannot be undone.',
      'modal.combinesPrefix': 'Combines:',
      'modal.completed': 'completed',
      'lesson.review': 'Review',
      'lesson.read': 'Read',
      'lesson.markNotDone': 'Mark as not done',
      'lesson.markComplete': 'Mark complete',
      'lesson.youCompleted': 'You completed this lesson',

      // catalog
      'catalog.title': 'Lesson Catalog',
      'catalog.subtitle': 'Every lesson across all 20 phases. Search, filter, sort.',
      'catalog.searchPlaceholder': 'Search lessons...',
      'catalog.allPhases': 'All Phases',
      'catalog.allStatus': 'All Status',
      'catalog.statusComplete': 'Complete',
      'catalog.statusPlanned': 'Planned',
      'catalog.colPhase': 'Phase',
      'catalog.colLesson': 'Lesson',
      'catalog.colType': 'Type',
      'catalog.colLanguage': 'Language',
      'catalog.colStatus': 'Status',
      'catalog.countFmt': '{n} of {total} lessons',
      'catalog.empty': 'No lessons match your filters.',

      // glossary
      'glossary.title': 'AI Glossary',
      'glossary.subtitle': 'What people say vs what things actually mean',
      'glossary.searchPlaceholder': 'Search terms...',
      'glossary.colSays': 'What people say',
      'glossary.colMeans': 'What it actually means',
      'glossary.countFmt': '{n} of {total} terms',
      'glossary.empty': 'No terms match your search.',

      // roadmap (prereqs)
      'roadmap.title': 'Roadmap',
      'roadmap.subtitle': 'Click any phase to see its prerequisites and what it unlocks downstream.',
      'roadmap.legendComplete': 'Complete',
      'roadmap.legendInProgress': 'In Progress',
      'roadmap.legendPlanned': 'Planned',
      'roadmap.clearSelection': 'Clear selection',
      'roadmap.scrollHint': 'Scroll to explore the full graph',
      'roadmap.selectPhaseAria': 'Select Phase {id}: {name}',
      'roadmap.gotoAria': 'Go to Phase {id}: {name}',
      'roadmap.phaseFallback': 'Phase {id}',
      'roadmap.prereqEmpty': 'None. This is a starting point.',
      'roadmap.unlockEmpty': 'Final destination. End of the curriculum.',
      'roadmap.phaseNumPrefix': 'Phase',
      'roadmap.statsComplete': '{done} of {total} lessons complete',
      'roadmap.statsPrereqPhases': 'prerequisite phases',
      'roadmap.statsPhasesUnlocked': 'phases unlocked',
      'roadmap.sectionPrereqs': 'Prerequisites',
      'roadmap.sectionUnlocks': 'Unlocks',
      'roadmap.read': 'Read',
      'roadmap.viewOnGithub': 'View on GitHub',

      // lesson — static
      'lesson.toggleSidebar': 'Toggle sidebar',
      'lesson.diagramModalLabel': 'Expanded diagram',
      'lesson.diagram': 'Diagram',
      'lesson.close': 'Close',
      'state.loading': 'Loading lesson...',

      // lesson — error / state
      'state.errNoPath': 'No lesson path specified',
      'state.errNoPathMsg': 'Add ?path=phases/01-math-foundations/01-linear-algebra-intuition to the URL.',
      'state.errNotFound': 'Lesson not found',
      'state.errNotFoundMsg': 'Could not fetch the lesson at {path}. It may not have been written yet.',
      'state.backToHome': 'Back to Home',

      // lesson — sidebar / toc / diagram
      'lesson.onThisPage': 'On this page',
      'lesson.diagramRendering': 'Rendering diagram...',
      'lesson.diagramFailed': 'Diagram could not be rendered.',
      'lesson.learningObjectives': 'Learning Objectives',
      'lesson.labChallenge': 'Lab Challenge',

      // lesson — code blocks
      'code.copy': 'Copy',
      'code.copied': 'Copied!',
      'code.copyCommand': 'Copy command',

      // lesson — AI panels
      'panel.outputsTitle': 'What This Lesson Ships',
      'panel.outputsSubtitle': 'Prompts, skills, and artifacts you can use right now',
      'panel.outputsLoading': 'Loading outputs...',
      'panel.badgePrompt': 'Prompt',
      'panel.badgeSkill': 'Skill',
      'panel.badgeOutput': 'Output',
      'panel.installHintPrompt': 'Paste into Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads prompts',
      'panel.descLoading': 'Loading description...',
      'panel.viewOnGithub': 'View on GitHub',
      'panel.install': 'Install',
      'panel.viewLessonOnGithub': 'View lesson on GitHub',
      'panel.codeTitle': 'Run the Code',
      'panel.codeSubtitle': 'Executable files from this lesson',
      'panel.codeLoading': 'Loading code files...',

      // lesson — quiz chrome
      'quiz.title': 'Test Your Understanding',
      'quiz.subtitle': 'Did you get it?',
      'quiz.questionFmt': 'Question {n} of {total}',
      'quiz.sectionPre': 'Pre-Lesson Check',
      'quiz.sectionCheck': 'Mid-Lesson Check',
      'quiz.sectionPost': 'Post-Lesson Quiz',
      'quiz.sectionAll': 'Quiz',
      'quiz.scoreLabelIncomplete': 'Complete all questions to see your score',
      'quiz.scorePerfect': 'Perfect score!',
      'quiz.scoreGreat': 'Great work!',
      'quiz.scoreKeep': 'Keep studying!',
      'quiz.deeperPrefix': 'Want a deeper quiz? Run',
      'quiz.deeperSuffix': 'in Claude, Cursor, Codex, OpenClaw, Hermes, or any agent with the curriculum skills installed',
      'quiz.sectionScoreFmt': '{correct}/{total} correct',

      // lesson — learning-path / continue panels
      'panel.pathTitle': 'Learning Path',
      'path.earlierLessonsFmt': '{n} earlier lessons',
      'path.laterLessonsFmt': '{n} later lessons',
      'path.progressFmt': "You've completed {done} of {total} lessons in this phase",
      'path.readyForPhaseFmt': 'Ready for Phase {id}: {name}',
      'nav.prevLesson': 'Previous',
      'nav.nextLesson': 'Next',
      'panel.continueTitle': 'Continue Learning',
      'panel.phaseFinished': 'You finished this phase!',
      'panel.browseAllPhaseFmt': 'Browse all Phase {id} lessons',
      'panel.fullCatalog': 'Full course catalog',
      'panel.continueCalloutPrefix': 'Run',
      'panel.continueCalloutSuffix': 'in Claude, Cursor, Codex, OpenClaw, Hermes, or any agent with the curriculum skills installed for a personalized learning path'
    },
    zh: {
      'nav.contents': '目录',
      'nav.catalog': '课程表',
      'nav.roadmap': '路线图',
      'nav.glossary': '术语表',
      'footer.tagline': '2026 · 开源 · 永久免费',

      // shared header / a11y
      'a11y.skipToContent': '跳到主要内容',
      'a11y.githubStars': 'GitHub star 数',
      'a11y.search': '搜索（⌘K）',
      'a11y.toggleTheme': '切换主题',

      // footer
      'footer.taglineFull': 'AI Engineering from Scratch · 开源 · 永久免费。',
      'footer.home': '首页',
      'footer.github': 'GitHub',
      'footer.catalog': '课程表',
      'footer.glossary': '术语表',
      'footer.report': '反馈',
      'footer.reportSuggest': '反馈 / 建议',

      // index — masthead / preface
      'home.metaCurriculum': '课程体系 v1.0 · 2026',
      'home.metaOpenSource': '开源 · MIT',
      'home.tagline': '473 节课，20 个阶段。每个算法都先用最原始的数学从零搭建，然后才引入任何框架。',
      'home.attribution': '由 Rohit Ghumare 及贡献者维护。在你自己的机器上运行。',
      'home.starOnGithub': '在 GitHub 上 Star',
      'home.starAria': '在 GitHub 上为 ai-engineering-from-scratch 点 Star',
      'home.followAuthor': '关注 @rohitg00',
      'home.followAria': '在 GitHub 上关注 Rohit Ghumare',
      'home.howEyebrow': '它是怎么运作的',
      'home.prefaceP1': '大多数 AI 资料都是零碎地教：这里一篇论文，那里一篇 fine-tune 的帖子，别处又一个炫酷的 agent demo。这些碎片很少能拼到一起。你做出了一个聊天机器人，却讲不清它的 loss 曲线；你给 agent 挂上了一个 function，却说不出调用它的模型内部 attention 在做什么。',
      'home.prefaceP2': '这套课程就是那根主干。20 个阶段、473 节课、四种语言：Python、TypeScript、Rust、Julia。一端是线性代数，另一端是自治集群。每个算法都先从最原始的数学搭起：backprop、tokenizer、attention、agent loop。等到 PyTorch 登场时，你早已明白它底层在做什么。',
      'home.prefaceP3': '每节课都跑同一个循环：读懂问题、推导数学、写出代码、跑通测试、留下产物。没有五分钟速成视频，没有复制粘贴式部署，没有手把手喂饭。免费、开源，专为在你自己的笔记本上运行而打造。',

      // index — stats / toc / legend / modal / colophon
      'stats.title': '当前进度',
      'stats.finishedLessons': '已完成课程',
      'stats.phases': '阶段',
      'stats.languages': '语言',
      'stats.glossaryTerms': '术语数',
      'toc.title': '课程体系 · 20 个阶段 · 473 节课',
      'toc.subtitle': '点击任一阶段展开它的课程。每节课在数学、代码、测试都写完后才会上线。',
      'legend.complete': '已完成',
      'legend.inProgress': '进行中',
      'legend.planned': '计划中',
      'modal.footerNote': '进度仅保存在浏览器本地',
      'modal.reset': '重置进度',
      'colophon.title': '版本说明',
      'colophon.body': '整套课程都在 GitHub 上。clone 它、fork 它，按自己的节奏学习。没有付费墙，无需注册。每节课都有可运行的代码——Python、TypeScript、Rust 或 Julia，取决于哪种语言最契合该概念。',
      'colophon.copyAria': '复制命令',

      // index — app.js
      'modal.phasePrefix': '阶段',
      'modal.confirmReset': '清除你在本地的全部进度（测验答案和已完成课程）？此操作不可撤销。',
      'modal.combinesPrefix': '合并自：',
      'modal.completed': '已完成',
      'lesson.review': '复习',
      'lesson.read': '阅读',
      'lesson.markNotDone': '标记为未完成',
      'lesson.markComplete': '标记为已完成',
      'lesson.youCompleted': '你已完成这节课',

      // catalog
      'catalog.title': '课程目录',
      'catalog.subtitle': '全部 20 个阶段的每一节课。搜索、筛选、排序。',
      'catalog.searchPlaceholder': '搜索课程……',
      'catalog.allPhases': '全部阶段',
      'catalog.allStatus': '全部状态',
      'catalog.statusComplete': '已完成',
      'catalog.statusPlanned': '计划中',
      'catalog.colPhase': '阶段',
      'catalog.colLesson': '课程',
      'catalog.colType': '类型',
      'catalog.colLanguage': '语言',
      'catalog.colStatus': '状态',
      'catalog.countFmt': '共 {total} 节课，显示 {n} 节',
      'catalog.empty': '没有符合筛选条件的课程。',

      // glossary
      'glossary.title': 'AI 术语表',
      'glossary.subtitle': '大家嘴上说的 vs 实际真正的含义',
      'glossary.searchPlaceholder': '搜索术语……',
      'glossary.colSays': '大家嘴上说的',
      'glossary.colMeans': '它实际的含义',
      'glossary.countFmt': '共 {total} 个术语，显示 {n} 个',
      'glossary.empty': '没有符合搜索的术语。',

      // roadmap (prereqs)
      'roadmap.title': '路线图',
      'roadmap.subtitle': '点击任一阶段，查看它的前置要求以及它在下游解锁了什么。',
      'roadmap.legendComplete': '已完成',
      'roadmap.legendInProgress': '进行中',
      'roadmap.legendPlanned': '计划中',
      'roadmap.clearSelection': '清除选择',
      'roadmap.scrollHint': '滑动以浏览完整图谱',
      'roadmap.selectPhaseAria': '选择阶段 {id}：{name}',
      'roadmap.gotoAria': '前往阶段 {id}：{name}',
      'roadmap.phaseFallback': '阶段 {id}',
      'roadmap.prereqEmpty': '无。这是一个起点。',
      'roadmap.unlockEmpty': '终点。整套课程的尽头。',
      'roadmap.phaseNumPrefix': '阶段',
      'roadmap.statsComplete': '{total} 节课中已完成 {done} 节',
      'roadmap.statsPrereqPhases': '个前置阶段',
      'roadmap.statsPhasesUnlocked': '个已解锁阶段',
      'roadmap.sectionPrereqs': '前置要求',
      'roadmap.sectionUnlocks': '解锁',
      'roadmap.read': '阅读',
      'roadmap.viewOnGithub': '在 GitHub 上查看',

      // lesson — static
      'lesson.toggleSidebar': '切换侧边栏',
      'lesson.diagramModalLabel': '放大的图示',
      'lesson.diagram': '图示',
      'lesson.close': '关闭',
      'state.loading': '正在加载课程……',

      // lesson — error / state
      'state.errNoPath': '未指定课程路径',
      'state.errNoPathMsg': '在 URL 中加上 ?path=phases/01-math-foundations/01-linear-algebra-intuition。',
      'state.errNotFound': '找不到这节课',
      'state.errNotFoundMsg': '无法获取 {path} 处的课程，它可能还没有写出来。',
      'state.backToHome': '返回首页',

      // lesson — sidebar / toc / diagram
      'lesson.onThisPage': '本页目录',
      'lesson.diagramRendering': '正在渲染图示……',
      'lesson.diagramFailed': '图示无法渲染。',
      'lesson.learningObjectives': '学习目标',
      'lesson.labChallenge': '实验挑战',

      // lesson — code blocks
      'code.copy': '复制',
      'code.copied': '已复制！',
      'code.copyCommand': '复制命令',

      // lesson — AI panels
      'panel.outputsTitle': '这节课产出了什么',
      'panel.outputsSubtitle': '你现在就能用的 prompt、skill 和 artifact',
      'panel.outputsLoading': '正在加载产物……',
      'panel.badgePrompt': 'Prompt',
      'panel.badgeSkill': 'Skill',
      'panel.badgeOutput': '产物',
      'panel.installHintPrompt': '粘贴到 Claude、Cursor、Codex、OpenClaw、Hermes，或任何能读取 prompt 的 agent',
      'panel.descLoading': '正在加载描述……',
      'panel.viewOnGithub': '在 GitHub 上查看',
      'panel.install': '安装',
      'panel.viewLessonOnGithub': '在 GitHub 上查看本课',
      'panel.codeTitle': '运行代码',
      'panel.codeSubtitle': '本课的可执行文件',
      'panel.codeLoading': '正在加载代码文件……',

      // lesson — quiz chrome
      'quiz.title': '检验你的理解',
      'quiz.subtitle': '看看你掌握了吗？',
      'quiz.questionFmt': '第 {n} / {total} 题',
      'quiz.sectionPre': '课前自测',
      'quiz.sectionCheck': '课中自测',
      'quiz.sectionPost': '课后测验',
      'quiz.sectionAll': '测验',
      'quiz.scoreLabelIncomplete': '答完所有题目即可查看得分',
      'quiz.scorePerfect': '满分！',
      'quiz.scoreGreat': '做得很棒！',
      'quiz.scoreKeep': '继续加油！',
      'quiz.deeperPrefix': '想要更深入的测验？运行',
      'quiz.deeperSuffix': '（在 Claude、Cursor、Codex、OpenClaw、Hermes，或任何装了本课程 skill 的 agent 中）',
      'quiz.sectionScoreFmt': '答对 {correct}/{total}',

      // lesson — learning-path / continue panels
      'panel.pathTitle': '学习路径',
      'path.earlierLessonsFmt': '前面还有 {n} 节课',
      'path.laterLessonsFmt': '后面还有 {n} 节课',
      'path.progressFmt': '你已完成本阶段 {total} 节课中的 {done} 节',
      'path.readyForPhaseFmt': '准备好进入阶段 {id}：{name} 了',
      'nav.prevLesson': '上一课',
      'nav.nextLesson': '下一课',
      'panel.continueTitle': '继续学习',
      'panel.phaseFinished': '你完成了这个阶段！',
      'panel.browseAllPhaseFmt': '浏览阶段 {id} 的全部课程',
      'panel.fullCatalog': '完整课程目录',
      'panel.continueCalloutPrefix': '运行',
      'panel.continueCalloutSuffix': '（在 Claude、Cursor、Codex、OpenClaw、Hermes，或任何装了本课程 skill 的 agent 中）以获得个性化的学习路径'
    }
  };

  function t(key) {
    var l = getLang();
    return (I18N[l] && I18N[l][key]) || I18N.en[key] || key;
  }

  // Interpolating lookup: replaces {token} occurrences with params[token].
  // Token-based (not positional) so zh formats can reorder tokens freely.
  function tf(key, params) {
    var s = t(key);
    if (params) {
      for (var k in params) {
        if (params.hasOwnProperty(k)) s = s.split('{' + k + '}').join(params[k]);
      }
    }
    return s;
  }

  function applyI18n() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    // attribute form: data-i18n-attr="placeholder:search.lessons;title:foo.bar"
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var spec = attrNodes[j].getAttribute('data-i18n-attr');
      var pairs = spec.split(';');
      for (var k = 0; k < pairs.length; k++) {
        var kv = pairs[k].split(':');
        if (kv.length === 2) attrNodes[j].setAttribute(kv[0].trim(), t(kv[1].trim()));
      }
    }
    try { document.documentElement.setAttribute('lang', getLang()); } catch (e) {}
  }

  // Wire the header 中/EN button. onSwitch() runs after lang flips so each
  // page can re-render its data-driven lists / refetch content.
  function initLangToggle(onSwitch) {
    var btn = document.getElementById('langToggle');
    var label = document.getElementById('langLabel');
    function paint() { if (label) label.textContent = getLang() === 'zh' ? 'EN' : '中'; }
    paint();
    applyI18n();
    if (!btn) return;
    btn.addEventListener('click', function () {
      setLang(getLang() === 'zh' ? 'en' : 'zh');
      paint();
      applyI18n();
      if (typeof onSwitch === 'function') onSwitch();
    });
  }

  global.AIEFS_I18N = {
    getLang: getLang, setLang: setLang, L: L, t: t, tf: tf,
    applyI18n: applyI18n, initLangToggle: initLangToggle
  };
})(window);
