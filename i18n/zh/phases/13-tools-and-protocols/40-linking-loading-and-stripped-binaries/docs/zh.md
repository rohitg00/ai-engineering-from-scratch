# 链接,加载和剥离二进制:PLT,GOT,进口,修复和函数识别

> 链接程序在三个格式中调用没有包含的函数.本课程阅读了链接编辑器为这些调用所编写的表格,然后在一个调用后,将其填充机的插槽填写,并在名称消失后找到构建的函数.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and arm64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow), 38 (calling conventions)
**Time:** ~160 minutes

## 学习目标

- 根据转移记录和符号表,确定链接编辑器将它用于什么:固定距离,一个带有GOT插槽的PLT输入或动态转移.
- 阅读位置独立的ELF执行器的动态部分,PLT和GOT,并使用psABI公式通过它们进行一次通话.
- 阅读COFF对象 (20字节文件标题,40字节节目录,18字节符号,10字节移动) 和PE32+图像的进口,出口和基部移动目录.
- 单词复制链接,并对应每一个词.`dyld_info`现在,我们要去.
- 说明什么`strip`运行删除的程序,证明它仍然有效.
- 恢复一个脱的 arm64 构建的功能启动`LC_FUNCTION_STARTS`按前标扫描和呼叫目标,对每种方法进行分数,以对未删减双胞胎的符号表进行分数,并用FLIRT形状的签名命名函数.

## 问题

你联系了`main.c`反对`libledger.dylib`问一个代理人,哪些功能.`main`电话`0x1000005a0`经理拆除了指令,并读到`bl 0x100000694`这个地址包含12个字节:`adrp x16`现在`ldr x16, [x16, #0x38]`现在`br x16`经理跟踪了货物到`0x100004038`读取8个字节`00 00 00 00 00 00 10 80`通过一个腐败的指针进入内核空间.

然后你剥夺了同一程序的静态构建,问它有多少功能.`nm`看到一个名字,`__mh_execute_header`答了一个问题.

两个答案都读到文件,就像是运行过程.`0x100004038`字符第63节说绑定,12位说下一个绑定是哪里,低位说哪个进口绑定.`_puts`在之前`main`删除的文件失去了符号表,并保留了`LC_FUNCTION_STARTS`列出了所有五个函数,开始于9个字节.

这一课程建立了五个读物标准图书馆Python.一个对我们自己的对象的COFF读物和对进口,出口和基部迁移目录的PE32+读物.一个对载荷命令,片,间接符号表,链接的修复链,以及出口试验的Mach-O读物,对应单词检查.`dyld_info`动态部分,PLT和GOT的ELF读器,加上一个规划器,说明我们对象的PIE链接会产生什么.一个四种方法和每个方法的分数的剥离构建函数寻找器.一个FLIRT的形状的签名构建器,具有野生卡特移动字节和尾巴的CRC16.

机器上只有Mach-O链接. 机器64执行式和Dlib被连接,脱掉,运行.`clang -target`由于没有安装ELF或PE链接编辑器,因此这些格式中的两个链接的图像是从固定文件中的两个Python脚本的规格中字节字节字节写的. `llvm-objdump`图书馆调查也读到了.

```figure
re-40-call-through-three-formats
```

## 链接编辑器在搬迁时做什么

第32课阅读迁移记录,第33课应用`S + A - P``lea`一个记录给了一个地方命名`P`标志`S`其他`A`根据 x86-64 psABI表 4.9 每种类型的配方为一个,`L`对于符号的PLT输入位置,`G`对于他的恩赐.`GOT`对于GOT地址,`B`图像的负载基.三个结果覆盖我们的物体.

链接编辑器将值输入到该字段中,记录就消失了. `R_X86_64_PC32`对于输入中定义的符号,这是这样的情况. 图像中的两个字节之间的距离永远不会改变,无论载荷地址如何.

链接编辑器将一个PLT输入和一个GOT插槽. `R_X86_64_PLT32`现在,我们可以在一个未定义函数上进行攻击.`L + A - P`进入的距离,进入的距离跳过槽.`R_X86_64_JUMP_SLOT`记录在`.rela.plt`指示动态链接器填补空隙.

链接编辑器将转移存储为加载器. `R_X86_64_64`位置独立的执行式将在加载之前不知道其地址.`R_X86_64_RELATIVE`配方`B + A`在`.rela.dyn`现在,我们要去.

`main-x86_64-O1.o`拥有18个记录:14个`.text`两分钟`.data.rel.ro`两次`.rodata`现在,我们要去.`plan_dynamic_link()`在`code/main.py`它们应与`ledger-x86_64-O1.o`其他:

| Record | Count | Decision | Why |
|---|---|---|---|
| `R_X86_64_PC32` to `.rodata`, `.L.str`, `fns`, the table in `.rodata` | 16 | in place | the symbol is defined in the inputs |
| `R_X86_64_PLT32` to `percent_change`, `grade`, `total`, `grade_label` | 4 | direct, no PLT | defined in `ledger-x86_64-O1.o`, so the link editor reduces PLT32 to PC32 |
| `R_X86_64_PLT32` to `puts` twice and `printf` twice | 4 | PLT entry and GOT slot | undefined, provided by a shared library |
| `R_X86_64_64` to `grade` in `fns[]` | 2 | `R_X86_64_RELATIVE` | an absolute field in a PIE |

两种进口给出了一个`.plt`具有48字节 (PLT0加上16的两个输入),`.got.plt` 40 字节 (三个保留的插槽加上两个),`.rela.plt`两个相对记录显示一个`.rela.dyn`它们来自我们记录的规格.`tiny-dyn-x86_64`实施本计划的PLT部分,用于相同的两种进口,其尺寸与计划相匹配.

编译器写了`PLT32`在每次通话中,无论是定义或未定义,自2.31 (H.J. Lu, 2018-02-13) 和LLVM 7.0.0 (D43383, 2018-02-20) 后,链接编辑决定.`PLT32`在一个对象中,因此说"一个呼叫",并没有说 PLT 输入是否会存在.在其他构建中出现了两个类型. `R_X86_64_GOTPCRELX`其他`R_X86_64_REX_GOTPCRELX`(`G + GOT + A - P`) 要求没有PLT的 GOT插槽,`-fno-plt`链接编辑可以放松到直接的`lea`或`call`如果符号是本地 (psABI附件B). `R_X86_64_32`其他`R_X86_64_32S`没有任何类型发生在我们的两个物体中.

## 动态部门,PLT和GOT

根据GABI第5章,参与动态链接的可执行器具有一个`PT_INTERP`程序标题,必须先于任何可加载的段子,`PT_DYNAMIC`其他国家`.dynamic`部分是数组的`Elf64_Dyn`双,签名标签和值,结束于 `DT_NULL`现在,我们要去.

`tiny-dyn-x86_64`是由 编写的 5,184 字节`build_tiny_dyn_elf.py`它们的动态部分包含12个对.`0x1000`其他:

