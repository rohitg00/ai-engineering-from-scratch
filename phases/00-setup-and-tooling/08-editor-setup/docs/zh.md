# 编辑器设置

> 你的编辑器就是你的得力助手。一次配置好，让它不再碍事，并开始发挥它的作用。

**类型：** 构建  
**语言：** --  
**前置条件：** 阶段 0，课程 01  
**时间：** 约 20 分钟  

## 学习目标

- 安装 VS Code 及其用于 Python、Jupyter、代码检查（Linting）和远程 SSH 的核心扩展
- 配置保存时自动格式化、类型检查以及适合 AI 工作流的笔记本输出滚动
- 设置远程 SSH，以便在远程 GPU 机器上像本地一样编辑和调试代码
- 评估编辑器替代方案（Cursor、Windsurf、Neovim）及其在 AI 工作中的权衡

## 问题所在

你将在编辑器中花费数千小时来编写 Python 代码、运行笔记本、调试训练循环以及通过 SSH 连接 GPU 服务器。配置不当的编辑器会让每次操作都变得繁琐：没有自动补全、没有类型提示、没有内联错误提示、需要手动格式化，并且终端工作流笨拙。

正确的设置只需 20 分钟。跳过它会让你每天多花 20 分钟。

## 概念理解

一个 AI 工程编辑器的设置需要五样东西：

```mermaid
graph TD
    L5["5. 远程开发<br/>通过 SSH 连接 GPU 服务器、云虚拟机"] --> L4
    L4["4. 终端集成<br/>运行脚本、调试、监控 GPU"] --> L3
    L3["3. AI 特定设置<br/>自动格式化、类型检查、标尺"] --> L2
    L2["2. 扩展<br/>Python、Jupyter、Pylance、GitLens"] --> L1
    L1["1. 基础编辑器<br/>VS Code — 免费、可扩展、通用"]
```

## 动手搭建

### 第 1 步：安装 VS Code

VS Code 是推荐使用的编辑器。它免费，兼容所有操作系统，拥有一流的 Jupyter 笔记本支持，并且其扩展生态系统覆盖了 AI 工作所需的一切。

