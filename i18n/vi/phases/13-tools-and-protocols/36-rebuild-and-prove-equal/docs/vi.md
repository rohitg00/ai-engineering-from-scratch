# Xây dựng lại và chứng minh bằng nhau: Các thử nghiệm khác biệt, so sánh byte và vòng lặp bằng chứng

> Tham khảo của bạn chứng minh sự đồng thuận về các bài kiểm tra của bạn, vì vậy sự bình đẳng cần một lưới mà đạt đến mọi cạnh và các byte phù hợp sau khi chuyển đổi che giấu.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## Mục tiêu học tập

- Viết một bản tái tạo từ danh sách hướng dẫn và đặt tên cho hồ sơ bằng chứng mà nó xuất phát từ.
- Xây dựng một lưới đầu vào với một lớp cho mỗi nguy cơ: bảo vệ không, giá trị tiêu cực, chia cắt, quá tải 32 bit và bẫy chia.
- Hãy chạy bản gốc và xây dựng lại trong một chương trình và ghi lại mọi tế bào, bao gồm cả một cái bẫy.
- Tái tạo lại lại với các cờ ban đầu và so sánh các byte chức năng sau khi che giấu các trường di chuyển.
- Đọc các định vị của một điểm di chuyển và so sánh chúng, để một chữ cái sai không thể đi qua.
- Đưa máy chủ MCP của rea từ một khách hàng nhỏ và ghi lại từng bước với ID bằng chứng của nó.
- Mint một hồ sơ chứng minh bị đóng thất bại mà ID là một hash trên các tuyên bố và các liên kết bằng chứng của nó.

## Vấn đề

Ông đã hỏi rea về hồ sơ chức năng của `percent_change`trong chúng ta `ledger-x86_64-O1.o`Ghidra 12.1.4 trả lại mã giả, và đại lý viết C này từ đó:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

Bốn thử nghiệm qua:`(100, 150)`đưa ra 50, `(200, 100)`-50`(0, 5)`cho 0, `(50, 100)`- Đưa 100 đô.`grade`4`if`Báo cáo cho biết "được xác minh".

Báo cáo đó không trả lời bất kỳ câu hỏi nào:

- Cái gì mà bản gốc quay lại khi `(after - before) * 100`không phù hợp với 32 bit?
- Số tiền đầu tiên trả lại là 110?
- Liệu bản tái tạo có biên dịch với cùng 16 byte như bản gốc không?
- Khi hai hàm được biên soạn có cùng một byte, các di chuyển của chúng chỉ ra cùng một liên tục?
- Bằng chứng nào cho thấy việc xây dựng lại được thực hiện, và liệu nhân viên đã đọc danh sách hay mã giả không?
- Tình trạng của chứng minh là gì trên máy chủ không có trình biên dịch C?

Mỗi mục tiêu trong bài học này là một chương trình mà chúng tôi đã viết và biên soạn.

```figure
re-36-prove-equal
```

## Bằng chứng cho thấy gì

- Lòng đại lý vào `code/main.py`Tôi đã gọi 6 lần tới Real 6.5.0 qua đài phát thanh.`code/fixtures/runs/agent-run.json`- Thư chủ trả lời`initialize`với phiên bản giao thức `2025-11-25`Ba cuộc gọi trả lại hồ sơ bằng chứng:

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

Cuộc gọi đầu tiên trả tiền cho nhập khẩu và tự động phân tích Ghidra.`confidence: "observed"`- `authority: "shipped-artifact"`, và SHA-256 của đối tượng,`9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`Ghidra tải vật thể được chuyển nhượng với `.text``0x100000`, vậy `percent_change`ngồi ở `0x100000`và `grade``0x100010`- Tôi không biết.

