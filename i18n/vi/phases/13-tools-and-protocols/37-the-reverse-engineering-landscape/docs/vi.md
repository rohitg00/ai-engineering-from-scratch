# Phương cảnh kỹ thuật ngược: Lịch sử, gia đình công cụ và cách xây dựng máy giải biên dịch

> Năm công cụ đọc cùng một đối tượng và cho bốn địa chỉ, ba khối đếm, và hai câu trả lời cho một chuyển đổi, và bài học này xây dựng vòng xoáy cho thấy là ai là ai.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, Java (one Ghidra script)
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~150 minutes

## Mục tiêu học tập

- Đặt các công cụ chính của lĩnh vực trên một dòng thời gian có niên đại từ năm 1973 đến năm 2026 và đặt tên cho gia đình mỗi công cụ thuộc về.
- Hãy nêu tên tám giai đoạn của một máy phân tích và thuật ngữ mà Ghidra, Binary Ninja, Hex-Rays, radar2, rizin và angr sử dụng cho mỗi giai đoạn.
- Hãy đưa một hướng dẫn vào ESIL, RzIL, P-code và VEX và giải thích những gì trong số đó viết cờ với sự phấn khích và những gì lưu trữ một thùng.
- Giảm địa chỉ của năm công cụ xuống còn một `.text`b) Pháo ngược và chứng minh sự giảm ở một hàm.
- Xây dựng một vòng so sánh đọc các đầu ra công cụ được chụp và báo cáo sự đồng thuận về khởi động hướng dẫn, khối, cạnh và khởi động chức năng.
- Tên, từ bằng chứng được ghi lại, nơi mỗi công cụ phát minh ra mã, bỏ qua mã, hoặc dừng lại trong một bước nhảy gián tiếp.

## Vấn đề

Bạn yêu cầu một đại lý tóm tắt 3 công cụ kỹ thuật ngược nói về điều gì`grade`trong `ledger-x86_64-O1.o`. Đại lý chạy mỗi công cụ, đọc ba danh sách, và báo cáo rằng chức năng nằm ở `0x08000050`trong một công cụ, `0x400010`trong một số khác, và `0x100010`Kết luận là các công cụ không đồng ý về vị trí của chức năng.

Các công cụ đồng ý. Đối tượng có thể di chuyển và không có địa chỉ tải, vì vậy mỗi công cụ chọn một. Khấu trừ địa chỉ mà mỗi công cụ đã cung cấp `.text`và mỗi câu trả lời là`0x10`Người đại lý so sánh địa chỉ nguyên liệu vì không có gì cho biết địa chỉ trong mỗi công cụ có nghĩa gì.

Sau đó, đại lý cũng đọc`grade`trong `-O0`xây dựng và báo cáo 3, 8, 8 và 9 khối cơ bản từ bốn công cụ.`jmp rax`Hai công cụ đọc bảng nhảy thông qua việc di chuyển của nó. một công cụ chia một khối tại nhảy để đặt một nhãn. Một số lượng khối mà không có lý do đằng sau nó là một số mà không có yêu cầu.

Bài học này là bản đồ bạn cần trước khi bạn tin vào bất kỳ số nào. Bài học 32 đến 36 xây dựng một máy giải mã, một máy nâng, một hồ sơ bằng chứng, và một xây dựng lại. Phần hai của đường đua đặt chúng bên cạnh các công cụ người ta sử dụng. Để làm điều đó, bạn cần lịch sử của lĩnh vực, các gia đình các công cụ rơi vào, đường ống mỗi decompiler chạy, và một vòng xoáy để so sánh những gì các công cụ nói về các đối tượng bạn tự biên soạn.

```figure
re-37-field-map
```

## Năm mươi ba năm trong những bước đã được xác định

Khu vực này cũ hơn hầu hết các công cụ của nó.

### 1973 đến 1991: đầu tiên là bộ gỡ lỗi, sau đó là bộ gỡ bỏ

Các luận án giải thích đầu tiên là từ năm 1973. Hollander tại Stanford và Housel tại Purdue đã viết chúng, và cả hai đều được biết đến ngày nay thông qua trích dẫn.`adb`Một bài học về các chương trình này được thực hiện tại Bell Labs vào năm 1977, và bộ xử lý lỗi được phát hành với UNIX V7 vào năm 1979.`DEBUG`, với một bộ giải thể 8086, được phát hành trong PC-DOS 1.00 vào tháng 8 năm 1981. GDB của Richard Stallman đã được phân phối vào năm 1986. SoftICE đã đặt một bộ giải lỗi lõi trong DOS vào năm 1987.

Các bộ phận phân hủy hàng loạt tiếp theo. Sourcer, từ V Communications vào năm 1988, chạy nhiều lần qua một chương trình DOS và viết một danh sách bình luận.`objdump`Ilfak Guilfanov đã viết dòng đầu tiên của IDA vào tháng 1 năm 1991 và phát hành IDA 0.1 như phần mềm chia sẻ vào ngày 20 tháng 5 năm 1991.

### 1991 đến 2009: máy giải thể tương tác và máy giải thể đầu tiên

Cristina Cifuentes hoàn thành "Técniques de compilation inverse" tại QUT vào tháng 7 năm 1994.`dcc`, đưa i80286 chương trình DOS đến C, và bài báo năm 1995 của cô với Gough đã đặt ra các giai đoạn mà mọi trình giải biên dịch sau đó giữ. REC tiếp theo vào năm 1997 và Boomerang vào năm 2002, trình giải biên dịch nguồn mở đầu tiên, dưới giấy phép BSD.

IDA trở thành một sản phẩm thương mại tại DataRescue vào năm 1996, đạt được một plugin SDK vào năm 1999, và chuyển sang Hex-Rays, được thành lập vào năm 2005. Hex-Rays Decompiler 1.0 được xuất khẩu vào ngày 17 tháng 9 năm 2007. Cùng năm đó, Mike Van Emmerik đã đệ trình "Static Single Assignment for Decompilation", luận án đặt SSA ở trung tâm của dòng dữ liệu decompilation. "Sự so sánh cấu trúc của các đối tượng thực thi" (2004) của Halvar Flake bắt đầu gia đình khác nhau, và BinDiff được bán vào tháng 8 năm 2004.

radare bắt đầu vào tháng 2 năm 2006 với tư cách là một trình chỉnh sửa hex pháp y với 64 bit offset. radare2, bản viết lại mô-đun theo LGPL-3.0, đã được phát hành lần đầu tiên vào ngày 7 tháng 3 năm 2009.

### 2009 đến 2019: khung và đại diện trung gian

LLDB được công bố là một dự án phụ của LLVM vào ngày 8 tháng 6 năm 2010. BAP, nền tảng phân tích nhị phân với ngôn ngữ trung gian BIL của nó, xuất hiện tại CAV 2011. Google mua lại zynamics, những người tạo ra BinDiff, vào ngày 1 tháng 3 năm 2011. Hopper xuất hiện trên cửa hàng Mac App Store vào cuối năm 2011. Matt Godbolt bắt đầu trình duyệt Compiler Explorer vào năm 2012 để một lập trình viên C ++ có thể xem bộ sưu tập được tạo ra bởi một trình biên dịch.

Angr đã nhận được dòng mã đầu tiên của mình vào tháng 8 năm 2013. Bài báo Phoenix (Schwartz, Lee, Woo, Brumley, USENIX Security 2013) cho thấy cấu trúc bảo tồn ngữ nghĩa với 40 `goto`DREAM (Yakdan và những người khác, NDSS 2015) đã xóa `goto`Các tuyên bố có cấu trúc độc lập với mẫu. Vector 35 được thành lập vào ngày 14 tháng 1 năm 2015, và Binary Ninja ra bán vào ngày 23 tháng 7 năm 2016 với IL cấp thấp và API Python. Angr được công bố công khai vào năm 2015 và xếp thứ ba tại DARPA Cyber Grand Challenge vào tháng 8 năm 2016. BinDiff trở thành miễn phí vào tháng 3 năm 2016. Cutter 1.0 đã cung cấp cho radar2 một giao diện giao diện Qt vào tháng 12 năm 2017. Năm 2018, Guilfanov đã trình bày "Decompiler internals: microcode" tại Recon, mô tả công khai đầu tiên của Hex-Rays IR.

