# 逆向工程景观:历史,工具家族以及解构器的构建方式

> 五种工具读取相同的对象,给出四个地址,三个块数,

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, Java (one Ghidra script)
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~150 minutes

## 学习目标

- 按1973年至2026年时间表列出该领域的主要工具,并给每个工具的家庭命名.
- 列出一个解译器的八个阶段,以及Ghidra,二进制忍者,六射线,雷达,里津和安格用于每个阶段的术语.
- 举一个指示到ESIL,RzIL,P-代码和VEX,并解释其中哪些热情写旗,哪些存储一个.
- 减少五个工具的地址到一个`.text`对于一个函数,对比和证明减小.
- 构建一个比较链,读取捕获的工具输出,并报告指令启动,区块,边缘和函数启动的协议.
- 根据捕获的证据,每个工具发明代码,错过代码,或者在间接跳跃中停止.

## 问题

你要求一个代理总结三个逆向工程工具的说法`grade`在`ledger-x86_64-O1.o`经纪人运行每个工具,阅读三个列表,并报告该函数位于`0x08000050`在一个工具中,`0x400010`在另一个,`0x100010`结果是,工具在哪里不同意功能.

工具一致.对象可移动,没有载荷地址,所以每个工具选择一个.减去每个工具给出的地址`.text`每个答案都是`0x10`代理人比较了原始地址,因为没有什么告诉它每个工具中的地址意味着什么.

后来,同一个代理说`grade`在`-O0`构建和报告从四个工具的3,8,8和9个基本块.所有四个数字都是真实的. 一个工具停在`jmp rax`两个工具通过转移阅读跳板. 一个工具在跳板时分开一个块,以贴上标签.一个没有理由的块数是没有索赔的数字.

在你信任这些数字之前,你需要的地图是这个课程. 课32到36建立了一个解码器,一个升降器,一个证据记录,一个重建. 后半段将它们放在人们使用的工具旁边. 为了做到这一点,你需要该领域的历史,工具的家庭,每个解译器运行的管道,

```figure
re-37-field-map
```

## 五十三年时间已过

根据"进一步阅读"中,每一个日期都有一个主要来源.

### 1973至1991年:首先调试器,然后拆卸器

首先的解译论文是1973年,斯坦福大学的霍兰德和普尔杜大学的豪斯尔写下了它们,现在都通过引用来得到了解.当时的实际工具是调试器.`adb`果软件的开发,在1977年在贝尔实验室进行了教程,`DEBUG`软件在1987年将内核调试器放在DOS中.

随后,批量拆卸器出现.来自V通信的Sourcer在1988年运行了多个通过DOS程序并写了一份评论列表.GNU二维系统于1988年开始使用无数快照,并`objdump`伊尔法克·吉尔法诺夫于1991年1月撰写了IDA的第一行,并在1991年5月20日发布了IDA0.1作为分享软件.

### 1991年至2009年:互动拆卸器和首个拆卸器

1994年7月,她在QUT完成了"反复编译技术".`dcc`后者是REC,后者是1997年,而Boomerang在2002年,这是第一个开源解译器,在BSD许可下.

IDA于1996年成为DataRescue的商业产品,在1999年获得了插件SDK,并转移到2005年成立的Hex-Rays. 黑丝射线解压器 1.0 发射于2007年9月17日. 同年,迈克·范·埃默里克提交了"统一解译任务",这项论文使SSA成为解译器数据流的中心. 哈尔瓦尔·弗莱克的"可执行对象结构比较" (2004) 开始了不同家族,而BinDiff于2004年8月上市.

雷达尔于2006年2月作为一个64位偏移的法医六合编辑器开始.雷达尔2,在LGPL-3.0下的模块化重写,于2009年3月7日首次发布.

### 2009年至2019年:框架和中间代表

LLDB于2010年6月8日宣布成为LLVM子项目.BAP,其BIL中间语言的二进制分析平台,在CAV2011年3月1日出现在CAV.谷歌于2011年3月1日收购了BinDiff的制造商 zynamics.霍珀在2011年底左右出现在Mac App Store.Matt Godbolt于2012年启动了Compiler Explorer,以便C++程序员可以看到编译器制作的组件.

2013年8月,Angr获得了第一个代码行. 尼克斯论文 (Schwartz, Lee, Woo, Brumley, USENIX Security 2013) 显示了维护语义的结构,`goto`梦想 (Yakdan等, NDSS 2015) 删除了`goto`具有模式独立的结构化声明. 矢量35于2015年1月14日成立,二元忍者于2016年7月23日推出,其低级IL和Python API. 据悉,该公司在2016年8月获得了第三名的网络挑战赛. 果公司在2016年3月成为免费的. 切割器 1.0 在 2017 年 12 月给了 radare2 的 Qt GUI. 2018年,吉尔法诺夫在Recon展览上展示了"解编译器内部:微码",这是第一个公开描述黑色光线IR的描述.

### 2019年至2026年:开放解译器和研究转型

据悉,Ghidra 9.0 在2019年3月5日在 Apache 2.0 下在RSA会议上被NSA发布,一个月后在 GitHub上发布了完整的源头. 在8.19.2.4中,同年增加了初步解译器. 双色球忍者2.0于2020年5月20日发出了其高级IL解译器. 雷在2020年12月8日宣布成为雷达2的分叉,切割器团队转移到该领域. 在2021年5月,IDA Freeware 7.6增加了一个云x64解译器.

据悉,BinDiff 8在2023年9月25日在Apache-2.0下开源. SAILR (Basque等,USENIX Security 2024) 成为angr的默认结构化程序,并认为只有虚假的.`goto`由于Linux 6.1在源头中包含了3,754个版本,因此该声明应该被删除.二进制忍者4.0在2024年2月添加了免费版,而IDA9.0添加了`idalib`经过SLADe (2023) 通过LLM4Decompile (2024) 到DecompileBench (2025) 和2026年两项关于代理辅助可读性和更多回收和保存较少的解译器的研究.

