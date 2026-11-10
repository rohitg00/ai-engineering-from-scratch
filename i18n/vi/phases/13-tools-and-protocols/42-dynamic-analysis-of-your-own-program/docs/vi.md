# Phân tích năng động của chương trình của riêng bạn: Debuggers, dấu vết, và xác nhận tuyên bố tĩnh

> Một điểm phá vỡ là một quan sát về một lần chạy của một xây dựng. Bài học này xây dựng được sự gắn kết mà biến những quan sát đó thành xác nhận, bác bỏ, và không quan sát kết luận về các tuyên bố các bài học tĩnh được thực hiện.

**Type:** Build
**Languages:** Python, TypeScript, C, arm64 assembly, lldb command language
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~130 minutes

## Mục tiêu học tập

- Giải thích những gì một debugger cần từ hệ điều hành trên Linux (`ptrace`) và trên macOS (Mach task ports và exception ports), và tại sao một shell sandbox không thể khởi động một debuggee.
- Đặt các điểm chia tay phần mềm theo tên và bằng cách liệt kê địa chỉ, đặt một điểm giám sát phần cứng, và đọc giới hạn mà bộ xử lý áp đặt cho cả hai.
- Đưa lldb trong chế độ batch từ Python với một stop hook ghi lại các đăng ký, bộ nhớ và các biến khung tại mỗi dừng, và phân tích bản sao trở lại vào một dòng thời gian.
- Kiểm tra các yêu cầu tĩnh từ bài học 32, 33, 34 và 41 đối với dòng thời gian đó: các hồ sơ lập luận, cấu trúc field offsets, cạnh nào một nhánh có điều kiện đã thực hiện, và những cuộc gọi nào đã xảy ra.
- Lên cùng một kế hoạch với một `-O2`xây dựng, đọc điểm vỡ mà giải quyết và không bao giờ tấn công, và nói những gì mà làm và không chứng minh.
- Chất và tải một tập tin lõi, và đặt tên những gì một lõi kiểu đống bỏ qua.
- Bản đồ các bộ lệnh gdb và lldb, và đặt `strace`- `ltrace`- `bpftrace`- `dtrace`, và`rr`về hệ điều hành đúng với phiên bản và giấy phép của họ.
- Hãy nêu ra các thực tế ký mã macOS cho phép lldb debug một binary bạn tự xây dựng, và hai điều kiện mà nó từ chối.

## Vấn đề

Bài học 41 đọc `struct account`từ DWARF và nói `balance`ngồi ở ofset 4. Bài học 33 xây dựng biểu đồ kiểm soát dòng chảy của `classify`và nói rằng chi nhánh đầu tiên đi đến `return -1`Bài học 32 nói hai lập luận đầu tiên đến trong`x0`và `x1`Mỗi câu đều được lấy từ các byte.

Một đại lý sau đó đọc cùng một chương trình và báo cáo "các cuộc gọi chính"`bump`- `classify`, và`sum_balances`"Bảng biểu tượng liệt kê cả ba, vì vậy câu trông an toàn. Bạn xây dựng chương trình ở `-O2`, đặt một điểm vỡ trên mỗi hàm, và chạy nó.`hit count = 0`- Tôi không biết.

Người đại lý không sai về nguồn gốc, nó sai về cấu trúc mà họ hỏi về.`sum_balances(rows, 3)`Cách duy nhất để biết được số nhị phân trên máy này là chạy nó dưới một bộ xử lý lỗi và xem.

Bài học này tạo ra một vòng xoáy để nhìn.`account.c`, đọc danh sách, lập kế hoạch một phiên Ildb, chạy nó, và đánh giá mỗi yêu cầu tĩnh so với những gì dừng lại cho thấy.`confirmed`nghĩa là một dừng lại cho thấy tuyên bố là đúng cho cuộc chạy này. `refuted`nghĩa là một điểm dừng đã chứng minh nó là sai.`not-observed`Bài học 35 sau đó lưu trữ mỗi phán quyết như một bản án.`observed`ghi lại với thẩm quyền `controlled-replay`- Tôi không biết.

```figure
re-42-run-timeline
```

## Một Debugger là ba hệ thống dịch vụ và một bảng

Một bộ xử lý lỗi làm bốn điều cho một quy trình mà nó không sở hữu mã của nó. Nó dừng quá trình, đọc và viết các sổ đăng ký của nó, đọc và viết bộ nhớ của nó, và được thông báo khi quá trình dừng lại một lần nữa.

Trên Linux dịch vụ là `ptrace(2)`Trang hướng dẫn nói rằng nó "giữ một phương tiện để một quá trình (các bộ theo dõi) có thể quan sát và kiểm soát việc thực hiện một quá trình khác". `PTRACE_TRACEME`cho phép một đứa trẻ thông báo rằng cha mẹ của nó sẽ theo dõi nó,`PTRACE_ATTACH`thực hiện một quá trình không liên quan, `PTRACE_PEEKDATA`đọc "một từ tại địa chỉ address trong ký ức của trace",`PTRACE_GETREGS`đọc các sổ đăng ký, và `PTRACE_SINGLESTEP`chạy một lệnh. giới hạn mô-đun Yama gắn: `/proc/sys/kernel/yama/ptrace_scope`khi mặc định của nó là 1 nghĩa là "các quá trình mục tiêu phải là một hậu duệ của người gọi", 2 nghĩa là chỉ có một người quản lý có thể tham gia, và 3 nghĩa là không ai có thể.

Trên macOS `ptrace`là một giao diện nhỏ hơn.`PT_TRACE_ME`- `PT_ATTACHEXC`- `PT_STEP`- `PT_CONTINUE`, và`PT_KILL`, và nói rằng với `PT_ATTACHEXC`"Các tín hiệu từ đứa trẻ đi đến cha mẹ như Mach ngoại lệ".`ptrace`Không có gì.`debugserver`gọi`task_for_pid()`để có được một cổng nhiệm vụ Mach cho quá trình, sau đó `task_set_exception_ports()`để các điểm vỡ đến như các thông điệp ngoại lệ.`taskgated`quyết định ai có thể gọi `task_for_pid`- Tôi không biết.

Bạn có thể thấy chi phí của thiết kế đó trong bản ghi chép bài học này. Vỏ phiên diễn ra dưới một hộp cát Seatbelt. cùng một kế hoạch tạo ra mười một điểm dừng bên ngoài hộp cát tạo ra điều này bên trong nó:

```text
(lldb) run
error: process exited with status -1 (attach failed ((os/kern) invalid address))
```

Quá trình được tạo ra và sau đó không thể được chấp nhận. sai lầm là về quyền của debugger, và nó không nói gì về chương trình.

Bảng là bảng điểm chia cắt. Debugger nhớ bộ lệnh nào mà nó thay thế ở địa chỉ nào, vì vậy nó có thể đặt lại bản gốc khi bạn tiếp tục, và nó đếm các lần nhấn theo vị trí. `breakpoint list`Bác vẽ bảng đó, và dây đeo đọc nó ở cuối mỗi lần chạy.

## Các điểm chia rẽ: Một byte hoặc một từ thay thế

Một điểm vỡ phần mềm là một hướng dẫn mà bộ xử lý bị mắc kẹt, được viết trên các byte đầu tiên của hướng dẫn bạn muốn dừng lại.`INT3`, opcode `CC`, dài một byte, mà hướng dẫn Intel mô tả là "được thiết kế để gọi bộ xử lý ngoại lệ debug".`BRK #imm16`, một hướng dẫn bốn byte có ngoại lệ "đếm ngoại lệ trong ESR_ELx, sử dụng giá trị EC 0x3C".`BRK`chỉ dẫn chính nó, đó là lý do tại sao một stop báo cáo địa chỉ của chỉ dẫn thay thế chứ không phải là sau đó.

Lldb đặt điểm chia cắt bằng tên, theo tệp và dòng, hoặc bằng địa chỉ.

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O0`bump + 12 at account.c:13:19, address = 0x00000001000004bc
```

`bump + 12`là hướng dẫn thứ tư. ba trước đó là`sub sp, sp, #0x10`- `str x0, [sp, #0x8]`, và`str w1, [sp, #0x4]`, thiết lập khung mà bảng đường DWARF gán cho đường mở của hàm.`x0`và `x1`vẫn giữ các lập luận, bởi vì phần đầu chỉ sao chép chúng.

