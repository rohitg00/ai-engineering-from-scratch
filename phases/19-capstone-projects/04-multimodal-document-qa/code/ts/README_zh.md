# 顶点项目 04 - 多模态文档问答 (TypeScript)

查看器骨架，返回文档的页面图像 URL 和引用的边界框 JSON 列表。HTML 响应内联了一个小型画布覆盖脚本，在页面图像上绘制引用的区域。与 `../main.py` 中的 Python 管道配合使用。

## 目录结构

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts        # 入口点，演示 + HTTP 服务器
    server.ts       # hono 应用，/health, /, /document/:id
    fixtures.ts     # 10-K 表格 + Nature 图表固定数据
    render.ts       # HTML 索引 + 每个文档的覆盖渲染器
    types.ts        # DocumentFixture, EvidenceRegion, BoundingBox
  tests/
    fixtures.test.ts
    render.test.ts
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

交互式服务器在 `PORT` 未设置时选择一个空闲端口，并在标准输出上打印所选 URL。访问 `/` 查看索引，访问 `/document/10k-acme-2025` 查看演示覆盖层，或设置 `accept: application/json` 获取结构化响应。

## 测试

通过 tsx 使用 `node --test` 运行器。测试覆盖：固定数据查找（正向 + 负向）、五个危险字符的 HTML 转义、文档 HTML 负载结构以及 hono 路由（200、404、内容协商）。
