# Chatbots  Rule-Based đến Neural đến LLM Agents

> ELIZA trả lời bằng các mô hình phù hợp. DialogFlow lập bản đồ ý định. GPT trả lời từ trọng lượng. Claude chạy công cụ và xác minh. Mỗi thời đại giải quyết sự thất bại tồi tệ nhất của thời đại trước.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## Vấn đề

Một người dùng nói "Tôi muốn thay đổi chuyến bay của mình". Hệ thống phải tìm ra những gì họ muốn, thông tin nào bị thiếu, làm thế nào để có được nó, và làm thế nào để hoàn thành hành động. Sau đó người dùng nói "ngợi đã, nếu tôi hủy thay thế thì sao?" và hệ thống phải nhớ bối cảnh, thay đổi các nhiệm vụ, và bảo tồn trạng thái.

Cuộc trò chuyện là khó khăn cho một hệ thống ML. Các đầu vào là mở. Các đầu ra phải có liên kết qua nhiều lượt. Hệ thống có thể cần phải hành động trên thế giới (hãy thay đổi chuyến bay, sạc thẻ). Mỗi bước sai đều hiển thị cho người dùng.

Các kiến trúc chatbot đã đi qua bốn mô hình, mỗi mô hình được giới thiệu bởi vì mô hình trước đã thất bại quá rõ ràng. Bài học này đưa chúng vào thứ tự.

## Khái niệm

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### Lần viết kịch bản nửa thế kỷ, 1950-2001

Các mô hình đầu tiên không kéo dài năm năm. Nó kéo dài năm mươi. Biết cung của nó quan trọng bởi vì mọi hệ thống trong nó là cùng một máy  nhập phù hợp, phát ra một phản ứng đóng hộp, cập nhật một trạng thái  và năm mươi năm thêm các quy tắc vào máy đó không bao giờ tạo ra trường hợp chung.

**1950.**Turing tránh "cỗ máy có thể nghĩ được không?" bằng cách đề xuất một thay thế hoạt động: nếu một người thẩm vấn không thể phân biệt máy với một người qua máy tính, câu hỏi triết học là tranh cãi.

**1956.**Tên gọi đến từ một hội thảo mùa hè tại Dartmouth đồng xu "kỹ thuật nhân tạo" dựa trên giả định rằng mọi tính năng của trí tuệ "có thể được mô tả chính xác đến mức có thể tạo ra một máy móc để mô phỏng nó".

**1966.**ELIZA đưa ra thủ thuật phản xạ bạn xây dựng trong bước 1: các quy tắc phân hủy kéo các mảnh vỡ từ đầu vào, các quy tắc tái lắp ráp phản hồi chúng như câu hỏi. Khoảng 200 mẫu tổng cộng, trạng thái không, không hiểu biết  và người dùng tin tưởng nó bất cứ cách nào. Weizenbaum đã dành phần còn lại của sự nghiệp của mình lo lắng bởi số máy móc ít nó mất.

**1972.**PARRY, được xây dựng tại Stanford để mô hình sự hoang tưởng, thêm vào phần ELIZA thiếu: trạng thái nội tâm. Các biến số cho nỗi sợ hãi, giận dữ và mất tin cập nhật ở mỗi lượt và cổng mà kịch bản phát ra tiếp theo, do đó các đầu vào giống nhau tạo ra các phản ứng khác nhau tùy thuộc vào cuộc trò chuyện cho đến nay. Trong một xét nghiệm ghi chép mù, các bác sĩ tâm thần đã phân biệt PARRY với bệnh nhân con người. Nó là tổ tiên trực tiếp của điều kiện persona  một hệ thống nhanh chóng được triển khai như ba float. Cùng năm, hai robot được chỉ vào nhau qua ARPANET: một kịch bản của một nhà trị liệu phỏng vấn một máy trạng thái hoang tưởng, cuộc trò chuyện đầu tiên giữa bot và bot trên mạng.

**1995.**ALICE mở rộng quy mô công thức ELIZA với AIML, một phương ngữ XML cho các cặp mẫu mẫu. Khoảng 40.000 danh mục được viết tay, ba giải thưởng Loebner. Nó chứng minh luật mở rộng của các hệ thống dựa trên quy tắc: nhiều quy tắc hơn mua bảo hiểm, không bao giờ nói chung. Mỗi quy tắc là một trách nhiệm mà ai đó phải duy trì.

**2001.**SmarterChild đặt công thức trước mặt 30 triệu người dùng nhắn tin tức thời và thêm tìm kiếm hậu cảnh  thời tiết, cổ phiếu, thời gian phim  được chia thành mẫu.

Năm mươi năm, một cơ chế, một quy tắc tăng lên đếm. mô hình đã kết thúc không phải vì ai đã bác bỏ nó mà bởi vì chi phí bảo trì của máy viết tay tăng theo tuyến tính với bảo hiểm trong khi kỳ vọng của người dùng tăng với bất cứ điều gì họ đã thấy tuần trước.

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**Các mô hình được viết tay phù hợp với thông tin nhập của người dùng và tạo ra phản ứng. Các bộ phân loại ý định định hướng đến dòng chảy được xác định trước. Máy lấp đầy trạng thái thu thập thông tin cần thiết. Làm việc tuyệt vời bên trong phạm vi hẹp nó được thiết kế. Thất bại ngay bên ngoài nó.

