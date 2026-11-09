# 编译语法:优化对你的代码有什么影响以及如何回读它

> 优化编译器将源构件取代于更便宜的指令形状.每个形状都有衍生,这课程构建了向后运行衍生的识别器,并与源进行检查.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, AArch64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode), Phase 13 · 38 (calling conventions)
**Time:** ~150 minutes

## 学习目标

- 取出魔术数字,并通过任何恒定与格兰隆德-蒙特哥默的边界进行分离,并从发射的恒定中恢复分离器.
- 举个说明LLVM降低a的五种方法`switch`阅读入口数,表位置,以及对象的入口.
- 读取向量循环作为行径,积累器,每次代的元素,三次计数面具,减小和剩余循环.
- 识别尾声,内线的呼叫,无枝的选择,以及成为的循环`memset`或`memcpy`现在,我们要去.
- 报告每种语法,其证据说明和解码的源形式,在x86-64和AArch64上,在`-O0`通过`-O3`现在,我们要去.
- 结果与Ghidra,Angr,Radar2,Rizin和Lldb的结果进行比较.

## 问题

你编译了`idioms.c`在`-O2`问一个代理人什么`div7u`经纪人读到`imulq $0x24924925, %rax, %rax`函数乘以613566757,变化,并加.每个字都是真的.函数计算`x / 7`现在,我们要去.

同一个物体持有一个`switch`七个案例,没有跳跃,`switch`五个案例,这是一个跳机,一个`switch`两种情况是`sete`其他`cmovne`,然后再.`n`两个中每次代的8个整数`xmm`后者在第二个循环中完成其余的.`-O0`产品来源相同`divl`七个进口跳机,一个圆.`-O1`七个案例的交换器成为一个值表,而向量循环还没有存在.

编译器可以从一个规则中发出每个形式,你可以在其源头中读取,每个形式都可以被解码到它来的构造中.解码是算术,算术可以检查.34课证明其中之一,乘以`0x66666667`这一课构建了所有它们的识别器, 运行了我们自己的18个代码, 并对C源进行了所有373个报告的验证.

```figure
re-39-idioms-by-level
```

## 语法是一种形状,其起源

语法是编译器发出一个源构造的指令序列.三个事情使其可识别.它具有固定形状,操作符带有导数预测的常数,形状与程序员手动写的不同.

标识器在`code/main.py`关于"`llvm-objdump -d -r`通过分析每个函数,它将其分为指令,字节,mnemonic,操作符和其后续的移动线.它只读取两个东西的对象文件:字节的`.rodata`值表的位置,`.rela.rodata`进入,跳表目标在连接之前居住.

每个发现都是一个`Idiom`记录一个`kind`解码的`source`形式,列表`evidence`其他地址`detail`字典,以及一个`verified`旗来自C源.`parse_source()`读书`idioms.c`找出每个函数,然后提取除分后的`/`其他`%`后的乘法`*`其他`switch`其他案件和它们的价值`? :`其他国家`for`循环和调用.一个分类语法在函数的分类列表中时被验证.一个搜索表在其输入与案例值匹配时被验证,直到一个常数.一个尾声调用被验证当调用在源中.演示报告以一个 结束`unverified`测试套件表示,所有18个构建的列表是空的.

解码需要名称.识别器在每个函数的基本块上运行一个小的象征评估器,以列表顺序,从课38中系统V和AAPCS64公约的参数注册表中取出的参数名称.`-O0`在每个区块入口时,前身的状态都会合并,并且在它们不同的地方,一个名称,一个更早的语法分配的胜利.`cmovll %edx, %eax`在`digest`现在,我们可以看到`sum % 10 < 5 ? sum % 10 : 5`循环语法命名为积累器`sum`分类语法命名为其分数.`sum / 10`模块语称之为结果`sum % 10`消息来源说`rem > 5 ? 5 : rem`两个表达式都给出最小的`rem`它们同意`rem == 5`现在,我们要去.

## 通过一个常数进行分离

格兰隆和蒙特哥马利"乘法使用不变整数分数" (PLDI 1994),取代`n / d`乘以一个和一个转变.`s`并且是乘法`m = ceil(2^s / d)`然后`floor(n * m / 2^s)`相当于`floor(n / d)`对于每一个`n`在错误时的范围`e = m * d - 2^s`对于未签名的32位`n`边界是`e <= 2^(s - 32)`签名的`n`随着`|n| < 2^31`边界是`e <= 2^(s - 31)`并且一个标志修复加上1`n`由于地板绕了错误的方向,

`magic_numbers(d, bits, signed)`在`main.py`搜索`s`搜索将在灯具中发出的每一个恒定的声音复制.

### 没有手印的10

`2^35 / 10 = 3435973836.8`顶层是`3435973837 = 0xCCCCCCCD`错误是`0xCCCCCCCD * 10 - 2^35 = 2`的`s = 35`是`2^3 = 8`在`s = 34`错误是6对4的边界,所以35是最小的转移.`n = 123`其他`123 * 3435973837 = 422624781951`其他`422624781951 >> 35 = 12`现在,我们要去.

声发射的正是为了`div10u`在`-O2`在 x86-64 上:

```text
       0: 89 f9                        	movl	%edi, %ecx
       2: b8 cd cc cc cc               	movl	$0xcccccccd, %eax
       7: 48 0f af c1                  	imulq	%rcx, %rax
       b: 48 c1 e8 23                  	shrq	$0x23, %rax
```

`0x23`现在,我们要做什么?`movl %edi, %ecx`识别器读取从 字符中乘数.`movl $imm`这种食物给两的子.`imulq`读取班次,打电话`divisor_from_magic(0xCCCCCCCD, 35)`这种函数试着`2^35 // m = 10`并且接受10因为`magic_numbers(10)`结果是相同的乘法,然后转向后.

