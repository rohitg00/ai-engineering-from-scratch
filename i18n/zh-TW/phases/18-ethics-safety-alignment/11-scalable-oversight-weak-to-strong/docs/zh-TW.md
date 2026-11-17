# 可擴展監督與弱到強泛化（Scalable Oversight and Weak-to-Strong Generalization）

> Burns 等人（OpenAI 超級對齊團隊，「Weak-to-Strong Generalization」，2023）為超級對齊（Superalignment）難題提出了一項實證代理框架：使用由弱模型產出的標籤，對強模型進行 fine-tuning。若強模型能從充滿瑕疵的不完美弱監督中正確泛化，那麼現有適用於人類尺度的對齊方法，可能延伸至超人類系統。可擴展監督（Scalable Oversight）與弱到強泛化（W2SG）互補。可擴展監督（辯論機制、遞迴獎勵建模、任務拆解）透過技術手段實質提升監督者的有效認知能力，使其能跟上受監督模型的智力步伐；而 W2SG 則讓強模型能從監督者提供的不完美監督中正確泛化。2025 年 1 月的研究《Debate Helps W2SG》（arXiv:2501.13124）將兩者結合。

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 精準定義可擴展監督（Scalable oversight）與弱到強泛化（Weak-to-Strong Generalization, W2SG），並深刻解釋兩者為何在架構上高度互補。
- 深入描述 Burns 等人 2023 年經典實驗的底層配置：使用 GPT-2 產出的粗糙標籤來 fine-tuning 監督 GPT-4。
- 解釋「彌合效能差距比例（Performance Gap Recovered, PGR）」指標的數學定義及其所衡量的核心本質。
- 梳理三大主流可擴展監督機制（辯論機制、遞迴獎勵建模、任務層級拆解），並分別指出每一種機制的一項優勢。

## The Problem｜問題

Phase 18 目前為止探討的每一種對齊技術，都假設監督者有能力評估受監督模型的行為。然而當受監督模型的能力超越人類時，監督者自身便成為整個系統中最薄弱的環節。超級對齊的核心命題在此浮現：一個能力較弱的監督者，能否可靠地產出能力更強、且已對齊的模型？

Burns 等人將這個問題轉化為可操作的實證設定：用弱模型監督強模型，衡量強模型有多少能力能在弱監督下保留下來。這並非超級對齊的解決方案，而是一個衡量進展的代理指標。

## The Concept｜核心概念

### 弱到強泛化（W2SG）：Burns 等人的實驗框架（W2SG: the Burns et al. setup）

- 弱模型（Weak model）：GPT-2 等級。
- 強模型（Strong model）：GPT-4 等級。
- 目標天花板：GPT-4 在該任務上由黃金真實標籤監督所能達到的能力極限。

實驗執行流程：
1. 取得弱模型在某項特定任務上的零樣本（Zero-shot）預測標籤。
2. 使用這些由弱模型生成的充滿噪聲與錯誤的標籤，對強模型進行監督式 fine-tuning。
3. 測量經過弱監督 fine-tuning 後的強模型準確率。

對照基準線：弱模型自身的原生準確率、強模型在純黃金標籤監督下的理想天花板。

關鍵度量指標：**彌合效能差距比例（Performance Gap Recovered, PGR）** = (fine-tuned - weak) / (ceiling - weak)。PGR 為 1.0 代表弱監督完全彌合了差距；PGR 為 0 則代表弱監督沒有幫助。

### Burns 等人的關鍵實證發現（Burns et al. empirical findings）

在自然語言處理（NLP）、西洋棋殘局謎題以及獎勵模型訓練等廣泛任務中，PGR 一貫為正：強模型成功展現出了超越弱監督者錯誤的卓越泛化能力。不同任務上的 PGR 介於約 20% 至 80% 之間。這顯示強模型能從不完美標籤中「理解」預期任務，並以預訓練先驗補足。

Burns 等人坦誠指出的架構局限性：
- 此處的弱到強差距是能力差距，而非對齊差距。弱模型已對齊；真正的超人類模型或許也能由人類對齊，但能力差距會大得多。
- 強模型的泛化可能更多來自特定任務的先驗，而非還原真實標註意圖。
- 真正棘手的核心命題在於如何精準引導出強模型的潛在知識（Latent knowledge）；PGR 僅僅衡量了一項特定的實操指標。

### 可擴展監督的三大主流機制（Scalable oversight: three mechanisms）

- **辯論機制（Debate，Irving 等人，2018）**。由兩個不可信強模型 U 針對問題分別擔任正反方展開激烈交叉質詢；由弱裁判作出判斷。其底層核心假設：在客觀事實面前，為真實真理辯護的難度，遠低於為謊言狡辯的難度。2024 至 2025 年的最新實證研究（Khan 等人，Michael 等人）表明：辯論有時有幫助，有時則沒有，是否有幫助取決於任務結構。
- **遞迴獎勵建模（Recursive Reward Modeling, RRM，Leike 等人，2018）**。由當前的強模型 U 輔助人類專家去訓練下一個更強模型 U+1 的獎勵模型。監督者的有效評估能力隨著被監管模型的迭代而同步水漲船高。
- **任務層級拆解（Task Decomposition，Christiano、Shlegeris 與 Amodei，2018）**。將困難任務遞迴拆解為人類可以檢查的子任務。核心假設：任務可分解。

