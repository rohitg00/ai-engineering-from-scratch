# 26 · 带拒绝名单与路径监牢的沙箱运行器（Sandbox Runner with Denylist and Path Jail）

> 验证关卡（verification gate）决定一个工具调用是否应该执行。沙箱决定当它执行时会发生什么。本课实现一个子进程运行器，它拒绝危险的可执行文件、拒绝危险的 argv 形态、将所有文件路径监禁在项目根目录下、截断超长输出，并按墙上时钟超时杀死失控的进程。这是夹在模型与操作系统之间的两道防线中的第二道。

**类型：** 构建
**语言：** Python（标准库）
**前置：** 阶段 19 · 25（验证关卡与观测预算）、阶段 14 · 33（指令即约束）、阶段 14 · 38（验证关卡）
**时长：** 约 90 分钟

## 学习目标

- 构建一个 `Sandbox` 类，包装 `subprocess.run`，并具备超时、捕获与截断功能。
- 基于拒绝名单（denylist）按名称拒绝命令，并通过 argv 检查器按结构拒绝命令。
- 拒绝任何解析后超出所声明项目根目录的路径参数。
- 在关闭 Shell 模式时拒绝 Shell 元字符。
- 返回结构化的 `SandboxResult`，供下游可观测性和评估框架（eval harness）使用。

## 问题

一个能执行 Shell 命令的编程智能体（coding agent）可以在一个回合内安装后门、窃取密钥、搞垮开发者的笔记本电脑并产生巨额云账单。成本最低的防御是不给它 Shell。成本第二低的防御是一个沙箱，对一组精确的模式列表说"不"。

在智能体追踪（agent trace）中反复出现三类失败。

第一类是危险的**可执行文件**。一个急于修复路径问题的模型会尝试 `sudo`、`chmod -R 777`、`rm -rf`、`mkfs`、`dd`。这些都不应该在智能体运行中出现。拒绝名单按名称和别名捕获它们。

第二类是 **argv 花招**。一个被告知不能用 Shell 的模型会通过解释器发起管道攻击：`python3 -c "import os; os.system('rm -rf /')"`、`bash -c '...'`、`node -e '...'`、`perl -e '...'`。沙箱需要知道，任何以 `-c` 类标志运行的解释器不过是换了一种方式的 Shell 调用。

第三类是**路径逃逸**。模型被告知读取 `./src/main.py`，却去读取 `../../etc/passwd`。沙箱通过 `os.path.realpath` 解析每一个路径参数并断言其前缀来监禁路径。

这个沙箱并不是操作系统意义上的安全边界。一个有决心的、具备代码执行能力的攻击者仍然可以逃逸。沙箱是一个开发时的护栏（guardrail）：它让常见故障模式变得明显，并阻止智能体因纯粹的无能而造成破坏。

## 概念

```
flowchart TD
  Call[ToolCall<br/>已通过关卡链] --> Run["Sandbox.run()"]
  Run --> S1[1. 对照拒绝名单解析可执行文件<br/>rm, sudo, mkfs, ...]
  S1 --> S2[2. 检查 argv<br/>解释器 -c, shell=False 时的 Shell 元字符]
  S2 --> S3[3. 将类路径参数<br/>通过 realpath 对照 project_root 解析]
  S3 --> S4[4. 启动子进程<br/>捕获, 墙上时钟超时, 环境变量清理]
  S4 --> S5[5. 将 stdout/stderr 截断到 max_output_bytes]
  S5 --> Result[SandboxResult<br/>exit_code, stdout, stderr,<br/>truncated, timed_out, denied, reason]
```

沙箱有四个拒绝轴：名称、argv、路径、结构。每个轴都是调用的纯函数，尚未涉及子进程。子进程只有在每个轴都通过之后才会启动。

`SandboxResult` 的退出码遵循惯例：0 表示成功，非零表示失败，外加三个哨兵码：拒绝（-100）、超时（-101）和截断（退出码为真实值，并设置一个标志位）。下游课程读取这个结构化结果，而不是解析 stderr。