### 2019 đến 2026: máy giải trình mở và sự chuyển đổi nghiên cứu

Ghidra 9.0 được NSA phát hành tại Hội nghị RSA vào ngày 5 tháng 3 năm 2019 dưới Apache-2.0, với nguồn đầy đủ trên GitHub một tháng sau đó. Angr 8.19.2.4 đã thêm một trình giải thích sơ bộ vào cùng năm. Binary Ninja 2.0 đã xuất khẩu trình giải trình IL cấp cao của mình vào ngày 20 tháng 5 năm 2020. Rizin được công bố là một garpu của radar2 vào ngày 8 tháng 12 năm 2020, và nhóm Cutter chuyển sang nó. IDA Freeware 7.6 đã thêm một trình giải biên dịch x64 đám mây vào tháng 5 năm 2021.

BinDiff 8 được mở nguồn dưới Apache-2.0 vào ngày 25 tháng 9 năm 2023. SAILR (Basque và những người khác, USENIX Security 2024) trở thành nhà cấu trúc mặc định của angr và lập luận rằng chỉ có giả `goto`Các tuyên bố nên được loại bỏ, bởi vì Linux 6.1 có 3.754 trong nguồn của nó. Binary Ninja 4.0 đã thêm một phiên bản miễn phí vào tháng 2 năm 2024, và IDA 9.0 đã thêm `idalib`Các bài báo học-decompile được chạy từ SLaDe (2023) qua LLM4Decompile (2024) đến DecompileBench (2025) và hai nghiên cứu 2026 về khả năng đọc được hỗ trợ bởi đại lý và về các máy phân tích có nhiều hơn và lưu trữ ít hơn.

Các phiên bản được chạy trong bài học này là các phiên bản hiện tại vào ngày 14 tháng 10 năm 2026: Ghidra 12.1.4 (21 tháng 9 năm 2026), radar2 6.2.4 (5 tháng 10 năm 2026), rizin 0.9.1 (29 tháng 6 năm 2026) và angr 10.0.3 (10 tháng 10 năm 2026). Binary Ninja 6.0 "Krypton" (3 tháng 9 năm 2026) và IDA 9.4 (13 tháng 7 năm 2026) là các công cụ đóng cửa hiện tại. Bài học này không chạy chúng.

## Gia đình công cụ

Một công cụ thuộc về một gia đình theo những gì nó sản xuất.

### Máy tháo rời

Một mã sôi tuyến tính từ byte đầu tiên của một phần mã đến phần cuối cùng.`objdump -d`và `llvm-objdump -d`làm việc theo cách này, và không xây dựng một biểu đồ kiểm soát dòng chảy.`objdump`xử lý các biểu tượng như ranh giới hướng dẫn và xoay giữa chúng. binutils 2.47 (26 tháng 7 năm 2026) là GPL-3.0 hoặc sau đó. LLVM 23.1.3 là Apache-2.0 với ngoại lệ LLVM.`llvm-objdump`như "Apple LLVM phiên bản 17.0.0", và đó là bản sao bài học này được chụp.

Một bộ giải thể tương tác chạy giảm thu hồi từ các mục được biết, thêm các tính toán cho khởi động chức năng, và giữ cơ sở dữ liệu.`Disassembler`cộng với các máy phân tích tự động), Binary Ninja (sự hạ cánh lặp lại, sau đó là quét tuyến tính qua các vùng không rõ), Hopper, radar2 và rizin (`aa`- `aaa`- `af`), với Cutter và iaito là các GUI, tất cả đều thuộc gia đình này. Andriesse và những người khác (USENIX Security 2016) đo chín trong số đó trên các binary được tạo bởi trình biên dịch. Độ chính xác hướng dẫn gần 100 phần trăm, và phần cứng nguyên thủy là chức năng bắt đầu, với tỷ lệ âm sai của 20 phần trăm hoặc hơn.

### Máy phân tích

Các máy giải mã thương mại: Hex-Rays Decompiler (chẳng mười hai gia đình mục tiêu từ x86 đến RISC-V), HLIL của Binary Ninja với phiên bản C giả và quan điểm mã giả của Hopper. Các trình giải tập mở: trình giải tập Ghidra, một công cụ C ++ dưới Apache-2.0 mà r2ghidra và rz-ghidra sử dụng lại như một plugin và pypcode sử dụng lại như một nâng; trình giải tập angr trên AIL với cấu trúc SAILR dưới BSD-2-Clause; r2dec và jsdec trong JavaScript; Boomerang và `dcc`như lịch sử. radar2 cũng có một tích hợp `pdc`, "phản xuất phân tích giả trong cú pháp giống C". Rizin không có bộ phân tích tích tích hợp.`pdc`không tồn tại trong rizin 0.9.1, và`pdg`cần plugin rz-ghidra.

### Dòng dỡ lỗi

GDB (1986) với các đầu tiên của GEF và pwndbg, LLDB (2010), WinDbg với Time Travel Debugging (2017), OllyDbg (đóng vào năm 2014), x64dbg (GPL-3.0, 2014), Ghidra Debugger với các kết nối Python của nó, Binary Ninja debugger, và các bộ gỡ lỗi tích hợp của radar2 và rizin. Bài học 42 sử dụng hai trong số đó trên các xây dựng của riêng bạn.

### Các khung phân tích nhị phân

Angr (VEX IR, thực hiện biểu tượng, `CFGFast`và `CFGEmulated`, decompiler), BAP (BIL, OCaml), Dyninst, Jakstab và ByteWeight là các khung mà Andriesse đặt tên.`import binaryninja`, và IDA thông qua `idalib`- Tôi không biết.

### Các thư viện định dạng và động cơ

LIEF 1.0.0 (12 tháng 7 năm 2026, Apache-2.0) phân tích các định dạng ELF, PE, Mach-O, COFF và Android. CLE, "CLE Loads Everything", là bộ tải Angr. Capstone 5.0.9 (28 tháng 5 năm 2026, BSD-3-Clause) mã hóa; Keystone 0.9.2 (GPL-2.0) tập hợp; Unicorn 2.1.4 (GPL-2.0) mô phỏng. radar2 6.2.4 gói Capstone 5, và rizin 0.9.1 nhà cung cấp Capstone, Zydis, và tree-sitter.

### Các công cụ diffing và trình xem bên biên dịch

BinDiff 8 (Apache-2.0) với plugin BinExport 12 của mình cho IDA Pro, Binary Ninja và Ghidra; Diaphora 3.4.3 (11 tháng 10 năm 2026, AGPL-3.0) như một plugin IDA; `radiff2`và `rz-diff`. Compiller Explorer (BSD-2-Clause) cho thấy bộ sưu tập mà một trình biên dịch phát ra cho một đoạn nguồn, đó là hướng về phía trước của tất cả mọi thứ khác trong danh sách này. Bài học 44 sử dụng gia đình khác nhau.

### Phiên bản, giấy phép, và bài học này đã được

