# Çok Kafalı Dikkat

> Bir dikkat kafası her seferinde bir ilişkiyi öğrenir. Sekiz kafa sekizi öğrenir. Kafalar serbest. Daha fazlasını al.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 02 (Sıfırdan Öz-Dikkat)
**Süre:** ~75 dakika

## Sorun

Tek bir self-attention kafası, bir dikkat matrisini hesaplar. Bu matris, genellikle eğitim sinyali ne olursa olsun kaybı en aza indiren bir tür ilişkiyi yakalar. Verilerinizde özne-fiil uyumu, ortak referans, uzun menzilli söylem ve söz dizimi yığınları birbirine karışmışsa, tek bir kafa bunları tek bir soft-max dağılımına bulaştırır ve sinyalin yarısını kaybeder.

2017 Vaswani makalesindeki düzeltme: her biri kendi Q, K, V projeksiyonlarına sahip çeşitli dikkat işlevlerini paralel olarak çalıştırın ve çıktıları birleştirin. Her kafa, `d_model / n_heads` boyutunun daha küçük bir alt uzayında çalışır. Toplam parametreler aynı kalır. İfade gücü artar.

Çok kafalı dikkat, 2026'daki her transformer ile birlikte gönderilen varsayılan değerdir. Tek tartışma *kaç* kafa ve anahtarların ve değerlerin projeksiyonları paylaşıp paylaşmadığıdır (Gruplandırılmış Sorgu Dikkati, Çoklu Sorgu Dikkati, Çok Kafalı Gizli Dikkat).

## Konsept

![Çok kafalı dikkat böler, katılır, birleştirir](../assets/multi-head-attention.svg)

**Bölün.** `(N, d_model)` şeklini `X` alın. Her biri `(N, d_model)` şeklindeki Q, K, V'ye yansıtın. `(N, n_heads, d_head)`'ye (`d_head = d_model / n_heads`) yeniden şekillendirin. `(n_heads, N, d_head)`'a transpoze edin.

**Paralel olarak katılın.** Her kafanın içinde ölçeklendirilmiş nokta-çarpım dikkatini çalıştırın. Her kafa `(N, d_head)` üretir. Kafalar, embedding'nin farklı alt uzaylarında çalışır ve dikkat hesaplaması sırasında asla konuşmaz.

**Birleştir ve yansıt.** Yığın, `(N, d_model)`'ye geri döner ve `(d_model, d_model)` şeklindeki öğrenilmiş çıktı matrisi `W_o` ile çarpılır. `W_o` kafaların karıştığı yerdir.

**Neden işe yarıyor?** Her head, temsili bütçe için diğerleriyle rekabet etmeden uzmanlaşabilir. 2019-2024 arasındaki araştırma çalışmaları farklı kafa rollerini göstermektedir: konumsal kafalar, önceki token ile ilgilenen kafa, kopya kafalar, adlandırılmış varlık kafaları, tümevarım kafaları (bağlam içi öğrenmenin temelini oluşturan).

**2026'daki varyasyonların kökeni:**

| Varyant | Q kafaları | K/V kafaları | Kullanan |
|---------|---------|-----------|---------|
| Çok kafalı (MHA) | N | N | GPT-2, BERT, T5 |
| Çoklu Sorgu (MQA) | N | 1 | PaLM, Falcon |
| Gruplandırılmış sorgu (GQA) | N | G (e.g. N/8) | Llama 2 70B, Llama 3+, Qwen 2+, Mistral |
| Çok kafalı gizli (MLA) | N | düşük seviyeye sıkıştırılmış | DeepSeek-V2, V3 |

GQA modern varsayılandır çünkü KV-cache belleğini neredeyse tam kaliteyi korurken `N/G` faktörü kadar keser. MLA, K/V'yi gizli bir alana sıkıştırıp ardından hesaplama süresine geri yansıtarak daha da ileri gider; FLOP'lara mal olur ve çok daha fazla bellek tasarrufu sağlar.

```figure
multihead-split
```

## Build It — Kendin Oluştur

