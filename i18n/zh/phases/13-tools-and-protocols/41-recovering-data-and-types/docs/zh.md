# 恢复数据和类型:结构,阵列,C++对象和DWARF

> 解译器打印`a->balance`如果它有类型表,`*(int *)(param_1 + 4)`这一课程从访问中构建表,从DWARF5中读取真实表,并显示两者一致的地方.

**Type:** Build
**Languages:** Python, TypeScript, C, C++, x86-64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~140 minutes

## 学习目标

- 从Intel SDM的地址规则中读取一个结构成员访问作为基登录加移,以及一个数组访问作为基加索引时步骤.
- 按系统V的配列规则进行手动应用`struct account`解释每一个填充字节.
- 建立一个类型恢复通行,将列表中的访问转化为场次,宽度,类型,步骤和尺寸,每个数据都有证据.
- 写一个DWARF 5读者`.debug_info`现在`.debug_abbrev`现在`.debug_str_offsets`其他`.debug_addr`检查可移动物体的情况`llvm-dwarfdump`现在,我们要去.
- 进行检索,并将其与DWARF的布局进行比较,并将每个差异命名为缺失证据,合并访问或无法证明的类型.
- 读取Itanum C++ vtable,其类型信息,以及其从搬迁中被破坏的名称,并解决一个虚拟的通话到一个插槽.

## 问题

你编译了`account.c`没有`-g`问一个代理人什么`bump`代理人把物体送到Ghidra 12.1.4 得到了这条信息:

```c
void bump(long param_1,int param_2)
{
  *(int *)(param_1 + 4) = param_2 + *(int *)(param_1 + 4);
  return;
}
```

同一个来源编译为`-g`给出了从同一个解译器:

```c
int bump(account *a,int by)
{
  a->balance = by + a->balance;
  return a->balance;
}
```

命令在两个对象中都相同. 区别是类型表. 通过表,解译器知道第一个参数指向32字节结构,其对比 4 的字段为4字节.`int`名称`balance`没有它,解译器只知道,有8字节宽的东西到达了`%rdi`并且在 4 字节`+4`它们都被阅读和写作.

移动4来自移动字节的`addl 0x4(%rax), %ecx`宽度4来自于`l`后音.这个名字来自一个`DW_TAG_member`进入`.debug_info`这一课程构建了两个半端:一个通过,检索说明所证明的内容,一个读者,解码编译器录制的内容.

```figure
re-41-struct-recovery
```

## 成员的访问是移居

根据英特尔SDM第1卷3.7.5节,有效地址是`Offset = Base + (Index * Scale) + Displacement`根据第37.5.1节,将64位模式表格添加到`RIP + Displacement`结构成员访问使用第一个形式,没有索引:基数目录包含对象的地址,移动是成员的偏移. 阵列访问添加索引术语,规模或单独的乘法包含元素大小.

接下来`bump`在`-O0`关于"`llvm-objdump -d -r`读到:

```text
       4: 48 89 7d f8                  	movq	%rdi, -0x8(%rbp)
       e: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      12: 03 48 04                     	addl	0x4(%rax), %ecx
      15: 89 48 04                     	movl	%ecx, 0x4(%rax)
```

解码`03 48 04`根据第33课的规则.`03`是`ADD r32, r/m32`们的们`48`是`01 001 000`其他`mod = 01`意思是具有8位移动的内存操作仪,`reg = 001`是`%ecx`现在`r/m = 000`是`%rax`移动字节是`04`命令读取4字节`%rax + 4`它们的含量`%ecx`现在,我们要去.`l`后音是`llvm-objdump`字体的宽度为4字节.`%rax`来自的隙`-0x8(%rbp)`现在,我们已经得到了这个空白.`%rdi`根据系统V调用公约,第一个整数参数是指针,指向的对象在偏移4处具有4字节的字段,`bump`读取和写出该领域.

这些字节中没有什么说`int`现在`balance`其他`struct account`其他28个字节是不可见的.`bump`现在,我们要去.

## 系统V布局规则

x86-64 psABI 3.1.2 节为集体提供了三个规则. "结构和工会假设其最严格地排列的组件的配列.每个成员都被分配到可用的最低的配列,配列适当.任何对象的尺寸总是对对象的配列的倍数. "同文件的3.1 图显示了 skalar 尺寸和配列: `char`,,,`short`两和二`int`其他`double`任何指针都在8和8之间.

适用规则在结构中`account.c`其他:

```c
struct account {
    char kind;
    int balance;
    short code;
    double rate;
    const char *label;
};
```

| Member | Size | Alignment | Lowest offset that fits | Padding before |
|---|---|---|---|---|
| `kind` | 1 | 1 | 0 | 0 |
| `balance` | 4 | 4 | 4 | 3 (bytes 1 to 3) |
| `code` | 2 | 2 | 8 | 0 |
| `rate` | 8 | 8 | 16 | 6 (bytes 10 to 15) |
| `label` | 8 | 8 | 24 | 0 |

最后一个成员以32结束.最严格的排列是8,32是8的倍数,所以大小是32没有尾.32个字节中的9个字节是,psABI说"任何的内容是未定义的".

成员的排序决定了成员的规模.`double, pointer, int, short, char`填充的偏移为 0, 8, 16, 20, 22 并且结束为 23,为24 `sysv_layout()`在`code/main.py`通过应用三个规则,产生了两个结果.`ctypes`通过主机编译器的会议应用相同的规则,`ctypes.sizeof`现在`ctypes.alignment`其他`.offset`对于每个领域,给出 32, 8,`0, 4, 8, 16, 24`程序本身将打印第三份副本,当你在这个机器上构建和运行它时:

```text
sizeof 32 align 8
kind 0 balance 4 code 8 rate 16 label 24
sum 315 tag -3 projected 318.75 label_length 7
```

亚马逊的AAPCS64在5.10.1节中规定了相同的总体规则,果的arm64文件保留了这些五个尺寸,因此两个目标的数字一致.课程的x86-64对象是编译的`-target x86_64-unknown-linux-gnu`让第33课中的ELF读者和下面的DWARF读者一起研究它们.

## 阅读其他部分

