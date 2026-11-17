# 管線並行與氣泡率分析（Pipeline Parallel and Bubble Analysis）

> 張量並行（Tensor Parallel）是將單個矩陣乘法分配到多個 rank 上切分。而管線並行（Pipeline Parallel）則是將模型沿著深度方向分配到多個 rank，每個 rank 負責一個階段（Stage）。微批次（Microbatches）在管線中依序流動。啟動與收尾時各階段的空閒等待時間，就是所謂的**管線氣泡（Pipeline Bubble）**；管線並行的一項工程目標是降低氣泡率。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 19 Track C lessons 42-49
**Time:** ~90 min

## Learning Objectives｜學習目標

- 將序列化模型切分為 N 個階段（Stages），並在 N 個 rank 之間模擬前向管線傳遞。
- 使用經典的 GPipe 排程策略（全量前向填充，隨後逆向反向排空）調度 M 個微批次，並推導計算理論氣泡率（Bubble Fraction）。
- 對比 GPipe 與 Megatron-LM、PipeDream 所廣泛採用的交織 1F1B（One-Forward-One-Backward）排程架構。
- 深入說明階段劃分準則：各階段的**運算量均衡（Equal Compute）**比**參數量均等（Equal Parameters）**更重要。

## The Problem｜問題

一個在 FP16 精度下運作的 700 億參數（70B）大模型，單是模型權重本身就需要吞噬高達 140 GB 的記憶體。單張消費級 GPU 無法容納。ZeRO-3 雖然能將參數分片到各 rank，但在每一步前向計算時依然需要所有 rank 透過 AllGather 從網路取得完整層參數，在每一層皆要承擔 log(N) 跳的通訊延遲。管線並行（Pipeline Parallel）採取另一種方式：將模型沿著深度方向切成 N 個階段，每個 rank 負責其中一個階段。第 1 層的前向傳播在 rank 0 上計算完畢後，直接將活化值（Activations）張量透過網路交接給 rank 1；rank 1 運行第 2 層並交接給 rank 2，依此類推。反向傳播則沿著相反方向回傳。記憶體佔用呈現線性下降，因為每個 rank 僅需常駐單一階段的層結構；但其運算呈現序列化依賴，這便引發了致命的**氣泡率難題（The Bubble Problem）**。

所謂管線氣泡，是指在管線剛啟動時（前段 rank 在計算、後段 rank 等待第一個微批次送達）以及收尾時（前段 rank 已完成工作，等待最後一個微批次的反向梯度排空）所產生的硬體閒置時間。在包含 M 個微批次與 N 個階段的系統中，單階段的氣泡佔比公式為：(N-1)/(M + N - 1)。當 M=8、N=4 時，氣泡率為 27%；而當 M=64、N=4 時，氣泡率為 4.5%。微批次數量 M 越大，氣泡率越小；因此每個微批次的批次大小會較小，這項限制會影響微批次設計。

## The Concept｜核心概念

```mermaid
flowchart LR
  R0[Rank 0：階段 0／第 0 層] --> R1[Rank 1：階段 1／第 1 層]
  R1 --> R2[Rank 2：階段 2／第 2 層]
  R2 --> R3[Rank 3：階段 3／損失]
  R3 -.backward.-> R2
  R2 -.backward.-> R1
  R1 -.backward.-> R0
```

### GPipe 排程策略

在啟動任何反向傳播之前，優先用全部 M 個微批次將前向管線徹底填滿；隨後依序執行反向傳播進行排空。每個微批次在前向傳播中產生的活化值必須在記憶體中持續保留，直到其對應的反向傳播結束為止，因此記憶體開銷隨微批次數量 M 呈線性增加。前向傳播耗費 M + N - 1 個時鐘週期，反向傳播同樣耗費 M + N - 1 個週期。每個階段產生的有效計算為 2M 個週期，氣泡浪費為 2(N-1) 個週期。在單個前向與反向耗時均等的前提下，氣泡率精確收斂為 (N-1)/(M + N - 1)。選擇 M 遠大於 N 能隱藏 GPipe 氣泡。

### 1F1B 交織排程策略（One-Forward-One-Backward）

交織推進：每當某個微批次的前向傳播抵達最後一個階段時，該階段立即啟動其對應的反向傳播並向回串流輸送。整個排程在每個階段交替執行「一次前向、一次反向」。氣泡仍為 N−1 個步驟，但其最大活化值記憶體佔用受限在管線深度 N 範圍內，與微批次總量 M 無關。正式環境中的管線會使用 1F1B（例如 Megatron-LM、PipeDream）。本課首先實作 GPipe，並在擴充練習中引導你實作 1F1B。

### 為何階段間必須追求「運算量均衡」，而非「參數量均等」

若階段 0 前向計算耗時 50 毫秒，而階段 1 耗時 100 毫秒，其他階段每個週期都會閒置 50 毫秒，等待階段 1 完成。以參數量平均來劃分階段並非正確的切分依據：Transformer 的運算量（FLOPs）主要來自各層的注意力與 MLP；embedding 層雖然參數很多，運算量卻較少。階段切分應讓各階段的 FLOPs 均衡，而非讓各階段的權重數量相同。

### 微批次與整體批次

管線同時調度 M 個微批次，每個微批次大小為 B。有效批次大小為 M*B。單次管線步進結束時累計的梯度，是這 M*B 個樣本上的總梯度。氣泡率取決於 M；最佳化器接收的是 M*B 個樣本的梯度。調整 M 意味著在氣泡率（M 越大，氣泡越小）與活化值記憶體開銷（在 GPipe 中，M 越大，記憶體開銷越高）之間取捨。

