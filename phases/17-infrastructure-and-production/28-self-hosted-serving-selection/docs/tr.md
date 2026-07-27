# Kendi Kendine Barındırılan Sunum Seçimi — Motoru Donanım ve Ölçekle Eşleştirme

> Motor seçimi, sıralama tablosunun okunması değil, donanımın, ölçeğin ve ekosistemin bir fonksiyonudur. 2026'da kendi kendine barındırılan inference'de dört motor hakim durumda: llama.cpp, Ollama, vLLM, SGLang ve TGI bakım modunda takip ediyor. **llama.cpp** CPU açısından en hızlısıdır; en geniş model desteği, niceleme ve iş parçacığı üzerinde tam kontrol. **Ollama** geliştirici-dizüstü bilgisayar tek komutlu kurulumdur, llama.cpp 'den (Go + CGo + HTTP serileştirme) ~%15-30 daha yavaştır, ürün benzeri yük altında 3 kat verim açığı. **TGI 11 Aralık 2025'te bakım moduna girdi** — yalnızca hata düzeltmeleri, vLLM'den ~%10 daha yavaş ham aktarım hızı, ancak tarihsel olarak en iyi observability ve HF ekosistemi entegrasyonu. Bu bakım durumu, onu uzun vadeli riskli bir bahis haline getiriyor; SGLang veya vLLM, yeni projeler için daha güvenli varsayılanlardır. **vLLM** genel amaçlı üretim varsayılanıdır — v0.15.1 (Şubat 2026), PyTorch 2.10, RTX Blackwell SM120, H200 optimizasyonunu ekler. **SGLang**, üretimde 400.000'den fazla GPU (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS) ile agentic çok turlu / önek ağırlıklı uzmandır. Donanım kısıtlamaları: Önce CPU → llama.cpp. AMD / NVIDIA olmayan → vLLM, en güçlü desteklenen yoldur (TRT-LLM, NVIDIA kilitlidir). 2026 ardışık düzen modeli: dev = Ollama, evreleme = llama.cpp, prod = vLLM veya SGLang. Motorlar farklı ağırlık formatlarını alır - llama.cpp ailesi için GGUF, GPU motorları için HF güvenlik engelleyicileri - dolayısıyla format dönüşümü aşamalar arasında yer alabilir.

**Tür:** Öğren
**Diller:** Python (stdlib, motor karar ağacı yürüteç)
**Önkoşullar:** Motorları kapsayan tüm Aşama 17 dersleri (04, 06, 07, 09, 18)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Donanıma (CPU / AMD / NVIDIA Hopper / Blackwell), ölçeğe (1 kullanıcı / 100 / 10.000) ve iş yüküne (genel sohbet / agent / uzun bağlam) göre bir motor seçin.
- 2026 TGI bakım modu durumunu (11 Aralık 2025) ve neden yeni projeleri vLLM veya SGLang'a yönlendirdiğini belirtin.
- GGUF-safetensors format dönüşümünün aşamalar arasında nerede yer aldığı da dahil olmak üzere geliştirme/aştırma/üretim hattını açıklayın.
- "CPU-first" ifadesinin neden llama.cpp 'ı işaret ettiğini ve "AMD" ifadesinin neden TRT-LLM'yi hariç tuttuğunu açıklayın.

## Sorun

Ekibiniz, kendi kendine barındırılan yeni bir Yüksek Lisans projesine başlıyor. Bir mühendis Ollama diyor, bir diğeri vLLM diyor, üçüncüsü "TGI kutudan çıktığı gibi çalışmıyor mu?" Üçü de farklı bağlamlar için uygundur. Hiçbiri herkes için doğru değil.

2026'da seçim ağacı önemlidir: önce donanım, ikinci olarak ölçek, üçüncü olarak iş yükü. Ve 2025'teki belirli bir olay - TGI'nın 11 Aralık'ta bakım moduna girmesi - yeni projeler için varsayılanı değiştiriyor.

## Konsept

