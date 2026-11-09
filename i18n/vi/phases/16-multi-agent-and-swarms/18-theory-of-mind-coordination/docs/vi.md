# Lý thuyết về tâm trí và sự phối hợp mới nổi

> Li et al. (arXiv:2310.10701) cho thấy rằng các đại lý LLM trong một triển lãm trò chơi văn bản hợp tác **emergent high-order Theory of Mind**(ToM)  lý luận về những gì một đại lý khác tin về niềm tin của một đại lý thứ ba  nhưng thất bại trong lập kế hoạch chân trời dài do quản lý bối cảnh và ảo giác. Riedl (arXiv:2510.05174) đo lường sự hợp tác thứ tự cao hơn trên một quần thể và phát hiện ra rằng **only**Điều kiện ToM-prompt tạo ra sự phân biệt liên quan đến danh tính và sự bổ sung hướng đến mục tiêu; LLM có khả năng thấp chỉ cho thấy sự xuất hiện giả mạo. Đó là sự xuất hiện của sự phối hợp là điều kiện ngay lập tức và phụ thuộc vào mô hình, không phải miễn phí. Bài học này thực hiện một nhân viên biết đến ToM tối thiểu, thực hiện một nhiệm vụ hợp tác với và mà không có sự thúc đẩy ToM, và đo lường delta phối hợp so với giao thức Riedl 2025.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## Vấn đề

Sự phối hợp đa đại lý thường trông rất kỳ diệu: các đại lý chia lao động, dự đoán lẫn nhau, tránh việc tháo dỡ. Thông thường "sự xuất hiện" này là một tác phẩm của kỹ thuật nhanh chóng  ai đó nói với các đại lý "coordinate".

Kết quả 2025 của Riedl là nghiêm ngặt hơn: trong các điều kiện được kiểm soát, sự phối hợp chỉ xuất hiện khi các đại lý được nhắc nhở để suy luận về **other agents' minds**(ToM). Không có sự phối hợp ToM, ngay cả các mô hình mạnh cũng cho thấy các mô hình phối hợp không tồn tại trong kiểm soát thống kê.

Bài học này xử lý ToM như một khả năng cụ thể (sự lý luận về niềm tin về niềm tin), xây dựng một đại lý ít ToM-thấu hiểu, và đo lường sự phối hợp thực sự trông như thế nào so với cách trang phục nhanh như thế nào.

## Khái niệm

### ToM có nghĩa là gì

Tâm lý phát triển: một đứa trẻ 3 tuổi nghĩ rằng thế giới bên trong của bất kỳ ai cũng phù hợp với thế giới của họ. Một đứa trẻ 5 tuổi hiểu rằng người khác có niềm tin khác nhau. Một đứa trẻ 7 tuổi lý do về niềm tin về niềm tin ("anh ấy nghĩ rằng tôi nghĩ rằng quả bóng đang nằm dưới cốc").

Đối với các đại lý LLM, ToM yêu cầu bản đồ đến:

- **Zeroth-order:**Không có mô hình của người khác.
- **First-order:**"Alice tin X".
- **Second-order:**"Alice tin rằng Bob tin X".

Li et al. 2023 phát hiện ra rằng ToM thứ nhất và thứ hai xuất hiện trong các đại lý LLM trong các trò chơi hợp tác nhưng suy giảm với chân trời dài và giao tiếp không đáng tin cậy.

### Thử nghiệm Sally-Anne, ngắn gọn

Một bài kiểm tra tin tưởng sai năm 1985: Sally đặt một viên đá cẩm thạch trong giỏ A, rời khỏi. Anne di chuyển nó đến giỏ B. Sally sẽ nhìn ra đâu khi cô trở lại?

Các LLM thời GPT-4 vượt qua các bài kiểm tra kiểu Sally-Anne khi được đặt ra một cách rõ ràng. Họ thất bại khi câu chuyện dài, cảnh quay thay đổi nhiều lần, hoặc câu hỏi được phrased gián tiếp. Đó là tình trạng thực tế của ToM năm 2026 trong LLM sản xuất.

### Phân tích phối hợp của Riedl

Riedl (arXiv:2510.05174) đã xây dựng một thử nghiệm quy mô dân số: N đại lý, một mục tiêu hợp tác, điều kiện nhanh chóng biến đổi.

1. **Identity-linked differentiation.**Các đại lý có phát triển sự phân biệt vai trò ổn định theo thời gian không?
2. **Goal-directed complementarity.**Các hành động của các đại lý có bổ sung lẫn nhau (các nhiệm vụ phụ khác nhau) chứ không phải trùng lặp?
3. **Higher-order synergy.**Một thước đo thống kê về việc nhóm có đạt được những gì không có bộ phụ nào có thể đạt được.

Kết quả: chỉ trong điều kiện ToM prompt thì cả ba métrics đều tạo ra tín hiệu trên đường gốc. Không có ToM prompt, métrics hơ gần khả năng cho các mô hình công suất vừa phải. Các mô hình lớn cho thấy một số sự phối hợp mà không có ToM prompt rõ ràng nhưng hiệu ứng nhỏ hơn so với với các prompt rõ ràng.

### Giảm giác phối hợp

Không có kiểm soát thống kê, "sự phối hợp cấp bách" trong các bản demo thường phản ánh:

- Kỹ thuật nhanh chóng làm việc phối hợp (các lời nhắc hệ thống nói "hiện hợp tác").
- Bias quan sát viên (chúng ta thấy các mô hình chúng ta mong đợi).
- Việc lựa chọn sau khi chơi hoc của các chạy thành công.

Các hệ thống sản xuất mà tiếp thị "sự phối hợp mới" mà không có tín hiệu có thể đo lường nên được coi như tiếp thị.

### Một đặc vụ ít biết đến ToM