在AArch64上,相同的函数是`mov w8, #0xcccd; movk w8, #0xcccc, lsl #16; umull x8, w0, w8; lsr x0, x8, #35`常数在两个16位半部分中,乘法是`umull`识别器将这些半部分组合在一起并报告相同的分数.

### 无签名7手动,附加补充

`2^35 / 7 = 4908534052.57`顶层是`4908534053 = 0x124924925`错误是3对8的边界,所以转移是35,没有更小的转移工作.一个32位乘法不能保持乘法,所以编译器乘以低32位`0x24924925`按一下,将股息按一下加回:

```text
      32: 48 69 c0 25 49 92 24         	imulq	$0x24924925, %rax, %rax
      39: 48 c1 e8 20                  	shrq	$0x20, %rax
      3d: 29 c7                        	subl	%eax, %edi
      3f: d1 ef                        	shrl	%edi
      41: 01 f8                        	addl	%edi, %eax
      43: c1 e8 02                     	shrl	$0x2, %eax
```

阅读如下`t = (n * 0x24924925) >> 32`现在`q = (((n - t) >> 1) + t) >> 2`总转变是`32 + 1 + 2 = 35`随着`n = 100`其他`t = 14`现在`(100 - 14) >> 1 = 43`现在`43 + 14 = 57`现在`57 >> 2 = 14`识别器检测到`sub`现在`shr`现在`add`现在`shr`后尾 32 位转换,添加了 `2^32`返回乘法,然后恢复到7.`evaluate_division()`测试对其进行了测试.`n // 7`根据AArch64的形式,`sub w9, w0, w8; add w8, w8, w9, lsr #1; lsr w0, w8, #2`由于转移的加算是一个指令.

### 双手签名3

`2^32 / 3 = 1431655765.33`顶`1431655766 = 0x55555556`错误2号,并签署了`s = 32`是`2^1 = 2`局没有空间,所以转变为32个,`shrq $0x20`随着`n = -7`: 产品是`-10021590362`算数转移为32 给出`-3`现在,我们可以将这个符号设置为1,所以,`-2`现在,`-7 / 3`在C.签署的灯具`div10s`其他`div3s`两者都携带了装.`shrq $0x3f`在产品副本上,其次是:`addl`现在,我们要去.

### 常数是什么?

乘法本身就没有分数.`0x66666667`随着转变34是10.同样的乘法随着转变33是5,如第34课所示.因此,识别器总是对乘法与总转变,`clangMatchesAlgorithm`两项的权力从来没有使用乘法.`magic_numbers()`由于编译器发出了一个信号偏差的转变,`mod8s`在下一节中,我们将看到这个形状.

### 语法属于指令选项

在`-O0`现在`div10u`是`movl $0xa, %ecx; xorl %edx, %edx; divl %ecx`现在,我们要去.`div10s`是`cltd; idivl %ecx`在同一个物体中,`digest`通过 `imulq $0x66666667`一个旗解释了差异.`idioms-x86_64-nofastisel-O0.o`造的`-O0 -mllvm -fast-isel=false`在其中,每个分数是乘法,包括`div10u`随着`movl $0xcccccccd, %ecx; imulq %rcx, %rax; shrq $0x23`硬件分区是快速指令选项的选择`-O0`乘以是选择DAG的降低,这是LLVM的`UnsignedDivisionByConstantInfo`其他`SignedDivisionByConstantInfo`产品.`digest`区块的分区也包含一个`switch`识别器报告了两种表格,`hardware idivl`其他`magic multiply`图表显示混合`-O0`功能.

## 模块 遵循 率数

`x % d`是`x - (x / d) * d`编译器计算了乘法,乘以回,然后减去.在x86-64上,乘以10是`addl %ecx, %ecx; leal (%rcx,%rcx,4), %ecx`现在,`2 * q * 5`在AArch64上,这是一个指令.`msub w0, w8, w9, w0`计算的`w0 - w8 * w9`随着`w9 = 10`识别器通过复印来追踪分数登记器,通过 追踪积累的分数.`add`现在`lea`现在`shl`其他`imul`接受了`sub`如果因子等于分数,

当同一个分数也给出了另一个表达式时,两个语法都会留在报告中.`-O1`编译器计算`sum / 10`一次一次`digest`为了`switch`在x86-64上,它甚至将分数结合两次,`leal (%rax,%rsi), %edi`对于模块和`addl %esi, %eax`识别器报告一个分数和一个模块,并标记分数为共享.`switch`索引不可读.

通过两的功率签署的模块具有自己的形状,因为分数从来没有计算:

```text
      92: 8d 48 07                     	leal	0x7(%rax), %ecx
      95: 85 ff                        	testl	%edi, %edi
      97: 0f 49 cf                     	cmovnsl	%edi, %ecx
      9a: 83 e1 f8                     	andl	$-0x8, %ecx
      9d: 29 c8                        	subl	%ecx, %eax
```

对于一个负面的`x`密码在掩盖之前偏向7 ,所以切割轮向零,正如C所要求.`x`缩小到8的倍数,减去的页面`x % 8` 64 号可以使用`negs w8, w0; and w9, w0, #0x7; and w8, w8, #0x7; csneg w0, w9, w8, mi`面具:`x`其他`-x`吉德拉以此命名了它的规则.`RuleSignMod2nOpt`简单的"转换INT_SREM表格: `(V + (sign >> (64-n)) & (2^n-1)) - (sign >> (64-n)) => V s% 2^n`"我知道.

在`-O0`图为"Aarch64"写为`sdiv w9, w8, w10; mul w9, w9, w10; subs w0, w8, w9`认证器也接受了该表格,并报告了`hardware sdiv + mul + subs`现在,我们要去.

