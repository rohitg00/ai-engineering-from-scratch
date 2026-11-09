# Dikkat Mekanizması  Önemli Bir Devam

> Dekodör, sıkıştırılmış bir özetle göz kırpmayı bırakır ve tüm kaynağa bakmaya başlar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## Sorun

Ders 09 ölçülü bir başarısızlıkla sona erdi. Oyuncak kopya görevinde eğitilmiş bir GRU kodlayıcı-dekodör, uzunluk 5'de %89 doğruluktan neredeyse şans uzunluğuna 80'e kadar gidiyor. Sebep yapısal, eğitim hatası değil: kodlayıcı topladığı her bilgi, sabit boyutlu bir gizli durumda yer almalı ve dekodör başka hiçbir şey görmez.

Bahdanau, Cho ve Bengio 2014 yılında üç satırlı bir düzeltme yayınladı. Dekodere yalnızca son kodlayıcı durumunu vermek yerine, her kodlayıcı durumunu koruyun.`i`Bu ağırlıklı ortalama bağlamdır ve her dekodör adımını değiştirir.

Bu fikir tümüyle aynı. Transformatörler onu genişletti. Kendine dikkatle tek bir dizine uyguladı. Çoklu başlı dikkat paralel olarak çalıştı. Ama 2014 versiyonu zaten şişek boynunu kırmıştı ve bir kez sahip olduktan sonra, transformatörlerin çekirdeği konsept değil mühendisliktir.

## Anlaşım

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

Her dekoder adımında `t`- ...

1. Önceki dekodörün gizli durumunu kullan `s_{t-1}`bir **query**- Evet .
2. Her kodlayıcıya karşı puan verin .`h_1, ..., h_T`- Kodlayıcı pozisyonu başına bir skalar.
3. Dikkat ağırlıkları almak için puanları yumuşat `α_{t,1}, ..., α_{t,T}`Bu toplam 1'e kadar.
4. Bağlantı vektörü `c_t = Σ α_{t,i} * h_i`- Kodlayıcı durumlarının ağırlıklı ortalaması.
5. Dekodör alır `c_t`+ önceki çıkış token, bir sonraki token üretir.

Decikleyici "Je" i "I"ye çevirmek zorunda kaldığında, kodlayıcı durumunu "Je" yüksek ve diğerlerini düşük ağırlıklandırır. "Hayır" gerektiğinde, "pas" yüksek ağırlıklandırır. Konekst vektörü her adımı yeniden şekillendirir.

## Şekiller (herkesi ısıran şey)

