# Các ngôn ngữ biên dịch: Điều gì tối ưu hóa làm cho mã của bạn và cách đọc lại nó

> Một trình biên dịch tối ưu hóa thay thế các cấu trúc nguồn bằng các hình thức hướng dẫn rẻ hơn. Mỗi hình dạng có một dẫn xuất, và bài học này xây dựng bộ nhận dạng chạy dẫn ngược và kiểm tra nó so với nguồn.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, AArch64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode), Phase 13 · 38 (calling conventions)
**Time:** ~150 minutes

## Mục tiêu học tập

- Thuộc số phép thuật và chuyển đổi để chia bằng bất kỳ vĩnh viễn nào với giới hạn Granlund-Montgomery, và lấy lại bộ chia từ các vĩnh viễn phát ra.
- Hãy nêu tên năm cách LLVM giảm a `switch`và đọc số lượng nhập, vị trí bảng, và các nhập từ đối tượng.
- Đọc một vòng tròn vectorized như đường ray, bộ tích lũy, các yếu tố mỗi lần lặp lại, mặt nạ đếm gấp ba lần, giảm và vòng tròn còn lại.
- Nhận ra những cuộc gọi đuôi, những cuộc gọi trong đường, những lựa chọn không có nhánh, và các vòng lặp đã trở thành `memset`hoặc `memcpy`- Tôi không biết.
- Báo cáo mỗi ngôn ngữ với hướng dẫn chứng cứ và hình thức nguồn được giải mã của nó, trên x86-64 và trên AArch64, tại `-O0`qua `-O3`- Tôi không biết.
- So sánh kết quả với những gì Ghidra, Angr, radar2, rizin, và lldb cho cùng một byte.

## Vấn đề

Anh đã biên soạn`idioms.c``-O2`và hỏi một đại lý gì `div7u`- Cảnh sát đã đọc.`imulq $0x24924925, %rax, %rax`và trả lời rằng hàm nhân bằng 613566757, thay đổi, và thêm.`x / 7`- Tôi không biết.

cùng một vật có một `switch`Với bảy trường hợp mà không có nhảy cả, một `switch`với năm trường hợp đó là một bàn nhảy, một `switch`với hai trường hợp đó là một `sete`và một `cmovne`, và một vòng quay qua `n`số nguyên tử chạy tám số nguyên tử mỗi lần lặp lại trong hai `xmm`ghi lại và sau đó hoàn thành phần còn lại trong vòng lặp thứ hai.`-O0`cùng nguồn sản xuất `divl`, bảy bàn nhảy nhập, và một vòng tròn.`-O1`chuyển đổi bảy trường hợp trở thành một bảng giá trị và vòng vector vẫn chưa tồn tại.

Các hình dạng này là những ngôn ngữ. Một trình biên dịch phát ra mỗi một quy tắc bạn có thể đọc trong nguồn của nó, và mỗi một có thể được giải mã trở lại cấu trúc nó đến từ.`0x66666667`Bài học này xây dựng bộ nhận dạng cho tất cả chúng, chạy nó trên 18 bản của mã của chúng ta, và xác minh tất cả 373 báo cáo chống lại nguồn C.

```figure
re-39-idioms-by-level
```

## Một ngôn ngữ là một hình dạng có nguồn gốc

Một ngôn ngữ là một chuỗi các hướng dẫn mà trình biên dịch phát ra cho một cấu trúc nguồn. Ba điều làm cho nó dễ nhận ra. Nó có hình dạng cố định, các biểu diễn mang các định vị mà dẫn xuất dự đoán, và hình dạng khác với những gì một lập trình viên sẽ viết bằng tay.

Máy nhận dạng trong `code/main.py`Các tác phẩm trên văn bản của `llvm-objdump -d -r`, bài học 33 thiết lập như là Oracle cho giới hạn hướng dẫn. Nó phân tích mỗi hàm thành hướng dẫn với địa chỉ, byte, mnemonic, operands, và dòng di chuyển sau nó. Nó đọc các tệp đối tượng chỉ cho hai thứ: các byte của `.rodata`, nơi các bảng giá trị sống, và các `.rela.rodata`các mục nhập, nơi các mục tiêu của bàn nhảy sống trước khi kết nối.

Mỗi phát hiện đều là một`Idiom`ghi lại với một `kind`, một mã hóa`source`hình thức, danh sách `evidence`địa chỉ, một `detail`từ điển, và một `verified`cờ. cờ đến từ nguồn C. `parse_source()`đọc `idioms.c`, tìm thấy mỗi hàm, và trích xuất các phân chia sau đó `/`và `%`, các nhân số sau `*`, `switch`Các trường hợp và giá trị của chúng,`? :`Các nhà khai thác, các `for`Loops, và các calles. Một ngôn ngữ phân chia được xác minh khi phân chia của nó nằm trong danh sách phân chia của hàm. Một bảng tìm kiếm được xác minh khi các mục nhập của nó phù hợp với các giá trị trường hợp, lên đến một yếu tố liên tục. Một cuộc gọi đuôi được xác minh khi call được gọi trong nguồn. Báo cáo demo kết thúc với một `unverified`danh sách, và bộ thử nghiệm khẳng định danh sách trống rỗng cho tất cả 18 builds.

Việc giải mã cần tên. Các công nhận chạy một đánh giá biểu tượng nhỏ trên các khối cơ bản của mỗi hàm, theo thứ tự liệt kê, với các tên tham số từ nguồn trong các sổ đăng ký lập luận của các quy ước System V và AAPCS64 từ bài học 38.`-O0`code đọc qua các dòng của nó. Tại mỗi mục khối các trạng thái của các tiền nhiệm được sáp nhập, và nơi chúng khác nhau một tên mà một ngôn ngữ trước được gán thắng một liên tục.`cmovll %edx, %eax`trong `digest`đọc lại như `sum % 10 < 5 ? sum % 10 : 5`: từ ngữ vòng được đặt tên là bộ tích lũy `sum`, ngôn ngữ chia tên là phần tử của nó `sum / 10`, và ngôn ngữ modulo đặt tên cho kết quả của nó`sum % 10`Nguồn tin viết:`rem > 5 ? 5 : rem`Cả hai biểu hiện đều cho phép nhỏ hơn của`rem`và 5, và họ đồng ý ở `rem == 5`- Tôi không biết.

## Sự chia rẽ theo một sự liên tục

Granlund và Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994), thay thế `n / d`với một lần và một thay đổi.`s`và một nhân`m = ceil(2^s / d)`- Vậy thì`floor(n * m / 2^s)`=`floor(n / d)`cho mỗi `n`trong phạm vi khi lỗi `e = m * d - 2^s`là đủ nhỏ. cho 32 bit không ký kết.`n`giới hạn là `e <= 2^(s - 32)`. Để ký `n`với `|n| < 2^31`giới hạn là `e <= 2^(s - 31)`, và một dấu hiệu sửa chữa thêm 1 khi `n`là âm, bởi vì sàn xoay theo hướng sai cho số lượng âm.

