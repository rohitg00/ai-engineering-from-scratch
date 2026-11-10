# Khôi phục dữ liệu và loại: Struct, Array, C ++ Object, và DWARF

> Một máy giải biên tập sẽ lấy dấu ấn`a->balance`khi nó có một bảng kiểu và `*(int *)(param_1 + 4)`Bài học này xây dựng bảng từ các truy cập, đọc thực tế từ DWARF 5, và cho thấy nơi hai người đồng ý.

**Type:** Build
**Languages:** Python, TypeScript, C, C++, x86-64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~140 minutes

## Mục tiêu học tập

- Đọc truy cập thành viên cấu trúc như sổ đăng ký cơ sở cộng với di chuyển, và truy cập mảng như cơ sở cộng với bước thời gian chỉ mục, từ các quy tắc giải quyết SDM của Intel.
- Sử dụng các quy tắc sắp xếp hệ thống V bằng tay cho `struct account`và giải thích mỗi byte.
- Xây dựng một thẻ truy cập loại nào đó biến các truy cập trong danh sách thành các field offset, chiều rộng, loại, bước và kích thước, với bằng chứng cho mỗi.
- Viết một người đọc DWARF 5 cho `.debug_info`- `.debug_abbrev`- `.debug_str_offsets`, và`.debug_addr`của một vật thể có thể di chuyển, và kiểm tra nó với `llvm-dwarfdump`- Tôi không biết.
- So sánh bố cục được phục hồi với bố cục DWARF và đặt tên cho mọi sự khác biệt như là bằng chứng thiếu, truy cập hợp nhất hoặc loại không thể chứng minh.
- Đọc một vtable Itanium C ++, thông tin kiểu của nó, và tên bị hỏng từ việc di chuyển, và giải quyết một cuộc gọi ảo đến một khe cắm.

## Vấn đề

Anh đã biên soạn`account.c`Không có `-g`và hỏi một đại lý gì `bump`Đặc vụ đã gửi vật thể đến Ghidra 12.1.4 và nhận lại cái này:

```c
void bump(long param_1,int param_2)
{
  *(int *)(param_1 + 4) = param_2 + *(int *)(param_1 + 4);
  return;
}
```

Nguồn tương tự được biên soạn với `-g`đưa ra từ cùng một decompiler:

```c
int bump(account *a,int by)
{
  a->balance = by + a->balance;
  return a->balance;
}
```

Các hướng dẫn giống nhau trong cả hai đối tượng. Sự khác biệt là một bảng kiểu. Với bảng người giải biên tập biết rằng tham số đầu tiên chỉ vào cấu trúc 32 byte mà trường tại offset 4 là 4 byte `int`tên `balance`Không có nó , người phân tích chỉ biết rằng có một thứ rộng 8 byte đã đến .`%rdi`và 4 byte ở `+4`được đọc và viết.

Mọi thứ trong bảng đó có nguồn.`addl 0x4(%rax), %ecx`- Lượng rộng 4 đến từ `l`Tên gọi đến từ một `DW_TAG_member`nhập vào `.debug_info`Bài học này xây dựng cả hai nửa: một thông qua phục hồi những gì các hướng dẫn chứng minh, và một độc giả giải mã những gì biên dịch viên ghi lại.

```figure
re-41-struct-recovery
```

## Nhập hội thành viên là một sự di chuyển

Intel SDM Volume 1, phần 3.7.5, xác định địa chỉ hiệu quả như `Offset = Base + (Index * Scale) + Displacement`, với một thang đo 1, 2, 4 hoặc 8 và một sự di chuyển của 8, 16 hoặc 32 bit. Phần 3.7.5.1 thêm các dạng chế độ 64-bit `RIP + Displacement`. Một truy cập thành viên cấu trúc sử dụng hình thức đầu tiên mà không có chỉ mục: sổ cái cơ sở chứa địa chỉ của đối tượng và sự di chuyển là phần mềm thay thế.

Nhận đi`bump``-O0`. danh sách từ `llvm-objdump -d -r`Đọc:

```text
       4: 48 89 7d f8                  	movq	%rdi, -0x8(%rbp)
       e: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      12: 03 48 04                     	addl	0x4(%rax), %ecx
      15: 89 48 04                     	movl	%ecx, 0x4(%rax)
```

Tự giải mã `03 48 04`với các quy tắc từ bài học 33. `03`là `ADD r32, r/m32`- ModRM`48`là `01 001 000``mod = 01`nghĩa là một bộ nhớ operand với độ di chuyển 8 bit, `reg = 001`là `%ecx`- `r/m = 000`là `%rax`. Byte di chuyển là `04`- Chỉ dẫn đọc 4 byte ở `%rax + 4`và thêm chúng vào `%ecx`- `l`hậu tố đó `llvm-objdump`print là kích thước của operand, vì vậy trường rộng 4 byte.`%rax`đến từ khe khung ở `-0x8(%rbp)`, và cái khe được nhận `%rdi`, là lập luận số nguyên đầu tiên theo quy ước gọi hệ thống V. Ba thực tế sau đây: tham số đầu tiên là một chỉ số, đối tượng nó chỉ ra có một trường 4 byte tại ofset 4, và `bump`đọc và viết trường đó.

Không có gì trong các byte này nói `int`- `balance`, hoặc`struct account`Không có gì cho biết vật thể lớn như thế nào. 28 byte còn lại của cấu trúc là vô hình cho`bump`- Tôi không biết.

## Quy tắc bố cục hệ thống V

X86-64 psABI, phần 3.1.2, đưa ra ba quy tắc cho tổng hợp. "Các cấu trúc và hiệp hội giả định sự sắp xếp của thành phần được sắp xếp chặt chẽ nhất của họ. Mỗi thành viên được gán cho sự sắp xếp thấp nhất có sẵn với sự sắp xếp thích hợp. kích thước của bất kỳ đối tượng nào luôn là một nhân số của sự sắp xếp của đối tượng. " Hình 3.1 của cùng tài liệu cho thấy kích thước và sắp xếp scalar: `char`1 và 1, `short`2 và 2, `int`4 và 4, `double`8 và 8, bất kỳ chỉ số nào 8 và 8.

Thực hiện các quy tắc cho các cơ cấu trong `account.c`- Có thể là:

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

Thành viên cuối cùng kết thúc ở 32. Sự sắp xếp nghiêm ngặt nhất là 8, và 32 là một nhân số của 8, vì vậy kích thước là 32 mà không có đệm đuôi. Chín byte của 32 là đệm, và psABI nói "Mối chứa của bất kỳ đệm là không xác định".

Dòng người thành viên quyết định kích thước.`double, pointer, int, short, char`fill offsets 0, 8, 16, 20, 22 và kết thúc ở 23, bao quanh lên đến 24. `sysv_layout()`trong `code/main.py`áp dụng ba quy tắc và tạo ra cả hai kết quả.`ctypes`module áp dụng các quy tắc tương tự thông qua quy ước của trình biên dịch chủ, và `ctypes.sizeof`- `ctypes.alignment`, và `.offset`của mỗi trường cho 32, 8, và `0, 4, 8, 16, 24`cho cùng một cấu trúc. chương trình tự in bản sao thứ ba khi bạn xây dựng và chạy nó trên máy này:

```text
sizeof 32 align 8
kind 0 balance 4 code 8 rate 16 label 24
sum 315 tag -3 projected 318.75 label_length 7
```

Bộ AAPCS64 Arm nêu ra các quy tắc tổng hợp tương tự trong phần 5.10.1, và tài liệu arm64 của Apple giữ được năm kích thước scalar này, vì vậy các con số đồng ý trên cả hai mục tiêu.`-target x86_64-unknown-linux-gnu`để người đọc ELF từ bài học 33 và người đọc DWARF bên dưới làm việc trên chúng.

## Đọc phần còn lại của cấu trúc bằng tay

`bump`nhìn thấy một trường.`account.c`xem phần còn lại, và mỗi người cho thấy một mẫu hướng dẫn khác nhau.`account-x86_64-O0-g.objdump.txt`- Tôi không biết.

`sum_balances`Chỉ số một mảng của cấu trúc:

```text
      51: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      55: 48 63 4d ec                  	movslq	-0x14(%rbp), %rcx
      59: 48 c1 e1 05                  	shlq	$0x5, %rcx
      5d: 48 01 c8                     	addq	%rcx, %rax
      60: 8b 40 04                     	movl	0x4(%rax), %eax
```

`%rax`là `list`- `%rcx`là `i`Đơn hiệu mở rộng đến 64 bit, và `shlq $0x5`nhân bằng 32. Sau đó `addq`- `%rax`là `list + 32 * i`, và tải đọc 4 byte tại các phần tử 4 của `i`. Số lượng chuyển đổi là nơi duy nhất trong đối tượng này mà kích thước của cấu trúc xuất hiện như một số.`0x49`đến `jmp 0x49``0x72`- Tôi không biết.

`tag`đọc hai trường hẹp:

```text
      8c: 0f be 00                     	movsbl	(%rax), %eax
      98: 0f bf 48 08                  	movswl	0x8(%rax), %ecx
```

`movsbl`tải một byte tại ofset 0 và mở rộng nó, do đó, trường ở 0 là một chữ ký 1-byte nguyên số. `movswl`tải hai byte tại ofset 8 với mở rộng dấu hiệu, do đó, trường ở 8 là một chữ ký 2 byte nguyên.`-O1`Phiên cận đầu tiên là `cmpb $0x6c, (%rdi)`, vẫn nói 1 byte ở vị trí 0 và không nói gì về dấu hiệu.

`projected`đọc một dòng:

```text
      cc: f2 0f 2a 40 04               	cvtsi2sdl	0x4(%rax), %xmm0
      d5: f2 0f 59 40 10               	mulsd	0x10(%rax), %xmm0
```

`cvtsi2sdl`chuyển đổi một số nguyên 32 bit ký từ bộ nhớ sang một số đôi, xác nhận rằng ofset 4 giữ một số nguyên 4byte ký. `mulsd`được nhân gấp đôi từ bộ nhớ, do đó, ofset 16 giữ một giá trị điểm nổi 8 byte.

`label_length`đọc một chỉ dẫn và sau đó theo nó:

```text
      f3: 48 8b 40 18                  	movq	0x18(%rax), %rax
      f7: 48 63 4d f4                  	movslq	-0xc(%rbp), %rcx
      fb: 80 3c 08 00                  	cmpb	$0x0, (%rax,%rcx)
```

- `movq`đọc 8 byte tại ofset 24. tự nó là một số nguyên 8 byte hoặc một chỉ số.`cmpb`sử dụng giá trị tải như là cơ sở của một memory operand.`cmpb`đọc 1 byte tại index `%rcx`từ nó, và tại `-O1`chỉ số được tiến hành với `leaq 0x1(%rcx), %rcx`bên trong vòng lặp, vì vậy các yếu tố chỉ ra là 1 byte cách nhau.

Đặt 5 chức năng cùng nhau và cấu trúc là`{ i8 at 0, i32 at 4, i16 at 8, f64 at 16, pointer at 24 }`Các khoảng cách ở 1 đến 3 và 10 đến 15 chính xác là độ đệm quy tắc psABI dự đoán.`const char *`, loại được tuyên bố của byte được ký ở 0, mà nguồn đánh dấu `char`, và rằng năm hàm nhận được cùng một loại.`main`, mà chuyển một khung đối tượng cho tất cả năm.`-O0`Các trang gọi làm cho điều này hiển thị: `leaq -0x70(%rbp), %rdi`tiếp theo là `addq $0x20, %rdi`trước đây`callq bump`, và`addq $0x40, %rdi`trước đây`callq tag`. Các sự bù đắp 0, `0x20`, và`0x40`là ba yếu tố của một mảng, và `memcpy`của `0x60`Byte mà nó chứa là 96 byte, đó là ba yếu tố của 32.

## Thẻ đi

`trace_function()`trong `code/main.py`Hành trình hướng dẫn của một hàm theo thứ tự địa chỉ và giữ một trạng thái trừu tượng nhỏ.`-0x8(%rbp)`Mỗi người có một trong ba giá trị.`Pointer`là một root cộng với một ofset liên tục cộng với một tập hợp bước, nơi một bước ghi lại rằng một số nhân không rõ của nhiều byte đã được thêm vào.`Index`là một số nguyên của giá trị không biết là một nhân của một thang. bất cứ điều gì khác là không gì.

Nhà nước bắt đầu với sáu hệ thống V đăng ký lập luận giữ `Pointer("param0", 0)`qua `Pointer("param5", 0)`Sau đó mỗi hướng dẫn áp dụng một quy tắc:

- A `movq`giữa một sổ đăng ký 64-bit và một khe khung sao chép giá trị.`Index`với thang điểm 1.
- A `leaq`với một cơ sở chỉ số tạo ra một chỉ số với sự di chuyển được thêm vào, và với một sổ đăng ký chỉ số nó thêm `scale * index_scale`cho những bước tiến.`leaq`cơ sở của nó là`%rbp`hoặc `%rsp`đặt tên cho một vật thể khung, đó là cách `main`- Đăng ký`rows`- Tôi không biết.
- `shlq $n`trên một `Index`tăng gấp đôi quy mô của nó bằng `2^n`, và`imulq $k`nhân bằng `k`- Tôi không biết.
- `addq`của một chỉ số và một chỉ số giữ chỉ số và thêm quy mô chỉ số vào các bước. `addq $k`cho một chỉ số di chuyển chuyển chuyển đổi của nó và cũng được ghi lại như một phần tăng của sổ đăng ký đó.
- Một cuộc gọi làm cho mỗi sổ đăng ký được lưu bởi người gọi không được biết, và các sổ đăng ký lập luận có các chỉ dẫn được ghi lại như một trang web cuộc gọi.
- Bất kỳ bộ nhớ nào có sổ cái cơ sở chứa một chỉ số trở thành một `Access`Với gốc và đường trượt của chỉ dẫn, chiều rộng và kiểu từ mnemonic, và một lá cờ cửa hàng.