İlk kez dikkat uygulaması yanlış gittiği yer burası.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`- Evet .

- `s_{t-1}`şekli var .`(d_s,)`- Evet .`h_i`şekli var .`(d_h,)`- Evet .
- `W_a`şekli var .`(d_attn, d_s)`- Evet .`U_a`şekli var .`(d_attn, d_h)`- Evet .
- Tanh ' ın içinde olan toplamlarının şekli var .`(d_attn,)`- Evet .
- `v_α`şekli var .`(d_attn,)`İç ürün ile`v_α`Bir merdiven olarak çöküyor.**This is what `v_α` does.**Bu sihir değil, dikkat-dim vektörünü bir skalar skoruna dönüştüren bir projeksiyon.

**Luong (multiplicative) score.**Üç çeşit:

- `dot`- Evet .`e_{t,i} = s_t^T * h_i`- Gerekli .`d_s == d_h`- Kodlamanız iki yönlüse atlayın.
- `general`- Evet .`e_{t,i} = s_t^T * W * h_i`- Evet .`W`şekli`(d_s, d_h)`- Aynı nükleerlik kısıtlamasını kaldırır.
- `concat`Bahdanau şekli: ilk ikisi daha ucuz olduğundan nadiren kullanılır.

**One Bahdanau / Luong gotcha worth naming.**Bahdanau kullanıyor `s_{t-1}`(bu sözcük oluşturmadan önce * dekodör durumunda). Luong kullanır `s_t`Bir kağıt seçip, konvansiyonuna bağlı kalın.

```figure
attention-heatmap
```

## Yapın

### Adım 1: katkı (Bahdanau) dikkat

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

Şekillere bak.`encoder_states`şekli var .`(T_enc, d_h)`- Evet .`projected_enc`şekli var .`(T_enc, d_attn)`- Evet .`projected_dec`şekli var .`(d_attn,)`ve yayınlar. `combined`şekli var .`(T_enc, d_attn)`- Evet .`scores`şekli var .`(T_enc,)`- Evet .`weights`şekli var .`(T_enc,)`- Evet .`context`şekli var .`(d_h,)`- Gönder.

### Adım 2: Luong nokta ve genel

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

Bu yüzden Luong'un kağıdı geldi.

### Adım 3: İşlenen sayısal örnek

Üç kodlayıcı durum (kayın, uydu, mat) ve ilk ile en çok uyumlu bir dekoder durumu verildiğinde, dikkat dağılımı 0 pozisyonuna yoğunlaşır. Eğer dekoder durumu sonuncuyla uyumlu hale gelirse, dikkat 2. pozisyonu taşıyor.

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

İlk satır kazanır. Sonra dekodör durumunu üçüncü kodör durumuna yakınlaştır ve ağırlıkların kaymasını izle.

### Dördüncü adım: Bu neden transformatörlere giden köprüdür ?

Yukarıdaki dili Q/K/V'ye çevirin:

- **Query**= dekodör durumu `s_{t-1}`
- **Key**= kodlayıcı durumları (neye karşı puan verdiğimiz)
- **Value**= kodlayıcı durumları (koştukları ve toplamladığımızı)

Klasik dikkat, anahtarlar ve değerler aynı şeydir. Kendine dikkat onları ayırır: K ve V için farklı öğrenilen projeksiyonlarla bir diziyi kendine karşı soruyabilirsiniz. Çoklu başlı dikkat, farklı öğrenilen projeksiyonlarla paralel olarak çalışır. Transformatörler tüm aşamayı birçok kez yığar ve RNN'leri düşürür.

Matematik aynı. Şekiller aynı. Bahdanau dikkatinden ölçekli nokta ürün dikkatine pedagogik atlama çoğunlukla notasyondur.

## Kullan

PyTorch ve TensorFlow dikkatini doğrudan gönderiyorlar.

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

Bu bir transformatör dikkat katmanı. 5 pozisyondan oluşan sorgu parti, 10 pozisyondan oluşan anahtar/değer parti, her biri 128 boyutlu, 8 baş.`output`Bu yeni bağlamlı sorulardır. `weights`Görüştürebileceğiniz 5x10 uyumlu matris.

### Klasik ilgi hala önemli olduğunda

- Tek başlı, tek katlı, RNN tabanlı versiyon her kavramı görünür kılar.
- Transformatörlerin uyumsuz olduğu cihaz üzerindeki dizi görevleri.
- Bahdanau'nun toplantısını bilmeden yanlış okuyacaksınız.
- MT'de ince tanelerli uyum analizi. Çiğ dikkat ağırlıkları, transformatör modellerinde bile yorumlanabilirlik aracıdır ve bunları okumak ne olduklarını bilmeyi gerektirir.

### Dikkat ağırlığı açıklama tuzağı

Dikkat ağırlıkları yorumlanabilir görünüyor. Bir pozisyonda bir kişiye toplamda bir ağırlıklardır; onları çizmek mümkündür; yüksek "bunu izle" anlamına gelir.

Bunlar göründüğü kadar yorumlanabilir değildir. Jain ve Wallace (2019) dikkat dağılımlarının bazı görevler için model tahminlerini değiştirmeden keyfi alternatiflerle değiştirilmesi ve değiştirilmesi gerektiğini gösterdi.

## Gönder

- Kaydet .`outputs/prompt-attention-shapes.md`- ...

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## Egzersizler

1. **Easy.**Uygulama`softmax`Kodlayıcıdaki tokenleri kapatmak için dikkat ağırlığı sıfır.
2. **Medium.**Luong ' a çok kişilik dikkat katın .`general`- Şekil.`d_h`- ...`n_heads`Tek başlı olayın daha önceki uygulamalarınızla uyumlu olduğunu kontrol edin.
3. **Hard.**9. ders'ten bahdanau dikkatini oyuncak kopyası görevi için GRU kodlayıcı-dekodörünü eğit.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## Daha Fazla Okumak

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- Gazete.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) üç puan variansı ve karşılaştırmaları.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) yorumlanabilirlik uyarısı.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html)PyTorch ile yürüyüşe geçebilir.
