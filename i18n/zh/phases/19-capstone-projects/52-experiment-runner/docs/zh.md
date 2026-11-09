# 试验运行者

> 循环只像它的测量一样诚实. 构建运行器,它采用规格,在一个沙盒子子中执行它,

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 19 Track A lessons 20-29
**Time:** ~90 minutes

## 学习目标
- 运行者可以将实验编码为类型的规格,
- 启动一个硬墙钟时间和软内存盖子的子进程,
- 捕捉了 stdout, stderr,和结构化指标的块,成为一个结果记录.
- 构建一个除表,一次扫一扫一个配置按,
- 给出一个种子,使评估者看到相同的数量.

## 为什么一个子过程

研究循环运行不可信赖的代码.假设来自样本器,实验脚本来自同一个路径;将任何一个作为安全的过程要求发生崩,将乐队调整器下降.子进程是语言船的最简单的孤立:一个单独的过程,一个独立的地址空间,母侧的信号手柄.

跑步者在这里没有实现完整的沙盒.没有cgroup,没有seccomp过器,没有命名空间重新绘制.它确实有一个墙钟时间,一个选区循环用于记忆增长,和一个杀死路径,结束了过程在任何一个极限.这是运行时间合同每一个复杂的沙盒延长.课程使合同足够小,可以在一个座位上读取.

## 实验Spec的形状

```text
ExperimentSpec
  spec_id        : str            (stable id, "exp_001")
  hypothesis_id  : int            (link back to the queue from lesson 50)
  script_path    : str            (path to the python script to run)
  config         : dict           (passed to the script as one json arg)
  seed           : int            (deterministic seed for the experiment)
  wall_timeout_s : float          (hard timeout, killed on exceed)
  memory_cap_mb  : int            (soft cap, polled; killed on exceed)
  metric_keys    : list[str]      (which fields the evaluator will read)
```

脚本生活在磁盘上;运行者将配置写入脚本读取的临时文件路径.脚本预计将在 stdout 上打印一个单个 json 线,其键是 超级集`metric_keys`其他任何东西都会被捕获,但被测量分析器忽略.

```figure
cg-runner-limits
```

## 建筑

```mermaid
flowchart TD
    A[ExperimentSpec] --> B[serialise config to temp file]
    B --> C[spawn subprocess]
    C --> D[stdout / stderr pipes]
    C --> E[wall clock timer]
    C --> F[memory poller]
    E -- exceeded --> K[kill process]
    F -- exceeded --> K
    D --> P[parse final json line]
    K --> R[result with terminal=timeout or oom]
    P --> R[result with metrics]
    R --> O[ExperimentResult]
```

选手是一个类型,有一个主要方法. 选民是一个小线程,每次选民间隔一次醒来,读取子过程.`psutil`根据该平台的规定,在平台未暴露时,该平台将不再使用.

## 为什么软的记忆帽

硬件内存盖子需要`resource.setrlimit`课程提供了一个便携式方法:从平台上测试居民设置大小,如果超过限量,则杀死子进程.由于测试器有一个非零间隔,因此该限量是软的;一个过程可以在测试之间升到限量,然后退回.运行者记录了最大观察的RSS,以便评估员可以看到运行到底是多近.

在没有过程检查支持的系统上,测试员会记录一次性警告并自行禁用.墙钟时间限期仍然适用.课程测试涵盖了两条路径.

## 捕捉到和

跑步者读出完成后排水的两管. 排水被线后扫描;最后一行被解析为json,并所有所需的.`metric_keys`之前的JSON线在结果中保存为`intermediate_metrics`评估者可以使用这些信息来学习曲线.

跑步者从来没有在非零出口代码上提升;相反,它记录了结果中的代码.任何非零出口都标记着`"crash"`评估员将部分运行作为默认失败.

## 排放表

```python
def ablate(base: ExperimentSpec, knob: str, values: list[Any]) -> list[ExperimentSpec]:
    ...
```

根据基准规格和按名称,辅助器返回每值一个规格`config[knob]`每个规格都得到一个衍生.`spec_id`(`f"{base.spec_id}_{knob}_{value}"`跑步者将飞行`AblationRunner`它们是顺序的,然后返回一个`AblationTable`按值按键.

为什么一次一次. 完全的因子扫描速度高,结果值评员无法解释. 一个一次的按产生了评估员可以绘制的清洁轴.课程只支持多按扫描,只作为一次性的单个按排放,由调用者组成.

## 确定性

每个标本都携带一个种子. 运行者通过配置命令将种子转发到脚本中 (`config["__seed"] = spec.seed`实验编写的模拟脚本`code/experiments/`对于""的定义,我们可以说是""的定义,但如果没有确定性,则"退回"可能是不同的随机初始化.

## 假实验剧本

课程中,有一个实验脚本:`code/experiments/sparsity_experiment.py`它是真正的脚本,它读取配置文件,模拟一个小训练运行,用一个无数的随机通过,`sleep_s`测试时间和一个`allocate_mb`测试记忆测试器的.

模拟不是训练任何真实.它是一个数值计算模仿训练循环的形状:一个损失曲线,最后的困惑,一个墙时间.课程的重点是跑步,而不是模拟.一个真正的实验脚本将导入模型.

## 结果形状

```text
ExperimentResult
  spec_id              : str
  hypothesis_id        : int
  exit_code            : int
  terminal             : "ok" | "timeout" | "oom" | "crash"
  wall_time_s          : float
  peak_rss_mb          : float | None
  metrics              : dict
  intermediate_metrics : list[dict]
  stdout_tail          : str
  stderr_tail          : str
```

评价者读到`metrics`其他`terminal`如果终端是其他任何东西`"ok"`实验被认为是失败的,评估者的判决是自动的.

## 如何读取代码

`code/main.py`定义`ExperimentSpec`现在`ExperimentResult`现在`ExperimentRunner`现在`AblationRunner`微型处理器是一个类型,内存调试器是一个小线程,除离辅助器是一个单个函数.

`code/experiments/sparsity_experiment.py`它从 argv 读取配置文件路径,并在完成时写出单个json测量线.

`code/tests/test_runner.py`覆盖成功路径,时间期路径,崩路径,排放表,以及两个运行中的确定性检查.

## 在哪里这个插槽

第五十课产生了假设. 第五十一课过了已经解决的文献. 第五十二课运行了剩下的实验. 第五十三课阅读了结果,运行了意义测试,并写出了主管对假设 id 的判决.
