# Dikkat Çeşitleri — Kayar Pencere, Seyrek, Diferansiyel

> Tam dikkat bir dairedir. Her token, her token'yi görür ve bunun bedelini hafıza öder. Dört varyant dairenin şeklini büker ve maliyetin yarısını karşılar.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 02 (Self-Attention), Aşama 7 · 03 (Çok Kafalı), Aşama 7 · 12 (KV Önbellek / Flash Dikkat)
**Süre:** ~60 dakika

## Sorun

Tam dikkat, dizi uzunluğunda `O(N²)` belleğe ve `O(N²)` hesaplamaya mal olur. 128K bağlamlı bir Llama 3 70B için katman başına 16 milyar dikkat girişi çarpı 80 katman demektir. Flash Attention (Ders 12), `O(N²)` etkinleştirme belleğini gizler ancak aritmetik maliyeti değiştirmez — her token hâlâ diğer token ile ilgilenir.

Üç değişken sınıfı, dikkat matrisinin topolojisini değiştirir:

1. **Sürgülü pencere dikkati (SWA).** Her token, tam önekle değil, komşuların sabit bir penceresine katılır. Bellek ve hesaplama `O(N · W)` konumuna düşer; burada `W` penceredir. Gemma 2/3, Mistral 7B'nin ilk katmanları, Phi-3-Long.
2. **Dikkati azaltın / engelleyin.** Yalnızca seçilen `(i, j)` çiftleri puan alır; geri kalanı sıfır ağırlığa zorlanıyor. Longformer, BigBird, OpenAI seyrek transformer.
3. **Farklı dikkat.** Ayrı Q/K projeksiyonlarına sahip iki dikkat haritası hesaplayın, birini diğerinden çıkarın. İlk birkaç tokensaniyede ağırlık akıtan "dikkat kaybı"nı öldürür. Microsoft'un DIFF Transformer (2024).

Bunlar bir arada var. Bir 2026 sınır modeli sıklıkla bunları karıştırır: katmanların çoğu SWA-1024'tür, her beşte biri küresel tam dikkattir ve bir avuç dolusu da geri alımı temizleyen diferansiyel kafalardır. Gemma 3'ün 5:1 SWA-global oranı mevcut ders kitabı varsayılanıdır.

## Konsept

### Kayar Pencere Dikkati (SWA)

`i` konumundaki her sorgu yalnızca `[i - W, i]` (nedensel SWA) veya `[i - W/2, i + W/2]` (çift yönlü) içindeki konumlara katılır. Pencerenin dışındaki Token'ler puan matrisinde `-inf` alır.

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

`N = 8192` ve `W = 1024` için puan matrisinde beklentide 1024 × 8192 sıfır olmayan satırlar bulunur - 8 kat azalma.

**KV önbelleği SWA ile küçülür.** Katman başına yalnızca K ve V'nin son `W` token'lerinin tutulması gerekir. Gemma-3 benzeri bir yapılandırma için (1024 pencere, 128K bağlam), KV önbelleği 128 kat düşer.

**Kalite maliyeti.** Yalnızca SWA'ya ait transformer'ler uzun menzilli erişim konusunda zorluk yaşıyor. Çözüm: SWA katmanlarını tam dikkat katmanlarıyla birleştirin. Gemma 3, 5:1 SWA:global kullanır. Mistral 7B, bilginin örtüşen pencereler aracılığıyla "ileriye doğru aktığı" bir nedensel-SWA yığını kullanmıştır; her katman etkili alıcı alanı `W` kadar genişletir ve `L` katmandan sonra model, `L × W` token gerisine katılabilir.

### Seyrek / Blok Dikkat

Önceden bir `N × N` seyreklik modeli seçin. Üç kanonik şekil:

- **Yerel + adımlı (OpenAI seyrek transformer).** Son `W` token'lere ve bundan önceki her `stride`-inci token'ye katılın. `O(N · sqrt(N))` bilgi işlemde hem yerel hem de uzun menzilli yakalar.
- **Longformer / BigBird.** Yerel pencere + herkese katılan ve herkesin katıldığı küçük bir küresel token kümesi (e.g. `[CLS]`) + rastgele seyrek bağlantılar. Eşleşen kalitede ampirik 2x bağlam.
- **Yerel Seyrek Dikkat (DeepSeek, 2025).** Hangi `(Q, K)` bloklarının önemli olduğunu öğrenin; çekirdek düzeyinde sıfır blokları atlayın. FlashAttention uyumlu.

Seyrek dikkat bir çekirdek mühendisliği hikayesidir. Matematik basittir (puan matrisini maskeleyin); kazanç, sıfır girişlerin asla SRAM'a yüklenmemesinden gelir. FlashAttention-3 ve 2026 FlexAttention API, PyTorch'ta özel seyrek desenleri birinci sınıf hale getirir.

