# 程序解剖:从零开始的ELF读者

> 编译程序是指向彼此的表格集合.你写的读者提供了输出,你可以对字节进行检查.

**Type:** Build
**Languages:** Python (stdlib), TypeScript, C (fixture only)
**Prerequisites:** Phase 0 · 01 (Dev Environment) with clang installed, Python 3.10 or later, hexadecimal arithmetic
**Time:** ~120 minutes

## 学习目标

- 说明本轨道中每一个目标的授权规则以及17 U.S.C. 1201 (f) 的四个限制.
- 阅读ELF标题,部分标题表,以及两个字符串表`struct.unpack`现在,我们要去.
- 解码`.symtab`报名`.rela`记录了来自gABI和x86-64 psABI的名称.
- 返回一个命名函数的确切字节,并将每个被偏移的文件映射到它拥有的结构.
- 阅读程序标题,将虚拟地址映射到通过的文件中.`PT_LOAD`现在,我们要去.
- 读取一个马赫-O对象的载荷命令,并给每个对象匹配的ELF想法.

## 开始前:授权和法律

课程32到36中的每一个目标都是你写的和编译的程序.`code/fixtures/ledger.c`您拥有源头,编译器命令和它生成的对象文件.没有读取许可证,没有传输保护,没有第三方您打开代码.这条轨道从来不涵盖软件保护,许可证检查或您不拥有的程序.

法律认为拆除是复制. 在*Sega Enterprises Ltd. 其他 美国"阿科莱德"公司*, 977 F.2d 1510 (9th Cir. 1992年),法院裁定拆卸过程中制造的中间副本是版权法规的副本. 法律规定,在"拆除"是获得在版权保护的计算机程序中包含的思想和功能元素的唯一途径,并且有正当理由寻求此类访问,拆除是法律上对版权保护的作品进行公平使用.

第二个案例是*索尼电脑娱乐公司诉康涅狄格公司*,203 F.3d 596 (2000年9月9日).康涅狄格公司在建造模拟器时复制了PlayStation BIOS,法院认为这些副本是公平使用的.这两起案例都保护了研究.最终产品中没有保护复制代码.

两项法规设定了极限. 美国法规第17条 1201(f) 允许"合法获得使用计算机程序副本的权利"的人绕过访问控制"仅为了识别和分析程序的那些元素,是必要的,以实现独立创建的计算机程序与其他程序的互操作性". 标准:合法复制,互操作性目的,尚未"易于使用"的元素,以及其他不违反的分析. 只有1201 (f) 节是反规则的例外. 复制问题仍然是公平的.

在欧盟,2009/24/EC条款5 (3) 涵盖研究.拥有使用副本权的人可以"观察,研究或测试程序的运作,以确定基于程序的任何元素的想法和原则".该权利适用于加载,显示,运行,传输或存储程序.

根据第6条,在"获取实现独立创建计算机程序互操作性所需的信息是不可或缺的"情况下,未经权利持有人的许可,可拆译. 条件与1201相符. 许可证持有人执行这些行为,这些信息还没有很快获得,而这些行为仍然存在于所需部分范围内. 根据第6条 (2) 禁止使用结果用于任何其他目标或类似于表达的程序. 根据第8条,违反第6条或第5条 (3) 条的合同条款无效.

| Source | What it allows | Conditions |
|---|---|---|
| 17 U.S.C. 1201(f) | Circumventing an access control to analyze a program | Lawful copy, interoperability purpose, information not readily available, no infringement |
| Directive 2009/24/EC Art. 5(3) | Observing, studying, and testing a running program | A right to use the copy, acts within normal loading and running |
| Directive 2009/24/EC Art. 6 | Decompilation | Licensee, interoperability purpose, information not readily available, confined to the needed parts |
| *Sega v. Accolade* | Disassembly as fair use | The only way to reach the ideas and functional elements, a legitimate reason |
| *Sony v. Connectix* | Intermediate copies during reverse engineering | A non-infringing final product |

根据"反向工程"手册第101节,在申请申请时,请在开放文件之前获得书面授权,并将授权与证据保持在一起.

## 问题

你编译了`ledger.c`走了`llvm-objdump -t`在对象上.输出列表`percent_change`在价值`0000000000000000`具有尺寸`0000000000000010`列表还显示了1768字节文件中的哪些16字节是这个函数?`R_X86_64_PC32 .rodata+0x10`在抵消`0x36`文件中的四个字节是零.它们将成为什么,为什么是添加`0x10`当桌子开始时`0x14`现在,我们要去.

 rea回答布局问题`inspect_binary_layout`只有Linux x64上使用, pwntools 4.15.0 后面.`REA_PWNTOOLS_PYTHON`在这个Mac上,它没有.`address_to_file_offset`需要一个Ghidra会话和原始文件字节的完整副本,并具有相匹配的SHA-256. `inspect_artifact`它们从未打开了对象文件中的表格.所以你自己用Python的950行写读器.`struct.unpack`测试将每一个表进行比较.`llvm-objdump`文字被捕获一次到灯具中.

