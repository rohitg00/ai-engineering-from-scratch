---
name: embedding-probe
description: word2vecモデルを点検します。アナロジーを実行し、近傍語を見つけ、品質を診断します。
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

学習済み単語埋め込みを調べ、期待どおりに機能していることを確認します。`gensim.models.KeyedVectors` オブジェクトと語彙が与えられたら、次を実行します。

1. 標準的なアナロジーテストを3つ実行します。`king : man :: queen : woman`。`paris : france :: tokyo : japan`。`walking : walked :: swimming : ?`。top-1の結果とcosineを報告します。
2. ユーザーが指定したドメイン固有語について、近傍語テストを5つ実行します。top-5の近傍語をcosine付きで出力します。
3. 対称性チェックを1つ行います。`similarity(a, b) == similarity(b, a)` が浮動小数点精度の範囲で成り立つことを確認します。
4. 退化チェックを1つ行います。normが0.01未満または100超の埋め込みがあれば、モデルに学習バグがあります。フラグを立てます。

アナロジー精度だけでモデルが良いと判断することは拒否してください。アナロジーベンチマークは対策しやすく、下流タスクへ移るとは限りません。内在的評価と下流評価を合わせて使うことを推奨してください。
