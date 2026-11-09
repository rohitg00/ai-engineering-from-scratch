# نماذج تسلسل إلى تسلسل

> اثنان من المترجمين الراغبين في التظاهر بأنّهم مترجمون، والعقدة التي يواجههم هي السبب في وجود الاهتمام.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## المشكلة

تصنيف يخطط تسلسل طول متغير إلى علامة واحدة. الترجمة يخطط تسلسل طول متغير إلى تسلسل آخر طول متغير. المدخل والخروج يعيشون في مفردات مختلفة، وربما لغات مختلفة، دون ضمان لموازاة الطول.

تمكن معماري seq2seq (Sutskever, Vinyals, Le, 2014) من كسر هذا الأمر مع وصفة بسيطة عمداً. اثنين من RNNs. يقرأ أحد الجملة المصدرة ويولد متجهًا سياقيًا ثابتًا. يقرأ الآخر ذلك المتجه ويولد رمز الجملة المستهدفة بواسطة رمز. نفس الرمز الذي كتبته للدرس 08, تم لصقها معاً بشكل مختلف.

يستحق هذا الدراسة لسببين. أولاً، فإن عنق الزجاجة المتعلقة بالسياق والمتجه هو الفشل الأكثر فائدة من الناحية التربوية في النمط النووي. إنه يحفز كل شيء من الاهتمام والتحولات جيدة في. ثانياً، وصفة التدريب (إجبار المعلم، أخذ العينات المجدولة، البحث عن شعاع عند الاستنتاج) لا تزال تطبق على كل نظام توليد حديث بما في ذلك LLMs.

## المفهوم

**Encoder.**الـ RNN الذي يقرأ الجملة المصدرة**context vector** ملخص في الحجم الثابت للمدخول بأكمله لا تفقد شيئاً سوى المصدر، على ما يفترض.

**Decoder.**يتم تشغيل RNN آخر من متجه السياق. في كل خطوة يأخذ رمزًا تم إنشاؤه مسبقاً كمدخول وينتج توزيعًا على المفردات المستهدفة. عينة أو argmax لتحديد رمز التالي. إعادة إدخاله. كرر حتى `<EOS>`يتم إنتاج الرمز أو يتم ضرب طول أقصى.

**Training:**فقدان الإنتروبي المتقاطع في كل خطوة من مراحل إعادة التشغيل، يتم جمعها على التسلسل.

**Teacher forcing.**أثناء التدريب، مدخلات المقرر في خطوة `t`هو رمز * الحقيقة القاعدية * في الموقف`t-1`لا يتوقع أن يكون هناك أي خطوة أخرى في التنبؤات، وليس التنبؤ السابق للكشف. هذا يثبّت التدريب، وبدون ذلك، تتسلل الأخطاء المبكرة والنموذج لا يتعلم أبداً. عند الاستنتاج، يجب عليك استخدام التنبؤات الخاصة بالنموذج، لذلك هناك دائماً فجوة توزيع القطار/الاضرار.**exposure bias**. . .

**The bottleneck.**كل ما تعلمه المبرمج عن المصدر يجب أن يتم ضغطه في متجه سياق واحد. الجمل الطويلة تفاصيل تفقد. تصبح الكلمات النادرة ضبابية. يجب حفظ إعادة ترتيب (الرداء السوداء مقابل القط الأسود) ، وليس الحساب.

الاهتمام (المدرس 10) يصلح هذا عن طريق السماح للكشف للنظر في * كل * كشف مخفي حالة، وليس فقط الأخيرة. وهذا هو الصوت بأكمله.

```figure
lstm-gates
```

## بناءها

