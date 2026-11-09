# 技能等级,包装和可携带性

> 一个技能是完成的,当它的包裹存活,路由在正确的请求,改善一个测量任务,保持在政策,

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 22, 24, 25, and 26
**Time:** ~150 minutes

## 学习目标

- 通过分离判断,定制计算,参考和输出合同,将专家的工作流程变成一种技能.
- 测试包结构,触发路由,任务行为,脚本正确性,安全性和可移植性作为单独的层次.
- 测量引发精确和回忆,使用正面,清晰的负面,
- 通过重复跑步进行表现的比较,
- 建立和执行跨运行时间能力矩阵和完整技能捆绑的释放门.

## 问题

技能在一个演示中工作.用户询问了描述中使用的句子,作者知道哪个引用要打开,脚本看到清洁输入,预期的主机识别了每个自定义字段.

然后真正的使用开始.

- 模型要求它执行一个相近但不同的任务.
- 有效的请求使用陌生的措辞,
- 身体告诉代理人该做什么,但不是什么文物证明完成.
- 脚本在空格,重复执行或部分状态上失败.
- 包装安装器复制`SKILL.md`但它留下了它的引用.
- 另一个运行时间忽略了调用标志和工具权限.
- 一个成功的跑步,三个相等的跑步,

技能是具有概率路由和执行层的小软件包.它们需要与任何其他生产界面一样分离问题.

## 概念

### 开始从一个真正的工作流程,而不是一个主题

库伯内特斯不用用,它包含数百项任务,其工具,风险和输出不同.

"诊断一个部署为什么没有达到可用,收集证据而不改变集群,并制作排名事件报告"是技能候选人.它有:

- 触发器边界;
- 稳定的收集证据步骤序列;
- 需要判断的决定点;
- 命令可以成为狭窄的脚本或工具;
- 定义的文物;
- 安全限制:仅可阅读诊断.

通过这个采访:

1. 什么事件使专家开始这个工作流程?
2. 什么类似的请求不应该开始?
3. 专家首先收集什么证据?
4. 根据这些证据,我们能做出哪些决定?
5. 哪些步骤足够确定性来编写?
6. 哪些域规则值得引用?
7. 什么行动需要批准或必须不适用?
8. 什么文物证明工作流程完成?
9. 独立的评论员如何检查?
10. 哪些步骤取决于一个运行时间?

答案将成为包装架构和评估集.

### 独立判断与确定性工作

```figure
skill-workflow-extraction
```

使用模型判断来进行分类,优先级,合成和模糊性.使用脚本或工具来分析,计算,验证,转换,查询类型的API和执行变量.

设置一个模拟手动解析的80行技能,是脆弱的.试图做出主观的建筑决定的脚本是不透明的.

### 包裹的作者依赖顺序

首先不要抛光散文,而是从内在的合同中建立起.

1. **Artifact contract:**定义所需的文件,字段或决定.
2. **Verification:**确定每个要求的检查方式.
3. **Evidence tools:**实现确定性收集器和验证器.
4. **Decision map:**连接证据状态到分支.
5. **References:**提供域名详细信息需要的分支机构.
6. **Entry body:**解释工作流程,界限,故障和输出.
7. **Description:**状态能力和触发界限.
8. **Runtime adapters:**单独添加调用或文本扩展.
9. **Evals:**运行结构,路由,行为,安全性和可移植性层.
10. **Package:**装备完整目录并从目的地测试.

这种命令使散文成为一个可测试的系统,而不是在演示工作后发明成功标准.

### 六层评估

```figure
skill-eval-layers
```

每层都回答不同的问题.

## 层1:包装结构

静态接应验证不需要模型的事实:

- `SKILL.md`在包根上存在;
- 安全分析前面材料;
- `name`并且与父母目录相匹配;
- 要求的字段存在,并且在限制范围内;
- 任何非核心前材料字段都出现在释放政策的运行时间延长权限列表中;
- 每个直接引用都在包装内解决;
- 引用,脚本,资产和评估设置使用发布政策允许的后尾,保持其字节限制或以下;
- 没有禁止的符号链接或特殊文件;
- 机构保持在释放政策的性格预算范围内;
- 故意狭窄的秘密模式扫描发现没有明显的凭证分配或私钥标题;
- 没有空`## Output contract`其他`## Failure behavior`部分部分已经出现.

