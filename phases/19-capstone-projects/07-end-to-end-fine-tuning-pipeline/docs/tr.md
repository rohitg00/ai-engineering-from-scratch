# Bitirme Taşı 07 — Uçtan Uca Fine-Tuning Boru Hattı (Sunmak üzere SFT'den DPO'ya Veriler)

> Kendi verileriniz üzerinde eğitilen, kendi tercihlerinize göre DPO ile uyumlu hale getirilen, niceliklendirilmiş, spekülatif kodu çözülmüş ve ölçülebilir $/1 milyon tokens hızında sunulan bir 8B modeli. 2026 açık yığını Axolotl v0.8, TRL 0,15, yineleme için Unsloth, niceleme için GPTQ/AWQ/GGUF, sunum için EAGLE-3 ile vLLM 0,7'dir. Sonuç olarak tüm işlem hattını tekrarlanabilir bir şekilde çalıştırmak (YAML içeri, uç nokta dışarı servis) ve 2026 Model Açıklığı Framework altında bir model kartı yayınlamaktır.

**Tür:** Kapak taşı
**Diller:** Python (boru hattı), YAML (yapılandırmalar), Bash (komut dosyaları)
**Önkoşullar:** Aşama 2 (ML), Aşama 3 (DL), Aşama 7 (transformers), Aşama 10 (sıfırdan Yüksek Lisans), Aşama 11 (LLM mühendisliği), Aşama 17 (altyapı), Aşama 18 (güvenlik)
**Uygulanan aşamalar:** P2 · P3 · P7 · P10 · P11 · P17 · P18
**Süre:** 35 saat

## Sorun

2026'daki her ciddi yapay zeka ekibi bir fine-tuning hattını hazır bulunduruyor. Sınır temelli bir model sundukları için değil, aşağı yönlü adaptasyon (alan adı SFT, etiketli tercihlere karşı DPO, spekülatif kod çözme için damıtılmış taslaklar, EAGLE-3 ile hizmet verme) ölçülebilir olanın canlı olarak kazanıldığı yerdir. Axolotl v0.8 çoklu GPU SFT yapılandırmalarını yönetir. TRL 0,15, DPO ve GRPO'yu yönetir. Unsloth size hızlı tek GPU yinelemesi sağlar. EAGLE-3'lü vLLM 0.7, kalite kaybı olmadan kod çözme verimini 2-3 kat artırır. Alet işleri; zanaat YAML'lerde, veri hijyeninde ve değerlendirme disiplinindedir.

Bir 8B tabanını (Llama 3.3, Qwen3 veya Gemma 3) SFT ve ardından DPO aracılığıyla göreve özgü veriler üzerinde çalıştıracak, sunum için niceleme yapacak ve lm-evaluation-harness, RewardBench-2, MT-Bench-v2 ve MMLU-Pro'ya göre kazanımları ölçeceksiniz. 2026 Model Açıklığı Framework kapsamında bir model kartı üreteceksiniz. Önemli olan tekrarlanabilirliktir; tek bir komut tüm boru hattını uçtan uca yeniden çalıştırır.

## Konsept

Boru hattının beş aşaması var. **Veri**: tekilleştirme (MinHash / Datatrove), kalite filtresi (Nemotron-CC tarzı sınıflandırıcı), PII temizleme, genel benchmark kontaminasyonuna karşı bölünmüş hijyen kontrolü. **SFT**: Axolotl YAML, 8xH100'de ZeRO-3, kosinüs programı, paketlenmiş diziler, 2-3 dönem. **DPO veya GRPO**: TRL yapılandırması, 1 dönem, insan etiketli veya model değerlendirmeli tercih çiftleri, beta ayarlama. **Niceleştirme**: deployment esnekliği için GPTQ + AWQ + GGUF. **Servis**: EAGLE-3 spekülatif kafalarıyla vLLM 0,7 (veya SpecForge ile SGLang), K8s deployment, kuyruk beklemede HPA.

