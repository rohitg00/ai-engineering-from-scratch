# 调用会议和堆框架:系统V,Windows x64和AArch64

> 拆除显示哪些注册表一个函数读取.只有ABI说明这些注册表的意思,ABI由对象标题选择,所以这个课程首先读取标题,然后检查每个注册表与设置它的规则.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and AArch64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow)
**Time:** ~140 minutes

## 学习目标

- 从对象标题中选择调用会议:ELF x86-64是系统V psABI,COFF AMD64是微软 x64,ELF AArch64是AAPCS64,Mach-O arm64是果的变体.
- 解码每个ABI的一个函数的字节字节前序列,并将每个保存的注册表,返回地址和框架指针置于其与输入堆指针的偏移位置.
- 从函数在写入之前读取的函数的参数注册表中输入参数注册表,以及从输入堆指针上方的负载中输入堆参数分区.
- 告诉系统V的独立注册序列从微软x64的位置插槽,以及从AAPCS64的NGRN和NSRN计数器.
- 检查每个推断与源签名,规则在规格,`.pdata`现在`.xdata`其他`.eh_frame`现在,我们要去.
- 比较Ghidra,IDA,二进制忍者,Radar2,Rizin和Angr的名称,并检索相同的数据,记录它们的输出与源头不同的地方.

## 问题

你编译了`convention.c`对于Linux x86-64 的版本`-O2`要求Radar2.2.4提供`eight_args`答案是七个:`rdi`现在`rsi`现在`rdx`现在`r8`现在`r9`现在`rsp+0x8`其他`rsp+0x10`源C有8个参数.字节读取`%rcx`完全一次,在`leaq (%rdx,%rcx), %rax`工具的可变恢复不包括只有在地址内出现的登记器.

然后你在Rizin 0.9.1中打开了同一个文件的Windows版本.`amd64`发现了`r8`现在`rcx`现在`rdx`据说,它是微软的第一个版本,`r9`两种工具都没有相同的源头的不同注册表.

一个列表是一个指令的序列. 呼叫公约是不属于列表的合同:哪些注册表携带参数,呼叫者必须保留,返回地址和堆参数所在地以及呼叫者必须在堆指针上留下的内容. 关于这项合同的定义有四份文件. 系统V AMD64 psABI (版本1.0,版本于2025年3月12日) 3.2.1至 3.2.3节. 微软x64调用会议,堆使用,前和尾尾页 (2018-12-17至2025-03-19页日期). 亚马逊AAPCS64发布2025Q4 (2026年1月23日) 的第6.1至6.9节. 果的"手机64"平台笔记. 这一课程阅读了这些规则,将它们应用到一个三种方式编译的C文件中,并构建了分析器,将列表转化为检查的参数位置,保存的注册表和框架抵消列表.

```figure
re-38-three-frames
```

## 一个头条选出规则书

`convention.c`具有十二个功能:`leaf_add`现在`eight_args`现在`mixed`现在`by_value`现在`big_ret`现在`sum_varargs`现在`keeps`五个电话号召者`extern`结构使用 结构的结构是`long long`因为`long`果Clang 17.0.0从这个机器编译了7次:`-target x86_64-unknown-linux-gnu`现在`x86_64-pc-windows-msvc`其他`aarch64-unknown-linux-gnu`在`-O0`其他`-O2`其他`arm64-apple-macos`在`-O2`没有安装Linux或Windows头,所以文件声明需要的内容,只包含Clang自己的文件.`stdarg.h`其他`stddef.h`现在,我们要去.

`describe_object()`在`code/main.py`读取4字节的魔术数字和一个机器字段,并命名合同:

| Header | Field | Value | Rulebook |
|---|---|---|---|
| `7f 45 4c 46` ELF | `e_machine` at offset 0x12 | 62 | System V AMD64 psABI |
| `64 86` COFF | `Machine` at offset 0 | 0x8664 | Microsoft x64 |
| `7f 45 4c 46` ELF | `e_machine` | 183 | AAPCS64 |
| `cf fa ed fe` Mach-O 64 | `cputype` at offset 4 | 0x0100000c | AAPCS64 with Apple differences |

根据图表的每一行,这三个合同几乎都不同意.每一行值都来自标题行中所指定的文件,每一项都通过对照器进行测试.

| Rule | System V psABI | Microsoft x64 | AAPCS64 |
|---|---|---|---|
| Integer arguments | `%rdi %rsi %rdx %rcx %r8 %r9`, next free register | `RCX RDX R8 R9`, by position | `x0` to `x7`, by NGRN |
| Floating-point arguments | `%xmm0` to `%xmm7`, next free register | `XMM0` to `XMM3`, by position | `v0` to `v7`, by NSRN |
| Integer result | `%rax`, then `%rdx` | `RAX` | `x0`, then `x1` |
| Floating-point result | `%xmm0`, then `%xmm1` | `XMM0` | `v0` |
| Result too large for registers | address passed in `%rdi` "as if it were the first argument", returned in `%rax` | pointer in `RCX`, arguments shifted right, returned in `RAX` | address in `x8`, `x0` to `x7` untouched |
| Callee-saved | `%rbp %rbx %r12` to `%r15` | `RBX RBP RDI RSI RSP R12` to `R15`, `XMM6` to `XMM15` | `r19` to `r29`, `SP`, low 64 bits of `v8` to `v15` |
| First stack argument on entry | `8(%rsp)` | `40(%rsp)`, above a 32-byte shadow store | `0(sp)` |
| Below the stack pointer | 128-byte red zone | "considered volatile" | no red zone (Apple: 128 bytes) |
| Alignment at the call | `(%rsp + 8)` multiple of 16 on entry | 16-byte aligned outside prolog and epilog | `SP mod 16 = 0` |
| Variadic marker | `%al` holds an upper bound on vector registers used | floats duplicated in the integer register | none in registers; Apple uses 8-byte stack slots |

## 系统V:两个独立的注册序列和一个红色区

