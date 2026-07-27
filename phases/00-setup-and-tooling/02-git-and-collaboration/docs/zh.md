# Git 与协作

> 版本控制不是可选项。你在这里构建的每一个实验、每一个模型、每一节课都会被追踪。

**类型：** 学习
**语言：** --
**前置条件：** 第 0 阶段，第 01 课
**预计时间：** ~30 分钟

## 学习目标

- 配置 git 身份并使用日常的 add、commit 和 push 工作流
- 创建和合并分支，以便在不破坏主分支的情况下进行隔离实验
- 编写排除模型检查点和大二进制文件的 .gitignore
- 使用 git log 浏览提交历史，理解项目的演变

## 问题

你即将在 20 个阶段中编写数百个代码文件。没有版本控制，你会丢失工作成果、破坏无法撤销的内容，并且无法与他人协作。

Git 是工具。GitHub 是代码存放的地方。这节课涵盖本课程所需的内容，仅此而已。

## 概念

`mermaid
sequenceDiagram
    participant WD as Working Directory
    participant SA as Staging Area
    participant LR as Local Repo
    participant R as Remote (GitHub)
    WD->>SA: git add
    SA->>LR: git commit
    LR->>R: git push
    R->>LR: git fetch
    LR->>WD: git pull
`

需要记住三件事：
1. 经常保存（git commit）
2. 推送到远程（git push）
3. 为实验创建分支（git checkout -b experiment）

## 动手实践

### 第 1 步：配置 git

`ash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
`

### 第 2 步：日常工作流

`ash
git status
git add file.py
git commit -m "Add perceptron implementation"
git push origin main
`

### 第 3 步：为实验创建分支

`ash
git checkout -b experiment/new-optimizer

# ... 进行修改，提交 ...

git checkout main
git merge experiment/new-optimizer
`

### 第 4 步：使用本课程的仓库

`ash
git clone https://github.com/rohitg00/ai-engineering-from-scratch.git
cd ai-engineering-from-scratch

git checkout -b my-progress
# 完成课程，提交你的代码
git push origin my-progress
`

## 使用方式

在本课程中，你只需要这些命令：

| 命令 | 使用时机 |
|---------|------|
| git clone | 获取课程仓库 |
| git add + git commit | 保存你的工作 |
| git push | 备份到 GitHub |
| git checkout -b | 尝试新功能而不破坏主分支 |
| git log --oneline | 查看你已经完成的内容 |

仅此而已。在本课程中你不需要 rebase、cherry-pick 或 submodule。

## 练习

1. 克隆此仓库，创建一个名为 my-progress 的分支，创建一个文件，提交它，推送它
2. 创建一个排除模型检查点文件（.pt、.pth、.safetensors）的 .gitignore
3. 使用 git log --oneline 查看此仓库的提交历史，阅读课程是如何逐步添加的

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| Commit | "保存" | 项目在某个时间点的完整快照 |
| Branch | "副本" | 指向一个提交的指针，随着你的工作而向前移动 |
| Merge | "合并代码" | 从一个分支获取更改并应用到另一个分支 |
| Remote | "云端" | 托管在其他地方（GitHub、GitLab）的仓库副本 |
