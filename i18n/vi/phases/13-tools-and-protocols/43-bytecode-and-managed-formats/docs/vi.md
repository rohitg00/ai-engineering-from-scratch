# Ngoài mã bản địa: Python, JVM, .NET và WebAssembly Bytecode

> Một tập tin bytecode là một chương trình cộng với các ghi chú của trình biên dịch về nó, và bài học này xây dựng các độc giả cho thấy những ghi chú mỗi container giữ.

**Type:** Build
**Languages:** Python, TypeScript, Java, C#, WebAssembly text
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow)
**Time:** ~150 minutes

## Mục tiêu học tập

- Đọc 16byte `.pyc`tiêu đề từ PEP 552 và không tham khảo đối tượng mã mà không có `marshal`module, cho các tệp được viết bởi bốn phiên bản phiên dịch.
- Phân tích một tệp lớp JVM từ JVMS Chương 4: nhóm liên tục, trường, phương pháp, các `Code`thuộc tính, và các bảng mà `javac -g`thêm vào.
- Phong cách các mã opcode JVM trong `Ledger.class`và chứng minh danh sách chống lại `javap -c`trên bốn cột của cùng một nguồn.
- Đọc một phần mô-đun WebAssembly theo phần, giải mã từng cơ quan chức năng, và chứng minh kết quả chống lại `wasm-objdump -d`- Tôi không biết.
- Đi bộ các siêu dữ liệu ECMA-335 của một bộ sưu tập .NET từ thư mục dữ liệu PE đến `MethodDef`hàng và CIL của mỗi phương pháp, kiểm tra với thư viện đọc mà ILSpy sử dụng.
- Đo, cho một chức năng trong năm thùng, tên, loại và cấu trúc điều khiển của mỗi định dạng giữ và mất.

## Vấn đề

Anh xây dựng`ledger.py`và tìm thấy`ledger.cpython-314.pyc`trong `__pycache__`Ông hỏi một nhân viên có chứa gì trong hồ sơ, nhân viên đã chạy một máy phân tích.`Unsupported opcode`và một dòng nói`# WARNING: Decompyle incomplete`Cảnh sát kết luận rằng hồ sơ đã bị mờ.

Dữ liệu không bị mờ.`2b 0e`, từ 3627. Đó là số CPython 3.14 viết, và các bảng mã opcode của decompiler dừng ở 3.13. Công cụ đã lỗi thời.

Bài học 33 cho thấy mã bản địa mất đi những gì: tên tham số, loại và các `switch`Nó trở thành một bàn nhảy. Các container bytecode mất ít hơn, và mỗi container mất một thứ gì đó khác nhau. Một pyc giữ tất cả các tên biến và không có loại. Một tập tin lớp lưu trữ các loại và lưu trữ tên địa phương chỉ khi bạn hỏi. Một mô-đun Wasm giữ cấu trúc điều khiển và bỏ tên trừ khi một phần tùy chỉnh mang chúng. Một tập hợp .NET giữ tên tham số trong một bảng và để lại tên địa phương cho một tệp riêng biệt. Bạn không thể đánh giá kết quả của một máy phân tích trên bất kỳ chúng cho đến khi bạn biết những ghi chú mà container bắt đầu với.

Bài học này xây dựng bốn bộ đọc trong thư viện tiêu chuẩn Python. Mỗi một bộ đọc container từ byte đầu tiên của nó, liệt kê một chức năng, và được kiểm tra so với công cụ của định dạng riêng trên các thiết bị bạn đã xây dựng. Phần cuối cùng đặt `grade`từ `ledger`bên cạnh nhau trong tất cả năm thùng.

```figure
re-43-five-containers
```

## PYC Header là bốn từ

PEP 552 định nghĩa tiêu đề là bốn từ 32 bit. thứ nhất là số phép thuật. thứ hai là một bit trường. Bit 0 set có nghĩa là tập tin dựa trên hash. Bit 1 set có nghĩa là `check_source`: người giải thích hash nguồn khi nhập và so sánh. với bit 0 rõ ràng, từ 3 và 4 là mtime nguồn và kích thước nguồn. với bit 0 set, chúng chứa một SipHash 64-bit của nguồn.

Số ma thuật sống trong `Include/internal/pycore_magic_number.h`Quy tắc của nó từ 3.11 là Python 3.n bắt đầu ở 2900 + 50n, và mỗi thay đổi bytecode trong một chu kỳ phát hành thêm một.`\r\n`Python 3.15.0 được phát hành vào năm 2026-10-09 và không được cài đặt trên máy tính đã xây dựng các thiết bị này, vì vậy số của nó đến từ tệp tiêu đề và không từ tệp ở đây.

Các thiết bị có chứa hai tập tin pyc cho mỗi phiên dịch. `compile_pyc.py`viết chúng với `py_compile.compile(..., dfile="ledger.py")`để tên tập tin được lưu trữ là `ledger.py`16 byte đầu tiên của các tập tin 3.14:

```text
checked-hash   2b 0e 0d 0a  03 00 00 00  c7 16 c7 fc c5 1d 81 01
timestamp      2b 0e 0d 0a  00 00 00 00  8d 60 cf 6a  f1 01 00 00
```

Đọc tiêu đề dấu thời gian từ từ. `03 00 00 00`hoặc `00 00 00 00`là từ cờ.`8d 60 cf 6a`là 0x6acf608d = 1791975565, mtime của `ledger.py`khi tập tin được xây dựng. `f1 01 00 00`là 497, kích thước nguồn. tệp hash được kiểm tra có cờ 3 và tám byte hash thay vào đó. bốn người giải thích đồng ý về mọi thứ trong tiêu đề ngoại trừ từ phép thuật:

| Interpreter | Magic bytes | Word | File bytes | `grade.co_code` bytes | `grade` instructions |
|---|---|---|---|---|---|
| 3.11.14 | `a7 0d 0d 0a` | 3495 | 1054 | 80 | 31 |
| 3.12.12 | `cb 0d 0d 0a` | 3531 | 937 | 62 | 26 |
| 3.13.12 | `f3 0d 0d 0a` | 3571 | 943 | 70 | 26 |
| 3.14.6 | `2b 0e 0d 0a` | 3627 | 965 | 96 | 35 |

