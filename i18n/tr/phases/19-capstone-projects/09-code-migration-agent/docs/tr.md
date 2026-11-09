# Capstone 09  Kod Göç Etme Ajanı (Repo-Level Dil / Çalışma Zamanı Yükseltme)

> Amazon'un MigrationBench (Java 8 ila 17) ve Google'ın App Engine Py2-to-Py3 göçörü 2026 barını belirledi. Modern'in OpenRewrite'i, belirleyici AST'lerin ölçekli olarak yeniden yazılmasını sağlar. Grit aynı sorunu kodemod tarzı DSL ile hedefliyor. Üretim örneği her ikisini birleştirir: güvenli yeniden yazılar için belirleyici bir altyapı eklemiş belirsiz durumlar için bir ajan katmanı, her dal için bir kum kutusu ve PR açılmadan önce yeşilye dönen bir test harnesini. Son taş 50 gerçek depoyu göç etmek ve başarısızlık taksonomisi ile geçiş oranını yayınlamak.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Sorun

Büyük ölçekli kod göçü, 2026 kodlama ajanlarının en temiz üretim uygulamalarından biridir. Yerel gerçeklik açık (test süiti göçden sonra geçer mi?), ödüller gerçek (Java-8 filosu göçü kişilik ölçeği projesidir) ve referans değerleri kamuoyundadır (MigrationBench 50-repo alt kümesi). Modern'in OpenRewrite'i belirleyici tarafı ele alıyor. Ajan katmanı OpenRewrite reçetelerinin yapamayacağı her şeyi ele alıyor: belirsiz yeniden yazılar, yapılandırma sistemi sürüklemesi, uzun kuyruğu sentaksisi, geçici bağımlılık kırılması.

Java 8 repo (veya Python 2 repo) alan bir ajan oluşturup yeşil-CI göçüran bir dal üretirsiniz. Geçit oranını, test kapsamının korunmasını, repo başına maliyetleri ve bir başarısızlık taksonomisini ölçersiniz.

## Anlam

Bu boru hattı iki katman içindedir.**deterministic substrate**(OpenRewrite for Java, libcst for Python) mekanik yeniden yazmaların büyük kısmını güvenli bir şekilde çalışır: ithalat, yöntem imzaları, sıfır güvenlik düzenlemeleri, kaynaklarla deneme, eski API değiştirmeleri.**agent layer**(OpenAI Agents SDK veya LangGraph over Claude Opus 4.7 ve GPT-5.4-Codex) reçetelerinin yapamadığı durumları ele alır: yapılandırma dosyası yükseltmeleri (Maven/Gradle/pyproject), geçici bağımlılık çatışmaları, test parçaları, özel notlar.

Her repo, hedef çalıştırma süresi önceden kurulmuş bir Daytona kum kutusu alır. Ajan iterasyon yapar: oluşturma çalıştırın, hataları sınıflandırın, düzeltme uygulayın, tekrar çalıştırın. Zor sınırlar: 30 dakika her repo, 8 $ her repo, 20 ajan dönüşü. Tüm testler geçirse ve kapsam 2 yüzde puandan fazla düşmezse, şubesi bir PR açar.

Başarısızlık taksonomisi teslim edilebilir. 50 repos'da, ne bozuldu? Depozisyonlar? Özel notlar? Kullanım sürümü oluşturun? Göçmenlikle ilgili olmayan test parçaları? Her sınıf bir sayım ve örnek farklılık elde eder. Gelecekteki tarif yazarları ilk üçü hedef alabilirler.

## Mimarlık

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## Yüküm

- Deterministik altyapı: OpenRewrite (Java) veya libcst (Python)
- Agent: OpenAI Agents SDK veya LangGraph over Claude Opus 4.7 + GPT-5.4-Codex
- Kum Kutusu: Daytona devcontainers per branch, ön monte edilmiş hedef çalıştırma süresi (Java 17 / Python 3.12)
- Yapım sistemleri: Maven, Gradle, uv (Python)
- Benchmarks: Amazon MigrationBench 50-repo alt kümesi (Java 8 ila 17), Google App Engine Py2-to-Py3 repos
- Test harness: paralel koşucusu, Jacoco (Java) veya coverage.py (Python) üzerinden kapsam
- Gözlem: Her farklı parçayla repo başına Langfuse + iz paketleri
- Dashboard: sınıf başına sayılar ve örnek farklılıkları olan hata taksonomisi dashboard

