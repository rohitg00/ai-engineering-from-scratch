# BERT——遮罩語言模型（masked language modeling）

> GPT 預測下一個詞。BERT 預測缺掉的詞。兩者只差一個預測任務，卻影響了之後五年所有長得像 embedding 的東西。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## The Problem｜問題

2018 年，每一個 NLP 任務——情感（sentiment）、命名實體辨識（named entity recognition）、問答、蘊涵（entailment）——都在自己的有標籤（label）資料上從零訓練自己的模型。沒有一個預訓練（pretraining）好、可以 fine-tune 的「懂英文」checkpoint。ELMo（2018）顯示，你可以用雙向 LSTM 預訓練脈絡 embedding；有幫助，但泛化（generalization）不夠。

BERT（Devlin et al. 2018）問：如果我們拿一個 transformer 編碼器（encoder），在網路上的每一句上訓練，強迫它從兩邊的脈絡預測缺掉的詞呢？然後你在下游任務上 fine-tune 一個頭。參數效率帶來重大啟發。

結果：18 個月內，BERT 和它的變體（RoBERTa、ALBERT、ELECTRA）主宰了當時存在的每一個 NLP 排行榜。到 2020 年，地球上每一個搜尋引擎、內容審核管線（pipeline）、語意搜尋系統裡都內建了一個 BERT。

2026 年，只有編碼器的模型仍然是分類、檢索（retrieval）、結構化抽取的正確工具——每個 token 比解碼器（decoder）快 5 到 10 倍，它們的 embedding 是每一套現代檢索堆疊的骨幹。ModernBERT（2024 年 12 月）把架構推到 8000 的脈絡，用 Flash Attention 加 RoPE 加 GeGLU。

## The Concept｜核心概念

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### 訓練訊號

拿一句：`the quick brown fox jumps over the lazy dog`。

隨機遮掉 15% 的 token：

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

訓練模型，在被遮的位置預測原本的 token。因為編碼器是雙向的，預測位置 1 的 `[MASK]` 可以用位置 2 以後的 `brown fox jumps`。這是 GPT 做不到的事。

### BERT 的遮罩規則

被選來預測的那 15% token 裡：

- 80% 換成 `[MASK]`。
- 10% 換成一個隨機 token。
- 10% 保持原樣。

為什麼不永遠用 `[MASK]`？因為 `[MASK]` 在推論（inference）時從不出現。若訓練時每個被遮位置都 100% 期待 `[MASK]`，預訓練和 fine-tune 之間就會有分布偏移（distribution shift）。那 10% 隨機加 10% 不變，避免模型只依賴遮罩 token。

### 下一句預測（NSP）——以及為什麼被拿掉

原始 BERT 也訓練 NSP：給定兩句 A 和 B，預測 B 是否接在 A 後面。RoBERTa（2019）把它消融掉，顯示 NSP 有害、沒有幫助。現代編碼器跳過它。

### 2026 年變了什麼:ModernBERT 

2024 年的 ModernBERT 論文用 2026 年的元件重建了區塊：

| 元件 | 原始 BERT（2018） | ModernBERT（2024） |
|-----------|----------------------|-------------------|
| 位置 | 學來的絕對位置 | RoPE |
| 活化 | GELU | GeGLU |
| 正規化 | LayerNorm | Pre-norm RMSNorm |
| 注意力 | 完整稠密 | 交替的局部（128）加全域 |
| 脈絡長度 | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

而且和 2018 年的堆疊不同，它原生就用 Flash Attention。序列長度 8000 時，推論比 DeBERTa-v3 快 2 到 3 倍，GLUE 分數更好。

### 2026 年仍然選編碼器的用途

| 任務 | 為什麼編碼器贏過解碼器 |
|------|---------------------------|
| 檢索／語意搜尋的 embedding | 雙向脈絡 = 每個 token 的 embedding 品質更好 |
| 分類（情感、意圖、毒性） | 一次前向傳遞；沒有生成的額外成本 |
| 命名實體辨識／token 標註 | 每個位置都有輸出，天生雙向 |
| 零樣本（zero-shot）蘊涵（NLI） | 分類頭加在編碼器上面 |
| RAG 的重排器 | 交叉編碼器（cross-encoder）打分，比 LLM 重排器快 10 倍 |

