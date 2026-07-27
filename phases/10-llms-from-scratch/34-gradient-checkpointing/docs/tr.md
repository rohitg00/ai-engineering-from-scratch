# Gradient Kontrol Noktası Belirleme ve Aktivasyon Yeniden Hesaplaması

> Backprop her ara aktivasyonu korur. 70B parametre ve 128K bağlamda, sıralama başına 3 TB etkinleştirme anlamına gelir. Kontrol noktası oluşturma, bellek için FLOP'ları değiştirir: kaydetmek yerine yeniden hesaplayın. Soru hangi segmentlerin bırakılacağıdır ve cevap "hepsi" değildir.

**Tür:** Yapım
**Diller:** Python (numpy ile, isteğe bağlı meşale)
**Önkoşullar:** Aşama 10 Ders 04 (Eğitim Öncesi Mini-GPT), Aşama 10 Ders 05 (Ölçeklendirme ve Dağıtılmış)
**Süre:** ~70 dakika

## Sorun

Bir transformer eğitimi, her katman için geriye doğru farklılaşan her operasyonun girdilerini saklar: dikkat girdileri, Q/K/V projeksiyonları, softmax çıktısı, FFN girdileri, norm çıktıları ve artık akış. Gizli boyutu `d`, dizi uzunluğu `L`, toplu `B` olan bir katman için bu, katman başına `12 * B * L * d` kayan sırasına göredir.

`d=8192, L=8192, B=1` için bu, BF16'da 800 MB/katmandır. 64 katmanlı bir model, 51 GB'lik aktivasyon anlamına gelir - ve bu, mikro toplu boyutla çarpmadan önce, dikkat-softmax ara öğelerini (kafa başına `L^2`) eklemeden önce ve tensör-paralel kısmi kopyaları çarpanlarına ayırmadan öncedir.

İki taraflı fatura: BF16 ağırlıkları artı optimize edici durumu 80 GB'a sığabilir, ancak aktivasyonlar sizi geçmeye zorlar. Gradient kontrol noktası oluşturma (diğer adıyla etkinleştirme yeniden hesaplaması) standart düzeltmedir. Çoğu aktivasyonu bırakın; geri almak için geri giderken ileriyi yeniden yapın. Maliyet: ekstra FLOP'lar. Faydası: Bellek, kontrol noktası bölümlerinin toplam katmanlara oranı kadar azalır.

Saf bir şekilde yapıldığında kontrol noktası oluşturma, adım başına kabaca %33 daha fazla ileri geçiş FLOP'una mal olur. İyi yapıldı - Korthikanti ve diğerlerinin "akıllı seçimi" uyarınca seçici kontrol noktası oluşturma. — %5 FLOP ek yükünün altında 5 kat bellek tasarrufu sağlarsınız. Ve FP8 matmul'ları, FSDP aktarımı ve uzman-paralel MoE ile bu gerçekten önemlidir: ne belleği ne de boşa giden bilgi işlem miktarını karşılayamazsınız.

## Konsept

### Geriye Doğrunun Aslında İhtiyaç Duyduğu Şey

`output = layer(input)`. Geriye doğru `grad_input` ve `grad_params` istiyor. Bunları hesaplamak için şunlara ihtiyaç vardır:

- `input` (doğrusal katmanlar için `grad_params = input.T @ grad_output`'yi hesaplamak için)
- bazı aktivasyon türevi ara ürünleri (ReLU/GELU/softmax'ın türevi aktivasyon değerine bağlıdır)

İleri geçiş bunları otomatik olarak otograd grafiğinde saklar. Girişine ihtiyaç duyan her `tensor.retain_grad()` ve her operasyon bir referansı tutar.

### Naif Tam Kontrol Noktalama

Ağı `N` segmente bölün. İletme sırasında her segmente yalnızca *girdiyi* depolayın. Geriye doğru ara öğelere ihtiyaç duyulduğunda, bunları gerçekleştirmek için bölümün ileri geçişini yeniden çalıştırın ve ardından farklılaştırın.

Örnek: 32 katmanlı transformer, her biri 1 katmandan oluşan 32 bölüme ayrılmıştır.

- Bellek: 32 katman girişi (küçük) vs 32 * (katman başına etkinleştirme hacmi) (çok büyük).
- Ekstra hesaplama: segment başına 1 ekstra ileri, i.e., ~%33 daha fazla ileri FLOP toplamı (geriye doğru 2x ileri olduğundan, tam adım 1 + 2 = 3 yerine 1 + 1 + 2 = 4 birim olur).

Bu orijinal Chen ve ark. 2016 tarifi: Bellek ve hesaplamayı dengelemek için her `sqrt(L)` katmanda bir kontrol noktası. L=64 için bu 8 kontrol noktasıdır.

### Seçici Kontrol Noktası (Korthikanti 2022)

Tüm aktivasyonların maliyeti aynı değildir. Dikkat softmax çıkışı `B*L*L*heads`'dır ve dizi uzunluğuyla birlikte *ikinci dereceden* büyür. FFN gizli aktivasyonu `B*L*4d`'dur ve doğrusal olarak büyür. Uzun diziler için softmax hakimdir.

Seçici kontrol noktası, depolaması ucuz olan aktivasyonları (doğrusal projeksiyonlar, artıklar) korur ve yalnızca pahalı olanları (dikkat) yeniden hesaplar. Yeniden hesaplamak için minimum FLOP ödersiniz ancak O(L^2) belleğini kaydedersiniz.

Megatron-Core bunu "seçici" aktivasyon yeniden hesaplaması olarak uygular. 2024+ sınır eğitim çalışmalarının çoğunda kullanıldı.

### Boşaltma

Yeniden hesaplamaya alternatif: etkinleştirmeleri ileri ve geri arasında CPU RAM'e gönderin. PCIe bant genişliği gerektirir; boşta kalan bant genişliği yeniden materyalleştirme maliyetini aştığında faydalıdır. Karma stratejiler yaygındır: bazı katmanları kontrol edin, diğerlerinin yükünü boşaltın.

FSDP2, boşaltmayı birinci sınıf bir seçenek olarak sunar. GPU bellekte darboğaz olduğunda yük aktarımı öne çıkar ancak CPU-GPU aktarımında boşluk vardır.

### Maliyet Modelini Yeniden Hesaplayın

`L` dışında her `k` katmanın saf kontrol noktasına sahip adım başına FLOP'lar:

```
flops_fwd_normal = L * f_layer
flops_bwd_normal = 2 * L * f_layer
flops_total_normal = 3 * L * f_layer

flops_fwd_ckpt = L * f_layer
flops_recompute = L * f_layer  # one extra forward per layer in the segment
flops_bwd_ckpt = 2 * L * f_layer
flops_total_ckpt = 4 * L * f_layer
overhead = 4 / 3 - 1 = 0.33 = 33%
```

Seçici kontrol noktasıyla tüm katmanı değil yalnızca dikkat çekirdeğini yeniden hesaplarsınız:

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### Bellek Tasarruf Modeli

Katman başına etkinleştirme hacmi: `A`. `L` katman için toplam etkinleştirme belleği: `L * A`.

Tam kontrol noktası (segment boyutu 1): yalnızca `L * input_volume` (standart bir transformer için ~`L * 1/10 A`) depolayın. ~`9 * L * A * 1/10` kaydeder.

Her `k` katmanı kontrol edin: `L/k * A` artı `k-1` katmanın değerini aktif segment içinde saklayın.

`k = sqrt(L)` noktasında, bellek ve yeniden hesaplama maliyetinin her ikisi de `sqrt(L)` ile ölçeklenir; bu, tekdüze maliyetli katmanlar için en uygun dengedir.

### Kontrol Noktasına Ne Zaman Gidilmemeli

- Boru hattı aşamasının en içteki katmanları halihazırda uçuş halindedir. Zaten bitirmeleri lazım.
- Sahne alanının hesaplamasına hakim olmaları durumunda ilk ve son katmanlar (transformers içinde nadirdir).
- Dikkat çekirdekleri zaten FlashAttention kullanıyor - Flash zaten softmax'ı hızlı bir şekilde yeniden hesaplıyor, bu nedenle ek katman düzeyinde kontrol noktası eklemenin üstüne çok az şey ekleniyor.

### Uygulama Modelleri

1. **İşlev sarmalayıcı:** `torch.utils.checkpoint.checkpoint(fn, input)` içine bir segment sarın. PyTorch yalnızca `input`'yi saklar, geri kalan her şeyi geriye doğru yeniden hesaplar.

2. **Dekoratör tabanlı:** katmanları kontrol noktası olarak işaretlenebilir; eğitmen yapılandırma sırasında hangi bölümlerin sarılacağına karar verir.

3. **Manuel açık yeniden hesaplama:** İleri geçişi depolanan girişle kopyalayan özel bir `recompute_forward` çağırarak geri geçişi kendiniz yazın.

Üçü de aynı işlevsel sonucu verir. Sarmalayıcılar standart deyimdir.

### TP / PP / FP8 ile etkileşim

- **Tensör paralel:** kontrol noktası girdileri yeniden hesaplama sırasında toplanmalı veya yeniden dağıtılmalıdır; iletişim maliyetini yönetin.
- **Ardışık düzen paralel:** tipik model, ters sıralı mikro partilerin etkinleştirme belleğini yeniden kullanabilmesi için her ardışık düzen aşamasının ilerisini kontrol noktasıdır.
- **FP8 yeniden hesaplama:** Yeniden hesaplama sırasında güncellenen amax geçmişleri, orijinal ileridekilerle veya FP8 ölçek sapmalarıyla eşleşmelidir. Çoğu frameworks ölçeğin anlık görüntüsünü alır.

## İnşa Et

### Adım 1: Parçalı Bir Oyuncak Modeli

```python
import numpy as np


def linear_forward(x, w, b):
    return x @ w + b


def relu(x):
    return np.maximum(x, 0)


def layer_forward(x, w1, b1, w2, b2):
    h = relu(linear_forward(x, w1, b1))
    return linear_forward(h, w2, b2)


def model_forward(x, params):
    activations = [x]
    h = x
    for w1, b1, w2, b2 in params:
        h = layer_forward(h, w1, b1, w2, b2)
        activations.append(h)
    return h, activations
```

### Adım 2: Tüm Aktivasyonlara İhtiyaç Duyan Saf Geriye Dönük

```python
def model_backward(grad_output, activations, params):
    grads = [None] * len(params)
    g = grad_output
    for i in range(len(params) - 1, -1, -1):
        w1, b1, w2, b2 = params[i]
        x_in = activations[i]
        h_pre = linear_forward(x_in, w1, b1)
        h = relu(h_pre)
        gh = g @ w2.T
        gw2 = h.T @ g
        gb2 = g.sum(axis=0)
        g_pre = gh * (h_pre > 0)
        gx = g_pre @ w1.T
        gw1 = x_in.T @ g_pre
        gb1 = g_pre.sum(axis=0)
        grads[i] = (gw1, gb1, gw2, gb2)
        g = gx
    return g, grads
```

### Adım 3: Her K Bellekte Kontrol Noktası

```python
def model_forward_checkpointed(x, params, k=4):
    saved_inputs = [x]
    h = x
    for i, (w1, b1, w2, b2) in enumerate(params):
        h = layer_forward(h, w1, b1, w2, b2)
        if (i + 1) % k == 0:
            saved_inputs.append(h)
    return h, saved_inputs


def model_backward_checkpointed(grad_output, saved_inputs, params, k=4):
    grads = [None] * len(params)
    g = grad_output
    segments = [(j * k, min((j + 1) * k, len(params))) for j in range(len(saved_inputs))]
    for seg_idx in range(len(saved_inputs) - 1, -1, -1):
        start, end = segments[seg_idx]
        if start >= end:
            continue
        x_in = saved_inputs[seg_idx]
        _, seg_acts = model_forward(x_in, params[start:end])
        g, seg_grads = model_backward(g, seg_acts, params[start:end])
        for j, gr in enumerate(seg_grads):
            grads[start + j] = gr
    return g, grads
```

### Adım 4: Maliyet Modeli

```python
def checkpoint_cost(n_layers, segment_size, flops_per_layer=1.0):
    fwd = n_layers * flops_per_layer
    recompute = n_layers * flops_per_layer
    bwd = 2 * n_layers * flops_per_layer
    return {
        "fwd": fwd,
        "recompute": recompute,
        "bwd": bwd,
        "total": fwd + recompute + bwd,
        "overhead_vs_no_ckpt": (fwd + recompute + bwd) / (fwd + bwd) - 1.0,
    }


def selective_checkpoint_cost(n_layers, attention_fraction=0.15,
                              flops_per_layer=1.0):
    fwd = n_layers * flops_per_layer
    recompute = n_layers * attention_fraction * flops_per_layer
    bwd = 2 * n_layers * flops_per_layer
    return {
        "fwd": fwd,
        "recompute": recompute,
        "bwd": bwd,
        "total": fwd + recompute + bwd,
        "overhead_vs_no_ckpt": (fwd + recompute + bwd) / (fwd + bwd) - 1.0,
    }
```

### Adım 5: Bellek Tahmincisi

```python
def activation_memory_mb(n_layers, hidden=8192, seq=8192,
                        batch=1, bytes_per_value=2):
    per_layer = 12 * batch * seq * hidden * bytes_per_value
    return n_layers * per_layer / 1e6


def memory_after_checkpoint(n_layers, segment_size, hidden=8192,
                           seq=8192, batch=1, bytes_per_value=2):
    n_seg = max(1, n_layers // segment_size)
    saved = (n_seg + segment_size) * 1 * batch * seq * hidden * bytes_per_value
    return saved / 1e6
```

### Adım 6: Optimum Segment Boyutu

```python
def optimal_segment(n_layers):
    return int(round(np.sqrt(n_layers)))
```

### Adım 7: Seçici Kontrol Noktası Kararı

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## Kullan onu

- **torch.utils.checkpoint**: `from torch.utils.checkpoint import checkpoint` — PyTorch'taki standart sarmalayıcı. Bir işlevi sarar; yalnızca girdileri saklar, geriye doğru yeniden hesaplar.
- **Megatron-Çekirdek aktivasyonunun yeniden hesaplanması**: `selective`, `full` ve `block` modlarını destekler. 2024+ sınır eğitiminde standart.
- **FSDP2 boşaltma**: FSDP2'deki `offload_policy` ile `module.to_empty(device="cpu")`, yeniden hesaplama yerine CPU'ya aktivasyonları gerçekleştirir.
- **DeepSpeed ​​Zero-Offload**: Optimize edici durumlar ve aktivasyonlar için kontrol noktası oluşturmayı tamamlayan CPU boşaltma.

## Gönderin

Bu ders, model yapılandırmanızı (katmanlar, gizli, sıra, toplu) ve kullanılabilir GPU belleğini alan ve katman başına bir yeniden hesaplama politikası (yok / seçici / tam / boşaltma) yayan bir `outputs/prompt-activation-recompute-policy.md` — bir prompt üretir.

## Egzersizler

1. Doğruluğunu doğrulayın. `model_forward` + `model_backward` (tam aktivasyonlar) ve `model_forward_checkpointed` + `model_backward_checkpointed` (segmentler) komutunu çalıştırın. Parametre gradient'ler makine hassasiyetiyle aynı olmalıdır.

2. Segment boyutunu `k` 1'den `L`'ye kadar tarayın. FLOP yükünü ve belleği çizin. Eğrinin dizini bulun.

3. Seçici kontrol noktası oluşturmayı uygulayın: dikkat modülü girdisini saklayın, ancak ara öğelerini değil. Seq=8192'de 32 katmanlı bir model için FLOP yükünü ve tam katman kontrol noktasını ölçün.

4. Boşaltma ekleyin. Segment girişlerini simüle edilmiş bir "CPU arabelleğine" (ayrı bir liste) kaydedin. "PCIe bant genişliğini" bayt/zaman olarak ölçün ve boşaltma ile yeniden hesaplama arasındaki başabaş noktasını bulun.

5. Gerçek bir PyTorch transformer’ı `torch.utils.checkpoint` kullanarak ve kullanmadan benchmark edin. Belleği (`torch.cuda.max_memory_allocated` aracılığıyla) ve adım süresini ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Gradient kontrol noktası | "İleriye giderek bellekten tasarruf edin" | Yalnızca segment girişlerini saklayın; gradient-destek tensörlerini elde etmek için geriye doğru ara öğeleri yeniden hesaplayın |
| Aktivasyon yeniden hesaplaması | "Kontrol noktası oluşturmayla aynı" | Aynı tekniğin HPC aromalı adı |
| Segment boyutu (k) | "Kontrol noktası başına kaç katman" | Ara maddeleri birlikte bırakılan ve yeniden maddeleştirilen katman sayısı |
| Seçici kontrol noktası oluşturma | "Korthkanti'nin numarası" | Yalnızca saklaması pahalı olan etkinleştirmeleri yeniden hesaplayın (softmax'a dikkat); ucuz olanları saklayın |
| Tam kontrol noktası belirleme | "Saf versiyon" | Her segmentteki her katmanın ara ürünlerini yeniden hesaplayın |
| Denetim noktalarını engelle | "İri taneli" | Kontrol noktasının tamamı transformer blok; en büyük ayrıntı düzeyi |
| FLOP yükü | "Hesaplama vergisi" | Adım başına ekstra FLOP'lar = (FLOP'ları yeniden hesapla) / (ileri + arka FLOP'lar); %33 saf, %5 seçici |
| Aktivasyon boşaltma | "CPU'ya Gönder" | Aktivasyonları ileri->geri boyunca CPU RAM'e taşıyın; yeniden hesaplamaya alternatif |
| sqrt-L kuralı | "Klasik optimum" | Tekdüze maliyetli katmanlar için en uygun kontrol noktası aralığı sqrt(L) katmanlardır |
| Dikkat-softmax hacmi | "O(L^2) sorunu" | L^2 * kafalar * parti yüzer; uzun bağlamlarda aktivasyon belleğine hakim |

## Daha Fazla Okuma

- [Chen ve diğerleri, 2016 -- "Alt Doğrusal Bellek Maliyeti ile Derin Ağların Eğitimi"](https://arxiv.org/abs/1604.06174) -- gradient kontrol noktasını resmileştiren orijinal makale
- [Korthikanti ve diğerleri, 2022 -- "Büyük Transformer Modellerinde Aktivasyon Yeniden Hesaplamasının Azaltılması"](https://arxiv.org/abs/2205.05198) -- seçici aktivasyon yeniden hesaplaması ve resmi maliyet analizi
- [Pudipeddi ve diğerleri, 2020 -- "Yeni Bir Yürütme Algoritması Kullanarak Büyük Neural Network'leri Sabit Bellekle Eğitmek"](https://arxiv.org/abs/2002.05645) -- ters mod yeniden materyalleştirme yoluyla alternatif sabit bellek yaklaşımı
- [Ren ve diğerleri, 2021 -- "Sıfır Boşaltma: Milyar Ölçekli Model Eğitiminin Demokratikleştirilmesi"](https://arxiv.org/abs/2101.06840) -- geniş ölçekte etkinleştirme boşaltma
- [PyTorch torch.utils.checkpoint dokümanları](https://pytorch.org/docs/stable/checkpoint.html) -- standart API
- [Megatron-Çekirdek etkinleştirme yeniden hesaplama belgeleri](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) -- seçici, tam ve blok modları
