# سي إن إن و RNN للنصوص

> التحولات تتعلم ن-جرام. التكرار يتذكر. كلاهما يتم استبداله بالاهتمام. كلاهما لا يزال مهمًا على الأجهزة المحدودة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## المشكلة

أنتجت TF-IDF و Word2Vec متجهات مسطحة تجاهل ترتيب الكلمات. لم يتمكن مصنف بناء على هذه التصنيفات من معرفة`dog bites man`من`man bites dog`ترتيب الكلمات أحياناً يحمل الإشارة

عائلتان من المعماريات ملأت هذه الفجوة قبل وصول المحولات

**Convolutional nets for text (TextCNN).**تطبيق التضخم 1D على تسلسل من التوابل الكلمة. فلتر عرض 3 هو كاشف الثلاثة أشكال يمكن التعلم: يتجاوز ثلاث كلمات ويخرج نتيجة. تراكم عرض مختلف (2، 3، 4، 5) للكشف عن أنماط متعددة النطاقات. أقصى مجمع إلى تمثيل ذات الحجم الثابت. مسطح، متوازي، سريع.

**Recurrent nets (RNN, LSTM, GRU).**معالجة الرموز الواحدة في كل مرة، والحفاظ على حالة مخفية التي تحمل المعلومات إلى الأمام. تسلسل، تحمل الذاكرة، طول المدخلات المرنة. تسلط على نمذجة التسلسل من 2014 إلى 2017، ثم حدث الانتباه.

هذا الدرس يبني على كليهما ثم يسمي الفشل الذي دفع الانتباه.

## المفهوم

**TextCNN**(كيم، 2014) يتم دمج الرموز.`k`التشويق الـ 1D يزعج المرشح على متتالية `k`-جرام من التوابل، مما ينتج خريطة ميزة. التجميع العالمي أقصى على تلك الخريطة يختار أقوى تفعيل. التجميع أقصى الخروج من عدة عرضات المرشح. تغذية إلى رأس المصنف.

لماذا يعمل. الفلتر هو n-جرام قابل للتعلم. المجموعة الكبيرة هي غير متغيرة في الموقف، لذلك "ليس جيد" يطلق نفس الميزة في بداية أو منتصف مراجعة. ثلاثة عرضات الفلتر مع 100 مرشح لكل يعطيك 300 اكتشافات n-جرام تعلم. التدريب متوازي؛ لا تعتمد تسلسلية.

**RNN.**في كل خطوة`t`، الحالة الخفية`h_t = f(W * x_t + U * h_{t-1} + b)`. مشاركة`W`،`U`،`b`عبر الزمن، الحالة الخفية في الوقت`T`هو ملخص للمسألة الكاملة.`h_1 ... h_T`(أقصى، متوسط، أو آخر).

المواد العادية المعدنية تعاني من انحدارات تختفي**LSTM**يضيف البوابات التي تقرر ما يجب نسيانه، ما يجب تخزينه، وما يجب إخراجه، مما يثبت التراجع عبر تسلسلات طويلة.**GRU**يسهل نظام LSTM إلى بوابتين؛ يعمل بنفس الطريقة مع أقل ملامح.

**Bidirectional RNNs**إضافة إلى ذلك، فإن إضافة كل رمز إلى إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إضافة إض

```figure
rnn-unroll
```

## بناءها

### الخطوة الأولى: النصCNN في PyTorch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_classes, filter_widths=(2, 3, 4), n_filters=64, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, n_filters, kernel_size=k)
            for k in filter_widths
        ])
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids).transpose(1, 2)
        pooled = []
        for conv in self.convs:
            c = F.relu(conv(x))
            p = F.max_pool1d(c, c.size(2)).squeeze(2)
            pooled.append(p)
        h = torch.cat(pooled, dim=1)
        return self.fc(self.dropout(h))
```

- نعم`transpose(1, 2)`تغيير شكل`[batch, seq_len, embed_dim]`إلى`[batch, embed_dim, seq_len]`لأن`nn.Conv1d`يعامل المحور الوسط كقنوات. الخروج المجمّع هو حجم ثابت بغض النظر عن طول المدخل.

### الخطوة الثانية: تصنيف LSTM

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_classes, bidirectional=True, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=bidirectional)
        factor = 2 if bidirectional else 1
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_dim * factor, n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids)
        out, _ = self.lstm(x)
        pooled = out.max(dim=1).values
        return self.fc(self.dropout(pooled))
```

المجموعة الكبيرة على التسلسل، وليس المجموعة الأخيرة للدولة. للتصنيف، المجموعة الكبيرة عادة ما تفوق أخذ الحالة الخفية الأخيرة لأن المعلومات في نهاية تسلسل طويل تميل إلى السيطرة على الحالة الأخيرة.

### الخطوة الثالثة: عرض التراجع المتلاشى (الاندراهية)

لا يمكن أن تتعلم RNN العادي دون غاتينغ الاعتمادات على المدى الطويل.`A`ظهرت في أي مكان في تسلسل`A`في الموقف 1 والترتيب هو 100 رمزا طويلة، يجب أن تدفق تراجع من الخسارة من خلال 99 مضاعفة من الوزن المتكرر. إذا كان الوزن أقل من 1 تختفي تراجع. إذا كان أكثر من 1 فإنه ينفجر.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

