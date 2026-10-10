# 繁體中文（台灣）術語表

以本表作為 zh-TW 譯文的唯一術語依據。先依 Vol 1 的 Key Terms、粗體術語與 `glossary/terms.md` 建立；新術語先補表，再用於譯文。中文譯名第一次出現在每課時，附上英文原詞；保留英文的詞依「保留英文」欄處理。

| English | 譯法 | 保留英文 | 禁用 | 備註 |
| --- | --- | --- | --- | --- |
| token | token | 是 | 詞元、令牌 | 依使用者指定保留業界用法。 |
| prompt | prompt | 是 | 提示詞 | AI 工程語境中保留英文。 |
| agent | agent | 是 | 智慧體、代理程式 | AI agent 語境中保留英文；一般法律／人員語境另依上下文。 |
| fine-tuning | fine-tuning | 是 | 微調 | 依使用者指定保留英文。 |
| embedding | embedding | 是 | 嵌入、嵌入向量 | 依使用者指定保留英文。 |
| eager execution | 立即執行 | 否 |  | PyTorch 的設計：呼叫當下就算出結果。 |
| pure function | 純函式 | 否 |  | 輸出只取決於輸入，沒有副作用。 |
| pytree | pytree | 是 |  | JAX 可走訪的巢狀清單、tuple、dict 與陣列。 |
| pixel | 像素 | 否 |  | 影像網格上的一個光強度樣本。 |
| channel | 通道 | 否 | 頻道 | 影像張量裡並列的空間網格。軟體發行頻道不用這個譯法。 |
| color space | 色彩空間 | 否 |  | RGB、HSV、YCbCr 這類表示。 |
| quantization | 量化 | 否 |  | 把連續量分成有限位元。 |
| interpolation | 內插 | 否 |  | 新網格對不齊舊網格時，怎麼算出中間像素。 |
| aspect ratio | 長寬比 | 否 |  | 寬除以高。 |
| transformer | transformer | 是 | 轉換器 | 依使用者指定保留英文；模型架構名不翻。 |
| AI engineering | AI 工程 | 否 |  |  |
| repository | 儲存庫 | 否 | — | Git 專案語境。 |
| version control | 版本控制 | 否 |  | 管理檔案變更與協作的技術。 |
| working directory | 工作目錄 | 否 |  | Git 工作目錄。 |
| staging area | 暫存區 | 否 |  | Git 中準備納入下一個 commit 的區域。 |
| binary file | 二進位檔案 | 否 |  | 與文字檔相對。 |
| model checkpoint | model checkpoint | 是 |  | AI 模型訓練中保存的參數與狀態；保留英文。 |
| model weights | 模型權重 | 否 |  | 模型訓練後保存的參數。 |
| fork | fork | 是 |  | GitHub 協作功能，保留英文。 |
| rebase | rebase | 是 |  | Git 歷史整理操作，保留英文。 |
| cherry-pick | cherry-pick | 是 |  | Git 操作，保留英文。 |
| submodule | submodule | 是 |  | Git 子模組機制，保留英文。 |
| driver | 驅動程式 | 否 | — | 硬體裝置的軟體驅動程式。 |
| backend | 後端 | 否 |  | 系統架構語境。 |
| framework | 框架 | 否 |  | 軟體開發語境。 |
| RAG | RAG | 是 |  | Retrieval-augmented generation 的縮寫。 |
| large language model | 大型語言模型 | 否 |  |  |
| data | 資料 | 否 | 數據 | 不指資料庫中的單一欄位名稱。 |
| software | 軟體 | 否 | 軟件 |  |
| hardware | 硬體 | 否 | 硬件 |  |
| source code | 原始碼 | 否 | 源碼 |  |
| code | 程式碼 | 否 | 代碼 | 程式語境。 |
| server | 伺服器 | 否 | 服務器 |  |
| client | 用戶端 | 否 | 客戶端 |  |
| network | 網路 | 否 | 網絡 |  |
| information | 資訊 | 否 | 信息 |  |
| default | 預設 | 否 | 默認 |  |
| activate | 啟用 | 否 | 激活 |  |
| link | 連結 | 否 | 鏈接 |  |
| interface | 介面 | 否 | 接口 |  |
| component | 元件 | 否 | 組件 |  |
| optimize | 最佳化 | 否 | 優化 |  |
| click | 點選 | 否 | 點擊 |  |
| software package | 軟體套件 | 否 | 軟件包 |  |
| package manager | 套件管理器 | 否 | 包管理器 |  |
| package | 套件 | 否 | — | 指軟體套件時；一般包裝依上下文翻譯。 |
| toolchain | 工具鏈 | 否 | 工具鍊 |  |
| project | 專案 | 否 | — | 專案語境用「專案」；「項目」仍可表示品項。 |
| library | 函式庫 | 否 |  | 程式庫也可依上下文使用；本書統一用「函式庫」。 |
| C library | C 函式庫 | 否 | C 庫 |  |
| stack | 堆疊 | 否 | 棧 | 技術層次的 stack；容器或資料結構語境需依上下文。 |
| runtime | 執行環境 | 否 | 運行時 |  |
| Python interpreter | Python 直譯器 | 否 | 解釋器 |  |
| virtual environment | 虛擬環境 | 否 |  |  |
| symlink | 符號連結 | 否 | 軟連接 |  |
| web app | 網頁應用程式 | 否 | 網頁應用程序 |  |
| dependency | 相依套件 | 否 | 依賴包 | Python／Node.js 套件語境。 |
| transitive dependency | 間接相依套件 | 否 | 轉遞依賴 |  |
| dependency hell | 相依地獄 | 否 | 依賴地獄 |  |
| dependency conflict | 相依套件衝突 | 否 | 依賴衝突 |  |
| global install | 全域安裝 | 否 | 全局安裝 |  |
| dependency resolution | 相依性解析 | 否 | 依賴解析 |  |
| optional dependency group | 選用相依套件群組 | 否 |  |  |
| reproducibility | 可重現性 | 否 |  |  |
| lockfile | lockfile | 是 | 鎖定文件 | 套件管理器的檔名與術語保留。 |
| cache | 快取 | 否 | 緩存 |  |
| shell | shell | 是 |  | 指命令直譯器時保留英文。 |
| terminal | 終端機 | 否 | — | 台灣常用「終端機」。 |
| command | 指令 | 否 | — |  |
| pipe | 管線 | 否 | — | shell 的標準輸出串接語境。 |
| commit | commit | 是 | 提交、提交記錄 | Git 專有術語依台灣開發者慣例保留英文。 |
| branch | branch | 是 | 分支 | Git 專有術語依台灣開發者慣例保留英文。 |
| merge | merge | 是 |  | Git 專有術語依台灣開發者慣例保留英文；一般描述仍可依語境使用「合併」。 |
| remote | remote | 是 | 遠程 | Git remote 名稱與概念保留英文。 |
| container | 容器 | 否 |  | Docker 語境。 |
| image | 映像 | 否 | 鏡像 | Docker 映像。 |
| container image | 容器映像 | 否 | 容器鏡像 |  |
| Dockerfile | Dockerfile | 是 |  | Docker 組態檔名稱，保留英文。 |
| Docker Compose | Docker Compose | 是 |  | Docker 官方多容器編排工具名稱。 |
| image layer | 映像層 | 否 | 鏡像層 | Docker 語境。 |
| base image | 基礎映像 | 否 | 基礎鏡像 | Docker 語境。 |
| volume | 磁碟區 | 否 |  | Docker 持續性儲存空間。 |
| volume mount | 磁碟區掛載 | 否 | 卷掛載 | Docker 語境。 |
| host | 主機 | 否 | 宿主機 | 執行容器的機器。 |
| port | 通訊埠 | 否 | 端口 | 網路通訊語境。 |
| orchestrate | 編排 | 否 |  | 協調多個服務或容器。 |
| orchestration | 編排 | 否 |  | 協調多個服務或容器。 |
| GPU passthrough | GPU 直通 | 否 | GPU 穿透 |  |
| NVIDIA Container Toolkit | NVIDIA Container Toolkit | 是 | NVIDIA 容器工具包 | NVIDIA 產品名稱，保留英文。 |
| build | 建置 | 否 | 構建 |  |
| compiler | 編譯器 | 否 |  |  |
| filesystem | 檔案系統 | 否 | 文件系統 |  |
| inference server | 推論伺服器 | 否 |  |  |
| docker-compose | docker-compose | 是 | docker compose | 本課術語表中的歷史 CLI 名稱，保留來源寫法。 |
| load balancer | 負載平衡器 | 否 | 負載均衡器 |  |
| API | API | 是 |  | 在技術文件中保留縮寫。 |
| API call | API 呼叫 | 否 |  |  |
| API server | API 伺服器 | 否 |  |  |
| SDK | SDK | 是 |  | Software development kit 的縮寫；保留英文。 |
| HTTP | HTTP | 是 |  | Hypertext Transfer Protocol 的縮寫；保留英文。 |
| JSON | JSON | 是 |  | 資料格式名稱縮寫；保留英文。 |
| URL | URL | 是 |  | 網址縮寫；保留英文。 |
| environment variable | 環境變數 | 否 | 環境變量 |  |
| endpoint | 端點 | 否 |  |  |
| provider | 服務供應商 | 否 |  | API 服務語境。 |
| schema | 結構描述 | 否 |  | 技術資料格式語境。 |
| free tier | 免費方案 | 否 |  | 服務免費使用層級。 |
| request | 請求 | 否 |  | API 通訊語境。 |
| response | 回應 | 否 |  | API 通訊語境。 |
| request body | 請求本文 | 否 |  |  |
| response body | 回應本文 | 否 |  |  |
| authentication | 身分驗證 | 否 |  |  |
| authorization | 授權 | 否 |  |  |
| API key | API 金鑰 | 否 | API 密鑰 |  |
| rate limit | 速率限制 | 否 |  |  |
| billing unit | 計費單位 | 否 |  |  |
| streaming | 串流 | 否 |  |  |
| preflight check | 前置檢查 | 否 |  | 執行前確認環境或設定的檢查。 |
| virtual machine | 虛擬機器 | 否 | — | 正文可簡稱「虛擬機」。 |
| GPU | GPU | 是 | 圖形處理器 | 在 AI 工程文件中保留縮寫。 |
| CPU | CPU | 是 | 中央處理器 | 在 AI 工程文件中保留縮寫。 |
| CNN | CNN | 是 |  | 卷積神經網路的縮寫；保留縮寫。 |
| LLM | LLM | 是 |  | large language model 的縮寫；保留縮寫。 |
| CUDA | CUDA | 是 |  | NVIDIA 平台名稱。 |
| CUDA toolkit | CUDA 工具套件 | 否 |  |  |
| CUDA binding | CUDA 繫結 | 否 |  |  |
| CUDA version mismatch | CUDA 版本不相容 | 否 | CUDA 版本不匹配 |  |
| fp16 | fp16 | 是 |  | 16 位元浮點數格式；保留格式標記。 |
| fp32 | fp32 | 是 |  | 32 位元浮點數格式；保留格式標記。 |
| memory | 記憶體 | 否 | 內存 | 電腦的記憶體。 |
| byte | 位元組 | 否 | 字節 | 資料量的單位。 |
| floating point | 浮點數 | 否 |  | 數值表示方式。 |
| floating-point arithmetic | 浮點運算 | 否 |  |  |
| numerical stability | 數值穩定性 | 否 |  |  |
| numerical precision | 數值精度 | 否 |  | 浮點數表示精度；與分類指標 precision 區分。 |
| IEEE 754 | IEEE 754 | 是 |  | 浮點數標準。 |
| sign bit | 符號位元 | 否 |  |  |
| exponent | 指數 | 否 |  | 浮點數格式語境。 |
| mantissa | 尾數 | 否 |  |  |
| significand | 有效數 | 否 |  | 浮點數格式語境。 |
| machine epsilon | 機器精度 | 否 |  |  |
| significant digit | 有效數字 | 否 |  |  |
| rounding error | 捨入誤差 | 否 |  |  |
| rounding noise | 捨入雜訊 | 否 |  |  |
| catastrophic cancellation | 災難性消去 | 否 |  |  |
| relative error | 相對誤差 | 否 |  |  |
| log-sum-exp trick | log-sum-exp 技巧 | 否 |  |  |
| max-subtraction trick | 最大值相減技巧 | 否 |  |  |
| stable softmax | 穩定 softmax | 否 |  |  |
| centered finite difference | 中心有限差分 | 否 |  |  |
| finite precision | 有限精度 | 否 |  |  |
| float16 | float16 | 是 |  | 16 位元浮點數格式名稱。 |
| float32 | float32 | 是 |  | 32 位元浮點數格式名稱。 |
| float64 | float64 | 是 |  | 64 位元浮點數格式名稱。 |
| bfloat16 | bfloat16 | 是 |  | 16 位元浮點數格式名稱。 |
| loss scaling | 損失縮放 | 否 |  |  |
| dynamic loss scaling | 動態損失縮放 | 否 |  |  |
| Welford algorithm | Welford 演算法 | 否 |  |  |
| subnormal number | 次正規數 | 否 |  | 浮點數中低於最小正規數的非零數。 |
| video RAM | 顯示記憶體 | 否 |  | GPU 的 video RAM。 |
| half precision | 半精度 | 否 |  | 浮點數精度格式。 |
| benchmark | 效能基準測試 | 否 |  | 比較系統或硬體效能的測試。 |
| speedup | 加速比 | 否 |  | 比較運算速度的比例。 |
| cloud GPU | 雲端 GPU | 否 |  | 透過雲端服務使用的 GPU。 |
| notebook | notebook | 是 | 筆記本 | Jupyter Notebook／Colab 文件；保留英文。 |
| parallel computing | 平行運算 | 否 | 並行計算 |  |
| MPS | MPS | 是 |  | Apple Metal Performance Shaders 縮寫。 |
| VRAM | VRAM | 是 |  |  |
| Tensor Core | Tensor Core | 是 | 張量核心 | NVIDIA 產品名稱。 |
| Jupyter Notebook | Jupyter Notebook | 是 |  | 產品名稱。 |
| cell | 儲存格 | 否 | 單元格 | Jupyter 語境。 |
| kernel | 核心 | 否 | 內核 | Jupyter 語境；不是作業系統 kernel 時仍依上下文。 |
| magic command | magic command | 是 | 魔法命令 | Jupyter 專有用法。 |
| line magic | line magic | 是 | 行魔法 | Jupyter 的 `%` 行命令，保留英文。 |
| cell magic | cell magic | 是 | 儲存格魔法 | Jupyter 的 `%%` 儲存格命令，保留英文。 |
| Markdown | Markdown | 是 |  | 標記語言名稱，保留英文。 |
| markdown cell | Markdown 儲存格 | 否 |  | Jupyter 儲存格類型。 |
| code cell | 程式碼儲存格 | 否 |  | Jupyter 儲存格類型。 |
| inline plot | 內嵌圖表 | 否 |  | 在 notebook 儲存格輸出區顯示的圖表。 |
| script | 程式檔案 | 否 |  | 指可執行的程式碼檔案。 |
| keyboard shortcut | 快捷鍵 | 否 |  |  |
| function signature | 函式簽章 | 否 |  | 函式接受的參數和回傳型別等宣告。 |
| command mode | 命令模式 | 否 |  | Jupyter 介面模式。 |
| edit mode | 編輯模式 | 否 |  | Jupyter 介面模式。 |
| out-of-order execution | 不依序執行 | 否 |  | 指以不同於由上而下的順序執行 notebook 儲存格。 |
| hidden state | 隱藏狀態 | 否 |  | 變數仍保留在 kernel 記憶體、但目前可見儲存格沒有建立它的狀況。 |
| memory leak | 記憶體洩漏 | 否 |  |  |
| debugging | 除錯 | 否 | 調試 |  |
| debugger | 除錯器 | 否 | 調試器 |  |
| breakpoint | 中斷點 | 否 | — | 簡體「断点」由簡體字檢查攔下；繁體寫法統一用「中斷點」。 |
| profiling | 效能分析 | 否 |  | 測量程式各部分的時間與資源使用。 |
| profiler | 效能分析器 | 否 |  | 執行效能分析的工具。 |
| memory profiling | 記憶體分析 | 否 |  | 測量程式記憶體使用的分析。 |
| bottleneck | 瓶頸 | 否 |  | 限制整體效能的環節。 |
| backbone | 骨幹 | 否 |  | 視覺模型裡產生特徵圖、再交給任務頭的卷積堆疊。 |
| transfer learning | 遷移學習 | 否 |  |  |
| skip connection | 跳躍連接 | 否 |  | 把輸入直接加回區塊輸出的連線。 |
| stack trace | 堆疊追蹤 | 否 | 堆棧跟蹤 | 程式錯誤時列出的呼叫序列。 |
| runtime error | 執行階段錯誤 | 否 | 運行時錯誤 | 程式執行中才發生的錯誤。 |
| timestamp | 時間戳記 | 否 | — |  |
| logging | 日誌記錄 | 否 |  | 程式執行時寫下事件與訊息。 |
| device | 裝置 | 否 | 設備 | CPU／GPU 等執行張量運算的硬體。 |
| dtype | dtype | 是 |  | 張量資料型別屬性名，保留程式名稱。 |
| NaN | NaN | 是 |  | Not a Number，非數值結果。 |
| shape mismatch | 形狀不相符 | 否 |  | 張量形狀與預期不一致的錯誤。 |
| gradient norm | 梯度範數 | 否 |  | 梯度向量的大小。 |
| vanishing gradient | 梯度消失 | 否 |  | 梯度趨近於零、使訓練停滯的現象。 |
| exploding gradient | 梯度爆炸 | 否 |  | 梯度過大導致訓練不穩定的現象。 |
| mixed precision | 混合精度 | 否 |  | 混用 fp16／fp32 以節省記憶體的訓練方式。 |
| gradient checkpointing | 梯度檢查點 | 否 |  | 以重算換取記憶體的訓練技巧。 |
| TensorBoard | TensorBoard | 是 |  | PyTorch／TensorFlow 的視覺化工具名稱。 |
| histogram | 直方圖 | 否 |  | 顯示數值分布的圖表。 |
| forward pass | 前向傳遞 | 否 |  | 模型由輸入算出輸出的一次運算。 |
| backward pass | 反向傳遞 | 否 |  | 由損失計算梯度的一次運算。 |
| numerical instability | 數值不穩定 | 否 |  | 浮點運算誤差導致結果失控的狀況。 |
| snapshot | 快照 | 否 |  | 某個時間點的狀態記錄。 |
| DataFrame | DataFrame | 是 |  | pandas 資料表物件；保留類別名稱。 |
| metadata | 中繼資料 | 否 | 元資料 |  |
| process | 行程 | 否 | 進程 | 作業系統中執行中的程式執行個體。 |
| variable | 變數 | 否 |  |  |
| prototype | 原型 | 否 |  |  |
| training pipeline | 訓練管線 | 否 | 訓練流水線 |  |
| session | 工作階段 | 否 |  | Jupyter／Colab 工作階段。 |
| extension | 擴充功能 | 否 | 外掛 | 軟體或編輯器的擴充功能。 |
| editor | 編輯器 | 否 |  | 撰寫與檢視程式碼的編輯器。 |
| autocomplete | 自動完成 | 否 |  | 編輯器依上下文提供程式碼補全。 |
| type checking | 型別檢查 | 否 |  | 檢查程式碼中的型別是否相容。 |
| type hint | 型別提示 | 否 |  | 顯示或標註程式碼的型別資訊。 |
| linting | 程式碼檢查 | 否 |  | 靜態檢查常見程式碼問題。 |
| format on save | 儲存時自動格式化 | 否 |  | 儲存檔案時自動套用程式碼格式。 |
| formatter | 格式化工具 | 否 |  | 自動調整程式碼排版的工具。 |
| language server | 語言伺服器 | 否 |  | 透過 LSP 提供編輯器語言功能的伺服器。 |
| code completion | 程式碼補全 | 否 |  | 編輯器提供的程式碼完成建議。 |
| diagnostic | 診斷資訊 | 否 |  | 語言伺服器回報的錯誤或警告。 |
| inline error | 行內錯誤訊息 | 否 |  | 顯示在編輯器程式碼附近的錯誤。 |
| type information | 型別資訊 | 否 |  | 變數、參數或回傳值的型別資料。 |
| import resolution | 匯入解析 | 否 |  | 編輯器解析程式匯入模組的來源。 |
| variable explorer | 變數瀏覽器 | 否 |  | 編輯器用來檢視目前變數的面板。 |
| integrated terminal | 整合式終端機 | 否 |  | 內嵌在程式編輯器中的終端機。 |
| terminal integration | 終端機整合 | 否 |  | 編輯器與終端機之間的整合功能。 |
| Language Server Protocol | 語言伺服器通訊協定 | 否 |  | 簡稱 LSP，定義編輯器和語言伺服器之間的通訊。 |
| SSH key | SSH 金鑰 | 否 |  | 用於 SSH 驗證的金鑰。 |
| training loop | 訓練迴圈 | 否 |  | 重複執行模型訓練步驟的程式流程。 |
| ruler | 編輯器尺標 | 否 |  | 顯示行長位置的垂直輔助線。 |
| remote development | 遠端開發 | 否 |  | 在遠端主機上編輯、執行或除錯程式。 |
| training run | 訓練作業 | 否 |  | 一次完整的模型訓練執行。 |
| list comprehension | 串列推導式 | 否 |  | Python 語法。 |
| array | 陣列 | 否 |  | NumPy／數值運算語境。 |
| microbenchmark | 微型效能基準測試 | 否 |  |  |
| HTML | HTML | 是 |  | 標記語言縮寫，保留英文。 |
| CSV | CSV | 是 |  | 檔案格式縮寫，保留英文。 |
| IDE | IDE | 是 | 整合開發環境 | 保留縮寫。 |
| tmux | tmux | 是 |  | 專案名稱。 |
| pane | 窗格 | 否 |  | tmux 視窗內的分割區域。 |
| redirect | 重新導向 | 否 |  | shell 把輸出／輸入導向檔案或其他命令。 |
| stdout | 標準輸出 | 否 |  | 命令的標準輸出串流。 |
| stderr | 標準錯誤 | 否 |  | 命令的標準錯誤串流。 |
| stdin | 標準輸入 | 否 |  | 命令的標準輸入串流。 |
| background process | 背景行程 | 否 |  | 不佔用前景終端機、持續執行的行程。 |
| foreground | 前景 | 否 |  | 終端機中佔用輸入焦點的執行狀態。 |
| detach | 分離 | 否 |  | tmux 語境：離開工作階段但讓其繼續執行。 |
| reattach | 重新連接 | 否 |  | tmux 語境：回到先前的工作階段。 |
| terminal multiplexer | 終端機多工器 | 否 |  | 在單一視窗中管理多個終端機工作階段的工具，如 tmux、screen。 |
| htop | htop | 是 |  | 互動式系統行程監控工具名稱。 |
| nvtop | nvtop | 是 |  | GPU 行程監控工具名稱。 |
| rsync | rsync | 是 |  | 檔案同步工具名稱。 |
| scp | scp | 是 |  | 基於 SSH 的檔案複製命令。 |
| nohup | nohup | 是 |  | 使命令不受掛斷訊號影響的工具名稱。 |
| hangup signal | 掛斷訊號 | 否 |  | 終端機關閉時送給行程的 SIGHUP 訊號。 |
| port forwarding | 通訊埠轉發 | 否 |  | 把本機通訊埠的流量轉送到遠端機器。 |
| log file | 日誌檔 | 否 |  | 程式執行時記錄輸出的檔案。 |
| command line | 命令列 | 否 | 命令行 | 以文字命令操作的介面。 |
| alias | 別名 | 否 |  | shell 中為常用命令定義的短名稱。 |
| disk space | 磁碟空間 | 否 |  | 儲存裝置的可用容量。 |
| OOM | OOM | 是 |  | out-of-memory 的縮寫；記憶體不足錯誤。 |
| permission | 權限 | 否 |  | 檔案或系統操作的存取權。 |
| file permission | 檔案權限 | 否 |  | Linux 檔案的讀、寫、執行權限位元。 |
| home directory | 家目錄 | 否 |  | 使用者的個人目錄，`~`。 |
| root | root | 是 |  | Linux 的最高權限使用者；也指根目錄 `/`。 |
| sudo | sudo | 是 |  | 以 root 權限執行單一命令的工具。 |
| system package | 系統套件 | 否 |  | 作業系統層級的軟體套件。 |
| daemon | 常駐程式 | 否 | 守護行程 | 在背景持續執行的系統服務。 |
| service | 服務 | 否 |  | systemd 管理的背景程式。 |
| clipboard | 剪貼簿 | 否 |  | 系統的複製貼上緩衝區。 |
| case-sensitive | 區分大小寫 | 否 |  | 檔名或比對時區別字母大小寫。 |
| line ending | 換行符號 | 否 |  | 檔案中表示換行的字元。 |
| mount | 掛載 | 否 |  | 讓檔案系統出現在指定目錄下。 |
| dual boot | 雙重開機 | 否 |  | 一台電腦安裝兩個作業系統。 |
| WSL | WSL | 是 |  | Windows Subsystem for Linux 縮寫。 |
| GUI | GUI | 是 | 圖形化介面、圖形使用者介面 | 圖形使用者介面縮寫，保留英文。 |
| SSH | SSH | 是 |  | 協定縮寫。 |
| PID | PID | 是 |  | process ID 的縮寫。 |
| Parquet | Parquet | 是 |  | 檔案格式名稱。 |
| Arrow | Arrow | 是 |  | Apache 專案名稱。 |
| Git LFS | Git LFS | 是 |  | 專案名稱。 |
| DVC | DVC | 是 |  | Data Version Control 工具名稱。 |
| data version control | 資料版本控制 | 否 |  | 管理資料集與模型版本的方式。 |
| Hugging Face Hub | Hugging Face Hub | 是 |  | Hugging Face 的資料集與模型託管平台。 |
| LSP | LSP | 是 |  | Language Server Protocol 縮寫。 |
| Pylance | Pylance | 是 |  | 產品名稱。 |
| feature | 特徵 | 否 |  | 機器學習輸入變數；產品功能依上下文譯為「功能」。 |
| labeled data | 有標籤資料 | 否 |  |  |
| data distribution | 資料分布 | 否 |  |  |
| class | 類別 | 否 |  | 分類語境。 |
| class imbalance | 類別不平衡 | 否 |  |  |
| unlabeled data | 無標籤資料 | 否 |  |  |
| feature engineering | 特徵工程 | 否 |  |  |
| feature vector | 特徵向量 | 否 |  |  |
| feature matrix | 特徵矩陣 | 否 |  |  |
| feature scaling | 特徵縮放 | 否 |  |  |
| synthetic data | 合成資料 | 否 | 合成數據 |  |
| heuristic | 啟發式方法 | 否 |  |  |
| lookup table | 查表 | 否 |  |  |
| feature selection | 特徵選擇 | 否 |  |  |
| feature importance | 特徵重要度 | 否 |  |  |
| tree-based model | 樹模型 | 否 |  | 以決策樹為基礎的模型。 |
| tabular data | 表格資料 | 否 |  | 以列和欄組織的資料。 |
| numeric feature | 數值特徵 | 否 |  |  |
| categorical feature | 類別特徵 | 否 |  |  |
| nonlinear relationship | 非線性關係 | 否 |  |  |
| nonlinear model | 非線性模型 | 否 |  |  |
| feature interaction | 特徵交互作用 | 否 |  | 一個特徵的影響會依其他特徵的值而改變。 |
| hyperparameter sensitivity | 超參數敏感度 | 否 |  | 模型表現對超參數設定變化的敏感程度。 |
| interpretability | 可解釋性 | 否 |  | 模型決策能否由人理解。 |
| label | 標籤 | 否 |  | 機器學習的目標標籤。 |
| model | 模型 | 否 |  |  |
| classifier | 分類器 | 否 |  |  |
| pipeline | 管線 | 否 | 管道 | 機器學習資料處理流程。 |
| policy | 策略 | 否 |  | 強化學習語境。 |
| policy optimization | 策略最佳化 | 否 |  |  |
| value learning | 價值學習 | 否 |  |  |
| reward | 獎勵 | 否 |  | 強化學習語境。 |
| penalty | 懲罰 | 否 |  | 強化學習語境。 |
| neural network | 神經網路 | 否 | 神經網絡 |  |
| neuron | 神經元 | 否 |  |  |
| multicollinearity | 多重共線性 | 否 |  |  |
| training | 訓練 | 否 |  |  |
| retrain | 重新訓練 | 否 |  |  |
| inference | 推論 | 否 |  |  |
| prediction | 預測 | 否 |  |  |
| dataset | 資料集 | 否 |  |  |
| tokenization | tokenization | 是 |  | 文字處理步驟；保留 token 的英文用法。 |
| language modeling | 語言建模 | 否 |  |  |
| question answering | 問答 | 否 |  |  |
| text classification | 文字分類 | 否 |  |  |
| image classification | 影像分類 | 否 |  |  |
| multimodal | 多模態 | 否 |  |  |
| image-text pair | 圖文配對 | 否 |  |  |
| large-scale text processing | 大規模文字處理 | 否 |  |  |
| `datasets` library | `datasets` 函式庫 | 否 |  | Hugging Face 用來載入與處理資料集的函式庫。 |
| columnar format | 欄式格式 | 否 |  | 以欄為單位組織資料的儲存格式。 |
| in-memory processing | 記憶體內處理 | 否 |  | 直接處理目前載入記憶體的資料。 |
| fixed random seed | 固定亂數種子 | 否 |  | 讓隨機操作可重現的固定種子值。 |
| local cache | 本機快取 | 否 |  | 儲存在本機、供後續使用的下載資料副本。 |
| cloud storage | 雲端儲存空間 | 否 |  |  |
| storage backend | 儲存後端 | 否 |  | 工具用來存放資料的儲存服務。 |
| sample | 樣本 | 否 |  |  |
| input-output pair | 輸入－輸出配對 | 否 |  | 監督式學習的訓練範例。 |
| data point | 資料點 | 否 |  |  |
| parameter | 參數 | 否 |  |  |
| hyperparameter | 超參數 | 否 |  |  |
| weight | 權重 | 否 | 重量 | 神經網路參數；不得譯成物理重量。 |
| weight matrix | 權重矩陣 | 否 |  |  |
| weight vector | 權重向量 | 否 |  | 模型對特徵套用的權重所構成的向量。 |
| weight update | 權重更新 | 否 |  |  |
| bias (model parameter) | 偏置 | 否 | — | 模型的截距參數。 |
| bias (statistical error) | 偏差 | 否 | — | bias–variance 語境。 |
| variance | 變異數 | 否 | 方差 | 統計量；bias–variance tradeoff 可用「變異」表示模型敏感度。 |
| loss function | 損失函數 | 否 |  |  |
| baseline | 基準模型 | 否 | 基線 | 評估模型時作為比較對象。 |
| success metric | 成功指標 | 否 |  |  |
| random baseline | 隨機基準模型 | 否 |  |  |
| nearest centroid classifier | 最近質心分類器 | 否 |  |  |
| spam filter | 垃圾郵件篩選器 | 否 | 垃圾郵件過濾器 |  |
| cost function | 成本函數 | 否 |  |  |
| objective function | 目標函數 | 否 |  |  |
| machine learning | 機器學習 | 否 |  |  |
| language model | 語言模型 | 否 |  |  |
| recommendation engine | 推薦引擎 | 否 |  |  |
| voice assistant | 語音助理 | 否 |  |  |
| self-driving car | 自動駕駛車 | 否 |  |  |
| deep learning | 深度學習 | 否 |  |  |
| supervised learning | 監督式學習 | 否 |  |  |
| unsupervised learning | 非監督式學習 | 否 | — |  |
| semi-supervised learning | 半監督式學習 | 否 |  |  |
| self-supervised learning | 自我監督式學習 | 否 |  |  |
| label propagation | 標籤傳播 | 否 |  |  |
| pseudo-labeling | 偽標籤法 | 否 |  |  |
| consistency regularization | 一致性正則化 | 否 |  |  |
| contrastive learning | 對比式學習 | 否 |  |  |
| masked language modeling | 遮罩語言模型 | 否 |  |  |
| next-token prediction | next-token prediction | 是 | 下一個詞預測 | token 依使用者指定保留英文。 |
| reinforcement learning | 強化學習 | 否 |  |  |
| classification | 分類 | 否 |  |  |
| regression | 迴歸 | 否 | — | 機器學習任務。 |
| linear regression | 線性迴歸 | 否 | — |  |
| scatter plot | 散佈圖 | 否 |  |  |
| multiple linear regression | 多元線性迴歸 | 否 |  | 使用多個特徵的線性迴歸。 |
| intercept | 截距 | 否 |  | 線性模型中的截距項。 |
| normal equation | 正規方程組 | 否 |  | 線性迴歸的封閉解方法；normal equations 的單數形式。 |
| matrix inversion | 矩陣求逆 | 否 |  |  |
| computational complexity | 計算複雜度 | 否 |  |  |
| polynomial regression | 多項式迴歸 | 否 |  | 以多項式特徵擬合資料的線性迴歸。 |
| polynomial features | 多項式特徵 | 否 |  | 由輸入變數的多項式次方建立的特徵。 |
| R-squared | R 平方 | 否 |  | 以 R^2 表示的迴歸評估指標。 |
| R-squared score | R 平方分數 | 否 |  | 衡量預測值相對於目標平均值的改善程度。 |
| feature standardization | 特徵標準化 | 否 |  | 透過減去平均值並除以標準差縮放特徵。 |
| standardize | 標準化 | 否 |  | 動詞；對資料或特徵執行標準化。 |
| convex paraboloid | 凸拋物面 | 否 |  | 向上開口的凸拋物面。 |
| cost surface | 成本曲面 | 否 |  | 成本函數隨模型參數變化所形成的曲面。 |
| batch gradient descent | 批次梯度下降法 | 否 |  | 每次參數更新都使用整批訓練資料。 |
| mini-batch gradient descent | 小批次梯度下降法 | 否 |  | 每次參數更新都使用一小批訓練樣本。 |
| penalty term | 懲罰項 | 否 |  | 加入成本函數以限制模型參數的項。 |
| lasso regression | LASSO 迴歸 | 否 |  | 使用 L1 正則化的線性迴歸。 |
| logistic regression | 邏輯斯迴歸 | 否 | — |  |
| logistic function | 邏輯斯函數 | 否 |  | 又稱 sigmoid 函數。 |
| binary classification | 二元分類 | 否 |  |  |
| multi-class classification | 多類別分類 | 否 |  |  |
| decision tree | 決策樹 | 否 |  |  |
| classification tree | 分類樹 | 否 |  | 以類別為目標的決策樹。 |
| regression tree | 迴歸樹 | 否 |  | 以數值為目標的決策樹。 |
| random forest | 隨機森林 | 否 |  | 由多棵決策樹集成而成的模型。 |
| internal node | 內部節點 | 否 |  | 決策樹中進行特徵判斷、非葉節點的節點。 |
| root node | 根節點 | 否 |  | 決策樹的起始節點。 |
| rectangular region | 矩形區域 | 否 |  | 決策樹依序切分特徵空間形成的區域。 |
| split criterion | 分割準則 | 否 |  | 用來評估資料切分品質的指標。 |
| impurity | 不純度 | 否 |  | 節點中類別混雜程度的量化指標。 |
| class distribution | 類別分布 | 否 |  | 各類別在資料中的比例。 |
| greedy algorithm | 貪婪演算法 | 否 |  | 每一步都選擇當下最佳選項的演算法。 |
| NP-hard | NP-hard | 是 |  | 計算複雜度分類，保留英文寫法。 |
| split point | 分割點 | 否 |  | 特徵值中用來切分資料的位置。 |
| maximum depth | 最大深度 | 否 |  | 決策樹從根節點到最深葉節點的最大層數。 |
| max depth | 最大深度 | 否 |  | 決策樹深度上限的超參數簡稱。 |
| min samples | 最小樣本數 | 否 |  | 決策樹預剪枝控制的樣本數門檻簡稱。 |
| minimum samples per leaf | 葉節點最小樣本數 | 否 |  | 每個葉節點必須包含的最少樣本數。 |
| minimum information gain | 最低資訊增益 | 否 |  | 允許切分所需達到的最低資訊增益。 |
| maximum leaf nodes | 葉節點數上限 | 否 |  | 決策樹可包含的葉節點數量上限。 |
| pre-pruning | 預剪枝 | 否 |  | 在樹完全長成前，依條件停止繼續切分。 |
| post-pruning | 後剪枝 | 否 |  | 完整長成決策樹後，再移除部分子樹。 |
| pruning | 剪枝 | 否 |  | 限制或縮減決策樹以改善泛化能力。 |
| cost-complexity pruning | 成本複雜度剪枝 | 否 |  | 以葉節點數量的懲罰項控制樹的大小。 |
| reduced error pruning | 減少錯誤剪枝 | 否 |  | 若移除子樹不增加驗證誤差，就將其剪除。 |
| validation error | 驗證誤差 | 否 |  | 模型在驗證資料上的預測誤差。 |
| variance reduction | 變異數減少 | 否 |  | 切分後目標值變異數的加權下降量。 |
| model training | 模型訓練 | 否 |  |  |
| training set | 訓練集 | 否 |  |  |
| validation set | 驗證集 | 否 |  |  |
| test set | 測試集 | 否 |  |  |
| training data | 訓練資料 | 否 | 訓練數據 |  |
| validation data | 驗證資料 | 否 |  |  |
| test data | 測試資料 | 否 |  |  |
| dataset split | 資料集切分 | 否 |  |  |
| data leakage | 資料洩漏 | 否 | 數據洩露 |  |
| preprocessing | 前處理 | 否 | 預處理 |  |
| target encoding | 目標編碼 | 否 |  |  |
| numeric column | 數值欄位 | 否 |  |  |
| categorical column | 類別欄位 | 否 |  |  |
| out-of-fold encoding | 折外編碼 | 否 |  | 僅以未參與編碼的訓練折產生訓練資料的編碼，避免資料洩漏。 |
| training fold | 訓練折 | 否 |  | 交叉驗證切分出的訓練資料子集。 |
| median imputation | 中位數補值 | 否 |  | 以中位數補上缺失的數值。 |
| mode imputation | 眾數補值 | 否 |  | 以眾數補上缺失的類別值。 |
| solver | 求解器 | 否 |  | 以演算法求解模型參數的程式元件。 |
| data exploration | 資料探索 | 否 |  |  |
| data drift | 資料漂移 | 否 | 數據漂移 |  |
| generalization | 泛化 | 否 |  |  |
| overfitting | 過度擬合 | 否 |  |  |
| underfitting | 欠擬合 | 否 |  |  |
| regularization | 正則化 | 否 | — | 與特徵 normalization 區分。 |
| dropout | dropout | 是 |  | 在神經網路訓練中保留業界用語。 |
| early stopping | 提前停止 | 否 |  |  |
| deterministic method | 確定性方法 | 否 |  |  |
| no free lunch theorem | No Free Lunch 定理 | 是 |  | 常保留原英文定理名。 |
| explainability | 可解釋性 | 否 |  |  |
| deterministic rule | 確定性規則 | 否 |  |  |
| cryptographic verification | 密碼學驗證 | 否 |  |  |
| normalization | 正規化 | 否 |  | 與 model regularization 區分。 |
| standardization | 標準化 | 否 |  |  |
| cross-validation | 交叉驗證 | 否 |  |  |
| training/validation/test split | 訓練／驗證／測試集切分 | 否 |  |  |
| algorithm | 演算法 | 否 | — |  |
| learning algorithm | 學習演算法 | 否 |  |  |
| supervised | 監督式 | 否 |  | 依上下文與「學習」組合。 |
| unsupervised | 非監督式 | 否 | — |  |
| probability | 機率 | 否 | 概率 |  |
| probability distribution | 機率分布 | 否 | 概率分布 |  |
| normal distribution | 常態分布 | 否 | 正態分布 |  |
| mean | 平均數 | 否 |  | 統計量。 |
| median | 中位數 | 否 |  |  |
| standard deviation | 標準差 | 否 |  |  |
| gradient | 梯度 | 否 |  |  |
| gradient descent | 梯度下降法 | 否 |  | 一律寫完整的「梯度下降法」。不能把較短的寫法放進禁用欄，否則會誤中偏好詞。 |
| least-squares solution | 最小平方法解 | 否 | 最小二乘解 |  |
| ridge regression | 嶺迴歸 | 否 |  |  |
| Gram-Schmidt process | Gram-Schmidt 正交化過程 | 否 |  | 保留演算法名稱。 |
| QR decomposition | QR 分解 | 否 |  |  |
| Gaussian elimination | 高斯消去法 | 否 |  |  |
| pivot | 主元 | 否 |  | 消去法語境。 |
| partial pivoting | 部分選主元 | 否 |  | 高斯消去法語境。 |
| upper triangular matrix | 上三角矩陣 | 否 |  |  |
| lower triangular matrix | 下三角矩陣 | 否 |  |  |
| upper triangular system | 上三角方程組 | 否 |  |  |
| lower triangular system | 下三角方程組 | 否 |  |  |
| back substitution | 回代 | 否 |  | 由最後一個方程式往回求解。 |
| forward substitution | 前向代入 | 否 |  | 由第一個方程式往前求解。 |
| LU decomposition | LU 分解 | 否 |  |  |
| permutation matrix | 置換矩陣 | 否 |  |  |
| Cholesky decomposition | Cholesky 分解 | 否 |  |  |
| Cholesky factor | Cholesky 因子 | 否 |  | 分解 A = LL^T 時的 L。 |
| learning rate | 學習率 | 否 |  |  |
| optimizer | 最佳化器 | 否 | 優化器 |  |
| optimization | 最佳化 | 否 | 優化 |  |
| convergence | 收斂 | 否 | — |  |
| batch | 批次 | 否 | 批量 |  |
| mini-batch | 小批次 | 否 | 小批量 |  |
| epoch | epoch | 是 | — | 訓練時的一輪資料；首次可註明「訓練週期」。 |
| stochastic gradient descent (SGD) | 隨機梯度下降法 | 否 |  |  |
| mean squared error | 均方誤差 | 否 |  |  |
| accuracy | 準確率 | 否 |  |  |
| object detection | 物件偵測 | 否 | 目標檢測 | 影像裡找出每個物體的框與類別。 |
| semantic segmentation | 語意分割 | 否 | 語義分割 | 每個像素一個類別，同類個體不分開。 |
| instance segmentation | 實例分割 | 否 |  | 同一類別的不同個體分開。 |
| panoptic segmentation | 全景分割 | 否 |  | 每個像素有類別，每個可數物體另有唯一 id。 |
| Dice loss | Dice 損失 | 否 |  | Dice 保留英文。 |
| transposed convolution | 轉置卷積 | 否 | 反捲積 | 可學習的上採樣。反卷積是常見誤稱。 |
| bounding box | 邊界框 | 否 |  |  |
| anchor box | 錨框 | 否 |  | 偵測裡預先給定的框形狀。 |
| non-maximum suppression | 非極大值抑制 | 否 |  | 常縮寫 NMS。 |
| objectness | 物件性 | 否 |  | 這個格子中心有沒有物體。 |
| precision | 精確率 | 否 |  |  |
| recall | 召回率 | 否 |  |  |
| sensitivity | 敏感度 | 否 |  | 二元分類中的召回率別名。 |
| true positive | 真陽性 | 否 |  | 實際為正類且預測為正類的樣本。 |
| true negative | 真陰性 | 否 |  | 實際為負類且預測為負類的樣本。 |
| true positive rate | 真陽性率 | 否 |  | 真陽性占所有實際正類樣本的比例；亦稱召回率。 |
| F1 score | F1 分數 | 否 |  |  |
| harmonic mean | 調和平均數 | 否 |  |  |
| confusion matrix | 混淆矩陣 | 否 |  |  |
| threshold | 閾值 | 否 | 閥值 |  |
| decision boundary | 決策邊界 | 否 |  |  |
| linear decision boundary | 線性決策邊界 | 否 |  |  |
| linear algebra | 線性代數 | 否 |  |  |
| linear system | 線性方程組 | 否 | — | Ax=b 語境。 |
| hyperplane | 超平面 | 否 |  | 線性方程式的幾何表示。 |
| invertible | 可逆 | 否 |  | 方陣語境。 |
| inconsistent system | 不相容方程組 | 否 |  | 沒有解的線性方程組。 |
| null space | 零空間 | 否 |  | Ax=0 的解所構成的空間。 |
| row picture | 列觀點 | 否 |  | 以 A 的列描述線性方程組。 |
| column picture | 欄觀點 | 否 |  | 以 A 的欄向量組合描述 Ax=b。 |
| vector | 向量 | 否 |  |  |
| broadcasting | 廣播 | 否 |  | NumPy／框架把小陣列延展成相符形狀的機制。 |
| element-wise | 逐元素 | 否 |  | 對相同位置的元素逐一運算。 |
| dense layer | 密集層 | 否 |  | 每個輸入都連到每個輸出的神經網路層；又稱全連接層。 |
| hidden layer | 隱藏層 | 否 |  | 輸入與輸出層之間的層。 |
| residual connection | 殘差連接 | 否 |  | 把層的輸入直接加回輸出的連線，如 ResNet。 |
| initialization | 初始化 | 否 |  | 設定參數初始值。 |
| weight initialization | 權重初始化 | 否 |  | 決定網路能不能開始訓練的初始權重策略。 |
| Xavier initialization | Xavier 初始化 | 否 |  | 又稱 Glorot。給 sigmoid 與 tanh 用。 |
| Kaiming initialization | Kaiming 初始化 | 否 |  | 又稱 He。給 ReLU 用。 |
| fan-in | fan-in | 是 |  | 一個神經元的輸入連接數。 |
| fan-out | fan-out | 是 |  | 一個神經元的輸出連接數。 |
| residual stream | 殘差流 | 否 |  | 殘差連接一路累加的那條表徵。 |
| BLAS | BLAS | 是 |  | 線性代數運算函式庫標準。 |
| matrix | 矩陣 | 否 |  |  |
| tensor | 張量 | 否 |  |  |
| tensor operation | 張量運算 | 否 |  |  |
| reshape | 重塑 | 否 |  | 張量運算語境。 |
| self-attention | 自注意力 | 否 |  |  |
| multi-head attention | 多頭注意力 | 否 |  |  |
| pairwise distance | 成對距離 | 否 |  |  |
| tensor shape | 張量形狀 | 否 |  |  |
| axis | 軸 | 否 |  |  |
| stride | 步幅 | 否 |  | 張量記憶體索引語境。 |
| memory layout | 記憶體配置 | 否 |  |  |
| contiguous | 連續 | 否 |  | 張量元素在記憶體中依序儲存。 |
| non-contiguous | 非連續 | 否 |  | 張量記憶體配置語境。 |
| permute | 軸置換 | 否 |  | 張量維度順序。 |
| einsum | einsum | 是 |  | Einstein 求和表示法及程式 API 名稱。 |
| Einstein summation | Einstein 求和表示法 | 否 |  | 張量索引表示法。 |
| tensor contraction | 張量縮約 | 否 |  | 對共享索引相乘並加總。 |
| reduction | 歸約 | 否 |  | 張量運算；沿軸聚合或消去維度。 |
| global average pooling | 全域平均池化 | 否 |  | CNN 語境。 |
| row-major | 列優先 | 否 |  | C order。 |
| column-major | 欄優先 | 否 |  | Fortran order。 |
| batch normalization | 批次正規化 | 否 |  |  |
| layer normalization | 層正規化 | 否 |  | 對單一筆樣本的特徵做正規化，不依賴批次。 |
| RMSNorm | RMSNorm | 是 |  | 層正規化去掉減均值。 |
| generalization gap | 泛化差距 | 否 |  | 訓練表現與測試表現的差。 |
| scalar | 純量 | 否 | — |  |
| dot product | 內積 | 否 |  |  |
| matrix multiplication | 矩陣乘法 | 否 |  |  |
| matrix multiply | 矩陣乘法 | 否 |  | 與 matrix multiplication 同義。 |
| normal equations | 正規方程組 | 否 | 正態方程 |  |
| least squares | 最小平方法 | 否 | 最小二乘法 |  |
| linear independence | 線性獨立 | 否 |  |  |
| linear combination | 線性組合 | 否 |  |  |
| linear dependence | 線性相依 | 否 |  |  |
| linearly dependent | 線性相依 | 否 |  |  |
| matrix rank | 矩陣秩 | 否 |  | 與 tensor rank 區分。 |
| full rank | 滿秩 | 否 |  |  |
| rank-deficient | 秩不足 | 否 |  |  |
| well-conditioned | 條件良好 | 否 |  |  |
| ill-conditioned | 條件不良 | 否 |  |  |
| tensor rank | 張量階數 | 否 |  | 指張量的軸數；不可與矩陣秩混用。 |
| basis | 基底 | 否 | — |  |
| standard basis | 標準基底 | 否 |  |  |
| subspace | 子空間 | 否 |  |  |
| projection | 投影 | 否 |  |  |
| orthonormal | 標準正交 | 否 |  |  |
| orthonormal basis | 標準正交基底 | 否 |  |  |
| dimension | 維度 | 否 |  |  |
| vector component | 向量分量 | 否 |  |  |
| coordinate | 座標 | 否 | 坐标 |  |
| origin | 原點 | 否 |  | 座標系統的原點。 |
| coordinate system | 座標系統 | 否 |  |  |
| span | 張成 | 否 |  | 依句子結構譯為「張成空間」或「張成」。 |
| column space | 欄空間 | 否 | — | 與 row space 區分。 |
| row space | 列空間 | 否 | — | 與 column space 區分。 |
| norm | 範數 | 否 |  |  |
| magnitude | 長度／大小 | 否 |  | 向量或複數的 magnitude 依領域可譯為「長度」或「模」。 |
| residual | 殘差 | 否 |  |  |
| orthogonal | 正交 | 否 |  |  |
| orthogonal decomposition | 正交分解 | 否 |  |  |
| L1 norm | L1 範數 | 否 |  |  |
| L2 norm | L2 範數 | 否 |  |  |
| Lp norm | Lp 範數 | 否 |  |  |
| L-infinity norm | L-infinity 範數 | 否 |  |  |
| cosine similarity | 餘弦相似度 | 否 |  |  |
| cosine distance | 餘弦距離 | 否 |  |  |
| Manhattan distance | 曼哈頓距離 | 否 |  |  |
| Chebyshev distance | 切比雪夫距離 | 否 |  | L-infinity 距離。 |
| distance function | 距離函數 | 否 |  |  |
| distance metric | 距離度量 | 否 |  |  |
| unit ball | 單位球 | 否 |  | 範數為 1 的點所構成的集合。 |
| sparsity | 稀疏性 | 否 |  |  |
| sparse solution | 稀疏解 | 否 |  | 大部分參數為零或接近零的解。 |
| outlier | 離群值 | 否 |  |  |
| concentric circle | 同心圓 | 否 |  |  |
| linearly separable | 線性可分 | 否 |  | 可由線性決策邊界正確區分的類別。 |
| threshold tuning | 閾值調整 | 否 |  | 調整分類機率的決策閾值，以取捨精確率與召回率。 |
| whitening | 白化 | 否 |  | 將特徵去相關並正規化。 |
| Mahalanobis distance | 馬氏距離 | 否 |  |  |
| Jaccard similarity | Jaccard 相似度 | 否 |  |  |
| Jaccard distance | Jaccard 距離 | 否 |  |  |
| edit distance | 編輯距離 | 否 |  |  |
| Levenshtein distance | Levenshtein 距離 | 否 |  |  |
| weighted edit distance | 加權編輯距離 | 否 |  |  |
| triangle inequality | 三角不等式 | 否 |  |  |
| Wasserstein distance | Wasserstein 距離 | 否 |  |  |
| Earth Mover's Distance | 推土距離 | 否 |  | Wasserstein distance 的別稱。 |
| optimal transport | 最優傳輸 | 否 |  |  |
| transport plan | 傳輸計畫 | 否 |  |  |
| probability mass | 機率質量 | 否 |  |  |
| cumulative distribution function (CDF) | 累積分布函數（CDF） | 否 |  |  |
| dynamic programming | 動態規劃 | 否 |  |  |
| L1 regularization | L1 正則化 | 否 |  |  |
| L2 regularization | L2 正則化 | 否 |  |  |
| LASSO | LASSO | 是 |  | L1 regularization 方法名稱。 |
| Ridge regularization | 嶺迴歸正則化 | 否 |  |  |
| Elastic Net | Elastic Net | 是 |  | L1 與 L2 正則化方法名稱。 |
| mean absolute error | 平均絕對誤差 | 否 |  |  |
| MAE | MAE | 是 |  | mean absolute error 縮寫。 |
| hinge loss | 合頁損失 | 否 |  |  |
| log-loss | 對數損失 | 否 |  |  |
| triplet loss | 三元組損失 | 否 |  |  |
| contrastive loss | 對比損失 | 否 |  |  |
| approximate nearest neighbor | 近似最近鄰 | 否 |  |  |
| exact nearest neighbor search | 精確最近鄰搜尋 | 否 |  |  |
| KD-tree | KD-tree | 是 |  | 最近鄰搜尋資料結構名稱。 |
| Ball tree | Ball tree | 是 |  | 最近鄰搜尋資料結構名稱。 |
| locality-sensitive hashing | 區域敏感雜湊 | 否 |  |  |
| LSH | LSH | 是 |  | locality-sensitive hashing 縮寫。 |
| HNSW | HNSW | 是 |  | 近似最近鄰搜尋演算法名稱。 |
| IVF | IVF | 是 |  | 倒排檔索引演算法縮寫。 |
| inverted file index | 倒排檔索引 | 否 |  |  |
| product quantization | 乘積量化 | 否 |  |  |
| MinHash | MinHash | 是 |  | 近似估計 Jaccard 相似度的雜湊方法。 |
| intersection over union (IoU) | 交並比（IoU） | 否 |  | 常用於分割模型評估。 |
| KNN | KNN | 是 |  | k-nearest neighbors 縮寫。 |
| ANN | ANN | 是 |  | approximate nearest neighbor 縮寫。 |
| similarity search | 相似度搜尋 | 否 |  |  |
| attention | 注意力 | 否 |  |  |
| attention score | 注意力分數 | 否 |  |  |
| Euclidean distance | 歐幾里得距離 | 否 | — |  |
| dimensionality reduction | 降維 | 否 |  |  |
| curse of dimensionality | 維度災難 | 否 | 維數災難 |  |
| explained variance ratio | 解釋變異比例 | 否 |  | PCA 語境。 |
| elbow method | 手肘法 | 否 |  |  |
| kernel PCA | 核主成分分析 | 否 |  |  |
| kernel function | 核函數 | 否 |  | 與 Jupyter kernel 區分。 |
| kernel trick | 核技巧 | 否 |  |  |
| RBF kernel | RBF 核 | 否 |  | 徑向基底函數核。 |
| manifold | 流形 | 否 |  |  |
| reconstruction error | 重建誤差 | 否 |  |  |
| t-SNE | t-SNE | 是 |  | 方法名稱。 |
| UMAP | UMAP | 是 |  | 方法名稱。 |
| nearest neighbor | 最近鄰 | 否 | 最近邻 |  |
| positive semi-definite | 半正定 | 否 |  |  |
| symmetric matrix | 對稱矩陣 | 否 |  |  |
| symmetric positive definite | 對稱正定 | 否 |  |  |
| symmetric positive semi-definite | 對稱半正定 | 否 |  |  |
| kernel matrix | 核矩陣 | 否 |  | 高斯過程語境。 |
| Gaussian process | 高斯過程 | 否 |  |  |
| log determinant | 對數行列式 | 否 |  |  |
| closed-form solution | 封閉解 | 否 |  |  |
| minimum-norm solution | 最小範數解 | 否 |  |  |
| orthogonal initialization | 正交初始化 | 否 |  |  |
| collinear | 共線 | 否 |  |  |
| collinearity | 共線性 | 否 |  |  |
| feature collinearity | 特徵共線性 | 否 |  |  |
| hypercube | 超立方體 | 否 |  |  |
| pre-image | 原像 | 否 |  |  |
| feature space | 特徵空間 | 否 |  |  |
| transpose | 轉置 | 否 |  | 動詞或運算。 |
| inverse | 反矩陣 | 否 | — | 指矩陣運算時。 |
| identity matrix | 單位矩陣 | 否 |  |  |
| determinant | 行列式 | 否 |  |  |
| transformation | 變換 | 否 |  |  |
| linear transformation | 線性變換 | 否 |  |  |
| matrix transformation | 矩陣變換 | 否 |  |  |
| singular matrix | 奇異矩陣 | 否 |  |  |
| singular system | 奇異系統 | 否 |  |  |
| eigenvalue | 特徵值 | 否 | — | 全書採用常見數學／AI 用語「特徵值」。 |
| eigenvector | 特徵向量 | 否 | — |  |
| eigendecomposition | 特徵分解 | 否 |  | 把矩陣分解為 V @ D @ V^(-1)。 |
| characteristic equation | 特徵方程式 | 否 |  | 根為特徵值的多項式方程 det(A - λI) = 0。 |
| rotation matrix | 旋轉矩陣 | 否 |  | 沿圓弧移動點的正交矩陣。 |
| complex number | 複數 | 否 |  |  |
| complex arithmetic | 複數運算 | 否 |  |  |
| real number | 實數 | 否 |  |  |
| imaginary number | 虛數 | 否 |  |  |
| real part | 實部 | 否 |  | 複數語境。 |
| imaginary part | 虛部 | 否 |  | 複數語境。 |
| imaginary unit | 虛數單位 | 否 |  |  |
| complex plane | 複數平面 | 否 |  |  |
| real axis | 實軸 | 否 |  |  |
| imaginary axis | 虛軸 | 否 |  |  |
| number line | 數線 | 否 |  |  |
| conjugate | 共軛 | 否 |  | 複數語境。 |
| complex conjugate | 共軛複數 | 否 |  |  |
| rectangular form | 直角座標形式 | 否 |  | 複數語境。 |
| polar form | 極式 | 否 |  | 複數語境。 |
| modulus | 模 | 否 |  | 複數的模。 |
| phase | 相位 | 否 |  | 訊號或複數語境。 |
| argument | 輻角 | 否 |  | 複數語境；勿與函數引數混淆。 |
| Euler's formula | 歐拉公式 | 否 |  |  |
| unit circle | 單位圓 | 否 |  |  |
| complex exponential | 複指數函數 | 否 |  |  |
| complex multiplication | 複數乘法 | 否 |  |  |
| rotation operator | 旋轉算子 | 否 |  |  |
| trigonometric function | 三角函數 | 否 |  |  |
| phasor | 相量 | 否 |  |  |
| angular frequency | 角頻率 | 否 |  |  |
| frequency | 頻率 | 否 |  | 訊號語境。 |
| sine wave | 正弦波 | 否 |  |  |
| cosine wave | 餘弦波 | 否 |  |  |
| sinusoidal signal | 正弦訊號 | 否 |  |  |
| signal processing | 訊號處理 | 否 |  |  |
| phase shift | 相位偏移 | 否 |  |  |
| frequency shift | 頻率偏移 | 否 |  |  |
| amplitude | 振幅 | 否 |  |  |
| modulation | 調變 | 否 |  | 訊號語境。 |
| spectrum | 頻譜 | 否 |  |  |
| roots of unity | 單位根 | 否 |  |  |
| primitive root of unity | 本原單位根 | 否 |  |  |
| Fourier transform | 傅立葉轉換 | 否 |  |  |
| discrete Fourier transform | 離散傅立葉轉換 | 否 |  |  |
| DFT | DFT | 是 |  | Discrete Fourier Transform 縮寫。 |
| fast Fourier transform | 快速傅立葉轉換 | 否 |  |  |
| FFT | FFT | 是 |  | Fast Fourier Transform 縮寫。 |
| frequency domain | 頻域 | 否 |  |  |
| frequency component | 頻率成分 | 否 |  |  |
| inverse discrete Fourier transform | 反離散傅立葉轉換 | 否 |  |  |
| IDFT | IDFT | 是 |  | Inverse Discrete Fourier Transform 縮寫。 |
| time domain | 時域 | 否 |  | 訊號以時間索引表示的領域。 |
| space domain | 空間域 | 否 |  | 以空間座標表示的資料領域。 |
| signal | 訊號 | 否 |  | 訊號處理與資料序列語境。 |
| time series | 時間序列 | 否 |  | 按時間順序排列的資料。 |
| frequency coefficient | 頻率係數 | 否 |  | DFT 輸出中代表某個頻率的複數係數。 |
| frequency bin | 頻率槽 | 否 |  | DFT 輸出中索引 k 對應的離散頻率位置。 |
| frequency resolution | 頻率解析度 | 否 |  | 區分相近頻率的能力。 |
| sampling rate | 取樣率 | 否 |  | 訊號處理中每秒取樣的次數。 |
| DC component | 直流分量 | 否 |  | 訊號的零頻率分量。 |
| Nyquist frequency | 奈奎斯特頻率 | 否 |  | 取樣率的一半；實數取樣訊號可表示的最高頻率。 |
| power spectrum | 功率頻譜 | 否 |  | 各頻率係數平方模所呈現的能量分布。 |
| magnitude spectrum | 振幅頻譜 | 否 |  | 各頻率係數的模隨頻率變化的表示。 |
| phase spectrum | 相位頻譜 | 否 |  | 各頻率係數相位隨頻率變化的表示。 |
| spectral analysis | 頻譜分析 | 否 |  | 分析訊號頻率成分的過程。 |
| spectral leakage | 頻譜洩漏 | 否 |  | 非週期訊號被當作週期訊號處理時產生的虛假頻率成分。 |
| Cooley-Tukey algorithm | Cooley-Tukey 演算法 | 否 |  | 以偶數與奇數索引分治計算 FFT 的常見演算法。 |
| twiddle factor | 旋轉因子 | 否 |  | FFT 合併子 DFT 時使用的複指數因子。 |
| butterfly computation | 蝶形運算 | 否 |  | FFT 中合併偶數與奇數子結果的運算。 |
| inverse fast Fourier transform | 反快速傅立葉轉換 | 否 |  | FFT 的反向轉換。 |
| IFFT | IFFT | 是 |  | Inverse Fast Fourier Transform 縮寫。 |
| convolution | 卷積 | 否 |  | 訊號處理與卷積神經網路語境。 |
| convolution theorem | 卷積定理 | 否 |  | 時域卷積等價於頻域逐點相乘。 |
| pointwise multiplication | 逐點乘法 | 否 |  | 對應位置的元素分別相乘。 |
| circular convolution | 循環卷積 | 否 |  | 訊號會週期性繞回的卷積；DFT 自然計算此形式。 |
| linear convolution | 線性卷積 | 否 |  | 不會繞回的標準卷積。 |
| convolution kernel | 卷積核 | 否 |  | 卷積層套用於輸入的權重。 |
| signal filter | 訊號濾波器 | 否 |  | 用來改變或選取訊號頻率成分的系統。 |
| receptive field | 感受野 | 否 |  | 卷積輸出位置所能涵蓋的輸入範圍。 |
| padding | 填充 | 否 |  | 卷積在輸入邊緣補上的值。 |
| depthwise convolution | 深度卷積 | 否 |  | groups 等於輸入通道數的卷積。 |
| translation equivariance | 平移等變 | 否 |  | 輸入平移時，輸出跟著平移。 |
| feature map | 特徵圖 | 否 |  | 神經網路中間層輸出的空間或序列表示。 |
| convolutional layer | 卷積層 | 否 |  | 以卷積核對輸入執行卷積的神經網路層。 |
| window | 視窗 | 否 |  | 訊號處理中指擷取的訊號片段；軟體介面語境亦譯為視窗。 |
| windowing | 加窗 | 否 |  | 對訊號套用窗函數，以降低頻譜洩漏。 |
| window function | 窗函數 | 否 |  | 在訊號片段兩端逐漸衰減的函數。 |
| rectangular window | 矩形窗 | 否 |  | 振幅保持平坦的窗函數。 |
| Hann window | Hann 窗 | 否 |  | 常用的餘弦窗函數。 |
| Hamming window | Hamming 窗 | 否 |  | 常用的改良餘弦窗函數。 |
| Blackman window | Blackman 窗 | 否 |  | 旁瓣抑制效果強的窗函數。 |
| main lobe | 主瓣 | 否 |  | 頻譜窗響應中中央主要波瓣。 |
| side lobe | 旁瓣 | 否 |  | 頻譜窗響應中主瓣以外的波瓣。 |
| Parseval's theorem | 帕塞瓦爾定理 | 否 |  | 傅立葉轉換前後的總能量關係。 |
| energy conservation | 能量守恆 | 否 |  | 轉換前後總能量相同的性質。 |
| short-time Fourier transform | 短時傅立葉轉換 | 否 |  | 對訊號重疊視窗逐一計算 FFT 的轉換。 |
| STFT | STFT | 是 |  | Short-Time Fourier Transform 縮寫。 |
| spectrogram | 頻譜圖 | 否 |  | 以時間與頻率為兩軸表示訊號能量的圖。 |
| chirp | 啁啾訊號 | 否 |  | 頻率隨時間改變的訊號。 |
| hop size | 跳躍長度 | 否 |  | STFT 相鄰視窗起點之間的樣本數。 |
| overlap | 重疊 | 否 |  | 相鄰視窗共用的訊號樣本比例或數量。 |
| mel scale | 梅爾刻度 | 否 |  | 近似人類音高感知的頻率刻度。 |
| mel-spectrogram | 梅爾頻譜圖 | 否 |  | 將頻率映射至梅爾刻度的頻譜圖。 |
| aliasing | 混疊 | 否 |  | 超過奈奎斯特頻率的成分被誤認為較低頻率。 |
| anti-aliasing filter | 抗混疊濾波器 | 否 |  | 取樣前移除奈奎斯特頻率以上成分的濾波器。 |
| low-pass filter | 低通濾波器 | 否 |  | 保留低頻並抑制高頻的濾波器。 |
| downsampling | 降採樣 | 否 |  | 降低訊號取樣率或特徵圖解析度的操作。 |
| anti-aliased pooling | 抗混疊池化 | 否 |  | 降採樣前先抑制高頻成分的池化方法。 |
| zero-padding | 補零 | 否 |  | 在訊號尾端加入零值以延長序列。 |
| observation time | 觀測時間 | 否 |  | 收集訊號樣本的總時間長度。 |
| frequency decomposition | 頻率分解 | 否 |  | 將訊號表示為不同頻率成分的過程。 |
| change of basis | 基底變換 | 否 |  | 以另一組座標基底重新表示相同資訊。 |
| real-valued signal | 實值訊號 | 否 |  | 每個樣本都是實數的訊號。 |
| complex sinusoid | 複數正弦訊號 | 否 |  | 以複數表示的正弦頻率成分。 |
| analog-to-digital converter | 類比數位轉換裝置 | 否 |  | 將類比訊號轉成數位樣本的設備，簡稱 ADC。 |
| phase angle | 相位角 | 否 |  | 表示複數或週期訊號相位的角度。 |
| frequency band | 頻帶 | 否 |  | 頻率範圍。 |
| pure tone | 純音 | 否 |  | 只含單一頻率的聲音。 |
| pitch perception | 音高感知 | 否 |  | 人類對聲音音高的知覺。 |
| linearity | 線性 | 否 |  | 輸入的線性組合會映射為輸出的相同線性組合。 |
| time shift | 時間位移 | 否 |  | 將訊號沿時間軸平移。 |
| conjugate symmetry | 共軛對稱 | 否 |  | 實值訊號的 DFT 係數滿足 X[k] = conj(X[N-k])。 |
| positional encoding | 位置編碼 | 否 |  | transformer 語境。 |
| sinusoidal positional encoding | 正弦位置編碼 | 否 |  | transformer 語境。 |
| RoPE | RoPE | 是 |  | Rotary Position Embedding 縮寫。 |
| Rotary Position Embedding | Rotary Position Embedding | 是 |  | 依專案規範保留 embedding 英文。 |
| quantum computing | 量子計算 | 否 |  |  |
| quantum state | 量子態 | 否 |  |  |
| complex vector space | 複數向量空間 | 否 |  |  |
| scaling matrix | 縮放矩陣 | 否 |  | 沿各軸獨立伸縮的對角矩陣。 |
| shearing matrix | 推移矩陣 | 否 |  | 依另一座標比例平移一座標的矩陣；台灣教材常用「推移」。 |
| reflection | 反射 | 否 |  | 把空間沿軸或平面翻轉的變換。 |
| orthogonal matrix | 正交矩陣 | 否 |  | 欄為標準正交向量的矩陣。 |
| diagonal matrix | 對角矩陣 | 否 |  | 僅主對角線非零的矩陣。 |
| commutative | 可交換 | 否 |  | 運算順序不影響結果的性質。 |
| recurrent neural network | 循環神經網路 | 否 |  | 具有迴圈結構、處理序列的網路；RNN。 |
| RNN | RNN | 是 |  | recurrent neural network 縮寫。 |
| data augmentation | 資料增強 | 否 |  | 以變換擴增訓練資料。 |
| dynamical system | 動態系統 | 否 |  | 狀態隨時間演化的系統。 |
| spectral clustering | 譜分群 | 否 |  | 使用拉普拉斯矩陣特徵值的分群方法。 |
| adjacency matrix | 相鄰矩陣 | 否 |  | 表示圖中節點連接關係的矩陣。 |
| Laplacian | 拉普拉斯矩陣 | 否 |  | 圖論中由度矩陣減相鄰矩陣構成的矩陣。 |
| graph theory | 圖論 | 否 |  | 研究圖及其結構的數學領域。 |
| graph | 圖 | 否 |  | 圖論中的節點與邊結構。 |
| social network | 社群網路 | 否 |  | 以人或帳號為節點、關係為邊的網路。 |
| vertex | 頂點 | 否 |  | 圖中的基本元素，也稱 node。 |
| node | 節點 | 否 |  | 圖中的頂點；此處採圖論語境。 |
| edge | 邊 | 否 |  | 連接圖中兩個頂點的關係。 |
| directed graph | 有向圖 | 否 |  | 邊具有方向的圖。 |
| undirected graph | 無向圖 | 否 |  | 邊沒有方向的圖。 |
| weighted graph | 加權圖 | 否 |  | 邊帶有數值權重的圖。 |
| unweighted graph | 無權圖 | 否 |  | 邊不帶數值權重的圖。 |
| adjacency list | 相鄰串列 | 否 |  | 以每個節點的鄰居清單表示圖的資料結構。 |
| degree | 度數 | 否 |  | 圖論中與節點相連的邊數。 |
| degree matrix | 度矩陣 | 否 |  | 對角線為各節點度數的矩陣。 |
| in-degree | 入度 | 否 |  | 有向圖中指向該節點的邊數。 |
| out-degree | 出度 | 否 |  | 有向圖中從該節點指出的邊數。 |
| degree distribution | 度分布 | 否 |  | 網路中節點度數的分布。 |
| power law | 冪律 | 否 |  | 常見於少數樞紐節點、許多低度節點的網路分布。 |
| hub node | 樞紐節點 | 否 |  | 連接許多其他節點的高程度節點。 |
| leaf node | 葉節點 | 否 |  | 連接邊數很少的節點。 |
| graph traversal | 圖形走訪 | 否 |  | 依規則逐步探索圖中節點與邊的過程。 |
| breadth-first search | 廣度優先搜尋 | 否 |  | 先探索目前節點的所有鄰居，再往更遠層探索。 |
| BFS | BFS | 是 |  | Breadth-First Search 縮寫。 |
| depth-first search | 深度優先搜尋 | 否 |  | 沿一條路徑盡可能深入，再回溯探索。 |
| DFS | DFS | 是 |  | Depth-First Search 縮寫。 |
| queue | 佇列 | 否 |  | 先進先出（FIFO）的資料結構。 |
| shortest path | 最短路徑 | 否 |  | 兩個節點之間邊數或成本最小的路徑。 |
| hop count | 跳數 | 否 |  | 路徑經過的邊數。 |
| cycle detection | 環路偵測 | 否 |  | 判斷圖中是否存在封閉路徑的程序。 |
| back edge | 回邊 | 否 |  | DFS 中連回目前路徑上祖先節點的邊。 |
| connected component | 連通分量 | 否 |  | 最大的連通子圖；其中任兩個節點之間都存在路徑。 |
| connected graph | 連通圖 | 否 |  | 任兩個節點之間都存在路徑的圖。 |
| connectivity | 連通性 | 否 |  | 圖中節點彼此可透過路徑連接的性質。 |
| positive semidefinite | 半正定 | 否 |  | 所有特徵值皆非負的對稱矩陣性質。 |
| Fiedler value | Fiedler 值 | 否 |  | 拉普拉斯矩陣最小的非零特徵值，也稱代數連通度。 |
| Fiedler vector | Fiedler 向量 | 否 |  | 對應 Fiedler 值的特徵向量。 |
| spectral graph theory | 譜圖論 | 否 |  | 以矩陣特徵值與特徵向量研究圖結構的領域。 |
| spectral gap | 譜隙 | 否 |  | 描述特徵值間隔、與圖連通性及隨機漫步收斂有關的量。 |
| random walk | 隨機漫步 | 否 |  | 每一步依機率選擇下一個節點的圖上漫步。 |
| mixing time | 混合時間 | 否 |  | 隨機漫步接近平穩分布所需的時間。 |
| message passing | 訊息傳遞 | 否 |  | 節點從鄰居聚合資訊並更新表示的 GNN 操作。 |
| aggregation | 聚合 | 否 |  | 將多個鄰居訊息合併成一個表示的操作。 |
| linear transform | 線性變換 | 否 |  | linear transformation 的同義說法。 |
| K-hop neighborhood | K 跳鄰域 | 否 |  | 經過 K 條邊可到達的節點範圍。 |
| all-ones vector | 全 1 向量 | 否 |  | 每一個分量都等於 1 的向量。 |
| knowledge base | 知識庫 | 否 |  | 儲存結構化知識以供查詢的系統。 |
| node feature | 節點特徵 | 否 |  | 描述單一圖節點的數值表示。 |
| normalized adjacency matrix | 正規化相鄰矩陣 | 否 |  | 依節點度數或列總和調整後的相鄰矩陣。 |
| normalized Laplacian | 正規化拉普拉斯矩陣 | 否 |  | 依節點度數正規化的圖拉普拉斯矩陣。 |
| self-loop | 自環 | 否 |  | 從節點連回自身的邊。 |
| symmetric normalization | 對稱正規化 | 否 |  | 在相鄰矩陣左右兩側乘上度矩陣的對稱正規化方式。 |
| graph neural network | 圖神經網路 | 否 |  | 以圖結構及節點間訊息傳遞處理資料的神經網路。 |
| GNN | GNN | 是 |  | Graph Neural Network 縮寫。 |
| graph convolution | 圖卷積 | 否 |  | 在圖結構上聚合鄰居資訊的卷積操作。 |
| graph convolutional network | 圖卷積網路 | 否 |  | 以圖卷積處理節點表示的神經網路。 |
| GCN | GCN | 是 |  | Graph Convolutional Network 縮寫。 |
| graph attention network | 圖注意力網路 | 否 |  | 使用注意力機制聚合圖鄰居資訊的神經網路。 |
| GAT | GAT | 是 |  | Graph Attention Network 縮寫。 |
| GraphSAGE | GraphSAGE | 是 |  | 圖神經網路架構名稱，保留英文。 |
| community detection | 社群偵測 | 否 |  | 找出圖中內部連結較緊密之節點群組的工作。 |
| graph partitioning | 圖分割 | 否 |  | 將圖中的節點切分成數個群組。 |
| PageRank | PageRank | 是 |  | 網頁與圖節點重要性排序演算法名稱，保留英文。 |
| clique | 完全子圖 | 否 |  | 任兩個節點都互相連接的子圖。 |
| Dijkstra's algorithm | Dijkstra 演算法 | 否 |  | 在非負權重圖中尋找最短路徑的演算法。 |
| ground truth | 真實標籤 | 否 |  | 評估時作為正確答案的已知標籤。 |
| k-means | k-means | 是 |  | 以距離將資料分成 k 群的演算法，保留英文名稱。 |
| random graph | 隨機圖 | 否 |  | 邊依隨機機制產生的圖。 |
| neighbor | 鄰居節點 | 否 |  | 與指定節點直接相連的圖節點。 |
| knowledge graph | 知識圖譜 | 否 |  | 以節點和邊表示實體及其關係的圖。 |
| derivative | 導數 | 否 |  |  |
| partial derivative | 偏導數 | 否 |  |  |
| chain rule | 連鎖律 | 否 | 鏈鎖律 | 台灣教材標準用語為「連鎖律」。 |
| Jacobian | 雅可比矩陣 | 否 |  |  |
| Hessian | 海森矩陣 | 否 |  |  |
| backpropagation | 反向傳播 | 否 | 反向傳播算法 | 首次寫「反向傳播（backpropagation）」。 |
| automatic differentiation | 自動微分 | 否 |  |  |
| autodiff | 自動微分 | 否 |  |  |
| computational graph | 計算圖 | 否 |  |  |
| forward mode | 正向模式 | 否 |  | 自動微分語境。 |
| reverse mode | 反向模式 | 否 |  | 自動微分語境。 |
| numerical derivative | 數值微分 | 否 |  |  |
| analytical derivative | 解析導數 | 否 |  | 用微積分規則求得的精確導數。 |
| tangent line | 切線 | 否 |  | 曲線在某點的切線。 |
| slope | 斜率 | 否 |  | 直線的傾斜程度。 |
| local minimum | 局部最小值 | 否 |  | 鄰近範圍內的最小值。 |
| global minimum | 全域最小值 | 否 |  | 整個定義域的最小值。 |
| saddle point | 鞍點 | 否 |  | 某些方向向上、某些方向向下的臨界點。 |
| critical point | 臨界點 | 否 |  | 梯度為零的點。 |
| positive definite | 正定 | 否 |  | 所有特徵值為正的矩陣性質。 |
| negative definite | 負定 | 否 |  | 所有特徵值為負的矩陣性質。 |
| indefinite | 不定 | 否 |  | 特徵值正負混合的矩陣性質。 |
| Taylor series | 泰勒級數 | 否 |  | 以導數展開函數的級數。 |
| Newton's method | 牛頓法 | 否 |  | 使用 Hessian 的二階最佳化方法。 |
| constrained optimization | 受限最佳化 | 否 |  |  |
| unconstrained optimization | 無約束最佳化 | 否 |  |  |
| constraint | 限制條件 | 否 |  | 最佳化語境。 |
| equality constraint | 等式限制條件 | 否 |  |  |
| inequality constraint | 不等式限制條件 | 否 |  |  |
| Lagrange multiplier | 拉格朗日乘數 | 否 |  |  |
| Lagrangian | 拉格朗日函數 | 否 |  |  |
| Karush-Kuhn-Tucker conditions | Karush-Kuhn-Tucker（KKT）條件 | 否 |  | 亦稱 KKT conditions。 |
| KKT conditions | KKT 條件 | 否 |  | Karush-Kuhn-Tucker conditions 的縮寫。 |
| stationarity condition | 駐點條件 | 否 |  | KKT 語境。 |
| primal feasibility | 原始可行性 | 否 |  |  |
| dual feasibility | 對偶可行性 | 否 |  |  |
| complementary slackness | 互補鬆弛條件 | 否 |  |  |
| active constraint | 作用中限制條件 | 否 |  |  |
| primal problem | 原始問題 | 否 |  |  |
| dual problem | 對偶問題 | 否 |  |  |
| dual function | 對偶函數 | 否 |  |  |
| duality | 對偶性 | 否 |  |  |
| strong duality | 強對偶性 | 否 |  |  |
| Slater's condition | Slater 條件 | 否 |  |  |
| feasible region | 可行區域 | 否 |  |  |
| integral | 積分 | 否 |  | 計算累積量或曲線下面積的運算。 |
| Bayesian inference | 貝氏推論 | 否 |  | 以貝氏定理做參數推論的方法。 |
| Bayesian network | 貝氏網路 | 否 |  | 由變數間條件相依關係構成的機率圖模型。 |
| variational inference | 變分推論 | 否 |  | 以最佳化近似機率分布的推論方法。 |
| MCMC | MCMC | 是 |  | Markov chain Monte Carlo 縮寫。 |
| L-BFGS | L-BFGS | 是 |  | 擬牛頓最佳化演算法名稱。 |
| conditional random field | 條件隨機場 | 否 |  |  |
| second moment | 二階矩 | 否 |  | Adam 語境，梯度平方的平均量。 |
| natural gradient | 自然梯度 | 否 |  | 使用 Fisher 資訊矩陣的梯度方法。 |
| Fisher information matrix | Fisher 資訊矩陣 | 否 |  | 衡量參數資訊量的矩陣。 |
| K-FAC | K-FAC | 是 |  | Kronecker-Factored Approximate Curvature 方法縮寫。 |
| Kronecker-Factored Approximate Curvature | Kronecker 因子化近似曲率 | 否 |  | K-FAC 方法全名。 |
| Kronecker product | Kronecker 積 | 否 |  |  |
| Hessian-free optimization | 免形成海森矩陣的最佳化 | 否 |  |  |
| Hessian-vector product | 海森矩陣向量積 | 否 |  |  |
| Hutchinson's estimator | Hutchinson 估計量 | 否 |  |  |
| diagonal approximation | 對角近似 | 否 |  |  |
| marginal likelihood | 邊際概似 | 否 |  | 對參數積分後的資料概似。 |
| normalization constant | 正規化常數 | 否 |  | 使機率總和為 1 的常數。 |
| empirical | 經驗 | 否 |  | 由觀測資料計算而非理論推得。 |
| knowledge distillation | 知識蒸餾 | 否 |  | 用大模型教小模型的技術。 |
| ELBO | ELBO | 是 |  | evidence lower bound 縮寫。 |
| loss landscape | 損失地景 | 否 |  | 損失函數隨參數變化的地形。 |
| overparameterization | 過度參數化 | 否 |  |  |
| implicit regularization | 隱式正則化 | 否 |  |  |
| sharp minimum | 尖銳極小值 | 否 |  |  |
| flat minimum | 平坦極小值 | 否 |  |  |
| stochastic noise | 隨機雜訊 | 否 |  |  |
| contour plot | 等高線圖 | 否 |  | 以等值線表示函數值的圖。 |
| MSE | MSE | 是 |  | mean squared error 縮寫。 |
| numerical gradient | 數值梯度 | 否 |  |  |
| gradient checking | 梯度檢查 | 否 |  |  |
| dual number | 對偶數 | 否 |  | 自動微分語境。 |
| topological sort | 拓撲排序 | 否 |  |  |
| dynamic graph | 動態圖 | 否 |  | define-by-run 的計算圖。 |
| multi-layer perceptron | 多層感知器 | 否 | 多層感知機 |  |
| upstream gradient | 上游梯度 | 否 |  |  |
| finite difference | 有限差分 | 否 |  |  |
| seed | 種子 | 否 |  | 梯度種子 dy/dy = 1 語境；random seed 用隨機種子。 |
| autograd | 自動微分 | 否 |  | 系統名 PyTorch autograd 保留英文。 |
| gradient accumulation | 梯度累積 | 否 |  |  |
| gradient clipping | 梯度裁剪 | 否 |  |  |
| activation function | 活化函數 | 否 | 激活函數 |  |
| ReLU | ReLU | 是 |  | 函數名稱保留。 |
| tanh | tanh | 是 |  | 函數名稱保留。 |
| GELU | GELU | 是 |  | Gaussian Error Linear Unit，函數名稱保留。 |
| Leaky ReLU | Leaky ReLU | 是 |  | 負側保留小斜率。 |
| Swish | Swish | 是 |  | x * sigmoid(x)。 |
| SiLU | SiLU | 是 |  | Swish 的另一個名稱。 |
| dead neuron | 死亡神經元 | 否 |  | ReLU 輸入恆為負，輸出與梯度皆為 0。 |
| saturation | 飽和 | 否 |  | 活化函數導數接近 0 的區域。 |
| nonlinearity | 非線性 | 否 |  |  |
| softmax | softmax | 是 |  | 函數名稱保留。 |
| softmax regression | softmax 迴歸 | 否 |  | 以 softmax 函數擴展至多類別分類的線性模型。 |
| sigmoid function | sigmoid 函數 | 否 |  | 函數名稱常保留英文。 |
| binary cross-entropy | 二元交叉熵 | 否 |  | 二元分類常用的機率預測損失。 |
| binary cross-entropy loss | 二元交叉熵損失 | 否 |  | 又稱 log loss。 |
| log loss | 對數損失 | 否 |  | 二元交叉熵損失的別名。 |
| categorical cross-entropy | 類別交叉熵 | 否 |  | 多類別分類常用的損失函數。 |
| convex cost surface | 凸成本曲面 | 否 |  |  |
| non-convex cost surface | 非凸成本曲面 | 否 |  |  |
| cross-entropy | 交叉熵 | 否 |  |  |
| entropy | 熵 | 否 |  |  |
| Gini impurity | 基尼不純度 | 否 |  | 根據類別比例計算節點中樣本被誤分類的機率。 |
| KL divergence | KL 散度 | 否 | — |  |
| mutual information | 互資訊 | 否 |  |  |
| conditional entropy | 條件熵 | 否 |  |  |
| joint entropy | 聯合熵 | 否 |  |  |
| information content | 資訊量 | 否 |  |  |
| information theory | 資訊理論 | 否 |  |  |
| perplexity | 困惑度 | 否 |  | 語言模型評估指標。 |
| label smoothing | 標籤平滑 | 否 |  |  |
| focal loss | 焦點損失 | 否 |  | 用 (1-p_t)^gamma 降低簡單樣本的權重。 |
| InfoNCE | InfoNCE | 是 |  | 對比學習常用的損失，又稱 NT-Xent。 |
| Huber loss | Huber 損失 | 否 |  | 小誤差用 MSE、大誤差用 MAE。 |
| distribution shift | 分布偏移 | 否 |  | 訓練與實際使用時資料分布不同。 |
| soft target | 軟目標 | 否 |  |  |
| hard target | 硬目標 | 否 |  |  |
| negative log-likelihood | 負對數概似 | 否 |  |  |
| bit | 位元 | 否 | 比特 | 資訊單位。 |
| nat | 奈特 | 否 |  | 以自然對數為底的資訊單位。 |
| calibration | 校準 | 否 |  | 預測機率反映真實不確定性。 |
| Pearson correlation | 皮爾森相關係數 | 否 |  |  |
| Spearman correlation | 斯皮爾曼相關係數 | 否 |  |  |
| monotonic | 單調 | 否 |  |  |
| binning | 分箱 | 否 |  |  |
| information gain | 資訊增益 | 否 | 信息增益 |  |
| feature embedding space | embedding 空間 | 否 | 嵌入空間 | 依使用者指定保留 embedding。 |
| training example | 訓練樣本 | 否 | — |  |
| model parameter | 模型參數 | 否 |  |  |
| bias | 偏置／偏差 | 否 | — | 模型參數用「偏置」；統計誤差用「偏差」；公平性語境可用「偏見」。 |
| bias-variance tradeoff | 偏差－變異取捨 | 否 |  |  |
| irreducible noise | 不可約雜訊 | 否 |  |  |
| principal component analysis (PCA) | 主成分分析 | 否 |  |  |
| singular value decomposition (SVD) | 奇異值分解 | 否 | — |  |
| left singular vector | 左奇異向量 | 否 |  |  |
| right singular vector | 右奇異向量 | 否 |  |  |
| pseudoinverse | 廣義反矩陣 | 否 |  |  |
| Moore-Penrose pseudoinverse | Moore–Penrose 廣義反矩陣 | 否 |  |  |
| condition number | 條件數 | 否 |  |  |
| Frobenius norm | Frobenius 範數 | 否 |  |  |
| power iteration | 冪次迭代 | 否 |  |  |
| Eckart-Young theorem | Eckart–Young 定理 | 否 |  |  |
| low-rank approximation | 低秩近似 | 否 |  |  |
| outer product | 外積 | 否 |  |  |
| compression ratio | 壓縮率 | 否 |  |  |
| image compression | 影像壓縮 | 否 |  | 避免與 Docker image 混淆。 |
| recommendation system | 推薦系統 | 否 |  |  |
| recommender system | 推薦系統 | 否 |  |  |
| latent factor | 潛在因子 | 否 |  | 推薦系統語境。 |
| Latent Semantic Analysis | 潛在語意分析 | 否 |  |  |
| Latent Semantic Indexing | 潛在語意索引 | 否 |  |  |
| term-document matrix | 詞項－文件矩陣 | 否 |  |  |
| document-term matrix | 詞項－文件矩陣 | 否 |  |  |
| document-term frequency table | 詞項－文件詞頻表 | 否 |  |  |
| deflate (matrix) | 對矩陣做降階處理 | 否 |  | SVD 演算法語境。 |
| noise floor | 噪底 | 否 |  |  |
| overdetermined system | 超定系統 | 否 |  |  |
| sparse matrix | 稀疏矩陣 | 否 |  |  |
| sparse system | 稀疏系統 | 否 |  |  |
| iterative method | 迭代法 | 否 |  |  |
| iterative solver | 迭代求解器 | 否 |  |  |
| conjugate gradient | 共軛梯度法 | 否 |  |  |
| CG | CG | 是 |  | conjugate gradient 縮寫。 |
| search direction | 搜尋方向 | 否 |  |  |
| preconditioning | 預條件化 | 否 |  | 數值線性代數語境。 |
| preconditioner | 預條件子 | 否 |  |  |
| alternating least squares | 交替最小平方法 | 否 |  | ALS。 |
| noise reduction | 降噪 | 否 |  |  |
| matrix factorization | 矩陣分解 | 否 |  |  |
| truncated SVD | 截斷奇異值分解 | 否 |  |  |
| SVD truncation | SVD 截斷 | 否 |  |  |
| low-rank | 低秩 | 否 |  |  |
| singular value | 奇異值 | 否 | — |  |
| principal component | 主成分 | 否 |  |  |
| covariance matrix | 共變異數矩陣 | 否 | 協方差矩陣 |  |
| correlation | 相關性 | 否 |  |  |
| one-hot encoding | one-hot 編碼 | 否 | — | 業界常保留 one-hot。 |
| one-vs-rest | 一對多 | 否 |  | 多類別分類策略，逐一將一個類別與其他類別區分。 |
| clustering | 分群 | 否 | 聚類 |  |
| cluster | 群集 | 否 |  | 動詞依句型譯為「分群」。 |
| centroid | 質心 | 否 |  |  |
| support vector machine | 支援向量機 | 否 |  |  |
| support vector | 支援向量 | 否 |  | SVM 語境。 |
| maximum margin | 最大間隔 | 否 |  | SVM 分類邊界語境。 |
| maximum margin classifier | 最大間隔分類器 | 否 |  |  |
| maximum margin principle | 最大間隔原則 | 否 |  |  |
| margin | 間隔 | 否 |  | SVM 語境；與 decision boundary 區分。 |
| margin width | 間隔寬度 | 否 |  |  |
| margin violation | 間隔違規 | 否 |  |  |
| soft margin | 軟間隔 | 否 |  | 允許資料點違反間隔條件的 SVM formulation。 |
| slack variable | 鬆弛變數 | 否 |  |  |
| C parameter | C 參數 | 否 |  | SVM 正則化取捨參數。 |
| regularization strength | 正則化強度 | 否 |  |  |
| primal formulation | 原始形式 | 否 |  | 最佳化問題語境。 |
| dual formulation | 對偶形式 | 否 |  | 最佳化問題語境。 |
| Lagrangian dual | 拉格朗日對偶 | 否 |  |  |
| quadratic program | 二次規劃問題 | 否 |  |  |
| convex quadratic program | 凸二次規劃問題 | 否 |  |  |
| linear kernel | 線性核 | 否 |  |  |
| polynomial kernel | 多項式核 | 否 |  |  |
| support vector regression | 支援向量迴歸 | 否 |  | 可縮寫為 SVR。 |
| epsilon tube | ε 管狀區域 | 否 |  | SVR 語境。 |
| epsilon-insensitive loss | ε 不敏感損失 | 否 |  | SVR 語境。 |
| one-class SVM | 單類別 SVM | 否 |  | 異常偵測方法。 |
| gamma parameter | gamma 參數 | 否 |  | RBF 核語境。 |
| epsilon parameter | ε 參數 | 否 |  | SVR 語境。 |
| logistic loss | 邏輯斯損失 | 否 |  | 與 logistic regression 的分類損失。 |
| scalability | 可擴充性 | 否 |  |  |
| feature mapping | 特徵映射 | 否 |  | 核方法語境；將輸入映射到特徵空間。 |
| K-nearest neighbors | k 最近鄰法 | 否 |  | 可保留 KNN 縮寫。 |
| L1 distance | L1 距離 | 否 |  |  |
| L2 distance | L2 距離 | 否 |  |  |
| Minkowski distance | Minkowski 距離 | 否 |  | 專有名稱保留英文拼寫。 |
| distance weighting | 距離加權 | 否 |  |  |
| distance-weighted voting | 距離加權投票 | 否 |  |  |
| distance-weighted KNN | 距離加權 KNN | 否 |  |  |
| weighted KNN | 加權 KNN | 否 |  |  |
| lazy learning | 惰性學習 | 否 |  |  |
| eager learning | 積極式學習 | 否 |  | 指訓練時計算並建立模型；與 active learning 區分。 |
| lazy learner | 惰性學習器 | 否 |  |  |
| eager learner | 積極式學習器 | 否 |  | 指訓練時計算並建立模型；與 active learner 區分。 |
| non-parametric algorithm | 非參數演算法 | 否 |  |  |
| brute force search | 暴力搜尋 | 否 |  |  |
| hypersphere | 超球面 | 否 |  |  |
| intrinsic dimensionality | 內在維度 | 否 |  |  |
| query point | 查詢點 | 否 |  |  |
| Voronoi diagram | Voronoi 圖 | 否 |  |  |
| piecewise-constant | 分段常數 | 否 |  |  |
| piecewise-smooth | 分段平滑 | 否 |  |  |
| extrapolation | 外插 | 否 |  | 機器學習預測語境。 |
| retrieval-augmented generation | 檢索增強生成 | 否 |  | RAG 的全名。 |
| KNN regression | KNN 迴歸 | 否 |  |  |
| anomaly detection | 異常偵測 | 否 |  |  |
| weight decay | 權重衰減 | 否 | — |  |
| momentum | 動量 | 否 |  |  |
| learning rate schedule | 學習率排程 | 否 |  |  |
| step decay | 步進衰減 | 否 |  | 學習率排程語境。 |
| exponential decay | 指數衰減 | 否 |  |  |
| cosine annealing | 餘弦退火 | 否 |  | 學習率排程語境。 |
| warmup | 預熱 | 否 |  | 學習率暖身語境。 |
| 1cycle policy | 1cycle 策略 | 否 |  | Leslie Smith 的單週期學習率排程。 |
| convex function | 凸函數 | 否 |  |  |
| non-convex | 非凸 | 否 |  |  |
| convex set | 凸集合 | 否 |  |  |
| convexity | 凸性 | 否 |  |  |
| concave function | 凹函數 | 否 |  |  |
| convex optimization | 凸最佳化 | 否 |  |  |
| line segment | 線段 | 否 |  |  |
| halfspace | 半空間 | 否 |  |  |
| second derivative test | 二階導數判別法 | 否 |  |  |
| Hessian test | 海森矩陣判別法 | 否 |  |  |
| first-order method | 一階方法 | 否 |  |  |
| second-order method | 二階方法 | 否 |  |  |
| quadratic convergence | 二次收斂 | 否 |  |  |
| curvature | 曲率 | 否 |  |  |
| quadratic approximation | 二次近似 | 否 |  |  |
| scale-invariant | 尺度不變 | 否 |  |  |
| velocity | 速度 | 否 |  | 動量語境。 |
| bias correction | 偏差校正 | 否 |  | Adam 語境。 |
| Adam | Adam | 是 |  | 最佳化演算法名稱。 |
| AdamW | AdamW | 是 |  | 把權重衰減從 Adam 的自適應縮放裡拆開。 |
| RMSProp | RMSProp | 是 |  | 依每個參數近期梯度的均方根調整學習率。 |
| SGD | SGD | 是 |  | 首次寫「隨機梯度下降法（SGD）」。 |
| logit | logit | 是 |  | 多個值用 logits；AI 工程語境保留。 |
| logits | logits | 是 |  |  |
| probability density function (PDF) | 機率密度函數 | 否 | 概率密度函数 | 數學語境；避免與 PDF 檔案格式混淆。 |
| Bernoulli distribution | 伯努利分布 | 否 |  |  |
| categorical distribution | 類別分布 | 否 |  |  |
| Poisson distribution | 卜瓦松分布 | 否 | 泊松分布 | 台灣譯卜瓦松。 |
| uniform distribution | 均勻分布 | 否 |  |  |
| joint distribution | 聯合分布 | 否 |  |  |
| marginal distribution | 邊際分布 | 否 |  |  |
| central limit theorem (CLT) | 中央極限定理 | 否 | 中心極限定理 | 台灣常稱中央極限定理。 |
| independence | 獨立 | 否 |  | 事件獨立語境。 |
| sample space | 樣本空間 | 否 |  |  |
| underflow | 下溢位 | 否 |  | 數值低於可表示範圍。 |
| overflow | 溢位 | 否 |  | 數值超過可表示範圍。 |
| log probability | 對數機率 | 否 | 對數概率 |  |
| inverse transform sampling | 反函數取樣 | 否 | 逆變換採樣 |  |
| rejection sampling | 拒絕取樣 | 否 |  |  |
| reparameterization trick | 重參數化技巧 | 否 |  | VAE 語境。 |
| probability mass function (PMF) | 機率質量函數 | 否 |  |  |
| expected value | 期望值 | 否 |  |  |
| conditional probability | 條件機率 | 否 | 條件概率 |  |
| prior probability | 先驗機率 | 否 |  |  |
| posterior probability | 後驗機率 | 否 |  |  |
| likelihood | 概似 | 否 | 似然 |  |
| maximum likelihood estimation (MLE) | 最大概似估計 | 否 |  |  |
| maximum a posteriori (MAP) | 最大後驗機率估計 | 否 |  |  |
| Bayes' theorem | 貝氏定理 | 否 | 貝葉斯定理 |  |
| evidence | 證據 | 否 |  | 貝氏定理分母語境。 |
| naive Bayes | 單純貝氏 | 否 | 朴素貝叶斯 |  |
| Laplace smoothing | 拉普拉斯平滑 | 否 |  |  |
| false positive | 偽陽性 | 否 | 假陽性 | 檢定誤報語境；台灣醫檢用偽陽性。 |
| false negative | 偽陰性 | 否 | 假陰性 |  |
| conjugate prior | 共軛先驗 | 否 |  |  |
| Beta distribution | Beta 分布 | 否 |  | 希臘字母名保留英文。 |
| frequentist | 頻率學派 | 否 |  | 與貝氏學派對比。 |
| Bayesian | 貝氏 | 否 | 貝葉斯 | 台灣譯貝氏。 |
| credible interval | 可信度區間 | 否 |  | 貝氏語境。 |
| confidence interval | 信賴區間 | 否 | 置信區間 | 頻率學派語境。 |
| Thompson sampling | 湯普森取樣 | 否 |  |  |
| bandit | bandit | 是 |  | multi-armed bandit 語境保留英文。 |
| online learning | 線上學習 | 否 |  | 逐步更新語境。 |
| A/B testing | A/B 測試 | 否 |  |  |
| descriptive statistics | 描述統計 | 否 |  |  |
| measure of central tendency | 集中趨勢指標 | 否 |  |  |
| measure of spread | 離散程度指標 | 否 |  |  |
| mode (statistics) | 眾數 | 否 |  | 統計量。 |
| percentile | 百分位數 | 否 |  |  |
| range (statistics) | 全距 | 否 |  | 統計量，最大值減最小值。 |
| interquartile range | 四分位距 | 否 |  |  |
| IQR | IQR | 是 |  | interquartile range 縮寫。 |
| sample mean | 樣本平均數 | 否 |  |  |
| population mean | 母體平均數 | 否 |  |  |
| sample variance | 樣本變異數 | 否 |  |  |
| population variance | 母體變異數 | 否 |  |  |
| Bessel's correction | 貝塞爾校正 | 否 |  |  |
| covariance | 共變異數 | 否 |  |  |
| correlation coefficient | 相關係數 | 否 |  |  |
| Spearman rank correlation | 斯皮爾曼等級相關係數 | 否 |  |  |
| correlation matrix | 相關矩陣 | 否 |  |  |
| linear association | 線性關聯 | 否 |  |  |
| monotonic association | 單調關聯 | 否 |  |  |
| ordinal data | 序位資料 | 否 |  |  |
| continuous data | 連續資料 | 否 |  |  |
| categorical data | 類別資料 | 否 |  |  |
| hypothesis testing | 假設檢定 | 否 |  |  |
| null hypothesis | 虛無假設 | 否 |  |  |
| alternative hypothesis | 對立假設 | 否 |  |  |
| p-value | p 值 | 否 |  |  |
| significance level | 顯著水準 | 否 |  |  |
| confidence level | 信賴水準 | 否 |  |  |
| t-test | t 檢定 | 否 |  |  |
| one-sample t-test | 單一樣本 t 檢定 | 否 |  |  |
| two-sample t-test | 雙樣本 t 檢定 | 否 |  |  |
| paired t-test | 成對樣本 t 檢定 | 否 |  |  |
| Welch's t-test | Welch t 檢定 | 否 |  |  |
| degrees of freedom | 自由度 | 否 |  |  |
| chi-squared test | 卡方檢定 | 否 |  |  |
| observed frequency | 觀察頻數 | 否 |  |  |
| expected frequency | 期望頻數 | 否 |  |  |
| effect size | 效果量 | 否 |  |  |
| Cohen's d | Cohen's d | 是 |  | 效果量指標。 |
| statistical significance | 統計顯著性 | 否 |  |  |
| practical significance | 實務顯著性 | 否 |  |  |
| multiple comparisons | 多重比較 | 否 |  |  |
| Bonferroni correction | Bonferroni 校正 | 否 |  |  |
| Type I error | 第一類錯誤 | 否 |  | 虛無假設為真卻被拒絕。 |
| Type II error | 第二類錯誤 | 否 |  | 虛無假設為假卻未被拒絕。 |
| false positive rate | 偽陽性率 | 否 |  |  |
| ROC curve | ROC 曲線 | 否 |  | 以不同分類閾值下的真陽性率與偽陽性率描繪的曲線。 |
| area under the curve | 曲線下面積 | 否 |  | 分類模型 ROC 曲線下面積的 AUC。 |
| trapezoidal rule | 梯形法則 | 否 |  | 以梯形近似曲線下積分的數值方法。 |
| statistical power | 檢定力 | 否 |  | 正確拒絕虛無假設的機率。 |
| right skew | 右偏 | 否 |  | 數值較多集中在較小值，尾部向右延伸。 |
| left skew | 左偏 | 否 |  | 數值較多集中在較大值，尾部向左延伸。 |
| p-hacking | p-hacking | 是 |  | 反覆嘗試分析方式以取得顯著結果，保留英文。 |
| fairness metric | 公平性指標 | 否 |  |  |
| AUC | AUC | 是 |  | area under the curve 縮寫。 |
| mean decrease in impurity | 平均不純度下降 | 否 |  | 特徵在樹中帶來的不純度減少量總和。 |
| MDI | MDI | 是 |  | mean decrease in impurity 的縮寫。 |
| high-cardinality feature | 高基數特徵 | 否 |  | 具有許多不同取值的特徵。 |
| permutation importance | 置換重要度 | 否 |  | 打亂一個特徵後，以模型準確率下降量衡量其重要度。 |
| gradient boosted tree | 梯度提升樹 | 否 |  | 以逐步修正前一棵樹錯誤的方式建立的樹模型。 |
| sampling distribution | 抽樣分布 | 否 |  |  |
| bootstrap | bootstrap | 是 |  | 統計重抽樣方法，保留英文。 |
| bootstrap sample | bootstrap 樣本 | 否 |  | 從訓練資料中有放回抽出的樣本集合。 |
| bootstrap sampling | bootstrap 抽樣 | 否 |  | 以有放回抽樣建立 bootstrap 樣本。 |
| bootstrap aggregating | bootstrap 聚合 | 否 |  | bagging 名稱的完整形式。 |
| bagging | bagging | 是 |  | bootstrap aggregating 的縮寫，保留英文。 |
| out-of-bag sample | 袋外樣本 | 否 |  | 未被抽入某棵樹 bootstrap 樣本的原始樣本。 |
| feature randomization | 特徵隨機化 | 否 |  | 在每次切分時隨機挑選可考慮的特徵子集。 |
| decorrelated trees | 去相關的樹 | 否 |  | 彼此輸出相關性較低的決策樹。 |
| ensemble | 集成 | 否 |  | 將多個模型的預測合併。 |
| ensemble method | 集成方法 | 否 |  | 結合多個模型以產生預測的方法。 |
| weak learner | 弱學習器 | 否 |  | 單獨預測能力有限、可透過集成提升表現的模型。 |
| majority vote | 多數決 | 否 |  | 以票數最多的類別作為分類結果。 |
| weighted average | 加權平均 | 否 |  | 依各項目權重計算的平均值。 |
| resampling with replacement | 有放回重抽樣 | 否 |  |  |
| percentile method | 百分位數法 | 否 |  |  |
| point estimate | 點估計 | 否 |  |  |
| parametric test | 參數檢定 | 否 |  |  |
| non-parametric test | 無母數檢定 | 否 |  |  |
| Mann-Whitney U test | Mann-Whitney U 檢定 | 否 |  |  |
| Wilcoxon signed-rank test | Wilcoxon 符號等級檢定 | 否 |  |  |
| Kruskal-Wallis test | Kruskal-Wallis 檢定 | 否 |  |  |
| ANOVA | ANOVA | 是 |  | analysis of variance 縮寫。 |
| independent and identically distributed | 獨立同分布 | 否 |  |  |
| heavy-tailed distribution | 厚尾分布 | 否 |  |  |
| normality | 常態性 | 否 |  |  |
| skewed distribution | 偏斜分布 | 否 |  |  |
| sample size | 樣本數 | 否 |  |  |
| population | 母體 | 否 |  |  |
| standardized variable | 標準化變數 | 否 |  |  |
| imbalanced data | 類別不平衡資料 | 否 |  |  |
| base rate | 基礎率 | 否 |  | base rate fallacy 語境。 |
| sampling | 抽樣 | 否 | 采样 | 統計抽取樣本時用「抽樣」；生成模型的特定演算法名稱依既定譯法用「取樣」。 |
| distribution | 分布 | 否 | — |  |
| model complexity | 模型複雜度 | 否 |  |  |
| target | 目標 | 否 |  | 依變數或預測目標。 |
| vector database | 向量資料庫 | 否 | 向量數據庫 |  |
| transformer model | transformer | 是 | 轉換器模型 | 依使用者指定保留 transformer。 |
| sampling method | 抽樣方法 | 否 |  |  |
| uniform random sampling | 均勻隨機抽樣 | 否 |  |  |
| uniform random number generator | 均勻亂數產生器 | 否 |  |  |
| uniform random number | 均勻亂數 | 否 |  |  |
| inverse CDF | CDF 反函數 | 否 |  |  |
| inverse CDF method | 反函數取樣 | 否 |  |  |
| exponential distribution | 指數分布 | 否 |  |  |
| standard normal distribution | 標準常態分布 | 否 |  |  |
| truncated normal distribution | 截斷常態分布 | 否 |  |  |
| Cauchy distribution | 柯西分布 | 否 |  |  |
| importance sampling | 重要性取樣 | 否 |  |  |
| importance weight | 重要性權重 | 否 |  |  |
| self-normalized importance sampling | 自我正規化重要性取樣 | 否 |  |  |
| estimator | 估計量 | 否 |  |  |
| expectation | 期望值 | 否 |  |  |
| Monte Carlo | 蒙地卡羅 | 否 |  |  |
| Monte Carlo estimation | 蒙地卡羅估計 | 否 |  |  |
| law of large numbers | 大數法則 | 否 |  |  |
| partition function | 配分函數 | 否 |  |  |
| stochastic process | 隨機過程 | 否 |  | 隨機狀態隨時間演變的數學模型。 |
| displacement | 位移 | 否 |  | 相對於起始位置的淨位置變化。 |
| Brownian motion | 布朗運動 | 否 |  | 隨機漫步在連續時間下的極限過程。 |
| martingale | 鞅 | 否 |  | 給定目前資訊後，未來值的條件期望等於目前值的隨機過程。 |
| Markov process | 馬可夫過程 | 否 |  | 未來狀態在給定目前狀態後不依賴更早歷史的隨機過程。 |
| Markov property | 馬可夫性質 | 否 |  | 未來狀態在給定目前狀態後，與過去歷史條件獨立的性質。 |
| state | 狀態 | 否 |  | 馬可夫鏈或強化學習系統在某一時刻的狀況。 |
| transition matrix | 轉移矩陣 | 否 |  | 表示系統從一個狀態轉移到另一個狀態之機率的矩陣。 |
| transition probability | 轉移機率 | 否 |  | 系統從目前狀態轉移到指定下一狀態的機率。 |
| power method | 冪次法 | 否 |  | 反覆乘上矩陣以近似主特徵向量的演算法。 |
| left eigenvector | 左特徵向量 | 否 |  | 以左乘方式滿足特徵值方程式的向量。 |
| right eigenvector | 右特徵向量 | 否 |  | 以右乘方式滿足特徵值方程式的向量。 |
| irreducible | 不可約 | 否 |  | 馬可夫鏈中任一狀態都能到達任一其他狀態的性質。 |
| aperiodic | 非週期 | 否 |  | 狀態回返時間不受固定週期限制的性質。 |
| absorbing state | 吸收狀態 | 否 |  | 一旦進入便不會離開的狀態。 |
| total variation distance | 總變差距離 | 否 |  | 衡量兩個機率分布差異的距離。 |
| temperature | 溫度 | 否 |  | 控制機率分布尖銳程度或隨機性程度的參數。 |
| diffusion process | 擴散過程 | 否 |  | 隨時間逐步加入或移除雜訊的隨機過程。 |
| stochastic differential equation | 隨機微分方程 | 否 |  | 含隨機項的微分方程。 |
| SDE | SDE | 是 |  | stochastic differential equation 縮寫。 |
| Langevin dynamics | Langevin 動力學 | 否 |  | 將梯度漂移與隨機雜訊結合的抽樣動力學。 |
| energy function | 能量函數 | 否 |  | 描述狀態能量、並可決定其機率權重的函數。 |
| energy landscape | 能量地形 | 否 |  | 能量函數在狀態空間中的整體形狀。 |
| gradient force | 梯度力 | 否 |  | 由能量函數梯度產生、推動系統移動的力。 |
| random force | 隨機力 | 否 |  | 由隨機擾動產生的力。 |
| gambler's ruin | 賭徒破產問題 | 否 |  | 隨機漫步在吸收邊界間先抵達指定邊界的機率問題。 |
| Markov decision process | 馬可夫決策過程 | 否 |  | 以狀態、動作、轉移機率和獎勵描述的決策模型。 |
| random policy | 隨機策略 | 否 |  | 依機率分布選擇動作的策略。 |
| normalizing constant | 正規化常數 | 否 |  | normalization constant 的同義說法。 |
| prior distribution | 先驗分布 | 否 |  | 觀察資料前對參數或假設所指定的機率分布。 |
| fractal | 分形 | 否 |  | 在不同尺度下呈現相似結構的幾何形態。 |
| fractal dimension | 分形維度 | 否 |  | 描述分形結構在不同尺度下複雜度的維度。 |
| independent increments | 獨立增量 | 否 |  | 不重疊時間區間上的增量彼此獨立的性質。 |
| simulated annealing | 模擬退火法 | 否 |  | 逐步降低溫度以搜尋低能量解的最佳化方法。 |
| double-well potential | 雙井位能 | 否 |  | 具有兩個局部低谷的位能函數。 |
| stochastic gradient Langevin dynamics | 隨機梯度 Langevin 動力學 | 否 |  | 結合隨機梯度與 Langevin 雜訊的近似貝葉斯抽樣方法。 |
| SGLD | SGLD | 是 |  | stochastic gradient Langevin dynamics 縮寫。 |
| DDPM | DDPM | 是 |  | denoising diffusion probabilistic model 縮寫。 |
| denoising diffusion probabilistic model | 去噪擴散機率模型 | 否 |  | DDPM 全名。 |
| score-based generative model | 基於分數的生成模型 | 否 |  | 使用資料分布分數函數建構的生成模型。 |
| exploration | 探索 | 否 |  | 強化學習中嘗試不同動作以蒐集資訊的行為。 |
| exploitation | 利用 | 否 |  | 強化學習中選擇目前估計最佳動作以取得回報的行為。 |
| embedding dimension | embedding 維度 | 否 |  | embedding 向量的維數；依專案規範保留 embedding 英文。 |
| acceptance probability | 接受機率 | 否 |  | MCMC 中接受提議樣本的機率。 |
| Markov chain | 馬可夫鏈 | 否 |  |  |
| Markov chain Monte Carlo | 馬可夫鏈蒙地卡羅 | 否 |  | MCMC 全名。 |
| Metropolis-Hastings | Metropolis-Hastings | 是 |  | 演算法名稱保留英文。 |
| target distribution | 目標分布 | 否 |  |  |
| proposal distribution | 提議分布 | 否 |  |  |
| stationary distribution | 平穩分布 | 否 |  |  |
| posterior distribution | 後驗分布 | 否 |  |  |
| acceptance ratio | 接受比率 | 否 |  |  |
| acceptance rate | 接受率 | 否 |  |  |
| burn-in | 暖身期 | 否 |  | MCMC 語境。 |
| thinning | 抽稀 | 否 |  | MCMC 語境。 |
| autocorrelation | 自相關 | 否 |  |  |
| detailed balance | 細緻平衡 | 否 |  |  |
| proposal scale | 提議尺度 | 否 |  |  |
| Gibbs sampling | Gibbs 取樣 | 否 |  |  |
| conditional distribution | 條件分布 | 否 |  |  |
| temperature sampling | 溫度取樣 | 否 |  | 語言模型生成語境。 |
| greedy decoding | 貪婪解碼 | 否 |  |  |
| top-k sampling | top-k 取樣 | 否 |  |  |
| top-p sampling | top-p 取樣 | 否 |  |  |
| nucleus sampling | 核取樣 | 否 |  | 又稱 top-p sampling。 |
| variational autoencoder (VAE) | 變分自編碼器（VAE） | 否 |  |  |
| Gumbel-Softmax | Gumbel-Softmax | 是 |  | 方法名稱保留英文。 |
| Gumbel-Max trick | Gumbel-Max 技巧 | 否 |  |  |
| Gumbel distribution | Gumbel 分布 | 否 |  |  |
| one-hot vector | one-hot 向量 | 否 |  |  |
| continuous relaxation | 連續鬆弛 | 否 |  |  |
| straight-through estimator | 直通估計器 | 否 |  |  |
| latent space | 潛在空間 | 否 |  |  |
| latent representation | 潛在表徵 | 否 |  |  |
| hard attention | 硬式注意力 | 否 |  |  |
| neural architecture search | 神經架構搜尋 | 否 |  |  |
| stratified sampling | 分層抽樣 | 否 |  |  |
| stratum | 層 | 否 |  | 分層抽樣中的一層。 |
| strata | 層 | 否 |  | stratum 複數。 |
| quasi-Monte Carlo | 準蒙地卡羅 | 否 |  |  |
| neural radiance fields | 神經輻射場 | 否 |  | NeRF 全名。 |
| NeRF | NeRF | 是 |  | neural radiance fields 縮寫。 |
| diffusion model | 擴散模型 | 否 |  |  |
| noise schedule | 雜訊排程 | 否 |  | 擴散模型語境。 |
| ancestral sampling | 祖先取樣 | 否 |  |  |
| forward process | 前向過程 | 否 |  | 擴散模型語境。 |
| reverse process | 反向過程 | 否 |  | 擴散模型語境。 |
| Box-Muller transform | Box-Muller 轉換 | 否 |  |  |
| Ising model | 伊辛模型 | 否 |  |  |
| proximal policy optimization (PPO) | 近端策略最佳化（PPO） | 否 |  | 強化學習演算法。 |
| TRPO | TRPO | 是 |  | trust region policy optimization 縮寫。 |
| policy gradient | 策略梯度 | 否 |  |  |
| trajectory | 軌跡 | 否 |  | 強化學習或 MCMC 路徑語境。 |
| vocabulary | 詞彙表 | 否 |  | 語言模型 token 語境。 |
| encoder | 編碼器 | 否 |  | 神經網路架構語境。 |
| decoder | 解碼器 | 否 |  | 神經網路架構語境。 |
| Gaussian mixture | 高斯混合模型 | 否 |  |  |
| Gaussian distribution | 常態分布 | 否 |  | normal distribution 的同義詞。 |
| Gaussian noise | 高斯雜訊 | 否 |  |  |
| Gaussian proposal | 高斯提議分布 | 否 |  | MCMC 語境。 |
| class balance | 類別平衡 | 否 |  | 訓練資料或交叉驗證切分語境。 |
| generative adversarial network (GAN) | 生成對抗網路（GAN） | 否 |  | 生成模型架構。 |
| large language model (LLM) | 大型語言模型（LLM） | 否 |  |  |
| discrete distribution | 離散分布 | 否 |  |  |
| bimodal distribution | 雙峰分布 | 否 |  |  |
| Lloyd's algorithm | Lloyd 演算法 | 否 |  | K-Means 的標準迭代演算法名稱。 |
| inertia | 慣性 | 否 |  | K-Means 的目標值，為所有資料點到所屬質心的平方距離總和。 |
| silhouette score | 輪廓分數 | 否 |  | 分群品質指標；通常是各資料點輪廓係數的平均值。 |
| silhouette coefficient | 輪廓係數 | 否 |  | 單一資料點的分群品質指標。 |
| DBSCAN | DBSCAN | 是 |  | 密度式分群演算法名稱。 |
| density | 密度 | 否 |  |  |
| density-based clustering | 密度式分群 | 否 |  |  |
| eps | eps | 是 |  | DBSCAN 的鄰域半徑參數；程式識別字保留。 |
| min_samples | min_samples | 是 |  | DBSCAN 的最小鄰域樣本數參數；程式識別字保留。 |
| neighborhood radius | 鄰域半徑 | 否 |  | DBSCAN eps 語境。 |
| core point | 核心點 | 否 |  | DBSCAN 中鄰域樣本數達 min_samples 的點。 |
| border point | 邊界點 | 否 |  | DBSCAN 中位於核心點鄰域、但自身不是核心點的點。 |
| noise point | 雜訊點 | 否 | 噪聲點 | DBSCAN 中不屬於任何群集的點。 |
| hierarchical clustering | 階層式分群 | 否 |  | 建立巢狀群集樹狀結構的分群方法。 |
| agglomerative clustering | 凝聚式分群 | 否 |  | 由下而上合併群集的階層式分群方法。 |
| dendrogram | 樹狀圖 | 否 |  | 顯示階層式分群合併順序的樹狀圖。 |
| linkage | 連結法 | 否 | 鏈結法 | 衡量兩個群集間距離的方式。 |
| single linkage | 單一連結法 | 否 |  | 以兩群集間最小點對距離為準。 |
| complete linkage | 完全連結法 | 否 |  | 以兩群集間最大點對距離為準。 |
| average linkage | 平均連結法 | 否 |  | 以兩群集間所有點對距離的平均值為準。 |
| Ward's method | Ward 法 | 否 |  | 合併後使群內變異數增加量最小的連結方法。 |
| within-cluster variance | 群內變異數 | 否 |  |  |
| Gaussian mixture model | 高斯混合模型 | 否 |  |  |
| GMM | GMM | 是 |  | Gaussian mixture model 縮寫。 |
| expectation-maximization algorithm | 期望最大化演算法 | 否 |  |  |
| EM algorithm | 期望最大化演算法 | 否 |  | Expectation-Maximization 演算法的縮寫。 |
| E-step | E 步驟 | 否 |  | EM 演算法中計算成分責任機率的步驟。 |
| M-step | M 步驟 | 否 |  | EM 演算法中更新參數的步驟。 |
| mixing weight | 混合權重 | 否 |  | 高斯混合模型中各成分的權重。 |
| hard assignment | 硬式指派 | 否 |  | 每個資料點只指派給單一群集。 |
| soft assignment | 軟式指派 | 否 |  | 以機率表示資料點屬於各群集的程度。 |
| spherical cluster | 球形群集 | 否 |  |  |
| elliptical cluster | 橢圓形群集 | 否 |  |  |
| overlapping cluster | 重疊群集 | 否 |  |  |
| anomaly | 異常 | 否 |  | 不符合預期模式的資料點或狀態。 |
| K-Means++ | K-Means++ | 是 |  | K-Means 的質心初始化方法名稱。 |
| numerical feature | 數值特徵 | 否 |  | 值為數字的特徵。 |
| min-max scaling | 最小–最大縮放 | 否 |  | 將特徵線性映射到 [0, 1] 區間。 |
| z-score | z 分數 | 否 |  | 標準化後的數值；(x - mean) / std。 |
| log transform | 對數轉換 | 否 |  | 對右偏分布套用 log 壓縮的變換。 |
| label encoding | 標籤編碼 | 否 |  | 將各類別映射為整數；會引入虛假順序。 |
| ordinal encoding | 序數編碼 | 否 |  | 有自然順序類別的整數編碼。 |
| cardinality | 基數 | 否 |  | 類別特徵的相異值個數。 |
| missing value | 缺失值 | 否 |  |  |
| imputation | 補值 | 否 |  | 以估計值取代缺失值。 |
| mean imputation | 平均數補值 | 否 |  | 以平均數補上缺失的數值。 |
| indicator column | 指標欄 | 否 |  | 標記原值是否缺失的二元欄位。 |
| forward fill | 向前填補 | 否 |  | 時間序列以前一個有效值填補缺失。 |
| TF-IDF | TF-IDF | 是 |  | Term Frequency-Inverse Document Frequency；詞頻–逆文件頻率。 |
| term frequency | 詞頻 | 否 |  | 詞在單一文件中出現的頻率。 |
| inverse document frequency | 逆文件頻率 | 否 |  | 詞在所有文件中的稀有程度指標。 |
| count vectorizer | 計數向量化器 | 否 |  | 統計各詞在文件中出現次數的文字特徵方法。 |
| bag of words | 詞袋 | 否 |  | 只計詞頻、不計順序的文字表示法。 |
| corpus | 語料庫 | 否 |  | 文件的集合。 |
| document | 文件 | 否 |  | 文字分析中的單一文本單位。 |
| word count | 詞數 | 否 |  |  |
| filter method | 過濾法 | 否 |  | 訓練模型前以統計指標篩選特徵的方法。 |
| wrapper method | 包裝法 | 否 |  | 以模型表現來篩選特徵的方法。 |
| variance threshold | 變異數閾值 | 否 |  | 移除變異數低於閾值特徵的過濾法。 |
| recursive feature elimination | 遞迴特徵消除 | 否 |  | 反覆移除最不重要特徵的包裝法。 |
| redundant | 冗餘 | 否 |  |  |
| smoothing | 平滑化 | 否 |  |  |
| leave-one-out | 留一法 | 否 |  | 每次排除一筆資料的驗證或編碼策略。 |
| hashing | 雜湊 | 否 | 哈希 |  |
| dummy variable | 虛擬變數 | 否 |  | one-hot 編碼產生的二元變數。 |
| cyclical encoding | 循環編碼 | 否 |  | 以小時、星期等週期性特徵的三角函數編碼。 |
| robust scaling | 穩健縮放 | 否 |  | 以中位數與四分位距縮放，對離群值穩健。 |
| target variable | 目標變數 | 否 |  | 模型要預測的變數。 |
| model evaluation | 模型評估 | 否 |  |  |
| metric | 指標 | 否 |  | 評估模型表現的量化標準。 |
| fold | 折 | 否 |  | 交叉驗證中資料的一個分割。 |
| K-fold | K 折 | 否 |  | K 折交叉驗證的資料分割方式。 |
| K-fold cross-validation | K 折交叉驗證 | 否 |  | 將資料分成 K 折輪流驗證的方法。 |
| stratified | 分層 | 否 |  | 保持各類別比例一致的分割方式。 |
| stratified K-fold | 分層 K 折 | 否 |  | 每折保持類別分布的 K 折交叉驗證。 |
| stratification | 分層 | 否 |  | 在分割中保持類別比例的做法。 |
| AUC-ROC | AUC-ROC | 是 |  | ROC 曲線下面積；模型評估指標名稱保留英文。 |
| RMSE | RMSE | 是 |  | Root Mean Squared Error；MSE 的平方根；比照 MSE、MAE 保留英文。 |
| learning curve | 學習曲線 | 否 |  | 訓練與驗證分數隨訓練資料量變化的圖。 |
| validation curve | 驗證曲線 | 否 |  | 訓練與驗證分數隨超參數變化的圖。 |
| high bias | 高偏差 | 否 |  | 模型過於簡單而欠擬合的狀態。 |
| high variance | 高變異 | 否 |  | 模型過於複雜而過度擬合的狀態。 |
| hold-out | 保留集 | 否 |  | 保留不給訓練使用的資料分割。 |
| permutation test | 置換檢定 | 否 |  | 打亂標籤建立虛無分布的統計檢定。 |
| nested cross-validation | 巢狀交叉驗證 | 否 |  | 外層評估、內層調參的交叉驗證。 |
| average precision | 平均精確率 | 否 |  | PR 曲線下面積的近似值。 |
| null distribution | 虛無分布 | 否 |  | 假設無效應時的參照分布。 |
| minority class | 少數類 | 否 |  | 不平衡資料中樣本較少的類別。 |
| majority class | 多數類 | 否 |  | 不平衡資料中樣本較多的類別。 |
| decomposition | 分解 | 否 |  | 將總量拆解為組成成分；bias-variance decomposition 譯為偏差－變異分解。 |
| irreducible error | 不可約誤差 | 否 |  | 資料生成過程固有隨機性造成的誤差下限。 |
| expected prediction error | 期望預測誤差 | 否 |  | 在不同訓練集上預測誤差的期望值。 |
| training error | 訓練誤差 | 否 |  | 模型在訓練資料上的誤差。 |
| test error | 測試誤差 | 否 |  | 模型在測試資料上的誤差。 |
| model capacity | 模型容量 | 否 |  | 模型可擬合函數的複雜度上限。 |
| polynomial degree | 多項式次數 | 否 |  | 多項式的最高次方；與圖論的 degree（度數）區分。 |
| sweet spot | 甜蜜點 | 否 |  | 偏差與變異平衡的最佳複雜度位置。 |
| boosting | boosting | 是 |  | 依序建模、每個新模型修正集成目前錯誤的方法；保留英文。 |
| gradient boosting | gradient boosting | 是 |  | 梯度提升；常用英文名稱。 |
| AdaBoost | AdaBoost | 是 |  | boosting 演算法名稱。 |
| stacking | stacking | 是 |  | 以元學習器合併基模型輸出的集成方法；保留英文。 |
| meta-learner | 元學習器 | 否 |  | stacking 中合併基模型輸出的模型。 |
| base model | 基模型 | 否 |  | 集成方法中的個別模型。 |
| interpolation threshold | 插值閾值 | 否 |  | 參數數量剛好足以完美擬合訓練資料的臨界點。 |
| overparameterized | 過度參數化 | 否 |  | 參數數量遠多於訓練樣本的狀態。 |
| double descent | 雙重下降 | 否 |  | 容量超過插值閾值後測試誤差再度下降的現象。 |
| sample-wise double descent | 樣本維度雙重下降 | 否 |  | 增加樣本數在插值區間反而讓測試誤差上升的現象。 |
| epoch-wise double descent | epoch 維度雙重下降 | 否 |  | 增加訓練 epoch 數引發的雙重下降。 |
| shallow stump | 淺層樹樁 | 否 |  | 深度很淺的決策樹，常用作 boosting 的基模型。 |
| strong learner | 強學習器 | 否 |  | 預測能力強的模型；弱學習器集成後的目標。 |
| decision stump | 決策樹樁 | 否 |  | 只有單一分割的深度 1 決策樹。 |
| hard voting | 硬投票 | 否 |  | 直接對類別標籤做多數決的集成投票方式。 |
| soft voting | 軟投票 | 否 |  | 對各模型預測機率取平均的投票方式。 |
| ensemble diversity | 集成多樣性 | 否 |  | 各基模型犯不同錯誤的程度。 |
| pseudo-residual | 偽殘差 | 否 |  | gradient boosting 中損失函數的負梯度值。 |
| shrinkage | 縮減 | 否 |  | boosting 中縮小每棵樹貢獻的學習率機制。 |
| leaf weight | 葉權重 | 否 |  | 決策樹葉節點輸出的數值。 |
| column subsampling | 欄位子取樣 | 否 |  | 每次分割只考慮部分特徵的做法。 |
| weighted quantile sketch | 加權分位數草圖 | 否 |  | XGBoost 在分散式資料上找分割點的近似演算法。 |
| out-of-bag error | 袋外誤差 | 否 |  | 用袋外樣本計算的免費驗證誤差。 |
| weighted sum | 加權總和 | 否 |  |  |
| sample weight | 樣本權重 | 否 |  | AdaBoost 中各訓練樣本的權重。 |
| grid search | 網格搜尋 | 否 |  | 對所有超參數組合窮舉的搜尋方法。 |
| random search | 隨機搜尋 | 否 |  | 從分布中隨機抽樣超參數的搜尋方法。 |
| Bayesian optimization | 貝氏最佳化 | 否 |  | 用代理模型與獲得函數引導的超參數搜尋。 |
| surrogate model | 代理模型 | 否 |  | 用來近似昂貴目標函數的便宜模型，常用高斯過程。 |
| acquisition function | 獲得函數 | 否 |  | 貝氏最佳化中決定下一個評估點的函數。 |
| expected improvement | 期望改善 | 否 |  | 常用獲得函數；對目前最佳點的期望改善幅度。 |
| upper confidence bound | 信賴上界 | 否 |  | 預測值加上不確定性倍數的獲得函數。 |
| probability of improvement | 改善機率 | 否 |  | 候選點勝過目前最佳值的機率。 |
| Hyperband | Hyperband | 是 |  | 超參數搜尋的資源分配演算法名稱。 |
| median pruning | 中位數剪枝 | 否 |  | 試驗中途表現不如已完成試驗中位數時提早停止。 |
| Optuna | Optuna | 是 |  | 超參數調校函式庫名稱。 |
| search space | 搜尋空間 | 否 |  | 超參數所有候選值的範圍。 |
| trial | 試驗 | 否 |  | 超參數搜尋中的一次評估。 |
| batch size | 批次大小 | 否 |  | 每次權重更新使用的樣本數。 |
| log scale | 對數尺度 | 否 |  | 以對數間隔取值的搜尋尺度。 |
| log-uniform | 對數均勻 | 否 |  | 在對數尺度上均勻取樣的分布。 |
| subsample ratio | 子取樣比例 | 否 |  | 每棵樹使用的訓練樣本比例。 |
| one-cycle | 一循環 | 否 |  | 學習率先升後降的一循環排程。 |
| plateau | 高原期 | 否 |  | 指標停止改善的階段。 |
| hyperparameter tuning | 超參數調校 | 否 |  | 為模型選擇超參數的過程。 |
| patience | 容忍輪數 | 否 |  | 提前停止前允許的不改善輪數。 |
| experiment tracking | 實驗追蹤 | 否 |  | 記錄每次訓練的參數、指標、產物與程式版本。 |
| model registry | 模型登錄 | 否 |  | 以版本號與階段標籤管理模型版本的系統。 |
| model versioning | 模型版本管理 | 否 |  | 追蹤並管理不同版本模型何者上線的作法。 |
| data versioning | 資料版本管理 | 否 |  | 對資料集做版本控制，DVC 是代表工具。 |
| model serving | 模型服務 | 否 |  | 把訓練好的模型放上線供預測請求使用。 |
| training-serving skew | 訓練／服務落差 | 否 |  | 訓練與線上推論前處理不一致造成的靜默錯誤。 |
| serialization | 序列化 | 否 |  | 把物件轉成可儲存或傳輸格式的過程。 |
| artifact | 產物 | 否 |  | 訓練或建置過程產出的檔案或物件。 |
| deployment | 部署 | 否 |  | 把模型或系統放上正式環境。 |
| production environment | 正式環境 | 否 | 生產環境 | 上線後實際在跑的環境。本專案統一用「正式環境」。 |
| config file | 設定檔 | 否 |  | 集中存放超參數與設定的檔案。 |
| approval workflow | 核准流程 | 否 |  | 上線前需經人工核准的流程。 |
| rollback | 回滾 | 否 |  | 回到先前版本的動作。 |
| unit test | 單元測試 | 否 |  | 針對單一元件的測試。 |
| integration test | 整合測試 | 否 |  | 針對多元件協作的測試。 |
| conditional independence | 條件獨立 | 否 |  | 給定類別後，特徵彼此獨立。 |
| generative model | 生成模型 | 否 |  | 學習給定類別下的資料分布與類別機率，再用貝氏定理得到後驗。 |
| discriminative model | 判別式模型 | 否 | 判別模型 | 直接學習後驗或決策邊界，不建模資料如何生成。 |
| multinomial naive Bayes | 多項單純貝氏 | 否 | 多項式單純貝氏 | 以詞頻計數建模；多項分布，不是多項式。 |
| Gaussian naive Bayes | 高斯單純貝氏 | 否 |  | 以常態分布建模連續特徵。 |
| Bernoulli naive Bayes | 伯努利單純貝氏 | 否 |  | 以出現或未出現的二元特徵建模。 |
| class prior | 類別先驗 | 否 |  | 觀察特徵前各類別的機率。 |
| Dirichlet prior | 狄利克雷先驗 | 否 |  | 多項分布的共軛先驗；拉普拉斯平滑的貝氏解釋。 |
| stationarity | 定態 | 否 |  | 時間序列的平均數、變異數與自相關不隨時間改變。不要用平穩，以免和隨機過程的平穩分布衝突。 |
| seasonality | 季節性 | 否 |  | 固定間隔重複的日、週、年模式。 |
| trend | 趨勢 | 否 |  | 時間序列的長期方向。 |
| lag | 落後 | 否 |  | 時間序列往前數的期數；lag-1 是前一期。 |
| differencing | 差分 | 否 |  | 相鄰觀測值相減，用來去掉趨勢、達成定態。 |
| white noise | 白雜訊 | 否 | 白噪声 | 沒有可預測結構的隨機殘差。 |
| walk-forward validation | 逐步向前驗證 | 否 |  | 訓練資料一律早於測試資料的時間序列驗證。 |
| partial autocorrelation | 偏自相關 | 否 |  | 去掉較短落後期影響後，某一落後期的直接相關。 |
| expanding window | 擴張視窗 | 否 |  | 每折都使用截至當時的全部歷史來訓練。 |
| sliding window | 滑動視窗 | 否 |  | 固定長度的訓練視窗往前移動。 |
| exponential smoothing | 指數平滑 | 否 |  | 對近期觀測給較高權重的平滑法。 |
| forecasting horizon | 預測期距 | 否 |  | 一次要往前預測幾步。 |
| structural break | 結構斷裂 | 否 |  | 序列行為突然改變的時點。 |
| point anomaly | 點異常 | 否 |  | 不論情境，單一觀測值本身就異常。 |
| contextual anomaly | 情境異常 | 否 |  | 同一個值在別的情境正常，在此情境異常。 |
| collective anomaly | 集合異常 | 否 |  | 個別點正常，但一連串放在一起異常。 |
| isolation forest | 隔離森林 | 否 |  | 用隨機分割把異常點較快隔離出來的樹集成。 |
| local outlier factor | 局部離群因子 | 否 |  | 比較一點與其鄰居的局部密度。 |
| LOF | LOF | 是 |  | local outlier factor 縮寫。 |
| contamination | 預期異常比例 | 否 |  | 偵測器預期要標記為異常的資料比例；只影響閾值。 |
| precision at k | Precision@k | 是 |  | 前 k 個最可疑點裡真正異常的比例。 |
| AUPRC | AUPRC | 是 |  | 精確率–召回率曲線下面積；不平衡時比 AUROC 有用。 |
| reachability density | 可達密度 | 否 |  | LOF 用來描述鄰域有多密的量。 |
| SMOTE | SMOTE | 是 |  | Synthetic Minority Oversampling Technique；在少數類鄰居之間插值產生新樣本。 |
| class weight | 類別權重 | 否 |  | 依類別放大損失，讓少數類的錯誤更貴。 |
| oversampling | 過採樣 | 否 |  | 增加少數類樣本數。 |
| undersampling | 欠採樣 | 否 |  | 減少多數類樣本數。 |
| Matthews correlation coefficient | Matthews 相關係數 | 否 |  | 兩類都表現好才會高分的相關係數，範圍 -1 到 1。 |
| MCC | MCC | 是 |  | Matthews correlation coefficient 縮寫。 |
| cost-sensitive learning | 成本敏感學習 | 否 |  | 把不同誤分類的真實成本放進訓練目標。 |
| resampling | 重新抽樣 | 否 |  | 改變類別樣本數的抽樣策略。 |
| embedded method | 內嵌法 | 否 |  | 在模型訓練過程中一併選特徵。不要寫「嵌入」，那是 embedding 的禁用詞。 |
| forward selection | 前向選擇 | 否 |  | 從空集合開始，逐一加入最有幫助的特徵。 |
| backward elimination | 後向消除 | 否 |  | 從全部特徵開始，逐一移除最沒有幫助的特徵。 |
| stability selection | 穩定性選擇 | 否 |  | 多次子抽樣後，只保留經常被選中的特徵。 |
| perceptron | 感知器 | 否 | 感知機 | 單一線性分類器；多層形式見 multi-layer perceptron。 |
| step function | 階躍函數 | 否 |  | 感知器在加權總和之後使用的不連續活化函數。 |
| linear classifier | 線性分類器 | 否 |  | 以超平面把輸入分成兩類的模型。 |
| input layer | 輸入層 | 否 |  | 只存放原始輸入、不做計算的那一層。 |
| output layer | 輸出層 | 否 |  | 網路最後給出答案的那一層。 |
| multi-layer network | 多層網路 | 否 | 多層網絡 | 由多層神經元依序堆疊而成的網路。 |
| bias vector | 偏置向量 | 否 |  | 矩陣乘法之後加上的偏置。 |
| universal approximation | 通用近似 | 否 |  | 單一隱藏層在神經元夠多時可近似任何連續函數。 |
