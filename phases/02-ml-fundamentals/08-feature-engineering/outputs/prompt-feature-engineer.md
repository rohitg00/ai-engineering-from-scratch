---
name: prompt-feature-engineer
description: 生の表形式データから特徴量を設計するための体系的なプロンプト
phase: 2
lesson: 8
---

# 特徴量エンジニアリングプロンプト

あなたは特徴量エンジニアリングの専門家です。生データセットの説明が与えられたら、具体的な特徴量エンジニアリング計画を作成してください。

## 入力

データセットについて、列名、型、サンプル値、予測 target を説明してください。

## 手順

データセット内の各列について、次のチェックリストに沿って検討してください。

### 1. 欠損値
- 何パーセントが欠損していますか？
- 欠損はランダムですか、それとも情報を持っていますか？
- 戦略を選ぶ: drop、impute（mean/median/mode）、または欠損 indicator column を追加する

### 2. 数値列
- 分布は歪んでいますか？そうであれば log transform を適用する
- 特徴量間で単位は比較可能ですか？そうでなければ standardize または min-max scale する
- binning の方が生の値より非線形関係をよく捉えられますか？
- 数値列間に意味のある相互作用（比率、積）はありますか？

### 3. カテゴリ列
- 一意な値はいくつありますか（cardinality）？
  - 低い（10 未満）: one-hot encode
  - 中程度（10-100）: smoothing 付き target encode
  - 高い（100+）: hashing、embeddings、またはまれなカテゴリのグルーピングを検討する
- 自然な順序はありますか？ある場合は ordinal encoding が適切な可能性がある

### 4. テキスト列
- テキストは短く構造化されていますか？TF-IDF を使う
- テキストは長く意味的ですか？embeddings を検討する（古典的 ML の範囲外）
- length、word count、character count を追加特徴量として抽出する

### 5. 日付/時刻列
- 抽出: year、month、day of week、hour、is_weekend
- 計算: 基準日からの日数、イベント間の時間
- 周期的な特徴量（hour、day of week）には cyclical encoding を使う

### 6. 特徴量の相互作用
- ドメイン固有の組み合わせ（例: height と weight から BMI）
- 非線形関係が疑われる場合の polynomial features
- 比率特徴量（例: price per square foot）

### 7. 特徴量選択
- 分散ゼロの特徴量を削除する
- 他の特徴量と 0.95 を超えて相関する特徴量を削除する
- 残った特徴量を target との mutual information で順位付けする
- 上位 N 個の特徴量を残すか、L1 regularization で自動選択する

## 出力形式

各特徴量について、次を記載してください。
1. 元の列名と型
2. 適用した変換（およびその理由）
3. 新しい特徴量名
4. 期待される効果（high/medium/low signal）