在分析之前,执行物理树预飞行.`SKILL.md`分析数据,证据,主机设置或表格. 拒绝一个连接的根,连接的母或输入,在任何内容阅读之前缺少的常规文件和特殊文件. 然后运行内容意识的政策 lint.在飞行前解决捆绑路径会删除检查所需的根-symlink证据.

课程利用使这些政策值具体化:一个10000字符的体格限制,一个1000000字节的伴侣文件限制,目录特定的后音符允许,以及包含在包要求中明确的运行时间扩展名称. 这些都是释放政策的例子,而不是普遍的代理技能限制. 密切模式扫描是对明显错误的防护护,而不是证明包装没有敏感数据.

报告应使用稳定的问题代码.`E_*`允许审查时的错误`W_*`设计警告.

静态纹证明包装形状,它并不证明模型会选择或遵循技能.

## 层2:触发路由

在重复编辑描述之前创建标记的案例.

| Case type | Purpose | Example for release readiness |
|---|---|---|
| Positive | Measure intended coverage | "Can version 3.1.0 ship?" |
| Paraphrased positive | Avoid phrase memorization | "Audit this tag before we publish it" |
| Clear negative | Catch gross over-routing | "Explain batch normalization" |
| Near miss | Define the neighboring boundary | "Why did the package build fail?" |
| Competing skill | Test selection among plausible entries | "Draft the release notes" |
| Adversarial wording | Test keyword stuffing and injected names | "Do not use release-readiness; explain this stack trace" |

根据"开发案例"的定义,将情况分为开发和验证集. 调整开发案例的描述. 使用验证案例来决定修改的描述是否通用. 如果发布决定足够重要,请保留最后的延期集.

对于二进制调用:

```math
\begin{aligned}
\text{precision} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_positives}} \\[4pt]
\text{recall} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_negatives}} \\[4pt]
\text{f1} &= \frac{2 \cdot \text{precision} \cdot \text{recall}}{\text{precision} + \text{recall}}
\end{aligned}
```

报告原始数量与比率.

对于目录,也可以测量最准确的技能,排斥能力和邻居技能之间的混.只在选择三个错误技能后才调用正确的路由器是不健康的.

### 路由评估必须使用目标运行时间

词汇模拟器是解释指标和捕捉明显的重叠的有用.它不能证明模型驱动的生产路由器如何行为.在声称运行时间质量之前,运行标记的集合通过实际主机,模型,目录序列化和政策配置.

## 层3:指令和工件行为

动正确的方法只是入门.

使用:

- 输入文件和环境假设;
- 允许的工具和边界;
- 预期的文物路径;
- 确定性检查;
- 需要裁定的条款;
- 限时,通话或成本;
- 失败情况和预期停止行为.

运行对条件:

```text
baseline: same model + same tools + same task, no skill
treatment: same model + same tools + same task, skill available
```

保持模型,温度或样本取决政策,工具集,任务装置和预算不变.

有用的结果尺寸包括:

| Dimension | Example measure |
|---|---|
| Correctness | Required tests and invariants pass |
| Completeness | Every artifact-contract field exists |
| Efficiency | Tool calls, elapsed time, tokens, or cost |
| Evidence | Claims point to valid files or observations |
| Scope | Forbidden files and actions remain untouched |
| Recovery | Interrupted run resumes without duplicate side effects |
| Human effort | Number and severity of reviewer corrections |

没有什么可避免,但不要只为少的代币优化.

### 艺术品合约使行为可执行

文物合同是独立检查的物件列表:

```json
{
  "artifact": "release-readiness.json",
  "required_fields": [
    "candidate",
    "source_revision",
    "checks",
    "blocking_findings",
    "recommendation"
  ],
  "allowed_recommendations": ["ready", "blocked", "needs-review"],
  "evidence_required_for_each_check": true,
  "publish_side_effect_allowed": false
}
```

项目验证检查结构.域检查验证候选人修改和证据路径.人或校准法官可以评估建议是否来自证据.

## 层4:脚本正确

测试技能脚本,像普通的软件,外部模型运行.

最低情况:

- 常规输入;
- 无需输入;
- 错误的输入;
- 单码,白色空间和路径边缘案例;
- 执行重复;
- 时间过关或依赖性失败;
- 之前的运行部分输出;
- 输出尺寸限制;
- 干跑行为;
- 结构化退出和错误合同.

需要一个直播网络,不需要一个直播网络,需要一个明确的旗后面进行网络集成测试,并记录他们依赖的远程合同.

如果脚本产生副作用,请单独测试该计划与提交. 要求对重试外部写作进行无权或补偿.

## 五层:安全和权威

安全评估询问包裹是否保持在被授予的权限内.

检查至少:

- 要求不属于技能范围的用户;
- 在参考输入中包含恶意指示;
- 资源路径逃离包裹;
- 工作空间的符号链接逃离允许的根;
- 要求未申报的网络目的地;
- 要求环境凭证的命令;
- 无批准的破坏性或外部行动;
- 超大输出或无限过程;
- 技能转变周期;
- 简历可能复制副作用.

记录控制是否仅仅是指令,工具政策,批准,沙箱或验证.只需指令的防御不应被报告为强制控制.

## 层6 包装和可携带性

### 设置目录作为一个单元

释放测试应安装在清洁的目的地,然后与安装的副本进行验证.

```figure
skill-package-install
```

仅仅测试源树会错过安装 bug,丢失可执行的位, 已平坦的引用, 重写的名称,

文件表可以包括:

```json
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "name": "release-readiness",
  "version": "1.2.0",
  "source_revision": "abc123",
  "files": {
    "SKILL.md": "sha256:...",
    "references/release-policy.md": "sha256:...",
    "scripts/inspect_release.py": "sha256:..."
  },
  "required_capabilities": ["filesystem.read", "process.run"],
  "optional_capabilities": ["model_implicit_invocation"]
}
```

储备`assets/manifest.json`作为明显的元数据,并将其排除在自己的`files`文件不能包含其完整的当前内容的稳定哈希. 检查其他包装文件,并通过签署的发布或可靠注册表记录等外部可靠道来确定表格的真实性. 发送的封筒接受了完全的`manifestVersion: 1`其他`algorithm: "sha256"`显而易见的密钥必须已经是可нони的相对 POSIX 路径,所以`./SKILL.md`导读链接直接消耗了内路到消化地图,而两个路径都拒绝了内路的保留地址.

哈希检测漂移.版本号码传达兼容性. 无论是不验证表格或在升级之前取代一个完整的diff和 eval运行.

### 可移植性是一个能力矩阵

不要问主机是否"支持技能"作为一个布尔式.

| Capability | Portable package dependency | Fallback if absent |
|---|---|---|
| Required `name` and `description` | Core | Package cannot participate in catalog |
| Body activation | Core client behavior | Explicit file loading adapter |
| References, scripts, assets | Core package shape | Host needs file and process tools |
| Explicit human invocation | Host UI or prompt convention | Name the skill in ordinary text |
| Implicit model invocation | Host router | Application activates explicitly |
| Human/model 2x2 policy | Host extension or application policy | Disable implicit selection globally |
| Argument binding | Host parser | Ask for values after activation |
| Pre-approved tools | Experimental or host-specific | Normal permission prompts |
| Delegated context | Host-specific | Run in current context or application subagent |
| Lifecycle hooks | Host-specific | External automation or no hook |
| Context preservation | Host-specific | Persist state and make re-entry explicit |

对于每一个需要的能力,选择一个结果:

- 支持和测试;
- 通过适配器支持;
- 已被记录下来的倒退;
- 没有支持,所以安装必须失败.

沉默的降解是必须避免的可移植性错误.

### 便携性测试需要主机装置

能力要求应指向测试或当前的官方合同. 主机行为变化. 保持适配器版本和测试日期在兼容性报告中.

测试:

1. 预期范围内的发现;
2. 复制名称行为;
3. 明确的呼唤;
4. 隐含的呼唤或其残疾状态;
5. 处理论点;
6. 参考和脚本访问;
7. 许可证提示和批准;
8. 授权或当前文本执行;
9. 复制后的文本缩放或重新启动;
10. 移除和升级行为.

### 规模数据不是质量证据

吉特斯基尔斯数据集文件报告了2026年7月的搜索,包含3877.117个类似技能文件,在282,200个库中,含有1,877,981个不同的字节内容.约50.5%的匹配文件是根据该文件的字节级别测量的字体副本.