`bump`其他四个函数在`account.c`其他部分,每个部分都显示不同的指令表格.`account-x86_64-O0-g.objdump.txt`现在,我们要去.

`sum_balances`指标结构的数组:

```text
      51: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      55: 48 63 4d ec                  	movslq	-0x14(%rbp), %rcx
      59: 48 c1 e1 05                  	shlq	$0x5, %rcx
      5d: 48 01 c8                     	addq	%rcx, %rax
      60: 8b 40 04                     	movl	0x4(%rax), %eax
```

`%rax`是`list`现在`%rcx`是`i`扩展到64位的标志,`shlq $0x5`之后的 `addq`现在`%rax`是`list + 32 * i`并且负载读取4字节在元素的4的偏移`i`转换数是这个对象中唯一一个结构的尺寸出现为数字的地方.包含这些指令的循环从`0x49`对于`jmp 0x49`在`0x72`现在,我们要去.

`tag`读到两个狭的字段:

```text
      8c: 0f be 00                     	movsbl	(%rax), %eax
      98: 0f bf 48 08                  	movswl	0x8(%rax), %ecx
```

`movsbl`运载一个字节在偏移 0 并且将其扩展,所以 0 的字段是一个签署的 1 字节整数. `movswl`字符扩展时加载2字节,所以8字段是签署的2字节整数.`-O1`首先是`cmpb $0x6c, (%rdi)`现在,我们可以看到一个字节,

`projected`读到一个浮动:

```text
      cc: f2 0f 2a 40 04               	cvtsi2sdl	0x4(%rax), %xmm0
      d5: f2 0f 59 40 10               	mulsd	0x10(%rax), %xmm0
```

`cvtsi2sdl`将签署的32位整数从内存转换为双,这证实了4的偏移包含了签署的4位整数. `mulsd`换取16是8字节的浮点值.

`label_length`读出一个指针,然后跟随它:

```text
      f3: 48 8b 40 18                  	movq	0x18(%rax), %rax
      f7: 48 63 4d f4                  	movslq	-0xc(%rbp), %rcx
      fb: 80 3c 08 00                  	cmpb	$0x0, (%rax,%rcx)
```

其他`movq`单独是8字节整数或指针.`cmpb`作为一个存储操作符的基础,使用加载值.作为一个地址的值是指针.`cmpb`在索引中读取1字节`%rcx`它们的子,`-O1`指针是通过 `leaq 0x1(%rcx), %rcx`它们在循环内,所以指向的元素距离1字节.

组合五个函数,结构是`{ i8 at 0, i32 at 4, i16 at 8, f64 at 16, pointer at 24 }`只有一个步骤32 . 1 到 3 和 10 到 15 的空白是 psABI 规则预测的填充.`const char *`, 标签字节的标签字节的标签字节为 0 , 字母标签字节为 0`char`并且五个函数都具有相同的类型.`main`通过一个框架对象到所有五个.`-O0`电话站点可视化: `leaq -0x70(%rbp), %rdi`接着是`addq $0x20, %rdi`在之前`callq bump`其他`addq $0x40, %rdi`在之前`callq tag`抵消的值为0`0x20`其他`0x40`它们是一个数组的三个元素,`memcpy`其他`0x60`填满的字节是96字节,这就是32个元素的3个元素.

## 通过

`trace_function()`在`code/main.py`保持一个小抽象状态. 持有器是64位注册表或一个框架插槽,如`-0x8(%rbp)`每个持有者都有三个值之一.`Pointer`是一个根加上一个恒定的偏移加上一组步骤,其中一个步骤记录了许多字节的未知倍数被添加.`Index`任何其他东西都不是什么.

州开始使用六个系统V的论证登记器`Pointer("param0", 0)`通过`Pointer("param5", 0)`然后每个指示都适用一个规则:

- `movq`通过32位或更窄的写入一个登记器,它可以实现一个`Index`根据标准1
- `leaq`通过指标基生成一个指标,加上了移动,并且通过指标登记器添加了 `scale * index_scale`们在们的前进.`leaq`它们的基础是`%rbp`或`%rsp`如何命名一个框架对象`main`通过`rows`现在,我们要去.
- `shlq $n`在一个`Index`乘以其规模`2^n`其他`imulq $k`乘以`k`现在,我们要去.
- `addq`保持指标,并将指标尺度添加到步骤中. `addq $k`转移到指标的偏移,并作为该登记的增值记录.
- 一次通话使所有存储的电话记录都不清楚,并且包含指针的参数记录作为通话站点.
- 任何存储器的基数记录包含指针的操作符都会成为一个`Access`标志器的根和偏移,从记器的宽度和类型,以及一个商店旗.

宽度和品质来自单独的记.`access_width()`图片`b`现在`w`现在`l`其他`q`后音为1,2,4和8字节,`movsbl`其他`movswl`签署的狭窄负载`movzbl`没有签名的`sd`其他`ss`适用于8字节和4字节浮动的 skalar SSE指示,`cvtsi2sdl`通过签署的4字节整数源,`movaps`对于一个向量来说,`leaq`其他`nop`申请表格不是访问.

```python
if memory.base in FRAME_REGISTERS:
    return Pointer(f"frame({memory.base}{format_signed(memory.displacement) if memory.displacement else ''})", 0)
base = env.get(memory.base)
if not isinstance(base, Pointer):
    return Unknown
strides = set(base.strides)
if memory.index is not None:
    index_value = env.get(memory.index)
    strides.add((index_value.scale if isinstance(index_value, Index) else 1) * memory.scale)
return Pointer(base.root, base.offset + memory.displacement, frozenset(strides), base.origin)
```

通过指针的8字节的载荷产生了新的指针,其根名称是它来自的字段,例如`param0->0x18`当该值后来被用作基础或通过 `leaq`换取24的"8字节"为"指针".

### 步骤证据的四种类型

`infer_layout()`通过将每个证人函数的访问方式合并并,并从四个来源收集步骤,每个步骤都包含了产生它的指令.

