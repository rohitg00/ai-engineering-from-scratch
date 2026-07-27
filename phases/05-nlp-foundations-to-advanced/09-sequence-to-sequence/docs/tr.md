# Sıradan Sıraya Modeller

> Çevirmen gibi davranan iki RNN. Dikkatin var olmasının nedeni, karşılaştıkları darboğazdır.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 08 (Metin için CNN'ler + RNN'ler), Aşama 3 · 11 (PyTorch Giriş)
**Süre:** ~75 dakika

## Sorun

Sınıflandırma, değişken uzunluklu bir diziyi tek bir etiketle eşleştirir. Çeviri, değişken uzunluklu bir diziyi başka bir değişken uzunluklu diziyle eşler. Girdi ve çıktı, uzunluk eşitliği garantisi olmaksızın farklı sözlüklerde, muhtemelen farklı dillerde bulunur.

seq2seq mimarisi (Sutskever, Vinyals, Le, 2014) bunu kasıtlı olarak basit bir tarifle kırdı. İki RNN. Kaynak cümle okunur ve sabit boyutlu bir bağlam vektörü oluşturulur. Diğeri bu vektörü okur ve token'ye göre token hedef cümlesini oluşturur. 08. ders için yazdığınız kodun aynısı farklı şekilde yapıştırılmış.

