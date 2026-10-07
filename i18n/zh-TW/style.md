# 繁體中文（臺灣）翻譯風格與固定譯名

## 風格

- 讀者是臺灣的 AI 工程學習者；採清楚、自然的教育書面語，不使用生硬直譯或中國用語。
- 以英文原文為準。程式碼、命令、API、變數、路徑、產品名稱和機器讀取欄位維持原樣。
- 以翻譯為主，保留原書的章節順序、標題層級、段落、清單、表格與區塊格式；不要把原有內容改寫成另一種呈現方式，例如把目錄樹或文字區塊改成表格。
- 一般文字使用全形標點；中英混排視閱讀需要加入半形空格。
- 保留既有課程標記。`Build It`、`Use It`、`Ship It`、`Exercises` 可加上繁中說明，但不得移除原文前綴；書籍組裝器會用 `Ship It` 和 `Exercises` 辨識章節。
- Markdown 表格、Mermaid 圖中的標籤，以及純文字區塊中的說明文字可翻譯；保留原有結構、縮排、圖表語法和節點識別碼。程式碼、命令和設定內容維持原樣。原稿若有未標語言的程式碼圍欄，只補上合適標籤，不改動程式碼本體；若是純文字示例，可翻譯其中敘述，但保留排列、縮排和識別碼。
- `Type`、`Languages`、`Prerequisites`、`Time` 等教材中繼資料依原樣保留。

## 格式與架構一致性

- 以英文原稿為準，保留章節順序、標題層級、內容區塊的種類與位置，以及清單和表格的排列方式。
- 不自行把資料夾樹、終端機輸出、純文字範例、清單、表格或圖解改成另一種格式，也不任意拆分、合併或搬動內容區塊。
- 只翻譯讀者可讀的敘述；路徑、命令、設定鍵、程式碼、產品名稱和機器識別碼維持原樣。原稿格式若與專案規範衝突，只做符合規範所需的最小調整，並盡量保留原有內容與結構。

## 固定譯名

