# 符合SOC 2,HIPAA,GDPR,PCI-DSS,欧盟人工智能法,ISO 42001

> 跨框架覆盖率是2026年企业交易的桌面投资. **EU AI Act**根据"高风险"规定,在2026年8月2日实施了最高罚款,最高罚款为1500万欧元或全球高风险系统义务的3%. (第99条)**Colorado AI Act**根据SB25B-004 (SB25B-004) 推迟到2026年2月30日起,**SOC 2 Type II**:实际上 B2B AI 要求 (类型II,而不是类型I,用于金融技术). **GDPR**据证据,最大的针对AI的罚款为3050万欧元 (荷兰DPA,2024年9月);意大利的Garante在2024年12月针对OpenAI发出了1500万欧元 (后来在2026年3月上诉时被撤销).**HIPAA**没有BAA,无法向外部AI服务发送PHI. **PCI-DSS**:人工智能互动层覆盖需要配置+合同协议,而不是自动. **ISO 42001**参考资料:OpenAI维持SOC 2类型 2,ISO/IEC 27001:2022,ISO/IEC 27701:2019,GDPR/CCPA/HIPAA (BAA) /FERPA,PCI-DSS用于ChatGPT支付组件.跨框架映射减少了审计疲劳:通过ISO 27001 A.5.15-5.18,GDPR第32条,HIPAA §164.312(a.

**Type:** Learn
**Languages:** (Python, TypeScript optional: compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## 学习目标

- 列出有关LLM产品的7个2026年框架,并将每个框架与客户细分组相匹配.
- 引用欧盟人工智能法执行时间表 (2024年8月生效;2026年8月高风险执行) 和两层罚款上限 (15M/3%高风险义务,35M/7%禁止实践).
- 解释为什么处理后 PII 清理不够用于GDPR,并将实时推断层编辑作为可辩护的标准.
- 描述跨框架控制映射 (例如,访问控制地图到ISO 27001 A.5.15-5.18 + GDPR 32 条 + HIPAA §164.312 ((a)).

## 问题

企业客户采购要求SOC 2类 II,GDPR,HIPAA BAA,ISO 27001和"EU AI法合规声明".你的团队有SOC 2类 I.你已经从类 II大了六个月,并且还没有开始GDPR第30条记录.

跨框架覆盖不是一个LLM问题,这是一个企业SaaS问题,具有LLM特定的覆盖.2026年采购团队希望有一个矩阵,每个框架都有一行,每个控制都有一列,而不是PDF.

## 概念

### 七个框架

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### 欧盟人工智能法时间表

- 2024年8月1日:生效.
- 2025年2月2日:实施禁止AI实践.
- 2026年8月2日:高风险系统实施 (符合性评估,文档化,伐木).
- 2027年8月:根据协调立法,产品中的高风险系统.

风险级别:不可接受 (禁止),高风险 (合规性+记录),有限风险 (透明度),最小风险 (没有限制).大多数B2B LLM SaaS是有限风险的;就业,信用,教育,执法,移民,基本服务的高风险推进.

罚款 (第99条):高风险系统义务违规行为最高额达1500万欧元或全球年营业额3% (第99条 4);禁止人工智能行为最高额达3500万欧元或7% (第99条 3));具体取决于更高的情况.

###  GDPR 实时编辑是标准

后处理清理 (在 LLM 看到后编写 PII) 不是可辩护的姿态模型已经看到数据.实时推断层编辑是2026标准:

- 在 LLM 招聘之前的实体认可.
- 保持语义的连贯标记 (Mesh方法).
- 保存仅删除提示+同意的选择原始.

最近的执行:对Clearview AI (荷兰DPA,2024年9月) 的3050万欧元是迄今为止最大的记录的人工智能特定GDPR罚款;对OpenAI (意大利的Garante,2024年12月) 的1500万欧元是最大的LLM特定罚款,尽管该罚款在2026年3月上诉时被撤销,但裁决仍在进一步审查下.

###  HIPAA  BAA不是可选的

没有签署的商业合作伙伴协议,您不能向外部AI服务发送PHI.三个超级级级LLM平台 (Bedrock,Azure OpenAI,Vertex) 都提供BAA.OpenAI直接API提供BAA.人类直接API提供BAA.在发送PHI之前确认.

### 类型II的SOC2

类型I:设计和记录的控制装置.
类型II:控制在6-12个月内有效运行.

2026年B2B采购不符合II类型.I类型是启动器;II类型是门户.

常见的审计驱动因素:访问日志 (谁看到什么),变化管理 (如何部署),风险评估 (季度),事件响应 (测试).

### 跨框架映射

一项访问控制政策满足多个框架控制:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

根据标准的要求, 根据标准的要求,

### 新兴的ISO 42001

发布于2023年底.与ISO 27001相结合的采购需求不断增长.包括风险管理,数据质量,透明度,人力监督等AI治理框架.

### 开通AI的参考资料

开通AI维持了SOC 2类型 2,ISO/IEC 27001:2022,ISO/IEC 27701:2019,GDPR/CCPA/HIPAA (BAA) /FERPA,PCI-DSS用于ChatGPT支付组件.

### 你应该记住的数字

- 欧盟人工智能法罚款:最高1500万欧元/3% (高风险义务,第99条 (4));最高3500万欧元/7% (禁止行为,第99条 (3)).
- 欧盟人工智能法高风险执行:2026年8月2日.
- 根据"全球智能技术"的数据,
- 法律法规规规范:第1条第1条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第
- SOC 2型II窗口:6-12个月的操作控制.
- 科罗拉多人工智能法案生效日期:2026年6月30日 (由SB25B-004推迟到2026年2月).

```figure
i4-control-matrix
```

## 用它

`code/main.py`是一个Python中的合规绘图表, 给出一个控制,列出了它满足的框架.

## 运送它

这一课产生了`outputs/skill-compliance-matrix.md`根据客户细分和地理位置,规定所需的框架和控制.

## 运动

1. 您的第一个企业客户需要SOC2类型II,HIPAABAA,EUAI法声明.
2. 根据欧盟人工智能法的风险级别,将三个假设的LLM产品分类.
3. 你不小心地送PHI给一个没有BAA的提供商.
4. 争辩是否ISO 42001是"2026年必需"的中产市场人工智能供应商.
5. 绘制您的LLM审计日志领域 (阶段17 · 25) 至少在三个框架控制.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## 进一步阅读

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/)参考合规性资料.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)主要来源
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205)主要来源
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html)人工智能管理系统标准.
