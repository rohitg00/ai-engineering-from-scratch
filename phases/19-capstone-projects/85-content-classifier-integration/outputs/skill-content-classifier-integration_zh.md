---
name: skill-content-classifier-integration
description: 三个输出端分类器（毒性、PII、指令泄漏）位于一个严重性路由器后面，支持拦截、编辑、警告、日志操作
version: 1.0.0
phase: 19
lesson: 85
tags: [safety, classifier, output-filter]
---

# 内容分类器集成

三个分类器，一个路由器，四个操作。

## 判决结构

```text
ClassifierVerdict
  name: str
  severity: none | low | medium | high
  score: float in [0, 1]
  findings: list[str]
```

## 操作表

| 严重性 | 操作 | 效果 |
|---|---|---|
| high | 拦截 | 输出替换为策略拒绝消息 |
| medium | 编辑 | 按顺序应用每个分类器的编辑器 |
| low | 警告 | 输出附带软通知一起发送 |
| none | 日志 | 输出不变发送，判决记录到日志 |

## 每个分类器的行为

- 毒性 - 带有空白边界和小型左窗口否定检查的骚扰词汇；编辑为 `[redacted-language]`
- PII - 电子邮件、电话、SSN、Luhn 验证的卡号、IPv4；SSN 和卡号严重性升级；每种形状编辑为一个标签
- 指令泄漏 - 三元组余弦与已知系统提示的对比；严重性随重叠程度增加；编辑掉第一行系统提示

## 产物

`outputs/classifier_report.json` 包含每个案例的操作动作、严重性、编辑后的输出和完整判决列表。
