# 顶点项目 08 - 生产级 RAG 聊天机器人 (TypeScript)

聊天 UI 骨架，通过服务器发送事件流式传输带有引用的回复。与 `../main.py` 中的 Python 管道配合使用。对话状态存储在进程内的按 `sessionId` 键控的 Map 中，因此相同的会话 id 可以驱动多轮对话。

## 目录结构

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts        # 入口点，演示 + HTTP 服务器
    server.ts      # hono 应用，/, /chat/stream (SSE), /sessions, /health
    session.ts     # SessionStore (Map<sessionId, Session>)
    stream.ts      # SSE 帧编码器 + 解析器 + 模拟检索 + 分词器
    types.ts        # Session, Turn, Citation, KbEntry, SseEvent
  tests/
    session.test.ts
    stream.test.ts
    server.test.ts
```

## 运行

```bash
npm install
npm run typecheck
npm test
npm start          # 一次自检，退出返回 0
npm run serve      # 交互式 HTTP 服务器，监听 127.0.0.1:<port>
```

交互式服务器在 `PORT` 未设置时选择一个空闲端口，在 `/` 上挂载聊天 HTML 客户端，并通过 `GET /chat/stream?sessionId=...&q=...` 进行流式传输。演示客户端使用 `EventSource` 并监听 `session`、`citations`、`token` 和 `done` 事件。

## 测试

通过 tsx 使用 `node --test` 运行器。覆盖范围：

- SessionStore：创建、查找、追加、列出、对缺失 id 无操作。
- SSE 编码器 + 解析器往返；按管辖区域标签的检索增强；分词器回退 + "另请参阅"尾部。
- 服务器：`/`、`/health`、`/chat/stream` 快乐路径（session + citations + token + done）、缺失 q 时返回 400、多轮会话持久化、`/sessions` 列表。
