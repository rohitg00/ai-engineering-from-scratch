# 课程 16 - GitHub Issue-to-PR 智能体 (TypeScript webhook 接收器)

顶点项目的 TypeScript 部分。Python 端提供智能体循环和调度器；YAML 端提供 Actions 工作流。本项目是 GitHub App webhook 接收器：HMAC 验证原始体，按事件类型路由，为 `issues.opened` 分发一个存根智能体。

## 目录结构

```text
src/
  index.ts    入口：演示（默认）或 HTTP 服务器（--serve）
  server.ts   Hono webhook 接收器（POST /webhook）
  verify.ts   X-Hub-Signature-256 HMAC，时序安全
  router.ts   事件类型路由（ping, issues, pull_request）
  agent.ts    存根智能体 + 审计日志
  types.ts    负载 + 审计形状
tests/
  verify.test.ts  签名通过、篡改、路由路径
```

## 运行

```bash
npm install
npm run typecheck
npm test
npm start            # 自终止演示（进程内回放）
npm run serve        # HTTP 服务器，监听 :8081
```

HMAC 密钥从 `GH_WEBHOOK_SECRET` 读取（演示默认为 `demo-shared-secret`）。
