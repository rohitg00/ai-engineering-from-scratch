# Donanıma Özel Inference Derlemesi — Blackwell'de FP8 ve NVFP4

> Donanıma özel inference derlemesi, taşınabilirliği verim için kullanır ve TensorRT-LLM (yalnızca NVIDIA, Blackwell için ayarlanmıştır) bu ticaretin karşılığını almanın en açık örneğidir. SemiAnalytic InferenceX, Dynamo düzenlemeli GB200 NVL72'de H100 + vLLM'de $0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0,09/M'yi ölçtü — 7 kat ekonomik fark. Yığın, birleştirilmiş üç kayan nokta rejiminden oluşur: FP8, ihtiyaç duydukları dinamik aralığa sahip olduğundan KV önbelleği ve dikkat çekirdekleri için kritik olmaya devam eder; NVFP4 (4 bit mikro ölçeklendirme), ağırlıkları ve etkinleştirmeleri yönetir; çoklu token tahmini (MTP) ve ayrıştırılmış önceden doldurma/kod çözme, üstüne 2-3 kat daha ekler. Day-0 modeli, FP4 ağırlıklarını eğitim sonrası dönüştürmeye gerek kalmadan doğrudan yükler. 2026 mühendislik ekipleri için önemli nokta: TRT-LLM açık kaynaktır ancak NVIDIA'ya özeldir (CUDA ve Blackwell'de uzmanlaşmıştır), bu nedenle onu benimsemek, verim için taşınabilirliği değiştirir. Taahhüt etmeden önce model ve donanım karışımınızda matematiği çalıştırın.

**Tür:** Öğren
**Diller:** Python (stdlib, toy FP8/NVFP4 bellek ve maliyet hesaplayıcı)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Bileşenlerine Hizmet Verme), Aşama 10 · 13 (Kuantizasyon)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Ağırlıklar NVFP4'te olsa bile FP8'in KV önbelleği ve dikkat açısından neden kritik öneme sahip olduğunu açıklayın.
- BF16, FP8 ve NVFP4 kapsamında bir sınır modelinin HBM ayak izini hesaplayın ve tasarrufların nereden geldiğinin nedenini hesaplayın.
- TRT-LLM'nin yararlandığı Blackwell'e özgü özelliklerin adlarını verin (0. gün FP4, MTP, ayrıştırılmış sunum, tümden herkese temel öğeler).
- TRT-LLM'nin NVIDIA kilidinin, Hopper'daki vLLM'ye kıyasla 7 kat maliyet farkına ne zaman değeceğine karar verin.

## Sorun

2026'da inference ekonomisinin sınırı "dolar başına kaç token"dir. Cevap dört üst üste seçeneğe bağlıdır: donanım üretimi (Hopper H100/H200 ile Blackwell B200/GB200), hassasiyet (BF16 → FP8 → NVFP4), hizmet motoru (vLLM, SGLang, TRT-LLM) ve orkestrasyon (düz, ayrıştırılmış ve Dinamo).

