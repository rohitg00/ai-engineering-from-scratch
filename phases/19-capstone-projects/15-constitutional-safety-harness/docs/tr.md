# Capstone 15 — Anayasal Emniyet Kemeri + Kırmızı Takım Menzili

> Anthropic'in Anayasal Sınıflandırıcıları, Meta'nın Llama Guard 4'ü, Google'ın ShieldGemma-2'si, NVIDIA'nın Nemotron 3 Content Safety'si ve çok dilli kapsama için X-Guard, 2026 güvenlik sınıflandırıcı yığınını tanımladı. garak, PyRIT, NVIDIA Aegis ve promptfoo standart rakip değerlendirme araçları haline geldi. NeMo Guardrails v0.12 bunları bir üretim hattına bağlar. Bu temel yapı taşı bunların hepsini bir araya getiriyor: bir hedef uygulamanın etrafında katmanlı bir emniyet kemeri, 6'dan fazla saldırı ailesini yöneten özerk bir kırmızı takım agent ve ölçülebilir bir zararsızlık deltası üreten anayasal bir özeleştiri çalışması.

**Tür:** Kapak taşı
**Diller:** Python (güvenlik hattı, kırmızı ekip), YAML (politika yapılandırmaları)
**Önkoşullar:** Aşama 10 (sıfırdan yüksek lisans), Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar), Aşama 14 (agent'lar), Aşama 18 (etik, güvenlik, uyum)
**Uygulanan aşamalar:** P10 · P11 · P13 · P14 · P18
**Süre:** 25 saat

## Sorun

2026'da Yüksek Lisans güvenliğinin sınırı, sınıflandırıcıların çalışıp çalışmadığı değil (kabaca öyledir), aşırı reddetmeden veya bariz boşluklar bırakmadan bunların bir üretim uygulaması etrafında doğru şekilde nasıl oluşturulacağıdır. Llama Guard 4, İngilizce politika ihlallerini ele alıyor. X-Guard (132 dil) çok dilli jailbreak işlemlerini gerçekleştirir. ShieldGemma-2, görüntü tabanlı prompt enjeksiyonunu yakalar. NVIDIA Nemotron 3 İçerik Güvenliği kurumsal kategorileri kapsar. Anthropic'in Yapısal Sınıflandırıcıları hizmet vermek yerine eğitim sırasında kullanılan ayrı bir yaklaşımdır.

Saldırı evrimi de önemlidir. PAIR ve TAP jailbreak keşfini otomatikleştirir. GCG, gradient tabanlı son ek saldırıları gerçekleştirir. Çoklu dönüş ve kod değiştirme saldırıları agent hafızasını kullanır. Konuşlandırılan herhangi bir LLM'nin bir kırmızı takım aralığına (garak ve PyRIT standart sürücülerdir) ve ayrıca belgelenmiş azaltımlara ve CVSS puanlı bulgulara ihtiyacı vardır.

Bir hedef uygulamayı (8B talimat ayarlı bir model veya diğer kapak taşlarından RAG sohbet robotlarından biri) güçlendirecek, ona karşı 6'dan fazla saldırı ailesi çalıştıracak ve bir öncesi/sonrası zararsızlık ölçümü üreteceksiniz.

## Konsept

Güvenlik boru hattı beş katmandan oluşur. **Giriş temizleme**: sıfır genişlikli karakterleri soyun, base64/rot13 kodunu çözün, Unicode'u normalleştirin. **Politika katmanı**: NeMo Guardrails v0.12 rayları (alan dışı, toksisite, PII çıkarma). **Sınıflandırıcı kapısı**: Girişte Llama Guard 4, İngilizce olmayan dillerde X-Guard, görüntü girişlerinde ShieldGemma-2. **Model**: hedef Yüksek Lisans. **Çıkış filtresi**: Çıkışta Llama Guard 4, Presidio PII temizleme, uygun olduğu yerde alıntı uygulaması. **HITL katmanı**: yüksek riskli olarak işaretlenen çıktılar bir Slack kuyruğuna gider.

Kırmızı takımın menzili bir programlayıcıya göre çalışır. PAIR ve TAP jailbreak'leri bağımsız olarak keşfeder. GCG, gradient tabanlı son ek saldırıları gerçekleştirir. ASCII/base64/rot13 kodlama saldırıları. Çok yönlü saldırılar (kişiliğin benimsenmesi, hafızanın kötüye kullanılması). Kod değiştirme saldırıları (İngilizceyi Svahili veya Tay diliyle karıştırın). Her çalıştırma, CVSS puanlama ve açıklama zaman çizelgesini içeren yapılandırılmış bir bulgular dosyası oluşturur.

Anayasal özeleştiri koşusu eğitim zamanında yapılan bir müdahaledir. 1k zararlı girişim prompt alın, modelin bir yanıt taslağı hazırlamasını sağlayın, yazılı bir anayasaya (zarar vermeme kuralları) göre eleştirisini yapın ve eleştiri döngüsü üzerinde yeniden eğitim alın. Uzatılmış bir değerlendirmede öncesi/sonrası zararsızlık deltasını ölçün.

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

## Yığın

- Güvenlik sınıflandırıcıları: Llama Guard 4, ShieldGemma-2, NVIDIA Nemotron 3 İçerik Güvenliği, X-Guard
- Korkuluk framework: NeMo Korkuluklar v0.12 + OPA
- Kırmızı takım sürücüleri: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- Jailbreak agent'lar: ÇİFT (Chao ve diğerleri, 2023), Saldırı Ağacı (TAP), GCG son eki
- Anayasal eğitim: Antropik tarzda özeleştiri döngüsü + eleştirilerde SFT
- PII temizliği: Presidio
- Hedef: 8B talimatlarına göre ayarlanmış bir model veya diğer temel taşlardan birinin RAG sohbet robotlarından biri

## Build It — Kendin Geliştir

1. **Hedef kurulumu.** vLLM'de 8B talimat ayarlı bir modeli ayağa kaldırın (veya başka bir kapak taşından bir RAG sohbet robotunu yeniden kullanın). Bu, test edilen uygulamadır.

2. **Güvenlik boru hattı sargısı.** Beş katmanlı boru hattını hedefin etrafına bağlayın. Her katmanın ayrı ayrı gözlemlenebilir olduğunu doğrulayın (Langfuse'da katman başına yayılma).

3. **Sınıflandırıcı kapsamı.** Llama Guard 4, X-Guard (çok dilli), ShieldGemma-2'yi (resim) yükleyin. Taban çizgilerini oluşturmak için her birini küçük etiketli bir sette çalıştırın.

4. **Kırmızı takım planlayıcı.** Garak, PyRIT, bir ÇİFT agent, bir TAP agent, bir GCG koşucusu, bir çok dönüşlü saldırgan ve bir kod değiştirme saldırganını programlayın. Her biri ayrı bir kuyrukta çalışır.

5. **Saldırı paketi.** Altı saldırı ailesi: (1) PAIR otomatik jailbreak, (2) TAP saldırı ağacı, (3) GCG gradient son eki, (4) ASCII / base64 / rot13 kodlama, (5) çok dönüşlü kişilik, (6) çok dilli kod anahtarı. Aile başına başarı oranını bildirin.

6. **Anayasal özeleştiri.** 1k zararlı girişim prompt'u iyileştirin. Her biri için hedef bir yanıt taslağı hazırlar. Bir yüksek lisans eleştirmeni yazılı bir anayasaya karşı puan veriyor ("zarar verme", "kanıt gösterme", "yasadışı talepleri reddetme"). Prompteleştirel nesnelerin yeniden yazıldığı yer; hedef, eleştirisi iyileştirilmiş çiftlere ince ayar yapar. Uzatılmış bir değerlendirmede zararsızlığın öncesi/sonrasını ölçün.

7. **Aşırı reddetme ölçümü.** Sorunsuz bir prompt paketinde (e.g., XSTest) yanlış pozitif oranını izleyin. Hedef, iyi huylu sorularda yardımcı kalmalıdır.

8. **CVSS puanlaması.** Her başarılı jailbreak için CVSS 4.0 (saldırı vektörü, karmaşıklık, etki) üzerinden puan alın. Bir açıklama zaman çizelgesi ve etki azaltma planı hazırlayın.

9. **Aralık otomasyonu.** Yukarıdaki her şey bir cron üzerinde çalışır; bulgular bir kuyruğa yazılır; aşırı reddetme regresyonu Slack'e ateş açılmasını uyarır.

## Use It — Hazır Araçla Uygula

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## Ship It — Kullanıma Sun

`outputs/skill-safety-harness.md` teslim edilebilirdir. Üretim düzeyinde katmanlı bir güvenlik hattı ve öncesi/sonrası zararsızlık deltalarına sahip tekrarlanabilir bir kırmızı takım serisi.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Saldırı yüzeyi kapsamı | 6'dan fazla saldırı ailesi uygulandı, 2'den fazla dil |
| 20 | Doğru-pozitif/yanlış-pozitif değiş tokuş | Saldırı engelleme oranı ve XSTest zararsız geçiş hızı |
| 20 | Özeleştiri Delta | Uzatılmış değerlendirmede zararsızlıktan önce/sonra |
| 20 | Belgeleme ve açıklama | Zaman çizelgesiyle birlikte CVSS puanlı bulgular |
| 15 | Otomasyon ve tekrarlanabilirlik | Her şey cron üzerinde uyarılarla çalışır |
| **100** | | |

## Egzersizler

1. Bir RAG sohbet robotunda garak'ın prompt-enjeksiyonu için eklentisini çalıştırın ve çıkış filtresi katmanı varken ve yokken saldırı başarı oranını karşılaştırın.

2. Yedinci saldırı ailesini ekleyin: alınan belgeler aracılığıyla dolaylı prompt enjeksiyonu. Gereken ekstra savunmayı ölçün.

3. "Yardımla reddet" modunu uygulayın: Korkuluk bloke olduğunda hedef, düz bir reddetme yerine daha güvenli bir yanıt sunar. XSTest deltasını ölçün.

4. Çok dilli kapsam boşluğu: X-Guard'ın düşük performans gösterdiği bir dil bulun. Onu hedefleyen bir dataset ince ayarı önerin.

5. Anayasal özeleştiriyi 30B modeli üzerinde çalıştırın ve deltanın ölçeklenip ölçeklenmediğini ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Katmanlı güvenlik | "Derinlemesine savunma" | Girişte, kapıda, çıkışta, HITL'de çoklu korkuluklar |
| Lama Muhafızı 4 | "Meta'nın güvenlik sınıflandırıcısı" | 2026 referans giriş/çıkış içerik sınıflandırıcısı |
| ÇİFT | "Firar agent" | Yüksek Lisans odaklı jailbreak keşfi üzerine makale (Chao ve diğerleri) |
| DOKUN | "Saldırı Ağacı" | PAIR'in ağaç arama çeşidi |
| GCG | "Açgözlü koordinat gradient" | Gradient tabanlı çekişmeli son ek saldırısı |
| Anayasal özeleştiri | "Antropik tarzda eğitim" | Taslakları hedefleyin -> eleştirmen puanları -> yeniden yazın -> yeniden eğitin |
| XSTest | "İyi huylu prob seti" | Aşırı reddetme regresyonu için Benchmark |
| CVSS4.0 | "Önem derecesi puanı" | Güvenlik bulguları için standart güvenlik açığı puanlaması |

## Daha Fazla Okuma

- [Antropik Anayasal Sınıflandırıcılar](https://www.anthropic.com/research/constitutional-classifiers) — eğitim zamanı referansı
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) — 2026 giriş/çıkış sınıflandırıcısı
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — resim + çok modlu güvenlik
- [NVIDIA Nemotron 3 İçerik Güvenliği](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — kurumsal referans
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 132 dilli çok dilli güvenlik
- [garak](https://github.com/NVIDIA/garak) — NVIDIA kırmızı takım araç seti
- [PyRIT](https://github.com/Azure/PyRIT) — Microsoft kırmızı takımı framework
- [NeMo Korkulukları v0.12](https://docs.nvidia.com/nemo-guardrails/) — ray framework
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — jailbreak agent ödevi
