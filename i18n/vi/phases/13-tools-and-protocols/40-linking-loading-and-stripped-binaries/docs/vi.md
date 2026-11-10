# Liên kết, tải và tách Binary: PLT, GOT, nhập khẩu, sửa chữa và xác định chức năng

> Một chương trình liên kết gọi các chức năng mà nó không chứa. Bài học này đọc các bảng biên tập liên kết đã viết cho các cuộc gọi đó trong ba định dạng, theo một cuộc gọi đến khe cắm mà bộ tải điền, và tìm các chức năng của một xây dựng sau khi tên của nó đã biến mất.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and arm64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow), 38 (calling conventions)
**Time:** ~160 minutes

## Mục tiêu học tập

- Quyết định từ một hồ sơ di chuyển và bảng biểu tượng những gì trình chỉnh sửa liên kết làm cho nó: một khoảng cách cố định, một mục PLT với một khe GOT, hoặc một di chuyển động.
- Đọc phần động lực, PLT và GOT của một ELF thực thi độc lập vị trí và theo dõi một cuộc gọi thông qua chúng bằng các công thức psABI.
- Đọc một đối tượng COFF (20 bit file header, 40 bit mục phần, 18 bit biểu tượng, 10 bit di chuyển) và các thư mục nhập khẩu, xuất khẩu và di chuyển cơ sở của một hình ảnh PE32+.
- Hãy giải mã chuỗi sửa chữa được nối chuỗi Mach-O từ từ và so sánh từng từ với nhau .`dyld_info`- Tôi không biết.
- Hãy nói gì `strip`xóa và tồn tại trong mỗi định dạng, và chạy chương trình bị tước để chứng minh nó vẫn hoạt động.
- Khôi phục chức năng khởi động của một bộ arm64 bị tẩy tay với `LC_FUNCTION_STARTS`, quét tiền đề, và gọi mục tiêu, đánh giá mỗi phương pháp so với bảng biểu tượng của cặp đôi không bị cắt, và đặt tên các chức năng với chữ ký hình FLIRT.

## Vấn đề

Anh liên kết`main.c`chống lại`libledger.dylib`Và hỏi một nhân viên làm việc gì `main`gọi vào `0x1000005a0`Cảnh sát đã giải thể hướng dẫn và đọc`bl 0x100000694`Địa chỉ đó chứa 12 byte:`adrp x16`- `ldr x16, [x16, #0x38]`- `br x16`- Cảnh sát theo dõi hàng đến`0x100004038`, đọc tám byte `00 00 00 00 00 00 10 80`, và báo cáo một cuộc gọi qua một chỉ dẫn bị hỏng vào không gian lõi.

Sau đó, bạn cởi bỏ cấu trúc tĩnh của cùng một chương trình và hỏi nó có bao nhiêu chức năng.`nm`, thấy một tên,`__mh_execute_header`, và trả lời một.

Cả hai câu trả lời đều đọc file như thể đó là quá trình chạy.`0x100004038`Bit 63 nói liên kết, 12 bit nói nơi liên kết tiếp theo là, và các bit thấp nói về nhập khẩu để liên kết.`_puts`trước đây`main`Các tập tin bị tước mất bảng biểu tượng của nó và được giữ lại`LC_FUNCTION_STARTS`, liệt kê tất cả 5 hàm bắt đầu trong 9 byte.

Bài học này xây dựng năm độc giả trong thư viện Python tiêu chuẩn. Một độc giả COFF cho các đối tượng của chúng tôi và một PE32+ cho các thư mục nhập khẩu, xuất khẩu và chuyển chỗ cơ sở. Một độc giả Mach-O cho các lệnh tải, các đoạn, bảng biểu tượng gián tiếp, chuỗi sửa chữa chuỗi, và các thử nghiệm xuất khẩu, kiểm tra từ từ với từ `dyld_info`. Một trình đọc ELF cho phần động, PLT, và GOT, cộng với một trình lập kế hoạch cho biết một liên kết PIE của các đối tượng của chúng tôi sẽ tạo ra gì. Một trình tìm hàm cho một xây dựng bị tẩy chay với bốn phương pháp và điểm số cho mỗi người. Một trình tạo chữ ký hình FLIRT, với các byte di chuyển wildcard và một CRC16 của đuôi.

Chỉ có Mach-O liên kết trên máy này. các thiết bị thực thi arm64 và dylib đã được kết nối, khép ra và chạy. các đối tượng ELF và COFF được biên soạn ở đây với `clang -target`, và không có trình chỉnh sửa liên kết ELF hoặc PE được cài đặt, vì vậy hai hình ảnh liên kết trong các định dạng đó đã được viết byte theo byte từ các thông số kỹ thuật bởi hai kịch bản Python trong thư mục cố định. `llvm-objdump`và cũng như các thư viện thăm dò. chúng không được chạy, và văn bản nói như vậy khi nó quan trọng.

```figure
re-40-call-through-three-formats
```

## Điều gì biên tập liên kết làm với một di chuyển

Bài 32 đọc hồ sơ di chuyển và bài 33 áp dụng `S + A - P`đến một `lea`Một bản ghi tên một nơi`P`, một kiểu, một biểu tượng `S`, và một phụ kiện`A`. Bảng 4.9 của x86-64 psABI cho thấy một công thức cho mỗi loại, với `L`cho vị trí nhập PLT của biểu tượng, `G`Vì sự đền bù của nó,`GOT`cho địa chỉ GOT, và `B`3 kết quả bao gồm các đối tượng của chúng ta.

Các liên kết biên tập ghi giá trị vào trường và ghi lại đã biến mất. `R_X86_64_PC32`đối với một biểu tượng được xác định trong các đầu vào là trường hợp này. Khoảng cách giữa hai byte của một hình ảnh không bao giờ thay đổi, bất kể địa chỉ tải.

Các biên tập liên kết tạo ra một mục PLT và một khe GOT. `R_X86_64_PLT32`với một hàm không xác định là trường hợp này.`L + A - P`, khoảng cách đến lối vào.`R_X86_64_JUMP_SLOT`ghi lại trong `.rela.plt`nói với động lực liên kết để lấp đầy khoảng trống.

Bộ chỉnh sửa liên kết giữ một di chuyển cho bộ tải. `R_X86_64_64`là một địa chỉ tuyệt đối tám byte, và một vị trí độc lập thực thi không biết địa chỉ của nó cho đến khi nó tải.`R_X86_64_RELATIVE`với công thức `B + A`trong `.rela.dyn`- Tôi không biết.

`main-x86_64-O1.o`có 18 hồ sơ: 14 trong `.text`, 2 trong `.data.rel.ro`, và 2 trong `.rodata`- `plan_dynamic_link()`trong `code/main.py`áp dụng ba quy tắc cho họ cùng với `ledger-x86_64-O1.o`- Có thể là:

| Record | Count | Decision | Why |
|---|---|---|---|
| `R_X86_64_PC32` to `.rodata`, `.L.str`, `fns`, the table in `.rodata` | 16 | in place | the symbol is defined in the inputs |
| `R_X86_64_PLT32` to `percent_change`, `grade`, `total`, `grade_label` | 4 | direct, no PLT | defined in `ledger-x86_64-O1.o`, so the link editor reduces PLT32 to PC32 |
| `R_X86_64_PLT32` to `puts` twice and `printf` twice | 4 | PLT entry and GOT slot | undefined, provided by a shared library |
| `R_X86_64_64` to `grade` in `fns[]` | 2 | `R_X86_64_RELATIVE` | an absolute field in a PIE |

Hai nhập khẩu cho một `.plt`của 48 byte (PLT0 cộng với hai mục của 16), a `.got.plt`của 40 byte (ba khe được đặt lại cộng với hai), và một `.rela.plt`hai ghi chép tương đối cho một `.rela.dyn`Những con số này đến từ các thông số được áp dụng cho các hồ sơ của chúng tôi.`tiny-dyn-x86_64`thực hiện phần PLT của kế hoạch này cho hai nhập khẩu tương tự, và kích thước của nó phù hợp với kế hoạch.

Người biên tập viết `PLT32`trên mỗi cuộc gọi, được xác định hoặc không được xác định, kể từ khi binutils 2.31 (H.J. Lu, 2018-02-13) và LLVM 7.0.0 (D43383, 2018-02-20).`PLT32`trong một đối tượng vì vậy nói "một cuộc gọi", và không nói gì về việc liệu mục PLT sẽ tồn tại hay không. Hai loại khác xuất hiện trong các cấu trúc khác. `R_X86_64_GOTPCRELX`và `R_X86_64_REX_GOTPCRELX`(`G + GOT + A - P`) yêu cầu một khe GOT mà không có PLT, mà `-fno-plt`sản xuất và mà người biên tập liên kết có thể thư giãn cho một trực tiếp `lea`hoặc `call`khi biểu tượng là địa phương (psABI Dùng B). `R_X86_64_32`và `R_X86_64_32S`không thể giữ địa chỉ trong PIE và liên kết thất bại.

## Bộ phận năng động, PLT và GOT

