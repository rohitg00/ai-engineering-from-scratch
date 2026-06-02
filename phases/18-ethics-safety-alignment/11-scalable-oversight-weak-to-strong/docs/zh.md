# 可扩展监督与弱到强泛化（Scalable Oversight and Weak-to-Strong Generalization）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Burns 等人（OpenAI Superalignment，《Weak-to-Strong Generalization》，2023）提出了一个用来代理 superalignment（超级对齐）问题的实验范式：用一个较弱模型产出的标签去 fine-tune 一个较强模型。如果强模型能从不完美的弱监督中正确泛化，那么当前面向人类规模的对齐方法或许可以延伸到超人类系统。可扩展监督（scalable oversight）和 W2SG 是互补的。可扩展监督（debate、recursive reward modeling、task decomposition）提升监督方的有效能力，使其跟得上被监督的模型。W2SG 则确保强模型能从监督方提供的、不论多么不完美的监督信号里正确泛化。《Debate Helps W2SG》（arXiv:2501.13124，2025 年 1 月）把两者结合起来。

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 定义 scalable oversight 和 weak-to-strong generalization，并解释二者为何互补。
- 描述 Burns 等人 2023 的实验设置：用 GPT-2 产出的标签来 fine-tune GPT-4。
- 解释 performance gap recovered（PGR，性能差距回收率）这个指标，以及它衡量的是什么。
- 说出三种主要的可扩展监督机制（debate、recursive reward modeling、task decomposition），并各举出一个优点。

## 问题（The Problem）

Phase 18 到目前为止介绍的每一种对齐方法，都假设监督方能够评估模型的行为。一旦模型达到超人类水平，监督方就成了短板。superalignment 的核心问题是：一个较弱的监督者，能否可靠地训练出一个更强、且仍然对齐的模型？

Burns 等人把这个问题简化为一个可操作的实证设置：用弱监督强，测量强模型的能力在弱监督下保留下来多少。这并不是 superalignment 的解，而是一个能让我们测量进展的代理指标。

## 概念（The Concept）

### W2SG：Burns 等人的实验设置

- 弱模型：GPT-2 级别。
- 强模型：GPT-4 级别。
- 目标：强 GPT-4 在该任务上的能力上限。

流程：
1. 拿到弱模型在任务上的 zero-shot 预测。
2. 用弱标注的数据 fine-tune 强模型。
3. 测量 fine-tune 后强模型的准确率。

基线（baseline）：弱模型自身的准确率，以及强模型在 gold label（金标）上做监督训练所能达到的上限。

差距指标：Performance Gap Recovered（PGR）= (fine-tuned − weak) / (ceiling − weak)。PGR 为 1.0 表示弱监督完全弥合了差距；PGR 为 0 表示弱监督完全没有帮助。

### Burns 等人的实证发现

在 NLP 任务、国际象棋题、reward modeling 任务上，PGR 都稳定为正：强模型能够泛化到弱监督方所犯错误之外。具体任务上的 PGR 从约 20% 到约 80% 不等。强模型从不完美的标签中"理解"到了任务的真实意图，并用预训练阶段习得的先验补齐了缺口。

Burns 等人指出的局限：
- 这里 weak-to-strong 的差距是能力差距，而不是对齐差距。弱模型本身是对齐的；真正超人类的模型有可能是被一个人类对齐的，而能力差距远比这里大得多。
- 强模型能泛化，可能更多是因为任务先验，而不是真的"还原"了 ground-truth 意图。
- 真正的难题是怎么把强模型潜藏的知识引出来；PGR 只是把这个问题做了一个特定的可操作化。

### 可扩展监督：三种机制

- **Debate（Irving 等人，2018）。** 让 U 的两个实例分别为正反方辩论，由弱裁判做判断。其假设是：找到一个有说服力的真实答案，要比找到一个有说服力的虚假答案更容易。2024–2025 年的近期工作（Khan 等人、Michael 等人）显示 debate 有时管用、有时不管用，是否管用取决于任务结构。
- **Recursive Reward Modeling（Leike 等人，2018）。** 让 U 协助人类训练 U+1 的 reward model。监督方的有效能力随着模型一同增长。
- **Task Decomposition（Christiano、Shlegeris、Amodei，2018）。** 把一个困难任务递归地分解成人类可以核验的子任务。前提是任务可分解。

