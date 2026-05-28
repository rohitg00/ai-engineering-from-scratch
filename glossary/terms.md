# AIエンジニアリング用語集

## A

### Agent
- **よく言われること:** 「自律的に考えて行動するAI」
- **実際の意味:** LLMが次にどのツールを呼ぶかを決め、実行し、結果を見て、また繰り返す while ループ
- **そう呼ばれる理由:** 哲学の用語から借りた言葉です。"agent" は世界に働きかけられるものを指します。AIでは単に「LLM + ツール + ループ」という意味です。

### Attention
- **よく言われること:** 「AIが重要な部分に注目する仕組み」
- **実際の意味:** 各トークンが、他のすべてのトークンの value の重み付き和を計算する仕組みです。重みは query ベクトルと key ベクトルのドット積で測った関連度によって決まります。
- **そう呼ばれる理由:** 2017年の論文 "Attention Is All You Need" が、人間の選択的注意との類推でこの名前を付けました。

### Alignment
- **よく言われること:** 「AIを安全にすること」
- **実際の意味:** AIシステムの振る舞いを、人間の意図、価値観、好みに合わせるための技術的課題です。設計者が想定していなかったエッジケースも含みます。

### Autoregressive
- **よく言われること:** 「AIが単語を1つずつ生成すること」
- **実際の意味:** それまでの全トークンを条件に次のトークンを予測し、その予測を次のステップの入力として戻すモデルです。GPT、LLaMA、Claudeはいずれも autoregressive です。

### Activation Function
- **よく言われること:** 「層の間にある非線形なもの」
- **実際の意味:** 各線形層の後に適用して非線形性を入れる関数です。これがないと、線形層を何層重ねても1つの線形変換に畳み込めてしまいます。よく使われるのは ReLU、GELU、SiLU です。どれを選ぶかは、学習中に勾配が流れるかどうかに直接影響します。

### Adam (Optimizer)
- **よく言われること:** 「デフォルトの optimizer」
- **実際の意味:** Adaptive Moment Estimation の略です。momentum（一次モーメント）と、パラメータごとの適応的な learning rate（二次モーメント）を組み合わせます。初期ステップ向けのバイアス補正もあります。多くのタスクで、細かい調整なしにうまく機能します。

### AdamW
- **よく言われること:** 「Adamの改良版」
- **実際の意味:** weight decay を Adam から分離したものです。標準の Adam では、L2正則化がパラメータごとの適応的 learning rate でスケーリングされますが、これは望ましい挙動ではありません。AdamW は勾配統計とは独立に、重みに直接 weight decay を適用します。Transformer の学習でよく使われるデフォルトの optimizer です。

### Autograd
- **よく言われること:** 「自動で勾配を計算する仕組み」
- **実際の意味:** テンソルに対する演算を記録し、reverse-mode differentiation によって勾配を自動計算するシステムです。PyTorch の autograd はその場で計算グラフを構築する dynamic graph 方式で、JAX は関数変換（grad）を使います。これにより backpropagation が実用的になります。開発者は forward pass を書けば、フレームワークがすべての微分を計算します。

## B

### Batch Size
- **よく言われること:** 「一度に処理するサンプル数」
- **実際の意味:** 重みを更新する前に、1回の forward/backward pass で処理する学習サンプルの数です。大きな batch は勾配推定を安定させますが、メモリを多く使います。典型値は学習で32〜512、推論ではさらに大きめです。batch size は learning rate と相互作用します。batch を2倍にしたら LR も2倍にする、という linear scaling rule があります。

### Backpropagation
- **よく言われること:** 「ニューラルネットワークが学習する方法」
- **実際の意味:** chain rule をネットワークの後ろ向きに適用し、各重みが誤差にどれだけ寄与したかを計算して、その大きさに応じて重みを調整するアルゴリズムです。
- **そう呼ばれる理由:** 誤差が出力から入力へ、層ごとに逆向きに伝播するためです。

## C

### Context Window
- **よく言われること:** 「AIが覚えていられる量」
- **実際の意味:** 1回のAPI呼び出しに入るトークン数（入力 + 出力）の上限です。記憶ではありません。呼び出しごとにリセットされる固定サイズのバッファです。