### 1. Adım: Zaten sahip olduğumuz tek kafalı dikkatten kafaları ayırın

Ders 02'den `SelfAttention`'yi alın ve onu bölünmüş/birleştirilmiş bir çiftle sarın. Numpy uygulaması için bkz. `code/main.py`; mantık şudur:

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)  # (heads, n, d_head)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

Bir yeniden şekillendirme ve bir devriklik. Döngü yok. PyTorch'un `nn.MultiheadAttention` kapsamında yaptığı da tam olarak budur.

### Adım 2: her head için scaled dot-product attention'ı çalıştırın

Her kafa kendi Q, K, V dilimini alır. Dikkat toplu bir matmul haline gelir:

```python
def mha_forward(X, W_q, W_k, W_v, W_o, n_heads):
    Q = X @ W_q
    K = X @ W_k
    V = X @ W_v
    Qh = split_heads(Q, n_heads)         # (heads, n, d_head)
    Kh = split_heads(K, n_heads)
    Vh = split_heads(V, n_heads)
    scores = Qh @ Kh.transpose(0, 2, 1) / np.sqrt(Qh.shape[-1])
    weights = softmax(scores, axis=-1)
    out = weights @ Vh                    # (heads, n, d_head)
    concat = combine_heads(out)
    return concat @ W_o, weights
```

Gerçek donanımda `Qh @ Kh.transpose(...)` bir `bmm`'dir. GPU, `(heads, N, d_head) × (heads, d_head, N) -> (heads, N, N)` şeklindeki tek bir toplu matmul'u görüyor. Başlık eklemek ücretsizdir.

### Adım 3: Gruplandırılmış Sorgu Dikkat çeşidi

Yalnızca anahtar ve değer projeksiyonları değişir. Q, `n_heads` grup alır; K ve V, `n_kv_heads < n_heads` grup alır ve eşleşecek şekilde tekrarlanır:

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)       # (kv_heads, n, d_head)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)      # (n_heads, n, d_head)
```

inference sırasında bu, bellekten tasarruf sağlar çünkü KV önbelleğinde `n_heads` değil, yalnızca `n_kv_heads` kopya bulunur. Llama 3 70B, 8 KV kafalı 64 sorgu kafası kullanır - 8 kat önbellek küçültme.

### 4. Adım: Her bir kafanın ne öğrendiğini araştırın

MHA'yı 4 başlı kısa bir cümleyle çalıştırın. Her kafa için `(N, N)` dikkat matrisini yazdırın. Rastgele başlatma durumunda bile farklı kafaların farklı yapıları seçtiğini göreceksiniz; bu kısmen sinyal, kısmen de alt uzaylardaki dönme simetrisidir.

## Use It — Uygula

PyTorch'ta tek satırlı sürüm:

```python
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
```

PyTorch 2.5+ sürümünden itibaren GQA:

```python
from torch.nn.functional import scaled_dot_product_attention

# scaled_dot_product_attention auto-dispatches Flash Attention on CUDA.
# For GQA, pass Q of shape (B, n_heads, N, d_head) and K,V of shape
# (B, n_kv_heads, N, d_head). PyTorch handles the repeat.
out = scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)
```

**Kaç kafa?** 2026'daki üretim modellerine ilişkin temel kurallar:

| Model boyutu | d_model | n_heads | d_head |
|------------|---------|---------|--------|
| Küçük (~125M) | 768 | 12 | 64 |
| Baz (~350M) | 1024 | 16 | 64 |
| Büyük (~1B) | 2048 | 16 | 128 |
| Sınır (~70B) | 8192 | 64 | 128 |

`d_head` neredeyse her zaman 64 veya 128'e ulaşır. Bu, bir kafanın ne kadar "görebildiğinin" birimidir. 32'nin altına düştüğünde kafalar `sqrt(d_head)` ölçeklendirme faktörüyle mücadele etmeye başlar; 256'nın üzerine çıkarsanız "birçok küçük uzman" avantajını kaybedersiniz.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-mha-configurator.md`. Beceri, yeni bir transformer parametre bütçesi, dizi uzunluğu ve deployment hedefi için kafa sayısını, kv-head sayısını ve projeksiyon stratejisini önerir.