```figure
elf-byte-map
```

## 文件是指表的表

系统V gABI,第4章,图4-1,绘制了一个文件的两个视图. 链接视图有ELF标题,可选的程序标题表,部分和所需的部分标题表. 执行视图包含一个ELF标题,一个要求的程序标题表,段落和一个可选的部分标题表. 盖比添加了一个句子, 统治整个读者:"只有ELF标题在文件中有固定位置. 其他结构都被另一个结构中存储的偏移发现.

并且表示"ELF不使用比特字段".`Elf64_Addr`其他`Elf64_Off`它们是8个字节,`Elf64_Half`两个是`Elf64_Word`是4,和`Elf64_Xword`根据x86-64 psABI,4.1.1节,要求`ELFCLASS64`现在`ELFDATA2LSB`现在`e_machine` `EM_X86_64`(62) 和`e_flags`0. 固定宽度的小子平均值`struct.unpack`具有一个`<`预写字符在一个电话中读取每一个记录.

它们的第64个字节`ledger-x86_64-O1.o`其他:

```text
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0100 3e00 0100 0000 0000 0000 0000 0000  ..>.............
00000020: 0000 0000 0000 0000 2804 0000 0000 0000  ........(.......
00000030: 0000 0000 4000 0000 0000 4000 0b00 0100  ....@.....@.....
```

阅读它们与GABI"ELF头条"页面相比.`e_ident`是16字节`7f 45 4c 46`系统的数据, 系统的数据, 系统的数据, 系统的数据,

那么`e_type` `0x0001`是`ET_REL`它们是可移动的.`e_machine` `0x003e`只有62.`EM_X86_64`现在,我们要去.`e_entry`是零,因为对象没有入口点. `e_phoff`是零,因为对象没有程序标题. `e_shoff`是`0x428`部分标题表的文件偏移.最后一行保留`e_ehsize` `0x40`现在`e_phentsize`零`e_phnum`零`e_shentsize` `0x40`现在`e_shnum` `0x0b`其他问题`e_shstrndx` `0x0001`现在,我们要去.

读者将这行转化为一个呼叫:

```python
fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
```

格式字符串是从左到右读到的gABI数字:两个半字,一个字,三个8字节值,一个字,六个半字节.读者拒绝一个不同于魔术,类或字节顺序的文件,并且拒绝.`e_shentsize`或`e_phentsize`错误的宽度会使每一个后来的偏移都错误,所以查询位于顶部.

## 部分标题和两个弦表

每个部分标题都是一个`Elf64_Shdr`具有64字节的字节 (gABI图4-8): `sh_name`现在`sh_type`现在`sh_flags`现在`sh_addr`现在`sh_offset`现在`sh_size`现在`sh_link`现在`sh_info`现在`sh_addralign`其他`sh_entsize`格式字符串是`<IIQQQQIIQQ`现在,我们要去.`sh_name`是对该部分的偏移`e_shstrndx`在这个对象中,`e_shstrndx`是1,并且叫该部分的`.strtab`单个表提供了分类名称和符号名称.

读者打印了 - O1 对象的11个标题:

```text
Idx Name             Type         Flags   Offset     Size       Addr Link Info Align
  0                  NULL                    0x0      0x0        0x0    0    0     0
  1 .strtab          STRTAB                0x368     0xbe        0x0    0    0     1
  2 .text            PROGBITS     AX        0x40     0x9f        0x0    0    0    16
  3 .rela.text       RELA         I        0x2a8     0x48        0x0   10    2     8
  4 .rodata          PROGBITS     A         0xe0     0x50        0x0    0    0     8
  5 .rela.rodata     RELA         I        0x2f0     0x78        0x0   10    4     8
  6 .rodata.str1.1   PROGBITS     AMS      0x130      0xa        0x0    0    0     1
  7 .comment         PROGBITS     MS       0x13a     0x2f        0x0    0    0     1
  8 .note.GNU-stack  PROGBITS              0x169      0x0        0x0    0    0     1
  9 .llvm_addrsig    LLVM_ADDRSIG E        0x368      0x0        0x0   10    0     1
 10 .symtab          SYMTAB                0x170    0x138        0x0    1    9     8
```

索引0是保留的零标题. `.text`在文件的偏移中包含159字节的代码`0x40`标题后面,有旗.`A`(记忆中分配) 和`X`(可执行). `.rodata`包含80字节的仅可读数据. `.rodata.str1.1`具有五个标签字符串`F\0D\0C\0B\0A\0`标签:`M`(可合并) 和`S`现在,我们要去看看.

`.comment`具有47字节的编译器邮票`\0Apple clang version 17.0.0 (clang-1700.6.3.2)\0`现在,我们要去.`.llvm_addrsig`具有类型`0x6fff4c03`系统特定范围内`SHT_LOOS`为了`SHT_HIOS`据了解,GABI的储备和LLVM的储备`ELF.h`它们的旗.`E`是`SHF_EXCLUDE`接连器将它放下.