```figure
transformer-residual
```

## Build It｜動手實作

### 步驟 1：遮罩邏輯

見 `code/main.py`。函式 `create_mlm_batch` 吃進一串 token id、詞彙大小、遮罩機率。回傳輸入 id（已套上遮罩）和標籤（只在被遮位置，其他是 -100——PyTorch 的忽略索引慣例）。

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### 步驟 2：在一個小語料庫（corpus）上跑 MLM 預測

在 20 個詞的詞彙、200 句上訓練 2 層編碼器加 MLM 頭。沒有梯度——我們做前向傳遞的健全檢查。完整訓練需要 PyTorch。

### 步驟 3：比較遮罩類型

看這三路規則怎麼讓模型在沒有 `[MASK]` 時仍然可用。在沒遮罩的句子和有遮罩的句子上預測。兩種情況都應產生合理的 token 分布，因為訓練時兩種模式都看過。

### 步驟 4：fine-tune 頭

把 MLM 頭換成分類頭，接在一個玩具情感資料集（dataset）上。只有頭在訓練；編碼器凍住。這是每一個 BERT 應用都跟著走的模式。

## Use It｜實際應用

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding 模型是 fine-tune 過的 BERT。** `sentence-transformers` 的模型，例如 `all-MiniLM-L6-v2`，是用經對比損失訓練的 BERT。編碼器是同一個。損失換了。

**交叉編碼器重排器也是 fine-tune 過的 BERT。** 在 `[CLS] query [SEP] doc [SEP]` 上做配對分類。查詢與文件間的雙向注意力，正是交叉編碼器比雙編碼器品質好的原因。

**2026 年什麼時候不選 BERT。** 任何生成式的東西。編碼器沒有合理的方式自迴歸地產出 token。還有：10 億參數以下，小解碼器能以更大的彈性達到相近品質（Phi-3-Mini、Qwen2-1.5B）。

## Ship It｜交付成果

見 `outputs/skill-bert-finetuner.md`。這個 skill 為新的分類或抽取任務框定一次 BERT fine-tune（骨幹選擇、頭的規格、資料、評估、停止）。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`，印出 1 萬個 token 上的遮罩分布。確認大約 15% 被選中，其中大約 80% 變成 `[MASK]`。
2. **中等。** 實作整詞遮罩：若一個詞被切成子詞，要麼全部遮、要麼都不遮。在 500 句的語料上量這會不會提高 MLM 準確率（accuracy）。
3. **困難。** 在一個公開資料集的 1 萬句上訓練一個很小的（2 層、d=64）BERT。為 SST-2 情感 fine-tune `[CLS]` token。和參數數量對得上的純解碼器基準比——誰贏？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| MLM | 「遮罩語言模型」 | 訓練訊號：隨機把 15% 的 token 換成 `[MASK]`，預測原本的 token。 |
| 雙向 | 「兩邊都看」 | 編碼器注意力沒有因果遮罩——每個位置都看得到其他每個位置。 |
| `[CLS]` | 「池化 token」 | 加在每條序列前面的特殊 token；它最後的 embedding 當作句子層級的表示。 |
| `[SEP]` | 「區段分隔」 | 分開成對的序列（例如查詢／文件、句子 A／B）。 |
| NSP | 「下一句預測」 | BERT 的第二個預訓練任務；在 RoBERTa 裡被證明沒用，2019 年之後拿掉。 |
| fine-tune | 「接到一個任務上」 | 編碼器大部分凍住；在上面訓練一個小頭，做下游任務。 |
| 交叉編碼器 | 「重排器」 | 一個 BERT，查詢和文件一起當輸入，輸出相關分數。 |
| ModernBERT | 「2024 年的翻新」 | 用 RoPE、RMSNorm、GeGLU、交替的局部／全域注意力重建的編碼器，脈絡 8000。 |

## Further Reading｜延伸閱讀

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) ——原始論文。
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) ——怎麼把 BERT 訓練對；拿掉 NSP。
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) ——在相同計算量下，被替換 token 的偵測贏過 MLM。
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) ——ModernBERT 論文。
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) ——標準的編碼器參考。
