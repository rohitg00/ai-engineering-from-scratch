# Capstone 10  Nhóm Kỹ thuật phần mềm đa đại lý

> Hình dạng năm 2026 của một nhóm kỹ thuật đa đại lý đã hội tụ: một kiến trúc sư kế hoạch, N codeers làm việc trong cây làm việc song song, một cửa kiểm tra, một tester xác minh. Kiến trúc nhà máy của SWE-AF, sự thúc đẩy dựa trên vai trò của MetaGPT, biểu đồ diễn viên được đánh máy của AutoGen 0.4, Devin của Cognition và Droids của Factory đều hạ cánh trên nó độc lập. Các cây làm việc song song chuyển đổi đồng hồ tường thành dung lượng. Các giao thức chia sẻ trạng thái và giao tiếp trở thành bề mặt thất bại. Điểm cuối là xây dựng đội ngũ, đánh giá trên SWE-bench Pro, và báo cáo những giao hàng nào bị phá vỡ và bao nhiêu lần.

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## Vấn đề

Các dây mã hóa đơn tác nhân đã đạt đến một mức tối thượng trong các nhiệm vụ lớn. Không phải vì bất kỳ đại lý cá nhân nào yếu, nhưng bởi vì một bối cảnh 200k-token không thể chứa một kế hoạch kiến trúc cộng với bốn đoạn mã cục song song cộng với bình luận của nhà phê bình cộng với kết quả thử nghiệm. Các nhà máy đa đại lý chia rẽ vấn đề: một kiến trúc sư sở hữu kế hoạch, các lập trình viên sở hữu việc thực hiện trong các cây làm việc song song, một cửa kiểm tra, một người kiểm tra xác minh. Kiến trúc "công nghiệp" của SWE-AF, vai trò của MetaGPT, biểu đồ diễn viên được đánh dấu của AutoGen  tất cả ba khung mô tả cùng một hình dạng.

Vùng bề mặt thất bại là giao dịch. Kiến trúc sư lập kế hoạch một cái gì đó mà các lập trình viên không thể thực hiện. Các lập trình viên tạo ra sự khác biệt mâu thuẫn. Người xem phê duyệt một sửa chữa ảo giác. Người kiểm tra chạy một lập trình viên viết tắt. Bạn sẽ xây dựng một trong những nhóm này, chạy nó trên 50 phiên bản SWE-bench Pro, theo dõi mỗi giao dịch, và xuất bản hậu thuần.

## Khái niệm

Vai trò là các đại lý được đánh dấu.**Architect**(Claude Opus 4.7) đọc vấn đề, viết một kế hoạch, và chia thành các nhiệm vụ phụ với giao diện rõ ràng. **Coders**(Claude Sonnet 4.7, N các trường hợp song song, mỗi trong một `git worktree`+ Daytona sandbox) thực hiện các nhiệm vụ phụ độc lập. **Reviewer**(GPT-5.4) đọc sự khác biệt kết hợp và hoặc chấp thuận hoặc yêu cầu thay đổi cụ thể. **Tester**(Gemini 2.5 Pro) chạy bộ thử nghiệm một cách riêng biệt và báo cáo vượt qua / thất bại với các hiện vật.

Truyền thông thông qua một bảng tác vụ chia sẻ (được hỗ trợ tệp hoặc Redis). Mỗi vai trò tiêu thụ các nhiệm vụ mà nó được phép xử lý. Các thông điệp giao tiếp là thông điệp theo giao thức A2A. Các mối quan tâm về phối hợp: giải quyết xung đột kết hợp (phát tích phối hợp hoặc kết hợp ba chiều tự động), đồng bộ hóa trạng thái chia sẻ (kế hoạch được đóng băng khi các lập trình lập trình bắt đầu; kế hoạch lại là các sự kiện riêng biệt), và giám sát cửa của nhà phê duyệt (nhà phê duyệt không thể chấp thuận những thay đổi hoặc thay đổi của riêng mình mà nó đề xuất).

Sự tăng cường token là chi phí ẩn. Mỗi ranh giới vai trò thêm các lời nhắc tổng kết và ngữ cảnh giao hàng. Một lần chạy đơn vị 40 lượt trở thành 160 lượt tổng cộng trên bốn vai trò. Rubric đặc biệt cân nhắc hiệu quả token so với cơ sở đơn vị đơn vị bởi vì câu hỏi không phải là "có nhiều đại lý làm việc" mà "có thắng mỗi đô la".

## Kiến trúc

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## Thống

