# Kendini Temizle ve TANKIR: Sürekli Çıktıranın İyileştirilmesi

> Self-Refine (Madaan et al., 2023) bir LLM'yi üç rolde kullanır  oluşturun, geri bildirim verin, bir döngü içinde  düzeltin. Ortalama kazanç: 7 görevde +20 mutlak. CRITIC (Gou et al., 2023) dış araçlar aracılığıyla doğrulama yönlendiriyor ve geri bildirim adımını sertleştirir. 2026 yılında bu model her çerçeveye " değerlendirici-optimizeci " (Anthropic) veya bir gardail döngü (OpenAI Ajanlar SDK) olarak gönderir.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Devlet Kendini Temizleme'nin üç ipucu (üçlü oluştur, geri bildirim, tamir) ve tarih neden tamir süresi için önemli açıklayın.
- CRITIC'in kritik anlayışını açıklayın: LLM'ler dış temelli olmadan kendi kendini doğrultmak için güvenilir değildir.
- Tarih ve seçeneği olmayan bir dış doğrulama aracı ile stdlib Self-Refine döngüsünü uygulayın.
- Bu kalıpı Anthropic'in "evalüyatör-optimizeci" iş akışına ve OpenAI Agents SDK'nin çıkış korumalarına haritasın.

## Sorun

Bir ajan neredeyse doğru bir cevap verir. Belki bir kod satırında bir sözcük hatası vardır. Belki bir özet çok uzun olabilir. Belki bir plan kenar bir durumu kaçırır. İstediğiniz şey: ajan kendi çıkışını eleştirir, sonra düzeltir.

Self-Refine, bu çalışmayı tek bir modelle, eğitim verileri, RL ile gösterir. Ama bir yakalama vardır: LLM'ler sert gerçeklere dayanarak kendi kendini doğrulama konusunda kötüdürler. CRITIC, sabitleme  yönünü dış araçlar ( arama, kod yorumcu, hesap makinesi, test koşucusu) aracılığıyla doğrulama adımını yönlendirir.

Bu iki makale birlikte, 2026'da tekrarlı gelişim için varsayılan standardı tanımlar: oluştur, doğrulay (mümkün olduğunda dıştan), geliştir, doğrulayıcı geçerken dur.

## Anlaşım

### Kendini Temizle (Madaan et al., NeurIPS 2023)

Bir LLM, üç rol:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

Anahtar detay:`refine`Bu nedenle, tüm geçmişi  tüm önceki çıkışları ve eleştirileri  görür, böylece hataları tekrarlamaz.

Başlık: GPT-4 dahil olmak üzere 7 görev (matematik, kod, kısaltma, iletişim) boyunca ortalama +20 mutlak iyileşme.

### CRITIC (Gou et al., arXiv:2305.11738, v4 Feb 2024)

Self-Refine'in zayıflığı: geri bildirim adımı, LLM puanlamasıdır. Gerçek iddialar için bu güvenilir değildir (halüsinasyon genellikle üreten model için ikna edici görünür). CRITIC yerine `feedback(task, output)`- Evet .`verify(task, output, tools)`nerede`tools`içerir:

- Gerçek iddiaları için bir arama motoru.
- Kodu doğrulamak için bir kod tercümanı.
- Hesap makinesi.
- Alan-specifik verifikatörler (birlik testleri, tip kontrolü, linterler).

Verifikatör, araç sonuçlarına dayalı bir yapılandırılmış eleştirim üretir.

Başlık: CRITIC, gerçek görevlerde Self-Refine'i üstün kılar çünkü eleştiriler yerleşiktir. Dış doğrulayıcılar (yaratıcı yazma, biçimlendirme) olmayan görevlerde CRITIC, Self-Refine'e düşürür.

### Durma durumu

İki ortak şekil:

1. **Verifier passes.**Dış test başarıyı gösterir. Kullanılabilir olduğunda tercih edilir (birlik testleri, tip kontrolcü, koruma rayı tesisi).
2. **No feedback issued.**Model "çıkış iyi" diyor. Daha ucuz ama güvenilir değil.

2026 Varsayılan: onları birleştirin. "Tahqiqatçı geçerse durdur OR modeli iyi diyor ve iteralar >= 2 OR iteralar >= max_iterations. "

### Evaluator-Optimizer (Anthropic, 2024)

Anthropic'in Aralık 2024'te yayınladığı bir yazı bunu beş iş akışı örneğinden biri olarak adlandırıyor.

- Değerlendirici: çıkışı notlar ve eleştirileri üretir.
- Optimizer: eleştirileri göz önüne alarak çıkışı gözden geçirir.

