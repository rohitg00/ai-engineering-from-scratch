# Bitirme Taşı 14 — Spekülatif Kod Çözme Inference Sunucusu

> Spekülatif kod çözme (ucuz bir taslak token'lar önerir, hedef model bunları tek geçişte doğrular) artık bir araştırma hilesi değil, üretime hazır bir optimizasyondur. vLLM 0.7'deki EAGLE-3, gerçek trafikte 2,5-3 kat verim sağlar. P-EAGLE (AWS 2026) paralel spekülasyonları daha da ileri götürdü. SGLang'ın SpecForge'u, taslak başkanlarını geniş ölçekte eğitti. Red Hat'in Spekülatörler merkezi, yaygın olarak kullanılan açık modeller için uyumlu taslaklar yayınladı. TensorRT-LLM, NVIDIA'da spekülatif kod çözmeyi birinci sınıf hale getirdi. 2026 üretim hizmet yığını, EAGLE ailesi taslakları, FP8 veya INT4 nicelemesi ve kuyruk beklemede HPA ile vLLM veya SGLang'dır. Bu kapak taşı, tam kuyruk gecikme raporuyla birlikte 2,5 kattan fazla temel verimde iki açık modele hizmet verecek.

**Tür:** Kapak taşı
**Diller:** Python (sunum), C++ / CUDA (çekirdek denetimi), YAML (yapılandırmalar)
**Önkoşullar:** Aşama 3 (deep learning), Aşama 7 (transformers), Aşama 10 (sıfırdan Yüksek Lisans), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P3 · P7 · P10 · P17
**Süre:** 30 saat

## Sorun

Spekülatif kod çözme 2026'da bir ürün haline geldi. EAGLE-3 taslak başkanları, hedef modelin gizli durumları üzerinde eğitim alır ve N token ilerisini tahmin eder; hedef model tek geçişte doğrulanır. %60-80'lik kabul oranları, uçtan uca 2-3 kat verim anlamına gelir. vLLM 0.7 bunu yerel olarak entegre eder. SGLang + SpecForge size eğitim hattını sunar. Red Hat's Speculators, Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B için uyumlu taslaklar yayınlıyor.

Zanaat hizmet operasyonlarındadır, modelde değil. Kabul oranı trafik dağılımına göre değişir (ShareGPT, kod ve alan adı verileri). Reddedilme durumunda kuyruk gecikmesi spekülasyon olmadan olduğundan daha kötüdür — p99'u yalnızca tokens/sn sabit durumda değil, birden fazla toplu boyutta raporlamanız gerekir. Antropik / OpenAI API'ye karşı 1 milyon tokens başına maliyet, güvenilirlik açısından önemli bir kaldıraçtır.

## Konsept

Spekülatif kod çözmenin iki katmanı vardır. Bir **taslak** model (EAGLE-3 kafa, ngram veya daha küçük hedefe hizalanmış model), adım başına k aday token önerir. **hedef** modeli tüm k'yi tek geçişte doğrular; kabul edilen herhangi bir önek açgözlü yolun yerini alır. Kabul oranı taslak hedef uyumuna ve girdi dağılımına bağlıdır.

EAGLE-3 çoğu trafikte ngram taslaklarını geride bırakıyor. P-EAGLE daha derin taslak ağaçlar için paralel spekülasyonlar yürütüyor. Takas: Doğrulama geçişi daha büyük olduğundan P99'un reddedilme gecikmesi daha yüksektir. Bunu ortaya çıkarmak için sunum yapılandırmasının toplu boyutta gruplandırılmış gecikmeyi raporlaması gerekir.

Deployment Kubernetes'tir. vLLM 0.7, GPU veya tensör paralel parça başına bir kopya çalıştırır. HPA, CPU yerine kuyrukta beklemeye göre otomatik ölçeklendirme yapar. FP8 (Marlin) ve INT4 (AWQ) nicemleri GPU belleğini H100 / H200 zarfının içinde tutar. Uçtan uca rapor, iş hacmi, kabul oranı, 1/8/32 partisinde p50/p99 ve $/1 milyon tokens şeklindedir.

## Mimarlık

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## Yığın

- Sunum: vLLM 0,7 veya SGLang 0,4
- Spekülatif yöntemler: EAGLE-3 taslak başlıkları, P-EAGLE paralel spekülasyon, ngram geri dönüşü
- Taslak eğitimi: SpecForge (SGLang) veya Red Hat Spekülatörleri
- Hedef modeller: Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- Niceleme: FP8 (Marlin), INT4 AWQ
- Deployment: Kubernetes + NVIDIA cihaz eklentisi; Kuyruk bekleme metriğinde HPA
- Eval: Alan yayılımı kabul ölçümü için ShareGPT, MT-Bench-v2, GSM8K, HumanEval
- Referans: Satıcı temel çizgisi için TensorRT-LLM spekülatif kod çözme

## Build It — Kendin Geliştir

1. **Hedef model hazırlığı** Llama 3.3 70B'yi seçin. Marlin aracılığıyla FP8'e nicemleyin. 1xH100'de (veya 2x tensör paralelinde) vLLM 0,7 altında konuşlandırın.

2. **Taslak kaynağı.** Red Hat Speculators'tan hizalanmış bir EAGLE-3 taslak kafasını çekin (veya SpecForge aracılığıyla bir tane eğitin). vLLM'nin spekülatif kod çözme yapılandırmasına yükleyin.

3. **Temel rakamlar.** Spekülasyondan önce: 1/8/32 toplu işinde tokens/s, p50/p99 gecikmesi, GPU kullanımı. Yayınla.

4. **EAGLE-3'ü etkinleştirin.** Yapılandırmayı çevirin; aynı benchmark'ı yeniden çalıştırın. Rapor hızlandırma, kabul oranı, p99 kuyruk gecikmesi deltası.

5. **P-EAGLE.** Paralel spekülasyonları etkinleştirin; seri EAGLE-3'e kıyasla daha derin taslak ağacını ölçün. P-EAGLE'ın yardım ettiği ve acıttığı noktayı bildirin.

6. **Alan trafiği.** ShareGPT, HumanEval ve alana özel trafiği aynı sunucu üzerinden çalıştırın. Dağıtım başına kabul oranını ölçün. Taslakların ne zaman sürüklendiğini belirleyin.

7. **İkinci hedef modeli.** Aynı hattı Qwen3-Coder-30B MoE'de çalıştırın. Taslak daha yanıltıcıdır (MEB yönlendirme gürültüsü). Rapor.

8. **K8'lerin HPA'sı.** HPA takibi `queue_wait_ms` ile K8'lerin altında konuşlandırın. Yük üç katına çıktığında ölçeği genişletmeyi gösterin.

9. **Maliyet karşılaştırması.** Aynı değerlendirmede $/1 milyon tokens ile Anthropic Claude Sonnet 4.7 ve OpenAI GPT-5.4'ü karşılaştırın. Yayınla.

## Use It — Hazır Araçla Uygula

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## Ship It — Kullanıma Sun

`outputs/skill-inference-server.md` teslimatı açıklar. Spekülatif kod çözme, tam bir benchmark raporu ve bir K8s deployment ile ölçülen bir servis yığını.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Ölçülen hızlanma ve başlangıç ​​düzeyi | İki modelde aynı kalitede 2,5 kattan fazla verim |
| 20 | Gerçekçi trafikte kabul oranı | Dağıtım başına kabul oranı raporu |
| 20 | P99 kuyruk gecikme disiplini | spekülasyonlu ve spekülasyonsuz 1/8/32 partisinde p99 |
| 20 | İşlemler | K8'ler konuşlandırılıyor, HPA kuyrukta beklemede, sorunsuz kullanıma sunuluyor |
| 15 | Yazım ve metodoloji | Neyin değiştiğine ve neden değiştiğine dair net açıklama |
| **100** | | |

## Egzersizler

1. Taslak hedefin bir versiyon gerisinde olduğunda kabul oranındaki bozulmayı ölçün (e.g., Llama 3.3 -> 3.4 sapma). Bir izleme uyarısı oluşturun.

2. Ngram-geri dönüş uygulayın: EAGLE-3 kabulü bir eşiğin altına düşerse ngram taslaklarına geçin. Güvenilirlik iyileştirmesini bildirin.

3. Kontrollü bir MoE deneyi yapın: Yönlendirme gürültüsü enjekte edilmiş ve edilmemiş aynı Qwen3-Coder-30B. Taslak kabul hassasiyetini ölçün.

4. H200'e (141 GB) kadar genişletin. Kazanılan kopya başına model boyutu boşluk payını ve nicelenmemiş bir Llama 3.3 70B'ye hizmet edip edemeyeceğinizi bildirin.

5. Aynı H100 donanımında Benchmark TensorRT-LLM spekülatif kod çözme. vLLM'ye karşı nerede kazandığını bildirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Taslak model | "Spekülatör" | Hedefin doğrulanması için N token öneren küçük model |
| KARTAL-3 | "2026 taslak mimarisi" | Taslak başkanı hedefin gizli durumları konusunda eğitilmiştir; ~%75 kabul |
| P-Kartal | "Paralel spekülasyon" | Tek hedef geçişte doğrulanan taslak dal ağacı |
| Kabul oranı | "İsabet oranı" | Yeniden örnekleme yapılmadan kabul edilen taslak token'ların kesri |
| Kuantizasyon | "FP8 / INT4" | GPU belleğine daha fazla model sığdırmak için daha düşük hassasiyetli ağırlıklar |
| Sıra bekleme | "HPA metriği" | inference başlamadan önce bir isteğin bekleme kuyruğunda beklediği süre |
| Spekülatörlerin merkezi | "Hizalanmış taslaklar" | Yaygın açık modeller için EAGLE taslaklarının Red Hat Neural Magic merkezi |

## Daha Fazla Okuma

- [vLLM EAGLE ve P-EAGLE belgeleri](https://docs.vllm.ai) — referans sunma yığını
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — paralel spekülatif kod çözme makalesi + entegrasyon
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — taslak kafa eğitim hattı
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — hizalanmış taslak merkezi
- [TensorRT-LLM spekülatif kod çözme](https://nvidia.github.io/TensorRT-LLM/) — sağlayıcı alternatifi
- [Fireworks.ai sunum mimarisi](https://fireworks.ai/blog) — ticari referans
- [EAGLE-3 makalesi (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — yöntem makalesi
- [vLLM deposu](https://github.com/vllm-project/vllm) — kod ve benchmark'lar
