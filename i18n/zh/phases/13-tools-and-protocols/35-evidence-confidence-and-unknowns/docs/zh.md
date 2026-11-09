# 双元分析中的证据,信心和未知

> 编译的程序的发现是包含一个哈希,一个信任,一个权威,以及它不能显示的列表的记录.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## 学习目标

- 建立一个基于ReA的证据记录`Evidence`对于这些问题,我们需要注意:
- 计算当文件移动到另一个文件时保持相同的内容哈希ID.
- 记录每一个提供商不能显示的限制,
- 拒绝声明结果,直到观察到的函数运行支持它.
- 保存剩余未知作为修改记录,并通过哈希链连接.
- 缓存提供商在一个精确的密钥下回答,拒绝过时的重播.

## 问题

你问一个代理什么?`grade`在`ledger-x86_64-O1.o`经理打电话给 rea,读取Ghidra伪代码,回答0.一个评论员问代理如何知道.代理有一个文字块,Ghidra打印.默认路径,该文字读取`uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`在那个时候,字节说`xor eax, eax`现在,我们要去.

对于每一个输入,表达式和指令都产生0 . 代理人不知道这一点. 它信任了文本,因为一个工具产生了它. 2026 年的一项研究运行了三个代理人在24 项逆向工程任务 ([NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)) 它列出了四个重复的弱点:训练偏见,对观察过度信任,背景限制和计划持久性.另一项2026年的研究将文本植入二进制中,发现模型在40例中35例提出了植入的不安全行动 ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507))

对于此,每次成功的工具调用都会产生一个词汇库.`Evidence`记录一个`confidence`其他`observed`现在`derived`其他`inferred`其他`authority`其他国家`limitations`包装技能告诉代理人:"每个结论都必须区分观察,推断和未知.引用证据ID,保留限制和不完整的覆盖,从来不暗示静态分析观察执行.

通过一个数据库,它可以通过一个数据库,然后通过一个数据库,然后通过一个数据库,然后通过一个数据库.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.它将其数据库存储在一个数据库中.`verified`通过它.

您将写一个账本,将所有关于该设备的事实存储为记录,并使用内容哈希.`percent_change`其他`grade`您将进口两个真实的Real记录和它们来自的快照,然后您的账本重新计算了每一个HaS rea写的.

```figure
re-evidence-ledger
```

## 对于信任的三个词,对于权威的五个词

`confidence`是一个有三个值的 enum,从来没有一个数字.`authority`只有五个值. 当一个生产者没有说话时,`shipped-artifact`随着`observed`现在,我们要去.

| Value | Meaning on the fixture | Records in this lesson |
|---|---|---|
| `observed` | A fact read from bytes or from a run | the ELF reader's section and symbol reads, the two Ghidra records, 17 host runs |
| `derived` | A fact computed from observed records | the switch table model, the division model, every unknown mutation |
| `inferred` | An expectation that no observation states yet | 18 predictions |
| `shipped-artifact` | The file on disk was the source | every read of `ledger-x86_64-O1.o` |
| `controlled-replay` | A run you controlled produced the fact | the host runs of `harness.c` |
| `analyst-inference` | Your own judgement | predictions and unknown mutations |
| `historical-reference` | An older source tree or document | none here |
| `external-service` | A service outside the file and the host | none here |

两种混最花费时间.第一种把伪代码视为一种行为观察.它是Ghidra打印的观察.第二种把空清单视为缺席证明. rea的设计说明是严格的:"缺失覆盖是未知的,而不是缺席. "`code/main.py`它们都包含了两个规则.

## 记录

记录包含16个字段,而6.5.0则拒绝任何其他字段.`code/main.py`现在,我们可以看到一个字符,然后我们可以看到一个字符.`relationship_coverage`电话号码显示了通话或通话者的完整性.`complete`现在`partial`其他`unknown`其他`null`操作报告没有通话关系时.

