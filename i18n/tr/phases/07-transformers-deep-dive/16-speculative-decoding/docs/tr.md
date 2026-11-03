# Tahmin edici Şifreleme  Tasarım, Doğrulama, Tekrarlama

> Autoregressive dekodlama serilidir. Her token önceki birini bekler. Speküel dekodlama zinciri kırar: ucuz model N tokens taslaklar, pahalı model tüm N bir ileri geçiş doğruluyor.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## Sorun

Bir H100'de bir 70B LLM örneği örneği ~30 ms alır. Bir 3B taslak modeli ~3 ms alır. 3B taslak 5 tokeni ileri bırakırsak, tüm 5'i doğrulamak için 70B * bir kez * çalıştırın.$5 \times 3 + 30 = 45$ms 5 tane kadar kabul edilen token için  vs `5×30 = 150 ms`Bu tam spekülasyonsal dekodlama alanı: 24x daha düşük dekod gecikmesi için küçük miktarda ekstra GPU belleği (yazar model) değiştirin.

Leviathan et al. (2023) ve Chen et al. tarafından aynı anda getirilen spekülasyonlu örnekleme, çıkış sırasının **identically distributed**Bu büyük model kendi başına üretebildiği şey için.

4 çift çiftin ailesi 2026 sonucu üzerinde egemenlik göstermektedir:

1. **Vanilla speculative (Leviathan 2023).**Ayrı taslak modeli (örneğin Llama 3 1B) + doğrulayıcı (örneğin Llama 3 70B).
2. **Medusa (Cai 2024).**Verifikatörde birden fazla dekodlama başlığı , tahmin pozisyonları `t+1..t+k`- Ayrı bir taslak modeli yok.
3. **EAGLE family (Li 2024, 2025).**Verifikatörün gizli durumlarını tekrar kullanan hafif bir taslak; vanilya'dan daha yakın kabul oranı; tipik 34×.
4. **Lookahead decoding (Fu 2024).**Jacobi iterasyonu, hiç bir taslak modeli gerekmiyor, kendi kendine spekülasyon yapılıyor, niş ama bağımlılıktan uzak.

2026'da her üretim sonuçları varsayılan olarak spekülasyonsal çözümü gönderir. vLLM, TensorRT-LLM, SGLang ve llama.cpp hepsi en az vanilya + EAGLE-2 desteğini sağlar.

## Anlaşım

### Temel algoritma

Bir doğrulayıcı veriliyor $M_q$ve daha ucuz bir taslak .$M_p$- ...

1. - Bırak .$x_1 \ldots x_k$- Bu, zaten çözülmüş bir önlemdir.
2. **Draft**: kullanımı $M_p$- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -$d_{k+1}, d_{k+2}, \ldots, d_{k+N}$- Evet .$p_1 \ldots p_N$- Evet .
3. **Verify in parallel**Çıkış$M_q$Bir kere .$x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$, verifier olasılıklarını almak $q_1 \ldots q_{N+1}$pozisyonlar için $k+1 \ldots k+N+1$- Evet .
4. **Accept/reject each draft token left to right**: her biri için$i$, olasılıklarla kabul et .$\min(1, q_i(d_i) / p_i(d_i))$- Evet .
5. İlk reddedilme konusunda pozisyon .$j$Örnek:$t_j$"Kalan" dağıtımından $(q_j - p_j)_+$Tüm taslaklar normalleştirildi.$j$Atılır.
6. Her şeyi kabul etmekle .$N$: örnek bir ekstra token $t_{N+1}$-$q_{N+1}$(Buna karşılık bonus simgesi)

Geri kalan dağılım hilesi , çıkışın tam olarak dağılmasını sağlayan matematiksel bir anlayıştır .$M_q$- İlk defa örnek almıştım.

### Hızlandırmayı belirleyenler

- Bırak .$\alpha$= proje token başına beklenen kabul oranı.$c$= taslak ve denetleyiciler arasındaki maliyet oranı.

- Saçma nesil, her token için bir büyük model çağrısı yapar.
- Spekülatör , her gün 1 büyük model çağrısı yapıyor .$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$Tokenler ne zaman$\alpha$- Yüksek.

Tipik bir kural .$\alpha = 0.75$ve $N = 5$Bu yüzden, bu bir şey değil.

**$\alpha$ depends on:**

- Eğitim verileri aynı aile / aynı eğitim verilerini artırır $\alpha$- Kesinlikle.
- Açgözlü taslakla açgözlü doğrulayıcı: yüksek $\alpha$Temperatür örneklemesi: eşleşmesi zor; kabul düşüyor.
- Görev türü: Kod ve yapılandırılmış çıkış daha fazla (görünülebilir) kabul eder; serbest biçimdeki yaratıcı yazım daha az kabul eder.

### Medusa  bir taslak modeli olmayan taslaklar

Medusa, taslak modelini verifikatörde ekstra çıkış başlıklarıyla değiştirir.`t`- ...

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Her baş kendi logitlerini çıkarır. Sonuç olarak, aday dizisini almak için her baştan örnek alırsınız, sonra tüm aday devamlarını bir anda göz önünde bulundurarak bir ağaç dikkat skeması kullanarak bir ileri geçişle doğrulayın.

Avantajlar: ikinci bir model yok. Eksiler: eğitimli parametreler ekler; denetimli ince ayarlama aşamasına ihtiyaç duyar (~ 1B jetonlar); kabul oranı iyi bir taslakla vanilya spekülasyonundan biraz daha düşüktür.

### KİÇİN  gizli durumları yeniden kullanarak daha iyi bir çizim

