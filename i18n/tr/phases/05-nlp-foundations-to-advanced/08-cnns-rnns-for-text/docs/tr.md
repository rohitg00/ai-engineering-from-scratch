# CNN ve RNN'ler

> Değişiklikler n-gram öğrenir. Tekrarlıklar hatırlanır. İkisi de dikkatle değiştirilmiştir. İkisi de sınırlı donanımlarda hala önemlidir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## Sorun

TF-IDF ve Word2Vec, kelime sırasını görmezden gelen düz vektörler üretti.`dog bites man`-`man bites dog`Bazen kelime sırası sinyal taşır.

Transformatörler gelmeden önce iki mimarlık ailesi bu boşluğu doldurdu.

**Convolutional nets for text (TextCNN).**1D sarmalamaları kelimelerinin sekanslarına uygulayın. Genişliği 3 olan bir filtre öğrenilebilir bir trigram algılayıcısıdır: üç kelimeyi kapsar ve bir puan çıkarır. Çok ölçekli desenleri algılamak için farklı genişlikler (2, 3, 4, 5) yığın. Max-pool sabit boyutlu bir temsil. Düz, paralel, hızlı.

**Recurrent nets (RNN, LSTM, GRU).**İşlem simgelerini bir seferde, bilgiyi ileriye taşıyan gizli bir durum koruyarak. Sequential, bellek taşıyan, esnek giriş uzunlukları. 2014'ten 2017'ye kadar baskın sıra modeliştirme, sonra dikkat oldu.

Bu ders her ikisini de geliştirir, sonra dikkat çeken başarısızlığı isimlendirir.

## Anlaşım

**TextCNN**Tokenler yerleştirilmiştir.`k`1D kıvrım bir filtreyi ardıcıl olarak kaydırır `k`-gramlar yerleştirilmiş, özellik haritası üreten. bu haritada global maksimum birleştirme en güçlü etkinliği seçer.

Filtrenin çalışması neden önemlidir. Bir filtre öğrenilebilir bir n-gramdır. Maksimum birleştirme pozisyon değişikliğidir, bu nedenle "iyi değil" bir incelemenin başında veya ortasında aynı özelliği ateşler. Her biri 100 filtre ile üç filtre genişliği size 300 öğrenilmiş n-gram detektörü verir. Eğitim paraleldir; sıralı bağımlılık yoktur.

**RNN.**Her adımda .`t`, gizli durum .`h_t = f(W * x_t + U * h_{t-1} + b)`Paylaşın .`W`- Evet .`U`- Evet .`b`Zamanın içinde gizli bir durum.`T`sınıflandırma için, bir araya getirmek `h_1 ... h_T`(maksimum, ortalama veya son).

Basit RNN'ler kaybolan eğriliklere sahiptir.**LSTM**Neyi unutmaya, neyi saklamaya ve neyi çıkaracak karar veren kapılar ekler.**GRU**LSTM'yi iki kapıya basitleştirir; daha az parametrelerle benzer şekilde çalışır.

**Bidirectional RNNs**RNN'nin birini ileriye, birini geriye, gizli durumları birleştirerek çalıştırın.

```figure
rnn-unroll
```

## Yapın

### Adım 1: PyTorch'te TextCNN

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

- Evet .`transpose(1, 2)`yeniden şekillendirilmesi`[batch, seq_len, embed_dim]`- ...`[batch, embed_dim, seq_len]`Çünkü ...`nn.Conv1d`Orta ekseni kanal olarak değerlendirir.

### Adım 2: LSTM sınıflandırıcısı

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

Klassifleştirme için, maksimum birleştirme genellikle son gizli durumu almayı yener çünkü uzun bir dizi sonunda bilgi son durumu ele geçirmektedir.

### Adım 3: kaybolan gradient demo (intuition)

Kapalı olmayan basit bir RNN uzun mesafeli bağımlılıkları öğrenemez.`A`Bir dizi içinde herhangi bir yerde ortaya çıktı.`A`Eğer 1 pozisyonunda ve dizisi 100 token uzunluğunda ise kayıptan gelen gradient tekrarlayan ağırlığın 99 katından geri akmalı. Eğer ağırlık 1'den azsa, gradient ortadan kaybolur. 1'den fazlasa patlar.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTM'ler bunu bir **cell state**Bu, sadece katılımlı etkileşimlerle ağın üzerinden geçer (gözgeçit onu çoğaltır, ancak gradientler hala "yolu" boyunca akıyor).

### Dördüncü adım: Neden bu yeterli değildi?

LSTM'ler ile bile üç sorun devam etti.

1. **Sequential bottleneck.**1000 uzunluklı bir dizide bir RNN'yi eğitmek 1000 seri ileri/geri adım gerektirir.
2. **Fixed-size context vector in encoder-decoder setups.**Dekoder, tüm giriş üzerinde sıkıştırılmış, sadece enkoderin son gizli durumunu görür. Uzun girişler ayrıntıları kaybeder. 09 ders bunu doğrudan kapsar.
3. **Distant-dependency accuracy ceiling.**LSTM'ler sıradan RNN'lerden daha iyi performans gösterir, ancak hala 200'den fazla aşamada belirli bilgileri yaymak için mücadele ederler.

Dikkat üçünü de çözdü. Transformatörler tekrarlanmayı tamamen düşürdü.

## Kullan

PyTorch'in `nn.LSTM`- Evet .`nn.GRU`ve`nn.Conv1d`Eğitim kodu standart.

Yüz gemileri, giriş katmanı olarak bağladığınız önceden eğitilmiş yerleşimler:

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

Kullanım-ne zaman-it-fits-the-restriction kontrol listesi.

- **Edge / on-device inference.**TextCNN'in GloVe yerleştirmeleri bir transformatörden 10-100 kat daha küçüktür.
- **Streaming / online classification.**RNN bir seferde bir token işliyor; transformörlerin tam sıraya ihtiyacı var. Gerçek zamanlı gelen metin için LSTM'ler hala kazanıyor.
- **Tiny models for baselines.**Yeni bir görev için hızlı tekrarlama.
- **Sequence labeling with limited data.**BiLSTM-CRF (dersi 06) hala 1k-10k etiketli cümleler için üretim derecesi NER mimarisi.

Diğer her şey bir transformatöre gidiyor.

## Gönder

- Kaydet .`outputs/prompt-text-encoder-picker.md`- ...

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

## Egzersizler

1. **Easy.**Bir TextCNN'i 3 sınıf oyuncak verisi kümesi üzerinde eğit (verileri icat ettin). Filtr genişliğinin (2, 3, 4) ortalama F1'den tek bir genişliğe (3) daha yüksek olduğunu kontrol edin.
2. **Medium.**LSTM sınıflandırıcısı için maksimum, ortalama ve son durum birleştirmesini uygulayın. Küçük bir veri kümesi üzerinde karşılaştırın; birleştirmenin hangi belgeyi kazanmış olduğunu ve neden olduğunu varsayın.
3. **Hard.**BiLSTM-CRF NER etiketini oluşturun (bütün ders 06 ve bu birleştirin). CoNLL-2003'te eğitim alın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## Daha Fazla Okumak

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882)TextCNN gazetesi. 8 sayfa.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf)- LSTM kağıdı. Beklenmedik derecede açık.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) LSTM'leri herkese erişilebilir kılan şemalar.
