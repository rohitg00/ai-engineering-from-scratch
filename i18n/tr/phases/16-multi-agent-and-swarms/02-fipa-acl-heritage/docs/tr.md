# FIPA-ACL Mirası ve Konuşma Aktı

> MCP'den önce, A2A'dan önce, FIPA-ACL vardı. 2000 yılında Akıllı Fiziksel Ajanlar Vakfı (FIPA, 2005 yılında IEEE Bilgisayar Topluluğu standart komitesi haline geldi) yirmi performatif, iki içerik dili ve bir dizi etkileşim protokolü ile bir ajan iletişim dili onayladı  sözleşme net, abonelik / bildirim, talep-ne zaman. Endüstriye düştü çünkü ontoloji genel masrafları web için çok ağırydı, ancak çoklu ajan sistemlerinin LLM canlanımı resmi semantik olmadan sessizce aynı fikirleri yeniden uyguluyor: JSON sözleşmeleri performatifler için, doğal dil ontolojiler için yer almaktadır. Bu ders, FIPA-ACL'yi ciddiye alır, böylece 2026 protokolü kararlarının hangi yenilikleri yeniden icat ettiğini ve bugünkü dalgaların 2000'lerde çözülen sorunları yeniden keşfetmeye çalıştığını görebilirsiniz.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Sorun

2026 ajan-protokolu manzarası yoğun: araçlar için MCP, ajanlar için A2A, kurumsal denetim için ACP, merkezi olmayan güven için ANP, doğal dil içerikleri için NLIP, CA-MCP ve iki düzine araştırma önerisi.

Dürüst bir şekilde, çoğu, 20 yıllık bir karar ağacını yeniden keşfediyor. Austin (1962) ve Searle (1969) 'dan konuşma-işleyiş teorisi bize "sözler eylemlerdir". KQML (1993) bunu bir tel protokolüne dönüştürdü. FIPA-ACL (takatlenmiş 2000), referans standartlaştırmasını üretti: yirmi performatif, içerik dilleri SL0/SL1, sözleşme ağı ve abone-bilgi için etkileşim protokolleri. JADE ve JACK Java referans platformlarıydı. 2010 civarında çabalar sönmüştü çünkü ontoloji üst ücreti çok ağırydı ve web kazanıyordu.

MCP'ye baktığınızda`tools/call`Bu nedenle, A2A'nın görev yaşam döngüsü veya CA-MCP'nin paylaşılan bağlam depoları, FIPA kararlarının daha yumuşak ve JSON'a özgü bir yeniden dönüşümünü görüyor.

## Anlam

### Konuşma aktları, tek bir paragraf

Austin bazı cümlelerin dünyayı tanımlamadığını fark etti  değiştirirler. "Vadiyorum". "İsteyim". "Bilgiliyim". "Bu performanssal ifadelerdi". Searle beş kategorisi resmileştirdi: asertif, yönetici, komisyon, ifadeci, açıklayıcı. KQML (Finin et al., 1993) bunu yazılım ajanları için işlevsel hale getirdi: bir mesaj performatif (hareketi) artı içeriğe (hareketin ne hakkında olduğu) sahiptir. FIPA-ACL KQML'in boşluklarını temizledi ve yirmi kadar performatif standartlaştırdı.

### FIPA'nın yirmi performatifleri ( kısmi liste)

| Performative | Intent |
|---|---|
| `inform` | "I tell you P is true" |
| `request` | "I ask you to do X" |
| `query-if` | "Is P true?" |
| `query-ref` | "What is the value of X?" |
| `propose` | "I propose we do X" |
| `accept-proposal` | "I accept the proposal" |
| `reject-proposal` | "I reject the proposal" |
| `agree` | "I agree to do X" |
| `refuse` | "I refuse to do X" |
| `confirm` | "I confirm P is true" |
| `disconfirm` | "I deny P" |
| `not-understood` | "Your message did not parse" |
| `cfp` | "Call for proposals on X" |
| `subscribe` | "Notify me when X changes" |
| `cancel` | "Cancel the ongoing X" |
| `failure` | "I tried X and failed" |

Tam listesi var .`fipa00037.pdf`Bu konunun bir kısmını akılda tutmak değil, bunların her biri bir LLM protokolüyle aynıdır.

### Kanonik FIPA-ACL mesajı

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

