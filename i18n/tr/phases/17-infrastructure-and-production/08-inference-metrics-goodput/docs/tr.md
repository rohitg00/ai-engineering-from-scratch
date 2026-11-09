# İndirim Metrikleri  TTFT, TPOT, ITL, Goodput, P99

> Beş metrik bir sonuç dağıtımının işe yaramayacağını belirler. TTFT, ön doldurma artı sıra artı ağ. TPOT (sık sık ITL olarak bildirilir, ancak araçlar ITL'nin ilk token sayılmasından farklıdır) bir token için hafıza bağlı dekodlama maliyetidir. Son-son gecikme TTFT artı TPOT çarpı çıkış uzunluğu. Geçim, filonun her birinde toplanan saniyede tokenlerdir. Ama ürün için önemli olan şey, her SLO'yu aynı anda karşılayan isteklerin %2'si. Yüksek geçiş, düşük iyi çıkış demek oluyor ki kullanıcılara asla zamanında ulaşmayan tokenleri işletiyorsunuz. 2026 yılında Llama-3.1-8B-Instruct on TRT-LLM için referans numaraları: ortalama TTFT 162 ms, ortalama TPOT 7,33 ms, ortalama E2E 1,093 ms. Her zaman P50, P90, P99 'yi bildir. Ve ölçüm tuzağına dikkat edin: GenAI-Perf TTFT'yi ITL hesaplamasından çıkarır, LLMPerf onu içerir; aynı çalışmada TPOT hakkında iki araç anlaşmazlık yaşıyor.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- TTFT, TPOT, ITL, E2E, throughput ve goodput'u kesin olarak tanımlayın ve her bir ölçümün bileşeninin adını verin.
- LLM hizmetleri için neden ortalama yanlış istatistik olduğunu ve P50/P90/P99'u nasıl okuyacağını açıklayın.
- SLO çok kısıtlama oluşturun (örneğin TTFT < 500 ms ve TPOT < 15 ms ve E2E < 2 s) ve buna göre iyi değer hesaplayın.
- Aynı çalışmada TPOT konusunda anlaşmazlık çeken iki referans araçını isimlendirin ve nedenini açıklayın.

## Sorun

"Bizim geçiş kapasitemiz saniyede 15.000 token". Peki ne? Soruların %40'ı 2 saniyeden sonra uçtan uçuna uçtuysa kullanıcılar oturumu terk etti.

İndirim, çok sayıda gecikme eksine sahiptir ve her biri farklı şekilde başarısız olur. Ön doldurma hesaplama ile bağlı ve uzunlukla ölçülür. Dekod, hafıza ile bağlanmış ve seri boyutları ile ölçeği. Çekilme gecikmesi operasyonel bir sorun. Ağ fiziksel mesafe sorunu. Her biri için farklı ölçümlere ve yüzdelilere ihtiyacınız var ve "kullanıcı beklediğini aldı mı" diyen tek bir bileşik gerekiyor.

## Anlaşım

### TTFT  ilk token için zaman

`TTFT = queue_time + network_request + prefill_time`

Ön doldurucu, istekler uzun olduğunda baskın olur. Llama-3.3-70B FP8'de H100'de, 32k istekler ~ 800 ms saf ön doldurucu süresi alır. Sır zamanı yük altında programcı davranışıdır. Ağ istekleri TLS dahil bir tel süresi. TTFT, herhangi bir şey geri akışmadan önce kullanıcı tarafından görülen gecikme süresi.

### TPOT / ITL  tokenler arası gecikme

Bir miktar için birçok isim.`TPOT`(output token başına zaman), `ITL`(tokenler arası gecikme),`decode latency per token` her şey aynı. İlkden sonra ardıcıl akışlı jetonlar arasındaki zaman.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

Aynı Llama-3.3-70B H100 yığınında parçalanmış ön doldurma ile TPOT ortalaması ~ 7 ms. parçalanmış ön doldurma olmadan, komşu bir dizide uzun bir ön doldurma sırasında TPOT 50 ms'e kadar artabilir. P99'u izleyin, ortalama değil.

### E2E gecikmesi

`E2E = TTFT + TPOT * output_tokens + network_response`

Uzun çıkışlar (> 500 token) için E2E TPOT-dominated. Uzun isteklerle kısa çıkışlar için E2E TTFT-dominated.

### Çıktıranlık

`throughput = total_output_tokens / elapsed_time`

Toplam metrik, filo verimliliğini anlatır, bireysel talep sağlığını anlatmaz.

### İyi performans  gerçekten önemsediğin metrik

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO bir çok kısıtlama. Bir istek sadece her kısıtlama yerine getirildiğinde "iyi" olur. Goodput payıdır. Bazı kağıtlar ve tablolar bunun yerine goodput oranını bildirir: her SLO'ya uyan saniyede istekler. Kaldırmak için payı istek oranıyla çarpıtın. Yüksek throughput %60 goodput başarısızlık demektir. Düşük throughput %99 goodput hedeftir.

2026 yılında, goodput, MLPerf Inference v6.0 gönderilerinde ve AI platform sağlayıcılarında SLA iç takipinde kullanılan ölçümdür.

### Neden yanlış bir istatistik kötüdür?

LLM gecikme dağıtımları sağ taraftan eğiliyor. Bir uzun önceden doldurulan komşu ile bir dekodlama partisi TPOT ~ 7 ms ile 500 token ve TPOT ~ 60 ms ile 20 token gönderebilir. Ortalama TPOT 9 ms. P99 TPOT 65 ms. Kullanıcılar düzenli olarak P99'a çarpıyor  bu yüzden ayrılıyorlar.

Her zaman üçlüyi bildirin (P50, P90, P99). Kullanıcı deneyimi için, P99 optimizasyon yapmanız gereken bir şeydir.

### Referans numaraları  Llama-3.1-8B-TRT-LLM'ye Örgüt, 2026

- Ortalama TTFT: 162 ms
- Ortalama TPOT: 7,33 ms
- E2E ortalaması: 1,093 ms
- P99 TPOT: parçalanmış prefill yapılandırmasına bağlı olarak 10-25 ms değişir.

Bunlar yayınlanan NVIDIA referans noktalarıdır. Model boyutu (70B 3-5x gösterir), donanım (H100 vs. B200 ~ 3x) ve yük ile değişir.

### Ölçüm tuzağı

En çok kullanılan 2026 referans araçlarından ikisi aynı çalışmada TPOT konusunda anlaşmazlık yaşıyor:

- **NVIDIA GenAI-Perf**ITL'nin başlangıcı 2. simge ile başlar.
- **LLMPerf**ITL, token 1'den başlar.

TTFT 500 ms ve 100 çıkış tokeni ile 700 ms toplam dekodla yapılan bir talebe göre GenAI-Perf raporları `ITL = 700/99 = 7.07 ms`LLMPerf raporları `ITL = 1200/100 = 12.00 ms`- Araç seçimi numarayı değiştirir.

Her zaman hangi aracı belirleyin ve tanımını yayınlayın.

### SLO'nun oluşturulması

2026 yılında 70B sohbet modeli için tüketiciye yönelik makul bir SLO:

- TTFT P99 <= 800 ms.
- TPOT P99 <= 25 ms.
- E2E P99 <= 3 s <300 token çıkışları için.
- İyi üretim hedefi >= 99%.

Enterprise SLOs TTFT (200-400 ms) sıkıştırır ve E2E'yi gevşetir.

### Ölçüm nasıl

- Gerçek trafik veya gerçekçi sentetik (LLMPerf ile `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`)
- Referans değerleri için 2x eşzamanlılık hedefi.
- 30-50 tekrar çalıştırın, birleşik numuneden yüzdelik alın.
- Araç adı, araç sürümü, modeli, donanım, eşzamanlılık, hızlı dağıtım ile yayınlayın.

```figure
throughput-latency
```

## Kullan

`code/main.py`Bu, bir oyuncak iyilik hesaplayıcıdır. Sintez bir gecikme dağılımını oluşturun, SLO uygulayın ve iyilik hesaplayın. Aynı iz üzerinde GenAI-Perf vs LLMPerf TPOT farkını da gösterir.

- Evet .[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)bir decode adımı, en az 54,7 ms'i 300 GB/s'de alırken ölçülen adımı 60,16 ms'i alır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-slo-goodput-gate.md`. İş yükü ve SLO'yu göz önüne alarak, kapıların geçiş yerine iyi verim üzerinde kullanıldığı bir CI/CD hazır bir referans tarifi üretir.

## Egzersizler

1. Çık .`code/main.py`P99 TPOT'i 30 ms'den 15 ms'e sıkıştırdığınızda goodput nasıl değişir?
2. Bir satıcı "Llama 3.3 70B H100'de 15.000 tok/s" diye alıntı yapıyor.
3. Parça dolgu neden P99 TPOT'i korur ama TPOT'i kastetmez?
4. Ses asistanı için bir tüketici SLO oluşturun (ilk token okunmaz, duyulur). Hangi metrik en çok kullanıcı tarafından görünür?
5. LLMPerf README ve GenAI-Perf belgelerini okuyun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## Daha Fazla Okumak

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) TTFT, ITL, TPOT'nin kanonik tanımı.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) alternatif tanımlar ve ölçüm tarifi.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) Gerçek yerleşimlerde uygulanan ölçüm.
- [LLMPerf](https://github.com/ray-project/llmperf) Ray tabanlı açık kaynak referans.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) NVIDIA'nın referans araçları.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) endüstri tarafından kabul edilen, iyilik tabanlı bir referans değeridir.
