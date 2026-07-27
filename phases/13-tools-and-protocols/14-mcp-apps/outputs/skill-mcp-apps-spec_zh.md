---
name: mcp-apps-spec
description: 为需要交互式 UI 资源的工具生成完整的 MCP Apps 合约。
version: 1.0.0
phase: 13
lesson: 14
tags: [mcp, apps, ui-resources, csp, iframe-sandbox]
---

给定一个能从交互式 UI（时间线、表单、仪表盘、地图、图表）中受益的工具，生成 MCP Apps 合约。

产出：

1. **`ui://` URI。** UI 资源的规范名称（例如 `ui://notes/timeline`）。
2. **工具结果形态。** `content[]`，包含 `text` 前言和 `ui_resource` 块；填充 `_meta.ui`。
3. **CSP。** `default-src`、`script-src`、`connect-src`、`img-src`、`style-src` 的最小白名单。除非必要，避免使用 `'unsafe-inline'`。
4. **权限列表。** 如果需要：摄像头/麦克风/地理位置/网络；如果不需要则为空。
5. **postMessage 入口点。** UI 将进行的 `host.*` 调用及其返回值。
6. **安全检查清单。** 与宿主区分、无点击劫持、严格的 connect-src、如果渲染任何用户内容则进行 HTML 消毒。

硬拒绝：
- 使用 `default-src *` 的 CSP。安全风险完全敞开。
- 任何超出 UI 实际使用范围的 `permissions` 请求。最小权限原则。
- 任何加载外部脚本的 ui:// 资源。要么打包，要么拒绝。
- 任何渲染用户控制的 HTML 却不进行消毒的 UI。XSS 向量。

拒绝规则：
- 如果 UI 只是静态结果，拒绝搭建 App 脚手架；直接返回文本内容。
- 如果工具能从原生宿主部件（进度条、确认对话框）中受益，推荐使用后者。
- 如果宿主尚不支持 MCP Apps（截至 2026-04 的 VS Code 稳定版、Zed、Windsurf），标记回退到文本路径。

输出：一页合约，包含 `ui://` URI、工具结果 JSON、CSP、权限、postMessage 入口点和安全检查清单。最后以一句话说明能够渲染此 UI 的最低宿主版本。