```figure
ce-migration-funnel
```

## Yapın

1. **Recipe pass.**İlk olarak OpenRewrite (Java) veya libcst (Python) reçetelerini çalıştırın.

2. **Build trial.**Daytona kum kutusu: hedef çalıştırma zamanını kur, inşaat çalıştır. Yeşilse testlere geç. Kırmızısa ajanı teslim et.

3. **Agent loop.**LangGraph ile araçlar: `run_build`- Evet .`read_file`- Evet .`edit_file`- Evet .`run_test`- Evet .`git_diff`.Agent hataları sınıflandırır ( derinlik, sentaks, test, yapı aracı) ve hedefli bir düzeltme uyguluyor.

4. **Budget caps.**30 dakika, 8 dolar, 20 ajan döner. "Budget_exhaust" altında herhangi bir ihlal durur ve dosyaları mevcut fark ile "budget_exhaust" altında durur.

5. **Test + coverage gate.**Build yeşil gittiğinde test paketini çalıştırın. Kapsama taban repo ile karşılaştırın. Kapsama 2 yüzde puandan fazla düştüyse, "kaplama_sıkıntı" altında dosya edin.

6. **PR open.**Başarıya ulaştığınızda, şubenize basın, PR'yi farklılık ve hangi tariflerin uygulanıp hangi temsilcinin yazarı olduğunu özetleyerek açın.

7. **Failure taxonomy.**Her başarısız repo için bir sınıf ile etiketleyin: `dep_upgrade_required`- Evet .`build_tool_drift`- Evet .`custom_annotation`- Evet .`test_flake`- Evet .`syntax_edge_case`- Evet .`budget_exhausted`Bir takım tahtası yap.

8. **50-repo run.**MigrationBench alt kümesi boyunca çalıştır. Sınıf başına geçiş oranını, rapora göre maliyet, kapsam-sağlama ve sadece karşılaştırma-deterministik bir temel çizgi raporlayın.

## Kullan

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## Gönder

`outputs/skill-migration-agent.md`bir repo verildiğinde, bir deterministik reçeteyi uyguluyor, sonra yeşil göçlü bir dal üretmek için bir ajan döngüsü yapar veya repo'yu taksonomi sınıfı altında dosyalar.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## Egzersizler

1. Göçürürken sadece OpenRewrite ile (ajan yok) boru hattını çalıştırın. Geçit oranını tüm boru hattına karşılaştırın. Ajanın farkı olan durumları belirleyin.

2. "Lint-clean" kontrolünü uygulayın: göçden sonra bir stil linter çalıştırın (Java için lekesiz, Python için ruff). Yeni lint hataları ortaya çıktığında PR'yi başarısız edin.

3. "Minimal fark" optimizerini ekleyin: ajanın dalı testleri geçtikten sonra, gereksiz değişiklikleri ikinci bir geçişle kesin.

4. Üçüncü bir göçe kadar uzan: Node 18'e Node 22. Kum kutu sarılmasını yeniden kullanın; tarif katmanını özel bir kod mod için değiştirin.

5. UX metrik olarak ilk yeşil yapı zamanını ölçün. Hedef: p50 10 dakikadan az.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## Daha Fazla Okumak

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) 2026 tarihli referans değerleri
- [Moderne.io OpenRewrite platform](https://www.moderne.io) Deterministik altyapı referansı
- [OpenRewrite documentation](https://docs.openrewrite.org) Resep yazarlığı
- [Grit.io](https://www.grit.io) alternatif kod mod DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) Agentler SDK referansı
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) alternatif göç referansı
- [libcst](https://github.com/Instagram/LibCST) Python belirleyici altyapısı
- [Daytona sandboxes](https://daytona.io) Ürünler arası referans kum kutuları
