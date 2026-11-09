# 拆卸和控制流量:从字节到图表

> 拆除列表是关于哪些字节是指令的索赔,这个课程构建了检查索的解码器和图表.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch)
**Time:** ~150 minutes

## 学习目标

- 根据英特尔SDM卷2章2的规则,将本书固定中的x86-64指令子集解码.
- 证明解码器是否可以使用`llvm-objdump -d`在每一个建筑物的指示上.
- 运行线性扫描和递归下降在相同的字节上,并解释每个字节是错误的地方.
- 切割指令成基本块,并用键字边形构建控制流图.
- 通过库珀,哈维和肯尼迪的反复算法计算直接主导者,
- 通过转移的输入,从其表上点的目标中恢复间接跳跃.

## 问题

你编译了`ledger.c`在`-O0`问一个代理人什么`grade`经纪人打电话给拆卸器,阅读了列表,并回答说,`jmpq *%rax`没有任何已知的目标.`return 0`现在,我们要去.

你打开了同一个物体.`llvm-objdump -d`它们在列表中一直存在. 列表中没有什么说明执行如何达到它们,所以工具把它们视为死码.

列表只能回答一个问题:哪个字节从哪个命令中运行.它不说明哪个命令运行,在哪个顺序或从哪个地方.

电动机6.5.0没有自主拆卸器. 为了进行深入分析,它的 README 要求你带来Ghidra,Hopper或IDA. 对于离线检查, rea还可以调用一个安装的 GNU 文件或Rizin. 它的呼叫图在未解决的目标上停止:"呼叫/呼叫只包含已解决的函数.... 无目标计算流量仍然是未知的. 这一课程建立了这些事实的部分,

```figure
re-33-sweep-vs-descent
```

## 指示格式每个字段都有一个规则

图2-1显示每个指令的字节顺序. 首先是可选的预设,然后是1到3个opcode字节,然后是可选的ModRM字节和可选的SIB字节. 随后,一个移动为0,1,2或4字节,然后一个直接的0,1,2或4字节. 整个指令最多为15字节 (SDM 2.3.11). 简单的数据表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表

每个字段决定了下一个字段意味着什么.因此,一个解码器是一个小决策链,每个决策背后的手册中有一个句子.