Chương 5 của gABI nói rằng một trình thực hiện tham gia vào kết nối động có một `PT_INTERP`chương trình tiêu đề, phải đi trước bất kỳ phân đoạn tải, và một `PT_DYNAMIC`, bao gồm:`.dynamic`phần. phần là một mảng của `Elf64_Dyn`cặp, thẻ được ký và giá trị, kết thúc bằng `DT_NULL`- Tôi không biết.

`tiny-dyn-x86_64`là 5.184 byte được viết bởi `build_tiny_dyn_elf.py`từ gABI và psABI.`0x1000`- Có thể là:

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

GABI nói tại sao `DT_JMPREL`là riêng biệt: nó "có địa chỉ các mục di chuyển liên kết với bảng liên kết quy trình. Việc tách các mục di chuyển này cho phép các liên kết động bỏ qua chúng trong quá trình khởi tạo quy trình, nếu liên kết lười biếng được bật". `DF_BIND_NOW`trong `DT_FLAGS`- `DF_1_NOW`trong `DT_FLAGS_1`, hoặc`LD_BIND_NOW`trong môi trường tắt liên kết lười biếng và các liên kết năng động xử lý chúng khi khởi động.

### PLT0 và mục cho các điểm

Phần 5.2 của psABI cho thấy hai hình dạng trong Hình 5.2. Đây là các byte của tệp của chúng tôi:

```text
     1f0: ff 35 d2 0e 00 00    pushq  0xed2(%rip)      # 0x10c8 = GOT+8
     1f6: ff 25 d4 0e 00 00    jmpq   *0xed4(%rip)     # 0x10d0 = GOT+16
     1fc: 0f 1f 40 00          nopl   (%rax)

     200: ff 25 d2 0e 00 00    jmpq   *0xed2(%rip)     # 0x10d8 = GOT+24, the slot for puts
     206: 68 00 00 00 00       pushq  $0x0             # index 0 into DT_JMPREL
     20b: e9 e0 ff ff ff       jmp    0x1f0            # PLT0
```

Làm toán học một lần. Phác dịch tương đối với RIP tương đối với hướng dẫn tiếp theo. `0x1f6 + 0xed2 = 0x10c8`, đó là `.got.plt + 8`- `0x1fc + 0xed4 = 0x10d0`, đó là `.got.plt + 16`- `0x206 + 0xed2 = 0x10d8`, khe thứ tư. `0x210 - 0x20 = 0x1f0`Mỗi mục là 16 byte, vì vậy mục cho `exit`bắt đầu từ `0x210`, đẩy`$0x1`, và đọc `0x10e0`- Tôi không biết.

Chính phủ Ấn Độ có 3 khe cắm. psABI 5.2: mục 0 chứa địa chỉ của `_DYNAMIC`, và "nghệ nhất và hai mục trong bảng bù trừ toàn cầu cũng được đặt.`.got.plt`đọc `0x1000, 0, 0, 0x206, 0x216`. glibc điền vào khe 1 với nó `struct link_map`và khe hai với `_dl_runtime_resolve`Khi nó tải tập tin.`0x206`trong hồ sơ, đó là `pushq`bên trong`puts@plt`. psABI: khe "trước đầu ... chứa địa chỉ của hướng dẫn đẩy tiếp theo".

Vậy là cuộc gọi đầu tiên được thực hiện`call 0x200`- `jmpq *0x10d8`đất trên `pushq $0`- `jmp 0x1f0`đẩy GOT+8 và nhảy qua GOT+16 vào giải quyết, đọc ghi 0 của `DT_JMPREL`- `R_X86_64_JUMP_SLOT puts`, trông `puts`lên trong `libc.so.6`, viết địa chỉ của nó vào `0x10d8`, và nhảy lên đó.`call`- `jmpq *0x10d8`Drepper viết rằng "giá phí trên cho tất cả ngoại trừ cuộc gọi đầu tiên do đó 'chỉ' một bước nhảy gián tiếp".`%r11`giải thích một lựa chọn đăng ký trong bài học 38: đó là một đăng ký cào vì vậy "điều mã trong PLT không cần phải đổ ra bất kỳ đăng ký".

Trang web gọi trong `.text`đọc `e8 d4 ff ff ff``0x227`, và`0x22c - 0x2c = 0x200`- `llvm-objdump`dấu vân tay`callq 0x200 <puts@plt>`cho nó và đặt tên vào mục từ `.rela.plt`ghi lại, đó là cách `plt_entries()`- Đặt tên cho nó.

### Những gì trong tệp không có

Tài liệu không có `PT_GNU_RELRO`. Jakub Jelinek đề xuất RELRO trong danh sách các công cụ trong năm 2004-01-06: di chuyển các phần được viết chỉ trong quá trình di chuyển đến đầu của phân đoạn viết, để các liên kết động có thể `mprotect`GNU ld mặc định đặt`.init_array`- `.fini_array`- `.data.rel.ro`- `.dynamic`, và`.got`bên trong, và chỉ giữ ba khe cắm được đặt trong `.got.plt`bên trong, 24 byte, bởi vì các khe khác được viết lười biếng.`-z now`bộ `DF_BIND_NOW`và di chuyển toàn bộ `.got.plt`bên trong, đầy RELRO, bởi vì không có gì được viết sau khi khởi động.`_dl_protect_relro`gọi`mprotect(start, end - start, PROT_READ)`trên phạm vi trang-định hướng. `-fno-plt`đi một bước xa hơn ở phía biên dịch: các cuộc gọi đi qua `jmpq *name@GOTPCREL(%rip)`, liên kết lười biếng là không thể, và hướng dẫn của GCC nói rằng "tất cả các biểu tượng bên ngoài được giải quyết tại thời điểm tải".

Dữ liệu cũng không có phần phiên bản.`libc.so.6`thêm `.gnu.version`, một `Elfxx_Half`mỗi`.dynsym`nhập cảnh, và`.gnu.version_r`, một `Verneed`cho mỗi thư viện với `Vernaux`ghi lại cho mỗi tên phiên bản. `printf@GLIBC_2.2.5`phương tiện: mục nhập của `printf`trong `.gnu.version`có một chỉ số, `Vernaux`của ai `vna_other`bằng chỉ số đó có `vna_name`"GLIBC_2.2.5", trong `Verneed`của ai `vn_file`là "libc.so.6". Chỉ số 0 là địa phương, 1 là toàn cầu, và bit 15 (`VERSYM_HIDDEN`- `0x8000`) ẩn một phiên bản từ trình biên tập liên kết.

Bảng hash là SysV `DT_HASH`với một cái thùng và một chuỗi 3 bước, 24 byte.`DT_HASH`hoặc `DT_GNU_HASH`để tìm ra các biểu tượng trong tệp. tệp này không xuất khẩu gì, và nó không được chạy ở đây, vì vậy liệu glibc chấp nhận một bảng một thùng không được xác minh.

### .dynsym, .symtab, và strip

GABI làm`.dynsym`và `.dynstr`Các phần được phân bổ và`.symtab`và `.strtab`Drepper: "Thếch biểu tượng bình thường không được sử dụng trong thời gian chạy và do đó không cần thiết để loại bỏ một bộ nhị phân của nó. Nó không ảnh hưởng đến hiệu suất".

GNU `strip --strip-all`loại bỏ `.symtab`- `.strtab`- `.debug_*`, và`.comment`Mỗi phần được phân bổ sẽ ở lại:`.interp`- `.dynsym`- `.dynstr`- `.gnu.hash`- `.gnu.version*`- `.rela.dyn`- `.rela.plt`- `.plt`- `.text`- `.rodata`- `.eh_frame`- `.init_array`- `.dynamic`- `.got`- `.got.plt`- `.data`- `.bss`Các chủ đề của bộ phận sẽ ở lại trừ khi bạn thêm vào`--strip-section-headers`(bản 2.41) hoặc chạy `llvm-strip --strip-sections`- `--strip-debug`giữ các biểu tượng. `--only-keep-debug`viết file debug mà `--add-gnu-debuglink`tên từ một người được tước đi, với một CRC32 trong `.gnu_debuglink`, và`ld --build-id`viết `.note.gnu.build-id`để một bộ xử lý lỗi có thể phù hợp với hai.

## Vật vật COFF

`clang -target x86_64-pc-windows-msvc -O1 -fno-asynchronous-unwind-tables -c`sản xuất `main-x86_64.obj`và `ledger-x86_64.obj`. Trang định dạng PE xác định đối tượng: một tiêu đề tập tin 20 byte, không có tiêu đề tùy chọn, một bảng mục phần gồm 40 byte, một bảng biểu tượng gồm các bản ghi 18 byte và các bản ghi di chuyển 10 byte cho mỗi phần.

`CoffObject`trong `code/main.py`Đọc cả bốn.`0x8664`, 10 phần, 37 ký hiệu ghi lại,`SizeOfOptionalHeader`0. Tên bảng phần `.text`- `.data`- `.bss`, sáu phần gọi là `.rdata`, và`/16`Một cái tên bắt đầu bằng`/`là một số phân số chuyển đổi vào bảng chuỗi, bắt đầu với kích thước bốn byte của riêng nó; `/16`quyết định `.llvm_addrsig`, đó là tên `llvm-objdump -h`- Nhìn vân tay.