## 架构

```
flowchart LR
  Harness[AgentHarness<br/>第 20-25 课] -->|调用| Sandbox[Sandbox<br/>拒绝名单<br/>路径监牢<br/>argv 检查<br/>超时<br/>截断]
  Sandbox -->|执行| Popen[subprocess.Popen]
  Sandbox --> Result[SandboxResult]
```

拒绝名单是一个可执行文件基本名称（basename）的 frozenset。别名（`/bin/rm`、`/usr/bin/rm`）都解析为同一个基本名称。argv 检查器识别解释器形态：任何 `argv[0]` 是解释器且后续参数以 `-c` 或 `-e` 开头的 argv 都被拒绝。当调用未显式请求 Shell 时，Shell 元字符（`;`、`|`、`&`、`>`、`<`、反引号、`$()`）会导致拒绝。

路径监牢是最微妙的部分。沙箱在构造时接受一个 `project_root`。任何看起来像路径的参数（包含 `/` 或匹配现有文件）都通过 `os.path.realpath` 规范化，然后与项目根目录的 realpath 进行对比。如果解析后的目标不在根目录下，则拒绝。符号链接逃逸尝试（项目根目录下指向外部的符号链接）通过检查 realpath 而非字面路径来阻止。

## 你将构建的内容

实现包括 `main.py` 和一个 tests 目录。

1. `SandboxResult` 数据类：`exit_code`、`stdout`、`stderr`、`truncated`、`timed_out`、`denied`、`reason`、`duration_ms`。
2. `SandboxConfig` 数据类：`project_root`、`max_output_bytes`、`timeout_seconds`、`denylist`、`interpreter_block`。
3. `Sandbox` 类：`run(argv, *, shell=False, cwd=None)` 返回一个 `SandboxResult`。
4. 内部拒绝辅助函数：`_check_executable_denylist`、`_check_argv_interpreter`、`_check_shell_metachars`、`_check_path_jail`。
5. 带明确 `truncated` 标志的输出截断，并在捕获的流中插入标记行。
6. 底部的演示：一系列合法调用和对抗性调用。每个调用均显示其结果。

沙箱默认使用 `subprocess.run`，`shell=False`，`capture_output=True`。墙上时钟超时使用 `timeout` 参数；当发生 `TimeoutExpired` 时，沙箱杀死进程组并合成一个 SandboxResult。

## 为什么这不是一个真正的沙箱

本课的沙箱不使用命名空间（namespace）、cgroups、seccomp、gVisor、Firecracker 或任何内核级隔离。子进程能做的事，沙箱都能做。其保护是结构性的：智能体被拒绝最常见的危险调用，响亮的拒绝进入可观测性（observability）系统，而不是静默执行。

对于生产级智能体，你可以在其上叠加：在一个无特权 Docker 容器中运行，在微虚拟机（microVM）中运行，降低能力（drop capabilities），将项目根目录挂载为只读、临时目录挂载为读写，对内存和 CPU 设置 ulimit，将环境变量清理到一个已知的安全白名单。第 29 课会涉及其中部分内容。操作系统级隔离不在本课范围之内。

## 运行方式

```bash
cd phases/19-capstone-projects/26-sandbox-runner-denylist
python3 code/main.py
python3 -m pytest code/tests/ -v
```

演示会创建一个临时目录，在其中放入一个干净文件，然后运行一批调用。合法调用成功。被拒绝的调用返回 `SandboxResult`，其中 `denied=True` 并带有原因。超时返回 `timed_out=True`。截断设置 `truncated=True`。演示打印一张 JSON 结果表并以零退出码结束。

## 本课如何与轨道 A 其余部分组合

第 25 课产出了关卡链。第 26 课是在关卡返回 ALLOW 之后执行的运行器。第 27 课的评估框架将沙箱结果与每个任务的期望退出码进行比较。第 28 课在每次 `Sandbox.run` 调用周围发出一个 `gen_ai.tool.execution` 跨度。第 29 课的端到端演示将一个真正的编程智能体串联通过这两道防线。