| Tag | Number | Value | Meaning |
|---|---|---|---|
| `DT_NEEDED` | 1 | `libc.so.6` | a string table offset, `0xb`, the library to load |
| `DT_HASH` | 4 | `0x1a0` | the SysV hash table |
| `DT_STRTAB` | 5 | `0x188` | `.dynstr` |
| `DT_SYMTAB` | 6 | `0x140` | `.dynsym`, 24 bytes per entry |
| `DT_STRSZ` | 10 | `0x15` | 21 bytes of strings |
| `DT_SYMENT` | 11 | `0x18` | 24 |
| `DT_PLTGOT` | 3 | `0x10c0` | `.got.plt` |
| `DT_PLTRELSZ` | 2 | `0x30` | two 24-byte records |
| `DT_PLTREL` | 20 | 7 | the records are `DT_RELA` |
| `DT_JMPREL` | 23 | `0x1b8` | `.rela.plt` |
| `DT_FLAGS_1` | `0x6ffffffb` | `0x08000000` | `DF_1_PIE`, a GNU tag |
| `DT_NULL` | 0 | 0 | end |

士说为什么`DT_JMPREL`区分这些区分输入使动态链接器在进程初始化时忽略它们,如果惰的绑定是启用的.`DF_BIND_NOW`在`DT_FLAGS`现在`DF_1_NOW`在`DT_FLAGS_1`其他`LD_BIND_NOW`在环境中,惰的绑定器关闭,而动态链接器在启动时处理它们.

### 子和子的条目

在图 5.2 中,psaBI 5.2 节目给出了两个形状.

```text
     1f0: ff 35 d2 0e 00 00    pushq  0xed2(%rip)      # 0x10c8 = GOT+8
     1f6: ff 25 d4 0e 00 00    jmpq   *0xed4(%rip)     # 0x10d0 = GOT+16
     1fc: 0f 1f 40 00          nopl   (%rax)

     200: ff 25 d2 0e 00 00    jmpq   *0xed2(%rip)     # 0x10d8 = GOT+24, the slot for puts
     206: 68 00 00 00 00       pushq  $0x0             # index 0 into DT_JMPREL
     20b: e9 e0 ff ff ff       jmp    0x1f0            # PLT0
```

按RIP相对移动是相对于下一个指令.`0x1f6 + 0xed2 = 0x10c8`现在,`.got.plt + 8`现在,我们要去.`0x1fc + 0xed4 = 0x10d0`现在,`.got.plt + 16`现在,我们要去.`0x206 + 0xed2 = 0x10d8`现在,我们要做什么?`0x210 - 0x20 = 0x1f0`每个输入为16字节,所以输入为`exit`开始于`0x210`推进`$0x1`读到`0x10e0`现在,我们要去.

州政府保留了三个空. psABI 5.2: 零入口包含了 `_DYNAMIC`总体的偏移表中的1,2个入口也保留.`.got.plt`读书`0x1000, 0, 0, 0x206, 0x216`Glibc用其填充第一个插槽`struct link_map`两个插槽`_dl_runtime_resolve`随着文件的加载,三分钟的插槽可以保持.`0x206`在文件中,`pushq`在里面`puts@plt`按下列命令的地址.

所以第一次电话就开始了`call 0x200`现在`jmpq *0x10d8`陆地`pushq $0`现在`jmp 0x1f0`按GOT+8跳过GOT+16进入解析器,该解析器读取0的记录`DT_JMPREL`现在`R_X86_64_JUMP_SLOT puts`现在看起来`puts`进去`libc.so.6`写入了其地址`0x10d8`接下来,第二次电话就响了.`call`现在`jmpq *0x10d8`德雷珀写道:"除了第一次电话之外,所有通用费用都是"只"一个间接的跳跃.`%r11`课38中解释了一个注册表选择:它是一个"零碎注册表",因此"PLT中的代码不需要泄露任何注册表".

电话站`.text`读书`e8 d4 ff ff ff`在`0x227`其他`0x22c - 0x2c = 0x200`现在,我们要去.`llvm-objdump`印记`callq 0x200 <puts@plt>`对于它,并命名从 `.rela.plt`如何?`plt_entries()`也给它一个名字.

### 文件所没有的内容

文件没有`PT_GNU_RELRO`. 雅库布·杰林克在2004-01-06年提出了RELRO的二元件列表:仅在搬迁期间写的部分将移动到可写的部分开始,以便动态链接器可以 `mprotect`根据GNU id的默认脚本,`.init_array`现在`.fini_array`现在`.data.rel.ro`现在`.dynamic`其他`.got`只有三个保留的插槽.`.got.plt`其他插槽是惰的. 这就是部分RELRO.`-z now`组件`DF_BIND_NOW`移动整个`.got.plt`没有什么在启动后写出来.`_dl_protect_relro`电话`mprotect(start, end - start, PROT_READ)`在页面一致的范围. `-fno-plt`在编译方面,更进一步:通话通过`jmpq *name@GOTPCREL(%rip)`惰的结合是不可能的, 湾岸委员会手册说"所有外部符号都在装载时得到解决".

文件也没有版本部分.`libc.so.6`增加`.gnu.version`一个`Elfxx_Half`按`.dynsym`进入`.gnu.version_r`其他`Verneed`对于每一个图书馆`Vernaux`记录每个版本名称. `printf@GLIBC_2.2.5`方式: 输入`printf`在`.gnu.version`具有指数,`Vernaux`哪个`vna_other`相当于指数的`vna_name`根据"GLIBC_2.2.5"的标题,`Verneed`哪个`vn_file`索引0是本地,1是全球,和位15 (`VERSYM_HIDDEN`现在`0x8000`) 隐藏了链接编辑器的版本.

哈希表是一个SysV`DT_HASH`动态链接器需要24字节.`DT_HASH`或`DT_GNU_HASH`文件中没有任何输出,并且没有运行在这里,所以Glibc是否接受单桶表未经验证.

### ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,

果是什么?`.dynsym`其他`.dynstr`分配部分和`.symtab`其他`.strtab`动态链接器读取第一对,而永远不会读取第二. 缩器:"正常符号表在运行时不使用,因此不需要剥离二进制.它对性能没有影响.

广州`strip --strip-all`删除`.symtab`现在`.strtab`现在`.debug_*`其他`.comment`每个分配的部分都保持:`.interp`现在`.dynsym`现在`.dynstr`现在`.gnu.hash`现在`.gnu.version*`现在`.rela.dyn`现在`.rela.plt`现在`.plt`现在`.text`现在`.rodata`现在`.eh_frame`现在`.init_array`现在`.dynamic`现在`.got`现在`.got.plt`现在`.data`现在`.bss`部分负责人留下,除非你添加`--strip-section-headers`(二.四.四1) 或运行`llvm-strip --strip-sections`现在,我们要去.`--strip-debug`保持这些符号.`--only-keep-debug`写出了该文件`--add-gnu-debuglink`除了除的名称,`.gnu_debuglink`其他`ld --build-id`写道`.note.gnu.build-id`它们可以被调试.

## 科夫对象

`clang -target x86_64-pc-windows-msvc -O1 -fno-asynchronous-unwind-tables -c`生产`main-x86_64.obj`其他`ledger-x86_64.obj`.PE格式页面定义对象:一个20字节文件标题,没有可选标题,一个40字节条目的节目表,一个18字节记录的符号表,每个节目10字节的迁移记录.