### 预सर्ग分为四组

 SDM 2.1.1列出了遗留前置.`F0`锁和重复前置`F2`其他`F3`组2拥有6个段的重点 (`2E`是`%cs`集团3是`66`组4是`67`现在,我们需要一个解决方案.

编译器发射更多. 排列填充在`ledger-x86_64-O0.o`在抵消`0xf2`读书`66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00`五份复印件`66`在一排.`llvm-objdump`打印成`nopw %cs:(%rax,%rax)`解码器收集了看到的每一个字节前置,然后问了哪些字节有意义.

`66`对于SSE指令,它是必须的前,选择了opcode,所以`66 0f ef c0`是`pxor %xmm0, %xmm0`没有16位的任何东西.`F3 0f 6f`是`movdqu`解码器首先查找强制前和第二个字节字节.只有当该对没有输入时才会`66`意思是16位的操作.

###  REX 添加了4个位,必须坐下 opcode 旁边

 SDM 2.2.1 定义REX为从 个字节中一个字节`40`为了`4F`具有形状的`0100WRXB`现在,我们要去.`W`选择一个64位操作数. `R`扩大ModRM监管领域. `X`扩大SIB指数领域. `B`扩展ModRM r/m字段,SIB基段或 opcode byte中的注册表 (表2~4). REX必须在 opcode或 escape byte之前出现,而忽略一个 REX 后续由一个遗留前置.

在`48 89 e5`字节`48`是 REX 配合`W`设置. 操作码`89`是`MOV r/m, r`其他`e5`选择`%rsp`进入`%rbp`删除REX,然后相同的字节是`movl %esp, %ebp`现在,我们要去.

随着 REX 的出现,选择编码 4 到 7 个字节.`%spl`现在`%bpl`现在`%sil`其他`%dil`没有`%ah`现在`%ch`现在`%dh`其他`%bh`解码器可以保存两个表格.

### 两张地图中有双码

常见的情况是一个字节的操作代码.`0F`通过两个字节的地图,`0F 38`或`0F 3A`某些opcode使用ModRMreg字段作为另外三个opcode位,写成`/digit`在手册中.`83 /7`是`cmp`具有8位即时的,`83 /5`是`sub`其他`FF /4`是间接的`jmp`现在,我们要去.

解码器在`code/main.py`列表包括四个固定物体中的光码以及几个邻居.`mov`现在`lea`现在`movslq`现在`movzbl`现在`imul`轮,`test`其他`idiv`继续说道`push`现在`pop`现在`call`现在`ret`十六个条件跳跃,多字节`nop`其他任何opcode都会增加`DecodeError`猜测的解码器比停止的更糟糕.

### 摩德瑞姆和SIB选择操作数

 SDM 2.1.3 分为ModRM`mod`子,子,子,子`reg`其他地方`r/m`其他国家`mod = 11`意思是 r/m 是一个注册表. `mod = 00`现在`01`其他`10`没有移动,8位移动或32位移动的平均内存. `r/m = 100`意思是一个SIB字节后面.SIB分为 `scale`其他地方`index`其他地方`base`平均水平为`100`没有指数登记.

在表2-2中,两个特殊行在64位模式下. `mod = 00`随着`r/m = 101`没有`(%rbp)`对于下一个指令,它是32位的移动 (SDM 2.2.1.6).`mod = 00`具有SIB基础`101`没有基数注册的32位移动.

接下来`8d 44 08 fa`其他`grade`在`-O0`电脑的代码`8D`是`lea`们的们`44`是`01 000 100`位:一个8位的移动,reg `%eax`之后,一个SIB.`08`是`00 001 000`: 规模1,指数`%rcx`基础`%rax`移动字节`fa` AT&T 的文字是`leal -0x6(%rax,%rcx), %eax`计算的`score / 10 - 6`切换指数

### 转移是链接编辑写的位置

`48 8d 0d 00 00 00 00`是`leaq (%rip), %rcx`转移式对象中,它们是位置持有者. 输入中`.rela.text`在抵消`0x69`,,,`R_X86_64_PC32.rodata-0x4`根据 psABI (表 4.9) 的定义`R_X86_64_PC32`作为`S + A - P`:符号地址加上添加式减去字段地址.

处理器将该字段添加到下一个指令的地址,所以最终目标是`S + A + (end - P)`为了这个`lea`字段是最后四个字节,所以`end - P`目标是`.rodata + (-4) + 4 =.rodata + 0x0`电灯中的每一个RIP相对操作数都包含这个 -4在其添加中,所以`.rodata+0x10`在`-O1` `lea`平均`.rodata+0x14`现在,我们要去.

解码器记录每个指令内移动场的偏移. `resolve_reference()`转换表中的运行函数是转换函数.`leaq (%rip), %rcx`在"在桌子上`.rodata+0x0`"我知道.

### 直接的最大位数为32位,除了一个例外

 SDM 2.2.1.5 表示,即时保持在64位模式中最多32位,并且具有扩展信号.`MOV r64, imm64`(`B8+r`随着`REX.W`), AT&T的语法称之为`movabsq`解码器读取8位即时的字符号为算术 (`83 c1 fa`是`addl $-0x6, %ecx`) 和未签名的转班计数和混动选项 (`pshufd $0xee`这分别与什么相匹配?`llvm-objdump`他们的指纹.

靠近的树枝,`push`其他`pop`默认为64位操作系统,并忽略`66`(SDM 2.2.1.7) 这就是为什么解码器给它们命名的原因.`pushq`现在`popq`现在`callq`其他`retq`没有读到一个大小的预写.

## 通过手动解码一条指令

在你信任代码之前,解码`48 69 c0 67 66 66 66`其他`grade`在纸上.

1. `48`现在`40`为了`4F`现在,我们要做什么?`W = 1`演唱器尺寸是64位.
2. `69`是`IMUL r, r/m, imm32`现在,我们要去.
3. `c0`是ModRM`11 000 000`: 登记表,法令`%rax`子`%rax`现在,我们要去.
4. 接下来的四个字节是直接的,小的:`0x66666667`现在,我们要去.
5. 现在,我们要做什么?`imulq $0x66666667, %rax, %rax`现在,我们要去.

这就是7个字节,`llvm-objdump`常数是对方的,使得分为10乘以乘法,`sarq $0x22`在第34课中,你会再次遇到这对,`score / 10`现在,我们要去.

解码器在`Decoder.decode()`现在`_State.modrm()`其他`_State.finish()`按照顺序阅读,并将每个分支与其文件串中命名的 SDM 部分匹配.

## 线性扫描

施瓦茨,德布雷和安德鲁斯在"拆除可执行代码复制" (WCRE 2002) 节3.1中描述了线性扫描. 开始于代码节目的第一个字节,解码一个命令,继续在字节之后,并在结束时停止. `objdump`现在,我们在做什么?`llvm-objdump`现在,我们要去.

```python
def linear_sweep(code: bytes, start: int = 0, end: int | None = None) -> SweepResult:
    position = start
    while position < end:
        try:
            instruction = decode(code[:end], position)
        except DecodeError:
            undecodable.append((position, code[position]))
            position += 1
            continue
        instructions.append(instruction)
        position = instruction.end
```

方法有一个失败模式,论文的图1显示. 数据的字节被解码为指令,然后解码器会错过实际指令的边界. 在x86上,解码器通常在几字节内重新同步,这使得错误很难看到. 检测只发生在不有效的操作码上, 这篇论文的结论是, 这些算法"默默失败".

扫描也是这个课程的预言.`llvm-objdump -d`在每一个命令,每一个命令,`llvm-objdump` captured 文字生活在`code/fixtures/*.objdump.txt`测试分析每个行以地址,字节和文字, 之后放弃评论`#`它们包含86,56,84和11个指令,总共237,并且解码器匹配它们.

## 复发性下降

同样论文的3.2节称第二种方法为复习穿越.从已知入口点开始,然后解码到控制转移.对于直接跳跃,继续到目标.对于条件分支,继续到目标和下一个指示,并且对于呼叫,继续之后,因为呼叫回来.为了回来,停止.保持一组访问的地址,以便步行结束.

```python
if instruction.flow == "branch":
    worklist.append(instruction.target)
    address = instruction.end
elif instruction.flow == "indirect-jump":
    table = resolver(instruction, instructions) if resolver else None
    if table is None:
        unresolved.append(instruction)
        break
```

失败模式是相反的.间接跳跃没有字节目标.行走停留在那里,每一个只有通过跳跃可达的块都不知名.论文的图2显示第二种危险:一个目标集来自转移指向指令中部.`main.py`记录这个案例作为冲突,并阻止了这一路径,所以重叠是可见的,而不是默默解码两次.

安德里斯和其他人测量了981个编译器生成的二进制器上的9个拆卸器 (USENIX Security 2016).直线数据和重叠代码在实际编译器输出中比文献所假设的更少,硬原始是函数边界恢复.请记住这两项发现.下一节的陷在编译器输出中很少.间接跳跃在`grade`常见的.

## 片是错误的,下坡是正确的

`code/fixtures/sweep-trap.s`函数体内有4字节表的24字节手写组件.`movzbl (%rcx,%rax), %eax`跳过了它.

```asm
lookup:
        movslq  %edi, %rax
        leaq    .Ltable(%rip), %rcx
        movzbl  (%rcx,%rax), %eax
        jmp     .Ldone
.Ltable:
        .byte   0x31, 0xc0, 0x90, 0x48
.Ldone:
        addl    $1, %eax
        retq
```

用它建造`clang -target x86_64-unknown-linux-gnu -c sweep-trap.s`图表的四个字节被选为可行的指示.`31 c0`是`xorl %eax, %eax`现在,我们要去.`90`是`nop`现在,我们要去.`48`是一个REX前,所以扫描将它与真实的三个字节相结合`addl $1, %eax`其他信息`addq $0x1, %rax`捕获者`llvm-objdump`输出显示出:

```text
       e: eb 04                        	jmp	0x14 <lookup+0x14>
      10: 31 c0                        	xorl	%eax, %eax
      12: 90                           	nop
      13: 48 83 c0 01                  	addq	$0x1, %rax
      17: c3                           	retq
```

任何字节都被解码,每一个字符都是真实的,`retq`现在,这个名单仍然是错误的,`0xe`目标`0x14`列表中没有任何指令从`0x14`命令是运行在`0x14`是一个32位的`addl`列表显示64位`addq`图表的四个字节显示为代码.

代的回归`lookup`符号解码了六个指示, 接下来跳到`0x14`报告`addl $0x1, %eax`它没有要求任何4个表字节和8个填充字节.`plus_one`现在,我们要去.`trap_report()`在`main.py`打印了比较:

```json
"linearSweep": {
  "instructions": 9,
  "atJumpTarget": {"starts": "0x13", "text": "addq\t$0x1, %rax", "startsAtTarget": false},
  "claimedDataBytes": 4,
  "claimedPaddingBytes": 8
},
"recursiveDescent": {
  "instructions": 6,
  "atJumpTarget": "addl\t$0x1, %eax",
  "claimedDataBytes": 0,
  "claimedPaddingBytes": 0
}
```

测试`test_sweep_and_objdump_share_the_same_mistake`证实这一点`llvm-objdump`打印`addq $0x1, %rax`在`0x13`预言器是线性扫描,继承其盲点.与预言器的协议检查解码器,下降检查命令运行.

## 基本块

艾伦在"控制流量分析" (1970) 中定义了基本块.它是一个指令序列,只输入在第一条指示时,只留在最后.雅克丹和其他人重新在"No More Gotos" (NDSS 2015) 的II.A.2节中解译,标题节点作为函数输入.

构建是通过两个通过扫描解码的指示,按地址进行排序.第一通过收集领导人.领导者是进入,分支或跳跃目标,桌面目标或任何控制转移后的指示.第二通过在每个领导者和地址序列中的每个空隙中启动一个新的区块.

```python
for instruction in self.instructions:
    if instruction.address in leaders or current is None or current.end != instruction.address:
        current = Block(instruction.address, [])
        self.blocks[instruction.address] = current
    current.instructions.append(instruction)
```

边从每个块的最后指示. 返回没有继任者. 一个跳跃有一个,标记`jump`条件分支有两个,标记`taken`其他`fallthrough`单个单个指令在一个区块的最后传递到下一个区块,当下一个指令是分支目标时,这种指令发生.`table`区块是记录在`unresolved`现在,我们要去.

另一方面,我们还能看到两个事实.`grade`在`-O0`它们的区块是从陷中出现的重叠案例.

## 控制流量图

`total`在`-O1`是31字节和13个指令:

```text
      40: 85 f6                        	testl	%esi, %esi
      42: 7e 18                        	jle	0x5c <total+0x1c>
      44: 89 f1                        	movl	%esi, %ecx
      46: 31 d2                        	xorl	%edx, %edx
      48: 31 c0                        	xorl	%eax, %eax
      4a: 66 0f 1f 44 00 00            	nopw	(%rax,%rax)
      50: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
      53: 48 ff c2                     	incq	%rdx
      56: 48 39 d1                     	cmpq	%rdx, %rcx
      59: 75 f5                        	jne	0x50 <total+0x10>
      5b: c3                           	retq
      5c: 31 c0                        	xorl	%eax, %eax
      5e: c3                           	retq
```

领导人是`0x40`其他地方`0x44`(在`jle`), `0x50`其他国家`jne`), `0x5b`(在`jne`),以及`0x5c`其他国家`jle`五个街区,五个边缘:

| From | To | Kind | Why |
|---|---|---|---|
| `0x40` | `0x44` | fallthrough | `jle` not taken, count is positive |
| `0x40` | `0x5c` | taken | count is zero or negative, return 0 |
| `0x44` | `0x50` | fallthrough | the `nopw` is alignment inside the block, execution passes through it |
| `0x50` | `0x50` | taken | `jne 0x50`, the loop |
| `0x50` | `0x5b` | fallthrough | loop exit, return the sum |

六字节`nopw`在`0x4a`圈的方向是的`0x50`它们可以访问,所以它们属于区块.`0x44`单字节`nop`在`0x5f`在最后一次之后`retq`扫描功能就会造成第六个块,`unreachable()`列出了它.

在`-O2`并且在一个函数中,它具有两个循环的 140 字节.`0x80`通过时添加8个值`paddd`的残留量在`0xc0` CFG 有两个后边,`0x80 -> 0x80`其他`0xc0 -> 0xc0`测试套房检查了两者.

## 具有反复算法的统治者

一个街区`d`控制一个区块`b`每个路由从入口到`b`通过`d`直接统治者`b`是主导者`b`它们最接近`b`概念可以追溯到普罗塞 (1959) 到艾伦 (1970),`if`其他`while`没有错.

库珀,哈维和肯尼迪写了"简单,快速的统治算法" (2001). 他们认为,数据流式,以紧的表示运行在反向后序,超过了伦加瓦尔-塔尔扬 (1979) 在大约一千个节点下的图表. 他们的论文说,它的目的是"不提出新的算法". 它表明,简单的算法可以在实践中取得胜利, 函数CFG几乎从来没有一千个节点.

```python
def intersect(first: int, second: int) -> int:
    while first != second:
        while number[first] > number[second]:
            first = idom[first]
        while number[second] > number[first]:
            second = idom[second]
    return first

changed = True
while changed:
    changed = False
    for start in order[1:]:
        processed = [p for p in self.predecessors(start) if p in idom]
        candidate = processed[0]
        for other in processed[1:]:
            candidate = intersect(other, candidate)
        if idom.get(start) != candidate:
            idom[start] = candidate
            changed = True
```

`number`按每块的反向后排位置,输入为 0. `intersect`报纸写出了与后排数的比较,`<`这代码使用反顺序后号码,所以比较是`>`其他一切都遵循报纸的伪码.

为了`total`在`-O1`结果是`idom(0x44) = 0x40`现在`idom(0x50) = 0x44`现在`idom(0x5b) = 0x50`其他`idom(0x5c) = 0x40`边缘`0x50 -> 0x50`后边是循环的标志,因为其目标主导其源头.`back_edges()`检测结果`test_dominators_on_a_hand_built_diamond_with_a_loop`运行相同的代码在16字节的序列上,`intersect`他看到两个前任.

## 跳板表在 -O0级

在`-O0`编译了`switch`在`grade`对于位置独立的跳表语法:

```text
      5d: 83 e8 04                     	subl	$0x4, %eax
      60: 77 38                        	ja	0x9a <grade+0x6a>
      62: 48 8b 45 f0                  	movq	-0x10(%rbp), %rax
      66: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000069:  R_X86_64_PC32	.rodata-0x4
      6d: 48 63 04 81                  	movslq	(%rcx,%rax,4), %rax
      71: 48 01 c8                     	addq	%rcx, %rax
      74: ff e0                        	jmpq	*%rax
```

阅读它作为四个事实.`subl $0x4`接着是`ja`是一个限制检查:超过4的指数进入默认情况下`0x9a`现在,我们可以看到一个图表,`leaq`随着其迁移,将表地址放入`%rcx`之前的部分显示了该地址是`.rodata+0x0`现在,我们要去.`movslq`                                        `addq`增加表基,因此每个输入是表到其盒子区块的距离.

在对象文件中,每个表字节为零.目标只存在于`.rela.rodata`其他:

```text
RELOCATION RECORDS FOR [.rodata]:
OFFSET           TYPE                     VALUE
0000000000000000 R_X86_64_PC32            .text+0x91
0000000000000004 R_X86_64_PC32            .text+0x8c
0000000000000008 R_X86_64_PC32            .text+0x87
000000000000000c R_X86_64_PC32            .text+0x82
0000000000000010 R_X86_64_PC32            .text+0x86
```

申请`S + A - P`进入`k`在抵消`4k`存储值为`.text + A - (.rodata + 4k)`代码还添加了`.rodata + 0`目标是:`.text + A - 4k`输入0是`0x91 - 0 = 0x91`输入1是`0x8c - 4 = 0x88`进口2是`0x87 - 8 = 0x7f`条目3和4是`0x82 - 12 = 0x76`其他`0x86 - 16 = 0x76`根据第6例,第7例,第8例,第9例和第10例,`score / 10`按一行,包括9和10的共享案例.

`recover_table()`现在,我们可以做这个算法.`jump_table_resolver()`合了语的反向`jmpq`它找到了`addq`那些人是"`movslq`子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子`leaq`创造了基础,和边界.`ja`随着下降,将四个不同的目标推进,并继续. 链接的执行式表中有最终值,没有转移. 同样的函数然后读取签署的32位输入,并添加表地址,`evidence`记录了目标的路径.

关于`grade`在`-O0`根据`python3 code/main.py cfg code/fixtures/ledger-x86_64-O0.o grade`其他:

| Method | Instructions | Blocks | Edges | Bytes | What is wrong |
|---|---|---|---|---|---|
| linear sweep | 34 | 9 | 7 | 118 code + 10 padding | 5 unreachable blocks, no edge into the four case blocks, padding decoded as `nopw` |
| recursive descent | 25 | 3 | 2 | 82 code | 36 code bytes never reached, `jmpq *%rax` at `0x74` unresolved |
| descent with the table | 33 | 8 | 11 | 118 code | nothing |

随着桌子的统治者树完成了.`idom`每个案例的区块是`0x62`起的路线.`idom`其他`0xa1`是一个入口`0x30`由于从 `0x9a`达到`0xa1`没有过来.`0x62`现在,我们要去.

## 优化器对 -O1的评分做了什么

你会看到`grade`字节说出一些更具体的东西.`-O1`其他`-O2`没有间接跳进`grade`任何:

```text
      2c: 83 f9 04                     	cmpl	$0x4, %ecx
      2f: 77 0c                        	ja	0x3d <grade+0x2d>
      31: 89 c8                        	movl	%ecx, %eax
      33: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000036:  R_X86_64_PC32	.rodata+0x10
      3a: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      3d: c3                           	retq
```

移动补充`0x10`加上通常的4将桌子放在`.rodata+0x14`负载很平坦`movl`现在,我们可以看到`01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 04 00 00 00`编译器将五个案例块取代为五个返回值的表. 有一个迁移,一个表,和一个边界检查.控制流量是三个区块和三个边缘,一个条件分支. `find_value_tables()`报告为`value-table`包含条目`[1, 2, 3, 4, 4]`其他`evidence: "bytes"`现在,我们要去.

`grade_label`在`-O2`们的们,`labels`列五个字符串指针成为一个五个32位的偏移表`.rodata+0x0`每个条目都包含一个`R_X86_64_PC32`函数将表地址添加到它加载的输入中. `recover_table()`读出五个搬迁和退款抵消`0, 2, 4, 6, 8`进入`.rodata.str1.1`它们可以保持`F`现在`D`现在`C`现在`B`其他`A`复制跳转表的算法还原了相对数据表,因为这两个都是`S + A - P`在已知的抵消中.

两个构建中的教训是命名字节显示的内容.一个跳转表改变控制流图.一个值表改变负载.称两个"开关"隐藏了教训34必须重建的差异.

## 雷亚和吉德拉给你什么

rea 6.5.0 与Ghidra 12.1.4提供商返回函数的列表文本`procedure_assembly`像一个弦一样.`inspect_native_instruction`返回一个指令的字节,长度,解码文本,操作符号,输入的引用和流量,返回是从p代码中分类的. `xrefs`返回从Ghidra的排序的唯一源地址`ReferenceManager.getReferencesTo`现在,我们要去.`analyze_function`携带CFG和`body`对于该函数.`procedure_info`报告指出, "空白和共享尾巴不应被视为拥有字节".

实际分析的分析标签是"Ghidra的复制性下降"以及其分析器,`instruction_flow_evidence`现在`function_references`其他`jump_table_evidence`结果因此命名了它产生的规则.它不能做的就是展示其工作.当Ghidra不找到表时,流量是"未知的",并且对调用者,调用者和CFG缺乏案例块.

你现在有工作了.`python3 code/main.py cfg`在同一对象上,比较区块开始,边缘计算,以及恢复表与提供商返回的.如果他们同意,你有两个独立的衍生.如果它们不同,你有一个特定的地址,看看,这是什么课35记录为未知的.

编码器作为程序的说明.Capstone 6.0.0-Alpha10 (2026-07-21) 固定的离界限在CVE-2026-55893和CVE-2026-55894下读取和写入,以及5.0.9 (2026-05-28) 后载的CVE修正.一个编码器读取未写的字节.15字节限制,切割检查在`_Cursor.byte()`拒绝猜测一个未知的保护代码`main.py`由于它不是为什么建造的.

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
```

输出是一个JSON报告.对于每个固定对象,它给出了预言协议.对于每个函数,它给出了指令,区块和边缘计算在三个方法下.它还列出无法达到的区块,未解决的间接跳跃,后边缘,直接主导者和任何表.它结束了陷比较.

预期的形状:

```json
{
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "oracle": "86/86 instructions agree with llvm-objdump",
      "functions": {
        "grade": {
          "range": "0x30-0xa6",
          "paddingBytes": 10,
          "linearSweep": {"instructions": 34, "blocks": 9, "edges": 7, "unreachableBlocks": ["0x76", "0x7f", "0x88", "0x91", "0xa6"], "...": "..."},
          "recursiveDescent": {"instructions": 25, "blocks": 3, "edges": 2, "unresolvedIndirectJumps": ["0x74"], "...": "..."},
          "recursiveDescentWithTables": {"instructions": 33, "blocks": 8, "edges": 11, "...": "..."},
          "tables": [{"kind": "jump-table", "table": ".rodata+0x0", "count": 5, "entries": ["0x91", "0x88", "0x7f", "0x76", "0x76"], "evidence": "relocation", "...": "..."}]
        }
      }
    }
  },
  "sweepTrap": {"...": "..."}
}
```

阅读`code/main.py`在此顺序:

1. `ElfObject`阅读部分标题,符号,`.rela.*`报名,以及`symbolize()`给路上的地址.`llvm-objdump`没有.
2. `Decoder.decode()`读取前置和REX,然后在一字节或两字节的光码地图上发送.
3. `_State.modrm()`读取ModRM,SIB和移动,并记录移动场的偏移.
4. `resolve_reference()`适用`S + A - P`转移到一个流离失所或即时的场地.
5. `linear_sweep()`其他`recursive_descent()`两种方法,每一种都记录了其故障.
6. `recover_table()`其他`jump_table_resolver()`通过其移动或字节来阅读表.
7. `ControlFlowGraph`构建领导者,块和打字边缘,`dominators()`它们是反复算法.
8. `analyze_function()`运行每个方法在一个函数上`compare_with_oracle()`检查解码器.

另外还有两个命令.`python3 code/main.py disasm FILE.o`印出每一个具有转移目标的指令后的列表. `python3 code/main.py cfg FILE.o FUNCTION`打印一个函数的分析.

## 用它

在新物体上使用这三个顺序的方法.

1. 首先,运行神经比较.`llvm-objdump`在一个简单的命令上有一个错误,每一个后来的结构都继承了它.
2. 运行从每个函数符号中递归下降,然后读取`unresolved`每个进口都是一个间接的跳跃或呼叫,
3. 对于每一次未解决的跳跃,请查找表格语和指向它的移动.如果语法不匹配,请在跳跃前阅读字节,并写下你所看到的.这笔记是第35课中的第一个未知.
4. 扫描和下降字节的比较字节.只有扫描要求的字节是填充或数据.没有要求的字节是不可到达的或属于你没有找到的函数.
5. 通过恢复的表格,从下降中构建CFG,然后阅读后边.每个边都是一个循环,课34将变成`while`或`for`现在,我们要去.

随着这些物体的保存,当你转移到新的编译版本时,重新捕获它们,因为改变列表是改变的固定.

## 互动实验室

### 实验室A:在纸上解码,然后检查

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow/code
python3 -q
```