Các 37 hồ sơ bao gồm các hồ sơ phụ trợ. Một biểu tượng phần (tầng lưu trữ 3) mang một trong những chứa chiều dài phần, số lượng di chuyển, một số tiền kiểm tra và một lựa chọn COMDAT.`.rdata`Các phần có chọn 2, "bất kỳ", và chứa một chuỗi chữ nghĩa mỗi bên dưới một tên MSVC-mangled: `??_C@_04JDDJEAHN@even?$AA@`là chuỗi "even". trình chỉnh sửa liên kết giữ một bản sao của mỗi.`.file`với ghi chú phụ trợ "main.c". `llvm-objdump -t`in những cái này như `[ 0]`- `AUX scnlen ...`- `[ 2]`, và vv, bỏ qua các chỉ số phụ trợ, và thử nghiệm so sánh chỉ số và cặp tên của chúng tôi với văn bản đó.

Các cuộc di chuyển: 14 `IMAGE_REL_AMD64_REL32`trong `.text`và 4 `IMAGE_REL_AMD64_ADDR64`trong `.rdata`- `REL32`là "địa chỉ tương đối 32 bit từ byte sau khi di chuyển".`R_X86_64_PC32`với `-4`được tích hợp: hồ sơ ELF mang thêm `-4`vì hồ sơ có một trường phụ gia, và hồ sơ COFF không có. `ledger-x86_64.obj`có ba `REL32``0x36`- `0x84`, và`0x93`, và bài học 32 `ledger-x86_64-O1.o`có ba `R_X86_64_PC32`Các mã là giống nhau, và các định dạng khác nhau chỉ trong nơi bốn được viết. `ADDR64`là một địa chỉ tuyệt đối tám byte, `labels`bảng của các chỉ dẫn chuỗi, và nó trở thành một di chuyển cơ sở trong hình ảnh, như `R_X86_64_64`trở thành `R_X86_64_RELATIVE`- Tôi không biết.

| | ELF `Elf64_Rela` | COFF relocation | Mach-O `relocation_info` |
|---|---|---|---|
| record size | 24 bytes | 10 bytes | 8 bytes |
| fields | offset, type and symbol in `r_info`, addend | offset, symbol index, type | address, then a 32-bit word with symbolnum:24, pcrel:1, length:2, extern:1, type:4 |
| addend | explicit | none, lives in the field | none, or an `ARM64_RELOC_ADDEND` record before the real one |
| the call to `puts` | `R_X86_64_PLT32 puts-0x4` | `IMAGE_REL_AMD64_REL32 puts` | `ARM64_RELOC_BRANCH26 _puts` |

## Hình ảnh PE: nhập khẩu, xuất khẩu và di chuyển cơ sở

`tiny-x86_64.exe`là 2.560 byte được viết bởi `build_tiny_pe.py`Nó có nhiệm vụ tương tự như ELF nhỏ bé: gọi`puts`và `exit`từ `msvcrt.dll`Nó cũng xuất khẩu một tên và mang theo một chuyển đổi cơ sở, vì vậy ba thư mục cần thiết bài học này đều có mặt. `pefile`2024.8.26 và `llvm-objdump -p`Cả hai đều đọc nó, và cả hai hình ảnh đều là thiết bị.

Đi qua các tiêu đề.`MZ`và trong khi trần gian`0x3c`giữ `e_lfanew`- `0x40`- Tại `0x40`chữ ký `PE\0\0`Sau đó, cái tên tập tin COFF: máy`0x8664`, 4 phần,`SizeOfOptionalHeader`240, đặc điểm `0x22`(hình ảnh thực thi, địa chỉ lớn biết).`Magic`trường, `0x20b`, nghĩa là PE32+. `AddressOfEntryPoint`là `0x1000`- `ImageBase`là `0x140000000`- `SectionAlignment` `0x1000`- `FileAlignment` `0x200`- `SizeOfImage` `0x5000`- `Subsystem`3 (console). `DllCharacteristics` `0x8160`mã hóa để `HIGH_ENTROPY_VA 0x0020`- `DYNAMIC_BASE 0x0040`- `NX_COMPAT 0x0100`, và`TERMINAL_SERVER_AWARE 0x8000`Sau đó 16 thư mục dữ liệu của RVA và kích thước.`0x2080`kích thước`0x4d`, nhập khẩu tại `0x2000`kích thước`0x28`, Đời căn cứ tại `0x4000`kích thước`0xc`, IAT tại `0x2040`kích thước`0x18`- Tôi không biết.

Các địa chỉ trong một hình ảnh là RVAs, bù đắp từ cơ sở tải. Bảng phần lập bản đồ chúng để thay đổi tệp: `.text`RVA `0x1000`trong hồ sơ`0x200`- `.rdata`RVA `0x2000``0x400`- `.data`RVA `0x3000``0x600`- `.reloc`RVA `0x4000``0x800`- `PeImage.rva_to_offset()`là cái bàn đó.

### Chỉ mục nhập khẩu

Tại RVA `0x2000`nằm trong một mảng các mô tả nhập khẩu 20 byte kết thúc bằng mô tả không.`0x2028`, timestamp 0, chuỗi vận chuyển 0 , tên `0x2068`, Bảng địa chỉ nhập khẩu `0x2040`. Tên RVA chỉ ra "msvcrt.dll". Bảng tìm kiếm chứa các mục 64 bit kết thúc bằng số không. Bộ Bit 63 có nghĩa là nhập bằng thứ tự, với thứ tự trong bit 15 đến 0. Bit 63 rõ ràng có nghĩa là bit 30 đến 0 là RVA của một mục gợi ý / tên: một gợi ý 16-bit, "một chỉ số vào bảng chỉ số tên xuất khẩu", sau đó tên ASCII. Chúng tôi là `0x2058`(số 0, "đặt") và `0x2060`(khí dụ 0, "từ").

Các thông số kỹ thuật nói rằng IAT là "tương tự với nội dung của bảng tìm kiếm nhập khẩu cho đến khi hình ảnh được gắn".`0x2040`chứa hai RVAs tương tự, và kiểm tra kiểm tra rằng 24 byte ở `0x2028`bằng với 24 byte ở `0x2040`. "Trong thời gian liên kết, các mục trong bảng địa chỉ nhập khẩu được ghi lại với địa chỉ 32 bit (cho PE32) hoặc 64 bit (cho PE32+) của các biểu tượng đang được nhập khẩu. " Các trình tải Windows làm điều đó trước khi điểm nhập khẩu chạy. Không có liên kết lười biếng và không có cột. Mã đạt đến khe trực tiếp:

```text
    100b: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1011 + 0x102f = 0x2040, the IAT slot of puts
    1013: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1019 + 0x102f = 0x2048, the IAT slot of exit
```

`FF /2`là cuộc gọi gần gián tiếp. Hai hướng dẫn có cùng các byte bởi vì mỗi người ngồi tám byte sau người khác và đọc một khe tám byte sau người khác. `iat_calls()`quét phần mã cho `ff 15`, thêm 6 và sự di chuyển, và đặt tên cho khe trong thư mục nhập khẩu.

### Chỉ mục xuất khẩu

Tại RVA `0x2080`bảng thư mục xuất khẩu 40byte: cờ, dấu thời gian, phiên bản, một tên RVA chỉ ra "tiny-x86_64.exe", cơ sở thứ tự 1, mục 1 bảng địa chỉ, chỉ số tên 1. Ba bảng sau.`0x20a8`có một RVA, `0x1000`. Bảng chỉ số tên xuất khẩu tại `0x20ac`chứa một RVA cho chuỗi "tiny_entry".`0x20b0`có một chỉ số 16 bit không thiên vị, 0. Tên `k`bản đồ để địa chỉ nhập `ordinals[k]`, và đơn lệnh xuất khẩu là `ordinals[k] + ordinal base`. Các thông số đặc trưng thêm một quy tắc mà chúng tôi không sử dụng: một mục địa chỉ chỉ vào bên trong phần xuất khẩu là một chuỗi vận chuyển như `MYDLL.expfunc`, và bảng chỉ dẫn tên là "định nghĩa theo từ ngữ để cho phép tìm kiếm nhị phân".

### Việc di chuyển căn cứ

`.reloc`chứa các khối. Mỗi khối bắt đầu với một trang RVA và kích thước khối, sau đó các mục 16-bit với loại trong bốn bit trên cùng và một trang bù trừ trong mười hai thấp.`0x3000`, kích thước 12, nhập `0xa000`, loại 10, `IMAGE_REL_BASED_DIR64`, trục xuất 0, và một mục đệm kiểu 0, `IMAGE_REL_BASED_ABSOLUTE`. 8 byte ở RVA`0x3000`Đứng yên`0x1400020d0`, cơ sở hình ảnh cộng với RVA của chuỗi "đối kết bằng tay". Nếu tải đặt hình ảnh ở bất cứ nơi nào khác, nó thêm sự khác biệt vào trường đó. Mô tả: "Các tệp hình ảnh không chứa COFF di chuyển ... Một hình ảnh chứa thông tin di chuyển dưới dạng di chuyển cơ sở trong phần .reloc (trừ khi hình ảnh có thuộc tính IMAGE_FILE_RELOCS_STRIPPED). " `/DYNAMICBASE`được bật mặc định trong link.exe hiện tại, vì vậy hình ảnh mang `.reloc`và `DYNAMIC_BASE`- Tôi không biết.

