# Tiêu gọi các quy ước và khung xếp hàng: Hệ thống V, Windows x64, và AArch64

> Một sự tách rời cho thấy các sổ đăng ký một hàm đọc. Chỉ có ABI nói những sổ đăng ký đó có nghĩa gì, và ABI được chọn bởi tiêu đề đối tượng, vì vậy bài học này đọc tiêu đề trước tiên và sau đó kiểm tra mọi sổ đăng ký với quy tắc đặt nó ở đó.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and AArch64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow)
**Time:** ~140 minutes

## Mục tiêu học tập

- Chọn quy ước gọi từ tiêu đề đối tượng: ELF x86-64 là System V psABI, COFF AMD64 là Microsoft x64, ELF AArch64 là AAPCS64, Mach-O arm64 là biến thể của Apple.
- Khóa mã phần mở đầu của một hàm byte theo byte cho mỗi ABI và đặt tất cả các sổ đăng ký được lưu, địa chỉ trả lại và chỉ số khung ở vị trí của nó so với chỉ số entry stack.
- Nhập các ký hiệu tham số của một hàm từ các ký hiệu nó đọc trước khi nó viết chúng, và các khe nhượng đối số hàng từ các tải trên chỉ số hàng đầu.
- Nói các chuỗi đăng ký độc lập của Hệ thống V từ các khe vị trí của Microsoft x64, và cả hai từ các máy tính NGRN và NSRN của AAPCS64.
- Kiểm tra mọi kết luận với chữ ký nguồn, quy tắc trong thông số kỹ thuật, và dữ liệu giải phóng của trình biên dịch trong `.pdata`- `.xdata`, và`.eh_frame`- Tôi không biết.
- So sánh cách Ghidra, IDA, Binary Ninja, radar2, rizin, và angr tên và phục hồi các dữ liệu tương tự, và ghi lại khi nào sản xuất của chúng không đồng ý với nguồn gốc.

## Vấn đề

Anh đã biên soạn`convention.c`cho Linux x86-64 tại `-O2`và hỏi radar2 6.2.4 cho các lập luận của `eight_args`Nó trả lời với bảy:`rdi`- `rsi`- `rdx`- `r8`- `r9`- `rsp+0x8`, và`rsp+0x10`Nguồn C có tám tham số.`%rcx`chính xác là một lần, trong `leaq (%rdx,%rcx), %rax`, và công cụ phục hồi biến không tính một sổ đăng ký chỉ xuất hiện bên trong một địa chỉ.

Sau đó bạn mở Windows build của cùng một tệp trong rizin 0.9.1. Nó báo cáo các quy ước như `amd64`và tìm thấy`r8`- `rcx`- `rdx`, và ba khe cột. đối tượng là COFF, vì vậy quy ước là Microsoft x64, lập luận đăng ký thứ tư là `r9`Hai công cụ này không có các sổ khác nhau trong cùng một nguồn.

Một danh sách là một chuỗi các hướng dẫn. Một hợp đồng gọi là một hợp đồng sống bên ngoài danh sách: những hồ sơ mang các lập luận, mà người gọi phải lưu giữ, nơi địa chỉ trả lại và các lập luận hàng đống ngồi, và những gì người gọi phải để lại trên chỉ số hàng đống. Bốn tài liệu xác định các hợp đồng quan trọng ở đây. Hệ thống V AMD64 psABI (Tài liệu phiên bản 1.0, xây dựng ngày 12 tháng 3 năm 2025) các phần 3.2.1 đến 3.2.3. Microsoft x64 gọi các thông tin liên lạc, sử dụng hàng, và các trang tiền đề và epilog (tháng ngày trang từ 2018-12-17 đến 2025-03-19). Các phần 6.1 đến 6.9 của Arm AAPCS64 phát hành 2025Q4 (23 tháng 1 năm 2026). Các ghi chú nền tảng arm64 của Apple. Bài học này đọc những quy tắc đó, áp dụng chúng cho một tập tin C được biên soạn ba cách, và xây dựng trình phân tích biến một danh sách thành một danh sách kiểm tra các vị trí tham số, các sổ đăng ký được lưu và khung bù.

```figure
re-38-three-frames
```

## Một người đứng đầu chọn sách quy tắc

`convention.c`có mười hai chức năng: `leaf_add`- `eight_args`- `mixed`- `by_value`- `big_ret`- `sum_varargs`- `keeps`, và 5 người gọi điện từ `extern`Các cấu trúc sử dụng `long long`, bởi vì`long`là 4 byte trên mục tiêu MSVC và 8 byte trên các phần còn lại, và một cấu trúc thay đổi quy định thay đổi kích thước. Apple clang 17.0.0 đã biên soạn nó bảy lần từ máy này:`-target x86_64-unknown-linux-gnu`- `x86_64-pc-windows-msvc`, và`aarch64-unknown-linux-gnu``-O0`và `-O2`, và`arm64-apple-macos``-O2`Không có tiêu đề Linux hoặc Windows được cài đặt, vì vậy tập tin tuyên bố những gì nó cần và chỉ bao gồm clang của riêng mình `stdarg.h`và `stddef.h`- Tôi không biết.

`describe_object()`trong `code/main.py`đọc số phép thuật 4 byte và một trường máy và đặt tên hợp đồng:

| Header | Field | Value | Rulebook |
|---|---|---|---|
| `7f 45 4c 46` ELF | `e_machine` at offset 0x12 | 62 | System V AMD64 psABI |
| `64 86` COFF | `Machine` at offset 0 | 0x8664 | Microsoft x64 |
| `7f 45 4c 46` ELF | `e_machine` | 183 | AAPCS64 |
| `cf fa ed fe` Mach-O 64 | `cputype` at offset 4 | 0x0100000c | AAPCS64 with Apple differences |

Ba hợp đồng không đồng ý trên hầu hết mọi hàng trong bảng sau đây.

| Rule | System V psABI | Microsoft x64 | AAPCS64 |
|---|---|---|---|
| Integer arguments | `%rdi %rsi %rdx %rcx %r8 %r9`, next free register | `RCX RDX R8 R9`, by position | `x0` to `x7`, by NGRN |
| Floating-point arguments | `%xmm0` to `%xmm7`, next free register | `XMM0` to `XMM3`, by position | `v0` to `v7`, by NSRN |
| Integer result | `%rax`, then `%rdx` | `RAX` | `x0`, then `x1` |
| Floating-point result | `%xmm0`, then `%xmm1` | `XMM0` | `v0` |
| Result too large for registers | address passed in `%rdi` "as if it were the first argument", returned in `%rax` | pointer in `RCX`, arguments shifted right, returned in `RAX` | address in `x8`, `x0` to `x7` untouched |
| Callee-saved | `%rbp %rbx %r12` to `%r15` | `RBX RBP RDI RSI RSP R12` to `R15`, `XMM6` to `XMM15` | `r19` to `r29`, `SP`, low 64 bits of `v8` to `v15` |
| First stack argument on entry | `8(%rsp)` | `40(%rsp)`, above a 32-byte shadow store | `0(sp)` |
| Below the stack pointer | 128-byte red zone | "considered volatile" | no red zone (Apple: 128 bytes) |
| Alignment at the call | `(%rsp + 8)` multiple of 16 on entry | 16-byte aligned outside prolog and epilog | `SP mod 16 = 0` |
| Variadic marker | `%al` holds an upper bound on vector registers used | floats duplicated in the integer register | none in registers; Apple uses 8-byte stack slots |

## Hệ thống V: Hai chuỗi đăng ký độc lập và một vùng đỏ

