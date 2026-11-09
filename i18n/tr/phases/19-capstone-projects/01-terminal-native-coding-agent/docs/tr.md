# Capstone 01  Terminal-Native Coding Ajanı

> 2026 yılına kadar kodlama ajanının şekli belirlenmiş olacak. Bir TUI harnası, bir durumlu plan, kum kutulu bir alet yüzeyi, planlayan, hareket eden, gözlemleyen, geri kazanan bir döngü. Claude Code, Cursor 3, ve OpenCode, 50 metrelik mesafede aynı görünüyor. Bu son taşı, bir sonun sonunu oluşturmanızı,  CLI'yi içeri almanı,  talebi çekmenizi ve SWE-bench Pro'da mini-swe-agent ve Live-SWE-agent ile karşılaştırmanıızı ister. Neden zor olan şey model çağrısı değil, araç döngüsü, kum kutu ve 50 dönüşte maliyet tavanı olduğunu öğreneceksiniz.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## Sorun

Kodlama ajanları 2026'da baskın AI uygulama kategorisine dönüştü. Claude Code (Anthropic), Composer 2 ve Agent Tabs (Cursor), Amp (Sourcegraph), OpenCode (112k yıldız), Factory Droids ve Google Jules ile birlikte aynı mimari türlerinin tümü: bir terminal harness, izin verilen bir araç yüzeyi, bir kum kutusu ve bir sınır modeli etrafında inşa edilmiş bir plan-iş-kuyuş döngüsü. Sınır dar  Live-SWE-agent SWE-benç üzerinde 79.2% ulaştı Opus 4.5  ile doğrulanmış ancak mühendislik meslek geniş. Başarısız modların çoğu model hataları değildir. Bunlar araç döngüsü istikrarsızlığı, bağlam zehirlenmesi, kaçak token maliyeti ve yıkıcı dosya sistemleri operasyonları.

Bu ajanlar hakkında dışarıdan düşünemezsin. Bir tane inşa etmelisin, ripgrep'in 8 MB eşyaları geri verdiği zaman 47'li virajda döngü çöküşünü izleyip, kesim katmanını yeniden inşa etmelisin.

## Anlam

Harnesin dört yüzeyi var.**Plan**modelin her dönüşü yeniden yazması TodoWrite tarzında bir durum nesnesini sürdürür. **Act**araç çağrılarını gönderir (okuru, düzenleme, çalıştırma, arama, git). **Observe**stdout / stderr / çıkış kodlarını yakalar, kısaltır ve özetini geri gönderir. **Recover**2026 şekli bir şey daha ekler: **hooks**- Evet .`PreToolUse`- Evet .`PostToolUse`- Evet .`SessionStart`- Evet .`SessionEnd`- Evet .`UserPromptSubmit`- Evet .`Notification`- Evet .`Stop`ve`PreCompact` Operatörün politika, telemetri ve koruma rayları enjekte ettiği yapılandırılabilir uzatma noktaları.

Kum kutusu E2B veya Daytona. Her görev git iş ağacı monte edilmiş okuma yazısı ile yeni bir devcontainer'de çalışır. Harness, ev sahibi dosya sistemine asla dokunmaz. İş ağacı başarısızlık ya da başarısızlıktan dolayı yıkılır. Masraf kontrolü üç katmanla uygulanır: bir dönüş için bir token tavanı, bir seans başına bir dolar bütçesi ve sert bir dönüş sınırı (genellikle 50). Gözlem yapabilme katmanı, kendi kendine barındırılan Langfuse'ye gönderilen GenAI semantik sözleşmeleri ile OpenTelemetry kapsamıdır.

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

## Yüküm

