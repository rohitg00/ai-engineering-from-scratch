# 数据来源和培训 - 数据管理

> 欧盟人工智能法要求在2025年8月之前 (通过欧盟版权指令TDM例外) 进行机器可读的GPAI排斥标准. 加利福尼亚 AB 2013 (签署2024) 生成人工智能培训数据透明度要求开发人员发布包含12个授权领域的数据集总结. 2025 DPA 根据合法利益的调整:爱尔兰 DPC (2025年5月21日) 接受了Meta的首方公开欧盟/经济区成人内容的LLM培训,在EDPB意见后获得保障;科隆高等区域法院 (2025年5月23日) 驳回了禁令;汉堡 DPA 放弃了紧急情况;英国ICO (2025年9月23日) 对LinkedIn的人工智能培训保障措施 (透明度,简化选择退出,延长反对窗口) 发出了积极的监管反应,并继续监测而不是正式批准. 巴西ANPD (2024年7月2日) 暂停了Meta的处理,因为信息透明度不足;Meta提交了合规计划后,在2024年8月30日取消了预防措施. 基本不可逆性问题: Cookie-consent框架是为实时可逆追踪而设计的;一旦数据在模型重量中, 术性删除是不可能的 收费时间是合规窗口. 数据来源倡议 (dataprovenance.org,Longpre,Mahari,Lee等",危机中的同意",2024年7月):随着出版商增加robots.txt限制,大规模审计显示人工智能数据共同的迅速下降.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 12-field California AB 2013 scaffolding generator)
**Prerequisites:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**Time:** ~60 minutes

## 学习目标

- 描述加州AB 2013年对生成人工智能培训数据透明度的12个授权领域.
- 说明2025年DPA关于合法利益LLM培训的立场 (爱尔兰DPC,英国ICO,汉堡,科隆).
- 描述不可逆性问题:为什么GDPR删除权对训练有素的神经网络没有实际等效.
- 报告数据来源倡议的"危机中同意"发现.

## 问题

培训数据治理是每种模型卡 (课程 26) 和监管义务 (课程 24) 的上游.在2024-2025年,监管环境将基于三个原则结合起来:选择退出基础设施,每数据集披露,以及对公开可用的数据的合法利益适应.在收集时不遵守的提供商无法补救下游.

## 概念

### 美国加州AB 2013年

签署2024. 关于在2026年1月1日或之后发布的系统,文件必须在2026年1月1日或之前发布.
1. 数据集的来源或所有者
2. 描述数据集如何推进人工智能系统的目的.
3. 数据集中的数据点数 (一般范围可接受;动态数据集的估计).
4. 数据点类型的描述 (标记数据集的标签类型;未标记的一般特征).
5. 数据集是否包括任何受版权,商标或专利保护的数据,或者完全属于公共领域.
6. 数据集是否购买或授权.
7. 数据集是否包含个人信息 (根据加州公民法典1798.140 ((v)).
8. 数据集是否包含总消费者信息 (根据加州公民法典1798.140号 (b)).
9. 开发者进行了清洁,加工或其他修改,以目的.
10. 收集数据的时间,如果收集正在进行,请通知.
11. 数据集在开发过程中首次使用的日期.
12. 系统是否使用或持续使用合成数据生成.

根据"个人信息"第7条,该条款引发了"隐私权利法" (CPRA) 义务.该条款豁免了安全/诚信,飞机运营和联邦国家安全系统 (第3111条) 条.

### 欧盟人工智能法 (24课) 和TDM选择退出

欧盟版权指令的文本和数据挖掘例外允许在公共可用的内容上进行培训,除非权利持有人选择退出.欧盟人工智能法GPAI实践规范版权章要求GPAI提供商尊重机器可读的退出信号 (robots.txt,C2PA"无人工智能培训"要求等).

### 2025年 DPA 合并性利益

爱尔兰DPC (2025年5月21日):Meta计划在EDPB意见后接受了安全措施的欧盟/EEA成人用户内容的第一方公共培训. 科隆高等区域法院 (2025年5月23日) 驳回了Meta的禁令:拒绝选择是足够的. 汉堡DPA撤销了欧盟范围内的紧迫程序. 英国ICO (英国ICO) 于2025年9月23日发布了积极的监管反应, 没有正式的批准,

融合原则:有合法利益可以为选择退出公开的第一方内容提供培训的理由.

### 巴西ANPD (2024年7月)

由于信息透明度不足,Meta暂停了对巴西用户数据的处理. 与欧盟DPA不同.

### 无法逆转的问题

根据"Cookie-consent"的说法,Cookie-consent是用于实时可逆追踪的.训练数据是不同的:一旦数据进入模型重量,手术删除是不可能的.从零开始重新训练是唯一的完整补救,而且是极其昂贵的.

部分补救措施:
- **Unlearning.**通过MIA (课2) 测量,可进行近似移除.
- **Influence function-based localization.**确定数据影响最严重的重量;选择性更新.
- **Fine-tune-suppression.**训练模型拒绝从数据中获得的输出.

没有一个完全解决问题. 合规窗口是收费时间.

### 数据来源倡议

提供数据.org. 长春,马哈里,李等. "危机中的同意" (2024年7月):大规模审计人工智能培训数据共享. 发现:出版商正在加快Robots.txt限制速度. 开放式训练可用的共同点正在迅速缩小. 据报道,在2023年至2024年, 未来的培训数据可用性取决于新的收购模式 (许可,合成生成,激励参与).

### 在这个阶段的第18阶段

第26课是模型级文档. 第27课是数据集级治理. 它们共同定义了透明度层. 第28课绘制了研究生态系统,该系统处理这些问题.

```figure
an-provenance-oneway
```

## 用它

`code/main.py`您可以填写这些字段并观察哪些字段会引发隐私或版权后续义务.

## 运送它

这一课产生了`outputs/skill-provenance-check.md`鉴于培训中使用的数据集,它检查了AB 201312领域的覆盖范围,选择退出基础设施的合规性,DPA的调整和不可逆转性风险评估.

## 运动

1. 跑步`code/main.py`制作玩具数据集的12个领域总结,并确定哪些领域未具备具体规范.

2. 欧盟版权指令 TDM 选择退出是机器可读的. 建议退出信号的标准格式,并将其与 robots.txt 和 C2PA "无人工智能培训"进行比较.

3. 阅读数据来源倡议的"危机中的同意" (2024年7月).描述三个最快限制内容类别,并论证一个经济后果.

4. 2025年DPA调整接受了对公共内容培训的合法利益.构建一个不够合法利益的场景,并确定提供商需要的法律基础.

5. 绘制一个培训数据来源明示,该明示明示明示每一个数据集的AB 2013领域和C2PA签署的来源链.确定一个技术和一个法律障碍.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AB 2013 | "the California law" | Generative AI training-data transparency; 12 mandated fields |
| TDM exception | "text-and-data-mining" | EU Copyright Directive training-data exception with opt-out |
| Legitimate interest | "the EU basis" | GDPR Article 6 basis that may justify training on public content |
| Opt-out signal | "machine-readable no-train" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | "cannot un-train" | Data in model weights is not surgically removable |
| Unlearning | "approximate removal" | Post-training interventions to reduce model dependence on specific data |
| Consent in Crisis | "the DPI audit" | July 2024 finding of accelerating robots.txt restrictions |

## 进一步阅读

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) 创新人工智能培训数据透明度法
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) 版权章节
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) 指数指数审计
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark)监管环境