`read_pyc_header()`trong `code/main.py`trả lại các trường này và đặt tên cho phiên bản từ từ. `importlib.util.MAGIC_NUMBER`cho cùng bốn byte cho người dịch đang chạy. `python3 code/main.py compare`biên soạn nguồn với mỗi `python3.11`đến`python3.15`được tìm thấy trên `PATH`Đối với mỗi người nó in tiêu đề người đọc của chúng tôi thấy bên cạnh các sự thật mà người diễn giải báo cáo về chính mình.

## Marshal viết Code Object Field theo Field

Byte 16 của mỗi thiết bị là `e3`- Đó là `0x80 | ord('c')`: mã kiểu marshal cho một đối tượng mã với `FLAG_REF`set, nói với người đọc để nhớ đối tượng cho sau `r`Các tài liệu Marshall nói rằng định dạng không được ghi chép một cách cố ý và các đối tượng mã không tương thích giữa các phiên bản. Cả hai tuyên bố đều đúng, và định dạng vẫn đủ nhỏ để đọc. `Python/marshal.c`liệt kê các mã loại: `N`Không có ai cả.`i`một int 32 bit, `s`byte, `z`và `Z`Dòng ASCII ngắn, `(`và `)`Túp, `c`một đối tượng mã, `r`Container đặt chỗ tham chiếu trước con cái của họ, để người đọc cũng làm như vậy.

`w_complex_object()`viết một object code theo thứ tự cố định. cho 3.11 đến 3.15 nó là `argcount`- `posonlyargcount`- `kwonlyargcount`- `stacksize`- `flags`như 32 bit inch, sau đó `code`- `consts`- `names`- `localsplusnames`- `localspluskinds`- `filename`- `name`- `qualname`như các đối tượng, thì `firstlineno`, sau đó `linetable`và `exceptiontable`. Khóa mã mã module đối tượng của tập tin 3.14 bằng tay từ byte 17:

```text
00 00 00 00   argcount 0
00 00 00 00   posonlyargcount 0
00 00 00 00   kwonlyargcount 0
01 00 00 00   stacksize 1
00 00 00 00   flags 0
f3 22 00 00 00   type 's' with FLAG_REF, 34 bytes of co_code follow
80 00  52 06  74 00  52 01  17 00  74 01 ...
```

Các byte mã là hai cho mỗi lệnh: `80 00`là `RESUME 0`- `52 06`là `LOAD_CONST 6`- `74 00`là `STORE_NAME 0`, và`17 00`là `MAKE_FUNCTION`. Dấu hiệu 3.14 trong các thiết bị in cùng năm tuyên bố cấp mô-đun.`code`đến các định vị, giữ bốn vật có mã đốn, và sau đó chúng `names``('LABELS', 'percent_change', 'grade', 'total', 'grade_label')`- Tôi không biết.

`Unmarshaller`trong `code/main.py`đọc bố cục này và cũ hơn mà 3.9 và 3.10 sử dụng, nơi `nlocals`- `varnames`- `freevars`, và`cellvars`là các cánh đồng riêng biệt.`CodeObject`với các tên thuộc tính giống nhau đối tượng thực có. `varnames`bộ lọc `localsplusnames`bởi `CO_FAST_LOCAL`Một chút `localspluskinds`- Vì `grade`trong mỗi 4 tập tin nó trả lại `('score', 'bucket')`- `firstlineno`10, và một không trống `linetable`- Thử nghiệm`test_unmarshaller_agrees_with_the_running_interpreter`so sánh mọi lĩnh vực với `marshal.loads()`3 tập tin khác có thể đọc được bằng mã của chúng tôi và không thể đọc được bởi chúng tôi.`marshal`dưới sự giải thích của người diễn giải này.

## Bốn người diễn giải, bốn Bytecode cho lớp

Các tài liệu này có một cảnh báo trên mỗi phiên bản: bytecode là một chi tiết thực hiện của CPython và không có đảm bảo rằng nó sẽ vẫn giống nhau.`python3.1N -m dis ledger.py`được bắt giữ cho mỗi người phiên dịch.

Trong 3.11 `grade`bắt đầu như thế này:

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

`BINARY_OP`nằm ở ofset 6 và hướng dẫn tiếp theo ở 10. Hai byte giữa chúng là một mục cache trong đường từ PEP 659, phiên dịch viên thích ứng chuyên ngành. `COMPARE_OP`16 được tiếp theo bởi 22, vì vậy nó sở hữu hai mục cache.`show_caches=True`3.12 thay thế `LOAD_CONST`+`RETURN_VALUE`với `RETURN_CONST`, đổi tên nhảy thành `POP_JUMP_IF_FALSE`, và giảm bớt `grade`từ 80 đến 62 byte. 3.13 in nhãn `L1`đến`L4`thay vì bù đắp và cho CLI `-C`cho kho lưu trữ và `-O`cho các khoản bù đắp. 3.14 loại bỏ `RETURN_CONST`một lần nữa, thêm `LOAD_SMALL_INT`và `LOAD_FAST_BORROW`, và các mục nhập `NOT_TAKEN`sau mỗi nhảy có điều kiện:

```text
 12         20       LOAD_FAST_BORROW         1 (bucket)
            22       LOAD_SMALL_INT           9
            24       COMPARE_OP             188 (bool(>=))
            26       CACHE                    0 (counter: 0)
            28       POP_JUMP_IF_FALSE        3 (to L1)
            30       CACHE                    0 (counter: 0)
            32       NOT_TAKEN
```

- `-C -O`danh sách cho thấy 13 `CACHE`Đăng nhập bên trong `grade`: 5 sau`BINARY_OP`, một sau mỗi người `COMPARE_OP`, một sau mỗi người `POP_JUMP_IF_FALSE`- Cỗ máy điều chỉnh cho thấy bộ nhớ cache là gì.`dis.dis(grade, adaptive=True)`dấu vân tay`RESUME_CHECK`và `COMPARE_OP_INT`nơi danh sách đơn giản đã có `RESUME`và `COMPARE_OP`, và`total`cho thấy`FOR_ITER_LIST`- `BINARY_OP_ADD_INT`, và`JUMP_BACKWARD_NO_JIT`Các hình thức chuyên môn sống trong cùng một`co_code`một pyc không bao giờ chứa chúng, bởi vì chuyên môn hóa xảy ra trong bộ nhớ.

