# AIにまつわる誤解を解く

AI、ML、deep learning に関するよくある誤解を取り上げ、それぞれについて実際に何が起きているのかを説明します。

---

## 「AIは言語を理解している」

**実際:** LLMは、学習データ内の統計的パターンに基づいて次のトークンを予測します。理解も信念も、証明可能な world model も持っていません。数十億の例にまたがるパターンマッチングが非常に得意なのです。出力が理解しているように見えるのは、そのパターンがほとんどの状況を覆えるほど豊かだからです。

**なぜ重要か:** LLMを reasoning engine として扱うと、自信たっぷりに間違ったことを言ったときに驚くことになります。pattern matcher として扱えば、それを前提にしたより良いシステムを設計できます。

---

## 「parameters が多いほど賢いモデルになる」

**実際:** 高品質なデータと優れた手法で学習した 7B parameter model は、質の低いデータで学習した 70B model を上回ることがあります。Chinchilla は、多くのモデルが over-parameterized かつ under-trained だったことを示しました。学習データの質と量は、モデルサイズと同じくらい重要です。Phi-2（2.7B）は、多くの benchmark で10倍のサイズのモデルを上回りました。

**なぜ重要か:** 何でも最大のモデルを選ぶべきではありません。タスクと予算に合わせてモデルサイズを選びます。

---

## 「ニューラルネットワークはブラックボックスだ」

**実際:** ニューラルネットワークが何を学んでいるかを理解するためのツールはあります。attention visualization はモデルがどの tokens に注目しているかを示します。probing classifiers は hidden representations にどの情報が保存されているかを明らかにします。mechanistic interpretability は実際の circuits（induction heads、feature detectors）を見つけつつあります。完全に透明ではありませんが、完全なブラックボックスでもありません。

**なぜ重要か:** ニューラルネットワークはデバッグできます。gradient analysis、activation visualization、attention maps は、このコースで扱う実用的なツールです。

---

## 「AIはプログラマーを置き換える」

**実際:** AIはプログラミングを変えましたが、置き換えたわけではありません。AIは boilerplate を書けます。人間はシステムを設計し、アーキテクチャ上の判断をし、正しさをレビューし、AIが間違えるケースに対処します。役割は「すべての行を書く」から「レビューし、指示し、設計する」へ移りました。優れたエンジニアは、AIを代替物として恐れるのではなくツールとして使います。

**なぜ重要か:** 学んでいるのはAIエンジニアリングであり、つまりプログラミング + AI です。2つのスキルを組み合わせることは、どちらか一方だけよりも価値があります。

---

## 「AIをやるには数学のPhDが必要だ」

**実際:** 必要なのは高校数学と、このコースの Phase 1 で扱う特定のトピックです。linear algebra、calculus、probability、optimization です。証明は不要です。必要なのは、各操作が何をしていて、なぜ重要なのかについての直感です。行列を掛け算でき、微分ができれば、ニューラルネットワークを作れます。

**なぜ重要か:** Phase 1 は、必要な数学だけを過不足なく身につけるためにあります。

---

## 「GPTは General Purpose Technology の略だ」

**実際:** GPT は Generative Pre-trained Transformer の略です。Generative = テキストを生成する。Pre-trained = 適応前に大規模 corpus で一度学習している。Transformer = 2017年の論文 "Attention Is All You Need" に由来するアーキテクチャです。

---

## 「Temperature を上げるとAIがより創造的になる」

**実際:** Temperature は softmax の前に logits をスケーリングします。高い temperature = 平坦な確率分布 = よりランダムな token selection です。低い temperature = 鋭い分布 = より決定的です。これは創造性ではなくランダム性です。high-temperature のモデルは深く考えているのではなく、単に確率の低い tokens も候補に入れているだけです。

**なぜ重要か:** 出力が反復的すぎるなら temperature を上げます。混沌としすぎるなら下げます。これはランダム性のノブであり、それ以上のものではありません。

---

## 「Fine-tuning はモデルに新しい知識を教える」

**実際:** Fine-tuning が調整するのは、モデルが既存の知識をどう使うかであって、何を知っているかではありません。pre-training data に入っていなかった情報を、fine-tuning で信頼性高く追加することはできません。Fine-tuning は事実の追加よりも、振る舞い（style、format、tone、task-specific patterns）を変えるのに向いています。新しい知識には RAG を使います。

**なぜ重要か:** モデルに会社の内部文書を知ってほしいなら RAG を使います。特定の形式で応答してほしいなら fine-tune します。

---

## 「context window は大きいほど良い」

**実際:** 長い context ではモデルの性能が落ちます。"lost in the middle" 問題とは、モデルが長い prompt の冒頭と末尾により注意を払い、中盤への注意が弱くなることです。200K context window があるからといって、モデルが200K tokens すべてを同じようにうまく使えるわけではありません。また、長い context はコストが高く、遅くなります。

**なぜ重要か:** 何でも context に詰め込まないでください。選別が必要です。対象を絞って取得する RAG は、文書全体を詰め込むより優れています。

---

## 「AI agents は自律的だ」

**実際:** 現在の AI agents は、think、act、observe、repeat のループで動きます。harness が定義したパターンに従っているだけです。目標、計画、自己認識を持っているわけではありません。次にどのツールを呼ぶかをLLMで決める reactive systems です。「自律性」はAIそのものではなく、ループから来ています。

**なぜ重要か:** agents を作るとき、作っているのは loop、tools、guardrails です。LLMはシステム内部の意思決定コンポーネントにすぎません。

---

## 「Transformers は positional encoding によって順序を理解している」

