# Beceriler ve Agent SDK'ları — Antropik Beceriler, AGENTS.md, OpenAI Uygulama SDK'sı

> MCP "hangi araçların mevcut olduğunu" söylüyor. Beceriler "bir görevin nasıl yapılacağını" söyler. 2026 yığın katmanlarının her ikisi de. Anthropic'in Agent Becerileri (açık standart, Aralık 2025), aşamalı açıklamalarla SKILL.md olarak gönderilir. OpenAI'nin Uygulama SDK'sı, MCP artı widget meta verileridir. AGENTS.md (şu anda 60.000'den fazla depoda), proje düzeyinde agent bağlamı olarak repo kökünde yer alıyor. Bu ders, her birinin kapsadığı konuları adlandırır ve agent'ler arasında seyahat eden minimum SKILL.md + AGENTS.md paketini oluşturur.

**Tür:** Öğren
**Diller:** Python (stdlib, SKILL.md ayrıştırıcı ve yükleyici)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Üç katmanı ayırt edin: AGENTS.md (proje bağlamı), SKILL.md (yeniden kullanılabilir teknik bilgi), MCP (araçlar).
- YAML ön maddesi ve aşamalı açıklama içeren bir SKILL.md yazın.
- Beceri dosya sistemi stilini bir agent çalışma zamanına yükleyin.
- Bir MCP sunucusu ve AGENTS.md ile bir beceri oluşturun, böylece tek bir paket Claude Code, Cursor ve Codex'te çalışır.

## Sorun

Bir mühendis, sürüm notları yazma iş akışını çok adımlı bir prompt'ye dönüştürüyor: "En son birleştirilmiş PR'leri okuyun. Alana göre gruplandırın. Her birini özetleyin. Ekibin stilini takip eden bir değişiklik günlüğü girişi yazın. Slack taslağına gönderin." Bunu ekipleri için bir Notion belgesine koydular.

Artık Claude Code, Cursor ve Codex CLI'den gelen bu iş akışını kullanmak istiyorlar. Her agent'nin talimatları yüklemenin farklı bir yolu vardır: Claude Code eğik çizgi komutları, İmleç kuralları, Codex `.codex.md`. Mühendis iş akışını üç kez kopyalar ve üç kopyasını saklar.

AGENTS.md ve SKILL.md birlikte bu sorunu düzeltir:

- **AGENTS.md** repo kökünde bulunur. Her uyumlu agent bunu oturum başlangıcında okur. "Bu proje nasıl çalışıyor? Kurallar nelerdir? Testleri hangi komutlar çalıştırır?"
- **SKILL.md** taşınabilir bir pakettir: YAML ön maddesi (ad, açıklama) + işaretleme gövdesi + isteğe bağlı kaynaklar. Becerileri destekleyen Agent'ler talep üzerine bunları ada göre yükler.
- **MCP** (Aşama 13 · 06-14), becerinin devreye girmesi için ihtiyaç duyduğu araçları yönetir.

Üç katman, bir taşınabilir artifact.

## Konsept

### AGENTS.md (agents.md)

2025'in sonlarında piyasaya sürüldü ve Nisan 2026'ya kadar 60.000'den fazla repo tarafından benimsendi. Repo kökünde tek dosya. Biçim:

```markdown
# Project: my-service

## Conventions
- TypeScript with strict mode.
- Use Pydantic for models on the Python side.
- Tests run with `pnpm test`.

## Build and run
- `pnpm dev` for local dev server.
- `pnpm build` for production bundle.
```

Agent'ler oturum başlangıcında bunu okur ve o proje için davranışlarını kalibre etmek için kullanır. 2026'daki her agent kodlaması AGENTS.md'yi destekler: Claude Code, Cursor, Codex, Copilot Workspace, opencode, Windsurf, Zed.

### SKILL.md biçimi

Anthropic'in Agent Becerileri (Aralık 2025'te açık standart olarak yayınlandı):