Đây là lý do tại sao các máy giải trình có giới hạn phiên bản. uncompyle6 3.9.3 nói rằng nó chấp nhận bytecode từ Python 1.0 đến 3.8. decompyle3 3.9.3 đọc 3.7 và 3.8. xdis 6.3.0, trình giải trình phiên bản chéo đằng sau cả hai, đọc lên đến 3.13. pycdc có các bảng opcode lên đến `python_3_13.cpp`trong file build của nó, và trên một bản in opcode không rõ `Unsupported opcode`PyLingual tuyên bố mọi phiên bản được phát hành kể từ 3.6 và sử dụng các phiên dịch viên từ 3.8 đến 3.15 để biên soạn lại và kiểm tra đầu ra của riêng nó. Đối với một tệp 3.14, ba tệp đầu tiên từ chối hoặc thất bại, và chỉ hai tệp cuối cùng áp dụng.

## Các tập tin lớp giữ một từ điển riêng

JVMS Java SE 25, phần 4.1, đưa ra bố cục như một cấu trúc: `magic`- `minor_version`- `major_version`- `constant_pool_count`, hồ bơi liên tục,`access_flags`- `this_class`- `super_class`, giao diện, trường, phương pháp, thuộc tính.`0xCAFEBABE`Một máy ảo Java SE 25 chấp nhận các phiên bản lớn 45 đến 69, và một phiên bản nhỏ của 65535 đánh dấu một tệp tính năng xem trước.`Ledger-g.class`là `ca fe ba be 00 00 00 41 00 5e`: chính 65 là Java 21, và `0x5e`= 94 là số lượng hồ bơi liên tục. `Ledger-jdk25.class`, được xây dựng bởi javac 25.0.2 từ cùng một nguồn, bắt đầu `ca fe ba be 00 00 00 45`Tầm 69

Các hồ sơ lớp lưu trữ từ điển của riêng mình.`#13`trong `-g`xây dựng là một `Methodref`- Đúng vậy.`#8`và tên và loại `#14`Theo các chỉ số cho ra`Ledger.grade:(I)I`, đó chính xác là gì `javap -v`dấu vân tay sau `//`- Tác giả`(I)I`là một `int`tham số và một `int`Kết quả.`([I)I``total`nói tham số là một `int`array. Mỗi phương pháp, trường và lớp mà mã chạm có một mục như vậy, và người xác minh trong phần 4.10 từ chối một tệp có hướng dẫn không đồng ý với chúng.`ClassFile`lớp trong `code/main.py`đọc tất cả 17 thẻ liên tục từ bảng 4.4 và xử lý `Long`hoặc `Double`Nó tăng lên trên một thẻ không rõ và trên byte sau thuộc tính cuối cùng.

Các thuộc tính đính kèm với lớp, mỗi trường, mỗi phương pháp, và `Code`JVMS nói rằng máy ảo phải bỏ qua các thuộc tính mà nó không biết, đó là lý do tại sao các bảng gỡ lỗi có thể được thêm hoặc bỏ ra mà không thay đổi một bộ phận phương pháp.`-g`tạo ra tất cả thông tin gỡ lỗi bao gồm các biến địa phương, rằng mặc định tạo ra số đường và tệp nguồn chỉ, và rằng `-g:none`3 tạo ra một số lượng:

| Build | Bytes | Constant pool count | `LineNumberTable` | `LocalVariableTable` | `SourceFile` | `grade` code bytes |
|---|---|---|---|---|---|---|
| `javac -g` | 1832 | 94 | 7 methods | 6 methods | yes | 50 |
| `javac` | 1581 | 82 | 7 methods | none | yes | 50 |
| `javac -g:none` | 1404 | 79 | none | none | no | 50 |

50 byte mã của `grade`là giống nhau trong cả ba tập tin, và kiểm tra kiểm tra nó.`-g`thêm cho `grade`là một `LocalVariableTable`hàng: bắt đầu 0, chiều dài 50, khe 0, tên `score`, mô tả `I`Không có nó, máy giải trình sẽ thấy khe 0 kiểu`int`Và phải phát minh ra một cái tên.`StackMapTable`ở trong mọi cấu trúc bởi vì người xác minh cần nó, và `BootstrapMethods`thuộc tính vẫn còn vì `main`kết nối dây thông qua `invokedynamic`- Tôi không biết.

## Tự động giải mã bàn

Chương 6 của JVMS định nghĩa mỗi hướng dẫn là một byte opcode và các operand mà opcode đặt tên. Branch offsets là các giá trị ký 16 bit liên quan đến địa chỉ của branch opcode, khác với x86-64, nơi sự di chuyển tương quan với hướng dẫn tiếp theo. `tableswitch`và `lookupswitch`bắt đầu với 0 đến 3 byte để các operand 32 bit của chúng bắt đầu từ địa chỉ là nhiều của bốn.

Các byte của `grade`từ máy tính 4 trong `Ledger-g.class`- Có thể là:

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

36 byte, một hướng dẫn, và toàn bộ `switch (score / 10)`với trường hợp chung của nó cho 9 và 10.`switch`trong bài học 33 cần kiểm tra giới hạn, một `lea`, một `movslq`, một `add`Đây là mục tiêu trong hướng dẫn, và cũng là thực tế là họ thuộc về nhau.

`disassemble_jvm()`bao gồm tất cả 202 mã opcode được xác định với chiều rộng của chúng, tuân thủ quy tắc đệm, và làm cho các operands theo cách `javap``compare_with_javap()`Phân tích những kẻ bị bắt `javap -c -p`văn bản, bao gồm cả nhiều dòng `tableswitch`Các bộ phận này được kiểm tra và kiểm tra các hướng dẫn của các bộ phận này.`test_branch_offsets_are_relative_to_the_branch_instruction`kiểm tra`ifne`tại pc 1 hạ cánh trên 6, `if_icmpge`ở 13 khi hạ cánh trên 33, và `goto`ở 30 hạ cánh trở lại trên 10.

radar2 6.2.4, được xây dựng từ nguồn cho các bài học này, đọc cùng một tập tin. `rabin2 -I`báo cáo `arch java`- `lang java 21`- `linenum true`, và`lsyms true`, là việc đọc của phiên bản và hai bảng debug. `pd 14 @ sym.Ledger.grade`in `tableswitch`Nó cũng có dấu ấn.`Unable to parse code attribute: 2`trong tập tin này, đó là một hạn chế của công cụ tự đặt tên và một lý do để giữ `javap`như lời tiên tri. Các trình phân tích cho định dạng này đã trưởng thành khi so sánh với Python. CFR 0.152 được MIT cấp phép. Procyon 0.6.0 và Vineflower 1.12.0 là Apache-2.0, và Vineflower là một chiếc cành Fernflower với hỗ trợ Java 21. Fernflower sống trong kho lưu trữ của cộng đồng IntelliJ. JADX 1.5.6 bao gồm định dạng Android DEX, và JD-GUI đã được phát hành lần cuối vào năm 2019. Harrand, Soto-Valero, Monperrus và Baudry đo tám trong số đó vào năm 2020. Kết quả kết quả đúng cách tổng hợp tốt nhất cho 84 phần trăm các lớp và tương đương về ngữ nghĩa cho 78 phần trăm. Meta-decompiler của họ đã phục hồi 37,6% các lớp mà không có công cụ nào xử lý. Các loại, tên và các đống xác minh làm cho định dạng có thể được giải thể. Chúng không làm cho bất kỳ decompiler nào hoàn thành.