**実際:** Transformers には本来、順序の感覚がありません。Self-attention は入力を sequence ではなく set として扱います。Positional encoding は、位置に依存するベクトルを入力に加えることで順序情報を注入する workaround です。sinusoidal、learned、RoPE、ALiBi などの方法は、それぞれ異なる形でこれを扱います。どれも RNN が持っていたような逐次的理解を、モデルに本当に与えているわけではありません。

**なぜ重要か:** これが positional encoding の研究が今も続いている理由です。多くの用途では十分に解けた問題ですが、根本的には workaround です。

---

## 「Pre-training はインターネットを読むだけだ」

**実際:** Pre-training は巨大な corpus に対する next-token prediction です。モデルは、それまでに来たものをもとに次に何が来るかを予測するよう学習します。この単純な目的を通じて、文法、事実、reasoning patterns、コード構造などを学びます。一方で、インターネット上の無意味な情報、バイアス、誤情報も学びます。data curation、filtering、deduplication は極めて重要です。

**なぜ重要か:** Garbage in, garbage out です。pre-training data の品質は、モデル間の最も大きな差別化要因の1つです。

---

## 「RLHF はAIを人間の価値観に alignment する」

**実際:** RLHF がAIを合わせるのは、feedback を提供した特定の人間の preferences です。その人たちは互いに意見が違い、バイアスを持ち、すべての状況を網羅できません。RLHF は、raters が定義した範囲でモデルを helpful かつ harmless にするものであり、普遍的な人間の価値体系に alignment するものではありません。

**なぜ重要か:** RLHF は training technique であって、alignment の解決策ではありません。大きな toolkit の中の1つの道具です。

---

## 「Embeddings は意味を捉えている」

**実際:** Embeddings が捉えるのは統計的な共起パターンです。似た context に現れる単語は似た vectors になります。これは有用なほど意味と相関しますが、semantic understanding ではありません。"King - Man + Woman = Queen" が成り立つのは distributional patterns のためであって、モデルが君主制やジェンダーを理解しているからではありません。

**なぜ重要か:** Embeddings は similarity search、clustering、retrieval に強力です。ただし、「似ている」が何を意味するのかを過剰に解釈しないでください。

---

## 「Zero-shot は学習していないという意味だ」

**実際:** Zero-shot とは、推論時に task-specific examples がないという意味です。モデル自体は数十億 tokens で学習済みです。ただ、その特定のタスク形式の例を見ていないだけです。pre-training patterns から汎化します。Few-shot は prompt 内に少数の例を与えることです。どちらも、モデルが学習なしに身につけたという意味ではありません。

---

## 「AI models は人間のように学習する」

**実際:** 人間は少数の例から学び、domains をまたいで汎化し、beliefs を継続的に更新します。ニューラルネットワークは何百万もの例を必要とし、training distribution の範囲内で汎化し、学習後は weights が固定されます。「学習」という類推は、せいぜい大まかなものです。Backpropagation は、生物学的なニューロンの学習とはまったく異なります。

**なぜ重要か:** モデルを擬人化しないでください。何ができて何ができないかについて、誤った期待につながります。

---

## 「Scaling laws は大きいほど常に良いという意味だ」

**実際:** Scaling laws は、compute、data、model size の間にある予測可能な関係を説明します。そこから分かるのは diminishing returns です。parameters を2倍にしても performance は2倍になりません。また、データも比例して増やすことを前提にしています。実用上の改善の多くは、規模だけでなく、より良い architectures、training techniques、data quality から生まれます。

**なぜ重要か:** 優れたエンジニアリングを施した 7B model で問題を解けることがあります。最初から 70B に飛びつく必要はありません。

---

## 「Open source AI と open weights は同じだ」

**実際:** 多くの "open source" models は open weights です。手に入るのはモデルファイルであり、training data、training code、data pipeline は含まれません。真の open source（OLMo など）は、data、code、intermediate checkpoints、evaluation まですべて公開します。Open weights は有用ですが、open source と同じコミットメントではありません。

**なぜ重要か:** 何を手に入れているのかを把握してください。Open weights があれば実行と fine-tune ができます。真の open source なら、再現し理解できます。

---

## 「Prompt engineering は本物の engineering ではない」

**実際:** Prompt engineering は system design です。人間の意図とモデルの振る舞いの間にある interface を設計しています。良い prompt engineering には、tokenization、attention patterns、context window limits、output parsing の理解が必要です。「AIにうまく話しかける」よりも API design に近いものです。

**なぜ重要か:** このコースでは Phase 11 で、prompt engineering を実際の engineering discipline として教えます。

---

## 「CNNs は時代遅れで、今はすべて transformers だ」

**実際:** Vision Transformers（ViT）は多くの benchmark で CNNs を上回りますが、CNNs は今も広く使われています。推論が速く、mobile/edge でうまく動き、必要なデータが少なく、有用な inductive biases（translation invariance、local patterns）を持っています。多くの production vision systems は今も CNNs を使っています。最良の architectures は両方を組み合わせることも多いです。

**なぜ重要か:** 両方を学んでください（Phases 4 and 7）。自分の制約でうまく機能するものを使います。

---

## 「有用なモデルを学習するには巨大な compute が必要だ」

**実際:** foundation models を pre-train するには巨大な compute が必要です。しかし fine-tuning、LoRA、transfer learning を使えば、1枚のGPUでモデルを適応できます。多くの有用なAIアプリケーションでは学習自体が不要で、良い prompting と RAG だけで十分です。「compute barrier」は foundation models を作るためのものであり、使うためのものではありません。

**なぜ重要か:** ラップトップでも実用的なAIアプリケーションは作れます。このコースがそれを示します。
