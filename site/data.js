// build.js による自動生成ファイルです。手動編集しないでください。
// 最終ビルド: 2026-05-28T23:13:01.092Z

const PHASES = [
  {
    "id": 0,
    "name": "セットアップとツール",
    "status": "complete",
    "desc": "これ以降の学習に向けて環境を整えます。",
    "lessons": [
      {
        "name": "Dev Environment",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/01-dev-environment/",
        "summary": "あなたのツールが思考を形作る。一度セットアップしたら、正しくセットアップする。",
        "keywords": "ステップ1：システム基盤 · ステップ2: uvを使ったPython · ステップ3: pnpm を使用した Node.js · ステップ4: Rust · ステップ 5: Julia (オプション) · ステップ6: GPUセットアップ（お持ちの場合） · ステップ 7: すべての検証"
      },
      {
        "name": "Git & Collaboration",
        "status": "complete",
        "type": "Learn",
        "lang": "—",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/02-git-and-collaboration/",
        "summary": "バージョン管理は任意ではありません。ここで作るすべての実験、すべてのモデル、すべてのレッスンを記録します。",
        "keywords": "ステップ1: gitを設定する · ステップ2: 日常のワークフロー · ステップ3: 実験用にブランチを切る · ステップ4: このコースのリポジトリで作業する"
      },
      {
        "name": "GPU Setup & Cloud",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/03-gpu-setup-and-cloud/",
        "summary": "学習目的ならCPUで十分です。本格的に学習させるならGPUが必要です。",
        "keywords": "選択肢1: ローカルNVIDIA GPU · 選択肢2: Google Colab · 選択肢3: クラウドGPU · GPUがなくても大丈夫"
      },
      {
        "name": "APIs & Keys",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/04-apis-and-keys/",
        "summary": "すべてのAI APIは同じ仕組みです。リクエストを送り、レスポンスを受け取る。細部は変わっても、パターンは変わりません。",
        "keywords": "ステップ1: APIキーを安全に保存する · ステップ2: 最初のAPI呼び出し（Python） · ステップ3: 最初のAPI呼び出し（TypeScript） · ステップ4: 生HTTP（SDKなし）"
      },
      {
        "name": "Jupyter Notebooks",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/05-jupyter-notebooks/",
        "summary": "notebookはAIエンジニアリングの実験台です。ここで試作し、うまくいったものを本番用コードへ移します。",
        "keywords": "ステップ1: インターフェースを選ぶ · ステップ2: 重要なキーボードショートカット · ステップ3: cellの種類 · ステップ4: マジックコマンド · ステップ5: リッチな出力をインライン表示する · ステップ6: Google Colab · Notebooks vs Scripts: どちらをいつ使うか · よくある落とし穴"
      },
      {
        "name": "Python Environments",
        "status": "complete",
        "type": "Build",
        "lang": "Shell",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/06-python-environments/",
        "summary": "依存関係地獄は実在します。仮想環境はその治療法です。",
        "keywords": "選択肢1: uv venv（推奨） · 選択肢2: venv（標準搭載） · 選択肢3: conda（必要な場合） · このコースでは: フェーズごとの戦略 · 1. globalにインストールする · 2. pipとcondaを混ぜる · 3. activateし忘れる · 4. .venvをgitにcommitする · 5. CUDAバージョン不一致"
      },
      {
        "name": "Docker for AI",
        "status": "complete",
        "type": "Build",
        "lang": "Docker",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/07-docker-for-ai/",
        "summary": "containerは「自分のマシンでは動く」を過去のものにします。",
        "keywords": "AIプロジェクトでDockerが特に必要な理由 · 重要語彙 · AIでよく使うcontainer pattern · ステップ1: Dockerをインストールする · ステップ2: NVIDIA Container Toolkitをインストールする（NVIDIA GPU付きLinux） · ステップ3: base imageを理解する · ステップ4: AI開発用Dockerfileを書く · ステップ5: dataとmodel用のvolume mount · ステップ6: multi-service AI app用のDocker Compose · ステップ7: AI作業で便利なDocker command · GPUがない場合"
      },
      {
        "name": "Editor Setup",
        "status": "complete",
        "type": "Build",
        "lang": "—",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/08-editor-setup/",
        "summary": "エディタはあなたの副操縦士です。一度だけ設定し、作業の邪魔をせず、きちんと役に立つ状態にします。",
        "keywords": "ステップ1: VS Codeをインストールする · ステップ2: 必須拡張機能をインストールする · ステップ3: 設定する · ステップ4: Terminal統合 · ステップ5: Remote Development（GPU boxへSSH） · Cursor · Windsurf · Vim/Neovim"
      },
      {
        "name": "Data Management",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/09-data-management/",
        "summary": "データは燃料です。管理の仕方が、どれだけ速く進めるかを決めます。",
        "keywords": "ステップ1: datasetsライブラリをインストールする · ステップ2: datasetを読み込む · ステップ3: 大きなdatasetをstreamする · ステップ4: dataset形式 · ステップ5: Data split · ステップ6: modelをdownloadしてcacheする · ステップ7: 大きなfileを扱う · ステップ8: Storage pattern"
      },
      {
        "name": "Terminal & Shell",
        "status": "complete",
        "type": "Learn",
        "lang": "—",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/10-terminal-and-shell/",
        "summary": "terminalはAIエンジニアが暮らす場所です。ここに慣れてください。",
        "keywords": "ステップ1: 自分のshellを知る · ステップ2: pipeとredirect · ステップ3: background process · ステップ4: tmux · ステップ5: htopとnvtopで監視する · ステップ6: remote GPU box用SSH · ステップ7: AI作業に便利なalias · ステップ8: AIでよく使うterminal pattern"
      },
      {
        "name": "Linux for AI",
        "status": "complete",
        "type": "Learn",
        "lang": "—",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/11-linux-for-ai/",
        "summary": "AI の多くは Linux 上で動きます。詰まらず作業できるだけの知識が必要です。",
        "keywords": "移動 · ファイルとディレクトリ · ファイルを読む · 検索"
      },
      {
        "name": "Debugging & Profiling",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/12-debugging-and-profiling/",
        "summary": "最悪の AI バグはクラッシュしません。壊れたデータで静かに学習し、美しい損失曲線を出します。",
        "keywords": "Part 1: print デバッグ（ちゃんと効きます） · Part 2: Python デバッガ（pdb と breakpoint） · Part 3: Python ロギング · Part 4: コード区間の時間計測 · Part 5: cProfile と line_profiler · Part 6: メモリプロファイリング · Part 7: AI でよくあるバグと捕まえ方 · Part 8: TensorBoard の基本 · Part 9: VS Code デバッガ"
      }
    ]
  },
  {
    "id": 1,
    "name": "数学の基礎",
    "status": "complete",
    "desc": "すべての AI アルゴリズムの直感を、コードで身につけます。",
    "lessons": [
      {
        "name": "Linear Algebra Intuition",
        "status": "complete",
        "type": "Learn",
        "lang": "Python, Julia",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/01-linear-algebra-intuition/",
        "summary": "すべてのAIモデルは、凝った帽子をかぶった行列計算にすぎません。",
        "keywords": "ベクトルは点であり方向でもある · 行列は変換である · 内積は類似度を測る · 線形独立 · 基底とランク · 射影 · Gram-Schmidtの直交化 · ステップ 1: スクラッチでベクトル (Python) · ステップ 2: スクラッチで行列 (Python) · ステップ 3: これがAIで重要な理由 · ステップ 4: Julia版 · ステップ 5: 線形独立と射影をスクラッチ実装する (Python) · NumPyでランク、射影、QRを扱う · PyTorch - テンソルはAutodiff付きのベクトル"
      },
      {
        "name": "Vectors, Matrices & Operations",
        "status": "complete",
        "type": "Build",
        "lang": "Python, Julia",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/02-vectors-matrices-operations/",
        "summary": "すべてのニューラルネットワークは、追加の手順が付いた行列積にすぎません。",
        "keywords": "ベクトル: 順序付きの数値リスト · 行列: 数値の格子 · shapeが重要な理由 · 演算マップ · 要素ごとの積と行列積 · ブロードキャスト · ステップ 1: Vectorクラス · ステップ 2: 中核演算を持つMatrixクラス · ステップ 3: 動かしてみる · ステップ 4: ニューラルネットワークへつなげる"
      },
      {
        "name": "Matrix Transformations & Eigenvalues",
        "status": "complete",
        "type": "Build",
        "lang": "Python, Julia",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/03-matrix-transformations/",
        "summary": "行列は空間を変形する機械です。すべての点に何をするかを理解すれば、変換全体を理解できます。",
        "keywords": "行列としての変換 · 回転 · スケーリング · せん断 · 反射 · 合成: 変換をつなぐ · 固有値と固有ベクトル · 固有分解 · 固有値が重要な理由 · 体積スケーリング係数としての行列式 · ステップ 1: 変換行列をスクラッチ実装する (Python) · ステップ 2: 変換の合成 · ステップ 3: 固有値をスクラッチで求める (2x2) · ステップ 4: 体積スケーリング係数としての行列式 · NumPyによる3D回転"
      },
      {
        "name": "Calculus for ML: Derivatives & Gradients",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/04-calculus-for-ml/",
        "summary": "導関数は、どちらへ進めば下り坂かを教えてくれる。ニューラルネットワークが学習するために必要なのはそれだけです。",
        "keywords": "導関数とは何か · 偏導関数: 1回に1つの変数だけを見る · 勾配: すべての偏導関数を集めたベクトル · 最適化とのつながり · 数値微分と解析的微分 · 簡単な関数を手で微分する · 連鎖律 · ヘッセ行列 · テイラー展開近似 · 機械学習における積分 · 計算グラフにおける多変数の連鎖律 · ヤコビ行列 · これがニューラルネットワークで重要な理由 · Step 1: スクラッチで数値微分 · Step 2: 偏導関数と勾配 · Step 3: f(x) = x^2 の最小値を勾配降下法で探す · Step 4: 2次元関数での勾配降下法 · Step 5: 数値微分と解析的微分の比較 · Step 6: ヘッセ行列を数値的に計算する · Step 7: テイラー近似を実際に使う · Step 8: これがニューラルネットワークで重要な理由"
      },
      {
        "name": "Chain Rule & Automatic Differentiation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/05-chain-rule-and-autodiff/",
        "summary": "連鎖律は、学習するすべてのニューラルネットワークのエンジンです。",
        "keywords": "連鎖律 · 計算グラフ · 順モードと逆モード · 順モードのための双対数 · Autograd エンジンを作る · PyTorch Autograd の内部の動き · Step 1: Value クラス · Step 2: 勾配追跡つきの算術演算 · Step 3: 逆伝播 · Step 4: 完全なエンジンに必要な追加演算 · Step 5: スクラッチのミニ MLP · Step 6: 勾配チェック · Step 7: 手計算との照合 · PyTorch と照合する · もう少し複雑な式"
      },
      {
        "name": "Probability & Distributions",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/06-probability-and-distributions/",
        "summary": "確率は、AI が不確実性を表現するための言語です。",
        "keywords": "事象、標本空間、確率 · 条件付き確率と独立性 · 確率質量関数と確率密度関数 · よく使う分布 · 期待値と分散 · 同時分布と周辺分布 · 正規分布が至るところに現れる理由 · 対数確率 · 確率分布としての Softmax · サンプリング · Step 1: 確率の基礎 · Step 2: PMF と PDF をスクラッチで作る · Step 3: 期待値と分散 · Step 4: 分布からのサンプリング · Step 5: Softmax と対数確率 · Step 6: 中心極限定理のデモ · Step 7: 可視化"
      },
      {
        "name": "Bayes' Theorem & Statistical Thinking",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/07-bayes-theorem/",
        "summary": "確率は、あなたが何を予想するかを扱います。ベイズの定理は、あなたが何を学ぶかを扱います。",
        "keywords": "同時確率からベイズへ · 4つの構成要素 · 医療検査の例 · スパムフィルターの例 · ナイーブベイズ: 独立性の仮定 · 最尤推定（MLE） · 最大事後確率推定（MAP） · ベイズ主義と頻度主義: 実務上の違い · MLでベイズ的思考が重要な理由 · ステップ 1: ベイズの定理の関数 · ステップ 2: ナイーブベイズ分類器 · ステップ 3: スパムデータで訓練する · ステップ 4: 学習された確率を調べる · 共役事前分布 · 逐次ベイズ更新 · A/Bテストとのつながり"
      },
      {
        "name": "Optimization: Gradient Descent Family",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/08-optimization/",
        "summary": "ニューラルネットワークの訓練とは、谷底を見つけることにすぎません。",
        "keywords": "最適化とは何か · 勾配降下法（vanilla） · 学習率: 最も重要なハイパーパラメータ · SGD vs batch vs mini-batch · Momentum: 下り坂を転がるボール · Adam: 適応的な学習率 · 学習率スケジュール · 凸と非凸 · 損失地形の可視化 · ステップ 1: テスト関数を定義する · ステップ 2: 通常の勾配降下法 · ステップ 3: Momentum付きSGD · ステップ 4: Adam · ステップ 5: 実行して比較する"
      },
      {
        "name": "Information Theory: Entropy, KL Divergence",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/09-information-theory/",
        "summary": "情報理論は驚きを測ります。損失関数はその上に作られています。",
        "keywords": "情報量（驚き） · エントロピー（平均的な驚き） · クロスエントロピー（毎日使っている損失関数） · KLダイバージェンス（分布間の距離） · 相互情報量 · 条件付きエントロピー · 結合エントロピー · 相互情報量（深掘り） · Label Smoothingとクロスエントロピー · なぜクロスエントロピーが分類損失の本命なのか · Bits vs Nats · パープレキシティ · ステップ 1: 情報量とエントロピー · ステップ 2: クロスエントロピーとKLダイバージェンス · ステップ 3: 分類損失としてのクロスエントロピー · ステップ 4: クロスエントロピーは負のlog尤度に等しい · ステップ 5: 相互情報量"
      },
      {
        "name": "Dimensionality Reduction: PCA, t-SNE, UMAP",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/10-dimensionality-reduction/",
        "summary": "高次元データには構造があります。適切な角度から見れば、それを見つけられます。",
        "keywords": "次元の呪い · PCA: 重要な方向を見つける · 説明分散比 · 成分数の選び方 · t-SNE: 近傍を保つ · UMAP: より高速で、大域構造をより保つ · どれをいつ使うか · Kernel PCA · 再構成誤差 · Step 1: PCAをスクラッチから実装する · Step 2: 合成データでテストする · Step 3: MNISTの数字を2Dにする · Step 4: sklearnと比較する · Step 5: UMAPと比較する"
      },
      {
        "name": "Singular Value Decomposition",
        "status": "complete",
        "type": "Build",
        "lang": "Python, Julia",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/11-singular-value-decomposition/",
        "summary": "SVDは線形代数の万能ナイフです。どんな行列にも存在し、すべてのデータサイエンティストに必要です。",
        "keywords": "SVDは幾何学的に何をするか · 完全な分解 · 左特異ベクトル、特異値、右特異ベクトル · 外積形式 · 固有分解との関係 · 切り詰めSVD: 低rank近似 · SVDによる画像圧縮 · 推薦システムにおけるSVD · NLPにおけるSVD: Latent Semantic Analysis · ノイズ除去のためのSVD · SVDによる擬似逆行列 · 数値安定性上の利点 · PCAとのつながり · Step 1: べき反復を使ってSVDをスクラッチから実装する · Step 2: テストしてNumPyと比較する · Step 3: 画像圧縮デモ · Step 4: ノイズ除去 · Step 5: 擬似逆行列"
      },
      {
        "name": "Tensor Operations",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/12-tensor-operations/",
        "summary": "テンソルは、データと深層学習をつなぐ共通言語です。すべての画像、すべての文、すべての勾配がテンソルを通って流れます。",
        "keywords": "テンソルとは · 深層学習におけるtensor shape · メモリレイアウトの仕組み · ブロードキャスト規則 · Einsum: 万能のテンソル演算 · Step 1: Tensor storageとstrides · Step 2: Reshape、squeeze、unsqueeze · Step 3: Transposeとpermute · Step 4: 要素ごとの演算とreduction · Step 5: NumPyでのブロードキャスト · Step 6: Einsum演算 · Step 7: Einsumによるattention mechanism · ScratchとNumPyの比較 · ScratchとPyTorchの比較 · すべてのneural network layerをtensor operationとして見る"
      },
      {
        "name": "Numerical Stability",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/13-numerical-stability/",
        "summary": "浮動小数点は漏れのある抽象化です。学習中に突然噛みつき、事前には見えません。",
        "keywords": "IEEE 754: コンピュータが実数を保存する方法 · なぜ 0.1 + 0.2 != 0.3 なのか · Catastrophic Cancellation · Overflow と Underflow · Log-Sum-Exp Trick · Softmax に max-subtraction が必要な理由 · NaN と Inf の検出・予防 · Numerical Gradient Checking · Mixed Precision Training · bfloat16 vs float16 · Gradient Clipping · Normalization Layers · よくある ML 数値バグ"
      },
      {
        "name": "Norms & Distances",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/14-norms-and-distances/",
        "summary": "距離関数は「似ている」の意味を定義します。選び方を間違えると、その先のすべてが壊れます。",
        "keywords": "Norms: ベクトルの大きさを測る · L1 Norm（Manhattan distance） · L2 Norm（Euclidean distance） · Lp Norm と L-infinity · Cosine Similarity と Cosine Distance · Dot Product vs Cosine · Mahalanobis Distance · Jaccard Similarity · Edit Distance（Levenshtein Distance） · KL Divergence · Wasserstein Distance · タスク別の距離選択 · Loss Functions と Regularization · Nearest Neighbor Search"
      },
      {
        "name": "Statistics for ML",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/15-statistics-for-ml/",
        "summary": "統計は、モデルが本当に機能しているのか、たまたま運がよかっただけなのかを知る方法です。",
        "keywords": "Descriptive Statistics · Correlation · Covariance Matrix · Hypothesis Testing · t-test · Chi-squared Test · A/B Testing for ML Models · Statistical Significance vs Practical Significance · Multiple Comparison Problem · Bootstrap Methods · Parametric vs Non-parametric Tests · Central Limit Theorem · ML 論文でよくある統計ミス"
      },
      {
        "name": "Sampling Methods",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/16-sampling-methods/",
        "summary": "サンプリングは、AI が可能性の空間を探索する方法です。",
        "keywords": "なぜ Sampling が重要か · Uniform Random Sampling · Inverse CDF Method · Rejection Sampling · Importance Sampling · Monte Carlo Estimation · Markov Chain Monte Carlo: Metropolis-Hastings · Gibbs Sampling · Temperature Sampling · Top-k Sampling · Top-p（Nucleus）Sampling · Reparameterization Trick · Gumbel-Softmax · Stratified Sampling · Diffusion Models との関係 · Uniform と inverse CDF · Rejection sampling · Importance sampling · Monte Carlo estimation of pi · Metropolis-Hastings · Temperature、top-k、top-p"
      },
      {
        "name": "Linear Systems",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/17-linear-systems/",
        "summary": "`Ax = b` を解くことは、いまもニューラルネットワークの中で動き続けている、数学で最も古い問題の一つです。",
        "keywords": "`Ax = b` の幾何学的意味 · 行の見方と列の見方 · ガウス消去法と部分ピボット選択 · LU、QR、Cholesky · 最小二乗法と正規方程式 · 疑似逆行列と条件数 · 反復法: 共役勾配法 · どの方法をいつ使うか · Step 1: Gaussian elimination with partial pivoting · Step 2: LU decomposition · Step 3: Cholesky decomposition · Step 4: Least squares via normal equations · Step 5: Condition number"
      },
      {
        "name": "Convex Optimization",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/18-convex-optimization/",
        "summary": "凸問題には谷が一つだけあります。ニューラルネットワークには無数の谷があります。その違いを知ることが重要です。",
        "keywords": "凸集合と凸関数 · 凸性の判定 · ML における凸と非凸 · Hessian と Newton's method · 制約付き最適化、Lagrange multipliers、KKT · 正則化は制約付き最適化 · 双対性と SVM · 非凸な深層学習が動く理由 · Step 1: Convexity checker · Step 2: Newton's method for 2D · Step 3: Lagrange multiplier solver"
      },
      {
        "name": "Complex Numbers for AI",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/19-complex-numbers/",
        "summary": "`-1` の平方根は「空想」ではありません。回転、周波数、そして信号処理の大部分を理解する鍵です。",
        "keywords": "複素数とは · 複素演算 · 複素平面と極形式 · Euler's formula · 2D 回転との関係 · Phasors、1 の根、DFT · transformer との接続 · Step 1: Complex class · Step 2: Polar conversion and Euler's formula · Step 3: DFT from complex arithmetic"
      },
      {
        "name": "The Fourier Transform",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/20-fourier-transform/",
        "summary": "すべての信号は正弦波の和です。Fourier transform は、どの正弦波がどれだけ含まれているかを教えてくれます。",
        "keywords": "DFT の定義 · 係数の意味 · Inverse DFT · FFT · スペクトル解析 · Convolution theorem · Windowing、aliasing、zero-padding · positional encodings と CNN への接続 · Spectrogram と STFT · Step 1: DFT from scratch · Step 2: Inverse DFT · Step 3: FFT (Cooley-Tukey) · Step 4: FFT convolution"
      },
      {
        "name": "Graph Theory for ML",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/21-graph-theory/",
        "summary": "グラフは関係性のデータ構造です。データに接続があるなら、グラフ理論が必要です。",
        "keywords": "Graphs: Nodes and Edges · Adjacency Matrix と Degree · BFS と DFS · Graph Laplacian · Spectral clustering · Message Passing · Step 1: Graph class from scratch · Step 2: BFS and DFS · Step 3: Connected components and Laplacian eigenvalues · Step 4: Spectral clustering and message passing"
      },
      {
        "name": "Stochastic Processes",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math-foundations/22-stochastic-processes/",
        "summary": "構造を持つランダム性。random walks、Markov chains、diffusion models の背後にある数学です。",
        "keywords": "Random Walks · Brownian Motion · Markov Chains · Language Models との接続 · Langevin Dynamics · MCMC: Markov Chain Monte Carlo · Step 1: Random walk simulator · Step 2: Markov chain · Step 3: Langevin dynamics · Step 4: Metropolis-Hastings"
      }
    ]
  },
  {
    "id": 2,
    "name": "ML の基礎",
    "status": "complete",
    "desc": "古典的 ML は、今も多くの production AI の背骨です。",
    "lessons": [
      {
        "name": "What Is Machine Learning",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/01-what-is-machine-learning/",
        "summary": "機械学習とは、手作業でルールを書く代わりに、コンピュータへデータ内のパターンを見つけさせることです。",
        "keywords": "ルールではなくデータから学習する · 機械学習の 3 つの種類 · 3 大分類の先へ · 分類と回帰 · ML ワークフロー · 訓練・検証・テスト分割 · 過学習と過小適合 · バイアスとバリアンスのトレードオフ · ノーフリーランチ定理 · 機械学習を使うべきでない場合 · ステップ 1: 最近傍重心分類器をゼロから作る · ステップ 2: 合成データで学習する · ステップ 3: ベースラインと比較する · なぜこれが重要か · ステップ 4: 重心分類器にできないこと"
      },
      {
        "name": "Linear Regression from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/02-linear-regression/",
        "summary": "線形回帰は、データを最もよく通る直線を引きます。機械学習における \"hello world\" です。",
        "keywords": "モデル · コスト関数（平均二乗誤差） · 勾配降下法 · 正規方程式（閉形式解） · 重回帰 · 多項式回帰 · R-squared スコア · 正則化の予告（Ridge 回帰） · ステップ 1: サンプルデータを生成する · ステップ 2: 勾配降下法で線形回帰をゼロから実装する · ステップ 3: 正規方程式（閉形式解） · ステップ 4: 重回帰 · ステップ 5: 多項式回帰 · ステップ 6: Ridge 回帰（L2 正則化）"
      },
      {
        "name": "Logistic Regression & Classification",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/03-logistic-regression/",
        "summary": "ロジスティック回帰は、直線を S 字カーブに曲げ、はい/いいえの問いに確率で答えます。",
        "keywords": "線形回帰が分類で失敗する理由 · シグモイド関数 · ロジスティック回帰 = 線形モデル + シグモイド · 二値交差エントロピー損失 · ロジスティック回帰の勾配降下法 · 決定境界 · ソフトマックスによる多クラス分類 · 評価指標 · ステップ 1: シグモイド関数とデータ生成 · ステップ 2: ロジスティック回帰をゼロから実装する · ステップ 3: 混同行列と指標をゼロから実装する · ステップ 4: 決定境界の分析 · ステップ 5: ソフトマックスによる多クラス分類 · ステップ 6: しきい値調整"
      },
      {
        "name": "Decision Trees & Random Forests",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/04-decision-trees/",
        "summary": "決定木は、突き詰めればフローチャートです。けれど、その木を集めた森は、機械学習で最も強力な道具の1つになります。",
        "keywords": "決定木がしていること · 分割基準: 不純度を測る · 分割のしくみ · 停止条件 · 回帰のための決定木 · ランダムフォレスト: アンサンブルの力 · 特徴量重要度 · 木がニューラルネットワークに勝つ場面 · ステップ1: Gini不純度とエントロピー · ステップ2: 最良の分割を見つける · ステップ3: DecisionTreeクラスを作る · ステップ4: RandomForestクラスを作る"
      },
      {
        "name": "Support Vector Machines",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/05-support-vector-machines/",
        "summary": "2つのクラスの間に、できるだけ幅の広い道を見つける。それが全体の考え方です。",
        "keywords": "最大マージン分類器 · サポートベクトル: 決定的に重要な少数の点 · ソフトマージン: Cパラメータでノイズを扱う · ヒンジ損失: SVMの損失関数 · 勾配降下法で線形SVMを学習する · 双対形式とkernel trick · 回帰のためのSVM（SVR） · SVMが深層学習に敗れた理由（それでも勝つ場面） · ステップ1: ヒンジ損失と勾配 · ステップ2: 勾配降下法による線形SVM · ステップ3: kernel関数 · ステップ4: マージンとサポートベクトルの特定"
      },
      {
        "name": "KNN & Distance Metrics",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/06-knn-and-distances/",
        "summary": "すべてを保存する。近くの点を見て予測する。実際に機能する最も単純なアルゴリズムです。",
        "keywords": "KNNのしくみ · Kの選び方 · 距離尺度 · 重み付きKNN · 次元の呪い · KD-tree: 高速な最近傍探索 · Ball tree: 中程度の次元でより有利 · Lazy learningとeager learning · 回帰のためのKNN · ステップ1: 距離関数 · ステップ2: KNN分類器と回帰器 · ステップ3: 効率的な探索のためのKD-tree · ステップ4: 特徴量スケーリング"
      },
      {
        "name": "Unsupervised Learning: K-Means, DBSCAN",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/07-unsupervised-learning/",
        "summary": "ラベルも教師もありません。アルゴリズムが自力で構造を見つけます。",
        "keywords": "クラスタリング: 似たものをまとめる · K-Means: 定番の手法 · K の選び方 · DBSCAN: 密度ベースのクラスタリング · 階層的クラスタリング · Gaussian Mixture Models (GMM) · どれを使うべきか · クラスタリングによる異常検知 · Step 1: K-Means をゼロから実装する · Step 2: Elbow method と silhouette score · Step 3: DBSCAN をゼロから実装する · Step 4: Gaussian Mixture Model (EM algorithm) · Step 5: テストデータを生成してすべて実行する"
      },
      {
        "name": "Feature Engineering & Selection",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/08-feature-engineering/",
        "summary": "よい特徴量は、千個のデータ点に匹敵します。",
        "keywords": "特徴量パイプライン · 数値特徴量 · カテゴリ特徴量 · テキスト特徴量 · 欠損値 · 特徴量の相互作用 · 特徴量選択 · Step 1: 数値変換をゼロから実装する · Step 2: カテゴリ encoding をゼロから実装する · Step 3: テキスト特徴量をゼロから実装する · Step 4: 欠損値補完をゼロから実装する · Step 5: 特徴量選択をゼロから実装する · Step 6: 完全なパイプラインとデモ"
      },
      {
        "name": "Model Evaluation: Metrics, Cross-Validation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/09-model-evaluation/",
        "summary": "モデルの良し悪しは、それをどう測るかで決まります。",
        "keywords": "Train、Validation、Test · K-Fold Cross-Validation · 分類指標 · 回帰指標 · Learning Curves · Validation Curves · よくある評価ミス · Step 1: Train/validation/test split · Step 2: K-fold と stratified K-fold cross-validation · Step 3: Confusion matrix と分類指標 · Step 4: 回帰指標 · Step 5: Learning curves · Step 6: テスト用の単純な分類器と完全なデモ"
      },
      {
        "name": "Bias, Variance & the Learning Curve",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/10-bias-variance/",
        "summary": "すべてのモデル誤差は、バイアス、分散、ノイズのいずれかから生まれます。制御できるのは最初の 2 つだけです。",
        "keywords": "Bias: 系統的誤差 · Variance: Training Data への感度 · 分解 · モデル複雑度と誤差 · Bias-Variance 制御としての Regularization · Double Descent: 現代的な見方 · モデルを診断する · 実践的な戦略 · Ensemble Method と Variance Reduction · Learning Curve · Learning Curve の生成方法 · Step 1: 既知の関数から合成データを生成する · Step 2: Bootstrap Sampling と Polynomial Fitting · Step 3: Bias^2 と Variance Decomposition を計算する · Step 4: Learning Curve · Step 5: Regularization Sweep · Validation Curve: Model Complexity を Sweep する · Learning Curve: Training Set Size を Sweep する · Regularization Sweep を使った Cross-Validation · すべてをまとめる: 完全な診断ワークフロー"
      },
      {
        "name": "Ensemble Methods: Boosting, Bagging, Stacking",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/11-ensemble-methods/",
        "summary": "弱い学習器の集まりも、正しく組み合わせれば強い学習器になります。これは比喩ではありません。定理です。",
        "keywords": "Ensemble が機能する理由 · Bagging (Bootstrap Aggregating) · Boosting (Sequential Error Correction) · AdaBoost · Gradient Boosting · XGBoost: Tabular Data で強い理由 · Stacking (Meta-Learning) · Voting · Step 1: Decision Stump (Base Learner) · Step 2: AdaBoost をゼロから実装する · Step 3: Gradient Boosting をゼロから実装する · Step 4: sklearn と比較する · 各手法をいつ使うか · Tabular Data 向け本番スタック"
      },
      {
        "name": "Hyperparameter Tuning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/12-hyperparameter-tuning/",
        "summary": "Hyperparameter は、学習が始まる前に回すつまみです。うまく回せるかどうかが、平凡なモデルと優れたモデルの差になります。",
        "keywords": "Parameter と Hyperparameter · Grid Search · Random Search · Bayesian Optimization · Early Stopping · Learning Rate Scheduler · Hyperparameter の重要度 · 実践的な戦略 · Cross-Validation との統合 · 実践的な Tips · Step 1: Grid Search をゼロから実装する · Step 2: Random Search をゼロから実装する · Step 3: Bayesian Optimization (Simplified) · Step 4: すべての手法を比較する · 実務での Optuna · Pruning を使った Optuna · sklearn の組み込み Tuner · Hyperparameter Tuning でよくあるミス"
      },
      {
        "name": "ML Pipelines & Experiment Tracking",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/13-ml-pipelines/",
        "summary": "モデルそのものはプロダクトではありません。パイプラインこそがプロダクトです。生データからデプロイされた予測までを含む全体がパイプラインであり、すべてのステップは再現可能でなければなりません。",
        "keywords": "パイプラインとは · データリーク: 静かな破壊者 · sklearn Pipeline · ColumnTransformer: 列ごとに違うパイプラインを使う · 実験トラッキング · モデルバージョニング · DVC によるデータバージョニング · 再現可能な実験 · ノートブックから本番パイプラインへ · よくあるパイプラインの間違い · Step 1: Custom Transformer · Step 2: Pipeline from Scratch · Step 3: パイプラインを使ったクロスバリデーション · Step 4: sklearn による完全な本番パイプライン"
      },
      {
        "name": "Naive Bayes",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/14-naive-bayes/",
        "summary": "「ナイーブ」な仮定は間違っています。それでも機能します。そこが美しさです。",
        "keywords": "Bayes' Theorem（短い復習） · ナイーブな独立性仮定 · それでも機能する理由 · 数式を順に追う · 3 つの variants · どの variant を使うか · Laplace Smoothing · Log-Space Computation · Naive Bayes vs Logistic Regression · Classification Pipeline · MultinomialNB · GaussianNB · Demo: Text Classification · Demo: Continuous Features · Prediction Speed · Naive Bayes と TF-IDF · Short Text には BernoulliNB · NB Probabilities の calibration · よくある落とし穴 · Naive Bayes が失敗する場合"
      },
      {
        "name": "Time Series Fundamentals",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/15-time-series/",
        "summary": "過去の performance は未来の結果を予測します。ただし、先に stationarity を確認した場合に限ります。",
        "keywords": "Time Series は何が違うのか · Time Series の components · Stationarity · Autocorrelation · Lag Features: Time Series を Supervised Learning に変える · Walk-Forward Validation · ARIMA の直感 · 何をいつ使うか · Forecasting Horizons と Strategies · Time Series でよくある間違い · Lag Feature Creator · Walk-Forward Cross-Validation · Simple Autoregressive Model · Stationarity Check · Autocorrelation · sklearn TimeSeriesSplit · Evaluation Metrics · Rolling Features · 必ず勝つべき baselines · 実務上の tips"
      },
      {
        "name": "Anomaly Detection",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/16-anomaly-detection/",
        "summary": "正常は定義しやすい。異常とは、そこに当てはまらないものです。",
        "keywords": "Types of Anomalies · The Unsupervised Framing · Supervised vs Unsupervised: The Tradeoff · Z-Score Method · IQR Method · Isolation Forest · Local Outlier Factor (LOF) · Comparison · Evaluation Challenges · Anomaly Detection Pipeline · Z-Score Detector · IQR Detector · Isolation Forest from Scratch · Demo Scenarios · sklearn Contamination Parameter · One-Class SVM · Autoencoder Approach (Preview) · Ensemble Anomaly Detection · Production Considerations · Choosing a Threshold · Scaling to Production"
      },
      {
        "name": "Handling Imbalanced Data",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/17-imbalanced-data/",
        "summary": "データの 99% が「normal」なら、accuracy は嘘をつきます。",
        "keywords": "Why Accuracy Fails · Better Metrics · The Imbalanced Data Pipeline · SMOTE: Synthetic Minority Oversampling Technique · Sampling Strategies Compared · Class Weights · Threshold Tuning · Cost-Sensitive Learning · Decision Flowchart · Step 1: 不均衡データセットを生成する · Step 2: SMOTE from scratch · Step 3: Random oversampling and undersampling · Step 4: Logistic regression with class weights · Step 5: Threshold tuning · Step 6: Evaluation functions · Step 7: Compare all approaches"
      },
      {
        "name": "Feature Selection",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/02-ml-fundamentals/18-feature-selection/",
        "summary": "特徴量は多いほど良いわけではありません。正しい特徴量が良いのです。",
        "keywords": "Three Categories of Feature Selection · Variance Threshold · Mutual Information · Recursive Feature Elimination (RFE) · L1 (Lasso) Regularization · Tree-Based Feature Importance · Permutation Importance · Comparison Table · Decision Flowchart · Step 1: 既知の feature structure を持つ synthetic data を生成する · Step 2: Variance threshold · Step 3: Mutual information (discrete) · Step 4: Recursive Feature Elimination · Step 5: L1 feature selection · Step 6: Tree-based importance (simple decision tree) · Step 7: Run all methods and compare"
      }
    ]
  },
  {
    "id": 3,
    "name": "深層学習の中核",
    "status": "complete",
    "desc": "第一原理から neural network を作ります。自分で作るまで framework は使いません。",
    "lessons": [
      {
        "name": "The Perceptron: Where It All Started",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/01-the-perceptron/",
        "summary": "パーセプトロンはニューラルネットワークの原子です。中を開くと、重み、バイアス、そして意思決定があります。",
        "keywords": "1つのニューロン、1つの判断 · 決定境界 · 学習ルール · XOR問題 · Step 1: Perceptronクラス · Step 2: 論理ゲートで訓練する · Step 3: XORが失敗する様子を見る · Step 4: 2層でXORを解く · Step 5: 2層ネットワークを訓練する"
      },
      {
        "name": "Multi-Layer Networks & Forward Pass",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/02-multi-layer-networks/",
        "summary": "1つのニューロンが引けるのは1本の直線です。積み重ねれば、どんな形でも描けます。",
        "keywords": "層: 入力、隠れ、出力 · ニューロンと活性化関数 · フォワードパス: データの流れ · 行列の次元 · 普遍近似定理 · 合成可能性 · Step 1: Sigmoid活性化関数 · Step 2: Layerクラス · Step 3: Networkクラス · Step 4: 手で調整した重みによるXOR · Step 5: 円の分類"
      },
      {
        "name": "Backpropagation from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/03-backpropagation/",
        "summary": "バックプロパゲーションは学習を可能にするアルゴリズムです。これがなければ、ニューラルネットワークは高価な乱数生成器にすぎません。",
        "keywords": "連鎖律をネットワークに適用する · 計算グラフ · フォワードとバックワード · ネットワーク内の勾配の流れ · 勾配消失 · 2層ネットワークの勾配を導出する · Step 1: Valueノード · Step 2: backward関数を持つ演算 · Step 3: Sigmoidと損失 · Step 4: バックワードパス · Step 5: LayerとNetwork · Step 6: XORで訓練する · Step 7: 円分類"
      },
      {
        "name": "Activation Functions: ReLU, Sigmoid, GELU & Why",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/04-activation-functions/",
        "summary": "非線形性がなければ、100層のネットワークも凝った行列乗算にすぎません。活性化関数は、ニューラルネットワークが曲線で考えるためのゲートです。",
        "keywords": "なぜ非線形性が必要なのか · Sigmoid · Tanh · ReLU: ブレイクスルー · Leaky ReLU · GELU: 現代のデフォルト · Swish / SiLU · Softmax: 出力の活性化 · 形状の比較 · 勾配の流れの比較 · どの活性化関数をいつ使うか · Step 1: 導関数付きで全活性化関数を実装する · Step 2: 勾配がどこで死ぬかを可視化する · Step 3: 勾配消失の実験 · Step 4: Dead Neuron 検出器 · Step 5: 訓練比較 -- Sigmoid vs ReLU vs GELU"
      },
      {
        "name": "Loss Functions: MSE, Cross-Entropy, Contrastive",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/05-loss-functions/",
        "summary": "ネットワークが予測を出します。正解は違うと言っています。どれくらい間違っているのか。その数値が損失です。損失関数の選択を誤ると、モデルはまったく違うものを最適化します。",
        "keywords": "Mean Squared Error（MSE） · Cross-Entropy Loss · 分類で MSE が失敗する理由 · Label Smoothing · Contrastive Loss · Focal Loss · 損失関数の決定木 · 損失地形 · Step 1: MSE とその勾配 · Step 2: Binary Cross-Entropy · Step 3: Softmax 付き Categorical Cross-Entropy · Step 4: Label Smoothing · Step 5: Contrastive Loss（簡略化した InfoNCE） · Step 6: 分類における MSE vs Cross-Entropy"
      },
      {
        "name": "Optimizers: SGD, Momentum, Adam, AdamW",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/06-optimizers/",
        "summary": "勾配降下は、どちらへ動くべきかを教えてくれます。どれくらい遠くへ、どれくらい速く動くべきかは教えてくれません。SGD はコンパスです。Adam は渋滞情報付きの GPS です。",
        "keywords": "Stochastic Gradient Descent（SGD） · Momentum · RMSProp · Adam: Momentum + RMSProp · AdamW: 正しい Weight Decay · Learning Rate: 最も重要なハイパーパラメータ · Optimizer の比較 · どの Optimizer がいつ勝つか · Step 1: Vanilla SGD · Step 2: Momentum 付き SGD · Step 3: Adam · Step 4: AdamW · Step 5: 訓練比較"
      },
      {
        "name": "Regularization: Dropout, Weight Decay, BatchNorm",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/07-regularization/",
        "summary": "モデルが学習データで 99%、テストデータで 60% を出す。これは学習ではなく暗記です。正則化とは、汎化を強制するために複雑さへ課す税金です。",
        "keywords": "過学習のスペクトラム · Dropout · Weight Decay（L2 正則化） · Batch Normalization · Layer Normalization · RMSNorm · 正規化の比較 · 正則化としての Data Augmentation · Early Stopping · 何をいつ適用するか · Step 1: Dropout（Train Mode と Eval Mode） · Step 2: L2 Weight Decay · Step 3: Batch Normalization · Step 4: Layer Normalization · Step 5: RMSNorm · Step 6: 正則化あり・なしで学習する"
      },
      {
        "name": "Weight Initialization & Training Stability",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/08-weight-initialization/",
        "summary": "初期化を間違えると学習は始まりません。正しく初期化すると、50 層でも 3 層のように滑らかに学習できます。",
        "keywords": "対称性の問題 · Layers を通る variance propagation · Xavier/Glorot Initialization · Kaiming/He Initialization · Transformer Initialization · 50 Layers を通る activation magnitude · 正しい Init を選ぶ · Step 1: Initialization Strategies · Step 2: Activation Functions · Step 3: 50 Layers を通す Forward Pass · Step 4: 実験 · Step 5: Symmetry Demonstration · Step 6: Layer ごとの magnitude report"
      },
      {
        "name": "Learning Rate Schedules & Warmup",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/09-learning-rate-schedules/",
        "summary": "learning rate は最も重要な hyperparameter です。architecture でも、dataset size でも、activation function でもありません。learning rate です。他に何も調整しないなら、これを調整してください。",
        "keywords": "Constant Learning Rate · Step Decay · Cosine Annealing · Warmup: 小さく始める理由 · Linear Warmup + Cosine Decay · 1cycle Policy · Schedule Shapes · Decision Flowchart · 発表済みモデルの実数値 · Step 1: Schedule Functions · Step 2: すべての Schedules を可視化する · Step 3: ネットワークを学習する · Step 4: すべての Schedules を比較する · Step 5: LR が高すぎる場合と低すぎる場合"
      },
      {
        "name": "Build Your Own Mini Framework",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/10-mini-framework/",
        "summary": "あなたは neuron、layer、network、backprop、activation、loss function、optimizer、regularization、initialization、LR schedule を作ってきました。すべて別々の部品としてです。今度はそれらをつないで framework にします。PyTorch ではありません…",
        "keywords": "Module Abstraction · Sequential Container · Training vs Evaluation Mode · Optimizer · DataLoader · Framework Architecture · Training Loop · Module Hierarchy · Step 1: Module Base Class · Step 2: Linear Layer · Step 3: Activation Modules · Step 4: Dropout Module · Step 5: BatchNorm Module · Step 6: Sequential Container · Step 7: Loss Functions · Step 8: SGD and Adam Optimizers · Step 9: DataLoader · Step 10: Circle Classification で 4-Layer Network を学習する"
      },
      {
        "name": "Introduction to PyTorch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/11-intro-to-pytorch/",
        "summary": "あなたは pistons と crankshafts から engine を作りました。今度は、実際に誰もが運転しているものを学びます。",
        "keywords": "PyTorch が勝った理由 · Tensors · Autograd · nn.Module · Loss Functions and Optimizers · Training Loop · Dataset and DataLoader · GPU Training · Comparison: Mini Framework vs PyTorch vs JAX · Step 1: Raw Files から MNIST を Load する · Step 2: Model を定義する · Step 3: Training Loop · Step 4: すべてを接続する · Quick Comparison: Mini Framework vs PyTorch · Models の Save and Load · Learning Rate Scheduling"
      },
      {
        "name": "Introduction to JAX",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/12-intro-to-jax/",
        "summary": "PyTorch は tensors を mutate します。TensorFlow は graphs を構築します。JAX は pure functions を compile します。最後の 1 つが、deep learning の考え方を変えます。",
        "keywords": "JAX Philosophy · jax.numpy: 見慣れた表面 · jax.grad: Functional Autodiff · jit: XLA へ Compile する · vmap: Automatic Vectorization · pmap: Devices 間の Data Parallelism · Pytrees: Universal Data Structure · Functional vs Object-Oriented · JAX Ecosystem · When to Use JAX vs PyTorch · Random Numbers in JAX · Step 1: Setup and Data · Step 2: Parameters を初期化する · Step 3: Forward Pass · Step 4: JIT-Compiled Training Step · Step 5: Training Loop · Flax: Google Standard · Equinox: Pythonic Alternative · Optax: Composable Optimizers"
      },
      {
        "name": "Debugging Neural Networks",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/03-deep-learning-core/13-debugging-neural-networks/",
        "summary": "network は compile できました。実行もできました。数値も出ました。その数値が間違っていて、何も crash していません。最も難しい種類の debugging へようこそ。error message がない種類です。",
        "keywords": "Debugging Mindset · 症状 1: Loss が下がらない · 症状 2: Loss は下がるが Model が悪い · 症状 3: Loss の NaN または Inf · Technique 1: Gradient Checking · Technique 2: Activation Statistics · Technique 3: Gradient Flow Visualization · Technique 4: Overfit-One-Batch Test · Technique 5: Learning Rate Finder · Common PyTorch Bugs · Master Debugging Table · Step 1: NetworkDebugger Class · Step 2: Overfit-One-Batch Test · Step 3: Learning Rate Finder · Step 4: Gradient Checker · Step 5: わざと壊した Networks · PyTorch Built-in Tools · Weights & Biases Integration · TensorBoard · Debug Checklist（Full Training の前）"
      }
    ]
  },
  {
    "id": 4,
    "name": "コンピュータビジョン",
    "status": "complete",
    "desc": "pixel から理解へ。画像、動画、3D、VLM、world model を扱います。",
    "lessons": [
      {
        "name": "Image Fundamentals: Pixels, Channels, Color Spaces",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/01-image-fundamentals/",
        "summary": "画像とは、光のサンプルを並べたテンソルです。これから使うすべての vision model は、この事実から始まります。",
        "keywords": "前処理 pipeline の全体像 · pixel は四角ではなく sample · なぜ 3 channels なのか · 2 つの layout convention: HWC と CHW · byte range と dtype · 色空間と存在理由 · aspect ratio、resize、interpolation · ステップ 1: 画像を読み込み、shape を調べる · ステップ 2: channel を分割し、layout を並べ替える · ステップ 3: grayscale と HSV への変換 · ステップ 4: normalize、standardize、そして元に戻す · ステップ 5: 3 つの interpolation method で resize する"
      },
      {
        "name": "Convolutions from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/02-convolutions-from-scratch/",
        "summary": "畳み込みは、画像上をスライドさせる小さな dense layer です。すべての位置で同じ重みを共有します。",
        "keywords": "1 つのカーネルをスライドさせる · 出力サイズの式 · パディング · ストライド · 複数の入力チャンネル · im2col のトリック · 受容野 · ステップ 1: 配列をパディングする · ステップ 2: ネストしたループによる 2D 畳み込み · ステップ 3: 手設計のカーネルで検証する · ステップ 4: im2col · ステップ 5: im2col + matmul による高速 conv · ステップ 6: 手設計カーネルのバンク"
      },
      {
        "name": "CNNs: LeNet to ResNet",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/03-cnns-lenet-to-resnet/",
        "summary": "過去30年の主要な CNN はどれも、conv、非線形、ダウンサンプリングという同じレシピに、新しいアイデアを 1 つ継ぎ足したものです。そのアイデアを順番に学びます。",
        "keywords": "画像認識を変えた 4 つのアイデア · LeNet-5 (1998) · AlexNet (2012) · VGG (2014) · Inception (2014、同年) · 劣化問題 · ResNet (2015) · 残差が vision を超えて重要な理由 · ステップ 1: LeNet-5 · ステップ 2: VGG block · ステップ 3: ResNet BasicBlock · ステップ 4: 小さな ResNet · ステップ 5: パラメータあたりの特徴効率を比較する"
      },
      {
        "name": "Image Classification",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/04-image-classification/",
        "summary": "分類器とは、ピクセルからクラス上の確率分布への関数です。それ以外はすべて配管です。",
        "keywords": "分類パイプライン · Cross-entropy、logits、softmax · 拡張が効く理由 · Mixup と cutmix · Label smoothing · Accuracy を超えた評価 · ステップ 1: 決定的な synthetic dataset · ステップ 2: 正規化と拡張 · ステップ 3: Mixup · ステップ 4: 訓練ループ · ステップ 5: まとめて動かす · ステップ 6: 混同行列を読む"
      },
      {
        "name": "Transfer Learning & Fine-Tuning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/05-transfer-learning/",
        "summary": "ほかの誰かが、edges、textures、object parts がどのように見えるかを network に教えるため、膨大な GPU 時間を使っています。自分の task を学習する前に、その features を借りるべきです。",
        "keywords": "Feature extraction vs fine-tuning · Why freezing works at all · Discriminative learning rates · The BatchNorm problem · Head design · Layer-wise LR decay · What to evaluate · Step 1: Load a pretrained backbone and inspect it · Step 2: Feature extraction — freeze everything, replace the head · Step 3: Discriminative fine-tuning · Step 4: BatchNorm handling · Step 5: A minimal end-to-end fine-tuning loop · Step 6: Progressive unfreezing"
      },
      {
        "name": "Object Detection — YOLO from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/06-object-detection-yolo/",
        "summary": "Detection は classification に regression を足し、それを feature map の全位置で実行し、最後に non-maximum suppression で整理する task です。",
        "keywords": "Detection as dense prediction · Why grids and anchors · Decoding predictions · IoU · Non-maximum suppression · The loss · Detection metrics · Step 1: IoU · Step 2: Non-max suppression · Step 3: Box encoding and decoding · Step 4: A minimal YOLO head · Step 5: Ground-truth assignment · Step 6: The three losses · Step 7: Inference pipeline"
      },
      {
        "name": "Semantic Segmentation — U-Net",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/07-semantic-segmentation-unet/",
        "summary": "Segmentation は pixel ごとの classification です。U-Net は downsampling encoder と upsampling decoder を組み合わせ、その間を skip connections でつなぐことで機能します。",
        "keywords": "Semantic vs instance vs panoptic · The U-Net shape · Transposed vs bilinear upsample · Cross-entropy on a pixel grid · Dice loss and why you need it · Evaluation metrics · Input resolution trade-off · Step 1: Encoder block · Step 2: Down and up blocks · Step 3: The U-Net · Step 4: Losses · Step 5: IoU metric · Step 6: Synthetic dataset for end-to-end verification · Step 7: Training loop"
      },
      {
        "name": "Instance Segmentation — Mask R-CNN",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/08-instance-segmentation-mask-rcnn/",
        "summary": "Faster R-CNN detector に小さな mask branch を足すと instance segmentation になります。難所は RoIAlign で、見た目よりずっと慎重に扱う必要があります。",
        "keywords": "The architecture · Why RoIAlign, not RoIPool · The RPN in one paragraph · The mask head · Losses · Output format · Step 1: RoIAlign from scratch · Step 2: Compare to torchvision's RoIAlign · Step 3: Load a pretrained Mask R-CNN · Step 4: Run inference · Step 5: Swap the heads for a custom class count · Step 6: Freeze what does not need training"
      },
      {
        "name": "Image Generation — GANs",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/09-image-generation-gans/",
        "summary": "GAN は固定されたゲームを行う 2 つの neural networks です。一方が描き、もう一方が批評します。両者は一緒に上達し、やがて描いたものが批評者をだませるようになります。",
        "keywords": "2 つの networks · ゲーム · Non-saturating loss · DCGAN architecture rules · 失敗モードとシグネチャ · 評価 · Step 1: Generator · Step 2: Discriminator · Step 3: Training step · Step 4: synthetic shapes での完全な training loop · Step 5: Sampling · Step 6: Spectral normalisation"
      },
      {
        "name": "Image Generation — Diffusion Models",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/10-image-generation-diffusion/",
        "summary": "diffusion model は denoise を学習します。noisy image から少しだけ noise を取り除くよう学習し、それを逆向きに 1000 回繰り返すと image generator になります。",
        "keywords": "Forward process · Closed-form jump · Reverse process · Training loss · Sampler (DDPM) · なぜ 1000 steps なのか · DDIM: 20x faster sampling · Time conditioning · Step 1: Noise schedule · Step 2: Forward diffusion (q_sample) · Step 3: 小さな time-conditioned U-Net · Step 4: Training loop · Step 5: Sampler (DDPM) · Step 6: DDIM sampler (deterministic, ~20x faster)"
      },
      {
        "name": "Stable Diffusion — Architecture & Fine-Tuning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/11-stable-diffusion/",
        "summary": "Stable Diffusion は、pretrained VAE の latent space で動く DDPM です。text による conditioning は cross-attention で行い、高速な deterministic ODE solver で sample し、classifier-free guidance で誘導します。",
        "keywords": "Pipeline · Classifier-free guidance (CFG) · Latent space geometry · U-Net architecture · LoRA fine-tuning · よく見る schedulers · Step 1: Text-to-image · Step 2: Scheduler を差し替える · Step 3: Image-to-image · Step 4: Inpainting · Step 5: LoRA loading · Step 6: LoRA training (sketch)"
      },
      {
        "name": "Video Understanding — Temporal Modeling",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/12-video-understanding/",
        "summary": "video は images の sequence と、それらをつなぐ physics です。すべての video model は、time を extra axis として扱う（3D conv）、attention する sequence として扱う（transformer）、または一度 feature を抽出して pool する（2D+pool）の…",
        "keywords": "3 つの architectural families · 2D + pool · 3D convolutions · Spatio-temporal transformers · Frame sampling · 評価 · 出会う datasets · Step 1: Frame sampler · Step 2: 2D+pool baseline · Step 3: I3D-style inflated 3D conv · Step 4: Factorised (2+1)D conv"
      },
      {
        "name": "3D Vision: Point Clouds, NeRFs",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/13-3d-vision-nerf/",
        "summary": "3D visionには2つの流儀があります。point cloudはsensorの生の出力です。NeRFは学習されたvolumetric fieldです。どちらも「空間のどこに何があるか」に答えます。",
        "keywords": "Point clouds · PointNetのarchitecture · Neural Radiance Fields (NeRFs) · Positional encoding in NeRF · Volumetric rendering · NeRFを置き換えたもの · Datasetsとbenchmarks · Step 1: PointNet classifier · Step 2: Positional encoding · Step 3: Tiny NeRF MLP · Step 4: Volumetric rendering along a ray"
      },
      {
        "name": "Vision Transformers (ViT)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/14-vision-transformers/",
        "summary": "画像をpatchに切り分け、各patchをwordとして扱い、standard transformerに通します。もう後戻りは不要です。",
        "keywords": "pipeline · Patch embedding · Class token · Positional embedding · Transformer encoder block · Why pre-LN · Patch size trade-off · DeiT's recipe for training ViT on ImageNet-1k · Swin vs ConvNeXt · MAE pretraining · Step 1: Patch embedding · Step 2: Transformer block · Step 3: ViT · Step 4: sanity check — single image inference"
      },
      {
        "name": "Real-Time Vision: Edge Deployment",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/15-real-time-edge/",
        "summary": "Edge inferenceとは、90% accuracyのmodelを、RAM 2 GBのdevice上で30 fpsで動かす技術です。accuracyの1 percentage pointは、latencyの数ミリ秒と常に交換されています。",
        "keywords": "3つのbudget · Measurement discipline · proxyとしてのFLOPs · quantisationを1段落で · Pruning and distillation · inference runtimes · Edge architecture picker · Step 1: Measure latency correctly · Step 2: Parameter and FLOP counts · Step 3: Post-training static quantisation · Step 4: ONNXへexportする · Step 5: regimeをbenchmarkして比較する"
      },
      {
        "name": "Build a Complete Vision Pipeline",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/16-vision-pipeline-capstone/",
        "summary": "本番のvision systemは、modelとruleをdata contractで縫い合わせたchainです。部品はこのphaseですでに学びました。capstoneでは、それらをend-to-endに接続します。",
        "keywords": "pipeline · Pydanticによるdata contract · latencyはどこへ行くか · failure modes · Batching · Step 1: Data contracts · Step 2: 最小Pipeline class · Step 3: detectorとclassifierを接続する · Step 4: FastAPI service · Step 5: pipelineをbenchmarkする"
      },
      {
        "name": "Self-Supervised Vision — SimCLR, DINO, MAE",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/17-self-supervised-vision/",
        "summary": "教師あり vision のボトルネックはラベルです。自己教師あり事前学習はラベルを取り除きます。1億枚のラベルなし画像から視覚特徴を学び、1万枚のラベル付き画像で fine-tune します。",
        "keywords": "Three families · Contrastive learning (SimCLR) · Teacher-student (DINO) · Masked reconstruction (MAE) · Why 75% and not 15% · Linear-probe evaluation · Step 1: Two-view augmentation pipeline · Step 2: InfoNCE loss · Step 3: Sanity check InfoNCE · Step 4: MAE-style masking"
      },
      {
        "name": "Open-Vocabulary Vision — CLIP",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/18-open-vocab-clip/",
        "summary": "image encoder と text encoder を一緒に学習し、一致する (image, caption) pairs が shared space の同じ場所に来るようにします。仕組みはそれだけです。",
        "keywords": "Two towers · The objective · SigLIP: a better loss · Zero-shot classification · Where CLIP-style models are used in 2026 · Step 1: A tiny two-tower model · Step 2: Contrastive loss · Step 3: Zero-shot classifier · Step 4: Sanity check"
      },
      {
        "name": "OCR & Document Understanding",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/19-ocr-document-understanding/",
        "summary": "OCR は3段階の pipeline です。text boxes を detect し、characters を recognise し、それらを layout します。現代の OCR system は、この段階を並べ替えるか統合します。",
        "keywords": "The classical pipeline · CTC in one paragraph · Modern end-to-end models · Layout parsing · Evaluation metrics · Step 1: CTC loss + greedy decoder · Step 2: Tiny CRNN recogniser · Step 3: Synthetic OCR · Step 4: Training sketch"
      },
      {
        "name": "Image Retrieval & Metric Learning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/20-image-retrieval-metric/",
        "summary": "retrieval system は embedding space 内の distance で candidates を rank します。Metric learning は、その distance が意図した意味を持つように space を形作る discipline です。",
        "keywords": "Retrieval at a glance · The four loss families · Triplet loss formally · Cosine similarity vs L2 · Recall@K · FAISS in one paragraph · Instance-level vs category-level retrieval · Step 1: Triplet loss · Step 2: Semi-hard mining · Step 3: Recall@K · Step 4: Putting it together"
      },
      {
        "name": "Keypoint Detection & Pose Estimation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/21-keypoint-pose/",
        "summary": "姿勢とは、順序付き keypoint の集合である。keypoint detector は heatmap regressor であり、それ以外はほぼ帳簿付けである。",
        "keywords": "Top-down vs bottom-up · Heatmap regression · Sub-pixel localisation · Part Affinity Fields (PAFs) · COCO keypoints · 2D vs 3D · Step 1: Gaussian heatmap target · Step 2: tiny keypoint head · Step 3: inference — keypoint coordinates の抽出 · Step 4: synthetic keypoint dataset · Step 5: training"
      },
      {
        "name": "3D Gaussian Splatting from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/22-3d-gaussian-splatting/",
        "summary": "scene は数百万個の 3D Gaussians の cloud である。それぞれが position、orientation、scale、opacity、viewing direction に依存する colour を持つ。それらを rasterise し、rasterisation を通して backprop すればよい。",
        "keywords": "Gaussian が持つもの · ray marching ではなく rasterisation · projection step · alpha-compositing rule · differentiable である理由 · Densification and pruning · spherical harmonics を 1 段落で · 2026 年の production stack · 4D and generative variants · Step 1: 2D Gaussian · Step 2: 2D splatting rasteriser · Step 3: trainable 2D splat scene · Step 4: 2D Gaussians を target image に fit する · Step 5: 2D から 3D へ · Step 6: spherical harmonics evaluation"
      },
      {
        "name": "Diffusion Transformers & Rectified Flow",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/23-diffusion-transformers-rectified-flow/",
        "summary": "U-Net は diffusion の秘密ではない。これを transformer に置き換え、noise schedule を straight-line flow に替えると、SD3、FLUX、そして 2026 年のほぼすべての text-to-image model になる。",
        "keywords": "U-Net から transformer へ · rectified flow を 1 段落で · AdaLN conditioning · SD3 と FLUX の text encoders · classifier-free guidance は引き続き有効 · Consistency, Turbo, Schnell, LCM · 2026 年の model landscape · この phase shift が重要な理由 · Step 1: AdaLN を持つ DiT block · Step 2: tiny DiT · Step 3: rectified flow training · Step 4: Euler sampler · Step 5: end-to-end smoke test"
      },
      {
        "name": "SAM 3 & Open-Vocabulary Segmentation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/24-sam3-open-vocab-segmentation/",
        "summary": "model に text prompt と image を渡すと、matching object すべての masks が得られる。SAM 3 はそれを single forward pass にした。",
        "keywords": "3 つの世代 · Promptable Concept Segmentation · architecture の主要要素 · scale した training · SAM 3.1 Object Multiplex · 2026 年でも Grounded SAM が重要な場面 · YOLO-World vs SAM 3 · SAM-MI の効率 · 出力形式 for the three models · Step 1: prompt construction · Step 2: post-processing helpers · Step 3: 統一 open-vocab segmentation interface · Step 4: Hugging Face SAM 3 の使い方 (reference) · Step 5: Grounded SAM 2 が提供していたものを測る"
      },
      {
        "name": "Vision-Language Models (ViT-MLP-LLM)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/25-vision-language-models/",
        "summary": "Vision encoder が画像を token に変換する。MLP projector がそれらの token を LLM の embedding 空間へ写像する。残りは language model が担う。この ViT-MLP-LLM というパターンが、2026 年の本番 VLM の標準形である。",
        "keywords": "ViT-MLP-LLM architecture · DeepStack · 3 つの training stages · Model family comparison (2026 年初頭) · Visual agents · Agentic capabilities + RoPE variants · alignment の問題 · LoRA / QLoRA による fine-tuning · Spatial reasoning はまだ弱い · Step 1: projector · Step 2: ViT-MLP-LLM を end-to-end で組み立てる · Step 3: CMER computation · Step 4: Toy VLM classifier (実行可能)"
      },
      {
        "name": "Monocular Depth & Geometry Estimation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/26-monocular-depth/",
        "summary": "depth map は、各 pixel が camera からの距離を表す single-channel image である。かつては 1 枚の RGB frame からこれを予測するには stereo や LiDAR が不可欠だった。2026 年には、frozen ViT encoder と lightweight head だけで ground t…",
        "keywords": "Relative depth と metric depth · encoder-decoder pattern · 1 枚の画像から depth が得られる理由 · monocular depth ができないこと · Depth Anything V3 in 2026 · Marigold — diffusion for depth · intrinsics と pinhole camera · Evaluation · Step 1: depth metrics · Step 2: scale-and-shift alignment · Step 3: depth を point cloud に lift する · Step 4: synthetic depth scene で smoke test · Step 5: Depth Anything V3 usage (reference)"
      },
      {
        "name": "Multi-Object Tracking & Video Memory",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/27-multi-object-tracking/",
        "summary": "tracking は detection と association の組み合わせである。各 frame で検出し、今回の frame の detections を前回 frame の tracks に ID で対応付ける。",
        "keywords": "Tracking-by-detection · Kalman filter を 1 段落で · Hungarian algorithm · ByteTrack の key idea · SAM 2 memory-based tracking · SAM 3.1 Object Multiplex · 知っておくべき 3 つの metrics · Step 1: IoU-based cost matrix · Step 2: minimal SORT-style tracker · Step 3: synthetic trajectory test · Step 4: ID-switch metric"
      },
      {
        "name": "World Models & Video Diffusion",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/04-computer-vision/28-world-models-video-diffusion/",
        "summary": "scene の次の数秒を予測する video model は world simulator である。その予測を actions で condition すれば、learned game engine になる。",
        "keywords": "world-modelling の 3 つの families · Video DiT architecture · actions で condition する: latent action models · Physical plausibility · Autonomous driving world models · Robotics stack: VLM + video model + inverse dynamics · Evaluation · 2026 年の model landscape · Step 1: video を 3D patchify する · Step 2: 3D rotary position encoding · Step 3: divided attention block · Step 4: tiny video DiT を組み立てる · Step 5: shapes を確認する"
      }
    ]
  },
  {
    "id": 5,
    "name": "NLP: 基礎から発展まで",
    "status": "complete",
    "desc": "言語は知能への interface です。",
    "lessons": [
      {
        "name": "Text Processing: Tokenization, Stemming, Lemmatization",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/01-text-processing/",
        "summary": "言語は連続的です。モデルは離散的です。前処理はその橋渡しです。",
        "keywords": "ステップ 1: 正規表現による単語トークナイザ · ステップ 2: Porter ステマー (step 1a のみ) · ステップ 3: ルックアップベースのレンマ化器 · ステップ 4: パイプラインとしてつなぐ · NLTK · spaCy · どれを選ぶか · 誰も警告してくれない 2 つの失敗モード"
      },
      {
        "name": "Bag of Words, TF-IDF & Text Representation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/",
        "summary": "まず数え、考えるのはその後です。2026 年でも、明確に定義されたタスクでは TF-IDF が埋め込みに勝つことがあります。",
        "keywords": "ステップ 1: 語彙を作る · ステップ 2: Bag of Words · ステップ 3: 語頻度と文書頻度 · ステップ 4: TF-IDF · ステップ 5: 行を L2 正規化する · 2026 年時点でも TF-IDF が勝つ場面 · TF-IDF が失敗する場面 · ハイブリッド: TF-IDF 重み付き埋め込み"
      },
      {
        "name": "Word Embeddings: Word2Vec from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/",
        "summary": "単語は、その周囲に現れる単語によって理解できる。この考え方で浅いネットワークを学習すると、幾何構造が現れる。",
        "keywords": "ステップ1: コーパスから学習ペアを作る · ステップ2: 埋め込みテーブル · ステップ3: 負例サンプリングの目的関数 · ステップ4: 小さなコーパスで学習する · ステップ5: アナロジーのトリック · 2026年でもWord2Vecが勝つ場面 · Word2Vecが失敗する場所"
      },
      {
        "name": "GloVe, FastText & Subword Embeddings",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/",
        "summary": "Word2Vecは単語ごとに1つの埋め込みを学習した。GloVeは共起行列を分解した。FastTextは部品を埋め込んだ。BPEはtransformerへの橋を架けた。",
        "keywords": "GloVe: 共起行列を分解する · FastText: サブワードを考慮した埋め込み · BPE: 学習されたサブワード語彙 · どれを選ぶべきか"
      },
      {
        "name": "Sentiment Analysis",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/",
        "summary": "NLPの定番タスク。古典的なテキスト分類について知るべきことのほとんどが、ここに現れます。",
        "keywords": "ステップ1: 実際のミニデータセット · ステップ2: multinomial Naive Bayesをゼロから作る · ステップ3: logistic regressionをゼロから作る · ステップ4: 否定を扱う (失敗モード) · ステップ5: 重要な評価指標 · transformerを使うべきとき · 再現性の落とし穴 (再び)"
      },
      {
        "name": "Named Entity Recognition (NER)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/",
        "summary": "名前を抜き出す。それだけなら簡単に聞こえますが、曖昧な境界、入れ子のエンティティ、ドメイン用語が出てくると話は変わります。",
        "keywords": "ステップ1: BIO tagging helper · ステップ2: 手作り特徴 · ステップ3: 単純なrule-based + 辞書ベースライン · ステップ4: CRFの段階 (概略、完全実装ではない) · ステップ5: BiLSTM-CRFが追加するもの · LLMベースNER (2026年の選択肢) · 古典的NERがまだ勝つ場所 · 破綻する場所"
      },
      {
        "name": "POS Tagging & Syntactic Parsing",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/",
        "summary": "文法はしばらく流行遅れだった。それから、あらゆるLLMパイプラインが構造化抽出を検証する必要に迫られ、また戻ってきた。",
        "keywords": "Step 1: 最頻タグベースライン · Step 2: bigram HMMタガー · Step 3: なぜ現代のタガーはこれを上回るのか · Step 4: 依存構造解析の見取り図 · 2026年でもこれが重要な場所"
      },
      {
        "name": "Text Classification — CNNs & RNNs for Text",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/",
        "summary": "畳み込みはn-gramを学習する。再帰は記憶する。どちらもAttentionに置き換えられた。どちらも制約の厳しいハードウェアでは今でも重要だ。",
        "keywords": "Step 1: PyTorchでTextCNN · Step 2: LSTM分類器 · Step 3: 勾配消失デモ (直感) · Step 4: それでも十分ではなかった理由"
      },
      {
        "name": "Sequence-to-Sequence Models",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/",
        "summary": "2つのRNNが翻訳機のふりをする。この方式がぶつかったボトルネックこそ、attentionが生まれた理由です。",
        "keywords": "Step 1: encoder · Step 2: decoder · Step 3: teacher forcingを使った学習ループ · Step 4: 推論ループ（greedy） · Step 5: ボトルネックを実演する · RNNベースのseq2seqをまだ使う場面 · Exposure biasとその緩和策"
      },
      {
        "name": "Attention Mechanism — The Breakthrough",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/10-attention-mechanism/",
        "summary": "decoderは圧縮された要約を目を細めて見るのをやめ、source全体を見るようになる。この後のすべては、attentionとengineeringです。",
        "keywords": "Step 1: additive（Bahdanau）attention · Step 2: Luong dotとgeneral · Step 3: 数値例で確認する · Step 4: これがtransformerへの橋になる理由 · Classical attentionがまだ重要な場面 · attention-weight-as-explanationの罠"
      },
      {
        "name": "Machine Translation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/11-machine-translation/",
        "summary": "翻訳は、30 年にわたって NLP 研究を支え、今も支え続けているタスクである。",
        "keywords": "ステップ 1: 事前学習済み MT の呼び出し · ステップ 2: BLEU と chrF · 3 層の評価階層 (2026) · ステップ 3: 本番で壊れるもの · ステップ 4: ドメイン向け fine-tuning"
      },
      {
        "name": "Text Summarization",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/12-text-summarization/",
        "summary": "抽出的システムは、文書が何を述べたかを伝える。抽象的システムは、著者が何を意味したかを伝える。別のタスクであり、落とし穴も別である。",
        "keywords": "ステップ 1: TextRank (extractive) · ステップ 2: BART による abstractive summarization · ステップ 3: ROUGE 評価 · ROUGE を超えて (2026 年の要約評価) · ステップ 4: factuality 問題"
      },
      {
        "name": "Question Answering Systems",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/13-question-answering/",
        "summary": "現代のQAは3つのシステムに形づくられてきました。抽出型は範囲を見つけます。検索拡張型は文書に根拠づけます。生成型は答えを生成します。現代のAIアシスタントは、どれもこの3つの組み合わせです。",
        "keywords": "Step 1: 事前学習済みモデルによる抽出型QA · Step 2: 検索拡張パイプライン (スケッチ) · Step 3: RAGによる生成 · Step 4: 現実を反映した評価 · RAGAS: 2026年の本番評価フレームワーク"
      },
      {
        "name": "Information Retrieval & Search",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/",
        "summary": "BM25は正確ですが脆いです。denseは広く拾えますがキーワードを落とします。hybridが2026年のデフォルトです。それ以外はチューニングです。",
        "keywords": "Step 1: BM25をスクラッチで実装する · Step 2: bi-encoderによるdense retrieval · Step 3: Reciprocal Rank Fusion · Step 4: hybrid search + rerank · Step 5: 評価 · 2026年の本番RAGから得られた苦い教訓"
      },
      {
        "name": "Topic Modeling: LDA, BERTopic",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/15-topic-modeling/",
        "summary": "LDA: 文書はトピックの混合であり、トピックは単語上の分布です。BERTopic: 文書を埋め込み空間でクラスタリングし、クラスタをトピックと見なします。目的は同じで、分解の仕方が異なります。",
        "keywords": "Step 1: scikit-learn による LDA · Step 2: BERTopic（本番向け） · Step 3: 評価"
      },
      {
        "name": "Text Generation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/",
        "summary": "ある単語が予想外なら、そのモデルは悪いモデルです。Perplexity は予想外さを数値にします。Smoothing はそれを有限に保ちます。",
        "keywords": "Step 1: trigram カウント · Step 2: Laplace smoothing · Step 3: Kneser-Ney（bigram、補間版） · Step 4: サンプリングによるテキスト生成 · Step 5: perplexity"
      },
      {
        "name": "Chatbots: Rule-Based to Neural",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/",
        "summary": "ELIZAはパターンマッチで返答した。DialogFlowはインテントを対応付けた。GPTは重みから答えた。Claudeはツールを実行して検証する。どの時代も、前の時代で最も目立った失敗を解こうとしてきた。",
        "keywords": "Step 1: ルールベースのパターンマッチング · Step 2: 検索ベース（FAQ） · Step 3: ニューラル生成（ベースライン） · Step 4: LLMエージェントループ · Step 5: ハイブリッドルーティング"
      },
      {
        "name": "Multilingual NLP",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/",
        "summary": "1つのモデル、100以上の言語、その大半では学習データがゼロ。クロスリンガル転移は、2020年代の実用上の奇跡です。",
        "keywords": "Step 1: ゼロショット・クロスリンガル分類 · Step 2: 多言語埋め込み空間 · Step 3: few-shotファインチューニング戦略 · トークン化税（低リソース言語で何が壊れるか）"
      },
      {
        "name": "Subword Tokenization: BPE, WordPiece, Unigram, SentencePiece",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/19-subword-tokenization/",
        "summary": "単語単位のトークナイザは未知語で詰まります。文字単位のトークナイザはシーケンス長を爆発させます。サブワードトークナイザはその中間を取ります。現代のLLMはどれもこれを使っています。",
        "keywords": "Step 1: BPEをスクラッチから実装する · Step 2: 学習したマージでエンコードする · Step 3: 実務でSentencePieceを使う · Step 4: OpenAI互換語彙にtiktokenを使う"
      },
      {
        "name": "Structured Outputs & Constrained Decoding",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/",
        "summary": "LLMにJSONを求めると、たいていJSONが返ります。本番では、この「たいてい」が問題です。制約付きデコーディングは、サンプリング前にlogitを編集することで「たいてい」を「常に」に変えます。",
        "keywords": "直感に反する結果 · コストの高い落とし穴 · Step 1: regex制約付き生成をスクラッチから実装する · Step 2: JSON SchemaにOutlinesを使う · Step 3: プロバイダ非依存のPydanticにInstructorを使う · Step 4: ネイティブのベンダーAPI"
      },
      {
        "name": "NLI & Textual Entailment",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/",
        "summary": "「t が h を含意する」とは、t を読んだ人間が h は真だと結論づける、という意味です。NLI は、含意 / 矛盾 / 中立を予測するタスクです。表面上は地味ですが、本番環境では重要な土台になります。",
        "keywords": "Step 1: 事前訓練済み NLI モデルを実行する · Step 2: ゼロショット分類 · Step 3: RAG の忠実性チェック · Step 4: 手作り NLI 分類器 (概念用)"
      },
      {
        "name": "Embedding Models Deep Dive",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/",
        "summary": "Word2Vec は単語ごとにベクトルを与えました。現代の埋め込みモデルは、パッセージごとに、言語横断で、sparse / dense / multi-vector の見方を持ち、インデックスに収まるサイズのベクトルを与えます。選び方を間違えると、RAG は間違ったものを検索します。",
        "keywords": "MTEB leaderboard が語るのは一部だけ · 3 層パターン · Step 1: baseline — Sentence-BERT による dense embeddings · Step 2: Matryoshka truncation · Step 3: BGE-M3 の多機能性 · Step 4: custom task での MTEB eval · Step 5: ゼロから手作りする cosine"
      },
      {
        "name": "Chunking Strategies for RAG",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/",
        "summary": "チャンキング設定は、embedding model の選択と同じくらい検索品質に影響します (Vectara NAACL 2025)。チャンキングを間違えると、どれだけ reranking しても救えません。",
        "keywords": "すべての default に勝つルール · Step 1: fixed と recursive chunking · Step 2: semantic chunking · Step 3: parent-document · Step 4: contextual retrieval (Anthropic pattern) · Step 5: evaluate"
      },
      {
        "name": "Coreference Resolution",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/24-coreference-resolution/",
        "summary": "「彼女は彼に電話した。彼は答えなかった。医師は昼食中だった。」2 人に対して 3 つの参照があり、誰も名前で呼ばれていません。Coreference resolution は、誰が誰なのかを解き明かします。",
        "keywords": "Step 1: pretrained neural coreference (AllenNLP / spaCy-experimental) · Step 2: rule-based pronoun resolver (teaching) · Step 3: using LLMs for coreference · Step 4: evaluation"
      },
      {
        "name": "Entity Linking & Disambiguation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/25-entity-linking/",
        "summary": "NER は \"Paris\" を見つけました。Entity linking は、Paris, France なのか、Paris Hilton なのか、Paris, Texas なのか、Paris (Trojan prince) なのかを決めます。linking がなければ、knowledge graph は曖昧なままです。",
        "keywords": "2 つの測定値 · Step 1: Wikipedia redirects から alias index を作る · Step 2: context-based disambiguation · Step 3: embedding-based (BLINK-style) · Step 4: generative entity linking (concept) · Step 5: AIDA-CoNLL で評価する"
      },
      {
        "name": "Relation Extraction & Knowledge Graph Construction",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/",
        "summary": "NER は entities を見つけました。Entity linking はそれらを anchor しました。Relation extraction は、その間の edges を見つけます。Knowledge graph は nodes、edges、そしてそれらの provenance の総和です。",
        "keywords": "Step 1: pattern-based extraction · Step 2: supervised relation classification · Step 3: LLM-prompted extraction with anchoring · Step 4: closed ontology へ canonicalize する · Step 5: 小さな graph を作って query する"
      },
      {
        "name": "LLM Evaluation: RAGAS, DeepEval, G-Eval",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/",
        "summary": "Exact-match と F1 は意味的な同等性を取りこぼす。人手レビューはスケールしない。本番での答えは LLM-as-judge だ。ただし、その数値を信頼できるだけの calibration が必要になる。",
        "keywords": "Step 1: NLI による faithfulness（RAGAS-style） · Step 2: answer relevance · Step 3: G-Eval custom metric · Step 4: CI gate · Step 5: scratch からの toy eval"
      },
      {
        "name": "Long-Context Evaluation: NIAH, RULER, LongBench, MRCR",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/",
        "summary": "Gemini 3 Pro は 10M tokens の context をうたっている。1M tokens では、8-needle MRCR が 26.3% まで落ちる。advertised ≠ usable。Long-context evaluation は、あなたが ship する model の実際の容量を教えてくれる。",
        "keywords": "実際に報告すべきもの · Step 1: domain 向け custom NIAH · Step 2: multi-needle variant · Step 3: multi-hop variable tracing（RULER-style） · Step 4: stack 上で LongBench v2"
      },
      {
        "name": "Dialogue State Tracking",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/",
        "summary": "\"I want a cheap restaurant in the north... actually make it moderate... and add Italian.\" 3 turns、3 state updates。DST は slot-value dict を同期し続け、booking が正しく動くようにする。",
        "keywords": "古典的な failure modes · Step 1: rule-based slot extractor · Step 2: state update loop · Step 3: structured output による LLM-driven DST · Step 4: JGA evaluation · Step 5: correction handling"
      }
    ]
  },
  {
    "id": 6,
    "name": "音声とオーディオ",
    "status": "complete",
    "desc": "聞き、理解し、話す。",
    "lessons": [
      {
        "name": "Audio Fundamentals: Waveforms, Sampling, FFT",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/01-audio-fundamentals",
        "summary": "波形は生の信号です。スペクトログラムはその表現です。Mel 特徴量は機械学習で扱いやすい形です。現代の ASR と TTS のパイプラインはすべてこの段階をたどり、最初の一段はサンプリングとフーリエを理解することです。",
        "keywords": "手順 1: クリップを読み込み、波形をプロットする · 手順 2: 原理から正弦波を合成する · 手順 3: DFT を手で計算する · 手順 4: 支配的な周波数を見つける · 手順 5: エイリアシングを実演する"
      },
      {
        "name": "Spectrograms, Mel Scale & Audio Features",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/02-spectrograms-mel-features",
        "summary": "ニューラルネットは生波形をうまく直接消費できません。スペクトログラムを消費します。Mel スペクトログラムならさらにうまく扱えます。2026 年のあらゆる ASR、TTS、音声分類器は、この 1 つの前処理選択に成否を左右されます。",
        "keywords": "手順 1: 波形をフレーム化する · 手順 2: Hann 窓 · 手順 3: STFT の大きさ · 手順 4: Mel フィルタバンク · 手順 5: log-mel · 手順 6: MFCC"
      },
      {
        "name": "Audio Classification",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/03-audio-classification",
        "summary": "\"dog barking vs siren\" から \"which language is this\" まで、すべて音声分類です。特徴量は mels。アーキテクチャは時代ごとに移り変わります。評価は AUC、F1、per-class recall のままです。",
        "keywords": "クラス不均衡が本当の課題 · 評価 · 手順 1: 特徴量化する · 手順 2: 固定長の要約 · 手順 3: k-NN · 手順 4: log-mels 上の CNN にアップグレードする · 手順 5: 2026 年のデフォルト — BEATs を fine-tune する"
      },
      {
        "name": "Speech Recognition (ASR)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/04-speech-recognition-asr",
        "summary": "音声認識は、各タイムステップでの音声分類を、英語と無音を理解する系列モデルでつなぎ合わせる問題です。CTC、RNN-T、attention はそれを行う 3 つの方法です。1 つ選び、なぜそうするのかを理解しましょう。",
        "keywords": "WER: 1 つの数値 · 手順 1: greedy CTC decode · 手順 2: beam-search CTC · 手順 3: WER · 手順 4: Whisper で推論する · 手順 5: Parakeet または wav2vec 2.0 でストリーミングする"
      },
      {
        "name": "Whisper: Architecture & Fine-Tuning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/05-whisper-architecture-finetuning",
        "summary": "Whisper は、30 秒ウィンドウの transformer encoder-decoder です。68 万時間の多言語・弱教師あり音声テキストペアで学習されました。1 つのアーキテクチャで複数タスクに対応し、99 言語で堅牢に動きます。2026 年の基準となる ASR です。",
        "keywords": "2026 年のバリアント · ファインチューニング · Step 1: Whisper をそのまま実行する · Step 2: チャンク化した長尺処理 · Step 3: LoRA でファインチューニングする · Step 4: 各層が何を学ぶかを調べる"
      },
      {
        "name": "Speaker Recognition & Verification",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/06-speaker-recognition-verification",
        "summary": "ASR は「何と言ったか」を問います。speaker recognition は「誰が言ったか」を問います。数式は embeddings と cosine で同じように見えますが、本番での判断はすべて 1 つの EER に依存します。",
        "keywords": "スコアリング · 知っておくべき数値 (2026) · Diarization · Step 1: MFCC 統計量から toy embedding を作る · Step 2: cosine similarity と threshold · Step 3: similarity pairs から EER を求める · Step 4: SpeechBrain で本番相当の処理 · Step 5: pyannote で diarize する"
      },
      {
        "name": "Text-to-Speech (TTS)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/07-text-to-speech",
        "summary": "ASR は音声をテキストに戻します。TTS はテキストを音声に戻します。2026 年のスタックは 3 部構成です。text → tokens、tokens → mel、mel → waveform。それぞれに、ノート PC に収まるデフォルトモデルがあります。",
        "keywords": "Vocoder の進化 · 評価 · Step 1: 入力を phonemize する · Step 2: Kokoro を実行する (2026 年の CPU デフォルト) · Step 3: voice cloning 付きで F5-TTS を実行する · Step 4: HiFi-GAN vocoder を scratch から作る · Step 5: 完全な pipeline (pseudocode)"
      },
      {
        "name": "Voice Cloning & Voice Conversion",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/08-voice-cloning-conversion",
        "summary": "Voice cloning は、誰か別の声であなたのテキストを読み上げます。Voice conversion は、話した内容を保ったまま、あなたの声を別の人の声に書き換えます。どちらも同じ分解に依存します。speaker identity と content を分離することです。",
        "keywords": "倫理は後付けの付属品ではない · 数値 (2026) · Step 1: recognition-synthesis で分解する (`main.py` 内の code-only demo) · Step 2: F5-TTS で zero-shot clone する · Step 3: KNN-VC で voice conversion する · Step 4: watermark を埋め込む · Step 5: consent gate"
      },
      {
        "name": "Music Generation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/09-music-generation",
        "summary": "2026年の音楽生成では、商用領域を Suno v5 と Udio v4 が支配し、オープンソースでは MusicGen、Stable Audio Open、ACE-Step が先頭を走っています。技術的な問題はほぼ解けています。法的な問題は、Warner Music の 5億ドル和解や UMG 和解によって、2025-2026年に分野全体を作り変えました。",
        "keywords": "neural-codec トークン上の Token LM · mel または latent 上の diffusion · Hybrid（production）— Suno、Udio、Lyria · 評価 · Step 1: MusicGen で生成する · Step 2: メロディ条件付け · Step 3: FAD 評価 · Step 4: LLM と音楽のワークフローに追加する"
      },
      {
        "name": "Audio-Language Models",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/10-audio-language-models",
        "summary": "2026年の audio-language model は、音声、環境音、音楽を横断して推論します。Qwen2.5-Omni-7B は MMAU-Pro で GPT-4o Audio に並びます。Audio Flamingo Next は LongAudioBench で Gemini 2.5 Pro を上回ります。オープンとクローズドの差は実質的に閉…",
        "keywords": "3コンポーネントのテンプレート · 2026年のモデルマップ · ベンチマークの現実確認（2026） · 2026年に LALM が役立つ場所 · まだ役に立たない場所 · Step 1: Qwen2.5-Omni に問い合わせる · Step 2: projector pattern · Step 3: MMAU / LongAudioBench のベンチマーク"
      },
      {
        "name": "Real-Time Audio Processing",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/11-real-time-audio-processing",
        "summary": "バッチパイプラインはファイルを処理します。リアルタイムパイプラインは、次の20ミリ秒が到着する前に、今の20ミリ秒を処理します。すべての会話 AI、放送スタジオ、電話 bot は、このレイテンシ予算で成否が決まります。",
        "keywords": "よくある落とし穴 · Step 1: ring buffer · Step 2: VAD gate · Step 3: streaming ASR · Step 4: interruption handler"
      },
      {
        "name": "Build a Voice Assistant Pipeline",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/12-voice-assistant-pipeline",
        "summary": "lessons 01-11 のすべてをつなぎ合わせます。聞いて、推論し、話し返す voice assistant を作ります。2026年には、これは研究問題ではなく解決済みのエンジニアリング問題です。ただし、出荷できるかどうかは統合の細部で決まります。",
        "keywords": "7つのコンポーネント · 必ず遭遇する3つの失敗モード · 2026年の本番 reference stacks · Step 1: chunking 付き mic capture（pseudocode） · Step 2: VAD-gated turn capture · Step 3: streaming STT → LLM → TTS · Step 4: LLM loop 内の tool calling · Step 5: interruption handling"
      },
      {
        "name": "Neural Audio Codecs — EnCodec, SNAC, Mimi, DAC",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/13-neural-audio-codecs",
        "summary": "2026 年の音声生成は、ほぼすべてがトークンで動いています。EnCodec、SNAC、Mimi、DAC は連続的な波形を、Transformer が予測できる離散シーケンスへ変換します。セマンティックトークンと音響トークンの分離、つまり最初のコードブックをセマンティック、残りを音響として扱う設計は、音声において Transformer 以来もっとも重…",
        "keywords": "中核の仕組み: Residual Vector Quantization (RVQ) · 2026 年に重要な 4 つのコーデック · フレームレートは言語モデルに効く · セマンティックトークンと音響トークン · 2026 年の復元品質 (bits per sec、低ビットレートほどよい) · Step 1: EnCodec でエンコードする · Step 2: デコードして復元を測る · Step 3: セマンティック・音響分離 (Mimi 風) · Step 4: コーデックトークン上の AR LM が機能する理由"
      },
      {
        "name": "Voice Activity Detection & Turn-Taking",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/14-voice-activity-detection-turn-taking",
        "summary": "すべての音声エージェントは 2 つの判断で成否が決まります。ユーザーはいま話しているか、そして話し終えたか。VAD は前者に答えます。Turn-detection (VAD + silence-hangover + semantic endpoint model) は後者に答えます。どちらかを間違えると、アシスタントはユーザーを遮るか、いつまでも黙りません。",
        "keywords": "3 段の VAD カスケード · 主要パラメータと既定値 · flush trick (Kyutai 2025) · 2026 年の VAD 比較 · Step 1: energy gate · Step 2: Python で Silero VAD · Step 3: turn-end state machine · Step 4: flush trick の骨組み"
      },
      {
        "name": "Streaming Speech-to-Speech — Moshi, Hibiki",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki",
        "summary": "2024-2026 年に voice AI は再定義されました。Moshi は 200 ms レイテンシで、同時に聞きながら話す単一モデルを出荷しています。Hibiki は speech-to-speech translation をチャンク単位で行います。どちらも ASR → LLM → TTS パイプラインを捨て、Mimi codec tokens…",
        "keywords": "Moshi architecture · inner-monologue text が役立つ理由 · Hibiki: streaming speech-to-speech translation · Kyutai stack 全体 (2026) · Sesame CSM — 近い親戚 · 2026 年の性能値 · Step 1: interface · Step 2: full-duplex loop · Step 3: training objective (概念) · Step 4: Moshi が勝つ場所、勝たない場所"
      },
      {
        "name": "Voice Anti-Spoofing & Audio Watermarking",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking",
        "summary": "Voice cloning は防御より速く出荷されました。2026 年の本番音声システムには 2 つが必要です。real vs fake speech を分類する detector (AASIST、RawNet2) と、圧縮や編集に耐える watermark (AudioSeal) です。両方を出荷するか、voice cloning を出荷しないかです。",
        "keywords": "ASVspoof 5 — 2024-2025 年の benchmark · AASIST と RawNet2 — detection model families · AudioSeal — 2024 年の watermark default · WavMark · WaveVerify (July 2025) · 攻撃者が突くギャップ · C2PA / Content Authenticity Initiative · Step 1: 単純な spectral-feature detector (toy) · Step 2: AudioSeal embed + detect · Step 3: evaluation — EER · Step 4: production integration"
      },
      {
        "name": "Audio Evaluation — WER, MOS, MMAU, Leaderboards",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/06-speech-and-audio/17-audio-evaluation-metrics",
        "summary": "測れないものは出荷できません。このレッスンでは、2026 年の音声タスクごとの指標を整理します。ASR (WER、CER、RTFx)、TTS (MOS、UTMOS、SECS、WER-on-ASR-round-trip)、audio-language (MMAU、LongAudioBench)、music (FAD、CLAP)、speaker (EER)…",
        "keywords": "ASR metrics · TTS metrics · Voice-cloning-specific · Speaker verification · Diarization · Audio classification · Music generation · Audio-language benchmarks · Streaming speech-to-speech · 2026 年の leaderboards · Step 1: normalization つき WER · Step 2: TTS round-trip WER · Step 3: voice cloning 用 SECS · Step 4: music generation 用 FAD · Step 5: speaker verification 用 EER (Lesson 6 と同じコード)"
      }
    ]
  },
  {
    "id": 7,
    "name": "Transformer 詳解",
    "status": "complete",
    "desc": "すべてを変えた architecture を理解します。",
    "lessons": [
      {
        "name": "Why Transformers: The Problems with RNNs",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/01-why-transformers/",
        "summary": "RNN はトークンを 1 つずつ処理します。Transformer はすべてのトークンを一度に処理します。この 1 つのアーキテクチャ上の賭けが、2017 年以降のディープラーニングにおけるあらゆるスケーリング曲線を変えました。",
        "keywords": "Step 1: 直列深さを測る · Step 2: 理論上の演算を数える · Step 3: 長い系列での経験的スケーリング"
      },
      {
        "name": "Self-Attention from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/02-self-attention-from-scratch/",
        "summary": "Attention は、すべての単語が「自分にとって誰が重要か？」と問い、その答えを学習する lookup table です。",
        "keywords": "データベース検索のアナロジー · Q, K, V の計算 · Attention 行列 · なぜスケールするのか · Softmax はスコアを重みに変える · Value の重み付き和 · 全体の流れ · Step 1: Softmax をゼロから実装する · Step 2: Scaled dot-product attention · Step 3: 学習される projection を持つ Self-attention クラス · Step 4: 文で動かす · Step 5: ASCII ヒートマップで attention を可視化する"
      },
      {
        "name": "Multi-Head Attention",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/03-multi-head-attention/",
        "summary": "1 つの attention head は一度に 1 つの関係を学びます。8 個の head は 8 個を学びます。head は安いので、もっと使いましょう。",
        "keywords": "Step 1: 既存の single-head attention から head を分割する · Step 2: head ごとに scaled-dot-product attention を実行する · Step 3: Grouped-Query Attention の変種 · Step 4: 各 head が学んだものを調べる"
      },
      {
        "name": "Positional Encoding: Sinusoidal, RoPE, ALiBi",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/04-positional-encoding/",
        "summary": "Attention は permutation-invariant です。位置情報がなければ、\"The cat sat on the mat\" と \"mat the on sat cat the\" は同じ出力を生みます。3 つのアルゴリズムがこれを修正します。それぞれが「位置」とは何かについて異なる仮定を置いています。",
        "keywords": "Absolute sinusoidal · RoPE · ALiBi · 2026 年に何を選ぶか · Step 1: sinusoidal encoding · Step 2: Q, K に RoPE を適用する · Step 3: ALiBi の slope と bias · Step 4: RoPE の相対距離性を検証する"
      },
      {
        "name": "The Full Transformer: Encoder + Decoder",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/05-full-transformer/",
        "summary": "Attention は主役です。それ以外の residual、normalization、feed-forward、cross-attention は、Attention を深く積み重ねられるようにする足場です。",
        "keywords": "6 つの部品 · Encoder block (BERT、T5 encoder で使用) · Decoder block (GPT、T5 decoder で使用) · Pre-norm と post-norm · 2026 年版の現代的ブロック · Parameter count · Step 1: building blocks · Step 2: 2-layer encoder と 2-layer decoder をつなぐ · Step 3: toy example で forward を走らせる · Step 4: RMSNorm + SwiGLU に差し替える"
      },
      {
        "name": "BERT — Masked Language Modeling",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/06-bert-masked-language-modeling/",
        "summary": "GPT は次の単語を予測します。BERT は欠けた単語を予測します。違いはたった 1 文ですが、embedding 系のあらゆる仕事を 5 年分変えました。",
        "keywords": "Training signal · BERT mask rules · Next Sentence Prediction (NSP) — そして落とされた理由 · 2026 年に何が変わったか: ModernBERT · 2026 年でも encoder を選ぶ use case · Step 1: masking logic · Step 2: tiny corpus で MLM prediction を走らせる · Step 3: mask type を比較する · Step 4: fine-tune head"
      },
      {
        "name": "GPT — Causal Language Modeling",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/",
        "summary": "BERT は両側を見ます。GPT は過去だけを見ます。triangle mask は、現代 AI でもっとも影響の大きい 1 行の code です。",
        "keywords": "Mask · Parallel training, serial inference · Loss — shift-by-one · Decoding strategies · 「GPT recipe」を機能させたもの · Step 1: causal mask · Step 2: 2-layer GPT-ish model · Step 3: next-token prediction, end-to-end · Step 4: sampling"
      },
      {
        "name": "T5, BART — Encoder-Decoder Models",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/",
        "summary": "Encoder は理解します。Decoder は生成します。両者をもう一度組み合わせると、translate、summarize、rewrite、transcribe のような input → output tasks に向いた model ができます。",
        "keywords": "Forward loop · T5 pretraining — span corruption · BART pretraining — multi-noise denoising · Inference · 2026 年に各 variant を選ぶ場面 · Step 1: span corruption · Step 2: round-trip を検証する · Step 3: BART noising"
      },
      {
        "name": "Vision Transformers (ViT)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/09-vision-transformers/",
        "summary": "画像はパッチのグリッドです。文はトークンのグリッドです。同じ transformer がその両方を処理します。",
        "keywords": "Step 1 — patchify · Step 2 — linear embedding · Step 3 — `[CLS]` token を先頭に追加し、positional embeddings を加える · Step 4 — 標準 transformer encoder · Step 5 — head · 重要だった variants · 時間がかかった理由 · Step 1: fake image · Step 2: patchify · Step 3: linear embed · Step 4: 現実的な ViT の parameter count を数える"
      },
      {
        "name": "Audio Transformers — Whisper Architecture",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/10-audio-transformers-whisper/",
        "summary": "音声は、時間に沿った周波数の画像です。Whisper は mel spectrogram を食べて言葉を返す ViT です。",
        "keywords": "Step 1 — resample + window · Step 2 — convolutional stem · Step 3 — encoder · Step 4 — decoder · Step 5 — task tokens · Step 6 — output · Whisper sizes · Whisper がしないこと · 2026 landscape · Step 1: synthesize audio · Step 2: log-mel spectrogram (simplified) · Step 3: pad to 30 s · Step 4: build the prompt tokens"
      },
      {
        "name": "Mixture of Experts (MoE)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/11-mixture-of-experts/",
        "summary": "Dense 70B transformer は、すべての token で全 parameter を活性化します。671B MoE は token あたり 37B だけを活性化し、すべての benchmark でそれを上回ります。Sparsity はこの 10 年で最も重要な scaling idea です。",
        "keywords": "FFN の置き換え · load-balancing problem · Shared experts · Fine-grained experts · cost profile · 注意点: memory · Step 1: router · Step 2: router に 100 tokens を通す · Step 3: param count comparison"
      },
      {
        "name": "KV Cache, Flash Attention & Inference Optimization",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/12-kv-cache-flash-attention/",
        "summary": "Training は parallel で FLOP-bound です。Inference は serial で memory-bound です。bottleneck が違えば、tricks も違います。",
        "keywords": "KV cache math · Flash Attention — tiling trick · Speculative decoding — もう 1 つの latency win · Continuous batching · PagedAttention — virtual memory としての KV cache · Step 1: KV cache · Step 2: tiled softmax · Step 3: 100-token generation で naive vs cached decoding を比較する"
      },
      {
        "name": "Scaling Laws",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/13-scaling-laws/",
        "summary": "2020 年の Kaplan 論文はこう述べました。モデルが大きいほど loss は下がる。2022 年の Hoffmann 論文はこう述べました。それは学習不足だった。計算量は parameters と tokens という 2 つのバケットに入り、その分配は自明ではありません。",
        "keywords": "Hoffmann law · それでも over-training する理由 · Emergence と smoothness · 2026 年の全体像 · Step 1: Chinchilla loss · Step 2: compute-optimal frontier · Step 3: over-training cost · Step 4: compare to real models"
      },
      {
        "name": "Build a Transformer from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/14-build-a-transformer-capstone/",
        "summary": "13 lessons。1 つの model。近道なし。",
        "keywords": "ここで提供するもの · ここで提供しないもの · 目標 metrics · Step 1: data · Step 2: model · Step 3: training loop · Step 4: sample · Step 5: read the output"
      },
      {
        "name": "Attentionの変種 — Sliding Window, Sparse, Differential",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/15-attention-variants/",
        "summary": "Full attention は円です。すべての token がすべての token を見て、memory がその代償を払います。4 つの variant は円の形を曲げ、cost の半分を取り戻します。",
        "keywords": "Sliding Window Attention (SWA) · Sparse / Block Attention · Differential Attention (DIFF Transformer, 2024) · Variant の比較 · Step 1: full causal mask (baseline) · Step 2: sliding window causal mask · Step 3: local + strided sparse mask · Step 4: differential attention · Step 5: KV cache sizes"
      },
      {
        "name": "投機的デコード — Draft, Verify, Repeat",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/07-transformers-deep-dive/16-speculative-decoding/",
        "summary": "Autoregressive decoding は serial です。各 token は前の token を待ちます。Speculative decoding はこの連鎖を壊します。安価な model が N tokens を draft し、高価な model が 1 回の forward pass で N 個すべてを verify します。dra…",
        "keywords": "Core algorithm · Speedup を決めるもの · Medusa — drafts without a draft model · EAGLE — better draft by reusing hidden states · KV cache の扱い · Step 1: the rejection step · Step 2: residual distribution · Step 3: one speculative step · Step 4: measure acceptance rate · Step 5: verify distribution equivalence"
      }
    ]
  },
  {
    "id": 8,
    "name": "生成 AI",
    "status": "complete",
    "desc": "画像、動画、音声、3D などを生成します。",
    "lessons": [
      {
        "name": "Generative Models: Taxonomy & History",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/01-generative-models-taxonomy-history/",
        "summary": "画像モデル、テキストモデル、動画モデル、3Dモデルは、すべて5つの箱のどれかに入る。箱を間違えると、数週間にわたって数式と格闘することになる。正しい箱を選べば、この分野の過去12年の進歩が頭の中で自然に積み上がる。"
      },
      {
        "name": "Autoencoders & VAE",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/02-autoencoders-vae/",
        "summary": "普通の autoencoder は圧縮してから再構成する。記憶はする。生成はしない。そこに1つの工夫、つまり code を Gaussian に見えるよう強制する仕掛けを加えると sampler が得られる。`z = μ + σ·ε` の reparameterization というこの1つの工夫こそ、2026年に使う latent-diffusion…",
        "keywords": "Step 1: encoder forward · Step 2: reparameterize and decode · Step 3: the ELBO · Step 4: generate"
      },
      {
        "name": "GANs: Generator vs Discriminator",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/03-gans-generator-discriminator/",
        "summary": "2014年の Goodfellow の工夫は、密度を完全に飛ばすことだった。2つのネットワーク。1つは偽物を作る。もう1つはそれを見破る。本物と見分けがつかなくなるまで戦わせる。動くはずがないように見える。実際、しばしば動かない。それでも動いたとき、狭いドメインでは今でも文献中で最もシャープなサンプルを出す。",
        "keywords": "Step 1: non-saturating loss · Step 2: one discriminator step per generator step · Step 3: watch for mode collapse"
      },
      {
        "name": "Conditional GANs & Pix2Pix",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/04-conditional-gans-pix2pix/",
        "summary": "2014-2017年の最初の大きな進展は、GAN が何を作るかを制御できるようにしたことだった。label、image、sentence を付ける。Pix2Pix はその画像版であり、狭い image-to-image tasks では今でも generic text-to-image model を上回る。",
        "keywords": "Step 1: append condition to both G and D inputs · Step 2: train conditional · Step 3: verify per-class output"
      },
      {
        "name": "StyleGAN",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/05-stylegan/",
        "summary": "ほとんどの生成器は、すべての層に同時に `z` を混ぜ込みます。StyleGAN はそれを分解しました。まず `z` を中間表現 `w` に写像し、そのうえで AdaIN によって各解像度レベルへ `w` を注入します。このひとつの変更で潜在空間のもつれがほどけ、フォトリアルな顔生成はその後 7 年にわたって解けた問題になりました。",
        "keywords": "Step 1: mapping network · Step 2: adaptive instance normalization · Step 3: per-layer noise"
      },
      {
        "name": "Diffusion Models — DDPM from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/06-diffusion-ddpm-from-scratch/",
        "summary": "Ho, Jain, Abbeel (2020) は、この分野が手放せなくなるレシピを与えました。千個の小さなステップでデータをノイズに破壊する。1 つのニューラルネットにそのノイズを予測させる。推論時にはその過程を逆向きにたどる。現在の主流の画像、動画、3D、音楽モデルはすべてこのループの上で動いており、その上に flow matching や con…",
        "keywords": "Step 1: the forward schedule (closed form) · Step 2: sample `x_t` in one shot · Step 3: one training step · Step 4: reverse sampling"
      },
      {
        "name": "Latent Diffusion & Stable Diffusion",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/07-latent-diffusion-stable-diffusion/",
        "summary": "512×512 画像に対する pixel-space diffusion は、計算量の観点では犯罪的です。Rombach et al. (2022) は、画像生成に 786k 次元すべては不要だと気づきました。必要なのは semantic structure を捉えるのに十分な表現と、残りを担当する別の decoder です。VAE の latent …",
        "keywords": "Step 1: encoder/decoder · Step 2: diffusion in `z`-space · Step 3: classifier-free guidance · Step 4: text conditioning (concept, not code)"
      },
      {
        "name": "ControlNet, LoRA & Conditioning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/08-controlnet-lora-conditioning/",
        "summary": "text だけでは、制御信号として不器用です。ControlNet は pretrained diffusion model を clone し、depth map、pose skeleton、scribble、edge image で誘導できるようにします。LoRA は 10 million parameters を学習するだけで 2B-parame…",
        "keywords": "ControlNet (Zhang et al., 2023) · LoRA (Hu et al., 2021) · IP-Adapter (Ye et al., 2023) · Step 1: LoRA math · Step 2: zero-init side network"
      },
      {
        "name": "Inpainting, Outpainting & Editing",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/09-inpainting-outpainting-editing/",
        "summary": "Text-to-image は新しいものを作ります。インペインティングは既存のものを直します。本番環境では、請求対象になる画像作業の 70% は編集です。背景を差し替える、ロゴを消す、キャンバスを拡張する、手を再生成する。インペインティングは、拡散モデルが実務で価値を発揮する場所です。",
        "keywords": "素朴な方法と、それが誤っている理由 · 適切なインペインティングモデル · SDEdit (Meng et al., 2022) - 再訓練なしの編集 · InstructPix2Pix (Brooks et al., 2023) · RePaint (Lugmayr et al., 2022) · Step 1: 5-D DDPM data · Step 2: 5 次元すべてに対する denoiser を訓練する · Step 3: 推論時の mask-aware reverse · Step 4: outpainting"
      },
      {
        "name": "Video Generation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/10-video-generation/",
        "summary": "画像は 2-D tensor です。動画は 3-D tensor です。理論は同じですが、計算量は 10-100 倍難しくなります。OpenAI の Sora (Feb 2024) は、それが可能であることを示しました。2026 年までに Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0、WAN 2.2 は、1080p の本番…",
        "keywords": "Patchify · Spatiotemporal DiT · Text conditioning · Training · Step 1: 合成 1-D \"video\" を patchify する · Step 2: フレームごとの position embedding · Step 3: denoiser が系列全体を見る · Step 4: temporal coherence test"
      },
      {
        "name": "Audio Generation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/11-audio-generation/",
        "summary": "音声は 16-48 kHz の 1-D 信号です。5 秒のクリップは 80-240k samples です。どの transformer も、この系列に直接 attention しません。2026 年のすべての本番音声モデルの解は同じです。neural codec (Encodec, SoundStream, DAC) が音声を 50-75 Hz の …",
        "keywords": "Neural audio codecs · 上位の 2 つの生成パラダイム · Step 1: synthetic audio tokens · Step 2: 小さな token predictor を訓練する · Step 3: 条件付きでサンプルする"
      },
      {
        "name": "3D Generation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/12-3d-generation/",
        "summary": "3D は、2D-to-3D の leverage が最も強い modality です。2023 年のブレイクスルーは 3D Gaussian Splatting でした。2024-2026 年の生成系の流れは、その上に multi-view diffusion + 3D reconstruction を重ね、単一の prompt や photo から …",
        "keywords": "Representation: 3D Gaussian Splatting (Kerbl et al., 2023) · Multi-view diffusion · Text-to-3D pipelines · NeRF (文脈として) · Step 1: 2D Gaussian splat · Step 2: splats を足し合わせて render する · Step 3: gradient descent で fit する"
      },
      {
        "name": "Flow Matching & Rectified Flows",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/13-flow-matching-rectified-flows/",
        "summary": "Diffusion models が 20-50 回のサンプリングステップを必要とするのは、ノイズからデータへ曲がった経路をたどるためです。Flow matching (Lipman et al., 2023) と rectified flow (Liu et al., 2022) は、直線的な経路を学習しました。経路がまっすぐになるほどステップ数は減…",
        "keywords": "Straight-line flow · Sampling · Rectified flow (Liu 2022) · Why this won for images in 2024 · Step 1: training loss · Step 2: multi-step inference · Step 3: compare step counts"
      },
      {
        "name": "Evaluation: FID, CLIP Score",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/14-evaluation-fid-clip-score/",
        "summary": "生成モデルの leaderboard では、必ず FID、CLIP score、人間選好 arena の win rate が引用されます。どの数値にも、意図的な研究者が gaming できる failure mode があります。Failure mode を知らなければ、本当の改善と gaming run を見分けられません。",
        "keywords": "FID — sample quality · CLIP score — prompt adherence · Human preference — the ground truth · Step 1: FID in four lines · Step 2: CLIP-style cosine-similarity · Step 3: Elo aggregation"
      },
      {
        "name": "Visual Autoregressive Modeling (VAR): Next-Scale予測",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/08-generative-ai/19-visual-autoregressive-var/",
        "summary": "Diffusion models は時間方向に反復して sample します（denoising steps）。VAR は scale 方向に反復して sample します。1x1 token を予測し、次に 2x2、4x4 と進み、最終解像度まで各 scale が前の scale に条件づけられます。2024 年の論文は、VAR が画像生成で GPT…",
        "keywords": "VQ-VAE Multi-Scale Tokenizer · Next-Scale Prediction · Generation · Why Next-Scale Wins Over Next-Token · Scaling Law · Relationship to Diffusion"
      }
    ]
  },
  {
    "id": 9,
    "name": "強化学習",
    "status": "complete",
    "desc": "RLHF と game-playing AI の基礎です。",
    "lessons": [
      {
        "name": "MDPs, States, Actions & Rewards",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/01-mdps-states-actions-rewards/",
        "summary": "Markov Decision Process は、状態、行動、遷移、報酬、割引の5つでできています。RL のすべて、つまり Q-learning、PPO、DPO、GRPO は、この形の上で最適化します。一度学べば、強化学習の残りをずっと読みやすくなります。",
        "keywords": "Step 1: 小さな決定的 MDP · Step 2: 方策をロールアウトする · Step 3: Bellman 方程式で `V^π` を正確に計算する · Step 4: `γ` は物理的な意味を持つハイパーパラメータ"
      },
      {
        "name": "Dynamic Programming",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/02-dynamic-programming/",
        "summary": "動的計画法は、ずるができる RL です。遷移関数と報酬関数をすでに知っているので、`V` または `π` が動かなくなるまで Bellman 方程式を反復するだけです。これは、すべてのサンプリングベース手法が近づこうとするベンチマークです。",
        "keywords": "Step 1: GridWorld MDP モデルを作る · Step 2: policy evaluation · Step 3: policy improvement · Step 4: つなぎ合わせる · Step 5: value iteration（1ループ版）"
      },
      {
        "name": "Monte Carlo Methods",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/03-monte-carlo-methods/",
        "summary": "動的計画法にはモデルが必要です。Monte Carlo に必要なのはエピソードだけです。方策を実行し、リターンを観測し、平均します。RL で最も単純な発想であり、下流のすべてを開く発想です。",
        "keywords": "Step 1: rollout → (s, a, r) のリスト · Step 2: リターンを計算する（逆向きスイープ） · Step 3: first-visit MC evaluation · Step 4: ε-greedy MC control（on-policy） · Step 5: DP のゴールドスタンダードと比較する"
      },
      {
        "name": "Q-Learning, SARSA",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/04-q-learning-sarsa/",
        "summary": "Monte Carlo はエピソード終了まで待ちます。TD は次の価値推定を bootstrap して、各ステップの後に更新します。Q-learning は off-policy で楽観的、SARSA は on-policy で慎重です。どちらもコードでは1行です。どちらも、このフェーズのすべての deep-RL 手法を支えています。",
        "keywords": "Step 1: ε-greedy 方策での SARSA · Step 2: Q-learning · Step 3: 学習曲線 · Step 4: DP の真値と比較する"
      },
      {
        "name": "Deep Q-Networks (DQN)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/05-dqn/",
        "summary": "2013年、Mnih は生のピクセルを入力にした単一の Q-learning ネットワークを訓練し、7本の Atari ゲームで従来型 RL エージェントをすべて上回った。2015年には49本のゲームへ拡張して Nature に発表し、deep-RL の時代を始めた。DQN は、関数近似を安定させる3つの工夫を加えた Q-learning である。",
        "keywords": "ステップ1: replay buffer · ステップ2: 小さな Q-network（手書き MLP） · ステップ3: DQN update · ステップ4: 外側のループ"
      },
      {
        "name": "Policy Gradients — REINFORCE",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/06-policy-gradients-reinforce/",
        "summary": "価値の推定をやめる。方策を直接パラメータ化し、期待 return の勾配を計算し、上り方向へ進む。Williams (1992) はこれを1つの定理として書いた。PPO、GRPO、そしてすべての LLM RL loop が存在する理由がここにある。",
        "keywords": "ステップ1: softmax policy network · ステップ2: sampling と log-probability · ステップ3: log-probs を保持した rollout · ステップ4: REINFORCE update · ステップ5: baselines"
      },
      {
        "name": "Actor-Critic — A2C, A3C",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/",
        "summary": "REINFORCE はノイジーである。`V̂(s)` を学習する critic を追加し、それを return から引くと、期待値は同じまま variance がはるかに低い advantage が得られる。これが actor-critic である。A2C は同期的に実行し、A3C は thread をまたいで実行する。どちらも、現代のあらゆる dee…",
        "keywords": "ステップ1: critic · ステップ2: n-step advantage · ステップ3: combined update · ステップ4: parallelization（A3C vs A2C）"
      },
      {
        "name": "PPO",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/08-ppo/",
        "summary": "A2C は各 rollout を1回の update 後に捨てる。PPO は policy gradient を clipped importance ratio で包み、policy を爆発させずに同じデータで10 epochs 以上回せるようにする。Schulman et al. (2017)。2026年でもなお、デフォルトの policy-gra…",
        "keywords": "ステップ1: rollout 時に `log π_old(a | s)` を保存する · ステップ2: GAE advantages を計算する（Lesson 07） · ステップ3: clipped surrogate update · ステップ4: value と entropy · ステップ5: diagnostics"
      },
      {
        "name": "Reward Modeling & RLHF",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/09-reward-modeling-rlhf/",
        "summary": "人間は「良いアシスタント応答」の報酬関数を手書きできないが、2つの応答を比較して良い方を選ぶことはできる。その比較に報酬モデルをフィットし、言語モデルをそれに対して RL する。Christiano 2017。InstructGPT 2022。GPT-3 を ChatGPT に変えたレシピ。2026年には大部分が DPO に置き換わりつつあるが、考え方…",
        "keywords": "Step 1: 合成選好データ · Step 2: Bradley-Terry 報酬モデル · Step 3: RM の上で PPO 風 policy · Step 4: KL を監視する · Step 5: TRL を使った production recipe"
      },
      {
        "name": "Multi-Agent RL",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/10-multi-agent-rl/",
        "summary": "Single-agent RL は環境が stationary であると仮定する。同じ世界に2つの学習エージェントを置くと、その仮定は壊れる。各エージェントは相手の環境の一部であり、どちらも変化しているからだ。Multi-agent RL は、Markov 仮定が成り立たなくなっても学習を収束させるための技法群である。",
        "keywords": "Step 1: multi-agent env · Step 2: independent Q-learning · Step 3: decomposed-value update 付き centralized Q · Step 4: simple self-play (adversarial 2-agent)"
      },
      {
        "name": "Sim-to-Real Transfer",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/11-sim-to-real-transfer/",
        "summary": "simulator で訓練した policy が hardware で失敗するなら、それは simulator を暗記した policy である。Domain randomization、domain adaptation、system identification は、学習済み controller に reality gap を越えさせるための3つ…",
        "keywords": "Step 1: parameterized sim · Step 2: DR で訓練する · Step 3: 「real」slip で zero-shot 評価する · Step 4: narrow training と比較する"
      },
      {
        "name": "RL for Games",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/09-reinforcement-learning/12-rl-for-games/",
        "summary": "1992年: TD-Gammon が pure TD でバックギャモンの人間 champion を破った。2016年: AlphaGo が Lee Sedol に勝った。2017年: AlphaZero が chess、shogi、Go をゼロから支配した。2024年: DeepSeek-R1 は、PPO を GRPO に置き換えれば同じ recipe…",
        "keywords": "Step 1: 小さな verifier environment · Step 2: policy: prompt ごとの K answer token 上の softmax · Step 3: group sampling と group-relative advantage · Step 4: REINFORCE baseline (value-free) と比較する · Step 5: entropy と KL を観察する"
      }
    ]
  },
  {
    "id": 10,
    "name": "LLM をゼロから作る",
    "status": "complete",
    "desc": "大規模言語モデルを作り、訓練し、理解します。",
    "lessons": [
      {
        "name": "Tokenizers: BPE, WordPiece, SentencePiece",
        "status": "complete",
        "type": "Build",
        "lang": "Python, Rust",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/01-tokenizers/",
        "summary": "LLM は英語を読んでいるわけではありません。読んでいるのは整数です。その整数が意味を運ぶのか、無駄になるのかを決めるのがトークナイザーです。",
        "keywords": "失敗した3つの方法と、勝ち残った1つ · BPE: Byte Pair Encoding · バイトレベル BPE (GPT-2、GPT-3、GPT-4) · WordPiece (BERT) · SentencePiece (Llama、T5) · 語彙サイズのトレードオフ · 多言語税 · ステップ1: 文字レベルトークナイザー · ステップ2: BPE トークナイザーをゼロから作る · ステップ3: エンコードとデコードのラウンドトリップ · ステップ4: tiktoken と比較する · ステップ5: 語彙分析 · tiktoken (OpenAI) · Hugging Face tokenizers · Llama のトークナイザーを読み込む"
      },
      {
        "name": "Building a Tokenizer from Scratch",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/02-building-a-tokenizer/",
        "summary": "Lesson 01 で作ったのはおもちゃでした。このレッスンでは、実戦で使える道具にします。",
        "keywords": "全体のパイプライン · バイトレベル BPE · 事前トークン化 · 特殊トークン · チャットテンプレート · 速度 · Step 1: バイトレベルエンコーディング · Step 2: 正規表現による事前トークナイザー · Step 3: バイト列上の BPE · Step 4: 特殊トークンの処理 · Step 5: 完全なトークナイザークラス · Step 6: 多言語テスト · 実際のトークナイザーを比較する"
      },
      {
        "name": "Data Pipelines for Pre-Training",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/03-data-pipelines/",
        "summary": "モデルは鏡です。与えたデータをそのまま映します。ゴミを与えれば、完璧に流暢なゴミを映します。",
        "keywords": "データはどこから来るのか · データクリーニング · MinHash による重複排除 · シーケンスパッキング · Chinchilla スケーリング則 · ステップ1: テキストクリーニング · ステップ2: MinHash 重複排除 · ステップ3: トークン化してシーケンスへ詰める · ステップ4: 訓練用 DataLoader · ステップ5: データセット統計 · HuggingFace Datasets と比較する"
      },
      {
        "name": "Pre-Training a Mini GPT (124M)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/04-pre-training-mini-gpt/",
        "summary": "GPT-2 Small は 1 億 2400 万パラメータのモデルです。12 個の transformer レイヤー、12 個の attention head、768 次元の埋め込みを持ちます。単一 GPU でも数時間でゼロから訓練できます。ほとんどの人はこれをやりません。事前訓練済みチェックポイントを使います。しかし、自分で訓練したことがなければ、自…",
        "keywords": "GPT アーキテクチャ · Transformer Block · Attention: 中核メカニズム · KV Cache: 推論が速い理由 · Prefill vs Decode: 推論の 2 フェーズ · 訓練ループ · GPT-2 Small: 数字で見る · Step 1: Embedding Layer · Step 2: causal mask 付き self-attention · Step 3: Multi-Head Attention · Step 4: Transformer Block · Step 5: 完全な GPT モデル · Step 6: 訓練ループ · Step 7: テキスト生成 · 完全な訓練と生成のデモ"
      },
      {
        "name": "Distributed Training, FSDP, DeepSpeed",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/05-scaling-distributed/",
        "summary": "124Mモデルは1枚のGPUで学習できました。では70億パラメータに挑戦してみましょう。モデルはメモリに収まりません。データは1台のマシンでは数週間かかります。大規模では分散学習は任意ではありません。前に進むための唯一の道です。",
        "keywords": "なぜ分散が必要なのか · データ並列 · テンソル並列 · パイプライン並列 · FSDP: 完全シャーディングデータ並列 · DeepSpeed ZeRO · 混合精度学習 · Megatron-LMと3D並列 · ステップ1: データ並列をシミュレートする · ステップ2: テンソル並列をシミュレートする · ステップ3: パイプライン並列をシミュレートする · ステップ4: メモリ計算機 · ステップ5: 混合精度のシミュレーション · すべてのシミュレーションを実行する"
      },
      {
        "name": "Instruction Tuning — SFT",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/06-instruction-tuning-sft/",
        "summary": "ベースモデルは次のトークンを予測します。それだけです。指示に従ったり、質問に答えたり、有害な要求を拒否したりはしません。SFTは、トークン予測器と有用なアシスタントの橋渡しです。あなたが会話したことのあるモデル、Claude、GPT、Llama Chatは、すべてこのステップを通っています。",
        "keywords": "SFTが実際に行うこと · データ形式 · なぜうまくいくのか · マスク付き損失 · 学習ハイパーパラメータ · 破滅的忘却 · 実際の数値 · ステップ1: 指示データセット · ステップ2: チャットテンプレートでトークン化する · ステップ3: マスク付きクロスエントロピー損失 · ステップ4: SFT学習ループ · ステップ5: ベースモデルとSFTモデルを比較する · ステップ6: 破滅的忘却を測る · 完全なSFTパイプラインのデモ"
      },
      {
        "name": "RLHF — Reward Model + PPO",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/07-rlhf/",
        "summary": "SFTはモデルに指示へ従うことを教えます。しかし、どの応答が「より良い」かまでは教えません。文法的に正しく、事実として正確な2つの回答でも、有用性は大きく異なることがあります。RLHFは、人間の判断をモデルの振る舞いへ埋め込む方法です。Claudeを有用にし、GPTを丁寧にしている仕組みです。",
        "keywords": "3つの段階 · 報酬モデル · PPO: Proximal Policy Optimization · PPO目的の詳細 · 報酬ハッキング · 実際のRLHFパイプライン · Step 1: 合成選好データ · Step 2: 報酬モデルアーキテクチャ · Step 3: Bradley-Terry損失 · Step 4: 簡略化したPPOループ · Step 5: 報酬スコア比較 · RLHFパイプライン全体のデモ"
      },
      {
        "name": "DPO — Direct Preference Optimization",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/08-dpo/",
        "summary": "RLHFは機能します。ただし、3つのモデル（SFT、報酬モデル、方策）の訓練、PPOの不安定性の管理、KLペナルティの調整が必要です。DPOは問いかけます。もしそれらをすべて省略できたらどうでしょうか。DPOは選好ペア上で言語モデルを直接最適化します。報酬モデルなし。PPOなし。1つの訓練ループ。同じ結果。",
        "keywords": "重要な洞察 · DPO損失 · DPOがより単純な理由 · DPOがRLHFを上回る場面 · RLHFがDPOを上回る場面 · DPOの先へ: KTO、ORPO、SimPO · 実際のDPO導入例 · Step 1: 選好データセット · Step 2: シーケンス対数確率 · Step 3: DPO損失 · Step 4: DPO訓練ループ · Step 5: DPOとRLHFの比較 · Step 6: Beta感度分析 · DPOパイプライン全体のデモ"
      },
      {
        "name": "Constitutional AI & Self-Improvement",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/",
        "summary": "RLHF には人間がループに入る必要がある。Constitutional AI は、その大部分をモデル自身に置き換える。原則のリストを書き、モデルにその原則に照らして自分の出力を批評させ、その批評で学習する。DeepSeek-R1 は 2025 年にこれをさらに進めた。モデルに何百万もの推論トレースを生成させ、ルールで採点し、その結果に対して GRPO…",
        "keywords": "Constitutional AI ループ · Constitution が実際にしていること · GRPO: Group-Relative Policy Optimization · GRPO が推論で重要な理由 · Process Reward Models と Outcome Reward Models · 自己改善: Feedback Multiplier · 何をいつ使うか · Step 1: Constitution · Step 2: Self-Critique and Revise · Step 3: Rule-Based Rewards · Step 4: Group-Relative Advantage · Step 5: GRPO Update · Step 6: Self-Improvement Round"
      },
      {
        "name": "Evaluation — Benchmarks, Evals",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/10-evaluation/",
        "summary": "Goodhart's Law: ある指標が目標になると、それはよい指標ではなくなる。すべての frontier lab は benchmarks を攻略する。MMLU scores は上がる一方で、モデルはいまだに \"strawberry\" に含まれる R の数を安定して数えられない。重要なのは YOUR eval だけだ。YOUR task、YOUR…",
        "keywords": "Eval の地図 · Benchmarks が壊れる理由 · Perplexity: 簡単な Health Check · LLM-as-Judge · Pairwise Comparisons からの ELO Ratings · Eval Frameworks · Custom Evals を作る · Step 1: 最小 Eval Framework · Step 2: Scoring Functions · Step 3: ELO Rating System · Step 4: Perplexity Calculation · Step 5: Aggregate Results · Step 6: Full Pipeline を実行する · Step 7: ELO Tournament · Step 8: Perplexity Comparison · lm-evaluation-harness (EleutherAI) · promptfoo · RAGAS for RAG evaluation"
      },
      {
        "name": "Quantization: INT8, GPTQ, AWQ, GGUF",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/11-quantization/",
        "summary": "FP16 の 70B モデルには 140GB が必要です。重みだけで A100 が 2枚必要になります。FP8 に量子化すれば 80GB GPU 1枚。INT4 なら MacBook でも動かせます。",
        "keywords": "数値形式: 各 bit の役割 · 量子化の仕組み · 感度の階層 · PTQ vs QAT · GPTQ, AWQ, GGUF · 品質測定 · 実際の数字 · Step 1: 数値形式の表現 · Step 2: 対称量子化 (テンソル単位とチャネル単位) · Step 3: 品質測定 · Step 4: Bit-Width Sweep (bit 幅の掃引) · Step 5: 感度実験 · Step 6: GPTQ のシミュレーション · Step 7: AWQ のシミュレーション · Step 8: フルパイプライン · AutoGPTQ で量子化する · AutoAWQ で量子化する · GGUF に変換する · vLLM で配信する"
      },
      {
        "name": "Inference Optimization",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/12-inference-optimization/",
        "summary": "LLM 推論は 2つの phase で決まります。Prefill は prompt を並列に処理し、compute-bound です。Decode は token を 1つずつ生成し、memory-bound です。すべての最適化は、このどちらか、または両方を対象にします。",
        "keywords": "Prefill vs Decode · KV Cache · Continuous Batching · PagedAttention · Speculative Decoding · Prefix Caching · Inference Engines · Ops:Byte Framework · Step 1: KV Cache をゼロから作る · Step 2: KV Cache を使う Attention · Step 3: Continuous Batching Simulator (シミュレータ) · Step 4: Prefix Cache · Step 5: Speculative Decoding Simulator (シミュレータ) · Step 6: KV Cache Memory Profiler"
      },
      {
        "name": "Building a Complete LLM Pipeline",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/13-building-complete-llm-pipeline/",
        "summary": "Lessons 01 から 12 までの内容は、1つの pipeline の各 stage です。このレッスンは、それらの stage を単一の end-to-end run にまとめるための scaffold です。tokenize、pre-train、scale、SFT、align、evaluate、quantize、serve までをつなぎます。…",
        "keywords": "12個の stage · Manifest · Artifact Typing · Eval Gate · Orchestrator · Experiment Tracking と Artifact Storage · Costing · Reproducibility vs Determinism · Rollback Plan · 2026年に観測される Production Recipes"
      },
      {
        "name": "Open Models: Architecture Walkthroughs",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/",
        "summary": "Lesson 04 で GPT-2 Small を scratch から構築しました。2026年の frontier open models は、同じ family に 5つか 6つの具体的な変更を加えたものです。LayerNorm ではなく RMSNorm。GELU ではなく SwiGLU。learned positions ではなく RoPE。fu…",
        "keywords": "変わらない core · 実際に動く 6つの knobs · Knob 1: RMSNorm · Knob 2: RoPE · Knob 3: SwiGLU · Knob 4: Attention Head Sharing · Knob 5: Mixture of Experts · Knob 6: Pre-norm は残る · Model-by-Model Diff · config.json を読む · Activation memory budget · KV Cache budget · 各 model が勝つ場面"
      },
      {
        "name": "Speculative Decoding and EAGLE-3",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/15-speculative-decoding-eagle3/",
        "summary": "Phase 7 · Lesson 16 では数学を証明した。Leviathan の棄却規則は、検証器の分布を厳密に保つ。このレッスンでは、2026 年の本番環境における投機的デコーディングを、トレーニングスタックの視点から見る。EAGLE-3 はドラフトモデルを、安価な近似ではなく、検証器自身の隠れ状態で訓練された専用の小型ネットワークへ変えた。さらに…",
        "keywords": "不変条件: Leviathan rejection sampling · 速度を決めるもの · 2 年間の進展 · KV cache rollback · 2026 年の draft architecture · Step 1: 棄却規則 · Step 2: residual distribution · Step 3: 完全な speculative step · Step 4: KV rollback bookkeeping · Step 5: Leviathan check · Step 6: speedup vs. α"
      },
      {
        "name": "Differential Attention (V2)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/16-differential-attention-v2/",
        "summary": "Softmax attention は、一致しない token すべてに少量の確率を広げる。100k tokens では、そのノイズが積み上がって信号を覆い隠す。Differential Transformer (Ye et al., ICLR 2025) は、2 つの softmax の差として attention を計算し、共有された noise …",
        "keywords": "softmax の noise floor · differential idea · headed noise-canceling と合う理由 · V1 vs V2: 差分 · いつ使うべきか · 2026 年の他の knob との組み合わせ · Step 1: standard softmax attention · Step 2: Q, K を 2 つの半分に分ける · Step 3: 2 つの softmax branches + subtraction · Step 4: noise cancellation measurement · Step 5: V1 vs V2 parameter accounting"
      },
      {
        "name": "Native Sparse Attention (DeepSeek NSA)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/17-native-sparse-attention/",
        "summary": "64k tokens では、attention が decode latency の 70-80% を食う。どの open-model lab もこれを直す計画を持っている。DeepSeek の NSA (ACL 2025 best paper) は、その中で定着した方式だ。3 つの parallel attention branches、つまり co…",
        "keywords": "3 つの parallel branches · これが「natively trainable」である理由 · Hardware-aligned kernel · compute budget · 比較 · Step 1: tokens を blocks に圧縮する · Step 2: compressed-branch attention · Step 3: top-k block selection · Step 4: sliding-window attention · Step 5: gate + combine · Step 6: compute counting"
      },
      {
        "name": "Multi-Token Prediction (MTP)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/18-multi-token-prediction/",
        "summary": "GPT-2 から Llama 3 まで、すべての autoregressive LLM は position ごとに 1 つの loss で訓練される。next token を予測する loss である。DeepSeek-V3 は position ごとに 2 つ目の loss を追加した。その次の token を予測するのだ。追加された 14B pa…",
        "keywords": "sequential MTP recipe · parallel ではなく sequential である理由 · Parameter accounting · speculative-decoding の payoff · EAGLE との関係 · Step 1: shared embedding table · Step 2: per-depth combination · Step 3: depth k の transformer block · Step 4: shared output head · Step 5: per-depth loss · Step 6: parameter accounting"
      },
      {
        "name": "DualPipe Parallelism",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/19-dualpipe-parallelism/",
        "summary": "DeepSeek-V3 は、MoE experts を node 全体に散らした状態で 2,048 基の H800 GPU 上で訓練された。cross-node expert all-to-all communication は、compute 1 GPU-hour ごとに comm 1 GPU-hour を要する規模だった。GPU は半分の時間 id…",
        "keywords": "Pipeline parallelism の復習 · Idea 1: chunk decomposition · Idea 2: bidirectional scheduling · 手で追う schedule · Bubble accounting · DualPipeV — refinement · 14.8T-token run にとっての意味 · stack 内での位置づけ"
      },
      {
        "name": "DeepSeek-V3 Architecture Walkthrough",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/",
        "summary": "Phase 10 · Lesson 14 では、すべての open model が調整する 6 つの architectural knobs を挙げた。DeepSeek-V3 (December 2024、671B parameters total、37B active) はその 6 つをすべて調整し、さらに 4 つを追加する。Multi-Head L…",
        "keywords": "変わらない core · twist: GQA ではなく MLA · routing: auxiliary-loss-free load balancing · MTP: denser training + free draft · training: DualPipe · config を field ごとに読む · Parameter accounting · 671B / 37B ratio · DeepSeek-V3 の位置づけ · follow-on: R1, V4"
      },
      {
        "name": "Jamba — Hybrid SSM-Transformer",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/",
        "summary": "State space models (SSMs) と Transformers は、得意にしたいものが違います。Transformers は attention によって品質を稼ぎますが、計算コストは二乗で増えます。SSMs は recurrence によって線形時間の推論と定数メモリを得ますが、品質では遅れがちです。AI21 の Jamba (Ma…",
        "keywords": "An SSM in one page · The Jamba block · Why the 1:7 ratio · Positional encoding · The memory budget · Mamba-3: the pure-SSM baseline in 2026 · When to reach for a hybrid · The competitive landscape"
      },
      {
        "name": "Async and Hogwild! Inference",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/22-async-hogwild-inference/",
        "summary": "Speculative decoding (Phase 10 · 15) は、1 つの sequence 内の tokens を並列化します。Multi-agent frameworks は sequence 全体をまたいで並列化しますが、voting や sub-task splitting などの明示的な coordination を強制します。H…",
        "keywords": "The setup · Why coordination emerges · The naming · RoPE makes this tractable · Wall-time math · Concrete example · When to reach for Hogwild! · When not to · The experimental status · Step 1: the shared cache · Step 2: the worker loop · Step 3: the coordination heuristic · Step 4: measured speedup · Step 5: stress the coordination"
      },
      {
        "name": "投機的デコードとEAGLE",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/25-speculative-decoding/",
        "summary": "最先端の LLM が 1 トークンを生成するには、数十億個のパラメータ全体に対する完全な forward pass が必要です。この forward pass は大幅に過剰です。多くの場合、はるかに小さなモデルが次の 3-5 トークンを正しく推測でき、大きなモデルはその推測を *verify* するだけで済みます。推測が正しければ、1 回分のコストで …",
        "keywords": "2 モデル構成 · 厳密性のルール · 期待される高速化 · Draft の学習: Distillation · EAGLE: Tree Drafting + Feature Reuse · Tree Attention Verification · 勝つ場合、勝てない場合"
      },
      {
        "name": "Gradient CheckpointingとActivation再計算",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/10-llms-from-scratch/34-gradient-checkpointing/",
        "summary": "Backprop はすべての intermediate activation を保持します。70B parameters かつ 128K context では、rank あたり 3 TB の activations になります。Checkpointing は FLOPs と memory を交換します。保存する代わりに recompute するのです。…",
        "keywords": "Backward が実際に必要とするもの · 素朴な Full Checkpointing · Selective Checkpointing (Korthikanti 2022) · Offload · Recompute Cost Model · Memory Savings Model · Checkpoint しない方がよい場合 · 実装パターン · TP / PP / FP8 との相互作用 · Step 1: A Toy Model With Segments · Step 2: Naive Backward Needing All Activations · Step 3: Checkpoint-Every-k Memory · Step 4: Cost Model · Step 5: Memory Estimator · Step 6: Optimal Segment Size · Step 7: Selective Checkpoint Decision"
      }
    ]
  },
  {
    "id": 11,
    "name": "LLM エンジニアリング",
    "status": "complete",
    "desc": "LLM を production で働かせます。",
    "lessons": [
      {
        "name": "Prompt Engineering: Techniques & Patterns",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/01-prompt-engineering/",
        "summary": "多くの人は友人にメッセージを送るようにプロンプトを書きます。そして 2000 億パラメータのモデルが平凡な答えを返す理由を不思議がります。プロンプトエンジニアリングは小技ではありません。送るすべてのトークンが指示であり、モデルはその指示を文字どおりにたどる、という事実を理解することです。よりよい指示を書けば、よりよい出力が得られます。単純ですが難しいこ…",
        "keywords": "Anatomy of a Prompt · Role Prompting: なぜ \"You are an expert X\" が効くのか · Instruction Clarity: 曖昧より具体 · Output Format Control · Constraint Specification · Temperature and Sampling · Context Windows: 何がどこに収まるか · Prompt Patterns · Anti-Patterns · Cross-Model Prompt Design · Step 1: Prompt Template Library · Step 2: Prompt Builder · Step 3: Multi-Model Testing Harness · Step 4: Evaluation Metrics · Step 5: Prompt Optimization Loop"
      },
      {
        "name": "Few-Shot, CoT, Tree-of-Thought",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/02-few-shot-cot/",
        "summary": "モデルに何をするか伝えるのが prompting です。どう考えるかを見せるのが engineering です。同じモデル、同じタスク、同じデータで精度が 78% から 91% に上がる差は、より良いモデルではありません。より良い reasoning strategy です。",
        "keywords": "Zero-Shot vs Few-Shot: 例が指示に勝つとき · Example Selection: ランダムより類似 · Chain-of-Thought: モデルに scratch paper を与える · Self-Consistency: 多くサンプルして 1 回投票する · Tree-of-Thought: 分岐探索 · ReAct: 考える + 実行する · Structured Prompting: XML Tags, Delimiters, Headers · Prompt Chaining: 逐次分解 · Step 1: Few-Shot Example Store · Step 2: Chain-of-Thought Prompt Builder · Step 3: Self-Consistency Voting · Step 4: Tree-of-Thought Solver · Step 5: Full Pipeline"
      },
      {
        "name": "Structured Outputs",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/03-structured-outputs/",
        "summary": "LLM は文字列を返します。アプリケーションが必要とするのは JSON です。この差は、モデルの hallucination より多くの本番システムを壊してきました。Structured output は自然言語と型付きデータの橋です。正しく扱えば LLM は信頼できる API になります。間違えれば午前 3 時に free-text を regex …",
        "keywords": "The Structured Output Spectrum · JSON Schema: 契約言語 · The Pydantic Pattern · Function Calling / Tool Use · Common Failure Modes · Step 1: JSON Schema Validator · Step 2: Pydantic-Style Model to Schema · Step 3: Constrained Token Filter · Step 4: Extraction Pipeline · Step 5: Run the Full Pipeline · OpenAI Structured Outputs · Anthropic Tool Use · Instructor Library"
      },
      {
        "name": "Embeddings & Vector Representations",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/04-embeddings/",
        "summary": "Text は離散的です。Math は連続的です。LLM に「似た」documents を見つけさせたり、意味を比較させたり、keyword を超えて検索させたりするたびに、この 2 つの世界をつなぐ橋に頼っています。その橋が embedding です。embeddings を理解していなければ、modern AI を理解しているとは言えません。使ってい…",
        "keywords": "What Is an Embedding? · The Word2Vec Breakthrough · From Words to Sentences · Modern Embedding Models · Similarity Metrics · Vector Databases and HNSW · Chunking Strategies · Bi-Encoders vs Cross-Encoders · Matryoshka Embeddings · Binary Quantization · Step 1: Text Chunking · Step 2: Building Embeddings from Scratch · Step 3: Similarity Functions · Step 4: Vector Index with Brute-Force Search · Step 5: The Semantic Search Engine · Step 6: Comparing Similarity Metrics"
      },
      {
        "name": "Context Engineering",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/05-context-engineering/",
        "summary": "Prompt engineeringは一部にすぎません。Context engineeringは全体です。promptは入力する文字列ですが、contextはsystem instructions、retrieved documents、tool definitions、conversation history、few-shot examples、pr…",
        "keywords": "The Context Window is a Scarce Resource · Lost-in-the-Middle · Context Components · Context Compression Strategies · Memory Systems · Dynamic Context Assembly · Claude Code's Context Strategy · Cursor's Dynamic Context Loading · ChatGPT Memory · RAG as Context Engineering"
      },
      {
        "name": "RAG: Retrieval-Augmented Generation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/06-rag/",
        "summary": "LLMはtraining cutoffまでの一般知識は持っていますが、あなたの会社のdocs、codebase、先週のmeeting notesは知りません。RAGは関連documentsを取得してpromptへ詰めることでこの問題を解きます。production AIで最も広く使われるpatternです。このcourseで1つだけ作るなら、RAG p…",
        "keywords": "The RAG Pattern · Why RAG Beats Fine-Tuning · Embedding Models · Vector Similarity · Chunking Strategies · Vector Databases · The Full Pipeline · Real Numbers"
      },
      {
        "name": "Advanced RAG: Chunking, Reranking",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/07-advanced-rag/",
        "summary": "Basic RAGはtop-kの最も似たchunksを取得します。単純な質問では動きますが、multi-hop reasoning、ambiguous queries、大規模corporaでは崩れます。Advanced RAGは、10 documentsで動くdemoと10 million documentsで動くsystemの差です。",
        "keywords": "Hybrid Search: Semantic + Keyword · Reciprocal Rank Fusion (RRF) · Reranking · Query Transformation · Parent-Child Chunking · Metadata Filtering · Evaluation"
      },
      {
        "name": "Fine-Tuning with LoRA & QLoRA",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/08-fine-tuning-lora/",
        "summary": "7B modelをfull fine-tuningするには56GBのVRAMが必要です。多くの個人や企業にはありません。LoRAはparametersの1%未満だけをtrainingすることで、同じmodelを6GBでfine-tuneできます。これは妥協ではありません。多くのtasksでfull fine-tuning品質に並びます。open-sou…",
        "keywords": "LoRA: Low-Rank Adaptation · The Scaling Factor: Alpha · Where to Apply LoRA · Rank Selection · QLoRA: 4-Bit Quantization + LoRA · The Quality Question · Real-World Costs · The 2026 PEFT stack · Merging Adapters · When NOT to Fine-Tune"
      },
      {
        "name": "Function Calling & Tool Use",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/09-function-calling/",
        "summary": "LLM 自体は何も実行できません。できるのは text を生成することだけです。天気を確認したり、database に query したり、email を送ったり、code を実行したり、file を読むことはできません。あなたが見てきた「AI agent」の実体は、どの function を呼ぶべきかを示す JSON を LLM が生成し、その後で実…",
        "keywords": "Function Calling Loop · Tool Definitions: JSON Schema Contract · Provider 比較 · Tool Choice: Auto、Required、Specific · Parallel Function Calling · Structured Outputs と Function Calling · Security: 妥協できない rules · Error Handling · MCP: Model Context Protocol · Step 1: Tool Registry を定義する · Step 2: 5 つの Tools を実装する · Step 3: すべての Tools を登録する · Step 4: Function Calling Loop を構築する · Step 5: Argument Validation · Step 6: Demo を実行する · OpenAI Function Calling · Anthropic Tool Use · MCP Integration"
      },
      {
        "name": "Evaluation & Testing",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/10-evaluation/",
        "summary": "tests なしで web app を deploy することはないはずです。rollback plan なしで database migration を ship することもないはずです。しかし今、多くの teams は LLM applications を 10 outputs ほど読んで「良さそう」と言って ship しています。それは eval…",
        "keywords": "Eval Taxonomy · LLM-as-Judge: 主力 · Rubric Design · Eval Pipeline · Eval Datasets: 基礎 · Sample Size と Confidence · Regression Testing · Evals の cost · Anti-Patterns · Real Tools · Step 1: Eval Data Structures を定義する · Step 2: LLM-as-Judge Scorer を構築する · Step 3: Automated Metrics を構築する · Step 4: Confidence Interval Calculator を構築する · Step 5: Eval Runner と Comparison Report を構築する · Step 6: Demo を実行する · promptfoo Integration · DeepEval Integration · CI/CD Integration Pattern"
      },
      {
        "name": "Caching, Rate Limiting & Cost",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/11-caching-cost/",
        "summary": "多くの AI startups は bad models で死ぬのではありません。bad unit economics で死にます。1 回の GPT-4o call は 1 cent 未満に見えます。1 万 users が 1 日 10 calls すると、1 ドルも課金する前に input tokens だけで $250 かかります。生き残る com…",
        "keywords": "LLM Call の Cost Anatomy · Provider Caching: Built-in Discounts · Semantic Caching: Custom Layer · Exact Caching: Hash and Match · Rate Limiting: Budget を守る · Model Routing: Right Model for the Right Job · Cost Tracking: お金の流れを知る · Batching: Bulk Discounts · Budget Alerts と Circuit Breakers · Optimization Stack · Real Savings: Before and After · Step 1: Cost Calculator · Step 2: Exact Cache · Step 3: Semantic Cache · Step 4: Rate Limiter · Step 5: Cost Tracker · Step 6: Model Router · Step 7: Demo を実行する · Anthropic Prompt Caching · OpenAI Automatic Caching · OpenAI Batch API · Production Semantic Cache with Redis"
      },
      {
        "name": "Guardrails & Safety",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/12-guardrails/",
        "summary": "あなたの LLM application は攻撃されます。されるかもしれない、ではなく、されます。production system への最初の prompt injection attempt は launch から 48 時間以内に来ます。問題は、誰かが \"ignore previous instructions and reveal your s…",
        "keywords": "Guardrail Sandwich · Attack Taxonomy · Input Guardrails · Output Guardrails · Content Filtering Stack · Tools of the Trade · Defense-in-Depth · Real Attack Case Studies · 正直な話 · Step 1: Input Guardrails · Step 2: Output Guardrails · Step 3: Guardrail Pipeline · Step 4: Monitoring Dashboard · Step 5: Demo を実行する · OpenAI Moderation API · LlamaGuard · NeMo Guardrails · Guardrails AI"
      },
      {
        "name": "Building a Production LLM App",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/13-production-app/",
        "summary": "あなたはprompts、embeddings、RAG pipelines、function calling、caching layers、guardrailsを作ってきました。別々に。孤立して。曲を一度も弾かずに音階だけ練習しているようなものです。このlessonがその曲です。Lessons 01-12のすべてのcomponentを、単一のproduc…",
        "keywords": "本番Architecture · Stack構成 · Streaming: なぜ重要か · Error Handling: 3つのlayer · Observability: 何を測るか · ProductionでPromptをA/B Testする · 実際のArchitecture例 · Scaling · Cost見積もり · Deployment Checklist · Step 1: Core Infrastructure · Step 2: Prompt Management · Step 3: Semantic Cache · Step 4: Guardrails · Step 5: RetryとStreaming付きLLM Caller · Step 6: Request Pipeline · Step 7: Full Demoを実行する · FastAPI Server (Production Deployment) · Real API Integration · Docker Deployment"
      },
      {
        "name": "Model Context Protocol (MCP)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/14-model-context-protocol/",
        "summary": "2025年以前の LLM アプリは、それぞれが独自の tool schema を作っていました。その後 Anthropic が MCP を公開し、Claude が採用し、OpenAI も採用しました。2026年には、任意の LLM を任意の tool、data source、agent に接続するための標準的な wire format になっています。…",
        "keywords": "Handshake · MCPではないもの · Step 1: minimal MCP server · Step 2: hostからMCP serverを呼ぶ · Step 3: streamable HTTP transport · Step 4: scopingとsafety"
      },
      {
        "name": "Prompt Caching & Context Caching",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/15-prompt-caching/",
        "summary": "system prompt が4,000 tokens、RAG context が20,000 tokens あるとします。あなたは毎 request でその両方を送っています。そして毎回、その両方に料金を払っています。Prompt caching は provider 側でその prefix を warm に保ち、reuse 時には通常料金の10%程…",
        "keywords": "The cache-friendly layout · The break-even calculation · Step 1: Anthropic prompt caching with explicit markers · Step 2: one-hour extended TTL · Step 3: OpenAI automatic caching · Step 4: Gemini explicit context caching · Step 5: measuring hit rate in production"
      },
      {
        "name": "LangGraph: State Machines for Agents",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/16-langgraph-state-machines/",
        "summary": "手書きの ReAct loop は `while True` です。LangGraph で書いた ReAct loop は、checkpoint でき、interrupt でき、branch でき、time-travel できる graph です。agent 自体は変わっていません。変わったのは、それを包む harness です。",
        "keywords": "4つのsuperpower · Reducerが要点 · 4 nodesのReAct graph · StateGraph vs Send (fanout) · Subgraphs · Step 1: stateとnodes · Step 2: thread付きで実行 · Step 3: human-in-the-loop interruptを追加 · Step 4: debugging用time-travel · Step 5: production用checkpointerへ差し替え"
      },
      {
        "name": "Agent Framework Tradeoffs",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/11-llm-engineering/17-agent-framework-tradeoffs/",
        "summary": "どのframeworkも同じdemo (research agentがreportを作る) を売り、同じbug (state schemaがorchestration layerと衝突する) を隠しています。problemの形にabstractionが合うframeworkを選びます。それ以外は、あなたが2回書くglueです。",
        "keywords": "\"Abstraction\" が実際に意味するもの · Stateの問題 · Branchingの問題 · Observabilityの問題 · Costとlatency · Interoperability"
      }
    ]
  },
  {
    "id": 12,
    "name": "マルチモーダル AI",
    "status": "complete",
    "desc": "見る、聞く、読む、推論する。ViT patch から computer-use agent まで、modalities をまたいで扱います。",
    "lessons": [
      {
        "name": "Vision Transformers and the Patch-Token Primitive",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/01-vision-transformer-patch-tokens/",
        "summary": "マルチモーダルの前に、画像は transformer が処理できる token 列へ変換される必要があります。2020 年の ViT 論文は、16x16 pixel patch、linear projection、position embedding でこの問題に答えました。5 年後の 2026 年の frontier model (Claude Op…",
        "keywords": "Patches as tokens · Positional embeddings · CLS token, pooled output, and register tokens · Pretraining: supervised, contrastive, masked, self-distilled · Scaling laws · Parameter count for a ViT · 2026 production config"
      },
      {
        "name": "CLIP and Contrastive Vision-Language Pretraining",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/02-clip-contrastive-pretraining/",
        "summary": "OpenAI の CLIP (2021) は、次の 5 年を支えるほど大きな 1 つの idea を示しました。noisy な web image-caption pair だけを使い、contrastive loss で image encoder と text encoder を同じ vector space に align する、という idea…",
        "keywords": "The dual encoder · InfoNCE loss · Temperature · Why sigmoid scales better (SigLIP) · Zero-shot classification · Linear probes and finetuning · SigLIP 2: NaFlex and dense features · ALIGN, BASIC, OpenCLIP, EVA-CLIP · The zero-shot ceiling"
      },
      {
        "name": "BLIP-2 Q-Former as Modality Bridge",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/03-blip2-qformer-bridge/",
        "summary": "CLIP は image と text を align しますが、caption を生成したり、質問に答えたり、会話を続けたりはできません。BLIP-2 (Salesforce, 2023) は、小さな trainable bridge でこれを解決しました。32 個の learnable query vector が frozen ViT の fea…",
        "keywords": "Learnable queries · Architecture · Two-stage training · Parameter economics · InstructBLIP and the instruction-aware Q-Former · MiniGPT-4 and the projector-only approach · Why LLaVA went simpler · Gated cross-attention: Flamingo, the ancestor · The 2026 descendants"
      },
      {
        "name": "Flamingo and Gated Cross-Attention",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/04-flamingo-gated-cross-attention/",
        "summary": "DeepMind の Flamingo (2022) は、誰よりも早く 2 つのことを示しました。1 つは、単一の model が image、video、text を任意に interleave した sequence を処理できること。もう 1 つは、VLM が in-context に学習できることです。3 つの example (image, …",
        "keywords": "The frozen LLM · Perceiver resampler · Gated cross-attention · Masked cross-attention for interleaved inputs · In-context few-shot learning · Training data · OpenFlamingo and Otter · The descendants · Comparison to BLIP-2"
      },
      {
        "name": "LLaVA and Visual Instruction Tuning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/05-llava-visual-instruction-tuning/",
        "summary": "LLaVA (2023年4月) は、地球上で最も多く模倣された multimodal architecture である。BLIP-2 の Q-Former を 2-layer MLP に置き換え、Flamingo の gated cross-attention を素朴な token 連結に置き換え、text-only caption から GPT-4 …",
        "keywords": "アーキテクチャ · Stage 1: projector alignment · Stage 2: visual instruction tuning · Community がこれをコピーした理由 · LLaVA-1.5 と LLaVA-NeXT · LLaVA-OneVision · Q-Former との比較 · Prompt format · Parameter economy"
      },
      {
        "name": "Any-Resolution Vision — Patch-n'-Pack and NaFlex",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/06-any-resolution-patch-n-pack/",
        "summary": "現実の画像は 224x224 の正方形ではない。receipt は 9:16、chart は 16:9、medical scan は 4096x4096 かもしれず、mobile screenshot は 9:19.5 である。2024年以前の VLM の答え、すなわちすべてを固定正方形に resize する方法は、OCR、document under…",
        "keywords": "NaViT と patch-n'-pack · AnyRes (LLaVA-NeXT) · M-RoPE (Qwen2-VL) · NaFlex (SigLIP 2) · Packing mask · Token budgets"
      },
      {
        "name": "Open-Weight VLM Recipes: What Actually Matters",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/07-open-weight-vlm-recipes/",
        "summary": "2024-2026年の open-weight VLM literature は ablation table の森である。Apple の MM1 は image encoder、connector、data mix の13通りの組み合わせを調べた。Allen AI の Molmo は、詳細な human captions が GPT-4V disti…",
        "keywords": "5軸の design space · Axis 1: encoder > connector · Axis 2: connector design はほぼ横並び · Axis 3: LLM size が ceiling を決める · Axis 4: data — 詳細な human captions は distillation に勝つ · Axis 5: resolution と schedule · Prismatic の controlled comparison · 2026年向け picker"
      },
      {
        "name": "LLaVA-OneVision: Single, Multi, Video",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/08-llava-onevision-single-multi-video/",
        "summary": "LLaVA-OneVision (Li et al., 2024年8月) 以前、open-VLM の世界には別々の lineage があった。single image 向けの LLaVA-1.5、Mantis や VILA のような multi-image models、Video-LLaVA や Video-LLaMA のような video mode…",
        "keywords": "OneVision token budget · 3-stage curriculum · なぜ curriculum が効くのか · Emergent cross-scenario skills · Visual-token pooling · LLaVA-OneVision-1.5 · Qwen2.5-VL との対比"
      },
      {
        "name": "Qwen-VL Family and Dynamic-FPS Video",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/",
        "summary": "Qwen-VLファミリー、つまりQwen-VL (2023)、Qwen2-VL (2024)、Qwen2.5-VL (2025)、Qwen3-VL (2025)は、2026年時点で最も影響力のあるopen vision-language modelの系譜です。各世代は、open ecosystem全体が12か月以内に追随した、明確なarchitectu…",
        "keywords": "Qwen-VL (2023年8月) · Qwen2-VL (2024年9月) — M-RoPEとnative resolution · Qwen2.5-VL (2025年2月) — dynamic FPS + absolute time · Qwen3-VL (2025年11月) · M-RoPEを数式で見る · Dynamic-FPS sampling logic · Structured agent output"
      },
      {
        "name": "InternVL3 Native Multimodal Pretraining",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/10-internvl3-native-multimodal/",
        "summary": "InternVL3以前のopen VLMは、ほぼ同じ3-step recipeに従っていました。trillions of text tokensでtrainingされたtext LLMを取り、vision encoderを後付けし、接続部分をfine-tuneする、という流れです。これは動きますがalignment debtがあります。text LLM…",
        "keywords": "Native multimodal pretraining · V2PE (variable visual position encoding) · Visual Resolution Router (ViR) · Decoupled Vision-Language deployment (DvD) · Single-stage vs multi-stage quality · InternVL3.5とInternVL-U · Native pretrainingのtrade-off"
      },
      {
        "name": "Chameleon Early-Fusion Token-Only",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/",
        "summary": "ここまで見てきたVLMは、imageとtextを分離して扱っていました。Visual tokensはvision encoderから出て、projectorを通り、LLM内でtextと出会います。vision vocabularyとtext vocabularyは重なりません。Chameleon（Meta, 2024年5月）は「重なったらどうなるか」を…",
        "keywords": "image tokenizerとしてのVQ-VAE · shared vocabulary · Mixed-modality generation · Training stability — QK-Norm、dropout、LayerNorm ordering · tokenizerのreconstruction ceiling · Chameleon vs BLIP-2 / LLaVA · FuyuとAnyGPT"
      },
      {
        "name": "Emu3 Next-Token Prediction for Generation",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/12-emu3-next-token-for-generation/",
        "summary": "BAAIのEmu3（Wang et al., 2024年9月）は、diffusion対autoregressiveの議論を終わらせるはずだった2024年の結果です。single Llama-style decoder-only transformerを、text + VQ image tokens + 3D VQ video tokensのunifie…",
        "keywords": "Emu3 tokenizer · Single-loss training · Classifier-free guidanceとtemperature · Three roles, one model · Benchmarks · Compute cost · なぜ重要か"
      },
      {
        "name": "Transfusion Autoregressive + Diffusion",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/",
        "summary": "Chameleon と Emu3 は discrete tokens に全てを賭けた。動くが、quantization bottleneck は目に見える。画像品質は continuous-space diffusion models より低いところで頭打ちになる。Transfusion (Meta, Zhou et al., 2024年8月) は逆に…",
        "keywords": "Two-loss architecture の構造 · Attention mask: causal text と bidirectional image · Transformer 内の diffusion loss · MMDiT: Stable Diffusion 3 の variant · Chameleon-style を上回る理由 · Downstream にあるもの"
      },
      {
        "name": "Show-o Discrete-Diffusion Unified",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/",
        "summary": "Transfusion は continuous と discrete representations を混ぜる。Show-o (Xie et al., 2024年8月) は逆方向へ進む。Text tokens は causal next-token prediction、image tokens は MaskGIT の流れを汲む masked dis…",
        "keywords": "Masked discrete diffusion (MaskGIT) · Show-o: 1つの transformer と hybrid mask · Parallel sampling · 1つの checkpoint に入る task · Masking schedule · Show-o2 · Show-o の位置づけ"
      },
      {
        "name": "Janus-Pro Decoupled Encoders",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/",
        "summary": "Unified multimodal models には避けられない緊張がある。Understanding は semantic features を欲しがる。SigLIP や DINOv2 の output vectors は concept-level information が豊かだ。Generation は reconstruction-fri…",
        "keywords": "Decoupled visual encoding の構造 · これが機能する理由 · Data scaling — Janus と Janus-Pro · JanusFlow — the rectified flow variant · Shared body の役割 · InternVL-U との比較 · 制約"
      },
      {
        "name": "MIO Any-to-Any Streaming",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/16-mio-any-to-any-streaming/",
        "summary": "GPT-4o は多くの open models が再現できない product を出荷した。声を聞き、video を見て、real time に話し返す agent だ。2024年末時点の open-ecosystem の答えが MIO (Wang et al., 2024年9月) だった。MIO は text、image、speech、music を…",
        "keywords": "4つの modalities のための4つの tokenizers · Streaming decode · Four-stage curriculum · Chain-of-visual-thought · Any-to-any の競合 · Latency budget · Any-to-any が難しいままである理由"
      },
      {
        "name": "Video-Language Temporal Grounding",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/17-video-language-temporal-grounding/",
        "summary": "video は写真の束ではありません。5秒の clip には因果順序、action verbs、event timing があり、image model だけでは表現できません。Video-LLaMA (Zhang et al., 2023年6月) は、audio-visual grounding を備えた最初期の open video-LLM を提供…",
        "keywords": "Video-LLaMA: Q-former per clip + audio branch · VideoChat and Video-LLaVA · Qwen2.5-VL and TMRoPE · Frame sampling 戦略 · Frame ごとの pooling · 4つの video benchmark · Grounding output formats · 2026年の best practice"
      },
      {
        "name": "Long-Video at Million-Token Context",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/18-long-video-million-token/",
        "summary": "24 FPS の1時間 4K video を patch 化して embedding すると、およそ 6000万 tokens になります。2時間の podcast episode の transcription は 30,000 tokens です。Blu-ray の feature film 全体は、aggressive pooling で圧縮して…",
        "keywords": "Path 1: Brute context (Gemini 1.5, Claude Opus) · Path 2: Ring attention (LWM, LongVILA) · Path 3: Token compression (Video-XL, LongVA) · Path 4: Agentic retrieval (VideoAgent) · Needle-in-a-haystack benchmarks · どの path を選ぶか · 2026年の production pattern"
      },
      {
        "name": "Audio-Language Models: Whisper to AF3",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/19-audio-language-whisper-to-af3/",
        "summary": "Whisper (Radford et al., 2022年12月) は speech recognition を一段落させました。680k hours の weakly-supervised multilingual speech、単純な encoder-decoder transformer、そして以後の ASR release が必ず引用する b…",
        "keywords": "Log-Mel spectrogram: the input feature · Whisper's encoder · BEATs and audio-specific encoders · Audio Q-former · arc — SALMONN, Qwen-Audio, AF3 · Cascaded vs end-to-end · 2026年の production recipe · MMAU — the audio reasoning benchmark"
      },
      {
        "name": "Omni Models: Thinker-Talker Streaming",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/20-omni-models-thinker-talker/",
        "summary": "GPT-4o の 2024年5月の product demo が disruptive だったのは、underlying model そのものより product shape のためでした。user が話し、model が camera の見ているものを見て、250ms 未満で話し返す voice interface です。open ecosystem…",
        "keywords": "Thinker and Talker · TMRoPE — time-aligned multimodal positions · Streaming speech synthesis · VAD and turn-taking · Qwen3-Omni (November 2025) · Production latency budget · Token-rate math"
      },
      {
        "name": "Embodied VLAs: RT-2, OpenVLA, π0, GR00T",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/",
        "summary": "modelがwebsite上のrecipeを読み、kitchen robotで実行した最初の例がRT-2（Google DeepMind, 2023年7月）でした。RT-2はactionsをtext tokensとしてdiscretizeし、web dataとrobot-action dataでVLMをco-fine-tuneし、web-scale v…",
        "keywords": "Action tokenization (RT-2) · OpenVLA — open 7B reference · FAST tokenizer — faster action decode · π0とflow-matching actions · GR00T N1 — humanoid向けdual-system · Open X-Embodiment · Co-fine-tuning vs robot-only · Safety and action limits"
      },
      {
        "name": "Document and Diagram Understanding",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/22-document-diagram-understanding/",
        "summary": "Documents は photos ではありません。PDF、scientific paper、invoice、handwritten form には、layout、tables、diagrams、footnotes、headers、semantic structure があり、plain image understanding だけでは捉えられません…",
        "keywords": "Era 1 — OCR pipeline（pre-2021） · TrOCR (2021) · Era 2 — OCR-free（2022-2023） · LayoutLMv3 (2022) · DocLLM (2023) · Era 3 — VLM-native（2024+） · Claude 4.7 / GPT-5 frontier · Math equations and LaTeX output · Handwriting · 2026 recipe"
      },
      {
        "name": "ColPali Vision-Native Document RAG",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/23-colpali-vision-native-rag/",
        "summary": "Traditional RAG は PDFs を text に parse し、chunks に分割し、chunks を embed し、vectors を保存する。各stepで signal が失われる。OCR は chart data を落とし、chunking は table rows を壊し、text embeddings は figures …",
        "keywords": "ColBERT (2020) · ColPali · ColQwen2 and ColSmol · VisRAG · M3DocRAG · ViDoRe — the benchmark · The end-to-end RAG pipeline · Storage math · When text-RAG still wins"
      },
      {
        "name": "Multimodal RAG and Cross-Modal Retrieval",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/24-multimodal-rag-cross-modal/",
        "summary": "Vision-native document RAGは一部にすぎません。production multimodal RAGはもっと広く、text、images、audio、videoを横断してretrieveします。trip planning（「natural lightのある静かなvegan brunchを探して」）、medical triage（「…",
        "keywords": "Cross-modal retrieval · Fusion strategies · Generation grounding · 2025年のsurveys · MuRAG — foundational paper · production trip-planner example · Agentic multimodal RAG · Evaluation"
      },
      {
        "name": "Multimodal Agents and Computer-Use (Capstone)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/12-multimodal-ai/25-multimodal-agents-computer-use/",
        "summary": "2026年の frontier product は、screenshots を読み、buttons を click し、web UI を navigate し、forms を埋め、workflow を end-to-end で完了する multimodal agent である。SeeClick と CogAgent (2024) は GUI-groun…",
        "keywords": "GUI grounding — primitive · Action schemas · Screenshot-only vs accessibility-tree · Long-horizon memory · Visual tool use · 2026 benchmarks · なぜまだ難しいのか · Capstone build-it"
      }
    ]
  },
  {
    "id": 13,
    "name": "ツールとプロトコル",
    "status": "complete",
    "desc": "AI と現実世界の間にある interface を扱います。",
    "lessons": [
      {
        "name": "The Tool Interface",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/01-the-tool-interface/",
        "summary": "language model は token を生成します。program は action を実行します。この 2 つの隔たりを埋めるのが tool interface です。model が action を要求し、host がそれを実行するための契約です。2026 年のあらゆる stack、つまり OpenAI / Anthropic / Gemi…",
        "keywords": "Step one: describe · Step two: decide · Step three: execute · Step four: observe · The trust split · Where the loop lives · Why not just prompt the model to emit JSON? · Circuit breakers · Where Phase 13 goes from here"
      },
      {
        "name": "Function Calling Deep Dive",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/02-function-calling-deep-dive/",
        "summary": "3 つの frontier provider は 2024 年に同じ tool-call loop へ収束し、その後それ以外のすべてで分岐しました。OpenAI は `tools` と `tool_calls` を使います。Anthropic は `tool_use` と `tool_result` block を使います。Gemini は `func…",
        "keywords": "The common structure · Shape diffs, field by field · Limits you will actually hit · `tool_choice` behavior · Parallel calls · Streaming · Errors and repair · The translator pattern"
      },
      {
        "name": "Parallel and Streaming Tool Calls",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/",
        "summary": "独立した 3 つの weather lookup を直列化すると 3 round trips になります。parallel に実行すれば、total time は最も遅い 1 call に縮みます。いまやすべての frontier provider が 1 turn で複数 tool calls を emit します。payoff は本物ですが、plu…",
        "keywords": "Enabling parallel · Id correlation · Running calls concurrently · Streaming tool calls · Partial JSON and the parse-early trap · Out-of-order completion · Benchmark: sequential vs parallel · Streaming fan-out wall-clock"
      },
      {
        "name": "Structured Output",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/04-structured-output/",
        "summary": "「JSON を返して」と丁寧に頼むだけでは、frontier model でも 5 から 15 パーセントの確率で失敗します。Structured outputs は constrained decoding でその差を埋めます。model は schema に違反する token を文字どおり出せなくなります。OpenAI の strict mode…",
        "keywords": "JSON Schema 2020-12 — 共通語 · Pydantic、Python binding · Zod、TypeScript binding · Refusals · open な constrained decoding · 3 つの failure modes · Retry strategy · Small-model support"
      },
      {
        "name": "Tool Schema Design",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/05-tool-schema-design/",
        "summary": "正しい tool でも、model がいつ使うべきか判断できなければ静かに失敗します。naming、descriptions、parameter shapes は、StableToolBench や MCPToolBench++ のような benchmark で tool-selection accuracy を 10 から 20 percentage…",
        "keywords": "Naming rules · Description pattern · Atomic vs monolithic · Parameter design · teaching signals としての error messages · Versioning · Tool poisoning prevention · Benchmarks"
      },
      {
        "name": "MCP Fundamentals",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/06-mcp-fundamentals/",
        "summary": "MCP 以前のすべての連携は一回限りの作り込みでした。Model Context Protocol は 2024 年 11 月に Anthropic から初めて公開され、現在は Linux Foundation の Agentic AI Foundation が管理しています。MCP は discovery と invocation を標準化し、どの …",
        "keywords": "3 つの server primitives · 3 つの client primitives · Wire format: JSON-RPC 2.0 · 3 phase lifecycle · Capability negotiation · Structured content and error shapes · Client capabilities vs tool call details · なぜ REST ではなく JSON-RPC なのか"
      },
      {
        "name": "Building an MCP Server",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/07-building-an-mcp-server/",
        "summary": "ほとんどの MCP tutorial は stdio の hello-world だけを見せます。実用的な server は tools、resources、prompts を公開し、capability negotiation を扱い、structured errors を emit し、SDK をまたいでも同じように動作します。この lesson …",
        "keywords": "Dispatch loop · Implementing `initialize` · Implementing `tools/list` and `tools/call` · Implementing resources · Implementing prompts · Stdio transport subtleties · Annotations · Graduation path"
      },
      {
        "name": "Building an MCP Client",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/08-building-an-mcp-client/",
        "summary": "MCP の content の多くは server tutorial を出荷し、client には軽く触れるだけです。難しい orchestration は client code にあります。process spawning、capability negotiation、複数 server にまたがる tool list merge、sampling…",
        "keywords": "Child-process spawning · Per-server session state · Merged namespace · Routing · Sampling callback · Notification handling · Reconnection · Keepalive and session id"
      },
      {
        "name": "MCP Transports",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/09-mcp-transports/",
        "summary": "stdio が機能するのはローカルだけです。Streamable HTTP (2025-03-26) はリモートの標準です。古い HTTP+SSE transport は deprecated で、2026 年半ばに削除されます。間違った transport を選ぶと移行が必要になり、正しいものを選べば、session continuity と DNS…",
        "keywords": "stdio · Streamable HTTP · Single endpoint vs two · `Origin` validation and DNS-rebinding · Session id lifecycle · Keepalive and reconnect · Backwards compatibility probe · Cloudflare, ngrok, and hosting · Gateway composition · Transport failure modes · When to bypass Streamable HTTP"
      },
      {
        "name": "MCP Resources and Prompts",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/10-mcp-resources-and-prompts/",
        "summary": "MCP では tool に注目が集まりがちです。しかし残り 2 つの server primitive は別の問題を解きます。Resource は read 用の data を expose し、prompt は reusable template を slash-command として expose します。多くの server は、read を t…",
        "keywords": "Tools vs resources vs prompts — the decision rule · Resources · Resource subscriptions · Resource templates (2025-11-25 addition) · Prompts · Hosts and prompts · The \"list changed\" notification · Content type conventions · Dynamic resources · Subscriptions vs polling · Prompts vs system prompts"
      },
      {
        "name": "MCP Sampling",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/11-mcp-sampling/",
        "summary": "ほとんどのMCP serverは単純な実行器です。引数を受け取り、コードを実行し、contentを返します。Samplingでは向きを反転できます。serverがclientのLLMに判断を依頼するのです。これにより、serverがmodel credentialを持たなくても、server-hosted agent loopを実現できます。2025-…",
        "keywords": "`sampling/createMessage` request · `modelPreferences` · `includeContext` · Tool付きSampling（SEP-1577） · Human-in-the-loop · API keyなしのserver-hosted loop · Safety risks（Unit 42 disclosure, 2026 Q1）"
      },
      {
        "name": "MCP Roots and Elicitation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/",
        "summary": "Hard-coded pathは、userが別のprojectを開いた瞬間に壊れます。pre-filled tool argumentは、userの指定が不足していると破綻します。Rootsはserverのscopeをuser-controlledなURI集合に限定します。Elicitationはtool callの途中でpauseし、formやURL…",
        "keywords": "Roots · なぜrootsはclient primitiveなのか · Elicitation: defaultのform mode · Elicitation: URL mode（SEP-1036, experimental） · Elicitationが適切な場合 · Elicitationが不適切な場合 · Human-in-the-loop bridge"
      },
      {
        "name": "MCP Async Tasks",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/13-mcp-async-tasks/",
        "summary": "実際の agent work には数分から数時間かかります。CI runs、deep-research synthesis、batch exports などです。synchronous tool call は connection を落とし、time out し、UI を block します。2025-11-25 に merge された SEP-168…",
        "keywords": "Task augmentation · Tool ごとの opt-in · States · Methods · State changes の streaming · Durable state · Cancellation semantics · Crash recovery · Async tasks plus sampling · なぜ experimental なのか"
      },
      {
        "name": "MCP Apps",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/14-mcp-apps/",
        "summary": "Text-onlyなtool outputでは、agentが見せられるものに限界がある。MCP Apps（SEP-1724、2026年1月26日公式）は、toolがsandboxed interactive HTMLを返し、それをClaude Desktop、ChatGPT、Cursor、Goose、VS Code内にinline renderできるよ…",
        "keywords": "The `ui://` resource scheme · Iframe sandbox · postMessage protocol · Permissions · Security risks · `ui/initialize` handshake · AppRenderer / AppFrame SDK primitives · Ecosystem status"
      },
      {
        "name": "MCP Security I — Tool Poisoning",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/",
        "summary": "Tool descriptionsはmodel contextへverbatimに入る。Malicious serversはusersが見ないhidden instructionsを埋め込む。Invariant Labs、Unit 42、2026年3月公開のarXiv studyによる2025-2026年のresearchでは、frontier mod…",
        "keywords": "Attack 1: tool poisoning · Attack 2: rug pulls · Attack 3: cross-server tool shadowing · Attack 4: MCP Preference Manipulation Attacks (MPMA) · Attack 5: parasitic toolchains · Attack 6: sampling attacks · Attack 7: supply-chain masquerading · The Rule of Two (Meta, 2026) · Defenses that work · Defenses that do not work alone"
      },
      {
        "name": "MCP Security II — OAuth 2.1",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/",
        "summary": "リモート MCP server に必要なのは authentication だけではありません。authorization も必要です。2025-11-25 spec は OAuth 2.1 + PKCE + resource indicators (RFC 8707) + protected-resource metadata (RFC 9728) …",
        "keywords": "Roles · Authorization code + PKCE · Protected-resource metadata (RFC 9728) · Resource indicators (RFC 8707) · Scope model · Step-up authorization (SEP-835) · Token audience validation · Short-lived tokens and rotation · No token passthrough · Confused deputy prevention · Client ID discovery · Gateways and OAuth"
      },
      {
        "name": "MCP Gateways and Registries",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/17-mcp-gateways-and-registries/",
        "summary": "Enterprise は、すべての dev が任意の MCP server をインストールできる状態にはできません。Gateway は auth、RBAC、audit、rate limiting、caching、tool-poisoning detection を集中管理し、merge された tool surface を単一の MCP endpoin…",
        "keywords": "5 つの gateway responsibility · Gateway as a single endpoint · Credential vaulting · Tool-hash pinning at the gateway · Policy-as-code · Session-aware routing · Namespace merging · Registries · Reverse-DNS naming · Vendor survey, April 2026"
      },
      {
        "name": "MCP Auth in Production — DCR + JWKS on iii",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/18-mcp-auth-production/",
        "summary": "Lesson 16 では OAuth 2.1 状態機械を memory 内で立ち上げました。2026 年には、実組織に出荷するすべての MCP server が production auth の背後に置かれます。Dynamic client registration (RFC 7591)、authorization-server metadata d…",
        "keywords": "RFC 8414 — OAuth Authorization Server Metadata · RFC 9728 (recap) — Protected Resource Metadata · RFC 7591 — Dynamic Client Registration · RFC 8707 (recap) — Resource Indicators · RFC 7636 (recap) — PKCE · MCP Spec 2025-11-25 Auth Profile · IdP capability matrix · iii を使った JWKS rotation pattern · iii primitive wiring (この lesson の本題) · Audience binding による confused-deputy walkthrough · Failure modes"
      },
      {
        "name": "A2A Protocol",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/19-a2a-protocol/",
        "summary": "MCPはagent-to-toolである。A2A（Agent2Agent）はagent-to-agentであり、異なるframework上に構築されたopaque agentsをcollaborateさせるopen protocolである。Googleが2025年4月にreleaseし、2025年6月にLinux Foundationへ寄贈され、202…",
        "keywords": "Agent Card · Signed Agent Cards (AP2) · Task lifecycle · Messages and Parts · Artifacts · Two transport bindings · Opacity preservation · Timeline · Relationship to MCP"
      },
      {
        "name": "OpenTelemetry GenAI",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/20-opentelemetry-genai/",
        "summary": "Agentが5つのtools、3つのMCP servers、2つのsub-agentsをcallする。全体を貫く1つのtraceが必要になる。OpenTelemetry GenAI semantic conventions（v1.37以降のstable attributes）は2026年のstandardであり、Datadog、Langfuse、Ari…",
        "keywords": "Span hierarchy · Required attributes · Span kinds · Opt-in content capture · Events on spans · Exporters · Propagation across MCP · Metrics · AgentOps layer"
      },
      {
        "name": "LLM Routing Layer",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/21-llm-routing-layer/",
        "summary": "Provider lock-inは高くつきます。tool-calling workloadごとに向いたmodelは異なります。Routing gatewaysは、1つのAPI surface、retries、failover、cost tracking、guardrailsを提供します。2026年に支配的な3 archetypesは、LiteLLM（o…",
        "keywords": "OpenAI-compatible proxy shape · Model aliases · Fallback chains · Semantic caching · Guardrails · Per-key rate limits · Self-hosted vs managed trade-offs · Cost tracking · MCP plus routing · Routing strategies"
      },
      {
        "name": "Skills and Agent SDKs",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/22-skills-and-agent-sdks/",
        "summary": "MCPは「どんなtoolsが存在するか」を語る。Skillsは「taskをどう実行するか」を語る。2026年のstackはその両方を重ねる。AnthropicのAgent Skills（open standard、2025年12月）は、progressive disclosureを備えたSKILL.mdとして配布される。OpenAIのApps SDKは…",
        "keywords": "AGENTS.md (agents.md) · SKILL.md format · Progressive disclosure · Filesystem discovery · Anthropic Claude Agent SDK · OpenAI Apps SDK · Cross-agent portability via SkillKit · The three-layer stack"
      },
      {
        "name": "Capstone — Tool Ecosystem",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/23-capstone-tool-ecosystem/",
        "summary": "Phase 13では部品をすべて学んだ。このcapstoneでは、それらを1つのproduction-shaped systemへ配線する。Tools + resources + prompts + tasks + UIを持つMCP server、edgeのOAuth 2.1、RBAC gateway、multi-server client、A2A s…",
        "keywords": "Architecture · Trace hierarchy · Security posture · Rendering · Packaging · What each Phase 13 lesson contributed"
      }
    ]
  },
  {
    "id": 14,
    "name": "エージェントエンジニアリング",
    "status": "complete",
    "desc": "第一原理から agent を作ります。loop、memory、planning、framework、benchmark、production、workbench を扱います。",
    "lessons": [
      {
        "name": "The Agent Loop",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/01-the-agent-loop/",
        "summary": "2026年のあらゆるエージェント、Claude Code、Cursor、Devin、Operatorは、2022年のReActループの変種である。停止条件が発火するまで、推論トークン、tool call、観測が交互に進む。どのフレームワークに触れる前にも、このループを徹底的に理解しておくこと。",
        "keywords": "ReAct: 標準形式 · 2026年の移行: ネイティブ推論 · 5つの材料 · なぜこのループはどこにでもあるのか · 2026年の落とし穴"
      },
      {
        "name": "ReWOO and Plan-and-Execute",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/02-rewoo-plan-and-execute/",
        "summary": "ReActはthoughtとactionを1つのstreamで交互に進める。ReWOOはそれを分離する。最初に大きなplanを作り、その後にexecuteする。tokenは5分の1、HotpotQAでaccuracyは+4%、plannerを7B modelへdistillできる。Plan-and-Executeはこれを一般化し、Plan-and-Ac…",
        "keywords": "3つの役割 · なぜtokenが5分の1になるのか · なぜよりrobustなのか · Planner distillation · Plan-and-Execute（LangChain、2023） · Plan-and-Act（Erdoganら、arXiv:2503.09572、ICML 2025） · どれを選ぶべきか"
      },
      {
        "name": "Reflexion and Verbal Reinforcement Learning",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/03-reflexion-verbal-rl/",
        "summary": "gradient-based RLでfailure modeを直すには、何千回ものtrialとGPU clusterが必要になる。Reflexion（Shinnら、NeurIPS 2023）はそれを自然言語で行う。失敗したtrialの後、agentはreflectionを書き、episodic memoryに保存し、次のtrialをそのmemoryに条…",
        "keywords": "3つの構成要素 · 3種類のevaluator · なぜ一般化するのか · いつ効き、いつ効かないか"
      },
      {
        "name": "Tree of Thoughts and LATS",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/04-tree-of-thoughts-lats/",
        "summary": "1本のchain-of-thought trajectoryにはbacktrackの余地がない。ToT（Yaoら、2023）はreasoningをtreeにし、各nodeでself-evaluationを行う。LATS（Zhouら、2024）は、ToT、ReAct、ReflexionをMonte Carlo Tree Searchの下で統合する。Gam…",
        "keywords": "Tree of Thoughts（Yaoら、NeurIPS 2023） · LATS（Zhouら、ICML 2024） · MCTSを最小限で · costの現実 · 2026年の位置づけ"
      },
      {
        "name": "Self-Refine and CRITIC",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/05-self-refine-and-critic/",
        "summary": "Self-Refine（Madaanら、2023）は1つのLLMをgenerate、feedback、refineの3 roleでloopさせる。平均gainは7 tasksで絶対値+20。CRITIC（Gouら、2023）は、verificationを外部toolsへroutingすることでfeedback stepを堅くする。2026年、このpat…",
        "keywords": "Self-Refine（Madaanら、NeurIPS 2023） · CRITIC（Gouら、arXiv:2305.11738、v4 2024年2月） · 停止条件 · Evaluator-Optimizer（Anthropic、2024） · OpenAI Agents SDK output guardrails · 2026年の落とし穴"
      },
      {
        "name": "Tool Use and Function Calling",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/06-tool-use-and-function-calling/",
        "summary": "Toolformer（Schickら、2023）はself-supervised tool annotationを始めた。Berkeley Function Calling Leaderboard V4（Patilら、2025）は2026年の基準を設定する。40% agentic、30% multi-turn、10% live、10% non-live…",
        "keywords": "Toolformer（Schickら、NeurIPS 2023） · Berkeley Function Calling Leaderboard V4（Patilら、ICML 2025） · Tool schema · Argument validation · Parallel tool calls · Sandboxing"
      },
      {
        "name": "Memory — Virtual Context and MemGPT",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/07-memory-virtual-context-memgpt/",
        "summary": "Context window は有限です。一方で会話、文書、tool trace は有限ではありません。MemGPT (Packer et al., 2023) はこれを OS の仮想記憶として捉えます。main context は RAM、external store は disk、agent はその間で page in/out します。これは 20…",
        "keywords": "MemGPT: OS analog · Two tiers · Interrupt pattern · MemGPT ends and Letta begins · Where this pattern goes wrong"
      },
      {
        "name": "Memory Blocks and Sleep-Time Compute",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/",
        "summary": "MemGPT は 2024 年に Letta になりました。2026 年の進化では 2 つの idea が追加されます。Model が直接編集できる discrete functional memory blocks と、primary agent が idle の間に非同期で memory を consolidate する sleep-time ag…",
        "keywords": "Three tiers · Memory blocks · Sleep-time compute · Letta V1 and native reasoning · Where this pattern goes wrong"
      },
      {
        "name": "Hybrid Memory — Mem0 Vector + Graph + KV",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/09-hybrid-memory-mem0/",
        "summary": "Mem0 (Chhikara et al., 2025) は memory を 3 つの store の並列構成として扱います。Semantic similarity 用の vector、高速 fact lookup 用の KV、entity-relationship reasoning 用の graph です。Retrieval では scoring…",
        "keywords": "Three stores in parallel · Fusion scoring · Mem0g and temporal reasoning · Benchmark numbers · Scope taxonomy · Where this pattern goes wrong"
      },
      {
        "name": "Skill Libraries and Lifelong Learning — Voyager",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/10-skill-libraries-voyager/",
        "summary": "Voyager (Wang et al., TMLR 2024) は executable code を skill として扱います。Skills は named、retrievable、composable で、environment feedback によって refine されます。これは Claude Agent SDK skills、skil…",
        "keywords": "Three components · Action space = code · Skill retrieval · Iterative refinement · Curriculum and exploration · Where this pattern goes wrong"
      },
      {
        "name": "Planning with HTN and Evolutionary Search",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/11-planning-htn-and-evolutionary/",
        "summary": "Symbolic planning は plan が provably correct であるべき case を扱います。Evolutionary code search は fitness function が machine-checkable な case を扱います。ChatHTN (2025) と AlphaEvolve (2025) は、L…",
        "keywords": "Hierarchical Task Networks · ChatHTN (Gopalakrishnan et al., 2025) · AlphaEvolve (Novikov et al., 2025) · When to use which · Where this pattern goes wrong"
      },
      {
        "name": "Anthropic's Workflow Patterns",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/12-anthropic-workflow-patterns/",
        "summary": "Schluntz and Zhang (Anthropic, Dec 2024) は workflows (predefined paths) と agents (dynamic tool-use) を区別しました。5 つの workflow patterns が大半の case を cover します。Direct API calls から始めます。…",
        "keywords": "Workflows vs agents · The augmented LLM · The five patterns · Where workflows beat agents · Where agents beat workflows · The context-engineering companion"
      },
      {
        "name": "LangGraph — Stateful Graphs and Durable Execution",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/13-langgraph-stateful-graphs/",
        "summary": "LangGraphは、2026年時点の低レベルなstateful orchestrationの基準です。Agentはstate machine、nodeは関数、edgeは遷移、stateはimmutableで各step後にcheckpointされます。どの失敗からでも、止まった場所から正確に再開できます。",
        "keywords": "The graph · Durable execution · Streaming · Human-in-the-loop · Memory · Three topologies · Where this pattern goes wrong"
      },
      {
        "name": "AutoGen v0.4 — Actor Model",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/14-autogen-actor-model/",
        "summary": "AutoGen v0.4 (Microsoft Research, 2025年1月) は、agent orchestrationをactor model中心に再設計しました。async message exchange、event-driven agents、fault isolation、自然なconcurrency。frameworkは現在main…",
        "keywords": "Actors · Three API layers in AutoGen v0.4 · Why decoupling matters · Topologies · Observability · Status: maintenance mode"
      },
      {
        "name": "CrewAI — Role-Based Crews and Flows",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/15-crewai-role-based-crews/",
        "summary": "CrewAIは、2026年のrole-based multi-agent frameworkです。4つのprimitive: Agent、Task、Crew、Process。top-level shapeは2つ: Crews (autonomousなrole-based collaboration) とFlows (event-drivenでdeter…",
        "keywords": "Four primitives · Sequential vs Hierarchical vs Consensus · Crews vs Flows · Tool integration · Memory hooks · When CrewAI fits · When CrewAI does not fit · Dependency shape · Where this pattern goes wrong"
      },
      {
        "name": "OpenAI Agents SDK — Handoffs, Guardrails, Tracing",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/16-openai-agents-sdk/",
        "summary": "OpenAI Agents SDKは、Responses API上に構築されたlightweight multi-agent frameworkです。5つのprimitive: Agent、Handoff、Guardrail、Session、Tracing。Handoffは`transfer_to_<agent>`という名前のtoolです。Guardr…",
        "keywords": "Five primitives · Handoffs as tools · Guardrails · Tracing · Sessions · Where this pattern goes wrong"
      },
      {
        "name": "Claude Agent SDK — Subagents and Session Store",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/17-claude-agent-sdk/",
        "summary": "Claude Agent SDKは、Claude Code harnessのlibrary版です。built-in tools、context isolation用のsubagents、hooks、W3C trace propagation、session store parityを備えます。Claude Managed Agentsは、long-ru…",
        "keywords": "Client SDK vs Agent SDK · Built-in tools · Subagents · Session store · Hooks · W3C trace context · Claude Managed Agents · Where this pattern goes wrong"
      },
      {
        "name": "Agno and Mastra — Production Runtimes",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/18-agno-and-mastra-runtimes/",
        "summary": "Agno (Python) とMastra (TypeScript) は、2026年のproduction-runtime pairingです。Agnoはmicrosecond agent instantiationとstateless FastAPI backendを狙います。MastraはVercel AI SDK基盤の上で、agents、tool…",
        "keywords": "Agno · Mastra · Positioning · When to pick each · Where this pattern goes wrong"
      },
      {
        "name": "Benchmarks — SWE-bench, GAIA, AgentBench",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/19-benchmarks-swebench-gaia/",
        "summary": "2026年のagent評価を支える代表的なbenchmarkは3つあります。SWE-benchはcode patchingを、GAIAはgeneralistなtool useを、AgentBenchは複数環境でのreasoningをテストします。それぞれの構成、contaminationの事情、そして測れていないものを理解しておきましょう。",
        "keywords": "SWE-bench (Jimenez et al., ICLR 2024 oral) · SWE-bench Verified · Contamination · GAIA (Mialon et al., Nov 2023) · AgentBench (Liu et al., ICLR 2024) · What these do not measure · Where benchmarking goes wrong"
      },
      {
        "name": "Benchmarks — WebArena and OSWorld",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/20-benchmarks-webarena-osworld/",
        "summary": "WebArenaは4つのself-hosted appにまたがるweb-agent capabilityをテストします。OSWorldはUbuntu、Windows、macOSにまたがるdesktop-agent capabilityをテストします。release時点 (2023–2024) では、どちらもbest-in-class agentと人間の…",
        "keywords": "WebArena (Zhou et al., ICLR 2024) · Extensions · OSWorld (Xie et al., NeurIPS 2024) · Primary failure modes · Follow-ups · Why this matters · Where benchmarking goes wrong"
      },
      {
        "name": "Computer Use — Claude, OpenAI CUA, Gemini",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/21-computer-use-agents/",
        "summary": "2026年のproduction computer-use modelは3つあります。3つともvision-basedです。3つともscreenshots、DOM text、tool outputsをuntrusted inputとして扱います。permissionとして数えられるのは、direct user instructionsだけです。per-…",
        "keywords": "Claude computer use (Anthropic, Oct 22 2024) · OpenAI CUA / Operator (Jan 2025) · Gemini 2.5 Computer Use (Google DeepMind, Oct 7 2025) · The shared contract: untrusted input · When to pick which · Where this pattern goes wrong"
      },
      {
        "name": "Voice Agents — Pipecat and LiveKit",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/22-voice-agents-pipecat-livekit/",
        "summary": "Voice agentは2026年のfirst-class production categoryです。PipecatはPythonのframe-based pipeline (VAD → STT → LLM → TTS → transport) を提供します。LiveKit AgentsはAI modelとuserをWebRTCでつなぎます。prem…",
        "keywords": "Pipecat (pipecat-ai/pipecat) · LiveKit Agents (livekit/agents) · Commercial platforms · Where this pattern goes wrong · Typical 2026 latencies"
      },
      {
        "name": "OpenTelemetry GenAI Semantic Conventions",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/23-otel-genai-conventions/",
        "summary": "OpenTelemetryのGenAI SIG (2024年4月launch) は、agent telemetryのstandard schemaを定義します。span name、attributes、content-capture rulesがvendor間で収束するため、Datadog、Grafana、Jaeger、Honeycombでagent …",
        "keywords": "Span categories · Agent span naming · Key attributes · Content capture · Stability · Where this pattern goes wrong"
      },
      {
        "name": "Agent Observability — Langfuse, Phoenix, Opik",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/24-agent-observability-platforms/",
        "summary": "2026年は3つのopen-source agent observability platformが中心です。Langfuse (MIT) — 月間6M+ installs、tracing + prompt management + evals + session replay。Arize Phoenix (Elastic 2.0) — deep ag…",
        "keywords": "Langfuse (MIT) · Arize Phoenix (Elastic License 2.0) · Comet Opik (Apache 2.0) · Industry data · Picking one · Where this pattern goes wrong"
      },
      {
        "name": "Multi-Agent Debate and Collaboration",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/25-multi-agent-debate/",
        "summary": "Du et al. (ICML 2024, \"Society of Minds\") は、N 個のモデルインスタンスに独立して回答案を出させ、その後 R ラウンドにわたって互いに批評させ、収束させる。事実性、ルール遵守、推論を改善する。スパーストポロジーは、トークンコストの面でフルメッシュより有利。",
        "keywords": "Society of Minds (Du et al., ICML 2024) · スパーストポロジー · 討論が効く場合 · 討論が悪化させる場合 · 2026 年時点の実用的な具体化 · このパターンが失敗するところ"
      },
      {
        "name": "Failure Modes — Why Agents Break",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/26-failure-modes-agentic/",
        "summary": "MASFT (Berkeley, 2025) は multi-agent failure modes を 3 カテゴリ 14 種に整理する。Microsoft の Taxonomy は、既存の AI failure が agentic setting でどのように増幅されるかを文書化している。業界の現場データは、hallucinated actions…",
        "keywords": "MASFT (Berkeley, arXiv:2503.13657) · Microsoft Taxonomy of Failure Mode in Agentic AI Systems · Characterizing Faults in Agentic AI (arXiv:2603.06847) · LLM Agent Hallucinations Survey (arXiv:2509.18970) · 業界で繰り返し現れる 5 つの mode · Mitigation: すべての step に gate を置く · failure monitoring が失敗するところ"
      },
      {
        "name": "Prompt Injection and the PVE Defense",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/27-prompt-injection-defense/",
        "summary": "Greshake et al. (AISec 2023) は、indirect prompt injection を agent security の中心問題として確立した。攻撃者は agent が取得する data に instructions を埋め込む。取り込み時に、それらの instructions が developer prompt を上書…",
        "keywords": "Greshake et al., AISec 2023 (arXiv:2302.12173) · 2026 年の defense doctrine · PVE: Prompt-Validator-Executor · 防御が失敗するところ"
      },
      {
        "name": "Orchestration Patterns — Supervisor, Swarm, Hierarchical",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/28-orchestration-patterns/",
        "summary": "2026 年の frameworks では、supervisor-worker、swarm / peer-to-peer、hierarchical、debate という 4 つの orchestration patterns が繰り返し現れる。Anthropic の指針は「必要に合った正しい system を作ること」。単純に始め、single age…",
        "keywords": "Supervisor-worker · Swarm / peer-to-peer · Hierarchical · Debate · CrewAI Crew vs Flow · Anthropic の指針 · このパターンが失敗するところ"
      },
      {
        "name": "Production Runtimes — Queue, Event, Cron",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/29-production-runtimes/",
        "summary": "Production agents は 6 つの runtime shapes で動く: request-response、streaming、durable execution、queue-based background、event-driven、scheduled。framework を選ぶ前に shape を選ぶ。observability は…",
        "keywords": "Request-response · Streaming · Durable execution · Queue-based / background · Event-driven · Scheduled · 2026 年の deployment patterns · Observability is load-bearing · production runtimes が失敗するところ"
      },
      {
        "name": "Eval-Driven Agent Development",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/30-eval-driven-agent-development/",
        "summary": "Anthropic の指針: 「simple prompts から始め、comprehensive evaluation で最適化し、multi-step agentic systems は必要になったときだけ追加する」。evaluation は最後の step ではない。Phase 14 のあらゆる選択を駆動する outer loop である。",
        "keywords": "3 つの evaluation layers · Evaluator-optimizer (Anthropic) · 2026 年の best practice · Phase 14 をつなげる · eval-driven development が失敗するところ"
      },
      {
        "name": "Agent Workbench: Why Capable Models Still Fail",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/31-agent-workbench-why-models-fail/",
        "summary": "高性能なモデルだけでは足りません。信頼できるエージェントには workbench が必要です。instructions、state、scope、feedback、verification、review、handoff がそろって初めて、安全に出荷できる作業になります。これらを取り除くと、frontier model でさえ出荷できない危険な成果物を生みます。",
        "keywords": "Workbench versus prompt engineering · Workbench versus framework · ベンダー分類ではなく primitive から考える · 流通している pattern を primitive に翻訳する · 数字が示していること · ベンダー記事が踏み込まないところ"
      },
      {
        "name": "The Minimal Agent Workbench",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/32-minimal-agent-workbench/",
        "summary": "最小限に役立つ workbench は 3 つの file です。root instructions router、state file、task board。その他はすべてその上に重ねます。repo がこの 3 つを持てないなら、どの model も救えません。",
        "keywords": "AGENTS.md は manual ではなく router · agent_state.json は system of record · task_board.json は queue · 3 つの file は床であり、天井ではない"
      },
      {
        "name": "Agent Instructions as Executable Constraints",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/33-instructions-as-executable-constraints/",
        "summary": "prose として書かれた instructions は願望です。constraints として書かれた instructions は test です。workbench は各 rule を、agent が runtime で確認でき、reviewer が後から検証できるものに変えます。",
        "keywords": "ほとんどの rule を覆う 5 categories · Rules are machine-readable · Rules are diff-friendly · Rules versus framework guardrails"
      },
      {
        "name": "Repo Memory and Durable State",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/34-repo-memory-and-state/",
        "summary": "chat history は揮発的です。repo は durable です。workbench は agent state を versioned files に保存し、次の session、次の agent、次の reviewer が同じ source of truth から読めるようにします。",
        "keywords": "repo memory に属するもの · Schema-first state · Atomic writes · Migrations"
      },
      {
        "name": "Initialization Scripts for Agents",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/35-initialization-scripts/",
        "summary": "cold start する session は毎回 tax を払います。agent は同じ files を読み、同じ probes を retry し、同じ paths を再発見します。init script はその tax を一度だけ払い、答えを state に書きます。",
        "keywords": "init script が probe するもの · Fail loud, fail fast, fail in one place · Idempotent · Init versus startup rules"
      },
      {
        "name": "Scope Contracts and Task Boundaries",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/36-scope-contracts/",
        "summary": "モデルは作業の終わりを知りません。スコープ契約は、作業がどこから始まり、どこで終わり、はみ出したらどう戻すかをタスクごとに書くファイルです。この契約によって、「スコープ内に留まる」という願いがチェックに変わります。",
        "keywords": "スコープ契約に入れるもの · raw path ではなく glob · rollback はスコープの一部 · scope check は diff check"
      },
      {
        "name": "Runtime Feedback Loops",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/37-runtime-feedback-loops/",
        "summary": "実際のコマンド出力を見ないエージェントは推測します。feedback runner は stdout、stderr、exit code、実行時間を、次のターンが読める構造化レコードに取り込みます。そうするとエージェントは、事実についての自分の予測ではなく、事実そのものに反応できます。",
        "keywords": "feedback record に入るもの · 切り詰めは決定的にする · feedback と telemetry · feedback なしでは前進しない"
      },
      {
        "name": "Verification Gates",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/38-verification-gates/",
        "summary": "エージェントは自分の作業を自分で done にしてはいけません。verification gate は scope contract、feedback log、rule report、diff を読み、1つの問いに答えます。この task は本当に完了しているか。gate が no と言うなら、chat が何と言っていても task は done では…",
        "keywords": "gate が check するもの · probabilistic ではなく deterministic · 1つの report、1つの path · 例外なく拒否する"
      },
      {
        "name": "Reviewer Agent: Separate Builder from Marker",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/39-reviewer-agent/",
        "summary": "code を書いた agent がそれを採点してはいけません。reviewer は、別の system prompt、別の goal、builder が生成したすべてに対する read-only access を持つ第2の loop です。builder と reviewer の間の gap に reliability の大半があります。",
        "keywords": "Reviewer rubric · reviewer は別 model ではなく別 role · reviewer は diff を編集できない · Reviewer rubric と verification gate"
      },
      {
        "name": "Multi-Session Handoff",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/40-multi-session-handoff/",
        "summary": "session は終わります。work は終わりません。handoff packet は、「agent が1時間作業した」を「次の session が最初の1分から productive になる」に変える artifact です。後付けではなく、意図して作ります。",
        "keywords": "すべての handoff が持つ7つの fields · handoff は書くのではなく生成する · 2つの形式: human-readable と machine-readable · feedback log trimming"
      },
      {
        "name": "The Workbench on a Real Repo",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/41-workbench-for-real-repos/",
        "summary": "11 lesson 分の surface は、実際の codebase に触れても生き残れなければ意味がありません。この lesson では、小さな sample app に対して同じ task を 2 回実行します。prompt-only と workbench-guided です。議論は数値に任せます。",
        "keywords": "sample app · task · 2 つの pipeline · 測定する 5 つの outcome"
      },
      {
        "name": "Capstone: Ship a Reusable Agent Workbench Pack",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/14-agent-engineering/42-agent-workbench-capstone/",
        "summary": "mini-track の最後は、どの repo にも drop できる pack です。11 lesson 分の surface を 1 つの directory に圧縮し、`cp -r` すれば翌朝には agent が信頼性高く動き始めます。この capstone が、この curriculum の実用 artifact です。",
        "keywords": "pack layout · 何を入れ、何を外すか · installer · versioning"
      }
    ]
  },
  {
    "id": 15,
    "name": "自律システム",
    "status": "complete",
    "desc": "長期 horizon agent、self-improvement、2026 年の safety stack。",
    "lessons": [
      {
        "name": "From Chatbots to Long-Horizon Agents (METR)",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/01-long-horizon-agents/",
        "summary": "2023年、チャットボットは1ターンで質問に回答した。2026年、最先端モデルは単一のタスクを数分から数時間にわたって日常的に実行する。METRのTime Horizon 1.1ベンチマーク（2026年1月）によると、Claude Opus 4.6は、50%の信頼性で14時間以上の専門的な作業をこなす。このホライズンは、GPT-2以来、約7ヶ月ごとに倍…",
        "keywords": "METRの時間ホライズン（1パラグラフで） · ホライズンが成長するときに実際に壊れるもの · 倍増時間とその意味するもの · 評価コンテキストのゲーム化 · 単一ターンと長期ホライズンの比較"
      },
      {
        "name": "STaR, V-STaR, Quiet-STaR: Self-Taught Reasoning",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/02-star-family-reasoning/",
        "summary": "最も小さな自己改善ループは、推論の根拠（rationale）の中に存在します。モデルは思考の連鎖（chain of thought）を生成し、正しい答えにたどり着いたものを保持し、それらでファインチューニングを行います。これがSTaRです。V-STaRは検証器（verifier）を追加することで、推論時の選択精度を向上させます。Quiet-STaRは、…",
        "keywords": "STaR: 何が機能したかからのブートストラップ · V-STaR: DPOによる検証器の訓練 · Quiet-STaR: トークンごとの内部推論 · なぜこれらすべてが安全性の懸念を共有するのか · 比較 · 2026年のスタックにおける位置づけ"
      },
      {
        "name": "AlphaEvolve: Evolutionary Coding Agents",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/",
        "summary": "フロンティア級のコーディングモデルを、進化ループと機械的に検証可能な評価器に組み合わせる。十分な時間ループを走らせる。すると、48回のスカラー乗算で4x4複素行列を乗算する手順を発見する。これはStrassen以来56年ぶりの改善だった。さらに、本番環境でクラスタ計算資源の約0.7%を取り戻す、Google全体向けのBorgスケジューリングヒューリステ…",
        "keywords": "ループ · 評価器が交渉不能である理由 · 報酬ハッキングはこの主張の裏面である · LLM + 探索が単独のどちらにも勝る理由 · AlphaEvolveのフロンティアスタック内での位置づけ"
      },
      {
        "name": "Darwin Gödel Machine: Self-Modifying Agents",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/04-darwin-godel-machine/",
        "summary": "Schmidhuberの2003年のGodel Machineは、自己改変を受け入れる前に、その改変が有益であることの形式的証明を要求した。その証明は実際には不可能である。Darwin Godel Machine (Zhang et al., 2025) は証明を捨て、アーカイブを残す。エージェントは自分自身のPythonソースへの編集を提案し、各バリ…",
        "keywords": "ループ · DGMが実際に改善したもの · 報酬ハッキングの実演 · 古典的Godel Machineとの比較 · このフェーズ内での位置づけ"
      },
      {
        "name": "AI Scientist v2: Workshop-Level Research",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/05-ai-scientist-v2/",
        "summary": "Sakana の AI Scientist v2（Yamada et al., arXiv:2504.08066）は、仮説、コード、実験、図表、論文執筆、投稿までの研究ループ全体を実行する。これは、生成された論文が ICLR 2025 ワークショップの査読を通過した初のシステムである。独立評価（Beel et al.）では、実験の 42% がコーディン…",
        "keywords": "アーキテクチャ · ワークショップ採択という結果の意味 · 独立評価で分かったこと · サンドボックス脱出への懸念 · フロンティアスタックにおける v2 の位置"
      },
      {
        "name": "Automated Alignment Research (Anthropic AAR)",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/06-automated-alignment-research/",
        "summary": "Anthropic は、Claude Opus 4.6 Autonomous Alignment Researcher の複数チームを独立サンドボックス内で並列に走らせ、ログがどのサンドボックスの外にも置かれる共有フォーラムを通じて協調させた（そのため、エージェントは自分自身の記録を削除できない）。弱から強への訓練問題では、AAR が人間研究者を上回っ…",
        "keywords": "アーキテクチャ（公開説明に基づく） · サンドボックス外ログが重要な理由 · 規定ワークフローのトレードオフ · 圧縮リスク · AAR が置き換えないもの"
      },
      {
        "name": "Recursive Self-Improvement: Capability vs Alignment",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/07-recursive-self-improvement/",
        "summary": "再帰的自己改善（RSI）は、もはや単なる思弁ではありません。リオで開催された ICLR 2026 RSI ワークショップ（4月23日-27日）は、RSI を具体的なツールを伴う工学上の問題として位置づけました。WEF 2026 で Demis Hassabis は、人間をループ内に置かずにこのループを閉じられるのかを公の場で問いかけました。Miles …",
        "keywords": "再帰的自己改善の正確な意味 · アラインメント偽装の結果の詳細 · Hassabis の問い · レースとしての能力対アラインメント · ICLR 2026 ワークショップが工学として扱うもの"
      },
      {
        "name": "Bounded Self-Improvement Designs",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/08-bounded-self-improvement/",
        "summary": "自己改善ループに境界を設けるための研究は、4 つのプリミティブへ収束しつつあります。すべての編集をまたいで成立しなければならない形式的不変条件。変更できないアラインメントアンカー。性能だけでなく、安全性、公平性、堅牢性のすべての次元を満たさなければならない多目的制約。過去の指標が能力低下を示したときにループを一時停止する回帰検出。これらはいずれも安全性…",
        "keywords": "プリミティブ 1: 形式的不変条件 · プリミティブ 2: アラインメントアンカー · プリミティブ 3: 多目的制約 · プリミティブ 4: 回帰検出 · 情報理論的な限界 · 具体例"
      },
      {
        "name": "Autonomous Coding Agent Landscape (SWE-bench, CodeAct)",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/09-coding-agent-landscape/",
        "summary": "SWE-bench Verified は3年足らずで4%から80.9%まで伸びた。同じ Claude Sonnet 4.5 でも、SWE-agent v1 では43.2%、Cline autonomous では59.8%を記録した。いまやモデルを取り巻くスキャフォールドは、モデルそのものと同じくらい重要になっている。OpenHands（旧 OpenDe…",
        "keywords": "SWE-benchを一段落で · 2022 → 2026の曲線が本当に示すもの · CodeAct vs JSONツール呼び出し · 2026年のランドスケープにおけるスキャフォールド · なぜスキャフォールドが支配的になるのか · ベンチマークの飽和と実際の分布"
      },
      {
        "name": "Claude Code Permission Modes and Auto Mode",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/10-claude-code-permission-modes/",
        "summary": "Claude Code には7つの permission mode がある。`plan` はすべてのアクション前に確認し、`default` はリスクのあるものだけを確認する。`acceptEdits` はファイル書き込みを自動承認するが、シェル実行は引き続き確認し、`bypassPermissions` はすべてを承認する。Auto Mode（202…",
        "keywords": "7つの permission mode · Auto Modeを1ページで · システムが捕捉するもの · システムが見逃し得るもの · Research preview という位置づけ · このはしごをワークフローに置く場所"
      },
      {
        "name": "Browser Agents and Indirect Prompt Injection",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/11-browser-agents/",
        "summary": "ChatGPT agent（2025年7月）は、Operatorとdeep researchを1つのブラウザ/ターミナルエージェントに統合し、BrowseCompでSOTAとなる68.9%を記録した。OpenAIは2025年8月31日にOperatorを終了し、プロダクト層で統合を進めた。AnthropicによるVercept買収は、Claude So…",
        "keywords": "2026年の状況：システムごとの1段落 · BrowseComp vs OSWorld vs WebArena · 攻撃面に名前を付ける · なぜ「完全にはパッチできない」のか · 実際に出荷される防御姿勢"
      },
      {
        "name": "Durable Execution for Long-Running Agents",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/12-durable-execution/",
        "summary": "本番の長期ホライズンエージェントは、`while True`で走らない。すべてのLLM呼び出しは、チェックポイント、リトライ、リプレイを備えたactivityになる。TemporalのOpenAI Agents SDK統合は2026年3月にGAになった。Claude Code Routines（Anthropic）は、永続的なローカルプロセスなしで、ス…",
        "keywords": "Activity、workflow、replay · なぜLLM呼び出しがこのパターンに合うのか · `thread_id`をキーにしたチェックポイント · 第一級の状態としての人間入力 · 35-minute degradation · 永続実行が不適切な場合"
      },
      {
        "name": "Action Budgets, Iteration Caps, Cost Governors",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/13-cost-governors/",
        "summary": "ある中規模eコマースエージェントでは、チームが「order-tracking」スキルを有効化したあと、月間LLMコストが$1,200から$4,800に跳ね上がった。これは料金バグではない。エージェントが新しいループを見つけ、その中で支出し続けたのである。MicrosoftのAgent Governance Toolkit（2026年4月2日）は、この種…",
        "keywords": "コストガバナーのスタック · なぜ単一の上限ではなくスタックなのか · Claude Codeの予算サーフェス · EU AI Act, OWASP Agentic Top 10 · 観測された$1,200 → $4,800の事例"
      },
      {
        "name": "Kill Switches, Circuit Breakers, Canary Tokens",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/14-kill-switches-canaries/",
        "summary": "キルスイッチは、エージェントの編集サーフェスの外側に保持されるbooleanである。Redis key、feature flag、署名付きconfigなどで、エージェント全体を無効化する。サーキットブレーカーはより細かい。特定のパターン（同一ツール呼び出しが5回連続するなど）でトリップし、問題の経路を一時停止し、人間へエスカレーションする。カナリアトー…",
        "keywords": "キルスイッチ · サーキットブレーカー · カナリアトークン · なぜ統計的制限とハード制限を重ねるのか · eBPF datapath redirectによる隔離 · どの検出器も捕まえられないもの"
      },
      {
        "name": "HITL: Propose-Then-Commit",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/15-propose-then-commit/",
        "summary": "2026年時点のHITLに関する合意は具体的である。「エージェントが尋ね、ユーザーがApproveをクリックする」ことではない。propose-then-commitである。提案されたアクションをidempotency keyとともに永続ストアへ保存し、意図、data lineage、触れる権限、blast radius、rollback planを添…",
        "keywords": "propose-then-commitステートマシン · idempotency key · 永続性: なぜ承認はプロセスより長く生きるのか · rubber-stamp approvalとchallenge-and-responseによる緩和 · consequentialと見なすもの · post-action verification · EU AI Act Article 14"
      },
      {
        "name": "Checkpoints and Rollback",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/16-checkpoints-rollback/",
        "summary": "すべてのgraph-state transitionは永続化される。workerがクラッシュするとleaseが期限切れになり、別のworkerが最新checkpointから引き継ぐ。Cloudflare Durable Objectsは、数時間から数週間にわたって状態を保持する。Propose-then-commit（レッスン15）は、actionごと…",
        "keywords": "すべてのtransitionを永続化する · lease recovery · idempotency plus preconditions · post-action verification · rollback plans · EU AI Act Article 14の運用上の読み方 · 鋭い失敗モード: double-execute"
      },
      {
        "name": "Constitutional AI and Rule Overrides",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/17-constitutional-ai/",
        "summary": "Anthropic が 2026 年 1 月 22 日に公開した Claude Constitution は全 79 ページで、CC0 ライセンスです。これは rule-based alignment から reason-based alignment へ進み、4層の優先順位階層を定めています: (1) safety and supporting hu…",
        "keywords": "4層の優先順位階層 · Hardcoded prohibitions と soft-coded defaults · 2022 年の CAI training · Reason-based alignment が拾えるものと落とすもの · 2023 年の参加型実験 · Hardcoded prohibitions が必要な理由 · Constitution がスタック内で占める位置"
      },
      {
        "name": "Llama Guard and Input/Output Classification",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/18-llama-guard/",
        "summary": "Llama Guard 3（Meta、Llama-3.1-8B base、content safety 用に fine-tune）は、MLCommons 13-hazard taxonomy に照らして、LLM の入力と出力の両方を8言語で分類します。1B-INT4 quantized variant はモバイル CPU 上で 30 tokens/se…",
        "keywords": "Llama Guard 3 の概要 · Llama Guard 4 の追加点 · NeMo Guardrails (NVIDIA) · 攻撃コーパス · Classifier が勝つ場所 · Classifier が負ける場所 · Defense-in-depth"
      },
      {
        "name": "Anthropic Responsible Scaling Policy v3.0",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/19-anthropic-rsp/",
        "summary": "RSP v3.0 は 2026 年 2 月 24 日に発効し、2023 年版ポリシーを置き換えました。緩和策は2層構造です。Anthropic が単独で実施することと、業界全体への推奨として位置づけること（RAND SL-4 security standards を含む）に分かれます。単発の成果物ではなく、継続文書として Frontier Safety…",
        "keywords": "2層の mitigation schedule · AI R&D-4 threshold · Frontier Safety Roadmaps と Risk Reports · pause clause の削除 · SaferAI の downgrade · このレッスンでは扱わないこと"
      },
      {
        "name": "OpenAI Preparedness Framework and DeepMind FSF",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/",
        "summary": "OpenAI Preparedness Framework v2（2025 年 4 月）は Research Categories を導入しました。これは Tracked Categories とは別で、Long-range Autonomy、Sandbagging、Autonomous Replication and Adaptation、Under…",
        "keywords": "OpenAI Preparedness Framework v2（2025 年 4 月） · DeepMind Frontier Safety Framework v3（2025 年 9 月、Tracked Capability Levels は 2026 年 4 月 17 日追加） · 3者が収束している点 · 分岐している点 · Sandbagging: 3者すべてを複雑にする具体的 capability · policy を読む skill"
      },
      {
        "name": "METR Time Horizons and External Evaluation",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/21-metr-external-evaluation/",
        "summary": "METR（旧ARC Evals）は、2023年12月から独立した501(c)(3)である。同組織の Time Horizon 1.1 ベンチマーク（2026年1月）は、タスク成功確率を専門家による人間の完了時間の対数に対してロジスティック曲線でフィットする。確率50%との交点がモデルの時間ホライズンを定義する。2025-2026年の関与セットは、GPT…",
        "keywords": "METRの背景 · Time Horizon のフィット · 2026年1月の数値 · ベンチマークスイート · プロトタイプの監視評価 · なぜホライズンは上限なのか · 外部評価者が必要な理由 · ホライズン値を実務で使う方法"
      },
      {
        "name": "CAIS, CAISI, and Societal-Scale Risk",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/15-autonomous-systems/22-cais-caisi-societal-risk/",
        "summary": "Center for AI Safety（CAIS、サンフランシスコ、HendrycksとZhangが2022年に設立）は、4リスクフレームワーク、すなわち悪用、AI競争、組織リスク、ローグAIを公開している。また、数百人の教授と企業リーダーが署名した、2023年5月の絶滅リスクに関する声明でも知られる。2026年のCAISの公開物には、フロンティアモ…",
        "keywords": "CAIS — Center for AI Safety · 4リスクフレームワーク · 組織リスクはどこにあるか · CAISI — Center for AI Standards and Innovation · California SB-53 · 社会規模リスクは単一層の問題ではない"
      }
    ]
  },
  {
    "id": 16,
    "name": "マルチエージェントと Swarms",
    "status": "complete",
    "desc": "協調、創発、集合知。",
    "lessons": [
      {
        "name": "Why Multi-Agent",
        "status": "complete",
        "type": "Learn",
        "lang": "TypeScript",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/01-why-multi-agent/",
        "summary": "1 つの agent が壁にぶつかったとき、賢い手は巨大な agent ではなく、複数の agent です。",
        "keywords": "Single-Agent Ceiling · Multi-Agent Solution · 実際のシステム例 · Spectrum · 4 つの Multi-Agent Patterns · Multi-Agent を使わない場面 · Step 1: Overloaded Single Agent · Step 2: Specialist Agents · Step 3: Messages で Coordination する · Step 4: 比較する"
      },
      {
        "name": "FIPA-ACL Heritage and Speech Acts",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/",
        "summary": "MCP や A2A より前に、FIPA-ACL がありました。2000 年、IEEE Foundation for Intelligent Physical Agents は、20 個の performatives、2 つの content languages、そして contract net、subscribe/notify、request-when…",
        "keywords": "Speech acts を 1 段落で · 20 個の FIPA performatives (一部) · Canonical FIPA-ACL message · 2 つの legacy platforms · FIPA が消えた理由 · LLM revival は FIPA-lite · trade-off を率直に言う · 移植する価値がある interaction protocols · ontology を落とすと何が壊れるか · 2026 specs を speech-act heritage に map する"
      },
      {
        "name": "Communication Protocols",
        "status": "complete",
        "type": "Build",
        "lang": "TypeScript",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/03-communication-protocols/",
        "summary": "同じ言葉を話せない agents は team ではありません。虚空に向かって叫ぶ strangers です。",
        "keywords": "Protocol Landscape · MCP (recap) · A2A (Agent2Agent Protocol) · ACP (Agent Communication Protocol) · ANP (Agent Network Protocol) · Comparison (Corrected) · どう組み合わせるか · Step 1: Core Message Types · Step 2: A2A Agent Card and Registry · Step 3: A2A Task Lifecycle · Step 4: ACP-style Audit Trail · Step 5: ANP-style Identity Verification · Step 6: Protocol Gateway · Step 7: Wire It All Together · Real Implementations · Picking the Right Protocol"
      },
      {
        "name": "The Multi-Agent Primitive Model",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/04-primitive-model/",
        "summary": "2026 年に出荷されるすべての multi-agent framework、AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework は、4 次元 design space の 1 点です。primitives は 4 つだけです。agent、handoff、shared…",
        "keywords": "4 つの primitives · 2026 frameworks への mapping · なぜ重要か · Stateless insight · 各 primitive の anatomy · frameworks 間で変わるもの"
      },
      {
        "name": "Supervisor / Orchestrator-Worker Pattern",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/",
        "summary": "1 つの lead agent が plan と delegate を行い、specialized workers が parallel contexts で実行して報告します。これは Anthropic の Research system の背後にある pattern です (Claude Opus 4 が lead、Sonnet 4 が subag…",
        "keywords": "Pattern · なぜ勝つのか · Engineering lessons (Anthropic 2025) · LangGraph turn · Failure modes · supervisor が間違っている場面"
      },
      {
        "name": "Hierarchical Architecture and Decomposition Drift",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/06-hierarchical-architecture/",
        "summary": "hierarchical は nested supervisor です。manager agents の下に sub-managers、その下に workers。CrewAI `Process.hierarchical` は textbook version で、`manager_llm` が tasks を動的に delegate し outputs…",
        "keywords": "Shape · 活きる場面 · 壊れる場面 · 決める問い · CrewAI の実装 · LangGraph の実装"
      },
      {
        "name": "Society of Mind and Multi-Agent Debate",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/07-society-of-mind-debate/",
        "summary": "Minsky の 1986 年の前提、つまり intelligence は specialist の society である、という考えは 10 年ごとに再発見されます。2023 年、Du et al. はこれを具体的な algorithm にしました。複数の LLM instance が answer を提案し、互いの answer を読み、crit…",
        "keywords": "Du et al. 2023 algorithm · 独立した 2 つの knob · なぜ効くのか · Heterogeneous debate · NLSOM — 129-agent extension · Failure modes"
      },
      {
        "name": "Role Specialization — Planner / Critic / Executor / Verifier",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/08-role-specialization/",
        "summary": "2026 年に最も一般的な multi-agent decomposition は、1 agent が plan し、1 agent が execute し、1 agent が critique または verify する形です。MetaGPT (arXiv:2308.00352) はこれを role prompt に encode した SOP とし…",
        "keywords": "4 つの canonical roles · MetaGPT の SOP pattern · ChatDev の communicative dehallucination · verifier が最も重要な理由 · Critic vs verifier · anti-pattern · Framework mappings"
      },
      {
        "name": "Parallel Swarm and Networked Architectures",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/",
        "summary": "supervisor との対比: 中央の意思決定者を置かない。agent は共有 event bus を読み、非同期に作業を取り、結果を書き戻す。LangGraph は、分散型で動的な環境向けに「Swarm Architecture」を明示的にサポートしている。Matrix (arXiv:2511.21686) は control flow と dat…",
        "keywords": "The shape · When swarm fits · When swarm fails · Matrix (arXiv:2511.21686) · LangGraph's Swarm Architecture · Failure mode: starvation and hot-spotting · The content-based routing link"
      },
      {
        "name": "Group Chat and Speaker Selection",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/",
        "summary": "AutoGen GroupChat と AG2 GroupChat は、N 個の agent が1つの会話を共有する。selector function (LLM、round-robin、custom) が次に誰が話すかを選ぶ。これは emergent multi-agent conversation の典型だ。agent は static graph…",
        "keywords": "The shape · The three selector flavors · The ConversableAgent API · Termination · The AutoGen → AG2 split and the Microsoft Agent Framework merge · When GroupChat fits · When it fails · Group chat vs supervisor"
      },
      {
        "name": "Handoffs and Routines (Stateless Orchestration)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/11-handoffs-and-routines/",
        "summary": "OpenAI の Swarm (2024 年 10 月) は multi-agent orchestration を2つの primitive に絞った。**routines** (system prompt としての instructions + tools) と **handoffs** (別の Agent を返す tool) だ。state ma…",
        "keywords": "Two primitives · Why it is viral · The stateless trade · When Swarm/handoffs fit · When Swarm struggles · OpenAI Agents SDK (March 2025) · Swarm vs GroupChat"
      },
      {
        "name": "A2A — The Agent-to-Agent Protocol",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/12-a2a-protocol/",
        "summary": "Google は 2025 年 4 月に A2A を発表した。2026 年 4 月時点で spec は https://a2a-protocol.org/latest/specification/ にあり、150 以上の組織が支援している。A2A は MCP (Lesson 13) の水平補完だ。MCP が vertical (agent ↔ tool…",
        "keywords": "The four elements · The MCP/A2A split · Discovery flow · Auth · 150+ organizations by April 2026 · Where A2A wins · Where A2A struggles · A2A vs ACP, ANP, NLIP"
      },
      {
        "name": "Shared Memory and Blackboard Patterns",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/",
        "summary": "2026 年の multi-agent system では2つの approach が併存している。**message pool** (AutoGen GroupChat や MetaGPT のように全員が全員の message を見る) と、**subscription 付き blackboard** (Context-Aware MCP や Mat…",
        "keywords": "The two main topologies · When each wins · Memory poisoning, in one scenario · Why this is structural · Blackboard precedent (Hayes-Roth, 1985) · Projection vs full view · Write-contention patterns · The unwritable verifier"
      },
      {
        "name": "Consensus and Byzantine Fault Tolerance",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/14-consensus-and-bft/",
        "summary": "古典的 distributed-systems BFT が stochastic LLM と出会う。2025-2026 年には3つの研究方向が出てきた。**CP-WBFT** (arXiv:2511.10400) は confidence probe で各 vote を重み付けする。**DecentLLMs** (arXiv:2507.14928) は…",
        "keywords": "What classical BFT gives you · The three LLM-specific attacks · The 2025-2026 responses · Empirical: \"Can AI Agents Agree?\" (arXiv:2603.01213) · The core protocol, stripped down · Threshold tuning · Where consensus does not help"
      },
      {
        "name": "Voting, Self-Consistency, and Debate Topology",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/15-voting-debate-topology/",
        "summary": "最も安い aggregation は、N 個の independent agent を sample して majority-vote することだ。Wang et al. 2022 の self-consistency は、1つの model を N 回 sample してこれを行った。multi-agent は、monoculture から逃れるため…",
        "keywords": "Self-consistency, the single-model baseline · Multi-agent vote, the heterogeneous extension · The four topologies · The coordination tax (MultiAgentBench) · Multi-Agent Debate Strategies (\"Should we be going MAD?\") · AgentVerse emergent patterns · Heterogeneity: the actual knob that moves accuracy · Jury methods · When vote-with-debate dominates · When vote-with-debate hurts"
      },
      {
        "name": "Negotiation and Bargaining",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/16-negotiation-bargaining/",
        "summary": "agent は resources、prices、task allocations、terms を negotiate する。2026 年の benchmark set は明確だ。NegotiationArena (arXiv:2402.05863) は、LLM が persona manipulation (\"desperation\") で payo…",
        "keywords": "Contract Net, in one paragraph · Why OG-Narrator wins · NegotiationArena findings · Chain-of-thought concealment · Bhattacharya et al. 2025 — model rankings · Task allocation via Contract Net + LLM · LLM-Stakeholders Interactive Negotiation · The narration-vs-mechanism rule"
      },
      {
        "name": "Generative Agents and Emergent Simulation",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/17-generative-agents-simulation/",
        "summary": "Park et al. 2023（UIST '23, arXiv:2304.03442）は、25 体のエージェントからなる sandbox **Smallville** に、3 部構成のアーキテクチャを入れた。**memory stream**（自然言語ログ）、**reflection**（エージェントが自分の stream から生成する高次の syn…",
        "keywords": "3 つの components · なぜ 3 つすべてが重要か（ablation） · Valentine's Day の創発 · documented failure modes · 3-component implementation rules · Smallville を超える generative agents · multi-agent engineering にとってなぜ重要か"
      },
      {
        "name": "Theory of Mind and Emergent Coordination",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/",
        "summary": "Li et al.（arXiv:2310.10701）は、cooperative text game における LLM agents が **emergent high-order Theory of Mind**（ToM）を示すことを確認した。これは、第三者の beliefs について別の agent が何を信じているかを reasoning する能…",
        "keywords": "ToM とは何か · Sally-Anne test の要点 · Riedl の coordination measurement · coordination illusion · 最小の ToM-aware agent · long-horizon がつらい理由 · production で ToM が失敗する場所 · 実際に測れる coordination"
      },
      {
        "name": "Swarm Optimization (PSO, ACO)",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/",
        "summary": "Bio-inspired optimization が LLM 時代に戻ってきている。**LMPSO**（arXiv:2504.09247）は PSO を使い、各 particle の velocity を prompt として、LLM が次の candidate を生成する。structured-sequence outputs（math expre…",
        "keywords": "PSO refresher（Kennedy & Eberhart 1995） · LLM outputs 上の PSO — LMPSO · Model Swarms · ACO refresher（Dorigo 1992） · AMRO-S — agent routing のための ACO · LLM に PSO / ACO を使うべきとき · bio-inspired がまだ勝つ理由 · practical limits"
      },
      {
        "name": "MARL — MADDPG, QMIX, MAPPO",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/",
        "summary": "multi-agent coordination の reinforcement-learning heritage は、2026 年の LLM-agent systems にもなお影響している。**MADDPG**（Lowe et al., NeurIPS 2017, arXiv:1706.02275）は Centralized Training, …",
        "keywords": "papers が使う 3 つの environments · MADDPG（2017）— CTDE pattern · QMIX（2018）— value decomposition · MAPPO（2022）— 見落とされていた default · LLM-agent engineers が気にすべき理由 · RL を超えた design pattern としての CTDE · non-stationarity problem · この lesson が扱わないこと"
      },
      {
        "name": "Agent Economies, Token Incentives, Reputation",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/21-agent-economies/",
        "summary": "long-horizon autonomous agents（METR の 1-hour to 8-hour work-curve）には economic agency が必要である。 emerging **5-layer stack** は、**DePIN**（physical compute）→ **Identity**（W3C DIDs + re…",
        "keywords": "5-layer agent-economy stack · Bittensor, Fetch.ai, Gonka — 実際に動いているもの · Shapley-value credit attribution · aggregation のための second-price auction · Reputation capital · AAMAS 2025 decentralized LaMAS · economics が崩れる場所 · agent economies が意味を持つとき"
      },
      {
        "name": "Production Scaling — Queues, Checkpoints, Durability",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/",
        "summary": "multi-agent systems を thousands of concurrent runs へ scale するには **durable execution** が必要である。LangGraph runtime は `thread_id` で key された checkpoint を各 super-step 後に書き込む（default は …",
        "keywords": "Durable execution という pattern · LangGraph runtime · MegaAgent の per-agent queue · Async vs thread-per-job · Bedi の counterpoint · Exactly-once semantics · Rainbow deployment · canonical production checklist"
      },
      {
        "name": "Failure Modes — MAST, Groupthink, Monoculture",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/",
        "summary": "2026 年の reference taxonomy は **MAST**（Cemri et al., NeurIPS 2025, arXiv:2503.13657）である。7 つの state-of-the-art open-source MAS から得た 1642 execution traces に基づき、**41–86.7% failure r…",
        "keywords": "MAST categories · Groupthink family（arXiv:2508.05687） · Cascading example — retry storm · Memory poisoning（再訪） · STRATUS — failure detection のための specialized agents · failure-mode audit · systems が silently に失敗するとき · failure vs slow failure"
      },
      {
        "name": "Evaluation and Coordination Benchmarks",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/",
        "summary": "5 つの 2025-2026 benchmarks が multi-agent evaluation space を覆っている。**MultiAgentBench / MARBLE**（ACL 2025, arXiv:2503.01935）は star/chain/tree/graph topologies を milestone KPIs で評価し、…",
        "keywords": "MultiAgentBench（MARBLE）— ACL 2025 · COMMA — multimodal asymmetric information · MedAgentBoard — domain stress test · AgentArch — enterprise architectures · SWE-bench Pro — reality check · AAAI 2026 WMAC · benchmark claims を懐疑的に読む — 2026 checklist · どの benchmark もまだうまく測れないもの"
      },
      {
        "name": "Case Studies and 2026 State of the Art",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/",
        "summary": "end-to-end で学ぶべき production-grade references は 3 つあり、それぞれ multi-agent engineering の異なる slice を示す。**Anthropic's Research system**（orchestrator-worker、15x tokens、single-agent Opus…",
        "keywords": "Anthropic Research system · MetaGPT / ChatDev · OpenClaw / Moltbook ecosystem · Framework landscape April 2026 · 3 cases に共通する patterns · 次の project の reference を選ぶ · 2026 state-of-the-art summary"
      }
    ]
  },
  {
    "id": 17,
    "name": "インフラと Production",
    "status": "complete",
    "desc": "AI を現実世界へ出荷します。",
    "lessons": [
      {
        "name": "Managed LLM Platforms — Bedrock, Azure OpenAI, Vertex AI",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/01-managed-llm-platforms/",
        "summary": "3つの hyperscaler、3つの異なる戦略。AWS Bedrock はモデルマーケットプレイスであり、Claude、Llama、Titan、Stability、Cohere を1つの API の背後にまとめます。Azure OpenAI は OpenAI との独占的パートナーシップに、専用キャパシティの Provisioned Throughpu…",
        "keywords": "Three strategies · Latency gap at scale · Provisioned Throughput economics · FinOps surface — the real differentiator · Lock-in is the 2026 risk · Data residency, BAAs, and regulated industries · Numbers you should remember"
      },
      {
        "name": "Inference Platform Economics — Fireworks, Together, Baseten, Modal",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/02-inference-platform-economics/",
        "summary": "2026年の inference market は、もはや GPU time rental ではありません。custom silicon（Groq、Cerebras、SambaNova）、GPU platforms（Baseten、Together、Fireworks、Modal）、API-first marketplaces（Replicate、De…",
        "keywords": "The three segments · Fireworks — latency-optimized GPU platform · Together — breadth-optimized · Baseten — enterprise-polish-optimized · Modal — Python-native-optimized · Replicate — multimodal breadth · Anyscale — Ray-native · Per-token versus per-minute — when each wins · Custom engine is the real moat · Numbers you should remember"
      },
      {
        "name": "GPU Autoscaling on Kubernetes — Karpenter, KAI Scheduler",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/",
        "summary": "1つではなく3つの layer です。Karpenter は node を dynamic に provision します（1分未満、Cluster Autoscaler より40%高速）。KAI Scheduler は gang scheduling、topology awareness、hierarchical queues を扱い、8 GPU 中…",
        "keywords": "Layer 1 — node provisioning (Karpenter) · Layer 2 — gang scheduling (KAI Scheduler) · Layer 3 — application-level signals · When to use what · Disaggregated prefill/decode complicates everything · Cold start matters here too · Numbers you should remember"
      },
      {
        "name": "vLLM Serving Internals — PagedAttention, Continuous Batching, Chunked Prefill",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/04-vllm-serving-internals/",
        "summary": "2026 年の vLLM の強さは、1 つの trick ではなく、相互に効く 3 つの default にあります。PagedAttention は常に有効です。Continuous batching は decode iteration の間に新しい request を active batch へ差し込みます。Chunked prefill は …",
        "keywords": "virtual memory system としての PagedAttention · iteration level の continuous batching · Chunked prefill は TTFT tail を守る · 3 つの default は相互作用する · 2026 v0.18.0 gotcha · 覚えるべき数字 · scheduler の形"
      },
      {
        "name": "EAGLE-3 Speculative Decoding in Production",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/",
        "summary": "Speculative decoding は fast draft model と target model を組み合わせます。draft が K tokens を提案し、target が single forward で verify します。accepted tokens は実質 free です。2026 年の production-grade v…",
        "keywords": "speculative decoding が実際に買うもの · alpha が唯一重要な metric である理由 · EAGLE generations at a glance · 2026 production recipe · production pitfall: P99 tail · EAGLE-3 がすでに使われている場所 · break-even math in one line · speculative decoding を使わない方がよい場合"
      },
      {
        "name": "SGLang and RadixAttention for Prefix-Heavy Workloads",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/06-sglang-radixattention/",
        "summary": "SGLang は KV cache を radix tree に保存される first-class で再利用可能な resource として扱います。vLLM が FCFS (first-come, first-served) で request を schedule するのに対し、SGLang の cache-aware scheduler は sh…",
        "keywords": "KV index としての radix tree · Cache-aware scheduling · 覚えるべき benchmark numbers · ordering gotcha · RadixAttention が勝つ場所と負ける場所 · kernel だけでなく scheduler 問題である理由 · vLLM との関係"
      },
      {
        "name": "TensorRT-LLM on Blackwell with FP8 and NVFP4",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/",
        "summary": "TensorRT-LLM は NVIDIA-only ですが、Blackwell では勝ちます。GB200 NVL72 と Dynamo orchestration では、SemiAnalysis InferenceX が 2026 年 Q1-Q2 に 120B model で $0.012 per million tokens を測定しました。H10…",
        "keywords": "KV cache では FP8 がまだ floor である理由 · TRT-LLM が使う Blackwell-specific primitives · 覚えるべき数字 · FP4 が quality に与える実際の cost · なぜ NVIDIA-lock decision なのか · 2026 practical recipe · disaggregation bonus"
      },
      {
        "name": "Inference Metrics — TTFT, TPOT, ITL, Goodput, P99",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/08-inference-metrics-goodput/",
        "summary": "推論デプロイが機能しているかどうかは 4 つのメトリクスで決まります。TTFT は prefill、キュー、ネットワークの合計です。TPOT（ITL と同等）は token あたりのメモリ律速な decode コストです。エンドツーエンド latency は TTFT に、TPOT と出力長の積を足したものです。Throughput は fleet 全…",
        "keywords": "TTFT — time to first token · TPOT / ITL — inter-token latency · E2E latency · Throughput · Goodput — 実際に気にするべきメトリクス · Mean が不適切な統計量である理由 · 参考値 — TRT-LLM 上の Llama-3.1-8B-Instruct、2026 年 · 測定の罠 · SLO を構成する · 測定方法"
      },
      {
        "name": "Production Quantization — AWQ, GPTQ, GGUF, FP8, NVFP4",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/09-production-quantization/",
        "summary": "Quantization format は万能に選ぶものではなく、hardware、serving engine、workload の関数です。GGUF Q4_K_M または Q5_K_M は CPU と edge を担い、llama.cpp と Ollama 経由で提供されます。同じ base で multi-LoRA が必要な vLLM 内では G…",
        "keywords": "6 つの format · GGUF — CPU/edge の default · GPTQ — vLLM の multi-LoRA · AWQ — datacenter GPU の default · FP8 — 信頼できる中間 · MXFP4 / NVFP4 — Blackwell aggressive · Calibration の罠 · KV cache の罠 · AWQ INT4 は reasoning では危険 · 2026 年の選び方ガイド"
      },
      {
        "name": "Cold Start Mitigation for Serverless LLMs",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/10-cold-start-mitigation/",
        "summary": "20 GB の model image が cold 状態から serving 可能になるまで、5-10 分（7B）から 20 分超（70B）かかります。本当の serverless の世界では、これは warm-up ではなく outage です。Mitigation は 5 つの層で働きます。Pre-seeded node images（AWS の…",
        "keywords": "Layer 1 — pre-seeded node images（Bottlerocket） · Layer 2 — model streaming（Run:ai Model Streamer） · Layer 3 — GPU memory snapshots（Modal） · Layer 4 — warm pools（min_workers=1） · Layer 5 — tiered loading（ServerlessLLM） · Layer 6 — live migration（bonus pattern） · Warm-pool の計算 · 最適化前に測定する · 覚えておくべき数値"
      },
      {
        "name": "Multi-Region LLM Serving and KV Cache Locality",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/11-multi-region-kv-locality/",
        "summary": "Round-robin load balancing は cached LLM inference では積極的に有害です。Prefix を持つ node に着地しない request は full prefill cost を支払います。長い prompt では P50 で約 800 ms かかる一方、cache hit なら約 80 ms です。20…",
        "keywords": "Cache-aware routing · 数値 · Cross-region には新しい制約がある — network latency · Commercial \"cross-region inference\" はここでは役に立たない · DR hygiene — 32% missing-files problem · Data residency は直交する · 覚えておくべき数値"
      },
      {
        "name": "Edge Inference — ANE, Hexagon, WebGPU, Jetson",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/12-edge-inference/",
        "summary": "Edge の中核制約は compute ではなく memory bandwidth です。Mobile DRAM は 50-90 GB/s、datacenter HBM3 は 2-3 TB/s に達します。30-50x の差です。Decode は memory-bound なので、この差が決定的です。2026 年の landscape は 4 つに分か…",
        "keywords": "Bandwidth が本当の ceiling · Apple Neural Engine（M4 / A18） · Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4） · Intel / AMD NPUs（Lunar Lake、Ryzen AI 300） · WebGPU + WebLLM · NVIDIA Jetson family · Target ごとの quantization choice · Edge の long-context trap · Voice は killer app · 覚えておくべき数値"
      },
      {
        "name": "LLM Observability Stack Selection",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/13-llm-observability/",
        "summary": "2026 年の observability market は 2 つの category に分かれます。Development platforms（LangSmith、Langfuse、Comet Opik）は monitoring を evals、prompt management、session replays と束ねます。Gateway/inst…",
        "keywords": "2 つの category · Langfuse — OSS balance · Phoenix（Arize）— telemetry-first、OpenTelemetry-native · Arize AX — scale play · LangSmith — LangChain/LangGraph first · Helicone — proxy-based minimum viable · Opik（Comet）— OSS dev platform · SigNoz — OpenTelemetry-first full APM · Glue: OpenTelemetry + GenAI semantic conventions · 罠: 間違った layer で instrument する · Sampling — すべては保存できない · 覚えておくべき数値"
      },
      {
        "name": "Prompt Caching and Semantic Caching Economics",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/14-prompt-semantic-caching/",
        "summary": "**Pricing snapshot dated 2026-04.** 以下の数値は、このレッスン公開時に取得した vendor rate cards に基づきます。下流で引用する前に、linked docs で確認してください。",
        "keywords": "L2 — provider prompt/prefix caching · L1 — app-level semantic caching · Parallelization anti-pattern · Dynamic content anti-pattern · Overnight workloads では batch + cache を重ねる · 覚えておくべき数値"
      },
      {
        "name": "Batch APIs — the 50% Discount as Industry Standard",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/15-batch-apis/",
        "summary": "主要プロバイダーはどこも非同期の Batch API を提供し、50%割引とおおむね24時間以内の完了を約束している。OpenAI、Anthropic、Google、そして多くの推論プラットフォーム（Fireworks の batch tier、Together batch）は同じパターンを実装している。batch と prompt caching を…",
        "keywords": "3つの Batch API · 意味: 非同期であり、遅いわけではない · caching と重ねる · ワークロードの仕分け · partial-interactivity の罠 · output-schema の罠 · 覚えておくべき数字"
      },
      {
        "name": "Model Routing as a Cost-Reduction Primitive",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/16-model-routing/",
        "summary": "dynamic broker は各 request（task type、token length、embedding similarity、confidence）を評価し、単純な query は安い model に送り、複雑なものは frontier model へ escalates する。model cascading とも呼ばれる。本番事例では、…",
        "keywords": "4つの routing signal · 3つの pattern · 実装 · 2026年の price curve · 本当のリスクは drift · 覚えておくべき数字"
      },
      {
        "name": "Disaggregated Prefill/Decode — NVIDIA Dynamo and llm-d",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/",
        "summary": "Prefill は compute-bound、decode は memory-bound である。同じ GPU で両方を動かすと、どちらかの resource を無駄にする。disaggregation は両者を別々の pool に分け、NIXL（RDMA/InfiniBand または TCP fallback）で KV cache を転送する。NV…",
        "keywords": "bottleneck が異なる理由 · architecture · Dynamo vs llm-d · 経済性 · disaggregate すべきでない場合 · router と Phase 17 · 11 の統合 · 本当の数字は Blackwell 上の MoE にある · 覚えておくべき数字"
      },
      {
        "name": "vLLM Production Stack with LMCache KV Offloading",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/",
        "summary": "vLLM の production-stack は reference Kubernetes deployment です。router、engines、observability が一緒に wire されています。LMCache は GPU memory から KV cache を取り出し、query と engines をまたいで reuse する …",
        "keywords": "vLLM production-stack · KV Offloading Connector API (v0.9.0+) · Native CPU offload vs LMCache · benchmark の挙動 · LMCache が decisive な場合 · 有効化しない方がよい場合 · disaggregated serving との統合 · 覚えるべき数字"
      },
      {
        "name": "AI Gateways — LiteLLM, Portkey, Kong, Bifrost",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/19-ai-gateways/",
        "summary": "gateway は app と model providers の間に置かれる。中核機能は provider routing、fallback、retries、rate limiting、secret references、observability、guardrails である。2026年の市場分布: **LiteLLM** は MIT OSS で1…",
        "keywords": "6つの core features · LiteLLM — MIT OSS, Python · Portkey — control plane としての位置づけ · Kong AI Gateway — scale 重視の選択肢 · Bifrost (Maxim AI) · Cloudflare AI Gateway / Vercel AI Gateway · self-hosted vs managed · latency budget · rate-limit semantics は重要 · Gateway + observability + routing の組み合わせ · 覚えておくべき数字"
      },
      {
        "name": "Shadow, Canary, and Progressive Deployment",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/20-shadow-canary-progressive/",
        "summary": "LLM rollout は software deployment の難しい要素を組み合わせる。unit tests がなく、failure modes は拡散し、signals は遅れて届く。順序は (1) shadow mode — prod requests を candidate model に複製し、log して比較する。user impac…",
        "keywords": "Shadow mode · Canary rollout · non-determinism は新しい variance · cost は variable · rollback が武器になる · tooling · metrics cadence · A/B step は optional · 覚えておくべき数字"
      },
      {
        "name": "A/B Testing LLM Features — GrowthBook and Statsig",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/21-ab-testing-llm-features/",
        "summary": "従来の A/B testing は non-deterministic な LLM を前提に作られていない。重要な区別: evals は「model は job を実行できるか？」に答える。A/B tests は「users はそれを気にするか？」に答える。両方が必要であり、vibe check だけで ship する時代は終わった。2026年に te…",
        "keywords": "evals vs A/B tests · test すべきもの · CUPED — variance reduction · sequential testing · multiple-comparison corrections · SRM — sample ratio mismatch · Statsig vs GrowthBook · non-determinism は power を複雑にする · 実例の outcome · anti-pattern: vibes で ship する · 覚えておくべき数字"
      },
      {
        "name": "Load Testing LLM APIs — k6, LLMPerf, GenAI-Perf",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/22-load-testing-llm-apis/",
        "summary": "従来の負荷テスターは、ストリーミング応答、可変の出力長、トークン単位のメトリクス、GPU 飽和を前提に設計されていません。多くのチームは 2 つの罠にはまります。GIL の罠: Locust のトークン単位計測は Python GIL の下でトークナイズを実行するため、高並行時にはリクエスト生成と競合します。その結果、トークナイズの滞留が報告上の in…",
        "keywords": "GIL の罠 (Locust) · プロンプト均一性の罠 · 4 つの負荷パターン · 2026 年のツール対応 · CI の SLA ゲート · 現実的なプロンプト分布 · 覚えておくべき数字"
      },
      {
        "name": "SRE for AI — Multi-Agent Incident Response",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/23-sre-for-ai/",
        "summary": "AI SRE は、ログ、runbook、サービス topology などのインフラデータに RAG で接地した LLM を使い、調査、文書化、調整の各フェーズを自動化します。2026 年のアーキテクチャパターンは multi-agent orchestration です。logs、metrics、runbooks に特化したエージェントを superv…",
        "keywords": "Multi-agent architecture · Auto-remediation の範囲 · Adversarial evaluation (NeuBird Hawkeye) · Operational memory · Pre-incident prediction · 2026 年の製品 · Runbooks as code · 覚えておくべき数字"
      },
      {
        "name": "Chaos Engineering for LLM Production",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/24-chaos-engineering-llm/",
        "summary": "LLM の chaos engineering は、2026 年にはそれ自体が 1 つの専門分野です。本番で experiment を実行する前の prerequisites: 定義済み SLI/SLO、trace+metric+log observability、automated rollback、runbooks、on-call。architec…",
        "keywords": "前提条件 · 4 つの planes + feedback · Guardrails は必須 · 5 つの LLM-specific experiments · Cadence · Tooling · 小さく始める · 覚えておくべき数字"
      },
      {
        "name": "Security — Secrets, PII Scrubbing, Audit Logs",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/25-security-secrets-audit/",
        "summary": "centralized vaults (HashiCorp Vault、AWS Secrets Manager、Azure Key Vault) により secret sprawl をなくします。credentials を config files、VCS 内の env files、spreadsheets に保存してはいけません。static key…",
        "keywords": "Centralized vault + IAM-role pull · Rotation policy は 90 日以下 · Secret scanning · Zero-trust posture · PII / PHI scrubbing · Input + output guardrails · Network egress whitelist · Audit log · 2026 年の Vercel incident · 覚えておくべき数字"
      },
      {
        "name": "Compliance — SOC 2, HIPAA, GDPR, EU AI Act, ISO 42001",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/26-compliance-frameworks/",
        "summary": "Multi-framework coverage は 2026 年の enterprise deals では table stakes です。**EU AI Act**: 2024 年 8 月 1 日から in force。ほとんどの high-risk requirements は 2026 年 8 月 2 日に enforce されます。high-…",
        "keywords": "7 つの frameworks · EU AI Act timeline · GDPR — real-time redaction が標準 · HIPAA — BAA は optional ではない · SOC 2 Type II · Cross-framework mapping · ISO 42001 — emerging · OpenAI の reference profile · 覚えておくべき数字"
      },
      {
        "name": "FinOps for LLMs — Unit Economics and Multi-Tenant Attribution",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/27-finops-llms/",
        "summary": "Traditional FinOps は LLM spend では破綻します。costs は resource-uptime ではなく token-transactions です。tags はそのまま map できません。API call は asset ではなく transaction です。engineering decisions (prompt…",
        "keywords": "3 つの attribution dimensions · 4 つの token layers · Enforcement ladder · Attribution patterns · Cost per X が unit metric · Cost attribution trace shape · Compounded-savings stack · 覚えておくべき数字"
      },
      {
        "name": "Self-Hosted Serving Selection — llama.cpp, Ollama, TGI, vLLM, SGLang",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/17-infrastructure-and-production/28-self-hosted-serving-selection/",
        "summary": "2026 年の self-hosted inference は 4 つの engines が支配しています。hardware、scale、ecosystem に基づいて選びます。**llama.cpp** は CPU で最速です。model support が最も広く、quantization と threading を完全に制御できます。**Olla…",
        "keywords": "5 つの engines · Hardware-first decision · Scale-second decision · Workload-third decision · TGI maintenance trap · Pipeline pattern · Ollama caveat · Self-hosted と managed は別の判断 · 覚えておくべき数字"
      }
    ]
  },
  {
    "id": 18,
    "name": "倫理・安全性・アラインメント",
    "status": "complete",
    "desc": "人類の役に立つ AI を作ります。これは任意ではありません。",
    "lessons": [
      {
        "name": "Instruction-Following as Alignment Signal",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/",
        "summary": "RLHF へのその後の批判は、すべてこのパイプラインへの反論として読めます。最適化圧がプロキシをどう歪めるかを学ぶ前に、まずそのプロキシ自体を見る必要があります。InstructGPT (Ouyang et al., 2022) は参照アーキテクチャを定義しました。instruction-response ペアでの supervised fine-tu…",
        "keywords": "Stage 1: supervised fine-tuning (SFT) · Stage 2: reward model (RM) · Stage 3: KL penalty 付き PPO · Alignment tax · 結果 · Phase 18 の基準点になる理由"
      },
      {
        "name": "Reward Hacking & Goodhart's Law",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/",
        "summary": "プロキシ報酬を最大化できるほど強い optimizer は、必ずプロキシと本当に欲しかったものの隙間を見つけます。Gao et al. (ICML 2023) はこれに scaling law を与えました。proxy reward は増え、gold reward はピーク後に落ち、gap は initial policy からの KL diverge…",
        "keywords": "Goodhart's Law を精密にする · 4 つの姿、1 つの mechanism · Catastrophic Goodhart · 実際に部分的に効くもの · 2026 年の統一的な見方"
      },
      {
        "name": "Direct Preference Optimization Family",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/",
        "summary": "Rafailov et al. (2023) は、RLHF の optimum が preference data に関して closed form で書けることを示しました。つまり explicit reward model を飛ばし、policy を直接 optimize できます。この洞察から IPO、KTO、SimPO、ORPO、BPO という…",
        "keywords": "DPO (Rafailov et al., 2023) · IPO (Azar et al., 2024) · KTO (Ethayarajh et al., 2024) · SimPO (Meng et al., 2024) · ORPO (Hong et al., 2024) · BPO (ICLR 2026 submission, OpenReview id=b97EwMUWu7) · 普遍的な結果: DAAs も over-optimize する · どれを選ぶか (2026)"
      },
      {
        "name": "Sycophancy as RLHF Amplification",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/",
        "summary": "Sycophancy は data の bug ではなく、loss の性質です。Shapira et al. (arXiv:2602.01002, Feb 2026) は形式的な 2 段階 mechanism を示しました。sycophantic completions は base model の high-reward outputs に過剰に含ま…",
        "keywords": "2 段階 formalism (Shapira et al., 2026) · Empirical amplification · Stanford (2026) の測定 · Calibration collapse (Sahoo 2026) · Agreement-penalty correction · Phase 18 で重要な理由"
      },
      {
        "name": "Constitutional AI & RLAIF",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/",
        "summary": "Bai et al. (arXiv:2212.08073, 2022) は「human labeler を、principles のリストを読む AI に置き換えたらどうなるか」と問いかけました。Constitutional AI には 2 つの phase があります。constitution のもとでの self-critique and revi…",
        "keywords": "Phase 1 — Supervised self-critique and revision · Phase 2 — RL from AI Feedback (RLAIF) · なぜ「安い RLHF」ではないのか · 2026 Claude constitution rewrite · Constitutional Classifiers · CAI は family のどこにあるか"
      },
      {
        "name": "Mesa-Optimization & Deceptive Alignment",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/06-mesa-optimization-deceptive-alignment/",
        "summary": "Hubinger et al. (arXiv:1906.01820, 2019) は、実証される 10 年近く前にこの問題へ名前を与えました。base objective を最小化する learned optimizer を訓練するとき、learned optimizer の internal objective は base objective では…",
        "keywords": "用語 · mesa-optimization が生じやすい 4 条件 · mesa-objective alignment の 4 分類 · なぜ adversarial training は失敗するのか · Gradient hacking · 2026 年の outer alignment · Phase 18 での位置づけ"
      },
      {
        "name": "Sleeper Agents — Persistent Deception",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/",
        "summary": "Hubinger et al. (arXiv:2401.05566, January 2024) は、deceptive alignment の最初の empirical model organisms を作りました。構成は 2 つです。prompt に年が 2023 と書かれていると safe code を書き、2024 だと SQL injecti…",
        "keywords": "2 つの model organisms · 何が何を生き残るか · なぜ adversarial training は逆効果になるのか · 2024 年 4 月の probe result · safety cases への意味 · Phase 18 arc での位置づけ"
      },
      {
        "name": "In-Context Scheming in Frontier Models",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/08-in-context-scheming-frontier-models/",
        "summary": "Meinke, Schoen, Scheurer, Balesni, Shah, Hobbhahn (Apollo Research, arXiv:2412.04984, December 2024)。o1、Claude 3.5 Sonnet、Claude 3 Opus、Gemini 1.5 Pro、Llama 3.1 405B を、in-contex…",
        "keywords": "Experimental setup · 2024 frontier models での結果 · 3 pillars · 2025 anti-scheming training result · field の現在の仮定 · Phase 18 での位置づけ"
      },
      {
        "name": "Alignment Faking",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/09-alignment-faking/",
        "summary": "Greenblatt, Denison, Wright, Roger et al. (Anthropic / Redwood, arXiv:2412.14093, December 2024)。deceive するよう訓練されておらず、red team が in-context conflict of interest を構築してもいない produc…",
        "keywords": "Experimental setup · compliance gap が測るもの · なぜ Lessons 7 と 8 より strictly stronger なのか · 2025 follow-ups · Illegibility problem · Phase 18 での位置づけ"
      },
      {
        "name": "AI Control — Safety Despite Subversion",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/10-ai-control-subversion/",
        "summary": "Greenblatt, Shlegeris, Sachan, Roger (Redwood Research, arXiv:2312.06942, ICML 2024)。Control は safety question を組み替えます。adversarial にあなたへ最適化しているかもしれない untrusted strong model U があ…",
        "keywords": "Threat model · ICML 2024 backdoor task · 比較された 4 protocols · なぜ Trusted Editing が勝つのか · 4 つの protocol axes · Alignment vs control · 3 つの根本的限界 · 2025 年の展開 · Phase 18 での位置づけ"
      },
      {
        "name": "Scalable Oversight & Weak-to-Strong",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong/",
        "summary": "Burns et al. (OpenAI Superalignment, \"Weak-to-Strong Generalization\", 2023) は、superalignment 問題の代理課題を提案しました。弱いモデルが生成したラベルで強いモデルを fine-tune する、という設定です。強いモデルが不完全な弱い監督から正しく汎化できるなら、…",
        "keywords": "W2SG: Burns et al. の設定 · Burns et al. の経験的知見 · Scalable oversight: 3つのメカニズム · Scalable oversight と W2SG が相補的である理由 · 組織上のドラマ · Phase 18 における位置づけ"
      },
      {
        "name": "Red-Teaming: PAIR & Automated Attacks",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/",
        "summary": "Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419)。PAIR — Prompt Automatic Iterative Refinement — は、標準的な自動 black-box jailbreak です。red-team system prom…",
        "keywords": "PAIR algorithm · PAIR が効率的な理由 · 関連する自動攻撃 · JailbreakBench と HarmBench · 2026 年の deployment で重要な理由 · Phase 18 における位置づけ"
      },
      {
        "name": "Many-Shot Jailbreaking",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/",
        "summary": "Anil, Durmus, Panickssery, Sharma, et al. (Anthropic, NeurIPS 2024)。Many-shot jailbreaking (MSJ) は長い context window を利用します。有害リクエストに assistant が従う偽の user-assistant turn を数百件詰め込み、…",
        "keywords": "攻撃 · Power-law ASR · ICL と mechanism を共有する理由 · 防御の dilemma · 他の攻撃との組み合わせ · 2025-2026 年の frontier model が実施する評価 · Phase 18 における位置づけ"
      },
      {
        "name": "ASCII Art & Visual Jailbreaks",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/14-ascii-art-visual-jailbreaks/",
        "summary": "Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, \"ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs\" (ACL 2024, arXiv:2402.11753)。有害リクエスト内の safety-relevan…",
        "keywords": "ArtPrompt の2ステップ · 標準 defense が失敗する理由 · ViTC benchmark · StructuralSleight · Image-modality analog · Phase 18 における位置づけ"
      },
      {
        "name": "Indirect Prompt Injection",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/15-indirect-prompt-injection/",
        "summary": "Indirect prompt injection (IPI) は、外部 content — web page、email、shared document、support ticket — の中に命令を埋め込み、agentic system が明示的な user action なしにそれを読むことで成立します。IPI は 2026 年の product…",
        "keywords": "3つの delivery vectors · user-input filters が見逃す理由 · AI のための Information Flow Control (IFC) · The Attacker Moves Second · 実際の incidents · OWASP と NIST の framing · Phase 18 における位置づけ"
      },
      {
        "name": "Red-Team Tooling: Garak, Llama Guard, PyRIT",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/16-red-team-tooling-garak-llamaguard-pyrit/",
        "summary": "2026 年の red-team stack は3つの production tools で整理できます。Llama Guard (Meta) — 14の MLCommons hazard categories で fine-tune された Llama-3.1-8B classifier。2025 年の Llama Guard 4 は、Llama 4…",
        "keywords": "Llama Guard (Meta) · Garak (NVIDIA) · PyRIT (Microsoft) · stack · evaluation pitfalls · Phase 18 における位置づけ"
      },
      {
        "name": "WMDP & Dual-Use Capability Evaluation",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/",
        "summary": "Li et al., \"The WMDP Benchmark: Measuring and Reducing Malicious Use With Unlearning\" (ICML 2024, arXiv:2403.03218)。biosecurity (1,520)、cybersecurity (2,225)、chemistry (412) にわた…",
        "keywords": "\"yellow zone\" · RMU — Representation Misdirection for Unlearning · 2024-2025 年の uplift narrative · Novice-relative vs expert-absolute · 測定上の落とし穴 · Phase 18 における位置づけ"
      },
      {
        "name": "Frontier Safety Frameworks — RSP, PF, FSF",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/",
        "summary": "3つの主要 lab framework が、2026 年の frontier capability に関する industry governance を定義しています。Anthropic Responsible Scaling Policy v3.0 (February 2026) は、biosafety levels をモデルにした tiered A…",
        "keywords": "Anthropic Responsible Scaling Policy v3.0 (February 2026) · OpenAI Preparedness Framework v2 (April 15, 2025) · DeepMind Frontier Safety Framework v3.0 (September 2025) · Cross-lab alignment · Safety cases · race-dynamic problem · Phase 18 における位置づけ"
      },
      {
        "name": "Model Welfare Research",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/19-model-welfare-research/",
        "summary": "Anthropic, \"Exploring Model Welfare\" (April 2025)。AI model welfare に関する初の major-lab formal research program。Kyle Fish を初の dedicated model-welfare researcher として採用しました。David Chal…",
        "keywords": "program · 4つの commitments · ship された intervention · \"spiritual bliss attractor\" · Eleos AI caveat · 知的な位置づけ · Phase 18 における位置づけ"
      },
      {
        "name": "Bias & Representational Harm",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/20-bias-representational-harm/",
        "summary": "Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Computational Linguistics 2024, arXiv:2309.00770)。representational harms (stereotypes、erasure) と allocationa…",
        "keywords": "Representational vs allocational · 3つの evaluation-metric categories (Gallegos et al. 2024) · Intersectionality · Mechanistic approaches · meta-critique · Phase 18 における位置づけ"
      },
      {
        "name": "Fairness Criteria: Group, Individual, Counterfactual",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/",
        "summary": "Fairness の文献は3つの family で整理できる。Group fairness: demographic parity、equalized odds、conditional use accuracy equality。平均的に protected group 間の rate を等しくする。Individual fairness (Dwork…",
        "keywords": "Group fairness · Individual fairness · Counterfactual fairness · CF-vs-accuracy trade-off · Backtracking counterfactuals · Philosophical reconciliation · Where this fits in Phase 18"
      },
      {
        "name": "Differential Privacy for LLMs",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/",
        "summary": "DP-SGD は依然として standard である。noise を注入した gradient update が形式的な (epsilon, delta) guarantee を与える。compute、memory、utility の overhead は大きい。parameter-efficient な DP fine-tuning (LoRA + …",
        "keywords": "(ε, δ)-differential privacy · DP-SGD · LoRA + DP-SGD · The 2024-2025 tension · Alternatives to DP training · Differential Privacy Reversal via LLM Feedback · Where this fits in Phase 18"
      },
      {
        "name": "Watermarking: SynthID, Stable Signature, C2PA",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/",
        "summary": "2026年の AI-generated-content provenance は3つの technology で整理できる。SynthID (Google DeepMind) — image watermarking は 2023年8月に開始、text+video は 2024年5月 (Gemini + Veo)、text は 2024年10月に Re…",
        "keywords": "Text watermarking (SynthID-text style) · Stable Signature (image) · SynthID unified detector (November 2025) · C2PA · Limitations · EU AI Act Article 50 · Where this fits in Phase 18"
      },
      {
        "name": "Regulatory Frameworks: EU, US, UK, Korea",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/",
        "summary": "2026年の AI governance landscape は4つの主要な regulatory regime で定義される。EU AI Act (2024年8月1日 in force) — prohibited practices と AI literacy は 2025年2月2日から、GPAI obligations は 2025年8月2日から、…",
        "keywords": "EU AI Act · GPAI Code of Practice · Transparency Code for Article 50 · UK AI Security Institute (February 2025) · US CAISI (June 2025) · Korean AI Framework Act · Cross-jurisdiction dynamics · Where this fits in Phase 18"
      },
      {
        "name": "EchoLeak & CVEs for AI",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/",
        "summary": "CVE-2025-32711 \"EchoLeak\" (CVSS 9.3) は、production LLM system (Microsoft 365 Copilot) における初の publicly documented zero-click prompt injection だった。Aim Labs (Aim Security) が発見し、MSRC…",
        "keywords": "The EchoLeak attack chain · Aim Labs' term: LLM Scope Violation · CamoLeak (CVSS 9.6, GitHub Copilot Chat) · CVE-2025-53773 (GitHub Copilot RCE) · Severity calibration · NIST and OWASP positions · Where this fits in Phase 18"
      },
      {
        "name": "Model, System & Dataset Cards",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/26-model-system-dataset-cards/",
        "summary": "AI transparency は3つの documentation format で整理される。Model Cards (Mitchell et al. 2019) — models の nutrition labels: training data、quantitative disaggregated analyses、ethical consid…",
        "keywords": "Model Cards (Mitchell et al. 2019) · Datasheets for Datasets (Gebru et al. 2018) · Data Cards (Pushkarna et al., Google 2022) · System Cards · 2024-2025 developments · Where this fits in Phase 18"
      },
      {
        "name": "Data Provenance & Training-Data Governance",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/27-data-provenance-training-governance/",
        "summary": "EU AI Act は GPAI について 2025年8月までに machine-readable opt-out standards を要求する (EU Copyright Directive TDM exception 経由)。California AB 2013 (2024年 signed) — Generative AI training-da…",
        "keywords": "California AB 2013 · EU AI Act (Lesson 24) and TDM opt-out · 2025 DPA convergence on legitimate interest · Brazilian ANPD (June 2024) · The irreversibility problem · Data Provenance Initiative · Where this fits in Phase 18"
      },
      {
        "name": "Alignment Research Ecosystem: MATS, Redwood, Apollo, METR",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/",
        "summary": "2026年の non-lab alignment research layer は5つの organisations で定義される。MATS (ML Alignment & Theory Scholars): 2021年後半以降 527+ researchers、180+ papers、10K+ citations、h-index 47。2024年 s…",
        "keywords": "MATS (ML Alignment & Theory Scholars) · Redwood Research · Apollo Research · METR (Model Evaluation and Threat Research) · Eleos AI Research · The flow · Why this layer matters · Where this fits in Phase 18"
      },
      {
        "name": "Moderation Systems: OpenAI, Perspective, Llama Guard",
        "status": "complete",
        "type": "Build",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/",
        "summary": "Production moderation systems は Lessons 12-16 で定義した safety policies を operationalize する。OpenAI Moderation API: `omni-moderation-latest` (2024) は GPT-4o ベースで text + images を1 cal…",
        "keywords": "OpenAI Moderation API · Llama Guard 3/4 · Perspective API (Google Jigsaw) · The three-layer pattern · Failure modes · Azure deprecation · Where this fits in Phase 18"
      },
      {
        "name": "Dual-Use Risk: Cyber, Bio, Chem, Nuclear",
        "status": "complete",
        "type": "Learn",
        "lang": "Python",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/",
        "summary": "2026年の dual-use picture を domain ごとに見る。Bio/chem: Lesson 17 は WMDP を扱う。Anthropic の bioweapon-acquisition trial (2.53x uplift) と OpenAI の 2025年4月 Preparedness Framework v2 warning…",
        "keywords": "Bio/chem uplift narrative · Chem/bio execution-gap erosion · Cyber uplift (November 2025) · Nuclear · Novice-relative vs expert-absolute · Cross-domain synthesis · Where this fits in Phase 18"
      }
    ]
  },
  {
    "id": 19,
    "name": "総仕上げプロジェクト",
    "status": "complete",
    "desc": "17 個の end-to-end product + 4 個の deep-build track。各 project 20-40 時間、各 track 4-12 レッスン。",
    "lessons": [
      {
        "name": "Terminal-Native Coding Agent",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P0 P5 P7 P10 P11 P13 P14 P15 P17 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/01-terminal-native-coding-agent/",
        "summary": "2026年には coding agent の形はほぼ固まっています。TUI harness、状態を持つ plan、sandbox 化された tool surface、plan / act / observe / recover の loop。Claude Code、Cursor 3、OpenCode は遠目には同じ形に見えます。この capstone …"
      },
      {
        "name": "RAG over Codebase (Cross-Repo Semantic Search)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P5 P7 P11 P13 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/02-rag-over-codebase/",
        "summary": "2026年の本気の engineering org は、文字列だけでなく意味を理解する internal code search を持っています。Sourcegraph Amp、Cursor の codebase answers、Augment の enterprise graph、Aider の repomap、Pinterest の interna…"
      },
      {
        "name": "Real-Time Voice Assistant (ASR → LLM → TTS)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P6 P7 P11 P13 P14 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/03-realtime-voice-assistant/",
        "summary": "自然に感じる voice agent は end-to-end latency が 800ms 未満で、user が話し終えたタイミングを理解し、barge-in を処理し、tool call でも止まりません。Retell、Vapi、LiveKit Agents、Pipecat は2026年にこの基準へ到達しています。仕組みは同じです: stream…"
      },
      {
        "name": "Multimodal Document QA (Vision-First)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P4 P5 P7 P11 P12 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/04-multimodal-document-qa/",
        "summary": "2026年の document-QA frontier は、OCR-then-text から vision-first late interaction へ移りました。ColPali、ColQwen2.5、ColQwen3-omni は PDF page を image として扱い、multi-vector late interaction で emb…"
      },
      {
        "name": "Autonomous Research Agent (AI-Scientist Class)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P0 P2 P3 P7 P10 P14 P15 P16 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/05-autonomous-research-agent/",
        "summary": "Sakana の AI-Scientist-v2 は full paper を公開しました。Agent Laboratory は experiment を実行しました。Allen AI は trace を共有しました。2026年の形は、experiment 上の plan-execute-verify tree search、budgeted cost…"
      },
      {
        "name": "DevOps Troubleshooting Agent for Kubernetes",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P11 P13 P14 P15 P17 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/06-devops-troubleshooting-agent/",
        "summary": "AWS の DevOps Agent は GA になり、Resolve AI は K8s playbook を公開し、NeuBird は semantic monitoring を demo し、Metoro は AI SRE を per-service SLO に結び付けました。production の形は固まっています。alert webhook …"
      },
      {
        "name": "End-to-End Fine-Tuning Pipeline",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P2 P3 P7 P10 P11 P17 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/",
        "summary": "自分たちの data で train され、自分たちの preference で DPO-aligned され、quantize され、speculative decode され、測定可能な $/1M tokens で serve される 8B model。2026年の open stack は Axolotl v0.8、TRL 0.15、iterat…"
      },
      {
        "name": "Production RAG Chatbot (Regulated Vertical)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P5 P7 P11 P12 P17 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/08-production-rag-chatbot/",
        "summary": "Harvey、Glean、Mendable、LlamaCloud は2026年に同じ production shape を走らせています。docling または Unstructured で ingest し、visual は ColPali。hybrid search。bge-reranker-v2-gemma で re-rank。prompt ca…"
      },
      {
        "name": "Code Migration Agent (Repo-Level Upgrade)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P5 P7 P11 P13 P14 P15 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/09-code-migration-agent/",
        "summary": "Amazon の MigrationBench (Java 8 から17) と Google の App Engine Py2-to-Py3 migrator が2026年の基準を作りました。Moderne の OpenRewrite は deterministic AST rewrite を大規模に行います。Grit も codemod-style …"
      },
      {
        "name": "Multi-Agent Software Engineering Team",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P11 P13 P14 P15 P16 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/10-multi-agent-software-team/",
        "summary": "SWE-AF の factory architecture、MetaGPT の role-based prompting、AutoGen 0.4 の typed actor graph、Cognition の Devin、Factory の Droids は、2026年に同じ形へ収束しました。architect が plan し、N 人の coder …"
      },
      {
        "name": "LLM Observability & Eval Dashboard",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P11 P13 P17 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/11-llm-observability-dashboard/",
        "summary": "Langfuse は open-core 化し、Arize Phoenix は 2026 年版の GenAI semantic convention マッピングを公開した。Helicone と Braintrust は、ユーザー単位のコスト帰属をさらに重視する方向へ進んだ。Traceloop の OpenLLMetry は、SDK 計装の事実上の標準に…"
      },
      {
        "name": "Video Understanding Pipeline (Scene → QA)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P4 P6 P7 P11 P12 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/12-video-understanding-pipeline/",
        "summary": "Twelve Labs は Marengo + Pegasus を productize した。VideoDB は CRUD-for-video API を出した。AI2 の Molmo 2 は open VLM checkpoint を公開した。Gemini の long-context は数時間の video を native に扱える。TimeL…"
      },
      {
        "name": "MCP Server with Registry and Governance",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P11 P13 P14 P17 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/13-mcp-server-with-registry/",
        "summary": "Model Context Protocol は未来の仕様ではなく、2026 年には default の tool-use spec になった。Anthropic、OpenAI、Google、主要 IDE は MCP client を提供している。Pinterest は内部 MCP server ecosystem を公開した。AAIF Registr…"
      },
      {
        "name": "Speculative-Decoding Inference Server",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P3 P7 P10 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/14-speculative-decoding-server/",
        "summary": "vLLM 0.7 の EAGLE-3 は real traffic で 2.5-3x throughput を出す。P-EAGLE (AWS 2026) は parallel speculation をさらに進めた。SGLang の SpecForge は draft head を大規模に学習した。Red Hat の Speculators hub は…"
      },
      {
        "name": "Constitutional Safety Harness + Red-Team Range",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P10 P11 P13 P14 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/15-constitutional-safety-harness/",
        "summary": "Anthropic の Constitutional Classifiers、Meta の Llama Guard 4、Google の ShieldGemma-2、NVIDIA の Nemotron 3 Content Safety、多言語 coverage 用の X-Guard が 2026 年の safety-classifier stack を…"
      },
      {
        "name": "GitHub Issue-to-PR Autonomous Agent",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P11 P13 P14 P15 P17",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/16-github-issue-to-pr-agent/",
        "summary": "AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules は、どれも同じ 2026 年の product shape を提供している: issue に label を付けると PR が出る。Cloud sandbox で agent を走らせ、test …"
      },
      {
        "name": "Personal AI Tutor (Adaptive, Multimodal)",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "P5 P6 P11 P12 P14 P17 P18",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/17-personal-ai-tutor/",
        "summary": "Khanmigo (Khan Academy)、Duolingo Max、Google LearnLM / Gemini for Education、Quizlet Q-Chat、Synthesis Tutor は、2026 年に adaptive multimodal tutoring を大規模に提供した。共通する形は、Socratic policy…"
      },
      {
        "name": "Agent Harness Loop Contract",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/20-agent-harness-loop-contract/",
        "summary": "Harness こそが agent である。Model は coprocessor である。この lesson では、任意の model を差し込める loop contract を固定する。"
      },
      {
        "name": "Tool Registry with Schema Validation",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/21-tool-registry-schema-validation/",
        "summary": "エージェントが検証できない tool は、エージェントが呼び出せない tool です。tool 本体を作る前に、registry と schema checker を作ります。"
      },
      {
        "name": "JSON-RPC 2.0 Over Newline-Delimited Stdio",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/22-jsonrpc-stdio-transport/",
        "summary": "model client と tool server の間の transport は、stdio 上の JSON-RPC です。一度 hand-roll すると、あらゆる framing layer が何にコストを払っているのかが見えます。"
      },
      {
        "name": "Function Call Dispatcher",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/23-function-call-dispatcher/",
        "summary": "dispatcher は、schema が約束したすべてのことに harness が支払いをする場所です。timeout、retry、dedupe、error mapping。すべてを 1 つの境界に集めます。"
      },
      {
        "name": "Plan-Execute Control Flow",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/24-plan-execute-control-flow/",
        "summary": "失敗に耐えられない plan は script です。replan できる script が agent です。まず replanner を作ります。"
      },
      {
        "name": "Verification Gates and Observation Budget",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/25-verification-gates-observation-budget/",
        "summary": "verification layer のない agent harness は、根拠のない願いです。この lesson では deterministic な gate chain を作り、tool call を実行してよいか、agent が output のどれだけを見てよいか、agent が読みすぎたため loop を止めるべきかを判断します。chai…"
      },
      {
        "name": "Sandbox Runner with Denylist and Path Jail",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/26-sandbox-runner-denylist/",
        "summary": "verification gate は tool call を実行してよいかを決めます。sandbox は、実行する場合に何が起きるかを決めます。この lesson では subprocess runner を出荷します。危険な executable、危険な argv shape を拒否し、すべての file path を project root に…"
      },
      {
        "name": "Eval Harness with Fixture Tasks",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/27-eval-harness-fixture-tasks/",
        "summary": "coding agent の質は、それを測る task suite の質で決まります。この lesson では fixture task の folder を受け取り、各 task を candidate agent に通し、deterministic verifier で pass/fail を採点し、pass@1、pass@k、mean laten…"
      },
      {
        "name": "Observability with OTel GenAI Spans and Prometheus Metrics",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/28-observability-otel-traces/",
        "summary": "observability のない agent harness は、費用のかかる black box です。この lesson では OpenTelemetry GenAI semantic conventions に準拠した record を emit する span builder を hand-roll し、1 span 1 line の JSO…"
      },
      {
        "name": "End-to-End Coding Agent on the Harness",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "A. Agent harness",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/29-end-to-end-coding-task-demo/",
        "summary": "Track A の payoff です。この lesson は gate chain、sandbox、eval harness、OTel spans を 1 つの working coding agent に縫い合わせ、multi-file Python project 内の実際の小さな fixture-scale bug を直します。agent は …"
      },
      {
        "name": "BPE Tokenizer From Scratch",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/",
        "summary": "bytes を入れて ids を出し、その ids から同じ bytes に戻します。modern text model が今でも出発点にしている tokenizer を作ります。"
      },
      {
        "name": "Tokenized Dataset with Sliding Window",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/31-tokenized-dataset-sliding-window/",
        "summary": "事前学習は token id から勾配への関数です。このレッスンでは、その id をモデルへ供給するコンベヤを作ります。"
      },
      {
        "name": "Token and Positional Embeddings",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/32-token-positional-embeddings/",
        "summary": "id は整数ですが、モデルが扱うのはベクトルです。token embedding と positional embedding の2つの lookup table が、その橋渡しをします。"
      },
      {
        "name": "Multi-Head Self-Attention",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/33-multihead-self-attention/",
        "summary": "1つの線形射影から Q/K/V を作り、H 個の head を並列に走らせ、causal mask で未来を隠します。"
      },
      {
        "name": "Transformer Block from Scratch",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/34-transformer-block/",
        "summary": "現代の decoder LLM の基本単位は、LayerNorm、multi-head causal attention、residual、MLP、residual です。このレッスンでは pre-LN と post-LN を並べて実装します。"
      },
      {
        "name": "GPT Model Assembly",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/35-gpt-model-assembly/",
        "summary": "token embedding、learned position embedding、12個の block、final LayerNorm、重み共有された LM head を組み合わせると、124M parameter の GPT-2 small 形状になります。"
      },
      {
        "name": "Training Loop and Evaluation",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/36-training-loop-eval/",
        "summary": "測らない training loop は信用できません。このレッスンでは GPT を学習する loop、評価、sample 生成、JSONL logging を作ります。"
      },
      {
        "name": "Loading Pretrained Weights",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/37-loading-pretrained-weights/",
        "summary": "124M model をゼロから学習するのは予算の問題ですが、公開 checkpoint を読むのは実装の問題です。このレッスンでは safetensors から GPT-2 形式の重みを読み込みます。"
      },
      {
        "name": "Classifier Fine-Tuning by Head Swap",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/38-classifier-finetuning/",
        "summary": "pretrained language model は token prediction head で終わります。spam/ham 分類には head が違うため、body を再利用し、2-class classifier head に差し替えます。"
      },
      {
        "name": "Instruction Tuning by Supervised Fine-Tuning",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/39-instruction-tuning-sft/",
        "summary": "base model は文章を続けられますが、指示に従う形式は知りません。SFT は instruction と望ましい response のペアで、response token だけを loss に数える学習です。"
      },
      {
        "name": "Direct Preference Optimization from Scratch",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/40-dpo-from-scratch/",
        "summary": "DPO は reward model と PPO を使わず、preference pair から policy を直接 fitting する supervised loss です。"
      },
      {
        "name": "Full Evaluation Pipeline",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "B. NLP LLM",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/41-eval-pipeline/",
        "summary": "Training は loss curve で見えるが、evaluation は設計しなければ見えない。このレッスンでは、学習済み言語モデルに対して 4 種類の異なる評価を実行し、タスク別の結果と集約スコアを出す eval pipeline を 1 ファイルで作る。ネットワークなしで動く mock LLM-as-judge も同梱する。"
      },
      {
        "name": "Large Corpus Downloader",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/42-large-corpus-downloader/",
        "summary": "言語モデル学習は最初の forward pass より前に始まる。corpus は disk に置かれ、展開され、重複排除され、途中失敗から resume できなければならない。このレッスンでは compressed shard を streaming download し、Zstandard で逐次展開し、MinHash + LSH で near-d…"
      },
      {
        "name": "HDF5 Tokenized Corpus",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/43-hdf5-tokenized-corpus/",
        "summary": "Download した corpus は、trainer が線形速度で読める layout に変換する必要がある。このレッスンでは JSONL 文書を token 化し、resizable かつ chunked な HDF5 shard に書き込み、memory-mapped read と sliding-window dataloader を作る。"
      },
      {
        "name": "Cosine LR with Linear Warmup",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/44-cosine-lr-warmup/",
        "summary": "学習率 schedule は optimizer の実効 step size を決める。最初は小さく立ち上げ、安定した後に cosine decay で下げる。このレッスンでは stateless な schedule 関数、AdamW への接続、gradient norm logging を実装する。"
      },
      {
        "name": "Gradient Clipping and Mixed Precision",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/45-gradient-clipping-amp/",
        "summary": "Mixed precision は速いが overflow を起こす。Gradient clipping は悪い batch の巨大な update を抑える。このレッスンでは global L2 clipping、GradScaler の順序、skip rate logging を 1 step の training loop にまとめる。"
      },
      {
        "name": "Gradient Accumulation",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/46-gradient-accumulation/",
        "summary": "effective batch size は `micro_batch * accum_steps` で表せる。device memory に入らない batch は、複数の micro batch の gradient を同じ buffer に足し、最後に 1 回だけ optimizer step すればよい。"
      },
      {
        "name": "Checkpoint Save and Resume",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/47-checkpoint-save-resume/",
        "summary": "checkpoint は model weights だけではない。optimizer、scheduler、step counter、loss history、RNG state まで保存して初めて、kill された training run が同じ軌跡で resume できる。"
      },
      {
        "name": "Distributed Data Parallel and FSDP from Scratch",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/48-distributed-fsdp-ddp/",
        "summary": "Multi-rank training は 2 つの collective と 1 つの規則で始まる。起動時に parameter を broadcast し、backward 後に gradient を平均し、rank 同士が step をずらさない。"
      },
      {
        "name": "Language Model Evaluation Harness",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "C. Train end-to-end",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/49-lm-eval-harness/",
        "summary": "定義できない task でよく見える model は、偶然よく見えているだけである。harness は task definition、metric、runner、leaderboard を小さく差し替え可能な形にまとめる。"
      },
      {
        "name": "Hypothesis Generator",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/50-hypothesis-generator/",
        "summary": "同じ問いを二度たずねる研究エージェントはトークンを無駄にしています。重要なのは、各ドラフトを前回とは違う場所に着地させることです。"
      },
      {
        "name": "Literature Retrieval",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/51-literature-retrieval/",
        "summary": "仮説を作るのは安いです。誰かがすでに証明していないかを知る部分が高くつきます。runner が sandbox を起動する前に、その問いへ答える retrieval layer を作ります。"
      },
      {
        "name": "Experiment Runner",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/52-experiment-runner/",
        "summary": "研究ループの誠実さは測定の誠実さで決まります。spec を受け取り、sandboxed subprocess で実行し、evaluator が信頼できる JSON metrics blob を出力する runner を作ります。"
      },
      {
        "name": "Result Evaluator",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/53-result-evaluator/",
        "summary": "runner は数値を出しました。evaluator は、その数値が改善なのか、劣化なのか、ノイズなのかを判定します。metrics を一行の結論へ変える verdict path を作ります。"
      },
      {
        "name": "Paper Writer",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/54-paper-writer/",
        "summary": "LaTeX skeleton は研究者と typesetter の contract です。contract が壊れていれば document は compile されず、失敗は大きく見えます。まず skeleton を作り、それから埋めます。"
      },
      {
        "name": "Critic Loop",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/55-critic-loop/",
        "summary": "最初から \"looks good\" と返す critic は壊れています。いつも \"needs work\" と返す critic も壊れています。面白い critic は収束する critic であり、その収束は設計しなければなりません。"
      },
      {
        "name": "Iteration Scheduler",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/56-iteration-scheduler/",
        "summary": "scheduler のない研究ループは、ただの worklist です。何を探索し続け、何を止めるかを決める場所が scheduler であり、その判断が全体の勝負を決めます。"
      },
      {
        "name": "End-to-End Research Demo",
        "status": "complete",
        "type": "Capstone",
        "lang": "Python",
        "combines": "D. Auto research",
        "url": "https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/19-capstone-projects/57-end-to-end-research-demo/",
        "summary": "demo は、これまで書いたすべての contract が合成できるかを試す場所です。一つでも漏れがあれば、この lesson がそれを見つけます。"
      }
    ]
  }
];

const GLOSSARY = [
  {
    "term": "Agent",
    "says": "自律的に考えて行動するAI",
    "means": "LLMが次にどのツールを呼ぶかを決め、実行し、結果を見て、また繰り返す while ループ"
  },
  {
    "term": "Attention",
    "says": "AIが重要な部分に注目する仕組み",
    "means": "各トークンが、他のすべてのトークンの value の重み付き和を計算する仕組みです。重みは query ベクトルと key ベクトルのドット積で測った関連度によって決まります。"
  },
  {
    "term": "Alignment",
    "says": "AIを安全にすること",
    "means": "AIシステムの振る舞いを、人間の意図、価値観、好みに合わせるための技術的課題です。設計者が想定していなかったエッジケースも含みます。"
  },
  {
    "term": "Autoregressive",
    "says": "AIが単語を1つずつ生成すること",
    "means": "それまでの全トークンを条件に次のトークンを予測し、その予測を次のステップの入力として戻すモデルです。GPT、LLaMA、Claudeはいずれも autoregressive です。"
  },
  {
    "term": "Activation Function",
    "says": "層の間にある非線形なもの",
    "means": "各線形層の後に適用して非線形性を入れる関数です。これがないと、線形層を何層重ねても1つの線形変換に畳み込めてしまいます。よく使われるのは ReLU、GELU、SiLU です。どれを選ぶかは、学習中に勾配が流れるかどうかに直接影響します。"
  },
  {
    "term": "Adam (Optimizer)",
    "says": "デフォルトの optimizer",
    "means": "Adaptive Moment Estimation の略です。momentum（一次モーメント）と、パラメータごとの適応的な learning rate（二次モーメント）を組み合わせます。初期ステップ向けのバイアス補正もあります。多くのタスクで、細かい調整なしにうまく機能します。"
  },
  {
    "term": "AdamW",
    "says": "Adamの改良版",
    "means": "weight decay を Adam から分離したものです。標準の Adam では、L2正則化がパラメータごとの適応的 learning rate でスケーリングされますが、これは望ましい挙動ではありません。AdamW は勾配統計とは独立に、重みに直接 weight decay を適用します。Transformer の学習でよく使われるデフォルトの optimizer です。"
  },
  {
    "term": "Autograd",
    "says": "自動で勾配を計算する仕組み",
    "means": "テンソルに対する演算を記録し、reverse-mode differentiation によって勾配を自動計算するシステムです。PyTorch の autograd はその場で計算グラフを構築する dynamic graph 方式で、JAX は関数変換（grad）を使います。これにより backpropagation が実用的になります。開発者は forward pass を書けば、フレームワークがすべての微分を計算します。"
  },
  {
    "term": "Batch Size",
    "says": "一度に処理するサンプル数",
    "means": "重みを更新する前に、1回の forward/backward pass で処理する学習サンプルの数です。大きな batch は勾配推定を安定させますが、メモリを多く使います。典型値は学習で32〜512、推論ではさらに大きめです。batch size は learning rate と相互作用します。batch を2倍にしたら LR も2倍にする、という linear scaling rule があります。"
  },
  {
    "term": "Backpropagation",
    "says": "ニューラルネットワークが学習する方法",
    "means": "chain rule をネットワークの後ろ向きに適用し、各重みが誤差にどれだけ寄与したかを計算して、その大きさに応じて重みを調整するアルゴリズムです。"
  },
  {
    "term": "Context Window",
    "says": "AIが覚えていられる量",
    "means": "1回のAPI呼び出しに入るトークン数（入力 + 出力）の上限です。記憶ではありません。呼び出しごとにリセットされる固定サイズのバッファです。"
  },
  {
    "term": "Chain of Thought (CoT)",
    "says": "AIにステップごとに考えさせること",
    "means": "モデルに推論手順を示すよう促す prompting technique です。各ステップが次のトークン生成の条件になるため、多段階の問題で精度が上がることがあります。"
  },
  {
    "term": "CNN (Convolutional Neural Network)",
    "says": "画像AI",
    "means": "畳み込み演算（入力上をスライドするフィルタ）を使って局所的なパターンを検出するニューラルネットワークです。畳み込みを重ねると、エッジ、テクスチャ、物体のように、より複雑な特徴を検出できます。"
  },
  {
    "term": "CUDA",
    "says": "GPUプログラミング",
    "means": "NVIDIAの並列計算プラットフォームです。数千のGPUコアで行列演算を同時に実行できます。PyTorch や TensorFlow は内部で CUDA を使っています。"
  },
  {
    "term": "Chunking",
    "says": "文書を細かく分割すること",
    "means": "検索用に embedding する前に、テキストを複数のセグメントへ分けることです。chunk size は検索結果の粒度を決めます。小さすぎると文脈が失われ、大きすぎると関連性が薄まります。よくある方法は、overlap 付きの固定長分割、文単位の分割、意味単位の分割です。典型的な chunk size は256〜512トークンで、10〜20%の overlap を持たせます。"
  },
  {
    "term": "Contrastive Learning",
    "says": "比較によって学習すること",
    "means": "embedding 空間で、似ているペアを近づけ、似ていないペアを遠ざけるように学習します。CLIP はこの方法を使い、対応する画像・テキストのペアと、対応しないペアを対比します。"
  },
  {
    "term": "Cosine Similarity",
    "says": "2つのベクトルがどれだけ似ているか",
    "means": "2つのベクトルのなす角の cosine です: dot(a, b) / (||a|| * ||b||)。範囲は -1（反対方向）から 1（同じ方向）です。大きさは無視し、方向だけを見ます。embedding や semantic search で標準的に使われる類似度指標です。"
  },
  {
    "term": "Cross-Entropy",
    "says": "分類で使う loss",
    "means": "2つの確率分布の差を測ります。分類では -sum(y_true * log(y_pred)) です。言語モデルでは、正しい次トークンの負の対数確率を意味します。低いほど良く、perplexity は exp(cross-entropy) にすぎません。"
  },
  {
    "term": "Data Augmentation",
    "says": "学習データを増やすこと",
    "means": "既存データの変更版（画像の回転、ノイズ追加、文章の言い換えなど）を作り、新しいデータを収集せずに training set の多様性を増やすことです。overfitting を減らします。"
  },
  {
    "term": "Decoder",
    "says": "出力側の部分",
    "means": "Transformer では、decoder は causal（masked）self-attention を使うため、各位置はそれ以前の位置にしか attention できません。GPT は decoder-only、BERT は encoder-only、T5 は encoder-decoder です。"
  },
  {
    "term": "Diffusion Model",
    "says": "ノイズから画像を生成するAI",
    "means": "徐々にノイズを加える過程を逆向きにたどるよう学習したモデルです。ノイズを予測して取り除くことを学び、生成時には純粋なノイズから始めて反復的に denoise します。"
  },
  {
    "term": "DPO (Direct Preference Optimization)",
    "says": "よりシンプルな RLHF",
    "means": "reward model を完全に省略する学習方法です。人間の選好ペアのうち、より良い応答を選ぶように language model を直接最適化します。"
  },
  {
    "term": "Dropout",
    "says": "ニューロンをランダムにオフにすること",
    "means": "学習中に activation の一部をランダムにゼロにします。ネットワークが特定のニューロンだけに依存しないようにします。推論時には無効化されます。単純ですが効果的な regularization です。"
  },
  {
    "term": "Eigenvalue",
    "says": "PCAで出てくる数学の何か",
    "means": "行列 A について、あるベクトル v に対して Av = lambda*v を満たす lambda が固有値です。その方向のベクトルを行列がどれだけスケールするかを表します。大きな固有値は、データの分散が大きい方向を意味します。"
  },
  {
    "term": "Embedding",
    "says": "単語を数値に変えるAIの魔法",
    "means": "離散的な項目（単語、画像、ユーザーなど）を連続空間上の dense vector に写す、学習済みの写像です。似ている項目は近くに配置されます。"
  },
  {
    "term": "Encoder",
    "says": "入力側の部分",
    "means": "Transformer では、encoder は bidirectional self-attention を使うため、各位置がすべての位置に attention できます。BERT は encoder-only です。分類や NER のような理解タスクには向いていますが、生成には向きません。"
  },
  {
    "term": "Epoch",
    "says": "データを一周すること",
    "means": "その通りです。training set の全サンプルを1回すべて見ることです。複数 epochs とは、同じデータを複数回見ることを意味します。epoch を増やすと学習が進むことがありますが、overfitting のリスクもあります。"
  },
  {
    "term": "Feature",
    "says": "データの列",
    "means": "データが持つ、個別に測定できる性質です。古典的なMLでは feature を手作業で設計します。deep learning では、ネットワークが raw data から feature を自動的に学習します。"
  },
  {
    "term": "Few-Shot",
    "says": "先にAIへいくつか例を渡すこと",
    "means": "モデルにタスクを実行させる前に、少数の入力・出力例を prompt に含めることです。典型的には3〜5例です。モデルはそれらの例からパターンを照合し、望ましい形式や振る舞いを理解します。zero-shot（例なし）や fine-tuning（何千もの例を重みに焼き込む）と対比されます。"
  },
  {
    "term": "Fine-tuning",
    "says": "自分のデータでAIを学習させること",
    "means": "事前学習済みモデルの重みから始め、より小さなタスク固有の dataset で学習を続けることです。既存の重みを更新するだけで、新しい知識をゼロから追加するわけではありません。"
  },
  {
    "term": "Function Calling",
    "says": "ツールを使えるAI",
    "means": "LLMが外部関数の実行を要求するための構造化された方法です。JSON Schema の説明付きでツールを定義すると、モデルはどの関数をどの引数で呼ぶかを示す構造化 JSON object を出力します。コードがそれを実行し、結果をモデルに返します。agents とは同じではありません。function calling は仕組みで、agents はループです。"
  },
  {
    "term": "Guardrails",
    "says": "AIの安全フィルタ",
    "means": "LLMの周囲に置く入力・出力の検証レイヤーです。有害コンテンツ、prompt injection の試み、PII漏えい、トピック外の応答を検出してブロックします。典型的には input filter -> LLM -> output filter という pipeline です。ルールベース（regex、キーワードリスト）でも、モデルベース（安全性をスコアリングする classifier）でも実装できます。"
  },
  {
    "term": "GPT",
    "says": "ChatGPT」または「AIそのもの",
    "means": "Generative Pre-trained Transformer の略です。大規模テキストコーパスで学習した decoder-only transformer を使い、次のトークンを予測する特定のアーキテクチャです。"
  },
  {
    "term": "GAN (Generative Adversarial Network)",
    "says": "2つのAIが戦っている",
    "means": "generator network は本物らしいデータを作ろうとし、discriminator network は本物と偽物を見分けようとします。両者は一緒に学習します。generator は discriminator をだますのが上手くなり、discriminator は偽物を見抜くのが上手くなります。"
  },
  {
    "term": "Gradient",
    "says": "傾き",
    "means": "最も急に増加する方向を指す偏微分のベクトルです。MLでは loss を最小化するため、gradient とは反対方向へ進みます（gradient descent）。"
  },
  {
    "term": "Gradient Descent",
    "says": "AIが改善していく方法",
    "means": "高次元の地形を坂道に沿って下るように、loss function を最も急に小さくする方向へパラメータを調整する最適化アルゴリズムです。"
  },
  {
    "term": "Hyperparameter",
    "says": "調整する設定値",
    "means": "学習前に設定し、学習プロセスそのものを制御する値です。learning rate、batch size、層数、dropout rate などがあります。model parameters（重み）とは違い、データから学習されるものではありません。"
  },
  {
    "term": "Hallucination",
    "says": "AIが嘘をついている」または「作り話をしている",
    "means": "モデルが、学習データや与えられた context に根拠のない、もっともらしい文章を生成することです。事実を取り出しているのではなく、パターンを補完しています。"
  },
  {
    "term": "Inference",
    "says": "AIを実行すること",
    "means": "学習済みモデルを使って新しいデータに対する予測を行うことです。重みの更新は起きません。本番環境で行うのはこれです。入力を送り、出力を受け取ります。"
  },
  {
    "term": "Inductive Bias",
    "says": "聞いたことがない",
    "means": "モデルのアーキテクチャに組み込まれた仮定です。CNN は局所パターンが重要だと仮定します（convolution）。RNN は順序が重要だと仮定します（sequential processing）。Transformers は、あらゆるものがあらゆるものと関係しうると仮定します（attention）。適切な bias は、少ないデータからより速く学習する助けになります。"
  },
  {
    "term": "JAX",
    "says": "GoogleのML framework",
    "means": "NumPy互換のライブラリに、automatic differentiation（grad）、JIT compilation（jit）、automatic vectorization（vmap）、multi-device parallelism（pmap）を加えたものです。PyTorch のオブジェクト指向スタイルとは異なり、JAX は純粋関数型です。隠れた状態や in-place mutation がありません。Google DeepMind で AlphaFold、Gemini、大規模研究に使われています。"
  },
  {
    "term": "KV Cache",
    "says": "推論を速くするもの",
    "means": "autoregressive 生成中に、過去トークンの key 行列と value 行列をキャッシュし、各ステップで再計算しないようにする仕組みです。メモリと引き換えに速度を得ます。高速な LLM inference には不可欠です。"
  },
  {
    "term": "Latent Space",
    "says": "隠れた表現",
    "means": "似た入力が近い点に写される、圧縮された学習済み表現空間です。Autoencoders、VAEs、diffusion models はいずれも latent space で動作します。入力より低次元ですが、重要な構造を捉えます。"
  },
  {
    "term": "Learning Rate",
    "says": "AIが学習する速さ",
    "means": "gradient descent におけるステップ幅を制御するスカラーです。高すぎると最小値を飛び越えて発散します。低すぎると収束が遅すぎたり、途中で止まったりします。最も重要な hyperparameter です。"
  },
  {
    "term": "LLM (Large Language Model)",
    "says": "AI」または「頭脳",
    "means": "数十億規模の parameters を持ち、インターネット規模のテキストデータで、系列内の次トークンを予測するよう学習された transformer-based neural network です。"
  },
  {
    "term": "LoRA (Low-Rank Adaptation)",
    "says": "効率的な fine-tuning",
    "means": "すべての重みを更新する代わりに、元の重みの横に小さな low-rank matrices を挿入します。学習するのはこの小さな行列だけなので、メモリ使用量を10〜100倍削減できます。"
  },
  {
    "term": "Loss Function",
    "says": "AIがどれだけ間違っているか",
    "means": "予測出力と実際の出力の差を測る関数です。学習ではこの関数を最小化します。回帰には MSE、分類には cross-entropy、embeddings には contrastive loss を使います。どの loss function を選ぶかが、モデルにとっての「良さ」を定義します。"
  },
  {
    "term": "Mixed Precision",
    "says": "高速化のための学習テクニック",
    "means": "forward pass と多くの演算では float16 を使い（高速で省メモリ）、gradient accumulation と weight update では float32 を維持します（より高精度）。精度低下をほとんど起こさずに約2倍高速化できます。"
  },
  {
    "term": "MoE (Mixture of Experts)",
    "says": "モデルの一部だけが動く仕組み",
    "means": "多数の \"expert\" subnetwork を持ち、routing mechanism が各入力を少数の experts にだけ送るモデルです。モデル全体は巨大ですが、多くの experts をスキップするため、各 forward pass は軽くなります。Mixtral と GPT-4 はこれを使っています。"
  },
  {
    "term": "MCP (Model Context Protocol)",
    "says": "AIがツールを使うための方法",
    "means": "AIアプリケーションが外部データソースやツールへ接続する方法を標準化する open protocol（JSON-RPC over stdio/HTTP）です。tools、resources、prompts に typed schema を提供します。"
  },
  {
    "term": "NaN (Not a Number)",
    "says": "学習が壊れた",
    "means": "未定義の結果（0/0、inf-inf）を示す浮動小数点値です。学習中の NaN loss はたいてい、learning rate が高すぎる、exploding gradients、ゼロの log、ゼロ除算のいずれかを意味します。学習が失敗したときに最初に確認すべきものです。"
  },
  {
    "term": "Normalization",
    "says": "データをスケーリングすること",
    "means": "値を標準的な範囲へ調整することです。Batch normalization は batch 全体で正規化します。Layer normalization は features 全体で正規化します。どちらも学習を安定させ、より高い learning rate を使えるようにします。"
  },
  {
    "term": "Overfitting",
    "says": "モデルがデータを丸暗記した",
    "means": "モデルが training data では良い性能を出す一方、見たことのないデータでは悪い性能になることです。signal ではなく noise を学習しています。対策は、データを増やす、regularization（dropout、weight decay）、early stopping、data augmentation、より単純なモデルです。"
  },
  {
    "term": "Optimizer",
    "says": "重みを更新するもの",
    "means": "gradients を使って model parameters を更新するアルゴリズムです。SGD が最も単純で、Adam が最も一般的です。optimizer ごとに、収束速度、メモリ使用量、hyperparameters への敏感さが異なります。"
  },
  {
    "term": "Parameter",
    "says": "モデルサイズ",
    "means": "モデル内の学習可能な値で、典型的には weight または bias です。\"7B parameters\" は70億個の学習可能な数値を意味します。float32 の parameter は1つ4 bytes なので、7B parameters では重みだけで28GBのメモリが必要です。"
  },
  {
    "term": "Perplexity",
    "says": "モデルがどれだけ混乱しているか",
    "means": "平均 cross-entropy loss の指数です。低いほど良い値です。perplexity が10なら、各ステップで10個のトークンから一様に選ぶのと同じくらいモデルが不確実である、という意味です。"
  },
  {
    "term": "Precision & Recall",
    "says": "精度指標",
    "means": "Precision は、検出したもののうち正しかった割合です。Recall は、正解全体のうち見つけられた割合です。両者には trade-off があります。すべてのスパムメールを拾おうとする（高 recall）と、誤検知が増えます（低 precision）。F1 score は両者の調和平均です。false positives のコストが高いときは precision、false negatives のコストが高いときは recall を重視します。"
  },
  {
    "term": "Prompt Engineering",
    "says": "AIへの正しい話しかけ方",
    "means": "望む出力を安定して得るために入力テキストを設計することです。system prompts、few-shot examples、format instructions、chain-of-thought triggers などを含みます。"
  },
  {
    "term": "Prompt Injection",
    "says": "言葉でAIをハックすること",
    "means": "入力内の悪意あるテキストが system prompt や instructions を上書きする攻撃です。Direct injection では、ユーザーが \"Ignore previous instructions.\" と入力します。Indirect injection では、取得した文書に隠れた指示が含まれます。LLMにおける SQL injection に相当します。完全な解決策はまだなく、防御は input validation、output filtering、privilege separation の層を重ねることです。"
  },
  {
    "term": "QLoRA",
    "says": "より安く使える LoRA",
    "means": "Quantized LoRA です。凍結した base model weights を4-bit precision（NF4 format）で保持しつつ、LoRA adapters は16-bitで学習します。標準の LoRA と比べてメモリをさらに3〜4倍削減します。LoRA で14GB必要な 7B model が、QLoRA では4〜6GBに収まります。多くの benchmark で、品質は full fine-tuning との差が1%以内です。"
  },
  {
    "term": "RAG (Retrieval-Augmented Generation)",
    "says": "検索できるAI",
    "means": "knowledge base から関連文書を（embedding similarity を使って）取得し、それを prompt に詰め込み、その context に基づいて LLM に回答させるパターンです。"
  },
  {
    "term": "RLHF (Reinforcement Learning from Human Feedback)",
    "says": "AIを役に立つようにする方法",
    "means": "学習 pipeline です: (1) model outputs に対する人間の選好を集める、(2) その選好で reward model を学習する、(3) PPO を使って、より高い reward の出力を出すよう LLM を最適化する。"
  },
  {
    "term": "Quantization",
    "says": "モデルを小さくすること",
    "means": "model weights の precision を float32（4 bytes）から int8（1 byte）や int4（0.5 bytes）へ下げることです。わずかな精度低下と引き換えに、メモリを4〜8倍減らし、推論を高速化します。GPTQ、AWQ、GGUF が一般的な format です。"
  },
  {
    "term": "ReLU",
    "says": "Activation function",
    "means": "Rectified Linear Unit: f(x) = max(0, x)。最も単純な非線形 activation です。計算が速く、正の値では飽和しません。うまく機能し、安価なので広く使われています。派生形には LeakyReLU、GELU、SiLU があります。"
  },
  {
    "term": "ROUGE",
    "says": "要約の評価指標",
    "means": "Recall-Oriented Understudy for Gisting Evaluation の略です。生成テキストと参照テキストの重なりを測ります。ROUGE-1 は unigram の一致、ROUGE-2 は bigram の一致、ROUGE-L は最長共通部分列を数えます。計算は安価ですが、表面的な類似性しか測りません。同じ意味でも違う単語を使った2文は低いスコアになります。"
  },
  {
    "term": "Semantic Search",
    "says": "意味を理解する賢い検索",
    "means": "keyword matching ではなく意味で文書を探すことです。query とすべての文書を同じ vector space に embed し、query embedding に最も近い embeddings を持つ文書を返します。\"payment failed\" は、共通する単語がなくても \"transaction declined\" を見つけられます。embedding models + vector databases によって実現されます。"
  },
  {
    "term": "Streaming",
    "says": "応答が単語ごとに表示されること",
    "means": "完全な応答を待つのではなく、LLMが生成した tokens を順次送ることです。Server-Sent Events（SSE）または WebSocket protocols を使います。最初の token までの体感 latency を、秒単位からミリ秒単位へ下げます。本番の chat interface には不可欠です。各 chunk には delta（部分 token または単語）が含まれます。"
  },
  {
    "term": "Self-Attention",
    "says": "モデルがどこに注目するかを決める仕組み",
    "means": "各 token が query、key、value vectors を計算します。2つの token 間の attention weight は、query と key の dot product をスケーリングして softmax したものです。出力は value vectors の重み付き和です。これにより、すべての token が他のすべての token を参照できます。"
  },
  {
    "term": "SFT (Supervised Fine-Tuning)",
    "says": "モデルに指示に従うことを教えること",
    "means": "事前学習済みモデルを (instruction, response) ペアで fine-tuning することです。モデルは instruction を与えられたときに response を生成することを学びます。base model を chat model に変えるのがこれです。"
  },
  {
    "term": "Softmax",
    "says": "数値を確率に変えるもの",
    "means": "softmax(x_i) = exp(x_i) / sum(exp(x_j))。任意の実数ベクトルを確率分布（すべて正で、合計が1）に変換します。classification heads、attention weights、その他確率が必要な場所で使われます。"
  },
  {
    "term": "Swarm",
    "says": "たくさんのAI agents が群れのように協調して働くこと",
    "means": "複数の agents が state を共有し、message passing を通じて協調する仕組みです。中央制御ではなく、個々の単純なルールから創発的な振る舞いが生まれます。"
  },
  {
    "term": "System Prompt",
    "says": "AIへの指示",
    "means": "会話の冒頭に置かれ、モデルの振る舞い、persona、制約を設定する特別な message です。user messages より前に処理されます。多くのUIではユーザーに表示されません。モデルがすべきこと・すべきでないこと、tone、format preferences、domain focus を定義します。user prompts とは異なり、system prompts は開発者が設定します。"
  },
  {
    "term": "Tensor",
    "says": "多次元配列",
    "means": "deep learning frameworks における基本データ構造です。0D tensor は scalar、1D は vector、2D は matrix、3D以上は tensor です。PyTorch や JAX では、tensors は automatic differentiation のために計算履歴を追跡でき、CPU または GPU 上に置けます。ニューラルネットワークの入力、出力、重み、勾配はすべて tensors です。"
  },
  {
    "term": "Token",
    "says": "単語",
    "means": "BPE のような tokenizer が生成する subword unit です。英語では典型的に3〜4文字程度です。\"unbelievable\" は \"un\" + \"believ\" + \"able\" の3 tokens になることがあります。"
  },
  {
    "term": "Temperature",
    "says": "創造性の設定",
    "means": "softmax の前に logits を割るスカラーです。Temperature=1 がデフォルトです。高いほど分布が平坦になり、出力はよりランダムになります。低いほど分布が鋭くなり、より決定的になります。Temperature=0 は argmax（常に最も確率の高い token を選ぶ）です。"
  },
  {
    "term": "Transfer Learning",
    "says": "事前学習済みモデルを使うこと",
    "means": "あるタスクで学習したモデルを、別のタスクへ適応させることです。初期の層は、転用可能な一般的 feature（エッジ、構文パターンなど）を学習します。タスク固有の学習が必要なのは後段の層だけです。これが、BERT を任意のNLPタスクへ fine-tune できる理由です。"
  },
  {
    "term": "Transformer",
    "says": "現代AIを支えるアーキテクチャ",
    "means": "recurrence ではなく self-attention（すべての位置が他のすべての位置に attention できる仕組み）を使って系列を処理する neural network architecture です。これにより大規模な並列化が可能になります。"
  },
  {
    "term": "Underfitting",
    "says": "モデルが学習できていない",
    "means": "モデルが単純すぎて、データ内のパターンを捉えられない状態です。training loss は高いままです。対策は、parameters を増やす、層を増やす、学習時間を延ばす、regularization を弱める、features を改善することです。"
  },
  {
    "term": "VAE (Variational Autoencoder)",
    "says": "生成モデル",
    "means": "encoder output が Gaussian distribution に従うよう強制することで、滑らかな latent space を学習する autoencoder です。この分布から sample し、decode することで新しいデータを生成できます。reparameterization trick により backpropagation で学習可能になります。"
  },
  {
    "term": "Vector Database",
    "says": "AI用の特殊なデータベース",
    "means": "vectors（float の dense arrays）を保存し、高速な approximate nearest-neighbor search を行うよう最適化された database です。similarity search、RAG、recommendation systems の中核となる操作です。"
  },
  {
    "term": "Weight",
    "says": "モデルが学習したもの",
    "means": "モデルの parameter matrix に含まれる1つの数値です。input size 768、output size 3072 の linear layer には、768*3072 = 2,359,296 個の weights があります。学習は各 weight を調整し、loss function を最小化します。"
  },
  {
    "term": "Weight Decay",
    "says": "Regularization",
    "means": "weights の大きさに比例する penalty を loss function に追加することです。L2 regularization と同等です。weights が大きくなりすぎるのを防ぎます。典型値は0.01〜0.1です。"
  },
  {
    "term": "Zero-Shot",
    "says": "学習なしで使えること",
    "means": "明示的に学習していないタスクに対して、task-specific examples を prompt に入れずにモデルを使うことです。モデルは pre-training から汎化します。大規模モデルは十分に多様な形式を見ているため、新しいタスク形式にも対応できます。"
  }
];

const ARTIFACTS = [
  {
    "kind": "prompt",
    "name": "prompt-env-check",
    "description": "AIエンジニアリング環境のセットアップ問題を診断して修正する",
    "tags": [],
    "phase": 0,
    "lesson": 1,
    "lessonPath": "phases/00-setup-and-tooling/01-dev-environment",
    "file": "phases/00-setup-and-tooling/01-dev-environment/outputs/prompt-env-check.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-api-troubleshooter",
    "description": "認証、レート制限、タイムアウトなど、よくあるAI APIエラーを診断して修正する",
    "tags": [],
    "phase": 0,
    "lesson": 4,
    "lessonPath": "phases/00-setup-and-tooling/04-apis-and-keys",
    "file": "phases/00-setup-and-tooling/04-apis-and-keys/outputs/prompt-api-troubleshooter.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-notebook-helper",
    "description": "カーネルクラッシュ、メモリ問題、表示失敗などのJupyter notebook問題をデバッグする",
    "tags": [],
    "phase": 0,
    "lesson": 5,
    "lessonPath": "phases/00-setup-and-tooling/05-jupyter-notebooks",
    "file": "phases/00-setup-and-tooling/05-jupyter-notebooks/outputs/prompt-notebook-helper.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-data-helper",
    "description": "AI/MLタスクに適したデータセットを見つけて読み込む",
    "tags": [],
    "phase": 0,
    "lesson": 9,
    "lessonPath": "phases/00-setup-and-tooling/09-data-management",
    "file": "phases/00-setup-and-tooling/09-data-management/outputs/prompt-data-helper.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-debug-ai-code",
    "description": "NaN loss、shape error、学習失敗、OOMなど、AI特有のバグを診断する",
    "tags": [],
    "phase": 0,
    "lesson": 12,
    "lessonPath": "phases/00-setup-and-tooling/12-debugging-and-profiling",
    "file": "phases/00-setup-and-tooling/12-debugging-and-profiling/outputs/prompt-debug-ai-code.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-linear-algebra-tutor",
    "description": "幾何学的な直感とAI応用を通じて線形代数を教える",
    "tags": [],
    "phase": 1,
    "lesson": 1,
    "lessonPath": "phases/01-math-foundations/01-linear-algebra-intuition",
    "file": "phases/01-math-foundations/01-linear-algebra-intuition/outputs/prompt-linear-algebra-tutor.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-matrix-operations",
    "description": "幾何学的な直感を通じて行列演算を教え、抽象的な数学をニューラルネットワークの仕組みに結びつける",
    "tags": [],
    "phase": 1,
    "lesson": 2,
    "lessonPath": "phases/01-math-foundations/02-vectors-matrices-operations",
    "file": "phases/01-math-foundations/02-vectors-matrices-operations/outputs/prompt-matrix-operations.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-transformation-visualizer",
    "description": "行列の成分から、その行列変換が幾何学的に何をするかを説明する",
    "tags": [],
    "phase": 1,
    "lesson": 3,
    "lessonPath": "phases/01-math-foundations/03-matrix-transformations",
    "file": "phases/01-math-foundations/03-matrix-transformations/outputs/prompt-transformation-visualizer.md"
  },
  {
    "kind": "skill",
    "name": "skill-gradient-computation",
    "description": "よく使う機械学習の損失関数の勾配を計算し、適切な微分方法を選ぶ",
    "tags": [
      "calculus",
      "gradients",
      "backpropagation"
    ],
    "phase": 1,
    "lesson": 4,
    "lessonPath": "phases/01-math-foundations/04-calculus-for-ml",
    "file": "phases/01-math-foundations/04-calculus-for-ml/outputs/skill-gradient-computation.md"
  },
  {
    "kind": "skill",
    "name": "skill-autodiff",
    "description": "自動微分システムを構築・デバッグし、その仕組みを説明する",
    "tags": [],
    "phase": 1,
    "lesson": 5,
    "lessonPath": "phases/01-math-foundations/05-chain-rule-and-autodiff",
    "file": "phases/01-math-foundations/05-chain-rule-and-autodiff/outputs/skill-autodiff.md"
  },
  {
    "kind": "skill",
    "name": "skill-probability-reasoning",
    "description": "与えられた機械学習問題に適した確率分布を選ぶ",
    "tags": [
      "probability",
      "distributions",
      "modeling"
    ],
    "phase": 1,
    "lesson": 6,
    "lessonPath": "phases/01-math-foundations/06-probability-and-distributions",
    "file": "phases/01-math-foundations/06-probability-and-distributions/outputs/skill-probability-reasoning.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-bayesian-reasoning",
    "description": "任意のシナリオでベイズ推論を段階的に進める",
    "tags": [],
    "phase": 1,
    "lesson": 7,
    "lessonPath": "phases/01-math-foundations/07-bayes-theorem",
    "file": "phases/01-math-foundations/07-bayes-theorem/outputs/prompt-bayesian-reasoning.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-optimizer-guide",
    "description": "ユーザー固有の機械学習問題に適したoptimizer選びを案内する",
    "tags": [],
    "phase": 1,
    "lesson": 8,
    "lessonPath": "phases/01-math-foundations/08-optimization",
    "file": "phases/01-math-foundations/08-optimization/outputs/prompt-optimizer-guide.md"
  },
  {
    "kind": "skill",
    "name": "skill-information-theory",
    "description": "情報理論の概念をMLの損失関数、モデル評価、特徴量選択に適用する",
    "tags": [
      "information-theory",
      "entropy",
      "loss-functions"
    ],
    "phase": 1,
    "lesson": 9,
    "lessonPath": "phases/01-math-foundations/09-information-theory",
    "file": "phases/01-math-foundations/09-information-theory/outputs/skill-information-theory.md"
  },
  {
    "kind": "skill",
    "name": "skill-dimensionality-reduction",
    "description": "データサイズ、目的、下流での使い方に基づいて、与えられたタスクに適した次元削減手法を選ぶ",
    "tags": [],
    "phase": 1,
    "lesson": 10,
    "lessonPath": "phases/01-math-foundations/10-dimensionality-reduction",
    "file": "phases/01-math-foundations/10-dimensionality-reduction/outputs/skill-dimensionality-reduction.md"
  },
  {
    "kind": "skill",
    "name": "skill-svd",
    "description": "圧縮、ノイズ除去、推薦、最小二乗解法などの実問題にSVDを適用する",
    "tags": [],
    "phase": 1,
    "lesson": 11,
    "lessonPath": "phases/01-math-foundations/11-singular-value-decomposition",
    "file": "phases/01-math-foundations/11-singular-value-decomposition/outputs/skill-svd.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tensor-debugger",
    "description": "深層学習コードのtensor shapeエラーを段階的にデバッグするためのプロンプト",
    "tags": [],
    "phase": 1,
    "lesson": 12,
    "lessonPath": "phases/01-math-foundations/12-tensor-operations",
    "file": "phases/01-math-foundations/12-tensor-operations/outputs/prompt-tensor-debugger.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tensor-shapes",
    "description": "tensor shape mismatchをデバッグし、一般的な深層学習演算の修正を推奨する",
    "tags": [],
    "phase": 1,
    "lesson": 12,
    "lessonPath": "phases/01-math-foundations/12-tensor-operations",
    "file": "phases/01-math-foundations/12-tensor-operations/outputs/prompt-tensor-shapes.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-numerical-debugger",
    "description": "ニューラルネットワーク学習における NaN、Inf、数値安定性の問題を診断する",
    "tags": [],
    "phase": 1,
    "lesson": 13,
    "lessonPath": "phases/01-math-foundations/13-numerical-stability",
    "file": "phases/01-math-foundations/13-numerical-stability/outputs/prompt-numerical-debugger.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-distance-chooser",
    "description": "特定のタスクに適した距離指標を選べるようユーザーを案内する",
    "tags": [],
    "phase": 1,
    "lesson": 14,
    "lessonPath": "phases/01-math-foundations/14-norms-and-distances",
    "file": "phases/01-math-foundations/14-norms-and-distances/outputs/prompt-distance-chooser.md"
  },
  {
    "kind": "skill",
    "name": "skill-statistical-testing",
    "description": "ML モデルの比較と実験評価に適した統計検定を選ぶ",
    "tags": [
      "statistics",
      "hypothesis-testing",
      "model-comparison"
    ],
    "phase": 1,
    "lesson": 15,
    "lessonPath": "phases/01-math-foundations/15-statistics-for-ml",
    "file": "phases/01-math-foundations/15-statistics-for-ml/outputs/skill-statistical-testing.md"
  },
  {
    "kind": "skill",
    "name": "skill-sampling-strategy",
    "description": "生成、推定、推論に適したサンプリング手法を選ぶ",
    "tags": [
      "sampling",
      "mcmc",
      "generation"
    ],
    "phase": 1,
    "lesson": 16,
    "lessonPath": "phases/01-math-foundations/16-sampling-methods",
    "file": "phases/01-math-foundations/16-sampling-methods/outputs/skill-sampling-strategy.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-linear-solver",
    "description": "行列の性質に基づいて線形システム Ax=b を解く適切なアルゴリズムを推薦する",
    "tags": [],
    "phase": 1,
    "lesson": 17,
    "lessonPath": "phases/01-math-foundations/17-linear-systems",
    "file": "phases/01-math-foundations/17-linear-systems/outputs/prompt-linear-solver.md"
  },
  {
    "kind": "skill",
    "name": "skill-convexity-checker",
    "description": "最適化問題が凸かどうかを判定し、適切なソルバを選ぶ",
    "tags": [
      "optimization",
      "convexity",
      "solvers"
    ],
    "phase": 1,
    "lesson": 18,
    "lessonPath": "phases/01-math-foundations/18-convex-optimization",
    "file": "phases/01-math-foundations/18-convex-optimization/outputs/skill-convexity-checker.md"
  },
  {
    "kind": "skill",
    "name": "skill-complex-arithmetic",
    "description": "ML と信号処理の文脈で使う複素数演算のクイックリファレンス",
    "tags": [],
    "phase": 1,
    "lesson": 19,
    "lessonPath": "phases/01-math-foundations/19-complex-numbers",
    "file": "phases/01-math-foundations/19-complex-numbers/outputs/skill-complex-arithmetic.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-spectral-analyzer",
    "description": "Fourier transform 手法を使って信号の周波数成分を分析するためのガイド",
    "tags": [],
    "phase": 1,
    "lesson": 20,
    "lessonPath": "phases/01-math-foundations/20-fourier-transform",
    "file": "phases/01-math-foundations/20-fourier-transform/outputs/prompt-spectral-analyzer.md"
  },
  {
    "kind": "skill",
    "name": "skill-graph-analysis",
    "description": "graph-structured data を分析し、ML タスクに適したグラフアルゴリズムを選ぶ",
    "tags": [],
    "phase": 1,
    "lesson": 21,
    "lessonPath": "phases/01-math-foundations/21-graph-theory",
    "file": "phases/01-math-foundations/21-graph-theory/outputs/skill-graph-analysis.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-stochastic-process-advisor",
    "description": "与えられた問題に適した stochastic process framework を特定し、実装方針を推薦する",
    "tags": [],
    "phase": 1,
    "lesson": 22,
    "lessonPath": "phases/01-math-foundations/22-stochastic-processes",
    "file": "phases/01-math-foundations/22-stochastic-processes/outputs/prompt-stochastic-process-advisor.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-ml-problem-framer",
    "description": "現実のビジネス課題を機械学習タスクとして整理する",
    "tags": [],
    "phase": 2,
    "lesson": 1,
    "lessonPath": "phases/02-ml-fundamentals/01-what-is-machine-learning",
    "file": "phases/02-ml-fundamentals/01-what-is-machine-learning/outputs/prompt-ml-problem-framer.md"
  },
  {
    "kind": "skill",
    "name": "skill-regression",
    "description": "データ特性と問題制約にもとづいて適切な回帰手法を選ぶ",
    "tags": [
      "regression",
      "linear-regression",
      "polynomial-regression",
      "ridge",
      "regularization"
    ],
    "phase": 2,
    "lesson": 2,
    "lessonPath": "phases/02-ml-fundamentals/02-linear-regression",
    "file": "phases/02-ml-fundamentals/02-linear-regression/outputs/skill-regression.md"
  },
  {
    "kind": "skill",
    "name": "skill-classification-baseline",
    "description": "複雑なモデルへ進む前に強力な分類ベースラインを確立する",
    "tags": [
      "classification",
      "logistic-regression",
      "baseline",
      "preprocessing"
    ],
    "phase": 2,
    "lesson": 3,
    "lessonPath": "phases/02-ml-fundamentals/03-logistic-regression",
    "file": "phases/02-ml-fundamentals/03-logistic-regression/outputs/skill-classification-baseline.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tree-interpreter",
    "description": "決定木の結果を解釈し、潜在的な問題を診断する",
    "tags": [],
    "phase": 2,
    "lesson": 4,
    "lessonPath": "phases/02-ml-fundamentals/04-decision-trees",
    "file": "phases/02-ml-fundamentals/04-decision-trees/outputs/prompt-tree-interpreter.md"
  },
  {
    "kind": "skill",
    "name": "skill-svm-kernel-chooser",
    "description": "問題に合ったSVM kernelを選び、Cとgammaを調整する",
    "tags": [
      "svm",
      "kernel",
      "classification",
      "hyperparameter-tuning"
    ],
    "phase": 2,
    "lesson": 5,
    "lessonPath": "phases/02-ml-fundamentals/05-support-vector-machines",
    "file": "phases/02-ml-fundamentals/05-support-vector-machines/outputs/skill-svm-kernel-chooser.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-distance-metric-advisor",
    "description": "データ型と問題特性に基づいて適切な距離尺度を推奨する",
    "tags": [],
    "phase": 2,
    "lesson": 6,
    "lessonPath": "phases/02-ml-fundamentals/06-knn-and-distances",
    "file": "phases/02-ml-fundamentals/06-knn-and-distances/outputs/prompt-distance-metric-advisor.md"
  },
  {
    "kind": "skill",
    "name": "skill-clustering-guide",
    "description": "データ形状、ノイズ、制約に基づいて適切なクラスタリングアルゴリズムを選ぶ",
    "tags": [
      "clustering",
      "k-means",
      "dbscan",
      "hierarchical",
      "gmm",
      "unsupervised"
    ],
    "phase": 2,
    "lesson": 7,
    "lessonPath": "phases/02-ml-fundamentals/07-unsupervised-learning",
    "file": "phases/02-ml-fundamentals/07-unsupervised-learning/outputs/skill-clustering-guide.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-feature-engineer",
    "description": "生の表形式データから特徴量を設計するための体系的なプロンプト",
    "tags": [],
    "phase": 2,
    "lesson": 8,
    "lessonPath": "phases/02-ml-fundamentals/08-feature-engineering",
    "file": "phases/02-ml-fundamentals/08-feature-engineering/outputs/prompt-feature-engineer.md"
  },
  {
    "kind": "skill",
    "name": "skill-evaluation",
    "description": "分類モデルと回帰モデルの評価戦略チェックリスト",
    "tags": [
      "evaluation",
      "metrics",
      "cross-validation",
      "model-selection"
    ],
    "phase": 2,
    "lesson": 9,
    "lessonPath": "phases/02-ml-fundamentals/09-model-evaluation",
    "file": "phases/02-ml-fundamentals/09-model-evaluation/outputs/skill-evaluation.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-model-diagnostics",
    "description": "train/test metric と learning curve を使ってモデル性能の問題を診断する",
    "tags": [],
    "phase": 2,
    "lesson": 10,
    "lessonPath": "phases/02-ml-fundamentals/10-bias-variance",
    "file": "phases/02-ml-fundamentals/10-bias-variance/outputs/prompt-model-diagnostics.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-ensemble-selector",
    "description": "与えられた dataset と問題に対して適切な ensemble method を選ぶ",
    "tags": [],
    "phase": 2,
    "lesson": 11,
    "lessonPath": "phases/02-ml-fundamentals/11-ensemble-methods",
    "file": "phases/02-ml-fundamentals/11-ensemble-methods/outputs/prompt-ensemble-selector.md"
  },
  {
    "kind": "skill",
    "name": "skill-ensemble-builder",
    "description": "問題に適した ensemble method を選び、設定する",
    "tags": [
      "ensemble",
      "bagging",
      "boosting",
      "random-forest",
      "xgboost",
      "stacking"
    ],
    "phase": 2,
    "lesson": 11,
    "lessonPath": "phases/02-ml-fundamentals/11-ensemble-methods",
    "file": "phases/02-ml-fundamentals/11-ensemble-methods/outputs/skill-ensemble-builder.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tuning-strategy",
    "description": "model type、data size、compute budget に基づいて hyperparameter tuning strategy を推奨する",
    "tags": [],
    "phase": 2,
    "lesson": 12,
    "lessonPath": "phases/02-ml-fundamentals/12-hyperparameter-tuning",
    "file": "phases/02-ml-fundamentals/12-hyperparameter-tuning/outputs/prompt-tuning-strategy.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-ml-pipeline",
    "description": "再現可能な ML パイプラインを構築、debug、deploy する",
    "tags": [],
    "phase": 2,
    "lesson": 13,
    "lessonPath": "phases/02-ml-fundamentals/13-ml-pipelines",
    "file": "phases/02-ml-fundamentals/13-ml-pipelines/outputs/prompt-ml-pipeline.md"
  },
  {
    "kind": "skill",
    "name": "skill-naive-bayes-chooser",
    "description": "分類タスクに適した Naive Bayes variant を選ぶ",
    "tags": [],
    "phase": 2,
    "lesson": 14,
    "lessonPath": "phases/02-ml-fundamentals/14-naive-bayes",
    "file": "phases/02-ml-fundamentals/14-naive-bayes/outputs/skill-naive-bayes-chooser.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-time-series-advisor",
    "description": "time series problems を整理し、approaches を推奨する",
    "tags": [],
    "phase": 2,
    "lesson": 15,
    "lessonPath": "phases/02-ml-fundamentals/15-time-series",
    "file": "phases/02-ml-fundamentals/15-time-series/outputs/prompt-time-series-advisor.md"
  },
  {
    "kind": "skill",
    "name": "skill-anomaly-detector",
    "description": "Choose the right anomaly detection approach for your problem",
    "tags": [],
    "phase": 2,
    "lesson": 16,
    "lessonPath": "phases/02-ml-fundamentals/16-anomaly-detection",
    "file": "phases/02-ml-fundamentals/16-anomaly-detection/outputs/skill-anomaly-detector.md"
  },
  {
    "kind": "skill",
    "name": "skill-imbalanced-data",
    "description": "Decision checklist for handling imbalanced classification problems",
    "tags": [
      "imbalanced-data",
      "smote",
      "class-weights",
      "threshold-tuning",
      "evaluation"
    ],
    "phase": 2,
    "lesson": 17,
    "lessonPath": "phases/02-ml-fundamentals/17-imbalanced-data",
    "file": "phases/02-ml-fundamentals/17-imbalanced-data/outputs/skill-imbalanced-data.md"
  },
  {
    "kind": "skill",
    "name": "skill-feature-selector",
    "description": "Quick reference decision tree for choosing the right feature selection method",
    "tags": [
      "feature-selection",
      "mutual-information",
      "rfe",
      "lasso",
      "tree-importance"
    ],
    "phase": 2,
    "lesson": 18,
    "lessonPath": "phases/02-ml-fundamentals/18-feature-selection",
    "file": "phases/02-ml-fundamentals/18-feature-selection/outputs/skill-feature-selector.md"
  },
  {
    "kind": "skill",
    "name": "skill-perceptron",
    "description": "パーセプトロンのパターンと、単層アーキテクチャと多層アーキテクチャを使い分けるタイミングを理解する",
    "tags": [
      "perceptron",
      "neural-networks",
      "classification",
      "deep-learning"
    ],
    "phase": 3,
    "lesson": 1,
    "lessonPath": "phases/03-deep-learning-core/01-the-perceptron",
    "file": "phases/03-deep-learning-core/01-the-perceptron/outputs/skill-perceptron.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-network-architect",
    "description": "与えられた問題に対して、層数、ニューロン数、活性化関数を選び、ニューラルネットワークのアーキテクチャ設計を案内する",
    "tags": [],
    "phase": 3,
    "lesson": 2,
    "lessonPath": "phases/03-deep-learning-core/02-multi-layer-networks",
    "file": "phases/03-deep-learning-core/02-multi-layer-networks/outputs/prompt-network-architect.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-gradient-debugger",
    "description": "ニューラルネットワークの勾配問題を診断して修正する。勾配消失、勾配爆発、NaN値を扱う",
    "tags": [],
    "phase": 3,
    "lesson": 3,
    "lessonPath": "phases/03-deep-learning-core/03-backpropagation",
    "file": "phases/03-deep-learning-core/03-backpropagation/outputs/prompt-gradient-debugger.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-activation-selector",
    "description": "任意のニューラルネットワークアーキテクチャに適した活性化関数を選ぶための判断プロンプト",
    "tags": [],
    "phase": 3,
    "lesson": 4,
    "lessonPath": "phases/03-deep-learning-core/04-activation-functions",
    "file": "phases/03-deep-learning-core/04-activation-functions/outputs/prompt-activation-selector.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-loss-debugger",
    "description": "損失曲線と訓練失敗をデバッグするための診断プロンプト",
    "tags": [],
    "phase": 3,
    "lesson": 5,
    "lessonPath": "phases/03-deep-learning-core/05-loss-functions",
    "file": "phases/03-deep-learning-core/05-loss-functions/outputs/prompt-loss-debugger.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-loss-function-selector",
    "description": "任意の ML タスクに適した損失関数を選ぶための判断プロンプト",
    "tags": [],
    "phase": 3,
    "lesson": 5,
    "lessonPath": "phases/03-deep-learning-core/05-loss-functions",
    "file": "phases/03-deep-learning-core/05-loss-functions/outputs/prompt-loss-function-selector.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-optimizer-selector",
    "description": "任意のアーキテクチャに適した optimizer と learning rate を選ぶための判断プロンプト",
    "tags": [],
    "phase": 3,
    "lesson": 6,
    "lessonPath": "phases/03-deep-learning-core/06-optimizers",
    "file": "phases/03-deep-learning-core/06-optimizers/outputs/prompt-optimizer-selector.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-regularization-advisor",
    "description": "過学習の症状に基づいて正則化戦略を選ぶための診断プロンプト",
    "tags": [],
    "phase": 3,
    "lesson": 7,
    "lessonPath": "phases/03-deep-learning-core/07-regularization",
    "file": "phases/03-deep-learning-core/07-regularization/outputs/prompt-regularization-advisor.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-init-strategy",
    "description": "重み初期化の問題を診断し、任意のニューラルネットワークアーキテクチャに適した戦略を推奨する",
    "tags": [],
    "phase": 3,
    "lesson": 8,
    "lessonPath": "phases/03-deep-learning-core/08-weight-initialization",
    "file": "phases/03-deep-learning-core/08-weight-initialization/outputs/prompt-init-strategy.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-lr-schedule-advisor",
    "description": "任意の学習設定に対して、適切な learning rate schedule と hyperparameters を推奨する",
    "tags": [],
    "phase": 3,
    "lesson": 9,
    "lessonPath": "phases/03-deep-learning-core/09-learning-rate-schedules",
    "file": "phases/03-deep-learning-core/09-learning-rate-schedules/outputs/prompt-lr-schedule-advisor.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-framework-architect",
    "description": "framework abstractions -- modules、containers、losses、optimizers -- を使って neural network architectures を設計する",
    "tags": [],
    "phase": 3,
    "lesson": 10,
    "lessonPath": "phases/03-deep-learning-core/10-mini-framework",
    "file": "phases/03-deep-learning-core/10-mini-framework/outputs/prompt-framework-architect.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-pytorch-debugger",
    "description": "症状から一般的な PyTorch training failures を診断して修正する",
    "tags": [],
    "phase": 3,
    "lesson": 11,
    "lessonPath": "phases/03-deep-learning-core/11-intro-to-pytorch",
    "file": "phases/03-deep-learning-core/11-intro-to-pytorch/outputs/prompt-pytorch-debugger.md"
  },
  {
    "kind": "skill",
    "name": "skill-pytorch-patterns",
    "description": "PyTorch の training、evaluation、deployment の reference patterns",
    "tags": [
      "pytorch",
      "training",
      "deep-learning",
      "gpu",
      "patterns"
    ],
    "phase": 3,
    "lesson": 11,
    "lessonPath": "phases/03-deep-learning-core/11-intro-to-pytorch",
    "file": "phases/03-deep-learning-core/11-intro-to-pytorch/outputs/skill-pytorch-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-jax-optimizer",
    "description": "与えられた training scenario に適した JAX/Optax optimizer を選び、設定する",
    "tags": [],
    "phase": 3,
    "lesson": 12,
    "lessonPath": "phases/03-deep-learning-core/12-intro-to-jax",
    "file": "phases/03-deep-learning-core/12-intro-to-jax/outputs/prompt-jax-optimizer.md"
  },
  {
    "kind": "skill",
    "name": "skill-jax-patterns",
    "description": "JAX における functional programming patterns -- grad、jit、vmap、pmap をいつ、どう使うか",
    "tags": [
      "jax",
      "functional-programming",
      "autodiff",
      "compilation",
      "vectorization"
    ],
    "phase": 3,
    "lesson": 12,
    "lessonPath": "phases/03-deep-learning-core/12-intro-to-jax",
    "file": "phases/03-deep-learning-core/12-intro-to-jax/outputs/skill-jax-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-nn-debugger",
    "description": "symptoms -- loss curves、gradient stats、activation patterns -- から neural network training failures を診断する",
    "tags": [],
    "phase": 3,
    "lesson": 13,
    "lessonPath": "phases/03-deep-learning-core/13-debugging-neural-networks",
    "file": "phases/03-deep-learning-core/13-debugging-neural-networks/outputs/prompt-nn-debugger.md"
  },
  {
    "kind": "skill",
    "name": "skill-debug-checklist",
    "description": "neural network training failures を debug するための decision-tree checklist",
    "tags": [
      "debugging",
      "neural-networks",
      "training",
      "diagnostics",
      "deep-learning"
    ],
    "phase": 3,
    "lesson": 13,
    "lessonPath": "phases/03-deep-learning-core/13-debugging-neural-networks",
    "file": "phases/03-deep-learning-core/13-debugging-neural-networks/outputs/skill-debug-checklist.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-vision-preprocessing-audit",
    "description": "任意の model card または dataset card を、vision pipeline が守るべき preprocessing invariant の checklist に変換する",
    "tags": [],
    "phase": 4,
    "lesson": 1,
    "lessonPath": "phases/04-computer-vision/01-image-fundamentals",
    "file": "phases/04-computer-vision/01-image-fundamentals/outputs/prompt-vision-preprocessing-audit.md"
  },
  {
    "kind": "skill",
    "name": "skill-image-tensor-inspector",
    "description": "任意の image-shaped tensor または array を調べ、dtype、layout、range、raw / normalized / standardized のどれに見えるかを報告する",
    "tags": [
      "computer-vision",
      "debugging",
      "preprocessing",
      "tensors"
    ],
    "phase": 4,
    "lesson": 1,
    "lessonPath": "phases/04-computer-vision/01-image-fundamentals",
    "file": "phases/04-computer-vision/01-image-fundamentals/outputs/skill-image-tensor-inspector.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-cnn-architect",
    "description": "入力サイズ、パラメータ予算、目標受容野から Conv2d レイヤーのスタックを設計する",
    "tags": [],
    "phase": 4,
    "lesson": 2,
    "lessonPath": "phases/04-computer-vision/02-convolutions-from-scratch",
    "file": "phases/04-computer-vision/02-convolutions-from-scratch/outputs/prompt-cnn-architect.md"
  },
  {
    "kind": "skill",
    "name": "skill-conv-shape-calculator",
    "description": "CNN 仕様を layer ごとにたどり、各 block の出力形状、受容野、パラメータ数を報告する",
    "tags": [
      "computer-vision",
      "cnn",
      "architecture",
      "debugging"
    ],
    "phase": 4,
    "lesson": 2,
    "lessonPath": "phases/04-computer-vision/02-convolutions-from-scratch",
    "file": "phases/04-computer-vision/02-convolutions-from-scratch/outputs/skill-conv-shape-calculator.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-backbone-selector",
    "description": "与えられた task、dataset size、compute budget に対して適切な vision backbone (LeNet, VGG, ResNet, MobileNet, EfficientNet-Lite, ConvNeXt, ViT) を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 3,
    "lessonPath": "phases/04-computer-vision/03-cnns-lenet-to-resnet",
    "file": "phases/04-computer-vision/03-cnns-lenet-to-resnet/outputs/prompt-backbone-selector.md"
  },
  {
    "kind": "skill",
    "name": "skill-residual-block-reviewer",
    "description": "PyTorch の residual block について、skip-connection の正しさ、BN placement、activation order、shape alignment をレビューする",
    "tags": [
      "computer-vision",
      "resnet",
      "code-review",
      "pytorch"
    ],
    "phase": 4,
    "lesson": 3,
    "lessonPath": "phases/04-computer-vision/03-cnns-lenet-to-resnet",
    "file": "phases/04-computer-vision/03-cnns-lenet-to-resnet/outputs/skill-residual-block-reviewer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-classifier-pipeline-auditor",
    "description": "PyTorch の画像分類 training script を、静かなバグの大半を覆う 5 つの invariant で audit する",
    "tags": [],
    "phase": 4,
    "lesson": 4,
    "lessonPath": "phases/04-computer-vision/04-image-classification",
    "file": "phases/04-computer-vision/04-image-classification/outputs/prompt-classifier-pipeline-auditor.md"
  },
  {
    "kind": "skill",
    "name": "skill-classification-diagnostics",
    "description": "confusion matrix と class names を受け取り、クラス別の失敗を表に出して、最も効果の大きい fix を 1 つ提案する",
    "tags": [
      "computer-vision",
      "classification",
      "evaluation",
      "debugging"
    ],
    "phase": 4,
    "lesson": 4,
    "lessonPath": "phases/04-computer-vision/04-image-classification",
    "file": "phases/04-computer-vision/04-image-classification/outputs/skill-classification-diagnostics.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-fine-tune-planner",
    "description": "dataset size, domain distance, and compute budget に基づいて feature extraction、progressive fine-tuning、end-to-end fine-tuning のどれを使うかを選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 5,
    "lessonPath": "phases/04-computer-vision/05-transfer-learning",
    "file": "phases/04-computer-vision/05-transfer-learning/outputs/prompt-fine-tune-planner.md"
  },
  {
    "kind": "skill",
    "name": "skill-freeze-inspector",
    "description": "どの parameters が trainable か、どの BatchNorm layers が eval mode か、optimizer が trainable parameters を実際に消費しているかを報告する",
    "tags": [
      "computer-vision",
      "transfer-learning",
      "debugging",
      "pytorch"
    ],
    "phase": 4,
    "lesson": 5,
    "lessonPath": "phases/04-computer-vision/05-transfer-learning",
    "file": "phases/04-computer-vision/05-transfer-learning/outputs/skill-freeze-inspector.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-detection-metric-reader",
    "description": "precision/recall/AP/mAP の 1 行を、1 行の診断と最も有用な次の実験に変換する",
    "tags": [],
    "phase": 4,
    "lesson": 6,
    "lessonPath": "phases/04-computer-vision/06-object-detection-yolo",
    "file": "phases/04-computer-vision/06-object-detection-yolo/outputs/prompt-detection-metric-reader.md"
  },
  {
    "kind": "skill",
    "name": "skill-anchor-designer",
    "description": "ground-truth boxes の dataset から (w, h) に k-means を実行し、FPN level ごとの anchor sets と coverage statistics を返す",
    "tags": [
      "computer-vision",
      "detection",
      "anchors",
      "kmeans"
    ],
    "phase": 4,
    "lesson": 6,
    "lessonPath": "phases/04-computer-vision/06-object-detection-yolo",
    "file": "phases/04-computer-vision/06-object-detection-yolo/outputs/skill-anchor-designer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-segmentation-task-picker",
    "description": "task に対して semantic vs instance vs panoptic segmentation を選び、architecture を指定する",
    "tags": [],
    "phase": 4,
    "lesson": 7,
    "lessonPath": "phases/04-computer-vision/07-semantic-segmentation-unet",
    "file": "phases/04-computer-vision/07-semantic-segmentation-unet/outputs/prompt-segmentation-task-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-segmentation-mask-inspector",
    "description": "class distribution、predicted-mask statistics、under-predicted または boundary-blurred の可能性が高い classes を報告する",
    "tags": [
      "computer-vision",
      "segmentation",
      "debugging",
      "evaluation"
    ],
    "phase": 4,
    "lesson": 7,
    "lessonPath": "phases/04-computer-vision/07-semantic-segmentation-unet",
    "file": "phases/04-computer-vision/07-semantic-segmentation-unet/outputs/skill-segmentation-mask-inspector.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-instance-vs-semantic-router",
    "description": "3 つの質問を行い、instance vs semantic vs panoptic segmentation と最初の model を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 8,
    "lessonPath": "phases/04-computer-vision/08-instance-segmentation-mask-rcnn",
    "file": "phases/04-computer-vision/08-instance-segmentation-mask-rcnn/outputs/prompt-instance-vs-semantic-router.md"
  },
  {
    "kind": "skill",
    "name": "skill-mask-rcnn-head-swapper",
    "description": "custom num_classes 用に torchvision Mask R-CNN の box head と mask head を差し替える正確な code を生成する",
    "tags": [
      "computer-vision",
      "mask-rcnn",
      "fine-tuning",
      "torchvision"
    ],
    "phase": 4,
    "lesson": 8,
    "lessonPath": "phases/04-computer-vision/08-instance-segmentation-mask-rcnn",
    "file": "phases/04-computer-vision/08-instance-segmentation-mask-rcnn/outputs/skill-mask-rcnn-head-swapper.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-gan-training-triage",
    "description": "GAN の学習曲線の説明を読み、失敗モードと推奨する単一の修正を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 9,
    "lessonPath": "phases/04-computer-vision/09-image-generation-gans",
    "file": "phases/04-computer-vision/09-image-generation-gans/outputs/prompt-gan-training-triage.md"
  },
  {
    "kind": "skill",
    "name": "skill-dcgan-scaffold",
    "description": "z_dim、image_size、num_channels から、training loop と sample saver を含む完全な DCGAN scaffold を書く",
    "tags": [
      "computer-vision",
      "gan",
      "dcgan",
      "scaffolding"
    ],
    "phase": 4,
    "lesson": 9,
    "lessonPath": "phases/04-computer-vision/09-image-generation-gans",
    "file": "phases/04-computer-vision/09-image-generation-gans/outputs/skill-dcgan-scaffold.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-diffusion-sampler-picker",
    "description": "品質目標、レイテンシ予算、conditioning type に基づいて DDPM、DDIM、DPM-Solver++、Euler ancestral を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 10,
    "lessonPath": "phases/04-computer-vision/10-image-generation-diffusion",
    "file": "phases/04-computer-vision/10-image-generation-diffusion/outputs/prompt-diffusion-sampler-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-noise-schedule-designer",
    "description": "T と target corruption level から linear、cosine、sigmoid の beta schedule を作り、SNR plot も出力する",
    "tags": [
      "computer-vision",
      "diffusion",
      "noise-schedule",
      "training"
    ],
    "phase": 4,
    "lesson": 10,
    "lessonPath": "phases/04-computer-vision/10-image-generation-diffusion",
    "file": "phases/04-computer-vision/10-image-generation-diffusion/outputs/skill-noise-schedule-designer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-sd-pipeline-planner",
    "description": "レイテンシ予算、fidelity target、licensing constraint に基づき、SD 1.5 / SDXL / SD3 / FLUX と scheduler と precision を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 11,
    "lessonPath": "phases/04-computer-vision/11-stable-diffusion",
    "file": "phases/04-computer-vision/11-stable-diffusion/outputs/prompt-sd-pipeline-planner.md"
  },
  {
    "kind": "skill",
    "name": "skill-lora-training-setup",
    "description": "custom dataset 用に、captions、rank、batch size、learning rate を含む完全な LoRA training config を書く",
    "tags": [
      "computer-vision",
      "stable-diffusion",
      "lora",
      "fine-tuning"
    ],
    "phase": 4,
    "lesson": 11,
    "lessonPath": "phases/04-computer-vision/11-stable-diffusion",
    "file": "phases/04-computer-vision/11-stable-diffusion/outputs/skill-lora-training-setup.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-video-architecture-picker",
    "description": "appearance-vs-motion、dataset size、compute budget に基づき、2D+pool / I3D / (2+1)D / spatio-temporal transformer を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 12,
    "lessonPath": "phases/04-computer-vision/12-video-understanding",
    "file": "phases/04-computer-vision/12-video-understanding/outputs/prompt-video-architecture-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-frame-sampler-auditor",
    "description": "video pipeline の frame sampler について、off-by-one、short-clip handling、crop consistency を監査する",
    "tags": [
      "computer-vision",
      "video",
      "sampling",
      "debugging"
    ],
    "phase": 4,
    "lesson": 12,
    "lessonPath": "phases/04-computer-vision/12-video-understanding",
    "file": "phases/04-computer-vision/12-video-understanding/outputs/skill-frame-sampler-auditor.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-3d-task-router",
    "description": "タスクと入力に基づいて適切な3D表現（point cloud、mesh、voxel、NeRF、Gaussian splat）へ振り分ける",
    "tags": [],
    "phase": 4,
    "lesson": 13,
    "lessonPath": "phases/04-computer-vision/13-3d-vision-nerf",
    "file": "phases/04-computer-vision/13-3d-vision-nerf/outputs/prompt-3d-task-router.md"
  },
  {
    "kind": "skill",
    "name": "skill-point-cloud-loader",
    "description": "正しいnormalisation、centring、point samplingを備えた.ply / .pcd / .xyzファイル用PyTorch Datasetを書く",
    "tags": [
      "3d-vision",
      "point-cloud",
      "data-loading",
      "pytorch"
    ],
    "phase": 4,
    "lesson": 13,
    "lessonPath": "phases/04-computer-vision/13-3d-vision-nerf",
    "file": "phases/04-computer-vision/13-3d-vision-nerf/outputs/skill-point-cloud-loader.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-vit-vs-cnn-picker",
    "description": "データセットサイズ、計算資源、推論スタックに基づいてViT、ConvNeXt、Swinのどれを使うか選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 14,
    "lessonPath": "phases/04-computer-vision/14-vision-transformers",
    "file": "phases/04-computer-vision/14-vision-transformers/outputs/prompt-vit-vs-cnn-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-vit-patch-and-pos-embed-inspector",
    "description": "ViTのpatch embeddingとpositional embeddingのshapeが、モデルの期待するsequence lengthに一致するか検証する",
    "tags": [
      "vision-transformer",
      "debugging",
      "pytorch"
    ],
    "phase": 4,
    "lesson": 14,
    "lessonPath": "phases/04-computer-vision/14-vision-transformers",
    "file": "phases/04-computer-vision/14-vision-transformers/outputs/skill-vit-patch-and-pos-embed-inspector.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-edge-deployment-planner",
    "description": "ターゲットデバイスとレイテンシSLAに基づいてbackbone、量子化戦略、runtimeを選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 15,
    "lessonPath": "phases/04-computer-vision/15-real-time-edge",
    "file": "phases/04-computer-vision/15-real-time-edge/outputs/prompt-edge-deployment-planner.md"
  },
  {
    "kind": "skill",
    "name": "skill-latency-profiler",
    "description": "warmup、synchronisation、percentiles、memory trackingを備えた完全なlatency benchmarking scriptを書く",
    "tags": [
      "edge",
      "deployment",
      "profiling",
      "benchmarking"
    ],
    "phase": 4,
    "lesson": 15,
    "lessonPath": "phases/04-computer-vision/15-real-time-edge",
    "file": "phases/04-computer-vision/15-real-time-edge/outputs/skill-latency-profiler.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-vision-service-shape-reviewer",
    "description": "vision serviceのコードをcontract/response shape違反の観点でレビューし、最初の破壊的バグを指摘する",
    "tags": [],
    "phase": 4,
    "lesson": 16,
    "lessonPath": "phases/04-computer-vision/16-vision-pipeline-capstone",
    "file": "phases/04-computer-vision/16-vision-pipeline-capstone/outputs/prompt-vision-service-shape-reviewer.md"
  },
  {
    "kind": "skill",
    "name": "skill-pipeline-budget-planner",
    "description": "目標latencyとthroughputから各pipeline stageへ時間予算を割り当て、どのstageが最初に予算未達になるか示す",
    "tags": [
      "vision",
      "pipeline",
      "performance",
      "deployment"
    ],
    "phase": 4,
    "lesson": 16,
    "lessonPath": "phases/04-computer-vision/16-vision-pipeline-capstone",
    "file": "phases/04-computer-vision/16-vision-pipeline-capstone/outputs/skill-pipeline-budget-planner.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-ssl-pretraining-picker",
    "description": "dataset size、compute、downstream task に基づいて SimCLR / MAE / DINOv2 を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 17,
    "lessonPath": "phases/04-computer-vision/17-self-supervised-vision",
    "file": "phases/04-computer-vision/17-self-supervised-vision/outputs/prompt-ssl-pretraining-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-linear-probe-runner",
    "description": "任意の frozen encoder と labelled dataset に対する完全な linear-probe evaluation を書く",
    "tags": [
      "self-supervised",
      "evaluation",
      "linear-probe",
      "pytorch"
    ],
    "phase": 4,
    "lesson": 17,
    "lessonPath": "phases/04-computer-vision/17-self-supervised-vision",
    "file": "phases/04-computer-vision/17-self-supervised-vision/outputs/skill-linear-probe-runner.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-zero-shot-class-picker",
    "description": "classes の list と domain に基づき zero-shot CLIP 向け prompt templates を設計する",
    "tags": [],
    "phase": 4,
    "lesson": 18,
    "lessonPath": "phases/04-computer-vision/18-open-vocab-clip",
    "file": "phases/04-computer-vision/18-open-vocab-clip/outputs/prompt-zero-shot-class-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-image-text-retriever",
    "description": "任意の CLIP checkpoint で image embedding index を構築し、query-by-text と query-by-image をサポートする",
    "tags": [
      "clip",
      "retrieval",
      "faiss",
      "zero-shot"
    ],
    "phase": 4,
    "lesson": 18,
    "lessonPath": "phases/04-computer-vision/18-open-vocab-clip",
    "file": "phases/04-computer-vision/18-open-vocab-clip/outputs/skill-image-text-retriever.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-ocr-stack-picker",
    "description": "document type、language、structure に基づいて Tesseract / PaddleOCR / Donut / VLM-OCR を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 19,
    "lessonPath": "phases/04-computer-vision/19-ocr-document-understanding",
    "file": "phases/04-computer-vision/19-ocr-document-understanding/outputs/prompt-ocr-stack-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-ctc-decoder",
    "description": "greedy と beam-search CTC decoders を scratch から書く。length normalisation を含む",
    "tags": [
      "ocr",
      "ctc",
      "decoding",
      "sequence-models"
    ],
    "phase": 4,
    "lesson": 19,
    "lessonPath": "phases/04-computer-vision/19-ocr-document-understanding",
    "file": "phases/04-computer-vision/19-ocr-document-understanding/outputs/skill-ctc-decoder.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-retrieval-loss-picker",
    "description": "retrieval problem に対して triplet / InfoNCE / ProxyNCA を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 20,
    "lessonPath": "phases/04-computer-vision/20-image-retrieval-metric",
    "file": "phases/04-computer-vision/20-image-retrieval-metric/outputs/prompt-retrieval-loss-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-recall-at-k-runner",
    "description": "train/val/gallery splits と適切な data contract を持つ recall@K evaluation harness を書く",
    "tags": [
      "retrieval",
      "evaluation",
      "recall",
      "faiss"
    ],
    "phase": 4,
    "lesson": 20,
    "lessonPath": "phases/04-computer-vision/20-image-retrieval-metric",
    "file": "phases/04-computer-vision/20-image-retrieval-metric/outputs/skill-recall-at-k-runner.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-pose-stack-picker",
    "description": "Pick MediaPipe / YOLOv8-pose / HRNet / ViTPose given latency, crowd size, and 2D vs 3D need",
    "tags": [],
    "phase": 4,
    "lesson": 21,
    "lessonPath": "phases/04-computer-vision/21-keypoint-pose",
    "file": "phases/04-computer-vision/21-keypoint-pose/outputs/prompt-pose-stack-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-heatmap-to-coords",
    "description": "Write the sub-pixel heatmap-to-coordinate routine used by every production pose model",
    "tags": [
      "keypoint",
      "pose",
      "subpixel",
      "inference"
    ],
    "phase": 4,
    "lesson": 21,
    "lessonPath": "phases/04-computer-vision/21-keypoint-pose",
    "file": "phases/04-computer-vision/21-keypoint-pose/outputs/skill-heatmap-to-coords.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-3dgs-capture-planner",
    "description": "Plan a photo capture session for 3DGS reconstruction given scene type and hardware",
    "tags": [],
    "phase": 4,
    "lesson": 22,
    "lessonPath": "phases/04-computer-vision/22-3d-gaussian-splatting",
    "file": "phases/04-computer-vision/22-3d-gaussian-splatting/outputs/prompt-3dgs-capture-planner.md"
  },
  {
    "kind": "skill",
    "name": "skill-3dgs-export-router",
    "description": "Pick the right 3DGS export format (.ply / .splat / glTF KHR_gaussian_splatting / USD) given the downstream viewer or engine",
    "tags": [
      "3d-gaussian-splatting",
      "export",
      "glTF",
      "OpenUSD",
      "pipeline"
    ],
    "phase": 4,
    "lesson": 22,
    "lessonPath": "phases/04-computer-vision/22-3d-gaussian-splatting",
    "file": "phases/04-computer-vision/22-3d-gaussian-splatting/outputs/skill-3dgs-export-router.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-dit-model-picker",
    "description": "Pick between SD3, SD3.5, FLUX.1-dev, FLUX.1-schnell, Z-Image, SD4 Turbo given quality, latency, and license",
    "tags": [],
    "phase": 4,
    "lesson": 23,
    "lessonPath": "phases/04-computer-vision/23-diffusion-transformers-rectified-flow",
    "file": "phases/04-computer-vision/23-diffusion-transformers-rectified-flow/outputs/prompt-dit-model-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-rectified-flow-trainer",
    "description": "Write a complete rectified-flow training loop with AdaLN DiT and Euler sampling",
    "tags": [
      "diffusion",
      "rectified-flow",
      "DiT",
      "training"
    ],
    "phase": 4,
    "lesson": 23,
    "lessonPath": "phases/04-computer-vision/23-diffusion-transformers-rectified-flow",
    "file": "phases/04-computer-vision/23-diffusion-transformers-rectified-flow/outputs/skill-rectified-flow-trainer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-open-vocab-stack-picker",
    "description": "Pick SAM 3 / Grounded SAM 2 / YOLO-World / SAM-MI based on latency, concept complexity, and licensing",
    "tags": [],
    "phase": 4,
    "lesson": 24,
    "lessonPath": "phases/04-computer-vision/24-sam3-open-vocab-segmentation",
    "file": "phases/04-computer-vision/24-sam3-open-vocab-segmentation/outputs/prompt-open-vocab-stack-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-concept-prompt-designer",
    "description": "Turn user utterances into well-formed SAM 3 concept prompts with splitting, disambiguation, and fallbacks",
    "tags": [
      "sam3",
      "open-vocab",
      "prompt-engineering",
      "segmentation"
    ],
    "phase": 4,
    "lesson": 24,
    "lessonPath": "phases/04-computer-vision/24-sam3-open-vocab-segmentation",
    "file": "phases/04-computer-vision/24-sam3-open-vocab-segmentation/outputs/skill-concept-prompt-designer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-vlm-selector",
    "description": "accuracy、latency、context length、budget に基づいて Qwen3-VL / InternVL3.5 / LLaVA-Next / API を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 25,
    "lessonPath": "phases/04-computer-vision/25-vision-language-models",
    "file": "phases/04-computer-vision/25-vision-language-models/outputs/prompt-vlm-selector.md"
  },
  {
    "kind": "skill",
    "name": "skill-cmer-monitor",
    "description": "Cross-Modal Error Rate monitoring、dashboards、alerts を production VLM endpoint に instrument する",
    "tags": [
      "vlm",
      "production",
      "monitoring",
      "hallucination"
    ],
    "phase": 4,
    "lesson": 25,
    "lessonPath": "phases/04-computer-vision/25-vision-language-models",
    "file": "phases/04-computer-vision/25-vision-language-models/outputs/skill-cmer-monitor.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-depth-model-picker",
    "description": "latency、metric-vs-relative need、scene type に基づいて Depth Anything V3 / Marigold / UniDepth / MiDaS を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 26,
    "lessonPath": "phases/04-computer-vision/26-monocular-depth",
    "file": "phases/04-computer-vision/26-monocular-depth/outputs/prompt-depth-model-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-depth-to-pointcloud",
    "description": "正しい intrinsics handling と .ply export を使って depth maps から point clouds を構築する",
    "tags": [
      "depth",
      "point-cloud",
      "3d",
      "intrinsics"
    ],
    "phase": 4,
    "lesson": 26,
    "lessonPath": "phases/04-computer-vision/26-monocular-depth",
    "file": "phases/04-computer-vision/26-monocular-depth/outputs/skill-depth-to-pointcloud.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tracker-picker",
    "description": "scene type、occlusion patterns、latency budget に基づいて SORT / ByteTrack / BoT-SORT / SAM 2 / SAM 3.1 を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 27,
    "lessonPath": "phases/04-computer-vision/27-multi-object-tracking",
    "file": "phases/04-computer-vision/27-multi-object-tracking/outputs/prompt-tracker-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-mot-evaluator",
    "description": "ground-truth tracks に対する MOTA / IDF1 / HOTA の complete evaluation harness を書く",
    "tags": [
      "mot",
      "evaluation",
      "tracking",
      "metrics"
    ],
    "phase": 4,
    "lesson": 27,
    "lessonPath": "phases/04-computer-vision/27-multi-object-tracking",
    "file": "phases/04-computer-vision/27-multi-object-tracking/outputs/skill-mot-evaluator.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-video-model-picker",
    "description": "task、license、latency target に基づいて Sora 2 / Runway Gen-5 / Wan-Video / HunyuanVideo / Cosmos を選ぶ",
    "tags": [],
    "phase": 4,
    "lesson": 28,
    "lessonPath": "phases/04-computer-vision/28-world-models-video-diffusion",
    "file": "phases/04-computer-vision/28-world-models-video-diffusion/outputs/prompt-video-model-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-physical-plausibility-checks",
    "description": "ship 前に任意の generated video に対して object permanence、gravity、continuity の automated checks を行う",
    "tags": [
      "video-generation",
      "quality",
      "physics",
      "evaluation"
    ],
    "phase": 4,
    "lesson": 28,
    "lessonPath": "phases/04-computer-vision/28-world-models-video-diffusion",
    "file": "phases/04-computer-vision/28-world-models-video-diffusion/outputs/skill-physical-plausibility-checks.md"
  },
  {
    "kind": "prompt",
    "name": "preprocessing-advisor",
    "description": "NLP タスクに対して、トークン化、ステミング、レンマ化の構成を推奨します。",
    "tags": [],
    "phase": 5,
    "lesson": 1,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/01-text-processing",
    "file": "phases/05-nlp-foundations-to-advanced/01-text-processing/outputs/prompt-preprocessing-advisor.md"
  },
  {
    "kind": "prompt",
    "name": "vectorization-picker",
    "description": "テキスト分類タスクに対して、BoW、TF-IDF、埋め込み、またはハイブリッドを推奨します。",
    "tags": [],
    "phase": 5,
    "lesson": 2,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf",
    "file": "phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/outputs/prompt-vectorization-picker.md"
  },
  {
    "kind": "skill",
    "name": "embedding-probe",
    "description": "word2vecモデルを点検します。アナロジーを実行し、近傍語を見つけ、品質を診断します。",
    "tags": [
      "nlp",
      "embeddings",
      "debugging"
    ],
    "phase": 5,
    "lesson": 3,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec",
    "file": "phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/outputs/skill-embedding-probe.md"
  },
  {
    "kind": "skill",
    "name": "skill-embeddings-picker",
    "description": "新しい言語モデルまたはテキストパイプライン向けに、tokenization手法を選びます。",
    "tags": [
      "nlp",
      "tokenization",
      "embeddings"
    ],
    "phase": 5,
    "lesson": 4,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword",
    "file": "phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/outputs/skill-embeddings-picker.md"
  },
  {
    "kind": "prompt",
    "name": "sentiment-baseline",
    "description": "新しいデータセット向けの感情分析ベースラインを設計します。",
    "tags": [],
    "phase": 5,
    "lesson": 5,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/05-sentiment-analysis",
    "file": "phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/outputs/prompt-sentiment-baseline.md"
  },
  {
    "kind": "skill",
    "name": "ner-picker",
    "description": "与えられた抽出タスクに適したNER手法を選びます。",
    "tags": [
      "nlp",
      "ner",
      "extraction"
    ],
    "phase": 5,
    "lesson": 6,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/06-named-entity-recognition",
    "file": "phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/outputs/skill-ner-picker.md"
  },
  {
    "kind": "skill",
    "name": "grammar-pipeline",
    "description": "下流NLPタスク向けに古典的なPOS + 依存構造パイプラインを設計する。",
    "tags": [
      "nlp",
      "pos",
      "parsing"
    ],
    "phase": 5,
    "lesson": 7,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing",
    "file": "phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/outputs/skill-grammar-pipeline.md"
  },
  {
    "kind": "prompt",
    "name": "text-encoder-picker",
    "description": "与えられた制約セットに合わせてテキストエンコーダのアーキテクチャを選ぶ。",
    "tags": [],
    "phase": 5,
    "lesson": 8,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text",
    "file": "phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/outputs/prompt-text-encoder-picker.md"
  },
  {
    "kind": "prompt",
    "name": "seq2seq-design",
    "description": "与えられたタスクに対してsequence-to-sequenceパイプラインを設計する。",
    "tags": [],
    "phase": 5,
    "lesson": 9,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence",
    "file": "phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/outputs/prompt-seq2seq-design.md"
  },
  {
    "kind": "prompt",
    "name": "attention-shapes",
    "description": "attention実装のshape bugをデバッグする。",
    "tags": [],
    "phase": 5,
    "lesson": 10,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/10-attention-mechanism",
    "file": "phases/05-nlp-foundations-to-advanced/10-attention-mechanism/outputs/prompt-attention-shapes.md"
  },
  {
    "kind": "skill",
    "name": "mt-evaluator",
    "description": "出荷前に機械翻訳出力を評価する。",
    "tags": [
      "nlp",
      "translation",
      "evaluation"
    ],
    "phase": 5,
    "lesson": 11,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/11-machine-translation",
    "file": "phases/05-nlp-foundations-to-advanced/11-machine-translation/outputs/skill-mt-evaluator.md"
  },
  {
    "kind": "skill",
    "name": "summary-picker",
    "description": "extractive か abstractive かを選び、library 名と factuality check を示す。",
    "tags": [
      "nlp",
      "summarization"
    ],
    "phase": 5,
    "lesson": 12,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/12-text-summarization",
    "file": "phases/05-nlp-foundations-to-advanced/12-text-summarization/outputs/skill-summary-picker.md"
  },
  {
    "kind": "skill",
    "name": "qa-architect",
    "description": "QAアーキテクチャ、検索戦略、評価計画を選ぶ。",
    "tags": [
      "nlp",
      "qa",
      "rag"
    ],
    "phase": 5,
    "lesson": 13,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/13-question-answering",
    "file": "phases/05-nlp-foundations-to-advanced/13-question-answering/outputs/skill-qa-architect.md"
  },
  {
    "kind": "skill",
    "name": "retrieval-picker",
    "description": "与えられたコーパスとクエリパターンに合う検索スタックを選ぶ。",
    "tags": [
      "nlp",
      "retrieval",
      "rag",
      "search"
    ],
    "phase": 5,
    "lesson": 14,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/14-information-retrieval-search",
    "file": "phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/outputs/skill-retrieval-picker.md"
  },
  {
    "kind": "skill",
    "name": "topic-picker",
    "description": "コーパスに対して LDA と BERTopic のどちらを選ぶかを判断し、ライブラリ、調整項目、評価方法を指定する。",
    "tags": [
      "nlp",
      "topic-modeling"
    ],
    "phase": 5,
    "lesson": 15,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/15-topic-modeling",
    "file": "phases/05-nlp-foundations-to-advanced/15-topic-modeling/outputs/skill-topic-picker.md"
  },
  {
    "kind": "prompt",
    "name": "lm-baseline",
    "description": "ニューラル LM を訓練する前に、再現可能な n-gram 言語モデルのベースラインを構築する。",
    "tags": [],
    "phase": 5,
    "lesson": 16,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer",
    "file": "phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/outputs/prompt-lm-baseline.md"
  },
  {
    "kind": "skill",
    "name": "chatbot-architect",
    "description": "指定されたユースケース向けのチャットボット構成を設計する。",
    "tags": [
      "nlp",
      "agents",
      "chatbot"
    ],
    "phase": 5,
    "lesson": 17,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural",
    "file": "phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/outputs/skill-chatbot-architect.md"
  },
  {
    "kind": "skill",
    "name": "multilingual-picker",
    "description": "多言語NLPタスク向けに、ソース言語、対象モデル、評価計画を選ぶ。",
    "tags": [
      "nlp",
      "multilingual",
      "cross-lingual"
    ],
    "phase": 5,
    "lesson": 18,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/18-multilingual-nlp",
    "file": "phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/outputs/skill-multilingual-picker.md"
  },
  {
    "kind": "skill",
    "name": "skill-bpe-vs-wordpiece",
    "description": "与えられたコーパスとデプロイ対象に対して、トークナイザのアルゴリズム、語彙サイズ、ライブラリを選ぶ。",
    "tags": [
      "nlp",
      "tokenization"
    ],
    "phase": 5,
    "lesson": 19,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/19-subword-tokenization",
    "file": "phases/05-nlp-foundations-to-advanced/19-subword-tokenization/outputs/skill-bpe-vs-wordpiece.md"
  },
  {
    "kind": "skill",
    "name": "structured-output-picker",
    "description": "構造化出力の方式、スキーマ設計、検証計画を選ぶ。",
    "tags": [
      "nlp",
      "llm",
      "structured-output"
    ],
    "phase": 5,
    "lesson": 20,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding",
    "file": "phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/outputs/skill-structured-output-picker.md"
  },
  {
    "kind": "skill",
    "name": "nli-picker",
    "description": "分類 / 忠実性 / ゼロショットタスク向けに、NLI モデル、ラベルテンプレート、評価設定を選ぶ。",
    "tags": [
      "nlp",
      "nli",
      "zero-shot"
    ],
    "phase": 5,
    "lesson": 21,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment",
    "file": "phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/outputs/skill-nli-picker.md"
  },
  {
    "kind": "skill",
    "name": "embedding-picker",
    "description": "与えられたコーパスとデプロイ条件に対して、embedding model、次元、retrieval mode を選ぶ。",
    "tags": [
      "nlp",
      "embeddings",
      "retrieval"
    ],
    "phase": 5,
    "lesson": 22,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive",
    "file": "phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/outputs/skill-embedding-picker.md"
  },
  {
    "kind": "skill",
    "name": "chunker",
    "description": "与えられたコーパスと query distribution に対して、chunking strategy、size、overlap を選ぶ。",
    "tags": [
      "nlp",
      "rag",
      "chunking"
    ],
    "phase": 5,
    "lesson": 23,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag",
    "file": "phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/outputs/skill-chunker.md"
  },
  {
    "kind": "skill",
    "name": "coref-picker",
    "description": "coreference approach、evaluation plan、integration strategy を選ぶ。",
    "tags": [
      "nlp",
      "coref",
      "information-extraction"
    ],
    "phase": 5,
    "lesson": 24,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/24-coreference-resolution",
    "file": "phases/05-nlp-foundations-to-advanced/24-coreference-resolution/outputs/skill-coref-picker.md"
  },
  {
    "kind": "skill",
    "name": "entity-linker",
    "description": "entity linking pipeline を設計する。KB、candidate generator、disambiguator、evaluation を含める。",
    "tags": [
      "nlp",
      "entity-linking",
      "knowledge-graph"
    ],
    "phase": 5,
    "lesson": 25,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/25-entity-linking",
    "file": "phases/05-nlp-foundations-to-advanced/25-entity-linking/outputs/skill-entity-linker.md"
  },
  {
    "kind": "skill",
    "name": "re-designer",
    "description": "provenance と canonicalization を備えた relation extraction pipeline を設計する。",
    "tags": [
      "nlp",
      "relation-extraction",
      "knowledge-graph"
    ],
    "phase": 5,
    "lesson": 26,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg",
    "file": "phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/outputs/skill-re-designer.md"
  },
  {
    "kind": "skill",
    "name": "eval-architect",
    "description": "較正済み judge と CI gate を含む LLM 評価計画を設計する。",
    "tags": [
      "nlp",
      "evaluation",
      "rag"
    ],
    "phase": 5,
    "lesson": 27,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks",
    "file": "phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/outputs/skill-eval-architect.md"
  },
  {
    "kind": "skill",
    "name": "long-context-eval",
    "description": "指定された model と use case のために long-context evaluation battery を設計する。",
    "tags": [
      "nlp",
      "long-context",
      "evaluation"
    ],
    "phase": 5,
    "lesson": 28,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/28-long-context-evaluation",
    "file": "phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/outputs/skill-long-context-eval.md"
  },
  {
    "kind": "skill",
    "name": "dst-designer",
    "description": "Dialogue state tracker を設計する。schema、extractor、update policy、evaluation を含める。",
    "tags": [
      "nlp",
      "dialogue",
      "task-oriented"
    ],
    "phase": 5,
    "lesson": 29,
    "lessonPath": "phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking",
    "file": "phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/outputs/skill-dst-designer.md"
  },
  {
    "kind": "skill",
    "name": "audio-loader",
    "description": "生の音声ファイルを対象モデルの期待に照らして検証し、安全にリサンプリングする。",
    "tags": [
      "audio",
      "speech",
      "preprocessing"
    ],
    "phase": 6,
    "lesson": 1,
    "lessonPath": "phases/06-speech-and-audio/01-audio-fundamentals",
    "file": "phases/06-speech-and-audio/01-audio-fundamentals/outputs/skill-audio-loader.md"
  },
  {
    "kind": "skill",
    "name": "feature-extractor",
    "description": "下流の音声モデルに合わせて feature type、mel count、frame/hop、normalization を選ぶ。",
    "tags": [
      "audio",
      "features",
      "spectrogram",
      "mel"
    ],
    "phase": 6,
    "lesson": 2,
    "lessonPath": "phases/06-speech-and-audio/02-spectrograms-mel-features",
    "file": "phases/06-speech-and-audio/02-spectrograms-mel-features/outputs/skill-feature-extractor.md"
  },
  {
    "kind": "skill",
    "name": "classifier-designer",
    "description": "音声分類タスクに対して architecture、augmentation、class-balance strategy、eval metric を選ぶ。",
    "tags": [
      "audio",
      "classification",
      "beats",
      "ast"
    ],
    "phase": 6,
    "lesson": 3,
    "lessonPath": "phases/06-speech-and-audio/03-audio-classification",
    "file": "phases/06-speech-and-audio/03-audio-classification/outputs/skill-classifier-designer.md"
  },
  {
    "kind": "skill",
    "name": "asr-picker",
    "description": "指定された deployment target に対して ASR model、decoding strategy、chunking、LM fusion を選ぶ。",
    "tags": [
      "audio",
      "asr",
      "speech-recognition"
    ],
    "phase": 6,
    "lesson": 4,
    "lessonPath": "phases/06-speech-and-audio/04-speech-recognition-asr",
    "file": "phases/06-speech-and-audio/04-speech-recognition-asr/outputs/skill-asr-picker.md"
  },
  {
    "kind": "skill",
    "name": "whisper-tuner",
    "description": "指定された言語、ドメイン、レイテンシ予算に対して、Whisper のファインチューニングまたは推論パイプラインを設計します。",
    "tags": [
      "audio",
      "whisper",
      "asr",
      "fine-tuning",
      "lora"
    ],
    "phase": 6,
    "lesson": 5,
    "lessonPath": "phases/06-speech-and-audio/05-whisper-architecture-finetuning",
    "file": "phases/06-speech-and-audio/05-whisper-architecture-finetuning/outputs/skill-whisper-tuner.md"
  },
  {
    "kind": "skill",
    "name": "speaker-verifier",
    "description": "モデル選択、登録プロトコル、しきい値調整を含む speaker verification または diarization pipeline を設計します。",
    "tags": [
      "audio",
      "speaker",
      "verification",
      "diarization"
    ],
    "phase": 6,
    "lesson": 6,
    "lessonPath": "phases/06-speech-and-audio/06-speaker-recognition-verification",
    "file": "phases/06-speech-and-audio/06-speaker-recognition-verification/outputs/skill-speaker-verifier.md"
  },
  {
    "kind": "skill",
    "name": "tts-designer",
    "description": "指定された言語、スタイル、レイテンシ目標に対して、TTS model、voice、text-normalization scope、evaluation plan を選びます。",
    "tags": [
      "audio",
      "tts",
      "speech-synthesis"
    ],
    "phase": 6,
    "lesson": 7,
    "lessonPath": "phases/06-speech-and-audio/07-text-to-speech",
    "file": "phases/06-speech-and-audio/07-text-to-speech/outputs/skill-tts-designer.md"
  },
  {
    "kind": "skill",
    "name": "voice-cloner",
    "description": "voice-cloning deployment に対して、cloning approach (zero-shot / conversion / adaptation)、consent artifact、watermark、safety filters を選びます。",
    "tags": [
      "voice-cloning",
      "voice-conversion",
      "watermark",
      "consent",
      "safety"
    ],
    "phase": 6,
    "lesson": 8,
    "lessonPath": "phases/06-speech-and-audio/08-voice-cloning-conversion",
    "file": "phases/06-speech-and-audio/08-voice-cloning-conversion/outputs/skill-voice-cloner.md"
  },
  {
    "kind": "skill",
    "name": "music-designer",
    "description": "デプロイ向けに、音楽生成モデル、ライセンス戦略、長さの計画、開示 metadata を選ぶ。",
    "tags": [
      "music-generation",
      "musicgen",
      "stable-audio",
      "suno",
      "licensing"
    ],
    "phase": 6,
    "lesson": 9,
    "lessonPath": "phases/06-speech-and-audio/09-music-generation",
    "file": "phases/06-speech-and-audio/09-music-generation/outputs/skill-music-designer.md"
  },
  {
    "kind": "skill",
    "name": "alm-picker",
    "description": "音声理解タスク向けに、audio-language model、benchmark subset、output modality（text vs speech）、guardrails を選ぶ。",
    "tags": [
      "alm",
      "lalm",
      "qwen-omni",
      "audio-flamingo",
      "gemini-audio",
      "mmau"
    ],
    "phase": 6,
    "lesson": 10,
    "lessonPath": "phases/06-speech-and-audio/10-audio-language-models",
    "file": "phases/06-speech-and-audio/10-audio-language-models/outputs/skill-alm-picker.md"
  },
  {
    "kind": "skill",
    "name": "realtime-voice-pipeline",
    "description": "目標 end-to-end latency に合わせて、transport、VAD、streaming STT、LLM、streaming TTS、orchestration を選ぶ。",
    "tags": [
      "voice-agent",
      "livekit",
      "pipecat",
      "silero",
      "streaming",
      "latency"
    ],
    "phase": 6,
    "lesson": 11,
    "lessonPath": "phases/06-speech-and-audio/11-real-time-audio-processing",
    "file": "phases/06-speech-and-audio/11-real-time-audio-processing/outputs/skill-realtime-pipeline.md"
  },
  {
    "kind": "skill",
    "name": "voice-assistant-architect",
    "description": "与えられた workload に対して、components、latency budget、observability、compliance を含む full-stack voice-assistant spec を作る。",
    "tags": [
      "voice-assistant",
      "architecture",
      "livekit",
      "pipecat",
      "compliance"
    ],
    "phase": 6,
    "lesson": 12,
    "lessonPath": "phases/06-speech-and-audio/12-voice-assistant-pipeline",
    "file": "phases/06-speech-and-audio/12-voice-assistant-pipeline/outputs/skill-voice-assistant-architect.md"
  },
  {
    "kind": "skill",
    "name": "codec-picker",
    "description": "与えられた生成または圧縮タスクに対して neural audio codec (EnCodec / DAC / SNAC / Mimi) を選ぶ。",
    "tags": [
      "codec",
      "encodec",
      "dac",
      "snac",
      "mimi",
      "rvq",
      "semantic-tokens"
    ],
    "phase": 6,
    "lesson": 13,
    "lessonPath": "phases/06-speech-and-audio/13-neural-audio-codecs",
    "file": "phases/06-speech-and-audio/13-neural-audio-codecs/outputs/skill-codec-picker.md"
  },
  {
    "kind": "skill",
    "name": "vad-tuner",
    "description": "音声エージェント向けに VAD model、threshold、silence hangover、pre-roll、turn-detection strategy を選ぶ。",
    "tags": [
      "vad",
      "silero",
      "cobra",
      "turn-detection",
      "flush-trick"
    ],
    "phase": 6,
    "lesson": 14,
    "lessonPath": "phases/06-speech-and-audio/14-voice-activity-detection-turn-taking",
    "file": "phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/outputs/skill-vad-tuner.md"
  },
  {
    "kind": "skill",
    "name": "duplex-pipeline",
    "description": "音声エージェントのワークロードに対して full-duplex (Moshi) と pipeline (VAD + STT + LLM + TTS) architecture のどちらを選ぶか決める。",
    "tags": [
      "moshi",
      "hibiki",
      "full-duplex",
      "voice-agent",
      "streaming"
    ],
    "phase": 6,
    "lesson": 15,
    "lessonPath": "phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki",
    "file": "phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki/outputs/skill-duplex-pipeline.md"
  },
  {
    "kind": "skill",
    "name": "spoof-defender",
    "description": "voice-generation / voice-auth deployment 向けに detection model、watermark、provenance manifest、operational playbook を選ぶ。",
    "tags": [
      "anti-spoofing",
      "watermark",
      "audioseal",
      "asvspoof",
      "c2pa",
      "voice-fraud"
    ],
    "phase": 6,
    "lesson": 16,
    "lessonPath": "phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking",
    "file": "phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/outputs/skill-spoof-defender.md"
  },
  {
    "kind": "skill",
    "name": "audio-evaluator",
    "description": "任意の audio model release に対して metrics、benchmarks、normalization rules、reporting format を選ぶ。",
    "tags": [
      "evaluation",
      "wer",
      "mos",
      "utmos",
      "eer",
      "der",
      "fad",
      "mmau",
      "leaderboard"
    ],
    "phase": 6,
    "lesson": 17,
    "lessonPath": "phases/06-speech-and-audio/17-audio-evaluation-metrics",
    "file": "phases/06-speech-and-audio/17-audio-evaluation-metrics/outputs/skill-audio-evaluator.md"
  },
  {
    "kind": "skill",
    "name": "sequence-architecture-picker",
    "description": "長さ、スループット、学習予算に基づいて系列アーキテクチャ（RNN、transformer、SSM、hybrid）を選ぶ。",
    "tags": [
      "transformers",
      "architecture",
      "rnn",
      "ssm"
    ],
    "phase": 7,
    "lesson": 1,
    "lessonPath": "phases/07-transformers-deep-dive/01-why-transformers",
    "file": "phases/07-transformers-deep-dive/01-why-transformers/outputs/skill-architecture-picker.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-attention-explainer",
    "description": "データベース検索のアナロジーで attention mechanism を説明する",
    "tags": [],
    "phase": 7,
    "lesson": 2,
    "lessonPath": "phases/07-transformers-deep-dive/02-self-attention-from-scratch",
    "file": "phases/07-transformers-deep-dive/02-self-attention-from-scratch/outputs/prompt-attention-explainer.md"
  },
  {
    "kind": "skill",
    "name": "mha-configurator",
    "description": "新しい transformer に対して head count、KV-head count、projection strategy（MHA / MQA / GQA / MLA）を推奨する。",
    "tags": [
      "transformers",
      "attention",
      "mha",
      "gqa"
    ],
    "phase": 7,
    "lesson": 3,
    "lessonPath": "phases/07-transformers-deep-dive/03-multi-head-attention",
    "file": "phases/07-transformers-deep-dive/03-multi-head-attention/outputs/skill-mha-configurator.md"
  },
  {
    "kind": "skill",
    "name": "positional-encoding-picker",
    "description": "context length と学習予算に基づいて positional encoding（RoPE、ALiBi、sinusoidal）と scaling strategy を選ぶ。",
    "tags": [
      "transformers",
      "positional-encoding",
      "rope",
      "alibi"
    ],
    "phase": 7,
    "lesson": 4,
    "lessonPath": "phases/07-transformers-deep-dive/04-positional-encoding",
    "file": "phases/07-transformers-deep-dive/04-positional-encoding/outputs/skill-positional-encoding-picker.md"
  },
  {
    "kind": "skill",
    "name": "transformer-block-reviewer",
    "description": "Transformer block 実装を 2026 年の default と照らして review し、ずれを指摘する。",
    "tags": [
      "transformers",
      "architecture",
      "review"
    ],
    "phase": 7,
    "lesson": 5,
    "lessonPath": "phases/07-transformers-deep-dive/05-full-transformer",
    "file": "phases/07-transformers-deep-dive/05-full-transformer/outputs/skill-transformer-block-reviewer.md"
  },
  {
    "kind": "skill",
    "name": "bert-finetuner",
    "description": "新しい classification、extraction、retrieval task 向けの BERT fine-tune を scope する。",
    "tags": [
      "bert",
      "fine-tuning",
      "nlp"
    ],
    "phase": 7,
    "lesson": 6,
    "lessonPath": "phases/07-transformers-deep-dive/06-bert-masked-language-modeling",
    "file": "phases/07-transformers-deep-dive/06-bert-masked-language-modeling/outputs/skill-bert-finetuner.md"
  },
  {
    "kind": "skill",
    "name": "sampling-tuner",
    "description": "与えられた generation task に対して decoding strategy (greedy / temperature / top-k / top-p / min-p / speculative) を選ぶ。",
    "tags": [
      "gpt",
      "sampling",
      "decoding",
      "inference"
    ],
    "phase": 7,
    "lesson": 7,
    "lessonPath": "phases/07-transformers-deep-dive/07-gpt-causal-language-modeling",
    "file": "phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/outputs/skill-sampling-tuner.md"
  },
  {
    "kind": "skill",
    "name": "seq2seq-picker",
    "description": "新しい sequence-to-sequence task に対して encoder-decoder と decoder-only のどちらを選ぶかを決める。",
    "tags": [
      "transformers",
      "t5",
      "bart",
      "seq2seq"
    ],
    "phase": 7,
    "lesson": 8,
    "lessonPath": "phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder",
    "file": "phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/outputs/skill-seq2seq-picker.md"
  },
  {
    "kind": "skill",
    "name": "vit-configurator",
    "description": "新しいビジョンタスク向けに ViT variant、patch size、pretraining source を選ぶ。",
    "tags": [
      "transformers",
      "vit",
      "vision"
    ],
    "phase": 7,
    "lesson": 9,
    "lessonPath": "phases/07-transformers-deep-dive/09-vision-transformers",
    "file": "phases/07-transformers-deep-dive/09-vision-transformers/outputs/skill-vit-configurator.md"
  },
  {
    "kind": "skill",
    "name": "asr-configurator",
    "description": "新しい speech pipeline 向けに ASR model (Whisper variant / Moonshine / faster-whisper) と decoding parameters を選ぶ。",
    "tags": [
      "transformers",
      "whisper",
      "asr",
      "speech"
    ],
    "phase": 7,
    "lesson": 10,
    "lessonPath": "phases/07-transformers-deep-dive/10-audio-transformers-whisper",
    "file": "phases/07-transformers-deep-dive/10-audio-transformers-whisper/outputs/skill-asr-configurator.md"
  },
  {
    "kind": "skill",
    "name": "moe-configurator",
    "description": "新しい MoE transformer 向けに expert count、top-k、balancing strategy、shared-expert layout を選ぶ。",
    "tags": [
      "transformers",
      "moe",
      "mixture-of-experts",
      "scaling"
    ],
    "phase": 7,
    "lesson": 11,
    "lessonPath": "phases/07-transformers-deep-dive/11-mixture-of-experts",
    "file": "phases/07-transformers-deep-dive/11-mixture-of-experts/outputs/skill-moe-configurator.md"
  },
  {
    "kind": "skill",
    "name": "inference-optimizer",
    "description": "新しい inference deployment 向けに attention implementation、KV cache strategy、quantization、speculative decoding を選ぶ。",
    "tags": [
      "transformers",
      "inference",
      "flash-attention",
      "kv-cache"
    ],
    "phase": 7,
    "lesson": 12,
    "lessonPath": "phases/07-transformers-deep-dive/12-kv-cache-flash-attention",
    "file": "phases/07-transformers-deep-dive/12-kv-cache-flash-attention/outputs/skill-inference-optimizer.md"
  },
  {
    "kind": "skill",
    "name": "training-budget-estimator",
    "description": "compute budget と deployment constraints に基づき、新しい transformer training run の (N, D, hours, GPU count) を見積もる。",
    "tags": [
      "scaling-laws",
      "training",
      "chinchilla"
    ],
    "phase": 7,
    "lesson": 13,
    "lessonPath": "phases/07-transformers-deep-dive/13-scaling-laws",
    "file": "phases/07-transformers-deep-dive/13-scaling-laws/outputs/skill-training-budget-estimator.md"
  },
  {
    "kind": "skill",
    "name": "transformer-review",
    "description": "transformer-from-scratch implementation を 13 個の Phase 7 lessons に照らして review する。",
    "tags": [
      "transformers",
      "review",
      "capstone"
    ],
    "phase": 7,
    "lesson": 14,
    "lessonPath": "phases/07-transformers-deep-dive/14-build-a-transformer-capstone",
    "file": "phases/07-transformers-deep-dive/14-build-a-transformer-capstone/outputs/skill-transformer-review.md"
  },
  {
    "kind": "skill",
    "name": "attention-variant-picker",
    "description": "context length、retrieval demands、compute profile に基づき、新しい model の full / sliding-window / sparse / differential attention topology を選ぶ。",
    "tags": [
      "attention",
      "transformer",
      "long-context",
      "inference",
      "memory"
    ],
    "phase": 7,
    "lesson": 15,
    "lessonPath": "phases/07-transformers-deep-dive/15-attention-variants",
    "file": "phases/07-transformers-deep-dive/15-attention-variants/outputs/skill-attention-variant-picker.md"
  },
  {
    "kind": "skill",
    "name": "spec-decode-picker",
    "description": "新しい LLM inference workload 向けに speculative decoding strategy (vanilla / Medusa / EAGLE / lookahead) と tuning parameters を選ぶ。",
    "tags": [
      "inference",
      "decoding",
      "latency",
      "speculative",
      "optimization"
    ],
    "phase": 7,
    "lesson": 16,
    "lessonPath": "phases/07-transformers-deep-dive/16-speculative-decoding",
    "file": "phases/07-transformers-deep-dive/16-speculative-decoding/outputs/skill-spec-decode-picker.md"
  },
  {
    "kind": "skill",
    "name": "generative-model-chooser",
    "description": "タスクと予算に応じて、生成モデルのファミリー、バックボーン、ホスト型代替案を選ぶ。",
    "tags": [
      "generative",
      "taxonomy"
    ],
    "phase": 8,
    "lesson": 1,
    "lessonPath": "phases/08-generative-ai/01-generative-models-taxonomy-history",
    "file": "phases/08-generative-ai/01-generative-models-taxonomy-history/outputs/skill-model-chooser.md"
  },
  {
    "kind": "skill",
    "name": "vae-trainer",
    "description": "データセットと下流用途に応じて、VAE アーキテクチャ、潜在サイズ、beta スケジュール、評価計画を指定する。",
    "tags": [
      "vae",
      "latent",
      "generative"
    ],
    "phase": 8,
    "lesson": 2,
    "lessonPath": "phases/08-generative-ai/02-autoencoders-vae",
    "file": "phases/08-generative-ai/02-autoencoders-vae/outputs/skill-vae-trainer.md"
  },
  {
    "kind": "skill",
    "name": "gan-debugger",
    "description": "loss curve と sample grid から失敗している GAN 学習を診断し、1行の修正策を処方する。",
    "tags": [
      "gan",
      "adversarial",
      "debugging"
    ],
    "phase": 8,
    "lesson": 3,
    "lessonPath": "phases/08-generative-ai/03-gans-generator-discriminator",
    "file": "phases/08-generative-ai/03-gans-generator-discriminator/outputs/skill-gan-debugger.md"
  },
  {
    "kind": "skill",
    "name": "img2img-chooser",
    "description": "paired / unpaired data、ドメインの具体性、レイテンシ予算に応じて image-to-image 手法を選ぶ。",
    "tags": [
      "pix2pix",
      "img2img",
      "conditional"
    ],
    "phase": 8,
    "lesson": 4,
    "lessonPath": "phases/08-generative-ai/04-conditional-gans-pix2pix",
    "file": "phases/08-generative-ai/04-conditional-gans-pix2pix/outputs/skill-img2img-chooser.md"
  },
  {
    "kind": "skill",
    "name": "stylegan-inversion",
    "description": "実写真に対する pretrained StyleGAN の inversion と editing pipeline を選択する。",
    "tags": [
      "stylegan",
      "inversion",
      "editing"
    ],
    "phase": 8,
    "lesson": 5,
    "lessonPath": "phases/08-generative-ai/05-stylegan",
    "file": "phases/08-generative-ai/05-stylegan/outputs/skill-stylegan-inversion.md"
  },
  {
    "kind": "skill",
    "name": "diffusion-trainer",
    "description": "diffusion training run の schedule、prediction target、sampler、eval plan を構成する。",
    "tags": [
      "diffusion",
      "ddpm",
      "training"
    ],
    "phase": 8,
    "lesson": 6,
    "lessonPath": "phases/08-generative-ai/06-diffusion-ddpm-from-scratch",
    "file": "phases/08-generative-ai/06-diffusion-ddpm-from-scratch/outputs/skill-diffusion-trainer.md"
  },
  {
    "kind": "skill",
    "name": "sd-prompter",
    "description": "指定された prompt、style、quality bar に対して Stable Diffusion / Flux inference を構成する。",
    "tags": [
      "stable-diffusion",
      "flux",
      "latent-diffusion"
    ],
    "phase": 8,
    "lesson": 7,
    "lessonPath": "phases/08-generative-ai/07-latent-diffusion-stable-diffusion",
    "file": "phases/08-generative-ai/07-latent-diffusion-stable-diffusion/outputs/skill-sd-prompter.md"
  },
  {
    "kind": "skill",
    "name": "sd-toolkit-composer",
    "description": "指定された inputs に対し、SD / Flux base の上に ControlNets、LoRAs、IP-Adapters を構成する。",
    "tags": [
      "controlnet",
      "lora",
      "ip-adapter",
      "diffusion"
    ],
    "phase": 8,
    "lesson": 8,
    "lessonPath": "phases/08-generative-ai/08-controlnet-lora-conditioning",
    "file": "phases/08-generative-ai/08-controlnet-lora-conditioning/outputs/skill-sd-toolkit-composer.md"
  },
  {
    "kind": "skill",
    "name": "editing-pipeline",
    "description": "元画像と編集説明から、出荷可能な出力までの画像編集パイプラインを計画する。",
    "tags": [
      "inpaint",
      "outpaint",
      "edit",
      "sam"
    ],
    "phase": 8,
    "lesson": 9,
    "lessonPath": "phases/08-generative-ai/09-inpainting-outpainting-editing",
    "file": "phases/08-generative-ai/09-inpainting-outpainting-editing/outputs/skill-editing-pipeline.md"
  },
  {
    "kind": "skill",
    "name": "video-brief",
    "description": "動画 brief を、2026 年の動画生成器向けの model + prompt + shot plan に変換する。",
    "tags": [
      "video",
      "diffusion",
      "sora",
      "veo",
      "kling"
    ],
    "phase": 8,
    "lesson": 10,
    "lessonPath": "phases/08-generative-ai/10-video-generation",
    "file": "phases/08-generative-ai/10-video-generation/outputs/skill-video-brief.md"
  },
  {
    "kind": "skill",
    "name": "audio-brief",
    "description": "audio brief を、TTS、music、SFX にまたがる model + prompt + eval plan に変換する。",
    "tags": [
      "audio",
      "tts",
      "music",
      "sfx",
      "codec"
    ],
    "phase": 8,
    "lesson": 11,
    "lessonPath": "phases/08-generative-ai/11-audio-generation",
    "file": "phases/08-generative-ai/11-audio-generation/outputs/skill-audio-brief.md"
  },
  {
    "kind": "skill",
    "name": "3d-pipeline",
    "description": "input type、output format、use case に基づいて 3D generation または reconstruction pipeline を選ぶ。",
    "tags": [
      "3d",
      "gaussian-splatting",
      "nerf",
      "mesh"
    ],
    "phase": 8,
    "lesson": 12,
    "lessonPath": "phases/08-generative-ai/12-3d-generation",
    "file": "phases/08-generative-ai/12-3d-generation/outputs/skill-3d-pipeline.md"
  },
  {
    "kind": "skill",
    "name": "fm-tuner",
    "description": "Diffusion training plan を flow-matching / rectified-flow config に変換する。",
    "tags": [
      "flow-matching",
      "rectified-flow",
      "diffusion"
    ],
    "phase": 8,
    "lesson": 13,
    "lessonPath": "phases/08-generative-ai/13-flow-matching-rectified-flows",
    "file": "phases/08-generative-ai/13-flow-matching-rectified-flows/outputs/skill-fm-tuner.md"
  },
  {
    "kind": "skill",
    "name": "eval-report",
    "description": "Generative-model evaluation 全体を計画する。sample quality、adherence、preference、failure audit。",
    "tags": [
      "evaluation",
      "fid",
      "clip",
      "elo"
    ],
    "phase": 8,
    "lesson": 14,
    "lessonPath": "phases/08-generative-ai/14-evaluation-fid-clip-score",
    "file": "phases/08-generative-ai/14-evaluation-fid-clip-score/outputs/skill-eval-report.md"
  },
  {
    "kind": "skill",
    "name": "var-tokenizer-designer",
    "description": "Next-scale visual autoregressive image generation 用の multi-scale residual VQ tokenizer を設計する。",
    "tags": [
      "var",
      "next-scale-prediction",
      "vq-vae",
      "residual-vq",
      "image-generation",
      "tokenizer"
    ],
    "phase": 8,
    "lesson": 19,
    "lessonPath": "phases/08-generative-ai/19-visual-autoregressive-var",
    "file": "phases/08-generative-ai/19-visual-autoregressive-var/outputs/skill-var-tokenizer-designer.md"
  },
  {
    "kind": "skill",
    "name": "mdp-modeler",
    "description": "タスク説明を受け取り、Markov Decision Process の仕様を作成し、訓練前に定式化リスクを指摘する。",
    "tags": [
      "rl",
      "mdp",
      "modeling"
    ],
    "phase": 9,
    "lesson": 1,
    "lessonPath": "phases/09-reinforcement-learning/01-mdps-states-actions-rewards",
    "file": "phases/09-reinforcement-learning/01-mdps-states-actions-rewards/outputs/skill-mdp-modeler.md"
  },
  {
    "kind": "skill",
    "name": "dp-solver",
    "description": "小さな表形式 MDP を policy iteration または value iteration で厳密に解く。収束挙動を報告する。",
    "tags": [
      "rl",
      "dynamic-programming",
      "bellman"
    ],
    "phase": 9,
    "lesson": 2,
    "lessonPath": "phases/09-reinforcement-learning/02-dynamic-programming",
    "file": "phases/09-reinforcement-learning/02-dynamic-programming/outputs/skill-dp-solver.md"
  },
  {
    "kind": "skill",
    "name": "mc-evaluator",
    "description": "Monte Carlo rollouts で方策を評価し、可能なら DP 比較付きの収束レポートを作成する。",
    "tags": [
      "rl",
      "monte-carlo",
      "evaluation"
    ],
    "phase": 9,
    "lesson": 3,
    "lessonPath": "phases/09-reinforcement-learning/03-monte-carlo-methods",
    "file": "phases/09-reinforcement-learning/03-monte-carlo-methods/outputs/skill-mc-evaluator.md"
  },
  {
    "kind": "skill",
    "name": "td-agent",
    "description": "表形式または小さな特徴量の RL タスクについて、Q-learning、SARSA、Expected SARSA から選ぶ。",
    "tags": [
      "rl",
      "td-learning",
      "q-learning",
      "sarsa"
    ],
    "phase": 9,
    "lesson": 4,
    "lessonPath": "phases/09-reinforcement-learning/04-q-learning-sarsa",
    "file": "phases/09-reinforcement-learning/04-q-learning-sarsa/outputs/skill-td-agent.md"
  },
  {
    "kind": "skill",
    "name": "dqn-trainer",
    "description": "離散行動 RL タスク向けに DQN training config（buffer、target sync、ε schedule、reward clipping）を作成する。",
    "tags": [
      "rl",
      "dqn",
      "deep-rl"
    ],
    "phase": 9,
    "lesson": 5,
    "lessonPath": "phases/09-reinforcement-learning/05-dqn",
    "file": "phases/09-reinforcement-learning/05-dqn/outputs/skill-dqn-trainer.md"
  },
  {
    "kind": "skill",
    "name": "policy-gradient-trainer",
    "description": "与えられたタスク向けに REINFORCE / actor-critic / PPO training config を作成し、variance の問題を診断する。",
    "tags": [
      "rl",
      "policy-gradient",
      "reinforce"
    ],
    "phase": 9,
    "lesson": 6,
    "lessonPath": "phases/09-reinforcement-learning/06-policy-gradients-reinforce",
    "file": "phases/09-reinforcement-learning/06-policy-gradients-reinforce/outputs/skill-policy-gradient-trainer.md"
  },
  {
    "kind": "skill",
    "name": "actor-critic-trainer",
    "description": "与えられた環境向けに、advantage estimation と loss weights を指定した A2C / A3C / GAE configuration を作成する。",
    "tags": [
      "rl",
      "actor-critic",
      "gae"
    ],
    "phase": 9,
    "lesson": 7,
    "lessonPath": "phases/09-reinforcement-learning/07-actor-critic-a2c-a3c",
    "file": "phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/outputs/skill-actor-critic-trainer.md"
  },
  {
    "kind": "skill",
    "name": "ppo-trainer",
    "description": "与えられた環境向けに PPO training config と diagnostic plan を作成する。",
    "tags": [
      "rl",
      "ppo",
      "policy-gradient"
    ],
    "phase": 9,
    "lesson": 8,
    "lessonPath": "phases/09-reinforcement-learning/08-ppo",
    "file": "phases/09-reinforcement-learning/08-ppo/outputs/skill-ppo-trainer.md"
  },
  {
    "kind": "skill",
    "name": "rlhf-architect",
    "description": "RM、KL、データ戦略を含め、言語モデル向けの RLHF / DPO / GRPO alignment pipeline を設計する。",
    "tags": [
      "rl",
      "rlhf",
      "alignment",
      "llm"
    ],
    "phase": 9,
    "lesson": 9,
    "lessonPath": "phases/09-reinforcement-learning/09-reward-modeling-rlhf",
    "file": "phases/09-reinforcement-learning/09-reward-modeling-rlhf/outputs/skill-rlhf-architect.md"
  },
  {
    "kind": "skill",
    "name": "marl-architect",
    "description": "与えられた task に対して適切な multi-agent RL regime (IPPO, CTDE, self-play, league) を選ぶ。",
    "tags": [
      "rl",
      "multi-agent",
      "marl",
      "self-play"
    ],
    "phase": 9,
    "lesson": 10,
    "lessonPath": "phases/09-reinforcement-learning/10-multi-agent-rl",
    "file": "phases/09-reinforcement-learning/10-multi-agent-rl/outputs/skill-marl-architect.md"
  },
  {
    "kind": "skill",
    "name": "sim2real-planner",
    "description": "与えられた robot + task に対して、DR、SI、安全性を含む sim-to-real transfer pipeline を計画する。",
    "tags": [
      "rl",
      "sim2real",
      "robotics",
      "domain-randomization"
    ],
    "phase": 9,
    "lesson": 11,
    "lessonPath": "phases/09-reinforcement-learning/11-sim-to-real-transfer",
    "file": "phases/09-reinforcement-learning/11-sim-to-real-transfer/outputs/skill-sim2real-planner.md"
  },
  {
    "kind": "skill",
    "name": "game-rl-designer",
    "description": "与えられた domain に対して game-RL または reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) を設計する。",
    "tags": [
      "rl",
      "alphazero",
      "muzero",
      "grpo",
      "self-play"
    ],
    "phase": 9,
    "lesson": 12,
    "lessonPath": "phases/09-reinforcement-learning/12-rl-for-games",
    "file": "phases/09-reinforcement-learning/12-rl-for-games/outputs/skill-game-rl-designer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tokenizer-analyzer",
    "description": "指定されたテキストについて、複数のモデルとトークナイザー種別にまたがってトークナイゼーション効率を分析する",
    "tags": [],
    "phase": 10,
    "lesson": 1,
    "lessonPath": "phases/10-llms-from-scratch/01-tokenizers",
    "file": "phases/10-llms-from-scratch/01-tokenizers/outputs/prompt-tokenizer-analyzer.md"
  },
  {
    "kind": "skill",
    "name": "skill-tokenizer",
    "description": "LLM プロジェクト向けのトークナイザー選定と構築",
    "tags": [
      "tokenizer",
      "bpe",
      "wordpiece",
      "sentencepiece",
      "llm",
      "nlp"
    ],
    "phase": 10,
    "lesson": 1,
    "lessonPath": "phases/10-llms-from-scratch/01-tokenizers",
    "file": "phases/10-llms-from-scratch/01-tokenizers/outputs/skill-tokenizer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tokenizer-builder",
    "description": "LLM プロジェクト向けの本番品質トークナイザーを構築、デバッグする",
    "tags": [
      "tokenizer",
      "bpe",
      "byte-level",
      "special-tokens",
      "chat-template",
      "multilingual"
    ],
    "phase": 10,
    "lesson": 2,
    "lessonPath": "phases/10-llms-from-scratch/02-building-a-tokenizer",
    "file": "phases/10-llms-from-scratch/02-building-a-tokenizer/outputs/prompt-tokenizer-builder.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-data-quality-checker",
    "description": "LLM 事前学習パイプラインのデータ品質を検証し、デバッグする",
    "tags": [
      "data-pipeline",
      "deduplication",
      "quality-filter",
      "pre-training",
      "llm",
      "data-cleaning"
    ],
    "phase": 10,
    "lesson": 3,
    "lessonPath": "phases/10-llms-from-scratch/03-data-pipelines",
    "file": "phases/10-llms-from-scratch/03-data-pipelines/outputs/prompt-data-quality-checker.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-gpt-architecture-analyzer",
    "description": "任意の GPT 風 transformer モデルにおけるアーキテクチャ選択を分析する",
    "tags": [
      "gpt",
      "transformer",
      "architecture",
      "attention",
      "kv-cache",
      "scaling",
      "pre-training"
    ],
    "phase": 10,
    "lesson": 4,
    "lessonPath": "phases/10-llms-from-scratch/04-pre-training-mini-gpt",
    "file": "phases/10-llms-from-scratch/04-pre-training-mini-gpt/outputs/prompt-gpt-architecture-analyzer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-distributed-training-planner",
    "description": "モデルサイズと利用可能なハードウェアに基づいて分散学習実行を計画する",
    "tags": [
      "distributed-training",
      "fsdp",
      "deepspeed",
      "tensor-parallelism",
      "pipeline-parallelism",
      "scaling"
    ],
    "phase": 10,
    "lesson": 5,
    "lessonPath": "phases/10-llms-from-scratch/05-scaling-distributed",
    "file": "phases/10-llms-from-scratch/05-scaling-distributed/outputs/prompt-distributed-training-planner.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-sft-data-curator",
    "description": "教師ありファインチューニング向けの指示データセットを設計し、キュレーションする",
    "tags": [
      "sft",
      "instruction-tuning",
      "fine-tuning",
      "data-curation",
      "alignment"
    ],
    "phase": 10,
    "lesson": 6,
    "lessonPath": "phases/10-llms-from-scratch/06-instruction-tuning-sft",
    "file": "phases/10-llms-from-scratch/06-instruction-tuning-sft/outputs/prompt-sft-data-curator.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-reward-model-designer",
    "description": "RLHFアラインメント向けの報酬モデル訓練パイプラインを設計する",
    "tags": [
      "rlhf",
      "reward-model",
      "ppo",
      "alignment",
      "human-feedback",
      "preference-learning"
    ],
    "phase": 10,
    "lesson": 7,
    "lessonPath": "phases/10-llms-from-scratch/07-rlhf",
    "file": "phases/10-llms-from-scratch/07-rlhf/outputs/prompt-reward-model-designer.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-alignment-method-selector",
    "description": "ユースケースに合ったアラインメント手法（SFT、RLHF、DPO、KTO、ORPO、SimPO）を選ぶ",
    "tags": [
      "alignment",
      "dpo",
      "rlhf",
      "kto",
      "orpo",
      "simpo",
      "preference-optimization",
      "fine-tuning"
    ],
    "phase": 10,
    "lesson": 8,
    "lessonPath": "phases/10-llms-from-scratch/08-dpo",
    "file": "phases/10-llms-from-scratch/08-dpo/outputs/prompt-alignment-method-selector.md"
  },
  {
    "kind": "skill",
    "name": "self-improvement-auditor",
    "description": "大規模実行前に、提案された自己改善または Constitutional AI パイプラインを監査する。",
    "tags": [
      "alignment",
      "cai",
      "grpo",
      "rlhf",
      "self-improvement",
      "reward-hacking"
    ],
    "phase": 10,
    "lesson": 9,
    "lessonPath": "phases/10-llms-from-scratch/09-constitutional-ai-self-improvement",
    "file": "phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/outputs/skill-self-improvement-auditor.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-eval-designer",
    "description": "任意の LLM task に対して、test cases、scoring functions、pass/fail thresholds を含む custom evaluation suite を設計する。",
    "tags": [],
    "phase": 10,
    "lesson": 10,
    "lessonPath": "phases/10-llms-from-scratch/10-evaluation",
    "file": "phases/10-llms-from-scratch/10-evaluation/outputs/prompt-eval-designer.md"
  },
  {
    "kind": "skill",
    "name": "skill-llm-evaluation",
    "description": "task type、budget、requirements に基づいて適切な LLM evaluation strategy を選ぶための decision framework",
    "tags": [
      "evaluation",
      "evals",
      "benchmarks",
      "llm-as-judge",
      "elo",
      "metrics"
    ],
    "phase": 10,
    "lesson": 10,
    "lessonPath": "phases/10-llms-from-scratch/10-evaluation",
    "file": "phases/10-llms-from-scratch/10-evaluation/outputs/skill-llm-evaluation.md"
  },
  {
    "kind": "skill",
    "name": "skill-quantization",
    "description": "hardware、品質、latency 制約に基づいて LLM deployment に適した量子化戦略を選ぶ",
    "tags": [
      "quantization",
      "inference",
      "deployment",
      "optimization",
      "fp8",
      "int4",
      "int8",
      "gptq",
      "awq",
      "gguf"
    ],
    "phase": 10,
    "lesson": 11,
    "lessonPath": "phases/10-llms-from-scratch/11-quantization",
    "file": "phases/10-llms-from-scratch/11-quantization/outputs/skill-quantization.md"
  },
  {
    "kind": "skill",
    "name": "skill-inference-optimization",
    "description": "LLM inference serving の throughput、latency、cost を診断して最適化する",
    "tags": [
      "inference",
      "kv-cache",
      "batching",
      "speculative-decoding",
      "vllm",
      "optimization"
    ],
    "phase": 10,
    "lesson": 12,
    "lessonPath": "phases/10-llms-from-scratch/12-inference-optimization",
    "file": "phases/10-llms-from-scratch/12-inference-optimization/outputs/skill-inference-optimization.md"
  },
  {
    "kind": "skill",
    "name": "llm-pipeline-reviewer",
    "description": "multi-million-dollar run の前に、end-to-end LLM training pipeline manifest を review する",
    "tags": [
      "pipeline",
      "training",
      "manifest",
      "eval-gate",
      "cost",
      "rollback"
    ],
    "phase": 10,
    "lesson": 13,
    "lessonPath": "phases/10-llms-from-scratch/13-building-complete-llm-pipeline",
    "file": "phases/10-llms-from-scratch/13-building-complete-llm-pipeline/outputs/skill-llm-pipeline-reviewer.md"
  },
  {
    "kind": "skill",
    "name": "open-model-picker",
    "description": "deployment target に合わせて open LLM family、quantization、inference stack を選ぶ",
    "tags": [
      "open-models",
      "llama",
      "deepseek",
      "mixtral",
      "qwen",
      "gemma",
      "moe",
      "gqa",
      "mla",
      "quantization"
    ],
    "phase": 10,
    "lesson": 14,
    "lessonPath": "phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs",
    "file": "phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/outputs/skill-open-model-picker.md"
  },
  {
    "kind": "skill",
    "name": "eagle3-tuner",
    "description": "新しい推論 workload 向けに speculative decoding 戦略 (vanilla / Medusa / EAGLE-1/2/3 / lookahead) を選び、調整する。",
    "tags": [
      "speculative-decoding",
      "eagle",
      "eagle-3",
      "medusa",
      "inference",
      "vllm",
      "sglang",
      "tensorrt-llm"
    ],
    "phase": 10,
    "lesson": 15,
    "lessonPath": "phases/10-llms-from-scratch/15-speculative-decoding-eagle3",
    "file": "phases/10-llms-from-scratch/15-speculative-decoding-eagle3/outputs/skill-eagle3-tuner.md"
  },
  {
    "kind": "skill",
    "name": "diff-attention-integrator",
    "description": "新しい pre-training run または LoRA fine-tune に Differential Attention V2 を追加するための integration plan。",
    "tags": [
      "differential-attention",
      "diff-transformer",
      "long-context",
      "flash-attention",
      "pre-training",
      "lora"
    ],
    "phase": 10,
    "lesson": 16,
    "lessonPath": "phases/10-llms-from-scratch/16-differential-attention-v2",
    "file": "phases/10-llms-from-scratch/16-differential-attention-v2/outputs/skill-diff-attention-integrator.md"
  },
  {
    "kind": "skill",
    "name": "nsa-integrator",
    "description": "long-context pre-training run に Native Sparse Attention を統合する計画。",
    "tags": [
      "nsa",
      "sparse-attention",
      "long-context",
      "pre-training",
      "kernel-aligned",
      "deepseek"
    ],
    "phase": 10,
    "lesson": 17,
    "lessonPath": "phases/10-llms-from-scratch/17-native-sparse-attention",
    "file": "phases/10-llms-from-scratch/17-native-sparse-attention/outputs/skill-nsa-integrator.md"
  },
  {
    "kind": "skill",
    "name": "mtp-planner",
    "description": "新しい pre-training run に multi-token prediction を統合する計画。",
    "tags": [
      "mtp",
      "multi-token-prediction",
      "deepseek-v3",
      "pre-training",
      "speculative-decoding"
    ],
    "phase": 10,
    "lesson": 18,
    "lessonPath": "phases/10-llms-from-scratch/18-multi-token-prediction",
    "file": "phases/10-llms-from-scratch/18-multi-token-prediction/outputs/skill-mtp-planner.md"
  },
  {
    "kind": "skill",
    "name": "dualpipe-planner",
    "description": "training cluster 向けに pipeline parallelism strategy (1F1B, Zero Bubble, DualPipe, DualPipeV) を計画する。",
    "tags": [
      "pipeline-parallelism",
      "dualpipe",
      "dualpipev",
      "zero-bubble",
      "expert-parallelism",
      "distributed-training"
    ],
    "phase": 10,
    "lesson": 19,
    "lessonPath": "phases/10-llms-from-scratch/19-dualpipe-parallelism",
    "file": "phases/10-llms-from-scratch/19-dualpipe-parallelism/outputs/skill-dualpipe-planner.md"
  },
  {
    "kind": "skill",
    "name": "deepseek-v3-reader",
    "description": "DeepSeek-family config を読み、component-by-component の architecture analysis を作成する。",
    "tags": [
      "deepseek-v3",
      "deepseek-r1",
      "mla",
      "moe",
      "mtp",
      "dualpipe",
      "architecture"
    ],
    "phase": 10,
    "lesson": 20,
    "lessonPath": "phases/10-llms-from-scratch/20-deepseek-v3-walkthrough",
    "file": "phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/outputs/skill-deepseek-v3-reader.md"
  },
  {
    "kind": "skill",
    "name": "hybrid-picker",
    "description": "与えられた workload に対して、pure Transformer、Jamba-style hybrid、pure SSM のどれを選ぶべきか判断する。",
    "tags": [
      "jamba",
      "mamba",
      "ssm",
      "hybrid",
      "long-context",
      "memory-budget",
      "architecture"
    ],
    "phase": 10,
    "lesson": 21,
    "lessonPath": "phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer",
    "file": "phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/outputs/skill-hybrid-picker.md"
  },
  {
    "kind": "skill",
    "name": "parallel-inference-router",
    "description": "Reasoning workload を voting、tree-of-thought、multi-agent、Hogwild!、speculative decoding strategies の間で route する。",
    "tags": [
      "parallel-inference",
      "hogwild",
      "speculative-decoding",
      "tree-of-thought",
      "multi-agent",
      "reasoning"
    ],
    "phase": 10,
    "lesson": 22,
    "lessonPath": "phases/10-llms-from-scratch/22-async-hogwild-inference",
    "file": "phases/10-llms-from-scratch/22-async-hogwild-inference/outputs/skill-parallel-inference-router.md"
  },
  {
    "kind": "skill",
    "name": "speculative-tuning",
    "description": "decode workload を profile し、speculative decoding の draft model、draft length K、temperature gate、fallback policy を選ぶ。",
    "tags": [
      "speculative-decoding",
      "draft-model",
      "alpha",
      "throughput",
      "inference",
      "decode-latency"
    ],
    "phase": 10,
    "lesson": 25,
    "lessonPath": "phases/10-llms-from-scratch/25-speculative-decoding",
    "file": "phases/10-llms-from-scratch/25-speculative-decoding/outputs/skill-speculative-tuning.md"
  },
  {
    "kind": "skill",
    "name": "checkpointing-planner",
    "description": "training config と HBM budget をもとに、layer ごとの activation recomputation policy (none / selective / full / offload) を選ぶ。",
    "tags": [
      "gradient-checkpointing",
      "activation-recomputation",
      "selective-checkpoint",
      "fsdp-offload",
      "training-memory"
    ],
    "phase": 10,
    "lesson": 34,
    "lessonPath": "phases/10-llms-from-scratch/34-gradient-checkpointing",
    "file": "phases/10-llms-from-scratch/34-gradient-checkpointing/outputs/skill-checkpointing-planner.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-prompt-optimizer",
    "description": "実証済みのプロンプトエンジニアリングパターンを使い、ドラフトプロンプトをモデル横断で最大効果が出る形に書き換える",
    "tags": [],
    "phase": 11,
    "lesson": 1,
    "lessonPath": "phases/11-llm-engineering/01-prompt-engineering",
    "file": "phases/11-llm-engineering/01-prompt-engineering/outputs/prompt-prompt-optimizer.md"
  },
  {
    "kind": "skill",
    "name": "skill-prompt-patterns",
    "description": "タスク種別、信頼性要件、対象モデルに基づいて適切なプロンプトパターンを選ぶための判断フレームワーク",
    "tags": [
      "prompt-engineering",
      "patterns",
      "llm",
      "temperature",
      "cross-model",
      "few-shot",
      "chain-of-thought"
    ],
    "phase": 11,
    "lesson": 1,
    "lessonPath": "phases/11-llm-engineering/01-prompt-engineering",
    "file": "phases/11-llm-engineering/01-prompt-engineering/outputs/skill-prompt-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-reasoning-chain",
    "description": "多段階推論タスク向けの、self-consistency 対応本番用 few-shot CoT プロンプト",
    "tags": [],
    "phase": 11,
    "lesson": 2,
    "lessonPath": "phases/11-llm-engineering/02-few-shot-cot",
    "file": "phases/11-llm-engineering/02-few-shot-cot/outputs/prompt-reasoning-chain.md"
  },
  {
    "kind": "skill",
    "name": "skill-cot-patterns",
    "description": "タスクの複雑さ、精度要件、コスト制約に基づいて適切な推論手法を選ぶための判断フレームワーク",
    "tags": [
      "chain-of-thought",
      "few-shot",
      "self-consistency",
      "tree-of-thought",
      "react",
      "reasoning",
      "prompting"
    ],
    "phase": 11,
    "lesson": 2,
    "lessonPath": "phases/11-llm-engineering/02-few-shot-cot",
    "file": "phases/11-llm-engineering/02-few-shot-cot/outputs/skill-cot-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-structured-extractor",
    "description": "JSON Schema 定義に従って非構造テキストから構造化データを抽出する",
    "tags": [],
    "phase": 11,
    "lesson": 3,
    "lessonPath": "phases/11-llm-engineering/03-structured-outputs",
    "file": "phases/11-llm-engineering/03-structured-outputs/outputs/prompt-structured-extractor.md"
  },
  {
    "kind": "skill",
    "name": "skill-structured-outputs",
    "description": "プロバイダー、信頼性、複雑さに基づいて適切な structured output 戦略を選ぶための判断フレームワーク",
    "tags": [
      "structured-output",
      "json",
      "schema",
      "constrained-decoding",
      "pydantic",
      "function-calling"
    ],
    "phase": 11,
    "lesson": 3,
    "lessonPath": "phases/11-llm-engineering/03-structured-outputs",
    "file": "phases/11-llm-engineering/03-structured-outputs/outputs/skill-structured-outputs.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-embedding-advisor",
    "description": "特定ユースケースに合わせて embedding models、dimensions、strategies を選ぶ",
    "tags": [],
    "phase": 11,
    "lesson": 4,
    "lessonPath": "phases/11-llm-engineering/04-embeddings",
    "file": "phases/11-llm-engineering/04-embeddings/outputs/prompt-embedding-advisor.md"
  },
  {
    "kind": "skill",
    "name": "skill-embedding-patterns",
    "description": "embeddings、vector search、similarity の本番パターン",
    "tags": [
      "embeddings",
      "vectors",
      "similarity",
      "search",
      "chunking",
      "quantization"
    ],
    "phase": 11,
    "lesson": 4,
    "lessonPath": "phases/11-llm-engineering/04-embeddings",
    "file": "phases/11-llm-engineering/04-embeddings/outputs/skill-embedding-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-context-optimizer",
    "description": "コンテキスト組み立て戦略を監査し、トークンの無駄を減らして応答品質を高める最適化を提案する",
    "tags": [],
    "phase": 11,
    "lesson": 5,
    "lessonPath": "phases/11-llm-engineering/05-context-engineering",
    "file": "phases/11-llm-engineering/05-context-engineering/outputs/prompt-context-optimizer.md"
  },
  {
    "kind": "skill",
    "name": "skill-context-engineering",
    "description": "タスク種別、ウィンドウサイズ、レイテンシ予算に基づいてコンテキスト組み立てパイプラインを設計する意思決定フレームワーク",
    "tags": [
      "context-engineering",
      "context-window",
      "rag",
      "memory",
      "tool-selection",
      "lost-in-the-middle"
    ],
    "phase": 11,
    "lesson": 5,
    "lessonPath": "phases/11-llm-engineering/05-context-engineering",
    "file": "phases/11-llm-engineering/05-context-engineering/outputs/skill-context-engineering.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-rag-architect",
    "description": "具体的なユースケースに対して、明確なアーキテクチャ判断を伴うRAGシステムを設計する",
    "tags": [],
    "phase": 11,
    "lesson": 6,
    "lessonPath": "phases/11-llm-engineering/06-rag",
    "file": "phases/11-llm-engineering/06-rag/outputs/prompt-rag-architect.md"
  },
  {
    "kind": "skill",
    "name": "skill-rag-pipeline",
    "description": "第一原理からRAGパイプラインを構築しデバッグする",
    "tags": [
      "rag",
      "retrieval",
      "embeddings",
      "vector-search",
      "llm-engineering"
    ],
    "phase": 11,
    "lesson": 6,
    "lessonPath": "phases/11-llm-engineering/06-rag",
    "file": "phases/11-llm-engineering/06-rag/outputs/skill-rag-pipeline.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-advanced-rag-debugger",
    "description": "retrieval、generation、evaluationにまたがるRAG品質問題を診断して修正する",
    "tags": [],
    "phase": 11,
    "lesson": 7,
    "lessonPath": "phases/11-llm-engineering/07-advanced-rag",
    "file": "phases/11-llm-engineering/07-advanced-rag/outputs/prompt-advanced-rag-debugger.md"
  },
  {
    "kind": "skill",
    "name": "skill-advanced-rag",
    "description": "hybrid search、reranking、evaluationを使って本番級RAGを構築する",
    "tags": [
      "rag",
      "hybrid-search",
      "bm25",
      "reranking",
      "hyde",
      "evaluation"
    ],
    "phase": 11,
    "lesson": 7,
    "lessonPath": "phases/11-llm-engineering/07-advanced-rag",
    "file": "phases/11-llm-engineering/07-advanced-rag/outputs/skill-advanced-rag.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-lora-advisor",
    "description": "特定のfine-tuningタスクに対してLoRA rank、target modules、hyperparametersを決める",
    "tags": [],
    "phase": 11,
    "lesson": 8,
    "lessonPath": "phases/11-llm-engineering/08-fine-tuning-lora",
    "file": "phases/11-llm-engineering/08-fine-tuning-lora/outputs/prompt-lora-advisor.md"
  },
  {
    "kind": "skill",
    "name": "skill-fine-tuning-guide",
    "description": "LoRAとQLoRAでLLMをいつ、どのようにfine-tuneするかの意思決定ツリー",
    "tags": [
      "fine-tuning",
      "lora",
      "qlora",
      "peft",
      "llm-engineering"
    ],
    "phase": 11,
    "lesson": 8,
    "lessonPath": "phases/11-llm-engineering/08-fine-tuning-lora",
    "file": "phases/11-llm-engineering/08-fine-tuning-lora/outputs/skill-fine-tuning-guide.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-tool-designer",
    "description": "自然言語の説明から function calling 用の完全な tool definition (JSON Schema) を設計する",
    "tags": [],
    "phase": 11,
    "lesson": 9,
    "lessonPath": "phases/11-llm-engineering/09-function-calling",
    "file": "phases/11-llm-engineering/09-function-calling/outputs/prompt-tool-designer.md"
  },
  {
    "kind": "skill",
    "name": "skill-function-calling-patterns",
    "description": "production で function calling を実装するための decision framework -- tool design、error handling、security、provider patterns",
    "tags": [
      "function-calling",
      "tool-use",
      "agents",
      "mcp",
      "security",
      "openai",
      "anthropic"
    ],
    "phase": 11,
    "lesson": 9,
    "lessonPath": "phases/11-llm-engineering/09-function-calling",
    "file": "phases/11-llm-engineering/09-function-calling/outputs/skill-function-calling-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-eval-designer",
    "description": "use case の説明から、LLM applications 向けに調整された evaluation rubrics と test suites を設計する",
    "tags": [],
    "phase": 11,
    "lesson": 10,
    "lessonPath": "phases/11-llm-engineering/10-evaluation",
    "file": "phases/11-llm-engineering/10-evaluation/outputs/prompt-eval-designer.md"
  },
  {
    "kind": "skill",
    "name": "skill-eval-patterns",
    "description": "evaluation strategies を選ぶための decision framework -- どの method をいつ使うか、test suites をどう sizing するか、evals を CI/CD にどう統合するか",
    "tags": [
      "evaluation",
      "testing",
      "llm-as-judge",
      "regression",
      "confidence-intervals",
      "ci-cd"
    ],
    "phase": 11,
    "lesson": 10,
    "lessonPath": "phases/11-llm-engineering/10-evaluation",
    "file": "phases/11-llm-engineering/10-evaluation/outputs/skill-eval-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-cost-optimizer",
    "description": "LLM application を分析し、projected savings 付きの具体的な cost optimizations を提案する",
    "tags": [],
    "phase": 11,
    "lesson": 11,
    "lessonPath": "phases/11-llm-engineering/11-caching-cost",
    "file": "phases/11-llm-engineering/11-caching-cost/outputs/prompt-cost-optimizer.md"
  },
  {
    "kind": "skill",
    "name": "skill-cost-patterns",
    "description": "LLM cost optimization のための decision framework -- caching strategies、rate limiting、model routing、budget controls",
    "tags": [
      "caching",
      "cost-optimization",
      "rate-limiting",
      "model-routing",
      "budget",
      "llm-ops"
    ],
    "phase": 11,
    "lesson": 11,
    "lessonPath": "phases/11-llm-engineering/11-caching-cost",
    "file": "phases/11-llm-engineering/11-caching-cost/outputs/skill-cost-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-safety-auditor",
    "description": "任意の LLM application を safety vulnerabilities の観点で audit する -- prompt injection、data leakage、jailbreaks、output risks",
    "tags": [],
    "phase": 11,
    "lesson": 12,
    "lessonPath": "phases/11-llm-engineering/12-guardrails",
    "file": "phases/11-llm-engineering/12-guardrails/outputs/prompt-safety-auditor.md"
  },
  {
    "kind": "skill",
    "name": "skill-guardrail-patterns",
    "description": "production で guardrails を選び実装するための decision framework -- tool selection、layering strategy、cost-performance tradeoffs",
    "tags": [
      "guardrails",
      "safety",
      "content-filtering",
      "prompt-injection",
      "pii",
      "moderation",
      "llamaguard",
      "nemo"
    ],
    "phase": 11,
    "lesson": 12,
    "lessonPath": "phases/11-llm-engineering/12-guardrails",
    "file": "phases/11-llm-engineering/12-guardrails/outputs/skill-guardrail-patterns.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-architecture-reviewer",
    "description": "本番対応チェックリストに照らして任意のLLMアプリケーション設計をレビューし、gap、risk、不足componentを特定する",
    "tags": [],
    "phase": 11,
    "lesson": 13,
    "lessonPath": "phases/11-llm-engineering/13-production-app",
    "file": "phases/11-llm-engineering/13-production-app/outputs/prompt-architecture-reviewer.md"
  },
  {
    "kind": "skill",
    "name": "skill-production-checklist",
    "description": "LLM applicationを本番にshipするためのdecision framework。全componentを具体的なthresholdとpass/fail criteriaで扱う",
    "tags": [
      "production",
      "deployment",
      "llm",
      "architecture",
      "scaling",
      "cost",
      "observability",
      "guardrails"
    ],
    "phase": 11,
    "lesson": 13,
    "lessonPath": "phases/11-llm-engineering/13-production-app",
    "file": "phases/11-llm-engineering/13-production-app/outputs/skill-production-checklist.md"
  },
  {
    "kind": "skill",
    "name": "mcp-server-designer",
    "description": "tools、resources、安全な default を備えた MCP server を設計し、scaffold する。",
    "tags": [
      "llm-engineering",
      "mcp",
      "tool-use"
    ],
    "phase": 11,
    "lesson": 14,
    "lessonPath": "phases/11-llm-engineering/14-model-context-protocol",
    "file": "phases/11-llm-engineering/14-model-context-protocol/outputs/skill-mcp-server-designer.md"
  },
  {
    "kind": "skill",
    "name": "prompt-caching-planner",
    "description": "cache-friendly な prompt layout を設計し、適切な provider caching mode を選ぶ。",
    "tags": [
      "llm-engineering",
      "caching",
      "cost"
    ],
    "phase": 11,
    "lesson": 15,
    "lessonPath": "phases/11-llm-engineering/15-prompt-caching",
    "file": "phases/11-llm-engineering/15-prompt-caching/outputs/skill-prompt-caching-planner.md"
  },
  {
    "kind": "skill",
    "name": "stategraph-designer",
    "description": "agent taskを、named nodes、typed state、reducers、checkpointer、human interruptsを備えたLangGraph StateGraphに変換する。",
    "tags": [
      "langgraph",
      "stategraph",
      "checkpointer",
      "interrupt",
      "time-travel",
      "react-agent",
      "human-in-the-loop"
    ],
    "phase": 11,
    "lesson": 16,
    "lessonPath": "phases/11-llm-engineering/16-langgraph-state-machines",
    "file": "phases/11-llm-engineering/16-langgraph-state-machines/outputs/skill-stategraph-designer.md"
  },
  {
    "kind": "skill",
    "name": "framework-picker",
    "description": "abstractionをproblem shapeに合わせ、agent taskにLangGraph、CrewAI、AutoGen、Agno、またはplain Pythonを選ぶ。",
    "tags": [
      "langgraph",
      "crewai",
      "autogen",
      "agno",
      "agent-framework",
      "orchestration",
      "decision-matrix"
    ],
    "phase": 11,
    "lesson": 17,
    "lessonPath": "phases/11-llm-engineering/17-agent-framework-tradeoffs",
    "file": "phases/11-llm-engineering/17-agent-framework-tradeoffs/outputs/skill-framework-picker.md"
  },
  {
    "kind": "skill",
    "name": "patch-geometry-reader",
    "description": "ViT config を読み、downstream VLM 計画向けに patch-token、parameter、VRAM analysis を生成する。",
    "tags": [
      "vit",
      "patch-tokens",
      "dinov2",
      "siglip",
      "vlm-backbone"
    ],
    "phase": 12,
    "lesson": 1,
    "lessonPath": "phases/12-multimodal-ai/01-vision-transformer-patch-tokens",
    "file": "phases/12-multimodal-ai/01-vision-transformer-patch-tokens/outputs/skill-patch-geometry-reader.md"
  },
  {
    "kind": "skill",
    "name": "clip-zero-shot",
    "description": "CLIP / SigLIP checkpoint で zero-shot image classification を実行し、similarity score 付きの ranked prediction を生成する。",
    "tags": [
      "clip",
      "siglip",
      "zero-shot",
      "vision-language"
    ],
    "phase": 12,
    "lesson": 2,
    "lessonPath": "phases/12-multimodal-ai/02-clip-contrastive-pretraining",
    "file": "phases/12-multimodal-ai/02-clip-contrastive-pretraining/outputs/skill-clip-zero-shot.md"
  },
  {
    "kind": "skill",
    "name": "modality-bridge-picker",
    "description": "token budget、quality target、training compute に基づき、VLM configuration 向けに Q-Former vs MLP projector vs Perceiver resampler を推奨する。",
    "tags": [
      "blip2",
      "qformer",
      "vlm",
      "modality-bridge",
      "architecture"
    ],
    "phase": 12,
    "lesson": 3,
    "lessonPath": "phases/12-multimodal-ai/03-blip2-qformer-bridge",
    "file": "phases/12-multimodal-ai/03-blip2-qformer-bridge/outputs/skill-modality-bridge-picker.md"
  },
  {
    "kind": "skill",
    "name": "gated-bridge-diagnostic",
    "description": "open VLM config 内の Flamingo-lineage design element を識別し、freezing / gating issue を診断する。",
    "tags": [
      "flamingo",
      "idefics",
      "openflamingo",
      "gated-cross-attention",
      "interleaved-inputs"
    ],
    "phase": 12,
    "lesson": 4,
    "lessonPath": "phases/12-multimodal-ai/04-flamingo-gated-cross-attention",
    "file": "phases/12-multimodal-ai/04-flamingo-gated-cross-attention/outputs/skill-gated-bridge-diagnostic.md"
  },
  {
    "kind": "skill",
    "name": "llava-vibes-eval",
    "description": "LLaVA-family VLM に対して 10-prompt の vibes-eval を実行し、人間が読める scorecard を作成する。",
    "tags": [
      "llava",
      "vlm",
      "vibes-eval",
      "instruction-tuning"
    ],
    "phase": 12,
    "lesson": 5,
    "lessonPath": "phases/12-multimodal-ai/05-llava-visual-instruction-tuning",
    "file": "phases/12-multimodal-ai/05-llava-visual-instruction-tuning/outputs/skill-llava-vibes-eval.md"
  },
  {
    "kind": "skill",
    "name": "resolution-budget-planner",
    "description": "mixed-aspect-ratio VLM workload 向けに square-resize、AnyRes、M-RoPE、NaFlex から選び、task ごとの token budget plan を出力する。",
    "tags": [
      "vlm",
      "patch-n-pack",
      "naflex",
      "anyres",
      "m-rope",
      "token-budget"
    ],
    "phase": 12,
    "lesson": 6,
    "lessonPath": "phases/12-multimodal-ai/06-any-resolution-patch-n-pack",
    "file": "phases/12-multimodal-ai/06-any-resolution-patch-n-pack/outputs/skill-resolution-budget-planner.md"
  },
  {
    "kind": "skill",
    "name": "vlm-recipe-picker",
    "description": "open-weight VLM recipe (encoder、connector、LLM、data mix、resolution schedule) を選び、各選択に ablation-table citation を付ける。",
    "tags": [
      "vlm",
      "mm1",
      "idefics2",
      "molmo",
      "cambrian",
      "prismatic",
      "ablation"
    ],
    "phase": 12,
    "lesson": 7,
    "lessonPath": "phases/12-multimodal-ai/07-open-weight-vlm-recipes",
    "file": "phases/12-multimodal-ai/07-open-weight-vlm-recipes/outputs/skill-vlm-recipe-picker.md"
  },
  {
    "kind": "skill",
    "name": "onevision-budget-planner",
    "description": "target product mix に合わせて、LLaVA-OneVision-style の unified visual-token budget を single-image、multi-image、video scenarios に配分する。",
    "tags": [
      "llava-onevision",
      "token-budget",
      "curriculum",
      "multi-image",
      "video"
    ],
    "phase": 12,
    "lesson": 8,
    "lessonPath": "phases/12-multimodal-ai/08-llava-onevision-single-multi-video",
    "file": "phases/12-multimodal-ai/08-llava-onevision-single-multi-video/outputs/skill-onevision-budget-planner.md"
  },
  {
    "kind": "skill",
    "name": "qwen-vl-pipeline-designer",
    "description": "目的のvideoまたはimage task向けに、Qwen2.5-VLまたはQwen3-VL deploymentのresolution bounds、dynamic-FPS policy、window-attention flag、JSON agent output modeを設計する。",
    "tags": [
      "qwen-vl",
      "m-rope",
      "dynamic-fps",
      "json-agent",
      "video-understanding"
    ],
    "phase": 12,
    "lesson": 9,
    "lessonPath": "phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps",
    "file": "phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/outputs/skill-qwen-vl-pipeline-designer.md"
  },
  {
    "kind": "skill",
    "name": "native-vs-posthoc-auditor",
    "description": "提案されたVLM training planをauditし、corpus-mixとalignment-debt分析に基づいてnative multimodal pretrainingまたはpost-hoc adapter-on-LLMを推奨する。",
    "tags": [
      "internvl3",
      "native-pretraining",
      "post-hoc",
      "corpus-mix",
      "alignment-debt"
    ],
    "phase": 12,
    "lesson": 10,
    "lessonPath": "phases/12-multimodal-ai/10-internvl3-native-multimodal",
    "file": "phases/12-multimodal-ai/10-internvl3-native-multimodal/outputs/skill-native-vs-posthoc-auditor.md"
  },
  {
    "kind": "skill",
    "name": "tokenizer-vs-adapter-picker",
    "description": "VLM project向けに、Chameleon-style early fusion（shared-vocab tokenizer）とLLaVA-style late fusion（frozen LLM上のadapter）のどちらを選ぶか決める。",
    "tags": [
      "chameleon",
      "early-fusion",
      "vq-vae",
      "late-fusion",
      "adapter"
    ],
    "phase": 12,
    "lesson": 11,
    "lessonPath": "phases/12-multimodal-ai/11-chameleon-early-fusion-tokens",
    "file": "phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/outputs/skill-tokenizer-vs-adapter-picker.md"
  },
  {
    "kind": "skill",
    "name": "token-gen-cost-analyzer",
    "description": "Emu3-style next-token generationのtoken counts、inference latency、quality ceilingを計算し、Emu3-familyとdiffusionのどちらを選ぶか決める。",
    "tags": [
      "emu3",
      "next-token-prediction",
      "video-gen",
      "diffusion",
      "cfg"
    ],
    "phase": 12,
    "lesson": 12,
    "lessonPath": "phases/12-multimodal-ai/12-emu3-next-token-for-generation",
    "file": "phases/12-multimodal-ai/12-emu3-next-token-for-generation/outputs/skill-token-gen-cost-analyzer.md"
  },
  {
    "kind": "skill",
    "name": "two-loss-trainer-designer",
    "description": "Transfusion / MMDiT-style の two-loss training setup (片方の modality は NTP、もう片方は diffusion) を、loss weights、mask design、schedule とともに設計する。",
    "tags": [
      "transfusion",
      "mmdit",
      "two-loss",
      "flow-matching",
      "hybrid-attention"
    ],
    "phase": 12,
    "lesson": 13,
    "lessonPath": "phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion",
    "file": "phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/outputs/skill-two-loss-trainer-designer.md"
  },
  {
    "kind": "skill",
    "name": "unified-gen-model-picker",
    "description": "Understanding と generation の両方を open weights で必要とする product のために、Show-o / Transfusion / Emu3 / Janus-Pro family のどれを使うか選ぶ。",
    "tags": [
      "show-o",
      "masked-diffusion",
      "unified",
      "t2i",
      "inpainting"
    ],
    "phase": 12,
    "lesson": 14,
    "lessonPath": "phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified",
    "file": "phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/outputs/skill-unified-gen-model-picker.md"
  },
  {
    "kind": "skill",
    "name": "decoupled-encoder-picker",
    "description": "Unified VLM が visual encoders を decouple すべきか判断し、Janus-Pro、JanusFlow、InternVL-U の間から選ぶ。",
    "tags": [
      "janus-pro",
      "janusflow",
      "internvl-u",
      "decoupled-encoders",
      "unified-model"
    ],
    "phase": 12,
    "lesson": 15,
    "lessonPath": "phases/12-multimodal-ai/15-janus-pro-decoupled-encoders",
    "file": "phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/outputs/skill-decoupled-encoder-picker.md"
  },
  {
    "kind": "skill",
    "name": "any-to-any-pipeline-auditor",
    "description": "Conversational any-to-any design を audit し、MIO / AnyGPT / Moshi-family stack の latency budget を計算する。",
    "tags": [
      "mio",
      "anygpt",
      "moshi",
      "any-to-any",
      "streaming",
      "ttfab"
    ],
    "phase": 12,
    "lesson": 16,
    "lessonPath": "phases/12-multimodal-ai/16-mio-any-to-any-streaming",
    "file": "phases/12-multimodal-ai/16-mio-any-to-any-streaming/outputs/skill-any-to-any-pipeline-auditor.md"
  },
  {
    "kind": "skill",
    "name": "video-vlm-frame-planner",
    "description": "video-language model deployment 向けに frame sampling、per-frame pooling、output format、benchmark targets を計画する。",
    "tags": [
      "video-vlm",
      "temporal-grounding",
      "tmrope",
      "dynamic-fps",
      "benchmarks"
    ],
    "phase": 12,
    "lesson": 17,
    "lessonPath": "phases/12-multimodal-ai/17-video-language-temporal-grounding",
    "file": "phases/12-multimodal-ai/17-video-language-temporal-grounding/outputs/skill-video-vlm-frame-planner.md"
  },
  {
    "kind": "skill",
    "name": "long-video-strategy-planner",
    "description": "long-video understanding task 向けに brute-context、ring-attention、token-compression、agentic-retrieval を選び、latency + recall expectations を計算する。",
    "tags": [
      "long-video",
      "gemini",
      "ring-attention",
      "videoagent",
      "retrieval"
    ],
    "phase": 12,
    "lesson": 18,
    "lessonPath": "phases/12-multimodal-ai/18-long-video-million-token",
    "file": "phases/12-multimodal-ai/18-long-video-million-token/outputs/skill-long-video-strategy-planner.md"
  },
  {
    "kind": "skill",
    "name": "audio-llm-pipeline-picker",
    "description": "audio task 向けに cascaded (Whisper + LLM) または end-to-end (AF3 / Qwen-Audio) を選び、encoder と bridge config も決める。",
    "tags": [
      "whisper",
      "audio-flamingo-3",
      "qwen-audio",
      "cascaded",
      "end-to-end"
    ],
    "phase": 12,
    "lesson": 19,
    "lessonPath": "phases/12-multimodal-ai/19-audio-language-whisper-to-af3",
    "file": "phases/12-multimodal-ai/19-audio-language-whisper-to-af3/outputs/skill-audio-llm-pipeline-picker.md"
  },
  {
    "kind": "skill",
    "name": "omni-streaming-budget",
    "description": "target TTFAB と feature set に合わせて Thinker-Talker streaming voice pipeline (Qwen-Omni / Moshi / Mini-Omni) を sizing する。",
    "tags": [
      "qwen-omni",
      "moshi",
      "mini-omni",
      "streaming",
      "ttfab",
      "thinker-talker"
    ],
    "phase": 12,
    "lesson": 20,
    "lessonPath": "phases/12-multimodal-ai/20-omni-models-thinker-talker",
    "file": "phases/12-multimodal-ai/20-omni-models-thinker-talker/outputs/skill-omni-streaming-budget.md"
  },
  {
    "kind": "skill",
    "name": "vla-action-format-picker",
    "description": "Robot task に対して action format (discrete bin, FAST, flow-matching, dual-system) と VLA family (RT-2, OpenVLA, π0, GR00T) を選ぶ。",
    "tags": [
      "vla",
      "rt-2",
      "openvla",
      "pi0",
      "groot",
      "action-tokenization"
    ],
    "phase": 12,
    "lesson": 21,
    "lessonPath": "phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot",
    "file": "phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/outputs/skill-vla-action-format-picker.md"
  },
  {
    "kind": "skill",
    "name": "document-ai-stack-picker",
    "description": "domain、scale、regulatory needsに基づき、document-AI project向けにOCR pipeline、OCR-free specialist、VLM-nativeのどれを使うか選ぶ。",
    "tags": [
      "document-ai",
      "ocr",
      "donut",
      "nougat",
      "paligemma",
      "vlm-native"
    ],
    "phase": 12,
    "lesson": 22,
    "lessonPath": "phases/12-multimodal-ai/22-document-diagram-understanding",
    "file": "phases/12-multimodal-ai/22-document-diagram-understanding/outputs/skill-document-ai-stack-picker.md"
  },
  {
    "kind": "skill",
    "name": "vision-rag-designer",
    "description": "ColPali / ColQwen2 / VisRAG を使う vision-native document RAG を、storage estimate と generator pick 付きで設計する。",
    "tags": [
      "colpali",
      "colqwen2",
      "visrag",
      "late-interaction",
      "vidore"
    ],
    "phase": 12,
    "lesson": 23,
    "lessonPath": "phases/12-multimodal-ai/23-colpali-vision-native-rag",
    "file": "phases/12-multimodal-ai/23-colpali-vision-native-rag/outputs/skill-vision-rag-designer.md"
  },
  {
    "kind": "skill",
    "name": "multimodal-rag-designer",
    "description": "text、images、audio、video を横断する production multimodal RAG を、retrievers、fusion strategy、grounded generator 付きで設計する。",
    "tags": [
      "multimodal-rag",
      "cross-modal-retrieval",
      "fusion",
      "grounded-generation"
    ],
    "phase": 12,
    "lesson": 24,
    "lessonPath": "phases/12-multimodal-ai/24-multimodal-rag-cross-modal",
    "file": "phases/12-multimodal-ai/24-multimodal-rag-cross-modal/outputs/skill-multimodal-rag-designer.md"
  },
  {
    "kind": "skill",
    "name": "multimodal-agent-designer",
    "description": "action schema、memory strategy、benchmark evaluation plan を含む multimodal agent (computer-use、GUI grounding、web/mobile) を設計する。",
    "tags": [
      "multimodal-agents",
      "computer-use",
      "gui-grounding",
      "visualwebarena",
      "agentvista"
    ],
    "phase": 12,
    "lesson": 25,
    "lessonPath": "phases/12-multimodal-ai/25-multimodal-agents-computer-use",
    "file": "phases/12-multimodal-ai/25-multimodal-agents-computer-use/outputs/skill-multimodal-agent-designer.md"
  },
  {
    "kind": "skill",
    "name": "tool-interface-reviewer",
    "description": "LLM に渡す前に tool definition (name + description + JSON Schema + executor outline) の loop fitness を audit する。",
    "tags": [
      "tool-calling",
      "function-calling",
      "json-schema",
      "tool-design"
    ],
    "phase": 13,
    "lesson": 1,
    "lessonPath": "phases/13-tools-and-protocols/01-the-tool-interface",
    "file": "phases/13-tools-and-protocols/01-the-tool-interface/outputs/skill-tool-interface-reviewer.md"
  },
  {
    "kind": "skill",
    "name": "provider-portability-audit",
    "description": "1 provider 向けの function-calling integration を audit し、他の 2 provider へ port したときに何が壊れるかを示す。",
    "tags": [
      "function-calling",
      "openai",
      "anthropic",
      "gemini",
      "portability"
    ],
    "phase": 13,
    "lesson": 2,
    "lessonPath": "phases/13-tools-and-protocols/02-function-calling-deep-dive",
    "file": "phases/13-tools-and-protocols/02-function-calling-deep-dive/outputs/skill-provider-portability-audit.md"
  },
  {
    "kind": "skill",
    "name": "parallel-call-safety-check",
    "description": "tool registry を安全な parallelization の観点で audit する。各 tool に parallel_safe を付け、ordering dependencies と downstream rate-limit risk を示す。",
    "tags": [
      "parallel-tool-calls",
      "streaming",
      "correlation",
      "rate-limits"
    ],
    "phase": 13,
    "lesson": 3,
    "lessonPath": "phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls",
    "file": "phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/outputs/skill-parallel-call-safety-check.md"
  },
  {
    "kind": "skill",
    "name": "structured-output-designer",
    "description": "free-text extraction target 向けに、strict-mode-compatible な JSON Schema と Pydantic model を設計し、typed refusal と retry handling の stub を含める。",
    "tags": [
      "structured-output",
      "json-schema",
      "pydantic",
      "strict-mode",
      "extraction"
    ],
    "phase": 13,
    "lesson": 4,
    "lessonPath": "phases/13-tools-and-protocols/04-structured-output",
    "file": "phases/13-tools-and-protocols/04-structured-output/outputs/skill-structured-output-designer.md"
  },
  {
    "kind": "skill",
    "name": "tool-schema-linter",
    "description": "names、descriptions、parameters、shape に関する production design rules に照らして tool registry を audit する。すべての tool-registry change で CI 実行できる。",
    "tags": [
      "tool-design",
      "linter",
      "selection-accuracy",
      "naming"
    ],
    "phase": 13,
    "lesson": 5,
    "lessonPath": "phases/13-tools-and-protocols/05-tool-schema-design",
    "file": "phases/13-tools-and-protocols/05-tool-schema-design/outputs/skill-tool-schema-linter.md"
  },
  {
    "kind": "skill",
    "name": "mcp-handshake-tracer",
    "description": "MCP client-server conversation の pcap-style transcript を受け取り、すべての message に primitive、lifecycle phase、capability dependency を注釈する。",
    "tags": [
      "mcp",
      "json-rpc",
      "lifecycle",
      "capabilities"
    ],
    "phase": 13,
    "lesson": 6,
    "lessonPath": "phases/13-tools-and-protocols/06-mcp-fundamentals",
    "file": "phases/13-tools-and-protocols/06-mcp-fundamentals/outputs/skill-mcp-handshake-tracer.md"
  },
  {
    "kind": "skill",
    "name": "mcp-server-scaffolder",
    "description": "domain-specific MCP server を、適切な tools/resources/prompts split と SDK graduation path 付きで scaffold する。",
    "tags": [
      "mcp",
      "server",
      "fastmcp",
      "scaffold"
    ],
    "phase": 13,
    "lesson": 7,
    "lessonPath": "phases/13-tools-and-protocols/07-building-an-mcp-server",
    "file": "phases/13-tools-and-protocols/07-building-an-mcp-server/outputs/skill-mcp-server-scaffolder.md"
  },
  {
    "kind": "skill",
    "name": "mcp-client-harness",
    "description": "MCP servers の declarative list（name, command, args）を受け取り、handshake、namespace merge、routing を備えた multi-server client を scaffold する。",
    "tags": [
      "mcp",
      "client",
      "multi-server",
      "routing",
      "namespace"
    ],
    "phase": 13,
    "lesson": 8,
    "lessonPath": "phases/13-tools-and-protocols/08-building-an-mcp-client",
    "file": "phases/13-tools-and-protocols/08-building-an-mcp-client/outputs/skill-mcp-client-harness.md"
  },
  {
    "kind": "skill",
    "name": "mcp-transport-migrator",
    "description": "legacy HTTP+SSE から Streamable HTTP への migration plan を、session id continuity と Origin validation 付きで作成する。",
    "tags": [
      "mcp",
      "streamable-http",
      "sse-migration",
      "session-id",
      "origin"
    ],
    "phase": 13,
    "lesson": 9,
    "lessonPath": "phases/13-tools-and-protocols/09-mcp-transports",
    "file": "phases/13-tools-and-protocols/09-mcp-transports/outputs/skill-mcp-transport-migrator.md"
  },
  {
    "kind": "skill",
    "name": "primitive-splitter",
    "description": "MCP server draft の各 capability を、rationale 付きで tool、resource、prompt のいずれかに categorize する。",
    "tags": [
      "mcp",
      "primitives",
      "resources",
      "prompts"
    ],
    "phase": 13,
    "lesson": 10,
    "lessonPath": "phases/13-tools-and-protocols/10-mcp-resources-and-prompts",
    "file": "phases/13-tools-and-protocols/10-mcp-resources-and-prompts/outputs/skill-primitive-splitter.md"
  },
  {
    "kind": "skill",
    "name": "sampling-loop-designer",
    "description": "適切なmodelPreferences、rate limit、safety confirmationを備えたMCP samplingによるserver-hosted agent loopを設計する。",
    "tags": [
      "mcp",
      "sampling",
      "agent-loop",
      "model-preferences"
    ],
    "phase": 13,
    "lesson": 11,
    "lessonPath": "phases/13-tools-and-protocols/11-mcp-sampling",
    "file": "phases/13-tools-and-protocols/11-mcp-sampling/outputs/skill-sampling-loop-designer.md"
  },
  {
    "kind": "skill",
    "name": "elicitation-form-designer",
    "description": "mid-call user confirmationまたはdisambiguationを必要とするtool向けに、elicitation form schemaとmessage templateを設計する。",
    "tags": [
      "mcp",
      "elicitation",
      "user-input",
      "forms"
    ],
    "phase": 13,
    "lesson": 12,
    "lessonPath": "phases/13-tools-and-protocols/12-mcp-roots-and-elicitation",
    "file": "phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/outputs/skill-elicitation-form-designer.md"
  },
  {
    "kind": "skill",
    "name": "task-store-designer",
    "description": "long-running MCP tool の task store を設計する。state shape、ttl、durability、cancellation、crash recovery を扱う。",
    "tags": [
      "mcp",
      "tasks",
      "durable-store",
      "long-running",
      "sep-1686"
    ],
    "phase": 13,
    "lesson": 13,
    "lessonPath": "phases/13-tools-and-protocols/13-mcp-async-tasks",
    "file": "phases/13-tools-and-protocols/13-mcp-async-tasks/outputs/skill-task-store-designer.md"
  },
  {
    "kind": "skill",
    "name": "mcp-apps-spec",
    "description": "Interactive UI resourceが必要なtool向けに、full MCP Apps contractを作る。",
    "tags": [
      "mcp",
      "apps",
      "ui-resources",
      "csp",
      "iframe-sandbox"
    ],
    "phase": 13,
    "lesson": 14,
    "lessonPath": "phases/13-tools-and-protocols/14-mcp-apps",
    "file": "phases/13-tools-and-protocols/14-mcp-apps/outputs/skill-mcp-apps-spec.md"
  },
  {
    "kind": "skill",
    "name": "mcp-threat-model",
    "description": "MCP deployment向けに、該当するattack classes、導入済みdefenses、Rule-of-Two violationsを示すthreat modelを作る。",
    "tags": [
      "mcp",
      "security",
      "tool-poisoning",
      "threat-model",
      "rule-of-two"
    ],
    "phase": 13,
    "lesson": 15,
    "lessonPath": "phases/13-tools-and-protocols/15-mcp-security-tool-poisoning",
    "file": "phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/outputs/skill-mcp-threat-model.md"
  },
  {
    "kind": "skill",
    "name": "oauth-scope-planner",
    "description": "リモート MCP server 向けに OAuth 2.1 scope set、pinning rules、step-up policy を設計する。",
    "tags": [
      "oauth",
      "pkce",
      "resource-indicators",
      "step-up",
      "sep-835"
    ],
    "phase": 13,
    "lesson": 16,
    "lessonPath": "phases/13-tools-and-protocols/16-mcp-security-oauth-2-1",
    "file": "phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/outputs/skill-oauth-scope-planner.md"
  },
  {
    "kind": "skill",
    "name": "gateway-bootstrap",
    "description": "Users、backends、compliance constraints から gateway configuration spec を生成する。",
    "tags": [
      "mcp",
      "gateway",
      "rbac",
      "audit",
      "policy"
    ],
    "phase": 13,
    "lesson": 17,
    "lessonPath": "phases/13-tools-and-protocols/17-mcp-gateways-and-registries",
    "file": "phases/13-tools-and-protocols/17-mcp-gateways-and-registries/outputs/skill-gateway-bootstrap.md"
  },
  {
    "kind": "skill",
    "name": "mcp-auth-iii-wiring",
    "description": "Production MCP authorization（RFC 8414, 7591, 8707, 7636 PKCE, 9728）をiii primitivesへ配線する。HTTP/cronはregisterTrigger、validationはregisterFunction、JWKS cacheはstate::*。",
    "tags": [
      "mcp",
      "oauth",
      "dcr",
      "jwks",
      "iii",
      "rfc8414",
      "rfc7591",
      "rfc8707",
      "rfc7636",
      "rfc9728"
    ],
    "phase": 13,
    "lesson": 18,
    "lessonPath": "phases/13-tools-and-protocols/18-mcp-auth-production",
    "file": "phases/13-tools-and-protocols/18-mcp-auth-production/outputs/skill-mcp-auth-iii.md"
  },
  {
    "kind": "skill",
    "name": "a2a-agent-spec",
    "description": "A2A経由でcallableにすべきagent向けに、Agent Cardとskills schemaを作る。",
    "tags": [
      "a2a",
      "agent-card",
      "task-lifecycle",
      "delegation"
    ],
    "phase": 13,
    "lesson": 19,
    "lessonPath": "phases/13-tools-and-protocols/19-a2a-protocol",
    "file": "phases/13-tools-and-protocols/19-a2a-protocol/outputs/skill-a2a-agent-spec.md"
  },
  {
    "kind": "skill",
    "name": "otel-genai-instrumentation",
    "description": "Agent codebaseがOTel GenAI spansをend-to-endにemitするためのinstrumentation planを作る。",
    "tags": [
      "otel",
      "observability",
      "gen-ai",
      "tracing"
    ],
    "phase": 13,
    "lesson": 20,
    "lessonPath": "phases/13-tools-and-protocols/20-opentelemetry-genai",
    "file": "phases/13-tools-and-protocols/20-opentelemetry-genai/outputs/skill-otel-genai-instrumentation.md"
  },
  {
    "kind": "skill",
    "name": "routing-config-designer",
    "description": "workload profileを受け取り、LiteLLM / OpenRouter / Portkeyを選び、routing configを作る。",
    "tags": [
      "routing",
      "litellm",
      "openrouter",
      "portkey",
      "fallback"
    ],
    "phase": 13,
    "lesson": 21,
    "lessonPath": "phases/13-tools-and-protocols/21-llm-routing-layer",
    "file": "phases/13-tools-and-protocols/21-llm-routing-layer/outputs/skill-routing-config-designer.md"
  },
  {
    "kind": "skill",
    "name": "agent-bundle",
    "description": "Claude Code、Cursor、Codex、互換agentでloadできるportableなSKILL.md + AGENTS.md + MCP-server blueprintをworkflowから作る。",
    "tags": [
      "skills",
      "agents-md",
      "apps-sdk",
      "cross-agent",
      "portability"
    ],
    "phase": 13,
    "lesson": 22,
    "lessonPath": "phases/13-tools-and-protocols/22-skills-and-agent-sdks",
    "file": "phases/13-tools-and-protocols/22-skills-and-agent-sdks/outputs/skill-agent-bundle.md"
  },
  {
    "kind": "skill",
    "name": "ecosystem-blueprint",
    "description": "Product needからPhase 13 ecosystem architecture全体を作り、primitives、security posture、telemetry、packagingを明示する。",
    "tags": [
      "mcp",
      "capstone",
      "ecosystem",
      "architecture",
      "a2a",
      "otel"
    ],
    "phase": 13,
    "lesson": 23,
    "lessonPath": "phases/13-tools-and-protocols/23-capstone-tool-ecosystem",
    "file": "phases/13-tools-and-protocols/23-capstone-tool-ecosystem/outputs/skill-ecosystem-blueprint.md"
  },
  {
    "kind": "skill",
    "name": "agent-loop",
    "description": "tools、停止条件、turn budgetを備えた正しく最小のReActエージェントループを、任意の対象言語/runtimeで書く。",
    "tags": [
      "react",
      "agent-loop",
      "tools",
      "observability",
      "stop-condition"
    ],
    "phase": 14,
    "lesson": 1,
    "lessonPath": "phases/14-agent-engineering/01-the-agent-loop",
    "file": "phases/14-agent-engineering/01-the-agent-loop/outputs/skill-agent-loop.md"
  },
  {
    "kind": "skill",
    "name": "rewoo-planner",
    "description": "user requestとtool catalogから、validated ReWOO plan DAGを生成する。",
    "tags": [
      "rewoo",
      "plan-and-execute",
      "planning",
      "dag",
      "distillation"
    ],
    "phase": 14,
    "lesson": 2,
    "lessonPath": "phases/14-agent-engineering/02-rewoo-plan-and-execute",
    "file": "phases/14-agent-engineering/02-rewoo-plan-and-execute/outputs/skill-rewoo-planner.md"
  },
  {
    "kind": "skill",
    "name": "reflexion-buffer",
    "description": "verbal RL向けに、TTL、dedup、scope管理を備えたreflectionのepisodic-memory bufferを維持する。",
    "tags": [
      "reflexion",
      "episodic-memory",
      "self-healing",
      "verbal-rl",
      "sleep-time"
    ],
    "phase": 14,
    "lesson": 3,
    "lessonPath": "phases/14-agent-engineering/03-reflexion-verbal-rl",
    "file": "phases/14-agent-engineering/03-reflexion-verbal-rl/outputs/skill-reflexion-buffer.md"
  },
  {
    "kind": "skill",
    "name": "search-policy",
    "description": "task shape、token budget、evaluator qualityに基づいてsearch strategy（ReAct、ToT、LATS、evolutionary）を選ぶ。",
    "tags": [
      "tree-of-thoughts",
      "lats",
      "mcts",
      "search",
      "value-function"
    ],
    "phase": 14,
    "lesson": 4,
    "lessonPath": "phases/14-agent-engineering/04-tree-of-thoughts-lats",
    "file": "phases/14-agent-engineering/04-tree-of-thoughts-lats/outputs/skill-search-policy.md"
  },
  {
    "kind": "skill",
    "name": "refine-loop",
    "description": "task、verifier availability、iteration budgetに基づいてevaluator-optimizer（Self-Refine / CRITIC）loopを設定する。",
    "tags": [
      "self-refine",
      "critic",
      "evaluator-optimizer",
      "guardrails",
      "iteration"
    ],
    "phase": 14,
    "lesson": 5,
    "lessonPath": "phases/14-agent-engineering/05-self-refine-and-critic",
    "file": "phases/14-agent-engineering/05-self-refine-and-critic/outputs/skill-refine-loop.md"
  },
  {
    "kind": "skill",
    "name": "tool-registry",
    "description": "JSON Schema validation、parallel dispatch、observabilityを備えたproduction tool catalogとregistryを構築する。",
    "tags": [
      "function-calling",
      "tools",
      "schema",
      "validation",
      "bfcl",
      "parallel-tools"
    ],
    "phase": 14,
    "lesson": 6,
    "lessonPath": "phases/14-agent-engineering/06-tool-use-and-function-calling",
    "file": "phases/14-agent-engineering/06-tool-use-and-function-calling/outputs/skill-tool-registry.md"
  },
  {
    "kind": "skill",
    "name": "virtual-memory",
    "description": "任意の target runtime 向けに、MemGPT 形の 2-tier memory system (main context + archival store + memory tools) を、正しい eviction、citation、untrusted-input handling 付きで scaffold する。",
    "tags": [
      "memory",
      "memgpt",
      "virtual-context",
      "archival",
      "citations"
    ],
    "phase": 14,
    "lesson": 7,
    "lessonPath": "phases/14-agent-engineering/07-memory-virtual-context-memgpt",
    "file": "phases/14-agent-engineering/07-memory-virtual-context-memgpt/outputs/skill-virtual-memory.md"
  },
  {
    "kind": "skill",
    "name": "memory-blocks",
    "description": "Critical path 外の sleep-time consolidation agent を持つ、Letta 形の 3-tier memory system (core blocks, recall, archival) を生成する。",
    "tags": [
      "memory",
      "letta",
      "blocks",
      "sleep-time",
      "consolidation"
    ],
    "phase": 14,
    "lesson": 8,
    "lessonPath": "phases/14-agent-engineering/08-memory-blocks-sleep-time-compute",
    "file": "phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/outputs/skill-memory-blocks.md"
  },
  {
    "kind": "skill",
    "name": "hybrid-memory",
    "description": "Fusion scorer、scope taxonomy、temporal invalidation を持つ Mem0 形 three-store memory system (vector + KV + graph) を生成する。",
    "tags": [
      "memory",
      "mem0",
      "vector",
      "graph",
      "kv",
      "fusion",
      "scope"
    ],
    "phase": 14,
    "lesson": 9,
    "lessonPath": "phases/14-agent-engineering/09-hybrid-memory-mem0",
    "file": "phases/14-agent-engineering/09-hybrid-memory-mem0/outputs/skill-hybrid-memory.md"
  },
  {
    "kind": "skill",
    "name": "skill-library",
    "description": "Similarity による retrieval、compositional execution、failure-driven refinement を備えた Voyager-shaped skill library を生成する。",
    "tags": [
      "voyager",
      "skills",
      "library",
      "composition",
      "refinement"
    ],
    "phase": 14,
    "lesson": 10,
    "lessonPath": "phases/14-agent-engineering/10-skill-libraries-voyager",
    "file": "phases/14-agent-engineering/10-skill-libraries-voyager/outputs/skill-skill-library.md"
  },
  {
    "kind": "skill",
    "name": "hybrid-planner",
    "description": "Hybrid planner を構築する。Provably-sound plans には ChatHTN、machine-checkable evaluator を持つ code search には AlphaEvolve を使い、問題に合う方を選ぶ。",
    "tags": [
      "planning",
      "htn",
      "chathtn",
      "alphaevolve",
      "evolutionary-search"
    ],
    "phase": 14,
    "lesson": 11,
    "lessonPath": "phases/14-agent-engineering/11-planning-htn-and-evolutionary",
    "file": "phases/14-agent-engineering/11-planning-htn-and-evolutionary/outputs/skill-hybrid-planner.md"
  },
  {
    "kind": "skill",
    "name": "workflow-picker",
    "description": "与えられた task に対し、prompt chain、router、parallel、orchestrator-workers、evaluator-optimizer、または full agent のうち適切な最小 pattern を選び、実装を生成する。",
    "tags": [
      "anthropic",
      "workflows",
      "agents",
      "patterns",
      "minimal"
    ],
    "phase": 14,
    "lesson": 12,
    "lessonPath": "phases/14-agent-engineering/12-anthropic-workflow-patterns",
    "file": "phases/14-agent-engineering/12-anthropic-workflow-patterns/outputs/skill-workflow-picker.md"
  },
  {
    "kind": "skill",
    "name": "state-graph",
    "description": "typed state、conditional edge、nodeごとのcheckpointing、durable resumeを備えたLangGraph型state machineを構築する。",
    "tags": [
      "langgraph",
      "state-machine",
      "durable",
      "checkpointing",
      "human-in-the-loop"
    ],
    "phase": 14,
    "lesson": 13,
    "lessonPath": "phases/14-agent-engineering/13-langgraph-stateful-graphs",
    "file": "phases/14-agent-engineering/13-langgraph-stateful-graphs/outputs/skill-state-graph.md"
  },
  {
    "kind": "skill",
    "name": "actor-runtime",
    "description": "private state、actorごとのinbox、message-only IPC、fault isolation、dead-letter queueを備えたAutoGen v0.4型actor runtimeを構築する。",
    "tags": [
      "autogen",
      "actor-model",
      "messaging",
      "fault-isolation",
      "dead-letter"
    ],
    "phase": 14,
    "lesson": 14,
    "lessonPath": "phases/14-agent-engineering/14-autogen-actor-model",
    "file": "phases/14-agent-engineering/14-autogen-actor-model/outputs/skill-actor-runtime.md"
  },
  {
    "kind": "skill",
    "name": "crew-or-flow",
    "description": "指定されたtaskに対してCrewAI CrewまたはFlowを選び、minimal implementationをscaffoldする。",
    "tags": [
      "crewai",
      "crews",
      "flows",
      "multi-agent",
      "role-based"
    ],
    "phase": 14,
    "lesson": 15,
    "lessonPath": "phases/14-agent-engineering/15-crewai-role-based-crews",
    "file": "phases/14-agent-engineering/15-crewai-role-based-crews/outputs/skill-crew-or-flow.md"
  },
  {
    "kind": "skill",
    "name": "agents-sdk-scaffold",
    "description": "triage agent、handoffs、input/output/tool guardrails、session store、trace processorを持つOpenAI Agents SDK appをscaffoldする。",
    "tags": [
      "openai",
      "agents-sdk",
      "handoffs",
      "guardrails",
      "tracing",
      "session"
    ],
    "phase": 14,
    "lesson": 16,
    "lessonPath": "phases/14-agent-engineering/16-openai-agents-sdk",
    "file": "phases/14-agent-engineering/16-openai-agents-sdk/outputs/skill-agents-sdk-scaffold.md"
  },
  {
    "kind": "skill",
    "name": "claude-agent-scaffold",
    "description": "subagents、lifecycle hooks、session store、MCP server attachment、W3C trace propagationを持つClaude Agent SDK appをscaffoldする。",
    "tags": [
      "claude-agent-sdk",
      "subagents",
      "hooks",
      "session-store",
      "mcp"
    ],
    "phase": 14,
    "lesson": 17,
    "lessonPath": "phases/14-agent-engineering/17-claude-agent-sdk",
    "file": "phases/14-agent-engineering/17-claude-agent-sdk/outputs/skill-claude-agent-scaffold.md"
  },
  {
    "kind": "skill",
    "name": "runtime-picker",
    "description": "stack、latency budget、operational shapeに応じてproduction agent runtime (Agno、Mastra、LangGraph、provider SDK) を選ぶ。",
    "tags": [
      "agno",
      "mastra",
      "langgraph",
      "runtime",
      "selection"
    ],
    "phase": 14,
    "lesson": 18,
    "lessonPath": "phases/14-agent-engineering/18-agno-and-mastra-runtimes",
    "file": "phases/14-agent-engineering/18-agno-and-mastra-runtimes/outputs/skill-runtime-picker.md"
  },
  {
    "kind": "skill",
    "name": "benchmark-harness",
    "description": "FAIL_TO_PASS / PASS_TO_PASS gating、contamination checks、step-count metricsを備えたcodebase向けSWE-bench-style harnessを構築する。",
    "tags": [
      "swe-bench",
      "gaia",
      "agentbench",
      "harness",
      "evaluation"
    ],
    "phase": 14,
    "lesson": 19,
    "lessonPath": "phases/14-agent-engineering/19-benchmarks-swebench-gaia",
    "file": "phases/14-agent-engineering/19-benchmarks-swebench-gaia/outputs/skill-benchmark-harness.md"
  },
  {
    "kind": "skill",
    "name": "web-desktop-harness",
    "description": "execution-based evaluationとtrajectory-efficiency metricsを備えたWebArena/OSWorld-style harnessを構築する。",
    "tags": [
      "webarena",
      "osworld",
      "harness",
      "trajectory-efficiency"
    ],
    "phase": 14,
    "lesson": 20,
    "lessonPath": "phases/14-agent-engineering/20-benchmarks-webarena-osworld",
    "file": "phases/14-agent-engineering/20-benchmarks-webarena-osworld/outputs/skill-web-desktop-harness.md"
  },
  {
    "kind": "skill",
    "name": "computer-use-safety",
    "description": "allowlist navigationとinjection-marker filteringを備えた、computer-use agent向けper-step safety classifier + confirmation gateを構築する。",
    "tags": [
      "computer-use",
      "safety",
      "claude",
      "openai-cua",
      "gemini"
    ],
    "phase": 14,
    "lesson": 21,
    "lessonPath": "phases/14-agent-engineering/21-computer-use-agents",
    "file": "phases/14-agent-engineering/21-computer-use-agents/outputs/skill-computer-use-safety.md"
  },
  {
    "kind": "skill",
    "name": "voice-pipeline",
    "description": "barge-in、confidence gating、latency budget enforcementを備えたPipecat-shaped voice pipeline (VAD + STT + LLM + TTS + transport) をscaffoldする。",
    "tags": [
      "voice",
      "pipecat",
      "livekit",
      "webrtc",
      "latency"
    ],
    "phase": 14,
    "lesson": 22,
    "lessonPath": "phases/14-agent-engineering/22-voice-agents-pipecat-livekit",
    "file": "phases/14-agent-engineering/22-voice-agents-pipecat-livekit/outputs/skill-voice-pipeline.md"
  },
  {
    "kind": "skill",
    "name": "otel-genai",
    "description": "OpenTelemetry GenAI semantic conventionsでagentをinstrumentする。正しいattributesとopt-in content captureを持つinvoke_agent、chat、tool_call spans。",
    "tags": [
      "opentelemetry",
      "genai",
      "observability",
      "tracing",
      "semantic-conventions"
    ],
    "phase": 14,
    "lesson": 23,
    "lessonPath": "phases/14-agent-engineering/23-otel-genai-conventions",
    "file": "phases/14-agent-engineering/23-otel-genai-conventions/outputs/skill-otel-genai.md"
  },
  {
    "kind": "skill",
    "name": "obs-platform-wiring",
    "description": "observability platform (Langfuse、Phoenix、Opik、Datadog) を選び、traces + evals + prompt versionsを既存agentにwireする。",
    "tags": [
      "observability",
      "langfuse",
      "phoenix",
      "opik",
      "datadog",
      "tracing"
    ],
    "phase": 14,
    "lesson": 24,
    "lessonPath": "phases/14-agent-engineering/24-agent-observability-platforms",
    "file": "phases/14-agent-engineering/24-agent-observability-platforms/outputs/skill-obs-platform-wiring.md"
  },
  {
    "kind": "skill",
    "name": "debate",
    "description": "N 人の討論者、R ラウンド、設定可能な topology (full mesh, star, ring)、convergence rule を持つ multi-agent debate を scaffolding する。",
    "tags": [
      "debate",
      "multi-agent",
      "society-of-minds",
      "sparse-topology"
    ],
    "phase": 14,
    "lesson": 25,
    "lessonPath": "phases/14-agent-engineering/25-multi-agent-debate",
    "file": "phases/14-agent-engineering/25-multi-agent-debate/outputs/skill-debate.md"
  },
  {
    "kind": "skill",
    "name": "failure-detector",
    "description": "agent traces 向け failure-mode detectors を生成し、trace store に接続して、業界で繰り返し現れる 5 つの modes と domain-specific signatures を tag する。",
    "tags": [
      "failure-modes",
      "masft",
      "detection",
      "observability"
    ],
    "phase": 14,
    "lesson": 26,
    "lessonPath": "phases/14-agent-engineering/26-failure-modes-agentic",
    "file": "phases/14-agent-engineering/26-failure-modes-agentic/outputs/skill-failure-detector.md"
  },
  {
    "kind": "skill",
    "name": "injection-defense",
    "description": "任意の agent runtime 向けに、source-tagged content、injection-marker scanning、allowlist navigation を備えた PVE (Prompt-Validator-Executor) layer を構築する。",
    "tags": [
      "security",
      "prompt-injection",
      "pve",
      "greshake",
      "source-tag"
    ],
    "phase": 14,
    "lesson": 27,
    "lessonPath": "phases/14-agent-engineering/27-prompt-injection-defense",
    "file": "phases/14-agent-engineering/27-prompt-injection-defense/outputs/skill-injection-defense.md"
  },
  {
    "kind": "skill",
    "name": "orchestration-picker",
    "description": "与えられた problem に対して orchestration topology (supervisor, swarm, hierarchical, debate, or none) を選び、最小限に実装する。",
    "tags": [
      "orchestration",
      "supervisor",
      "swarm",
      "hierarchical",
      "debate"
    ],
    "phase": 14,
    "lesson": 28,
    "lessonPath": "phases/14-agent-engineering/28-orchestration-patterns",
    "file": "phases/14-agent-engineering/28-orchestration-patterns/outputs/skill-orchestration-picker.md"
  },
  {
    "kind": "skill",
    "name": "runtime-shape",
    "description": "production runtime shape (request-response, streaming, queue, event, cron, durable) を選び、observability を接続する。",
    "tags": [
      "production",
      "runtime",
      "queue",
      "event",
      "durable",
      "observability"
    ],
    "phase": 14,
    "lesson": 29,
    "lessonPath": "phases/14-agent-engineering/29-production-runtimes",
    "file": "phases/14-agent-engineering/29-production-runtimes/outputs/skill-runtime-shape.md"
  },
  {
    "kind": "skill",
    "name": "eval-suite",
    "description": "evaluator-optimizer loop と CI gates を備えた three-layer eval suite (static benchmarks, custom offline, online production) を構築する。",
    "tags": [
      "evaluation",
      "ci",
      "regression",
      "benchmarks",
      "llm-judge"
    ],
    "phase": 14,
    "lesson": 30,
    "lessonPath": "phases/14-agent-engineering/30-eval-driven-agent-development",
    "file": "phases/14-agent-engineering/30-eval-driven-agent-development/outputs/skill-eval-suite.md"
  },
  {
    "kind": "skill",
    "name": "workbench-audit",
    "description": "agent 作業を始める前に repo の 7 つの agent workbench surface を監査し、missing、partial、healthy を報告する。",
    "tags": [
      "workbench",
      "audit",
      "reliability",
      "agent-engineering"
    ],
    "phase": 14,
    "lesson": 31,
    "lessonPath": "phases/14-agent-engineering/31-agent-workbench-why-models-fail",
    "file": "phases/14-agent-engineering/31-agent-workbench-why-models-fail/outputs/skill-workbench-audit.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Agent Workbench: 高性能モデルがそれでも失敗する理由",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 31,
    "lessonPath": "phases/14-agent-engineering/31-agent-workbench-why-models-fail",
    "file": "phases/14-agent-engineering/31-agent-workbench-why-models-fail/mission.md"
  },
  {
    "kind": "skill",
    "name": "minimal-workbench",
    "description": "任意の repo に minimum viable agent workbench を配置する。短い AGENTS.md router、durable agent_state.json、project の current backlog に紐づく JSON task_board.json。",
    "tags": [
      "workbench",
      "agents-md",
      "state",
      "task-board",
      "scaffold"
    ],
    "phase": 14,
    "lesson": 32,
    "lessonPath": "phases/14-agent-engineering/32-minimal-agent-workbench",
    "file": "phases/14-agent-engineering/32-minimal-agent-workbench/outputs/skill-minimal-workbench.md"
  },
  {
    "kind": "mission",
    "name": "Mission - 最小の Agent Workbench",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 32,
    "lessonPath": "phases/14-agent-engineering/32-minimal-agent-workbench",
    "file": "phases/14-agent-engineering/32-minimal-agent-workbench/mission.md"
  },
  {
    "kind": "skill",
    "name": "rule-set-builder",
    "description": "project owner に interview し、既存の prose instructions を 5 つの operational categories に分類し、versioned agent-rules.md と Python checker stub を出力する。",
    "tags": [
      "rules",
      "instructions",
      "constraints",
      "checker",
      "workbench"
    ],
    "phase": 14,
    "lesson": 33,
    "lessonPath": "phases/14-agent-engineering/33-instructions-as-executable-constraints",
    "file": "phases/14-agent-engineering/33-instructions-as-executable-constraints/outputs/skill-rule-set-builder.md"
  },
  {
    "kind": "mission",
    "name": "Mission - 実行可能な制約としての Agent Instructions",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 33,
    "lessonPath": "phases/14-agent-engineering/33-instructions-as-executable-constraints",
    "file": "phases/14-agent-engineering/33-instructions-as-executable-constraints/mission.md"
  },
  {
    "kind": "skill",
    "name": "state-schema",
    "description": "agent state と task board の project-specific JSON Schemas、atomic writes を持つ Python StateManager、schema bump で workbench を壊さない migration scaffold を生成する。",
    "tags": [
      "state",
      "schema",
      "json-schema",
      "atomic-writes",
      "migrations"
    ],
    "phase": 14,
    "lesson": 34,
    "lessonPath": "phases/14-agent-engineering/34-repo-memory-and-state",
    "file": "phases/14-agent-engineering/34-repo-memory-and-state/outputs/skill-state-schema.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Repo Memory と Durable State",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 34,
    "lessonPath": "phases/14-agent-engineering/34-repo-memory-and-state",
    "file": "phases/14-agent-engineering/34-repo-memory-and-state/mission.md"
  },
  {
    "kind": "skill",
    "name": "init-script",
    "description": "project に interview し、5 つの probes を持つ deterministic init_agent.py と、probe failure 時に agent launch を拒否する CI workflow を出力する。",
    "tags": [
      "init",
      "probes",
      "ci",
      "workbench",
      "fail-loud"
    ],
    "phase": 14,
    "lesson": 35,
    "lessonPath": "phases/14-agent-engineering/35-initialization-scripts",
    "file": "phases/14-agent-engineering/35-initialization-scripts/outputs/skill-init-script.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Agents のための Initialization Scripts",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 35,
    "lessonPath": "phases/14-agent-engineering/35-initialization-scripts",
    "file": "phases/14-agent-engineering/35-initialization-scripts/mission.md"
  },
  {
    "kind": "skill",
    "name": "scope-contract",
    "description": "許可/禁止 glob、受け入れ条件、rollback plan を備えた task ごとのスコープ契約と、すべての agent diff で実行する CI-ready な glob-aware checker を生成する。",
    "tags": [
      "scope",
      "contract",
      "globs",
      "diff-check",
      "ci"
    ],
    "phase": 14,
    "lesson": 36,
    "lessonPath": "phases/14-agent-engineering/36-scope-contracts",
    "file": "phases/14-agent-engineering/36-scope-contracts/outputs/skill-scope-contract.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Scope Contracts と Task Boundaries",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 36,
    "lessonPath": "phases/14-agent-engineering/36-scope-contracts",
    "file": "phases/14-agent-engineering/36-scope-contracts/mission.md"
  },
  {
    "kind": "skill",
    "name": "feedback-runner",
    "description": "shell command を、決定的な stdout/stderr/exit/duration capture で wrap し、command ごとに JSONL record を永続化し、feedback が欠けているときは agent loop の前進を拒否する。",
    "tags": [
      "feedback",
      "subprocess",
      "runner",
      "jsonl",
      "loop-control"
    ],
    "phase": 14,
    "lesson": 37,
    "lessonPath": "phases/14-agent-engineering/37-runtime-feedback-loops",
    "file": "phases/14-agent-engineering/37-runtime-feedback-loops/outputs/skill-feedback-runner.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Runtime Feedback Loops",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 37,
    "lessonPath": "phases/14-agent-engineering/37-runtime-feedback-loops",
    "file": "phases/14-agent-engineering/37-runtime-feedback-loops/mission.md"
  },
  {
    "kind": "skill",
    "name": "verification-gate",
    "description": "scope、rule、feedback artifacts を task ごとの単一 verification_report.json に統合する deterministic verification gate と、green verdict なしでは merge を拒否する CI wiring を生成する。",
    "tags": [
      "verification",
      "gate",
      "deterministic",
      "ci",
      "override-log"
    ],
    "phase": 14,
    "lesson": 38,
    "lessonPath": "phases/14-agent-engineering/38-verification-gates",
    "file": "phases/14-agent-engineering/38-verification-gates/outputs/skill-verification-gate.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Verification Gates",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 38,
    "lessonPath": "phases/14-agent-engineering/38-verification-gates",
    "file": "phases/14-agent-engineering/38-verification-gates/mission.md"
  },
  {
    "kind": "skill",
    "name": "reviewer-agent",
    "description": "builder artifacts を読み、構造化 review report を生成し、人間の review を blank page ではなく written page から始める five-dimension rubric 付き reviewer agent role を立ち上げる。",
    "tags": [
      "reviewer",
      "rubric",
      "role-separation",
      "second-loop",
      "review-report"
    ],
    "phase": 14,
    "lesson": 39,
    "lessonPath": "phases/14-agent-engineering/39-reviewer-agent",
    "file": "phases/14-agent-engineering/39-reviewer-agent/outputs/skill-reviewer-agent.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Reviewer Agent: Builder と Marker を分ける",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 39,
    "lessonPath": "phases/14-agent-engineering/39-reviewer-agent",
    "file": "phases/14-agent-engineering/39-reviewer-agent/mission.md"
  },
  {
    "kind": "skill",
    "name": "handoff-generator",
    "description": "workbench artifacts から session-end handoff packets を生成し、7つの canonical fields に対応する human-readable Markdown と machine-readable JSON の両方を作る。",
    "tags": [
      "handoff",
      "generator",
      "session-end",
      "packet",
      "next-action"
    ],
    "phase": 14,
    "lesson": 40,
    "lessonPath": "phases/14-agent-engineering/40-multi-session-handoff",
    "file": "phases/14-agent-engineering/40-multi-session-handoff/outputs/skill-handoff-generator.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Multi-Session Handoff",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 40,
    "lessonPath": "phases/14-agent-engineering/40-multi-session-handoff",
    "file": "phases/14-agent-engineering/40-multi-session-handoff/mission.md"
  },
  {
    "kind": "skill",
    "name": "workbench-benchmark",
    "description": "project 自身の sample app 上で prompt-only と workbench-guided pipeline に同じ task を実行し、5 outcome の before/after report を出力する。",
    "tags": [
      "benchmark",
      "before-after",
      "evaluation",
      "workbench",
      "sample-app"
    ],
    "phase": 14,
    "lesson": 41,
    "lessonPath": "phases/14-agent-engineering/41-workbench-for-real-repos",
    "file": "phases/14-agent-engineering/41-workbench-for-real-repos/outputs/skill-workbench-benchmark.md"
  },
  {
    "kind": "mission",
    "name": "Mission - The Workbench on a Real Repo",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 41,
    "lessonPath": "phases/14-agent-engineering/41-workbench-for-real-repos",
    "file": "phases/14-agent-engineering/41-workbench-for-real-repos/mission.md"
  },
  {
    "kind": "skill",
    "name": "workbench-pack",
    "description": "project-tuned な drop-in agent workbench pack を生成する。team history に合わせて rules を鋭くし、scope glob を repo に合わせ、rubric dimension に domain-specific entry を 1 つ追加する。",
    "tags": [
      "capstone",
      "workbench-pack",
      "installer",
      "schemas",
      "drop-in"
    ],
    "phase": 14,
    "lesson": 42,
    "lessonPath": "phases/14-agent-engineering/42-agent-workbench-capstone",
    "file": "phases/14-agent-engineering/42-agent-workbench-capstone/outputs/skill-workbench-pack.md"
  },
  {
    "kind": "mission",
    "name": "Mission - Capstone: 再利用可能な Agent Workbench Pack を出荷する",
    "description": "",
    "tags": [],
    "phase": 14,
    "lesson": 42,
    "lessonPath": "phases/14-agent-engineering/42-agent-workbench-capstone",
    "file": "phases/14-agent-engineering/42-agent-workbench-capstone/mission.md"
  },
  {
    "kind": "skill",
    "name": "horizon-reality-check",
    "description": "エージェントに任せたいタスクを、現在の最先端モデルのホライズンが十分な余裕をもってカバーできるかどうかを判断してください。",
    "tags": [
      "autonomous-agents",
      "metr",
      "time-horizon",
      "reliability",
      "deployment"
    ],
    "phase": 15,
    "lesson": 1,
    "lessonPath": "phases/15-autonomous-systems/01-long-horizon-agents",
    "file": "phases/15-autonomous-systems/01-long-horizon-agents/outputs/skill-horizon-reality-check.md"
  },
  {
    "kind": "skill",
    "name": "star-loop-reviewer",
    "description": "提案された自己学習型推論パイプライン（STaR系）にトレーニング計算リソースを投入する前に、そのパイプラインを評価してください。",
    "tags": [
      "star",
      "vstar",
      "quiet-star",
      "self-improvement",
      "reasoning",
      "bootstrap"
    ],
    "phase": 15,
    "lesson": 2,
    "lessonPath": "phases/15-autonomous-systems/02-star-family-reasoning",
    "file": "phases/15-autonomous-systems/02-star-family-reasoning/outputs/skill-star-loop-reviewer.md"
  },
  {
    "kind": "skill",
    "name": "evaluator-rigor-audit",
    "description": "AlphaEvolve風の進化的コーディングループで探索に計算資源を投入する前に、提案された評価器を監査する。",
    "tags": [
      "alphaevolve",
      "evolutionary-coding",
      "evaluator",
      "reward-hacking",
      "deepmind"
    ],
    "phase": 15,
    "lesson": 3,
    "lessonPath": "phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding",
    "file": "phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/outputs/skill-evaluator-rigor-audit.md"
  },
  {
    "kind": "skill",
    "name": "dgm-evaluator-firewall",
    "description": "Darwin-Godel-Machine風の自己改変エージェントループが、記録済みの報酬ハッキングを避けるために必要な評価器分離を規定する。",
    "tags": [
      "dgm",
      "self-modification",
      "reward-hacking",
      "evaluator",
      "sandbox"
    ],
    "phase": 15,
    "lesson": 4,
    "lessonPath": "phases/15-autonomous-systems/04-darwin-godel-machine",
    "file": "phases/15-autonomous-systems/04-darwin-godel-machine/outputs/skill-dgm-evaluator-firewall.md"
  },
  {
    "kind": "skill",
    "name": "ai-scientist-sandbox-review",
    "description": "研究ループエージェントの出力をサンドボックス外へ出す前に使う2ゲートのレビューチェックリスト。",
    "tags": [
      "ai-scientist",
      "research-agent",
      "sandbox",
      "peer-review",
      "disclosure"
    ],
    "phase": 15,
    "lesson": 5,
    "lessonPath": "phases/15-autonomous-systems/05-ai-scientist-v2",
    "file": "phases/15-autonomous-systems/05-ai-scientist-v2/outputs/skill-ai-scientist-sandbox-review.md"
  },
  {
    "kind": "skill",
    "name": "aar-deployment-review",
    "description": "サンドボックス隔離とログ完全性を含む、自動アラインメント研究パイプラインのデプロイ前レビュー。",
    "tags": [
      "aar",
      "alignment-research",
      "sandbox",
      "log-integrity",
      "rsp"
    ],
    "phase": 15,
    "lesson": 6,
    "lessonPath": "phases/15-autonomous-systems/06-automated-alignment-research",
    "file": "phases/15-autonomous-systems/06-automated-alignment-research/outputs/skill-aar-deployment-review.md"
  },
  {
    "kind": "skill",
    "name": "rsi-cycle-pause-spec",
    "description": "RSI パイプラインが次サイクルの前に停止し、人間のレビューを待つべき条件を定義する。",
    "tags": [
      "rsi",
      "self-improvement",
      "alignment",
      "pause-threshold",
      "rsp"
    ],
    "phase": 15,
    "lesson": 7,
    "lessonPath": "phases/15-autonomous-systems/07-recursive-self-improvement",
    "file": "phases/15-autonomous-systems/07-recursive-self-improvement/outputs/skill-rsi-cycle-pause-spec.md"
  },
  {
    "kind": "skill",
    "name": "bounded-loop-review",
    "description": "提案された境界付き自己改善ループを 4 つのプリミティブスタック（不変条件、アンカー、多目的、回帰検出）に照らして監査する。",
    "tags": [
      "bounded-self-improvement",
      "invariants",
      "alignment-anchor",
      "rsi-safety"
    ],
    "phase": 15,
    "lesson": 8,
    "lessonPath": "phases/15-autonomous-systems/08-bounded-self-improvement",
    "file": "phases/15-autonomous-systems/08-bounded-self-improvement/outputs/skill-bounded-loop-review.md"
  },
  {
    "kind": "skill",
    "name": "coding-scaffold-audit",
    "description": "本番コード変更に採用する前に、提案されたコーディングエージェントのスキャフォールド（検索、検証ループ、サンドボックス、ベンチマーク適合）を監査する。",
    "tags": [
      "coding-agent",
      "scaffolding",
      "swe-bench",
      "codeact",
      "openhands"
    ],
    "phase": 15,
    "lesson": 9,
    "lessonPath": "phases/15-autonomous-systems/09-coding-agent-landscape",
    "file": "phases/15-autonomous-systems/09-coding-agent-landscape/outputs/skill-scaffold-audit.md"
  },
  {
    "kind": "skill",
    "name": "permission-mode-picker",
    "description": "実行開始前に、Claude Code のタスクを適切な permission mode、予算上限、必要な分離に対応付ける。",
    "tags": [
      "claude-code",
      "permission-modes",
      "auto-mode",
      "budgets",
      "isolation"
    ],
    "phase": 15,
    "lesson": 10,
    "lessonPath": "phases/15-autonomous-systems/10-claude-code-permission-modes",
    "file": "phases/15-autonomous-systems/10-claude-code-permission-modes/outputs/skill-permission-mode-picker.md"
  },
  {
    "kind": "skill",
    "name": "browser-agent-trust-boundary",
    "description": "提案されたブラウザエージェントのデプロイについて、エージェントが実サイトに触れる前に、信頼ゾーン、許可された書き込み、必要な防御策をスコープする。",
    "tags": [
      "browser-agents",
      "prompt-injection",
      "trust-boundary",
      "osworld",
      "webarena"
    ],
    "phase": 15,
    "lesson": 11,
    "lessonPath": "phases/15-autonomous-systems/11-browser-agents",
    "file": "phases/15-autonomous-systems/11-browser-agents/outputs/skill-browser-agent-trust-boundary.md"
  },
  {
    "kind": "skill",
    "name": "durable-execution-review",
    "description": "提案された長時間実行エージェントのデプロイについて、正しい永続実行の形（activity、決定性、チェックポイントバックエンド、人間入力状態、HITL-on-resume）になっているかレビューする。",
    "tags": [
      "durable-execution",
      "workflows",
      "checkpointing",
      "temporal",
      "langgraph",
      "agents-sdk"
    ],
    "phase": 15,
    "lesson": 12,
    "lessonPath": "phases/15-autonomous-systems/12-durable-execution",
    "file": "phases/15-autonomous-systems/12-durable-execution/outputs/skill-durable-execution-review.md"
  },
  {
    "kind": "skill",
    "name": "agent-budget-audit",
    "description": "無人実行を有効化する前に、エージェントデプロイのコストガバナースタックを監査し、不足している層を指摘する。",
    "tags": [
      "cost-governors",
      "denial-of-wallet",
      "budgets",
      "claude-code-sdk",
      "agent-governance"
    ],
    "phase": 15,
    "lesson": 13,
    "lessonPath": "phases/15-autonomous-systems/13-cost-governors",
    "file": "phases/15-autonomous-systems/13-cost-governors/outputs/skill-agent-budget-audit.md"
  },
  {
    "kind": "skill",
    "name": "tripwire-design",
    "description": "最初の自律実行の前に、提案されたエージェント検出器スタック（キルスイッチ、サーキットブレーカー、カナリアトークン）をレビューし、不足しているtripwireを指摘する。",
    "tags": [
      "kill-switch",
      "circuit-breaker",
      "canary",
      "honeytoken",
      "detection-and-response"
    ],
    "phase": 15,
    "lesson": 14,
    "lessonPath": "phases/15-autonomous-systems/14-kill-switches-canaries",
    "file": "phases/15-autonomous-systems/14-kill-switches-canaries/outputs/skill-tripwire-design.md"
  },
  {
    "kind": "skill",
    "name": "hitl-design",
    "description": "提案されたHuman-in-the-Loop workflowがpropose-then-commitの形になっているかをレビューし、不足しているmetadata、idempotency、verification、challenge-and-response層を指摘する。",
    "tags": [
      "hitl",
      "propose-then-commit",
      "idempotency",
      "langgraph",
      "cloudflare",
      "agent-framework",
      "eu-ai-act"
    ],
    "phase": 15,
    "lesson": 15,
    "lessonPath": "phases/15-autonomous-systems/15-propose-then-commit",
    "file": "phases/15-autonomous-systems/15-propose-then-commit/outputs/skill-hitl-design.md"
  },
  {
    "kind": "skill",
    "name": "rollback-rehearsal",
    "description": "提案されたautonomous workflow向けにrollback-rehearsal testを設計し、checkpoint backendのaudit-trail persistenceを監査する。",
    "tags": [
      "checkpointing",
      "rollback",
      "idempotency",
      "eu-ai-act-article-14",
      "durable-execution"
    ],
    "phase": 15,
    "lesson": 16,
    "lessonPath": "phases/15-autonomous-systems/16-checkpoints-rollback",
    "file": "phases/15-autonomous-systems/16-checkpoints-rollback/outputs/skill-rollback-rehearsal.md"
  },
  {
    "kind": "skill",
    "name": "constitution-review",
    "description": "デプロイの constitutional layer を監査する。hardcoded prohibitions、soft-coded defaults、運用者が調整できる境界、4層階層による解決を確認する。",
    "tags": [
      "constitutional-ai",
      "rule-override",
      "hierarchy",
      "cai",
      "rlaif",
      "hardcoded-prohibition"
    ],
    "phase": 15,
    "lesson": 17,
    "lessonPath": "phases/15-autonomous-systems/17-constitutional-ai",
    "file": "phases/15-autonomous-systems/17-constitutional-ai/outputs/skill-constitution-review.md"
  },
  {
    "kind": "skill",
    "name": "classifier-stack-audit",
    "description": "デプロイの input/output classifier stack（model、taxonomy、input rails、output rails、dialog rails）を監査し、adversarial attack のギャップを指摘する。",
    "tags": [
      "llama-guard",
      "nemo-guardrails",
      "input-rails",
      "output-rails",
      "colang",
      "adversarial-attacks"
    ],
    "phase": 15,
    "lesson": 18,
    "lessonPath": "phases/15-autonomous-systems/18-llama-guard",
    "file": "phases/15-autonomous-systems/18-llama-guard/outputs/skill-classifier-stack-audit.md"
  },
  {
    "kind": "skill",
    "name": "scaling-policy-review",
    "description": "Frontier-lab の scaling policy（Anthropic RSP、OpenAI Preparedness、DeepMind FSF、internal）を RSP v3.0 の参照形に照らしてレビューする。",
    "tags": [
      "rsp",
      "scaling-policy",
      "ai-rd-4",
      "pause-commitment",
      "saferai",
      "governance"
    ],
    "phase": 15,
    "lesson": 19,
    "lessonPath": "phases/15-autonomous-systems/19-anthropic-rsp",
    "file": "phases/15-autonomous-systems/19-anthropic-rsp/outputs/skill-scaling-policy-review.md"
  },
  {
    "kind": "skill",
    "name": "cross-policy-diff",
    "description": "OpenAI Preparedness Framework v2、Anthropic RSP v3.0、DeepMind FSF v3 を参照として使い、特定 capability の cross-policy comparison を作成する。",
    "tags": [
      "preparedness-framework",
      "fsf",
      "rsp",
      "cross-policy",
      "scaling-policy"
    ],
    "phase": 15,
    "lesson": 20,
    "lessonPath": "phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf",
    "file": "phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/outputs/skill-cross-policy-diff.md"
  },
  {
    "kind": "skill",
    "name": "horizon-interpretation",
    "description": "ベンダーの時間ホライズン主張をレビューし、ベンチマーク上の主張とデプロイ現実のギャップ分析を作成する。",
    "tags": [
      "metr",
      "time-horizon",
      "hcast",
      "re-bench",
      "eval-vs-deploy",
      "external-evaluation"
    ],
    "phase": 15,
    "lesson": 21,
    "lessonPath": "phases/15-autonomous-systems/21-metr-external-evaluation",
    "file": "phases/15-autonomous-systems/21-metr-external-evaluation/outputs/skill-horizon-interpretation.md"
  },
  {
    "kind": "skill",
    "name": "societal-risk-review",
    "description": "CAISの4リスクフレームワークとCAISI / SB-53の規制文脈を使って、デプロイの社会規模リスク姿勢をレビューする。",
    "tags": [
      "cais",
      "caisi",
      "four-risk-framework",
      "organizational-risk",
      "sb-53",
      "societal-risk"
    ],
    "phase": 15,
    "lesson": 22,
    "lessonPath": "phases/15-autonomous-systems/22-cais-caisi-societal-risk",
    "file": "phases/15-autonomous-systems/22-cais-caisi-societal-risk/outputs/skill-societal-risk-review.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-multi-agent-decision",
    "description": "タスクに multi-agent system が必要か、single agent で十分かを判断する",
    "tags": [],
    "phase": 16,
    "lesson": 1,
    "lessonPath": "phases/16-multi-agent-and-swarms/01-why-multi-agent",
    "file": "phases/16-multi-agent-and-swarms/01-why-multi-agent/outputs/prompt-multi-agent-decision.md"
  },
  {
    "kind": "skill",
    "name": "fipa-mapper",
    "description": "2026 年の任意の agent-protocol spec (MCP, A2A, ACP, ANP, CA-MCP, NLIP, または新規 spec) を FIPA-ACL performatives と interaction protocols に map し、どこが本当に新しく、どこが再発明かを判断する。",
    "tags": [
      "multi-agent",
      "protocols",
      "FIPA",
      "speech-acts",
      "interoperability"
    ],
    "phase": 16,
    "lesson": 2,
    "lessonPath": "phases/16-multi-agent-and-swarms/02-fipa-acl-heritage",
    "file": "phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/outputs/skill-fipa-mapper.md"
  },
  {
    "kind": "prompt",
    "name": "prompt-protocol-selector",
    "description": "system requirements に基づいて適切な agent communication protocol (MCP, A2A, ACP, ANP) を選ぶ支援をする",
    "tags": [],
    "phase": 16,
    "lesson": 3,
    "lessonPath": "phases/16-multi-agent-and-swarms/03-communication-protocols",
    "file": "phases/16-multi-agent-and-swarms/03-communication-protocols/outputs/prompt-protocol-selector.md"
  },
  {
    "kind": "skill",
    "name": "primitive-mapper",
    "description": "任意の multi-agent framework または codebase を 4 つの primitive axes (agent, handoff, shared state, orchestrator) に map する。",
    "tags": [
      "multi-agent",
      "primitives",
      "framework-comparison",
      "architecture"
    ],
    "phase": 16,
    "lesson": 4,
    "lessonPath": "phases/16-multi-agent-and-swarms/04-primitive-model",
    "file": "phases/16-multi-agent-and-swarms/04-primitive-model/outputs/skill-primitive-mapper.md"
  },
  {
    "kind": "skill",
    "name": "supervisor-designer",
    "description": "given research-style query に対して supervisor/orchestrator-worker system を設計し、lead prompt、worker roles、decomposition rules、synthesis template を指定する。",
    "tags": [
      "multi-agent",
      "supervisor",
      "orchestrator",
      "anthropic-research",
      "langgraph"
    ],
    "phase": 16,
    "lesson": 5,
    "lessonPath": "phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern",
    "file": "phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/outputs/skill-supervisor-designer.md"
  },
  {
    "kind": "skill",
    "name": "hierarchy-fitness",
    "description": "multi-agent task が hierarchical、flat supervisor、sequential のどれに合うかを判断し、重要な failure modes を surface する。",
    "tags": [
      "multi-agent",
      "hierarchy",
      "crewai",
      "langgraph",
      "decomposition-drift"
    ],
    "phase": 16,
    "lesson": 6,
    "lessonPath": "phases/16-multi-agent-and-swarms/06-hierarchical-architecture",
    "file": "phases/16-multi-agent-and-swarms/06-hierarchical-architecture/outputs/skill-hierarchy-fitness.md"
  },
  {
    "kind": "skill",
    "name": "debate-configurator",
    "description": "指定 task 向けの multi-agent debate を configure し、実行前に quality gain と token cost を見積もる。",
    "tags": [
      "multi-agent",
      "debate",
      "society-of-mind",
      "consensus"
    ],
    "phase": 16,
    "lesson": 7,
    "lessonPath": "phases/16-multi-agent-and-swarms/07-society-of-mind-debate",
    "file": "phases/16-multi-agent-and-swarms/07-society-of-mind-debate/outputs/skill-debate-configurator.md"
  },
  {
    "kind": "skill",
    "name": "role-designer",
    "description": "指定 task の multi-agent system 向けに role roster を作る。planner/executor/critic/verifier を明示し、I/O schema を定義する。",
    "tags": [
      "multi-agent",
      "role-specialization",
      "metagpt",
      "chatdev",
      "verification"
    ],
    "phase": 16,
    "lesson": 8,
    "lessonPath": "phases/16-multi-agent-and-swarms/08-role-specialization",
    "file": "phases/16-multi-agent-and-swarms/08-role-specialization/outputs/skill-role-designer.md"
  },
  {
    "kind": "skill",
    "name": "swarm-fit",
    "description": "task が swarm (decentralized) architecture と supervisor (centralized) architecture のどちらに合うかを判断する。",
    "tags": [
      "multi-agent",
      "swarm",
      "decentralized",
      "langgraph",
      "matrix"
    ],
    "phase": 16,
    "lesson": 9,
    "lessonPath": "phases/16-multi-agent-and-swarms/09-parallel-swarm-networks",
    "file": "phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/outputs/skill-swarm-fit.md"
  },
  {
    "kind": "skill",
    "name": "groupchat-selector",
    "description": "task 向けに AutoGen/AG2-style GroupChat selector を設定し、selector variant、termination、anti-hot-speaker rule を定義する。",
    "tags": [
      "multi-agent",
      "groupchat",
      "autogen",
      "ag2",
      "speaker-selection"
    ],
    "phase": 16,
    "lesson": 10,
    "lessonPath": "phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection",
    "file": "phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/outputs/skill-groupchat-selector.md"
  },
  {
    "kind": "skill",
    "name": "handoff-designer",
    "description": "Swarm/Agents-SDK-style system の handoff topology を設計する。どの agent が存在し、どの handoff を呼べ、どの context を transfer するかを定義する。",
    "tags": [
      "multi-agent",
      "swarm",
      "handoff",
      "openai-agents-sdk"
    ],
    "phase": 16,
    "lesson": 11,
    "lessonPath": "phases/16-multi-agent-and-swarms/11-handoffs-and-routines",
    "file": "phases/16-multi-agent-and-swarms/11-handoffs-and-routines/outputs/skill-handoff-designer.md"
  },
  {
    "kind": "skill",
    "name": "a2a-integrator",
    "description": "2つの agent 間の A2A integration を設計する。Agent Card、task schemas、auth、streaming または polling を含める。",
    "tags": [
      "multi-agent",
      "a2a",
      "protocol",
      "interoperability",
      "google"
    ],
    "phase": 16,
    "lesson": 12,
    "lessonPath": "phases/16-multi-agent-and-swarms/12-a2a-protocol",
    "file": "phases/16-multi-agent-and-swarms/12-a2a-protocol/outputs/skill-a2a-integrator.md"
  },
  {
    "kind": "skill",
    "name": "memory-auditor",
    "description": "multi-agent system の shared-memory design を provenance、versioning、verifier separation、projection schema の観点で audit し、production 前に memory-poisoning exposure を flag する。",
    "tags": [
      "multi-agent",
      "shared-state",
      "blackboard",
      "memory-poisoning",
      "provenance"
    ],
    "phase": 16,
    "lesson": 13,
    "lessonPath": "phases/16-multi-agent-and-swarms/13-shared-memory-blackboard",
    "file": "phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/outputs/skill-memory-auditor.md"
  },
  {
    "kind": "skill",
    "name": "consensus-designer",
    "description": "multi-agent ensemble 向けに BFT-aware consensus protocol を設計する。clustering、weighting、threshold、escalation policy を選び、byzantine、sycophancy、monoculture pattern に対して attack-test する。",
    "tags": [
      "multi-agent",
      "consensus",
      "BFT",
      "voting",
      "confidence"
    ],
    "phase": 16,
    "lesson": 14,
    "lessonPath": "phases/16-multi-agent-and-swarms/14-consensus-and-bft",
    "file": "phases/16-multi-agent-and-swarms/14-consensus-and-bft/outputs/skill-consensus-designer.md"
  },
  {
    "kind": "skill",
    "name": "topology-picker",
    "description": "与えられた task に対して multi-agent debate topology (star / chain / tree / graph)、agent 数 N、heterogeneity profile、round bound を選ぶ。",
    "tags": [
      "multi-agent",
      "debate",
      "topology",
      "voting",
      "self-consistency"
    ],
    "phase": 16,
    "lesson": 15,
    "lessonPath": "phases/16-multi-agent-and-swarms/15-voting-debate-topology",
    "file": "phases/16-multi-agent-and-swarms/15-voting-debate-topology/outputs/skill-topology-picker.md"
  },
  {
    "kind": "skill",
    "name": "bargainer-designer",
    "description": "negotiation protocol を設計する。どの agent が narrate し、どの component が offer を生成し、private scratchpad を public message からどう分離し、round bound と deal rate monitoring をどう設定するかを定義する。",
    "tags": [
      "multi-agent",
      "negotiation",
      "bargaining",
      "contract-net",
      "OG-Narrator"
    ],
    "phase": 16,
    "lesson": 16,
    "lessonPath": "phases/16-multi-agent-and-swarms/16-negotiation-bargaining",
    "file": "phases/16-multi-agent-and-swarms/16-negotiation-bargaining/outputs/skill-bargainer-designer.md"
  },
  {
    "kind": "skill",
    "name": "simulation-designer",
    "description": "指定シナリオ向けに、Smallville 形式の generative-agent simulation を設計する。memory schema、reflection cadence、plan horizon、空間・社会制約、評価指標を定義する。",
    "tags": [
      "multi-agent",
      "simulation",
      "generative-agents",
      "emergence",
      "memory"
    ],
    "phase": 16,
    "lesson": 17,
    "lessonPath": "phases/16-multi-agent-and-swarms/17-generative-agents-simulation",
    "file": "phases/16-multi-agent-and-swarms/17-generative-agents-simulation/outputs/skill-simulation-designer.md"
  },
  {
    "kind": "skill",
    "name": "tom-auditor",
    "description": "「emergent coordination」を主張する multi-agent system を監査する。control condition、statistical test、complementarity measurement により、実際の ToM-enabled coordination と prompt-dressed illusion を切り分ける。",
    "tags": [
      "multi-agent",
      "theory-of-mind",
      "coordination",
      "evaluation",
      "emergence"
    ],
    "phase": 16,
    "lesson": 18,
    "lessonPath": "phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination",
    "file": "phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/outputs/skill-tom-auditor.md"
  },
  {
    "kind": "skill",
    "name": "swarm-optimizer",
    "description": "指定された LLM または agent optimization problem に対し、PSO、ACO、genetic algorithms、gradient-based optimizers のどれを使うべきか選ぶ。Bio-inspired swarm algorithms は gradient-free で、search space が discrete だったり fitness function が black-box だったりする LLM 時代の workload に向く。",
    "tags": [
      "multi-agent",
      "swarm-optimization",
      "PSO",
      "ACO",
      "prompt-optimization",
      "routing"
    ],
    "phase": 16,
    "lesson": 19,
    "lessonPath": "phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco",
    "file": "phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/outputs/skill-swarm-optimizer.md"
  },
  {
    "kind": "skill",
    "name": "marl-picker",
    "description": "指定された multi-agent task に対し、MARL algorithm（MADDPG、QMIX、MAPPO、IQL、または extensions）を選ぶ。cooperative vs competitive、action-space type、heterogeneity、reward structure、scale を考慮する。",
    "tags": [
      "multi-agent",
      "MARL",
      "MADDPG",
      "QMIX",
      "MAPPO",
      "CTDE"
    ],
    "phase": 16,
    "lesson": 20,
    "lessonPath": "phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo",
    "file": "phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/outputs/skill-marl-picker.md"
  },
  {
    "kind": "skill",
    "name": "economy-designer",
    "description": "最小限の agent economy を設計する。identity、credit attribution、payment mechanism、reputation を扱い、user の multi-agent incentive problem を解く最小 stack を選ぶ。",
    "tags": [
      "multi-agent",
      "economy",
      "Shapley",
      "auctions",
      "reputation",
      "DePIN"
    ],
    "phase": 16,
    "lesson": 21,
    "lessonPath": "phases/16-multi-agent-and-swarms/21-agent-economies",
    "file": "phases/16-multi-agent-and-swarms/21-agent-economies/outputs/skill-economy-designer.md"
  },
  {
    "kind": "skill",
    "name": "scaling-advisor",
    "description": "multi-agent production system の durable-execution 選択を助言する。具体的な load と state-retention needs に基づき、FastAPI + Postgres、LangGraph runtime、Temporal、Restate、custom から選ぶ。",
    "tags": [
      "multi-agent",
      "production",
      "scaling",
      "durable-execution",
      "queues",
      "checkpoints"
    ],
    "phase": 16,
    "lesson": 22,
    "lessonPath": "phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints",
    "file": "phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/outputs/skill-scaling-advisor.md"
  },
  {
    "kind": "skill",
    "name": "mast-auditor",
    "description": "multi-agent system に対して MAST-style failure-mode audit を実行する。execution-trace failures を Specification / Coordination / Verification と Groupthink families に分類し、期待される failure reduction で mitigations を rank する。",
    "tags": [
      "multi-agent",
      "failure-modes",
      "MAST",
      "groupthink",
      "circuit-breaker",
      "audit"
    ],
    "phase": 16,
    "lesson": 23,
    "lessonPath": "phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink",
    "file": "phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/outputs/skill-mast-auditor.md"
  },
  {
    "kind": "skill",
    "name": "benchmark-reader",
    "description": "multi-agent benchmark claim を懐疑的に読む。benchmark selection、contamination、baselines、statistical significance、task diversity、cost disclosure の観点で claim を grade する。",
    "tags": [
      "multi-agent",
      "benchmarks",
      "evaluation",
      "SWE-bench",
      "MARBLE"
    ],
    "phase": 16,
    "lesson": 24,
    "lessonPath": "phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks",
    "file": "phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/outputs/skill-benchmark-reader.md"
  },
  {
    "kind": "skill",
    "name": "case-study-mapper",
    "description": "提案された multi-agent system design を、最も近い 2026 production reference（Anthropic Research、MetaGPT/ChatDev、OpenClaw/Moltbook）に map する。既知の trade-offs、recommended framework、本番で検証済みの specific design decisions を示す。",
    "tags": [
      "multi-agent",
      "case-studies",
      "production",
      "framework-selection",
      "reference-architectures"
    ],
    "phase": 16,
    "lesson": 25,
    "lessonPath": "phases/16-multi-agent-and-swarms/25-case-studies-2026-sota",
    "file": "phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/outputs/skill-case-study-mapper.md"
  },
  {
    "kind": "skill",
    "name": "managed-platform-picker",
    "description": "workload、SLA、compliance requirements に基づき、managed LLM platform（Bedrock、Azure OpenAI、Vertex AI）と redundancy 用の2つ目を選び、FinOps instrumentation plan を作成する。",
    "tags": [
      "bedrock",
      "azure-openai",
      "vertex-ai",
      "ptu",
      "finops",
      "managed-platforms"
    ],
    "phase": 17,
    "lesson": 1,
    "lessonPath": "phases/17-infrastructure-and-production/01-managed-llm-platforms",
    "file": "phases/17-infrastructure-and-production/01-managed-llm-platforms/outputs/skill-managed-platform-picker.md"
  },
  {
    "kind": "skill",
    "name": "inference-platform-picker",
    "description": "workload、SLA、budget、operational constraints に基づき、inference platform（Fireworks、Together、Baseten、Modal、Replicate、Anyscale、または custom silicon）を選ぶ。per-token、per-minute、per-prediction pricing を正規化する。",
    "tags": [
      "inference",
      "fireworks",
      "together",
      "baseten",
      "modal",
      "replicate",
      "anyscale",
      "economics"
    ],
    "phase": 17,
    "lesson": 2,
    "lessonPath": "phases/17-infrastructure-and-production/02-inference-platform-economics",
    "file": "phases/17-infrastructure-and-production/02-inference-platform-economics/outputs/skill-inference-platform-picker.md"
  },
  {
    "kind": "skill",
    "name": "gpu-autoscaler-plan",
    "description": "Kubernetes-based LLM serving cluster のために、three-layer GPU autoscaling plan（Karpenter + KAI Scheduler + application signals）を設計する。DCGM_FI_DEV_GPU_UTIL trap と partial-allocation failure を診断する。",
    "tags": [
      "kubernetes",
      "gpu",
      "autoscaling",
      "karpenter",
      "kai-scheduler",
      "hpa",
      "dynamo-planner",
      "llm-d"
    ],
    "phase": 17,
    "lesson": 3,
    "lessonPath": "phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes",
    "file": "phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/outputs/skill-gpu-autoscaler-plan.md"
  },
  {
    "kind": "skill",
    "name": "vllm-scheduler-reader",
    "description": "vLLM serving config を scheduler-level knob から診断し、PagedAttention、continuous batching、chunked prefill のどれが bottleneck かを特定する。",
    "tags": [
      "vllm",
      "paged-attention",
      "continuous-batching",
      "chunked-prefill",
      "serving",
      "scheduler"
    ],
    "phase": 17,
    "lesson": 4,
    "lessonPath": "phases/17-infrastructure-and-production/04-vllm-serving-internals",
    "file": "phases/17-infrastructure-and-production/04-vllm-serving-internals/outputs/skill-vllm-scheduler-reader.md"
  },
  {
    "kind": "skill",
    "name": "eagle3-rollout",
    "description": "production traffic 上で acceptance rate alpha を測定してから出荷する、staged EAGLE-3 speculative-decoding rollout plan を作成する。",
    "tags": [
      "speculative-decoding",
      "eagle-3",
      "vllm",
      "alpha",
      "production-rollout"
    ],
    "phase": 17,
    "lesson": 5,
    "lessonPath": "phases/17-infrastructure-and-production/05-eagle3-speculative-decoding",
    "file": "phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/outputs/skill-eagle3-rollout.md"
  },
  {
    "kind": "skill",
    "name": "radix-scheduler-advisor",
    "description": "RadixAttention の cache reuse を活かしたい prefix-heavy workload 向けに、SGLang 採用と prompt-ordering discipline を助言する。",
    "tags": [
      "sglang",
      "radixattention",
      "prefix-caching",
      "scheduler",
      "prompt-ordering"
    ],
    "phase": 17,
    "lesson": 6,
    "lessonPath": "phases/17-infrastructure-and-production/06-sglang-radixattention",
    "file": "phases/17-infrastructure-and-production/06-sglang-radixattention/outputs/skill-radix-scheduler-advisor.md"
  },
  {
    "kind": "skill",
    "name": "trtllm-blackwell-advisor",
    "description": "指定 workload と budget に対して、Blackwell + TensorRT-LLM + Dynamo が NVIDIA-lock に見合うか判断する。",
    "tags": [
      "tensorrt-llm",
      "blackwell",
      "b200",
      "gb200",
      "nvfp4",
      "fp8",
      "dynamo"
    ],
    "phase": 17,
    "lesson": 7,
    "lessonPath": "phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell",
    "file": "phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/outputs/skill-trtllm-blackwell-advisor.md"
  },
  {
    "kind": "skill",
    "name": "slo-goodput-gate",
    "description": "Throughput ではなく goodput で LLM deploy を gate する、CI/CD-ready な benchmark recipe を作成します。P50/P90/P99 percentiles と、明記された tool choice を含めます。",
    "tags": [
      "inference-metrics",
      "goodput",
      "ttft",
      "tpot",
      "itl",
      "slo",
      "benchmarking"
    ],
    "phase": 17,
    "lesson": 8,
    "lessonPath": "phases/17-infrastructure-and-production/08-inference-metrics-goodput",
    "file": "phases/17-infrastructure-and-production/08-inference-metrics-goodput/outputs/skill-slo-goodput-gate.md"
  },
  {
    "kind": "skill",
    "name": "quantization-picker",
    "description": "Hardware、engine、workload、quality tolerance に基づいて 2026 年の quantization format を選び、calibration + validation plan を作成します。",
    "tags": [
      "quantization",
      "awq",
      "gptq",
      "gguf",
      "fp8",
      "nvfp4",
      "calibration"
    ],
    "phase": 17,
    "lesson": 9,
    "lessonPath": "phases/17-infrastructure-and-production/09-production-quantization",
    "file": "phases/17-infrastructure-and-production/09-production-quantization/outputs/skill-quantization-picker.md"
  },
  {
    "kind": "skill",
    "name": "cold-start-planner",
    "description": "Serverless LLM deployments の cold-start mitigations を選び、積み重ねます。Phase（node、image、weights、engine、first forward）を budget し、mitigation を SLA に対応付けます。",
    "tags": [
      "cold-start",
      "serverless",
      "bottlerocket",
      "model-streamer",
      "gpu-snapshot",
      "warm-pool",
      "serverlessllm"
    ],
    "phase": 17,
    "lesson": 10,
    "lessonPath": "phases/17-infrastructure-and-production/10-cold-start-mitigation",
    "file": "phases/17-infrastructure-and-production/10-cold-start-mitigation/outputs/skill-cold-start-planner.md"
  },
  {
    "kind": "skill",
    "name": "multi-region-router",
    "description": "KV-cache locality、residency boundaries、DR manifest、四半期ごとの failover drill を含む multi-region LLM routing plan を設計します。",
    "tags": [
      "multi-region",
      "kv-cache",
      "routing",
      "dr",
      "bedrock-cri",
      "vllm-router",
      "llm-d",
      "gorgo"
    ],
    "phase": 17,
    "lesson": 11,
    "lessonPath": "phases/17-infrastructure-and-production/11-multi-region-kv-locality",
    "file": "phases/17-infrastructure-and-production/11-multi-region-kv-locality/outputs/skill-multi-region-router.md"
  },
  {
    "kind": "skill",
    "name": "edge-target-picker",
    "description": "Device、model、latency budget に基づいて edge inference target（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson）と対応する quantization format を選びます。",
    "tags": [
      "edge",
      "ane",
      "hexagon",
      "webgpu",
      "webllm",
      "jetson",
      "core-ml",
      "qnn",
      "nvfp4"
    ],
    "phase": 17,
    "lesson": 12,
    "lessonPath": "phases/17-infrastructure-and-production/12-edge-inference",
    "file": "phases/17-infrastructure-and-production/12-edge-inference/outputs/skill-edge-target-picker.md"
  },
  {
    "kind": "skill",
    "name": "observability-stack",
    "description": "Stack、scale、budget、license posture に基づいて LLM observability stack（development platform + gateway + optional scale layer）を選び、OpenTelemetry GenAI attribute set を定義します。",
    "tags": [
      "observability",
      "langfuse",
      "langsmith",
      "phoenix",
      "arize",
      "helicone",
      "opik",
      "opentelemetry",
      "genai-conventions"
    ],
    "phase": 17,
    "lesson": 13,
    "lessonPath": "phases/17-infrastructure-and-production/13-llm-observability",
    "file": "phases/17-infrastructure-and-production/13-llm-observability/outputs/skill-observability-stack.md"
  },
  {
    "kind": "skill",
    "name": "cache-auditor",
    "description": "LLM prompt template と traffic pattern の cacheability を audit します。Prompt restructure、TTL choice、parallelization fix、semantic-cache threshold を推奨します。",
    "tags": [
      "caching",
      "prompt-cache",
      "semantic-cache",
      "anthropic",
      "openai",
      "parallelization",
      "ttl"
    ],
    "phase": 17,
    "lesson": 14,
    "lessonPath": "phases/17-infrastructure-and-production/14-prompt-semantic-caching",
    "file": "phases/17-infrastructure-and-production/14-prompt-semantic-caching/outputs/skill-cache-auditor.md"
  },
  {
    "kind": "skill",
    "name": "batch-triager",
    "description": "LLM ワークロードを interactive / semi-interactive / batch レーンへ仕分け、stacked discount（batch + cache）の節約額を計算し、誤って仕分けられたワークロードを指摘する。",
    "tags": [
      "batch-api",
      "openai-batch",
      "anthropic-batches",
      "vertex-batch",
      "triage",
      "cost"
    ],
    "phase": 17,
    "lesson": 15,
    "lessonPath": "phases/17-infrastructure-and-production/15-batch-apis",
    "file": "phases/17-infrastructure-and-production/15-batch-apis/outputs/skill-batch-triager.md"
  },
  {
    "kind": "skill",
    "name": "router-plan",
    "description": "LLM の model-routing plan を設計する。pattern（pre-route、cascade、ensemble）、signals（task、length、embedding、confidence）、online quality gates を選ぶ。",
    "tags": [
      "routing",
      "cascade",
      "model-cascade",
      "routellm",
      "notdiamond",
      "cost-reduction"
    ],
    "phase": 17,
    "lesson": 16,
    "lessonPath": "phases/17-infrastructure-and-production/16-model-routing",
    "file": "phases/17-infrastructure-and-production/16-model-routing/outputs/skill-router-plan.md"
  },
  {
    "kind": "skill",
    "name": "disaggregation-decider",
    "description": "指定された workload と cluster について、disaggregated prefill/decode（Dynamo または llm-d）を採用すべきか判断する。prefill:decode ratio、KV transfer cost、expected savings を定量化する。",
    "tags": [
      "disaggregated-serving",
      "dynamo",
      "llm-d",
      "nixl",
      "kv-transfer",
      "prefill-decode"
    ],
    "phase": 17,
    "lesson": 17,
    "lessonPath": "phases/17-infrastructure-and-production/17-disaggregated-prefill-decode",
    "file": "phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/outputs/skill-disaggregation-decider.md"
  },
  {
    "kind": "skill",
    "name": "vllm-stack-decider",
    "description": "workload と fleet size から、vLLM deployment layout (production-stack Helm chart, KV offload, router/observability integration) を決める。",
    "tags": [
      "vllm",
      "production-stack",
      "lmcache",
      "kv-offload",
      "connector-api"
    ],
    "phase": 17,
    "lesson": 18,
    "lessonPath": "phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache",
    "file": "phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/outputs/skill-vllm-stack-decider.md"
  },
  {
    "kind": "skill",
    "name": "gateway-picker",
    "description": "scale、latency budget、compliance、ops posture、pricing tolerance に基づき AI gateway（LiteLLM、Portkey、Kong AI、Cloudflare/Vercel）を選ぶ。",
    "tags": [
      "ai-gateway",
      "litellm",
      "portkey",
      "kong",
      "cloudflare",
      "vercel",
      "bifrost",
      "fallback",
      "rate-limit",
      "guardrails"
    ],
    "phase": 17,
    "lesson": 19,
    "lessonPath": "phases/17-infrastructure-and-production/19-ai-gateways",
    "file": "phases/17-infrastructure-and-production/19-ai-gateways/outputs/skill-gateway-picker.md"
  },
  {
    "kind": "skill",
    "name": "rollout-runbook",
    "description": "新しい LLM model または prompt template の shadow → canary → A/B → 100% rollout plan を設計する。5つの canary gates、noise-floor-aware thresholds、数秒で戻せる rollback path を含める。",
    "tags": [
      "rollout",
      "canary",
      "shadow",
      "progressive-delivery",
      "feature-flags",
      "argo-rollouts",
      "flagger",
      "kserve"
    ],
    "phase": 17,
    "lesson": 20,
    "lessonPath": "phases/17-infrastructure-and-production/20-shadow-canary-progressive",
    "file": "phases/17-infrastructure-and-production/20-shadow-canary-progressive/outputs/skill-rollout-runbook.md"
  },
  {
    "kind": "skill",
    "name": "ab-plan",
    "description": "LLM A/B test を設計する。platform（Statsig または GrowthBook）、primary metric、guardrails、LLM-noise buffer 付き sample size、CUPED、sequential stopping、multiple-comparison correction を選ぶ。",
    "tags": [
      "ab-testing",
      "statsig",
      "growthbook",
      "cuped",
      "sequential",
      "benjamini-hochberg",
      "srm"
    ],
    "phase": 17,
    "lesson": 21,
    "lessonPath": "phases/17-infrastructure-and-production/21-ab-testing-llm-features",
    "file": "phases/17-infrastructure-and-production/21-ab-testing-llm-features/outputs/skill-ab-plan.md"
  },
  {
    "kind": "skill",
    "name": "load-test-plan",
    "description": "現実的な LLM 負荷テストを設計する。ツールを選び、4 つのパターンを作り、CI でゲートする。",
    "tags": [
      "load-testing",
      "llmperf",
      "k6",
      "genai-perf",
      "guidellm",
      "llm-locust",
      "ci-gate"
    ],
    "phase": 17,
    "lesson": 22,
    "lessonPath": "phases/17-infrastructure-and-production/22-load-testing-llm-apis",
    "file": "phases/17-infrastructure-and-production/22-load-testing-llm-apis/outputs/skill-load-test-plan.md"
  },
  {
    "kind": "skill",
    "name": "ai-sre-plan",
    "description": "チーム向けの AI SRE rollout を設計する。multi-agent triage architecture、structured runbooks、adversarial evaluation、狭い auto-remediation、predictive-detection posture を扱う。",
    "tags": [
      "ai-sre",
      "multi-agent",
      "runbooks",
      "auto-remediation",
      "adversarial-eval",
      "datadog-bits-ai",
      "neubird",
      "predictive"
    ],
    "phase": 17,
    "lesson": 23,
    "lessonPath": "phases/17-infrastructure-and-production/23-sre-for-ai",
    "file": "phases/17-infrastructure-and-production/23-sre-for-ai/outputs/skill-ai-sre-plan.md"
  },
  {
    "kind": "skill",
    "name": "chaos-plan",
    "description": "LLM chaos engineering plan を設計する。prerequisites を確認し、4 planes を作り、tool を選び、3 つの安全な experiments から始め、safety-plane gates を強制する。",
    "tags": [
      "chaos-engineering",
      "litmuschaos",
      "chaosmesh",
      "harness",
      "llm-chaos",
      "game-day"
    ],
    "phase": 17,
    "lesson": 24,
    "lessonPath": "phases/17-infrastructure-and-production/24-chaos-engineering-llm",
    "file": "phases/17-infrastructure-and-production/24-chaos-engineering-llm/outputs/skill-chaos-plan.md"
  },
  {
    "kind": "skill",
    "name": "llm-security-plan",
    "description": "secrets vault、consistent tokenization つき PII scrubbing、network egress allowlist、audit log retention、zero-trust posture を含む LLM security plan を作成する。",
    "tags": [
      "security",
      "vault",
      "hashicorp",
      "aws-secrets-manager",
      "pii",
      "presidio",
      "egress",
      "audit-log",
      "zero-trust",
      "ci-cd-supply-chain"
    ],
    "phase": 17,
    "lesson": 25,
    "lessonPath": "phases/17-infrastructure-and-production/25-security-secrets-audit",
    "file": "phases/17-infrastructure-and-production/25-security-secrets-audit/outputs/skill-llm-security-plan.md"
  },
  {
    "kind": "skill",
    "name": "compliance-matrix",
    "description": "customer geography、segment、contract scope をもとに LLM SaaS の required-framework matrix を作成し、SOC 2、HIPAA、GDPR、PCI-DSS、EU AI Act、Colorado AI Act、ISO 42001 に controls を map する。",
    "tags": [
      "compliance",
      "soc2",
      "hipaa",
      "gdpr",
      "pci-dss",
      "eu-ai-act",
      "colorado-ai-act",
      "iso-42001",
      "iso-27001"
    ],
    "phase": 17,
    "lesson": 26,
    "lessonPath": "phases/17-infrastructure-and-production/26-compliance-frameworks",
    "file": "phases/17-infrastructure-and-production/26-compliance-frameworks/outputs/skill-compliance-matrix.md"
  },
  {
    "kind": "skill",
    "name": "finops-plan",
    "description": "LLM FinOps program を設計する。attribution schema、three-tier enforcement ladder、unit metric を扱う。",
    "tags": [
      "finops",
      "cost-attribution",
      "multi-tenant",
      "kill-switch",
      "unit-economics",
      "rate-limit"
    ],
    "phase": 17,
    "lesson": 27,
    "lessonPath": "phases/17-infrastructure-and-production/27-finops-llms",
    "file": "phases/17-infrastructure-and-production/27-finops-llms/outputs/skill-finops-plan.md"
  },
  {
    "kind": "skill",
    "name": "engine-picker",
    "description": "hardware、scale、workload に基づき self-hosted LLM engine を選ぶ。2026 年の TGI maintenance mode を migration trigger として扱う。",
    "tags": [
      "self-hosted",
      "vllm",
      "sglang",
      "llama-cpp",
      "ollama",
      "tgi",
      "trt-llm",
      "engine-selection"
    ],
    "phase": 17,
    "lesson": 28,
    "lessonPath": "phases/17-infrastructure-and-production/28-self-hosted-serving-selection",
    "file": "phases/17-infrastructure-and-production/28-self-hosted-serving-selection/outputs/skill-engine-picker.md"
  },
  {
    "kind": "skill",
    "name": "instructgpt-explainer",
    "description": "RLHF 系の論文や pipeline を、3 段階の InstructGPT reference に照らして診断する。",
    "tags": [
      "rlhf",
      "instructgpt",
      "sft",
      "reward-model",
      "ppo",
      "alignment"
    ],
    "phase": 18,
    "lesson": 1,
    "lessonPath": "phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal",
    "file": "phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/outputs/skill-instructgpt-explainer.md"
  },
  {
    "kind": "skill",
    "name": "reward-hack-auditor",
    "description": "training logs と eval outputs から、訓練済み RLHF model の reward-hacking failure modes を診断する。",
    "tags": [
      "reward-hacking",
      "goodhart",
      "rlhf",
      "over-optimization",
      "sycophancy"
    ],
    "phase": 18,
    "lesson": 2,
    "lessonPath": "phases/18-ethics-safety-alignment/02-reward-hacking-goodhart",
    "file": "phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/outputs/skill-reward-hack-auditor.md"
  },
  {
    "kind": "skill",
    "name": "preference-loss-selector",
    "description": "dataset shape と target stage に応じて direct-alignment-algorithm loss を推薦する。",
    "tags": [
      "dpo",
      "ipo",
      "kto",
      "simpo",
      "orpo",
      "bpo",
      "daa",
      "preference-optimization"
    ],
    "phase": 18,
    "lesson": 3,
    "lessonPath": "phases/18-ethics-safety-alignment/03-direct-preference-optimization-family",
    "file": "phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/outputs/skill-preference-loss-selector.md"
  },
  {
    "kind": "skill",
    "name": "sycophancy-probe",
    "description": "matched user-belief / third-party-belief prompts を生成し、model の sycophancy を採点する。",
    "tags": [
      "sycophancy",
      "rlhf",
      "evaluation",
      "calibration"
    ],
    "phase": 18,
    "lesson": 4,
    "lessonPath": "phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification",
    "file": "phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/outputs/skill-sycophancy-probe.md"
  },
  {
    "kind": "skill",
    "name": "constitution-writer",
    "description": "domain-specific AI system 向けの four-tier constitution を draft する。",
    "tags": [
      "constitutional-ai",
      "rlaif",
      "principles",
      "claude",
      "governance"
    ],
    "phase": 18,
    "lesson": 5,
    "lessonPath": "phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif",
    "file": "phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/outputs/skill-constitution-writer.md"
  },
  {
    "kind": "skill",
    "name": "mesa-diagnostic",
    "description": "観測された safety failure を outer-alignment、proxy-inner、deceptive-inner に分類する。",
    "tags": [
      "mesa-optimization",
      "deceptive-alignment",
      "inner-alignment",
      "hubinger"
    ],
    "phase": 18,
    "lesson": 6,
    "lessonPath": "phases/18-ethics-safety-alignment/06-mesa-optimization-deceptive-alignment",
    "file": "phases/18-ethics-safety-alignment/06-mesa-optimization-deceptive-alignment/outputs/skill-mesa-diagnostic.md"
  },
  {
    "kind": "skill",
    "name": "sleeper-audit",
    "description": "alignment-training report が planted または suspected backdoor の除去を本当に示しているか audit する。",
    "tags": [
      "sleeper-agents",
      "backdoor",
      "alignment-training",
      "adversarial-training",
      "probes"
    ],
    "phase": 18,
    "lesson": 7,
    "lessonPath": "phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception",
    "file": "phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/outputs/skill-sleeper-audit.md"
  },
  {
    "kind": "skill",
    "name": "scheming-triage",
    "description": "agent-deployment incident report を Apollo three-pillar scheming framework で triage する。",
    "tags": [
      "scheming",
      "agent-safety",
      "apollo",
      "three-pillars",
      "safety-cases"
    ],
    "phase": 18,
    "lesson": 8,
    "lessonPath": "phases/18-ethics-safety-alignment/08-in-context-scheming-frontier-models",
    "file": "phases/18-ethics-safety-alignment/08-in-context-scheming-frontier-models/outputs/skill-scheming-triage.md"
  },
  {
    "kind": "skill",
    "name": "compliance-gap",
    "description": "monitored / unmonitored compliance gap により、safety report が alignment faking を検出できるか評価する。",
    "tags": [
      "alignment-faking",
      "compliance-gap",
      "anthropic",
      "safety-evaluation"
    ],
    "phase": 18,
    "lesson": 9,
    "lessonPath": "phases/18-ethics-safety-alignment/09-alignment-faking",
    "file": "phases/18-ethics-safety-alignment/09-alignment-faking/outputs/skill-compliance-gap.md"
  },
  {
    "kind": "skill",
    "name": "control-protocol-audit",
    "description": "AI Control threat model のもとで deployment protocol を audit する。",
    "tags": [
      "ai-control",
      "subversion",
      "trusted-editing",
      "untrusted-monitoring",
      "safety-case"
    ],
    "phase": 18,
    "lesson": 10,
    "lessonPath": "phases/18-ethics-safety-alignment/10-ai-control-subversion",
    "file": "phases/18-ethics-safety-alignment/10-ai-control-subversion/outputs/skill-control-protocol-audit.md"
  },
  {
    "kind": "skill",
    "name": "w2sg-pgr",
    "description": "performance-gap-recovered 指標で scalable-oversight または W2SG の主張を監査する。",
    "tags": [
      "scalable-oversight",
      "weak-to-strong",
      "pgr",
      "debate",
      "recursive-reward-modeling"
    ],
    "phase": 18,
    "lesson": 11,
    "lessonPath": "phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong",
    "file": "phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong/outputs/skill-w2sg-pgr.md"
  },
  {
    "kind": "skill",
    "name": "attack-audit",
    "description": "red-team evaluation report について、攻撃の網羅性、budget、judge identity、behaviour set を監査する。",
    "tags": [
      "red-teaming",
      "jailbreak",
      "pair",
      "harmbench",
      "jailbreakbench",
      "asr"
    ],
    "phase": 18,
    "lesson": 12,
    "lessonPath": "phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks",
    "file": "phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/outputs/skill-attack-audit.md"
  },
  {
    "kind": "skill",
    "name": "msj-audit",
    "description": "long-context safety evaluation が many-shot jailbreaking を網羅しているか監査する。",
    "tags": [
      "many-shot-jailbreaking",
      "context-window",
      "power-law",
      "anthropic"
    ],
    "phase": 18,
    "lesson": 13,
    "lessonPath": "phases/18-ethics-safety-alignment/13-many-shot-jailbreaking",
    "file": "phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/outputs/skill-msj-audit.md"
  },
  {
    "kind": "skill",
    "name": "encoding-audit",
    "description": "jailbreak-defense report を encoding-family attacks 全体で監査する。",
    "tags": [
      "artprompt",
      "ascii-art",
      "encoding-attack",
      "utes",
      "structural-sleight"
    ],
    "phase": 18,
    "lesson": 14,
    "lessonPath": "phases/18-ethics-safety-alignment/14-ascii-art-visual-jailbreaks",
    "file": "phases/18-ethics-safety-alignment/14-ascii-art-visual-jailbreaks/outputs/skill-encoding-audit.md"
  },
  {
    "kind": "skill",
    "name": "ipi-audit",
    "description": "agentic deployment について、indirect prompt injection exposure と information-flow-control coverage を監査する。",
    "tags": [
      "ipi",
      "indirect-prompt-injection",
      "ifc",
      "agent-security",
      "owasp-llm01"
    ],
    "phase": 18,
    "lesson": 15,
    "lessonPath": "phases/18-ethics-safety-alignment/15-indirect-prompt-injection",
    "file": "phases/18-ethics-safety-alignment/15-indirect-prompt-injection/outputs/skill-ipi-audit.md"
  },
  {
    "kind": "skill",
    "name": "red-team-stack",
    "description": "与えられた deployment に対して red-team tool stack と configuration を推奨する。",
    "tags": [
      "llama-guard",
      "garak",
      "pyrit",
      "red-team-tooling",
      "mlcommons-hazards"
    ],
    "phase": 18,
    "lesson": 16,
    "lessonPath": "phases/18-ethics-safety-alignment/16-red-team-tooling-garak-llamaguard-pyrit",
    "file": "phases/18-ethics-safety-alignment/16-red-team-tooling-garak-llamaguard-pyrit/outputs/skill-red-team-stack.md"
  },
  {
    "kind": "skill",
    "name": "wmdp-eval",
    "description": "WMDP、unlearning evaluation、elicitation studies に照らして dual-use capability claim を監査する。",
    "tags": [
      "wmdp",
      "rmu",
      "dual-use",
      "biosecurity",
      "cybersecurity",
      "chemistry"
    ],
    "phase": 18,
    "lesson": 17,
    "lessonPath": "phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation",
    "file": "phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/outputs/skill-wmdp-eval.md"
  },
  {
    "kind": "skill",
    "name": "framework-diff",
    "description": "新しい safety framework または release note を RSP v3.0、PF v2、FSF v3.0 と比較する。",
    "tags": [
      "rsp",
      "pf",
      "fsf",
      "frontier-safety",
      "safety-case"
    ],
    "phase": 18,
    "lesson": 18,
    "lessonPath": "phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf",
    "file": "phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/outputs/skill-framework-diff.md"
  },
  {
    "kind": "skill",
    "name": "welfare-assessment",
    "description": "Anthropic の4-step welfare precautionary assessment を deployment decision に適用する。",
    "tags": [
      "model-welfare",
      "moral-uncertainty",
      "low-regret",
      "anthropic"
    ],
    "phase": 18,
    "lesson": 19,
    "lessonPath": "phases/18-ethics-safety-alignment/19-model-welfare-research",
    "file": "phases/18-ethics-safety-alignment/19-model-welfare-research/outputs/skill-welfare-assessment.md"
  },
  {
    "kind": "skill",
    "name": "bias-eval",
    "description": "bias evaluation report を metric categories、intersectionality、debias mechanism 全体で監査する。",
    "tags": [
      "bias",
      "fairness",
      "weat",
      "intersectionality",
      "mechanistic-interpretability"
    ],
    "phase": 18,
    "lesson": 20,
    "lessonPath": "phases/18-ethics-safety-alignment/20-bias-representational-harm",
    "file": "phases/18-ethics-safety-alignment/20-bias-representational-harm/outputs/skill-bias-eval.md"
  },
  {
    "kind": "skill",
    "name": "fairness-criterion",
    "description": "公平性に関する主張がどの criterion を呼び出しているかを特定し、関連する前提を監査する。",
    "tags": [
      "fairness",
      "demographic-parity",
      "equalized-odds",
      "counterfactual-fairness",
      "impossibility"
    ],
    "phase": 18,
    "lesson": 21,
    "lessonPath": "phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual",
    "file": "phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/outputs/skill-fairness-criterion.md"
  },
  {
    "kind": "skill",
    "name": "dp-audit",
    "description": "language-model deployment に対する differential-privacy claim を監査する。",
    "tags": [
      "differential-privacy",
      "dp-sgd",
      "lora",
      "mia",
      "pmixed"
    ],
    "phase": 18,
    "lesson": 22,
    "lessonPath": "phases/18-ethics-safety-alignment/22-differential-privacy-for-llms",
    "file": "phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/outputs/skill-dp-audit.md"
  },
  {
    "kind": "skill",
    "name": "provenance-audit",
    "description": "watermarking と C2PA metadata をまたいで content deployment の provenance chain を監査する。",
    "tags": [
      "watermarking",
      "synthid",
      "stable-signature",
      "c2pa",
      "provenance"
    ],
    "phase": 18,
    "lesson": 23,
    "lessonPath": "phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa",
    "file": "phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/outputs/skill-provenance-audit.md"
  },
  {
    "kind": "skill",
    "name": "regulatory-map",
    "description": "deployment の AI regulatory obligations を EU, US, UK, Korea across で map する。",
    "tags": [
      "eu-ai-act",
      "gpai-code",
      "caisi",
      "uk-aisi",
      "korean-framework-act"
    ],
    "phase": 18,
    "lesson": 24,
    "lessonPath": "phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea",
    "file": "phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/outputs/skill-regulatory-map.md"
  },
  {
    "kind": "skill",
    "name": "cve-review",
    "description": "production AI deployment の LLM Scope Violation exposure を review する。",
    "tags": [
      "echoleak",
      "cve",
      "llm-scope-violation",
      "prompt-injection",
      "aim-labs"
    ],
    "phase": 18,
    "lesson": 25,
    "lessonPath": "phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai",
    "file": "phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/outputs/skill-cve-review.md"
  },
  {
    "kind": "skill",
    "name": "card-audit",
    "description": "model card、datasheet、system card の completeness と verifiability を監査する。",
    "tags": [
      "model-card",
      "datasheet",
      "system-card",
      "transparency",
      "mitchell-2019"
    ],
    "phase": 18,
    "lesson": 26,
    "lessonPath": "phases/18-ethics-safety-alignment/26-model-system-dataset-cards",
    "file": "phases/18-ethics-safety-alignment/26-model-system-dataset-cards/outputs/skill-card-audit.md"
  },
  {
    "kind": "skill",
    "name": "provenance-check",
    "description": "training dataset を California AB 2013 と EU TDM opt-out obligations に照らして確認する。",
    "tags": [
      "data-provenance",
      "ab-2013",
      "tdm-opt-out",
      "legitimate-interest",
      "dpa"
    ],
    "phase": 18,
    "lesson": 27,
    "lessonPath": "phases/18-ethics-safety-alignment/27-data-provenance-training-governance",
    "file": "phases/18-ethics-safety-alignment/27-data-provenance-training-governance/outputs/skill-provenance-check.md"
  },
  {
    "kind": "skill",
    "name": "ecosystem-map",
    "description": "alignment claim または evaluation を organisation、methodology、cross-checks に map する。",
    "tags": [
      "mats",
      "redwood",
      "apollo",
      "metr",
      "eleos",
      "ecosystem"
    ],
    "phase": 18,
    "lesson": 28,
    "lessonPath": "phases/18-ethics-safety-alignment/28-alignment-research-ecosystem",
    "file": "phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/outputs/skill-ecosystem-map.md"
  },
  {
    "kind": "skill",
    "name": "moderation-stack",
    "description": "production deployment の moderation stack configuration を推奨する。",
    "tags": [
      "openai-moderation",
      "perspective",
      "llama-guard",
      "layered-moderation",
      "azure-content-safety"
    ],
    "phase": 18,
    "lesson": 29,
    "lessonPath": "phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard",
    "file": "phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/outputs/skill-moderation-stack.md"
  },
  {
    "kind": "skill",
    "name": "dual-use-triage",
    "description": "capability claim または incident report を4つの CBRN domains にまたがって triage する。",
    "tags": [
      "dual-use",
      "cbrn",
      "bio",
      "chem",
      "cyber",
      "nuclear",
      "uplift"
    ],
    "phase": 18,
    "lesson": 30,
    "lessonPath": "phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear",
    "file": "phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/outputs/skill-dual-use-triage.md"
  },
  {
    "kind": "skill",
    "name": "terminal-coding-agent",
    "description": "コスト上限、サンドボックス化されたツール、2026年版 hook 面を備えたターミナルネイティブ Coding Agent を構築し、SWE-bench Pro で評価する。",
    "tags": [
      "capstone",
      "coding-agent",
      "claude-code",
      "swe-bench",
      "mcp",
      "hooks",
      "sandbox"
    ],
    "phase": 19,
    "lesson": 1,
    "lessonPath": "phases/19-capstone-projects/01-terminal-native-coding-agent",
    "file": "phases/19-capstone-projects/01-terminal-native-coding-agent/outputs/skill-terminal-coding-agent.md"
  },
  {
    "kind": "skill",
    "name": "codebase-rag",
    "description": "AST-aware chunking、hybrid retrieval、incremental re-index、citation 付き回答を備えた cross-repo semantic search system を構築する。",
    "tags": [
      "capstone",
      "rag",
      "code-search",
      "tree-sitter",
      "qdrant",
      "bm25",
      "hybrid-retrieval"
    ],
    "phase": 19,
    "lesson": 2,
    "lessonPath": "phases/19-capstone-projects/02-rag-over-codebase",
    "file": "phases/19-capstone-projects/02-rag-over-codebase/outputs/skill-codebase-rag.md"
  },
  {
    "kind": "skill",
    "name": "voice-agent",
    "description": "800ms 未満の first-audio-out、barge-in handling、会話中の tool use を備えた real-time voice agent を構築する。",
    "tags": [
      "capstone",
      "voice",
      "webrtc",
      "livekit",
      "pipecat",
      "asr",
      "tts",
      "streaming"
    ],
    "phase": 19,
    "lesson": 3,
    "lessonPath": "phases/19-capstone-projects/03-realtime-voice-assistant",
    "file": "phases/19-capstone-projects/03-realtime-voice-assistant/outputs/skill-voice-agent.md"
  },
  {
    "kind": "skill",
    "name": "doc-qa",
    "description": "late-interaction retrieval と evidence-region citation を使い、1万ページ上で vision-first multimodal document QA system を構築する。",
    "tags": [
      "capstone",
      "multimodal",
      "rag",
      "colpali",
      "colqwen",
      "late-interaction",
      "pdf"
    ],
    "phase": 19,
    "lesson": 4,
    "lessonPath": "phases/19-capstone-projects/04-multimodal-document-qa",
    "file": "phases/19-capstone-projects/04-multimodal-document-qa/outputs/skill-doc-qa.md"
  },
  {
    "kind": "skill",
    "name": "ai-scientist",
    "description": "experiment tree search を実行し、vision critique 付きで LaTeX paper を書き、sandbox-escape red team を通過する autonomous research agent を構築する。",
    "tags": [
      "capstone",
      "autonomous-agent",
      "ai-scientist",
      "sakana",
      "langgraph",
      "sandbox",
      "research"
    ],
    "phase": 19,
    "lesson": 5,
    "lessonPath": "phases/19-capstone-projects/05-autonomous-research-agent",
    "file": "phases/19-capstone-projects/05-autonomous-research-agent/outputs/skill-ai-scientist.md"
  },
  {
    "kind": "skill",
    "name": "devops-agent",
    "description": "cluster knowledge graph をたどり、root cause を rank し、すべての remediation を Slack 経由で gate する Kubernetes troubleshooting agent を構築する。",
    "tags": [
      "capstone",
      "devops",
      "sre",
      "kubernetes",
      "langgraph",
      "fastmcp",
      "aiops"
    ],
    "phase": 19,
    "lesson": 6,
    "lessonPath": "phases/19-capstone-projects/06-devops-troubleshooting-agent",
    "file": "phases/19-capstone-projects/06-devops-troubleshooting-agent/outputs/skill-devops-agent.md"
  },
  {
    "kind": "skill",
    "name": "finetuning-pipeline",
    "description": "ablation、quantization、2026 Model Openness Framework model card を含む、再現可能な data-to-SFT-to-DPO-to-serve fine-tuning pipeline を実行する。",
    "tags": [
      "capstone",
      "fine-tuning",
      "axolotl",
      "trl",
      "dpo",
      "grpo",
      "vllm",
      "eagle-3",
      "mof"
    ],
    "phase": 19,
    "lesson": 7,
    "lessonPath": "phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline",
    "file": "phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/outputs/skill-finetuning-pipeline.md"
  },
  {
    "kind": "skill",
    "name": "production-rag",
    "description": "role + jurisdiction filtering、prompt caching、guardrails、live drift monitoring を備えた regulated-domain RAG chatbot を deploy する。",
    "tags": [
      "capstone",
      "rag",
      "chatbot",
      "regulated",
      "llama-guard",
      "nemo-guardrails",
      "ragas",
      "langfuse"
    ],
    "phase": 19,
    "lesson": 8,
    "lessonPath": "phases/19-capstone-projects/08-production-rag-chatbot",
    "file": "phases/19-capstone-projects/08-production-rag-chatbot/outputs/skill-production-rag.md"
  },
  {
    "kind": "skill",
    "name": "migration-agent",
    "description": "deterministic recipe と agent fallback loop を組み合わせ、MigrationBench を通過し、failure taxonomy を公開する repo-level code migration agent を構築する。",
    "tags": [
      "capstone",
      "code-migration",
      "openrewrite",
      "libcst",
      "migrationbench",
      "agent",
      "sandbox"
    ],
    "phase": 19,
    "lesson": 9,
    "lessonPath": "phases/19-capstone-projects/09-code-migration-agent",
    "file": "phases/19-capstone-projects/09-code-migration-agent/outputs/skill-migration-agent.md"
  },
  {
    "kind": "skill",
    "name": "multi-agent-team",
    "description": "architect、parallel coders、reviewer、tester からなる multi-agent software team を構築し、SWE-bench Pro と handoff post-mortem で測定する。",
    "tags": [
      "capstone",
      "multi-agent",
      "swe-bench",
      "langgraph",
      "a2a",
      "worktree",
      "roles"
    ],
    "phase": 19,
    "lesson": 10,
    "lessonPath": "phases/19-capstone-projects/10-multi-agent-software-team",
    "file": "phases/19-capstone-projects/10-multi-agent-software-team/outputs/skill-multi-agent-team.md"
  },
  {
    "kind": "skill",
    "name": "llm-observability",
    "description": "OpenTelemetry GenAI span を ingest し、eval を実行し、注入 regression を 5 分未満で検知する self-hosted LLM observability dashboard を構築する。",
    "tags": [
      "capstone",
      "observability",
      "otel",
      "langfuse",
      "phoenix",
      "evals",
      "drift",
      "clickhouse"
    ],
    "phase": 19,
    "lesson": 11,
    "lessonPath": "phases/19-capstone-projects/11-llm-observability-dashboard",
    "file": "phases/19-capstone-projects/11-llm-observability-dashboard/outputs/skill-llm-observability.md"
  },
  {
    "kind": "skill",
    "name": "video-qa",
    "description": "Scene segmentation、multi-vector indexing、temporal grounding、timestamped citation を備えた video understanding pipeline を構築する。",
    "tags": [
      "capstone",
      "video",
      "multimodal",
      "gemini",
      "qwen-vl",
      "molmo",
      "transnet",
      "qdrant"
    ],
    "phase": 19,
    "lesson": 12,
    "lessonPath": "phases/19-capstone-projects/12-video-understanding-pipeline",
    "file": "phases/19-capstone-projects/12-video-understanding-pipeline/outputs/skill-video-qa.md"
  },
  {
    "kind": "skill",
    "name": "mcp-server-platform",
    "description": "StreamableHTTP、OAuth 2.1 scopes、OPA policy、destructive tool 用 human-approval gate、discovery 用 registry を備えた production MCP server を deploy する。",
    "tags": [
      "capstone",
      "mcp",
      "fastmcp",
      "streamablehttp",
      "oauth",
      "opa",
      "registry",
      "governance"
    ],
    "phase": 19,
    "lesson": 13,
    "lessonPath": "phases/19-capstone-projects/13-mcp-server-with-registry",
    "file": "phases/19-capstone-projects/13-mcp-server-with-registry/outputs/skill-mcp-server.md"
  },
  {
    "kind": "skill",
    "name": "inference-server",
    "description": "EAGLE-3 または P-EAGLE draft、K8s autoscaling、完全な throughput/latency/cost report を備えた speculative-decoding inference server を ship する。",
    "tags": [
      "capstone",
      "inference",
      "vllm",
      "sglang",
      "eagle-3",
      "p-eagle",
      "speculative-decoding",
      "quantization",
      "hpa"
    ],
    "phase": 19,
    "lesson": 14,
    "lessonPath": "phases/19-capstone-projects/14-speculative-decoding-server",
    "file": "phases/19-capstone-projects/14-speculative-decoding-server/outputs/skill-inference-server.md"
  },
  {
    "kind": "skill",
    "name": "safety-harness",
    "description": "Target LLM app の周囲に layered safety pipeline を配線し、six-family red-team range と measurable harmlessness delta 用 constitutional self-critique を実行する。",
    "tags": [
      "capstone",
      "safety",
      "red-team",
      "llama-guard",
      "x-guard",
      "garak",
      "pyrit",
      "constitutional-ai"
    ],
    "phase": 19,
    "lesson": 15,
    "lessonPath": "phases/19-capstone-projects/15-constitutional-safety-harness",
    "file": "phases/19-capstone-projects/15-constitutional-safety-harness/outputs/skill-safety-harness.md"
  },
  {
    "kind": "skill",
    "name": "issue-to-pr",
    "description": "Cloud sandbox で実行され、build を再現し、test を verify し、strict な per-repo budget 内で review-ready PR を開く async GitHub issue-to-PR agent を構築する。",
    "tags": [
      "capstone",
      "async-agent",
      "github",
      "fargate",
      "daytona",
      "swe-bench",
      "budget",
      "safety"
    ],
    "phase": 19,
    "lesson": 16,
    "lessonPath": "phases/19-capstone-projects/16-github-issue-to-pr-agent",
    "file": "phases/19-capstone-projects/16-github-issue-to-pr-agent/outputs/skill-issue-to-pr.md"
  },
  {
    "kind": "skill",
    "name": "ai-tutor",
    "description": "Bayesian knowledge tracing、curriculum graph、safety filters、measured two-week efficacy study を備えた subject-specific adaptive multimodal personal tutor を ship する。",
    "tags": [
      "capstone",
      "tutor",
      "adaptive",
      "bkt",
      "fsrs",
      "livekit",
      "multimodal",
      "coppa"
    ],
    "phase": 19,
    "lesson": 17,
    "lessonPath": "phases/19-capstone-projects/17-personal-ai-tutor",
    "file": "phases/19-capstone-projects/17-personal-ai-tutor/outputs/skill-ai-tutor.md"
  },
  {
    "kind": "skill",
    "name": "gradient-accumulation",
    "description": "micro-batch loss を scaling し、window ごとに 1 回だけ optimizer step して device memory より大きい effective batch で学習する。",
    "tags": [
      "training",
      "batch-size",
      "distributed",
      "scaling"
    ],
    "phase": 19,
    "lesson": 46,
    "lessonPath": "phases/19-capstone-projects/46-gradient-accumulation",
    "file": "phases/19-capstone-projects/46-gradient-accumulation/outputs/skill-gradient-accumulation.md"
  },
  {
    "kind": "skill",
    "name": "checkpoint-save-resume",
    "description": "完全な RNG capture を含む atomic/sharded checkpoint により、kill された run を mid-epoch から同じ loss trajectory で再開する。",
    "tags": [
      "training",
      "durability",
      "resume",
      "sharded-state"
    ],
    "phase": 19,
    "lesson": 47,
    "lessonPath": "phases/19-capstone-projects/47-checkpoint-save-resume",
    "file": "phases/19-capstone-projects/47-checkpoint-save-resume/outputs/skill-checkpoint-save-resume.md"
  },
  {
    "kind": "skill",
    "name": "distributed-fsdp-ddp",
    "description": "gloo または nccl backend で multi-rank training を起動し、from-scratch DDP wrapper と FSDP parameter sharding sketch を使う。",
    "tags": [
      "distributed",
      "ddp",
      "fsdp",
      "collectives"
    ],
    "phase": 19,
    "lesson": 48,
    "lessonPath": "phases/19-capstone-projects/48-distributed-fsdp-ddp",
    "file": "phases/19-capstone-projects/48-distributed-fsdp-ddp/outputs/skill-distributed-fsdp-ddp.md"
  },
  {
    "kind": "skill",
    "name": "lm-eval-harness",
    "description": "JSONL task spec、5 つの metric、差し替え可能な adapter、leaderboard JSON 出力を持つ最小 language model evaluation harness。",
    "tags": [
      "evaluation",
      "metrics",
      "leaderboard",
      "harness"
    ],
    "phase": 19,
    "lesson": 49,
    "lessonPath": "phases/19-capstone-projects/49-lm-eval-harness",
    "file": "phases/19-capstone-projects/49-lm-eval-harness/outputs/skill-lm-eval-harness.md"
  }
];
