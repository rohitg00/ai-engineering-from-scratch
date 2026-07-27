# Üretim Niceleme — AWQ, GPTQ, GGUF K-quant'ları, FP8, MXFP4/NVFP4

> Niceleme formatı evrensel bir seçim değildir; donanımın, hizmet veren motorun ve iş yükünün bir fonksiyonudur. GGUF Q4_K_M veya Q5_K_M, llama.cpp ve Ollama aracılığıyla sağlanan CPU'ya ve uç noktaya sahiptir. Aynı tabanda çoklu LoRA'ya ihtiyaç duyduğunuzda vLLM'de GPTQ kazanır. Marlin-AWQ çekirdeklerine sahip AWQ, veri merkezi üretimi için 2026 varsayılanı olan INT4'te en iyi Pass@1 ile 7B sınıfı modelde ~741 tok/s sunar. FP8, Hopper, Ada ve Blackwell'in ortasında kalıyor; neredeyse kayıpsız ve geniş çapta destekleniyor. NVFP4 ve MXFP4 (Blackwell mikro ölçeklendirme) agresiftir ve blok başına doğrulama gerektirir. İki tuzak takımı ısırır: dataset kalibrasyonu deployment alanıyla eşleşmelidir ve KV önbelleği, ağırlık nicelemesinden ayrıdır - "modelim şu anda 4 GB" AWQ dersi, üretim toplu boyutlarında 10-30 GB KV önbelleğini unutur.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak belleği ve formatlar arası performans karşılaştırması)
**Önkoşullar:** Aşama 10 · 13 (Kuantizasyon temelleri), Aşama 17 · 04 (Motorun Dahili Bileşenlerine Hizmet Verme)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- 2026'daki altı üretim nicemleme formatını ve bunların tatlı noktalarını adlandırın.
- Donanıma (CPU vs GPU, Hopper vs Blackwell), motora (vLLM, TRT-LLM, llama.cpp) ve iş yüküne (rutin sohbet, muhakeme, çoklu LoRA) göre bir format seçin.
- Seçilen format için kaydedilen ağırlık hafızasını ve dokunulmadan bırakılan KV önbelleğini hesaplayın.
- Etki alanı trafiğinde nicelenmiş modellerin kalitesini düşüren kalibrasyon-dataset tuzağına bir ad verin.

## Sorun

Niceleme, belleği ve HBM bant genişliğini azaltır; bu da kod çözmenin tam olarak ihtiyaç duyduğu şeydir. FP16 70B modeli 140 GB ağırlığa sahiptir. Ağırlıkları INT4'e (AWQ veya GPTQ) nicelendirdiğinizde model 35 GB olur — KV önbellek için yeri olan bir H100'e sığar; bu önemlidir, çünkü 2k bağlamlı 128 eşzamanlı dizide tek başına KV önbelleği 20-30 GB'dir.

Ancak kuantizasyon ücretsiz değildir. Agresif niceleme, özellikle muhakeme ağırlıklı görevlerde kaliteyi düşürür. Farklı formatlar farklı motorlarla çalışır. Farklı donanımlar doğal olarak farklı hassasiyetleri destekler. 2026 formatındaki hayvanat bahçesi gerçektir ve başka birinin seçimini kopyalayamazsınız; yığınınıza göre seçim yapmanız gerekir.

## Konsept

### Altı format

| Biçim | Bitler | Tatlı nokta | Motorlar |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, dizüstü bilgisayarlar | llama.cpp, Ollama |
| GPTQ | 4-8 | vLLM'de Çoklu LoRA | vLLM, TGI |
| AWQ | 4 | Veri Merkezi GPU üretimi | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell veri merkezi | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell çok kullanıcılı | TRT-LLM |
| NVFP4 | 4 | Blackwell çok kullanıcılı | TRT-LLM |

### GGUF — CPU/uç varsayılanı

GGUF, başlı başına bir niceleme şeması değil, bir dosya formatıdır; K-quant varyantlarını (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) tek bir kapta paketler. Q4_K_M ve Q5_K_M üretim varsayılanlarıdır; 4-5 bitte BF16'ya yakın kalite. llama.cpp açık ara en hızlı CPU inference motoru olduğundan CPU veya uç hizmet için en iyi seçimdir.

