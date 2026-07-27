# Bitirme Taşı 01 — Terminal-Yerel Kodlama Agent

> 2026 yılına gelindiğinde agent kodlamasının şekli belirlenecek. Bir TUI koşum takımı, durum bilgisi olan bir plan, korumalı alana alınmış bir araç yüzeyi, planlayan, hareket eden, gözlemleyen, kurtaran bir döngü. Claude Code, Cursor 3 ve OpenCode'un tümü 15 metreden aynı görünüyor. Bu kapsül sizden bir uçtan uca oluşturmanızı (CLI girişi, çekme isteği) ve bunu SWE-bench Pro'da mini-swe-agent ve Live-SWE-agent ile ölçmenizi ister. 50 turluk bir çalıştırmada zor kısmın neden model çağrısı değil de takım döngüsü, korumalı alan ve maliyet tavanı olduğunu öğreneceksiniz.

**Tür:** Kapak taşı
**Diller:** TypeScript / Bun (koşum), Python (değerlendirme komut dosyaları)
**Önkoşullar:** Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar ve protokoller), Aşama 14 (agent'lar), Aşama 15 (otonom sistemler), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Süre:** 35 saat

## Sorun

Kodlama agent'lar 2026'da baskın yapay zeka uygulama kategorisi haline geldi. Claude Code (Antropik), Composer 2 ile İmleç 3 ve Agent Sekmeleri (İmleç), Amp (Sourcegraph), OpenCode (112k yıldız), Fabrika Droidleri ve Google Jules'un tümü aynı mimarinin çeşitlerini sunar: bir terminal kablo demeti, izin verilen bir araç yüzeyi, bir korumalı alan ve bir sınır etrafında inşa edilmiş bir plan-harekete geç-gözlem döngüsü modeli. Sınır dar - Live-SWE-agent Opus 4.5 ile Doğrulanan SWE-bench'te %79,2'ye ulaştı - ancak mühendislik zanaatı geniş. Çoğu arıza türü model hatası değildir. Bunlar, araç döngüsü kararsızlığı, bağlam zehirlenmesi, kontrolden çıkan token maliyeti ve yıkıcı dosya sistemi işlemleridir.

Bu agent'lar hakkında dışarıdan mantık yürütemezsiniz. Bir tane oluşturmanız, ripgrep 8 MB eşleşme döndürdüğünde 47. virajda döngünün çökmesini izlemeniz ve kesme katmanını yeniden oluşturmanız gerekir. Bu kapak taşının amacı budur.

## Konsept

Emniyet kemerinin dört yüzeyi vardır. **Plan**, modelin her turda yeniden yazdığı TodoWrite tarzı bir durum nesnesini korur. **Act** araç çağrılarını (okuma, düzenleme, çalıştırma, arama, git) gönderir. **Observe** stdout / stderr / çıkış kodlarını yakalar, keser ve özeti geri gönderir. **Kurtarma**, takım hatalarını context window'yi bozmadan veya sürekli döngüye girmeden yönetir. 2026 şekli bir şey daha ekliyor: **kancalar**. `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Notification`, `Stop` ve `PreCompact` — operatörün politika, telemetri ve korkulukları eklediği yapılandırılabilir uzatma noktaları.

Korumalı alan E2B veya Daytona'dır. Her görev, git çalışma ağacına monte edilmiş okuma-yazma içeren yeni bir geliştirme kapsayıcısında çalışır. Kablo demeti hiçbir zaman ana dosya sistemine dokunmaz. Başarı ya da başarısızlık durumunda çalışma ağacı yıkılır. Maliyet kontrolü üç katmanda uygulanır: tur başına token tavan, oturum başına dolar bütçesi ve kesin dönüş sınırı (tipik olarak 50). observability katmanı, kendi kendine barındırılan bir Langfuse'a gönderilen, GenAI semantik kurallarına sahip OpenTelemetry'dir.

## Mimarlık

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## Yığın

- Donanım çalışma zamanı: Bun 1.2 + Mürekkep 5 (Terminalde Tepki)
- Model erişimi: Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 ile OpenRouter birleştirilmiş API (en zor görevler için)
- Araç aktarımı: Model Bağlam Protokolü StreamableHTTP (MCP 2026 revizyonu)
- Korumalı alan: E2B sanal alanları (JS SDK) veya Daytona dev kapsayıcıları
- Kod arama: ripgrep alt işlemi, 17 dil için ağaç bakıcısı ayrıştırıcıları (önceden derlenmiş)
- İzolasyon: Görev başına `git worktree add` , başarı/başarısızlık durumunda temizlik
- Değerlendirme donanımı: SWE-bench Pro (doğrulanmış alt küme) + Terminal-Bench 2.0 + kendi 30 görevlik süreniz
- Observability: `gen_ai.*` semconv → kendi kendine barındırılan Langfuse ile OpenTelemetry SDK'sı
- PR yayınlama: Ayrıntılı token içeren GitHub Uygulaması, kapsam hedef depoyla sınırlıdır

## Build It — Kendin Geliştir

1. **TUI ve komut döngüsü.** Mürekkep ile bir Bun projesinin iskelesini oluşturun. `agent run <repo> "<task>"`'yi kabul et. Bölünmüş bir görünüm yazdırın: plan bölmesi (üstte), araç çağrısı akışı (ortada), token bütçe (altta). Çıkıştan önce `SessionEnd` kancasını ateşleyen Ctrl-C'ye iptal ekleyin.

2. **Plan durumu.** Yazılı bir TodoWrite şeması tanımlayın (notlarla birlikte beklemede / ilerleme aşamasında / tamamlanan öğeler). Model, her turda bir araç çağrısı olarak tam durumu yeniden yazar; artımlı olarak değişmesine izin vermeyin. Kilitlenmelerin devam edebilmesi için `.agent/state.json` planına devam edin.

3. **Araç yüzeyi.** Altı araç tanımlayın: `read_file`, `edit_file` (fark önizlemesi ile), `ripgrep`, `tree_sitter_symbols`, `run_shell` (zaman aşımı ile), `git` (durum / fark / taahhüt / push). Kablo demetinin aktarımdan bağımsız olması için MCP StreamableHTTP üzerinden gösterin. Her araç kesik çıktı döndürür (çağrı başına 4k tokens sınırı).

4. **Korumalı alan sarma.** Her görev bir E2B korumalı alanı oluşturur. `git worktree add -b agent/$TASK_ID` yeni bir dal. Tüm araç çağrıları korumalı alanın içinde yürütülür. Ana bilgisayar dosya sistemine erişilemiyor.

5. **Kancalar.** Sekiz 2026 kanca türünün tamamını uygulayın. Kullanıcı tarafından yazılan en az dört kanca bağlayın: (a) `PreToolUse` çalışma ağacının dışında `rm -rf` 'yi engelleyen yıkıcı komut koruması, (b) `PostToolUse` token muhasebe, (c) `SessionStart` bütçe başlatma, (d) `Stop` son bir izleme paketi yazar.

6. **Döngüyü değerlendir.** SWE-bench Pro Python'un 30 sayılık bir alt kümesini klonlayın. Koşumunuzu her birine karşı çalıştırın. pass@1, görev başına dönüş ve görev başına $ mini-swe-agent (minimum temel) ile karşılaştırın. Sonuçları `eval/results.jsonl`'a yazın.

7. **Maliyet kontrolü.** Kesin kesintiler: 50 dönüş, 200 bin bağlam, görev başına 5 ABD doları. `PreCompact` kancası, eski dönüşleri 150k işaretindeki önceki durum bloğuna özetleyerek planı kaybetmeden yeni gözlemler için yer açar.

8. **PR yayınlama.** Başarı durumunda, son adım `git push` + gövdede plan ve fark özetini içeren bir PR açan bir GitHub API çağrısıdır.

## Use It — Hazır Araçla Uygula

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## Ship It — Kullanıma Sun

Teslim edilebilir beceri `outputs/skill-terminal-coding-agent.md`'da yaşıyor. Bir repo yolu ve görev açıklaması verildiğinde, bir sanal alanda tam planla-harekete geç-gözlemle döngüsünü çalıştırır ve bir PR URL'si ile bir izleme paketi döndürür. Bu kapak taşının değerlendirme listesi:

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 ile temel çizgi karşılaştırması | 30 eşleşen Python görevinde koşum takımınız mini-swe-agent ile karşılaştırıldı |
| 20 | Mimari netlik | Planla/harekete geç/gözlemle ayırma, kanca yüzeyi, araç şeması — Live-SWE-agent düzenine göre gözden geçirildi |
| 20 | Güvenlik | Sandbox kaçış testleri, izin prompt'lar, yıkıcı komut koruması kırmızı takımı geçti |
| 20 | Observability | İzlemenin tamlığı (araç çağrılarının %100'ü yayıldı), tur başına token hesaplama |
| 15 | Geliştirici Kullanıcı Deneyimi | Soğuk başlatma < 2 saniye, kilitlenme kurtarma planı devam ediyor, Ctrl-C orta aracı temiz bir şekilde iptal ediyor |
| **100** | | |

## Egzersizler

1. Destek modelini Claude Sonnet 4.7'den vLLM'de sunulan Qwen3-Coder-30B'ye değiştirin. pass@1 ve $-per-task'ı karşılaştırın. Açık modelin nerede düşük performans gösterdiğini bildirin.

2. PR gönderiminden önce farkı okuyan ve bir revizyon döngüsü talep edebilen bir `reviewer` alt-agent ekleyin. Yanlış pozitif incelemelerin SWE karşılaştırmalı geçiş oranını tek-agent temel çizgisinin altına düşürüp düşürmediğini ölçün (ipucu: genellikle evet).

3. Korumalı alana stres testi yapın: harici bir URL'yi `curl` deneyen bir görev ve çalışma ağacının dışına yazan bir görev yazın. Her ikisinin de PreToolUse kancası tarafından engellendiğini doğrulayın. Denemeleri günlüğe kaydedin.

4. `PreCompact` özetlemesini daha küçük bir modelle uygulayın (Haiku 4.5). 3x sıkıştırmada plan doğruluğunun ne kadar kaybolduğunu ölçün.

5. MCP StreamableHTTP aktarımını stdio ile değiştirin. Benchmark soğuk başlangıç ​​ve çağrı başına gecikme. Yalnızca yerel kullanım için bir kazanan seçin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| koşum takımı | "agent loop" | Araçları gönderen, plan durumunu koruyan ve bütçeleri uygulayan modeli çevreleyen kod |
| Kanca | "Agent olay dinleyicisi" | Kullanıcı tarafından yazılan bir komut dosyası, emniyet kemeri tarafından sekiz yaşam döngüsü olayından birinde çalıştırılır |
| Çalışma Ağacı | "Git korumalı alanı" | Ayrı bir yolda bağlantılı bir git ödemesi; ana klona dokunmadan tek kullanımlık |
| TodoWrite | "Plan durumu" | Modelin her turda yeniden yazdığı, bekleyen/devam eden/tamamlanan öğelerin yazılı listesi |
| YayınlanabilirHTTP | "MCP aktarımı" | 2026 MCP revizyonu: çift yönlü akışla uzun ömürlü HTTP bağlantısı; SSE'nin yerini alıyor |
| Token tavan | "Bağlam bütçesi" | Giriş+çıkış tokens'de tur başına veya oturum başına sınır; sıkıştırmayı veya sonlandırmayı tetikler |
| geçiş@1 | "Tek denemede geçiş hızı" | SWE-bench görevlerinin bir kısmı, yeniden denemeye veya test setine göz atmaya gerek kalmadan ilk çalıştırmada çözüldü |

## Daha Fazla Okuma

- [Claude Code belgeleri](https://docs.anthropic.com/en/docs/claude-code) — Anthropic'ten referans koşum takımı
- [İmleç 3 değişiklik günlüğü](https://cursor.com/changelog) — Agent Sekmeler ve Composer 2 ürün notları
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) — SWE-bench koşum takımı karşılaştırması için minimum temel çizgi
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) — %79,2 SWE-bench, Opus 4.5 ile Doğrulandı
- [OpenCode](https://opencode.ai) — açık koşum takımı, 112k yıldız
- [SWE-bench Pro lider tablosu](https://www.swebench.com) — bu kapsülün hedeflediği değerlendirme
- [Model Context Protokol 2026 yol haritası](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP, yetenek meta verileri
- [OpenTelemetry GenAI anlam kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — araç çağrıları ve token kullanımı için yayılma şeması
