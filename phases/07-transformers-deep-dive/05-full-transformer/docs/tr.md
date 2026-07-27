# Tam Transformer — Kodlayıcı + Kod Çözücü

> Dikkat yıldızdır. Geriye kalan her şey - artıklar, normalleştirme, ileri besleme, çapraz dikkat - onu derinlemesine istiflemenizi sağlayan yapı iskelesidir.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 02 (Self-Attention), Aşama 7 · 03 (Çok Kafalı Dikkat), Aşama 7 · 04 (Konumsal Kodlama)
**Süre:** ~75 dakika

## Sorun

Tek bir dikkat katmanı bir model değil, özellik çıkarıcıdır. Katman başına bir matmul dil için yeterli kapasite değildir. Derinliğe ve doğru tesisat olmadan derinlik kırılmalarına ihtiyacınız var.

2017 Vaswani makalesi, bir dikkat katmanını istiflenebilir bir bloğa dönüştüren altı tasarım kararını paketliyordu. Her transformer - yalnızca kodlayıcı (BERT), yalnızca kod çözücü (GPT), kodlayıcı-kod çözücü (T5) - aynı iskeleti devralır. 2026'da bloklar iyileştirildi (RMSNorm, SwiGLU, pre-norm, RoPE) ancak iskelet aynı.

Bu ders iskelettir. Sonraki derslerde bu konuda uzmanlaşacağız — kodlayıcılar için 06, kod çözücüler için 07, kodlayıcı-kod çözücü için 08.

## Konsept

![Kodlayıcı ve kod çözücü dahili blokları, kablolu](../assets/full-transformer.svg)

### Altı parça

1. **Embedding + konumsal sinyal.** Tokens → vektörler. RoPE (modern) veya sinüzoidal (klasik) yoluyla enjekte edilen konum.
2. **Öz-dikkat.** Her pozisyon birbirini takip eder. Kod çözücülerde maskelenmiştir.
3. **İleri besleme ağı (FFN).** Konum bazında iki katmanlı MLP: `W_2 · activation(W_1 · x)`. Genişletme oranı varsayılan olarak 4×.
4. **Artık bağlantı.** `x + sublayer(x)`. Bu olmadan, gradient'lar ~6 katmanı geçerek kaybolur.
5. **Katman normalleştirme.** `LayerNorm` veya `RMSNorm` (modern). Artık akışı stabilize eder.
6. **Çapraz dikkat (yalnızca kod çözücü).** Sorgular kod çözücüden, anahtarlar ve değerler kodlayıcı çıkışından gelir.

Bir blok boyunca bir vektör akışını izleyin: Dikkat konumlar arasında karışır, kalıntı onu ileri taşır, FFN onu dönüştürür ve norm akışı sabit tutar.

```figure
transformer-block
```

### Kodlayıcı bloğu (BERT, T5 kodlayıcı tarafından kullanılır)

```
x → LN → MHA(self) → + → LN → FFN → + → out
                     ^              ^
                     |              |
                     └── residual ──┘
```

Kodlayıcı çift yönlüdür. Maskeleme yok. Tüm pozisyonlar tüm pozisyonları görür.

### Kod çözücü bloğu (GPT, T5 kod çözücü tarafından kullanılır)

```
x → LN → MHA(masked self) → + → LN → MHA(cross to encoder) → + → LN → FFN → + → out
```

Kod çözücünün blok başına üç alt katmanı vardır. Ortadaki - çapraz dikkat - bilginin kodlayıcıdan kod çözücüye aktığı tek yerdir. Saf bir yalnızca kod çözücü mimarisinde (GPT), çapraz dikkat atlanır ve yalnızca öz dikkati + FFN'yi maskelemiş olursunuz.

### Norm öncesi ve norm sonrası karşılaştırması

Orijinal makale: `x + sublayer(LN(x))` vs `LN(x + sublayer(x))`. Post-norm 2019'da etkisini kaybetti; dikkatli bir ısınma olmadan derinlemesine antrenman yapmak daha zor. Ön norm (`LN` *önce* alt katmanı) 2026'nın varsayılanıdır: Llama, Qwen, GPT-3+, Mistral hepsi bunu kullanır.

### 2026'nın modernize edilmiş bloğu

Vaswani 2017, LayerNorm + ReLU'yu piyasaya sürdü. Modern yığınlar her ikisinin de yerini aldı. Üretim blokları aslında neye benziyor:

| Bileşen | 2017 | 2026 |
|-----------|------|------|
| Normalleştirme | Katman Normu | RMSNormu |
| FFN aktivasyonu | ReLU | SwiGLU |
| FFN genişletmesi | 4× | 2,6× (SwiGLU üç matris kullanır, toplam parametreler eşleşir) |
| Pozisyon | Sinüzoidal mutlak | RoPE |
| Dikkat | Tam MHA | GQA (veya MLA) |
| Önyargı terimleri | Evet | Hayır |

RMSNorm, LayerNorm'un ortalama merkezlemeyi düşürür (bir eksiltme), bu da işlemden tasarruf sağlar ve ampirik olarak en azından aynı derecede kararlıdır. SwiGLU (`Swish(W1 x) ⊙ W3 x`), Llama, PaLM ve Qwen makalelerinde sürekli olarak ReLU/GELU FFN'den ~0,5 perplexity puanı daha iyi performans göstermektedir.

### Parametre sayısı

`d_model = d` ve FFN genişletmesi `r` olan bir blok için:

- MHA: `4 · d²` (Q, K, V, O projeksiyonları)
- FFN (SwiGLU): `3 · d · (r · d)` ≈ `3rd²`
- Normlar: ihmal edilebilir

`d = 4096, r = 2.6, layers = 32`'da (kabaca Llama 3 8B), toplam: `32 · (4·4096² + 3·2.6·4096²) ≈ 32 · (16 + 32) M = ~1.5B parameters per layer × 32 ≈ 7B` (artı embedding'lar ve kafa). Yayımlanan parametre sayılarıyla eşleşir.

## Build It — Kendin Oluştur

### Adım 1: yapı taşları

Ders 03'teki küçük `Matrix` sınıfını kullanarak (bağımsızlık için bu dosyaya kopyalanmıştır):

- `layer_norm(x, eps=1e-5)` — ortalamayı çıkar, std'ye böl.
- `rms_norm(x, eps=1e-6)` — RMS'ye böl. Ortalama çıkarma yok.
- `gelu(x)` ve `silu(x) * W3 x` (SwiGLU).
- `ffn_swiglu(x, W1, W2, W3)`.
- `encoder_block(x, params)` ve `decoder_block(x, enc_out, params)`.

Tüm kablolama için `code/main.py`'a bakın.

### Adım 2: 2 katmanlı kodlayıcıyı ve 2 katmanlı kod çözücüyü bağlayın

Onları istifleyin. Kodlayıcı çıktısını her kod çözücü çapraz dikkatine iletin. Çıkış projeksiyonundan önce son bir LN ekleyin.

```python
def encode(tokens, params):
    x = embed(tokens, params.emb) + sinusoidal(len(tokens), params.d)
    for block in params.encoder_blocks:
        x = encoder_block(x, block)
    return x

def decode(target_tokens, encoder_out, params):
    x = embed(target_tokens, params.emb) + sinusoidal(len(target_tokens), params.d)
    for block in params.decoder_blocks:
        x = decoder_block(x, encoder_out, block)
    return x
```

### Adım 3: Bir oyuncak örneği üzerinde ileri koşun

Bir 6-token kaynağı ve bir 5-token hedefi besleyin. Çıkış şeklinin `(5, vocab)` olduğunu doğrulayın. Eğitim yok — bu ders mimariyle ilgilidir, kayıpla değil.

### Adım 4: RMSNorm + SwiGLU'da geçiş yapın

LayerNorm ve ReLU-FFN'yi RMSNorm ve SwiGLU ile değiştirin. Şekillerin hâlâ eşleştiğini doğrulayın. Bu, tek işlev değişikliği ile 2026 modernizasyonudur.

## Use It — Uygula

PyTorch/TF referans uygulamaları: `nn.TransformerEncoderLayer`, `nn.TransformerDecoderLayer`. Ancak 2026 üretim kodunun çoğu kendi bloğunu oluşturur çünkü:

- Flaş Dikkat, `nn.MultiheadAttention` aracılığıyla değil, içeriden dikkat olarak çağrılır.
- GQA/MLA stdlib referansında yer almıyor.
- RoPE, RMSNorm, SwiGLU PyTorch varsayılanları değildir.

HF `transformers` okumanız gereken temiz referans bloklarına sahiptir: `modeling_llama.py` kanonik 2026 yalnızca kod çözücü bloğudur. ~ 500 satır ve bir kez geçmeye değer.