其他`sh_link`其他`sh_info`列是表之间的指标. `.rela.text`没有`sh_info`两号`sh_link`10:它补丁了第2节,并从第10节取出其符号.`.symtab`没有`sh_link`1,符号名称的字符串表,以及`sh_info`9,是第一个非本地符号的指数. `sh_addr`链接器将它们分配给

两个gABI规则允许读者绘制文件的完整地图.部分"连接且不会重叠",文件"可能包含不活跃的空间".读者按偏移排序每个结构,填补漏洞:

```text
     0x0 +64    header   ELF header
    0x40 +159   section  .text
    0xdf +1     gap      inactive space
    0xe0 +80    section  .rodata
   0x130 +10    section  .rodata.str1.1
   0x13a +47    section  .comment
   0x169 +7     gap      inactive space
   0x170 +312   section  .symtab
   0x2a8 +72    section  .rela.text
   0x2f0 +120   section  .rela.rodata
   0x368 +190   section  .strtab
   0x426 +2     gap      inactive space
   0x428 +704   table    section header table
```

它们的三个空白总共10字节,每个字节都是对齐.`.rodata`没有`sh_addralign`8,所以它从`0xe0`而不是`0xdf`现在,我们要去.`.symtab`没有使用的7字节.`.comment`部分标题表本身与8相一致.

类型的部分`SHT_NOBITS`没有任何字节,所以地图会跳过它们.`.bss`在一个链接的程序中,有,一个信任的读者`sh_size`文件是没有的.

## 标志:结合,类型,部分,值,大小

`Elf64_Sym`是24字节 (gABI图4-18): `st_name`现在`st_info`现在`st_other`现在`st_shndx`现在`st_value`现在`st_size`格式`<IBBHQQ`现在,我们要去.`st_info`包装两个字段:上方四位的绑定和下方四位的类型.`STB_LOCAL`零`STB_GLOBAL`其他`STB_WEAK`2,以及类型`STT_NOTYPE`零`STT_OBJECT`其他`STT_FUNC`两,`STT_SECTION`其他`STT_FILE`低的两个比特`st_other`保持可见性`STV_DEFAULT`在这里,全是零.

```text
Idx            Value   Size Bind   Type    Section          Name
  0              0x0      0 LOCAL  NOTYPE  *UND*
  1              0x0      0 LOCAL  FILE    *ABS*            ledger.c
  2              0x0     20 LOCAL  OBJECT  .rodata          labels.rel
  3              0x0      0 LOCAL  SECTION .rodata          .rodata
  4              0x2      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.1
  5              0x4      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.2
  6              0x6      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.3
  7              0x8      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.4
  8              0x0      0 LOCAL  SECTION .rodata.str1.1   .rodata.str1.1
  9              0x0     16 GLOBAL FUNC    .text            percent_change
 10             0x10     46 GLOBAL FUNC    .text            grade
 11             0x40     31 GLOBAL FUNC    .text            total
 12             0x60     63 GLOBAL FUNC    .text            grade_label
```

索引0是保留的未定义符号. `st_shndx`标志定义的部分,有三个保留值: `SHN_UNDEF`零`SHN_ABS` `0xfff1`文件名称,以及`SHN_COMMON` `0xfff2`部分符号有空名,所以`llvm-objdump`根据gABI规则, "所有具有STB_LOCAL绑定符号的符号都先于弱和全球符号"的第九行,`.symtab`记录在9年`sh_info`由于这个原因.

在可移动的物体中`st_value`是符号部分内的一种偏移,因为`sh_addr`函数的文件偏移是`sh_offset + st_value - sh_addr`它们的长度是`st_size`其他:

```python
section = elf.sections[symbol.st_shndx]
file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
code = elf.data[file_offset : file_offset + symbol.st_size]
```

为了`percent_change`这就是`0x40 + 0`并且16个字节是`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`尺寸和开头一样重要.`grade`结束在`.text`抵消`0x3e`两个字节`66 90`后者是`nop`编译器添加了这样的`total`开始于`0x40`它们不属于任何符号. 第33课使用`st_size`课程36在比较重建之前,掩盖了它们.

## 移动:零字节意味着什么

`Elf64_Rela`是24字节 (gABI图4-23): `r_offset`现在`r_info`签署的`r_addend`格式`<QQq`子就分开了`r_info`具有两个宏:`ELF64_R_SYM(i)`是`i >> 32`其他`ELF64_R_TYPE(i)`是`i & 0xffffffff`在可转移的文件中`r_offset`是表中命名的部分内的一种偏移`sh_info`类型名称和公式来自x86-64 psABI,表4.9.`S`是符号值,`A`附加条`P`修补的地点,`L`关于""的报道.`R_X86_64_64`是`S + A`现在`R_X86_64_PC32`是`S + A - P`其他`R_X86_64_PLT32`是`L + A - P`现在,我们要去.

子的 - O1 对象有8个记录:

```text
  .rela.text       0x36 R_X86_64_PC32          .rodata+0x10
  .rela.text       0x84 R_X86_64_PC32          .rodata+0x24
  .rela.text       0x93 R_X86_64_PC32          .rodata-0x4
  .rela.rodata      0x0 R_X86_64_PC32          .rodata.str1.1
  .rela.rodata      0x4 R_X86_64_PC32          .L.str.1+0x4
  .rela.rodata      0x8 R_X86_64_PC32          .L.str.2+0x8
  .rela.rodata      0xc R_X86_64_PC32          .L.str.3+0xc
  .rela.rodata     0x10 R_X86_64_PC32          .L.str.4+0x10
```

拆掉第一张.`0x36`躺在里面`grade`它们的范围`0x10`为了`0x3e`关于 如何使用`0x33`是`48 8d 0d 00 00 00 00`其他`lea`它们的四字节移动率为`0x36`处理器将移动添加到下一个指令的地址,`0x3a`现在,我们要去.

编译器希望结果是`.rodata + 0x14`,其中一个5个入口表的32位值`1, 2, 3, 4, 4`存储值必须是`(.rodata + 0x14) - 0x3a`公式`S + A - P`随着`P = 0x36`给出`.rodata + A - 0x36`设置两个等数`A = 0x14 - 4 = 0x10`添加符包含了目标偏移减去移动和命令结束之间的四个字节.

语编译了这个表格`switch`在`grade`在 -O1 代码计算`score / 10`乘以 `0x66666667`并且两个转移,减6与4相比,并索引表. -O1 ELF对象没有表的符号.参考是节点符号`.rodata`另外一个添加,只有同一个源的 arm64 构建命名它`l_switch.table.grade`第二个记录,在`0x84`在`grade_label`,在第一个8字节值的第二表中点`.rodata + 0x28`第三个,在`0x93`其他地方`.rodata + 0x0`开始的`labels.rel`现在,我们要去.

五个`.rela.rodata`记录填写`labels.rel`每个入口都在抵消`4i`并且得到了补充.`4i`现在,`S + A - P`减去表的底部. `grade_label`阅读一个条目`movslq`首先,将表的标志命名为"节点"`.rodata.str1.1`随附加0因为字符串`F`其他部分的名称`.L.str.1`为了`.L.str.4`编译器的本地标签`D`现在`C`现在`B`其他`A`现在,我们要去.

读者可以在没有拆卸器的情况下显示区别:

| Build | Where `labels` lives | How `grade` selects | How `grade_label` reaches `grade` |
|---|---|---|---|
| -O0 | `.data`, five 8-byte pointers, five `R_X86_64_64` records | A jump table in `.rodata`: five `R_X86_64_PC32` records pointing into `.text` | A call with `R_X86_64_PLT32 grade-0x4` |
| -O1 | `.rodata` as `labels.rel`, five 32-bit relative entries | A value table at `.rodata+0x14`, one `R_X86_64_PC32` | Inlined, no call |
| -O2 | Same as -O1 | Same as -O1 | Inlined, `total` grows to 140 bytes |

在 - 0 时`switch`五个进口指向回来.`.text`在`+0x91`现在`+0x8c`现在`+0x87`现在`+0x82`其他`+0x86`电话给`grade`带着相同的东西`-0x4`由于同样的原因,`lea`在 -O1 中,优化器看到每个案例都返回一个常数,并用结果表替换跳跃. 第33课解了两个形状.

## 节目标题:载体的观点

转移的对象没有程序头,所以`e_phnum`执行式或共享对象拥有它们,而加载器没有读到其他内容.`Elf64_Phdr`是56字节 (gABI图5-1): `p_type`现在`p_flags`现在`p_offset`现在`p_vaddr`现在`p_paddr`现在`p_filesz`现在`p_memsz`现在`p_align`格式`<IIQQQQQQ`博会设定了三个规则`PT_LOAD`它们在升级中出现.`p_vaddr`命令,以及一个`p_memsz`超过`p_filesz`没有填充.`p_vaddr`是与 相一致的`p_offset`模块`p_align`现在,我们要去.

在这条轨道上,每个目标都是你构建的程序,`ledger.o`所以,这个装置`tiny-x86_64`来自`code/fixtures/build_tiny_elf.py`字母为736字节.`struct.pack`文件包含一个ELF标题,两个程序标题,一个36字节`_start`只有3字节.`.rodata`标志表和六个部分标题.`_start`写道`ok\n`在 Linux 上,它运行在 x86-64 上.这里是程序标题路径的固定.