| Field | What it holds |
| --- | --- |
| `evidence_id` | `ev_` and 64 hex digits, a hash of the content |
| `subject` | `name`, `digest.sha256`, `format`, `architecture`, `local_path`, or `null` |
| `provider` | `id`, `name`, `version` or `null` |
| `analysis_profile` | the provider's settings and their digest, or `null`, always present |
| `predicate_type` | a tag, `rea.analysis` by default |
| `operation`, `parameters` | the tool and its input |
| `raw_result`, `normalized_result` | provider output and the canonical result |
| `confidence`, `authority` | the enums above |
| `environment` | `id`, `platform`, `architecture`, `isolation`, or `null` |
| `limitations` | plain sentences |
| `relationship_coverage` | `status` `complete`, `partial`, or `unknown` with diagnostics, or `null` |
| `locations` | `address`, `address-range`, `artifact-path`, `file-offset`, `file-offset-range` |
| `evidence_links` | the `ev_` ids this record rests on |

这是真正的记录,Rea写的.`grade`现在,我们要把它切除到重要领域.`code/fixtures/rea-evidence-grade.json`它们的数量为37573字节.

```json
{
  "evidence_id": "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1",
  "subject": {
    "name": "ledger-x86_64-O1.o",
    "digest": { "sha256": "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f" },
    "format": "elf",
    "architecture": "x86_64",
    "local_path": "/private/tmp/aiefs-re/phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures/ledger-x86_64-O1.o"
  },
  "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
  "analysis_profile": {
    "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
    "parameters": { "jump_table_evidence": "typed-case-default-blocks-v1", "import_mode": "ephemeral-source-immutable" },
    "digest": "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
  },
  "operation": "analyze_function",
  "parameters": { "procedure": "grade" },
  "confidence": "observed",
  "authority": "shipped-artifact",
  "environment": null,
  "limitations": [
    "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>.",
    "Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals."
  ],
  "relationship_coverage": {
    "status": "complete",
    "diagnostics": [
      "Only resolved Ghidra call references are returned; unresolved computed or indirect calls remain unknown, while function classifications distinguish thunks and externals."
    ]
  },
  "locations": [],
  "evidence_links": []
}
```

真正的`parameters`文件的对象有25个键.`limitations`限制是内容的一部分,所以放下一个改变ID,然后你的账本会拒绝记录.

记载没有什么说明.`environment`是`null`因为Ghidra读了一份文件,却没有找到任何东西.`locations`由于该操作报告的地址是空的`normalized_result`现在,我们要去.`relationship_coverage`具有地位`complete`诊断显示,只有解决的Ghidra呼叫引用才会返回,未解决的计算或间接呼叫仍然是不明的.

## 标识是内容的密码,道路不在其中

实际计算`evidence_id`作为`ev_`另外,在RFC 8785中,可视化JSON的投影量是SHA-256`digest`现在`format`其他`architecture`子子`name`其他`local_path`它们下降了`relationship_coverage`当其价值为`null`没有调用关系的记录保持了该领域存在之前的相同身份.`raw_result`每一个限制都被除了.

RFC 8785 排序对象键,删除白空格,并修复数量和字符串形式.对于数量为整数的记录,Python的标准库产生相同的字节:

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py`由于RFC 8785和Python打印了一些浮动的不同,所以它在哈希之前拒绝浮动.

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

对于任何机器和文件,相同的字节得到相同的ID.`local_path`在上述列表中,一个Mac上有文件的名称.当您复制该装置到 `/home/you/re`现在,我们要去.`rebind_subject_path()`让你在新的路径下显示一个记录.`sha256`现在`format`其他`architecture`实际上6.5.0也同样适用于`rebindEvidenceToTargetPath`在一个新的路径上,它将重播一个目标的快照记录.

`validate_evidence()`根据Reas的说法, "证据的语义识别符不符合其记录".`analysis_profile.provider`不同于其`provider`测试`test_tampered_id_and_mismatched_profile_are_rejected`编辑一个字符串在真实中`grade`记录和观察本书拒绝它.

## 亲自观察物体

在任何提供商之前,`observe_object()`分析ELF64部分标题,`.symtab`现在`.strtab`其他`.rela.text`随着`struct.unpack_from`它写了一个`inspect_object`记录和一个`read_function_bytes`它们都是`observed`具有权威`shipped-artifact`由于源源是磁盘上的文件.

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t`同意:`grade`在`0000000000000010`具有尺寸`2e`现在,我们在城里做了三次搬迁.`.rela.text`是`R_X86_64_PC32`反对`.rodata`在抵消期`0x36`现在`0x84`其他`0x93`附加`0x10`现在`0x24`其他`-0x4`每张唱片都包含一个`file-offset-range`位置和一个限制:"从磁盘上的文件中读取节字节.读者没有进行移动,也没有运行代码.