أجهزة التطبيقات العسكرية تصحيح هذا**cell state**التي تمر عبر الشبكة مع تفاعلات إضافية فقط (بوابة النسيان تتحكم بها بشكل مضاعف ، ولكن التدرج لا يزال يتدفق على طول "الطريق السريع"). تقوم GRU بشيء مماثل مع وجود معايير أقل. كلاهما يوفر لك تدريبًا مستقرًا من خلال 100+ تسلسل خطوة.

### الخطوة الرابعة: لماذا لم يكن هذا كافياً

ظلت هناك ثلاثة مشاكل حتى مع LSTMs.

1. **Sequential bottleneck.**يتطلب تدريب RNN على تسلسل طول 1000 خطوات متسلسلة للأمام / للخلف. لا يمكن أن تكون متوازية عبر الزمن.
2. **Fixed-size context vector in encoder-decoder setups.**يرى المقرر فقط الحالة الخفية النهائية للمقرر، ضغط على المدخل بأكمله. تدخلات طويلة تفاصيل. يتناول الدروس 09 هذا مباشرة.
3. **Distant-dependency accuracy ceiling.**تتفوق أجهزة LSTM على أجهزة RNN العادية ولكنها لا تزال تكافح لنشر المعلومات المحددة عبر أكثر من 200 خطوة.

الاهتمام حل كل ثلاثة، المحولات أسقطت التكرار تماما، الدروس 10 هي المحور.

## استخدمها

(بيتورش)`nn.LSTM`،`nn.GRU`و`nn.Conv1d`إنّه جاهز للإنتاج، وقانون التدريب هو قياسي.

المقابلة المقبلة السفن التوابل المسبقة تدرب في كطبقة المدخل:

```python
from transformers import AutoModel

encoder = AutoModel.from_pretrained("bert-base-uncased")
for param in encoder.parameters():
    param.requires_grad = False


class BertCNN(nn.Module):
    def __init__(self, n_classes, filter_widths=(2, 3, 4), n_filters=64):
        super().__init__()
        self.encoder = encoder
        self.convs = nn.ModuleList([nn.Conv1d(768, n_filters, kernel_size=k) for k in filter_widths])
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, input_ids, attention_mask):
        with torch.no_grad():
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        x = out.transpose(1, 2)
        pooled = [F.max_pool1d(F.relu(conv(x)), kernel_size=conv(x).size(2)).squeeze(2) for conv in self.convs]
        return self.fc(torch.cat(pooled, dim=1))
```

قائمة التحقق من القيود

- **Edge / on-device inference.**إذا كان هدف نشرك هو هاتف، فهذا هو كومة.
- **Streaming / online classification.**تقوم RNN بمعالجة رمز واحد في كل مرة؛ يحتاج المحولون إلى التسلسل الكامل. بالنسبة إلى النص الموصول في الوقت الحقيقي، لا يزال LSTM يفوز.
- **Tiny models for baselines.**التكرار السريع في مهمة جديدة، تدريب TextCNN في 5 دقائق على جهاز CPU.
- **Sequence labeling with limited data.**تعتبر BiLSTM-CRF (المرحلة 06) معمارة NER من الدرجة الإنتاجية لعبارات تحمل علامات 1k-10k.

كل شيء آخر يذهب إلى محول

## أرسله

إبقوا`outputs/prompt-text-encoder-picker.md`:

```markdown
---
name: text-encoder-picker
description: Pick a text encoder architecture for a given constraint set.
phase: 5
lesson: 08
---

Given constraints (task, data volume, latency budget, deploy target, compute budget), output:

1. Encoder architecture: TextCNN, BiLSTM, BiLSTM-CRF, transformer fine-tune, or "use a pretrained transformer as a frozen encoder + small head".
2. Embedding input: random init, GloVe / fastText frozen, or contextualized transformer embeddings.
3. Training recipe in 5 lines: optimizer, learning rate, batch size, epochs, regularization.
4. One monitoring signal. For RNN/CNN models: attention mechanism absence means they miss long-range deps; check per-length accuracy. For transformers: fine-tuning collapse if LR too high; check train loss.

Refuse to recommend fine-tuning a transformer when data is under ~500 labeled examples without showing that a TextCNN / BiLSTM baseline has plateaued. Flag edge deployment as needing architecture-before-everything.
```

## التمارين

1. **Easy.**قم بتدريب برنامج TextCNN على مجموعة بيانات لعبة من 3 فئات (أنت تختلق البيانات). تحقق من أن عرض الفلتر (2، 3، 4) يفوق عرض واحد (3) في المتوسط F1.
2. **Medium.**تنفيذ جمع أقصى مستوى، ومجموعة متوسطة، والحالة الأخيرة المجمعة للمصنف LSTM. مقارنة على مجموعة بيانات صغيرة؛ وثيقة التي تفوز المجمعة وتخمين لماذا.
3. **Hard.**قم ببناء علامة BiLSTM-CRF NER (جمع الدروس 06 وهذه). قم بتدريب على CoNLL-2003. قم بالمقارنة مع خط الأساس CRF وحده من الدروس 06 ومقارنة مع تحديد BERT. قم بتقديم تقرير عن وقت التدريب والذاكرة والF1.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## المزيد من القراءة

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882)صحيفة "تكس سي إن" ثمانية صفحات، قابلة للقراءة
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf)ورقة الـ LSTM، واضحة بشكل غير متوقع
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/)الرسومات التي جعلت LSTM متاحة للجميع.
