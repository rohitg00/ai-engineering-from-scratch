# İsteğe bağlı Çözümleme ve KİÇİK

> Tek bir token üreten bir sınır LLM, milyarlarca parametre üzerinde tam bir ileri geçiş gerektirir. Bu ileri geçiş büyük ölçüde fazla bekleniyor: Çoğu zaman çok daha küçük bir model sonraki 3-5 tokeni doğru tahmin edebilir ve büyük model sadece tahminini * doğrulayabilir. Tahmin doğru olduğunda bir tanenin fiyatına 5 tane token aldın. Tahmin edici çözme (Leviathan et al. 2023) bunu tam olarak yaptı ve EAGLE-3 (2025) kabul oranlarını doğrulama başına ~4.5 tokene doğruladı  eşleşen çıkış dağıtımında 4-5x hızlandırma.

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## Sorun

H100'deki 70B sınıfı model için dekodeleme throughputı tipik olarak saniyede 40-80 token'dir. Her token HBM'den tüm model ağırlıklarını okuyan tam bir ileri geçiş gerektirir. Çıktığını değiştirmeden modelini küçültemezsiniz. Hatıra boyutunu artırabilirsiniz. Ön geçiş başına modelin bir token'dan fazla çıkmasına izin vermedikçe sıkışmışsınız 

Autoregresif nesil doğuştan seri görünmektedir:`x_{t+1} = sample(p(· | x_{1:t}))`Eğer "sonraki 4 token muhtemelen [a, b, c, d]" diyen ucuz bir tahminci varsa, a'daki tüm 5 pozisyonu doğrulayabilirsiniz.**single forward pass of the big model**ve en uzun eşleşen önsehifi kabul edin.

Leviathan, Kalai, Matias (2023, "Speculative Decoding via Fast Inference from Transformers") bunu hedef modelin örnekleme dağılımını koruyan akıllı kabul / reddet kuralı ile yaptı. Aynı çıkış dağılım, 2-4 x daha hızlı.

## Anlaşım

### İki Modelin Kuruluşu

- **Target model** `M_p`Büyük, yavaş ve kaliteli modelden örnek almak istediğiniz.`p(x)`- Evet .
- **Draft model** `M_q`: küçük, hızlı ve düşük kaliteli bir model.`q(x)`5-30 kat daha küçük.

Adım başına:

1. Önerilen model taslağı `K`Tokens autoregressiv olarak: `x_1, x_2, ..., x_K ~ q`- Evet .
2. Hedef modeli tümü üzerinde bir ileri geçiş yapar .`K+1`paralel pozisyonlar, üreten `p(x_k)`Teklif edilen her simge için.
3. Aşağıdaki değiştirilmiş reddetme örnekleme kuralıyla her token'ı soldan sağa kabul/reddet. En uzun eşleşen önlamayı kabul edin.
4. Eğer bir token reddedildiyse, düzeltilmiş dağıtımdan değiştirilen token örneğini alın ve durdurun.`p(· | x_1...x_K)`- Evet .

Eğer taslak hedefe mükemmel bir şekilde uymuşsa, hedef öne doğru gönderilen her bir kişi için K+1 jetonu alırsınız. Eğer taslak pozisyon 1'de yanlış ise, sadece 1 jetonu alırsınız.

### Doğruluk Kuralı

Tahmin edici şifreleme **provably equivalent in distribution to sampling from p**- Reddetme kuralı:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

nerede`(p - q)+`Bu, bir proje ve hedef için uygun olduğunda (`p ≈ q`1) kabul oranı neredeyse 1. Eğer anlaşmazlık yaşarlarsa, kalan dağılım, genel örnekin hala tam olarak aynı şekilde yapılandırılır.`p`- Evet .

**Greedy case.**Temperature=0 örneklemesi için sadece kontrol edin `argmax(p) == x_t`Eğer evetse kabul et, eğer hayırsa çıkış.`argmax(p)`Ve dur.

### Beklenen Hızlı Gelişmeler

Eğer taslak modelinin token seviyesindeki kabul oranı `α`, hedef ileri geçiş başına üretilen beklenen tokenler:

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