```markdown
---
name: release-notes-writer
description: Write a changelog entry for the latest merged PRs following this project's style.
---

# Release notes writer

When invoked, run these steps:

1. List PRs merged since the last tag. Use `gh pr list --base main --state merged`.
2. Group by label: feature, fix, chore, docs.
3. For each PR in each group, write one line: `- <title> (#<num>)`.
4. Draft the release notes and stage them in CHANGELOG.md.

If the user says "ship", run `git tag vX.Y.Z` and `gh release create`.

## Notes

- Never include commits without a PR.
- Skip "chore" entries from the public changelog.
```

Frontmatter becerinin kimliğini bildirir. Gövde, beceri yüklendiğinde modele gösterilen prompt'dir.

### Aşamalı açıklama

Beceriler, agent'nin yalnızca gerektiğinde getirdiği alt kaynaklara başvurabilir. Örnek:

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md "stil kuralları için stil-guide.md'ye bakın" diyor. agent, stil-guide.md'yi yalnızca beceri aktif olarak çalışırken çeker. Bu, prompt'nin modelin ihtiyaç duymayabileceği ayrıntılarla şişirilmesini önler.

### Dosya sistemi keşfi

Agent çalışma zamanları, SKILL.md dosyaları için bilinen dizinleri tarar:

- `~/.anthropic/skills/*/SKILL.md`
- `./skills/*/SKILL.md` Projesi
- `~/.claude/skills/*/SKILL.md`

Yükleme, klasör adı ve ön madde `name`'ye göre yapılır. Claude Code, Anthropic Claude Agent SDK ve SkillKit (cross-agent) hepsi bu modeli takip ediyor.

### Antropik Claude Agent SDK

`@anthropic-ai/claude-agent-sdk` (TypeScript) ve `claude-agent-sdk` (Python) becerileri oturum başlangıcında yükler ve bunları çalışma zamanı içinde çağrılabilir "agent'ler" olarak kullanıma sunar. agent loop, kullanıcı onu çağırdığında bir beceriyi gönderir.

### OpenAI Uygulama SDK'sı

Ekim 2025'te piyasaya sürüldü; doğrudan MCP üzerine inşa edilmiştir. OpenAI'nin önceki Bağlayıcılarını ve Özel GPT Eylemlerini tek bir geliştirici yüzeyi altında birleştirir. Bir Apps SDK uygulaması:

- Bir MCP sunucusu (araçlar, kaynaklar, prompt'ler).
- Ayrıca ChatGPT'nin kullanıcı arayüzü için widget meta verileri.
- Ayrıca etkileşimli yüzeyler için isteğe bağlı bir MCP Uygulamaları `ui://` kaynağı.

Aynı protokol, daha zengin kullanıcı deneyimi.

### SkillKit aracılığıyla çapraz agent taşınabilirliği

SkillKit ve benzer çapraz agent dağıtım katmanları gibi araçlar, tek bir SKILL.md'yi 32'den fazla AI agent'nin (Claude Code, Cursor, Codex, Gemini CLI, OpenCode vb.) her birinin yerel formatına dönüştürür. Gerçeğin tek kaynağı; birçok tüketici.

### Üç katmanlı yığın

| Katman | Dosya | Ne zaman yüklendi | Amaç |
|-------|------|-------------|---------|
| AGENTS.md | repo kökü | oturum başlangıcı | proje düzeyinde toplantılar |
| SKILL.md | beceriler dizini | beceri çağrıldı | yeniden kullanılabilir iş akışı |
| MCP sunucusu | harici süreç | gerekli aletler | çağrılabilir eylemler |

Üçü de oluşur: agent, oturum başlangıcında AGENTS.md'yi okur, kullanıcı bir beceriyi çağırır, becerinin talimatları MCP aracı çağrılarını içerir, agent bir MCP istemcisi aracılığıyla gönderim yapar.

## Kullan onu

`code/main.py` bir stdlib SKILL.md ayrıştırıcı ve yükleyici gönderir. `./skills/` altındaki becerileri keşfeder, YAML ön maddesini artı işaretleme gövdesini ayrıştırır ve beceri adına göre anahtarlanan bir dikte üretir. Daha sonra `release-notes-writer`'yi ismine göre çağıran bir agent loop'yi simüle eder.

Neye bakmalı:

- YAML ön maddesi minimum stdlib ayrıştırıcıyla ayrıştırıldı (`pyyaml` bağımlılığı yok).
- Beceri gövdesi kelimesi kelimesine depolanır; agent, çağrı sırasında onu prompt sisteminin başına ekler.
- Başvurulan dosyaları talep üzerine çeken bir `read_subresource` işlevi aracılığıyla aşamalı açıklama gösterimi yapıldı.

## Gönderin

Bu ders `outputs/skill-agent-bundle.md`'yi üretir. Bir iş akışı göz önüne alındığında, beceri, agent'ler arasında taşınabilir, birleşik SKILL.md + AGENTS.md + MCP-sunucu-plan paketini üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. `skills/` altına ikinci bir beceri ekleyin ve yükleyicinin onu aldığını onaylayın.

2. Bu ders deposu için bir AGENTS.md yazın. Test komutlarını, stil kurallarını ve Aşama 13 zihinsel modelini ekleyin.

3. Ekibinizin dahili dokümanlarından çok adımlı bir iş akışını SKILL.md'ye taşıyın. Claude Koduna yüklendiğini doğrulayın.

4. Beceriyi Cursor'un ve Codex'in yerel kural formatlarına elle çevirin. Formatlar arasındaki farkı sayın; bu, SkillKit'in otomatikleştirdiği çeviri yüzeyidir.

5. Antropik Agent Beceriler blog yazısını okuyun. Claude Agent SDK'sında bu dersin yükleyicisinin kapsamadığı bir özelliği tanımlayın. (İpucu: agent alt çağrımı.)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| SKILL.md | "Beceri dosyası" | YAML ön maddesi artı işaretleme gövdesi, agent çalışma zamanı tarafından yüklendi |
| AGENTS.md | "Repo-root agent bağlamı" | Oturum başlangıcında okunan proje düzeyindeki kurallar dosyası |
| Aşamalı açıklama | "Tembel yükleme alt kaynakları" | Beceri gövdesi, yalnızca ihtiyaç duyulduğunda çekilen dosyalara referans verir |
| Ön Madde | "YAML bloğu üstte" | `---` sınırlayıcılardaki meta veriler (ad, açıklama) |
| Claude Agent SDK'sı | "Anthropic'in beceri çalışma zamanı" | `@anthropic-ai/claude-agent-sdk`, becerileri ve rotaları yükler |
| OpenAI Uygulama SDK'sı | "MCP + widget metası" | OpenAI'nin MCP ve ChatGPT kullanıcı arayüzü kancaları üzerine kurulu geliştirme yüzeyi |
| Beceri keşfi | "Dosya sistemi taraması" | SKILL.md için bilinen dizinleri yürüyün, ada göre anahtar |
| Çapraz agent taşınabilirlik | "Bir beceri birçok agent" | SkillKit tarzı araçlarla bir SKILL.md'yi 32'den fazla agent'ye çevirin |
| Agent Beceri | "Taşınabilir teknik bilgi" | MCP'nin araç konsepti dışında yeniden kullanılabilir görev şablonu |
| Uygulama SDK'sı | "MCP artı ChatGPT kullanıcı arayüzü" | Konektörler ve Özel GPT'ler MCP'de birleştirildi |

## Daha Fazla Okuma

- [Antropik — Agent Beceri duyurusu](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — Aralık 2025 lansmanı
- [Antropik — Agent Beceri belgeleri](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md biçim referansı
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — ChatGPT için MCP tabanlı geliştirici platformu
- [agents.md](https://agents.md/) — AGENTS.md formatı ve benimseme listesi
- [Antropik — antropik/beceri GitHub](https://github.com/anthropics/skills) — resmi beceri örnekleri