Theo địa chỉ, lldb cần biết địa chỉ thuộc về mô-đun nào.`breakpoint set -a 0x100000504`trước khi quá trình tồn tại là một địa chỉ tải không có phần phía sau nó, và trong một thử nghiệm đầu tiên nó vẫn còn `unresolved`trong suốt cuộc chạy với `hit count = 0`. Hình thức mà dây đeo sử dụng đặt tên cho mô-đun:

```text
(lldb) breakpoint set -a 0x100000504 -s account-O0
Breakpoint 4: address = 0x0000000100000504
```

Với `-s`số là một địa chỉ tập tin bên trong `account-O0`, lldb thêm trang nhựa tải, và sau khi chạy vị trí đọc `resolved, hit count = 2`.Dịch trình trình học tập 33 cho địa chỉ tập tin, vì vậy đây là biểu mẫu kết nối một danh sách tĩnh với một điểm dừng động.

### Khóa mã nhánh bằng tay

Chi nhánh có điều kiện đầu tiên trong `classify``-O0`là từ `36f800a8``0x1000004f0`, mà `llvm-objdump`Nhận dạng như `tbz w8, #0x1f, 0x100000504`. Tự giải mã từ mã hóa Arm A64 của `TBZ`- Tôi không biết.

1. Bit 31 là `b5`, bit cao của số bit. Nó là 0.
2. 30 đến 25 bit là `011011`, nhóm thử nghiệm và nhánh. Bit 24 là 0, chọn `TBZ`Và không`TBNZ`- Tôi không biết.
3. Các bit 23 đến 19 là `b40`, 5 bit thấp của số bit: `11111`= 31. Với `b5`= 0 bit được thử nghiệm là 31, bit dấu hiệu của giá trị 32 bit.
4. Các bit 18 đến 5 là `imm14``00000000000101`= 5. Phân tích nhánh là `imm14 * 4`= 20 = `0x14`, nên mục tiêu là`0x1000004f0 + 0x14 = 0x100000504`- Tôi không biết.
5. Các bit 4 đến 0 là `Rt``01000`= 8, vì vậy sổ đăng ký là `w8`- Tôi không biết.

`w8`đã tải một hướng dẫn trước đó bởi `ldr w8, [x8, #0x4]`, đó là `a->balance`ở vị trí bù đắp 4. `TBZ`Các nhánh khi bit là không. Nhánh được lấy khi bit dấu hiệu là sạch, đó là `balance >= 0`Nguồn tin viết:`if (a->balance < 0) return -1;`, do đó, trình biên dịch đã đảo ngược điều kiện: cạnh được lấy bỏ qua `return -1`khối, và sự rơi qua tại `0x1000004f4`Do đó, tuyên bố tĩnh mà dây đeo mang là một tuyên bố cạnh với một dấu hiệu: được thực hiện khi`a->balance >= 0`Việc nâng của cành thứ hai cũng như vậy.`subs w8, w8, #0xc8`tính toán`balance - 200`và `b.le 0x100000524`được lấy khi đó là tối đa 0, đó là `balance <= 200`- Tôi không biết.

## Các điểm canh giữ là phần cứng và ít

Một điểm giám sát dừng quá trình khi truy cập bộ nhớ tại một địa chỉ. Nó không thể là một hướng dẫn thay thế, bởi vì bất kỳ hướng dẫn ở bất cứ nơi nào có thể thực hiện truy cập.`DR0`qua `DR3`giữ "những địa chỉ của tối đa 4 điểm ngắt", và `DR7`cho phép mỗi một và đặt điều kiện của nó (hành động, viết hoặc đọc-tập) và chiều dài của nó (1, 2, 4, hoặc 8 byte).`DBGWVR<n>_EL1`, chứa "địa chỉ ảo dữ liệu được sử dụng để phù hợp với điểm đồng hồ", và `DBGWCR<n>_EL1`cho các điều khiển, và hướng dẫn Arm nói "Một thực hiện có thể bao gồm từ 2-64 điểm giám sát".

LBD báo cáo số đã được đưa ra:

```text
(lldb) watchpoint set variable a->balance
Watchpoint created: Watchpoint 1: addr = 0x16fdfe00c size = 4 state = enabled type = m
(lldb) watchpoint list
Number of supported hardware watchpoints: 4
```

Có 4 người trên máy này.`0x16fdfe00c`là `x0 + 4`: chỉ số cấu trúc tại `bump`dừng cộng với sự thay đổi DWARF của `balance`- `size = 4`là `int`- `type = m`Khi các khe cắm hết lldb từ chối điểm quan sát tiếp theo, và vì một vùng không được sắp xếp hoặc không có sức mạnh của hai có thể lấy hai khe cắm, số điểm quan sát bạn có thể đặt có thể nhỏ hơn bốn.

Các điểm giám sát dữ liệu báo cáo sau khi truy cập. Hướng dẫn Intel nói "một hướng dẫn ghi nhớ ghi lại dữ liệu ban đầu trước khi ngoại lệ lỗi được tạo ra bởi một điểm vỡ dữ liệu được tạo ra", và lldb giữ giá trị cũ trong bộ nhớ nhớ riêng của nó để in cả hai:

```text
Watchpoint 1 hit:
old value: 250
new value: 255
* thread #1, queue = 'com.apple.main-thread', stop reason = watchpoint 1
    frame #0: 0x00000001000004d0 account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:14:12
```

Đỗ dừng ở `0x1000004d0`, hướng dẫn sau `str w8, [x9, #0x4]``0x1000004cc`Một điều đáng biết trước khi bạn phân tích kết quả.`watchpoint set`, dấu vân tay của Ildb`Watchpoint 1 hit:`với giá trị cũ trống rỗng và `new value: 250`Đó là lần đọc đầu tiên, và dây đeo bỏ qua một cú đánh mà không có giá trị cũ.

## Chạy, dừng và chế độ đợt

Lập pháp lệnh của Ildb là `<noun> <verb> [-options] [arguments]`Các động từ bước là`thread step-in`(`s`), `thread step-over`(`n`), `thread step-inst`(`si`), `thread step-inst-over`(`ni`), và `thread step-out`(`finish` ).`thread until 12`chạy tới một đường. `thread return <expr>`quay trở lại sớm với một giá trị. dây không bước đi. Nó dừng lại tại địa chỉ dự định và cho phép một stop hook đọc:

```text
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
```

`-o`có thể được lặp lại, và các lệnh chạy theo thứ tự tại mỗi điểm dừng. `register read`tên hai hồ sơ lập luận và bộ đếm chương trình. `memory read -s4 -fx -c24 $x0`in 24 chữ bốn byte bằng hex từ địa chỉ trong `x0`, là 96 byte, ba `struct account`hàng. `frame variable -P 1`in các lập luận và địa phương và mở rộng các chỉ dẫn một cấp độ, vì vậy `a`cho thấy 5 lĩnh vực của nó.

Phương thức đợt là `lldb -b`- Nhóm hướng dẫn nói`--batch`chạy lệnh từ `-s`- `-S`- `-o`, và`-O`và sau đó bỏ, và nếu một lệnh dừng lại "do một tín hiệu hoặc cố, debugger sẽ quay lại cho các yêu cầu tương tác".`-s`Một điều quan trọng:`settings set interpreter.stop-command-source-on-error false`Không có nó, đầu tiên`continue`sau khi quá trình đã ra khỏi kết thúc toàn bộ tập tin, và `breakpoint list`Không bao giờ chạy.`error: Process must be launched.`và tiếp tục.

Hai sự kiện về hình dạng đầu ra quyết định cách trình phân tích hoạt động.`Process N stopped`khối với nó `frame #0`dòng được in sau đó. Parser do đó thu thập registry, bộ nhớ và các dòng biến thành một phần chờ và gắn phần vào phần tiếp theo `frame #0`Một phần mà máy tính chương trình của nó đang ở trong`dyld``_dyld_start`là điểm dừng đầu vào trước khi chương trình chạy, và không `frame #0`Thứ hai, một điểm chia rẽ với`--auto-continue`không báo cáo dừng của nó ở tất cả, và một stop hook không chạy cho nó. phiên bản đầu tiên của vòng xoáy này sử dụng tự động tiếp tục và ghi lại không có gì.`continue`thay vì chỉ huy.

