# ASCII 藝術與視覺越獄

> Jiang、Xu、Niu、Xiang、Ramasubramanian、Li、Poovendran，〈ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs〉（ACL 2024，arXiv:2402.11753）。把有害請求裡與安全相關的詞元遮起來，換成同樣字母的 ASCII 藝術圖樣，再把這段偽裝過的提示詞送出去。GPT-3.5、GPT-4、Gemini、Claude、Llama-2 都無法穩健地辨識 ASCII 藝術詞元。這種攻擊繞得過 PPL（困惑度過濾器）、改寫式防禦與重新分詞。相關研究：ViTC 基準量測對非語意視覺提示詞的辨識能力；StructuralSleight 則把它推廣到罕見文字編碼結構（樹、圖、巢狀 JSON），成為一整族編碼攻擊。

**類型：** 實作
**程式語言：** Python (stdlib, ArtPrompt token-masking harness)
**先修單元：** 階段 18 · 12（PAIR）、階段 18 · 13（MSJ）
**時間：** 約 60 分鐘

## 學習目標

- 描述 ArtPrompt 攻擊：詞彙辨識步驟、ASCII 藝術替換、最終的偽裝提示詞。
- 解釋為何標準防禦（PPL、改寫、重新分詞）在 ArtPrompt 上會失效。
- 定義 ViTC，並描述它量的是什麼。
- 把 StructuralSleight 描述成對任意罕見文字編碼結構的推廣。

## 問題所在

透過改寫與角色扮演的攻擊（第 12 課）以及透過長脈絡的攻擊（第 13 課），操作的是文字層級的樣式。ArtPrompt 操作在辨識層級：模型並沒有去剖析那個被禁的詞元。它剖析的是一張用字元畫出來的圖。安全過濾器看到的是無害的標點符號。模型看到的是一個詞。

## 核心概念

### ArtPrompt，兩個步驟

第一步。詞彙辨識。給定一則有害請求，攻擊者用一個 LLM 去辨識出與安全相關的詞（例如「how to make a bomb」裡的 "bomb"）。

第二步。生成偽裝提示詞。把每一個被辨識出來的詞，換成它的 ASCII 藝術圖樣（一塊 7x5 或 7x7、由字元排成字母形狀的區塊）。模型收到的是一格格的標點與空白，而一個夠有能力的模型認得出那是什麼字；安全過濾器卻只看到那些格子。

結果：GPT-4、Gemini、Claude、Llama-2、GPT-3.5 全都失守。在他們的基準子集上，攻擊成功率超過 75%。

### 為什麼標準防禦會失效

- **PPL（困惑度過濾器）。** ASCII 藝術的困惑度很高 —— 但所有新奇輸入也都是。能擋下 ArtPrompt 的門檻設定，也會擋掉正當的結構化輸入。
- **改寫。** 把提示詞改寫一遍會破壞掉 ASCII 藝術。但實務上，改寫用的 LLM 常常會保住、甚至重建那張圖。
- **重新分詞。** 換一種方式切詞，並不改變「模型的視覺正在辨識字母形狀」這件事。

底層的問題在於：安全過濾器運作在詞元或語意層級；ArtPrompt 運作在視覺辨識層級。

### ViTC 基準

對非語意視覺提示詞的辨識能力。它量測模型讀取 ASCII 藝術、Wingdings 字型，以及其他非文字語意視覺內容的能力。ArtPrompt 的有效程度與 ViTC 準確率相關：模型愈會讀視覺化的文字，ArtPrompt 對它就愈有效。這是一個能力與安全之間的取捨。

### StructuralSleight

把 ArtPrompt 推廣開來：罕見文字編碼結構（UTES）。樹、圖、巢狀 JSON、JSON 裡包 CSV、diff 風格的程式碼區塊。只要某個結構在訓練用的安全資料裡很罕見、而模型又剖析得了，它就能藏有害內容。

防禦上的意涵：安全性必須跨越「模型剖析得了的所有結構化表示法」而類推。那個集合很大，而且還在長。

### 影像模態的類比

視覺 LLM（GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1）擴大了攻擊面。用真正影像的 ArtPrompt 式攻擊，比 ASCII 藝術的類比版更強，因為影像編碼器產出的訊號更豐富。

### 這在階段 18 裡的位置

第 12-14 課描述三條正交的攻擊向量：迭代精煉（PAIR）、脈絡長度（MSJ），以及編碼（ArtPrompt/StructuralSleight）。第 15 課從以模型為中心的攻擊，轉向系統邊界上的攻擊（間接提示詞注入）。第 16 課描述防禦工具那一側的回應。

```figure
al-ascii-cloak
```

## 框架應用

`code/main.py` 建出一個玩具型的 ArtPrompt。你可以把一則有害查詢裡的特定詞用 ASCII 藝術字元偽裝起來、驗證那段偽裝字串通得過關鍵字過濾器，並（選擇性地）用一個簡單的辨識器把偽裝字串解回來。

## 產出交付

這一課產出 `outputs/skill-encoding-audit.md`。給定一份越獄防禦報告，它會列舉涵蓋到的編碼攻擊家族（ASCII 藝術、base64、火星文、UTF-8 同形字、UTES），以及攔下每一種的那道防禦層。

## 練習

1. 跑 `code/main.py`。驗證那段偽裝字串通得過一個簡單的關鍵字過濾器。回報所需的字元層級改動量。

2. 對同一個目標詞實作第二種編碼：base64。比較它與 ArtPrompt 的過濾器繞過率，以及還原難度。

3. 讀 Jiang 等人 2024 年的 4.3 節（五個模型的結果）。提出一個理由，說明為何在同一份基準上 Claude 對 ArtPrompt 的抗性高於 Gemini。

4. 設計一套生成前的防禦，偵測提示詞中呈 ASCII 藝術形狀的區域。在正當的程式碼、表格與數學符號上量測它的偽陽性率。

5. StructuralSleight 列出了 10 種編碼結構。勾勒一套能處理全部 10 種的通用防禦，並估算每則被防護提示詞的運算成本。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| ArtPrompt | 「那個 ASCII 藝術攻擊」 | 用 ASCII 藝術圖樣遮住安全詞彙的兩步驟越獄 |
| 偽裝 | 「把那個詞藏起來」 | 把被禁詞元換成一種「模型讀得懂、過濾器讀不懂」的視覺表示 |
| UTES | 「罕見結構」 | 罕見文字編碼結構 —— 樹、圖、巢狀 JSON 等，用來夾帶內容 |
| ViTC | 「視覺文字能力」 | 量測模型讀取非語意視覺編碼之能力的基準 |
| 困惑度過濾器 | 「PPL 防禦」 | 拒絕高困惑度的提示詞；會失效是因為正當的結構化輸入分數也高 |
| 重新分詞 | 「換分詞器的防禦」 | 用另一套分詞器預先處理提示詞；會失效是因為辨識是視覺性的 |
| 同形字 | 「長得一樣的字元」 | 看起來與拉丁字母完全相同的 Unicode 字元；繞得過子字串檢查 |

## 延伸閱讀

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) —— ASCII 藝術越獄那篇論文
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) —— UTES 的推廣
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) —— 互補的迭代攻擊
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) —— 互補的長度攻擊