这门课程运行的版本是2026年10月14日的最新版本:Ghidra 12.1.4 (2026年9月21日),Radar2 6.2.4 (2026年10月5日),Rizin 0.9.1 (2026年6月29日) 和Angr 10.0.3 (2026年10月10日).二进制忍者6.0"克里普顿" (2026年9月3日) 和IDA 9.4 (2026年7月13日) 是目前的关闭工具.本课程没有运行它们.

## 工具家庭

一个工具是属于一个家庭的,因为它所产生的东西.

### 拆卸器

线性扫描从代码部分的第一个字节到最后一个字节.`objdump -d`其他`llvm-objdump -d`它们都不会构建一个控制流程图.`objdump`双通用程序 2.47 (26 年 7 月 26 日) 是 GPL-3.0 或更晚版本.LLVM 23.1.3 是 Apache-2.0 含有LLVM 异常.果命令线工具运行`llvm-objdump`这就是这本课程所捕获的副本.

互动拆卸器从已知输入中进行递归下降,为函数启动添加了测量系统,并保存了一个数据库.`Disassembler`另外,还包括自动分析分析仪,二进制忍者 (反复下降,然后在未知的区域上扫描线性),霍普尔,雷达尔2和里津 (`aa`现在`aaa`现在`af`), 卡特和IAito作为GUI,都属于这个家庭.安德里斯和其他人 (USENIX Security 2016) 在编译器生成的二进制中测量了其中的九个. 指示精度接近100%,硬原始是函数启动,虚假负率为20%或更高.

### 除器

商业解译器:Hex-Rays Decompiler (从x86到RISC-V的12个目标家庭),二进制忍者HLIL与其Pseudo C染,以及霍珀的伪代码视图. 开放式解译器:Ghidra解译器, Apache-2.0下的C++引擎,r2ghidra和rz-ghidra将其重复作为插件,以及pypcode重复作为升级器;在AIL上使用SAILR结构的AIL解译器,在BSD-2-Clause下;JavaScript中的r2dec和 jsdec;Boomerang和`dcc`作为历史. 雷达2也有一个内置的`pdc`里津没有内置的解译器.`pdc`没有在rizin 0.9.1中存在,`pdg`需要Rz-ghidra插件.

### 调试器

通过GDB (1986) 进行GEF和 pwndbg前端,LLDB (2010),WinDbg与时间旅行调试 (2017),OllyDbg (在2014年被结),x64dbg (GPL-3.0, 2014),Ghidra Debugger与其Python连接器,二进制忍者调试器以及Radar2和Rizin的内置调试器.42课时使用两个在自己的构建中.

### 双边分析框架

标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行, 标志性执行`CFGFast`其他`CFGEmulated`亚德里斯 (Andriesse) 命名的框架是BAP (BIL,OCaml),Dyninst,Jakstab和ByteWeight.`import binaryninja`通过了`idalib`现在,我们要去.

### 格式和引擎库

利夫1.0.0 (12月2026年7月12日,Apache-2.0) 解析ELF,PE,Mach-O,COFF和Android格式.CLE,"CLE Loads Everything",是Angr的加载器.Capstone 5.0.9 (28月2026年,BSD-3-Clause) 解码;Keystone 0.9.2 (GPL-2.0) 组件;Unicorn 2.1.4 (GPL-2.0) 模拟器.radar2 6.2.4 捆绑Capstone 5,和rizin 0.9.1 供应商Capstone,Zydis和树守.

### 除工具和编译器侧观看器

果版 8.0 (Apache-2.0) 与其BinExport 12插件用于IDA Pro,二元忍者和Ghidra; 果版 3.4.3 (2026年10月11日,AGPL-3.0) 作为IDA插件;`radiff2`其他`rz-diff`编译器探险器 (BSD-2-条款) 显示了编译器为源段发射的组件,这是该列表中的其他所有内容的前进方向. 第44课使用了不同家族.

### 版本,许可证,以及本课程的内容

| Tool | Version read on 2026-10-14 | Licence | Headless entry | Ran here |
|---|---|---|---|---|
| Ghidra | 12.1.4 | Apache-2.0 | `analyzeHeadless`, `pyghidra.start()` | yes, on all four objects |
| radare2 | 6.2.4 | LGPL-3.0 | `r2 -qc '<cmds>' file`, `rabin2` | yes |
| rizin | 0.9.1 | LGPL-3.0 | `rizin -qc '<cmds>' file`, `rz-bin` | yes |
| angr | 10.0.3 | BSD-2-Clause | `angr.Project` in Python | yes |
| llvm-objdump | Apple LLVM 17.0.0 | Apache-2.0 with LLVM exception | `llvm-objdump -d -r` | yes |
| Binary Ninja | 6.0 "Krypton" | commercial; Free edition for non-commercial use | `binaryninja.load()` with a Commercial, Ultimate, or headless licence | no, documentation only |
| IDA Pro | 9.4 | commercial subscription; IDA Free for non-commercial x86 and x86-64 | `idat`, `ida -A -S`, `idalib` | no, documentation only |
| Hopper | 6.6.0 | commercial, perpetual | none documented | no, documentation only |
| Cutter | 2.5.0 | GPL-3.0 | GUI over rizin | no |

免费版的二元忍者解译x86,x86-64,ARMv7和AArch64仅没有API.`idalib`它们的文件和发布说明,并且图标标记着它们没有运行.

## 逐步完成"解构器管道"

