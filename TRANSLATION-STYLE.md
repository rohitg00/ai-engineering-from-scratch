# Translation style — Traditional Chinese (繁體中文, zh-Hant)

House rules for translating a lesson's `docs/en.md` into `docs/zh.md`. Terminology follows Taiwan
conventions. Read one existing translation before starting — the voice matters more than any rule
below:

- `phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/zh.md`
- `phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/zh.md`

Verify with `python3 scripts/i18n_status.py --verify` before committing.

**Scope: lesson prose only.** `quiz.json` and `outputs/*.md` deliberately stay English for now. Both
are user-facing — `lesson.html` fetches the quiz and renders the output artifacts — so translating
them would also require a loader change, since neither has a language variant the way `docs/zh.md`
does. Out of scope until that's wanted.

## Mirror the English structure exactly

Same heading outline at the same levels, same fenced blocks in the same order, same tables with the
same row counts, same links, same image paths. The headings build the site's on-page table of
contents, so they must correspond 1:1. Where the English repeats a heading, translate both
occurrences the same way so the correspondence holds.

Do not add or drop content, and do not invent structure the source lacks — if the exercises carry no
`**Easy.**` / `**Medium.**` / `**Hard.**` labels, don't add them; if there's no *Key Terms* table,
don't write one.

## Keep verbatim

| What | Why |
|---|---|
| Everything inside code fences | Mirrors `code/main.*`; translating lets prose drift from shipped code |
| ```` ```figure ```` fences and the widget name inside | That string is what `lesson-figures.js` mounts a widget onto |
| ASCII / box diagrams inside fences | CJK glyphs are double-width and would wreck the alignment |
| URLs, link targets, image paths | Must resolve |
| Paper titles under *Further Reading* | They're citations |
| Literal terminal output and error strings | Readers grep for them |
| GUI menu paths (`Runtime > Change runtime type`) | The product's UI is in English; translating makes it unfindable |
| Product names, code identifiers, file paths, CLI flags, env vars, hardware names | Not prose |

## Metadata block

| English | Chinese |
|---|---|
| `**Type:**` | `**類型：**` — Build→實作, Learn→學習, Reference→參考 |
| `**Languages:**` | `**程式語言：**` (values stay English) |
| `**Prerequisites:**` | `**先修單元：**` — "Phase 7 · 05 (Full Transformer)" → "階段 7 · 05（完整的 Transformer）"; "None" → "無" |
| `**Time:**` | `**時間：**` — "~45 minutes" → "約 45 分鐘" |

## Standard headings

| English | Chinese |
|---|---|
| Learning Objectives | 學習目標 |
| The Problem | 問題所在 |
| The Concept | 核心概念 |
| Build It | 動手實作 |
| Use It | 框架應用 |
| Ship It | 產出交付 |
| Exercises | 練習 |
| Key Terms | 關鍵術語 |
| Further Reading | 延伸閱讀 |
| `Step N:` | `步驟 N：` |

Exercise labels: `**Easy.**`→`**簡單。**`, `**Medium.**`→`**中等。**`, `**Hard.**`→`**困難。**`

*Key Terms* table header: `| Term | What people say | What it actually means |` →
`| 術語 | 大家怎麼說 | 實際上是什麼 |`

## Terminology

Taiwan usage, not Mainland: 程式碼 (not 代碼) · 資料 (not 數據) · 函式 (not 函數) · 演算法 (not 算法) ·
推論 (inference, not 推理) · 網路 (not 網絡) · 記憶體 · 執行環境 · 函式庫 · 套件 · 驅動程式 ·
儲存庫 (repository) · 終端機 · 虛擬環境 · 部署 · 搜尋 (not 搜索) · 篩選 · 快取 (cache).

ML terms: 詞元 (token) · 嵌入 (embedding) · 微調 (fine-tuning) · 預訓練 · 損失函式 · 梯度 · 張量 ·
最佳化器 (optimizer) · 注意力機制 · 自注意力 · 編碼器／解碼器 · 代理程式 (agent) · 提示詞 (prompt) ·
量化 · 分詞器 (tokenizer) · 正則化 · 過度擬合 (overfitting).

Keep in English: Transformer, PyTorch, BERT, GPT, LoRA, RAG, MCP, ReLU, softmax, beam search, and
any other name a reader would search for.

## Punctuation and register

Full-width `，。：（）「」` in Chinese prose. `——` for an em-dash aside. No space between Chinese and
full-width punctuation; a single space between Chinese and inline Latin or `code` is fine.

Write natural, direct technical Chinese — not word-for-word. Match the source's plain, unfussy
register: it explains without padding, and so should the translation.
