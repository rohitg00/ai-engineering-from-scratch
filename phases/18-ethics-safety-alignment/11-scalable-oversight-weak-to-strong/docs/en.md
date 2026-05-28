# スケーラブルな監督と Weak-to-Strong Generalization

> Burns et al. (OpenAI Superalignment, "Weak-to-Strong Generalization", 2023) は、superalignment 問題の代理課題を提案しました。弱いモデルが生成したラベルで強いモデルを fine-tune する、という設定です。強いモデルが不完全な弱い監督から正しく汎化できるなら、現在の人間規模の alignment 手法が超人的なシステムにも拡張できる可能性があります。scalable oversight と W2SG は相補的です。scalable oversight (debate、recursive reward modeling、task decomposition) は監督者の実効能力を高め、監督対象のモデルに追いつけるようにします。W2SG は、その監督者が与える不完全な監督信号から、強いモデルが正しく汎化することを狙います。Debate Helps W2SG (arXiv:2501.13124, January 2025) は両者を組み合わせています。

**種別:** 学習
**言語:** Python (stdlib, W2SG gap simulator)
**前提条件:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**所要時間:** 約60分

## 学習目標

- scalable oversight と weak-to-strong generalization を定義し、両者がどう相補的か説明する。
- Burns et al. 2023 の実験設定を説明する: GPT-2 由来のラベルで GPT-4 を fine-tune する。
- performance gap recovered (PGR) 指標と、それが何を測るのかを説明する。
- 主要な scalable-oversight メカニズム (debate、recursive reward modeling、task decomposition) を3つ挙げ、それぞれの強みを1つ述べる。

## 問題

Phase 18 でここまで扱った alignment 技術はすべて、監督者がモデルの振る舞いを評価できることを仮定しています。モデルが超人的になると、弱点は監督者になります。superalignment の問いはこうです: 弱い監督者は、より強く、aligned なモデルを信頼できる形で作れるのでしょうか。

Burns et al. はこの問いを、操作可能な経験的設定に落とし込みます。弱いものが強いものを監督し、強いモデルの能力のうちどれだけが弱い監督のもとで残るかを測ります。これは superalignment の解ではありません。進捗を測るための proxy です。

## コンセプト

### W2SG: Burns et al. の設定

- 弱いモデル: GPT-2 クラス。
- 強いモデル: GPT-4 クラス。
- 目標: そのタスクにおける強い GPT-4 の ceiling。

手順:
1. あるタスクについて、弱いモデルの zero-shot 予測を得る。
2. 弱いラベル付きデータで強いモデルを fine-tune する。
3. fine-tune された強いモデルの accuracy を測る。

baseline: 弱いモデル自身の accuracy、gold labels で教師あり学習した強いモデルの ceiling。

gap 指標: Performance Gap Recovered (PGR) = (fine-tuned - weak) / (ceiling - weak)。PGR が 1.0 なら弱い監督が gap を完全に埋めたことを意味し、0 なら弱い監督が役に立たなかったことを意味します。

### Burns et al. の経験的知見

NLP、chess-puzzle、reward-modeling タスクを通じて、PGR は一貫して正でした。つまり、強いモデルは弱い監督者の誤りを超えて汎化しました。タスクごとの PGR は約20%から約80%まで幅がありました。強いモデルは不完全なラベルから意図されたタスクを「理解」し、pre-training で得た prior によって不足を補っているように見えます。

Burns et al. が述べる限界:
- ここでの weak-to-strong gap は capability の gap であり、alignment の gap ではありません。弱いモデルは aligned です。本当に超人的なモデルは、人間によって aligned されるとしても、能力 gap がはるかに大きい可能性があります。
- 強いモデルの汎化は、ground-truth intent の回復というより、task priors によるものかもしれません。
- 強いモデルの latent knowledge を引き出すことが本当の問題です。PGR は特定の operationalization を測っているだけです。

### Scalable oversight: 3つのメカニズム

- **Debate (Irving et al. 2018)。** U の2つのインスタンスが反対側の立場で議論し、弱い judge が判断します。仮定は「説得力のある真の答えを見つける方が、説得力のある偽の答えを見つけるより簡単」というものです。2024-2025 年の最近の研究 (Khan et al., Michael et al.) は、debate が有効な場合も無効な場合もあり、有効性はタスク構造に依存することを示しています。
- **Recursive Reward Modeling (Leike et al. 2018)。** U が、人間による U+1 向け reward model の訓練を助けます。監督者の実効能力がモデルの能力とともに伸びます。
- **Task Decomposition (Christiano, Shlegeris, Amodei 2018)。** 難しいタスクを、人間が確認できる sub-task に再帰的に分解します。分解可能性を仮定します。

