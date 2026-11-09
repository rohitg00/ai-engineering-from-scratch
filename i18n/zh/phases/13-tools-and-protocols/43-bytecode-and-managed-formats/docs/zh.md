# 超越本土代码:Python,JVM, .NET和WebAssembly字符号

> 字节码文件是一个程序加上编译器的笔记,这个课程建立了读者,

**Type:** Build
**Languages:** Python, TypeScript, Java, C#, WebAssembly text
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow)
**Time:** ~150 minutes

## 学习目标

- 阅读16字节`.pyc`标题从PEP 552中,并无需查询代码对象`marshal`对于由四个解释器版本编写的文件,
- 解析一个JVM类文件从JVMS第4章:常数库,字段,方法,`Code`属性,以及表格`javac -g`增加了.
- 在 中拆除JVM的opcode`Ledger.class`证明了该公司的登记`javap -c`在同一源的四个建筑物上.
- 阅读WebAssembly模块部分,解码每个函数体,并证明结果与`wasm-objdump -d`现在,我们要去.
- 从PE数据目录到网格中传输 .NET组件的ECMA-335元数据`MethodDef`根据ILSpy使用的读者库,检查每个方法的行和CIL.
- 测量,在五个容器中,每个格式保留哪些名称,类型和控制结构,以及哪些丢失.

## 问题

你建造了`ledger.py`发现了`ledger.cpython-314.pyc`在`__pycache__`你问一个代理人文件包含什么,代理运行了一个解译器.`Unsupported opcode`并且有一个句子说`# WARNING: Decompyle incomplete`代理人认为文件被罩.

文件没有被罩. 它的前两个字节是`2b 0e`编译器的opcode表在3.13停止.该工具过时.代理没有读取标题,所以它无法区分.

课程33显示了原生代码的损失:参数名称,类型和`switch`这变成了一个跳跃桌. 字节码容器损失的减少,每个容器损失的不同. 一个 pyc 保存每个变量名称,没有类型. 类文件只会保留类型和本地名称, 体模块保留控制结构,除了自定义部分携带名称外, 设置一个 .NET 组将参数名称存储在表中,并将本地名称留给一个单独的文件. 在你知道容器开始的音符之前,你不能判断一个解译器的输出.

在Python标准库中,本课程建立了四个读器.每个读到集装箱的第一个字节,列出一个函数,并与你构建的设置器的格式工具进行检查.最后一节设置了`grade`其他`ledger`在五个容器中,

```figure
re-43-five-containers
```

## 字幕是四个字

标题是32位的4个字.第一是魔术数字.第二是位字段.Bit 0集合意味着文件是基于哈希的.Bit 1集合意味着`check_source`输入时,解释器将源头哈希进行比较. 通过 0 位清晰,字符三和四是源时间和源大小.

魔术数字生活在`Include/internal/pycore_magic_number.h`由于3.11的规则是Python 3.n从2900 + 50n开始,并在发布周期内每次字节代码变化增加一个.存储的代币是16位数,随后是`\r\n`字符串的字符串是315的,所以一个在文本模式打开的 pyc得到错误的魔法.最终值为311的3151,331的312的3571,313的3127,3627的314的3666的315的315 Python 3.15.0发布于2026-10-09年,并没有安装在这些装置的机器上,所以它的号码来自头条文件,而不是这里的文件.

插件每一个解释器都能容纳两个pyc文件.`compile_pyc.py`写了它们`py_compile.compile(..., dfile="ledger.py")`为了存储的文件名是`ledger.py`首先,我们需要一个文件,

```text
checked-hash   2b 0e 0d 0a  03 00 00 00  c7 16 c7 fc c5 1d 81 01
timestamp      2b 0e 0d 0a  00 00 00 00  8d 60 cf 6a  f1 01 00 00
```

读取时间标签标题单词.`03 00 00 00`或`00 00 00 00`是旗的词.`8d 60 cf 6a`时间为 `ledger.py`文件的构建时.`f1 01 00 00`查看的hash文件包含3个标志和8个hash字节.四个解释者同意除了魔术字节以外,所有标题都同意:

| Interpreter | Magic bytes | Word | File bytes | `grade.co_code` bytes | `grade` instructions |
|---|---|---|---|---|---|
| 3.11.14 | `a7 0d 0d 0a` | 3495 | 1054 | 80 | 31 |
| 3.12.12 | `cb 0d 0d 0a` | 3531 | 937 | 62 | 26 |
| 3.13.12 | `f3 0d 0d 0a` | 3571 | 943 | 70 | 26 |
| 3.14.6 | `2b 0e 0d 0a` | 3627 | 965 | 96 | 35 |

`read_pyc_header()`在`code/main.py`返回这些字段并从词中命名版本. `importlib.util.MAGIC_NUMBER`给运行的解释器提供相同的4字节. `python3 code/main.py compare`编译源与每个 `python3.11`为了`python3.15`发现`PATH`读者看到的标题, 翻译对自己报道的事实.

## 标志者按字段编写代码对象

每个装置的16字节是`e3`这就是`0x80 | ord('c')`: 标签类型代码为一个代码对象`FLAG_REF`让读者记住对象以后`r`根据"士文件"的说明,该格式是故意无文档的,并且代码对象不兼容版本之间.这两种声明都是真的,并且格式仍然足够小以读取.`Python/marshal.c`列出类型代码: `N`没有一个.`i`一个32位的 int,`s`字节`z`其他`Z`短的ASCII字符串,`(`其他`)`子,`c`代码对象`r`容器在孩子面前保留其参考位置,所以读者也会这样做.