1994年,Cifuentes命名了这些阶段:语法分析,语义分析,中间代码生成,控制流图生成,数据流分析,控制流分析和代码生成. 她把它们分成一个机器依赖的前端,一个机器和语言独立的中间, 之后,每一个解译器都保持了这种形状, 下面的表列出了本课程使用的八个阶段,以及每个工具所给出的名称. 图表显示相同的表格,可选择工具列.

| Stage | Ghidra | Binary Ninja | Hex-Rays / IDA | radare2 | rizin | angr |
|---|---|---|---|---|---|---|
| Loader | `ElfLoader`, `MachoLoader`, `PeLoader`; `.ldefs` picks the language | `BinaryView`, `BinaryViewType` | loader module (`LDSC`) | RBin (`rabin2`) | RzBin (`rz-bin`) | CLE (`cle.Loader`, `main_object`) |
| Disassembly | `Disassembler`; SLEIGH `.slaspec` compiled to `.sla`; analyzers "Disassemble Entry Points", "Function Start Search" | architecture plugin; Recursive Descent, then linear sweep phases | processor module (`ana.cpp`, `emu.cpp`, `out.cpp`); autoanalysis queues; FLIRT | RArch plugin to `RAnalOp`; `aa`, `aaa`, `af` | RzAnalysis plugin; `aa`, `aaa`, `af` | Capstone blocks; `CFGFast` function start search |
| CFG recovery | "Generate Basic Blocks and the CFG"; `BlockGraph`; "Decompiler Switch Analysis" | `Function`, `BasicBlock`; "Control Flow Graph (CFG) Analysis" phase | `mbl_graph_t`, ready at `MMAT_LOCOPT` | `afb`, `agf`, `aab` | `afb`, `agf`, `aab` (Nucleus) | `CFGFast`, `CFGEmulated`; `kb.functions`; IRSB |
| Lifting | "Generate Raw P-code"; Varnodes in `ram`, `register`, `const`, `unique` | Lifted IL, LLIL, Mapped MLIL, MLIL | microcode (`minsn_t`, `mop_t`); `MMAT_GENERATED` | ESIL (`asm.esil`, `ae`) | RzIL (`aoi`, `aez`) | VEX (`pyvex.lift`, IRSB), then AIL |
| SSA | `Heritage`, `ActionHeritage`; `MULTIEQUAL`, `INDIRECT` | LLIL SSA, MLIL SSA, HLIL SSA; `HLIL_VAR_PHI` | no named SSA; use-def data flow in `MMAT_GLBOPT1` to `3` | none; ESIL is built for emulation | none; RzIL is built for emulation | `_stage_transform_to_ssa_level0` and `level1`; `SeqNodeDephication` |
| Data flow and types | `ActionDeadCode`, `ActionInferTypes`, the `Rule` pool; prototype from `.cspec` | MLIL constant propagation, variables and types; `analyzeReturns` | "Transform microcode"; `MMAT_CALLS`, `MMAT_GLBOPT`, `MMAT_LVARS`; TIL | `afv`, `afc`, `aaft`; ESIL emulation | `afv`, `afc`, `aft` | `CallingConventionAnalysis`, `VariableRecoveryFast`, `Typehoon` |
| Structuring | `CollapseStructure`; `BlockIf`, `BlockWhileDo`, `BlockSwitch`, `BlockGoto` | `HLIL_IF`, `HLIL_WHILE`, `HLIL_SWITCH`; AST at `root` | "Generate ctree"; structural analysis; goto regions | `pdc`; `pdd` (r2dec); `pdg` (r2ghidra) | `pdg` (rz-ghidra); jsdec | `RegionIdentifier`; `RecursiveStructurer` with `SAILRStructurer` |
| Emission | "Emit Final C Tokens"; `PrintC`, `ActionNameVars`, `ActionSetCasts` | HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python | "Beautify ctree; Print ctree"; `cfunc_t` | text of `pdc`, `pdd`, `pdg` | `pdg` text | `CStructuredCodeGenerator`; `codegen.text` |

### 装载器

载体分析容器,绘图部分,阅读符号和转移.在可转移的对象中,没有任何东西还没有地址,所以载体选择一个.`0x08000000`现在,我们需要一个`.text`在`0x08000040`因为该节点开始于文件的偏移`0x40`升级级`.text`在`0x400000`吉德拉的`ElfLoader`设置在`0x100000`现在,我们要去.`llvm-objdump`印记部分偏移,根本没有基础.

运载器也在转移方面不同.Ghidra在进口时处理它们,CLE则应用它们.Radar2在打开对象时打印一个提示:转移没有应用,`bin.relocs.apply=true`运载器在搬迁过程中所做的决定了每一个后期阶段都能看到的东西,`-O0`跳下桌子.

### 拆除

课33构建了两种方法.`llvm-objdump`运行递归下降,然后添加一个搜索函数开始. 双色球忍者文档列出了这些阶段的顺序:回归下降,呼叫目标分析,CFG分析作为"未知的区域的线性拆除",和尾声呼叫分析. 基德拉按优先级运行其分析器, "拆除入口点"和"开始搜索功能"早期. 根据图书馆编码的规格, 的`CFGFast`文件的函数开始的来源是四个:符号,前标扫描,呼叫目标和剩余字节的完整扫描.

### 气气体回收

每个工具都像第33课一样切断了块,只有一种差异,你会测量.`call`由于它的IRSB是一个单入口,多出口区块,而一个通话是出口.`grade_label`在`-O0`现在,我们需要一个`grade`报告2个块,其他3个报告1个.

### 升起

双色球忍者定义升级为"从较低水平语言翻译到被认为更高的中间语言". IR 对于其用途不同.P-代码和VEX 构建用于分析和分解.ESIL 和RzIL 构建用于模拟,而两个都没有SSA 阶段.`MMAT_GENERATED`为了`MMAT_LVARS`双色球忍者将其升级到升级IL,然后将旗折叠成LLIL的条件,MLIL"将注册表和存储访问量转化为变量".下一节将四个 IR放在一个指令上.

