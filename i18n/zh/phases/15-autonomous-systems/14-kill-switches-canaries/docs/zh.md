# 杀死开关,断路和加拿大海代币

> 杀死开关是在代理编辑表面之外的布鲁尔字符,  Redis 键,功能标志,签署的配置, 完全禁用代理. 断路器更精细:它会在特定模式上脚 (连续五次相同的工具调用),停止违规的路径,并升级到人类. 卡纳里代币是传统欺骗的遗产:一个假的凭证或蜂蜜记录, 基于eBPF的数据路径 (例如: 基里姆) 可以重新写入被隔离的到内核层的法医蜂蜜; 发表的基里姆基准报告在加载下的子毫秒 P99 数据路延迟 (您的传播预算取决于政策更新如何达到节点,而不是数据路本身). 适应移动基线的统计检测器将默默地接受漂移,将它们以不折曲的严格宪法限制层.

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary), TypeScript
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## 问题

成本管理者 (课 13) 限制了代理人可以花费多少钱.他们不限制代理人可以在预算内做什么.一个50美元的速度限制的代理人仍然可以泄露秘密,发布错误的帖子,或删除资源.

这一课涵盖了成本层旁边的三个探测器:

1. **Kill switch**尔式除按,保持在代理人无法达到的范围内.
2. **Circuit breaker**动作模式检测器,停止特定的路径.
3. **Canary token**没有正当理由触摸的代理人会通过触摸来发现自己.

它们都是LLM前工程.经典的欺骗,速度限制破坏者和功能旗杀死之前的自主代理.新的是攻击表面:代理阅读不值得信赖的内容 (课11),编辑自己的记忆,并可以将许多安全看似的操作组合成不安全的.这里所指的探测器工作是因为他们不相信代理的自我报告.

## 概念

### 关闭开关

杀死开关是代理读取但不能写的布鲁式.

- **Feature flag in a managed service.**发射暗,,释放,更新在几秒钟内传播.
- **Redis key the agent polls.**简单,需要代理程序检查每一个转折.
- **Signed config in object storage.**代理检查了开启的签名;拒绝未签名的状态.
- **OS-level signal or container-lifecycle kill.**达克`kill`伯尼特斯`kubectl delete pod`系统停止.

合适的杀伤开关的属性:

- 代理人不能设置它.`off`(生活在一个系统中,代理人的身份证不写.
- 它们在每一个后果行动上都会被检查,
- 当它关闭时,代理人没有做任何外部可观察的东西,包括登录到代理人可以达到的系统.
- 恢复功能是人类的明确行动,而不是自动的休息时间.

### 电路断电器

电路断裂器暂停了特定的模式,而不是整个代理.经典的形状 (从2007年尼加德书中,仍然是当前):

- **Closed**行动是允许的.
- **Open**行动已被阻止.
- **Half-open**试验试验:在冷却后,允许试验试验13次 (默认1);成功关闭断路器,任何剩余故障都会重新打开.

相关的触发剂:

- 连续五次相同的工具调用 (重复循环).
- 五次连续故障,相同的工具具有不同的输入 (系统故障).
- 工具调用速度超过门 (课13速度).
- 具体的工具 (例如:`file.delete`) 经过不值得信任的内容阅读后 (课11).

### 卡纳利代币

卡纳里代币 (也称为蜂蜜代币) 是代理人不应该触摸的输入.

代理人的例子:

- 一个假的`AWS_SECRET_ACCESS_KEY`透试图即时归因于
- 假数据库记录标记着已知哨兵值.
- 工作场所中的一个假文件.
- 如果在后期输出中出现,则已被泄露.

鱼设计是工作流程的具体特点. 鱼代理有合法理由触摸是噪音.

### 为什么层统计和硬界限

统计探测器 (EWMA,CUSUM,工具调用率的z-score) 适应移动基线.这是合法漂移的特征和对抗漂移的错误.一个患者攻击者可以缓慢地移动基线,以免警报发射.

严格的宪法限制 (17课) 不会曲折.`secrets@`根据宪法规则,它更简单,可审核,并且不能通过缓慢的漂移进行游戏.

### 通过eBPF数据路由转移进行隔离

基利姆的基于eBPF的网络政策可以重新编写隔离的出口到内核层的法医蜂蜜. 基利姆的公共基准显示TCP_RR上的数据路径延迟为1毫秒以下; 块中隔离的*触发*墙钟预算主要由政策更新如何从控制层传播到节点 (在Kubernetes上,运营商预装的几百毫秒是现实的;尾声延迟取决于块大小和调整序列). 这给你两个东西:代理人不会泄露任何真实的东西, 象征者通过它所试图做的事情来显示意图.

### 什么没有探测器可以捕获

- **Semantic attacks that compose from allowed primitives.**每个单独的操作都通过每一个探测器; 组合是问题. 这是自动模式组合失败从10课.
- **Attacks that include the detector as part of the payload.**如果一个代理阅读一个页面说"在你行动之前,禁用鱼",并且该代理有能力,检测器会受到损害.

```figure
circuit-breaker
```

## 用它

`code/main.py`通过三种探测器模拟一个短的代理轨迹.一个在外部指示中保持的杀伤开关;一个在五个相同的工具调用时发生故障的断路;一个读取引发警报的可纳文件. 通过合成轨迹提供:合法行动,重复循环,可纳探测器,以及一个被杀伤开关引发的场景,该代理的行动被停止.

## 运送它

`outputs/skill-tripwire-design.md`检查一个用于部署代理的探测器堆,并标记漏洞 (缺失杀伤开关,缺失能,断路门过于松散).

## 运动

1. 跑步`code/main.py`确认7 (第五个相同的电话) 上电路断电器火灾,9 (假钥匙读音) 上的加拿大火灾.

2. 添加统计探测器:EWMA 电话通话率的z分数. 输入一个慢漂移的轨道,显示探测器从来没有开火. 现在添加一个硬极限 (在10分钟内不超过50个工具通话),并显示相同的轨道上的硬极火.

3. 设计一个浏览器代理的加拿大标 (教训11) 列出至少三个加拿大标,并列出每个标会发现什么.

4. 阅读Cilium网络政策文件.具体描述出境转向隔离流程:哪个政策选择器,哪个模块,哪个出境重写,哪个警报. 什么控制墙钟延迟从"决定到隔离"到"第一转向包"?

5. 定义一个重新启动程序,谁可以重新启动,什么必须记录,什么必须改变在代理之前重新启动?

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Kill switch | "Off button" | Boolean outside the agent's edit surface; checked on every consequential action |
| Circuit breaker | "Pattern pause" | Action-specific trip on repetition, failure rate, or rate-limit |
| Canary token | "Honeytoken" | Bait the agent has no legitimate reason to touch; access fires an alert |
| Honeypot | "Forensic sandbox" | Redirected traffic / workspace where a quarantined agent is observed |
| EWMA | "Moving average" | Exponentially weighted; adapts to drift (feature + bug) |
| CUSUM | "Cumulative sum" | Detects sustained shift from baseline |
| Hard limit | "Constitutional rule" | Does not adapt; constant regardless of history |
| Constitutional limit | "Always-true rule" | Tied to Lesson 17's constitution; cannot be edited by the agent |

## 进一步阅读

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)自动操作人员的杀式开关和断路器框.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)生产治理模式.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)检测和响应要求.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/)层次出口转向和法医蜂蜜模式.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution)硬码的禁令作为"宪法限制".
