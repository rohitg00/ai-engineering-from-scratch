---
name: browser-agent-trust-boundary
description: 在代理接触真实站点之前，为提议的浏览器代理部署划定信任边界 —— 信任区域、授权写入、所需防御。
version: 1.0.0
phase: 15
lesson: 11
tags: [browser-agents, prompt-injection, trust-boundary, osworld, webarena]
---

给定提议的浏览器代理工作流，生成信任边界划定文档，枚举每次读取、每次写入和首次运行所需的最低防御栈。

生成：

1. **读取表面。** 列出代理将获取的每个来源。将每个分类为 in-trust（用户组织运营的第一方站点）或 out-of-trust（任何第三方、任何用户生成内容、任何搜索结果）。所有 out-of-trust 读取必须被视为潜在的 prompt-injection 通道。
2. **写入表面。** 列出代理被授权采取的每个 consequential 动作（submit form、post content、call a backend tool、write to memory）。对于每个，说明爆炸半径和动作是否可逆。
3. **所需防御。** 最低栈：content sanitizer、read/write boundary（当 content_origin 为 out-of-trust 时写入需要新批准）、每任务工具允许列表、带范围凭证的会话隔离、持久内存上的 canary tokens、不可逆动作的 HITL。
4. **基准到分布拟合。** 如果代理报告 BrowseComp、OSWorld 或 WebArena-Verified 分数，命名基准与真实任务之间的分布重叠。高 BrowseComp 分数不能预测 booking-flow 可靠性。
5. **已知攻击清单。** 确认部署已加固以抵御 (a) visible-text injection、(b) URL-fragment / query injection、(c) memory-binding attacks（Tainted Memories 类）、(d) 认证会话上的 CSRF-shaped attacks、(e) one-click hijacks。对于每个，命名具体防御及其触发位置。

硬性拒绝：
- 访问生产凭证且没有会话隔离的浏览器代理。
- 任何从 out-of-trust 内容发起的写入不需要新 HITL 批准的部署。
- 任何仅依赖 content sanitizer 的部署（sanitizers 捕获简单攻击；复杂 payload 通过）。
- 没有 canary 条目的持久内存。
- 触及金融交易或客户数据且写入没有 HITL 的工作流。

拒绝规则：
- 如果用户无法命名注入驱动的错误写入的爆炸半径，拒绝并要求明确的句子。
- 如果用户在范围凭证不可用的堆栈上提议浏览器代理，拒绝并要求先进行单独身份。
- 如果用户引用基准分数（BrowseComp、OSWorld、WebArena）作为代理"可以"做生产任务的证据，拒绝并要求在真实分布上进行内部评估。

输出格式：

返回信任边界备忘录，包含：
- **读取表面表**（origin、in-trust / out-of-trust）
- **写入表面表**（action、blast radius、reversible y/n）
- **防御栈**（配置层的项目列表）
- **基准拟合注释**（如适用）
- **已知攻击清单**（五行，每行命名防御）
- **部署裁决**（production / staging / research-only）