| Tool | Version read on 2026-10-14 | Licence | Headless entry | Ran here |
|---|---|---|---|---|
| Ghidra | 12.1.4 | Apache-2.0 | `analyzeHeadless`, `pyghidra.start()` | yes, on all four objects |
| radare2 | 6.2.4 | LGPL-3.0 | `r2 -qc '<cmds>' file`, `rabin2` | yes |
| rizin | 0.9.1 | LGPL-3.0 | `rizin -qc '<cmds>' file`, `rz-bin` | yes |
| angr | 10.0.3 | BSD-2-Clause | `angr.Project` in Python | yes |
| llvm-objdump | Apple LLVM 17.0.0 | Apache-2.0 with LLVM exception | `llvm-objdump -d -r` | yes |
| Binary Ninja | 6.0 "Krypton" | commercial; Free edition for non-commercial use | `binaryninja.load()` with a Commercial, Ultimate, or headless licence | no, documentation only |
| IDA Pro | 9.4 | commercial subscription; IDA Free for non-commercial x86 and x86-64 | `idat`, `ida -A -S`, `idalib` | no, documentation only |
| Hopper | 6.6.0 | commercial, perpetual | none documented | no, documentation only |
| Cutter | 2.5.0 | GPL-3.0 | GUI over rizin | no |

Phiên bản miễn phí của Binary Ninja chỉ giải mã x86, x86-64, ARMv7 và AArch64 và không có API. IDA Free không có IDAPython, không SDK, và không `idalib`Mỗi câu nói về hai công cụ trong bài học này đến từ tài liệu và các ghi chú phát hành của chúng, và con số đánh dấu chúng là không chạy.

## Đường ống giải thép, từng bước

Cifuentes đặt tên cho các giai đoạn vào năm 1994: phân tích tổng hợp, phân tích ngữ nghĩa, tạo mã trung gian, tạo đồ thị lưu lượng kiểm soát, phân tích lưu lượng dữ liệu, phân tích lưu lượng kiểm soát và tạo mã. Cô chia chúng thành một đầu phụ thuộc vào máy, một giữa phụ thuộc vào máy và ngôn ngữ, và một đầu sau phụ thuộc vào ngôn ngữ. Từ đó, mọi người phân tích đều giữ lại hình dạng đó và đổi tên các bộ phận. Bảng dưới đây cho thấy tám giai đoạn được sử dụng trong bài học này và tên của mỗi công cụ cho chúng. Hình hiển thị cùng bảng với các cột công cụ có thể chọn.

| Stage | Ghidra | Binary Ninja | Hex-Rays / IDA | radare2 | rizin | angr |
|---|---|---|---|---|---|---|
| Loader | `ElfLoader`, `MachoLoader`, `PeLoader`; `.ldefs` picks the language | `BinaryView`, `BinaryViewType` | loader module (`LDSC`) | RBin (`rabin2`) | RzBin (`rz-bin`) | CLE (`cle.Loader`, `main_object`) |
| Disassembly | `Disassembler`; SLEIGH `.slaspec` compiled to `.sla`; analyzers "Disassemble Entry Points", "Function Start Search" | architecture plugin; Recursive Descent, then linear sweep phases | processor module (`ana.cpp`, `emu.cpp`, `out.cpp`); autoanalysis queues; FLIRT | RArch plugin to `RAnalOp`; `aa`, `aaa`, `af` | RzAnalysis plugin; `aa`, `aaa`, `af` | Capstone blocks; `CFGFast` function start search |
| CFG recovery | "Generate Basic Blocks and the CFG"; `BlockGraph`; "Decompiler Switch Analysis" | `Function`, `BasicBlock`; "Control Flow Graph (CFG) Analysis" phase | `mbl_graph_t`, ready at `MMAT_LOCOPT` | `afb`, `agf`, `aab` | `afb`, `agf`, `aab` (Nucleus) | `CFGFast`, `CFGEmulated`; `kb.functions`; IRSB |
| Lifting | "Generate Raw P-code"; Varnodes in `ram`, `register`, `const`, `unique` | Lifted IL, LLIL, Mapped MLIL, MLIL | microcode (`minsn_t`, `mop_t`); `MMAT_GENERATED` | ESIL (`asm.esil`, `ae`) | RzIL (`aoi`, `aez`) | VEX (`pyvex.lift`, IRSB), then AIL |
| SSA | `Heritage`, `ActionHeritage`; `MULTIEQUAL`, `INDIRECT` | LLIL SSA, MLIL SSA, HLIL SSA; `HLIL_VAR_PHI` | no named SSA; use-def data flow in `MMAT_GLBOPT1` to `3` | none; ESIL is built for emulation | none; RzIL is built for emulation | `_stage_transform_to_ssa_level0` and `level1`; `SeqNodeDephication` |
| Data flow and types | `ActionDeadCode`, `ActionInferTypes`, the `Rule` pool; prototype from `.cspec` | MLIL constant propagation, variables and types; `analyzeReturns` | "Transform microcode"; `MMAT_CALLS`, `MMAT_GLBOPT`, `MMAT_LVARS`; TIL | `afv`, `afc`, `aaft`; ESIL emulation | `afv`, `afc`, `aft` | `CallingConventionAnalysis`, `VariableRecoveryFast`, `Typehoon` |
| Structuring | `CollapseStructure`; `BlockIf`, `BlockWhileDo`, `BlockSwitch`, `BlockGoto` | `HLIL_IF`, `HLIL_WHILE`, `HLIL_SWITCH`; AST at `root` | "Generate ctree"; structural analysis; goto regions | `pdc`; `pdd` (r2dec); `pdg` (r2ghidra) | `pdg` (rz-ghidra); jsdec | `RegionIdentifier`; `RecursiveStructurer` with `SAILRStructurer` |
| Emission | "Emit Final C Tokens"; `PrintC`, `ActionNameVars`, `ActionSetCasts` | HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python | "Beautify ctree; Print ctree"; `cfunc_t` | text of `pdc`, `pdd`, `pdg` | `pdg` text | `CStructuredCodeGenerator`; `codegen.text` |

### Loader

Loader phân tích container, lập bản đồ các phần, và đọc các biểu tượng và di chuyển. Trong một đối tượng di chuyển không có địa chỉ nào, vì vậy loader chọn một. radar2 và rizin lập bản đồ tệp tại `0x08000000`, khiến cho `.text``0x08000040`vì phần bắt đầu từ file offset `0x40`. CLE chỗ `.text``0x400000`- Ghidra.`ElfLoader`Đặt nó ở `0x100000`- `llvm-objdump`Chụp phần trục và không có cơ sở.

Các bộ tải cũng khác nhau về việc di chuyển. Ghidra xử lý chúng khi nhập khẩu, và CLE áp dụng chúng. radar2 in một gợi ý khi mở đối tượng: di chuyển không được áp dụng, và `bin.relocs.apply=true`Điều mà một người tải làm với việc di chuyển quyết định những gì mỗi giai đoạn sau đó có thể thấy, và bạn sẽ gặp hiệu quả trong `-O0`nhảy xuống bàn dưới.

### Phong cách

Bài học 33 xây dựng cả hai phương pháp.`llvm-objdump`chạy giảm lặp lại và sau đó thêm một tìm kiếm cho hàm bắt đầu. Tài liệu của Binary Ninja đặt tên các giai đoạn theo thứ tự: Quay giảm tái phát, Phân tích mục tiêu gọi, Phân tích CFG như "sự tách rời tuyến tính của các vùng chưa biết", và Phân tích gọi đuôi. Ghidra chạy các phân tích của mình theo ưu tiên, với "Vô điểm nhập cảnh giải tán" và "Xử lý bắt đầu tìm kiếm" sớm. IDA giữ hàng tự động phân tích, mỗi hàng có ưu tiên, và chữ ký FLIRT cho mã thư viện. Angr's `CFGFast`tài liệu bốn nguồn của chức năng bắt đầu: biểu tượng, quét tiền đề, gọi mục tiêu, và quét hoàn chỉnh của các byte còn lại.

### Khôi phục CFG

