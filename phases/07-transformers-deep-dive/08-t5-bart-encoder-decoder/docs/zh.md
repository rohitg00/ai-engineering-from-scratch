# T5、BART —— 編碼器解碼器模型

> 編碼器負責理解，解碼器負責生成。把兩者接回去，你就得到一個為「輸入 → 輸出」任務而生的模型：翻譯、摘要、改寫、轉錄。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 7 · 05（完整的 Transformer）、階段 7 · 06（BERT）、階段 7 · 07（GPT）
**時間：** 約 45 分鐘

## 問題所在

只有解碼器的 GPT 與只有編碼器的 BERT，各自為了不同目標把 2017 年的架構削掉一半。但許多任務天生就是輸入對輸出：

- 翻譯：英文 → 法文。
- 摘要：5,000 個詞元的文章 → 200 個詞元的摘要。
- 語音辨識：音訊詞元 → 文字詞元。
- 結構化抽取：散文 → JSON。

對這些任務，編碼器解碼器架構是最貼合的選擇。編碼器產生來源內容的稠密表示，解碼器在每一步都對這份表示做交叉注意力，一邊生成輸出。訓練時在輸出端做位移一格的預測 —— 損失函式和 GPT 一樣，只是多了以編碼器輸出為條件。

有兩篇論文定義了現代的做法：

1. **T5**（Raffel et al. 2019）。「Text-to-Text Transfer Transformer」。把每個 NLP 任務都重新表述成文字進、文字出。單一架構、單一詞彙表、單一損失函式。預訓練採用遮罩片段預測（在輸入中破壞若干片段，在輸出中把它們解碼出來）。
2. **BART**（Lewis et al. 2019）。「Bidirectional and Auto-Regressive Transformer」。一個去噪自編碼器：用多種方式破壞輸入（打亂、遮罩、刪除、旋轉），再要求解碼器重建原文。

在 2026 年，編碼器解碼器格式仍活躍於「輸入結構很重要」的場景：

- Whisper（語音 → 文字）。
- Google 的翻譯技術堆疊。
- 部分具有明確「脈絡與編輯」結構的程式碼補全／修復模型。
- 用於結構化推理任務的 Flan-T5 及其變體。

只有解碼器的架構搶下了鎂光燈，但編碼器解碼器從來沒有消失。

## 核心概念

![帶交叉注意力的編碼器解碼器架構](../assets/encoder-decoder.svg)

### 前向流程

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

關鍵在於：編碼器對每個輸入只跑一次。解碼器則自迴歸地逐步生成，但每一步都對*同一份*編碼器輸出做交叉注意力。把編碼器輸出快取起來，對長輸入來說是不花成本的加速。

### T5 的預訓練 —— 片段破壞（span corruption）

隨機挑選輸入中的若干片段（平均長度 3 個詞元，總計約 15%）。把每個片段換成一個唯一的哨兵詞元：`<extra_id_0>`、`<extra_id_1>` 等等。解碼器只輸出被破壞的片段，並在前面帶上對應的哨兵：

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

這比預測整個序列的訊號成本更低。在 T5 論文的消融實驗中，其效果與 MLM（BERT）和 prefix-LM（UniLM）相當。

### BART 的預訓練 —— 多重噪聲去噪

BART 嘗試了五種加噪函式：

1. 詞元遮罩。
2. 詞元刪除。
3. 文字填補（遮住一個片段，由解碼器補回正確的長度）。
4. 句子重排。
5. 文件旋轉。

把「文字填補」加上「句子重排」組合起來，得到最好的下游表現。解碼器一律重建原始序列。BART 的輸出是完整序列，而不只是被破壞的片段 —— 因此預訓練的運算量比 T5 高。

### 推論

和 GPT 一樣是自迴歸生成，貪婪解碼、beam search、top-p 取樣都適用。翻譯與摘要通常採用 beam search（寬度 4 到 5），因為這類任務的輸出分布比聊天窄得多。

### 2026 年該怎麼選

| 任務 | 用編碼器解碼器？ | 原因 |
|------|------------------|-----|
| 翻譯 | 通常是 | 來源序列明確；輸出分布固定；beam search 有效 |
| 語音轉文字 | 是（Whisper） | 輸入模態與輸出不同；編碼器負責整理音訊特徵 |
| 聊天／推理 | 否，用只有解碼器的架構 | 沒有持續存在的「輸入」—— 整段對話就是那個序列 |
| 程式碼補全 | 通常不用 | 長脈絡的只有解碼器架構勝出；Qwen 2.5 Coder 這類程式碼模型都是只有解碼器 |
| 摘要 | 兩者皆可 | BART、PEGASUS 曾勝過早期只有解碼器的基準；現代的只有解碼器 LLM 已能追平 |
| 結構化抽取 | 兩者皆可 | T5 很乾淨，因為「文字 → 文字」可以吸收任何輸出格式 |