psABI 3.2.3 phân loại mỗi támbyte của mỗi lập luận là INTEGER, SSE, hoặc MEMORY và sau đó gán các sổ đăng ký từ hai danh sách không tương tác. "INTEGER" lấy "hộp đăng ký tiếp theo có sẵn của chuỗi %rdi, %rsi, %rdx, %rcx, %r8 và %r9". SSE lấy `%xmm0`đến`%xmm7`"Nếu không có các sổ đăng ký sẵn sàng cho bất kỳ 8byte của một lập luận, toàn bộ lập luận được chuyển trên ngăn xếp", và lập luận bộ nhớ "được đẩy trên ngăn xếp theo thứ tự đảo ngược (được chuyển từ bên phải sang bên trái).

`eight_args(a, b, c, d, e, f, g, h)``-O2`là 27 byte:

```text
      10: 48 01 fe                     	addq	%rdi, %rsi
      13: 48 8d 04 0a                  	leaq	(%rdx,%rcx), %rax
      17: 48 01 f0                     	addq	%rsi, %rax
      1a: 4c 01 c0                     	addq	%r8, %rax
      1d: 4c 01 c8                     	addq	%r9, %rax
      20: 48 03 44 24 08               	addq	0x8(%rsp), %rax
      25: 48 03 44 24 10               	addq	0x10(%rsp), %rax
      2a: c3                           	retq
```

6 chiếc xe, sau đó 2 chiếc xe tải.`8(%rsp)`và `16(%rsp)`. Hình 3.3 của psABI đặt "khán giả ghi nhớ 8byte 0" vào `16(%rbp)`Khi nào `%rbp`là cơ sở khung, đó là `8(%rsp)`khi vào trước khi đẩy. `g`là ở 8, `h`16 tuổi.

`mixed(int i, double d, long long l, float f)`cho thấy hai danh sách.`%edi`và `%rsi`, các hồ sơ đầu tiên và thứ hai của INTEGER.`%xmm0`và `%xmm1`, các hồ sơ SSE đầu tiên và thứ hai.`cvtsi2sd %edi, %xmm2`, và`%xmm2`là một sổ ghi trầy xước mà hàm viết trước khi nó đọc. Một phân tích xử lý mục đích của `cvtsi2sd`Radar2 đã làm điều đó và báo cáo `mixed`như `(double arg1, double arg2, double arg3)`trong `xmm0`- `xmm1`- `xmm2`- Tôi không biết.

`by_value(struct pair p)`vượt qua một cấu trúc 16 byte như hai INTEGER 8 byte trong `%rdi`và `%rsi`, và trả lại theo cách tương tự: `leaq 0x1(%rdi), %rax; leaq -0x1(%rsi), %rdx; retq`- `big_ret(long long seed)`trả lại 32 byte, đó là lớp MEMORY, và psABI nói "người gọi cung cấp không gian cho giá trị trả lại và chuyển địa chỉ lưu trữ này trong %rdi như thể đó là lập luận đầu tiên". `seed`di chuyển đến `%rsi`, và hàm bắt đầu với `movq %rdi, %rax`vì "Khi trả lại %rax sẽ chứa địa chỉ mà người gọi đã thông qua trong %rdi".

Khu vực đỏ là chữ ký khác của hệ thống V. psABI 3.2.2: "Phần 128 byte bên ngoài vị trí được chỉ ra bởi %rsp được coi là được bảo lưu và không được sửa đổi bởi các bộ xử lý tín hiệu hoặc gián đoạn".`-O0`- `eight_args`là `pushq %rbp; movq %rsp, %rbp`và sau đó 6 cửa hàng đến `-0x8(%rbp)`qua `-0x30(%rbp)`Không có `subq`Các cửa hàng nằm 48 byte dưới điểm chỉ số.`-O2`xây dựng của `sum_varargs`phân bổ 88 byte với `subq $0x58, %rsp`và sau đó viết các mục lưu sổ vào `-0x58(%rsp)`xuống `-0x80(%rsp)`: 128 byte dưới chỉ số stack, toàn bộ vùng đỏ.`-mno-red-zone`và `leaf_add`đạt được a `pushq %rax`và một `addq $0x8, %rsp`để giữ 8 byte của người dân địa phương trên điểm chỉ số.

Các cuộc gọi khác nhau thêm một sổ đăng ký. "%al được sử dụng như một lập luận ẩn để xác định số lượng sổ đăng ký vector được sử dụng", một ranh giới trên từ 0 đến 8. `call_varargs`Đặt nó với `xorl %eax, %eax``-O2`và `movb $0x0, %al``-O0`- `sum_varargs`đọc nó trước: `testb %al, %al; je`nhảy tám `movaps %xmmN`lưu khi không có sổ đăng tải vector được sử dụng.

## Microsoft x64: Các vị trí, một cửa hàng bóng tối, và không có vùng đỏ

Các quy tắc của Microsoft là định vị. "Các lập luận toàn bộ được thông qua trong các đăng ký RCX, RDX, R8 và R9.`mixed`đến như `%ecx`- `%xmm1`- `%r8`- `%xmm3`: slot 0 là một int, vì vậy `RCX`; khe 1 là một đôi, vì vậy `XMM1`; khe 3 là một float, vì vậy `XMM3`- `XMM0`và `XMM2`- Không, không.

Người gọi cũng phải rời khỏi phòng. "Người gọi luôn phải phân bổ đủ không gian để lưu trữ bốn tham số đăng ký, ngay cả khi người gọi không có nhiều tham số đó". Các trang gọi nó là cửa hàng bóng tối hoặc địa chỉ nhà, và bốn khe là "các hiệu quả thuộc sở hữu của hàm gọi". Khi nhập `0(%rsp)`là địa chỉ trả lại, `8(%rsp)`đến`39(%rsp)`là bốn ngôi nhà, và cuộc tranh luận đầu tiên là ở `40(%rsp)`- `eight_args``-O2`đọc `0x28(%rsp)`- `0x30(%rsp)`- `0x38(%rsp)`- `0x40(%rsp)`40, 48, 56, 64.

Bên gọi cho thấy số học. `call8``-O2`là `subq $0x48, %rsp`và sau đó là các cửa hàng 5, 6, 7, 8 tại `0x20(%rsp)`đến`0x38(%rsp)`trước đây`movl $1, %ecx`72 byte là 32 cho cửa hàng bóng, 32 cho 4 lập luận hàng, và 8 để địa chỉ trả lại là trên một ranh giới 16 byte. `call_varargs`chỉ có ghi lập luận và vẫn phân bổ `subq $0x28, %rsp`: 32 cho cửa hàng bóng và 8 cho việc sắp xếp. `keeps`đẩy ba registry không biến động (24 byte) và sau đó `subq $0x20, %rsp`, để đó`ext`tìm thấy kho lưu trữ bóng 32 bit của nó bên dưới địa chỉ trả về.

Strukt tuân theo quy tắc của riêng họ. "Mọi lập luận không phù hợp với 8 byte, hoặc không phải là 1, 2, 4, hoặc 8 byte, phải được thông qua bằng tham chiếu. " và "Các lập luận 16 byte được thông qua bằng tham chiếu. " `by_value`do đó nhận được một chỉ dẫn cho một bản sao trong `%rdx`, sau khi một dấu hiệu kết quả ẩn trong `%rcx`: "người gọi phải phân bổ bộ nhớ cho giá trị trả lại và chuyển một chỉ số cho nó như là lập luận đầu tiên.`call_pair`tạo bản sao tại `0x20(%rsp)`với `movaps`, thông qua `leaq 0x20(%rsp), %rdx`, vượt qua buffer kết quả với `leaq 0x38(%rsp), %rcx`, và đọc `.b`quay lại từ `0x40(%rsp)`- Tôi không biết.