第32课就完整了读者,这里有60行,因为这课是关于你记录读物的内容.

## 取出表,然后说你取出了

它们的46个字节`grade`包含了第33课解码的四个模式:

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

乘以`0x66666667`文件中包含第10号.`derive_grade_model()`写出这个事实作为一个限制:"分数10是从乘数0x66666667和转移34的衍生.文件保留了10号.

其他`add ecx, -6`首先,将第一个案例设为6.`cmp ecx, 4`没有签名的跳跃承认五个案例,6到10个.

其他`lea`在`.text+0x33`承担转移的附加额度`0x10` PC32 从4字节移动结束时进行移动措施,所以表从`.rodata+0x14`五个小语.`1, 2, 3, 4, 4`接入了开关`ledger.c`编译器将开关转换为返回值的查找表.

结果记录`ev_605106bff2d9998f…`没有`confidence` `derived`它们的`evidence_links`取出字节记录从本书中,并将衍生记录带来一个悬挂的链接.上面的图表显示了关闭时的状态`ev_a467c242…`现在,我们要去.

现在比较Ghidra,它对相同字节的伪代码:

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

吉德拉将搬迁情况应用于,并命名了表格.`DAT_001000b4`现在,`.rodata+0x14`在它被放置后`.text`在`0x100000`对于默认值,它打印了一个表达式,总是0并且从来没有说0.`native_value_flow`标记这些操作`is_dead: true`记载是Ghidra的忠实观察.你读到的含义是从中得出的,

其他`percent_change`记载显示了另一个失败.`undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`消息来源说`int percent_change(int before, int after)`现在,我们要去.`idiv`写道`EDX:EAX`现在,我们要走的路线是零的.`EDX`由于它没有被触及,所以解译器推断了16字节的返回和第三个参数.`native_api.return_type.confidence`为了`grade`是`"low"`作为供应商的推断,并以这种方式记录恢复的签名.

## 预测是传言的

预测是指没有观察所表明的行为指控.`claim_suite()`根据其来源和衍生模型,构建了18个模型.`record_prediction()`存储每个记录的记录`confidence` `inferred`其他`authority` `analyst-inference`据此,它与其依赖的记录有关.

| Claim | Predicted value | Rests on |
|---|---|---|
| `percent_change(12400, 15500)` | 25, from 310000 / 12400 | division model `ev_076a9167…` |
| `percent_change(0, 5)` | 0, the zero guard | division model |
| `percent_change(100, 50)` | -50 | division model |
| `percent_change(-7, 3)` | -142, because `idiv` truncates toward zero | division model |
| `grade(55)` | 0, index -1 fails the unsigned compare | table model `ev_605106bf…` |
| `grade(60)`, `grade(69)` | 1, 1 | table model |
| `grade(70)`, `grade(85)` | 2, 3 | table model |
| `grade(95)`, `grade(100)`, `grade(105)` | 4, 4, 4 | table model |
| `grade(110)`, `grade(-5)` | 0, 0 | table model |
| `total(1, 2, 3)`, `total()` | 6, 0 | source record `ev_2f1e6d25…` |
| `grade_label(85)` | `"B"` | source record and table model |
| `grade(score)` for 90 to 100 | 4 for all eleven inputs | table model |

`predict()`通过C语义,而不是Python语义.`c_div()`缩小到零,`wrap32()`通过Python的方法,我们可以将每个中间件折叠成32位.`//`转向负无限,所以`(3 - -7) * 100 // -7`课程36使这个格格变得更大.