Ablasyonlar teslim edilebilir şeylerdir: göreve özgü üç benchmark'de yalnızca SFT, SFT+DPO ve SFT+GRPO. Sunum metrikleri: 1 / 8 / 32. grupta tokens/s, EAGLE-3 kabul oranı, $/1 milyon tokens. Güvenlik değerlendirmesi: Llama Guard 4 geçiş oranı. Model kartı: önyargı değerlendirmeleri, tekrarlanabilirlik tohumları, veri lisanslaması.

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

## Yığın

- Veri: Tekilleştirme için Datatrove, kalite için Nemotron-CC sınıflandırıcı, PII için Presidio
- Temel: Llama 3.3 8B, Qwen3 14B veya Gemma 3 12B
- SFT: Axolotl v0.8 ile ZeRO-3, Flash Attention 3, paketlenmiş diziler
- Tercih ayarlaması: DPO veya GRPO için 0,15 TRL; Tek GPU yinelemesi için sloth'u açın
- Niceleme: llama.cpp aracılığıyla GPTQ (Marlin), AWQ, GGUF
- Sunum: EAGLE-3 spekülatif kod çözme ile vLLM 0.7 (veya SGLang 0.4 + SpecForge)
- Değerlendirme: lm-değerlendirme-koşum takımı, RewardBench-2, MT-Bench-v2, MMLU-Pro
- Güvenlik değerlendirmesi: Llama Guard 4, ShieldGemma-2
- Altyapı: Kubernetes + NVIDIA cihaz eklentisi, kuyruk bekleme ölçümünde HPA
- Observability: Eğitim için W&B, inference için Langfuse

## Build It — Kendin Geliştir

1. **Veri ardışık düzeni.** Ham veri kümesinde Datatrove tekilleştirmeyi çalıştırın. Nemotron-CC tarzı kalite sınıflandırıcıyı uygulayın. Presidio PII'yi temizliyor. Açık tohumla tren/val bölünmelerini yazın.

2. **Kirlenme kontrolü.** Her doğrulama bölümü için MinHash'ı MMLU-Pro, MT-Bench-v2, RewardBench-2 test setlerine göre hesaplayın. Herhangi bir örtüşmeyi reddedin.

3. **Axolotl SFT.** ZeRO-3, FA3, sekans paketlemeli YAML. 8xH100'de 2-3 dönem. W&B'de oturum açın.

4. **TRL DPO / GRPO.** SFT kontrol noktasını alın, tercih çiftleri (veya matematik/kod konusunda doğrulanabilir bir ödülle GRPO) üzerinde bir DPO dönemi çalıştırın. Süpürme betası.

5. **Kuantizasyon.** Üç nicelik üretin: llama.cpp için GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M. Kayıt boyutu ve nominal verim.

6. **Spekülatif kod çözme ile servis yapın.** Red Hat Spekülatörleri aracılığıyla eğitilmiş EAGLE-3 taslak kafalarıyla vLLM 0.7 yapılandırması. 1 / 8 / 32. gruptaki kabul oranını ve kuyruk gecikmesini ölçün. Aynı değerlendirmede $/1M tokens ile Anthropic / OpenAI'yi karşılaştırın.

7. **Değerlendirme matrisi.** Temelde lm-eval-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro, yalnızca SFT, SFT+DPO, SFT+GRPO'yu çalıştırın. Bir masa üretin.

8. **Güvenlik değerlendirmesi** Geliştirici setindeki Llama Guard 4 geçiş oranı. ShieldGemma-2 çıkış filtresi.

9. **Model kartı.** MOF 2026 şablonu: veri, eğitim, değerlendirme, güvenlik, lisans, YAML'ler ve taahhüt SHA'ları içeren tekrarlanabilirlik bölümü.

## Use It — Hazır Araçla Uygula

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

## Ship It — Kullanıma Sun