Lớn và tốt đẹp chỉ đến từ mnemonic.`access_width()`bản đồ `b`- `w`- `l`, và`q`hậu tố cho 1, 2, 4 và 8 byte, `movsbl`và `movswl`để ký tải hẹp, `movzbl`Không ký, `sd`và `ss`hướng dẫn SSE scalar cho các floats 8 byte và 4 byte, `cvtsi2sdl`đến một nguồn nguyên số 4 byte được ký kết, và 16 byte `movaps`gia đình cho một vector. `leaq`và `nop`Các biểu mẫu không phải là truy cập.

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

Một tải 8 byte qua một chỉ số tạo ra một chỉ số mới có tên gốc của trường nó đến từ, chẳng hạn như `param0->0x18`Khi giá trị đó sau đó được sử dụng như một cơ sở, hoặc tiến bộ với `leaq`, trường mà nó đến từ được đánh dấu như là một chỉ số được chứng minh. Đó là quy tắc biến chuyển chuyển đổi củafset 24 từ "8 byte" thành " chỉ số".

### Bốn loại bằng chứng bước

`infer_layout()`kết hợp các truy cập của mỗi chức năng chứng nhân và thu thập bước từ bốn nguồn, mỗi bước với hướng dẫn tạo ra nó.

| Kind | Where it comes from | Build that shows it |
|---|---|---|
| `scale` | an `Index` with scale above 1 reached a pointer, from `shlq $0x5` or `imulq` | `-O0`, `shlq $0x5, %rcx` at `0x59` |
| `loop-step` | a 64-bit increment of the base or index register inside a loop that also contains the access | `-O1`, `addq $0x20, %rdx` at `0x24` |
| `offset-delta` | same-width accesses through one base register inside one loop, at offsets a constant apart | `-O2`, eight loads 32 apart |
| `call-site` | the offsets at which one frame object is passed to the witness functions | `-O0`, `main` passes `rows`, `rows+0x20`, `rows+0x40` |

Một vòng lặp là một vòng quay ngược`jmp`hoặc chi nhánh có điều kiện, và một tăng chỉ tính khi phạm vi vòng lặp chứa cả tăng và truy cập.`addl $0x1, %eax`- Nó đang tiến lên.`i``-O0`, bởi vì nó là một 32 bit thêm và bởi vì truy cập không đi qua `%eax`. bước cuối cùng là chia chung lớn nhất của mọi giá trị được tìm thấy. kích thước là bước khi bước ít nhất lớn như cuối của trường cuối cùng.

### Loop vectorized ở -O2

Tại `-O2`Clang vectorises `sum_balances`. Cơ thể vòng từ `0x50`đến`0xaa`đọc tám yếu tố mỗi lần đi qua:

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

`%rax`bắt đầu từ `list + 0xe4`. 8 vụ di chuyển đặt tải lên các vị trí bù đắp`0x04, 0x24, 0x44, 0x64, 0x84, 0xa4, 0xc4, 0xe4`từ `list`, là`4, 36, 68, 100, 132, 164, 196, 228`. Tăng trưởng là `0x100`, là 256. Một thông qua ghi lại bù đắp khi nó nhìn thấy chúng báo cáo tám trường và một cấu trúc ít nhất 232 byte.

`fold_unrolled()`áp dụng một quy tắc. bên trong một vòng lặp, lấy các truy cập cùng chiều rộng thông qua một sổ đăng ký cơ sở.`d`nếu bước vòng lặp là`k * d`Và có những cái gì đó.`k`Các sự thay đổi khác nhau, vòng lặp đã được mở ra `k`thời gian, và mỗi truy cập là cùng một yếu tố truy cập tại offset `(offset - lowest) mod d`- Đây .`256 = 8 * 32`với tám lần trục xuất, nên tất cả tám tải gấp lên lần trục xuất 4, và ghi lại bằng chứng bước`offset-delta 32`- `unrolled 32`, và`loop-step 256`. Lòng còn lại scalar ở `0xe0`thêm `scale 32`từ `shlq $0x5, %rdx`và `loop-step 32`từ `addq $0x20, %rdx`. Các chia chung lớn nhất của tất cả năm giá trị là 32.

Hình ảnh có một nút mà tắt gấp.`-O2`build cho thấy bảy trường vượt qua byte 32 và không có kích thước.

## DWARF 5 Từ các byte

- `-g`xây dựng của `account.c`mang 8 phần debug. `.debug_info`là 493 byte, `.debug_abbrev`179, `.debug_str`230, `.debug_str_offsets`124, `.debug_addr`112, `.debug_line`312, `.debug_line_str`12, và `.debug_frame`264. Việc giới thiệu danh sách tiêu chuẩn DWARF 5 `.debug_str_offsets`- `.debug_addr`, và`.debug_line_str`như mới trong phiên bản 5. Người đọc trong `code/main.py`cần 5 người đầu tiên.

### Đầu tiêu đơn vị

Phần 7.5.1.1 của tiêu chuẩn cho tiêu đề đơn vị biên soạn đầy đủ: `unit_length`- `version`- `unit_type`- `address_size`, và`debug_abbrev_offset`. 12 byte đầu tiên của `.debug_info`là:

```text
e9 01 00 00   unit_length = 0x1e9 = 489
05 00         version = 5
01            unit_type = DW_UT_compile
08            address_size = 8
00 00 00 00   debug_abbrev_offset = 0
```

- `unit_type`byte là mới trong phiên bản 5, và tiêu chuẩn nói như vậy trong cùng một phần.`4 + 489 = 493`, cuối phần. `llvm-dwarfdump --debug-info`in cùng năm giá trị trên nó `Compile Unit:`dòng, và thử nghiệm đầu tiên phân tích dòng đó và so sánh.

### Các viết tắt

Phần 2.1 nói rằng mỗi mục thông tin sửa lỗi "đã bao gồm một thẻ nhận dạng và một loạt các thuộc tính".`.debug_abbrev`(giới 7.5.3) đặt tên thẻ, cho biết trẻ em có theo dõi hay không, và liệt kê từng thuộc tính với hình thức của nó.

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

`parse_abbreviations()`đọc mã ULEB128, thẻ ULEB128, một children byte, sau đó thuộc tính và hình thức cặp cho đến khi `0, 0`Phần 7.5.6 đưa ra các mã hóa hình thức: `data1`là một byte,`ref4`là một sự thay thế 4 byte so với đơn vị, `strx1`là một chỉ số 1 byte vào bảng tính tính toán chuỗi, `sec_offset`và `data4`là 4 byte, `addrx`là một chỉ số ULEB128 vào bảng địa chỉ, `exprloc`là một ULEB128 chiều dài và nhiều byte, và `flag_present`không có byte.

### Khóa mã thành viên cân bằng bằng tay