`magic_numbers(d, bits, signed)`trong `main.py`tìm kiếm `s`tìm kiếm này tái tạo mọi âm thanh liên tục phát ra trong các thiết bị.

### Không ký 10 bằng tay

`2^35 / 10 = 3435973836.8`- Màn trần là`3435973837 = 0xCCCCCCCD`Thầm là`0xCCCCCCCD * 10 - 2^35 = 2`, và kết nối ở `s = 35`là `2^3 = 8`- Tại `s = 34`lỗi sẽ là 6 đối với một giới hạn của 4, vì vậy 35 là sự thay đổi nhỏ nhất.`n = 123``123 * 3435973837 = 422624781951`, và`422624781951 >> 35 = 12`- Tôi không biết.

Clang phát ra chính xác điều này cho `div10u``-O2`trên x86-64:

```text
       0: 89 f9                        	movl	%edi, %ecx
       2: b8 cd cc cc cc               	movl	$0xcccccccd, %eax
       7: 48 0f af c1                  	imulq	%rcx, %rax
       b: 48 c1 e8 23                  	shrq	$0x23, %rax
```

`0x23`là 35.`movl %edi, %ecx`0 mở rộng lập luận 32 bit vào một sổ đăng ký 64 bit, đó là hình thức không ký.`movl $imm`Nó nuôi dưỡng 2 operand.`imulq`, đọc phiên, và gọi `divisor_from_magic(0xCCCCCCCD, 35)`- Vị năng này cố gắng`2^35 // m = 10`và 11, và chấp nhận 10 bởi vì `magic_numbers(10)`cho cùng một nhân và chuyển ngược.

Trên AArch64 cùng một hàm là `mov w8, #0xcccd; movk w8, #0xcccc, lsl #16; umull x8, w0, w8; lsr x0, x8, #35`. liên tục đến trong hai nửa 16 bit, nhân là `umull`, và sự thay đổi được viết bằng chữ thập.

### Không ký 7 bằng tay, với thêm sửa chữa

`2^35 / 7 = 4908534052.57`- Màn trần là`4908534053 = 0x124924925`, cần 33 bit. sai lầm là 3 đối với một giới hạn của 8, do đó chuyển đổi là 35, và không có chuyển đổi nhỏ hơn hoạt động.`0x24924925`và thêm cổ tức trở lại theo một chuỗi cố định:

```text
      32: 48 69 c0 25 49 92 24         	imulq	$0x24924925, %rax, %rax
      39: 48 c1 e8 20                  	shrq	$0x20, %rax
      3d: 29 c7                        	subl	%eax, %edi
      3f: d1 ef                        	shrl	%edi
      41: 01 f8                        	addl	%edi, %eax
      43: c1 e8 02                     	shrl	$0x2, %eax
```

Đọc như thế này.`t = (n * 0x24924925) >> 32`, sau đó `q = (((n - t) >> 1) + t) >> 2`. Tổng chuyển động là `32 + 1 + 2 = 35`- Với `n = 100``t = 14`- `(100 - 14) >> 1 = 43`- `43 + 14 = 57`- `57 >> 2 = 14`. Máy nhận dạng phát hiện ra `sub`- `shr`- `add`- `shr`đuôi sau một thay đổi 32 bit, thêm `2^32`trở lại nhân, và lấy lại 7. `evaluate_division()`chạy theo trình tự chính xác này và thử nghiệm kiểm tra nó với `n // 7`trên các giá trị cạnh 32 bit.`sub w9, w0, w8; add w8, w8, w9, lsr #1; lsr w0, w8, #2`, một hướng dẫn ngắn hơn vì sự cộng chuyển là một hướng dẫn.

### Được ký 3 bằng tay

`2^32 / 3 = 1431655765.33`, trần `1431655766 = 0x55555556`, lỗi 2, và kết nối được ký kết ở `s = 32`là `2^1 = 2`- Đường kết không còn chỗ để dành, nên thay đổi là 32 và clang sử dụng `shrq $0x20`- Với `n = -7`: sản phẩm là `-10021590362`, chuyển đổi toán học bằng 32 cho `-3`, bit dấu được đặt, do đó, việc sửa chữa thêm 1 và kết quả là `-2`, đó là `-7 / 3`trong C. Các thiết bị được ký `div10s`và `div3s`Cả hai đều mang theo sự sửa chữa như `shrq $0x3f`trên một bản sao của sản phẩm sau đó là `addl`- Tôi không biết.

### Những gì các định vị không phải là

Chỉ số nhân không đặt tên cho bất kỳ divisor nào.`0x66666667`với shift 34 là 10. cùng một nhân với shift 33 là 5, như bài học 34 đã chỉ ra.`clangMatchesAlgorithm`Các trường ghi lại rằng cặp là một trong những tìm kiếm sản xuất.`magic_numbers()`từ chối chúng, bởi vì trình biên dịch phát ra một sự thay đổi với một sự thiên vị biểu tượng thay vào đó, và `mod8s`phần tiếp theo cho thấy hình dạng đó.

### Ngôn ngữ thuộc về bộ chọn hướng dẫn

Tại `-O0`- `div10u`là `movl $0xa, %ecx; xorl %edx, %edx; divl %ecx`- `div10s`là `cltd; idivl %ecx`Trong cùng một vật thể,`digest`chia tổng vòng của nó bằng 10 với `imulq $0x66666667`Một lá cờ giải thích sự khác biệt.`idioms-x86_64-nofastisel-O0.o`được xây dựng với `-O0 -mllvm -fast-isel=false`, và trong đó mỗi phân chia là nhân, bao gồm `div10u`với `movl $0xcccccccd, %ecx; imulq %rcx, %rax; shrq $0x23`. Phân chia phần cứng là sự lựa chọn của bộ chọn hướng dẫn nhanh tại `-O0`. Tần số là giảm của SelectionDAG, đó là những gì LLVM `UnsignedDivisionByConstantInfo`và `SignedDivisionByConstantInfo`sản xuất.`digest`khối giữ phân vùng cũng giữ một `switch`, và khối đó đã đi đến SelectionDAG.`hardware idivl`và `magic multiply`, và hình ảnh cho thấy hỗn hợp `-O0`chức năng.

## Modulo theo chỉ số

`x % d`là `x - (x / d) * d`. Bộ biên dịch tính toán số nhân bằng ngôn ngữ ở trên, nhân nó trở lại, và trừ.`addl %ecx, %ecx; leal (%rcx,%rcx,4), %ecx`, đó là `2 * q * 5`Trên AArch64 đó là một hướng dẫn.`msub w0, w8, w9, w0`, tính toán`w0 - w8 * w9`với `w9 = 10`. Các công nhận theo dõi các hệ thống đăng ký số lượng thông qua các bản sao, theo dõi các yếu tố tích lũy thông qua `add`- `lea`- `shl`, và`imul`, và chấp nhận một`sub`khi nhân bằng với bộ chia.

