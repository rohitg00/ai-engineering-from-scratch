# Bitirme Taşı 16 — GitHub Sorundan Halkla İlişkilere Otonom Agent

> Bir sorunu etiketleyin, bir PR alın — otonom kodlama için 2026 ürün şekli agents: bulut sanal alanında bir agent çalıştırın, testlerin geçtiğini doğrulayın ve gerekçeli, incelemeye hazır bir PR yayınlayın. AWS Remote SWE Agent'ler, İmleç Arka Planı Agent'lar, OpenAI Codex bulutu ve Google Jules'un tümü bunları gönderir. Zor kısımlar deponun derleme ortamını otomatik olarak yeniden üretiyor, kimlik bilgisi sızıntısını önlüyor, repo başına bütçeleri zorunlu kılıyor ve agent'ın zorla itilemeyeceğinden emin oluyor. Bu özet, şirket içinde barındırılan sürümü oluşturur ve bunu maliyet ve geçiş oranı açısından barındırılan alternatiflerle karşılaştırır.

**Tür:** Kapak taşı
**Diller:** Python (agent), TypeScript (GitHub Uygulaması), YAML (Eylemler)
**Önkoşullar:** Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar), Aşama 14 (agents), Aşama 15 (otonom), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P11 · P13 · P14 · P15 · P17
**Süre:** 30 saat

## Sorun

Eşzamansız bulut kodlaması agent, etkileşimli kodlama agent'lardan (kapak taşı 01) ayrı bir ürün kategorisidir. UX bir GitHub etiketidir. Bir sorunu `@agent fix this` olarak etiketlersiniz, bir çalışan bulut sanal alanında döner, repoyu klonlar, testleri çalıştırır, dosyaları düzenler, doğrular ve gövdede agent'ın gerekçesini içeren bir PR açar. Etkileşimli döngü yok, terminal yok. AWS Remote SWE Agent'ler, İmleç Arka Planı Agent'lar, OpenAI Codex bulutu, Google Jules ve Factory Droid'lerin tümü bunda birleşiyor.

