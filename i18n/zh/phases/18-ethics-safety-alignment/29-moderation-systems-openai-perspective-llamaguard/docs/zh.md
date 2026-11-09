# 适度系统 OpenAI,视角,拉马卫队

> 产量调节系统将12-16课程中定义的安全政策运行.`omni-moderation-latest`(2024) 基于GPT-4o的版本,在一次通话中分类了文本+图像;多语言测试组比之前版本的版本上比42%更好;响应方案返回了13类的布勒语骚扰,骚扰/威胁,仇恨/威胁,非法,非法/暴力,自伤,自伤/意图,自伤/指示,性,性/未成年人,暴力,暴力/图形;对于大多数开发人员来说是免费的. 层次模式:输入中小 (预生成),输出中小 (后生成),定制中小 (域规则). 异步并行调用隐藏延迟; 位置持有人响应可以覆盖等待时间,而输入调节完成. 拉马卫队 3/4 (课时16):14个MLCommons危险,代码解释器滥用,8种语言 (v3),多种图像 (v4). 视角API (Google Jigsaw):在LLC作为调节者波之前的毒性评分;主要是具有严重毒性/侮辱/亵性的单维毒性;对内容调节研究的基准. 值:Azure内容调节器已过期2024年2月,退休2027年2月,被Azure AI内容安全取代.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, three-layer moderation harness)
**Prerequisites:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**Time:** ~60 minutes

## 学习目标

- 描述OpenAI调度API的类别类别类别和它与Llama Guard 3的MLCommons集合如何不同.
- 描述三个调度层模式 (输入,输出,定制) 并列出每个故障模式中的一个.
- 描述Perspective API作为LLM前的基准,以及为什么它仍然在研究中被使用.
- 声明Azure的减值时间表.

## 问题

课程12-16描述了攻击和防御工具.课程29涵盖了部署的调节系统,该系统在用户触摸产品的表面上操作防御.三层模式是2026年默认配置.

## 概念

### 开放AI调度API

`omni-moderation-latest`(2024). 基于GPT-4o. 在一个调用中分类文字 +图像.

类别 (响应方案中的13个布尔语):
- 骚扰,骚扰/威胁
- 仇恨,仇恨/威胁
- 自我伤害,自我伤害/意图,自我伤害/指示
- 性,性/未成年人
- 暴力,暴力/图形
- 非法,非法/暴力

多元支持适用于`violence`现在`self-harm`其他`sexual`但不是`sexual/minors`其他内容仅仅是短信.

为了在`code/main.py`我们将崩`/threatening`现在`/intent`现在`/instructions`其他`/graphic`产品代码应使用完整的13类方案.

对于多语言测试组,比以前的适度终点水平要好42%.

### 拉玛卫兵 3/4

包含在16课时的14个MLCommons危险类别 (与OpenAI的13个响应方案布鲁尔不同组织).支持8种语言 (v3).Llama Guard 4 (2025年4月) 是原本多模式的,12B.

开放AI和拉马卫队的类别重叠,但不同.开放AI将"非法"作为一个广泛的类别;拉马卫队分别将"暴力犯罪"和"非暴力犯罪"分为.部署根据其政策-类别适应性进行选择.

### 视角API (谷歌saw)

毒性评分系统是LLM作为调节者波 (前-2020) 之前的. 分类:毒性,严重毒性,伤害,性,威胁,身份攻击.单维初级分数 (毒性) 含子维变体.

广泛应用于内容调节研究基础,因为API是稳定的,记录的,并且具有多年的校准数据.对于现代LLM相邻的使用案例,Llama Guard或OpenAI调节通常更适合.

### 三层格式

1. **Input moderation.**排列用户提示在生成之前. 拒绝如果标记. 延迟:一个分类器调用.
2. **Output moderation.**输出前将模型输出分类. 如果标记,则取代以拒绝. 延迟:每次生成一次分类器调用.
3. **Custom moderation.**域名特定规则 (regex, allowlists,商业政策). 运行于输入或输出.

设计上,三个层次是序列的:输入中小必须在生成之前完成,输出中小必须在生成后完成. 参观在一个层内应用 同时运行多个分类器 (例如,OpenAI调度+拉马卫视+视角) 在同一文本上隐藏每个分类器的延迟. 作为可选的优化,在输入调节完成时,可以显示一个位持有者响应 ("一瞬间,检查...") 并推迟代币-1流. 旗行为可以配置:拒绝,清洁,升级到人类审查.

### 失败模式

- **Input only.**没有捕获输出幻觉 (课 12-14编码攻击绕过输入分类器).
- **Output only.**允许任何输入到达模型;增加成本;对攻击者进行内部推理.
- **Custom only.**它们在各类类别中不强,它们很脆弱.

层是默认的,带和悬架.

### 色减值

亚洲内容调节者:已过期2024年2月,退休2027年2月.被Azure AI内容安全取代,该项目基于LLM,并与Azure OpenAI集成.迁移是2024-2027年Azure部署的现场级项目.

### 在这个阶段的第18阶段

第十六课涵盖了红队背景下的调节工具. 第29课涵盖了部署的调节. 第30课以目前的双重用途能力证据结束.

```figure
an-moderation-layers
```

## 用它

`code/main.py`构建一个三层级的调节器:输入调节器 (关键字 + 类别分数),输出调节器 (输出上的相同分类器),定制调节器 (域规则).您可以通过输入并观察哪个层捕获什么.

## 运送它

这一课产生了`outputs/skill-moderation-stack.md`根据部署,它建议进行调度堆配置:输入时的分类器,输出时的分类器,定制规则以及边缘情况的判断器.

## 运动

1. 跑步`code/main.py`通过三个层进行良性,边界和有害输入.

2. 扩展带,以特定类别的PERSPECTIVE-API风格毒性评分.将其门行为与类别评分进行比较.

3. 阅读OpenAI调度API文件和Llama Guard 3类别列表.将每个OpenAI类别映射到最近的Llama Guard类别. 确定没有清洁地映射的三个类别.

4. 设计一个编码助手部署的调节堆 (例如GitHub Copilot). 确定最和最不相关的类别,并提出定制规则.

5. 亚洲化工智能内容安全计划迁移. 确定迁移的风险最高元素.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | GPT-4o-based 13-category (text) classifier with partial multimodal support |
| Perspective API | "Google Jigsaw toxicity" | Pre-LLM-era toxicity scoring baseline |
| Llama Guard | "MLCommons 14-category" | Meta's hazard classifier (v3: 8B text, 8 langs; v4: 12B multimodal) |
| Input moderation | "pre-generation filter" | Classifier on user prompt before model call |
| Output moderation | "post-generation filter" | Classifier on model output before delivery |
| Custom moderation | "domain rules" | Deployment-specific rules (regex, allowlist, policy) |
| Layered moderation | "all three layers" | Standard production deployment pattern |

## 进一步阅读

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations)全适度终点
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) 拉马卫队的回报
- [Google Jigsaw Perspective API](https://perspectiveapi.com/)毒性评分
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) Azure 替代