```figure
cd-pipeline-bubble
```

## Build It｜動手實作

`code/main.py` 實作了以下核心模組：

- `PipelineStage`：小巧的 `nn.Module`，持有單一階段的參數層，對外暴露 `forward(activation)` 介面。
- `Pipeline(stages, num_microbatches)`：在模擬階段上，依據各階段設定的模擬實際耗時，調度 GPipe 的前向填充與反向排空排程。
- `bubble_fraction(num_stages, num_microbatches)`：閉式解析計算公式 (N-1)/(M + N - 1)。
- 4 階段端到端演示：打印逐個微批次的甘特圖時序追蹤，並呈報實測氣泡率與理論公式的對比驗收。

執行測試：

```bash
python3 code/main.py
```

輸出結果：展示一張以階段為行、微批次時序為列的甘特圖（Gantt Chart），並嚴密校驗實測氣泡佔比與理論預測值在誤差範圍內精確吻合。

## 正式環境中的實務模式

三大實戰工程技巧，能讓管線並行架構足以支撐線上千億模型預訓練：

**活化值檢查點（Activation Checkpointing）與管線並行可以搭配使用**：在 GPipe 排程中，在途的 M 個微批次會使活化值記憶體用量增加至 M 倍。活化值檢查點在反向傳播時重新計算前向結果，以計算量換取記憶體；兩者結合可讓管線並行支援較長的序列。

**階段負載均衡應以測量為依據**：正式環境團隊會在目標硬體上進行效能分析，測量每層神經網路的 FLOPs 與實際經過時間，再依測量結果劃分各階段。Megatron-LM 的 `--num-layers-per-stage` 參數支援傳入清單；不同階段每層成本不同時，可配置不同數量的層。

**Send-Recv 通訊排程必須避免死鎖**：若所有階段同時先發送後接收，整個網路鏈路將陷入分散式死鎖。標準解法是實施奇偶交織排程：偶數 rank 先發送後接收，奇數 rank 先接收後發送。本課程式碼會明確安排這個交織時序。

## Use It｜實際應用

工業級生產框架在底層全體遵循完全相同的架構：

- **Megatron-LM**：大規模管線並行的業界標竿。使用 1F1B 排程，並支援張量並行（TP）+ 管線並行（PP）+ 資料平行（DP）三維混合並行（3D Parallelism）。
- **DeepSpeed Pipeline**：與 ZeRO 深度整合；ZeRO-1 搭配管線並行是大型開放模型常見的組合。
- **PyTorch Pipe**：PyTorch 官方原生內建的管線封裝器，依託 `torch.distributed.pipeline.sync.Pipe` 實作。

## Ship It｜交付成果

第八十課將親手打造分片 model checkpoint，專門用於保存管線並行各階段的專屬參數分片。第八十一課會在端到端演示中概念性地組合 DDP、ZeRO 與管線並行；為控制執行時間，demo 中的管線仍採模擬方式。

## Exercises｜練習

1. 實作 1F1B 交織排程策略，嚴格驗證其氣泡率與 GPipe 完全一致，但其峰值活化值記憶體佔用被成功限制在固定常數範圍內。
2. 在更深層的神經網路上測量各階段的實際經過時間，並依據測得的毫秒數重新平衡各階段的層數。
3. 為管線微批次引入跨步梯度累加（Gradient Accumulation），驗證累計後的總梯度與單次全量大批次前向傳播產出的梯度完全等價。
4. 將管線並行與活化值檢查點（Activation Checkpointing）結合，實測記憶體佔用的下降幅度與計算時間增幅的比例。
5. 將管線並行與 DDP 資料平行相結合（即管線中的每個 Rank 本身被複製為一個資料平行組），深入推導該二維混合並行網格的時序排程圖譜。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際含義 |
|---|---|---|
| Pipeline parallel（管線並行） | 「沿模型深度進行模型平行」 | 沿著模型深度方向將模型切分為多個階段，每個 Rank 持有一個階段，活化值沿著鏈路順序傳遞 |
| Bubble（管線氣泡） | 「管線閒置時間」 | 起始與結尾各有 (N-1) 個步驟，期間有些階段沒有工作 |
| Microbatch（微批次） | 「批次切片」 | 管線中流動的最小獨立前向與反向運算單元；微批次數量 M 越大，全域氣泡率越低 |
| GPipe | 「先填滿再排空」 | 先將所有 M 個微批次的前向傳播全部填滿、隨後依序執行反向排空的排程模式；活化值記憶體開銷較高 |
| 1F1B | 「交錯排程」 | 一次前向緊跟一次反向的交織排程模式；將活化值記憶體開銷嚴格限制在管線深度之內 |

## Further Reading｜延伸閱讀

- [Huang et al., 2018，〈GPipe: Efficient Training of Giant Neural Networks〉](https://arxiv.org/abs/1811.06965)：大模型管線並行奠基性論文。
- [Narayanan et al., 2018，〈PipeDream: Generalized Pipeline Parallelism for DNN Training〉](https://arxiv.org/abs/1806.03377)：1F1B 交織排程原創學術論文。
- [NVIDIA Megatron-LM 官方技術文件：管線並行架構](https://github.com/NVIDIA/Megatron-LM)
- 第 19 階段第 76 課：回顧支撐跨階段活化值傳遞的底層點對點通訊原語。
- 第 19 階段第 78 課：深入了解與管線並行相互正交且經常混合使用的 ZeRO 記憶體分片架構。