## 五种方法来降低开关

体的形状是LLVM决定的`switch`在两个地方.`SimplifyCFG::simplifySwitchLookup`运行在`-O1`并且把所有情况下都产生常数的交换器变成一个值表,当至少有三个情况下,目标可以构建查找表.`SingleValueKind`现在`LinearMapKind`现在`BitMapKind`其他`ArrayKind`现在,我们要去.`-O0`管道从来没有经过过这个通道.`SwitchLowering::findJumpTables`在指令选择中,该指令构建了一个跳板表,当集群至少有`min-jump-table-entries`输入,默认4个,并且足够密集: `NumCases * 100 >= Range * MinDensity`随着`jump-table-density`正常功能10个,正常功能40个`-Os`剩下的东西变成了对案例常数进行二进制搜索,`splitWorkItem`灯具的每个结果都具有一个功能.

| Function | Source | `-O0` x86-64 | `-O2` x86-64 | `-O2` AArch64 |
|---|---|---|---|---|
| `linear_switch` | cases 0 to 6 return 10 to 70 | jump table, 7 entries | linear map `10*k + 10`, default -1 | `madd` and `csinv` |
| `table_switch` | cases 0 to 6 return 10 to 60 then 71 | jump table, 7 entries | lookup table at `.rodata+0x28` | lookup table at `.rodata+0x0` |
| `call_switch` | cases 0 to 4 call one of five pointers | jump table, 5 entries | jump table, 5 entries | comparison tree, pivot 1 |
| `sparse_switch` | cases 1, 100, 10000, 1000000, 100000000 | compare chain | comparison tree, pivot 9999 | comparison tree, pivot 9999 |
| `two_cases` | cases 3 and 4 return 7 and 9 | compare chain | select chain `k != 3 ? (k == 4)*9 : 7` | two `csel` |

### 查找表,从对象中读取

`table_switch`在`-O2`其他:

```text
      d0: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      d5: 83 ff 06                     	cmpl	$0x6, %edi
      d8: 77 0c                        	ja	0xe6 <table_switch+0x16>
      da: 89 f8                        	movl	%edi, %eax
      dc: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		00000000000000df:  R_X86_64_PC32	.rodata+0x24
      e3: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      e6: c3                           	retq
```

检查边界`cmpl $6; ja`移动补充`0x24`加上 RIP 相对场的4个字节,将表放在 `.rodata+0x28`它们的字节是`0a 00 00 00 14 00 00 00 ...`现在,我们要做什么?`[10, 20, 30, 40, 50, 60, 71]`组件组件命名为`.Lswitch.table.table_switch`在`.s`文件,附有评论`@switch.table.table_switch`在对象中只有移动和字节.没有跳跃,所以控制流图有三个块.

文件表中的地址与 `adrp x8`其他`add x8, x8, #0x0`其他地方的地区`.rodata`子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,`ldr w0, [x8, w0, uxtw #2]`识别器读取了从`add`转移.

### 线性地图,没有表格

`linear_switch`收益`10 * (k + 1)`为了`k`在0到6`simplifySwitchLookup`检测到相似关系并发出算术:

```text
      b0: 83 ff 07                     	cmpl	$0x7, %edi
      b3: 8d 04 bf                     	leal	(%rdi,%rdi,4), %eax
      b6: 8d 4c 00 0a                  	leal	0xa(%rax,%rax), %ecx
      ba: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      bf: 0f 42 c1                     	cmovbl	%ecx, %eax
```

评价者读到`leal (%rdi,%rdi,4)`作为`5*k`现在`leal 0xa(%rax,%rax)`作为`10*k + 10`其他`cmovb`之后`cmpl $7`作为`k < 7 ? 10*k + 10 : -1`识别器检查公式与每个源头案例,并标记验证的语法.`madd w8, w0, w8, w9`其他`csinv w0, w8, wzr, lo`在哪里`csinv`随着`wzr`产量`-1`在默认路径上.

### 跳跃表,从搬迁读取

`call_switch`在`-O2`现在,我们可以看到一个`grade`在`-O0`其他`cmpl $4; ja`其他`leaq`为了`.rodata-0x4`其他`movslq`具有4字节的输入,`addq`其他`jmpq *%rax`五个项目是搬迁.`.rela.rodata`其他`target = addend - 4k`给出`0x10c, 0x107, 0x10e, 0x110, 0x109`它们的每个尾巴都通过一个函数指针跳过.`dispatch`设置将此扩展到16个案例:在x86-64上16个迁移输入,在AArch64上16个单字节的压缩表,`ldrb w11, [x9, x8]`通过4 缩小`add x10, x10, x11, lsl #2`根据`adr`识别器解码`[0x24, 0x74, 0x54, ...]`通过字节表和报告`compressed: true`现在,我们要去.

### 在四个层面上,同一个开关

`digest`保持开关`sum / 10`在 x86-64 上,这是一个跳转表.`-O0`查找表`-O1`包含条目`[16, 32, 64, 128, 128]`现在,我们还在上跳桌.`-O2`其他`-O3`他们的四个案子区块存储`0x10`现在`0x20`现在`0x40`现在`0x80`从`-O1`乘以16的乘法已经进入了这些案例.`-O0`对于                                                                                                                                                                                                                                                                                                        `-O1`查找表识别器将输入与源值进行比较,找到一个常数比率,并报告`foldedFactor: 16`在Aarch64上`-O2`形式是一个比较树,轴心在8,6,7和8的等式测试,以及一个范围测试.`sub w9, w9, #9; cmp w9, #2; b.hs`报告中包括9号和10号案例.`rangeTests: [[9, 10]]`现在,我们要去.

