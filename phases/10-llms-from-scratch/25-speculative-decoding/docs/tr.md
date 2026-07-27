# Spekülatif Kod Çözme ve KARTAL

> Bir token üreten bir sınır LLM'si milyarlarca parametre üzerinden tam ileri geçiş gerektirir. Bu ileri geçiş aşırı derecede fazla provizyonlanmıştır: çoğu zaman çok daha küçük bir model sonraki 3-5 token'yi doğru tahmin edebilir ve büyük modelin yalnızca tahminleri *doğrulaması* gerekir. Tahmininiz doğru olduğunda, bir fiyatına 5 token sahibi olacaksınız. Spekülatif kod çözme (Leviathan ve diğerleri 2023) bunu kesinleştirdi ve EAGLE-3 (2025), kabul oranlarını doğrulama başına ~4,5 token'ye yükseltti; bu, eşleşen çıktı dağıtımında 4-5 kat hızlanma demekti.

**Tür:** Yapım
**Diller:** Python (numpy ile)
**Önkoşullar:** Aşama 10 Ders 12 (Inference Optimizasyon), Aşama 10 Ders 04 (Eğitim Öncesi Mini-GPT)
**Süre:** ~75 dakika

## Sorun

H100'de 70B sınıfı bir model için kod çözme verimi genellikle 40-80 tokens/saniyedir. Her token, HBM'den tüm model ağırlıklarının okunduğu tam bir ileri geçiş gerektirir. Çıktısını değiştirmeden modeli küçültemezsiniz. Toplu iş boyutunu belleğin ötesine artıramazsınız. Modelin ileri geçiş başına birden fazla token çıktısı almasına izin vermediğiniz sürece takılıp kalırsınız.

Otoregresif nesil doğası gereği seri görünüyor: `x_{t+1} = sample(p(· | x_{1:t}))`. Ancak eşzamanlılık fırsatı var. "Sonraki 4 token muhtemelen [a, b, c, d]" diyen ucuz bir tahminciniz varsa, **büyük modelin tek bir ileri geçişinde** 5 konumun tamamını doğrulayabilir ve eşleşen en uzun öneki kabul edebilirsiniz.

Leviathan, Kalai, Matias (2023, "Spekülatif Kod Çözme yoluyla Transformer'lerden Hızlı Inference"), hedef modelin örnekleme dağılımını koruyan akıllı bir kabul/ret kuralı aracılığıyla bunu kesin olarak gerçekleştirdi. Aynı çıkış dağıtımı, 2-4 kat daha hızlı.

## Konsept

### İki Modelli Kurulum

- **Hedef model** `M_p`: Örneklerini gerçekten istediğiniz büyük, yavaş, yüksek kaliteli model. Dağıtım: `p(x)`.
- **Taslak model** `M_q`: küçük, hızlı, düşük kaliteli bir model. Dağıtım: `q(x)`. 5-30× daha küçük.

Adım başına:

1. Taslak model `K` token'leri otoregresif olarak önermektedir: `x_1, x_2, ..., x_K ~ q`.
2. Hedef model, tüm `K+1` pozisyonları üzerinden paralel olarak BİR ileri geçişi çalıştırır ve önerilen her token için `p(x_k)` üretir.
3. Aşağıdaki değiştirilmiş reddetme örnekleme kuralı aracılığıyla soldan sağa her token'yi kabul edin/reddedin. Eşleşen en uzun öneki kabul edin.
4. Herhangi bir token reddedilirse, değiştirileni düzeltilmiş dağıtımdan örnekleyin ve durdurun. Aksi takdirde `p(· | x_1...x_K)`'den bir bonus token örneği alın.

Taslak hedefle mükemmel bir şekilde eşleşirse ileri hedef başına K+1 token alırsınız. Taslak 1. konumda yanlışsa yalnızca 1 token alırsınız.

### Kesinlik Kuralı

Spekülatif kod çözme **dağıtım açısından p'den örneklemeye eşdeğerdir**. Reddetme kuralı:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

burada `(p - q)+` noktasal farkın pozitif kısmını gösterir. Taslak ve hedef aynı fikirde olduğunda (`p ≈ q`) kabul neredeyse 1'dir. Aynı fikirde olmadıklarında, kalan dağılım, genel numunenin hala tam olarak `p` olacağı şekilde yapılandırılır.

