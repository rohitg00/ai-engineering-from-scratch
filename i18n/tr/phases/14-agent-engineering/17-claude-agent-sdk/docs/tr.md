# Harness Bir Kütüphanede  Subagents ve Session Store

> İçeri girebileceğiniz bir harness: yerleşik araçlar, bağlam izolasyonu için alt kaynaklar, haklar, W3C iz yayılması, oturum kalıcılığı. Claude Agent SDK referans örneğidir  Claude Code harness kütüphane biçimi  ve Claude Managed Agents uzun süreli asinkür çalışma için barındırılan alternatifdir.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Anthropic Client SDK (Hem API) ile Claude Agent SDK (harness şekli) arasındaki farkı açıklayın.
- Alt kısımları  paralelleşme ve bağlam izolesi  ve onlara ne zaman ulaşacağınızı açıklayın.
- Python SDK'nin seans depolama yüzeyinin adı (`append`- Evet .`load`- Evet .`list_sessions`- Evet .`delete`- Evet .`list_subkeys`) ve `--session-mirror`- Evet .
- İçeriye yerleştirilmiş araçlarla bir stdlib harnesini, izole konekstli subagent spawning, yaşam döngüsü hakları ve bir seans mağazası uygulayın.

## Sorun

Çöm LLM API'si size bir dönüş yolculuğu sağlar. Bir üretim ajansı araç yürütme, MCP sunucular, yaşam döngüsü hakları, subagent doğurma, oturum devamlılığı, iz yayılması gerekir. Claude Agent SDK bu şekli bir kütüphane olarak gönderir  aynı harness Claude Code kullanır, özel ajanslar için açıktır.

## Anlaşım

### Müşteri SDK vs. Ajan SDK

- **Client SDK (`anthropic`).**Çubuk, araçlar, devletin sahibi sensin.
- **Agent SDK (`claude-agent-sdk`).**Ekipleşmiş araç yürütme, MCP bağlantıları, haklar, subagent doğurma, seans depolama.

### İçinde yerleştirilmiş araçlar

SDK, 10+ araç gönderir: dosya okuma/yazma, shell, grep, glob, web getch, daha fazlası.

### Altınlık

Anthropic tarafından belgelenen iki amaç:

1. **Parallelization.**"Bu 20 modülün her biri için test dosyasını bul" 20 paralel alt görevdir.
2. **Context isolation.**Subagents kendi bağlam penceresini kullanır; yalnızca sonuçlar orkestrere döner.

Python SDK son eklemeler: `list_subagents()`- Evet .`get_subagent_messages()`-Sübagent transkriptleri okumak için.

### Oturum mağazası

TypeScript ile protokol paritesi:

- `append(session_id, message)` bir dönüş ekleyin.
- `load(session_id)`- Konuşmayı yeniden başlat.
- `list_sessions()` Sayım.
- `delete(session_id)` subagent seanslar için kaskadal.
- `list_subkeys(session_id)` listesi alt anahtarlar.

`--session-mirror`(CLI bayrağı) defogü için, transkripti dışarıdan bir dosyaya akıtırken yansıtır.

### Çakmaklar

Kaydetmek için yaşam döngüsü hakları:

- `PreToolUse`- Evet .`PostToolUse` Kapı veya denetim aracı çağrıları.
- `SessionStart`- Evet .`SessionEnd` kurup yıkmak.
- `UserPromptSubmit` model onu görmeden önce kullanıcı girişine hareket et.
- `PreCompact` bağlam sıkıştırılmadan önce çalıştırılsın.
- `Stop`- Ajan çıkışında temizlik.
- `Notification` Yan kanal uyarıları.

Haklar, pro-iş akışı (Fase 14 ders programı referansı) ve benzer sistemlerin çapraz davranışlar eklemesidir.

### W3C izleme bağlamı

Çağrıda aktif olan OTel uzantıları W3C iz bağlam başlıkları üzerinden CLI alt işlemine yayılır.

### Claude Ajanları Yönetti

Ev sahipliği altyapısı (beta başlığı `managed-agents-2026-04-01`Uzun süreli asynk çalışması, yerleşik hızlı önbelleğe, yerleşik sıkıştırma, yönetilen altyapı için ticaret kontrolü.

### Bu kalıp yanlış gittiğinde

- **Subagent over-spawn.**100 küçük görev için 100 alt çekim üretiyor.
- **Hook creep.**Her takım, her üç ayda bir kaçağı, başlangıç zamanı balonları, kaçağı incelemektedir.
- **Session bloat.**Oturumlar biriktirir, boyut büyür.`list_sessions`+ Sonlama politikası.

```figure
ae-subagent-isolation
```

## Yapın

`code/main.py`stdlib'de SDK şeklini uyguluyor:

- `Tool`- Evet .`ToolRegistry`İçeriye yerleştirilmiş`read_file`- Evet .`write_file`- Evet .`list_dir`- Evet .
- `Subagent` özel bağlam, ayrı çalışmalar, sonuçlar geri döndü.
- `SessionStore` ekle, yükle, list, sil, list_subkey.
- `Hooks` `pre_tool_use`- Evet .`post_tool_use`- Evet .`session_start`- Evet .`session_end`- Evet .
- Bir demo: ana ajan paralel olarak 3 alt alt başı oluşturur (her biri ayrı), sonuçları toplar, oturumu sürdürür.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İz subagent bağlam izolesiyonunu (orchestrator bağlam boyutu sınırlı kalır), kanca yürütülmesini ve oturum devamlılığını gösterir.

## Kullan

- **Claude Agent SDK**Claude-first ürünler için Claude Code harness şeklini isteyenler için.
- **Claude Managed Agents**Ev sahipliği yapılmış uzun süreli asynk çalışması için.
- **OpenAI Agents SDK**(Disim 16) OpenAI'nin ilk eşleri için.
- **LangGraph + custom tools**Eğer bunun yerine grafik şeklinde bir devlet makinesi istiyorsanız.

## Gönder

`outputs/skill-claude-agent-scaffold.md`Claude Agent SDK uygulamasını, alt çubuklar, haklar, seans depoları, MCP sunucu eklemleri ve W3C iz yayımı ile destekler.

## Egzersizler

1. 20 görevi 5 paralel alt eşya grubuna bölünen bir subagent spawner ekleyin.
2. A.`PreToolUse`Bu oran sınırlarını bağla .`write_file`Telefonlar (5 dakikada bir seansda).
3. Kablo `list_subkeys`Derin yuvalama nasıl bir ağaç olur?
4. Oyuncakları gerçeklere getir .`claude-agent-sdk`Python paketi. Araç kayıtlarında ne değişiklikler var?
5. Claude'un yönetilen ajanlar belgeleri okuyun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## Daha Fazla Okumak

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)Claude Code'nin kütüphane biçimi
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) Üretim biçimleri
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Ev sahipliği alternatif
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) karşılama