Bu iki nedenden dolayı çalışmaya değer. Birincisi, bağlam vektörü darboğazı NLP'deki pedagojik açıdan en yararlı başarısızlıktır. Dikkati çeken ve transformer'lerin iyi olduğu her şeyi motive eder. İkincisi, eğitim reçetesi (öğretmen zorlaması, planlı örnekleme, inference'de ışın arama) hala Yüksek Lisans'lar dahil her modern nesil sistem için geçerlidir.

## Konsept

**Kodlayıcı.** Kaynak cümleyi okuyan bir RNN. Son gizli durumu, tüm girdinin sabit boyutlu bir özeti olan **bağlam vektörüdür**. Sözde kaynak dışında hiçbir şeyi kaybetmeyin.

**Kod çözücü.** Bağlam vektöründen başlatılan başka bir RNN. Her adımda önceden oluşturulmuş token'yi girdi olarak alır ve hedef sözcük dağarcığı üzerinde bir dağılım üretir. Sonraki token'yi seçmek için sample veya argmax. Tekrar besleyin. Bir `<EOS>` token üretilene veya maksimum uzunluğa ulaşılana kadar tekrarlayın.

**Eğitim:** Her kod çözücü adımındaki çapraz entropi kaybı, dizi üzerinden toplanır. Her iki ağ üzerinden zaman içinde standart backprop.

**Öğretmen zorlaması.** Eğitim sırasında, kod çözücünün `t` adımındaki girişi, kod çözücünün kendi önceki tahmini değil, `t-1` konumundaki *temel gerçektir* token'dir. Bu, eğitimi istikrara kavuşturur; onsuz, erken hatalar art arda gelir ve model asla öğrenmez. inference'de modelin kendi tahminlerini kullanmanız gerekir, dolayısıyla her zaman bir tren/inference dağıtım boşluğu vardır. Bu boşluğa **maruz kalma yanlılığı** denir.

**Darboğaz.** Kodlayıcının kaynak hakkında öğrendiği her şeyin tek bir bağlam vektörüne sıkıştırılması gerekir. Uzun cümleler ayrıntıları kaybeder. Nadir kelimeler bulanıklaşıyor. Yeniden sıralamanın (kara kediye karşı kara kedi) hesaplanması değil, ezberlenmesi gerekir.

Dikkat (ders 10), kod çözücünün yalnızca son kodlayıcıya değil *her* kodlayıcı gizli durumuna bakmasına izin vererek bu sorunu düzeltir. Bütün saha budur.

```figure
lstm-gates
```

## İnşa Et

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

`outputs`, `[batch, seq_len, hidden_dim]` şekline sahiptir — giriş konumu başına bir gizli durum. `hidden`, son adım olan `[1, batch, hidden_dim]` şekline sahiptir. Ders 08, "sınıflandırma için çıktıların havuzlanması" dedi. Burada son gizli durumu bağlam vektörü olarak tutuyoruz ve adım başına çıktıları yok sayıyoruz.

### Adım 2: kod çözücü

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

Kod çözücüye her seferinde bir adım denir. Giriş: tek bir token grubu ve geçerli gizli durum. Çıktı: sonraki token ve güncellenmiş gizli durum için kelime logları.

### 3. Adım: Öğretmenin zorlamasıyla eğitim döngüsü

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

Adlandırmaya değer iki düğme. `ignore_index=0`, token'lerin doldurulmasındaki kaybı atlar. `teacher_forcing_ratio`, her adımda modelin tahminine karşı gerçek token'yi kullanma olasılığıdır. 1,0'dan başlayın (tam öğretmen zorlaması) ve maruz kalma-önyargı açığını kapatmak için eğitim boyunca ~0,5'e kadar tavlayın.

### Adım 4: inference döngüsü (açgözlü)

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

Açgözlü kod çözme, her adımda en yüksek olasılığa sahip token'yi seçer. Ortadan kaybolabilir: Bir token taahhüdünde bulunduğunuzda bunu geri alamazsınız. **Işın arama** en üstteki `k` kısmi dizilerini canlı tutar ve sonunda en yüksek puanı alan tamamlanmış diziyi seçer. Işın genişliği 3-5 standarttır.

### Adım 5: darboğaz, gösterildi

Modeli bir oyuncak kopyalama görevi üzerinde eğitin: kaynak `[a, b, c, d, e]`, hedef `[a, b, c, d, e]`. Sıra uzunluğunu artırın. Doğruluğu gözlemleyin.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

Tek bir GRU gizli durumu, 40-token girişini kayıpsız bir şekilde ezberleyemez. Bilgi her kodlayıcı adımında mevcuttur ancak kod çözücü yalnızca son durumu görür. Dikkat bunu doğrudan düzeltir.

## Kullan onu

PyTorch, `nn.Transformer` ve `nn.LSTM` tabanlı seq2seq şablonlarına sahiptir. Hugging Face'in `transformers` kitaplığı, milyarlarca token üzerinde eğitilmiş tam kodlayıcı-kod çözücü modelleri (BART, T5, mBART, NLLB) sunar.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

Modern kodlayıcı-kod çözücüler transformer'ler için RNN'leri düşürdü. Üst düzey şekil (kodlayıcı, kod çözücü, token-by-token oluştur) 2014 seq2seq kağıdıyla aynıdır. Her bloğun içindeki mekanizma farklıdır.

### RNN tabanlı seq2seq'e ne zaman ulaşılmalı?

Yeni projeler için neredeyse hiçbir zaman. Özel istisnalar:

- Sınırlı bellekle her seferinde bir token girişi tükettiğiniz akış çevirisi.
- transformer bellek maliyetinin engelleyici olduğu cihaz üzerinde metin oluşturma.
- Pedagoji. Kodlayıcı-kod çözücü darboğazını anlamak, transformer'lerin neden kazandığını anlamanın en hızlı yoludur.

### Maruz kalma yanlılığı ve hafifletilmesi

- **Planlı örnekleme.** Modelin kendi hatalarından kurtulmayı öğrenmesi için öğretmenin eğitim sırasında zorlama oranını tavlayın.
- **Minimum risk eğitimi.** token düzeyinde çapraz entropi yerine cümle düzeyinde BLEU puanı üzerine eğitim alın. Gerçekte istediğine daha yakın.
- **Takviyeli öğrenme fine-tuning.** Sıra oluşturucuyu bir ölçümle ödüllendirin. Modern LLM RLHF'de kullanılır.

Üçü de hala transformer tabanlı nesil için geçerlidir.

## Gönderin

`outputs/prompt-seq2seq-design.md` olarak kaydet:

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

1. **Kolay.** Oyuncak kopyalama görevini uygulayın. Hedefin kaynağa eşit olduğu giriş-çıkış çiftleri üzerinde bir GRU seq2seq eğitin. 5, 10, 20 uzunluklarında doğruluğu ölçün. Darboğazı yeniden oluşturun.
2. **Orta.** Işın genişliğiyle ışın arama kod çözme ekleyin 3. Açgözlülüğe karşı küçük bir paralel korpusta BLEU'yu ölçün. Işın aramanın nerede kazandığını (genellikle son token'ler) ve nerede hiçbir fark yaratmadığını belgeleyin.
3. **Zor.** `facebook/bart-base`'nin 10k çiftlik bir dataset ifadesinde ince ayarını yapın. İnce ayarlı modelin ışın-4 çıkışını, temel modelin uzatılmış girişlerle karşılaştırın. BLEU'yu bildirin ve 10 nitel örnek seçin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Kodlayıcı | RNN'yi girin | Kaynağı okur. Adım başına gizli durumlar ve son bağlam vektörü üretir. |
| Kod Çözücü | Çıkış RNN'si | Bağlam vektöründen başlatıldı. Hedef token'leri teker teker oluşturur. |
| Bağlam vektörü | Özet | Son kodlayıcı gizli durumu. Sabit boyut. Dikkat darboğazını çözer. |
| Öğretmen zorlama | Gerçek token'leri kullanın | Eğitim zamanında önceki token'yi gerçek anlamda besleyin. Öğrenmeyi stabilize eder. |
| Pozlama yanlılığı | Eğitim/test boşluğu | Gerçek token'ler üzerinde eğitilen model hiçbir zaman kendi hatalarından kurtulma konusunda pratik yapmadı. |
| Işın arama | Daha iyi kod çözme | Açgözlülükle taahhütte bulunmak yerine her adımda en iyi kısmi dizileri canlı tutun. |

## Daha Fazla Okuma

- [Sutskever, Vinyals, Le (2014). Neural Networks](https://arxiv.org/abs/1409.3215) ile Sıradan Öğrenmeye Sıra — orijinal seq2seq makalesi. Dört sayfa.
- [Cho ve ark. (2014). İstatistiksel Makine Çevirisi için RNN Kodlayıcı-Kod Çözücüyü Kullanarak Cümle Temsillerini Öğrenme](https://arxiv.org/abs/1406.1078) — GRU'yu ve kodlayıcı-kod çözücü çerçevelemesini tanıttı.
- [Bahdanau, Cho, Bengio (2014). Hizalamayı ve Çevirmeyi Ortaklaşa Öğrenme yoluyla Nöral Makine Çevirisi](https://arxiv.org/abs/1409.0473) — dikkat belgesi. Bu dersten hemen sonra okuyun.
- [Scratch eğitiminden PyTorch NLP](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) — oluşturulabilir seq2seq + dikkat kodu.
