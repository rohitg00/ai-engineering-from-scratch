# Bir Kütüphane Olarak Harness — Subagents ve Oturum Mağazası

> İçe aktarabileceğiniz bir donanım: yerleşik araçlar, bağlam izolasyonu için subagent'ler, kancalar, W3C iz yayılımı, oturum kalıcılığı. Claude Agent SDK, referans örneğidir (Claude Code donanımının kitaplık formu) ve Claude Managed Agent'ler, uzun süreli eşzamansız çalışma için barındırılan alternatiftir.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 10 (Beceri Kitaplıkları)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Anthropic Client SDK (ham API) ile Claude Agent SDK (kablo demeti şekli) arasındaki farkı açıklayın.
- Altagent'leri (paralelleştirme ve bağlam izolasyonu) ve bunlara ne zaman ulaşılacağını açıklayın.
- Python SDK'nın oturum deposu yüzeyini (`append`, `load`, `list_sessions`, `delete`, `list_subkeys`) ve `--session-mirror` rolünü adlandırın.
- Yerleşik araçlarla bir stdlib donanımı, yalıtılmış bağlamla subagent oluşturma, yaşam döngüsü kancaları ve bir oturum deposu uygulayın.

## Sorun

Ham bir Yüksek Lisans API'si size tek bir gidiş dönüş sağlar. agent üretimi için araç çalıştırma, MCP sunucuları, yaşam döngüsü kancaları, subagent oluşturma, oturum kalıcılığı ve izleme yayılımı gerekir. Claude Agent SDK, bu şekli bir kitaplık olarak gönderir; Claude Code'un kullandığı donanımın aynısı, özel agent'ler için kullanıma sunulur.

## Konsept

### İstemci SDK'sı ve Agent SDK'sı

- **İstemci SDK'sı (`anthropic`).** Ham Mesajlar API'si. Döngünün, araçların ve durumun sahibi sizsiniz.
- **Agent SDK (`claude-agent-sdk`).** Yerleşik araç yürütme, MCP bağlantıları, kancalar, subagent oluşturma, oturum deposu. Bir kütüphane olarak Claude Kodu döngüsü.

### Yerleşik araçlar

SDK, kutudan 10'dan fazla araç çıkarır: dosya okuma/yazma, kabuk, grep, glob, web getirme ve daha fazlası. Özel araçlar, standart araç şeması arayüzü aracılığıyla kaydedilir.

### Subagent'ler

Anthropic tarafından belgelenen iki amaç:

1. **Paralelleştirme.** Bağımsız çalışmayı eş zamanlı olarak yürütün. "Bu 20 modülün her biri için test dosyasını bulun" 20 paralel altagent görevidir.
2. **Bağlam izolasyonu.** Subagent'ler kendi context window'lerini kullanır; yalnızca sonuçlar orkestratöre geri döner. Orkestratörün bütçesi korunur.

Python SDK'sına son eklenenler: `list_subagents()`, subagent transkriptlerini okumak için `get_subagent_messages()`.

### Oturum deposu

TypeScript ile protokol eşliği:

- `append(session_id, message)` — bir dönüş ekleyin.
- `load(session_id)` — konuşmayı geri yükle.
- `list_sessions()` — numaralandır.
- `delete(session_id)` — alt agent oturumlarına basamaklamayla.
- `list_subkeys(session_id)` — alt agent anahtarlarını listeler.

`--session-mirror` (CLI bayrağı), hata ayıklama amacıyla transkripti akış sırasında harici bir dosyaya yansıtır.

### Kancalar

Kaydedebileceğiniz yaşam döngüsü kancaları:

- `PreToolUse`, `PostToolUse` — geçit veya denetim aracı çağrıları.
- `SessionStart`, `SessionEnd` — kurun ve sökün.
- `UserPromptSubmit` — model görmeden önce kullanıcı girdisine göre hareket edin.
- `PreCompact` — bağlam sıkıştırmasından önce çalıştırın.
- `Stop` — agent çıkışında temizleme.
- `Notification` — yan kanal uyarıları.

Kancalar, iş akışı yanlısı (Aşama 14 müfredat referansı) ve benzer sistemlerin kesişen davranışları nasıl eklediğini gösterir.

### W3C izleme bağlamı

Arayanda aktif olan OTel, W3C izleme içeriği üstbilgileri aracılığıyla CLI alt sürecine yayılır. Çoklu işlem izinin tamamı arka uçta tek bir iz olarak görünür.

### Claude Yönetilen Agent'ler

