# 模型,系统和数据集卡

> 文件格式结构是人工智能透明度的三个形式. 模型卡 (Mitchell等人)  模型的营养标签:培训数据,量化分类分析,伦理考虑,警告;只有0.3%的脸模型卡记录伦理考虑 (Oreamuno等人. 美国 数据集的数据表 (Gebru et al. 动机,成分,收集过程,标签,分销,维护;电子数据表类比. 数据卡 (普什卡纳等人,谷歌 2022) 模块化层次细节 (望远镜,视镜,显微镜) 为各种读者的边界对象. 2024-2025年发展:通过LLM自动化生成 (CardGen,Liu等人. 据报道,该报告显示,该报告的数据显示,该数据的数据量增加了超过1%. 证书 (Laminator,Duddu等) 碳/水的可持续性报告补充 (Jouneaux等人) 欧盟/ISO监管卡出现 系统卡 (西德普鲁瓦拉2024;Meta系统级透明度;"信任蓝图" arXiv:2509.20394) 包含安全能力,快速注射保护,数据泄露检测,与人类价值观的结合.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## 学习目标

- 描述原始米切尔及其他2019年模型卡和Gebru及其他2018年数据表.
- 描述数据卡的望远镜/透视/微观层次.
- 描述系统卡及其端到端覆盖范围.
- 举报2024-2025年3个发展项目 (自动化发电,可验证的证书,可持续性报告).

## 问题

监管框架 (课 24) 和实验室安全政策 (课 18) 都需要文件.文件格式从模型特定 (模型卡) 发展到数据集特定 (数据表) 到系统特定 (系统卡).每个都涉及不同的透明度范围. 2024-2025年自动化和可验证证证书工作解决了长期以来的采用问题.

## 概念

### 模型卡 (Mitchell及其他 2019)

部分:
- 模型细节.
- 预期使用.
- 因素 (评估的相关人口或环境因素).
- 测量量.
- 评估数据.
- 训练数据.
- 量化分析 (按因素分类).
- 关于伦理问题.
- 洞穴和建议.

采用问题:Oreamuno等人在2023年对"脸"模型卡进行的审计发现,只有0.3%的文件提出了道德考虑.

### 数据集数据表 (Gebru et al. 2018)

电子数据表的类比.
- 动机 (为什么创建数据集).
- 组成 (含有什么).
- 收集过程 (如何组装).
- 标签 (如有所适用).
- 使用 (预期,禁止,风险).
- 发行.
- 维护.

发布于CACM 2021年.数据表是上游文档;模型卡取决于数据表是否准确.

### 数据卡 (普什卡纳等人,谷歌 2022)

模块化层次细节.
- **Telescopic.**对于非专家的高级总结.
- **Periscopic.**对于 ML 实践者来说,中级的概述.
- **Microscopic.**审计人员的详细功能级别文件.

边界对象框架:不同读者从同一文件中提取不同的信息.

### 系统卡

范围:包括模型+安全堆+部署背景的端到端人工智能系统.部分通常包括:
- 安全能力.
- 快速注射保护.
- 检测数据泄露.
- 符合人类的价值观.
- 事件反应.

根据"信任蓝图" (arXiv:2509.20394) 系统卡作为模型卡的部署层补充.

### 2024-2025年发展情况

- **CardGen (Liu et al. 2024).**通过LLM实现自动化模型卡生成;报告了标准化的米切尔2019领域的许多人创作的卡片的客观性较高.
- **Download correlation (Liang et al. 2024).**详细的模型卡与高达29%的下载率相相关的HF 采用压力现在以市场驱动,而不是仅基于合规性.
- **Laminator (Duddu et al. 2024).**通过硬件TEE/加密签名可验证的证书,使得模型卡能够携带索赔证明,而不是仅仅索赔.
- **Sustainability (Jouneaux et al. July 2025).**碳,水和电脑能源足迹的添加;新兴的ISO标准.
- **Regulatory cards.**欧盟人工智能法 (课 24) 格派I实践法典透明度章要求模型卡作为合规文物.

### 在这个阶段的第18阶段

课程24-25是监管和CVE层.课程26是文档层.课程27是培训数据治理,这是数据表的上游.课程28是研究生态系统,产生在卡上引用的评估.

```figure
an-card-scopes
```

## 用它

`code/main.py`玩具部署的模型卡,数据表和系统卡.每个都遵循了规范部分结构.你可以检查格式并比较三个范围.

## 运送它

这一课产生了`outputs/skill-card-audit.md`鉴于模型卡,数据表或系统卡,它审计了部分覆盖范围,数量分类以及是否存在可验证的证书.

## 运动

1. 跑步`code/main.py`检查生成的卡片. 确定弱点 (仅适用于位居者) 的部分,并说明哪些证据可以加强它们.

2. 扩展模型卡通过对两个人口群体进行量化分类分析 (课 20).

3. 阅读Oreamuno et al. 2023关于0.3%的采用率. 提出一个结构性改变模型卡规格,以增加道德考虑的采用.

4. 涂料器 (Duddu等2024) 使用TEE来进行可验证的证书.设计一个模型卡场,该场包含评估结果的加密证书,并描述验证者的作用.

5. 写一个系统卡 (系统卡,而不是模型卡) 给您的过去项目或假设部署. 确定第三方审计员的最高价值部分.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 standard documentation for ML models |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 standard documentation for datasets |
| Data Card | "the Pushkarna card" | Google 2022 modular layered data documentation |
| System Card | "the deployment card" | End-to-end AI system documentation including safety stack |
| Boundary object | "different readers, one doc" | Data Cards framing: same document serves diverse audiences |
| Verifiable attestation | "the Laminator attestation" | Cryptographic or TEE proof attached to a documentation claim |
| Sustainability field | "carbon / water footprint" | Emerging 2025 addition for environmental accounting |

## 进一步阅读

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993)法典模型卡
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010)数据表纸
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075)层次数据文档
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394)系统卡正式化
