# 多型代理和计算机使用 (卡普斯通)

> 2026 边界产品是一个多模式代理,它可以阅读截图,点击按,导航网络UI,填写表格,并完成端到端工作流程. 查看Click和CogAgent (2024) 证明了GUI基地化的原始. 轮UI增加了移动. 图表代理引入了图表的视觉工具. 视觉WebArena和AgentVista (2026) 是边界追逐的基准,甚至在AgentVista的艰难任务中,双子座3Pro和克劳德奥普斯4.7分数约为30% 这块结尾石将12期的每一个线程都聚集在一起:感知 (高分辨率VLM),推理 (使用工具的LLM),定位 (协调输出),长视野记忆和评估.

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## 学习目标

- 设计一个多模式代理循环:感知 →理性 →行为 →观察 →重复.
- 构建一个GUI地面输出方案 (点击坐标,输入文本,滚动,拖动) VLM可以发射为JSON.
- 仅使用屏幕截图的代理与可访问性树代理与混合代理进行比较.
- 在一个小的VisualWebArena片段上设置多模式代理基准评估.

## 问题

预订地点工作流程: "为4月15日找到我一架飞机前往东京,

一个多元代理人需要:

1. 扫描器的屏幕照.
2. 解析截图+URL+目标,将其变成一个计划.
3. 执行一个结构性操作:点击 (x,y),输入"东京" (E元素),向下滚动,选择 (无线电按).
4. 应用该操作到浏览器中.
5. 查看新状态 (下一个截图).
6. 重复直到任务完成.

每一步都是多模式VLM调用.VLM输出必须是可解析的JSON. 错误在各步骤中复合,因此恢复是重要的.

## 概念

### 基因图像接地 原始

基于GUI的接地是:给出屏幕截图和自然语言指令,输出 (x,y) 坐标点击 (或其他操作).

查看Click (arXiv:2401.10935) 是规模上的第一个开放结果:在合成+真实GUI数据上调整VLM,输出坐标作为平文代码.

康 (arXiv:2312.08914) 增加了密集 UI 的1120x1120高分辨率编码.

接器 (arXiv:2404.05719) 专注于移动接器,与iOS可访问性数据集成.

输出格式通常是JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

其他`element_desc`帮助恢复:如果坐标在截图之间漂移,语义提示可以让系统重新地.

### 行动方案

一个典型的行动方案有6-10种行动类型:

- `click`其他:
- `type`字母是:
- `scroll`: (方向,数量)
- `drag`其他类型:
- `select`选择指数
- `hover`其他:
- `navigate`其他地方
- `wait`时间:
- `done`答案: (成功,解释)

浏览器包装执行并返回新的状态.

### 只有屏幕截图,而不是可访问性树

输入模式:

- 只有屏幕截图:完整图像,没有结构信息.
- 可访问性树:结构化DOM/iOS可访问性信息. 对于地面接地更可靠; 在树可用的地方工作.
- 混合物:既有树木作为原子行动的可靠基,又有语义背景的截图.

制作代理在可能的情况下使用混合动力.浏览器自动化 (Selenium +可访问性) 总是有树;桌面应用程序有时会有.

### 长视野记忆

通过20步的工作流程生成20个截图.VLM的文本快速填充.三个压缩策略:

- 总结链:每5步后总结发生的事情,
- 跳转框:保持第一,最后,每第三截图.
- 工具记录日志:执行操作,记录所做的内容;不要再看旧的截图.

克劳德的计算机使用API使用日志模式. 简单,更可靠.

### 视觉工具的使用

图表代理 (arXiv:2510.04514) 引入图表理解的视觉工具:作物,放大,OCR,外界检测. 代理可以输出"作物到区域 (100, 200, 300, 400) 然后作为工具调用OCR". 工具返回文本; VLM继续推理.

这种模式将:标记提示,区域注释和外部检测工具都适合相同的"输出工具调用,接收结构性响应"方案.

### 2026年基准指数

- 屏幕Spot-Pro.GUI 基于1k的网页截图.开放SOTA Qwen2.5-VL-72B ~85%.边界 ~90%.
- 视觉WebArena. 端到端的网络任务 (商店,论坛,分类广告). 开放SOTA ~20%. 双子座 3 Pro ~27%.
- 根据"2026年"的标准,最难的是"AgentVista" (arXiv:2602.23166). 实际的工作流程在12个领域中.边界模型的分数为27-40%;开放模型为10-20%.
- 旧的基准,以边界为.

### 为什么还难

代理性能瓶:

1. 视觉地定在微小尺度上. "点击小X"在移动分辨率上经常失败.
2. 经过10次行动,代理就离开了目标.
3. 错误恢复:当一个键失败 (错误按),检测+恢复很少是训练有素的数据.
4. 跨页文本. 跳转页面或长表格之间会失去状态.

研究方向:内存架构,明确的重新规划,多模式验证 (屏幕截图对行动成功匹配).

### 石建造了它

完成任务:构建一个计算机使用代理,

1. 读取预订网站模拟页面的HTML+截图.
2. 计划一个多步骤的序列:搜索 →选择 →填写表格 →提交.
3. 发出与行动方案相匹配的JSON操作.
4. 根据10个任务的固定分数进行评估.

课程提供了脚架代码,

```figure
mm-agent-loop
```

## 用它

`code/main.py`是石架:

- 行动方案 JSON定义 (10 个行动:上述九项加上 `screenshot_region`通过缩工具,
- 假设浏览器状态是指标.
- 代理循环骨架:接收状态,发射行动,应用,循环.
- 测量端到端成功率的10任务迷你基准 (合成页面).
- 错误恢复是当一个行动失败时的.

## 运送它

这一课产生了`outputs/skill-multimodal-agent-designer.md`考虑到计算机使用产品 (域,行动集,评估目标),设计完整的代理循环,内存策略,地面模式和预期基准分数.

## 运动

1. 代码的方案添加一个`screenshot_region`它们可以通过工具 (收获+放大) 实现9个核心操作.

2. 阅读 AgentVista (arXiv:2602.23166). 描述最难的任务类别,以及为什么边界模型仍然失败.

3. 长视野内存压缩:设计一个包含 ≤4 张截图的总结链,任何数字都会被记录.

4. 建立一个错误恢复:当操作失败时 (按不找到),代理接下来会做什么?

5. 对于10个网络任务,仅使用屏幕截图的Claude 4.7与混合屏幕截图+可访问性树Qwen2.5VL进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GUI grounding | "Click coordinates" | Model outputs (x,y) for the target of an instruction on a screenshot |
| Action schema | "Tool definitions" | JSON description of valid actions (click, type, scroll, drag) |
| Accessibility tree | "Structured DOM" | Machine-readable UI hierarchy from browser/iOS APIs |
| Hybrid agent | "Screenshot + tree" | Uses both image and structured info; more reliable than either alone |
| Visual tool use | "Zoom/crop/detect" | Agent calls external vision tools (OCR, detection) mid-plan |
| Summary-chain | "Memory compression" | Periodic text summaries replace long screenshot history |
| VisualWebArena | "E2E web bench" | 2024 benchmark for end-to-end web tasks |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows; even Gemini 3 Pro scores ~30% |

## 进一步阅读

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
