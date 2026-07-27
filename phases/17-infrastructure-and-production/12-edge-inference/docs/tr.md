# Edge Inference — Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson

> Çekirdek kenar kısıtlaması bilgi işlem değil, bellek bant genişliğidir. Mobil DRAM 50-90 GB/s hızındadır; veri merkezi HBM3 2-3 TB/sn'yi temizler; bu 30-50x'lik bir farktır. Kod çözme belleğe bağlı olduğundan boşluk belirleyicidir. 2026'da manzara dört yöne ayrılıyor. Apple M4/A18 Neural Engine, birleşik bellekle (CPU↔NPU kopyası yok) 38 TOPS'a ulaşıyor. Qualcomm Snapdragon X Elite / 8. Nesil Hexagon 45 TOPS'a ulaştı. WebGPU + WebLLM, Llama 3.1 8B'yi (Q4) M3 Max'te ~41 tok/s hızında çalıştırır (kabaca yerelin %70-80'i); 17,6 bin GitHub yıldızı, OpenAI uyumlu API, ~%70-75 mobil kapsama alanı. NVIDIA Jetson Orin Nano Super (8GB), Llama 3.2 3B / Phi-3'e uygundur; AGX Orin gpt-oss-20b'yi vLLM aracılığıyla ~40 tok/s hızında çalıştırır; Jetson T4000 (JetPack 7.1), 2x AGX Orin'dir. TensorRT Edge-LLM, Bosch, ThunderSoft ve MediaTek tarafından CES 2026'da gösterilen EAGLE-3, NVFP4, parçalı önceden doldurmayı destekler.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak bant genişliğine bağlı kod çözme simülatörü)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Bileşenlerine Hizmet Verme), Aşama 17 · 09 (Üretim Niceleme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Mobil Yüksek Lisans inference'nin neden bellek bant genişliğine bağlı olduğunu ve bilgi işlemin neden ikincil olduğunu açıklayın.
- Dört uç hedefi (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) numaralandırın ve her birini bir kullanım senaryosuyla eşleştirin.
- 2026 WebGPU kapsam boşluğunu (Firefox Android yakalıyor) ve Safari iOS 26 açılışını adlandırın.
- Hedef başına bir niceleme formatı seçin (ANE için Core ML INT4 + FP16, Hexagon için QNN INT8/INT4, tarayıcı için WebGPU Q4, Jetson Thor için NVFP4).

## Sorun

Bir müşteri cihazda bir sohbet robotu istiyor: önce ses, varsayılan olarak özel, çevrimdışı çalışıyor. MacBook Pro M3 Max'te Llama 3.1 8B Q4 ~55 tok/s hızında çalışıyor - gayet iyi. Bir iPhone 16 Pro'da aynı model 3 tok/s hızında çalışıyor; bu iyi değil. Snapdragon 8 Gen 3'e sahip orta sınıf bir Android'de, 7 tok/s. Tarayıcıda, Chrome Android v121+ üzerinde WebGPU aracılığıyla, cihaza bağlı olarak 4-8 ​​tok/s.

Verim farkı bir taşıma sorunu değildir. Bu, bant genişliği boşluğu çarpı niceleme formatı çarpı NPU'ya kullanıcı alanından erişilip erişilemediğidir. 2026'daki Edge inference dört farklı çözümü olan dört farklı problemdir.

## Konsept

### Bant genişliği gerçek tavandır

Kod çözme, her token için ağırlıkların tam setini okur. 4. çeyrekteki bir 7B modeli 3,5 GB'tır. 50 GB/sn hızında 3,5 GB okumak 70 ms sürer; bu, ~14 tok/s teorik tavandır. 90 GB/sn'de (üst düzey mobil DRAM) tavan ~25 tok/s'ye çıkar. Bu sayının altında hiçbir hesaplama miktarı yardımcı olmaz.

3 TB/s hızında Veri Merkezi HBM3, aynı 3,5 GB'yi 1,2 ms'de temizler; tavan 830 tok/s'dir. Aynı model, aynı ağırlık. Farklı bellek alt sistemi.

### Apple Sinir Motoru (M4 / A18)

- 38 TOPS'a kadar. Birleşik bellek (CPU ve ANE aynı havuzu paylaşır) — kopyalama yükü yoktur.
- Core ML + `.mlmodel` derlenmiş modellerle veya PyTorch aracılığıyla Metal Performance Shader'lar (MPS) aracılığıyla erişim.
- Llama.cpp Metal arka uç doğrudan ANE'yi değil MPS'yi kullanır; yerel ANE, Core ML dönüşümü gerektirir.
- 2026'da iOS uygulamaları için en pratik yol: INT4 ağırlıkları + FP16 etkinleştirmeleriyle Core ML.

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- 45 TOPS'a kadar. SoC'de CPU ve GPU ile entegre ancak ayrı bellek alanı.
- QNN (Qualcomm Neural Network) SDK ve AI Hub, PyTorch/ONNX'ten dönüşüm sağlar.
- Sohbet şablonları, Llama 3.2, Phi-3'ün tümü AI Hub'da birinci sınıf artifact'lar olarak gönderilir.

### Intel / AMD NPU'lar (Lunar Lake, Ryzen AI 300)

- 40-50 ÜST. Yazılım Apple/Qualcomm'un gerisinde kalıyor; OpenVINO gelişiyor ancak niş.
- Windows ARM yardımcı pilot uygulamaları için en iyisi; Yerel öncelik için AMD/Intel masaüstü bilgisayarlarda yerel.

### WebGPU + WebLLM

- WebGPU hesaplama gölgelendiricileri aracılığıyla modelleri tarayıcıda çalıştırın; kurulum yok.
- M3 Max'te ~41 tok/s'de Llama 3.1 8B Q4 — aynı arka uç üzerinden yerelin kabaca %70-80'i.
- WebLLM'de 17,6 bin GitHub yıldızı; OpenAI uyumlu JS API'si; Apache2.0.
- 2026 kapsamı: Chrome Android v121+, Safari iOS 26 GA, Firefox Android hâlâ yetişiyor. Genel olarak ~%70-75 mobil kapsama alanı.

### NVIDIA Jetson ailesi

- Orin Nano Super (8GB): Llama 3.2 3B, Phi-3'e iyi tok/s değerleriyle uyar.
- AGX Orin: gpt-oss-20b'yi vLLM aracılığıyla ~40 tok/s hızında çalıştırır.
- Thor / T4000 (JetPack 7.1): 2 kat AGX Orin performansı, EAGLE-3 ve NVFP4 desteklenir.
- TensorRT Edge-LLM (2026), EAGLE-3 spekülatif kod çözmeyi, NVFP4 ağırlıklarını, parçalanmış önceden doldurmayı - uç noktaya taşınan veri merkezi optimizasyonlarını destekler.

### Hedef başına niceleme seçimi

| Hedef | Biçim | Notlar |
|--------|--------|-------|
| Elma ANE | INT4 ağırlıkları + FP16 aktivasyonları | Çekirdek ML dönüşüm yolu |
| Qualcomm Altıgen | QNN INT8 / INT4 | AI Hub dönüştürücüler |
| WebGPU / WebLLM | 4. Çeyrek MLC (q4f16_1) | `mlc_llm convert_weight` + derlenmiş `.wasm`; kullanın GGUF desteklenmiyor |
| Jetson Orin Nano | 4. Çeyrek GGUF veya TRT-LLM INT4 | Belleğe bağlı |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM yolu |

### Uçtaki uzun bağlam tuzağı

Llama 3.1'in 128K bağlamı bir veri merkezi özelliğidir. 8 GB RAM'e sahip bir telefonda, 32K tokens için 4 GB model + 2 GB KV önbellek + işletim sistemi yükü = OOM. Agresif KV nicelemesi (Q4 KV) kabul edilmedikçe Edge deployment'ler bağlamı 4K-8K'da tutar.

### Voice harika bir uygulama

Ses agent'lar gecikmeye duyarlıdır (ilk token < 500 ms). Yerel inference, ağ gecikmesini tamamen ortadan kaldırır. Konuşmayı metne dönüştürme (Whisper Turbo çeşitleri uçta çalışır) ile birleştirildiğinde, kenar inference üretim kalitesinde ses döngüsü haline gelir.

### Hatırlamanız gereken sayılar

- Apple M4 / A18 ANE: 38 ÜST.
- Qualcomm Hexagon SD X Elite: 45 TOPS.
- WebLLM M3 Maks: Llama 3.1 8B Q4'te ~41 tok/s.
- AGX Orin: vLLM aracılığıyla gpt-oss-20b'de ~40 tok/s.
- Veri merkezi uç bant genişliği boşluğu: 30-50x.
- WebGPU mobil kapsama alanı: ~%70-75 (Firefox Android gecikmesi).

## Use It — Hazır Araçla Uygula

`code/main.py` uç hedefler boyunca bant genişliğine bağlı matematikten teorik kod çözme aktarım hızı tavanlarını hesaplar. Gözlemlenen benchmark'larle karşılaştırır ve darboğazın hesaplamanın değil bant genişliğinin olduğunu vurgular.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-edge-target-picker.md` üretir. Belirli bir platform (iOS/Android/tarayıcı/Jetson), model ve gecikme/bellek bütçesi, bir niceleme formatı ve dönüşüm hattını seçer.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Snapdragon 8 Gen 3 (~77 GB/s bant genişliği) üzerinde 4. çeyrekte 7B modeli için kod çözme tavanını hesaplayın. Gözlemlenen 6-8 tok/s ile karşılaştırın — çalışma zamanı verimli mi?
2. Android'deki WebGPU, Chrome v121+ gerektirir. Aynı OpenAI uyumlu API aracılığıyla sunucu tarafında eski tarayıcılar için bir yedek tasarlayın.
3. iOS uygulamanızın 4K bağlam akışına ihtiyacı var. Hangi model/format kombinasyonu iPhone 16'da 4 GB aktif hafızanın altında kalmanızı sağlar?
4. Jetson AGX Orin, gpt-oss-20b'yi 40 tok/s hızında çalıştırır. Jetson Nano yalnızca 3B'ye uyar. Ürününüz her ikisini de hedefliyorsa inference yığınını nasıl birleştirebilirsiniz?
5. "WebLLM'nin 2026'da üretime hazır olup olmadığını" tartışın. Kapsama, performansa ve Firefox Android boşluğuna değinin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| ANE | "Apple sinir motoru" | M serisi ve A serisinde cihaz üzeri NPU; birleşik bellek |
| Altıgen | "Qualcomm NPU'su" | Aslanağzı NPU'su; Erişim için QNN SDK'sı |
| Web GPU'su | "tarayıcı GPU'su" | W3C standartlaştırılmış tarayıcı GPU API'si; Chrome/Safari 2026 |
| WebLLM | "tarayıcı Yüksek Lisans çalışma zamanı" | MLC-LLM projesi; Apaçi 2.0; OpenAI uyumlu JS |
| Jetson | "NVIDIA kenarı" | Orin Nano / AGX / Thor / T4000 ailesi |
| TRT Edge-LLM | "kenar TensorRT" | TensorRT-LLM'nin 2026 uç bağlantı noktası; KARTAL-3 + NVFP4 |
| Birleşik bellek | "ortak havuz" | CPU ve NPU aynı RAM'i görüyor; kopya yükü yok |
| Bant genişliğine bağlı | "bellek sınırlı" | Bayt/sn okuma ağırlıklarına göre kod çözme |
| Çekirdek ML | "Apple dönüşümü" | ANE'ye özgü modeller için Apple framework |
| QNN | "Qualcomm yığını" | Qualcomm Neural Network SDK'sı |

## Daha Fazla Okuma

- [Cihaz Üzerinde Yüksek Lisans Birliğin Durumu 2026](https://v-chandra.github.io/on-device-llms/) — yatay ve benchmark'lar.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) — Orin / AGX / Thor.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) — 2026 uç bağlantı noktası duyurusu.
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) — tasarım ve benchmark'lar.
- [Apple Core ML](https://developer.apple.com/documentation/coreml) — ANE-yerel dönüşüm.
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) — Hexagon için önceden dönüştürülmüş modeller.