### Diferansiyel Dikkat (DIFF Transformer, 2024)

Düzenli dikkatin bir "dikkat kaybı" sorunu vardır: softmax her satırın toplamının 1 olmasını zorlar, dolayısıyla özellikle hiçbir şeyle ilgilenmek istemeyen token'ler ilk token'ye (veya ilk birkaçına) ağırlık verirler. Bu, gerçek içeriğe gitmesi gereken kapasiteyi çalar.

Diferansiyel dikkat, **iki** dikkat haritası hesaplayıp şunları çıkararak bu sorunu çözer:

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

burada `λ` öğrenilmiş bir skalerdir (genellikle 0,5–0,8). A1, gerçek içerik ağırlıklarını yakalar; A2 lavaboyu yakalıyor. Çıkarma işlemi, havuzu iptal eder, ağırlığı ilgili token'lara yeniden tahsis eder.

Bildirilen sonuçlar (Microsoft 2024): %5-10 daha düşük şaşkınlık, aynı eğitimde görülen uzunlukta 1,5-2 kat daha uzun etkili bağlam, samanlıkta iğne bulmanın daha keskin olması.

### Varyant Karşılaştırması

| Varyant | Hesapla | KV önbelleği | Kalite vs tam | Üretim kullanımı |
|---------|---------|----------|-----------------|----------------|
| Tam dikkat | O(N²) | O(N) katman başına | temel | her modelin varsayılan katmanı |
| SWA (pencere 1024) | O(K-B) | O(W) katman başına | -0,1 kişi, küresel katmanlarla iyi uyum | Gemma 2/3, Phi-3-Uzun |
| Yerel + adımlı seyrek | O(N·√N) | karışık | SWA'ya benzer | OpenAI seyrek transformer, Longformer |
| BigBird (yerel + küresel + rastgele) | O(N) yaklaşık | karışık | 2× bağlamda tam eşleşmeler | erken uzun bağlamlı BERT |
| Yerel Seyrek (DeepSeek-V3.2) | O(N · aktif kesir) | O(N) | 0,05 kişi içinde | DeepSeek-V3.2, 2025 |
| Diferansiyel | O(2·N²) | Ç(2N) | -%5 ila -10 kişi | DIFF Transformer, 2026 başı modeller |

```figure
gqa-kv-sharing
```

## Build It — Kendin Oluştur

Bkz. `code/main.py`. Bir oyuncak dizisi üzerinde tam, SWA, yerel+adımlı ve diferansiyel dikkati yan yana gösteren bir nedensel maske karşılaştırıcısı uyguluyoruz.

### Adım 1: tam nedensel maske (temel)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Ders 07'den taban çizgisi. Alt üçgen; diyagonalin üzerinde sıfır ağırlık.

### Adım 2: kayan pencere nedensel maskesi

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

Bir parametre — `window`. `window >= n` için nedensel dikkatin tamamını geri kazanırsınız. `window = 1` için her token yalnızca kendisiyle ilgilenir.

### Adım 3: yerel + adımlı seyrek maske

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

Yoğun yerel pencere artı her `stride`-th token dizinin başlangıcına geri döner. Alıcı alan, ek katmanlarla günlük adımlarla büyür.

### Adım 4: farklı dikkat

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

İki dikkat geçişi, öğrenilmiş bir karıştırma katsayısıyla çıkarılır. Kodda tekli ve diferansiyelin dikkat-yoğuşma ısı haritasını karşılaştırıyoruz ve havuzun çöküşünü izliyoruz.

### Adım 5: KV önbellek boyutları

Her değişken için katman başına önbellek boyutunu `N = 131072`'da yazdırın. SWA ve seyrek varyantlar 10–100 kat düşer. Diferansiyel çiftler. Hafıza faturanızı bilinçli olarak ödeyin.

## Use It — Uygula

2026 üretim modelleri:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+ sürümündeki FlexAttention bir maske işlevini kabul eder:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

Bu, özel bir Triton çekirdeğine derlenir. Yaygın kalıplar için FlashAttention-3 hızının %10'u dahilinde ve maske işlevi Python tarafından çağrılabilir.

**Her biri ne zaman seçilmelidir:**

