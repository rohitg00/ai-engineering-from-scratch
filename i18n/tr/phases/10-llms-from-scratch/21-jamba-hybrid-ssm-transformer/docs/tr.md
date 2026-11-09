# Jamba  Hibrit SSM-Transformer

> Devlet uzay modelleri (SSM) ve transformatörler farklı şeyler istiyor. Transformatörler dikkatle kaliteyi kat kat maliyetle satın alırlar. SSM'ler, geri dönüş yoluyla, hatta zaman sonucu ve sabit hafıza satın alır. AI21'in Jamba (Mart 2024) ve Jamba 1.5 (Avgust 2024) modellerini aynı modelde koydu: her 7 Mamba katman için 1 Transformer katmanı, diğer her blokta MoE ve tek 80GB GPU'ya sığan 256k bağlam penceresi. Mamba-3 (ICLR 2026) SSM tarafını karmaşık değerli devlet alanları ve MIMO projeksiyonları ile sıkılaştırır. Bu ders, her iki mimarlığı da sonuna kadar okuyor ve melez tarifinin saf-SSM ve saf-Transformer uzun bağlamlı girişimlerinin yapmadığı zaman üç yıllık ölçeklendirmeyi neden hayatta bıraktığını açıklıyor.

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Jamba blokundaki üç primitifleri açıklayın  Transformer katmanları, Mamba katmanları, MoE  ve 1:7:even birbirine karışan tarif.
- SSM'nin yüksek seviyede tekrarlanması nasıl göründüğünü ve neden sürekli hafıza çıkarımını sağladığını açıklayın.
- Jamba modelinin KV önbelleği ayak izini 256k bağlamda hesaplayın ve saf Transformer modelinin ihtiyaç duyduğu ile karşılaştırın.
- Mamba-3'ün üç yeniliğini (eksponansiyel-trapezoidal diskretizasyon, karmaşık değerli durum güncelleştirmesi, MIMO) ve her birinin hedefi olan sorunu ne olarak adlandırın.

## Sorun

Dikkat, dizilerin uzunluğunda karelidir. Devlet alan modelleri doğrusaldır. Bu fark bileşiklerdir: 256k jetonlarda, bir Transformer dikkat haritası baş başına 65B girişdir; bir SSM'nin tekrar eden durumu dizilerin uzunluğundan bağımsız olarak sabit boyutdadır.

Temiz SSM modelleri (Mamba, Mamba-2) küçük ölçeklerde Transformer karmaşıklığına eşleşir, ancak durum izleme görevlerinde geride kalır ve bağlam içi geri alım bazı kategorilerde başarısız olur.

Açık bir çözüm: İkisini de kullan. Transformer katmanlarını tam hatırlama önemli olduğu yere koy. SSM katmanlarını başka yerlerde kullan. Rasyon ayarlayın. Jamba, bu hibrit tarifini ölçekte gönderen ilk üretim derecesi modeli (52B toplam, 12B aktif, 256k bağlam, tek 80GB GPU). Jamba 1.5 ailesini toplam 398B / 94B aktif olarak genişletiyor. Mamba-3 (ICLR 2026) hibritlerin yeniden inşa edilebileceği mevcut en iyi saf SSM tabanıdır.

Bu ders, üç makaleyi de okuyor ve "doğru oranı seç" için zihinsel model oluşturur.

## Anlaşım

### Bir sayfada bir SSM

Bir devlet uzay modeli bir dizi işleme yapar `x_1, ..., x_N`sabit boyutlu bir durumla.`h`- ...

```math
\begin{aligned}
h_t &= A h_{t-1} + B x_t \\
y_t &= C h_t
\end{aligned}
```

Her aşamada , devlet bir çizgi dinamikle gelişir .`A`, giriş alır `B x_t`, ve çıkışı yayıyor `C h_t`- Evet .`A, B, C`Önemli bir özelliği dikkat edin: Bilgisayar`y_t`Sadece ihtiyaçları var.`h_{t-1}`ve `x_t`Daha önce hiç olmadı .`x`Hatıra sürekli, akıl etkisi de sürekli.$O(1)$- Bir simge.

Modelleme kalitesi için bir hile , `A`S4 (Gu 2021) eğitim sırasında uzun bir konvulsiyon olarak verimli bir şekilde değerlendirilebilecek yüksek yapılandırılmış bir matris kullandı.`A, B, C`Mamba-2 (2024) yapıyı daha da basitleştirdi. Mamba-3 (2026) belirli yerlerde karmaşıklığı yeniden ekledi.

Ana özellik: bir dekoder LLM için, bir SSM katmanı, büyüyen KV kasesi yerine sabit boyutlu katman durumuna sahip bir dikkat katmanı için bir düşüş değiştiricidir.