Mã giả của `percent_change`là nơi `long`xuất phát từ:

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{
  long lVar1;
  undefined1 auVar3 [16];
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  ...
}
```

Người phân tích đã thấy`cltd`và `idivl`viết cả hai `edx`và `eax`và mô hình hóa một giá trị trả lại 16 byte với một phân chia 64 bit.

```
0x100000: TEST EDI, EDI
0x100002: JZ 0x0010000d
0x100004: SUB ESI, EDI
0x100006: IMUL EAX, ESI, 0x64
0x100009: CDQ
0x10000a: IDIV EDI
0x10000c: RET
0x10000d: XOR EAX, EAX
0x10000f: RET
```

Mỗi hoạt động đều rộng 32 bit.`IMUL EAX, ESI, 0x64`nhân lên 32 bit và giữ cho nửa thấp. `CDQ`- Tăng sóng`eax`vào`edx`, và`IDIV EDI`chia cặp 64-bit bằng một bộ chia 32-bit. Một xây dựng lại sau danh sách là `100 * (after - before) / before`trong `int`- Tôi không biết.

- `grade`ghi lại có cùng hình dạng.`*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`, và một biểu thức mặc định không thể đọc được được xây dựng từ `0x66666667`. Danh sách cho thấy sự chia rẽ bằng 10 như `IMUL RAX, RAX, 0x66666667`- `SAR RCX, 0x22`- `SHR RAX, 0x3f`- `ADD ECX, EAX`- Vậy thì`ADD ECX, -0x6`- `CMP ECX, 0x4`, và`JA`giữ hàng chục từ 6 đến 10.`XOR EAX, EAX`trước khi so sánh là mặc định của 0. `LEA RCX, [0x1000b4]`và `MOV EAX, dword ptr [RCX + RAX*0x4]`đọc một bảng gồm 5 mục 4 byte.

Bước 4 đọc 20 byte:`01000000 02000000 03000000 04000000 04000000`- Bàn là`1, 2, 3, 4, 4`cho mười, 6, 7, 8, 9, 10. Đó là `switch`trong `ledger.c`, với `case 10`và `case 9`chia sẻ giá trị 4.

Cả hai bằng chứng trong trang bằng chứng của rea bắt đầu từ danh sách và từ `read_bytes`DX-Ball đầu tiên được đặt tên là`FUN_00406400(void)`không có đầu vào hàng, và hướng dẫn xem đã sửa nó. đọc danh sách trước. trích dẫn ghi nhận, sau đó viết C.

## Viết những ứng cử viên

Dữ liệu thư mục `code/fixtures/candidates/`có tám bản tái tạo, một hàm cho mỗi tệp. Bốn theo danh sách hoặc biên soạn cho cùng một mã. Bốn là hợp lý và sai, hoặc sai theo cách một bài kiểm tra viết tay tìm thấy.

| File | Source | What it does |
|---|---|---|
| `percent_change_mul_first.c` | `100 * (after - before) / before` | the listing in C |
| `percent_change_split.c` | `(after * 100 - before * 100) / before` | different text, same bytes after clang folds it |
| `percent_change_wide.c` | `(int)(((long)after - before) * 100 / before)` | the pseudocode's `long`, divides before it wraps |
| `percent_change_div_first.c` | `(after - before) / before * 100` | divides first, so rounding differs |
| `grade_switch.c` | `switch (score / 10)` with the five cases | the original source |
| `grade_table.c` | `unsigned slot = score / 10 - 6; slot < 5 ? points[slot] : 0` | the listing in C |
| `grade_thresholds.c` | `if (score >= 90) return 4; ...` | no upper bound on the top band |
| `grade_case10_wrong.c` | `case 10: return 3;` | one table entry wrong |

Mỗi file được biên dịch với lệnh cố định, `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`Các đối tượng được biên soạn được thực hiện bên cạnh các nguồn để các thử nghiệm chạy trên một máy chủ mà không có clang.

## Bước 1: Thực hiện và so sánh

Định nghĩa của McKeeman năm 1998 về thử nghiệm khác biệt đòi hỏi " hai hoặc nhiều hệ thống tương đương" được cung cấp "các trường hợp thử nghiệm được tạo ra bằng cơ khí", và đối xử với một kết quả khác nhau, một đập hoặc một vụ tai nạn như là ứng cử viên lỗi. Ông đặt tên phần khó khăn: "Vấn đề xấu xí nhất trong việc kiểm tra là đánh giá kết quả của một thử nghiệm". Chúng ta không cần phải biết câu trả lời đúng. Chúng ta cần bản gốc và tái tạo để không có bất cứ nơi nào trên lưới mà đạt đến mọi nguy hiểm.

### Thiết kế lưới

`input_grid()`trong `code/main.py`tạo ra 92 tế bào.`percent_change`Nó cần mỗi cặp từ mười `before`giá trị và bảy `after`giá trị:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

Vì `grade`nó cần 22 điểm: cả hai bên của mỗi cạnh băng, âm, 0, 110, và hai `int`giới hạn.`classify()`Overflow có 32 tế bào, âm 17, ranh giới 14, bình 12 và bảo vệ 0 7. Truncation tiêu cực có 5, tròn 2, ngoài chuyển đổi 2, và bẫy 1.

Mỗi lớp tồn tại vì một lý do.`TEST EDI, EDI`Các tế bào âm kiểm tra phân chia cắt giảm: C và `idiv`vòng về hướng không, vậy `-9 / 10`là 0 và `-10 / 10`là -1. Các tế bào tròn kiểm tra rằng nhân xảy ra trước khi chia, vì vậy `(105 - 100) * 100 / 100`là 5 và không phải 0.`(after - before) * 100`vượt quá 32 bit. Một tế bào bẫy làm cho sản phẩm đóng gói bằng nhau`INT_MIN`với `before`bằng với -1.

Yang, Chen, Eide và Regehr xây dựng Csmith để tạo ra các chương trình không có hành vi không xác định. Một sự bất đồng của Oracle về hành vi không xác định là tiếng ồn và không bao giờ là báo cáo lỗi.

### Người lái xe và cái bẫy

`code/driver.c`đọc một tế bào mỗi dòng từ stdin và in các đầu vào, kết quả ban đầu và kết quả xây dựng lại. `build_harness()`biên soạn ứng viên với `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`, vì vậy cả hai phiên bản liên kết với một chương trình dưới tên khác nhau. trên một máy chủ x86-64 Linux, gốc là đối tượng cố định chính nó. trên bất kỳ máy chủ nào khác nó là`ledger.c`được biên soạn bằng phương thức bản địa, và các hồ sơ báo cáo `original_kind: fixture-source`- Tôi không biết.

Người lái cài đặt một `SIGFPE`xử lý với `sigsetjmp`và `siglongjmp`- Vì `before = -1`và `after = 536870911`, sự khác biệt là 536870912 và sản phẩm 32 bit kết thúc với -2147483648.`idiv`với cổ tức đó và một phân số -1 làm tăng ngoại lệ sai lầm chia.`trap`- Tôi không biết.

Trên AArch64, `sdiv`- Không có cái bẫy và trả lại -2147483648 cho cùng một operand.

### Kết quả

`prove_behaviour(PLAUSIBLE)`xây dựng `long`10 trường hợp ngây thơ đã qua, lưới đã thất bại trên 28 tế bào.

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

Tất cả 26 `percent_change`lỗi là các tế bào tràn với `|before| > 1`- Vì `before`bằng 1 hoặc -1 tỷ lệ 64 bit cắt giảm trở lại giá trị đóng gói, do đó các tế bào này đồng ý do ngẫu nhiên.`grade`thất bại vì chuyển đổi ban đầu không có lý do cho hàng chục 11 và trên, và `110 / 10`là 11.

`prove_behaviour(EQUAL)`xây dựng `percent_change_mul_first.c`và `grade_switch.c`Tất cả 92 tế bào đều đồng ý.`percent_change_div_first.c`thất bại trong hai trong bốn trường hợp ngây thơ, đó là trường hợp duy nhất một bài kiểm tra bằng tay tìm thấy.

`oracle_disagreements()`kiểm tra một điều thứ hai. `percent_change_model()`và `grade_model()`là mô hình Python của danh sách, với `wrap32()`cho 32-bit nhân và `idiv32()`cho quy tắc kiến trúc. báo cáo so sánh mô hình với nguyên bản được quan sát trên mỗi tế bào. Không bất đồng nghĩa với mô hình và nhị phân đồng ý trên mỗi tế bào. mô hình được lấy bằng chứng và chạy là bằng chứng được quan sát. báo cáo giữ chúng trong các lĩnh vực riêng biệt.

## Bước 2: Lập lại và so sánh

Hành vi trên lưới là một chân. chân thứ hai hỏi liệu việc xây dựng lại, được biên soạn với cùng một trình biên dịch và cờ, có tạo ra cùng một byte không. Dự án DX-Ball báo cáo "63 byte phù hợp" cho người hỗ trợ của nó. Dự án TH04 báo cáo sự phù hợp 2.139 byte. Mỗi người sử dụng trình biên soạn của thời kỳ của riêng họ. rea không thể tự làm điều này.`compare_functions`line-diffs cung cấp văn bản và gắn giới hạn "Sự lắp ráp là văn bản cung cấp không minh bạch; việc chuẩn hóa di chuyển không có sẵn".

### Đọc đối tượng

`ElfObject`trong `code/main.py`đọc một ELF64 chuyển thể đối tượng với `struct.unpack_from`Nó kiểm tra phép thuật, lớp 64-bit, dữ liệu nhỏ,`e_machine`62, và `e_type`1. sau đó nó đi bộ các tiêu đề phần, bảng chuỗi,`.symtab`, và mọi `.rela`Phần. Trong thiết bị, `percent_change`bắt đầu từ `.text`trục xuất 0 với kích thước 16 và `grade``0x10`với kích thước 46. `total`bắt đầu từ `0x40`với kích thước 31 và `grade_label``0x60`với kích thước 63.

16 byte của `percent_change`là `85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`- Chức năng không có chuyển chỗ.`grade`có một: bù đắp `0x26`bên trong chức năng, kiểu `R_X86_64_PC32`, biểu tượng`.rodata`, bổ sung`0x10`Nó thuộc về 7byte.`leaq`trong sự bù đắp`0x23`, có bốn byte cuối cùng là trường di chuyển.

### Mask, sau đó so sánh các hồ sơ

Trong một đối tượng RELA, thêm vào sống trong hồ sơ di chuyển, và bốn byte trường là không.`grade_switch.o`Một byte đơn giản so sánh đi qua trong khi hai di chuyển tên các địa điểm khác nhau. `mask_relocations()`làm cho trường ở cả hai bên bằng không, do đó phương pháp tương tự cũng đúng đối với các đối tượng REL và Mach-O, nơi trường mang thêm.

Vậy thì`prove_bytes()`so sánh các hồ sơ di chuyển theo phần bù đắp, loại và mục tiêu.`.rodata+0x10`Và ứng cử viên nói`.rodata-0x4`. Thêm khác nhau bởi vì đối tượng ứng cử viên không có `labels.rel`Table trước bàn chuyển đổi của nó. Một addend khác là một sự thay thế khác nhau, không phải là một chức năng khác nhau.

### Đọc các liên tục các điểm di chuyển tại

Đối với một trường liên quan đến PC kết thúc hướng dẫn của nó, CPU thêm địa chỉ hướng dẫn tiếp theo, do đó mục tiêu là biểu tượng cộng thêm cộng thêm 4. Trong bản gốc đó là `.rodata+0x14`, và trong ứng cử viên nó là `.rodata+0x0`- `read_table()`đọc 5 mục 4 byte ở đó.`1, 2, 3, 4, 4`- Tôi không biết.

Số 5 xuất hiện từ danh sách:`CMP ECX, 0x4`với `JA`chấp nhận chỉ số 0 đến 4, và `[RCX + RAX*0x4]`đọc 4 byte cho mỗi index. `CLAIMS`trong `code/main.py`ghi lại hình dạng đó cho `grade`và ghi lại không có chuyển nhượng đối với `percent_change`- Tôi không biết.

Bước này tồn tại do lỗi dự án TH08 ghi lại. So sánh cũ của nó "đã chơi lại địa chỉ mục tiêu vào trường di chuyển hướng, sau đó so sánh các byte hướng dẫn mà không cần kiểm tra dữ liệu chữ nổi ở địa chỉ đó. Nguồn `0.0`do đó có thể xuất hiện chính xác đối với mục tiêu `128.0`." Phong sửa đã kiểm tra 1.548 tham chiếu chữ nổi và sửa đổi 12 tham chiếu khác. `grade_case10_wrong.c`là phiên bản của chúng tôi của lỗi đó. 46 byte mã của nó bằng với bản gốc, hồ sơ di chuyển của nó có cùng hình dạng, và bảng của nó là`1, 2, 3, 4, 3`Chỉ có kiểm tra liên tục là thất bại.

### Kết quả

| Candidate | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 vs 16 | equal | none | none | pass |
| `percent_change_split` | 16 vs 16 | equal | none | none | pass |
| `percent_change_wide` | 16 vs 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 vs 18 | size differs | none | none | fail |
| `grade_switch` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_table` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_thresholds` | 46 vs 39 | size differs | 1 vs 0 | none | fail |
| `grade_case10_wrong` | 46 vs 46 | equal | same shape | `1,2,3,4,4` vs `1,2,3,4,3` | fail |

Hai kết quả đáng xem lại lần nữa.`percent_change_split.c`có văn bản nguồn khác nhau và các byte giống nhau, bởi vì clang xử lý tràn chữ ký như không xác định và gấp `after * 100 - before * 100`thành một nhân.`grade_table.c`cũng phù hợp với byte cho byte, do đó trình biên dịch đã đạt đến cùng một bảng từ một chỉ số array và từ một `switch`Một sự phù hợp bằng byte chứng minh rằng trình biên dịch này, với những cờ này, đã tạo ra cùng một mã từ ứng viên.

Kích thước là một chẩn đoán và không phải là một chấp nhận. các trang bằng chứng của rea ghi lại một ứng cử viên 1.825 byte với chiều dài đúng và 467 byte khác nhau.`wide`xây dựng lại là 26 byte vì `movslq`- `imulq`- `cqto`, và`idivq`Nó thay thế các biểu mẫu 32 bit.

## Cảnh sát Loop Over rea

65 trong số các công cụ MCP của rea không có lệnh CLI, và `verify_reconstruction`là một trong số họ. `McpStdioClient`trong `code/main.py`là khách hàng nhỏ nhất đến với họ.`npx -y rea-agents@6.5.0 mcp`, viết một yêu cầu JSON-RPC cho mỗi dòng cho stdin, và đọc một đối tượng JSON cho mỗi dòng từ stdout trên một chuỗi. Nó gửi `initialize`với phiên bản giao thức `2025-11-25`, sau đó `notifications/initialized`, sau đó `tools/call`. Thời hạn mặc định cho mỗi cuộc gọi là 330 s, cùng số rea cho phép một khởi động lạnh Ghidra.

`agent_loop()`làm 6 cuộc gọi và ghi lại mỗi cuộc gọi:

```json
{
  "step": 2,
  "tool": "analyze_function",
  "arguments": {"procedure": "percent_change"},
  "seconds": 6.31,
  "is_error": false,
  "evidence_id": "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd",
  "confidence": "observed",
  "authority": "shipped-artifact",
  "limitations": ["Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.", "..."],
  "result_sha256": "..."
}
```

Các hồ sơ chứng cứ đầy đủ được lưu trữ dưới danh tính của họ trong cùng một tệp.`table_address()`tìm thấy `LEA`và hoạt động trong `grade`danh sách và cung cấp cho nó `read_bytes`- `open_binary`- `get_evidence_bundle`, và`close_binary`không trả lại hồ sơ bằng chứng và được ghi lại với một ID không hiệu quả.

`run_agent(live=True)`lái xe rea khi `npx`đang trên đường và `GHIDRA_INSTALL_DIR`- Đặt tên thư mục, nếu không nó sẽ đặt lại vật cố định và nói như vậy trên stderr.`code/tests/fake_rea_server.py`là một máy chủ thay thế trả lời mỗi `tools/call`Với các bản ghi ghi cho cùng một công cụ và lập luận. Client và vòng lặp chạy chống lại nó trong mỗi lần thử nghiệm, mà không có rea, Ghidra, hoặc Java được cài đặt.

### Điều gì mà người xác minh của rea có thể và không thể nói

- Đúng vậy.`verify_reconstruction`"Pass" nghĩa là mỗi yêu cầu được tuyên bố đã được thông qua; nó không thiết lập sự tương đương thực hiện toàn cầu". Một yêu cầu về một chức năng so sánh văn bản nhà cung cấp từ `compare_functions`Một tuyên bố về hành vi so sánh hai lần ghi lại quá trình bắt bắt từ `compare_process_captures`Khi một hồ sơ nguồn có sự bao gồm cuộc gọi không đầy đủ, một yêu cầu về các cuộc gọi là `unknown`Không có gì trong rea biên soạn một hàm được xây dựng lại hoặc chạy nó trên lưới đầu vào của bạn.

sổ cái nghĩa vụ của rea mong đợi một hồ sơ chứng minh với `predicate_type: "rea.reconstruction-proof"`- `operation: "verify_reconstruction_obligations"`- `confidence: "observed"`, và`normalized_result.passed === true`Không có công cụ thực tế công cộng nào phát ra một.`build_proof()`trong `code/main.py`măng:

```json
{
  "predicate_type": "rea.reconstruction-proof",
  "operation": "verify_reconstruction_obligations",
  "confidence": "observed",
  "authority": "controlled-replay",
  "normalized_result": {
    "passed": true,
    "status": "pass",
    "claims": [
      {"claim_id": "percent_change.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "percent_change.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "grade.referenced-constants", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]}
    ]
  },
  "evidence_links": ["ev_e88b10dc...", "ev_67b6d3f9..."],
  "evidence_id": "ev_..."
}
```

Đơn vị nhận dạng là`ev_`cộng với SHA-256 của bản ghi mà không có ID, qua khóa sắp xếp nhỏ gọn JSON. `aggregate()`được đóng không thành công: `fail`thắng, thì `unknown`, và một danh sách yêu cầu trống là `unknown`. Trên một máy chủ không có trình biên dịch C hai yêu cầu hành vi là `unknown`, theo hồ sơ nói`unknown`ngay cả khi cả hai yêu cầu byte qua. `authority`là `controlled-replay`, bởi vì bằng chứng đến từ vòng xoáy của chúng ta và không chỉ từ các tệp đối tượng.

## Những gì nghiên cứu cho thấy

Liu, Raff và Micinski đo tám hệ thống phân tích trong chín cấu hình vào năm 2026. Các ứng viên đã vượt qua mọi bài kiểm tra tham chiếu bao gồm vẫn khác nhau về các đầu vào bị mờ. Tỷ lệ này là 4,9% tổng thể và lên đến 13% cho một hệ thống. Trong 300 chức năng thư viện GitHub và 287 chức năng dựa trên CVE, mô hình tinh chỉnh mạnh nhất đã nâng tỷ lệ xây dựng của Ghidra từ 75% lên 90%. Trên cùng các chức năng tỷ lệ phù hợp hành vi giảm từ 74% xuống còn 62%. Họ tìm ra nguyên nhân đến các trường hợp, loại hình, callees và lính canh đã phát minh ra thay thế những thứ không rõ ràng có thể nhìn thấy được một máy phân tích truyền thống để lại.

Chúng ta `percent_change_wide.c`là một trong những loại được phát minh.`long`Các nghiên cứu đã được tiến hành trong một năm, và kết quả được biên soạn, vượt qua mười thử nghiệm, và thất bại trong 26 tế bào tràn. Việc tái chế ngưỡng cấp là một bảo vệ được phát minh ra. Cả hai đều sẽ được tính là có thể thực hiện lại theo métrics LLM4Decompile, đó là biên soạn lại sản phẩm và chạy các tuyên bố của tiêu chuẩn.

DecompileBench đo 23.400 chức năng từ 130 chương trình thực. Nó tìm thấy các phương pháp LLM thấp hơn 52,2% về tính chính xác chức năng so với các máy giải trình công nghiệp, với điểm hiểu cao hơn.

Ba chứng minh mà trường sử dụng là ba chân bạn có thể xây dựng. Phoenix và DREAM tái biên soạn sản xuất và chạy các thử nghiệm của chương trình ban đầu. McKeeman và Csmith chạy đầu vào được tạo ra so với bản gốc với đầu vào được giữ trong hành vi được xác định. Ramos và Engler kiểm tra hai hàm C với thực hiện biểu tượng bị giới hạn, chứng minh sự bình đẳng trên tất cả các con đường được khám phá cho đến một kích thước đầu vào. Bài học này xây dựng hai bài học đầu tiên. Thứ ba là phòng thí nghiệm thực hành trong sổ sách chứng cứ của bài học 35 khi một lưới là quá nhỏ để tin tưởng.

## Hãy xây dựng nó

Đưa dây thắt thư viện tiêu chuẩn:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
```