`w_complex_object()`对于3.11到3.15来说,它是`argcount`现在`posonlyargcount`现在`kwonlyargcount`现在`stacksize`现在`flags`作为32位英寸,然后`code`现在`consts`现在`names`现在`localsplusnames`现在`localspluskinds`现在`filename`现在`name`现在`qualname`作为物体,`firstlineno`现在`linetable`其他`exceptiontable`3.14文件的模块代码对象手动从17字节解码:

```text
00 00 00 00   argcount 0
00 00 00 00   posonlyargcount 0
00 00 00 00   kwonlyargcount 0
01 00 00 00   stacksize 1
00 00 00 00   flags 0
f3 22 00 00 00   type 's' with FLAG_REF, 34 bytes of co_code follow
80 00  52 06  74 00  52 01  17 00  74 01 ...
```

代码字节为每一个指令的两个字节:`80 00`是`RESUME 0`现在`52 06`是`LOAD_CONST 6`现在`74 00`是`STORE_NAME 0`其他`17 00`是`MAKE_FUNCTION`设置中的3.14列表印出了相同的五个模块级语句.`code`它们包含了四个嵌套的代码对象,`names`其他`('LABELS', 'percent_change', 'grade', 'total', 'grade_label')`现在,我们要去.

`Unmarshaller`在`code/main.py`现在,我们可以看到一个图像,`nlocals`现在`varnames`现在`freevars`其他`cellvars`它们是单独的领域.`CodeObject`具有实际对象的属性名称.`varnames`选器`localsplusnames`通过`CO_FAST_LOCAL`的部分`localspluskinds`为了`grade`在每一个4个文件中,它返回了`('score', 'bucket')`现在`firstlineno`十个,一个不空的`linetable`测试`test_unmarshaller_agrees_with_the_running_interpreter`比较每一个领域`marshal.loads()`其他三份文件是我们的代码可以读取,`marshal`在这个解释者下.

## 读者:四个解释器,四个字符号

文件显示每个版本都有一个警告:字节码是CPython的实施细节,并没有保证它保持不变.`python3.1N -m dis ledger.py`对于每一位翻译,都被捕获了.

在3.11`grade`开始这样:

```text
 11           2 LOAD_FAST                0 (score)
              4 LOAD_CONST               1 (10)
              6 BINARY_OP                2 (//)
             10 STORE_FAST               1 (bucket)
 12          12 LOAD_FAST                1 (bucket)
             14 LOAD_CONST               2 (9)
             16 COMPARE_OP               5 (>=)
             22 POP_JUMP_FORWARD_IF_FALSE     2 (to 28)
```

`BINARY_OP`两个字节之间的两个字节是从专业化的适应解释器PEP 659的内线缓存输入. `COMPARE_OP`在16号,其次是22号,所以它拥有两个缓存输入.`show_caches=True`3.12 替换`LOAD_CONST`另外`RETURN_VALUE`随着`RETURN_CONST`改名为跳跃`POP_JUMP_IF_FALSE`们的子`grade`标签的印花量为3.13`L1`为了`L4`转换并提供CLI`-C`存储器和`-O`对于抵消. 3.14 取消`RETURN_CONST`另一个例子`LOAD_SMALL_INT`其他`LOAD_FAST_BORROW`及插入`NOT_TAKEN`在每次条件跳跃之后:

```text
 12         20       LOAD_FAST_BORROW         1 (bucket)
            22       LOAD_SMALL_INT           9
            24       COMPARE_OP             188 (bool(>=))
            26       CACHE                    0 (counter: 0)
            28       POP_JUMP_IF_FALSE        3 (to L1)
            30       CACHE                    0 (counter: 0)
            32       NOT_TAKEN
```

其他`-C -O`列表显示 13 `CACHE`内部的报名`grade`五个后`BINARY_OP`一个接一个`COMPARE_OP`一个接一个`POP_JUMP_IF_FALSE`适应器显示缓存是什么.`dis.dis(grade, adaptive=True)`印记`RESUME_CHECK`其他`COMPARE_OP_INT`在简单列表中`RESUME`其他`COMPARE_OP`其他`total`表演`FOR_ITER_LIST`现在`BINARY_OP_ADD_INT`其他`JUMP_BACKWARD_NO_JIT`专业形式生活在同一`co_code`由于专业化发生在记忆中.

这就是为什么解译器有版本限. uncompyle6 3.9.3 表示它接受从Python 1.0到3.8的字节码. decompyle3 3.9.3读取3.7和3.8. xdis 6.3.0,背后的交叉版本解组器读取到3.13. pycdc有opcode表达到`python_3_13.cpp`在其构建文件中,以及未知的opcode打印中.`Unsupported opcode`字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字母字字母字母字母字母字母字字字字字字母字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字字

## 类档案保持了自己的词典

简单的 Java SE 25 节 4.1 列出了一个结构: `magic`现在`minor_version`现在`major_version`现在`constant_pool_count`的,`access_flags`现在`this_class`现在`super_class`它们的功能,接口,字段,方法,属性.`0xCAFEBABE`简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是: 简单的版本是简单的版本`Ledger-g.class`是`ca fe ba be 00 00 00 41 00 5e`简单的意思是:`0x5e`总数是94.`Ledger-jdk25.class`基于同一源的JavaVAC 25.0.2 构建,开始`ca fe ba be 00 00 00 45`专长69

