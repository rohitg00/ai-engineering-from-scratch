# Capstone 16  GitHub İletişim-PR Otonom Ajan

> Bir sorunu etiketleyin, bir PR alın  2026 otonom kodlama ajanları için ürün şekli: bir ajanı bulut kum kutusunda çalıştırın, testlerin geçmesini doğrulayın ve bir inceleme hazır PR'yi mantıklı bir şekilde yayınlayın. AWS Uzak SWE Ajanları, Cursor Arkaplan Ajanları, OpenAI Codex bulutları ve Google Jules hepsi onu gönderir. Zor kısımlar repo'nun oluşturma ortamını otomatik olarak yeniden oluşturmak, kredi kaynaklarının sızmasını önlemek, repo bütçelerini uygulamak ve ajanın zorla itmemesini sağlamak. Bu kap taşı kendi kendine barındırılan sürümü oluşturur ve maliyet ve geçiş oranı ile barındırılan alternatiflerle karşılaştırır.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Sorun

Async bulut kodlama ajanı, etkileşimli kodlama ajanlarından ayrı bir ürün kategorisidir (capstone 01). UX GitHub etiketidir.`@agent fix this`Bu, bir çalışanın bulut sandboxuna girmesini, repo'yu klonlamasını, testleri çalıştırmasını, dosyaları düzenlemesini, ajanın mantıklılığını kullanarak bir PR'yi doğrulamasını ve açmasını sağlar.

Mühendislik zorlukları: çevre yeniden üretimi (ajent, repo'yu sıfırdan bir önbelleğe kaydedilmiş bir geliştirme görüntüsü olmadan oluşturmalıdır), gevşek testler (daha tekrar çalıştırılmalı veya izole edilmelidir), kredi alanı (minimal ince tanelerli izinlerle bir GitHub Uygulama), günde repo başına bütçe uygulanması ve zorsuz itme politikası.

## Anlam

Çekici GitHub webhook (sorun etiket veya PR yorum) bir dispatcher iş ECS Fargate veya Lambda'ya sorgular. İşçi repo'yu Daytona veya E2B kum kutusu içine çekir.

Verifikasyon kaplama adımıdır. PR açılmadan önce tam bilgi işleminin kum kutusunda geçmesi gerekir. Kapsam delta hesaplanır; eşiğin eşiğinden ötesinde negatif ise PR açılır ama etiketlenir `needs-review`- Ajan, mantıklılığı PR açıklaması ve bir ek olarak gönderir.`@agent`Recenseur takip için ping yapabilir.

Güvenlik iki farklı GitHub yüzeyinden oluşur: Uygulama kısa ömürlü bir kurulum jetonu sağlar.`workflows: read`ve dar repo içeriği/PR alanları; şubeler koruma (apk izinleri değil) "birbirden yazılmıyor" uygulamasını zorlar.`main`" ve "force-push"  uygulamayı hiç atlama listesine eklenmez.`.github/workflows`GitHub uygulaması gerçek bir primitif değildir, bu nedenle ajanın dosya düzenlemelerindeki izin listesi bunu işçi üzerinde zorlamalıdır.

## Mimarlık

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## Yüküm

- Trigger: GitHub uygulaması ince tohumlu token; Lambda veya Fly.io üzerinden webhook alıcı
- İşçi: ECS Fargate görevi (veya GitHub Actions kendi kendine barındırılan koşucu)
- Kum Kutusu: Daytona devcontainer veya E2B kum kutusu görev başına
- Ajan döngüsü: Mini-swe-agent baseline veya SWE-agent v2 üzerinde Claude Opus 4.7 / GPT-5.4-Codex
- Arama: ağaç bekçisi repo haritası + ripgrep
- Verifikasyon: Tam bilgi bilgisası kum kutusunda + kapsam delta kapısı
- Gözlemsellik: İlişki Örgütü tarafından bağlantılı bir İlişki Örgütü'ne göre iz arşivine sahip Langfuse
- Bütçe: repo başına günlük dolar tavanı; günde repo başına maksimum PR

```figure
cf-issue-to-pr
```

## Yapın

1. **GitHub App.**İnstalasyon simgesi: okuma + yazma, pull_requests yazma, içerik okuma + yazma, iş akışları okunabilir.`main`" ve " zorla itmek yok" uygulaması bypass listesinde değil.`.github/workflows`GitHub App izinleri yol ölçüsü olmadığı için önerilen farklılık için izin listesi kontrolü olarak.

2. **Webhook receiver.**Lambda işlevi, sorun etiketlerini / PR yorumlarını webhooks olarak kabul eder.`@agent fix this`SQS'e gel.

3. **Dispatcher.**SQS'ten görevleri açar. Günde bir rekabet bütçesini uyguluyor. Rekabet URL'si, yayın gövdesine ve taze bir Daytona kum kutusu ile bir ECS Fargate görevini döndürüyor.

4. **Environment inference.**Python, Node, Go, Rust) ve paket yöneticisini (uv, pnpm, go mod, cargo) tespit edin.