- Harness çalışması süresi: Bun 1.2 + Ink 5 (Terminal'da reaksiyon)
- Modelle erişim: Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (en zor görevler için) ile OpenRouter birleşik API
- Araç taşımacılığı: Modelle Kontext Protocol StreamableHTTP (MCP 2026 reviziyonu)
- Kum Kutusu: E2B kum kutusu (JS SDK) veya Daytona dev konteynerleri
- Kod arama: ripgrep alt işlem, 17 dil için ağaç bakıcı parserler (önceden oluşturulmuş)
- İzolasyon: `git worktree add`Görev başına, başarısızlık / başarısızlık üzerine temizlik
- Eval harness: SWE-bench Pro (verified subset) + Terminal-Bench 2.0 + kendi 30 görev tutma
- Gözlem: OpenTelemetry SDK ile `gen_ai.*`semconv → kendi kendine barındırılan Langfuse
- PR yayınlaması: GitHub uygulaması ince topuzlu token, hedef repo ile sınırlı alan

```figure
ce-agent-loop
```

## Yapın

1. **TUI and command loop.**Bun projesini mürekkeple hazırla.`agent run <repo> "<task>"`. Bölünmüş bir görüntü yazdır: plan paneli (yukarı), araç çağrı akışı (orta), simge bütçesi (altı). Çıkaran Ctrl-C ' de iptal ekleyin `SessionEnd`Çıkıştan önce kaçağı.

2. **Plan state.**Tiplenen TodoWrite şeması tanımlayın (bekleyen / in_progress / notlarla tamamlanmış öğeler). Model her dönüşte tam durumu bir araç çağrısı olarak yeniden yazar  onu artarak mutasyon yapmaya izin vermeyin.`.agent/state.json`Böylece kazalar tekrar başlayabilir.

3. **Tool surface.**Altı alet tanımlayın: `read_file`- Evet .`edit_file`(farklı bir ön izleyici ile),`ripgrep`- Evet .`tree_sitter_symbols`- Evet .`run_shell`(zamanla),`git`(status / diff / commit / push). MCP StreamableHTTP üzerinden kullanın, böylece harness ulaşım-agnostiktir. Her araç kısaltılmış çıkış gönderir (sırhı her çağrıda 4k tokenler).

4. **Sandbox wrapping.**Her görev bir E2B kum kutusu doğurur. `git worktree add -b agent/$TASK_ID`Tüm araç çağrıları kum kutusunun içinde yürütülür.

5. **Hooks.**2026'da tüm sekiz hok türünü uygulayın. Kullanıcı tarafından onaylanan en az dört hok örgütü: (a) `PreToolUse`Yıkıcı komutanlık korumaları ki bloklar.`rm -rf`İş ağacının dışında, (b) `PostToolUse`İşaretli muhasebe, (c) `SessionStart`Bütçe başlangıcı, (d) `Stop`Son iz paketini yazıyor.

6. **Eval loop.**SWE-bench Pro Python'un 30 sayıdaki alt kümesini klon edin. Harnesinizi her birine karşı çalıştırın. Mini-swe-agent (minimal temel çizgi) ile pas@1, turn-per-task ve $-per-task'ta karşılaştırın. Sonuçları yazın `eval/results.jsonl`- Evet .

7. **Cost control.**Zor kesintiler: 50 dönüş, 200 bin bağlam, görev başına 5 dolar.`PreCompact`Hook, eski dönüşleri 150k noktasında bir ön devlet blokuna dönüştürerek, planı kaybetmeden yeni gözlemler için yer açıyor.

8. **PR posting.**Başarı için son adım `git push`+ GitHub API çağrısı, plan ve farklılık özetini oluşturan bir PR açar.

## Kullan

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

## Gönder

Bu yetenekler içinde yaşıyor .`outputs/skill-terminal-coding-agent.md`. Bir repo yolu ve görev açıklaması verildiğinde, tüm plan-iş-kuyuş izleme döngüsünü bir kum kutusunda çalıştırır ve bir PR URL'i ekliyor.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## Egzersizler

1. Claude Sonnet 4.7'den vLLM'de hizmet veren Qwen3-Coder-30B'ye destekleme modelini değiştirin. Pass@1 ve $-per-task ile karşılaştırın. Açık modelin düşük performans gösterdiği yerleri rapor edin.

2. Bir ekle`reviewer`PR yayınlamadan önce farkı okuyan ve bir inceleme döngüsünü isteyebilen alt ajan. Yanlış olumlu incelemelerin SWE-benç geçiş oranının tek ajanın başlangıç çizgisinden aşağı düşüp düşmediğini ölç (sunuç: genellikle evet).

3. Sandbox'u stres testi yap: denediği bir görev yaz `curl`Bir dış URL ve iş ağacının dışında yazılan bir görev. İkisinin de PreToolUse hok tarafından engellendiğini onaylayın. Denemeleri kaydet.

4. Uygulama`PreCompact`Daha küçük bir modelle özetleme (Haiku 4.5). 3x sıkıştırma ile plan sadakati ne kadar kaybolduğunu ölçün.

5. Studio için MCP StreamableHTTP taşımacılığını değiştirin. Soğuk başlangıç ve çağrılardaki gecikme oranını gösterin. Sadece yerel kullanım için bir kazanan seçin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## Daha Fazla Okumak

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) Anthropic'den referans harnes
- [Cursor 3 changelog](https://cursor.com/changelog) Ajan Tabs ve Kompozisyon 2 ürün notları
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) SWE-benç harnası karşılaştırması için minimum başlangıç çizgisi
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79.2% SWE-benç Opus 4.5 ile doğrulanmış
- [OpenCode](https://opencode.ai) açık harman, 112k yıldız
- [SWE-bench Pro leaderboard](https://www.swebench.com) bu temel hedeflerin değerlendirilmesi
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) StreamableHTTP, kapasite metadata
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) Araç çağrıları ve simge kullanımı için uzantı şeması