```text
Program headers:
  PT_LOAD          r-x offset=0x0 vaddr=0x400000 filesz=0x2e0 memsz=0x2e0 align=0x1000
  PT_GNU_STACK     rw- offset=0x0 vaddr=0x0 filesz=0x0 memsz=0x0 align=0x10

entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

单身的`PT_LOAD`查看整个736字节文件的图`0x400000`读者通过找到 `PT_LOAD`包含它和计算`p_offset + (address - p_vaddr)`对于进入点,这是`0 + (0x4000b0 - 0x400000) = 0xb0`开始的`.text`现在,我们要去.

这就是REA的计算.`address_to_file_offset`对于一个Ghidra目标,该工具会返回`{address, file_offset}`霍普尔的供应商也回来了`provider_file_offset`其他`image_base_file_offset`工具需要文件的完整原始副本,该副本的SHA-256必须与目标匹配.`inspect_binary_layout`添加一个行,保持:"链接地址不是运行时间地址".一个位置独立的可执行负载在内核选择的基础,文件的偏移是唯一稳定的坐标.

程序标题还解释了为什么一个被剥离的执行式仍然运行. 链接器可以完全删除部分标题表,`e_shoff`工具在行走的部分,然后看不到任何东西.

## 马赫-奥的想法相同

果没有发布Mach-O的散文规格.XNU源头的标题是规格: `EXTERNAL_HEADERS/mach-o/loader.h`现在`nlist.h`其他`reloc.h`连接器`ledger-arm64-O1.o`现在,我们都在做什么?`ledger.c`采用`clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c`现在,我们要去.

`mach_header_64`是32字节: `magic`现在`cputype`现在`cpusubtype`现在`filetype`现在`ncmds`现在`sizeofcmds`现在`flags`现在`reserved`魔术就是`0xfeedfacf`现在`MH_MAGIC_64`现在,我们要去.`cputype`是`0x0100000c`现在`CPU_TYPE_ARM64`现在,我们要去.`filetype`是 1, `MH_OBJECT`现在,我们要去.`ncmds`是5和`sizeofcmds`是 616:负载命令在标题之后占据了 616 字节,每个字节都从 开始.`{cmd, cmdsize}`旗`0x2000`是`MH_SUBSECTIONS_VIA_SYMBOLS`现在,我们要去.

```text
Load commands:
  0 LC_SEGMENT_64                cmdsize=472 at 0x20
  1 LC_BUILD_VERSION             cmdsize=24 at 0x1f8
  2 LC_LINKER_OPTIMIZATION_HINT  cmdsize=16 at 0x210
  3 LC_SYMTAB                    cmdsize=24 at 0x220
  4 LC_DYSYMTAB                  cmdsize=80 at 0x238
```

`LC_SEGMENT_64`对于两个ELF表的Mach-O答案.`segment_command_64`没有`segname`现在`vmaddr`现在`vmsize`现在`fileoff`现在`filesize`现在`maxprot`现在`initprot`现在`nsects`其他`flags`然后`nsects`类型记录`section_64`按相同的命令执行.`loader.h`评论`MH_OBJECT`据说这些部分"在一个无名的段落中,没有段落填充".`fileoff`其他国家`filesize`456个,还有五个部分.

```text
  Idx Section                    Addr   Size Offset Reloff Nreloc Type
    1 __TEXT,__text               0x0   0xd0    648   1104      6 S_REGULAR
    2 __DATA,__const             0xd0   0x28    856   1152      5 S_REGULAR
    3 __TEXT,__cstring           0xf8    0xa    896      0      0 S_CSTRING_LITERALS
    4 __TEXT,__const            0x108   0x40    912      0      0 S_REGULAR
    5 __LD,__compact_unwind     0x148   0x80    976   1192      4 S_REGULAR
