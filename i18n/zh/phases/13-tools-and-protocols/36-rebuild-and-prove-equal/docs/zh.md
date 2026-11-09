# 重建和证明等:差异测试,字节比较和证据循环

> 通过测试证明了您的测试一致,所以平等需要一个网格, 达到每个边缘和字节匹配后移动掩盖.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## 学习目标

- 写出从指令列表中重新构建的文件,并命名来自的证据记录.
- 构建一个输入网格,每个危险类别是零保护,负值,缩小分区,32位溢出,和分陷.
- 运行原始和重建的程序, 并记录每个细胞, 包括一个陷.
- 重新组建与原始旗,并在掩盖移动字段后比较函数字节.
- 读取一个转移点的常数并将它们比较,所以一个错误的字母不能通过.
- 驱动REA的MCP服务器从一个小的工作室客户端,记录每一步的证据ID.
- 造一个未能封闭的证据记录,其身份是其索赔和证据链接的哈希.

## 问题

你问了 rea 工作文件`percent_change`在我们的`ledger-x86_64-O1.o`基德拉12.1.4返回了伪代码,

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

通过四次测试:`(100, 150)`给出50个.`(200, 100)`给出 -50`(0, 5)`给出0`(50, 100)`经纪人也重新建造了.`grade`作为四个`if`报告说"经过了"的六次测试.

这份报告没有回答以下问题:

- 当原始回归时,`(after - before) * 100`没有32位的?
- 对于110分的结果,原始的回报是什么?
- 复制器的编译量与原始的16字节相同吗?
- 当两个编译函数具有相同的字节时,它们的移动点是相同的常数吗?
- 什么证据记录重建来自, 经纪人读到列表或伪码?
- 没有C编译器的主机上的证据是什么状态?

我们编写和编译的程序是这门课中的每一个目标.

```figure
re-36-prove-equal
```

## 证据所显示的

代理循环进入`code/main.py`通过工作室进行了6次电话,`code/fixtures/runs/agent-run.json`服务器回复了`initialize`具有协议版本`2025-11-25`据证据,有三次电话回来.

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

首先,我们为Ghidra进口和自动分析付费.`confidence: "observed"`现在`authority: "shipped-artifact"`标记: 标记:`9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`吉德拉将可转移的物体装载`.text`在`0x100000`现在,`percent_change`坐在`0x100000`其他`grade`在`0x100010`现在,我们要去.