Mỗi công cụ cắt các khối như bài học 33 đã làm, với một sự khác biệt bạn sẽ đo.`call`, bởi vì IRSB của nó là một lối vào đơn, nhiều lối ra khối và một cuộc gọi là một lối ra. Ghidra, radar2, và rizin chạy qua một cuộc gọi.`grade_label``-O0`, gọi là`grade`, Angr báo cáo 2 khối và ba báo cáo khác 1.

### Đánh nâng

Binary Ninja định nghĩa nâng là "t dịch từ ngôn ngữ cấp thấp hơn sang ngôn ngữ trung gian được coi là cao hơn". IR khác nhau về mục đích của chúng. P-code và VEX được xây dựng để phân tích và phân tích. ESIL và RzIL được xây dựng để mô phỏng, và không có một giai đoạn SSA. Hắc mã vi mô bắt đầu như mã RISC với 72 opcode và đi qua các mức độ trưởng thành từ `MMAT_GENERATED`đến`MMAT_LVARS`. Binary Ninja nâng lên Lifted IL, sau đó gấp các cờ thành điều kiện trong LLIL, và MLIL "đổi dịch các đăng ký và truy cập bộ nhớ thành biến". Phần tiếp theo đặt bốn IR này cạnh nhau trên một hướng dẫn.

### SSA

Các luận án của Van Emmerik liệt kê những gì SSA mua một decompiler: biểu hiện phổ biến, tham số và xác định trở lại mà không có giả định ABI, phân tích bảo tồn, phân tích loại như một vấn đề lưu lượng dữ liệu hiếm, và phân tích các bước nhảy gián tiếp và gọi. Ghidra gọi cấu trúc SSA của nó `Heritage`và thêm hai hoạt động chỉ tồn tại trong biểu đồ,`MULTIEQUAL`cho phi và`INDIRECT`Binary Ninja phơi bày một dạng SSA ở mọi cấp IL. angr có hai giai đoạn SSA bên trong`Clinic`Hex-Rays không nêu tên một mẫu SSA và sử dụng dòng dữ liệu định nghĩa trong các thông qua tối ưu hóa toàn cầu của nó. ESIL và RzIL không có.

### Dòng chảy và loại dữ liệu

Loop đơn giản hóa chính của Ghidra chạy "Tấm mã chết", "Tổ xuất các loại địa phương" và "Hãy thực hiện viết lại thuật ngữ" cho đến khi không có gì thay đổi, với việc viết lại được thực hiện bởi một nhóm `Rule`Hex-Rays biến đổi mã vi mô, phát hiện các lập luận gọi tại `MMAT_CALLS`, và phân bổ các biến địa phương tại `MMAT_LVARS`. Angr chạy `CallingConventionAnalysis`- `VariableRecoveryFast`, và`Typehoon`, một thực hiện của Noonan, Loginov, và Cok's polymorphic type inference.

### Tạo cấu trúc

Ghidra `CollapseStructure`tìm kiếm các biểu đồ phụ phù hợp với một cấu trúc, sụp đổ chúng thành một nút, và khi nó bị kẹt, loại bỏ một cạnh và đánh dấu nó không cấu trúc. Hex-Rays làm giảm CFG đến `if`- `while`- `do`, và`switch`và để lại phần còn lại như các khu vực goto. angr xác định các khu vực nhập cảnh duy nhất, một lần ra khỏi và cấu trúc chúng với `SAILRStructurer`theo mặc định, với `PhoenixStructurer`và `DreamStructurer`Bài học 34 được viết bởi một nhà cấu trúc bằng tay.

### Khí thải

Ghidra phát C token qua `PrintC`với một máy in Oppen đẹp sau đó `ActionNameVars`và `ActionSetCasts`Hex-Rays làm đẹp và in cây ctr. Binary Ninja render HLIL như Pseudo C, Pseudo Rust, hoặc Pseudo Python. angr trả lại `codegen.text`. dấu vân tay radar2`pdc`- `pdd`, hoặc`pdg`- Tôi không biết.

## Một hướng dẫn trong bốn IR

Nhận đi`48 83 ec 10`- `subq $0x10, %rsp`- Đánh mã nó trên giấy với các quy tắc từ bài học 33.

1. `48`REX có `W = 1`- Opera là 64 bit.
2. `83`là mã op số toán học nhóm-1 với một mã 8 bit ngay lập tức.
3. `ec`là ModRM `11 101 100`- `mod = 11`là mẫu đăng ký. `reg = 101`là `/5`, đó là `sub`- `r/m = 100`là `%rsp`- Tôi không biết.
4. `10`là ngay lập tức, 16.

Bốn người nâng được trao bốn byte.

ESIL từ radar2 6.2.4 là một chuỗi tách biệt bằng dấu ngoặc gồm 30 token:

```text
16,0x8000000000000000,-,!,16,rsp,-=,63,$o,^,of,:=,63,$s,sf,:=,$z,zf,:=,$p,pf,:=,64,$b,cf,:=,4,$b,af,:=
```

Đó là một máy đống.`16,rsp,-=`Phóng viên của các công ty này sẽ được ghi lại trong các biểu ngữ:`$o`tràn, `$s`dấu hiệu,`$z`0`$p`Tương đương,`$b`vay.

RzIL từ rizin 0. 9. 1 là một biểu hiện S với 14 `set`tác động:

```text
(seq (set op1 (var rsp)) (set op2 (bv 64 0x10)) (set sub (- (var op1) (var op2))) (set rsp (var sub))
     (set _result (var sub)) (set pf (! (lsb (let _val (cast 8 false (var _result)) ...))))
     (set zf (is_zero (var _result))) (set sf (msb (var _result))) ... (set cf (|| ...)) (set of (|| ...)) (set af (|| ...)))
```

Mỗi cờ là một biểu hiện boolean trên bitvector.`let`- Tôi không biết.

Mã P từ thông số kỹ thuật SLEIGH `x86:LE:64:default`thông qua pypcode 4.0.1 là chín hoạt động sau khi `IMARK`- Có thể là:

```text
CF = RSP < 0x10
OF = sborrow(RSP, 0x10)
RSP = RSP - 0x10
SF = RSP s< 0x0
ZF = RSP == 0x0
unique[58300:8] = RSP & 0xff
unique[58400:1] = popcount(unique[58300:8])
unique[58500:1] = unique[58400:1] & 0x1
PF = unique[58500:1] == 0x0
```

Đăng ký chuyển nhượng với người tạm thời trong `unique`Các cờ được tính toán theo hướng dẫn, nhiệt tình, và`CF`và `OF`được tính trước khi trừ tính được ghi lại `RSP`- Tôi không biết.

VEX từ pyvex 10.0.3 là bảy tuyên bố sau khi `IMark`- Có thể là:

```text
t2 = GET:I64(offset=48)
t0 = Sub64(t2,0x0000000000000010)
PUT(offset=144) = 0x0000000000000008
PUT(offset=152) = t2
PUT(offset=160) = 0x0000000000000010
PUT(offset=168) = 0x0000000000000000
PUT(offset=48) = t0
```

Không có cờ xuất hiện. VEX tên đăng ký theo sự thay đổi của họ trong nhà nước khách, và thay đổi 48 là `rsp`- Tháo phí 144 đến 168 là`cc_op`- `cc_dep1`- `cc_dep2`, và`cc_ndep`. máy nâng lưu trữ mã hoạt động 8, đó là 64 bit trừ, và hai operands. Một nhánh sau đó đọc một cờ tính toán nó từ thân.`pcode.writesFlags`đúng và `vex.computesFlags`là sai trong báo cáo và tại sao VEX là ngắn nhất trong bốn.