### 美国国家安全局

范·埃默里克的论文列出了SSA购买解译器的内容:表达式传播,参数和返回识别,没有ABI假设,保存分析,类型分析作为稀疏的数据流问题,以及间接跳跃和调用的分析.`Heritage`并且将两个只有图中存在的操作添加到`MULTIEQUAL`对于 phi 和 `INDIRECT`双色忍者在每一个IL级别都暴露出一个SSA形式.`Clinic`六射线不指定SSA表格,并且在全球优化通行中使用定义数据流.

### 数据流量和类型

吉德拉的主要简化循环运行"消除死代码","传播本地类型"和"执行术语重写"直到没有任何变化,重写由一个池的`Rule`六射线转换微码,检测到电话参数`MMAT_CALLS`区分在 `MMAT_LVARS`的运行`CallingConventionAnalysis`现在`VariableRecoveryFast`其他`Typehoon`现在我们要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么,我们需要学到什么.

### 结构化

吉德拉的`CollapseStructure`通过搜索与结构相匹配的子图,将它们分解成一个节点,当它卡住时,将边缘移除并标记它为不结构化的.`if`现在`while`现在`do`其他`switch`其他区域则将其作为 goto区域.`SAILRStructurer`默认情况下,`PhoenixStructurer`其他`DreamStructurer`课34是一个结构师手写的.

### 排放

吉德拉通过发射C代码`PrintC`之后,我用了Oppen的漂亮打印机.`ActionNameVars`其他`ActionSetCasts`双色忍者将HLIL转化为Pseudo C,Pseudo Rust或Pseudo Python.`codegen.text`雷达指纹`pdc`现在`pdd`其他`pdg`现在,我们要去.

## 在四个 IR 中,一个指示

接下来`48 83 ec 10`现在`subq $0x10, %rsp`通过第33课的规则,将它解写在纸上.

1. `48`是 REX 配合`W = 1`剧情是64位.
2. `83`是组-1的算术opcode,具有8位即时.ModRMreg字段选择了操作.
3. `ec`是ModRM`11 101 100`现在,我们要去.`mod = 11`是注册表.`reg = 101`是`/5`现在,`sub`现在,我们要去.`r/m = 100`是`%rsp`现在,我们要去.
4. `10`现在的时间是16

电灯上包含了准确的命令和全文.

雷达2 6.2.4 的 ESIL 是一个由逗号分离的30个代币串:

```text
16,0x8000000000000000,-,!,16,rsp,-=,63,$o,^,of,:=,63,$s,sf,:=,$z,zf,:=,$p,pf,:=,64,$b,cf,:=,4,$b,af,:=
```

这是一个堆机.`16,rsp,-=`之后,每一条旗都用内部运算符写成: `$o`水过剩`$s`标签`$z`没有任何其他方法`$p`平等`$b`借钱.

 0. 9. 1 的RzIL 是一个 S 表达式,含有 14 `set`影响:

```text
(seq (set op1 (var rsp)) (set op2 (bv 64 0x10)) (set sub (- (var op1) (var op2))) (set rsp (var sub))
     (set _result (var sub)) (set pf (! (lsb (let _val (cast 8 false (var _result)) ...))))
     (set zf (is_zero (var _result))) (set sf (msb (var _result))) ... (set cf (|| ...)) (set of (|| ...)) (set af (|| ...)))
```

每个旗都是比特向量的布尔式表达.`let`现在,我们要去.

来自SLEIGH规格的P码`x86:LE:64:default`通过pypcode 4.0.1 经过9次操作`IMARK`其他:

```text
CF = RSP < 0x10
OF = sborrow(RSP, 0x10)
RSP = RSP - 0x10
SF = RSP s< 0x0
ZF = RSP == 0x0
unique[58300:8] = RSP & 0xff
unique[58400:1] = popcount(unique[58300:8])
unique[58500:1] = unique[58400:1] & 0x1
PF = unique[58500:1] == 0x0
```

记录转账与临时人`unique`根据指示, 热切地计算旗,`CF`其他`OF`在减值覆盖之前计算.`RSP`现在,我们要去.

 pyvex 10.0.3 的VEX是7个声明后的`IMark`其他:

```text
t2 = GET:I64(offset=48)
t0 = Sub64(t2,0x0000000000000010)
PUT(offset=144) = 0x0000000000000008
PUT(offset=152) = t2
PUT(offset=160) = 0x0000000000000010
PUT(offset=168) = 0x0000000000000000
PUT(offset=48) = t0
```

没有标志显示.VEX名字按其在客国的偏移进行注册,偏移48是`rsp`补偿144至168是`cc_op`现在`cc_dep1`现在`cc_dep2`其他`cc_ndep`升降器存储了操作代码8,即64位减算,以及两个操作数.一个后续读取旗的分支计算它从子中.`pcode.writesFlags`是真的,`vex.computesFlags`带报告中是错误的,

