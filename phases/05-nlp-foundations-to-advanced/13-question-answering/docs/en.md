# 質問応答システム

> 現代のQAは3つのシステムに形づくられてきました。抽出型は範囲を見つけます。検索拡張型は文書に根拠づけます。生成型は答えを生成します。現代のAIアシスタントは、どれもこの3つの組み合わせです。

**種類:** 構築
**言語:** Python
**前提:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**所要時間:** 約75分

## 問題

ユーザーが "When did the first iPhone launch?" と入力したら、期待する答えは "June 29, 2007." です。"Apple's history is long and varied." ではありません。文にもなっていない "2007" だけでもありません。直接的で、根拠があり、正しい答えが必要です。

この10年、QAでは3つのアーキテクチャが主流でした。

- **抽出型QA。** 答えを含むことが分かっている質問と文章が与えられたとき、文章内の答え範囲の開始インデックスと終了インデックスを見つけます。SQuADが代表的なベンチマークです。
- **オープンドメインQA。** 文章は与えられません。まず関連する文章を検索し、そのうえで答えを抽出または生成します。これは今日のあらゆるRAGパイプラインの基盤です。
- **生成型 / クローズドブックQA。** 大規模言語モデルがパラメトリックメモリから答えます。検索はありません。推論は最速ですが、事実については最も信頼しにくい方式です。

2026年の流れはハイブリッドです。上位の少数の文章を検索し、その文章に根拠づけて答えるよう生成モデルにプロンプトを渡します。これがRAGであり、レッスン14では検索側を詳しく扱います。このレッスンではQA側を構築します。

## コンセプト

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**抽出型。** 質問と文章をまとめてTransformer (BERT系) でエンコードします。答えの開始トークンインデックスと終了トークンインデックスを予測する2つのヘッドを訓練します。損失は有効な位置に対するクロスエントロピーです。出力は文章から切り出した範囲になります。構造上、幻覚は起こしません。一方で、構造上、文章で答えられない質問には対応できません。

**検索拡張型 (RAG)。** 2段階です。まずretrieverがコーパスから上位`k`件の文章を見つけます。次にreader (抽出型または生成型) がその文章を使って答えを作ります。retrieverとreaderを分けることで、それぞれを独立に訓練・評価できます。現代のRAGでは、その間にrerankerを追加することもよくあります。

**生成型。** デコーダーのみのLLM (GPT, Claude, Llama) が学習済みの重みから答えます。検索ステップはありません。一般知識には非常に強い一方、珍しい事実や最近の事実では破綻しやすくなります。幻覚率は、事実が事前学習データに出現する頻度と反比例します。

## 構築

### Step 1: 事前学習済みモデルによる抽出型QA

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2` は、答えられない質問を含むSQuAD 2.0で訓練されています。デフォルトでは、`question-answering` pipelineはモデルのnull scoreが勝っている場合でも、最もスコアの高い範囲を返します。空の答えを自動的には返しません。明示的な「答えなし」の挙動が必要なら、pipeline呼び出しに `handle_impossible_answer=True` を渡します。その場合、null scoreがすべての範囲スコアを上回るときだけ空の答えを返します。どちらの場合でも、必ず `score` フィールドを確認してください。

### Step 2: 検索拡張パイプライン (スケッチ)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

2段階のパイプラインです。Dense retriever (Sentence-BERT) が意味的類似度で関連文章を見つけます。抽出型reader (RoBERTa-SQuAD) が、結合した上位文章から答えの範囲を抜き出します。小規模コーパスでは機能します。100万文書規模のコーパスでは、FAISSまたはベクトルデータベースを使います。

### Step 3: RAGによる生成

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

プロンプトパターンは重要です。モデルに文脈に根拠づけること、文脈が不十分な場合は "I don't know" と返すことを明示すると、素朴なプロンプトに比べて幻覚率を40-60%下げられます。より手の込んだパターンでは、引用、信頼度スコア、構造化抽出を追加します。

### Step 4: 現実を反映した評価

SQuADは **Exact Match (EM)** と **token-level F1** を使います。EMは正規化後 (小文字化、句読点除去、冠詞除去) の厳密一致です。予測が完全に一致すれば得点が入り、そうでなければ0です。F1は予測と参照のトークン重なりで計算され、部分点を与えます。どちらも言い換えを過小評価します。"June 29, 2007" と "June 29th, 2007" では通常、序数が正規化で吸収されないためEMは0になりますが、重なるトークンが多いのでF1はかなり高くなります。

本番QAでは次を見ます。

- **回答精度。** メトリクスだけでは意味的同等性を捉えられないため、LLM判定または人手判定を使います。
- **引用精度。** 引用された文章が実際に答えを支持しているか。生成された引用と検索済み文章の文字列一致で、自動的に確認するのは簡単です。
- **拒否の較正。** 検索された文章内に答えがないとき、システムは正しく "I don't know" と言えるか。過信の偽陽性率を測ります。
- **検索recall。** readerを評価する前に、retrieverが正しい文章を上位`k`件に入れられているかを測ります。文章が欠けていれば、readerには修正できません。

### RAGAS: 2026年の本番評価フレームワーク

`RAGAS` はRAGシステム専用に作られており、2026年の出荷時デフォルトです。正解参照を必要とせず、4つの次元を採点します。

- **Faithfulness。** 答えの各主張が検索された文脈に由来しているか。NLIベースの含意で測ります。主要な幻覚メトリクスです。
- **Answer relevance。** 答えが質問に対応しているか。答えから仮想的な質問を生成し、実際の質問と比較して測ります。
- **Context precision。** 検索されたチャンクのうち、実際に関連していた割合はどれくらいか。低いprecisionはプロンプト内のノイズを意味します。
- **Context recall。** 検索結果に必要な情報がすべて含まれていたか。低いrecallではreaderは成功できません。

参照なしの採点により、整備済みの正解データなしでも本番トラフィック上で評価できます。完全一致メトリクスが役に立たない自由回答の質問には、その上にLLM-as-judgeを重ねます。

`pip install ragas`。retrieverとreaderを接続します。クエリごとに4つのスカラーが得られます。回帰にアラートを出します。

## 使いどころ

2026年のスタックです。

| ユースケース | 推奨 |
|---------|-------------|
| 与えられた文章から答えの範囲を見つける | `deepset/roberta-base-squad2` |
| 固定コーパス上で、クローズドブックが許容できない | RAG: dense retriever + LLM reader |
| 文書ストアに対するリアルタイム処理 | hybrid (BM25 + dense) retriever + rerankerを使うRAG (レッスン14) |
| 会話型QA (フォローアップ質問) | 会話履歴 + 各ターンでのRAGを使うLLM |
| 事実性が非常に重要な規制領域 | 権威あるコーパス上の抽出型。生成型だけにはしない |

抽出型QAは、LLMを使ったRAGのほうが多くのケースに対応できるため、2026年には流行ではありません。それでも、法務調査、規制対応、監査ツールのように逐語的な引用が必要な場面では使われ続けています。

## 出荷

`outputs/skill-qa-architect.md` として保存します。

```markdown
---
name: qa-architect
description: QAアーキテクチャ、検索戦略、評価計画を選ぶ。
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