`CoffObject`在`code/main.py`文件标题说机器`0x8664`十个部分,37个符号记录,`SizeOfOptionalHeader`0. 部分表名称`.text`现在`.data`现在`.bss`六个部分称为`.rdata`其他`/16`一个以""开始的名字`/`是对字符串表的十分数偏移,它以其自己的四字节大小开始;`/16`解决问题`.llvm_addrsig`现在,这是这个名字.`llvm-objdump -h`他们的指纹.

部分符号 (存储类3) 包含一个包含部分长度,迁移数量,检查总和和COMDAT选项.`.rdata`部分有选择2",任何",每个部分都包含一个字符串字母,以MSVC错误的名称: `??_C@_04JDDJEAHN@even?$AA@`链接编辑器保留每一个副本.最后的记录是`.file`附加"main.c"的记录.`llvm-objdump -t`打印这些为`[ 0]`现在`AUX scnlen ...`现在`[ 2]`测试将我们的索引和名称对比到该文本.

搬迁时间: 14 `IMAGE_REL_AMD64_REL32`在`.text`其他`IMAGE_REL_AMD64_ADDR64`在`.rdata`现在,我们要去.`REL32`是"移动后的字节中的32位相对地址".`R_X86_64_PC32`随着`-4`包含:ELF记录包含附加值`-4`因为记录中有一个附加字段,而COFF记录没有一个. `ledger-x86_64.obj`只有三个`REL32`在`0x36`现在`0x84`其他`0x93`让我们知道,`ledger-x86_64-O1.o`只有三个.`R_X86_64_PC32`代码相同,格式只因写四个格式而不同.`ADDR64`只有一个8字节的绝对地址,`labels`图像中的基调转移,如`R_X86_64_64`成为`R_X86_64_RELATIVE`现在,我们要去.

| | ELF `Elf64_Rela` | COFF relocation | Mach-O `relocation_info` |
|---|---|---|---|
| record size | 24 bytes | 10 bytes | 8 bytes |
| fields | offset, type and symbol in `r_info`, addend | offset, symbol index, type | address, then a 32-bit word with symbolnum:24, pcrel:1, length:2, extern:1, type:4 |
| addend | explicit | none, lives in the field | none, or an `ARM64_RELOC_ADDEND` record before the real one |
| the call to `puts` | `R_X86_64_PLT32 puts-0x4` | `IMAGE_REL_AMD64_REL32 puts` | `ARM64_RELOC_BRANCH26 _puts` |

## 欧洲经济体的形象:进口,出口和基地转移

`tiny-x86_64.exe`是由 编写的 2,560 字节`build_tiny_pe.py`它和小的ELF一样工作:`puts`其他`exit`其他`msvcrt.dll`导出一个名称,运输一个基地转移,所以这三个目录需要课程.`pefile`其他国家`llvm-objdump -p`两者都读了,两者都被捕获.

按标题进行阅读.`MZ`并且在抵消`0x3c`保持`e_lfanew`现在`0x40`在`0x40`签名`PE\0\0`然后,COFF文件标题:机器`0x8664`其他部分`SizeOfOptionalHeader`240,特征 `0x22`选项标题开始于 `Magic`领域`0x20b`意思是PE32+.`AddressOfEntryPoint`是`0x1000`现在`ImageBase`是`0x140000000`现在`SectionAlignment` `0x1000`现在`FileAlignment` `0x200`现在`SizeOfImage` `0x5000`现在`Subsystem`其他类型:`DllCharacteristics` `0x8160`解码`HIGH_ENTROPY_VA 0x0020`现在`DYNAMIC_BASE 0x0040`现在`NX_COMPAT 0x0100`其他`TERMINAL_SERVER_AWARE 0x8000`然后设置16个RVA和尺寸数据目录.`0x2080`尺寸`0x4d`进口`0x2000`尺寸`0x28`基地转移`0x4000`尺寸`0xc`   `0x2040`尺寸`0x18`现在,我们要去.

图像中的地址是RVA,是从负载基的偏移.`.text`车`0x1000`在文件中`0x200`现在`.rdata`车`0x2000`在`0x400`现在`.data`车`0x3000`在`0x600`现在`.reloc`车`0x4000`在`0x800`现在,我们要去.`PeImage.rva_to_offset()`是那个桌子.

### 进口目录

在RVA`0x2000`进口查找表是我们一个的,`0x2028`时间标签0,运送链0,名称 `0x2068`进口地址表`0x2040`.名称RVA指向"msvcrt.dll".搜索表包含以零结束的64位入口.比特63集意味着通过序列进口,序列在15到0位.比特63清晰意味着比特30到0是提示/名称输入的RVA:一个16位提示",一个索引进入出口名称指标表",然后是ASCII名称.我们的是`0x2058`子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子`0x2060`(提示0,"出口").

根据规格,IAT"与进口查找表的内容相同,直到图像被绑定".`0x2040`测试检查24字节的值`0x2028`等于24字节`0x2040`. "在绑定过程中,进口地址表中的输入被覆盖,将被进口的符号的32位 (PE32) 或64位 (PE32+) 地址. "Windows加载器在输入点运行之前这样做.没有惰的绑定和没有.代码直接进入插槽:

```text
    100b: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1011 + 0x102f = 0x2040, the IAT slot of puts
    1013: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1019 + 0x102f = 0x2048, the IAT slot of exit
```

`FF /2`两个指令具有相同的字节,因为每个字节都坐落在另一个字节后八个字节,并且读取一个字节在另一个字节后八个字节. `iat_calls()`扫描代码部分`ff 15`增加6个和移动,并将进口目录中的空隙命名.

### 出口目录

在RVA`0x2080`排列表 40 字节的出口目录表:旗,时间印,版本,一个指向"tiny-x86_64.exe"的名称RVA,序列基础 1,一个地址表入口,一个名称指标.`0x20a8`具有一个RVA,`0x1000`出口名称指标表`0x20ac`输出常规表在 `0x20b0`具有一个16位无偏见的指数,0.名称 `k`图片以地址登录`ordinals[k]`并且出口的定位是`ordinals[k] + ordinal base`规格增加了一个我们不使用的规则:一个指向出口部分的地址输入是发送器字符串,如`MYDLL.expfunc`标签表是"以词汇顺序排列,允许二进制搜索".

### 基地迁移

`.reloc`每个块开始一个页面RVA和一个块大小,然后16位输入,上面的4位是类型,下一个页面是12位.我们的一个块:页面`0x3000`尺寸12号,入口`0xa000`类型10`IMAGE_REL_BASED_DIR64`,除了0号,以及0号型入,`IMAGE_REL_BASED_ABSOLUTE`八个字节在RVA`0x3000`保持`0x1400020d0`图像文件的位置是"图像文件的位置" (图像文件的位置是"图像文件的位置"),图像的位置是"手动链接"的位置.如果载体将图像放置在其他地方,则它将差异添加到该字段.规格:"图像文件不含COFF迁移...图像包含以 .reloc部分的位置位置迁移形式的迁移信息 (除非图像具有IMAGE_FILE_RELOCS_STRIPPED属性)."`/DYNAMICBASE`在当前link.exe中默认开启,所以图像带有`.reloc`其他`DYNAMIC_BASE`现在,我们要去.

