---
name: skill-constitutional-rules-engine
description: 声明式 YAML 规则引擎，用于输出约束，包含严重性、解释、修复操作和结构化差异
version: 1.0.0
phase: 19
lesson: 86
tags: [safety, rules, constitutional]
---

# 宪法规则引擎

宪法是一个 YAML 文件。每个规则包含 `name`、`severity`（low | medium | high）、`applies_when`（谓词）、`must`（谓词）、`explanation` 和可选的 `fix`。

## 谓词

原子：

- `contains_regex` / `not_contains_regex`
- `starts_with_regex` / `ends_with_regex`
- `max_words` / `min_words`

组合：

- `all_of: [...谓词]`
- `any_of: [...谓词]`
- `not_: 谓词`

## 修复操作

- `append_if_missing: <后缀>`
- `prepend_if_missing: <前缀>`
- `replace_regex: { pattern: <正则>, replacement: <文本> }`

## 引擎输出

`Engine.evaluate(text) -> EngineReport` 为每个规则返回一个 `RuleResult`，其中 `status` 为 `pass`、`violation`、`not_applicable`。`report.violations()` 过滤出违规，`report.max_severity()` 返回存在的最高严重级别。

## 产物

`outputs/rules_report.json` 包含每个案例的草稿、修订版和结构化差异。
