# Inference Metrikleri — TTFT, TPOT, ITL, Goodput, P99

> inference deployment'nin çalışıp çalışmadığına dört ölçüm karar verir. TTFT, önceden doldurma artı kuyruk artı ağdır. TPOT (eşdeğer ITL), token başına belleğe bağlı kod çözme maliyetidir. Uçtan uca gecikme, TTFT artı TPOT çarpı çıkış uzunluğudur. Verim, filo genelinde toplanan saniye başına token'dir. Ancak ürün için önemli olan iyi girdidir; yani her SLO'yu aynı anda karşılayan isteklerin oranıdır. Düşük iyi çıktıda yüksek verim, kullanıcılara hiçbir zaman zamanında ulaşmayan token'leri işlediğiniz anlamına gelir. 2026 yılında TRT-LLM'de yayınlanan Llama-3.1-8B-Instruct için referans numaraları: ortalama TTFT 162 ms, ortalama TPOT 7,33 ms, ortalama E2E 1.093 ms. Her zaman P50, P90, P99'u bildirin; asla sadece kastetmeyin. Ve ölçüm tuzağına dikkat edin: GenAI-Perf, TTFT'yi ITL hesaplamasının dışında tutar, LLMPerf bunu içerir; iki araç aynı çalıştırma için TPOT konusunda anlaşamıyor.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak yüzdelik hesaplayıcı ve goodput raporlayıcı)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Parçalarına Hizmet Verme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- TTFT, TPOT, ITL, E2E, throughput ve goodput'u tam olarak tanımlayın ve her birinin ölçtüğü bileşeni adlandırın.
- Yüksek Lisans sunumu için ortalamanın neden yanlış istatistik olduğunu ve P50/P90/P99'un nasıl okunacağını açıklayın.
- Bir SLO çoklu kısıtlaması oluşturun (e.g. TTFT<500 ms VE TPOT<15 ms VE E2E<2 s) ve buna göre iyi çıktıyı hesaplayın.
- Aynı çalıştırma için TPOT konusunda aynı fikirde olmayan iki benchmark aracını adlandırın ve nedenini açıklayın.

## Sorun

"Verimimiz saniyede 15.000 token." Ne olmuş? İsteklerin %40'ı uçtan uca 2 saniyeyi geçerse kullanıcılar oturumu terk etti. Verim tek başına size ürünün çalışıp çalışmadığını söylemez.

Inference'nin birden fazla gecikme ekseni vardır ve her biri farklı şekilde başarısız olur. Önceden doldurma, hesaplamaya bağlıdır ve prompt uzunluğuyla ölçeklenir. Kod çözme belleğe bağlıdır ve toplu iş boyutuna göre ölçeklenir. Kuyruk gecikmesi operasyonel bir sorundur. Ağ bir fiziksel mesafe sorunudur. Her biri için ayrı metriklere, yüzdelik dilimlere ve "kullanıcı beklediğini aldı mı" diyen tek bir bileşiğe ihtiyacınız var; bu iyi bir sonuçtur.

## Konsept

### TTFT — ilkine kadar geçen süre token

`TTFT = queue_time + network_request + prefill_time`

prompt'ler uzun olduğunda önceden doldurma hakimdir. H100'deki Llama-3.3-70B FP8'de, 32k prompt ~800 ms saf ön doldurma alır. Kuyruk süresi, yük altındaki zamanlayıcı davranışıdır. Ağ isteği TLS dahil kablolama süresidir. TTFT, herhangi bir şeyin geri akışından önce kullanıcının gördüğü gecikmedir.

### TPOT / ITL — token arası gecikme

Bir miktar için birçok isim. `TPOT` (çıkış başına süre token), `ITL` (token arası gecikme), `decode latency per token` — hepsi aynı. İlkinden sonra ardışık olarak yayınlanan token'ler arasındaki süredir.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

