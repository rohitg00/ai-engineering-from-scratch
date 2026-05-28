# ASCII Art と Visual Jailbreaks

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753)。有害リクエスト内の safety-relevant tokens を mask し、同じ文字を ASCII-art として描いたものに置き換えて、cloaked prompt として送ります。GPT-3.5、GPT-4、Gemini、Claude、Llama-2 はいずれも ASCII-art tokens を堅牢に認識できません。この攻撃は PPL (perplexity filters)、Paraphrase defenses、Retokenization を bypass します。関連: ViTC benchmark は non-semantic visual prompts の認識を測ります。StructuralSleight は Uncommon Text-Encoded Structures (trees, graphs, nested JSON) に一般化し、encoding attack の family として扱います。

**種別:** 構築
**言語:** Python (stdlib, ArtPrompt token-masking harness)
**前提条件:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**所要時間:** 約60分

## 学習目標

- ArtPrompt attack を説明する: word-identification step、ASCII-art substitution、final cloaked prompt。
- 標準的な defense (PPL、Paraphrase、Retokenization) が ArtPrompt に失敗する理由を説明する。
- ViTC を定義し、それが何を測るかを説明する。
- StructuralSleight を、任意の Uncommon Text-Encoded Structures への一般化として説明する。

## 問題

paraphrase / roleplay (Lesson 12) と long context (Lesson 13) による攻撃は、text-level pattern に作用します。ArtPrompt は recognition level に作用します。モデルは forbidden token を parse しません。文字で描かれた画像を parse します。safety filter には無害な記号列に見えます。モデルには単語に見えます。

## コンセプト

### ArtPrompt の2ステップ

Step 1. Word Identification。有害リクエストが与えられたら、attacker は LLM を使って safety-relevant words (例: "how to make a bomb" における "bomb") を特定します。

Step 2. Cloaked Prompt Generation。特定した各単語を、その ASCII-art rendering (文字形を作る 7x5 または 7x7 の character block) に置き換えます。モデルは、高性能なら単語として認識できる punctuation と spaces の grid を受け取ります。safety filter は grid だけを見ます。

結果: GPT-4、Gemini、Claude、Llama-2、GPT-3.5 はすべて失敗しました。benchmark subset で attack success rate は 75% 超でした。

### 標準 defense が失敗する理由

- **PPL (perplexity filter)。** ASCII art は perplexity が高い。しかし新規性のある入力はどれも高くなり得ます。ArtPrompt を block する threshold は、正当な structured input も block します。
- **Paraphrase。** prompt を paraphrase すると ASCII art は壊れます。実際には、paraphrase LLM が art を保持または再構成してしまうことが多いです。
- **Retokenization。** tokens の分割を変えても、model の「視覚」が letter shapes を認識している事実は変わりません。

根本的な問題は、safety filters が token level または semantic level であり、ArtPrompt は visual recognition level で動くことです。

### ViTC benchmark

non-semantic visual prompts の認識です。ASCII-art、wingdings、その他の non-text-semantic visual content をモデルが読めるかを測ります。ArtPrompt の有効性は ViTC accuracy と相関します。モデルが visual text をうまく読めるほど、そのモデルに対して ArtPrompt が効きます。これは capability-safety tradeoff です。

### StructuralSleight

ArtPrompt を一般化します: Uncommon Text-Encoded Structures (UTES)。trees、graphs、nested JSON、CSV-in-JSON、diff-style code blocks。構造が safety training data では rare だが model には parse 可能であれば、有害 content を隠せます。

defense implication: safety は、model が parse できる structured representations 全体に一般化する必要があります。その集合は大きく、増え続けています。

### Image-modality analog

Visual LLMs (GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1) は attack surface を拡張します。実画像を使う ArtPrompt-style attack は、image encoders がより豊かな signal を生成するため、ASCII-art analog より強力です。

### Phase 18 における位置づけ

Lessons 12-14 は直交する3つの attack vectors を説明します: iterative refinement (PAIR)、context length (MSJ)、encoding (ArtPrompt/StructuralSleight)。Lesson 15 では、model-centric attacks から system-boundary attacks (indirect prompt injection) に移ります。Lesson 16 は defensive tooling response を説明します。

## 使ってみる

`code/main.py` は toy ArtPrompt を作ります。有害 query 内の特定単語を ASCII-art glyph で cloak し、cloaked string が keyword filter を通過することを確認し、任意で simple recognizer により cloaked string を戻せます。

## 成果物

この lesson は `outputs/skill-encoding-audit.md` を生成します。jailbreak-defense report が与えられたら、対象となっている encoding attack families (ASCII art、base64、leet-speak、UTF-8 homoglyph、UTES) と、それぞれを捕捉する defense layer を列挙します。

## 演習

1. `code/main.py` を実行してください。cloaked string が simple keyword filter を通過することを確認してください。必要な character-level change を報告してください。

2. 同じ target word に対して base64 という2つ目の encoding を実装してください。ArtPrompt と比べた filter-bypass rate と recovery difficulty を比較してください。

3. Jiang et al. 2024 Section 4.3 (five-model results) を読んでください。同じ benchmark で Claude の ArtPrompt-resistance が Gemini より高い理由を1つ提案してください。

4. prompt 内の ASCII-art-shaped regions を検出する pre-generation defense を設計してください。正当な code、tables、mathematical notation における false-positive rate を測ってください。

5. StructuralSleight は10種類の encoding structures を挙げています。10種類すべてを扱う generalized defense を sketch し、防御対象 prompt あたりの compute cost を見積もってください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| ArtPrompt | 「ASCII-art attack」 | safety words を ASCII-art rendering で mask する2ステップ jailbreak |
| Cloaking | 「単語を隠す」 | forbidden token を、model には読めるが filter には読めない visual representation に置き換えること |
| UTES | 「珍しい構造」 | Uncommon Text-Encoded Structure — content の密輸に使われる tree、graph、nested JSON など |
| ViTC | 「visual-text capability」 | non-semantic visual encoding を model が読めるかの benchmark |
| Perplexity filter | "PPL defense" | high perplexity の prompt を拒否する。正当な structured input も high score になるため失敗する |
| Retokenization | 「tokenizer shift defense」 | 別 tokenizer で prompt を preprocess する。認識が visual なので失敗する |
| Homoglyph | 「見た目が似た文字」 | Latin letters と同一に見える Unicode characters。substring checks を bypass する |

## 参考文献

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — ASCII-art jailbreak 論文
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — UTES generalization
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 相補的な iterative attack
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) — 相補的な length attack