## Egzersizler

1. **Kolay.** `code/main.py`'dan MHA'yı alın ve `n_heads`'yi 1'den 16'ya, `d_model=64` sabit olarak değiştirin. Sentetik bir kopyalama görevinde küçük tek katmanlı bir modelin kaybını çizin. Daha fazla kafa işe yarar mı, dengelenir mi, yoksa performansı düşürür mü?
2. **Orta.** MQA'yı uygulayın (tüm sorgu kafaları arasında paylaşılan bir KV kafası). Tam MHA'ya kıyasla parametre sayısının ne kadar düştüğünü ölçün. N=2048 için inference noktasında KV önbellek boyutunun ne kadar küçüldüğünü hesaplayın.
3. **Zor.** Çok Kafalı Gizli Dikkatin küçük bir versiyonunu uygulayın: K,V'yi düşük rank'li bir latent temsile (`r`) sıkıştırın, gizli olanı KV önbelleğinde saklayın, dikkat zamanında sıkıştırmayı açın. Kalite, doğrulama ppl'sinin 1 biti dahilinde kalırken, önbellek hangi `r`'de tam MHA'nın 1/8'inin altına geçer?

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Kafa | "Tek bir dikkat devresi" | `d_head = d_model / n_heads` boyutunun kendi dikkat matrisine sahip bir Q/K/V projeksiyonu. |
| d_head | "Kafa boyutu" | Kafa başına gizli genişlik; üretimde neredeyse her zaman 64 veya 128. |
| Böl / birleştir | "Yeniden şekillendirme püf noktaları" | `(N, d_model) ↔ (n_heads, N, d_head)` dikkatin etrafında yeniden şekil verir+değiştirir. |
| W_o | "Çıktı projeksiyonu" | Başlıkları birleştirdikten sonra uygulanan `(d_model, d_model)` matrisi; kafaların karıştığı yer. |
| MQA | "Bir KV kafası" | Çoklu Sorgu Dikkati: tek paylaşımlı K/V projeksiyonu. En küçük KV önbelleği, bir miktar kalite kaybı. |
| GQA | "Llama 2'den bu yana varsayılan" | `n_kv_heads < n_heads` ile Gruplandırılmış Sorgu Dikkati; Q ile eşleşmek için tekrarlanır. |
| MLA | "DeepSeek'in numarası" | Çok Kafalı Gizli Dikkat: K,V düşük dereceli gizli olarak sıkıştırılır, attention sırasında açılır. |
| İndüksiyon kafası | "Bağlam içi öğrenmenin arkasındaki devre" | Önceki olayları tespit eden ve ardından gelenleri kopyalayan bir çift kafa. |

## Daha Fazla Okuma

- [Vaswani ve ark. (2017). İhtiyacınız Olan Tek Şey Dikkat §3.2.2](https://arxiv.org/abs/1706.03762) — orijinal çok kafalı spesifikasyon.
- [Shazeer (2019). Hızlı Transformer Kod Çözme: İhtiyacınız Olan Tek Şey Bir Yazma Kafası](https://arxiv.org/abs/1911.02150) — MQA makalesi.
- [Ainslie ve ark. (2023). GQA: Çok Başlı Kontrol Noktalarından Genelleştirilmiş Çoklu Sorgu Transformer Modellerinin Eğitimi](https://arxiv.org/abs/2305.13245) — eğitimden sonra MHA'nın GQA'ya nasıl dönüştürüleceği.
- [DeepSeek-AI (2024). DeepSeek-V2 Teknik Raporu](https://arxiv.org/abs/2405.04434) — MLA ve önbellekte MHA/GQA'yı neden geride bıraktığı.
- [Olsson ve ark. (2022). Bağlam İçi Öğrenme ve Tümevarım Kafaları](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html) — kafaların gerçekte ne yaptığına mekanik bir bakış.