伪代码为`percent_change`的位置`long`来自:

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{
  long lVar1;
  undefined1 auVar3 [16];
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  ...
}
```

解译器看到`cltd`其他`idivl`写下两个`edx`其他`eax`并且用64位分区来建模一个16字节的返回值.

```
0x100000: TEST EDI, EDI
0x100002: JZ 0x0010000d
0x100004: SUB ESI, EDI
0x100006: IMUL EAX, ESI, 0x64
0x100009: CDQ
0x10000a: IDIV EDI
0x10000c: RET
0x10000d: XOR EAX, EAX
0x10000f: RET
```

每个操作都宽32位.`IMUL EAX, ESI, 0x64`它们的数量在32位中乘以低半.`CDQ`标志延伸`eax`进入`edx`其他`IDIV EDI`根据此列表,在此列表中,`100 * (after - before) / before`在`int`现在,我们要去.

其他`grade`伪代码是表的名称,`*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`基于 `0x66666667`列表显示10的分数为`IMUL RAX, RAX, 0x66666667`现在`SAR RCX, 0x22`现在`SHR RAX, 0x3f`现在`ADD ECX, EAX`然后`ADD ECX, -0x6`现在`CMP ECX, 0x4`其他`JA`保持数十从6到10`XOR EAX, EAX`在比较之前,默认值为 0. `LEA RCX, [0x1000b4]`其他`MOV EAX, dword ptr [RCX + RAX*0x4]`阅读一个由5个4字节的表格.

步骤4读取这些20字节:`01000000 02000000 03000000 04000000 04000000`桌子是`1, 2, 3, 4, 4`十个,六,七,八,九,十.`switch`在`ledger.c`随着`case 10`其他`case 9`分享值4.

两种证据在REA自己的证据页面上都从列表中开始,`read_bytes`首先,DX-Ball的伪代码是`FUN_00406400(void)`没有堆输入,说明视图修正了它. 首先阅读列表. 引用记录 id,然后写C.

## 写候选人

文件`code/fixtures/candidates/`编译的方法是: 编译的方法是: 编写的方法是: 编写的方法是: 编写的方法是: 编写的方法是:

| File | Source | What it does |
|---|---|---|
| `percent_change_mul_first.c` | `100 * (after - before) / before` | the listing in C |
| `percent_change_split.c` | `(after * 100 - before * 100) / before` | different text, same bytes after clang folds it |
| `percent_change_wide.c` | `(int)(((long)after - before) * 100 / before)` | the pseudocode's `long`, divides before it wraps |
| `percent_change_div_first.c` | `(after - before) / before * 100` | divides first, so rounding differs |
| `grade_switch.c` | `switch (score / 10)` with the five cases | the original source |
| `grade_table.c` | `unsigned slot = score / 10 - 6; slot < 5 ? points[slot] : 0` | the listing in C |
| `grade_thresholds.c` | `if (score >= 90) return 4; ...` | no upper bound on the top band |
| `grade_case10_wrong.c` | `case 10: return 3;` | one table entry wrong |

每个文件都用固定命令编译,`clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`编译的对象是靠近源头的,所以测试在一个无声的主机上进行.

## 一个脚:执行和比较

麦克基曼1998年对差异测试的定义需要"两个或更多可比系统"提供"机械生成的测试案例",并将不同的结果,或崩作为错误候选人. 他命名了难题部分:"测试中最丑的问题是评估测试结果". 我们不需要知道正确的答案. 我们需要原始和重建的, 任何地方都不一致,

### 设计网格

`input_grid()`在`code/main.py`建立了92个细胞.`percent_change`需要每一对从十个`before`值和七`after`价值:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

为了`grade`需要22个分数:每个带边缘的两侧,负,0,110,和两个`int`限制`classify()`过度流有32个细胞,负17的边界 14,平12的边界,零的保护 7.负的切断有5,圆 2,超出交换器2,陷1.

每个类都有一个原因. 零的监护细胞检查了`TEST EDI, EDI`阴性细胞检查切割分区:C和 `idiv`圆向零,所以`-9 / 10`是0和`-10 / 10`圆的细胞检查乘法发生在分数之前,所以`(105 - 100) * 100 / 100`过度流量细胞产生`(after - before) * 100`子的子使包装的产品等于`INT_MIN`随着`before`值为 -1.

,陈,艾德和雷格尔构建了Csmith以生成没有未定义行为的程序.对未定义行为的预言意见是噪音,从来不是错误报告.签署的过度流程未定义在C中.我们的预言是一个具有固定行为的编译对象,因此过度流程细胞在范围内.教训是知道哪些细胞依赖标准,哪些依赖编译字节.

### 司机和陷

`code/driver.c`读取每行一个单元单元,然后打印输入,原始结果和重建结果. `build_harness()`编译候选人与`-Dpercent_change=cand_percent_change -Dgrade=cand_grade`在 x86-64 Linux 主机上,原始是固定对象本身.在任何其他主机上,它是`ledger.c`报告记录`original_kind: fixture-source`现在,我们要去.

司机安装一个`SIGFPE`处理器`sigsetjmp`其他`siglongjmp`为了`before = -1`其他`after = 536870911`差异是536870912和32位产品包裹到 -2147483648. 在x86-64, `idiv`配分量不适合32位 (Intel SDM卷 2,IDIV).处理器将其转换为记录值.`trap`现在,我们要去.

在AArch64上,`sdiv`现在,我们在一个手机上运行了64 Mac,这正是我们所记录的. Oracle取决于建筑,报告说哪个运行.

### 结果

`prove_behaviour(PLAUSIBLE)`建立了`long`十个天真案例通过. 电网失败在28个细胞:

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

所有26个`percent_change`漏的细胞是漏的细胞`|before| > 1`为了`before`值为1或−1,64位分数将缩小到包装值,因此这些细胞偶然一致.`grade`由于原始开关没有理由为十个11以上,`110 / 10`现在,我们要做什么?

`prove_behaviour(EQUAL)`建立`percent_change_mul_first.c`其他`grade_switch.c`所有92个细胞都同意.`percent_change_div_first.c`没有四个天真案例中的两个,这是手写的测试确实发现的唯一案例.

`oracle_disagreements()`检查了第二件事.`percent_change_model()`其他`grade_model()`列表中的Python模型,`wrap32()`对于32位乘法和`idiv32()`报告将模型与每个细胞的观察原始相比较.零分歧意味着模型和二进制符在每个细胞上一致.模型是衍生的证据,运行是观察的证据.报告将它们放在单独的领域.

## 第二步:重新编译和比较

网络上的行为是一个脚.第二脚问,是否复制,由同一个编译器和旗编译,产生相同的字节.DX-Ball项目报告了"63个匹配字节"的辅助器.TH04项目报告了2,139字节匹配.每个使用了自己的时期的编译器. rea本身不能这样做.它的 `compare_functions`线差提供者文本并附上"组装是不透明的提供者文本;迁移正常化不可用".

### 阅读对象

`ElfObject`在`code/main.py`读取一个 ELF64 可移动的对象`struct.unpack_from`它检查了魔力,64位级别,小数据,`e_machine`其他`e_type`然后它走行了部分标题,串表,`.symtab`现在,我们要做什么?`.rela`部分. 在固定器件中,`percent_change`开始于`.text`偏移 0 与尺寸 16 和 `grade`在`0x10`尺寸46个.`total`开始于`0x40`尺寸31号和`grade_label`在`0x60`尺寸为63.

它们的16个字节`percent_change`是`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`功能没有转移.`grade`没有一个: 抵消`0x26`在函数内部,类型`R_X86_64_PC32`标志`.rodata`加入`0x10`它属于7字节.`leaq`在抵消`0x23`它们的最后四个字节是移动场.

### 面具,然后比较记录

在RELA对象中,添加符在移动记录中存在,四个字节字节为零.`grade_switch.o`简单的字节比较通过,而两个转移命名不同的地方. `mask_relocations()`无论如何,两侧的场都会被零化,所以REL对象和Mach-O的方法都是相同的,其中的场面包含添加.

那么`prove_bytes()`根据偏移,类型和目标部分进行移动记录的比较.`.rodata+0x10`候选人说`.rodata-0x4`添加符不同于候选对象没有`labels.rel`换个添加符是不同的偏移,而不是不同的函数.

### 读取定位,移动点在

对于一个结束指令的PC相关领域,CPU添加下一个指令地址,所以目标是符号加加加加4.`.rodata+0x14`在候选人中,它是`.rodata+0x0`现在,我们要去.`read_table()`它们都能保持.`1, 2, 3, 4, 4`现在,我们要去.

五号是从列表中得到的:`CMP ECX, 0x4`随着`JA`允许0到4个指数,`[RCX + RAX*0x4]`每个索引读取4字节. `CLAIMS`在`code/main.py`记录这些形状的`grade`没有任何搬迁`percent_change`现在,我们要去.

由于 TH08 项目记录了一个错误,这一步骤存在.其较早的比较"将目标地址重播到指令的移动字段中,然后在不检查该地址的浮动字面数据的情况下比较指令字节. 来源 `0.0`因此,可能会与目标相对准确.`128.0`"" 修正审计了1548个浮动字面引用,并修改了12个. `grade_case10_wrong.c`它们的46个字节是原始的,其移动记录是相同的,其表是`1, 2, 3, 4, 3`只有不断的检查才能失败.

### 结果

| Candidate | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 vs 16 | equal | none | none | pass |
| `percent_change_split` | 16 vs 16 | equal | none | none | pass |
| `percent_change_wide` | 16 vs 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 vs 18 | size differs | none | none | fail |
| `grade_switch` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_table` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_thresholds` | 46 vs 39 | size differs | 1 vs 0 | none | fail |
| `grade_case10_wrong` | 46 vs 46 | equal | same shape | `1,2,3,4,4` vs `1,2,3,4,3` | fail |

两项结果值得再看一下.`percent_change_split.c`由于Clang处理签名过度作为未定义的和折叠的`after * 100 - before * 100`它们可以被乘以一个.`grade_table.c`编译器从一个数组指数和一个 `switch`字节匹配证明,这个编译器,用这些标志,从候选人中产生了相同的代码.

根据ReA的证据, 已有 1,825 字节的候选人, 具有正确的长度和 467 字节的不同.`wide`重建是26字节,因为`movslq`现在`imulq`现在`cqto`其他`idivq`列表告诉我们在编译之前的宽度.

## 代理超越现实

六五个 rea的MCP工具没有CLI命令,`verify_reconstruction`,这是其中一个.`McpStdioClient`在`code/main.py`只有一个客户能得到他们.`npx -y rea-agents@6.5.0 mcp`编写一个JSON-RPC请求每行到 stdin,并读取一个JSON对象每行从 stdout 在线程.`initialize`具有协议版本`2025-11-25`现在`notifications/initialized`现在`tools/call`默认的每次通话截止时间为330秒,同一个号码 rea允许Ghidra冷启动.

`agent_loop()`接下来,他会记录每一个电话:

```json
{
  "step": 2,
  "tool": "analyze_function",
  "arguments": {"procedure": "percent_change"},
  "seconds": 6.31,
  "is_error": false,
  "evidence_id": "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd",
  "confidence": "observed",
  "authority": "shipped-artifact",
  "limitations": ["Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.", "..."],
  "result_sha256": "..."
}
```

文件的密码和重建的列表是该装置的一部分.`table_address()`找到一个`LEA`其他 `grade`列出并给它提供`read_bytes`现在,我们要去.`open_binary`现在`get_evidence_bundle`其他`close_binary`没有返回证据记录,并以无码身份记录.

`run_agent(live=True)`什么时候`npx`现在在路上`GHIDRA_INSTALL_DIR`否则它会重新播放器件,并对STERR表示这样.`code/tests/fake_rea_server.py`是一个替代服务器,`tools/call`客户端和循环在每次测试中都会对抗它,没有安装的rea,ghidra或java.

###  rea的验证器可以说什么,不能说什么

没有什么可做.`verify_reconstruction`根据该要求的规定,通过是指通过的每项声明的要求;它不确定全球实施等效性.`compare_functions`行为指控比较了两个记录的过程捕获`compare_process_captures`当源记录不完整的通话覆盖时,`unknown`没有什么在 rea 中编译一个重建的函数或运行它在输入网上.

现金基金的义务账本预计将有证据记录`predicate_type: "rea.reconstruction-proof"`现在`operation: "verify_reconstruction_obligations"`现在`confidence: "observed"`其他`normalized_result.passed === true`没有任何公共现实工具都会发出这种信息.`build_proof()`在`code/main.py`的:

```json
{
  "predicate_type": "rea.reconstruction-proof",
  "operation": "verify_reconstruction_obligations",
  "confidence": "observed",
  "authority": "controlled-replay",
  "normalized_result": {
    "passed": true,
    "status": "pass",
    "claims": [
      {"claim_id": "percent_change.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "percent_change.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "grade.referenced-constants", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]}
    ]
  },
  "evidence_links": ["ev_e88b10dc...", "ev_67b6d3f9..."],
  "evidence_id": "ev_..."
}
```

身份证是`ev_`另外,没有ID的记录的SHA-256加上,`aggregate()`已关闭:`fail`赢了,然后`unknown`没有任何要求.`unknown`在没有C编译器的主机上,两个行为要求是`unknown`记录说`unknown`即使两个字节要求都过去了.`authority`是`controlled-replay`因为证据来自我们自己的手套,而不是仅仅是对象文件.

## 研究所说的

,拉夫和米辛斯基在2026年测量了八个解组系统, 通过了指标中的每项测试的候选人仍然对化输入不同. 总体的比例为4.9%,一个系统的比例高达13%. 在GitHub的300个库功能和287个基于CVE的功能中,最强的改进模型将Ghidra的构建率从75%提高到90%. 在同一函数上,行为匹配率从74%降至62%. 他们追溯到发明的田野,类型,通道和守护者,

我们的`percent_change_wide.c`假代码提供了一个`long`基德拉的假C通过了HumanEval-Decompile的20.12%. 基德拉的假C通过了HumanEval-Decompile的20.12%. 基德拉的假C通过了HumanEval-Decompile的20%.

根据DecompileBench的测量,在130个实用程序中测量了23,400个函数.

实地使用的三个证据是你可以建造的三个腿. 尼克斯和DREAM重新编译输出,并运行原始程序的测试. 麦克基曼和Csmith将生成的输入与原始的输入进行运行,而输入则保持在定义的行为中. 拉莫斯和恩格勒检查了两个C函数,具有有限的符号执行,这证明了所有探索的路径上等等,直到输入大小. 这一课建立了前两个. 第三个是实践实验室,在35课的证据账本中,当一个网格太小,不能信任.

## 建立它

运行标准图书馆带:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
```

