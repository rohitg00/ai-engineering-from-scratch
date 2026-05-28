# 失敗モード: エージェントはなぜ壊れるのか

> MASFT (Berkeley, 2025) は multi-agent failure modes を 3 カテゴリ 14 種に整理する。Microsoft の Taxonomy は、既存の AI failure が agentic setting でどのように増幅されるかを文書化している。業界の現場データは、hallucinated actions、scope creep、cascading errors、context loss、tool misuse という 5 つの反復モードに収束している。

**種類:** 学習 + 構築
**言語:** Python (stdlib)
**前提:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**時間:** 約60分

## 学習目標

- MASFT の 3 つの failure category と、それぞれ少なくとも 4 つの具体的な mode を挙げる。
- agentic failure が既存の AI failure modes (bias, hallucination) を増幅する理由を説明する。
- 業界で繰り返し現れる 5 つの modes とその mitigations を説明する。
- agent traces に failure-mode labels を付ける stdlib detector を実装する。

## 問題

teams は 90% の traces で動く agents を出荷する。残り 10% の失敗はランダムノイズではない。少数の繰り返しカテゴリに分類できる。名前を付けられるようになると、それを監視し、修正できるようになる。

## コンセプト

### MASFT (Berkeley, arXiv:2503.13657)

Multi-Agent System Failure Taxonomy。14 個の failure modes を 3 カテゴリにまとめる。annotator 間の Cohen's Kappa は 0.88 で、カテゴリは信頼できる形で区別できる。

中心主張: failure は、より良い base model で直る LLM limitation ではなく、multi-agent systems における根本的な設計欠陥である。

### Microsoft Taxonomy of Failure Mode in Agentic AI Systems

- 既存の AI failures (bias, hallucination, data leakage) は agentic setting で増幅される。
- autonomy により新しい failures が現れる: scale した unintended action、tool misuse、mission drift。
- この whitepaper は agentic products の risk register である。

### Characterizing Faults in Agentic AI (arXiv:2603.06847)

- failures は orchestration、internal state evolution、environment interaction から生じる。
- 単なる「悪い code」や「悪い model output」ではない。

### LLM Agent Hallucinations Survey (arXiv:2509.18970)

主な現れ方は 2 つ:

1. **Instruction-following Deviation** — agent が system prompt に従わない。
2. **Long-range Contextual Misuse** — agent が以前の turn の context を忘れる、または誤用する。

Sub-intention errors: Omission (手順漏れ)、Redundancy (手順の重複)、Disorder (手順順序の誤り)。

### 業界で繰り返し現れる 5 つの mode

Arize、Galileo、NimbleBrain の 2024-2026 年の現場分析は、次に収束している。

1. **Hallucinated actions。** Agent が存在しない tool を呼ぶ、または arguments を捏造する。
2. **Scope creep。** Agent が user の依頼を越えて task を拡張する (余分な PR を作る、余分な emails を送る)。
3. **Cascading errors。** 1 つの誤った call が下流効果を引き起こす。幻の SKU hallucination が 4 つの API calls を誘発し、multi-system incident になる。
4. **Context loss。** 長期 task で、初期 turn の constraints を忘れる。
5. **Tool misuse。** 正しい tool に間違った arguments を渡す、または完全に間違った tool を呼ぶ。

Cascading は最も危険である。Agents は「失敗した」と「task が不可能」を区別できず、400 errors に対して success message を hallucinate して loop を閉じることが多い。

### Mitigation: すべての step に gate を置く

reasoning chain の各 step に自動 verification gates を置き、environment state に対する factual grounding を確認する。具体的には:

- step ごとの safety classifier (Lesson 21)。
- Tool-call argument validation (Lesson 06)。
- retrieved content と既知 facts の cross-check (Lesson 05, CRITIC)。
- state を再確認して success hallucination を検出する (file は実際に作られたか)。

### failure monitoring が失敗するところ

- **crash だけを tag する。** ほとんどの agent failures は valid-looking output を生成する。content-level checks が必要。
- **baseline がない。** Drift detection には last-known-good が必要で、それがないと「悪化している」と言えない。
- **over-alerting。** すべての failure が page になる。cluster して rate-limit する。

## 構築

`code/main.py` は stdlib の failure-mode tagger を実装する。

- 5 つの modes を網羅する synthetic trace dataset。
- mode ごとの detector functions (tool calls、outputs、repeat actions 上の signature patterns)。
- 各 trace に label を付け、mode distribution を報告する tagger。

実行:

```
python3 code/main.py
```

出力: trace ごとの labels + aggregate distribution。Phoenix の trace clustering が表面化するものの安価な再現。

## 利用

- production drift clustering には **Phoenix** (Lesson 24)。
- session replay + annotation には **Langfuse**。
- observability platform では検出できない domain-specific signatures には **Custom**。

## 出荷

`outputs/skill-failure-detector.md` は、trace store に接続された domain 向け failure-mode detectors を生成する。

## 演習

1. 「success hallucination」の detector を追加する。agent は success を返すが target state は変わっていない。
2. 自分が作った product から real traces を 100 件 tag する。どの mode が支配的か。それを修正する cost は何か。
3. 「cascade radius」metric を実装する。step N の failure が、何個の downstream steps に影響したか。
4. MASFT の 14 failure modes を読む。自分の product に当てはまる 3 つを選び、detectors を書く。
5. detector を 1 つ CI job に接続する。>=5% の traces が mode を tag したら build を失敗させる。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley の 14-mode categorization |
| Cascading error | "Ripple failure" | 早い段階の 1 つの誤りが N steps に伝播する |
| Context loss | "Forgot the constraint" | 長期 turn で初期 facts を落とす |
| Tool misuse | "Wrong tool / wrong args" | valid call だが invocation が間違っている |
| Success hallucination | "Faked completion" | agent が 400 で success を主張し、state は未変更 |
| Scope creep | "Overreach" | agent が頼まれた以上のことをする |
| Instruction-following deviation | "Disobedience" | system prompt または user constraint を無視する |
| Sub-intention errors | "Plan bugs" | plan execution における omission、redundancy、disorder |

## 参考文献

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) — 14 failure modes、3 categories
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) — risk register
- [Arize Phoenix](https://docs.arize.com/phoenix) — 実運用での drift clustering
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — より単純な patterns が modes 全体を避ける場面
