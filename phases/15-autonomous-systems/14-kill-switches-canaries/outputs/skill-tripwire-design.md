---
name: tripwire-design
description: 最初の自律実行の前に、提案されたエージェント検出器スタック（キルスイッチ、サーキットブレーカー、カナリアトークン）をレビューし、不足しているtripwireを指摘する。
version: 1.0.0
phase: 15
lesson: 14
tags: [kill-switch, circuit-breaker, canary, honeytoken, detection-and-response]
---

エージェントデプロイ向けに提案された検出器スタックを受け取り、3検出器のリファレンス（キルスイッチ、サーキットブレーカー、カナリア）に照らして監査し、不足しているもの、調整ミスがあるもの、エージェントに露出しているものを指摘する。

作成するもの:

1. **キルスイッチ監査。** スイッチはどこにあるか（feature flag、Redis、signed config）。エージェントのcredentialではそれをオフにできないことを確認する。起動時だけでなく、結果を伴うすべてのアクションがスイッチを確認することを確認する。再有効化が明示的な人間の操作であることを確認する。
2. **サーキットブレーカーインベントリ。** breakerが監視するすべてのパターン（反復、連続失敗、rate、信頼境界外のread後の特定ツール）を列挙する。それぞれのthresholdとcool-downを示す。10を超えるthresholdは通常、緩すぎる。
3. **カナリア設計。** 環境内のすべてのカナリアトークンを列挙する。それぞれについて、それが何か（fake credential、fake DB record、fake file、fake memory entry）、どこにあるか、どのアクセスでアラームが発火するか、誰にページングするかを示す。どのカナリアにも触れる正当な理由がないことを確認する。
4. **統計 + ハードの重ね合わせ。** スタックが、統計検出器（EWMA、z-score）に加えて、少なくとも1つのハード制限（レッスン17のconstitutional style）を使っていることを確認する。統計のみの検出器は、ゆっくりしたdriftを受け入れてしまう。
5. **隔離経路。** 検出器が発火したときに何が起きるか。エージェント全体の停止、経路固有の一時停止、traffic redirect（eBPF / Cilium honeypot）、alert-only。経路が少なくとも1回end-to-endでテストされていることを確認する。

強制却下:
- 外部キルスイッチがないデプロイ。
- エージェントがwrite accessを持つシステムに保存されたカナリアトークン。
- ハード制限がない統計のみの検出。
- 人間のレビューなしで自動再有効化するcool-downを持つサーキットブレーカー。
- キルスイッチがアクションごとではなく起動時にしか確認されない無人実行。

拒否ルール:
- ユーザーが、キルスイッチをホストする、エージェントのcredential外にある具体的なシステムを名前で示せない場合は拒否する。「エージェントが読むconfig fileを使う」は、エージェントがconfig fileを書けるならキルスイッチではない。
- ユーザーがAuto Mode分類器（レッスン10）をtripwireの代替として扱う場合は拒否する。分類器はdetection-and-responseとは直交する。
- 提案されたカナリアが、エージェントに読む正当な理由のあるシステムに置かれている場合は拒否し、再設計を要求する。

出力形式:

以下を含むtripwire監査を返す:
- **キルスイッチ行**（location、check cadence、re-enable procedure）
- **サーキットブレーカーテーブル**（pattern、threshold、cool-down）
- **カナリアテーブル**（token、location、alarm、owner）
- **重ね合わせメモ**（statistical + hard limits present y/n）
- **隔離フロー**（what fires、what happens、tested y/n）
- **準備状況**（production / staging / research-only）