后,将两个不互动的列表中的注册表分配给. "INTEGER"取"序列的下一个可用注册表 %rdi, %rsi, %rdx, %rcx, %r8 和 %r9". SSE取 `%xmm0`为了`%xmm7`"如果没有任何八字节的论证的注册表,则整个论证被传递到堆上",而记忆论证"被按反向 (右到左) 顺序推到堆上".

`eight_args(a, b, c, d, e, f, g, h)`在`-O2`是27字节:

```text
      10: 48 01 fe                     	addq	%rdi, %rsi
      13: 48 8d 04 0a                  	leaq	(%rdx,%rcx), %rax
      17: 48 01 f0                     	addq	%rsi, %rax
      1a: 4c 01 c0                     	addq	%r8, %rax
      1d: 4c 01 c8                     	addq	%r9, %rax
      20: 48 03 44 24 08               	addq	0x8(%rsp), %rax
      25: 48 03 44 24 10               	addq	0x10(%rsp), %rax
      2a: c3                           	retq
```

六个注册表,然后两个装载.`8(%rsp)`其他`16(%rsp)`图3.3的 psABI将"记忆参数8byte 0"设置在`16(%rbp)`什么时候`%rbp`的底是`8(%rsp)`在任何推进之前进入.`g`现在是8点.`h`在16岁时.

`mixed(int i, double d, long long l, float f)`它们是指指指数,`%edi`其他`%rsi`双和浮动取`%xmm0`其他`%xmm1`首先,要注意,`cvtsi2sd %edi, %xmm2`其他`%xmm2`分析器处理目的地 分析器处理目的地`cvtsi2sd`雷达2做了正确的情况,并报告了`mixed`作为`(double arg1, double arg2, double arg3)`在`xmm0`现在`xmm1`现在`xmm2`现在,我们要去.

`by_value(struct pair p)`通过16字节结构为两个整体8字节`%rdi`其他`%rsi`并且以同样的方式返回:`leaq 0x1(%rdi), %rax; leaq -0x1(%rsi), %rdx; retq`现在,我们要去.`big_ret(long long seed)`返回32字节,即类内存, psABI 表示"调用者为返回值提供空间,并将该存储的地址传递给 %rdi,好像这是第一个参数". `seed`移动到`%rsi`函数开始于`movq %rdi, %rax`因为"返回时, %rax 将包含了调用者在 %rdi 中输入的地址".

红色区域是系统V的另一种签名. psABI 3.2.2: "在%rsp指出的位置之外的128字节区域被认为是保留的,不能通过信号或中断处理器进行修改. "`-O0`现在`eight_args`是`pushq %rbp; movq %rsp, %rbp`然后6家商店到`-0x8(%rbp)`通过`-0x30(%rbp)`没有`subq`商店位于指标的48字节以下.`-O2`构建`sum_varargs`分配了88个字节`subq $0x58, %rsp`然后写注册表保存区在 `-0x58(%rsp)`降到`-0x80(%rsp)`构建相同的文件使用 `-mno-red-zone`其他`leaf_add`获取一个`pushq %rax`其他`addq $0x8, %rsp`保持当地8个字节的位置在堆点指针上.

变量调用添加一个登记器. "%al 是用来指定使用的向量登记器数量的隐藏参数",一个从0到8的上限. `call_varargs`设置它`xorl %eax, %eax`在`-O2`其他`movb $0x0, %al`在`-O0`现在,我们要去.`sum_varargs`首先读到:`testb %al, %al; je`跳八个`movaps %xmmN`在没有使用向量注册表时保存.

## 微软x64:位置,影子商店,没有红色区

微软的规则是定位性的. "整数参数在RCX,RDX,R8和R9注册表中通过.浮点参数在XMM0L,XMM1L,XMM2L和XMM3L中通过."和"任何浮点和双精度参数在前四个参数中通过在XMM0 -XMM3,取决于位置. "`mixed`作为一个`%ecx`现在`%xmm1`现在`%r8`现在`%xmm3`: 区间0是 int,所以`RCX`位1是双,所以`XMM1`子3是浮动的,所以`XMM3`现在,我们要去.`XMM0`其他`XMM2`保持空.

呼叫者必须离开空间. "呼叫者必须总是分配足够的空间来存储四个注册参数,即使呼叫者不需要那么多参数. "页面称之为影子商店或家庭地址,四个插槽是"有效地由呼叫函数拥有". 进入时 `0(%rsp)`是返回地址,`8(%rsp)`为了`39(%rsp)`现在,我们要做什么?`40(%rsp)`现在,我们要去.`eight_args`在`-O2`读书`0x28(%rsp)`现在`0x30(%rsp)`现在`0x38(%rsp)`现在`0x40(%rsp)`其他类型:

电话号码显示了算数.`call8`在`-O2`是`subq $0x48, %rsp`然后在五,六,七,八个店铺.`0x20(%rsp)`为了`0x38(%rsp)`在之前`movl $1, %ecx`对于影子存储器来说,72字节是32字节,对于四个堆参数来说是32字节,`call_varargs`只有注册论点,仍然分配`subq $0x28, %rsp`对于影子店的32个,对配线的8个.`keeps`按三个非波动的注册表 (24 字节) 然后`subq $0x20, %rsp`现在,我们要做什么?`ext`在返回地址下面找到32字节的影子存储器.

结构遵循自己的规则. "任何不适合8字节的参数,或者不是1,2,4,或8字节,必须通过参考. "和"16字节的参数通过参考. "`by_value`因此收到一个指向复印件的指标.`%rdx`后面有隐藏的结果指标`%rcx`: "调用者必须为返回值分配内存,并将一个指针作为第一个参数.`call_pair`建立了副本`0x20(%rsp)`随着`movaps`通过`leaq 0x20(%rsp), %rdx`通过结果缓冲器`leaq 0x38(%rsp), %rcx`读到`.b`返回`0x40(%rsp)`现在,我们要去.