Barındırılan alternatif (beta başlığı `managed-agents-2026-04-01`). Uzun süre çalışan eşzamansız çalışma, yerleşik prompt önbelleğe alma, yerleşik sıkıştırma. Yönetilen altyapı için ticaret kontrolü.

### Bu modelin yanlış gittiği yer

- **Subagent aşırı doğuyor.** 100 küçük görev için 100 altagent doğuyor. Tepegöz hakimdir. Bunun yerine toplu işlem yapın.
- **Kanca sürünmesi.** Her takım kanca ekler; başlangıç ​​zamanı balonları. Kancaları üç ayda bir gözden geçirin.
- **Oturum şişkinliği.** Oturumlar birikir; boyutu büyüyor. `list_sessions` + son kullanma politikasını kullanın.

## İnşa Et

`code/main.py`, SDK şeklini stdlib'de uygular:

- Yerleşik `read_file`, `write_file`, `list_dir` ile `Tool`, `ToolRegistry`.
- `Subagent` — özel bağlam, yalıtılmış çalıştırma, sonuçlar döndürülür.
- `SessionStore` — ekleme, yükleme, listeleme, silme, liste_alt anahtarları.
- `Hooks` — `pre_tool_use`, `post_tool_use`, `session_start`, `session_end`.
- Bir demo: ana agent paralel olarak 3 alt agent oluşturur (her biri izole edilmiş), sonuçları toplar, oturumu sürdürür.

Çalıştır:

```
python3 code/main.py
```

İzleme, subagent bağlam yalıtımını (orchestrator bağlam boyutu sınırlı kalır), kanca yürütmeyi ve oturum kalıcılığını gösterir.

## Kullan onu

- **Claude Agent SDK**, Claude Code koşum şeklini isteyen Claude ilk ürünleri için.
- Barındırılan uzun süreli eşzamansız çalışma için **Claude Yönetilen Agent'ler**.
- **OpenAI Agent SDK'sı** (Ders 16), OpenAI'nin ilk muadilleri için.
- Bunun yerine grafik şeklindeki durum makinesini istiyorsanız **LangGraph + özel araçlar**.

## Gönderin

`outputs/skill-claude-agent-scaffold.md`, altagent'ler, kancalar, oturum deposu, MCP sunucusu eki ve W3C izleme yayılımı ile bir Claude Agent SDK uygulamasını destekler.

## Egzersizler

1. 20 görevi 5 paralel subagent'den oluşan gruplar halinde toplayan bir subagent oluşturucu ekleyin. Orkestratör bağlam boyutunu ve görev başına bir taneyi ölçün.
2. `write_file` çağrılarını (oturum başına dakikada 5) hız sınırına getiren bir `PreToolUse` kancası uygulayın. Davranışı takip edin.
3. Bir altagent ağacı oluşturmak için `list_subkeys`'yi bağlayın. Derin yuvalama neye benziyor?
4. Oyuncağı gerçek `claude-agent-sdk` Python paketine taşıyın. Takım kaydıyla ilgili ne gibi değişiklikler var?
5. Claude Managed Agent belgelerini okuyun. Kendi kendine barındırılandan yönetilene ne zaman geçiş yapacaksınız?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agent SDK'sı | "Kütüphane Olarak Claude Kodu" | Kablo demeti şekli: aletler, MCP, kancalar, subagent'ler, oturum deposu |
| Subagent | "Çocuk agent" | Ayrı bağlam, kendi bütçesi; sonuçlar kabarıyor |
| Oturum deposu | "Konuşma Veritabanı" | Subagent basamaklı ile dönüşleri ısrarla, yükle, listele, sil |
| Kanca | "Yaşam döngüsü geri araması" | Ön/sonraki araç, oturum, prompt gönderme, sıkıştırma, durdurma |
| W3C izleme bağlamı | "Çapraz süreç izleme" | Ana yayılma alanı CLI alt sürecine yayılıyor |
| Yönetilen Agent'ler | "Barındırılan koşum takımı" | Antropik olarak barındırılan uzun süredir devam eden eşzamansız çalışma |
| `--session-mirror` | "Transkript aynası" | Yazma oturumu akış sırasında harici bir dosyaya dönüşür |
| MCP sunucusu | "Takım yüzeyi" | agent |

## Daha Fazla Okuma

- [Claude Agent SDK'ya genel bakış](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude Code'un kitaplık formu
- [Antropik, Claude Agent SDK ile agent Oluşturma](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — üretim modelleri
- [Claude Managed Agent'lere genel bakış](https://platform.claude.com/docs/en/managed-agents/overview) — barındırılan alternatif
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — karşılığı