## Kế hoạch xuất phát từ danh sách

`Plan.commands()`tạo file lệnh từ `llvm-objdump -d`văn bản của binary nó sẽ chạy.`account-O0`- Có thể là:

```text
breakpoint set -n bump
breakpoint set -n classify
breakpoint set -n sum_balances
breakpoint set -a 0x100000504 -s account-O0
breakpoint set -a 0x1000004f4 -s account-O0
breakpoint set -a 0x100000524 -s account-O0
breakpoint set -a 0x100000514 -s account-O0
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
run
watchpoint set variable a->balance
watchpoint list
continue
...
breakpoint list
watchpoint list -v
```

Ba điểm chia tên là các mục nhập hàm. bốn điểm chia địa chỉ là mục tiêu và sự rơi qua của mỗi nhánh có điều kiện mà `Listing.conditional_branches()`tìm thấy trong `classify``tbz``0x1000004f0`và `b.le``0x100000510`. Địa điểm quan sát được đặt tại điểm dừng đầu tiên, như kế hoạch dự kiến sẽ là `bump`- 16 .`continue`Chỉ cần có một số chỉ thị, chúng ta sẽ không thể vượt qua được yêu cầu của họ, và những gì còn lại sẽ không có hại sau khi ra khỏi.

Các yêu cầu được xây dựng từ các đầu vào tương tự bởi `claims_for()`- Có thể là:

| Id | Kind | Claim | Source |
|---|---|---|---|
| `arg-registers` | argument-register | at every entry the first arguments arrive in `x0` and `x1` | lesson 32 and AAPCS64 |
| `field-offsets` | field-offset | `struct account` is 32 bytes with `kind` at 0, `balance` at 4, `code` at 8, `rate` at 16, `label` at 24 | lesson 41 and the DWARF dump |
| `branch-1` | branch-taken | `tbz` at `0x1000004f0` goes to `0x100000504` when `a->balance >= 0`, otherwise to `0x1000004f4` | lesson 33 edges and the lesson 34 lift |
| `branch-2` | branch-taken | `b.le` at `0x100000510` goes to `0x100000524` when `a->balance <= 200`, otherwise to `0x100000514` | lesson 33 edges and the lesson 34 lift |
| `calls` | call-edge | `main` calls `bump` once, `classify` three times, `sum_balances` once | source text and `nm` |
| `store-once` | store | `bump` writes `a->balance` once and the new value is the old value plus `by` | lesson 34 pseudocode |
| `stride` | struct-stride | `list[i].balance` sits at `list + 32*i + 4` | lesson 41 and the psABI aggregate rule |
| `output` | behaviour | the program prints `class 0 1 -1` and `sum 315` | source arithmetic |

Các field offset đến từ `struct_layout()`, có đoạn `DW_TAG_structure_type`với `DW_AT_byte_size (0x20)`Và năm người `DW_TAG_member`Các mục với `DW_AT_data_member_location`Kế hoạch không bao giờ gõ số 4.

## Cuộc chạy ở 0: 11 điểm dừng

Đỗ dừng đầu tiên là `bump`Đường cắt, cái nón đã in ra đây trước khi dừng:

```text
      x0 = 0x000000016fdfe008
      x1 = 0x0000000000000005
      pc = 0x00000001000004bc  account-O0`bump + 12 at account.c:13:19
0x16fdfe008: 0x00000073 0x000000fa 0x00000009 0x00000000
0x16fdfe018: 0x00000000 0x3ff40000 0x00000719 0x00000001
0x16fdfe028: 0x0000006c 0xffffffd8 0x00000003 0x00000000
0x16fdfe038: 0x00000000 0x40000000 0x00000721 0x00000001
(account *) a = 0x000000016fdfe008 {
  kind = 's'
  balance = 250
  code = 9
  rate = 1.25
  label = 0x0000000100000719 "savings"
}
(int) by = 5
```

Đọc tám từ của hàng đầu chống lại các lệnh trục trặc DWARF. Từ 0 tại lệnh trục trặc 0 là `0x73`, đó là `'s'`, `kind`Byte, tiếp theo là ba byte. Word 1 ở offset 4 là `0xfa`= 250, `balance`. Từ 2 ở vị trí 8 là `0x9`- `code`, một `short`Word 3 ở offset 12 là padding trước 8-byte-được sắp xếp `double`Từ 4 và 5 ở số 16 là `0x3ff4000000000000`, là mã hóa IEEE-754 của 1.25. từ 6 và 7 ở offset 24 là `0x100000719`, `label`chỉ dẫn vào `__TEXT`8 từ tiếp theo bắt đầu bằng`0x6c`= `'l'`và `0xffffffd8`= -40: hàng thứ ba, `loan`, 32 byte sau đó.`frame variable`, vậy `_check_layout()`ghi chép`field-offsets`như `confirmed`ở điểm dừng này, và nó làm như vậy một lần nữa tại mỗi một trong mười một điểm dừng nơi `x0`có một chỉ dẫn cấu trúc.

`x0`=`a`và `x1`=`by`, vậy `arg-registers`được xác nhận ở mục này.`classify`dừng lại `x1`vẫn đọc `0x5`, một phần còn lại từ `bump`, và`classify`Một hồ sơ mà không có tranh luận sống trong là tiếng ồn, và bài học 32 tuyên bố không nói gì về nó.

Điểm dừng thứ hai là điểm quan sát, giá trị cũ 250, giá trị mới 255, `by`= 5. Một cú đánh trong suốt cuộc chạy, vậy là `store-once`Sau đó là 3 hoạt động của`classify`, mỗi cái có điểm dừng đầu vào và một hoặc hai điểm dừng cạnh:

| Stop | Address | Stop reason | What it tests |
|---|---|---|---|
| 2 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 100, `x0` = `a` |
| 3 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 100 >= 0, `branch-1` confirmed |
| 4 | `0x100000524` | breakpoint 6.1 | `b.le` taken, 100 <= 200, `branch-2` confirmed |
| 5 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 255 |
| 6 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 255 >= 0 |
| 7 | `0x100000514` | breakpoint 7.1 | `b.le` fell through, 255 > 200 |
| 8 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = -40 |
| 9 | `0x1000004f4` | breakpoint 5.1 | `tbz` fell through, -40 < 0 |
| 10 | `0x100000544` | breakpoint 3.1 | `sum_balances` entry, `x1` = 3 |

`_check_branches()`nhóm các điểm dừng thành kích hoạt, đọc cân bằng tại nhập và cho mỗi điểm dừng cạnh tính toán người kế vị dự đoán predicate nâng.`branch-1`Được xác nhận 3 lần.`branch-2`Stop 5 cho thấy cân bằng là 255, đó là giá trị của watchpoint đã thấy được viết.

Ở điểm dừng 10 thì cái móng đọc 24 từ từ`list`- `_check_stride()`lấy từ 1, từ 9, và từ 17, là các sự bù đắp 4, 36, và 68: 100, 255, và -40. Nó so sánh mỗi với cân bằng `classify`được xem ở cùng một địa chỉ, tổng số chúng là 315, và so sánh tổng số với `sum 315`line chương trình được in. Sau đó quá trình xuất hiện với trạng thái 0 và `breakpoint list`cho thấy số lượng hit của 1, 3, 1 cho các tên và 2, 1, 1, 1 cho bốn cạnh.`confirmed`, với 25 kỷ lục phía sau, 23 trong số đó được kết nối với một dừng và hai đến kết thúc chạy.

## Cuộc chạy ở -O2: Zero Stops

Nguồn này cũng giống nhau.`-O2`là một chương trình khác.`llvm-objdump -d`của `main`có bốn `bl`chỉ dẫn, tất cả để `printf`Thay vì những cuộc gọi mà nó có`mov w8, #-0x1`- `mov w8, #0x1`, một số không qua `xzr`, và`mov w8, #0x13b`, là 315. Bộ biên dịch tính toán mọi kết quả tại thời điểm biên dịch. `nm`danh sách vẫn còn `_bump`- `_classify`, và`_sum_balances`, vì chúng là các hàm bên ngoài và các bản sao ngoài đường phải tồn tại để các đối tượng khác gọi.`DW_TAG_subprogram`mục cho cả bốn hàm và số 0 `DW_TAG_inlined_subroutine`nhập, vì vậy ngay cả thông tin debug không ghi lại đường thẳng.

