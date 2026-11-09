# Eval-Driven Ajan Geliştirme

> Anthropic'in rehberliği: "sadece ipuçları ile başlayın, kapsamlı değerlendirme ile optimize edin ve yalnızca gerektiğinde çok adımlı ajantik sistemler ekleyin".

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Üç değerlendirme katmanının adını verin  statik referans değerleri, özel çevrimdışı, çevrimiçi üretim  ve her biri ne için.
- Değerlendirici-optimizeci sıkı döngüsünü açıkla.
- 2026'da en iyi uygulamayı açıklayın: değerlendirmeler kodun yanında canlı, CI'de çalıştırılır, kapı PR'ler.
- Her 14. aşama dersini oluşturduğu değerlendirme olayına bağlayın.

## Sorun

Ajanlar demoları geçiyor. Demoların tahmin edemeyeceği şekilde üretim başarısız olurlar. Benchmarks cevap "Bu model geniş çapta yetenekli mi?" değil "Bu ajan ürünüm için doğru yamalar gönderiyor mu?" cevabı: her koruma rayı ve öğrenilen kural ile eval vakalarına haritelenerek sürekli çalışan üç katman üzerinde değerlendirme.

## Anlaşım

### Üç değerlendirme katmanı

1. **Static benchmarks** SWE-benç Kodu için doğrulanmış (Desin 19), WebArena/OSWorld tarama / masaüstü için (Desin 20), GAIA için genelist için (Desin 19), BFCL V4 için araç kullanımı için (Desin 06).

2. **Custom offline evals** ürününüzün şekli:
   - Yargıç olarak LLM (Langfuse, Phoenix, Opik  Ders 24).
   - İptal tabanlı (yarama çalıştırmak, kontrol testleri).
   - Yolu tabanlı (güneş karşı eylem dizilerini karşılaştırın; OSWorld-Human altından 1.4-2.7x üst ajanları gösterir).

3. **Online evals** üretim:
   - Oturum tekrarları (Langfuse).
   - Koruma rayı tetiklenen uyarılar (Desin 16, 21).
   - Adımlık maliyet / gecikme izleme (Lection 23 OTel kapsamı).

### Değerlendirici-optimizeci (Antropik)

Sıkıntılı döngü:

1. Önericisi çıkış üretir.
2. Değerlendirici yargıçlar.
3. Değerlendirici geçene kadar temizleyin.

Bu Self-Refine (Deneyim 05) genelleştirilmiş.

### 2026 En iyi uygulamalar

- Evaller kodun yanında yaşıyor.
- Her PR'de bilgi sahibi olun.
- Evalu skorlarında geçit birleşimi (örneğin "% 5'e karşı gerileme yoktur").
- Her koruma bir değerlendirme olayı haritası.
- Öğrenilen her kural (Refleksyon, iş akışı için öğrenme kuralları) bir başarısızlık durumunu haritası yapar.

### 14 Fase'nin bir arada bağlanması

Faz 14'teki çoğu ders değerlendirme durumlarını oluşturur.

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

Eğer değerlendirme süitiniz her satır için bir vaka varsa, 14. aşamanın çekirdeğini kapsadınız.

### Değerlendirme yöntemi geliştirilmediğinde

- **No baseline.**Son bilinen iyi olmayan eşdeğerler okunamaz.
- **LLM-judge without grounding.**Yöneticiler de halüsinasyonlar yapar.
- **Over-fitting to evals.**Yükleme için optimize edilmek üretim yararlılığından farklıdır.
- **Flaky evals.**Deterministik olmayan durumlar sahte alarmlara neden olur.

```figure
ae-eval-three-layers
```

## Yapın

`code/main.py`stdlib eval harness:

- Kategori ile ilgili vakalar kayıtları (benchmark, custom, online).
- Bir senaryolu ajan test altında.
- Değerlendirici-optimizeci döngüsü: öner, yargı, geçiş veya maksimum turlara kadar geliştir.
- CI kapısı: Toplam geçiş oranı + başlangıç seviyesine karşı geri dönüş.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Sonuç: Her durumda geçiş/başarısızlık, gerileme bayrağı, CI kapı hüküm.

## Kullan

- Evalue vakalarını ajan kodunuzla aynı repo'da yazın.
- İletişim aracılığıyla her PR'de çalıştır.
- Geri dönüşü başarısızlığa uğratmak.
- Zamanla geçiş oranını takip et.
- Her üretim başarısızlığını yeni bir vaka bağlayın.

## Gönder

`outputs/skill-eval-suite.md`CI kapıları ve gerileme izleme ile bir ajan ürünü için üç katmanlı bir değerlendirme paketini oluşturur.

## Egzersizler

1. Üretim başarısızlıklarından birini alın, onu tekrarlayan bir değerlendirme yazın.
2. Bölümünüz için üç boyutlu bir LLM yargıç rubrik oluşturun (gerçek, ton, kapsam).
3. Değerlendirme süiti CI'ye bağlayın. %5 geri dönüşü üzerine inşaat başarısız.
4. Yolu-verimlilik ölçüsünü ekleyin: ajan kaç adım attı altın yoldaki bir yoldaki karşı?
5. Her 14. aşama dersi, evindeki değerlendirme olayına yerleştir.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## Daha Fazla Okumak

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) "sadece başlayın, değerlendirmelerle optimize edin"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) Kurate edilen referans değer
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) Araç kullanım referansı
- [Langfuse docs](https://langfuse.com/) değerlendirmeler + uygulama sırasında seans tekrarlaması