文件标题是"图像"的标题表.`PointerToSymbolTable`"因为COFF调试信息已经过时了",而这些名称存留在一个独立的PDB中.`.pdata`谁的`RUNTIME_FUNCTION`输入指分配堆或调用其他函数的每个函数的开始和结束.

## 马赫-奥图像:载荷命令,子和间接符号表

`ledger_main`是链接的 arm64 执行式.`otool -h`打印19个载荷命令和旗`0x00200085`现在,我们要去.`MH_NOUNDEFS 0x1`现在`MH_DYLDLINK 0x4`现在`MH_TWOLEVEL 0x80`其他`MH_PIE 0x200000`总和到这个值.`LC_SEGMENT_64`(`__PAGEZERO`现在`__TEXT`现在`__DATA_CONST`现在`__LINKEDIT`),两`LC_LOAD_DYLIB`(`@rpath/libledger.dylib`然后`/usr/lib/libSystem.B.dylib`),以及每一个`LC_DYLD_CHAINED_FIXUPS`现在`LC_DYLD_EXPORTS_TRIE`现在`LC_SYMTAB`现在`LC_DYSYMTAB`现在`LC_LOAD_DYLINKER`现在`LC_UUID`现在`LC_BUILD_VERSION`现在`LC_SOURCE_VERSION`现在`LC_MAIN`现在`LC_RPATH`现在`LC_FUNCTION_STARTS`现在`LC_DATA_IN_CODE`其他`LC_CODE_SIGNATURE`现在,我们要去.`MachoFile.command_names()`返回相同列表,按相同的顺序`otool -l`现在,我们要去.

`__TEXT`开始于`0x100000000`现在,我们要去.`__text`是 256 字节的`0x100000558`现在`main`其他任何东西都没有,因为四个账本功能都在dylib中生活.`__stubs`是 84 字节的`0x100000658`七个12字节的块.`__DATA_CONST`开始于`0x100004000`随着`__got` 64 字节, 8 个分类的指针插槽`S_NON_LAZY_SYMBOL_POINTERS`其他`__const` 32 字节,`fns[]`其他`names[]`表`main.c`现在,我们要去.

### 一个,手工

为了`_puts`现在`0x100000694`其他:

```text
    30 00 00 90    adrp x16, 0x100004000
    10 1e 40 f9    ldr  x16, [x16, #0x38]
    00 02 1f d6    br   x16
```

`0x90000030`是`adrp`现金库是低的五位,16位.`immlo`只有30到29位.`immhi`值是 `immhi << 2 | immlo = 4`目标页面是指令页面,`0x100000000`另外`0x4000`现在,我们要去.`0xf9401e10`是`ldr`没有签名的12位偏移量为8: 21 位到 10 位是 7,乘以 8 位是`0x38`现在,我们要做什么?`0x100004038`现在,我们要去.`0xd61f0200`是`br x16`据说,这就是Id64的源头.`StubAtom`现在,我们要去.

哪个名字属于插槽来自间接符号表. `LC_DYSYMTAB`标志表中15个指数.`reserved1`在哪里开始指数的运行`reserved2`每个子的尺寸 (12).`reserved1`并且每个插槽有8个字节.`__stubs`开始于指数0和`__got`在指数7上,所以切5图到符号表入口10, `_puts`其他地方`__got`图片与相同的输入.`otool -Iv`印记了两条路,`indirect_table()`复制每一行.

### 两个级别的名称空间

`nm -m`印记`(undefined) external _puts (from libSystem)`其他`(undefined) external _grade (from libledger)`图书馆来自于符号记录本身.`nlist.h`定义`GET_LIBRARY_ORDINAL(n_desc)`作为15到8个位`n_desc`首先一个`LC_LOAD_DYLIB`两次的第二次,`0xfe`动态搜索`0xff`对于可执行的.`ld(1)`: "用 -two_levelnamespace (默认),链接器只在命令行搜索符号中的dylib,并记录它们在哪里找到dylib. "`nm_lines()`通过" "的12张录像`n_type`现在`n_sect`现在`n_desc`其他`n_value`测试将其输出线与捕获的线进行比较`nm -m`连接到`-Wl,-flat_namespace`阅读`otool -h`为了看到`MH_TWOLEVEL`它们会消失.

## 链接的修复,字节对字节

`LC_DYLD_CHAINED_FIXUPS`是一个`linkedit_data_command`其他`dataoff 0x8000`现在`datasize 208`接下来是208字节.`fixup-chains.h`现在,我们要去.

标题为7个32位字段:`fixups_version 0`现在`starts_offset 32`现在`imports_offset 80`现在`symbols_offset 112`现在`imports_count 8`现在`imports_format 1`(`DYLD_CHAINED_IMPORT`), `symbols_format 0`没有压缩.`llvm-objdump --macho --chained-fixups`测试将这些7个值打印,然后将它们比较.

在32场的补偿中,`dyld_chained_starts_in_image`其他`seg_count 4`只有一个零件,没有修复的零件.`__DATA_CONST`没有一个.`dyld_chained_starts_in_segment`读书`size 24`现在`page_size 0x4000`现在`pointer_format 6`(`DYLD_CHAINED_PTR_64_OFFSET`目标是vm抵消),`segment_offset 0x4000`现在`max_valid_pointer 0`现在`page_count 1`一个`page_start`值为 0.`DYLD_CHAINED_PTR_START_NONE`现在`0xffff`没有任何事.

链接开始于文件的偏移`0x4000 + 0`每个64位字都有两个东西:写什么,下一个字是哪里.

```text
  dyld_chained_ptr_64_bind    ordinal:24  addend:8  reserved:19  next:12  bind:1 = 1
  dyld_chained_ptr_64_rebase  target:36   high8:8   reserved:7   next:12  bind:1 = 0
```

读一下第一句话,`0x8010000000000000`位63设置,结合.`next`它们的数量为 62 到 51 位.`0x002`字母为0. 读出第十二个字符在`0x4058`现在`0x00000000000006db`打了63分,打了1分.`next`目标是`0x6db`像图的基础`0x100000000`让它成功`0x1000006db`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`__cstring`在前面的词,`0x00100000000006d6`股`names[0]`现在,我们可以说"甚至".

步行中,有12个字:8个字结合了`__got`具有0到7的序列,两个结合`__const`具有序列0 (两个输入的`fns[]`点在`_grade`),以及两项补贴`names[]`现在,我们要去.`chained_fixups()`检测结果将12个数据进行比较.`(offset, raw)`配对`dyld_info -fixup_chain_details`它们的印花`raw: 0x8010000000000000 bind: (next: 002, bindOrdinal: 0x000000)`首先,我会看到你.

抵消80的进口表有八个32位入口: `lib_ordinal:8`现在`weak_import:1`现在`name_offset:23`总数0到3是`_grade`现在`_grade_label`现在`_percent_change`现在`_total`图书馆1号和4号至7号`___stack_chk_fail`现在`___stack_chk_guard`现在`_printf`现在`_puts`图书馆 2.`fixup_rows()`连接两个表格到行列中`dyld_info -fixups`图像,如`__DATA_CONST __got 0x100004038 bind libSystem/_puts`测试将所有12个都比较起来.

