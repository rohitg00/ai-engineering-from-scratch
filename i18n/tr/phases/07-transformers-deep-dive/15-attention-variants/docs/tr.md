# Dikkat Variantları  Çelişkili Pencere, Çekil, Farklı

> Tam dikkat bir döngüdür. Her simge her simgeyi görür ve hafıza fiyatı öder. Üç farklılık döngünün şeklini eğer ve maliyetin yarısını geri alır.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## Sorun

Tam ilgi maliyetleri $O(N^2)$hafıza ve $O(N^2)$128K bağlamlı bir Llama 3 70B için, katman başına 16 milyar dikkat girişi çarpı 80 katman.$O(N^2)$Aktifleştirme hafızası ama aritmetik maliyetini değiştirmez  her token hala diğer tokenlere katılır.

Üç çeşit sınıfı dikkat matrisinin topolojisini değiştirir:

1. **Sliding window attention (SWA).**Her token komşuların sabit bir penceresine hizmet eder, tam öncü değil.$O(N \cdot W)$nerede$W$Gemma 2/3, Mistral 7B'nin ilk katmanları, Phi-3-Long.
2. **Sparse / block attention.**Sadece seçilmiş çiftler `(i, j)`Longformer, BigBird, OpenAI nadir transformatör.
3. **Differential attention.**İki dikkat haritasını ayrı Q / K projeksiyonlarıyla hesaplayın, birini diğerinden çıkarın. İlk birkaç tokene ağırlığı kanayan " dikkat sink" ı öldürür. Microsoft'un DIFF Transformer (2024).

Bu özellikler birlikte var. 2026 sınır modeli genellikle onları karıştırır: çoğu katman SWA-1024, her beşde birisi küresel tam dikkat, ve bir avuç geri almayı temizleyen farklılık başlarıdır. Gemma 3'ün 5:1 SWA-global oranı mevcut derslik standartıdır.

## Anlaşım

### Çekilme Penceresi Dikkat (SWA)

Her sorgu pozisyonunda $i$Sadece pozisyonlara katılır $[i - W, i]$(kötü nedenlik SWA) veya $[i - W/2, i + W/2]$Pencerenin dışındaki simgeler çıkıyor .$-\infty$Not matrisinde.

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

- Evet .$N = 8192$ve $W = 1024$, puan matrisi, 1024 × 8192 sıfır dışı sıralara sahiptir  8 × azaltma beklentisi.

**KV cache shrinks with SWA.**Sadece sonuncusu .$W$Gemma-3-ish yapılandırması (1024 penceresi, 128K bağlamı) için, KV önbelleği 128× düşer.

**Quality cost.**SWA-yalnızca transformatörler uzun mesafeli geri alım ile mücadele eder. Düzeltme: SWA katmanlarını tam dikkat katmanlarıyla aralaştırın. Gemma 3 5:1 SWA: global kullanır. Mistral 7B, bilgi'nin üst üste geçiş pencereleri üzerinden "geri akıyor" olduğu bir nedensel-SWA yığınını kullanır.$W$ve sonra`L`Modelin katılabileceği katmanlar `L × W`- Tokenleri geri ver.

### İzleme / Blok Et

Bir seç .`N × N`Zaman öncesi bir kısıtlama modeli.

- **Local + strided (OpenAI sparse transformer).**Sonunculara kadar bak .$W$Tokenler artı her `stride`Yerel ve uzun mesafeli çekimleri yakalar.$O(N \cdot \sqrt{N})$Bilgisayar.
- **Longformer / BigBird.**Yerel pencere + küçük bir küresel token kümesi (örneğin `[CLS]`) herkesin katıldığı ve herkesin katıldığı + rastgele-sparse bağlantılar.
- **Native Sparse Attention (DeepSeek, 2025).**Hangi blokları öğrenin `(Q, K)`- Flaş Dikkatle uyumlu.

Sparse dikkat çekirdek mühendisliği hikâyesidir. Matematik basit (score matrisi maskeli) ve kazanç SRAM'a asla sıfır girişleri yüklemeden gelir. FlashAttention-3 ve 2026 FlexAttention API PyTorch'de özel ilk sınıf kıt desenleri yapar.

### Farklı Dikkat (DIFF Transformer, 2024)