Nhập cấu trúc cho `account`bắt đầu tại Offset `0x195`với các byte `0c 15 20 00 03`Mã viết tắt là 12, cấu trúc.`DW_AT_name`là chỉ số chuỗi `0x15`- `DW_AT_byte_size`là `0x20`= 32, `DW_AT_decl_file`là 0, và `DW_AT_decl_line`là 3, đó là đường của `struct account {`trong nguồn.

Việc nhập nhập thành viên thứ hai bắt đầu từ `0x1a3`với `0d 10 88 01 00 00 00 05 04`- Có thể là:

1. `0d`là viết tắt 13, một thành viên.
2. `10`là `DW_AT_name`như `strx1`: string index 16.
3. `88 01 00 00`là `DW_AT_type`như `ref4`: bù đắp`0x188`từ khởi động đơn vị, đó là `DW_TAG_base_type`mục có tên `int`- Tôi không biết.
4. `00`là `DW_AT_decl_file`và `05`là `DW_AT_decl_line`: dòng 5 của `account.c`- Tôi không biết.
5. `04`là `DW_AT_data_member_location`: bù đắp 4.

Phần 5.7.6 nói rằng mục thành viên "có thể có thuộc tính DW_AT_data_member_location hoặc thuộc tính DW_AT_data_bit_offset" và rằng một định lượng số nguyên "là sự thay thế trong byte từ đầu của thực thể chứa".`addl 0x4(%rax), %ecx`, và`compare_layouts()`là hàm đặt hai bên cạnh nhau.

### Dòng và địa chỉ đi qua hai bảng

Chỉ số chuỗi 16 không phải là một sự thay thế vào `.debug_str`Người đọc sẽ lấy`DW_AT_str_offsets_base`từ mục đơn vị, đó là 8, và đọc mục 4 byte tại `8 + 4 * 16`trong `.debug_str_offsets`. Nhập đó có tính toán của `"balance"`trong `.debug_str`- Điều này cũng áp dụng cho địa chỉ.`sum_balances`bắt đầu với các byte `07 07`: viết tắt 7, một phần mềm, sau đó `DW_AT_low_pc`như `addrx`index 7. nhập 8 byte tại `8 + 8 * 7`trong `.debug_addr`là `0x30`, địa chỉ của chức năng trong `.text`6 mục đầu tiên trong bảng đó là địa chỉ của 6 chuỗi chữ cái.

Trong một đối tượng có thể di chuyển không có bảng nào giữ các giá trị cuối cùng của nó.`.debug_str_offsets`là 0 trong hồ sơ, và `.rela.debug_str_offsets`giữ 29 `R_X86_64_32`chuyển nhượng đối với `.debug_str`với sự bù đắp thực sự trong phụ lục. `.debug_addr`Có 13 `R_X86_64_64`chuyển nhượng đối với `.text`và `.rodata.str1.1`- `.debug_info`có bốn chuyển nhượng riêng của nó: sự rút ngắn của sự bù đắp,`DW_AT_str_offsets_base`như `.debug_str_offsets+0x8`- `DW_AT_stmt_list`, và`DW_AT_addr_base`như `.debug_addr+0x8`- `ElfObject.relocated()`áp dụng `S + A`cho các loại 32 và 64 bit trước khi người đọc phân tích một phần. Một biểu tượng phần có giá trị 0 trong tệp đối tượng, do đó, trường nhận thêm. `llvm-dwarfdump`có cùng độ phân giải, đó là lý do tại sao đầu ra của nó cho thấy tên và địa chỉ với mỗi chỉ số được giải quyết.

### Loại, chức năng và địa điểm

`DwarfInfo.type_name()`tiếp theo`DW_AT_type`Các tham chiếu.`label`điểm thành viên tại một `DW_TAG_pointer_type`, chỉ ra một `DW_TAG_const_type`, chỉ ra ở `char`kiểu cơ sở, do đó tên bao gồm `const char *`- `type_size()`trả lại `DW_AT_byte_size`cho các loại cơ sở và cấu trúc, 8 cho một chỉ số, và đếm nhiều lần kích thước yếu tố cho một mảng. `type_kind()`làm giảm `DW_AT_encoding`của một loại cơ bản đến `int`với một dấu hiệu, hoặc `float`, và một kiểu chỉ dẫn đến `pointer`, đó là từ vựng so sánh sử dụng.

`DwarfInfo.functions()`đọc sáu `DW_TAG_subprogram`Các mục.`bump`chạy từ `0x0`đến`0x21`, đó là `DW_AT_low_pc`cộng với `DW_AT_high_pc`chiều dài. cơ sở khung của nó là `DW_OP_reg6 RBP`, và các tham số của nó `a`có biểu thức vị trí `91 78``DW_OP_fbreg`với giá trị SLEB128 `0x78`, là -8. Đó là khe khung `-0x8(%rbp)`nơi ghi danh sách được lưu trữ `%rdi`tại địa chỉ `0x4`Thông tin debug và hướng dẫn mô tả cùng một khe từ hai bên.

## So sánh hai cách

`compare_layouts()`đi bộ các thành viên DWARF và tìm kiếm một trường suy luận ở cùng một trục trục.`no-evidence`Một trường có kích thước khác nhau là`size-mismatch`Một thành viên chỉ dẫn mà trường không bao giờ bị bỏ qua là`pointer-unproven`Một loại không đồng ý, chẳng hạn như một float nơi các hướng dẫn sử dụng số nguyên toán, là `kind-mismatch`Các trường trục xuất bắt đầu bên trong một thành viên hoặc bên trong đệm là `unexpected`- Kích thước so sánh bước với`DW_AT_byte_size`- Tôi không biết.

Số cho ba builds, từ `python3 code/main.py`- Có thể là:

| Build | Accesses through the first parameter | Fields | Stride evidence | Members matched | Size |
|---|---|---|---|---|---|
| `-O0` | 11 | 5 | `scale 32`, `call-site 32`, `call-site 64` | 5 of 5 | 32, match |
| `-O1` | 9 | 5 | `loop-step 32` | 5 of 5 | 32, match |
| `-O2` | 17 | 5 after folding, 12 before | `offset-delta 32`, `unrolled 32`, `loop-step 256`, `scale 32`, `loop-step 32` | 5 of 5 | 32, match |

Các khoảng trống được suy luận là 1 đến 3 và 10 đến 15 byte trong mỗi build, và đó chính xác là các byte đệm của bố cục DWARF. Mỗi trường suy luận nằm ở một số nhân của kích thước của riêng nó, đó là điều các quy tắc psABI yêu cầu, và `natural_alignment_ok()`ghi lại điều đó.

Thêm các chức năng một lần và hình ảnh thay đổi.`bump`đơn độc bố trí là một trường ở ofset 4, kích thước không rõ, và ranh giới dưới là 8. `sum_balances`thêm bước đi. `tag`thêm các điểm bù trừ 0 và 8. `projected`thêm float ở 16. `label_length`thêm chỉ số vào 24 và chứng minh nó là chỉ số. `main`thêm các trang gọi tại `-O0`và không thêm gì vào `-O1`và `-O2`, bởi vì bộ sưu tập đã xếp vào mỗi cuộc gọi.

