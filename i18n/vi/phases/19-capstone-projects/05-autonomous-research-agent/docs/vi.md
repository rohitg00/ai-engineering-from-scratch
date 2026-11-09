# Capstone 05  Cơ quan nghiên cứu tự trị (Bộ khoa học AI)

> Sakana's AI-Scientist-v2 đã xuất bản toàn bộ bài báo. Cảnh sát phòng thí nghiệm đã tiến hành các thí nghiệm. Allen AI chia sẻ dấu vết. Hình dạng 2026 là tìm kiếm cây kế hoạch thực hiện-thấy chứng trên các thí nghiệm, chi phí ngân sách, thực hiện mã sandboxed, một người viết LaTeX phản hồi tầm nhìn, và một bộ đánh giá tự động theo phong cách NeurIPS. Đá cuối là xây dựng một, chạy nó từ đầu đến cuối trong vòng 30 đô la mỗi giấy, và sống sót khỏi đội bóng đỏ thoát khỏi hộp cát mà Sakana ghi lại.

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## Vấn đề

Các cơ quan nghiên cứu tự trị vượt qua ngưỡng vào năm 2026. AI-Scientist-v2 của Sakana AI đã được xuất bản trên Nature với các bài báo được tạo ra để phê duyệt các bài học. ShinkaEvolve (ICLR 2026) đã mở rộng đường dây cho các giả thuyết phát triển. Phòng thí nghiệm của AMD đã gửi những dấu vết có thể tái tạo. Các đại lý không phải là ma thuật  chúng là một vòng lặp thực hiện-thực hiện-thực hiện chạy trên một cây thí nghiệm ứng cử viên, với giới hạn chi phí, hộp cát trái cây, và đánh giá tự động. Tàu đang được thông báo, ngân sách và sự an toàn.

Bạn học vòng lặp bằng cách thực hiện một đối với ý tưởng hạt giống trong một lĩnh vực hẹp (ví dụ, sự phân biệt sự chú ý trên một biến thể tham số 100M). Giá trị không phải là khám phá ra điều gì đó mới trong lần đầu tiên. Giá trị nằm trong cơ sở hạ tầng: tìm kiếm cây, hộp cát thí nghiệm, vòng lặp nhà văn-bản tra, báo cáo nhóm đỏ. Nhóm Sakana đã ghi lại những thất bại trong việc thoát khỏi hộp cát.

## Khái niệm

Cảnh sát là một cuộc tìm kiếm cây tốt nhất. Các nút là các đặc điểm thí nghiệm: (khiếu giả, cấu hình, mã, kết quả mong đợi). Một bước mở rộng đề nghị trẻ em có sửa đổi nhỏ (swap optimizer, thay đổi kích thước lô, ablate một thành phần). Mỗi đứa trẻ chạy trong một hộp cát tươi với một nắp tài nguyên cứng. Kết quả được đưa vào một chức năng ghi điểm xếp hạng các nút theo (tiếng mới × chất lượng × ngân sách còn lại). Cây mọc đến khi ngân sách hết, sau đó là nhánh tốt nhất được ghi lại.

Nhà văn là người đa phương tiện. Nó tạo ra một bản thảo LaTeX, biên soạn nó, render các số liệu, và cung cấp các PDF được render trở lại chế độ xem của Claude Opus 4.7 để chỉ trích bố cục, khả năng đọc hình ảnh và sự sắp xếp bằng chứng tuyên bố. Một nhóm các thẩm phán của năm thẩm phán LLM phát hành điểm số theo phong cách NeurIPS (sự mới, nghiêm ngặt, rõ ràng, khả năng tái tạo, tác động); nếu mức trung bình giảm xuống dưới ngưỡng, bài báo trở lại với nhà văn với lời chỉ trích.

Sự an toàn là chịu tải. Mỗi thí nghiệm chạy trong một hộp cát E2B hoặc Daytona mà không có lối thoát mạng, đồng hồ tường bị giới hạn và giới hạn tài nguyên bị gắn. Bước tạo mã của đại lý đi qua một lớp chính sách chặn các syscall thoát khỏi hộp cát. Báo cáo nhóm đỏ tái tạo bề mặt tấn công được tài liệu Sakana (bọn đố, hệ thống tệp thoát, cuộc gọi mạng LLM).

## Kiến trúc

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## Thống

- Phong nhạc: LangGraph với các cửa kiểm soát và chấp thuận con người
- Tìm kiếm cây: tùy chỉnh tốt nhất đầu tiên trên các nút thí nghiệm (Áp-MCTS-style từ Sakana v2)
- Sandbox: E2B cho mỗi thí nghiệm, Docker-in-Docker fallback; giới hạn nguồn lực thông qua các nhóm
- Văn học: API biểu đồ học giả ngữ nghĩa + OpenAlex + bộ nhớ cache của bản tóm tắt FAISS địa phương
- Tác giả: mẫu LaTeX + Claude Opus 4.7 (chế độ xem) cho việc chỉ trích hình ảnh và bố cục
- Nhóm thẩm phán: 5 thẩm phán (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) với tổng hợp cân nặng
- Khung thí nghiệm: PyTorch 2.5 cho các thí nghiệm vật lý, W&B cho việc khai thác gỗ
- Khả năng quan sát: Langfuse để tìm ra dấu vết của đại lý, ngân sách khó khăn 30 đô la mỗi giấy