### Beş motor

| Motor | Şunun için en iyisi | Notlar |
|--------|----------|-------|
| **llama.cpp** | CPU / uç / minimum derinlik / en geniş model desteği | CPU'da en hızlı, tam kontrol |
| **Ollama** | Geliştirici dizüstü bilgisayarlar, tek kullanıcılı, tek komutla kurulum | llama.cpp'dan %15-30 daha yavaş; 3 kat ürün çıktı açığı |
| **TGI** | HF ekosistemi, düzenlenmiş endüstriler | **Bakım modu 11 Aralık 2025** |
| **vLLM** | Genel amaçlı üretim, 100'den fazla kullanıcı | Geniş üretim varsayılanı; v0.15.1 Şubat 2026 |
| **SGLang** | Agentçok dönüşlü, önek ağırlıklı iş yükleri | 400.000'den fazla GPU üretimde |

### Donanım öncelikli karar

**Önce CPU** → llama.cpp. Ollama da çalışıyor ama daha yavaş. Başka hiçbir motor CPU konusunda rekabetçi değildir.

**AMD GPU** → vLLM, desteklenen en güçlü yoldur (AMD ROCm desteği). SGLang da çalışıyor. TRT-LLM NVIDIA kilitli olduğundan artık yayında değil.

**NVIDIA Haznesi (H100 / H200)** → vLLM veya SGLang veya TRT-LLM. Üçü de üst düzey.

**NVIDIA Blackwell (B200 / GB200)** → TRT-LLM iş hacmi lideridir (Aşama 17 · 07). vLLM ve SGLang yakından takip ediyor.

**Apple Silicon (M serisi)** → llama.cpp (Metal). Ollama bunu tamamlıyor.

### Ölçek saniye kararı

**1 kullanıcı / yerel geliştirici** → Ollama. Bir komut, ilk-token saniye içinde.

**10-100 kullanıcı / küçük ekip** → vLLM tek GPU.

**100-10 bin kullanıcı / üretim** → vLLM üretim yığını (Aşama 17 · 18) veya SGLang.

**10 binden fazla kullanıcı / kuruluş** → vLLM üretim yığını + ayrıştırılmış (Aşama 17 · 17) + LMCache (Aşama 17 · 18).

### İş yüküyle ilgili üçüncü karar

**Genel sohbet / Soru-Cevap** → vLLM geniş varsayılanda kazanır.

**Agentic çoklu dönüş (araçlar, planlama, bellek)** → SGLang'ın RadixAttention'ı (Aşama 17 · 06) hakimdir.

**Yoğun ön ek yeniden kullanımına sahip RAG** ​​→ SGLang.

**Kod oluşturma** → vLLM iyi; SGLang önbellekte biraz daha iyi.

**Uzun bağlam (128K+)** → vLLM + parçalı önceden doldurma; SGLang + katmanlı KV.

### TGI bakım tuzağı

Hugging Face TGI, 11 Aralık 2025'te bakım moduna girdi; yalnızca ileriye dönük hata düzeltmeleri yapılacak. Tarihsel olarak: üst düzey observability, sınıfının en iyisi HF ekosistemi entegrasyonu (model kartları, güvenlik araçları), ham iş hacmi açısından vLLM'nin biraz gerisinde.

2026'daki yeni projeler için: varsayılan olarak TGI'dan uzak. Mevcut TGI deployment'ler devam edebilir ancak eninde sonunda taşınmalıdır. SGLang ve vLLM daha güvenli varsayılanlardır.

### Boru hattı modeli

Dev (Ollama) → aşamalandırma (llama.cpp) → prod (vLLM). Motorlar farklı ağırlık formatlarını alır ( llama.cpp ailesi için GGUF, GPU motorları için HF güvenlik engelleyicileri) yani format dönüşümü aşamalar arasında yer alabilir. Mühendisler dizüstü bilgisayarlarda hızlı bir şekilde yineleme yapar; aşamalandırma, üretim nicemlemesini yansıtır; prod servis hedefidir.

