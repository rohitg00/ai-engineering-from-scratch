# A2A — Agent-to-Agent Protokolü

> Google, Nisan 2025'te A2A'yı duyurdu; Nisan 2026 itibariyle spesifikasyon https://a2a-protocol.org/latest/specification/ seviyesindedir ve 150'den fazla kuruluş bunu desteklemektedir. A2A, MCP'nin yatay tamamlayıcısıdır (Ders 13): MCP dikey olduğunda (agent ↔ araçlar), A2A eşler arasıdır (agent ↔ agent). Agent Kartları (keşif), artifact'li görevleri (metin, yapılandırılmış veri, video), opak görev yaşam döngülerini ve kimlik doğrulamayı tanımlar. Üretim sistemleri MCP'yi A2A ile giderek daha fazla eşleştiriyor. Google Cloud, 2025-2026 döneminde A2A desteğini Vertex AI Agent Builder'a dahil etti.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib, `http.server`, `json`)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model)
**Süre:** ~75 dakika

## Sorun

agent cihazınızın başka bir sistemdeki başka bir agent'ı araması gerekiyor. Nasıl? Bir HTTP uç noktasını açığa çıkarabilir, özel bir JSON şeması tanımlayabilir ve karşı tarafın bunu konuşmasını umabilirsiniz. Her agent çifti özel bir entegrasyona dönüşür.

A2A bu çağrı için evrensel kablolu protokoldür. Standart keşif, standart görev modeli, standart taşıma, standart artifact'lar. HTTP+REST gibi ama birinci sınıf vatandaşlar olarak agent'lar için.

## Konsept

### Dört element

**Agent Kart.** `/.well-known/agent.json` adresinde, agent'ı açıklayan bir JSON belgesi: ad, beceriler, uç noktalar, desteklenen yöntemler, kimlik doğrulama gereksinimleri. Keşif, kartı okuyarak gerçekleşir.

```
GET https://agent.example.com/.well-known/agent.json
→ {
    "name": "code-review-agent",
    "skills": ["review-python", "review-typescript"],
    "endpoints": {
      "tasks": "https://agent.example.com/tasks"
    },
    "auth": {"type": "bearer"},
    "modalities": ["text", "structured"]
  }
```

**Görev.** İş birimi. Yaşam döngüsüne sahip eşzamansız, durum bilgisi olan bir nesne: `submitted → working → completed / failed / canceled`. Bir müşteri bir görev gönderir, anket yapar veya güncellemelere abone olur.

**Artifact.** Bir görevin ürettiği sonuç türü. Metin, yapılandırılmış JSON, resim, video, ses. Artifact'ler farklı yöntemler birinci sınıf olacak şekilde yazılmıştır.

**Opak yaşam döngüsü.** A2A, uzaktan kumandanın agent görevi *nasıl* çözeceğini belirtmez. İstemci durum geçişlerini ve artifact'lari görür; uygulamanın herhangi bir framework'ü kullanması ücretsizdir.

### MCP/A2A ayrımı

- **MCP** (Ders 13): agent ↔ aracı. agent, JSON-RPC aracılığıyla bir araç sunucusuna okur/yazar. Varsayılan olarak durum bilgisizdir.
- **A2A**: agent ↔ agent. Eş protokolü; her iki taraf da kendi mantıklarıyla agent'lardır.

Üretim çoklu-agent sistemleri her ikisini de kullanır. Bir A2A eşi, MCP araçlarını kendi tarafında çağırır. Bölünme iki endişeyi temiz tutuyor.

### Keşif akışı

```
Client                     Agent server
  ├──GET /.well-known/agent.json──>
  <──Agent Card JSON─────────────
  ├──POST /tasks {skill, input}──>
  <──201 task_id, state=submitted
  ├──GET /tasks/{id}──────────────>
  <──state=working, 42% done──────
  ├──GET /tasks/{id}──────────────>
  <──state=completed, artifacts──
```

Veya akışla: Push güncellemeleri için `/tasks/{id}/events` SSE aboneliği.

### Yetki

A2A üç ortak modeli destekler:

- **Taşıyıcı token** — OAuth2 veya opak.
- **mTLS** — karşılıklı TLS; Organizasyonlar birbirlerine kimliklerini kanıtlarlar.
- **İmzalı istekler** — Yük üzerinden HMAC.

Kimlik doğrulaması Agent Kartında bildirilir; Müşteriler keşfeder ve bunlara uyar.

### Nisan 2026 itibarıyla 150'den fazla kuruluş

Kurumsal benimseme A2A ölçeğini artırdı. Başlık: A2A, kurumsal agent sistemlerinin güven sınırlarını aşma yöntemi haline geldi. Google Cloud, Vertex AI Agent Builder A2A desteğini sundu; Microsoft Agent Framework bunu destekliyor; büyük framework'lerin çoğu (LangGraph, CrewAI, AutoGen) A2A adaptörleri gönderir.

### A2A'nın kazandığı yer

- **Kuruluşlar arası aramalar.** A şirketindeki Agent, B şirketindeki agent'ı arar. A2A olmadan, her çift özel bir sözleşmedir.
- **Heterojen framework'ler.** LangGraph agent CrewAI'yi çağırır agent özel Python'u agent çağırır. A2A normalleşir.
- **artifacts yazıldı.** Video sonucu, yapılandırılmış JSON, ses — hepsi birinci sınıf.
- **Uzun süren görevler.** Opak yaşam döngüsü + yoklama, saatlerce süren görevleri kolaylaştırır.

### A2A'nın mücadele ettiği yer

