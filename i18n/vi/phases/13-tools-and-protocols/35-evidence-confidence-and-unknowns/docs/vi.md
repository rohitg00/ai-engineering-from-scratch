# Bằng chứng, Tin tưởng và Không biết trong Phân tích Binary

> Một phát hiện về một chương trình được biên soạn là một bản ghi với một hash, một sự tin tưởng, một thẩm quyền, và một danh sách những gì nó không thể hiển thị.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## Mục tiêu học tập

- Xây dựng hồ sơ bằng chứng dựa trên mẫu của rea `Evidence`với sự tin tưởng được quan sát, dẫn đến và suy luận.
- Lập số các ID hash nội dung vẫn giống nhau khi tập tin di chuyển sang thư mục khác.
- Viết những gì mỗi nhà cung cấp không thể cho thấy như giới hạn đi cùng với hồ sơ.
- Từ chối tuyên bố kết quả cho đến khi một chạy của hàm được quan sát hỗ trợ nó.
- Giữ các phần còn lại không rõ như các hồ sơ đã sửa đổi được kết nối bởi một chuỗi hash.
- Nhà cung cấp bộ nhớ cache trả lời dưới một khóa chính xác và từ chối một bản phát lại lỗi thời.

## Vấn đề

Anh hỏi một đại lý gì?`grade`trong `ledger-x86_64-O1.o`Trình duyệt trả lời câu hỏi: Trình duyệt hỏi người đại lý biết như thế nào. Trình duyệt có một khối văn bản mà Ghidra in. Đối với con đường mặc định, văn bản đó đọc`uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`Các byte ở điểm đó nói`xor eax, eax`- Tôi không biết.

Các biểu hiện và hướng dẫn đều tạo ra 0 cho mỗi đầu vào.[NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)Một nghiên cứu khác năm 2026 đã trồng văn bản bên trong các binary và phát hiện ra rằng các mô hình đề xuất hành động không an toàn được trồng trong 35 trong số 40 trường hợp ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507)().

rea 6.5.0 cung cấp cho đại lý một từ vựng cho điều này.`Evidence`ghi lại với một `confidence`của `observed`- `derived`, hoặc`inferred`, một `authority`, và một danh sách `limitations`. Khả năng đóng gói nói với đại lý: "Mỗi kết luận phải phân biệt quan sát, suy luận và những điều không biết.

Có ba điều mà rea để lại cho bạn. Các ảnh chụp của nó lưu trữ kết quả truy vấn chính xác, không phải phân tích. Việc xác minh của nó vượt qua một yêu cầu khi một chiều kích so sánh không thay đổi, và bình luận của nó nói rằng một thông qua "không thiết lập sự tương đương thực hiện toàn cầu". sổ cái nghĩa vụ của nó chỉ lấy ứng cử viên từ JavaScript và biểu đồ được quản lý, vì vậy một hàm bản địa không bao giờ đạt được .`verified`qua nó.

Bài học này xây dựng phần thiếu sót trong Python đơn giản. Bạn viết một sổ cái lưu trữ mọi sự thật về thiết bị như một bản ghi với một nội dung hash. Bạn làm các dự đoán về`percent_change`và `grade`Bạn nhập hai bản ghi thực tế và ảnh chụp nhanh chúng xuất phát từ, và sổ cái của bạn tính lại mọi bản ghi hash rea đã viết.

```figure
re-evidence-ledger
```

## Ba từ cho sự tự tin, năm từ cho quyền lực

`confidence`là một số với ba giá trị, không bao giờ là một số. `authority`Khi một nhà sản xuất không nói gì, rea sử dụng`shipped-artifact`với `observed`- Tôi không biết.

| Value | Meaning on the fixture | Records in this lesson |
|---|---|---|
| `observed` | A fact read from bytes or from a run | the ELF reader's section and symbol reads, the two Ghidra records, 17 host runs |
| `derived` | A fact computed from observed records | the switch table model, the division model, every unknown mutation |
| `inferred` | An expectation that no observation states yet | 18 predictions |
| `shipped-artifact` | The file on disk was the source | every read of `ledger-x86_64-O1.o` |
| `controlled-replay` | A run you controlled produced the fact | the host runs of `harness.c` |
| `analyst-inference` | Your own judgement | predictions and unknown mutations |
| `historical-reference` | An older source tree or document | none here |
| `external-service` | A service outside the file and the host | none here |

Hai sự nhầm lẫn tốn nhiều thời gian nhất. Đầu tiên coi pseudocode là một quan sát về hành vi. Nó là một quan sát về những gì Ghidra in. thứ hai coi một danh sách trống như bằng chứng về sự vắng mặt. ghi chú thiết kế của rea là nghiêm ngặt: "Công tin không được biết, không phải sự vắng mặt. "`code/main.py`mã hóa cả hai quy tắc.

## Lịch sử

Một bản ghi có chính xác mười sáu trường, và rea 6.5.0 từ chối bất kỳ trường nào khác. `code/main.py`giữ tên giống như rea, vì vậy một hồ sơ từ cả hai bên xác nhận trên bên kia.`relationship_coverage`, cho thấy danh sách người gọi hoặc người gọi là bao nhiêu.`complete`- `partial`, hoặc`unknown`, hoặc`null`khi hoạt động báo cáo không có liên hệ gọi.