现在,我们要做什么?`0x100004038`鱼在运载时,一次走过这个链条,并写出了`_puts`进入槽. 果在WWDC22会议上这样说:"在DATA中的64位指针位置, 另外,还包含了一个说明是否是绑定或重新基础的小部分".Xcode 13使该格式成为macOS 12或iOS 15的部署目标的默认格式, 在这种格式中,没有惰的结合. 每个插槽都被绑定在前面`main`走了.

### 它所取代的布局

`ledger_main_nochain`是与`-Wl,-no_fixup_chains`没有.`LC_DYLD_INFO_ONLY`通过4个字节编码表:重建8字节,绑定72,惰绑定120,出口64.`__TEXT,__stub_helper`号码:`__got`只有16个字节的存储量`___stack_chk_guard`其他`dyld_stub_binder`其他`__DATA,__la_symbol_ptr`它们的位置是:`dyld_info -fixups`列表七个`lazy-bind`七个杆,指着每个惰的槽在自己的道上.`__stub_helper`轮推出指数,跳到`dyld_stub_binder`现在,我们可以看到一个字符,`__la_symbol_ptr`是`.got.plt`现在`__stub_helper`是PLT0和`pushq $index`其他`dyld_stub_binder`是`_dl_runtime_resolve`现在,我们要去.`code/main.py`报告本文件的偏移和部分,并不会解码绑定代码;实践实验室要求这样做.

### 进口的情况

`LC_DYLD_EXPORTS_TRIE`每个节点是 uleb128终端大小,然后,如果它不是零, uleb128 旗和 uleb128 偏移,然后一个字节的孩子数量,每个孩子,一个字符串边缘和 uleb128 节点偏移. `exports_trie()`走着它.`libledger.dylib`它回来了.`_percent_change 0x410`现在`_grade 0x428`现在`_total 0x464`现在`_grade_label 0x498`现在,我们要做什么?`dyld_info -exports`在执行式上,它返回了`__mh_execute_header`现在`_fns`其他`_main`现在,我们要去.

## 什么条纹的叶子

果公司`strip(1)`没有选择在动态链接的执行器上,它表现得像`-u -r`:保存未定义的符号和动态引用的符号. `-x`删除本地符号.`-N`移除整个符号表和字符串表. "对于动态共享库,最大的剥离水平通常是 - x",因为"动态链接过程只使用全球符号".

我们的灯具上观察到.`strip ledger_main`接着`LC_SYMTAB`已删除12至10份记录`_main`现在`_fns`其他`_names`八个未确定进口仍然存在,因为他们需要他们的名称结合,`__mh_execute_header`现在,它是因为它是`REFERENCED_DYNAMICALLY`第十个记录是个类型的刺伤.`N_OPT`名称`radr://5614542`果的工具写下来,让桌子永远没有空.`nm`截图的程序将打印与原始的三行相同,然后输出0.`LC_FUNCTION_STARTS`现在还有一个开始,`main`现在,我们要去.

`strip libledger.dylib`没有选择,比男人的平常走得更远.`-x`其他`LC_SYMTAB`具有0个记录,`nm`输出三角形仍然列出了四个函数,因为Dild通过三角形结合,从来没有通过.`LC_SYMTAB`现在,我们要去.`LC_FUNCTION_STARTS`实验室C连接一个新的`main.c`为了证明链接编辑器也被试用.

| What | ELF after `--strip-all` | PE image | Mach-O after `strip` |
|---|---|---|---|
| static symbol table | gone | never present in an image | local and defined names gone, undefined imports stay |
| names the loader binds | `.dynsym` and `.dynstr` stay | import directory stays | imports stay in `LC_SYMTAB` and in the chained imports table |
| exported names | `.dynsym` stays | export directory stays | exports trie stays |
| function starts | `.eh_frame` FDEs, unless built without unwind tables | `.pdata` for non-leaf functions | `LC_FUNCTION_STARTS` stays |
| debug information | `.debug_*` gone | in the PDB, never in the image | in the dSYM, never in the image |
| section or load command headers | stay unless `--strip-section-headers` | stay | stay |

## 找出没有符号的功能

`static-arm64-O2`链接`main-arm64-O2.o`其他`ledger-arm64-O2.o`转化为一个可执行的五个函数`__text`现在,我们要去.`nm -n`没有删除的文件是基本的真理:`_main`在`0x100000500`其他类型:`_percent_change`在`0x1000005f4`其他国家`_grade`在`0x10000060c`其他国家`_total`在`0x100000648`其他国家`_grade_label`在`0x100000740`(72) `static-arm64-O2.stripped`没有`N_SECT`内部的符号`__text`现在,我们要去.`FunctionFinder`运行四种方法,`score()`对于每一个名单,都会与真相相比较.

### 开始

命令点在9个字节中`__LINKEDIT`其他`80 0a f4 01 18 3c f8 01 00`格式是Uleb128deltas,这是从`__TEXT`其他地方`80 0a`是`0x500`所以第一开始是`0x100000500`现在,我们要去.`f4 01`是`0xf4`现在,`0x1000005f4`现在,我们要去.`18`给出`0x10000060c`现在`3c`给出`0x100000648`现在`f8 01`给出`0x100000740`其他`00`五分五,没有虚假阳性,`-O0`在`-O2`链接编辑写这张表,用于机和机记者,`strip`吉德拉在他的分析器中读到了"Mach-O功能开始".`dyld_info -function_starts`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`function_starts`现在,我们要去.

### 序幕扫描

吉德拉的AARCH64开始模式从`fd 7b bf a9`现在,`stp x29, x30, [sp, #-0x10]!`在我们的文件中,它在两个层面都发现了5分之一.`sub sp, sp, #N`首先,然后`stp x29, x30, [sp, #M]`面具为 ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`sub sp, sp, #imm`现在`(word & 0xff0003ff) == 0xd10003ff`现在,我们在 5 中找到 5`-O0`并且在 5 个函数中,`-O2`在哪里`percent_change`现在`grade`现在`total`其他`grade_label`它们是没有框架的叶子函数.`percent_change`开始于`cbz w0, ...`编译器选择发射什么,课38显示,这有多么频繁是什么.

由于程序很小,所以这两种扫描都没有产生错误正值.`55`其他`push rbp`由于Ghidra的x86-64模式文件被合到其他命令中,`55 48 89 e5`具有类似的预示模式`ret`或`nop`这必须结束之前的功能.

### 呼叫目标

每一个`bl`在`__text`函数开始的名称,因为`bl`在函数中部中,是编译器不发射的东西.`0x94000000`通过26位字符的字符.`bl`在`0x1000005a0`读书`3d 00 00 94`其他`0x3d`乘以4是61.`0xf4`所以目标是`0x100000694`在`ledger_main`这就是子的子.`_puts`在静态构造中,`call_targets()`收集了目标的内部`__text`让那些落地的人落下`__stubs`增加了`LC_MAIN`进入,因为没有什么叫`main`核子 (安德里斯,斯洛文斯卡,博斯,2017) 基于编译器生成代码的这个想法建立了其函数检测,安德里斯和其他人在2016年测量了函数边界是拆除的最困难部分,比指令边界更难.