常数池是类文件保留自己的字典的地方.`#13`在`-g`构建是一个`Methodref`这点在课堂上`#8`名称和类型`#14`按照指数的结果`Ledger.grade:(I)I`现在,我们在做什么?`javap -v`后的印记`//`描述器`(I)I`是一个`int`参数和一个`int`结果`([I)I`现在`total`表示参数是`int`每种方法,字段和类别,代码触摸都有这样的输入,4.10节的验证器拒绝一个文件的指示与他们不同.`ClassFile`类`code/main.py`查看表4.4中的所有17个常数标签,并处理一个`Long`或`Double`它们在最后一个属性之后,在一个未知的标签和字节上升.

属性取决于类,每个字段,每个方法,以及`Code`简单的方法是: 虚拟机必须忽略它不知道的属性,这就是为什么可以添加或删除调试表,而不需要改变方法体. javac 手册说`-g`生成所有调试信息,包括本地变量,默认生成行号码和源文件,并且`-g:none`没有任何产生的东西.

| Build | Bytes | Constant pool count | `LineNumberTable` | `LocalVariableTable` | `SourceFile` | `grade` code bytes |
|---|---|---|---|---|---|---|
| `javac -g` | 1832 | 94 | 7 methods | 6 methods | yes | 50 |
| `javac` | 1581 | 82 | 7 methods | none | yes | 50 |
| `javac -g:none` | 1404 | 79 | none | none | no | 50 |

它们的50个字节`grade`测试检查了所有文件.`-g`增加`grade`是一个`LocalVariableTable`排:开始0,长度50,插槽0,名称`score`描述器`I`没有它,解译器会看到0类型的插槽.`int`他必须发明一个名字.`StackMapTable`由于验证器需要它,所以它在每一个构建中都会保持.`BootstrapMethods`属性保持因为`main`连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接连接`invokedynamic`现在,我们要去.

## 手动解码表交换器

根据JVMS第6章,每个指令都被定义为一个opcode字节和一个opcode名称的操作数.分支偏移是与分支的opcode地址相比的16位签字值,而与x86-64不同,该指令的移动相对于下一个指令. `tableswitch`其他`lookupswitch`开始从零到三个填充字节,所以他们的32位操作数从一个地址开始,这是一个乘法4

字节的字节`grade`电脑 4 个`Ledger-g.class`其他:

```text
aa                 tableswitch at pc 4
00 00 00           padding to pc 8
00 00 00 2c        default: 4 + 44 = 48
00 00 00 06        low 6
00 00 00 0a        high 10
00 00 00 2a        case 6:  4 + 42 = 46
00 00 00 28        case 7:  4 + 40 = 44
00 00 00 26        case 8:  4 + 38 = 42
00 00 00 24        case 9:  4 + 36 = 40
00 00 00 24        case 10: 4 + 36 = 40
```

只有一个命令,然后全部.`switch (score / 10)`作为一个共同的案例,`switch`在第33课中需要一个限制检查,`lea`其他`movslq`其他`add`目标在指令中,以及它们的相应性.

`disassemble_jvm()`覆盖所有202个定义的操作码及其操作码宽度,遵循填充规则,并将操作码呈现出方式 `javap`没有.`compare_with_javap()`分析被俘的人`javap -c -p`包含多行文本`tableswitch`测试的方法是对每一个指令进行的对比,mnemonic和操作.`test_branch_offsets_are_relative_to_the_branch_instruction`检查`ifne`在PC1登陆6号,`if_icmpge`在13号,在33号,着陆,`goto`在30点,返回10点.

根据这些课程的源头,Radar2.6.2.4读取了相同的文件.`rabin2 -I`报告`arch java`现在`lang java 21`现在`linenum true`其他`lsyms true`根据该版本和两个调试表的读数. `pd 14 @ sym.Ledger.grade`打印了`tableswitch`它们还会打印.`Unable to parse code attribute: 2`工具本身的名称是限制性的,`javap`作为预言. 与Python相比,这个格式的解译器已经成熟. 根据MIT的许可, 普洛基翁0.6.0和Vineflower1.12.0是Apache-2.0,而Vineflower是Fernflower fork,支持Java 21. 飞花本身住在"智能社区"存储库里. 亚博appappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappappapp 哈兰德,索托瓦莱罗,蒙珀鲁斯和巴德里在2020年测量了8个. 对于 84% 的类别,最好的语法正确输出和 78% 的语义相当输出. 他们的超解译器恢复了 37.6% 的类, 类型,名称和验证的堆使得格式可拆译. 它们不会使任何一个解译器完成.

## 岩模块是一个部分列表

核心规范定义模块为序言`00 61 73 6d 01 00 00 00`子,子.`\0asm`版本1后有部分.每个部分是1个ID字节,一个`u32`标识 1 到 13 是已知部分,每部分至少一次,按顺序. id 0 是一个名字的自定义部分,可以随处使用.所有整数是 LEB128,所以`e4 00`是100和`80 08`现在,我们要做什么?`wasm-objdump -h`现在`ledger.wasm`列出了七个部分,`WasmModule`找到相同的7个,具有相同的有效负载抵消:

| Section | Payload | Count | What it holds for ledger |
|---|---|---|---|
| Type | 10 to 26 | 3 | `(i32) -> nil`, `(i32, i32) -> i32`, `(i32) -> i32` |
| Import | 28 to 39 | 1 | `env.log` with type 0 |
| Function | 41 to 46 | 4 | type index for each defined function |
| Memory | 48 to 51 | 1 | one page, no maximum |
| Export | 53 to 110 | 5 | `memory` and the four function names |
| Code | 113 to 271 | 4 | bodies of 23, 63, 44, and 23 bytes |
| Data | 273 to 290 | 1 | `F\0D\0C\0B\0A\0` at offset 1024 |

函数和代码部分之间存在分区,因此浏览器可以在整个文件到达之前开始编译.每个代码输入是一个尺寸,一个本地声明的向量和一个表达式.`grade`地方的向量是`01 7f`一个组一个`i32`这就是`bucket`没有名称,没有类型.

控制流程是结构结构的.规格说,分支只能针对包围.`block`现在`loop`其他`if`标签是根据巢穴深度进行索引的.`br_table`通过一个指标列表的操作符进行间接分支.`grade`在文件的抵消`0xa3`其他:

```text
0e                  br_table
0b                  11 labels follow
04 04 04 04 04 04   buckets 0 to 5: label 4, the outermost block, returns 0
03 02 01 00         buckets 6, 7, 8, 9: labels 3, 2, 1, 0
00                  bucket 10: label 0, shared with 9
04                  default label 4
```

每个标签都是深度. 0标签是最内心的.`block`后面的代码`end`是`i32.const 4`接着是`br 4`结果区块中.`block`面板前的指示,十一个标签,五个标签`br`之后的指示是全部的`switch`验证器拒绝任何离开结构的分支.`disassemble_wasm()`追踪深度,所以列表中图像`wasm-objdump`包含从 到 的每一个字节的光码`unreachable`为了`i64.extend32_s`并且与被俘相匹配`wasm-objdump -d`对于两座建筑物,

简单的模块中,仅仅有名字.`wasm-objdump`仍然有印记`<grade>`因为出口部分将该字符串映射到函数索引 2,读器也会这样做.`wat2wasm --debug-names`添加一个名为 `name`文件的数量增加到425字节.读者发现`{0: 'score', 1: 'bucket'}`对于函数 2 和`{0: 'values', 1: 'count', 2: 'sum', 3: 'i'}`对于函数3`wasm-strip`工具-公约库描述了另外两个载体. DWARF可以嵌入为`.debug_*`     `sourceMappingURL`定制部分可以指向一个源地图,其列数是字节对比到二进制中.

工具在2026年移动.`wasm-decompile`现在,我们在这个机器上建立了11个工具.`print`现在`objdump`其他`demangle`百里亚版本_133提供了`wasm-dis`雷达雷达也能读取模块.`rabin2 -I`,,,`arch wasm`它是为`grade`开始于`0x8e`现在,我们在这个地方的向量开始,`wasm-objdump`标签功能在`0x8b`它们的列表使用了旧的记.`get_local`现在`set_local`其他`brtable 11 4 4 ...`标签数量打印. 字节在三个工具中都是相同的,拼写不同,所以比较必须命名它被捕获的工具. 在Ghidra的处理器目录中没有找到WebAssembly处理器模块, 其他设备的Ghidra-wasm插件v2.4.0针对Ghidra 12.0. 规格本身就是一个活着的文件. 关于W3C的页面`wasm-core-2`是2026年10月13日的候选人建议草案,摘要描述了3.0版本,编辑草案的日期相同.

## ECMA-335 转基因数据是该计划的数据库

网络集成是一个PE文件.`LedgerNet.dll`开始于`MZ`共有三部分名为`.text`现在`.rsrc`其他`.reloc`宣布机器`0x14c`由于编译器发出了平台中立代码. 选项头条的数据目录14 (CLR Runtime Header) 指向RVA `0x2008`. ECMA-335 II.25.3.3定义了其中的72个字节:

```text
48 00 00 00   Cb 72
02 00 05 00   MajorRuntimeVersion 2, MinorRuntimeVersion 5
78 21 00 00   MetaData RVA 0x2178
84 07 00 00   MetaData size 1924
01 00 00 00   Flags: COMIMAGE_FLAGS_ILONLY
05 00 00 06   EntryPointToken 0x06000005, MethodDef row 5, which is Main
```

在RVA中的元数据根`0x2178`开始于签名`42 53 4a 42`根据"`BSJB`之后版本1.1和字符串`v4.0.30319`五个流头是:`#~`在抵消`0x6c`现在`#Strings`现在`#US`现在`#GUID`其他`#Blob`根据II.24.2的规定,每种流量最多发生一次.`#~`流程由一个开始`HeapSizes`字节,这里是零,所以每个字符串,GUID和点索引是2字节宽,和64位`Valid`面具将表格命名.

| Table | Id | Rows | Row size | What the rows say |
|---|---|---|---|---|
| Module | 0x00 | 1 | 10 | the module name and its GUID |
| TypeRef | 0x01 | 21 | 6 | `System.Object`, `System.Console`, 19 more |
| TypeDef | 0x02 | 4 | 14 | `<Module>`, `Ledger`, and two compiler helpers |
| Field | 0x04 | 2 | 6 | `Labels` and a static array initialiser |
| MethodDef | 0x06 | 6 | 14 | the five methods and `.cctor` |
| Param | 0x08 | 5 | 6 | `before`, `after`, `score`, `values`, `score` |
| MemberRef | 0x0a | 16 | 6 | 12 attribute constructors and the 4 methods that `Main` calls |
| CustomAttribute | 0x0c | 12 | 6 | attributes the compiler and the SDK add |
| StandAloneSig | 0x11 | 3 | 2 | the three local variable signatures |
| Assembly, AssemblyRef, ClassLayout, FieldRva, NestedClass | | 1, 2, 1, 1, 1 | | identity, references, layout |