EAGLE-1/2/3 (Li et al., 20242025) taslak modelini, doğrulayıcının son katman gizli durumlarını yudumlayan küçük bir transformatör (tipik olarak 1 katman) yapar. Çizgi, doğrulayıcının özellik temsilini gördüğü için tahminleri doğrulayıcının çıkış dağılımıyla güçlü bir şekilde ilişkilidir. Kabul oranları ~0.6 (vanil) 'den 0.85+'e yükseldi. Bunlar sohbet referansları için bir token oranları, sohbet verilerine eşleşen bir taslak ile eğitilmiştir. Karışık üretim trafiği için, EAGLE-3 için 17 · 05 aşaması planları 0.6 ila 0.8 ile ve alan trafiği daha düşük olabilir.

EAGLE-3 (2025) aday devamları üzerinde ağaç arama ekledi. vLLM ve SGLang gemisi EAGLE-2/3 Llama 3/4 ve Qwen 3 için varsayılan özellik yolu olarak.

### KV'nin dansı

Verifikasyon kaynakları $N$Tek ileri geçişle verifikatörün giriş simgelerini çiz. Bu verifikatörün KV önbelleğini $N$Bazı taslaklar reddedildiğinde, önbelleği kabul edilen önbellek uzunluğuna geri çevirmelisiniz.

Üretim uygulamalar (vLLM'ler) `--speculative-config`Bu, ilk önce yaz, kabul üzerine karar ver.

```figure
draft-verify-tokens
```

## Yapın

Bakın .`code/main.py`Temel spekülatör örneği algoritmi (reddedme adım + kalan dağılım) uygulamamız:

- El kodlanmış bir dağılım üzerinde deterministik-yumuşak maksimum olan "büyük bir model" (böylelikle kabul matematikini analitik olarak doğrulayabiliriz).
- Büyük modelin bir rahatsızlığı olan bir "öntem modeli".
- Doğrudan örnekleme ile aynı sınırlı dağılım üreten kabul / reddetme döngüsü.

### Adım 1: reddetme adımı

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ...`q_prob`verifiyeci tarafından hazırlanmış token için olasılık. `p_prob`Leviathan teoremi, Bernoulli'nin bu kararının ardından geri kalanı reddettikten sonra örnekleme yapılması, doğrulayıcının dağılımını tam olarak koruduğudur.

### Adım 2: Geri kalan dağılım

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Kısalt `p`-`q`Bu değerleri sıfıra sıkıştırıp yeniden normalleştirir.

### Adım 3: Bir spekülasyonsal adım

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

Beş kabul edilmiş → bir bonus → altı token bir doğrulayıcı geçişinde üretilmiştir.

### Adım 4: Kabul oranını ölç

10 bin spekülatör adım atmak, farklı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlı tasamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlıamlı

### Adım 5: dağıtım eşdeğerliğini kontrol edin

Empirik olarak: spekülatör döngü tarafından üretilen simgelerin histogramı, doğrudan doğrulayıcıdan örnekleme ile üretilen histogramla eşleşmelidir. Bu pratikte Leviathan teoremi.

## Kullan

Üretim:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

TensorRT-LLM'de 2026 ortalarında en hızlı Medusa yolu var.`faster-whisper`Whisper-large için spekülatörlü bir kodlama yaparak küçük bir taslakla kaplıyor.

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- Tek sıralama jenerasyonu 15 token.
- Çok yaratıcı / yüksek sıcaklık örneklemesi ($\alpha$(Düşükler).
- Hatıra sınırlı dağıtımlar (önzet modeli VRAM ekler).

## Gönder

Bakın .`outputs/skill-spec-decode-picker.md`. Yetenek yeni bir sonucu oluşturmak için spekülatör bir çözme stratejisi (vanil / Medusa / EAGLE / lookahead) ve ayarlama parametreleri (N, taslak sıcaklık) seçer.

## Egzersizler

1. **Easy.**Çık .`code/main.py`. Spekülatör token dağıtımının, verifikatörün p = 0.05 çerez içinde 50.000 token üzerinde doğrudan örnek dağıtımına uygun olduğunu onaylayın.
2. **Medium.** fonksiyonu olarak plan hızlandırılması (büyük model için tokens)$N$için$\alpha = 0.5, 0.7, 0.85$- En iyi olanı belirle$N$Her biri için$\alpha$. (Tip: Verify call başına beklenen token = $(1 - \alpha^{N+1}) / (1 - \alpha)$.)
3. **Hard.**Küçük bir Medusa uygulayın: 14. dersten alın GPT, t+2, t+3, t+4 pozisyonlarını tahmin eden 3 ekstra LM başını ekleyin.
4. **Hard.**Geri dönüşü uygulayın: 10 token ön harf KV ön harfinden başlayarak, 5 taslak belirticiyi besleyin, 3. pozisyonda bir reddedmeyi simüle edin. Ön harfinizin okumalarının bir sonraki iterasyonda "ön harf + ilk 2 kabul edilen taslak" ile doğru eşleştiklerini kontrol edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## Daha Fazla Okumak

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) çekirdek algoritması ve eşdeğerlik teoremi.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) eş zamanlı giriş; Bernoulli reddetme kanıtı temiz.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) Medusa kağıdı; ağaçlara dikkatle bakım.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) EAGLE-1; gizli devlet koşullu taslak.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) Eagle-2; dinamik ağaç derinliği.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840)- Eagle-3.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057)- Göz önüne bak, taslaksız yaklaşım.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) dört stratejinin de bağlantılı olarak kanonik üretim referansı.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) EAGLE-1/2/3 için referans kodu.
