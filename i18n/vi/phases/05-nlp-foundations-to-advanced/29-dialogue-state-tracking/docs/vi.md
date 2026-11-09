# Theo dõi tình trạng đối thoại

> "Tôi muốn một nhà hàng rẻ ở phía bắc... thực sự làm nó vừa phải... và thêm tiếng Ý". 3 lượt, 3 cập nhật trạng thái. DST giữ cho giá trị khe cắm dict đồng bộ để đặt phòng hoạt động.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## Vấn đề

Trong một hệ thống đối thoại hướng đến nhiệm vụ, mục tiêu của người dùng được mã hóa như một tập hợp các cặp giá trị khe: `{cuisine: italian, area: north, price: moderate}`Mỗi lượt người dùng có thể thêm, thay đổi hoặc loại bỏ một khe. Hệ thống phải đọc toàn bộ cuộc trò chuyện và xuất trạng thái hiện tại đúng.

Nếu bạn sai một khe máy, hệ thống sẽ đặt phòng cho một nhà hàng sai, lên lịch cho một chuyến bay sai hoặc tính phí cho một thẻ sai.

Tại sao nó vẫn quan trọng vào năm 2026 mặc dù LLM:

- Các lĩnh vực nhạy cảm với tuân thủ (các lĩnh vực ngân hàng, chăm sóc sức khỏe, đặt phòng máy bay) yêu cầu các giá trị khe cắm xác định, không phải là sản xuất dạng tự do.
- Các đại lý sử dụng công cụ vẫn cần giải quyết khe trước khi gọi API.
- Việc sửa đổi nhiều vòng khó hơn vẻ ngoài: "Thật sự không, hãy làm nó vào thứ Năm".

Đường ống hiện đại: khái niệm DST cổ điển + máy khai thác LLM + dây bảo vệ sản xuất có cấu trúc.

## Khái niệm

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**Một sơ đồ xác định các miền (dòng ăn, khách sạn, taxi) và các khe khe (nấu ăn, khu vực, giá, người). Mỗi khe có thể trống, được lấp đầy bằng giá trị từ một bộ đóng (chi phí: {mô, trung bình, đắt}), hoặc một giá trị dạng tự do (tên: "The Copper Kettle").

**Two DST formulations.**

- **Classification.**Đối với mỗi cặp (slot, candidate_value), dự đoán có/không.
- **Generation.**Với đối thoại, tạo ra giá trị khe như văn bản miễn phí.

**Metric.**Độ chính xác mục tiêu chung (JGA) là phần của các lượt mà mỗi khe là đúng. Tất cả hoặc không có gì. MultiWOZ 2.4 đứng đầu bảng xếp hạng khoảng 83% vào năm 2026.

**Architectures.**

1. **Rule-based (slot regex + keyword).**Nguyên tắc cơ bản mạnh mẽ cho các miền hẹp.
2. **TripPy / BERT-DST.**Tạo bản sao dựa trên mã BERT.
3. **LDST (LLaMA + LoRA).**LLM theo hướng dẫn với yêu cầu domain-slot. đạt chất lượng ChatGPT trên MultiWOZ 2.4.
4. **Ontology-free (2024–26).**Trượt sơ đồ; tạo tên khe và giá trị trực tiếp.
5. **Prompt + structured output (2024–26).**LLM với chương trình Pydantic + mã hóa hạn chế. 5 dòng mã, sẵn sàng sản xuất.

### Các chế độ thất bại cổ điển

- **Co-reference across turns.**"Chúng ta hãy chọn lựa thứ nhất". Phải quyết định lựa chọn nào.
- **Over-write vs append.**Người dùng nói "đưa thêm tiếng Ý". Bạn thay thế nhà bếp hay thêm?
- **Implicit confirmations.**"Được rồi, ổn thôi".  Có phải nó chấp nhận đặt chỗ được đề nghị không?
- **Correction.**"Thực sự là 7 giờ tối". Phải cập nhật thời gian mà không cần phải xóa các khe khác.
- **Coreference to previous system utterance.**"Vâng, cái đó". Cái đó?

```figure
n5-slot-tracker
```

## Hãy xây dựng nó

### Bước 1: máy khai thác khe dựa trên quy tắc

Nhìn xem`code/main.py`. Quảng điển Regex + đồng nghĩa bao gồm 70% các phát biểu kinh thánh trong các lĩnh vực hẹp:

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

Thậm chí, nó cũng không có nghĩa là có thể xác nhận được các dấu chấm xác định.

### Bước 2: vòng cập nhật trạng thái

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

Ba biến số không biến:

- Không bao giờ đặt lại một khe mà người dùng không chạm vào.
- Sự phủ nhận rõ ràng ("không quan tâm đến món ăn") phải được xóa bỏ.
- Việc sửa đổi người dùng ("thực sự...") phải viết lại, không phải thêm vào.

### Bước 3: DST LLM-driven với kết quả có cấu trúc

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

Instructor + Pydantic đảm bảo một đối tượng trạng thái hợp lệ không regex, không có sự không phù hợp của schema, không có khe ảo giác.

### Bước 4: Đánh giá JGA

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

Định vị: hệ thống có thể có được tất cả các khe đúng như thế nào? Đối với MultiWOZ 2.4, hệ thống 2026 hàng đầu: 80-83%. hệ thống trong lĩnh vực của bạn nên vượt quá mức đó trên từ vựng hẹp của bạn hoặc đường cơ sở LLM của bạn đánh bại bạn.

### Bước 5: sửa chữa xử lý

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

Khi phát hiện sự sửa đổi, hãy viết lại khe cập nhật cuối cùng thay vì thêm. Khó để làm đúng mà không có sự giúp đỡ của LLM. Mô hình hiện đại: luôn để LLM tái tạo toàn bộ trạng thái từ lịch sử thay vì cập nhật từng bước.

## Những bẫy

- **Full-history regeneration cost.**Để LLM tái tạo mỗi lần chi phí $O(n^2)$tổng số token. lịch sử cap hoặc tóm tắt các lượt cũ.
- **Schema drift.**Thêm các khe mới sau khi chơi sẽ phá vỡ dữ liệu huấn luyện cũ.
- **Case sensitivity.**"Italy" vs "Italy" vs "ITALYAN"  bình thường ở khắp mọi nơi.
- **Implicit inheritance.**Nếu người dùng đã xác định trước đó "cho 4 người", yêu cầu mới cho một thời gian khác không nên xóa người.
- **Free-form vs closed-set.**Tên, thời gian và địa chỉ cần có khe tự do; nhà bếp và khu vực bị đóng.

## Sử dụng nó

Số 2026:

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## Chuyển nó

Cứ như `outputs/skill-dst-designer.md`- Có thể là:

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## Các bài tập

1. **Easy.**Xây dựng bộ theo dõi trạng thái dựa trên quy tắc trong `code/main.py`cho 3 khe (dấu ăn, diện tích, giá).
2. **Medium.**cùng bộ dữ liệu với Instructor + Pydantic + một LLM nhỏ. So sánh JGA. kiểm tra các lượt khó nhất.
3. **Hard.**Thực hiện cả hai và đường: dựa trên quy tắc chính, LLM fallback khi dựa trên quy tắc phát ra < 2 khe tự tin. đo kết hợp JGA và chi phí suy luận mỗi lượt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## Đọc thêm

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) chỉ số chuẩn của các luật pháp.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) LLaMA + LoRA điều chỉnh hướng dẫn cho DST.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) DST dựa trên bản sao ngựa làm việc.
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) Tử thần kinh không được giám sát.
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) kết quả DST theo truyền thống.