系统或调试器可能在用户调试会话或中断处理器中重写该内存.`-O0` `leaf_add`需要8个字节的当地人,并得到他们.`pushq %rax`在入境时和`popq %rcx`在之前`retq`两个单字节指令而不是一个`subq`其他`addq`堆使用页面定义了可能这样做的页面:"一个页面函数是不需要函数表输入的函数.它不能对任何非波动的注册表进行更改,包括RSP".

"对于vararg或未原型函数,任何浮点值必须在相应的通用注册表中复制. "`sum_varargs`在`-O2`商店`%rdx`现在`%r8`现在`%r9`为了`0x18(%rsp)`现在`0x20(%rsp)`现在`0x28(%rsp)`在一个之后`pushq %rax`其他国家,包括中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,中国,和国, etc.`va_list`是`leaq 0x18(%rsp), %rax`的家`%rdx`首先,我们提出了未知的争论.

## 果改变的情况

AAPCS64 6.8.2 通过两个计数列表进行规则. C.9:一个整体参数"被复制为x[NGRN]中最少的比特"和NGRN增长. C.1 与NSRN的浮点参数相同. C.12:一个复合的最多`8 - NGRN`复式字符"复制成连续的通用注册表".C.13设置"NGRN设置为8",一旦一个参数进入堆,因此之后没有什么返回注册表. `eight_args`使用`x0`为了`x7`没有碰到堆.`mixed`是`w0`现在`d0`现在`x1`现在`s1`现在,我们要去.`by_value`是`x0`其他`x1`进去和出去.

6.9 表示将在注册表中传递的结果"将在同样的注册表中返回",否则"存储区块的地址将作为x8函数的附加参数传递". `big_ret`写道`str x0, [x8]`现在`stur q0, [x8, #0x8]`现在`str x9, [x8, #0x18]`他从来没有写过.`x0`现在,我们要去.`call_big`组件`mov x8, sp`其他`seed`留在里面`x0`由于6.9添加"没有要求电话保持在x8存储的值"和`x8`没有一个论证记录.

6.4.5.2:在公共界面"SP mod 16 = 0".堆完全下降,并且"没有线程可以访问 (阅读或写作) 无活动区域"在下面,因此Linux `-O0` `leaf_add`发射`sub sp, sp, #0x10`在系统V使用红色区的8个字节.

6.4.6定义了框架记录:"在堆上有两个64位值的框架记录...最低的地址双字段应指向前一个框架记录,最高的地址双字段应包含进入当前函数时在 LR 中传递的值. "和"堆框架内的框架记录位置未指定". clang 表示本文件中的两个位置. `keeps`在`-O2`在Linux上,记录在底部,`stp x29, x30, [sp, #-0x30]!; mov x29, sp`相同的函数在`-O0`让它在顶部`sub sp, sp, #0x20; stp x29, x30, [sp, #0x10]; add x29, sp, #0x10`现在,我们要去.

果的 arm64 笔记保持注册表和对齐,并改变框架,红色区和变异性调用. "果指针注册表 (x29) 必须总是处理有效的框架记录.某些功能,如叶子函数或尾声调用,可能选择不创建该列表中的条目."果的构建`keeps`节省`x22, x21, x20, x19`首先,并将记录放在顶部:`stp x29, x30, [sp, #0x20]; add x29, sp, #0x20`"ARM64红色区由直下堆点指针的128字节组成",并且仍然发出了声响.`sub sp, sp, #0x10`对于`-O0`编译器不使用它默认. 变量参数被分配到"适当的8字节堆插槽数量"和"类型 va_list是char*的号. `call_varargs`在果商店, 10, 20, 30 个`[sp]`现在`[sp, #8]`现在`[sp, #0x10]`只有通过`w0`通过Linux构建`w1`现在`w2`现在`w3`随着的声`b extva`果`sum_varargs`读书`add x8, sp, #0x10`电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电话给电`va_list`Linux`sum_varargs`节省`x1`为了`x7`其他`q0`为了`q7`进入224字节的框架并启动结构字段`__gr_offs`到 -56`__vr_offs`只有一个`mov x8, #-0x38; movk x8, #0xff80, lsl #32`现在,我们要去.

马赫-奥将每一个C符号的前为`_`现在,我们要做什么?`_keeps`并且第一个函数在私有标签下出现`ltmp0`分析器将标签重新命名在符号表中.

## 打破一首序言,三次

`keeps(int n)`电话`ext(i)`在循环中保持`n`现在`i`其他`acc`通过通话,所以每个ABI必须保存注册表.`-O2`为了每个目标.

系统V, 4 字节:

1. `55`是`push r64`随着注册表在低三个位: `50 + 5`现在`%rbp`深度8`%rbp`在入口抵消 -8 保存.
2. `41 56`其他`41`是 REX 配合`B`设置`56`是`50 + 6`雷克斯B延长6至14`pushq %r14`在 -16.
3. `53`是`50 + 3`其他`pushq %rbx`在 -24.

返回地址加8个,32是16的倍数,所以`callq ext`循环内部无线`subq`没有.`movq %rsp, %rbp`现在,我们在这个建筑中没有一个.`%rbp`作为保存的电话登记簿`acc`(`xorl %ebp, %ebp`现在`addl %eax, %ebp`镜是章:`5b 41 5e 5d c3`现在,我们要去.

微软x64,7字节:

1. `56`是`pushq %rsi`在 -8 位.`57`是`pushq %rdi`在 -16.`53`是`pushq %rbx`在 -24. 这里所有三个都是不挥发的,`RDI`其他`RSI`它们是系统V的论证登记器.
2. `48 83 ec 20`: REX.W, 专用代码`83 /5`通过8位即时,ModRM`ec`是`11 101 100`其他`subq $0x20, %rsp`深度56

另外,我们可以看到一个字符串,`ext`标签页面只允许"添加 RSP,常数或 lea RSP,常数[FPReg],然后是零或更多的8字节注册表弹出和返回或jmp",字节是`48 83 c4 20 5b 5f 5e c3`现在,我们要去.

简单的4个字节,16字节.

1. `a9bd7bfd`是`stp`预示指数. 位 31:30 `10`选择64位注册表,25:23位`011`选择预索引,位22为0为存储.`1111010`现在,我们可以说,在这个过程中,我们可以说,`sp`),Rt在4:0是29`stp x29, x30, [sp, #-0x30]!`: 堆积指标下降48`x29`升至 -48`x30`现在,我们可以在
2. `f9000bf5`是`str`没有签名的12位偏移量为8: im12在21:10是2,Rn是`sp`现在,Rt是21个.`str x21, [sp, #0x10]`进入的抵消-32.
3. `910003fd`是`add`直接:imm12是0,Rn是`sp`现在,Rd是29`mov x29, sp`图像指针在记录下指出 -48.
4. `a9024ff4`是`stp`通过签署的偏移:imm7是4,扩展到32.Rt2是19,Rt是20.`stp x20, x19, [sp, #0x20]`其他`x20`在 -16, `x19`在 -8