```

每个部分都以其母分类为名称.`segname`两个部分叫做`__const`它们是不同的,因为它们是`__DATA,__const`另一个`__TEXT,__const`移动是每节分`reloff`其他`nreloc`其他类型的子`.rela.X`目标的部分.

每个`relocation_info`字符号是8字节.`r_address`接下来是32位的字段,`r_symbolnum`其他类型`r_pcrel`其他`r_length`其他`r_extern`其他`r_type`(4) 六个`__text`记录是三个对的`ARM64_RELOC_PAGE21`其他`ARM64_RELOC_PAGEOFF12`根据每张表的参考,每张表的参考一对.`adrp`另外`add`能做什么?`lea`需要两个记录.`__DATA,__const`记录是`ARM64_RELOC_UNSIGNED`随着`r_length`它们每一个都会补丁一个8字节的绝对指针.

在O1下,手臂64的构建保持.`labels`作为简单的指针, x86-64构建构建了相对表.

`LC_SYMTAB`没有任何其他方法.`symoff`其他国家`nsyms`其他地方`stroff`现在,我们要去做什么?`strsize`文件大小为1688,每个文件大小是168`nlist_64`是16字节: `n_strx`现在`n_type`现在`n_sect`现在`n_desc`现在`n_value`现在,我们要去.`n_type`只是一个小领域.`N_TYPE`子`0x0e`) 等于`N_SECT`(`0xe`) 定义在该节中,其1基定数是`n_sect`现在,我们要去.`N_EXT`(`0x01`) 标志着外部符号.

`nlist_64`没有任何尺寸的字段.`_percent_change`读者在同一部分中取下一个符号地址,`_grade`在`0x18`标志C具有领先的标志`_`现在,这个函数是`_percent_change`现在,我们要去.

`LC_DYSYMTAB`(0xb) 记录与ELF相同的本地第一规则`sh_info`其他`ilocalsym`零`nlocalsym`其他地方`iextdefsym`其他地方`nextdefsym`其他地方`LC_BUILD_VERSION`(0x32) 记录`platform`其他技术`minos`其他`sdk`包装的样子`XXXX.YY.ZZ`整数.这命令是为什么 arm64 装置被提交为字节. 建立在 Mac 上使用另一个 SDK 生成不同的文件.

读者的`compare_formats`两份文件的位置:

| Idea | ELF, `ledger-x86_64-O1.o` | Mach-O, `ledger-arm64-O1.o` |
|---|---|---|
| File identity | `e_ident` `7f 45 4c 46`, class 64, data LSB | `magic` `0xfeedfacf` |
| Machine | `e_machine` 62, `EM_X86_64` | `cputype` `0x100000c`, `CPU_TYPE_ARM64` |
| File kind | `e_type` 1, `ET_REL` | `filetype` 1, `MH_OBJECT` |
| Where the tables are | `e_shoff` `0x428`, 11 section headers | 5 load commands, 616 bytes after the header |
| The code | `.text` at `0x40`, size `0x9f`, flags `AX` | `__TEXT,__text` at 648, size `0xd0`, in the unnamed segment |
| Symbol names | `.symtab` (section 10), names in `.strtab` through `sh_link` 1 | `LC_SYMTAB` `symoff` 1240, `nsyms` 17, names at `stroff` 1512 |
| Symbol size | `st_size`: `percent_change` is 16 bytes | No field: next symbol minus this one, 24 bytes |
| Relocations | `.rela.text`, 3 records, `R_X86_64_PC32` | `__text` `reloff` 1104, 6 records, `PAGE21` and `PAGEOFF12` |
| Function bytes | `percent_change`: 16 bytes at `0x40` | `_percent_change`: 24 bytes at `0x288` |

实际上,Mach-O 通过`inspect_macho`通过`otool -h -l`现在`nm -gjU`现在`dyld_info -imports -exports`其他`dwarfdump --uuid`通过`xcrun`你的读者不需要任何东西,而且它都读不到.`symoff`其他`stroff`这`otool -l`印记.`open_binary`通过魔术字节检测到ELF,MZ,PE和薄或通用Mach-O.`e_machine`对于一个没有标题的文件,你给了`format: raw-binary`德拉提供商拒绝了通用二进制,并要求一个薄片.`0xcafebabe`现在,我们要去.

## 建立它

运行标准图书馆阅读器:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
```

演示内容是`ledger-x86_64-O1.o`然后打印了其标题,部分,符号,移动和文件偏移地图.`ledger-arm64-O1.o`图表的标题是" 图表"的标题.`tiny-x86_64`预期的行:

```text
percent_change: 16 bytes at file offset 0x40: 85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3
grade: 46 bytes at file offset 0x50: 48 63 c7 48 69 c0 67 66 66 66 ...
entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

通过一个读取文件的路径: `python3 code/main.py code/fixtures/ledger-x86_64-O0.o`读者从前4个字节中选择ELF或Mach-O.

阅读`code/main.py`在此顺序:

1. `ElfFile._read_header()`检查了魔术,类别,字节顺序,输入尺寸,然后打开头标.
2. `ElfFile._read_sections()`其他`read_cstring()`阅读部分标题表,并通过 解决名称`e_shstrndx`现在,我们要去.
3. `ElfFile._read_symbols()`分裂`st_info`通过`sh_link`保持保留的部分索引可读.
4. `ElfFile._read_relocations()`走着每一个`SHT_RELA`部分,分开`r_info`根据4.9表的名称类型.
5. `ElfFile.function_span()`其他`function_bytes()`将一个符号变成一个文件范围,并将其中的字节.
6. `ElfFile.file_offset_map()`排序每个结构按偏移,填补不动空间.
7. `ElfFile._read_program_headers()`其他`address_to_file_offset()`处理执行器.
8. `MachOFile`读取标题,载荷命令,`LC_SEGMENT_64`它们的部分,`LC_SYMTAB`现在`LC_BUILD_VERSION`其他地方的地区.
9. `compare_formats()`两个文件中都会有相同的名称,每个文件中都会有相同的值.

## 用它

导入后课中的读者`from main import ElfFile`在这个课程的补充之后`code`文件目录`sys.path`第33课要求我们做.`function_bytes`其他`relocations_for(".text")`课35记录其输出作为观察证据.课36要求它在比较字节之前掩盖移动抵消.

编译自己的C成一个用相同的对象`clang -target x86_64-unknown-linux-gnu -c`命令并运行读者.只需在 x86-64 psABI 表 4.9 列出时添加一个移动名称.只需在 gABI 或生产工具链记录时添加一个部分类型.当读者遇到一个没有名称的值时,它会以六分之一打印数字,而不是猜测.

## 互动实验室

### 实验室A:手动进行头条

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code
python3 -q
```