vLLM'li Hopper'da, 120B MoE ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$0,012 hızında çalışır — 7 kat daha ucuz. Bu boşluğun bir kısmı donanımdan kaynaklanıyor (Blackwell, Hopper'a kıyasla GPU başına LLM verimi 11-15x). Bunlardan bazıları yığındır: FP4 ağırlıkları, MTP taslağı, ayrıştırılmış ön doldurma/kod çözme ve MoE uzman iletişimi için hepsi bir arada NVLink 5.

Bunu NVIDIA yığınının dışına kopyalayamazsınız. Ekonomi açısından taşınabilirlik budur. Hangi yığın seçiminin boşluğun hangi payını verdiğini anlamak bu dersin amacıdır.

## Konsept

### FP8 neden hala KV önbelleği için zemin oluşturuyor?

2026'da yaygın bir hata: NVFP4'ün her yerde geçerli olduğunu varsaymak. Değil. KV önbelleği, geniş bir dinamik aralığa yayılan dikkat anahtarlarını ve değerleri sakladığından FP8'e (8 bit kayan nokta) ihtiyaç duyar. KV'yi FP4'e nicelemek, feci doğruluk kaybına neden olur; dağıtımın kuyruğu düşer ve dikkat puanları çöker. FP8'in üslü bitleri, KV önbelleğine ihtiyaç duyduğu aralığı sağlar.

NVFP4 (2025-2026) ağırlıklar ve aktivasyonlar için geçerlidir. Mikro ölçeklendirme: Her ağırlık bloğunun kendi ölçek faktörü vardır, böylece küçük bloklar tensör başına ölçek kaybı olmadan farklı dinamik aralıklara yayılabilir. Aktivasyonlar için FP4 geçerlidir çünkü aktivasyonlar bir katman içinde küçük aralıktadır.

Tipik Blackwell yapılandırması:

- Ağırlıklar: NVFP4 (4 bit mikro ölçeklendirme).
- Etkinleştirmeler: NVFP4.
- KV önbelleği: FP8.
- Akümülatörün dikkatine: FP32 (softmax kararlılığı).

### TRT-LLM'nin kullandığı Blackwell'e özgü temel öğeler

- **Gün-0 FP4 ağırlıkları**: model sağlayıcılar FP4 ağırlıklarını doğrudan gönderir; TRT-LLM, eğitim sonrası dönüşüm olmadan yüklenir. FP4 için AWQ / GPTQ adımı yok.
- **Multi-token tahmini (MTP)**: EAGLE (Aşama 17 · 05) ile aynı fikir ancak TRT-LLM yapısına entegre edilmiştir.
- **Ayrılmış sunum**: ayrı GPU havuzlarında önceden doldurma ve kod çözme, NVLink veya InfiniBand üzerinden aktarılan KV önbellek. Dynamo ile aynı fikir (Aşama 17 · 20).
- **Tümden herkese iletişim temelleri**: NVLink 5, MoE uzman iletişim gecikmesini Hopper'a kıyasla 3 kat azalttı. TRT-LLM'nin MEB çekirdekleri buna göre ayarlanmıştır.
- **NVFP4 + MXFP8 mikro ölçeklendirme**: Blackwell Tensör Çekirdeklerinde donanımla hızlandırılmış ölçek faktörü işleme.

### Ezberlemeniz gereken sayılar

- HGX B200, TRT-LLM aracılığıyla GPT-OSS-120B'de 0,02 ABD Doları/milyon token seviyesinde.
- GB200 NVL72, Dynamo aracılığıyla 0,012 ABD doları/milyon token seviyesinde (TRT-LLM'yi yönetiyor).
- H100 + vLLM ≈ karşılaştırılabilir iş yükünde 0,09 ABD doları/milyon token.
- Üç aylık TRT-LLM güncellemelerinde (2026) 2,8 kat verim artışı.
- GPU başına LLM verimi 11-15x, Blackwell ve Hopper.
- MLPerf Inference v6.0 (Nisan 2026): Blackwell gönderilen her göreve hakimdir.

### FP4'ün kalite açısından gerçekte maliyeti nedir?

NVFP4 agresiftir. Muhakeme ağırlıklı iş yüklerinde (düşünce zinciri, matematik, uzun bağlamlı kod oluşturma), FP4 ağırlıkları gözle görülür şekilde düşer. Blok başına kalibrasyon hafifletir ancak ortadan kaldırmaz. Akıl yürütme modellerini gönderen ekipler genellikle FP8 ağırlıkları + FP4 aktivasyonlarını bir uzlaşma olarak kullanır veya baştan sona FP8 ile H200'e sadık kalır.

Kural: NVFP4 ağırlıklarını taahhüt etmeden önce her zaman değerlendirme kümenizdeki görev kalitesini doğrulayın.

### Bu neden bir NVIDIA kilidi kararıdır?

TRT-LLM, C++ + CUDA + kapalı kaynak çekirdekleridir. Modellerin belirli bir GPU SKU'su için derlenmesi gerekir. AMD yok, Intel yok, ARM yok. Altyapı stratejiniz çok sağlayıcılıysa, TRT-LLM, TRT-LLM'nin sunduğu katman için başlangıç ​​dışıdır; karma donanımda vLLM'den hizmet vermeye devam edebilirsiniz. Yalnızca NVIDIA kullanıyorsanız, 7x boşluk kilidin maliyetini karşılar.

### 2026 pratik tarif

100 milyon doların üzerinde yıllık inference faturası için, Hopper + vLLM üzerinde çalışmak, masada 7-10x bırakıyor. Maliyet ağırlıklı iş yüklerini Blackwell + TRT-LLM + Dynamo'ya taşıyın. Model yineleme hızı için deneme katmanını H100 + vLLM'de tutun. NVFP4'e dönüştürülen her modelin kalitesini üretimden önce doğrulayın.

### Ayrıştırma bonusu

TRT-LLM'nin ayrıştırılmış sunumu (ayrı ön doldurma ve kod çözme havuzları) Aşama 17 · 20'de derinlemesine ele alınmaktadır. Blackwell'de çarpan yığınları: FP4 ağırlıkları × MTP hızlandırma × ayrıştırılmış yerleştirme × önbelleğe duyarlı yönlendirme. 7x sayısı bu tam yığını varsayar.

```figure
pipeline-parallel
```

## Kullan onu

`code/main.py`, üç yığındaki bir model için HBM ayak izini, kod çözme verimini (belleğe bağlı rejim) ve $/M-token'leri hesaplar: H100 + BF16 + vLLM, H100 + FP8 + vLLM, B200 + NVFP4/FP8 + TRT-LLM. Bileşik etkiyi ve her değişikliğin katkıda bulunduğu boşluğun payını görmek için bunu çalıştırın.

## Gönderin

Bu ders `outputs/skill-trtllm-blackwell-advisor.md`'yi üretir. İş yükü, model boyutu ve yıllık token hacmi dikkate alındığında Blackwell + TRT-LLM yığınının NVIDIA kilidine değip değmeyeceğine karar verir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. %30 aktif parametrelere sahip bir 120B MoE'de, H100 BF16, H100 FP8 ve B200 NVFP4/FP8'deki bellek bant genişliği sınırlı kod çözme verimini hesaplayın. En büyük sıçrama nereden geliyor?
2. Bir müşteri H100 + vLLM'ye yılda 2 milyon dolar harcıyor. 7 kat ekonomik fark göz önüne alındığında, TRT-LLM'ye geçişi 12 ayda amorti etmek için satın almaları gereken Blackwell GPU'larının başabaş noktası sayısı nedir?
3. NVFP4 ağırlık dönüşümünden sonra MATH'de doğruluğun 3 puan düştüğünü görüyorsunuz. İki kurtarma yolunu adlandırın: biri kalite öncelikli (FP8 ağırlıklarını koruyun), diğeri maliyet öncelikli (etki alanı içi verilerle kalibre edin).
4. MLPerf v6.0 inference sonuçlarını okuyun. Hangi görevde en küçük Blackwell-over-Hopper boşluğu var ve neden?
5. NVFP4 ağırlıklarında + 128k bağlamında FP8 KV önbelleğinde 405B modeli için gereken HBM'yi hesaplayın. Tek bir GB200 NVL72 düğümüne sığar mı?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| FP8 | "sekiz bitlik kayan nokta" | 8 bitlik kayan nokta; KV önbelleği ve dinamik aralık nedeniyle dikkat için kullanılır |
| NVFP4 | "dört bit mikro" | NVIDIA'nın 4 bit mikro ölçeklendirme FP formatı; Blackwell'de ağırlıklar ve aktivasyonlar |
| MXFP8 | "MX sekiz" | Mikro ölçeklendirme FP8 varyantı; Blackwell Tensör Çekirdekleri üzerinde donanım hızlandırmalı |
| 0. Gün FP4 | "FP4 ağırlıklarını gönder" | Model sağlayıcılar ağırlıkları halihazırda FP4'te yayınlıyor; tren sonrası dönüşüm adımı yok |
| MTP | "çoklu token tahmini" | TRT-LLM'nin entegre spekülatif kod çözme taslağı (Aşama 17 · 05) |
| Ayrıştırılmış porsiyon | "bölünmüş ön doldurma/kod çözme" | Ayrı GPU havuzlarında önceden doldurma ve kod çözme; KV, NVLink/IB üzerinden aktarıldı |
| Hepsinden hepsine | "MEB uzman iletişimi" | token'leri uzman GPU'lara yönlendiren iletişim modeli; NVLink 5, 3 kez keser |
| InferenceX | "SemiAnaliz inference tezgahı" | 2026'da sektör tarafından kabul edilen token başına maliyet benchmark |

## Daha Fazla Okuma

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) — Nisan 2026 MLPerf sonuçları.
- [NVIDIA — Blackwell'de MoE Inference](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) — NVLink 5 hepsine ve MoE çekirdekleri.
- [TensorRT-LLM'ye Genel Bakış](https://nvidia.github.io/TensorRT-LLM/overview.html) — resmi motor belgeleri.
- [NVIDIA — Dinamoya Giriş](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — TRT-LLM'nin üzerinde ayrıştırılmış orkestrasyon.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — Blackwell sayılarını yayınlayan benchmark paketi.
