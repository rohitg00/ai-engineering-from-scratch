# Kütüphane Olarak Harness — Abonelikagentler ve Oturum Mağazası

> İçe aktarabileceğiniz bir donanım: yerleşik araçlar, bağlam izolasyonu için altagent'lar, kancalar, W3C iz yayılımı, oturum kalıcılığı. Claude Agent SDK'sı referans örneğidir (Claude Code koşum takımının kitaplık formu) ve Claude Managed Agent'ler uzun süreli eşzamansız çalışma için barındırılan alternatiftir.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 10 (Beceri Kitaplıkları)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Anthropic Client SDK (ham API) ile Claude Agent SDK (kablo demeti şekli) arasındaki farkı açıklayın.
- Altagent'ları (paralelleştirme ve bağlam yalıtımı) ve bunlara ne zaman ulaşılacağını açıklayın.
- Python SDK'nın oturum deposu yüzeyini (`append`, `load`, {`list_sessions`, `delete`, `list_subkeys`) ve `--session-mirror` rolünü adlandırın.
- Yerleşik araçlara sahip bir stdlib koşum takımı, yalıtılmış bağlamla altagent oluşturma, yaşam döngüsü kancaları ve bir oturum deposu uygulayın.

## Sorun

Ham bir Yüksek Lisans API'si size tek bir gidiş dönüş sağlar. Bir üretim agent, araç yürütmeye, MCP sunucularına, yaşam döngüsü kancalarına, altagent oluşturmaya, oturum kalıcılığına, izleme yayılımına ihtiyaç duyar. Claude Agent SDK'sı bu şekli bir kitaplık olarak gönderir; Claude Code'un kullandığı donanımın aynısı, özel agent'ler için kullanıma sunulur.

## Konsept

### İstemci SDK'sı ve Agent SDK'sı

- **İstemci SDK'sı (`anthropic`).** Ham Mesajlar API'si. Döngünün, araçların ve durumun sahibi sizsiniz.
- **Agent SDK (`claude-agent-sdk`).** Yerleşik araç yürütme, MCP bağlantıları, kancalar, altagent oluşturma, oturum deposu. Bir kütüphane olarak Claude Kodu döngüsü.

### Yerleşik araçlar

SDK, kutudan 10'dan fazla araç çıkarır: dosya okuma/yazma, kabuk, grep, glob, web getirme ve daha fazlası. Özel araçlar, standart araç şeması arayüzü aracılığıyla kaydedilir.

### Altagent'lar

Anthropic tarafından belgelenen iki amaç:

1. **Paralelleştirme.** Bağımsız çalışmayı eş zamanlı olarak yürütün. "Bu 20 modülün her biri için test dosyasını bul" 20 paralel altagent görevden oluşur.
2. **Bağlam izolasyonu.** Altagent'lar kendi context window'larını kullanır; yalnızca sonuçlar orkestratöre geri döner. Orkestratörün bütçesi korunur.

Python SDK'ya son eklenenler: `list_subagents()`, altagent transkriptlerini okumak için `get_subagent_messages()`.

### Oturum deposu

TypeScript ile protokol eşliği:

- `append(session_id, message)` — bir dönüş ekleyin.
- `load(session_id)` — konuşmayı geri yükle.
- `list_sessions()` — numaralandır.
- `delete(session_id)` — altagent oturuma basamaklamayla.
- `list_subkeys(session_id)` — altagent anahtarlarını listele.

`--session-mirror` (CLI bayrağı), hata ayıklama amacıyla transkripti akış sırasında harici bir dosyaya yansıtır.

### Kancalar

Kaydedebileceğiniz yaşam döngüsü kancaları:

- `PreToolUse`, `PostToolUse` — geçit veya denetim aracı çağrıları.
- `SessionStart`, `SessionEnd` — kurar ve söker.
- `UserPromptSubmit` — model görmeden önce kullanıcı girdisine göre hareket edin.
- `PreCompact` — bağlam sıkıştırmasından önce çalıştır.
- `Stop` — agent çıkışında temizlik.
- `Notification` — yan kanal uyarıları.

Kancalar, iş akışı yanlısı (Aşama 14 müfredat referansı) ve benzer sistemlerin kesişen davranışları nasıl eklediğini gösterir.

### W3C izleme bağlamı

Arayandaki etkin OTel yayılmaları, W3C izleme bağlamı üstbilgileri aracılığıyla CLI alt sürecine yayılır. Çoklu işlem izinin tamamı arka uçta tek bir iz olarak görünür.

### Claude Agent'ları Yönetti

