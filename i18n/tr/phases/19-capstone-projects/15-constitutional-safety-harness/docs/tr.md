# Capstone 15  Anayasa Güvenlik Harness + Red-Team Range

> Anthropic'in Anayasa sınıflandırıcıları, Meta'nın Llama Guard 4, Google'ın ShieldGemma-2, NVIDIA'nın Nemotron 3 İçerik Güvenliği ve çok dilli kapsamlılık için X-Guard 2026 güvenlik sınıflandırıcı yığını tanımladı. Garak, PyRIT, NVIDIA Aegis ve promptfoo standart karşılaşma değerlendirme araçları haline geldi. NeMo Guardrails v0.12 onları bir üretim boru hattına bağlıyor. Bu baş taşı her şeyi bir araya getirir: hedef uygulamanın etrafında katmanlı bir güvenlik kemeri, 6'dan fazla saldırı ailesini yöneten özerk bir kırmızı ekip ajanı ve ölçülebilir bir zararsızlık delta üreten anayasal bir kendi eleştirisi çalışması.

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## Sorun

2026'da LLM güvenliğinin sınırı sınıflandırıcıların çalışıp çalışmadığı (kaykayla çalışıyorlar) değil, aşırı reddetmeden veya açık delikler bırakmadan bir üretim uygulaması etrafında doğru bir şekilde nasıl oluşturulacağıdır. Llama Gardiyası 4 İngiliz politika ihlallerini ele alıyor. X-Guard (132 dil) çok dilli jailbreak ile başa çıkıyor. ShieldGemma-2 görüntü tabanlı enjeksiyonu yakalar. NVIDIA Nemotron 3 İçerik Güvenliği, işletme kategorilerini kapsar. Anthropic'in Anayasa sınıflandırıcıları, hizmet yerine eğitim sırasında kullanılan ayrı bir yaklaşımdır.

Saldırı evrimi de önemlidir. PAIR ve TAP, hapis avı keşifini otomatikleştirir. GCG gradient tabanlı sufiks saldırıları yürütür. Çoklu dönüş ve kod anahtarı saldırıları ajan belleğini sömürür. Her dağıtılan LLM'ye kırmızı takım aralığı gerekir.

Hedef uygulamasını sertleştireceksiniz (eğer 8B talimatları uyarlanmış bir model veya diğer baş taşılardan RAG sohbetçilerinden biri), 6+ saldırı ailesini ona karşı çalıştırırsınız ve önce / sonra zararsızlık ölçümünü elde edersiniz.

## Anlam

Güvenlik boru hattı beş katmanlık.**Input sanitize**: sıfır genişlikli karakterleri çiz, base64/rot13 kodunu çöz, Unicode'u normalleştir. **Policy layer**: NeMo Guardrails v0.12 rayları (domain dışı, toksisite, PII çıkarımı). **Classifier gate**: Llama Guard 4 giriş, X-Guard İngilizce olmayan, ShieldGemma-2 görüntü girişleri. **Model**: hedef LLM. **Output filter**: Llama Guard 4 çıkış, Presidio PII scrub, istekli olarak istek uygulanması. **HITL tier**: yüksek riskli işaretlenmiş çıkışlar Slack sırasına geçiyor.

Kırmızı takım aralığı bir programcı üzerinde çalışır. PAIR ve TAP kendiliğinden jailbreaks keşfeder. GCG gradient tabanlı sufiks saldırıları yürütür. ASCII / base64 / rot13 kodlama saldırıları. Çok yönlü saldırılar (şehsiyeti benimsemek, bellek sömürü). Kod değiştirme saldırıları (İngilizce ile Swahili veya Taylandca karışık). Her bir çalışmada CVSS puanlaması ve açıklama zaman çizgisi ile yapılandırılmış bulgu dosyası üretilir.

Anayasa-kendini eleştirme koşulu bir eğitim-zaman müdahalesi. 1k zararlı deneme isteklerini alın, model bir yanıt taslakını yaptırın, yazılı bir anayasa karşı eleştirin (zarar verme kuralları) ve eleştirme döngüsünde yeniden eğitilsin.

## Mimarlık

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## Yüküm