### Chain of Thought (CoT)
- **よく言われること:** 「AIにステップごとに考えさせること」
- **実際の意味:** モデルに推論手順を示すよう促す prompting technique です。各ステップが次のトークン生成の条件になるため、多段階の問題で精度が上がることがあります。

### CNN (Convolutional Neural Network)
- **よく言われること:** 「画像AI」
- **実際の意味:** 畳み込み演算（入力上をスライドするフィルタ）を使って局所的なパターンを検出するニューラルネットワークです。畳み込みを重ねると、エッジ、テクスチャ、物体のように、より複雑な特徴を検出できます。

### CUDA
- **よく言われること:** 「GPUプログラミング」
- **実際の意味:** NVIDIAの並列計算プラットフォームです。数千のGPUコアで行列演算を同時に実行できます。PyTorch や TensorFlow は内部で CUDA を使っています。

### Chunking
- **よく言われること:** 「文書を細かく分割すること」
- **実際の意味:** 検索用に embedding する前に、テキストを複数のセグメントへ分けることです。chunk size は検索結果の粒度を決めます。小さすぎると文脈が失われ、大きすぎると関連性が薄まります。よくある方法は、overlap 付きの固定長分割、文単位の分割、意味単位の分割です。典型的な chunk size は256〜512トークンで、10〜20%の overlap を持たせます。

### Contrastive Learning
- **よく言われること:** 「比較によって学習すること」
- **実際の意味:** embedding 空間で、似ているペアを近づけ、似ていないペアを遠ざけるように学習します。CLIP はこの方法を使い、対応する画像・テキストのペアと、対応しないペアを対比します。

### Cosine Similarity
- **よく言われること:** 「2つのベクトルがどれだけ似ているか」
- **実際の意味:** 2つのベクトルのなす角の cosine です: dot(a, b) / (||a|| * ||b||)。範囲は -1（反対方向）から 1（同じ方向）です。大きさは無視し、方向だけを見ます。embedding や semantic search で標準的に使われる類似度指標です。

### Cross-Entropy
- **よく言われること:** 「分類で使う loss」
- **実際の意味:** 2つの確率分布の差を測ります。分類では -sum(y_true * log(y_pred)) です。言語モデルでは、正しい次トークンの負の対数確率を意味します。低いほど良く、perplexity は exp(cross-entropy) にすぎません。

## D

### Data Augmentation
- **よく言われること:** 「学習データを増やすこと」
- **実際の意味:** 既存データの変更版（画像の回転、ノイズ追加、文章の言い換えなど）を作り、新しいデータを収集せずに training set の多様性を増やすことです。overfitting を減らします。

### Decoder
- **よく言われること:** 「出力側の部分」
- **実際の意味:** Transformer では、decoder は causal（masked）self-attention を使うため、各位置はそれ以前の位置にしか attention できません。GPT は decoder-only、BERT は encoder-only、T5 は encoder-decoder です。

### Diffusion Model
- **よく言われること:** 「ノイズから画像を生成するAI」
- **実際の意味:** 徐々にノイズを加える過程を逆向きにたどるよう学習したモデルです。ノイズを予測して取り除くことを学び、生成時には純粋なノイズから始めて反復的に denoise します。

### DPO (Direct Preference Optimization)
- **よく言われること:** 「よりシンプルな RLHF」
- **実際の意味:** reward model を完全に省略する学習方法です。人間の選好ペアのうち、より良い応答を選ぶように language model を直接最適化します。

### Dropout
- **よく言われること:** 「ニューロンをランダムにオフにすること」
- **実際の意味:** 学習中に activation の一部をランダムにゼロにします。ネットワークが特定のニューロンだけに依存しないようにします。推論時には無効化されます。単純ですが効果的な regularization です。

## E

### Eigenvalue
- **よく言われること:** 「PCAで出てくる数学の何か」
- **実際の意味:** 行列 A について、あるベクトル v に対して Av = lambda*v を満たす lambda が固有値です。その方向のベクトルを行列がどれだけスケールするかを表します。大きな固有値は、データの分散が大きい方向を意味します。

