# 音訊語言模型 —— Qwen2.5-Omni、Audio Flamingo、GPT-4o Audio

> 2026 年的音訊語言模型能對語音 + 環境聲 + 音樂做推論。Qwen2.5-Omni-7B 在 MMAU-Pro 上追平 GPT-4o Audio。Audio Flamingo Next 在 LongAudioBench 上勝過 Gemini 2.5 Pro。開源與封閉之間的差距基本上已經拉平了 —— 唯一例外是多段音訊的任務，那裡大家都接近亂猜。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 6 · 04（ASR）、階段 12 · 03（視覺語言模型）、階段 7 · 10（音訊 Transformer）
**時間：** 約 45 分鐘

## 問題所在

你有 5 秒的音訊：狗在叫、有人喊「stop!」，然後一片安靜。有用的問題橫跨好幾個面向：

- **轉錄。** 「剛剛說了什麼？」—— 這是 ASR 的地盤。
- **語意推論。** 「這個人有危險嗎？」—— 需要把狗叫聲 + 喊叫 + 安靜合起來一起理解。
- **音樂推論。** 「旋律是由哪些樂器演奏的？」
- **長音訊檢索。** 「這場 90 分鐘的講座裡，講師是在哪裡解釋梯度下降的？」

能用一個提示詞把上面全部回答掉的單一模型，就是**音訊語言模型**（LALM／ALM）。它和純 ASR 不同：LALM 產出的是自由形式的自然語言答案，不只是逐字稿。

## 核心概念

![音訊語言模型：音訊編碼器 + 投影器 + LLM 解碼器](../assets/alm-architecture.svg)

### 三個元件的樣板

2026 年每一個 LALM 都是同樣的骨架：

1. **音訊編碼器。** Whisper 編碼器 · BEATs · CLAP · WavLM · 或各模型自訂的編碼器。
2. **投影器。** 線性層或 MLP，把音訊編碼器的特徵橋接到 LLM 的詞元嵌入空間。
3. **LLM。** 基於 Llama／Qwen／Gemma 的解碼器。吃交錯排列的文字 + 音訊詞元；生成文字。

訓練：

- **階段 1。** 凍結編碼器 + LLM；只用 ASR／字幕描述資料訓練投影器。
- **階段 2。** 在指令跟隨的音訊任務（問答、推論、音樂理解）上做完整或 LoRA 微調。
- **階段 3（選擇性）。** 語音進、語音出，要再加一個語音解碼器。Qwen2.5-Omni 與 AF3-Chat 就是這樣做的。

### 2026 年的模型地圖

| 模型 | 骨幹 | 音訊編碼器 | 輸出模態 | 取得方式 |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | 自訂 + Whisper | 文字 + 語音 | Apache-2.0 |
| Qwen3-Omni | Qwen3 | 自訂 | 文字 + 語音 | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | 文字 | NVIDIA 非商業 |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | 文字 | NVIDIA 非商業 |
| SALMONN | Vicuna | Whisper + BEATs | 文字 | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | 文字 | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | 文字 | Apache-2.0 |
| Gemini 2.5 Flash/Pro（不公開） | Gemini | 專有 | 文字 + 語音 | API |
| GPT-4o Audio（不公開） | GPT-4o | 專有 | 文字 + 語音 | API |

### 基準測試的現實檢查（2026）

**MMAU-Pro。** 1800 組問答，涵蓋語音／聲音／音樂／混合。含多段音訊的子集。

| 模型 | 總分 | 語音 | 聲音 | 音樂 | 多段音訊 |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | LongAudioBench 上的 SOTA | — | — | — | — |

**多段音訊那一欄對所有人都很難看。** 四選一的選擇題亂猜就有 25%；多數模型的分數就在那附近。LALM 至今還是很難比較兩段片段。

### 2026 年 LALM 有用的地方

- **客服中心錄音的合規稽核。** 「客服有沒有提到規定必須揭露的內容？」
- **無障礙。** 為聽障使用者描述聲音事件（不只是轉錄）。
- **內容審核。** 偵測暴力字眼 + 威脅性語氣 + 背景情境。
- **播客／會議分章。** 語意層級的摘要，不只是誰講到哪一段。
- **音樂曲庫分析。** 「找出所有在 B 段轉調的曲子。」

### 目前還沒用的地方

