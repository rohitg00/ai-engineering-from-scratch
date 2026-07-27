Metin için # CNN'ler ve RNN'ler

> Evrişimler n-gramları öğrenir. Tekrarlar hatırlar. Her ikisinin de yerini dikkat alıyor. Her ikisi de kısıtlı donanım açısından hala önemlidir.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 3 · 11 (PyTorch Giriş), Aşama 5 · 03 (Word Embeddings), Aşama 4 · 02 (Sıfırdan Evrişimler)
**Süre:** ~75 dakika

## Sorun

TF-IDF ve Word2Vec, kelime sırasını göz ardı eden düz vektörler üretti. Bunların üzerine kurulu bir sınıflandırıcı, `dog bites man` ile `man bites dog`'yi ayırt edemedi. Kelime sırası bazen sinyali taşır.

transformer'lar gelmeden önce bu boşluğu iki mimari ailesi dolduruyordu.

**Metin için evrişimli ağlar (TextCNN).** embedding kelime dizileri üzerine 1 boyutlu evrişimler uygulayın. Genişliği 3 olan bir filtre, öğrenilebilir bir trigram dedektörüdür: üç kelimeyi kapsar ve bir puan verir. Çok ölçekli desenleri tespit etmek için farklı genişlikleri (2, 3, 4, 5) istifleyin. Maksimum havuzdan sabit boyutlu bir gösterime. Düz, paralel, hızlı.

**Yinelenen ağlar (RNN, LSTM, GRU).** Bilgiyi ileri taşıyan gizli bir durumu koruyarak token'ları teker teker işleyin. Sıralı, hafıza taşıyan, esnek giriş uzunlukları. 2014'ten 2017'ye kadar dizi modellemeye hakim oldu, ardından dikkat çekti.

Bu ders her ikisini de oluşturur, ardından dikkati çeken başarısızlığın adını verir.

## Konsept

**TextCNN** (Kim, 2014). Token'ler gömülür. Genişlik-`k` 1 boyutlu bir evrişim, bir filtreyi ardışık `k`-gram embedding'lar üzerinde kaydırarak bir özellik haritası üretir. Bu harita üzerinde küresel maksimum havuzlama en güçlü aktivasyonu seçer. Çeşitli filtre genişliklerinden maksimum havuzlanmış çıktıları birleştirin. Bir sınıflandırıcı kafasına besleyin.

Neden işe yarıyor? Filtre öğrenilebilir bir n-gramdır. Maksimum havuzlama konumla değişmez, dolayısıyla "iyi değil" aynı özelliği incelemenin başında veya ortasında tetikler. Her biri 100 filtreli üç filtre genişliği size 300 öğrenilmiş n-gram dedektörü sağlar. Eğitim paraleldir; sıralı bağımlılık yok.

**RNN.** Her `t` zaman adımında, gizli durum `h_t = f(W * x_t + U * h_{t-1} + b)`. `W`, `U`, `b`'yi zaman içinde paylaşın. `T` zamanındaki gizli durum tüm önekin özetidir. Sınıflandırma için, `h_1 ... h_T` (maks, ortalama veya son) genelinde havuz yapın.

Düz RNN'ler gradient'ların kaybolmasından muzdariptir. **LSTM** neyin unutulacağına, neyin depolanacağına ve neyin çıktılanacağına karar veren kapılar ekleyerek gradient'leri uzun diziler boyunca stabilize eder. **GRU** LSTM'yi iki kapıyla basitleştirir; daha az parametreyle benzer şekilde performans gösterir.

**Çift yönlü RNN'ler** gizli durumları birleştirerek bir RNN'yi ileri ve diğerini geriye doğru çalıştırır. Her token'nin temsili hem sol hem de sağ bağlamı görür. Görevleri etiketlemek için gereklidir.

```figure
rnn-unroll
```

## İnşa Et

### Adım 1: PyTorch'ta TextCNN

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

`transpose(1, 2)`, `[batch, seq_len, embed_dim]`'yi `[batch, embed_dim, seq_len]` olarak yeniden şekillendirir çünkü `nn.Conv1d` orta ekseni kanallar olarak ele alır. Havuzlanmış çıktı, giriş uzunluğundan bağımsız olarak sabit boyuttadır.

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

Son durum havuzu değil, dizi üzerindeki maksimum havuz. Sınıflandırma için maksimum havuzlama genellikle son gizli durumu almaktan daha iyidir çünkü uzun bir dizinin sonundaki bilgi son duruma hakim olma eğilimindedir.

### 3. Adım: kaybolan gradient demosu (sezgi)