Không có vùng đỏ. "Tất cả bộ nhớ ngoài địa chỉ hiện tại của RSP được coi là biến động: Hệ điều hành, hoặc một debugger, có thể ghi lại bộ nhớ này trong một phiên debug người dùng, hoặc một bộ xử lý gián đoạn. "`-O0` `leaf_add`cần 8 byte của người dân địa phương và có được họ với `pushq %rax`khi nhập cảnh và `popq %rcx`trước đây`retq`, hai hướng dẫn đơnbyte thay vì một `subq`và một `addq`. Trang sử dụng hàng xếp xác định các lá có thể làm điều này: "Một hàm lá là một hàm không yêu cầu một mục bảng hàm. Nó không thể thực hiện thay đổi cho bất kỳ đăng ký không biến động nào, bao gồm RSP".

Variadic gọi nhà của họ đăng ký. "Đối với vararg hoặc các chức năng không nguyên mẫu, bất kỳ giá trị điểm nổi nào phải được sao chép trong các đăng ký mục đích chung tương ứng". `sum_varargs``-O2`cửa hàng `%rdx`- `%r8`- `%r9`đến`0x18(%rsp)`- `0x20(%rsp)`- `0x28(%rsp)`sau một`pushq %rax`, đó là nhập số 16, 24, 32: các nhà của các tham số đăng ký thứ hai, thứ ba và thứ tư.`va_list`là `leaq 0x18(%rsp), %rax`, nhà của `%rdx`, tranh luận đầu tiên không được đặt tên.

## AAPCS64, và những gì Apple thay đổi

AAPCS64 6.8.2 đi qua một danh sách các quy tắc với hai đếm. C.9: một lập luận tích hợp "được sao chép đến các bit ít có ý nghĩa nhất trong x[NGRN]" và NGRN tăng. C.1 làm tương tự cho các lập luận điểm nổi với NSRN. C.12: một hợp chất tối đa `8 - NGRN`"Điều gì được sao chép vào các sổ đăng ký mục đích chung liên tiếp". C.13 đặt "NGRN được thiết lập lên 8" một khi một lập luận đi đến hàng, vì vậy không có gì trở lại các sổ đăng ký sau đó. `eight_args`sử dụng `x0`đến`x7`Và không bao giờ chạm vào đống.`mixed`là `w0`- `d0`- `x1`- `s1`- `by_value`là `x0`và `x1`vào và ra.

6.9 nói rằng một kết quả sẽ được thông qua trong các sổ đăng ký "được trả lại trong các sổ đăng ký tương tự", nếu không "Sự địa chỉ của khối bộ nhớ sẽ được thông qua như một lập luận bổ sung cho hàm trong x8". `big_ret`viết `str x0, [x8]`- `stur q0, [x8, #0x8]`- `str x9, [x8, #0x18]`và không bao giờ viết.`x0`- `call_big`bộ `mov x8, sp`, và`seed`ở lại `x0`, vì 6.9 thêm "không có yêu cầu cho calllee để bảo tồn giá trị được lưu trữ trong x8" và `x8`không phải là một trong các hồ sơ tranh luận.

6.4.5.2: tại một giao diện công cộng "SP mod 16 = 0". Dòng xếp là hoàn toàn giảm và "Không có chuỗi được phép truy cập (để đọc hoặc viết) khu vực không hoạt động" bên dưới nó, vì vậy Linux `-O0` `leaf_add`phát `sub sp, sp, #0x10`cho 8 byte của người dân địa phương nơi hệ thống V sử dụng vùng đỏ.

6.4.6 định nghĩa ghi khung: "một ghi khung gồm hai giá trị 64 bit trên đống ... Từ hai được địa chỉ thấp nhất phải chỉ đến ghi khung trước đó và từ hai được địa chỉ cao nhất phải chứa giá trị được chuyển qua trong LR khi nhập vào hàm hiện tại. " và "Nơi của ghi khung trong một khung đống không được chỉ định". clang cho thấy cả hai vị trí trong một tệp này. `keeps``-O2`trên Linux đặt kỷ lục ở dưới cùng với `stp x29, x30, [sp, #-0x30]!; mov x29, sp`. Tương tự chức năng tại `-O0`đặt nó ở đầu với `sub sp, sp, #0x20; stp x29, x30, [sp, #0x10]; add x29, sp, #0x10`- Tôi không biết.

Các ghi chú arm64 của Apple giữ các sổ đăng ký và sự sắp xếp và thay đổi khung, vùng đỏ và các cuộc gọi khác nhau. "Tổ số chỉ dẫn khung (x29) luôn phải giải quyết một bản ghi khung hợp lệ. Một số chức năng, chẳng hạn như các chức năng lá hoặc cuộc gọi đuôi, có thể chọn không tạo một mục trong danh sách này".`keeps`tiết kiệm`x22, x21, x20, x19`đầu tiên và đặt kỷ lục lên trên đỉnh: `stp x29, x30, [sp, #0x20]; add x29, sp, #0x20`"Thông tin lưu trữ nền tảng x18. Đừng sử dụng sổ đăng ký này". "Phần màu đỏ ARM64 bao gồm 128 byte ngay dưới đầu chỉ số", và clang vẫn phát ra `sub sp, sp, #0x10`cho `-O0`các lập luận Variadic được gán "cho số lượng thích hợp của các khe xếp 8 byte" và "những loại va_list là một biệt danh cho char*". `call_varargs`trên Apple Store 10, 20, 30 đến `[sp]`- `[sp, #8]`- `[sp, #0x10]`và chỉ đi qua thôi`w0`; Linux build được thông qua `w1`- `w2`- `w3`và gọi hậu quả với `b extva`- Thẻ Apple`sum_varargs`đọc `add x8, sp, #0x10`, chỉ số xếp hàng của người gọi, như là `va_list`; Linux `sum_varargs`tiết kiệm`x1`đến`x7`và `q0`đến`q7`vào khung 224 byte và khởi tạo các trường cấu trúc `__gr_offs`đến -56 và `__vr_offs`-128 với một `mov x8, #-0x38; movk x8, #0xff80, lsl #32`- Tôi không biết.

Các biểu tượng khác nhau. Mach-O đặt tiền tố cho mỗi biểu tượng C với `_`, vì vậy danh sách cho thấy `_keeps`và chức năng đầu tiên xuất hiện dưới nhãn riêng `ltmp0`. máy phân tích đổi tên các nhãn qua bảng biểu tượng.

## Tự giải mã một đoạn tiền đề bằng tay, ba lần

`keeps(int n)`gọi`ext(i)`trong vòng lặp và giữ `n`- `i`, và`acc`qua cuộc gọi, vì vậy mỗi ABI phải lưu các sổ đăng ký.`-O2`xây dựng cho mỗi mục tiêu.

Hệ thống V, 4 byte:

1. `55`là `push r64`với sổ đăng ký ở 3 bit thấp: `50 + 5`- `%rbp`Độ sâu 8,`%rbp`lưu tại lối vào -8.
2. `41 56``41`REX có `B`thiết lập, `56`là `50 + 6`REX.B kéo dài từ 6 đến 14: `pushq %r14`- 16 tuổi.
3. `53`là `50 + 3``pushq %rbx`ở -24.

