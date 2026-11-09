# Edge Inference  Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson

> Temel kenar kısıtlaması, hesaplama değil hafıza bant genişliği. Mobil DRAM, 50-90 GB/s'de oturuyor; HBM3 veri merkezi 2-3 TB/s  30-50x boşluğu temizliyor. Deşifreleme hafıza bağlanmış, bu yüzden boşluk belirleyici. 2026'da manzara dört bölüme ayrılır. Apple M4/A18 Neural Engine, birleşik bellek (CPU NPU kopyası) ile 38 TOPS'e ulaştı. Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon 45 TOPS'e ulaştı. WebGPU + WebLLM, M3 Max'te Llama 3.1 8B (Q4) ile ~41 tok/s ile çalışır (doğuştan yaklaşık %70-80%); 17.6k GitHub yıldızları, OpenAI uyumlu API, ~70-75% mobil kapsama. NVIDIA Jetson Orin Nano Super (8GB) Llama 3.2 3B / Phi-3'ye uyar; AGX Orin vLLM üzerinden gpt-oss-20b'yi ~40 tok/s'de çalışır; Jetson T4000 (JetPack 7.1) 2x AGX Orin. TensorRT Edge-LLM EAGLE-3, NVFP4, parçalanmış prefill  tarafından CES 2026'da gösterilen EAGLE-3, NVFP4 desteğini sağlar.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Mobil LLM sonuçlarının neden hafıza bant genişliği ile sınırlı olduğunu ve hesaplamaların neden ikinci sırada olduğunu açıklayın.
- Dört kenar hedefi (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) listeleyin ve her birini bir kullanım durumuna eşleştirin.
- 2026 WebGPU kapsamı boşluğu (Firefox Android yakalama) ve Safari iOS 26 inişini isimlendirin.
- Hedef başına bir kuantitasyon biçimi seçin (Core ML INT4 + FP16 için ANE, QNN INT8/INT4 için Hexagon, WebGPU Q4 için tarayıcı, NVFP4 için Jetson Thor).

## Sorun

Bir müşteri bir cihaz üzerinde bir chatbot istiyor: sesli önce, özel öntanımlı olarak, çevrimdışı çalışır. Bir MacBook Pro M3 Max'te, Llama 3.1 8B Q4 ~55 tok/s  ile çalışır. Bir iPhone 16 Pro'da, aynı model 3 tok/s  ile çalışır.

Geçerlilik varyansi bir portleme sorunu değildir. NPU'nun kullanıcı alanından erişilebilir olup olmadığı için bant genişliği farkı çarpı olarak kuantitasyon biçimi çarpı olarak kullanılır. 2026'da kenar çıkarım dört farklı çözüm ile dört farklı sorundur.

## Anlaşım

### Çubuğun genişliği gerçek tavan

Dekode, her token için tüm ağırlıkları okuyor. Q4'te bir 7B modeli 3.5 GB'dır. 50 GB / s'de 3.5 GB okuyarak 70 ms  ~ 14 tok / s teorik bir tavan alır. 90 GB / s (yüksek sonlu mobil DRAM) da tavan ~ 25 tok / s'ye taşınır.

Datacenter HBM3 3 TB/s'de aynı 3.5 GB'yi 1.2 ms'de temizler  tavan 830 tok/s'dir. Aynı model, aynı ağırlıklar. Farklı bellek alt sistemi.

### Apple Sinir Motoru (M4 / A18)

- 38 TOPS'e kadar. Birleştirilmiş bellek (CPU ve ANE aynı havuzyu paylaşıyor)  Kopya üstü maliyeti yoktur.
- Core ML +  üzerinden erişim`.mlmodel`Dökülen modeller veya PyTorch üzerinden Metal Performance Shaders (MPS) aracılığıyla.
- Llama.cpp Metal backend doğrudan ANE değil MPS kullanır; yerel ANE Core ML dönüşümünü gerektirir.
- 2026'da iOS uygulamaları için en iyi pratik yol: INT4 ağırlıkları + FP16 etkinleştirmeleri ile Core ML.

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- 45 TOPS'e kadar. SoC'de CPU ve GPU ile entegre ama ayrı hafıza alanı.
- QNN (Qualcomm Neural Network) SDK ve AI Hub PyTorch/ONNX'den dönüşüm sağlar.
- Çat şablonları, Llama 3.2, Phi-3 hepsi AI Hub'da birinci sınıf eserler olarak gönderiliyor.

