# 機器翻譯（machine translation）

> 翻譯是那個支撐自然語言處理研究三十年，至今仍持續推動研究的任務。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## The Problem｜問題

模型讀一種語言的句子，產出另一種語言的句子。長度會變。詞序會變。有些來源詞對到多個目標詞，反過來也一樣。慣用語拒絕一對一。「I miss you」的法文是「tu me manques」——字面是「你在我這裡缺少了」。沒有詞級對齊撐得過這個。

機器翻譯是那個逼自然語言處理發明編碼器－解碼器（encoder-decoder）、注意力（attention）、transformer，最後是整個大型語言模型典範的任務。每一步前進，都是因為翻譯品質量得到，而人機之間的品質差距始終難以縮小。

這一課跳過歷史，教 2026 年真的在用的管線（pipeline）：預訓練的多語編碼器－解碼器（NLLB-200 或 mBART）、子詞（subword）tokenization、集束搜尋（beam search）、BLEU 和 chrF 評估，以及那幾個仍會沒被抓到就送上正式環境的失敗方式。

## The Concept｜核心概念

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

現代機器翻譯是在平行文字上訓練的 transformer 編碼器－解碼器。編碼器用該語言的 tokenization 讀來源。解碼器一次生成一個子詞，經由交叉注意力（cross-attention，第 10 課）使用編碼器的輸出。解碼用集束搜尋，避開貪婪解碼的陷阱。輸出再還原 token、還原大小寫（detruecase），然後對著參考譯文打分。

三個操作上的選擇，決定真實世界的翻譯品質。

- **Tokenizer。** 在混合語言語料庫（corpus）上訓練的 SentencePiece BPE。跨語言共用詞彙表（vocabulary），才讓 NLLB 的零樣本（zero-shot）語言對成為可能。
- **模型大小。** NLLB-200 蒸餾版 6 億放得進筆電。NLLB-200 的 33 億是發表時的正式環境預設。545 億是研究的天花板。
- **解碼。** 一般內容用集束寬度 4 到 5。長度懲罰避免輸出太短。需要術語一致時用約束解碼。

```figure
seq2seq-alignment
```

## Build It｜動手實作

### 步驟 1：呼叫預訓練的機器翻譯

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

這裡有三件事要緊。`src_lang` 告訴 tokenizer 使用哪種文字系統與切分方式。`forced_bos_token_id` 告訴解碼器生成哪種語言。兩者都是 NLLB 專用的手法；mBART 和 M2M-100 有自己的慣例，不能互換。

### 步驟 2：BLEU 和 chrF

BLEU 量輸出和參考譯文的 n-gram 重疊。四種參考 n-gram 大小（1 到 4），精確率（precision）的幾何平均，再加上對太短輸出的過短懲罰。分數在 [0, 100]。很常用。解釋起來令人挫折：30 BLEU 是「能用」；40 是「好」；50 是「非常出色」；差不到 1 BLEU 是雜訊。

chrF 量字元級的 F 分數。對構詞豐富的語言更敏感，那些語言上 BLEU 會少算對上的部分。常常和 BLEU 一起報。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

永遠用 `sacrebleu`。它把 tokenization 正規化（normalization），所以分數可以跨論文比。自己算 BLEU，就是誤導性基準出現的方式。

### 三層評估階層（2026）

現代機器翻譯評估用三族互補的指標。至少帶兩種出去。

- **啟發式**（BLEU、chrF）。快、要參考譯文、可解釋、對改寫不敏感。用來和舊結果比，以及偵測退步。
- **學來的**（COMET、BLEURT、BERTScore）。在人類判斷上訓練的神經模型；比較譯文與來源、參考譯文的語意相似度。COMET 自 2023 年起和機器翻譯研究的關聯最高，也是 2026 年品質要緊時的正式環境預設。
- **用 LLM 當評審**（不需參考譯文）。請一個大模型依流暢、適切度、語氣、文化恰當來打分。評分規準設計得好時，GPT-4 當評審和人類一致的時候大約 80%。沒有參考譯文的開放內容用這個。

2026 年的實務組合：`sacrebleu` 算 BLEU 和 chrF，`unbabel-comet` 算 COMET，再加一個被 prompt 的 LLM 當最後給人看的訊號。在相信它處理正式環境資料之前，用 50 到 100 筆人類標好的例子校準每個指標。

不需參考譯文的指標（COMET-QE、BLEURT-QE、用 LLM 當評審）讓你沒有參考譯文也能評估，這對沒有參考譯文的長尾語言對很要緊。