起飞机的四个机器.`48 63 c7`现在`movslq %edi, %rax`首先,我们要做什么?`grade`在`-O1`提供5个ESIL代币 (`32,edi,~,rax,=`), 1 RzIL `set`子 (`RAX = sext(EDI)`没有升降者写旗,因为指令没有. 吉德拉自己的指令列表,通过无头字体捕获,打印相同的操作.`(register, 0x0, 8) INT_SEXT (register, 0x38, 4)`: 登记权限 0 `RAX`抵消`0x38`是`RDI`它们的尺寸是8和4字节.

`83 f9 04`现在`cmpl $0x4, %ecx`根据" 检查"的规定`grade`提供30个ESIL代币,13个RzIL`set`果,10个P码操作,7个VEX声明`cc_op`没有什么写的.`%ecx`两个减值宽度,你会遇到的VEX是7为32位和8为64位,你构建的翻译载有这个表.

## 单个函数的四个地址基地

在连接器能够比较任何东西之前,它必须与自己一致地确定函数所在地.`grade`在`ledger-x86_64-O1.o`现在,我们要去.

| Tool | Address of `.text` | Address of `grade` | Offset |
|---|---|---|---|
| `llvm-objdump` | `0x0` | `0x10` | `0x10 - 0x0 = 0x10` |
| radare2, rizin | `0x08000040` | `0x08000050` | `0x08000050 - 0x08000040 = 0x10` |
| angr | `0x400000` | `0x400010` | `0x400010 - 0x400000 = 0x10` |
| Ghidra | `0x100000` | `0x100010` | `0x100010 - 0x100000 = 0x10` |

符号表表示`grade`现在`.text + 0x10`带从每一次捕获中读取了底部:`iSj`在雷达2和里津中,`.text`捕获的部分入口,`.text`记忆区块在Ghidra捕获,和扫描零.`test_every_tool_places_grade_at_offset_0x10_from_its_own_base`解决了这一点.

## 工具的一致性和分歧

带里面`code/main.py`检测结果显示,每一个数据都显示出了数量.

### 协议案例: -O1的账本

每个工具都报告每一个函数开始的相同指示: 9, 14, 13 和 18. 四个图形构造器报告 3, 3, 5 和 4 块和 2, 3, 5 和 4 边缘,边缘集是相同的,对对对,在雷达2,里津,安格和吉德拉.`total`课33是手绘的.

只有料的不同.`66 90`之后`grade`现在`90`之后`total`) 通过扫描,没有理由停止,以及通过愤怒,`sub_40003e`其他`sub_40005f`雷达尔2,里津和吉德拉都没有说任何一个.

### 矢量化案例: -O2的账本

`total`在每一个四个图形构造器中,有10个块和13个边缘的41个指示.SSE2循环和33课中的 skalar剩余循环在各处都被切断相同.

### 跳跃表: -O0级

这里工具分开,分开就是教训.

| Tool | Blocks | Edges | What the capture says |
|---|---|---|---|
| radare2 | 3 | 2 | the block at `0x62` has no successor; bytes `0x76` to `0x9a` are never reached; 8 instruction starts missing |
| rizin | 8 | 11 | the block at `0x62` carries a `switch_op` with 5 cases and 4 distinct targets |
| angr | 8 | 7 | the case blocks exist, and the transfer at `0x62` goes to an unresolvable target node |
| Ghidra | 9 | 12 | `switchD` label at `0x74` splits the block; four `COMPUTED_JUMP` flows to `0x76`, `0x7f`, `0x88`, `0x91` |

雷达2停在位上.`jmp rax`里津和吉德拉发现了33课中读到的四个不同的目标.`.rela.rodata`格列出了内部的案例块`grade`它们的捕获记录了转移的时间.`0x62`由于它导致了一个无法解决的目标节点,`goto`由于其开关分析将标签放在片上,Ghidra 具有比里津多的一个块和一个边缘,`jmp rax`区块模型在标签上开始一个新的区块.

课-33图表有8个块和11个边缘. 里津完全匹配它. 问题是, 9 和 11 和 7 和 2 并不是4个测量代码.它们是四个答案,一个工具跟随一个间接跳跃的距离和它选择的切割.

### 编码中的数据:扫描陷

`lookup`是24字节,其中的4个表字节`31 c0 90 48`在`0x10`带列出其与大多数不同:额外的开始在`0x10`现在`0x12`其他`0x13`没有开始`0x14`这就是`addq $0x1, %rax`雷达2,里津和吉德拉报告6开始,2块,1边,然后离开`0x10`为了`0x14`报道相同的2块和1边缘`lookup`然后发明了`sub_400010`在表中字节:在一个4字节块中,结束的2个指令`0x14`两个区块的`lookup`开始,所以REX字节在`0x13`对于这个对象,带的最后发现是没有图形构建器解码`0x10`为了`0x14`它们是数据.

### 通过工具发明和错过

连接器在四个物体中命名了9个没有符号的函数,每个都在填充或陷桌上. 它命名了一个雷达2错过的范围,是 36 个字节的`grade`在`-O0`它命名了9个范围,直线扫描解码,没有图表构造商处理为代码:八个填充空白加上陷表. 它没有在任何工具中错过的函数.

## 排列三的解散器

截获的三种工具中,有C类文字发射.`grade`在`-O1`来源是`switch (score / 10)`根据限制检查和返回值表编制的五个案例.

子 12.1.4:

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

其他:

```c
extern unsigned int g_4000b4[4];

unsigned int grade(int a0)
{
    unsigned int v1;  // ecx
    unsigned int v2;  // eax

    v1 = (unsigned int)((long long)(a0 * 1717986919) >> 0x22) + (unsigned int)(a0 * 1717986919 >> 63) - 6;
    v2 = 0;
    if (v1 <= 4)
        v2 = g_4000b4[v1];
    return v2;
}
```

雷达2 6.2.4`pdc`其他:

```c
void sym.grade (int64_t arg1) {
    rax = edi
    rax = rax * 0x66666667
    rcx = rax
    rcx >>= 0x22
    rax >>>= 0x3f
    ecx += eax
    ecx += 0xfffffffa
    eax = 0
    v = ecx - 4
    if (((unsigned) v) <= 0) {
        eax = ecx
        rcx = rip
        eax = dword [rcx + rax*4]
    }
    return
}
```