| Kind | Where it comes from | Build that shows it |
|---|---|---|
| `scale` | an `Index` with scale above 1 reached a pointer, from `shlq $0x5` or `imulq` | `-O0`, `shlq $0x5, %rcx` at `0x59` |
| `loop-step` | a 64-bit increment of the base or index register inside a loop that also contains the access | `-O1`, `addq $0x20, %rdx` at `0x24` |
| `offset-delta` | same-width accesses through one base register inside one loop, at offsets a constant apart | `-O2`, eight loads 32 apart |
| `call-site` | the offsets at which one frame object is passed to the witness functions | `-O0`, `main` passes `rows`, `rows+0x20`, `rows+0x40` |

一个循环是倒退的`jmp`增加数量只有当循环范围包含增加和访问时.`addl $0x1, %eax`现在,我们正在努力.`i`在`-O0`由于它是一个32位的添加,并且因为访问不通过.`%eax`步骤是每个发现的值中最大的共同分数. 尺寸是步骤,步骤至少与最后一个字段的结局一样大.

### 在 -O2 的向量循环

在`-O2`声向量`sum_balances`循环体从`0x50`为了`0xaa`每次通过,读取8个元素:

```text
      3b: 48 8d 87 e4 00 00 00         	leaq	0xe4(%rdi), %rax
      50: 66 0f 6e 50 80               	movd	-0x80(%rax), %xmm2
      55: 66 0f 6e 98 60 ff ff ff      	movd	-0xa0(%rax), %xmm3
      61: 66 0f 6e 90 40 ff ff ff      	movd	-0xc0(%rax), %xmm2
      69: 66 0f 6e a0 20 ff ff ff      	movd	-0xe0(%rax), %xmm4
      7d: 66 0f 6e 10                  	movd	(%rax), %xmm2
      81: 66 0f 6e 58 e0               	movd	-0x20(%rax), %xmm3
      8a: 66 0f 6e 50 c0               	movd	-0x40(%rax), %xmm2
      8f: 66 0f 6e 60 a0               	movd	-0x60(%rax), %xmm4
      a0: 48 05 00 01 00 00            	addq	$0x100, %rax
      aa: 75 a4                        	jne	0x50 <sum_balances+0x40>
```

`%rax`开始于`list + 0xe4`八个移动将负载置于抵消位置.`0x04, 0x24, 0x44, 0x64, 0x84, 0xa4, 0xc4, 0xe4`其他`list`它们是`4, 36, 68, 100, 132, 164, 196, 228`增加是`0x100`通过记录的数据,当它看到它们时,会对比出八个字段,并且至少有232字节的结构.

`fold_unrolled()`通过一个基数目录,取相同宽度的访问.`d`如果循环步骤是`k * d`它们是完全的.`k`圆是解开的`k`时间,每个访问是相同的元素访问在偏移`(offset - lowest) mod d`现在.`256 = 8 * 32`八个偏移,所以所有的八个负载都折叠在偏移4,`offset-delta 32`现在`unrolled 32`其他`loop-step 256`缩的残余循环在`0xe0`增加`scale 32`其他`shlq $0x5, %rdx`其他`loop-step 32`其他`addq $0x20, %rdx`五个值中最大的共分数是32

图像有一个按,它关闭折叠.`-O2`字节32之后的7个字段没有大小. 这种状态是读者看到的,谁信任的转移没有循环.

## 通过字节

其他`-g`构建`account.c`包含八个调试部分.`.debug_info`只有499字节`.debug_abbrev`其他地方`.debug_str`其他国家`.debug_str_offsets`其他国家`.debug_addr`其他国家`.debug_line`其他国家`.debug_line_str`12,以及`.debug_frame`264. 引入DWARF5标准列表`.debug_str_offsets`现在`.debug_addr`其他`.debug_line_str`读者在 `code/main.py`需要第五个.

### 单位标题

标准的7.5.1.1节提供了完整的编译单位标题: `unit_length`现在`version`现在`unit_type`现在`address_size`其他`debug_abbrev_offset`它们是第一个12个字节.`.debug_info`是:

```text
e9 01 00 00   unit_length = 0x1e9 = 489
05 00         version = 5
01            unit_type = DW_UT_compile
08            address_size = 8
00 00 00 00   debug_abbrev_offset = 0
```

其他`unit_type`长度自行计算字节,所以下一个单元将从`4 + 489 = 493`部分的结尾.`llvm-dwarfdump --debug-info`印出相同的五个值`Compile Unit:`测试的第一行分析了该行,并进行了比较.

### 简称

部分2.1表示,每个调试信息输入"由一个识别标签和一系列属性组成".该输入本身只存储一个缩写代码.该代码选择一个声明.`.debug_abbrev`标签的名称,表示孩子是否会跟随,并列出每个属性及其形式.这个对象有14个声明.

```text
[12] DW_TAG_structure_type  DW_CHILDREN_yes
     DW_AT_name              DW_FORM_strx1
     DW_AT_byte_size         DW_FORM_data1
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
[13] DW_TAG_member           DW_CHILDREN_no
     DW_AT_name              DW_FORM_strx1
     DW_AT_type              DW_FORM_ref4
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
     DW_AT_data_member_location  DW_FORM_data1
```

`parse_abbreviations()`读取ULEB128代码,ULEB128标签,一个儿童字节,然后属性和形式对,直到一个 `0, 0`部分7.5.6 列出了表格编码: `data1`只有一个字节,`ref4`是对单位的4字节偏移,`strx1`是一个字节指数进入字符串抵消表,`sec_offset`其他`data4`它们是4字节,`addrx`是ULEB128指数进入地址表,`exprloc`是ULEB128长度和许多字节,`flag_present`没有字节.

### 按手解码平衡成员

结构入口`account`开始在抵消时`0x195`字节`0c 15 20 00 03`简称是12号,结构.`DW_AT_name`是字符串指数`0x15`现在`DW_AT_byte_size`是`0x20`它们是32个.`DW_AT_decl_file`是0和`DW_AT_decl_line`是3的直线.`struct account {`在源头.

第二次成员入会开始于`0x1a3`随着`0d 10 88 01 00 00 00 05 04`其他:

1. `0d`简称为13个,一个成员.
2. `10`是`DW_AT_name`作为`strx1`字符串指数 16
3. `88 01 00 00`是`DW_AT_type`作为`ref4`抵消`0x188`起的单位,即`DW_TAG_base_type`名称的条目`int`现在,我们要去.
4. `00`是`DW_AT_decl_file`其他`05`是`DW_AT_decl_line`                   `account.c`现在,我们要去.
5. `04`是`DW_AT_data_member_location`抵消 4.