## 一个的签名

六射线在文件中描述了FLIRT:一个模式是"一个函数的第32字节,其中所有变体字节都标记",变体字节来自固定和外部引用,模式生活在树上,并且在模式之外"我们计算了从位置33开始到第一个变体字节的字节的CRC16",并存储了这一长度. 两个具有相同的模式和CRC的函数在不同位置的尾巴字节分开,然后由它们所指的名称分开. 任何分离不出来的碰撞"都是自然智能能解决的". 没有外部引用的四字节短的函数被排除在外,并且"签名文件不包含原始库中的字节,除了函数名称".

`signatures_from_object()`建立了这个从`ledger-arm64-O2.o`其他`main-arm64-O2.o`像FLAIR从图书馆的物体中构建的.`relocation_info`记录包含一个4字节的单词,然后这些字节变得变异.`.pat`图表,CRC长度,CRC16长度,函数长度,`:0000`名称,以及`^offset name`对于每个引用名称:

```text
A00000342800004B890C8052087D091B000DC01AC0035FD6 00 0000 0018 :0000 _percent_change
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 003C :0000 _grade ^0000 l_switch.table.grade ^0001 l_switch.table.grade
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 0048 :0000 _grade_label ^0000 l_switch.table.grade_label ^0001 l_switch.table.grade_label ^0002 _labels ^0003 _labels
```

`_percent_change`并且CRC长度为0.`_grade`据了解,在CRC的位置是60字节,第一次转移到36字节,所以CRC覆盖了4字节.`.pat`解析器使用:多项式`0x8408`起始值`0xffff`对于ASCII字符串"123456789"的值是`0x6e90`试验针是这样的.

`match_signatures()`在每一个函数开始的每一个签名试验, 脱离的构建, 首先模式,然后CRC.`-O0`五个函数都得到了它们的名字,没有什么碰撞.`-O2`两条线上碰撞.`grade_label`入`grade`两个函数共享了它们的第36字节和4个CRC字节.`0x10000060c`在`0x100000740`尾巴将它们分开: 44 字节`_grade`没有`20`其他`_grade_label`没有`28`现在,`ldr w0, [x9, w8, uxtw #2]`反对`ldr x8, [x9, w8, uxtw #3]`报告记录了碰撞和决定它们的字节.

测试`test_object_bytes_equal_linked_bytes_outside_relocated_words`检查前提:每个对象函数的每个非变量字节均等于链接可执行中的相同的偏移字节,因此链接编辑器只改变了移动的单词. `_total`没有转移,没有变量字节.

### 工具能用同一个想法做什么

通过 IDA Pro 9.4 发送每个处理器的FLIRT签名`sigmake`工具用于构建它们;IDA Free仅涵盖x86和x86-64并且用于非商业用途. 路米纳是一个服务器,通过 md5 键键键键函数的 metadata,并跳过32字节以下的函数. 吉德拉 12.1.4 (Apache-2.0) 有功能 ID:一个完整的哈希在 mnemonics 和解决模式上是"强大的由于链接的变化"和一个特定的哈希,添加了恒定操作数,分分为每匹配的指示,父母和孩子的功能作为结合打破者;它的运输数据库只覆盖视觉工作室图书馆,你从自己的二进制中填充自己的. 双色球忍者6.0克里普顿 (商业版,免费版) 使用WARP (Apache-2.0):函数 GUID是基本区块 GUID 上 UUIDv5,每个区块字节 上 UUIDv5 零化后"所有可移动说明"和放下 NOP,与调用,调用和邻近函数作为限制. 二进制器8 (Apache-2.0) 匹配两个双数之间的函数,步骤的定序,从哈希匹配通过流量图的MD指数调称序列匹配,并从匹配的边缘,块,说明和流量图的MD指数中重量相似性. 图形3.4.3 (仅AGPL-3.0,IDA) 添加小素数产品,每个mnemonic图为一个素数和函数是产品,一个无序多组指纹. 雷达2.6.2.4 (LGPL-3.0) 有签名 (`zg`现在`z/`现在`zb`) 并且读为FLIRT `.sig`文件`zfs`酸 0.9.1 (LGPL-3.0) 产生了`.pat`或`.sig`通过一个开放的二进制`Fc`并且使用一个`Fs`现在,我们要去.

机器上没有安装Radar2和Rizin,他们的命令是从他们的书籍和来源中引用的.这些设备上运行的工具是`clang`现在`ld`现在`llvm-objdump`现在`otool`现在`nm`现在`strip`其他`dyld_info`通过探测器,LIEF阅读了所有格式,包括自0.17.0以来支持的COFF对象,并报告了10个绑定和2个依据.`ledger_main`文件只读取ELF文件. 文件拒绝`main-x86_64.obj`随着`PEFormatError: 'DOS Header magic not found.'`读一读这个小图片.

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
```

输出是一个五部分的JSON报告. `elf`两个物体的迁移数量,链接计划和动态部分,PLT和GOT`tiny-dyn-x86_64`现在,我们要去.`coff`具有两个对象的部分,迁移,功能和未定义名称. `pe`拥有该公司的标题,目录,进口,出口,基地转移和国际通用电话`tiny-x86_64.exe`现在,我们要去.`macho`保持`ledger_main`由于其,链接的固定,固定行,和出口,`ledger_main_nochain`,,和两份漫画报告.`identification`通过四种方法,并通过分数,`-O0`其他`-O2`现在,我们要去.

预期的形状:

```json
{
  "elf": {"linkPlan": {"pltSymbols": ["puts", "printf"], "sizes": {".plt": 48, ".got.plt": 40, ".rela.plt": 48, ".rela.dyn": 48}, "...": "..."}, "tiny-dyn-x86_64": {"...": "..."}},
  "coff": {"main-x86_64.obj": {"...": "..."}},
  "pe": {"imports": [{"dll": "msvcrt.dll", "iat": "0x2040", "...": "..."}], "...": "..."},
  "macho": {"ledger_main": {"flags": "0x200085", "fixupRows": ["__DATA_CONST __got 0x100004000 bind libledger/_grade", "..."], "...": "..."}, "strip": {"...": "..."}},
  "identification": {"O2": {"methods": {"functionStarts": {"recall": "5/5"}, "prologueSub": {"recall": "1/5"}, "...": "..."}, "correctNames": 5}}
}
```

阅读`code/main.py`在此顺序:

1. `ElfFile`阅读标题,部分,象征表,以及转移,`dynamic_entries()`现在`jump_slots()`现在`plt_entries()`其他`plt0()`阅读链接的图像.
2. `plan_dynamic_link()`适用于移动物体移动记录的4.9表和5.2节.
3. `CoffObject`读取文件标题,部分表,18字节符号及其辅助记录,以及10字节移动.
4. `PeImage`阅读MS-DOS的图片,PE签名,可选标题,数据目录,部分以及进口,出口和基调迁目录,`iat_calls()`解码`ff 15`现在,我们要去.
5. `MachoFile`阅读载荷命令,段子,`nlist`记录,间接符号表,片,链接的固定,出口试验和物体转移.
6. `FunctionFinder`运行四个开始发现器和`score()`对于每一个人,都是对真理的.
7. `signatures_from_object()`其他`match_signatures()`建立和应用FLIRT形状的签名.
8. 其他`parse_*`测试对比的捕获工具文本.

更多命令:`python3 code/main.py elf FILE`现在`coff FILE`现在`pe FILE`其他`macho FILE`打印一个报告.`python3 code/main.py plan OBJECT...`打印任何ELF对象的链接计划. `python3 code/main.py functions STRIPPED UNSTRIPPED OBJECT...`给你一个新建的新建物,

## 用它

在你构建的程序中,用读者按此顺序.

1. 读取标题,并指定格式和类型:可移动的物体,可执行的物体,或共享的图书馆.
2. 列出进口与供应商: `DT_NEEDED`其他`.dynsym`进口目录或链接进口表`LC_LOAD_DYLIB`每次呼叫名单上的每一个名字都会留下图像.
3. 随着一个通话的手续到其插槽. 写下通话字节,插槽或PLT字节,插槽地址,文件中的字节,以及载体所写的内容. 如果文件中的字节看起来像垃圾,然后把它解码为一个修复,然后把它称为垃圾.
4. 运输器需要存活的名称`strip`只有一个调试器需要的名字,不需要.
5. 在一个剥离的构建中,运行可以运行的搜索器,然后与未剥离的双胞胎进行比分,`LC_FUNCTION_STARTS`现在`.pdata`其他`.eh_frame`通过字节模式,使用呼叫目标填补空白.
6. 根据两个签名的要求,一个名字是未知的,直到尾巴或引用的名字决定.

随着工具链的变化,重新捕获,因为一个改变的列表是改变的固定.

## 互动实验室

### 实验室A:手工 PLT

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code
python3 -q
```