Kế hoạch cho xây dựng này có ba điểm vỡ tên và không có điểm vỡ cạnh. `classify``-O2`là sáu hướng dẫn,`ldr`- `cmp`- `cset`- `cmp`- `csinv`- `ret`, không có nhánh điều kiện trong nó.`-O0`danh sách không có địa chỉ trong nhị phân này, và vòng không mang chúng. Một tuyên bố về một cạnh thuộc về xây dựng mà danh sách có cạnh.

Cuộc chạy:

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O2`bump at account.c:13:16, address = 0x0000000100000460
(lldb) run
sizeof 32 align 8
offsets 0 4 8 16 24
class 0 1 -1
sum 315
Process 48444 exited with status = 0 (0x00000000)
(lldb) watchpoint set variable a->balance
error: Command requires a process which is currently stopped.
(lldb) breakpoint list
1: name = 'bump', locations = 1, resolved = 1, hit count = 0
```

Mỗi điểm vỡ đã được giải quyết.`BRK`Số vụ giết người là không vì không có người tìm kiếm chỉ dẫn nào đến địa chỉ.

| Claim | Verdict | Record |
|---|---|---|
| `calls` | refuted | after a full run with exit status 0, entry stops bump 0, classify 0, sum_balances 0 |
| `output` | confirmed | the four lines and exit status 0 |
| `arg-registers` | not-observed | no stop tested it, hit counts all 0 |
| `field-offsets` | not-observed | no stop tested it |
| `store-once` | not-observed | no stop in bump, so the watchpoint was never set |
| `stride` | not-observed | no stop in sum_balances |

Hãy chính xác về những gì bác bỏ nói.`main`gọi ba chức năng trong chương trình này. Đối với build này và run này nó không, và vòng xoay kiểm tra rằng chạy hoàn thành, bởi vì một hit số 0 trước khi ra ngoài chỉ có nghĩa là chạy chưa đạt đến cuộc gọi. Việc tuyên bố không nói các chức năng là mã chết, và chạy không nói rằng: chúng được xuất khẩu và một đối tượng khác có thể gọi chúng. Bốn tuyên bố khác không được xác nhận hoặc bác bỏ. Cơ quan vẫn còn`balance`ở trục trặc 4 trong cấu trúc này, và `-O2`DWARF nói vậy, nhưng không dừng lại trong cuộc chạy đọc ký ức để cho thấy nó. `not-observed`giữ sự phân biệt đó, và bài học 35 giữ cho điều không biết mở cho đến khi một người chạy thực sự quan sát nó.

## Chất thải cốt lõi

Một tập tin cốt lõi là bộ nhớ của quá trình và ghi chép được viết lên đĩa, để debugger có thể đọc một chương trình dừng lại sau khi chương trình đã biến mất.`core(5)`nói "Một số lượng nhỏ tín hiệu gây ra sự chấm dứt bất thường của một quá trình cũng gây ra một bản ghi trạng thái trong lõi của quá trình được ghi vào đĩa", vào`/cores/core.pid`"trong khi quá trình chấm dứt có quyền viết trong thư mục, và thư mục tồn tại".`sysctl`báo cáo `kern.coredump: 1`và `kern.corefile: /cores/core.%P`- `/cores`tồn tại với mode `drwxrwxr-t root admin`, và vỏ `ulimit -c`là 0. Không có lõi hạt nhân được viết cho đến khi bạn tăng giới hạn với `ulimit -c unlimited`, hoặc toàn hệ thống với `launchctl limit core unlimited`- Tôi không biết.

LBD viết một bản lõi theo yêu cầu mà không bị hỏng.`bump`điểm phá vỡ:

```text
(lldb) process save-core --style stack account-O0-stack.core
Saving 49152 bytes of data for memory region at 0x16fdf4000

Modified-memory or stack-memory only corefile created.  This corefile may 
not show library/framework/app binaries on a different system, or when 
those binaries have been updated/modified. Copies are not included
in this corefile.  Use --style full to include all process memory.
```

Dữ liệu là 53.248 byte.

```text
(lldb) target create "./account-O0" --core "account-O0-stack.core"
(lldb) bt
* thread #1, stop reason = ESR_EC_BRK_AARCH64 (fault address: 0x0)
  * frame #0: 0x00000001000004bc account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:13:19
    frame #1: 0x0000000100000640 account-O0`main at account.c:40:5
    frame #2: 0x000000019a949d54 dyld`start + 7184