运行:

```python
from main import *
decode(bytes.fromhex("48 8d 0d 00 00 00 00"), 0).text
decode(bytes.fromhex("8d 44 08 fa"), 0).text
decode(bytes.fromhex("66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00"), 0).length
```

在每次电话之前,写下你预期的内容.`48`试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试`decode(bytes.fromhex("0f 0a"), 0)`阅读`DecodeError`现在,我们要去.

### 实验室B:搬迁在一个地方

```python
elf = load_fixture("ledger-x86_64-O0.o")
code = elf.section(".text").data
lea = decode(code, 0x66)
lea.displacement_offset
resolve_reference(elf, lea)
```

参考文献中说`.rodata+0x0`改变地址为`0x116`在`grade_label`阅读参考文献`.data`然后解码了`callq`在`0x10e`现在的场地带着`R_X86_64_PLT32 grade-0x4`解决目标是`0x30`现在,`grade`现在,我们要去.

### 实验室C:观察两个方法不同意

```python
trap = load_fixture("sweep-trap.o")
text = trap.section(".text").data
[i.text for i in linear_sweep(text, 0, 0x20).instructions]
[i.text for i in recursive_descent(text, [0], 0x20).sorted_instructions()]
```

计算每个列表中的指令,然后找到从`0x13`然后将最后一个表字节换成`sweep-trap.s`其他`0x48`为了`0xe8`现在扫描吞了`addl`其他`retq`进入一个`callq`函数似乎没有返回.