4 máy nâng cùng nhau.`48 63 c7`- `movslq %edi, %rax`, hướng dẫn đầu tiên của `grade``-O1`, đưa ra 5 token ESIL (`32,edi,~,rax,=`), 1 RzIL `set`, 1 hoạt động mã P (`RAX = sext(EDI)`Không có người nâng cờ nào viết vì hướng dẫn không có.`(register, 0x0, 8) INT_SEXT (register, 0x38, 4)`: registry offset 0 là `RAX`, bù đắp`0x38`là `RDI`, và kích thước là 8 và 4 byte.

`83 f9 04`- `cmpl $0x4, %ecx`, từ biên giới kiểm tra vào `grade`, cho 30 token ESIL, 13 RzIL `set`hiệu ứng, 10 hoạt động mã P, và 7 tuyên bố VEX với `cc_op`7, trừ 32 bit. Không có gì viết.`%ecx`Hai chiều rộng trừu tượng mà bạn sẽ gặp trong VEX là 7 cho 32 bit và 8 cho 64 bit, và người dịch mà bạn xây dựng mang theo bảng đó.

## Bốn cơ sở địa chỉ cho một chức năng

Trước khi vòng xoáy có thể so sánh bất cứ điều gì nó phải đồng ý với chính nó về nơi một chức năng.`grade`trong `ledger-x86_64-O1.o`- Tôi không biết.

| Tool | Address of `.text` | Address of `grade` | Offset |
|---|---|---|---|
| `llvm-objdump` | `0x0` | `0x10` | `0x10 - 0x0 = 0x10` |
| radare2, rizin | `0x08000040` | `0x08000050` | `0x08000050 - 0x08000040 = 0x10` |
| angr | `0x400000` | `0x400010` | `0x400010 - 0x400000 = 0x10` |
| Ghidra | `0x100000` | `0x100010` | `0x100010 - 0x100000 = 0x10` |

Bảng biểu tượng nói `grade`là ở `.text + 0x10`Mỗi công cụ đều đồng ý khi cơ sở được loại bỏ.`iSj`trong radar2 và rizin, các `.text`mục mục trong đoạn bắt giữ, `.text`Khóa bộ nhớ trong ghi hình Ghidra, và không cho việc lau.`test_every_tool_places_grade_at_offset_0x10_from_its_own_base`sửa chữa sự thật đó.

## Những nơi công cụ đồng ý và nơi chúng chia rẽ

Lăng trong `code/main.py`đọc các hình ảnh, giảm từng địa chỉ, và so sánh. Đây là những con số mà nó báo cáo, và các xét nghiệm khẳng định mỗi số.

### Trường hợp thỏa thuận: sổ cái ở -O1

Bốn chức năng, 56 hướng dẫn trong quét, 54 bên trong các biểu tượng và 2 trong đệm. Mỗi công cụ báo cáo các hướng dẫn bắt đầu trong mỗi chức năng: 9, 14, 13 và 18. Bốn nhà xây dựng đồ họa báo cáo 3, 3, 5 và 4 khối và 2, 3, 5 và 4 cạnh, và các tập hợp cạnh giống nhau, cặp đôi, trên radar2, rizin, angr, và Ghidra.`total`là những bài học 33 được vẽ bằng tay.

Sự khác biệt duy nhất là ở độ đệm.`66 90`sau đó`grade`- `90`sau đó`total`) được giải mã bởi việc lau, mà không có lý do để dừng lại, và bởi sự giận dữ, mà tạo ra `sub_40003e`và `sub_40005f`Không có biểu tượng. Radar2, Rizin và Ghidra không tuyên bố bất kỳ một trong số họ.

### Trường hợp vectorized: sổ cái ở -O2

`total`là 41 hướng dẫn trong 10 khối với 13 cạnh, trong mỗi một trong bốn trình tạo đồ thị. vòng SSE2 và vòng dư scalar từ bài học 33 được cắt theo cùng một cách ở khắp mọi nơi. angr thêm hai chức năng tại padding.

### Bảng nhảy: điểm ở -O0

Ở đây, các công cụ chia rẽ, và chia rẽ là bài học.

| Tool | Blocks | Edges | What the capture says |
|---|---|---|---|
| radare2 | 3 | 2 | the block at `0x62` has no successor; bytes `0x76` to `0x9a` are never reached; 8 instruction starts missing |
| rizin | 8 | 11 | the block at `0x62` carries a `switch_op` with 5 cases and 4 distinct targets |
| angr | 8 | 7 | the case blocks exist, and the transfer at `0x62` goes to an unresolvable target node |
| Ghidra | 9 | 12 | `switchD` label at `0x74` splits the block; four `COMPUTED_JUMP` flows to `0x76`, `0x7f`, `0x88`, `0x91` |

Cả bốn người đã giải mã 33 hướng dẫn tương tự khi họ đến với họ.`jmp rax`và để lại 36 byte không được yêu cầu, và tên của các tên sử dụng có thể dao động như mã bị bỏ lỡ. Rizin và Ghidra tìm thấy bốn mục tiêu khác nhau mà bài học 33 đọc từ năm di chuyển trong năm`.rela.rodata`Angr liệt kê các khối trường hợp bên trong `grade`và vẫn không có cạnh từ khối nhảy đến họ; bắt giữ của nó ghi lại chuyển giao tại `0x62`như dẫn đến một nút mục tiêu không thể giải quyết, và decompiler của nó in một máy tính `goto`Ghidra có một khối và một cạnh nhiều hơn rizin cho cùng một dòng chảy điều khiển bởi vì phân tích chuyển đổi của nó đặt một nhãn trên `jmp rax`và mô hình khối bắt đầu một khối mới tại một nhãn.

Bài học-33 biểu đồ có 8 khối và 11 cạnh. rizin phù hợp với nó chính xác. Điểm là để thấy rằng 9 và 11 và 7 và 2 không phải là bốn phép đo của mã được tìm thấy.

### Dữ liệu trong mã: bẫy tháo

`lookup`là 24 byte với 4 byte bảng `31 c0 90 48``0x10`. báo cáo quét 8 hướng dẫn bắt đầu trong phạm vi đó.`0x10`- `0x12`, và`0x13`, và một khởi đầu bị thiếu ở `0x14`Đó là `addq $0x1, %rax`Từ bài học 33 một byte sớm hơn. Radar2, Rizin, và Ghidra báo cáo 6 bắt đầu, 2 khối, 1 cạnh, và rời `0x10`đến`0x14`không được yêu cầu. Angr báo cáo cùng 2 khối và 1 cạnh cho `lookup`và sau đó phát minh ra`sub_400010`trên bảng byte: 2 hướng dẫn trong một khối 4 byte kết thúc tại `0x14`, nơi khối thứ hai của `lookup`bắt đầu, do đó REX byte tại `0x13`Điều cuối cùng của vòng xoáy cho đối tượng này là không có nhà xây dựng đồ họa nào giải mã.`0x10`đến`0x14`, vì vậy các byte nằm bên trong một hàm và là dữ liệu.

### Được phát minh và bỏ qua, theo công cụ

Trên bốn đối tượng, vòng xoáy đặt tên cho 9 chức năng mà Angr phát minh ra mà không có biểu tượng, mỗi chức năng ở padding hoặc trên bàn bẫy.`grade``-O0`Nó đặt tên 9 phạm vi mà các mã hóa trôi qua tuyến tính và không có nhà xây dựng đồ thị nào xử lý như mã: tám khoảng trống lấp xấp cộng với bảng bẫy. Nó không đặt tên bất kỳ hàm bị bỏ lỡ trong bất kỳ công cụ nào.

## Ba máy giải mã trên lớp

Ba trong số các công cụ được chụp phát ra văn bản giống như C cho `grade``-O1`Nguồn là`switch (score / 10)`với năm trường hợp, được biên soạn theo kiểm tra giới hạn và bảng giá trị trả lại.

