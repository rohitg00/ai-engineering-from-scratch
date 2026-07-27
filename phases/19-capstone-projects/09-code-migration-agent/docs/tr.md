# Capstone 09 — Kod Taşıma Agent (Repo Düzeyinde Dil / Çalışma Zamanı Yükseltmesi)

> Amazon'un MigrationBench (Java 8'den 17'ye) ve Google'ın App Engine Py2'den Py3'e geçiş aracı 2026 çıtasını belirledi. Moderne'nin OpenRewrite'ı, deterministik AST yeniden yazımlarını geniş ölçekte gerçekleştirir. Grit, codemod tarzı DSL ile aynı sorunu hedefliyor. Üretim modeli her ikisini de birleştirir: güvenli yeniden yazmalar için deterministik bir alt tabaka artı belirsiz durumlar için bir agent katmanı, her dal için bir korumalı alan ve PR açılmadan önce yeşile dönen bir test donanımı. Sonuç olarak 50 gerçek repoyu taşımak ve başarısızlık taksonomisine sahip bir geçiş oranı yayınlamaktır.

**Tür:** Kapak taşı
**Diller:** Python (agent), Java / Python (hedefler), TypeScript (kontrol paneli)
**Önkoşullar:** Aşama 5 (NLP), Aşama 7 (transformers), Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar), Aşama 14 (agents), Aşama 15 (otonom), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P5 · P7 · P11 · P13 · P14 · P15 · P17
**Süre:** 30 saat

## Sorun

Büyük ölçekli kod geçişi, 2026 kodlama agent'ların en temiz üretim uygulamalarından biridir. Temel gerçek açıktır (test paketi geçişten sonra geçer mi?), ödüller gerçektir (Java-8 filosu geçişi, kişi sayısı ölçeğinde bir projedir) ve benchmark'lar halka açıktır (MigrationBench 50-repo alt kümesi). Moderne'nin OpenRewrite'ı deterministik tarafı ele alıyor. agent katmanı, OpenRewrite tariflerinin yapamadığı her şeyi yönetir: belirsiz yeniden yazmalar, yapı sistemi kayması, uzun kuyruk sözdizimi, geçişli bağımlılığın bozulması.

Java 8 deposunu (veya Python 2 deposunu) alan ve yeşil CI geçişli bir dal üreten bir agent oluşturacaksınız. Geçiş oranını, test kapsamının korunmasını, repo başına maliyeti ölçecek ve bir başarısızlık sınıflandırması oluşturacaksınız. Yalnızca deterministik bir taban çizgisine karşı yan yana size agent değerinin gerçekte nerede yaşadığını söyler.

## Konsept

Boru hattının iki katmanı vardır. **Belirleyici alt tabaka** (Java için OpenRewrite, Python için libcst) mekanik yeniden yazma işlemlerinin çoğunu güvenli bir şekilde çalıştırır: içe aktarmalar, yöntem imzaları, boş güvenlik düzenlemeleri, kaynaklarla deneme, kullanım dışı API değiştirmeleri. Hızlıdır ve denetlenebilir farklar üretir. **agent katmanı** (OpenAI Agent'nin SDK'sı veya Claude Opus 4.7 ve GPT-5.4-Codex üzerinden LangGraph) tariflerin yapamayacağı durumları ele alır: derleme dosyası yükseltmeleri (Maven/Gradle/pyproject), geçişli bağımlılık çatışmaları, test pulları, özel açıklamalar.

Her repo, hedef çalışma zamanının önceden yüklendiği bir Daytona sanal alanına sahip olur. agent yinelenir: derlemeyi çalıştır, hataları sınıflandır, düzeltmeyi uygula, yeniden çalıştır. Sabit limitler: Repo başına 30 dakika, repo başına 8$, 20 agent dönüş. Tüm testler başarılı olursa ve kapsama deltası negatif değilse şube PR açar. Değilse, repo delillerle birlikte bir başarısızlık sınıfı altında dosyalanır.

Başarısızlık taksonomisi teslimattır. 50 repoda ne kırıldı? Geçişli derinlikler mi? Özel açıklamalar? Araç sürümü oluşturulsun mu? Test pullarının göçle ilgisi yok mu? Her sınıfa bir sayım ve örnek bir fark verilir. Gelecekteki tarif yazarları ilk üçü hedefleyebilir.

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

## Yığın

- Deterministik alt tabaka: OpenRewrite (Java) veya libcst (Python)
- Agent: Claude Opus 4.7 + GPT-5.4-Codex üzerinden OpenAI Agent'nin SDK'sı veya LangGraph'ı
- Sandbox: Dal başına Daytona devcontainer'ları, önceden yüklenmiş hedef çalışma zamanı (Java 17 / Python 3.12)
- Yapı sistemleri: Maven, Gradle, uv (Python)
- Benchmarks: Amazon MigrationBench 50 repo alt kümesi (Java 8 ila 17), Google App Engine Py2'den Py3'e depolar
- Test donanımı: paralel koşucu, Jacoco (Java) veya coverage.py (Python) aracılığıyla kapsama alanı
- Observability: Langfuse + repo başına her fark parçasıyla izleme paketi
- Kontrol Paneli: sınıf başına sayımlar ve örnek farklar içeren başarısızlık sınıflandırması kontrol paneli

## Build It — Kendin Geliştir

1. **Tarif geçişi.** Önce OpenRewrite (Java) veya libcst (Python) tariflerini çalıştırın. Mekanik geçişlerin %70-80'ini yakalayın. "Tarif" taahhüdü olarak taahhüt edin.