### Embedding
- **よく言われること:** 「単語を数値に変えるAIの魔法」
- **実際の意味:** 離散的な項目（単語、画像、ユーザーなど）を連続空間上の dense vector に写す、学習済みの写像です。似ている項目は近くに配置されます。
- **そう呼ばれる理由:** 項目が、距離に意味のある幾何空間に "embedded" されるためです。

### Encoder
- **よく言われること:** 「入力側の部分」
- **実際の意味:** Transformer では、encoder は bidirectional self-attention を使うため、各位置がすべての位置に attention できます。BERT は encoder-only です。分類や NER のような理解タスクには向いていますが、生成には向きません。

### Epoch
- **よく言われること:** 「データを一周すること」
- **実際の意味:** その通りです。training set の全サンプルを1回すべて見ることです。複数 epochs とは、同じデータを複数回見ることを意味します。epoch を増やすと学習が進むことがありますが、overfitting のリスクもあります。

## F

### Feature
- **よく言われること:** 「データの列」
- **実際の意味:** データが持つ、個別に測定できる性質です。古典的なMLでは feature を手作業で設計します。deep learning では、ネットワークが raw data から feature を自動的に学習します。

### Few-Shot
- **よく言われること:** 「先にAIへいくつか例を渡すこと」
- **実際の意味:** モデルにタスクを実行させる前に、少数の入力・出力例を prompt に含めることです。典型的には3〜5例です。モデルはそれらの例からパターンを照合し、望ましい形式や振る舞いを理解します。zero-shot（例なし）や fine-tuning（何千もの例を重みに焼き込む）と対比されます。

### Fine-tuning
- **よく言われること:** 「自分のデータでAIを学習させること」
- **実際の意味:** 事前学習済みモデルの重みから始め、より小さなタスク固有の dataset で学習を続けることです。既存の重みを更新するだけで、新しい知識をゼロから追加するわけではありません。

### Function Calling
- **よく言われること:** 「ツールを使えるAI」
- **実際の意味:** LLMが外部関数の実行を要求するための構造化された方法です。JSON Schema の説明付きでツールを定義すると、モデルはどの関数をどの引数で呼ぶかを示す構造化 JSON object を出力します。コードがそれを実行し、結果をモデルに返します。agents とは同じではありません。function calling は仕組みで、agents はループです。

## G

### Guardrails
- **よく言われること:** 「AIの安全フィルタ」
- **実際の意味:** LLMの周囲に置く入力・出力の検証レイヤーです。有害コンテンツ、prompt injection の試み、PII漏えい、トピック外の応答を検出してブロックします。典型的には input filter -> LLM -> output filter という pipeline です。ルールベース（regex、キーワードリスト）でも、モデルベース（安全性をスコアリングする classifier）でも実装できます。

### GPT
- **よく言われること:** 「ChatGPT」または「AIそのもの」
- **実際の意味:** Generative Pre-trained Transformer の略です。大規模テキストコーパスで学習した decoder-only transformer を使い、次のトークンを予測する特定のアーキテクチャです。
- **そう呼ばれる理由:** Generative（テキストを生成する）、Pre-trained（大規模データで一度学習してから適応する）、Transformer（アーキテクチャ）を表しています。

### GAN (Generative Adversarial Network)
- **よく言われること:** 「2つのAIが戦っている」
- **実際の意味:** generator network は本物らしいデータを作ろうとし、discriminator network は本物と偽物を見分けようとします。両者は一緒に学習します。generator は discriminator をだますのが上手くなり、discriminator は偽物を見抜くのが上手くなります。

### Gradient
- **よく言われること:** 「傾き」
- **実際の意味:** 最も急に増加する方向を指す偏微分のベクトルです。MLでは loss を最小化するため、gradient とは反対方向へ進みます（gradient descent）。

### Gradient Descent
- **よく言われること:** 「AIが改善していく方法」
- **実際の意味:** 高次元の地形を坂道に沿って下るように、loss function を最も急に小さくする方向へパラメータを調整する最適化アルゴリズムです。

