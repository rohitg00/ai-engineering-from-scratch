# T5、BART——編碼器–解碼器（encoder–decoder）模型

> 編碼器負責理解。解碼器負責生成。把它們再接回去，你就得到一個為輸入到輸出而做的模型：翻譯、摘要、改寫、轉錄。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## The Problem｜問題

只有解碼器的 GPT、只有編碼器的 BERT，各自為了不同目標而精簡 2017 年的架構。但很多任務天生就是輸入到輸出的任務：

- 翻譯：英文 → 法文。
- 摘要：5000 個 token 的文章 → 200 個 token 的摘要。
- 語音辨識：音訊 token → 文字 token。
- 結構化抽取：散文 → JSON。

這些任務上，編碼器–解碼器貼得最乾淨。編碼器產出來源的稠密表示（dense representation）。解碼器生成輸出，每一步都用交叉注意力（cross-attention）看那份表示。訓練是在輸出側往後移一位。損失和 GPT 一樣，只是以編碼器輸出為條件。

兩篇論文定下現代的打法：

1. **T5**（Raffel et al. 2019）。「Text-to-Text Transfer Transformer。」每個 NLP 任務都重構成文字進、文字出。單一架構、單一詞彙、單一損失。預訓練是遮罩區段預測（masked span prediction，把輸入裡的區段弄壞，在輸出裡把它們解出來）。
2. **BART**（Lewis et al. 2019）。「Bidirectional and Auto-Regressive Transformer。」去噪自編碼器（denoising autoencoder）：用多種方式弄壞輸入（打亂、遮罩、刪除、旋轉），請解碼器把原文重建回來。

2026 年，輸入結構要緊的地方，編碼器–解碼器這個形式還在：

- Whisper（語音 → 文字）。
- Google 的翻譯堆疊。
- 一些程式碼補完／修復模型，脈絡和編輯的結構是分開的。
- Flan-T5 和它的變體，做結構化推理任務。

只有解碼器模型成了焦點，但編碼器–解碼器從來沒有消失。

## The Concept｜核心概念

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### 前向傳遞迴圈

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

關鍵是：編碼器對每個輸入只跑一次。解碼器自迴歸（autoregressive）地跑，但每一步交叉注意的是*同一份*編碼器輸出。把編碼器輸出快取起來，對長輸入是免費的加速。

### T5 預訓練——遮罩區段預測

在輸入裡隨機挑區段（平均長度 3 個 token，總共 15%）。每個區段換成獨一無二的哨兵（sentinel）：`<extra_id_0>`、`<extra_id_1>`，以此類推。解碼器只輸出被破壞的區段，並帶上哨兵前綴：

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

這個訊號比預測整段序列便宜。在 T5 論文的消融裡，它和 MLM（BERT）、前綴語言模型（UniLM）表現相近。

### BART 預訓練——多種雜訊的去噪

BART 試了五種加噪函式：

1. Token 遮罩。
2. Token 刪除。
3. 文字填空（text infilling，遮掉一個區段，解碼器補上正確的長度）。
4. 句子排列。
5. 文件旋轉。

文字填空加句子排列，下游表現最佳。解碼器永遠重建原文。BART 的輸出是完整序列，不只是被破壞的區段——所以預訓練運算比 T5 高。

### 推論

和 GPT 一樣的自迴歸生成。貪婪／集束／top-p 取樣都適用。集束搜尋（beam search，寬度 4 到 5）是翻譯和摘要的標準，因為輸出分布比聊天窄。

### 2026 年各變體何時選

| 任務 | 用編碼器–解碼器？ | 為什麼 |
|------|------------------|-----|
| 翻譯 | 通常要 | 來源序列清楚；輸出分布固定；集束搜尋行得通 |
| 語音轉文字 | 要（Whisper） | 輸入模態和輸出不同；編碼器把音訊特徵塑形 |
| 聊天／推理 | 不要，只要解碼器 | 沒有一直在的「輸入」——對話本身就是序列 |
| 程式碼補完 | 通常不要 | 長脈絡的純解碼器贏；像 Qwen 2.5 Coder 這樣的程式碼模型是純解碼器 |
| 摘要 | 兩邊都行 | BART、PEGASUS 打贏較早的純解碼器基準模型（baseline）；現代的純解碼器 LLM 追平了它們 |
| 結構化抽取 | 兩邊都行 | T5 乾淨，因為「文字 → 文字」吞得下任何輸出格式 |