每个预测都会开辟一个剩余的未知.`observed`证据有权威`controlled-replay`建议一个探测器:`execute_function`在主机构建上.下一个部分产生了这些证据.第一个级索赔的问题是"编译函数运行时,是否有级 ((95) == 4 保持?"

## 检查它们是否有运行

`code/fixtures/harness.c`包括`ledger.c`并且每次调用每次打印一个结果.`observe_runs()`编译了它与第一个`clang`现在`cc`其他`gcc`每次运行都会变成一个记录:

```json
{
  "operation": "execute_function",
  "parameters": { "function": "grade", "args": [95] },
  "normalized_result": { "result": 4, "stdout": "4\n", "exit_code": 0 },
  "confidence": "observed",
  "authority": "controlled-replay",
  "environment": { "id": "host-process", "platform": "darwin", "architecture": "arm64", "isolation": "process" },
  "limitations": [
    "The run executed a host build of ledger.c, not the x86-64 object. The claim about the object rests on the shared source and on the compiler.",
    "One run observes one input. It proves nothing about other inputs."
  ]
}
```

运行记录的主题是该 Mac 上的Mach-O arm64文件,`course-harness`编译器的版本线,在这里`Apple clang version 17.0.0 (clang-1700.6.3.2)`现在,我们要去.`evidence_links`名称来源记录`ev_2f1e6d251543d017…`由于运行和对象共享`ledger.c`没有其他东西.

读一遍第一个限制. x86-64 对象从来没有运行在这个机器上.运行的是另一种架构的同一源的第二个构建.这仍然是一个观察,并且它是没有模拟器的最强大的,所以该索赔通过了附加的句子.一个报告遗漏它已经丢失了读者需要的信息.

它们都符合预测.`code/fixtures/run-evidence.json`拥有17个记录和出口的源记录`--record`在2026-10-13时,当没有编译器时,`build_ledger()`报告中也提到,`runs`其他地方

## 促销规则