| English | 繁體中文（臺灣） |
| --- | --- |
| AI engineering | AI 工程 |
| development environment | 開發環境 |
| toolchain | 工具鏈 |
| virtual environment | 虛擬環境 |
| language runtime | 語言執行環境 |
| package manager | 套件管理工具 |
| repository | 儲存庫 |
| tensor | 張量 |
| dependency | 相依套件 |
| preflight check | 事前檢查 |
| agent | 代理程式 |
| multi-agent system | 多代理系統 |
| technology stack | 技術堆疊 |
| inference | 推論 |
| performance-critical | 重視效能 |
| version control | 版本控制 |
| working directory | 工作目錄 |
| staging area | 暫存區 |
| commit | 提交；指提交動作或提交紀錄，依語境調整 |
| branch | 分支 |
| merge | 合併 |
| remote repository | 遠端儲存庫 |
| GPU acceleration | GPU 加速 |
| cloud GPU | 雲端 GPU |
| benchmark | 效能測試 |
| half precision | 半精度 |
| VRAM | GPU 記憶體 |
| notebook | Notebook；指互動式計算文件，依語境可譯為筆記本 |
| API key | API 金鑰 |
| endpoint | 端點 |
| request body | 請求本文 |
| response body | 回應本文 |
| environment variable | 環境變數 |
| authentication | 驗證 |
| rate limit | 速率限制 |
| token | 詞元 |
| SDK | SDK；指軟體開發套件 |
| streaming | 串流 |
| raw HTTP | 原始 HTTP 請求 |
| kernel | 核心 |
| cell | 儲存格 |
| magic command | 魔術指令 |
| script | 指令碼 |
| inline | 行內 |
| memory leak | 記憶體洩漏 |
| out-of-order execution | 非依序執行 |
| list comprehension | 串列推導式 |
| dependency hell | 相依套件地獄 |
| dependency resolution | 相依套件解析 |
| lockfile | 鎖定檔 |
| global install | 全域安裝 |
| environment isolation | 環境隔離 |
| transitive dependency | 傳遞相依套件 |
| symlink | 符號連結 |
| CUDA version mismatch | CUDA 版本不相容 |
| container | 容器 |
| image | 映像檔 |
| image layer | 映像檔層 |
| volume | Volume（資料卷） |
| volume mount | Volume 掛載 |
| host | 主機 |
| base image | 基底映像檔 |
| inference server | 推論伺服器 |
| vector database | 向量資料庫 |
| orchestration | 編排 |
| editor extension | 編輯器擴充功能 |
| autocomplete | 自動補全 |
| type checking | 型別檢查 |
| language server | 語言伺服器 |
| Language Server Protocol | 語言伺服器通訊協定 |
| linting | 程式碼檢查 |
| format on save | 儲存時自動格式化 |
| terminal integration | 終端機整合 |
| remote development | 遠端開發 |
| debugging | 除錯 |
| dataset | 資料集 |
| data split | 資料集切分 |
| data pipeline | 資料管線 |
| validation set | 驗證集 |
| test set | 測試集 |
| model weights | 模型權重 |
| data version control | 資料版本控制 |
| storage backend | 儲存後端 |
| columnar format | 欄式資料格式 |
| shell | Shell（命令列殼層） |
| pipe | 管線 |
| redirect | 重新導向 |
| background process | 背景程序 |
| process | 程序 |
| terminal multiplexer | 終端機多工器 |
| file system | 檔案系統 |
| root directory | 根目錄 |
| file permissions | 檔案權限 |
| system package | 系統套件 |
| disk space | 磁碟空間 |
| file transfer | 檔案傳輸 |
| line ending | 行尾 |
| embedding | 嵌入向量 |
| profiling | 效能分析 |
| bottleneck | 效能瓶頸 |
| data leakage | 資料洩漏 |
| vanishing gradient | 梯度消失 |
| exploding gradient | 梯度爆炸 |
| gradient clipping | 梯度裁剪 |
| overfitting | 過度擬合 |
| linear algebra | 線性代數 |
| vector | 向量 |
| matrix | 矩陣 |
| norm | 範數 |
| distance metric | 距離指標 |
| L1 norm | L1 範數 |
| L2 norm | L2 範數 |
| Lp norm | Lp 範數 |
| L-infinity norm | L 無窮範數 |
| Euclidean distance | 歐幾里得距離 |
| Manhattan distance | 曼哈頓距離 |
| dot product | 點積 |
| matrix multiplication | 矩陣乘法 |
| linear system | 線性系統 |
| Gaussian elimination | 高斯消去法 |
| partial pivoting | 部分選主元 |
| LU decomposition | LU 分解 |
| Cholesky decomposition | Cholesky 分解 |
| least squares | 最小平方法 |
| normal equations | 正規方程 |
| ridge regression | Ridge 迴歸 |
| conjugate gradient | 共軛梯度法 |
| overdetermined system | 超定系統 |
| back substitution | 回代 |
| forward substitution | 前代 |
| positive definite matrix | 正定矩陣 |
| permutation matrix | 置換矩陣 |
| null space | 零空間 |
| row space | 列空間 |
| linear independence | 線性獨立 |
| rank | 秩 |
| basis | 基底 |
| projection | 投影 |
| orthogonal | 正交 |
| orthonormal basis | 正交單位基底 |
| Gram-Schmidt process | Gram–Schmidt 正交化過程 |
| residual | 殘差 |
| column space | 欄空間 |
| dimensionality reduction | 降維 |
| least-squares | 最小平方法 |
| multicollinearity | 多重共線性 |
| QR decomposition | QR 分解 |
| singular value | 奇異值 |
| condition number | 條件數 |
| cosine similarity | 餘弦相似度 |
| cosine distance | 餘弦距離 |
| Mahalanobis distance | Mahalanobis 距離 |
| Jaccard similarity | Jaccard 相似度 |
| edit distance | 編輯距離 |
| Levenshtein distance | Levenshtein 距離 |
| Wasserstein distance | Wasserstein 距離 |
| approximate nearest neighbor | 近似最近鄰 |
| nearest neighbor search | 最近鄰搜尋 |
| L1 regularization | L1 正則化 |
| L2 regularization | L2 正則化 |
| Elastic Net | Elastic Net（彈性網路） |
| element-wise | 逐元素 |
| broadcasting | 廣播 |
| scalar multiplication | 純量乘法 |
| determinant | 行列式 |
| inverse matrix | 反矩陣 |
| transpose | 轉置 |
| identity matrix | 單位矩陣 |
| dense layer | 全連接層 |
| bias | 偏差項 |
| rotation matrix | 旋轉矩陣 |
| scaling matrix | 縮放矩陣 |
| shearing matrix | 剪切矩陣 |
| reflection | 反射 |
| composition | 組合；依語境也可譯為串接 |
| eigenvalue | 特徵值 |
| eigenvector | 特徵向量 |
| eigendecomposition | 特徵分解 |
| characteristic equation | 特徵方程式 |
| covariance matrix | 共變異數矩陣 |
| principal component | 主成分 |
| spectral clustering | 譜分群 |
| derivative | 導數 |
| partial derivative | 偏導數 |
| gradient | 梯度 |
| gradient descent | 梯度下降 |
| learning rate | 學習率 |
| chain rule | 鏈鎖律 |
| Jacobian | Jacobian 矩陣 |
| Hessian | Hessian 矩陣 |
| Taylor series | 泰勒級數 |
| integral | 積分 |
| numerical derivative | 數值導數 |
| analytical derivative | 解析導數 |
| automatic differentiation | 自動微分 |
| loss function | 損失函式 |
| local minimum | 局部最小值 |
| global minimum | 全域最小值 |
| saddle point | 鞍點 |
| curvature | 曲率 |
| expected value | 期望值 |
| KL divergence | KL 散度 |
| reverse-mode autodiff | 反向模式自動微分 |
| forward-mode autodiff | 前向模式自動微分 |
| computational graph | 計算圖 |
| forward mode | 前向模式 |
| reverse mode | 反向模式 |
| dual numbers | 雙數 |
| topological sort | 拓樸排序 |
| gradient accumulation | 梯度累積 |
| dynamic graph | 動態計算圖 |
| gradient checking | 梯度檢查 |
| multi-layer perceptron | 多層感知器 |
| neuron | 神經元 |
| probability distribution | 機率分布 |
| sample space | 樣本空間 |
| event | 事件 |
| conditional probability | 條件機率 |
| independence | 獨立性 |
| probability mass function | 機率質量函式 |
| probability density function | 機率密度函式 |
| PMF | PMF（機率質量函式） |
| PDF | PDF（機率密度函式） |
| Bernoulli distribution | Bernoulli 分布 |
| categorical distribution | 類別分布 |
| uniform distribution | 均勻分布 |
| normal distribution | 常態分布 |
| Gaussian distribution | 高斯分布 |
| Poisson distribution | Poisson 分布 |
| variance | 變異數 |
| standard deviation | 標準差 |
| joint distribution | 聯合分布 |
| marginal distribution | 邊際分布 |
| Central Limit Theorem | 中央極限定理 |
| log probability | 對數機率 |
| numerical underflow | 數值下溢 |
| numerical overflow | 數值溢位 |
| numerical stability | 數值穩定性 |
| floating-point number | 浮點數 |
| floating-point arithmetic | 浮點運算 |
| exponent | 指數 |
| mantissa | 尾數 |
| significand | 有效數 |
| machine epsilon | 機器 epsilon |
| catastrophic cancellation | 災難性消去 |
| overflow | 溢位 |
| underflow | 下溢 |
| log-sum-exp | log-sum-exp（Log-Sum-Exp） |
| mixed precision | 混合精度 |
| loss scaling | 損失縮放 |
| bfloat16 | bfloat16 |
| numerical gradient | 數值梯度 |
| numerical gradient checking | 數值梯度檢查 |
| logit | logit；複數 logits |
| log-softmax | log-softmax |
| cross-entropy loss | 交叉熵損失 |
| inverse transform sampling | 反函數取樣 |
| rejection sampling | 拒絕取樣 |
| sampling | 取樣 |
| inverse CDF | 反 CDF |
| importance sampling | 重要性取樣 |
| Monte Carlo method | 蒙地卡羅方法 |
| Markov chain | 馬可夫鏈 |
| MCMC | MCMC（馬可夫鏈蒙地卡羅） |
| Metropolis-Hastings | Metropolis-Hastings |
| Gibbs sampling | Gibbs 取樣 |
| temperature sampling | 溫度取樣 |
| top-k sampling | top-k 取樣 |
| top-p sampling | top-p 取樣 |
| nucleus sampling | 核取樣 |
| Gumbel-Softmax | Gumbel-Softmax |
| stratified sampling | 分層取樣 |
| burn-in | 暖身期 |
| detailed balance | 細緻平衡 |
| acceptance rate | 接受率 |
| proposal distribution | 提議分布 |
| target distribution | 目標分布 |
| reparameterization trick | 重參數化技巧 |
| entropy | 熵 |
| Bayes' theorem | 貝氏定理 |
| prior | 先驗機率 |
| likelihood | 概似度 |
| posterior | 後驗機率 |
| evidence | 證據 |
| maximum likelihood estimation | 最大概似估計 |
| maximum a posteriori estimation | 最大後驗估計 |
| Naive Bayes | 樸素貝氏 |
| Laplace smoothing | 拉普拉斯平滑 |
| conjugate prior | 共軛先驗 |
| Beta distribution | Beta 分布 |
| frequentist | 頻率學派 |
| Bayesian | 貝氏學派；貝氏方法，依語境調整 |
| confidence interval | 信賴區間 |
| credible interval | 可信區間 |
| false positive | 偽陽性 |
| false positive rate | 偽陽性率 |
| online learning | 線上學習 |
| A/B testing | A/B 測試 |
| Thompson sampling | Thompson sampling（湯普森取樣） |
| marginal likelihood | 邊際概似 |
| Bayes factor | 貝氏因子 |
| base rate fallacy | 基率謬誤 |
| cold start | 冷啟動 |
| Beta-Binomial | Beta-Binomial |
| optimization | 最佳化 |
| optimizer | 最佳化器 |
| stochastic gradient descent | 隨機梯度下降 |
| SGD | SGD（隨機梯度下降） |
| momentum | 動量 |
| Adam | Adam（自適應矩估計） |
| adaptive learning rate | 自適應學習率 |
| learning rate schedule | 學習率排程 |
| cosine annealing | 餘弦退火 |
| warmup | 預熱 |
| weight decay | 權重衰減 |
| convex function | 凸函式 |
| convex set | 凸集合 |
| convexity | 凸性 |
| convex optimization | 凸最佳化 |
| positive semidefinite | 半正定 |
| positive definite | 正定 |
| Newton's method | Newton 法 |
| Lagrange multiplier | Lagrange 乘數 |
| KKT conditions | KKT 條件 |
| complementary slackness | 互補鬆弛 |
| duality | 對偶性 |
| strong duality | 強對偶性 |
| constrained optimization | 受限最佳化 |
| unconstrained optimization | 無限制最佳化 |
| L-BFGS | L-BFGS |
| natural gradient | 自然梯度 |
| Fisher information matrix | Fisher 資訊矩陣 |
| K-FAC | K-FAC |
| Hessian-free optimization | 免 Hessian 最佳化 |
| overparameterization | 過度參數化 |
| Slater's condition | Slater 條件 |
| non-convex function | 非凸函式 |
| loss landscape | 損失地形 |
| convergence | 收斂 |
| first moment | 一階動量 |
| second moment | 二階動量 |
| bias correction | 偏差修正 |
| information theory | 資訊理論 |
| information content | 資訊量 |
| cross-entropy | 交叉熵 |
| mutual information | 互資訊 |
| conditional entropy | 條件熵 |
| joint entropy | 聯合熵 |
| label smoothing | 標籤平滑 |
| one-hot vector | one-hot 向量 |
| perplexity | 困惑度 |
| bit | bit（資訊單位） |
| nat | nat（資訊單位） |
| negative log-likelihood | 負對數概似 |
| feature selection | 特徵選取 |
| irreducible uncertainty | 不可消除的不確定性 |
| Pearson correlation | Pearson 相關係數 |
| Spearman correlation | Spearman 相關係數 |
| descriptive statistics | 描述統計 |
| mean | 平均數 |
| median | 中位數 |
| mode | 眾數 |
| percentile | 百分位數 |
| IQR | IQR（四分位距） |
| hypothesis testing | 假設檢定 |
| null hypothesis | 虛無假設 |
| p-value | p 值 |
| t-test | t 檢定 |
| chi-squared test | 卡方檢定 |
| effect size | 效果量 |
| multiple comparison | 多重比較 |
| Bonferroni correction | Bonferroni 修正 |
| bootstrap | 自助法 |
| Type I error | 第一類錯誤 |
| Type II error | 第二類錯誤 |
| statistical power | 統計檢定力 |
| parametric test | 參數檢定 |
| non-parametric test | 無母數檢定 |
| curse of dimensionality | 維度災難 |
| principal component analysis | 主成分分析 |
| explained variance ratio | 解釋變異比例 |
| elbow method | 肘部法 |
| t-SNE | t-SNE |
| UMAP | UMAP |
| manifold | 流形 |
| kernel PCA | 核 PCA |
| RBF kernel | RBF 核函式 |
| reconstruction error | 重建誤差 |
| compression ratio | 壓縮率 |
| singular value decomposition | 奇異值分解 |
| SVD | SVD（奇異值分解） |
| singular vector | 奇異向量 |
| left singular vector | 左奇異向量 |
| right singular vector | 右奇異向量 |
| truncated SVD | 截斷 SVD |
| Moore-Penrose pseudoinverse | Moore-Penrose 偽逆矩陣 |
| pseudoinverse | 偽逆矩陣 |
| low-rank approximation | 低秩近似 |
| outer product | 外積 |
| spectral norm | 譜範數 |
| Frobenius norm | Frobenius 範數 |
| matrix factorization | 矩陣分解 |
| latent factor | 潛在因子 |
| recommendation system | 推薦系統 |
| latent semantic analysis | 潛在語意分析 |
| latent semantic indexing | 潛在語意索引 |
| power iteration | 冪次迭代 |
| term-document matrix | 詞項－文件矩陣 |
| positive semi-definite | 半正定 |
| nearest-neighbor search | 最近鄰搜尋 |
| cluster | 群集 |
| image compression | 影像壓縮 |
| noise reduction | 降噪 |
| denoising | 去除雜訊 |
| signal | 訊號 |
| noise floor | 雜訊底限 |
| tensor rank | 張量階數 |
| axis | 軸 |
| shape | 形狀 |
| stride | 步幅 |
| contiguous | 連續 |
| non-contiguous | 非連續 |
| reshape | 重塑 |
| squeeze | squeeze（移除大小為 1 的軸） |
| unsqueeze | unsqueeze（插入軸） |
| permute | 重新排列軸 |
| reduction | 歸約 |
| einsum | einsum（愛因斯坦求和） |
| tensor contraction | 張量收縮 |
| trace | 跡 |
| channel-first | 通道在前 |
| channel-last | 通道在後 |
| NCHW | NCHW |
| NHWC | NHWC |
| multi-head attention | 多頭注意力 |
| shape error | 形狀錯誤 |
| shape semantics | 形狀語意 |
| tensor view | Tensor view；依語境保留 API 名稱 |