Ghidra 12.1.4:

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

Angr 10.0.3:

```c
extern unsigned int g_4000b4[4];

unsigned int grade(int a0)
{
    unsigned int v1;  // ecx
    unsigned int v2;  // eax

    v1 = (unsigned int)((long long)(a0 * 1717986919) >> 0x22) + (unsigned int)(a0 * 1717986919 >> 63) - 6;
    v2 = 0;
    if (v1 <= 4)
        v2 = g_4000b4[v1];
    return v2;
}
```

radar2 6.2.4, `pdc`- Có thể là:

```c
void sym.grade (int64_t arg1) {
    rax = edi
    rax = rax * 0x66666667
    rcx = rax
    rcx >>= 0x22
    rax >>>= 0x3f
    ecx += eax
    ecx += 0xfffffffa
    eax = 0
    v = ecx - 4
    if (((unsigned) v) <= 0) {
        eax = ecx
        rcx = rip
        eax = dword [rcx + rax*4]
    }
    return
}
```

Đọc 3 đối với đường ống.`0x66666667`và chuyển đổi bởi 34 trở lại `param_1 / 10`Angr đã nâng các byte và rời toán học như`a0 * 1717986919 >> 0x22`. radar2 `pdc`là ESIL emulation cộng với giả thuyết tổng hợp: tên đăng ký, không có biến, không có loại, và kiểm tra giới hạn được in như `<= 0`Ghidra đã gõ tải bảng qua.`DAT_001000b4`; tuyên bố `g_4000b4[4]`, bốn yếu tố trong đó nguồn có năm.`-O1`không còn chuyển đổi trong các byte.`-O0`, nơi có bàn nhảy, Ghidra in `switch(param_1 / 10)`với các trường hợp 6 đến 10 và mặc định, và angr in một máy tính tính `goto`- Tôi không biết.

Rizin không có máy giải âm riêng của mình, và các hồ sơ thu được`pdc`HLIL của Binary Ninja và cây Hex-Rays là hai kết quả mà bài học này không thể nắm bắt được.

## Hãy xây dựng nó

Chạy demo:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
```

Kết quả là một báo cáo JSON. Nó mở với các phiên bản công cụ được ghi lại tại thời điểm chụp và với các công cụ hiện có trên máy của bạn, tất cả có thể không có. Sau đó cho mỗi trong bốn đối tượng nó cho các biểu tượng mở rộng, khoảng trống lấp, cơ sở mỗi công cụ được sử dụng, chức năng khởi động mỗi công cụ được tìm thấy hoặc phát minh, và cho mỗi chức năng sự đồng thuận khởi động hướng dẫn, số khối, số cạnh, và các cạnh mỗi công cụ thiếu. Nó kết thúc với kế toán byte cho mỗi công cụ, ghi chú của các công cụ, một danh sách các phát hiện trong các câu đơn giản, và phần IR: đầu ra của người dịch thuật cho ba hướng dẫn bên cạnh số lượng được đo trên các thang máy được chụp.

Hình dạng dự kiến:

```json
{
  "captureTools": {"llvm-objdump": "Apple LLVM version 17.0.0", "radare2": "radare2 6.2.4 ...", "rizin": "rizin 0.9.1 ...", "angr": "10.0.3", "ghidra": "12.1.4"},
  "localTools": {"radare2": "absent", "...": "..."},
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "bases": {"llvm-objdump": "0x0", "radare2": "0x8000040", "angr": "0x400000", "ghidra": "0x100000", "...": "..."},
      "functions": {"grade": {"blocks": {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9}, "edges": {"radare2": 2, "rizin": 11, "angr": 7, "ghidra": 12}, "...": "..."}},
      "findings": ["radare2 never reaches bytes 0x76-0x9a inside grade that the other graph builders decode", "..."]
    }
  },
  "ir": {"translator": [{"text": "subq $0x10, %rsp", "flags": {"pcodeLike": "eager", "vexLike": "thunk"}, "...": "..."}], "observed": {"...": "..."}}
}
```

Đọc `code/main.py`theo thứ tự này:

1. `read_text_symbols()`đọc các tiêu đề phần và các `STT_FUNC`Các biểu tượng của `.text`Bảng biểu tượng là sự thật duy nhất của vòng xoáy, và`TextSection.gaps()`lấy chất đệm từ đó.
2. `parse_objdump()`- `parse_r2_family()`- `parse_angr()`, và`parse_ghidra()`mỗi lần biến một bắt thành một `ToolView`: một cơ sở, hướng dẫn như bù đắp cho chiều dài, và một `FunctionView`mỗi hàm với các khối, cạnh, và bất kỳ văn bản được phân tích.
3. `majority()`và `ranges()`Hai người này là những người giúp đỡ, mọi sự tương đồng đều có thể dùng.
4. `function_report()`so sánh hướng dẫn bắt đầu với phần lớn các nhà xây dựng đồ thị, sau đó đếm khối, sau đó đặt cạnh, và liệt kê những gì mỗi công cụ thiếu.
5. `byte_report()`ghi cho mỗi byte như mã bên trong một biểu tượng, đệm, không được yêu cầu, phát minh ra, hoặc bỏ lỡ, và đặt tên các byte bên trong các biểu tượng mà không có nhà xây dựng đồ thị nào giải mã.
6. `findings()`biến những câu đó thành câu, và`compare()`tập hợp một báo cáo cho mỗi đối tượng.
7. `decode_small()`- `to_pcode_like()`, và`to_vex_like()`là người dịch: ba mã hóa trong hình thức đăng ký, một phong cách nhiệt tình, một phong cách thunk.
8. `observed_ir()`đo lường các thang máy bị bắt và `figure_data()`tập hợp thời gian, bảng giai đoạn, và bằng chứng hình ảnh cho thấy.

Có ba lệnh nữa.`python3 code/main.py compare FIXTURE.o`in báo cáo của một đối tượng. `python3 code/main.py ir 4883ec10`in hai mẫu của người dịch cho một hướng dẫn. `python3 code/main.py figure-data`in dữ liệu được nhúng vào hình ảnh.

Những con bắt được thực hiện một lần bởi `code/fixtures/capture_tools.py`, ghi lại mọi lệnh và phiên bản trong `captures.json`. Các dây và các thử nghiệm không bao giờ khởi động một công cụ. Nếu bạn có các công cụ, chạy kịch bản chụp để làm mới các tệp, và đọc các thiết bị README cho môi trường nó cần.

## Sử dụng nó

Sử dụng dây đeo trên một vật thể mới theo thứ tự này.

1. Hãy tự tạo ra đối tượng và giữ lệnh biên dịch viên. Hãy đọc bảng biểu tượng của nó trước khi bạn mở bất kỳ công cụ nào, để bạn biết có bao nhiêu chức năng và nơi đệm.
2. Chụp mỗi công cụ một lần trong chế độ không có đầu. lưu trữ đầu ra nguyên thô và lệnh chính xác bên cạnh đối tượng. Một sự bất đồng bạn không thể đọc lại không phải là một phát hiện.
3. Kiểm tra cơ sở. Chọn một hàm và xác nhận rằng mỗi công cụ đặt nó ở cùng một ofset sau khi bạn trừ `.text`Nếu không, hãy dừng lại và tìm ra công cụ đó tải gì.
4. Nếu các nhà xây dựng đồ thị không đồng ý ở đây, phần còn lại của so sánh là về giải mã chứ không phải về phân tích.
5. So sánh các khối và cạnh, và đọc các ghi chú của mỗi công cụ trước khi bạn đánh giá một con số.`switch_op`, một `COMPUTED_JUMP`, hoặc một nút mục tiêu không thể giải quyết giải thích hầu hết sự khác biệt.
6. Lưu ý các byte. Đánh dấu mà công cụ tuyên bố là một heuristic đang làm việc. Các byte biểu tượng mà công cụ để lại là một bước đi dừng. Các byte biểu tượng mà không có nhà xây dựng đồ thị tuyên bố là dữ liệu.
7. Viết ra những công cụ mà bạn không chạy. Một mô tả từ tài liệu hữu ích và là một loại bằng chứng khác với một hình ảnh chụp.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: một chức năng, bốn cơ sở

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/code
python3 -q
```