## Một mô-đun đống là một danh sách các phần

Các đặc điểm cốt lõi xác định một mô-đun như tiền đề `00 61 73 6d 01 00 00 00`, dây `\0asm`và phiên bản 1, sau đó là các phần.`u32`ID 1 đến 13 là các phần được biết đến, mỗi lần tối đa và theo thứ tự. ID 0 là một phần tùy chỉnh với một tên, được phép ở bất cứ nơi nào. Tất cả các số nguyên là LEB128, vì vậy `e4 00`là 100 và `80 08`là 1024.`wasm-objdump -h``ledger.wasm`liệt kê bảy phần, và `WasmModule`tìm thấy cùng bảy với cùng một tải trọng bù đắp:

| Section | Payload | Count | What it holds for ledger |
|---|---|---|---|
| Type | 10 to 26 | 3 | `(i32) -> nil`, `(i32, i32) -> i32`, `(i32) -> i32` |
| Import | 28 to 39 | 1 | `env.log` with type 0 |
| Function | 41 to 46 | 4 | type index for each defined function |
| Memory | 48 to 51 | 1 | one page, no maximum |
| Export | 53 to 110 | 5 | `memory` and the four function names |
| Code | 113 to 271 | 4 | bodies of 23, 63, 44, and 23 bytes |
| Data | 273 to 290 | 1 | `F\0D\0C\0B\0A\0` at offset 1024 |

Sự phân chia giữa các phần chức năng và mã tồn tại để trình duyệt có thể bắt đầu biên soạn trước khi toàn bộ tập tin đến. Mỗi mục mã là một kích thước, một vector của các tuyên bố địa phương và một biểu thức.`grade`phương tiện địa phương là `01 7f`: một nhóm một `i32`- Đó là `bucket`, với loại hình của nó và không có tên của nó.

Các quy trình kiểm soát được cấu trúc bởi xây dựng.`block`- `loop`, hoặc`if`Các nhãn được chỉ mục theo độ sâu tổ. `br_table`thực hiện một nhánh gián tiếp thông qua một operand chỉ mục danh sách nhãn.`grade`trong file offset `0xa3`- Có thể là:

```text
0e                  br_table
0b                  11 labels follow
04 04 04 04 04 04   buckets 0 to 5: label 4, the outermost block, returns 0
03 02 01 00         buckets 6, 7, 8, 9: labels 3, 2, 1, 0
00                  bucket 10: label 0, shared with 9
04                  default label 4
```

Mỗi nhãn là độ sâu. Label 0 là nội tâm nhất `block`, và mã sau nó `end`là `i32.const 4`tiếp theo là `br 4`- 6`block`hướng dẫn trước bàn, mười một nhãn, và năm `br`chỉ dẫn sau khi nó là toàn bộ `switch`, và một người xác nhận từ chối bất kỳ nhánh nào rời khỏi cấu trúc. `disassemble_wasm()`theo dõi độ sâu để các đoạn liệt kê như `wasm-objdump`, bao gồm mỗi mã op-code một-byte từ `unreachable`đến`i64.extend32_s`, và phù hợp với những người bị bắt giữ `wasm-objdump -d`trên 77 trong số 77 hướng dẫn cho cả hai tòa nhà.

Tên là thứ duy nhất mà một mô-đun đơn giản rơi xuống.`wasm-objdump`dấu ấn vẫn còn`<grade>`vì phần xuất bản bản đồ chuỗi đó để hàm chỉ số 2, và người đọc làm tương tự. Tên địa phương không tồn tại ở đâu trong tệp 290-byte. `wat2wasm --debug-names`thêm một phần tùy chỉnh có tên `name`với các phần phụ cho tên module, tên chức năng, và tên địa phương.`{0: 'score', 1: 'bucket'}`cho hàm 2 và `{0: 'values', 1: 'count', 2: 'sum', 3: 'i'}`cho hàm 3. `wasm-strip`Dòng lưu trữ các công cụ-thông ước mô tả hai nhà cung cấp hơn. DWARF có thể được nhúng như `.debug_*`Các phần tùy chỉnh.`sourceMappingURL`phần tùy chỉnh có thể chỉ vào một bản đồ nguồn có số cột là thay đổi byte vào bộ nhị phân.

Công cụ được di chuyển trong năm 2026.`wasm-decompile`, và Homebrew xây dựng trên máy này có chính xác 11 công cụ còn lại. Wasm-tools 1.261.0 cung cấp`print`- `objdump`, và`demangle`. Binaryen version_133 cung cấp `wasm-dis`. radar2 6.2.4 cũng đọc mô-đun.`rabin2 -I`nói `arch wasm`Nó là biểu tượng của`grade`bắt đầu từ `0x8e`, nơi các phương tiện địa phương bắt đầu, trong khi `wasm-objdump`nhãn chức năng tại `0x8b`, nơi mà trường kích thước của nó bắt đầu.`get_local`- `set_local`, và`brtable 11 4 4 ...`Với số lượng nhãn được in. Các byte là giống nhau trong cả ba công cụ và đánh vần khác nhau, vì vậy một so sánh phải đặt tên công cụ mà nó đã được chụp. Nghiên cứu cho bài học này không tìm thấy mô-đun bộ xử lý WebAssembly trong thư mục bộ xử lý của Ghidra, và danh sách đó không được đọc đầy đủ. Các bên thứ ba ghidra-wasm plugin v2.4.0 nhắm mục tiêu Ghidra 12.0. Bản thân thông số kỹ thuật là một tài liệu sống. Trang W3C cho `wasm-core-2`là một dự thảo khuyến nghị ứng cử viên ngày 13 tháng 10 năm 2026 có bản tóm tắt mô tả phiên bản 3.0, và dự thảo của biên tập viên có cùng ngày.