运行:

```python
from main import *
elf = load_elf("tiny-dyn-x86_64")
[(e.tag_name, e.text) for e in elf.dynamic_entries()]
elf.plt0()
[(e.symbol, hex(e.address), hex(e.slot), hex(e.slot_initial)) for e in elf.plt_entries()]
[hex(w) for w in elf.got_plt_words()]
```

在每次电话之前,从上面的文字中计算答案.`IMPORTS`在`build_tiny_dyn_elf.py`为了使我们能够实现这一目标,`.plt`现在`.got.plt`其他`.rela.plt`在你读之前.

### 实验室B:一个链接的修复

```python
exe = load_macho("ledger_main")
stub = next(s for s in exe.stubs() if s.symbol == "_puts")
stub.lines()
raw = int.from_bytes(exe.read(stub.slot, 8), "little")
hex(raw), raw >> 63, (raw >> 51) & 0xfff, raw & 0xffffff
[(i.index, i.name, i.library) for i in exe.chained_fixups()["imports"]]
```

首先,在纸上解码绑定字:绑定字,`next`然后再读8字节的字,确认这是下一个修复.然后读取链接的最后一个字在`0x100004058`解释为什么它是`next`没有任何东西.

### 实验室C:脱离和重新连接

在安装目录中,将一个新程序与完全脱掉的dylib连接起来:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/fixtures
clang -target arm64-apple-macos -O1 main.c -L. -lledger.stripped -Wl,-rpath,@executable_path -o /tmp/relinked
nm /tmp/relinked | grep ' U '
dyld_info -exports libledger.stripped.dylib
```

通过一个图书馆进行了成功的链接.`LC_SYMTAB`链接编辑器读出出口试图.`python3 ../main.py macho libledger.stripped.dylib`并且比较`symtab`现在`exports`其他`functionStarts`然后用 片去除静态构造.`-N`现在我们要看看什么.`dyld_info -function_starts`仍然有印记.

### 实验室D:碰撞

```python
from main import *
stripped = load_macho("static-arm64-O2.stripped")
sigs = signatures_from_object(load_macho("ledger-arm64-O2.o"))
[s.pat_line() for s in sigs]
starts = FunctionFinder(stripped).function_starts()
match_signatures(sigs, stripped, starts)
```

读出两次碰撞记录,然后编写来自`ledger-arm64-O0.o`打对阵他们`static-arm64-O0.stripped`通过"`.pat`没有发生碰撞的原因`-O0`然后缩短`PATTERN_LENGTH`它们在一个位置上,

## 实践实验室

解码已旧的结合表,并添加PE探测器.

要求:

- 解码`LC_DYLD_INFO_ONLY`基于,绑定,和惰绑定的opcode流`ledger_main_nochain`按段子,段子,地址,类型和目标的行列,并使它们等于捕获的21行`dyld_info -fixups`给我一个短信.
- 添加一个`PT_GNU_RELRO`项目标题和一个`DT_FLAGS`随着`DF_BIND_NOW`为了`build_tiny_dyn_elf.py`移动`.got.plt`在覆盖范围内,并做`llvm-objdump -p`在 README 装置中,请说明这部份的全RELRO是什么部分,只有glibc才能执行.
- 写一个`.pdata`读取PE32+图像和使用函数查找器`RUNTIME_FUNCTION`开始地址. 建立一个对象`clang -target x86_64-pc-windows-msvc -c`没有`-fno-asynchronous-unwind-tables`阅读它`.pdata`转移,并说明表中遗漏的其函数是页面函数.
- 写一个对每个读者进行测试,并与捕获的工具文本进行比较.

成功意味着`python3 code/main.py macho ledger_main_nochain`打印出相同的21个固定行`dyld_info`印记,小的ELF携带一个`PT_GNU_RELRO`这`llvm-objdump`其他国家`.pdata`搜索器将其能执行的功能命名,并列出其不能执行的页面功能.

## 教训艺术品

这一课包括`outputs/skill-linking-loading-and-stripped-binaries.md`通过它将你构建的程序变成了其进口的列表,`strip`需要一个未删除的双胞胎作为地面真理,一个捕获的工具列表每一个索赔,和记录每一次碰撞.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

验证应证明:

- 动态部分`tiny-dyn-x86_64`匹配`llvm-objdump -p`标签以标签,`DT_FLAGS_1`运载`DF_1_PIE`
- 两个人`R_X86_64_JUMP_SLOT`记录一致`llvm-objdump -R`名称`puts`其他`exit`
-  PLT0 推 GOT+8 跳过 GOT+16,每个输入都读取其插槽,推出其索引,每个插槽都包含其自己的地址 `pushq`
- 微小的ELF比赛的部分和节目标题`llvm-objdump -h -p`
- 两种ELF物体的迁移记录相匹配`llvm-objdump -r`
- 链接计划发现了两个PLT符号,四个直接电话,两个相对移动,以及小图像的尺寸
- 根据COFF部分表,37个符号记录与辅助记录,以及迁移相匹配`llvm-objdump -h -t -r`其他`/16`解决问题`.llvm_addrsig`
- 三个 COFF`REL32`记录`ledger`坐在三上.`PC32`抵消
- 专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专业专`DllCharacteristics`数据目录和数据目录相匹配`llvm-objdump -p`
- 进口目录,提示/名称条目和IAT匹配`llvm-objdump`其他`pefile`结前的查找表等于IAT
- 出口目录和`DIR64`移动指标将字符串命名为"手动链接"
- `ff 15`在RVA`0x100b`解决了IAT的插槽`puts`
- 马赫-奥旗,19个载荷命令名称,两个图书馆相匹配`otool`
- 七个子将解码为八个`__got`插槽和间接符号表匹配`otool -Iv`
- 链接的头相匹配`llvm-objdump --macho --chained-fixups`
- 链路行程将所有12个原始字体复制成`dyld_info -fixup_chain_details`
- 固定行和进口表相匹配`dyld_info -fixups`其他`-imports`
- 出口量相匹配`dyld_info -exports`对于子和其剥离的副本,
- `nm_lines()`相当于`nm -m`执行可及其剥离副本
- `strip`删除`_main`现在`_fns`其他`_names`保持了9个名字和一个名字`radr://5614542`打刺,然后剥离的程序打印出相同的输出
- 传统的布局已经`LC_DYLD_INFO_ONLY`七个惰的指针,`__stub_helper`
- 亚马64对象移动匹配`llvm-objdump -r`
- `LC_FUNCTION_STARTS`在两级和等级中,恢复了五分五.`nm`其他`dyld_info -function_starts`
- 其他`sub sp`扫描结果是5个5个`-O0`五个人的一个`-O2`其他`stp`图像扫描发现没有
- `bl`目标加上`LC_MAIN`进入回收五个五个
- 签名将在两个层面上列出所有五个函数,并记录`grade`碰撞分为44字节
- "123456789"的CRC16是`0x6e90`在 GOT 载荷对下面的8个字节`main`是变体
- 每个非变量对象字节均等于链接的字节
- 演示和数字数据报告相同的地址,网站模块将相同的数据嵌入ES5中