Ba cú đẩy là 24 byte. địa chỉ trả lại thêm 8, và 32 là nhiều hơn 16, vì vậy `callq ext`bên trong vòng lặp được thẳng đứng mà không có một `subq`Không có.`movq %rsp, %rbp`, nên cái này không có khung chỉ dẫn.`%rbp`Như sổ đăng ký được cứu từ tiếng gọi`acc`(`xorl %ebp, %ebp`- `addl %eax, %ebp`                                                                                                                                                                                                                                                              `5b 41 5e 5d c3`- Tôi không biết.

Microsoft x64, 7 byte:

1. `56`là `pushq %rsi`ở mức -8.`57`là `pushq %rdi`- 16 giờ.`53`là `pushq %rbx`Ở -24, cả ba đều không biến động ở đây, và`RDI`và `RSI`là các hồ sơ lập luận theo hệ thống V.
2. `48 83 ec 20`: REX.W, opcode `83 /5`với một 8-bit ngay lập tức, ModRM `ec`là `11 101 100``subq $0x20, %rsp`Độ sâu 56.

56 cộng với địa chỉ trả lại là 64, được sắp xếp. 32 byte là cửa hàng bóng tối mà`ext`trang epilog chỉ cho phép "một thêm RSP, liên tục hoặc lea RSP, liên tục [FPReg], tiếp theo là một loạt các ổ pop đăng ký 8byte hoặc nhiều hơn và một trở lại hoặc một jmp", và các byte là `48 83 c4 20 5b 5f 5e c3`- Tôi không biết.

AArch64, 16 byte trong bốn từ, nhỏ-endian:

1. `a9bd7bfd`là `stp`với pre-index. Bits 31:30 `10`chọn các ca khâu 64-bit, bit 25:23 `011`chọn pre-index, bit 22 là 0 cho store. imm7 tại bit 21:15 là `1111010`Rt2 ở 14:10 là 30, Rn ở 9:5 là 31 (`sp`), Rt ở 4:0 là 29. `stp x29, x30, [sp, #-0x30]!`: điểm chỉ số đống giảm 48, `x29`đi đến -48 và `x30`-40
2. `f9000bf5`là `str`với một sự thay thế 12 bit không ký kết được quy mô bằng 8: imm12 tại 21:10 là 2, Rn là `sp`, Rt là 21.`str x21, [sp, #0x10]`, trục nhập - 32.
3. `910003fd`là `add`ngay: imm12 là 0, Rn là `sp`, Rd là 29.`mov x29, sp`: khung chỉ số chỉ số tại ghi ở -48.
4. `a9024ff4`là `stp`với một sự thay thế được ký kết: imm7 là 4, được quy mô đến 32. Rt2 là 19, Rt là 20. `stp x20, x19, [sp, #0x20]``x20`ở -16, `x19`-8.

Quad trình là 48 byte: `x29`ở 0, `x30`lúc 8 giờ.`x21`ở 16, 8 byte của lấp lấp ở 24, `x20`ở 32, `x19`Từ thấp nhất trong hồ sơ chỉ ra hồ sơ trước đó và từ tiếp theo giữ LR, như 6.4.6 yêu cầu. `cmp w0, #0x1`nằm giữa kho thứ nhất và thứ hai; người lập lịch di chuyển nó vào phần mở đầu, và người phân tích dung lượng so sánh hoặc chỉ dẫn toán học giữa các hoạt động xếp chồng.

## Người biên tập đã viết hai lần cùng một sự thật

Một phân tích tiền đề là một dẫn xuất. Bộ biên dịch phát ra một thứ hai cho máy giải ghép, và hai người phải đồng ý.

Trên Windows, hệ thống thứ hai là `.pdata`và `.xdata`- Xây dựng `-O2`đối tượng không có `-fno-asynchronous-unwind-tables`và `llvm-objdump -h`cho thấy`.xdata`của 0x34 byte và `.pdata`của 0x48 byte. 0x48 là 72, 6 `RUNTIME_FUNCTION`các mục 12 byte với 3 `IMAGE_REL_AMD64_ADDR32NB`Mỗi người đều được chuyển.`sum_varargs`- `keeps`- `call8`- `call_varargs`- `call_pair`, và`call_big`. Sáu chức năng khác là lá, và trang xử lý ngoại lệ nói "Nếu tìm kiếm không tìm thấy mục bảng hàm, mã được cho là là một phần của hàm lá, và RSP trực tiếp hướng đến chỉ số trả về".

- `.xdata`byte cho `keeps`là `01 07 04 00 07 32 03 30 02 70 01 60`- `UNWIND_INFO`bắt đầu với Version trong 3 bit và Flag trong 5 bit: version 1, không có cờ. SizeOfProlog là 7, CountOfCodes là 4, FrameRegister và FrameOffset là 0. Mỗi `UNWIND_CODE`là một sự thay thế trong phần mở đầu và một byte của mã op và thông tin. `07 32`: tại ofset 7, op 2 là `UWOP_ALLOC_SMALL`, thông tin 3 nghĩa là `3 * 8 + 8 = 32`- Tự động`03 30`: op 0 là `UWOP_PUSH_NONVOL`, sổ số 3 là `rbx`- `02 70``rdi`- `01 60``rsi`Các mã được lưu trữ theo thứ tự thực hiện ngược, và họ đặt tên cùng ba push và phân bổ 32 byte như các byte `56 57 53 48 83 ec 20`- `sum_varargs`nhập là `01 01 01 00 01 02 00 00`: một phần mở đầu 1 bit với một mã, `UWOP_ALLOC_SMALL`Đó là cách mà máy thổi gió nhìn thấy`pushq %rax`: một phân bổ, bởi vì`%rax`là biến động và không có gì được tiết kiệm.

Trên Linux, hệ thống thứ hai là `.eh_frame`, được định nghĩa bởi PSABI 4.2.4 và mã hóa phần 6.4 của DWARF 5. `llvm-dwarfdump --eh-frame`trên đối tượng được chuyển nhượng in một FDE cho mỗi hàm và giải quyết các `R_X86_64_PC32`Các khu vực này có thể được sử dụng.`keeps`- Có thể là:

```text
  DW_CFA_def_cfa_offset: +16
  DW_CFA_def_cfa_offset: +24
  DW_CFA_def_cfa_offset: +32
  DW_CFA_offset: RBX -32
  DW_CFA_offset: R14 -24
  DW_CFA_offset: RBP -16
```

CFA là điểm chỉ số hàng trước khi gọi, 8 trên điểm chỉ số hàng đầu, vì vậy `RBP -16`là sự bù đắp nhập cảnh -8, `R14 -24`là -16, `RBX -32`là -24, và sự thay thế CFA sâu nhất của 32 là khung 24 byte cộng với địa chỉ trả lại.`keeps`nói `DW_CFA_def_cfa: W29 +48`với `W29 -48`- `W30 -40`- `W21 -32`- `W20 -16`- `W19 -8`Ở đó CFA là chỉ số đầu vào của bản thân, do đó các sự bù đắp là các khung bù đắp mà không chuyển đổi, và CFA được định nghĩa từ `x29`Trong khi bản ghi khung hình đang hoạt động. `eh_frame_cross_check()`làm so sánh này cho tất cả 12 FDE của cả hai đối tượng.`call8`dưới hệ thống V đẩy hai lập luận ra giữa cơ thể, do đó, sự thay thế CFA sâu nhất của nó là 32 trong khi khung tiền đề của nó là 8, và kiểm tra so sánh chỉ số xếp chồng sâu nhất mà cơ thể đạt được, 24, cộng với 8.

## Công cụ gọi đây là gì

Mỗi công cụ trong lĩnh vực này có cấu trúc dữ liệu cho quy ước gọi và một thông qua gán một chức năng. Các tên khác nhau và khoảng trống khác nhau. Các công cụ đóng được mô tả từ tài liệu của họ; những công cụ mở được chạy trên các thiết bị và đầu ra của họ được ghi lại bên cạnh các đối tượng.

**Ghidra 12.1.4 (Apache-2.0).**Các quy tắc sống trong các tập tin đặc điểm biên dịch,`.cspec`, bên cạnh ngôn ngữ SLEIGH. `x86-64-gcc.cspec`tuyên bố một `<default_proto>`tên `__stdcall`, "Triết xuất từ Hệ thống V ứng dụng Binary Interface AMD64 Thiết kế Processor bổ sung tháng 4 năm 2016", với `<pentry>`danh sách cho `XMM0_Qa`đến`XMM7_Qa`và `RDI, RSI, RDX, RCX, R8, R9`, một mục đống tại offset 8, a `join_dual_class`quy tắc cho các loại lên đến 16 byte, đầu ra `XMM0_Qa, XMM1_Qa, RAX, RDX`, và`hidden_return`cho phần còn lại. `x86-64-win.cspec`tuyên bố`__fastcall`với bốn `<group>`các yếu tố kết hợp `XMM0_Qa`với `RCX`- `XMM1_Qa`với `RDX`, và vv, đó là quy tắc vị trí, một mục đống tại offset 40, `convert_to_ptr`cho các đường thẳng 3, 5, 6 hoặc 7 byte với bình luận "chỉ có thể đóng gói các đường thẳng kích thước 8,16,32,64 bit để đăng ký", `unaffected`danh sách `RBX RBP RDI RSI RSP R12`đến`R15`và `XMM6`đến`XMM15`, và một `localrange`của hàng đống 8 đến 39, đó là cửa hàng bóng tối. `AARCH64.cspec`tuyên bố`__cdecl`có mục đầu tiên là `x8`với `storage="hiddenret"`, sau đó `q0`đến`q7`và `x0`đến`x7`- `convert_to_ptr`cho các đường thẳng 17 byte hoặc hơn, và `killedbycall`bao gồm:`x8`với bình luận "đăng ký vị trí kết quả gián tiếp, không được phản ánh trong danh sách pentry". Bước cuối cùng của decompiler được gọi là "Establish Function's Prototype"; các phân tích là "Call Convention ID" và "Decompiler Parameter ID"; tùy chọn chương trình "Prototype Evaluation" chọn mô hình mặc định.

**IDA Pro and IDA Free (Hex-Rays, commercial; current release 9.4, build 9.4.260714).**Loại hàm là một tuyên bố C được đặt thông qua SetType, và "IDA sẽ sử dụng thông tin loại để bình luận về việc tách rời với thông tin về các lập luận hàm".`int __usercall func@<ebx>(int x, int y@<esi>)`đưa kết quả vào `EBX`và `y`trong `ESI`, và`@<^12.4>`tên một vị trí hàng theo sự bù đắp và kích thước. `__userpurge`cũng giống như việc dọn dẹp cột Callee.`__spoils`cho bộ clamped, `__hidden`- `__return_ptr`, và`__struct_ptr`cho các lập luận ngầm bài học này được lấy lại bằng tay.`__usercall`IDA Free chỉ hỗ trợ x86 và x86-64.

**Binary Ninja 6.0 "Krypton" (Vector 35, commercial, with a Free edition that decompiles x86, x86_64, ARMv7, and AArch64).**A `Platform`"có chứa tất cả các thông tin liên quan đến môi trường thực hiện của binary, chủ yếu là các quy ước gọi được sử dụng, hệ điều hành và kiến trúc", và danh sách bao gồm `linux-x86_64`- `windows-x86_64`- `linux-aarch64`, và`mac-aarch64`, mỗi người với một `default_calling_convention`. A `CallingConvention`- Có `int_arg_regs`- `float_arg_regs`- `callee_saved_regs`- `caller_saved_regs`- `int_return_reg`- `high_int_return_reg`- `float_return_reg`, và hai cờ mã hóa sự khác biệt trong bài học này trực tiếp:`arg_regs_share_index`, "Khi True, lập luận Nth tiêu thụ khe thứ hai của cả hai danh sách số nguyên và float regist bất kể loại của nó", và `stack_reserved_for_arg_regs`, "không gian bóng/home được sử dụng bởi các Windows x64 gọi thông tin". `eligible_for_heuristics`- `required_arg_regs`, và`required_clobbered_regs`sử dụng để phát hiện các quy định heuristic của nó.`types/platform/`, một cái tên trên nền tảng.

**radare2 6.2.4 (LGPL-3.0, run here).** `afcl`liệt kê các quy ước plugin kiến trúc biết: `amd64 amd64syscall dlang golang golang_abi0 ms p9 reg swift`cho x86-64 và `arm64 dlang golang p9 reg swift`cho AArch64. `afc`báo cáo về quy định của chức năng hiện tại, `afcr`dấu vân tay`cc.amd64.arg0: rdi`qua `arg5: r9`và `ret0: rax`, và các hồ sơ là các tệp SDB có tên `cc-ARCH-BITS.sdb`. radar2 được chọn`amd64`cho đối tượng ELF và `ms`cho đối tượng COFF, đó là sự chia đúng. `afv`liệt kê các lập luận và biến, và `afs`in một chữ ký. trên Linux `-O2`đối tượng`afv`tìm thấy bảy lý do cho `eight_args`và rơi xuống`rcx`; trên đối tượng Windows mà nó tìm thấy `rcx, rdx, r8`và bốn khe xếp hàng và rơi xuống `r9`Cả hai sổ bị mất đều chỉ xuất hiện bên trong một`lea`- Cứ đi.`mixed`báo cáo `double arg1 @ xmm0, arg2 @ xmm1, arg3 @ xmm2`trên Linux và không có tranh luận nào trên Windows.`x0`đến`x7`cho `eight_args`, và vì`big_ret`nó được liệt kê `x0`và `double arg2 @ d1`nơi hàm đọc `x8`và tải một liên tục vào `q1`- Mọi người`afs`chữ ký bắt đầu với `void`, bởi vì loại trả lại không được suy luận.`-O0`, nơi mọi tranh luận được lưu trữ vào khung,`afv`tìm thấy tất cả tám lập luận của `eight_args`với `rbp+0x10`và `rbp+0x18`cho cặp đống.

**rizin 0.9.1 (LGPL-3.0, run here) and Cutter 2.5.0.** `afcl`danh sách `amd64 amd64syscall ms reg swift`- `afc`quay lại `amd64`cho đối tượng COFF, do đó hồ sơ Microsoft tồn tại và không được chọn từ định dạng. `afi`đã liệt kê bảy lý lẽ cho `eight_args`trên Linux, một lần nữa không có `rcx`, và trên Windows `r8, rcx, rdx`với ba khe cột, không có `r9`và không có khe cắm ở `0x40`- `afv`không tồn tại; lệnh liệt kê là `afvl`Cutter là phần trước của đồ họa trên Rizin.

**angr 10.0.3 (BSD-2, run here).** `CFGFast`tiếp theo là `CompleteCallingConventions(recover_variables=True)`bộ `function.calling_convention`đến`SimCCSystemVAMD64`- `SimCCMicrosoftAMD64`, hoặc`SimCCAArch64`, theo định dạng nhị phân, và `function.prototype`Nó đã lấy lại tất cả tám lập luận của`eight_args`trên cả ba mục tiêu, dấu hiệu ẩn của `big_ret`trên x86-64 như `(BOT*, long long) -> BOT*`, cấu trúc tham chiếu phụ của Windows `by_value`như `(BOT*, BOT*) -> BOT*`, và hệ thống V biến`sum_varargs`như `(long long, ...)`. . Hỗng của nó khác với radar2:`mixed`quay lại như `(long long, long long, double, float)`Trong hệ thống V và AArch64, các hồ sơ phải theo thứ tự sai, bởi vì danh sách số nguyên được in trước danh sách nổi; AArch64 `big_ret`quay lại như `(long long) -> double`, nên `x8`hội nghị đã bị bỏ lỡ và các cửa hàng vector đã được đọc như một kết quả; và AArch64 `sum_varargs`đã quay lại với 16 tham số, toàn bộ khu vực lưu hồ sơ.

**Others.**Hopper 6.6.0 là một máy giải thể và giải thể thương mại cho macOS và Linux; xử lý các quy ước của nó không được chạy hoặc ghi lại cho bài học này.`frame info`và `register read`, là bài học 42 của xem động của cùng một sự thay đổi. Compiller Explorer hiển thị ba danh sách cạnh nhau từ nguồn, đó là cách nhanh nhất để xác nhận một quy tắc trước khi bạn tìm kiếm nó trong byte.

| Concept | Ghidra | IDA | Binary Ninja | radare2 / rizin | angr | this lesson |
|---|---|---|---|---|---|---|
| The convention object | `prototype` in a `.cspec` | calling convention keyword in the function type | `CallingConvention` on a `Platform` | `afc` name, `cc-ARCH-BITS.sdb` | `SimCC` subclass | `expected_locations(abi, name)` |
| Default per target | `<default_proto>` per cspec | compiler setting | `Platform.default_calling_convention` | `afc=`, `anal.cc` | by format | `describe_object()` |
| Argument registers | `<pentry>` list, `<group>` for positional | `@<reg>` in `__usercall` | `int_arg_regs`, `float_arg_regs`, `arg_regs_share_index` | `cc.NAME.argN` | `ARG_REGS`, `FP_ARG_REGS` | `INT_ARG_REGS`, `FLOAT_ARG_REGS` |
| Shadow store | `localrange` stack 8 to 39 | implicit | `stack_reserved_for_arg_regs` | `cc.ms.argn=stack` | `STACKARG_SP_DIFF` | `STACK_ARG_BASE[WIN64] = 40` |
| Hidden result pointer | `hidden_return`, `storage="hiddenret"` | `__return_ptr`, `__hidden` | return type too large for `int_return_reg` | not modelled | `BOT*` first argument | `HIDDEN_RETURN_REG` |
| Callee-saved | `<unaffected>` | `__spoils` lists the opposite | `callee_saved_regs` | profile | `CALLEE_CLEANUP` and arch | `CALLEE_SAVED` |
| Assigning one to a function | "Call Convention ID" analyzer, "Establish Function's Prototype" | user or type library | heuristic detection with `required_arg_regs` | `afc`, `afva`, `aaft` | `CallingConventionAnalysis` | read-before-write plus the rulebook |

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một báo cáo JSON. Đối với mỗi bảy đối tượng nó đặt tên định dạng, máy và ABI, và cho mỗi trong mười hai chức năng nó cho các byte đầu tiên, các sổ đăng ký được lưu với các sự bù đắp nhập, kích thước khung, chỉ số khung, các sổ đăng ký tham số, các điểm bù đắp lập luận, các vụ đổ, sổ đăng ký trở lại hoặc dấu chỉ, độ sâu cuộc gọi, và các sổ đăng ký và cửa hàng ra khỏi của người gọi. Mỗi hàm kết thúc với kiểm tra của nó: quy tắc, giá trị mong đợi từ chữ ký, giá trị quan sát từ các byte, và liệu họ đồng ý hay không. Báo cáo kết thúc với hai kiểm tra chéo và công cụ bắt. Trong 84 phân tích chức năng, 489 kiểm tra được thực hiện và tất cả 489 đồng ý.

Hình dạng dự kiến:

```json
{
  "objects": {
    "convention-x86_64-windows-O2": {
      "format": "COFF", "machine": "AMD64", "abi": "Microsoft x64", "checks": "73/73 agree",
      "functions": {
        "keeps": {
          "prologue": ["56  pushq %rsi", "57  pushq %rdi", "53  pushq %rbx", "48 83 ec 20  subq $0x20, %rsp"],
          "frameBytes": 56,
          "savedRegisters": [{"register": "rsi", "entryOffset": -8}, {"register": "rdi", "entryOffset": -16}, {"register": "rbx", "entryOffset": -24}],
          "parameterRegisters": ["rcx"],
          "returnRegisters": ["rax"],
          "calls": [{"callee": "ext", "depth": 56}],
          "checks": [{"rule": "Microsoft x64: the caller must always allocate ...", "expected": "at least 32 bytes ...", "observed": [56], "agree": true}, "..."]
        }
      }
    }
  },
  "sehCrossCheck": ["..."],
  "ehFrameCrossCheck": {"...": "..."}
}
```

Đọc `code/main.py`theo thứ tự này:

1. `describe_object()`đọc tiêu đề ELF, COFF hoặc Mach-O và bảng biểu tượng và trả lại ABI và danh sách hàm.
2. `parse_listing()`chia ra `llvm-objdump -d -r`văn bản thành các chức năng, giữ mục tiêu di chuyển của mỗi cuộc gọi và nhảy, và xóa các bình luận với dấu hiệu của cú pháp đúng: `#`cho AT&T, `//`và `;`cho AArch64, nơi `#`giới thiệu một ngay lập tức.
3. `effect_x86()`và `effect_arm()`biến một hướng dẫn thành đọc, đọc địa chỉ, viết, tải, cửa hàng, và một điểm chỉ số đống. Operand AT&T cuối cùng là điểm đến; operand AArch64 đầu tiên là điểm đến ngoại trừ trong các cửa hàng, so sánh và chi nhánh. `lea`đọc một địa chỉ và không tải gì.`mov`- `cvtsi2sd`- `setcc`, và ngôn ngữ không`xor r, r`Một cuộc gọi viết toàn bộ bộ bộ biến động.`sp`trước khi truy cập và tải sau khi được lập chỉ số di chuyển nó sau.
4. `analyze_function()`đi bộ cơ thể một lần lên đầu tiên `ret`Nó theo dõi độ sâu của dấu chỉ đống dưới giá trị nhập của nó, do đó một bộ nhớ hoạt động `disp(%rsp)`là vào trục trặc `disp - depth`và `disp(%rbp)`là ở `frame_pointer + disp`. Nó ghi lại các sổ đăng ký lớp đối số được đọc trước khi chúng được viết, tải ở hoặc trên các điểm lập trình đầu tiên của ABI, lưu trữ các sổ đăng ký đối số vào khung, truy cập dưới chỉ số hàng hiện tại, và độ sâu tại mỗi cuộc gọi.
5. `_return_registers()`giữ một sổ đăng kết quả khi truy cập cuối cùng của nó trước khi ra khỏi là một viết.`rax`sống trong `big_ret`dưới Microsoft x64, nơi `movq %rcx, %rax`được theo bởi các cửa hàng qua `(%rax)`- Tôi không biết.
6. `expected_locations()`áp dụng ba sách quy tắc cho chữ ký C: hai danh sách System V với lớp támbyte, khe vị trí Microsoft với cấu trúc tham chiếu phụ, và AAPCS64 đếm với `x8`cho kết quả trên 16 byte.
7. `run_checks()`so sánh hai và thêm các quy tắc khung: các sổ đăng ký được lưu được ghi lại phải được lưu,`(rsp + 8) % 16 == 0`hoặc `sp % 16 == 0`tại mỗi cuộc gọi, 32 byte bóng tối tại mỗi cuộc gọi của Microsoft, không có quyền truy cập dưới chỉ số đống dưới Microsoft và AAPCS64 và tối đa 128 byte trong System V, và một epilogue phản ánh tiền đề với chỉ số đống trở lại vào giá trị nhập của nó.
8. `seh_cross_check()`và `eh_frame_cross_check()`đọc dữ liệu không xoay của các vật thể được xây dựng mà không `-fno-asynchronous-unwind-tables`và so sánh nó với phần phân tích đầu tiên.

Có ba lệnh nữa.`python3 code/main.py analyze convention-x86_64-windows-O2 keeps`in một hàm. `python3 code/main.py object FILE`in kết án của người viết tiêu đề. `python3 code/main.py seh`in các mã hóa được giải mã `UNWIND_INFO`của mọi hàm có một.

## Sử dụng nó

Sử dụng máy phân tích theo thứ tự này trên một vật thể mới bạn đã xây dựng.

1. Đi chạy`python3 code/main.py object FILE.o`và viết ra ABI nó tên. Nếu tiêu đề và lệnh xây dựng của bạn không đồng ý, dừng lại; một trong số họ là sai.
2. Tắt `llvm-objdump -d -r FILE.o`bên cạnh đối tượng và chạy phân tích. đọc các byte đầu tiên và các sổ đăng ký được lưu trước bất cứ điều gì khác, và so sánh kích thước khung hình với các cú nhấn và các `sub`- Tôi không biết.
3. Đọc các sổ đăng ký tham số và các điểm bù đắp đối với chữ ký nguồn của bạn. Một sổ đăng ký mà chữ ký không giải thích là một chỉ số ẩn, một dấu hiệu biến số hoặc một sổ đăng ký xước mà nhà phân tích đã nhầm lẫn với một lập luận. Trường hợp cuối cùng là một lỗi trong bảng hiệu ứng.
4. Đọc các kiểm tra không đồng ý, nếu có, mỗi tên là quy tắc nó dựa trên, vì vậy điều đầu tiên để kiểm tra là quy tắc, sau đó là byte, sau đó là phân tích.
5. Khi đối tượng có dữ liệu giải phóng, hãy chạy kiểm tra chéo. Hai dẫn xuất đồng ý là bằng chứng mạnh nhất bài học này tạo ra.
6. Khi một công cụ khác được cài đặt, chụp đầu ra của nó bằng lệnh chính xác và so sánh. Khi nó đồng ý bạn có ba dẫn xuất. Khi nó khác biệt bạn có một sổ đăng ký cụ thể và một hướng dẫn cụ thể để xem, và đó là một phát hiện cho bài học 35.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: một hướng dẫn, ba hiệu ứng

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/code
python3 -q
```

Đi chạy:

```python
from main import *
effect(Instruction(0, "48 8d 04 0a", "leaq", "(%rdx,%rcx), %rax"), SYSV)
effect(Instruction(0, "f2 0f 2a d7", "cvtsi2sd", "%edi, %xmm2"), SYSV)
effect(Instruction(0, "a9bd7bfd", "stp", "x29, x30, [sp, #-0x30]!"), AAPCS64)
```

Viết ra những gì bạn đọc, địa chỉ đọc, viết, và các đống delta bạn mong đợi trước mỗi cuộc gọi.`[sp, #-0x30]!`đến`[sp], #0x30`với `ldp`và xem delta di chuyển từ `sp_delta`đến`post_sp_delta`- Tôi không biết.

### Phòng thí nghiệm B: khung của giữ

```python
info, listing = load_fixture("convention-aarch64-linux-O2")
keeps = analyze_function("keeps", listing["keeps"], info.abi)
keeps.saved
keeps.frame_pointer
[c.to_dict() for c in frame_cells(keeps)]
```

So sánh các sự bù đắp với mã hóa tay ở trên.`convention-arm64-macos-O2`và chạy cùng ba dòng; ghi chuyển sang -16 và bốn ghi ngồi bên dưới nó.`convention-x86_64-linux-O2-fp`và đọc `saved`cho `keeps`: chỉ dẫn khung quay lại, và cũng như là một `pushq %rax`Ai mà công việc duy nhất là làm `(rsp + 8)`số gấp 16 khi gọi.

### Phòng thí nghiệm C: đọc trước khi viết trên hỗn hợp

```python
info, listing = load_fixture("convention-x86_64-linux-O2")
mixed = analyze_function("mixed", listing["mixed"], info.abi)
mixed.param_registers
mixed.return_registers
expected_locations(SYSV, "mixed")["parameters"]
expected_locations(WIN64, "mixed")["parameters"]
```

Danh sách hệ thống V là `rdi, xmm0, rsi, xmm1`và danh sách của Microsoft là `rcx, xmm1, r8, xmm3`Bây giờ tải đối tượng Windows và chạy ba dòng đầu tiên một lần nữa. Sau đó mở radar2 chụp đối tượng Linux và tìm`[afv mixed]`: 3 lần. Tìm hướng dẫn giải thích thứ ba.

### Phòng thí nghiệm D: ý kiến thứ hai của máy tháo gió

```python
for row in seh_cross_check():
    print(row["function"], row["sizeOfProlog"], row["unwindPushes"], row["unwindAllocBytes"], row["agree"])
for row in eh_frame_cross_check("convention-x86_64-linux-O2-eh"):
    print(row["function"], row["cfiSaved"], row["cfiMaxOffset"], row["deepestStack"], row["agree"])
```

Tìm ra `pushq %rax`của `sum_varargs`trong bảng SEH và giải thích tại sao mã unwind ghi lại nó như một phân bổ.`call8`trong `.eh_frame`bàn và giải thích cho 32.

## Phòng thí nghiệm thực hành

Thêm mục tiêu thứ tư và sách quy tắc thứ tư.

Yêu cầu:

- Sắp xếp`convention.c`với `-target x86_64-apple-macos -O2`và nắm bắt danh sách của nó.`describe_object()`để đọc Mach-O `cputype`0x01000007 và lập bản đồ nó cho hệ thống V psABI, mà Apple theo dõi trên x86-64, với `_`biểu tượng tiền tố.
- Kiểm tra xem mọi hàm đều phù hợp với kiểm tra hệ thống V hay không. ghi lại sự khác biệt duy nhất bạn tìm thấy trong các đoạn đầu: Darwin giữ chỉ số khung ở mọi cấp độ tối ưu hóa.
- Thêm một `-fstack-protector-strong`xây dựng của đối tượng Linux x86-64. mở rộng quét prologue để tải canary từ `%fs:0x28`và cửa hàng dưới đây của người dân địa phương được ghi nhận là một `canary`tế bào, và so sánh trước `ret`như một tấm séc bảo vệ bản ghi âm.
- Thêm một bài kiểm tra thất bại khi một cửa hàng cá voi được tính là một tranh luận đổ.
- Viết khung của `with_canary`- kiểu mã bằng tay trước khi chạy máy phân tích, và giữ bản vẽ bên cạnh thử nghiệm.

Thành công là nghĩa của`python3 code/main.py`báo cáo đối tượng mới với mỗi kiểm tra đồng ý, và các tế bào khung của chức năng bảo vệ cho thấy các canary giữa người dân địa phương và các hồ sơ được lưu.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-calling-conventions-and-stack-frames.md`Sử dụng nó để biến một đối tượng bạn xây dựng, danh sách của nó, và các chữ ký C thành vị trí tham số, bố cục khung, sổ đăng ký trả lại, và kiểm tra mọi suy luận chống lại quy tắc nó dựa trên và chống lại dữ liệu giải phóng của trình biên dịch. Nó yêu cầu bản án ABI của tiêu đề trước tiên, cấm đọc `cvtsi2sd`hoặc `xor r, r`Địa điểm như đọc, và kết thúc với sự bất đồng đầu tiên.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Việc kiểm tra phải chứng minh:

- Các tiêu đề ELF, COFF và Mach-O của bảy đối tượng tên System V, Microsoft x64, AAPCS64 và Apple arm64
- bảng biểu tượng của mỗi đối tượng liệt kê cùng 12 hàm, với Mach-O `_`tiền đề và `ltmp0`nhãn được giải quyết
- trình phân tích danh sách giữ `ext`như mục tiêu gọi và giữ AArch64 ngay lập tức như `#-0x30`nguyên vẹn
- `leaq (%rdx,%rcx), %rax`đọc hai sổ đăng ký địa chỉ và không tải gì; `xorl %eax, %eax`và `cvtsi2sd`chỉ viết; được lập chỉ số trước `stp`Dẫn đi`sp`trước cửa hàng và sau khi được lập chỉ mục `ldp`sau khi tải
- `keeps``-O2`là `55 41 56 53`trên hệ thống V với khung 24 byte và không có chỉ dẫn khung, `56 57 53 48 83 ec 20`trên Microsoft x64 với khung 56-byte, và `a9bd7bfd`đầu tiên trên AArch64 với kỷ lục ở -48
- Apple build đặt kỷ lục ở -16 trên bốn sổ đăng ký được lưu
- mỗi hàm có một chỉ số khung ở `-O0`trên Linux và không có gì ở `-O2`, và`-fno-omit-frame-pointer`đưa nó trở lại với một cú đẩy sắp xếp
- `-O0`lá sử dụng 8 byte của vùng đỏ trong hệ thống V, `pushq %rax`dưới Microsoft x64, và `sub sp, sp, #0x10`theo AAPCS64; `-mno-red-zone`loại bỏ việc sử dụng vùng đỏ
- Mỗi đoạn phim phản ánh đoạn đầu của nó và điểm chỉ số đống lại ở lối vào
- `eight_args`đọc sáu sổ đăng ký và khe 8 và 16, bốn sổ đăng ký và khe 40 đến 64, hoặc `x0`đến`x7`, ở cả hai mức tối ưu hóa
- `mixed`là `rdi, xmm0, rsi, xmm1`trong hệ thống V và `rcx, xmm1, r8, xmm3`dưới Microsoft x64, với `xmm0`kết quả trên cả hai
- Struct 16 byte đi trong hai sổ đăng ký dưới hệ thống V và AAPCS64 và theo tham chiếu đằng sau một chỉ số ẩn dưới Microsoft x64
- Struct 32 byte trả lại qua `rdi`- `rcx`, hoặc`x8`
- Variacally Callee đọc `%al`, nhà `rdx, r8, r9`16, 24, 32, tiết kiệm `x1`đến`x7`và `q0`đến`q7`, hoặc đọc dấu chỉ của người gọi trên Apple
- người gọi đặt các sổ đăng ký dự kiến, lưu trữ 7 và 8 ở 0 và 8 hoặc 5 đến 8 ở 32 đến 56, không `%al`cho cuộc gọi biến số, và thông qua địa chỉ bú trùm kết quả trong `rdi`- `rcx`, hoặc`x8`
- Tất cả 489 kiểm tra đều đồng ý với quy tắc của họ
- 6`UNWIND_INFO`Các mục kết hợp với phần mở đầu và các lá không có
- 24 FDE phù hợp với các khoản bù trừ đăng ký lưu và chỉ số xếp hàng sâu nhất
- công cụ ghi lại radar2 của ghi chép `amd64`và `ms`, Rizin của `amd64`trên vật thể COFF, những gì mất tích `rcx`, ba đôi, và nguyên mẫu Angr
- dữ liệu số được nhúng trong mô-đun trang web bằng với đầu ra của máy phân tích

## Các chế độ sản xuất thất bại

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| COFF object read as System V | `rdi` and `rsi` as arguments that the function never reads | The header says 0x8664; the convention is Microsoft x64 |
| Register read only inside a `lea` | Seven arguments for an eight-argument function | Base and index registers are reads |
| `cvtsi2sd` destination counted as a read | A third double argument in `xmm2` | The first write to `xmm2` is a write; `mixed` has two SSE arguments |
| Positional slots read as sequences | `xmm0` named as the double argument on Windows | Slot 1 is `XMM1`, slot 3 is `XMM3` |
| `push rbp` taken as a frame pointer | A frame pointer in an `-O2` function that uses `rbp` as an accumulator | Only `mov %rsp, %rbp` after the push creates one |
| Red zone measured from the entry stack pointer | 216 bytes "below the stack pointer" | 128 bytes below the current stack pointer after an 88-byte `sub` |
| Shadow store treated as locals | Stack arguments at 8 to 32 | Microsoft stack arguments start at 40 |
| `lea` treated as a load | A stack argument at `0x60(%rsp)` in a variadic callee | `lea` computes `overflow_arg_area`; it loads nothing |
| Hidden pointer read as a normal argument | `big_ret(void *, long long)` | The pointer is stored through and copied to `rax`, `rax`, or stays in `x8` |
| Deepest CFA compared with the prologue frame | A mismatch on a caller that pushes outgoing arguments | Compare with the deepest stack pointer the body reaches |
| Convention asserted from the ISA | `amd64` for a COFF object | The format picks the rulebook, then the ISA picks the registers |
| Prototype trusted from one tool | Three doubles, or sixteen variadic parameters | The source signature or a second derivation must agree |

## Quy tắc hoạt động

Đọc tiêu đề trước hướng dẫn đầu tiên, và đặt tên sách quy tắc. Đặt mọi sổ đăng ký được lưu và mọi lập luận ở một vị trí bị trục xuất từ chỉ số entry stack, và kiểm tra nó với quy tắc đặt nó ở đó và với dữ liệu unwind mà trình biên dịch đã viết cho cùng khung.

## Đọc thêm

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Version 1.0 (sections 3.2.1 to 3.2.3, 4.2.4)](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Microsoft x64 calling convention](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention)
- [Microsoft x64 stack usage](https://learn.microsoft.com/en-us/cpp/build/stack-usage)
- [Microsoft x64 prolog and epilog](https://learn.microsoft.com/en-us/cpp/build/prolog-and-epilog)
- [Microsoft x64 exception handling: RUNTIME_FUNCTION, UNWIND_INFO, UNWIND_CODE](https://learn.microsoft.com/en-us/cpp/build/exception-handling-x64)
- [Arm Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), release 2025Q4](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Apple: Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [DWARF Debugging Information Format Version 5, section 6.4 Call Frame Information](https://dwarfstd.org/doc/DWARF5.pdf)
- [Clang driver frame-pointer defaults, `useFramePointerForTargetByDefault` in `CommonArgs.cpp`](https://github.com/llvm/llvm-project/blob/main/clang/lib/Driver/ToolChains/CommonArgs.cpp)
- [Clang command line reference: `-fomit-frame-pointer`, `-momit-leaf-frame-pointer`](https://clang.llvm.org/docs/ClangCommandLineReference.html)
- [Fedora 38 change: frame pointers by default](https://fedoraproject.org/wiki/Changes/fno-omit-frame-pointer)
- [Ubuntu 24.04: performance engineering with frame pointers by default](https://ubuntu.com/blog/ubuntu-performance-engineering-with-frame-pointers-by-default)
- [Ghidra compiler specification: `x86-64-gcc.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-gcc.cspec)
- [Ghidra compiler specification: `x86-64-win.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-win.cspec)
- [Ghidra compiler specification: `AARCH64.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/languages/AARCH64.cspec)
- [Hex-Rays: SetType and the `__usercall` convention](https://docs.hex-rays.com/ida-actions/settype)
- [Hex-Rays: Decompile as call](https://docs.hex-rays.com/ida-actions/hx_userdefinedcall)
- [Binary Ninja API 6.0: `callingconvention` module](https://api.binary.ninja/binaryninja.callingconvention-module.html)
- [Binary Ninja API 6.0: `platform` module](https://api.binary.ninja/binaryninja.platform-module.html)
- [Binary Ninja user documentation: platform types](https://docs.binary.ninja/guide/types/platformtypes.html)
- [The Official Radare2 Book: calling conventions](https://book.rada.re/analysis/calling_conventions.html)
- [The Official Radare2 Book: code analysis](https://book.rada.re/analysis/code_analysis.html)
- [angr documentation: decompiler analysis passes, including calling convention recovery](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)
- [rizin 0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