Với clang trên đường đi, demo biên soạn cả hai cặp ứng cử viên và chạy 92 tế bào cho mỗi. Nó biên soạn lại tám ứng cử viên, tái trình diễn các ứng cử viên chạy, và mint hồ sơ chứng minh. Không có clang nó đọc các đối tượng đã cam kết và báo cáo các tuyên bố hành vi như`unknown`- Tôi không biết.

Hình dạng dự kiến trên arm64 Mac:

```json
{
  "host": "aarch64 Darwin",
  "originalKind": "fixture-source",
  "gridCells": 92,
  "plausible": {"naivePassed": true, "gridMismatches": 28, "oracleDisagreements": 0},
  "equal": {"naivePassed": true, "gridMismatches": 0, "oracleDisagreements": 0},
  "legTwo": {
    "percent_change_mul_first": {"status": "pass", "reasons": []},
    "percent_change_wide": {"status": "fail", "reasons": ["size 16 vs 26 bytes"]},
    "grade_case10_wrong": {"status": "fail", "reasons": ["referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"]}
  },
  "agentRun": {"mode": "replayed fixture", "server": {"name": "rea", "version": "6.5.0", "protocolVersion": "2025-11-25"}},
  "proof": {"status": "pass", "evidence_id": "ev_..."}
}
```