- Evet .`α = 0.8, K = 4`- Evet .`(1 - 0.8^5)/(1 - 0.8) = 3.36`Tek bir hedef vadeli maliyetleri yaklaşık olarak `cost_q * K + cost_p`(K taslak adımlar artı bir hedef doğrulama).`cost_p >> cost_q * K`hızlanma oranı `3.36× / 1 = 3.36×`- Çıktım.

Tek gerçek parametre `α`Bu tamamen proje-hedef birleştirmesine bağlı.

### Tasarım Eğitim: Destilasyon

Bir küçük model kötü bir taslak yapar.

1. Küçük bir mimari seçin (70B hedefi için ~ 1B, 7B hedefi için ~ 500M).
2. Hedef modelini büyük bir metin korpusunda çalıştırın; sonraki belirti dağıtımlarını saklayın.
3. Çizgiyi KL farklılığı ile hedef dağıtımına karşı çalıştırın (asıl gerçeklik tokenlerine karşı değil).

Sonuç:`α`Normalde 0.6-0.8 kodlama, 0.7-0.85 doğal dil sohbetlerinde.

### AKKA: Ağaç Çizimleri + Özellikleri Tekrar Kullanım

Li, Wei, Zhang, Zhang (2024, "AKKA: Speküel Örnekleme, Karakteristik Kesinliği Değişikliğini Tekrar Düşünmeyi Gerektirir") standart speküel şifreleme konusunda iki verimsizlik gözlemledi:

1. Draft, her bir tam yığınla K seryal adımları yapar. Ancak taslak hedefin özelliklerini (gizli durumlar) en son doğrulayabilir.
2. Eğitim bir çizgi zincir çıkarabilir. Eğitim bir * ağaç * adaylar çıkarabilirse (her düğüm birden fazla tahmin), hedefin tek ileri geçiş bir ağaç dikkat maskası aracılığıyla paralel olarak birden fazla aday yolları doğrulayabilir ve en uzun kabul edilen dal seçmek.

EAGLE-1 değişiklikleri:
- Tasarım giriş = hedefin t pozisyonunda gizli son durum, çiğ jeton değil.
- Tasarım mimarisi = 1 transformatör dekoder katmanı (ayrı küçük bir model değil).
- Çıktı = K = 4-8 adaylık bir derinlik, 4-6 derinlik.

EAGLE-2 (2024) dinamik ağaç topolojisini ekler: ağaç, çizimi belirsiz olduğu yerlerde daha geniş büyür ve güvendiği yerlerde dar kalır.`α_effective`Verifikasyon maliyetini arttırmadan.

EAGLE-3 (Li et al. 2025, "EAGLE-3: Eğitim-Saat Testleri yoluyla Büyük Dil Modellerinin İfratür Hızlandırmasını Ölçeklendirmek") sabit üst katman özellik bağımlılığını ortadan kaldırır ve taslak yeni bir "test zaman simülasyonu" kaybı ile taslaklanır. Kabul oranı 0,75 (EAGLE-2) 'den 0,82'ye (EAGLE-3) ve ortalama token/verification oranı 3,0'dan 4,5'e yükselmektedir. Bu rakamlar bir referans kuruluşu ile elde edilmektedir. Kabul model çiftine, taslak ağacına ve trafiğe bağlıdır: Eğlence 10 · 15 chat referanslarında kabul edilen yol belirtilerine göre 0.88 ila 0.92 oranında alıntı yapar.

### Ağaç Dikkatini Kontrol Et

Özetleme bir ağaç çıkarırsa, hedef model onu bir ön geçiş ile bir **tree attention mask** saf bir çizgi yerine ağaç topolojisini kodlayan bir sebep maskası. Her token sadece ağaçtaki atalarına hizmet eder. Verify geçişi hala bir ileri, bir matmul; topolojik maskenin maliyeti sadece birkaç ekstra KV girişidir.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

- Eğer`a, b`İlk belirti adayları yarışıyor ve `c, d, e, f`İkinci işaret adayları, tüm altı pozisyon bir ileri geçişle doğrulanır.

### Ne Zaman Kazandı, Ne Zaman Kazanmadı