**Retrieval-based.**Một hệ thống kiểu FAQ. Mã hóa từng cặp (những phát biểu, phản ứng). Vào thời gian chạy, mã hóa thông điệp của người dùng và lấy lại phản ứng được lưu trữ gần nhất. Hãy nghĩ về tính năng "những bài viết tương tự" cổ điển của Zendesk.

**Neural (seq2seq).**Các mã hóa-các mã hóa được đào tạo trên nhật ký trò chuyện. Tạo ra phản ứng từ đầu. Thông thường nhưng dễ bị kết quả chung ("Tôi không biết") và biến động thực tế. Không bao giờ đáng tin cậy về chủ đề. Lý do Google, Facebook và Microsoft đều có chatbot thất vọng trong năm 2016-2019.

**LLM agents.**Một mô hình ngôn ngữ được gói trong một vòng tròn có kế hoạch, gọi công cụ và xác minh kết quả. Không phải chatbot với một lời nhắc dài. Một vòng tròn đại lý: kế hoạch → gọi công cụ → quan sát kết quả → quyết định bước tiếp theo. lấy lại-làm đất đầu tiên (RAG) giữ cho nó khỏi ảo giác. gọi công cụ thực sự cho nó làm những thứ. Đây là kiến trúc 2026 .

Bốn mô hình này không phải là thay thế theo trình tự. Một chatbot sản xuất năm 2026 sẽ đi qua tất cả bốn: dựa trên quy tắc cho xác thực và hành động phá hủy, lấy lại cho các câu hỏi thường gặp, tạo ra thần kinh cho các cụm từ tự nhiên, đại lý LLM cho các truy vấn mở mơ hồ.

## Hãy xây dựng nó

### Bước 1: Đáp hợp mô hình dựa trên quy tắc

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

ELIZA trong 20 dòng. Tránh suy nghĩ ("Tôi cảm thấy buồn" → "Tại sao bạn cảm thấy buồn") là bản demo của nhà tâm lý trị liệu giáo học từ Weizenbaum 1966.

### Bước 2: dựa trên truy xuất (FAQ)

Đoạn minh họa này đòi hỏi:`pip install sentence-transformers`(được kéo trong ngọn đuốc).`code/main.py`cho bài học này sử dụng một sự tương đồng Stdlib Jaccard thay vào đó, vì vậy bài học chạy mà không có phụ thuộc bên ngoài.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

Việc từ chối dựa trên ngưỡng là lựa chọn thiết kế quan trọng. Nếu sự phù hợp tốt nhất không đủ gần, hãy trả lại `None`và để hệ thống leo thang.

### Bước 3: Tạo ra thần kinh (tầm cơ bản)

Sử dụng một bộ mã hóa-tử toán nhỏ có điều chỉnh hướng dẫn (FLAN-T5) hoặc mô hình trò chuyện được điều chỉnh tốt. Sản xuất không thể sử dụng riêng vào năm 2026 (sự mâu thuẫn, trôi dạt ngoài chủ đề, vô nghĩa thực tế), nhưng tàu trong hệ thống lai để định nghĩa tự nhiên. Các mô hình chỉ có trình giải mã kiểu DialoGPT cần các bộ tách vòng rõ ràng và xử lý EOS để tạo ra các câu trả lời nhất quán; một đường ống văn bản FLAN-T5 làm việc ngoài hộp cho một ví dụ giảng dạy.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### Bước 4: vòng đại lý LLM

Hình thức sản xuất năm 2026:

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

Các công cụ là các chức năng có thể gọi mà LLM có thể gọi. vòng lặp kết thúc khi LLM trả lời cuối cùng thay vì một cuộc gọi công cụ. Ngân sách bước ngăn chặn vòng lặp vô hạn trên các nhiệm vụ mơ hồ.

Sản xuất thực sự thêm: lấy lại-đầu tiên đặt đất (đưa các tài liệu liên quan trước mỗi cuộc gọi LLM), guardrails (đưa hành động phá hủy mà không có xác nhận), khả năng quan sát (đăng từng bước), và đánh giá (điểm tra tự động rằng hành vi của đại lý vẫn theo đặc điểm).

### Bước 5: Đường dẫn lai

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

Mô hình: quy tắc xác định cho bất cứ điều gì phá hủy, tìm kiếm cho các câu hỏi thường gặp được đóng hộp, đại lý LLM cho mọi thứ khác. Đây là những gì các hệ thống hỗ trợ khách hàng năm 2026 sẽ đưa ra.

## Sử dụng nó

Số 2026:

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

Luôn sử dụng định tuyến lai trong sản xuất. Không một kiến trúc duy nhất xử lý mọi yêu cầu tốt.

## Các chế độ thất bại vẫn được vận chuyển

