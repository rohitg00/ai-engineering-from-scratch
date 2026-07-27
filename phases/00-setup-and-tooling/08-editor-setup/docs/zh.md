# 编辑器设置

> 你的编辑器就是你的副驾驶。一次性配置好，让它不再妨碍你，而是开始发挥作用。

**类型：** 构建
**语言：** --
**前置条件：** 第 0 阶段，第 01 课
**预计时间：** ~20 分钟

## 学习目标

- 安装 VS Code 及其用于 Python、Jupyter、linting 和远程 SSH 的基本扩展
- 配置保存时自动格式化、类型检查和 notebook 输出滚动，以适应 AI 工作流
- 设置 Remote SSH，像在本地一样编辑和调试远程 GPU 机器上的代码
- 评估编辑器替代方案（Cursor、Windsurf、Neovim）及其在 AI 工作中的权衡

## 问题

你将在编辑器中花费数千小时编写 Python、运行 notebook、调试训练循环以及 SSH 进入 GPU 机器。配置不当的编辑器会让每次使用都充满摩擦：没有自动补全、没有类型提示、没有内联错误、手动格式化以及笨拙的终端工作流。

正确的设置只需 20 分钟。跳过它每天会让你多花费 20 分钟。

## 概念

一个 AI 工程编辑器设置需要五样东西：

`mermaid
graph TD
    L5["5. 远程开发<br/>SSH 进入 GPU 机器、云虚拟机"] --> L4
    L4["4. 终端集成<br/>运行脚本、调试、监控 GPU"] --> L3
    L3["3. AI 专用设置<br/>自动格式化、类型检查、标尺"] --> L2
    L2["2. 扩展<br/>Python、Jupyter、Pylance、GitLens"] --> L1
    L1["1. 基础编辑器<br/>VS Code —— 免费、可扩展、通用"]
`

## 动手实践

### 第 1 步：安装 VS Code

VS Code 是推荐的编辑器。它免费、支持所有操作系统、拥有一流的 Jupyter notebook 支持，并且扩展生态系统涵盖了你 AI 工作所需的一切。