- Phân phối: LangGraph với trạng thái chung + các tiểu biểu đồ mỗi đại lý
- Thông điệp: A2A giao thức (Google 2025) cho các tin nhắn giữa các đại lý được gõ
- Mô hình: Opus 4.7 (kiến trúc sư), Sonnet 4.7 (coder), GPT-5.4 (đánh giá), Gemini 2.5 Pro (tử nghiệm)
- Tránh cách ly cây làm việc: `git worktree add`mỗi coder + Daytona sandbox
- Điều phối viên hợp nhất: hợp nhất ba chiều tùy chỉnh + giải quyết xung đột do LLM trung gian
- Eval: SWE-bench Pro (50 số), kịch bản SWE-AF, HumanEval++ cho các thử nghiệm đơn vị
- Sự quan sát: Langfuse với phạm vi đóng vai trò, kế toán token cho mỗi đại lý
- Việc triển khai: K8 với mỗi vai trò như một việc triển khai riêng biệt + HPA trên backlog

```figure
ce-team-handoff
```

## Hãy xây dựng nó

1. **Task board.**JSONL được hỗ trợ bằng tệp với tin nhắn nhập: `plan_request`- `subtask`- `diff_ready`- `review_needed`- `test_needed`- `approved`- `rejected`- `replan_needed`Các nhân viên đăng ký thẻ.

2. **Architect.**Đọc vấn đề GitHub, chạy Opus 4.7 với một mẫu kế hoạch yêu cầu giao diện phụ trách rõ ràng (tệp được chạm vào, chức năng công cộng, tác động thử nghiệm).`plan_request`với một DAG của các nhiệm vụ phụ.

3. **Coders.**N công nhân song song, mỗi người đòi một nhiệm vụ phụ từ hội đồng quản trị.`git worktree add`Lớp nối cộng với một hộp cát Daytona.`diff_ready`với các đệm + test delta.

4. **Merge coordinator.**Trong các bộ mã hóa hoàn thành, ba chiều hợp nhất các chi nhánh N thành một chi nhánh giai đoạn. Giải quyết xung đột do LLM trung gian chỉ khi có sự chồng chéo cấp tệp.

5. **Reviewer.**GPT-5.4 đọc sự khác biệt kết hợp. Không thể chấp thuận sự khác biệt mà nó đã viết.`approved`(không mở) hoặc `review_feedback`với các yêu cầu thay đổi cụ thể được chuyển về cho trình mã hóa có liên quan.

6. **Tester.**Gemini 2.5 Pro chạy bộ thử nghiệm trong một hộp cát sạch sẽ.`test_passed`hoặc `test_failed`Các thử nghiệm thất bại lặp lại cho coder sở hữu nhiệm vụ phụ thất bại.

7. **Handoff accounting.**Mỗi tin nhắn vượt qua ranh giới vai trò nhận được một khoảng thời gian trong Langfuse với kích thước tải trọng hữu ích và mô hình được sử dụng.

8. **Eval.**Tiếp tục chạy trên 50 phiên bản SWE-bench Pro. So sánh pass@1 và $-per-solved-issue với một cơ sở đơn-agent (một Sonnet 4.7 trong một cây làm việc duy nhất).

9. **Post-mortem.**Đối với mỗi vấn đề thất bại, xác định giao dịch đã bị phá vỡ (kế hoạch quá mơ hồ, xung đột kết hợp, phê duyệt sai lệch, flake kiểm tra).

## Sử dụng nó

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## Chuyển nó

`outputs/skill-multi-agent-team.md`Với URL vấn đề và mức độ song song, nhóm tạo ra PR sẵn sàng kết hợp với kế toán token mỗi vai trò.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## Các bài tập

1. Nhổ một lỗi rõ ràng vào một diff mid- run (extra `return None`Chỉ số số số lượng thông qua sai của nhà phê duyệt.

2. Giảm xuống hai bộ lập trình (đầu thủ + hai bộ lập trình + kiểm tra + kiểm tra, mỗi bộ lập trình chạy hai nhiệm vụ phụ theo trình tự). So sánh đồng hồ tường và tốc độ vượt qua.

3. Thay thế điều phối viên kết hợp bằng một hạn chế viết đơn (các nhiệm vụ phụ chạm vào tập tin không liên kết).

4. Tác giả của GPT-5.4 đến Claude Opus 4.7. đo lường tỷ lệ chấp thuận sai và chi phí token delta.

5. Thêm một vai trò thứ năm: trình bày (Haiku 4.5). Sau khi xem xét, nó tạo ra một mục thay đổi.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## Đọc thêm

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) Nhà máy đa đại lý 2026
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) Quản lý đa tác nhân dựa trên vai trò
- [AutoGen v0.4](https://github.com/microsoft/autogen) Quản lý diễn viên kiểu chữ của Microsoft
- [Cognition AI (Devin)](https://cognition.ai) Sản phẩm tham chiếu
- [Factory Droids](https://www.factory.ai) sản phẩm tham chiếu thay thế
- [Google A2A protocol](https://a2a-protocol.org/latest/) thông tin nhắn giữa các đại lý
- [git worktree documentation](https://git-scm.com/docs/git-worktree) chất phụ phân cách
- [SWE-bench Pro](https://www.swebench.com) mục tiêu đánh giá