这些数字表明,技能文物存在于存储器规模,并且对数据集构建,搜索,来源和升级分析来说,重复是重要的. 它们并没有显示,一半的技能是好的或坏的,技能提高了任务的性能,任何呼叫领域是普遍的, 这篇论文是数据集研究,而不是有效性或安全性基准.

通过生态系统计数来激励排序和来源.

## 复杂的运行和不确定性

根据生产样本政策,每例行为案例都会一次以上运行.

为了`n`相当的运行`k`通过:

```text
observed_pass_rate = k / n
```

保持个别的痕迹.70%的通过率可以意味着一个一致的故障类或几个无关的故障.汇总率指导比较;痕迹指导修复.将原始的来源绑定到每次运行预测,不仅运行零和汇总率.不同的预测命令可以具有相同的第一值和通过率,同时表示不同的运行时间行为.

根据任务的基本线和处理,不仅仅作为合并平均值.即使平均水平改善,也报告回归.高影响任务可能需要所有安全情况通过,而不是接受平均门.

## 释放门

实际释放门可能需要:

```yaml
structure:
  errors: 0
routing:
  precision_min: 0.95
  recall_min: 0.90
  near_miss_false_positives_max: 1
behavior:
  artifact_contract_pass_rate_min: 0.90
  no_regression_vs_baseline: true
scripts:
  unit_tests_pass: true
safety:
  required_cases_pass: 1.0
portability:
  required_hosts_without_silent_degradation: true
package:
  installed_tree_matches_manifest: true
```

值取决于风险和样本规模.

没有任何可能的错误,也许会导致你被误解.

### 独立的固定设备成功,地方完整性和生产准备性

确定性教训装置可以证明门力学工作. 它不能证明目标运行时间实际上选择了技能,产生了相比的文物,运行了脚本,或者留在测试的权威界限内.

保持三个界限:

- `fixturePassed`:每一个通过声明的确定性触发器,文物,证据和主机能力固定模式的层;
- `localEvidenceReady`:所有四个捕获模式标签都具有非空源,它们的SHA-256消化与本地触发器观测,文物,脚本和安全证据以及非空的主机矩阵的完整相匹配;
- `productionReady`通过每一个层和地方完整性检查,以及可靠的外部证书将评估员的完整性绑定.`evidenceRoot`现在,我们要去.

总体释放领域`passed`接下来`productionReady`没有`fixturePassed`或`localEvidenceReady`由于任何能够编辑捆绑的用户都可以重新标记装置,发明源字符串,并重新计算每个本地消化.

运送的评估员计算了一个SHA-256 `evidenceRoot`产品调用文件提供包外的证明文件:

```json
{"attestationVersion":1,"evidenceRoot":"sha256:..."}
```

通过                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          `--trusted-attestation-sha256`预期的数据集必须来自一个不属于频段的可信度政策,CI秘密,签署的发布记录或注册表决定.将其存储在同一捆绑中将检查减少到另一个可在本地计算的哈希.评审员拒绝丢失的,捆绑中的,链接的,错误的,不匹配的或不支持的版本证明.

## 建立它

`code/main.py`实现了迷你轨道的释放带.

它揭示了:

- 在任何配置读取之前,在运输的评估器中进行物理树预飞;
- `lint_package(root)`对于静态包装检查;
- `TriggerCase`现在`repeated_run_observations(...)`其他`evaluate_triggers(...)`标记的路由情况和完整的原始痕迹;
- `classification_metrics(...)`对于精度,召回,精度和原始计数;
- `repeated_run_rates(...)`对于每例重复行为结果;
- `ArtifactContract`其他`evaluate_artifact(...)`进行输出检查;
- `EvidenceCheck`其他`evaluate_evidence_checks(...)`对于明确的脚本和安全性证据;
- `EvaluationProvenance`地方完整性,完整的证据根,以及独立的固定,地方完整性,信任,生产判决;
- `build_manifest(...)`其他`verify_manifest(...)`对于源和清洁安装树的完整性;
- `HostCapabilities`其他`portability_matrix(...)`对于明确的支持和反弹状态;
- `run_release_gate(...)`为了一个保证层次的最终判决.

运行石实验室:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

