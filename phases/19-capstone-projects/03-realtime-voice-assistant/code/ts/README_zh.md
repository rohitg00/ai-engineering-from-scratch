# 顶点项目 19/03 — 实时语音助手 (TypeScript)

多文件 TypeScript Web 客户端框架，用于实现 `../docs/en.md` 中描述的流式语音管道。包含离线状态机模拟和由 `ws` 包支持的活动 WebSocket 服务器。

## 目录结构

```text
src/
  index.ts        入口点；运行两个离线会话，探测活动 ws，退出返回 0
  server.ts       hono /healthz + 通过 WebSocketServer 升级 ws
  orchestrator.ts IDLE -> LISTENING -> WAITING -> THINKING -> SPEAKING，支持插话
  vad.ts          轮次完成评分器 + 合成 20ms 帧生成器
  protocol.ts     zod 验证的帧信封（event / summary）
  types.ts        AudioChunk, Metrics, SessionOptions, SessionSummary
tests/
  vad.test.ts
  orchestrator.test.ts
  protocol.test.ts
```

## 运行

```bash
npm install
npm start                # 运行两个离线会话 + ws 自检，退出返回 0
npm start -- --serve     # 保持 ws 服务器运行；按 ctrl-c 停止
npm test                 # 通过 tsx 使用 node --test 运行器
npm run typecheck        # tsc --noEmit
```

非交互式 `npm start` 路径断言：正常会话达到 `first_audio_out`，插话会话至少注册一个插话事件，以及活动 WebSocket 探测在关闭前接收到一个 `summary` 帧。