Parçalı önceden doldurmalı aynı Llama-3.3-70B H100 yığınında, TPOT ~7 ms anlamına gelir. Parçalı ön doldurma olmadan, komşu dizideki uzun bir ön dolum sırasında TPOT 50 ms'ye çıkabilir. P99'u izleyin, fena değil.

### E2E gecikmesi

`E2E = TTFT + TPOT * output_tokens + network_response`

Uzun çıkışlar için (>500 token), E2E TPOT ağırlıklıdır. Uzun prompt'lere sahip kısa çıkışlar için E2E, TTFT ağırlıklıdır. Çıktı uzunluğu koşullu E2E'yi rapor edin.

### Verim

`throughput = total_output_tokens / elapsed_time`

Toplam metrik. Filo verimliliğini anlatır. Size bireysel sağlık isteğini söylemez.

### Goodput — gerçekten önemsediğiniz ölçüm

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO bir çoklu kısıtlamadır. Bir istek ancak her kısıtlamanın yerine getirilmesi durumunda "iyidir". İyi girdi, paylaşımdır. %60 iyi çıktıda yüksek verim başarısızlıktır. Hedef, %99 iyi çıktıda daha düşük verimdir.

2026'da goodput, MLPerf Inference v6.0 gönderimlerinde ve AI platform sağlayıcılarında dahili SLA takibinde kullanılan metriktir.

### Demek istediğim neden yanlış istatistik?

LLM gecikme dağılımları sağa çarpıktır. Uzun önceden doldurulmuş bir komşuya sahip bir kod çözme grubu, TPOT ~7 ms ile 500 token ve TPOT ~60 ms ile 20 token gönderebilir. Ortalama TPOT 9 ms'dir. P99 TPOT 65 ms'dir. Kullanıcılar düzenli olarak P99'a giriyor; bu yüzden ayrılıyorlar.

Daima üçlüyü (P50, P90, P99) bildirin. Kullanıcı deneyimi için optimize ettiğiniz P99'dur.

### Referans numaraları — Llama-3.1-8B-TRT-LLM Talimatı, 2026

- ortalama TTFT: 162 ms
- ortalama TPOT: 7,33 ms
- ortalama E2E: 1.093 ms
- P99 TPOT: parçalı önceden doldurma yapılandırmasına bağlı olarak 10-25 ms değişir.

Bunlar yayınlanan NVIDIA referans noktalarıdır. Model boyutuna (70B 3-5x gösterir), donanıma (H100 vs B200 ~3x) ve yüke göre değişirler.

### Ölçüm tuzağı

En çok kullanılan 2026 benchmark araçlarından ikisi, aynı çalıştırma için TPOT konusunda hemfikir değil:

- **NVIDIA GenAI-Perf**: TTFT'yi ITL hesaplamasına dahil etmez. ITL token 2'den başlar.
- **LLMPerf**: TTFT'yi içerir. ITL token 1'den başlar.

TTFT 500 ms ve toplam 700 ms kod çözmede 100 çıkış token içeren bir istek için GenAI-Perf, `ITL = 700/99 = 7.07 ms`'yi, LLPerf ise `ITL = 1200/100 = 12.00 ms`'yi bildirir. Takım seçimi sayıyı değiştirir.

Her zaman hangi aletin olduğunu belirtin. Her zaman tanımı yayınlayın.

### Bir SLO oluşturma

2026'da 70B sohbet modeli için tüketiciye yönelik makul bir SLO:

- TTFT P99 <= 800 ms.
- TPOT P99 <= 25 ms.
- E2E P99 <= 3 s, <300-token çıkışları için.
- İyi girdi hedefi >= %99.

Kurumsal SLO'lar TTFT'yi (200-400 ms) sıkılaştırır ve E2E'yi gevşetir. Önemli olan bunları yazmak, üçünü de ölçmek ve iyi çıktıyı tek bir bileşik olarak takip etmektir.

