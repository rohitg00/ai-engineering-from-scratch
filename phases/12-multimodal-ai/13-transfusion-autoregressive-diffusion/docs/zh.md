# Transfusion：一個 Transformer 裡的自迴歸文字 + 擴散影像

> Chameleon 與 Emu3 把全部身家押在離散詞元上。它們行得通，但量化瓶頸是看得見的 —— 影像品質在連續空間的擴散模型之下就停滯了。Transfusion（Meta，Zhou 等人，2024 年 8 月）押了反方向的注：讓影像維持連續、徹底捨棄 VQ-VAE，然後用兩個損失訓練同一個 Transformer。文字詞元吃下一個詞元預測。影像 patch 吃流匹配／擴散損失。兩個目標最佳化的是同一組權重。Stable Diffusion 3 底下的那套架構（MMDiT）是它的近親。這一課會讀 Transfusion 的主張、做一個玩具版的雙損失訓練器，並追一遍那個讓單一 Transformer 能同時幹兩份活的注意力遮罩。

**類型：** 實作
**程式語言：** Python (stdlib, two-loss trainer on MNIST-scale toy)
**先修單元：** 階段 12 · 11（Chameleon）、階段 8（生成式 AI）
**時間：** 約 180 分鐘

## 學習目標

- 接出一個在同一個骨幹上跑兩個損失（文字詞元上的 NTP、影像 patch 上的擴散 MSE）的 Transformer。
- 說明為什麼「影像 patch 之間雙向注意力，加上文字詞元之間因果注意力」是對的遮罩選擇。
- 在計算量、品質與程式複雜度上，比較 Transfusion 式（連續影像、擴散損失）與 Chameleon 式（離散影像、NTP）。
- 說出 MMDiT 的貢獻：每個區塊都有模態專屬的權重，並在殘差流上做聯合注意力。

## 問題所在

離散對連續影像詞元的辯論，比 LLM 還要老。連續表徵（原始像素、VAE 潛在向量）保留細節。離散詞元（VQ 索引）貼合 Transformer 原生的詞彙表，卻在量化那一步流失細節。

Chameleon／Emu3 走了離散路線：一個損失、一套架構，但影像保真度被分詞器品質封頂。

擴散模型走了連續路線：影像品質出眾，但那是一個與 LLM 分離的模型，需要複雜的雜訊排程工程，而且無法與文字生成乾淨地整合。

Transfusion 問：我們能不能兩個都要？讓影像維持連續，卻仍然只訓練一個模型，用兩個損失縫進同一次梯度更新。

## 核心概念

### 雙損失架構

單一個純解碼器 Transformer，處理一條包含以下內容的序列：

- 文字詞元（離散，取自 BPE 詞彙表）。
- 影像 patch（連續，16x16 的像素區塊經線性嵌入投影到隱藏維度 —— 與 ViT 編碼器的輸入相同）。
- `<image>` 與 `</image>` 標籤，用來標示連續 patch 的所在位置。

前向傳播只跑一次。損失會依詞元挑選兩個 head 之一：

- 文字詞元：在詞彙表 logits head 上做標準交叉熵。
- 影像 patch：在連續 patch 上做擴散損失 —— 預測加到每個 patch 上的那份雜訊。

梯度流過共享的 Transformer 主體。兩個損失同時改善那組共享權重。

### 注意力遮罩：文字因果 + 影像雙向

文字詞元必須是因果的 —— 你不能讓一個文字詞元去關注未來的文字，否則 teacher forcing 就壞了。但影像 patch 代表的是一張快照；在同一個影像區塊內，它們之間應該是雙向關注彼此。

遮罩是：

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i)   # text attends to images that closed before it
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

訓練與推論時，這都實作成一個區塊三角遮罩。

### Transformer 內部的擴散損失

擴散損失是標準的：對一個影像 patch 加雜訊，要求模型預測那份雜訊（或等價地，預測乾淨的 patch）。Transfusion 的版本用的是流匹配 —— 預測從帶噪到乾淨的速度場。

訓練期間：
1. 對每個影像 patch $x_0$，取樣一個隨機時間步 $t$。
2. 取樣雜訊 $\epsilon$，算出 $x_t = (1-t) \cdot x_0 + t \cdot \epsilon$（流匹配用的線性內插）。
3. Transformer 預測 $v_\theta(x_t, t)$；$\text{loss} = \mathop{\mathrm{MSE}}(v_\theta(x_t, t), \epsilon - x_0)$。
4. 與同一條序列上的文字 NTP 損失一起反向傳播。

推論時，生成是這樣進行的：
- 文字詞元：標準的自迴歸取樣。
- 影像 patch：以前面的文字詞元為條件，跑一個擴散取樣迴圈（典型是 10 到 30 步）。

### MMDiT：Stable Diffusion 3 的變體

Stable Diffusion 3（Esser 等人，2024 年 3 月）在與 Transfusion 差不多的時間出貨了 MMDiT（多模態擴散 Transformer）。這兩套架構是兄弟。

MMDiT 的關鍵差異：