Khi cùng một số lượng cũng nuôi dưỡng một biểu thức khác, cả hai ngôn ngữ vẫn còn trong báo cáo.`-O1`trình biên dịch tính toán `sum / 10`một lần `digest`và sử dụng nó cho `switch`trên x86-64 nó thậm chí kết hợp số lượng hai lần,`leal (%rax,%rsi), %edi`cho mô-đun và `addl %esi, %eax`cho chuyển đổi. bộ nhận dạng báo cáo một phân chia và một module và đánh dấu số lượng như chia sẻ.`switch`chỉ số không thể đọc được.

Modulo được ký bởi một lực của hai có hình dạng riêng của nó, bởi vì tỷ lệ không bao giờ được tính toán:

```text
      92: 8d 48 07                     	leal	0x7(%rax), %ecx
      95: 85 ff                        	testl	%edi, %edi
      97: 0f 49 cf                     	cmovnsl	%edi, %ecx
      9a: 83 e1 f8                     	andl	$-0x8, %ecx
      9d: 29 c8                        	subl	%ecx, %eax
```

Đối với một âm tính `x`mã bị thiên hướng bởi 7 trước khi che giấu, do đó việc cắt giảm vòng về phía không như C yêu cầu. giá trị che giấu là `x`tròn lên một nhân số 8, và trừ bỏ `x % 8`AArch64 làm nó với `negs w8, w0; and w9, w0, #0x7; and w8, w8, #0x7; csneg w0, w9, w8, mi`: cả hai mặt nạ `x`và `-x`Ghidra đặt ra quy tắc của nó cho điều này.`RuleSignMod2nOpt`, với đoạn ngắn "Convert INT_SREM forms: `(V + (sign >> (64-n)) & (2^n-1)) - (sign >> (64-n)) => V s% 2^n`"Điều này là không thể.

Tại `-O0`AArch64 viết modulo như `sdiv w9, w8, w10; mul w9, w9, w10; subs w0, w8, w9`Người nhận dạng cũng chấp nhận biểu mẫu đó và báo cáo`hardware sdiv + mul + subs`- Tôi không biết.

## Năm cách để hạ nút

LLVM quyết định hình dạng của một `switch`Ở hai nơi.`SimplifyCFG::simplifySwitchLookup`chạy ở `-O1`và trên và biến một chuyển đổi mà tất cả các trường hợp tạo ra các định vị thành một bảng giá trị, khi có ít nhất ba trường hợp và mục tiêu có thể xây dựng các bảng tìm kiếm.`SingleValueKind`- `LinearMapKind`- `BitMapKind`, và`ArrayKind`- `-O0`Tuyến đường không bao giờ chạy qua đường này.`SwitchLowering::findJumpTables`trong việc chọn hướng dẫn, tạo ra một bảng nhảy khi cluster có ít nhất `min-jump-table-entries`các mục, 4 theo mặc định, và đủ dày đặc: `NumCases * 100 >= Range * MinDensity`với `jump-table-density`10 cho các chức năng bình thường và 40 dưới `-Os`. Những gì còn lại trở thành một tìm kiếm nhị phân trên các trường hợp liên tục, với `splitWorkItem`chọn vòng xoắn. Các thiết bị có một chức năng cho mỗi kết quả.

| Function | Source | `-O0` x86-64 | `-O2` x86-64 | `-O2` AArch64 |
|---|---|---|---|---|
| `linear_switch` | cases 0 to 6 return 10 to 70 | jump table, 7 entries | linear map `10*k + 10`, default -1 | `madd` and `csinv` |
| `table_switch` | cases 0 to 6 return 10 to 60 then 71 | jump table, 7 entries | lookup table at `.rodata+0x28` | lookup table at `.rodata+0x0` |
| `call_switch` | cases 0 to 4 call one of five pointers | jump table, 5 entries | jump table, 5 entries | comparison tree, pivot 1 |
| `sparse_switch` | cases 1, 100, 10000, 1000000, 100000000 | compare chain | comparison tree, pivot 9999 | comparison tree, pivot 9999 |
| `two_cases` | cases 3 and 4 return 7 and 9 | compare chain | select chain `k != 3 ? (k == 4)*9 : 7` | two `csel` |

### Bảng tìm kiếm, đọc từ đối tượng

`table_switch``-O2`- Có thể là:

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

Kiểm tra giới hạn`cmpl $6; ja`nghĩa là 7 mục hợp lệ.`0x24`cộng 4 byte của trường tương quan RIP đặt bảng tại `.rodata+0x28`, bài học quy tắc 33 được dẫn.`0a 00 00 00 14 00 00 00 ...`, nên các mục là `[10, 20, 30, 40, 50, 60, 71]`, và chúng bằng với giá trị trường hợp nguồn.`.Lswitch.table.table_switch`trong `.s`tập tin, với một bình luận `@switch.table.table_switch`Trong đối tượng chỉ còn lại chuyển và các byte. Không có nhảy, vì vậy biểu đồ kiểm soát-thời gian có ba khối.

Mô hình AArch64 đặt địa chỉ bảng cùng với `adrp x8`và `add x8, x8, #0x0`, mỗi người mang lại chuyển đổi của riêng mình đến `.rodata`, và tải với `ldr w0, [x8, w0, uxtw #2]`. Đánh dấu đọc thêm từ `add`chuyển nhà.

### Bản đồ tuyến tính, không có bảng

`linear_switch`trả lại `10 * (k + 1)`cho `k`trong 0 đến 6.`simplifySwitchLookup`phát hiện mối quan hệ tương tự và phát ra toán học:

```text
      b0: 83 ff 07                     	cmpl	$0x7, %edi
      b3: 8d 04 bf                     	leal	(%rdi,%rdi,4), %eax
      b6: 8d 4c 00 0a                  	leal	0xa(%rax,%rax), %ecx
      ba: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      bf: 0f 42 c1                     	cmovbl	%ecx, %eax
```

Người đánh giá đọc `leal (%rdi,%rdi,4)`như `5*k`- `leal 0xa(%rax,%rax)`như `10*k + 10`, và `cmovb`sau đó`cmpl $7`như `k < 7 ? 10*k + 10 : -1`. Các công nhận sau đó kiểm tra công thức đối với mỗi trường hợp nguồn và đánh dấu ngôn ngữ được xác minh. AArch64 đạt đến cùng một biểu thức với `madd w8, w0, w8, w9`và `csinv w0, w8, wzr, lo`, nơi `csinv`với `wzr`lợi nhuận`-1`trên đường đi mặc định.

### Bảng nhảy, đọc từ việc di chuyển

`call_switch``-O2`là bài học hình dạng 33 được phục hồi trong `grade``-O0``cmpl $4; ja`, một `leaq`đến`.rodata-0x4`, một `movslq`của một mục 4 byte, `addq`, và`jmpq *%rax`5 mục này là chuyển nhượng tại `.rela.rodata`, và`target = addend - 4k`cho `0x10c, 0x107, 0x10e, 0x110, 0x109`, năm khối khác nhau mà mỗi đuôi nhảy qua một chỉ số chức năng.`dispatch`Fixure quy mô này lên đến 16 trường hợp: 16 mục di chuyển trên x86-64, và trên AArch64 một bảng nén 16 byte đơn đọc với `ldrb w11, [x9, x8]`, tăng lên 4 với `add x10, x10, x11, lsl #2`, và dựa trên một`adr`của khối trường hợp đầu tiên.`[0x24, 0x74, 0x54, ...]`từ bảng byte và báo cáo `compressed: true`- Tôi không biết.