大約從 2022 年起的趨勢：只有解碼器的架構接手了原本屬於編碼器解碼器的任務，原因是 (a) 經過指令微調的只有解碼器 LLM 靠提示就能泛化到任何任務，(b) 一種架構比兩種更容易擴展，(c) RLHF 預設模型是解碼器。編碼器解碼器則守住兩塊陣地：輸入模態與輸出不同時（語音、影像），以及 beam search 的品質很要緊時。

## 動手實作

請看 `code/main.py`。我們實作 T5 風格的片段破壞，套用在一個玩具語料上 —— 這是本單元最值得帶走的一塊，因為此後每一份編碼器解碼器的預訓練配方裡都看得到它。

### 步驟 1：片段破壞

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目標端的格式沿用 T5 的慣例：`<sent0> span0 <sent1> span1 ...`。被破壞的輸入則是把未變動的詞元與片段位置上的哨兵詞元交錯排列。

### 步驟 2：驗證能否還原

給定被破壞的輸入與目標，把原句還原回來。如果你的破壞是可逆的，前向傳播就是定義良好的。這只是個健全性檢查 —— 真正的訓練不會做這件事，但這個測試很便宜，而且能抓出片段記帳時的差一錯誤。

### 步驟 3：BART 加噪

五個函式：`token_mask`、`token_delete`、`text_infill`、`sentence_permute`、`document_rotate`。挑其中兩個組合起來，把結果印出來看。

## 框架應用

HuggingFace 的參考寫法：

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 的巧妙之處：任務名稱直接寫進輸入文字裡。同一個模型能處理數十種任務，因為每個任務都是文字進、文字出。到了 2026 年，這個模式已被經過指令微調的只有解碼器模型全面推廣，但最先把它法典化的是 T5。

## 產出交付

請看 `outputs/skill-seq2seq-picker.md`。這項技能會依輸入輸出結構、延遲與品質目標，替一個新任務在編碼器解碼器與只有解碼器之間做選擇。

## 練習

1. **簡單。** 執行 `code/main.py`，對一個 30 個詞元的句子套用片段破壞，並驗證把來源中非哨兵的詞元與解碼出的目標片段接回去，能重現原句。
2. **中等。** 實作 BART 的 `text_infill` 噪聲：把隨機片段換成單一個 `<mask>` 詞元，讓解碼器自行推斷正確的片段長度與內容。示範一個例子。
3. **困難。** 用一個很小的「英文 → 豬拉丁文」語料（200 組配對）微調 `flan-t5-small`，在另外保留的 50 組配對上量測 BLEU。再用同樣的資料與同樣的運算量微調 `Llama-3.2-1B`，兩者互相比較。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 編碼器解碼器 | 「seq2seq transformer」 | 兩疊網路：處理輸入的雙向編碼器，以及帶交叉注意力、處理輸出的因果解碼器。 |
| 交叉注意力 | 「來源跟目標對話的地方」 | 解碼器的 Q 乘上編碼器的 K／V。這是編碼器資訊進入解碼器的唯一入口。 |
| 片段破壞 | 「T5 的預訓練把戲」 | 把隨機片段換成哨兵詞元，再由解碼器輸出這些片段。 |
| 去噪目標 | 「BART 玩的那套」 | 對輸入套用一個噪聲函式，訓練解碼器重建乾淨的序列。 |
| 哨兵詞元 | 「那個 `<extra_id_N>` 佔位符」 | 特殊詞元，在來源中標記被破壞的片段，並在目標中重新標記它們。 |
| Flan | 「經過指令微調的 T5」 | 在超過 1,800 個任務上微調過的 T5；讓編碼器解碼器在遵循指令這件事上重回競爭。 |
| Beam search | 「一種解碼策略」 | 每一步保留分數最高的 k 條部分序列；翻譯與摘要的標準做法。 |
| Teacher forcing | 「訓練時的輸入方式」 | 訓練期間餵給解碼器的是真正的前一個輸出詞元，而不是模型自己取樣出來的。 |

## 延伸閱讀

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) —— T5。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) —— BART。
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) —— Flan-T5。
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) —— Whisper，2026 年最具代表性的編碼器解碼器模型。
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) —— 參考實作。
