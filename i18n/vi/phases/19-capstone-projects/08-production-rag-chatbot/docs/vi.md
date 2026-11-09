# Capstone 08  Sản xuất RAG Chatbot cho một điều chỉnh dọc

> Harvey, Glean, Mendable và LlamaCloud đều chạy cùng một hình thức sản xuất vào năm 2026. Tiêu thụ với docling hoặc Unstructured và ColPali cho hình ảnh. Tìm kiếm lai. Tái xếp hạng với Bge-Reranker-v2-gemma. Kết hợp với Claude Sonnet 4.7 sử dụng cache nhanh với tỷ lệ truy cập 60-80%. Bảo vệ với Llama Guard 4 và NeMo Guardrails. Hãy xem với Langfuse và Phoenix. Đánh giá bằng RAGAS trên một bộ vàng 200 câu hỏi. Hãy xây dựng một trong một lĩnh vực được quy định (hợp pháp, lâm sàng, bảo hiểm), và đá cuối sẽ vượt qua bộ vàng, đội đỏ, và bảng điều khiển drift.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## Vấn đề

RAG thuộc lĩnh vực được quản lý (các hợp đồng pháp lý, các giao thức thử nghiệm lâm sàng, chính sách bảo hiểm) là hình thức sản xuất được vận chuyển nhiều nhất vào năm 2026 vì ROI là rõ ràng và rủi ro là cụ thể. Harvey (Allen & Overy) đã xây dựng nó cho hợp pháp. Có thể được cho là một chiếc tàu có hương vị của các nhà phát triển. Glean là một phần của công ty tìm kiếm. Mô hình là: hấp thụ độ trung thành cao, lấy hybrid với xếp hạng lại, tổng hợp với việc thực thi trích dẫn và lưu trữ nhanh chóng, bảo vệ với nhiều lớp an toàn và giám sát drift liên tục.

Những phần khó không phải là mô hình. Chúng là tuân thủ pháp lý (HIPAA, GDPR, SOC2), kiểm toán cấp trích dẫn, kiểm soát chi phí (khám dự trữ nhanh mua theo giá 60-90% khi tỷ lệ hit cao), phát hiện ảo giác thông qua sự trung thành RAGAS, và phát hiện drift khi các tài liệu nguồn được cập nhật mà không theo dõi chỉ số. Ngọc đá này yêu cầu bạn gửi tất cả nó trên một bộ vàng 200 câu hỏi với một phòng đội đỏ bên cạnh.

## Khái niệm

Hãng đường ống có hai mặt.**Ingestion**: docling hoặc Unstructured phân tích các tài liệu có cấu trúc; ColPali xử lý các tài liệu giàu thị giác; các đoạn có tổng kết, thẻ và nhãn truy cập dựa trên vai trò. Các vector đi vào pgvector + pgvector scale (dưới 50M vector) hoặc Qdrant Cloud; BM25 hiếm chạy bên cạnh. **Conversation**LangGraph xử lý bộ nhớ và nhiều lượt; mỗi truy vấn chạy truy xuất lai, xếp hạng lại với bge-reranker-v2-gemma-2b, tổng hợp với Claude Sonnet 4.7 (bỏ khoá nhanh), vượt qua đầu ra thông qua Llama Guard 4 và NeMo Guardrails, và phát ra một câu trả lời được neo trích dẫn.

Dòng đánh giá có bốn lớp. **Golden set**(200 câu hỏi/phản hồi có ghi chú) để xác thực. **Red team**(các vụ tù, cố gắng lấy PII, các câu hỏi ngoài miền) để bảo mật. **RAGAS**cho sự trung thành / liên quan đến câu trả lời / chính xác ngữ cảnh tự động mỗi lượt. **Drift dashboard**(Arize Phoenix) xem chất lượng thu hồi và điểm ảo giác hàng tuần.

Caching nhanh là đòn bẩy chi phí. Claude 4.5+ và GPT-5+ hỗ trợ hệ thống lưu trữ trước + bối cảnh được lấy lại. Với tỷ lệ truy cập 60-80%, chi phí cho mỗi truy vấn giảm 3-5x. Đường ống phải được thiết kế cho các tiền đề ổn định ( hệ thống nhắc + bối cảnh xếp hạng lại trước) để đạt được tỷ lệ truy cập cache cao.

## Kiến trúc

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## Thống

