# 代码迁移智能体仪表板 (TypeScript 骨架)

多文件 TypeScript 骨架，用于代码迁移智能体顶点项目的仪表板层。智能体（Python）在沙箱中运行；此服务器为操作员渲染进度。

## 目录结构

- `src/index.ts` — 入口点，模拟滴答声并可选提供 HTTP 服务。
- `src/server.ts` — Hono 路由，用于 `/`、`/dashboard`、`/migrations`、`/migrations/:id`。
- `src/migrations.ts` — 每个文件的状态机和种子数据。
- `src/cost.ts` — 轮次数和美元预算强制执行。
- `src/types.ts` — 共享类型。
- `tests/*.test.ts` — 通过 `tsx` 的 `node --test` 风格测试。

## 安装

```bash
npm install
```

## 运行

```bash
npm start         # 离线：模拟 40 次滴答并打印汇总
npm run serve     # 在 PORT（默认 8009）上提供 HTML 仪表板
```

## 验证

```bash
npm run typecheck
npm test
```

## 规范参考

- 源课程：`phases/19-capstone-projects/09-code-migration-agent/docs/en.md`
- 配方：[OpenRewrite](https://docs.openrewrite.org)、libcst。