上述每一種機制，皆對任務結構或中間元件的對齊狀態建立特定的先驗假設。

### 為何可擴展監督與 W2SG 高度互補（Why scalable oversight and W2SG are complementary）

可擴展監督致力於在輸入端提高監督者所能提供的有效訊號品質。
弱到強泛化（W2SG）則彌補監督者所能提供的不完美訊號造成的差距。

Lang 等人發表的《Debate Helps Weak-to-Strong Generalization》（arXiv:2501.13124）將兩者結合：透過引入辯論協定產出較好的弱標籤，隨後將其餵給強模型進行 W2SG 訓練。研究回報這種方法在 NLP 任務上帶來 PGR 提升。

### 組織架構劇變與研究火種延續（The organizational drama）

OpenAI 官方設立的超級對齊團隊（Superalignment team）隨著負責人 Jan Leike 於 2024 年 5 月離職轉投 Anthropic 而宣告正式解散。然而該團隊確立的核心研究議程（可擴展監督、弱到強泛化、自動化對齊研究）持續在 Anthropic 與學術實驗室進行——包括 MATS（第 28 節）、Redwood（第 10 節）、Apollo（第 08 節）與 METR（第 28 節）。組織結構改變了，研究問題沒有改變。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 06 至 10 節確立了威脅建模與防禦典範（假設 U 不可信）。第 11 節是攻勢典範：讓監督者有足夠能力驗證 U 是否對齊。隨後的第 12 至 16 節將全面轉入對抗性實戰評測工具鏈的具體打磨。

```figure
scalable-oversight
```

## Use It｜實際應用

`code/main.py` 在一個合成任務中模擬了 W2SG 弱到強泛化流程。弱標註員具備 70% 的準確率且帶有結構化系統偏誤；強模型在黃金標籤上的理想天花板為 95%。程式模擬使用弱標籤對強模型進行 fine-tuning，精確度量其最終斬獲的 PGR 數值，並將其與「強模型純黃金監督」及「弱模型單打獨鬥」進行多維度橫向對照。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-w2sg-pgr.md`。輸入一套特定的監督體系架構描述，該 Skill 將自動梳理標定出系統中的弱監督者、受監督強模型與訊號品質指標，精確計算（或引導測量）PGR 數值，並明確判定該研究宣稱究竟屬於單純的「弱模型直接監督強模型」，還是「弱模型搭配可擴展機制協同監督強模型」。

## Exercises｜練習

1. 執行 `code/main.py`。分別在弱標註員準確率為 0.60、0.70 與 0.80 條件下度量最終的 PGR 指標。解釋 PGR 曲線的形狀。
2. 修改弱標註員的錯誤生成邏輯，使其帶有結構化錯誤（例如在特定輸入類別上總是預測錯誤）。強模型的 PGR 是會上升、下降還是保持不變？給出原理解釋。
3. 仔細研讀 Burns 等人（2023）原著論文第 4.3 節（NLP 基準測試）。重現其「置信度輔助損失函數（Confidence auxiliary loss）」的直覺核心：當強模型自身的預測置信度顯著超越弱標籤時，最佳化器究竟聽誰的？
4. 為一項複雜的軟體工程架構設計任務，起草一套結合了「辯論機制」與「任務層級拆解」的複合可擴展監督協定。分別指出這兩個元件各自最容易爆發的失效模式，並說明組合如何處理或未能處理各自的失效模式。
5. 深入辯論「弱到強泛化是一條通往超級對齊的可行道路」這一核心論斷。從實證科學的視角，寫下需要出現何種確鑿的反面特徵證據，才能真正全盤證偽該技術路徑？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Scalable oversight | 「讓監督者更強」 | 提升監督者評估能力更強模型之能力的機制 |
| W2SG | 「弱模型監督強模型」 | 使用弱模型標籤對強模型進行 fine-tuning，並衡量強模型保留了多少能力 |
| PGR | 「彌合的效能差距」 | (fine-tuned - weak) / (ceiling - weak)；1.0 = 完全彌合，0 = 沒有幫助 |
| Debate | 「兩個 U 執行個體辯論」 | 可擴展監督機制，由較弱的裁判從兩個 U 辯手中選出較佳者 |
| RRM | 「遞迴獎勵建模」 | U 協助訓練 U+1 的獎勵模型；監督者的能力隨 U 提升 |
| Task decomposition | 「由人類檢查的子任務」 | 將困難任務遞迴拆成多個人類可驗證的子任務 |
| Superalignment | 「對齊超人類 AI」 | 旨在對齊人類無法直接評估之模型的研究議程 |

## Further Reading｜延伸閱讀

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) — W2SG 論文。
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) — AI 辯論機制。
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) — 遞迴獎勵建模（RRM）。
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) — 2024 年關於強辯論者能否提升真實回答率的實證研究。
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) — 2025 年將辯論機制與 W2SG 結合的研究。
