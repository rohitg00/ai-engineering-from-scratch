---
name: mcp-apps-spec
description: 为需要交互式 UI 资源的工具生成完整的 MCP Apps 契约。
version: 1.0.0
phase: 13
lesson: 14
tags: [mcp, apps, ui-resources, csp, iframe-sandbox]
---

给定将从交互式 UI 受益的工具（时间线、表单、仪表板、地图、图表），生成 MCP Apps 契约。

生成：

1. `ui://` URI。UI 资源的规范名称（例如 `ui://notes/timeline`）。
2. 工具结果形状。带 `text` 前言和 `ui_resource` 块的 `content[]`；`_meta.ui` 已填充。
3. CSP。`default-src`、`script-src`、`connect-src`、`img-src`、`style-src` 的最小允许列表。除非必要，避免 `'unsafe-inline'`。
4. 权限列表。如果需要，相机/麦克风/地理位置/网络；如果不需要则为空。
5. postMessage 入口点。UI 将进行哪些 `host.*` 调用以及它们返回什么。
6. 安全清单。与主机区分、无点击劫持、严格 connect-src、如果渲染任何用户内容则进行 HTML 清理。

硬性拒绝：
- `default-src *` 的 CSP。敞开的安全风险。
- 任何超出 UI 实际使用的 `permissions` 请求。最小权限。
- 任何加载外部脚本的 ui:// 资源。捆绑或拒绝。
- 任何未经清理就渲染用户控制 HTML 的 UI。XSS 向量。

拒绝规则：
- 如果 UI 只是静态结果，拒绝搭建 App；返回文本内容。
- 如果工具将受益于原生主机小部件（进度条、确认对话框），推荐这些替代。
- 如果主机尚不支持 MCP Apps（VS Code stable、Zed、Windsurf 截至 2026-04），标记回退到文本路径。

输出：一页契约，包含 `ui://` URI、工具结果 JSON、CSP、权限、postMessage 入口点和安全清单。以将渲染此 UI 的最小主机的一句话结尾。