列的尺寸在任何地方都没有存储.II.22给每列一个类型,II.24.2.6给出了尺寸规则.一个堆积指数为2或4字节`HeapSizes`简单表指数为2字节,而表表的行数不到65536行.一个可指向b标签位的编码指数为2字节,而每表的行数不到2^(16-b) 行.`CliAssembly`系统.反射.在装置中的数据库报告相同的尺寸和相同的表格抵消,这就是测试证明算法的方法.

标志的定义是:高字节是表,低字节是1的行. `0x06000002`是`MethodDef`列2 列中有RVA`0x2060`姓名`Grade`并且有一个签名`00 01 08 08`默认调用会议,一个参数,返回`int32`参数`int32`现在,我们要去.`ParamList`排列3的点`Param`谁的名字是`score`帕拉姆表是ILSpy可以打印的原因`Grade(int score)`由于除了除的释,`0x2060`方法体以脂肪头开始:

```text
13 30         flags 0x13: fat, init locals; size 3 dwords
02 00         MaxStack 2
2d 00 00 00   CodeSize 45
01 00 00 11   LocalVarSigTok 0x11000001
```

`StandAloneSig`排第 1 位`07 01 08`其他`LOCAL_SIG`一个地方,`int32`.本地有类型,没有名称.ECMA-335保留本地名称在Partition V的调试交换格式中,而 .NET SDK将它们写入PDB.`DebugType`没有,所以没有表,没有文件,没有名字.`bucket`现在,我们要去.`PercentChange`换取之处有一个小的标题:它的第一个字节`3a`是`0x0e << 2 | 2`没有当地人,并且默认的堆积量为8.

 45个字节的代码字节`Grade`通过Partition III的opcode表解码. `switch`是opcode`0x45`之后是`u32`算数和许多`int32`目标与表后指令相比:

```text
IL_0000: 02           ldarg.0
IL_0001: 1f 0a        ldc.i4.s 10
IL_0003: 5b           div
IL_0004: 0a           stloc.0
IL_0005: 06           ldloc.0
IL_0006: 1c           ldc.i4.6
IL_0007: 59           sub
IL_0008: 45 05 00 00 00 08 00 00 00 06 00 00 00 04 00 00 00 02 00 00 00 02 00 00 00
                      switch (IL_0029, IL_0027, IL_0025, IL_0023, IL_0023)
IL_0021: 2b 08        br.s IL_002b
IL_0023: 1a 2a        ldc.i4.4, ret
```

编译器在 之前减去6`switch`据了解,第6案是第一个目标.`disassemble_cil()`通过表表将代币传输: `ldsfld Labels`现在`call Grade`现在`call System.Console::WriteLine`其他`ldstr ' '`其他`#US`,这是所有这些的预言.`MetaDump`简短的C#程序在架构上`System.Reflection.Metadata`它打印了每个表的排行数量,尺寸和偏移,每个方法的RVA,签名,参数名称,以及IL字节,以及226个字段.`System.Reflection.Emit.OpCodes`现在,我们要去.`compare_with_metadump()`运行时间表有218个加上8个选项.`prefix`课程表有219个条目,因为它包括`no.`根据III.2.2,该表从未有过.

工具:ILSpy 11.0 (MIT,发布于2026-08-12) 在macOS上通过其Avalonia桌面构建运行. `ilspycmd`11.1.0.9782 印有IL 的印件`-il`选择一个方法,`-m 0x06000002`. dnSpyEx 6.6.0 仅在Windows上继续 dnSpy.`ildasm`作为 NuGet 包而不是 SDK 内部.`rabin2 -I`,,,`arch cil`其他`class PE32`其他`is`列表`Ledger.Grade(int:score):int`设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的使用方式是: 设置器的设置器的设置器,设置器的设置方式是: 设置器的设置器的设置方式是: 设置器的设置器是: 设置器的设置: 设置器的设置: 设置器是: 设置器.设置器的设置器是: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置: 设置:

## 每个容器所保留的东西

放下`grade`它们来自五个容器,每一行都是来自`python3 code/main.py keeps`通过电路,可通过电路,

| Container | Body bytes | Function name | Parameter names | Parameter and return types | Local names | Line numbers | Control flow |
|---|---|---|---|---|---|---|---|
| ELF object, clang -O0 | 118 | `grade` in `.symtab` | none | none | none | none, no `.debug_*` sections | 5 jumps and 1 indirect jump through a relocation table |
| CPython 3.14 pyc | 96 | `co_qualname` | `score` | none | `bucket` | `co_linetable`, first line 10 | 4 compare and `POP_JUMP_IF_FALSE` pairs |
| JVM class, `javac -g` | 50 | constant pool | `score` in `LocalVariableTable` | `(I)I` | none beyond the parameter | `LineNumberTable`, 6 rows | 1 `tableswitch` |
| WebAssembly | 63 | Export section | only with a name section | `(i32) -> i32` | only with a name section | none | 6 nested blocks, 1 `br_table`, 4 `br` |
| .NET assembly | 45 | `MethodDef` | `score` in `Param` | `static int32(int32)` | none, types only in `StandAloneSig` | none without a PDB | 1 `switch`, 1 `br.s` |