框架为48字节:`x29`在0`x30`在8点.`x21`在16个字节,8个字节,24个字节.`x20`在32岁时,`x19`记录中最小的字指向前一个记录,下一个字保持 LR,如6.4.6要求.`cmp w0, #0x1`时间表器将其移动到序列中,分析器则容忍堆操作之间的比较或算术指令.

## 编译者两次写出相同的事实

编译器发出第二个对解winder,两者必须同意.

在Windows上,第二种衍生式是`.pdata`其他`.xdata`建立一个`-O2`没有物体`-fno-asynchronous-unwind-tables`其他`llvm-objdump -h`表演`.xdata`具有0x34字节的字节和`.pdata`只有0x48字节. 0x48是72,6 `RUNTIME_FUNCTION`包含3个字节的12字节的输入`IMAGE_REL_AMD64_ADDR32NB`六个是`sum_varargs`现在`keeps`现在`call8`现在`call_varargs`现在`call_pair`其他`call_big`其他六个函数是页面,例外处理页面说:"如果搜索找不到函数表的输入,则代码被假定是页面函数的一部分,RSP直接发送返回指针.

其他`.xdata`字节`keeps`是`01 07 04 00 07 32 03 30 02 70 01 60`现在,我们要去.`UNWIND_INFO`开始于3位版本和5位旗:版本1,没有旗. 尺寸OfProlog为7,数OfCodes为4,FramRegister和FramOffset为0.`UNWIND_CODE`对于其他类型的数据,`07 32`置的位置:`UWOP_ALLOC_SMALL`信息3意味着`3 * 8 + 8 = 32`字节`03 30`操作 0 是`UWOP_PUSH_NONVOL`列表3是`rbx`现在,我们要去.`02 70`其他`rdi`现在,我们要去.`01 60`其他`rsi`代码以反向执行顺序存储,它们名称与字节相同的三次推移和32字节分配.`56 57 53 48 83 ec 20`现在,我们要去.`sum_varargs`输入是`01 01 01 00 01 02 00 00`个字节前序列,一个代码,`UWOP_ALLOC_SMALL`机可以看到的就是这样.`pushq %rax`由于:`%rax`没有任何东西被保存.

在Linux上,第二种衍生是`.eh_frame`根据PSABI 4.2.4定义的DWARF 56.4节. `llvm-dwarfdump --eh-frame`在可移动对象上打印每函数一个FDE,并解决了`R_X86_64_PC32`为了使这些区域能够使用.`keeps`其他:

```text
  DW_CFA_def_cfa_offset: +16
  DW_CFA_def_cfa_offset: +24
  DW_CFA_def_cfa_offset: +32
  DW_CFA_offset: RBX -32
  DW_CFA_offset: R14 -24
  DW_CFA_offset: RBP -16
```

号是电话前的堆指标,8在入口堆指标上,所以 `RBP -16`是入口抵消 -8, `R14 -24`只有 -16.`RBX -32`对于AArch64 FDE,则是最深的CFA偏移为32的24字节框架加返地址.`keeps`,,,`DW_CFA_def_cfa: W29 +48`随着`W29 -48`现在`W30 -40`现在`W21 -32`现在`W20 -16`现在`W19 -8`在此,CFA是入口堆指标本身,因此偏移是没有转换的框架偏移,CFA是从`x29`在截图记录的同时.`eh_frame_cross_check()`对于这两个物体的12个FDE进行了这次比较.`call8`在系统V下,它推出两个出发的参数到体中,所以它的最深的CFA偏移是32而它的前框是8,检查比较了体内最深的堆指针,24加8.

## 工具叫什么

根据该领域的每个工具都有调用会议的数据结构和一个将一个函数分配的传递.名称不同,空隙不同.关闭的工具是根据其文档描述的;开放的工具在固定器上运行,其输出被捕获在对象旁边.

**Ghidra 12.1.4 (Apache-2.0).**编译器规格文件中存在规则,`.cspec`的语言旁边.`x86-64-gcc.cspec`声明`<default_proto>`名称`__stdcall`, "从系统V应用二进制接口AMD64架构处理器补充器中提取, 2016年4月",与 `<pentry>`列表`XMM0_Qa`为了`XMM7_Qa`其他`RDI, RSI, RDX, RCX, R8, R9`置,一个堆的入口,在8的偏移,一个`join_dual_class`类型的规则,最大16字节,输出`XMM0_Qa, XMM1_Qa, RAX, RDX`其他`hidden_return`其他地方.`x86-64-win.cspec`声明`__fastcall`只有四个`<group>`配对的元素`XMM0_Qa`随着`RCX`现在`XMM1_Qa`随着`RDX`位置规则,一个堆入口在偏移40`convert_to_ptr`对于3个,5个,6个或7个字节的字节,注释"只有8.16,32,64位的字节才能被包装用于注册",`unaffected`列表`RBX RBP RDI RSI RSP R12`为了`R15`其他`XMM6`为了`XMM15`其他`localrange`子8到39是影子店.`AARCH64.cspec`声明`__cdecl`首条是`x8`随着`storage="hiddenret"`现在`q0`为了`q7`其他`x0`为了`x7`现在`convert_to_ptr`对于17字节或更长的字符,以及`killedbycall`包括`x8`解析器的最后阶段是"建立函数的原型";分析器是"调用会议ID"和"解组件参数ID";程序选项"原型评估"选择默认模型.

