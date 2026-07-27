# Spekülatif Kod Çözme — Taslak, Doğrulama, Tekrarlama

> Otoregresif kod çözme seridir. Her token bir öncekini bekler. Spekülatif kod çözme zinciri kırar: Ucuz bir model N token taslağı hazırlar, pahalı model ise tüm N'yi tek bir ileri geçişte doğrular. Draft doğru olduğunda N nesil boyunca büyük bir forvet ödemiş olursunuz.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 07 (GPT Nedensel LM), Aşama 7 · 12 (KV Önbellek ve Flash Dikkat)
**Süre:** ~60 dakika

## Sorun

Bir 70B LLM örneklemesi token, H100'de ~30 ms sürer. 3B taslak modeli ~3 ms sürer. 3B taslağının 5 tokens ileri gitmesine izin verirsek, ardından 5'in tamamını doğrulamak için 70B'yi *bir kez* çalıştırırsak, kabul edilen 5 token'ye kadar toplam `5×3 + 30 = 45 ms` olur — buna karşılık düz çizgi oluşturma için `5×30 = 150 ms` olur. Tam spekülatif kod çözme aşaması budur: 2-4 kat daha düşük kod çözme gecikmesi için az miktarda ekstra GPU belleği (taslak model) kullanın.

İşin püf noktası dağıtımı korumaktır. Leviathan ve diğerleri tarafından tanıtılan spekülatif örnekleme. (2023) ve Chen ve ark. eşzamanlı olarak çıktı dizisinin, büyük modelin kendi başına üreteceği çıktı dizisiyle **aynı şekilde dağıtıldığını** garanti eder. Kalite değiş tokuşu yok. Sadece daha hızlı.

Taslak doğrulayıcı çiftlerinden oluşan dört aile 2026'ya inference hakimdir:

1. **Vanilya spekülatif (Leviathan 2023).** Ayrı taslak model (e.g., Llama 3 1B) + doğrulayıcı (e.g., Llama 3 70B).
2. **Medusa (Cai 2024).** Doğrulayıcıdaki birden fazla kod çözme kafası, `t+1..t+k` konumlarını paralel olarak tahmin eder. Ayrı bir taslak model yok.
3. **EAGLE ailesi (Li 2024, 2025).** Doğrulayıcının gizli durumlarını yeniden kullanan hafif taslak; vanilyaya göre daha yakın kabul oranı; 3–4× tipik.
4. **Önleme kod çözme (Fu 2024).** Jacobi yinelemesi; hiçbir taslak modele gerek yoktur. Kendi kendine spekülasyon. Niş ama bağımlılık içermez.

2026'daki her üretim inference yığını, varsayılan olarak spekülatif kod çözme gönderir. vLLM, TensorRT-LLM, SGLang ve llama.cpp'nin tümü en azından Vanilla + EAGLE-2'yi destekler.

## Konsept

### Temel algoritma

Doğrulayıcı `M_q` ve daha ucuz bir taslak `M_p` verildiğinde:

1. Halihazırda kodu çözülmüş olan önek `x_1..x_k` olsun.
2. **Taslak**: Taslak olasılıkları `p_1..p_N` ile otomatik regresif olarak `d_{k+1}, d_{k+2}, ..., d_{k+N}` önermek için `M_p` kullanın.
3. **Paralel olarak doğrulayın**: `M_q`'yi `x_1..x_k, d_{k+1}, ..., d_{k+N}` üzerinde bir kez çalıştırın, `k+1..k+N+1` konumları için doğrulama olasılıklarını `q_1..q_{N+1}` alın.
4. **Soldan sağa her token taslağını kabul edin/reddedin**: her `i` için, `min(1, q_i(d_i) / p_i(d_i))` olasılıkla kabul edin.
5. `j` konumundaki ilk reddetmede: "artık" dağılım `(q_j - p_j)_+`'dan normalleştirilmiş `t_j` örneği. `j` sonrasındaki tüm taslaklar atılır.
6. Tüm `N`'ları kabul ettiğinizde: `q_{N+1}`'den ekstra bir token `t_{N+1}` örneği alın (ücretsiz bonus token).