| imaginary unit | 虛數單位 |
| real part | 實部 |
| imaginary part | 虛部 |
| complex plane | 複數平面 |
| rectangular form | 直角式 |
| polar form | 極式 |
| magnitude | 模長 |
| modulus | 模長 |
| phase | 相位 |
| argument | 幅角 |
| complex conjugate | 複數共軛 |
| Euler's formula | Euler 公式 |
| phasor | 相量 |
| roots of unity | 單位根 |
| Discrete Fourier Transform | 離散傅立葉轉換 |
| DFT | DFT（離散傅立葉轉換） |
| RoPE | RoPE（旋轉位置嵌入） |

| time domain | 時域 |
| frequency domain | 頻域 |
| frequency coefficient | 頻率係數 |
| frequency bin | 頻率格點 |
| DC component | DC 分量 |
| Nyquist frequency | 奈奎斯特頻率 |
| power spectrum | 功率頻譜 |
| phase spectrum | 相位頻譜 |
| spectral leakage | 頻譜洩漏 |
| window function | 窗函數 |
| Hann window | Hann 窗 |
| Hamming window | Hamming 窗 |
| Blackman window | Blackman 窗 |
| twiddle factor | 旋轉因子 |
| convolution theorem | 卷積定理 |
| circular convolution | 循環卷積 |
| linear convolution | 線性卷積 |
| Parseval's theorem | Parseval 定理 |
| aliasing | 混疊 |
| zero-padding | 補零 |
| sampling rate | 取樣率 |
| frequency resolution | 頻率解析度 |
| short-time Fourier transform | 短時傅立葉轉換 |
| STFT | STFT（短時傅立葉轉換） |
| spectrogram | 頻譜圖 |
| windowing | 加窗 |

