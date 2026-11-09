# An ninh  Bí mật, API Key Rotation, sổ kiểm toán, Guardrails

> Phục tiêu sự mở rộng bí mật thông qua kho trung tâm (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault). Đừng bao giờ lưu trữ thông tin vào các tập tin cấu hình, tập tin env trong VCS, bảng tính. Sử dụng vai trò IAM thay vì khóa tĩnh; OIDC cho CI / CD. Mô hình AI-gateway là giải pháp 2026: ứng dụng → cửa hàng → nhà cung cấp mô hình, với cửa hàng kéo các thông tin tín dụng từ kho trong thời gian chạy. Chuyển vào kho và tất cả các ứng dụng sẽ nhận được trong vài phút không có redeploys, không Slack "người có chìa khóa mới" tin nhắn. Chính sách quay ≤ 90 ngày; quét với TruffleHog / GitGuardian / Gitleaks trên mỗi commit. Zero-trust: MFA, SSO, RBAC/ABAC, token ngắn hạn, tư thế thiết bị. Việc xóa PII sử dụng nhận dạng thực thể để che giấu PHI/PII trước khi chuyển tiếp; token hóa nhất quán (chương trình Mesh) lập bản đồ các giá trị nhạy cảm cho người nắm giữ vị trí ổn định để LLM duy trì ngữ nghĩa mã / mối quan hệ. Tác dụng của mạng: Dịch vụ LLM chỉ trong danh sách trắng của các mạng phụ VPC/VNet`api.openai.com`- `api.anthropic.com`Các vụ tấn công chuỗi cung ứng Vercel thông qua các thông tin tín dụng CI / CD bị xâm phạm đã xâm nhập vào môi trường trên hàng ngàn triển khai khách hàng.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Mục tiêu học tập

- Đặt danh sách bốn mẫu chống quản lý bí mật (tệp cấu hình trong VCS, env mã hóa cứng, bảng tính, khóa tĩnh) và đặt tên các thay thế của chúng.
- Giải thích mô hình AI-gateway-pulls-from-vault như tiêu chuẩn sản xuất năm 2026.
- Thực hiện một máy lọc PII với token hóa nhất quán ( cùng giá trị → cùng vị trí) để ngữ nghĩa tồn tại.
- Hãy nêu tên sự cố chuỗi cung ứng Vercel năm 2026 và những gì nó dạy về vệ sinh chứng chỉ CI/CD.

## Vấn đề

Một người thực tập bắt đầu`.env`với các khóa API. Họ xóa nó nhanh chóng. Các khóa đã trong lịch sử git  GitGuardian scan bắt nó, quá trình quay của bạn là "Tạm dịch đội ngũ, cập nhật 40 tập tin cấu hình, triển khai lại tất cả các dịch vụ". 8 giờ sau, một nửa dịch vụ của bạn đang hoạt động và một nửa đang chờ đợi để triển khai cửa sổ.

Các thông tin liên quan đến người dùng bao gồm "SSN của tôi là 123-45-6789." Thông tin liên quan đến OpenAI. Bạn có một BAA nhưng chính sách nội bộ của bạn là che giấu PII trước khi chuyển tiếp.

Một cách riêng biệt, các chương trình của nhóm EKS của bạn có thể tiếp cận bất kỳ máy chủ internet nào. ai đó lưu trữ dữ liệu qua DNS tìm kiếm đến một miền được kiểm soát bởi kẻ tấn công. Không gì chặn nó.

Bảo mật cho các dịch vụ LLM phải giải quyết tất cả ba phương tiện và chứng minh sau đó.

## Khái niệm

### Hộp treo tập trung + kéo vai trò IAM

**Vault**HashiCorp Vault, AWS Secret Manager, Azure Key Vault, GCP Secret Manager. Một nguồn tin.

**IAM role**: app/gateway xác thực thông qua danh tính IAM của nó, không phải là một khóa tĩnh. Vault trả lại bí mật cho thời gian tồn tại của token.

**The AI-gateway pattern**: Gateway kéo `OPENAI_API_KEY`từ kho kho vào thời điểm yêu cầu. quay trong kho, yêu cầu tiếp theo nhận được chìa khóa mới. Không triển khai lại.

### Chính sách quay ≤ 90 ngày

Tất cả các khóa API, mã nguồn kho, tín chỉ CI/CD, quay tự động khi có thể, quay bằng tay được ghi lại và theo dõi.

### Hình ảnh bí mật

- **TruffleHog** regex + entropy trên commit.
- **GitGuardian** thương mại, độ chính xác cao.
- **Gitleaks** OSS, chạy trong CI.

Đi vào mọi cuộc giao tiếp, chặn PR nếu được phát hiện bí mật mới.

### Tương vị không tin cậy

- MFA cần thiết trên tất cả các tài khoản.
- SSO thông qua SAML/OIDC.
- RBAC (tương tự vai trò) hoặc ABAC (tương tự thuộc tính) cho truy cập hạt mỏng.
- Các token ngắn hạn (giờ, không ngày).
- Tương vị thiết bị  chỉ thiết bị corp có mã hóa đĩa.

