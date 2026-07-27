# 顶点项目 19/01 — 终端原生编码智能体 (TypeScript)

多文件 TypeScript 框架，用于实现 `../docs/en.md` 中描述的"计划/行动/观察"循环。离线运行、确定性执行、零网络调用。

## 目录结构

```text
src/
  index.ts     入口点；运行脚本化演示和评估，然后退出返回 0
  repl.ts      交互式命令解析器（run / eval / help / quit）
  harness.ts   计划-行动-观察循环，通过钩子总线连接
  hooks.ts     八事件钩子总线，带有破坏性命令守卫
  model.ts     脚本化离线 LLM，驱动演示
  tools.ts     read_file + run_shell，带有 zod 验证的参数
  plan.ts      PlanState（待办事项重写）+ Budget（轮次/令牌/美元上限）
  eval.ts      小型通过/失败计数器，跨三个离线任务
  types.ts     共享类型定义
tests/
  harness.test.ts
  tools.test.ts
```

## 运行

```bash
npm install
npm start                # 运行脚本化演示 + 离线评估，退出返回 0
npm start -- --repl      # 打开交互式框架 REPL
npm test                 # 通过 tsx 使用 node --test 运行器
npm run typecheck        # tsc --noEmit
```

非交互式 `npm start` 路径断言评估报告 `passed=3 failed=0`，并且脚本化运行收敛到全部完成的计划。任何偏差都会导致运行失败。