| graph | 圖 |
| node | 節點 |
| edge | 邊 |
| directed graph | 有向圖 |
| undirected graph | 無向圖 |
| weighted graph | 加權圖 |
| unweighted graph | 無權重圖 |
| adjacency matrix | 鄰接矩陣 |
| adjacency list | 鄰接串列 |
| degree | 度數 |
| degree matrix | 度數矩陣 |
| graph Laplacian | 圖拉普拉斯矩陣 |
| connected component | 連通分量 |
| graph traversal | 圖遍歷 |
| BFS | BFS（廣度優先搜尋） |
| DFS | DFS（深度優先搜尋） |
| breadth-first search | 廣度優先搜尋 |
| depth-first search | 深度優先搜尋 |
| Fiedler value | Fiedler 值 |
| Fiedler vector | Fiedler 向量 |
| message passing | 訊息傳遞 |
| spectral gap | 譜間隙 |
| mixing time | 混合時間 |
| self-loop | 自連結 |
| graph neural network | 圖神經網路 |
| GNN | GNN（圖神經網路） |

| stochastic process | 隨機過程 |
| random walk | 隨機漫步 |
| Markov property | 馬可夫性質 |
| transition matrix | 轉移矩陣 |
| stationary distribution | 穩態分布 |
| Brownian motion | 布朗運動 |
| Langevin dynamics | Langevin 動力學 |
| absorbing state | 吸收狀態 |
| irreducible | 不可約 |
| aperiodic | 非週期 |
| temperature | 溫度 |
| diffusion process | 擴散過程 |
| thinning | 稀疏取樣 |
| forward process | 正向過程 |
| reverse process | 反向過程 |

