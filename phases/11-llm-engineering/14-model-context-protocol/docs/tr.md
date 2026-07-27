# Model Bağlam Protokolü (MCP)

> 2025'ten önce oluşturulan her LLM uygulaması kendi araç şemasını icat etti. Daha sonra Anthropic MCP'yi gönderdi, Claude onu benimsedi, OpenAI benimsedi ve 2026'ya kadar herhangi bir LLM'yi herhangi bir araca, veri kaynağına veya agent'ya bağlamak için varsayılan kablo formatı haline geldi. Bir MCP sunucusu yazın ve her ana bilgisayar onunla konuşur.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 11 · 09 (İşlev Çağrısı), Aşama 11 · 03 (Yapılandırılmış Çıkışlar)
**Süre:** ~75 dakika

## Sorun

Üç araca ihtiyaç duyan bir sohbet robotu gönderirsiniz: bir veritabanı sorgusu, bir takvim API'si ve bir dosya okuyucu. Claude için üç JSON şeması yazıyorsunuz. Daha sonra satış ekibi aynı araçları ChatGPT'de de istiyor; bunları OpenAI'nin `tools` parametresi için yeniden yazıyorsunuz. Daha sonra İmleç, Zed ve Claude Kodunu eklersiniz; her biri çok farklı JSON kurallarına sahip üç yeniden yazma işlemi daha. Bir hafta sonra Anthropic yeni bir alan ekliyor; altı şemayı güncellersiniz.

Bu 2025 öncesi gerçeklikti. Her ana bilgisayar (LLM'yi çalıştıran şey) ve her sunucu (araçları ve verileri açığa çıkaran şey) özel protokoller gönderdi. Ölçeklendirme N×M entegrasyon matrisi anlamına geliyordu.

Model Bağlam Protokolü bu matrisi daraltır. Bir JSON-RPC tabanlı spesifikasyon. Bir sunucu araçları, kaynakları ve prompt'leri açığa çıkarır. Herhangi bir uyumlu ana makine (Claude Desktop, ChatGPT, Cursor, Claude Code, Zed ve agent framework'lardan oluşan uzun bir kuyruk) bunları özel yapıştırıcı olmadan keşfedebilir ve çağırabilir.

2026'nın başlarından itibaren MCP, büyük üç (Anthropic, OpenAI, Google) ve tüm önemli agent koşum takımı genelinde varsayılan araç ve bağlam protokolüdür.

## Konsept

![MCP: bir ana bilgisayar, bir sunucu, üç yetenek](../assets/mcp-architecture.svg)

**Üç temel öğe.** Bir MCP sunucusu tam olarak üç şeyi açığa çıkarır.

1. **Araçlar** — modelin çağırabileceği işlevler. OpenAI'nin `tools` veya Anthropic'in `tool_use` analogu. Her birinin bir adı, açıklaması, JSON Şeması girişi ve bir işleyicisi vardır.
2. **Kaynaklar** — modelin veya kullanıcının isteyebileceği salt okunur içerik (dosyalar, veritabanı satırları, API yanıtları). URI tarafından adreslendi.
3. **Prompts** — kullanıcının kısayol olarak çağırabileceği yeniden kullanılabilir şablonlu prompt'ler.

**Kablo biçimi.** Stdio, WebSocket veya akışlı HTTP üzerinden JSON-RPC 2.0. Her mesaj `{"jsonrpc": "2.0", "method": "...", "params": {...}, "id": N}`'dır. Keşif yöntemleri şunlardır: `tools/list`, `resources/list`, `prompts/list`. Çağırma yöntemleri şunlardır: `tools/call`, `resources/read`, `prompts/get`.

**Ana bilgisayar, istemci ve sunucu.** Ana makine, LLM uygulamasıdır (Claude Desktop). İstemci, ana bilgisayarın tam olarak tek bir sunucuyla konuşan bir alt bileşenidir. Sunucu sizin kodunuzdur. Bir ana bilgisayar aynı anda birçok sunucuyu bağlayabilir.