Đọc `code/main.py`theo thứ tự này:

1. `wrap32()`- `c_div()`- `idiv32()`, và hai `*_model()`các hàm giữ các số nguyên nghĩa của danh sách.
2. `input_grid()`và `classify()`xây dựng và gắn thẻ các tế bào 92.
3. `build_harness()`và `execute()`biên soạn một chương trình từ bản gốc, các ứng cử viên đổi tên, và `driver.c`, sau đó chạy các tế bào.
4. `prove_behaviour()`trả lại báo cáo đầu tiên với sự không phù hợp và bất đồng mô hình.
5. `ElfObject`đọc tiêu đề, biểu tượng, và `.rela`- Các hồ sơ.`mask_relocations()`và `read_table()`chuẩn bị cho việc so sánh.
6. `prove_bytes()`trả lại báo cáo hai chân với kích thước, phạm vi ẩn, hình dạng di chuyển và bảng.
7. `McpStdioClient`và `agent_loop()`lái xe và ghi lại từng bước.
8. `build_proof()`và `aggregate()`- Không có hồ sơ bị đóng.

## Sử dụng nó

Để chứng minh hàm mới bằng nhau, lặp lại các bước sau:

1. Đưa đi`analyze_function`cho chức năng và ghi nhận ID bằng chứng. đọc danh sách trước mã giả.
2. Viết ứng cử viên từ chiều rộng hoạt động của danh sách. Giữ tên chức năng gốc.
3. Đăng danh sách mỗi lần nhân, cộng, trừ và chia trong danh sách. Thêm các đầu vào lưới bao phủ mỗi một trong số đó ở chiều rộng của nó.
4. Thêm cả hai bên của mỗi liên tục so sánh trong danh sách.`grade`đó là 6 và 4 sau khi trừ.
5. Thêm tất cả các phân chia có thể mắc kẹt vào mục tiêu, và ghi lại kiến trúc nào chạy lưới.
6. Đi cả hai chân và đọc lý do trước khi trạng thái.
7. Hãy giữ hồ sơ bằng chứng bên cạnh ứng cử viên.`evidence_links`cho người đọc biết ghi lại yêu cầu dựa trên.