Một hình ảnh PE không có bảng biểu tượng để thoát ra.`PointerToSymbolTable`"đáng lẽ phải là không cho một hình ảnh vì thông tin chỉnh sửa COFF đã lỗi thời", và các tên sống trong một PDB riêng biệt.`.pdata`, người `RUNTIME_FUNCTION`các mục đặt tên cho sự bắt đầu và kết thúc của mỗi hàm phân bổ hàng hoặc gọi một hàm khác.

## Hình ảnh Mach-O: Load Commands, Stubs, và bảng biểu tượng gián tiếp

`ledger_main`là linked arm64 exectable. `otool -h`in 19 lệnh tải và cờ `0x00200085`- `MH_NOUNDEFS 0x1`- `MH_DYLDLINK 0x4`- `MH_TWOLEVEL 0x80`, và`MH_PIE 0x200000`19 lệnh là 4`LC_SEGMENT_64`(`__PAGEZERO`- `__TEXT`- `__DATA_CONST`- `__LINKEDIT`), hai `LC_LOAD_DYLIB`(`@rpath/libledger.dylib`Vậy thì`/usr/lib/libSystem.B.dylib`), và một trong mỗi `LC_DYLD_CHAINED_FIXUPS`- `LC_DYLD_EXPORTS_TRIE`- `LC_SYMTAB`- `LC_DYSYMTAB`- `LC_LOAD_DYLINKER`- `LC_UUID`- `LC_BUILD_VERSION`- `LC_SOURCE_VERSION`- `LC_MAIN`- `LC_RPATH`- `LC_FUNCTION_STARTS`- `LC_DATA_IN_CODE`, và`LC_CODE_SIGNATURE`- `MachoFile.command_names()`trả lại cùng một danh sách theo cùng một thứ tự như `otool -l`- Tôi không biết.

`__TEXT`bắt đầu từ `0x100000000`- `__text`là 256 byte ở `0x100000558`- `main`Và không có gì khác, bởi vì bốn chức năng sổ cái sống trong dylib. `__stubs`là 84 byte ở `0x100000658`, 7 đoạn của 12 byte.`__DATA_CONST`bắt đầu từ `0x100004000`với `__got`, 64 byte, tám điểm chỉ số kiểu phần `S_NON_LAZY_SYMBOL_POINTERS`, và`__const`, 32 byte, `fns[]`và `names[]`bảng của `main.c`- Tôi không biết.

### Một cây cối, bằng tay

Chuyện này là...`_puts`là ở `0x100000694`- Có thể là:

```text
    30 00 00 90    adrp x16, 0x100004000
    10 1e 40 f9    ldr  x16, [x16, #0x38]
    00 02 1f d6    br   x16
```

`0x90000030`là `adrp`Thư ký là 5 bit thấp nhất, 16.`immlo`là 30 đến 29, 0. `immhi`là 23 bit đến 5, 1, giá trị là `immhi << 2 | immlo = 4`, trong các trang của 4,096 byte, do đó trang mục tiêu là trang của hướng dẫn, `0x100000000`, cộng với `0x4000`- `0xf9401e10`là `ldr`với một sự thay thế 12 bit không ký kết được quy mô bằng 8: bit 21 đến 10 là 7, nhân 8 là `0x38`, để tải được đọc`0x100004038`- `0xd61f0200`là `br x16`. Bộ phận Arm64 trong nguồn ID64 là chỉ dẫn chính xác này 3`StubAtom`- Tôi không biết.

Tên nào thuộc về khe là từ bảng biểu tượng gián tiếp. `LC_DYSYMTAB`Các điểm ở 15 chỉ số vào bảng biểu tượng.`reserved1`nơi mà chuỗi các chỉ số của nó bắt đầu và trong `reserved2`kích thước của mỗi cây cối (12).`reserved1`và tám byte mỗi khe. `__stubs`bắt đầu từ chỉ số 0 và `__got`ở chỉ số 7, do đó, thu thập 5 bản đồ để nhập bảng biểu tượng 10, `_puts`, và khe 7 của `__got`Bản đồ đến cùng một mục. `otool -Iv`in cả hai chạy, và `indirect_table()`tái tạo mỗi hàng.

### Không gian tên hai cấp

`nm -m`dấu vân tay`(undefined) external _puts (from libSystem)`và `(undefined) external _grade (from libledger)`Thư viện được lấy từ bản thân ký hiệu.`nlist.h`định nghĩa `GET_LIBRARY_ORDINAL(n_desc)`như 15 đến 8 bit của `n_desc`, 1 cho lần đầu `LC_LOAD_DYLIB`, 2 cho thứ hai, `0xfe`cho tìm kiếm động lực, `0xff`cho cái được thực thi. `ld(1)`: "Với -two_levelnamespace (đặc định), linker chỉ tìm kiếm các dylib trên dòng lệnh cho các biểu tượng, và ghi lại dylib mà chúng được tìm thấy. " `nm_lines()`cho lại 12 bản ghi từ `n_type`- `n_sect`- `n_desc`, và`n_value`, và thử nghiệm so sánh dòng sản xuất của nó cho dòng với các chụp `nm -m`- Liên kết lại với `-Wl,-flat_namespace`và đọc `otool -h`để xem `MH_TWOLEVEL`một chút biến mất.

## Các Fixups chuỗi, Byte cho Byte

`LC_DYLD_CHAINED_FIXUPS`là một `linkedit_data_command``dataoff 0x8000`- `datasize 208`208 byte tiếp theo`fixup-chains.h`- Tôi không biết.

Header là bảy trường 32 bit: `fixups_version 0`- `starts_offset 32`- `imports_offset 80`- `symbols_offset 112`- `imports_count 8`- `imports_format 1`(`DYLD_CHAINED_IMPORT`), `symbols_format 0`(không bị nén). `llvm-objdump --macho --chained-fixups`in bảy giá trị này và thử nghiệm so sánh chúng.

Ở điểm 32`dyld_chained_starts_in_image``seg_count 4`và bốn lần bù đắp, một lần cho từng phân đoạn, không cho các phân đoạn không có sự cố. Chỉ có `__DATA_CONST`Có một cái.`dyld_chained_starts_in_segment`đọc `size 24`- `page_size 0x4000`- `pointer_format 6`(`DYLD_CHAINED_PTR_64_OFFSET`, " mục tiêu là vm bù đắp"), `segment_offset 0x4000`- `max_valid_pointer 0`- `page_count 1`, và một `page_start`của 0. `DYLD_CHAINED_PTR_START_NONE`- `0xffff`, có nghĩa là một trang mà không có sự cố.

Dòng bắt đầu tại file offset `0x4000 + 0`Mỗi từ 64 bit mang theo hai thứ: những gì để viết ở đó, và nơi từ tiếp theo là.

```text
  dyld_chained_ptr_64_bind    ordinal:24  addend:8  reserved:19  next:12  bind:1 = 1
  dyld_chained_ptr_64_rebase  target:36   high8:8   reserved:7   next:12  bind:1 = 0
```

Đọc từ đầu tiên, `0x8010000000000000`Bit 63 được thiết lập, kết nối.`next`là bit 62 đến 51, `0x002`, trong đơn vị của 4 byte, do đó, sửa chữa tiếp theo là 8 byte trên.`0x4058`- `0x00000000000006db`- 63 điểm, 1 rebase.`next`là 0, cuối chuỗi. mục tiêu là `0x6db`, vm offset, và hình ảnh cơ sở `0x100000000`làm cho nó thành công`0x1000006db`, chuỗi "odd" trong `__cstring`Từ trước đó,`0x00100000000006d6`, các cơ sở`names[0]`"đối với nhau".

Cuộc đi bộ thăm mười hai từ: tám liên kết trong `__got`với số lệnh 0 đến 7, hai liên kết trong `__const`với số số 0 (cả hai mục của `fns[]`điểm ở `_grade`), và hai cơ sở của `names[]`- `chained_fixups()`trả lại chúng với các file của họ bù đắp và từ thô, và thử nghiệm so sánh mười hai `(offset, raw)`cặp với `dyld_info -fixup_chain_details`, những gì in `raw: 0x8010000000000000 bind: (next: 002, bindOrdinal: 0x000000)`lần đầu tiên.

Bảng nhập khẩu tại ofset 80 có tám mục 32 bit: `lib_ordinal:8`- `weak_import:1`- `name_offset:23`, với tên ở số 112 .`_grade`- `_grade_label`- `_percent_change`- `_total`từ thư viện 1, và 4 đến 7 là `___stack_chk_fail`- `___stack_chk_guard`- `_printf`- `_puts`từ thư viện 2. `fixup_rows()`kết hợp hai bảng vào các dòng `dyld_info -fixups`Nhận dạng:`__DATA_CONST __got 0x100004038 bind libSystem/_puts`, và bài kiểm tra so sánh cả hai.