5.7.6 节说,一个成员条目"可能具有 DW_AT_data_member_location属性或 DW_AT_data_bit_offset属性",并且一个整数常数"是包含实体开始的字节中偏移.`addl 0x4(%rax), %ecx`其他`compare_layouts()`是把两个边放在一起的函数.

### 字符串和地址通过两个表格

字符串指数16不是对 `.debug_str`读者会看到`DW_AT_str_offsets_base`单元输入是8个,并读取4字节输入在`8 + 4 * 16`在`.debug_str_offsets`这条条条目包含了`"balance"`在`.debug_str`其他地址也适用于相同的间接指导.`sum_balances`开始于字节`07 07`简称7号,一个子程序,然后`DW_AT_low_pc`作为`addrx`排行第7号.`8 + 8 * 7`在`.debug_addr`是`0x30` 函数的地址`.text`列表的第六条是六条字符串字母的地址.

在可移动对象中,没有一个表保持其最终值.`.debug_str_offsets`在文件中是零,`.rela.debug_str_offsets`持有 29 `R_X86_64_32`转移`.debug_str`附加上部分的实际抵消.`.debug_addr`只有13个`R_X86_64_64`转移`.text`其他`.rodata.str1.1`现在,我们要去.`.debug_info`经过四次迁移,`DW_AT_str_offsets_base`作为`.debug_str_offsets+0x8`现在`DW_AT_stmt_list`其他`DW_AT_addr_base`作为`.debug_addr+0x8`现在,我们要去.`ElfObject.relocated()`适用`S + A`在读者分析部分之前,用于32位和64位类型. 部分符号在对象文件中具有0值,因此该字段接收了添加. `llvm-dwarfdump`输出显示每个索引的名称和地址.

### 类型,功能和地点

`DwarfInfo.type_name()`接下来`DW_AT_type`关于""的相关问题`label`成员在一个`DW_TAG_pointer_type`,这指的是`DW_TAG_const_type`它们的位置是`char`基型,所以名称由`const char *`现在,我们要去.`type_size()`收益`DW_AT_byte_size`对于基类型和结构,指针为8个,对阵列为数倍元素大小. `type_kind()`减少了`DW_AT_encoding`基型的`int`具有标志,或`float`标签:`pointer`它们的语言是相比使用的.

`DwarfInfo.functions()`读到六个`DW_TAG_subprogram`其他信息`bump`运行从`0x0`为了`0x21`现在,`DW_AT_low_pc`另外一个`DW_AT_high_pc`长度,它的框架基是`DW_OP_reg6 RBP`并且其参数`a`具有位置表达式`91 78`其他`DW_OP_fbreg`具有SLEB128值`0x78`这就是的插槽.`-0x8(%rbp)`列表存储在哪里`%rdi`在地址`0x4`导向和指示描述了两个侧面相同的插槽.

## 两种布局相比

`compare_layouts()`通过DWARF成员进行行程,并寻找相同的偏移时推断的场地.`no-evidence`具有不同尺寸的场是`size-mismatch`指针成员的字段从来没有被移除`pointer-unproven`不同意的类型,如指令使用整数算法的浮动器,是`kind-mismatch`开始于成员内部或料内部的输入场是`unexpected`尺寸比较了步骤的`DW_AT_byte_size`现在,我们要去.

对于三个构建的数字,从`python3 code/main.py`其他:

| Build | Accesses through the first parameter | Fields | Stride evidence | Members matched | Size |
|---|---|---|---|---|---|
| `-O0` | 11 | 5 | `scale 32`, `call-site 32`, `call-site 64` | 5 of 5 | 32, match |
| `-O1` | 9 | 5 | `loop-step 32` | 5 of 5 | 32, match |
| `-O2` | 17 | 5 after folding, 12 before | `offset-delta 32`, `unrolled 32`, `loop-step 256`, `scale 32`, `loop-step 32` | 5 of 5 | 32, match |

推断的空白是每个构建中的1到3和10到15字节,这些是DWARF布局的填充字节.每个推断的字段都位于其自身尺寸的倍数,这是psABI规则要求的,`natural_alignment_ok()`记录了这一点.

随着一个接一个的函数,图像会发生变化.`bump`单独布局是4的偏移点,尺寸是未知的,下边界是8.`sum_balances`增加了步骤.`tag`增加了0和8的偏移.`projected`增加浮动量为16`label_length`增加指针为24,证明它是指针. `main`加入电话站点`-O0`没有什么增加.`-O1`其他`-O2`图像通过每个构建的顺序.

没有任何名字,没有任何指令.`const`头型的头型`label`只有"元素的区别为1字节"`leaq 0x1(%rcx), %rcx`在串链循环中,`char`子`unsigned char`其他`_Bool`在`-O1`字节在偏移 0 的标志是未知的,因为`cmpb $0x6c, (%rdi)`通过报告 通过报告 通过报告`int8`在那里`i8`在`-O0`在哪里`movsbl`这些事实是35课记录为未知的.

## 基于C++的对象

`shapes.cpp`定义`Shape`没有任何其他技术,`area()`并且一个虚拟的`name()`其他`Rect`根据`Shape`增加了两个`int`对于 x86-64 Linux,Clang 如何将这些设置.

### 错误的名称

根据"ABI"第5.1.2节,一个名字被先fix成.`_Z`它们的名称是"字符号"的代码.`_ZNK4Rect4areaEv`读成:`_Z`现在`N`对于一个嵌套的名称,`K`对于一个 const 成员函数,`4Rect`其他`4area`作为长度上固定的源名,`E`封闭嵌套名称,`v`对于空置参数列表.`llvm-cxxfilt`印记`Rect::area() const`现在,我们要去.`_Z8describeRK5Shapei`是`describe(Shape const&, int)`其他`R`是参考,`K`是恒定`5Shape`是一个类型,`i`是`int`5.1.4 节中的特殊名称是`_ZTV`对于一个电表,`_ZTI`对于类型信息,`_ZTS`构建者和破坏者是`C1`现在`C2`现在`D0`现在`D1`其他`D2`现在,`_ZN4RectD0Ev`其他`_ZN4RectD2Ev`两者均以`Rect::~Rect()`删除驱逐器和基对象驱逐器共享源名.