Tái lại cả hai chân sau bất kỳ cập nhật biên dịch nào.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: mô hình và chạy

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

Đi chạy:

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

Cuộc gọi đầu tiên cho -133, sản phẩm đóng gói chia bằng 3.`'trap'`Và thứ ba là -2147483648. Báo cáo cho thấy mười trường hợp ngây thơ đã được thông qua và 28 tế bào lưới đã thất bại. So sánh`report.oracle_disagreements`với một danh sách trống.

### Phòng thí nghiệm B: đọc đối tượng

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

Các byte trường là `00000000`Tên của nơi chuyển nhượng`.rodata`với phụ lục`0x10`, và bàn đọc `[1, 2, 3, 4, 4]`- Tôi không biết.

### Phòng thí nghiệm C: phá vỡ một liên tục

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

Các byte phù hợp, các hồ sơ phù hợp, và các bảng không. Bây giờ chỉnh sửa `grade_case10_wrong.c`Vậy là`case 10`trả lại 4 một lần nữa, biên dịch lại với lệnh cố định, và xem trạng thái thay đổi thành `pass`- Tôi không biết.

### Phòng thí nghiệm D: drive rea

Với REA 6.5.0 và Ghidra 12.1.4 được cài đặt:

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
npx tsx code/main.ts --live
```

Thứ nhất `analyze_function`Ghidra nhập vào đối tượng trong vài giây. So sánh ID bằng chứng mới với chạy đã thực hiện. cùng các byte dưới cùng một hồ sơ phân tích cho cùng các ID, bởi vì id là một hàm hàm nội dung loại trừ đường dẫn tệp.

## Phòng thí nghiệm thực hành

Mở cả hai chân ra `total`và `grade_label`từ cùng một vật thể.

Yêu cầu:

- Vì `total`, đầu vào là một mảng và một con số. xây dựng các tế bào với con số 0, một con số âm, một yếu tố, và tổng kết kết ở 32 bit.
- Vì `grade_label`, hàm gọi `grade`trong dòng và đọc `labels.rel`, một bảng của năm các chuỗi tương đối bù đắp với các di chuyển của riêng họ trong `.rela.rodata`- Tôi không biết.
- Thêm một `CLAIMS`mục nhập cho `grade_label`với hai di chuyển và một bảng gồm năm mục 4 byte, và so sánh các chuỗi các mục chỉ ra.
- Tăng các tế bào nào mô hình và chạy không đồng ý, nếu có, và giải thích từng tế bào từ danh sách.
- Thêm một yêu cầu cho mỗi chân cho mỗi hàm vào hồ sơ chứng minh và giữ tổng hợp bị đóng cửa.

Thành công có nghĩa là hồ sơ chứng minh liệt kê bốn chức năng, mỗi tuyên bố mang theo một ID chứng minh, và `grade_label`thất bại khi một chuỗi nhãn khác nhau.

## Phòng thí nghiệm được xếp hạng

Năm câu hỏi về các thiết bị của bài học này. Tìm mỗi câu trả lời với mã bạn xây dựng, sau đó viết nó vào `code/lab_answers.json`. Viết số như số hoặc như chuỗi hex như `"0x40"`, và danh sách như danh sách JSON.

1. `t1`: percent_change_model(3, 105) trên x86_64.
2. `t2`: percent_change_model(0, 5) trên x86_64.
3. `t3`: grade_model(100).
4. `t4`: số lượng ô trong input_grid().
5. `t5`: số lượng các tế bào lưới mà mô hình x86_64 bị mắc kẹt.

Hãy kiểm tra câu trả lời của bạn:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
npx tsx code/lab.ts
```