| Field | What it holds |
| --- | --- |
| `evidence_id` | `ev_` and 64 hex digits, a hash of the content |
| `subject` | `name`, `digest.sha256`, `format`, `architecture`, `local_path`, or `null` |
| `provider` | `id`, `name`, `version` or `null` |
| `analysis_profile` | the provider's settings and their digest, or `null`, always present |
| `predicate_type` | a tag, `rea.analysis` by default |
| `operation`, `parameters` | the tool and its input |
| `raw_result`, `normalized_result` | provider output and the canonical result |
| `confidence`, `authority` | the enums above |
| `environment` | `id`, `platform`, `architecture`, `isolation`, or `null` |
| `limitations` | plain sentences |
| `relationship_coverage` | `status` `complete`, `partial`, or `unknown` with diagnostics, or `null` |
| `locations` | `address`, `address-range`, `artifact-path`, `file-offset`, `file-offset-range` |
| `evidence_links` | the `ev_` ids this record rests on |

Đây là bản ghi thực sự mà Rea viết cho `grade`, cắt cho các lĩnh vực quan trọng ở đây.`code/fixtures/rea-evidence-grade.json`, 37.573 byte.

```json
{
  "evidence_id": "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1",
  "subject": {
    "name": "ledger-x86_64-O1.o",
    "digest": { "sha256": "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f" },
    "format": "elf",
    "architecture": "x86_64",
    "local_path": "/private/tmp/aiefs-re/phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures/ledger-x86_64-O1.o"
  },
  "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
  "analysis_profile": {
    "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
    "parameters": { "jump_table_evidence": "typed-case-default-blocks-v1", "import_mode": "ephemeral-source-immutable" },
    "digest": "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
  },
  "operation": "analyze_function",
  "parameters": { "procedure": "grade" },
  "confidence": "observed",
  "authority": "shipped-artifact",
  "environment": null,
  "limitations": [
    "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>.",
    "Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals."
  ],
  "relationship_coverage": {
    "status": "complete",
    "diagnostics": [
      "Only resolved Ghidra call references are returned; unresolved computed or indirect calls remain unknown, while function classifications distinguish thunks and externals."
    ]
  },
  "locations": [],
  "evidence_links": []
}
```

Đúng là `parameters`đối tượng của hồ sơ có 25 khóa.`limitations`danh sách có mười câu. giữ chúng. Một hạn chế là một phần của nội dung, vì vậy bỏ một thay đổi ID, và sổ cái của bạn sau đó sẽ từ chối ghi lại.

Hãy chú ý những gì ghi chép không nói. `environment`là `null`Vì Ghidra đọc một tập tin và không tìm thấy gì.`locations`là trống vì báo cáo hoạt động này địa chỉ bên trong `normalized_result`- `relationship_coverage`có vị trí `complete`Chẩn đoán của nó cho biết chỉ có tham chiếu cuộc gọi Ghidra được giải quyết được trả lại, và các cuộc gọi máy tính hoặc gián tiếp chưa giải quyết vẫn không được biết.

## ID là một cái kết của sự hài lòng, và con đường không nằm trong nó

thực tính toán `evidence_id`như `ev_`cộng SHA-256 trên RFC 8785 JSON công giáo của một dự đoán của hồ sơ.`digest`- `format`, và`architecture`và giọt `name`và `local_path`Nó rơi xuống.`relationship_coverage`khi giá trị của nó là `null`, vì vậy một hồ sơ không có liên hệ gọi giữ lại danh tính giống như trước khi trường tồn tại.`raw_result`và mọi giới hạn, đều được phân tích.