```figure
ce-experiment-tree
```

## Hãy xây dựng nó

1. **Seed and domain scoping.**Hãy lấy một ý tưởng hạt giống (ví dụ: "xét nghiệm các mô hình sự ít trong bản đồ chú ý của các biến đổi sub-1B"). Định nghĩa không gian tìm kiếm: mô hình, tập hợp dữ liệu, ngân sách tính toán.

2. **Literature pass.**Query Semantic Scholar + OpenAlex cho 50 bài báo liên quan được trích dẫn nhất; ghi nhớ sơ bộ về địa phương; tạo một bản phân tích miền 1 trang.

3. **Tree scaffolding.**Tạo ra gốc với giả thuyết hạt giống.`expand(node) -> children`với các đề xuất chỉnh sửa nhỏ (một thay đổi cấu hình cho mỗi đứa trẻ).`score(node)`như một tính năng mới cân nhắc × chất lượng × hạn ngân sách.

4. **Sandbox wrapping.**Mỗi thí nghiệm đều chạy`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`(hoặc chính sách E2B tương đương) hạt được ghi vào hộp cát; các sản phẩm được lắp đặt chỉ đọc ra.

5. **Plan-execute-verify loop.** `plan`đề nghị con cái. `execute`chạy hộp cát, chụp nhật ký và số liệu. `verify`chạy kiểm tra đơn vị trên các số liệu (có mất mát giảm? Ablation cô lập hiệu ứng?).

6. **Writer.**Sau khi ngân sách, chọn chi nhánh tốt nhất. Đưa ra các số liệu bằng matplotlib. Tạo bản thảo LaTeX thông qua Claude Opus 4.7 với dấu vết chi nhánh trong ngữ cảnh. Sưu tập. Đưa PDF được sưu tập trở lại Opus 4.7 để xem xét.

7. **Reviewer ensemble.**Năm thẩm phán đánh giá bản thảo về (sự mới, nghiêm ngặt, rõ ràng, khả năng tái tạo, tác động) với các rubric kiểu NeurIPS. Nếu trung bình < 4.0/5, trở lại với nhà văn với chỉ trích.

8. **Red team.**Xây dựng hoặc tích hợp một loạt các nhiệm vụ đối đầu nhắm vào hộp cát: bom hẻo lánh, các nỗ lực đào thoát mạng, thoát hệ thống tệp, các siêu nhân vỏ được viết bằng LLM. Đảm bảo tất cả đều bị chặn. Viết ra kết quả.

9. **Reproducibility.**Mỗi giấy được gửi với các dấu vết tìm kiếm cây của nó JSON, hạt, liên kết chạy W & B, cấu hình hộp cát, và một README tái tạo nó cuối đến cuối.

## Sử dụng nó

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## Chuyển nó

`outputs/skill-ai-scientist.md`Với một ý tưởng hạt giống + một tên miền + một ngân sách 30 đô la, nó chạy toàn bộ đường ống và phát ra một giấy có thể xem xét cộng với một gói khả năng tái tạo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## Các bài tập

1. Hãy chạy đường ống chống lại ba ý tưởng hạt giống khác nhau trong cùng một lĩnh vực. So sánh các phần của việc tìm kiếm cây chồng chéo.

2. Thêm một cổng người trong vòng trước khi thực hiện thí nghiệm cho các nút ước tính trên 5 đô la.

3. Thay đổi nhóm các nhà phê bình cho một thẩm phán duy nhất, đo lường tỷ lệ chấp nhận sai trên một tập hợp các bài báo xấu.

4. Tạo một bài kiểm tra nhóm đỏ để giải phóng mạng: đại lý viết mã cố gắng `curl`Địa chỉ bên ngoài.`--network=none`Chính sách ngăn chặn nó.

5. So sánh tìm kiếm cây của bạn với một đường cơ sở ngẫu nhiên phẳng (những ngân sách tương tự, không có chiến lược mở rộng).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## Đọc thêm

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) Cơ quan nghiên cứu sản xuất tham chiếu
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) phương pháp ban đầu
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) Sự mở rộng tiến hóa
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) Quản lý phòng thí nghiệm nghiên cứu đa vai trò
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) Lớp dàn nhạc tham chiếu
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) Tìm kiếm văn học
- [E2B sandboxes](https://e2b.dev) Cách ly thử nghiệm tham chiếu
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) Rubric mà nhóm nhà phê bình mã hóa
