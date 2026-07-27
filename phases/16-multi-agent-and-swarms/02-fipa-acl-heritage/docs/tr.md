# FIPA-ACL Mirası ve Söz Eylemleri

> MCP'den önce, A2A'dan önce FIPA-ACL vardı. 2000 yılında IEEE Akıllı Fiziksel Agent Vakfı, yirmi icra edici, iki içerik dili ve bir dizi etkileşim protokolü (sözleşme ağı, abone olma/bildirim, istek-zaman) içeren bir agent iletişim dilini onayladı. Ontoloji yükünün web için çok ağır olması nedeniyle endüstriden silindi, ancak çoklu-agent sistemlerin LLM'nin yeniden canlandırılması aynı fikirleri biçimsel anlambilim olmadan sessizce yeniden uyguluyor: JSON sözleşmeleri edimsellerin yerini alıyor, doğal dil ontolojilerin yerini alıyor. Bu derste FIPA-ACL ciddi bir şekilde ele alınmaktadır, böylece hangi 2026 protokol kararlarının yeniden icat edildiğini, hangilerinin yenilik olduğunu ve mevcut dalganın 2000'li yıllarda halihazırda çözülmüş olan sorunları nerede yeniden keşfedeceğini görebilirsiniz.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 01 (Neden Çoklu-Agent)
**Süre:** ~60 dakika

## Sorun

2026 agent-protokol ortamı meşgul: araçlar için MCP, agent'lar için A2A, kurumsal denetim için ACP, merkezi olmayan güven için ANP, doğal dil içeriği için NLIP, artı CA-MCP ve iki düzine araştırma teklifi. Her spesifikasyon kendisini temel olarak duyurur.

Doğrusunu söylemek gerekirse çoğu, yirmi yıllık çok spesifik bir karar ağacını yeniden keşfediyor. Austin (1962) ve Searle'nin (1969) konuşma eylemi teorisi bize "sözler eylemlerdir" fikrini verdi. KQML (1993) bunu kablolu bir protokole dönüştürdü. FIPA-ACL (2000'de onaylandı) referans standardizasyonunu üretti: yirmi icra edici, içerik dilleri SL0/SL1, sözleşme ağı ve abone olma bildirimi için etkileşim protokolleri. JADE ve JACK, Java referans platformlarıydı. Ontoloji yükünün çok ağır olması ve web'in kazanması nedeniyle bu çaba 2010 yılı civarında azaldı.

MCP'nin `tools/call`, A2A'nın görev yaşam döngüsüne veya CA-MCP'nin paylaşılan içerik deposuna baktığınızda, FIPA kararlarının daha yumuşak, JSON yerel yeniden sunumuna bakıyorsunuz. Mirası bilmek size iki şeyi anlatır: Hangi yeni "yenilikler" aslında yeniden icattır ve yeni spesifikasyonların hangi eski başarısızlık modlarını yeniden keşfedeceği.

## Konsept

### Konuşma eylemleri, tek paragrafta

Austin bazı cümlelerin dünyayı tanımlamadığını, onu değiştirdiğini fark etti. "Söz veriyorum." "İsterim." "İlan ediyorum." Bu icracı ifadelere adını verdi. Searle beş kategoriyi resmileştirdi: iddialı, yönlendirici, uzlaşmacı, ifade edici, bildirimsel. KQML (Finin ve diğerleri, 1993) bunu yazılım agent'ları için işlevsel hale getirdi: mesaj, icra edici (eylem) artı içeriktir (eylem neyle ilgilidir). FIPA-ACL, KQML'deki boşlukları temizledi ve yaklaşık yirmi icra ediciyi standartlaştırdı.

### Yirmi FIPA icracı (kısmi liste)

| Performatif | Niyet |
|---|---|
| `inform` | "Size P'nin doğru olduğunu söylüyorum" |
| `request` | "Sizden X yapmanızı istiyorum" |
| `query-if` | "P doğru mu?" |
| `query-ref` | "X'in değeri nedir?" |
| `propose` | "X yapmayı öneriyorum" |
| `accept-proposal` | "Teklifi kabul ediyorum" |
| `reject-proposal` | "Teklifi reddediyorum" |
| `agree` | "X yapmayı kabul ediyorum" |
| `refuse` | "X yapmayı reddediyorum" |
| `confirm` | "P'nin doğru olduğunu onaylıyorum" |
| `disconfirm` | "P'yi reddediyorum" |
| `not-understood` | "Mesajınız ayrıştırılamadı" |
| `cfp` | "X ile ilgili teklif çağrısı" |
| `subscribe` | "X değiştiğinde bana haber ver" |
| `cancel` | "Devam eden X'i iptal et" |
| `failure` | "X'i denedim ve başarısız oldum" |