RFC 8785 sắp xếp các phím đối tượng, loại bỏ không gian trắng, và sửa đổi các hình thức số và chuỗi. Đối với các hồ sơ có số là số nguyên, thư viện tiêu chuẩn của Python tạo ra các byte tương tự:

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py`từ chối floats trước khi nó hash, bởi vì RFC 8785 và Python in một số floats khác nhau. hai bản ghi rea và snapshot không giữ floats, do đó công thức tái tạo mỗi rea hash:

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

Tại sao loại trừ đường đi? cùng quan sát của cùng một byte nhận được ID tương tự trên bất kỳ máy tính và trong bất kỳ thư mục.`local_path`trong danh sách trên có tên thư mục trên một Mac. ID không thay đổi khi bạn sao chép bộ nhớ này vào `/home/you/re`- `rebind_subject_path()`cho phép bạn hiển thị một bản ghi dưới một con đường mới.`sha256`- `format`, hoặc`architecture`khác nhau. rea 6.5.0 làm tương tự với `rebindEvidenceToTargetPath`khi nó tái phát một bản ghi hình ảnh chụp nhanh cho một mục tiêu ở một con đường mới.

`validate_evidence()`tính lại danh tính và từ chối sự không phù hợp với câu của Rea, "Cách chứng nhận ngữ nghĩa không phù hợp với hồ sơ của nó".`analysis_profile.provider`khác với `provider`- Thử nghiệm`test_tampered_id_and_mismatched_profile_are_rejected`chỉnh sửa một dòng mã giả trong thực `grade`ghi lại và xem sổ cái từ chối nó.

## Hãy tự quan sát vật thể

Trước bất kỳ nhà cung cấp nào, sổ cái đọc hồ sơ. `observe_object()`phân tích tiêu đề phần ELF64, `.symtab`- `.strtab`, và`.rela.text`với `struct.unpack_from`Nó viết một .`inspect_object`ghi lại và một `read_function_bytes`ghi trên mỗi biểu tượng hàm.`observed`với thẩm quyền `shipped-artifact`, bởi vì nguồn gốc là tập tin trên đĩa.

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t`đồng ý: `grade``0000000000000010`với kích thước `2e`Ba vụ di chuyển vào năm`.rela.text`là `R_X86_64_PC32`chống lại`.rodata`trong các khoản bù đắp`0x36`- `0x84`, và`0x93`, với các phụ lục`0x10`- `0x24`, và`-0x4`Mỗi bản ghi đều có một`file-offset-range`vị trí và một hạn chế: "Bytes phần được đọc từ tệp trên đĩa. Người đọc không áp dụng chuyển đổi và không chạy mã".

Bài học 32 xây dựng người đọc này hoàn toàn. Đây là 60 dòng, bởi vì bài học này là về những gì bạn ghi lại về việc đọc.

## Tìm ra bảng, và nói rằng bạn đã tìm ra nó

46 byte của `grade`chứa bốn mô hình mà bài học 33 giải mã:

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

Một nhân bằng `0x66666667`Sau đó là một thay đổi 34 là một phân chia được ký bởi 10.`derive_grade_model()`viết rằng thực tế như một giới hạn: "Đi phân 10 là một dẫn xuất từ nhân 0x66666667 và thay đổi 34.

- `add ecx, -6`Đặt trường hợp đầu tiên lên 6.`cmp ecx, 4`với một cú nhảy không ký kết thừa nhận 5 trường hợp, 6 đến 10.

- `lea``.text+0x33`mang lại việc di chuyển với thêm `0x10`. Một PC32 di chuyển đo từ cuối 4 byte di chuyển, do đó bảng bắt đầu từ `.rodata+0x14`5 từ nhỏ nhặt đọc`1, 2, 3, 4, 4`- Đổi vào .`ledger.c`trả lại 1 cho 60 đến 69, 2 cho thập niên 70, 3 cho thập niên 80, và 4 cho 90 đến 100.

Những ghi chép kết quả`ev_605106bff2d9998f…`- Có `confidence` `derived`, và nó `evidence_links`Name the two observed records it rests on. Remove the bytes record from the ledger and the derived record has a hanging link.`ev_a467c242…`- Tôi không biết.

Bây giờ hãy so sánh với Ghidra.

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

Ghidra đã thực hiện việc di chuyển và đặt tên cho bảng `DAT_001000b4`, đó là `.rodata+0x14`sau khi nó được đặt `.text``0x100000`Nó đã lấy lại sự chia bằng 10 và 5 trường hợp. Đối với giá trị mặc định nó in một biểu thức luôn là 0 và không bao giờ nói 0.`native_value_flow`đánh dấu các hoạt động đó `is_dead: true`Bản ghi chép là một quan sát trung thành của Ghidra. ý nghĩa bạn đọc từ nó được bắt nguồn, và giá trị bạn mong đợi từ một chạy được suy luận.

- `percent_change`Hồ sơ cho thấy thất bại khác.`undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`Nguồn tin nói`int percent_change(int before, int after)`- `idiv`viết `EDX:EAX`, và đường đi không rời đi`EDX`không bị chạm vào, vì vậy người giải trình suy luận về một phần trả lại 16 byte và một tham số thứ ba.`native_api.return_type.confidence`cho `grade`là `"low"`- Chống lại chữ ký như là kết luận của nhà cung cấp, và ghi lại nó như vậy.

## Những lời tiên đoán là những ghi chép được đưa ra

Một dự đoán là một tuyên bố về hành vi mà không có quan sát nào đã khẳng định. `claim_suite()`xây dựng mười tám trong số đó từ các mô hình bắt nguồn và từ nguồn. `record_prediction()`lưu trữ mỗi một đĩa với `confidence` `inferred`và `authority` `analyst-inference`, liên kết với các hồ sơ mà nó dựa trên.

