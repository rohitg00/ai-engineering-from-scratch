# KV Kaş, Flash Dikkat ve İnferans Optimizasyonu

> Eğitim paralel ve FLOP bağlıdır. İferense seri ve hafıza bağlıdır. Farklı şişek boynuzları, farklı numaralar.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## Sorun

Saf bir otomatik gerileme dekodörü yapar .$O(N^2)$üretmek için çalışmak $N$Tokens: her adımda dikkatini tam önbellek üzerinde yeniden hesaplar. 16M dikkat işlemleri olan 4K-token yanıt için, çoğu fazladan. Bir önbellek tokeninin her gizli durumu hesaplandığında belirlenir.

Bu nedenle, dikkat, bir çok veriyi hareket ettirir. Standart dikkat N×N puan matrisi, N×d softmax çıkışı, N×d son çıkışı  çok fazla okuma ve HBM'ye yazma yapar. N≥2K için, dikkat FLOP-a bağlı olmadan önce hafıza bağlanır. Klasik dikkat çekirdekleri modern GPU'ları 410×'ya az kullanır.

Dao et al'dan gelen iki optimizasyon, sınır çıkarımını "yavaş"tan "hızlı"a doğru harekete geçirdi:

1. **KV cache.**Her ön işaret simgesinin K ve V vektörlerini saklayın. Her yeni simgenin dikkatini önbelleğe alınan anahtarlara karşı bir sorgu oluşturur.$O(N^2)$- ...$O(N)$Bir nesil adım başına.
2. **Flash Attention.**Dikkat hesaplamalarını çizin böylece tam N×N matrisi asla HBM'ye ulaşmaz. Tüm softmax + matmul SRAM'da gerçekleşir. A100'de 24× duvar saati hızlandırması; FP8 ile H100'de 510×.

2026 yılına kadar her iki üretim sonuç kümesi (vLLM, TensorRT-LLM, SGLang, llama.cpp) onları varsayır.

## Anlaşım

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV önbelleği matematik

Decooder katmanı, her token, tüm KV başları üzerinde:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

32 katmanlı, 32 başlı 7B modeli için (K ve V için kullanılan tüm), d_head=128, fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

Llama 3 70B için (80 katman, d_head=128, GQA 8 KV başlı):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

32K'de 10 GiB 128K'de 40 GiB'ye kadar büyüyor. Bu da sadece 1 seri boyutunda KV önbelleği için 40 GB A100'in tamamıdır.

**GQA is the KV-cache win.**64 KV başlı MHA'nın 8 katı büyüklüğü, 32K'de yaklaşık 80 GiB'dir.

Boyutları sürükle ve önbelleğin boyutunun hareketini izle.

```figure
kv-cache-sizer
```

### Akşam dikkat  kapaklama hilesi

Standart dikkat:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

HBM'de 3 TB/s bant genişliği, SRAM'da 30 TB/s. Her HBM seferinde 10 oranında yavaşlama var.

Akıllı Dikkat:

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

Bir HBM seferı tek tek tekerlek.$O(N^2)$- ...$O(N)$Geri geçiş, ileri geçişten bazı değerleri yeniden hesaplar ve onları saklar.

**Numerical trick.**Softmax çalışmasını sürdürüyor `(max, sum)`Flash dikkat, bit-tıpkı standart dikkat için çıkış hesaplar (modulo fp16 ilişkisizliği).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

Flash 4 sadece fırlatma sırasında ilerleme kaydetmektedir. Eğitim hala Flash 3 kullanır. GQA ve varlen desteği Flash 4 için beklenmektedir (2026 ortalarında).

### Spekülatör çözme  diğer gecikme kazan

Ucuz model N simgeler önerir. Büyük model tüm N'leri paralel olarak doğruluyor. Eğer doğrulama k simgeler kabul ederse, k nesiller için 1 büyük model ileri geçiş ödediğiniz. Tipik k = 35 kod ve prozda.

2026'da geçersiz olanlar:
- **EAGLE 2 / Medusa.**Verifikatörün gizli durumlarını paylaşan entegre taslak başlıkları. Kalite kaybı olmadan 2  3  hızlandırma.
- **Speculative decoding with draft model.**İsteğe bağlı donanımlarda 2×4 hızlanma.
- **Lookahead decoding.**Jacobi iterasyonu, bir taslak modeli gerekmiyor.

### Sürekli serileme

