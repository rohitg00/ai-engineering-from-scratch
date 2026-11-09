# 长视频在百万语文中理解

> 通过24FPS的1小时4K视频, 补丁和嵌入, 产生了6000万个代币. 转载的2小时播客节目是3万个代币. 一部完整的蓝光电影,即使被强烈的集成压缩, 谷歌的Gemini 1.5 (2024年3月) 通过1000万代币的背景开启了这个时代, 指数 (Liu等,2024年2月) 显示了环球注意力扩展路径. 长VILA和Video- XL进一步扩大了摄入量. 视频代理换了原始文本, 每个方法都对计算,回忆和工程复杂性进行不同的交易. 这一课将它们放在一边.

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router), TypeScript
**Prerequisites:** Phase 12 · 17 (video temporal tokens)
**Time:** ~180 minutes

## 学习目标

- 计算长视频视觉代币总数,以不同的FPS和聚合.
- 解释四个扩展途径:粗略的文本 (Gemini 1.5),环注重 (LWM),代币压缩 (LongVILA / Video-XL),代理检索 (VideoAgent).
- 根据精度和延迟,对原始文本视频VLM与代理检索视频VLM (VideoAgent) 进行比较.
- 设计一个30分钟的视频针头在一堆草测试,并在特定分钟测量回忆.

## 问题

单个Qwen2.5VL尺寸补丁的框架,原始分辨率为384个是729个代币.在3x3聚合时,每一个框架为81个代币.在1FPS的30分钟剪辑 =1800个框架 =145,800个代币.到2025年可以打开VLM,紧张.在2FPS时,291,600个代币只适合最大的文本.

两小时的电影在1FPS是583k代币.除了大多数2026开放模型之外,需要双子 2.5 Pro或更积极的集结.

出现了四条梯次路径.

## 概念

### 路径1:粗的背景 (双子1.5,克劳德·奥普斯)

放出硬件解决问题,将环境扩展到数百万代币,

双子座1.5 Pro 推出了1M代币;双子座1.5Ultra到10M;双子座2.5 Pro在2026年可靠地播放数小时的视频.该文件 (arXiv:2403.05530) 记录了针回忆率为99.7%至9.5M代币.

工程:一个自定义的注意力实现,具有内存层次结构 (本地+全球+稀少) 加上MoE专家路由,以实现长文本效率.未公布完整的详细信息.未开源.

### 路径2:环球注意 (LWM,LongVILA)

环注分发长时间的序列在"环"中的设备中,每个设备都持有一个部分.整个序列中,注意力发生在每个设备通过环节模式将其部分部分发送给下一个设备,计算部分注意力,并聚合.

根据LWM (Liu等同类,2024) 的理论,每个设备的内存量量与每个设备所拥有的部分相结合,因此添加设备大致地延伸了文本.总注意计算在文本中仍然是方形的;环子分开了设备之间工作的区块,并重叠了键/值与计算的传递.

长VILA (arXiv:2408.10188) 适应了该模式到VLM. 1400个视频每为192个代币 = 268k文本,通过环节注意力训练在8个方向平行.

### 路径3:标记压缩 (视频-XL,长VA)

低于原始背景:在 LLM 看到序列之前,强烈压缩.

视频-XL (arXiv:2409.14485) 使用视觉总结代币:N框架的每个剪辑产生一个单一的"总结"代币,在N上.在推断时,LLM每剪辑看到一个总结代币,大大缩小了文本.

长文本技术将LLM文本从200000扩展到2M. 通过"长文本转移"技术.

代币压缩在特定的时间表上取消回忆,以确保可扩展性.模型通常知道发生了什么,但有时会错过准确的框架.

### 路径4:代理检索 (视频代理)

不要把完整的视频输送到LLM. 相反,把视频视频视为数据库,并使用LLM查询它.

视频代理 (arXiv:2403.10517):

1. 法律法师读了这个问题.
2. 法律法师要求采集相关片段的工具 ("与猫一起给我看片段").
3. 工具返回相匹配的剪辑时间标签.
4. 士通过VLM读取这些视频.
5. 法律法师编写答案或提出后续询问.

这就是长视频应用的LLM-as-agent模式. 低成本推断 (仅编码相关片段),更难的工程 (检索质量成为瓶).

### 子子中的针基准

标准长文本测试:将视频中随机点插入一个独特的视觉或文本标记,然后询问需要回忆的查询.

视频长度和标记位置.

双子球 2.5 Pro 记录在90分钟视频中回忆率 >99%.开放72B型号 (Qwen2.5-VL-72B,InternVL3-78B) 在30分钟内获得85-90%的回忆率,并在60分钟内降低.

视频代理可以在2小时内匹配或击败原始文本模型,因为如果工具很好,检索会击中针.

### 选择哪个路径

对于15分钟的剪辑,在边界准确度下:开放72B+本地语文通常有效.

长达30分钟到1小时的内容:长VILA或视频-XL开放;双子 2.5 Pro闭幕.质量条点重要 边界关闭.

对于2小时以上的内容:视频代理或类似的检索模式.

### 2026年生产模式

在实践中,生产长视频管道是混合型:

1. 在整个视频中运行动态FPS样本+积极的聚合 (获得100k代币全球表示).
2. 转到72BVLM,以获得全球总结.
3. 如果用户提出详细问题,请运行代理检索,使用总结作为索引.

这将全球理解的原始背景和当地细节的检索结合在一起.

```figure
mm-video-token-budget
```

## 用它

`code/main.py`其他:

- 计算视频代码预算从1分钟到3小时的FPS+聚合.
- 模拟针在一堆:注入一个标记在随机时间标签,问一个问题,回忆.
- 包含一个代理检索路由器模拟器,它选择特定的剪辑,以供供应到下游VLM.

运行预算表,感觉到规模差距.

## 运送它

这一课产生了`outputs/skill-long-video-strategy-planner.md`视频持续时间和查询复杂性,它选择了原始文本,压缩和代理检索,并计算了延迟+质量预期.

## 运动

1. 总计的代币?适合哪个模型的背景?

2. 设计一个子中针的测试:你在何时注射标记器,查询格式是什么?

3. 根据视频的原始背景,Qwen2.5-VL-72B (80k背景) 与视频代理 (Claude 3.5+检索) 在一个小时的视频中.

4. 环注意的每设备内存尺度,序列长度按设备数量划分,而总注意计算保持方位.解释为什么和什么失败,如果你放下环旋转阶段.

5. 读一读双子座1.5节第5节关于子中的针.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Brute context | "Just more tokens" | Scale LLM context to millions of tokens; process everything in one pass |
| Ring attention | "LWM-style parallel" | Distributed attention pattern where each device holds a chunk and rotates |
| Token compression | "Summary tokens" | Reduce per-clip tokens via a learned compressor before the LLM |
| Needle-in-haystack | "NIH test" | Insert a unique marker at a random point, ask model to recall it at test time |
| Agentic retrieval | "LLM as query planner" | LLM asks a retrieval tool for relevant clips, reads them via a VLM, composes answer |
| VideoAgent | "Retrieval pattern for video" | Canonical agentic-retrieval design: question -> tool -> clip -> answer |

## 进一步阅读

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