| Claim | Predicted value | Rests on |
|---|---|---|
| `percent_change(12400, 15500)` | 25, from 310000 / 12400 | division model `ev_076a9167…` |
| `percent_change(0, 5)` | 0, the zero guard | division model |
| `percent_change(100, 50)` | -50 | division model |
| `percent_change(-7, 3)` | -142, because `idiv` truncates toward zero | division model |
| `grade(55)` | 0, index -1 fails the unsigned compare | table model `ev_605106bf…` |
| `grade(60)`, `grade(69)` | 1, 1 | table model |
| `grade(70)`, `grade(85)` | 2, 3 | table model |
| `grade(95)`, `grade(100)`, `grade(105)` | 4, 4, 4 | table model |
| `grade(110)`, `grade(-5)` | 0, 0 | table model |
| `total(1, 2, 3)`, `total()` | 6, 0 | source record `ev_2f1e6d25…` |
| `grade_label(85)` | `"B"` | source record and table model |
| `grade(score)` for 90 to 100 | 4 for all eleven inputs | table model |

`predict()`sử dụng ngữ nghĩa C, không phải ngữ nghĩa Python. `c_div()`truncates về phía không, và `wrap32()`Lập mỗi trung gian thành 32 bit. Python `//`vòng về phía âm vô hạn, vì vậy `(3 - -7) * 100 // -7`Chương trình C cho ra -142. Bài học 36 làm cho lưới này lớn hơn nhiều.

Mỗi dự đoán mở ra một phần còn lại của người chưa biết.`observed`bằng chứng với thẩm quyền `controlled-replay`và đề nghị một con tàu thăm dò:`execute_function`Câu hỏi cho yêu cầu cấp 1 đọc "Điều điểm ((95) == 4 giữ khi hàm được biên dịch chạy?"

## Hãy kiểm tra chúng đối với một cuộc chạy

`code/fixtures/harness.c`bao gồm `ledger.c`và in một kết quả cho mỗi lần gọi. `observe_runs()`biên soạn nó với đầu tiên của `clang`- `cc`, hoặc`gcc`trên đường đi của bạn và chạy mỗi đầu vào trong lưới một lần.

```json
{
  "operation": "execute_function",
  "parameters": { "function": "grade", "args": [95] },
  "normalized_result": { "result": 4, "stdout": "4\n", "exit_code": 0 },
  "confidence": "observed",
  "authority": "controlled-replay",
  "environment": { "id": "host-process", "platform": "darwin", "architecture": "arm64", "isolation": "process" },
  "limitations": [
    "The run executed a host build of ledger.c, not the x86-64 object. The claim about the object rests on the shared source and on the compiler.",
    "One run observes one input. It proves nothing about other inputs."
  ]
}
```

Chủ đề của một bản ghi chạy là bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhượng bộ nhị`course-harness`với dòng phiên bản của trình biên dịch, ở đây `Apple clang version 17.0.0 (clang-1700.6.3.2)`- `evidence_links`tên ghi nguồn `ev_2f1e6d251543d017…`, bởi vì chạy và đối tượng chia sẻ `ledger.c`Và không có gì khác.

Đọc hạn chế đầu tiên hai lần. Đối tượng x86-64 không bao giờ chạy trên máy này. Điều chạy là một xây dựng thứ hai của cùng một nguồn cho kiến trúc khác. Đó vẫn là một quan sát, và nó là mạnh nhất có sẵn mà không có trình mô phỏng, vì vậy tuyên bố đi kèm với câu đó. Một báo cáo bỏ qua nó đã mất thông tin người đọc cần.

17 bộ chạy một lần đều phù hợp với dự đoán.`code/fixtures/run-evidence.json`giữ 17 hồ sơ đó và hồ sơ nguồn, xuất khẩu với `--record`vào năm 2026-10-13. Khi không có trình biên dịch,`build_ledger()`Nhập khẩu gói đó thay vì chạy, và báo cáo nói như vậy trong nó `runs`trường.

## Quy tắc khuyến mãi