随着Clang在路径上,演示组组合了两个候选对,并为每个组运行了92个细胞.它重新编译了8个候选人,重新播放了代理运行,并编译了证明记录.`unknown`现在,我们要去.

在 arm64 Mac 上预期的形状:

```json
{
  "host": "aarch64 Darwin",
  "originalKind": "fixture-source",
  "gridCells": 92,
  "plausible": {"naivePassed": true, "gridMismatches": 28, "oracleDisagreements": 0},
  "equal": {"naivePassed": true, "gridMismatches": 0, "oracleDisagreements": 0},
  "legTwo": {
    "percent_change_mul_first": {"status": "pass", "reasons": []},
    "percent_change_wide": {"status": "fail", "reasons": ["size 16 vs 26 bytes"]},
    "grade_case10_wrong": {"status": "fail", "reasons": ["referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"]}
  },
  "agentRun": {"mode": "replayed fixture", "server": {"name": "rea", "version": "6.5.0", "protocolVersion": "2025-11-25"}},
  "proof": {"status": "pass", "evidence_id": "ev_..."}
}
```

阅读`code/main.py`在此顺序:

1. `wrap32()`现在`c_div()`现在`idiv32()`两者`*_model()`函数包含列表中的整数语义.
2. `input_grid()`其他`classify()`建立和标记92个细胞.
3. `build_harness()`其他`execute()`编译一个程序从原始,重新命名的候选人,`driver.c`然后运行细胞.
4. `prove_behaviour()`返回第一步报告,其中包含不匹配和模型不一致.
5. `ElfObject`阅读标题,符号,`.rela`记录`mask_relocations()`其他`read_table()`准备比较.
6. `prove_bytes()`返回两腿报告,包含尺寸,隐藏范围,移动形状和表格.
7. `McpStdioClient`其他`agent_loop()`驱动动 rea,记录每一步.
8. `build_proof()`其他`aggregate()`没有收到的记录.