### Jamba blok

Jamba blokları iki sayıya göre katmanları birbirine bağlar:

- `l`Jamba kullanıyor `l = 8`, yani her 7 Mamba katmanı için 1 Transformer katmanı (7 Mamba + 1 Dikkat = grup başına 8 katman).
- `e`Jamba kullanıyor.`e = 2`Bu da diğer katmanların her birinde MoE geçerli olduğu anlamına geliyor.

Bir blok içindeki katman dizisi:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

Her Jamba blok 8 katmandır. 4 blok derinlikte (toplam 32 kat), 28 Mamba ve 4 Dikkat katmanı elde ediyorsunuz.

### Neden 1:7 oranı

AI21 ablasiyonları çalıştı: Dikkat-Mamba oranı, uzun bağlam değerlendirmelerinde en iyi karmaşıklık per parametreler ve bağlam içi hatırlama sağlar?

- Çok fazla dikkat (1:1): kalite artıyor ama hafıza ve hız azalıyor.
- Çok az dikkat (1:15): hafızası büyük ama bağlamda geri almak başarısız.
- - Merhaba. 1: 7 veya 1: 8.

İçgüdü: Transformer katmanları tam hatırlama ve durum izlemeyi halleder. Mamba katmanları ucuz işlemlerin büyük kısmını haller.

### Konum kodlaması

Mamba katmanları kendileri konum farkındadır (tekrarlanma yoluyla). Mamba tabanlı orijinal hibridlerde dikkat katmanları RoPE  kullanmadı. SSM katmanları konum bilgileri sağladı. Jamba 1.5 daha uzun bağlam genellemesi için dikkat katmanlarına RoPE ekler.

### Hatırlama bütçesi

Jamba-1 şekli için (32 katman: 28 Mamba + 4 Dikkat, gizlenmiş 4096, 32 dikkat başlığı):

- KV önbelleği (yalnızca dikkat katmanları): `2 * 4 * 32 * 128 * 256k * 2 = 16 GB`Bu sayede, Jamba kağıdında bulunan rakam 4 GB'ye ulaşır.
- SSM durumu: `28 * hidden * state_size`Bu, bir katman için sabit bir boyut, dizilerin uzunluğu ile ölçeklenmemektedir.`28 * 4096 * 16 * 2 = 3.7 MB`- Toplam.

32 katlı saf bir Transformer ile karşılaştırın, aynı gizli, 32 başlı tam MHA:`2 * 32 * 32 * 128 * 256k * 2 = 128 GB`KV önbelleğinin 8 kat azalma.`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`), 16 GB'da 32 KV başlığı olan 1:7 hibrid hala 2 kat daha küçüktür.

AI21'in "tek 80GB GPU'da 256k bağlam" olarak anlamı budur. "Tüm MHA saf bir Transformer'ın KV önbelleği uyum sağlamaz; hatta bir GQA temel hattı ağırlıklar ve etkinleştirmeler için yer bırakmaz; Jamba'nın yapması gerekir.

### Mamba-3: 2026'da saf SSM başlangıç çizgisi

Mamba-3 (ICLR 2026, arXiv:2603.15569) saf SSM tarafında üç yenilik sunar:

1. **Exponential-trapezoidal discretization.**Mamba-2'deki Euler yöntemi diskretleştirmesini daha ifade edici bir tekrarla değiştirir.`x_t`- Evet .

2. **Complex-valued state update.**Mamba-3'ün karmaşık değerleri 'e eşittir. Bu durum üzerinde veri bağımlı bir rotary gömülme eşittir. Bu, önceki gerçek değerli basitleştirmelerin maliyetinin bulunduğu devlet izleme yeteneklerini geri getirir.

3. **Multi-input multi-output (MIMO) projections.**Karakteristikleri açısından skalar projeksiyonlar yerine, matris değerli projeksiyonlar kullanın. Dekodlama gecikmesini arttırmadan modellerleme gücünü ve sonucu zaman donanım kullanımını geliştirir.

1.5B parametrelerinde, Mamba-3 Gated DeltaNet'e göre ortalama aşağı akıntı doğruluğunu 0.6 puan arttırır; MIMO varianti toplam 1.8 puan kazanç için 1.2 daha ekler. Aynı durum boyutunda, Mamba-3 Mamba-2 ile yarı durumla eşleşir.

Mamba-3 henüz ölçekli bir üretim hibridinde gönderilmiyor  ama bir sonraki Jamba sınıfı modelinin SSM tarafı için açık bir aday.

### Bir hibridin ne zaman bulunması gerekiyor

