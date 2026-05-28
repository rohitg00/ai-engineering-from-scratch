# Anthropic Responsible Scaling Policy v3.0

> RSP v3.0 は 2026 年 2 月 24 日に発効し、2023 年版ポリシーを置き換えました。緩和策は2層構造です。Anthropic が単独で実施することと、業界全体への推奨として位置づけること（RAND SL-4 security standards を含む）に分かれます。単発の成果物ではなく、継続文書として Frontier Safety Roadmaps と Risk Reports を追加しました。2023 年の pause commitment は削除されました。AI R&D-4 threshold が導入されました。この閾値を超えた場合、Anthropic は misalignment risk と mitigations を特定する affirmative case を公開しなければなりません。Claude Opus 4.6 はこの閾値を超えていません。Anthropic は v3.0 の発表で「これを自信を持って否定することが難しくなっている」と述べています。SaferAI は 2023 年版 RSP を 2.2 と評価しましたが、v3.0 は 1.9 に引き下げ、OpenAI や DeepMind と並ぶ「weak」な RSP カテゴリに置きました。定性的な閾値が 2023 年版の定量的コミットメントを置き換えました。pause clause の削除が最も明確な後退です。

**種別:** 学習
**言語:** Python (stdlib, RSP threshold decision engine)
**前提条件:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**所要時間:** 約45分

## 問題

Frontier lab が公開する scaling policy は、一部は技術文書であり、一部は governance 文書であり、一部は規制当局へのシグナルでもあります。RSP v3.0 は現在の Anthropic 文書です。これを精読する価値があるのは、遵守が法的に拘束されているからではありません（拘束されていません）。その framing が、lab が catastrophic risk をどう捉え、trade-off を一般にどう伝えるかを形作るからです。

有用な単位は v3.0 と v2.0 の diff です。追加されたものは、Frontier Safety Roadmaps、Risk Reports、AI R&D-4 threshold です。削除されたものは、2023 年の pause commitment です。再構成されたものは、Anthropic 単独の措置と業界推奨に分割された2層の mitigation schedule です。外部レビューである SaferAI は、スコアを 2.2（v2）から 1.9（v3.0）へ引き下げました。これが、より洗練されて見えながら、scaling policy がより厳密でなくなる仕組みです。

## コンセプト

### 2層の mitigation schedule

- **Anthropic unilateral actions**: 他の lab が何をするかに関係なく、Anthropic が実施すること。閾値を超えた training stop、具体的な security measures、具体的な deployment gates。
- **Industry-wide recommendations**: Anthropic が業界全体で共同実施すべきだと考えること。RAND SL-4 security standards を含みます。これらは Anthropic 側のコミットメントではなく、policy advocacy です。

この2層構造は v2 にはありませんでした。つまり読者は、各コミットメントがどちらの列に置かれているかを見る必要があります。"industry-wide recommendation" 列にある security measure は Anthropic の約束ではありません。Anthropic の期待です。

### AI R&D-4 threshold

これは RSP v3.0 が重要な次の閾値として名指しする capability level です。具体的には、AI 研究のかなりの部分を競争力のあるコストで自動化できるモデルです。Anthropic がモデルがこの閾値を超えたと判断した場合、scaling を続ける前に、misalignment risks と mitigations を特定する affirmative case を公開しなければなりません。

v3.0 の発表によれば、Claude Opus 4.6 はこれを超えていません。文書はさらに「これを自信を持って否定することが難しくなっている」と付け加えています。この言い回しは重要です。閾値が憶測上の限界ではなく、現実の懸念になるほど近いことを認めているからです。

Lesson 6（Automated Alignment Research）と Lesson 7（Recursive Self-Improvement）は、この閾値に直接つながります。自動化された alignment researchers が研究品質の基準を超えることは、AI R&D-4 threshold が近づいている証拠です。

### Frontier Safety Roadmaps と Risk Reports

v3.0 は2種類の artifact を継続文書に格上げしています。

- **Frontier Safety Roadmap**: 計画中の safety work、capability expectations、mitigation research を説明する forward-looking document。
- **Risk Report**: リリース後の特定モデルについて、観測された capability と residual risk を説明する retrospective document。

どちらも公開されます。どちらも宣言された cadence で更新されます。これが有用なのは、Anthropic が Roadmap で「やる」と言ったことと、Risk Report で報告したことを読者が比較できるからです。

### pause clause の削除

2023 年版 RSP には明示的な pause commitment がありました。モデルが特定の capability thresholds を超えた場合、mitigations が整うまで training を pause する、というものです。v3.0 は明示的な pause を、より柔らかい表現（affirmative case を公開し、mitigations が十分なら進める）に置き換えています。SaferAI などの分析者は、これを新文書で最大の後退として直接指摘しました。