Ba thứ không thể tiếp cận được.`const`Không có trong hướng dẫn.`label`chỉ là "những yếu tố 1 byte khác nhau" từ `leaq 0x1(%rcx), %rcx`trong vòng lặp chuỗi, phù hợp với `char`và với `unsigned char`và `_Bool`- Tại `-O1`dấu hiệu của byte tại ofset 0 là không rõ, bởi vì `cmpb $0x6c, (%rdi)`so sánh mà không mở rộng.`int8`ở đó và `i8``-O0`, nơi `movsbl`Đây là những sự kiện học tập 35 ghi lại như là không biết.

## C++ đối tượng

`shapes.cpp`định nghĩa `Shape`Với một máy phá hủy ảo, một máy phá hủy ảo hoàn toàn.`area()`, và một ảo `name()`, và`Rect`, xuất phát từ `Shape`và thêm hai `int`Itanium C++ ABI điều chỉnh cách clang đặt ra các điều này trên x86-64 Linux.

### Tên đầm lẫn

Phần 5.1.2 của ABI nói "một tên bị làm hỏng bằng cách viết trước `_Z`"Điều này có 19 biểu tượng như vậy.`_ZNK4Rect4areaEv`đọc như `_Z`, sau đó `N`cho một tên đẻ, `K`cho hàm thành viên const, `4Rect`và `4area`như tên nguồn có chiều dài,`E`để đóng tên đệm, và `v`cho một danh sách tham số trống. `llvm-cxxfilt`dấu vân tay`Rect::area() const`- `_Z8describeRK5Shapei`là `describe(Shape const&, int)``R`là một tài liệu tham chiếu,`K`là const,`5Shape`là lớp học,`i`là `int`Các tên đặc biệt trong phần 5.1.4 là `_ZTV`cho một chiếc vtable, `_ZTI`cho typeinfo, và `_ZTS`cho chuỗi tên typeinfo. Các nhà xây dựng và phá hủy là `C1`- `C2`- `D0`- `D1`, và`D2`, vậy `_ZN4RectD0Ev`và `_ZN4RectD2Ev`cả hai in như `Rect::~Rect()`: trình tiêu diệt xóa và trình tiêu diệt đối tượng cơ sở chia sẻ tên nguồn.

`Demangler`trong `code/main.py`bao gồm bộ phận đó cộng với mã loại xây dựng của mục 5.1.5.2 và các `S_`Các thay thế của phần 5.1.10.`llvm-cxxfilt --no-strip-underscore`output. cờ quan trọng trên macOS, nơi công cụ loại bỏ một điểm nhấn hàng đầu theo mặc định và sau đó không nhận ra `Z8describe...`- Tôi không biết.

### Vtable từ việc di chuyển của nó

Phần 2.5.2 của ABI liệt kê các thành phần của một bảng ảo theo thứ tự: các sự thay đổi cuộc gọi ảo, các sự thay đổi cơ sở ảo, sự thay đổi lên trên, chỉ số typeinfo, và sau đó các chỉ số chức năng ảo. Điểm địa chỉ, giá trị vptr của một đối tượng, là địa chỉ của chỉ số chức năng đầu tiên (phần 2.6.2). `Rect`không có cơ sở ảo, vì vậy bảng của nó được chuyển sang trên, typeinfo, và chức năng.

Biểu tượng`_ZTV4Rect`là 0x30 byte, 6 khe 8 byte. trong đối tượng mỗi byte là 0. nội dung là trong `.rela.data.rel.ro._ZTV4Rect`- Có thể là:

```text
0000000000000008 R_X86_64_64              _ZTI4Rect
0000000000000010 R_X86_64_64              _ZN4RectD2Ev
0000000000000018 R_X86_64_64              _ZN4RectD0Ev
0000000000000020 R_X86_64_64              _ZNK4Rect4areaEv
0000000000000028 R_X86_64_64              _ZNK4Rect4nameEv
```

Slot 0 giữ các ofset lên trên, đó là 0 và không cần phải di chuyển. Slot 1 là typeinfo. Điểm địa chỉ là tại `+16`Từ đó, khe 0 là cái phá hủy toàn thể đối tượng, khe 1 là cái phá hủy xóa, khe 2`area`, phần 3`name`- `read_vtable()`đọc kích thước biểu tượng, các di chuyển trong phạm vi của nó, và số 0 tại bù trừ 0. `Shape`Bàn có hình dạng giống như `__cxa_pure_virtual`trong khe 2, đó là chức năng runtime mà một cuộc gọi ảo thu được.

### RTTI

Phần 2.9.4 mô tả `std::type_info`như một vptr tiếp theo bởi một chỉ dẫn đến tên loại mang mang mang mang, và liệt kê các lớp phái sinh. `_ZTI4Rect`có ba chuyển nhượng: `_ZTVN10__cxxabiv120__si_class_type_infoE+0x10`- `_ZTS4Rect`, và`_ZTI5Shape`Thứ nhất là vtable của`__si_class_type_info`, lớp mà ABI sử dụng cho một loại với một cơ sở không ảo công cộng duy nhất tại ofset zero, và `+0x10`là điểm địa chỉ của vtable đó. Điểm thứ hai ở chuỗi `4Rect`, là tên loại mang mang mang, và `name()`trên một `type_info`trả lại chính xác chuỗi đó. thứ ba là cơ sở. `_ZTI5Shape`sử dụng `__class_type_info`và không có điểm điểm cơ sở. `read_typeinfo()`trả lại ba sự thật này.

### Cuộc gọi ảo

`describe``-O0`thực hiện một cuộc gọi ảo:

```text
       f: 48 8b 7d f8                  	movq	-0x8(%rbp), %rdi
      13: 48 8b 07                     	movq	(%rdi), %rax
      16: ff 50 10                     	callq	*0x10(%rax)
```

Thứ nhất `movq`tải chỉ số đối tượng. thứ hai đọc 8 byte tại offset 0 của đối tượng, đó là vptr, bởi vì ABI đặt nó đầu tiên trong một lớp với các chức năng ảo.`callq`đi qua `0x10`qua VPT, và `0x10 / 8`là khe 2.`find_virtual_calls()`phù hợp với mô hình và báo cáo cả hai ứng cử viên: `Rect::area() const`từ `_ZTV4Rect`và `__cxa_pure_virtual`từ `_ZTV5Shape`Cái nào chạy phụ thuộc vào đối tượng, đó là lý do tại sao cuộc gọi là gián tiếp.

DWARF ghi lại cùng một khe cắm.`DW_TAG_subprogram`Các mục cho `area`trong cả hai lớp mang `DW_AT_vtable_elem_location (DW_OP_constu 0x2)`- `name`mang khe 3 và các tàu khu trục mang khe 0. `Rect`là một `DW_TAG_structure_type`16 byte với một `DW_TAG_inheritance`mục nhập cho `Shape`tại offset 0 và thành viên `w`lúc 8 giờ và`h`12 giờ.`Shape`là 8 byte với một thành phần nhân tạo `_vptr$Shape`Hai dẫn xuất độc lập cho khoảng 2 cho `area`: bảng chuyển nhượng và các mục lỗi.