运行:

```python
import struct
from main import ElfFile, FIXTURES
data = (FIXTURES / "ledger-x86_64-O1.o").read_bytes()
data[:4], data[4], data[5]
struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
elf = ElfFile(data)
elf.header.e_shoff, elf.header.e_shnum, elf.sections[elf.header.e_shstrndx].name
```

轮显示`e_type`其他`e_machine`其他`e_shoff`现在,我们要做什么?`0x428`最后一行显示第1节,`.strtab`现在,我们要把这些部分命名.

### 实验室B:开关背后的值表

```python
rodata = elf.section_bytes(elf.section(".rodata"))
[int.from_bytes(rodata[i : i + 4], "little") for i in range(0x14, 0x28, 4)]
[int.from_bytes(rodata[i : i + 8], "little") for i in range(0x28, 0x50, 8)]
[r for r in elf.relocations_for(".text") if r.symbol == ".rodata"]
```

两个表都读到了`1, 2, 3, 4, 4`检查它们的情况`ledger.c`其他`grade(65)`计算器`65 / 10 - 6 = 0`值为 1 个值.`case 6`现在,我们要去.`grade(100)`值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4, 值为 4,`case 10`其他`case 9`现在,我们要去.

### 实验室C:一个源的三个构建

```python
for level in ("O0", "O1", "O2"):
    obj = ElfFile.from_path(FIXTURES / f"ledger-x86_64-{level}.o")
    print(level, [s.name for s in obj.sections if s.name in (".data", ".rodata")])
    print(level, sorted({r.type_name for r in obj.relocations}))
    print(level, {s.name: s.st_size for s in obj.symbols if s.type == "FUNC"})
```

 - 0 对象有一个`.data`部分和三种转移类型.`.data`它们是一个类型.`total`在 -O0 位是66字节,在 -O1位是31字节,在 -O2位是140字节.

### 实验室D:在Mach-O中相同的函数

```python
from main import MachOFile
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
[(c.name, c.cmdsize) for c in macho.load_commands]
macho.function_span("_percent_change")
macho.function_bytes("_percent_change")[:4].hex()
```

文件的时间范围为24字节,在文件的抵消 648.`a0000034`简单的教训形式`0x340000a0`哪个`llvm-objdump -d`图像`cbz w0, 0x14`这就是`before == 0`检查器,同样测试的X86-64构建编码为`85 ff 74 09`现在,我们要去.

## 实践实验室

在Linux x86-64机器上,建立`clang -O1 -shared -fPIC code/fixtures/ledger.c -o libledger.so`其他`clang -O1 code/fixtures/ledger.c -o ledger_main`具有一个`main`您将添加,然后将读者运行到两个.

要求:

- 阅读`.dynsym`,,,,,,,,,,,,,,,,,,,`Elf64_Sym`由于`SHT_DYNSYM`现在的记录是不变的.
- 阅读`.dynamic`作为`Elf64_Dyn`记录`d_tag`其他`d_val`姓名`DT_NEEDED`现在`DT_STRTAB`现在`DT_SYMTAB`现在`DT_RELA`其他`DT_JMPREL`在gABI"动态部分"页面上.
- 列出未定义的符号`st_shndx` `SHN_UNDEF`作为进口和`R_X86_64_JUMP_SLOT`记录`.rela.plt`作为他们接到的通话站点.
- 绘制每一个图`PT_LOAD`按gABI规则将该段子分为包含的部分,即"对象文件段包含一个或多个部分".
- 试试`address_to_file_offset`对于每个定义函数的字节,`function_bytes`返回了.
- 捕获`llvm-objdump -h -t -r -p`其他`llvm-objdump -T`两个文件的文本`code/fixtures/`让读者与读者相比,

成功意味着进口列表,细节地图和每个函数范围都与捕获的工具输出一致,在测试期间没有工具运行.

## 排名实验室

找到你构建的代码,然后写在`code/lab_answers.json`写数字作为数字或六字符串,例如`"0x40"`它们是JSON列表.

1. `t1`作为一个数字,以本书x86_64-O1.o的 e_shoff.
2. `t2`: 百分比变化在本书中-x86_64-O1.o.
3. `t3`: 在本书-x86_64-O1.o 中 .text的文件转移,作为 hex.
4. `t4`:在本书x86_64-O0.o中重新迁移类型名称,分类,作为列表.
5. `t5`:在本书-x86_64-O1.o中,作为列表.

