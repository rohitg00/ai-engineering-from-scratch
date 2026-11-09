# Paylaşılan Hatıra ve Karakter Kaynakları

> 2026'da çoklu ajan sistemlerinde iki yaklaşım bir arada var:**message pool**(Herkes herkesin mesajlarını görür, AutoGen GroupChat veya MetaGPT gibi) ve **blackboard with subscription**(Ajanslar Kontext-Aware MCP veya Matrix çerçevesinde olduğu gibi ilgili olaylara abone olurlar). Her ikisi de çoklu ajanlı bir sistemin tek durumlu parçası  yani ikisi de ilginç hataların yaşadığı yerdir. İpucu hata modusu **memory poisoning**Bu ders, her iki yapıyı stdlib'den inşa eder, zehirleme saldırısı enjekte eder ve üretimde gerçekten çalışan üç hafiflemeyi gösterir.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Sorun

Çoklu ajan sistemleri, ajanların gerçekleri paylaşması için bir yere ihtiyaç duyar. Sözcük bir seçenek "her şeyi mesajlarda geçiyor"  ancak ekstra kopyalama ile paylaşılan durumu yeniden icat ediyor. Başka bir seçenek ise "herkese küresel bir günlük ver"  ama küresel günlükler sınırsız büyüyor ve kolayca zehirlenir. Üçüncü bir seçenek ise "bir ajan için bir görüntü projesi"  ölçeklenebilir ancak şema ağır.

Bu durumun farkına varan her aşağı akımlı ajan, halüsinasyonu gerçek olarak kabul eder. İnsan farkına varırken, mantık zinciri beş adım derinlikte ve kök neden ise yazılmış üçüncü mesajdır.

Bu hafıza zehirlenmesidir. MAST taksonomisi'nde ikinci en çok belgelenen başarısızlık ailesi (Cemri ve diğerleri, arXiv:2503.13657) ve yapısal: Kaynaksız ve yazılamaz bir doğrulayıcı olmayan herhangi bir paylaşılan hafıza tasarımı sonunda onu gösterecektir.

## Anlam

### İki ana topolojisi

**Full message pool.**Her ajan her mesajı okuyor. AutoGen GroupChat ve MetaGPT bunu kullanıyor. Basit, şeffaf, denenebilir, ancak her ajansın bağlamı diğer ajansların çalışmalarıyla dolduğu için ~ 10 ajandan daha fazla ölçeklendirmeyi gerektirir.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard with subscription.**Ajanlar konulara ilgi gösterdiğini belirtir; altyapı yolları sadece ilgili mesajlar gönderir. CA-MCP (arXiv:2601.11595) ve Matrix merkezi olmayan çerçeve (arXiv:2511.21686) bunu kullanırlar. Daha fazla ölçeklendirir, ancak abonelikleri anlamlı hale getirmek için önceden şema tasarımı gerektirir.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### Her biri kazanırken