(lldb) frame variable *a
(account) *a = (kind = 's', balance = 250, code = 9, rate = 1.25, label = "")
(lldb) frame variable a->label
(const char *) a->label = 0x0000000100000719 ""
```

Các dấu vết và các trường số nguyên nguyên vẫn còn nguyên vẹn, bởi vì chúng sống trên đống mà lõi đã cứu. `label`Các dấu ấn như một chuỗi trống với chỉ số của nó nguyên vẹn.`0x100000719`là đúng; các byte nó chỉ ra là chữ nghĩa `"savings"`trong `__TEXT`phần của thể thực thi, và một lõi kiểu đống không bao gồm phần đó. Điểm chỉ là một quan sát. Dòng không có sẵn, và lldb không phát minh ra nó. `--style full`bao gồm tất cả bộ nhớ quá trình, và một lõi đầy đủ của chương trình 34 KB trên máy nghiên cứu là 2.1 GB, bởi vì quá trình lập bản đồ bộ nhớ cache được chia sẻ. Lý do dừng đọc `ESR_EC_BRK_AARCH64`: lõi ghi lại `BRK`ngoại lệ mà điểm vỡ đã nêu ra.

Trên Linux, lõi viết lõi theo `/proc/sys/kernel/core_pattern`, một mẫu với `%p`cho PID, `%e`cho tên lệnh, `%s`cho tín hiệu, và `%t`cho thời gian, và một dẫn đầu `|`ống rác thải đến một chương trình. hệ thống phân phối sử dụng ống đó cho `systemd-coredump`, và`coredumpctl list`- `info`- `dump`, và`debug`lấy lại những gì nó lưu trữ. `gdb prog core`và `lldb -c core prog`cả hai mở kết quả.

## GDB và LLDB Lần này bên kia

Hai bộ gỡ lỗi làm việc tương tự với các từ khác nhau. `COMMAND_MAP`trong vòng xoáy chứa 35 hàng, in bởi `python3 code/main.py commands`Những gì bài học này sử dụng:

| Task | gdb | lldb | lldb alias |
|---|---|---|---|
| break at a function | `break bump` | `breakpoint set -n bump` | `b bump` |
| break at an address in one module | `break *0x1000004f0` | `breakpoint set -a 0x1000004f0 -s account-O0` | |
| run commands at every stop | `define hook-stop` ... `end` | `target stop-hook add -o '...'` | |
| list breakpoints with hit counts | `info breakpoints` | `breakpoint list` | `br l` |
| watch a variable for writes | `watch a->balance` | `watchpoint set variable a->balance` | `wa s v a->balance` |
| list watchpoints | `info watchpoints` | `watchpoint list -v` | `wa l -v` |
| read one register | `p $x0` | `register read x0` | |
| read memory as words | `x/8xw 0x16fdfe008` | `memory read -s4 -fx -c8 0x16fdfe008` | `x -s4 -fx -c8 0x16fdfe008` |
| show arguments | `info args` | `frame variable --no-locals` | |
| step one instruction | `stepi` | `thread step-inst` | `si` |
| run until the function returns | `finish` | `thread step-out` | `finish` |
| write a core file | `gcore core` | `process save-core --style stack core` | |
| open a core file | `gdb account-O0 core` | `lldb -c core account-O0` | |

LBD của `p`là một biệt danh của `dwim-print`, in một biến đơn giản thông qua `frame variable`đường đi và rơi trở lại `expression`cho bất cứ thứ gì khác.`v`là `frame variable`- Tôi thích`frame variable`trong một vòng xoáy: nó đọc vị trí DWARF và không bao giờ chạy mã trong debuggee.

Các phiên bản và giấy phép vào ngày 2026-10-14. lldb mang số phiên bản LLVM, và phiên bản hiện tại của llvm.org là LLVM 23.1.3 của năm 2026-10-06, theo giấy phép Apache 2.0 với ngoại lệ LLVM. Homebrew gửi nó như công thức riêng `lldb`Các thiết bị chỉ huy trên tàu máy này`lldb-1703.0.236.21`, số hóa của Apple, với Python 3.9.6 nhúng, và lldb của Apple đã được ký để gỡ lỗi. GDB 18.1 được phát hành vào năm 2026-09-25 dưới GPL-3.0 hoặc sau đó.`.gdb_index`, AArch64 `FPMR`, và Python `gdb.Corefile`GDB không có hỗ trợ bản địa cho các quy trình silicon của Apple cho đến 18.1: một loạt 15 bản vá "Tình hỗ trợ ban đầu AArch64-Darwin" đã được đăng vào tháng 10 năm 2025, và vào tháng 2 năm 2026 một người bảo trì đã thiết lập con đường để hạ cánh nó thông qua việc gán bản quyền và các bản vá BFD đầu tiên.`gdb`công thức có arm64 chai và xây dựng với một giả `--target=x86_64-apple-darwin20`, và yêu cầu kéo mà đã thêm chúng nói "không thể gỡ lỗi aarch64-Darwin binaries thông qua GDB". Bất kỳ debugger không phải Apple trên macOS cũng cần một chứng chỉ tự ký và `com.apple.security.cs.debugger`quyền, hoặc`task_for_pid`thất bại với "(os/kern) thất bại (0x5)". Gdb ở trong khóa học này là Linux, nơi Debian ổn định tàu gdb 16.3 cho arm64, và nơi `rr`sống.

## Theo dõi: Chương trình yêu cầu Kernel làm gì

Một bộ gỡ lỗi cho thấy trạng thái của chương trình ở một điểm dừng. Một bộ theo dõi cho thấy các tác động của chương trình trên hệ thống mà không dừng nó lâu. Các công cụ là cho mỗi hệ điều hành.

| Tool | OS | Version | Licence | What it records |
|---|---|---|---|---|
| `strace` | Linux | 7.2, 2026-08-18 | LGPL-2.1-or-later | system calls with arguments and return values |
| `ltrace` | Linux | 0.7.3 last tarball, git snapshots in Debian | GPL-2.0 | dynamic library calls |
| `bpftrace` | Linux | v0.27.0, 2026-09-10 | Apache-2.0 | kernel and user probes through eBPF |
| `dtrace` and `dtruss` | macOS | `Sun D 1.19` in macOS 26.2 | CDDL, from Sun's OpenSolaris | D probes; `dtruss` prints system calls |

`dtruss`trong hướng dẫn của nó rằng "Vì đây sử dụng DTrace, chỉ người dùng có quyền gốc có thể chạy lệnh này".`dtrace(1)`thêm rằng "Với cài đặt bảo vệ tính toàn vẹn hệ thống mặc định, các chương trình D không được phép truy cập các giá trị địa chỉ hạt nhân hoặc nội dung bộ nhớ hạt nhân" và các hành động phá hủy không được phép trong SIP. `sudo dtruss ./account-O0`trên máy này không được chạy trong bài học này, bởi vì vòng xoáy chạy mà không có gốc, và bài học ghi lại rằng như không xác minh.`write`cho mỗi `printf`line" là một câu hỏi theo dõi, "did `x1`giữ 5 ở `bump`" là một câu hỏi che chở. Cả hai đều là mỗi lần chạy.

## Chụp và quay lại

`rr`ghi lại một lần chạy và tái phát nó theo định nghĩa dưới gdb, với thực hiện ngược: đặt một điểm quan sát trên giá trị bạn quan tâm và `reverse-cont`chạy ngược lại để viết. Dự án tự mô tả mình như "Bạn ghi lại một lần thất bại, sau đó debug ghi lại, theo cách xác định, nhiều lần bạn muốn". Phiên bản hiện tại là 5.9.0 của năm 2025-02-13, theo giấy phép MIT với khối BSD-2-Clausure. Nó chỉ là Linux. Nó cần bộ đếm hiệu suất phần cứng để đếm các chi nhánh, vì vậy nó chạy trên Intel Nehalem và sau đó, một số lõi AMD Zen, và "một số kiến trúc nhỏ AArch64 (ví dụ: ARM Neoverse N1 hoặc Apple Silicon M-series) " dưới Linux. Bên trong một máy ảo các bộ đếm phải được ảo hóa, và wiki dự án nói "Không có ảo hóa khác trên Mac cũng không", do đó Docker và Colima trên máy này không thể chạy nó. Pernosco là dịch vụ thương mại được xây dựng trên các bản ghi âm rr.

Gdb có một bộ ghi âm phần mềm của riêng mình. `record full`ghi lại "một nhật ký thực hiện quy trình" với giới hạn mặc định là 200.000 hướng dẫn, và `record btrace`sử dụng Intel branch tracing và "không ghi dữ liệu". Không có trong lldb. Trên máy macOS này, bản sao lưu của cục là ghi: cùng một kế hoạch trên cùng một binary tạo ra các điểm dừng tương tự trong cùng một thứ tự, và bộ cố định kiểm tra pin thứ tự đó.

## Những gì một người chạy thử nghiệm

Một run chứng minh một đầu vào trên một build. C tiêu chuẩn định nghĩa hành vi không xác định là "hành vi, khi sử dụng cấu trúc chương trình không thể di chuyển hoặc sai lầm hoặc dữ liệu sai lầm, mà tài liệu này không áp đặt yêu cầu", vì vậy một chương trình tràn một chữ ký `int`có thể hợp pháp in các kết quả khác nhau tại `-O0`và `-O2`Bài học 36 đáp ứng điều này với `percent_change`UBSan biến câu hỏi thành một điểm dừng:`-fsanitize=signed-integer-overflow -fsanitize-trap=undefined`làm cho quá tải "đã thực hiện một lệnh bẫy", mà rơi vào lldb như một điểm dừng với một lý do.

Mã tối ưu cũng di chuyển những gì bạn muốn xem. Hướng dẫn của GDB nói "những người tối ưu hóa đã sắp xếp lại mã của bạn; debugger cho bạn thấy những gì thực sự có" và một biến được tối ưu hóa ra khỏi sự tồn tại là một "GDB không bao giờ thấy". GDB in một giá trị như `<optimized out>`, và nguồn của nó tách ra nó từ `<unavailable>`: tối ưu hóa ra "không thực sự tồn tại trong chương trình", không có sẵn " tồn tại trong chương trình (trên cấp máy), nhưng GDB không có phương tiện để đạt được nó".`<variable not available>`Khi bộ đếm chương trình nằm ngoài mọi phạm vi của danh sách vị trí DWARF của biến. Một điểm giám sát trên một địa phương sống trong một sổ đăng ký không bao giờ được kích hoạt, bởi vì một sổ đăng ký không phải là bộ nhớ.`-O2`chạy trên cho thấy trường hợp cực đoan: toàn bộ chức năng đã được gấp đi, và sự im lặng của một điểm quan sát không bao giờ được thiết lập chứng minh không có gì.

Vì vậy, dây đeo viết ba loại hồ sơ và không bao giờ là thứ tư.`confirmed`Một điểm dừng mà đã thử nghiệm và không đồng ý là`refuted`Một tuyên bố không dừng lại có thể kiểm tra là`not-observed`, với lý do, và các điểm đếm hit là một phần của lý do đó.`observed`hồ sơ với thẩm quyền `controlled-replay`, và giữ cho thứ ba là một người không biết.

## Lắp đặt lỗi chỉ riêng của bạn trên macOS

Trên Apple silicon, các dấu hiệu liên kết cho bạn.`ld(1)`nói về `-adhoc_codesign`: "Phụ thể cho Apple Silicon binaries là được code-design ad-hoc". `codesign -dvvv account-O0`trên các dấu ấn của thiết bị:

```text
Format=Mach-O thin (arm64)
CodeDirectory v=20400 size=387 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
Signature=adhoc
TeamIdentifier=not set
```

`0x20002`là `CS_ADHOC`(`0x2`) cộng với`CS_LINKER_SIGNED`(`0x20000`), "Điều tự động được ký bởi linker" trong tiêu đề ký mã của Apple. `codesign -d --entitlements -`in không có gì sau tên thực thi: Binary không có quyền. lldb khởi động nó, nhấn mỗi điểm vỡ, đặt một điểm giám sát phần cứng, và viết một lõi, với `DevToolsSecurity -status`báo cáo "Phương thức phát triển hiện đang bị vô hiệu hóa" và Bảo vệ tính toàn vẹn hệ thống được bật.

Hai quyền kiểm soát ai có thể che lỗi gì, và họ ngồi ở phía đối diện. `com.apple.security.cs.debugger`là cho debugger: "Một giá trị Boolean cho thấy nếu ứng dụng là một debugger và có thể gắn vào các quy trình khác hoặc nhận các cổng nhiệm vụ".`debugserver`mang hình dạng riêng tư của nó, và `codesign -d --entitlements -`trên danh sách sao chép của các công cụ dòng lệnh `com.apple.private.cs.debugger`- `com.apple.private.set-exception-port`- `com.apple.private.thread-set-state`, và`com.apple.private.logging.diagnostic`- `com.apple.security.get-task-allow`Xcode tiêm vào các bộ sưu tập lỗi, loại bỏ nó khi xuất khẩu, và công chứng từ chối một binary vẫn còn nó. Các kỹ sư của Apple nói rằng quy tắc cho việc từ chối: cổng nhiệm vụ bị từ chối khi mục tiêu có thời gian chạy cứng được bật và không có Ứng dụng này được sử dụng để làm các công cụ khác.`get-task-allow`Một cái đơn giản`clang`build không cứng và không kích hoạt bất kỳ điều kiện nào.`codesign --options runtime`, ký lại với `codesign -s - -f --entitlements get-task-allow.plist`trước khi gỡ lỗi.

Ba sự kiện khác đóng phần. Đầu tiên, bạn có thể thấy hộp thoại "Developer Tools Access cần kiểm soát một quá trình khác để tiếp tục debugging" lần đầu tiên trong một phiên đăng nhập; `sudo DevToolsSecurity -enable`xóa mật khẩu bổ sung cho các thành viên của `admin`hoặc `_developer`Group. thứ hai, bạn không vô hiệu hóa SIP để gỡ lỗi mã của riêng bạn. Apple nói "Bạn không cần phải vô hiệu hóa SIP để chạy và gỡ lỗi các ứng dụng từ Xcode", và thành phần SIP duy nhất chạm vào gỡ lỗi là một `csrutil enable --without debug`Thứ ba, hộp cát của Seatbelt trong phiên này chặn`task_for_pid`hoàn toàn, và bộ phận `sandbox-O0.lldb.txt`Một cuộc chạy mà không thể bắt đầu là một sự kiện môi trường, và vòng xoáy báo cáo nó như vậy.

Tất cả trong bài học này áp dụng cho các chương trình bạn biên soạn. Các lệnh tương tự sẽ gắn vào một quá trình khác chỉ khi chủ sở hữu của nó chọn, và không có gì dạy ở đây làm thế nào để thay đổi điều đó.

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một báo cáo JSON trên các bản sao lưu được lưu. Đối với mỗi build nó liệt kê các điểm vỡ với độ phân giải và số lượng hit, số lượng điểm giám sát phần cứng, mỗi dừng với các sổ đăng ký và lập luận, tình trạng thoát, sản xuất của chương trình, lỗi lldb in, và các yêu cầu với phán quyết của họ và các hồ sơ bằng chứng đằng sau chúng. Nó thêm vào các chuyến đi trung tâm, kết quả API Python, lỗi hộp cát, và các công cụ bên ngoài nào không có trên máy này.

Hình dạng dự kiến:

```json
{
  "program": "account.c",
  "variants": {
    "O0": {
      "binary": "account-O0",
      "breakpoints": {"1": {"spec": "name=bump", "address": "0x1000004bc", "resolved": true, "hits": 1}, "...": "..."},
      "hardwareWatchpoints": 4,
      "watchpoints": {"1": {"address": "0x16fdfe00c", "size": 4, "type": "m", "hits": [[250, 255]], "hitCount": 1}},
      "stops": [{"index": 0, "pc": "0x1000004bc", "function": "bump", "kind": "entry", "registers": {"x0": "0x16fdfe008", "x1": "0x5"}, "...": "..."}],
      "exitStatus": 0,
      "claims": [{"id": "arg-registers", "verdict": "confirmed", "confirmed": 5, "refuted": 0, "not-observed": 0, "...": "..."}],
      "evidence": [{"claim": "arg-registers", "verdict": "confirmed", "stop": 0, "observation": "bump: x0 = 0x16fdfe008 and a = 0x000000016fdfe008, x1 = 0x5 and by = 5"}]
    },
    "O2": {"stops": [], "claims": [{"id": "calls", "verdict": "refuted", "...": "..."}], "...": "..."}
  },
  "core": {"savedAt": {"function": "bump", "pc": "0x1000004bc"}, "labelString": "", "...": "..."},
  "types": {"python": "3.9.6", "size": 32, "...": "..."},
  "sandbox": {"stops": 0, "errors": ["process exited with status -1 (attach failed ((os/kern) invalid address))"]},
  "absentTools": ["bpftrace", "gdb", "llvm-objdump", "ltrace", "rr", "strace"]
}
```

Đọc `code/main.py`theo thứ tự này:

1. `Listing`phân tích `llvm-objdump -d`văn bản thành các chức năng và hướng dẫn, và `Function.conditional_branches()`tìm thấy các nhánh với mục tiêu và các vụ rơi.
2. `struct_layout()`đọc cấu trúc và các mục thành viên từ `llvm-dwarfdump`- Thư.
3. `lift_condition()`biến một nhánh điều kiện thành một dự đoán, bài học 34 bước cho `tbz`- `cbz`, và các hình thức so sánh và nhánh.
4. `Plan.commands()`viết tệp lệnh lldb từ danh sách, và `Plan.lldb_command()`là sự gọi hàng loạt.
5. `parse_transcript()`đi bộ đầu ra theo thứ tự và xây dựng `Stop`ghi với các sổ đăng ký, bộ nhớ, biến và giá trị điểm đồng hồ, cộng với bảng điểm chia cắt và trạng thái thoát.
6. `claims_for()`nêu tám yêu cầu, và `evaluate()`xếp hạng họ dừng lại bởi dừng lại với `_check_*`chức năng.
7. `rollup()`Giảm hồ sơ xuống còn một phán quyết cho mỗi yêu cầu, với sự bác bỏ ưu tiên hơn sự xác nhận.
8. `capture()`và `capture_extras()`sản xuất các thiết bị, và `live()`lặp lại toàn bộ vòng lặp trên một xây dựng mới khi `clang`và `lldb`có thể chạy.

Có thêm bốn lệnh nữa.`python3 code/main.py plan O0`in file lệnh cho một build. `python3 code/main.py commands`in bảng GDB và LLDB. `python3 code/main.py tools`báo cáo các công cụ bên ngoài đang được sử dụng `PATH`- `python3 code/main.py live O0`biên soạn `account.c`Trong một thư mục tạm thời, kế hoạch từ danh sách mới của nó, chạy lldb, và xếp hạng các yêu cầu chống lại chạy đó. bên trong một hộp cát báo cáo rằng lldb không thể khởi động quá trình, với lỗi, và thoát 1.

## Sử dụng nó

Sử dụng dây đeo trên một chương trình của riêng bạn theo thứ tự này.

1. Hãy xây dựng nó với `-g`và mức độ tối ưu hóa bạn sẽ gửi. giữ các nhị phân, dSYM của nó hoặc DWARF của nó, và `llvm-objdump -d`cùng nhau nhắn tin.
2. Hãy viết các yêu cầu trước khi chạy. Mỗi yêu cầu đặt tên cho một chức năng, một sổ đăng ký hoặc địa chỉ hoặc một sự bù đắp, một giá trị dự kiến hoặc cạnh, và bài học hoặc tài liệu mà nó đến từ. Một yêu cầu bạn viết sau khi nhìn thấy dừng mô tả dừng và không kiểm tra gì.
3. Tạo kế hoạch từ danh sách và đọc nó. Mỗi địa chỉ trong nó nên theo dõi đến một dòng trong danh sách. Nếu điểm chia cắt không có dòng như vậy, hãy loại bỏ nó.
4. Đưa ra một lần trong chế độ batch và giữ bản ghi với dòng lệnh và phiên bản debugger trong tiêu đề của nó. Bản ghi là bằng chứng. Các phán quyết được lấy từ nó, và bất cứ ai có thể lấy lại chúng.
5. Đào tạo.`not-observed`ghi lại và lý do của nó trước khi bạn đọc các xác nhận. lý do cho bạn biết những tuyên bố cần một đầu vào khác, một xây dựng khác, hoặc điểm phá vỡ khác.
6. Thực hiện xây dựng tối ưu hóa với các yêu cầu tương tự. Hi vọng các điểm chia cắt được giải quyết với không truy cập nơi biên dịch viên được xếp vào, và giữ các yêu cầu đó mở.
7. Đưa các hồ sơ được xác nhận và bác bỏ vào sổ cái bài học 35 như `observed`, thẩm quyền`controlled-replay`Để lại những người không được quan sát là không biết với số điểm đập vỡ gắn liền.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: đọc một stop bằng tay

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/code
python3 -q
```