基德拉的重写术语将乘以`0x66666667`现在,我们已经开始了.`param_1 / 10`升了相同的字节,然后离开了算数.`a0 * 1717986919 >> 0x22`雷达2的`pdc`是ESIL模拟加上伪语法:注册名字,没有变量,没有类型,并且印有限制检查`<= 0`格里达打字通过表载荷.`DAT_001000b4`已宣布`g_4000b4[4]`由于Ghidra和Angr没有恢复了案件的数量,因为在`-O1`字节中没有开关.`-O0`起桌子存在的地方,Ghidra打印了`switch(param_1 / 10)`根据标准,在6到10个案例中,`goto`现在,我们要去.

里辛没有自己的解译器,`pdc`双色球忍者HLIL和六射线树是这门课无法捕捉的两个输出.

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
```

输出是一个JSON报告. 机器的工具可能都没有. 然后给每一个四个对象的符号扩展,填充空隙,每个工具的基础,每个工具的函数启动,每个工具的指令-启动协议,区块数,边缘数,每个工具缺少的边缘. 结尾是每个工具的字节计数,工具的笔记,简单句子中的发现列表,以及IR部分:翻译器对捕获的电梯上测量的数量旁边的三个指示输出.

预期的形状:

```json
{
  "captureTools": {"llvm-objdump": "Apple LLVM version 17.0.0", "radare2": "radare2 6.2.4 ...", "rizin": "rizin 0.9.1 ...", "angr": "10.0.3", "ghidra": "12.1.4"},
  "localTools": {"radare2": "absent", "...": "..."},
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "bases": {"llvm-objdump": "0x0", "radare2": "0x8000040", "angr": "0x400000", "ghidra": "0x100000", "...": "..."},
      "functions": {"grade": {"blocks": {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9}, "edges": {"radare2": 2, "rizin": 11, "angr": 7, "ghidra": 12}, "...": "..."}},
      "findings": ["radare2 never reaches bytes 0x76-0x9a inside grade that the other graph builders decode", "..."]
    }
  },
  "ir": {"translator": [{"text": "subq $0x10, %rsp", "flags": {"pcodeLike": "eager", "vexLike": "thunk"}, "...": "..."}], "observed": {"...": "..."}}
}
```

阅读`code/main.py`在此顺序:

1. `read_text_symbols()`阅读部分标题和 `STT_FUNC`标志`.text`标志表是带唯一的基础真理,`TextSection.gaps()`料的料来源于它.
2. `parse_objdump()`现在`parse_r2_family()`现在`parse_angr()`其他`parse_ghidra()`每个换一个捕获成一个`ToolView`根据一个指令,`FunctionView`每个解析器都知道一个工具的词汇,而别的没有.
3. `majority()`其他`ranges()`这两个助手,每个比喻都能用来做.
4. `function_report()`将指令开始与大多数图形构建器进行比较,然后计算区块,然后设置边缘,并列出每个工具缺乏什么.
5. `byte_report()`包含每个字节作为符号内代码,填充,未被要求,发明或错过,并命名任何图形构造商都无法解码的符号内字节.
6. `findings()`转化为句子,`compare()`组装每项报告.
7. `decode_small()`现在`to_pcode_like()`其他`to_vex_like()`译者:三种编码,一个热情的风格,一个曲的风格.
8. `observed_ir()`测量被捕获的电梯,`figure_data()`时光线,舞台表以及图所示的证据.

现在还有三个命令.`python3 code/main.py compare FIXTURE.o`打印一个物体的报告.`python3 code/main.py ir 4883ec10`印出翻译的两份表格,以提供一项指令. `python3 code/main.py figure-data`打印了图中嵌入的数据.

捕获者曾经被捕获`code/fixtures/capture_tools.py`记录了每一个命令和版本`captures.json`如果您有工具,请运行捕获脚本来更新文件,并阅读README的设置,以满足其需要的环境.

## 用它

按此顺序使用新物件.

1. 在打开工具之前,请阅读其符号表,以便知道有多少函数,以及填充器的位置.
2. 记录每一个工具一次在无头模式下. 存储原始输出和对象旁边的准确命令. 不一致不能重新阅读不是发现.
3. 检查基. 选择一个函数,并确认每一个工具在减去它的后,将其放在相同的偏移.`.text`如果没有,就停下来查看该工具是什么.
4. 如果图表构造者在这里不同意,则其余的比较是关于解码而不是关于分析.
5. 根据一个数值,你可以比较块和边缘,`switch_op`其他`COMPUTED_JUMP`它们的目标节点是无法解决的,
6. 字节的计算. 打字表示工具是工作中的学. 字符字节表示工具离开的字节是停止步行. 字符字节表示图构造商没有数据.
7. 您没有运行的工具,请写下. 文件描述是有用的,并且与捕获不同.

## 互动实验室

### 实验室A:一个函数,四个基

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/code
python3 -q
```

运行:

```python
from main import *
views = load_views("ledger-x86_64-O1.o")
{tool: hex(view.base) for tool, view in views.items()}
{tool: hex(view.functions["grade"].start + view.base) for tool, view in views.items()}
```

在运行第二行之前,写下四个原始地址,然后与本课中的表进行检查.`grade`随着`grade_label`然后手动计算它在吉德拉的位置.

### 实验室B:从四边跳跃桌子

```python
report = compare("ledger-x86_64-O0.o")
report["functions"]["grade"]["blocks"]
report["functions"]["grade"]["edgesMissingPerTool"]["radare2"]
report["notes"]["rizin"]
report["notes"]["ghidra"]
report["bytes"]["radare2"]["misses"]
```

计算缺少的边缘,并将每一个边缘与一个线相匹配.`-O0`然后读一下Ghidra的笔记,`switchD`在Ghidra捕获中的标签.

### 实验室C:热情地击子

