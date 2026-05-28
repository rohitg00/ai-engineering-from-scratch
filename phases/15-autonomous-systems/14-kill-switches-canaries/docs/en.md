# キルスイッチ、サーキットブレーカー、カナリアトークン

> キルスイッチは、エージェントの編集サーフェスの外側に保持されるbooleanである。Redis key、feature flag、署名付きconfigなどで、エージェント全体を無効化する。サーキットブレーカーはより細かい。特定のパターン（同一ツール呼び出しが5回連続するなど）でトリップし、問題の経路を一時停止し、人間へエスカレーションする。カナリアトークンは古典的な欺瞞技術を継承している。エージェントが正当な理由で触れることのない偽credentialやhoneypot recordを置き、それへのアクセスでアラートを発火する。eBPFベースのdatapath（例: Cilium）は、隔離されたpodのegressをkernel layerでフォレンジックhoneypotへ書き換えられる。公開されているCiliumベンチマークでは、負荷下でdatapathのP99レイテンシが1ミリ秒未満と報告されている（伝播予算はdatapath自体ではなく、policy updateがnodeへどう届くかに依存する）。移動するbaselineに適応する統計検出器（EWMA、CUSUM）は、driftを静かに受け入れてしまう。それらには、曲がらないハードなconstitutional limitを重ねる。

**タイプ:** Learn
**言語:** Python（stdlib、3種の検出器シミュレーター: キルスイッチ、サーキットブレーカー、カナリア）
**前提条件:** Phase 15 · 13（Cost governors）、Phase 15 · 10（Permission modes）
**所要時間:** 約60分

## 問題

コストガバナー（レッスン13）は、エージェントが使える金額を制限する。しかし、その予算内でエージェントが何をできるかは制限しない。$50のベロシティ制限を持つエージェントでも、secretを外部流出させたり、間違った投稿を公開したり、リソースを削除したりできる。高くつくアクションは、トークン上は安いことが多い。

このレッスンでは、コスト層の隣に置かれる3つの検出器を扱う。

1. **キルスイッチ**: エージェントの手の届かない場所に置かれたbooleanのオフボタン。
2. **サーキットブレーカー**: 特定の経路を一時停止するアクションパターン検出器。
3. **カナリアトークン**: 正当な理由がないエージェントが触れることで、自らを露呈する餌。

3つともLLM以前からあるエンジニアリングである。古典的な欺瞞、rate-limit breaker、feature-flag killは、自律エージェントより前から存在する。新しいのは攻撃サーフェスである。エージェントは信頼できないコンテンツを読み（レッスン11）、自分自身のmemoryを編集し、安全に見える多数のアクションを危険な1つに合成できる。ここで挙げる検出器が機能するのは、エージェントの自己申告を信頼しないからである。

## 概念

### キルスイッチ

キルスイッチは、エージェントが読み取れるが書き込めないbooleanである。実装の選択肢は次のとおり。

- **マネージドサービス内のfeature flag。** LaunchDarkly、Statsig、Unleash。更新は数秒で伝播する。
- **エージェントがポーリングするRedis key。** 単純だが、エージェントプロセスが毎ターン確認する必要がある。
- **オブジェクトストレージ内の署名付きconfig。** エージェントは起動時に署名を検証し、署名されていない状態を拒否する。
- **OSレベルのsignalまたはcontainer-lifecycle kill。** Docker `kill`、Kubernetes `kubectl delete pod`、systemd stop。

正しいキルスイッチが持つ性質は次のとおり。

- エージェントはそれを`off`に設定できない。（エージェントのcredentialでは書き込めないシステムに存在する。）
- 起動時だけでなく、結果を伴うすべてのアクションで確認される。
- オフのとき、エージェントは外部から観測可能なことを何もしない。エージェントが到達できるシステムへのログ記録も含む。
- 再有効化は明示的な人間の操作であり、自動タイムアウトではない。

### サーキットブレーカー

サーキットブレーカーは、エージェント全体ではなく特定のパターンを一時停止する。古典的な形（2007年のNygardの書籍に由来し、今も有効）は次のとおり。

- **Closed**: アクションが許可される。
- **Open**: アクションがブロックされる。
- **Half-open**: cool-down後、1〜3回のprobe attemptを許可する（デフォルトは1）。成功すればbreakerを閉じ、残る失敗があれば再び開く。

エージェントに関係するトリガー:

- 同一ツール呼び出しが5回連続する（反復ループ）。
- 同じツールで、異なる入力に対して5回連続で失敗する（systemic failure）。
- ツール呼び出しレートがしきい値を超える（レッスン13のベロシティ）。
- 信頼境界外のコンテンツを読んだ後に、特定ツール（例: `file.delete`）が呼び出される（レッスン11）。

### カナリアトークン

カナリアトークン（honeytokenとも呼ばれる）は、エージェントが決して触れるべきではない入力である。アクセスそのものがアラームになる。

エージェント向けの例:

- 実権限を持たない偽の`AWS_SECRET_ACCESS_KEY`を環境内に置く。外部流出の試みは即座に帰属可能になる。
- 既知のsentinel値で印付けされた偽のデータベースレコード。このレコードのreadまたはupdateはすべてアラートを発火する。
- ワークスペース内の偽ファイル。このファイルのreadまたはeditは疑わしい。
- セッション開始時に注入された偽のmemory entry。後の出力にそれが現れたら、memoryが外部流出している。