从 [code.visualstudio.com](https://code.visualstudio.com/) 下载。

从终端验证：

`ash
code --version
`

如果在 macOS 上找不到 code，打开 VS Code，按 Cmd+Shift+P，输入"Shell Command"，选择"Install 'code' command in PATH"。

### 第 2 步：安装基本扩展

打开 VS Code 的内置终端（Ctrl+`  或 ` Cmd+ `），安装对 AI 工作重要的扩展：

`ash
code --install-extension ms-python.python
code --install-extension ms-python.vscode-pylance
code --install-extension ms-toolsai.jupyter
code --install-extension eamodio.gitlens
code --install-extension ms-vscode-remote.remote-ssh
code --install-extension ms-python.debugpy
code --install-extension ms-python.black-formatter
code --install-extension charliermarsh.ruff
`

每个扩展的作用：

| 扩展 | 原因 |
|-----------|-----|
| Python | 语言支持、虚拟环境检测、运行/调试 |
| Pylance | 快速类型检查、自动补全、导入解析 |
| Jupyter | 在 VS Code 内运行 notebook、变量浏览器 |
| GitLens | 查看谁改了什么、内联 git blame |
| Remote SSH | 像本地一样打开远程 GPU 机器上的文件夹 |
| Debugpy | Python 的逐步调试 |
| Black Formatter | 保存时自动格式化、一致风格 |
| Ruff | 快速 linting，捕获常见错误 |

本课程中 code/.vscode/extensions.json 文件包含完整的推荐列表。当你打开项目文件夹时，VS Code 会提示你安装它们。

### 第 3 步：配置设置

复制本课程中 code/.vscode/settings.json 的设置，或通过 设置 > 打开设置 (JSON) 手动应用它们。

AI 工作的关键设置：

`jsonc
{
    "python.analysis.typeCheckingMode": "basic",
    "editor.formatOnSave": true,
    "editor.rulers": [88, 120],
    "notebook.output.scrolling": true,
    "files.autoSave": "afterDelay"
}
`

为什么这些很重要：

- **Type checking 设为 basic**：在运行前捕获错误的参数类型。节省调试 tensor 形状不匹配和错误 API 参数的时间。
- **Format on save**：再也不需要考虑格式化问题。Black 帮你处理。
- **标尺设为 88 和 120**：Black 在 88 处换行。120 标记显示文档字符串和注释何时过长。
- **Notebook output scrolling**：训练循环会打印数千行。没有滚动，输出面板会爆炸。
- **Auto-save**：你会忘记保存。你的训练脚本会运行过时的代码。自动保存可以防止这种情况。

### 第 4 步：终端集成

VS Code 的内置终端是你运行训练脚本、监控 GPU 和管理环境的地方。

正确设置它：

`jsonc
{
    "terminal.integrated.defaultProfile.osx": "zsh",
    "terminal.integrated.defaultProfile.linux": "bash",
    "terminal.integrated.fontSize": 13,
    "terminal.integrated.scrollback": 10000
}
`

有用的快捷键：

| 操作 | macOS | Linux/Windows |
|--------|-------|---------------|
| 切换终端 | ` Ctrl+ ` | ` Ctrl+ ` |
| 新建终端 | Ctrl+Shift+`  | Ctrl+Shift+`  |
| 拆分终端 | Cmd+\ | Ctrl+\ |

拆分终端很有用：一个用来运行脚本，一个用来用 
vidia-smi -l 1 或 watch -n 1 nvidia-smi 监控 GPU。

### 第 5 步：远程开发（SSH 进入 GPU 机器）

这是 AI 工作中最重要的扩展。你将在远程机器（云 VM、实验室服务器、Lambda、Vast.ai）上运行训练。Remote SSH 让你打开远程文件系统、编辑文件、运行终端和调试，就像一切都在本地一样。

设置：

1. 安装 Remote SSH 扩展（在第 2 步已完成）。
2. 按 Ctrl+Shift+P（或 Cmd+Shift+P），输入"Remote-SSH: Connect to Host"。
3. 输入 user@your-gpu-box-ip。
4. VS Code 自动在远程机器上安装其服务器组件。

要实现无密码访问，设置 SSH 密钥：

`ash
ssh-keygen -t ed25519 -C "your-email@example.com"
ssh-copy-id user@your-gpu-box-ip
`

为了方便，将主机添加到 ~/.ssh/config：

`
Host gpu-box
    HostName 203.0.113.50
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ForwardAgent yes
`

现在 Remote-SSH: Connect to Host > gpu-box 可以即时连接。

## 替代方案

### Cursor

[cursor.com](https://cursor.com) 是一个内置 AI 代码生成的 VS Code 分支。它使用相同的扩展生态系统和设置格式。如果你使用 Cursor，本课程中的所有内容仍然适用。导入相同的 settings.json 和 extensions.json。

### Windsurf

[windsurf.com](https://windsurf.com) 是另一个 AI 优先的 VS Code 分支。同样：相同的扩展、相同的设置格式、相同的 Remote SSH 支持。

### Vim/Neovim

如果你已经在使用 Vim 或 Neovim 并能高效工作，那就继续使用。AI Python 工作的最低配置：

- **pyright** 或 **pylsp** 用于类型检查（通过 Mason 或手动安装）
- **nvim-lspconfig** 用于语言服务器集成
- **jupyter-vim** 或 **molten-nvim** 用于类似 notebook 的执行
- **telescope.nvim** 用于文件/符号搜索
- **none-ls.nvim** 搭配 black 和 ruff 用于格式化/linting

如果你还不会使用 Vim，现在不要开始学。学习曲线会与学习 AI 工程竞争。使用 VS Code。

## 使用方式

有了这个设置，你的日常工作流如下：

1. 在 VS Code 中打开项目文件夹（或通过 Remote SSH 连接到 GPU 机器）。
2. 在编辑器中编写 Python，享受自动补全、类型提示和内联错误提示。
3. 使用 Jupyter 扩展内联运行 Jupyter notebook。
4. 使用内置终端运行训练脚本、uv pip install 和 GPU 监控。
5. 在提交前使用 GitLens 审查更改。

## 练习

1. 安装 VS Code 和第 2 步中列出的所有扩展
2. 将本课程的 settings.json 复制到你的 VS Code 配置中
3. 打开一个 Python 文件，验证 Pylance 显示类型提示，Black 在保存时格式化
4. 如果你有远程机器的访问权限，设置 Remote SSH 并在其上打开一个文件夹

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| LSP | "自动补全引擎" | 语言服务器协议：编辑器从特定语言的服务器获取类型信息、补全和诊断的标准 |
| Pylance | "Python 插件" | 微软的 Python 语言服务器，使用 Pyright 进行类型检查和 IntelliSense |
| Remote SSH | "在服务器上工作" | VS Code 扩展，在远程机器上运行轻量级服务器，并将 UI 流式传输到本地编辑器 |
| Format on save | "自动美化" | 编辑器在每次保存时运行格式化程序（Black、Ruff），因此代码风格始终一致 |