检查你的答案:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/lab.py
npx tsx code/lab.ts
```

检查器从 计算出每一个预期值`code/main.py`它们在已完成的设备上.`PASS`现在`FAIL`或`TODO`只有五个任务都通过时,它才会出于0.`python3 code/lab.py my-answers.json`检查另一个文件.`code/tests/test_lab.py`证明检查员接受正确的答案,却拒绝错误的答案.

### 看它运行

其他[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)机器将这个课程运行作为其前两个站点. 卷轴读取包含的对象文件的标题.`percent_change`开放了柜子`.text`切换符号,看图表中包含哪些事实.

## 教训艺术品

这一课产生了`outputs/skill-program-anatomy-elf-from-scratch.md`通过使用CLAUD,Cursor,Codex,OpenClaw,Hermes或任何读SKILL.md的代理.该技能将用户构建的编译对象或可执行的执行器变成布局报告.报告显示每个结构,符号和迁移的文件范围,与捕获的工具输出进行检查.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

套房证明:

- 每个部分的索引,名称,大小,地址和类型都匹配捕获的内容.`llvm-objdump -h`对于三个x86-64对象和小的执行器的文本
- 每个符号值,绑定,类型,部分,大小和名称都匹配捕获的符号.`llvm-objdump -t`文本
- 每个移动的偏移,类型名称,符号和添加符都匹配捕获的`llvm-objdump -r`文本,包括`R_X86_64_PLT32`其他`R_X86_64_64`在 -O0
- 两位项目负责人`tiny-x86_64`匹配被俘的`llvm-objdump -p`它们没有任何文本,
- `percent_change`是16字节的文件偏移`0x40`并且每个函数都在内`.text`
- 文件偏移地图一次覆盖每个固定的每字节,在 -O1 对象的三个排列空白位置
- 进入点`tiny-x86_64`文件的地图`0xb0`通过`PT_LOAD`转移可的对象拒绝地址映射
- 马赫-奥头,每个载荷命令,部分,五个部分,`LC_SYMTAB`其他`LC_BUILD_VERSION`匹配被俘的`--private-headers`文本
- 马赫-奥的符号和15个搬迁与被捕者相匹配`llvm-objdump`文本,以及`_percent_change`是24字节在偏移 648
- 错误的魔力,一个32位类,一个大数据文件,一个缩小表,一个通用二进制,`FormatError`
- `build_tiny_elf.py`复制了所承诺的`tiny-x86_64`字节对字节
- 图形模块`site/figures-re-32.js`包含了 字节的确切字节.`ledger-x86_64-O1.o`

## 生产失败模式

| Failure | What the weak reading reports | What the reader must prove |
|---|---|---|
| `st_value` used as a file offset | "`percent_change` is at 0" | Offset is `sh_offset + st_value - sh_addr`, here `0x40` |
| Padding counted as code | "`grade` is 48 bytes" | `st_size` is 46 and the `66 90` after it belongs to no symbol |
| Section names read from the wrong table | Garbage names or an exception | `e_shstrndx` names the table, here section 1 |
| `sh_size` trusted for `SHT_NOBITS` | A read past the end of the file | `.bss` has no file bytes and the map skips it |
| Zero bytes read as the operand | "`lea 0(%rip)`" | The `.rela.text` record at `0x36` names `.rodata+0x10` |
| Addend read as the target offset | "the table starts at `0x10`" | `S + A - P` with the instruction end gives `0x14` |
| Sections walked on a stripped executable | "the file has no code" | `PT_LOAD` maps every address the loader uses |
| A linked address treated as a runtime address | A wrong offset under a random base | The file offset from `PT_LOAD` is the stable coordinate |
| A Mach-O section looked up by `sectname` alone | Two `__const` sections collapse into one | `segname,sectname` is the name |
| A size field expected in `nlist_64` | An exception or zero bytes | The next symbol in the same section ends the function |
| A universal binary read as one Mach-O | "magic `0xcafebabe` is unknown" | Refuse it and ask for a thinned slice |
| The arm64 object rebuilt on another Mac | "the fixture changed" | `LC_BUILD_VERSION` records the SDK, so the committed bytes are the fixture |

## 运营规则

阅读您可以信任的标题,跟随其包含的偏移,并从定义的规范中命名每个字段. 保持您比较的工具输出为承诺的固定,因此比较没有工具运行. 当值在规范中没有名称时,打印数字.您可以检查字节字节的读者是每次课程都建立在于它.

## 进一步阅读

- [System V gABI, chapter 4: Object Files](https://www.sco.com/developers/gabi/latest/ch4.intro.html)其他[ELF Header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html)现在[Sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html)现在[Symbol Table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html)其他[Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)页面
- [System V gABI, chapter 5: Program Header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html)其他[Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V ABI, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)转移类型
- [Apple XNU `loader.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)现在[`nlist.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)其他[`reloc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/reloc.h)
- [17 U.S.C. 1201](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section1201&num=0&edition=prelim)其他[Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng)
- [Sega v. Accolade, 977 F.2d 1510](https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html)其他[Sony v. Connectix, 203 F.3d 596](https://law.resource.org/pub/us/case/reporter/F3/203/203.F3d.596.99-15852.html)
- [rea 6.5.0 `docs/binary-diagnostics.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/binary-diagnostics.md)其他[`docs/ghidra-provider.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
