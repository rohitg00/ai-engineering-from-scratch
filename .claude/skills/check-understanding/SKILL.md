---
name: check-understanding
version: 1.0.0
description: AI Engineering from Scratch のフェーズ別理解度クイズ。「quiz me」「test phase」「check my understanding」「do I know phase 3」または `/check-understanding <phase>` で起動します。
---

# 理解度チェック

AI Engineering from Scratch コースで完了したフェーズの理解度を確認します。

## 起動条件

このスキルは、ユーザーが次のように入力したときに起動します。
- `/check-understanding 3` または `/check-understanding deep-learning`
- "phase 2 のクイズを出して"
- "phase 1 をテストして"
- "transformers の理解度を確認して"
- "phase 3 は身についている？"
- "次のフェーズに進める？"

## 入力

引数としてフェーズ番号（0-19）またはフェーズ名を受け取ります。引数がない場合は、20個すべてのフェーズを一覧表示し、どのフェーズでテストしたいかをユーザーに尋ねます。

## フェーズ対応表

引数を `phases/` 配下の正しいフェーズディレクトリに対応付けます。

| 入力 | ディレクトリ | フェーズ名 |
|-------|-----------|------------|
| 0, setup, tooling | `00-setup-and-tooling` | Setup & Tooling |
| 1, math, math-foundations | `01-math-foundations` | Math Foundations |
| 2, ml, ml-fundamentals | `02-ml-fundamentals` | ML Fundamentals |
| 3, deep-learning, dl | `03-deep-learning-core` | Deep Learning Core |
| 4, cv, computer-vision, vision | `04-computer-vision` | Computer Vision |
| 5, nlp | `05-nlp-foundations-to-advanced` | NLP -- Foundations to Advanced |
| 6, speech, audio | `06-speech-and-audio` | Speech & Audio |
| 7, transformers | `07-transformers-deep-dive` | Transformers Deep Dive |
| 8, generative, gen-ai, genai | `08-generative-ai` | Generative AI |
| 9, rl, reinforcement-learning | `09-reinforcement-learning` | Reinforcement Learning |
| 10, llms, llm, llms-from-scratch | `10-llms-from-scratch` | LLMs from Scratch |
| 11, llm-engineering, llm-eng | `11-llm-engineering` | LLM Engineering |
| 12, multimodal | `12-multimodal-ai` | Multimodal AI |
| 13, tools, protocols, mcp | `13-tools-and-protocols` | Tools & Protocols |
| 14, agents, agent-engineering | `14-agent-engineering` | Agent Engineering |
| 15, autonomous | `15-autonomous-systems` | Autonomous Systems |
| 16, multi-agent, swarms | `16-multi-agent-and-swarms` | Multi-Agent & Swarms |
| 17, infrastructure, production, infra | `17-infrastructure-and-production` | Infrastructure & Production |
| 18, ethics, safety, alignment | `18-ethics-safety-alignment` | Ethics, Safety & Alignment |
| 19, capstone, projects | `19-capstone-projects` | Capstone Projects |

## 手順

### Step 1: フェーズを解決する

引数を解析します。数値の場合は、0以上19以下であることを検証します。範囲外なら、ユーザーに「フェーズ [N] は存在しません。有効なフェーズは 0-19 です。」と伝え、選べるように全フェーズの一覧を表示します。名前またはキーワードの場合は、上のフェーズ対応表で照合します。キーワードがどの項目にも一致しない場合は、「不明なフェーズ '[keyword]' です。以下の一覧から選んでください:」と伝え、20個すべてのフェーズを提示します。引数がない場合は、全一覧から選ぶようユーザーに尋ねます。

### Step 2: フェーズの内容を読む

Glob を使って `phases/<phase-dir>/` 配下のすべてのレッスンディレクトリを見つけます。各レッスンについて `docs/en.md` ファイルを読みます。これらのドキュメントには、問題作成の根拠となる教材が含まれています。

フェーズ全体を幅広くカバーするために必要な数のレッスンドキュメントを読みます。レッスン数が多いフェーズ（15以上）の場合は、序盤・中盤・終盤から代表的なものを優先して読みます。

### Step 3: 8問を作成する

直前に読んだレッスン内容に基づいて、選択式問題をちょうど8問作成します。