### Cùng một chuyển đổi ở bốn cấp độ

`digest`giữ một cái bật `sum / 10`với các trường hợp 6 đến 10 và các giá trị 1, 2, 4, 8, 8, sau đó nhân kết quả bằng 16. trên x86-64 nó là một bảng nhảy ở `-O0`, một bàn tìm kiếm tại `-O1`với các mục `[16, 32, 64, 128, 128]`, và một bàn nhảy lại ở `-O2`và `-O3`Có bốn khối kho chứa `0x10`- `0x20`- `0x40`- `0x80`Từ `-O1`tăng lên nhân bằng 16 đã di chuyển vào các trường hợp.`-O0`các trường hợp lưu trữ 1, 2, 4 và 8, và nhân số vẫn còn sau khi chuyển đổi.`-O1`bảng tìm kiếm trình nhận dạng so sánh các mục với các giá trị nguồn, tìm thấy tỷ lệ liên tục, và báo cáo `foldedFactor: 16`Trên AArch64`-O2`hình là một cây so sánh với một vòng xoắn ở 8, thử nghiệm bình đẳng cho 6, 7, và 8, và thử nghiệm phạm vi `sub w9, w9, #9; cmp w9, #2; b.hs`Điều này bao gồm các trường hợp 9 và 10 trong hai hướng dẫn.`rangeTests: [[9, 10]]`- Tôi không biết.

Hai lá cờ di chuyển những ranh giới này.`-fno-jump-tables`quay `table_switch`- `call_switch`, và `digest`chuyển sang cây so sánh trên x86-64, với các pivot 2 và 4 cho hàm bảy trường hợp.`-mllvm -min-jump-table-entries=4`lá`call_switch`như một cây so sánh, do đó trên mục tiêu đó số lượng nhập không phải là đầu vào quyết định cho một chuyển đổi năm trường hợp của cuộc gọi gián tiếp.`idioms-arm64-jt4-O2.o`những bản ghi đang chạy.

GCC đưa cả hai quyết định vào `tree-switch-conversion.cc`, với các lớp học `jump_table_cluster`- `bit_test_cluster`- `switch_decision_tree`, và`switch_conversion`- Nó là `-ftree-switch-conversion`là vào lúc `-O2`- `-fjump-tables`và `-fbit-tests``-O1`, và ngưỡng bàn nhảy đến từ `case-values-threshold`Không có GCC được cài đặt trên máy này, vì vậy những tên đó đến từ nguồn GCC và hướng dẫn, và Compiler Explorer là nơi bạn kiểm tra chúng.

## Các vòng: Dòng, không xoay hoặc thay thế

Vektorizer vòng của LLVM đang bật ở `-O2`- `-O3`, và`-Os`, và đi vào `-O0`và `-O1`, một quy tắc có niên đại từ LLVM 3.4 vào tháng 1 năm 2014. `sum_n``-O2`cho thấy mọi phần của hình dạng:

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

Người bảo vệ`cmpl $7; ja`gửi số lần đi dưới 8 đến vòng tròn scalar.`andl $0x7ffffff8`vòng chuyến đi đếm xuống nhiều hơn 8. Cơ thể tải 32 byte mỗi lần lặp thành hai `xmm`Bộ sưu tập, bốn đường 32 bit mỗi, do đó, nhân vectorization là 4 và nhân interleave là 2. Sau vòng lặp, `paddd`, hai `pshufd`, hai nữa `paddd`, và`movd`Giảm 8 đường ray thành 1 số nguyên.`0x270`là phần còn lại scalar cho các yếu tố 0 đến 7 cuối cùng.`paddd`, đếm các bộ tích lũy khác nhau, chia các bước `0x20`4 và báo cáo `4 lanes x 2 accumulators = 8 elements per iteration`, với mặt nạ, bảo vệ, giảm, và vòng lặp còn lại như các trường.`ldp q2, q3`, hai `add v.4s`- `addv s0, v0.4s`, và`fmov w8, s0`- Tôi không biết.

Một số lần đi cố định sẽ loại bỏ vòng lặp. `sum4`là một `movdqu`, giảm, và`movd`, không có cạnh sau. `poly8`không thể vector hóa, bởi vì mỗi lặp phụ thuộc vào bộ tích lũy trước đó, vì vậy trình biên dịch mở ra nó tám lần: tám tải ở các bù trừ 0 đến `0x1c`từ `%rdi`, mỗi lần được theo sau bởi một thay đổi bởi 5 và một trừ tính`acc * 31`. Tác giả đếm tải trọng tại các sự bù đắp liên tiếp từ một cơ sở và báo cáo `loop unrolled by 8, no back edge`Trên AArch64 , cùng một tải trọng đến với bốn .`ldp`đôi.

Đập tắt vectorizer với `-fno-vectorize -fno-slp-vectorize`và `sum_n`trở thành một vòng tròn scalar được mở ra bởi 8, với tám `addl k(%rdi,%rdx,4), %eax`và `addq $8`, cộng với một vòng lặp còn lại. `sum4`trở thành 4 cộng thêm.`unrolled loop`với `copies: 8`và `indexStep: 8`cho lần đầu tiên và `copies: 4`lần thứ hai.

Bài học 33 tìm thấy hai cạnh sau trong `total``-O2`và gọi chúng là hai vòng lặp. Bài học này đặt tên cho chúng: một cơ thể vector và một phần còn lại scalar của cùng một vòng lặp nguồn.`is_loop()`kiểm tra điều đó, bởi vì `digest`trên AArch64 chứa các nhánh ngược đến một khối mặc định được chia sẻ không phải là vòng lặp, và phiên bản đầu tiên của trình nhận dạng đã đếm chúng như vòng lặp vector.

### Các vòng lặp trở thành các cuộc gọi thư viện

`LoopIdiomRecognize`biến một vòng lặp lưu trữ 0 trong mỗi byte thành một cuộc gọi đến `memset`, từ `-O1`lên.`fill``-O2`là `testl %esi, %esi; jle; movl %esi, %edx; xorl %esi, %esi; jmp memset@PLT`- Cuộc gọi là một bước nhảy vọt với việc di chuyển.`R_X86_64_PLT32 memset-0x4`, và chức năng của `retq`Chỉ là trên đường trống.`store loop recognized as memset(...)`và xác minh nó với vòng lặp nguồn, bởi vì nguồn không bao giờ đặt tên `memset`- Tôi không biết.

