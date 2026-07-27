# 顶点项目 06 - DevOps 故障排除智能体 (TypeScript)

Slack 集成骨架，用于 `../main.py` 中的值班智能体。提供一个斜杠命令端点和一个交互性（按钮点击）端点，两者都受 Slack 的 HMAC-SHA256 请求签名和 5 分钟重放窗口保护。破坏性修复仅在 Slack 卡片获得批准后执行。

## 目录结构

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts          # 入口点，演示 + HTTP 服务器
    server.ts         # hono 应用，/slack/command + /slack/interactivity
    slack_verify.ts   # HMAC v0 验证 + 时序安全比较
    agent.ts          # 模拟假设排序器
    blocks.ts         # Block Kit 响应构建器
    types.ts          # Hypothesis, AgentReport, SlackResponse, OutboundCall
  tests/
    slack_verify.test.ts
    agent.test.ts
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

设置 `SLACK_SIGNING_SECRET=...` 以覆盖占位密钥。交互式服务器打印所选端口（当 `PORT` 未设置时随机分配）。

## 测试

通过 tsx 使用 `node --test` 运行器。覆盖范围：

- Slack 签名验证：有效签名通过、篡改签名被拒绝、过期时间戳（>5 分钟偏差）被拒绝、非数字时间戳被拒绝、长度不匹配路径在常量时间比较前被执行。
- 模拟智能体：OOM 关键字路径、CrashLoop 关键字路径、回退路径。
- 服务器：`/health`、`/slack/command` 快乐/篡改/过期路径、`/slack/interactivity` 批准操作。