Vậy là "đạo chỉ dẫn tham nhũng" ở `0x100004038`là nhập khẩu 7. dyld đi bộ chuỗi này một lần, khi tải, và viết địa chỉ của `_puts`vào khe cắm. Cuộc họp WWDC22 của Apple đã đưa ra như sau: "trong vị trí chỉ dẫn 64 bit trong DATA, một số bit chứa sự thay thế đến vị trí sửa chữa tiếp theo. Ngoài ra, có một bit nói rằng nếu sửa chữa là một liên kết hoặc một rebase. " Xcode 13 đã làm cho định dạng mặc định cho mục tiêu triển khai của macOS 12 hoặc iOS 15, và Xcode 13.3 mở rộng nó đến macOS 11 và iOS 13.4. Không có sự liên kết lười biếng trong định dạng này. Mỗi khe đều được kết nối trước.`main`chạy.

### Layout nó thay thế

`ledger_main_nochain`là liên kết tương tự với `-Wl,-no_fixup_chains`- Nó đã làm vậy.`LC_DYLD_INFO_ONLY`thay vào đó, với bốn bảng có mã oct: rebase 8 bytes, bind 72, lười tie 120, xuất 64. Nó cũng có ba phần file chuỗi thiếu: `__TEXT,__stub_helper`(108 byte), một `__got`chỉ có 16 byte giữ `___stack_chk_guard`và `dyld_stub_binder`, và`__DATA,__la_symbol_ptr`(56 byte, bảy khe). `dyld_info -fixups`danh sách bảy `lazy-bind`hàng và bảy rebases chỉ mỗi khe lười biếng vào trampoline của riêng nó trong `__stub_helper`Trampoline đẩy một chỉ số và nhảy lên`dyld_stub_binder`, giải quyết tên và viết khe. Đó là PLT và GOT của phần trước trong hình Mach-O: `__la_symbol_ptr`là `.got.plt`- `__stub_helper`là PLT0 và `pushq $index`, và`dyld_stub_binder`là `_dl_runtime_resolve`- `code/main.py`báo cáo các bản sao và phần của tệp này và không giải mã mã mã mã mã liên kết; phòng thí nghiệm thực hành yêu cầu điều đó.

### Các xuất khẩu tri

`LC_DYLD_EXPORTS_TRIE`là một cây tiền tố. Mỗi nút là một kích thước cuối uleb128, sau đó, nếu không bằng 0 thì uleb128 cờ và một uleb128 bù trừ, sau đó một byte của con số và, cho mỗi đứa trẻ, một cạnh chuỗi và một uleb128 nút bù trừ. `exports_trie()`Đi đi.`libledger.dylib`Nó quay lại.`_percent_change 0x410`- `_grade 0x428`- `_total 0x464`- `_grade_label 0x498`, bốn sự bù đắp `dyld_info -exports`Nhận được dấu vân tay.`__mh_execute_header`- `_fns`, và`_main`- Tôi không biết.

## Những gì dải Quay

Apple `strip(1)`nói rằng không có tùy chọn trên một thực thi liên kết động nó cư xử như `-u -r`: lưu các biểu tượng không xác định và các biểu tượng tham chiếu động. `-x`loại bỏ các biểu tượng địa phương. `-N`loại bỏ toàn bộ bảng biểu tượng và bảng chuỗi. "Đối với các thư viện chia sẻ động, mức tối đa của việc loại bỏ thường là -x", vì "Chỉ các biểu tượng toàn cầu được sử dụng bởi quá trình liên kết động".

Được quan sát trên các thiết bị của chúng tôi.`strip ledger_main`- Tôi đã lấy`LC_SYMTAB`từ 12 đến 10 hồ sơ và xóa `_main`- `_fns`, và`_names`. tám nhập khẩu không xác định vẫn còn, bởi vì DILD cần tên của họ để kết nối, và`__mh_execute_header`ở lại vì nó là `REFERENCED_DYNAMICALLY`- Lần thứ 10 là một đâm kiểu như vậy.`N_OPT`tên `radr://5614542`, mà các công cụ của Apple viết để bàn không bao giờ trống rỗng;`nm`chương trình bị tẩy ra in cùng ba dòng như bản gốc và thoát ra 0. `LC_FUNCTION_STARTS`vẫn còn một khởi đầu,`main`- Tôi không biết.

`strip libledger.dylib`Không có lựa chọn nào đi xa hơn bình thường của người đàn ông trang `-x``LC_SYMTAB`có 0 hồ sơ và `nm`Dữ liệu "không có biểu tượng". Trie xuất vẫn liệt kê bốn hàm ở cùng một sự bù đắp, bởi vì Dyld liên kết qua trie và không bao giờ qua.`LC_SYMTAB`- `LC_FUNCTION_STARTS`Lab C liên kết một cái mới`main.c`chống lại Dyllib bị tước đi để chứng minh rằng trình biên tập liên kết cũng được phục vụ bởi Trie.

| What | ELF after `--strip-all` | PE image | Mach-O after `strip` |
|---|---|---|---|
| static symbol table | gone | never present in an image | local and defined names gone, undefined imports stay |
| names the loader binds | `.dynsym` and `.dynstr` stay | import directory stays | imports stay in `LC_SYMTAB` and in the chained imports table |
| exported names | `.dynsym` stays | export directory stays | exports trie stays |
| function starts | `.eh_frame` FDEs, unless built without unwind tables | `.pdata` for non-leaf functions | `LC_FUNCTION_STARTS` stays |
| debug information | `.debug_*` gone | in the PDB, never in the image | in the dSYM, never in the image |
| section or load command headers | stay unless `--strip-section-headers` | stay | stay |

## Tìm các chức năng mà không có biểu tượng

`static-arm64-O2`liên kết`main-arm64-O2.o`và `ledger-arm64-O2.o`thành một tính năng thực thi với năm chức năng trong `__text`- `nm -n`của các tập tin không bị cắt là sự thật cơ bản: `_main``0x100000500`(244 byte), `_percent_change``0x1000005f4`(24), `_grade``0x10000060c`(60), `_total``0x100000648`(248), `_grade_label``0x100000740`(72). `static-arm64-O2.stripped`Không có `N_SECT`biểu tượng bên trong `__text`- `FunctionFinder`chạy bốn phương pháp trên nó và `score()`so sánh từng danh sách với sự thật.

### LC_FUNCTION_STARTS

Chỉ huy chỉ định ở 9 byte trong `__LINKEDIT``80 0a f4 01 18 3c f8 01 00`. định dạng là uleb128 delta, đầu tiên từ `__TEXT`Địa chỉ.`80 0a`là `0x500`, nên khởi đầu đầu là`0x100000500`- `f4 01`là `0xf4`, vậy `0x1000005f4`- `18`cho `0x10000060c`- `3c`cho `0x100000648`- `f8 01`cho `0x100000740`, và`00`5 trong 5 không có dương tính sai, ở`-O0`và ở`-O2`. biên tập viên liên kết viết bảng này cho máy tháo và phóng viên vụ tai nạn, và `strip`Ghidra đọc nó trong phân tích "Mach-O Function Starts" của nó.`dyld_info -function_starts`in nó, và LIEF phơi bày nó như `function_starts`- Tôi không biết.

### Hình ảnh đầu tiên

Các mô hình khởi động AARCH64 của Ghidra bắt đầu với `fd 7b bf a9`, đó là `stp x29, x30, [sp, #-0x10]!`Trên các tập tin của chúng tôi nó tìm thấy 0 của 5 ở cả hai cấp độ.`sub sp, sp, #N`Đầu tiên và sau đó`stp x29, x30, [sp, #M]`với một sự thay đổi tích cực, do đó hình thức pre-index không bao giờ xảy ra.`sub sp, sp, #imm`- `(word & 0xff0003ff) == 0xd10003ff`, tìm thấy 5 trong 5 tại `-O0`, nơi mỗi hàm có khung, và 1 trong 5 tại `-O2`, nơi `percent_change`- `grade`- `total`, và`grade_label`là các chức năng lá mà không có khung gì cả. `percent_change`bắt đầu với `cbz w0, ...`Một quét đầu tiên báo cáo những gì người biên dịch đã chọn phát ra, và bài học 38 cho thấy bao nhiêu lần đó là không có gì.

Không có scan nào tạo ra dương tính sai ở đây, bởi vì chương trình nhỏ.`55`của `push rbp`Nhập vào bên trong các hướng dẫn khác, đó là lý do tại sao các tệp mẫu x86-64 của Ghidra kết hợp một mẫu sau như `55 48 89 e5`với một mẫu trước như `ret`hoặc `nop`Điều đó phải chấm dứt chức năng trước đó.

### Các mục tiêu gọi