`Demangler`在`code/main.py`涵盖该子集以及5.1.5.2节的建筑类型代码和`S_`测试将其运行在所有19个名称上,并与捕获的测试进行比较.`llvm-cxxfilt --no-strip-underscore`在 macOS 上,旗是重要的,工具默认地删除一个主要的突显,然后无法识别`Z8describe...`现在,我们要去.

### 由于其搬迁而产生的

亚博足彩网址的2.5.2节列出了虚拟表的组件:虚拟调用抵消,虚拟基础抵消,抵消到顶部,typeinfo指针,然后是虚拟函数指针.地址点,对象的 vptr的值,是第一个函数指针的地址 (2.6.2节). `Rect`没有虚拟基础,所以它的表是对应的, 类型信息, 函数.

标志`_ZTV4Rect`在对象中每个字节是零.内容在`.rela.data.rel.ro._ZTV4Rect`其他:

```text
0000000000000008 R_X86_64_64              _ZTI4Rect
0000000000000010 R_X86_64_64              _ZN4RectD2Ev
0000000000000018 R_X86_64_64              _ZN4RectD0Ev
0000000000000020 R_X86_64_64              _ZNK4Rect4areaEv
0000000000000028 R_X86_64_64              _ZNK4Rect4nameEv
```

机场0保持偏移到上方,这是0并且不需要转移.机场1是类型信息.地址点是`+16`从那开始,零分是完整对象破坏者,一分是删除破坏者,二分`area`其他地方`name`现在,我们要去.`read_vtable()`读取符号大小,其范围中的转移,以及 0 的偏移值.`Shape`桌子的形状与`__cxa_pure_virtual`在插槽2中,这是一个纯虚拟通话达到的运行时间函数.

### 其他技术

2.9.4节描述了`std::type_info`作为 vptr,然后是指向 mangled 类型名称的指针,并列出衍生类. `_ZTI4Rect`已有三次迁移:`_ZTVN10__cxxabiv120__si_class_type_infoE+0x10`现在`_ZTS4Rect`其他`_ZTI5Shape`第一个是" "的表`__si_class_type_info`对于一个具有单个公共非虚拟基础的类型,ABI使用的类型是零抵消的类型,`+0x10`列中的第二个点`4Rect`,这是类型名称,`name()`在一个`type_info`现在,我们可以把它回来,`_ZTI5Shape`使用`__class_type_info`没有基准指针.`read_typeinfo()`答案是:

### 虚拟电话

`describe`在`-O0`打了一个虚拟电话:

```text
       f: 48 8b 7d f8                  	movq	-0x8(%rbp), %rdi
      13: 48 8b 07                     	movq	(%rdi), %rax
      16: ff 50 10                     	callq	*0x10(%rax)
```

第一个`movq`读取8字节在对象的偏移 0,这是 vptr,因为ABI将其放在一个类中,具有虚拟函数.`callq`通过了`0x10`通过VPTR,`0x10 / 8`现在,我们要做什么?`find_virtual_calls()`符合模式,并报告两位候选人: `Rect::area() const`其他`_ZTV4Rect`其他`__cxa_pure_virtual`其他`_ZTV5Shape`哪个运行取决于对象,这就是为什么电话是间接的.

查器记录了同一个插槽.`DW_TAG_subprogram`关于`area`在两类都携带`DW_AT_vtable_elem_location (DW_OP_constu 0x2)`现在`name`击器带有零.`Rect`是一个`DW_TAG_structure_type`具有16字节的字节`DW_TAG_inheritance`报名`Shape`在抵消 0 和成员`w`在8点和`h`在12点.`Shape`是 8 字节,有一个人工成员`_vptr$Shape`两个独立衍生式为 `area`:移动表和调试输入.

在`-O1`任何物体都没有可取.`main`建筑物`Rect`编译器解决了问题.`r.name()`其他`describe(r, 2)`任何东西都不取取表的地址,所以表不会发射. `describe`仍然包含`movq (%rdi), %rax`其他`callq *0x10(%rax)`由于它的参数可以是任何`Shape`缺失的vtable是关于一个对象文件的事实,测试`test_the_optimised_object_keeps_the_call_pattern_but_drops_the_vtables`检查两半.

微软的ABI在每一个细节中都不同.`?`通过电话编码,`void test(void)`编译为C++`__cdecl`是`?test@@ZAXXZ` RTTI 定位器位于`vfptr[-1]`作为一个`_RTTICompleteObjectLocator`它们的符号是`??_7`对于一个可选的`??_R4`微软的文件说:"编译器供应商之间没有C++命名标准".这堂课的设置仅是Itanum.

## 工具如何呈现复苏的类型

在此机器上生成的输出,并被捕获到`code/fixtures/tools/`没有安装的工具的行列描述其文档,并表示.

| Tool | Version, licence | Where types live | On our fixtures |
|---|---|---|---|
| Ghidra | 12.1.4, 2026-09-21, Apache-2.0 | Data Type Manager with built-in, user-defined, and derived types; `.gdt` archives; types used by a program are copied into it | With DWARF: `/DWARF/account.c/account size=32 align=8` and `a->balance = by + a->balance;`. Without: `*(int *)(param_1 + 4)` with `long param_1`, `tag(char *param_1)`, and `*(char **)(param_1 + 0x18)` |
| IDA Pro | 9.4, 2026-07-13, commercial; IDA Free is non-commercial with a cloud decompiler for x86 only | Local Types window, `.til` type libraries, DWARF and PDB import into a `dwarf` or `pdb` folder | Not installed. Documentation only |
| Binary Ninja | 6.0, 2026-09-03, commercial with a Free edition | Type editing, header import and export, type archives, debug info from DWARF and PDB, type libraries, platform types | Not installed. Documentation only |
| radare2 | 6.2.4, 2026-10-05, LGPLv3 | `ts`, `tsc`, `afvd` | `ts` and `tsc account` printed nothing for the relocatable object with `bin.dbginfo=true`; `pdf` shows `mov dword [rax + 4], ecx` with source line comments from DWARF |
| rizin | 0.9.1, 2026-06-29, LGPL core | `ts`, `tsc`, `afvd` | `tsc account` printed `struct account { char kind; int balance; short code; double rate; const char *label; };` from DWARF; the build without `-g` lists only its bundled header types |
| lldb | lldb-1703.0.236.21 | `image lookup -t` | `byte-size = 32` and the full `compiler_type` text from the ELF object |
| gdb | not installed here | `ptype /o` prints "the offsets and sizes of fields in a struct" with holes marked | Documentation only |
| pyelftools | 0.33, public domain | Python API over `.debug_info` | A 43-line script prints the same five members and `unit version 5` |
| llvm-dwarfdump | Apple LLVM 17.0.0 | `--debug-info`, `--debug-abbrev`, `--debug-str-offsets` | The oracle for every reader test |