Một yêu cầu chuyển từ suy luận đến hỗ trợ chỉ thông qua các lần chạy được quan sát. `check_claim()`tìm kiếm`execute_function`ghi lại cùng một chức năng và lập luận, so sánh từng kết quả với dự đoán, và đếm các đầu vào được bao gồm:

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()`là hình thức nghiêm ngặt.`ClaimError`khi bất kỳ ID nào là `inferred`hoặc `derived`Nó được tạo ra khi một id đặt tên cho một chuỗi của một hàm khác hoặc các lập luận khác. Nó được tạo ra khi danh sách trống, và khi các chuỗi bao gồm ít đầu vào hơn yêu cầu.`grade(55)`, và cả hai đều không thể thúc đẩy nó.`ev_7be90c0c…`trong hình và xem khiếu nại rơi vào `unsupported`Trong khi hai bản ghi về `grade`- Cứ ở lại.

Các yêu cầu phạm vi cho thấy trường hợp một phần. Chỉ hai trong số mười một đầu vào của nó, 95 và 100, xuất hiện trong lưới chạy. `check_claim()`trả lại `unknown`với `covered`2 trong số 11, và `promote_claim()`từ chối với "2 trong 11 đầu vào đã quan sát chạy.

`completion_ledger()`gương của rea `EvidenceCompletionLedger`- Tên của nó là`ecl_`cộng với hash của hồ sơ của nó, và `complete`đúng chỉ khi`pass`=`total`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`ecl_da64933ea13befed…`với `complete: false`, vì một yêu cầu phạm vi.

## Những thứ không biết là những bản ghi với chuỗi Hash

rea lưu trữ một số dư không rõ ràng như một hồ sơ nghiêm ngặt. `code/main.py`giữ các trường và các biến động tương tự.

Đơn vị nhận dạng là`unk_`+ SHA-256 qua `{domain, question, scope_digest}`2 nhà phân tích hỏi cùng một câu hỏi về cùng một tệp nhận được cùng một ID.`scope_digest`là SHA-256 của đối tượng.

Mỗi thay đổi là một bản sửa đổi mới.`previous_revision_digest` `null`. Mỗi lần sửa đổi sau đó tên gọi của `revision_digest`Trong số những người trước đó, và tiêu hóa bao gồm tất cả các cánh đồng ngoại trừ chính nó.`verify_unknown_chain()`kiểm tra rằng mỗi liên kết chỉ vào phiên bản sửa đổi trước đó. Nó kiểm tra rằng các bằng chứng đột biến của mỗi tên sửa đổi nằm trong sổ cái.

Mỗi đột biến tự nó là một hồ sơ bằng chứng, như thực sự làm với nhà cung cấp `rea-unknown-registry`- Chúng ta mang theo .`confidence` `derived`- `authority` `analyst-inference`"Một đột biến đăng ký ghi lại những gì nhà phân tích quyết định.

Đó là lý do tại sao 81 bản ghi của bản demo bao gồm 36 bản ghi đột biến bắt nguồn: 18 mở và 18 cập nhật.

Ba biến số được áp dụng cho mỗi sửa đổi:

- Chỉ có một `resolved`không biết mang theo một `resolution`, và chỉ có sửa đổi 1 không có tiền nhiệm.
- A `contradicted`Tên không rõ ít nhất một ID mâu thuẫn, và không có ID xuất hiện trong cả hai danh sách.
- A `verified`giải quyết tên ít nhất một ID bằng chứng với sự tin tưởng và thẩm quyền cần thiết.

Quy tắc thứ ba là nơi sổ cái thường từ chối. ghi chép lưu lượng công việc của rea nói "Chỉ có bằng chứng quan sát được xác nhận có thể xác minh một giải pháp". `resolve_unknown()`do đó bác bỏ mô hình bảng, bác bỏ một hồ sơ được quan sát với thẩm quyền `shipped-artifact`, và chấp nhận hồ sơ chạy `ev_f4ffbe8f922ec7fe…`. Việc sửa đổi được giải quyết cho `grade(95)`là sửa đổi 2, và nó `previous_revision_digest`là `ffca840b55a8a188…`, bản ghi của sửa đổi 1.

`update_unknown()`- Đưa ra`expected_revision`và tăng lên `revision-conflict`Khi nó đã lỗi thời, như Rea `update_unknown`Công cụ có. phản ứng đúng là một ghi chú của rea: đọc lại sửa đổi hiện tại và quyết định lại.

Một người không biết vẫn mở sau khi trình diễn:`unk_f2eb0d7f84c80a19…`, "Công điểm ((score) == 4 cho mỗi điểm từ 90 đến 100 giữ khi hàm được biên soạn chạy?". Tình trạng của nó là `investigating`, các ID hỗ trợ của nó bao gồm hai chạy, và thăm dò của nó vẫn đặt tên cho chín đầu vào mà không có một chạy.

## Một kho chứa câu trả lời không phải là một cơ sở dữ liệu phân tích

rea có ba thứ trông giống như một bộ nhớ cache.`-readOnly -deleteProject`Và bị xóa ngay khi đóng.`AnalysisSnapshotCache`chứa lên đến 10.000 mục cho một danh tính nhị phân.`target`- `binding`- `entries`- `workflow_entries`, và một `evidence_bundle`- Tôi không biết.

Chìa khoá là `query_`+ SHA-256 qua `{target, binding, operation, parameters}`- `target`là `{sha256, kind, format, architecture}`, và một `raw-binary`mục tiêu cũng có`entry_point`- `binding`là nhà cung cấp và toàn bộ hồ sơ phân tích, bao gồm cả tiêu hóa. Thay đổi bất kỳ thông số nào trong 25 hồ sơ, ví dụ `jump_table_evidence`từ `typed-case-default-blocks-v1`đến một `v2`, và tiêu hóa thay đổi, vì vậy mỗi chìa khóa thay đổi.

`code/fixtures/rea-snapshot.json`là tệp rea được viết trong hai lần chạy, 142.690 byte. rea đã viết nó với quyền chỉ có chủ sở hữu, và bản sao được giao là có thể đọc bởi mọi người. Nó có hai mục và một gói bằng chứng với hai hồ sơ tương tự. `AnswerCache.import_snapshot()`tính lại mỗi lần `query_id`và từ chối tệp khi bất kỳ khác nhau. Nó từ chối một snapshot mà`target`hoặc `binding`khác với hoạt tính, với các từ của rea `profile_mismatch`Nó từ chối một bức ảnh mà...`format_version`Không phải `course-answer-cache-1`- Tôi không biết.

Ba phép đo từ máy này.`grade`truy vấn mất 8,6 giây, với một nhập khẩu Ghidra mới.`percent_change`truy vấn đối với cùng một snapshot mất 8,5 giây, bởi vì một truy vấn khác là một cache bị bỏ lỡ.`grade`truy vấn đã mất 2,1 s và trả lại bản ghi giống hệt với bản ghi giống hệt `evidence_id`. Phân tích trong bộ nhớ trong rea thêm giới hạn "Điều tải từ một ảnh chụp nhanh phân tích REA địa phương; cuộc gọi này không chạy lại nhà cung cấp. "`lookup()`thêm một câu giống nhau, để người đọc có thể phân biệt một replay từ một câu trả lời mới.

Một đột biến kết thúc bộ nhớ cache. Trong rea 6.5.0, một đổi tên hoặc bình luận xóa bộ nhớ cache snapshot trước khi rea gửi cuộc gọi đến nhà cung cấp. Một phản hồi thất bại không thể chứng minh rằng viết đã lăn lại, vì vậy một viết thất bại cũng ngừng phát lại. Một nhập siêu dữ liệu thay đổi cơ sở dữ liệu cũng làm tương tự.

## Tại sao một đại lý cần điều này

Một đại lý điều khiển REA qua MCP sẽ xem toàn bộ hồ sơ của mỗi cuộc gọi và có thể trích dẫn`evidence_id`Nghiên cứu từ năm 2026 cho thấy điều đó đi sai. Sự tin tưởng quá mức vào sản xuất công cụ là một trong bốn điểm yếu trong nghiên cứu NDSS BAR. Trong nghiên cứu văn bản trồng trọt, cho thấy nội dung nhị phân như dữ liệu một mình vẫn còn 15 đề xuất không an toàn trong 40, và kiểm tra nguồn gốc với ủy quyền công cụ đã loại bỏ chúng. Một nghiên cứu thứ ba đã xem một đại lý lái Ghidra thông qua MCP ([arXiv 2606.06838](https://arxiv.org/abs/2606.06838)Trong các binary có hàng trăm hàm, chỉ có 10 đến 15 phần trăm nhận được phân tích thực trước khi đại lý tạo ra các khối.

Các sổ cái trả lời mỗi câu hỏi này bằng một hồ sơ, và đại lý chỉ báo cáo những gì sổ cái chứa.`unsupported`Một số lần chạy là`unknown`Một văn bản của nhà cung cấp là`observed`Cho đại lý hồ sơ kỹ năng trong.`outputs/`và làm cho sổ cái là nơi duy nhất nó viết kết luận. đó là dành cho Claude, Cursor, Codex, OpenClaw, Hermes, hoặc bất kỳ đại lý nào đọc SKILL.md.

## Hãy xây dựng nó

Chạy trình diễn thư viện tiêu chuẩn:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
```