两支旗移动了这些边界.`-fno-jump-tables`转`table_switch`现在`call_switch`其他`digest`在 x86-64 上,转换为比较树,为7个案例函数的2和4个旋转点.`-mllvm -min-jump-table-entries=4`叶子`call_switch`作为一个比较树,因此在该目标上,入口数量不是五个间接调用的决定性输入.`idioms-arm64-jt4-O2.o`记录的运行.

墨西哥湾委员会将两项决定都纳入`tree-switch-conversion.cc`随着课程`jump_table_cluster`现在`bit_test_cluster`现在`switch_decision_tree`其他`switch_conversion`现在,我们要去.`-ftree-switch-conversion`现在,`-O2`现在`-fjump-tables`其他`-fbit-tests`在`-O1`跳板值来自`case-values-threshold`没有GCC安装在这个机器上,所以这些名称来自GCC源和手册,

## 循环: 向,解卷或取代

路向量仪在线`-O2`现在`-O3`其他`-Os`现在,我们要去.`-O0`其他`-O1`根据2014年1月的LLVM3.4的规则.`sum_n`在`-O2`显示形状的每个部分:

```text
     1f6: 83 fe 07                     	cmpl	$0x7, %esi
     1f9: 77 09                        	ja	0x204 <sum_n+0x14>
     206: 81 e2 f8 ff ff 7f            	andl	$0x7ffffff8, %edx
     230: f3 0f 6f 14 37               	movdqu	(%rdi,%rsi), %xmm2
     235: 66 0f fe c2                  	paddd	%xmm2, %xmm0
     239: f3 0f 6f 54 37 10            	movdqu	0x10(%rdi,%rsi), %xmm2
     23f: 66 0f fe ca                  	paddd	%xmm2, %xmm1
     243: 48 83 c6 20                  	addq	$0x20, %rsi
     24a: 75 e4                        	jne	0x230 <sum_n+0x40>
     24c: 66 0f fe c8                  	paddd	%xmm0, %xmm1
     250: 66 0f 70 c1 ee               	pshufd	$0xee, %xmm1, %xmm0
     262: 66 0f 7e c8                  	movd	%xmm1, %eax
     270: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
     279: 75 f5                        	jne	0x270 <sum_n+0x80>
```

警卫`cmpl $7; ja`通过轮,将旅行数量降低到8以下.`andl $0x7ffffff8`乘以8的乘数, 身体每次重复的32字节分为2个.`xmm`积累器,每个有4个32位行径,所以向量化因子为4和交差因子为2.`paddd`两个`pshufd`另外两个`paddd`其他`movd`缩小8条车道到一个整数.`0x270`识别器从后边找到循环,看到SIMD注册,从 读取路径数量`paddd`计算不同的积累器, 分开步骤`0x20`报告`4 lanes x 2 accumulators = 8 elements per iteration`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`ldp q2, q3`两个`add v.4s`现在`addv s0, v0.4s`其他`fmov w8, s0`现在,我们要去.

固定的旅行数量消除了循环.`sum4`是一个`movdqu`减少,`movd`没有后边.`poly8`无法向量化,因为每个回复取决于前一个积累器,所以编译器将其打开8次:8次负载在 0 到 之间`0x1c`其他`%rdi`后面是5的转移和减值,`acc * 31`识别仪从一个基地计算连续的负载,并报告`loop unrolled by 8, no back edge`在Aarch64上,同样的载荷抵达了四个.`ldp`两对.

关闭向量表仪`-fno-vectorize -fno-slp-vectorize`其他`sum_n`变得一个由8解开的尺度循环,`addl k(%rdi,%rdx,4), %eax`其他`addq $8`另外还有一个剩余的循环.`sum4`识别器报告`unrolled loop`随着`copies: 8`其他`indexStep: 8`对于第一位和`copies: 4`现在,我还没有说过.

课33发现了两个后边`total`在`-O2`它们是两个循环,这个课程给它们命名:一个向量体和一个源循环的 skalar 余分.一个后边是只有当目标能够再次达到它时的循环.`is_loop()`检查,因为`digest`在AArch64上包含非循环的共享默认区块的倒向分支,并且识别器的第一个版本将它们计算为向量循环.

### 成为图书馆通话的循环

`LoopIdiomRecognize`将存储零的循环转换为调用到`memset`根据`-O1`升.`fill`在`-O2`是`testl %esi, %esi; jle; movl %esi, %edx; xorl %esi, %esi; jmp memset@PLT`调用是搬迁的后续跳跃`R_X86_64_PLT32 memset-0x4`并且函数是`retq`识别器报告说`store loop recognized as memset(...)`并且对源循环进行验证,因为源头从来没有命名`memset`现在,我们要去.

`copy16`电话`memcpy`随着16的常数, x86的后端将其扩展为`movups (%rsi), %xmm0; movups %xmm0, (%rdi)`只有8家店铺`memcpy`在`-O0`同样的调用是两个8字节`movq`两对,与`-fno-builtin`电话仍然是电话,`jmp memcpy@PLT`随着`movl $0x10, %edx`其他`fill`它们的循环保持在循环中,然后向量化器将其转化为两个16字节的循环.`movups`认出器报告`vectorized store loop: 2 x 16-byte stores = 32 bytes per iteration`为了这座建筑.

## 消失或变成跳跃的电话

`tail_caller`收益`tail_target(x + 1)`在`-O0`现在是`addl $0x1, %edi; callq tail_target@PLT; addq $0x10, %rsp; popq %rbp; retq`在`-O2`现在是`incl %edi; jmp tail_target@PLT`现在,我们在Aarch64上跳跃,我们可以看到一个叫做"Aarch64"的字幕.`b tail_target`随着`R_AARCH64_JUMP26`识别器处理一个`jmp`或`b`课程33的递归下降必须把它视为函数出口,因为目标是函数之外的.