- **Confident fabrication.**Trưởng LLM tuyên bố đã hoàn thành một hành động mà họ không làm.
- **Prompt injection.**Người dùng chèn văn bản vượt qua lệnh hệ thống. LLM01 xếp hạng trong Top 10 của OWASP cho các ứng dụng LLM 2025. Hai hương vị: tiêm trực tiếp (được dán vào cuộc trò chuyện) và tiêm gián tiếp (được ẩn trong tài liệu, email hoặc các sản phẩm công cụ mà đại lý đọc).

  Tỷ lệ tấn công khác nhau theo kịch bản. Tỷ lệ thành công được đo lường dao động từ ~ 0,5-8,5% trên các mô hình biên giới trong các tiêu chuẩn sử dụng công cụ và mã hóa chung. Các thiết lập rủi ro cao cụ thể (những cuộc tấn công thích nghi chống lại các tác nhân mã hóa AI, dàn xếp dễ bị tổn thương) đã đạt đến ~ 84%. Các CVE sản xuất bao gồm EchoLeak (CVE-2025-32711, CVSS 9.3)  một lỗi xóa dữ liệu bằng nhấp chuột không trong Microsoft 365 Copilot được kích hoạt bởi một email bị kẻ tấn công kiểm soát.

  Giảm thiểu: xử lý đầu vào của người dùng như không đáng tin cậy trong suốt vòng lặp; làm sạch trước khi gọi công cụ; tách các sản phẩm công cụ khỏi lời nhắc chính; sử dụng mô hình Plan-Verify-Execute (PVE) nơi người đại lý lập kế hoạch trước, sau đó xác minh từng hành động chống lại kế hoạch trước khi thực hiện (điều này ngăn chặn kết quả công cụ từ tiêm các hành động không được lập kế hoạch mới); yêu cầu xác nhận người dùng cho các hành động phá hủy; áp dụng quyền tối thiểu cho phạm vi công cụ.

  Không có một số lượng kỹ thuật nhanh chóng loại bỏ hoàn toàn rủi ro này.
- **Scope creep.**Trưởng lý sẽ không làm việc vì một cuộc gọi công cụ trả về thông tin liên quan liên quan. Giảm thiểu: hợp đồng công cụ hẹp; giữ cho hệ thống nhanh chóng tập trung; thêm đánh giá cho tỷ lệ ngoài nhiệm vụ.
- **Infinite loops.**Trưởng phòng liên tục gọi cùng một công cụ, giảm thiểu ngân sách, giảm gấp đôi công cụ, thẩm phán về "chúng ta đang tiến bộ".
- **Context window exhaustion.**Các cuộc trò chuyện dài đẩy các lượt đầu tiên ra khỏi ngữ cảnh. Giảm nhẹ: tóm tắt các lượt cũ hơn, lấy lượt trước tương quan bằng sự tương đồng hoặc sử dụng mô hình ngữ cảnh dài.

## Chuyển nó

Cứ như `outputs/skill-chatbot-architect.md`- Có thể là:

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## Các bài tập

1. **Easy.**Thực hiện các câu trả lời dựa trên quy tắc ở trên với 10 mẫu cho một bot đặt hàng quán cà phê. Các trường hợp kiểm tra: đặt hàng hai lần, sửa đổi, hủy bỏ, ý định không rõ ràng.
2. **Medium.**Xây dựng một FAQ lai + LLM fallback. 50 mục FAQ đóng hộp cho một sản phẩm SaaS, LLM fallback với truy xuất trên trang web tài liệu. Đo tỷ lệ từ chối và độ chính xác trên 100 câu hỏi hỗ trợ thực.
3. **Hard.**Thực hiện vòng tròn đại lý ở trên với ba công cụ (bảo sát, dữ liệu người dùng đọc, gửi email). Thực hiện đánh giá với 50 kịch bản thử nghiệm bao gồm các nỗ lực tiêm nhanh. Báo cáo tỷ lệ bỏ nhiệm vụ, tỷ lệ thất bại nhiệm vụ và bất kỳ sự thành công tiêm.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## Đọc thêm

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) bài báo làm cho cuộc trò chuyện là tiêu chuẩn của lĩnh vực.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) giấy chatbot gốc dựa trên các quy tắc.
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  Thiết kế biến ảnh hưởng của PARRY, chatbot trạng thái đầu tiên.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) Bài báo về chatbot thần kinh của Google, ngay trước khi các đại lý LLM tiếp quản.
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) tờ báo đặt tên cho mô hình vòng tròn của đại lý.
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) Dự báo sản xuất 2024 vẫn còn tồn tại vào năm 2026.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) giấy tiêm nhanh.
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) xếp hạng khiến việc tiêm nhanh trở thành mối quan tâm an ninh hàng đầu.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) Các hệ thống phòng thủ lớp dàn xếp thực tế bao gồm Plan-Verify-Execute và user-confirmation flows.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) CVE phântrình dữ liệu bằng nhấp chuột không theo quy định của CVE từ tiêm trực tiếp.