Đi chạy:

```python
from main import *
t = load_transcript("session-O0.lldb.txt")
s = t.stops[0]
hex(s.pc), s.function, s.reason, s.registers
[hex(w) for w in s.memory[:8]]
s.struct_pointer().fields
```

Trước dòng thứ hai, ghi lại từ nào bạn mong đợi chứa 250 và hai từ nào chứa 1,25.`struct.unpack("<d", struct.pack("<II", s.memory[4], s.memory[5]))`và so sánh.`t.stops[1].watch_hit`và `t.stops[1].pc`, và tìm địa chỉ đó trong `account-O0.objdump.txt`: đó là hướng dẫn sau cửa hàng.

### Phòng thí nghiệm B: chi nhánh và người kế nhiệm của nó

```python
plan = make_plan("O0")
plan.branches()
classify = plan.listing.function("classify")
[lift_condition(classify, b, "a->balance")[0] for b in plan.branches()]
[(hex(s.pc), s.struct_pointer().field_int("balance")) for s in t.stops_in("classify")]
```

Đáp lại mỗi điểm dừng cạnh với điểm dừng đầu vào của nó và quyết định, trước khi bạn nhìn vào bằng chứng, người kế nhiệm predicate dự đoán.`[e.to_dict() for e in evaluate(plan, t, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim.startswith("branch")]`và so sánh.