- **Full pool**Bu nedenle, bu konuyu ele almak için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek için, bir araya gelmek, bir araya gelmek, bir araya gelmek için, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelmek, bir araya gelebilir.
- **Blackboard**Bu nedenle, bu konularda, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, birbiriyle ilgili olarak, bir diğerine benzer şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, ( ( ( ( ( (a) olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak,

Üretim sistemleri genellikle karışır: üstte küçük bir tam havuz (planlama katmanı), altta kara tahtlar (işçi katmanı).

### Bir senaryoda hafıza zehirlenmesi

Üç ajan araştırma görevi üzerinde çalışıyor A ajanı bir kurtarma ajanı B ajanı bir özetleyici C ajanı bir analist.

1. Bir sayfa getirir ve paylaşılmış durumlara bir mesaj yazar: "Çözüm, %42 doğruluk iyileştirdiğini bildirir".
2. Aldığım sayfada aslında "% 4,2 iyileşme" yazıyordu.
3. B, paylaşılan durumu okuyarak şöyle yazıyor: "Kesinlik artışı %42 oranında rapor edildi (kaynak: A). "
4. C, paylaşılan durumu okuyarak şöyle yazıyor: "Tavsiye edin  42% yükseltme dönüştürücüdür".
5. Son rapor hiçbir zaman var olmamış olan %42'lik bir rakamdan söz ediyor.

Hiçbir ajan çökmedi, hiçbir test başarısız olmadı, sistem "işledi" halüsinasyon bir ajanın bağlamından, ortak bir durum yoluyla her aşağı akımdaki ajanın mantığına geçti.

### Bu neden yapısal?

A'nın halüsinasyonları A'nın bağlamında kalır. Aşağı akımdaki ajanlar tekrar alacak veya yeniden çıkarabilir ve hatayı yakalayabilir. Saçma ortak durumla A'nın bağlamı herkesin bağlamına dönüşür ve halüsinasyon gerçeklere yıkılır.

Sorun ortak devlet değildir.**without provenance and without an independent verifier**Üç hafifleme yolu:

1. **Attribute provenance on every write.**Paylaşılan devlet kayıtlarında bulunan her giriş, kim yazdı, ne zaman, hangi çağrı altında ve (mümkünse) ajanın hangi kaynağı belirtti.
2. **Version writes; treat them as append-only.**Düzeltme, eski bir giriş yerine yeni bir girişdir, yerleşik bir güncelleştirme değil.
3. **Keep at least one agent that cannot write to shared state.**Sadece okuyabilen bir doğrulama ajanı girişleri örnekler, kaynakları yeniden alır ve tutarlılıkları işaretler. Hala havuzu okuyor, bu yüzden kötü bir girişle kandırılabilir, ancak her girişini orijinal kaynağa karşı kontrol eder ve yazamaz, bu nedenle hükümleri asla zehirli bir gerçeği paylaşılmış bir duruma geri getirmez.

### Blackboard precedeni (Hayes-Roth, 1985)

Blackboard örneği, LLM ajanlarından dört yıl önceydi. Hayes-Roth (1985, "Control için bir Blackboard Arsitekturası") küresel bir blackboard gözlemleyen, kısmi çözümlere katkıda bulunan ve diğer kaynakları tetikleyen uzman Bilgi Kaynaklarını tanımladı. 2026 kara tahtası (CA-MCP, Matrix) Bilgi Kaynakları ve kısmi çözümler olarak JSON blobları ile LLM ajanları ile aynı kalıptır. Eski edebiyat, modern sistemlerin yeniden keşfettiği tartışma, fırsatçı kontrol ve tutarlılık yazmak için çözümler belgelemiştir.

### Projection vs. Full View

Temiz bir tahta her aboneye aynı projeksiyonu verir (topik boyutunda).**per-agent projection**LangGraph'in durum azaltıcıları, kanonik 2026 uygulamasıdır  azaltıcı fonksiyonu küresel durumu rolü özel bir parçaya katlar.

Bir ajan projesi daha da genişleşiyor ama bir şema gerek.

### Yazıcı içerik biçimleri

Aynı anda birden fazla ajan yazmak sadece bir LLM sorunu değil aynı anda bir sorun.

- **Sequential writer (single producer).**Tüm yazılar bir koordinatör aracı aracılığıyla seriye geçiyor.
- **Optimistic concurrency with versioning.**Her giriş bir versiyonunu içerir; yazarlar versiyon eşleşmezliği ve yeniden deneme konusunda başarısız olurlar.
- **Topic partitioning.**Farklı ajanlar farklı konuları var, konuların çapraz tartışması yok, tasarlanmış bölüm sınırları gerektirir.

2026 çerçevelerinin çoğu, sıralı yazar için varsayımlı çünkü LLM aramaları yeterince yavaş olur ki tartışma nadirdir ve şişe boynuzunun zarar vermemesi.

### Yazılmayan doğrulama

En yük taşıyan hafifleme, sadece okunur verifikatördür.

- Verifiyeci, takımla durum paylaşıyor (çapayı veya havuzu okuyor).
- Verifier'ın yalnızca ayrı bir doğrulama kanalı için paylaşılan  durumu yazma elmi yoktur.
- Verifier, yazılardaki kaynakları bağımsız olarak alır.
- Verifier'ın kendi çıkışları bir insan veya ayrı bir karar verme ajanına yönlendirilir ve asla havuza geri verilmez.

Bu ayrım olmadan, doğrulayıcının çıkışları havuzda yeni girişler haline gelir, yani zehirli bir havuz doğrulayıcıyı zehirler ve bu da doğrulamalarını zehirler.

```figure
swarm-blackboard
```

## Yapın

`code/main.py`Stdlib Python'da her iki topolojinin de uygulanması, oyuncak zehirlenme saldırısı ve üç hafifleme.

- `MessagePool` tam okunma ile sadece iplik güvenli ekleme kayıt.
- `Blackboard` Konuya bağlı pub/sub, ajan aboneliği ile.
- `ProvenanceEntry` her yazış kaydı (yazar, zaman damgası, prompt_hash, source_uri).
- `PoisoningScenario` A ajanının bir onluk halüsinasyonunu gerçekleştirdiği üç ajanlı bir araştırma görevi yürütür.
- `Verifier` Kaynakları tekrar arayan ve tutarlılıkları işaretleyen sadece okuyabilen bir ajan.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen üretim:
- 1. Atış (verifikatör yok): halüsinasyonlu %42 son rapora yayılır.
- 2. Çıkış (verifici ile): verifici tutarlılıktan haberdar olur, havuz "flagged" olarak etiketlenir, son rapor geri çekilmeyi içerir.

## Kullan

`outputs/skill-memory-auditor.md`Bir multi-agent sisteminin ortak hafıza tasarımı, kaynak, versiyonlama ve doğrulayıcı ayrımı için denetleme becerisi.

## Gönder

Ortak bellek tasarımları için:

- Her yazıda kaydedilen yer: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`- Evet .
- Düzeltmeler, değiştirilen bir yere atıfta bulunan yeni yazılardır.
- En az bir okunma-tek verifiye aracı, bağımsız kaynak erişimine sahip olarak kullanın.
- Yol doğrulayıcısı, paylaşılmış havuza geri dönmek yerine ayrı bir kanala çıkıyor.
- Yasaklık olan yazılar oranını kaydetmek  artış oranı halüsinasyon kalıplarının erken kanıtlarıdır.

## Egzersizler

1. Çık .`code/main.py`1. koşunun halüsinasyonu yaydığını ve 2. koşunun onu yakaladığını onaylayın.
2. İkinci bir halüsinasyon ekleyin: ajan B bir veri kümesi boyutunu icat eder. Verifikatör her ikisini de elle ayarlamadan yakalamalıdır.
3. Tüm havuzu konu bölümü olan bir tahtaya geçirin (`prices`- Evet .`summaries`- Evet .`analyses`Hangi zehirlenme senaryoları, bölünme olayları zorlaştırır ve hangi senaryolarda yardımcı olmaz?
4. Hayes-Roth (1985, "Control için bir Blackboard Arsitekturesi") okuyun. 2026 sistemlerinin yararlanabileceği bu dersde tartışılmamış makaledeki iki kontrol kalıpını belirleyin.
5. CA-MCP (arXiv:2601.11595). Paylaşılan Konteks Depoyu'nu ya MessagePool ya da Blackboard sınıfına yerleştirin `code/main.py`CA-MCP'nin üst kısmına hangi primitifler eklendi?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Message pool | "Shared chat history" | Append-only log that every agent reads. Full transparency, poor scaling. |
| Blackboard | "Shared workspace" | Topic-keyed pub/sub. Agents subscribe to relevant topics. Scales farther. |
| Provenance | "Who wrote what" | Metadata on each write: writer, timestamp, prompt, sources. |
| Memory poisoning | "Hallucinations spreading" | One agent's error enters shared state, downstream agents adopt it as fact. |
| Append-only | "No in-place updates" | Corrections are new entries that supersede. Preserves audit trail. |
| Unwritable verifier | "Independent auditor" | Read-only agent that re-fetches sources and flags inconsistencies. |
| Projection | "Scoped view" | Per-agent view computed from global state. LangGraph reducers are the canonical case. |
| Knowledge Source | "Specialist agent" | Hayes-Roth's 1985 term for a blackboard participant. |

## Daha Fazla Okumak

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) MAST taksonomisi; hafıza zehirlenmesi bir koordinasyon-kuşkusu alt ailenidir
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) Koordinasyonlu MCP sunucular için Ortak Kontekst Depolama
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) Merkezli bir orkestratör olmadan mesaj kuyruk tabanlı bir tahta
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) üretimdeki ajan başına projeksiyon modeli
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Bir üretim dağıtımından gelen kaynak ve doğrulama notları