没有DWARF的Ghidra输出显示了相同的两个规则.`char *`到 的参数`tag`因为函数通过它比较一个字节,`char **`进入场地`0x18`因为`label_length`转移了加载值,并将字节进行比较. 这两个规则是本课中的两个规则:从指令的宽度,从指令的指针. 吉德拉的解译器文档说,p码符号"不一定有与它们相关的数据类型",并且解译器"最终通过传播分配了正式的数据类型". 设置"引入常数指针"的选项将相同的扩散扩展到常数. 格里达12.1将比特字段恢复添加到解译器中,

达的数据类型管理员,IDA的本地类型,二元忍者类型档案,`td`通过将你输入什么字段,你猜测哪些字段.

根据Ghidra提供商的 rea 6.5.0 返回解译器文本作为记录.Ghidra 行中的所有内容都适用于它,并且记录中没有产生它们的证据的类型名称.`python3 code/main.py infer`在同一名单上给你提供了证据.

## 类型推理研究

通过一个类型推理系统的约束生成半个,仅限于一个从参数到达的结构.

- TIE (Lee,Avgerinos,Brumley,NDSS 2011) 将类型重建作为制约生成和解决二进制 IR,测量了保守性和精度,并将其与87个核心程序的商业解译器进行了比较.
- 复式 (Noonan, Loginov, Cok, PLDI 2016) 增加了子型,多形性和递归型,并报告了指针的重建 `const`博平台的应用程序是GrammaTech的名称.
-  OSPREY (Zhang等, IEEE S&P 2021) 将每个存储位置视为随机变量,并推断最可能的类型.
- 通过学习模型,DIRTY (Chen等,USENIX Security 2022) 和ReSym (Xie等,CCS 2024) 进行后处理解译器输出,而ReSym在完整结构布局上报告了72.9%的精度.
- RecStruct (Chen等, USENIX Security 2026) 恢复了无解译器的嵌套结构,具有流量不敏感的符号执行和堆槽上的联盟.

堆结构是这个课程的第一件事.`-O1`现在`main`保持`rows`在堆上,并有线代码.`0x24(%rsp)`现在`0x40(%rsp)`现在`0x48(%rsp)`现在`0x30(%rsp)`其他`0x38(%rsp)`修改组32是4,0,8,16和24的,相同的结构,没有参数可以从中种植.

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
```

输出是一个五部分的JSON报告. `dwarf`具有单位标题,结构和函数.`-O0`它们是什么?`oracles`包含了 psABI 规则布局,`ctypes`设置,DWARF布局,本地运行,`agree`标志`builds`它们的位置和位置都在一个位置上.`cxx`包含了解密的名称,两个vtables,两个typeinfo记录,虚拟呼叫,和DWARF插槽. `tools`列出捕获的工具输出.

预期的形状:

```json
{
  "dwarf": {"unit": {"unitLength": 489, "version": 5, "unitType": "DW_UT_compile", "addressSize": 8, "abbrevOffset": 0}, "...": "..."},
  "oracles": {"agree": true, "psabiRules": {"size": 32, "align": 8, "...": "..."}, "...": "..."},
  "builds": {
    "O0": {"layout": {"stride": 32, "size": 32, "gaps": [1, 2, 3, 10, 11, 12, 13, 14, 15], "...": "..."}, "comparison": {"matches": 5, "members": 5, "...": "..."}},
    "O1": {"...": "..."},
    "O2": {"...": "..."}
  },
  "cxx": {"virtualCalls": [{"slot": 2, "candidates": {"Shape": "__cxa_pure_virtual", "Rect": "_ZNK4Rect4areaEv"}, "...": "..."}], "...": "..."}
}
```

阅读`code/main.py`在此顺序:

1. `ElfObject`读取部分,符号和迁移,`relocated()`适用`S + A`通过一个调试部分.
2. `parse_abbreviations()`其他`DwarfInfo._parse_unit()`阅读标题,缩写表,以及条目,然后解决`strx`其他`addrx`通过两个桌子.
3. `DwarfInfo.struct_layouts()`其他`functions()`转换成`StructLayout`其他`FunctionInfo`记录,与`type_name()`现在`type_size()`其他`type_kind()`现在,我们要去.
4. `parse_listing()`现在`parse_memory()`其他`access_width()`阅读`llvm-objdump`给我一个短信.
5. `trace_function()`是抽象状态机,`fold_unrolled()`其他`infer_layout()`让接入成为一个布局.
6. `compare_layouts()`产生状态行,`sysv_layout()`其他`ctypes_layout()`其他两个神言.
7. `Demangler`现在`read_vtable()`现在`read_typeinfo()`其他`find_virtual_calls()`覆盖C++对象.

现在还有四个命令.`python3 code/main.py dwarf FILE.o`打印任何DWARF 5可移动的对象的结构和功能. `python3 code/main.py infer LISTING.txt [FILE.o]`通过一个列表,并与一个对象进行比较.`python3 code/main.py demangle NAME...`其他`python3 code/main.py vtable FILE.o`覆盖C++的一半.

## 用它

在你自己建造的新物体上:

1. 捕获`llvm-objdump -d -r`通过读取文本.
2. 跑步`python3 code/main.py infer`在列表上. 首先阅读证人行:它列出了作为存储库的第一个参数使用的函数. 如果缺失函数,其参数从未达到存储操作数,或者通过传递不追踪的路径达到一个.
3. 读取每个场地,一个访问是一个证人,记录一个证人的场地,
4. 阅读步骤证据.`call-site`或`scale`进入是强大的.`loop-step`没有其他类型的输入是弱的,因为一个未滚动的循环报告了几个元素的步骤.`unrolled`现在,看看,手动检查.
5. 如果一个`-g`构建存在,运行比较,阅读没有的每一行`match` `no-evidence`列名字一个成员没有触及的函数.`unexpected`通过无法设置的行名字.
6. 输入布局到工具类型管理器中,作为结构,并记录哪些字段,名称和类型是猜测.

保持三个神言在手里.`ctypes`您发现一个包装结构,一个比特字段,或者一个有不同的规则的目标.

## 互动实验室

### 实验室A:解码成员输入

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types/code
python3 -q
```

