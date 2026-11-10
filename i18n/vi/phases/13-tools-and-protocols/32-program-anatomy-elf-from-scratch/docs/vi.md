# Phân tích chương trình: Một người đọc ELF từ đầu

> Một chương trình được biên soạn là một tập hợp các bảng chỉ vào nhau. Một trình đọc mà bạn đã viết cho ra hiệu mà bạn có thể kiểm tra byte byte.

**Type:** Build
**Languages:** Python (stdlib), TypeScript, C (fixture only)
**Prerequisites:** Phase 0 · 01 (Dev Environment) with clang installed, Python 3.10 or later, hexadecimal arithmetic
**Time:** ~120 minutes

## Mục tiêu học tập

- Cụ thể quy tắc cho phép cho mỗi mục tiêu trong đường đua này và bốn giới hạn của 17 U.S.C. 1201 ((f).
- Đọc tiêu đề ELF, bảng tiêu đề phần và cả hai bảng chuỗi với `struct.unpack`- Tôi không biết.
- Tự giải mã `.symtab`Các mục và `.rela`ghi chép với tên từ gABI và x86-64 psABI.
- Trả lại các byte chính xác của một hàm có tên và lập bản đồ mỗi tệp được chuyển đổi sang cấu trúc sở hữu nó.
- Đọc tiêu đề chương trình và lập bản đồ địa chỉ ảo cho một tệp được chuyển đổi qua `PT_LOAD`- Tôi không biết.
- Đọc lệnh tải của một vật thể Mach-O và đặt tên cho ý tưởng ELF mà mỗi vật thể phù hợp.

## Trước khi bắt đầu: Giấy phép và Luật pháp

Mỗi mục tiêu trong bài học 32 đến 36 là một chương trình mà bạn đã viết và biên soạn.`code/fixtures/ledger.c`Bạn sở hữu nguồn, lệnh biên dịch và các tệp đối tượng nó tạo ra. Không có giấy phép đọc, không có bảo vệ để thông qua, và không có bên thứ ba mà bạn mở mã.

Quy tắc tồn tại bởi vì luật pháp coi việc tháo rời như là sao chép. Tại *Sega Enterprises Ltd. v. Accolade, Inc.*, 977 F.2d 1510 (9th Cir. 1992), tòa án đã phán quyết rằng các bản sao trung gian được thực hiện trong quá trình tháo gỡ là bản sao theo Luật Bản quyền. Sau đó, tòa tuyên bố rằng "nếu việc tháo gỡ là cách duy nhất để có được quyền truy cập vào những ý tưởng và các yếu tố chức năng được thể hiện trong một chương trình máy tính có bản quyền và nếu có lý do hợp pháp để tìm kiếm quyền truy cập như vậy, việc tháo gỡ là một cách sử dụng công bằng tác tác phẩm có bản quyền, như một vấn đề pháp lý". 

Trường hợp thứ hai là * Sony Computer Entertainment, Inc. v. Connectix Corp.*, 203 F.3d 596 (9th Cir. 2000). Connectix đã sao chép PlayStation BIOS trong khi nó xây dựng một trình mô phỏng, và tòa án cho rằng các bản sao đó được sử dụng công bằng. Cả hai trường hợp đều bảo vệ nghiên cứu.

Hai quy định đặt ra giới hạn. 17 U.S.C. 1201 ((f) cho phép một người "đã có được pháp lý quyền sử dụng bản sao của một chương trình máy tính" đi vòng qua kiểm soát truy cập "nhằm mục đích duy nhất xác định và phân tích những yếu tố của chương trình cần thiết để đạt được khả năng tương tác của một chương trình máy tính được tạo ra độc lập với các chương trình khác". Bốn ngăn giới hạn: một bản sao hợp pháp, mục đích tương tác, các yếu tố chưa sẵn sàng sẵn sàng và phân tích không vi phạm. Mục 1201 ((f) là ngoại lệ chỉ đối với quy tắc chống trốn tránh. Câu hỏi sao chép vẫn được sử dụng công bằng.

Trong Liên minh châu Âu, Điều 5 của Đạo luật 2009/24/EC (3) bao gồm nghiên cứu. Một người có quyền sử dụng bản sao có thể "xem, nghiên cứu hoặc kiểm tra hoạt động của chương trình để xác định những ý tưởng và nguyên tắc cơ bản của bất kỳ yếu tố nào của chương trình".

Điều 6 cho phép phân tích mà không có sự cho phép của người có quyền khi "có thể thu được thông tin cần thiết để đạt được khả năng tương tác của một chương trình máy tính được tạo ra độc lập". Điều kiện phù hợp với 1201 ((f). Một người có giấy phép thực hiện các hành động, thông tin chưa sẵn sàng sẵn sàng, và các hành động vẫn nằm trong các phần cần thiết. Điều 6 ((2) cấm sử dụng kết quả cho bất kỳ mục tiêu nào khác hoặc cho một chương trình tương tự về mặt đáng kể. Điều 8 làm cho các điều khoản hợp đồng trái với Điều 6 hoặc Điều 5 (3) vô hiệu và vô hiệu.

| Source | What it allows | Conditions |
|---|---|---|
| 17 U.S.C. 1201(f) | Circumventing an access control to analyze a program | Lawful copy, interoperability purpose, information not readily available, no infringement |
| Directive 2009/24/EC Art. 5(3) | Observing, studying, and testing a running program | A right to use the copy, acts within normal loading and running |
| Directive 2009/24/EC Art. 6 | Decompilation | Licensee, interoperability purpose, information not readily available, confined to the needed parts |
| *Sega v. Accolade* | Disassembly as fair use | The only way to reach the ideas and functional elements, a legitimate reason |
| *Sony v. Connectix* | Intermediate copies during reverse engineering | A non-infringing final product |

Những ghi chú này đến từ các quy định và ý kiến, và chúng không phải là tư vấn pháp lý. Khi một mục tiêu trong tương lai không phải của bạn, hãy xin giấy phép bằng văn bản trước khi bạn mở hồ sơ và giữ giấy phép với bằng chứng của bạn. Phần 2.1 của hướng dẫn kỹ thuật ngược 101 cung cấp đầy đủ các trích dẫn và các trường hợp của Tòa án Tối cao Liên bang châu Âu.

## Vấn đề

Anh đã biên soạn`ledger.c`và chạy`llvm-objdump -t`trên đối tượng.`percent_change`giá trị `0000000000000000`với kích thước `0000000000000010`. 16 byte nào trong file 1.768-byte là hàm đó?`R_X86_64_PC32 .rodata+0x10`trong sự bù đắp`0x36`, và bốn byte ở vị trí đó trong tệp là không.`0x10`khi bàn bắt đầu ở `0x14`- Không .

rea trả lời các câu hỏi về bố cục với `inspect_binary_layout`, và công cụ đó chỉ tồn tại trên Linux x64 với pwntools 4.15.0 phía sau `REA_PWNTOOLS_PYTHON`Trên máy Mac này nó không có.`address_to_file_offset`cần một phiên bản Ghidra và một bản sao đầy đủ của các byte tập tin gốc với một SHA-256 phù hợp. `inspect_artifact`Nó không bao giờ mở các bảng bên trong một tệp đối tượng. Vì vậy bạn tự viết cho người đọc trong khoảng 950 dòng Python với `struct.unpack`Các bài kiểm tra so sánh từng bảng với`llvm-objdump`văn bản được ghi lại một lần trong các thiết bị.

```figure
elf-byte-map
```

## Các tập tin là những bảng chỉ ra các bảng

Hệ thống V gABI, chương 4, Hình 4-1, vẽ hai quan điểm của một tập tin. Quan điểm liên kết có tiêu đề ELF, bảng tiêu đề chương trình tùy chọn, các phần và bảng tiêu đề phần yêu cầu. Quá trình xem thực hiện có tiêu đề ELF, bảng tiêu đề chương trình yêu cầu, các phân đoạn và bảng tiêu đề phần tùy chọn. GABI thêm một câu điều khiển toàn bộ người đọc: "Chỉ đầu ELF có vị trí cố định trong tệp". Mỗi cấu trúc khác được tìm thấy bởi một sự thay thế được lưu trữ trong một cấu trúc khác.

GABI cũng sửa các loại scalar và nói rằng "ELF không sử dụng các bit field". `Elf64_Addr`và `Elf64_Off`là 8 byte, `Elf64_Half`là 2, `Elf64_Word`là 4, và`Elf64_Xword`Các x86-64 psABI, phần 4. 1.1, yêu cầu `ELFCLASS64`- `ELFDATA2LSB`- `e_machine` `EM_X86_64`(62), và`e_flags`0. Tiểu động nhỏ với chiều rộng cố định trung bình `struct.unpack`với một `<`Prefix đọc mọi bản ghi trong một cuộc gọi.

64 byte đầu tiên của `ledger-x86_64-O1.o`- Có thể là:

```text
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0100 3e00 0100 0000 0000 0000 0000 0000  ..>.............
00000020: 0000 0000 0000 0000 2804 0000 0000 0000  ........(.......
00000030: 0000 0000 4000 0000 0000 4000 0b00 0100  ....@.....@.....
```

Đọc chúng so với trang "ELF Header" của GABI. `e_ident`là 16 byte `7f 45 4c 46`(đồ phép), lớp 2 (64-bit), dữ liệu 1 (chúng nhỏ), phiên bản 1, OS ABI 0 (System V), và đệm.

Vậy thì`e_type` `0x0001`là `ET_REL`, một vật thể có thể di chuyển.`e_machine` `0x003e`là 62, `EM_X86_64`- `e_entry`là không vì một đối tượng không có điểm nhập. `e_phoff`là không vì một đối tượng không có tiêu đề chương trình. `e_shoff`là `0x428`, file offset của bảng tiêu đề phần.`e_ehsize` `0x40`- `e_phentsize`0, `e_phnum`0, `e_shentsize` `0x40`- `e_shnum` `0x0b`(11 tiêu đề), và`e_shstrndx` `0x0001`- Tôi không biết.

Người đọc biến dòng đó thành một cuộc gọi:

```python
fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
```

Dòng định dạng là con số gABI đọc từ trái sang phải: hai nửa từ, một từ, ba giá trị 8byte, một từ và sáu nửa từ. Người đọc từ chối một tệp có phép thuật, lớp hoặc thứ tự byte khác nhau, và nó từ chối `e_shentsize`hoặc `e_phentsize`giá trị không phải là 64 và 56. Một chiều rộng sai sẽ làm cho mỗi lần bù đắp sau đó sai, vì vậy kiểm tra nằm ở phía trên.

## Các tiêu đề phần và hai bảng dây

Mỗi tiêu đề phần là một `Elf64_Shdr`64 byte (gABI Hình 4-8): `sh_name`- `sh_type`- `sh_flags`- `sh_addr`- `sh_offset`- `sh_size`- `sh_link`- `sh_info`- `sh_addralign`, và`sh_entsize`. Dòng định dạng là `<IIQQQQIIQQ`- `sh_name`là một sự bù đắp vào phần có chỉ số là `e_shstrndx`, và tên kết thúc ở 0 byte đầu tiên.`e_shstrndx`là 1, và clang đặt tên cho phần đó `.strtab`, vì vậy một bảng phục vụ cả tên của phần và tên của biểu tượng.

Người đọc in 11 tiêu đề của đối tượng -O1:

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

Chỉ số 0 là tiêu đề null được lưu trữ. `.text`chứa 159 byte mã tại file offset `0x40`, ngay sau tiêu đề, với cờ `A`(được phân bổ trong bộ nhớ) và`X`(có thể thực hiện). `.rodata`chứa 80 byte dữ liệu chỉ đọc. `.rodata.str1.1`giữ 5 chuỗi nhãn `F\0D\0C\0B\0A\0`, 10 byte, với cờ `M`(tích hợp) và `S`(câu)

`.comment`giữ dấu biên tập viên 47-byte `\0Apple clang version 17.0.0 (clang-1700.6.3.2)\0`- `.llvm_addrsig`có kiểu `0x6fff4c03`, trong phạm vi cụ thể của hệ điều hành `SHT_LOOS`đến`SHT_HIOS`rằng các dự trữ của gABI, và LLVM `ELF.h`Tên của nó.`E`là `SHF_EXCLUDE`, nên một liên kết sẽ làm rơi nó.

- `sh_link`và `sh_info`Cột là các chỉ số giữa các bảng. `.rela.text`- Có `sh_info`2 và `sh_link`10: nó váy phần 2 và lấy các biểu tượng của nó từ phần 10. `.symtab`- Có `sh_link`1, bảng chuỗi cho tên biểu tượng, và `sh_info`9, chỉ số của biểu tượng không địa phương đầu tiên. `sh_addr`là 0 trong mỗi hàng vì một đối tượng chưa có địa chỉ.

Hai quy tắc gABI cho phép người đọc vẽ một bản đồ đầy đủ của tệp. Các phần "có liên kết và không chồng chéo", và tệp "có thể chứa không gian không hoạt động". Người đọc sắp xếp mọi cấu trúc theo sự bù đắp và lấp đầy các lỗ:

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

Ba khoảng cách tổng cộng là 10 byte, và mỗi một là sự sắp xếp. `.rodata`- Có `sh_addralign`8, vì vậy nó bắt đầu từ `0xe0`thay vì`0xdf`- `.symtab`có đường thẳng 8, vì vậy bảy byte không được sử dụng sau đó `.comment`Bảng tiêu đề phần tự được sắp xếp với 8.

Các phần kiểu `SHT_NOBITS`không chiếm được các byte tập tin, vì vậy bản đồ bỏ qua chúng. Không có gì trong đối tượng này có loại đó.`.bss`trong một chương trình liên kết làm, và một độc giả tin tưởng `sh_size`Có một cái tên khác.

## Các biểu tượng: Kết nối, loại, phần, giá trị, kích thước

Một `Elf64_Sym`là 24 byte (gABI Hình 4-18): `st_name`- `st_info`- `st_other`- `st_shndx`- `st_value`- `st_size`, định dạng `<IBBHQQ`- `st_info`gói hai trường: liên kết trong bốn bit cao và loại trong bốn thấp.`STB_LOCAL`0, `STB_GLOBAL`1, `STB_WEAK`2, và các loại `STT_NOTYPE`0, `STT_OBJECT`1, `STT_FUNC`2, `STT_SECTION`3, `STT_FILE`4. 2 bit thấp của `st_other`giữ tầm nhìn,`STV_DEFAULT`0 ở đây.

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

Chỉ số 0 là biểu tượng không xác định được lưu trữ. `st_shndx`tên phần xác định biểu tượng, với ba giá trị được lưu giữ: `SHN_UNDEF`0, `SHN_ABS` `0xfff1`cho tên tệp, và `SHN_COMMON` `0xfff2`Các biểu tượng của phần có tên trống, vì vậy `llvm-objdump`Giấy ghi tựa đề của phần cho họ, và người đọc cũng làm như vậy. Quy tắc gABI rằng "tất cả các biểu tượng có liên kết STB_LOCAL trước các biểu tượng yếu và toàn cầu" xuất hiện như chín hàng đầu, và `.symtab`ghi lại 9 năm`sh_info`Vì lý do đó.

Trong một vật thể có thể di chuyển`st_value`là một sự thay thế bên trong phần của biểu tượng, bởi vì `sh_addr`là không. Các file offset của một hàm do đó là `sh_offset + st_value - sh_addr`, và chiều dài của nó là `st_size`- Có thể là:

```python
section = elf.sections[symbol.st_shndx]
file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
code = elf.data[file_offset : file_offset + symbol.st_size]
```

Vì `percent_change`Đó là `0x40 + 0`, và 16 byte là `85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`- Kích thước cũng quan trọng như sự khởi đầu.`grade`kết thúc tại `.text`bồi thường`0x3e`Hai byte.`66 90`những người theo là một `nop`bộ sưu tập đã thêm vào để `total`bắt đầu từ `0x40`2 byte đó không thuộc về bất kỳ biểu tượng nào.`st_size`như là điều kiện dừng cho một máy tháo rời, và bài học 36 che giấu chúng trước khi nó so sánh một xây dựng lại.

## Đời: Những gì Zero Byte có nghĩa là

Một `Elf64_Rela`là 24 byte (gABI Hình 4-23): `r_offset`- `r_info`, và một chữ ký`r_addend`, định dạng `<QQq`- GABI chia rẽ.`r_info`với hai macro: `ELF64_R_SYM(i)`là `i >> 32`và `ELF64_R_TYPE(i)`là `i & 0xffffffff`Trong một tệp có thể chuyển`r_offset`là một sự thay thế bên trong phần được đặt tên bởi bảng `sh_info`Tên và công thức loại được lấy từ x86-64 psABI, Bảng 4.9.`S`là giá trị biểu tượng, `A`bổ sung, `P`nơi được dán, và `L`mục PLT. `R_X86_64_64`là `S + A`- `R_X86_64_PC32`là `S + A - P`, và`R_X86_64_PLT32`là `L + A - P`- Tôi không biết.

Chuyện -O1 có tám ghi chép:

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

Hãy tách ra cái đầu tiên.`0x36`nằm bên trong`grade`, bao gồm:`0x10`đến`0x3e`- Các hướng dẫn tại `0x33`là `48 8d 0d 00 00 00 00`, một `lea`của một địa chỉ liên quan đến RIP, và chuyển đổi bốn byte của nó nằm ở `0x36`. Bộ xử lý thêm sự di chuyển vào địa chỉ của hướng dẫn tiếp theo, `0x3a`- Tôi không biết.

Người biên tập muốn kết quả là `.rodata + 0x14`, nơi một bảng 5 mục có giá trị 32 bit `1, 2, 3, 4, 4`Vì vậy, giá trị được lưu trữ phải là`(.rodata + 0x14) - 0x3a`- Công thức`S + A - P`với `P = 0x36`cho `.rodata + A - 0x36`Đặt hai số bằng nhau cho`A = 0x14 - 4 = 0x10`. Addend mang theo mục tiêu offset trừ bốn byte giữa việc di chuyển và cuối hướng dẫn.

Đây là bảng cách clang biên soạn các `switch`trong `grade`-O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1 -O1`score / 10`với một nhân bằng `0x66666667`và hai thay đổi, trừ 6, so sánh với 4, và chỉ mục bảng. đối tượng -O1 ELF không giữ bất kỳ biểu tượng nào cho bảng.`.rodata`cộng thêm một phần bổ sung, và chỉ có bộ arm64 của cùng một nguồn đặt tên cho nó `l_switch.table.grade`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`0x84`trong `grade_label`, điểm trong bảng thứ hai của giá trị 8 byte tại `.rodata + 0x28`Thứ ba, ở`0x93`, chỉ ra tại `.rodata + 0x0`, sự khởi đầu của `labels.rel`- Tôi không biết.

5 người`.rela.rodata`ghi chép điền `labels.rel`Mỗi mục đều được đặt ở chỗ trượt`4i`và nhận được thêm `4i`, vậy `S + A - P`giảm xuống địa chỉ của chuỗi trừ đáy của bảng. `grade_label`đọc một mục với `movslq`, thêm cơ sở bảng trở lại, và có chỉ số.`.rodata.str1.1`với phụ lục 0 vì chuỗi `F`là byte đầu tiên của phần đó.`.L.str.1`đến`.L.str.4`, các nhãn địa phương của trình biên dịch cho `D`- `C`- `B`, và`A`- Tôi không biết.

Nguồn tương tự biên soạn thành ba bảng khác nhau ở ba mức tối ưu hóa. Người đọc cho thấy sự khác biệt mà không cần một bộ sáp:

| Build | Where `labels` lives | How `grade` selects | How `grade_label` reaches `grade` |
|---|---|---|---|
| -O0 | `.data`, five 8-byte pointers, five `R_X86_64_64` records | A jump table in `.rodata`: five `R_X86_64_PC32` records pointing into `.text` | A call with `R_X86_64_PLT32 grade-0x4` |
| -O1 | `.rodata` as `labels.rel`, five 32-bit relative entries | A value table at `.rodata+0x14`, one `R_X86_64_PC32` | Inlined, no call |
| -O2 | Same as -O1 | Same as -O1 | Inlined, `total` grows to 140 bytes |

Ở -0 `switch`là một bàn nhảy thực sự mà năm mục chỉ về phía `.text``+0x91`- `+0x8c`- `+0x87`- `+0x82`, và`+0x86`- Lệnh gọi cho `grade`mang theo cùng một `-0x4`bổ sung vì cùng lý do như `lea`Ở -O1, người tối ưu hóa thấy rằng mỗi trường hợp trả lại một liên tục và thay thế các bước nhảy bằng một bảng kết quả.

## Các tiêu đề chương trình: Quan điểm của người tải

Một đối tượng có thể di chuyển không có tiêu đề chương trình, vì vậy `e_phnum`là 0. Một thể hiện hoặc một đối tượng được chia sẻ có chúng, và bộ tải không đọc gì khác.`Elf64_Phdr`là 56 byte (gABI Hình 5-1): `p_type`- `p_flags`- `p_offset`- `p_vaddr`- `p_paddr`- `p_filesz`- `p_memsz`- `p_align`, định dạng `<IIQQQQQQ`GABI đã đưa ra 3 quy tắc cho`PT_LOAD`Nhập vào. Chúng xuất hiện trong tăng lên.`p_vaddr`lệnh, và một `p_memsz`lớn hơn `p_filesz`nghĩa là không đầy.`p_vaddr`tương ứng với `p_offset`modulo `p_align`- Tôi không biết.

Mỗi mục tiêu trong bài hát này là một chương trình bạn đã xây dựng, và không có liên kết trên Mac này tạo ra một Linux thực thi từ `ledger.o`Vậy là thiết bị`tiny-x86_64`đến từ `code/fixtures/build_tiny_elf.py`, viết 736 byte với `struct.pack`. tệp chứa một đầu ELF, hai đầu chương trình, một 36-byte `_start`, một 3 byte `.rodata`, một bảng biểu tượng, và sáu tiêu đề phần. `_start`viết `ok\n`trên Linux x86-64 nó chạy. đây là một phần mềm cho con đường tiêu đề chương trình.

```text
Program headers:
  PT_LOAD          r-x offset=0x0 vaddr=0x400000 filesz=0x2e0 memsz=0x2e0 align=0x1000
  PT_GNU_STACK     rw- offset=0x0 vaddr=0x0 filesz=0x0 memsz=0x0 align=0x10

entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

Đơn vị`PT_LOAD`bản đồ toàn bộ tập tin 736 byte tại `0x400000`Người đọc sẽ lập bản đồ địa chỉ của một tập tin bằng cách tìm ra `PT_LOAD`có chứa nó và tính toán `p_offset + (address - p_vaddr)`. Đối với điểm nhập cảnh là `0 + (0x4000b0 - 0x400000) = 0xb0`, sự khởi đầu của `.text`- Tôi không biết.

Đây là tính toán đằng sau rea.`address_to_file_offset`Đối với một mục tiêu Ghidra, công cụ đó sẽ quay lại.`{address, file_offset}`Người cung cấp Hopper cũng quay lại`provider_file_offset`và `image_base_file_offset`Công cụ cần một bản sao nguyên bản đầy đủ của tệp, và SHA-256 của bản sao đó phải phù hợp với mục tiêu.`inspect_binary_layout`thêm một dòng để giữ: "Một địa chỉ liên kết không phải là địa chỉ thời gian chạy". Một địa chỉ có thể thực hiện độc lập vị trí tải tại một cơ sở mà kernel chọn, và file offset là phối hợp ổn định duy nhất.

Các tiêu đề chương trình cũng giải thích tại sao một trình thực bị tẩy ra vẫn chạy. Một linker có thể xóa bảng tiêu đề phần hoàn toàn, và `e_shoff`Một công cụ đi qua các phần sau đó không thấy gì.

## Những ý tưởng tương tự trong Mach-O

Apple không công bố thông số kỹ thuật văn bản cho Mach-O. Các tiêu đề trong nguồn XNU là thông số kỹ thuật: `EXTERNAL_HEADERS/mach-o/loader.h`- `nlist.h`, và`reloc.h`- Đồ đạc`ledger-arm64-O1.o`là giống nhau `ledger.c`được xây dựng với `clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c`- Tôi không biết.

A `mach_header_64`là 32 byte: `magic`- `cputype`- `cpusubtype`- `filetype`- `ncmds`- `sizeofcmds`- `flags`- `reserved`- Sự kỳ diệu là`0xfeedfacf`- `MH_MAGIC_64`- `cputype`là `0x0100000c`- `CPU_TYPE_ARM64`- `filetype`là 1, `MH_OBJECT`- `ncmds`là 5 và `sizeofcmds`là 616: các lệnh tải chiếm 616 byte sau tiêu đề, và mỗi lệnh bắt đầu với `{cmd, cmdsize}`. . cờ`0x2000`là `MH_SUBSECTIONS_VIA_SYMBOLS`- Tôi không biết.

```text
Load commands:
  0 LC_SEGMENT_64                cmdsize=472 at 0x20
  1 LC_BUILD_VERSION             cmdsize=24 at 0x1f8
  2 LC_LINKER_OPTIMIZATION_HINT  cmdsize=16 at 0x210
  3 LC_SYMTAB                    cmdsize=24 at 0x220
  4 LC_DYSYMTAB                  cmdsize=80 at 0x238
```

`LC_SEGMENT_64`(0x19) là câu trả lời Mach-O cho cả hai bảng ELF.`segment_command_64`- Có `segname`- `vmaddr`- `vmsize`- `fileoff`- `filesize`- `maxprot`- `initprot`- `nsects`, và`flags`- Vậy thì`nsects`hồ sơ về loại `section_64`, 80 byte mỗi, theo cùng một lệnh.`loader.h`bình luận về `MH_OBJECT`nói các phần sống "trong một phân đoạn không có tên mà không có bộ phận đệm".`fileoff`648, `filesize`456, và 5 phần.

```text
  Idx Section                    Addr   Size Offset Reloff Nreloc Type
    1 __TEXT,__text               0x0   0xd0    648   1104      6 S_REGULAR
    2 __DATA,__const             0xd0   0x28    856   1152      5 S_REGULAR
    3 __TEXT,__cstring           0xf8    0xa    896      0      0 S_CSTRING_LITERALS
    4 __TEXT,__const            0x108   0x40    912      0      0 S_REGULAR
    5 __LD,__compact_unwind     0x148   0x80    976   1192      4 S_REGULAR
```

Mỗi phần đặt tên cho phân khúc chủ của nó trong `segname`, vì vậy hai phần gọi là`__const`là khác nhau bởi vì một là `__DATA,__const`Và cái kia`__TEXT,__const`Các chuyển nhượng là mỗi phần qua `reloff`và `nreloc`, nơi ELF có một `.rela.X`phần cho mỗi mục tiêu.

Mỗi người`relocation_info`là 8 byte.`r_address`Một trường 32 bit tiếp theo, đóng gói như `r_symbolnum`(24 bit), `r_pcrel`(1) `r_length`(2) `r_extern`(1) và`r_type`(4) 6`__text`Các hồ sơ là ba cặp của `ARM64_RELOC_PAGE21`và `ARM64_RELOC_PAGEOFF12`, một cặp mỗi bảng tham chiếu.`adrp`+`add`làm gì một x86-64 `lea`Có, vì vậy mỗi tham chiếu cần hai hồ sơ.`__DATA,__const`Các hồ sơ là `ARM64_RELOC_UNSIGNED`với `r_length`3, vì vậy mỗi một patches một chỉ số tuyệt đối 8 byte.

Ở -O1 , bộ máy arm64 được giữ .`labels`như các chỉ số đơn giản nơi x86-64 xây dựng tạo ra một bảng tương đối.

`LC_SYMTAB`(0x2) giữ `symoff`1240, `nsyms`17, `stroff`1512, `strsize`176, và 1512 cộng với 176 là 1688, kích thước tập tin.`nlist_64`là 16 byte: `n_strx`- `n_type`- `n_sect`- `n_desc`- `n_value`- `n_type`là một chút lĩnh vực. `N_TYPE`(đặt mặt nạ `0x0e`) bằng với `N_SECT`(`0xe`) là được định nghĩa trong phần có đơn vị dựa trên 1 là `n_sect`- `N_EXT`(`0x01`) đánh dấu một biểu tượng bên ngoài.

`nlist_64`không có kích thước trường. để có được 24 byte của`_percent_change`người đọc lấy địa chỉ biểu tượng tiếp theo trong cùng phần, `_grade``0x18`. Các biểu tượng C mang một dấu đầu `_`ở đây, vì vậy chức năng là `_percent_change`- Tôi không biết.

`LC_DYSYMTAB`(0xb) ghi lại cùng một quy tắc địa phương-đầu tiên như ELF `sh_info``ilocalsym`0, `nlocalsym`13, `iextdefsym`13, `nextdefsym`4. `LC_BUILD_VERSION`(0x32) ghi chép `platform`1 (macOS), `minos`26.0 và `sdk`26,2 như đóng gói `XXXX.YY.ZZ`lệnh đó là lý do tại sao bộ cố định arm64 được cam kết như là byte. Một build trên một Mac với một SDK khác tạo ra một tập tin khác.

Người đọc `compare_formats`đặt hai tập tin bên cạnh nhau:

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

rea đọc Mach-O qua `inspect_macho`, chạy`otool -h -l`- `nm -gjU`- `dyld_info -imports -exports`, và`dwarfdump --uuid`qua `xcrun`Người đọc của bạn không cần bất kỳ thứ gì, và nó đọc giống nhau.`symoff`và `stroff`Đó là`otool -l`- Nhìn ra.`open_binary`công cụ của rea phát hiện ELF, MZ, PE, và mỏng hoặc phổ biến Mach-O từ các byte ma thuật.`e_machine`là 20 byte đầu tiên của những gì bạn xây dựng ở đây. cho một tệp không có tiêu đề, bạn cho`format: raw-binary`Nhà cung cấp Ghidra từ chối một binary phổ quát và yêu cầu một mảnh mỏng.`0xcafebabe`- Tôi không biết.

## Hãy xây dựng nó

Động trình đọc thư viện tiêu chuẩn:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
```

Dòng demo là `ledger-x86_64-O1.o`và in tiêu đề, phần, biểu tượng, di chuyển, và file offset map. Nó sau đó in bốn hàm byte chuỗi, đọc `ledger-arm64-O1.o`, và in bảng so sánh. Nó kết thúc với tiêu đề chương trình của `tiny-x86_64`- Những dòng dự kiến:

```text
percent_change: 16 bytes at file offset 0x40: 85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3
grade: 46 bytes at file offset 0x50: 48 63 c7 48 69 c0 67 66 66 66 ...
entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

Gửi một đường dẫn để đọc một tập tin: `python3 code/main.py code/fixtures/ledger-x86_64-O0.o`Người đọc chọn ELF hoặc Mach-O từ bốn byte đầu tiên.

Đọc `code/main.py`theo thứ tự này:

1. `ElfFile._read_header()`kiểm tra phép thuật, lớp, lệnh byte, và kích thước nhập, sau đó mở đầu.
2. `ElfFile._read_sections()`và `read_cstring()`đọc bảng tiêu đề phần và giải quyết tên thông qua `e_shstrndx`- Tôi không biết.
3. `ElfFile._read_symbols()`chia rẽ`st_info`, giải quyết tên thông qua `sh_link`, và giữ cho các chỉ số phần được đặt lại được đọc.
4. `ElfFile._read_relocations()`đi bộ mỗi lần `SHT_RELA`phần, chia `r_info`, và các loại tên trong bảng 4.9.
5. `ElfFile.function_span()`và `function_bytes()`biến một biểu tượng thành một phạm vi tập tin và các byte trong đó.
6. `ElfFile.file_offset_map()`phân loại mọi cấu trúc theo sự bù đắp và lấp đầy không gian không hoạt động.
7. `ElfFile._read_program_headers()`và `address_to_file_offset()`xử lý các thiết bị thực thi.
8. `MachOFile`đọc tiêu đề, lệnh tải,`LC_SEGMENT_64`với các phần của nó, `LC_SYMTAB`- `LC_BUILD_VERSION`, và chuyển chỗ mỗi phần.
9. `compare_formats()`tên cùng một ý tưởng trong cả hai tập tin với các giá trị đọc từ mỗi.

## Sử dụng nó

Tham nhập người đọc từ các bài học sau đó với `from main import ElfFile`sau khi thêm bài học này `code`thư mục đến `sys.path`Bài học 33 yêu cầu điều đó.`function_bytes`và `relocations_for(".text")`Bài học 35 ghi lại kết quả của nó như bằng chứng quan sát. Bài học 36 yêu cầu nó để bù đắp chuyển đổi trước khi so sánh byte.

Sắp xếp C của riêng bạn thành một đối tượng với cùng một `clang -target x86_64-unknown-linux-gnu -c`Chỉ cần đặt lệnh và chạy bộ đọc trên nó. Chỉ cần thêm tên di chuyển khi bảng x86-64 psABI 4.9 liệt kê nó. Chỉ cần thêm kiểu phần khi gABI hoặc chuỗi công cụ sản xuất tài liệu nó. Khi người đọc gặp một giá trị mà nó không có tên cho, nó in số bằng chữ sáu thập kỷ thay vì đoán.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: đầu bằng tay

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code
python3 -q
```

Đi chạy:

```python
import struct
from main import ElfFile, FIXTURES
data = (FIXTURES / "ledger-x86_64-O1.o").read_bytes()
data[:4], data[4], data[5]
struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
elf = ElfFile(data)
elf.header.e_shoff, elf.header.e_shnum, elf.sections[elf.header.e_shstrndx].name
```

Những màn trình diễn của Tuple`e_type`1, `e_machine`62, và `e_shoff`1064, đó là `0x428`- Dòng cuối cùng cho thấy phần 1`.strtab`, giữ tên các phần.

### Phòng thí nghiệm B: bảng giá trị đằng sau bộ chuyển đổi

```python
rodata = elf.section_bytes(elf.section(".rodata"))
[int.from_bytes(rodata[i : i + 4], "little") for i in range(0x14, 0x28, 4)]
[int.from_bytes(rodata[i : i + 8], "little") for i in range(0x28, 0x50, 8)]
[r for r in elf.relocations_for(".text") if r.symbol == ".rodata"]
```

Cả hai bảng đều được đọc `1, 2, 3, 4, 4`Hãy kiểm tra chúng.`ledger.c``grade(65)`tính toán`65 / 10 - 6 = 0`và đọc mục 0, đó là 1, giá trị của `case 6`- `grade(100)`đọc mục 4, đó là 4, giá trị chia sẻ bởi `case 10`và `case 9`- Tôi không biết.

### Phòng thí nghiệm C: ba bản xây dựng của một nguồn

```python
for level in ("O0", "O1", "O2"):
    obj = ElfFile.from_path(FIXTURES / f"ledger-x86_64-{level}.o")
    print(level, [s.name for s in obj.sections if s.name in (".data", ".rodata")])
    print(level, sorted({r.type_name for r in obj.relocations}))
    print(level, {s.name: s.st_size for s in obj.symbols if s.type == "FUNC"})
```

Chuyện -O0 có một `.data`Các đối tượng -O1 và -O2 không có`.data`và một loại.`total`là 66 byte ở -O0, 31 ở -O1, và 140 ở -O2.

### Phòng thí nghiệm D: cùng một chức năng trong Mach-O

```python
from main import MachOFile
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
[(c.name, c.cmdsize) for c in macho.load_commands]
macho.function_span("_percent_change")
macho.function_bytes("_percent_change")[:4].hex()
```

Thời gian là 24 byte tại file offset 648.`a0000034`, hình thức nhỏ bé của hướng dẫn `0x340000a0`, mà `llvm-objdump -d`Nhận dạng như `cbz w0, 0x14`Đó là `before == 0`Guard, cùng một thử nghiệm mà x86-64 xây dựng mã hóa như `85 ff 74 09`- Tôi không biết.

## Phòng thí nghiệm thực hành

Chuyển mở trình đọc đến một chương trình liên kết.`clang -O1 -shared -fPIC code/fixtures/ledger.c -o libledger.so`và `clang -O1 code/fixtures/ledger.c -o ledger_main`với một `main`bạn thêm, sau đó chạy người đọc trên cả hai.

Yêu cầu:

- Đọc `.dynsym`với cùng một `Elf64_Sym`thiết kế, kể từ khi `SHT_DYNSYM`là 11 và hồ sơ không thay đổi.
- Đọc `.dynamic`như `Elf64_Dyn`ghi chép của `d_tag`và `d_val`, và tên `DT_NEEDED`- `DT_STRTAB`- `DT_SYMTAB`- `DT_RELA`, và`DT_JMPREL`từ trang "Dynamic Section" của gABI.
- Đăng danh các biểu tượng không được xác định với `st_shndx` `SHN_UNDEF`như nhập khẩu, và`R_X86_64_JUMP_SLOT`ghi chép trong `.rela.plt`như các trang web gọi đến họ.
- Bản đồ mọi thứ`PT_LOAD`phân đoạn đến các phần nó chứa, sử dụng quy tắc gABI rằng "một phân đoạn tệp đối tượng chứa một hoặc nhiều phần".
- Hãy chứng minh với `address_to_file_offset`rằng các byte của mỗi hàm được xác định trong đối tượng được chia sẻ là các byte `function_bytes`trở lại.
- Tắt `llvm-objdump -h -t -r -p`và `llvm-objdump -T`văn bản cho cả hai tệp vào `code/fixtures/`và so sánh người đọc với họ trong thử nghiệm.

Thành công có nghĩa là danh sách nhập khẩu, bản đồ phân đoạn và mỗi phạm vi chức năng phù hợp với sản lượng công cụ được chụp, mà không có công cụ chạy trong các thử nghiệm.

## Phòng thí nghiệm được xếp hạng

Năm câu hỏi về các thiết bị của bài học này. Tìm mỗi câu trả lời với mã bạn xây dựng, sau đó viết nó vào `code/lab_answers.json`. Viết số như số hoặc như chuỗi hex như `"0x40"`, và danh sách như danh sách JSON.

1. `t1`: e_shoff của sổ cái-x86_64-O1.o, như một số.
2. `t2`: st_size of percent_change trong sổ cái-x86_64-O1.o.
3. `t3`: file offset của .text trong sổ cái-x86_64-O1.o, như hex.
4. `t4`: tên loại di chuyển trong sổ cái-x86_64-O0.o, sắp xếp, như một danh sách.
5. `t5`: năm giá trị int tại .rodata+0x14 trong sổ cái-x86_64-O1.o, như một danh sách.

Hãy kiểm tra câu trả lời của bạn:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/lab.py
npx tsx code/lab.ts
```

Người kiểm tra tính toán mỗi giá trị dự kiến từ `code/main.py`trên các thiết bị đã được thực hiện.`PASS`- `FAIL`hoặc `TODO`cho mỗi nhiệm vụ và điểm số, và nó chỉ thoát khỏi 0 khi tất cả năm vượt qua. `python3 code/lab.py my-answers.json`kiểm tra một tập tin khác. `code/tests/test_lab.py`chứng minh rằng người kiểm tra chấp nhận câu trả lời đúng và từ chối câu trả lời sai.

### Xem nó chạy

- [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)máy chạy bài học này như hai trạm đầu tiên của nó. cuộn đọc tiêu đề của tệp đối tượng giữ `percent_change`, và tủ mở ra`.text`và đọc biểu tượng. Đổi biểu tượng để xem các dữ liệu biểu tượng bảng mang.

## Bài học: Cây tạo vật

Bài học này sẽ mang lại kết quả `outputs/skill-program-anatomy-elf-from-scratch.md`Sử dụng nó với Claude, Cursor, Codex, OpenClaw, Hermes, hoặc bất kỳ đại lý nào đọc SKILL.md. Khả năng biến một đối tượng được biên soạn hoặc có thể thực hiện được người dùng xây dựng thành một báo cáo bố cục. báo cáo cho phép phạm vi tệp của mỗi cấu trúc, biểu tượng và di chuyển, kiểm tra với đầu ra công cụ được chụp.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Phòng chứng minh:

- Mỗi mục chỉ mục, tên, kích thước, địa chỉ và loại phù hợp với các hình ảnh bị bắt `llvm-objdump -h`văn bản cho ba đối tượng x86-64 và các thể hiện nhỏ
- Mỗi giá trị biểu tượng, liên kết, loại, phần, kích thước và tên phù hợp với các hình ảnh được chụp `llvm-objdump -t`văn bản
- Mỗi chuyển nhượng, tên kiểu, biểu tượng và phụ kiện phù hợp với những gì đã chụp.`llvm-objdump -r`văn bản, bao gồm:`R_X86_64_PLT32`và `R_X86_64_64`ở -O0
- cả hai người đứng đầu chương trình của `tiny-x86_64`Đáp lại những kẻ bị bắt `llvm-objdump -p`văn bản, và các đối tượng không có
- `percent_change`là 16 byte tại file offset `0x40`với các byte dự kiến, và mọi hàm nằm trong `.text`
- Bản đồ file offset bao gồm mỗi byte của mỗi vật cố định một lần, với ba khoảng cách sắp xếp của đối tượng -O1 ở vị trí của họ
- điểm nhập cảnh của `tiny-x86_64`bản đồ để tệp trục `0xb0`qua `PT_LOAD`, và một đối tượng có thể di chuyển từ chối bản đồ địa chỉ
- Đầu Mach-O, mỗi lệnh tải, phân đoạn, 5 phần,`LC_SYMTAB`, và`LC_BUILD_VERSION`Đáp lại những kẻ bị bắt `--private-headers`văn bản
- Các biểu tượng Mach-O và 15 di chuyển phù hợp với những người bị bắt `llvm-objdump`văn bản, và`_percent_change`là 24 byte tại 648
- một phép thuật sai, một lớp 32-bit, một tập tin big-endian, một bảng trunced, một binary phổ quát, và một tập tin nguồn C tất cả tăng lên.`FormatError`
- `build_tiny_elf.py`tái tạo các cam kết `tiny-x86_64`Byte cho byte
- mô-đun hình ảnh `site/figures-re-32.js`mang theo các byte chính xác của `ledger-x86_64-O1.o`

## Các chế độ sản xuất thất bại

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

## Quy tắc hoạt động

Đọc tiêu đề mà bạn có thể tin tưởng, theo các lệnh thay thế nó giữ, và đặt tên cho mỗi trường từ chi tiết xác định nó. Giữ công cụ đầu ra bạn so sánh với như một vật cố định cam kết, do đó việc so sánh chạy mà không có công cụ. Khi một giá trị không có tên trong chi tiết, in số. Người đọc bạn có thể kiểm tra byte byte là một người mà mỗi bài học sau đó xây dựng trên.

## Đọc thêm

- [System V gABI, chapter 4: Object Files](https://www.sco.com/developers/gabi/latest/ch4.intro.html)và [ELF Header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html)- [Sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html)- [Symbol Table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html), và[Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)trang
- [System V gABI, chapter 5: Program Header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html)và [Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V ABI, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI), Bảng 4.9 Các loại di chuyển
- [Apple XNU `loader.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)- [`nlist.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h), và[`reloc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/reloc.h)
- [17 U.S.C. 1201](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section1201&num=0&edition=prelim)và [Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng)
- [Sega v. Accolade, 977 F.2d 1510](https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html)và [Sony v. Connectix, 203 F.3d 596](https://law.resource.org/pub/us/case/reporter/F3/203/203.F3d.596.99-15852.html)
- [rea 6.5.0 `docs/binary-diagnostics.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/binary-diagnostics.md)và [`docs/ghidra-provider.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