您将看到的解译器结果.`int total(const int *, int)`随着`int total(long param_1, uint param_2)`基德拉从本源代码推断,因为本源代码没有保留这些列. pyc 保存了每个名称,没有类型,其控制流量是跳动,每次发布时的形状都会改变,因此Python 解译器每版本都会破解,并免费恢复名称.一个类文件保存类型和验证的堆,保存名称,当`-g`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`switch`体模块通过构建来保持结构,所以`wasm2wat`网格组件保留最完整的描述,因为元数据表是规范性的,并且仍然需要一个PDB为本地名称.

表告诉你解译器需要使用什么,其输出中的哪些输出复制存储的数据,哪些输出输出.ILSpy输出中的参数名称是复制.同一输出中的本地名称是推断,除非有PDB. 第35课记录了这一差异,作为每个索赔的权威.

## 建立它

运行演示:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
```

输出是一个JSON报告. 每个 pyc 均给出头条,文件和`grade`对于每个类构建,它给出了版本,大小,调试表数,以及`javap`对于每一个体构建,它给出了部分,类型,功能,名称部分内容,以及`wasm-objdump`对于组件,它给出了CLI标题,流,表列数量,方法以及系统.反思.元数据协议.它以保存表和翻译者列表结束.`PATH`现在,我们要去.

阅读`code/main.py`在此顺序:

1. `Reader`保持导向器和整数宽度. `uleb()`其他`sleb()`它们是Warm和NET的LEB128读物.
2. `read_pyc_header()`现在`Unmarshaller`其他`PycFile`读一个PC. `parse_dis_text()`读取被俘的内容`dis`列表,以便在测试时不需要四个解释者进行跨版本比较.
3. `ClassFile`读取类文件`disassemble_jvm()`解码了它的代码.`parse_javap_code()`其他`compare_with_javap()`现在,我们要做什么?
4. `WasmModule`阅读部分,`disassemble_wasm()`解读一个表达式的深度.`compare_with_wasm_objdump()`是神言检查.
5. `CliAssembly`走向PE,CLI标题,元数据根,流和表格. `TABLE_SCHEMAS`其他`CODED_INDEXES`作为数据,II.22和II.24.2.6`disassemble_cil()`解体一个尸体`compare_with_metadump()`检查它.
6. `NativeObject`读到足够的ELF来列出函数符号,并将第33课列为其文本. `what_each_keeps()`其他`figure_data()`建立一个比较.

现在还有五个命令.`python3 code/main.py pyc FILE`现在`class FILE`现在`wasm FILE`其他`dll FILE`打印一个文件中每个函数的结构和列表. `python3 code/main.py compare`编译`ledger.py`随着每一个翻译的开放.`PATH`印出每一个人的书面.

## 用它

按照这个顺序使用读物,在你建造的容器上.

1. 读取第一字节,并命名格式.`0d 0a`是一个 pyc,`ca fe ba be`一个类档案,`00 61 73 6d`一个模块,`4d 5a`设置一个组件,
2. 读取标题,并写下它命名的制作版本.对于一个pyc来说,这是魔术字,对于一个类文件来说是主要版本,对于一个组件来说是运行时间和元数据版本字符串.
3. 在运行之前,请检查您计划运行的每个解译器,
4. 运行读者和格式的工具在同一文件上并将它们排列对比.不匹配是读者中的错误或工具的变化,在列表成为证据之前,必须理解其中一个.
5. 填写您关心的函数的保存表,并标记每个数据为保存或丢失,并命名来自的表,属性或部分.
6. 只有那么才能读取解译器输出, 标记每个名称, 输入它作为一个保存的事实或作为一个推断.

保存 Oracle 文本文件在容器中.当解释器,JDK,SDK或wabt版本发生变化时,重新构建使用 `build_fixtures.sh`并且重新捕获,因为改变的列表是改变的固定.

## 互动实验室

### 实验室A:读取标题,然后读取代码对象

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code
python3 -q
```

运行:

```python
from main import *
pyc = load_pyc("ledger.cpython-311.pyc")
pyc.header.to_dict()
pyc.module.names
pyc.functions()["grade"].varnames
len(pyc.functions()["grade"].code)
```

在第一次电话之前,写下魔术字,然后加载`ledger.cpython-314.pyc`然后把两者比较起来.`code`试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试`import marshal; marshal.loads(pyc.data[16:])`在你的解释器下面的3.11文件上,读取错误.

### 实验室B:恒定池链

```python
cls = load_class("Ledger-g.class")
cls.constant(13)
cls.constant(14)
cls.describe_constant(13)
[row["text"] for row in jvm_listing(cls, "grade")]
```

追随`#13`为了`#8`其他`#14`然后到`Utf8`在您打电话之前,请按手写入`describe_constant`然后加载`Ledger-gnone.class`打电话`cls.method("grade").attribute_names()`两者都在`Code`字符组是相同的,属性却不是.

### 实验室C:深度和标签

```python
module = load_wasm("ledger.wasm")
[(row["depth"], row["text"]) for row in wasm_listing(module, "grade")]
module.function_name(2)
load_wasm("ledger-names.wasm").names["locals"][2]
```

