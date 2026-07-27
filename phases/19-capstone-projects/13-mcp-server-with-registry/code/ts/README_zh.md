# 课程 13 - 内部 MCP 服务器 (TypeScript)

顶点项目的 TypeScript 部分。Python 端（`code/main.py`）提供注册表和策略门控；本项目是 MCP 传输：手工实现的基于换行符分隔的 JSON-RPC 2.0 over stdio，带有三个模拟事故工具。不使用 `@modelcontextprotocol/sdk`；你可以看到线路上的每一个字节。

## 目录结构

```text
src/
  index.ts     入口：固定数据演示（默认）或 stdio 循环（--serve）
  transport.ts  stdin readline + 固定数据回放
  protocol.ts  initialize / tools/list / tools/call / shutdown
  tools.ts     三个事故工具 + 执行器
  types.ts     JSON-RPC + 工具形状
tests/
  protocol.test.ts  往返、列表形状、分发、解析错误
```

## 运行

```bash
npm install
npm run typecheck
npm test
npm start            # 自终止固定数据演示
npm run serve        # 真实 stdio 循环（等待 stdin）
```