## H

### Hyperparameter
- **よく言われること:** 「調整する設定値」
- **実際の意味:** 学習前に設定し、学習プロセスそのものを制御する値です。learning rate、batch size、層数、dropout rate などがあります。model parameters（重み）とは違い、データから学習されるものではありません。

### Hallucination
- **よく言われること:** 「AIが嘘をついている」または「作り話をしている」
- **実際の意味:** モデルが、学習データや与えられた context に根拠のない、もっともらしい文章を生成することです。事実を取り出しているのではなく、パターンを補完しています。

## I

### Inference
- **よく言われること:** 「AIを実行すること」
- **実際の意味:** 学習済みモデルを使って新しいデータに対する予測を行うことです。重みの更新は起きません。本番環境で行うのはこれです。入力を送り、出力を受け取ります。

### Inductive Bias
- **よく言われること:** 聞いたことがない
- **実際の意味:** モデルのアーキテクチャに組み込まれた仮定です。CNN は局所パターンが重要だと仮定します（convolution）。RNN は順序が重要だと仮定します（sequential processing）。Transformers は、あらゆるものがあらゆるものと関係しうると仮定します（attention）。適切な bias は、少ないデータからより速く学習する助けになります。

### JAX
- **よく言われること:** 「GoogleのML framework」
- **実際の意味:** NumPy互換のライブラリに、automatic differentiation（grad）、JIT compilation（jit）、automatic vectorization（vmap）、multi-device parallelism（pmap）を加えたものです。PyTorch のオブジェクト指向スタイルとは異なり、JAX は純粋関数型です。隠れた状態や in-place mutation がありません。Google DeepMind で AlphaFold、Gemini、大規模研究に使われています。

## K

### KV Cache
- **よく言われること:** 「推論を速くするもの」
- **実際の意味:** autoregressive 生成中に、過去トークンの key 行列と value 行列をキャッシュし、各ステップで再計算しないようにする仕組みです。メモリと引き換えに速度を得ます。高速な LLM inference には不可欠です。

## L

### Latent Space
- **よく言われること:** 「隠れた表現」
- **実際の意味:** 似た入力が近い点に写される、圧縮された学習済み表現空間です。Autoencoders、VAEs、diffusion models はいずれも latent space で動作します。入力より低次元ですが、重要な構造を捉えます。

### Learning Rate
- **よく言われること:** 「AIが学習する速さ」
- **実際の意味:** gradient descent におけるステップ幅を制御するスカラーです。高すぎると最小値を飛び越えて発散します。低すぎると収束が遅すぎたり、途中で止まったりします。最も重要な hyperparameter です。

### LLM (Large Language Model)
- **よく言われること:** 「AI」または「頭脳」
- **実際の意味:** 数十億規模の parameters を持ち、インターネット規模のテキストデータで、系列内の次トークンを予測するよう学習された transformer-based neural network です。

### LoRA (Low-Rank Adaptation)
- **よく言われること:** 「効率的な fine-tuning」
- **実際の意味:** すべての重みを更新する代わりに、元の重みの横に小さな low-rank matrices を挿入します。学習するのはこの小さな行列だけなので、メモリ使用量を10〜100倍削減できます。

### Loss Function
- **よく言われること:** 「AIがどれだけ間違っているか」
- **実際の意味:** 予測出力と実際の出力の差を測る関数です。学習ではこの関数を最小化します。回帰には MSE、分類には cross-entropy、embeddings には contrastive loss を使います。どの loss function を選ぶかが、モデルにとっての「良さ」を定義します。

## M

### Mixed Precision
- **よく言われること:** 「高速化のための学習テクニック」
- **実際の意味:** forward pass と多くの演算では float16 を使い（高速で省メモリ）、gradient accumulation と weight update では float32 を維持します（より高精度）。精度低下をほとんど起こさずに約2倍高速化できます。

