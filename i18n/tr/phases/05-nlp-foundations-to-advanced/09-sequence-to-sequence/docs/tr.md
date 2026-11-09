# Sırayla Sırayla Modeller

> İki RNN tercüman numarası yapıyor.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## Sorun

Sınıflandırma, değişken uzunluklı bir diziyi tek bir etiketle haritası yapar. Çevirme, değişken uzunluklı bir diziyi başka değişken uzunluklı bir diziye haritası yapar. Giriş ve çıkış, uzunluk paritesi garantisi olmadan farklı kelime kitaplarında, muhtemelen farklı dillerde yaşar.

Seq2seq mimarisi (Sutskever, Vinyals, Le, 2014) bunu kasıtlı bir basit bir tarifle çözdü. İki RNN. Biri kaynak cümleyi okuyor ve sabit boyutlu bir bağlam vektörü üretir. Diğeri bu vektörü okuyor ve hedef cümle tokeni tokeni oluşturur. Ders 08, farklı bir şekilde yapıştırılmış olarak yazdığınız aynı kod.

Bu iki nedenden ötürü çalışmaya değer. Birincisi, bağlam vektör boğazı NLP'de en pedağolojik açıdan yararlı başarısızlıktır. Dikkat ve transformatörlerin iyi olduğu her şeyi motive eder. İkincisi, eğitim tarifi (öğretmen zorlaması, planlı örnekleme, sonucu üzerinde ışın araştırması) LLM'ler dahil olmak üzere tüm modern nesil sistemlerine hala uygulanır.

## Anlaşım

**Encoder.**Kaynak cümlesini okuyan bir RNN. Son gizli durumunda**context vector** tüm girişlerin sabit boyutlu bir özet. Kaynaktan başka bir şey kaybetme.

**Decoder.**Diğer bir RNN bağlam vektöründen başlatılır. Her adımda daha önce üretilen token'ı giriş olarak alır ve hedef sözlük üzerinde bir dağılım üretir.`<EOS>`Token üretilir veya maksimum uzunluk vurulur.

**Training:**Her dekoder adımında çapraz entropi kaybı, sırada toplamda.

**Teacher forcing.**Eğitim sırasında, dekodörün girişleri adım adım `t`konumdaki * temel gerçeklik* simgesi`t-1`Bu eğitimleri istikrarlandırır; bu olmadan erken hatalar kaskadaya düşer ve model asla öğrenmez.**exposure bias**- Evet .

**The bottleneck.**Kodlayıcı, kaynak hakkında öğrendiği her şeyi bu tek bağlam vektörüne sıkıştırmalı. Uzun cümleler ayrıntıları kaybeder. Nadir kelimeler bulanıklaşır. Yeniden düzenleme (chat noir vs. siyah kedi) hesaplama değil, ezberlenmelidir.

Dikkat (dokuzuncu ders) bunu çözüyor. * her * kodlayıcıyı saklı durumlara bakmak için izin veriyor.

```figure
lstm-gates
```

## Yapın

### Adım 1: Kodlayıcı

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

`outputs`şekli var .`[batch, seq_len, hidden_dim]` giriş pozisyonu başına bir gizli durum. `hidden`şekli var .`[1, batch, hidden_dim]` son adım. Ders 08 "sınıflandırma için çıkışları topluyoruz". Burada son gizli durumu bağlam vektörü olarak tuturuz ve adımlardaki çıkışları görmezden geliriz.

### İkinci adım: Bir dekodör

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

Decooder bir adım adım olarak adlandırılır. Giriş: tek bir token ve mevcut gizli durum. Çıktı: sözlük kaynağı logitleri bir sonraki token ve güncellenmiş gizli durum.

### Adım 3: Öğretmen zorla eğitim döngüsü

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

İki düğme isim vermeye değer.`ignore_index=0`Yükleme tokenlerinde kayıp atlar.`teacher_forcing_ratio`Bu, gerçek simgeyi her adımda modelin tahminine karşı kullanma olasılığının birincil değeri.

### Adım 4: İfade döngüsü (cinsel açgözlülük)

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

Açgözlü kodlama her adımda en büyük olasılıkla belirtiyi seçer.**Beam search**- Üstünü tutar.`k`Parsiyel dizi canlı ve en yüksek puan alan tamamlayıcıyı seçer.

### Adım 5: Boş boğazı, gösterildi

Modelleri oyuncak kopyası görevinde eğit: Kaynak `[a, b, c, d, e]`, hedef`[a, b, c, d, e]`- Seans uzunluğunu artırın.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

Tek bir GRU gizli durumu, 40 token girisini kayıpsız bir şekilde hatırlayamaz. Bilgi her kodlama adımında orada, ancak dekodör yalnızca son durumu görür. Dikkat bunu doğrudan düzeltir.

## Kullan

PyTorch ' un varlığı .`nn.Transformer`ve `nn.LSTM`-Sek2sek şablonları tabanlı.`transformers`kütüphane gemileri milyarlarca token üzerinde eğitilmiş tam kodlayıcı-dekoder modelleri (BART, T5, mBART, NLLB).

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

Modern kodlayıcı-dekodörler transformatörler için RNN'leri düşürdü. Yüksek düzeyde şekil (kodlayıcı, dekodör, generate-token-by-token) 2014 seq2seq kağıdı ile aynıdır. Her blok içindeki mekanizma farklıdır.

### RNN tabanlı seq2seq'e ne zaman ulaşmak gerekiyor?

Yeni projeler için neredeyse hiç.

- Akışlı çeviriler, bir kez bir token'ı kullanırken sınırlı hafıza ile.
- Transformer belleği maliyetinin yasak olduğu cihaz içi metin üretimi.
- Kodlayıcı-dekoder boğazını anlamak, neden transformatörler kazanmış olduğunu anlamanın en hızlı yolu.

### Ekspozisyon önyargısı ve azaltmaları

- **Scheduled sampling.**Eğitim sırasında öğretmen zorlama oranı, böylece model kendi hatalarından kurtulmayı öğrenir.
- **Minimum risk training.**Cümle seviyesindeki BLEU puanına göre çalış, token seviyesindeki çapraz entropi yerine.
- **Reinforcement learning fine-tuning.**Sequence jeneratörünü modern LLM RLHF'de kullanılan bir metrikle ödüllendirin.

Üçü de hala transformatör tabanlı jenerasyona uygundur.

## Gönder

- Kaydet .`outputs/prompt-seq2seq-design.md`- ...

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

## Egzersizler

1. **Easy.**Oyuncak kopyası görevini uygulayın. Hedef kaynağa eşit olduğu giriş-çıktı çiftlerinde GRU seq2seq eğit. 5, 10, 20 uzunluklarında doğruluk ölçün.
2. **Medium.**3 . Küçük paralel bir korpus üzerinde BLEU ölçerek açgözlülük karşılığını alın.
3. **Hard.**- Güzel sesli .`facebook/bart-base`10k çift parafrase verisi kümesi üzerinde. ince ayarlanmış modelin ışın-4 çıkışını, tutulan girişlerde bulunan temel modelin çıkışına karşılaştırın. BLEU raporunu yapın ve 10 kalite örneği seçin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## Daha Fazla Okumak

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215)- Orijinal bir sonraki makale.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) GRU ve kodlayıcı-dekoder çerçevesini tanıttı.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)Bu dersden hemen sonra okuyun.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) yapılandırılabilir seq2seq + dikkat kodu.