要件 (コーパスサイズ、質問タイプ、事実性制約、レイテンシ予算) が与えられたら、次を出力する。

1. アーキテクチャ。抽出型、抽出型readerを使うRAG、生成型readerを使うRAG、またはクローズドブックLLM。理由を1文で述べる。
2. Retriever。なし、BM25、dense (エンコーダー名を挙げる)、またはhybrid。
3. Reader。SQuADで調整されたモデル、名前付きのLLM、または "domain-fine-tuned DistilBERT"。
4. 評価。抽出型ベンチマークにはEM + F1。本番には回答精度 + 引用精度 + 拒否の較正。何を、どのように測るかを明記する。

規制またはコンプライアンスに関わる質問では、クローズドブックLLMの回答を拒否する。検索recallのベースラインがないQAシステムは拒否する (retrieverが正しい文章を提示できたか分からなければ、readerを評価できない)。multi-hop reasoningを必要とする質問は、HotpotQAで訓練されたシステムのような専用のmulti-hop retrieverが必要だと指摘する。
```

## 演習

1. **Easy。** 上のSQuAD抽出型パイプラインを10件のWikipedia文章でセットアップしてください。質問を10個手作りします。答えが正しい頻度を測ってください。文章と質問がきれいなら、7-9問は正解するはずです。
2. **Medium。** 拒否分類器を追加してください。上位検索スコアが閾値 (たとえばcosine 0.3) を下回る場合、readerを呼ぶ代わりに "I don't know" を返します。保留データセットで閾値を調整してください。
3. **Hard。** 任意の10,000文書コーパス上にRAGパイプラインを構築してください。RRF fusionを使うhybrid retrieval (BM25 + dense) を実装します (レッスン14参照)。hybridステップあり・なしで回答精度を測ります。どの質問タイプが最も恩恵を受けるかを記録してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Extractive QA | 答えの範囲を見つける | 与えられた文章内で、答えの開始インデックスと終了インデックスを予測する。 |
| Open-domain QA | コーパス上のQA | 文章は与えられない。検索してから答える必要がある。 |
| RAG | 検索してから生成する | Retrieval-augmented generation。retriever + readerのパイプライン。 |
| SQuAD | 代表的なベンチマーク | Stanford Question Answering Dataset。EM + F1メトリクス。 |
| Hallucination | 作り話の答え | 検索された文脈に支持されていないreader出力。 |
| Refusal calibration | 黙るべき時を知る | 答えられないときに、システムが正しく "I don't know" と言うこと。 |

## 参考資料

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) — ベンチマーク論文。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — QAにおける代表的なdense retrieverであるDPR。
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) — RAGという名前を与えた論文。
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) — 包括的なRAGサーベイ。
