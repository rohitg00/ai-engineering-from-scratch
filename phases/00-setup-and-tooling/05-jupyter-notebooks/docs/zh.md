# Jupyter Notebooks

> Notebook 是 AI 工程的工作台。你在这里进行原型设计，然后将可行的内容迁移到生产环境。

**类型：** 构建
**语言：** Python
**前置条件：** 第 0 阶段，第 01 课
**预计时间：** ~30 分钟

## 学习目标

- 安装并启动 JupyterLab、Jupyter Notebook 或带有 Jupyter 扩展的 VS Code
- 使用魔法命令（%timeit、%%time、%matplotlib inline）进行基准测试和内联可视化
- 区分何时使用 notebook 与脚本，并应用"在 notebook 中探索，在脚本中交付"的工作流
- 识别并避免常见的 notebook 陷阱：乱序执行、隐藏状态和内存泄漏

## 问题

每篇 AI 论文、教程和 Kaggle 竞赛都在使用 Jupyter notebook。它们让你分段运行代码、内联查看输出、将代码与解释混合在一起，并快速迭代。如果你尝试学习 AI 而不使用 notebook，就像做数学作业没有草稿纸一样。

但 notebook 确实存在陷阱。人们用它们来做所有事情，包括一些它们根本不擅长的事情。知道何时使用 notebook 以及何时使用脚本，将为你日后避免调试噩梦。

## 概念

Notebook 是一个单元格列表。每个单元格要么是代码，要么是文本。

`mermaid
graph TD
    A["**Markdown Cell**\n# My Experiment\nTesting learning rate 0.01"] --> B["**Code Cell** ▶ Run\nmodel.fit(X, y, lr=0.01)\n---\nOutput: loss = 0.342"]
    B --> C["**Code Cell** ▶ Run\nplt.plot(losses)\n---\nOutput: inline plot"]
`

内核是一个在后台运行的 Python 进程。当你运行一个单元格时，它会将代码发送到内核，内核执行代码并返回结果。所有单元格共享同一个内核，因此变量在单元格之间持续存在。

`mermaid
graph LR
    A[Notebook UI] <--> B[Kernel\nPython process]
    B --> C[Keeps variables in memory]
    B --> D[Runs cells in whatever order you click]
    B --> E[Dies when you restart it]
`

那个"无论你以什么顺序点击"的部分既是超能力，也是自残利器。

## 动手实践

### 第 1 步：选择你的界面

三种选择，同一种格式：

| 界面 | 安装方式 | 最适合 |
|-----------|---------|----------|
| JupyterLab | pip install jupyterlab 然后 jupyter lab | 完整的 IDE 体验，多标签页，文件浏览器，终端 |
| Jupyter Notebook | pip install notebook 然后 jupyter notebook | 简洁、轻量，一次一个 notebook |
| VS Code | 安装 "Jupyter" 扩展 | 已在你的编辑器中，git 集成，调试功能 |

三者都能读写相同的 .ipynb 文件。选择你喜欢的即可。JupyterLab 在 AI 工作中最为常见。

`ash
pip install jupyterlab
jupyter lab
`

### 第 2 步：重要的快捷键

你在两种模式下操作。按 Escape 进入命令模式（左侧蓝色边框），按 Enter 进入编辑模式（绿色边框）。

**命令模式（最常用）：**

| 按键 | 操作 |
|-----|--------|
| Shift+Enter | 运行单元格，移动到下一个 |
| A | 在上方插入单元格 |
| B | 在下方插入单元格 |
| DD | 删除单元格 |
| M | 转换为 markdown |
| Y | 转换为代码 |
| Z | 撤销单元格操作 |
| Ctrl+Shift+H | 显示所有快捷键 |

**编辑模式：**

| 按键 | 操作 |
|-----|--------|
| Tab | 自动补全 |
| Shift+Tab | 显示函数签名 |
| Ctrl+/ | 切换注释 |

Shift+Enter 是你每天会用上千次的快捷键。先学会它。

### 第 3 步：单元格类型

**代码单元格**运行 Python 并显示输出：

`python
import numpy as np
data = np.random.randn(1000)
data.mean(), data.std()
`

输出：(0.0032, 0.9987)

**Markdown 单元格**渲染格式化文本。用来记录你正在做什么以及为什么。支持标题、加粗、斜体、LaTeX 数学公式（$E = mc^2$）、表格和图片。

### 第 4 步：魔法命令

这些不是 Python。它们是 Jupyter 特有的命令，以 %（行魔法）或 %%（单元格魔法）开头。

**计时代码：**

`python
%timeit np.random.randn(10000)
`

输出：45.2 us +/- 1.3 us per loop

`python
%%time
model.fit(X_train, y_train, epochs=10)
`

输出：Wall time: 2.34 s

%timeit 多次运行代码并取平均值。%%time 只运行一次。对微基准测试用 %timeit，对训练运行用 %%time。

**启用内联绘图：**