### MoE (Mixture of Experts)
- **よく言われること:** 「モデルの一部だけが動く仕組み」
- **実際の意味:** 多数の "expert" subnetwork を持ち、routing mechanism が各入力を少数の experts にだけ送るモデルです。モデル全体は巨大ですが、多くの experts をスキップするため、各 forward pass は軽くなります。Mixtral と GPT-4 はこれを使っています。

### MCP (Model Context Protocol)
- **よく言われること:** 「AIがツールを使うための方法」
- **実際の意味:** AIアプリケーションが外部データソースやツールへ接続する方法を標準化する open protocol（JSON-RPC over stdio/HTTP）です。tools、resources、prompts に typed schema を提供します。

## N

### NaN (Not a Number)
- **よく言われること:** 「学習が壊れた」
- **実際の意味:** 未定義の結果（0/0、inf-inf）を示す浮動小数点値です。学習中の NaN loss はたいてい、learning rate が高すぎる、exploding gradients、ゼロの log、ゼロ除算のいずれかを意味します。学習が失敗したときに最初に確認すべきものです。

### Normalization
- **よく言われること:** 「データをスケーリングすること」
- **実際の意味:** 値を標準的な範囲へ調整することです。Batch normalization は batch 全体で正規化します。Layer normalization は features 全体で正規化します。どちらも学習を安定させ、より高い learning rate を使えるようにします。

## O

### Overfitting
- **よく言われること:** 「モデルがデータを丸暗記した」
- **実際の意味:** モデルが training data では良い性能を出す一方、見たことのないデータでは悪い性能になることです。signal ではなく noise を学習しています。対策は、データを増やす、regularization（dropout、weight decay）、early stopping、data augmentation、より単純なモデルです。

### Optimizer
- **よく言われること:** 「重みを更新するもの」
- **実際の意味:** gradients を使って model parameters を更新するアルゴリズムです。SGD が最も単純で、Adam が最も一般的です。optimizer ごとに、収束速度、メモリ使用量、hyperparameters への敏感さが異なります。

## P

### Parameter
- **よく言われること:** 「モデルサイズ」
- **実際の意味:** モデル内の学習可能な値で、典型的には weight または bias です。"7B parameters" は70億個の学習可能な数値を意味します。float32 の parameter は1つ4 bytes なので、7B parameters では重みだけで28GBのメモリが必要です。

### Perplexity
- **よく言われること:** 「モデルがどれだけ混乱しているか」
- **実際の意味:** 平均 cross-entropy loss の指数です。低いほど良い値です。perplexity が10なら、各ステップで10個のトークンから一様に選ぶのと同じくらいモデルが不確実である、という意味です。

### Precision & Recall
- **よく言われること:** 「精度指標」
- **実際の意味:** Precision は、検出したもののうち正しかった割合です。Recall は、正解全体のうち見つけられた割合です。両者には trade-off があります。すべてのスパムメールを拾おうとする（高 recall）と、誤検知が増えます（低 precision）。F1 score は両者の調和平均です。false positives のコストが高いときは precision、false negatives のコストが高いときは recall を重視します。

### Prompt Engineering
- **よく言われること:** 「AIへの正しい話しかけ方」
- **実際の意味:** 望む出力を安定して得るために入力テキストを設計することです。system prompts、few-shot examples、format instructions、chain-of-thought triggers などを含みます。

### Prompt Injection
- **よく言われること:** 「言葉でAIをハックすること」
- **実際の意味:** 入力内の悪意あるテキストが system prompt や instructions を上書きする攻撃です。Direct injection では、ユーザーが "Ignore previous instructions." と入力します。Indirect injection では、取得した文書に隠れた指示が含まれます。LLMにおける SQL injection に相当します。完全な解決策はまだなく、防御は input validation、output filtering、privilege separation の層を重ねることです。

## Q

### QLoRA
- **よく言われること:** 「より安く使える LoRA」
- **実際の意味:** Quantized LoRA です。凍結した base model weights を4-bit precision（NF4 format）で保持しつつ、LoRA adapters は16-bitで学習します。標準の LoRA と比べてメモリをさらに3〜4倍削減します。LoRA で14GB必要な 7B model が、QLoRA では4〜6GBに収まります。多くの benchmark で、品質は full fine-tuning との差が1%以内です。