**IDA Pro and IDA Free (Hex-Rays, commercial; current release 9.4, build 9.4.260714).**函数类型是通过SetType设置的C声明,并且"IDA将使用类型信息来评论拆除与函数参数信息. "没有标准公约产生的位置是IDA自己的公约中写的: `int __usercall func@<ebx>(int x, int y@<esi>)`结果是`EBX`其他`y`在`ESI`其他`@<^12.4>`按偏移和大小命名堆位置. `__userpurge`清理卡利堆的情况同样.`__spoils`对于碎的套件,`__hidden`现在`__return_ptr`其他`__struct_ptr`对于隐含的论点,这堂课是手动恢复的.`__usercall`单个指令的原型. IDA Free仅支持x86和x86-64.

**Binary Ninja 6.0 "Krypton" (Vector 35, commercial, with a Free edition that decompiles x86, x86_64, ARMv7, and AArch64).**`Platform`"包含与二进制执行环境相关的所有信息,主要是使用的调用公约,操作系统和架构",并包括`linux-x86_64`现在`windows-x86_64`现在`linux-aarch64`其他`mac-aarch64`它们每一个都有一个`default_calling_convention` `CallingConvention`没有`int_arg_regs`现在`float_arg_regs`现在`callee_saved_regs`现在`caller_saved_regs`现在`int_return_reg`现在`high_int_return_reg`现在`float_return_reg`两个标志直接编码本课中的差异:`arg_regs_share_index`"当 True, nth 参数不论其类型,都消耗了整数和浮动注册列表的 Nth 区块",`stack_reserved_for_arg_regs`通过Windows x64调用会议使用的影子/家庭空间.`eligible_for_heuristics`现在`required_arg_regs`其他`required_clobbered_regs`电脑系统的系统是C类型的头.`types/platform/`根据平台名称,每一个平台.

**radare2 6.2.4 (LGPL-3.0, run here).** `afcl`列出了架构插件所知道的会议: `amd64 amd64syscall dlang golang golang_abi0 ms p9 reg swift`对于 x86-64 和 `arm64 dlang golang p9 reg swift`对于AArch64`afc`报告当前函数的规范,`afcr`印记`cc.amd64.arg0: rdi`通过`arg5: r9`其他`ret0: rax`文件名为 SDB 文件`cc-ARCH-BITS.sdb`雷达2选中`amd64`对于ELF对象和`ms`对于COFF对象,这是正确的分区. `afv`列出参数和变量,`afs`在Linux上,`-O2`标题`afv`发现了7个理由`eight_args`掉了`rcx`在它发现的Windows对象上`rcx, rdx, r8`子子,子子,子子.`r9`两个失踪的登记器只出现在一个`lea`接着`mixed`报告`double arg1 @ xmm0, arg2 @ xmm1, arg3 @ xmm2`在Linux上,没有任何争论在Windows上.在AArch64上,它发现了`x0`为了`x7`为了`eight_args`为了`big_ret`它列出了`x0`其他`double arg2 @ d1`在函数读取的位置`x8`并且将一个常数加载到`q1`每一个`afs`签字开始于`void`由于返回类型没有推断.`-O0`任何论据都存储在框架中,`afv`发现了所有八个论点`eight_args`随着`rbp+0x10`其他`rbp+0x18`对于子的对.

**rizin 0.9.1 (LGPL-3.0, run here) and Cutter 2.5.0.** `afcl`列表`amd64 amd64syscall ms reg swift`现在,我们要去.`afc`返回`amd64`对于COFF对象,因此微软的配置文件存在,而不是从格式中选定的. `afi`列出了7个理由`eight_args`在Linux上,再次没有`rcx`在Windows上`r8, rcx, rdx`没有3个堆槽`r9`没有插槽`0x40`现在,我们要去.`afv`没有;列表命令是`afvl`切特是图形前端的Rizin.

**angr 10.0.3 (BSD-2, run here).** `CFGFast`接着是`CompleteCallingConventions(recover_variables=True)`组件`function.calling_convention`为了`SimCCSystemVAMD64`现在`SimCCMicrosoftAMD64`其他`SimCCAArch64`通过二进制格式,`function.prototype`报告还发现了所有8项论点.`eight_args`在所有三个目标上,隐藏的指标`big_ret`在 x86-64 号`(BOT*, long long) -> BOT*`窗户的附属参考结构`by_value`作为`(BOT*, BOT*) -> BOT*`系统V变量`sum_varargs`作为`(long long, ...)`它们的空隙与雷达2不同:`mixed`现在,我回来了.`(long long, long long, double, float)`在系统V和AArch64上,正确的注册表是错误的顺序,因为整数列表在浮动列表之前打印;AArch64 `big_ret`现在,我回来了.`(long long) -> double`现在,我们要做什么?`x8`由于此,没有参加会议,因此,向量商店被阅读.`sum_varargs`返回了16个参数,整个登记器保存区域.

**Others.**霍珀6.6.0是MacOS和Linux的商业拆卸和解译器;它的会议处理没有运行或记录在本课程中.`frame info`其他`register read`编译器探险器显示三个列表来源的旁边,这是最快的方法来确认一个规则,

