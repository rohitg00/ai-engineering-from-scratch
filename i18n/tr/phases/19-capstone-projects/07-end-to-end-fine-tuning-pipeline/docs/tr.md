# Capstone 07  Sonundan Sonuna Düzeltme Kök hattı (SFT'ye DPO'ya veri hizmet etmek için)

> Kendi verilerinizle eğitilmiş, kendi tercihlerinizle DPO-ağırlaştırılmış, kuantistik, spekülasyonsal olarak çözülmüş ve ölçülebilir $ / 1M tokenlerde servis edilmiş bir 8B sınıf modeli. 2026 açık yığın Axolotl v0.8, TRL 0.15, İterasyon için Unsloth, Kvantizasyon için GPTQ/AWQ/GGUF, servis için EAGLE-3 ile vLLM 0.7'dir. Son taş, tüm boru hattını tekrarlanabilir şekilde çalıştırmak (YAML içinde, servis sonu nokta dışında) ve 2026 Model Açıklık Çerçeği kapsamında bir model kart yayınlamak.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## Sorun

2026'da her ciddi AI ekibi ince ayarlama hattını tutar. Sınır baz modeli göndermek için değil, aşağı doğru uyarlama  alan SFT, DPO etiketlenmiş tercihler karşı, spekülasyonsal dekodlama için destillemiş taslaklar, EAGLE-3  ile hizmet vermek ölçülebilir kazançların yaşadığı yer. Axolotl v0.8 çoklu GPU SFT yapılandırmalarını işliyor. TRL 0.15 DPO ve GRPO'yu ele alıyor. Unsloth, hızlı bir tek GPU iterasyonu sağlar. EAGLE-3 ile vLLM 0.7 kalitesi kaybı olmadan 2-3x dekodleme throughput zorlar. Araçlama işliyor; meslek YAML'lerde, veri hijyeninde ve değerlendirme disiplindedir.

SFT üzerinden 8B ile 14B tabanı (Llama 3.1 8B, Qwen3 14B veya Gemma 3 12B) çalıştırır, sonra görev-özel veriler üzerine DPO çalıştırır, servisi için kuantitasyon yapar ve lm değerlendirme-harness, RewardBench-2, MT-Bench-v2 ve MMLU-Pro ile kazançları ölçer. 2026 Model Açıklık Çerçeği altında bir model kartı üreteceksiniz.

## Anlam

Boru hattı beş aşamaya sahiptir.**Data**: dedup (MinHash / Datatrove), kalite filtre (Nemotron-CC biçim sınıflandırıcısı), PII scrub, kamu standartı kirliliğine karşı ayrılmış hijyen kontrolü. **SFT**Axolotl YAML, ZeRO-3 8xH100, cosine programı, paketlenmiş diziler, 2-3 dönem. **DPO or GRPO**: TRL yapılandırması, 1 dönem, insan etiketi veya model değerlendirici tercih çiftleri, beta ayarlama. **Quantize**: GPTQ + AWQ + GGUF, yerleştirme esnekliği için. **Serve**: vLLM 0.7 EAGLE-3 spekülasyon başlı (veya SpecForge ile SGLang), K8'lerin dağıtımı, sıra bekleyen HPA.

Ablations teslim edilebilir: SFT-sadece vs SFT+DPO vs SFT+GRPO üç görev-spesifik referans üzerinde. Serving metrikleri: 1 / 8 / 32 partide tokens / s, EAGLE-3 kabul oranı, $/1M tokens. Güvenlik değerlendirme: Llama Guard 4 geçiş oranı. Model kart: tarafsız değerlendirme, yeniden üretilebilirlik tohumları, veri lisanslama.

## Mimarlık

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## Yüküm

