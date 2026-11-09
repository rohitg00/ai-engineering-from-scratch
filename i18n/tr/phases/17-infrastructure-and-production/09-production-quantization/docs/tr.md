# Üretim Kvantılandırması  AWQ, GPTQ, GGUF K-kvantları, FP8, MXFP4/NVFP4

> Kvantisalizasyon biçimi evrensel bir seçim değildir  donanım, hizmet motor ve iş yükü fonksiyonu. GGUF Q4_K_M veya Q5_K_M, llama.cpp ve Ollama üzerinden teslim edilen CPU ve kenarına sahiptir. GPTQ aynı tabanda çoklu LORA'ya ihtiyaç duyduğunda vLLM'de kazanır. Marlin-AWQ çekirdekleri ile AWQ, en iyi Pass@1 ile 7B sınıfı modelinde, 2026'da veri merkezi üretimi için varsayılan  INT4'de ~741 tok/s'i sağlar. FP8 Hopper, Ada ve Blackwell'de orta yerde kalır  neredeyse kayıpsız ve yaygın olarak desteklenir. NVFP4 ve MXFP4 (Blackwell mikroskalingi) agresif ve blok başına onaylama gerektirir. İki tuzak ısırma ekibi: Kalibrasyon verileri dağıtım alanına eşleşmelidir ve KV önbelleği ağırlık kvantizasyonundan ayrıdır  AWQ dersi "Modem şimdi 4 GB'dır" üretim seri boyutlarında 10-30 GB KV önbelleğini unutur.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- 2026'da altı üretim kuantitasyon biçimi ve tatlı noktalarını isimlendirin.
- Verilen donanım (CPU vs GPU, Hopper vs Blackwell), motor (vLLM, TRT-LLM, llama.cpp) ve iş yükünü seçin (rutinal sohbet, mantık, multi-LoRA).
- Kaydedilen ağırlık belleğini hesaplayın ve seçilen biçim için KV önbelleği dokunulmamış olarak bırakın.
- Domen trafiğinde kuantistik modelleri düşüren kalibrasyon veri kümesi tuzağını isimlendirin.

## Sorun

Kvantizasyon, hafıza ve HBM bant genişliğini azaltır, bu da tam olarak dekodlamanın ihtiyacı olan şeydir. FP16 70B modeli 140 GB ağırlıklıdır. Kvantize ağırlıkları INT4 (AWQ veya GPTQ) olarak ölçün ve model 35 GB  bir H100'e KV kaş için yerleştirilir.

Ancak kuantizasyon ücretsizdir. Agresif kuantizasyon kaliteyi, özellikle akıl yürütme ağır görevlerde bozar. Farklı biçimler farklı motorlarla çalışır. Farklı donanımlar farklı hassasiyetleri yerli olarak destekler. 2026 biçimi hayvanat bahçesi gerçek ve başkalarının seçimini kopyalayamazsınız.

## Anlaşım

### Altı format

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA on vLLM | vLLM, TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### GGUF  CPU/geze varsayılan

GGUF, kendi başına bir kuantitasyon şeması değil, bir dosya biçimidir. K-quant varianlarını (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) bir konteynere birleştirir. Q4_K_M ve Q5_K_M, üretim öntanımlılarıdır.

VLLM'de geçiş cezası: ~93 tok/s 7B  format GPU çekirdekleri için optimize edilmemiştir. Ulaştırma hedefi CPU/gez olduğunda GGUF kullanın.

### GPTQ  vLLM'de çoklu LORA

GPTQ, kalibrasyon geçişine sahip bir eğitim sonrası kuantitasyon algoritmasıdır. Marlin çekirdekleri GPU'da (2.6x hızlandırma vs. Marlin olmayan GPTQ) hızlı hale getirir. ~712 tok/s 7B'de.

GPTQ-Int4 vLLM'de LoRA adaptörlerini destekler. Eğer bir temel model ve 10-50 ince ayarlanmış variantları (her biri bir LoRA olarak) sunuyorsanız, GPTQ yolunuzdur. NVFP4 henüz 2026'ın başından itibaren LoRA'yı desteklemiyor.

### AWQ  veri merkezi GPU'sı varsayılan

Aktifleştirme-Aydın Ağırlık Kvantisalatı. Kvantisalat sırasında% 1 en iyi ağırlıkları korur. Marlin-AWQ çekirdekleri: 10.9x hızlandırma vs. naif. ~ 7B'de 741 tok/s, INT4 formatları arasında en iyi Pass@1.

Yeni GPU servisini seçmek için AWQ seçin, ancak çoklu LoRA (GPTQ) veya agresif Blackwell FP4 (NVFP4) ihtiyacınız yoksa.

### FP8  güvenilir orta

8 bit yüzen nokta. Neredeyse kayıpsız. Geniş desteklenir. Hopper Tensor Cores FP8'yi doğuştan hızlandırır. Blackwell miras alır. FP8 kalitesi pazarlanamayacak (düşünme, tıbbi, kod-gen) olduğunda güvenli 2026 varsayılan noktasıdır. Hatıra tasarrufu INT4'in yarısıdır ancak kalite riski çok daha düşüktür.

### MXFP4 / NVFP4  Blackwell saldırgan

Mikroskala FP4. Ağırlıkların her bloku kendi ölçek faktörüne sahiptir. Blackwell Tensor Cores'te agresif ancak donanımsal hızlandırılmış. FP8 karşısında bir token için baytları yarıya düşürün  17 · 07 aşamasında ekonomik kazanç.