5. **Agent loop.**Mini-swe-agent veya Claude Opus 4.7 ile SWE-agent v2. Araçlar: ripgrep, tree-sitter repo-map, read_file, edit_file, run_tests, git.

6. **Verification.**Çubuk tamamlandıktan sonra, tüm test süiti kum kutusunda çalıştırın. Jacoco / coverage.py üzerinden kapsam delta hesaplayın. CI kırmızı ise: dur, PR açmayın. Kapsam % 2'den fazla düşerse: açık PR ile `needs-review`Etiket.

7. **PR posting.**GitHub API üzerinden PR aç: başlık, mantık, farklılık özet, iz URL, maliyet, dönüş.

8. **Credential hygiene.**İşçi kısa ömürlü bir GitHub uygulaması yükleme jetonu ile çalışır.

9. **Eval.**30 farklı zorluk içi sorunları ortaya çıkardı. Geçit oranını, PR kalitesini (farklı boyut, stil, kapsam), maliyetini, gecikmeyi ölçün. Aynı konularda Cursor Arka Yöntemli Ajanlar ve AWS Uzak SWE Ajanları ile karşılaştırın.

## Kullan

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Gönder

`outputs/skill-issue-to-pr.md`GitHub App + async bulut çalışanı, etiketlenmiş sorunları sınırlı maliyet ve kapsamlı yeteneklerle inceleme hazır PR'lere dönüştürür.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## Egzersizler

1. "Düzeltme kayalıklı testi" modunu ekleyin: etiket `@agent stabilize-flake TestX`Test 50 kez sandbox'ta yapılır ve onu istikrarlı hale getiren en az bir değişiklik önerir.

2. Üç ortak konu üzerinde maliyet vs. kursör arka plan ajanlarını karşılaştırın. Hangi araçların nerede kazanmış olduğunu rapor edin.

3. Bütçe paneli uygulayın: günlük, kullanıcı başına maliyet, anomali uyarısı.

4. Bir PR taslağını CI çalıştırmadan açan "kuyu çalıştırma" modunu oluşturun, böylece inceleyiciler planı ucuz bir şekilde inceleyebilirler.

5. Bir tutma politikası ekle: Birleştirilmeden 7 günden daha eski olan İlişki Şubeleri otomatik olarak silinir.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## Daha Fazla Okumak

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) kanonik asynk bulut ajanı referansı
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) CLI referansı
- [Cursor Background Agents](https://docs.cursor.com/background-agent) Ticari alternatif
- [OpenAI Codex (cloud)](https://openai.com/codex) Ev sahibi rekabetçi
- [Google Jules](https://jules.google) Google'ın barındırılan sürümü
- [Factory Droids](https://www.factory.ai) alternatif ticari referans
- [GitHub App documentation](https://docs.github.com/en/apps) Görevi bot kimliği
- [Daytona cloud sandboxes](https://daytona.io) Referans kum kutusu