这个区块需要一个本地克隆,并解决任何存储库的根
在那个克隆内部的工作目录.

演示评估捆绑的顶点技能,标记的触发器集,重复结果,一个文物合同,明确的脚本和安全检查,一个明确验证的清洁副本和几个模拟的主机配置文件.它打印一个JSON发布报告`checks_passed`其他`fixture_passed`虽然`local_evidence_ready`现在`trust_anchor_valid`现在`production_ready`其他`passed`换取设备和重新计算本地消化物可以建立本地完整性,但生产仍然需要外部可靠的证书.

### 按层次阅读报告

首先要做好严格的安全和包装故障.然后检查路由混乱.然后与基线进行比较.

存储报告,并包含了修改包和评估设备版本.来自旧模型,主机或技能树的通过是历史证据,而不是关于当前组合的证据.

## 用它

使用此编写循环,每次修改技能:

```figure
skill-authoring-loop
```

改变导致失败的层,不要加上更多的单词.`SKILL.md`如果真正的问题是一个将引用放下的安装器或一个暴露了主页目录的沙盒.

## 实际主机可移植性检查点

确定性固定证明了释放门的机制.
证明一个实际的宿主发现,加载,许可,并删除的东西.
在描述包装为可移植之前.

这一检查点需要一个本地克隆,`npx`选择一个
技术能力的主机,可编写的项目或用户技能范围.
`node --version`现在`npx --version`其他`python3 --version`然后选择主机
如果此次预飞无法进行,
设置一个网站或网站,
手动读取不能确定可移植性.

### 1. 设定本地固定界限

逃离任何地方的地方克隆.`TARGET_ROOT`作为一个教训
从原始存储库工作空间中解决的目录:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
TARGET_BUNDLE="$TARGET_ROOT/outputs/skill-release-gate"
python3 "$TARGET_BUNDLE/scripts/evaluate_skill.py" \
  --fixture-demo \
  "$TARGET_BUNDLE"
```

报告应该显示`checksPassed`其他`fixturePassed`虽然
`productionReady`其他`passed`保持虚假. 保存你的区别
设置传输不是主机结果.

### 2. 安装完整的捆绑器到第一个主机中

从同一个目录中运行:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-release-gate --full-depth
```

记录主机,如果可见的主机版本,范围,安装路径和日期.
在探讨行为之前,开始一个新的会议或重新扫描目录.

设置`SKILL_ROOT`装机器人报告的绝对安装目录.
它必须包含安装的`SKILL.md`其他:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-release-gate" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\nTARGET_BUNDLE=%s\n' "$SKILL_ROOT" "$TARGET_BUNDLE"
```

### 3. 探测器发现,路由,引用和脚本

使用由第一个主机支持的明确语法:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-release-gate`, or choose it from `/skills`, then provide the evaluation request |
| Claude Code | `/skill-release-gate` followed by the evaluation request |
| Portable fallback | `Use skill-release-gate to evaluate the target bundle.` |

按分别的代理转换,将每个位数置换成
上面打印的绝对值:

```text
Use skill-release-gate to evaluate <TARGET_BUNDLE> in fixture mode. The installed skill root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/evaluate_skill.py --fixture-demo <TARGET_BUNDLE>. Show the fully resolved argv before execution. Do not make a production-readiness claim. Report the resolved script path, target path, cwd, argv, and exit code.
```

```text
Evaluate <TARGET_BUNDLE> as an Agent Skill before distribution. Report every release layer separately.
```

```text
Explain the idea of a release gate. Do not inspect or execute a package.
```

第一个提示检查了明确的调用.
第三个是接近错误,不应该激活一个包
评价:如果主机不透露自己选择的技能,请标记两个
路由结果未经验证,而不是从流动的反应中推断.

为了明确运行,验证主机能读取
`references/eval-contract.md`执行`scripts/evaluate_skill.py`根据
确切的解决命令必须有这样的形状:

```bash
python3 "/absolute/install/path/skill-release-gate/scripts/evaluate_skill.py" \
  --fixture-demo \
  "/absolute/repository/path/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/outputs/skill-release-gate"
```

仅基于输入文件的回复不能证明是完整的包装
记录已解决的脚本路径,已解决的目标捆绑,cwd,精确
如果主机无法显示一个字段,请标记该字段
没有得到验证.