Tại `-O1`đối tượng không có vtable. `main`xây dựng `Rect`như một địa phương, vì vậy trình biên dịch giải quyết `r.name()`và `describe(r, 2)`Không có gì lấy địa chỉ của bảng, vì vậy bảng không được phát ra. `describe`vẫn chứa `movq (%rdi), %rax`và `callq *0x10(%rax)`, bởi vì tham số của nó có thể là bất kỳ `Shape`. Một vtable bị mất là một sự thật về một tệp đối tượng, và thử nghiệm `test_the_optimised_object_keeps_the_call_pattern_but_drops_the_vtables`kiểm tra cả hai nửa.

Microsoft ABI khác nhau trong từng chi tiết này.`?`và mã hóa các cuộc gọi của hội nghị, vì vậy `void test(void)`được biên soạn như C++ `__cdecl`là `?test@@ZAXXZ`. Máy định vị RTTI nằm ở `vfptr[-1]`như một `_RTTICompleteObjectLocator`, và các biểu tượng là `??_7`cho một vftable và `??_R4`cho bộ định vị. tài liệu của Microsoft nói rằng "không có tiêu chuẩn cho việc đặt tên C++ giữa các nhà cung cấp trình biên dịch".

## Làm thế nào các công cụ cho thấy các loại đã được phục hồi

Mỗi dòng bên dưới tên một đầu ra đã được sản xuất trên máy này và ghi lại vào `code/fixtures/tools/`Các hàng cho các công cụ không được cài đặt ở đây mô tả tài liệu của họ và nói như vậy.

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

Khả năng phát ra của Ghidra mà không có DWARF cho thấy hai quy tắc tương tự đang hoạt động.`char *`đến tham số của `tag`bởi vì hàm so sánh một byte qua nó, và `char **`đến sân vận động tại `0x18`Vì `label_length`Deresferences giá trị tải và so sánh byte. Đó là hai quy tắc tương tự như thông qua trong bài học này: chiều rộng từ hướng dẫn, chỉ dẫn từ từ bỏ. Tài liệu giải tập của Ghidra nói rằng các varnodes mã p "không nhất thiết phải có một loại dữ liệu liên quan đến chúng" và rằng người giải tập "sau cùng sẽ gán một loại dữ liệu chính thức" bằng cách lây lan. Tùy chọn "Tổ các chỉ số liên tục" mở rộng sự gia tăng tương tự cho các định vị. Ghidra 12.1 đã thêm phần hồi phục bitfield vào máy giải biên dịch, mà các thiết bị trong bài học này không thực hiện.

Bảng làm bằng tay là nửa còn lại của câu chuyện. Người quản lý kiểu dữ liệu của Ghidra, các loại địa phương của IDA, các hồ sơ kiểu Binary Ninja và Rizin `td`tất cả để bạn nhập cấu trúc từ bố cục phục hồi và xem decompiler tái trình bày. Pass cho bạn biết bạn nên gõ gì và các trường bạn đang đoán.

rea 6.5.0 với nhà cung cấp Ghidra của nó trả lại văn bản giải biên dịch như một bản ghi. Tất cả mọi thứ trong hàng Ghidra áp dụng cho nó, và bản ghi mang tên loại mà không có bằng chứng đã tạo ra chúng.`python3 code/main.py infer`trên cùng danh sách cho bạn bằng chứng đó.

## Nghiên cứu về loại suy luận

Điểm đi qua ở đây là một nửa hệ thống suy luận kiểu, giới hạn ở một cấu trúc đạt từ một tham số.

- TIE (Lee, Avgerinos, Brumley, NDSS 2011) đã định hình tái tạo kiểu như tạo ra ràng buộc và giải quyết trên một IR nhị phân, đo bảo thủ và độ chính xác, và so sánh với một máy giải biên dịch thương mại trên 87 chương trình cốt lõi.
- Retypd (Noonan, Loginov, Cok, PLDI 2016) đã thêm các loại phụ, đa hình hóa và loại tái tạo, và báo cáo tái tạo của chỉ số `const`Một ứng dụng mã nguồn mở tồn tại dưới tên GrammaTech.
- OSPREY (Zhang và những người khác, IEEE S&P 2021) xử lý mỗi vị trí bộ nhớ như một biến ngẫu nhiên và suy luận các loại có khả năng nhất.
- DIRTY (Chen và các công ty khác, USENIX Security 2022) và ReSym (Xie và các công ty khác, CCS 2024) sản xuất máy giải biên dịch sau quá trình với các mô hình học tập, và ReSym báo cáo độ chính xác 72,9% trên bố cục cấu trúc đầy đủ.
- RecStruct (Chen và những người khác, USENIX Security 2026) phục hồi các struct tổ hợp mà không cần một decompiler, với việc thực hiện biểu tượng không nhạy cảm với dòng chảy và tìm liên minh trên khe cột.

Chế độ xếp hàng là thứ đầu tiên bài học này bỏ qua.`-O1`- `main`giữ `rows`trên đống và mã được ghi trong chữ `0x24(%rsp)`- `0x40(%rsp)`- `0x48(%rsp)`- `0x30(%rsp)`, và`0x38(%rsp)`Những mô-đun 32 này là 4, 0, 8, 16 và 24: cùng một cấu trúc, không có tham số để gieo.

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một báo cáo JSON với năm phần. `dwarf`giữ tiêu đề đơn vị, cấu trúc và chức năng của `-O0`đối tượng.`oracles`giữ quy định quy tắc psABI, `ctypes`thiết kế, thiết kế DWARF, chạy bản địa, và một `agree`cờ.`builds`chứa các truy cập, bố cục suy luận, và so sánh cho mỗi ba đối tượng. `cxx`chứa các tên bị phá vỡ, cả vtables, cả typeinfo ghi lại, cuộc gọi ảo, và các khe DWARF. `tools`liệt kê các sản phẩm công cụ được ghi lại.

Hình dạng dự kiến:

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

Đọc `code/main.py`theo thứ tự này:

1. `ElfObject`đọc các phần, biểu tượng và di chuyển, và `relocated()`áp dụng `S + A`đến một phần sửa lỗi.
2. `parse_abbreviations()`và `DwarfInfo._parse_unit()`đọc tiêu đề, bảng viết tắt, và các mục, sau đó giải quyết `strx`và `addrx`qua hai bàn.
3. `DwarfInfo.struct_layouts()`và `functions()`biến các mục thành `StructLayout`và `FunctionInfo`ghi chép, với `type_name()`- `type_size()`, và`type_kind()`- Tôi không biết.
4. `parse_listing()`- `parse_memory()`, và`access_width()`đọc `llvm-objdump`- Thư.
5. `trace_function()`là máy trạng thái trừu tượng, và`fold_unrolled()`và `infer_layout()`biến các lối vào thành một bố cục.
6. `compare_layouts()`tạo ra các hàng trạng thái, và `sysv_layout()`và `ctypes_layout()`là hai vị thần tiên tri khác.
7. `Demangler`- `read_vtable()`- `read_typeinfo()`, và`find_virtual_calls()`bao gồm đối tượng C ++.