### Trải sạch PII / PHI

Trước khi báo động rời khỏi bộ phận của bạn:

1. Công nhận thực thể (spaCy NER, Presidio, thương mại).
2. Các thực thể phù hợp với mặt nạ: `"My SSN is 123-45-6789"`→ `"My SSN is [SSN_TOKEN_A3F]"`- Tôi không biết.
3. Đánh dấu nhất quán (chương pháp Mesh): bản đồ giá trị tương tự cho cùng một người giữ vị trí để LLM duy trì mối quan hệ.
4. Phân tích ngược tùy chọn cho phản ứng LLM.

Bộ lọc regex tĩnh bắt được các mẫu cơ bản, NER bắt được nhiều hơn.

### Các cửa ngắm đầu vào + đầu ra

Nhập: chặn các jailbreak được biết đến, các chủ đề bị cấm; giới hạn tỷ lệ cho mỗi người dùng.

Kết quả: Regex scrub cho bí mật bị rò rỉ (mô hình khóa API, mô hình email trong bối cảnh từ chối), phân loại cho vi phạm chính sách.

### Danh sách trắng xuất mạng

Dịch vụ LLM trong một mạng phụ chuyên dụng:
- Danh sách trắng: `api.openai.com`- `api.anthropic.com`, điểm cuối DB vector, điểm cuối kho.
- Mọi thứ khác: thả.
- DNS thông qua giải quyết chỉ cho phép (đánh tránh DNS-tunneling exfil).

### Lập nhật kiểm toán

Lập nhật ký không thể thay đổi của mỗi cuộc gọi LLM với:
- Tiêu khắc thời gian.
- Người dùng / thuê nhà.
- Hash nhanh (không là yêu cầu nguyên liệu cho quyền riêng tư).
- Mô hình + phiên bản.
- Đồ tín hiệu đếm.
- Chi phí.
- Hắc-si đáp ứng.
- Bất cứ chuyến đi nào.

Giữ theo yêu cầu quy định (SOC 2 1 năm, HIPAA 6 năm).

### Vụ tai nạn Vercel năm 2026

Cuộc tấn công chuỗi cung ứng: các thông tin tín dụng CI/CD bị xâm phạm được phân tích trong môi trường qua hàng ngàn triển khai khách hàng. Bài học: các thông tin tín dụng CI/CD tương đương với prod. Cung cấp trong kho. phạm vi hẹp. Chuyển xung tích.

### Những con số mà bạn nên nhớ

- Chính sách quay: ≤ 90 ngày.
- Hình ảnh trên mỗi commit: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: tín dụng CI/CD bị xâm phạm → hàng ngàn môi trường khách hàng bị rò rỉ.
- Việc lưu giữ nhật ký kiểm toán: SOC 2 = 1 năm, HIPAA = 6 năm.

```figure
i4-vault-rotation
```

## Sử dụng nó

`code/main.py`thực hiện một máy lọc thông tin PII đồ chơi với các mã thông báo nhất quán và một nhật ký kiểm toán chỉ phụ lục.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-llm-security-plan.md`Với phạm vi quy định và tình trạng hiện tại, kế hoạch di chuyển kho, scrubber, thoát, sổ kiểm toán.

## Các bài tập

1. Đi chạy`code/main.py`- Đưa hai lời nhắc về cùng một SSN.
2. Thiết kế chính sách thoát mạng cho việc triển khai vLLM-on-EKS gọi OpenAI + Anthropic + Weaviate.
3. Bạn phát hiện ra một khóa trong lịch sử git (2 năm tuổi). Câu trả lời chính xác là gì  xoay khóa, xóa lịch sử, hoặc cả hai?
4. Quý liệu kiểm toán của bạn tăng lên 10 GB/ngày.
5. Vấn đề xem việc đảo ngược token hóa (đổi lại các giá trị thực trở lại vào phản ứng LLM) có đáng sự phức tạp so với việc giữ các người nắm giữ vị trí hiển thị không.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Vault | "secrets store" | Centralized credential management service |
| IAM role | "identity-based auth" | Role assumed by app; returns short-lived creds |
| OIDC for CI/CD | "cloud-issued tokens" | No static keys in CI — identity via OIDC |
| TruffleHog / GitGuardian / Gitleaks | "secret scanners" | Commit-time secret detection |
| RBAC / ABAC | "access control" | Role-based vs attribute-based |
| PII scrubbing | "data masking" | Remove or tokenize sensitive entities |
| Consistent tokenization | "stable placeholders" | Same value → same token each time |
| Mesh approach | "Mesh tokenization" | Semantic-preserving tokenization pattern |
| Egress whitelist | "outbound allowlist" | Only permitted domains reachable |
| Audit log | "immutable history" | Append-only record for compliance |

## Đọc thêm

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) Khám phá và ẩn danh thông tin thông tin cá nhân.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