## ECMA-335 Metadata là cơ sở dữ liệu của chương trình

Một tập hợp .NET là một tập tin PE. `LedgerNet.dll`bắt đầu với `MZ`, có ba phần được đặt tên `.text`- `.rsrc`, và`.reloc`, và tuyên bố máy tính `0x14c`vì trình biên dịch đã phát ra mã trung lập nền tảng. thư mục dữ liệu 14 của tiêu đề tùy chọn, CLR Runtime Header, chỉ ra RVA `0x2008`ECMA-335 II.25.3.3 xác định 72 byte ở đó:

```text
48 00 00 00   Cb 72
02 00 05 00   MajorRuntimeVersion 2, MinorRuntimeVersion 5
78 21 00 00   MetaData RVA 0x2178
84 07 00 00   MetaData size 1924
01 00 00 00   Flags: COMIMAGE_FLAGS_ILONLY
05 00 00 06   EntryPointToken 0x06000005, MethodDef row 5, which is Main
```

Các metadata gốc tại RVA `0x2178`bắt đầu bằng chữ ký `42 53 4a 42`, có đoạn `BSJB`, sau đó là phiên bản 1.1 và chuỗi `v4.0.30319`5 bộ tiêu đề dòng chảy theo:`#~`trong sự bù đắp`0x6c`, sau đó `#Strings`- `#US`- `#GUID`, và`#Blob`II.24.2 nói mỗi loại dòng chảy xảy ra tối đa một lần.`#~`dòng bắt đầu với một `HeapSizes`Byte, 0 ở đây, vì vậy mỗi chuỗi, GUID, và chỉ số blob là hai byte rộng, và một 64-bit `Valid`mặt nạ đặt tên cho các bảng hiện tại.

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

Một kích thước hàng không được lưu trữ ở bất cứ đâu. II.22 cho mỗi cột một loại, và II.24.2.6 cho quy tắc kích thước.`HeapSizes`. Một chỉ số bảng đơn giản là hai byte trong khi bảng đó có ít hơn 65536 hàng. Một chỉ số mã hóa có thể chỉ ra vào n bảng với b thẻ bit là hai byte trong khi mỗi bảng đó có ít hơn 2 ^ 16-b) hàng. `CliAssembly`tính toán các kích thước 14 hàng từ các quy tắc này và số lượng hàng. Hệ thống.Tình phản xạ.Thả dữ liệu mét trong các thiết bị báo cáo cùng một kích thước và các trục trục trục cùng nhau, đó là cách kiểm tra chứng minh toán học.

III.1.9 xác định biểu tượng: byte cao là bảng, ba byte thấp là hàng dựa trên 1. `0x06000002`là `MethodDef`hàng 2. Đường đó có RVA `0x2060`, tên `Grade`, và một vết signature `00 01 08 08`: thông tin gọi mặc định, một tham số, trả lại `int32`, tham số `int32`- Nó là `ParamList`điểm ở hàng 3 của `Param`, tên của ông là `score`- Bảng Param là lý do tại sao ILSpy có thể in`Grade(int score)`từ một bộ phận phát hành bị tước đi.`0x2060`Cơ thể phương pháp bắt đầu với một tiêu đề mỡ:

```text
13 30         flags 0x13: fat, init locals; size 3 dwords
02 00         MaxStack 2
2d 00 00 00   CodeSize 45
01 00 00 11   LocalVarSigTok 0x11000001
```

`StandAloneSig`hàng 1 giữ `07 01 08``LOCAL_SIG`, một người địa phương, `int32`. Local có một loại và không có tên. ECMA-335 giữ tên địa phương trong định dạng chuyển đổi lỗi của Partition V, và .NET SDK viết chúng vào một PDB.`DebugType`Không có, vì vậy không có bảng và không có tệp mang tên `bucket`- `PercentChange`có một tiêu đề nhỏ thay vào đó: byte đầu tiên của nó `3a`là `0x0e << 2 | 2`, một cơ thể 14 byte mà không có người dân địa phương và một đống mặc định của 8.

45 byte mã của `Grade`giải mã với bảng opcode Partition III. `switch`là opcode `0x45`tiếp theo là `u32`đếm và nhiều như vậy `int32`Mục tiêu liên quan đến hướng dẫn sau bảng:

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

Bộ biên dịch đã trừ 6 trước khi `switch`, vậy là trường hợp 6 là mục tiêu đầu tiên.`disassemble_cil()`render token qua các bảng: `ldsfld Labels`- `call Grade`- `call System.Console::WriteLine`, và`ldstr ' '`từ `#US`Lời tiên tri cho tất cả những điều này là`MetaDump`, một chương trình C# ngắn trong các thiết bị được xây dựng trên `System.Reflection.Metadata`Nó in số lượng hàng, kích thước và trục xuất của mỗi bảng, RVA của mỗi phương pháp, chữ ký, tên tham số, và byte IL, và 226 trường của `System.Reflection.Emit.OpCodes`- `compare_with_metadump()`đồng ý với tất cả 246 kiểm tra. bảng runtime có 218 mã opcode cộng với tám .`prefix`bảng bài học có 219 mục vì nó bao gồm:`no.`từ III.2.2, mà bảng Emit chưa bao giờ có.

Công cụ cho định dạng: ILSpy 11.0 (MIT, phát hành năm 2026-08-12) chạy trên macOS thông qua phiên bản máy tính để bàn Avalonia của nó. `ilspycmd`11.1.0.9782 in IL với `-il`và chọn một phương pháp theo token với `-m 0x06000002`. dnSpyEx 6.6.0 tiếp tục dnSpy chỉ trên Windows.`ildasm`các tàu như các gói NuGet thay vì bên trong SDK. radar2 6.2.4 cũng đọc các metadata: `rabin2 -I`nói `arch cil`và `class PE32`, và`is`danh sách `Ledger.Grade(int:score):int`Nó không có bộ giải thể CIL trong xây dựng này. Thiết bị này được xây dựng với .NET SDK 8.0.205 bởi vì đó là SDK được cài đặt trên máy xây dựng. .NET 10 đã hiện hành từ năm 2025-11-11 và viết các cấu trúc ECMA-335 tương tự.

## Những gì mỗi thùng chứa giữ

Đặt`grade`từ tất cả 5 thùng chứa trong một bàn.`python3 code/main.py keeps`, chạy bộ đọc trên các thiết bị:

| Container | Body bytes | Function name | Parameter names | Parameter and return types | Local names | Line numbers | Control flow |
|---|---|---|---|---|---|---|---|
| ELF object, clang -O0 | 118 | `grade` in `.symtab` | none | none | none | none, no `.debug_*` sections | 5 jumps and 1 indirect jump through a relocation table |
| CPython 3.14 pyc | 96 | `co_qualname` | `score` | none | `bucket` | `co_linetable`, first line 10 | 4 compare and `POP_JUMP_IF_FALSE` pairs |
| JVM class, `javac -g` | 50 | constant pool | `score` in `LocalVariableTable` | `(I)I` | none beyond the parameter | `LineNumberTable`, 6 rows | 1 `tableswitch` |
| WebAssembly | 63 | Export section | only with a name section | `(i32) -> i32` | only with a name section | none | 6 nested blocks, 1 `br_table`, 4 `br` |
| .NET assembly | 45 | `MethodDef` | `score` in `Param` | `static int32(int32)` | none, types only in `StandAloneSig` | none without a PDB | 1 `switch`, 1 `br.s` |

Bảng giải thích kết quả phân tích mà bạn sẽ thấy. Bài học 34 so sánh `int total(const int *, int)`với `int total(long param_1, uint param_2)`Ghidra suy luận từ mã bản địa, bởi vì mã bản địa không giữ bất kỳ cột nào trong số này. Một pyc giữ mọi tên và không có loại, và dòng điều khiển của nó là nhảy có hình dạng thay đổi mỗi phát hành, do đó trình giải trình Python phá vỡ mỗi phiên bản và phục hồi tên miễn phí.`-g`là trên, và thể hiện `switch`Một mô-đun Wasm giữ cấu trúc bằng cách xây dựng, vì vậy `wasm2wat`là một chuyến đi vòng không mất và mất mát duy nhất là tên. Một tập hợp .NET giữ được mô tả đầy đủ nhất, bởi vì các bảng siêu dữ liệu là quy định, và vẫn cần một PDB cho tên của một địa phương.

Bảng cho bạn biết máy giải biên dịch phải làm việc gì, và các đầu ra của nó sao chép một sự kiện được lưu trữ và kết luận một. Một tên tham số trong đầu ra ILSpy là một bản sao. Một tên địa phương trong cùng đầu ra là một kết luận trừ khi có một PDB. Bài học 35 ghi lại sự khác biệt đó như thẩm quyền của mỗi tuyên bố.

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một báo cáo JSON. cho mỗi pyc nó cho cả hai tiêu đề, tệp và `grade`kích thước, số lệnh và tên opcode từ danh sách được chụp, và liệu người giải thích đang chạy có thể đọc nó hay không. Đối với mỗi lớp xây dựng nó cho phiên bản, kích thước, số lượng bảng gỡ lỗi, và các `javap`Đối với mỗi cấu trúc Wasm nó cho các phần, loại, chức năng, nội dung phần tên, và các`wasm-objdump`Đối với bộ sưu tập, nó cung cấp tiêu đề CLI, dòng, số lượng hàng bảng, phương pháp và hệ thống.Tình ảnh.`PATH`- Tôi không biết.

Đọc `code/main.py`theo thứ tự này:

1. `Reader`giữ trình chiếu và chiều rộng số nguyên. `uleb()`và `sleb()`là những bộ đọc LEB128 mà Wasm và .NET cần.
2. `read_pyc_header()`- `Unmarshaller`, và`PycFile`đọc một máy tính. `parse_dis_text()`đọc những người bị bắt giữ `dis`danh sách để so sánh phiên bản chéo không cần bốn người giải thích tại thời điểm thử nghiệm.
3. `ClassFile`đọc tập tin lớp và `disassemble_jvm()`giải mã mã của nó. `parse_javap_code()`và `compare_with_javap()`là kiểm tra của thần tiên.
4. `WasmModule`đọc các phần và `disassemble_wasm()`giải mã một biểu hiện với độ sâu của nó. `compare_with_wasm_objdump()`là kiểm tra của thần tiên.
5. `CliAssembly`đi bộ PE, tiêu đề CLI, metadata root, stream và bảng. `TABLE_SCHEMAS`và `CODED_INDEXES`là II.22 và II.24.2.6 như dữ liệu. `disassemble_cil()`giải mã một cơ thể và `compare_with_metadump()`kiểm tra nó.
6. `NativeObject`đọc đủ ELF để liệt kê các biểu tượng hàm và lấy bài học 33 liệt kê như là văn bản của nó. `what_each_keeps()`và `figure_data()`xây dựng sự so sánh.

Có thêm 5 lệnh nữa.`python3 code/main.py pyc FILE`- `class FILE`- `wasm FILE`, và`dll FILE`in cấu trúc và danh sách của mỗi chức năng trong một tệp bạn cung cấp cho họ. `python3 code/main.py compare`biên soạn `ledger.py`với mọi người diễn giải trên `PATH`và in những gì mỗi người viết.

## Sử dụng nó

Sử dụng các độc giả theo thứ tự này trên một thùng bạn đã xây dựng.

1. Đọc các byte đầu tiên và đặt tên định dạng.`0d 0a`là một pyc, `ca fe ba be`một hồ sơ lớp học, `00 61 73 6d`một mô-đun, `4d 5a`với thư mục dữ liệu 14 đặt một bộ sưu tập.
2. Đọc tiêu đề và ghi lại phiên bản sản xuất nó tên cho một pyc là từ phép thuật, cho một tệp lớp phiên bản chính, cho một tập hợp các chuỗi phiên bản runtime và metadata.
3. Hãy kiểm tra mọi trình giải biên dịch mà bạn dự định chạy với phiên bản đó trước khi bạn chạy nó.
4. Đánh bật trình đọc và công cụ của định dạng trên cùng một tệp và so sánh chúng hàng với hàng. Một sự không phù hợp là một lỗi trong trình đọc hoặc một thay đổi trong công cụ, và cả hai phải được hiểu trước khi danh sách là bằng chứng.
5. Sẵn sàng để xem các tính năng bạn quan tâm, ghi dấu từng sự kiện như là được lưu giữ hoặc bị mất và đặt tên cho bảng, thuộc tính hoặc phần mà nó xuất phát từ.
6. Chỉ sau đó đọc sản xuất decompiler, đánh dấu mỗi tên và nhập vào nó như một bản sao của một sự thật được giữ hoặc như một suy luận.

