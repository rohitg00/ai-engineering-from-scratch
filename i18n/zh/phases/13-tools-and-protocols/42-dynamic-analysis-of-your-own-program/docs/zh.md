# 动态分析自己的程序: 检查,痕迹和确认静态声称

> 破点击是关于一个运行的观察. 这一课程建立了这种结合,将这些观察转化为证实,驳斥和未观察的判决.

**Type:** Build
**Languages:** Python, TypeScript, C, arm64 assembly, lldb command language
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~130 minutes

## 学习目标

- 解释一个调试器需要从Linux操作系统 (`ptrace`并且为什么一个沙盒不能启动一个调试程序.
- 设置软件的断点,以名称和地址列出,设置硬件的监控点,并阅读处理器对这两个设置的限制.
- 通过停止从Python驱动lldb的批量模式,记录记录记录,内存和框架变量,并在每一个停留,
- 检查32课,33课,34课,41课时的静态要求:参数注册表,结构场的抵消,哪个边缘有条件分支取,哪些调用发生.
- 运行同样的计划与一个`-O2`建立,阅读解决而不会碰的断点,说什么可以证明什么不能证明.
- 保存和加载一个核心文件,并命名一个堆式核心遗漏的东西.
- 映射gdb和ldb命令集,并放置`strace`现在`ltrace`现在`bpftrace`现在`dtrace`其他`rr`它们的版本和许可证.
- 描述了MacOS代码签名的事实,让lldb调试你自己构建的二进制,

## 问题

第41课阅读`struct account`据DWARF报道,`balance`课程33构建了控制流图`classify`现在,我们要把第一支支支店送到`return -1`课32说,前两个论点到达`x0`其他`x1`没有一个字节被观察到.

经纪人读到同样的程序,报告"主要电话"`bump`现在`classify`其他`sum_balances`符号表列出了三个,所以句子看起来很安全.`-O2`运行过程打印了其四个线和出口. 每个断点报告`hit count = 0`现在,我们要去.

编译器将所有三个电话列在线,然后折叠了`sum_balances(rows, 3)`只有在一个试验器下运行它,才能知道这个机器上的二进制值.

这一课就能建立一个带,`account.c`分析了每一个静态索赔的结果, 根据停留结果, 评分有三个结果. `confirmed`代表一个停车证明了该指控是对此运行的.`refuted`意思是,一个停车证明是错误的.`not-observed`没有停留可以测试它,记录说为什么.`observed`记录权威`controlled-replay`现在,我们要去.

```figure
re-42-run-timeline
```

## 调试器是三个系统服务和一个表

调试器对一个没有代码的进程执行四项操作.它停止了进程,阅读和写入其注册表,阅读和写入其内存,并被告知该进程再次停止.内核将这些都作为服务提供,服务因操作系统而不同.

在Linux上,服务是`ptrace(2)`文件中表示,它"提供了一个方法,使一个过程 (追踪器) 可以观察和控制另一个过程的执行.`PTRACE_TRACEME`让孩子宣布,他的父母会追踪它,`PTRACE_ATTACH`没有相关的过程,`PTRACE_PEEKDATA`读到"一个字在地址, 记者记忆",`PTRACE_GETREGS`阅读登记册,`PTRACE_SINGLESTEP`运行一个指令. 雅马模块的限制附加: `/proc/sys/kernel/yama/ptrace_scope`默认的1意味着"目标进程必须是调用者的后代",2意味着只有一个管理员可以添加,3意味着没有人可以.

在macOS上`ptrace`果手册列表`PT_TRACE_ME`现在`PT_ATTACHEXC`现在`PT_STEP`现在`PT_CONTINUE`其他`PT_KILL`现在,我在着`PT_ATTACHEXC`"孩子的信号传递给父母,作为马赫的例外".记忆和注册表不会通过.`ptrace`没有.`debugserver`电话`task_for_pid()`为了获得Mach任务端口,然后`task_set_exception_ports()`系统恶魔.`taskgated`决定谁可以打电话`task_for_pid`现在,我们要去.

课程的子在座椅带沙盒下运行.同样的计划在沙盒外产生11个停车,在它内产生这样:

```text
(lldb) run
error: process exited with status -1 (attach failed ((os/kern) invalid address))
```

错误是关于调试器的权利,它没有说任何关于程序的. 带记录它作为发射失败,没有停止和没有判决.

调试器记住它在哪个地址更换了哪个命令字节,所以它可以在继续时将原始文件重新放回,并且按位置计算击. `breakpoint list`打印了桌子,每次跑步的最后,连接器都会读到.

## 断点:一个字节或一个字节被取代

软件断点是处理器被困在命令的命令,写在命令的第一个字节上.在x86-64上,这是`INT3`号码`CC`据英特尔手册描述,它是"用于调用调试例外处理器".`BRK #imm16`通过使用EC值0x3C记录" ESR_ELx中的例外.`BRK`停止报告所取代的指示的地址,而不是之后的指示.

按名称,文件和行,或地址设置断点.

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O0`bump + 12 at account.c:13:19, address = 0x00000001000004bc
```

`bump + 12`这是第四条指示.`sub sp, sp, #0x10`现在`str x0, [sp, #0x8]`其他`str w1, [sp, #0x4]`设置图像,DWARF线表将其归因于函数的开线.`x0`其他`x1`现在,我们仍然保留这些论点,因为序言只复制了它们.

通过地址,Ildb需要知道地址属于哪个模块.`breakpoint set -a 0x100000504`在这个过程出现之前,有一个没有部分的载荷地址,在第一次测试中,它仍然存在.`unresolved`整个运行过程中`hit count = 0`带使用的形式是模块名称:

```text
(lldb) breakpoint set -a 0x100000504 -s account-O0
Breakpoint 4: address = 0x0000000100000504
```

随着`-s`号码是文件地址`account-O0`运行后位置读取`resolved, hit count = 2`课33列表给出文件地址,所以这是连接静态列表到动态停止的表格.

### 通过手动解码分支

首个条件分支在`classify`在`-O0`是这个词`36f800a8`在`0x1000004f0`哪个`llvm-objdump`图像`tbz w8, #0x1f, 0x100000504`解码它从A64手臂编码中`TBZ`现在,我们要去.

1. 位31是`b5`现在,我们可以说,
2. 30至25位是`011011`测试和分支组. 位24是0,选择`TBZ`没有`TBNZ`现在,我们要去.
3. 比特23至19是`b40`低的五位的比特数:`11111`               `b5`测试的位数为31 ,标志的位数为32位值.
4. 比特18到5是`imm14`其他`00000000000101`分支的偏移是`imm14 * 4`子`0x14`所以目标是`0x1000004f0 + 0x14 = 0x100000504`现在,我们要去.
5. 比特为4到0`Rt`其他`01000`现在,我们可以看到一个`w8`现在,我们要去.

`w8`之前一个指令被加载了`ldr w8, [x8, #0x4]`现在,`a->balance`在抵消4时.`TBZ`当比特为零时,分支取出了标志比特清晰时,即`balance >= 0`消息来源写道`if (a->balance < 0) return -1;`编译器将条件逆转: 取边跳过了`return -1`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`0x1000004f4`因此,带带的静态索赔是带有预言的边缘索赔:`a->balance >= 0`另一支支支架的电梯也一样.`subs w8, w8, #0xc8`计算器`balance - 200`其他`b.le 0x100000524`且当它最大是零时,`balance <= 200`现在,我们要去.

## 监视点是硬件,却很少

监控点在访问地址的内存时停止了进程.它不能是取代的指示,因为任何处的指示都可能会进行访问.因此处理器携带一个小组的地址比较器.在x86-64上,它们是调试注册表:`DR0`通过`DR3`具有"最多4个断点的地址",以及`DR7`设置其条件 (执行,写或读写) 和其长度 (1, 2, 4,或 8 字节).`DBGWVR<n>_EL1`包含用于观察点匹配的虚拟数据地址,`DBGWCR<n>_EL1`控制器的操作,手册说:"一个实现可以包括2-64个监控点.

国际电信组织报告给出的号码:

```text
(lldb) watchpoint set variable a->balance
Watchpoint created: Watchpoint 1: addr = 0x16fdfe00c size = 4 state = enabled type = m
(lldb) watchpoint list
Number of supported hardware watchpoints: 4
```

这台机器上有四个.`0x16fdfe00c`是`x0 + 4`结构指标在`bump`停止加上 DWARF 的偏移`balance`现在,我们要去.`size = 4`是什么?`int`现在,我们要去.`type = m`由于一个不配合或没有两个的区域可以接收两个插槽,所以您可以设置的监控点数量可能小于四个.

数据监控点在访问后报告.英特尔手册说:"在数据断点生成的调试例外之前,写入内存的指示将原始数据重写",并且ldb将旧值保留在自己的缓存中,以打印两者:

```text
Watchpoint 1 hit:
old value: 250
new value: 255
* thread #1, queue = 'com.apple.main-thread', stop reason = watchpoint 1
    frame #0: 0x00000001000004d0 account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:14:12
```

停车时间是`0x1000004d0`后的指示`str w8, [x9, #0x4]`在`0x1000004cc`在分析输出之前,值得知道一个奇怪.`watchpoint set`其他信息`Watchpoint 1 hit:`没有任何值,`new value: 250`这就是初始读数, 连接器忽略了没有旧值的击中.

## 步行,停止子,以及批量模式

,我知道你是个.`<noun> <verb> [-options] [arguments]`步行动词是`thread step-in`(`s`), `thread step-over`(`n`), `thread step-inst`(`si`), `thread step-inst-over`(`ni`),以及`thread step-out`(`finish`它们是`thread until 12`走到一个线.`thread return <expr>`带不会踩下,它停在预定地址,让一个停止子读取:

```text
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
```

`-o`任何站点都会顺序执行命令.`register read`两个参数注册表和程序计数器的名称. `memory read -s4 -fx -c24 $x0`印出24个四字节字母,从地址在`x0`占96字节,三`struct account`排列`frame variable -P 1`打印了参数和本地,并扩展了指针到一个层次,所以`a`它们的五个领域.

批量模式是`lldb -b`书籍中写道`--batch`运行命令从`-s`现在`-S`现在`-o`其他`-O`并且停止了,如果命令停止了"由于信号或故障,调试器将返回互动提示".`-s`只有一个问题:`settings set interpreter.stop-command-source-on-error false`没有它,第一`continue`程序结束后,整个文件结束,`breakpoint list`没有任何动力,用它,Ildb的印记.`error: Process must be launched.`接下来,我们会继续.

分析器的运作方式决定了输出形状的两个事实.`Process N stopped`块与其`frame #0`解析器将注册表,内存和变量线集成成一个悬挂的部分,并将该部分附加到下一个部分.`frame #0`它们可以看到的线条.`dyld`在`_dyld_start`在程序运行之前,是进入站点,没有`frame #0`另一方面,我们与`--auto-continue`系统的第一版本使用自动连接,没有记录任何东西.该计划使用简单的断点和固定预算.`continue`命令而不是.

## 计划来自列表

`Plan.commands()`从 `llvm-objdump -d`对于 `account-O0`其他:

```text
breakpoint set -n bump
breakpoint set -n classify
breakpoint set -n sum_balances
breakpoint set -a 0x100000504 -s account-O0
breakpoint set -a 0x1000004f4 -s account-O0
breakpoint set -a 0x100000524 -s account-O0
breakpoint set -a 0x100000514 -s account-O0
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
run
watchpoint set variable a->balance
watchpoint list
continue
...
breakpoint list
watchpoint list -v
```

名称分分点是函数输入. 位分分点是每个条件分支的目标和倒闭.`Listing.conditional_branches()`发现`classify`其他`tbz`在`0x1000004f0`其他`b.le`在`0x100000510`监视点设置在第一站,`bump`十六个`continue`预算不是关于程序的知识,而是一个天花板.

索赔由相同的输入构建`claims_for()`其他:

| Id | Kind | Claim | Source |
|---|---|---|---|
| `arg-registers` | argument-register | at every entry the first arguments arrive in `x0` and `x1` | lesson 32 and AAPCS64 |
| `field-offsets` | field-offset | `struct account` is 32 bytes with `kind` at 0, `balance` at 4, `code` at 8, `rate` at 16, `label` at 24 | lesson 41 and the DWARF dump |
| `branch-1` | branch-taken | `tbz` at `0x1000004f0` goes to `0x100000504` when `a->balance >= 0`, otherwise to `0x1000004f4` | lesson 33 edges and the lesson 34 lift |
| `branch-2` | branch-taken | `b.le` at `0x100000510` goes to `0x100000524` when `a->balance <= 200`, otherwise to `0x100000514` | lesson 33 edges and the lesson 34 lift |
| `calls` | call-edge | `main` calls `bump` once, `classify` three times, `sum_balances` once | source text and `nm` |
| `store-once` | store | `bump` writes `a->balance` once and the new value is the old value plus `by` | lesson 34 pseudocode |
| `stride` | struct-stride | `list[i].balance` sits at `list + 32*i + 4` | lesson 41 and the psABI aggregate rule |
| `output` | behaviour | the program prints `class 0 1 -1` and `sum 315` | source arithmetic |

场地偏移来自`struct_layout()`根据"`DW_TAG_structure_type`随着`DW_AT_byte_size (0x20)`五个`DW_TAG_member`包含他们的条目`DW_AT_data_member_location`计划从来没有打字4号.

## 十一站的跑步

首先要停下来是`bump`子在停车区前打印了这样的:

```text
      x0 = 0x000000016fdfe008
      x1 = 0x0000000000000005
      pc = 0x00000001000004bc  account-O0`bump + 12 at account.c:13:19
0x16fdfe008: 0x00000073 0x000000fa 0x00000009 0x00000000
0x16fdfe018: 0x00000000 0x3ff40000 0x00000719 0x00000001
0x16fdfe028: 0x0000006c 0xffffffd8 0x00000003 0x00000000
0x16fdfe038: 0x00000000 0x40000000 0x00000721 0x00000001
(account *) a = 0x000000016fdfe008 {
  kind = 's'
  balance = 250
  code = 9
  rate = 1.25
  label = 0x0000000100000719 "savings"
}
(int) by = 5
```

读取第一个行的八个字符与DWARF的偏移.`0x73`现在,`'s'`其他`kind`字节1在偏移4是 字节1在偏移4是`0xfa`子,子,子`balance`字号2在8的偏移中是`0x9`现在`code`其他`short`在下半端,上面有两个字节填充. 字节3在偏移12是8字节的排列前填充.`double`字母4和5在16的偏移中是`0x3ff4000000000000`字符6和7在偏移24是`0x100000719`其他`label`指向`__TEXT`下一个八个字开始于`0x6c``'l'`其他`0xffffffd8`排列三:`loan`之后,32字节.每个数字都同意`frame variable`现在,`_check_layout()`记录`field-offsets`作为`confirmed`在这站,它在每一个11站再次这样做`x0`具有结构指标.

`x0`相当于`a`其他`x1`相当于`by`现在,`arg-registers`带仅仅将声明的论点进行比较.`classify`停止`x1`现在还在读`0x5`其他部分`bump`其他`classify`没有任何争论的注册表是噪音,课32的要求没有说任何关于它.

第二站是观察点,旧值250,新值255,`by`整个比赛中只有一次击球,所以`store-once`然后是3次激活.`classify`两种杆,每一个杆和一个或两个边缘杆:

| Stop | Address | Stop reason | What it tests |
|---|---|---|---|
| 2 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 100, `x0` = `a` |
| 3 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 100 >= 0, `branch-1` confirmed |
| 4 | `0x100000524` | breakpoint 6.1 | `b.le` taken, 100 <= 200, `branch-2` confirmed |
| 5 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 255 |
| 6 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 255 >= 0 |
| 7 | `0x100000514` | breakpoint 7.1 | `b.le` fell through, 255 > 200 |
| 8 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = -40 |
| 9 | `0x1000004f4` | breakpoint 5.1 | `tbz` fell through, -40 < 0 |
| 10 | `0x100000544` | breakpoint 3.1 | `sum_balances` entry, `x1` = 3 |

`_check_branches()`通过起的预测,将停止进行激活,在入口时读取平衡,并且为每个边缘停止计算后者.`branch-1`已经证实了三次,`branch-2`停止5显示平衡为255,这是观察点所看到的值.运行是一个程序,证据连接.

在10站,子读出了24个字.`list`现在,我们要去.`_check_stride()`换成4个字,36个字,68个字,255个字,40个字.`classify`总计315个,并将总数与`sum 315`然后进程以状态0和 `breakpoint list`显示了1,3,1的名字和2,1,1,1的四边.`confirmed`两位在最后的跑步.

## 运行在 - O2:零停止

其他地方`-O2`其他项目.`llvm-objdump -d`其他`main`只有四个`bl`其他指令`printf`没有任何电话.`mov w8, #-0x1`现在`mov w8, #0x1`通过零`xzr`其他`mov w8, #0x13b`编译器在编译时计算了每个结果.`nm`仍然存在的列表`_bump`现在`_classify`其他`_sum_balances`由于它们是外部函数,而其他对象需要使用其它离线副本.`DW_TAG_subprogram`对于所有四个函数和零的输入`DW_TAG_inlined_subroutine`任何输入,所以即使是调试信息都没有记录入口.

建筑的计划有三个名称断点,没有边缘断点.`classify`在`-O2`只有六个指示.`ldr`现在`cmp`现在`cset`现在`cmp`现在`csinv`现在`ret`边缘要求从 `-O0`列表没有在二进制中的地址,和链接不携带它们.关于边缘的索赔属于列表有边缘的构建.

跑步:

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O2`bump at account.c:13:16, address = 0x0000000100000460
(lldb) run
sizeof 32 align 8
offsets 0 4 8 16 24
class 0 1 -1
sum 315
Process 48444 exited with status = 0 (0x00000000)
(lldb) watchpoint set variable a->balance
error: Command requires a process which is currently stopped.
(lldb) breakpoint list
1: name = 'bump', locations = 1, resolved = 1, hit count = 0
```

每个断点都解决了.地址存在,符号存在,`BRK`杀人数是零,因为没有任何指令得到地址.

| Claim | Verdict | Record |
|---|---|---|
| `calls` | refuted | after a full run with exit status 0, entry stops bump 0, classify 0, sum_balances 0 |
| `output` | confirmed | the four lines and exit status 0 |
| `arg-registers` | not-observed | no stop tested it, hit counts all 0 |
| `field-offsets` | not-observed | no stop tested it |
| `store-once` | not-observed | no stop in bump, so the watchpoint was never set |
| `stride` | not-observed | no stop in sum_balances |

关于驳斥的确切.`main`它们是这个程序中的三个函数. 对于这个构建和这个运行,它没有,和带检查了运行完成,因为出口前的击数为零只意味着运行尚未达到呼叫. 要求并没有说函数是死码,运行也没有说:它们是出口的,另一个对象可以称它们. 其他四项指控既没有确认,也没有被驳斥. 结构仍然有`balance`在这个构建中的4个偏移,`-O2`据DWARF所说,但没有停止在这次运行读记忆显示它. `not-observed`让我们保持这种区别, 35课让我们保持未知的开放,直到一个跑步观察到它.

## 核心垃圾

核心文件是进程的内存和记录,写到磁盘上,所以调试器可以读取程序停止后的程序.`core(5)`由于"少量的信号导致过程中异常停止,`/cores/core.pid`"只要终止的过程在目录中有写入许可,`sysctl`报告`kern.coredump: 1`其他`kern.corefile: /cores/core.%P`现在`/cores`存在于模式下`drwxrwxr-t root admin`子的子`ulimit -c`没有核核被写到你提高了限度之前`ulimit -c unlimited`系统范围内的`launchctl limit core unlimited`现在,我们要去.

没有崩,就需要编写一个核心.`bump`断点:

```text
(lldb) process save-core --style stack account-O0-stack.core
Saving 49152 bytes of data for memory region at 0x16fdf4000

Modified-memory or stack-memory only corefile created.  This corefile may 
not show library/framework/app binaries on a different system, or when 
those binaries have been updated/modified. Copies are not included
in this corefile.  Use --style full to include all process memory.
```

文件的容量为53,248字节.

```text
(lldb) target create "./account-O0" --core "account-O0-stack.core"
(lldb) bt
* thread #1, stop reason = ESR_EC_BRK_AARCH64 (fault address: 0x0)
  * frame #0: 0x00000001000004bc account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:13:19
    frame #1: 0x0000000100000640 account-O0`main at account.c:40:5
    frame #2: 0x000000019a949d54 dyld`start + 7184
(lldb) frame variable *a
(account) *a = (kind = 's', balance = 250, code = 9, rate = 1.25, label = "")
(lldb) frame variable a->label
(const char *) a->label = 0x0000000100000719 ""
```

后轨和整数场是完整的,因为它们生活在核心保存的堆上.`label`标记是空弦,指针是完整的.`0x100000719`是正确的;它指向的字节是字面的.`"savings"`在`__TEXT`列式的核心不包括该段.指针是观察. 字符串不存在, lldb 并没有发明它. `--style full`包含所有进程内存,并且该34 KB程序的全部核心在研究机器上是2.1 GB,因为进程映射了共享缓存.`ESR_EC_BRK_AARCH64`核心记录了`BRK`由于断点,

在Linux上,内核会根据`/proc/sys/kernel/core_pattern`个模板`%p`对于PID,`%e`命令名称`%s`对于信号,以及`%t`对于当时的情况,`|`系统的分布使用该管用于`systemd-coredump`其他`coredumpctl list`现在`info`现在`dump`其他`debug`检索它存储的东西.`gdb prog core`其他`lldb -c core prog`两个都打开了结果.

## 两者相对

两个调试器用不同的词语做同样的工作.`COMMAND_MAP`装备箱内有35行,由 `python3 code/main.py commands`这课中使用的:

| Task | gdb | lldb | lldb alias |
|---|---|---|---|
| break at a function | `break bump` | `breakpoint set -n bump` | `b bump` |
| break at an address in one module | `break *0x1000004f0` | `breakpoint set -a 0x1000004f0 -s account-O0` | |
| run commands at every stop | `define hook-stop` ... `end` | `target stop-hook add -o '...'` | |
| list breakpoints with hit counts | `info breakpoints` | `breakpoint list` | `br l` |
| watch a variable for writes | `watch a->balance` | `watchpoint set variable a->balance` | `wa s v a->balance` |
| list watchpoints | `info watchpoints` | `watchpoint list -v` | `wa l -v` |
| read one register | `p $x0` | `register read x0` | |
| read memory as words | `x/8xw 0x16fdfe008` | `memory read -s4 -fx -c8 0x16fdfe008` | `x -s4 -fx -c8 0x16fdfe008` |
| show arguments | `info args` | `frame variable --no-locals` | |
| step one instruction | `stepi` | `thread step-inst` | `si` |
| run until the function returns | `finish` | `thread step-out` | `finish` |
| write a core file | `gcore core` | `process save-core --style stack core` | |
| open a core file | `gdb account-O0 core` | `lldb -c core account-O0` | |

们的`p`是一个号`dwim-print`通过 `frame variable`路径和跌倒回`expression`对于其他任何东西.`v`是`frame variable`我更喜欢`frame variable`在一个带中:它读取DWARF位置,但从来没有在调试器中运行代码.

2026-10-14的版本和许可证. lldb 载有LLVM版本号码,目前的 llvm.org版本是2026-10-06的LLVM 23.1.3,根据Apache许可证2.0,除了LLVM除外.`lldb`在这个机器舰上的指挥线工具`lldb-1703.0.236.21`果公司的编号,有嵌入式Python3.9.6,果公司的ldb已经签署了调试.GDB 18.1在2026-09-25年发布在GPL-3.0或后版本下.`.gdb_index`其他国家`FPMR`鱼和鱼`gdb.Corefile`根据GDB的数据,在2025年10月发布了15个补丁"初始AArch64-Darwin支持"系列,并在2026年2月,一个维护人员设定了通过版权分配并首先使用BFD补丁的路线.`gdb`配方有 arm64 瓶子,并用假装构建.`--target=x86_64-apple-darwin20`任何非果在macOS上的调试器也需要一个自签证的证书和`com.apple.security.cs.debugger`权利,或`task_for_pid`在此过程中,gdb的位置是Linux, Debian 稳定为 arm64 运输gdb 16.3`rr`生命.

## 追踪:程序要求核能做什么

调试器显示程序的状态在停止. 追踪器显示程序对系统的影响,而不停它长时间. 工具是每个操作系统.

| Tool | OS | Version | Licence | What it records |
|---|---|---|---|---|
| `strace` | Linux | 7.2, 2026-08-18 | LGPL-2.1-or-later | system calls with arguments and return values |
| `ltrace` | Linux | 0.7.3 last tarball, git snapshots in Debian | GPL-2.0 | dynamic library calls |
| `bpftrace` | Linux | v0.27.0, 2026-09-10 | Apache-2.0 | kernel and user probes through eBPF |
| `dtrace` and `dtruss` | macOS | `Sun D 1.19` in macOS 26.2 | CDDL, from Sun's OpenSolaris | D probes; `dtruss` prints system calls |

`dtruss`由于它使用DTrace,只有具有根特权的用户才能执行这个命令.`dtrace(1)`补充说"随着默认系统完整性保护设置,D程序不允许访问内核地址值或内核内存内容",并且在SIP下不允许破坏性操作. `sudo dtruss ./account-O0`在这个机器上没有运行在这个课程中,因为连接器运行没有根,和课程记录的未经验证.一个痕迹回答了与连接器不同的问题:"这运行问题是不是一个`write`每个`printf`没有什么问题,`x1`保持5个`bump`"这是一个调试问题.

## 录音和重播

`rr`记录一次运行,并在 gdb 中确定性地重复,执行反转:设定一个值值的观察点,`reverse-cont`它们可以回头写. 项目描述自己是"你记录一次失败,然后调试记录, 确定性, 目前版本是2025-02-13的5.9.0,根据MIT许可证,具有BSD-2-条款区块. 只有Linux. 它需要硬件性能计数器来计算分支,所以它运行在Intel Nehalem和后来的某些AMDZEN核心和"某些AArch64微架构 (例如 在Linux中使用"ARM Neoverse N1或果 M系列" 在虚拟机内,计数器必须虚拟化,项目维基说:"Mac上没有其他虚拟化",所以在这个机器上,Docker和Colima无法运行它. 诺斯科是基于录音的商业服务.

据悉,Gdb有自己的软件记录器.`record full`记录"进程执行日志",默认限制为200,000个说明,`record btrace`在 MacOS 机器上,该带的保存转录是记录:同一盘子上的同一计划在同一顺序中产生相同的停止,并且固定器测试了该顺序.

## 跑步证明了什么

一次运行证明了一个构建中的一个输入.C标准定义了未定义的行为为"在使用不携带或错误的程序构建或错误的数据时,该文件没有要求的行为",因此一个程序过度处理签署的程序`int`可以合法地在 `-O0`其他`-O2`课36 遇到了这个问题`percent_change`们就会把问题变成一个停顿.`-fsanitize=signed-integer-overflow -fsanitize-trap=undefined`让过度流动"执行一个陷指令",

优化代码也移动了你想要观看的内容.GDB的手册说"优化程序已经重新排列了你的代码;调试程序显示了你真正存在的内容",并且一个优化的变量是"GDB 永远不会看到的"`<optimized out>`它们的来源与`<unavailable>`优化"实际上不存在于程序中",不可用"存在于程序中 (在机器级别上),但GDB没有办法进入它.`<variable not available>`随着程序计时器在变量 DWARF位置列表的每个范围之外.一个在注册表中居住的本地上的监控点永远不会开启,因为注册表不是内存.`-O2`整个函数被折叠了,而一个没有设置的监视点的沉默证明了什么.

带写了三种记录,而从来没有第四种.`confirmed`一个试验和不同意的站点是`refuted`没有停留的证据是`not-observed`课程35的本书接受了前两个作为`observed`具有权威的记录`controlled-replay`另一个是未知的.

## 在macOS上只调试自己的构建

在果上,链接器标志着你.果的.`ld(1)`关于`-adhoc_codesign`果二元件的默认设置是"专用编码".`codesign -dvvv account-O0`在固定式印记上:

```text
Format=Mach-O thin (arm64)
CodeDirectory v=20400 size=387 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
Signature=adhoc
TeamIdentifier=not set
```

`0x20002`是`CS_ADHOC`(`0x2`) 加上`CS_LINKER_SIGNED`(`0x20000`),在果签字代码标题中"由链接器自动签字". `codesign -d --entitlements -`没有权利. lldb发行了它,击中了每个断点,设置了硬件监控点,并写了一个核心,`DevToolsSecurity -status`报告"开发者模式目前已被禁用"和系统完整性保护启用.

两个权利控制谁可以调试什么,他们坐在相反的边.`com.apple.security.cs.debugger`对于调试器: "一个Boole值,指的是应用程序是否是一个调试器,并且可能连接到其他进程或获得任务端口.`debugserver`具有私人形式,`codesign -d --entitlements -`在命令行工具复制列表中`com.apple.private.cs.debugger`现在`com.apple.private.set-exception-port`现在`com.apple.private.thread-set-state`其他`com.apple.private.logging.diagnostic`现在,我们要去.`com.apple.security.get-task-allow`对于目标,Xcode将其注入到调试组件中,将其删除出口,并拒绝了仍然持有其的二元文件.果的工程师指出拒绝的规则:当目标启用了硬化运行时间并且没有`get-task-allow`简单的`clang`如果你签署了协议,`codesign --options runtime`重新签署`codesign -s - -f --entitlements get-task-allow.plist`在调试之前.

首先,您可能会在登录会话中第一次看到对话框"开发工具访问需要控制另一个调试进程,以便继续"`sudo DevToolsSecurity -enable`删除了成员的额外密码`admin`或`_developer`果说"你不需要禁用SIP来运行和调试Xcode的应用程序",唯一触及调试的SIP组件是一个`csrutil enable --without debug`第三,这次会议中的安全带沙盒阻塞了`task_for_pid`完全,和固定`sandbox-O0.lldb.txt`跑步不能开始是环境事实, 带将其报告为这样的事实.

只有如果其所有者同意,就能将相同的命令附加到另一个进程中,

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
```

输出是保存的转录中一个JSON报告. 对于每个构建,它列出了分离点,其分辨率和击数,硬件监控点数,其注册表和参数,出口状态,程序输出,印出的错误,以及其判决和证据记录的索赔. 它增加了核心回路,Python API结果,沙盒故障,以及该机器上缺失的外部工具.

预期的形状:

```json
{
  "program": "account.c",
  "variants": {
    "O0": {
      "binary": "account-O0",
      "breakpoints": {"1": {"spec": "name=bump", "address": "0x1000004bc", "resolved": true, "hits": 1}, "...": "..."},
      "hardwareWatchpoints": 4,
      "watchpoints": {"1": {"address": "0x16fdfe00c", "size": 4, "type": "m", "hits": [[250, 255]], "hitCount": 1}},
      "stops": [{"index": 0, "pc": "0x1000004bc", "function": "bump", "kind": "entry", "registers": {"x0": "0x16fdfe008", "x1": "0x5"}, "...": "..."}],
      "exitStatus": 0,
      "claims": [{"id": "arg-registers", "verdict": "confirmed", "confirmed": 5, "refuted": 0, "not-observed": 0, "...": "..."}],
      "evidence": [{"claim": "arg-registers", "verdict": "confirmed", "stop": 0, "observation": "bump: x0 = 0x16fdfe008 and a = 0x000000016fdfe008, x1 = 0x5 and by = 5"}]
    },
    "O2": {"stops": [], "claims": [{"id": "calls", "verdict": "refuted", "...": "..."}], "...": "..."}
  },
  "core": {"savedAt": {"function": "bump", "pc": "0x1000004bc"}, "labelString": "", "...": "..."},
  "types": {"python": "3.9.6", "size": 32, "...": "..."},
  "sandbox": {"stops": 0, "errors": ["process exited with status -1 (attach failed ((os/kern) invalid address))"]},
  "absentTools": ["bpftrace", "gdb", "llvm-objdump", "ltrace", "rr", "strace"]
}
```

阅读`code/main.py`在此顺序:

1. `Listing`分析了`llvm-objdump -d`文字将函数和指示分为`Function.conditional_branches()`发现了树枝,它们的目标和突破.
2. `struct_layout()`阅读了来自 组织的结构和成员条目`llvm-dwarfdump`给我一个短信.
3. `lift_condition()`转化一个条件分支为一个预言,课程34步`tbz`现在`cbz`其他类型的类型
4. `Plan.commands()`从列表中写下ldb命令文件,`Plan.lldb_command()`是批量调用.
5. `parse_transcript()`输出顺序进行,并构建`Stop`记录有注册表,内存,变量和观察点值,加上断点表和退出状态.
6. `claims_for()`声明了八项索赔,`evaluate()`评级他们停下来停下来与 `_check_*`它们的功能.
7. `rollup()`根据该法规,每项诉讼的判决将减少到1项,
8. `capture()`其他`capture_extras()`生产设备,`live()`在新构建中重复整个循环,当`clang`其他`lldb`能跑步.

现在还有四个命令.`python3 code/main.py plan O0`打印命令文件,为构建. `python3 code/main.py commands`打印了Gdb和LDB表. `python3 code/main.py tools`报告外部工具的使用情况`PATH`现在,我们要去.`python3 code/main.py live O0`编译`account.c`在一个临时目录中,从新上市中进行计划,运行lldb,并对该运行进行评级.在一个沙盒里,它报告lldb无法启动这个过程,错误,并退出1.

## 用它

按照这个顺序,用该带来编写自己的程序.

1. 用它建造`-g`保持二进制,它的dSYM或DWARF,`llvm-objdump -d`给他们打短信.
2. 在运行前,写出要求.每个要求都会给出一个函数,一个注册表或一个地址或一个偏移,一个预期值或边缘,以及来自的课程或文档.你看到停止后写的要求描述了停止,并没有测试任何东西.
3. 根据列表的图表,生成计划,然后阅读它.每一个地址都应该追溯到列表中的一条线.如果一个断路点没有这样的线条,请删除它.
4. 运行一次在批量模式,并将命令行和调试版本在标题中保存. 转录是证据. 判决是从它中得出的,任何人都可以重新得出它们.
5. 读一读,读一读.`not-observed`在阅读确认之前,请记录其原因. 理由告诉你哪些索赔需要另一个输入,另一个构建或另一个断点.
6. 运行相同的索赔的优化构建,预计编译器在线的零击点解决的断点,并保持这些索赔开放.
7. 输入证实和驳斥的记录到第35课本书中`observed`权威`controlled-replay`留下未观察到的未知,并附加了断点击数.

## 互动实验室

### 实验室A:手动阅读一站

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/code
python3 -q
```

运行:

```python
from main import *
t = load_transcript("session-O0.lldb.txt")
s = t.stops[0]
hex(s.pc), s.function, s.reason, s.registers
[hex(w) for w in s.memory[:8]]
s.struct_pointer().fields
```

在第二行前,写下你希望能容纳250字的词,以及哪两个词容纳1.25.`struct.unpack("<d", struct.pack("<II", s.memory[4], s.memory[5]))`然后看看`t.stops[1].watch_hit`其他`t.stops[1].pc`查找该地址`account-O0.objdump.txt`经过商店的指示.

### 实验室B:分支及其继任者

```python
plan = make_plan("O0")
plan.branches()
classify = plan.listing.function("classify")
[lift_condition(classify, b, "a->balance")[0] for b in plan.branches()]
[(hex(s.pc), s.struct_pointer().field_int("balance")) for s in t.stops_in("classify")]
```

在查看证据之前,请与每个边缘站点相匹配,然后决定预测的继任者.`[e.to_dict() for e in evaluate(plan, t, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim.startswith("branch")]`让我们比较.

### 实验室C: 跑步从来没有停止

```python
o2 = load_transcript("session-O2.lldb.txt")
len(o2.stops), o2.exit_status, o2.hits()
o2.errors[:3]
make_plan("O2").branches()
rollup(evaluate(make_plan("O2"), o2, struct_layout(open("fixtures/account-O2.dwarfdump.txt").read(), "account")))
```

解释每一个`not-observed`按照自己的话说,然后开放.`account-O2.objdump.txt`在 中找到四个常数`main`接下来,数量.`DW_TAG_inlined_subroutine`在`account-O2.dwarfdump.txt`随着`count_tags()`现在,我们要去.

### 实验室D: 破坏证据

```python
text = open("fixtures/session-O0.lldb.txt").read().replace("x1 = 0x0000000000000005", "x1 = 0x0000000000000006", 1)
broken = parse_transcript(text)
[e.to_dict() for e in evaluate(plan, broken, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim == "arg-registers"][:2]
```

一个编辑的登记簿将第一个转换`arg-registers`记录到`refuted`其他四个入口仍然存在`confirmed`然后删除`old value: 250`在监视点停顿前的线`store-once`跌到`not-observed`没有评分,不能让人失败.

如果Ildb能够在你的中启动一个过程,`python3 main.py live O0`其他`python3 main.py live O2`地址与地址不同,判决不应该.

## 实践实验室

延长带,要求关于循环的`sum_balances`现在,我们要去.

要求:

- 找到后边的循环`sum_balances`在`-O0`列出`conditional_branches()`在循环标题上添加一个断点.
- 添加标题执行的索赔`count + 1`时间`count`课程33后边加出测试.
- 延长停止或计划,使在每个标题停止时读取循环计数器的堆插槽,并写一个`_check_loop()`记录对值的序列.
- 带回转录`python3 main.py capture O0`计划测试将失败,直到提交的命令文件与新计划相匹配,这是测试的目的.
- 添加一个测试,编辑一个对比值在转录中,并证实索赔转 `refuted`现在,我们要去.

结果是报告显示标题停止的顺序与其反值,`-O2`运行保持了新的权利要求`not-observed`由于循环是向量化或折叠的原因.

## 教训艺术品

这一课包括`outputs/skill-dynamic-analysis-of-your-own-program.md`通过它将你构建的程序,它的列表和静态索赔列表转化为一个保存的调试程序转录和每个索赔的判决,每个判决的停止和每个索赔的原因都没有被观察.它适用于克劳德,Cursor,Codex,OpenClaw,Hermes,或任何读到SKILL.md的代理人.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

套件没有LDB运行,它读取了被捕获的转录.`code/fixtures/`验证应证明:

- 列表解析器找到四个函数及其范围和两个条件分支.`classify`在`-O0`目标和落
- 电梯`tbz w8, #0x1f`是`a->balance >= 0`起的`subs`另外`b.le`是`a->balance <= 200`
- `main`在`-O0`电话`bump`现在`classify`两次,`sum_balances`其他`main`在`-O2`只有电话`printf`
- 其他地方`j<cc>`瘤是有条件的`jmp`其他`callq`没有
-  DWARF 倾倒器产生一个32字节结构,成员为 0, 4, 8, 16 和 24
- 其他`-O2` DWARF有四个子程序和零插入子程序的入口,`nm`仍然列出了三个函数
- 计划等于两个构建的承诺命令文件,并记录了运行的LDB命令
- 其他`-O0`转录中预期函数的11个停止,出口状态为0,以及四个输出线
- 出口将连接到其后续的停车位,`x1`记忆从`x0`标签字符串
- 断点表包含分辨率和击数 1, 3, 1, 2, 1, 1, 1
- 监控点为4字节,`x0 + 4`打一次,旧值250和新值255,报告了四个硬件槽
- 其他`-O2`转录中没有停止,没有打破,没有观察点,每次未使用的错误只有一个.`continue`
- 随着附件错误,在任何停止之前,沙盒发射失败
- 核心回路保持后轨和`balance`输掉了后面的弦`label`
- 字符串API读取五个字段,大小32个,并且函数范围没有进程
- 通过手写的x86-64转录分析`rdi`现在`rsi`其他`rip`
- 每一个索赔都得到确认`-O0`具有5,11,3,2,1,1,1,1记录
- 树枝证据中,有价值,条件和边缘的名称
- 场对比证据通过DWARF布局解读字符
- 存储和步骤证据载有旧和新值和三行平衡
- 其他`-O2`运行驳斥了调用边缘,其他要求没有被观察
- 已修改的注册值被驳回,删除的观察点击没有观察到,并且被驳回的获取滚动
- 命令地图为每个行提供gdb和ldb表格,硬件表命名为4个x86调试登记器
- 演示列出缺失工具,而不是失败,现场模式以名称报告缺失工具
- 图表数据来自两个会议,站点模块嵌入相同的数据

## 生产失败模式

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Resolved breakpoint with zero hits | "the function runs" or "the function is dead" | a full run with exit status, hit counts, and the verdict `refuted` for the call edge only |
| Register read at the wrong stop | "`x1` = 5 inside `classify`" | compare only declared arguments at the entry stop |
| Struct read without offsets | a column of hex words | every word mapped to a `DW_AT_data_member_location` and compared with `frame variable` |
| Branch graded from the mnemonic | "`tbz` means taken when negative" | the lifted predicate from the encoding and the stop at the successor |
| Watchpoint on a register-resident local | "no write happened" | the watchpoint was set on an address and was hit, or the record is `not-observed` |
| Auto-continue breakpoints | a clean transcript with no stops | plain breakpoints, a stop hook, and a continue budget |
| Address breakpoint without a module | `unresolved, hit count = 0` | `-s MODULE` so the listing address resolves to a load address |
| First command error ends the batch | no `breakpoint list` at the end | `interpreter.stop-command-source-on-error false` |
| Stack-style core read as full memory | `label = ""` reported as the program's value | the core style, the pointer, and the segment it points into |
| Sandboxed shell | "lldb is broken" | `attach failed ((os/kern) invalid address)` recorded as an environment fact |
| Hardened target without `get-task-allow` | "macOS forbids debugging" | the two conditions from Apple's rule, and a re-sign of your own binary |
| Transcript discarded after grading | verdicts with no source | the transcript file, its command line, and the debugger version |

## 运营规则

计划列表中的停机,按批量模式运行一次,保存转录,并在每一个停机上测试每一个静态要求.只从一个停机中写确认或驳斥,并以击中数和原因写未观察,永远不要让一个解决的断点为运行.只调整你做的构建.

## 进一步阅读

- [LLDB Tutorial: command grammar, breakpoints, watchpoints, stop hooks](https://lldb.llvm.org/use/tutorial.html)
- [lldb(1) manual page: --batch, --one-line, --source, --core](https://lldb.llvm.org/man/lldb.html)
- [GDB to LLDB Command Map](https://lldb.llvm.org/use/map.html)
- [LLDB Python Reference: SBTarget, SBFrame, SBValue, and the embedded interpreter](https://lldb.llvm.org/use/python-reference.html)
- [LLDB Caveats: the Python build lldb links against](https://lldb.llvm.org/resources/caveats.html)
- [LLVM 23.1.3 release](https://github.com/llvm/llvm-project/releases/tag/llvmorg-23.1.3)
- [GDB 18.1 release announcement, 2026-09-25](https://sourceware.org/pipermail/gdb-announce/2026/000150.html)
- [GDB manual: Process Record and Replay](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Process-Record-and-Replay.html)
- [GDB manual: Debugging Optimized Code](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Optimized-Code.html)
- [GDB wiki: Permissions on Darwin, code signing a debugger](https://sourceware.org/gdb/wiki/PermissionsDarwin)
- [gdb-patches: Initial AArch64-Darwin support series, October 2025](https://sourceware.org/pipermail/gdb-patches/2025-October/222196.html)
- [Homebrew gdb formula pull request adding arm64 bottles](https://github.com/Homebrew/homebrew-core/pull/209753)
- [ptrace(2), Linux manual page](https://man7.org/linux/man-pages/man2/ptrace.2.html)
- [lldb debugserver MachTask.mm: task_for_pid and task_set_exception_ports](https://github.com/llvm/llvm-project/blob/main/lldb/tools/debugserver/source/MacOSX/MachTask.mm)
- [Intel SDM Volume 2: INT n, INTO, INT3, INT1](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Intel SDM Volume 3: debug registers DR0 to DR7 (Debug, Branch Profile, TSC, and Resource Monitoring Features)](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm A64 ISA: BRK, Breakpoint instruction](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/BRK--Breakpoint-instruction-)
- [Arm A64 ISA: TBZ, Test bit and branch if zero](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/TBZ--Test-bit-and-branch-if-zero-)
- [Arm Architecture Reference Manual, D2.9 Watchpoint exceptions](https://developer.arm.com/documentation/ddi0487/latest/)
- [Apple ld(1): -adhoc_codesign](https://keith.github.io/xcode-man-pages/ld.1.html)
- [Apple ld64 LinkEdit.hpp: CS_LINKER_SIGNED](https://github.com/apple-oss-distributions/ld64/blob/59a99ab60399c5e6c49e6945a9e1049c42b71135/src/ld/LinkEdit.hpp)
- [Apple: Debugging Tool Entitlement, com.apple.security.cs.debugger](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.debugger)
- [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [Apple: Resolving common notarization issues, the get-task-allow entitlement](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)
- [Apple: Disabling and Enabling System Integrity Protection](https://developer.apple.com/documentation/security/disabling-and-enabling-system-integrity-protection)
- [Apple Developer Forums: debugserver may not get the taskport of a hardened process](https://developer.apple.com/forums/thread/127544)
- [Apple DevToolsSecurity(8)](https://keith.github.io/xcode-man-pages/DevToolsSecurity.8.html)
- [Apple core(5)](https://keith.github.io/xcode-man-pages/core.5.html)
- [Apple Technical Note TN2124: Mac OS X Debugging Magic, core dumps](https://developer.apple.com/library/archive/technotes/tn2124/_index.html)
- [lldb `process save-core` help text](https://github.com/llvm/llvm-project/pull/143126)
- [core(5), Linux manual page](https://man7.org/linux/man-pages/man5/core.5.html)
- [coredumpctl(1)](https://man7.org/linux/man-pages/man1/coredumpctl.1.html)
- [Apple dtrace(1)](https://keith.github.io/xcode-man-pages/dtrace.1.html)
- [Apple dtruss(1m)](https://keith.github.io/xcode-man-pages/dtruss.1m.html)
- [strace releases](https://github.com/strace/strace/releases)
- [ltrace](https://ltrace.org/)
- [bpftrace CHANGELOG](https://github.com/bpftrace/bpftrace/blob/master/CHANGELOG.md)
- [rr project](https://rr-project.org/)
- [rr 5.9.0 release](https://github.com/rr-debugger/rr/releases/tag/5.9.0)
- [rr wiki: Building And Installing, hardware and VM requirements](https://github.com/rr-debugger/rr/wiki/Building-And-Installing)
- [Clang UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)
- [ISO/IEC 9899:2024 working draft N3220, clause 3.5 undefined behavior](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf)
- [DWARF Debugging Information Format Version 5](https://dwarfstd.org/doc/DWARF5.pdf)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64)](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)