找一个`br_table`起,读出它的深度.`end`按一下列,然后与表中的标签号码相匹配.`ledger.wat`找一个`block $six`这标签有3个名字.

### 实验室D:从代币到字节

```python
asm = load_assembly("LedgerNet.dll")
asm.method("Grade")
body = asm.method_body(asm.method("Grade")["RVA"])
body.fat, body.max_stack, body.code_size, hex(body.local_signature_token)
asm.token_text(0x11000001)
[row["text"] for row in cil_listing(asm, "GradeLabel")]
```

计算RVA的文件偏移`0x2060`其他`.text`按手动将部分标题进行比较`asm.rva_to_offset(0x2060)`然后抬头看`asm.row(0x08, 3)`找出这个名字的地方`score`生命.

## 实践实验室

加入第五个源语言,或第六个事实.

要求:

- 写一个函数,用循环和一个本地变量,在一个语言中编译器,你有,例如 Kotlin 类文件或化到一个模块. 执行输出和预言列表的确切命令在 `build_fixtures.sh`现在,我们要去.
- 让相匹配的读者同意每一个指令的预言.
- 延长时间`what_each_keeps()`对于每一个容器,一个事实:机身是否携带例外表或`try`地区.
- 添加新的容器到`figure_data()`炼和再生`site/figures-re-43.js`现在,我们要去.
- 写一个测试,当读者报告一个事实,没有命名表,属性或部分,

成功意味着`python3 code/main.py keeps`显示了每一个细胞的新行,每个预言的比较都一致.

## 教训艺术品

这一课包括`outputs/skill-bytecode-and-managed-formats.md`通过它将字节码容器转化为标题报告,一个函数的检查列表和一个标记每个名称,类型和结构的数据表.它需要格式的自己的工具作为预言器,在任何解译器之前检查版本,以及每个丢失的数据都会居住在哪里的声明.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

验证应证明:

- 四个pyc标题上有魔术词3495,3531,3571,3627,旗3和8字节的哈希,时间邮票文件上有旗0,mtime 1791975565,和尺寸497
- 每个为3.11和以后的魔术字都在范围中.`2900 + 50n`规则将其释放
- 解散器返回相同的名称,常数,代码字节,变量名称和行表`marshal.loads()`在运行的翻译写的文件上
- 所有四个文件都保留模块名称,`('score', 'bucket')`为了`grade`首条第10条,`ledger.py`作为文件名
- `grade.co_code`在四个版本中,有80,62,70和96字节,并且捕获的列表有31,26,26和35个指令
- 3.11列表有`POP_JUMP_FORWARD_IF_FALSE`其他类型的`RETURN_CONST`其他国家`LOAD_SMALL_INT`现在`LOAD_FAST_BORROW`其他`NOT_TAKEN`
- 其他`-C -O`列表显示了13个缓存输入`grade`五个后面`BINARY_OP`适应性列表显示`COMPARE_OP_INT`
- 没有标题`0d 0a`没有一个代码对象的身体.`FormatError`
- 只有运行解释器编写的 pyc 并且与捕获的文件相匹配的指令列表存在`dis`输出
- 类文件有65或69个主要,大小1581,1832,1404,和1581个,并且常数数组是82,94,79,和82个
- 常数`#13`解决问题`Method Ledger.grade:(I)I`其他`#47`为了`String F`
-  JVM拆卸器同意`javap -c -p`在四个构件中108个指令中的108个
- `tableswitch`在 pc 4 上,有 36 字节,低 6,高 10,默认 48,目标 46, 44, 42, 40, 40
- 三个调试级别改变属性数量,并留下50个代码字节.`grade`相同的
- `ifne`现在`if_icmpge`其他`goto`目标与分支的opcode相对
- 错误的魔法, 后退字节,`FormatError`
- 七个体部分有有效载荷抵消`wasm-objdump -h`印记,和名称构建添加一个`name`定制部分 293至 425
- 类型,`env.log`进口,五出口,以及数据段1024解码`ledger.wat`
- 瓦斯姆拆卸器同意`wasm-objdump -d`在两种结构中的77项指示中,
- `grade`具有6个嵌套块,一个`br_table`标签`4 4 4 4 4 4 3 2 1 0 0`并且默认4在深度6处,`i32`地方
- 函数名称来自出口,没有名称部分,只有当地名称
- 美国`e4 00`现在,`7f`是 -1, `80 08`区块类型的表达为`wasm-objdump`
- 错误的序言,版本2,以及未知的opcode升级`FormatError`
- 装配PE32 机器`0x14c`        `0x2008`运行时间2.5`ILONLY`进入地点`0x06000005`
- 转载数据版本是`v4.0.30319`五个流域存在,14个表格上有排列数量和排列尺寸.
- 网页读者同意246项检查中的246项系统.反射.元数据
- `Grade`有参数`score`签名`static int32(int32)`的头条`MaxStack`两个和45个字节代码,一个`int32`没有名字的本地
- 鱼`switch`目标`br.s`现在`ldsfld`现在`call`其他`ldstr`操作数通过表和堆积分辨
- 运行时间的每个运行时间的运行代码表仅添加了 `no.`
- 保持表报告参数名称在四个容器中,而没有一个本地代码,并在三个类型中
- 演示中的每一个神话行都是 n 的 n
- 互动图像包含相同的数据`figure_data()`产品