Artık dağıtım hilesi, çıktının tam olarak `M_q` sıfırdan örneklenmiş gibi dağıtılmasını sağlayan matematiksel içgörüdür.

### Hızlanmayı ne belirler?

`α` = taslak başına beklenen kabul oranı token olsun. `c` = taslak-doğrulayıcı maliyet oranı olsun. Adım başına:

- Naif nesil, token başına 1 büyük model çağrısı yapar.
- Spekülatif, `α` yüksek olduğunda her `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` tokens başına 1 büyük model çağrısı yapar.

`α = 0.75` ve `N = 5` için tipik genel kural: 3 kat daha az büyük model çağrısı. Taslak maliyeti 5 kat ucuz. Toplam duvar saati ~2,5 kat düşer.

**α şunlara bağlıdır:**

- Taslağın doğrulayıcıya ne kadar iyi yaklaştığı. Aynı aile / aynı eğitim verileri α'yı önemli ölçüde artırır.
- Kod çözme stratejisi. Açgözlü doğrulayıcıya karşı açgözlü taslak: yüksek α. Sıcaklık örneklemesi: eşleşmesi daha zor; kabul düşer.
- Görev türü. Kod ve yapılandırılmış çıktı daha fazlasını kabul eder (tahmin edilebilir); serbest biçimli yaratıcı yazı daha az kabul eder.

### Medusa — taslak modeli olmayan taslaklar

Medusa, taslak modeli, doğrulayıcıdaki ekstra çıktı kafalarıyla değiştirir. `t` konumunda:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Her kafa kendi logitlerini çıkarır. inference noktasında bir aday dizisi elde etmek için her bir baştan numune alırsınız, ardından tüm aday devamlarını aynı anda dikkate alan bir ağaç dikkat şeması kullanarak bir ileri geçişle doğrularsınız.

Artıları: ikinci model yok. Eksileri: eğitilebilir parametreler ekler; denetlenen bir fine-tuning aşamaya (~1B tokens) ihtiyaç duyar; kabul oranı iyi bir taslağa sahip vanilya spekülatifinden biraz daha düşüktür.

### EAGLE — gizli durumları yeniden kullanarak daha iyi taslak

EAGLE-1/2/3 (Li ve diğerleri, 2024–2025), taslak modeli, doğrulayıcının son katmandaki gizli durumlarını alan küçük bir transformer (tipik olarak 1 katman) haline getirir. Taslak, doğrulayıcının özellik temsilini gördüğünden, tahminleri, doğrulayıcının çıktı dağılımıyla güçlü bir şekilde ilişkilidir. Kabul oranları ~0,6'dan (vanilya) 0,85+'ye yükseliyor.

EAGLE-3 (2025), aday devamlarının üzerine ağaç aramayı ekledi. vLLM ve SGLang, Llama 3/4 ve Qwen 3 için varsayılan spesifikasyon yolu olarak EAGLE-2/3'ü gönderir.

### KV önbellek dansı

Doğrulama, tek bir ileri geçişte `N` taslak token'yi doğrulayıcıya besler. Bu, doğrulayıcının KV önbelleğini `N` giriş kadar genişletir. Bazı taslaklar reddedilirse önbelleği kabul edilen önek uzunluğuna geri döndürmeniz gerekir.

Üretim uygulamaları (vLLM'nin `--speculative-model`'si, TensorRT-LLM'nin LookaheadDecoder'ı) bunu sıfırdan KV arabellekleriyle ele alır. Önce yazın, kabul etmeyi taahhüt edin. Kavramsal olarak zor değil ama meşakkatli.

## Build It — Kendin Oluştur

Bkz. `code/main.py`. Temel spekülatif örnekleme algoritmasını (red adımı + artık dağılım) aşağıdakilerle uyguluyoruz:

- Elle kodlanmış bir dağılım üzerinde deterministik bir softmax olan "büyük model" (böylece kabul matematiğini analitik olarak doğrulayabiliriz).
- Büyük modelin tedirginliği olan bir "taslak model".
- Doğrudan örneklemeyle aynı marjinal dağılımı üreten bir kabul/red döngüsü.