`twice_sum`电话`leaf_add`在`-O0`呼叫就在那里,`callq leaf_add@PLT`从`-O1`公司的`leaf_add`现在`leal (%rdi,%rsi), %eax`现在,它在里面出现了.`twice_sum`没有任何电话.`-O0`标记每个函数`optnone`其他`noinline`识别器从来源知道`twice_sum`电话`leaf_add`电话号码,找不到电话号码或尾声跳到它,然后在电话号码器中寻找电话号码的体形:`add w8, w1, w0`在AArch64调用器匹配中`add w0, w1, w0`一个匹配是证据.

`dispatch`结合了两者:一个16个进口跳机,每个案例都是`movl %esi, %edi; jmp fN@PLT`识别器报告了一个开关和16次尾声调用,所有这些都与源头的16次调用进行了验证.

## 成为数据的分支移动

`clamp_max`是`movl %esi, %eax; cmpl %esi, %edi; cmovgl %edi, %eax`评价者名字`%edi`作为`a`其他`%esi`作为`b`记录了比较,并读了`cmovg`作为`a > b ? a : b`根据本文的规定,`abs_int`是`movl %edi, %eax; negl %eax; cmovsl %edi, %eax`字母是`-x < 0 ? x : -x`据Aarch64写为`cmp w0, #0; cneg w0, w0, mi`字母是`x < 0 ? -x : x`现在,我们要去.`is_pos`是`xorl %eax, %eax; testl %edi, %edi; setg %al`现在,我们要做什么?`(x > 0)`这些是`-fif-conversion`根据GCC的说法,`cmov`在LLVM中选择.`X86CmovConversion`通过可以转换一个`cmov`由于同一个来源可以显示一个循环中的任何一个形状.

在`-O0`没有一个.`clamp_max`是一个比较,`jle`认知器没有报道任何信息.`-O0`其他`branchless select`其他`-O1`图片显示的这一点.

`mul9`是一个`leal (%rdi,%rdi,8), %eax`认证器报告`strength reduction`随着`x * 9`由于源乘以9 ,它只有当源有因数时才会这样做;`lea`只有一个表的指数,

## 两个看起来像语的硬化特征

堆保护器是一个编译功能,它留下了一个形式, 代理将其它读取为程序逻辑. `canary.c`编译为`-fstack-protector-strong`对于x86-64 Linux 提供:

```text
       7: 64 48 8b 04 25 28 00 00 00   	movq	%fs:0x28, %rax
      10: 48 89 44 24 40               	movq	%rax, 0x40(%rsp)
      26: 64 48 8b 0c 25 28 00 00 00   	movq	%fs:0x28, %rcx
      2f: 48 3b 4c 24 40               	cmpq	0x40(%rsp), %rcx
      34: 75 05                        	jne	0x3b <with_canary+0x3b>
      3b: e8 00 00 00 00               	callq	0x40 <plain_leaf>
		000000000000003c:  R_X86_64_PLT32	__stack_chk_fail-0x4
```

`%fs:0x28`是`stack_guard`在Glibc的`tcbhead_t`位的位,`getIRStackGuard`序言复制缓冲器上方的卫报,表尾比较,失败路径调用`__stack_chk_fail`在AArch64 Linux上,卫兵来自全球.`__stack_chk_guard`通过 GOT `adrp`其他`ldr`没有成功.`bl __stack_chk_fail`识别器报告了警卫源,插槽,比较,和失败电话.`plain_leaf`没有,没有鱼.`strong`通过配列保护函数,`alloca`调查说明还记录了MSVC表格在`/GS`饼干与`%rsp`经过检查`__security_check_cookie`;该机器上没有MSVC连接器,因此这种形状仅从编译器组装输出中描述.

`-fcf-protection=full`子`endbr64`字节`f3 0f 1e fa`它是对处理器的间接分支的降落台,`nop`基德拉的x86-64函数启动模式包括`endbr64`预定变体`push rbp; mov rbp, rsp`鉴定器报告它为`cet landing pad`函数开始于四个不寻常字节,

## 碎者所折叠的东西

作为重写规则,Ghidra的解译器将它们命名为`ruleaction.cc`现在,我们要去.`RuleDivOpt`是"将INT_MULT转换为INT_DIV或INT_SDIV",其中包含了表格`sub( (zext(V)*c), d) >> e => V / (2^n/(c-1)) where n = d*8 + e`签署的变体`sext`其他`s>>`现在,我们要去.`RuleModOpt`是"简化优化INT_REM和INT_SREM的表达式". `RuleDivTermAdd`处理补充补充,`RuleSignDiv2`转`(V + -1*(V s>> 31)) s>> 1`进入`V s/ 2`其他`RulePositiveDiv`课程37捕获了第33课的Ghidra 12.1.4 课程33`grade`在`-O1`输出结果是`uVar2 = param_1 / 10 - 6;`部门已经被折叠了.

文文的pypcode4.0.1使用了Ghidra使用的SLEIGH规格,并且`code/fixtures/idioms-x86_64-O2.lifts.json`具有原始P码`div10s`: 112条说明书,其中7条是`IMARK`开启每一个指令的标记,其中包括`RAX = RAX * unique[95a00:8]`之后`unique[95a00:8] = sext(0x66666667)`现在`RCX = RCX >> unique[d1a00:4]`其他`RAX = RAX s>> unique[c5c00:4]`现在,我们要去.`shrq`执行41项行动,`sarq`它们大部分都计算着旗.`RuleDivOpt`通过将死码删除,将没有任何东西读取的标志删除.