## 用它

为了证明一个新函数是等等的,重复这些步骤:

1. 带来`analyze_function`读取名单,然后读取伪代码.
2. 根据列表的操作宽度写下候选人.
3. 列出列表中的每一个乘法,加,减和分. 加入每个格格的输入,包裹每个格格的宽度.
4. 为了 `grade`减值后的6和4
5. 加入所有可以陷入目标的分数,并记录该架构运行了网格.
6. 两腿都跑,在状态之前阅读理由.
7. 让证据记录在候选人旁边.`evidence_links`告诉读者该索赔的记录是什么.

编译器更新后重复两条脚. 字节匹配是关于一个编译器的声明,其中有一组旗.

## 互动实验室

### 实验室A:模型和运行

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

运行:

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

第一个调用结果是 -133,包装产品分为 3. 第二个调用结果是 `'trap'`报告显示,有10个天真案例被通过,28个网格细胞失败.`report.oracle_disagreements`没有任何名单.

### 实验室B:读取对象

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

字节字节是`00000000`搬迁名称`.rodata`附加`0x10`现在,这张表是这样的.`[1, 2, 3, 4, 4]`现在,我们要去.

### 实验室C:打破一个常数

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

字节和记录相匹配,而表格则不.`grade_case10_wrong.c`所以`case 10`再次返回4,再用固定命令重新编译,然后看状态变为 `pass`现在,我们要去.

