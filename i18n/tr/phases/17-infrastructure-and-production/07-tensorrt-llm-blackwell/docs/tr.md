# Hardware-Specialized Inference Compilation  FP8 ve NVFP4 Blackwell'de

> Hardware uzmanlaştırılmış sonuçlama komisyonu, akışın taşınabilirliği için ticaret yapar ve Blackwell için ayarlanmış olan TensorRT-LLM  NVIDIA-sadece, ticaretin sonuç vermesinin en net örneğidir.$0.012 per million tokens on a 120B model in Q1-Q2 2026, against $H100 + vLLM  7 kat ekonomik fark. Satır iki servisi teknikleri ile iki yüzer nokta biçimi birleştirir: FP8 KV saklama ve dikkat çekirdekleri için kritik kalır çünkü ihtiyaç duydukları dinamik aralığı vardır; NVFP4 (4 bit mikroskalans) ağırlıkları ve etkinleştirmeleri ele alır; çoklu jeton öngörü (MTP) ve parçalanmış prefill / decode üst kısmına bir başka 2-3x ekler. Day-0 model destek yükleri FP4 ağırlıkları doğrudan eğitim sonrası dönüşüm olmadan. 2026 mühendislik takımları için yakalama: TRT-LLM açık kaynaklı ancak NVIDIA-spesifik  CUDA- ve Blackwell-specialized  bu yüzden onu benimsemek geçiş için taşınabilirliği ticaret. Yapmadan önce model ve donanım karışımını matematikle çalıştır.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- FP8'nin neden NVFP4'te ağırlıklar olduğu halde KV kaydı ve dikkat için kritik olduğunu açıklayın.
- BF16, FP8 ve NVFP4 çerçevesinde bir sınır modelinin HBM ayak izi hesaplayın ve tasarrufların nereden geldiğini açıklayın.
- Blackwell'e özgü özelliklerin adı TRT-LLM (day-0 FP4, MTP, ayrıştırılmış servis, tümüne ilk gelenler) kullanılar.
- TRT-LLM'in NVIDIA kilitinin Hopper'daki 7 katlık maliyet farkına ne zaman değeceğini belirleyin.

## Sorun

2026'da sonuç ekonomisinin sınırı "dolar başına kaç token" olacaktır. Cevap dört yığınlı seçeneğe bağlıdır: donanım üretimi (Hopper H100/H200 vs. Blackwell B200/GB200), hassaslık (BF16 → FP8 → NVFP4), servis motor (vLLM vs. SGLang vs. TRT-LLM), ve orkestrasyon (sırf vs. ayrıştırılmış vs. Dynamo).

