# Capstone 17  Personal AI Tutor (Tích ứng, đa mô hình, với bộ nhớ)

> Khanmigo (Khan Academy), Duolingo Max, Google LearnLM / Gemini cho Giáo dục, Quizlet Q-Chat và Synthesis Tutor đều đã cung cấp các hướng dẫn đa phương thức thích nghi trên quy mô vào năm 2026. Hình thức phổ biến là chính sách Socrates (không bao giờ chỉ ném câu trả lời), mô hình học tập cập nhật sau mỗi tương tác (tương tự theo dõi kiến thức Bayesian), đầu vào giọng nói + văn bản + hình ảnh toán học, lấy đồ họa chương trình giảng dạy, lập lịch lặp lại khoảng cách và bộ lọc an toàn cứng cho nội dung phù hợp với độ tuổi. Điểm cuối là gửi một người hướng dẫn cụ thể về chủ đề (k-12 đại số hoặc intro Python), chạy một nghiên cứu hiệu quả hai tuần với 10 học viên, và vượt qua kiểm toán bảo mật nội dung.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## Vấn đề

Việc dạy học thích ứng từng là một lĩnh vực nghiên cứu công nghệ. Đến năm 2026, nó sẽ là một sản phẩm tiêu dùng. Khanmigo được triển khai trên hầu hết các quận trường của Mỹ. Duolingo Max đã tấn công hàng chục triệu người. LearnLM / Gemini của Google cho Giáo dục có khả năng dạy học trong Google Classroom. Quizlet Q-Chat ngồi cạnh thẻ flash. Tutor Synthesis đã phát triển mạnh mẽ với các trẻ em tò mò. Các yếu tố chung: đầu vào đa phương thức (tiếng nói, hình ảnh phương trình), giáo dục Socrates (hỏi trước, giải thích sau), mô hình học tập được cập nhật sau mỗi tương tác và an toàn phù hợp với độ tuổi nghiêm ngặt.

Bạn sẽ xây dựng một trong những điều này cho một nhóm cụ thể. thanh đo là một nghiên cứu hiệu quả thực tế: điểm trước thử nghiệm và sau thử nghiệm trong hai tuần với 10 học viên. vòng lặp giọng nói phải cảm thấy tự nhiên (các bộ phận của capstone 03). Khoảnh khắc phải tôn trọng quyền riêng tư. Trình lọc an toàn phải vượt qua đội đỏ nhận thức COPPA cho K-12.

## Khái niệm

Bốn thành phần.**Tutor policy**là một vòng lặp của Socrates: khi người học hỏi hỏi câu trả lời, chính sách đặt ra một câu hỏi dẫn đầu; khi họ làm đúng, nó chuyển sang khái niệm tiếp theo; khi họ bị mắc kẹt, nó cung cấp một gợi ý được đặt trên sàn. **Learner model**là việc theo dõi kiến thức Bayesian (hoặc một biến thể đơn giản) cập nhật xác suất làm chủ mỗi nút chương trình học sau mỗi tương tác. **Curriculum graph**là một Neo4j của các khái niệm với cạnh tiên quyết; chính sách đi qua biểu đồ để chọn khái niệm tiếp theo. **Memory**là một cửa hàng tập trung + ngữ nghĩa (tương tự trí nhớ đại lý) chứa các tương tác, sai lầm và sở thích trong quá khứ.

UX là đa phương thức. Tiền nhập văn bản cho các câu trả lời được gõ. Tiền nhập giọng nói thông qua LiveKit + Whisper (tại sử dụng đáy cuối 03). Tiền nhập ảnh cho các vấn đề toán học thông qua dots.ocr hoặc PaliGemma 2. Tiền xuất giọng nói thông qua Cartesia Sonic-2.

Nghiên cứu hiệu quả là kết quả. 10 học viên, trước thử nghiệm và sau thử nghiệm, hai tuần. báo cáo tăng trưởng học tập delta và khoảng thời gian tin tưởng. So sánh với một đường cơ sở không thích nghi (những nội dung tương tự được cung cấp theo đường thẳng mà không cần chính sách hướng dẫn viên).

## Kiến trúc

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## Thống