`python
%matplotlib inline
`

现在每个 plt.plot() 或 plt.show() 都直接在 notebook 中渲染。

**不离开 notebook 安装包：**

`python
!pip install scikit-learn
`

! 前缀可以运行任何 shell 命令。

**检查环境变量：**

`python
%env CUDA_VISIBLE_DEVICES
`

### 第 5 步：内联显示丰富的输出

Notebook 自动显示单元格中的最后一个表达式。但你可以控制它：

`python
import pandas as pd

df = pd.DataFrame({
    "model": ["Linear", "Random Forest", "Neural Net"],
    "accuracy": [0.72, 0.89, 0.94],
    "training_time": [0.1, 2.3, 45.6]
})
df
`

这将渲染一个格式化的 HTML 表格，而不是文本转储。绘图也是如此：

`python
import matplotlib.pyplot as plt

plt.figure(figsize=(8, 4))
plt.plot([1, 2, 3, 4], [1, 4, 2, 3])
plt.title("Inline Plot")
plt.show()
`

图表会出现在单元格正下方。这就是 notebook 在 AI 工作中占主导地位的原因。你可以同时看到数据、图表和代码。

对于图片：

`python
from IPython.display import Image, display
display(Image(filename="architecture.png"))
`

### 第 6 步：Google Colab

Colab 是云端的免费 Jupyter notebook。它为你提供 GPU、预装库和 Google Drive 集成。无需设置。

1. 访问 [colab.research.google.com](https://colab.research.google.com)
2. 上传本课程中的任何 .ipynb 文件
3. 运行时 > 更改运行时类型 > T4 GPU（免费）

Colab 与本地 Jupyter 的区别：
- 文件在会话之间不会持久保存（保存到 Drive 或下载）
- 预装：numpy、pandas、matplotlib、torch、tensorflow、sklearn
- rom google.colab import files 用于上传/下载文件
- rom google.colab import drive; drive.mount('/content/drive') 用于持久存储
- 空闲 90 分钟后会话超时（免费版）

## 使用方式

### Notebook 与脚本：何时使用哪一种

| 使用 notebook 的场景 | 使用脚本的场景 |
|-------------------|-----------------|
| 探索数据集 | 训练管道 |
| 原型设计模型 | 可复用的工具模块 |
| 可视化结果 | 任何包含 if __name__ 的代码 |
| 解释你的工作 | 按计划运行的代码 |
| 快速实验 | 生产代码 |
| 课程练习 | 包和库 |

原则：**在 notebook 中探索，在脚本中交付**。

一个常见的 AI 工作流：
1. 在 notebook 中探索数据
2. 在 notebook 中原型设计模型
3. 一旦可行，将代码移到 .py 文件中
4. 将这些 .py 文件导入回 notebook 进行进一步实验

### 常见陷阱

**乱序执行。** 你运行了单元格 5，然后是单元格 2，然后是单元格 7。Notebook 在你的机器上可以工作，但当别人从头到尾运行时就会出错。解决方法：分享前执行 内核 > 重启并全部运行。

**隐藏状态。** 你删除了一个单元格，但它创建的变量仍在内存中。Notebook 看起来很干净，但实际上依赖于一个幽灵单元格。解决方法：定期重启内核。

**内存泄漏。** 加载一个 4GB 的数据集，训练一个模型，再加载另一个数据集。没有任何东西被释放。解决方法：del variable_name 和 gc.collect()，或者重启内核。

## 交付物

本课程产出：
- outputs/prompt-notebook-helper.md 用于调试 notebook 问题

## 练习

1. 打开 JupyterLab，创建一个 notebook，使用 %timeit 比较列表推导式与 numpy 在创建 100,000 个随机数数组时的性能
2. 创建一个包含 markdown 和代码单元格的 notebook，加载一个 CSV 文件，显示 dataframe 并绘制图表。然后执行 内核 > 重启并全部运行，验证它能否从头到尾正常工作
3. 将 code/notebook_tips.py 中的代码粘贴到 Colab notebook 中，使用免费 GPU 运行

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| Kernel | "运行我代码的东西" | 一个独立的 Python 进程，执行单元格并将变量保存在内存中 |
| Cell | "代码块" | notebook 中可独立运行的单元，可以是代码或 markdown |
| Magic command | "Jupyter 技巧" | 以 % 或 %% 为前缀的特殊命令，用于控制 notebook 环境 |
| .ipynb | "Notebook 文件" | 包含单元格、输出和元数据的 JSON 文件。代表 IPython Notebook |

## 延伸阅读

- [JupyterLab 文档](https://jupyterlab.readthedocs.io/) 了解完整功能集
- [Google Colab FAQ](https://research.google.com/colaboratory/faq.html) 了解 Colab 特有的限制和功能
- [28 个 Jupyter Notebook 技巧](https://www.dataquest.io/blog/jupyter-notebook-tips-tricks-shortcuts/) 了解高级用户快捷键