发动了10.0.3的攻击.`-O2`标题`idioms-x86_64-O2.angr.json`文件的解译器输出为20个函数.`div10u`是`return a0 / 10;`没有折叠签署的表格:`div10s`是`v1 = a0 * 1717986919; return ((long long)(v1) >> 0x22) + (v1 >> 63);`其他`mod10s`是`a0 - (...) * 2 * 5`为了`div7u`它打印了`(a0 / 7 + ((a0 * 6 / 7 & 0xffffffff) >> 1 & 0xffffffff) & 0xffffffff) >> 2`它们可以被编译成数值,`mul9`为了`a0 * 9`现在`linear_switch`为了`(a0 < 7 ? a0 * 10 + 10 : 0xffffffff)`现在`clamp_max`为了`((int)a1 < (int)a0 ? a0 : a1)`现在`is_pos`为了`a0 > 0`其他`fill`为了`return memset(a0, 0, a1);`它打印了`table_switch`作为一个负担`*(int *)(4 * a0 + 4195400)`没有价值,`sum_n`随着`_mm_add_epi32`其他`_mm_shuffle_epi32`基本的基础知识,`tail_caller`作为`tail_target(); return;`没有任何证据.`digest`跳板的表变得`goto *((void *)(...))`通过表格算法写出.

雷达雷达2.2.4和里津0.9.1从源入研究缓存,`pdc`印记`div10s`作为`rax = rax * 0x66666667; rcx >>>= 0x3f; rax >>= 0x22; eax += ecx`无折叠的注册级伪C,`table_switch`作为`eax = dword [rcx + rax*4]`具有一个`RELOC 32 .rodata`评论`lea`子没有内置的分解器;`aoi`打印了该 号的 RzIL`imul`作为一个128位产品. lldb-1703.0.236.21 载入ELF对象及其`disassemble -n div10s`打印了7个指令`llvm-objdump`由于两个都使用LLVM的拆除器. Capstone 5.0.7解码相同的字节,并报告如`ret`其他`mode64`它们的文档描述了这种重写,微码优化和MLIL到HLIL的阶段,这本课程没有关于它们折叠的语言的权利的权利.

编译器 Explorer 是向前方向的工具.`idioms.c`选择"x86-64 clang 18.1.0"或"ARM64 GCC 14.2.0"等编译器输入,设置旗.服务列出了约1050个C编译器输入,并有一个API:`GET /api/compilers/c`返回标识符和`POST /api/compiler/<id>/compile`通过这个工具来进行分类,人口计数,链条条件和总结语法.使用它来生成GCC输出,这台机器无法产生,并比较GCC的跳跃表门和`-O2`通过电源输出,GCC 12中的向量化默认设置.

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
```

输出是一个JSON报告.对于每个18个构建中,它列出了每个函数及其语法,包括类型,源形式,证据地址,验证和细节字段.它以每个构建的类型矩阵结束,`-O2`其他`-O3`建筑物和建筑物之间的比较`unverified`列表.

预期的形状:

```json
{
  "builds": {
    "idioms-x86_64-O2": {
      "arch": "x86_64", "level": "O2", "flags": "x86_64",
      "functions": {
        "div7u": [{"kind": "division", "source": "x / 7", "evidence": ["0x30", "0x32", "0x39", "0x3d", "0x3f", "0x41", "0x43"], "verified": true, "form": "magic multiply with add fix-up", "magic": "0x24924925", "effectiveMagic": "0x124924925", "shift": 35, "...": "..."}],
        "table_switch": [{"kind": "switch", "source": "switch (k) as lookup table", "table": ".rodata+0x28", "entries": 7, "values": [10, 20, 30, 40, 50, 60, 71], "...": "..."}],
        "sum_n": [{"kind": "vector loop", "lanes": 4, "accumulators": 2, "elementsPerIteration": 8, "...": "..."}]
      }
    }
  },
  "kindMatrix": {"idioms-x86_64-O2": {"division": 5, "modulo": 3, "switch": 6, "vector loop": 3, "...": "..."}},
  "sameCodeAtO2AndO3": {"x86_64": {"identical": true}, "arm64": {"identical": false, "differences": ["..."]}},
  "unverified": []
}
```

阅读`code/main.py`在此顺序:

1. `parse_listing()`转换了`llvm-objdump -d -r`文本将其分为两个架构的函数,指令和附加位置.
2. `ElfFile`阅读部分,符号,`.rela.*`报名,以及`words()`阅读表格的输入.
3. `magic_numbers()`现在`divisor_from_magic()`其他`evaluate_division()`作为指令序列,我们可以将这些指令列为
4. `parse_source()`从C文件中提取了验证需求的构成.
5. `Evaluator`是一个区块对区块的象征性通行,
6. `find_divisions()`其他`find_modulos()`它们可以通过乘法,转移,固定,反乘法和两种形式进行.
7. `find_switches()`类别类别:跳跃表,查找表,线性地图,选择链,比较树和比较链.
8. `find_vector_loops()`现在`find_unrolled_loops()`现在`find_tail_calls()`现在`find_inlined_calls()`现在`find_selects()`现在`find_memory_builtins()`现在`find_stack_protector()`现在`find_cet()`其他`find_strength_reduction()`覆盖其余的.
9. `analyze_function()`通过测试,将每个语法的结果名称输入到下一个评估符.

现在还有三个命令.`python3 code/main.py scan FILE.objdump.txt [FUNCTION]`列出一个列表,并将对象和相匹配的C文件找到在旁边. `python3 code/main.py magic DIVISOR [signed]`打印乘法,转移,错误,以及身份是否保留边缘值. `python3 code/main.py figure-data`打印了图像嵌入的数据.

## 用它

在你建造的新物体上使用识别器.

1. 捕获`llvm-objdump -d -r`识别器从列表标题中读取架构.
2. 跑步`scan`在列表上,阅读`unverified`它们都是源解析器未见的构建,或者识别器误读的形状,
3. 对于每一个部门,阅读`algorithm`什么时候?`clangMatchesAlgorithm`如果是错误的,那么编译器有理由你还不知道;写下常数.
4. 对于每一个开关,`lowering`成为树,或树成为表,标志着一个可以从LLVM来源命名的门.
5. 阅读每一个循环`elementsPerIteration`其他`scalarRemainderLoop`后面两边的课33报告是一个源循环.
6. 运行一个解译器,引用其文本,并记录它折叠的.

## 互动实验室

### 实验室A:取出一个魔术数字,然后找到它

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/code
python3 -q
```

