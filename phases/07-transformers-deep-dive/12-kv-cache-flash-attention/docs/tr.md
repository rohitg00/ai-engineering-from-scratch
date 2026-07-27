# KV Önbellek, Flash Dikkati ve Inference Optimizasyonu

> Eğitim paraleldir ve FLOP'a bağlıdır. Inference seridir ve belleğe bağlıdır. Farklı darboğaz, farklı hileler.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 02 (Self-Attention), Aşama 7 · 05 (Tam Transformer), Aşama 7 · 07 (GPT)
**Süre:** ~75 dakika

## Sorun

Saf bir otoregresif kod çözücü, `O(N²)` `N` token'ler oluşturmak için çalışır: her adımda dikkati tam önek üzerinden yeniden hesaplar. 16M dikkat operasyonu olan 4K-token yanıtı için çoğu gereksizdir. Bir token önekinin her gizli durumu, hesaplandıktan sonra deterministiktir; yalnızca yeni token sorgusunu daha önce her şeyin önbelleğe alınmış anahtarlarına ve değerlerine karşı çalıştırmanız gerekir.

Üstelik dikkatin kendisi de pek çok veriyi taşır. Standart dikkat N×N puan matrisini, N×d softmax çıktısını, N×d son çıktıyı hayata geçirir; yani HBM'de çok fazla okuma ve yazma vardır. N≥2K için dikkat, FLOP'a bağlı hale gelmeden önce belleğe bağlı hale gelir. Klasik dikkat çekirdekleri, modern GPU'ları 4 ila 10 kat daha az kullanıyor.

Her ikisi de Dao ve diğerlerinin yaptığı iki optimizasyon, inference sınırını "yavaş"tan "hızlı"ya itti:

1. **KV önbelleği.** Her token önekinin K ve V vektörlerini saklayın. Her yeni token'nin dikkati, önbelleğe alınmış anahtarlara yönelik bir sorgudur. Inference, nesil adımı başına `O(N²)`'dan `O(N)`'ye düşer.
2. **Flaş Dikkat.** Dikkat hesaplamasını, N×N matrisinin tamamı HBM'ye asla ulaşmayacak şekilde döşeyin. Softmax + matmul işlemlerinin tümü SRAM'de gerçekleşir. A100'de 2–4 kat duvar saati hızlandırması; FP8 ile H100'de 5–10×.

2026'ya gelindiğinde her ikisi de evrensel olacak. Her üretim inference yığını (vLLM, TensorRT-LLM, SGLang, llama.cpp) bunları varsayar. Her sınır modeli Flash Attention etkinleştirilmiş olarak gönderilir.

## Konsept

![KV önbellek büyümesi ve Flash Attention döşemesi](../assets/kv-cache-flash-attn.svg)

### KV önbellek matematiği

Kod çözücü katmanı başına, token başına, kafa başına:

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

32 katmanlı, 32 başlı, d_head=128, fp16'lı bir 7B modeli için:

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

Llama 3 70B için (80 katman, d_head=128, 8 KV kafalı GQA):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

Bu 10 GB, 128K bağlamında Llama 3 70B'nin yalnızca parti boyutu 1'deki KV önbellek için 40 GB A100'ün çoğuna ihtiyaç duymasının nedenidir.

**GQA, KV önbellek kazancıdır.** 64 başlı MHA, 32 GB olacaktır. MLA daha da sıkıştırılır.

Boyutları sürükleyin ve önbellek boyutunun hareketini izleyin. Sıra uzunluğunu veya toplu işlemi artırın ve tek bir GPU'yu ne kadar hızlı geçtiğini görün:

```figure
kv-cache-sizer
```

### Flash Attention — döşeme hilesi

Standart dikkat:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

Üç HBM gidiş-dönüş. H100'de HBM bant genişliği 3 TB/s'dir; SRAM 30 TB/s'dir. Her HBM yolculuğu, her şeyin çip üzerinde tutulmasına karşılık 10 kat yavaşlama anlamına gelir.

Flaş Dikkat:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

Parça başına bir HBM gezisi. Toplam bellek alanı `O(N²)`'dan `O(N)`'ye düşüyor. Geriye doğru geçiş, bazı değerleri depolamak yerine ileri geçişten yeniden hesaplar; başka bir hafıza kazanımı.

**Sayısal hile.** Softmax'ı çalıştırmak, döşemeler arasında `(max, sum)` değerini korur, böylece son normalleştirme tam olur. Yaklaşık bir tahmin değil — Flash Attention, standart dikkat (modülo fp16 ilişkisel olmayan) ile bit-özdeş çıktıyı hesaplar.