vLLM'de verimlilik cezası: 7B'de ~93 tok/s — format, GPU çekirdekleri için optimize edilmemiştir. deployment hedefi CPU/edge olduğunda GGUF'u kullanın. Aksi halde değil.

### GPTQ — vLLM'de çoklu LoRA

GPTQ, kalibrasyon geçişi olan bir eğitim sonrası niceleme algoritmasıdır. Marlin çekirdekleri GPU'yu hızlandırır (Marlin olmayan GPTQ'ya kıyasla 2,6 kat hızlanma). 7B'de ~712 tok/s.

Benzersiz kazanç: GPTQ-Int4, vLLM'de LoRA adaptörlerini destekler. Bir temel modelin yanı sıra 10-50 ince ayarlı varyant (her biri LoRA olarak) sunuyorsanız GPTQ sizin yolunuzdur. NVFP4, 2026'nın başından itibaren henüz LoRA'yı desteklemiyor.

### AWQ — veri merkezi GPU'su varsayılanı

Aktivasyona duyarlı Ağırlık Niceleme. Niceleme sırasında ~%1'lik en belirgin ağırlıkları korur. Marlin-AWQ çekirdekleri: Saflığa kıyasla 10,9 kat hızlanma. 7B'de ~741 tok/s, INT4 formatları arasında en iyi Pass@1.

Çoklu LoRA'ya (GPTQ) veya agresif Blackwell FP4'e (NVFP4) ihtiyacınız olmadığı sürece yeni GPU hizmeti için AWQ'yu seçin.

### FP8 — güvenilir orta

8 bitlik kayan nokta. Neredeyse kayıpsız. Yaygın olarak desteklenmektedir. Hazne Tensör Çekirdekleri FP8'i doğal olarak hızlandırır. Blackwell miras alır. Kalitenin tartışılamaz olduğu durumlarda (akıl yürütme, tıbbi, kod oluşturma) FP8, 2026'nın güvenli varsayılanıdır. Bellek tasarrufu INT4'ün yarısı kadardır ancak kalite riski çok daha düşüktür.

### MXFP4 / NVFP4 — Blackwell agresif

Mikro ölçeklendirme FP4. Her ağırlık bloğunun kendi ölçek faktörü vardır. Agresif ancak Blackwell Tensör Çekirdeklerinde donanım hızlandırmalı. FP8'e kıyasla token başına bayt sayısını yarıya indirin — Aşama 17 · 07'deki ekonomik kazanç.

Uyarılar:
- Henüz LoRA desteği yok (2026 başı).
- Mantık yürütmenin yoğun olduğu iş yüklerinde kalite düşüşü görülebilir.
- Model başına değerlendirme kümenizi doğrulayın.

### Kalibrasyon tuzağı

AWQ ve GPTQ bir kalibrasyon dataset gerektirir - genellikle C4 veya WikiText. Etki alanı modellerinde (kod, tıbbi, yasal), genel web metninde kalibrasyon yapmak, algoritmanın hangi ağırlıkların korunacağı konusunda yanlış kararlar almasına olanak tanır. HumanEval'deki Pass@1 birkaç puan düşürebilir.

Çözüm: Alan içi verilere göre kalibre etme. Yüzlerce alan örneği genellikle yeterlidir. Göndermeden önce değerlendirme setini test edin.

### KV önbellek tuzağı

AWQ ağırlıkları 4 bit'e kadar küçültür. KV önbelleği ayrıdır ve FP16/FP8'de kalır. AWQ'lu 70B modeli için:

- Ağırlıklar: ~35 GB (140 GB'tan INT4).
- 128 eşzamanlı × 2k bağlamda KV önbellek: ~20 GB.
- Aktivasyonlar: ~5 GB.
- Toplam: ~60 GB — H100 80 GB'ye uygundur.

Safça "Modelimi 4 GB'a nicelleştirdim", geri kalan 30-50 GB'ı unutuyor. HBM'yi bütünsel olarak bütçeleyin.

Ayrı olarak, KV önbellek nicelemesi (FP8 KV veya INT8 KV), kendi ödünleri ile farklı bir seçimdir; dikkatin doğruluğunu doğrudan etkiler ve bedava bir kazanç değildir.

### AWQ INT4 mantık açısından tehlikelidir

Düşünce zinciri, matematik, uzun bağlamlı kod oluşturma; bunlar agresif kuantizasyondan gözle görülür biçimde zarar görüyor. AWQ INT4 MATH'de ~3-5 puan kaybediyor. Mantıksal açıdan ağır iş yükleri için FP8 veya BF16'yı gönderin; Bellek maliyetini kabul edin.

### 2026 toplama rehberi

- CPU/kenar hizmeti: GGUF Q4_K_M. Tamamlamak.
- GPU hizmeti, rutin sohbet, LoRA yok: AWQ.
- GPU hizmeti, çoklu LoRA: Marlin ile GPTQ.
- Muhakeme iş yükü: FP8.
- Blackwell veri merkezi, doğrulanmış kalite: NVFP4 + FP8 KV.
- Belirsiz: her aday formatta 1000 örneklik bir değerlendirme yapın.

```figure
gpu-memory-breakdown
```

## Use It — Hazır Araçla Uygula

`code/main.py` , çeşitli model boyutları için bellek ayak izini (ağırlıklar + KV + aktivasyonlar) ve altı formattaki göreceli verimi hesaplar. KV önbelleğinin nerede hakim olduğunu, ağırlık sıkıştırmanın nerede işe yaradığını ve FP8'in nerede güvenli seçim olduğunu gösterir.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-quantization-picker.md` üretir. Donanım, model boyutu, iş yükü türü ve kalite toleransı göz önüne alındığında bir format seçer ve bir kalibrasyon/doğrulama planı oluşturur.

## Egzersizler

1. `code/main.py`'yı çalıştırın. 128'de 2k bağlamıyla eş zamanlı bir 70B modeli için, her format için toplam HBM'yi hesaplayın. Hangi format bir H100 80GB'a sığmanızı sağlar?
2. 7B kodlamalı bir modeliniz var. Bir format seçin ve gerekçelendirin. Kalite toleransı konusunda yanılıyorsanız iyileşme yolu nedir?
3. Bir tıbbi alan modeli için AWQ'yu kalibre etmek için gereken kalibrasyon-dataset boyutunu hesaplayın. Neden daha fazla veri her zaman daha iyi değildir?
4. Marlin-AWQ çekirdek belgesini veya sürüm notlarını okuyun. AWQ'nun 7B'de neden 741 tok/s'ye ulaştığını, ham GPTQ'nun ise ~712'ye ulaştığını üç cümleyle açıklayın.
5. KV'yi BF16'da tutmak yerine AWQ ağırlıklarını FP8 KV önbelleğiyle birleştirmek ne zaman anlamlı olur?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| GGUF | "llama.cpp biçimi" | K-quant varyantlarını bir araya getiren dosya formatı; CPU/kenar varsayılanı |
| S4_K_M | "Q4 KM" | 4 bitlik K-kant ortamı; üretim GGUF varsayılanı |
| GPTQ | "vay be çiş tee q" | INT4'ü kalibrasyonla eğitin; vLLM'de LoRA'yı destekliyor |
| AWQ | "bir w q" | Etkinleştirmeye duyarlı INT4; Marlin çekirdekleri; INT4'te en iyi Pass@1 |
| Marlin çekirdekleri | "hızlı INT4 çekirdekleri" | Hopper'da INT4 için özel CUDA çekirdekleri; 10 kat hızlanma |
| FP8 | "sekiz bitlik kayan nokta" | Hopper/Ada/Blackwell'de varsayılan güvenli hassasiyet |
| MXFP4 / NVFP4 | "dört mikro ölçeklendirme" | Blok başına ölçek faktörlerine sahip Blackwell 4 bit FP |
| Kalibrasyon dataset | "cal verileri" | Niceleme parametrelerini seçmek için kullanılan giriş metni; etki alanıyla eşleşmelidir |
| KV önbellek nicelemesi | "KV INT8" | Ağırlıklardan ayrı seçim; dikkat doğruluğunu etkiler |

## Daha Fazla Okuma

- [VRLA Tech — LLM Niceleme 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — karşılaştırmalı benchmark'lar.
- [Jarvis Labs — vLLM Niceleme Tam Kılavuzu](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — formata göre üretim sayıları.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — format bazında seçme.
- [vLLM docs — Niceleme](https://docs.vllm.ai/en/latest/features/quantization/index.html) — desteklenen formatlar ve işaretler.
- [AWQ makalesi (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — orijinal AWQ formülasyonu.
- [GPTQ makalesi (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — orijinal GPTQ formülasyonu.