## 生产失败模式

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| A `bl` or `call` lands in a stub | "calls an unnamed function at 0x694" | the stub bytes, the slot it loads, and the import the slot binds |
| A GOT word read from the file | "corrupt pointer 0x8010000000000007" | bit 63 is bind, `next` is 2, ordinal 7 is `_puts` from library 2 |
| `PLT32` in an object | "every call goes through the PLT" | defined symbols are reduced to a direct distance, only undefined ones get an entry |
| Partial RELRO read as full | "GOT is read-only" | `.got.plt` slots after the three reserved ones sit outside `PT_GNU_RELRO` without `-z now` |
| COFF `REL32` compared with ELF `PC32` | "the Windows build has different relocations" | same offsets, the `-4` lives in the ELF addend and in the COFF field |
| IAT read before load | "imports point at strings" | the IAT equals the lookup table until the loader binds, and the strings are hint/name entries |
| A stripped dylib | "no symbols, nothing exported" | the exports trie and `LC_FUNCTION_STARTS` list every function |
| `nm` on a stripped executable | "one function" | `LC_FUNCTION_STARTS` lists five starts, nine bytes long |
| A prologue scan at `-O2` | "one function" | four leaf functions have no frame, call targets and the starts table find them |
| Two functions share 36 bytes | "grade_label is grade" | the tail byte at 44 and the lengths 60 and 72 split the collision |
| A tool run on another machine's build | the numbers in this text | recapture every listing from your own fixtures |

## 运营规则

按照调用站点到充电器填充的插槽的每一个外部调用,然后在调用地址之前,将该插槽中的字体解码为格式定义的. 只有在记录了装载器仍然需要的东西之后才脱掉. 恢复功能从链接编辑器在扫描字节之前编写的表开始,

## 进一步阅读

- [System V gABI, chapter 5: Program Loading and Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement: section 5.2 and Table 4.9](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Drepper, "How To Write Shared Libraries", version 4.1.2](https://akkadia.org/drepper/dsohowto.pdf)
- [Drepper, "ELF Symbol Versioning"](https://akkadia.org/drepper/symbol-versioning)
- [Jelinek, "Little hardening DSOs/executables against exploits", binutils list, 2004-01-06](https://www.sourceware.org/ml/binutils/2004-01/msg00070.html)
- [Taylor, "Linker relro", 2008](https://www.airs.com/blog/archives/189)
- [binutils commit bd7ab16b: PLT32 for calls, 2018-02-13](https://gnu.googlesource.com/binutils-gdb/+/bd7ab16b4537788ad53521c45469a1bdae84ad4a)其他[LLVM D43383](https://reviews.llvm.org/D43383)
- [GNU Binutils: strip](https://sourceware.org/binutils/docs/binutils/strip.html)其他[llvm-objcopy](https://llvm.org/docs/CommandGuide/llvm-objcopy.html)
- [Microsoft, PE Format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [CALL instruction reference, FF /2](https://www.felixcloutier.com/x86/call)
- [Apple, mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)其他[mach-o/nlist.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)
- [Apple dyld, mach-o/fixup-chains.h](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/fixup-chains.h)
- [Apple ld64, stub_arm64.hpp](https://github.com/apple-oss-distributions/ld64/blob/main/src/ld/passes/stubs/stub_arm64.hpp)
- [Xcode 13 release notes: chained fixups](https://developer.apple.com/documentation/xcode-release-notes/xcode-13-release-notes)其他[WWDC22 session 110362, "Link fast: Improve build and launch times"](https://developer.apple.com/videos/play/wwdc2022/110362/)
- [strip(1)](https://keith.github.io/xcode-man-pages/strip.1.html)现在[ld(1)](https://keith.github.io/xcode-man-pages/ld.1.html)其他[dyld(1)](https://keith.github.io/xcode-man-pages/dyld.1.html)
- [Hex-Rays, IDA F.L.I.R.T. Technology: In-Depth](https://docs.hex-rays.com/core/flirt/concepts/ida-f.l.i.r.t.-technology-in-depth)其他[Lumina overview](https://docs.hex-rays.com/add-ons/lumina/overview)
- [Ghidra Function ID help](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/FunctionID/src/main/help/help/topics/FunctionID/FunctionID.html)其他[AARCH64 function start patterns](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/patterns/AARCH64_LE_patterns.xml)
- [Vector 35, WARP](https://github.com/Vector35/warp)其他[Binary Ninja WARP guide](https://docs.binary.ninja/guide/warp.html)
- [BinDiff manual](https://www.zynamics.com/bindiff/manual/)其他[BinDiff source](https://github.com/google/bindiff)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [rizin pat.c, the .pat parser](https://github.com/rizinorg/rizin/blob/dev/librz/sign/pat.c)现在[radare2 flirt.c](https://github.com/radareorg/radare2/blob/master/libr/anal/flirt.c)其他[radare2 book: Zignatures](https://book.rada.re/signatures/zignatures.html)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)其他[Andriesse, Slowinska, Bos, "Compiler-Agnostic Function Detection in Binaries" (EuroS&P 2017)](https://danielandriesse.com/papers/eurosp-2017.pdf)
- [Bao et al., ByteWeight (USENIX Security 2014)](https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/bao)其他[Shin, Song, Moazzezi, "Recognizing Functions in Binaries with Neural Networks" (USENIX Security 2015)](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/shin)
- [LIEF changelog](https://lief.re/doc/latest/changelog.html)现在[pyelftools](https://github.com/eliben/pyelftools)其他[pefile](https://github.com/erocarrera/pefile)
