# Kendine Konutlanan Hizmet Seçimi  Hardware ve ölçekle Eşleşen Motor

> Motor seçimi, bir lider çizelgesi değil, bir donanım, ölçek ve ekosistem fonksiyonu. 2026 yılında dört motor kendi kendine konutlanmış sonuçlara hakim: llama.cpp, Ollama, vLLM, SGLang, TGI bakım modunda geride kalır.**llama.cpp**CPU'da en hızlı  en geniş model desteği, kuantitasyon ve ipleme üzerinde tam kontrol. **Ollama**dev-laptop tek komut yüklemesi, llama.cpp (Go + CGo + HTTP serileşmesi) ile karşılaştırıldığında ~15-30% daha yavaş, prod benzeri yük altında 3x geçiş boşluğu. **TGI entered maintenance mode December 11, 2025** sadece hata düzeltmeleri, ~ 10% daha yavaş ham üretimi, ancak tarihsel olarak en iyi gözlemlebilirlik ve HF ekosistem entegrasyonu. Bu bakım durumu, yeni projeler için riskli uzun vadeli bir bahis yapar  SGLang veya vLLM daha güvenli varsayımlardır. **vLLM**Genel amaçlı üretim öntanımlı  v0.15.1 (Şubat 2026) PyTorch 2.10, RTX Blackwell SM120, H200 optimizasyonu ekler. **SGLang**Bu, bir çok dönüş / önbellek ağırlıklı uzmanı  400.000+ GPU'ların üretimi (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS) için. Hardware kısıtlamaları: CPU-first → llama.cpp. AMD / non-NVIDIA → vLLM en güçlü desteklenen yol (TRT-LLM NVIDIA kilitlenmiştir). 2026 boru hattı modeli: dev = Ollama, staging = llama.cpp, prod = vLLM veya SGLang. Motorlar farklı ağırlık formatlarını alır  llama.cpp ailesi için GGUF, GPU motorları için HF safetensörleri  böylece bir format dönüşümü aşamalar arasında oturabilir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Öğrenme Hedefleri

- Verilen bir motor (CPU / AMD / NVIDIA Hopper / Blackwell), ölçek (1 kullanıcı / 100 / 10,000) ve iş yükünü seçin (genel sohbet / ajan / uzun bağlam).
- 2026 TGI bakım modunun durumunu (11 Aralık 2025) ve yeni projeleri vLLM veya SGLang'a neden yönlendirdiğini belirtin.
- GGUF'den güvenli sensörlere dönüşümünün aşamalar arasında yer aldığı yer de dahil olmak üzere dev/staging/prod borusunu açıklayın.
- "CPU-first" llama.cpp'e ve "AMD"'nin TRT-LLM'yi neden dışladığı açıklanmalı.

## Sorun

Ekibiniz yeni bir kendi kendine düzenlenen LLM projesine başlıyor. Bir mühendis Ollama, bir başkası vLLM, bir başkası "TGI sadece kutudan çıkmıyor mu?" diyor.

2026'da seçim ağacı önemlidir: donanım birinci, ölçek ikinci, iş yükü üçüncü. Ve 2025'te belirli bir olay  TGI 11 Aralık'ta bakım moduna girdi  yeni projeler için varsayılanı değiştirir.

## Anlaşım

### Beş motor

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### Hardware-first karar

**CPU-first**Ollama da çalışır ama daha yavaş. CPU'da diğer hiçbir motor rekabetçi değildir.

**AMD GPU**→ vLLM en güçlü desteklenen yol (AMD ROCm desteği). SGLang da çalışır. TRT-LLM NVIDIA kilitlenmiştir, bu yüzden dışarıdır.

**NVIDIA Hopper (H100 / H200)**→ VLLM veya SGLang veya TRT-LLM.

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM, geçiş lideridir (Fase 17 · 07). vLLM ve SGLang yakından takip eder.

**Apple Silicon (M-series)**Ollama bunu sarıyor.