### 实验室D:驱动器 rea

装有6.5.0号和Ghidra12.1.4号的电气:

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
npx tsx code/main.ts --live
```

第一个`analyze_function`根据Ghidra的数据,在数据库中,使用了相同的数据,并将数据库的数据库输入到其他数据库中.

## 实践实验室

伸出两腿到`total`其他`grade_label`它们来自同一物体.

要求:

- 为了`total`构建一个数组,一个负数,一个元素,和一个结合32位的数组.
- 为了`grade_label`函数调用`grade`排列和读取`labels.rel`五个相对串的偏移表,`.rela.rodata`现在,我们要去.
- 添加一个`CLAIMS`报名`grade_label`设置两个转移和五个4字节的表格,并比较输入指向的字符串.
- 记录模型和运行的不同细胞,如果有的话,并从列表中解释每个细胞.
- 根据证据记录,每项函数每条要求增加一个,并保持总数的失败.

成功意味着证据记录列出了四个函数,每个索赔都包含了证据的身份,`grade_label`标签字符串不同时失败.

## 排名实验室

找到你构建的代码,然后写在`code/lab_answers.json`写数字作为数字或六字符串,例如`"0x40"`它们是JSON列表.

1. `t1`现在,我们可以看到一个小组的数据.
2. `t2`现在,我们可以在 x86_64 上看到:
3. `t3`标准: 标准:
4. `t4`: input_grid中的细胞数量().
5. `t5`电网电池的数量: x86_64模型陷入的电网电池数量.

检查你的答案:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
npx tsx code/lab.ts
```

