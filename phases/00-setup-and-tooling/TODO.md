# Phase 0 — Setup & Tooling TODO

環境前提：mise 管 python/uv/node/pnpm/rust · macOS（無 NVIDIA GPU）· Docker/git 已有 · uv toolchain 未裝

圖例：`[x]` 完成 · `[ ]` 待辦 · `[~]` 選用 · `[-]` 不適用（無 NVIDIA / 純 macOS）

---

## 關鍵下一步（依順序）

1. [x] **裝 uv**（唯一硬缺口）：`mise use uv` 或 `curl -LsSf https://astral.sh/uv/install.sh | sh` → 驗證 `uv --version`
2. [x] 建 repo 根 `.venv` + `pyproject.toml`
3. [x] `.gitignore` 加 model 大檔 + `.venv/` + `.env`
4. [x] VS Code 擴充（見 08）
5. [~] 其餘按課程需要再裝（API / Jupyter / datasets / debug）

---

## 01 Dev Environment
- [x] 系統基礎：xcode-select / git / curl
- [x] Python（mise）
- [x] uv toolchain 本身 — 驗證 `uv --version`
- [x] Node（mise）
- [x] pnpm（mise）
- [x] Rust（mise）
- [~] Julia（選用，可跳）
- [-] GPU/CUDA — 無 NVIDIA；macOS 改用 MPS
- [x] 跑 `01-dev-environment/code/verify.py`（7/7 core PASS）

## 02 Git & Collaboration
- [x] git 安裝 + user.name / user.email
- [x] `.gitignore` 排除 `*.pt` `*.pth` `*.safetensors`

## 03 GPU Setup & Cloud
- [-] 本地 NVIDIA — 無
- [x] MPS 驗證：`torch.backends.mps.is_available()` → True（張量運算 OK）
- [~] Colab T4 備案（需 GPU 課程時）

## 04 APIs & Keys
- [x] `.env` + `.gitignore`，存 `ANTHROPIC_API_KEY`
- [~] Anthropic key + 首次呼叫（Phase 11 才需）

## 05 Jupyter Notebooks
- [x] `uv pip install jupyterlab`（或 VS Code Jupyter 擴充）

## 06 Python Environments
- [x] uv 裝好後 → `uv venv` 建 repo 根 `.venv`
- [x] 寫 `pyproject.toml`
- [x] 確認 `.venv/` 在 `.gitignore`
- [-] CUDA 版本對齊 — 無 GPU

## 07 Docker for AI
- [x] Docker 已有
- [-] NVIDIA Container Toolkit — macOS 跳過
- [~] Dockerfile（去掉 `--gpus all`）+ Qdrant compose

## 08 Editor Setup
- [x] VS Code + 擴充：Python / Pylance / Jupyter / Ruff / Black / GitLens / Remote-SSH
- [x] `settings.json`：formatOnSave + typeCheck basic

## 09 Data Management
- [x] `uv pip install datasets huggingface_hub`（Phase 4+ 才需）
- [x] `.gitignore` 大檔（與 02 同）

## 10 Terminal & Shell（macOS zsh）
- [x] `brew install tmux htop`
- [-] nvtop — 無 NVIDIA
- [~] 加 shell aliases（`10-terminal-and-shell/code/shell_aliases.sh`）

## 11 Linux for AI
- [-] 純 macOS 不需動；SSH 到雲端 GPU 才查（注意 macOS↔Linux 差異表）

## 12 Debugging & Profiling
- [~] 工具 Phase 3+ 訓練時才用
- [~] `uv pip install tensorboard line_profiler memory_profiler`

---

## 無 GPU 影響摘要
- 03：用 MPS 或 Colab 替代
- 06 / 07：跳過 CUDA 部分
- 10：跳過 nvtop
- 全部不擋學習