Có thêm bốn lệnh nữa.`python3 code/main.py dwarf FILE.o`in các cấu trúc và chức năng của bất kỳ vật thể DWARF 5 được chuyển. `python3 code/main.py infer LISTING.txt [FILE.o]`chạy thông qua trên một danh sách và, với một đối tượng, so sánh với DWARF của nó. `python3 code/main.py demangle NAME...`và `python3 code/main.py vtable FILE.o`bao gồm nửa C++.

## Sử dụng nó

Trên một vật thể mới mà anh tự xây dựng:

1. Tắt `llvm-objdump -d -r`của đối tượng và giữ nó bên cạnh đối tượng.
2. Đi chạy`python3 code/main.py infer`Đọc dòng nhân chứng trước tiên: nó đặt tên các hàm mà tham số đầu tiên được sử dụng như một cơ sở bộ nhớ. Nếu một hàm bị thiếu, tham số của nó không bao giờ đạt đến một memory operand, hoặc nó đạt đến một thông qua một con đường mà pass không theo dõi.
3. Đọc từng trường với số lượng truy cập của nó. Một truy cập là một nhân chứng.
4. Đọc bằng chứng bước đi.`call-site`hoặc `scale`Nhập mạnh mẽ.`loop-step`nhập không có loại nào khác là yếu, bởi vì một vòng lặp không xoay báo cáo bước của một số yếu tố. Nếu `unrolled`xuất hiện, kiểm tra gấp bằng tay.
5. Nếu `-g`xây dựng tồn tại, chạy so sánh và đọc mỗi hàng không `match`. A `no-evidence`dòng tên một thành viên không liên quan đến hàm.`unexpected`dòng tên một quyền truy cập mà thẻ thông qua không thể đặt.
6. Nhập bố cục vào quản lý kiểu của công cụ của bạn như một struct, và ghi lại các trường, tên và loại là đoán.

Hãy giữ được ba thần tiên trong tầm với.`ctypes`, và DWARF không đồng ý về một bố cục mà bạn đã viết, bạn đã tìm thấy một cấu trúc đóng gói, một bit-field, hoặc một mục tiêu với các quy tắc khác nhau.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: giải mã mục thành viên

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types/code
python3 -q
```

Đi chạy:

```python
from main import *
elf = load_object("account-x86_64-O0-g.o")
dwarf = DwarfInfo(elf)
dwarf.header()
elf.section(".debug_info").data[0x1a3:0x1ac].hex(" ")
dwarf.dies[0x1a3].attributes
dwarf.type_name(dwarf.type_of(dwarf.dies[0x1a3]))
```

Hãy giải mã 9 byte trên giấy với viết tắt 13 trước khi bạn nhìn vào từ điển.`elf.section(".debug_str_offsets").data[8:16].hex()`, và người được chuyển đi,`elf.relocated(".debug_str_offsets")[8:16].hex()`, và giải thích sự khác biệt.

### Phòng thí nghiệm B: theo dõi một hàm

```python
listing = load_listing("account-x86_64-O0-g.objdump.txt")
trace = trace_function("label_length", listing["label_length"])
[(hex(a.address), a.root, a.offset, a.width, a.kind) for a in trace.accesses]
trace.pointer_uses
trace_function("sum_balances", listing["sum_balances"]).loops
```

Viết xuống, trước khi chạy, truy cập nào chứng minh rằng ofset 24 là một chỉ số.`-O1`danh sách và tìm ra `leaq 0x1(%rcx), %rcx`trong `trace.increments`- Tôi không biết.

### Phòng thí nghiệm C: gấp vòng xoắn

```python
o2 = load_listing("account-x86_64-O2-g.objdump.txt")
trace = trace_function("sum_balances", o2["sum_balances"])
sorted({a.offset for a in trace.accesses})
folded, evidence = fold_unrolled(trace, trace.accesses)
sorted({a.offset for a in folded}), [(e.kind, e.value, e.text) for e in evidence]
```

Rồi chạy đi.`analyze_build("O2", fold=False)["comparison"]`và đếm số`unexpected`thay đổi quy tắc gấp để nó yêu cầu bước vòng lặp chính xác`k * d`với `k`ít nhất là 2, và xác nhận rằng `-O1`vòng lặp, với một truy cập và bước 32, được để lại một mình.

### Phòng thí nghiệm D: bảng và tên

```python
shapes = load_object("shapes-x86_64-O0-g.o")
read_vtable(shapes, "_ZTV4Rect")
read_typeinfo(shapes, "_ZTI4Rect")
demangle("_ZNK4Rect4areaEv"), demangle("_Z8describeRK5Shapei")
find_virtual_calls(load_listing("shapes-x86_64-O0-g.objdump.txt"), [read_vtable(shapes, "_ZTV5Shape"), read_vtable(shapes, "_ZTV4Rect")])
```

Xét khoảng từ `callq *0x10(%rax)`trên giấy, sau đó xác nhận nó chống lại `DwarfInfo(shapes).struct("Rect").virtual_methods`- Vậy thì tải lên`shapes-x86_64-O1-g.o`và thử`read_vtable`Đọc bài viết này.`ElfError`và giải thích tại sao biểu tượng bị vắng mặt.

## Phòng thí nghiệm thực hành

Khôi phục lại cấu trúc hàng trong `main``-O1`- Tôi không biết.

Yêu cầu:

- Tăng `trace_function()`để một vùng khe khung có thể là một gốc.`movaps`cửa hàng mà điền `0x0(%rsp)`đến`0x5f(%rsp)`từ `.data.rel.ro`, là 96-byte khởi tạo của `rows`- Tôi không biết.
- Đưa vào các truy cập được ghi trong `0x24(%rsp)`- `0x40(%rsp)`- `0x48(%rsp)`- `0x30(%rsp)`, và`0x38(%rsp)`đến gốc và báo cáo các sự bù đắp của họ modulo một ứng cử viên bước đi.
- Trả bước 32 từ vòng lặp ở `0x120`đến`0x12c`, nơi `%r14`bắt đầu từ 4 và tiến lên `0x20`cho đến khi`0x64`, và cho thấy rằng vòng lặp kết nối `0x64`là ba yếu tố cộng với field offset.
- So sánh kết quả với bố cục DWARF và đạt đến năm trận đấu, và ghi lại loại nào vẫn chưa được chứng minh.
- Thêm một bài kiểm tra thất bại khi gốc khung được gán cho một tham số.

Thành công là nghĩa của`python3 code/main.py infer`trên `-O1`danh sách danh sách `main`như một nhân chứng với một gốc khung, và so sánh cho thấy năm trận đấu từ `main`- Anh ấy chỉ có mình.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-recovering-data-and-types.md`Sử dụng nó để biến một danh sách và một cấu trúc sửa lỗi tùy chọn thành một bố cục cấu trúc với bằng chứng cho mỗi trường, một bước với các nguồn của nó, so sánh với DWARF, và một danh sách những gì vẫn chưa được biết. Nó yêu cầu bảng truy cập, bằng chứng bước, kiểm tra gấp, Oracle DWARF khi có, và một tuyên bố tên và trình chuẩn mà không có hướng dẫn nào có thể cung cấp.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Việc kiểm tra phải chứng minh:

- tiêu đề đơn vị, 14 viết tắt và 5 thành viên bù đắp đồng ý với `llvm-dwarfdump`
- Tên đến qua những người di chuyển `.debug_str_offsets`bàn và đơn vị của `str_offsets_base`và `addr_base`là 8
- sáu chức năng mang các phạm vi, `DW_OP_reg6 RBP`, và`DW_OP_fbreg`vị trí dump hiển thị, và địa chỉ thấp của họ bằng với các danh sách chức năng bắt đầu
- một vật thể không có `.debug_info`nâng, và bộ xử lý máy giải mã LEB128 `0x78`như -8
- `pyelftools`và `lldb`in cùng bố cục như người đọc
- Các quy tắc của psABI, `ctypes`, DWARF, và chạy bản địa cung cấp bù đắp `0, 4, 8, 16, 24`và kích thước 32, và cấu trúc được sắp xếp lại là 24 byte
- trình phân tích danh sách đọc 13 hướng dẫn trong `bump`, đính kèm `R_X86_64_PLT32 bump-0x4`đến cuộc gọi tại `0x194`, và tìm thấy nhảy ngược ở `0x72`
- Các bộ nhớ operand, chiều rộng, loại và dấu hiệu giải mã từ văn bản AT&T và mnemonic
- `bump``-O0`đọc chỉ số của nó trở lại từ khe khung và thực hiện ba truy cập tại offset 4
- bước đi đến từ `shlq $0x5``-O0`, từ `addq $0x20, %rdx``-O1`, và từ tám tải được gấp bằng một bước 256 tại `-O2`
- `label_length`chứng minh chỉ số tại ofset 24 bằng cách bỏ nó
- `main`vượt qua một đối tượng khung ở các offsets 0, `0x20`, và`0x40``-O0`và không gọi gì ngoài `printf``-O1`
- mỗi xây dựng phù hợp với năm trong năm thành viên với kích thước 32 và khoảng trống bằng với bộ đệm DWARF
- không gấp `-O2`xây dựng báo cáo bảy trường vượt qua byte 32 và không có kích thước
- người phá hoại tái sinh tất cả 19 `llvm-cxxfilt`Dòng
- cả vtables, cả typeinfo ghi lại, và cuộc gọi ảo tại `0x16`quyết định để khe 2, và DWARF đồng ý
- `-O1`C ++ đối tượng giữ các mẫu gọi và không có vtable
- Các hình ảnh Ghidra, rizin và radar2 cho thấy cấu trúc với DWARF và các bộ phận thô không có nó
- Hình ảnh tương tác chứa cùng các dữ liệu mà phân tích tạo ra

## Các chế độ sản xuất thất bại

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

## Quy tắc hoạt động

Khôi phục một trường từ một truy cập và một bước từ một vòng lặp, và gắn hướng dẫn vào mỗi. Lập vòng tròn trước khi bạn tin tưởng một sự thay đổi qua bước. Đọc DWARF thông qua các viết tắt của nó và bảng chuyển chỗ của nó, không bao giờ bằng cách chỉ mục vào một phần chuỗi. So sánh trường theo trường và viết mỗi thành viên không có bằng chứng, mỗi chỉ số không được chứng minh, và mỗi tên là không biết. Trong một đối tượng C ++, đọc vtable từ việc di chuyển của nó và khe cắm từ cuộc gọi, sau đó sử dụng DWARF để xác nhận khe cắm bạn đọc.

## Đọc thêm

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, section 3.1.2: Data Representation](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), section 5.10: Composite Types](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 1, section 3.7.5: Specifying an Offset](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [DWARF Debugging Information Format Version 5, sections 2.1, 5.7.6, 7.5.1.1, 7.5.3, 7.5.6](https://dwarfstd.org/doc/DWARF5.pdf)
- [Itanium C++ ABI, sections 2.5 (Virtual Table Layout), 2.9 (Run-Time Type Information), 5.1 (External Names)](https://itanium-cxx-abi.github.io/cxx-abi/abi.html)
- [Microsoft Learn: Decorated names](https://learn.microsoft.com/en-us/cpp/build/reference/decorated-names?view=msvc-170)và [Name Decoration](https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/name-decoration?view=msvc-170)
- [llvm-dwarfdump command guide](https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html)và [llvm-cxxfilt command guide](https://llvm.org/docs/CommandGuide/llvm-cxxfilt.html)
- [Python ctypes: Structure layout, sizeof, alignment](https://docs.python.org/3/library/ctypes.html)
- [Ghidra Data Type Manager](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/help/help/topics/DataTypeManagerPlugin/data_type_manager_description.htm)- [Decompiler Concepts](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerConcepts.html)- [Decompiler Options](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerOptions.html), và[Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build)
- [IDA 9.1 user guide: Types](https://docs.hex-rays.com/9.1/user-guide/types)- [IDA 9.4 release post](https://hex-rays.com/blog/ida-9.4-release-a-new-dyld-shared-cache-swift-analysis-new-teams-add-on-and-more-), và[IDA Free](https://hex-rays.com/ida-free)
- [Binary Ninja user guide: Types](https://docs.binary.ninja/guide/types/)và [Binary Ninja 6.0 Krypton](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)và [rizin v0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
- [GDB manual: Examining the Symbol Table, ptype /o](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Symbols.html)
- [pyelftools on PyPI](https://pypi.org/project/pyelftools/)
- [Lee, Avgerinos, Brumley, "TIE: Principled Reverse Engineering of Types in Binary Programs" (NDSS 2011)](https://www.ndss-symposium.org/ndss2011/tie-principled-reverse-engineering-of-types-in-binary-programs/)
- [Noonan, Loginov, Cok, "Polymorphic Type Inference for Machine Code" (PLDI 2016)](https://arxiv.org/abs/1603.05495)và [the retypd repository](https://github.com/GrammaTech/retypd)
- [Zhang et al., "OSPREY: Recovery of Variable and Data Structure via Probabilistic Analysis for Stripped Binary" (IEEE S&P 2021)](https://ieeexplore.ieee.org/document/9519451/)
- [Chen et al., "Augmenting Decompiler Output with Learned Variable Names and Types" (USENIX Security 2022)](https://www.usenix.org/conference/usenixsecurity22/presentation/chen-qibin)
- [Xie et al., "ReSym: Harnessing LLMs to Recover Variable and Data Structure Symbols from Stripped Binaries" (CCS 2024)](https://dl.acm.org/doi/10.1145/3658644.3670340)
- [Chen et al., "RecStruct" (USENIX Security 2026)](https://www.usenix.org/conference/usenixsecurity26/presentation/chen-yuxin)
