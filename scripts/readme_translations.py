# -*- coding: utf-8 -*-
"""Hand-authored README translations, consumed by build_readme_i18n.py.

Keyed by the exact English block (whitespace-normalized). Inline markdown, code
spans, and links are preserved in the translations. The high-visibility landing
copy (hero pitch, section headings, closers) is translated; long technical
paragraphs stay in canonical English. Any block without an entry falls back to
English, so partial coverage is safe and this table can grow language by
language without breaking a build.

To add a language: add its code here and to the README language bar; run
    python3 scripts/build_readme_i18n.py
"""

# --- exact English block keys (must match build_readme_i18n.py normalization) ---
HERO1 = "**84% of students already use AI tools. Only 18% feel prepared to use them professionally.** This curriculum closes that gap."
HERO2 = "503 lessons. 20 phases. ~320 hours. Python, TypeScript, Rust, Julia. Every lesson ships a reusable artifact: a prompt, a skill, an agent, an MCP server. Free, open source, MIT."
HERO3 = "You don't just learn AI. You build it. End-to-end. By hand."
WAYS = "Three ways in. Pick one."
LICENSE_LINE = "MIT. Use it however you want — fork it, teach it, sell it, ship it. Attribution appreciated, not required."
MAINTAINED = "Maintained by [Rohit Ghumare](https://github.com/rohitg00) and the community."

H_HOW = "How this works"
H_CURR = "The shape of the curriculum"
H_LESSON = "The shape of a lesson"
H_START = "Getting started"
H_PREREQ = "Prerequisites"
H_BOOK = "Read it as a book"
H_SHIPS = "Every lesson ships something"
H_CONTENTS = "Contents"
H_TOOLKIT = "The toolkit"
H_WHERE = "Where to start"
H_WHY = "Why this matters now"
H_CONTRIB = "Contributing"
H_SPONSOR = "Sponsor the work"
H_STAR = "Star history"
H_LICENSE = "License"

README_NOTE = {
    "es": '<p align="center"><sub>Traducción de la comunidad. El <a href="../../README.md">inglés es la versión canónica</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "fr": '<p align="center"><sub>Traduction communautaire. L\'<a href="../../README.md">anglais fait foi</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "pt": '<p align="center"><sub>Tradução da comunidade. O <a href="../../README.md">inglês é a versão canônica</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "de": '<p align="center"><sub>Community-Übersetzung. Maßgeblich ist das <a href="../../README.md">englische Original</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "it": '<p align="center"><sub>Traduzione della community. Fa fede la <a href="../../README.md">versione inglese</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "zh": '<p align="center"><sub>社区翻译，以<a href="../../README.md">英文原文为准</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "ja": '<p align="center"><sub>コミュニティによる翻訳です。正文は<a href="../../README.md">英語版</a>です · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "ko": '<p align="center"><sub>커뮤니티 번역입니다. 정본은 <a href="../../README.md">영어판</a>입니다 · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "hi": '<p align="center"><sub>सामुदायिक अनुवाद। <a href="../../README.md">अंग्रेज़ी संस्करण ही प्रामाणिक है</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "ar": '<p align="center" dir="rtl"><sub>ترجمة مجتمعية. النسخة <a href="../../README.md">الإنجليزية هي المرجعية</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "ru": '<p align="center"><sub>Перевод сообщества. Каноничной является <a href="../../README.md">английская версия</a> · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
    "tr": '<p align="center"><sub>Topluluk çevirisi. Esas alınan sürüm <a href="../../README.md">İngilizce</a>dir · <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a></sub></p>',
}