## 生产失败模式

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Decompiler older than the interpreter | `Unsupported opcode`, output marked incomplete, or a claim of obfuscation | The magic word, the release it names, and the tool's documented ceiling |
| pyc read with the wrong interpreter | `marshal.loads` raises or returns garbage | Our unmarshaller reads names, constants, and sizes from any 3.9 to 3.15 file, and instructions come from the matching `dis` |
| Specialised opcodes mistaken for the file's content | `COMPARE_OP_INT` in a listing | A pyc holds the unspecialised form, specialisation happens in memory after warm-up |
| Local names reported for a default javac build | `var1`, `var2` presented as source names | `LocalVariableTable` is present only with `-g`, the 50 code bytes are identical either way |
| Branch target off by the instruction length | A JVM listing whose jumps land mid-instruction | Offsets relative to the branch opcode, checked against `javap` |
| Switch padding skipped | A `tableswitch` with a wrong default and shifted cases | Zero to three padding bytes to a 4-aligned pc, 36 bytes for five cases |
| Wasm names assumed stripped | "no symbols" | Exports name every exported function, locals need the `name` section, `wasm-strip` removes only that section |
| Three tools, three spellings | `get_local` versus `local.get`, a function at `0x8b` versus `0x8e` | Same bytes, and the listing that the comparison was captured with |
| Table row size guessed | Every row after the first table misread | Row sizes from `HeapSizes`, row counts, and coded index widths, equal to the oracle's |
| Local names expected in a release assembly | `V_0` presented as the source name | Locals have types in `StandAloneSig` and names only in a PDB that `DebugType` none did not write |
| Reader guesses an unknown opcode or type code | A plausible mnemonic | `FormatError` with the offset, and the oracle comparison stops there |
| Oracle captured from another build | Tests pass on stale text | `build_fixtures.sh` names every tool version and writes `versions.txt` and `sha256.txt` |

## 运营规则

首先阅读标题,并命名它指向的生产者. 阅读容器与一个读者拒绝不知道的内容,并检查其列表与格式的工具在同一文件. 然后说,对于每一个名字和类型在解译器的输出,无论容器存储它还是工具推断它.

## 进一步阅读

- [PEP 552: Deterministic pycs](https://peps.python.org/pep-0552/)
- [CPython `Include/internal/pycore_magic_number.h`](https://github.com/python/cpython/blob/main/Include/internal/pycore_magic_number.h)
- [Python `marshal` module documentation](https://docs.python.org/3/library/marshal.html)
- [CPython `Python/marshal.c`](https://github.com/python/cpython/blob/main/Python/marshal.c)
- [Python 3.14 `dis` module documentation](https://docs.python.org/3.14/library/dis.html)
- [PEP 659: Specializing Adaptive Interpreter](https://peps.python.org/pep-0659/)
- [PEP 626: Precise line numbers for debugging and other tools](https://peps.python.org/pep-0626/)
- [PEP 790: Python 3.15 Release Schedule](https://peps.python.org/pep-0790/)
- [uncompyle6 on PyPI](https://pypi.org/project/uncompyle6/)现在[decompyle3 on PyPI](https://pypi.org/project/decompyle3/)现在[xdis on PyPI](https://pypi.org/project/xdis/)现在[pycdc on GitHub](https://github.com/zrax/pycdc)现在[PyLingual on GitHub](https://github.com/syssec-utd/pylingual)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 4: The class File Format](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-4.html)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 6: The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-6.html)
- [javac manual, Java SE 25](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html)其他[javap manual](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html)
- [CFR](https://www.benf.org/other/cfr/)现在[Procyon](https://github.com/mstrobel/procyon)现在[Vineflower](https://github.com/Vineflower/vineflower)现在[Fernflower in intellij-community](https://github.com/JetBrains/intellij-community/tree/master/plugins/java-decompiler/engine)现在[JADX](https://github.com/skylot/jadx)
- [Harrand, Soto-Valero, Monperrus, Baudry, "Java Decompiler Diversity and its Application to Meta-decompilation" (JSS 2020)](https://arxiv.org/abs/2005.11315)
- [ECMA-335, Common Language Infrastructure, 6th edition (June 2012)](https://ecma-international.org/publications-and-standards/standards/ecma-335/)
- [PE Format, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [System.Reflection.Metadata.Ecma335.TableIndex](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.metadata.ecma335.tableindex)
- [ILSpy on GitHub](https://github.com/icsharpcode/ILSpy)现在[ilspycmd on NuGet](https://www.nuget.org/packages/ilspycmd)现在[dnSpyEx on GitHub](https://github.com/dnSpyEx/dnSpy)
- [WebAssembly Core Specification: Binary Format, Modules](https://webassembly.github.io/spec/core/binary/modules.html)其他[Values](https://webassembly.github.io/spec/core/binary/values.html)
- [WebAssembly Core Specification: Custom Sections (name section)](https://webassembly.github.io/spec/core/appendix/custom.html)
- [WebAssembly tool-conventions: Debugging](https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md)
- [wabt 1.0.42 release notes](https://github.com/WebAssembly/wabt/releases/tag/1.0.42)现在[wasm-tools](https://github.com/bytecodealliance/wasm-tools)现在[Binaryen](https://github.com/WebAssembly/binaryen)现在[ghidra-wasm-plugin](https://github.com/nneonneo/ghidra-wasm-plugin)
- [radare2 on GitHub](https://github.com/radareorg/radare2)根据本课程的源头构建的版本6.2.4