```python
translate("48 83 ec 10")["pcodeLike"]
translate("48 83 ec 10")["vexLike"]
translate("83 f9 04")["vexLike"]
{row["name"]: (row["pcode"]["ops"], row["vex"]["statements"]) for row in observed_ir()["instructions"]}
```

找一个`cc_op`结果的结果是8和7的.`translate("48 01 c8")`阅读`TranslateError`现在,我们要去.

### 实验室D:五种工具下的陷

```python
report = compare("sweep-trap.o")
report["functions"]["lookup"]["instructionStarts"]
report["bytes"]["dataInsideSymbols"]
report["functionStarts"]["angr"]
```

解码字节`31 c0 90 48 83 c0 01`在纸上,像扫描一样,然后,像下降一样,`jmp`匹配你的两个列表和额外的, 失踪开始了带报告.

## 实践实验室

加入第五个捕获,延长带.

要求:

- 选择一个工具,这个课程没有捕捉到,`objdump`通过手动导出二元忍者免费会议,或使用不同的分析器组的Ghidra.`captures.json`现在,我们要去.
- 写一个解析器将捕获转换为`ToolView`工具的基础,指令,功能,工具在哪里设置的区块,边缘在哪里设置.
- 添加工具到`TOOLS`如果它构建图表,`DESCENT_TOOLS`播放演示,阅读大多数组的变化.
- 写一个测试,证明工具的块计算.`ledger-x86_64-O1.o`测试证明它对陷桌子做了什么.
- 写一段落,以工具自己的话来说明它所说的装载器,拆卸器和CFG.

成功意味着`python3 code/main.py`报告新工具`captureTools`任何函数都在`ledger-x86_64-O1.o`保持`allDescentToolsAgree`对于这些问题,`sweep-trap.o`告诉我们新工具对字节的使用方法`0x10`为了`0x14`现在,我们要去.

## 教训艺术品

这一课包括`outputs/skill-the-reverse-engineering-landscape.md`通过它,在您构建的一个对象上运行多个工具,将它们的地址缩小到一个基础,并根据函数报告,它们同意指令启动,区块和边缘,以及每个工具发明或错过的字节.它需要记录的命令和版本,从文件中读取符号表,以及只根据文档描述的工具的声明.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

验证应证明:

- 电脑的电脑系统中,`ledger-x86_64-O1.o`尺寸 16, 46, 31 和 63 尺寸,两个填充空隙
- 扫描捕获物件第86,第56,第84和第11条指令
- 雷达2和里津报告相同的指示,块和边缘`ledger-x86_64-O1.o`只有雷达2才有`pdc`文本
- 色标志`sub_40003e`其他`sub_40005f`作为没有符号的函数
- 吉德拉的块为`total`课程33的五个块,其调用流量不是图边
- 每个工具都在`grade`在抵消`0x10`根部被移除后
- 每个工具都同意每一个指令开始,`ledger-x86_64-O1.o`
- 图形构造器的四个图形构造器报告了 3, 3, 5, 4 块和 2, 3, 5, 4 边缘,边缘组相同
- `total`在`-O2`每个图形构造器都有10个块和13个边缘
- `grade`在`-O0`具有3,8,8和9个块和2,11,7和12个边缘在雷达2,里津,安格和吉德拉,每个工具的说明中有理由
- `grade_label`在`-O0`在所有地方都只有一个区块,除了Angr,这在通话时结束一个区块
- 子表上加一个函数,没有其他工具发明或错过函数
- 扫描收益开始`0x10`现在`0x12`现在`0x13`没有人能输掉.`0x14`在陷上,没有图形构建器解码`0x10`为了`0x14`
- 结果将雷达2中的错过范围和Angr中的每一个发明的函数命名
- 文件表记录了所有21个捕获文件的版本和命令
- 解组三个工具`grade`只有吉德拉才能把分类的语言翻译成
- 翻译者用一种风格,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字样,一个字,一个字,一个字,一个字,一个字,一个字,一个字,一个.`cc_op`其他地方,没有写注册表.`cmp`没有旗`movslq`
- 翻译拒绝存储表格,其他opcode,额外的REX位和错误长度
- 翻译员的工作`cc_op`捕获VEX中的数字8和7等于
- 捕获的电梯给出了9,1,10个P码操作和7,4,7个VEX说明,用于三个指示
- 时间线从1973年到2026年,管道有八个阶段和六个工具,每个细胞都有一个术语,两个闭包的工具被标记为没有运行
- 互动图像嵌入了带产生的相同数据

## 生产失败模式

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Raw addresses from different tools | "the tools disagree about where grade is" | one offset after each base is removed, checked on one function |
| Block count as a measure of code found | "Ghidra found the most code" | the same instruction starts, with the extra block explained by a label |
| One tool as the oracle | "objdump shows the table bytes are instructions" | the sweep is a linear sweep; three graph builders leave the bytes unclaimed |
| Padding functions counted as discoveries | "angr found seven more functions" | every one sits in a padding gap or on data, and none has a symbol |
| A stopped walk reported as dead code | "the four case blocks are unreachable" | 36 bytes missed by one tool and reached by three |
| Edge counts compared without the notes | "rizin and Ghidra disagree on grade" | the same four computed targets, one extra split at a label |
| A decompiler's arithmetic read as the program | "the function multiplies by 1717986919" | the idiom from lesson 34, folded by one tool and left by another |
| A closed tool described as if run | "Binary Ninja reports five blocks" | the figure and the table mark it as documentation only |
| Captures without commands | "we ran radare2" | the manifest with version, command, and date for every file |
| An IR with no flags read as a lossy lift | "VEX dropped the flags" | the thunk in `cc_op`, `cc_dep1`, `cc_dep2`, evaluated at the branch |

## 运营规则

