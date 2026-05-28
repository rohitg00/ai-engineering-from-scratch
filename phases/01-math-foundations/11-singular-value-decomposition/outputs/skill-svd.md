---
name: skill-svd
description: 圧縮、ノイズ除去、推薦、最小二乗解法などの実問題にSVDを適用する
phase: 1
lesson: 11
---

あなたはSingular Value Decompositionを実用的なエンジニアリング問題へ適用する専門家です。行列、データ圧縮、ノイズ、欠損データ、線形システムを含むタスクが与えられたら、SVDが適切な道具かどうか、またどう適用すべきかを判断してください。

## 判断フレームワーク

### Step 1: 問題の種類を特定する

- **データ圧縮 / 次元削減**: 切り詰めSVDを使う。上位k個の特異値を残す。kはエネルギーしきい値（95%が一般的な目標）または下流タスクの性能で選ぶ。
- **ノイズ除去**: 完全SVDを計算する。特異値スペクトルのギャップを探す。ギャップより下を切り捨てる。ギャップが信号とノイズを分ける。
- **欠損データ / 推薦**: 欠損要素を埋める（行平均またはゼロ）、SVDを計算する、低rankで再構成する。本番では欠損データをネイティブに扱うALSまたはincremental SVDを使う。
- **最小二乗 / 擬似逆行列**: SVDを計算する。非ゼロ特異値を反転する。V Sigma+ U^Tをターゲットベクトルに掛ける。正規方程式より安定。
- **テキスト類似度 / トピックモデリング**: 単語-文書行列を作る。SVDを適用する（これがLSA/LSI）。文書と単語を低rank空間へ射影する。比較にはcosine similarityを使う。
- **数値rankの判定**: SVDを計算する。（最大値に対する相対）しきい値を超える特異値を数える。行基本変形より信頼できる。
- **行列ノルムの計算**: スペクトルノルム = 最大特異値。Frobenius norm = sqrt(特異値の二乗和)。核ノルム = 特異値の和。
- **条件数**: sigma_max / sigma_min。システムが摂動にどれだけ敏感かを示す。

### Step 2: 適切な変種を選ぶ

| 状況 | 手法 | 理由 |
|-----------|--------|-----|
| 密行列で完全分解が必要 | `np.linalg.svd(A)` / Juliaの `svd(A)` | 標準アルゴリズムで、数値的に安定 |
| 上位k成分だけが必要 | `scipy.sparse.linalg.svds(A, k)` | kが小さいと完全SVDより高速 |
| 疎行列 | `scipy.sparse.linalg.svds` | 疎な格納を効率的に扱える |
| ストリーミングデータ | Incremental SVD / online SVD | 最初から再計算せずに分解を更新できる |
| 欠損データ（推薦） | ALS、Funk SVD、またはNMF | 標準SVDには完全な行列が必要 |
| 非常に大きい行列（数百万行） | Randomized SVD（`sklearn.utils.extmath.randomized_svd`） | O(mn min(m,n))ではなくO(mn log k) |
| 中心化済みデータのPCA | 中心化データ行列のSVD | 共分散の固有分解と等価だが、より安定 |

### Step 3: rank kを選ぶ

- **エネルギーしきい値**: 累積エネルギー = sum(sigma_1^2 ... sigma_k^2) / sum(all sigma^2) を計算する。エネルギーが0.95を超えたら止める（高忠実度タスクなら0.99）。
- **ギャップ検出**: 特異値をプロットする。急な落ち込みを探す。そのギャップが信号とノイズの境界を示す。
- **交差検証**: 下流タスクではkをスイープし、hold-outデータで性能を測る。
- **エルボー法**: 再構成誤差 vs kをプロットする。エルボーは、成分を増やしても効かなくなる場所。
- **ドメイン知識**: データにd個の潜在因子があるとわかっているなら、k = dを使う。

### Step 4: 結果を検証する

- **再構成誤差**: ||A - A_k|| / ||A|| を計算する。切り詰めに意味があるなら小さいはず。
- **説明分散**: PCA/圧縮では、捉えた全分散（エネルギー）の割合を報告する。
- **下流タスク性能**: SVDが前処理なら、end-to-endの指標を測る。
- **目視確認**: 画像では元画像と再構成画像を目で比較する。推薦では、既知の評価に対して予測を確認する。

## よくある間違い

- A^T Aの固有分解でSVDを計算する。これは条件数を二乗し、数値精度を失う。専用のSVDルーチンを使う。
- 上位k成分だけが必要なのに完全SVDを使う。大規模行列では切り詰めSVDまたはrandomized SVDを使う。
- 欠損要素を含む行列に標準SVDを直接適用する。標準SVDには完全な行列が必要。代わりにALSやFunk SVDなどの行列補完手法を使う。
- 中心化を無視する。PCAでは、SVDの前にデータを中心化（平均を引く）する必要がある。中心化しないと、第1成分は分散ではなく平均を捉える。
- 過度に切り詰める。特異値を少なすぎる数だけ残すと信号を失う。多すぎるとノイズを残す。エネルギーしきい値または交差検証を使う。
- SVDと固有分解を混同する。SVDは任意の行列（任意の形、任意のrank）で機能する。固有分解には、完全な固有ベクトル集合を持つ正方行列が必要。対称半正定値行列では両者は同じ。

## コードパターン

### クイック圧縮
```python
U, S, Vt = np.linalg.svd(A, full_matrices=False)
k = np.searchsorted(np.cumsum(S**2) / np.sum(S**2), 0.95) + 1
A_compressed = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
```

### 最小二乗のための擬似逆行列
```python
U, S, Vt = np.linalg.svd(A, full_matrices=False)
S_inv = np.array([1/s if s > 1e-10 else 0 for s in S])
x = Vt.T @ np.diag(S_inv) @ U.T @ b
```

### ノイズ除去
```python
U, S, Vt = np.linalg.svd(noisy_data, full_matrices=False)
k = find_gap(S)
clean_data = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
```

### 大規模PCA
```python
from sklearn.utils.extmath import randomized_svd
U, S, Vt = randomized_svd(X_centered, n_components=50, random_state=42)
explained_variance = S**2 / (n_samples - 1)
```

## SVDを使わない場合

- 行列が非常に疎で、少数の成分だけが必要な場合。疎固有値ソルバを直接使う。
- 非負の因子が必要な場合（トピックモデリング、スペクトル分解）。代わりにNMFを使う。
- データに強い非線形構造があり、線形手法では捉えられない場合。autoencodersまたはmanifold learningを使う。
- ストリーミングデータでリアルタイム更新が必要で、行列が常に変化する場合。incremental/online SVDまたは近似手法を使う。
- 行列はメモリに収まるが、randomized SVDでも遅すぎるほど大きい場合。sketching手法またはsampling-basedな手法を検討する。

## 計算コスト

| 手法 | 時間 | 空間 |
|--------|------|-------|
| m x n行列の完全SVD | O(mn min(m,n)) | O(mn) |
| 切り詰めSVD（上位k） | O(mnk) | O((m+n)k) |
| Randomized SVD（上位k） | O(mn log k) | O((m+n)k) |
| べき反復（1ベクトル） | O(mn * iters) | O(m+n) |

10000 x 5000の行列では:
- 完全SVD: 約2500億演算
- 切り詰めSVD（k=50）: 約25億演算
- Randomized SVD（k=50）: 約5億演算

規模と精度要件に合う手法を選んでください。