### 步驟 3：正式環境裡會壞的地方

上面那條能用的管線，80% 的時候翻得很順，剩下 20% 會安靜地失敗。點過名的失敗方式：

- **幻覺（hallucination）。** 模型發明來源裡沒有的內容。不熟的領域詞彙上常見。症狀：輸出很順，卻主張來源沒說的事實。緩解：對領域術語做約束解碼，受管制的內容給人審，並監控輸出比輸入長很多的情況。
- **生成到錯誤的語言。** 模型翻成錯的語言。NLLB 在稀有語言對上意外地容易這樣。緩解：確認 `forced_bos_token_id`，並且永遠用語言識別模型檢查輸出。
- **術語漂移。** 「Sign up」在文件 1 變成「s'inscrire」，文件 2 變成「créer un compte」。對使用者介面文字和給人看的字串，一致比原始品質更要緊。緩解：用詞彙表約束解碼，或事後用字典改。
- **語體不合。** 法文的「tu」對上「vous」，日文的敬語層級。模型挑訓練裡較常見的那個形式。這種語體通常不適合客戶溝通。緩解：如果模型支援，在 prompt 前綴放一個語體 token，或在只有正式語體的語料上 fine-tune 一個小模型。
- **短輸入的長度爆炸。** 非常短的輸入句常常產出過長的譯文，因為長度懲罰在大約 5 個來源 token 以下陡掉。緩解：硬性的最大長度上限，和來源長度成比例。

### 步驟 4：為領域 fine-tune

預訓練模型是通才。法律、醫學或遊戲對話的翻譯，在領域平行資料上 fine-tune 會有量得到的好處。食譜並不奇特：

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

幾千筆高品質的平行例子，打得過數十萬筆吵雜的網頁抓取。訓練資料的品質，是正式環境裡最大的那根槓桿。

## Use It｜實際應用

2026 年機器翻譯的正式環境組合：

| 用途 | 建議的起點 |
|---------|---------------------------|
| 任意到任意，200 種語言 | `facebook/nllb-200-distilled-600M`（筆電）或 `nllb-200-3.3B`（正式環境） |
| 以英文為中心、高品質、50 種語言 | `facebook/mbart-large-50-many-to-many-mmt` |
| 短程、推論（inference）便宜、英－法／德／西 | Helsinki-NLP／Marian 模型 |
| 延遲（latency）要緊、在瀏覽器端 | ONNX 量化的 Marian（約 50 MB） |
| 要最高品質、願意付錢 | 用翻譯 prompt 的 GPT-4／Claude／Gemini |

截至 2026 年，大型語言模型在好幾個語言對上已經超過專門的機器翻譯模型，尤其是慣用語和長脈絡。代價是每個 token 的成本和延遲。當脈絡長度、文體一致，或用 prompting 做領域適應，比吞吐量更要緊時，選大型語言模型。

## Ship It｜交付成果

存成 `outputs/skill-mt-evaluator.md`：

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## Exercises｜練習

1. **簡單。** 用 `nllb-200-distilled-600M` 把一段 5 句的英文翻成法文，再翻回英文。量來回結果和原文有多近。你應該會看到語意留著，用詞卻漂了。
2. **中等。** 用 `fasttext lid.176` 或 `langdetect` 對翻譯輸出做語言識別檢查。接進機器翻譯呼叫，讓錯誤語言的生成在回傳前被抓到。
3. **困難。** 在你選的 5000 對領域語料上 fine-tune `nllb-200-distilled-600M`。在留出集合上量 fine-tune 前後的 BLEU。回報哪類句子變好、哪類退步。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| BLEU | 翻譯分數 | 帶過短懲罰的 n-gram 精確率。[0, 100]。 |
| chrF | 字元 F 分數 | 字元級的 F 分數。對構詞豐富的語言更敏感。 |
| NMT | 神經機器翻譯 | 在平行文字上訓練的 transformer 編碼器－解碼器。2017 年以後的預設。 |
| NLLB | No Language Left Behind | Meta 的 200 種語言機器翻譯模型家族。 |
| 約束解碼 | 受控的輸出 | 強迫特定 token 或 n-gram 出現，或不出現。 |
| 幻覺 | 發明出來的內容 | 來源支撐不了的模型輸出。 |

## Further Reading｜延伸閱讀

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) ——NLLB 論文。
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) ——為什麼 `sacrebleu` 是報 BLEU 的唯一正確方式。
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) ——chrF 論文。
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) ——fine-tune 的實務逐步說明。
