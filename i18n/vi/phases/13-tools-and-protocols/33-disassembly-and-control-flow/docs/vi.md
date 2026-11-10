# Phong thể và kiểm soát dòng chảy: Từ các byte đến biểu đồ bạn có thể kiểm tra

> Một danh sách gỡ bỏ là một tuyên bố về các byte là hướng dẫn, và bài học này xây dựng bộ giải mã và biểu đồ kiểm tra tuyên bố.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch)
**Time:** ~150 minutes

## Mục tiêu học tập

- Các bộ phận hướng dẫn x86-64 trong các bộ phận sổ cái được giải mã từ các quy tắc trong tập 2 SDM Intel, Chương 2.
- Cố gắng chứng minh máy giải mã chống lại `llvm-objdump -d`về mọi mệnh lệnh của mọi công trình xây dựng.
- Thực hiện một quét tuyến tính và giảm ngược trên cùng một byte và giải thích nơi mỗi một sai.
- Cắt hướng dẫn thành các khối cơ bản và xây dựng biểu đồ kiểm soát dòng chảy với các cạnh được đánh dấu.
- Xét các kẻ thống trị ngay lập tức bằng thuật toán lặp lại của Cooper, Harvey và Kennedy, và tìm các vòng từ các cạnh sau.
- Khôi phục các mục tiêu của một nhảy gián tiếp từ các mục nhập di chuyển đó chỉ ra trên bàn của nó.

## Vấn đề

Anh đã biên soạn`ledger.c``-O0`và hỏi một đại lý gì `grade`Đại lý gọi một người giải thể, đọc danh sách, và trả lời rằng chức năng kết thúc trong `jmpq *%rax`Không có mục tiêu nào được biết đến.`return 0`- Tôi không biết.

Bạn mở ra cùng một vật thể trong `llvm-objdump -d`và nhìn thấy bốn khối sau khi nhảy mà cửa hàng 4, 3, 2 và 1. danh sách đã có chúng từ đầu. Không có gì trong danh sách nói cách thực thi đạt đến chúng, do đó công cụ coi chúng là mã chết.

Một danh sách chỉ trả lời một câu hỏi: nào tạo ra các lệnh nào. Nó không nói ra các lệnh chạy, theo thứ tự nào, hoặc từ đâu. Để trả lời chúng bạn cần thêm ba cấu trúc: các byte mà dòng điều khiển có thể đạt được, các khối cơ bản và các cạnh giữa chúng.

rea 6.5.0 không có máy giải thể riêng. Để phân tích sâu sắc, README của nó yêu cầu bạn mang Ghidra, Hopper, hoặc IDA. Để kiểm tra ngoài khơi, rea cũng có thể gọi một GNU objdump hoặc một Rizin mà bạn cài đặt. Hình đồ gọi của nó dừng lại ở các mục tiêu chưa được giải quyết: "Callers/callees chỉ chứa các chức năng được giải quyết.... Phòng chảy máy tính không có mục tiêu vẫn chưa được biết". Bài học này xây dựng phần tạo ra những sự thật đó, để bạn có thể đánh giá chúng khi một công cụ báo cáo chúng.

```figure
re-33-sweep-vs-descent
```

## Các định dạng hướng dẫn có một quy tắc cho mỗi trường

Intel SDM Volume 2, Hình 2-1 cho thấy thứ tự byte của mỗi hướng dẫn. Đầu tiên là các prefix tùy chọn, sau đó là một đến ba byte opcode, sau đó là một byte ModRM tùy chọn và một byte SIB tùy chọn. Một sự di chuyển 0, 1, 2 hoặc 4 byte tiếp theo, sau đó là ngay lập tức 0, 1, 2 hoặc 4 byte. Toàn bộ hướng dẫn là tối đa 15 byte (SDM 2.3.11). AMD APM Volume 3, Chương 1, Phần 1.1 đến 1.7 mô tả cùng một định dạng trong ít trang hơn và là một kiểm tra chéo tốt.

Mỗi trường quyết định nghĩa của trường tiếp theo. Vì vậy, một decoder là một chuỗi các quyết định nhỏ, và mỗi quyết định có một câu trong hướng dẫn đằng sau nó.

### Các tiền tố có thể được phân loại thành bốn nhóm