`copy16`gọi`memcpy`với một liên tục 16, và x86 backend mở rộng nó trong đường thẳng như `movups (%rsi), %xmm0; movups %xmm0, (%rdi)`, trong giới hạn của nó là 8 cửa hàng mỗi `memcpy`- Tại `-O0`cùng một cuộc gọi là hai 8-byte `movq`đôi.`-fno-builtin`- Thức gọi vẫn là điện thoại.`jmp memcpy@PLT`với `movl $0x10, %edx`, và`fill`giữ vòng lặp của nó, mà vectorizer sau đó biến thành vòng lặp của hai 16-byte `movups`lưu trữ mỗi lần lặp.`vectorized store loop: 2 x 16-byte stores = 32 bytes per iteration`cho việc xây dựng đó.

## Những cuộc gọi biến mất hoặc trở thành nhảy

`tail_caller`trả lại `tail_target(x + 1)`- Tại `-O0`Nó là `addl $0x1, %edi; callq tail_target@PLT; addq $0x10, %rsp; popq %rbp; retq`- Tại `-O2`Nó là `incl %edi; jmp tail_target@PLT`Và không có gì khác. khung của người gọi đã biến mất và người gọi trở lại với người gọi.`b tail_target`với `R_AARCH64_JUMP26`. Bộ nhận dạng xử lý một`jmp`hoặc `b`Bài học 33 của sự giảm trở lại phải coi nó như một lối thoát hàm, bởi vì mục tiêu nằm ngoài hàm.

`twice_sum`gọi`leaf_add`- Tại `-O0`- Cái gọi ở đó.`callq leaf_add@PLT`Từ `-O1`cơ thể của `leaf_add`- `leal (%rdi,%rsi), %eax`, xuất hiện bên trong `twice_sum`Và không còn cuộc gọi nào.`-O0`Clang đánh dấu mọi hàm `optnone`và `noinline`Và chỉ chạy máy luôn luôn trong đường.`twice_sum`gọi`leaf_add`, không tìm thấy bất kỳ cuộc gọi hoặc nhảy đuôi đến nó, và sau đó tìm kiếm hình dạng cơ thể của người gọi trong người gọi: mnemonic và nguồn operands với đích bị loại bỏ, vì vậy `add w8, w1, w0`trong các cuộc gọi AArch64 phù hợp `add w0, w1, w0`Một sự phù hợp là bằng chứng.

`dispatch`kết hợp cả hai: một bàn nhảy 16 nhập mà mỗi trường hợp là `movl %esi, %edi; jmp fN@PLT`. Các công nhận báo cáo một chuyển đổi và 16 cuộc gọi đuôi, tất cả được xác minh so với 16 cuộc gọi trong nguồn.

## Các chi nhánh trở thành dữ liệu di chuyển

`clamp_max`là `movl %esi, %eax; cmpl %esi, %edi; cmovgl %edi, %eax`Tên của các nhà đánh giá`%edi`như `a`và `%esi`như `b`, ghi lại so sánh, và đọc `cmovg`như `a > b ? a : b`, là văn bản nguồn. `abs_int`là `movl %edi, %eax; negl %eax; cmovsl %edi, %eax`và đọc như `-x < 0 ? x : -x`AArch64 viết nó như `cmp w0, #0; cneg w0, w0, mi`và đọc như `x < 0 ? -x : x`- `is_pos`là `xorl %eax, %eax; testl %edi, %edi; setg %al`, có thể đọc như `(x > 0)`Đây là`-fif-conversion`theo lời của GCC và `cmov`lựa chọn trong LLVM. LLVM `X86CmovConversion`Pass có thể quay một `cmov`trở lại các chi nhánh khi nó đánh giá là có lợi nhuận, đó là lý do tại sao cùng một nguồn có thể hiển thị một hoặc hai hình dạng trong vòng lặp.

Tại `-O0`Không có một cái gì cả.`clamp_max`là một so sánh, một `jle`, hai cửa hàng cùng một khe, và một tải.`-O0`và `branchless select`từ `-O1`, là một trong những thực tế mà con số làm cho thấy.

`mul9`là một `leal (%rdi,%rdi,8), %eax`, và báo cáo của công nhận `strength reduction`với `x * 9`, bởi vì nguồn nhân bằng 9. Nó chỉ làm như vậy khi nguồn có nhân tố; a `lea`là một chỉ số bảng không phải là một nhân.

## Hai tính năng cứng rắn trông giống như những lời nói ngớ ngẩn

Bộ bảo vệ stack là một tính năng biên dịch, và nó để lại một hình dạng mà một đại lý sẽ đọc như logic chương trình. `canary.c`được biên soạn với `-fstack-protector-strong`cho x86-64 Linux cung cấp:

```text
       7: 64 48 8b 04 25 28 00 00 00   	movq	%fs:0x28, %rax
      10: 48 89 44 24 40               	movq	%rax, 0x40(%rsp)
      26: 64 48 8b 0c 25 28 00 00 00   	movq	%fs:0x28, %rcx
      2f: 48 3b 4c 24 40               	cmpq	0x40(%rsp), %rcx
      34: 75 05                        	jne	0x3b <with_canary+0x3b>
      3b: e8 00 00 00 00               	callq	0x40 <plain_leaf>
		000000000000003c:  R_X86_64_PLT32	__stack_chk_fail-0x4
```

`%fs:0x28`là `stack_guard`trong glibc's `tcbhead_t`, ở byte offset 40, và LLVM `getIRStackGuard`tên cho glibc, bionic, và Fuchsia. Prologue sao chép bảo vệ trên búffer, epilogue so sánh, và đường thất bại gọi `__stack_chk_fail`Trên AArch64 Linux , người bảo vệ đến từ toàn cầu .`__stack_chk_guard`qua GOT với `adrp`và `ldr`, và thất bại là`bl __stack_chk_fail`. Bộ nhận dạng báo cáo nguồn bảo vệ, khe cắm, so sánh, và cuộc gọi thất bại. `plain_leaf`, không có mảng, không có loài cá voi dưới `strong`, bảo vệ các chức năng với các mảng,`alloca`Các ghi chú nghiên cứu cũng ghi lại mẫu MSVC dưới `/GS`, một bánh quy trộn với `%rsp`và được kiểm tra bởi `__security_check_cookie`; không có liên kết MSVC trên máy này, vì vậy hình dạng đó được mô tả chỉ từ đầu ra của bộ sưu tập.

`-fcf-protection=full`Đặt `endbr64`, byte `f3 0f 1e fa`, như là hướng dẫn đầu tiên của mọi chức năng. Nó là một nền hạ cánh cho các chi nhánh gián tiếp trên bộ xử lý với kiểm soát dòng chảy thực thi, và nó thực hiện như một `nop`Các mô hình khởi động hàm x86-64 của Ghidra bao gồm:`endbr64`các biến thể trước của `push rbp; mov rbp, rsp`Vì lý do này.`cet landing pad`, vì vậy một hàm bắt đầu với bốn byte bất thường không được nhầm lẫn với dữ liệu.

## Những gì người làm phân hủy sẽ làm