Mühendislik zorlukları somuttur: ortamın yeniden üretilmesi (agent'ın repoyu önbelleğe alınmış bir geliştirici görüntüsü olmadan sıfırdan oluşturması gerekir), hatalı testler (yeniden çalıştırılması veya izole edilmesi gerekir), kimlik bilgisi kapsamı (minimum ayrıntılı izinlere sahip bir GitHub Uygulaması), repo başına günlük bütçe uygulaması ve zorlamasız politika. Kapsam taşı, barındırılan alternatiflere göre geçiş oranını, maliyeti ve güvenliği ölçer.

## Konsept

Tetikleyici bir GitHub web kancasıdır (sorun etiketi veya PR yorumu). Bir sevk memuru, işi ECS Fargate veya Lambda'ya yönlendirir. Çalışan, depodan çıkarılan genel bir Docker dosyasıyla (dil, framework) repoyu Daytona veya E2B sanal alanına çeker. agent, Claude Opus 4.7 veya GPT-5.4-Codex'e karşı mini-swe-agent veya SWE-agent v2 döngüsünü çalıştırır. Yinelenir: kodu okur, düzeltme önerir, yama uygular, testleri çalıştırır.

Doğrulama geçiş adımıdır. PR açılmadan önce tam CI korumalı alana geçmelidir. Kapsama deltası hesaplanır; bir eşiğin ötesinde negatifse PR açılır ancak `needs-review` olarak etiketlenir. agent, gerekçeyi PR açıklaması artı incelemecinin takip için ping atabileceği bir `@agent` ileti dizisi olarak yayınlar.

Güvenlik iki farklı GitHub yüzeyi aracılığıyla kapsanmaktadır: Uygulama, `workflows: read` ve dar repo içerikleri/PR kapsamları ile kısa ömürlü bir token kurulumu sağlar; şube koruması (uygulama izinleri değil) " `main`'ye doğrudan yazma yok" ve "zorla gönderme yok" işlemlerini uygular; uygulama hiçbir zaman atlama listesine eklenmez. `.github/workflows` 'ye yol kapsamlı salt okunur erişim, gerçek bir GitHub Uygulaması ilkel değildir, dolayısıyla agent'ın dosya düzenlemelerindeki izin verilenler listesinin bunu çalışanda zorunlu kılması gerekir. Günlük repo başına bütçe tavanları sevk görevlisi tarafından uygulanır (e.g., günde repo başına maksimum 5 PR, PR başına 20$).

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

## Yığın

- Tetikleyici: İnce taneli token içeren GitHub Uygulaması; Lambda veya Fly.io aracılığıyla webhook alıcısı
- Çalışan: ECS Fargate görevi (veya GitHub Actions'ın kendi kendine barındırılan çalıştırıcısı)
- Sandbox: Görev başına Daytona devcontainer veya E2B sandbox
- Agent loop: mini-swe-agent temel çizgi veya Claude Opus 4.7 / GPT-5.4-Codex üzerinden SWE-agent v2
- Alma: ağaç bakıcısı repo haritası + ripgrep
- Doğrulama: tam CI korumalı alan + kapsama delta kapısı
- Observability: PR gövdesinden bağlanan PR başına izleme arşivine sahip Langfuse
- Bütçe: repo başına günlük dolar tavanı; repo başına günlük maksimum PR

## Build It — Kendin Geliştir

1. **GitHub Uygulaması.** Ayrıntılı kurulum token: okuma+yazma sorunları, pull_requests yazma, içerik okuma+yazma, iş akışları okuma. Dal koruması (bunu yapabilen tek yüzey) " `main`'ya doğrudan gönderim yok" ve "zorla gönderim yok"u uygular; uygulama bypass listesinde değil. GitHub Uygulama izinleri yol kapsamlı olmadığından, çalışan önerilen farkta izin verilenler listesi kontrolü olarak " `.github/workflows` altında yazma yok" seçeneğini uygular.

2. **Web kancası alıcısı.** Lambda işlevi, sorun etiketi/PR yorumu web kancalarını kabul eder. `@agent fix this` etiketine göre filtreler. SQS'ye sıralanır.

3. **Gönderici.** Görevleri SQS'den açar. Repo başına günlük bütçeyi zorunlu kılar. Depo URL'si, sorun gövdesi ve yeni bir Daytona sanal alanıyla bir ECS Fargate görevini başlatır.

4. **Ortam inference.** Dili (Python, Node, Go, Rust) ve paket yöneticisini (uv, pnpm, go mod, kargo) tespit edin. Mevcut değilse, anında bir Docker dosyası oluşturun.

5. **Agent loop.** mini-swe-agent veya SWE-agent v2 ile Claude Opus 4.7. Araçlar: ripgrep, ağaç bakıcısı repo haritası, read_file, edit_file, run_tests, git. Kesin limitler: 20$ maliyet, 30 dakikalık duvar saati, 30 agent dönüş.

6. **Doğrulama.** Döngü tamamlandıktan sonra, korumalı alanda test paketinin tamamını çalıştırın. Kapsama deltasını jacoco / coverage.py aracılığıyla hesaplayın. CI kırmızıysa: durun, PR'yi açmayın. Kapsam %2'den fazla düşerse: PR'yi `needs-review` etiketiyle açın.

7. **PR gönderimi.** agent dalına basın. GitHub API aracılığıyla PR'yi şu bilgilerle açın: başlık, gerekçe, fark özeti, izleme URL'si, maliyet, dönüşler.

8. **Kimlik bilgileri hijyeni.** Çalışan, kısa ömürlü bir GitHub Uygulaması kurulumuyla token çalışır. Günlükler arşivlenmeden önce sırlar açısından temizlenir.

9. **Değerlendirme.** Değişen zorluklara sahip 30 numaralı dahili sayı. Geçiş oranını, PR kalitesini (fark boyutu, stil, kapsam), maliyeti, gecikmeyi ölçün. Aynı sorunları İmleç Arka Planı Agent'ları ve AWS Remote SWE Agent'leri ile karşılaştırın.

## Use It — Hazır Araçla Uygula

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

## Ship It — Kullanıma Sun

`outputs/skill-issue-to-pr.md` teslim edilebilirdir. Etiketli sorunları sınırlı maliyet ve kapsamlı kimlik bilgileriyle incelemeye hazır PR'lere dönüştüren bir GitHub Uygulaması + eşzamansız bulut çalışanı.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | 30 sayının geçme oranı | Uçtan uca başarı (CI yeşil + kapsama alanı tamam) |
| 20 | halkla ilişkiler kalitesi | Fark boyutu, kapsama alanı deltası, stil uyumu |
| 20 | Çözülen sorun başına maliyet ve gecikme | $ ve PR başına duvar saati |
| 20 | Güvenlik | Kapsamlı token, repo başına bütçe, zorlama yok, kimlik bilgisi hijyeni |
| 15 | Operatör Kullanıcı Deneyimi | Gerekçe yorumları, uygunluğu yeniden deneme, @-bahsetme takibi |
| **100** | | |

## Egzersizler

1. Bir "kesintili testi düzelt" modu ekleyin: `@agent stabilize-flake TestX` etiketi, testi sanal alanda 50 kez çalıştırır ve onu stabilize edecek minimum bir değişiklik önerir.

2. Paylaşılan üç sorunda maliyeti İmleç Arka Planı Agent'larla karşılaştırın. Hangi araçların nerede kazandığını bildirin.

3. Bir bütçe kontrol paneli uygulayın: repo başına günlük maliyet, kullanıcı başına maliyet. Anormallik konusunda uyarı.

4. Gözden geçirenlerin planı ucuza inceleyebilmesi için CI'yı çalıştırmadan taslak PR'yi açan bir "prova çalıştırma" modu oluşturun.

5. Saklama politikası ekleyin: Birleştirme olmadan 7 günden daha eski olan PR şubeleri otomatik olarak silinir.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| GitHub Uygulaması | "Kapsamlı bot kimliği" | Ayrıntılı izinlere ve kısa ömürlü kuruluma sahip uygulama token |
| Eşzamansız bulut agent | "Arkaplan agent" | Terminalde değil, bulut sanal alanında çalışan etkileşimli olmayan çalışan |
| Ortam inference | "Docker dosyası sentezi" | Dili + paket yöneticisini algıla, yoksa bir Docker dosyası oluştur |
| Doğrulama | "Korumalı alanda CI" | Bir PR açmadan önce, çalışanın içindeki tüm test paketini çalıştırın |
| Kapsama deltası | "Kapsama koruması" | Tabandan agent şubeye kadar test kapsamı yüzdesindeki değişiklik |
| Repo başına bütçe | "Günlük tavan" | Sevkiyatçıda uygulanan Dolar ve PR sayımı tavanı |
| Gerekçe | "PR gövde açıklaması" | Agent'nin nelerin değiştiğine ve neden değiştiğine dair özeti; PR bünyesinde gerekli |

## Daha Fazla Okuma

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — kanonik eşzamansız bulut agent referansı
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI referansı
- [İmleç Arka Planı Agents](https://docs.cursor.com/background-agent) — ticari alternatif
- [OpenAI Codex (cloud)](https://openai.com/codex) — barındırılan rakip
- [Google Jules](https://jules.google) — Google'ın barındırılan sürümü
- [Fabrika Droidleri](https://www.factory.ai) — alternatif ticari referans
- [GitHub Uygulama belgeleri](https://docs.github.com/en/apps) — kapsamlı bot kimliği
- [Daytona bulut sanal alanları](https://daytona.io) — referans sanal alanı