### Phòng thí nghiệm C: chạy không bao giờ dừng lại

```python
o2 = load_transcript("session-O2.lldb.txt")
len(o2.stops), o2.exit_status, o2.hits()
o2.errors[:3]
make_plan("O2").branches()
rollup(evaluate(make_plan("O2"), o2, struct_layout(open("fixtures/account-O2.dwarfdump.txt").read(), "account")))
```

Hãy giải thích cho mỗi người `not-observed`bằng lời của riêng bạn, sau đó mở `account-O2.objdump.txt`và tìm được bốn liên tục trong `main`Nó thay thế cho những cuộc gọi.`DW_TAG_inlined_subroutine`trong `account-O2.dwarfdump.txt`với `count_tags()`- Tôi không biết.

### Phòng thí nghiệm D: phá vỡ bằng chứng

```python
text = open("fixtures/session-O0.lldb.txt").read().replace("x1 = 0x0000000000000005", "x1 = 0x0000000000000006", 1)
broken = parse_transcript(text)
[e.to_dict() for e in evaluate(plan, broken, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim == "arg-registers"][:2]
```

Một sổ đăng ký được chỉnh sửa là đầu tiên `arg-registers`ghi lại `refuted`và việc lăn lên cùng nó, trong khi bốn mục khác vẫn còn `confirmed`Rồi xóa `old value: 250`Đường trước điểm quan sát dừng lại và quan sát `store-once`rơi xuống`not-observed`Một người đánh giá không thể làm thất bại là không đánh giá.

Nếu Ildb có thể khởi động một quá trình trong vỏ của bạn, kết thúc với `python3 main.py live O0`và `python3 main.py live O2`Các địa chỉ của hàng sẽ khác với các thiết bị.

## Phòng thí nghiệm thực hành

Lỗi kéo dài với một tuyên bố về vòng lặp trong `sum_balances`- Tôi không biết.

Yêu cầu:

- Tìm vòng lặp phía sau cạnh của `sum_balances`trong `-O0`danh sách với `conditional_branches()`và thêm một điểm phá vỡ ở đầu vòng.
- Thêm một yêu cầu mà tiêu đề thực hiện `count + 1`thời gian cho `count`= 3, đó là bài học 33 cạnh sau cộng với bài kiểm tra thoát.
- Cung cấp nút dừng hoặc kế hoạch để nút đọc khe xếp hàng của bộ đếm vòng lặp tại mỗi nút dừng tiêu đề, và viết một `_check_loop()`ghi lại chuỗi các giá trị đối lập.
- Lấy lại bản sao với `python3 main.py capture O0`trên một máy mà lldb có thể khởi động, và chạy lại bộ.
- Thêm một bài kiểm tra chỉnh sửa một giá trị đếm trong bản sao và khẳng định sự quay của yêu cầu `refuted`- Tôi không biết.

Thành công có nghĩa là báo cáo cho thấy tiêu đề dừng lại theo thứ tự với các giá trị đối lập của họ, và `-O2`run giữ lại quyền yêu cầu mới `not-observed`với lý do rằng vòng lặp đã được vectorized hoặc gấp đi.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-dynamic-analysis-of-your-own-program.md`Sử dụng nó để biến một chương trình bạn đã xây dựng, danh sách của nó, và một danh sách các yêu cầu tĩnh thành một bản sao debugger được lưu và một phán quyết cho mỗi yêu cầu, với điểm dừng mà đã tạo ra mỗi phán quyết và lý do cho mọi yêu cầu không được tuân thủ. Nó áp dụng cho Claude, Cursor, Codex, OpenClaw, Hermes, hoặc bất kỳ đại lý nào đọc SKILL.md.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Bộ chạy mà không có LDB. Nó đọc các bản ghi được ghi lại một lần vào`code/fixtures/`Việc kiểm tra phải chứng minh:

- trình phân tích danh sách tìm thấy bốn hàm với phạm vi của chúng và hai nhánh điều kiện của `classify``-O0`Với mục tiêu và thâm nhập
- thang máy của `tbz w8, #0x1f`là `a->balance >= 0`và thang máy của `subs`+`b.le`là `a->balance <= 200`
- `main``-O0`gọi`bump`- `classify`ba lần, và `sum_balances`, và`main``-O2`Chỉ gọi thôi `printf`
- x86-64 `j<cc>`mnemonics là điều kiện và `jmp`và `callq`không
- DWARF dump tạo ra một cấu trúc 32 bit với các thành viên ở 0, 4, 8, 16 và 24
- `-O2`DWARF có bốn phần mềm và không có mục phần mềm được xếp vào, và `nm`vẫn liệt kê ba chức năng
- kế hoạch bằng với tập tin lệnh được cam kết cho cả hai build, và tiêu đề bản sao ghi lại lệnh lldb đã chạy nó
- `-O0`Transcript có mười một điểm dừng trong các hàm dự kiến, trạng thái thoát 0, và bốn dòng đầu ra
- Khả năng phát ra nấm được gắn vào điểm dừng sau nó, với `x1`= 5, bộ nhớ bắt đầu từ `x0`, và chuỗi nhãn
- bảng điểm chia có độ phân giải và số lượng hit 1, 3, 1, 2, 1, 1, 1
- điểm quan sát là 4 byte của kiểu sửa đổi tại `x0 + 4`, bị đánh một lần với giá trị cũ 250 và giá trị mới 255, và bốn khe phần cứng được báo cáo
- `-O2`Transcript có 0 điểm dừng, 3 điểm dừng được giải quyết với 0 lần truy cập, không có điểm giám sát, và một lỗi cho mỗi không được sử dụng `continue`
- khởi động sandbox thất bại trước bất kỳ dừng với lỗi đính kèm
- Đi lại và đi lại của lõi giữ lại sự trở lại và `balance`= 250 và mất dây đằng sau `label`
- Python API đọc năm trường, kích thước 32, và hàm phạm vi mà không có một quy trình
- một bản sao x86-64 viết tay phân tích với `rdi`- `rsi`, và`rip`
- mọi yêu cầu được xác nhận tại `-O0`với 5, 11, 3, 2, 1, 1, 1, 1 hồ sơ
- bằng chứng chi nhánh nêu tên giá trị, điều kiện và cạnh
- bằng chứng field-offset giải mã các từ thông qua bố cục DWARF
- kho và bằng chứng bước có giá trị cũ và mới và số dư ba hàng
- `-O2`run bác bỏ các cạnh gọi và để lại các yêu cầu khác không được quan sát
- một giá trị đăng ký được chỉnh sửa được bác bỏ, một hit watchpoint bị xóa không được quan sát, và bác bỏ thắng rollup
- Bản đồ lệnh có các biểu mẫu gdb và lldb cho mỗi hàng, và bảng phần cứng đặt tên bốn sổ đăng ký lỗi x86
- demo liệt kê các công cụ không có thay vì thất bại, và chế độ sống báo cáo công cụ thiếu tên
- dữ liệu số liệu đến từ cả hai phiên và mô-đun trang web nhúng dữ liệu tương tự