Đi chạy:

```python
from main import *
views = load_views("ledger-x86_64-O1.o")
{tool: hex(view.base) for tool, view in views.items()}
{tool: hex(view.functions["grade"].start + view.base) for tool, view in views.items()}
```

Viết ra bốn địa chỉ nguyên liệu trước khi bạn chạy dòng thứ hai và kiểm tra chúng với bảng trong bài học này.`grade`với `grade_label`và tính toán bằng tay nơi nó ngồi ở Ghidra.

### Phòng thí nghiệm B: bàn nhảy từ bốn bên

```python
report = compare("ledger-x86_64-O0.o")
report["functions"]["grade"]["blocks"]
report["functions"]["grade"]["edgesMissingPerTool"]["radare2"]
report["notes"]["rizin"]
report["notes"]["ghidra"]
report["bytes"]["radare2"]["misses"]
```

Đếm các cạnh radar2 thiếu và phù hợp với mỗi một dòng của `-O0`Sau đó đọc ghi chú Ghidra và tìm ra `switchD`nhãn trong ghi đạm Ghidra.

### Phòng thí nghiệm C: những lá cờ nhiệt tình chống lại một mảnh

```python
translate("48 83 ec 10")["pcodeLike"]
translate("48 83 ec 10")["vexLike"]
translate("83 f9 04")["vexLike"]
{row["name"]: (row["pcode"]["ops"], row["vex"]["statements"]) for row in observed_ir()["instructions"]}
```

Tìm ra `cc_op`liên tục trong cả hai đầu ra và giải thích tại sao một là 8 và 7 khác.`translate("48 01 c8")`và đọc `TranslateError`- Tôi không biết.

### Phòng thí nghiệm D: bẫy dưới năm công cụ

```python
report = compare("sweep-trap.o")
report["functions"]["lookup"]["instructionStarts"]
report["bytes"]["dataInsideSymbols"]
report["functionStarts"]["angr"]
```

Khóa mã các byte `31 c0 90 48 83 c0 01`trên giấy như một quét sẽ, sau đó như một giảm sẽ sau khi `jmp`- Đáp lại hai danh sách của anh với số dư và bắt đầu báo cáo mất tích.

## Phòng thí nghiệm thực hành

Thêm một cú bắt thứ năm và mở rộng vòng xoáy.

Yêu cầu:

- Chọn một công cụ mà bài học này không ghi lại và bạn có thể chạy trên máy tính của mình: GNU `objdump`, LIEF với Capstone, một phiên bản Binary Ninja Free được xuất khẩu bằng tay, hoặc Ghidra với một bộ phân tích khác.`captures.json`- Tôi không biết.
- Viết một phân tích biến hình ảnh thành `ToolView`với cơ sở của công cụ, hướng dẫn, chức năng, khối nơi công cụ có chúng, và cạnh nơi nó có chúng.
- Thêm công cụ vào `TOOLS`và, nếu nó xây dựng một biểu đồ, để `DESCENT_TOOLS`Hãy chạy demo và đọc những gì đã thay đổi trong bộ đa số.
- Viết một bài kiểm tra khẳng định khối của công cụ tính đến `ledger-x86_64-O1.o`và một bài kiểm tra khẳng định nó làm gì với bàn bẫy.
- Viết một đoạn cho bài học nói, bằng lời của công cụ, nó gọi là bộ tải, bộ gỡ bỏ và CFG.

Thành công là nghĩa của`python3 code/main.py`báo cáo công cụ mới trong `captureTools`, mỗi hàm trong `ledger-x86_64-O1.o`giữ `allDescentToolsAgree`đúng, và các kết quả cho `sweep-trap.o`nói công cụ mới đã làm gì với byte `0x10`đến`0x14`- Tôi không biết.

## Bài học: Cây tạo vật

Bài học này bao gồm:`outputs/skill-the-reverse-engineering-landscape.md`Sử dụng nó để chạy một số công cụ trên một đối tượng bạn đã xây dựng, giảm địa chỉ của chúng đến một cơ sở, và báo cáo, cho mỗi chức năng, nơi họ đồng ý về các lệnh bắt đầu, khối và cạnh, và bao nhiêu byte mỗi công cụ phát minh hoặc bỏ lỡ. Nó yêu cầu chụp với các lệnh và phiên bản ghi lại, một bảng biểu tượng đọc từ tệp, và một tuyên bố về các công cụ được mô tả chỉ từ tài liệu.

## Hãy kiểm tra

Chạy demo và bộ xác định:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Việc kiểm tra phải chứng minh:

- người đọc ELF tìm thấy bốn biểu tượng hàm trong `ledger-x86_64-O1.o`Với kích thước 16, 46, 31 và 63, và hai lỗ đệm
- Các lệnh chụp của các bộ phận 86, 56, 84 và 11 cho bốn vật thể
- radar2 và rizin báo cáo các hướng dẫn, khối và cạnh tương tự trên `ledger-x86_64-O1.o`, và chỉ có radar2 có`pdc`văn bản
- Nhận số`sub_40003e`và `sub_40005f`như các hàm không có biểu tượng
- Các khối của Ghidra cho `total`là 5 khối của bài học 33 và dòng gọi của nó không phải là cạnh biểu đồ
- mọi công cụ đặt `grade`trong sự bù đắp`0x10`sau khi cơ sở của nó được loại bỏ
- mọi công cụ đồng ý với mọi hướng dẫn bắt đầu trong mọi chức năng của `ledger-x86_64-O1.o`
- Bốn nhà xây dựng đồ thị báo cáo 3, 3, 5, 4 khối và 2, 3, 5, 4 cạnh ở đó, với các bộ cạnh giống nhau
- `total``-O2`có 10 khối và 13 cạnh trong mỗi nhà xây dựng đồ thị
- `grade``-O0`có 3, 8, 8 và 9 khối và 2, 11, 7 và 12 cạnh trong radar2, rizin, angr, và Ghidra, với lý do trong ghi chú của mỗi công cụ
- `grade_label``-O0`là một khối ở khắp mọi nơi ngoại trừ Angr, kết thúc một khối tại cuộc gọi
- Angr phát minh ra một hàm trên mỗi khoảng trống lấp cộng với một trên bàn bẫy, và không có công cụ nào khác phát minh ra hoặc bỏ lỡ một hàm
- Lợi nhuận của việc lau bắt đầu`0x10`- `0x12`- `0x13`và thua`0x14`trên cái bẫy, và không có người xây dựng đồ họa decodes `0x10`đến`0x14`
- các phát hiện đặt tên phạm vi bị bỏ lỡ trong radar2 và mọi hàm phát minh trong angr
- Bản ghi lại một phiên bản và lệnh cho tất cả 21 tập tin chụp
- 3 công cụ phân tích`grade`, và chỉ có Ghidra là người điền vào ngôn ngữ phân chia
- Người dịch viết CF, OF, SF, ZF, PF với nhiệt tình trong một phong cách và một `cc_op`Thunk trong cái khác, không viết sổ đăng ký cho `cmp`, và không có cờ cho `movslq`
- Người dịch từ chối các biểu mẫu bộ nhớ, các mã opcode khác, các bit REX bổ sung và độ dài sai
- của người dịch `cc_op`số 8 và 7 bằng với số trong VEX bắt
- Các thang máy được chụp cho phép 9, 1, 10 hoạt động mã P và 7, 4, 7 tuyên bố VEX cho ba hướng dẫn
- dòng thời gian chạy từ năm 1973 đến năm 2026 theo thứ tự, đường ống có tám giai đoạn và sáu công cụ với một thuật ngữ trong mỗi tế bào, và hai công cụ đóng cửa được đánh dấu là không chạy
- hình ảnh tương tác nhúng cùng dữ liệu mà dây đeo tạo ra