Mỗi người`bl`trong `__text`đặt tên một hàm bắt đầu, bởi vì `bl`vào giữa một hàm là một cái gì đó một trình biên dịch không phát ra cho C. Việc mã hóa là `0x94000000`với chữ ký 26 bit từ thay thế.`bl``0x1000005a0`đọc `3d 00 00 94``0x3d`là 61, nhân 4 là `0xf4`, nên mục tiêu là`0x100000694`- Trong`ledger_main`Đó là cái cột của `_puts`Trong cấu trúc tĩnh,`call_targets()`thu thập các mục tiêu bên trong `__text`, thả những người đổ bộ vào `__stubs`, và thêm `LC_MAIN`Không có gì gọi.`main`. Năm trong năm ở cả hai cấp độ. Nucleus (Andriesse, Slowinska, Bos, 2017) xây dựng phát hiện chức năng của mình dựa trên ý tưởng này cho mã được tạo bởi trình biên dịch, và Andriesse và những người khác đo lường vào năm 2016 rằng ranh giới chức năng là phần khó khăn nhất của việc tách ra, khó hơn ranh giới hướng dẫn.

## Một chữ ký hình như một cái lăng

Hex-Rays mô tả FLIRT trong tài liệu của nó: một mẫu là "32 byte đầu tiên của một hàm nơi tất cả các byte biến thể được đánh dấu", các byte biến thể đến từ các cố định và tham chiếu bên ngoài, các mẫu sống trong một cây, và ngoài mẫu "chúng tôi tính toán CRC16 của các byte bắt đầu từ vị trí 33 cho đến byte biến thể đầu tiên" và lưu trữ chiều dài đó. Hai hàm với cùng một mô hình và CRC được chia tách bởi một byte đuôi ở một vị trí nơi chúng khác nhau, sau đó bởi các tên mà chúng tham khảo. Một vụ va chạm mà không có gì tách rời được "được giải quyết bởi trí thông minh tự nhiên". Các chức năng ngắn hơn bốn byte mà không có tham chiếu bên ngoài được loại trừ, và "tệp chữ ký không chứa bất kỳ byte nào từ thư viện ban đầu, ngoại trừ tên của các chức năng".

`signatures_from_object()`xây dựng từ `ledger-arm64-O2.o`và `main-arm64-O2.o`, cách mà FLAIR xây dựng nó từ các vật thể của thư viện.`relocation_info`ghi lại bao gồm một từ bốn byte, và những byte trở thành biến thể.`.pat`bố cục đường, được ghi lại trong trình phân tích của rizin, là mô hình, chiều dài CRC, CRC16, chiều dài hàm,`:0000`và tên, và `^offset name`cho mỗi tên tham chiếu:

```text
A00000342800004B890C8052087D091B000DC01AC0035FD6 00 0000 0018 :0000 _percent_change
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 003C :0000 _grade ^0000 l_switch.table.grade ^0001 l_switch.table.grade
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 0048 :0000 _grade_label ^0000 l_switch.table.grade_label ^0001 l_switch.table.grade_label ^0002 _labels ^0003 _labels
```

`_percent_change`là 24 byte, do đó mô hình của nó là toàn bộ hàm và chiều dài CRC là 0. `_grade`là 60 byte với việc di chuyển đầu tiên ở byte 36, vì vậy CRC bao gồm bốn byte.`.pat`sử dụng các parsers: polynomial `0x8408`, giá trị ban đầu `0xffff`, bổ sung, sau đó trao đổi hai byte. giá trị của nó cho chuỗi ASCII "123456789" là `0x6e90`, và các con trục thử nghiệm đó.

`match_signatures()`thử tất cả các chữ ký tại mỗi khởi đầu chức năng của cấu trúc bị tẩy, mẫu trước, sau đó là CRC.`-O0`Tất cả 5 chức năng đều có tên của họ và không có gì va chạm.`-O2`Hai đường trên đụng độ.`grade_label``grade`, vì vậy hai hàm chia sẻ 36 byte đầu tiên của họ và bốn byte CRC.`0x10000060c`và ở`0x100000740`Chân chia chúng: ở 44 byte`_grade`- Có `20`và `_grade_label`- Có `28`, đó là `ldr w0, [x9, w8, uxtw #2]`chống lại`ldr x8, [x9, w8, uxtw #3]`Báo cáo ghi lại cả đụng độ và số byte quyết định chúng.

Thử nghiệm`test_object_bytes_equal_linked_bytes_outside_relocated_words`kiểm tra tiền đề: mỗi byte không biến của mỗi hàm đối tượng bằng với byte tại cùng một trục xuất trong trình thực được liên kết, do đó trình chỉnh sửa liên kết chỉ thay đổi các từ được chuyển. `_total`không có chuyển đổi và không có thay đổi byte.

### Những công cụ làm gì với cùng một ý tưởng

IDA Pro 9.4 gửi FLIRT chữ ký cho mỗi bộ xử lý và các `sigmake`Công cụ để xây dựng chúng; IDA Free chỉ bao gồm x86 và x86-64 và là cho việc sử dụng phi thương mại. Lumina là một máy chủ chìa khóa metadata chức năng bằng md5 của chức năng và bỏ qua các chức năng dưới 32 byte. Ghidra 12.1.4 (Apache-2.0) có ID chức năng: một hash đầy đủ trên mnemonics và các chế độ giải quyết "rút mạnh chống lại thay đổi do liên kết" và một hash cụ thể thêm các operand liên tục, được ghi theo chỉ dẫn phù hợp, với các chức năng cha mẹ và con như tie-breakers; cơ sở dữ liệu được gửi của nó chỉ bao gồm các thư viện Visual Studio, và bạn lấp đầy của riêng bạn từ các nhị phân của riêng bạn. Binary Ninja 6.0 Krypton (thị mại, với phiên bản miễn phí) sử dụng WARP (Apache-2.0): hàm GUID là một UUIDv5 trên các GUID khối cơ bản, mỗi một UUIDv5 trên các byte khối sau khi đánh giá "tất cả các hướng dẫn có thể di chuyển" và bỏ ra NOP, với gọi, người gọi và các hàm lân cận như là hạn chế. BinDiff 8 (Apache-2.0) phù hợp các chức năng giữa hai bộ nhị phân với một thứ tự các bước cố định, từ sự phù hợp hash thông qua chỉ số MD đồ thị dòng chảy đến gọi sự phù hợp chuỗi, và cân nhắc sự tương đồng từ các cạnh, khối, hướng dẫn phù hợp và chỉ số MD đồ thị dòng chảy. Diaphora 3.4.3 (AGPL-3.0, chỉ IDA) thêm sản phẩm số nguyên tố nhỏ, nơi mỗi bản đồ mnemonic đến một số nguyên tố và một hàm là sản phẩm, một dấu vân tay đa bộ không đặt hàng. radar2 6.2.4 (LGPL-3.0) có chữ ký (`zg`- `z/`- `zb`) và đọc là FLIRT `.sig`các tệp với `zfs`; rizin 0.9.1 (LGPL-3.0) tạo ra `.pat`hoặc `.sig`từ một binary mở với `Fc`và áp dụng một với `Fs`- Tôi không biết.

IDA và Binary Ninja đã đóng cửa và được mô tả ở đây từ tài liệu của họ. radar2 và rizin không được cài đặt trên máy này, và các lệnh của họ được trích dẫn từ sách và nguồn của họ.`clang`- `ld`- `llvm-objdump`- `otool`- `nm`- `strip`, và`dyld_info`từ các công cụ dòng lệnh, và LIEF 1.0.0, pyelftools 0.33, và hồ sơ 2024.8.26 thông qua thăm dò. LIEF đọc tất cả các định dạng ở đây, bao gồm cả các đối tượng COFF, mà nó đã hỗ trợ từ 0.17.0, và báo cáo mười liên kết và hai cơ sở trên `ledger_main`, cùng 12 sửa chữa. các công cụ đọc các tập tin ELF chỉ. hồ sơ từ chối`main-x86_64.obj`với `PEFormatError: 'DOS Header magic not found.'`và đọc hình ảnh nhỏ bé.

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một báo cáo JSON với năm phần. `elf`giữ số lượng di chuyển của hai đối tượng, kế hoạch liên kết và phần động lực, PLT và GOT của `tiny-dyn-x86_64`- `coff`giữ các phần, di chuyển, chức năng và tên không xác định của hai đối tượng. `pe`giữ các tiêu đề, thư mục, nhập khẩu, xuất khẩu, di chuyển cơ sở và các cuộc gọi IAT của `tiny-x86_64.exe`- `macho`giữ `ledger_main`Với những mảnh cây, các chuỗi sửa chữa, các hàng sửa chữa, và xuất khẩu, bố cục di sản của `ledger_main_nochain`, Dylib, và hai báo cáo về tình trạng.`identification`Có sự thật, bốn phương pháp với điểm số, và các chữ ký với sự va chạm của chúng, tại `-O0`và `-O2`- Tôi không biết.

Hình dạng dự kiến:

```json
{
  "elf": {"linkPlan": {"pltSymbols": ["puts", "printf"], "sizes": {".plt": 48, ".got.plt": 40, ".rela.plt": 48, ".rela.dyn": 48}, "...": "..."}, "tiny-dyn-x86_64": {"...": "..."}},
  "coff": {"main-x86_64.obj": {"...": "..."}},
  "pe": {"imports": [{"dll": "msvcrt.dll", "iat": "0x2040", "...": "..."}], "...": "..."},
  "macho": {"ledger_main": {"flags": "0x200085", "fixupRows": ["__DATA_CONST __got 0x100004000 bind libledger/_grade", "..."], "...": "..."}, "strip": {"...": "..."}},
  "identification": {"O2": {"methods": {"functionStarts": {"recall": "5/5"}, "prologueSub": {"recall": "1/5"}, "...": "..."}, "correctNames": 5}}
}
```