检查器从 计算出每一个预期值`code/main.py`它们在已完成的设备上.`PASS`现在`FAIL`或`TODO`只有五个任务都通过时,它才会出于0.`python3 code/lab.py my-answers.json`检查另一个文件.`code/tests/test_lab.py`证明检查员接受正确的答案,却拒绝错误的答案.

### 看它运行

其他[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)机器以伪码结束,并将其作为推断:页面没有证明.

## 输出技能

这一课产生了`outputs/skill-rebuild-and-prove-equal.md`通过它将函数证据和一个候选人重建成双脚证据和证据记录. 技能需要在伪代码之前列出,一个格格子,每个危险类别,迁移掩盖加上一个常规检查,以及一个失败关闭的集体.

## 检查

运行演示和测试套件:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

通过35项测试证明:

- `c_div()`缩小到零,`wrap32()`接着两个的补充
- 模型给出 -133`(3, INT_MAX)`现在`trap`对于x86-64号的陷细胞和AArch64号的 -2147483648号
- 网格有92个细胞,每个危险类, 无明的案例避免每个硬类
- 电脑的电脑电脑,电脑电脑,电脑电脑电脑,电脑电脑电脑,电脑电脑电脑,电脑电脑电脑电脑,电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电脑电
- `percent_change`是16字节,没有转移,`grade`有一个`R_X86_64_PC32`在`0x26`
- 移动字段字节为零,并且在这个RELA对象中掩饰没有任何变化
- 所有8名承诺候选人都达到预期的地位,并记录了原因
- `grade_case10_wrong`通过隐藏字节,只能通过常量检查
- 记录的第一步跑显示了十个天真的通过,28个不匹配,零的模型不一致
- 通过编译器,两个对重建和重启,结果相同
- 经过SHA-256的任务,该任务目标是:`ev_`证据的每一步的身份证
- 其他`read_bytes`记录等于 ELF读者找到的表
- 客户端驱动了假服务器,记录了与真实运行相同的证据ID
- 服务器输入了错误结果
- `aggregate()`已关闭,证明 id 从其内容中重新计算