Hopper'da 120B MoE'nin hızı ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$0.012  7x daha ucuz. Bu boşluktan bazıları donanımdır (Blackwell'in GPU LLM çıkışı karşı karşısına 11-15x). Bazıları yığın: FP4 ağırlıkları, MTP taslak, parçalanmış prefill / decode ve MoE uzman iletişim için NVLink 5 her şeye.

Bu, NVIDIA'nın yığınının dışında tekrarlanamaz. Bu ekonomik için ödeme  taşınabilirlik. Hangi yığın seçimlerinin hangi boşluğu paylaştırdığını anlamak bu dersin amacıdır.

## Anlaşım

### Neden FP8 hala KV cache için zemin

2026'da yaygın bir hata: NVFP4'in her yerde geçerli olduğunu varsaymak. Bu geçerli değildir. KV kasesi FP8'ye (8 bit yüzen nokta) ihtiyaç duyar. Çünkü geniş bir dinamik aralığı kapsadığı dikkat anahtarlarını ve değerleri depolar. KV'yi FP4'e kvantize etmek felaketli doğruluk kaybına neden olur.

NVFP4 (2025-2026) ağırlıklara ve etkinleştirmeler için geçerlidir. Mikroskalalama: ağırlıkların her bloku kendi ölçek faktörüne sahiptir, bu nedenle küçük bloklar, per-tensor ölçek kaybı olmadan farklı dinamik aralıkları kaplayabilir.

Tipik Blackwell'in yapılandırması:

- Ağırlıklar: NVFP4 (4 bit mikro ölçekleme).
- Aktivasyon: NVFP4.
- KV önbelleği: FP8.
- Dikkat akkumülatörü: FP32 (mükemmel maksimum istikrar).

### Blackwell'e özgü ilkeler TRT-LLM kullanır

- **Day-0 FP4 weights**Modelleme sahipler FP4 ağırlıklarını doğrudan gönderir; TRT-LLM yükleri eğitim sonrası dönüşüm olmadan.
- **Multi-token prediction (MTP)**: EAGLE'nin (Fase 17 · 05) aynı fikri ancak TRT-LLM yapısına entegre edildi.
- **Disaggregated serving**Bu nedenle, bu işlemler, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir sürece, bir sürece, bir sürececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececece
- **All-to-all communication primitives**NVLink 5 MoE uzman iletişim gecikmesini 3x vs Hopper'a düşürüyor. TRT-LLM'in MoE çekirdekleri bunun için ayarlanmıştır.
- **NVFP4 + MXFP8 microscaling**Blackwell Tensor Cores'te donanımlı hızlandırılmış ölçek faktörleri ile işlenme.

### Hatırlaman gereken rakamlar

- HGX B200, GPT-OSS-120B üzerinden TRT-LLM üzerinden 0.02 / M dolarlık tokenler.
- GB200 NVL72 $0.012/M tokenleri Dynamo (orkestreci TRT-LLM) üzerinden.
- H100 + vLLM ≈ $0.09 / M simgeler karşılaştırılabilir iş yükü.
- TRT-LLM güncellemelerinin üç ayında 2.8 katlık bir üretim artışı (2026).
- GPU LLM'de 11-15 katlık çıkış, Blackwell vs Hopper.
- MLPerf Inference v6.0 (Epril 2026): Blackwell gönderilen her görevi egemenliği.

### FP4'in kalitesiyle ilgili gerçekte ne kadar maliyetleri var

NVFP4 agresifdir. Düşünce ağır iş yüklerinde (hüküm zinciri, matematik, uzun bağlamlı kod-gen), FP4 ağırlıkları görünür olarak düşer. Blok başına kalibrasyon hafifler ancak ortadan kaldırmaz. Takımlar nedencilik modellerini göndermek genellikle FP8 ağırlıklarını + FP4 etkinleştirmelerini bir uzlaşma olarak kullanır veya H200'e bağlıdır.

Kural: NVFP4 ağırlıklarına katılmadan önce değerlendirme ayarınızda görev kalitesini her zaman doğrulayın.

### Neden bu bir NVIDIA kilitleme kararı

TRT-LLM, C++ + CUDA + kapalı kaynak çekirdekleridir. Modeller belirli bir GPU SKU için oluşturulmalıdır. AMD, Intel veya ARM yoktur. İnfra stratejiniz çok satıcı ise, TRT-LLM hizmet verilen katman için başlangıçsızdır.

### 2026 pratik tarif

Hopper + vLLM'de çalışan yıllık bir 100 milyon dolarlık sonuç faturası için masada 7-10 kat daha fazla kalır. Maliyet baskın iş yüklerini Blackwell + TRT-LLM + Dynamo'ya aktarın. Modeldeki tekrarlama hızı için H100 + vLLM'de deney seviyesini koruyun. Her NVFP4 dönüştürülen modelde üretimden önce kaliteyi doğrulayın.

### Bölümleme bonusu

TRT-LLM'nin ayrıştırılmış servisi (ayrı önceden doldurma ve çözme havuzları) 17 · 20 aşamada derinliklere kaplıdır. Blackwell'de, katılımcılar: FP4 ağırlıkları × MTP hızlandırması × ayrıştırılmış yerleştirme × önbelleğe dikkat çeken yönlendirmeyi varsayır. 7x numarası bu tam yığını varsayır.

```figure
pipeline-parallel
```

## Kullan

`code/main.py`HBM ayak izi, dekodlama geçişini (hüzdede bağlanmış rejim) ve üç yığın üzerinde bir model için $/M-tokenleri hesaplar: H100 + BF16 + vLLM, H100 + FP8 + vLLM, B200 + NVFP4/FP8 + TRT-LLM. Her değişikliğin katkıda bulunduğu karma etki ve boşluk payını görmek için çalıştırın.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-trtllm-blackwell-advisor.md`. İş yükü, model boyutu ve yıllık token hacmi göz önüne alındığında, Blackwell + TRT-LLM yığınının NVIDIA-kalka değer olup olmadığını belirler.

## Egzersizler

1. Çık .`code/main.py`%30 aktif parametreleri olan 120B MoE'de, H100 BF16, H100 FP8 ve B200 NVFP4/FP8'de hafıza bant genişliği sınırlı dekod geçişini hesaplayın.
2. Bir müşteri H100 + vLLM için yılda 2 milyon dolar harcıyor. 7 kat ekonomik boşluğu göz önüne alarak 12 ay içinde TRT-LLM'ye göçü için amortize etmek için satın almaları gereken Blackwell GPU sayısı nedir?
3. NVFP4 ağırlık dönüşümünden sonra MATH'de doğruluk 3 puan düşüşünü görürsünüz. İki kurtarma yolunun adını verin: bir kalite önce (FP8 ağırlıklarını koruyun), bir maliyet önce (domain verileri ile kalibre edin).
4. MLPerf v6.0 sonuçlarını okuyun. Hangi görevde Blackwell-over-Hopper farkı en az ve neden?
5. 405B modeli için gereken HBM'yi NVFP4 ağırlıklarında + FP8 KV önbelleği 128k bağlamda hesaplayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## Daha Fazla Okumak

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) Nisan 2026 MLPerf sonuçları.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) NVLink 5 tüm ve MoE çekirdekleri.
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) Resmi motor belgesi.
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) TRT-LLM'den yukarıdaki parçalanmış orkestrasyon.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) Blackwell sayıları yayınlayan referans değerleri kümesi.
