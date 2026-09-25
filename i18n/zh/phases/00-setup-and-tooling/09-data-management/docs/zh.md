# 数据管理

> 数据是燃料。你管理数据的方式决定了你能跑多快。

**Type:** Build
**Language:** Python
**Prerequisites:** 阶段 0，第 01 课
**Time:** 约 45 分钟

## 学习目标

- 使用 Hugging Face `datasets` 库加载、流式读取和缓存数据集
- 在 CSV、JSON、Parquet 和 Arrow 格式之间转换，并解释它们的权衡
- 使用固定随机种子创建可复现的训练/验证/测试划分
- 使用 `.gitignore`、Git LFS 或 DVC 管理大型模型和数据集文件

## 问题

每个 AI 项目都始于数据。你需要查找数据集、下载它们、在格式之间转换、将其划分为训练和评估集，并对它们进行版本控制，以便实验可复现。每次手动完成这些既慢又容易出错。你需要一个可重复的工作流。

## 概念

```mermaid
graph TD
    A["Hugging Face Hub"] --> B["datasets library"]
    B --> C["Load / Stream"]
    C --> D["Local Cache<br/>~/.cache/huggingface/"]
    B --> E["Format Conversion<br/>CSV, JSON, Parquet, Arrow"]
    E --> F["Data Splits<br/>train / val / test"]
    F --> G["Your Training Pipeline"]
```

Hugging Face `datasets` 库是 AI 工作中加载数据的标准方式。它开箱即用地处理下载、缓存、格式转换和流式读取。

```figure
s0-data-pipeline
```

## 动手构建

### 步骤 1：安装 datasets 库

```bash
pip install datasets huggingface_hub
```

### 步骤 2：加载数据集

```python
from datasets import load_dataset

dataset = load_dataset("stanfordnlp/imdb")
print(dataset)
print(dataset["train"][0])
```

这会下载 IMDB 电影评论数据集。首次下载后，它会从 `~/.cache/huggingface/datasets/` 的缓存中加载。

### 步骤 3：流式读取大型数据集

有些数据集太大，无法全部存放在磁盘上。流式读取可以逐行加载数据，而无需下载完整数据集。

```python
dataset = load_dataset("wikimedia/wikipedia", "20220301.en", split="train", streaming=True)

for i, example in enumerate(dataset):
    print(example["title"])
    if i >= 4:
        break
```

流式读取会给你一个 `IterableDataset`。数据到达时逐行处理。无论数据集大小如何，内存占用保持恒定。

### 步骤 4：数据集格式

`datasets` 库底层使用 Apache Arrow。你可以根据流水线的需要转换为其他格式。

```python
dataset = load_dataset("stanfordnlp/imdb", split="train")

dataset.to_csv("imdb_train.csv")
dataset.to_json("imdb_train.json")
dataset.to_parquet("imdb_train.parquet")
```

格式对比：

| 格式 | 大小 | 读取速度 | 最适合 |
|--------|------|-----------|----------|
| CSV | 大 | 慢 | 人类可读性、电子表格 |
| JSON | 大 | 慢 | API、嵌套数据 |
| Parquet | 小 | 快 | 分析、列式查询 |
| Arrow | 小 | 最快 | 内存中处理（`datasets` 内部使用的方式） |

对于 AI 工作，Parquet 是最佳存储格式。Arrow 是你在内存中处理的格式。CSV 和 JSON 用于数据交换。

### 步骤 5：数据划分

每个机器学习项目都需要三个划分：

- **训练集（Train）**：模型从中学习（通常 80%）
- **验证集（Validation）**：训练过程中检查进度（通常 10%）
- **测试集（Test）**：训练完成后的最终评估（通常 10%）

有些数据集已经预先划分好。如果没有，请自己划分：

```python
dataset = load_dataset("stanfordnlp/imdb", split="train")

split = dataset.train_test_split(test_size=0.2, seed=42)
train_val = split["train"].train_test_split(test_size=0.125, seed=42)

train_ds = train_val["train"]
val_ds = train_val["test"]
test_ds = split["test"]

print(f"Train: {len(train_ds)}, Val: {len(val_ds)}, Test: {len(test_ds)}")
```

务必设置随机种子以保证可复现性。相同的种子每次都会产生相同的划分。

### 步骤 6：下载并缓存模型

模型是大文件。`huggingface_hub` 库负责下载和缓存。