Kafesler:
- LoRA desteği henüz yok (2026 başlarında).
- Kalit düşüşü, akıl yürütme ağır iş yüklerinde görülebilir.
- Model başına değerlendirme ayarını doğrulayın.

### Kalibrasyon tuzakı

AWQ ve GPTQ, tipik olarak C4 veya WikiText olarak bir kalibrasyon veri kümesi gerektirir. Domen modelleri (kod, tıbbi, yasal), genel web metnini kalibrlemek algoritmanın hangi ağırlıkları koruyacağı konusunda yanlış kararlar vermesine izin verir. HumanEval'de Pass@1 birkaç puan düşebilir.

Düzeltme: alan içindeki verileri kalibre edin. Yüzlerce alan örneği genellikle yeterli olur.

### KV'nin önbellek tuzağı

AWQ ağırlıkları 4 bit'e düşürür. KV önbelleği ayrıdır ve FP16/FP8'de kalır. AWQ ile 70B modeli için:

- Ağırlık: ~ 35 GB (INT4 140 GB'dan).
- KV önbelleği 128 eşzamanlı × 2k bağlamda: ~ 20 GB.
- Aktifleştirmeler: ~ 5 GB.
- Toplam: ~ 60 GB  H100 80 GB'a uykuluyor.

"Modemi 4 GB'ye kadar kvantize ettim" gibi safca, diğer 30-50 GB'ları unuttu.

Ayrıcası, KV cache kuantizasyonu (FP8 KV veya INT8 KV) kendi özelliği ile farklı bir seçimdir  dikkat doğruluğunu doğrudan etkiler ve ücretsiz bir kazanç değildir.

### AWQ INT4 akıl yürütmek için tehlikelidir.

Düşünce zinciri, matematik, uzun bağlamlı kod-gen  bunlar agresif kuantizasyondan görülebilir şekilde zarar görür. AWQ INT4 MATH'de ~ 3-5 puan kaybeder. Düşünce ağır iş yükleri için, FP8 veya BF16'u gönderin; bellek maliyetini kabul edin.

### 2026 seçme rehberi

- CPU/gear servis: GGUF Q4_K_M. Tamamlandı.
- GPU servis, rutin sohbet, LoRA yok.
- GPU servis, çoklu LoRA: Marlin ile GPTQ.
- Dönüşümleme iş yükü: FP8.
- Blackwell veri merkezi, onaylanmış kalite: NVFP4 + FP8 KV.
- İkiyüzlü: her aday biçiminde 1000 örnek değerlendirme yapın.

```figure
gpu-memory-breakdown
```

## Kullan

`code/main.py`bir dizi model boyutu için hafıza ayak izi (koşum + KV + etkinleştirmeler) ve altı format boyunca nispeten geçiş hesaplar. KV önbelleğinin üstün olduğu, ağırlık sıkıştırmasının ödediği ve FP8'in güvenli seçimi olduğu yerleri gösterir.

- Evet .[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?dtype=fp8&users=64)NVIDIA L4'te FP8 gösterir. Ağırlıklar 15.28 GB'dan 8.81 GB'ye düşer, KV havuzu 24.094'den 142.369 token'e çıkar ve 64 kullanıcıda ölçülen çıkış saniyede 250.85'den 735.91 token'e çıkar.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-quantization-picker.md`. Hardver, model boyutu, iş yükü türü ve kalite toleransına göre bir format seçer ve kalibrasyon/validasyon planı oluşturur.

## Egzersizler

1. Çık .`code/main.py`Her format için toplam HBM'yi hesaplayın. Hangi format bir H100 80GB'ye sığmanıza izin verir?
2. Eğer kalite toleransı konusunda yanılıyorsanız, geri kazanma yolu nedir?
3. Bir tıbbi alan modeli için AWQ'yi kalibre etmek için gerekli kalibrasyon veri kümesi boyutunu hesaplayın.
4. Marlin-AWQ çekirdek kağıdı veya yayın notlarını okuyun. AWQ'ın 7B'de neden 741 tok/s'e ulaştığını ve çiğ GPTQ'nin neden 712'e ulaştığını üç cümleyle açıklayın.
5. AWQ ağırlıklarını FP8 KV kaydıyla BF16'da tutmak ne zaman mantıklı olur?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GGUF | "llama.cpp format" | File format bundling K-quant variants; CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium; the production GGUF default |
| GPTQ | "gee pee tee q" | Post-train INT4 with calibration; supports LoRA in vLLM |
| AWQ | "a w q" | Activation-aware INT4; Marlin kernels; best Pass@1 at INT4 |
| Marlin kernels | "fast INT4 kernels" | Custom CUDA kernels for INT4 on Hopper; 10x speedup |
| FP8 | "eight-bit float" | Safe precision default on Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling four" | Blackwell 4-bit FP with per-block scale factors |
| Calibration dataset | "cal data" | Input text used to pick quantization parameters; must match domain |
| KV cache quantization | "KV INT8" | Separate choice from weights; affects attention accuracy |

## Daha Fazla Okumak

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) karşılaştırmalı referans değerleri.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) Formatlardaki geçiş sayısı.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) Format-bu format seçimi.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) desteklenen formatlar ve bayraklar.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) orijinal AWQ formülasyonu.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) orijinal GPTQ formülasyonu.