Cấu trúc:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

- `other_models`ToM thứ nhất giữ chỉ một cấp độ. thứ hai thêm`other_models[i][other_models_of_j]` Tôi nghĩ là đại lý tôi nghĩ là đại lý J tin.

### Tại sao đường chân trời dài lại đau

Li et al. tài liệu: giới hạn ngữ cảnh khiến các nhân viên quên đi niềm tin thuộc về ai. ảo giác thêm niềm tin sai vào các mô hình nhân viên khác. Cả hai đều tạo ra sai lầm "Tôi nghĩ anh ta nghĩ X" mà gia tăng theo thời gian.

Các biện pháp giảm thiểu được ghi lại trong báo cáo và theo dõi trong năm 2024-2026:

- **Explicit ToM state in the prompt.**Phương thức cấu trúc: `{agent_id: belief_list}`- Cần thu hồi để giữ lại sự ràng buộc về bản sắc và niềm tin.
- **Shorter reasoning chains.**Ít hơn các bản cập nhật ToM mỗi lượt làm giảm ảo giác hợp chất.
- **External ToM store.**Giữ mô hình bên ngoài bối cảnh LLM; chỉ tiêm các bộ phận liên quan mỗi lượt.

### Khi ToM thất bại trong sản xuất

- **Adversarial settings.**Các đại lý có ToM tốt dễ dàng hơn để thao túng (bạn có thể mô hình hóa những gì họ mô hình hóa bạn, sau đó khai thác).
- **Heterogeneous teams.**Khi các mô hình khác nhau, mô hình ToM hoạt động cho một đối thủ không phổ biến.
- **Ground-truth-dependent tasks.**ToM là về niềm tin; nếu sự chính xác phụ thuộc vào sự thật, ToM có thể là một sự phân tâm.

### Sự phối hợp mà bạn có thể đo lường

Ba tín hiệu thực tế sự sự phối hợp của một nhóm là thực hơn là ăn mặc nhanh chóng:

1. **Complementarity over time.**Trong một nhiệm vụ đa lượt, hành động của các đặc vụ bao gồm các nhiệm vụ phụ không liên quan?
2. **Anticipation.**Hành động của đại lý A ở lượt T+1 phụ thuộc vào một dự đoán về hành động của B ở T+2 đã kết quả chính xác?
3. **Correction.**Khi A đọc sai tin của B ở lượt T, A có sửa bằng lượt T + 2?

Chúng có thể đo lường trong một hệ thống đa đại lý được ghi lại. Chúng là phiên bản bản bản của câu chuyện "sự phối hợp".

```figure
sw-theory-of-mind
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `ToMAgent` theo dõi niềm tin của riêng mình và các mô hình niềm tin của các đại lý khác.
- Một nhiệm vụ hợp tác: ba đại lý phải thu thập ba token từ ba hộp; mỗi hộp có thể chứa một token.
- Hai cấu hình: `zeroth_order`(không có ToM) và `first_order`(ToM với mô hình niềm tin một cấp).
- Đánh giá trên 200 thử nghiệm ngẫu nhiên: tỷ lệ hoàn thành, tỷ lệ trùng lặp (hai đại lý nhắm vào cùng một hộp), trung bình quay đến hoàn thành.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Tạo ra dự kiến: các đại lý thứ tự không lặp lại nỗ lực với tỷ lệ ~ 35% và hoàn thành ~ 60% các thử nghiệm trong 10 lượt.

## Sử dụng nó

`outputs/skill-tom-auditor.md`là một kỹ năng kiểm tra tuyên bố của một hệ thống đa tác nhân về "sự phối hợp mới". kiểm tra việc trang bị nhanh chóng, ý nghĩa thống kê so với kiểm soát và đo sự bổ sung.

## Chuyển nó

Danh sách kiểm tra yêu cầu phối hợp:

- **Control condition.**Một phiên bản của hệ thống của bạn mà không có thông báo phối hợp.
- **Statistical test.**Sự khác biệt giữa hệ thống và điều khiển có đáng kể không?`p < 0.05`trên số liệu của bạn?
- **Complementarity measure.**Sự bất đồng hành động theo thời gian, không chỉ là thành công cuối cùng.
- **Failure-case log.**Khi các nhân viên không phối hợp đúng, thì tiểu bang ToM trông như thế nào?
- **Model-capacity disclosure.**Nếu tác dụng biến mất trên các mô hình nhỏ hơn, hãy nói như vậy.

## Các bài tập

1. Đi chạy`code/main.py`. xác nhận thứ tự đầu tiên ToM giảm tỷ lệ trùng lặp khoảng 7x. Sự chênh lệch vẫn tồn tại khi bạn mở rộng lên 5 đại lý và 5 hộp?
2. Thực hiện ToM thứ hai (các nhân A mô hình những gì B nghĩ về C).
3. Tiêm **hallucination**trong trạng thái ToM: ngẫu nhiên đảo ngược một niềm tin mỗi lượt.
4. Đọc Li et al. (arXiv:2310.10701). Tái tạo lại phát hiện "sự suy giảm đường chân trời dài": khi lượt tăng từ 10 đến 30, hiệu suất ToM thứ nhất của bạn thay đổi như thế nào?
5. Đọc Riedl 2025 (arXiv:2510.05174). Thực hiện các thống kê tương tác thứ tự cao hơn trên nhật ký mô phỏng của bạn.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## Đọc thêm

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) ToM mới nổi trong các trò chơi hợp tác; các chế độ thất bại theo đường chân trời dài
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) đo lường quy mô dân số; ToM prompt là điều kiện chịu tải
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://doi.org/10.1017/S0140525X00076512) nguồn gốc năm 1978 của khái niệm ToM
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8)  bài báo Sally-Anne (1985)
