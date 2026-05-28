---
name: skill-clustering-guide
description: データ形状、ノイズ、制約に基づいて適切なクラスタリングアルゴリズムを選ぶ
version: 1.0.0
phase: 2
lesson: 7
tags: [clustering, k-means, dbscan, hierarchical, gmm, unsupervised]
---

# クラスタリングアルゴリズム選択ガイド

クラスタリングに唯一の最良アルゴリズムはありません。適切な選択は、クラスタの形状、クラスタ数が既知かどうか、データに含まれるノイズの量、データセットの規模によって決まります。

## 判断チェックリスト

1. クラスタ数を知っていますか？
   - はい: K-Means または GMM
   - いいえ: DBSCAN（クラスタを自動で見つける）、または hierarchical（dendrogram を異なるレベルで切る）

2. クラスタはどんな形ですか？
   - おおむね球状（blob 状）: K-Means
   - サイズの異なる楕円形: GMM
   - 任意形状（三日月、リング、鎖状）: DBSCAN
   - 入れ子または階層構造: hierarchical clustering

3. データにノイズや外れ値は含まれますか？
   - はい: DBSCAN（noise point を明示的にラベル付け）または GMM（低確率の点を外れ値とみなす）
   - いいえ: K-Means で十分

4. soft assignment（確率）が必要ですか？
   - はい: GMM は各クラスタについて P(cluster | data point) を返す
   - いいえ: K-Means または DBSCAN は hard assignment を返す

5. データセットはどれくらい大きいですか？
   - 10,000 未満: どのアルゴリズムでも使える
   - 10,000 から 1,000,000: K-Means（高速）、Mini-Batch K-Means（さらに高速）
   - 1,000,000 超: Mini-Batch K-Means または BIRCH。Hierarchical は遅すぎる

## 各アプローチを使う場面

**K-Means**: デフォルトの出発点です。高速（O(n * k * iterations)）で単純で、多くの問題では十分に機能します。K を選ぶには elbow method または silhouette score を使います。制約: 球状クラスタを仮定する、初期化に敏感（K-Means++ を使うか複数回実行する）、クラスタサイズが大きく異なる場合をうまく扱えません。

**DBSCAN**: 任意形状のクラスタ発見と外れ値の自動検出に最適です。パラメータは 2 つ、eps（近傍半径）と min_samples（最小密度）です。K を指定する必要はありません。制約: クラスタの密度が大きく異なると苦戦し、eps の調整が難しいことがあります。eps の推定には k-distance plot を使います。各点の k 番目に近い近傍までの距離を計算してソートし、elbow を探します。

**Hierarchical (Agglomerative)**: 結合の木を構築します。複数の粒度でクラスタ構造を探索したい場合に便利です（dendrogram を異なる高さで切る）。Ward's linkage はコンパクトなクラスタに最も向いています。Single linkage は細長いクラスタを見つけられますが、ノイズに敏感です。制約: O(n^2) memory と O(n^3) time が必要なため、大規模データセットには現実的ではありません。

**GMM (Gaussian Mixture Models)**: 確率的な割り当てを行う soft clustering です。各クラスタを独自の平均と共分散を持つ Gaussian distribution としてモデル化します。クラスタが楕円形または重なり合う場合は K-Means より適しています。コンポーネント数の選択には BIC (Bayesian Information Criterion) を使います。制約: Gaussian distribution を仮定する、非凸形状では失敗することがある、初期化に敏感です。

## クラスタ品質の評価（ラベルなし）

| 指標 | 測るもの | 範囲 | 使う場面 |
|--------|-----------------|-------|----------|
| Silhouette score | 凝集度と分離度 | -1 から 1（高いほどよい） | K の値やアルゴリズムを比較する |
| Inertia (within-cluster SS) | クラスタの締まり具合 | 0 から inf（低いほどよい） | K-Means の elbow method |
| BIC / AIC | 複雑さペナルティ付きのモデル適合度 | 低いほどよい | GMM のコンポーネント数を選ぶ |
| Calinski-Harabasz index | クラスタ間分散とクラスタ内分散の比 | 高いほどよい | 素早い比較 |
| Davies-Bouldin index | クラスタ間の平均類似度 | 低いほどよい | 重なり合うクラスタにペナルティを与える |

## よくある間違い

- 特徴量をスケーリングせずに K-Means を実行する（スケールの大きい特徴量が距離計算を支配する）
- 実データは高次元なのに 2D の見た目だけで K を選ぶ（silhouette score を使う）
- 非球状クラスタに K-Means を使う（三日月形やリング形のデータには DBSCAN が必要）
- DBSCAN の eps を大きくしすぎる（すべてが 1 クラスタ）または小さくしすぎる（すべてが noise）
- クラスタラベルを正解ラベルとして扱う（クラスタリングは探索的手法であり、ドメイン知識で検証する）
- 20,000 点を超えるデータセットに hierarchical clustering を実行する（メモリと時間が急増する）

## クイックリファレンス

| アルゴリズム | クラスタ形状 | K を見つけるか | ノイズ対応 | Soft assignment | スケーラビリティ |
|-----------|--------------|---------|---------------|-----------------|-------------|
| K-Means | 球状 | いいえ（自分で K を設定） | いいえ | いいえ | 数百万 |
| Mini-Batch K-Means | 球状 | いいえ | いいえ | いいえ | 数千万 |
| DBSCAN | 任意 | はい | はい | いいえ | 数十万 |
| Hierarchical | 任意（linkage に依存） | 柔軟（dendrogram を切る） | linkage に依存 | いいえ | 20k 未満 |
| GMM | 楕円形 | いいえ（自分で K を設定） | 部分的（低確率） | はい | 100k 未満 |
| HDBSCAN | 任意 | はい | はい | 部分的 | 数十万 |