Người kiểm tra tính toán mỗi giá trị dự kiến từ `code/main.py`trên các thiết bị đã được thực hiện.`PASS`- `FAIL`hoặc `TODO`cho mỗi nhiệm vụ và điểm số, và nó chỉ thoát khỏi 0 khi tất cả năm vượt qua. `python3 code/lab.py my-answers.json`kiểm tra một tập tin khác. `code/tests/test_lab.py`chứng minh rằng người kiểm tra chấp nhận câu trả lời đúng và từ chối câu trả lời sai.

### Xem nó chạy

- [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)máy kết thúc với mã giả và lưu trữ nó như suy luận: trang không chứng minh nó. Bài học này là bước biến tuyên bố đó thành một kiểm tra một.

## Kỹ năng sản xuất

Bài học này sẽ mang lại kết quả `outputs/skill-rebuild-and-prove-equal.md`Sử dụng nó để biến chứng tính chức năng và xây dựng lại một ứng cử viên thành chứng minh hai chân và hồ sơ chứng minh. Kỹ năng này đòi hỏi phải liệt kê trước mã giả, một lưới với mỗi lớp nguy hiểm, che giấu di chuyển cộng với kiểm tra liên tục và một tổng hợp bị đóng lỗi.

## Hãy kiểm tra

Thử nghiệm và thử nghiệm:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