### الخطوة الأولى: مُشفّر

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs`لديه شكل`[batch, seq_len, hidden_dim]` حالة مخفية واحدة لكل موقف مدخل. `hidden`لديه شكل`[1, batch, hidden_dim]` الخطوة الأخيرة. الدروس 08 قالت "مجموعة فوق المخرجات للتصنيف". هنا نحتفظ بالحالة الأخيرة المخفية كمتجه السياق، وتجاهل المخرجات لكل خطوة.

### الخطوة الثانية: جهاز تشكيل

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

يُطلق على المُفكّر خطوة واحدة في كل مرة. المدخل: مجموعة من الرموز الفردية والحالة الخفية الحالية. الخروج: تسجيلات المفردات للرمز التالي والحالة الخفية المحدثة.

### الخطوة الثالثة: حلقة تدريبية مع إجبار المعلم

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

-كلافتان تستحق الإسم`ignore_index=0`يفرط في الخسارة على رموز التشغيل`teacher_forcing_ratio`هو احتمال استخدام الرمز الحقيقي مقابل توقعات النموذج في كل خطوة. تبدأ عند 1.0 (إجبار المعلم الكامل) وتحلل إلى ~ 0.5 على التدريب لتغلق فجوة التحيز التعرض.

### الخطوة الرابعة: حلقة الاستنتاج (الحشوة)

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

إنّ التشفير البشع يختار رمزًا ذو أعلى احتمالية في كل خطوة، ويمكن أن يزول بعيداً، بمجرد أن تتعهد بشخصية، لا يمكنك إلغاء إرسالها. **Beam search**يحتفظ بالعلى`k`تسلسل جزئي حي و يختار أعلى نقطة كاملة في النهاية. عرض الشعاع 3-5 هو القياسية.

### الخطوة 5: عقد الزجاجة، تم إثباتها

تدريب النموذج على مهمة نسخ اللعبة: المصدر `[a, b, c, d, e]`، الهدف`[a, b, c, d, e]`. زيد طول التسلسل . لاحظ الدقة

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

ولا يمكن لأحدى الحالات الخفية لـ GRU حفظ مدخل 40 رمزًا دون خسارة. المعلومات موجودة في كل خطوة من مراحل تشفير البرمجة، ولكن المفكّر يرى الحالة الأخيرة فقط.

## استخدمها

(بيتورش) لديه`nn.Transformer`و`nn.LSTM`-بناء على نماذج "تقبيل"`transformers`السفن المكتبة كاملة نموذجات تشفير-تشفير (BART، T5، mBART، NLLB) تدرب على مليارات الرموز.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

أضع المرقم الرقمية الحديثة لتحويلات. الشكل رفيع المستوى (مرقم، مقطع، توليد رموز-ب-رموز) هو نفسه من ورقة 2014 seq2seq. الآلية داخل كل كتلة مختلفة.

### متى لا يزال هناك متابعة لـ RNN

تقريباً أبداً، بالنسبة للمشاريع الجديدة

- ترجمة التدفق حيث تستهلك إدخال رمز واحد في وقت واحد مع ذاكرة محدودة.
- إنتاج نص على الجهاز حيث تكلفة ذاكرة المحولات هي مكافئة.
- التعليم فهم عقدة الرمز التشفير هو أسرع طريق لفهم سبب فوز المحولات

### تحيز التعرض وتخفيفه

- **Scheduled sampling.**نسبة الإجبار المعلمية خلال التدريب حتى يتعلم النموذج التعافي من أخطائه
- **Minimum risk training.**تدرب على درجة الجملة بليو بدلا من التقاطع على مستوى الرمز. أقرب إلى ما تريد حقا.
- **Reinforcement learning fine-tuning.**مكافأة مولد التسلسل مع مقياس يستخدم في القانون الحديث RLHF.

كل هذه الثلاثة لا تزال تنطبق على توليد محول

## أرسله

إبقوا`outputs/prompt-seq2seq-design.md`:

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## التمارين

1. **Easy.**تنفيذ مهمة نسخ اللعبة. قم بتدريب GRU seq2seq على أزواج المدخلات والخروج حيث يكون الهدف مساوياً للمصدر. قم بتقييم الدقة في أطوال 5, 10, 20. قم بتكرار ضغوط الزجاجة.
2. **Medium.**إضافة تشفير البحث عن الشعاع مع عرض الشعاع 3. قياس اللون الأبيض على جسم متوازي صغير ضد الفلسفة. وثيقة تفوز فيها البحث عن الشعاع (عادةً آخر رموز) وأين لا يحدث أي فرق.
3. **Hard.**-حسناً`facebook/bart-base`على مجموعة بيانات تشكيل 10K. مقارنة النموذج المنسق بشكل دقيق مع النموذج الأساسي على المدخلات المحفوظة. تقرير BLEU واختيار 10 أمثلة نوعية.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## المزيد من القراءة

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215)الورقة الأصلية على بعد بعد بعد، أربعة صفحات.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) تم إدخال GRU و إطار تشفير- تشفير.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)ورقة الاهتمام اقرأها بعد هذا الدروس
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) إعداد سياق2سياق + رمز الاهتمام.
