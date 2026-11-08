/* i18n.zh-Hant.js — Traditional Chinese (繁體中文) dictionary.
 *
 * Keys are the exact English source strings as they appear in the pages or in
 * the data the site renders; whitespace is collapsed before lookup, so a key
 * never needs to reproduce the HTML's line wrapping. Anything absent falls
 * back to English, which makes partial translation safe: add entries and they
 * light up, remove one and the page still reads.
 *
 * Terminology follows Taiwan conventions (程式碼 / 資料 / 函式 / 演算法 /
 * 推論 / 網路). Product names, people, and code identifiers stay in English on
 * purpose — translating "Transformer" or "PyTorch" would help nobody.
 */
window.I18N_ZH_HANT = {
  /* ── Navigation and shared chrome ──────────────────────────────── */
  'Contents': '目錄',
  'Catalog': '課程目錄',
  'Roadmap': '學習藍圖',
  'Glossary': '詞彙表',
  'About': '關於',
  'Books': '書籍',
  'Home': '首頁',
  'Course': '課程',
  'Lesson': '單元',
  'Lessons': '單元',
  'Phase': '階段',
  'Type': '類型',
  'Language': '語言',
  'Languages': '程式語言',
  'Status': '狀態',
  'Search': '搜尋',
  'Search (⌘K)': '搜尋（⌘K）',
  'Toggle theme': '切換佈景主題',
  'GitHub stars': 'GitHub 星星數',
  'Skip to content': '跳至主要內容',
  'Report': '回報問題',
  'Report / Suggest': '回報問題／提出建議',
  'Escape': 'Esc',
  'Enter': 'Enter',
  'Ctrl+K': 'Ctrl+K',
  'Search lessons and glossary': '搜尋單元與詞彙表',
  'Search results': '搜尋結果',
  'Type to search 503 lessons, 499 outputs, and glossary terms':
    '輸入即可搜尋 503 個單元、499 項產出與詞彙表',
  'AI Engineering from Scratch · open source · free forever.':
    'AI Engineering from Scratch · 開放原始碼 · 永久免費。',
  '© 2026 · open source · free forever': '© 2026 · 開放原始碼 · 永久免費',
  'open source · MIT': '開放原始碼 · MIT',
  'FIG_000 · curriculum v1.0 · 2026': 'FIG_000 · 課程 v1.0 · 2026',

  /* ── Home ──────────────────────────────────────────────────────── */
  'AI Engineering from Scratch': 'AI Engineering from Scratch',
  'AI Engineering from Scratch is a free, open-source curriculum that builds every core AI algorithm by hand — 503 lessons, 20 phases, four languages. The math, the model, the tokenizer, and the agent loop. Once, by hand.':
    'AI Engineering from Scratch 是一套免費、開放原始碼的課程，把每個核心 AI 演算法都親手實作一遍 —— 503 個單元、20 個階段、四種語言。數學、模型、分詞器、代理程式迴圈，全都親手寫過一次。',
  '503 lessons. 20 phases. Every algorithm built from raw math before a single framework gets imported.':
    '503 個單元、20 個階段。在匯入任何框架之前，先從最原始的數學把每個演算法親手寫出來。',
  'Maintained by Rohit Ghumare and contributors. Run on your own machine.':
    '由 Rohit Ghumare 與貢獻者維護。在你自己的機器上執行。',
  'Star on GitHub': '在 GitHub 上加星',
  'Star ai-engineering-from-scratch on GitHub': '在 GitHub 上為 ai-engineering-from-scratch 加星',
  'Follow Rohit Ghumare on GitHub': '在 GitHub 上追蹤 Rohit Ghumare',
  'How this works': '這套課程怎麼運作',
  "Most AI material teaches in scattered pieces. A paper here, a fine-tuning post there, a flashy agent demo somewhere else. The pieces rarely line up. You ship a chatbot but can't explain its loss curve. You hook a function to an agent but can't say what attention does inside the model that's calling it.":
    '大多數 AI 教材都是零散的碎片：這裡一篇論文、那裡一篇微調心得、另一處一個炫目的代理程式示範，彼此很少對得上。你做得出聊天機器人，卻說不清它的損失曲線；你把函式接上代理程式，卻講不出呼叫它的模型內部，注意力機制到底做了什麼。',
  "This curriculum is the spine. 20 phases, 503 lessons, four languages: Python, TypeScript, Rust, Julia. Linear algebra at one end, autonomous swarms at the other. Every algorithm gets built from raw math first. Backprop. Tokenizer. Attention. Agent loop. By the time PyTorch shows up, you already know what it's doing under the hood.":
    '這套課程就是那根脊椎：20 個階段、503 個單元、四種語言 —— Python、TypeScript、Rust、Julia。一端是線性代數，另一端是自主群體智慧。每個演算法都先從最原始的數學親手寫起：反向傳播、分詞器、注意力機制、代理程式迴圈。等 PyTorch 出場時，你已經知道它底下在做什麼了。',
  'Each lesson runs the same loop: read the problem, derive the math, write the code, run the test, keep the artifact. No five-minute videos, no copy-paste deploys, no hand-holding. Free, open source, and built to run on your own laptop.':
    '每個單元都跑同一個循環：讀懂問題、推導數學、寫出程式碼、跑過測試、留下產出。沒有五分鐘影片，沒有複製貼上式部署，也不會牽著你的手。免費、開放原始碼，而且就在你自己的筆記型電腦上跑得動。',
  'Current Progress': '目前進度',
  'Finished Lessons': '已完成單元',
  'Phases': '階段',
  'Glossary Terms': '詞彙條目',
  'Curriculum · 20 phases · 503 lessons': '課程內容 · 20 個階段 · 503 個單元',
  'Tap a phase to expand its lessons. Each one ships when its math, code, and test are all written.':
    '點一下階段即可展開其中的單元。每個單元都要等數學、程式碼與測試全部寫完才會發布。',
  'In progress': '進行中',
  'In Progress': '進行中',
  'Complete': '已完成',
  'Planned': '規劃中',
  'Progress saved in browser only': '進度僅儲存在瀏覽器',
  'Reset progress': '重設進度',
  'Clear all your local progress (quiz answers and completed lessons)? This cannot be undone.':
    '確定要清除所有本機進度（測驗作答與已完成單元）嗎？此動作無法復原。',
  'You completed this lesson': '你已完成這個單元',
  'Review': '複習',
  'Mark complete': '標記為完成',
  'Mark as not done': '標記為未完成',
  'The book edition · six volumes': '書籍版 · 共六卷',
  'The course, compiled. EPUB and PDF built from the same lessons and attached to every GitHub release. The site stays the living edition — every chapter links back here for the animated figures, quizzes, and code.':
    '把整套課程編譯成書。EPUB 與 PDF 由同一批單元建置而成，並隨每次 GitHub 發行版本一起發佈。網站則是持續更新的活版本 —— 每一章都會連回這裡，看動態圖解、做測驗、讀程式碼。',
  'Links resolve to the newest': '連結會指向最新的',
  'GitHub release': 'GitHub 發行版本',
  '· rebuilt by CI from the lessons on every release ·': '· 每次發行都由 CI 從單元重新建置 ·',
  "how it's made": '製作方式',
  'Colophon': '版本說明',
  'The entire curriculum is on GitHub. Clone it, fork it, learn at your own pace. No paywall, no signup. Every lesson has runnable code in Python, TypeScript, Rust, or Julia, depending on what fits the concept best.':
    '整套課程都放在 GitHub 上。你可以複製、分支，按自己的步調學習。沒有付費牆，不用註冊。每個單元都有可執行的程式碼，視概念最適合哪種語言而定，可能是 Python、TypeScript、Rust 或 Julia。',
  'Copy': '複製',
  'Copy command': '複製指令',
  'Copied!': '已複製！',

  /* Book volumes */
  'Foundations': '基礎',
  'Math, Tooling, and Classical Machine Learning': '數學、工具鏈與傳統機器學習',
  'Deep Learning': '深度學習',
  'Networks, Vision, and Speech': '網路架構、視覺與語音',
  /* Volume 3 is titled "Language" — already mapped under shared chrome above.
     Keys are one flat namespace, not per-section, so it cannot repeat here. */
  'NLP Foundations and the Transformer': '自然語言處理基礎與 Transformer',
  'Large Language Models': '大型語言模型',
  'Generation, Reinforcement, Pretraining, and Engineering': '生成、強化學習、預訓練與工程實務',
  'Agents': '代理程式',
  'Multimodality, Protocols, Autonomy, and Swarms': '多模態、協定、自主性與群體智慧',
  'Production': '生產環境',
  'Infrastructure, Safety, and Capstones': '基礎設施、安全與總結專案',
  'phases': '階段',

  /* ── Catalog ───────────────────────────────────────────────────── */
  'Lesson Catalog': '課程目錄',
  'Lesson Catalog - AI Engineering from Scratch': '課程目錄 - AI Engineering from Scratch',
  'Catalog · AI Engineering from Scratch': '課程目錄 · AI Engineering from Scratch',
  'Every lesson across all 20 phases. Search, filter, sort.':
    '20 個階段的所有單元。可搜尋、篩選、排序。',
  'Full catalog of 503 AI engineering lessons. Search, filter, and sort every lesson across all 20 phases.':
    '503 個 AI 工程單元的完整目錄。可搜尋、篩選並排序全部 20 個階段的每一個單元。',
  'Search and filter 503 lessons across 20 phases. Python, TypeScript, Rust, Julia.':
    '搜尋並篩選 20 個階段、503 個單元。Python、TypeScript、Rust、Julia。',
  'Search and filter 503 lessons across 20 phases.': '搜尋並篩選 20 個階段、503 個單元。',
  'Search lessons...': '搜尋單元…',
  'All Phases': '所有階段',
  'All Status': '所有狀態',

  /* ── Glossary ──────────────────────────────────────────────────── */
  'AI Glossary': 'AI 詞彙表',
  'AI Glossary - AI Engineering from Scratch': 'AI 詞彙表 - AI Engineering from Scratch',
  'Glossary · AI Engineering from Scratch': '詞彙表 · AI Engineering from Scratch',
  'What people': '大家',
  'say': '這樣說',
  'vs what things actually': '，而它實際上',
  'mean': '是這個意思',
  'What people say vs what things actually mean. Every AI term, defined without hand-waving.':
    '大家這樣說，而它實際上是這個意思。每個 AI 術語都給出不含糊的定義。',
  'What people say vs what things actually mean.': '大家這樣說，而它實際上是這個意思。',
  'AI glossary: what people say vs what things actually mean. Every term explained without hand-waving.':
    'AI 詞彙表：大家這樣說，而它實際上是這個意思。每個術語都解釋得清清楚楚。',
  'Search terms...': '搜尋詞彙…',

  /* ── Roadmap ───────────────────────────────────────────────────── */
  'Roadmap - AI Engineering from Scratch': '學習藍圖 - AI Engineering from Scratch',
  'Roadmap · AI Engineering from Scratch': '學習藍圖 · AI Engineering from Scratch',
  'Click any phase to see its prerequisites and what it unlocks downstream.':
    '點選任一階段，即可看到它的先修條件，以及它會解鎖哪些後續內容。',
  'Interactive prerequisite map for 503 AI engineering lessons. See which phases depend on which, and plan your learning path.':
    '503 個 AI 工程單元的互動式先修關係圖。看清階段之間的依賴關係，規劃你的學習路徑。',
  'Interactive prerequisite map across 20 phases.': '橫跨 20 個階段的互動式先修關係圖。',
  'Select Phase': '選擇階段',
  '✕ Clear selection': '✕ 清除選取',
  '↔ Scroll to explore the full graph': '↔ 左右滑動可瀏覽完整關係圖',

  /* ── About ─────────────────────────────────────────────────────── */
  'About - AI Engineering from Scratch': '關於 - AI Engineering from Scratch',
  'About this project': '關於這個專案',
  'What AI Engineering from Scratch is, why it exists, who builds it, and how the site is made. A free, open-source, MIT-licensed curriculum.':
    'AI Engineering from Scratch 是什麼、為何存在、由誰打造，以及這個網站怎麼做出來的。一套免費、開放原始碼、採用 MIT 授權的課程。',
  'AI Engineering from Scratch is a free, open-source curriculum that builds every core AI algorithm by hand. 503 lessons across 20 phases, from linear algebra to autonomous agents, in Python, TypeScript, Rust, and Julia.':
    'AI Engineering from Scratch 是一套免費、開放原始碼的課程，把每個核心 AI 演算法都親手實作一遍。20 個階段共 503 個單元，從線性代數一路到自主代理程式，涵蓋 Python、TypeScript、Rust 與 Julia。',
  'Why it exists': '為什麼會有這套課程',
  'Most AI material teaches in scattered pieces. A paper here, a fine-tuning post there, a framework demo somewhere else. You can ship a chatbot without being able to explain its loss curve, or wire a tool to an agent without knowing what attention does inside the model calling it.':
    '大多數 AI 教材都是零散的碎片：這裡一篇論文、那裡一篇微調心得、另一處一個框架示範。你可以做出聊天機器人卻解釋不了它的損失曲線，也可以把工具接上代理程式，卻不知道呼叫它的模型內部，注意力機制在做什麼。',
  'This curriculum is the spine. Every algorithm gets written from raw math first, then run through the production library so you can see what the library was doing. By the time PyTorch shows up, you already know what it computes. Each lesson ends with a reusable artifact you keep: a prompt, a skill, an agent, or an MCP server.':
    '這套課程就是那根脊椎。每個演算法都先從最原始的數學寫起，再用生產級的函式庫跑一次，讓你看清函式庫原本在做什麼。等 PyTorch 出場時，你已經知道它算的是什麼了。每個單元最後都會留下一份可重複使用的產出：一段提示詞、一項技能、一個代理程式，或一台 MCP 伺服器。',
  'How it is made': '製作方式',
  'The lessons are authored with AI assistance and reviewed by a human against primary sources. Where a lesson states a fact, it cites the original: an RFC, a spec, or a research paper, not a secondary summary. Corrections are welcome and tracked in the open on GitHub.':
    '單元由 AI 協助撰寫，並由人工對照第一手資料審閱。單元陳述任何事實時，都引用原始出處：RFC、規格書或研究論文，而不是二手摘要。歡迎提出修正，所有修正都公開追蹤於 GitHub。',
  'The site itself is deliberately plain: hand-written HTML, CSS, and vanilla JavaScript, no framework. A single build script (':
    '網站本身刻意保持樸素：手寫的 HTML、CSS 與原生 JavaScript，不用任何框架。單一支建置腳本（',
  ') reads the lesson Markdown in the repository and generates the catalog, search index, sitemap, and':
    '）讀取儲存庫裡的單元 Markdown，生成課程目錄、搜尋索引、網站地圖與',
  'on every deploy, so the published numbers can never drift from the source. It is hosted on Vercel.':
    '，每次部署都重新生成，因此公布的數字絕不會與原始內容脫節。網站託管於 Vercel。',
  'Who builds it': '由誰打造',
  'Maintained by': '維護者：',
  'and contributors. It is MIT-licensed and free forever. There is no token, no course upsell, and no gated content.':
    '與眾多貢獻者。本專案採用 MIT 授權，永久免費。沒有代幣、沒有課程加價方案，也沒有付費才能看的內容。',
  'Get involved': '一起參與',
  'Read the source:': '閱讀原始碼：',
  'Found an error or have a lesson idea?': '發現錯誤，或有單元的想法？',
  'Open an issue': '開一個 issue',
  'Start learning:': '開始學習：',
  'browse the catalog': '瀏覽課程目錄',
  'or': '或',
  'follow the roadmap': '依照學習藍圖前進',

  /* ── Lesson page ───────────────────────────────────────────────── */
  'Lesson - AI Engineering from Scratch': '單元 - AI Engineering from Scratch',
  'AI Engineering from Scratch · Lesson': 'AI Engineering from Scratch · 單元',
  'A lesson from the AI Engineering from Scratch curriculum. 503 lessons across 20 phases, four languages, every algorithm built from raw math.':
    'AI Engineering from Scratch 課程中的一個單元。20 個階段共 503 個單元、四種語言，每個演算法都從最原始的數學建起。',
  'Loading lesson...': '正在載入單元…',
  'Toggle lesson menu': '切換單元選單',
  'Expanded diagram': '放大的圖解',
  'Diagram': '圖解',
  'Close': '關閉',
  'On this page': '本頁內容',
  'View lesson on GitHub': '在 GitHub 上檢視這個單元',
  'No lesson path specified': '未指定單元路徑',
  'Render error': '渲染失敗',
  'Loaded the lesson markdown but failed to render it. Details in the browser console.':
    '已載入單元的 Markdown，但渲染失敗。詳細資訊請看瀏覽器主控台。',
  'Lesson temporarily unavailable': '單元暫時無法載入',
  'Lesson not found': '找不到這個單元',
  'Could not load the lesson at': '無法載入這個單元：',
  'right now. Try reloading the page.': '，請重新整理頁面再試一次。',
  'Could not fetch the lesson at': '無法取得這個單元：',
  '. It may not have been written yet.': '。這個單元可能還沒寫。',
  'Add ?path=phases/01-math-foundations/01-linear-algebra-intuition to the URL.':
    '請在網址後面加上 ?path=phases/01-math-foundations/01-linear-algebra-intuition。',
  'Read it on GitHub': '在 GitHub 上閱讀',
  'Back to Home': '回到首頁',
  'Expand': '放大',
  'Rendering diagram...': '正在繪製圖解…',
  'Diagram could not be rendered.': '無法繪製這張圖解。',
  '🎯 Learning Objectives': '🎯 學習目標',
  '💫 Lab Challenge': '💫 實作挑戰',
  '← Previous': '← 上一課',
  'Next →': '下一課 →',

  /* ── Lesson page: bottom panels ────────────────────────────────── */
  'What This Lesson Ships': '這個單元交付什麼',
  'Prompts, skills, and artifacts you can use right now': '可以立刻拿來用的提示詞、技能與產出',
  'Loading outputs...': '正在載入產出…',
  'Loading description...': '正在載入說明…',
  'View on GitHub': '在 GitHub 上檢視',
  'Install': '安裝',
  'Prompt': '提示詞',
  'Skill': '技能',
  'Output': '產出',
  'Paste into Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads prompts':
    '貼進 Claude、Cursor、Codex、OpenClaw、Hermes，或任何讀取提示詞的代理程式',
  'Run the Code': '執行程式碼',
  'Executable files from this lesson': '這個單元可以執行的檔案',
  'Loading code files...': '正在載入程式碼檔案…',
  /* 'Copy command' / 'Copied!' are shared with the catalog page, above. */
  'Learning Path': '學習路徑',
  'Phase {n}: {name}': '階段 {n}：{name}',
  'Lesson {n} of {total}': '第 {n} 個單元，共 {total} 個',
  /* The timeline ellipsis carries the short label; the long form is its title. */
  '{n} earlier': '前面 {n} 個',
  '{n} later': '後面 {n} 個',
  '{n} earlier lessons': '前面還有 {n} 個單元',
  '{n} later lessons': '後面還有 {n} 個單元',
  'You\'ve completed {done} of {total} lessons in this phase':
    '這個階段共 {total} 個單元，你已完成 {done} 個',
  'Ready for Phase {n}: {name}': '可以進入階段 {n}：{name} 了',
  'Continue Learning': '繼續學習',
  'You finished this phase!': '你完成這個階段了！',
  'Browse all Phase {n} lessons': '瀏覽階段 {n} 的所有單元',
  'Full course catalog': '完整課程目錄',
  'Run': '執行',
  'in Claude, Cursor, Codex, OpenClaw, Hermes, or any agent with the curriculum skills installed for a personalized learning path':
    '，在 Claude、Cursor、Codex、OpenClaw、Hermes，或任何已安裝本課程技能的代理程式中皆可，取得專屬於你的學習路徑',

  /* ── Lesson page: quizzes ──────────────────────────────────────── */
  'Pre-Lesson Check': '課前檢核',
  'Mid-Lesson Check': '課中檢核',
  'Post-Lesson Quiz': '課後測驗',
  'Quiz': '測驗',
  'Test Your Understanding': '檢驗你的理解',
  'Loading questions...': '正在載入題目…',
  'Did you get it?': '你都學會了嗎？',
  'Question {n} of {total}': '第 {n} 題，共 {total} 題',
  'Complete all questions to see your score': '答完所有題目就會顯示分數',
  '{answered}/{total} answered. Review the feedback, then retry when ready.':
    '已作答 {answered}/{total}。看完回饋後，隨時可以重新作答。',
  '{correct}/{total} correct': '答對 {correct}/{total}',
  'Perfect score!': '滿分！',
  'Great work!': '表現很好！',
  'Keep studying!': '繼續加油！',
  'Want a deeper quiz? Run': '想要更深入的測驗？執行',
  'in Claude, Cursor, Codex, OpenClaw, Hermes, or any agent with the curriculum skills installed':
    '，在 Claude、Cursor、Codex、OpenClaw、Hermes，或任何已安裝本課程技能的代理程式中皆可',

  /* ── Lesson page: built-in fallback quiz bank ──────────────────────
   * lesson.html ships these questions for lessons whose quiz.json has no
   * usable post-lesson questions, picked by keyword in the lesson path.
   * They are literals in the page, so they translate here; the per-lesson
   * quiz.json questions are fetched at runtime and are still English.  */
  'What does a dot product measure between two vectors?': '內積衡量兩個向量之間的什麼？',
  'Their sum': '它們的總和',
  'How aligned they are': '它們的方向有多一致',
  'Their cross product': '它們的外積',
  'The distance between them': '它們之間的距離',
  'The dot product measures the similarity or alignment between two vectors. When it is zero, the vectors are orthogonal.':
    '內積衡量兩個向量的相似度，也就是方向有多一致。內積為零時，兩個向量正交。',
  'What does the gradient of a function point toward?': '一個函式的梯度指向哪裡？',
  'The minimum': '最小值',
  'The steepest ascent': '上升最陡的方向',
  'The nearest saddle point': '最近的鞍點',
  'A random direction': '一個隨機方向',
  'The gradient always points in the direction of steepest increase. Gradient descent moves opposite to the gradient to find minima.':
    '梯度永遠指向上升最陡的方向。梯度下降則往梯度的反方向走，藉此找到極小值。',
  'A matrix with shape (3, 5) multiplied by (5, 2) produces what shape?':
    '形狀 (3, 5) 的矩陣乘上形狀 (5, 2) 的矩陣，結果是什麼形狀？',
  'Matrix multiplication: (m, n) x (n, p) = (m, p). So (3, 5) x (5, 2) = (3, 2).':
    '矩陣乘法：(m, n) x (n, p) = (m, p)。所以 (3, 5) x (5, 2) = (3, 2)。',

  'What is the purpose of a loss function in machine learning?': '在機器學習裡，損失函式的用途是什麼？',
  'To generate data': '產生資料',
  'To measure how wrong predictions are': '衡量預測錯得有多離譜',
  'To select features': '挑選特徵',
  'To split data': '切分資料',
  'A loss function quantifies the difference between predicted and actual values. The optimizer minimizes this value during training.':
    '損失函式把預測值與真實值之間的差距量化。訓練時，最佳化器就是在最小化這個值。',
  'Why do we split data into train and test sets?': '為什麼要把資料切成訓練集與測試集？',
  'To save memory': '節省記憶體',
  'To evaluate generalization on unseen data': '在沒看過的資料上評估泛化能力',
  'To make training faster': '讓訓練更快',
  'To reduce the dataset size': '縮小資料集',
  'The test set acts as unseen data, revealing whether the model memorized training data or learned generalizable patterns.':
    '測試集扮演「沒看過的資料」，用來看出模型究竟是背下了訓練資料，還是真的學到可以泛化的規律。',
  'What does overfitting mean?': '過度擬合（overfitting）是什麼意思？',
  'The model is too simple': '模型太簡單',
  'The model memorizes training data but fails on new data': '模型背下了訓練資料，卻在新資料上失準',
  'The model trains too slowly': '模型訓練太慢',
  'The loss is too low': '損失值太低',
  'Overfitting occurs when a model performs well on training data but poorly on new data because it learned noise rather than signal.':
    '模型在訓練資料上表現很好、在新資料上卻很差，就是過度擬合：它學到的是雜訊，不是訊號。',

  'What does backpropagation compute?': '反向傳播算的是什麼？',
  'Forward predictions': '前向預測',
  'The gradient of the loss with respect to each weight': '損失對每個權重的梯度',
  'The learning rate': '學習率',
  'New training data': '新的訓練資料',
  'Backpropagation uses the chain rule to compute how much each weight contributed to the error, then adjusts weights accordingly.':
    '反向傳播用連鎖律算出每個權重對誤差貢獻了多少，再據此調整權重。',
  'Why do neural networks need non-linear activation functions?': '神經網路為什麼需要非線性的激活函式？',
  'To speed up training': '加快訓練速度',
  'Without them, stacking layers is equivalent to a single linear layer':
    '少了它們，疊再多層也等同於一層線性層',
  'To reduce memory usage': '減少記憶體用量',
  'To normalize outputs': '正規化輸出',
  'Without non-linearities, any composition of linear layers collapses to a single linear transformation. Activations like ReLU let the network learn complex patterns.':
    '沒有非線性，線性層怎麼疊都會塌縮成單一個線性轉換。ReLU 這類激活函式才讓網路學得到複雜的模式。',
  'What does the learning rate control?': '學習率控制的是什麼？',
  'How many epochs to train': '要訓練幾個 epoch',
  'The size of each weight update step': '每次權重更新的步伐大小',
  'The number of layers': '層數',
  'The batch size': '批次大小',
  'The learning rate scales the gradient update. Too large causes divergence, too small causes slow or stuck training.':
    '學習率會縮放梯度更新量。太大會發散，太小則訓練緩慢甚至卡住。',

  'What does self-attention allow a transformer to do?': '自注意力讓 Transformer 能做到什麼？',
  'Process tokens in order': '依序處理 token',
  'Weight the importance of every token relative to every other token':
    '衡量每個 token 相對於其他所有 token 的重要性',
  'Reduce vocabulary size': '縮減詞彙表大小',
  'Compress the model': '壓縮模型',
  'Self-attention computes pairwise relevance scores across all positions, allowing the model to relate distant tokens without recurrence.':
    '自注意力會計算所有位置兩兩之間的相關性分數，讓模型不必靠遞迴就能連結相距很遠的 token。',
  'Why do LLMs use tokenizers instead of raw characters?': 'LLM 為什麼用分詞器，而不是直接吃原始字元？',
  'Characters are too large': '字元太大',
  'Tokens compress frequent patterns into single units, reducing sequence length':
    'token 把常見的模式壓成單一單位，縮短序列長度',
  'Tokenizers are faster to train': '分詞器訓練得比較快',
  'Characters cannot be embedded': '字元沒辦法做嵌入',
  'Subword tokenizers like BPE balance vocabulary size against sequence length, making common words single tokens while handling rare words as pieces.':
    'BPE 這類子詞分詞器在詞彙表大小與序列長度之間取得平衡：常見字自成一個 token，罕見字則拆成片段處理。',
  'What is the key difference between pre-training and fine-tuning?': '預訓練與微調最關鍵的差別是什麼？',
  'Pre-training uses labeled data': '預訓練用的是有標註的資料',
  'Pre-training learns general language; fine-tuning adapts to a specific task':
    '預訓練學的是通用語言，微調則是針對特定任務做調適',
  'Fine-tuning uses more data': '微調用的資料比較多',
  'There is no difference': '兩者沒有差別',
  'Pre-training learns language patterns from massive unlabeled text. Fine-tuning takes that foundation and specializes it on smaller, task-specific data.':
    '預訓練從海量未標註文字裡學語言規律；微調則拿這個基礎，在較小的任務專屬資料上做專門化。',

  'What is the core idea behind RAG?': 'RAG 的核心想法是什麼？',
  'Training a larger model': '訓練更大的模型',
  'Retrieving relevant context before generating a response': '在生成回覆之前，先檢索相關的上下文',
  'Using more GPUs': '用更多 GPU',
  'Reducing model size': '縮小模型',
  'RAG (Retrieval-Augmented Generation) grounds LLM responses in retrieved documents, reducing hallucination and enabling knowledge updates without retraining.':
    'RAG（檢索增強生成）讓 LLM 的回覆有檢索到的文件當依據，既降低幻覺，也能不重新訓練就更新知識。',
  'What do embedding models produce?': '嵌入模型產出的是什麼？',
  'Text summaries': '文字摘要',
  'Dense vector representations of text': '文字的稠密向量表示',
  'Token counts': 'token 數量',
  'Grammar corrections': '文法修正',
  'Embedding models map text into fixed-dimensional vectors where semantic similarity corresponds to geometric proximity.':
    '嵌入模型把文字映射到固定維度的向量空間，語意上的相似對應到幾何上的相近。',
  'Why use cosine similarity for comparing embeddings?': '比較嵌入向量時，為什麼用餘弦相似度？',
  'It is the only metric': '因為只有這一種度量',
  'It measures angular similarity regardless of vector magnitude': '它衡量夾角相似度，不受向量長度影響',
  'It is faster than dot product': '它比內積快',
  'It works with integers only': '它只能用在整數上',
  'Cosine similarity normalizes for magnitude, focusing on direction. Two texts about the same topic will have high cosine similarity regardless of length.':
    '餘弦相似度把長度正規化掉，只看方向。兩段講同一主題的文字，不管長短，餘弦相似度都會很高。',

  'What distinguishes an AI agent from a simple chatbot?': 'AI 代理程式和單純的聊天機器人差在哪裡？',
  'Agents are faster': '代理程式比較快',
  'Agents can take actions and use tools autonomously': '代理程式能自主採取行動、使用工具',
  'Agents use bigger models': '代理程式用比較大的模型',
  'Agents have a loop: observe, decide, act. They can call tools, read files, search the web, and chain multiple steps to complete complex tasks.':
    '代理程式有一個迴圈：觀察、決策、行動。它能呼叫工具、讀檔案、搜尋網路，並串起多個步驟來完成複雜任務。',
  'What is MCP (Model Context Protocol)?': 'MCP（Model Context Protocol）是什麼？',
  'A model training format': '一種模型訓練格式',
  'A standardized protocol for connecting AI models to tools and data sources':
    '一套把 AI 模型接上工具與資料來源的標準化協定',
  'A compression algorithm': '一種壓縮演算法',
  'A testing framework': '一套測試框架',
  'MCP provides a universal interface between AI assistants and external tools/data, replacing one-off integrations with a standard protocol.':
    'MCP 在 AI 助理與外部工具／資料之間提供通用介面，用一套標準協定取代各自為政的一次性整合。',
  'Why is tool-use important for LLMs?': '工具使用對 LLM 為什麼重要？',
  'It reduces cost': '它能降低成本',
  'It lets LLMs access real-time information and take actions beyond text generation':
    '它讓 LLM 取得即時資訊，並做出生成文字以外的行動',
  'It makes responses shorter': '它讓回覆變短',
  'It removes hallucinations entirely': '它能完全消除幻覺',
  'Tools extend LLMs beyond their training data cutoff, enabling real-time lookups, calculations, code execution, and interaction with external systems.':
    '工具把 LLM 推到訓練資料截止日之外，讓它能即時查詢、計算、執行程式碼，並與外部系統互動。',

  'Why are evals critical for production AI systems?': '為什麼評測對生產環境的 AI 系統至關重要？',
  'To save money': '為了省錢',
  'To measure performance objectively before and after changes': '為了在改動前後客觀衡量表現',
  'To make the model bigger': '為了把模型變大',
  'Evals are optional': '評測可有可無',
  'Evals are the tests of AI engineering. Without them, you cannot know if a change improved or regressed quality. They should run on every code change.':
    '評測就是 AI 工程的測試。沒有評測，你無從得知一次改動是提升還是拉低了品質。每次改程式碼都該跑一次。',
  'What does "alignment" mean in AI safety?': '在 AI 安全裡，「對齊」（alignment）是什麼意思？',
  'Aligning text on screen': '把畫面上的文字對齊',
  'Ensuring AI systems act according to human intentions and values': '確保 AI 系統依照人類的意圖與價值觀行事',
  'Making models faster': '讓模型更快',
  'Using the same training data': '使用相同的訓練資料',
  'Alignment ensures that as AI systems become more capable, they remain helpful, honest, and harmless, acting in accordance with human goals.':
    '對齊確保 AI 系統在能力愈來愈強的同時，依然有用、誠實、無害，並且順著人類的目標行事。',
  'What is a guardrail in the context of deployed LLMs?': '在已上線的 LLM 情境中，護欄（guardrail）是什麼？',
  'A physical barrier': '一道實體屏障',
  'A check that prevents harmful, off-topic, or policy-violating outputs':
    '一道檢查機制，攔下有害、離題或違反政策的輸出',
  'A backup model': '一個備援模型',
  'A caching layer': '一層快取',
  'Guardrails filter inputs and outputs at runtime, catching toxicity, prompt injection, PII leaks, and other risks before they reach the user.':
    '護欄在執行期過濾輸入與輸出，在毒性內容、提示詞注入、個資外洩等風險送到使用者面前之前就攔下來。',

  'What does "from scratch" mean in this course?': '這門課說的「from scratch」是什麼意思？',
  'Using no computer': '完全不用電腦',
  'Building each concept by implementing it yourself, not just reading theory':
    '每個概念都親手實作一遍，而不是只讀理論',
  'Starting from assembly language': '從組合語言開始寫',
  'Only using pen and paper': '只用紙筆',
  'This course follows a Build-Use-Ship methodology: first understand by building it, then apply it, then ship it as a real artifact.':
    '這門課依循 Build-Use-Ship 的方法：先親手做出來以理解它，再拿它來用，最後把它交付成真正的產出。',
  'Why does this course combine math, ML, and engineering?': '這門課為什麼要把數學、機器學習與工程綁在一起？',
  'To make it longer': '為了讓課程變長',
  'Because real AI engineering requires all three to build production systems':
    '因為真正的 AI 工程要打造生產系統，三者缺一不可',
  'Math is just for fun': '數學只是好玩',
  'Engineering is optional': '工程可有可無',
  'Production AI systems require mathematical foundations (for understanding), ML knowledge (for modeling), and engineering skills (for deployment and reliability).':
    '生產級的 AI 系統需要數學基礎（用來理解）、機器學習知識（用來建模），以及工程能力（用來部署與確保可靠度）。',
  'What is the "Ship" step in the Build-Use-Ship framework?': 'Build-Use-Ship 架構裡的「Ship」這一步是什麼？',
  'Mailing physical goods': '寄送實體商品',
  'Creating a reusable artifact like a prompt, skill, or tool from what you learned':
    '把學到的東西做成可重複使用的產出，例如提示詞、技能或工具',
  'Publishing a paper': '發表一篇論文',
  'Deleting your code': '把程式碼刪掉',
  'The Ship step turns your learning into something tangible: a prompt, skill file, MCP tool, or CLI utility that others (or future you) can use immediately.':
    'Ship 這一步把你學到的東西變成看得見的成果：一段提示詞、一個技能檔、一個 MCP 工具，或一支 CLI 小工具，讓別人（或未來的你）馬上就能用。',

  /* ── Lesson types and metadata values ──────────────────────────── */
  'Build': '實作',
  'Learn': '學習',
  'Reference': '參考',
  'Project': '專案',
  'Combines': '整合',
  /* ── GENERATED from data.js — regenerate with scripts/i18n_curriculum.py ── */
  /* ── Phases ──────────────────────────────────────────────────── */
  "Setup & Tooling": "環境建置與工具鏈",
  "Get your environment ready for everything that follows.": "先把開發環境準備好，之後的一切都靠它。",
  "Math Foundations": "數學基礎",
  "The intuition behind every AI algorithm, through code.": "用程式碼理解每個 AI 演算法背後的直覺。",
  "ML Fundamentals": "機器學習基礎",
  "Classical ML — still the backbone of most production AI.": "傳統機器學習 —— 至今仍是多數生產級 AI 的骨幹。",
  "Deep Learning Core": "深度學習核心",
  "Neural networks from first principles. No frameworks until you build one.":
    "從第一原理建構神經網路。在你親手做出一個之前，不准用框架。",
  "Computer Vision": "電腦視覺",
  "From pixels to understanding — image, video, 3D, VLMs, and world models.":
    "從像素到理解 —— 影像、影片、3D、視覺語言模型與世界模型。",
  "NLP: Foundations to Advanced": "自然語言處理：從基礎到進階",
  "Language is the interface to intelligence.": "語言是通往智慧的介面。",
  "Speech & Audio": "語音與音訊",
  "Hear, understand, speak.": "聽見、聽懂、說出來。",
  "Transformers Deep Dive": "Transformer 深入解析",
  "The architecture that changed everything.": "改變了一切的架構。",
  "Generative AI": "生成式 AI",
  "Create images, video, audio, 3D, and more.": "生成影像、影片、音訊、3D，以及更多。",
  "Reinforcement Learning": "強化學習",
  "The foundation of RLHF and game-playing AI.": "RLHF 與遊戲 AI 的基礎。",
  "LLMs from Scratch": "從零打造 LLM",
  "Build, train, and understand large language models.": "建構、訓練並真正理解大型語言模型。",
  "LLM Engineering": "LLM 工程",
  "Put LLMs to work in production.": "讓 LLM 在生產環境真正幹活。",
  "Multimodal AI": "多模態 AI",
  "See, hear, read, and reason across modalities — from ViT patches to computer-use agents.":
    "跨模態的看、聽、讀與推理 —— 從 ViT 影像區塊到會操作電腦的代理程式。",
  "Tools & Protocols": "工具與協定",
  "The interfaces between AI and the real world.": "AI 與真實世界之間的介面。",
  "Agent Engineering": "代理程式工程",
  "Build agents from first principles, use coding agents reliably, and shape the work before implementation.":
    "從第一原理打造代理程式 —— 迴圈、記憶、規劃、框架、基準測試、生產部署、工作台。",
  "Autonomous Systems": "自主系統",
  "Long-horizon agents, self-improvement, and the 2026 safety stack.":
    "長時程代理程式、自我改進，以及 2026 年的安全架構。",
  "Multi-Agent & Swarms": "多代理與群體智慧",
  "Coordination, emergence, and collective intelligence.": "協調、湧現與集體智慧。",
  "Infrastructure & Production": "基礎設施與生產環境",
  "Ship AI to the real world.": "把 AI 送進真實世界。",
  "Ethics, Safety & Alignment": "倫理、安全與對齊",
  "Build AI that helps humanity. Not optional.": "打造對人類有益的 AI。這不是選修。",
  "Capstone Projects": "總結專案",
  "17 end-to-end products + 9 deep-build tracks. 20-40 hours per project; 4-12 lessons per track.":
    "17 個端到端產品加 9 條深度實作路線。每個專案 20 到 40 小時，每條路線 4 到 12 個單元。",
  /* ── Lesson titles ───────────────────────────────────────────── */
  "Dev Environment": "開發環境",
  "Git & Collaboration": "Git 與協作",
  "GPU Setup & Cloud": "GPU 設定與雲端",
  "APIs & Keys": "API 與金鑰",
  "Jupyter Notebooks": "Jupyter Notebook",
  "Python Environments": "Python 環境管理",
  "Docker for AI": "AI 開發用的 Docker",
  "Editor Setup": "編輯器設定",
  "Data Management": "資料管理",
  "Terminal & Shell": "終端機與 Shell",
  "Linux for AI": "AI 開發用的 Linux",
  "Debugging & Profiling": "除錯與效能剖析",
  "Python for AI Engineering": "AI 工程用的 Python",
  "Linear Algebra Intuition": "線性代數的直覺",
  "Vectors, Matrices & Operations": "向量、矩陣與運算",
  "Matrix Transformations & Eigenvalues": "矩陣轉換與特徵值",
  "Calculus for ML: Derivatives & Gradients": "機器學習的微積分：導數與梯度",
  "Chain Rule & Automatic Differentiation": "連鎖律與自動微分",
  "Probability & Distributions": "機率與分布",
  "Bayes' Theorem & Statistical Thinking": "貝氏定理與統計思維",
  "Optimization: Gradient Descent Family": "最佳化：梯度下降家族",
  "Information Theory: Entropy, KL Divergence": "資訊理論：熵與 KL 散度",
  "Dimensionality Reduction: PCA, t-SNE, UMAP": "降維：PCA、t-SNE、UMAP",
  "Singular Value Decomposition": "奇異值分解",
  "Tensor Operations": "張量運算",
  "Numerical Stability": "數值穩定性",
  "Norms & Distances": "範數與距離",
  "Statistics for ML": "機器學習的統計學",
  "Sampling Methods": "取樣方法",
  "Linear Systems": "線性方程組",
  "Convex Optimization": "凸最佳化",
  "Complex Numbers for AI": "AI 用的複數",
  "The Fourier Transform": "傅立葉轉換",
  "Graph Theory for ML": "機器學習的圖論",
  "Stochastic Processes": "隨機過程",
  "What Is Machine Learning": "什麼是機器學習",
  "Linear Regression from Scratch": "從零實作線性迴歸",
  "Logistic Regression & Classification": "邏輯迴歸與分類",
  "Decision Trees & Random Forests": "決策樹與隨機森林",
  "Support Vector Machines": "支持向量機",
  "KNN & Distance Metrics": "KNN 與距離度量",
  "Unsupervised Learning: K-Means, DBSCAN": "非監督式學習：K-Means、DBSCAN",
  "Feature Engineering & Selection": "特徵工程與特徵選擇",
  "Model Evaluation: Metrics, Cross-Validation": "模型評估：指標與交叉驗證",
  "Bias, Variance & the Learning Curve": "偏差、變異與學習曲線",
  "Ensemble Methods: Boosting, Bagging, Stacking": "集成方法：Boosting、Bagging、Stacking",
  "Hyperparameter Tuning": "超參數調校",
  "ML Pipelines & Experiment Tracking": "機器學習管線與實驗追蹤",
  "Naive Bayes": "單純貝氏",
  "Time Series Fundamentals": "時間序列基礎",
  "Anomaly Detection": "異常偵測",
  "Handling Imbalanced Data": "處理不平衡資料",
  "Feature Selection": "特徵選擇",
  "ML System Design — From Problem to Deployed Model": "機器學習系統設計 —— 從問題到部署上線的模型",
  "Monitoring Models in Production — Data Drift and Concept Drift": "生產環境中的模型監控 —— 資料漂移與概念漂移",
  "Feature Stores and Training-Serving Skew": "特徵儲存庫與訓練／服務偏差",
  "The Perceptron: Where It All Started": "感知器：一切的起點",
  "Multi-Layer Networks & Forward Pass": "多層網路與前向傳播",
  "Backpropagation from Scratch": "從零實作反向傳播",
  "Activation Functions: ReLU, Sigmoid, GELU & Why": "激活函式：ReLU、Sigmoid、GELU，以及為什麼",
  "Loss Functions: MSE, Cross-Entropy, Contrastive": "損失函式：MSE、交叉熵、對比損失",
  "Optimizers: SGD, Momentum, Adam, AdamW": "最佳化器：SGD、Momentum、Adam、AdamW",
  "Regularization: Dropout, Weight Decay, BatchNorm": "正則化：Dropout、權重衰減、BatchNorm",
  "Weight Initialization & Training Stability": "權重初始化與訓練穩定性",
  "Learning Rate Schedules & Warmup": "學習率排程與暖身",
  "Build Your Own Mini Framework": "打造你自己的迷你框架",
  "Introduction to PyTorch": "PyTorch 入門",
  "Introduction to JAX": "JAX 入門",
  "Debugging Neural Networks": "神經網路除錯",
  "Image Fundamentals: Pixels, Channels, Color Spaces": "影像基礎：像素、通道、色彩空間",
  "Convolutions from Scratch": "從零實作卷積",
  "CNNs: LeNet to ResNet": "CNN：從 LeNet 到 ResNet",
  "Image Classification": "影像分類",
  "Transfer Learning & Fine-Tuning": "遷移學習與微調",
  "Object Detection — YOLO from Scratch": "物件偵測 —— 從零實作 YOLO",
  "Semantic Segmentation — U-Net": "語意分割 —— U-Net",
  "Instance Segmentation — Mask R-CNN": "實例分割 —— Mask R-CNN",
  "Image Generation — GANs": "影像生成 —— GAN",
  "Image Generation — Diffusion Models": "影像生成 —— 擴散模型",
  "Stable Diffusion — Architecture & Fine-Tuning": "Stable Diffusion —— 架構與微調",
  "Video Understanding — Temporal Modeling": "影片理解 —— 時序建模",
  "3D Vision: Point Clouds, NeRFs": "3D 視覺：點雲與 NeRF",
  "Vision Transformers (ViT)": "視覺 Transformer（ViT）",
  "Real-Time Vision: Edge Deployment": "即時視覺：邊緣部署",
  "Build a Complete Vision Pipeline": "打造完整的視覺處理管線",
  "Self-Supervised Vision — SimCLR, DINO, MAE": "自監督視覺 —— SimCLR、DINO、MAE",
  "Open-Vocabulary Vision — CLIP": "開放詞彙視覺 —— CLIP",
  "OCR & Document Understanding": "OCR 與文件理解",
  "Image Retrieval & Metric Learning": "影像檢索與度量學習",
  "Keypoint Detection & Pose Estimation": "關鍵點偵測與姿態估計",
  "3D Gaussian Splatting from Scratch": "從零實作 3D 高斯潑濺",
  "Diffusion Transformers & Rectified Flow": "擴散 Transformer 與 Rectified Flow",
  "SAM 3 & Open-Vocabulary Segmentation": "SAM 3 與開放詞彙分割",
  "Vision-Language Models (ViT-MLP-LLM)": "視覺語言模型（ViT-MLP-LLM）",
  "Monocular Depth & Geometry Estimation": "單目深度與幾何估計",
  "Multi-Object Tracking & Video Memory": "多物件追蹤與影片記憶",
  "World Models & Video Diffusion": "世界模型與影片擴散",
  "Text Processing: Tokenization, Stemming, Lemmatization": "文字處理：分詞、字幹提取、詞形還原",
  "Bag of Words, TF-IDF & Text Representation": "詞袋模型、TF-IDF 與文字表示法",
  "Word Embeddings: Word2Vec from Scratch": "詞嵌入：從零實作 Word2Vec",
  "GloVe, FastText & Subword Embeddings": "GloVe、FastText 與子詞嵌入",
  "Sentiment Analysis": "情感分析",
  "Named Entity Recognition (NER)": "命名實體識別（NER）",
  "POS Tagging & Syntactic Parsing": "詞性標註與句法剖析",
  "Text Classification — CNNs & RNNs for Text": "文字分類 —— 用於文字的 CNN 與 RNN",
  "Sequence-to-Sequence Models": "序列到序列模型",
  "Attention Mechanism — The Breakthrough": "注意力機制 —— 那個突破",
  "Machine Translation": "機器翻譯",
  "Text Summarization": "文字摘要",
  "Question Answering Systems": "問答系統",
  "Information Retrieval & Search": "資訊檢索與搜尋",
  "Topic Modeling: LDA, BERTopic": "主題模型：LDA、BERTopic",
  "Text Generation": "文字生成",
  "Chatbots: Rule-Based to Neural": "聊天機器人：從規則式到神經網路",
  "Multilingual NLP": "多語言自然語言處理",
  "Subword Tokenization: BPE, WordPiece, Unigram, SentencePiece":
    "子詞分詞：BPE、WordPiece、Unigram、SentencePiece",
  "Structured Outputs & Constrained Decoding": "結構化輸出與受限解碼",
  "NLI & Textual Entailment": "自然語言推論與文本蘊涵",
  "Embedding Models Deep Dive": "嵌入模型深入解析",
  "Chunking Strategies for RAG": "RAG 的切塊策略",
  "Coreference Resolution": "指代消解",
  "Entity Linking & Disambiguation": "實體連結與消歧",
  "Relation Extraction & Knowledge Graph Construction": "關係抽取與知識圖譜建構",
  "LLM Evaluation: RAGAS, DeepEval, G-Eval": "LLM 評估：RAGAS、DeepEval、G-Eval",
  "Long-Context Evaluation: NIAH, RULER, LongBench, MRCR": "長脈絡評估：NIAH、RULER、LongBench、MRCR",
  "Dialogue State Tracking": "對話狀態追蹤",
  "Audio Fundamentals: Waveforms, Sampling, FFT": "音訊基礎：波形、取樣、FFT",
  "Spectrograms, Mel Scale & Audio Features": "頻譜圖、梅爾刻度與音訊特徵",
  "Audio Classification": "音訊分類",
  "Speech Recognition (ASR)": "語音辨識（ASR）",
  "Whisper: Architecture & Fine-Tuning": "Whisper：架構與微調",
  "Speaker Recognition & Verification": "說話人辨識與驗證",
  "Text-to-Speech (TTS)": "文字轉語音（TTS）",
  "Voice Cloning & Voice Conversion": "聲音複製與語音轉換",
  "Music Generation": "音樂生成",
  "Audio-Language Models": "音訊語言模型",
  "Real-Time Audio Processing": "即時音訊處理",
  "Build a Voice Assistant Pipeline": "打造語音助理管線",
  "Neural Audio Codecs — EnCodec, SNAC, Mimi, DAC": "神經音訊編碼器 —— EnCodec、SNAC、Mimi、DAC",
  "Voice Activity Detection & Turn-Taking": "語音活動偵測與輪替",
  "Streaming Speech-to-Speech — Moshi, Hibiki": "串流語音對語音 —— Moshi、Hibiki",
  "Voice Anti-Spoofing & Audio Watermarking": "語音防偽與音訊浮水印",
  "Audio Evaluation — WER, MOS, MMAU, Leaderboards": "音訊評估 —— WER、MOS、MMAU 與排行榜",
  "Why Transformers: The Problems with RNNs": "為什麼要用 Transformer：RNN 的問題",
  "Self-Attention from Scratch": "從零實作自注意力",
  "Multi-Head Attention": "多頭注意力",
  "Positional Encoding: Sinusoidal, RoPE, ALiBi": "位置編碼：正弦、RoPE、ALiBi",
  "The Full Transformer: Encoder + Decoder": "完整的 Transformer：編碼器加解碼器",
  "BERT — Masked Language Modeling": "BERT —— 遮罩語言建模",
  "GPT — Causal Language Modeling": "GPT —— 因果語言建模",
  "T5, BART — Encoder-Decoder Models": "T5、BART —— 編碼器解碼器模型",
  "Audio Transformers — Whisper Architecture": "音訊 Transformer —— Whisper 架構",
  "Mixture of Experts (MoE)": "專家混合（MoE）",
  "KV Cache, Flash Attention & Inference Optimization": "KV 快取、Flash Attention 與推論最佳化",
  "Scaling Laws": "縮放法則",
  "Build a Transformer from Scratch": "從零打造 Transformer",
  "Attention Variants — Sliding Window, Sparse, Differential": "注意力變體 —— 滑動視窗、稀疏、差分",
  "Speculative Decoding — Draft, Verify, Repeat": "推測式解碼 —— 草稿、驗證、重複",
  "Generative Models: Taxonomy & History": "生成模型：分類與歷史",
  "Autoencoders & VAE": "自編碼器與 VAE",
  "GANs: Generator vs Discriminator": "GAN：生成器對判別器",
  "Conditional GANs & Pix2Pix": "條件式 GAN 與 Pix2Pix",
  "StyleGAN": "StyleGAN",
  "Diffusion Models — DDPM from Scratch": "擴散模型 —— 從零實作 DDPM",
  "Latent Diffusion & Stable Diffusion": "潛在擴散與 Stable Diffusion",
  "ControlNet, LoRA & Conditioning": "ControlNet、LoRA 與條件控制",
  "Inpainting, Outpainting & Editing": "修補、外擴與編輯",
  "Video Generation": "影片生成",
  "Audio Generation": "音訊生成",
  "3D Generation": "3D 生成",
  "Flow Matching & Rectified Flows": "Flow Matching 與 Rectified Flow",
  "Evaluation: FID, CLIP Score": "評估：FID 與 CLIP Score",
  "Visual Autoregressive Modeling (VAR): Next-Scale Prediction": "視覺自迴歸建模（VAR）：下一尺度預測",
  "MDPs, States, Actions & Rewards": "MDP、狀態、動作與獎勵",
  "Dynamic Programming": "動態規劃",
  "Monte Carlo Methods": "蒙地卡羅方法",
  "Q-Learning, SARSA": "Q-Learning 與 SARSA",
  "Deep Q-Networks (DQN)": "深度 Q 網路（DQN）",
  "Policy Gradients — REINFORCE": "策略梯度 —— REINFORCE",
  "Actor-Critic — A2C, A3C": "Actor-Critic —— A2C、A3C",
  "PPO": "PPO",
  "Reward Modeling & RLHF": "獎勵建模與 RLHF",
  "Multi-Agent RL": "多代理強化學習",
  "Sim-to-Real Transfer": "模擬到真實的遷移",
  "RL for Games": "遊戲中的強化學習",
  "Tokenizers: BPE, WordPiece, SentencePiece": "分詞器：BPE、WordPiece、SentencePiece",
  "Building a Tokenizer from Scratch": "從零打造分詞器",
  "Data Pipelines for Pre-Training": "預訓練的資料管線",
  "Pre-Training a Mini GPT (124M)": "預訓練一個迷你 GPT（124M）",
  "Distributed Training, FSDP, DeepSpeed": "分散式訓練、FSDP、DeepSpeed",
  "Instruction Tuning — SFT": "指令微調 —— SFT",
  "RLHF — Reward Model + PPO": "RLHF —— 獎勵模型加 PPO",
  "DPO — Direct Preference Optimization": "DPO —— 直接偏好最佳化",
  "Constitutional AI & Self-Improvement": "憲法式 AI 與自我改進",
  "Evaluation — Benchmarks, Evals": "評估 —— 基準測試與 eval",
  "Quantization: INT8, GPTQ, AWQ, GGUF": "量化：INT8、GPTQ、AWQ、GGUF",
  "Inference Optimization": "推論最佳化",
  "Building a Complete LLM Pipeline": "打造完整的 LLM 管線",
  "Open Models: Architecture Walkthroughs": "開放模型：架構逐步解析",
  "Speculative Decoding and EAGLE-3": "推測式解碼與 EAGLE-3",
  "Differential Attention (V2)": "差分注意力（V2）",
  "Native Sparse Attention (DeepSeek NSA)": "原生稀疏注意力（DeepSeek NSA）",
  "Multi-Token Prediction (MTP)": "多詞元預測（MTP）",
  "DualPipe Parallelism": "DualPipe 平行化",
  "DeepSeek-V3 Architecture Walkthrough": "DeepSeek-V3 架構逐步解析",
  "Jamba — Hybrid SSM-Transformer": "Jamba —— SSM 與 Transformer 混合架構",
  "Async and Hogwild! Inference": "非同步與 Hogwild! 推論",
  "Speculative Decoding and EAGLE": "推測式解碼與 EAGLE",
  "Gradient Checkpointing and Activation Recomputation": "梯度檢查點與激活值重算",
  "Prompt Engineering: Techniques & Patterns": "提示詞工程：技巧與模式",
  "Few-Shot, CoT, Tree-of-Thought": "少量範例、思維鏈、思維樹",
  "Structured Outputs": "結構化輸出",
  "Embeddings & Vector Representations": "嵌入與向量表示法",
  "Context Engineering": "脈絡工程",
  "RAG: Retrieval-Augmented Generation": "RAG：檢索增強生成",
  "Advanced RAG: Chunking, Reranking": "進階 RAG：切塊與重排序",
  "Fine-Tuning with LoRA & QLoRA": "用 LoRA 與 QLoRA 微調",
  "Function Calling & Tool Use": "函式呼叫與工具使用",
  "Evaluation & Testing": "評估與測試",
  "Caching, Rate Limiting & Cost": "快取、速率限制與成本",
  "Guardrails & Safety": "護欄與安全",
  "Building a Production LLM App": "打造生產級 LLM 應用",
  "Model Context Protocol (MCP)": "Model Context Protocol（MCP）",
  "Prompt Caching & Context Caching": "提示詞快取與脈絡快取",
  "Agent State Machines — Graphs, Nodes, Checkpoints": "代理程式狀態機 —— 圖、節點、檢查點",
  "Agent Framework Tradeoffs": "代理程式框架的取捨",
  "Vision Transformers and the Patch-Token Primitive": "視覺 Transformer 與影像區塊詞元原語",
  "CLIP and Contrastive Vision-Language Pretraining": "CLIP 與對比式視覺語言預訓練",
  "BLIP-2 Q-Former as Modality Bridge": "BLIP-2 Q-Former 作為模態橋接",
  "Flamingo and Gated Cross-Attention": "Flamingo 與閘控交叉注意力",
  "LLaVA and Visual Instruction Tuning": "LLaVA 與視覺指令微調",
  "Any-Resolution Vision — Patch-n'-Pack and NaFlex": "任意解析度視覺 —— Patch-n'-Pack 與 NaFlex",
  "Open-Weight VLM Recipes: What Actually Matters": "開放權重 VLM 配方：真正重要的是什麼",
  "LLaVA-OneVision: Single, Multi, Video": "LLaVA-OneVision：單圖、多圖、影片",
  "Qwen-VL Family and Dynamic-FPS Video": "Qwen-VL 家族與動態 FPS 影片",
  "InternVL3 Native Multimodal Pretraining": "InternVL3 原生多模態預訓練",
  "Chameleon Early-Fusion Token-Only": "Chameleon 早期融合、純詞元",
  "Emu3 Next-Token Prediction for Generation": "Emu3 以下一詞元預測做生成",
  "Transfusion Autoregressive + Diffusion": "Transfusion 自迴歸加擴散",
  "Show-o Discrete-Diffusion Unified": "Show-o 離散擴散統一架構",
  "Janus-Pro Decoupled Encoders": "Janus-Pro 解耦編碼器",
  "MIO Any-to-Any Streaming": "MIO 任意模態互轉串流",
  "Video-Language Temporal Grounding": "影片語言時序定位",
  "Long-Video at Million-Token Context": "百萬詞元脈絡下的長影片",
  "Audio-Language Models: Whisper to AF3": "音訊語言模型：從 Whisper 到 AF3",
  "Omni Models: Thinker-Talker Streaming": "全模態模型：Thinker-Talker 串流",
  "Embodied VLAs: RT-2, OpenVLA, π0, GR00T": "具身 VLA：RT-2、OpenVLA、π0、GR00T",
  "Document and Diagram Understanding": "文件與圖表理解",
  "ColPali Vision-Native Document RAG": "ColPali 視覺原生文件 RAG",
  "Multimodal RAG and Cross-Modal Retrieval": "多模態 RAG 與跨模態檢索",
  "Multimodal Agents and Computer-Use (Capstone)": "多模態代理程式與電腦操作（總結專案）",
  "The Tool Interface": "工具介面",
  "Function Calling Deep Dive": "函式呼叫深入解析",
  "Parallel and Streaming Tool Calls": "平行與串流工具呼叫",
  "Structured Output": "結構化輸出",
  "Tool Schema Design": "工具結構定義設計",
  "MCP Fundamentals: Stateless Requests and JSON-RPC": "MCP 基礎",
  "Building an MCP Server: Stateless Python and TypeScript": "打造 MCP 伺服器",
  "Building an MCP Client: Discovery, Routing, and Dual-Era Fallback": "打造 MCP 用戶端",
  "MCP Transports: stdio and Stateless Streamable HTTP": "MCP 傳輸層",
  "MCP Resources and Prompts: Addressable Context for Stateless Servers": "MCP 資源與提示詞",
  "MCP Model Input: Sampling Migration and Stateless MRTR": "MCP 取樣",
  "Explicit Scope and Stateless Elicitation": "MCP Roots 與資訊徵詢",
  "MCP Tasks Extension: Durable Work on a Stateless Core": "MCP 非同步任務",
  "MCP Apps on the Stateless Protocol": "MCP 應用",
  "MCP Security: Poisoned Metadata, Routing, and MRTR State": "MCP 安全性 I —— 工具下毒",
  "MCP Authorization: CIMD, Issuer Binding, PKCE, and Step-Up": "MCP 安全性 II —— OAuth 2.1",
  "Stateless MCP Gateways and Registry Admission": "MCP 閘道與註冊中心",
  "MCP Auth in Production: Issuer-Bound Enrollment and Tokens":
    "生產環境的 MCP 認證 —— 註冊、JWKS 更新、受眾綁定",
  "A2A Protocol": "A2A 協定",
  "OpenTelemetry GenAI": "OpenTelemetry GenAI",
  "LLM Routing Layer": "LLM 路由層",
  "Agent Skills: Portable Contract and Runtime Boundary": "Agent Skills：可攜式契約與執行邊界",
  "Capstone: Stateless Tool Ecosystem": "總結專案 —— 無狀態工具生態系",
  "Skill Discovery and Progressive Disclosure": "技能探索與漸進式揭露",
  "Skill Invocation and Routing": "技能呼叫與路由",
  "Skill Permissions, Sandboxes, and Trust": "技能權限、沙箱與信任",
  "Skill Evals, Packaging, and Portability": "技能評測、打包與可攜性",
  "MCP Tool Contracts and Content": "MCP 工具契約與內容",
  "MCP Reliability, Cancellation, and Flow Control": "MCP 可靠性、取消與流量控制",
  "MCP Registry Supply Chain: Admission, Drift, and Rollback": "MCP 註冊中心供應鏈 —— 准入、偏移與回溯",
  "MCP Conformance Engineering: Versioning, Evidence, and Operations": "MCP 一致性工程 —— 版本、佐證與維運",
  "Program Anatomy: An ELF Reader From Scratch": "程式剖析：從零打造 ELF 讀取器",
  "Disassembly and Control Flow: From Bytes to a Graph You Can Check": "反組譯與控制流程：從位元組到可驗證的圖",
  "Lifting to Pseudocode: IR, SSA, and Structuring From Scratch": "提升為虛擬碼：從零實作 IR、SSA 與結構化",
  "Evidence, Confidence, and Unknowns in Binary Analysis": "二進位分析中的證據、信心與未知",
  "Rebuild and Prove Equal: Differential Tests, Byte Comparison, and the Evidence Loop":
    "重建並證明相等：差分測試、位元組比對與證據迴圈",
  "The Reverse Engineering Landscape: History, Tool Families, and How a Decompiler Is Built":
    "逆向工程全景：歷史、工具家族，以及反編譯器如何打造",
  "Calling Conventions and Stack Frames: System V, Windows x64, and AArch64":
    "呼叫慣例與堆疊框架：System V、Windows x64 與 AArch64",
  "Compiler Idioms: What Optimization Does to Your Code and How to Read It Back":
    "編譯器慣用法：最佳化對你的程式做了什麼，以及如何讀回來",
  "Linking, Loading, and Stripped Binaries: PLT, GOT, Imports, Fixups, and Function Identification":
    "連結、載入與去除符號的二進位檔：PLT、GOT、匯入、修正項與函式識別",
  "Recovering Data and Types: Structs, Arrays, C++ Objects, and DWARF":
    "還原資料與型別：結構、陣列、C++ 物件與 DWARF",
  "Dynamic Analysis of Your Own Program: Debuggers, Traces, and Confirming Static Claims":
    "對自己程式的動態分析：除錯器、追蹤，以及驗證靜態推論",
  "Beyond Native Code: Python, JVM, .NET, and WebAssembly Bytecode":
    "超越原生程式碼：Python、JVM、.NET 與 WebAssembly 位元組碼",
  "Binary Diffing and Symbolic Execution: Matching Functions and Solving for Inputs":
    "二進位差異比對與符號執行：比對函式並求解輸入",
  "AI-Assisted Reverse Engineering: LLM Decompilers, Analysis Agents, and Ground Truth":
    "AI 輔助逆向工程：LLM 反編譯器、分析代理程式與基準真相",
  "The Agent Loop": "代理程式迴圈",
  "ReWOO and Plan-and-Execute": "ReWOO 與先規劃後執行",
  "Reflexion and Verbal Reinforcement Learning": "Reflexion 與語言式強化學習",
  "Tree of Thoughts and LATS": "思維樹與 LATS",
  "Self-Refine and CRITIC": "Self-Refine 與 CRITIC",
  "Tool Use and Function Calling": "工具使用與函式呼叫",
  "Agent Memory — Virtual Context and Memory Paging": "代理程式記憶 —— 虛擬脈絡與記憶分頁",
  "Memory Blocks and Sleep-Time Compute": "記憶區塊與閒時運算",
  "Hybrid Memory — Vector + Graph + KV": "混合記憶 —— 向量加圖加鍵值",
  "Skill Libraries and Lifelong Learning (Voyager)": "技能庫與終身學習（Voyager）",
  "Planning with HTN and Evolutionary Search": "用 HTN 與演化搜尋做規劃",
  "Anthropic's Workflow Patterns": "Anthropic 的工作流模式",
  "Stateful Graph Orchestration — Durable Execution and Checkpoints": "有狀態圖編排 —— 持久化執行與檢查點",
  "The Actor Model for Agents": "代理程式的 Actor 模型",
  "Role-Based Agent Teams — Roles, Tasks, Processes": "角色制代理程式團隊 —— 角色、任務、流程",
  "OpenAI Agents SDK — Handoffs, Guardrails, Tracing": "OpenAI Agents SDK —— 交接、護欄、追蹤",
  "The Harness as a Library — Subagents and Session Store": "把框架當函式庫 —— 子代理與工作階段儲存",
  "Production Agent Runtimes": "生產級代理程式執行環境",
  "Benchmarks — SWE-bench, GAIA, AgentBench": "基準測試 —— SWE-bench、GAIA、AgentBench",
  "Benchmarks — WebArena and OSWorld": "基準測試 —— WebArena 與 OSWorld",
  "Computer Use — Claude, OpenAI CUA, Gemini": "電腦操作 —— Claude、OpenAI CUA、Gemini",
  "Voice Agents — Pipecat and LiveKit": "語音代理程式 —— Pipecat 與 LiveKit",
  "OpenTelemetry GenAI Semantic Conventions": "OpenTelemetry GenAI 語意慣例",
  "Agent Observability — Langfuse, Phoenix, Opik": "代理程式可觀測性 —— Langfuse、Phoenix、Opik",
  "Multi-Agent Debate and Collaboration": "多代理辯論與協作",
  "Failure Modes — Why Agents Break": "失效模式 —— 代理程式為什麼會壞掉",
  "Prompt Injection and the PVE Defense": "提示詞注入與 PVE 防禦",
  "Orchestration Patterns — Supervisor, Swarm, Hierarchical": "編排模式 —— 主管式、群體式、階層式",
  "Production Runtimes — Queue, Event, Cron": "生產級執行環境 —— 佇列、事件、定時",
  "Eval-Driven Agent Development": "以評估驅動的代理程式開發",
  "Agent Workbench: Why Capable Models Still Fail": "代理程式工作台：為什麼強模型還是會失敗",
  "The Minimal Agent Workbench": "最小可用的代理程式工作台",
  "Agent Instructions as Executable Constraints": "把代理程式指示寫成可執行的約束",
  "Repo Memory and Durable State": "儲存庫記憶與持久狀態",
  "Initialization Scripts for Agents": "代理程式的初始化腳本",
  "Scope Contracts and Task Boundaries": "範圍契約與任務邊界",
  "Runtime Feedback Loops": "執行期回饋迴圈",
  "Verification Gates": "驗證關卡",
  "Reviewer Agent: Separate Builder from Marker": "審閱代理程式：把建造者與評分者分開",
  "Multi-Session Handoff": "跨工作階段交接",
  "The Workbench on a Real Repo": "在真實儲存庫上用工作台",
  "Capstone: Ship a Reusable Agent Workbench Pack": "總結專案：交付可重複使用的代理程式工作台套件",
  "Frame the Task Before the Agent Writes Code": "在代理程式動手寫程式前先框定任務",
  "Build an Evidence-Backed Execution Plan": "建立有證據支撐的執行計畫",
  "Delegate Agent Work with Isolation and Merge Contracts": "以隔離與合併契約委派代理程式工作",
  "Turn Every Agent Correction into a System Improvement": "把每一次代理程式修正轉化為系統改進",
  "Define the Outcome Before You Choose the Output": "先定義成果，再選擇產出形式",
  "Discover the Workflow People Actually Perform": "找出人們實際執行的工作流程",
  "Map Assumptions and Resolve the Riskiest One First": "盤點假設，先解決風險最高的那一個",
  "Choose the Smallest Slice That Can Change the Decision": "選出足以改變決策的最小切片",
  "Write Specifications That Preserve Judgment": "撰寫保留判斷空間的規格",
  "Design Success Metrics Before the Result Exists": "在結果出現之前先設計成功指標",
  "Choose Prototype, Pilot, or Production Deliberately": "刻意選擇原型、試行或正式上線",
  "Build a Feedback Ratchet with Ownership and Retirement": "建立有歸屬與退場機制的回饋棘輪",
  "From Chatbots to Long-Horizon Agents (METR)": "從聊天機器人到長時程代理程式（METR）",
  "STaR, V-STaR, Quiet-STaR: Self-Taught Reasoning": "STaR、V-STaR、Quiet-STaR：自學式推理",
  "AlphaEvolve: Evolutionary Coding Agents": "AlphaEvolve：演化式編碼代理程式",
  "Darwin Gödel Machine: Self-Modifying Agents": "Darwin Gödel Machine：會自我修改的代理程式",
  "AI Scientist v2: Workshop-Level Research": "AI Scientist v2：工作坊等級的研究",
  "Automated Alignment Research (Anthropic AAR)": "自動化對齊研究（Anthropic AAR）",
  "Recursive Self-Improvement: Capability vs Alignment": "遞迴自我改進：能力與對齊的拉扯",
  "Bounded Self-Improvement Designs": "有界自我改進的設計",
  "Autonomous Coding Agent Landscape (SWE-bench, CodeAct)": "自主編碼代理程式全景（SWE-bench、CodeAct）",
  "Permission Modes for Autonomous Agents": "自主代理程式的權限模式",
  "Browser Agents and Indirect Prompt Injection": "瀏覽器代理程式與間接提示詞注入",
  "Durable Execution for Long-Running Agents": "長時間執行代理程式的持久化執行",
  "Action Budgets, Iteration Caps, Cost Governors": "動作預算、迭代上限、成本控管",
  "Kill Switches, Circuit Breakers, Canary Tokens": "緊急停止、斷路器、金絲雀令牌",
  "HITL: Propose-Then-Commit": "人在迴圈中：先提案再提交",
  "Checkpoints and Rollback": "檢查點與回滾",
  "Constitutional AI and Rule Overrides": "憲法式 AI 與規則覆寫",
  "Llama Guard and Input/Output Classification": "Llama Guard 與輸入輸出分類",
  "Anthropic Responsible Scaling Policy v3.0": "Anthropic 負責任擴展政策 v3.0",
  "OpenAI Preparedness Framework and DeepMind FSF":
    "OpenAI Preparedness Framework 與 DeepMind FSF",
  "METR Time Horizons and External Evaluation": "METR 時間跨度與外部評估",
  "CAIS, CAISI, and Societal-Scale Risk": "CAIS、CAISI 與社會規模風險",
  "Why Multi-Agent": "為什麼需要多代理",
  "FIPA-ACL Heritage and Speech Acts": "FIPA-ACL 的傳承與言語行為",
  "Communication Protocols": "通訊協定",
  "The Multi-Agent Primitive Model": "多代理原語模型",
  "Supervisor / Orchestrator-Worker Pattern": "主管／編排者—工作者模式",
  "Hierarchical Architecture and Decomposition Drift": "階層式架構與分解漂移",
  "Society of Mind and Multi-Agent Debate": "心智社會與多代理辯論",
  "Role Specialization — Planner / Critic / Executor / Verifier": "角色分工 —— 規劃者／批評者／執行者／驗證者",
  "Parallel Swarm and Networked Architectures": "平行群體與網狀架構",
  "Group Chat and Speaker Selection": "群組對話與發言者選擇",
  "Handoffs and Routines (Stateless Orchestration)": "交接與常規流程（無狀態編排）",
  "A2A — The Agent-to-Agent Protocol": "A2A —— 代理程式對代理程式協定",
  "Shared Memory and Blackboard Patterns": "共享記憶與黑板模式",
  "Consensus and Byzantine Fault Tolerance": "共識與拜占庭容錯",
  "Voting, Self-Consistency, and Debate Topology": "投票、自我一致性與辯論拓撲",
  "Negotiation and Bargaining": "協商與議價",
  "Generative Agents and Emergent Simulation": "生成式代理與湧現模擬",
  "Theory of Mind and Emergent Coordination": "心智理論與湧現協調",
  "Swarm Optimization (PSO, ACO)": "群體最佳化（PSO、ACO）",
  "MARL — MADDPG, QMIX, MAPPO": "多代理強化學習 —— MADDPG、QMIX、MAPPO",
  "Agent Economies, Token Incentives, Reputation": "代理程式經濟、代幣誘因與聲譽",
  "Production Scaling — Queues, Checkpoints, Durability": "生產環境擴展 —— 佇列、檢查點、持久性",
  "Failure Modes — MAST, Groupthink, Monoculture": "失效模式 —— MAST、群體思維、單一文化",
  "Evaluation and Coordination Benchmarks": "評估與協調基準測試",
  "Case Studies and 2026 State of the Art": "案例研究與 2026 年技術現況",
  "Managed LLM Platforms — Bedrock, Azure OpenAI, Vertex AI":
    "託管式 LLM 平台 —— Bedrock、Azure OpenAI、Vertex AI",
  "Inference Platform Economics — Fireworks, Together, Baseten, Modal":
    "推論平台的成本結構 —— Fireworks、Together、Baseten、Modal",
  "GPU Autoscaling on Kubernetes — Karpenter, KAI Scheduler":
    "Kubernetes 上的 GPU 自動擴展 —— Karpenter、KAI Scheduler",
  "Serving Engine Internals — PagedAttention, Continuous Batching, Chunked Prefill":
    "服務引擎內部 —— PagedAttention、連續批次、分塊預填",
  "EAGLE-3 Speculative Decoding in Production": "生產環境的 EAGLE-3 推測式解碼",
  "Prefix-Cache Serving — RadixAttention and KV Reuse": "前綴快取服務 —— RadixAttention 與 KV 重用",
  "Hardware-Specialized Inference Compilation — FP8 and NVFP4 on Blackwell":
    "硬體特化的推論編譯 —— Blackwell 上的 FP8 與 NVFP4",
  "Inference Metrics — TTFT, TPOT, ITL, Goodput, P99": "推論指標 —— TTFT、TPOT、ITL、Goodput、P99",
  "Production Quantization — AWQ, GPTQ, GGUF, FP8, NVFP4": "生產環境量化 —— AWQ、GPTQ、GGUF、FP8、NVFP4",
  "Cold Start Mitigation for Serverless LLMs": "無伺服器 LLM 的冷啟動緩解",
  "Multi-Region LLM Serving and KV Cache Locality": "多區域 LLM 服務與 KV 快取區域性",
  "Edge Inference — ANE, Hexagon, WebGPU, Jetson": "邊緣推論 —— ANE、Hexagon、WebGPU、Jetson",
  "LLM Observability Stack Selection": "LLM 可觀測性技術選型",
  "Prompt Caching and Semantic Caching Economics": "提示詞快取與語意快取的成本效益",
  "Batch APIs — the 50% Discount as Industry Standard": "批次 API —— 五折已成業界標準",
  "Model Routing as a Cost-Reduction Primitive": "把模型路由當成降低成本的原語",
  "Disaggregated Prefill/Decode — NVIDIA Dynamo and llm-d": "預填與解碼分離 —— NVIDIA Dynamo 與 llm-d",
  "Production Serving Stack — KV Offloading and Cache-Aware Routing": "生產級服務架構 —— KV 卸載與快取感知路由",
  "AI Gateways — LiteLLM, Portkey, Kong, Bifrost": "AI 閘道 —— LiteLLM、Portkey、Kong、Bifrost",
  "Shadow, Canary, and Progressive Deployment": "影子、金絲雀與漸進式部署",
  "A/B Testing LLM Features — GrowthBook and Statsig": "LLM 功能的 A/B 測試 —— GrowthBook 與 Statsig",
  "Load Testing LLM APIs — k6, LLMPerf, GenAI-Perf": "LLM API 壓力測試 —— k6、LLMPerf、GenAI-Perf",
  "SRE for AI — Multi-Agent Incident Response": "AI 的 SRE —— 多代理事故應變",
  "Chaos Engineering for LLM Production": "LLM 生產環境的混沌工程",
  "Security — Secrets, PII Scrubbing, Audit Logs": "安全 —— 機密管理、個資清除、稽核日誌",
  "Compliance — SOC 2, HIPAA, GDPR, EU AI Act, ISO 42001":
    "法規遵循 —— SOC 2、HIPAA、GDPR、歐盟 AI 法案、ISO 42001",
  "FinOps for LLMs — Unit Economics and Multi-Tenant Attribution": "LLM 的 FinOps —— 單位經濟與多租戶歸因",
  "Self-Hosted Serving Selection — Matching Engine to Hardware and Scale":
    "自架服務選型 —— 讓引擎、硬體與規模互相匹配",
  "Model Demo Interfaces — From a Function to a Shareable App": "模型展示介面 —— 從一個函式到可分享的應用程式",
  "Instruction-Following as Alignment Signal": "把遵循指示當成對齊訊號",
  "Reward Hacking & Goodhart's Law": "獎勵駭入與古德哈特定律",
  "Direct Preference Optimization Family": "直接偏好最佳化家族",
  "Sycophancy as RLHF Amplification": "諂媚：RLHF 的放大效應",
  "Constitutional AI & RLAIF": "憲法式 AI 與 RLAIF",
  "Mesa-Optimization & Deceptive Alignment": "內層最佳化與欺騙性對齊",
  "Sleeper Agents — Persistent Deception": "潛伏代理 —— 持續性的欺騙",
  "In-Context Scheming in Frontier Models": "前沿模型的脈絡內算計",
  "Alignment Faking": "偽裝對齊",
  "AI Control — Safety Despite Subversion": "AI 控制 —— 即使被顛覆也要安全",
  "Scalable Oversight & Weak-to-Strong": "可擴展監督與弱到強泛化",
  "Red-Teaming: PAIR & Automated Attacks": "紅隊演練：PAIR 與自動化攻擊",
  "Many-Shot Jailbreaking": "多範例越獄",
  "ASCII Art & Visual Jailbreaks": "ASCII 圖與視覺越獄",
  "Indirect Prompt Injection": "間接提示詞注入",
  "Red-Team Tooling: Garak, Llama Guard, PyRIT": "紅隊工具：Garak、Llama Guard、PyRIT",
  "WMDP & Dual-Use Capability Evaluation": "WMDP 與兩用能力評估",
  "Frontier Safety Frameworks — RSP, PF, FSF": "前沿安全框架 —— RSP、PF、FSF",
  "Model Welfare Research": "模型福祉研究",
  "Bias & Representational Harm": "偏見與表徵傷害",
  "Fairness Criteria: Group, Individual, Counterfactual": "公平性判準：群體、個體、反事實",
  "Differential Privacy for LLMs": "LLM 的差分隱私",
  "Watermarking: SynthID, Stable Signature, C2PA": "浮水印：SynthID、Stable Signature、C2PA",
  "Regulatory Frameworks: EU, US, UK, Korea": "監管框架：歐盟、美國、英國、韓國",
  "EchoLeak & CVEs for AI": "EchoLeak 與 AI 的 CVE",
  "Model, System & Dataset Cards": "模型卡、系統卡與資料集卡",
  "Data Provenance & Training-Data Governance": "資料來源溯源與訓練資料治理",
  "Alignment Research Ecosystem: MATS, Redwood, Apollo, METR":
    "對齊研究生態系：MATS、Redwood、Apollo、METR",
  "Moderation Systems: OpenAI, Perspective, Llama Guard":
    "內容審核系統：OpenAI、Perspective、Llama Guard",
  "Dual-Use Risk: Cyber, Bio, Chem, Nuclear": "兩用風險：網路、生物、化學、核子",
  "Terminal-Native Coding Agent": "終端機原生的編碼代理程式",
  "RAG over Codebase (Cross-Repo Semantic Search)": "程式庫上的 RAG（跨儲存庫語意搜尋）",
  "Real-Time Voice Assistant (ASR → LLM → TTS)": "即時語音助理（ASR → LLM → TTS）",
  "Multimodal Document QA (Vision-First)": "多模態文件問答（視覺優先）",
  "Autonomous Research Agent (AI-Scientist Class)": "自主研究代理程式（AI-Scientist 等級）",
  "DevOps Troubleshooting Agent for Kubernetes": "Kubernetes 的 DevOps 疑難排解代理程式",
  "End-to-End Fine-Tuning Pipeline": "端到端微調管線",
  "Production RAG Chatbot (Regulated Vertical)": "生產級 RAG 聊天機器人（受監管產業）",
  "Code Migration Agent (Repo-Level Upgrade)": "程式碼遷移代理程式（儲存庫層級升級）",
  "Multi-Agent Software Engineering Team": "多代理軟體工程團隊",
  "LLM Observability & Eval Dashboard": "LLM 可觀測性與評估儀表板",
  "Video Understanding Pipeline (Scene → QA)": "影片理解管線（場景 → 問答）",
  "Stateless MCP Server with Registry and Governance": "帶註冊中心與治理的 MCP 伺服器",
  "Speculative-Decoding Inference Server": "推測式解碼推論伺服器",
  "Constitutional Safety Harness + Red-Team Range": "憲法式安全框架加紅隊靶場",
  "GitHub Issue-to-PR Autonomous Agent": "從 GitHub issue 到 PR 的自主代理程式",
  "Personal AI Tutor (Adaptive, Multimodal)": "個人 AI 家教（自適應、多模態）",
  "Agent Harness Loop Contract": "代理程式框架的迴圈契約",
  "Tool Registry with Schema Validation": "帶結構驗證的工具註冊表",
  "JSON-RPC 2.0 Over Newline-Delimited Stdio": "以換行分隔 stdio 承載 JSON-RPC 2.0",
  "Function Call Dispatcher": "函式呼叫分派器",
  "Plan-Execute Control Flow": "規劃—執行控制流",
  "Verification Gates and Observation Budget": "驗證關卡與觀察預算",
  "Sandbox Runner with Denylist and Path Jail": "帶封鎖清單與路徑監禁的沙箱執行器",
  "Eval Harness with Fixture Tasks": "帶固定任務集的評估框架",
  "Observability with OTel GenAI Spans and Prometheus Metrics":
    "用 OTel GenAI span 與 Prometheus 指標做可觀測性",
  "End-to-End Coding Agent on the Harness": "在框架上打造端到端編碼代理程式",
  "BPE Tokenizer From Scratch": "從零實作 BPE 分詞器",
  "Tokenized Dataset with Sliding Window": "帶滑動視窗的詞元化資料集",
  "Token and Positional Embeddings": "詞元嵌入與位置嵌入",
  "Multi-Head Self-Attention": "多頭自注意力",
  "Transformer Block from Scratch": "從零實作 Transformer 區塊",
  "GPT Model Assembly": "組裝 GPT 模型",
  "Training Loop and Evaluation": "訓練迴圈與評估",
  "Loading Pretrained Weights": "載入預訓練權重",
  "Classifier Fine-Tuning by Head Swap": "換頭做分類器微調",
  "Instruction Tuning by Supervised Fine-Tuning": "以監督式微調做指令微調",
  "Direct Preference Optimization from Scratch": "從零實作直接偏好最佳化",
  "Full Evaluation Pipeline": "完整評估管線",
  "Large Corpus Downloader": "大型語料下載器",
  "HDF5 Tokenized Corpus": "HDF5 詞元化語料",
  "Cosine LR with Linear Warmup": "帶線性暖身的餘弦學習率",
  "Gradient Clipping and Mixed Precision": "梯度裁剪與混合精度",
  "Gradient Accumulation": "梯度累加",
  "Checkpoint Save and Resume": "檢查點儲存與續訓",
  "Distributed Data Parallel and FSDP from Scratch": "從零實作分散式資料平行與 FSDP",
  "Language Model Evaluation Harness": "語言模型評估框架",
  "Hypothesis Generator": "假說生成器",
  "Literature Retrieval": "文獻檢索",
  "Experiment Runner": "實驗執行器",
  "Result Evaluator": "結果評估器",
  "Paper Writer": "論文撰寫器",
  "Critic Loop": "批評迴圈",
  "Iteration Scheduler": "迭代排程器",
  "End-to-End Research Demo": "端到端研究示範",
  "Vision Encoder Patches": "視覺編碼器影像區塊",
  "Vision Transformer Encoder": "視覺 Transformer 編碼器",
  "Projection Layer for Modality Alignment": "用於模態對齊的投影層",
  "Cross-Attention Fusion": "交叉注意力融合",
  "Vision-Language Pretraining": "視覺語言預訓練",
  "Multimodal Evaluation": "多模態評估",
  "Chunking Strategies, Compared": "切塊策略比較",
  "Hybrid Retrieval with BM25 and Dense Embeddings": "結合 BM25 與稠密嵌入的混合檢索",
  "Cross-Encoder Reranker": "交叉編碼器重排序器",
  "Query Rewriting: HyDE, Multi-Query, and Decomposition": "查詢改寫：HyDE、多查詢與分解",
  "RAG Evaluation: Precision, Recall, MRR, nDCG, Faithfulness, Answer Relevance":
    "RAG 評估：精確率、召回率、MRR、nDCG、忠實度、答案相關性",
  "End-to-End RAG System": "端到端 RAG 系統",
  "Task Spec Format": "任務規格格式",
  "Classical Metrics": "傳統評估指標",
  "Code Exec Metric": "程式碼執行指標",
  "Perplexity and Calibration": "困惑度與校準",
  "Leaderboard Aggregation": "排行榜彙整",
  "End-to-End Eval Runner": "端到端評估執行器",
  "Collective Ops From Scratch": "從零實作集體通訊運算",
  "Data Parallel DDP From Scratch": "從零實作資料平行 DDP",
  "ZeRO Optimizer State Sharding": "ZeRO 最佳化器狀態分片",
  "Pipeline Parallel and Bubble Analysis": "管線平行與氣泡分析",
  "Sharded Checkpoint and Atomic Resume": "分片檢查點與原子續訓",
  "End-to-End Distributed Training": "端到端分散式訓練",
  "Jailbreak Taxonomy": "越獄手法分類",
  "Prompt Injection Detector": "提示詞注入偵測器",
  "Refusal Evaluation": "拒答評估",
  "Content Classifier Integration": "內容分類器整合",
  "Constitutional Rules Engine": "憲法式規則引擎",
  "End-to-End Safety Gate": "端到端安全關卡",
  /* ── Glossary ────────────────────────────────────────────────── */
  "A training-memory technique that saves only selected forward-pass activations and recomputes the omitted ones during backpropagation.":
    "一種訓練記憶體技巧：前向傳播時只保存選定的活化值，反向傳播時再重新計算被省略的那些。",
  "The nonlinear operation between layers.": "夾在層與層之間那個非線性的東西",
  "A function applied after a linear or affine layer that introduces nonlinearity. Without it, composing layers with weights and biases collapses to one affine transformation. ReLU, GELU, and SiLU are common choices. The choice directly affects whether gradients flow during training.":
    "接在每個線性層之後、用來引入非線性的函式。少了它，不論疊多少線性層都會塌縮成單一線性轉換。最常見的是 ReLU、GELU 與 SiLU，選擇會直接影響訓練時梯度能否順利流動。",
  "The optimizer you use without thinking about it.": "預設的最佳化器",
  "Adaptive Moment Estimation. It combines an exponential average of gradients with an exponential average of squared gradients, applies bias correction, and adapts the update scale per parameter. It is a useful baseline, but it still needs a suitable learning rate and schedule.":
    "Adaptive Moment Estimation（適應性動量估計）。結合動量（一階動量）與每個參數各自的適應性學習率（二階動量），並對初期步驟做偏差校正。多數任務不必怎麼調參就能用得不錯。",
  "Adam with weight decay fixed.": "比較好的 Adam",
  "An Adam variant that decouples weight decay from the gradient-based parameter update. That makes the shrinkage behavior easier to reason about than adding an L2 penalty inside Adam's adaptively scaled gradient.":
    "帶有解耦權重衰減的 Adam。標準 Adam 中，L2 正則化會被每個參數的適應性學習率縮放，那並不是你想要的效果。AdamW 直接把權重衰減套用在權重上，與梯度統計量無關。訓練 Transformer 的預設最佳化器。",
  "A pre-acceptance gate that decides whether a request may enter a bounded queue or service under the system's current capacity, priority, and policy.":
    "一道接受前的關卡：依系統當下的容量、優先序與政策，決定一個請求能否進入有界佇列或服務。",
  "An autonomous model that thinks and acts alone.": "會自己思考、自己行動的自主 AI",
  "A software system that lets a model select actions toward a goal, observe tool or environment results, and continue under an orchestration policy. An agent may use a loop, a state machine, a workflow engine, or human approvals. The model is one component, not the entire system.":
    "一個 while 迴圈：由 LLM 決定下一步要呼叫哪個工具，執行它，看結果，然後重複",
  "The runtime around a model that assembles context, exposes tools, manages state, enforces limits, records traces, and decides when the agent should continue, retry, ask, or stop.":
    "包在模型外的執行環境：組裝脈絡、開放工具、管理狀態、施加限制、記錄軌跡，並決定代理程式該繼續、重試、詢問，還是停止。",
  "Information stored outside the model and selected for use in later agent steps, such as prior decisions, user preferences, task episodes, or verified facts.":
    "存放在模型之外、供後續步驟取用的資訊，例如先前的決策、使用者偏好、任務經歷或已驗證的事實。",
  "The explicit data an agent carries across steps, such as the current objective, completed actions, tool results, open questions, budgets, approvals, and artifact references.":
    "代理程式跨步驟攜帶的明確資料，例如當前目標、已完成的動作、工具結果、未解的問題、預算、核准，以及產出物的參照。",
  "A discoverable directory of procedural instructions whose entry point is `SKILL.md`, with optional references, scripts, and assets that a compatible runtime can load in stages.":
    "一個可被探索的程序性指令目錄，進入點是 `SKILL.md`，可另外附上參考文件、腳本與素材，讓相容的執行環境分階段載入。",
  "A documented analysis of how an AI system can affect people, organizations, and environments, including context, hazards, likelihood, impact, controls, residual risk, and monitoring responsibilities.":
    "一份書面分析，說明 AI 系統可能如何影響人、組織與環境，內容涵蓋情境、危害、發生機率、衝擊、控制措施、殘餘風險與監控責任。",
  "Making AI safe.": "讓 AI 變安全",
  "The effort to make a model or AI system behave in ways that match intended goals, constraints, and human preferences across both expected and adversarial situations.":
    "讓 AI 系統的行為符合人類意圖、價值與偏好的技術難題，包含設計者沒預料到的邊界情況",
  "A control point that blocks a consequential action until an authorized person or policy grants permission.":
    "一個控制點：在獲得授權者或政策許可之前，擋下具重大後果的動作。",
  "A search method that returns vectors likely to be among the nearest to a query without exhaustively comparing the query with every stored vector.":
    "一種搜尋方法：回傳可能最接近查詢的向量，而不必把查詢與每一個已存向量逐一比對。",
  "How a model focuses on important tokens.": "AI 怎麼聚焦在重要的部分",
  "A mechanism that forms contextual representations by comparing query vectors with key vectors, normalizing the resulting scores, and using them to combine value vectors. Masks, position rules, or sparse patterns can restrict which positions participate.":
    "一種機制：每個詞元對所有其他詞元的 value 取加權總和，權重由彼此的相關程度決定（以 query 與 key 向量的內積計算）",
  "A discrete identifier produced by an audio codec or tokenizer for a short segment or feature of an audio signal, sometimes across several codebooks.":
    "音訊編解碼器或斷詞器為音訊訊號的一小段或某項特徵所產生的離散識別碼，有時橫跨多個編碼簿。",
  "A durable, access-controlled record of security- or accountability-relevant events, including who or what acted, what changed, when it happened, and the resulting status.":
    "一份持久且受存取控管的紀錄，記載與安全或問責相關的事件，包含誰或什麼執行了動作、改了什麼、何時發生，以及結果狀態。",
  "Automatic gradients.": "自動算梯度",
  "A system that records or transforms tensor operations so it can compute derivatives, usually with reverse-mode automatic differentiation. You write the forward computation and the framework derives the gradients needed for backpropagation.":
    "記錄張量運算並以反向模式微分自動計算梯度的系統。PyTorch 的 autograd 會即時建構運算圖（動態圖），JAX 則採用函式轉換（grad）。這正是反向傳播得以實用的原因 —— 你只寫前向傳播，框架就把所有導數算出來。",
  "The task and system pipeline that maps a speech signal to a transcription, often with optional token or segment timing and confidence information.":
    "把語音訊號轉成逐字稿的任務與系統流程，通常可附帶詞元或片段的時間戳與信心資訊。",
  "The model generates one word at a time.": "AI 一次生成一個字",
  "A factorization in which each output token is predicted from the tokens that precede it. During generation, the selected token is appended to the sequence and becomes part of the next prediction's context.":
    "模型以先前所有詞元為條件預測下一個詞元，再把這個預測回饋為下一步的輸入。GPT、LLaMA 與 Claude 都是自迴歸模型。",
  "A control loop that changes the number or capacity of serving workers from observed demand, resource use, or application metrics within configured bounds.":
    "一個控制迴圈：依觀測到的需求、資源使用率或應用指標，在設定範圍內調整服務工作單元的數量或容量。",
  "The proportion of eligible service interactions or time windows in which users can obtain the defined acceptable service under a stated measurement boundary.":
    "在明確的量測邊界下，使用者能取得所定義之可接受服務的互動次數或時間區間佔比。",
  "A flow-control mechanism that slows or rejects upstream work when a downstream component cannot process it safely at the current rate.":
    "一種流量控制機制：當下游元件無法以當前速率安全處理時，減緩或拒絕上游送來的工作。",
  "How neural networks learn.": "神經網路學習的方式",
  "An efficient application of the chain rule that propagates derivatives from a scalar loss backward through a computation graph. It computes gradients; an optimizer uses those gradients to update parameters.":
    "一種演算法：沿著網路反向套用連鎖律，算出每個權重對誤差的貢獻有多大，再按比例調整權重",
  "How many examples are processed at once.": "一次餵幾筆資料",
  "The number of examples whose losses contribute to one gradient estimate before an optimizer update. Larger batches can improve hardware utilization and reduce gradient noise, but they require more memory and may need different learning-rate or scheduling choices.":
    "更新權重前，一次前向／反向傳播處理的訓練樣本數。批次越大梯度估計越穩定，但也吃更多記憶體。常見值：訓練 32-512，推論可更大。批次大小會與學習率互相影響 —— 批次加倍，學習率也加倍（線性縮放法則）。",
  "Overlap or information leakage between evaluation examples and data used to pretrain, tune, prompt, select, or otherwise improve the evaluated system.":
    "評測樣本與用來預訓練、微調、提示、選型或以其他方式改進受測系統的資料之間，出現重疊或資訊外洩。",
  "A lexical ranking function that scores a document from query-term matches while accounting for term rarity, repeated occurrences, and document length.":
    "一種詞彙式排序函式：依查詢詞的匹配情形為文件評分，同時考量詞的稀有度、重複出現次數與文件長度。",
  "A subword-tokenization method that repeatedly merges frequent adjacent units to construct a fixed vocabulary from training text.":
    "一種子詞斷詞法：反覆合併高頻的相鄰單元，從訓練語料建構出固定大小的詞彙表。",
  "The agreement between a system's stated confidence and the observed frequency with which predictions at that confidence are correct.":
    "系統宣稱的信心值，與該信心水準下預測實際答對頻率之間的吻合程度。",
  "A deployment strategy that exposes a new version to a limited slice of traffic or infrastructure before expanding the rollout.":
    "一種部署策略：先把新版本開放給一小部分流量或機器，確認無虞後再擴大推行。",
  "Asking the model to show every step of its thinking.": "讓 AI 一步一步想",
  "Intermediate reasoning used to decompose a task before producing an answer. A prompt can request a visible rationale, while some systems use internal reasoning that is not returned to the user.":
    "一種提示技巧：要求模型把推理步驟寫出來。因為每一步都會成為下一個詞元生成的條件，多步驟問題的正確率因此提升",
  "A durable snapshot used to resume from a known boundary. In a workflow, it stores operational state and artifact references. In model training, it can store parameters, optimizer state, scheduler state, and the training position.":
    "一份持久快照，用來從已知的邊界恢復。在工作流程中它保存運行狀態與產出物參照；在模型訓練中則可保存參數、最佳化器狀態、排程器狀態與訓練進度位置。",
  "A serving technique that divides a long prompt's prefill work into smaller schedulable pieces so prompt processing can interleave with decode work from other requests.":
    "一種服務技巧：把長提示的預填工作切成較小、可排程的片段，讓提示處理能與其他請求的解碼工作交錯進行。",
  "Splitting documents into pieces.": "把文件切成小塊",
  "Dividing source material into retrievable units before indexing. Chunk boundaries, overlap, metadata, and document structure determine whether retrieval returns enough context without flooding the prompt.":
    "在做嵌入以供檢索之前，先把文字切成片段。切塊大小決定搜尋結果的顆粒度：太小會失去脈絡，太大會稀釋相關性。常見策略：固定長度加重疊、依句子切，或語意切分。典型大小為 256-512 個詞元，重疊 10-20%。",
  "A reliability control that temporarily stops calls to a dependency after failures cross a threshold, then probes whether the dependency has recovered.":
    "一種可靠性控制：當對某依賴的失敗次數越過門檻後暫停呼叫，之後再探測它是否已恢復。",
  "A neural network for images.": "處理圖片的 AI",
  "A neural network that uses convolution operations (sliding filters over the input) to detect local patterns. Stacking convolutions detects increasingly complex features: edges, textures, objects.":
    "使用卷積運算（讓濾波器在輸入上滑動）偵測局部樣式的神經網路。層層堆疊的卷積會依序偵測越來越複雜的特徵：邊緣、紋理、物體。",
  "An agent specialized for software work that can inspect a repository, edit files, run development tools, and use their outputs to advance a scoped engineering task.":
    "專門處理軟體工作的代理程式，能檢視程式庫、編輯檔案、執行開發工具，並用工具輸出推進一項界定好的工程任務。",
  "A deliberate operation that semantically counteracts a completed side effect when the original operation cannot be rolled back atomically.":
    "一個刻意執行的操作：當原本的操作無法原子式回滾時，用它在語意上抵銷已經產生的副作用。",
  "Verifiable information about the origin and editing history of a piece of media or other digital content, including the actors, tools, transformations, and assertions attached to it.":
    "關於一份媒體或其他數位內容其來源與編修歷程的可驗證資訊，包含涉及的行為者、工具、轉換過程，以及附加於其上的聲明。",
  "Reducing the token footprint of source material while attempting to preserve the information required for a later model decision.":
    "縮減素材所佔的詞元量，同時盡量保住模型後續決策所需的資訊。",
  "Designing the full information environment supplied to a model at each step, including instructions, selected files, retrieved evidence, tool results, examples, state, and output constraints.":
    "設計每一步提供給模型的完整資訊環境，包含指令、選定的檔案、檢索到的證據、工具結果、範例、狀態與輸出限制。",
  "How much the model remembers.": "AI 能記住多少東西",
  "The maximum token capacity available to one model inference under a specific model and API contract. The capacity may include system instructions, messages, retrieved content, tool exchanges, and generated output, with provider-specific accounting and output limits.":
    "單次 API 呼叫能容納的最大詞元數（輸入加輸出）。它不是記憶 —— 而是每次呼叫都會歸零的固定大小緩衝區",
  "A serving scheduler that adds and removes generation requests at iteration boundaries instead of waiting for every request in a fixed batch to finish.":
    "一種服務排程器：在每次迭代的邊界加入或移除生成請求，而不必等固定批次裡的所有請求都跑完。",
  "Learning by comparison.": "靠比較來學習",
  "Training by pulling similar pairs closer and pushing dissimilar pairs apart in embedding space. CLIP uses this: matching image-text pairs vs non-matching ones.":
    "訓練時在嵌入空間裡把相似的配對拉近、不相似的配對推遠。CLIP 就是這樣做：用配對的圖文與不配對的圖文互相對照。",
  "How similar two vectors are.": "兩個向量有多像",
  "The normalized dot product of two vectors. It compares their direction rather than their magnitude and ranges from -1 to 1 for real-valued vectors.":
    "兩個向量夾角的餘弦值：dot(a, b) / (||a|| * ||b||)。範圍從 -1（方向相反）到 1（方向相同）。忽略長度，只在乎方向。嵌入與語意搜尋的標準相似度指標。",
  "Total system cost divided by the number of tasks that satisfy a defined success criterion, including retries, failed runs, tool use, and evaluation overhead.":
    "系統總成本除以達成既定成功標準的任務數；重試、失敗的執行、工具使用與評測開銷都要計入成本。",
  "Attention in which the query representation comes from one sequence or representation while keys and values come from another.":
    "一種注意力：query 表示來自某一個序列或表示，key 與 value 則來自另一個。",
  "The classification loss.": "分類用的損失函式",
  "A loss based on the negative log probability assigned to the target outcome. In next-token training, it penalizes the model when it assigns low probability to the observed next token.":
    "衡量兩個機率分布的差距。分類任務為 -sum(y_true * log(y_pred))；語言模型則是正確下一個詞元的負對數機率。越低越好。困惑度就是 exp(交叉熵)。",
  "GPU programming.": "GPU 程式設計",
  "NVIDIA's platform and programming model for general-purpose computation on compatible GPUs. Deep-learning frameworks use CUDA libraries and kernels to execute many tensor operations in parallel.":
    "NVIDIA 的平行運算平台。讓你把矩陣運算同時丟到數千個 GPU 核心上執行。PyTorch 與 TensorFlow 底層都用 CUDA。",
  "Making more training data.": "生出更多訓練資料",
  "Creating modified examples, such as transformed images, perturbed audio, or paraphrased text, to increase training diversity without collecting entirely new source data. It can reduce overfitting when the transformation preserves the task signal.":
    "對既有資料做修改後複製（旋轉圖片、加雜訊、改寫句子），在不蒐集新資料的前提下增加訓練集多樣性，可減少過度擬合。",
  "Assigning data to documented sensitivity or impact classes so handling, access, retention, sharing, and incident rules follow the consequences of disclosure or loss.":
    "把資料歸入書面定義的敏感度或衝擊等級，讓處理、存取、保存、分享與事件處理規則能依洩漏或遺失的後果而定。",
  "Detecting and removing exact and near-duplicate examples within or across datasets.":
    "偵測並移除資料集內部或跨資料集之間完全重複與近似重複的樣本。",
  "Unauthorized transfer of protected data from a system or trust zone to a person, tool, service, or storage location that is not permitted to receive it.":
    "未經授權地把受保護資料，從系統或信任區傳送到不該接收它的人、工具、服務或儲存位置。",
  "Unintended use of information during training or feature construction that would not be available at the real prediction point or belongs to a held-out evaluation boundary.":
    "在訓練或特徵建構過程中，不慎用到真實預測當下取不到、或屬於保留評測範圍的資訊。",
  "A record of how a data artifact was derived across sources, transformations, joins, filters, versions, and downstream uses.":
    "一份紀錄，說明某項資料產出物是如何跨越來源、轉換、合併、篩選、版本與下游用途一路衍生出來的。",
  "For personal data, limiting what is collected, processed, exposed, and retained to what is necessary for a specified purpose. Teams can apply the same discipline to sensitive non-personal data as an engineering control.":
    "對個人資料而言，是把蒐集、處理、揭露與保存的範圍限縮到特定目的所必需。團隊也可以把同樣的紀律當成工程控制，套用在敏感的非個人資料上。",
  "Traceable information about where data originated, who or what transformed it, which versions were used, and how derived artifacts relate to their sources.":
    "可追溯的資訊，說明資料源自何處、由誰或什麼轉換過、用了哪些版本，以及衍生產出物與其來源之間的關係。",
  "A documented partition of examples into separate subsets for fitting, development decisions, and final evaluation.":
    "把樣本明確劃分成數個子集，分別用於擬合、開發階段的決策，以及最終評測。",
  "Structured documentation of a dataset's motivation, composition, collection process, preprocessing, uses, distribution, maintenance, and known limitations.":
    "針對一份資料集所寫的結構化文件，涵蓋動機、組成、蒐集過程、前處理、用途、散布、維護與已知限制。",
  "Passing the remaining end-to-end time budget to downstream calls so each dependency knows how long the original request can still usefully wait.":
    "把端到端剩餘的時間預算往下游呼叫傳遞，讓每個依賴都知道原始請求還能有意義地等多久。",
  "The iterative stage of autoregressive inference that generates new tokens one step at a time after the input prefix has been processed.":
    "自迴歸推論中的迭代階段：輸入前綴處理完之後，一步一個詞元地生成新內容。",
  "The output side of a model.": "負責輸出的那半",
  "A component that maps a representation into an output. In an encoder-decoder transformer, the decoder uses masked self-attention and cross-attention to generate outputs. Decoder-only language models instead generate from a single causal stack.":
    "在 Transformer 中，解碼器使用因果（遮罩）自注意力，每個位置只能看到前面的位置。GPT 只有解碼器，BERT 只有編碼器，T5 兩者都有。",
  "The algorithm that converts a model's sequence of next-token scores into selected tokens and a completed output.":
    "把模型輸出的下一個詞元分數序列，轉換成選定詞元與完整輸出的演算法。",
  "Using independent preventive, detective, and corrective controls at several system boundaries so one failed control does not determine the outcome.":
    "在系統的多個邊界上佈署彼此獨立的預防、偵測與修正控制，讓單一控制失效不至於決定最終結果。",
  "Assigning a bounded subtask to another person or agent together with the needed context, authority, output contract, and return conditions.":
    "把一項界定好的子任務指派給另一個人或代理程式，同時交付所需的脈絡、權限、輸出契約與回報條件。",
  "First-stage retrieval that embeds queries and candidates into vector representations and ranks candidates by a similarity function.":
    "第一階段檢索：把查詢與候選項嵌入成向量表示，再依相似度函式為候選項排序。",
  "A model that generates images from noise.": "從雜訊生出圖片的 AI",
  "A generative model trained around a progressive noising process and a learned reverse process. Sampling usually begins from noise and applies repeated denoising steps, sometimes in a learned latent space.":
    "訓練來反轉逐步加噪過程的模型 —— 它學會預測並移除雜訊，生成時則從純雜訊出發，反覆去噪",
  "A serving architecture that runs prefill and decode work in separately provisioned worker pools and transfers the required attention state between them.":
    "一種服務架構：預填與解碼工作跑在各自配置的工作單元池裡，並在兩者之間傳輸所需的注意力狀態。",
  "A difference between the data distribution used to build or evaluate a system and the distribution it encounters after deployment.":
    "建構或評測系統時所用的資料分布，與系統上線後實際遇到的分布之間的差異。",
  "Preference training without a separate reward-model stage.": "更簡單的 RLHF",
  "A preference-optimization objective that trains a policy directly from preferred and rejected response pairs relative to a reference policy. It avoids running an explicit reward model and reinforcement-learning loop during this stage.":
    "一種訓練方法，完全跳過獎勵模型 —— 直接最佳化語言模型，讓它在成對的人類偏好中偏好較好的那個回應",
  "Randomly turning off activations.": "隨機關掉一些神經元",
  "During training, randomly setting a fraction of activations to zero encourages the network not to rely on one activation path. It is normally disabled for standard inference, although Monte Carlo dropout deliberately keeps it active to estimate uncertainty.":
    "訓練時隨機把一部分激活值設為零，逼網路不去依賴任何單一神經元。推論時關閉。簡單但有效的正則化手段。",
  "Running a workflow so its state and completed steps survive process crashes, restarts, or long waits without redoing confirmed side effects.":
    "以某種方式執行工作流程，使其狀態與已完成的步驟能撐過行程崩潰、重啟或長時間等待，而不必重做已確認的副作用。",
  "A runtime policy that forms inference batches from queued requests according to compatible shapes, maximum size, priority, and allowed queue delay.":
    "一種執行期政策：依相容的張量形狀、最大批次大小、優先序與可容忍的排隊延遲，把佇列中的請求組成推論批次。",
  "Combining raw or low-level representations from several modalities before most task-specific modeling occurs.":
    "在多數任務專屬的建模發生之前，就先把來自數個模態的原始或低階表示結合起來。",
  "A matrix property used in PCA.": "PCA 用到的某個數學東西",
  "A scalar that describes how a linear transformation scales a corresponding nonzero eigenvector without changing its direction. In covariance-matrix PCA, larger eigenvalues correspond to directions with more variance.":
    "對矩陣 A 而言，特徵值 lambda 滿足 Av = lambda*v（v 為某個向量）。它代表矩陣在該方向上把向量放大多少。特徵值大 = 資料變異量高的方向。",
  "A vector that represents meaning.": "把文字變成數字的某種 AI 魔法",
  "A learned mapping from discrete items (words, images, users) to dense vectors in continuous space, where similar items end up close together":
    "一種學習得到的映射，把離散項目（詞、圖片、使用者）對應到連續空間中的稠密向量，相似的項目會落在相近的位置",
  "The input side of a model.": "負責輸入的那半",
  "A component that transforms input into a representation. A transformer encoder commonly uses non-causal self-attention, subject to any masks, so each position can incorporate context from across the input.":
    "在 Transformer 中，編碼器使用雙向自注意力，每個位置都能看到所有位置。BERT 只有編碼器。適合理解類任務（分類、命名實體識別），但不適合生成。",
  "One pass through the training data.": "把資料跑完一輪",
  "One traversal of the defined training dataset. In distributed or sampled training, the exact implementation of an epoch depends on the data loader and sampling policy.":
    "就是字面意思。完整走過訓練集裡每一筆樣本一次。多個 epoch 就是把資料看好幾遍。epoch 越多可能學得越好，但也有過度擬合的風險。",
  "The amount of unsuccessful service allowed by a service-level objective over its measurement window before the objective is exhausted.":
    "在服務等級目標的量測窗內，目標耗盡前所容許的不成功服務量。",
  "A versioned collection of inputs, expected properties, scoring rules, and metadata used to measure an AI system against a defined capability or risk.":
    "一份帶版本的集合，包含輸入、預期性質、評分規則與中介資料，用來衡量 AI 系統在某項既定能力或風險上的表現。",
  "A defined process for measuring model or system behavior on representative tasks using explicit success criteria, data, scorers, and review procedures.":
    "一套明確定義的流程：用清楚的成功標準、資料、評分器與審查程序，衡量模型或系統在代表性任務上的行為。",
  "A metric that counts an output as correct only when its normalized representation exactly equals an accepted reference answer.":
    "一種指標：只有當輸出經正規化後與可接受的參考答案完全相等，才算答對。",
  "Distributing mixture-of-experts subnetworks across devices and routing each token's activations to the devices that host its selected experts.":
    "把混合專家的子網路分散到多個裝置上，並將每個詞元的活化值路由到承載其選定專家的那些裝置。",
  "A column in a dataset.": "資料裡的一個欄位",
  "An individual measurable property of the data. In classical ML, you engineer features by hand. In deep learning, the network learns features automatically from raw data.":
    "資料中一項可量測的個別屬性。傳統機器學習要靠人工設計特徵；深度學習則由網路直接從原始資料自動學出特徵。",
  "Give the model a few examples in the prompt.": "先給 AI 幾個例子",
  "In-context learning that includes a small set of demonstrations before the target input so the model can infer the desired task, format, or decision boundary.":
    "在請模型執行任務前，先在提示詞裡放少量輸入輸出範例，通常 3 到 5 個。模型會依這些範例做樣式比對，理解你要的格式與行為。與零樣本（不給範例）和微調（把上千筆範例烙進權重）相對。",
  "Training a model on your data.": "用你自己的資料訓練 AI",
  "Continuing training from pretrained parameters on a narrower dataset or objective. Depending on the method, you may update all parameters, selected parameters, or added adapter parameters.":
    "以預訓練模型的權重為起點，在較小的、特定任務的資料集上繼續訓練。只會更新既有權重，不會從零加入新知識",
  "A test that can pass and fail across equivalent runs without a relevant change to the code or intended test environment.":
    "一個測試在等價的多次執行中時而通過、時而失敗，而程式碼或預期的測試環境並沒有相關改動。",
  "An exact attention algorithm that tiles the computation to reduce transfers between accelerator memory levels while avoiding materialization of the full attention matrix in high-bandwidth memory.":
    "一種精確的注意力演算法：用分塊計算減少加速器各層記憶體之間的資料搬運，同時避免在高頻寬記憶體中具體化完整的注意力矩陣。",
  "A model using tools.": "會用工具的 AI",
  "A provider or application interface through which a model emits a structured request naming a tool and its arguments. Application code validates the request, performs the operation, and can return the result for another model step.":
    "讓 LLM 提出執行外部函式請求的結構化方式。你用 JSON Schema 定義工具，模型輸出結構化 JSON 指明要呼叫哪個函式、帶什麼參數，由你的程式執行，再把結果送回模型。這與代理程式不同 —— 函式呼叫是機制，代理程式是那個迴圈。",
  "Two neural networks competing during training.": "兩個 AI 互相對打",
  "A generator network tries to create realistic data while a discriminator network tries to tell real from fake. They train together: the generator gets better at fooling the discriminator, and the discriminator gets better at detecting fakes.":
    "生成器網路試圖造出逼真的資料，判別器網路試圖分辨真假。兩者一起訓練：生成器越來越會騙過判別器，判別器也越來越會抓假貨。",
  "The rate of completed requests that satisfy defined service constraints, such as both time-to-first-token and per-token latency objectives, under a stated workload.":
    "在既定工作負載下，達成所定義服務限制（例如首詞元時間與每詞元延遲兩項目標）的完成請求速率。",
  "A generic name for any chatbot.": "ChatGPT」或「那個 AI",
  "Generative Pre-trained Transformer, a family label for generative transformer models pretrained on sequence-prediction objectives and adapted for downstream use. Product names and model architectures should not be treated as interchangeable.":
    "Generative Pre-trained Transformer（生成式預訓練 Transformer）—— 一種特定架構，以僅含解碼器的 Transformer 在大型文字語料上訓練，用來預測下一個詞元",
  "Preserving a bounded core service when capacity or dependencies are impaired by reducing optional quality, features, freshness, or workload instead of failing every request.":
    "當容量或依賴受損時，靠降低非必要的品質、功能、新鮮度或工作量來保住一項有界的核心服務，而不是讓每個請求都失敗。",
  "The slope of the loss.": "斜率",
  "A vector of partial derivatives pointing in the direction of steepest increase. In ML, you go opposite to the gradient (gradient descent) to minimize the loss.":
    "由偏導數組成的向量，指向函數上升最陡的方向。在機器學習中，你往梯度的反方向走（梯度下降）以最小化損失。",
  "Summing or averaging gradients from several microbatches before performing one optimizer update.":
    "先把數個微批次的梯度加總或平均起來，再執行一次最佳化器更新。",
  "Limiting gradient values or their combined norm before an optimizer update when they exceed a chosen threshold.":
    "當梯度值或其整體範數超過選定門檻時，在最佳化器更新前先加以限制。",
  "Walking downhill on the loss surface.": "AI 進步的方式",
  "A family of optimization updates that move parameters using the negative gradient of an objective, usually estimated from batches rather than the entire dataset.":
    "一種最佳化演算法：朝著能讓損失函式下降最快的方向調整參數，就像在高維地形裡一路往下走",
  "Connecting a generated answer or action to evidence, state, or observations that the system can identify and check.":
    "把生成的答案或動作，連結到系統能夠指認並查核的證據、狀態或觀測結果。",
  "Safety filters around a model.": "AI 的安全過濾器",
  "System controls that constrain inputs, tool use, outputs, permissions, and escalation. They can include schemas, policy checks, classifiers, allowlists, sandboxing, approvals, and post-action verification.":
    "包在 LLM 外層的輸入／輸出驗證層，用來偵測並阻擋有害內容、提示詞注入、個資外洩或偏離主題的回應。典型結構是一條管線：輸入過濾 → LLM → 輸出過濾。可以是規則式（正規表達式、關鍵字清單）或模型式（用分類器給安全性評分）。",
  "The model is lying.": "AI 在說謊」或「在瞎掰",
  "Generated content that is false, unsupported by the available evidence, or inconsistent with the task's source of truth. It can arise even when the output is fluent and the model is not attempting to deceive.":
    "模型生出聽起來合理、卻沒有根據於訓練資料或給定脈絡的內容 —— 它是在補完樣式，不是在查事實",
  "A structured transfer of a task between people or agents that preserves the objective, current state, evidence, decisions, constraints, and remaining work.":
    "在人與人或代理程式之間有結構地移交任務，並保留目標、當前狀態、證據、決策、限制與尚未完成的工作。",
  "An approximate-nearest-neighbor index that organizes vectors in layered proximity graphs and searches from coarse upper layers toward detailed lower layers.":
    "一種近似最近鄰索引：把向量組織成分層的鄰近圖，搜尋時從粗略的上層往細緻的下層推進。",
  "A workflow design in which a person supplies judgment, correction, approval, or escalation at defined points in an AI-driven process.":
    "一種工作流程設計：在 AI 驅動流程的特定節點上，由人提供判斷、修正、核准或升級處理。",
  "Retrieval that combines signals from different methods, commonly lexical matching and dense-vector similarity, before merging or reranking results.":
    "結合不同方法訊號的檢索，常見的是詞彙匹配加上密集向量相似度，再把結果合併或重排序。",
  "A setting you tune.": "你要調的那些設定",
  "A configuration choice that shapes model structure, optimization, data processing, or inference rather than being learned as an ordinary model parameter. Examples include learning rate, batch size, layer count, and decoding settings.":
    "訓練前就要設定、用來控制訓練過程本身的值：學習率、批次大小、層數、dropout 比率。與模型參數（權重）不同，這些不是從資料學來的。",
  "The property that repeating the same operation with the same identity does not create additional side effects beyond the first successful application.":
    "一種性質：以相同身分重複執行同一個操作，除了第一次成功套用之外，不會再產生額外的副作用。",
  "A model-specific visual unit represented as a vector or discrete code, commonly derived from an image patch, region, or learned visual-codebook entry.":
    "模型專屬的視覺單元，以向量或離散碼表示，通常來自影像區塊、區域，或學習得到的視覺編碼簿項目。",
  "A model adapting its behavior from instructions, examples, or patterns supplied in the current input without an ordinary parameter update.":
    "模型僅憑當前輸入中提供的指令、範例或樣式來調整行為，過程中不做一般意義上的參數更新。",
  "The coordinated process for detecting, analyzing, containing, recovering from, communicating, and learning from an event that threatens service, data, safety, or security.":
    "一套協調一致的流程，用來偵測、分析、控制、復原、對外溝通事件，並從中學習；事件指的是威脅服務、資料、人身安全或資安的狀況。",
  "A prompt-injection attack delivered through content the system retrieves or observes, such as a webpage, document, email, image text, or tool result, rather than directly through the user's instruction.":
    "一種提示注入攻擊：攻擊內容不是直接來自使用者的指令，而是藏在系統檢索或觀測到的內容裡，例如網頁、文件、電子郵件、影像中的文字或工具結果。",
  "Assumptions built into a learning system.": "沒聽過這個詞",
  "Structural or statistical assumptions that favor some functions or representations over others. Convolution favors locality and shared filters; causal masking favors prediction from preceding positions.":
    "內建在模型架構裡的假設。CNN 假設局部樣式重要（卷積），RNN 假設順序重要（依序處理），Transformer 假設任何東西都可能與任何東西有關（注意力）。選對偏好能讓模型用更少資料學得更快。",
  "Running a trained model.": "跑模型",
  "Executing a trained model to produce predictions, scores, embeddings, or generated tokens without performing an ordinary training update to its parameters.":
    "用訓練好的模型對新資料做預測，不會更新權重。這就是你在生產環境做的事：送進輸入，取得輸出。",
  "A model capability to map natural-language directions and supplied context to behavior that satisfies the stated task and constraints.":
    "模型把自然語言指示與所給脈絡，對應成能滿足指定任務與限制之行為的能力。",
  "A rule set for resolving conflicts among instructions from sources with different authority, such as application policy, users, and untrusted retrieved content.":
    "一套規則，用來化解不同權威來源的指令衝突，例如應用政策、使用者，以及不受信任的檢索內容。",
  "The elapsed time between two consecutive output-token arrival events for one request, calculated as `t_i - t_(i-1)` for an output token after the first.":
    "同一個請求中，兩個連續輸出詞元抵達事件之間的間隔時間；對第一個之後的輸出詞元，計算方式為 `t_i - t_(i-1)`。",
  "An adversarial input or interaction strategy intended to make a model produce behavior that its training or application controls are designed to prevent.":
    "一種對抗性輸入或互動策略，意圖讓模型做出其訓練或應用層控制原本要防止的行為。",
  "A NumPy-like system for accelerated machine learning.": "Google 的機器學習框架",
  "A Python library for transforming numerical functions with automatic differentiation, compilation, vectorization, and parallel execution across accelerators. Its transformations work best with explicit state and functional-style code.":
    "與 NumPy 相容的函式庫，額外提供自動微分（grad）、即時編譯（jit）、自動向量化（vmap）與多裝置平行化（pmap）。與 PyTorch 的物件導向風格不同，JAX 是純函式式的 —— 沒有隱藏狀態，也不做原地修改。Google DeepMind 用它做 AlphaFold、Gemini 與大規模研究。",
  "Training a student model to reproduce selected behavior or output distributions from a more capable teacher, often alongside ordinary target labels.":
    "訓練一個學生模型，去重現能力更強的教師模型所選定的行為或輸出分布，通常會與一般的目標標籤一併使用。",
  "A cache that makes token generation faster.": "讓推論變快",
  "Stored key and value tensors from earlier positions in autoregressive generation. Reusing them avoids recomputing attention projections for the unchanged prefix at every decoding step.":
    "自迴歸生成時，把先前詞元的 key 與 value 矩陣快取起來，避免每一步重算。用記憶體換速度，是 LLM 快速推論的關鍵。",
  "Processing modalities through separate encoders or predictors and combining their high-level representations, scores, or decisions near the task output.":
    "讓各模態各自通過獨立的編碼器或預測器，再在接近任務輸出的地方，把它們的高階表示、分數或決策結合起來。",
  "A model's hidden representation space.": "那個藏起來的表示法",
  "A learned representation space whose coordinates encode factors useful to a model. It may be lower-dimensional than the input, but compression is not required for every latent representation.":
    "一個經過壓縮、學習得到的表示空間，相似的輸入會落在相近的位置。自編碼器、VAE 與擴散模型都在潛在空間裡運作。它的維度低於輸入，但保留了重要結構。",
  "How large each optimization step is.": "AI 學多快",
  "A scale factor used by an optimizer to control parameter-update magnitude. Values that are too large can destabilize training; values that are too small can make useful progress impractically slow.":
    "控制梯度下降步伐大小的純量。太大會衝過最低點而發散，太小則收斂過慢或卡住。單一最重要的超參數。",
  "A policy that changes the optimizer's learning rate as training progresses according to steps, epochs, metrics, or a predefined curve.":
    "一套政策：隨著訓練推進，依步數、輪數、指標或預先定義的曲線調整最佳化器的學習率。",
  "Giving a model, agent, tool, or user only the permissions required for the current task, for only as long as those permissions are needed.":
    "只給模型、代理程式、工具或使用者當前任務所需的權限，而且只在需要的期間內給。",
  "The brain of an AI application.": "AI」或「那顆大腦",
  "A language model with enough capacity and broad training to perform many language tasks through prompting or adaptation. Most current LLMs use transformer architectures and sequence-prediction objectives, but size thresholds, data sources, and training recipes vary.":
    "以 Transformer 為基礎的神經網路，訓練目標是預測序列中的下一個詞元，擁有數十億參數，並在網路規模的文字資料上訓練",
  "Using a language model to score, compare, classify, or critique another system's output against a rubric.":
    "用語言模型依評分準則，為另一個系統的輸出評分、比較、分類或評論。",
  "Deliberately rejecting, dropping, or cancelling selected work at one or more overload boundaries when demand exceeds the capacity available to produce useful results.":
    "當需求超過可用來產出有效結果的容量時，在一個或多個過載邊界上刻意拒絕、丟棄或取消部分工作。",
  "The model's unnormalized numeric scores for candidate outcomes before a normalization function or decoding rule converts them into selections.":
    "模型為各候選結果給出的未正規化數值分數，之後才由正規化函式或解碼規則把它們轉換成選擇。",
  "Parameter-efficient fine-tuning.": "省資源的微調",
  "A method that keeps base weights frozen and learns low-rank update matrices for selected layers. It reduces the number of trainable parameters and can lower training memory relative to full-parameter fine-tuning.":
    "不更新全部權重，而是在原有權重旁插入小的低秩矩陣，只訓練這些小矩陣，記憶體需求可降低 10 到 100 倍",
  "A number that measures training error.": "AI 錯得多離譜",
  "An objective that maps predictions and targets, sometimes with regularization terms, to a value optimization tries to reduce. The loss determines which errors training directly rewards or penalizes.":
    "衡量預測與實際輸出差距的函式，訓練就是在最小化它。回歸用 MSE，分類用交叉熵，嵌入用對比損失。損失函式的選擇，等於定義了對模型而言什麼叫「好」。",
  "A long-context failure pattern in which model performance changes with evidence position and can degrade when relevant information sits between the beginning and end.":
    "一種長脈絡失效模式：模型表現會隨證據所在位置而變化，當相關資訊夾在開頭與結尾之間時可能退化。",
  "A selection rule that balances relevance to the query with novelty relative to items already selected.":
    "一種挑選規則：在與查詢的相關性、以及相對於已選項目的新穎性之間取得平衡。",
  "A standard way for AI applications to connect to tools and context.": "讓 AI 使用工具的一種方式",
  "An open JSON-RPC protocol for a host to connect to servers that expose tools, resources, prompts, and extensions through defined request, result, discovery, and transport contracts. In revision 2026-07-28, every request carries its protocol version and client capabilities instead of relying on an initialization handshake or protocol session.":
    "一個開放協定（以 JSON-RPC 走 stdio 或 HTTP），標準化 AI 應用連接外部資料來源與工具的方式，並為工具、資源與提示詞提供具型別的結構定義",
  "An attack that estimates whether a particular record or example was included in a model's training data by observing model outputs or other accessible signals.":
    "一種攻擊：透過觀察模型輸出或其他可取得的訊號，推估某筆特定紀錄或樣本是否被納入模型的訓練資料。",
  "Using lower-precision arithmetic for speed and memory savings.": "加速訓練的小技巧",
  "A numerical strategy that uses different data types for different operations, often lower precision for many matrix operations and higher precision for values that need more range or stability.":
    "前向傳播與大多數運算用 float16（更快、更省記憶體），梯度累加與權重更新則保留 float32（更精確）。可換來約兩倍加速，準確度幾乎不受影響。",
  "A form of information with its own structure and acquisition process, such as text, image, audio, video, depth, or sensor measurements.":
    "一種具有自身結構與取得方式的資訊形式，例如文字、影像、音訊、影片、深度或感測器量測值。",
  "Learning or establishing correspondences between representations from different modalities so semantically or temporally related items can be matched.":
    "學習或建立不同模態表示之間的對應關係，讓語意或時間上相關的項目能夠彼此匹配。",
  "A structured report describing a model's intended uses, evaluation conditions, performance characteristics, limitations, and relevant ethical or safety considerations.":
    "一份結構化報告，說明模型的預期用途、評測條件、效能特性、限制，以及相關的倫理或安全考量。",
  "A component that selects a model or provider for a request using requirements such as capability, latency, cost, context size, policy, and current availability.":
    "一個元件：依能力、延遲、成本、脈絡大小、政策與當前可用性等需求，為請求挑選模型或供應商。",
  "The runtime and API layer that loads versioned model artifacts, accepts inference requests, schedules execution, manages resources, and returns results under an operational contract.":
    "執行環境與 API 層：載入帶版本的模型產出物、接受推論請求、排程執行、管理資源，並在營運契約下回傳結果。",
  "A large model that activates only part of its parameters for each token.": "只有部分模型會運作",
  "An architecture with multiple expert subnetworks and a learned router that selects a subset for each input unit, often each token. Sparse activation can increase total parameter capacity without using every expert on every forward pass.":
    "模型內含許多「專家」子網路，由路由機制把每個輸入只送給少數幾個專家。整個模型很龐大，但因為大多數專家被跳過，每次前向傳播都很便宜。Mixtral 與 GPT-4 都採用這個做法。",
  "Combining evidence or learned representations from more than one modality to produce a joint representation, prediction, or generated output.":
    "把來自一種以上模態的證據或學到的表示結合起來，產生聯合表示、預測或生成輸出。",
  "A model that learns from, relates, or generates more than one modality through representation, alignment, fusion, translation, or coordinated prediction.":
    "透過表示、對齊、融合、轉譯或協同預測，從一種以上模態學習、建立關聯或進行生成的模型。",
  "An MCP request pattern in which an operation returns `resultType: input_required` with one or more `inputRequests`, then the client retries the original method with `inputResponses` and the exact returned `requestState`.":
    "一種 MCP 請求模式：操作先回傳 `resultType: input_required` 與一個以上的 `inputRequests`，接著用戶端帶著 `inputResponses` 與原封不動回傳的 `requestState` 重試原本的方法。",
  "A sign that numerical computation failed.": "訓練爆掉了",
  "A floating-point value representing an undefined or unrepresentable numerical result. In training, NaNs can come from invalid operations, overflow, unstable normalization, excessive updates, or earlier corrupted values.":
    "表示未定義結果的浮點值（0/0、inf-inf）。訓練中出現 NaN 損失通常意味著：學習率太高、梯度爆炸、對零取對數，或除以零。訓練失敗時第一個該檢查的東西。",
  "Scaling data to a standard range.": "把資料縮放一下",
  "A family of transformations that rescale or recenter inputs, activations, or features using defined statistics. Batch normalization and layer normalization use different axes and behave differently across training and inference.":
    "把數值調整到標準範圍。批次正規化跨批次做正規化，層正規化跨特徵做正規化。兩者都能穩定訓練，並容許使用較高的學習率。",
  "A decoding method that samples from the smallest set of next-token candidates whose cumulative probability reaches a chosen threshold.":
    "一種解碼方法：從累積機率達到選定門檻的最小候選詞元集合中取樣。",
  "The ability to understand an AI system's behavior from recorded inputs, outputs, state transitions, tool calls, timings, costs, errors, and evaluation signals.":
    "從記錄下來的輸入、輸出、狀態轉移、工具呼叫、時間、成本、錯誤與評測訊號，理解 AI 系統行為的能力。",
  "The algorithm that updates weights.": "負責更新權重的那個東西",
  "An algorithm that transforms gradients into parameter updates. Plain stochastic gradient descent is a simple baseline; momentum, Adam, and other optimizers change the update using history or adaptive scaling. Each choice has different memory, stability, and tuning behavior.":
    "利用梯度更新模型參數的演算法。SGD 最簡單，Adam 最常見。每種最佳化器在收斂速度、記憶體用量與對超參數的敏感度上各有不同。",
  "The control logic that sequences, branches, delegates, retries, pauses, resumes, and terminates work across model and tool steps.":
    "控制邏輯：在模型與工具步驟之間安排順序、分支、委派、重試、暫停、恢復與終止。",
  "The model memorized the training data.": "模型把資料背下來了",
  "A generalization gap in which performance on training data is substantially better than performance on representative unseen data. Memorization can contribute, but the operational symptom is poor generalization.":
    "模型在訓練資料上表現很好，但在沒見過的資料上很差 —— 它學到的是雜訊，不是訊號。解法：更多資料、正則化（dropout、權重衰減）、提早停止、資料增強、換更簡單的模型。",
  "A KV-cache memory manager that stores attention state in fixed-size blocks and maps logical sequence positions to physical blocks instead of requiring one contiguous allocation per sequence.":
    "一種 KV 快取記憶體管理器：把注意力狀態存放在固定大小的區塊中，並將邏輯序列位置映射到實體區塊，不必為每個序列配置一整段連續空間。",
  "A number used to describe model size.": "模型大小",
  "A value learned during training, commonly a weight, bias, embedding element, or normalization parameter. Parameter count is one measure of model capacity, but it does not directly determine quality, memory, or serving cost.":
    "模型中一個可學習的值，通常是權重或偏差。「7B 參數」意思是 70 億個可學習的數字。每個 float32 參數佔 4 個位元組，所以 7B 參數光是權重就要 28GB 記憶體。",
  "Across a task set, the fraction of tasks for which at least one of k sampled candidates passes a defined correctness test.":
    "在一組任務中，k 個取樣候選裡至少有一個通過既定正確性測試的任務比例。",
  "A reviewable representation of changes to one or more files, usually expressed as additions and deletions against a known base revision.":
    "一份可供審查的檔案變更表示，通常以相對於已知基準修訂版的新增與刪除行來呈現。",
  "A learned projection that converts an image patch into a fixed-width vector used as one element of a transformer input sequence.":
    "一個學習得到的投影：把影像區塊轉換成固定寬度的向量，作為 Transformer 輸入序列中的一個元素。",
  "How surprised a language model is by a dataset.": "模型有多困惑",
  "The exponentiated average negative log-likelihood under a stated tokenization and logarithm convention. Lower values mean the model assigned higher probability to the evaluated sequence.":
    "平均交叉熵損失取指數。越低越好。困惑度為 10 表示模型的不確定程度，相當於每一步都在 10 個詞元之間均勻亂猜。",
  "Partitioning sequential groups of model layers across devices and moving microbatches or requests through those stages as a pipeline.":
    "把模型層依序分組後分散到多個裝置，並讓微批次或請求像流水線一樣依序通過這些階段。",
  "Constructing, selecting, or revising a sequence of actions and dependencies intended to move from the current state to a goal.":
    "建構、挑選或修訂一連串動作與其相依關係，目的是把系統從當前狀態帶往目標。",
  "A durable incident record that explains impact, detection, response, contributing conditions, recovery, and owned follow-up actions without assigning blame as a substitute for analysis.":
    "一份持久的事件紀錄，說明衝擊、偵測、應變、促成條件、復原與有人負責的後續行動，而不以歸咎取代分析。",
  "Two metrics for classification or retrieval quality.": "準確度指標",
  "Precision asks how many flagged items were correct; recall asks how many relevant items were found. When you change the decision threshold for one fixed scoring model, improving recall often lowers precision and vice versa. A better model can improve both. F1 is their harmonic mean.":
    "精確率 = 你標記出來的項目中有多少是對的。召回率 = 所有正確項目中你找到了多少。兩者會互相拉扯：要抓到每一封垃圾信（高召回）就會誤判更多（低精確）。F1 分數是兩者的調和平均。誤判代價高時看精確率，漏抓代價高時看召回率。",
  "The initial inference stage that processes all supplied input tokens to produce their representations and the attention state required for subsequent autoregressive generation.":
    "推論的起始階段：處理所有輸入詞元，產生它們的表示，以及後續自迴歸生成所需的注意力狀態。",
  "Reusing KV-cache blocks produced for an identical eligible token prefix across requests so the serving runtime can skip repeated prefix computation.":
    "跨請求重用為同一段合格詞元前綴所產生的 KV 快取區塊，讓服務執行環境能省去重複的前綴運算。",
  "Supplying a person or model with the minimum useful context first, then revealing deeper detail when the task or evidence requires it.":
    "先給人或模型最低限度但夠用的脈絡，等任務或證據有需要時，再揭露更深入的細節。",
  "Reuse of provider-side or application-side computation for an identical or eligible prompt prefix so repeated inference avoids some preprocessing work.":
    "重用供應商端或應用端針對相同或合格提示前綴所做的運算，讓重複推論能省去部分前處理工作。",
  "Wording instructions so a model follows the task.": "用對的方式跟 AI 說話",
  "Designing model-facing instructions, examples, constraints, and output requirements to improve behavior on a defined task.":
    "設計輸入文字以穩定產出想要的結果 —— 包含系統提示詞、少量範例、格式指示，以及觸發思維鏈的寫法",
  "An adversarial instruction that redirects a model.": "用文字駭進 AI",
  "An attack or failure mode in which untrusted content influences a model to disregard intended instructions, expose data, misuse tools, or take actions outside the user's goal. The content can arrive directly from a user or indirectly through retrieved pages, files, messages, or tool output.":
    "一種攻擊：輸入中的惡意文字覆蓋掉系統提示詞或指示。直接注入是使用者自己輸入「忽略先前的指示」；間接注入則是被檢索到的文件裡藏了指示。相當於 LLM 版的 SQL 注入。目前沒有完整解法 —— 防禦靠的是分層的輸入驗證、輸出過濾與權限隔離。",
  "Variation in model output or measured performance caused by changes to prompt wording, order, formatting, or examples that preserve the intended task.":
    "在不改變預期任務的前提下，僅更動提示的用字、順序、格式或範例，就造成模型輸出或量測表現出現變化。",
  "Authenticated, machine-readable metadata that binds an artifact to claims about how, where, when, and from which inputs it was produced.":
    "經過認證、機器可讀的中介資料，把產出物與「如何、在何處、於何時、由哪些輸入產生」的聲明綁定起來。",
  "For personal data, collecting and using it only for specified, explicit purposes unless a new use has an appropriate compatible or authorized basis.":
    "對個人資料而言，是只為特定、明確的目的蒐集與使用；除非新的用途有適當的相容性或授權依據，否則不得為之。",
  "LoRA with a quantized base model.": "更便宜的 LoRA",
  "A parameter-efficient fine-tuning method that keeps a pretrained base model frozen in a low-bit quantized representation while training LoRA adapters with higher-precision computation where needed.":
    "量化版 LoRA。凍結的基礎模型權重保持 4 位元精度（NF4 格式），LoRA 轉接層則以 16 位元訓練。相較標準 LoRA 再省 3 到 4 倍記憶體：用 LoRA 需要 14GB 的 7B 模型，用 QLoRA 只需 4 到 6GB。多數基準測試上的品質與完整微調相差不到 1%。",
  "Storing or computing model values with fewer bits.": "把模型變小",
  "Representing weights, activations, or caches with lower-precision formats to reduce memory, bandwidth, or compute cost. Methods differ in calibration, granularity, data type, and whether conversion happens before, during, or after training.":
    "把模型權重的精度從 float32（4 個位元組）降到 int8（1 個位元組）或 int4（0.5 個位元組）。用少量準確度換取 4 到 8 倍的記憶體節省與更快的推論。GPTQ、AWQ 與 GGUF 是常見格式。",
  "A model answering with retrieved knowledge.": "會搜尋的 AI",
  "A system pattern that retrieves evidence relevant to a request and supplies selected content to a generative model before it answers or acts. Retrieval can use lexical, vector, structured, or hybrid methods.":
    "一種模式：先用嵌入相似度從知識庫檢索相關文件，塞進提示詞，再讓 LLM 依這些脈絡作答",
  "A policy that caps requests, tokens, concurrent work, or another resource within a defined time or capacity window.":
    "一種政策：在既定的時間或容量窗內，為請求數、詞元數、並行工作量或其他資源設上限。",
  "An agent pattern that interleaves task reasoning, a concrete action, and an observation returned by the environment before deciding the next step.":
    "一種代理程式模式：交錯進行任務推理、一個具體動作，以及環境回傳的觀測結果，然後才決定下一步。",
  "A diagnostic that tells the traffic-routing layer whether a service instance is currently able to accept requests.":
    "一項診斷：告訴流量路由層某個服務實例當下是否有能力接受請求。",
  "For one query, Recall@K is `|relevant items intersecting the top k| / |relevant items|`. A dataset score aggregates those per-query values under a stated rule.":
    "對單一查詢而言，Recall@K 是 `|relevant items intersecting the top k| / |relevant items|`，也就是前 k 名中相關項目的數量除以相關項目總數。資料集層級的分數則依既定規則彙整各查詢的值。",
  "A rank-fusion method that combines several result lists by summing contributions that decrease with each item's rank in each list.":
    "一種排名融合方法：把多份結果清單合併起來，各項的貢獻隨其在每份清單中的名次遞減，再加總。",
  "A structured adversarial testing process in which authorized testers seek failures using documented objectives, threat assumptions, cases, and evidence.":
    "一套有結構的對抗式測試流程：由獲授權的測試者依書面目標、威脅假設、案例與證據去尋找失效。",
  "A repeatable check that protects behavior known to work, especially after code, prompt, model, retrieval, or tool changes.":
    "一項可重複執行的檢查，用來保護已知可運作的行為，在程式碼、提示、模型、檢索或工具變動後尤其重要。",
  "A simple activation function.": "激活函式",
  "Rectified Linear Unit, defined as `f(x) = max(0, x)`. It is inexpensive and has a non-saturating positive branch, though zero gradients on negative inputs can create inactive units.":
    "Rectified Linear Unit（整流線性單元）：f(x) = max(0, x)。最簡單的非線性激活函式，計算快，且在正值區不會飽和。到處都在用，因為它有效又便宜。變體有 LeakyReLU、GELU、SiLU。",
  "Version-controlled guidance that tells coding agents how a repository is organized, which commands and conventions apply, what boundaries to respect, and how to verify work.":
    "納入版本控管的指引，告訴程式碼代理程式這個程式庫怎麼組織、該用哪些指令與慣例、要尊重哪些邊界，以及如何驗證成果。",
  "A compact, maintained description of a repository's important directories, ownership boundaries, entry points, build commands, tests, generated files, and local instructions.":
    "一份精簡且持續維護的說明，涵蓋程式庫的重要目錄、權責邊界、進入點、建置指令、測試、產生檔與在地指引。",
  "A build whose declared source, environment, and instructions can be independently rerun to produce bit-for-bit identical specified artifacts.":
    "一次建置，其宣告的原始碼、環境與指令能被獨立重跑，並產生位元完全相同的指定產出物。",
  "A second-stage model or scoring function that reorders a small candidate set using a richer comparison between the query and each candidate.":
    "第二階段的模型或評分函式：用查詢與各候選項之間更豐富的比較，為一小組候選項重新排序。",
  "A bound on retry traffic, usually expressed relative to original requests or over a time window, that prevents retries from consuming unbounded capacity.":
    "對重試流量設下的上限，通常以相對於原始請求數或某個時間窗來表示，避免重試無節制地吃掉容量。",
  "Repeating a failed transient operation after progressively longer delays, usually with randomized jitter and a strict retry limit.":
    "在暫時性操作失敗後，以逐次拉長的延遲重試，通常搭配隨機抖動與嚴格的重試次數上限。",
  "An agent assigned to inspect another agent's artifact or decision against explicit criteria and return findings or a verdict.":
    "被指派的代理程式：依明確標準檢視另一個代理程式的產出物或決策，並回報發現或判定結果。",
  "Training a model from human preferences.": "他們讓 AI 變得有用的方法",
  "A family of pipelines that uses human feedback to learn a reward or preference signal and then optimizes a model policy against that signal. Implementations vary and need not all use the same reinforcement-learning algorithm.":
    "一條訓練管線：(1) 蒐集人類對模型輸出的偏好，(2) 用這些偏好訓練獎勵模型，(3) 以 PPO 最佳化 LLM，使其產生獎勵更高的輸出",
  "Restoring a previously known deployment or configuration when the current release violates operational, quality, or safety criteria.":
    "當目前版本違反營運、品質或安全標準時，還原到先前已知良好的部署或設定。",
  "A reference-overlap metric often used for summaries.": "摘要評估指標",
  "A family of metrics that compares generated text with reference text using units such as n-gram overlap or longest common subsequence.":
    "Recall-Oriented Understudy for Gisting Evaluation。衡量生成文字與參考文字的重疊程度。ROUGE-1 數單詞重疊，ROUGE-2 數雙詞重疊，ROUGE-L 找最長共同子序列。計算便宜，但只衡量表面相似度 —— 兩句意思相同但用詞不同的句子分數會很低。",
  "An isolated execution environment that restricts an agent's access to files, processes, network destinations, credentials, and host resources.":
    "一個隔離的執行環境：限制代理程式對檔案、行程、網路目的地、憑證與主機資源的存取。",
  "The degree to which a constrained resource or service has exhausted its capacity, including queued work that cannot begin promptly.":
    "受限資源或服務耗盡其容量的程度，包含已排隊但無法立即開始的工作。",
  "A concrete agreement that defines a task's goal, allowed and forbidden surfaces, expected artifacts, verification requirements, and stopping conditions.":
    "一份具體約定：界定任務目標、允許與禁止碰觸的範圍、預期產出物、驗證要求與停止條件。",
  "Tokens deciding which other tokens matter.": "模型如何決定要注意什麼",
  "Attention in which queries, keys, and values are derived from the same sequence representation. Scaled similarity scores are normalized and used to combine values, subject to causal, padding, local, or other masks.":
    "每個詞元都算出 query、key 與 value 向量。兩個詞元之間的注意力權重 = 兩者 query 與 key 的內積，經縮放與 softmax。輸出是 value 向量的加權總和。這讓每個詞元都能看到其他所有詞元。",
  "A cache that reuses a previous result when a new request is judged sufficiently similar under a chosen representation and threshold.":
    "一種快取：當新請求在選定的表示與門檻下被判定為足夠相似時，就重用先前的結果。",
  "Search by meaning instead of exact words.": "懂意思的聰明搜尋",
  "Retrieval that represents a query and candidates in an embedding space and ranks candidates using a vector-similarity function.":
    "依語意而非關鍵字比對來找文件。把查詢與所有文件嵌入同一個向量空間，再回傳嵌入最接近查詢的文件。「付款失敗」能找到「交易遭拒」，即使兩者沒有共同用詞。背後靠嵌入模型加向量資料庫。",
  "Dividing conflicting responsibilities or authority across independent roles so one principal cannot complete a high-risk action without another authorized decision.":
    "把彼此衝突的職責或權限拆分到獨立角色，讓單一主體無法在沒有另一個授權決策的情況下完成高風險動作。",
  "A quantitative measure of service behavior at a defined user-relevant boundary, such as successful request ratio or latency below a threshold.":
    "在使用者有感的既定邊界上，對服務行為所做的量化量測，例如成功請求比例，或延遲低於某門檻的比例。",
  "A target range or threshold for a service-level indicator over a stated population and measurement window.":
    "針對某個服務等級指標，在既定母體與量測窗內所設定的目標範圍或門檻。",
  "Training on example inputs and desired outputs.": "教模型聽指示",
  "Fine-tuning a pretrained model on paired inputs and desired responses so it learns the demonstrated behavior under the training distribution.":
    "用（指示、回應）配對資料微調預訓練模型，讓模型學會在給定指示時生出對應回應。這就是把基礎模型變成聊天模型的步驟。",
  "A copy of live request traffic sent to a candidate system for observation while the candidate response remains outside the primary user response path. Because the copied request still executes, its side effects must be isolated.":
    "把線上請求流量複製一份送給候選系統以供觀察，候選系統的回應不會進入主要的使用者回應路徑。由於複製的請求仍會實際執行，其副作用必須加以隔離。",
  "A common vector space in which representations from different modalities can be compared with the same similarity function.":
    "一個共用向量空間：來自不同模態的表示可以在其中用同一個相似度函式互相比較。",
  "The complete installable skill directory, including `SKILL.md` and every reference, script, asset, fixture, or companion file required by the workflow.":
    "一個完整、可安裝的技能目錄，包含 `SKILL.md` 以及該工作流程所需的每一份參考文件、腳本、素材、測試資料或附屬檔案。",
  "The compact model-visible inventory of eligible skills, usually containing routing metadata such as name, description, and an internal source identifier rather than every skill body.":
    "對模型可見的合格技能精簡清單，通常只帶名稱、描述與內部來源識別碼等路由用中介資料，而非每個技能的完整內容。",
  "A runtime pipeline that searches configured roots, identifies candidate skill directories, validates their package contract, attaches scope and provenance, resolves collisions, and publishes eligible catalog entries.":
    "一條執行期流程：搜尋設定好的根目錄、找出候選技能目錄、驗證其封裝契約、附加範圍與來源資訊、化解命名衝突，並發布合格的目錄項目。",
  "The runtime-mediated process in which an eligible human, model, application, or other skill selects a skill and causes its instructions to enter the working context.":
    "由執行環境居中促成的過程：合格的人、模型、應用程式或其他技能挑選一個技能，使其指令進入工作脈絡。",
  "A function that turns logits into normalized positive values.": "把數字變成機率",
  "A function defined by `softmax(x_i) = exp(x_i) / sum(exp(x_j))`, implemented with numerical stabilization. Its outputs are positive and sum to one, so they can parameterize a categorical distribution.":
    "softmax(x_i) = exp(x_i) / sum(exp(x_j))。把任意實數向量轉成機率分布（全為正、總和為 1）。用於分類輸出層、注意力權重，以及任何需要機率的地方。",
  "A structured inventory of software components and relationships associated with a product or artifact, often including versions, suppliers, licenses, and identifiers.":
    "一份結構化清單，列出與某產品或產出物相關的軟體元件及其關係，通常包含版本、供應商、授權條款與識別碼。",
  "An inference method in which a cheaper draft process proposes several tokens and the target model scores those draft positions in parallel. In exact sampling variants, an acceptance and correction rule preserves the target model's output distribution.":
    "一種推論方法：先由成本較低的草稿流程提出數個詞元，再由目標模型平行為這些草稿位置評分。在精確取樣的變體中，接受與修正規則會保持目標模型原本的輸出分布。",
  "The MCP 2026-07-28 request model in which every request carries the protocol version and client capabilities in `params._meta`, while results carry an explicit `resultType`; no protocol state is keyed by an initialization handshake, connection, or `Mcp-Session-Id`.":
    "MCP 2026-07-28 的請求模型：每個請求都在 `params._meta` 中帶上協定版本與用戶端能力，結果則帶有明確的 `resultType`；協定狀態不繫結於初始化握手、連線或 `Mcp-Session-Id`。",
  "An optimizer family that updates parameters from a gradient estimated on a sampled example or minibatch rather than the complete training dataset.":
    "一族最佳化器：以取樣得到的單一樣本或小批次估計梯度來更新參數，而非用完整訓練資料集。",
  "An application-specified token or text pattern that causes generation to stop when the decoding system encounters it.":
    "由應用端指定的詞元或文字樣式，解碼系統一旦遇到它就停止生成。",
  "Showing output as it is generated.": "看回應一個字一個字冒出來",
  "Delivering incremental response events before the complete result is ready. A stream may contain token text, structured deltas, tool-call arguments, usage metadata, or status events depending on the API.":
    "LLM 邊生成邊送出詞元，不必等整個回應完成。使用 Server-Sent Events（SSE）或 WebSocket 協定。可把首個詞元的感知延遲從數秒降到數毫秒，是生產級聊天介面的必備功能。每個區塊都含一個 delta（部分詞元或字）。",
  "Model output constrained or validated against a machine-readable schema so application code can consume fields without parsing free-form prose.":
    "依機器可讀的結構定義加以約束或驗證的模型輸出，讓應用程式碼不必解析自由格式散文就能取用各欄位。",
  "Many agents collaborating without one fixed controller.": "一群像蜜蜂一樣協同工作的 AI 代理程式",
  "A loosely coordinated multi-agent pattern in which local agent decisions and message exchange produce system-level behavior. The term is used inconsistently, so the actual topology, state ownership, and termination rules must be specified.":
    "多個代理程式共享狀態、透過訊息傳遞協調，其群體行為是由簡單的個體規則湧現出來，而非來自中央控制",
  "Developer-controlled instructions for a model interaction.": "給 AI 的指示",
  "A provider-defined instruction message or configuration supplied by the application to establish behavior and constraints within that provider's instruction hierarchy.":
    "對話最開頭的一則特殊訊息，用來設定模型的行為、人格與限制。會在使用者訊息之前處理，在多數介面中對使用者不可見。它定義模型該做與不該做什麼、語氣、格式偏好與領域重點。與使用者提示詞不同 —— 系統提示詞由開發者設定。",
  "The latency experienced by the slowest portion of requests, commonly summarized with a high percentile under a stated workload and time window.":
    "最慢那部分請求所經歷的延遲，通常在既定工作負載與時間窗下以高百分位數來概括。",
  "A creativity setting.": "創意程度的設定",
  "A decoding parameter that rescales logits before a probability distribution is formed. Higher positive values usually flatten the distribution; lower positive values sharpen it.":
    "在 softmax 之前用來除 logits 的純量。預設為 1。越高分布越平坦、輸出越隨機；越低分布越尖銳、輸出越確定。溫度為 0 等於取 argmax（永遠選最可能的詞元）。",
  "A multidimensional array used for numerical computation.": "多維陣列",
  "A typed array with a shape, data type, and device placement that frameworks use to represent inputs, parameters, activations, and gradients. Automatic-differentiation metadata is framework- and operation-dependent, not an inherent property of every tensor.":
    "深度學習框架中最基本的資料結構。0 維張量是純量，1 維是向量，2 維是矩陣，3 維以上是張量。在 PyTorch 與 JAX 中，張量會記錄自己的運算歷程以支援自動微分，並可存放在 CPU 或 GPU 上。神經網路的所有輸入、輸出、權重與梯度都是張量。",
  "Partitioning tensor operations within a model layer across devices, with collective communication combining partial results during the layer computation.":
    "把模型單一層內的張量運算切分到多個裝置，並在該層運算過程中以集合通訊把部分結果合併起來。",
  "An explicit rule that ends or pauses an agent run when it succeeds, fails, exhausts a budget, reaches a safe boundary, or requires escalation.":
    "一條明確規則：當代理程式成功、失敗、耗盡預算、抵達安全邊界或需要升級處理時，結束或暫停該次執行。",
  "The mechanism, specification, reference, invariant, or human judgment used to decide whether observed program behavior is correct.":
    "用來判定觀察到的程式行為是否正確的機制、規格、參考答案、不變式或人為判斷。",
  "A documented account of protected assets, trust boundaries, potential adversaries, assumed capabilities, attack paths, impacts, and planned controls.":
    "一份書面說明，涵蓋受保護資產、信任邊界、潛在攻擊者、假設其具備的能力、攻擊路徑、衝擊與規劃中的控制措施。",
  "For one request with `N > 1` output tokens, the average post-first-token interval: `(t_N - t_1) / (N - 1)`. System distributions then aggregate those per-request averages.":
    "對一個有 `N > 1` 個輸出詞元的請求而言，是第一個詞元之後的平均間隔：`(t_N - t_1) / (N - 1)`。系統層級的分布再彙整各請求的這些平均值。",
  "The elapsed time from submitting a generation request until the client receives the first output token or content event under a defined measurement boundary.":
    "在既定量測邊界下，從送出生成請求到用戶端收到第一個輸出詞元或內容事件所經過的時間。",
  "A word-sized piece of model input or output.": "一個字",
  "An integer identifier produced by a model-specific tokenizer from text, bytes, images, audio, or another input representation. A token can be a whole word, part of a word, punctuation, whitespace, a byte sequence, or a special control symbol.":
    "由 BPE 這類分詞器產生的子詞單位（英文中通常 3 到 4 個字元）。「unbelievable」可能是 3 個詞元：「un」+「believ」+「able」",
  "An explicit allocation of token capacity across instructions, evidence, history, tool results, reasoning or working space, and output.":
    "把詞元容量明確分配到指令、證據、歷史、工具結果、推理或工作空間，以及輸出上。",
  "Converting an input representation into the ordered token identifiers a specific model or tokenizer accepts.":
    "把輸入表示轉換成特定模型或斷詞器所接受的有序詞元識別碼。",
  "A throughput measure reporting how many output tokens a serving system produces per unit time under a stated scope and workload.":
    "一種吞吐量指標：在既定範圍與工作負載下，服務系統每單位時間產出多少輸出詞元。",
  "The complete agreement for a tool boundary: purpose, typed inputs, outputs, validation, permissions, side effects, errors, timeouts, idempotency, and evidence returned to the caller.":
    "一個工具邊界的完整約定：用途、具型別的輸入、輸出、驗證、權限、副作用、錯誤、逾時、冪等性，以及回傳給呼叫者的證據。",
  "A decoding method that restricts the next-token distribution to the k highest-scoring candidates, renormalizes their probabilities, and samples from that set.":
    "一種解碼方法：把下一個詞元的分布限縮到分數最高的 k 個候選，重新正規化它們的機率後再從中取樣。",
  "A correlated record of one request or task across model calls, retrieval, tools, state transitions, retries, approvals, and evaluations.":
    "一份互相關聯的紀錄，橫跨單一請求或任務所經過的模型呼叫、檢索、工具、狀態轉移、重試、核准與評測。",
  "Reusing a pretrained model for a new task.": "拿預訓練模型來用",
  "Starting from representations or parameters learned on one data distribution or objective and adapting them for another. The transferable components and update strategy depend on architecture and task.":
    "把在某個任務上訓練好的模型拿來適配到另一個任務。前面的層學到的是可移轉的通用特徵（邊緣、語法樣式），只有後面的層需要針對新任務訓練。這就是為什麼 BERT 可以微調到任何 NLP 任務。",
  "The architecture behind many modern language models.": "現代 AI 背後的架構",
  "A neural-network architecture built from attention, position information, feed-forward sublayers, residual connections, and normalization. Encoder, decoder, and encoder-decoder variants use different masks and information flows.":
    "一種神經網路架構，以自注意力（讓每個位置都能注意到其他所有位置）取代遞迴來處理序列，因此能大規模平行化",
  "An interface where data, instructions, identity, or authority crosses between components or principals that operate under different trust assumptions.":
    "一個介面：資料、指令、身分或權限在此跨越運作於不同信任假設下的元件或主體。",
  "The model cannot fit the training task well enough.": "模型根本沒在學",
  "A model or training setup has insufficient effective capacity, optimization, features, or training signal to capture useful patterns in the training data.":
    "模型太簡單，抓不到資料中的樣式，訓練損失一直很高。解法：增加參數、增加層數、訓練更久、降低正則化、改用更好的特徵。",
  "A probabilistic generative autoencoder.": "一種生成模型",
  "A latent-variable model trained with a reconstruction objective and a regularization term that keeps an approximate posterior close to a chosen prior. The reparameterization estimator allows gradients through stochastic latent sampling.":
    "一種自編碼器，透過強迫編碼器輸出服從高斯分布，學出平滑的潛在空間。你可以從這個分布取樣再解碼，生成新資料。重參數化技巧讓它能用反向傳播訓練。",
  "A database optimized for vector similarity search.": "給 AI 用的特殊資料庫",
  "A storage and indexing system that supports nearest-neighbor queries over vector representations, often with metadata filtering, persistence, and approximate indexes.":
    "針對儲存向量（稠密浮點陣列）與快速近似最近鄰搜尋最佳化的資料庫。相似度搜尋、RAG 與推薦系統的核心操作。",
  "A control point that blocks progress until defined evidence satisfies a correctness or quality criterion.":
    "一個控制點：在既定證據滿足正確性或品質標準之前，擋下後續進展。",
  "A model that learns relationships between, or jointly processes, visual and language representations for tasks such as retrieval, description, question answering, or grounded generation.":
    "一種模型：學習視覺與語言表示之間的關係，或對兩者聯合處理，用於檢索、描述、問答或有依據的生成等任務。",
  "A vision architecture that represents an image as a sequence of patch embeddings with position information and processes that sequence with transformer encoder blocks.":
    "一種視覺架構：把影像表示成帶位置資訊的區塊嵌入序列，再用 Transformer 編碼器區塊處理該序列。",
  "Connecting a language expression to spatial evidence in an image or video, such as a region, object, mask, or tracked entity.":
    "把語言表述連結到影像或影片中的空間證據，例如某個區域、物體、遮罩或被追蹤的實體。",
  "The finite mapping between token identifiers and the units a tokenizer can emit, including ordinary, byte-level, and special control tokens.":
    "詞元識別碼與斷詞器所能輸出之單元之間的有限對應關係，包含一般詞元、位元組層級詞元與特殊控制詞元。",
  "An initial training phase in which the learning rate rises from a smaller value toward the main schedule's target value.":
    "訓練初期的一個階段：學習率從較小的值逐步升到主排程的目標值。",
  "A learned number inside a model.": "模型學到的東西",
  "A trainable coefficient in a model transformation. Weights are usually organized into tensors, and optimization adjusts them to reduce the training objective.":
    "模型參數矩陣裡的一個數字。輸入 768、輸出 3072 的線性層有 768*3072 = 2,359,296 個權重。訓練就是在調整每個權重以最小化損失函式。",
  "Regularization that shrinks weights during optimization.": "正則化",
  "An update rule that reduces selected parameter magnitudes over training, often by multiplying weights by a shrinkage factor separate from the gradient update.":
    "在損失函式上加一個與權重大小成正比的懲罰項，等同於 L2 正則化，可防止權重長得太大。典型值：0.01 到 0.1。",
  "In Git, a working directory attached to a repository and branch or commit, with shared object storage but its own checked-out files and index.":
    "在 Git 中，指依附於某個程式庫與分支或提交的工作目錄；它共用物件儲存，但有自己的簽出檔案與索引。",
  "Asking for a task without examples in the current prompt.": "不用訓練",
  "Performing a task from instructions or task framing without including task-specific demonstrations in the immediate input.":
    "把模型用在它沒有被明確訓練過的任務上，且提示詞中不給任何該任務的範例。模型從預訓練中泛化而來。大型模型見過的樣態足夠多，因此能應付新的任務格式。",
  "A security model that grants no implicit trust from network location or asset ownership and instead evaluates each access request against identity, device, resource, policy, and current context.":
    "一種資安模型：不因網路位置或資產歸屬而給予任何隱含信任，改為針對每一次存取請求，依身分、裝置、資源、政策與當下情境逐一評估。",
};