- Veriler: Detup için veri kaynağı, Kalite için Nemotron-CC sınıflandırıcısı, PII için Presidio
- Üssü: Llama 3.1 8B, Qwen3 14B veya Gemma 3 12B
- SFT: ZeRO-3, Flash Attention 3, paketlenmiş dizilerle Axolotl v0.8
- Tercihleri ayarlama: DPO veya GRPO için TRL 0,15; tek GPU iterasyonu için Unsloth
- Kvantizasyon: GPTQ (Marlin), AWQ, GGUF via llama.cpp
- Hizmet: EAGLE-3 spekülasyonsal çözme ile vLLM 0.7 (veya SGLang 0.4 + SpecForge)
- Eval: lm-evaluation-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro
- Güvenlik değerlendirme: Llama Guard 4, ShieldGemma-2
- Altyapı: Kubernetes + NVIDIA cihaz eklentisi, sıra bekleme metrikinde HPA
- Gözlem: Eğitim için W&B, Tahmin için Langfuse

```figure
ce-finetune-stages
```

## Yapın

1. **Data pipeline.**Datatrove dedup'u çiğ corpus'a çalıştırın. Nemotron-CC tarzındaki kalite sınıflandırıcısını uygulayın. Presidio PII'yi temizler. Tren/val bölümü açık bir tohumla yazın.

2. **Contamination check.**Her onay bölümü için MinHash'ı MMLU-Pro, MT-Bench-v2, RewardBench-2 test setlerine karşı hesaplayın.

3. **Axolotl SFT.**ZeRO-3, FA3, diziler paketleme ile YAML. 8xH100'de 2-3 dönem.

4. **TRL DPO / GRPO.**SFT kontrol noktasını alın, öncelik çiftlerinde bir DPO dönemini çalıştırın (veya matematik/kod üzerinde doğrulanabilir bir ödül ile GRPO).

5. **Quantize.**Üç kuant üretin: GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M llama.cpp için. Kayıt boyutu ve nominal geçiş.

6. **Serve with speculative decoding.**vLLM 0.7'nin Red Hat Speculators üzerinden eğitilmiş EAGLE-3 taslak başlıkları ile yapılandırılması.

7. **Eval matrix.**Basında lm-eval-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro, SFT-only, SFT+DPO, SFT+GRPO çalıştırın.

8. **Safety eval.**Llama Guard 4 geçiş hızı dev seti ShieldGemma-2 çıkış filtre.

9. **Model card.**MOF 2026 şablonu: veriler, eğitim, değerlendirme, güvenlik, lisans, YAML'lerle yeniden üretilebilirlik bölümü ve görevli SHAs.

## Kullan

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## Gönder

`outputs/skill-finetuning-pipeline.md`SFT üzerinden DPO üzerinden Quant üzerinden eval üzerinden servis yoluyla verileri çalıştırır ve bir model kartı + servis edilen son noktayı gönderir.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## Egzersizler

1. Aynı görev-specifik referans değerinde SFT-sadece vs SFT+DPO vs SFT+GRPO çalıştırın. Hangi tercih yöntemi kazanıyor ve ne kadar kazanıyor rapor edin.

2. Llama 3.1 8B'yi Qwen3 14B'ye değiştir. $ 1M jetonlarını eşleşen kalitede ölç.

3. Alan verileri ile genel ShareGPT'de EAGLE-3 kabul oranını ölçün.

4. Kirlilik %1'ini enjekte et (MMLU-Pro'nun eğitim verilerine cevaplar sızdırın) ve değerlendirmeyi tekrar yapın. MMLU-Pro'nun doğruluğunu gerçekçi olmayan bir şekilde izleyin.

5. Tam ince ayarlama yerine LoRA SFT ekleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## Daha Fazla Okumak

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) referans SFT / DPO eğitmeni
- [TRL documentation](https://huggingface.co/docs/trl) DPO ve GRPO referans uygulamalar
- [Unsloth](https://github.com/unslothai/unsloth) Tek GPU iterasyon referansı
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) GRPO metodolojisi
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) Referans servis yığın
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) alternatif spekülatör kodlama eğitmeni
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): açık serbest bırakma sınıflandırma standardı
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) kanonik değerlendirme koşucusu