カナリア設計はworkflowに固有である。エージェントに触れる正当な理由があるカナリアはノイズである。

### なぜ統計的制限とハード制限を重ねるのか

統計検出器（EWMA、CUSUM、ツール呼び出しレートのz-score）は、移動するbaselineに適応する。これは正当なdriftに対しては機能であり、敵対的driftに対してはバグである。忍耐強い攻撃者は、アラームが発火しない程度にゆっくりbaselineをずらせる。

ハードなconstitutional limit（レッスン17）は曲がらない。constitutional ruleとしての「`secrets@`に決してメールしない」は、より単純で監査可能であり、ゆっくりしたdriftで攻略できない。重ね方のパターンはこうだ。統計検出器が大半のノイズを捕まえ、ハード制限が検出器をすり抜けた攻撃を捕まえる。

### eBPF datapath redirectによる隔離

CiliumのeBPFベースのnetwork policyは、隔離されたpodのegressをkernel layerでフォレンジックhoneypotへ書き換えられる。Ciliumの公開ベンチマークでは、TCP_RR上のdatapath P99レイテンシは1ミリ秒未満と報告されている。自分のクラスターで隔離を*トリガーする*ための実時間予算は、policy updateがcontrol planeからnodeへどう伝播するかに支配される（operatorを事前ロードしたKubernetesでは数百ミリ秒が現実的であり、tail latencyはクラスターサイズとreconcile cadenceに依存する）。これにより2つのものが得られる。エージェントが実データを外部流出しないこと、そしてhoneypot内でのエージェントの挙動を完全に観測できることだ。カナリアトークンと同じパターンを別の層で実施している。エージェントは、封じ込められた状態で何をしようとするかによって意図を露呈する。

### どの検出器も捕まえられないもの

- **許可されたプリミティブから合成される意味的攻撃。** 個々のアクションはすべての検出器を通過する。問題は合成である。これはレッスン10のAuto Mode composite failureである。
- **ペイロードの一部に検出器を含む攻撃。** エージェントが「行動する前にcanaryを無効化せよ」と書かれたページを読み、その能力を持っている場合、検出器は侵害される。カナリアトークンは、エージェントが変更できないシステムに置くべきである。

## 使ってみる

`code/main.py`は、3つの検出器を通る短いエージェント軌跡をシミュレートする。外部dictに保持されたキルスイッチ、同一ツール呼び出し5回でトリップするサーキットブレーカー、readでアラートを発火するカナリアファイルを含む。正当なアクション、反復ループ、カナリアprobe、そしてキルスイッチによってエージェントのアクションが停止されるシナリオからなる合成軌跡を入力する。

## 仕上げる

`outputs/skill-tripwire-design.md`は、エージェントデプロイ向けに提案された検出器スタックをレビューし、ギャップ（キルスイッチ不足、カナリア不足、サーキットブレーカーしきい値が緩すぎる等）を指摘する。

## 演習

1. `code/main.py`を実行する。サーキットブレーカーがターン5（5回目の同一呼び出し）で発火し、カナリアがターン9（fake-key read）で発火することを確認する。

2. 統計検出器を追加する。ツール呼び出しレートに対するEWMA z-scoreである。ゆっくりdriftする軌跡を入力し、その検出器が発火しないことを示す。次にハード制限（10分間に50回を超えるツール呼び出しは禁止）を追加し、同じ軌跡でハード制限が発火することを示す。

3. ブラウザーエージェント（レッスン11）のためのカナリアトークンセットを設計する。少なくとも3つのカナリアと、それぞれが何を検出するかを列挙する。

4. Cilium network-policy docsを読む。egress-redirectによる隔離フローを具体的に説明する。どのpolicy selector、どのpod、どのegress rewrite、どのalertか。「隔離を決定する」から「最初のパケットがリダイレクトされる」までの実時間レイテンシは何に支配されるか。

5. キルスイッチが入ったエージェントの再有効化手順を定義する。誰が再有効化できるか。何を文書化しなければならないか。再有効化前にエージェントについて何を変更しなければならないか。

## 重要語句

| 用語 | よく言われること | 実際の意味 |
|---|---|---|
| Kill switch | 「オフボタン」 | エージェントの編集サーフェス外にあるboolean。結果を伴うすべてのアクションで確認される |
| Circuit breaker | 「パターン一時停止」 | 反復、失敗率、rate-limitに対してアクション単位でトリップする仕組み |
| Canary token | 「Honeytoken」 | エージェントが触れる正当な理由のない餌。アクセスでアラートを発火する |
| Honeypot | 「フォレンジックsandbox」 | 隔離されたエージェントが観測される、リダイレクト先のtraffic / workspace |
| EWMA | 「移動平均」 | 指数加重。driftに適応する（機能でもありバグでもある） |
| CUSUM | 「累積和」 | baselineからの持続的なshiftを検出する |
| Hard limit | 「Constitutional rule」 | 適応しない。履歴に関係なく一定である |
| Constitutional limit | 「常に真のルール」 | レッスン17のconstitutionに紐づく。エージェントは編集できない |

## 参考資料

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 自律エージェントにおけるkill-switchとcircuit-breakerの整理。
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — 本番ガバナンスパターン。
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — detection-and-response要件。
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) — podレベルのegress redirectとフォレンジックhoneypotパターン。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 「constitutional limit」としてのハードコードされた禁止事項。
