# Capstone 04  Tài liệu đa phương thức QA (Vision-First PDF, bảng, biểu đồ)

> Biên giới tài liệu-QA năm 2026 đã di chuyển từ OCR-then-text và hướng tới tương tác muộn đầu tiên của thị giác. ColPali, ColQwen2.5 và ColQwen3-omni xử lý mỗi trang PDF như một hình ảnh, nhúng nó với tương tác muộn đa vector, và để truy vấn tham gia vào các bản vá trực tiếp. Trên tài chính 10K, các bài báo khoa học, và ghi chú bằng tay mô hình này đánh bại OCR-lần đầu tiên bằng một biên giới lớn. Xây dựng đường ống từ đầu đến cuối trên 10k trang và xuất bản bên cạnh với OCR-then-text.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Vấn đề

Các doanh nghiệp ngồi trên các file PDF mà các đường ống OCR phá vỡ: 10-Ks quét với bảng quay, các bài báo khoa học dày đặc với phương trình, biểu đồ chỉ có ý nghĩa như hình ảnh, ghi chú bằng tay. Chống lại những tin nhắn này như là tin nhắn đầu tiên có nghĩa là mất một nửa tín hiệu. Câu trả lời năm 2026 là truy xuất nhiều vector tương tác muộn trên hình ảnh trang nguyên liệu. ColPali (Illuin Tech) đã giới thiệu nó; ColQwen2.5-v0.2 và ColQwen3-omni đẩy độ chính xác. Trong ViDoRe v3, điểm thu thập đầu tiên của thị giác vượt lên hơn OCR-sau văn bản bằng biên giới có ý nghĩa và khoảng cách mở rộng trên biểu đồ, bảng và chữ tay.

Sự đổi mới là lưu trữ và độ trễ. Một bản nhúng ColQwen là ~2048 vector vá trên mỗi trang, không phải là một vector 1024 chiều. Vàn bóng lưu trữ nguyên liệu. DocPruner (2026) mang lại 50% cắt không mất độ chính xác có thể đo lường. Bạn sẽ lập chỉ mục 10k trang, đo ViDoRe v3 nDCG@5, phục vụ câu trả lời dưới 2s, và so sánh trực tiếp với một OCR-then-text cơ sở.

## Khái niệm

Sự tương tác muộn có nghĩa là mỗi mã thông báo truy vấn ghi điểm so với mỗi mã thông báo vá, và điểm số tối đa cho mỗi mã thông báo truy vấn được tổng hợp. Bạn có được sự phù hợp hạt mỏng mà không cần một vector hợp nhất. Một chỉ số đa vector (Vespa, Qdrant multi-vector, hoặc AstraDB) lưu trữ các nhúng per patch và chạy MaxSim tại thời điểm lấy lại.

Người trả lời là một mô hình ngôn ngữ thị giác lấy truy vấn cộng với các trang được lấy từ trên cùng như hình ảnh và viết câu trả lời với các vùng bằng chứng (bộ kết hoặc tham chiếu trang). Qwen3-VL-30B, Gemini 2.5 Pro và InternVL3 là các lựa chọn biên giới năm 2026. Đối với các phương trình và ghi chú khoa học, một OCR fallback (Nougat, dots.ocr) được nối vào như một kênh văn bản tùy chọn.

Đánh giá là một matrix hai chiều. Một trục: loại nội dung (phần văn bản đơn giản, bảng dày đặc, biểu đồ thanh / đường, ghi chép bằng tay, phương trình). trục khác: phương pháp tìm kiếm (phát tương tác muộn trước OCR-sau văn bản vs hybrid). Mỗi tế bào nhận được nDCG@5 và trả lời chính xác.

## Kiến trúc

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## Thống

- Định nghĩa trang: PyMuPDF (fitz) ở 180 DPI, bình thường hóa chân dung
- Mô hình tương tác muộn: ColQwen2.5-v0.2 hoặc ColQwen3-omni (nhóm vi-dore trên Hugging Face)
- Chỉ số: Vespa với trường đa vector, hoặc Qdrant đa vector, hoặc AstraDB với MaxSim
- Phong cắt: Chính sách DocPruner 2026 (giữ các váyên cao, nén 50% với mất độ chính xác < 0,5%)
- OCR fallback (chẳng hạn / bảng dày): dots.ocr hoặc Nougat
- VLM trả lời: Qwen3-VL-30B tự lưu trữ hoặc Gemini 2.5 Pro lưu trữ; InternVL3 như sự lùi
- Đánh giá: ViDoRe v3 chuẩn, M3DocVQA cho lý luận nhiều trang
- UI Viewer: Next.js 15 với lớp phủ vải cho các vùng bằng chứng