## R

### RAG (Retrieval-Augmented Generation)
- **よく言われること:** 「検索できるAI」
- **実際の意味:** knowledge base から関連文書を（embedding similarity を使って）取得し、それを prompt に詰め込み、その context に基づいて LLM に回答させるパターンです。
- **そう呼ばれる理由:** Retrieval（文書を見つける）+ Augmented（prompt に追加する）+ Generation（LLMが回答を書く）を表しています。

### RLHF (Reinforcement Learning from Human Feedback)
- **よく言われること:** 「AIを役に立つようにする方法」
- **実際の意味:** 学習 pipeline です: (1) model outputs に対する人間の選好を集める、(2) その選好で reward model を学習する、(3) PPO を使って、より高い reward の出力を出すよう LLM を最適化する。

### Quantization
- **よく言われること:** 「モデルを小さくすること」
- **実際の意味:** model weights の precision を float32（4 bytes）から int8（1 byte）や int4（0.5 bytes）へ下げることです。わずかな精度低下と引き換えに、メモリを4〜8倍減らし、推論を高速化します。GPTQ、AWQ、GGUF が一般的な format です。

### ReLU
- **よく言われること:** 「Activation function」
- **実際の意味:** Rectified Linear Unit: f(x) = max(0, x)。最も単純な非線形 activation です。計算が速く、正の値では飽和しません。うまく機能し、安価なので広く使われています。派生形には LeakyReLU、GELU、SiLU があります。

### ROUGE
- **よく言われること:** 「要約の評価指標」
- **実際の意味:** Recall-Oriented Understudy for Gisting Evaluation の略です。生成テキストと参照テキストの重なりを測ります。ROUGE-1 は unigram の一致、ROUGE-2 は bigram の一致、ROUGE-L は最長共通部分列を数えます。計算は安価ですが、表面的な類似性しか測りません。同じ意味でも違う単語を使った2文は低いスコアになります。

## S

### Semantic Search
- **よく言われること:** 「意味を理解する賢い検索」
- **実際の意味:** keyword matching ではなく意味で文書を探すことです。query とすべての文書を同じ vector space に embed し、query embedding に最も近い embeddings を持つ文書を返します。"payment failed" は、共通する単語がなくても "transaction declined" を見つけられます。embedding models + vector databases によって実現されます。

### Streaming
- **よく言われること:** 「応答が単語ごとに表示されること」
- **実際の意味:** 完全な応答を待つのではなく、LLMが生成した tokens を順次送ることです。Server-Sent Events（SSE）または WebSocket protocols を使います。最初の token までの体感 latency を、秒単位からミリ秒単位へ下げます。本番の chat interface には不可欠です。各 chunk には delta（部分 token または単語）が含まれます。

### Self-Attention
- **よく言われること:** 「モデルがどこに注目するかを決める仕組み」
- **実際の意味:** 各 token が query、key、value vectors を計算します。2つの token 間の attention weight は、query と key の dot product をスケーリングして softmax したものです。出力は value vectors の重み付き和です。これにより、すべての token が他のすべての token を参照できます。

### SFT (Supervised Fine-Tuning)
- **よく言われること:** 「モデルに指示に従うことを教えること」
- **実際の意味:** 事前学習済みモデルを (instruction, response) ペアで fine-tuning することです。モデルは instruction を与えられたときに response を生成することを学びます。base model を chat model に変えるのがこれです。

### Softmax
- **よく言われること:** 「数値を確率に変えるもの」
- **実際の意味:** softmax(x_i) = exp(x_i) / sum(exp(x_j))。任意の実数ベクトルを確率分布（すべて正で、合計が1）に変換します。classification heads、attention weights、その他確率が必要な場所で使われます。

### Swarm
- **よく言われること:** 「たくさんのAI agents が群れのように協調して働くこと」
- **実際の意味:** 複数の agents が state を共有し、message passing を通じて協調する仕組みです。中央制御ではなく、個々の単純なルールから創発的な振る舞いが生まれます。