Bu, Anthropic'in çerçevesinde Self-Refine / CRITIC. Anthropic'in kritik mühendislik ayrıntıları: değerlendirici ve optimizör istekleri önemli ölçüde farklı olmalıdır, böylece model sadece kauçuk damgasını oluşturmaz.

### OpenAI Ajanlar SDK çıkış koruyucuları

OpenAI Agents SDK bu örneği "çıktı koruma rayları" olarak gönderir.`OutputGuardrailTripwireTriggered`), çıkış reddedilir ve ajan yeniden deneyebilir. Guardrails araçları (CRITIC tarzı) veya saf fonksiyonlar (Self-Refine tarzı) çağırabilir.

### 2026 Tuzaklar

- **Rubber-stamp loops.**Aynı generasyon ve eleştirisi yapan aynı hızlı stille aynı model "Bana iyi görünüyor".
- **Over-refinement.**Her iyileştirme geçişinde gecikme ve belirtiler eklenir.
- **CRITIC on trivial tasks.**Dış doğrulayıcı yoksa, CRITIC kendini temizleme olarak azalır; bir stub doğrulayıcı için gecikme ödemeyin.

```figure
self-refine
```

## Yapın

`code/main.py`Bir oyuncak görevinde Self-Refine ve CRITIC uygulamaktadır: bir konu verilmesiyle kısa bir kurşun listesi oluşturur. Verifiyatör formatı kontrol eder (3 kurşun, her biri 60 kardan aşağıdır). CRITIC bilinen halüsinasyonları cezalandıran bir dış "gerçek doğrulayıcı" ekler.

Bileşenler:

- `generate`-Skript yapımcısı.
- `feedback` LLM tarzında kendi kendini eleştirmek.
- `verify_external` CRITIC tarzı yerleşik doğrulayıcı.
- `refine` verilen geçmişin çıktısını yeniden yazır.
- Durma koşulları  doğrulayıcı geçiyor veya maksimum 4 tekrar.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Kendini Temizle ve CRITIC ile karşılaştırın. CRITIC gerçek bir hata yakalar.

## Kullan

Anthropic'in değerlendirici-optimizecisi bu kalıpdır. OpenAI Ajanlar SDK'nin çıkış koruyucuları CRITIC şeklinde (koruyucular araçları çağırabilir). LangGraph, Self-Refine gibi okuyan bir yansıma düğümünü gönderir. Google'ın Gemini 2.5 Bilgisayar Kullanımı, CRITIC bir variansı olan bir adımlık güvenlik değerlendirici ekler: her eylem commit olmadan önce doğrulanır.

## Gönder

`outputs/skill-refine-loop.md`Görev şekli, doğrulayıcı kullanılabilirliği ve tekrarlama bütçesi verildiği için değerlendirici-optimizeci döngüsünü yapılandırır.

## Egzersizler

1. Oyuncakları en fazla 1 ile çalıştır.
2. Dış doğrulayıcıyı gürültülü bir verifiye ile değiştirin (hassasi %30 yanlış pozitif).
3. "Benizdeki modeller üzerinde jeneratör eleştirisi" varianti uygulanır: büyük modeller oluşturur, küçük model eleştirileri. Aynı modelden daha mı üstün?
4. CRITIC Bölümü 3'ü okuyun (arXiv:2305.11738 v4). Üç doğrulama aracı kategorisini isimlendirin ve her biri için bir örnek verin.
5. Harita OpenAI Ajanları SDK'lar `output_guardrails`SDK'nin neyi yanlış bulduğunu ve neyi doğru bulduğunu?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-Refine | "LLM that fixes itself" | Generate -> feedback -> refine loop in one model, with history |
| CRITIC | "Tool-grounded verification" | Replace feedback with an external verifier (search, code, calc, tests) |
| Evaluator-Optimizer | "Anthropic workflow pattern" | Two roles — evaluator scores, optimizer revises — looped to convergence |
| Output guardrail | "Post-hoc check" | OpenAI Agents SDK validator that runs after an agent produces output |
| Verify step | "Critique phase" | The load-bearing decision: grounded or self-rated |
| Refine history | "What the model already tried" | Prior outputs + critiques prepended to refine prompt; drop and quality collapses |
| Rubber-stamp loop | "Self-agreement failure" | Same-prompt critique returns "looks good"; fix with structurally different prompts |
| Stop condition | "Convergence test" | Verifier passes OR no feedback AND iteration cap; never single-condition |

## Daha Fazla Okumak

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) Kanonik kağıt
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) Araçlı doğrulama
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) değerlendirici-optimizeci iş akışı modeli
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) CRITIC şeklinde doğrulayıcılar olarak çıkış koruyucu rayları
