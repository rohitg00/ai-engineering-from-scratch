# 课程 12 - 视频理解管道 (TypeScript UI)

顶点项目的 TypeScript 部分。Python 端（`code/main.py`）拥有多向量索引和时间定位。本项目提供仪表板部分：一个覆盖四个管道阶段（分块、嵌入、索引、问答）的 Hono 应用。

## 目录结构

```text
src/
  index.ts     入口：演示（默认）或 HTTP 服务器（--serve）
  server.ts    Hono 路由（/, /jobs, /job/:id）+ HTML 索引
  jobs.ts      JobStore + 固定数据播种器
  stages.ts    阶段推进 + 总体状态
  types.ts     Stage, StageState, Job
tests/
  stages.test.ts  作业状态转换 + 存储
```

## 运行

```bash
npm install
npm run typecheck
npm test
npm start              # 自终止演示
npm run serve          # HTTP 服务器，监听 :8123
```