从 [code.visualstudio.com](https://code.visualstudio.com/) 下载。

在终端中验证安装：

```bash
code --version
```

如果在 macOS 上找不到 `code` 命令，请打开 VS Code，按下 `Cmd+Shift+P`，输入 "Shell Command"，然后选择 "Install 'code' command in PATH"。

### 第 2 步：安装核心扩展

打开 VS Code 的内置终端（`Ctrl+`` ` 或 `` Cmd+` ``），安装对 AI 工作有用的扩展：

```bash
code --install-extension ms-python.python
code --install-extension ms-python.vscode-pylance
code --install-extension ms-toolsai.jupyter
code --install-extension eamodio.gitlens
code --install-extension ms-vscode-remote.remote-ssh
code --install-extension ms-python.debugpy
code --install-extension ms-python.black-formatter
code --install-extension charliermarsh.ruff
```

每个扩展的作用：

| 扩展 | 用途 |
|-----------|-----|
| Python | 语言支持、虚拟环境检测、运行/调试 |
| Pylance | 快速类型检查、自动补全、导入解析 |
| Jupyter | 在 VS Code 中运行笔记本、变量查看器 |
| GitLens | 查看谁更改了什么、内联 Git 责备 |
| Remote SSH | 像本地一样打开远程 GPU 服务器的文件夹 |
| Debugpy | Python 的逐步调试功能 |
| Black Formatter | 保存时自动格式化，保持样式一致 |
| Ruff | 快速代码检查，捕获常见错误 |

本课程中 `code/.vscode/extensions.json` 文件包含了完整的推荐列表。当你打开项目文件夹时，VS Code 会提示你安装它们。

### 第 3 步：配置设置

复制本课程中 `code/.vscode/settings.json` 的内容，或通过 `设置 > 打开设置 (JSON)` 手动应用。

AI 工作的关键设置：

```jsonc
{
    "python.analysis.typeCheckingMode": "basic",
    "editor.formatOnSave": true,
    "editor.rulers": [88, 120],
    "notebook.output.scrolling": true,
    "files.autoSave": "afterDelay"
}
```

为什么这些设置很重要：

- **将类型检查设为 basic**：在运行前捕获错误的参数类型。节省调试张量形状不匹配和错误 API 参数的时间。
- **保存时格式化**：再也不需要考虑格式化问题。Black 会自动处理。
- **标尺设在 88 和 120**：Black 会在 88 列处换行。120 的标记提示文档字符串和注释是否过长。
- **笔记本输出滚动**：训练循环会打印数千行。如果没有滚动，输出面板会爆炸。
- **自动保存**：你总会忘记保存。你的训练脚本会运行旧代码。自动保存可以防止这种情况。

### 第 4 步：终端集成

VS Code 的内置终端是你运行训练脚本、监控 GPU 和管理环境的地方。

正确设置：

```jsonc
{
    "terminal.integrated.defaultProfile.osx": "zsh",
    "terminal.integrated.defaultProfile.linux": "bash",
    "terminal.integrated.fontSize": 13,
    "terminal.integrated.scrollback": 10000
}
```

常用快捷键：

| 操作 | macOS | Linux/Windows |
|--------|-------|---------------|
| 切换终端 | `` Ctrl+` `` | `` Ctrl+` `` |
| 新建终端 | `Ctrl+Shift+`` ` | `Ctrl+Shift+`` ` |
| 拆分终端 | `Cmd+\` | `Ctrl+\` |

拆分终端很有用：一个用于运行脚本，另一个用于使用 `nvidia-smi -l 1` 或 `watch -n 1 nvidia-smi` 监控 GPU。

### 第 5 步：远程开发（SSH 连接 GPU 服务器）

这是 AI 工作最重要的扩展。你会在远程机器（云虚拟机、实验室服务器、Lambda、Vast.ai）上运行训练。Remote-SSH 让你可以打开远程文件系统、编辑文件、运行终端和调试，就像在本地一样。

设置步骤：

1. 安装 Remote-SSH 扩展（第 2 步已完成）。
2. 按下 `Ctrl+Shift+P`（或 `Cmd+Shift+P`），输入 "Remote-SSH: Connect to Host"。
3. 输入 `user@your-gpu-box-ip`。
4. VS Code 会自动在远程机器上安装其服务器组件。

如需免密码访问，请设置 SSH 密钥：

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
ssh-copy-id user@your-gpu-box-ip
```

为了方便，将主机添加到 `~/.ssh/config` 文件中：

```
Host gpu-box
    HostName 203.0.113.50
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ForwardAgent yes
```

现在，选择 "Remote-SSH: Connect to Host > gpu-box" 即可立即连接。

## 替代方案

### Cursor

[cursor.com](https://cursor.com) 是 VS Code 的一个分支，内置了 AI 代码生成功能。它使用相同的扩展生态系统和设置格式。如果你使用 Cursor，本课程中的所有内容仍然适用。导入相同的 `settings.json` 和 `extensions.json` 即可。

### Windsurf

[windsurf.com](https://windsurf.com) 是另一个以 AI 为先的 VS Code 分支。同样：相同的扩展、相同的设置格式、相同的 Remote-SSH 支持。

### Vim/Neovim

如果你已经在使用 Vim 或 Neovim，并且生产力很高，请继续使用。AI Python 工作的最小设置：

- **pyright** 或 **pylsp** 用于类型检查（通过 Mason 或手动安装）
- **nvim-lspconfig** 用于语言服务器集成
- **jupyter-vim** 或 **molten-nvim** 用于类似笔记本的执行
- **telescope.nvim** 用于文件/符号搜索
- **none-ls.nvim** 配合 black 和 ruff 用于格式化/代码检查

如果你尚未使用 Vim，现在不要开始。学习曲线会与学习 AI 工程产生冲突。请使用 VS Code。

## 如何使用

通过这个设置，你的日常工作流程如下：

1. 在 VS Code 中打开项目文件夹（或通过 Remote-SSH 连接到 GPU 服务器）。
2. 在编辑器中编写 Python 代码，享受自动补全、类型提示和内联错误提示。
3. 使用 Jupyter 扩展内联运行笔记本。
4. 使用内置终端运行训练脚本、`uv pip install` 和监控 GPU。
5. 在提交前使用 GitLens 审查更改。

## 练习

1. 安装 VS Code 以及第 2 步中列出的所有扩展
2. 将本课程的 `settings.json` 复制到你的 VS Code 配置中
3. 打开一个 Python 文件，验证 Pylance 是否显示类型提示，以及 Black 是否在保存时格式化
4. 如果你有远程机器的访问权限，设置 Remote-SSH 并打开该机器上的一个文件夹

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|----------------|----------------------|
| LSP | "自动补全引擎" | 语言服务器协议：一种标准，编辑器通过它从特定语言服务器获取类型信息、补全和诊断 |
| Pylance | "那个 Python 插件" | 微软的 Python 语言服务器，使用 Pyright 进行类型检查和智能感知 |
| Remote-SSH | "在服务器上工作" | VS Code 扩展，在远程机器上运行轻量级服务器，并将用户界面流式传输到本地编辑器 |
| 保存时格式化 | "自动美化" | 编辑器每次保存时运行格式化程序（Black、Ruff），使代码风格始终一致 |