- Chọn môn học: K-12 đại số hoặc phần giới thiệu Python (chọn một cho độ sâu)
- Chính sách hướng dẫn: LangGraph trên Claude Sonnet 4.7 (với lưu trữ trước)
- Mô hình học viên: Theo dõi kiến thức Bayesian (classic) hoặc FSRS cho khoảng cách
- Hình đồ chương trình học: Neo4j của các khái niệm + cạnh tiên quyết + nội dung OER
- Memory: agentMemory-style persistent vector + episodic + semantic store
- Voice: LiveKit Agents 1.0 + Cartesia Sonic-2 (đầu đá cuối 03 phụ-thống)
- Phân tích hình ảnh: dots.ocr hoặc PaliGemma 2 để nhận ra phương trình
- An toàn: Llama Guard 4 + bộ lọc phù hợp với độ tuổi tùy chỉnh
- Eval: Tạo câu hỏi cấp độ Bloom, sử dụng trước/ sau thử nghiệm, công cụ nghiên cứu hiệu quả

```figure
cf-tutor-loop
```

## Hãy xây dựng nó

1. **Curriculum graph.**Xây dựng Neo4j gồm 50-150 nút khái niệm (ví dụ: đại số K-12 từ "đường số" đến "hình thức hình vuông") với cạnh tiên quyết.

2. **Learner model.**Bắt đầu theo dõi kiến thức Bayesian với tiền lệ: đoán, trượt, tốc độ học tập. Cập nhật sự thôn hiểu theo khái niệm sau mỗi tương tác.

3. **Tutor policy.**LangGraph với các nút: `read_signal`(có câu trả lời của người học đúng / một phần / bị mắc kẹt không?),`select_concept`(chước đồ lịch chương trình học tập chọn khái niệm ưu tiên cao nhất), `scaffold`(Tạm dịch:`update_mastery`- Tôi không biết.

4. **Memory.**Mỗi tương tác viết cho một cửa hàng tập thể. sai lầm và sở thích thúc đẩy cho bộ nhớ ngữ nghĩa. Chính sách lưu trữ COPPA: tự động xóa sau 1 năm, phụ huynh có thể truy cập.

5. **Voice path.**Nhân viên LiveKit Agents gắn với chính sách hướng dẫn viên. ASR thông qua Whisper-v3-turbo. TTS thông qua Cartesia Sonic-2. Barge-in hỗ trợ (động cơ sử dụng lại capstone 03).

6. **Photo-math path.**Lên hoặc chụp hình ảnh; chạy dots.ocr hoặc PaliGemma 2 để nhận ra phương trình; cung cấp cho tutor như đầu vào cấu trúc.

7. **Safety.**Mỗi sản phẩm mô hình vượt qua Llama Guard 4 + một bộ lọc phù hợp với độ tuổi (để chặn tự gây tổn thương, nội dung người lớn, bạo lực).

8. **Efficacy study.**10 học viên, trước thử nghiệm (tầm chuẩn 30 câu hỏi cơ bản), hai tuần tương tác với giáo viên (3 buổi/tuần), sau thử nghiệm. So sánh với một nhóm cơ bản không thích nghi gồm 10 học viên trên cùng nội dung.

9. **Weekly progress reports.**Mỗi học viên, tự tạo bản tóm tắt PDF về các chủ đề được khám phá, các quỹ đạo làm chủ và đề nghị các bước tiếp theo.

## Sử dụng nó

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## Chuyển nó

`outputs/skill-ai-tutor.md`Một hướng dẫn viên thích ứng cụ thể đối với môn học với đầu vào đa phương thức, mô hình học tập, bộ nhớ, an toàn và hiệu quả được đo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## Các bài tập

1. Thực hiện nghiên cứu hiệu quả với và không có mô hình học tập thích ứng (trình tự khái niệm ngẫu nhiên).

2. Thêm một thăm dò đa phương thức: cùng một câu hỏi khái niệm được đưa ra như văn bản, giọng nói và ảnh.

3. Xây dựng bảng điều khiển phụ trách: các chủ đề được thực hành, các quỹ đạo làm chủ, các khái niệm sắp tới, các sự kiện an toàn (bất cứ sự cố nào xảy ra trên đường dây bảo vệ).

4. Thêm chế độ chuyển đổi ngôn ngữ: người dạy chấp nhận thông tin tiếng Tây Ban Nha và dạy bằng tiếng Tây Ban Nha.

5. Nhấn mạnh sự riêng tư của bộ nhớ: xác minh rằng người học A không thể nhìn thấy dữ liệu của người học B ngay cả khi tấn công lại bằng đoạn băng thoại.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## Đọc thêm

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) người tiêu dùng tham khảo K-12 tutor
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) Giáo viên học ngôn ngữ tham khảo
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) mô hình tham chiếu được lưu trữ
- [Quizlet Q-Chat](https://quizlet.com) tham chiếu thay thế
- [Synthesis Tutor](https://www.synthesis.com) Khán giả khởi nghiệp
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) lập trình lặp lại khoảng cách
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) mô hình học tập cổ điển
- [LiveKit Agents](https://github.com/livekit/agents) tiếng nói