Giữ các tệp văn bản Oracle với các container. Khi phiên bản phiên bản phiên bản, JDK, SDK hoặc wabt thay đổi, xây dựng lại với `build_fixtures.sh`và bắt lại, bởi vì một danh sách thay đổi là một vật cố định thay đổi.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: đọc tiêu đề, sau đó là đối tượng mã

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code
python3 -q
```

Đi chạy:

```python
from main import *
pyc = load_pyc("ledger.cpython-311.pyc")
pyc.header.to_dict()
pyc.module.names
pyc.functions()["grade"].varnames
len(pyc.functions()["grade"].code)
```

Hãy viết ra từ phép thuật trước khi gọi.`ledger.cpython-314.pyc`và so sánh hai thứ này.`code`- Vậy thử.`import marshal; marshal.loads(pyc.data[16:])`trên tập tin 3.11 dưới phiên dịch của bạn và đọc lỗi.

### Phòng thí nghiệm B: chuỗi hồ bơi liên tục

```python
cls = load_class("Ledger-g.class")
cls.constant(13)
cls.constant(14)
cls.describe_constant(13)
[row["text"] for row in jvm_listing(cls, "grade")]
```

Theo dõi`#13`đến`#8`và `#14`, sau đó đến `Utf8`Đăng ký, bằng tay trước khi bạn gọi `describe_constant`- Vậy thì tải lên`Ledger-gnone.class`và gọi`cls.method("grade").attribute_names()`Cả hai.`Code`array là giống nhau, các thuộc tính không.

### Phòng thí nghiệm C: độ sâu và nhãn

```python
module = load_wasm("ledger.wasm")
[(row["depth"], row["text"]) for row in wasm_listing(module, "grade")]
module.function_name(2)
load_wasm("ledger-names.wasm").names["locals"][2]
```

Tìm ra `br_table`Đường và đọc độ sâu của nó.`end`hàng sau nó và phù hợp với mỗi số nhãn trong bảng.`ledger.wat`và tìm ra `block $six`nhãn đó là 3 tên.

### Phòng thí nghiệm D: từ token đến byte

```python
asm = load_assembly("LedgerNet.dll")
asm.method("Grade")
body = asm.method_body(asm.method("Grade")["RVA"])
body.fat, body.max_stack, body.code_size, hex(body.local_signature_token)
asm.token_text(0x11000001)
[row["text"] for row in cil_listing(asm, "GradeLabel")]
```

Xét tính toán file offset của RVA `0x2060`từ `.text`tiêu đề phần bằng tay và so sánh với `asm.rva_to_offset(0x2060)`Vậy hãy nhìn lên`asm.row(0x08, 3)`và tìm ra tên ở đâu `score`sống.

## Phòng thí nghiệm thực hành

Thêm một ngôn ngữ nguồn thứ năm vào so sánh, hoặc một sự kiện thứ sáu vào bảng.

Yêu cầu:

- Viết một hàm với một vòng lặp và một biến địa phương trong một ngôn ngữ mà bạn có trình biên dịch, ví dụ Kotlin đến một tệp lớp hoặc Rust đến một mô-đun Wasm.`build_fixtures.sh`- Tôi không biết.
- Hãy khiến người đọc phù hợp đồng ý với lời tiên tri trong mọi hướng dẫn.
- Tăng `what_each_keeps()`với container mới, và với một thực tế khác cho mỗi container: liệu cơ thể mang một bảng ngoại lệ hay không`try`khu vực.
- Thêm container mới vào `figure_data()`và tái tạo.`site/figures-re-43.js`- Tôi không biết.
- Viết một bài kiểm tra thất bại khi một người đọc báo cáo một sự kiện như được giữ mà không đặt tên bảng, thuộc tính hoặc phần chứa nó.

Thành công là nghĩa của`python3 code/main.py keeps`cho thấy hàng mới với bằng chứng cho mỗi tế bào, và mọi so sánh Oracle vẫn đồng ý.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-bytecode-and-managed-formats.md`Sử dụng nó để biến một container bytecode thành một báo cáo tiêu đề, một danh sách được kiểm tra của một chức năng và một bảng dữ liệu đánh dấu từng tên, loại và cấu trúc như được lưu giữ hoặc bị mất. Nó đòi hỏi công cụ của định dạng như một lời tiên tri, kiểm tra phiên bản trước bất kỳ decompiler nào, và một tuyên bố về nơi mà mỗi dữ liệu bị mất sẽ sống.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Việc kiểm tra phải chứng minh:

- Bốn tiêu đề pyc mang các từ phép thuật 3495, 3531, 3571, và 3627, cờ 3, và một hash 8-byte, và các tệp dấu thời gian mang cờ 0, mtime 1791975565, và kích thước 497
- mỗi từ ma thuật cho 3.11 và sau đó nằm trong phạm vi `2900 + 50n`quy tắc cho phép giải phóng
- Unmarshaller trả lại cùng tên, liên tục, mã byte, tên biến và bảng hàng như `marshal.loads()`trên tệp người diễn giải đang chạy đã viết
- Tất cả bốn tập tin đều giữ tên mô-đun,`('score', 'bucket')`cho `grade`, dòng đầu tiên 10 và `ledger.py`như tên tệp
- `grade.co_code`là 80, 62, 70 và 96 byte trong bốn phiên bản và các danh sách được chụp có 31, 26, 26 và 35 hướng dẫn
- danh sách 3.11 đã `POP_JUMP_FORWARD_IF_FALSE`, 3.12 và 3.13 có `RETURN_CONST`, và 3.14 đã `LOAD_SMALL_INT`- `LOAD_FAST_BORROW`, và`NOT_TAKEN`
- 3.14 `-C -O`danh sách hiển thị 13 mục cache trong `grade`, năm người sau đó`BINARY_OP`, và các chương trình liệt kê thích nghi `COMPARE_OP_INT`
- một tiêu đề mà không có `0d 0a`, một tiêu đề bị cắt, và một cơ thể không phải là một đối tượng code nâng `FormatError`
- một danh sách hướng dẫn chỉ tồn tại cho pyc được viết bởi người giải thích đang chạy và phù hợp với các hình ảnh được chụp `dis`đầu ra
- các tập tin lớp có 65 hoặc 69 chính, kích thước 1581, 1832, 1404, và 1581, và số lượng nhóm liên tục là 82, 94, 79, và 82
- liên tục`#13`quyết định `Method Ledger.grade:(I)I`và `#47`đến`String F`
- người giải thể JVM đồng ý với `javap -c -p`trên 108 trong số 108 hướng dẫn trong cả bốn chế độ
- `tableswitch`ở pc 4 là 36 byte với low 6, high 10, mặc định 48, và mục tiêu 46, 44, 42, 40, 40
- ba mức debug thay đổi số tính năng và để lại 50 byte mã của `grade`giống nhau
- `ifne`- `if_icmpge`, và`goto`mục tiêu tương đối với mã opcode chi nhánh
- một phép thuật sai, trượt bayt, và một mã op không xác định tăng `FormatError`
- 7 phần Wasm có sự bù đắp tải trọng `wasm-objdump -h`dấu ấn, và tên xây dựng thêm một `name`phần tùy chỉnh ở số 293 đến 425
- các loại, các loại`env.log`nhập khẩu, năm xuất khẩu, và phân đoạn dữ liệu tại 1024 decode như đã viết trong `ledger.wat`
- Bộ giải thể Wasm đồng ý với `wasm-objdump -d`trên 77 trong số 77 hướng dẫn trong cả hai chế độ
- `grade`có 6 khối tổ, một `br_table`Với nhãn `4 4 4 4 4 4 3 2 1 0 0`và mặc định 4 ở độ sâu 6, và một `i32`địa phương
- Tên chức năng xuất phát từ xuất khẩu mà không có phần tên và tên địa phương chỉ có nó
- LEB128 `e4 00`là 100, `7f`là -1, `80 08`là 1024, và các loại khối được hiển thị như `wasm-objdump`
- một đoạn văn sai, phiên bản 2, và một mã opcode không rõ tăng `FormatError`
- bộ phận là PE32 với máy `0x14c`, CLI header tại RVA `0x2008`, thời gian chạy 2,5, `ILONLY`, và điểm nhập cảnh `0x06000005`
- phiên bản siêu dữ liệu là `v4.0.30319`, năm dòng chảy tồn tại, và 14 bảng có số lượng hàng và kích thước hàng báo cáo Oracle
- người đọc .NET đồng ý với System.Reflection.Metadata trên 246 trong 246 kiểm tra
- `Grade`có tham số `score`, chữ ký `static int32(int32)`, một cái đầu béo với `MaxStack`2 và 45 byte mã, và một `int32`địa phương không có tên
- CIL `switch`mục tiêu,`br.s`- `ldsfld`- `call`, và`ldstr`Operand giải quyết thông qua các bảng và đống
- bảng mã opcode CIL bao gồm tất cả mã opcode thời gian chạy và chỉ thêm `no.`
- bảng giữ báo cáo tên tham số trong bốn container và không có trong mã bản địa, và các loại trong ba
- Mỗi dòng Oracle trong demo đọc n của n
- hình ảnh tương tác chứa cùng một dữ liệu `figure_data()`sản xuất