35 thử nghiệm chứng minh:

- `c_div()`truncates về phía không và `wrap32()`sau khi bổ sung hai
- mô hình cho -133 cho `(3, INT_MAX)`- `trap`cho các tế bào bẫy trên x86-64, và -2147483648 trên AArch64
- lưới có 92 tế bào và mỗi lớp nguy hiểm, và các trường hợp ngây thơ tránh mọi lớp cứng
- Bộ đọc ELF tìm thấy bốn hàm ở các kích thước và kích thước được ghi lại
- `percent_change`là 16 byte mà không có chuyển nhượng và `grade`có một `R_X86_64_PC32``0x26`
- các byte trường di chuyển là không và che giấu không thay đổi gì trong đối tượng RELA này
- Tất cả tám ứng viên cam kết đạt được tình trạng mong đợi, với lý do ghi lại
- `grade_case10_wrong`vượt qua các byte ẩn và chỉ thất bại kiểm tra liên tục
- Những lần chạy trên chân một ghi lại cho thấy 10 lần đi qua ngây thơ, 28 sự không phù hợp và không có sự bất đồng về mô hình
- với một trình biên dịch, cả hai cặp tái tạo và chạy lại với kết quả tương tự
- Các mục tiêu của các đối tượng được thực hiện bởi SHA-256, theo thứ tự, với `ev_`ID trên mỗi bước bằng chứng
- `read_bytes`record bằng với bảng người đọc ELF tìm thấy
- Khách hàng chạy máy chủ giả và ghi lại các ID bằng chứng giống như chạy thực
- kết quả lỗi từ máy chủ đi vào hồ sơ chạy
- `aggregate()`được đóng không hiệu quả và ID chứng minh tính lại từ nội dung của nó