### 实验室D:手动控制者

```python
analysis = analyze_function(load_fixture("ledger-x86_64-O1.o"), "total")
analysis.cfg.edges
analysis.cfg.reverse_postorder()
analysis.cfg.dominators()
analysis.cfg.back_edges()
```

在看结果之前,绘制五个块在纸上,计算统治者.然后运行相同的四行.`grade`在`-O0`解释为什么`idom(0xa1)`是`0x30`没有`0x62`现在,我们要去.

## 实践实验室

增加间接调用地点,扩大分析.

要求:

- 写一个C函数,通过一个从小数组中选出的函数指针调用.`-O0`其他`-O1`它们的物体与它们的物体相结合.`llvm-objdump`给我一个短信.
- 让解码器与两个对象的 Oracle 一致.只需要在设备中的指令时添加光码.
- 延长时间`recursive_descent()`因此,间接调用记录了调用地点.`calls`随着`None`作为目标,并继续追逐它.
- 写一个解析器,通过其移动读取函数指针阵列并报告可能的调用.
- 添加调用设置到函数报告中,如 `indirectCalls`根据每个目标的证据.
- 写一个测试,当解决器返回非函数符号的目标时,它会失败.

成功意味着`python3 code/main.py cfg`给每一个可能的电话,以及证明的移动,