运行:

```python
from main import *
elf = load_object("account-x86_64-O0-g.o")
dwarf = DwarfInfo(elf)
dwarf.header()
elf.section(".debug_info").data[0x1a3:0x1ac].hex(" ")
dwarf.dies[0x1a3].attributes
dwarf.type_name(dwarf.type_of(dwarf.dies[0x1a3]))
```

在看词典之前,用13个字节在纸上解码9个字节.然后读出原始部分,`elf.section(".debug_str_offsets").data[8:16].hex()`另一个被移居的.`elf.relocated(".debug_str_offsets")[8:16].hex()`解释区别.

### 实验室B:追踪一个函数

```python
listing = load_listing("account-x86_64-O0-g.objdump.txt")
trace = trace_function("label_length", listing["label_length"])
[(hex(a.address), a.root, a.offset, a.width, a.kind) for a in trace.accesses]
trace.pointer_uses
trace_function("sum_balances", listing["sum_balances"]).loops
```

在运行之前,写下哪个访问证明24是指针.然后在 运行相同的行`-O1`列出并找到`leaq 0x1(%rcx), %rcx`在`trace.increments`现在,我们要去.

### 实验室C:折叠向量循环

```python
o2 = load_listing("account-x86_64-O2-g.objdump.txt")
trace = trace_function("sum_balances", o2["sum_balances"])
sorted({a.offset for a in trace.accesses})
folded, evidence = fold_unrolled(trace, trace.accesses)
sorted({a.offset for a in folded}), [(e.kind, e.value, e.text) for e in evidence]
```

然后跑去`analyze_build("O2", fold=False)["comparison"]`并且计算`unexpected`改变折叠规则,所以需要循环步骤是正确的`k * d`随着`k`确认 `-O1`循环,一个接入和32步, 已被遗留.

### 实验室D:表和名称

```python
shapes = load_object("shapes-x86_64-O0-g.o")
read_vtable(shapes, "_ZTV4Rect")
read_typeinfo(shapes, "_ZTI4Rect")
demangle("_ZNK4Rect4areaEv"), demangle("_Z8describeRK5Shapei")
find_virtual_calls(load_listing("shapes-x86_64-O0-g.objdump.txt"), [read_vtable(shapes, "_ZTV5Shape"), read_vtable(shapes, "_ZTV4Rect")])
```

从 计算区块`callq *0x10(%rax)`在纸上,然后确认它反对`DwarfInfo(shapes).struct("Rect").virtual_methods`然后加载`shapes-x86_64-O1-g.o`试着`read_vtable`阅读下面的文章.`ElfError`解释为什么这个符号没有.

## 实践实验室

恢复堆积结构`main`在`-O1`现在,我们要去.

要求:

- 延长时间`trace_function()`子的位置可以是根.`movaps`那些店铺充满了`0x0(%rsp)`为了`0x5f(%rsp)`其他`.data.rel.ro`作为一个 字节的 96 字节初始化器`rows`现在,我们要去.
- 赋值入线访问`0x24(%rsp)`现在`0x40(%rsp)`现在`0x48(%rsp)`现在`0x30(%rsp)`其他`0x38(%rsp)`根据这些数据,我们可以将其运用到该根和报告的代价中.
- 从循环中推出步骤32`0x120`为了`0x12c`在哪里`%r14`开始于4点,进步到4点.`0x20`之前`0x64`并且显示循环的结合`0x64`现在,我们可以说,
- 结果与DWARF布局进行比较,达到五个匹配,并记录哪种类型未被证明.
- 添加一个测试,当将框架根归因于参数时失败.

成功意味着`python3 code/main.py infer`在`-O1`列表列表`main`作为一个有框架根的证人,比较显示了5个匹配的`main`只有一个人.

## 教训艺术品

这一课包括`outputs/skill-recovering-data-and-types.md`通过它将列表和可选的调试构建成一个结构布局,每个字段都有证据,一个步骤与其来源,与DWARF进行比较,以及一个未知的内容列表.它需要访问表,步骤证据,折叠检查,DWARF Oracle当存在时,以及任何指令都无法提供的名称和资格声明.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

验证应证明:

- 单元标题,14个缩写和五个成员抵消符号同意`llvm-dwarfdump`
- 通过移居者来收到名字`.debug_str_offsets`机和单位的机`str_offsets_base`其他`addr_base`只有8个
- 六个函数包含范围,`DW_OP_reg6 RBP`其他`DW_OP_fbreg`排放所显示的位置,它们的低地址等于列表的函数开始
- 没有物体`.debug_info`升级器和LEB128解码器处理器`0x78`作为 -8
- `pyelftools`其他`lldb`打印与读者相同的布局
- 根据 psABI 规则,`ctypes`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`0, 4, 8, 16, 24`结构是24字节.
- 列表解析器在 `bump`附加器`R_X86_64_PLT32 bump-0x4`接到电话`0x194`现在,我们可以在`0x72`
- 记忆操作符,宽度,类型和标志从AT&T文本和内蒙古文本中解码
- `bump`在`-O0`从框架插槽中读取其指针,并在4的偏移时进行3次访问
- 步骤来自`shlq $0x5`在`-O0`根据`addq $0x20, %rdx`在`-O1`通过256步骤折叠的8个负载`-O2`
- `label_length`通过删除引用来证明24的偏移点
- `main`通过一个框架对象在偏移 0 `0x20`其他`0x40`在`-O0`没有什么叫什么,`printf`在`-O1`
- 每个构建都匹配5个成员中的5个,尺寸32个,空隙等于DWARF填充
- 没有折叠`-O2`构建报告7个字节32段过去了,没有尺寸
- 尸体将所有19个物体复制.`llvm-cxxfilt`字符串
- 两者都是vtables,两者都是typeinfo记录,`0x16`通过2分钟,DWARF同意
- 其他`-O1`C++ 对象保留了调用模式,没有vtable
- 基德拉,里津和雷达2捕获显示结构与DWARF,而原始的抵消没有它
- 互动图像包含分析产生的相同数据