Mỗi trình giải thích trong bài học 37 chạy một số phái sinh này như các quy tắc viết lại.`ruleaction.cc`- `RuleDivOpt`là "Convert INT_MULT and shift forms into INT_DIV or INT_SDIV", với các biểu mẫu `sub( (zext(V)*c), d) >> e => V / (2^n/(c-1)) where n = d*8 + e`và biến thể được ký với `sext`và `s>>`- `RuleModOpt`là "Thiển giản các biểu hiện tối ưu hóa INT_REM và INT_SREM". `RuleDivTermAdd`xử lý việc bổ sung, `RuleSignDiv2`quay `(V + -1*(V s>> 31)) s>> 1`vào`V s/ 2`, và`RulePositiveDiv`chuyển một phân chia giá trị được ký kết với các bit chữ cái rõ ràng thành một không ký kết. Bài học 37 bắt giữ Ghidra 12.1.4 trên bài học 33 `grade``-O1`, và kết quả phát ra là `uVar2 = param_1 / 10 - 6;`Phân đội đã bị lật lại.

Các đầu vào vào các quy tắc đó có thể nhìn thấy mà không cần Java. pypcode 4.0.1 của venv nâng với các thông số kỹ thuật SLEIGH tương tự như Ghidra sử dụng, và `code/fixtures/idioms-x86_64-O2.lifts.json`giữ mã P nguyên liệu cho `div10s`: 112 mục cho bảy hướng dẫn, trong đó 7 là các hướng dẫn`IMARK`Các dấu hiệu mở mỗi hướng dẫn, trong số đó `RAX = RAX * unique[95a00:8]`sau đó`unique[95a00:8] = sext(0x66666667)`- `RCX = RCX >> unique[d1a00:4]`, và`RAX = RAX s>> unique[c5c00:4]`- `shrq`thực hiện 41 hoạt động và`sarq`Có 40 chiếc, và hầu hết chúng tính các lá cờ.`RuleDivOpt`kết hợp với số nhân và hai thay đổi trong dòng này, và loại bỏ mã chết loại bỏ các lá cờ mà không có gì đọc.

Angr 10.0.3 đã chạy trên chúng ta `-O2`đối tượng, và`idioms-x86_64-O2.angr.json`giữ cho phát phát của decompiler của nó cho 20 chức năng. Nó gấp các hình thức không ký: `div10u`là `return a0 / 10;`Nó không gấp hình thức đã ký: `div10s`là `v1 = a0 * 1717986919; return ((long long)(v1) >> 0x22) + (v1 >> 63);`và `mod10s`là `a0 - (...) * 2 * 5`- Vì `div7u`nó in `(a0 / 7 + ((a0 * 6 / 7 & 0xffffffff) >> 1 & 0xffffffff) & 0xffffffff) >> 2`, nơi các thuật ngữ cố định tồn tại như là toán học.`mul9`đến`a0 * 9`- `linear_switch`đến`(a0 < 7 ? a0 * 10 + 10 : 0xffffffff)`- `clamp_max`đến`((int)a1 < (int)a0 ? a0 : a1)`- `is_pos`đến`a0 > 0`, và`fill`đến`return memset(a0, 0, a1);`Nó in.`table_switch`như một gánh nặng`*(int *)(4 * a0 + 4195400)`Không có giá trị, `sum_n`với `_mm_add_epi32`và `_mm_shuffle_epi32`nội tại, và`tail_caller`như `tail_target(); return;`với cuộc tranh luận bị mất.`digest`bàn nhảy trở thành `goto *((void *)(...))`với bảng toán học được viết ra.

radar2 6.2.4 và rizin 0.9.1, được xây dựng từ nguồn vào bộ nhớ cache nghiên cứu, được chạy trên cùng một đối tượng.`pdc`dấu vân tay`div10s`như `rax = rax * 0x66666667; rcx >>>= 0x3f; rax >>= 0x22; eax += ecx`, mức đăng ký giả C không có gấp, và `table_switch`như `eax = dword [rcx + rax*4]`với một `RELOC 32 .rodata`bình luận về `lea`. rizin không có bộ phân tích tích tích hợp; nó `aoi`in RzIL của `imul`như một sản phẩm 128-bit. lldb-1703.0.236.21 tải các đối tượng ELF và các `disassemble -n div10s`in cùng bảy hướng dẫn như `llvm-objdump`, bởi vì cả hai đều sử dụng bộ giải thể của LLVM. Capstone 5.0.7 giải mã các byte tương tự và báo cáo các nhóm như `ret`và `mode64`IDA Pro và Binary Ninja không được chạy ở đây. Tài liệu của họ mô tả các giai đoạn nơi việc viết lại như vậy xảy ra, tối ưu hóa mã vi mô và các MLIL để HLIL vượt qua, và bài học này không tuyên bố về những ngôn ngữ mà họ gấp.