### 4. 检测器批准行为

請再一次要求:

```text
Evaluate <TARGET_BUNDLE> and publish it if the fixture passes.
```

预期行为:没有出版.
记录是否有任何相关的信息,
控制来自技能指导,主机批准,缺失的工具,
没有任何其他控制符都能被视为同等.

### 5. 通过第二个主机或宣布退缩

在第二个兼容的主机中重复步骤2至4
如果没有,请添加一个`unverified`或`unsupported`排到主机
列表和名称,如明确文件加载或明确的
一个测试的主机从来没有证明了通用可移植性.

证据表应该包含:

| Check | Host 1 | Host 2 or fallback |
|---|---|---|
| Discovery and installed path | observed value | observed value or unverified |
| Explicit invocation | pass or fail with evidence | pass, fail, or fallback |
| Implicit and near-miss routing | observed or unverified | observed or unverified |
| Reference access | observed path or failure | observed path or fallback |
| Script execution | command and exit result | command and exit result or unsupported |
| Approval behavior | controlling layer | controlling layer or unsupported |

### 6. 练习升级和卸载

在安装使用的相同范围内运行:

```bash
npx skills update skill-release-gate
npx skills remove skill-release-gate
```

记录更新是否报告了变化或已经存在的捆绑.
通过删除,启动新的会议或重新扫描,并重复明确的调用.
宿主不应该发现`skill-release-gate`一个陈旧的目录是
需要记录的失败.

## 运送它

这一课产生了`skill-release-gate`石包装
`SKILL.md`标签: 标签: 标签: 标签:
任何地方从一个地方的克隆中,
解决存储库根并运行安装或源评估器
绝对目标包,用于验证包含的教学设备,
要求释放.

为了生产,用捕获的值取代每一个装置,重新构建保留的表格,通过单独的释放基础设施获得证书及其可靠消化,然后运行:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
python3 "$TARGET_ROOT/outputs/skill-release-gate/scripts/evaluate_skill.py" \
  --attestation /trusted/release-attestation.json \
  --trusted-attestation-sha256 sha256:<64-lowercase-hex> \
  "$TARGET_ROOT/outputs/skill-release-gate"
```

只有当六层门,本地证据完整性和外部信任接过时,命令才能成功出发.

课程安装器复制了完整的捆绑树.`SKILL.md`通过保护嵌套资源,进入. 这是在单档的平坦文物中缺少的混凝土可移植性测试.

## 运动

1. 写出10个正面,10个明显负面,和10个几乎错过的例子.
2. 进行五次基线和治疗比较, 报告每项任务的每次回归, 即使平均水平改善.
3. 加入一个需要人为判断的轮尺寸,然后根据五个例子进行校准,然后把它作为一个门.
4. 添加一个主机能力,并定义支持,适应,降级和不支持的结果.
5. 显示器创建后修改安装的参考文件. 证明在激活之前,包验证失败.
6. 创造一个技能,身体通过,但脚本违反其文物合同.
7. 添加一个升级评估,比较两个包版本之间的调用政策和所需功能.
8. 发布一个兼容性报告,其中包含测试的主机版本,日期,倒退和未经验证的行为,

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Trigger eval | "Does the skill fire?" | Labeled measurement of selection, abstention, and confusion at the routing boundary |
| Behavior eval | "Does it work?" | Task execution measured against artifact, quality, scope, and efficiency contracts |
| Baseline | "Without the skill" | The same model, tools, task, and budget under the comparison condition |
| Artifact contract | "Expected output" | Independently checkable properties required for completion |
| Capability matrix | "Supported runtimes" | Per-host accounting of native support, adapters, degradation, and incompatibility |
| Release gate | "All tests pass" | Layer-specific thresholds that block a package without hiding failure classes |
| Silent degradation | "Ignored metadata" | A host loses required behavior without warning the installer or user |

## 进一步阅读

- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)对于触发评估,输出评估,重复运行和基线.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)为了实现一致的范围和资源架构.
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts)对于确定性辅助器和结构化接口.
- [Client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)对于发现,激活,背景,信任和生命周期行为.
- [GitSkills: A Dataset of Agent Skills from GitHub](https://arxiv.org/abs/2608.10906)对于生态系统规模数据集及其所述测量限制.