| Concept | Ghidra | IDA | Binary Ninja | radare2 / rizin | angr | this lesson |
|---|---|---|---|---|---|---|
| The convention object | `prototype` in a `.cspec` | calling convention keyword in the function type | `CallingConvention` on a `Platform` | `afc` name, `cc-ARCH-BITS.sdb` | `SimCC` subclass | `expected_locations(abi, name)` |
| Default per target | `<default_proto>` per cspec | compiler setting | `Platform.default_calling_convention` | `afc=`, `anal.cc` | by format | `describe_object()` |
| Argument registers | `<pentry>` list, `<group>` for positional | `@<reg>` in `__usercall` | `int_arg_regs`, `float_arg_regs`, `arg_regs_share_index` | `cc.NAME.argN` | `ARG_REGS`, `FP_ARG_REGS` | `INT_ARG_REGS`, `FLOAT_ARG_REGS` |
| Shadow store | `localrange` stack 8 to 39 | implicit | `stack_reserved_for_arg_regs` | `cc.ms.argn=stack` | `STACKARG_SP_DIFF` | `STACK_ARG_BASE[WIN64] = 40` |
| Hidden result pointer | `hidden_return`, `storage="hiddenret"` | `__return_ptr`, `__hidden` | return type too large for `int_return_reg` | not modelled | `BOT*` first argument | `HIDDEN_RETURN_REG` |
| Callee-saved | `<unaffected>` | `__spoils` lists the opposite | `callee_saved_regs` | profile | `CALLEE_CLEANUP` and arch | `CALLEE_SAVED` |
| Assigning one to a function | "Call Convention ID" analyzer, "Establish Function's Prototype" | user or type library | heuristic detection with `required_arg_regs` | `afc`, `afva`, `aaft` | `CallingConventionAnalysis` | read-before-write plus the rulebook |

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
```

输出是一个JSON报告. 对于每一个七个对象,它命名格式,机器和ABI,对于每一个十二个函数,它给出了序列字节,存储的注册表,输入抵消,框架大小,框架指标,参数注册表,堆参数抵消,溢出,返回注册表或隐藏指标,呼叫深度,以及呼叫者的出发注册表和存储. 每个函数都以其检查结束:规则,签名的预期值,字节的观察值,以及它们是否一致. 报告以两次反转检查和工具捕获结束. 在84个函数分析中,有489项检查,所有489项都同意.

预期的形状:

```json
{
  "objects": {
    "convention-x86_64-windows-O2": {
      "format": "COFF", "machine": "AMD64", "abi": "Microsoft x64", "checks": "73/73 agree",
      "functions": {
        "keeps": {
          "prologue": ["56  pushq %rsi", "57  pushq %rdi", "53  pushq %rbx", "48 83 ec 20  subq $0x20, %rsp"],
          "frameBytes": 56,
          "savedRegisters": [{"register": "rsi", "entryOffset": -8}, {"register": "rdi", "entryOffset": -16}, {"register": "rbx", "entryOffset": -24}],
          "parameterRegisters": ["rcx"],
          "returnRegisters": ["rax"],
          "calls": [{"callee": "ext", "depth": 56}],
          "checks": [{"rule": "Microsoft x64: the caller must always allocate ...", "expected": "at least 32 bytes ...", "observed": [56], "agree": true}, "..."]
        }
      }
    }
  },
  "sehCrossCheck": ["..."],
  "ehFrameCrossCheck": {"...": "..."}
}
```

阅读`code/main.py`在此顺序:

1. `describe_object()`读取ELF,COFF或Mach-O标题和符号表,返回ABI和函数列表.
2. `parse_listing()`分开了`llvm-objdump -d -r`文字将其分成函数,保持每个调用和跳跃的移动目标,并将评论带有正确语法标记: `#`对于AT&T,`//`其他`;`对于AArch64而言,`#`现在,我们需要一个即时的方法.
3. `effect_x86()`其他`effect_arm()`转换一个指示成读,读地址,写,加载,商店,以及堆指针三角形.最后一个AT&T操作符是目的地;第一个AArch64操作符是目的地,除非在商店,比较和分支. `lea`读取地址,没有加载任何东西.`mov`现在`cvtsi2sd`现在`setcc`没有什么可说的.`xor r, r`电话只写一个,一个电话写出整个波动集,一个预先索引的商店移动.`sp`在接入后和索引后的负载移动之前.
4. `analyze_function()`走上身体一次,到第一个.`ret`它们可以追踪堆积指针的深度在其输入值以下,因此,一个记忆操作系统`disp(%rsp)`进入的抵消`disp - depth`其他`disp(%rbp)`现在`frame_pointer + disp`. 它记录在写前读取的参数类登记,在ABI的第一个堆参数偏移上或以上加载,存储参数登记在框架中,在当前堆指针下访问,以及每次调用的深度.
5. `_return_registers()`读取数据操作符杀死候选人;读取地址基础没有,这就是保持的`rax`活着在`big_ret`在微软x64下,`movq %rcx, %rax`通过商店接着`(%rax)`现在,我们要去.
6. `expected_locations()`应用三个规则簿到C签名:两个系统V列表有八字节类,微软位置插槽有副引用结构,AAPCS64计数有`x8`对于超过16字节的结果.
7. `run_checks()`通过相比较,并添加框架规则:必须保存已保存的注册表,`(rsp + 8) % 16 == 0`或`sp % 16 == 0`在每次通话时,每次微软通话时, 32 字节的影子,在微软和AAPCS64下,没有访问的堆指针下,在系统V下最多 128 字节,以及一个反射的表格,以堆指针回归其输入值.
8. `seh_cross_check()`其他`eh_frame_cross_check()`阅读没有建造的物体的解转数据`-fno-asynchronous-unwind-tables`并且将其与前文解析进行比较.

现在还有三个命令.`python3 code/main.py analyze convention-x86_64-windows-O2 keeps`打印一个函数.`python3 code/main.py object FILE`打印了标题的判决.`python3 code/main.py seh`打印了解码的文件`UNWIND_INFO`对于每个具有一个函数的函数,

## 用它

在你建造的新物体上使用分析器.