Protokol zarfını taşıyan yedi alan; bir alan (`content`Diğer alanlar, her tekrar deneme, ipleme ve ontolojiyi JSON protokolüne eklediğinizde tam olarak yeniden icat ettiğiniz şeydir.

### İki eski platform

**JADE**(Java Agent DEvelopment framework, 19992020s) en çok kullanılan FIPA uyumlu çalıştırma süresiydi. Ajanlar bir temel sınıfı genişletti, ACL mesajları değiştirdi, konteynerler içinde çalıştı ve "hareketi" kullanarak koordinat etti.

**JACK**(Agent Oriented Software, ticari) FIPA mesajlarının üstesinden gelen BDI (İman-İstelik-İstelik) mantıklamasını vurguladı.

Web stack çoklu ajan kullanım durumlarını yediğinde her ikisi de düştü. MCP ve A2A 2026'daki çalıştırma zamanındaki "konteynerler"dir.

### FIPA'nın neden kaybolduğunu

- **Ontology overhead.**FIPA , analiz için ortak bir ontoloji gerektirdi .`content`Ontolojiler konusunda anlaşmak yıllarca süren standart süreçtir.
- **Formal semantics nobody used.**SL (Semantik Dil) sıkı gerçek koşulları verdi, ancak çoğu üretim sistemi serbest biçim içerik kullanıyordu ve formallığı görmezden gelmişti.
- **Tooling lock-in.**JADE sadece Java'da, Jack ise ticari bir programdı.
- **The internet won the stack.**REST, sonra JSON-RPC, sonra gRPC ACL'nin taşıma yerini aldı.

### LLM yeniden canlandırılması FIPA-lite

FIPA'yı karşılaştırın `request`Bir MCP'ye`tools/call`- ...

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

Aynı zarf, farklı sözcük. Her ikisi de taşıyor: kim, kim, niyet, payload, ilişki kimliği.

Liu et al. tarafından 2025 tarihli araştırması ("A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279) bu soyunu açıkça gösterir: MCP araç kullanımı konuşma eylemlerine, A2A ajan-teke konuşma eylemlerine, ACP denetim iz konuşma eylemlerine, ANP merkezi olmayan kimlik uzantılarına karşılık gelir. Yeni özellikler JSON sentaksisi ve gevşek semantik ile ACL'in soyuncusu.

### Açıkça belirtilen,

**What FIPA gave you and modern specs drop:**

- Formal semantik  kanıtlayabilirsiniz `inform`göndericinin içeriğe inandığını gösterir.
- Bir performatif kataloğu  tekrar tartışmak zorunda değilsiniz "eğer bir `cancel`"
- On yıllardır etkileşim-protokola kalıpları  sözleşme-net, abone-bilgi, öner- Kabul  bilinen doğruluk özellikleri ile.

**What modern specs give you and FIPA did not:**

- JSON-devde gelen payloadlar, her modern araçla uyumludur.
- LLM'lerin el kodlanmış ontoloji olmadan yorumlayabileceği doğal dil içerikleri.
- Web-stack taşımacılığı (HTTP, SSE, WebSocket).
- Canlı MCP üzerinden yetenek keşfi `server/discover`A2A Ajan Kartları.

Daha kolay uygulanmak için gevşek niyet semantikası.

### Portlamaya değer etkileşim protokolleri

FIPA 15 etkileşim protokolü gönderdi.

1. **Contract Net Protocol (CNP).**Yöneticilerle ilgili sorunlar `cfp`(yardım çağrısı); teklif verenler cevap verirken `propose`Bu, görev pazarının kanonik örneğidir (16 · 16 müzakere aşaması).
2. **Subscribe/Notify.**Abone gönderir `subscribe`; yayıncı gönderir `inform`Bu 2026'da her etkinlik otobüsü.
3. **Request-When.**"Y koşulları geçerli olduğunda X yapın". Ön koşullarla gecikmiş eylem. 2026 analog, dayanıklı çalışma akışı motorlarında gecikmiş görevlerdir (Fase 16 · 22 Üretim ölçeklemesi).

Her haritada modern mesaj kuyrukları, HTTP + anketleri veya SSE akışı bulunur.

### Ontolojiyi bırakırken ne kırılır?

Ortak bir ontoloji olmadan, ajanlar doğal dil içeriklerinden anlam çıkarırlar.**semantic drift**: iki ajan aynı kelimeyi kullanır (`"customer"`) ince farklı kavramlar için, alıcının ajanı yanlış yorum üzerine hareket eder, hiçbir schema validator onu yakalamaz. FIPA'nın ontoloji talebi mesajı analiz zamanında reddetmiş olurdu.

Tam ontoloji olmadan azaltmalar:

- JSON Şeması `content` teldeki yapısal hataları reddeder.
- Tipli eserler (A2A)  yanlış modaliteyi reddeder.
- Kapakta açık performatif , içerik doğal dil olduğunda bile niyetini belirgin hale getirir.

### 2026 özellikleri, konuşma-işlev mirası ile haritası

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

Tabloyu yukarıdan aşağıya okuyarak, örneği şöyle: yapısal ilkelliği koruyun, formallığı bırakın, LLM'lerin belirsizliği ele almasına izin verin.

```figure
sw-contract-net
```

## Yapın

`code/main.py`MCP / A2A mesaj şeklinin aynı yedi alanı nasıl azaltdığını gösterir.

- Beş MCP ve A2A biçimindeki mesajı FIPA-ACL olarak kodlar.
- FIPA-ACL'yi modern eşdeğeri olarak dekode eder.
- Oyuncak çalıştırma Sözleşmesi Bir yöneticiden üç teklifci arasında net pazarlama`cfp`- Evet .`propose`- Evet .`accept-proposal`- Evet .`reject-proposal`- Evet .

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktı, her modern mesajı hem 2026 JSON formunda hem de FIPA-ACL formunda, ardından bir sözleşme ağ teklifinin bir geri dönüş yolu gösterir. Aynı protokol ilkesi geri dönüş yolu hayatta kalır; sadece sentezi farklıdır.

## Kullan

`outputs/skill-fipa-mapper.md`Bu, bir ajan-protokolu özelliklerini okuyan ve FIPA-ACL haritasını üreten bir beceri.`inform`JSON sözcükleri ile mi?"

## Gönder

FIPA-ACL'i geri getirmeyin.

- Her mesajın ilk amacı nedir?
- İstek- yanıt ve iptal için bir ilişki kimliği var mı?
- Açık bir içerik dili var mı (JSON-RPC, düz metin, yapılandırılmış yazılı eser)?
- Etkinlik protokolleri birinci sınıf mı yoksa yeni bir sözleşme sistemi mi var?
- İki ajan içeriğin anlamı hakkında anlaşmazlıklarda (semantik sürükleme) ne olur?

Bu beş soruyu, yeni bir protokol için üretime göndermeden önce belgeleyin.

## Egzersizler

1. Çık .`code/main.py`.Geri-geri kodlama gözlemleyin. FIPA performatifinin hangi ile karşılık geldiğini belirleyin `tools/call`- Evet .`resources/read`, ve A2A görev oluşturma.
2. Sözleşme ağı gösterisini bir  ile uzatın`cancel`Bu, yöneticinin görevleri orta teklif sırasında geri çekmesine izin veren performatif.`cancel`Tekrar denemeyi çözmek için değil mi?
3. FIPA ACL Mesaj Yapısı (http://www.fipa.org/specs/fipa00037/Bu dersde ele alınmayan bir performatif seçin ve modern JSON-RPC analogunu açıklayın.
4. Liu et al., arXiv:2505.02279. MCP, A2A, ACP, ANP'lerin her biri için, FIPA'nın sürdürdüğü ve bıraktıkları performatif ailelerini listelenin.
5.  için en az bir JSON-Skeması tasarlayın`content`bir alanı `request`Bu şema size doğal dilin yapmadığı neyi verir ve maliyeti ne kadar?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions. The theoretical parent of ACL. |
| FIPA | "That old XML thing" | Foundation for Intelligent Physical Agents. Standardized ACL in 2000; became an IEEE Computer Society standards committee in 2005. |
| ACL | "Agent Communication Language" | FIPA's envelope format: performative + content + metadata. |
| Performative | "The verb" | The intent class of a message: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993). Simpler, narrower. |
| Ontology | "Shared vocabulary" | A formal definition of the concepts the content language talks about. |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1 — the formal content language family. |
| Contract Net | "Task market" | Manager issues cfp; bidders propose; manager accepts. The canonical interaction protocol. |
| Interaction protocol | "Pattern of messages" | A sequence of performatives with known correctness: request-when, subscribe-notify, etc. |

## Daha Fazla Okumak

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) Modern özellikleri FIPA mirası ile bağlayan 2025 Kanonik Anket
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) Ratifik edilmiş 2000 zarfı biçimi
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) Tam performans kataloğu
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) mevcut devletsiz araç kullanımı eşdeğeri `request`- Ne ?`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/) Modern ajan-e eşdeğerlik sözleşme-net ve abone-bilgi