| supervised learning | 監督式學習 |
| unsupervised learning | 非監督式學習 |
| reinforcement learning | 強化學習 |
| semi-supervised learning | 半監督式學習 |
| self-supervised learning | 自監督式學習 |
| classification | 分類 |
| regression | 迴歸 |
| nearest centroid classifier | 最近質心分類器 |
| training set | 訓練集 |
| underfitting | 欠擬合 |
| bias-variance tradeoff | 偏差－變異取捨 |
| feature engineering | 特徵工程 |
| feature scaling | 特徵縮放 |
| data drift | 資料漂移 |
| cross-validation | 交叉驗證 |
| generalization | 泛化 |
| label propagation | 標籤傳播 |
| pseudo-labeling | 偽標籤 |
| consistency regularization | 一致性正則化 |
| no free lunch theorem | 沒有免費午餐定理 |
| baseline | 基準 |
| hyperparameter | 超參數 |

| linear regression | 線性迴歸 |
| mean squared error | 均方誤差 |
| cost function | 成本函式 |
| normal equation | 正規方程式 |
| R-squared | R 平方 |
| lasso regression | Lasso 迴歸 |
| polynomial regression | 多項式迴歸 |
| standardization | 標準化 |
| mean squared error (MSE) | 均方誤差（MSE） |
| ordinary least squares | 普通最小平方法 |