Demos đọc đối tượng, nhập hai bản ghi rea, xác minh ảnh chụp nhanh rea và lấy hai mô hình. Sau đó nó ghi lại 18 dự đoán, mở 18 điều chưa biết, biên soạn và chạy vòng xoáy, kiểm tra mọi yêu cầu và giải quyết 17 điều chưa biết.

```json
{
  "records": 81,
  "by_confidence": { "observed": 25, "derived": 38, "inferred": 18 },
  "rea_snapshot": { "entries": 2, "replay_hit": true, "stale_profile_refused": true },
  "grade_table": [1, 2, 3, 4, 4],
  "runs": "live: Apple clang version 17.0.0 (clang-1700.6.3.2)",
  "claims": [ { "claim_id": "grade(95)", "status": "pass", "covered": "1/1" }, { "claim_id": "grade(90..100)", "status": "unknown", "covered": "2/11" } ],
  "completion_ledger_id": "ecl_da64933ea13befed9483f8b00447bb3f4ceb74324c01e2515eff03f3af3ca750",
  "complete": false,
  "unknowns": { "resolved": 17, "investigating": 1 }
}
```

Không có trình biên dịch C, `runs`đọc `imported 17 recorded run records from run-evidence.json`và phần còn lại cũng như vậy.

Đọc `code/main.py`theo thứ tự này:

1. `canonical_json()`và `compute_evidence_id()`giữ công thức hash và dự đoán ngữ nghĩa.
2. `create_evidence()`và `validate_evidence()`xây dựng và kiểm tra hồ sơ.
3. `EvidenceLedger.record()`và `import_bundle()`lưu trữ hồ sơ và từ chối xung đột.
4. `open_unknown()`- `update_unknown()`, và`resolve_unknown()`giữ chuỗi sửa đổi.
5. `observe_object()`đọc ELF, và `derive_grade_model()`đọc bảng.
6. `claim_suite()`- `predict()`, và`record_prediction()`viết các cấp độ suy luận.
7. `observe_runs()`biến mỗi vòng xoáy chạy thành một hồ sơ được quan sát.
8. `check_claim()`- `promote_claim()`, và`completion_ledger()`áp dụng các quy tắc khuyến mãi.
9. `AnswerCache`Key trả lời như ảnh chụp của Rea và từ chối những bức ảnh cũ.