SDM 2.1.1 liệt kê các tiền tố cũ.`F0`khóa và các dấu tiền lặp lại `F2`và `F3`Nhóm 2 giữ sáu phân đoạn vượt trội (`2E`là `%cs`(v) và các gợi ý về ngành.`66`, kích thước operand. nhóm 4 là`67`, kích thước địa chỉ vượt qua.

Quyển hướng dẫn cho biết một tiền tố từ mỗi nhóm có thể được sử dụng.`ledger-x86_64-O0.o`trong sự bù đắp`0xf2`đọc `66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00`, 5 bản sao của `66`- Dòng nhau.`llvm-objdump`in nó như `nopw %cs:(%rax,%rax)`Và cũng như decoder bạn xây dựng. decoder thu thập mọi prefix byte nó thấy và hỏi sau đó những gì quan trọng.

`66`cho các hướng dẫn SSE nó là một tiền tố bắt buộc mà chọn mã op, vì vậy `66 0f ef c0`là `pxor %xmm0, %xmm0`và không phải là 16 bit gì cả.`F3 0f 6f`là `movdqu`. Decoder đầu tiên tìm kiếm cặp tiền tố bắt buộc và các byte opcode thứ hai. Chỉ khi cặp đó không có mục nào thì`66`nghĩa là một opera 16-bit.

### REX thêm bốn bit và phải ngồi bên cạnh mã op

SDM 2.2.1 định nghĩa REX là một byte từ `40`đến`4F`với hình dạng `0100WRXB`- `W`chọn một operand 64 bit. `R`mở rộng lĩnh vực quy định ModRM. `X`mở rộng trường chỉ số SIB. `B`mở rộng trường ModRM r/m, trường SIB cơ sở, hoặc sổ đăng ký trong byte opcode (Bảng 2-4). REX phải xuất hiện ngay trước opcode hoặc các byte thoát, và một REX sau đó là một prefix cũ bị bỏ qua.

Trong `48 89 e5`byte `48`REX có `W`Set. mã op `89`là `MOV r/m, r`, và ModRM `e5`chọn `%rsp`vào`%rbp`. Tắt REX và các byte tương tự là `movl %esp, %ebp`- Tôi không biết.

REX cũng thay đổi tên của các sổ đăng ký byte. Với bất kỳ REX hiện diện, mã hóa từ 4 đến 7 chọn `%spl`- `%bpl`- `%sil`, và`%dil`thay vì `%ah`- `%ch`- `%dh`, và`%bh`- Bộ giải mã giữ hai bàn vì lý do đó.

### Các mã hóa có thể được sử dụng trong hai bản đồ

Một mã op một byte là trường hợp phổ biến. `0F`thoát ra bản đồ hai byte, và `0F 38`hoặc `0F 3A`thoát ra các bản đồ ba byte mà các thiết bị không bao giờ sử dụng (SDM 2.1.2). Một số opcode sử dụng trường ModRM reg như ba bit opcode khác, được viết `/digit`trong hướng dẫn. `83 /7`là `cmp`với một 8-bit ngay lập tức, `83 /5`là `sub`, và`FF /4`là không liên quan`jmp`- Tôi không biết.

Bộ giải mã trong `code/main.py`bao gồm các mã opcode trong bốn vật thể cố định cộng với một vài hàng xóm.`mov`- `lea`- `movslq`- `movzbl`- `imul`, các phiên,`test`, và`idiv`Nó tiếp tục với`push`- `pop`- `call`- `ret`, 16 bước nhảy có điều kiện, nhiềubyte `nop`, và 5 mã opcode SSE2.`DecodeError`Một máy giải mã đoán là tệ hơn một máy dừng lại.

### ModRM và SIB chọn các operand

SDM 2.1.3 chia ModRM thành `mod`(bits 7:6), `reg`(5:3), và `r/m`(2:0). `mod = 11`nghĩa là r/m là một sổ đăng ký. `mod = 00`- `01`, và`10`Khoản bộ nhớ trung bình không có chuyển nhượng, chuyển nhượng 8 bit, hoặc chuyển nhượng 32 bit. `r/m = 100`nghĩa là một byte SIB tiếp theo.`scale`(7:6), `index`(5:3), và `base`(2: 0), và chỉ số của `100`nghĩa là không có sổ đăng ký chỉ mục.

Hai hàng đặc biệt trong bảng 2-2 có tính chất trong chế độ 64-bit. `mod = 00`với `r/m = 101`Không phải `(%rbp)`. Nó là một sự di chuyển 32 bit so với hướng dẫn tiếp theo (SDM 2.2.1.6). `mod = 00`với cơ sở SIB của `101`là một chuyển động 32 bit mà không có sổ đăng ký cơ sở.

Nhận đi`8d 44 08 fa`từ `grade``-O0`Mã op.`8D`là `lea`- ModRM`44`là `01 000 100`: một chuyển động 8 bit, reg `%eax`, và một SIB tiếp theo.`08`là `00 001 000`: quy mô 1, chỉ số `%rcx`, cơ sở`%rax`. Phân tích chuyển động`fa`là -6. Văn bản AT&T là `leal -0x6(%rax,%rcx), %eax`, tính toán`score / 10 - 6`, chỉ số chuyển đổi.

### Việc di chuyển là nơi biên tập liên kết viết

`48 8d 0d 00 00 00 00`là `leaq (%rip), %rcx`. bốn byte không là trường di chuyển của một operand tương quan RIP. Trong một đối tượng có thể di chuyển chúng là người giữ chỗ.`.rela.text`trong sự bù đắp`0x69`nói `R_X86_64_PC32.rodata-0x4`. PsABI (bảng 4.9) xác định `R_X86_64_PC32`như `S + A - P`: địa chỉ biểu tượng cộng thêm phụ lục trừ địa chỉ của trường.

Bộ xử lý thêm trường vào địa chỉ của hướng dẫn tiếp theo, do đó mục tiêu cuối cùng là `S + A + (end - P)`- Vì cái này`lea`trường là bốn byte cuối cùng, vì vậy `end - P`là 4 và mục tiêu là `.rodata + (-4) + 4 =.rodata + 0x0`- 4 bổ sung bù đắp cho bốn byte trước. mỗi RIP tương quan operand trong các thiết bị có -4 này bên trong bổ sung của nó, do đó`.rodata+0x10`trên `-O1` `lea`- Ý nghĩa`.rodata+0x14`- Tôi không biết.

Bộ giải mã ghi lại sự thay thế của trường di chuyển bên trong mỗi hướng dẫn. `resolve_reference()`nhìn được bù đắp trong bảng chuyển đổi và báo cáo nơi mà các operand sẽ chỉ sau khi kết nối.`leaq (%rip), %rcx`vào bàn ở`.rodata+0x0`"Điều này là không thể.

### Các điểm ngay là 32 bit tối đa, với một ngoại lệ

SDM 2.2.1.5 nói rằng ngay lập tức ở lại tối đa 32 bit trong chế độ 64-bit và được mở rộng bằng dấu hiệu.`MOV r64, imm64`(`B8+r`với `REX.W`), mà AT&T gọi là cú pháp `movabsq`. Decoder đọc 8 bit ngay lập tức như ký kết cho toán học (`83 c1 fa`là `addl $-0x6, %ecx`) và không được ký hiệu cho số lượng thay đổi và chọn trộn (`pshufd $0xee`Đó là chia hợp với cái gì?`llvm-objdump`- Nhìn vân tay.

Gần các nhánh,`push`, và`pop`mặc định cho một hệ điều hành 64 bit và bỏ qua `66`(SDM 2.2.1.7). Đó là lý do tại sao decoder đặt tên cho chúng `pushq`- `popq`- `callq`, và`retq`mà không đọc một chữ trước kích thước opera.

## Tự giải mã một hướng dẫn bằng tay

Trước khi tin vào mã, hãy giải mã `48 69 c0 67 66 66 66`từ `grade`trên giấy.

1. `48`là trong `40`đến`4F`, nên nó là REX với `W = 1`- Kích thước của opera là 64 bit.
2. `69`là `IMUL r, r/m, imm32`- Tôi không biết.
3. `c0`là ModRM `11 000 000`: mẫu đăng ký, quy định`%rax`, r/m `%rax`- Tôi không biết.
4. Bốn byte tiếp theo là ngay lập tức, nhỏ-endian:`0x66666667`- Tôi không biết.
5. AT&T đặt hàng là ngay lập tức, nguồn, đích: `imulq $0x66666667, %rax, %rax`- Tôi không biết.

Đó là bảy byte, và `llvm-objdump`Bền định là tương đối cho phép clang chia bằng 10 với một nhân và `sarq $0x22`Điều tiếp theo, thay đổi bằng 34, bạn sẽ gặp lại cặp đó trong bài học 34, nơi người nâng biến nó trở lại thành`score / 10`- Tôi không biết.

Bộ giải mã làm 5 bước này trong `Decoder.decode()`- `_State.modrm()`, và`_State.finish()`Đọc chúng theo thứ tự đó và kết hợp từng nhánh với phần SDM được đặt tên trong chuỗi tài liệu của nó.

## Đánh sạch tuyến tính

Schwarz, Debray và Andrews mô tả việc lau đường trong Phần 3.1 của "Vô thể tháo gỡ mã thực thi được xem xét" (WCRE 2002). Bắt đầu từ byte đầu tiên của phần mã, giải mã một hướng dẫn, tiếp tục tại byte sau đó, và dừng lại ở cuối. `objdump`làm việc theo cách này, và cũng như `llvm-objdump`- Tôi không biết.

```python
def linear_sweep(code: bytes, start: int = 0, end: int | None = None) -> SweepResult:
    position = start
    while position < end:
        try:
            instruction = decode(code[:end], position)
        except DecodeError:
            undecodable.append((position, code[position]))
            position += 1
            continue
        instructions.append(instruction)
        position = instruction.end
```

Phương pháp có một chế độ thất bại, và hình 1 của giấy cho thấy nó. Các byte là dữ liệu được giải mã như là hướng dẫn, và máy giải mã sau đó bỏ lỡ ranh giới hướng dẫn thực sự trong một thời gian. Trên x86, bộ giải mã thường đồng bộ hóa lại trong vòng vài byte, đó là điều khiến lỗi khó nhìn thấy. Việc phát hiện chỉ xảy ra trên một mã op không hợp lệ, và kết luận của báo cáo là các thuật toán này "làm lặng lẽ thất bại".

Việc lau cũng là lời tiên tri cho bài học này.`llvm-objdump -d`về mọi hướng dẫn của mọi thứ, và`llvm-objdump`bản thân là một đường thẳng.`code/fixtures/*.objdump.txt`. Thử nghiệm phân tích từng dòng thành địa chỉ, byte và văn bản, bỏ các bình luận sau `#`Bốn vật có 86 , 56 , 84 và 11 hướng dẫn, tổng cộng là 237 , và decoder phù hợp với tất cả chúng.

## Sự giảm dần

Phần 3.2 của cùng một bài báo gọi phương pháp thứ hai là đi qua nối tiếp. Bắt đầu tại một điểm nhập được biết và giải mã cho đến khi chuyển giao kiểm soát. Đối với một nhảy trực tiếp, tiếp tục tại mục tiêu. Đối với một nhánh có điều kiện, tiếp tục ở cả mục tiêu và hướng dẫn tiếp theo, và cho một cuộc gọi, tiếp tục sau đó, vì người gọi trả lại. Đối với một trở lại, dừng lại. Giữ một bộ địa chỉ được truy cập để bước đi kết thúc.

```python
if instruction.flow == "branch":
    worklist.append(instruction.target)
    address = instruction.end
elif instruction.flow == "indirect-jump":
    table = resolver(instruction, instructions) if resolver else None
    if table is None:
        unresolved.append(instruction)
        break
```

Phương thức thất bại là ngược lại. Một nhảy gián tiếp không có mục tiêu trong các byte của nó. Đi bộ dừng lại ở đó, và mỗi khối chỉ đạt được thông qua nhảy vẫn không được biết. Hình 2 của giấy cho thấy một nguy cơ thứ hai: một tập mục tiêu bắt nguồn từ việc di chuyển hướng đến giữa một hướng dẫn.`main.py`ghi lại trường hợp đó như là một xung đột và ngăn chặn con đường đó, vì vậy sự chồng chéo được nhìn thấy thay vì lặng lẽ giải mã hai lần.

Andriesse và những người khác đo chín bộ sụp đổ trên 981 bộ nhị phân được tạo bởi trình biên dịch (USENIX Security 2016). Dữ liệu trong đường và mã chồng chéo ít hơn trong đầu ra trình biên dịch thực tế so với các tài liệu giả định, và nguyên thủy cứng là phục hồi biên giới chức năng. Hãy nhớ cả hai phát hiện. Trạm trong phần tiếp theo là hiếm trong đầu ra trình biên dịch.`grade`là phổ biến.

## Một khu vực mà việc lau đi sai và hạ xuống đúng

`code/fixtures/sweep-trap.s`là 24 byte của tập hợp bằng tay với một bảng bốn byte bên trong cơ thể hàm.`movzbl (%rcx,%rax), %eax`và nhảy qua nó.

```asm
lookup:
        movslq  %edi, %rax
        leaq    .Ltable(%rip), %rcx
        movzbl  (%rcx,%rax), %eax
        jmp     .Ldone
.Ltable:
        .byte   0x31, 0xc0, 0x90, 0x48
.Ldone:
        addl    $1, %eax
        retq
```

Hãy xây dựng nó với `clang -target x86_64-unknown-linux-gnu -c sweep-trap.s`Bốn byte bảng được chọn để giải mã như là hướng dẫn hợp lý.`31 c0`là `xorl %eax, %eax`- `90`là `nop`- `48`là một chữ trước REX, vì vậy, việc quét kết hợp nó với ba byte của thực`addl $1, %eax`và dấu vân tay`addq $0x1, %rax`- Những kẻ bị bắt`llvm-objdump`đầu ra cho thấy chính xác rằng:

```text
       e: eb 04                        	jmp	0x14 <lookup+0x14>
      10: 31 c0                        	xorl	%eax, %eax
      12: 90                           	nop
      13: 48 83 c0 01                  	addq	$0x1, %rax
      17: c3                           	retq
```

Không có gì trong danh sách này trông bị hỏng.`retq`- Đăng ký vẫn sai 3 cách.`0xe`mục tiêu`0x14`, và không có hướng dẫn nào trong danh sách bắt đầu từ `0x14`- Chỉ dẫn chạy ở`0x14`là 32 bit `addl`, và danh sách cho thấy một 64-bit `addq`4 byte bảng xuất hiện như mã.

Sự giảm dần từ `lookup`biểu tượng giải mã sáu hướng dẫn, sau khi nhảy đến `0x14`, và báo cáo `addl $0x1, %eax`Nó không yêu cầu bất kỳ 4 byte bảng và không có 8 byte bọc trước đây .`plus_one`- `trap_report()`trong `main.py`in so sánh:

```json
"linearSweep": {
  "instructions": 9,
  "atJumpTarget": {"starts": "0x13", "text": "addq\t$0x1, %rax", "startsAtTarget": false},
  "claimedDataBytes": 4,
  "claimedPaddingBytes": 8
},
"recursiveDescent": {
  "instructions": 6,
  "atJumpTarget": "addl\t$0x1, %eax",
  "claimedDataBytes": 0,
  "claimedPaddingBytes": 0
}
```

Thử nghiệm`test_sweep_and_objdump_share_the_same_mistake`khẳng định điều đó `llvm-objdump`in `addq $0x1, %rax``0x13`- Oracle là một quét tuyến tính và thừa hưởng điểm mù của nó.

## Các khối cơ bản

Allen xác định khối cơ bản trong "Control Flow Analysis" (1970). Nó là một chuỗi các hướng dẫn chỉ được nhập vào chỉ tại hướng dẫn đầu tiên và chỉ để lại ở cuối cùng. Yakdan và những người khác tái lập nó để phân tích trong Phần II.A.2 của "No More Gotos" (NDSS 2015), với nút tiêu đề như mục nhập chức năng.

Việc xây dựng là quét hai bước qua các hướng dẫn được giải mã, được sắp xếp theo địa chỉ. Quét đầu tiên thu thập các nhà lãnh đạo. Một nhà lãnh đạo là mục tiêu nhập, một nhánh hoặc nhảy mục tiêu, một mục tiêu bàn hoặc hướng dẫn sau bất kỳ chuyển giao kiểm soát nào. Quét thứ hai bắt đầu một khối mới tại mỗi nhà lãnh đạo và tại mỗi khoảng trống trong chuỗi địa chỉ.

```python
for instruction in self.instructions:
    if instruction.address in leaders or current is None or current.end != instruction.address:
        current = Block(instruction.address, [])
        self.blocks[instruction.address] = current
    current.instructions.append(instruction)
```

Các cạnh theo dõi từ hướng dẫn cuối cùng của mỗi khối. Một trở lại không có người kế nhiệm. Một nhảy có một, được đánh dấu `jump`Một nhánh có điều kiện có hai, được đánh dấu`taken`và `fallthrough`. Một hướng dẫn đơn giản ở cuối một khối rơi qua đến khối tiếp theo, xảy ra khi hướng dẫn tiếp theo là một mục tiêu nhánh.`table`, hoặc không có, và khối được ghi lại trong `unresolved`- Tôi không biết.

Hai sự thật khác xuất hiện từ cùng một quét. Một khối mà không thể đạt được nhập cảnh là không thể đạt được, và lau qua.`grade``-O0`Một khối có địa chỉ bắt đầu nằm trong một hướng dẫn của danh sách phương pháp khác là trường hợp chồng chéo từ cái bẫy.

## Chữ đồ thị kiểm soát dòng chảy tổng

`total``-O1`là 31 byte và 13 hướng dẫn:

```text
      40: 85 f6                        	testl	%esi, %esi
      42: 7e 18                        	jle	0x5c <total+0x1c>
      44: 89 f1                        	movl	%esi, %ecx
      46: 31 d2                        	xorl	%edx, %edx
      48: 31 c0                        	xorl	%eax, %eax
      4a: 66 0f 1f 44 00 00            	nopw	(%rax,%rax)
      50: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
      53: 48 ff c2                     	incq	%rdx
      56: 48 39 d1                     	cmpq	%rdx, %rcx
      59: 75 f5                        	jne	0x50 <total+0x10>
      5b: c3                           	retq
      5c: 31 c0                        	xorl	%eax, %eax
      5e: c3                           	retq
```

Các nhà lãnh đạo là`0x40`(trình nhập),`0x44`(sau khi `jle`), `0x50`(Mục tiêu của `jne`), `0x5b`(sau khi `jne`), và `0x5c`(Mục tiêu của `jle`5 khối, 5 cạnh:

| From | To | Kind | Why |
|---|---|---|---|
| `0x40` | `0x44` | fallthrough | `jle` not taken, count is positive |
| `0x40` | `0x5c` | taken | count is zero or negative, return 0 |
| `0x44` | `0x50` | fallthrough | the `nopw` is alignment inside the block, execution passes through it |
| `0x50` | `0x50` | taken | `jne 0x50`, the loop |
| `0x50` | `0x5b` | fallthrough | loop exit, return the sum |

6 byte `nopw``0x4a`là lấp để vòng lặp đầu vào `0x50`Nó nằm trên một ranh giới 16 byte. Nó có thể tiếp cận, vì vậy nó thuộc về khối`0x44`- Một-byte`nop``0x5f`sau lần cuối cùng `retq`cũng là nạp, và không có gì đạt đến nó.`unreachable()`- Đặt nó lên danh sách.

Tại `-O2`cùng một hàm là 140 byte với hai vòng tròn.`0x80`thêm tám giá trị cho mỗi lần đi qua với `paddd`, và phần còn lại của scalar chạy ở `0xc0`CFG có hai cạnh sau,`0x80 -> 0x80`và `0xc0 -> 0xc0`, và phòng kiểm tra kiểm tra cả hai.

## Các nhà thống trị với thuật toán lặp lại

Một khối`d`thống trị một khối `b`Khi mọi con đường từ lối vào đến `b`đi qua `d`. người thống trị ngay lập tức của `b`là chủ quyền của `b`Đó là gần nhất với `b`Ý tưởng này bắt đầu từ Prosser (1959) đến Allen (1970), và đó là cấu trúc mà bài học 34 cần đặt `if`và `while`đúng rồi.

Cooper, Harvey và Kennedy đã viết "A Simple, Fast Dominance Algorithm" (2001). Họ lập luận rằng định dạng lưu lượng dữ liệu, chạy theo thứ tự hậu ngược với biểu tượng nhỏ gọn, đánh bại Lengauer-Tarjan (1979) trên biểu đồ dưới khoảng một ngàn nút. Bài báo của họ nói mục đích của nó là "không trình bày một thuật toán mới". Nó cho thấy rằng các thuật toán đơn giản có thể chiến thắng trong thực tế và là công cụ giảng dạy tốt. Một chức năng CFG hầu như không bao giờ có một ngàn nút.

```python
def intersect(first: int, second: int) -> int:
    while first != second:
        while number[first] > number[second]:
            first = idom[first]
        while number[second] > number[first]:
            second = idom[second]
    return first

changed = True
while changed:
    changed = False
    for start in order[1:]:
        processed = [p for p in self.predecessors(start) if p in idom]
        candidate = processed[0]
        for other in processed[1:]:
            candidate = intersect(other, candidate)
        if idom.get(start) != candidate:
            idom[start] = candidate
            changed = True
```

`number`giữ vị trí hậu trật tự ngược của mỗi khối, với mục nhập ở 0. `intersect`và nó đi hai ngón tay lên cây chủ quyền hiện tại cho đến khi chúng gặp nhau.`<`Mã này sử dụng số hậu lệnh ngược, do đó so sánh là `>`Mọi thứ khác đều theo mã giả của tờ báo.

Vì `total``-O1`Kết quả là `idom(0x44) = 0x40`- `idom(0x50) = 0x44`- `idom(0x5b) = 0x50`, và`idom(0x5c) = 0x40`- Lề cạnh`0x50 -> 0x50`là một cạnh sau vì mục tiêu của nó thống trị nguồn của nó, và một cạnh sau đánh dấu một vòng lặp (Allen 1970). `back_edges()`- Thử nghiệm.`test_dominators_on_a_hand_built_diamond_with_a_loop`chạy cùng một mã trên một chuỗi 16 byte với một điểm kết nối, vì vậy `intersect`thấy hai người tiền nhiệm.

## Bảng nhảy ở điểm -O0

Tại `-O0`clang biên soạn các `switch`trong `grade`cho ngôn ngữ nhảy bảng độc lập vị trí:

```text
      5d: 83 e8 04                     	subl	$0x4, %eax
      60: 77 38                        	ja	0x9a <grade+0x6a>
      62: 48 8b 45 f0                  	movq	-0x10(%rbp), %rax
      66: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000069:  R_X86_64_PC32	.rodata-0x4
      6d: 48 63 04 81                  	movslq	(%rcx,%rax,4), %rax
      71: 48 01 c8                     	addq	%rcx, %rax
      74: ff e0                        	jmpq	*%rax
```

Hãy đọc nó như bốn sự thật.`subl $0x4`tiếp theo là `ja`là kiểm tra giới hạn: chỉ số trên 4 đi đến trường hợp mặc định tại `0x9a`, vậy bảng có năm mục.`leaq`khi chuyển chỗ của nó đặt địa chỉ bảng trong `%rcx`, và phần trước đã cho thấy địa chỉ đó là `.rodata+0x0`- `movslq`tải một mục 32 bit được ký kết được quy mô bằng 4. `addq`thêm cơ sở bảng, do đó mỗi mục là khoảng cách từ bảng đến khối trường hợp của nó.

Trong tệp đối tượng mỗi byte bảng là không.`.rela.rodata`- Có thể là:

```text
RELOCATION RECORDS FOR [.rodata]:
OFFSET           TYPE                     VALUE
0000000000000000 R_X86_64_PC32            .text+0x91
0000000000000004 R_X86_64_PC32            .text+0x8c
0000000000000008 R_X86_64_PC32            .text+0x87
000000000000000c R_X86_64_PC32            .text+0x82
0000000000000010 R_X86_64_PC32            .text+0x86
```

Đơn `S + A - P`vào `k`trong sự bù đắp`4k`Giá trị lưu trữ là `.text + A - (.rodata + 4k)`, và mã này thêm `.rodata + 0`đến nó, vì vậy mục tiêu là `.text + A - 4k`. Nhập 0 là `0x91 - 0 = 0x91`, mục 1 là `0x8c - 4 = 0x88`, và mục 2 là `0x87 - 8 = 0x7f`. Nhận mục 3 và 4 là `0x82 - 12 = 0x76`và `0x86 - 16 = 0x76`Các trường hợp 6, 7, 8, 9 và 10 của`score / 10`đi đến các khối lưu trữ 1, 2, 3, 4 và 4. Điều đó phù hợp với dòng nguồn C cho dòng, bao gồm cả trường hợp chia sẻ cho 9 và 10.

`recover_table()`làm toán học này.`jump_table_resolver()`phù hợp với ngôn ngữ ngược lại từ `jmpq`Nó tìm thấy `addq`Đó là những gì đã làm ra sổ cái,`movslq`người đã tải nó, `leaq`Đó là nền tảng và đường biên giới.`ja`. Sự giảm sau đó đẩy bốn mục tiêu khác nhau và tiếp tục. Một trình thực liên kết có giá trị cuối cùng trong bảng và không có di chuyển.`evidence`ghi lại con đường tạo ra các mục tiêu.

Số cho `grade``-O0`, từ `python3 code/main.py cfg code/fixtures/ledger-x86_64-O0.o grade`- Có thể là:

| Method | Instructions | Blocks | Edges | Bytes | What is wrong |
|---|---|---|---|---|---|
| linear sweep | 34 | 9 | 7 | 118 code + 10 padding | 5 unreachable blocks, no edge into the four case blocks, padding decoded as `nopw` |
| recursive descent | 25 | 3 | 2 | 82 code | 36 code bytes never reached, `jmpq *%rax` at `0x74` unresolved |
| descent with the table | 33 | 8 | 11 | 118 code | nothing |

Với bàn, cây thống trị đã hoàn thành.`idom`của mỗi khối trường hợp là `0x62`, khối với nhảy.`idom`của `0xa1`là mục nhập `0x30`, bởi vì đường mặc định từ `0x9a`đạt tới `0xa1`Không đi qua `0x62`- Tôi không biết.

## Điều mà Optimizer đã làm để đánh giá ở -O1

Anh sẽ thấy`grade`được mô tả là một chuyển đổi mà tập hợp đến một bảng nhảy.`-O1`và `-O2`không có nhảy gián tiếp `grade`Không có:

```text
      2c: 83 f9 04                     	cmpl	$0x4, %ecx
      2f: 77 0c                        	ja	0x3d <grade+0x2d>
      31: 89 c8                        	movl	%ecx, %eax
      33: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000036:  R_X86_64_PC32	.rodata+0x10
      3a: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      3d: c3                           	retq
```

Thêm vào việc di chuyển`0x10`cộng với 4 bình thường đặt bàn ở `.rodata+0x14`- Lái là một bình thường`movl`, và các byte có`01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 04 00 00 00`. Bộ biên dịch thay thế năm khối trường hợp bằng một bảng của năm giá trị trả lại. Có một di chuyển, một bảng và kiểm tra giới hạn.`find_value_tables()`báo cáo như là `value-table`với các mục `[1, 2, 3, 4, 4]`và `evidence: "bytes"`- Tôi không biết.

`grade_label``-O2`đi một bước xa hơn.`labels`array của năm chỉ dẫn chuỗi trở thành một bảng của năm 32 bit offsets tại `.rodata+0x0`Mỗi mục có một `R_X86_64_PC32`di chuyển đối với phần chuỗi, và hàm này thêm địa chỉ bảng vào mục nó tải. `recover_table()`đọc được 5 chuyển nhượng và trả lại bù đắp `0, 2, 4, 6, 8`vào`.rodata.str1.1`, giữ được `F`- `D`- `C`- `B`, và`A`. cùng một toán học phục hồi một bảng nhảy phục hồi một bảng dữ liệu tương đối, bởi vì cả hai là `S + A - P`Một thời gian đáng kể.

Bài học từ hai build là đặt tên cho những gì các byte hiển thị. Một bảng nhảy thay đổi biểu đồ lưu lượng điều khiển. Một bảng giá trị thay đổi tải trọng. gọi cả hai "switch" che giấu sự khác biệt mà bài học 34 phải tái cấu trúc.

## Những gì Rea và Ghidra cho bạn ở đây

rea 6.5.0 với nhà cung cấp Ghidra 12.1.4 trả lại văn bản danh sách của một hàm từ `procedure_assembly`như một dây. `inspect_native_instruction`trả về các byte, chiều dài, văn bản decoder, mã hiệu operand, tham chiếu được gõ và dòng chảy của một hướng dẫn, với trả về được phân loại từ mã p. `xrefs`trả lại các địa chỉ nguồn độc đáo được sắp xếp từ Ghidra `ReferenceManager.getReferencesTo`- `analyze_function`mang CFG và `body`của chức năng. `procedure_info`đưa ra cơ quan như các phạm vi bao gồm và cảnh báo rằng "Các khoảng trống và đuôi chia sẻ không được coi là các byte sở hữu".

Mỗi một trong những sự kiện đó là Ghidra trở lại dòng dõi cộng với các phân tích của nó, được phân tích theo thứ tự.`instruction_flow_evidence`- `function_references`, và`jump_table_evidence`Khi Ghidra không tìm thấy bảng, dòng chảy là "không biết", và các khối trường hợp bị thiếu trong người gọi, gọi và CFG.

Giờ thì anh có công việc rồi.`python3 code/main.py cfg`trên cùng một đối tượng và so sánh bắt đầu khối, đếm cạnh, và bảng được phục hồi với những gì nhà cung cấp trả lại. nơi họ đồng ý bạn có hai dẫn xuất độc lập. nơi họ khác nhau bạn có một địa chỉ cụ thể để xem, đó là những gì bài học 35 ghi nhận như là một người không biết.

Một ghi chú về bộ giải mã như một chương trình. Capstone 6.0.0-Alpha10 (2026-07-21) cố định ngoài biên giới đọc và viết dưới CVE-2026-55893 và CVE-2026-55894, và 5.0.9 (2026-05-28) CVE sửa đổi sao lưu. Một bộ giải mã đọc các byte nó không viết. giới hạn 15-byte, kiểm tra cắt giảm trong `_Cursor.byte()`, và từ chối đoán một mã opcode không rõ bảo vệ `main.py`từ đầu vào nó không được xây dựng cho.

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
```

Các kết quả là một báo cáo JSON. Đối với mỗi đối tượng cố định nó cung cấp sự đồng thuận của Oracle. Đối với mỗi chức năng nó cung cấp hướng dẫn, khối và cạnh đếm theo ba phương pháp. Nó cũng liệt kê các khối không thể đạt được, nhảy gián tiếp chưa được giải quyết, cạnh sau, các chủ quyền ngay lập tức, và bất kỳ bảng nào. Nó kết thúc với so sánh bẫy.

Hình dạng dự kiến:

```json
{
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "oracle": "86/86 instructions agree with llvm-objdump",
      "functions": {
        "grade": {
          "range": "0x30-0xa6",
          "paddingBytes": 10,
          "linearSweep": {"instructions": 34, "blocks": 9, "edges": 7, "unreachableBlocks": ["0x76", "0x7f", "0x88", "0x91", "0xa6"], "...": "..."},
          "recursiveDescent": {"instructions": 25, "blocks": 3, "edges": 2, "unresolvedIndirectJumps": ["0x74"], "...": "..."},
          "recursiveDescentWithTables": {"instructions": 33, "blocks": 8, "edges": 11, "...": "..."},
          "tables": [{"kind": "jump-table", "table": ".rodata+0x0", "count": 5, "entries": ["0x91", "0x88", "0x7f", "0x76", "0x76"], "evidence": "relocation", "...": "..."}]
        }
      }
    }
  },
  "sweepTrap": {"...": "..."}
}
```

Đọc `code/main.py`theo thứ tự này:

1. `ElfObject`đọc tiêu đề phần, biểu tượng, và `.rela.*`Các mục, và `symbolize()`đặt tên địa chỉ đường `llvm-objdump`- Không.
2. `Decoder.decode()`đọc tiền đề và REX, sau đó gửi trên bản đồ opcode một-byte hoặc hai-byte.
3. `_State.modrm()`đọc ModRM, SIB, và sự di chuyển, và ghi lại sự di chuyển của trường di chuyển.
4. `resolve_reference()`áp dụng `S + A - P`đến việc di dời trên một khu vực di dời hoặc khu vực gần đó.
5. `linear_sweep()`và `recursive_descent()`là hai phương pháp, mỗi phương pháp đều có lỗi ghi nhận.
6. `recover_table()`và `jump_table_resolver()`đọc một bảng thông qua các chuyển nhượng hoặc các byte của nó.
7. `ControlFlowGraph`xây dựng các nhà lãnh đạo, khối, và cạnh đánh dấu, và `dominators()`là thuật toán lặp lại.
8. `analyze_function()`chạy tất cả các phương pháp trên một hàm và `compare_with_oracle()`kiểm tra máy giải mã.

Có hai lệnh nữa.`python3 code/main.py disasm FILE.o`in một danh sách với mục tiêu di chuyển sau mỗi hướng dẫn có một. `python3 code/main.py cfg FILE.o FUNCTION`in phân tích của một hàm.

## Sử dụng nó

Sử dụng ba phương pháp theo thứ tự này cho một đối tượng mới.

1. Hãy thử so sánh Oracle trước.`llvm-objdump`trên một hướng dẫn đơn giản có một lỗi, và mọi cấu trúc sau đó thừa kế nó.
2. Chạy sự giảm ngược từ mỗi biểu tượng hàm và đọc `unresolved`Mỗi mục nhập là một cuộc gọi không liên quan mà mục tiêu của bạn không có.
3. Đối với mỗi bước nhảy chưa được giải quyết, hãy tìm kiếm ngôn ngữ bảng và di chuyển hướng về nó. Nếu ngôn ngữ không phù hợp, hãy đọc các byte trước khi nhảy và ghi lại những gì bạn thấy.
4. So sánh các bộ sơn và các bộ sơn giảm đi bằng một bộ sơn. các bộ sơn mà chỉ có các bộ sơn yêu cầu là bộ sơn hoặc dữ liệu. các bộ sơn mà không yêu cầu là không thể đạt được hoặc thuộc về một chức năng mà bạn không tìm thấy.
5. Xây dựng CFG từ khi xuống với các bảng được phục hồi và đọc các cạnh phía sau.`while`hoặc `for`- Tôi không biết.

Giữ các tệp văn bản Oracle với các đối tượng. Khi bạn chuyển sang phiên bản biên dịch mới, lấy lại chúng, bởi vì một danh sách thay đổi là một vật cố định thay đổi.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: giải mã trên giấy, sau đó kiểm tra

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow/code
python3 -q
```

Đi chạy:

```python
from main import *
decode(bytes.fromhex("48 8d 0d 00 00 00 00"), 0).text
decode(bytes.fromhex("8d 44 08 fa"), 0).text
decode(bytes.fromhex("66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00"), 0).length
```

Viết ra những gì bạn mong đợi trước mỗi cuộc gọi.`48`từ đầu tiên và xem kích thước của operand thay đổi.`decode(bytes.fromhex("0f 0a"), 0)`và đọc `DecodeError`- Tôi không biết.

### Phòng thí nghiệm B: việc di chuyển trên một

```python
elf = load_fixture("ledger-x86_64-O0.o")
code = elf.section(".text").data
lea = decode(code, 0x66)
lea.displacement_offset
resolve_reference(elf, lea)
```

Bản tham khảo nói:`.rodata+0x0`Thay đổi địa chỉ thành `0x116`trong `grade_label`và đọc tham chiếu vào `.data`Rồi hãy giải mã `callq``0x10e`Và giải quyết nó.`R_X86_64_PLT32 grade-0x4`, và mục tiêu được giải quyết là `0x30`, đó là `grade`- Tôi không biết.

### Phòng thí nghiệm C: xem hai phương pháp không đồng ý

```python
trap = load_fixture("sweep-trap.o")
text = trap.section(".text").data
[i.text for i in linear_sweep(text, 0, 0x20).instructions]
[i.text for i in recursive_descent(text, [0], 0x20).sorted_instructions()]
```

Đếm các hướng dẫn trong mỗi danh sách và tìm cái bắt đầu từ `0x13`Sau đó thay đổi byte cuối cùng trong bảng`sweep-trap.s`từ `0x48`đến`0xe8`, xây dựng lại, và chạy cả hai lần nữa.`addl`và `retq`vào một `callq`với một mục tiêu bên ngoài phần.

### Phòng thí nghiệm D: các kẻ thống trị bằng tay

```python
analysis = analyze_function(load_fixture("ledger-x86_64-O1.o"), "total")
analysis.cfg.edges
analysis.cfg.reverse_postorder()
analysis.cfg.dominators()
analysis.cfg.back_edges()
```

Chụp 5 khối trên giấy và tính toán các nhà thống trị trước khi bạn nhìn vào kết quả.`grade``-O0`và giải thích tại sao `idom(0xa1)`là `0x30`Và không`0x62`- Tôi không biết.

## Phòng thí nghiệm thực hành

Thêm một vị trí gọi gián tiếp vào các thiết bị và mở rộng phân tích.

Yêu cầu:

- Viết một hàm C gọi qua một chỉ số hàm được chọn từ một mảng nhỏ.`-O0`và `-O1`và bắt buộc các đối tượng với họ `llvm-objdump`- Thư.
- Làm cho bộ giải mã phù hợp với Oracle trên cả hai đối tượng.
- Tăng `recursive_descent()`Vì vậy, một cuộc gọi gián tiếp ghi lại vị trí cuộc gọi trong `calls`với `None`như mục tiêu và tiếp tục theo đuổi nó.
- Viết một giải pháp đọc các hàm chỉ số dãy thông qua các di chuyển của nó và báo cáo các calles có thể.
- Thêm các thiết lập callie vào báo cáo chức năng như `indirectCalls`với loại bằng chứng cho mỗi mục tiêu.
- Viết một bài kiểm tra thất bại khi giải quyết trả lại một mục tiêu không phải là biểu tượng hàm.

Thành công là nghĩa của`python3 code/main.py cfg`đặt tên cho mọi người có thể gọi với việc di chuyển chứng minh nó, và sự so sánh của Oracle vẫn truyền trên mọi đối tượng.

## Phòng thí nghiệm được xếp hạng

Năm câu hỏi về các thiết bị của bài học này. Tìm mỗi câu trả lời với mã bạn xây dựng, sau đó viết nó vào `code/lab_answers.json`. Viết số như số hoặc như chuỗi hex như `"0x40"`, và danh sách như danh sách JSON.

1. `t1`: hướng dẫn cho phép giảm giảm thu hồi giải mã ở mức -O1.
2. `t2`: tổng số khối cơ bản ở -O1.
3. `t3`: địa chỉ của đầu vòng tròn tổng cộng ở -O1, như hex.
4. `t4`: trong sweep-trap.o, địa chỉ nơi hướng dẫn trôi qua tuyến tính bao gồm 0x14 bắt đầu, như hex.
5. `t5`: các mục trong bảng nhảy của điểm ở -O0.

Hãy kiểm tra câu trả lời của bạn:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/lab.py
npx tsx code/lab.ts
```

Người kiểm tra tính toán mỗi giá trị dự kiến từ `code/main.py`trên các thiết bị đã được thực hiện.`PASS`- `FAIL`hoặc `TODO`cho mỗi nhiệm vụ và điểm số, và nó chỉ thoát khỏi 0 khi tất cả năm vượt qua. `python3 code/lab.py my-answers.json`kiểm tra một tập tin khác. `code/tests/test_lab.py`chứng minh rằng người kiểm tra chấp nhận câu trả lời đúng và từ chối câu trả lời sai.

### Xem nó chạy

- [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?program=trap&sweep=linear)Máy chạy bài học này như chiếc giường và bảng khối của nó.`sweep-trap.o`với xoáy tuyến tính: giường cho thấy bốn byte dữ liệu được giải mã như mã, và một pin đánh dấu mục tiêu nhảy ở `0x14`bên trong `addq``0x13`- Đổi máy giải mã xuống để nhìn thấy sự nhảy bỏ qua dữ liệu.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-disassembly-and-control-flow.md`Sử dụng nó để biến một đối tượng và một tên chức năng thành một danh sách được kiểm tra, khối, cạnh được gõ, chủ quyền, và mọi chuyển giao chưa được giải quyết. Nó đòi hỏi một so sánh Oracle, cả hai phương pháp giải thể, kế toán byte, bằng chứng di chuyển cho mỗi bảng được phục hồi, và một tuyên bố về những gì vẫn còn không rõ.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

Việc kiểm tra phải chứng minh:

- decoder đồng ý với `llvm-objdump -d`trên tất cả 237 hướng dẫn của bốn vật thể cố định
- REX.W chọn các operand 64-bit và REX.R và REX.B mở rộng các trường đăng ký
- ModRM và SIB rendering bộ nhớ AT&T, bao gồm quy mô, chỉ mục và chuyển đổi ký hiệu
- Một chuyển động tương quan RIP được ghi lại với sự thay thế trường của nó bên trong hướng dẫn
- lặp đi lặp lại tiền đề thừa kế và một đoạn mã bỏ qua như Oracle
- một yêu cầu bắt buộc `66`Prefix chọn mã opcode SSE và để lại các sổ đăng ký 32-bit
- 8-bit ngay lập tức là chữ ký mở rộng cho toán học và không chữ ký cho số lượng chuyển tiếp
- một hướng dẫn trên 15 byte, một hướng dẫn cắt ngắn, và một mã opcode không rõ tăng `DecodeError`
- `R_X86_64_PC32`trên một `lea`giải quyết cho bàn và `R_X86_64_PLT32`trên một `call`giải quyết cho người gọi
- Screep giải mã bảng bẫy như là mã và không có hướng dẫn tại mục tiêu nhảy
- Thì, khi đi xuống, không bao giờ có thể lấy bàn hay đệm và đọc.`addl $0x1, %eax`ở mục tiêu
- `llvm-objdump`làm sai lầm giống như việc lau lắp bẫy
- một mục nhập bên trong một hướng dẫn được ghi nhận là xung đột
- Một cú nhảy gián tiếp không được giải quyết ngăn chặn sự hạ cánh và được liệt kê
- `total``-O1`có năm khối, năm cạnh được đánh dấu, một cạnh sau, và các nhà thống trị ngay lập tức dự kiến
- Một viên kim cương được chế tạo bằng tay với một vòng cung cấp cho các nhà thống trị thuật toán xác định
- `total``-O2`có hai vòng
- `grade``-O0`tạo ra một bàn nhảy 5 lần từ `.rela.rodata`với mục tiêu `0x91, 0x88, 0x7f, 0x76, 0x76`
- Không có bàn `grade``-O0`có ba khối và một nhảy không được giải quyết
- `grade``-O1`và `-O2`là một bảng giá trị `[1, 2, 3, 4, 4]`Không có nhảy gián tiếp
- `grade_label``-O2`đọc một bảng chuỗi tương đối thông qua năm di chuyển
- Hình ảnh tương tác chứa cùng các dữ liệu mà phân tích tạo ra

## Các chế độ sản xuất thất bại

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Data inside `.text` | A plausible listing with every byte decoded | The descent claims no data byte and the jump target starts an instruction |
| Padding after the last return | A `nopw` instruction at the end of the function | The bytes are unreachable from the entry |
| Indirect jump through a table | "jmp rax" and four dead blocks | Table address from the `lea` relocation, entry count from the bounds check, targets from `.rela.rodata` |
| Switch turned into a value table | "a jump table with a relocation" | A `movl` load from `.rodata+0x14`, three blocks, no indirect transfer |
| Call with a zero displacement | `callq 0x113`, the next instruction | `R_X86_64_PLT32 grade-0x4` resolves to `0x30` |
| Decoder guesses an unknown opcode | A mnemonic that looks right | `DecodeError` with the address, and the sweep records the byte |
| Instruction longer than 15 bytes | A very long "instruction" | The cursor raises before reading byte 16 |
| Branch into the middle of an instruction | Two overlapping listings | A conflict record with both addresses |
| Loop reported as straight-line code | No `while` in the pseudocode | A back edge whose target dominates its source |
| Oracle captured from a different compiler | Tests pass on stale text | The fixture README names the exact compiler and command |

## Quy tắc hoạt động

Khóa mã chống lại một ngôn ngữ, kiểm soát lưu lượng từ các mục nhập được biết, và giải thích cho mỗi byte như được tuyên bố, lấp đầy, dữ liệu hoặc không thể tiếp cận. Khôi phục mỗi mục tiêu gián tiếp từ một nơi di chuyển hoặc một bảng bạn có thể chỉ ra.

## Đọc thêm

- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, Chapter 2: Instruction Format](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [AMD64 Architecture Programmer's Manual Volume 3, Chapter 1: Instruction Encoding](https://docs.amd.com/v/u/en-US/24594_3.38_APM_Vol3_PUB)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Table 4.9: Relocation Types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Schwarz, Debray, Andrews, "Disassembly of Executable Code Revisited" (WCRE 2002)](https://www2.cs.arizona.edu/~debray/Publications/disasm.pdf)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Allen, "Control Flow Analysis" (1970)](https://doi.org/10.1145/800028.808479)
- [Cooper, Harvey, Kennedy, "A Simple, Fast Dominance Algorithm" (2001)](https://www.cs.tufts.edu/~nr/cs257/archive/keith-cooper/dom14.pdf)
- [Lengauer, Tarjan, "A fast algorithm for finding dominators in a flowgraph" (1979)](https://doi.org/10.1145/357062.357071)
- [Capstone 6.0.0-Alpha10 release notes](https://github.com/capstone-engine/capstone/releases/tag/6.0.0-Alpha10)
- rea 6.5.0 nguồn tại tag `3b79af2`bài học này mô tả: `README.md`- `docs/ghidra-provider.md`- `docs/ghidra-dos.md`- `docs/reverse-engineering-tools.md`- `bridge/ghidra/ReaGhidraBridge.java`- `src/contracts/officialToolContracts.ts`- `src/ghidra/GhidraAnalysisProfile.ts`- Tôi không biết.
