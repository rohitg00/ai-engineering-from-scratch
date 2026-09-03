# 简体中文翻译计划

目标目录：`/Users/bytedance/ai-engineering-from-scratch`
执行方式：逐文件人工翻译；完成后由多个 Agent 按互斥阶段分片并行验收

> 说明：翻译技能默认把台账写入 `.codex/translation/plan.md`，但当前执行环境不允许创建该目录。逐文件等价台账保存在 `docs/translation-ledger.zh-CN.md`；本文件只记录范围与验收条件。

本项目以 `main` 分支上的英文课文为规范来源，将人工维护的简体中文课文放在独立的 `translations` 分支，并在 `main` 提交中文 README 与翻译质量门禁。本计划及逐文件台账只统计两类 Markdown：与当前 523 个课程目录一一对应的 523 个 `phases/*/*/docs/en.md`，以及单独计数的根 README。PR 同时交付的站点运行时本地化资产由站点构建与 i18n 契约单独维护，不计入这份 Markdown 台账；这不表示它们没有本地化。根据仓库规则，Claude 认证课程仅提供英文版本。

| source_path | target_path | category | status | notes |
| --- | --- | --- | --- | --- |
| `phases/*/*/docs/en.md`（523 个文件） | `translations:i18n/zh/phases/*/*/docs/zh.md`（523 个文件） | doc | done | 523 篇均已依据主工作区最新英文原文完成第二轮全文人工对照；发现的问题已修复，并由独立 Agent 对修后版本复读。 |
| `README.md` | `i18n/zh/README.md` | doc | done | 100/100 个普通正文区块、20/20 个阶段、523/523 个课程标题，以及 86 个结构化可见文本行均有简体中文；11 行语言名、命令或标识符明确保留，0 行未分类。 |
| 测验、搜索、术语表、交互图及站点外壳文案 | `site/i18n/zh/**` | runtime-i18n | outside-ledger | 已通过站点本地化 bundle 和运行时契约另行交付与验证，不计入本台账的 524 个 Markdown 文件。 |
| `certifications/claude/**` | 无 | doc | skipped | 仓库契约明确规定认证课程仅提供英文版本，并排除在机器翻译流程之外。 |
| 课程代码、课程输出物及源图片 | 无 | code-comment | skipped | 不属于本地化范围；翻译可执行制品或源媒体可能改变课程和测试语义。 |

## 最终汇总

- 已完成：524（根 README 1 + 课程文档 523）。
- 另行交付但不计入本台账：测验、搜索、术语表、交互图及站点外壳本地化资产。
- 明确不翻译：Claude 认证课程、课程代码、课程输出物及源图片。
- 第二轮全文终审已完成：523/523；纳入清单的 524 个 Markdown 文件当前 `done` 524、`in_progress` 0、`pending` 0、`failed` 0。
- 正式逐文件证据以 `docs/translation-ledger.zh-CN.md` 为准。

## 完成条件

- `zh` README 覆盖全部普通正文、阶段、课程标题和结构化可见文案，且不存在缺失、未分类或过期键。
- 生成的 `i18n/zh/README.md` 与源文件同步，且没有规范英文区块回退。
- 523 篇课文翻译全部存在，缓存中的源哈希与当前 `docs/en.md` 一致，受保护内容逐字节一致，且没有达到门槛的逐字英文正文残留。
- 翻译器结构保护测试、README 翻译检查和仓库审计全部通过。