```python
from huggingface_hub import hf_hub_download, snapshot_download

model_path = hf_hub_download(
    repo_id="sentence-transformers/all-MiniLM-L6-v2",
    filename="config.json"
)
print(f"Cached at: {model_path}")

model_dir = snapshot_download("sentence-transformers/all-MiniLM-L6-v2")
print(f"Full model at: {model_dir}")
```

模型会缓存到 `~/.cache/huggingface/hub/`。一旦下载完成，后续运行即可即时加载。

### 步骤 7：处理大文件

模型权重和大型数据集不应放入 git。三种选择：

**方案 A：.gitignore（最简单）**

```
*.bin
*.safetensors
*.pt
*.onnx
data/*.parquet
data/*.csv
models/
```

**方案 B：Git LFS（在 git 中跟踪大文件）**

```bash
git lfs install
git lfs track "*.bin"
git lfs track "*.safetensors"
git add .gitattributes
```

Git LFS 在你的仓库中存储指针，实际文件则存放在单独的服务器上。GitHub 免费提供 1 GB 空间。

**方案 C：DVC（数据版本控制）**

```bash
pip install dvc
dvc init
dvc add data/training_set.parquet
git add data/training_set.parquet.dvc data/.gitignore
git commit -m "Track training data with DVC"
```

DVC 会创建指向你数据的少量 `.dvc` 文件。数据本身存放在 S3、GCS 或其他远程存储后端。

| 方案 | 复杂度 | 最适合 |
|----------|-----------|----------|
| .gitignore | 低 | 个人项目、可重新获取的下载数据 |
| Git LFS | 中 | 通过 git 共享模型权重的团队 |
| DVC | 高 | 可复现实验、大型数据集、团队 |

对于本课程，`.gitignore` 就足够了。当你需要在多台机器上复现精确实验时，再使用 DVC。

### 步骤 8：存储模式

**本地存储**适用于约 10 GB 以下的数据集。HF 缓存会自动处理。

**云存储**适用于更大的数据或在多台机器之间共享的数据：

```python
import os

local_path = os.path.expanduser("~/.cache/huggingface/datasets/")

# s3_path = "s3://my-bucket/datasets/"
# gcs_path = "gs://my-bucket/datasets/"
```

DVC 可直接与 S3 和 GCS 集成：

```bash
dvc remote add -d myremote s3://my-bucket/dvc-store
dvc push
```

对于本课程，本地存储已经足够。当你在远程 GPU 实例上进行微调时，云存储才会变得重要。

## 本课程使用的数据集

| 数据集 | 课程 | 大小 | 教学内容 |
|---------|---------|------|----------------|
| IMDB | 分词、分类 | 84 MB | 文本分类基础 |
| WikiText | 语言建模 | 181 MB | 下一个词预测 |
| SQuAD | 问答系统 | 35 MB | 问答、跨度抽取 |
| Common Crawl（子集） | 嵌入 | 不定 | 大规模文本处理 |
| MNIST | 视觉基础 | 21 MB | 图像分类基础 |
| COCO（子集） | 多模态 | 不定 | 图像-文本对 |

你现在不需要全部下载。每节课会说明它需要什么。

## 使用它

运行工具脚本以验证一切正常：

```bash
python code/data_utils.py
```

这会下载一个小数据集、转换它、划分它，并打印摘要。

## 交付成果

本课产出：
- `code/data_utils.py` - 可复用的数据加载与缓存工具
- `outputs/prompt-data-helper.md` - 用于查找适合某个任务的数据集的提示词

## 练习

1. 使用 `mrpc` 配置加载 `glue` 数据集，并查看前 5 个样本
2. 流式读取 `c4` 数据集，统计 10 秒内能处理多少个样本
3. 将一个数据集转换为 Parquet，并比较其文件大小与 CSV 的差异
4. 使用固定种子创建 70/15/15 的训练/验证/测试划分，并验证各部分大小

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|----------------------|
| 数据集划分 | “训练数据” | 在机器学习生命周期不同阶段使用的命名子集（训练/验证/测试） |
| 流式读取 | “懒加载” | 从远程源逐行处理数据，而无需下载完整数据集 |
| Parquet | “压缩的 CSV” | 一种为分析查询和存储效率优化的列式文件格式 |
| Arrow | “快速的数据框” | datasets 库内部使用的内存列式格式，支持零拷贝读取 |
| Git LFS | “大文件的 git” | 一种扩展，将大文件存储在 git 仓库之外，同时在版本控制中保留指针 |
| DVC | “数据的 git” | 一个面向数据集和模型的版本控制系统，可与云存储集成 |
| 缓存 | “已经下载了” | 之前获取的数据的本地副本，默认存储在 ~/.cache/huggingface/ |