Hibritler kazanırsa:

- Koneks, saf Transformer KV önbelleğinin ağrılı hale gelmesi için yeterince uzun (64k+).
- Görevler kısa mesafe yapısını (SSM için iyi) uzun mesafe geri çağırma ile (Transformer ihtiyaçları) karıştırır.
- Tek GPU bellek bütçelerinde Transformer KV önbelleğinin kendi başına yerleşmeyeceği yerlerde dağıtmak istiyorsun.

Hibritler kaybederken:

- Kontext kısa (16k'dan daha düşük). SSM üstü harcanır; saf Transformer iyi.
- Görevler her yerde dikkat gerektirir ( derin düşünme, çok belgeli çapraz referans).
- Trisyonlarca parametrelik sınır modellerine kadar uzanıyorsunuz. Pure-Transformer + MLA + MoE (DeepSeek-V3 tarzı) şu anda kapasite yarışında kazandı.

### Rekabetçi manzarası

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

2026 manzarası: saf Transformer MoE sınırda egemenlik gösterir, ancak hibritler 256k+ bağlamlı niş'e sahiptir. Mamba-3'ün devlet izleme kazanmaları, sonraki nesilde hibrit oranları daha düşük (daha fazla SSM, daha az dikkat) itebilir.

```figure
swiglu-ffn
```

## Kullan

`code/main.py`SSM-Transformer oranı ve gizli boyut / katman sayımı yapılandırmasını göz önüne alarak, hesaplar:

- KV önbelleği hedef bağlamda.
- SSM durum hafızası.
- Bir dizi model şekli için bağlam N'de toplam bellek.

Hesap makinesi:

- Pure-Transformer baseline (KV cache N ile büyüyor).
- Jamba tarzı 1:7 hibrid.
- Saf SSM (KV önbelleği yok).

Sayılar yayınlanmış şekiller için Jamba-1 ve Jamba-1.5 makalelerinden doğrudan alınmıştır ve hipotetik çeşitler için ekstrapolasyon yapılmıştır.

Gerçek bir yerleşim için entegrasyon düşünceleri:

- Çoğu üretim sonuç sunucuları (vLLM, SGLang) Jamba ve Mamba'yı destekler.
- 256k bağlamında, Jamba'nın bellek avantajı eşzamanlı talep çıkışında görünür. Aynı VRAM'da Transformer dizilerinden daha fazla Jamba dizisini yerleştiriyorsunuz.
- Mamba-3 bağımsız bir model olarak henüz üretimde gönderilmiyor  araştırma ön gösterisi 1.5B.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-hybrid-picker.md`. İş yükü özellikleri (koneks uzunluğu profil, görev karışımı, bellek bütçesi) göz önüne alındığında, hafıza ve kalite karşılığı konusunda açık bir mantıkla saf bir Transformer, Jamba tarzı hibrid ve saf bir SSM arasında tavsiye edilir.

## Egzersizler

1. Çık .`code/main.py`KV önbelleğini 32 katlı saf Transformer için 256k bağlamda hesaplamak için (goymuş 4096, 32 baş) ve aynı şekildeki Jamba-1 hibrid için. AI21 kağıdı iddia ettiği ~ 8x hafıza azaltımı doğrulayın.

2. Hesap makinesi 1:3 hibrid (4 Mamba: 1 Dikkat) ve 1:15 hibrid (14 Mamba: 1 Dikkat) modeline göre değiştirilsin.

3. Jamba makalesinin 3. bölümünü okuyun (arXiv:2403.19887). AI21'in Mamba-2'nin daha hızlı olmasına rağmen Mamba-2'den ziyade Mamba-1'yi neden kullandığını açıklayın.

4. Jamba 1.5 Large'de MoE-her-diğer katmanın üstteki parametrelerini hesaplayın (398B toplam, 94B aktif).

5. Mamba-3 makalesinin 3. bölümünü okuyun (arXiv:2603.15569). Karmaşık değerli bir durum güncelleme neden veri bağımlı bir rotary embed ile eşdeğer olduğunu üç cümleyle açıklayın. Cevabı Fase 7 · Ders 04'ün RoPE türevine bağlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## Daha Fazla Okumak

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) orijinal Jamba kağıdı, oran ablations, 256k bağlam iddiası
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) genişletilmiş aile, 398B/94B ve 12B/52B açıklamalar
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) Jamba'nın seçkin SSM kağıdı
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) basitleştirilmiş yapılandırılmış devlet- uzay varisi
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) karmaşık değerli devlet, MIMO, 2026 saf SSM sınır
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) S4 makalesi, MSS soy hattının LLM için başlangıç noktası
