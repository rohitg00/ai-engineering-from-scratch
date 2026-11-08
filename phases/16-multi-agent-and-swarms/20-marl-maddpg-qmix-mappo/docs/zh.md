# MARL —— MADDPG、QMIX、MAPPO

> 多代理協調的強化學習傳承，到 2026 年仍在影響 LLM 代理系統。**MADDPG**（Lowe 等人，NeurIPS 2017，arXiv:1706.02275）引入了集中式訓練、去中心化執行（CTDE）：訓練時每個 critic 看得到所有代理的狀態與行動；測試時只有本地的 actor 在跑。適用於合作、競爭與混合場景。**QMIX**（Rashid 等人，ICML 2018，arXiv:1803.11485）是配上單調混合網路的價值分解；逐代理的 Q 合成聯合 Q，讓 `argmax` 能乾淨地分散下去 —— 在 StarCraft 多代理挑戰（SMAC）上占主導。**MAPPO**（Yu 等人，NeurIPS 2022，arXiv:2103.01955）是配上集中式價值函數的 PPO；在 particle-world、SMAC、Google Research Football、Hanabi 上只需極少調參就「出奇地有效」。這些是那些「必須去中心化行動的代理團隊」訓練策略的基礎。MAPPO 是 **2026 年合作式 MARL 的預設基線**。這一課用一個小小的網格世界玩具把每一種都建出來，讓這三個構想在你碰 LLM 代理訓練之前先變成肌肉記憶。

**類型：** 學習
**程式語言：** Python (stdlib, small NumPy-free implementations)
**先修單元：** 階段 09（強化學習）、階段 16 · 09（平行 Swarm 網路）
**時間：** 約 90 分鐘

## 問題

LLM 代理系統愈來愈常替代理間的協調訓練策略：何時該讓位、何時該行動、該叫哪個同儕。告訴你怎麼訓練這種策略的文獻是多代理強化學習（MARL），它早於 LLM 這一波，而且有一小組占主導的演算法。

在沒有那套樣式詞彙的情況下讀 MARL 論文很痛苦。集中式訓練搭配去中心化執行（CTDE）、價值分解、集中式 critic 都不是行話 —— 它們是對特定問題的特定答案：

- 獨立 RL（每個代理自己學）從每個代理的視角看都是非平穩的。很糟。
- 集中式 RL（一個代理控制全部）擴展不了，而且違反執行上的限制。
- CTDE 取兩者之長：用全域資訊訓練，用本地策略部署。

## 概念

### 論文使用的三種環境

- **Particle World（多代理粒子環境）。** 簡單的 2D 物理，帶合作／競爭任務。MADDPG 原本的試驗場。
- **StarCraft 多代理挑戰（SMAC）。** 合作式微操，部分可觀測。QMIX 的試驗場。離散行動、連續狀態。
- **Google Research Football、Hanabi、MPE。** MAPPO 的基線。

不同環境有不同的行動／觀察型別。演算法據此挑選。

### MADDPG（2017）—— 那個 CTDE 樣式

每個代理 `i` 有一個 actor `mu_i(o_i)`，把自己的觀察對映到行動。每個代理也有一個 critic `Q_i(x, a_1, ..., a_n)`，在訓練時看得到所有觀察與所有行動。Actor 依 critic 的評價以策略梯度更新。

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

為什麼要 CTDE：訓練時我們知道每個人的行動；我們用它來降低每個 critic 的變異。部署時，每個代理只看到 `o_i` 並呼叫 `mu_i(o_i)`。

失敗模式：critic 隨代理數 N 長大（輸入包含所有行動）。不做近似的話，超過約 10 個代理就擴展不了。

### QMIX（2018）—— 價值分解

只適用合作。全域獎勵是逐代理 Q 值某個單調函數的總和：

```math
Q_{\text{tot}}(\tau, a) = f\big(Q_1(\tau_1, a_1), \ldots, Q_n(\tau_n, a_n)\big), \quad \frac{\partial f}{\partial Q_i} \ge 0
```