### El sıkışma

Her oturum `initialize` ile açılır. İstemci protokol sürümünü ve yeteneklerini gönderir. Sunucu, sürümü, adı ve desteklediği yetenek kümesiyle yanıt verir (`tools`, `resources`, `prompts`, `logging`, `roots`). Bundan sonraki her şey bu yeteneklere göre müzakere edilir.

### MCP ne değildir?

- Alma API'si değil. RAG (Aşama 11 · 06) hala ne çekeceğine karar veriyor; MCP, alma sonuçlarını kaynak olarak göstermeye yönelik aktarımdır.
- agent framework değil. MCP sıhhi tesisattır; frameworkLangGraph, PydanticAI ve OpenAI Agent'nin SDK'sı gibiler bunun üzerinde yer alır.
- Anthropic'e bağlı değil. Spesifikasyon ve referans uygulamaları, `modelcontextprotocol` organizasyonu altında açık kaynaktır.

## İnşa Et

### Adım 1: minimal bir MCP sunucusu

Resmi Python SDK'sı `mcp`'dır (eski adıyla `mcp-python`). Yüksek seviyeli `FastMCP` yardımcısı, işleyicileri dekore eder.

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b

@mcp.resource("config://app")
def app_config() -> str:
    """Return the app's current JSON config."""
    return '{"env": "prod", "region": "us-east-1"}'

@mcp.prompt()
def code_review(language: str, code: str) -> str:
    """Review code for correctness and style."""
    return f"You are a senior {language} reviewer. Review:\n\n{code}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

Üç dekoratör üç ilkelin kaydını tutuyor. Tür ipuçları, ana bilgisayarın gördüğü JSON Şeması haline gelir. Sunucu girişi bu dosyayı işaret edecek şekilde Claude Masaüstü veya Claude Kodu altında çalıştırın.

### Adım 2: Bir ana bilgisayardan MCP sunucusunun çağrılması

Resmi Python istemcisi JSON-RPC'yi konuşur. Bunu Anthropic SDK ile eşleştirmek bir düzine satır gerektirir.

```python
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp import ClientSession

params = StdioServerParameters(command="python", args=["server.py"])

async def call_add(a: int, b: int) -> int:
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            result = await session.call_tool("add", {"a": a, "b": b})
            return int(result.content[0].text)
```

`session.list_tools()`, LLM'nin göreceği şemanın aynısını döndürür. Üretim ana bilgisayarları bu şemaları her fırsatta enjekte eder, böylece model, istemcinin daha sonra sunucuya ileteceği bir `tool_use` bloğu yayınlayabilir.

### Adım 3: yayınlanabilir HTTP aktarımı

Stdio yerel geliştiriciler için gayet iyi. Uzak araçlar için akışa uygun HTTP kullanın; istek başına bir POST, ilerleme için isteğe bağlı Sunucudan Gönderilen Olaylar, 2025-06-18 spesifikasyon revizyonundan bu yana desteklenmektedir.

```python
# Inside the server entrypoint
mcp.run(transport="streamable-http", host="0.0.0.0", port=8765)
```

Ana bilgisayar yapılandırması (Claude Masaüstü `mcp.json` veya Claude Kodu `~/.mcp.json`):

```json
{
  "mcpServers": {
    "demo": {
      "type": "http",
      "url": "https://tools.example.com/mcp"
    }
  }
}
```

Sunucu aynı dekoratörleri tutar; yalnızca ulaşım değişir.

### 4. Adım: kapsam belirleme ve güvenlik

Bir MCP aracı, başka birinin güven sınırında çalışan rastgele bir koddur. Üç zorunlu kalıp.