Geçitlemesi olmayan basit bir RNN, uzun menzilli bağımlılıkları öğrenemez. Bir oyuncak görevi düşünün: token `A` dizisinin herhangi bir yerinde görünüp görünmeyeceğini tahmin edin. Eğer `A` 1 konumundaysa ve dizi 100 tokens uzunluğundaysa, kayıptan gelen gradient'nin tekrarlanan ağırlığın 99 çarpımı boyunca geri akması gerekir. Eğer ağırlık 1'den küçükse gradient kaybolur. 1'den fazla ise patlar.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTM'ler bunu, ağ üzerinden yalnızca toplamsal etkileşimlerle çalışan bir **hücre durumu** ile düzeltir (unutma kapısı bunu çarpımsal olarak ölçeklendirir, ancak gradient'ler hala "otoyol" boyunca akmaya devam eder). GRU'lar daha az parametreyle benzer bir şey yapar. Her ikisi de size 100'den fazla adım dizisi aracılığıyla istikrarlı bir eğitim sunar.

### 4. Adım: neden bu hala yeterli değildi?

LSTM'lerde bile üç sorun devam etti.

1. **Sıralı darboğaz.** Bir RNN'nin 1000 uzunluğundaki bir dizi üzerinde eğitilmesi, 1000 seri ileri/geri adımı gerektirir. Zaman içinde paralelleştirilemez.
2. **Kodlayıcı-kod çözücü kurulumlarında sabit boyutlu bağlam vektörü.** Kod çözücü, yalnızca kodlayıcının tüm giriş boyunca sıkıştırılmış son gizli durumunu görür. Uzun girişler ayrıntıları kaybeder. Ders 09 bunu doğrudan kapsar.
3. **Uzak bağımlılık doğruluk tavanı.** LSTM'ler, düz RNN'lerden daha iyi performans gösterir ancak yine de belirli bilgileri 200'den fazla adımda yaymakta zorluk çeker.

Dikkat üçünü de çözdü. Transformer'nin yinelemesi tamamen durduruldu. 10. ders pivottur.

## Kullan onu

PyTorch'un `nn.LSTM`, `nn.GRU` ve `nn.Conv1d` üretime hazırdır. Eğitim kodu standarttır.

Hugging Face, giriş katmanı olarak taktığınız önceden eğitilmiş embedding'leri sunar:

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

Kısıtlamaya uygun olduğunda kontrol listesini kullanın.

- **Kenar / cihaz üzerinde inference.** GloVe embedding'li TextCNN, transformer'dan 10-100 kat daha küçüktür. Dağıtım hedefiniz bir telefonsa bu yığındır.
- **Akış/çevrimiçi sınıflandırma.** RNN aynı anda bir token'yi işler; transformer'ların tam diziye ihtiyacı var. Gerçek zamanlı gelen metinlerde LSTM'ler hâlâ kazanıyor.
- **Temel çizgiler için küçük modeller.** Yeni bir görevde hızlı yineleme. Bir TextCNN'yi CPU üzerinde 5 dakikada eğitin.
- **Sınırlı verilerle dizi etiketleme.** BiLSTM-CRF (ders 06), 1k-10k etiketli cümleler için hâlâ üretim düzeyinde bir NER mimarisidir.

Geriye kalan her şey bir transformer'ye gider.

## Gönderin

`outputs/prompt-text-encoder-picker.md` olarak kaydet:

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

1. **Kolay.** 3 sınıflı bir oyuncak dataset üzerinde bir TextCNN eğitin (verileri siz icat edin). Filtre genişliklerinin (2, 3, 4) ortalama olarak tek bir genişlikten (3) daha iyi performans gösterdiğini doğrulayın F1.
2. **Orta.** LSTM sınıflandırıcısı için maksimum havuz, ortalama havuz ve son durum havuzunu uygulayın. Küçük bir dataset ile karşılaştırın; Hangi havuzlamanın kazandığını belgeleyin ve bunun nedenini hipotezleyin.
3. **Zor.** Bir BiLSTM-CRF NER etiketleyici oluşturun (ders 06 ile bunu birleştirin). CoNLL-2003 konusunda eğitim alın. Ders 06'daki yalnızca CRF temel çizgisiyle ve bir BERT ince ayarıyla karşılaştırın. Egzersiz süresini, hafızayı ve F1'i raporlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| MetinCNN | metin için CNN | Küresel maksimum havuza sahip embeddings kelimesi üzerindeki 1 boyutlu evrişim yığını. Kim (2014). |
| RNN | Tekrarlanan net | Gizli durum her zaman adımında güncellenir: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Kapılı RNN | Giriş / unutma / çıkış kapıları + bir hücre durumu ekler. Uzun diziler boyunca istikrarlı bir şekilde eğitim verir. |
| GRU | Daha basit LSTM | Üç yerine iki kapı. Benzer doğruluk, daha az parametre. |
| Çift Yönlü | Her iki yön | İleri + geri RNN birleştirildi. Her token bağlamının her iki tarafını da görür. |
| Kayboluyor gradient | Eğitim sinyali ölür | Düz RNN'lerde <1 ağırlıklarla tekrarlanan çarpma, erken adım gradient'leri etkili bir şekilde sıfır yapar. |

## Daha Fazla Okuma

- [Kim, Y. (2014). Cümle Sınıflandırması için Evrişimli Neural Network'ler](https://arxiv.org/abs/1408.5882) — TextCNN makalesi. Sekiz sayfa. Okunabilir.
- [Hochreiter, S. ve Schmidhuber, J. (1997). Uzun Kısa Süreli Bellek](https://www.bioinf.jku.at/publications/older/2604.pdf) — LSTM makalesi. Beklenmedik bir şekilde berrak.
- [Olah, C. (2015). LSTM Ağlarını Anlamak](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) — LSTM'leri herkes için erişilebilir kılan diyagramlar.