## T

### System Prompt
- **よく言われること:** 「AIへの指示」
- **実際の意味:** 会話の冒頭に置かれ、モデルの振る舞い、persona、制約を設定する特別な message です。user messages より前に処理されます。多くのUIではユーザーに表示されません。モデルがすべきこと・すべきでないこと、tone、format preferences、domain focus を定義します。user prompts とは異なり、system prompts は開発者が設定します。

### Tensor
- **よく言われること:** 「多次元配列」
- **実際の意味:** deep learning frameworks における基本データ構造です。0D tensor は scalar、1D は vector、2D は matrix、3D以上は tensor です。PyTorch や JAX では、tensors は automatic differentiation のために計算履歴を追跡でき、CPU または GPU 上に置けます。ニューラルネットワークの入力、出力、重み、勾配はすべて tensors です。

### Token
- **よく言われること:** 「単語」
- **実際の意味:** BPE のような tokenizer が生成する subword unit です。英語では典型的に3〜4文字程度です。"unbelievable" は "un" + "believ" + "able" の3 tokens になることがあります。

### Temperature
- **よく言われること:** 「創造性の設定」
- **実際の意味:** softmax の前に logits を割るスカラーです。Temperature=1 がデフォルトです。高いほど分布が平坦になり、出力はよりランダムになります。低いほど分布が鋭くなり、より決定的になります。Temperature=0 は argmax（常に最も確率の高い token を選ぶ）です。

### Transfer Learning
- **よく言われること:** 「事前学習済みモデルを使うこと」
- **実際の意味:** あるタスクで学習したモデルを、別のタスクへ適応させることです。初期の層は、転用可能な一般的 feature（エッジ、構文パターンなど）を学習します。タスク固有の学習が必要なのは後段の層だけです。これが、BERT を任意のNLPタスクへ fine-tune できる理由です。

### Transformer
- **よく言われること:** 「現代AIを支えるアーキテクチャ」
- **実際の意味:** recurrence ではなく self-attention（すべての位置が他のすべての位置に attention できる仕組み）を使って系列を処理する neural network architecture です。これにより大規模な並列化が可能になります。
- **そう呼ばれる理由:** attention layers を通じて input representations を output representations へ変換するためです。

## U

### Underfitting
- **よく言われること:** 「モデルが学習できていない」
- **実際の意味:** モデルが単純すぎて、データ内のパターンを捉えられない状態です。training loss は高いままです。対策は、parameters を増やす、層を増やす、学習時間を延ばす、regularization を弱める、features を改善することです。

## V

### VAE (Variational Autoencoder)
- **よく言われること:** 「生成モデル」
- **実際の意味:** encoder output が Gaussian distribution に従うよう強制することで、滑らかな latent space を学習する autoencoder です。この分布から sample し、decode することで新しいデータを生成できます。reparameterization trick により backpropagation で学習可能になります。

### Vector Database
- **よく言われること:** 「AI用の特殊なデータベース」
- **実際の意味:** vectors（float の dense arrays）を保存し、高速な approximate nearest-neighbor search を行うよう最適化された database です。similarity search、RAG、recommendation systems の中核となる操作です。

## W

### Weight
- **よく言われること:** 「モデルが学習したもの」
- **実際の意味:** モデルの parameter matrix に含まれる1つの数値です。input size 768、output size 3072 の linear layer には、768*3072 = 2,359,296 個の weights があります。学習は各 weight を調整し、loss function を最小化します。

### Weight Decay
- **よく言われること:** 「Regularization」
- **実際の意味:** weights の大きさに比例する penalty を loss function に追加することです。L2 regularization と同等です。weights が大きくなりすぎるのを防ぎます。典型値は0.01〜0.1です。

## Z

### Zero-Shot
- **よく言われること:** 「学習なしで使えること」
- **実際の意味:** 明示的に学習していないタスクに対して、task-specific examples を prompt に入れずにモデルを使うことです。モデルは pre-training から汎化します。大規模モデルは十分に多様な形式を見ているため、新しいタスク形式にも対応できます。