索赔从推断到支持的仅通过观察运行. `check_claim()`找到了`execute_function`记录相同的函数和参数,将每个结果与预测进行比较,并计算所涵盖的输入:

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()`它们的形式是严格的.`ClaimError`如果任何ID是`inferred`或`derived`列表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表`grade(55)`没有任何一个可以推广它.`ev_7be90c0c…`查看索赔的下降`unsupported`两份记录`grade`留下来.

范围索赔显示了部分情况. 运行网中只有两个输入,95和100. `check_claim()`收益`unknown`随着`covered`两分11分,`promote_claim()`总数不包括"2"的输入.

`completion_ledger()`雷亚的镜子`EvidenceCompletionLedger`它的身份是`ecl_`另外,它记录的哈希数,`complete`只有当`pass`相当于`total`演示印记`ecl_da64933ea13befed…`随着`complete: false`由于一个范围的权利要求.

## 无人知之物是有哈什链的记录

 rea存储一个未知的残余作为严格记录. `code/main.py`保持相同的场地和不变的.

身份证是`unk_`加上SHA-256 `{domain, question, scope_digest}`两个分析师对同一文件提出相同的问题,得到相同的身份.`scope_digest`是对象的SHA-256

每个变化都是新的修订.`previous_revision_digest` `null`每次修订都会给出一个名字.`revision_digest`在它之前的,除了它本身,它不包含任何地方.`verify_unknown_chain()`检查每个链接是否指向之前的修改.检查每个修改名称的突变证据是否在本书中.

每种突变本身都是证据记录,`rea-unknown-registry`我们的载体`confidence` `derived`现在`authority` `analyst-inference`没有主题. 它的限制是"注册表突变记录了分析师决定的. 它不是答案的证据.

这就是为什么演示的81个记录包括36个衍生突变记录:18个开放和18个更新.

每次修订都必须执行三个变量:

- 只有一个`resolved`无人知携带一个`resolution`只有修正1没有前任.
- `contradicted`已知名称至少有一个相矛盾的ID,并且在两个列表中都没有任何ID.
- `verified`解决方案至少有一个具有必要的信心和权威的证据ID.

 rea的工作流程说明说:"只有合格的观察证据才能验证解决方案. `resolve_unknown()`因此拒绝表格模型,拒绝有权的观察记录`shipped-artifact`接受了跑步记录.`ev_f4ffbe8f922ec7fe…`关于" 决议的修订`grade(95)`修改2号,`previous_revision_digest`是`ffca840b55a8a188…`修订1的摘要.

`update_unknown()`需要`expected_revision`起的`revision-conflict`当它老了,就像雷亚一样`update_unknown`实际上,我们需要做出一个好反应,

演示后,一个未知的仍然开放:`unk_f2eb0d7f84c80a19…`" "编译函数运行时,每分数90到100分数的评分是4么?"它的状态是`investigating`探测器仍然命名了无运行的九个输入.

## 缓存答案不是分析数据库

实际上,它有三个东西,看起来像一个缓存.`-readOnly -deleteProject`记忆中的内容.`AnalysisSnapshotCache`存储一个二进制身份的最大1万个输入.`target`现在`binding`现在`entries`现在`workflow_entries`其他`evidence_bundle`现在,我们要去.

缓存密钥是`query_`加上SHA-256 `{target, binding, operation, parameters}`现在,我们要去.`target`是`{sha256, kind, format, architecture}`其他`raw-binary`目标也有了`entry_point`现在,我们要去.`binding`包含了消化. 改变任何25个配置文件参数,例如`jump_table_evidence`其他`typed-case-default-blocks-v1``v2`消化器变化,所以每个关键都变化.

`code/fixtures/rea-snapshot.json`实际上,它是通过所有权所有权限编写的文件,并且所有人都能阅读该文件.它包含两个输入和两个记录的证据捆绑.`AnswerCache.import_snapshot()`计算每一个`query_id`拒绝了任何不同时的文件.`target`或`binding`实际上,它与活动的不同,`profile_mismatch`它拒绝了任何一个照片.`format_version`没有`course-answer-cache-1`现在,我们要去.

首先,我们可以看到一个小行星.`grade`查询时间为8.6秒,`percent_change`查询与相同的快照需要8.5秒,因为不同的查询是缓存错误.`grade`查询时间为2.1秒,并返回了相同的记录,`evidence_id`现存中重播增加了"从本地REA分析快照中加载;此次调用未重新运行供应商. 我们的 `lookup()`添加类似的句子,使读者可以从新答案中辨别一句重复.

突变结束缓存.在 rea 6.5.0 中,一个改名或评论在 rea 发送电话给提供商之前清除了快照缓存.一个失败的回复不能证明写回滚,因此失败的写也停止重播.一个改变数据库的元数据进口也会这样做.

## 为什么一个代理人需要这

通过MCP传送Rea的代理人会看到每次电话的完整记录,并可以引用`evidence_id`在2026年的研究中,发现了这些问题.对工具输出的过度信任是NDSS BAR研究中的四个弱点之一.在植入文本研究中,显示二进制内容作为数据本身仍然留下了15个不安全的建议,其中40个.[arXiv 2606.06838](https://arxiv.org/abs/2606.06838)在有数百个函数的二进制中,只有10%至15%才在代理产生之前得到真正的分析.

总体记录了这些问题,代理只报告了本书所包含的内容.`unsupported`一些跑步的索赔是`unknown`提供商的文字是`observed`给代理人提供技能文件.`outputs/`只有在本书中写出结论, 只有克劳德,库尔索,科德斯,开关,赫尔梅斯,

## 建立它

运行标准图书馆演示:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
```

演示器阅读对象,进口两个 rea记录,验证 rea快照,并推导两个模型.然后记录18个预测,打开18个未知,编译和运行带,检查每个索赔,并解决17个未知.预期形状:

```json
{
  "records": 81,
  "by_confidence": { "observed": 25, "derived": 38, "inferred": 18 },
  "rea_snapshot": { "entries": 2, "replay_hit": true, "stale_profile_refused": true },
  "grade_table": [1, 2, 3, 4, 4],
  "runs": "live: Apple clang version 17.0.0 (clang-1700.6.3.2)",
  "claims": [ { "claim_id": "grade(95)", "status": "pass", "covered": "1/1" }, { "claim_id": "grade(90..100)", "status": "unknown", "covered": "2/11" } ],
  "completion_ledger_id": "ecl_da64933ea13befed9483f8b00447bb3f4ceb74324c01e2515eff03f3af3ca750",
  "complete": false,
  "unknowns": { "resolved": 17, "investigating": 1 }
}
```