- Güvenlik sınıflandırıcıları: Llama Guard 4, ShieldGemma-2, NVIDIA Nemotron 3 İçerik Güvenliği, X-Guard
- Gardail çerçeve: NeMo Guardrails v0.12 + OPA
- Kırmızı takım sürücüleri: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- Cezaevi aşama ajanları: PAIR (Chao et al., 2023), Tree-of-Attacks (TAP), GCG sufixi
- Anayasa eğitimi: Antropik tarzlı kendi eleştirisi döngüsü + eleştirilerde SFT
- - Presidio .
- Hedef: 8B talimatları ile ayarlanmış bir model veya diğer kap taşlarından birisinin RAG sohbetçilerinden biri

```figure
cf-safety-stack
```

## Yapın

1. **Target setup.**VLLM'de 8B talimat ayarlı bir model oluşturun (veya başka bir baş taşından bir RAG chatbot kullanın).

2. **Safety pipeline wrap.**Hedef etrafında beş katlı boru hattını telleştir. Her katmanın bireysel olarak gözlemlenebilir olduğunu kontrol edin (Langfuse'de katman başına uzantı).

3. **Classifier coverage.**Llama Guard 4, X-Guard (çok dilde), ShieldGemma-2 (resim) yükleyin.

4. **Red-team scheduler.**Program garak, PyRIT, bir PAIR ajanı, bir TAP ajanı, bir GCG koşucu, bir çok dönüş saldırganı ve bir kod değiştirme saldırganı.

5. **Attack suite.**Altı saldırı ailesi: (1) PAIR otomatik hapis cezası, (2) TAP saldırı ağacı, (3) GCG gradient sufixi, (4) ASCII / base64 / rot13 kodlama, (5) çok dönüşlü persona, (6) çok dilli kod anahtarı.

6. **Constitutional self-critique.**1k zararlı girişim isteklerini düzenleyin. Her biri için hedef bir cevap tasarlar. Bir eleştirmen LLM yazılı bir anayasa karşı puanlar ("zarar vermeyin", "delil alıntı, "yasadışı talepleri reddedin"). eleştirel nesnelerin yeniden yazıldığı istekler; hedef eleştirel geliştirilmiş çiftler üzerinde ince ayarlar.

7. **Over-refusal measurement.**İyi huylu bir sorgu süiti (örneğin XSTest) üzerinde yanlış pozitif oranı izleyin.

8. **CVSS scoring.**Her başarılı jailbreak için CVSS 4.0 (saldırı vektörü, karmaşıklık, etki) puanı alın.

9. **Range automation.**Yukarıdaki her şey bir cron üzerinde çalışır; bulgular bir kuyrukta yazılır; aşırı reddedilen geri dönüş uyarıları Slack'e ateş eder.

## Kullan

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## Gönder

`outputs/skill-safety-harness.md`üretim derecesindeki katmanlı güvenlik boru hattı ve tekrarlanabilir kırmızı takım aralığı, önce/sonra zararsızlık deltaları ile.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## Egzersizler

1. RAG chatbot'ta sürpriz enjeksiyon için garak eklentisini çalıştırın ve çıkış filtre katmanı ile ve olmadan saldırı başarısı oranını karşılaştırın.

2. Yedinci saldırı ailesini ekleyin: indirek bir şekilde alınan belgeler üzerinden enjeksiyon yapın.

3. "Yardımla reddet" modunu uygulayın: koruma rayı engellendiğinde, hedef düz bir reddetme yerine daha güvenli bir ilgili bir cevap sunar.

4. Çok dilli kapsam boşluğu: X-Guard'ın düşük performans gösterdiği bir dil bulun.

5. Anayasa kendinden eleştirisini 30B modelinde yapın ve delta ölçeğinin ölçülüp ölçeceğini ölçün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Layered safety | "Defense in depth" | Multiple guardrails at input, gate, output, HITL |
| Llama Guard 4 | "Meta's safety classifier" | The 2026 reference input/output content classifier |
| PAIR | "Jailbreak agent" | Paper (Chao et al.) on LLM-driven jailbreak discovery |
| TAP | "Tree-of-Attacks" | Tree-search variant of PAIR |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Benchmark for over-refusal regression |
| CVSS 4.0 | "Severity score" | Standard vulnerability scoring for safety findings |

## Daha Fazla Okumak

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) Eğitim zaman referansı
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) 2026 giriş/çıktı sınıflandırıcısı
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) görüntü + multimodal güvenlik
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) Kurumsal referans
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) 132 dilde çok dilli güvenlik
- [garak](https://github.com/NVIDIA/garak) NVIDIA kırmızı takım araç kümesi
- [PyRIT](https://github.com/Azure/PyRIT) Microsoft Red Team Framework
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Demiryolu çerçevesini
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) Cezaevi hapishanesi ajanı kağıdı