运行:

```python
from main import *
magic_numbers(10), magic_numbers(10, signed=True)
magic_numbers(7), magic_numbers(7, signed=True)
divisor_from_magic(0x66666667, 34, signed=True), divisor_from_magic(0x66666667, 33, signed=True)
```

计算`ceil(2^35 / 10)`在第一次电话之前,在纸上.`unsigned div13(unsigned x) { return x / 13; }`转载到`idioms.c`打造它`-O2`随着命令在`build_fixtures.sh`查看列表中的常数`magic_numbers(13)`现在,我们要去.

### 实验室B:桌子和树

```python
listing = load_listing("idioms-x86_64-O2.objdump.txt")
elf = load_elf("idioms-x86_64-O2.o")
sources = load_source("idioms.c")
[i.to_dict() for i in analyze_function(listing, "table_switch", elf, sources)]
[i.to_dict() for i in analyze_function(listing, "sparse_switch", elf, sources)]
elf.words(".rodata", 0x28, 7)
```

改变`71`回到`70`在本文中`table_switch`修建在`-O2`换一个案例值为1000,然后看它保持为`ArrayKind`桌子.

### 实验室C:循环在三个设置

```python
for name in ("idioms-x86_64-O1", "idioms-x86_64-O2", "idioms-x86_64-novec-O2"):
    print(name, [i.source for i in analyze_function(load_listing(name + ".objdump.txt"), "sum_n", load_elf(name + ".o"), sources)])
```

绘制控制流图`sum_n`在`-O2`按手指标标记保护器,面具,向量体,减速和剩余循环,并与`detail`其他地方

### 实验室D:共享分数

```python
for name in ("idioms-x86_64-O1", "idioms-arm64-O1"):
    print([(i.kind, i.source, i.detail.get("sharedQuotient")) for i in analyze_function(load_listing(name + ".objdump.txt"), "digest", load_elf(name + ".o"), sources)])
```

阅读`-O1`列出`digest`然后解释为什么AArch64构建只需要一个.

## 实践实验室

增加一些小技巧,扩展识别器.

要求:

- 写下`popcount`现在`ctz`其他`rotl`它们可以在GCC的结构和转换或旋转`-O2`随着和没有`-mpopcnt -mbmi`它们的列表.
- 认识一个`0x55555555`现在`0x33333333`现在`0x0f0f0f0f`现在`0x01010101`人口数量序列`TargetLowering::expandCTPOP`发射,并报告为`popcount`作为证据,
- 认识`rep bsfl`作为`tzcnt`- 或是...`bsf`编码和`roll %cl`它们都被转换成转换器,然后将它们解码到构建器.
- 添加新的类型`parse_source()`检查,所以一个`popcount`语言只有当源头打电话时才会得到验证`__builtin_popcount`现在,我们要去.
- 添加一个每种语法测试,读取器件列表中的常数.

成功意味着`python3 code/main.py`报告了三种新型`verified: true`在两个构建中,套房仍然报告一个空白`unverified`列表.

## 教训艺术品

这一课包括`outputs/skill-compiler-idioms-and-optimization.md`通过它将列表,对象和其源头转化为一个验证的语法报告,并进行解译器比较.它需要每个索赔的证据地址,每个分数的魔术数字衍生,每个交换器的降低类型和输入源,每个语法的引用解译器线.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

验证应证明:

- 列表解析器读取25个函数`-O2`它们是对象,保持字节,并附加`R_X86_64_PC32 .rodata+0x24`对于`leaq`在`table_switch`
- 电脑电脑阅读器返回`[10, 20, 30, 40, 50, 60, 71]`其他`.rodata+0x28`其他地方`.rela.rodata`
- `magic_numbers`收益`0xcccccccd`随着班35`0x66666667`其他`0x124924925`附35号和附加表格,`0x55555556`含32个,`0xaaaaaaab`具有33
- 认同对每一个从2到64的分数的32位边值保持,而不是两次的权力,签名和未签名
- `divisor_from_magic`能从对子中恢复10,5,7和3的情况,然后拒绝错误的对子
- 增加固定序列计算`n // 7`确切地
- 四个x86-64分区报告右乘法,转移,分数和形式,四个AArch64分区解码`mov`其他`movk`
- `-O0`使用`divl`其他`idivl`现在`-O0 -fast-isel=false`使用乘法,`digest`在`-O0`混合了两种
- 模块是被认可为复制回来,`msub`两级电力`sdiv`另外`mul`另外`subs`其他设备`idivl`
- 共享的分数保持分数和模块的值`-O1`
- 五个降低分类为`-O2`在两个架构上,配方,值,目标,转点和选项表达式
- `-O0`交换机是跳机在x86-64和比较链在AArch64
- 其他`digest`交换机是跳转表,然后是折叠因子16的查找表,然后是x86-64上有四个不同的目标的跳转表,以及AArch64上具有9到10的范围测试的比较树
- `-fno-jump-tables`它们的结果是相比树,`dispatch`读取其目标从x86-64上的转移和AArch64上的压缩字节表
- 矢量循环报告4条条路,2个积累器,每次回复的8个元素,面具,保护器,减速和剩余循环
- 固定路环完全向量化或完全解,`-fno-vectorize`截至8
- `-O1`没有向量化`-O2`其他`-O3`在x86-64上,它们是相同的,在AArch64上,它们只有在`call_switch`在哪里`-O3`包含17个指令,`-O2`只有18个
- `-fno-builtin`转换了商店循环成向量化商店循环,并保持`memcpy`一个电话
- 后尾呼叫,`memset`换取,直线16字节的副本,`-O0`两动副本被识别
- 的是从`-O1`根据其体状
- 选择解码到`a > b ? a : b`现在`-x < 0 ? x : -x`现在`(x > 0)`其他`sum % 10 < 5 ? sum % 10 : 5`
- 堆保护器报告`%fs:0x28`子,子,`__stack_chk_fail`其他`endbr64`报告CET构建的每个功能
- 源解析器读取函数指标参数,开关情况,调用和蓄积器名称
- 每个构建中的每种语法都得到验证,
- 互动图像包含分析产生的相同数据