大約從 2022 年起的趨勢：純解碼器拿走編碼器–解碼器以前擁有的任務，因為 (a) 做過 instruction tuning 的純解碼器 LLM，靠 prompt 就能泛化（generalization）到任何事，(b) 一種架構比兩種更好縮放，(c) RLHF 假設有一個解碼器。輸入模態不同（語音、影像），或集束搜尋的品質要緊時，編碼器–解碼器還守得住。

```figure
encoder-decoder
```

## Build It｜動手實作

見 `code/main.py`。我們在玩具語料上實作 T5 風格的遮罩區段預測——這一課最重要的單一元件，因為之後每一份編碼器–解碼器預訓練配方都會出現它。

### 步驟 1：遮罩區段預測

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目標格式是 T5 的慣例：`<sent0> span0 <sent1> span1 ...`。被破壞的輸入把沒變的 token 和區段位置上的哨兵 token 交錯排開。

### 步驟 2：驗證來回

給定被破壞的輸入和目標，把原句重建回來。如果你的破壞可逆，前向傳遞就是定義良好的。這是健全檢查——真正的訓練從不做這件事，但這個測試便宜，而且抓得到區段記帳上差一的 bug。

### 步驟 3：BART 加噪

五個函式：`token_mask`、`token_delete`、`text_infill`、`sentence_permute`、`document_rotate`。挑兩個組合起來，把結果秀出來。

## Use It｜實際應用

HuggingFace 參考：

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 的手法：任務名稱寫進輸入文字。同一個模型執行數十種任務，因為每個任務都是文字進、文字出。2026 年這個模式被做過 instruction tuning 的純解碼器模型推廣了，但 T5 最先把它寫成規格。

## Ship It｜交付成果

見 `outputs/skill-seq2seq-picker.md`。這個 skill 依輸入輸出結構、延遲（latency）、品質目標，為新任務在編碼器–解碼器和純解碼器之間做選擇。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`，對一句 30 個 token 的句子做遮罩區段預測，確認把來源裡非哨兵的 token 和譯出的目標區段接起來，會還原成原文。
2. **中等。** 實作 BART 的 `text_infill` 雜訊：把隨機區段換成單一的 `<mask>` token，解碼器必須推斷正確的區段長度加上內容。秀一個例子。
3. **困難。** 在 200 對的迷你英文到 pig Latin 語料上 fine-tune `flan-t5-small`。在留出的 50 對上量 BLEU。和同樣資料、同樣運算下 fine-tune `Llama-3.2-1B` 比。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 編碼器–解碼器 | 「序列到序列的 transformer」 | 兩疊：雙向編碼器處理輸入，帶交叉注意力的因果解碼器處理輸出。 |
| 交叉注意力 | 「來源跟目標說話的地方」 | 解碼器的 Q 乘編碼器的 K／V。編碼器資訊進入解碼器的唯一地方。 |
| 遮罩區段預測 | 「T5 的預訓練手法」 | 把隨機區段換成哨兵 token；解碼器輸出那些區段。 |
| 去噪目標 | 「BART 的遊戲」 | 對輸入加一個雜訊函式，訓練解碼器把乾淨序列重建回來。 |
| 哨兵 token | 「`<extra_id_N>` 佔位符」 | 特殊 token，在來源裡標記被破壞的區段，在目標裡再標一次。 |
| Flan | 「做過 instruction tuning 的 T5」 | T5 在 1800 個以上的任務上 fine-tune；讓編碼器–解碼器在跟著指令走這件事上有競爭力。 |
| 集束搜尋 | 「解碼策略」 | 每一步留下前 k 條部分序列；翻譯和摘要的標準。 |
| teacher forcing | 「訓練時的輸入」 | 訓練時餵給解碼器的是真正的前一個輸出 token，不是抽到的那個。 |

## Further Reading｜延伸閱讀

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) ——T5。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) ——BART。
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) ——Flan-T5。
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) ——Whisper，2026 年標準的編碼器–解碼器。
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) ——參考實作。