- **Gecikmeye duyarlı mikro çağrılar.** A2A'nın yaşam döngüsü eşzamansızdır. Milisaniyenin altındaki agent-to-agent uymuyor; doğrudan RPC'yi kullanın.
- **Sıkı bağlantılı işlem içi agent'lar.** Her iki agent'ın ikisi de aynı Python işleminde çalışırsa, A2A'nın HTTP gidiş-dönüş süreci aşırıya kaçar.
- **Küçük ekipler.** Teknik özellikler gerçektir; yalnızca dahili agent'lar formaliteye ihtiyaç duymayabilir.

### A2A ile ACP, ANP, NLIP karşılaştırması

2024-2026'da ilgili birkaç spesifikasyon ortaya çıktı:

- **ACP** (IBM/Linux Foundation) — A2A'nın öncülü, daha dar kapsam.
- **ANP** (Agent Ağ Protokolü) — eş-keşif ağırlıklı, merkezi olmayan öncelikli.
- **NLIP** (Ecma Doğal Dil Etkileşim Protokolü, Aralık 2025'te standartlaştırılmıştır) — doğal dil içerik türü.

A2A, Nisan 2026 itibarıyla en çok benimsenen eş protokoldür. Karşılaştırma için bkz. arXiv:2505.02279 (Liu ve diğerleri, "Agent Birlikte Çalışabilirlik Protokolleri Araştırması").

## Build It — Kendin Geliştir

`code/main.py` , `http.server` ve JSON kullanarak minimum A2A sunucusu ve istemcisini uygular. Sunucu:

- `/.well-known/agent.json`'yi ortaya çıkarır,
- `POST /tasks`'yi kabul eder,
- görev durumunu yönetir,
- `GET /tasks/{id}` üzerinde artifact'lari döndürür.

Müşteri:

- Agent Kartını alır,
- bir görev gönderir,
- Tamamlanana kadar anketler,
- artifact okur.

Koşmak:

```
python3 code/main.py
```

Betik, sunucuyu bir arka plan iş parçacığında başlatır, ardından istemciyi buna karşı çalıştırır. Akışın tamamını görüyorsunuz: keşfetme, gönderme, anket, artifact.

## Use It — Hazır Araçla Uygula

`outputs/skill-a2a-integrator.md` bir A2A entegrasyonu tasarlar: Agent Kart içerikleri, görev şemaları, kimlik doğrulama seçimi, akış ve yoklama.

## Ship It — Kullanıma Sun

Kontrol listesi:

- **Özellik sürümünü sabitleyin.** A2A hâlâ gelişiyor; Agent Kartı protokol sürümünü beyan etmelidir.
- **Idempotent görev oluşturma.** Yinelenen gönderimler (ağ yeniden denemeleri) bir görev oluşturmalıdır.
- **Artifact şemaları.** agent'ın döndürdüğü şekillerin ne olduğunu bildirin; Tüketiciler doğrulamalıdır.
- **Ücret sınırları + yetkilendirme** A2A halka açıktır; standart web güvenliğini uygulayın.
- **Başarısız görevler için geçerli olmayan harfler.** Tekrarlanan hata türleri için zaman içindeki kalıpları inceleyin.

## Egzersizler

1. `code/main.py`'yı çalıştırın. İstemcinin sunucuyu bulduğunu ve doğru artifact'yu aldığını doğrulayın.
2. Sunucuya ikinci bir beceri ekleyin (e.g., "özetleme"). Agent Kartını güncelleyin. Görev türüne göre beceriyi seçen bir istemci yazın.
3. Durum değişikliklerini yayan bir SSE akış uç noktası uygulayın: `/tasks/{id}/events` . Müşterinin neyi farklı yapması gerekiyor?
4. A2A spesifikasyonunu okuyun (https://a2a-protocol.org/latest/specification/). Spesifikasyonun zorunlu kıldığı ancak bu demoda uygulanmayan üç şeyi tanımlayın.
5. A2A'yı (Agent Kart keşfi) MCP ( `listTools` aracılığıyla sunucu tarafı yetenek listesi) ile karşılaştırın. Kendini tanımlayan agent'lar ile yetenek araştırması arasındaki denge nedir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| A2A | "Agent-to-agent" | agent'larin sistemler genelinde diğer agent'lari aramasına yönelik eş protokol. Google 2025. |
| Agent Kart | "agent'ın kartviziti" | `/.well-known/agent.json` adresindeki JSON, becerileri, uç noktaları, kimlik doğrulamayı açıklıyor. |
| Görev | "İş birimi" | Yaşam döngüsüne sahip eşzamansız durum bilgisi olan nesne; Tamamlandığında artifact üretildi. |
| Artifact | "Sonuç" | Yazılan çıktı: metin, yapılandırılmış JSON, resim, video, ses. Birinci sınıf medya. |
| Opak yaşam döngüsü | "Bunun nasıl çözüleceği agent'ın işidir" | Müşteri durum geçişlerini görür; sunucu framework/tools'u seçmekte özgürdür. |
| Keşif | "agent'ı Bulma" | `GET /.well-known/agent.json` kartı geri verir. |
| MCP ve A2A | "Araçlar ve eşler" | MCP: dikey agent ↔ aracı. A2A: yatay agent ↔ agent. |
| ACP / ANP / NLİP | "Kardeş protokolleri" | Bitişik özellikler; A2A, 2026'nın en çok benimsenenidir. |

## Daha Fazla Okuma

- [A2A spesifikasyonu](https://a2a-protocol.org/latest/specification/) — standart spesifikasyon
- [Google Developers Blog — A2A duyurusu](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) — Nisan 2025 lansman gönderisi
- [A2A GitHub deposu](https://github.com/a2aproject/A2A) — başvuru uygulamaları ve SDK'lar
- [Liu ve ark. — Agent Birlikte Çalışabilirlik Protokolleri Araştırması](https://arxiv.org/html/2505.02279v1) — MCP, ACP, A2A, ANP karşılaştırması