Tam liste `fipa00037.pdf` (FIPA ACL Mesaj Yapısı) içindedir. Önemli olan onu ezberlemek değil; önemli olan, bunların her birinin, sonunda yeniden eklenen ilkel bir LLM protokolüne karşılık gelmesidir.

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

Yedi alan protokol zarfını taşır; bir alan (`content`) yükü taşır. Geri kalan alanlar, yeniden denemeleri, iş parçacığını ve ontolojiyi bir JSON protokolüne her cıvataladığınızda tam olarak yeniden keşfedeceğiniz şeylerdir.

### İki eski platform

**JADE** (Java Agent DEvelopment framework, 1999–2020'ler) en çok kullanılan FIPA uyumlu çalışma zamanıydı. Agentbir temel sınıfı genişletti, ACL mesajları alışverişinde bulundu, konteynerlerin içinde çalıştı ve "davranışları" kullanarak koordine etti. Etkileşim protokolü kütüphanesi, sözleşme ağı, abone ol-bildir, talep-ne zaman ve teklif-kabul et ile birlikte gönderilir.

**JACK** (Agent Odaklı Yazılım, ticari), FIPA mesajlarının yanı sıra BDI (İnanç-Arzu-Niyet) mantığını vurguladı. Daha resmi, daha az benimsenmiş.

Web yığını çoklu agent kullanım senaryosunu tükettiğinde her ikisi de reddedildi. MCP ve A2A, 2026'nın çalışma zamanı "kapsayıcılarıdır".

### FIPA neden söndü

- **Ontoloji ek yükü.** FIPA, `content`'yi ayrıştırmak için paylaşılan bir ontoloji gerektiriyordu. Ontolojiler üzerinde anlaşmaya varmak yıllar süren bir standartlar sürecidir. Web az önce HTTP + JSON kullandı.
- **Kimse biçimsel anlambilimi kullanmadı.** SL (Semantik Dil) katı doğruluk koşulları sağladı, ancak çoğu üretim sistemi serbest biçimli içerik kullandı ve biçimciliği göz ardı etti.
- **Takım kilitlenmesi.** JADE yalnızca Java'ydı; JACK ticari bir şeydi. Polyglot ekipleri her ikisinin de etrafından dolaştı.
- **İnternet yığını kazandı.** ACL'nin aktarımının yerini REST, ardından JSON-RPC ve gRPC aldı.

### LLM'nin yeniden canlanması FIPA-lite'dir

FIPA `request` ile MCP `tools/call`'yi karşılaştırın:

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

Aynı zarf, farklı sözdizimi. Her ikisi de şunları taşır: kim, kim, niyet, yük, korelasyon kimliği. İkisi de diğerine göre bir devrim değildir; bunlar aynı tasarım üzerinde farklı değiş-tokuşlardır.

Liu ve arkadaşlarının 2025 anketi. ("Agent Birlikte Çalışabilirlik Protokolleri Araştırması: MCP, ACP, A2A, ANP", arXiv:2505.02279) bu kökeni açıkça ortaya koymaktadır: MCP, araç kullanımlı konuşma eylemlerine, A2A'dan agent-eş konuşma eylemlerine, ACP denetim takibi konuşma eylemlerine, ANP merkezi olmayan kimlik uzantılarına karşılık gelir. Yeni özellikler, JSON sözdizimine ve daha gevşek anlambilime sahip ACL'nin soyundan gelenlerdir.

### Takas, açıkça ifade edildi

**FIPA'nın size sundukları ve modern teknik özelliklerin düşüşü:**

- Biçimsel anlambilim — `inform` ifadesinin gönderenin içeriğe inandığını ima ettiğini kanıtlayabilirsiniz.
- Performatiflerin kanonik bir kataloğu — " `cancel`'ya sahip olmalı mıyız?" diye yeniden tartışmanıza gerek yok.
- Bilinen doğruluk özelliklerine sahip onlarca yıllık etkileşim protokolü kalıpları - sözleşme ağı, abone ol-bildir, teklif et-kabul et.

**Modern özelliklerin size sağladığı ve FIPA'nın sağlamadığı özellikler:**

- Her modern araçla uyumlu JSON yerel verileri.
- Yüksek Lisans öğrencilerinin elle kodlanmış bir ontoloji olmadan yorumlayabileceği doğal dil içeriği.
- Web yığını aktarımı (HTTP, SSE, WebSocket).
- Kendini açıklayan belgeler (MCP `listTools`, A2A Agent Kartı) aracılığıyla yetenek keşfi.

Daha kolay uygulama için daha gevşek amaç semantiği. Tam ticaret budur.

### Taşımaya değer etkileşim protokolleri

FIPA ~15 etkileşim protokolü gönderdi. Bunlardan üçü Yüksek Lisans çoklu-agent sistemlerine taşınmaya değer:

1. **Sözleşme Net Protokolü (CNP).** Yönetici, `cfp` (teklif çağrısı); teklif sahipleri `propose` ile yanıt verir; yönetici kabul eder/reddeder. Bu, kanonik görev pazarı modelidir (Aşama 16 · 16 Müzakere).
2. **Abone Ol/Bildir.** Abone `subscribe`'yi gönderir; yayıncı konu değiştiğinde `inform` gönderir. Bu 2026'daki tüm etkinlik otobüsleri.
3. **İstek-Ne zaman.** "Y koşulu geçerli olduğunda X'i yapın." Ön koşullarla gecikmeli eylem. 2026 analogu, dayanıklı iş akışı motorlarındaki ertelenmiş görevlerdir (Aşama 16 · 22 Üretim Ölçeklendirmesi).

Her biri modern mesaj kuyruklarına, HTTP + yoklamasına veya SSE akışına temiz bir şekilde eşlenir.

### Ontolojiyi bıraktığınızda ne bozulur?

Paylaşılan bir ontoloji olmadan, agent'lar doğal dil içeriğinden anlam çıkarır. Belgelenen 2026 hata modu **semantik sapma**dır: iki agent aynı kelimeyi (`"customer"`) çok farklı kavramlar için kullanır, alıcının agent'si yanlış yorumlamaya göre hareket eder, hiçbir şema doğrulayıcı onu yakalayamaz. FIPA'nın ontoloji gereksinimi, mesajı ayrıştırma sırasında reddederdi.

Tam ontolojiye geçmeden hafifletmeler:

- `content` üzerindeki JSON Şeması — kablodaki yapısal hataları reddeder.
- artifacts (A2A) yazıldı — yanlış yöntemi reddeder.
- Zarfın içinde açık icra edici — içerik doğal dil olduğunda bile niyeti belirsizliğe yer bırakmaz.

### Konuşma eylemi mirasıyla eşleştirilen 2026 spesifikasyonları

| Modern özellikler | FIPA analogu | Ne tutar | Ne düşer |
|---|---|---|---|
| MCP `tools/call` | `request` | açık amaç, korelasyon kimliği | biçimsel anlambilim, ontoloji |
| MCP `resources/read` | `query-ref` | açık amaç, korelasyon kimliği | biçimsel anlambilim |
| A2A Görev yaşam döngüsü | sözleşme-net + istek-ne zaman | eşzamansız yaşam döngüsü, durum geçişleri | resmi tamlık garantileri |
| A2A yayın etkinlikleri | abone ol/bildir | eşzamansız itme | yazılan yüklem aboneliği |
| CA-MCP paylaşılan bağlamı | karatahta (Hayes-Roth 1985) | çok yazarlı paylaşımlı hafıza | mantıksal tutarlılık modeli |
| NLİP | doğal dil içeriği | Yüksek Lisans-yerli | şema |

Tabloyu yukarıdan aşağıya doğru okuduğunuzda, kalıp şu şekildedir: Yapısal ilkelliği koruyun, formalizmi bırakın, Yüksek Lisans'ın belirsizliği ele almasına izin verin.

## Build It — Kendin Geliştir

`code/main.py` saf stdlib FIPA-ACL çeviricisini uygular. Kanonik ACL zarfını kodlar ve kodunu çözer ve her MCP / A2A mesaj şeklinin nasıl aynı yedi alana indirgendiğini gösterir. Demo:

- Beş MCP tarzı ve A2A tarzı mesajı FIPA-ACL olarak kodlar.
- FIPA-ACL'nin kodunu modern eşdeğerine geri çevirir.
- Bir yönetici ile üç teklif sahibi arasında `cfp`, `propose`, `accept-proposal`, `reject-proposal` kullanarak oyuncak bir Sözleşme Ağı görüşmesi yürütür.

Koşmak:

```
python3 code/main.py
```

Çıktı, her modern mesajı hem 2026 JSON formunda hem de FIPA-ACL formunda gösteren yan yana bir izlemedir ve ardından sözleşme net teklifinin gidiş-dönüş yolculuğudur. Aynı protokol ilkelleri gidiş dönüşte hayatta kalır; yalnızca sözdizimi farklıdır.

## Use It — Hazır Araçla Uygula

`outputs/skill-fipa-mapper.md` , herhangi bir agent-protokol spesifikasyonunu okuyan ve FIPA-ACL eşlemesini üreten bir beceridir. Yeni bir protokol benimsemeden önce şunu yanıtlamak için bunu kullanın: "Bu gerçekten yeni mi, yoksa JSON sözdizimine sahip `inform` mi?"

## Ship It — Kullanıma Sun

FIPA-ACL'yi geri getirmeyin. Kontrol listesini geri getirin:

- Her mesajın ilkel (performatif) amacı nedir?
- İstek-yanıt ve iptal için korelasyon kimliği var mı?
- Açık bir içerik dili var mı (JSON-RPC, düz metin, yapılandırılmış tipte artifact)?
- Etkileşim protokolleri birinci sınıf mı yoksa sözleşme ağını sıfırdan mı uyguluyorsunuz?
- İki agent içerik anlamı konusunda anlaşmazlığa düşerse (anlam kayması) ne olur?

Üretime göndermeden önce herhangi bir yeni protokol için bu beş soruyu belgeleyin.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Gidiş-dönüş kodlamasına dikkat edin. Hangi FIPA icra edicisinin `tools/call`, `resources/read` ve A2A görev oluşturmaya karşılık geldiğini belirleyin.
2. Sözleşme ağı demosunu, yöneticinin teklifi ortasında görevi geri çekmesine olanak tanıyan bir `cancel` icra edici ile genişletin. `cancel` tek başına yeniden denemelerin çözemediği hangi başarısızlık durumunu çözer?
3. FIPA ACL Mesaj Yapısı (http://www.fipa.org/specs/fipa00037/) bölüm 4.1–4.3'ü okuyun. Bu derste ele alınmayan bir icra edici seçin ve onun modern JSON-RPC analogunu açıklayın.
4. Liu ve diğerleri, arXiv:2505.02279'u okuyun. MCP, A2A, ACP, ANP'nin her biri için tuttukları ve bıraktıkları FIPA performans ailelerini listeleyin.
5. Kendi sisteminizde bir `request` icra edicisinin `content` alanı için minimal bir JSON-Şeması tasarlayın. Bu şema size saf doğal dilin sağlayamadığı neyi veriyor ve bunun maliyeti nedir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Konuşma eylemi | "Bir şey yapan bir ifade" | Austin/Searle: Eylem olarak sözler. ACL'nin teorik ebeveyni. |
| FIPA | "Şu eski XML olayı" | Akıllı Fiziksel Agent'ler için IEEE Vakfı. 2000 yılında standartlaştırılmış ACL. |
| EKL | "Agent İletişim Dili" | FIPA'nın zarf formatı: performans + içerik + meta veriler. |
| Performatif | "Fiil" | Bir mesajın niyet sınıfı: `inform`, `request`, `propose`, `cfp`, vb. |
| KQML | "FIPA'nın selefi" | Bilgi Sorgulama ve Manipülasyon Dili (1993). Daha basit, daha dar. |
| Ontoloji | "Paylaşılan kelime dağarcığı" | İçerik dilinin bahsettiği kavramların resmi tanımı. |
| SL0 / SL1 | "FIPA içerik dilleri" | Anlamsal Dil düzeyleri 0 ve 1 — biçimsel içerik dili ailesi. |
| Sözleşme Ağı | "Görev pazarı" | Yönetici cfp'yi yayınlar; teklif verenler teklif ediyor; yönetici kabul eder. Kanonik etkileşim protokolü. |
| Etkileşim protokolü | "Mesajların düzeni" | Doğruluğu bilinen icra ediciler dizisi: istek-ne zaman, abone ol-bildir, vb. |

## Daha Fazla Okuma

- [Liu ve ark. — Agent Birlikte Çalışabilirlik Protokolleri Araştırması: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) — modern spesifikasyonları FIPA mirasına bağlayan standart 2025 anketi
- [FIPA ACL Mesaj Yapısı Belirtimi (fipa00037)](http://www.fipa.org/specs/fipa00037/) — onaylanmış 2000 zarf formatı
- [FIPA İletişimsel Eylem Kitaplığı Spesifikasyonu (fipa00037)](http://www.fipa.org/specs/fipa00037/) — tam performans kataloğu
- [MCP spesifikasyonu 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — `request`/`query-ref`'nin modern araç kullanımı eşdeğeri
- [A2A spesifikasyonu](https://a2a-protocol.org/latest/specification/) — sözleşme ağı ve abone bildiriminin modern agent-eş eşdeğeri
