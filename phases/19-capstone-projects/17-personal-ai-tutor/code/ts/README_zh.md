# 课程 17 - 个人 AI 导师 (TypeScript Web 应用)

顶点项目的 TypeScript 部分。Python 端提供学习者和导师策略；本项目暴露 Web 应用表面：一个课程 DAG 遍历器、一个 BKT 风格的学习者模型和一个 FSRS-lite 间隔重复调度器，位于两个 HTTP 路由后面。

## 目录结构

```text
src/
  index.ts      入口：演示（默认）或 HTTP 服务器（--serve）
  server.ts     Hono 路由（GET /lesson/next, POST /lesson/:id/submit）
  curriculum.ts DAG 固定数据 + Kahn 拓扑排序 + 下一课选择器
  mastery.ts    MasteryStore（每课的 BKT 风格更新）
  repetition.ts scheduleNextDue（间隔加倍/减半，带钳制）
  types.ts      Lesson, Mastery, Pick
tests/
  curriculum.test.ts  拓扑顺序、BKT 更新、FSRS 调度
```

## 运行

```bash
npm install
npm run typecheck
npm test
npm start            # 自终止课程遍历
npm run serve        # HTTP 服务器，监听 :8090
```