## Các chế độ sản xuất thất bại

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Raw addresses from different tools | "the tools disagree about where grade is" | one offset after each base is removed, checked on one function |
| Block count as a measure of code found | "Ghidra found the most code" | the same instruction starts, with the extra block explained by a label |
| One tool as the oracle | "objdump shows the table bytes are instructions" | the sweep is a linear sweep; three graph builders leave the bytes unclaimed |
| Padding functions counted as discoveries | "angr found seven more functions" | every one sits in a padding gap or on data, and none has a symbol |
| A stopped walk reported as dead code | "the four case blocks are unreachable" | 36 bytes missed by one tool and reached by three |
| Edge counts compared without the notes | "rizin and Ghidra disagree on grade" | the same four computed targets, one extra split at a label |
| A decompiler's arithmetic read as the program | "the function multiplies by 1717986919" | the idiom from lesson 34, folded by one tool and left by another |
| A closed tool described as if run | "Binary Ninja reports five blocks" | the figure and the table mark it as documentation only |
| Captures without commands | "we ran radare2" | the manifest with version, command, and date for every file |
| An IR with no flags read as a lossy lift | "VEX dropped the flags" | the thunk in `cc_op`, `cc_dep1`, `cc_dep2`, evaluated at the branch |

## Quy tắc hoạt động

Tận ra từng công cụ một lần với lệnh và phiên bản của nó, giảm mỗi địa chỉ xuống một cơ sở, và so sánh hướng dẫn bắt đầu trước các khối và khối trước các cạnh. tính toán cho mỗi byte như được tuyên bố, đệm, dữ liệu hoặc bỏ lỡ. Đọc ghi chú của một công cụ trước khi bạn đánh giá số lượng của nó, và nói các công cụ bạn chỉ đọc về.

## Đọc thêm

- [Cifuentes, "Reverse Compilation Techniques", PhD thesis, QUT (1994)](https://eprints.qut.edu.au/36820/)
- [Cifuentes and Gough, "Decompilation of Binary Programs", Software: Practice and Experience (1995)](https://doi.org/10.1002/spe.4380250706)
- [Van Emmerik, "Static Single Assignment for Decompilation", PhD thesis, University of Queensland (2007)](https://espace.library.uq.edu.au/view/UQ:158682)
- [Schwartz, Lee, Woo, Brumley, "Native x86 Decompilation Using Semantics-Preserving Structural Analysis and Iterative Control-Flow Structuring" (USENIX Security 2013)](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Yakdan et al., "No More Gotos" (NDSS 2015)](https://www.ndss-symposium.org/ndss2015/ndss-2015-programme/no-more-gotos-decompilation-using-pattern-independent-control-flow-structuring-and-semantics/)
- [Basque et al., "Ahoy SAILR! There is No Need to DREAM of C" (USENIX Security 2024)](https://www.usenix.org/conference/usenixsecurity24/presentation/basque)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Flake, "Structural Comparison of Executable Objects" (DIMVA 2004)](https://dl.gi.de/items/7f573931-cb51-49ef-a12c-0452a9fb0ea4)
- [Maranzano and Bourne, "A Tutorial Introduction to ADB", Bell Labs (1977)](http://squoze.net/UNIX/v7/files/doc/18_adb.pdf)
- [Stallman, KTH lecture on GDB entering distribution (30 October 1986)](https://www.gnu.org/philosophy/stallman-kth.html)
- [Hex-Rays, "IDA: celebrating 30 years of binary analysis innovation"](https://hex-rays.com/blog/ida-celebrating-30-years-of-binary-analysis-innovation)
- [Guilfanov, "Decompiler internals: microcode", Recon Brussels 2018 (slides)](https://www.recon.cx/2018/brussels/resources/slides/RECON-BRX-2018-Decompiler-internals-microcode.pdf)
- [Hex-Rays, microcode view and maturity levels](https://docs.hex-rays.com/core/decompiler/how-tos/microcode-view)
- [Hex-Rays, IDA 9.4 release notes](https://docs.hex-rays.com/release-notes/9_4)
- [Hex-Rays, IDA Free](https://hex-rays.com/ida-free)
- [Ghidra releases (12.1.4)](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Ghidra P-code reference](https://github.com/NationalSecurityAgency/ghidra/blob/master/GhidraDocs/languages/html/pcoderef.html)
- [Ghidra decompiler source, main work flow and Action classes](https://github.com/NationalSecurityAgency/ghidra/tree/master/Ghidra/Features/Decompiler/src/decompile/cpp)
- [Ghidra analyzeHeadless README](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md)
- [Binary Ninja, BNIL overview](https://docs.binary.ninja/dev/bnil-overview.html)
- [Binary Ninja, "Architecture Agnostic Function Detection in Binaries" (2017)](https://binary.ninja/2017/11/06/architecture-agnostic-function-detection-in-binaries.html)
- [Binary Ninja, batch processing and headless licences](https://docs.binary.ninja/dev/batch.html)
- [Binary Ninja 6.0 "Krypton" release post](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [Binary Ninja Free](https://binary.ninja/free/)
- [radare2 book, ESIL](https://book.rada.re/emulation/esil.html)
- [radare2 book, decompilers](https://book.rada.re/arch/decompile.html)
- [radare2 releases (6.2.4)](https://github.com/radareorg/radare2/releases)
- [rizin, RzIL design notes](https://github.com/rizinorg/rizin/blob/dev/doc/rzil.md)
- [rizin releases (0.9.1)](https://github.com/rizinorg/rizin/releases)
- [Announcing Rizin (8 December 2020)](https://rizin.re/posts/announcing-rizin/)
- [Cutter releases (2.5.0)](https://github.com/rizinorg/cutter/releases)
- [angr documentation, CFG recovery](https://docs.angr.io/en/latest/analyses/cfg.html)
- [angr documentation, the decompiler and its analysis passes](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [angr documentation, intermediate representation (VEX)](https://docs.angr.io/en/latest/advanced-topics/ir.html)
- [angr on PyPI (10.0.3)](https://pypi.org/project/angr/)
- [pypcode on PyPI](https://pypi.org/project/pypcode/)
- [llvm-objdump command guide](https://llvm.org/docs/CommandGuide/llvm-objdump.html)
- [GNU objdump manual](https://sourceware.org/binutils/docs/binutils/objdump.html)
- [LIEF documentation](https://lief.re/doc/stable/index.html)
- [Capstone releases](https://github.com/capstone-engine/capstone/releases)
- [BinDiff releases (v8, open source)](https://github.com/google/bindiff/releases/tag/v8)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [Hopper Disassembler downloads](https://www.hopperapp.com/download.html)
- [Compiler Explorer](https://github.com/compiler-explorer/compiler-explorer)
- [LLDB announced as an LLVM subproject (2010)](https://blog.llvm.org/2010/06/new-lldb-debugger.html)
- [Boomerang decompiler](https://boomerang.sourceforge.net/)
- [Tan et al., "LLM4Decompile" (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.203/)
- [Gao et al., "DecompileBench" (Findings of ACL 2025)](https://aclanthology.org/2025.findings-acl.1194/)
- [Liu, Raff, Micinski, "When LLM Decompilers Recompile More and Preserve Less" (2026)](https://arxiv.org/abs/2609.05370)