## Các chế độ sản xuất thất bại

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Resolved breakpoint with zero hits | "the function runs" or "the function is dead" | a full run with exit status, hit counts, and the verdict `refuted` for the call edge only |
| Register read at the wrong stop | "`x1` = 5 inside `classify`" | compare only declared arguments at the entry stop |
| Struct read without offsets | a column of hex words | every word mapped to a `DW_AT_data_member_location` and compared with `frame variable` |
| Branch graded from the mnemonic | "`tbz` means taken when negative" | the lifted predicate from the encoding and the stop at the successor |
| Watchpoint on a register-resident local | "no write happened" | the watchpoint was set on an address and was hit, or the record is `not-observed` |
| Auto-continue breakpoints | a clean transcript with no stops | plain breakpoints, a stop hook, and a continue budget |
| Address breakpoint without a module | `unresolved, hit count = 0` | `-s MODULE` so the listing address resolves to a load address |
| First command error ends the batch | no `breakpoint list` at the end | `interpreter.stop-command-source-on-error false` |
| Stack-style core read as full memory | `label = ""` reported as the program's value | the core style, the pointer, and the segment it points into |
| Sandboxed shell | "lldb is broken" | `attach failed ((os/kern) invalid address)` recorded as an environment fact |
| Hardened target without `get-task-allow` | "macOS forbids debugging" | the two conditions from Apple's rule, and a re-sign of your own binary |
| Transcript discarded after grading | verdicts with no source | the transcript file, its command line, and the debugger version |

## Quy tắc hoạt động

Lập kế hoạch dừng từ danh sách, chạy một lần trong chế độ hàng loạt, giữ bản sao và đánh giá mọi yêu cầu tĩnh tại mỗi dừng có thể kiểm tra nó. Viết xác nhận hoặc bác bỏ chỉ từ một dừng, viết không được quan sát với số lượng hit và lý do, và không bao giờ để một điểm vỡ được giải quyết đứng trong một chạy.

## Đọc thêm

- [LLDB Tutorial: command grammar, breakpoints, watchpoints, stop hooks](https://lldb.llvm.org/use/tutorial.html)
- [lldb(1) manual page: --batch, --one-line, --source, --core](https://lldb.llvm.org/man/lldb.html)
- [GDB to LLDB Command Map](https://lldb.llvm.org/use/map.html)
- [LLDB Python Reference: SBTarget, SBFrame, SBValue, and the embedded interpreter](https://lldb.llvm.org/use/python-reference.html)
- [LLDB Caveats: the Python build lldb links against](https://lldb.llvm.org/resources/caveats.html)
- [LLVM 23.1.3 release](https://github.com/llvm/llvm-project/releases/tag/llvmorg-23.1.3)
- [GDB 18.1 release announcement, 2026-09-25](https://sourceware.org/pipermail/gdb-announce/2026/000150.html)
- [GDB manual: Process Record and Replay](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Process-Record-and-Replay.html)
- [GDB manual: Debugging Optimized Code](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Optimized-Code.html)
- [GDB wiki: Permissions on Darwin, code signing a debugger](https://sourceware.org/gdb/wiki/PermissionsDarwin)
- [gdb-patches: Initial AArch64-Darwin support series, October 2025](https://sourceware.org/pipermail/gdb-patches/2025-October/222196.html)
- [Homebrew gdb formula pull request adding arm64 bottles](https://github.com/Homebrew/homebrew-core/pull/209753)
- [ptrace(2), Linux manual page](https://man7.org/linux/man-pages/man2/ptrace.2.html)
- [lldb debugserver MachTask.mm: task_for_pid and task_set_exception_ports](https://github.com/llvm/llvm-project/blob/main/lldb/tools/debugserver/source/MacOSX/MachTask.mm)
- [Intel SDM Volume 2: INT n, INTO, INT3, INT1](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Intel SDM Volume 3: debug registers DR0 to DR7 (Debug, Branch Profile, TSC, and Resource Monitoring Features)](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm A64 ISA: BRK, Breakpoint instruction](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/BRK--Breakpoint-instruction-)
- [Arm A64 ISA: TBZ, Test bit and branch if zero](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/TBZ--Test-bit-and-branch-if-zero-)
- [Arm Architecture Reference Manual, D2.9 Watchpoint exceptions](https://developer.arm.com/documentation/ddi0487/latest/)
- [Apple ld(1): -adhoc_codesign](https://keith.github.io/xcode-man-pages/ld.1.html)
- [Apple ld64 LinkEdit.hpp: CS_LINKER_SIGNED](https://github.com/apple-oss-distributions/ld64/blob/59a99ab60399c5e6c49e6945a9e1049c42b71135/src/ld/LinkEdit.hpp)
- [Apple: Debugging Tool Entitlement, com.apple.security.cs.debugger](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.debugger)
- [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [Apple: Resolving common notarization issues, the get-task-allow entitlement](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)
- [Apple: Disabling and Enabling System Integrity Protection](https://developer.apple.com/documentation/security/disabling-and-enabling-system-integrity-protection)
- [Apple Developer Forums: debugserver may not get the taskport of a hardened process](https://developer.apple.com/forums/thread/127544)
- [Apple DevToolsSecurity(8)](https://keith.github.io/xcode-man-pages/DevToolsSecurity.8.html)
- [Apple core(5)](https://keith.github.io/xcode-man-pages/core.5.html)
- [Apple Technical Note TN2124: Mac OS X Debugging Magic, core dumps](https://developer.apple.com/library/archive/technotes/tn2124/_index.html)
- [lldb `process save-core` help text](https://github.com/llvm/llvm-project/pull/143126)
- [core(5), Linux manual page](https://man7.org/linux/man-pages/man5/core.5.html)
- [coredumpctl(1)](https://man7.org/linux/man-pages/man1/coredumpctl.1.html)
- [Apple dtrace(1)](https://keith.github.io/xcode-man-pages/dtrace.1.html)
- [Apple dtruss(1m)](https://keith.github.io/xcode-man-pages/dtruss.1m.html)
- [strace releases](https://github.com/strace/strace/releases)
- [ltrace](https://ltrace.org/)
- [bpftrace CHANGELOG](https://github.com/bpftrace/bpftrace/blob/master/CHANGELOG.md)
- [rr project](https://rr-project.org/)
- [rr 5.9.0 release](https://github.com/rr-debugger/rr/releases/tag/5.9.0)
- [rr wiki: Building And Installing, hardware and VM requirements](https://github.com/rr-debugger/rr/wiki/Building-And-Installing)
- [Clang UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)
- [ISO/IEC 9899:2024 working draft N3220, clause 3.5 undefined behavior](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf)
- [DWARF Debugging Information Format Version 5](https://dwarfstd.org/doc/DWARF5.pdf)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64)](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)