**Sürüm gelişimi:**

| Sürüm | Yıl | Anahtar değişikliği | Referans donanımında hızlanma |
|---------|------|-----------|-------------------------------|
| Flaş 1 | 2022 | Döşemeli SRAM çekirdeği | A100'de 2× |
| Flaş 2 | 2023 | Daha iyi paralellik, nedensel öncelikli sıralama | A100'de 3× |
| Flaş 3 | 2024 | Hazne eşzamansızlığı, FP8 | H100'de 1,5–2× (~740 TFLOPs FP16) |
| Flaş 4 | 2026 | Blackwell 5 aşamalı ardışık düzen, yazılım exp2 | Inference-ilk (yalnızca başlangıçta ilet) |

Flash 4 yalnızca başlatma sırasında ileri geçişlidir. Eğitimde hâlâ Flash 3 kullanılıyor. Flash 4 için GQA ve varlen desteği beklemede (2026 ortası).

### Spekülatif kod çözme — diğer gecikme kazanır

Ucuz model N token önermektedir. Büyük model tüm N'yi paralel olarak doğrular. Doğrulama k tokens'yi kabul ederse, k nesil için 1 büyük model ileri geçiş ödemiş olursunuz. Kod ve düzyazıda tipik k=3–5.

2026 varsayılanları:
- **EAGLE 2 / Medusa.** Doğrulayıcının gizli durumlarını paylaşan entegre taslak kafaları. Kalite kaybı olmadan 2–3 kat hızlanma.
- **Taslak modelle spekülatif kod çözme.** Tüketici donanımında 2–4 ​​kat hızlanma.
- **Önleme kod çözme.** Jacobi yinelemesi; taslak modele gerek yok. Niş ama ücretsiz.

### Sürekli toplu işlem

Klasik toplu inference: en yavaş sıranın bitmesini bekleyin, ardından yeni bir grup başlatın. Kısa yanıtlar erken tamamlandığında GPU'yu boşa harcar.

Sürekli gruplama (ilk olarak Orca'da gönderildi, şimdi vLLM, TensorRT-LLM, SGLang'da): eski istekler biter bitmez yeni istekleri gruba aktarın. Tipik sohbet iş yükleri için 5–10 kat verim artışı.

### PagedAttention — sanal bellek olarak KV önbellek

vLLM'nin başlık özelliği. KV önbelleği 16-token blok halinde tahsis edilmiştir; sayfa tablosu mantıksal konumları fiziksel bloklarla eşleştirir. KV'yi paralel örnekler (ışın arama, paralel örnekleme), prompt önbelleğe alma için çalışırken değiştirilebilir önekler ve belleği birleştirme arasında paylaşmanıza olanak tanır. Basit bitişik tahsise kıyasla 4 kat verim artışı.

```figure
flash-attention-memory
```

## Build It — Kendin Oluştur

Bkz. `code/main.py`. Biz uyguluyoruz:

1. Saf bir `O(N²)` artımlı kod çözücü.
2. `O(N)` KV önbelleğe alınmış kod çözücü.
3. Flash Attention'ın maksimum çalışma algoritmasını simüle eden döşemeli bir softmax.

### Adım 1: KV önbelleği

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

Basit: Katman başına, kafa başına listelerde -token K, V vektörü başına büyümeye devam edin.

### Adım 2: döşenmiş softmax

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

Tek seferde `softmax(qK) V`'ya bit-özdeş çıktı, ancak herhangi bir zamanda çalışma kümesi tam `N × d_head` değil, bir `tile × d_head` bloğudur.

### 3. Adım: 100-token nesilde saf ve önbelleğe alınmış kod çözmeyi karşılaştırın

Dikkat işlemlerini sayın. Naif: `O(N²)` = 5050. Önbelleğe alınmış: `O(N)` = 100. Kod her ikisini de yazdırır.

## Use It — Uygula

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

vLLM üretimi:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

