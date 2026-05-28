# Constitutional AI とルールオーバーライド

> Anthropic が 2026 年 1 月 22 日に公開した Claude Constitution は全 79 ページで、CC0 ライセンスです。これは rule-based alignment から reason-based alignment へ進み、4層の優先順位階層を定めています: (1) safety and supporting human oversight、(2) ethics、(3) Anthropic guidelines、(4) helpfulness。挙動は、運用者やユーザーが上書きできない hardcoded prohibitions（bioweapons uplift、CSAM）と、定義された範囲内で運用者が調整できる soft-coded defaults に分かれます。2022 年の原論文（Bai et al.）では、constitution に照らした自己批評と RLAIF によって harmlessness を訓練しました。正直に言えば、reason-based alignment は、モデルが予期しない状況へ原則を一般化できることに依存します。Anthropic 自身の 2023 年の参加型実験では、公募由来の原則と企業側の原則に約 50% の相違が示されましたが、2026 年版はその知見を取り込んでいません。

**種別:** 学習
**言語:** Python (stdlib, four-tier priority resolver)
**前提条件:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**所要時間:** 約60分

## 問題

実運用に出たエージェントは、設計者が見たことのない入力に遭遇します。あらゆる入力を網羅できるほど長いルール一覧は作れません。かといって、計算資源に制約がある推論時にすばやく適用できるほど短いルール一覧でも足りません。実務上の問いはこうです。ロングテールの事例にも高速推論にも耐える原則へ、どうやってエージェントを整合させるのか。

Rule-based alignment (RBA): 禁止事項をすべて列挙する方法です。チェックは速く、監査もしやすい一方、最新状態を保つのは不可能で、想定していなかった近い類例に対して過剰拒否しがちです。Reason-based alignment（2026 年の Claude Constitution）: 原則を符号化し、モデルに推論させる方法です。未知の事例へ広がりますが、監査は難しく、失敗モードは「ルールを見落とす」ことではなく「原則を誤って適用する」ことになります。

2026 年版 Constitution は、明示的に中間の立場を取ります。Hardcoded prohibitions、つまり文脈に関係なく誤りであるもの（bioweapons uplift、CSAM）は RBA です。運用者やユーザーの指示に関係なく、常に禁止されます。それ以外は4層階層の中で reason-based に扱われます。最優先は safety and supporting human oversight、次に ethics、次に Anthropic-declared guidelines、最後に helpfulness です。運用者は soft-coded な領域の中でデフォルトを調整できますが、hardcoded prohibitions には触れられません。

## コンセプト

### 4層の優先順位階層

1. **Safety and supporting human oversight.** 最上位です。モデルは、人間と Anthropic が AI を監督し修正する能力を損なわないことを優先します。これは単に「慎重であれ」という意味ではありません。具体的には「人間による監督を難しくする形で行動するな」という意味です。
2. **Ethics.** 正直であること、人への害を避けること、欺かないこと、操作しないこと。Anthropic の guidelines と衝突する場合は ethics が優先します。
3. **Anthropic guidelines.** Anthropic が重要だと判断した運用上の規範です。プロダクトの範囲、対話パターン、どのツールをいつ使うか、などが含まれます。
4. **Helpfulness.** 最下位です。上位の優先事項の範囲内で、できるだけ有用であることを指します。

層が衝突した場合は、上位の層が勝ちます。これは Unix の優先度やネットワーク QoS と同じ形です。この枠組みは、単一の軸で常に最良の振る舞いを得るためではなく、予測可能な解決を得るためのものです。

### Hardcoded prohibitions と soft-coded defaults

**Hardcoded:**
- Bioweapons / CBRN uplift
- CSAM
- 重要インフラへの攻撃
- 直接尋ねられたときにモデルの身元についてユーザーを欺くこと

運用者はこれらを上書きできません。ユーザーも上書きできません。可能な場合はモデル重みのレベル（RLHF / Constitutional AI training）で、そうでない場合は推論レイヤーで強制されます。

**Soft-coded defaults（運用者が調整可能）:**
- 応答長のデフォルト
- トピック範囲（運用者のデプロイ範囲外のトピックをモデルが拒否できる）
- スタイル（フォーマルかカジュアルか）
- ツール使用パターン

運用者による調整は、宣言された境界の内側で行われます。運用者は、hardcoded prohibitions の名前を変えることでそれらを取り除くことはできません。

### 2022 年の CAI training

最初の Constitutional AI（Bai et al., 2022）は、harmlessness を次のように訓練しました。

1. プロンプト集合に対する応答を生成する。
2. constitution（明示的な原則）に照らして各応答を批評するようモデルに求める。
3. 批評に基づいて応答を修正する。
4. 修正済みペアに対して RLAIF（reinforcement learning from AI feedback）を行う。

結果として、有害な要求に対して一律拒否ではなく、原則に基づく説明つきで拒否するモデルが得られます。2026 年版 Constitution は、この訓練の子孫に加えて、明示的な階層構造に関する追加の post-training を使っています。

### Reason-based alignment が拾えるものと落とすもの