Barındırılan alternatif (beta başlığı `managed-agents-2026-04-01`). Uzun süren eşzamansız çalışma, yerleşik prompt önbelleğe alma, yerleşik sıkıştırma. Yönetilen altyapı için ticaret kontrolü.

### Bu modelin yanlış gittiği yer

- **Altagent fazla ortaya çıkıyor.** 100 küçük görev için 100 altagent ortaya çıkıyor. Tepegöz hakimdir. Bunun yerine toplu işlem yapın.
- **Kanca sürünmesi.** Her takım kanca ekler; başlangıç ​​zamanı balonları. Kancaları üç ayda bir gözden geçirin.
- **Oturum şişkinliği.** Oturumlar birikir; boyutu büyüyor. `list_sessions` + son kullanma politikasını kullanın.

## İnşa Et

`code/main.py`, SDK şeklini stdlib'de uygular:

- Dahili {`read_file`, `write_file`, `list_dir` ile `Tool`, `ToolRegistry`.
- `Subagent` — özel bağlam, yalıtılmış çalıştırma, döndürülen sonuçlar.
- `SessionStore` — ekleme, yükleme, listeleme, silme, liste_alt anahtarları.
- `Hooks` — `pre_tool_use`, {`post_tool_use`, `session_start`, `session_end`.
- Bir demo: main agent paralel olarak 3 altagent oluşturur (her biri izole edilmiş), sonuçları toplar, oturumu sürdürür.

Çalıştır:

```
python3 code/main.py
```

İzleme, altagent bağlam yalıtımını (orchestrator bağlam boyutu sınırlı kalır), kanca yürütmeyi ve oturum kalıcılığını gösterir.

## Kullan onu

- Claude Kodu koşum şeklini isteyen Claude ilk ürünleri için **Claude Agent SDK**.
- **Claude, barındırılan uzun süreli eşzamansız çalışma için Agent'leri** yönetti.
- OpenAI'nin ilk karşılıkları için **OpenAI AgentSDK'sı** (Ders 16).
- Bunun yerine grafik şeklindeki durum makinesini istiyorsanız **LangGraph + özel araçlar**.

## Gönderin

`outputs/skill-claude-agent-scaffold.md`, altagent'lar, kancalar, oturum deposu, MCP sunucusu eki ve W3C izleme yayılımı ile bir Claude Agent SDK uygulamasını iskele haline getirir.

## Egzersizler

1. 20 görevi 5 paralel altagent'dan oluşan gruplar halinde toplayan bir altagent oluşturucu ekleyin. Orkestratör bağlam boyutunu ve görev başına bir taneyi ölçün.
2. `write_file` çağrının hızını sınırlayan bir `PreToolUse` kancası uygulayın (oturum başına dakikada 5). Davranışı takip edin.
3. Bir altagent ağacı oluşturmak için `list_subkeys`'yi bağlayın. Derin yuvalama neye benziyor?
4. Oyuncağı gerçek `claude-agent-sdk` Python paketine taşıyın. Takım kaydıyla ilgili ne gibi değişiklikler var?
5. Claude Managed Agent'nin belgelerini okuyun. Kendi kendine barındırılandan yönetilene ne zaman geçiş yapacaksınız?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agent SDK'sı | "Kütüphane Olarak Claude Kodu" | Koşum şekli: araçlar, MCP, kancalar, altagent'lar, oturum deposu |
| Altagent | "Çocuk agent" | Ayrı bağlam, kendi bütçesi; sonuçlar kabarıyor |
| Oturum deposu | "Konuşma Veritabanı" | Altagent kademesi ile dönüşleri devam ettir, yükle, listele, sil |
| Kanca | "Yaşam döngüsü geri araması" | Ön/sonraki aracı, oturum, prompt gönder, sıkıştır, durdur |
| W3C izleme bağlamı | "Çapraz süreç izleme" | Ana yayılma alanı CLI alt sürecine yayılıyor |
| Yönetilen Agents | "Barındırılan koşum takımı" | Antropik olarak barındırılan uzun süredir devam eden eşzamansız çalışma |
| `--session-mirror` | "Transkript aynası" | Yazma oturumu akış sırasında harici bir dosyaya dönüşür |
| MCP sunucusu | "Takım yüzeyi" | agent |'a eklenen harici araç/kaynak kaynağı

## Daha Fazla Okuma

- [Claude Agent SDK'ya genel bakış](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude Code'un kitaplık formu
- [Antropik, Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) ile agent'ler oluşturma — üretim modelleri
- [Claude Managed Agent'ye genel bakış](https://platform.claude.com/docs/en/managed-agents/overview) — barındırılan alternatif
- [OpenAI Agent'nin SDK'sı](https://openai.github.io/openai-agents-python/) — karşılığı
