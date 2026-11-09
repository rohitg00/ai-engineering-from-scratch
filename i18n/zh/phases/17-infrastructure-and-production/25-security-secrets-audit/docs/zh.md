# 安全  秘密,API关键旋转,审计日志,护

> 通过集中式库存 (HashiCorp Vault, AWS 秘密管理器,Azure 密钥库) 消除秘密扩散. 永远不要存储凭据在配置文件, 使用IAM角色而不是静态键;用于CI/CD的OIDC. AI-gateway模式是2026年解决方案:应用程序 → gateway →模型提供商, 换机,没有 Slack"谁有新钥匙"的消息. 转换政策 ≤90天;每次提交时使用TruffleHog/GitGuardian/Gitleaks扫描. 零信任:MFA,SSO,RBAC/ABAC,短寿命的代币,设备姿势.  PII 清理使用实体识别来掩盖 PHI/PII 在转发之前;一致的代码化 (Mesh 方法) 将对稳定的位持有人的敏感值映射,因此 LLM 保持代码/关系语义. 网络退出:仅在专用VPC/VNet子网上提供LLM服务`api.openai.com`现在`api.anthropic.com`通过被破坏的CI/CD凭证攻击, 通过数千个客户部署, 泄露了环境.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## 学习目标

- 列出四种秘密管理反模式 (VCS中的配置文件,硬码的 env,电子表格,静态密钥) 并命名它们的替代.
- 解释AI-gateway-pulls-from-vault模式作为2026年生产标准.
- 实现一个具有一致的代码化 (相同值 →相同的位置持有者) 的 PII 清洗器,以便语义存活下来.
- 举个2026年维尔塞尔供应链事件,以及它所教导的关于CI/CD认证卫生情况.

## 问题

实习生承诺`.env`关键已经在 git 历史中 GitGuardian 扫描捕获它,你的旋转过程是"缓慢团队,更新40个配置文件,重新部署所有服务". 8 小时后,你的服务的半数已经开启,而另一半正在等待部署窗户.

单独,用户提示包括"我的SSN是123-45-6789."提示是向OpenAI.你有BAA,但你的内部政策是在转发之前掩盖个人信息.你没有.

另外,你的EKS集群的LLM组件可以到达任何互联网主机.有人通过DNS搜索将数据输入攻击者控制的域名.

法律法师服务的安全必须解决三个向量,然后证明. 库存支持的凭证. 个人信息清除. 网络输出过. 审计日志作为证据.

## 概念

### 集中式保险柜+IAM角色拉

**Vault**鱼公司的秘密管理器,Azure Key Vault,GCP秘密管理器.

**IAM role**:app/gateway通过其IAM身份进行认证,而不是静态密钥.Vault返回代币的终身秘密.

**The AI-gateway pattern**门口拉动`OPENAI_API_KEY`随着请求的时间,从库存中转换,下一个请求得到了新的钥匙.

### 转换政策 ≤90天

所有API密钥,库存根代币,CI/CD凭证,自动旋转,如果可能,手动旋转记录和追踪.

### 秘密扫描

- **TruffleHog**                     
- **GitGuardian**商业,高精度.
- **Gitleaks**OSS,运行在CI.

击每一个承诺,如果发现新的秘密.

### 零可靠的姿势

- 对于所有账户,必须进行外汇.
- 通过SAML/OIDC进行SSO.
- 基于角色的RBAC或基于属性的ABAC,用于细粒度的访问.
- 短暂的代币 (小时,不是几天).
- 设备姿势  只有具有磁盘加密的体内设备.

### 清洗PII/PHI

在提示离开你的内射之前:

1. 实体认可 (空间NER,Presidio,商业).
2. 面具匹配的实体: `"My SSN is 123-45-6789"`其他`"My SSN is [SSN_TOKEN_A3F]"`现在,我们要去.
3. 连贯的标记化 (Mesh方法):将相同的值映射到同一位持有者,因此LLM保持关系.
4. 选择性反向映射,用于LLM响应.

静态regex过器捕获基本模式,NER捕获更多.使用两者.

### 输入+输出防护

输入:阻止已知 jailbreaks,禁止主题;每用户的利率限制.

输出:泄露的秘密 (API密钥模式,拒绝文本中的电子邮件模式),政策违规的分类器.

### 网络出口白名单

在专门的子网中提供LLM服务:
- 清单:`api.openai.com`现在`api.anthropic.com`导向DB终点,保险终点.
- 其他一切:放下.
- 通过只允许列表的解决器 (避免 DNS 道输出).

### 审计日志

每次LLM电话的不可变记录:
- 时间标签.
- 用户/租户
- 快速哈希 (不是原始的隐私提示).
- 模型+版本.
- 标志数量.
- 价格.
- 响应哈希.
- 任何护旅行.

根据监管要求保留 (SOC2 1年,HIPAA 6年).

### 2026年,弗塞尔事件

供应链攻击:受损的CI/CD凭证在数千个客户部署中被泄露. 课程:CI/CD凭证是产品等等价. 存储在保险箱中. 范围狭窄. 激进旋转.

### 你应该记住的数字

- 转换政策: ≤90天
- 查看每一个提交:TruffleHog / GitGuardian / Gitleaks.
- 据报道, 据报道, 据报道, 据报道,
- 审计日志保存:SOC2 = 1年,HIPAA = 6年.

```figure
i4-vault-rotation
```

## 用它

`code/main.py`实现具有一致的标记化和仅附录的审计日志的玩具 PII清洗器.

## 运送它

这一课产生了`outputs/skill-llm-security-plan.md`鉴于监管范围和当前状态, 计划库迁移,清洗,出口,审计日志.

## 运动

1. 跑步`code/main.py`发送两个引用相同的SSN的提示,确认两者都得到了相同的位置.
2. 设计一个vLLM-on-EKS部署的网络退出政策,称为OpenAI + Anthropic + Weaviate.
3. 您在 git 历史中发现一个关键 (2岁) 什么是正确的答案?
4. 设计保留层次 (热30天,热12个月,冷6个月).
5. 辩论反向标记 (将实际值替换为LLM响应) 是否值得复杂性与保持位持有人可见性.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Vault | "secrets store" | Centralized credential management service |
| IAM role | "identity-based auth" | Role assumed by app; returns short-lived creds |
| OIDC for CI/CD | "cloud-issued tokens" | No static keys in CI — identity via OIDC |
| TruffleHog / GitGuardian / Gitleaks | "secret scanners" | Commit-time secret detection |
| RBAC / ABAC | "access control" | Role-based vs attribute-based |
| PII scrubbing | "data masking" | Remove or tokenize sensitive entities |
| Consistent tokenization | "stable placeholders" | Same value → same token each time |
| Mesh approach | "Mesh tokenization" | Semantic-preserving tokenization pattern |
| Egress whitelist | "outbound allowlist" | Only permitted domains reachable |
| Audit log | "immutable history" | Append-only record for compliance |

## 进一步阅读

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) 检测和匿名化个人信息.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