**Açgözlü durum.** Sıcaklık=0 örnekleme için sadece `argmax(p) == x_t`'yi kontrol edin. Evet ise kabul edin; hayırsa, `argmax(p)` çıktısını alın ve durun.

### Beklenen Hızlanma

Taslak modelin token düzeyi kabul oranı `α` ise hedef ileri geçiş başına üretilen beklenen token'ler şöyledir:

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = draft length, α in [0, 1]
```

`α = 0.8, K = 4`'de: İletme başına `(1 - 0.8^5)/(1 - 0.8) = 3.36` token. Tek bir hedefin ileri maliyeti kabaca `cost_q * K + cost_p`'dir (K taslak adım artı bir hedef doğrulama). `cost_p >> cost_q * K` ise üretimdeki hızlanma oranı `3.36× / 1 = 3.36×` olur.

Tek gerçek parametre, tamamen taslak hedef hizalamasına bağlı olan `α`'dir. İyi bir taslak her şeydir.

### Taslağı Eğitmek: Damıtma

Rastgele küçük bir model kötü bir taslak oluşturur. Standart tarif hedeften damıtmaktır:

1. Küçük bir mimari seçin (70B hedefi için ~1B, 7B hedefi için ~500M).
2. Hedef modeli geniş bir metin külliyatı üzerinde çalıştırın; sonraki token dağıtımlarını saklayın.
3. Taslağı hedefin dağılımına karşı KL sapması ile eğitin (gerçek token'lere karşı değil).

Sonuç: `α` genellikle kodlamada 0,6-0,8, doğal dil sohbetinde 0,7-0,85. Üretimde 2-3 kat hızlanma.

### EAGLE: Ağaç Taslağı + Özelliğin Yeniden Kullanımı

Li, Wei, Zhang, Zhang (2024, "EAGLE: Spekülatif Örnekleme Özellik Belirsizliğinin Yeniden Düşünülmesini Gerektirir") standart spekülatif kod çözmede iki verimsizlik gözlemledi:

1. Taslak, her biri tam yığın olan K seri adımı gerçekleştirir. Ancak taslak, hedefin en son doğrulamadaki özelliklerini (gizli durumları) yeniden kullanabilir; hedef, taslağın sıfırdan yeniden türetildiği zengin temsilleri zaten hesaplamıştır.
2. Taslak doğrusal bir zincirin çıktısını verir. Taslak adaylardan oluşan bir *ağaç* çıktısı verebilseydi (her düğüm birden fazla tahminde bulunursa), hedefin tek ileri geçişi bir ağaç dikkat maskesi aracılığıyla birden fazla aday yolunu paralel olarak doğrulayabilir ve kabul edilen en uzun dalı seçebilir.

EAGLE-1 değişiklikleri:
- Taslak girdi = hedefin t konumundaki son gizli durumu, ham token'ler değil.
- Taslak mimari = 1 transformer kod çözücü katmanı (ayrı bir küçük model değil).
- Çıktı = K ağacı = derinlik başına 4-8 aday, derinlik 4-6.

EAGLE-2 (2024) dinamik ağaç topolojisi ekler: ağaç, taslağın belirsiz olduğu yerde genişler ve güvenli olduğu yerde dar kalır. Doğrulama maliyetini artırmadan `α_effective`'yi yükseltir.

EAGLE-3 (Li ve diğerleri 2025, "EAGLE-3: Inference Eğitim Süresi Testi Yoluyla Büyük Dil Modellerinin Hızlandırılması"), sabit üst katman özellik bağımlılığını ortadan kaldırır ve taslağı yeni bir "test süresi simülasyonu" kaybıyla eğitir — taslak, öğretmen tarafından zorlanan eğitim dağıtımı yerine hedefin test süresi dağılımıyla eşleşen çıktılar üzerinde eğitilir. Kabul oranı 0,75'ten (EAGLE-2) 0,82'ye (EAGLE-3) yükselir ve ortalama token/doğrulama 3,0'dan 4,5'e çıkar.

### Ağaç Dikkat Doğrulaması

Taslak bir ağacın çıktısını aldığında, hedef model bunu bir **ağaç dikkat maskesi** (saf bir çizgi yerine ağaç topolojisini kodlayan nedensel bir maske) kullanarak tek bir ileri geçişte doğrular. Her token yalnızca ağaçtaki atalarına katılır. Doğrulama geçişi hâlâ bir ileri, bir matmuldur; topolojik maske yalnızca birkaç ekstra KV girişine mal olur.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

`a, b` birinci token adaylarıyla yarışıyorsa ve `c, d, e, f` ikinci token adaylarıyla yarışıyorsa altı konumun tümü tek bir ileri geçişte doğrulanır. Çıktı, kabul edilen herhangi bir yol boyunca en uzun önektir.

### Kazandığında, Kazanmadığında

**Kazanılanlar:**
- Tahmin edilebilir metinle (kod, ortak İngilizce, yapılandırılmış çıktı) sohbet edin / tamamlayın. `α` yüksek.
- Kod çözme sırasında (belleğe bağlı aşama) kullanılmayan GPU hesaplamalı ayarlar. Ağaç çizimi mevcut FLOP'ları kullanır.

**Kaybetme/kazanmama:**
- Son derece stokastik çıktılar (yüksek sıcaklıkta yaratıcı yazma). `α`, `1/|vocab|`'ye doğru düşüyor.
- Çok yüksek eşzamanlılıkla toplu hizmet — toplu işlem zaten FLOP'ları dolduruyor, ağaç doğrulaması için çok az yer var.
- Taslağın çok daha küçük olmadığı çok küçük hedef modeller.

Prodüksiyon atölyeleri genellikle sohbette duvar saati hızının 2-3 kat, kod oluşturmada 3-5 kat ve yaratıcı yazmada sıfıra yakın hızlanma rapor ediyor.

```figure
speculative-decoding
```

## İnşa Et

`code/main.py`:

- Tam reddetme kuralını uygulayan ve hedefin dağılımını koruduğunu doğrulayan bir referans `speculative_decode(target, draft, prompt, K, temperature)` (ampirik KL < 0,01'e karşı düz hedef örnekleme).
- Üstten dallanmayla K derinliğinde bir ağaç oluşturan EAGLE tarzı bir ağaç çizici.
- Doğrulayıcı için doğru nedensel modeli üreten bir ağaç dikkat maskesi oluşturucu.
- Her ikisini de küçük bir LM üzerinde çalıştıran kabul oranlı bir koşum takımı (bir GPT-2-küçük, bir GPT-2-orta hedeften damıtılır).

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_probs[k]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_probs[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## Kullan onu

- **vLLM** ve **SGLang** birinci sınıf spekülatif kod çözme özelliği sunar. Bayraklar: `--speculative_model`, `--num_speculative_tokens`. EAGLE-2/3 desteği `--spec_decoding_algorithm eagle` bayrağı aracılığıyla.
- **NVIDIA TensorRT-LLM** Medusa ve EAGLE ağaçlarını yerel olarak destekler.
- **Referans taslak modeller**: `Qwen/Qwen3-0.6B-spec` (Qwen3-32B için taslaklar), `meta-llama/Llama-3.2-1B-Instruct-spec` (70B için taslaklar).
- **Medusa kafaları** (Cai ve diğerleri 2024, "Medusa: Çoklu Kod Çözme Kafalarıyla Basit LLM Inference Hızlandırma Framework"): taslak model yerine, hedefin kendisine K paralel tahmin kafası ekleyin. Dağıtımı daha basit, kabulü EAGLE'a göre biraz daha düşük.

## Gönderin

Bu ders, hedef modelin iş yükünün profilini çıkaran ve şunları seçen bir beceri olan `outputs/skill-speculative-tuning.md`'yi üretir: taslak modeli, K (taslak uzunluğu), ağaç genişliği, sıcaklık ve ne zaman düz kod çözmeye geri dönüleceği.

## Egzersizler

1. Reddetme kuralını tam olarak uygulayın ve deneysel olarak doğrulayın. `speculative_decode` ve düz hedef örnekleme yoluyla 10.000 örnek çalıştırın; İki çıkış dağıtımı arasındaki TV mesafesini hesaplayın. < 0,01 olmalıdır.

2. Hızlandırma formülünü hesaplayın. Sabit `α` ve `K` verildiğinde, ileri hedef başına beklenen token'lerin grafiğini çıkarın. α ∈ {0,5, 0,7, 0,9} için en uygun K'yı bulun.

3. Küçük bir taslağı eğitin. 124M GPT-2 hedefini alın ve KL kaybıyla 100M token'lerde 30M GPT-2 taslağını damıtın. Uzatılan metinde `α` değerini ölçün. Beklenen: 0,6-0,7.

4. EAGLE tarzı ağaç çizimini uygulayın. Bir zincir yerine, her derinlikte ilk 3 dalın taslak çıktısını alın. Ağaç dikkat maskesini oluşturun. Hedefin en uzun doğru dalı kabul ettiğini doğrulayın.

5. Arıza modlarını ölçün. Spekülatif kod çözmeyi sıcaklık=1,5'te (yüksek stokastisite) çalıştırın. α'nın çöktüğünü ve algoritmanın taslak yükü nedeniyle düz kod çözme işleminden daha yavaş olduğunu gösterin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Hedef modeli | "Büyük model" | Örneklerini istediğiniz yavaş, yüksek kaliteli model (p dağıtımı) |
| Taslak model | "Spekülatör" | Küçük, hızlı tahminci (q dağılımı); 5-30 kat daha küçük |
| K / taslak uzunluğu | "İleriye bakış" | Doğrulama geçişi başına tahmin edilen token sayısı |
| α / kabul oranı | "İsabet oranı" | Taslağın teklifinin kabul edilme olasılığı token başına |
| Tam ret kuralı | "Kabul testi" | r < hedefin dağılımını koruyan p/q karşılaştırması |
| Artık dağıtımı | "Düzeltilmiş p-q" | (p - q)+ / ||(p - q)+||_1, reddedilme durumunda örneklenecek dağılım |
| Ağaç çizimi | "Dallanma spekülasyonu" | Taslak, ağaç yapılı dikkat maskesiyle tek geçişte doğrulanan bir aday ağacı çıkarır |
| Ağaç dikkat maskesi | "Topolojik maske" | Ağaç topolojisini kodlayan nedensel maske, böylece her düğüm yalnızca atalarıyla ilgilenir |
| Medusa kafaları | "Paralel kafalar" | K ekstra tahmin hedefin kendisine yöneliyor; ayrı bir taslak model yok |
| EAGLE özelliğinin yeniden kullanımı | "Gizli durum taslağı" | Taslak girişi, ham token'ler değil, hedefin son gizli durumudur; taslağı daraltır |
| Test süresi simülasyon kaybı | "KARTAL-3 eğitimi" | Taslağı öğretmen zorlamasıyla değil, hedefin test süresi dağılımıyla eşleşen çıktılar üzerine eğitin |

## Daha Fazla Okuma

- [Leviathan, Kalai, Matias, 2023 — "Spekülatif Kod Çözme yoluyla Transformer'lerden hızlı Inference"](https://arxiv.org/abs/2211.17192) — kesin reddetme kuralı ve teorik hızlandırma analizi
- [Chen, Borgeaud, Irving ve diğerleri, 2023 — "Spekülatif Örnekleme ile Büyük Dil Modeli Kod Çözmeyi Hızlandırma"](https://arxiv.org/abs/2302.01318) — DeepMind'da eş zamanlı spekülatif örnekleme makalesi
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Çoklu Kod Çözme Kafalarıyla Basit LLM Inference Hızlandırma Framework"](https://arxiv.org/abs/2401.10774) — taslak modele alternatif paralel kafalar
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Spekülatif Örnekleme, Özellik Belirsizliğinin Yeniden Düşünülmesini Gerektirir"](https://arxiv.org/abs/2401.15077) — özelliğin yeniden kullanımı ve ağaç taslağı oluşturma
- [Li ve diğerleri, 2024 — "EAGLE-2: Dinamik Taslak Ağaçlarla Dil Modellerinin Daha Hızlı Inference"](https://arxiv.org/abs/2406.16858) — dinamik ağaç topolojisi
- [Li ve diğerleri, 2025 — "EAGLE-3: Eğitim Süresi Testi Yoluyla Inference Büyük Dil Modellerinin Hızlandırılmasının Ölçeklendirilmesi"](https://arxiv.org/abs/2503.01840) — eğitim süresi test süresi eşleştirmesi
- [Fu, Haotian, Peng ve diğerleri, 2024 — "Öncü Kod Çözmeyi Kullanarak LLM Inference'nin Sıralı Bağımlılığını Kırın"](https://arxiv.org/abs/2402.02057) — Jacobi/lookahead kod çözme, spekülatörsüz bir alternatif