### Adım 1: reddetme adımı

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` tekdüze bir rastgele sayıdır. `q_prob`, taslak halindeki token için doğrulayıcının olasılığıdır. `p_prob` taslak modelin olasılığıdır. Leviathan teoremi, bu Bernoulli kararının ve ardından ret üzerine artıktan örneklemenin, doğrulayıcının dağılımını tam olarak koruduğu yönündedir.

### Adım 2: artık dağılım

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Eleman bazında `p`'ı `q`'dan çıkarın, negatif değerleri sıfıra sıkıştırın, yeniden normalleştirin. Herhangi bir reddedilme durumunda bundan örnek alın.

### Adım 3: spekülatif bir adım

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

Beşi kabul edildi → bir bonus → bir doğrulama geçişinde altı token üretildi.

### 4. Adım: Kabul oranını ölçün

Değişen taslak kalitesi düzeylerinde 10.000 spekülatif adımı çalıştırın. Taslak ve doğrulayıcı dağılımları arasındaki çizim kabul oranı ve KL farklılığı. Temiz, monoton bir ilişki görmelisiniz.

### Adım 5: Dağıtım denkliğini doğrulayın

Ampirik olarak: spekülatif döngü tarafından üretilen token'lerin histogramı, doğrudan doğrulayıcıdan örnekleme yoluyla üretilen histogramla eşleşmelidir. Bu pratikte Leviathan teoremidir. Ki-kare testi örnekleme hatasını doğrular.

## Use It — Uygula

Üretme:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model /models/llama-3.1-eagle-70b \
    --speculative-draft-tensor-parallel-size 1 \
    --num-speculative-tokens 5

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-speculative-tokens 5
```

TensorRT-LLM, 2026 ortası itibarıyla en hızlı Medusa yoluna sahiptir. `faster-whisper` Whisper-large için spekülatif kod çözmeyi küçük bir taslakla tamamlıyor.

**Taslak seçme:**

| Strateji | Ne zaman seçilmeli | Hızlandırma |
|----------|--------------|---------|
| Vanilya taslağı (1B/3B Lama ailesi) | Hızlı prototip, eğitim gerektirmez | 1,8–2,3× |
| Medusa kafaları | Doğrulayıcıda ince ayar yapabilirsiniz | 2–3× |
| KARTAL-2 / 3 | Üretim, maksimum hız | 3–4× |
| İleriye Bak | Taslak yok, eğitim yok, ekstra parametre yok | 1,3–1,6× |

**Özel kod çözme işlemi YAPILMADIĞINDA:**