Đọc `code/main.py`theo thứ tự này:

1. `ElfFile`đọc tiêu đề, phần, cả hai bảng biểu tượng, và di chuyển, và `dynamic_entries()`- `jump_slots()`- `plt_entries()`, và`plt0()`đọc hình ảnh liên kết.
2. `plan_dynamic_link()`áp dụng bảng 4.9 và phần 5.2 đối với hồ sơ di chuyển của các vật thể có thể di chuyển.
3. `CoffObject`đọc tiêu đề tập tin, bảng phần, các biểu tượng 18 byte với các hồ sơ phụ trợ của chúng, và chuyển đổi 10 byte.
4. `PeImage`đọc các đoạn MS-DOS, chữ ký PE, tiêu đề tùy chọn, thư mục dữ liệu, phần, và các thư mục nhập khẩu, xuất khẩu và di chuyển cơ sở, và `iat_calls()`decodes `ff 15`- Tôi không biết.
5. `MachoFile`đọc lệnh tải, phân đoạn, `nlist`ghi, bảng biểu tượng gián tiếp, các đoạn, các sửa chữa chuỗi, các thử nghiệm xuất khẩu và di chuyển đối tượng.
6. `FunctionFinder`chạy bốn người tìm kiếm bắt đầu và `score()`so sánh mỗi điều với sự thật.
7. `signatures_from_object()`và `match_signatures()`xây dựng và áp dụng các chữ ký hình FLIRT.
8. - `parse_*`các chức năng đọc văn bản công cụ được ghi lại mà các thử nghiệm so sánh với.

Các lệnh khác:`python3 code/main.py elf FILE`- `coff FILE`- `pe FILE`, và`macho FILE`in một báo cáo. `python3 code/main.py plan OBJECT...`in kế hoạch liên kết cho bất kỳ bộ vật thể ELF nào. `python3 code/main.py functions STRIPPED UNSTRIPPED OBJECT...`ghi điểm của người tìm và chữ ký trên một cặp khác của bạn xây dựng.

## Sử dụng nó

Sử dụng các độc giả theo thứ tự này trên một chương trình bạn xây dựng.

1. Đọc tiêu đề và đặt tên định dạng và loại hình: vật thể có thể di chuyển, thể hiện hoặc thư viện chia sẻ. Người đọc từ chối những gì họ không biết, và từ chối đó là thông tin.
2. Đăng danh nhập khẩu với các nhà cung cấp: `DT_NEEDED`và `.dynsym`, danh mục nhập khẩu hoặc bảng nhập khẩu chuỗi và`LC_LOAD_DYLIB`Mỗi lần gọi tên trong danh sách đó đều bỏ qua hình ảnh.
3. Theo dõi một cuộc gọi bằng tay đến khe cắm của nó. Viết ra các byte gọi, các stub hoặc byte PLT, địa chỉ khe cắm, từ trong tệp và những gì tải ở đó. Nếu từ trong tệp trông giống như rác, hãy giải mã nó như một sửa chữa trước khi bạn gọi nó là rác.
4. So sánh bảng biểu tượng với xuất khẩu và chức năng bắt đầu.`strip`Tên chỉ cần một người sửa lỗi không cần.
5. Trong một cấu trúc bị tước, chạy các trình tìm kiếm bạn có thể chạy và ghi điểm chúng chống lại cặp đôi không bị tước khi bạn vẫn còn một. `LC_FUNCTION_STARTS`- `.pdata`, hoặc`.eh_frame`, trên các mẫu byte, và sử dụng mục tiêu gọi để lấp đầy khoảng trống.
6. Xây dựng chữ ký từ các đối tượng của riêng bạn và áp dụng chúng. ghi lại mọi vụ va chạm và các byte chia nó. Một tên mà hai chữ ký tuyên bố là một người không biết đến cho đến khi đuôi hoặc một tên tham chiếu quyết định nó.

Giữ văn bản công cụ được ghi lại với các tệp. Khi chuỗi công cụ thay đổi, lấy lại, bởi vì một danh sách thay đổi là một vật cố định thay đổi.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: PLT bằng tay

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code
python3 -q
```

Đi chạy:

```python
from main import *
elf = load_elf("tiny-dyn-x86_64")
[(e.tag_name, e.text) for e in elf.dynamic_entries()]
elf.plt0()
[(e.symbol, hex(e.address), hex(e.slot), hex(e.slot_initial)) for e in elf.plt_entries()]
[hex(w) for w in elf.got_plt_words()]
```

Trước mỗi cuộc gọi, tính toán câu trả lời từ các byte trong văn bản trên. Sau đó thay đổi `IMPORTS`trong `build_tiny_dyn_elf.py`để ba tên, xây dựng lại, và dự đoán các kích thước mới của `.plt`- `.got.plt`, và`.rela.plt`trước khi đọc chúng.

### Phòng thí nghiệm B: một sự sửa chữa dây chuyền

```python
exe = load_macho("ledger_main")
stub = next(s for s in exe.stubs() if s.symbol == "_puts")
stub.lines()
raw = int.from_bytes(exe.read(stub.slot, 8), "little")
hex(raw), raw >> 63, (raw >> 51) & 0xfff, raw & 0xffffff
[(i.index, i.name, i.library) for i in exe.chained_fixups()["imports"]]
```

Tự giải mã từ liên kết trên giấy trước tiên: bit liên kết, `next`trường trong đơn vị bốn byte, đơn vị thứ tự. sau đó đọc từ tám byte hơn nữa và xác nhận nó là fixup tiếp theo. sau đó đọc từ cuối cùng của chuỗi tại`0x100004058`và giải thích tại sao nó `next`là không.

### Phòng thí nghiệm C: trượt và nối lại

Trong thư mục đồ đạc, liên kết một chương trình mới với các dilib hoàn toàn khô:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/fixtures
clang -target arm64-apple-macos -O1 main.c -L. -lledger.stripped -Wl,-rpath,@executable_path -o /tmp/relinked
nm /tmp/relinked | grep ' U '
dyld_info -exports libledger.stripped.dylib
```

Kết nối thành công với một thư viện mà `LC_SYMTAB`là trống, bởi vì trình chỉnh sửa liên kết đọc các xuất trie.`python3 ../main.py macho libledger.stripped.dylib`và so sánh`symtab`- `exports`, và`functionStarts`Sau đó, hãy dỡ bỏ cấu trúc tĩnh bằng`-N`thay vì và xem cái gì `dyld_info -function_starts`vẫn còn dấu vân tay.

### Phòng thí nghiệm D: vụ va chạm

```python
from main import *
stripped = load_macho("static-arm64-O2.stripped")
sigs = signatures_from_object(load_macho("ledger-arm64-O2.o"))
[s.pat_line() for s in sigs]
starts = FunctionFinder(stripped).function_starts()
match_signatures(sigs, stripped, starts)
```

Hãy đọc 2 hồ sơ vụ va chạm rồi tạo ra chữ ký từ`ledger-arm64-O0.o`, so sánh chúng với `static-arm64-O0.stripped`, và giải thích từ `.pat`đường tại sao không xảy ra va chạm ở `-O0`Rồi rút ngắn đi.`PATTERN_LENGTH`đến 16 và đếm số lượng các hàm va chạm.

## Phòng thí nghiệm thực hành

Khóa mã các bảng liên kết cũ và thêm bộ tìm PE.

Yêu cầu:

- - Thử giải mã `LC_DYLD_INFO_ONLY`rebase, bind, và lười tieo liên kết các dòng opcode của `ledger_main_nochain`thành hàng với phân đoạn, phần, địa chỉ, loại và mục tiêu, và làm cho chúng bằng với 21 hàng trong các hình ảnh được chụp `dyld_info -fixups`- Thư.
- Thêm một `PT_GNU_RELRO`tiêu đề chương trình và một `DT_FLAGS`với `DF_BIND_NOW`đến`build_tiny_dyn_elf.py`, di chuyển`.got.plt`bên trong phạm vi bao phủ, và làm `llvm-objdump -p`cho thấy tiêu đề mới. nói trong các thiết bị README phần nào của RELRO đầy đủ này tái tạo và phần nào chỉ có thể thực hiện glibc.
- Hãy viết một `.pdata`đọc cho hình ảnh PE32+ và tìm hàm sử dụng `RUNTIME_FUNCTION`bắt đầu địa chỉ. Xây dựng một đối tượng với `clang -target x86_64-pc-windows-msvc -c`Không có `-fno-asynchronous-unwind-tables`, đọc nó `.pdata`Các chức năng này được chuyển đổi theo quy định tại bảng này.
- Viết một bài kiểm tra cho mỗi người đọc so sánh với văn bản công cụ được ghi lại.