## Các chế độ sản xuất thất bại

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Rebuild keeps the decompiler's `long` | "ten tests pass" | 26 overflow cells differ from the original |
| Thresholds replace a switch | "every grade band passes" | 110 and larger return 0 in the original |
| Divide before multiply | "formula is algebraically equal" | rounding cells differ, naive cases fail |
| Trap cell skipped | "no crashes" | x86-64 raises `#DE`, AArch64 returns `INT_MIN`, the report names the host |
| Byte compare without masking | "bytes equal" | relocation records name different offsets |
| Masking without reading constants | "bytes equal after masking" | `1,2,3,4,3` differs from `1,2,3,4,4` |
| Size taken as acceptance | "same length" | differing bytes inside the same length |
| Different compiler or flags | "bytes differ, rebuild wrong" | the same source gives different bytes, so the compare is void |
| Model treated as observation | "model agrees" | the run is observed, the model is derived, disagreements are listed |
| Claim without evidence id | "verified" | every claim links an `ev_` record of the function it covers |
| No compiler on the CI host | "passed" | behaviour claims are `unknown` and the aggregate is `unknown` |
| Pseudocode read as source | "decompiler says long" | the listing shows `IMUL EAX`, `CDQ`, `IDIV EDI` |

## Quy tắc hoạt động

Viết lại từ danh sách và đặt tên cho bản ghi âm mà nó xuất phát từ. Đưa nó vào bản gốc trên một lưới bao bọc mọi trung gian và vượt qua mọi liên tục so sánh. Lưu tập lại với các cờ gốc, che giấu các trường di chuyển, so sánh các bản ghi và đọc các liên tục mà chúng chỉ ra. Viết từng yêu cầu với ID bằng chứng của nó, và để cho một yêu cầu không xác minh vẫn không được biết.

## Đọc thêm

- [McKeeman, Differential Testing for Software, Digital Technical Journal 10(1), 1998](https://www.cs.tufts.edu/comp/150FP/archive/bill-mckeeman/DifferentailTesting.pdf)
- [Yang, Chen, Eide, Regehr, Finding and Understanding Bugs in C Compilers, PLDI 2011](https://doi.org/10.1145/1993498.1993532)
- [Ramos, Engler, Practical, Low-Effort Equivalence Verification of Real Code, CAV 2011](https://doi.org/10.1007/978-3-642-22110-1_55)
- [Schwartz, Lee, Woo, Brumley, Native x86 Decompilation Using Semantics-Preserving Structural Analysis, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026](https://arxiv.org/abs/2609.05370)
- [Gao et al., DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Tan et al., LLM4Decompile, arXiv 2403.05286, 2024](https://arxiv.org/abs/2403.05286)
- [System V gABI, Chapter 4, Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)
- [x86-64 psABI repository, relocation types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV](https://developer.arm.com/documentation/ddi0487/latest)
- [rea 6.5.0 MCP contracts](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/mcp-contracts.md)
- [rea 6.5.0 reconstruction obligation ledgers](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/reconstruction-obligation-ledgers.md)