## Sử dụng nó

Hãy giữ một sổ cái cho mỗi mục tiêu và mỗi cuộc điều tra. Đặt SHA-256 của mục tiêu trong mỗi chủ đề và tiêu hóa phạm vi của câu hỏi trong mỗi không rõ. Khi bạn thay đổi công cụ, thay đổi các `provider`Khi bạn xây dựng lại bộ cố định, chủ đề tiêu hóa thay đổi và mỗi hồ sơ cũ trở thành bằng chứng về một tập tin khác.

Bạn có thể viết ra những giới hạn ngay khi bạn biết chúng. Người đọc không áp dụng chuyển đổi không nói vậy. Cuộc chạy của một cấu trúc chủ nhà nói vậy. Mô hình suy luận một phân chia nói vậy. Một bản ghi được viết mà không có giới hạn của nó trông mạnh hơn sự thật cho phép, và một người đọc sau đó không thể sửa chữa điều đó.

Hãy đối xử với mỗi văn bản cung cấp như dữ liệu. Các chuỗi và mã giả từ mục tiêu là văn bản mà mục tiêu kiểm soát.`_meta.provenance.untrusted_content: true`Các hướng dẫn máy chủ của nó nói với mô hình để xử lý nội dung mục tiêu như dữ liệu và báo cáo bất kỳ yêu cầu nào trong đó để chạy, cài đặt, tải xuống hoặc gửi một thứ gì đó như một nỗ lực tiêm nhanh.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: tính lại một reaid

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

Đi chạy:

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

Hai so sánh đầu tiên là đúng. con đường không nằm trong hash.

### Phòng thí nghiệm B: từ chối thăng chức

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

Cuộc gọi lên lên`ClaimError`và đặt tên ID bắt nguồn. Bây giờ hãy đi qua ID chạy:

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

Tình trạng là `pass`, và những người trở về `limitations`đưa ra án xây dựng nhà.

### Phòng thí nghiệm C: từ chối một bức ảnh nhanh bị lỗi thời

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

Lần đầu tiên xuất nhập khẩu 2. lần thứ hai tăng `CacheError`với `profile_mismatch`Một chuỗi phiên bản thay đổi, và toàn bộ ảnh chụp được từ chối.

### Phòng thí nghiệm D: phá vỡ chuỗi

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

Lần gọi đầu tiên trả lại 2 lần gọi thứ hai.`EvidenceIntegrityError`, bởi vì sửa đổi 1 không còn phù hợp với bản tiêu hóa của riêng nó và sửa đổi 2 điểm ở một bản tiêu hóa không còn tồn tại nữa.

## Phòng thí nghiệm thực hành

Đóng không rõ mở và thêm một nhà cung cấp thứ hai.

Yêu cầu:

- Tăng `run_grid()`Vì vậy, các mục nhập thiếu sót của phạm vi yêu cầu chạy, sau đó xác nhận các chuyển động không rõ đến `resolved`trong phiên sửa đổi 3.
- Thêm `llvm-objdump -d`như một nhà cung cấp thứ hai với riêng mình `provider`đối tượng và ghi lại danh sách của nó`grade`như `observed`- Tôi không biết.
- Hãy viết một `derived`ghi lại hai danh sách, của Ghidra và của llvm-objdump, giải mã cùng 14 hướng dẫn, và liên kết cả hai.
- Mở một cái tên không rõ`grade_label(105)`với độ nghiêm trọng `high`, vì chỉ số bảng 4 đọc `labels[4]`, và giải quyết nó bằng cách chạy.
- Xuất khẩu sổ cái với `export_bundle()`, nhập vào một sổ cái mới, và chứng minh mọi chuỗi vẫn xác minh.

Thành công là một báo cáo trong đó mỗi câu trích dẫn một ID từ gói và một `unknown`yêu cầu đã biến mất.

## Phòng thí nghiệm được xếp hạng

Năm câu hỏi về các thiết bị của bài học này. Tìm mỗi câu trả lời với mã bạn xây dựng, sau đó viết nó vào `code/lab_answers.json`. Viết số như số hoặc như chuỗi hex như `"0x40"`, và danh sách như danh sách JSON.

1. `t1`: ID bằng chứng mà tính toán_evidence_id cho cho thực-evidence-grade.json.
2. `t2`: số hạn chế trong hồ sơ điểm.
3. `t3`: tình trạng liên quan_căn hộ của hồ sơ điểm.
4. `t4`: sự tin tưởng và thẩm quyền của hồ sơ điểm, như một danh sách hai chuỗi.
5. `t5`: SHA-256 của đối tượng ghi nhận điểm.