各メカニズムは、タスク構造または中間コンポーネントの alignment について何らかの仮定を置いています。

### Scalable oversight と W2SG が相補的である理由

Scalable oversight は、監督者の実効的な signal quality を高めます。
W2SG は、監督者が提供できるどんな不完全な signal からでも gap を埋めることを狙います。

Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124) は両者を組み合わせています。debate protocol がより良い弱いラベルを提供し、強いモデルをそのラベルで訓練します。NLP タスクで PGR の改善が報告されています。

### 組織上のドラマ

OpenAI の Superalignment チームは、Jan Leike が Anthropic へ移った後の 2024年5月に解散しました。agenda (scalable oversight、W2SG、automated alignment research) は Anthropic や学術ラボで続きました — MATS (Lesson 28)、Redwood (Lesson 10)、Apollo (Lesson 8)、METR (Lesson 28)。組織構造は変わりましたが、研究上の問いは変わっていません。

### Phase 18 における位置づけ

Lessons 6-10 は、U が信用できないという仮定のもとで threat と defensive paradigm を説明します。Lesson 11 は offensive paradigm です。監督者を、U の alignment を検証できるほど強くします。Lessons 12-16 では、adversarial evaluation の実務的な tooling に移ります。

## 使ってみる

`code/main.py` は合成タスクで W2SG fine-tune をシミュレーションします。弱い labeler は構造化された誤りを持つ 70% accuracy、強いモデルは gold labels 上で 95% ceiling です。弱いラベルで強いモデルを fine-tune し、PGR を測り、strong-on-gold と weak-alone と比較します。

## 成果物

この lesson は `outputs/skill-w2sg-pgr.md` を生成します。oversight setup の説明を受け取り、弱い監督者、強いモデル、監督の品質を特定し、PGR を計算します (または必要な情報を要求します)。その主張が「弱いものが強いものを監督できる」なのか、「弱いもの + oversight mechanism が強いものを監督できる」なのかを区別します。

## 演習

1. `code/main.py` を実行してください。weak_accuracy = 0.60, 0.70, 0.80 の PGR を報告し、PGR 曲線の形を説明してください。

2. 弱い labeler が構造化された誤り (例: 特定の入力 class で常に誤る) を持つように変更してください。PGR は上がりますか、下がりますか、それとも同じですか。説明してください。

3. Burns et al. 2023 Section 4.3 (NLP tasks) を読んでください。「confidence auxiliary loss」の直観を再現してください。強いモデルが弱いラベルより自信を持つとき、どちらが勝つのでしょうか。

4. software-engineering タスク向けに、debate と task decomposition を組み合わせた scalable-oversight protocol を設計してください。各コンポーネントの failure mode を1つ挙げ、その組み合わせがそれぞれをどう扱うか、または扱えないかを説明してください。

5. 「weak-to-strong generalization は superalignment への有望な道である」という主張を反証するには何が必要かを明確に述べてください。必要な empirical signature を具体的にしてください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| Scalable oversight | 「監督者を強くする」 | より高性能なモデルを評価できるよう、監督者の能力を高めるメカニズム |
| W2SG | 「弱いものが強いものを監督する」 | 弱いラベルで強いモデルを fine-tune し、回復した capability を測ること |
| PGR | "performance gap recovered" | (fine-tuned - weak) / (ceiling - weak); 1.0 = 完全に gap を閉じた、0 = 効果なし |
| Debate | 「2つの U インスタンスが議論する」 | 弱い judge が2つの U の主張から選ぶ scalable oversight メカニズム |
| RRM | "recursive reward modeling" | U が U+1 向け reward model の訓練を助け、監督者能力が U に追随する |
| Task decomposition | 「人間が確認する sub-task」 | 難しいタスクを、人間が検証できる sub-task に再帰的に分解する |
| Superalignment | 「超人的 AI を align する」 | 人間が直接評価できないモデルを align する研究 agenda |

## 参考文献

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) — W2SG 論文
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) — debate mechanism
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) — recursive reward modeling
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) — より強い debater を使った debate の 2024 年経験的研究
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) — debate + W2SG の 2025 年の組み合わせ