**問題1-4: 概念理解（What/Why）**
考え方、定義、理由付けの理解を確認します。例:
- "X の目的は何ですか？"
- "Z のときに Y が起こるのはなぜですか？"
- "A と B の関係を最もよく表している説明はどれですか？"
- "X はどの問題を解決しますか？"

**問題5-8: 実践理解（How/Build）**
応用知識と実装上の理解を確認します。例:
- "X をどのように実装しますか？"
- "Y を正しく解決するアプローチはどれですか？"
- "Z を構築する正しい手順はどれですか？"
- "学習中に X が観測された場合、何をすべきですか？"

各問題には、A、B、C（必要ならD）でラベル付けした3個または4個の選択肢を用意します。正解は必ず1つだけにします。不正解の選択肢はもっともらしく見えるが、教材を学習した人には明確に誤りだとわかるものにします。

各問題には、根拠にした具体的なレッスンをタグとして付けます（例: "Lesson 03: Matrix Transformations"）。

### Step 4: 問題を1問ずつ提示する

AskUserQuestion ツール（または同等の対話プロンプト）を使い、各問題を個別に提示します。形式:

```
問題 1/8（概念理解）-- Lesson 03: Matrix Transformations より

固有値の幾何学的な意味は何ですか？

A) 行列によって適用される回転角
B) 変換中に固有ベクトルが拡大・縮小される倍率
C) 変換行列の行列式
D) 変換後の行列のランク
```

次の問題に進む前に、ユーザーの回答を待ちます。

### Step 5: 記録して採点する

進行中の集計を保持します。
- 8問中の正解数
- 各不正解について、問題番号、ユーザーの回答、正解、根拠となったレッスンを記録

### Step 6: 結果を表示する

8問すべてが終わったら、スコアと評価を表示します。

**7-8問正解: 習得済み**
フェーズが19（Capstone Projects）の場合: "最終フェーズを習得しています。おめでとうございます。カリキュラム全体を完了しました。"
それ以外の場合: "Phase N をしっかり理解しています。Phase N+1: [next phase name] に進む準備ができています。"

**5-6問正解: あと少し**
"土台はできています。次に進む前に、次の領域を確認しましょう:"
続けて、不正解だった問題に対応するレッスンを一覧表示します。

**3-4問正解: 発展途上**
"理解は積み上がっていますが、いくつかのレッスンを復習する必要があります:"
続けて、各不正解問題と読み直すべきレッスンを一覧表示します。

**0-2問正解: 最初から復習**
"このフェーズにはもう少し時間が必要です。次の点に集中しながら、レッスンを最初からやり直しましょう:"
続けて、理解できていなかったすべてのトピックを一覧表示します。

### Step 7: 不正解の内訳

ユーザーが間違えた各問題について、次を表示します。

```
問題 N: [問題文の要約]
あなたの回答: B
正解: C -- [正しい選択肢の文]
理由: [C が正しい理由を1-2文で説明]
復習: Lesson NN -- [lesson name] (phases/<phase-dir>/NN-<lesson-slug>/docs/en.md)
```

### Step 8: 次にすること

最後に、次の3つの選択肢を提示します。

1. **このクイズを再受験する** -- 同じフェーズから新しい8問を作成する
2. **別のフェーズを試す** -- テストする別フェーズを選ぶ
3. **トピックを説明してもらう** -- 間違えた問題に出てきた概念について質問する

ユーザーの選択を待ち、それに応じて対応します。

## ルール

- 再受験では、問題プールを使い切るまで同じ問題を繰り返さないでください。使い切った後は、以降の再受験で問題をシャッフルするか言い換えます。
- 問題は一般知識ではなく、必ずレッスンドキュメントに直接基づいて作成してください。
- ユーザーが回答するまで正解を表示しないでください。
- 問題文は簡潔にします。最大でも1〜2文にしてください。
- 不正解の選択肢はもっともらしくしてください。冗談の選択肢は避けます。
- そのフェーズにまだレッスンドキュメントがない場合（`en.md` ファイルが見つからない場合）は、ユーザーに「Phase N にはまだレッスン内容がありません。クイズを受けるには、完了済みのフェーズを選んでください。」と伝えます。