那份單調性保證 `argmax_a Q_tot` 可以由每個代理各自選 `argmax_{a_i} Q_i` 算出來。那**正是你要的去中心化執行性質**。訓練時，一個混合網路從逐代理的 Q 產出 `Q_tot`。

QMIX 為什麼在 SMAC 上贏：合作式的星海爭霸微操有同質代理、局部觀察、全域獎勵 —— 對價值分解來說是完美契合。

失敗模式：單調性這條限制很嚴格；有些任務的獎勵結構不是單調可分解的（某個代理為團隊犧牲）。延伸作品（QTRAN、QPLEX）放寬了它。

### MAPPO（2022）—— 那個被忽視的預設

多代理 PPO：配上集中式價值函數的 PPO。每個代理有自己的策略；所有代理共用（或各有）看得到完整狀態的價值函數。Yu 等人 2022 年在五個基準上把 MAPPO 與 MADDPG、QMIX 及其延伸做基準比較，發現：

- MAPPO 在 particle-world、SMAC、Google Research Football、Hanabi、MPE 上追平或勝過 off-policy 的 MARL 方法。
- 只需要極少的超參數調校。
- 訓練穩定；跨隨機種子可重現。

在這篇論文之前，社群一直低估 on-policy 的 MARL。到 2026 年，MAPPO 是合作式 MARL 的預設基線；任何新方法都必須打敗它。

### LLM 代理工程師為何該在意

三個直接用途：

1. **路由器訓練。** 一個後設代理挑出由哪個子代理處理某項任務。這是一個帶 N 個去中心化子代理與一個集中式路由器的 MARL 問題。MAPPO 很合適。
2. **角色浮現。** 在生成式代理模擬中，訓練代理隨時間採取互補角色，就是一個偽裝過的 MARL 問題。QMIX 式的價值分解依構造就逼出互補性。
3. **多代理的工具使用。** 當代理共用工具並爭奪預算時，用 CTDE 訓練它們，會產出尊重資源限制、可部署的本地策略。

實務但書：2026 年多數生產級 LLM 代理系統是用提示詞給策略，而不是訓練它們。當你具備 (a) 大量互動資料、(b) 清楚的獎勵訊號，以及 (c) 願意投資訓練基礎設施時，MARL 才登場。

### 把 CTDE 當成 RL 之外的設計模式

就算不做訓練，CTDE 也是一個有用的架構模式：

- 在*設計*時，假設團隊資訊全可見。
- 在*執行期*，強制去中心化執行：每個代理只看到 `o_i`。

這個模式逼你把逐代理的狀態明寫出來，並在一開始就思考部分可觀測性。許多生產級多代理系統到處默默假設有共享狀態 —— CTDE 的紀律防止那件事。

### 那個非平穩性的問題

當多個代理同時學習時，每個代理的環境（其中包含其他人的策略）就是非平穩的。經典單代理 RL 的證明就破了。本課這些 MARL 演算法全都在處理它：

- MADDPG：全域 critic 看得到所有行動，所以它的價值估計是平穩的。
- QMIX：價值分解把學習搬到一個聯合 Q 空間，在那裡最佳性有良好定義。
- MAPPO：集中式價值函數抑制了來自他人策略變化的變異。

在 LLM 代理系統裡，非平穩性表現成「我的代理上個月還好好的，現在上游那個代理改了，我的就出問題」。用 CTDE 訓練 MARL 是有原則的修法；提示詞層級的修法比較快，但比較不耐久。

### 這一課「不」涵蓋什麼

真正訓練網路是階段 09 的主題。這一課建出腳本化策略的版本，展示 CTDE、價值分解與集中式價值這幾個樣式，但不做梯度更新。目標是在你拿起一整套 MARL 函式庫（PyMARL、MARLlib、RLlib multi-agent）之前，先把這些樣式內化。

```figure
sw-ctde
```

## 動手實作

`code/main.py` 實作三份樣式示範，全都在一個很小的 2 代理合作網格世界上：