- Tiêu thụ: Unstructured.io hoặc docling cho tài liệu có cấu trúc; ColPali cho các file PDF giàu hình ảnh
- Vêctor DB: pgvector + pgvectorscale dưới 50M vector; Qdrant Cloud nếu không
- Sparse: Tantivy BM25 với trọng lượng đồng
- Phân phối: LlamaIndex Workflows (nghĩa) + LangGraph (thảo luận)
- Tỷ lệ xếp hạng lại: bge-reranker-v2-gemma-2b tự lưu trữ hoặc Voyage renank-2 lưu trữ
- LLM: Claude Sonnet 4.7 với cache nhanh chóng; fallback Llama 3.3 70B tự lưu trữ
- Eval: RAGAS 0.2 trực tuyến, DeepEval cho ảo giác và jailbreak suite
- Khả năng quan sát: Langfuse tự lưu trữ với hàng chú thích; Arize Phoenix cho drift
- Guardrails: Llama Guard 4 phân loại đầu vào/ ra ngoài, NeMo Guardrails v0.12 chính sách, Presidio PII scrub
- Theo dõi: Đánh dấu truy cập dựa trên vai trò trên các khối; thẻ thẩm quyền cho GDPR/HIPAA

```figure
canary-rollout
```

## Hãy xây dựng nó

1. **Ingestion.**Phân tích khoá của bạn (1000-10000 tài liệu để xây dựng nghiêm túc) với Unstructured hoặc docling. Đối với các trang quét / hình ảnh nặng, hướng thông qua ColPali. Sản xuất các mảnh với tóm tắt, nhãn vai trò, thẻ thẩm quyền.

2. **Index.**Thiết lập mật độ (Voyage-3 hoặc Nomic-embed-v2) vào pgvector + pgvector scale. BM25 side-index thông qua Tantivy. Vai trò và bộ lọc thẩm quyền như tải trọng hữu ích.

3. **Hybrid retrieve.**Trình lọc theo vai trò + thẩm quyền trước; sau đó mật độ song song song + BM25; hợp nhất với sự hợp nhất cấp độ tương đối; top-20 để tái xếp hạng; top-5 để tổng hợp.

4. **Synthesize with prompt caching.**Hệ thống nhắc + chính sách tĩnh trong tiêu đề cache; xếp hạng lại ngữ cảnh như mở rộng cache; câu hỏi người dùng như hậu tố không lưu trữ cache. Mục tiêu 60-80% tỷ lệ hit cache trong trạng thái ổn định.

5. **Guardrails.**Llama Guard 4 vào đầu vào; NeMo Guardrails ngăn chặn các câu hỏi ngoài miền hoặc các chủ đề bị cấm chính sách; Presidio xóa thông tin thông tin thông tin thông tin tình cờ trong đầu ra; lọc sau khi thực thi trích dẫn.

6. **Golden set.**200 cặp câu hỏi/câu trả lời được đánh dấu bởi một chuyên gia lĩnh vực với (câu trả lời, trích dẫn).

7. **Red team.**50 lời khuyên đối lập: jailbreaks (PAIR, TAP), cố gắng đào thoát PII, ngoài lĩnh vực, rò rỉ xuyên khu vực pháp lý. Điểm với vượt qua / thất bại và mức độ nghiêm trọng.

8. **Drift dashboard.**Arize Phoenix theo dõi chất lượng thu hồi (nDCG, trung thực trích dẫn) hàng tuần.

9. **Cost report.**Langfuse: tốc độ hit prompt caching, token mỗi truy vấn, phân chia $/ truy vấn theo giai đoạn.

## Sử dụng nó

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## Chuyển nó

`outputs/skill-production-rag.md`mô tả sản phẩm được giao. Một chatbot thuộc miền được quy định được triển khai với nhãn tuân thủ, đi qua mục, được quan sát bằng việc theo dõi drift trực tiếp.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## Các bài tập

1. Xây dựng một mảnh corpus thứ hai dưới một thẩm quyền khác (ví dụ, HIPAA cùng với GDPR). Cải lọc vai trò + thẩm quyền ngăn chặn rò rỉ chéo trên một cuộc thăm dò 20 câu hỏi chéo thẩm quyền.

2. đo tốc độ truy cập cache nhanh trong một tuần lưu lượng sản xuất xác định các truy vấn phá vỡ tiền đề cache.

3. Thêm bộ nhớ nhiều lượt với bộ đệm tổng kết 10k token. đo liệu sự trung thành giảm khi cuộc trò chuyện tăng lên hay không.

4. Thay đổi Claude Sonnet 4.7 với Llama 3.3 70B tự lưu trữ.

5. Thêm chế độ "không chắc chắn": nếu điểm số được xếp hạng lại cao nhất dưới ngưỡng, đại lý nói "Tôi không có trích dẫn tự tin" thay vì trả lời.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## Đọc thêm

- [Harvey AI](https://www.harvey.ai) hàng đầu sản xuất hợp pháp tham chiếu
- [Glean enterprise search](https://www.glean.com) RAG tham chiếu ở quy mô doanh nghiệp
- [Mendable documentation](https://mendable.ai) tài liệu tham khảo RAG của nhà phát triển
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) Tiêu thụ quản lý
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) tham chiếu giá trị đòn bẩy
- [RAGAS 0.2 documentation](https://docs.ragas.io/) khung đánh giá RAG theo quy định
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) khả năng quan sát lưu động tham chiếu
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) Định dạng an toàn 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Quản lý đường sắt chính sách