1. 跑步`python3 code/main.py object FILE.o`如果头条和你的构建命令不同意,请停止,其中一个是错误的.
2. 捕获`llvm-objdump -d -r FILE.o`阅读前节点字节和保存的注册表,然后比较图片大小与按和 `sub`现在,我们要去.
3. 阅读参数注册表和堆抵消与您的源签名.签名不解释的注册表是一个隐藏的指针,变量标记或痕注册表,分析器误认为这是一个论点.最后一个例子是效果表中的错误.用该指令的一般规则来修复它.
4. 每个检查都会给出一个规则,所以首先要检查的规则,然后是字节,然后是分析器.
5. 两个相一致的衍生是这课产生的最强烈证据.
6. 其他工具安装时,用准确的命令捕获其输出并比较.它同意的,你有三个衍生.它不同的地方,你有一个特定的登记器和一个特定的指示,看看,这是一个发现的课程 35.

## 互动实验室

### 实验室A:一个指示,三个效果

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/code
python3 -q
```

运行:

```python
from main import *
effect(Instruction(0, "48 8d 04 0a", "leaq", "(%rdx,%rcx), %rax"), SYSV)
effect(Instruction(0, "f2 0f 2a d7", "cvtsi2sd", "%edi, %xmm2"), SYSV)
effect(Instruction(0, "a9bd7bfd", "stp", "x29, x30, [sp, #-0x30]!"), AAPCS64)
```

写下每次电话之前你预期的读数,地址读数,写数和堆的三角形.`[sp, #-0x30]!`为了`[sp], #0x30`随着`ldp`看到海从`sp_delta`为了`post_sp_delta`现在,我们要去.

### 实验室B: 保持的框架

```python
info, listing = load_fixture("convention-aarch64-linux-O2")
keeps = analyze_function("keeps", listing["keeps"], info.abi)
keeps.saved
keeps.frame_pointer
[c.to_dict() for c in frame_cells(keeps)]
```

现在,我们可以将这些代码与上面的手机解码进行比较.`convention-arm64-macos-O2`记录移动到 -16,四个注册表坐下来.然后加载`convention-x86_64-linux-O2-fp`阅读`saved`为了`keeps`图标是回来的,也是一个`pushq %rax`只有做一个工作.`(rsp + 8)`在电话中,一个乘以16的乘法.

### 实验室C:混合上读写前

```python
info, listing = load_fixture("convention-x86_64-linux-O2")
mixed = analyze_function("mixed", listing["mixed"], info.abi)
mixed.param_registers
mixed.return_registers
expected_locations(SYSV, "mixed")["parameters"]
expected_locations(WIN64, "mixed")["parameters"]
```

系统V的列表是`rdi, xmm0, rsi, xmm1`微软的列表是`rcx, xmm1, r8, xmm3`现在加载Windows对象,再运行前三行.然后打开Linux对象的Radar2捕捉,`[afv mixed]`找出解释第三个指令.

### 实验室D:机器的第二条意见

```python
for row in seh_cross_check():
    print(row["function"], row["sizeOfProlog"], row["unwindPushes"], row["unwindAllocBytes"], row["agree"])
for row in eh_frame_cross_check("convention-x86_64-linux-O2-eh"):
    print(row["function"], row["cfiSaved"], row["cfiMaxOffset"], row["deepestStack"], row["agree"])
```

找一个`pushq %rax`其他`sum_varargs`在 SEH 表中,并解释为什么解转码将其记录为分配.`call8`在`.eh_frame`现在我们要把32个字母放在桌子上,

## 实践实验室

添加第四个目标和第四个规则.

要求:

- 编译`convention.c`随着`-target x86_64-apple-macos -O2`扩展了它.`describe_object()`阅读马克奥`cputype`系统 V psABI,这是果在x86-64上遵循的,`_`标志前.
- 检查每个函数是否符合系统V的检查.记录前序列中的唯一差异:达尔文在每个优化级别都保持了框架指针.
- 添加一个`-fstack-protector-strong`扩展前标扫描,使利载荷从`%fs:0x28`据当地人所说,`canary`子,和之前的比较`ret`作为保护尾的支票.
- 增加一个测试,当一个鱼店被认为是流失的论点时,
- 写下一个框架`with_canary`在运行分析器之前,手动编写,

成功意味着`python3 code/main.py`报告新物体,每个检查都同意, 保护函数的框架细胞显示了当地人和保存的登记器之间的.

## 教训艺术品

这一课包括`outputs/skill-calling-conventions-and-stack-frames.md`通过它将你构建的对象,其列表和C签名转化为参数位置,框架布局,返回登记器,并检查每一个推断与它依赖的规则和编译器的解散数据.它需要头条的ABI判决,禁止阅读.`cvtsi2sd`或`xor r, r`目的地,并以第一个分歧结束.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

验证应证明:

- 七个物体名称系统V,微软x64,AAPCS64和果arm64的ELF,COFF和Mach-O头
- 每个对象的符号表列出相同的12个函数,`_`预写和`ltmp0`标签已解决
- 列表分析器保持`ext`作为调用目标,并保持AArch64的直接状态,如`#-0x30`完整的
- `leaq (%rdx,%rcx), %rax`阅读两个地址登记簿,没有加载任何东西;`xorl %eax, %eax`其他`cvtsi2sd`仅用于写字;预先索引`stp`动作`sp`在商店前和后索引`ldp`在装载后
- `keeps`在`-O2`是`55 41 56 53`在系统V上,有24字节的框架,没有框架指针,`56 57 53 48 83 ec 20`在微软x64上使用56字节框架,`a9bd7bfd`首位在AArch64上,记录在 -48
- 果的构建将记录设置在 - 16 位,超过4个保存的登记器
- 每个函数都有一个框架指针`-O0`在Linux上,没有任何`-O2`其他`-fno-omit-frame-pointer`通过一个排列推,将它带回来.
- 其他`-O0`页面使用系统V的8字节红色区,`pushq %rax`在微软x64下,以及`sub sp, sp, #0x10`根据AAPCS64规定;`-mno-red-zone`删除红色区使用
- 每个尾都反映了它的序言, 堆积指针又在入口
- `eight_args`读取6个注册表和8和16个分区,四个注册表和40至64个分区,或`x0`为了`x7`在两种优化水平上
- `mixed`是`rdi, xmm0, rsi, xmm1`在V系统和`rcx, xmm1, r8, xmm3`在微软x64下,`xmm0`结果是,
- 16 字节结构在系统 V 和 AAPCS64 的两个登记器中,并通过引用在 Microsoft x64 的隐藏指针后行
- 通过32字节结构返回`rdi`现在`rcx`其他`x8`
- 色的卡利读着`%al`家庭`rdx, r8, r9`在 16, 24, 32,节省`x1`为了`x7`其他`q0`为了`q7`通过果,或阅读了电话给客户的指标.
- 调用者设置预期的登记簿,存储7和8在0和8或5至8在32至56时,零 `%al`对于变量调用,并通过结果缓冲地址在 `rdi`现在`rcx`其他`x8`
- 所有489个检查都符合他们的规则
- 六个`UNWIND_INFO`报表与前文解析相匹配,而叶子没有
- 24个FDE与保存注册的抵消和最深层次的堆指针相匹配
- 工具捕获记录的雷达2`amd64`其他`ms`的`amd64`在COFF对象上,失踪的`rcx`现在,我们要做什么?
- 在站点模块内嵌入的数字数据等于分析器输出量

## 生产失败模式

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| COFF object read as System V | `rdi` and `rsi` as arguments that the function never reads | The header says 0x8664; the convention is Microsoft x64 |
| Register read only inside a `lea` | Seven arguments for an eight-argument function | Base and index registers are reads |
| `cvtsi2sd` destination counted as a read | A third double argument in `xmm2` | The first write to `xmm2` is a write; `mixed` has two SSE arguments |
| Positional slots read as sequences | `xmm0` named as the double argument on Windows | Slot 1 is `XMM1`, slot 3 is `XMM3` |
| `push rbp` taken as a frame pointer | A frame pointer in an `-O2` function that uses `rbp` as an accumulator | Only `mov %rsp, %rbp` after the push creates one |
| Red zone measured from the entry stack pointer | 216 bytes "below the stack pointer" | 128 bytes below the current stack pointer after an 88-byte `sub` |
| Shadow store treated as locals | Stack arguments at 8 to 32 | Microsoft stack arguments start at 40 |
| `lea` treated as a load | A stack argument at `0x60(%rsp)` in a variadic callee | `lea` computes `overflow_arg_area`; it loads nothing |
| Hidden pointer read as a normal argument | `big_ret(void *, long long)` | The pointer is stored through and copied to `rax`, `rax`, or stays in `x8` |
| Deepest CFA compared with the prologue frame | A mismatch on a caller that pushes outgoing arguments | Compare with the deepest stack pointer the body reaches |
| Convention asserted from the ISA | `amd64` for a COFF object | The format picks the rulebook, then the ISA picks the registers |
| Prototype trusted from one tool | Three doubles, or sixteen variadic parameters | The source signature or a second derivation must agree |

## 运营规则

在第一个指令之前阅读标题,并命名规则簿.将每个保存的注册表和每个参数放在输入堆指针的偏移位置,并与设置的规则和编译器为同一框架编写的解缩数据进行检查.将工具原型作为索赔,直到字节或来源确认它.

## 进一步阅读

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Version 1.0 (sections 3.2.1 to 3.2.3, 4.2.4)](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Microsoft x64 calling convention](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention)
- [Microsoft x64 stack usage](https://learn.microsoft.com/en-us/cpp/build/stack-usage)
- [Microsoft x64 prolog and epilog](https://learn.microsoft.com/en-us/cpp/build/prolog-and-epilog)
- [Microsoft x64 exception handling: RUNTIME_FUNCTION, UNWIND_INFO, UNWIND_CODE](https://learn.microsoft.com/en-us/cpp/build/exception-handling-x64)
- [Arm Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), release 2025Q4](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Apple: Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [DWARF Debugging Information Format Version 5, section 6.4 Call Frame Information](https://dwarfstd.org/doc/DWARF5.pdf)
- [Clang driver frame-pointer defaults, `useFramePointerForTargetByDefault` in `CommonArgs.cpp`](https://github.com/llvm/llvm-project/blob/main/clang/lib/Driver/ToolChains/CommonArgs.cpp)
- [Clang command line reference: `-fomit-frame-pointer`, `-momit-leaf-frame-pointer`](https://clang.llvm.org/docs/ClangCommandLineReference.html)
- [Fedora 38 change: frame pointers by default](https://fedoraproject.org/wiki/Changes/fno-omit-frame-pointer)
- [Ubuntu 24.04: performance engineering with frame pointers by default](https://ubuntu.com/blog/ubuntu-performance-engineering-with-frame-pointers-by-default)
- [Ghidra compiler specification: `x86-64-gcc.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-gcc.cspec)
- [Ghidra compiler specification: `x86-64-win.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-win.cspec)
- [Ghidra compiler specification: `AARCH64.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/languages/AARCH64.cspec)
- [Hex-Rays: SetType and the `__usercall` convention](https://docs.hex-rays.com/ida-actions/settype)
- [Hex-Rays: Decompile as call](https://docs.hex-rays.com/ida-actions/hx_userdefinedcall)
- [Binary Ninja API 6.0: `callingconvention` module](https://api.binary.ninja/binaryninja.callingconvention-module.html)
- [Binary Ninja API 6.0: `platform` module](https://api.binary.ninja/binaryninja.platform-module.html)
- [Binary Ninja user documentation: platform types](https://docs.binary.ninja/guide/types/platformtypes.html)
- [The Official Radare2 Book: calling conventions](https://book.rada.re/analysis/calling_conventions.html)
- [The Official Radare2 Book: code analysis](https://book.rada.re/analysis/code_analysis.html)
- [angr documentation: decompiler analysis passes, including calling convention recovery](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)
- [rizin 0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
