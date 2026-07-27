# 顶点项目 19/02 — 代码库 RAG (TypeScript)

多文件 TypeScript 代码搜索 API，用于实现 `../docs/en.md` 中描述的混合检索管道。离线运行、确定性执行、六块样本语料库，基于 hono fetch handler 的 node:http。

## 目录结构

```text
src/
  index.ts       入口点；启动 node:http + 自检，然后退出返回 0
  server.ts      hono 路由（/healthz, /query），带有 zod 验证的 POST 体
  retrieval.ts   runQuery + RRF 合并，结合稠密检索和 BM25
  index_store.ts FNV-1a 哈希嵌入器、余弦、字段加权 BM25
  corpus.ts      六块样本（uploader / auth / client / catalog）
  types.ts       Chunk, RankedChunk, QueryResponse, anchor()
tests/
  index_store.test.ts
  retrieval.test.ts
  server.test.ts
```

## 运行

```bash
npm install
npm start                # 启动 API，探测三个查询，退出返回 0
npm start -- --serve     # 保持服务器运行；按 ctrl-c 停止
npm test                 # 通过 tsx 使用 node --test 运行器
npm run typecheck        # tsc --noEmit
```

非交互式 `npm start` 路径断言 `/healthz` 返回 200，并且每个探测查询至少返回一个引用。路由：

- `GET /healthz` — 返回 `{ok, corpus}`。
- `GET /query?q=...` — 运行一个混合查询。
- `POST /query` — JSON `{q, topK?}`，由 zod 验证（`topK` 上限为 50）。