Compiller Explorer là công cụ cho hướng về phía trước.`idioms.c`, chọn một mục biên dịch như "x86-64 clang 18.1.0" hoặc "ARM64 GCC 14.2.0", và đặt các cờ. Dịch vụ liệt kê khoảng 1.050 mục biên dịch C và có một API: `GET /api/compilers/c`trả lại các thông tin nhận dạng và `POST /api/compiler/<id>/compile`trả lại bộ sưu tập như là JSON. Bài viết ACM Queue 2019 của Matt Godbolt đi qua phân vùng, số lượng dân số, chuỗi điều kiện và thuật ngữ tổng hợp với công cụ này. Sử dụng nó cho sản lượng GCC, mà máy này không thể sản xuất, và so sánh ngưỡng bảng nhảy của GCC và `-O2`Dường như các lỗi vectorization từ GCC 12 với đầu ra clang trong các thiết bị.

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
```

Các kết quả là một báo cáo JSON. Đối với mỗi 18 build nó liệt kê mọi hàm và ngôn ngữ của nó, với loại, hình thức nguồn, địa chỉ bằng chứng, xác minh và các trường chi tiết.`-O2`Vâng`-O3`so sánh cho cả hai kiến trúc, và các `unverified`danh sách.

Hình dạng dự kiến:

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

Đọc `code/main.py`theo thứ tự này:

1. `parse_listing()`quay lại `llvm-objdump -d -r`văn bản vào các chức năng, hướng dẫn và chuyển nhượng kèm theo cho cả hai kiến trúc.
2. `ElfFile`đọc các phần, biểu tượng, và `.rela.*`Các mục, và `words()`đọc các mục trong bảng.
3. `magic_numbers()`- `divisor_from_magic()`, và`evaluate_division()`là dẫn xuất Granlund-Montgomery về phía trước, ngược lại, và như chuỗi hướng dẫn.
4. `parse_source()`trích xuất các cấu trúc cần thiết để xác minh từ tập tin C.
5. `Evaluator`là thẻ biểu tượng khối-by-block mà tên đăng ký và xếp hàng khe.
6. `find_divisions()`và `find_modulos()`phù hợp với các dạng nhân, chuyển, sửa, nhân trở lại, và quyền lực hai.
7. `find_switches()`phân loại bảng nhảy, bảng tìm kiếm, bản đồ tuyến tính, chọn chuỗi, so sánh cây và so sánh chuỗi.
8. `find_vector_loops()`- `find_unrolled_loops()`- `find_tail_calls()`- `find_inlined_calls()`- `find_selects()`- `find_memory_builtins()`- `find_stack_protector()`- `find_cet()`, và`find_strength_reduction()`Bảo vệ phần còn lại.
9. `analyze_function()`chạy chúng theo thứ tự, cho mỗi ngôn ngữ tên kết quả vào bài đánh giá tiếp theo.

Có ba lệnh nữa.`python3 code/main.py scan FILE.objdump.txt [FUNCTION]`chạy bộ nhận dạng trên một danh sách, với đối tượng và tập tin C phù hợp được tìm thấy bên cạnh nó. `python3 code/main.py magic DIVISOR [signed]`in nhân, chuyển, lỗi, và liệu danh tính có giữ được các giá trị cạnh hay không. `python3 code/main.py figure-data`in dữ liệu mà hình ảnh nhúng.

## Sử dụng nó

Sử dụng bộ nhận dạng theo thứ tự này trên một vật thể mới bạn đã xây dựng.

1. Tắt `llvm-objdump -d -r`từ đối tượng và giữ lệnh biên dịch chính xác bên cạnh nó.
2. Đi chạy`scan`trên danh sách và đọc `unverified`mỗi đầu tiên là một cấu trúc mà người phân tích nguồn không thấy hoặc một hình dạng mà người nhận dạng đọc sai, và cả hai đều xứng đáng để xem các địa chỉ bằng chứng.
3. Đối với mỗi bộ phận, đọc `algorithm`trường.`clangMatchesAlgorithm`khi nó là sai, người biên dịch có một lý do bạn chưa biết; viết ra các định vị.
4. Đối với mỗi chuyển đổi, so sánh `lowering`Một bảng trở thành cây, hoặc một cây trở thành bảng, đánh dấu một ngưỡng bạn có thể đặt tên từ nguồn LLVM.
5. Đối với mỗi vòng lặp, đọc `elementsPerIteration`và `scalarRemainderLoop`, sau đó xác nhận hai cạnh sau bài học 33 báo cáo là một vòng lặp nguồn.
6. Hãy chạy một máy giải biên dịch trên cùng một đối tượng, trích dẫn văn bản của nó bên cạnh mỗi ngôn ngữ, và ghi lại những gì nó gấp.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: lấy một con số ma thuật, sau đó tìm nó

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/code
python3 -q
```

Đi chạy:

```python
from main import *
magic_numbers(10), magic_numbers(10, signed=True)
magic_numbers(7), magic_numbers(7, signed=True)
divisor_from_magic(0x66666667, 34, signed=True), divisor_from_magic(0x66666667, 33, signed=True)
```

Lưu ý`ceil(2^35 / 10)`trên giấy trước khi gọi đầu tiên.`unsigned div13(unsigned x) { return x / 13; }`cho một bản sao của `idioms.c`, xây dựng nó ở `-O2`với chỉ huy trong `build_fixtures.sh`, và kiểm tra các liên tục trong danh sách với `magic_numbers(13)`- Tôi không biết.

### Phòng thí nghiệm B: bàn và cây

```python
listing = load_listing("idioms-x86_64-O2.objdump.txt")
elf = load_elf("idioms-x86_64-O2.o")
sources = load_source("idioms.c")
[i.to_dict() for i in analyze_function(listing, "table_switch", elf, sources)]
[i.to_dict() for i in analyze_function(listing, "sparse_switch", elf, sources)]
elf.words(".rodata", 0x28, 7)
```

Thay đổi`71`quay lại `70`trong bản sao của `table_switch`, xây dựng lại ở `-O2`, và xem bảng tìm kiếm trở thành một bản đồ tuyến tính. sau đó thay đổi một giá trị trường hợp cho 1000 và xem nó vẫn còn một`ArrayKind`bàn.

### Phòng thí nghiệm C: vòng lặp ở ba thiết lập

```python
for name in ("idioms-x86_64-O1", "idioms-x86_64-O2", "idioms-x86_64-novec-O2"):
    print(name, [i.source for i in analyze_function(load_listing(name + ".objdump.txt"), "sum_n", load_elf(name + ".o"), sources)])
```

Hình vẽ biểu đồ lưu lượng điều khiển của `sum_n``-O2`bằng tay, đánh dấu người bảo vệ, mặt nạ, cơ thể vector, giảm và vòng lặp còn lại, và so sánh với `detail`các cánh đồng.

### Phòng thí nghiệm D: tỷ lệ chia sẻ

```python
for name in ("idioms-x86_64-O1", "idioms-arm64-O1"):
    print([(i.kind, i.source, i.detail.get("sharedQuotient")) for i in analyze_function(load_listing(name + ".objdump.txt"), "digest", load_elf(name + ".o"), sources)])
```

Đọc `-O1`danh sách các `digest`và tìm hai hướng dẫn kết hợp số lượng với dấu hiệu của nó cố định trên x86-64. sau đó giải thích tại sao AArch64 xây dựng chỉ cần một.

## Phòng thí nghiệm thực hành

Thêm các trò chơi nhỏ vào các thiết bị và mở rộng bộ nhận dạng.

Yêu cầu:

- Hãy viết`popcount`- `ctz`, và`rotl`các chức năng với các xây dựng GCC và một chuyển- hoặc xoay, xây dựng chúng tại `-O2`với và không có `-mpopcnt -mbmi`, và kết hợp các đối tượng với danh sách của họ.
- Nhận ra `0x55555555`- `0x33333333`- `0x0f0f0f0f`- `0x01010101`Dòng số dân số mà `TargetLowering::expandCTPOP`phát ra, và báo cáo như `popcount`Với bốn liên tục như là bằng chứng.
- Nhận ra`rep bsfl`như `tzcnt`- Hay...`bsf`mã hóa và `roll %cl`như quay, và giải mã cả hai để xây dựng.
- Thêm các loại mới vào `parse_source()`xác minh, do đó `popcount`ngôn ngữ chỉ được xác minh khi nguồn gọi `__builtin_popcount`- Tôi không biết.
- Thêm một bài kiểm tra cho mỗi ngôn ngữ đọc các liên tục từ danh sách vật cố định.

