# 卡普斯通16  GitHub 发行至PR自主代理

> 标签一个问题,获得一个PR  2026自主编码代理产品形状:运行一个代理在云沙箱,验证测试通过,并发布一个准备备好审查的PR, 它们都在运输中,包括 AWS 远程SWE 代理,Cursor 背景代理,OpenAI Codex 云和Google Jules. 硬部分是自动复制 repo 的构建环境, 防止凭证泄露, 执行每次 repo 预算, 这块顶石构建了自主托管版本,并将其比较在成本和通过率上与托管的替代品.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子
**Time:** 30 hours

## 问题

无同步云编码代理是与互动编码代理 (capstone 01) 独立的产品类别.UX是一个GitHub标签.你标签一个问题`@agent fix this`工作者在云沙箱中旋转,克隆备忘录,运行测试,编辑文件,验证,并打开一个与代理的逻辑在身体中的 PR.没有交互循环,没有终端. AWS 远程SWE 代理,Cursor 背景代理,OpenAI Codex 云,谷歌 Jules 和工厂 Droid 都会汇聚在这里.

工程挑战是具体的:环境复制 (代理必须从零开始建立 repo,而无需缓存开发图像),碎片测试 (必须重新运行或孤立),凭证范围 (一个拥有最小的微粒许可的 GitHub 应用程序),每天每次 repo 的预算执行,以及无力推政策.

## 概念

引发器是GitHub网络连接器 (问题标签或公关评论).一个发送器将工作列到ECSFargate或Lambda. 工作者将 repo 拉入一个Daytona或E2B沙箱中,使用从 repo (语言,框架) 推出的通用Dockerfile. 代理运行一个小型Swe-agent或SWE-agent v2循环对Claude Opus 4.7或GPT-5.4代码进行反复. 它反复:阅读代码,提出修复,应用补丁,运行测试.

验证是关门步骤. 在公关开放之前,完整的公关必须通过沙箱. 覆盖率的三角形计算;如果超过门,公关开放,但标签.`needs-review`代理人将理由列为 PR 描述加上一个`@agent`审查员可以寻求后续.

应用程序提供了一个短暂的安装代币.`workflows: read`应用程序的权限 (而不是应用程序权限) 强制"没有直接写到`main`没有强迫推, 应用程序从来没有被添加到绕过列表.`.github/workflows`作为一个真正的GitHub应用程序原始,所以代理的文件编辑允许列表必须在工作者身上执行.每天每次备用程序的预算上限在发送器上执行 (例如,每天每次备用程序最多5次,每次备用程序为20美元).

## 建筑

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## 堆

- 触发器:GitHub应用程序,有微粒代币;通过Lambda或Fly.io接收器
- 工作者:ECS Fargate任务 (或 GitHub 行动自主托管的运行器)
- 沙箱:每项任务的Daytona开发集装箱或E2B沙箱
- 代理循环:迷你Swe-agent基线或SWE-agent v2 通过Claude Opus 4.7 / GPT-5.4-Codex
- 获取:树木监护者复核地图 + 撕裂
- 验证:全CI在沙箱+覆盖地达尔塔门
- 可观察性:与每个人关系的痕迹档案由公关机构链接
- 预算:每期每日美元上限;每期每日每期每日公交

```figure
cf-issue-to-pr
```

## 建立它

1. **GitHub App.**细节的安装代币:问题阅读+写,拉_请求写,内容阅读+写,工作流读.`main`"和"没有强迫推",应用程序不在绕行列表. 工人强制"没有写下`.github/workflows`由于GitHub应用程序权限没有路径范围.

2. **Webhook receiver.**通过 Lambda 函数接受问题标签 / PR 评论网页.`@agent fix this`查询到SQS.

3. **Dispatcher.**执行每日预算,用 repo URL,发行机器和新鲜的Daytona沙箱,

4. **Environment inference.**检测语言 (Python, Node, Go, Rust) 和包管理器 (uv, pnpm, go mod, cargo).如果没有,则在飞行中生成Docker文件.

5. **Agent loop.**工具: ripgrep,树座 repo-map, read_file, edit_file, run_tests, git. 硬限制:20美元的成本,30分钟的墙钟,30个代理转.

6. **Verification.**循环结束后,在沙盒中运行整个测试套件.通过 jacoco / coverage.py计算覆盖率德尔塔.如果CI红色:停止,不要打开PR.如果覆盖率下降超过2%:打开PR与 `needs-review`标签

7. **PR posting.**通过 GitHub API 打开 PR 内容,标题,理由,差异概要,追踪URL,成本,转折.

8. **Credential hygiene.**工作者使用了短暂的GitHub应用程序安装代币.

9. **Eval.**30种种植的内部问题具有不同难度.测量通过率,公关质量 (不同尺寸,风格,覆盖率),成本,延迟.对相同问题进行比较.

## 用它

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## 运送它

`outputs/skill-issue-to-pr.md`作为一个 GitHub App + 无同步云工作者,将标记的问题转化为准备的 PR,具有限额成本和范围的凭证.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## 运动

1. 添加"固定片测试"模式:标签 `@agent stabilize-flake TestX`测试50次在沙盒中进行,并提出一个最小的变化,

2. 根据三项共同问题,比较成本与代背景代理. 报告哪些工具在哪里获胜.

3. 实施预算仪表板:每次报复每天成本,每用户成本.

4. 建立一个"干跑"模式, 打开一个 PR 草案, 没有运行 CI,

5. 加入保留政策:未合并的7天以上的公关分公司将自动删除.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## 进一步阅读

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents)可нони化异步云代理参考
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) CLI 参考
- [Cursor Background Agents](https://docs.cursor.com/background-agent)商业替代品
- [OpenAI Codex (cloud)](https://openai.com/codex)主办的竞争对手
- [Google Jules](https://jules.google)谷歌的托管版本
- [Factory Droids](https://www.factory.ai)替代商业参考
- [GitHub App documentation](https://docs.github.com/en/apps) 范围的机器人身份
- [Daytona cloud sandboxes](https://daytona.io)参考沙盒