`outputs/skill-finetuning-pipeline.md` teslimatı açıklar. Tek bir komut, verileri SFT'den DPO'ya, quant'tan hizmete ve değerlendirmeye kadar çalıştırır ve bir model kartı + hizmet verilen uç noktayı yayar.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Delta ve tabana karşı değerlendirme | Hedef görevlerde ölçülen kazanç (MMLU-Pro, MT-Bench-v2, göreve özel) |
| 20 | Boru hattı tekrarlanabilirliği | Bir komut, aynı tohumlarla uçtan uca yeniden çalıştırır |
| 20 | Veri hijyeni | Tekilleştirme oranı, PII temizleme kapsamı, kontaminasyon kontrolü yeşil |
| 20 | Hizmet verimliliği | tokens/s, bs=1/8/32, EAGLE-3 kabul oranı, $/1 milyon tokens |
| 15 | Model kartı + güvenlik değerlendirmesi | 2026 MOF bütünlüğü + Llama Guard 4 geçiş oranı |
| **100** | | |

## Egzersizler

1. Aynı göreve özgü benchmark üzerinde yalnızca SFT'yi, SFT+DPO'yu ve SFT+GRPO'yu çalıştırın. Hangi tercih yönteminin ne kadar kazandığını bildirin.

2. Llama 3.3 8B'yi Qwen3 14B ile değiştirin. $/1 milyon token'ları eşleşen kalitede ölçün.

3. Alan adı verileri ile genel ShareGPT arasındaki EAGLE-3 kabul oranını ölçün. Deltayı ve bunun gecikme bütçeleri için ne anlama geldiğini bildirin.

4. Kontaminasyonun %1'ini enjekte edin (MMLU-Pro yanıtlarını eğitim verilerine sızdırın) ve değerlendirmeyi yeniden çalıştırın. MMLU-Pro'nun doğruluk sıçramasını gerçekçi olmayan bir şekilde izleyin. Bunu yakalayan bir kontaminasyon kontrolü CI kapısı oluşturun.

5. Tam ince ayara alternatif olarak LoRA SFT'yi ekleyin. Kalite açığını 10 kat daha düşük bellekte ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Aksolotl | "SFT eğitmeni" | SFT, DPO ve damıtma için YAML odaklı birleşik eğitici |
| TL | "Tercih ayarlayıcı" | LLM'lerde DPO, GRPO, PPO için Hugging Face kitaplığı |
| GRPO | "Gruba göre politika optimizasyonu" | DeepSeek R1'in doğrulanabilir ödülleri olan RL tarifi |
| KARTAL-3 | "Spekülatif kod çözme taslağı" | N token ileriyi tahmin eden taslak başlıkları; vLLM hedef modelle doğrulanıyor |
| Maliye Bakanlığı | "Model Açıklığı Framework" | Model yayınlarının veri, kod ve lisansa göre derecelendirilmesine yönelik 2026 standardı |
| Kirlilik kontrolü | "Bölünmüş hijyen" | Test seti sızıntısının eğitime MinHash tabanlı tespiti |
| Kabul oranı | "EAGLE / MTP metriği" | Hedef modelin kabul ettiği taslak token'ların oranı |

## Daha Fazla Okuma

- [Axolotl belgeleri](https://axolotl-ai-cloud.github.io/axolotl/) — referans SFT / DPO eğitmeni
- [TRL belgeleri](https://huggingface.co/docs/trl) — DPO ve GRPO referans uygulamaları
- [Unsloth](https://github.com/unslothai/unsloth) — tek GPU yineleme referansı
- [DeepSeek R1 makalesi (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — GRPO metodolojisi
- [vLLM + EAGLE-3 belgeleri](https://docs.vllm.ai) — referans sunma yığını
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — alternatif spekülatif kod çözme eğitmeni
- [Model Openness Framework 2026](https://isocpp.org/) — açık sürüm notlandırma standardı
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — kurallı değerlendirme koşucusu