- 細緻的樂理（比和弦層級更細的）。
- 長對話中帶說話人歸屬的推論（超過 10 分鐘就退化）。
- 多段音訊的比較（22–26% 只是勉強高於亂猜）。
- 即時串流的推論（多數還是離線的批次推論）。

```figure
v4-alm-tokens
```

## 動手實作

### 步驟 1：查詢 Qwen2.5-Omni

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### 步驟 2：投影器的模式

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

就這樣。投影器通常就是 1–3 層線性層。用 ASR 配對資料（音訊 → 逐字稿）訓練它，就是階段 1 的前置任務。

### 步驟 3：跑 MMAU／LongAudioBench 的基準測試

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path` 指向資料集 repo 裡的 `data.zip`（約 47 GB），所以計分前要先下載並解壓縮。這個完全比對的迴圈只是健全性檢查，不是基準測試的計分器，所以它的數字不能和公開發表的 MMAU-Pro 結果相比。官方評估器用嵌入相似度（NV-Embed-v2）比對選擇題答案，用 LLM 評審為開放式答案評分，並用 regex 規則檢查遵循指令類的答案：把預測寫進 `model_output` 欄位，再執行 [MMAU-Pro repo](https://github.com/sonalkum/MMAUPro) 裡的 `evaluate_mmau_pro_comprehensive.py`。每個 `category`（speech、sound、music、multi 以及其餘類別）都要分開回報。彙總的數字會蓋掉模型到底在哪裡失敗。

## 框架應用

| 任務 | 2026 年怎麼選 |
|------|-----------|
| 自由形式的音訊問答（開源） | Qwen2.5-Omni-7B |
| 長音訊上最強的開源 | Audio Flamingo Next |
| 最強的封閉模型 | Gemini 2.5 Pro |
| 語音進、語音出的代理程式 | Qwen2.5-Omni 或 GPT-4o Audio |
| 音樂推論 | Audio Flamingo 3 或 2（音樂特化的 AF-CLAP） |
| 客服中心稽核 | 透過 API 用 Gemini 2.5 Pro，再對你的政策文件做 RAG |

## 陷阱

- **在多段音訊上過度信任。** 如果你的任務需要回答「哪一段片段有 X」，那個接近亂猜的效能是真的。
- **長音訊退化。** 超過 10 分鐘，多數模型的說話人歸屬就壞掉了。先做語者分段（第 6 課），再做摘要。
- **對安靜段落產生幻覺。** 用 Whisper 編碼器的 LALM 會繼承同樣的 Whisper 老問題。用 VAD 把關。
- **基準測試挑好看的講。** 廠商的部落格文章只會強調表現最好的類別。MMAU-Pro 的多段音訊子集要自己跑一遍。

## 產出交付

存成 `outputs/skill-alm-picker.md`。針對指定的音訊理解任務，挑選 LALM + 基準測試子集 + 輸出模態（文字或語音）。

## 練習

1. **簡單。** 跑 `code/main.py`，看一個玩具版的投影器模式，以及假的 LALM 如何把（音訊嵌入、文字詞元）繞送成輸出詞元。
2. **中等。** 在 100 題 MMAU-Pro 語音題上為 Qwen2.5-Omni-7B 計分。和論文回報的數字比對。
3. **困難。** 打造一個最小的音訊字幕描述基準線：BEATs 編碼器 + 2 層投影器 + 凍結的 Llama-3.2-1B。只在 AudioCaps 上微調投影器。在 Clotho-AQA 上和 SALMONN 比較。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| LALM | 音訊版的 ChatGPT | 音訊編碼器 + 投影器 + LLM 解碼器。 |
| 投影器 | 適配器 | 把音訊特徵映射進 LLM 嵌入空間的小型 MLP。 |
| MMAU | 那個基準測試 | 一萬組音訊問答，橫跨語音、聲音、音樂。 |
| MMAU-Pro | 更難的 MMAU | 1800 題偏多段音訊／重推論的問題。 |
| LongAudioBench | 長篇評估 | 好幾分鐘長的片段搭配語意查詢。 |
| 語音進／語音出 | 原生語音 | 模型直接吃語音、直接吐語音，不繞道文字。 |

## 延伸閱讀

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) —— 參考架構。
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) —— 語音進、語音出。
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) —— 開源的長音訊領先者。
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) —— LongAudioBench 的 SOTA。
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) —— 雙編碼器的先行者。
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) —— 2026 年的即時排名。