每种机制都对任务结构、或对中间组件的对齐性，做出了某种假设。

### 为什么 scalable oversight 和 W2SG 互补

Scalable oversight 提升监督方提供的有效信号质量。
W2SG 则确保不论监督方能给出多差的信号，强模型都能从中正确泛化、缩小差距。

Lang 等人——《Debate Helps Weak-to-Strong Generalization》（arXiv:2501.13124）把两者结合起来：用一个 debate 协议产出更好的弱标签，再用这些标签去训练强模型。文中报告了在 NLP 任务上的 PGR 提升。

### 组织层面的戏剧

OpenAI 的 Superalignment 团队在 2024 年 5 月、Jan Leike 离开转投 Anthropic 之后宣布解散。但其议程（scalable oversight、W2SG、自动化对齐研究）在 Anthropic 以及多家学术机构延续了下来——MATS（Lesson 28）、Redwood（Lesson 10）、Apollo（Lesson 8）、METR（Lesson 28）。组织结构变了，研究问题没变。

### 在 Phase 18 中的位置

Lesson 6–10 在"U 不可信"的前提下，描述了威胁本身和对应的防御范式。Lesson 11 则是攻方范式：把监督方做得足够强，让它能验证 U 是否对齐。Lesson 12–16 接着进入对抗式评估的实操工具链。

## 用起来（Use It）

`code/main.py` 在一个合成任务上模拟一次 W2SG fine-tune。弱标注者的准确率为 70%，并带有结构化的错误模式；强模型在 gold label 上的能力上限为 95%。你用弱标签 fine-tune 强模型，测量 PGR，并把它和"强模型用 gold 训练"以及"弱模型单独运行"对比。

## 上线部署（Ship It）

这节课产出 `outputs/skill-w2sg-pgr.md`。给定一段监督设置的描述，它会识别出弱监督方、强模型、监督质量，并计算（或主动询问）PGR。它会标注当前论断属于"弱可以监督强"，还是"弱 + 某种监督机制可以监督强"。

## 练习（Exercises）

1. 跑 `code/main.py`。报告 weak_accuracy = 0.60、0.70、0.80 时的 PGR。解释这条 PGR 曲线的形状。

2. 把弱标注者改成带结构化错误的（例如：在某一类特定输入上总是错）。PGR 是上升、下降、还是不变？解释原因。

3. 读 Burns 等人 2023 的 Section 4.3（NLP tasks）。复现"confidence auxiliary loss"的直觉：当强模型比弱标签更自信时，谁说了算？

4. 为一个软件工程任务设计一个把 debate 和 task decomposition 结合起来的可扩展监督协议。各举出一种组件失效模式，并解释组合是如何（或如何未能）应对每一种失效模式的。

5. 阐述什么样的实证证据会证伪"weak-to-strong generalization 是通往 superalignment 的可行路径"这一论断。请具体描述你需要看到的实证特征。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scalable oversight | "把监督方做得更强" | 一类提升监督方评估更强模型能力的机制 |
| W2SG | "弱监督强" | 用弱标签 fine-tune 强模型，并测量恢复出多少能力 |
| PGR | "性能差距回收率" | (fine-tuned − weak) / (ceiling − weak)；1.0 = 完全弥合，0 = 没用 |
| Debate | "U 的两个实例互辩" | 一种可扩展监督机制：弱裁判在两个 U 辩护方之间做选择 |
| RRM | "recursive reward modeling" | U 协助训练 U+1 的 reward model；监督方能力跟随 U 一起涨 |
| Task decomposition | "人类可核验的子任务" | 把困难任务递归地拆成人类能核验的子任务 |
| Superalignment | "对齐超人类 AI" | 关注如何对齐"人类无法直接评估的模型"的研究议程 |

## 延伸阅读（Further Reading）

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) — W2SG 论文
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) — debate 机制
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) — recursive reward modeling
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) — 2024 年关于"更强辩手 debate"的实证研究
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) — 2025 年把 debate 和 W2SG 结合起来的工作