| logistic regression | 邏輯迴歸 |
| sigmoid function | Sigmoid 函式 |
| binary cross-entropy | 二元交叉熵 |
| softmax | Softmax |
| confusion matrix | 混淆矩陣 |
| precision | Precision（精確率） |
| recall | Recall（召回率） |
| F1 score | F1 分數 |
| decision boundary | 決策邊界 |
| threshold | 閾值 |
| one-hot encoding | 獨熱編碼 |
| categorical cross-entropy | 類別交叉熵 |
| ROC curve | ROC 曲線 |
| AUC | AUC（曲線下面積） |
| true positive | 真陽性 |
| true negative | 真陰性 |
| false negative | 假陰性 |
| sensitivity | 敏感度 |

| decision tree | 決策樹 |
| gini impurity | Gini 不純度 |
| information gain | 資訊增益 |
| split criterion | 分裂準則 |
| pre-pruning | 預剪枝 |
| post-pruning | 後剪枝 |
| bagging | Bagging（自助聚合） |
| random forest | 隨機森林 |
| bootstrap sample | 自助樣本 |
| bootstrap sampling | 自助抽樣 |
| feature importance | 特徵重要性 |
| permutation importance | 置換重要性 |
| mean decrease in impurity | 平均不純度下降 |
| MDI | MDI（平均不純度下降） |
| high-cardinality feature | 高基數特徵 |
| gradient boosted tree | 梯度提升樹 |
| variance reduction | 變異數降低 |
| out-of-bag sample | 袋外樣本 |
| cost-complexity pruning | 成本複雜度剪枝 |

| support vector machine | 支援向量機 |
| SVM | SVM（支援向量機） |
| support vector | 支援向量 |
| maximum margin | 最大間隔 |
| margin | 間隔 |
| hinge loss | Hinge loss |
| soft margin | 軟間隔 |
| slack variable | 鬆弛變數 |
| kernel trick | 核技巧 |
| kernel function | 核函式 |
| linear kernel | 線性核 |
| polynomial kernel | 多項式核 |
| primal formulation | 原始形式 |
| dual formulation | 對偶形式 |
| support vector regression | 支援向量迴歸 |
| epsilon-insensitive loss | epsilon 不敏感損失 |
| one-class SVM | 單類別 SVM |
| SVR | SVR（支援向量迴歸） |