TRANSLATIONS = {
    "es": {
        HERO1: "**El 84 % de los estudiantes ya usa herramientas de IA. Solo el 18 % se siente preparado para usarlas de forma profesional.** Este plan de estudios cierra esa brecha.",
        HERO2: "503 lecciones. 20 fases. ~320 horas. Python, TypeScript, Rust, Julia. Cada lección entrega un artefacto reutilizable: un prompt, una skill, un agente, un servidor MCP. Gratis, código abierto, MIT.",
        HERO3: "No solo aprendes IA. La construyes. De principio a fin. A mano.",
        WAYS: "Tres formas de empezar. Elige una.",
        LICENSE_LINE: "MIT. Úsalo como quieras: bifúrcalo, enséñalo, véndelo, publícalo. La atribución se agradece, pero no es obligatoria.",
        MAINTAINED: "Mantenido por [Rohit Ghumare](https://github.com/rohitg00) y la comunidad.",
        H_HOW: "Cómo funciona", H_CURR: "La forma del plan de estudios", H_LESSON: "La forma de una lección",
        H_START: "Primeros pasos", H_PREREQ: "Requisitos previos", H_BOOK: "Léelo como un libro",
        H_SHIPS: "Cada lección entrega algo", H_CONTENTS: "Contenido", H_TOOLKIT: "El kit de herramientas",
        H_WHERE: "Por dónde empezar", H_WHY: "Por qué esto importa ahora", H_CONTRIB: "Cómo contribuir",
        H_SPONSOR: "Patrocina el proyecto", H_STAR: "Historial de estrellas", H_LICENSE: "Licencia",
    },
    "fr": {
        HERO1: "**84 % des étudiants utilisent déjà des outils d'IA. Seuls 18 % se sentent prêts à les utiliser de façon professionnelle.** Ce cursus comble cet écart.",
        HERO2: "503 leçons. 20 phases. ~320 heures. Python, TypeScript, Rust, Julia. Chaque leçon livre un artefact réutilisable : un prompt, une skill, un agent, un serveur MCP. Gratuit, open source, MIT.",
        HERO3: "Vous n'apprenez pas seulement l'IA. Vous la construisez. De bout en bout. À la main.",
        WAYS: "Trois façons de commencer. Choisissez-en une.",
        LICENSE_LINE: "MIT. Utilisez-le comme vous voulez : forkez-le, enseignez-le, vendez-le, publiez-le. L'attribution est appréciée, mais pas obligatoire.",
        MAINTAINED: "Maintenu par [Rohit Ghumare](https://github.com/rohitg00) et la communauté.",
        H_HOW: "Comment ça marche", H_CURR: "La forme du cursus", H_LESSON: "La forme d'une leçon",
        H_START: "Pour commencer", H_PREREQ: "Prérequis", H_BOOK: "Lisez-le comme un livre",
        H_SHIPS: "Chaque leçon produit quelque chose", H_CONTENTS: "Sommaire", H_TOOLKIT: "La boîte à outils",
        H_WHERE: "Par où commencer", H_WHY: "Pourquoi c'est important maintenant", H_CONTRIB: "Contribuer",
        H_SPONSOR: "Soutenir le projet", H_STAR: "Historique des étoiles", H_LICENSE: "Licence",
    },
    "pt": {
        HERO1: "**84% dos estudantes já usam ferramentas de IA. Apenas 18% se sentem preparados para usá-las profissionalmente.** Este currículo fecha essa lacuna.",
        HERO2: "503 lições. 20 fases. ~320 horas. Python, TypeScript, Rust, Julia. Cada lição entrega um artefato reutilizável: um prompt, uma skill, um agente, um servidor MCP. Grátis, código aberto, MIT.",
        HERO3: "Você não apenas aprende IA. Você a constrói. Do início ao fim. À mão.",
        WAYS: "Três formas de começar. Escolha uma.",
        LICENSE_LINE: "MIT. Use como quiser: faça fork, ensine, venda, publique. A atribuição é bem-vinda, mas não obrigatória.",
        MAINTAINED: "Mantido por [Rohit Ghumare](https://github.com/rohitg00) e pela comunidade.",
        H_HOW: "Como funciona", H_CURR: "O formato do currículo", H_LESSON: "O formato de uma lição",
        H_START: "Primeiros passos", H_PREREQ: "Pré-requisitos", H_BOOK: "Leia como um livro",
        H_SHIPS: "Cada lição entrega algo", H_CONTENTS: "Conteúdo", H_TOOLKIT: "O kit de ferramentas",
        H_WHERE: "Por onde começar", H_WHY: "Por que isso importa agora", H_CONTRIB: "Como contribuir",
        H_SPONSOR: "Patrocine o trabalho", H_STAR: "Histórico de estrelas", H_LICENSE: "Licença",
    },
    "de": {
        HERO1: "**84 % der Studierenden nutzen bereits KI-Tools. Nur 18 % fühlen sich bereit, sie professionell einzusetzen.** Dieser Lehrplan schließt diese Lücke.",
        HERO2: "503 Lektionen. 20 Phasen. ~320 Stunden. Python, TypeScript, Rust, Julia. Jede Lektion liefert ein wiederverwendbares Artefakt: einen Prompt, eine Skill, einen Agenten, einen MCP-Server. Kostenlos, Open Source, MIT.",
        HERO3: "Du lernst KI nicht nur. Du baust sie. Von Anfang bis Ende. Von Hand.",
        WAYS: "Drei Einstiege. Wähle einen.",
        LICENSE_LINE: "MIT. Nutze es, wie du willst: forke es, unterrichte es, verkaufe es, veröffentliche es. Nennung ist willkommen, aber nicht erforderlich.",
        MAINTAINED: "Betreut von [Rohit Ghumare](https://github.com/rohitg00) und der Community.",
        H_HOW: "So funktioniert es", H_CURR: "Der Aufbau des Lehrplans", H_LESSON: "Der Aufbau einer Lektion",
        H_START: "Erste Schritte", H_PREREQ: "Voraussetzungen", H_BOOK: "Als Buch lesen",
        H_SHIPS: "Jede Lektion liefert etwas", H_CONTENTS: "Inhalt", H_TOOLKIT: "Das Toolkit",
        H_WHERE: "Wo anfangen", H_WHY: "Warum das jetzt zählt", H_CONTRIB: "Mitwirken",
        H_SPONSOR: "Die Arbeit unterstützen", H_STAR: "Sternverlauf", H_LICENSE: "Lizenz",
    },
    "it": {
        HERO1: "**L'84% degli studenti usa già strumenti di IA. Solo il 18% si sente pronto a usarli professionalmente.** Questo percorso colma quel divario.",
        HERO2: "503 lezioni. 20 fasi. ~320 ore. Python, TypeScript, Rust, Julia. Ogni lezione produce un artefatto riutilizzabile: un prompt, una skill, un agente, un server MCP. Gratis, open source, MIT.",
        HERO3: "Non impari solo l'IA. La costruisci. Dall'inizio alla fine. A mano.",
        WAYS: "Tre modi per iniziare. Scegline uno.",
        LICENSE_LINE: "MIT. Usalo come vuoi: forkalo, insegnalo, vendilo, pubblicalo. L'attribuzione è gradita, ma non obbligatoria.",
        MAINTAINED: "Mantenuto da [Rohit Ghumare](https://github.com/rohitg00) e dalla community.",
        H_HOW: "Come funziona", H_CURR: "La struttura del percorso", H_LESSON: "La struttura di una lezione",
        H_START: "Per iniziare", H_PREREQ: "Prerequisiti", H_BOOK: "Leggilo come un libro",
        H_SHIPS: "Ogni lezione produce qualcosa", H_CONTENTS: "Indice", H_TOOLKIT: "Il toolkit",
        H_WHERE: "Da dove iniziare", H_WHY: "Perché conta adesso", H_CONTRIB: "Contribuire",
        H_SPONSOR: "Sostieni il progetto", H_STAR: "Cronologia delle stelle", H_LICENSE: "Licenza",
    },
    "zh": {
        HERO1: "**84% 的学生已经在使用 AI 工具，却只有 18% 觉得自己能专业地使用它们。** 这套课程正是为了填补这道鸿沟。",
        HERO2: "503 节课。20 个阶段。约 320 小时。Python、TypeScript、Rust、Julia。每节课都产出一个可复用的成果：一个提示词、一个技能、一个智能体、一个 MCP 服务器。免费、开源、MIT 许可。",
        HERO3: "你不只是学 AI，你亲手把它造出来。从头到尾，全部手写。",
        WAYS: "三种入门方式，任选其一。",
        LICENSE_LINE: "MIT 许可。随你怎么用：复刻、教学、出售、发布都行。欢迎署名，但并非必须。",
        MAINTAINED: "由 [Rohit Ghumare](https://github.com/rohitg00) 和社区共同维护。",
        H_HOW: "运作方式", H_CURR: "课程的整体结构", H_LESSON: "单节课的结构",
        H_START: "快速开始", H_PREREQ: "先决条件", H_BOOK: "当作一本书来读",
        H_SHIPS: "每节课都有产出", H_CONTENTS: "目录", H_TOOLKIT: "工具箱",
        H_WHERE: "从哪里开始", H_WHY: "为什么这在当下很重要", H_CONTRIB: "参与贡献",
        H_SPONSOR: "赞助本项目", H_STAR: "Star 历史", H_LICENSE: "许可证",
    },
    "ja": {
        HERO1: "**学生の84%はすでにAIツールを使っていますが、それを専門的に使いこなせると感じているのはわずか18%です。** このカリキュラムはそのギャップを埋めます。",
        HERO2: "503のレッスン。20のフェーズ。約320時間。Python、TypeScript、Rust、Julia。各レッスンは再利用できる成果物を残します。プロンプト、スキル、エージェント、MCPサーバー。無料、オープンソース、MIT。",
        HERO3: "AIをただ学ぶのではありません。自分の手で作ります。最初から最後まで、手作業で。",
        WAYS: "入り方は3つ。ひとつ選んでください。",
        LICENSE_LINE: "MIT。好きなように使ってください。フォークする、教える、売る、公開する。クレジットは歓迎しますが、必須ではありません。",
        MAINTAINED: "[Rohit Ghumare](https://github.com/rohitg00) とコミュニティが保守しています。",
        H_HOW: "仕組み", H_CURR: "カリキュラムの全体像", H_LESSON: "レッスンの構成",
        H_START: "はじめに", H_PREREQ: "前提知識", H_BOOK: "本として読む",
        H_SHIPS: "どのレッスンにも成果物がある", H_CONTENTS: "目次", H_TOOLKIT: "ツールキット",
        H_WHERE: "どこから始めるか", H_WHY: "なぜ今これが重要なのか", H_CONTRIB: "コントリビュート",
        H_SPONSOR: "プロジェクトを支援する", H_STAR: "スター履歴", H_LICENSE: "ライセンス",
    },
    "ko": {
        HERO1: "**학생의 84%는 이미 AI 도구를 사용하지만, 이를 전문적으로 다룰 준비가 되었다고 느끼는 사람은 18%뿐입니다.** 이 커리큘럼이 그 간극을 메웁니다.",
        HERO2: "503개 레슨. 20개 단계. 약 320시간. Python, TypeScript, Rust, Julia. 모든 레슨은 재사용 가능한 결과물을 남깁니다. 프롬프트, 스킬, 에이전트, MCP 서버. 무료, 오픈소스, MIT.",
        HERO3: "AI를 배우기만 하는 것이 아닙니다. 직접 만듭니다. 처음부터 끝까지, 손으로.",
        WAYS: "시작하는 방법은 세 가지. 하나를 고르세요.",
        LICENSE_LINE: "MIT. 원하는 대로 쓰세요. 포크하고, 가르치고, 팔고, 배포하세요. 출처 표기는 환영하지만 필수는 아닙니다.",
        MAINTAINED: "[Rohit Ghumare](https://github.com/rohitg00) 와 커뮤니티가 관리합니다.",
        H_HOW: "동작 방식", H_CURR: "커리큘럼의 구조", H_LESSON: "레슨의 구조",
        H_START: "시작하기", H_PREREQ: "사전 요구 사항", H_BOOK: "책으로 읽기",
        H_SHIPS: "모든 레슨은 결과물을 남깁니다", H_CONTENTS: "목차", H_TOOLKIT: "툴킷",
        H_WHERE: "어디서 시작할까", H_WHY: "왜 지금 중요한가", H_CONTRIB: "기여하기",
        H_SPONSOR: "프로젝트 후원하기", H_STAR: "스타 히스토리", H_LICENSE: "라이선스",
    },
    "hi": {
        HERO1: "**84% छात्र पहले से ही AI टूल इस्तेमाल करते हैं। पर केवल 18% ही उन्हें पेशेवर रूप से इस्तेमाल करने के लिए तैयार महसूस करते हैं।** यह पाठ्यक्रम इसी खाई को पाटता है।",
        HERO2: "503 पाठ। 20 चरण। ~320 घंटे। Python, TypeScript, Rust, Julia। हर पाठ एक पुन: उपयोग योग्य कलाकृति देता है: एक प्रॉम्प्ट, एक स्किल, एक एजेंट, एक MCP सर्वर। मुफ़्त, ओपन सोर्स, MIT।",
        HERO3: "आप केवल AI सीखते नहीं। आप उसे बनाते हैं। शुरू से अंत तक। अपने हाथों से।",
        WAYS: "शुरू करने के तीन तरीके। कोई एक चुनें।",
        LICENSE_LINE: "MIT। जैसे चाहें इस्तेमाल करें: फ़ोर्क करें, पढ़ाएँ, बेचें, प्रकाशित करें। श्रेय देना अच्छा है, पर ज़रूरी नहीं।",
        MAINTAINED: "[Rohit Ghumare](https://github.com/rohitg00) और समुदाय द्वारा अनुरक्षित।",
        H_HOW: "यह कैसे काम करता है", H_CURR: "पाठ्यक्रम की संरचना", H_LESSON: "एक पाठ की संरचना",
        H_START: "शुरुआत करें", H_PREREQ: "आवश्यक शर्तें", H_BOOK: "इसे किताब की तरह पढ़ें",
        H_SHIPS: "हर पाठ कुछ न कुछ देता है", H_CONTENTS: "विषय-सूची", H_TOOLKIT: "टूलकिट",
        H_WHERE: "कहाँ से शुरू करें", H_WHY: "यह अभी क्यों मायने रखता है", H_CONTRIB: "योगदान करें",
        H_SPONSOR: "काम को प्रायोजित करें", H_STAR: "स्टार इतिहास", H_LICENSE: "लाइसेंस",
    },
    "ar": {
        HERO1: "**\u200f84% من الطلاب يستخدمون أدوات الذكاء الاصطناعي بالفعل، لكن 18% فقط يشعرون بأنهم مستعدون لاستخدامها باحتراف.** هذا المنهج يسدّ هذه الفجوة.",
        HERO2: "\u200f503 دروس. 20 مرحلة. نحو 320 ساعة. Python وTypeScript وRust وJulia. كل درس ينتج مخرجًا قابلًا لإعادة الاستخدام: موجّهًا، أو مهارة، أو وكيلًا، أو خادم MCP. مجاني، مفتوح المصدر، برخصة MIT.",
        HERO3: "أنت لا تتعلّم الذكاء الاصطناعي فحسب، بل تبنيه بنفسك. من البداية إلى النهاية. يدويًا.",
        WAYS: "ثلاث طرق للبدء. اختر واحدة.",
        LICENSE_LINE: "رخصة MIT. استخدمه كما تشاء: انسخه، وعلّمه، وبِعه، وانشره. ذكر المصدر محلّ تقدير، لكنه غير مطلوب.",
        MAINTAINED: "يتولّى صيانته [Rohit Ghumare](https://github.com/rohitg00) والمجتمع.",
        H_HOW: "كيف يعمل هذا", H_CURR: "بنية المنهج", H_LESSON: "بنية الدرس",
        H_START: "البدء", H_PREREQ: "المتطلبات المسبقة", H_BOOK: "اقرأه ككتاب",
        H_SHIPS: "كل درس ينتج شيئًا", H_CONTENTS: "المحتويات", H_TOOLKIT: "مجموعة الأدوات",
        H_WHERE: "من أين تبدأ", H_WHY: "لماذا يهمّ هذا الآن", H_CONTRIB: "المساهمة",
        H_SPONSOR: "ادعم العمل", H_STAR: "سجلّ النجوم", H_LICENSE: "الترخيص",
    },
    "ru": {
        HERO1: "**84% студентов уже используют инструменты ИИ, но лишь 18% чувствуют себя готовыми применять их профессионально.** Этот курс закрывает этот разрыв.",
        HERO2: "503 урока. 20 фаз. ~320 часов. Python, TypeScript, Rust, Julia. Каждый урок оставляет переиспользуемый артефакт: промпт, навык, агент, сервер MCP. Бесплатно, открытый исходный код, лицензия MIT.",
        HERO3: "Вы не просто изучаете ИИ. Вы строите его. От начала до конца. Своими руками.",
        WAYS: "Три способа начать. Выберите один.",
        LICENSE_LINE: "MIT. Используйте как угодно: форкайте, преподавайте, продавайте, публикуйте. Указание авторства приветствуется, но не обязательно.",
        MAINTAINED: "Поддерживается [Rohit Ghumare](https://github.com/rohitg00) и сообществом.",
        H_HOW: "Как это устроено", H_CURR: "Структура курса", H_LESSON: "Структура урока",
        H_START: "Начало работы", H_PREREQ: "Предварительные требования", H_BOOK: "Читать как книгу",
        H_SHIPS: "Каждый урок что-то даёт", H_CONTENTS: "Содержание", H_TOOLKIT: "Набор инструментов",
        H_WHERE: "С чего начать", H_WHY: "Почему это важно сейчас", H_CONTRIB: "Как внести вклад",
        H_SPONSOR: "Поддержать проект", H_STAR: "История звёзд", H_LICENSE: "Лицензия",
    },
    "tr": {
        HERO1: "**Öğrencilerin %84'ü zaten yapay zeka araçlarını kullanıyor, ama yalnızca %18'i bunları profesyonelce kullanmaya hazır hissediyor.** Bu müfredat bu boşluğu kapatır.",
        HERO2: "503 ders. 20 aşama. ~320 saat. Python, TypeScript, Rust, Julia. Her ders yeniden kullanılabilir bir çıktı verir: bir istem, bir beceri, bir ajan, bir MCP sunucusu. Ücretsiz, açık kaynak, MIT.",
        HERO3: "Yapay zekayı yalnızca öğrenmezsiniz. Onu kendiniz kurarsınız. Baştan sona. Elle.",
        WAYS: "Başlamanın üç yolu. Birini seçin.",
        LICENSE_LINE: "MIT. İstediğiniz gibi kullanın: çatallayın, öğretin, satın, yayımlayın. Atıf makbule geçer ama zorunlu değildir.",
        MAINTAINED: "[Rohit Ghumare](https://github.com/rohitg00) ve topluluk tarafından sürdürülmektedir.",
        H_HOW: "Nasıl çalışır", H_CURR: "Müfredatın yapısı", H_LESSON: "Bir dersin yapısı",
        H_START: "Başlarken", H_PREREQ: "Ön koşullar", H_BOOK: "Kitap olarak okuyun",
        H_SHIPS: "Her ders bir şey üretir", H_CONTENTS: "İçindekiler", H_TOOLKIT: "Araç seti",
        H_WHERE: "Nereden başlamalı", H_WHY: "Bu neden şimdi önemli", H_CONTRIB: "Katkıda bulunma",
        H_SPONSOR: "Projeye sponsor olun", H_STAR: "Yıldız geçmişi", H_LICENSE: "Lisans",
    },
}