## 排名实验室

找到你构建的代码,然后写在`code/lab_answers.json`写数字作为数字或六字符串,例如`"0x40"`它们是JSON列表.

1. `t1`指示:在 -O1级下降复发式解码.
2. `t2`基本块总量在 -O1
3. `t3`: 循环头的总地址在 -O1上,为 hex.
4. `t4`:在 sweep-trap.o 中,直线扫描说明包含0x14的地址开始,如hex.
5. `t5`排列表中 -O0的入口

检查你的答案:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/lab.py
npx tsx code/lab.ts
```

检查器从 计算出每一个预期值`code/main.py`它们在已完成的设备上.`PASS`现在`FAIL`或`TODO`只有五个任务都通过时,它才会出于0.`python3 code/lab.py my-answers.json`检查另一个文件.`code/tests/test_lab.py`证明检查员接受正确的答案,却拒绝错误的答案.

### 看它运行

其他[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?program=trap&sweep=linear)机器将这个课程运行为其解码床和块板.`sweep-trap.o`线性扫描:床显示四个数据字节被解码为代码,一个标记跳跃目标在`0x14`在内`addq`在`0x13`调动解码器到回归降值,看看跳跃跳过数据.

## 教训艺术品

这一课包括`outputs/skill-disassembly-and-control-flow.md`通过它将对象和函数名称转化为检查列表,区块,打字边缘,主导器和任何未解决的转移.它需要预言比较,拆除方法,字节会计,每个恢复表的迁移证据以及未知的情况的声明.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

验证应证明:

- 解码器同意`llvm-objdump -d`在四个固定物体的所有237条指示上
- REX.W选择64位操作符,REX.R和REX.B扩展注册表的字段
- 模特RM和SIB将AT&T内存操作系统,包括规模,索引和签署的移动表现
- 记录一个与RIP相对的移动,其在指示内的场地偏移
- 复制的遗产前置和一个段落过失解码,像 Oracle
- 一项强制性`66`预写选择SSE的选号码,然后将32位的登记器留下
- 八位即时的符号为算术扩展,而非为转换数量
- 命令超过15字节,命令缩短,以及未知的opcode升级`DecodeError`
- `R_X86_64_PC32`在一个`lea`通过会议,`R_X86_64_PLT32`在一个`call`解决了这个问题
- 扫描将陷表解码,没有指令对跳跃目标
- 降落者从来没有要求桌子或填充,并且读`addl $0x1, %eax`在目标
- `llvm-objdump`犯了像搜索陷一样的错误
- 命令中输入的内容被记录为冲突
- 没有解决的间接跳跃阻止了下降,并列出
- `total`在`-O1`五个块,五个字符边,一个后边,以及预期的直接主导者
- 一个手工造型的钻石,带有循环,给了统治者定义的算法
- `total`在`-O2`有两个循环
- `grade`在`-O0`通过出一个5个进口跳板`.rela.rodata`具有目标`0x91, 0x88, 0x7f, 0x76, 0x76`
- 没有桌子`grade`在`-O0`有三块块和一个未解决的跳跃
- `grade`在`-O1`其他`-O2`是一个值表`[1, 2, 3, 4, 4]`没有间接跳跃
- `grade_label`在`-O2`通过五次移动读取相对串表
- 互动图像包含分析产生的相同数据

## 生产失败模式

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Data inside `.text` | A plausible listing with every byte decoded | The descent claims no data byte and the jump target starts an instruction |
| Padding after the last return | A `nopw` instruction at the end of the function | The bytes are unreachable from the entry |
| Indirect jump through a table | "jmp rax" and four dead blocks | Table address from the `lea` relocation, entry count from the bounds check, targets from `.rela.rodata` |
| Switch turned into a value table | "a jump table with a relocation" | A `movl` load from `.rodata+0x14`, three blocks, no indirect transfer |
| Call with a zero displacement | `callq 0x113`, the next instruction | `R_X86_64_PLT32 grade-0x4` resolves to `0x30` |
| Decoder guesses an unknown opcode | A mnemonic that looks right | `DecodeError` with the address, and the sweep records the byte |
| Instruction longer than 15 bytes | A very long "instruction" | The cursor raises before reading byte 16 |
| Branch into the middle of an instruction | Two overlapping listings | A conflict record with both addresses |
| Loop reported as straight-line code | No `while` in the pseudocode | A back edge whose target dominates its source |
| Oracle captured from a different compiler | Tests pass on stale text | The fixture README names the exact compiler and command |

## 运营规则

根据预言器进行解码,从已知输入中进行步行控制流动,并将每个字节作为索赔,填充,数据或无法达到的帐户. 从一个移动或可以指向的表中恢复每个间接目标.

## 进一步阅读

- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, Chapter 2: Instruction Format](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [AMD64 Architecture Programmer's Manual Volume 3, Chapter 1: Instruction Encoding](https://docs.amd.com/v/u/en-US/24594_3.38_APM_Vol3_PUB)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Table 4.9: Relocation Types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Schwarz, Debray, Andrews, "Disassembly of Executable Code Revisited" (WCRE 2002)](https://www2.cs.arizona.edu/~debray/Publications/disasm.pdf)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Allen, "Control Flow Analysis" (1970)](https://doi.org/10.1145/800028.808479)
- [Cooper, Harvey, Kennedy, "A Simple, Fast Dominance Algorithm" (2001)](https://www.cs.tufts.edu/~nr/cs257/archive/keith-cooper/dom14.pdf)
- [Lengauer, Tarjan, "A fast algorithm for finding dominators in a flowgraph" (1979)](https://doi.org/10.1145/357062.357071)
- [Capstone 6.0.0-Alpha10 release notes](https://github.com/capstone-engine/capstone/releases/tag/6.0.0-Alpha10)
- 标签 `3b79af2`这一课描述了:`README.md`现在`docs/ghidra-provider.md`现在`docs/ghidra-dos.md`现在`docs/reverse-engineering-tools.md`现在`bridge/ghidra/ReaGhidraBridge.java`现在`src/contracts/officialToolContracts.ts`现在`src/ghidra/GhidraAnalysisProfile.ts`现在,我们要去.