捕获每个工具一次,使用命令和版本,将每个地址缩小到一个基础,并比较命令开始在区块之前和区块之前边缘. 计算每个字节,如索赔,填充,数据或错过. 在判断工具的数量之前,阅读工具的自己的注释,并说你只读到哪些工具.

## 进一步阅读

- [Cifuentes, "Reverse Compilation Techniques", PhD thesis, QUT (1994)](https://eprints.qut.edu.au/36820/)
- [Cifuentes and Gough, "Decompilation of Binary Programs", Software: Practice and Experience (1995)](https://doi.org/10.1002/spe.4380250706)
- [Van Emmerik, "Static Single Assignment for Decompilation", PhD thesis, University of Queensland (2007)](https://espace.library.uq.edu.au/view/UQ:158682)
- [Schwartz, Lee, Woo, Brumley, "Native x86 Decompilation Using Semantics-Preserving Structural Analysis and Iterative Control-Flow Structuring" (USENIX Security 2013)](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Yakdan et al., "No More Gotos" (NDSS 2015)](https://www.ndss-symposium.org/ndss2015/ndss-2015-programme/no-more-gotos-decompilation-using-pattern-independent-control-flow-structuring-and-semantics/)
- [Basque et al., "Ahoy SAILR! There is No Need to DREAM of C" (USENIX Security 2024)](https://www.usenix.org/conference/usenixsecurity24/presentation/basque)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Flake, "Structural Comparison of Executable Objects" (DIMVA 2004)](https://dl.gi.de/items/7f573931-cb51-49ef-a12c-0452a9fb0ea4)
- [Maranzano and Bourne, "A Tutorial Introduction to ADB", Bell Labs (1977)](http://squoze.net/UNIX/v7/files/doc/18_adb.pdf)
- [Stallman, KTH lecture on GDB entering distribution (30 October 1986)](https://www.gnu.org/philosophy/stallman-kth.html)
- [Hex-Rays, "IDA: celebrating 30 years of binary analysis innovation"](https://hex-rays.com/blog/ida-celebrating-30-years-of-binary-analysis-innovation)
- [Guilfanov, "Decompiler internals: microcode", Recon Brussels 2018 (slides)](https://www.recon.cx/2018/brussels/resources/slides/RECON-BRX-2018-Decompiler-internals-microcode.pdf)
- [Hex-Rays, microcode view and maturity levels](https://docs.hex-rays.com/core/decompiler/how-tos/microcode-view)
- [Hex-Rays, IDA 9.4 release notes](https://docs.hex-rays.com/release-notes/9_4)
- [Hex-Rays, IDA Free](https://hex-rays.com/ida-free)
- [Ghidra releases (12.1.4)](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Ghidra P-code reference](https://github.com/NationalSecurityAgency/ghidra/blob/master/GhidraDocs/languages/html/pcoderef.html)
- [Ghidra decompiler source, main work flow and Action classes](https://github.com/NationalSecurityAgency/ghidra/tree/master/Ghidra/Features/Decompiler/src/decompile/cpp)
- [Ghidra analyzeHeadless README](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md)
- [Binary Ninja, BNIL overview](https://docs.binary.ninja/dev/bnil-overview.html)
- [Binary Ninja, "Architecture Agnostic Function Detection in Binaries" (2017)](https://binary.ninja/2017/11/06/architecture-agnostic-function-detection-in-binaries.html)
- [Binary Ninja, batch processing and headless licences](https://docs.binary.ninja/dev/batch.html)
- [Binary Ninja 6.0 "Krypton" release post](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [Binary Ninja Free](https://binary.ninja/free/)
- [radare2 book, ESIL](https://book.rada.re/emulation/esil.html)
- [radare2 book, decompilers](https://book.rada.re/arch/decompile.html)
- [radare2 releases (6.2.4)](https://github.com/radareorg/radare2/releases)
- [rizin, RzIL design notes](https://github.com/rizinorg/rizin/blob/dev/doc/rzil.md)
- [rizin releases (0.9.1)](https://github.com/rizinorg/rizin/releases)
- [Announcing Rizin (8 December 2020)](https://rizin.re/posts/announcing-rizin/)
- [Cutter releases (2.5.0)](https://github.com/rizinorg/cutter/releases)
- [angr documentation, CFG recovery](https://docs.angr.io/en/latest/analyses/cfg.html)
- [angr documentation, the decompiler and its analysis passes](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [angr documentation, intermediate representation (VEX)](https://docs.angr.io/en/latest/advanced-topics/ir.html)
- [angr on PyPI (10.0.3)](https://pypi.org/project/angr/)
- [pypcode on PyPI](https://pypi.org/project/pypcode/)
- [llvm-objdump command guide](https://llvm.org/docs/CommandGuide/llvm-objdump.html)
- [GNU objdump manual](https://sourceware.org/binutils/docs/binutils/objdump.html)
- [LIEF documentation](https://lief.re/doc/stable/index.html)
- [Capstone releases](https://github.com/capstone-engine/capstone/releases)
- [BinDiff releases (v8, open source)](https://github.com/google/bindiff/releases/tag/v8)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [Hopper Disassembler downloads](https://www.hopperapp.com/download.html)
- [Compiler Explorer](https://github.com/compiler-explorer/compiler-explorer)
- [LLDB announced as an LLVM subproject (2010)](https://blog.llvm.org/2010/06/new-lldb-debugger.html)
- [Boomerang decompiler](https://boomerang.sourceforge.net/)
- [Tan et al., "LLM4Decompile" (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.203/)
- [Gao et al., "DecompileBench" (Findings of ACL 2025)](https://aclanthology.org/2025.findings-acl.1194/)
- [Liu, Raff, Micinski, "When LLM Decompilers Recompile More and Preserve Less" (2026)](https://arxiv.org/abs/2609.05370)