### Ollama uyarısı

Ollama geliştiriciler için harikadır. Paylaşılan üretim için pek iyi değil: Go HTTP serileştirme ek yük getirir, eşzamanlılık yönetimi vLLM'den daha basittir, OpenTelemetry desteğinde gecikmeler olur. Ollama'yı en iyi şekilde kullanın (tek kullanıcı, tek komut) ve paylaşım için vLLM'ye geçin.

### Kendi kendine barındırılan ve yönetilen ayrı bir karardır

Aşama 17 · 01 (yönetilen hiper ölçekleyiciler), · 02 (inference platformlar) yönetilen kapağı kapsar. Bu ders, kendi kendine ev sahipliği yapmaya zaten karar verdiğinizi varsayar. Kendi kendine barındırmanın nedenleri: veri yerleşimi, özel ince ayar, geniş ölçekte toplam maliyet sahipliği, barındırılanda alan adı modelinin bulunmaması.

### Hatırlamanız gereken sayılar

- TGI bakım modu: 11 Aralık 2025.
- vLLM v0.15.1: Şubat 2026; PyTorch 2.10; Blackwell SM120 desteği.
- SGLang üretim alanı: 400.000+ GPU.
- Ollama verim farkı llama.cpp'a göre: %15-30 daha yavaş; Ürün yükü altında 3 kat.

```figure
data-parallel
```

## Use It — Hazır Araçla Uygula

`code/main.py` bir karar ağacı yürütücüsüdür: donanım + ölçek + iş yükü göz önüne alındığında bir motor seçer ve nedenini açıklar.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-engine-picker.md` üretir. Kısıtlamalar göz önüne alındığında, bir motor seçer ve geçiş planını yazar.

## Egzersizler

1. `code/main.py` 'yi donanımınız / ölçeğiniz / iş yükünüz ile çalıştırın. Çıktı sezginize uyuyor mu?
2. Altyapınız 12 H100s ve 8 MI300X AMD'dir. Hangi motor? TRT-LLM neden masadan kaldırıldı?
3. Bir ekip 2026'da TGI'yı kullanmak istiyor çünkü "bildiğimiz şey bu." Göç davasını tartışın.
4. vLLM prod'a geçiş yapma: nicemlemede, konfigürasyonda ve observability'da ne gibi değişiklikler olur?
5. P99 önek uzunluğu 8K olan ve kiracılar arasında yüksek yeniden kullanıma sahip RAG ürünü. Bir motor seçin ve onu Aşama 17 · 11 + 18 ile istifleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| llama.cpp | "CPU bir" | En geniş model desteği, CPU'da en hızlı |
| Olma | "dizüstü bilgisayar olan" | Tek komutla kurulum, geliştirme düzeyinde verim |
| TGI | "HF hizmet veriyor" | Aralık 2025'ten bu yana bakım modu |
| vLLM | "varsayılan" | Geniş üretim temeli 2026 |
| SGLang | "agentic olan" | Önek ağırlıklı, RadixAttention |
| TRT-LLM | "NVIDIA kilitli" | Blackwell üretim lideri, yalnızca NVIDIA |
| GGUF | "llama.cpp biçimi" | Paketlenmiş K-quant çeşitleri |
| Üretim yığını | "vLLM K8'ler" | Aşama 17 · 18 referansı deployment |
| Boru hattı modeli | "geliştirme→aşama→ürün" | Ollama → llama.cpp → vLLM; ağırlık formatları motora göre farklılık gösterir |

## Daha Fazla Okuma

- [Yapay Zeka Yapımı Araçlar — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Kapsamlı Yüksek Lisans Inference Motor Karşılaştırması](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 2026'nın En İyi 10 vLLM Alternatifi](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI bakım duyurusu](https://github.com/huggingface/text-generation-inference) — sürüm notları.
- [vLLM v0.15.1 sürüm notları](https://github.com/vllm-project/vllm/releases)