| K-nearest neighbors | K 最近鄰 |
| KNN | KNN（K 最近鄰） |
| Minkowski distance | Minkowski 距離 |
| lazy learning | 惰性學習 |
| eager learning | 積極學習 |
| KD-tree | KD 樹 |
| ball tree | 球樹 |
| distance-weighted KNN | 距離加權 KNN |
| brute-force search | 暴力搜尋 |
| Voronoi diagram | Voronoi 圖 |
| product quantization | 乘積量化 |
| feature magnitude | 特徵數值大小 |

| clustering | 分群 |
| K-Means | K-Means |
| DBSCAN | DBSCAN |
| Gaussian mixture model | 高斯混合模型 |
| GMM | GMM（高斯混合模型） |
| inertia | Inertia |
| silhouette score | Silhouette 分數 |
| hierarchical clustering | 階層式分群 |
| agglomerative clustering | 凝聚式分群 |
| single linkage | 單一連結 |
| complete linkage | 完全連結 |
| average linkage | 平均連結 |
| Ward's method | Ward 方法 |
| core point | 核心點 |
| border point | 邊界點 |
| noise point | 雜訊點 |
| EM algorithm | EM 演算法 |
| expectation-maximization | 期望最大化 |
| anomaly detection | 異常偵測 |
| dendrogram | 樹狀圖 |
| soft assignment | 軟式分配 |
| hard assignment | 硬式分配 |

| min-max scaling | 最小－最大縮放 |
| log transform | 對數轉換 |
| binning | 分箱 |
| label encoding | 標籤編碼 |
| target encoding | 目標編碼 |
| count vectorizer | 詞頻向量化器 |
| TF-IDF | TF-IDF |
| imputation | 插補 |
| indicator column | 指示欄 |
| feature interaction | 特徵交互作用 |
| filter method | 篩選法 |
| wrapper method | 包裹法 |
| variance threshold | 變異數門檻 |
| leave-one-out encoding | 留一法編碼 |
| robust scaling | 穩健縮放 |
| feature pipeline | 特徵處理流程 |
| categorical feature | 類別特徵 |
| numerical feature | 數值特徵 |
| missing value | 缺失值 |

| model evaluation | 模型評估 |
| K-fold cross-validation | K 折交叉驗證 |
| stratified K-fold | 分層 K 折 |
| test set contamination | 測試集污染 |
| hold-out set | 保留資料集 |
| PR curve | PR 曲線 |
| learning curve | 學習曲線 |
| validation curve | 驗證曲線 |
| average precision | 平均 Precision |
| nested cross-validation | 巢狀交叉驗證 |
| permutation test | 置換檢定 |
| stratified split | 分層切分 |
| class imbalance | 類別不平衡 |
| accuracy | 準確率 |
| RMSE | RMSE（均方根誤差） |
| MAE | MAE（平均絕對誤差） |
| MSE | MSE（均方誤差） |
| AUC-ROC | AUC-ROC |

| bias-variance decomposition | 偏差－變異分解 |
| irreducible error | 不可約誤差 |
| double descent | 雙重下降 |
| interpolation threshold | 插值閾值 |
| implicit regularization | 隱式正則化 |
| boosting | Boosting |
| stacking | Stacking |
| dropout | Dropout |
| early stopping | 提前停止 |
| bootstrap aggregating | 自助聚合 |
| high bias | 高偏差 |
| high variance | 高變異 |
| model capacity | 模型容量 |
| regularization strength | 正則化強度 |
| training error | 訓練誤差 |
| test error | 測試誤差 |

| ensemble method | 集成方法 |
| ensemble diversity | 集成多樣性 |
| weak learner | 弱學習器 |
| base learner | 基礎學習器 |
| meta-learner | 元學習器 |
| AdaBoost | AdaBoost |
| gradient boosting | 梯度提升 |
| XGBoost | XGBoost |
| LightGBM | LightGBM |
| hard voting | 硬投票 |
| soft voting | 軟投票 |
| majority voting | 多數決 |
| out-of-bag error | 袋外錯誤 |
| shrinkage | 收縮率 |
| decision stump | 決策樹樁 |
| weak learner ensemble | 弱學習器集成 |