## Các chế độ sản xuất thất bại

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

## Quy tắc hoạt động

Hãy đọc tiêu đề trước và đặt tên người sản xuất nó chỉ ra. Hãy đọc container với một người đọc từ chối những gì họ không biết, và kiểm tra danh sách của nó so với công cụ của định dạng trên cùng một tệp. Sau đó nói, cho mỗi tên và loại trong đầu ra của máy phân tích, cho dù container đã lưu trữ nó hoặc công cụ suy luận nó.

## Đọc thêm

- [PEP 552: Deterministic pycs](https://peps.python.org/pep-0552/)
- [CPython `Include/internal/pycore_magic_number.h`](https://github.com/python/cpython/blob/main/Include/internal/pycore_magic_number.h)
- [Python `marshal` module documentation](https://docs.python.org/3/library/marshal.html)
- [CPython `Python/marshal.c`](https://github.com/python/cpython/blob/main/Python/marshal.c)
- [Python 3.14 `dis` module documentation](https://docs.python.org/3.14/library/dis.html)
- [PEP 659: Specializing Adaptive Interpreter](https://peps.python.org/pep-0659/)
- [PEP 626: Precise line numbers for debugging and other tools](https://peps.python.org/pep-0626/)
- [PEP 790: Python 3.15 Release Schedule](https://peps.python.org/pep-0790/)
- [uncompyle6 on PyPI](https://pypi.org/project/uncompyle6/)- [decompyle3 on PyPI](https://pypi.org/project/decompyle3/)- [xdis on PyPI](https://pypi.org/project/xdis/)- [pycdc on GitHub](https://github.com/zrax/pycdc)- [PyLingual on GitHub](https://github.com/syssec-utd/pylingual)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 4: The class File Format](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-4.html)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 6: The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-6.html)
- [javac manual, Java SE 25](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html)và [javap manual](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html)
- [CFR](https://www.benf.org/other/cfr/)- [Procyon](https://github.com/mstrobel/procyon)- [Vineflower](https://github.com/Vineflower/vineflower)- [Fernflower in intellij-community](https://github.com/JetBrains/intellij-community/tree/master/plugins/java-decompiler/engine)- [JADX](https://github.com/skylot/jadx)
- [Harrand, Soto-Valero, Monperrus, Baudry, "Java Decompiler Diversity and its Application to Meta-decompilation" (JSS 2020)](https://arxiv.org/abs/2005.11315)
- [ECMA-335, Common Language Infrastructure, 6th edition (June 2012)](https://ecma-international.org/publications-and-standards/standards/ecma-335/)
- [PE Format, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [System.Reflection.Metadata.Ecma335.TableIndex](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.metadata.ecma335.tableindex)
- [ILSpy on GitHub](https://github.com/icsharpcode/ILSpy)- [ilspycmd on NuGet](https://www.nuget.org/packages/ilspycmd)- [dnSpyEx on GitHub](https://github.com/dnSpyEx/dnSpy)
- [WebAssembly Core Specification: Binary Format, Modules](https://webassembly.github.io/spec/core/binary/modules.html)và [Values](https://webassembly.github.io/spec/core/binary/values.html)
- [WebAssembly Core Specification: Custom Sections (name section)](https://webassembly.github.io/spec/core/appendix/custom.html)
- [WebAssembly tool-conventions: Debugging](https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md)
- [wabt 1.0.42 release notes](https://github.com/WebAssembly/wabt/releases/tag/1.0.42)- [wasm-tools](https://github.com/bytecodealliance/wasm-tools)- [Binaryen](https://github.com/WebAssembly/binaryen)- [ghidra-wasm-plugin](https://github.com/nneonneo/ghidra-wasm-plugin)
- [radare2 on GitHub](https://github.com/radareorg/radare2), phiên bản 6.2.4 được xây dựng từ nguồn cho bài học này