- **Saf tam dikkat** — ~16K bağlama kadar her katmanda veya alma kalitesinin çok önemli olduğu durumlarda.
- **SWA + global karışım** — uzun bağlam (>32K), eğitim ve inference belleğe bağlı. 2026 varsayılanı 32K'nın üzerindedir.
- **Seyrek blok dikkati** — özel çekirdek, özel desen. Özel iş yükleri (geri alma, ses) için ayrılmıştır.
- **Farklı dikkat** — dikkatin dağılmasının zarar verdiği her türlü iş yükü (uzun bağlamlı RAG, samanlıkta iğne).

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-attention-variant-picker.md`. Beceri, hedef bağlam uzunluğu, alma talepleri ve eğitim/inference bilgi işlem profili dikkate alınarak yeni bir model için bir dikkat topolojisi seçer.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. `window=4`'deki SWA'nın satır başına son 4 token dışındaki her şeyi sıfırladığını doğrulayın. `window=n`'nin tam nedensel dikkati biraz aynı şekilde ürettiğini doğrulayın.
2. **Orta.** Ders 07'nin üzerine `window=1024` ile nedensel SWA uygulayın. Tinyshakespeare üzerinde 1000 adım antrenman yapın. Değer kaybı tam dikkat karşısında ne kadar geriler? En yüksek hafıza ne kadar düşer?
3. **Zor.** Kapsül modeline Gemma-3 tarzı 5:1 katman karışımı (5 SWA, 1 global) uygulayın. Kayıp, bellek ve üretim kalitesini, eşleşen parametrelerde saf SWA ve saf küresel temellerle karşılaştırın.
4. **Zor.** Baş başına öğrenilmiş bir `λ` ile diferansiyel dikkati uygulayın. Sentetik bir çıkarma görevi üzerinde eğitim alın (bir iğne, 2.000 çeldirici). Eşleşen parametrelerde tek dikkat taban çizgisine karşı geri alma doğruluğunu ölçün.

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Sürgülü pencere dikkati (SWA) | "Yerel ilgi" | Her sorgu, son `W` token'lerine katılır; KV önbelleği `O(W)` boyutuna küçülür. |
| Etkili alıcı alan | "Model ne kadar geriye bakar" | `W` pencereli bir `L` katmanlı SWA yığınında, en fazla `L × W` tokens. |
| Uzun Biçimli / BigBird | "Yerel + genel + rastgele" | Her zaman katılan birkaç küresel token ile seyrek desenler; erken uzun bağlam yaklaşımı. |
| Yerli Seyrek Dikkat | "DeepSeek'in çekirdek numarası" | Blok düzeyinde seyrekliği öğrenin; Kaliteyi korurken çekirdek düzeyinde sıfır bloğu atlayın. |
| Farklı dikkat | "İki harita, bir çıkarma" | DIFF Transformer: dikkat dağılmalarını iptal etmek için öğrenilen `λ` çarpı ikinci dikkat haritasını birinciden çıkarın. |
| Dikkat lavabo | "Ağırlık token 0'a düşüyor" | Softmax normalleştirmesi satırların toplamını 1'e zorlar; bilgi vermeyen sorgular ağırlığı 0 konumuna bırakır. |
| FlexDikkat | "Python Olarak Maske" | Rastgele maske işlevlerini FlashAttention şeklindeki çekirdeklerde derleyen PyTorch 2.5+ API'si. |
| Katman türü karışımı | "5:1 SWA'dan küresele" | Kaliteyi daha düşük bellekte tutmak için seyrek ve tam dikkat katmanlarını bir yığına serpiştirin. |

## Daha Fazla Okuma

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) — kanonik kayan pencere + global-token kağıdı.
- [Zaheer ve ark. (2020). Büyük Kuş: Daha Uzun Diziler için Transformer'ler](https://arxiv.org/abs/2007.14062) — yerel + genel + rastgele.
- [Çocuk ve ark. (2019). Seyrek Transformers](https://arxiv.org/abs/1904.10509) ile Uzun Diziler Oluşturma — OpenAI'nin yerel+adımlı modeli.
- [Gemma Takımı (2024). Gemma 2: Açık Dil Modellerini Pratik Boyutta İyileştirme](https://arxiv.org/abs/2408.00118) — 1:1 SWA:global karışımı.
- [Gemma Takımı (2025). Gemma 3 teknik raporu](https://arxiv.org/abs/2503.19786) — artık ders kitabının varsayılanı olan window=1024 ile 5:1 karışımı.
- [Ye ve ark. (2024). Diferansiyel Transformer](https://arxiv.org/abs/2410.05258) — DIFF Transformer kağıdı.
- [Yuan ve ark. (2025). Yerel Seyrek Dikkat](https://arxiv.org/abs/2502.11089) — DeepSeek-V3.2'nin öğrenilmiş seyreklik dikkati.
- [PyTorch — FlexAttention blogu ve docs](https://pytorch.org/blog/flexattention/) — Use It'teki çağrılabilir olarak maskeleme modeli için API referansı.