Hãy kiểm tra câu trả lời của bạn:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
npx tsx code/lab.ts
```

Người kiểm tra tính toán mỗi giá trị dự kiến từ `code/main.py`trên các thiết bị đã được thực hiện.`PASS`- `FAIL`hoặc `TODO`cho mỗi nhiệm vụ và điểm số, và nó chỉ thoát khỏi 0 khi tất cả năm vượt qua. `python3 code/lab.py my-answers.json`kiểm tra một tập tin khác. `code/tests/test_lab.py`chứng minh rằng người kiểm tra chấp nhận câu trả lời đúng và từ chối câu trả lời sai.

### Xem nó chạy

- [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off)máy giữ một sổ cái bằng chứng với bốn ngăn: quan sát, dẫn xuất, suy luận và không biết. Liên kết này mở chạy với bảng biểu tượng tắt, do đó tên và cuối của tệp hàm là không biết và các tệp bắt đầu là suy luận.

## Bài học: Cây tạo vật

Bài học này sẽ mang lại kết quả `outputs/skill-evidence-ledger.md`Nó cho biết cho một đại lý làm thế nào để viết mỗi phát hiện như một hồ sơ với sự tin tưởng, thẩm quyền, giới hạn, và liên kết. Nó cho đại lý biết làm thế nào để giữ những điều không rõ như sửa đổi, và khi một yêu cầu là`pass`- `fail`- `unknown`, hoặc`unsupported`- Tôi không biết.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

28 thử nghiệm chứng minh:

- cả hai rea `evidence_id`giá trị, hồ sơ tiêu hóa, và cả hai snapshot `query_id`giá trị tính lại từ nội dung
- một con đường thay đổi giữ ID và một giới hạn thay đổi nó
- Một hồ sơ bị vi phạm, một nhà cung cấp hồ sơ không phù hợp, một float và một giá trị enum không rõ được từ chối
- một hồ sơ sao chép trả lại `duplicate`, một kỷ lục mâu thuẫn tăng, và một gói nhập khẩu là nguyên tử
- Các nhập khẩu hàng loạt được ghi nhận với 18 hồ sơ và không có liên kết treo
- một người không biết mở tại sửa đổi 1, từ chối một lỗi `expected_revision`, và giải quyết chỉ với quan sát`controlled-replay`bằng chứng
- một sửa đổi đã được chỉnh sửa phá vỡ chuỗi
- khuyến mãi từ chối kết luận, dẫn xuất, trống, và không liên quan bằng chứng, và đi qua với một chạy đồng ý
- bảo hiểm một phần là `unknown`và một cuộc chạy đua không đồng ý là `fail`
- bộ nhớ cache nhấn vào khóa chính xác và bỏ lỡ các tham số khác
- bộ nhớ cache từ chối một phiên bản hồ sơ bị đập, một mục tiêu sai, một phiên bản định dạng sai, và một phím bị vi phạm
- người đọc ELF đồng ý với `llvm-objdump`về các sự thay đổi, kích thước, byte, và di chuyển, và bảng đọc `1, 2, 3, 4, 4`
- Các dự đoán sử dụng phân chia C, và các chạy ghi lại phù hợp với tất cả 17 yêu cầu nhập đơn
- Với một trình biên dịch hiện diện, các chạy trực tiếp cũng đồng ý

## Các chế độ sản xuất thất bại

| Failure | What the weak report says | What the ledger requires |
|---|---|---|
| Pseudocode read as behaviour | "grade returns 0 for failing scores" | an `execute_function` record for that input, or `unsupported` |
| Decompiler signature trusted | "percent_change returns 16 bytes" | the signature marked as the provider's inference with its `low` confidence |
| Empty list read as absence | "the function has no callers" | an `unknown` status, or a coverage field when the tool provides one |
| Path hashed into the id | "the record changed" after a copy | the semantic projection without `name` and `local_path` |
| Limitation dropped from a copy | a record that looks stronger than the source | id mismatch and rejection on import |
| Partial grid rounded up | "all scores from 90 pass" | `unknown` with `covered` 2 of 11 |
| Host run presented as the object's run | "the x86-64 object returned 25" | the host-build limitation carried on the claim |
| Unknown closed by a sentence | "resolved, see above" | a `verified` resolution with observed ids of the required authority |
| Stale revision overwritten | two analysts' edits collide | `revision-conflict` and a reread |
| Old snapshot replayed after a release | answers from a changed contract | `profile_mismatch` on import |
| Cache kept after a rename | a replay that hides a metadata write | invalidation before dispatch and a failed export |

## Quy tắc hoạt động

Hãy ghi lại những gì bạn đọc, những gì bạn tính toán và những gì bạn mong đợi như ba loại ghi lại với ba từ.

## Đọc thêm

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- rea 6.5.0 nguồn tại tag `3b79af2`bài học này mô tả: `src/domain/evidence.ts`- `.agents/skills/reverse-engineer-anything/SKILL.md`- `docs/cli.md`- `src/domain/reconstructionVerification.ts`- `src/application/ReconstructionObligationCandidates.ts`- `docs/tool-design.md`- `src/domain/evidenceCompletionLedger.ts`- `src/domain/residualUnknown.ts`- `src/application/investigation/UnknownEvidence.ts`- `.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`- `src/application/binary/AnalysisSnapshotCache.ts`- `src/domain/analysisSnapshot.ts`- `src/application/binary/BinarySession.ts`- `src/application/binary/BinarySessionRecords.ts`- `docs/mcp-contracts.md`- Tôi không biết.