**Kodlayıcı, kod çözücü ve kodlayıcı-kod çözücü karşılaştırması — ne zaman seçilmeli:**

| İhtiyaç | Seç | Örnek |
|------|------|---------|
| Sınıflandırma, embedding'lar, metin üzerinden QA | Yalnızca kodlayıcı | BERT, DeBERTa, ModernBERT |
| Metin oluşturma, sohbet, kod, akıl yürütme | Yalnızca kod çözücü | GPT, Lama, Claude, Qwen |
| Yapılandırılmış girdi → yapılandırılmış çıktı (çeviri, özetleme) | Kodlayıcı-kod çözücü | T5, BART, Fısıltı |

Yalnızca kod çözücü dili kazandı çünkü en temiz şekilde ölçekleniyor ve hem anlama hem de oluşturma işlemlerini gerçekleştiriyor. Kodlayıcı-kod çözücü, girişin net bir "kaynak dizisi" kimliğine (çeviri, konuşma tanıma, yapılandırılmış görevler) sahip olması durumunda hala en iyisidir.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-transformer-block-reviewer.md`. Beceri, 2026 varsayılanlarına karşı yeni bir transformer blok uygulamasını inceler ve eksik parçaları işaretler (ön norm, RoPE, RMSNorm, GQA, FFN genişleme oranı).

## Egzersizler

1. **Kolay.** Encoder_block'unuzdaki parametreleri `d_model=512, n_heads=8, ffn_expansion=4, swiglu=True`'da sayın. Bloğu uygulayarak ve `sum(p.numel() for p in block.parameters())` kullanarak doğrulayın.
2. **Orta.** Post-normdan ön-norma geçiş yapın. Her ikisini de başlatın ve rastgele girişle 12 yığılmış katmandan sonra aktivasyon normunu ölçün. Post-normun aktivasyonları patlamalı; ön normlar sınırlı kalmalıdır.
3. **Zor.** Bir oyuncak kopyalama görevine 4 katmanlı bir kodlayıcı-kod çözücü uygulayın (kopyalama `x` tersine çevrilmiştir). 100 adım eğitin. Kayıp bildirin. RMSNorm + SwiGLU + RoPE'de değişiklik yapın - kayıp düşer mi?

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Blok | "Bir transformer katman" | Artık bağlantılarla sarılmış norm + dikkat + norm + FFN yığını. |
| Artık | "Bağlantıyı atla" | `x + f(x)` çıktısı; gradient'nin derin yığınlar üzerinden akışını sağlar. |
| Ön norm | "Sonra değil, önce normalleştir" | Modern: `x + sublayer(LN(x))`. Isınma jimnastiği olmadan daha derin antrenmanlar. |
| RMSNormu | "Anlamı olmayan LayerNorm" | RMS'ye bölün; bir operasyon daha az, aynı ampirik kararlılık. |
| SwiGLU | "Herkesin geçiş yaptığı FFN" | `Swish(W1 x) ⊙ W3 x → W2`. LM ppl'de ReLU/GELU'yu yener. |
| Çapraz dikkat | "Kod çözücü, kodlayıcıyı nasıl görüyor" | Kod çözücüden Q, kodlayıcı çıkışlarından K/V ile MHA. |
| FFN genişletmesi | "Orta MLP ne kadar geniş" | Gizli boyutun d_modele oranı, genellikle 4 (LayerNorm) veya 2,6 (SwiGLU). |
| Önyargısız | "+b terimlerini bırakın" | Modern yığınlar doğrusal katmanlardaki sapmaları göz ardı eder; kişi sayısında hafif bir iyileşme, daha küçük model. |

## Daha Fazla Okuma

- [Vaswani ve ark. (2017). Tek İhtiyacınız Olan Dikkat](https://arxiv.org/abs/1706.03762) — orijinal blok spesifikasyonu.
- [Xiong ve ark. (2020). Transformer Mimarisinde](https://arxiv.org/abs/2002.04745) Katman Normalleştirme konusunda — neden ön-norm, post-normu çok geride bırakıyor?
- [Zhang, Sennrich (2019). Kök Ortalama Kare Katman Normalleştirmesi](https://arxiv.org/abs/1910.07467) — RMSNorm.
- [Shazeer (2020). GLU Varyantları Transformer](https://arxiv.org/abs/2002.05202) — SwiGLU makalesini iyileştirir.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — kanonik 2026 yalnızca kod çözücü bloğu.