2. **Derleme denemesi.** Daytona korumalı alanı: hedef çalışma zamanını yükleyin, derlemeyi çalıştırın. Yeşilse testlere geçin. Kırmızı ise agent'a devredin.

3. **Agent loop.** Araçlarla LangGraph: `run_build`, `read_file`, `edit_file`, `run_test`, `git_diff`. Agent hatayı sınıflandırır (dep, sözdizimi, test, derleme aracı) ve hedefe yönelik bir düzeltme uygular. Tekrar çalıştır.

4. **Bütçe tavanları.** Repo başına 30 dakikalık duvar saati, 8$ maliyet, 20 agent dönüş. Herhangi bir ihlal durdurulur ve mevcut farkla birlikte "budget_exhausted" kapsamındaki dosyalar.

5. **Test + kapsama kapısı.** Derleme yeşile döndükten sonra test paketini çalıştırın. Kapsamı temel depoyla karşılaştırın. Kapsam %2'den fazla düşerse "coverage_regression" altına dosyalayın.

6. **PR açık.** Başarı durumunda, şubeye basın, farkı ve hangi tariflerin uygulandığını ve hangisinin yazıldığını agent taahhüt ettiğini gösteren bir özet içeren PR'yi açın.

7. **Başarısızlık sınıflandırması.** Başarısız olan her repo için bir sınıfla etiketleyin: `dep_upgrade_required`, `build_tool_drift`, `custom_annotation`, `test_flake`, `syntax_edge_case`, `budget_exhausted`. Bir kontrol paneli oluşturun.

8. **50 repo çalıştırması.** MigrationBench alt kümesinde yürütün. Sınıf başına geçiş oranını, repo başına maliyeti, kapsamı korumayı ve yalnızca karşılaştırmaya karşı deterministik temel çizgiyi raporlayın.

## Use It — Hazır Araçla Uygula

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

## Ship It — Kullanıma Sun

`outputs/skill-migration-agent.md` teslim edilebilirdir. Bir repo verildiğinde, yeşil bir taşınmış dal oluşturmak için deterministik tarifleri çalıştırır ve ardından bir agent loop komutunu çalıştırır veya repoyu bir sınıflandırma sınıfı altında dosyalar.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | MigrationBench geçiş oranı | 50 repo alt kümesi pass@1 |
| 20 | Test kapsamının korunması | Ortalama kapsama deltası ve taban |
| 20 | Taşınan repo başına maliyet | geçen çalıştırmalarda $/repo |
| 20 | Agent / deterministik araç entegrasyonu | OpenRewrite'ın işlediği düzeltmelerin ve agent tarafından yazılan düzeltmelerin oranı |
| 15 | Arıza analizi yazımı | Örneklerle sınıflandırma bütünlüğü |
| **100** | | |

## Egzersizler

1. Taşıma hattını yalnızca OpenRewrite ile çalıştırın (agent yok). Geçiş oranını tam ardışık düzen ile karşılaştırın. Yalnızca agent'ın fark oluşturduğu durumları belirleyin.

2. Bir "lint-clean" kontrolü uygulayın: geçişten sonra bir stil linter çalıştırın (Java için lekesiz, Python için ruff). Yeni tüy bırakmayan hatalar ortaya çıkarsa PR'yi başarısız yapın. Kapsamın korunduğu ancak stilin gerilediği oranı ölçün.

3. Bir "minimal fark" optimize edici ekleyin: agent'ın dalı testleri geçtikten sonra, gereksiz değişiklikleri ikinci bir geçişle düzeltin. Fark boyutunun küçültülmesini bildirin.

4. Üçüncü geçişi genişletin: Düğüm 18'den Düğüm 22'ye. Korumalı alan sarmalamayı yeniden kullanın; tarif katmanını özel bir kod moduyla değiştirin.

5. İlk yeşil yapıya kadar geçen süreyi (TTFGB) bir UX ölçümü olarak ölçün. Hedef: p50 10 dakikanın altında.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Deterministik substrat | "Tarif motoru" | OpenRewrite / libcst: bildirimsel AST güvenlik garantileriyle yeniden yazıyor |
| Kod Modu | "Kod değiştirme programı" | Kaynak kodunu mekanik olarak değiştiren bir yeniden yazma kuralı |
| Drift oluşturma | "Araç sürümü çarpıklığı" | Ana sürümler arasında ince Maven / Gradle / uv davranışı değişiklikleri |
| Başarısızlık sınıfı | "Sınıflandırma grubu" | Deponun taşınmamasının etiketli nedeni: dep, sözdizimi, test, derleme aracı, bütçe |
| Kapsama deltası | "Kapsama koruması" | Temelden taşınan şubeye kadar test kapsamı yüzdesindeki değişim |
| Agent dönüş | "Araç çağırma turu" | Tek plan -> harekete geç -> agent loop |
| Bütçe tükenmesi | "Tavana çarpın" | Repo, 30 dakika / 8 $ / 20 tur limitini geçmeden tüketti |

## Daha Fazla Okuma

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — standart 2026 benchmark
- [Moderne.io OpenRewrite platformu](https://www.moderne.io) — deterministik alt tabaka referansı
- [OpenRewrite belgeleri](https://docs.openrewrite.org) — tarif yazma
- [Grit.io](https://www.grit.io) — alternatif kod modu DSL
- [OpenAI korumalı alana alınmış geçiş yemek kitabı](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — Agent'nin SDK referansı
- [Google App Engine Py2'den Py3'e geçiş aracı](https://cloud.google.com/appengine) — alternatif geçiş benchmark
- [libcst](https://github.com/Instagram/LibCST) — Python deterministik alt katmanı
- [Daytona sanal alanları](https://daytona.io) — dal başına sanal alana referans