- 1–5 tokens'lik tek sıralı üretim. Tepegöz hakimdir.
- Son derece yaratıcı / yüksek sıcaklıkta örnekleme (α damlaları).
- Bellek kısıtlı deployment'ler (taslak model VRAM ekler).

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-spec-decode-picker.md`. Beceri, yeni bir inference iş yükü için spekülatif bir kod çözme stratejisi (vanilya / Medusa / EAGLE / ileri bakış) ve ayar parametrelerini (N, taslak sıcaklığı) seçer.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. Spekülatif token dağılımının, ki-kare p > 0,05 dahilinde 50.000 tokens'de doğrulayıcının doğrudan örnek dağılımıyla eşleştiğini doğrulayın.
2. **Orta.** `α = 0.5, 0.7, 0.85` için `N`'nin bir fonksiyonu olarak çizim hızı (büyük model ileri başına tokens). Her α için optimal `N`'yi belirleyin. (İpucu: doğrulama çağrısı başına beklenen tokens = `(1 - α^{N+1}) / (1 - α)`.)
3. **Zor.** Küçük bir Medusa uygulayın: Ders 14'teki GPT'yi alın, t+2, t+3, t+4 konumlarını tahmin eden 3 ekstra LM kafası ekleyin. Çoklu kafa kaybıyla birlikte TinyShakespeare üzerinde antrenman yapın. Kabul oranlarını, aynı modelin kesilmesiyle oluşturulan standart taslakla karşılaştırın.
4. **Zor.** Geri alma işlemini uygulayın: 10-token öneki KV önbelleğiyle başlayın, 5 taslak token besleyin, 3. konumda bir reddetmeyi simüle edin. Bir sonraki yinelemede önbellek okumalarınızın "ön ek + kabul edilen ilk 2 taslak" ile doğru şekilde eşleştiğini doğrulayın.

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Taslak model | "Ucuz olan" | Aday token'ları öneren daha küçük bir model; genellikle doğrulayıcıdan 10–50 kat daha ucuzdur. |
| Doğrulayıcı | "Büyük olan" | Dağılımını koruduğumuz hedef model; spekülatif adım başına bir kez çalışır. |
| Kabul oranı (α) | "Taslağın ne sıklıkla doğru olduğu" | Doğrulayıcının taslağı kabul etme olasılığı -token başına. 0,7–0,9 tipik. |
| Artık dağıtımı | "Reddetme geri dönüşü" | `(q - p)_+` normalleştirildi; Reddetme durumunda bundan örnekleme, doğrulayıcının dağılımını korur. |
| Bonus token | "Ücretsiz olan" | Tüm N taslaklar kabul edildiğinde, doğrulayıcının bir sonraki adım dağıtımından bir tane daha örnekleyin. |
| Medusa | "Taslaksız spekülatif" | Doğrulayıcıdaki birden fazla LM kafası paralel olarak t+1..t+k konumlarını tahmin eder. |
| KARTAL | "Gizli durum taslağı" | Doğrulayıcının son katmandaki gizli durumlarına göre koşullandırılmış küçük transformer taslak. |
| İleriye dönük kod çözme | "Jacobi yinelemesi" | Sabit nokta yinelemesini kullanarak kendi kendine spekülasyon; taslak model yok. |
| Ağaç dikkati | "Birçok adayı aynı anda doğrulayın" | Aynı anda birden fazla taslak devamını dikkate alan dallanma doğrulaması. |
| KV'yi geri alma | "Reddedilen taslakları geri al" | KV arabelleğini kazıyın; kabul edersen taahhüt edersin, reddedersen atarsın. |

## Daha Fazla Okuma

- [Leviathan, Kalman, Matias (2023). Spekülatif Kod Çözme](https://arxiv.org/abs/2211.17192) yoluyla Transformer'lardan hızlı Inference — çekirdek algoritma ve eşdeğerlik teoremi.
- [Chen ve ark. (2023). Spekülatif Örnekleme ile Büyük Dil Modeli Kod Çözmeyi Hızlandırma](https://arxiv.org/abs/2302.01318) — eşzamanlı giriş; temiz Bernoulli reddi kanıtı.
- [Cai ve ark. (2024). Medusa: Çoklu Kod Çözme Kafalarıyla Basit LLM Inference Hızlandırma Framework](https://arxiv.org/abs/2401.10774) — Medusa kağıdı; ağaç dikkat doğrulaması.
- [Li ve ark. (2024). EAGLE: Spekülatif Örnekleme, Özellik Belirsizliğinin Yeniden Düşünülmesini Gerektirir](https://arxiv.org/abs/2401.15077) — EAGLE-1; gizli durum koşullu taslak.
- [Li ve ark. (2024). EAGLE-2: Dinamik Taslak Ağaçlarla Daha Hızlı Inference Dil Modelleri](https://arxiv.org/abs/2406.16858) — EAGLE-2; dinamik ağaç derinliği.
- [Li ve ark. (2025). EAGLE-3: Eğitim Süresi Testi Yoluyla Büyük Dil Modellerinin Inference Hızlandırılması](https://arxiv.org/abs/2503.01840) — EAGLE-3.
- [Fu ve ark. (2024). İleriye Yönelik Kod Çözmeyi Kullanarak LLM Inference'nin Sıralı Bağımlılığını Kırın](https://arxiv.org/abs/2402.02057) — ileriye dönük, taslaksız yaklaşım.
- [vLLM docs — Spekülatif Kod Çözme](https://docs.vllm.ai/en/latest/features/spec_decode.html) — dört stratejinin hepsinin bağlı olduğu kanonik üretim referansı.
- [SafeAILab / EAGLE referans uygulaması](https://github.com/SafeAILab/EAGLE) — EAGLE-1/2/3 için referans kodu.
