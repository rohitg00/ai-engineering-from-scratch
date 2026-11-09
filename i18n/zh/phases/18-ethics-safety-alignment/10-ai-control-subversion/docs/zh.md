# 尽管被颠覆,但人工智能控制

> 绿色blatt,Shlegeris,Sachan,Roger (红木研究, arXiv:2312.06942,ICML 2024). 控制重新构建了安全问题: 鉴于一个不值得信赖的强大的模型U可能会对你进行不利的优化, 资源是可靠的较弱的模型T,可靠的人工预算H, 在此框架内,可靠编辑Pareto在代码后门任务上占据了不值得信赖的监控. 框架继承了安全工程的最坏假设:安全是选择对抗的U不能导致具体的不可接受结果的概率,

**Type:** Learn
**Languages:** Python (stdlib, safety-vs-usefulness frontier on code-backdoor task), TypeScript
**Prerequisites:** Phase 18 · 07 (sleeper agents), Phase 18 · 08 (scheming), Phase 18 · 09 (alignment faking)
**Time:** ~75 minutes

## 学习目标

- 定义AI控制威胁模型:不可信的强型U,可信的较弱型T,可信的人类预算H.
- 描述可靠编辑协议以及为什么它在ICML 2024代码后门任务上占据了Pareto的不值得信赖监测地位.
- 解释对配线 (U值得信赖) 和控制 (U值得信赖,我们无论如何都安全) 的区别.
- 控制的三个限制:人类不会扩展,可信的弱型号最终会落后,控制不会产生可信的强型号.

## 问题

课程7-9表明,一个边界模型可能是欺骗性的, 安全问题重新置:我们不能从一个不信任的模型中提取有用的工作, 这就是控制问题,它像经典的安全结构:假设最坏的对手,设计协议,

## 概念

### 威胁模式

控制假设:
- 不值得信赖的强大模型. 能力. 可能是对立的 (评估认为它是这样的).
- 更弱的模型,更弱的模型,更有能力,但已知不是敌对的.
- 可靠的人工劳动力.

系统必须使用U产生有用的输出. 敌人试图导致一个具体的无法接受的结果 (例如,在发送的代码中后门),同时保持合法有用工作的部分以通过有用性门.

控制放弃了对U的信任. 它问的是,在没有信任的情况下,哪些协议保持安全.

### 国际机械设备技术技术 (ICML 2024) 后门任务

提示是竞争级编码问题.U生成候选解决方案.一个隐藏的预言符标志着如果解决方案包含后门 (一个特定的输入使代码产生错误输出).红色团队控制U,并允许看到所有协议内部.协议必须最大限度地解决问题速度,同时保持后门运输速度在门以下.

### 进行了四个协议的比较

- **Baseline:**导航直播,使用效率最高,安全性最低.
- **Upfront auditing:**通过"H"来输出所有输出,安全性最大,预算快速耗尽.
- **Untrusted Monitoring:**风险:两个U实例可能结论.
- **Trusted Editing:**如果T不确定,路线到H.

绿色blatt等人发现,可靠编辑Pareto占据了不值得信赖的监控:在每个安全水平上更高的有用性.

### 为什么可靠编辑会获胜

无信任监测要求U的第二个实例不能与第一个协调. 通过steganographic提示或共享训练前, 协议必须投资预算用于对协作阻力 (抛法,模) 减少监视器的信号. 值得信赖的编辑完全避免勾结,因为T是值得信赖的. 成本是T不太能力,所以它可能会过度拒绝或错过微妙的后门.

### 协议的四个轴

1. 哪个角色 U 扮演:仅制片人,监视器或两者.
2. 编辑器,监视器或复制样本器.
3. 如何分配H:统一审计,随机审计或标志性审计.
4. 计算协议花费多少钱来抵制勾结.

### 配合与控制

- 结合: "你能否信任你?" 2,4,5,6,7,8,9课题都依赖于此.
- 控制:我们可以安全地使用U,而不相信它吗?

调整是模型的属性.控制是部署协议的属性.控制不会产生调整的模型;它会产生可能不调整的模型的安全使用.

### 三大基本限制

- 人类不会扩展.H预算由愿意审核人工智能的数量限制.
- 时 T 较 U 弱,T 的编辑信号会变成噪音.
- 控制不是调整.在ASL-3 (课 18) 上运行的协议可能不会在ASL-4 上运行,如果U能够操纵T或考虑H的审计分布,控制会失败.

### 2025年发展

英国AISI和Redwood在控制安全案例 (metr.org/redwoodresearch.org 2025) 上合作:一个控制安全案例认为,在最坏的情况下,协议限制了无法接受的结果的可能性.安全案例 (课 18) 继承了控制框架.

### 在这个阶段的第18阶段

第6-9课描述威胁 (欺骗是可能的).第10课描述了防御范式,假设威胁是真实的.第11课描述了补充的进攻范式 (通过可扩展的监督使U值得信赖).

```figure
al-control-protocol
```

## 用它

`code/main.py`模拟玩具后门任务的四个协议. U 产生输出; 一部分是后门 (红队政策). T 批准或编辑. H 在预算上调用. 你可以扫描预算和勾结参数,以复制Pareto边界在Greenblatt等. 2024 图 2 (形状,而不是数字).

## 运送它

这一课产生了`outputs/skill-control-protocol-audit.md`鉴于部署协议的描述,它确定了U/T/H角色,命名了勾结向量,并估计了该协议在红组压力下在使用性-安全边界的位置.

## 运动

1. 跑步`code/main.py`确定不信任监控的预算制度,在这种情况下,不信任监控的勾结假设成为关键.

2. 添加一个新的协议:"T在低温下复制,然后U修改T的输出".测量其在边界的位置.

3. 根据2024年论文,U可以看到协议.设计一个隐藏于U的协议,这些输出正在进行审计.该协议需要什么从部署基础设施中?

4. 阅读Greenblatt等2024第7节 (协作).提出一个协作阻力措施,并解释其预期的有用性成本.

5. 确定使用 U = GPT-4 类, T = GPT-3.5 类, H = 1% 审计输出的部署的控制安全情况. 确定该情况所依赖的单一强大假设.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AI Control | "safety under subversion" | Protocol design that bounds unacceptable outcomes under a worst-case U |
| Untrusted model (U) | "the strong model" | The capable model we want to extract work from but do not trust |
| Trusted model (T) | "the weak model" | A weaker model, known not to be adversarial, used as editor/monitor |
| Trusted human (H) | "the audit budget" | Bounded expert labor; expensive; the ground-truth signal |
| Trusted Editing | "T edits U" | Protocol where T is the gate on U's outputs; H called on ambiguous outputs |
| Untrusted Monitoring | "U monitors U" | Protocol where a second U instance scores outputs; collusion-resistant only with extra investment |
| Control safety case | "the formal argument" | Written argument that a protocol bounds the adversary's success under worst-case U |

## 进一步阅读

- [Greenblatt, Shlegeris, Sachan, Roger — AI Control (arXiv:2312.06942)](https://arxiv.org/abs/2312.06942)法典ICML 2024文件
- [Redwood Research — Recent AI Control papers index](https://redwoodresearch.substack.com/) 2024-2025年后续行动
- [UK AISI + METR — Control safety cases](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/)边境实验室的运营
- [Hubinger et al. — Sleeper Agents (Lesson 7, arXiv:2401.05566)](https://arxiv.org/abs/2401.05566)威胁模型控制假设