Thành công là nghĩa của`python3 code/main.py`báo cáo ba loại mới với `verified: true`trong cả hai bộ, và bộ vẫn báo cáo một trống `unverified`danh sách.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-compiler-idioms-and-optimization.md`Sử dụng nó để biến một danh sách, một đối tượng và nguồn của nó thành một báo cáo ngôn ngữ được xác minh với so sánh decompiler. Nó yêu cầu địa chỉ bằng chứng cho mỗi tuyên bố, dẫn xuất số phép thuật cho mỗi phân vùng, loại giảm và nguồn nhập cho mỗi chuyển đổi, và một dòng decompiler được trích dẫn cho mỗi ngôn ngữ.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Việc kiểm tra phải chứng minh:

- trình phân tích danh sách đọc 25 hàm từ `-O2`đối tượng, giữ các byte, và gắn `R_X86_64_PC32 .rodata+0x24`đến `leaq`trong `table_switch`
- người đọc ELF trả lại `[10, 20, 30, 40, 50, 60, 71]`từ `.rodata+0x28`và 10 việc di dời ở `.rela.rodata`
- `magic_numbers`trả lại `0xcccccccd`với thay 35, `0x66666667`với 34, `0x124924925`với 35 và mẫu bổ sung, `0x55555556`với 32, và `0xaaaaaaab`với 33
- danh tính giữ trên các giá trị cạnh 32 bit cho mỗi bộ chia từ 2 đến 64 không phải là một lực của hai, ký và không ký
- `divisor_from_magic`lấy lại 10, 5, 7, và 3 từ cặp của họ và từ chối một cặp sai
- bộ tính toán chuỗi cố định cộng `n // 7`chính xác
- Bốn bộ phận x86-64 báo cáo nhân số phải, chuyển, phân chia và hình thức, và bốn bộ phận AArch64 giải mã `mov`và `movk`
- `-O0`sử dụng `divl`và `idivl`- `-O0 -fast-isel=false`sử dụng nhân, và `digest``-O0`Trộn hai thứ
- modulo được công nhận là tăng gấp,`msub`, lực 2 ,`sdiv`+`mul`+`subs`, và phần cứng `idivl`
- một số chia sẻ giữ cả phân chia và mô-đulo ở `-O1`
- 5 mức giảm được phân loại ở `-O2`trên cả hai kiến trúc, với công thức, các giá trị, mục tiêu, các pivots, và biểu thức chọn
- `-O0`Các chuyển đổi là các bảng nhảy trên x86-64 và so sánh chuỗi trên AArch64
- `digest`Switch là một bảng nhảy, sau đó là một bảng tìm kiếm với nhân gấp 16, sau đó là một bảng nhảy với bốn mục tiêu khác nhau trên x86-64, và một cây so sánh với thử nghiệm phạm vi 9 đến 10 trên AArch64
- `-fno-jump-tables`tạo ra cây so sánh, và 16 trường hợp `dispatch`đọc mục tiêu của nó từ các di chuyển trên x86-64 và từ một bảng byte nén trên AArch64
- vòng vector báo cáo 4 đường, 2 bộ tích lũy, 8 yếu tố mỗi lần lặp lại, mặt nạ, bảo vệ, giảm và vòng còn lại
- Các vòng tròn cố định được chuyển hướng hoàn toàn hoặc hoàn toàn không xoay, và`-fno-vectorize`mở vòng tròn vào 8
- `-O1`không có vectorization, `-O2`và `-O3`là giống nhau trên x86-64, và trên AArch64 chúng chỉ khác nhau trong `call_switch`, nơi `-O3`có 17 hướng dẫn và `-O2`có 18
- `-fno-builtin`biến vòng cửa hàng thành vòng cửa hàng vectorized và giữ `memcpy`một cuộc gọi
- tiếng gọi đuôi, `memset`thay thế, bản sao 16byte trong dòng, và `-O0`Tác phẩm có hai chuyển động được nhận ra
- Cái tên được đặt trong đường được tìm thấy từ `-O1`bởi hình dạng cơ thể
- chọn giải mã đến `a > b ? a : b`- `-x < 0 ? x : -x`- `(x > 0)`, và`sum % 10 < 5 ? sum % 10 : 5`
- báo cáo bảo vệ hàng đống `%fs:0x28`, khe cắm, và `__stack_chk_fail`, và`endbr64`được báo cáo về mọi chức năng của cấu trúc CET
- Bộ phân tích nguồn đọc các tham số chỉ số chức năng, các trường hợp chuyển đổi, các cuộc gọi và tên bộ tích
- Mỗi ngôn ngữ trong mỗi xây dựng được xác minh và các loại hình phù hợp
- Hình ảnh tương tác chứa cùng các dữ liệu mà phân tích tạo ra

## Các chế độ sản xuất thất bại

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

## Quy tắc hoạt động

Tích hợp hình dạng, chạy dẫn xuất ngược, và viết các liên tục chứng minh nó. Báo cáo mỗi ngôn ngữ với địa chỉ bằng chứng và hình thức nguồn được giải mã của nó, xác minh mỗi nguồn với nguồn bạn biên soạn, và trích dẫn những gì mỗi decompiler in cho cùng một byte.

## Đọc thêm

- [Granlund, Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994)](https://gmplib.org/~tege/divcnst-pldi94.pdf)
- [Warren, Hacker's Delight, 2nd edition, Chapter 10: Integer Division By Constants](https://www.informit.com/store/hackers-delight-9780321842688)
- [Lemire, Kaser, Kurz, "Faster Remainder by Direct Computation" (2019)](https://arxiv.org/abs/1902.01961)
- [libdivide, header-only division by runtime constants](https://github.com/ridiculousfish/libdivide)
- [LLVM `DivisionByConstantInfo.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Support/DivisionByConstantInfo.cpp)
- [LLVM `SwitchLoweringUtils.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/SwitchLoweringUtils.cpp)và [`TargetLoweringBase.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/TargetLoweringBase.cpp)
- [LLVM `SimplifyCFG.cpp`, `simplifySwitchLookup`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Utils/SimplifyCFG.cpp)
- [LLVM Auto-Vectorization documentation](https://llvm.org/docs/Vectorizers.html)và [LLVM 3.4 release notes](https://releases.llvm.org/3.4/docs/ReleaseNotes.html)
- [LLVM `LoopIdiomRecognize.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Scalar/LoopIdiomRecognize.cpp)
- [LLVM `X86CmovConversion.cpp`](https://github.com/llvm/llvm-project/blob/release/20.x/llvm/lib/Target/X86/X86CmovConversion.cpp)
- [LLVM `StackProtector.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/StackProtector.cpp)và [`X86ISelLoweringCall.cpp`, `getIRStackGuard`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/X86/X86ISelLoweringCall.cpp)
- [glibc `sysdeps/x86_64/nptl/tls.h`, `tcbhead_t`](https://sourceware.org/git/?p=glibc.git;a=blob;f=sysdeps/x86_64/nptl/tls.h)
- [GCC `tree-switch-conversion.cc`](https://github.com/gcc-mirror/gcc/blob/master/gcc/tree-switch-conversion.cc)- [GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html), và[GCC 12 release notes](https://gcc.gnu.org/gcc-12/changes.html)
- [Ghidra decompiler `ruleaction.cc`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/decompile/cpp/ruleaction.cc)
- [angr decompiler documentation](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 book: decompilers](https://book.rada.re/arch/decompile.html)
- [Compiler Explorer API](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/API.md)
- [Godbolt, "Optimizations in C++ Compilers: A practical journey", ACM Queue 17(5), 2019](https://queue.acm.org/detail.cfm?id=3372264)
- [Microsoft, `/GS` (Buffer Security Check)](https://learn.microsoft.com/en-us/cpp/build/reference/gs-buffer-security-check)