Düzenli dikkat "hatırlama" sorunu vardır: softmax her satırı 1'e toplamaya zorlar, bu nedenle belirli bir şeye katılmak istemeyen tokenler ilk token'da (veya ilk birkaç token'da) ağırlık atarlar. Bu gerçek içeriğe gitmesi gereken kapasiteyi çalır.

Farklı dikkat bunu hesaplama yoluyla düzeltir .**two**dikkat haritaları ve çıkarma:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

nerede$\lambda$A1 gerçek içerik ağırlıklarını yakalar; A2 sinkini yakalar. Kısıtlama sinkini iptal eder, ağırlığı ilgili simgeler için yeniden tahsis eder.

Raporlanan sonuçlar (Microsoft 2024): 510% daha düşük karmaşıklık, aynı eğitimli uzunlukta 1.52× daha uzun etkili bağlam, daha keskin iğne-haystack geri alımı.

### Çeşitli karşılaştırmalar

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## Yapın

Bakın .`code/main.py`, ya da Rust limanı`code/main.rs`Rust versiyonunu çalıştırmak için:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Oyuncak dizisinde tam, SWA, lokal+strided ve farklı dikkatini yan yana gösteren bir sebep maskası karşılaştırıcısı uyguluyoruz.

### Adım 1: Tam sebep maskası (Başlamalı)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Ders 07'den baseline. Alt üçgen; diyagonalın üzerinde sıfır ağırlık.

### Adım 2: kaydırıcı pencerenin nedensel maskası

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

Bir parametreden  `window`- Evet .`window >= n`Bu yüzden, tüm nedensel dikkatini geri kazanırsın.`window = 1`, her simge sadece kendine hizmet eder.

### Adım 3: Yerel + adımlı keskin maske

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

Sıkı yerel pencere artı her `stride`-th simgesi dizinin başlangıcına geri döner.

### Dördüncü adım: Farklı ilgi

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

İki dikkat geçiyor, öğrenilmiş bir karıştırma katı ile çıkarıyoruz.

### Adım 5: KV önbelleği boyutları

Önbelleğin katman boyutunu $N = 131072$SWA ve nadir çeşitler 10 100 × düşer. Farklı çiftler.

## Kullan

2026 üretim modelleri:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+' deki FlexAttention, bir maske fonksiyonunu kabul eder:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

Bu, özel bir Triton çekirdeğine birleştirir. Ortak kalıplar için FlashAttention-3 hızının %10'unun içinde ve maske işlevi Python çağrılabilir.

**When to pick each:**

- **Pure full attention** ~ 16K bağlamına kadar her katman veya geri alma kalitesi en önemli olduğunda.
- **SWA + global mix** uzun bağlam (> 32K), eğitim ve sonucu hafıza bağlı.
- **Sparse block attention** özel çekirdek, özel bir desen. Uzman iş yükleri için rezerve (kaynaklama, ses).
- **Differential attention** dikkat sink kontaminasyonunun zarar verdiği herhangi bir iş yükü (uzun bağlamlı RAG, çiy yığınındaki iğne).

## Gönder

Bakın .`outputs/skill-attention-variant-picker.md`. Bu beceri, hedef bağlam uzunluğu, geri alma talepleri ve eğitim/sürekli hesaplama profili göz önüne alındığında yeni bir model için bir dikkat topolojisini seçer.

## Egzersizler

1. **Easy.**Çık .`code/main.py`SWA ' yı kontrol edin .`window=4`Son 4 simge dışında her şeyi sıfırlıyor.`window=n`Tam sebepli dikkatini bit-ident olarak yeniden üretir.
2. **Medium.** ile nedensel SWA uygulamak`window=1024`Lesson 07'ün baş taşı üzerinde. Tinyshakespeare'da 1000 adımlar için eğitim.
3. **Hard.**Gemma-3 tarzında 5:1 katman karışımı (5 SWA, 1 global) baş taşı modelinde uygulayın.
4. **Hard.**Öğrenciyle farklı ilgi göstermek$\lambda$Bir sentetik geri alım görevinde çalışın (bir iğne, 2.000 dikkat dağıtıcı).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## Daha Fazla Okumak

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) Kanonik kaydırma penceresi + global-token kağıdı.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062)Yerel + küresel + rastgele.
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) OpenAI'nin yerel + adımlı kalıbı.
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) 1:1 SWA:global mix.
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) 5.1 karışımı ile penceresi=1024 bu şimdi ders kitabı varsayılan.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) DIFF Transformer kağıdı.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089)DeepSeek-V3.2'nin öğrendiği parsiplik dikkatini.
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) Use It'deki maske-as-call-able model için API referansı.