- 每個區塊都有模態專屬的權重。每個 Transformer 區塊，對文字詞元與影像 patch 各有一套獨立的 Q、K、V 與 MLP 權重。注意力是聯合的（跨模態）；其餘一切都是模態專屬的。
- 修正流訓練。一種特定的流匹配變體，取樣方式已知，數學比 DDPM 簡單。
- 規模。MMDiT 是 SD3 的骨幹（有 2B 與 8B 兩種參數變體）。Transfusion 的論文則擴展到 7B。

兩者收斂到同一個核心想法：一個 Transformer 在文字上跑 NTP，在連續的影像表徵上跑擴散。

### 為什麼這勝過 Chameleon 式

在影像生成上，連續擴散與離散 NTP 之間的品質落差是可量測的。Transfusion 論文回報：

- 在 70 億參數下，FID 比同樣大小的 Chameleon 式模型好 3 到 5 分。
- 不需要訓練分詞器 —— 影像編碼器更簡單（線性投影到隱藏維度，與 ViT 的輸入層相同）。
- 推論時能平行化影像 patch 的去噪，這是自迴歸影像詞元做不到的。

缺點：Transfusion 是雙損失模型，訓練動態更棘手。損失權重需要調。NTP 與擴散之間的排程不匹配，可能讓其中一個 head 主導全局。

### 下游有什麼

Janus-Pro（見單元 12.15）精煉了 Transfusion 的想法，把理解與生成的視覺編碼器解耦 —— 一個用 SigLIP、一個用 VQ —— 同時共享 Transformer 主體。Show-o（見單元 12.14）則把擴散換成離散擴散（遮罩預測）。統一生成這個家族在 Transfusion 之後迅速分岔。

那些能原生輸出影像的閉源生產級模型，或許用的是這個家族的某個後裔，但它們的架構並未公開，所以任何這類說法都只能當作猜測。

```figure
cfg-guidance-scale
```

## 框架應用

`code/main.py` 在一個迷你的類 MNIST 問題上，做了一個玩具版的 Transfusion：

- 文字字幕是描述某個數字（0 到 9）的短整數序列。
- 影像是 4x4 的位元組網格。
- 一對共享權重的線性投影充當 Transformer 的替身；文字上跑 NTP 損失，帶噪 patch 上跑 MSE 損失。
- 訓練迴圈交替執行兩個損失，注意力遮罩是明確寫出來的。
- 一個遮罩示範會印出「文字、影像、文字」序列的區塊三角注意力樣式。程式不跑生成：真正的取樣器會先逐詞元解碼文字，再用許多步對影像 patch 去噪，下面的練習會算出要幾步。

那個 Transformer 是玩具。真正的成品是雙損失的接線、注意力遮罩的建構，以及推論迴圈。

## 產出交付

這一課產出 `outputs/skill-two-loss-trainer-designer.md`。給定一項新的多模態訓練任務（文字 + 影像、文字 + 音訊、文字 + 影片），它會設計出雙損失的排程（損失權重、遮罩形狀、共享區塊對模態專屬區塊），並標記出實作上的風險。

## 練習

1. 一個 Transfusion 風格的模型，訓練資料有 70% 文字詞元與 30% 影像 patch。影像擴散損失的量級大約是文字 NTP 損失的 10 倍。什麼樣的損失權重能讓兩者平衡？

2. 為序列 `[T, T, <image>, P, P, P, P, </image>, T]` 實作那個區塊三角遮罩。把每一格標成 0 或 1。

3. MMDiT 有模態專屬的 QKV 權重。相較於 Transfusion 完全共享的 Transformer，這增加了多少參數量的額外開銷？在 70 億參數下，這值得嗎？

4. 生成流程：給定一段文字提示詞，模型先跑 50 個詞元的 NTP，接著碰到 `<image>`，然後在 256 個 patch 上跑 20 步去噪的擴散。總共要跑幾次前向傳播？

5. 讀 SD3 論文第 3 節。描述修正流，以及它為什麼能用比 DDPM 更少的推論步數收斂。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|------------------------|
| 雙損失訓練 | 「NTP + 擴散」 | 單一 Transformer 在同一次梯度更新中，同時最佳化文字詞元上的交叉熵與連續影像 patch 上的 MSE |
| 流匹配 | 「修正流」 | 一種擴散變體，預測從雜訊到乾淨資料的速度場；數學比 DDPM 簡單 |
| MMDiT | 「多模態 DiT」 | Stable Diffusion 3 的架構：聯合注意力，加上模態專屬的 MLP 與正規化層 |
| 區塊三角遮罩 | 「文字因果 + 影像雙向」 | 一種注意力遮罩，跨文字時是因果的，在影像區域內部則是雙向的 |
| 連續影像表徵 | 「不用 VQ」 | 把影像 patch 表示成實數值向量，而非整數的碼本索引 |
| 速度預測 | 「v 參數化」 | 網路輸出的是雜訊與資料之間的速度場，而不是雜訊本身 |

## 延伸閱讀

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