**Wins:**
- Chat / tahmin edilebilir metin ile tamamlama (kod, ortak İngilizce, yapılandırılmış çıkış). `α`- Yüksek.
- Decode sırasında kullanılmayan GPU hesaplama ayarları (hüzdede bağlı aşama).Ağaç çizimi mevcut FLOPs'leri kullanır.

**Loses / no win:**
- Yüksek sıcaklıkta yaratıcı yazma (çok stohastik çıkışlar). `α``1/|vocab|`- Evet .
- Çok yüksek eşzamanlılık ile servis edilen seri  seri zaten FLOP'ları dolduruyor, ağaç doğrulama için az yer var.
- Çok küçük hedef modeller, proje çok daha küçük değil.

Üretim dükkanları genellikle sohbette 2-3x duvar saati hızlandırmasını, kod üretimi üzerinde 3-5x ve yaratıcı yazıda neredeyse sıfır olduğunu bildirir.

```figure
speculative-decoding
```

## Yapın

`code/main.py`- ...

- İpucu`speculative_decode(target, draft, prompt, K, temperature)`Tam reddetme kuralını uygulayan ve hedefin dağılımını koruduğunu doğrulayan (empirik KL < 0,01 vs. basit hedef örneklemesi).
- K-Depth ağacını top-p dallarıyla inşa eden bir Eagle tarzı ağaç çizicisi.
- Bir verifikatör için doğru nedensel örneği üreten bir ağaç dikkat maskesi yapımcısı.
- Her ikisi de küçük bir LM'de (GPT-2- küçük bir GPT-2- orta hedeften) çalışan kabul oranı harnesini.

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## Kullan

- **vLLM**ve **SGLang**VLLM'de, geçiş yapın.`--speculative-config` ile bir JSON nesnesi`method`- Evet .`model`ve`num_speculative_tokens`; EAGLE-3 `"method": "eagle3"`- Evet .
- **NVIDIA TensorRT-LLM**Medusa ve Eagle ağaçlarını yerli olarak destekliyor.
- **Reference draft models**- Evet .`Qwen/Qwen3-0.6B`(Qwen3-32B'nin taslağı),`meta-llama/Llama-3.2-1B-Instruct`(Llama 3.x 70B'nin taslakları).
- **Medusa heads**(Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): Bir taslak model yerine, K paralel öngörüm başlarını hedefe ekleyin.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-speculative-tuning.md` bir hedef modelinin iş yükünü profilleyen ve seçen bir beceri: taslak modeli, K (taslak uzunluğu), ağaç genişliği, sıcaklık ve ne zaman sıradan dekodaya geri düşeceği.

## Egzersizler

1. Tam reddetme kuralını uygulayın ve empirik olarak doğrulayın.`speculative_decode`ve basit hedef örnekleme yoluyla; iki çıkış dağıtımı arasındaki TV mesafesini hesaplayın. < 0,01 olmalıdır.

2. Hızlandırma formülünü hesaplayın.`α`ve `K`, hedef öne doğru beklenen tokenleri çiz.$K$için$\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$- Evet .

3. Küçük bir çekim yapın, 124M GPT-2 hedefini alın ve 100M tokenlerde 30M GPT-2 çekimini KL kaybı ile destille edin.`α`Beklenen: 0.6-0.7.

4. Bir zincir yerine, bir çekirdek çıkışının her derinlikte üst 3 dalına sahip olun. Ağaç dikkat maskesini oluşturun. Hedefin en uzun doğru dalı kabul ettiğini kontrol edin.

5. Başarısızlık modlarını ölçün. Temperatür = 1.5 (yüksek stohastlık) ile spekülasyonsal dekod çalıştırın. α çöküşünü gösterin ve algoritma, çizim üst masrafları nedeniyle basit dekodlamadan daha yavaş.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## Daha Fazla Okumak

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) Tam reddetme kuralı ve teorik hızlandırma analizi
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) DeepMind'de eşzamanlı spekülatör örneği kağıdı
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) Bir taslak modeline paralel başlı alternatifler
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) özellikleri yeniden kullanmak ve ağaç çizimleri
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) dinamik ağaç topolojisi
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) Tren-saati test-saati eşleşimi
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) Jacobi/lookahead çözümü, spekülatörden uzak bir alternatif
