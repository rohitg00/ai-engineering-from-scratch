# Capstone 14  Speküel-Kodulama İnferans Serveri

> Spekülatör dekodlama  ucuz bir taslak token önerir, hedef model onları bir geçitle doğruluyor  şimdi bir araştırma hilesi değil, üretim hazır bir optimizasyon. EAGLE-3 vLLM 0.7 gemiler gerçek trafikte 2.5-3x geçiş gücü. P-EAGLE (AWS 2026) paralel spekülasyonları daha da ileriye sürdü. SGLang'ın SpecForge'i, büyük ölçekte askerlik başkanları eğitmiştir. Red Hat'ın Spekülatörler merkezi ortak açık modeller için düzeltilmiş taslaklar yayınladı. TensorRT-LLM NVIDIA'da birinci sınıf spekülatör kodlama yaptı. 2026 üretim servis kümesi, EAGLE-aile taslakları, FP8 veya INT4 kuantizasyonu ve sıra bekleyen HPA ile vLLM veya SGLang'dır. Bu son taş, 2,5x+ temel üretim oranında iki açık model hizmet vermektedir ve tam bir kuyruğu gecikme raporu ile birlikte.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## Sorun

Tahmin edici çözme 2026'da bir mal haline geldi. EAGLE-3 taslak başları hedef modelin gizli durumlarını eğitir ve N tokenlerini önüne tahmin eder; hedef model tek geçişle doğruluyor. 60-80% kabul oranları, 2-3 kat uçtan uç geçiş oranına dönüşür. vLLM 0.7 bunu doğuştan entegre ediyor. SGLang + SpecForge size eğitim hattını verir. Red Hat'ın Spekulyatörleri Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B için uyumlu taslaklar yayınlıyor.

Bu, birimlerin ve diğerlerinin karşılaştırma yapma işlemlerinin bir parçasıdır. Bu işlemler, birimlerin ve diğerlerinin karşılaştırma işlemlerinin bir parçasıdır.

## Anlam

Tahmin edici çözme iki katman vardır.**draft**model (EGLE-3 başı, ngram veya daha küçük hedef uyumlu model) adım başına k aday token önerir.**target**Model tüm k'leri bir geçitle doğruluyor; kabul edilen herhangi bir önbellek açgözlü yolu değiştirir. Kabul oranı taslak-hedef hizalanmasına ve giriş dağılımına bağlıdır.

EAGLE-3 çoğu trafikte ngram taslaklarını yener. P-EAGLE daha derin taslak ağaçları için paralel spekülasyonlar yürütür. Tasarruf: P99 reddedilme gecikmesi daha yüksek çünkü doğrulama geçişi daha büyüktür.

Kullanım Kubernetes. vLLM 0.7 GPU veya tensor paralel parçacık başına bir kopyasını çalışır. CPU yerine kuyruk bekleyen HPA otomatik ölçekleri. FP8 (Marlin) ve INT4 (AWQ) kuantumları H100 / H200 zarfında GPU belleğini tutar. Sonundan sonuna rapor verim, kabul oranı, p50 / p99 1/8/32 partide ve $ / 1M jetonlarıdır.

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

## Yüküm

- Hizmet: vLLM 0.7 veya SGLang 0.4
- Tahmin yöntemleri: EAGLE-3 çekim başları, P-EAGLE paralel tahmin, ngram geri dönüş
- Eğitim projesi: SpecForge (SGLang) veya Red Hat Spekülatörleri
- Hedef modelleri: Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- Kvantizasyon: FP8 (Marlin), INT4 AWQ
- Uygulama: Kubernetes + NVIDIA cihaz eklentisi; HPA kuyruk bekleme metrikinde
- Eval: ShareGPT, MT-Bench-v2, GSM8K, HumanEval alan yayılmış kabul ölçümleri için
- Referans: TensorRT-LLM bir satıcı tabanı için spekülatör kodlama

```figure
cf-spec-decode
```

## Yapın

1. **Target model prep.**Llama 3.3 70B'yi seçin. Marlin üzerinden FP8'e kadar kvantize edin. 1xH100'de vLLM 0.7 altında dağıtın (veya 2x tensor paralel).

2. **Draft source.**Red Hat Speculators'tan (veya SpecForge üzerinden) uyumlu bir EAGLE-3 taslak başlığını çek.

3. **Baseline numbers.**Tahmin edilmeden önce: 1/8/32 partide tokens/s, p50/p99 gecikme, GPU kullanımı.

4. **Enable EAGLE-3.**Flip yapılandırması; aynı referans değerini tekrar çalıştır. Rapor hızlandırması, kabul oranı, p99 kuyruk-kenak delta.

5. **P-EAGLE.**Paralel spekülasyonu etkinleştirin; derinlikteki çekim ağacını seri EAGLE-3 ile ölçün.

6. **Domain traffic.**ShareGPT vs HumanEval vs. domain-specific trafik aynı sunucu üzerinden çalıştırın.

7. **Second target model.**Aynı boru hattını Qwen3-Coder-30B MoE'de çalıştırın.

8. **K8s HPA.**HPA izleme ile K8 ' ler altında yerleştirilmek `queue_wait_ms`- Yük üç kat arttığında ölçeklendirme göster.

9. **Cost comparison.**Aynı değerlendirme ile $ 1M jetonları karşı karşıya kalın.

## Kullan

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## Gönder

`outputs/skill-inference-server.md`Spekülatörlü bir çözme, tam bir referans raporu ve K8s dağıtımıyla birlikte ölçülen servis yığınları.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## Egzersizler

1. Önemli olan, taslakın bir versiyonu hedefin arkasında olduğu zaman kabul oranının azalmasını ölçmek (örneğin Llama 3.3 -> 3.4 sürüşü).

2. Ngram geri dönüşü uygulanması: EAGLE-3 kabulü bir eylemi aşarsa, ngram taslaklarına geçin.

3. Kontrollü bir MoE deneyi çalıştırın: aynı Qwen3-Coder-30B, enjekte edilen ve dışındaki yönlendirme gürültüsü ile.

4. H200'e kadar uzatın (141 GB). Kazanılan model boyutunun replikası başına ve kvantize edilmemiş Llama 3.3 70B'ye hizmet verebilecek olup olmadığını bildirin.

5. Benchmark TensorRT-LLM spekülatör çözümü aynı H100 donanımında.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## Daha Fazla Okumak

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) Referans servis yığını
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) paralel spekülatör kodlama kağıdı + entegrasyon
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) Tasarım başı eğitim boru hattı
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) Düzeltme çekim merkezi
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) Satıcı alternatif
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) Ticari referans
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) Metod kağıdı
- [vLLM repository](https://github.com/vllm-project/vllm) Kod ve referans değerleri