### İkinci ölçekli karar

**1 user / local dev**Bir komut, saniyeler içinde ilk işaret.

**10-100 users / small team**→ VLLM tek GPU.

**100-10k users / production**→ vLLM üretim aşaması (Fase 17 · 18) veya SGLang.

**10k+ users / enterprise**→ vLLM üretim aşaması + ayrıştırılmış (Fase 17 · 17) + LMCache (Fase 17 · 18).

### İş yükü üçüncü karar

**General chat / Q&A**→ vLLM geniş default kazanır.

**Agentic multi-turn (tools, planning, memory)**→ SGLang'ın RadixAttention (Fase 17 · 06) baskın.

**RAG with heavy prefix reuse**→ SGLang.

**Code generation**→ vLLM iyi; SGLang biraz daha iyi bir önbelleğe.

**Long context (128K+)**→ vLLM + parçalı ön doldurma; SGLang + katlı KV.

### TGI bakım tuzağı

Hugging Face TGI bakım moduna girdi 11 Aralık 2025  sadece ileride hata düzeltmeleri. Tarihsel olarak: en üst düzey gözlemsellik, sınıfındaki en iyi HF ekosistem entegrasyonu (model kartlar, güvenlik araçları), ham üretimde vLLM'den biraz geride.

2026'da yeni projeler için: TGI'den default uzaklaştırılmalıdır. Mevcut TGI dağıtımları devam edebilir, ancak sonunda göç etmelidir. SGLang ve vLLM daha güvenli varsayımlardır.

### Boru hattı örneği

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). Motorlar farklı ağırlık formatlarını alır  GGUF için llama.cpp ailesi, HF safetensorları için GPU motorları  böylece bir format dönüşümü aşamalar arasında oturabilir. Mühendisler dizüstü bilgisayarlarda hızlı bir şekilde tekrarlar; aşama aynaları üretim kuantitasyonu; prod hizmet hedefi.

### Ollama uyarısı

Ollama dev için harika. Paylaşılan üretim için iyi değildir: Git HTTP serializasyonu üst ücreti ekler, eşzamanlı yönetim vLLM'den daha basit, OpenTelemetry destek gecikmeleridir. Paylaşılan için  bir kullanıcı, bir komut  ve vLLM'ye geçiş için  parlayan Ollama kullanın.

### Kendi kendine konutlanan ve yönetilen bir karar.

17 · 01 (managed hyperscalers), · 02 (inference platforms) kapsamı yönetildi. Bu ders zaten kendi kendine barındırmaya karar verdiğinizi varsayır.

### Hatırlamalısın numaralar

- TGI bakım modusu: 11 Aralık 2025.
- vLLM v0.15.1: Şubat 2026; PyTorch 2.10; Blackwell SM120 desteği.
- SGLang üretim izleri: 400.000+ GPU.
- Ollama geçiş boşluğu vs llama.cpp: 15-30% daha yavaş; 3x daha düşük yük.

```figure
data-parallel
```

## Kullan

`code/main.py`karar ağacı yürüyüşçüsüdür: donanım + ölçek + iş yükü verildiğinde, bir motor seçer ve nedenini açıklar.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-engine-picker.md`- Zorluklar karşısında bir motor seçer ve göç planını yazar.

## Egzersizler

1. Çık .`code/main.py`Çıktı output içgüdülerine uyuyor mu?
2. İnfra 12 H100 ve 8 MI300X AMD'dir.
3. Bir ekip 2026'da TGI'yi kullanmak istiyor çünkü "bildiklerimiz bu". Göçme davası hakkında tartışın.
4. Ollama dev to vLLM prod: Kvantisaj, yapılandırma ve gözlemlenebilirlik hangi değişiklikler?
5. RAG ürünleri, P99 önleme uzunluğu 8K ve kiracılarda yüksek yeniden kullanımı ile.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## Daha Fazla Okumak

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference)- Bildirme notları.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
