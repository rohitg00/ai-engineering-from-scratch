# LLM 可观测性仪表板 (TypeScript 骨架)

多文件 TypeScript 骨架，用于 LLM 可观测性仪表板顶点项目。一个 Hono 服务器接收 OpenTelemetry GenAI 跨度，将它们保存在 10k 环形缓冲区中，并渲染 p50/p95/p99 延迟和每模型成本。

## 目录结构

- `src/index.ts` — 入口点，生成合成跨度并可选的 HTTP 服务。
- `src/server.ts` — Hono 路由，用于 `/trace`、`/`、`/dashboard`、`/dashboard.json`、`/healthz`。
- `src/spans.ts` — `RingBuffer` 和 `ObservabilityStore`（默认 10k 跨度）。
- `src/rollup.ts` — `percentile` 和 `rollUpByModel`。
- `src/pricing.ts` — 2026 年每模型价格和成本辅助函数。
- `src/types.ts` — 共享类型。
- `tests/*.test.ts` — 通过 `tsx` 的 `node --test` 风格测试。

## 安装

```bash
npm install
```

## 运行

```bash
npm start         # 生成 1200 个合成跨度并打印汇总
npm run serve     # 还在 PORT（默认 8011）上提供 HTTP 摄取 + 仪表板
```

## 验证

```bash
npm run typecheck
npm test
```

## 规范参考

- 源课程：`phases/19-capstone-projects/11-llm-observability-dashboard/docs/en.md`
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