## 生产失败模式

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Rebuild keeps the decompiler's `long` | "ten tests pass" | 26 overflow cells differ from the original |
| Thresholds replace a switch | "every grade band passes" | 110 and larger return 0 in the original |
| Divide before multiply | "formula is algebraically equal" | rounding cells differ, naive cases fail |
| Trap cell skipped | "no crashes" | x86-64 raises `#DE`, AArch64 returns `INT_MIN`, the report names the host |
| Byte compare without masking | "bytes equal" | relocation records name different offsets |
| Masking without reading constants | "bytes equal after masking" | `1,2,3,4,3` differs from `1,2,3,4,4` |
| Size taken as acceptance | "same length" | differing bytes inside the same length |
| Different compiler or flags | "bytes differ, rebuild wrong" | the same source gives different bytes, so the compare is void |
| Model treated as observation | "model agrees" | the run is observed, the model is derived, disagreements are listed |
| Claim without evidence id | "verified" | every claim links an `ev_` record of the function it covers |
| No compiler on the CI host | "passed" | behaviour claims are `unknown` and the aggregate is `unknown` |
| Pseudocode read as source | "decompiler says long" | the listing shows `IMUL EAX`, `CDQ`, `IDIV EDI` |

## 运营规则

写出从列表中重建的记录,并命名它来自的记录. 运行它与原始的格格子,包裹每一个中间的,并穿越每一个比较常数. 再加上原始的旗,掩盖移动场,比较记录,并阅读它们指向的常数.记录每个索赔及其证据ID,让一个未经验证的索赔保持不知.

## 进一步阅读

- [McKeeman, Differential Testing for Software, Digital Technical Journal 10(1), 1998](https://www.cs.tufts.edu/comp/150FP/archive/bill-mckeeman/DifferentailTesting.pdf)
- [Yang, Chen, Eide, Regehr, Finding and Understanding Bugs in C Compilers, PLDI 2011](https://doi.org/10.1145/1993498.1993532)
- [Ramos, Engler, Practical, Low-Effort Equivalence Verification of Real Code, CAV 2011](https://doi.org/10.1007/978-3-642-22110-1_55)
- [Schwartz, Lee, Woo, Brumley, Native x86 Decompilation Using Semantics-Preserving Structural Analysis, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026](https://arxiv.org/abs/2609.05370)
- [Gao et al., DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Tan et al., LLM4Decompile, arXiv 2403.05286, 2024](https://arxiv.org/abs/2403.05286)
- [System V gABI, Chapter 4, Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)
- [x86-64 psABI repository, relocation types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV](https://developer.arm.com/documentation/ddi0487/latest)
- [rea 6.5.0 MCP contracts](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/mcp-contracts.md)
- [rea 6.5.0 reconstruction obligation ledgers](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/reconstruction-obligation-ledgers.md)