### Intel / AMD NPU'ları (Lunar Lake, Ryzen AI 300)

- 40-50 TOPS. Yazılım Apple/Qualcomm'dan geride kalıyor; OpenVINO gelişmekte ama niş.
- Windows ARM yardımcı pilot uygulamaları için en iyisi; yerel olarak ilk olarak AMD/Intel masaüstülerinde doğuştur.

### WebGPU + WebLLM

- WebGPU hesaplama şaderleri üzerinden tarayıcıda modeller çalıştırın; kurulmaz.
- Llama 3.1 8B Q4 M3 Max'de ~41 tok/s'de yaklaşık olarak aynı arka uç üzerinden yerli %70-80%'i.
- 17.6k GitHub yıldızları WebLLM; OpenAI uyumlu JS API; Apache 2.0.
- 2026 kapsamı: Chrome Android v121+, Safari iOS 26 GA, Firefox Android hala yakalamak. Genel olarak ~ 70-75% mobil kapsam.

### NVIDIA Jetson ailesi

- Orin Nano Super (8GB): Llama 3.2 3B, Phi-3'e iyi noktada uyar.
- AGX Orin: gpt-oss-20b'yi vLLM üzerinden ~40 tok/s ile çalışır.
- Thor / T4000 (JetPack 7.1): 2x AGX Orin performans, EAGLE-3 ve NVFP4 desteklenir.
- TensorRT Edge-LLM (2026) EAGLE-3 spekülatör çözümü, NVFP4 ağırlıklarını, parçalanmış prefill  edge'ye aktarılan veri merkezi optimizasyonlarını destekler.

### Hedef başına miktar seçimi

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### Uzun bağlamlı bir tuzak kenarında

Llama 3.1'ün 128K bağlamı bir veri merkezi özelliğidir. 8 GB RAM, 4 GB model + 2 GB KV önbelleği 32K jetonları + OS overhead = OOM için bir telefonda.

### Ses , katil uygulamadır .

Ses ajanları gecikme hassasıdır (birinci token < 500 ms). Yerel sonuçlama ağ gecikmesini tamamen ortadan kaldırır. Konuşma-sözle (Whisper Turbo çeşitleri kenarda çalışır) birleştirilince kenar sonuçlandırması üretim kalitesi ses döngüsü haline gelir.

### Hatırlamalısın numaralar

- Apple M4 / A18 ANE: 38 TOPS.
- Qualcomm Hexagon SD X Elite: 45 TOPS.
- WebLLM M3 Max: Llama 3.1 8B Q4'te ~41 tok/s.
- AGX Orin: ~ 40 tok/s gpt-oss-20b üzerinden vLLM.
- Veri merkezi kenarında bant genişliği boşluğu: 30-50x.
- WebGPU mobil kapsamı: ~ 70-75% (Firefox Android geride kaldı).

```figure
edge-bandwidth-pipe
```

## Kullan

`code/main.py`Kısayolu hedefler üzerinden bant genişliği sınırlı matematikten teorik dekod geçiş tavanlarını hesaplar.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-edge-target-picker.md`. Verilen platform (iOS/Android/browser/Jetson), model ve gecikme/hüzdedecek bütçe, bir kuantitasyon biçimi ve dönüşüm borusunu seçer.

## Egzersizler

1. Çık .`code/main.py`. Snapdragon 8 Gen 3 (~ 77 GB / s bant genişliği) ile Q4'te 7B model için, dekodlama tavanını hesaplayın.
2. Android'deki WebGPU, Chrome v121+ gerektiriyor. Aynı OpenAI uyumlu API üzerinden eski tarayıcılar için  sunucu tarafında bir geri dönüş tasarlayın.
3. iOS uygulamanız 4K bağlam akışı gerektirir. Hangi model/format kombinasyonu iPhone 16'da 4 GB aktif bellek altında kalmanıza izin verir?
4. Jetson AGX Orin 40 tok/s hızıyla gpt-oss-20b çalıştırır. Jetson Nano sadece 3B'ye uyar.
5. "WebLLM 2026'da üretime hazır mı" tartışın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## Daha Fazla Okumak

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) manzara ve referans değerleri.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) Orin / AGX / Thor.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/)2026 kenar liman ilanı.
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) tasarım ve referans değerleri.
- [Apple Core ML](https://developer.apple.com/documentation/coreml) ANE-devli dönüşüm.
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) Hexagon için önceden dönüştürülen modeller.