没有C编译器,`runs`读书`imported 17 recorded run records from run-evidence.json`其他都是一样的.

阅读`code/main.py`在此顺序:

1. `canonical_json()`其他`compute_evidence_id()`保持食谱和语义投影.
2. `create_evidence()`其他`validate_evidence()`建立和检查记录.
3. `EvidenceLedger.record()`其他`import_bundle()`存储记录和拒绝冲突.
4. `open_unknown()`现在`update_unknown()`其他`resolve_unknown()`保持修改链.
5. `observe_object()`读取ELF,并`derive_grade_model()`读取表.
6. `claim_suite()`现在`predict()`其他`record_prediction()`写下下下列层.
7. `observe_runs()`子的每一个运行都变成了记录.
8. `check_claim()`现在`promote_claim()`其他`completion_ledger()`适用促销规则.
9. `AnswerCache`关键像雷亚的快照一样回答,却拒绝了那些老旧的快照.

## 用它

按每一个目标和每一个调查的分类簿,把目标的SHA-256放在每个主题中,`provider`您重建该文件时,主题将会发生变化,

写出没有转移的读者说,一个主机构建的运行说,一个分数的模型说,一个没有限制的记录看起来比事实允许更强大,后来读者无法修复.

它们永远不会成为指令,也永远不会成为行为观察. rea 6.5.0 标记这些结果为 `_meta.provenance.untrusted_content: true`服务器指令告诉模型将目标内容视为数据,并将其中的任何运行,安装,下载或发送请求报告为提示注射尝试.标记有助,但您的账本仍然必须将目标文本排除在指令之外.

## 互动实验室

### 实验室A:重新计算一个 reaid

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

运行:

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

首先的两个比较是正确的.路径不在哈希中.第三个是错误的,因为一个限制包含了.

### 实验室B:拒绝晋升

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

电话开始响起`ClaimError`现在,请传输运行ID:

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

状态是`pass`那些回来的`limitations`带来宿主建设的判决.

### 实验室C:拒绝过时的快照

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

第一个进口报表 2.第二个进口报表`CacheError`随着`profile_mismatch`一个版本字符串改变了,整个快照被拒绝了.

### 实验室D:打破链

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

第一个回应,第二次升级.`EvidenceIntegrityError`由于第1修正不再与自己的消化符号匹配,而第2修正则在不再存在的消化符号上.

## 实践实验室

关闭未知开放,并添加第二个提供者.

要求:

- 延长时间`run_grid()`现在,我们可以在一个位置上查看,`resolved`在修订3时.
- 加入`llvm-objdump -d`作为第二家供应商,拥有自己的服务.`provider`提出并记录其列表`grade`作为`observed`现在,我们要去.
- 写一个`derived`记录两个列表,Ghidra和 llvm-objdump的,解码相同的14个指令,并链接两者.
- 打开一个未知的`grade_label(105)`严重的`high`由于表表指数4是这样的`labels[4]`通过跑步来解决问题.
- 输出本书`export_bundle()`进口到新账中,证明每一个链都能验证.

成功意味着一个报告,其中每句话都引用了包中的一个ID和一个`unknown`要求已经消失了.

## 排名实验室

找到你构建的代码,然后写在`code/lab_answers.json`写数字作为数字或六字符串,例如`"0x40"`它们是JSON列表.

1. `t1`: 计算证据的证据ID为 rea-evidence-grade.json.
2. `t2`评级记录中的限制数量.
3. `t3`评级记录的关系_覆盖状态.
4. `t4`作为一个两个字符串的列表,
5. `t5`评级记录的主题的SHA-256