Klasik seri sonucu: en yavaş dizinin bitmesini bekle, sonra yeni bir seri başlat. Kısa cevaplar erken bitince GPU'yı harcıyor.

Sürekli serileme (İlk olarak Orca'da, şimdi vLLM, TensorRT-LLM, SGLang'da gönderilmiştir): Eski istekler bittikten sonra yeni istekleri partiye değiştirin.

### PagedAttention  KV önbelleği sanal bellek olarak

vLLM'nin başlık özelliği. KV önbelleği 16 token bloklarına ayrılır; bir sayfa tablosu mantıksal konumları fiziksel bloklara haritası yapar. KV'yi paralel örnekler (şekil arama, paralel örnekleme), hızlı önbelleğe sıcak değişim önlükleri ve defragman belleği arasında paylaşabilir.

```figure
flash-attention-memory
```

## Yapın

```figure
iso-machine {"machine":"kv-cache"}
```

Bakın .`code/main.py`, ya da Rust limanı`code/main.rs`Rust versiyonunu çalıştırmak için:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Bu uygulamayı uyguluyoruz:

1. Saf bir adam .$O(N^2)$Gelişmiş dekodör.
2. A.$O(N)$KV-cached dekodör.
3. Flash Attention'ın çalıştırma maksimum algoritmasını simüle eden bir softmax.

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

Basit: her token için K ve V vektörlerini katmanlık, başlık listesinde büyütmeye devam edin.

### Adım 2: Plaklı softmax

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

Bit-iynet çıkış `softmax(qK) V`Bir çekimde, ama her zaman çalışma seti bir `tile × d_head`- Blok, tam değil.`N × d_head`- Evet .

### Adım 3: Saçma ile önbelleğe alınan kodlama karşılaştır

İki dekodör de aynı sorgu anahtarı karşılaştırma yapar: adım `t`- Evet .`t`Tokenler, yani toplam 1 + 2 + ... + N = N(N+1)/2. Kod N = 10 kullanır ve her bir dekodör için 55 basar. 100 token nesli için, her ikisi de 5050 karşılaştırma yaparlar. Kaş K ve V projelerini kaydetir. Bir önbelleği olmadan, her adım K ve V'yi tekrar hesaplar ve böylece 100 token jenerasyonu 5050 token durumunu hesaplar. Kaşla, her token'in K ve V'leri bir kez hesaplanır, bu yüzden aynı nesil 100 token durumunu hesaplar.

## Kullan

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

VLLM üretimi:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

Önbellek önbelleği istekler arasında büyük bir 2026 kazanç  aynı sistem prompt, birkaç atış örnekleri veya uzun bağlam belgesini tekrar kullanır KV aramalar arasında. Tekrarlanan araç istekleri ile ajan iş yükleri için önbellek önbelleği rutin olarak 5× throughput kazançtır.

## Gönder

Bakın .`outputs/skill-inference-optimizer.md`. Yetenek yeni bir sonucu uygulaması için dikkat uygulaması, KV önbelleği stratejisi, kuantitasyon ve spekülatör çözümü seçer.

## Egzersizler

1. **Easy.**Çık .`code/main.py`- Naif ve önbelleğe alınmış dekodörlerin aynı çıkış ürettiğini onaylayın; op-count farkını not edin.
2. **Medium.**Önbellek önbelleği önbelleği uygulaması: bir istek P ve birkaç tamamlama verildiğinde, KV önbelleğini doldurmak için P üzerinde bir ileri geçiş çalıştırın, sonra tamamlama başına dal.
3. **Hard.**Bir oyuncak uygulamak PagedAttention: KV önbelleği sabit 16 jeton bloklarında serbest liste ile. Bir dizi tamamlandığında, bloklarını havuza geri gönderin. Çeşitli uzunluklarla 1.000 sohbet tamamlamasını simüle edin. Hatırlama parçalanması vs. bitişik tahsis karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## Daha Fazla Okumak

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) Flash 1.
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) Flash 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) Flash 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) Blackwell 5 aşamalı boru hattı ve yazılım-exp2 hilesi; bu derste bahsedilen sadece ileriye atılma uyarıları için repo README'yi okuyun.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)- VLLM kağıdı.
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) Spec kodlaması.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) Örgütlerdeki bütünleşmiş taslak yaklaşımı için EAGLE-1/2 makalesi.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) Medusa yaklaşımı, Eagle ile birlikte referans edildi.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) 16 token blok ve sayfa tablo tasarımı üzerinde kanonik derin dalış.
