// Homepage copy is intentionally separate from lesson translations: lessons
// load markdown from the translations branch, while this static shell switches
// its small, hand-authored set of reader-facing strings in the browser.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AIFSHomeI18n = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';

  var zh = {
    'Skip to content': '跳到正文',
    Contents: '目录', Books: '图书', Catalog: '课程目录', Roadmap: '路线图', Glossary: '术语表', About: '关于',
    'AI Engineering': 'AI 工程', 'from Scratch': '从零开始',
    'open source · MIT': '开源 · MIT',
    'Every published lesson': '每一节已发布课程', 'Every phase': '每一个阶段',
    'Every algorithm built from raw math before a single framework gets imported.': '在引入任何框架之前，先从原始数学推导并实现每一个算法。',
    '. Every algorithm built from raw math before a single framework gets imported.': '。在引入任何框架之前，先从原始数学推导并实现每一个算法。',
    'Maintained by Rohit Ghumare and contributors. Run on your own machine.': '由 Rohit Ghumare 与贡献者维护。可在你自己的机器上运行。',
    'Start the Course': '开始学习', 'Explore Learning Paths': '探索学习路径', 'Star on GitHub': '在 GitHub 上加星', 'Follow @rohitg00': '关注 @rohitg00',
    'Learn in your terminal': '在终端中学习', copy: '复制',
    'Use start-learning to begin the course.': '使用 start-learning 开始课程。', '+ any SKILL.md agent': '+ 任意 SKILL.md 智能体',
    'Your agent becomes your tutor: placement quiz, personalized path, lessons taught interactively in your terminal.': '让你的智能体成为导师：通过分级测验、个性化路径和终端互动课程进行学习。',
    Previous: '上一页', Next: '下一页',
    'Most AI material teaches in scattered pieces. A paper here, a fine-tuning post there, a flashy agent demo somewhere else. The pieces rarely line up. You ship a chatbot but can\'t explain its loss curve. You hook a function to an agent but can\'t say what attention does inside the model that\'s calling it.': '大多数 AI 材料都零散呈现：一篇论文、一篇微调文章、一个炫目的智能体演示。它们很少连成体系。你上线了聊天机器人，却解释不了损失曲线；你为智能体接上函数，却说不清模型内部的注意力机制。',
    'This curriculum is the spine.': '本课程提供完整的主线。',
    ', four languages: Python, TypeScript, Rust, Julia. Linear algebra at one end, autonomous swarms at the other. Every algorithm gets built from raw math first. Backprop. Tokenizer. Attention. Agent loop. By the time PyTorch shows up, you already know what it\'s doing under the hood.': '，涵盖 Python、TypeScript、Rust 和 Julia 四种语言。从线性代数到自主智能体群；每个算法都先从原始数学构建：反向传播、分词器、注意力、智能体循环。因此，当 PyTorch 出现时，你已了解其底层原理。',
    'every published lesson': '每一节已发布课程',
    'four languages: Python, TypeScript, Rust, Julia. Linear algebra at one end, autonomous swarms at the other. Every algorithm gets built from raw math first. Backprop. Tokenizer. Attention. Agent loop. By the time PyTorch shows up, you already know what it\'s doing under the hood.': '涵盖 Python、TypeScript、Rust 和 Julia 四种语言。从线性代数到自主智能体群；每个算法都先从原始数学构建：反向传播、分词器、注意力、智能体循环。因此，当 PyTorch 出现时，你已了解其底层原理。',
    'Each lesson runs the same loop: read the problem, derive the math, write the code, run the test, keep the artifact. No five-minute videos, no copy-paste deploys, no hand-holding. Free, open source, and built to run on your own laptop.': '每一课遵循同一个循环：阅读问题、推导数学、编写代码、运行测试、保留产物。没有五分钟视频、复制粘贴式部署或手把手代劳。它免费、开源，并能在你的笔记本电脑上运行。',
    'Choose the work you want to do': '选择你想完成的工作',
    'AI engineering is larger than model code. Choose one of four core learning paths, then learn from the same source, labs, tests, and artifacts in the browser or on GitHub.': 'AI 工程不止是模型代码。请选择四条核心学习路径之一，并在浏览器或 GitHub 中学习同一套源代码、实验、测试和产物。',
    'View Learning Paths': '查看学习路径', 'Browse career routes': '浏览职业路线', 'Learning Paths': '学习路径', 'LEARNING PATHS': '学习路径', '4 connected domains': '4 个互相关联的领域',
    'Building and Deploying AI Applications': '构建和部署 AI 应用', 'Software Engineering Fundamentals': '软件工程基础', 'Agent-Assisted Engineering': '智能体辅助工程', 'Product Judgment and Delivery': '产品判断与交付',
    'Recommended first': '推荐起点', 'New to AI engineering': 'AI 工程新手', 'Open lesson': '打开课程', 'GitHub source': 'GitHub 源码',
    'Core domain': '核心领域', 'Focused path': '专项路径', 'Practice by evidence': '基于证据的练习',
    'Start path': '开始路径', 'GitHub path': 'GitHub 路径', 'Certification preparation': '认证备考', 'Explore paths': '探索路径', 'GitHub tutor': 'GitHub 导师',
    'Finished Lessons': '已完成课程', Phases: '阶段', Languages: '语言', 'Glossary Terms': '术语表词条', bar: '条形图',
    'Progress saved in browser only': '进度仅保存在浏览器中', 'Reset progress': '重置进度',
    'Independent certification preparation': '独立认证备考', 'Prepare by building the real systems': '通过构建真实系统来备考',
    'Four Claude certification paths taught the same way as the course: step by step, with interactive labs, practical artifacts, and an AI tutor that works from the GitHub repo.': '四条 Claude 认证路径采用与课程相同的教学方式：循序渐进，配有互动实验、实用产物和基于 GitHub 仓库运行的 AI 导师。',
    'Not affiliated with, endorsed by, sponsored by, or authorized by Anthropic. This curriculum does not issue credentials or guarantee a passing result.': '本课程不隶属于、未获 Anthropic 认可、赞助或授权；不颁发证书，也不保证通过。',
    'Explore certifications': '探索认证', 'Learn with the GitHub tutor': '使用 GitHub 导师学习',
    'The entire curriculum is on GitHub. Clone it, fork it, learn at your own pace. No paywall, no signup. Every lesson has runnable code in Python, TypeScript, Rust, or Julia, depending on what fits the concept best.': '完整课程都在 GitHub 上。你可以克隆、派生，并按自己的节奏学习；没有付费墙，无需注册。每节课都提供可运行的 Python、TypeScript、Rust 或 Julia 代码，按最适合概念的语言编写。',
    '© 2026 · open source · free forever': '© 2026 · 开源 · 永久免费', Certifications: '认证', Report: '报告',
    'AI / FROM SCRATCH': 'AI / 从零开始', LANGUAGE: '语言', 'FIG_000 · curriculum v1.0 · 2026': 'FIG_000 · 课程 v1.0 · 2026',
    'How this works': '课程如何运作', 'Read by engineers and students at': '受到以下工程师和学生阅读',
    'Set up a working environment, run the repository, and learn the lesson workflow before choosing a specialization.': '搭建可用环境、运行仓库，并在选择专业方向前掌握课程工作流。',
    'Move from prompts, structured outputs, embeddings, and retrieval through evaluation, serving, observability, and safe release.': '从提示词、结构化输出、嵌入与检索，进阶到评估、服务、可观测性和安全发布。',
    'Build the repository, environment, interface, debugging, verification, security, release, and operational foundations AI systems depend on.': '构建 AI 系统所依赖的仓库、环境、界面、调试、验证、安全、发布与运维基础。',
    'Frame the task, plan from repository evidence, engineer the loop and harness, isolate delegation, verify the result, and preserve feedback.': '界定任务，依据仓库证据规划，构建循环与测试框架，隔离委派，验证结果并保留反馈。',
    'Turn observed work into outcomes, assumptions, testable slices, executable specifications, measurement plans, staged releases, and owned feedback.': '把观察到的工作转化为成果、假设、可测试切片、可执行规范、度量计划、分阶段发布和明确归属的反馈。',
    'Build, secure, verify, and operate stateless MCP systems from wire envelopes through release gates.': '从线路封装到发布关卡，构建、保护、验证并运行无状态 MCP 系统。',
    'Build, invoke, route, secure, evaluate, package, and verify portable skills in real agent hosts.': '在真实智能体宿主中构建、调用、路由、保护、评估、打包并验证可移植技能。',
    'Choose a certification route, complete practical labs, keep learner-owned artifacts, and use original assessments.': '选择认证路线，完成实践实验，保留学习者自有产物，并使用原创测评。',
    'Current Progress': '当前进度', 'Curriculum · 20 phases · 523 lessons': '课程 · 20 个阶段 · 523 节课程',
    'Tap a phase to expand its lessons. Each one ships when its math, code, and test are all written.': '点击阶段以展开课程；每节课都在数学、代码和测试完成后交付。',
    'Setup & Tooling': '环境配置与工具', 'Math Foundations': '数学基础', 'ML Fundamentals': '机器学习基础', 'Deep Learning Core': '深度学习核心',
    'Computer Vision': '计算机视觉', 'NLP: Foundations to Advanced': '自然语言处理：从基础到进阶', 'Speech & Audio': '语音与音频', 'Transformers Deep Dive': 'Transformer 深入解析',
    'Generative AI': '生成式 AI', 'Reinforcement Learning': '强化学习', 'LLMs from Scratch': '从零构建大语言模型', 'LLM Engineering': '大语言模型工程',
    'Multimodal AI': '多模态 AI', 'Tools & Protocols': '工具与协议', 'Agent Engineering': '智能体工程', 'Autonomous Systems': '自主系统',
    'Multi-Agent & Swarms': '多智能体与群体', 'Infrastructure & Production': '基础设施与生产', 'Ethics, Safety & Alignment': '伦理、安全与对齐', 'Capstone Projects': '综合项目',
    Complete: '已完成', 'In progress': '进行中', Planned: '已规划',
    'The book edition · six volumes': '图书版 · 六卷', 'The course, compiled. EPUB and PDF built from the same lessons and attached to every GitHub release. The site stays the living edition. Every chapter links back here for the animated figures, quizzes, and code.': '课程已汇编成书。EPUB 和 PDF 由相同课程构建，并随每次 GitHub 发布附上；网站保持为持续更新的版本，每章都链接回这里查看动画图表、测验和代码。',
    Foundations: '基础', 'Math, Tooling, and Classical Machine Learning · phases 00-02': '数学、工具与经典机器学习 · 阶段 00–02', 'Deep Learning': '深度学习', 'Networks, Vision, and Speech · phases 03, 04, 06': '网络、视觉与语音 · 阶段 03、04、06',
    Language: '语言', 'NLP Foundations and the Transformer · phases 05, 07': '自然语言处理基础与 Transformer · 阶段 05、07', 'Large Language Models': '大语言模型', 'Generation, Reinforcement, Pretraining, and Engineering · phases 08-11': '生成、强化学习、预训练与工程 · 阶段 08–11',
    Agents: '智能体', 'Multimodality, Protocols, Autonomy, and Swarms · phases 12-16': '多模态、协议、自主性与群体 · 阶段 12–16', Production: '生产环境', 'Infrastructure, Safety, and Capstones · phases 17-19': '基础设施、安全与综合项目 · 阶段 17–19',
    'Links resolve to the newest': '链接指向最新的', 'GitHub release': 'GitHub 发布版', '· rebuilt by CI from the lessons on every release ·': '· 每次发布均由 CI 根据课程重新构建 ·', "how it's made": '制作方式', Colophon: '版本说明'
  };

  var originals = typeof WeakMap === 'function' ? new WeakMap() : null;
  var activeLanguage = 'en';

  function translate(text, lang) {
    var source = String(text);
    if (lang !== 'zh') return source;
    var prefix = (source.match(/^\s*/) || [''])[0];
    var suffix = (source.match(/\s*$/) || [''])[0];
    var middle = source.slice(prefix.length, source.length - suffix.length);
    var translated = Object.prototype.hasOwnProperty.call(zh, middle) ? zh[middle] : middle;
    return prefix + translated + suffix;
  }

  function applyHomeLanguage(lang, document) {
    var active = lang === 'zh' ? 'zh' : 'en';
    activeLanguage = active;
    document.documentElement.lang = active;
    document.documentElement.dir = 'ltr';

    if (!document.body || typeof document.createTreeWalker !== 'function') return;
    var walker = document.createTreeWalker(document.body, 4);
    var node;
    while ((node = walker.nextNode())) {
      var source = originals && originals.has(node) ? originals.get(node) : node.nodeValue;
      if (originals && !originals.has(node)) originals.set(node, source);
      node.nodeValue = translate(source, active);
    }
  }

  function start() {
    if (!root.document || !root.AIFS_currentLang) return;
    applyHomeLanguage(root.AIFS_currentLang(), root.document);
    root.AIFS_onLangChange = function (lang) { applyHomeLanguage(lang, root.document); };
    root.document.addEventListener('DOMContentLoaded', function () {
      applyHomeLanguage(root.AIFS_currentLang(), root.document);
    }, { once: true });
    if (root.MutationObserver && root.document.body) {
      new root.MutationObserver(function () {
        if (activeLanguage === 'zh') applyHomeLanguage('zh', root.document);
      }).observe(root.document.body, { childList: true, subtree: true });
    }
  }

  if (typeof window !== 'undefined') start();
  return { applyHomeLanguage: applyHomeLanguage, translateText: translate };
});