```figure
ce-late-interaction
```

## Hãy xây dựng nó

1. **Ingest.**Đi bộ một tập hợp 10k trang PDF trên 10k, các bài báo khoa học và các tài liệu quét. Đưa mỗi trang vào một 1536x2048 PNG.`{doc_id, page_num, image_path}`- Tôi không biết.

2. **Embed.**Chạy ColQwen2.5-v0.2 trên mỗi hình ảnh trang. Hình dạng đầu ra ~ 2048 nhúng vá của dim 128. Sử dụng DocPruner để giữ nửa tín hiệu cao nhất.

3. **Query.**Đối với mỗi truy vấn nhập, nhúng vào tháp truy vấn (đồng độ mã thông báo).

4. **Synthesize.**Gọi Qwen3-VL-30B với truy vấn và hình ảnh trang 5 trên. Thấp chuột: "Đưa câu trả lời chỉ bằng các trang được cung cấp. Quảng cáo mỗi yêu cầu bằng (doc_id, trang) và đặt tên khu vực (hình, bảng, đoạn)".

5. **Evidence regions.**Sau quá trình xử lý câu trả lời để trích xuất các vùng được trích dẫn. Nếu VLM phát ra các hộp biên giới (Qwen3-VL làm), hãy làm cho chúng như là chồng chéo trong người xem.

6. **OCR fallback.**Đối với các trang được xác định là khối lượng phương trình (heuristic on image variance), chạy Nougat hoặc dots.ocr và chuyển văn bản OCR như một kênh bổ sung bên cạnh hình ảnh.

7. **Eval.**Cứ chạy ViDoRe v3 (từ nDCG@5) và M3DocVQA (sự chính xác QA nhiều trang).

8. **UI.**Mô hình đầu tiên được chiếu sáng bằng dòng; Next.js 15 trình xem sản xuất với lớp phủ bằng chứng-vùng trang theo trang.

## Sử dụng nó

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## Chuyển nó

`outputs/skill-doc-qa.md`mô tả sản phẩm được giao: một hệ thống QA tài liệu đa phương thức nhìn trước tiên được điều chỉnh với một cơ thể cụ thể và được đánh giá so với một cơ sở OCR-then-text trên ViDoRe v3.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## Các bài tập

1. Đo ColQwen2.5-v0.2 so với ColQwen3-omni trên cùng một corpus. Một trang nào được đúng và một trang khác bị bỏ lỡ? Thêm thẻ "luật hạng nội dung" vào chỉ mục để định tuyến theo loại.

2. Cải bỏ các nhúng tích cực (75%, 90%). Tìm vách nứt nén: điểm mà ViDoRe nDCG@5 giảm xuống dưới đường cơ sở OCR.

3. Xây dựng một hybrid: chạy OCR-then-text và ColQwen song song, hợp với RRF, xếp hạng lại với một cross-encoder.

4. Thay đổi Qwen3-VL-30B với một VLM nhỏ hơn (Qwen2.5-VL-7B). đo đường cong chính xác trên đô la.

5. Thêm hỗ trợ ghi chép tay. Đưa ra cơ thể chữ tay, nhúng vào ColQwen, đo lấy lại. So sánh với một đường ống OCR chữ tay.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## Đọc thêm

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) thu thập tài liệu tham chiếu tương tác muộn
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) Bức thư phương pháp cơ bản
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) Các trạm kiểm soát sẵn sàng sản xuất
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) Tỷ lệ cơ sở RAG đa phương thức nhiều trang
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) hàng phục vụ tham chiếu
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) chỉ số thay thế
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) Chỉ số quản lý thay thế
- [Nougat OCR](https://github.com/facebookresearch/nougat) Khác lại OCR có khả năng phương trình