检查你的答案:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
npx tsx code/lab.ts
```

检查器从 计算出每一个预期值`code/main.py`它们在已完成的设备上.`PASS`现在`FAIL`或`TODO`只有五个任务都通过时,它才会出于0.`python3 code/lab.py my-answers.json`检查另一个文件.`code/tests/test_lab.py`证明检查员接受正确的答案,却拒绝错误的答案.

### 看它运行

其他[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off)机器将有四个托盘的证据账本存储:观察,导出,推断和未知. 这条链接打开运行,符号表被关闭,因此函数文件的名称和结束是未知的,开始文件是推断的.

## 教训艺术品

这一课产生了`outputs/skill-evidence-ledger.md`它告诉代理人如何将每一个发现作为记录,以信任,权威,限制和链接. 它告诉代理人如何将未知内容作为修订,`pass`现在`fail`现在`unknown`其他`unsupported`现在,我们要去.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

28项测试证明:

- 两者都`evidence_id`值,个人资料,以及两个快照`query_id`从内容中重新计算的值
- 改变路径将保持ID,改变限制将改变它
- 已被改的记录,不匹配的配置文件提供者,浮动和未知的enum值被拒绝
- 复制记录返回`duplicate`总体而言,
- 已记录的运行集团进口,有18个记录,没有悬挂的链接
- 无人可见的版本1开启,拒绝使用.`expected_revision`只有观察到的`controlled-replay`证据
- 编辑的修改打破了链条
- 推广拒绝推断,推导,空虚和无关的证据,并通过一致的运行
- 部分覆盖率是`unknown`一个不一致的路是`fail`
- 缓存按键,错过其他参数
- 缓存拒绝了被打破的个人资料版本,错误的目标,错误的格式版本和被调整的键
-  ELF读者同意`llvm-objdump`关于偏移,尺寸,字节和迁移,表表是这样的`1, 2, 3, 4, 4`
- 预测使用C分区,记录的运行与所有17个单输入要求一致
- 随着编译器的出现,直播播也同意

## 生产失败模式

| Failure | What the weak report says | What the ledger requires |
|---|---|---|
| Pseudocode read as behaviour | "grade returns 0 for failing scores" | an `execute_function` record for that input, or `unsupported` |
| Decompiler signature trusted | "percent_change returns 16 bytes" | the signature marked as the provider's inference with its `low` confidence |
| Empty list read as absence | "the function has no callers" | an `unknown` status, or a coverage field when the tool provides one |
| Path hashed into the id | "the record changed" after a copy | the semantic projection without `name` and `local_path` |
| Limitation dropped from a copy | a record that looks stronger than the source | id mismatch and rejection on import |
| Partial grid rounded up | "all scores from 90 pass" | `unknown` with `covered` 2 of 11 |
| Host run presented as the object's run | "the x86-64 object returned 25" | the host-build limitation carried on the claim |
| Unknown closed by a sentence | "resolved, see above" | a `verified` resolution with observed ids of the required authority |
| Stale revision overwritten | two analysts' edits collide | `revision-conflict` and a reread |
| Old snapshot replayed after a release | answers from a changed contract | `profile_mismatch` on import |
| Cache kept after a rename | a replay that hides a metadata write | invalidation before dispatch and a failed export |

## 运营规则

记录你读到的,你计算的,你希望的,作为三个字的记录.用一个身份证关闭一个未知的,永远不要用句子.只在保存的密钥下重复一个答案,并且拒绝它,当一个版本字符串不同时.

## 进一步阅读

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- 标签 `3b79af2`这一课描述了:`src/domain/evidence.ts`现在`.agents/skills/reverse-engineer-anything/SKILL.md`现在`docs/cli.md`现在`src/domain/reconstructionVerification.ts`现在`src/application/ReconstructionObligationCandidates.ts`现在`docs/tool-design.md`现在`src/domain/evidenceCompletionLedger.ts`现在`src/domain/residualUnknown.ts`现在`src/application/investigation/UnknownEvidence.ts`现在`.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`现在`src/application/binary/AnalysisSnapshotCache.ts`现在`src/domain/analysisSnapshot.ts`现在`src/application/binary/BinarySession.ts`现在`src/application/binary/BinarySessionRecords.ts`现在`docs/mcp-contracts.md`现在,我们要去.