この変更を支持する policy argument は、2023 年の定量的閾値が、benchmark 自体の再スケーリングにより 2026 年時点の capability benchmarks では到達不能になった、というものです。反論は、scaling policy における pause clause は commitment device であり、それを削除すると policy の信頼性が失われる、というものです。

### SaferAI の downgrade

SaferAI は RSP 型文書を評価する独立組織です。公開評価では、2023 年版 Anthropic RSP は 2.2 点でした（4.0 が現在最良の RSP、1.0 が名目的という尺度）。v3.0 は 1.9 点でした。これにより Anthropic は「moderate」から「weak」へ移り、weak カテゴリで OpenAI と DeepMind に加わりました。

SaferAI による downgrade の要因:
- 定量的閾値が定性的閾値に置き換えられた。
- pause commitment が削除された。
- AI R&D-4 threshold の mitigations が、具体的措置ではなく "affirmative case" として記述されている。
- レビュー機構が Anthropic の Safety Advisory Group に依存し、独立した oversight が限定的である。

### このレッスンでは扱わないこと

これは compliance のレッスンではありません。RSP v3.0 は規制ではなく、Anthropic に遵守を強制するものはありません。このレッスンは、その文書にふさわしい具体性と懐疑を持って読むためのものです。Scaling policies は、frontier lab が catastrophic-risk posture について発する主要な公開シグナルです。それを正しく読むことは、frontier capabilities に依存する仕事をするすべての人にとって実践的な skill です。

## 使ってみる

`code/main.py` は、RSP の threshold-evaluation の形をなぞる小さな decision engine を実装しています。candidate model と capability measurements の集合を与えると、AI R&D-4 threshold を超えたか、必要な affirmative-case sections は何か、deployment を進められるかを返します。意図的に単純です。目的は文書の logic を明示することです。

## 出荷する

`outputs/skill-scaling-policy-review.md` は scaling policy（Anthropic、OpenAI、DeepMind、または internal）を v3.0 参照に照らしてレビューします。2層構造、thresholds、pause commitments、independent review を確認します。

## 演習

1. `code/main.py` を実行してください。capability level が異なる3つの synthetic model を入力します。threshold evaluator が期待どおりに動作し、正しい affirmative-case template を生成することを確認してください。

2. RSP v3.0 全文（32ページ）を読んでください。"industry-wide recommendation" tier にあるすべてのコミットメントを特定してください。そのうちどれが v2 では "Anthropic unilateral" だったでしょうか。

3. SaferAI の RSP grading methodology を読んでください。その rubric を文書に適用し、v3.0 の 1.9 点を再現してください。downgrade を最も強く引き起こした rubric row はどれでしょうか。

4. 2023 年の pause commitment は削除されました。2026 年の benchmark-rescaling 問題を認めつつ、policy の信頼性を保つ代替コミットメントを提案してください。

5. RSP v3.0 と OpenAI Preparedness Framework v2（Lesson 20）を比較してください。v3.0 の方が強い領域を1つ選んでください。Preparedness Framework の方が強い領域も1つ選んでください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|---|---|---|
| RSP | 「Anthropic の scaling policy」 | Responsible Scaling Policy。v3.0 は 2026 年 2 月 24 日発効 |
| AI R&D-4 | 「Research-automation threshold」 | 競争力のあるコストで substantial AI research を自動化する capability |
| Affirmative case | 「Safety justification」 | リスクが特定され、mitigations が十分であることを示す公開された論証 |
| Frontier Safety Roadmap | 「Forward plan」 | 計画中の safety work と予想される capabilities に関する継続文書 |
| Risk Report | 「モデルの retrospective」 | リリース後の観測 capability と residual risk に関する継続文書 |
| Two-tier mitigation | 「Unilateral vs industry」 | Anthropic commitments と industry recommendations を分離したもの |
| Pause commitment | 「2023 年 clause」 | training を pause する明示的な約束。v3.0 で削除 |
| SaferAI rating | 「Independent RSP grade」 | 第三者 rubric。v3.0 は 1.9 点（v2 は 2.2 点） |

## 参考資料

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 32ページの policy 全文。
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) — v2 からの変更点の要約。
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/research/frontier-safety) — RSP v3.0 からリンクされている継続文書。
- [Anthropic — Risk Report: Claude Opus 4.6](https://www.anthropic.com/research/risk-report-claude-opus-4-6) — 現在の frontier model に関する retrospective。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — AI R&D-4 と測定された autonomy を接続する資料。