- **Yetenek izin verilenler listeleri.** Ana bilgisayarlar, sunucunun yalnızca izin verilen yolları görmesi için bir `roots` özelliğini kullanıma sunar. Araç işleyicilerinde bunu uygulayın; model tarafından sağlanan yollara güvenmeyin.
- **Mutasyon için döngüdeki insan.** Salt okunur araçlar otomatik olarak çalıştırılabilir. Yazma/silme araçlarının onay gerektirmesi gerekir; sunucu, araç meta verilerinde `destructiveHint: true` ayarını yaptığında ana bilgisayarlar bir onay kullanıcı arayüzü ortaya çıkarır.
- **Araç zehirlenmesine karşı savunma.** Kötü niyetli bir kaynak, gizli prompt-enjeksiyon talimatlarını içerebilir ("özetlerken ayrıca `exfil`'ı çağırın"). Kaynak içeriğine güvenilmeyen veriler olarak davranın; sistem mesaj bölgesine geçmesine asla izin vermeyin. Bkz. Aşama 11 · 12 (Guardrail'ler).

Tüm bunları gösteren çalıştırılabilir bir sunucu + istemci çifti için `code/main.py`'ye bakın.

## 2026'da hâlâ gönderilecek tuzaklar

- **Şema sapması.** Model 1. virajda `tools/list` gördü. 5. virajda takım seti değişiyor. Model, gitmiş bir takımı çağırıyor. Ana makineler `notifications/tools/list_changed` tarihinde yeniden listelenmelidir.
- **Büyük kaynak yığınları.** 2 MB'lık bir dosyayı kaynak olarak boşaltmak bağlamı boşa harcar. Sunucu tarafını sayfalandırın veya özetleyin.
- **Çok fazla sunucu.** 50 MCP sunucusunun montajı araç bütçesini zorluyor (Aşama 11 · 05). Çoğu sınır modelinde ~40 takımdan daha fazla bozulma olur.
- **Sürüm çarpıklığı.** Özellik revizyonları (2024-11, 2025-03, 2025-06, 2025-12) kesme alanlarını tanıtıyor. CI'da protokol sürümünü pinleyin.
- **Stdio kilitlenmeleri.** Stdout'ta oturum açan sunucular JSON-RPC akışını bozar. Yalnızca stderr'de oturum açın.

## Kullan onu

2026 MCP yığını:

| Durum | Seç |
|-----------|------|
| Yerel geliştirme, tek kullanıcılı araçlar | Python `FastMCP`, stdio aktarımı |
| Uzak ekip araçları / SaaS entegrasyonu | Akış yapılabilir HTTP, OAuth 2.1 kimlik doğrulaması |
| TypeScript ana bilgisayarı (VS Code uzantısı, web uygulaması) | `@modelcontextprotocol/sdk` |
| Yüksek verimli sunucu, yazılı erişim | Resmi Rust SDK'sı (`modelcontextprotocol/rust-sdk`) |
| Ekosistem sunucularını keşfetme | `modelcontextprotocol/servers` monorepo (Dosya sistemi, GitHub, Postgres, Slack, Puppeteer) |

Temel kural: Bir araç salt okunursa, önbelleğe alınabilirse ve iki veya daha fazla ana bilgisayardan çağrılıyorsa, onu bir MCP sunucusu olarak gönderin. Tek seferlik satır içi mantıksa, bunu yerel bir işlev olarak tutun (Aşama 11 · 09).

## Gönderin

`outputs/skill-mcp-server-designer.md`'yi kaydet:

```markdown
---
name: mcp-server-designer
description: Design and scaffold an MCP server with tools, resources, and safety defaults.
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

Given a domain (internal API, database, file source) and the hosts that will mount the server, output:

1. Primitive map. Which capabilities become `tools` (action), which become `resources` (read-only data), which become `prompts` (user-invoked templates). One line per primitive.
2. Auth plan. Stdio (trusted local), streamable HTTP with API key, or OAuth 2.1 with PKCE. Pick and justify.
3. Schema draft. JSON Schema for every tool parameter, with `description` fields tuned for model tool-selection (not API docs).
4. Destructive-action list. Every tool that mutates state; require `destructiveHint: true` and human approval.
5. Test plan. Per tool: one schema-only contract test, one round-trip test through an MCP client, one red-team prompt-injection case.

Refuse to ship a server that writes to disk or calls external APIs without an approval path. Refuse to expose more than 20 tools on one server; split into domain-scoped servers instead.
```

## Egzersizler

1. **Kolay.** `demo-server`'yı bir `subtract` aracıyla genişletin. Claude Masaüstünden bağlayın. Bir `tools/list_changed` bildirimi göndererek toplantı sahibinin yeni aracı yeniden başlatmadan aldığını doğrulayın.
2. **Orta.** `/var/log/app.log`'nin son 100 satırını gösteren bir `resource` ekleyin. Model istese bile `../etc/passwd`'nin engellenmesi için kök izin verilenler listesini zorunlu kılın.
3. **Zor.** Üç yukarı akış sunucusunu (Dosya sistemi, GitHub, Postgres) tek bir toplu yüzeyde çoğaltan bir MCP proxy'si oluşturun. Ad çakışmalarını giderin ve `notifications/tools/list_changed`'yi temiz bir şekilde iletin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| MCP | "LLM'ler için araç protokolü" | Araçların, kaynakların ve prompt'ların herhangi bir LLM ana bilgisayarına sunulmasına yönelik JSON-RPC 2.0 spesifikasyonu. |
| Sunucu | "Claude Masaüstü" | LLM uygulaması — modele ve kullanıcı arayüzüne sahiptir, bir veya daha fazla istemciyi bağlar. |
| Müşteri | "Bağlantı" | Ana bilgisayar içindeki JSON-RPC'yi tam olarak bir sunucuya aktaran sunucu başına bağlantı. |
| Sunucu | "Aletlerle ilgili şey" | Kodunuz; araçları/kaynakları/prompt'ları tanıtır ve bunların çağrılmasını yönetir. |
| Araç | "Function calling" | JSON Şeması girişi ve metin/JSON sonucuyla model tarafından çağrılabilir eylem. |
| Kaynak | "Salt okunur veriler" | Ana bilgisayarın isteyebileceği URI adresli içerik (dosya, satır, API yanıtı). |
| Prompt | "Kaydedildi prompt" | Kullanıcı tarafından çağrılabilen şablon (çoğunlukla argümanlarla birlikte) bir eğik çizgi komutu olarak ortaya çıktı. |
| Stüdyo taşımacılığı | "Yerel geliştirme modu" | Ana ana bilgisayar, sunucuyu bir alt süreç olarak oluşturur; JSON-RPC, stdin/stdout üzerinden. |
| Akış yapılabilir HTTP | "2025-06 uzaktan taşıma" | İstekler için POST, sunucu tarafından başlatılan mesajlar için isteğe bağlı SSE; eski yalnızca SSE aktarımının yerini alır. |

## Daha Fazla Okuma

- [Model Bağlam Protokolü spesifikasyonu](https://modelcontextprotocol.io/specification) — tarihe göre sürümlendirilmiş kanonik referans.
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — Dosya sistemi, GitHub, Postgres, Slack, Puppeteer referans sunucuları.
- [Anthropic — MCP'ye Giriş (Kasım 2024)](https://www.anthropic.com/news/model-context-protocol) — tasarım gerekçesini içeren lansman gönderisi.
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk) — bu derste kullanılan resmi SDK.
- [MCP için güvenlik hususları](https://modelcontextprotocol.io/docs/concepts/security) — kökler, yıkıcı ipuçları, araç zehirlenmesi.
- [Google A2A spesifikasyonu](https://a2a-protocol.org/latest/) — Agent2Agent protokolü; MCP'nin agent-araç kapsamını tamamlayan agent-to-agent iletişimi için kardeş standart.
- [Anthropic — Etkili agent'ler oluşturma (Aralık 2024)](https://www.anthropic.com/research/building-effective-agents) — burada MCP, agent tasarımı (artırılmış LLM, iş akışları, özerk agent'ler) için daha geniş model kitaplığında yer alır.