Thành công là nghĩa của`python3 code/main.py macho ledger_main_nochain`in cùng 21 hàng sửa chữa như `dyld_info`Nhìn vân tay, ELF nhỏ gọn mang theo một `PT_GNU_RELRO`Đó là`llvm-objdump`danh sách, và các `.pdata`tìm kiếm tên các chức năng nó có thể và liệt kê các chức năng lá nó không thể.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-linking-loading-and-stripped-binaries.md`Sử dụng nó để biến một chương trình bạn xây dựng thành một danh sách nhập khẩu của nó với các nhà cung cấp của họ, một cuộc gọi theo dõi đến khe cắm tải điền, một tuyên bố về những gì `strip`Nó đòi hỏi cặp đôi không bị cắt như sự thật căn bản, một danh sách công cụ bắt giữ cho mỗi yêu cầu, và một hồ sơ của mỗi va chạm.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

Việc kiểm tra phải chứng minh:

- phần năng động của `tiny-dyn-x86_64``llvm-objdump -p`Tag cho tag, và `DT_FLAGS_1`mang `DF_1_PIE`
- Hai người `R_X86_64_JUMP_SLOT`Hồ sơ phù hợp`llvm-objdump -R`và tên `puts`và `exit`
- PLT0 đẩy GOT+8 và nhảy qua GOT+16, mỗi mục đọc khe và đẩy chỉ số của nó, và mỗi khe chứa địa chỉ của riêng nó `pushq`
- Các phần và tiêu đề chương trình của trận đấu ELF nhỏ `llvm-objdump -h -p`
- Các hồ sơ di chuyển của hai vật thể ELF phù hợp `llvm-objdump -r`
- kế hoạch liên kết tìm thấy hai biểu tượng PLT, bốn cuộc gọi trực tiếp, hai di chuyển tương đối, và kích thước của hình ảnh nhỏ
- bảng phần COFF, 37 ký hiệu ghi lại với các ký hiệu phụ trợ, và di chuyển phù hợp `llvm-objdump -h -t -r`, và`/16`quyết định `.llvm_addrsig`
- ba COFF `REL32`ghi chép của `ledger`ngồi ở 3 ELF `PC32`bồi thường
- Các tiêu đề PE, `DllCharacteristics`, và các thư mục dữ liệu phù hợp `llvm-objdump -p`
- danh mục nhập khẩu, mục gợi ý/tên và sự phù hợp IAT `llvm-objdump`và `pefile`, và IAT bằng bảng tìm kiếm trước khi kết nối
- danh mục xuất khẩu và `DIR64`mã giải mã chuyển đổi cơ sở, và chỉ số chuyển đổi đặt tên chuỗi "đối kết bằng tay"
- `ff 15`tại RVA `0x100b`giải quyết cho khe IAT của `puts`
- Các lá cờ Mach-O, tên lệnh tải 19 và hai thư viện phù hợp.`otool`
- 7 đoạn mã hóa thành 8`__got`khe cắm và các bảng biểu tượng gián tiếp `otool -Iv`
- Các cái đầu của các bộ sợi dây đeo kết hợp.`llvm-objdump --macho --chained-fixups`
- chuỗi đi lại tái tạo tất cả mười hai từ thô của `dyld_info -fixup_chain_details`
- Các hàng cố định và bảng nhập khẩu phù hợp `dyld_info -fixups`và `-imports`
- xuất khẩu trie phù hợp `dyld_info -exports`Đối với cây đà và bản sao của nó bị cất
- `nm_lines()`=`nm -m`cho các bản sao có thể thực hiện và bản sao bị cởi
- `strip`được loại bỏ`_main`- `_fns`, và`_names`, giữ 9 tên và 1 `radr://5614542`đâm, và chương trình bị tước đi in cùng đầu ra
- thiết kế kế cũ đã có `LC_DYLD_INFO_ONLY`, bảy điểm chỉ lười biếng, và thả xuống `__stub_helper`
- arm64 đối tượng di chuyển phù hợp `llvm-objdump -r`
- `LC_FUNCTION_STARTS`phục hồi 5 trong 5 ở cả hai cấp độ và bằng nhau `nm`và `dyld_info -function_starts`
- `sub sp`Scan tìm thấy 5 trong 5 ở `-O0`và một trong năm ở `-O2`, và `stp`khung scan không tìm thấy
- `bl`mục tiêu cộng với `LC_MAIN`nhập cảnh thu hồi năm trong năm
- Các chữ ký đặt tên cho tất cả năm chức năng ở cả hai cấp độ và ghi lại các `grade`đụng độ chia bằng 44 byte
- CRC16 của "123456789" là `0x6e90`, và tám byte dưới cặp tải GOT của `main`là biến thể
- mỗi byte đối tượng không biến đổi bằng với byte liên kết
- Các mô hình demo và dữ liệu số báo cáo các địa chỉ tương tự, và mô-đun trang web nhúng các dữ liệu tương tự trong ES5

## Các chế độ sản xuất thất bại

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

## Quy tắc hoạt động

Theo dõi mọi cuộc gọi bên ngoài từ trang web cuộc gọi đến khe cắm mà bộ tải chứa, và giải mã từ trong khe đó như định dạng xác định nó trước khi bạn gọi nó là địa chỉ. Chỉ cần thu thập những gì cần thiết cho bộ tải. Công việc phục hồi bắt đầu từ các bảng mà trình chỉnh sửa liên kết đã viết trước khi bạn quét các byte, đánh giá mỗi người tìm kiếm với một cặp đôi với các biểu tượng, và ghi lại mỗi sự va chạm chữ ký với các byte chia nó.

## Đọc thêm

- [System V gABI, chapter 5: Program Loading and Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement: section 5.2 and Table 4.9](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Drepper, "How To Write Shared Libraries", version 4.1.2](https://akkadia.org/drepper/dsohowto.pdf)
- [Drepper, "ELF Symbol Versioning"](https://akkadia.org/drepper/symbol-versioning)
- [Jelinek, "Little hardening DSOs/executables against exploits", binutils list, 2004-01-06](https://www.sourceware.org/ml/binutils/2004-01/msg00070.html)
- [Taylor, "Linker relro", 2008](https://www.airs.com/blog/archives/189)
- [binutils commit bd7ab16b: PLT32 for calls, 2018-02-13](https://gnu.googlesource.com/binutils-gdb/+/bd7ab16b4537788ad53521c45469a1bdae84ad4a)và [LLVM D43383](https://reviews.llvm.org/D43383)
- [GNU Binutils: strip](https://sourceware.org/binutils/docs/binutils/strip.html)và [llvm-objcopy](https://llvm.org/docs/CommandGuide/llvm-objcopy.html)
- [Microsoft, PE Format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [CALL instruction reference, FF /2](https://www.felixcloutier.com/x86/call)
- [Apple, mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)và [mach-o/nlist.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)
- [Apple dyld, mach-o/fixup-chains.h](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/fixup-chains.h)
- [Apple ld64, stub_arm64.hpp](https://github.com/apple-oss-distributions/ld64/blob/main/src/ld/passes/stubs/stub_arm64.hpp)
- [Xcode 13 release notes: chained fixups](https://developer.apple.com/documentation/xcode-release-notes/xcode-13-release-notes)và [WWDC22 session 110362, "Link fast: Improve build and launch times"](https://developer.apple.com/videos/play/wwdc2022/110362/)
- [strip(1)](https://keith.github.io/xcode-man-pages/strip.1.html)- [ld(1)](https://keith.github.io/xcode-man-pages/ld.1.html), và[dyld(1)](https://keith.github.io/xcode-man-pages/dyld.1.html)
- [Hex-Rays, IDA F.L.I.R.T. Technology: In-Depth](https://docs.hex-rays.com/core/flirt/concepts/ida-f.l.i.r.t.-technology-in-depth)và [Lumina overview](https://docs.hex-rays.com/add-ons/lumina/overview)
- [Ghidra Function ID help](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/FunctionID/src/main/help/help/topics/FunctionID/FunctionID.html)và [AARCH64 function start patterns](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/patterns/AARCH64_LE_patterns.xml)
- [Vector 35, WARP](https://github.com/Vector35/warp)và [Binary Ninja WARP guide](https://docs.binary.ninja/guide/warp.html)
- [BinDiff manual](https://www.zynamics.com/bindiff/manual/)và [BinDiff source](https://github.com/google/bindiff)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [rizin pat.c, the .pat parser](https://github.com/rizinorg/rizin/blob/dev/librz/sign/pat.c)- [radare2 flirt.c](https://github.com/radareorg/radare2/blob/master/libr/anal/flirt.c), và[radare2 book: Zignatures](https://book.rada.re/signatures/zignatures.html)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)và [Andriesse, Slowinska, Bos, "Compiler-Agnostic Function Detection in Binaries" (EuroS&P 2017)](https://danielandriesse.com/papers/eurosp-2017.pdf)
- [Bao et al., ByteWeight (USENIX Security 2014)](https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/bao)và [Shin, Song, Moazzezi, "Recognizing Functions in Binaries with Neural Networks" (USENIX Security 2015)](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/shin)
- [LIEF changelog](https://lief.re/doc/latest/changelog.html)- [pyelftools](https://github.com/eliben/pyelftools), và[pefile](https://github.com/erocarrera/pefile)