İstekler arasında önek önbelleğe alma, 2026'nın büyük bir kazanımıdır; aynı sistem prompt, az sayıda örnek veya uzun bağlam belgesi, çağrılar arasında KV'yi yeniden kullanır. Tekrarlanan prompt araçlarına sahip agent iş yükleri için, önek önbelleğe alma rutin olarak 5 kat verim kazancı sağlar.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-inference-optimizer.md`. Beceri, yeni bir inference deployment için dikkat uygulamasını, KV önbellek stratejisini, nicelemeyi ve spekülatif kod çözmeyi seçer.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. Saf ve önbelleğe alınmış kod çözücülerin aynı çıktıyı ürettiğini doğrulayın; işlem sayısı farkına dikkat edin.
2. **Orta.** Önek önbelleğe almayı uygulayın: prompt P ve birkaç tamamlama verildiğinde, KV önbelleğini doldurmak için P üzerinden bir ileri geçiş çalıştırın, ardından tamamlama başına dallanma yapın. Her biri için hızlanma ve yeniden kodlama P'yi ölçün.
3. **Zor.** Serbest listeli sabit 16-token blokta bir oyuncak PagedAttention: KV önbelleği uygulayın. Bir dizi bittiğinde bloklarını havuza geri koyun. Farklı uzunluklarda 1.000 sohbet tamamlamasını simüle edin. Bellek parçalanmasını bitişik ayırmayla karşılaştırın.

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| KV önbelleği | "Kod çözmeyi hızlandıran püf noktası" | Her token önekinden K ve V depolanır; yeniden hesaplamak yerine yeni sorgular onlara katılır. |
| HBM | "GPU ana belleği" | Yüksek Bant Genişliğine Sahip Bellek; H100'de 80 GB, B200'de 192 GB. ~3 TB/s bant genişliği. |
| SRAM | "Çip üzerinde bellek" | SM başına hızlı bellek, H100'de SM başına ~256 KB. ~30 TB/s bant genişliği. |
| Flaş Dikkati | "Döşenmiş dikkat çekirdeği" | HBM'de N×N'yi gerçekleştirmeden dikkati hesaplar. |
| Sürekli gruplama | "Beklemesiz toplu işlem" | Partiyi boşaltmadan bitmiş dizileri değiştirin, yenilerini ekleyin. |
| PagedDikkat | "vLLM'nin başlığı" | Sayfa tablosuyla sabit bloklara ayrılmış KV önbelleği; parçalanmayı ortadan kaldırır. |
| Önek önbelleğe alma | "Uzun prompt'ları yeniden kullan" | İstekler arasında paylaşılan bir önek için KV'yi önbelleğe alın; agents için büyük maliyet kesintisi. |
| Spekülatif kod çözme | "Taslak + doğrula" | Ucuz taslak model token'leri önerir; büyük model k'yi tek geçişte doğrular. |

## Daha Fazla Okuma

- [Dao ve ark. (2022). FlashAttention: GÇ Farkındalığıyla Hızlı ve Bellek Açısından Verimli Tam Dikkat](https://arxiv.org/abs/2205.14135) — Flash 1.
-[Dao (2023). FlashAttention-2: Daha İyi Paralellik ve İş Bölümlendirmeyle Daha Hızlı Dikkat](https://arxiv.org/abs/2307.08691) — Flash 2.
- [Şah ve ark. (2024). FlashAttention-3: Eşzamansız ve Düşük Hassasiyetle Hızlı ve Doğru Dikkat](https://arxiv.org/abs/2407.08608) — Flash 3.
- [FlashAttention-4 sürüm notları (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) — Blackwell 5 aşamalı ardışık düzen ve yazılım-exp2 numarası; Bu derste bahsedilen salt ileri başlatma uyarıları için README deposunu okuyun.
- [Kwon ve ark. (2023). PagedAttention](https://arxiv.org/abs/2309.06180) ile Hizmet Veren Büyük Dil Modeli için Verimli Bellek Yönetimi — vLLM kağıdı.
- [Leviathan ve ark. (2023). Spekülatif Kod Çözme](https://arxiv.org/abs/2211.17192) yoluyla Transformer'lardan hızlı Inference - spesifikasyon kod çözme.
- [Li ve ark. (2024). EAGLE: Spekülatif Örnekleme, Özellik Belirsizliğinin Yeniden Düşünülmesini Gerektirir](https://arxiv.org/abs/2401.15077) — Dersin bahsettiği entegre taslak yaklaşımı için EAGLE-1/2 makalesi.
- [Cai ve ark. (2024). Medusa: Çoklu Kod Çözme Kafaları ile Basit LLM Inference Hızlandırma Framework](https://arxiv.org/abs/2401.10774) — EAGLE ile birlikte başvurulan Medusa yaklaşımı.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) — 16-token blok ve sayfa tablosu tasarımına ilişkin kanonik derin inceleme.
