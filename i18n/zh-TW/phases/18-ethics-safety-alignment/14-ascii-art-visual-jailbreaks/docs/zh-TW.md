# ASCII 藝術與視覺越獄攻擊（ASCII Art and Visual Jailbreaks）

> Jiang、Xu、Niu、Xiang、Ramasubramanian、Li 與 Poovendran，《ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs》（ACL 2024，arXiv:2402.11753）。將惡意請求中的敏感關鍵字進行安全遮罩，並將其替換為由 ASCII 字元拼湊繪製出的字體藝術畫，隨後將這份經過隱匿偽裝的 Prompt 發送給目標。實測顯示 GPT-3.5、GPT-4、Gemini、Claude 與 Llama-2 都無法穩健辨識以字元畫呈現的敏感 token。該攻擊可繞過基於困惑度（Perplexity, PPL）的過濾器、Prompt 改寫防禦以及重新分詞（Retokenization）防線。相關研究：ViTC 基準測試衡量模型對非語意視覺提示的辨識能力；StructuralSleight 則將攻擊泛化為一系列「罕見文字編碼結構（Uncommon Text-Encoded Structures, UTES）」編碼攻擊，包括樹、圖與巢狀 JSON。

**Type:** Build
**Languages:** Python (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深入描述 ArtPrompt 攻擊的兩大核心步驟：敏感字詞精準識別、ASCII 藝術字元替換，以及最終偽裝 Prompt 的組裝。
- 深刻解釋為何現有主流防禦手段（PPL 困惑度過濾、改寫防禦、重新分詞）在面對 ArtPrompt 時集體失靈。
- 定義 ViTC 基準測試，並闡明其所度量的核心能力指標。
- 掌握 StructuralSleight 如何將 ASCII 藝術攻擊推廣泛化為針對任意罕見文本編碼結構（UTES）的通用編碼攻擊。

## The Problem｜問題

第 12 節的同義改寫與角色扮演、第 13 節的多樣本長度壓迫，皆是在純文字語義維度展開攻擊。而 ArtPrompt 則將戰場轉移到了「字元識別（Recognition）」維度：模型在處理輸入時，並沒有解析出被禁止的敏感 Token 實體；它解析的是由零散字元拼湊出的視覺圖像。在外部安全過濾器眼中，這是一串完全無害的標點符號與空格；而在模型眼中，這是一張清晰可讀的實體單詞。

## The Concept｜核心概念

### ArtPrompt 兩步攻擊法（ArtPrompt, two steps）

第一步：敏感字詞識別（Word Identification）。面對一個惡意請求，攻擊者首先調用輔助 LLM 抽取出其中觸發安全審查的核心敏感字詞（例如「how to make a bomb」中的「bomb」）。

第二步：偽裝 Prompt 生成（Cloaked Prompt Generation）。將辨識出的敏感詞替換為對應的 ASCII 藝術圖案（通常為 7x5 或 7x7 的標點與空格矩陣，精巧勾勒出字母的外觀輪廓）。目標模型接收到的是由標點符號構成的網格字串，能力足夠的模型能辨識出其中的字詞；而前置的安全過濾網僅能看到一堆無害的標點符號。

實測結論：GPT-4、Gemini、Claude、Llama-2 與 GPT-3.5 都未能穩健識別；在基準測試子集上，攻擊成功率（ASR）超過 75%。

### 為何現有主流防禦機制全面潰敗

- **PPL（困惑度過濾器）**。ASCII 藝術的困惑度很高，但所有新穎輸入也如此。若選擇能阻擋 ArtPrompt 的閾值，也會阻擋合法的結構化輸入。
- **改寫防禦（Paraphrase）**。理論上對 Prompt 進行語意改寫能破壞字元畫。但在實踐中，用於改寫的 LLM 往往會忠實保留或在輸出中重新還原這幅字元畫。
- **重新分詞（Retokenization）**。以不同的 Tokenizer 字典對文字重新切分，絲毫無法阻止模型辨識字母輪廓。

問題的本質在於：現有安全過濾器大多運作在 Token 級或純文本語義級；而 ArtPrompt 運作在視覺辨識層。

### ViTC 基準測試

ViTC 基準測試衡量模型辨識非語意視覺提示的能力，包括讀取 ASCII 藝術、Wingdings 與其他非文字語意視覺內容的能力。ArtPrompt 的有效性與 ViTC 準確率相關：模型越擅長讀取視覺文字，ArtPrompt 在其身上的越獄成功率就越高。這呈現能力與安全之間的取捨。

### StructuralSleight：編碼結構泛化

將 ArtPrompt 泛化為罕見文字編碼結構（Uncommon Text-Encoded Structures, UTES），包括樹、圖、巢狀 JSON、JSON 中的 CSV，以及 diff 風格程式碼區塊。若某種結構在安全訓練資料中很少見，但模型能解析，就可能用它隱藏有害內容。

防禦啟示：系統安全對齊必須能泛化至模型可解析的所有結構化表示。而這個集合目前龐大且在持續膨脹。

### 多模態影像領域的同構攻擊

原生多模態視覺 LLM（GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1）進一步放大了這項威脅。直接以真實圖片的形式發起 ArtPrompt 風格的字體走私攻擊，其效果甚至優於純字元 ASCII 畫，因為影像編碼器會產生更豐富的訊號。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 12 至 14 節確立了三大正交的越獄攻擊維度：自動化迭代精煉（PAIR）、長上下文深度壓迫（MSJ）以及編碼攻擊（ArtPrompt / StructuralSleight）。隨後的第 15 節將從純模型受攻擊面，正式跨入系統邊界攻擊（間接 Prompt 注入）；第 16 節則全面落實防禦工具鏈體系。

```figure
al-ascii-cloak
```

## Use It｜實際應用

`code/main.py` 實作了一套微型 ArtPrompt 工具箱。你可以將惡意查詢中的特定敏感單詞替換為由 ASCII 字元繪製的字形藝術矩陣，驗證偽裝後的字串能否順利穿透關鍵字過濾器；也可選擇使用簡易辨識器將偽裝字串解碼還原。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-encoding-audit.md`。輸入一份企業越獄防禦評測報告，該 Skill 將自動全面審計系統對各類編碼攻擊家族的防禦覆蓋情況（ASCII 藝術字、Base64 編碼、Leet-speak 駭客語、UTF-8 外觀相似字元、UTES 罕見結構），並精確標註攔截各項攻擊的具體防禦架構層次。

## Exercises｜練習

1. 執行 `code/main.py`。驗證經過 ASCII 藝術偽裝的字串能否順利穿透簡單的敏感詞黑名單過濾器。記錄並呈報達成繞過所需的字元級修改量。
2. 實作第二種編碼混淆策略：針對相同的目標單詞進行 Base64 編碼包裝。對比其與 ArtPrompt 在防禦繞過率與後續解碼還原難度上的差異。
3. 仔細研讀 Jiang 等人（2024）原著論文第 4.3 節（五款主流模型的評測結果）。為「Claude 對 ArtPrompt 的抵抗力高於 Gemini」這一現象提出一項合理的底層架構假說。
4. 設計一套前置防禦演算法：在請求送入模型之前，即時偵測輸入文字中是否存在具備 ASCII 藝術畫排版特徵的字元矩陣區塊。量化測量該演算法在常規程式碼、Markdown 表格與數學矩陣公式上的偽陽性誤殺率。
5. StructuralSleight 歸納了 10 種罕見文本結構。為其構思一套能統一應對這 10 種結構的通用防禦架構，並估算每個 prompt 的運算成本。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| ArtPrompt | 「ASCII 藝術攻擊」 | 以 ASCII 藝術圖掩蓋安全敏感詞的兩步驟越獄攻擊 |
| Cloaking | 「隱藏詞語」 | 將禁用 token 替換為模型看得懂、但過濾器無法辨識的視覺表示 |
| UTES | 「罕見結構」 | Uncommon Text-Encoded Structure（罕見文字編碼結構）——用來夾帶內容的樹、圖、巢狀 JSON 等結構 |
| ViTC | 「視覺文字能力」 | 衡量模型讀取非語意視覺編碼能力的基準測試 |
| Perplexity filter | 「PPL 防禦」 | 拒絕困惑度高的 prompts；但合法的結構化輸入也會有高分，因此此方法會失效 |
| Retokenization | 「更換 tokenizer 防禦」 | 使用不同 tokenizer 預先處理 prompt；但因辨識依據是視覺特徵而失效 |
| Homoglyph | 「外觀相似的字元」 | 外觀與拉丁字母相同的 Unicode 字元；可繞過子字串檢查 |

## Further Reading｜延伸閱讀

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — ASCII 藝術越獄原創奠基論文。
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — 罕見結構化文本編碼越獄研究。
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 互補的自動化迭代攻擊。
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) — 互補的長上下文長度攻擊。