## 生产失败模式

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Multiply by a large odd constant | "multiplies by 1717986919" | The constant is `ceil(2^s / d)` for one `d`, the error satisfies the bound, and the shift is the smallest valid one |
| Add fix-up after a 32-bit shift | Five arithmetic instructions | The multiplier is 33 bits wide and the tail is the add form of the same method |
| Same multiplier, different shift | The same divisor | The shift selects the divisor: 34 is 10, 33 is 5 |
| Power-of-two signed modulo | "adds 7, masks, subtracts" | The bias rounds toward zero and the result is `x % 8` |
| Indexed load from `.rodata` | "a jump table" | A lookup table of values, with entries read from the bytes at addend plus 4 |
| Affine arithmetic and a `cmov` | "computes 10k + 10" | A switch lowered as a linear map, verified against every source case |
| Compare chain with ordered splits | "a sequence of ifs" | A binary search over the case constants with the pivots named |
| Backward branch to a default block | "a loop" | The target leaves the region with an unconditional jump; it is a shared tail |
| Two back edges in one function | "two loops" | One source loop: the vector body and its scalar remainder |
| `jmp memset@PLT` with no `ret` | "the function has no return" | A tail call that returns through the callee, replacing a store loop |
| Callee missing from the call graph | "never called" | Inlined: the callee's body shape appears in the caller |
| `%fs:0x28` load and compare | "reads thread-local data" | The stack protector canary, with the fail path to `__stack_chk_fail` |
| Four odd bytes at function start | "data before the function" | `endbr64`, the CET landing pad |
| Decompiler shows raw arithmetic | "the tool is wrong" | The tool did not apply a fold; the derivation gives the source form and the quoted output records the gap |

## 运营规则

根据其形状,运行后方衍生,并写出证明它的常数. 报告每种语法,其证据地址和解码的源形式, 根据你编译的源, 验证每一个, 并引用每个解译器印发的相同字节.

## 进一步阅读

- [Granlund, Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994)](https://gmplib.org/~tege/divcnst-pldi94.pdf)
- [Warren, Hacker's Delight, 2nd edition, Chapter 10: Integer Division By Constants](https://www.informit.com/store/hackers-delight-9780321842688)
- [Lemire, Kaser, Kurz, "Faster Remainder by Direct Computation" (2019)](https://arxiv.org/abs/1902.01961)
- [libdivide, header-only division by runtime constants](https://github.com/ridiculousfish/libdivide)
- [LLVM `DivisionByConstantInfo.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Support/DivisionByConstantInfo.cpp)
- [LLVM `SwitchLoweringUtils.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/SwitchLoweringUtils.cpp)其他[`TargetLoweringBase.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/TargetLoweringBase.cpp)
- [LLVM `SimplifyCFG.cpp`, `simplifySwitchLookup`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Utils/SimplifyCFG.cpp)
- [LLVM Auto-Vectorization documentation](https://llvm.org/docs/Vectorizers.html)其他[LLVM 3.4 release notes](https://releases.llvm.org/3.4/docs/ReleaseNotes.html)
- [LLVM `LoopIdiomRecognize.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Scalar/LoopIdiomRecognize.cpp)
- [LLVM `X86CmovConversion.cpp`](https://github.com/llvm/llvm-project/blob/release/20.x/llvm/lib/Target/X86/X86CmovConversion.cpp)
- [LLVM `StackProtector.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/StackProtector.cpp)其他[`X86ISelLoweringCall.cpp`, `getIRStackGuard`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/X86/X86ISelLoweringCall.cpp)
- [glibc `sysdeps/x86_64/nptl/tls.h`, `tcbhead_t`](https://sourceware.org/git/?p=glibc.git;a=blob;f=sysdeps/x86_64/nptl/tls.h)
- [GCC `tree-switch-conversion.cc`](https://github.com/gcc-mirror/gcc/blob/master/gcc/tree-switch-conversion.cc)现在[GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html)其他[GCC 12 release notes](https://gcc.gnu.org/gcc-12/changes.html)
- [Ghidra decompiler `ruleaction.cc`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/decompile/cpp/ruleaction.cc)
- [angr decompiler documentation](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 book: decompilers](https://book.rada.re/arch/decompile.html)
- [Compiler Explorer API](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/API.md)
- [Godbolt, "Optimizations in C++ Compilers: A practical journey", ACM Queue 17(5), 2019](https://queue.acm.org/detail.cfm?id=3372264)
- [Microsoft, `/GS` (Buffer Security Check)](https://learn.microsoft.com/en-us/cpp/build/reference/gs-buffer-security-check)