**拾えるもの:**
- 許可された基本要素の予期しない組み合わせで、原則が明確に適用できるもの。
- 禁止事項の近い類例にあたる新しい要求。
- 「X が禁止とは言っていない」と主張するソーシャルエンジニアリング攻撃。

**落とすもの:**
- 原則の曖昧さを悪用する攻撃（「ユーザーが求めているのだから helpfulness は yes だ」）。
- 2つの原則が予期しない形で衝突し、層の順序も曖昧になるシナリオ。
- 訓練サイクルをまたいだ原則解釈のゆっくりした変化（再解釈）。

### 2023 年の参加型実験

Anthropic は 2023 年に、企業が作成した constitution と、公共からの入力（米国の回答者約 1,000 人）で生成した constitution を比較する実験を行いました。2つのバージョンが一致した原則は約 50% でした。相違があった箇所では、公募由来のバージョンは一部の問題（政治コンテンツの扱い）ではより制限的で、別の問題（AI 身元の自己開示）ではより制限が緩いものでした。2026 年版 Constitution は、公募由来の知見を取り込んでいません。これは、このアプローチに記録されている緊張関係です。

### Hardcoded prohibitions が必要な理由

Reason-based alignment だけではロングテールを閉じられません。攻撃者がモデルに前提を受け入れさせられる場合（例: 「私たちは認可済みの生物兵器研究所だ」）、事例ごとの推論に依存する原則をすり抜けられることがよくあります。Hardcoded prohibitions は、前提の作り方に合わせて曲がりません。これは Lesson 14 の「hard constitutional limit」を alignment レイヤーに置いたものです。

### Constitution がスタック内で占める位置

Constitution は Lesson 14 の kill switch ではありません。これはモデルレイヤー、つまりモデルの重みが何を好むように訓練されているかに属します。Kill switch と canary token はランタイムレイヤー、つまりランタイムが何を許可するかに属します。どちらも必要です。モデル重みが許容的すぎるために、ランタイムが誤った行動をすべて実行してしまうなら、それはランタイムの問題です。ランタイムが制限的すぎるために、モデルが正しい行動をすべて拒否してしまうなら、それもランタイムの問題です。各レイヤーは異なる種類の問題をカバーします。

## 使ってみる

`code/main.py` は、最小限の4層 priority resolver を実装しています。resolver は、提案された行動と一連の principle-evaluations（safety、ethics、guidelines、helpfulness）を受け取り、その行動、拒否、または修正済み行動を返します。ドライバーは、小さなケース集合を実行します。明確な許可、明確な不許可、hardcoded prohibition、層をまたぐ曖昧なケースです。

## 出荷する

`outputs/skill-constitution-review.md` は、デプロイの constitutional layer を監査します。何が hardcoded か、何が soft-coded か、運用者がどこを調整できるか、4層階層が実際に解決順序になっているかを確認します。

## 演習

1. `code/main.py` を実行してください。helpfulness が高い場合でも hardcoded prohibition が発火することを確認します。resolver を変更して helpfulness の重みを ethics より上にし、失敗モードを観察してください。

2. Claude Constitution（公開、79 ページ、CC0）を読んでください。仕様が不足していると思う原則を1つ特定します。具体的な曖昧さを説明し、より厳密な定式化を提案する文章を2段落で書いてください。

3. カスタマーサポートエージェント向けの soft-coded default のセットを設計してください。運用者は何を調整できますか。何には触れませんか。それぞれの境界を正当化してください。

4. Bai et al. 2022 の CAI 論文を読んでください。Constitutional AI の critique-and-revise ループが、一律ルールより悪い結果を生むケースを1つ説明してください。そのクラスも特定してください。

5. Anthropic の 2023 年の参加型実験では、公共の原則と企業の原則に約 50% の相違が見つかりました。本番デプロイでこれが重要になるカテゴリを1つ選んでください（例: 政治的中立性）。Hardcoded prohibitions は触れないまま、運用者が自分たちの価値観を表現できる設計を提案してください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|---|---|---|
| Constitutional AI | 「Anthropic の alignment 手法」 | 書かれた constitution に照らす自己批評 + RLAIF |
| Reason-based alignment | 「ルールではなく原則」 | 未知の事例を扱うため、モデルが原則に基づいて推論すること |
| Hardcoded prohibition | 「X は絶対にするな」 | 運用者もユーザーも上書きできない rule-based な禁止 |
| Soft-coded default | 「運用者が調整可能」 | 宣言された境界内の挙動を運用者が制御すること |
| Four-tier hierarchy | 「優先順位」 | safety > ethics > guidelines > helpfulness |
| RLAIF | 「AI feedback RL」 | 報酬がモデル生成の批評から来る RL |
| Participatory constitution | 「公共由来の原則」 | 2023 年の Anthropic 実験。企業側とは約 50% 相違 |
| Principle drift | 「解釈のずれ」 | 固定された原則テキストをモデルがどう読むかがゆっくり変わること |

## 参考資料

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 79 ページの CC0 文書。
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) — 2022 年の原論文。
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) — 参加型実験。
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — Constitution が RSP スタックのどこに位置するか。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 長期ホライズンのデプロイにおける Constitution の役割。