| hyperparameter tuning | 超參數調校 |
| grid search | 網格搜尋 |
| random search | 隨機搜尋 |
| Bayesian optimization | 貝葉斯最佳化 |
| surrogate model | 代理模型 |
| acquisition function | 取得函式 |
| expected improvement | 預期改善 |
| upper confidence bound | 上置信界 |
| probability of improvement | 改善機率 |
| Hyperband | Hyperband |
| learning rate scheduler | 學習率排程器 |
| log-uniform distribution | 對數均勻分布 |
| pruning | 剪枝 |
| Optuna | Optuna |
| sample efficiency | 樣本效率 |
| search space | 搜尋空間 |
| patience-based stopping | 耐心值提前停止 |
| median pruning | 中位數剪枝 |
| one-cycle policy | 單週期策略 |

| ML pipeline | 機器學習處理流程 |
| Pipeline | Pipeline |
| ColumnTransformer | ColumnTransformer |
| experiment tracking | 實驗追蹤 |
| model registry | 模型註冊表 |
| data versioning | 資料版本管理 |
| DVC | DVC |
| training/serving skew | 訓練／服務偏差 |
| serialization | 序列化 |
| reproducibility | 可重現性 |
| deployment pipeline | 部署流程 |

| Multinomial Naive Bayes | 多項式樸素貝氏 |
| MultinomialNB | MultinomialNB |
| Gaussian Naive Bayes | 高斯樸素貝氏 |
| GaussianNB | GaussianNB |
| Bernoulli Naive Bayes | 伯努利樸素貝氏 |
| BernoulliNB | BernoulliNB |
| conditional independence | 條件獨立 |
| generative model | 生成式模型 |
| discriminative model | 判別式模型 |
| bag-of-words | 詞袋 |
| probability calibration | 機率校準 |
| Dirichlet prior | Dirichlet 先驗 |

| time series | 時間序列 |
| stationarity | 定態性 |
| differencing | 差分 |
| autocorrelation | 自相關 |
| autocorrelation function | 自相關函數 |
| partial autocorrelation function | 偏自相關函數 |
| lag feature | 落後特徵 |
| walk-forward validation | 逐步向前驗證 |
| expanding window | 擴展視窗 |
| sliding window | 滑動視窗 |
| seasonality | 季節性 |
| trend | 趨勢 |
| ARIMA | ARIMA |
| ADF test | ADF 檢定 |
| forecast horizon | 預測範圍 |
| recursive forecasting | 遞迴式預測 |
| direct forecasting | 直接式預測 |
| multi-output forecasting | 多輸出預測 |
| seasonal naive | 季節性樸素基準 |
| regime change | 體制變化 |
| white noise | 白雜訊 |

| point anomaly | 點異常 |
| contextual anomaly | 情境異常 |
| collective anomaly | 群體異常 |
| Z-score | Z-score |
| Isolation Forest | Isolation Forest（隔離森林） |
| Local Outlier Factor | 局部離群因子（LOF） |
| LOF | LOF |
| contamination | 預期異常比例 |
| Precision@k | Precision@k |
| AUPRC | AUPRC（Precision-Recall 曲線下面積） |
| AUROC | AUROC |
| masking effect | 遮蔽效應 |
| local reachability density | 局部可及密度 |
| autoencoder | 自編碼器 |

| imbalanced data | 不平衡資料 |
| SMOTE | SMOTE |
| synthetic oversampling | 合成過度取樣 |
| random oversampling | 隨機過度取樣 |
| random undersampling | 隨機欠取樣 |
| class weights | 類別權重 |
| threshold tuning | 門檻調校 |
| precision-recall tradeoff | Precision-Recall 取捨 |
| Matthews Correlation Coefficient | Matthews 相關係數 |
| MCC | MCC（Matthews 相關係數） |
| cost-sensitive learning | 成本敏感式學習 |
| F-beta score | F-beta 分數 |
| Platt scaling | Platt scaling |
| Borderline-SMOTE | Borderline-SMOTE |
| balanced bagging | 平衡 Bagging |

| embedded method | 嵌入法 |
| recursive feature elimination | 遞迴特徵消除 |
| RFE | RFE（遞迴特徵消除） |
| forward selection | 向前選擇 |
| backward elimination | 向後消除 |
| stability selection | 穩定性選擇 |
| cardinality bias | 基數偏差 |
| contingency table | 列聯表 |
| soft thresholding | 軟閾值處理 |