### Nasıl ölçülür

- Gerçek trafik veya gerçekçi sentetik çalıştırın (`--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150` ile LLMPerf).
- benchmark çalıştırması için 2 kat en yüksek eşzamanlılığı hedefleyin.
- 30-50 yineleme çalıştırın, birleştirilmiş numunenin yüzdelik dilimlerini alın.
- Araç adı, araç sürümü, model, donanım, eşzamanlılık, prompt dağıtımı ile yayınlayın.

```figure
throughput-latency
```

## Kullan onu

`code/main.py` oyuncak iyi bir hesaplayıcıdır. Sentetik bir gecikme dağılımı oluşturun, bir SLO uygulayın ve iyi çıktıyı hesaplayın. Ayrıca aynı iz üzerinde GenAI-Perf ve LLMPerf TPOT farkını da gösterir.

## Gönderin

Bu ders `outputs/skill-slo-goodput-gate.md`'yi üretir. Bir iş yükü ve SLO göz önüne alındığında, kapıların aktarım hızı yerine iyi çıktıya göre dağıtıldığı CI/CD'ye hazır bir benchmark tarifi üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. %1 kuyruk sivri uçlu bir dağılım oluşturun. P99 TPOT'u 30 ms'den 15 ms'ye sıktığınızda iyi çıktı nasıl değişir?
2. Bir satıcı "Llama 3.3 70B H100'de 15.000 tok/s"den alıntı yapıyor. Ona güvenmeden önce sorulacak üç soruyu belirtin.
3. Parçalı ön dolum neden P99 TPOT'u koruyor ancak TPOT anlamına gelmiyor?
4. Sesli asistan için bir tüketici SLO'su oluşturun (önce token duyulur, okunmaz). Kullanıcıların en çok görebildiği metrik hangisidir?
5. LLMPerf README ve GenAI-Perf belgelerini okuyun. Araçların aynı fikirde olmadığı diğer üç ölçümü belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| TTFT | "ilk token'ye ulaşma zamanı" | Kuyruk + ağ + önceden doldurma; uzun prompt'lerde ön dolumun hakimiyeti altında |
| TPOT | "çıkış başına süre token" | İlkinden sonra token başına belleğe bağlı kod çözme maliyeti |
| ITL | "token arası gecikme" | Çoğu araçtaki TPOT ile aynıdır (hepsi değil — bkz. GenAI-Perf) |
| E2E | "uçtan uca" | TTFT + TPOT * çıktı_len; yanıt tarafı ağı üstte |
| Verim | "tok/s" | Filo verimliliği; gecikme yüzdelikleri olmadan işe yaramaz |
| İyi girdi | "SLO-met oranı" | Her SLO kısıtlamasını aynı anda karşılayan isteklerin oranı |
| P99 | "kuyruk" | 100'de 1 en kötü durumda gecikme; kullanıcı deneyimi metriği |
| SLO çoklu kısıtlaması | "eklem" | VE her üç gecikme sınırından; herhangi biri ihlal edilirse istek başarısız olur |
| GenAI-Perf ve LLMPerf | "alet tuzağı" | Araçlar, ITL'nin TTFT'yi içerip içermediği konusunda anlaşamıyor |

## Daha Fazla Okuma

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) — TTFT, ITL, TPOT'un standart tanımı.
- [Her Ölçek — LLM Hizmet Benchmarking Metrikleri](https://docs.anyscale.com/llm/serving/benchmarking/metrics) — alternatif tanımlar ve ölçüm tarifi.
- [BentoML — LLM Inference Metrikleri](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) — gerçek deployment'ler üzerinde uygulamalı ölçüm.
- [LLMPerf](https://github.com/ray-project/llmperf) — Ray tabanlı açık kaynak benchmark.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) — NVIDIA'nın benchmark aracı.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — sektörde kabul edilen iyi girdi tabanlı benchmark.