## 生产失败模式

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Unrolled loop | Eight fields 32 bytes apart and a 232-byte struct | Loop step 256 equals 8 times the offset delta 32, so one field at offset 4 |
| Stride read from one increment | `sizeof` 256 from `addq $0x100` | The greatest common divisor of every stride source, with the scalar tail's `addq $0x20` |
| 8-byte field called a pointer | `void *` at offset 24 | A later access uses the loaded value as a base, or the kind stays `int64` |
| Pointer called an integer | `long` at offset 24 | The dereference at `0xfb`, recorded as pointer proof |
| Narrow compare | `char` with a sign | `cmpb` carries no sign; only `movsbl` or `movzbl` does |
| Five functions assumed to share a type | One struct with no evidence of aliasing | Call sites in `main` that pass one frame object, or an explicit analyst assertion |
| Strings read from `.debug_str` by index | Garbage names from a relocatable object | `str_offsets_base` plus the relocated `.debug_str_offsets` entry |
| Addresses read as numbers | `low_pc` of 0 for every function | `addrx` through the relocated `.debug_addr` table |
| DWARF 4 object | A reader that misparses the header | Version check on the second header field; 4 has no `unit_type` byte |
| Missing vtable | "the class has no virtual functions" | The `-O1` object inlined every call; the `-O0` object has the table and its relocations |
| Vtable slot read from the wrong base | Off-by-two slot numbers | The address point is 16 bytes past the symbol, after offset-to-top and typeinfo |
| Mangled name stripped | `Z8describeRK5Shapei` left as is | `--no-strip-underscore` on macOS, or a demangler that checks for `_Z` |
| Struct typed from one tool's guess | `char *param_1` taken as the field type | The width and the dereference, written as evidence, and the name marked as a guess |

## 运营规则

恢复一个从一个接入和一个从一个循环的步骤,并将指示附在每个. 在你信任过一步的偏移之前,折叠解锁圈. 阅读DWARF通过其缩写和移动表格,从来没有索引到字符串部分. 根据每个字段进行比较,并将每个成员都写成没有证据的,每个未经证明的指针, 在C++对象中,从其移动中读取vtable和从调用中读取slot,然后使用DWARF来确认您读取的slot.

## 进一步阅读

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, section 3.1.2: Data Representation](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), section 5.10: Composite Types](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 1, section 3.7.5: Specifying an Offset](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [DWARF Debugging Information Format Version 5, sections 2.1, 5.7.6, 7.5.1.1, 7.5.3, 7.5.6](https://dwarfstd.org/doc/DWARF5.pdf)
- [Itanium C++ ABI, sections 2.5 (Virtual Table Layout), 2.9 (Run-Time Type Information), 5.1 (External Names)](https://itanium-cxx-abi.github.io/cxx-abi/abi.html)
- [Microsoft Learn: Decorated names](https://learn.microsoft.com/en-us/cpp/build/reference/decorated-names?view=msvc-170)其他[Name Decoration](https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/name-decoration?view=msvc-170)
- [llvm-dwarfdump command guide](https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html)其他[llvm-cxxfilt command guide](https://llvm.org/docs/CommandGuide/llvm-cxxfilt.html)
- [Python ctypes: Structure layout, sizeof, alignment](https://docs.python.org/3/library/ctypes.html)
- [Ghidra Data Type Manager](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/help/help/topics/DataTypeManagerPlugin/data_type_manager_description.htm)现在[Decompiler Concepts](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerConcepts.html)现在[Decompiler Options](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerOptions.html)其他[Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build)
- [IDA 9.1 user guide: Types](https://docs.hex-rays.com/9.1/user-guide/types)现在[IDA 9.4 release post](https://hex-rays.com/blog/ida-9.4-release-a-new-dyld-shared-cache-swift-analysis-new-teams-add-on-and-more-)其他[IDA Free](https://hex-rays.com/ida-free)
- [Binary Ninja user guide: Types](https://docs.binary.ninja/guide/types/)其他[Binary Ninja 6.0 Krypton](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)其他[rizin v0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
- [GDB manual: Examining the Symbol Table, ptype /o](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Symbols.html)
- [pyelftools on PyPI](https://pypi.org/project/pyelftools/)
- [Lee, Avgerinos, Brumley, "TIE: Principled Reverse Engineering of Types in Binary Programs" (NDSS 2011)](https://www.ndss-symposium.org/ndss2011/tie-principled-reverse-engineering-of-types-in-binary-programs/)
- [Noonan, Loginov, Cok, "Polymorphic Type Inference for Machine Code" (PLDI 2016)](https://arxiv.org/abs/1603.05495)其他[the retypd repository](https://github.com/GrammaTech/retypd)
- [Zhang et al., "OSPREY: Recovery of Variable and Data Structure via Probabilistic Analysis for Stripped Binary" (IEEE S&P 2021)](https://ieeexplore.ieee.org/document/9519451/)
- [Chen et al., "Augmenting Decompiler Output with Learned Variable Names and Types" (USENIX Security 2022)](https://www.usenix.org/conference/usenixsecurity22/presentation/chen-qibin)
- [Xie et al., "ReSym: Harnessing LLMs to Recover Variable and Data Structure Symbols from Stripped Binaries" (CCS 2024)](https://dl.acm.org/doi/10.1145/3658644.3670340)
- [Chen et al., "RecStruct" (USENIX Security 2026)](https://www.usenix.org/conference/usenixsecurity26/presentation/chen-yuxin)