- 環境：4x4 網格上有 2 個代理、一顆獎勵球。獎勵 = 只要任一代理抵達獎勵球就得 1；任務結束。
- `IndependentAgents` —— 每個代理把其他人當成環境。基線。
- `MADDPGStyle` —— 集中式 critic 算出一個聯合價值；actor 策略據以更新。腳本化的策略改善。
- `QMIXStyle` —— 帶單調混合器的價值分解。
- `MAPPOStyle` —— 集中式價值函數；策略對照那個共享基準更新。

四者跑同樣的 episode，並回報平均抵達目標的步數。CTDE 的變體收斂到比獨立基線更短的路徑。

跑：

```
python3 code/main.py
```

預期輸出：獨立代理平均約 6 步；CTDE 變體收斂到約 3.5 步（4x4 網格的最佳值是 3）。就算策略是腳本化的，樣式之間的差異仍然顯現出來。

## 框架應用

`outputs/skill-marl-picker.md` 是一項技能，會替一項給定的多代理任務挑出 MARL 演算法：合作或競爭、同質或異質、行動空間型別、規模、獎勵訊號。

## 產出交付

MARL 在生產環境很罕見。當你真的要用時：

- **從 MAPPO 開始。** 2022 年那篇論文把它確立為基線；先重現它，能省下好幾週追逐更花俏方法的時間。
- **記錄每個代理的觀察與行動流。** 沒有逐代理軌跡就替 MARL 除錯是沒指望的。
- **把訓練程式碼與執行程式碼分開。** CTDE 是一種紀律；讓執行路徑真的只看得到 `o_i`。
- **獎勵塑形的警告。** MARL 對獎勵設計極度敏感。塑形裡出一個協調臭蟲，代理就會學會利用它。要跑對抗性測試。
- **對 LLM 代理**，先考慮提示詞層級的策略。只有在互動資料 + 獎勵訊號 + 基礎設施三者都到位時，才投資 MARL 訓練。

## 練習

1. 跑 `code/main.py`。量獨立代理與 MAPPO 式代理之間抵達目標步數的差距。在 6x6 網格上，那個差距是變大還是變小？
2. 實作一個競爭變體：兩個代理、一顆獎勵球，只有先抵達的那個拿到獎勵。哪個樣式乾淨地處理得了競爭？歷史上是 MADDPG。
3. 讀 MADDPG（arXiv:1706.02275）第 3 節。用你自己的話，以偽代碼象徵性地實作出那條確切的 critic 更新規則。
4. 讀 MAPPO（arXiv:2103.01955）。作者為何主張在他們的基準上，集中式價值 + PPO 勝過 off-policy 的 MARL？列出三項最強的主張。
5. 把 CTDE 當成設計模式套用到一個假想的 LLM 代理系統（例如研究代理 + 摘要者 + 寫程式的）。哪些聯合資訊在設計時可得、在執行期卻不可得？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| MARL | 「多代理 RL」 | 給多代理系統用的強化學習。 |
| CTDE | 「集中式訓練、去中心化執行」 | 用全域資訊訓練；用本地策略部署。 |
| MADDPG | 「多代理 DDPG」 | CTDE，每個代理的 critic 看得到所有觀察 + 行動。 |
| QMIX | 「價值分解」 | 對逐代理 Q 做單調混合。合作用。 |
| MAPPO | 「多代理 PPO」 | 配集中式價值函數的 PPO。2026 年的預設基線。 |
| 價值分解 | 「個別 Q 的總和」 | 聯合 Q 表示成逐代理 Q 的一個單調函數。 |
| 非平穩性 | 「會移動的標靶」 | 隨著其他人學習，每個代理的環境都在變。MARL 的核心問題。 |
| On-policy／off-policy | 「從當前學／從重播學」 | PPO 是 on-policy（MAPPO）；DDPG 與 Q-learning 是 off-policy。 |
| SMAC | 「StarCraft 多代理挑戰」 | 合作式微操基準；QMIX 的主場。 |

## 延伸閱讀

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) —— MADDPG；NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) —— QMIX；ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) —— MAPPO；NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) —— 對 MAPPO 那個結果好讀的框架說明
- [SMAC repository](https://github.com/oxwhirl/smac) —— StarCraft 多代理挑戰
