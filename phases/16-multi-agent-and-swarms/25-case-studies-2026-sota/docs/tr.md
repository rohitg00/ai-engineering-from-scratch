# Vaka Çalışmaları ve 2026'nın Son Durumu

> Her biri çoklu-agent mühendisliğinin farklı bir dilimini gösteren, uçtan uca çalışmaya yönelik üç üretim düzeyinde referans. **Anthropic'in Araştırma sistemi** (orkestratör-işçi, 15x tokens, tekli-agent Opus 4'e göre +%90,2, gökkuşağı deployments) standart denetçi durumudur. **MetaGPT / ChatDev** (yazılım mühendisliği için SOP kodlu rol uzmanlığı; ChatDev'in "iletişimsel halüsinasyon"u; DAG'ler yoluyla >1000 agents'ye MacNet uzantısı, arXiv:2406.07155) kanonik rol ayrıştırma durumudur. **OpenClaw / Moltbook** (orijinal olarak Peter Steinberger tarafından yazılan Clawdbot, Kasım 2025; iki kez yeniden adlandırıldı; Mart 2026'ya kadar 247 bin GitHub yıldızı; yerel ReAct-loop agent'lar; lansmandan sonraki günler içinde ~2,3 milyon agent hesaba sahip yalnızca agent-yalnızca bir sosyal ağ olarak Moltbook, Meta tarafından edinildi 2026-03-10) nüfus ölçeğinde neler olduğunu gösteriyor: acil ekonomik aktivite, prompt-enjeksiyon riskleri, eyalet düzeyinde düzenleme (Çin, hükümet bilgisayarlarında OpenClaw'ı kısıtladı, Mart 2026). **Framework Nisan 2026 genel durumu:** LangGraph ve CrewAI üretime öncülük ediyor; AG2, AutoGen topluluğunun devamıdır; Microsoft AutoGen bakım modundadır (Microsoft Agent Framework, RC Şubat 2026 ile birleştirilmiştir); OpenAI Agent'nin SDK'sı Swarm'ın üretim halefidir; Google ADK (Nisan 2025), A2A yerlisi yarışmacıdır. Her büyük framework artık MCP desteği gönderiyor; çoğu gemi A2A. Bu derste her vaka uçtan uca okunur ve bir sonraki üretim sisteminiz için doğru referansı seçebilmeniz için ortak kalıplar incelenir.

**Tür:** Öğren (kapak taşı)
**Diller:** —
**Önkoşullar:** 16. Aşamanın tümü (Ders 01-24)
**Süre:** ~90 dakika

## Sorun

Multi-agent mühendisliği genç bir disiplindir. Üretim referansları azdır ve her biri alanın farklı bir bölümünü kapsar. Bunları teker teker okumak faydalıdır; bunları bir set olarak karşılaştırmak daha faydalıdır. Bu ders, üç standart 2026 vaka çalışmasını uçtan uca bir okuma listesi olarak ele alır, ortak kalıpları belirler ve framework manzarasını haritalandırır, böylece pazarlamadan değil bilgiden framework seçimler yapabilirsiniz.

## Konsept

### Antropik Araştırma sistemi

Üretim amiri-işçi vakası. Claude Opus 4 planlar ve sentezler; Claude Sonnet 4 altagentın paralel araştırması. Yayınlanan mühendislik yazısı: https://www.anthropic.com/engineering/multi-agent-research-system.

Ölçülen önemli sonuçlar:

- Dahili araştırma değerlendirmelerinde single-agent Opus 4'e göre **+%90,2** iyileşme.
- **BrowseComp varyansının %80'i** yalnızca **token kullanımıyla açıklanmaktadır** — çoklu-agent büyük ölçüde kazanır çünkü her altagent yeni bir context window alır.
- **Sorgu başına 15x tokens** ve tek-agent.
- **Gökkuşağı deployment** çünkü agent'lar uzun süredir çalışıyor ve durum bilgisi içeriyor.

Kodlanmış tasarım dersleri:

1. **Karmaşıklığı sorgulamak için çabayı ölçeklendirin.** Basit → 3-10 araç çağrısıyla 1 agent. Orta → 3 agents. Karmaşık araştırma → 10'dan fazla altagent.
2. **Önce geniş, sonra dar.** Altagent'lar geniş aramalar yapar; kurşun sentezler; takip eden altagent'lar hedeflenen derinlikleri gerçekleştirir.
3. **Gökkuşağı dağıtılır.** Eski çalışma zamanı sürümlerini, uçuştaki agent'lari bitene kadar canlı tutun.
4. **Doğrulama isteğe bağlı değildir.** Sistemin, açık doğrulayıcı rolleri olmadan halüsinasyon gördüğü gözlemlendi.

Bu, üretim ölçeğinde yönetici-çalışan topolojisi (Aşama 16 · 05) için referans durumdur.

### MetaGPT / ChatDev

Üretim SOP-rol ayrıştırma durumu. arXiv:2308.00352 (MetaGPT) ve arXiv:2307.07924 (ChatDev) kapaklarını açın.

MetaGPT, yazılım mühendisliği SOP'lerini rol prompt'lar olarak kodlar: Ürün Yöneticisi, Mimar, Proje Yöneticisi, Mühendis, Kalite Güvence Mühendisi. Makalenin çerçevesi: `Code = SOP(Team)`. Her rolün dar ve uzmanlaşmış bir prompt'si vardır; roller arası aktarımlar yapılandırılmış artifact'ları (PRD belgeleri, mimari belgeleri, kod) taşır.

ChatDev'in katkısı: **iletişimsel halüsinasyon giderme**. Agent'nin yanıtlamadan önce istek ayrıntıları — bir tasarımcı agent, tahmin etmek yerine, kullanıcı arayüzü taslağını çizmeden önce programcıya hangi dilin amaçlandığını sorar. Makale, bunun çoklu-agent boru hatlarındaki halüsinasyonu ölçülebilir şekilde azalttığını bildiriyor.

MacNet (arXiv:2406.07155), ChatDev'i DAG'ler** yoluyla **>1000 agents'ye kadar genişletir. Her DAG düğümü bir rol uzmanlığıdır; kenarlar devir sözleşmelerini kodlar. Yönlendirme açık ve çevrimdışı hesaplanabilir olduğundan ölçek mümkündür.

Tasarım dersleri:

1. **Yapı, boyuttan daha önemlidir.** 5 rolden oluşan sıkı bir SOP ekibi, 50-agent kişilik yapılandırılmamış bir grubu yener.
2. **Sözleşmelerin yazılı olarak devredilmesi.** Roller arasında aktarılan Artifact'lar bir şemayı takip eder.
3. **İletişimsel halüsinasyon** ucuz ve yük taşıyan bir yöntemdir.
4. **DAG'ler sohbetten daha fazla ölçeklenir.** Akış bilinebilir olduğunda onu kodlayın.

Bu, rol uzmanlığı (Aşama 16 · 08) ve yapılandırılmış topoloji (Aşama 16 · 15) için referans durumdur.

### OpenClaw / Moltbook ekosistemi

Üretim nüfusu ölçeğinde durum. Zaman çizelgesi:

- **Kasım 2025:** Clawdbot (Peter Steinberger'in yerel ReAct-loop kodlaması agent) piyasaya sürüldü.
- **Aralık 2025 – Mart 2026:** iki kez yeniden adlandırıldı (Clawdbot → OpenClaw → OpenClaw altında devam etti).
- **Şubat 2026:** Moltbook, aynı ilkeller üzerinde yalnızca agent içeren bir sosyal ağ olarak kullanıma sunuldu; Birkaç gün içinde ~2,3 milyon agent hesap.
- **Mar 2026 (2026-03-10):** Meta, Moltbook'u satın aldı.
- **Mar 2026:** Çin, devlet bilgisayarlarında OpenClaw'ı kısıtladı.
- **Mart 2026:** OpenClaw, 247 bin GitHub yıldızını geçti.

Paylaşılan bir alt tabakaya milyonlarca agent yerleştirdiğinizde çoklu-agent şuna benzer:

- **Acil ekonomik faaliyet.** Agent'ler, token-ödemelerini kullanarak birbirlerini satın alır, satar ve hizmet verirler.
- **Prompt-enjekte etme popülasyon ölçeğinde risk oluşturur.** Viral bir agent profilindeki kötü niyetli bir prompt, saatler içinde binlerce agent-to-agent etkileşime yayılır.
- **Eyalet düzeyinde düzenleyici müdahale.** Lansmandan birkaç hafta sonra düzenleme ekosisteme ulaşır.

Bu vakadan elde edilen tasarım dersleri kısmen teknik, kısmen yönetişime ilişkindir:

1. **Nüfus ölçeğinde çoklu-agent yeni bir rejimdir.** Bireysel sistemdeki en iyi uygulamalar (doğrulama, rol netliği) hâlâ geçerlidir ancak yeterli değildir.
2. **Prompt enjeksiyonu yeni XSS'dir.** agent profillerini ve çaprazagent mesajlarını varsayılan olarak güvenilmeyen giriş olarak değerlendirin.
3. **Düzenlemeler tasarım döngülerinden daha hızlıdır.** Plan yapın.
4. **Açık kaynak + viral ölçekli bileşikler.** ~4 ayda 247 bin yıldız olağandışı bir durumdur; dağıtım-ani yük için tasarım.

Ekosistem ayrıntıları için [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) ve CNBC / Palo Alto Networks raporlarına bakın. Teknik temeller için Clawdbot / OpenClaw depoları yerel ReAct döngüsünü açığa çıkarır; Moltbook'un herkese açık gönderileri sosyal grafik mimarisini en üstte ortaya koyuyor.

### Framework manzarası Nisan 2026

| Framework | Durum | Şunun için en iyisi | Notlar |
|---|---|---|---|
| **LangGraph** (LangChain) | Üretim lideri | yapılandırılmış grafik + kontrol noktası + döngüdeki insan | üretim için önerilen varsayılan |
| **Mürettebat AI** | Üretim lideri | Sıralı/Hiyerarşik süreçlere sahip rol tabanlı ekipler | rol dağılımı için güçlü |
| **AG2** | Topluluk bakımı | Grup Sohbeti + hoparlör seçimi | AutoGen v0.2 devamı |
| **Microsoft AutoGen** | Bakım modu (Şubat 2026) | — | Microsoft Agent Framework RC ile birleştirildi |
| **Microsoft Agent Framework** | RC (Şubat 2026) | orkestrasyon kalıpları + kurumsal entegrasyon | yeni katılımcı; izle |
| **OpenAI Agent'nin SDK'sı** | Üretim | Sürü halefi | takım dönüşü aktarım modeli |
| **Google ADK** | Üretim (Nisan 2025) | A2A-yerel | Google Bulut entegrasyonu |
| **Antropik Claude Agent SDK'sı** | Üretim | single-agent + Araştırma uzantısı | Araştırma sistemi gönderisine bakın |

Her büyük framework artık **MCP** desteği gönderiyor; çoğu gemi **A2A**. Protokol uyumluluğu artık bir fark yaratmamaktadır.

### Her üç durumda da ortak modeller

1. **Orkestratör + çalışanlar** (Antropik açık gözetmen, gözetmen olarak MetaGPT PM, OpenClaw bireysel agent'lar + ağ efektleri).
2. **Yapılandırılmış devir sözleşmeleri** (Antropik altagent görev açıklamaları, MetaGPT PRD/mimari belgeleri, OpenClaw A2A artifact'lar).
3. **Birinci sınıf rol olarak doğrulama** (Anthropic'in doğrulayıcısı, MetaGPT'nin QA Mühendisi, OpenClaw'ın ağ içi doğrulayıcıları).
4. **Ölçeklendirme topoloji + alt tabakadır, yalnızca agents** daha fazla değildir (gökkuşağı konuşlandırmaları, MacNet DAG'ler, nüfus ölçekli alt tabakalar).
5. **Maliyet önemlidir ve açıklanmıştır** (15x tokens, MetaGPT'de rol başına bütçe, Moltbook'ta etkileşim başına fiyatlandırma).
6. **Güvenlik duruşu açıktır** (Anthropic'in korumalı alan oluşturması, MetaGPT'nin rol kısıtlamaları, bilinen saldırı yüzeyi olarak OpenClaw'ın prompt-enjeksiyonu).

### Bir sonraki projeniz için referans seçme

- **Üretim araştırması / bilgi görevi → Antropik Araştırma.** Taze bağlam altagent'ları kazanır.
- **Mühendislik / araç zinciri iş akışı → MetaGPT / ChatDev.** Roller + SOP'lar + devir sözleşmeleri.
- **Ağ etkili sosyal ürün → OpenClaw / Moltbook.** Alt tabaka + gelişen ekonomi.
- **Klasik kurumsal otomasyon → CrewAI veya LangGraph** (üretim lideri, istikrarlı çalışma süresi).

### 2026'nın son teknoloji özeti

Nisan 2026'da tarlanın bulunduğu yer:

- **Framework'lar yakınlaşıyor.** MCP + A2A desteği masa bahisleridir. Aktarma semantiği geriye kalan tasarım seçeneğidir.
- **Değerlendirme sertleşiyor.** SWE-bench Pro, MARBLE, STRATUS azaltma benchmark'lar. Pro, mevcut kirlenmeye dayanıklı gerçeklik kontrolüdür.
- **Üretim başarısızlık oranları ölçülebilir** (Cemri 2025 MAST; gerçek MAS'ta %41-86,7). Saha "demoda harika görünüyor" döneminin dışında.
- **Maliyet merkezi mühendislik kısıtlamasıdır.** Görev başına Token maliyet, etkileşim başına duvar saati, gökkuşağı konuşlandırma yükü. Multi-agent doğruluk açısından kazanır ancak maliyet açısından kaybeder — ve bu ticaret iş kararıdır.
- **Düzenleme kısa vadeli bir girdidir, arka plandaki bir sorun değildir.** Yargı bölgeleri bireysel dağıtım döngülerinden daha hızlı ilerlemektedir.

## Use It — Hazır Araçla Uygula

`outputs/skill-case-study-mapper.md` , önerilen bir çoklu-agent sistem tasarımını okuyan ve onu en yakın örnek olayla eşleştiren, örnek olay çalışmasının zaten test ettiği tasarım kararlarını ortaya çıkaran bir beceridir.

## Ship It — Kullanıma Sun

2026'da multi-agent üretimi için başlangıç ​​kuralları:

- **Sıfırdan değil, bir vaka çalışmasıyla başlayın.** Antropik Araştırma / MetaGPT / OpenClaw'dan en yakın olanı seçin ve uyarlayın.
- **MCP + A2A'yı benimseyin.** framework'ler arasında taşınabilirlik değerlidir; protokol desteği ücretsizdir.
- **SWE-bench Pro'ya veya dahili Pro eşdeğerinize karşı ölçüm yapın.** Kirli olduğu doğrulandı.
- **Doğrulama vergisini ödeyin.** Bağımsız bir doğrulayıcı, token bütçenizin ~%20-30'una mal olur ve ölçülebilir doğruluğu satın alır.
- **Gökkuşağı dağıtımı uzun süren agents.** Çok saatlik agent çalıştırmaların rutin olmasını bekleyin.
- **WMAC 2026 ve MAST takiplerini okuyun.** Disiplin hızla ilerliyor.

## Egzersizler

1. Antropik Araştırma sistemini baştan sona okuyun. Opus 4'ü daha küçük bir modelle (e.g., Haiku 4) değiştirirseniz değişecek üç tasarım kararını belirleyin.
2. MetaGPT Bölüm 3-4'ü okuyun (arXiv:2308.00352). Kendi alanınızdan (yazılım değil) bir SOP'yi rol prompt'lar olarak kodlayın. SOP kaç rolü ima ediyor?
3. ChatDev'i (arXiv:2307.07924) okuyun. "İletişimsel halüsinasyon" mekanizmasını tanımlayın. Bunu mevcut çoklu-agent sistemlerinizden birine uygulayın.
4. OpenClaw ve Moltbook hakkında bilgi edinin. Nüfus ölçeğinde ortaya çıkan ve 5-agent sisteminde görünmeyecek belirli bir başarısızlık modunu seçin. Buna karşı nasıl mühendislik yapardınız?
5. Mevcut çoklu-agent projenizi seçin. Üç vaka çalışmasından hangisi en yakın referanstır? Bu vaka çalışmasından hangi tasarım kararlarını henüz benimsemediniz? Bu çeyrekte benimseyeceğiniz birini yazın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Antropik Araştırma | "Süpervizör referansı" | Claude Opus 4 + Sonnet 4 altagent; 15x tokens; Tek-agent'a göre +%90,2. |
| MetaGPT | "prompts olarak SOP" | Yazılım mühendisliği için rol ayrıştırması; `Code = SOP(Team)`. |
| Sohbet Geliştirme | "Agentroller olarak" | Tasarımcı / programcı / incelemeci / testçi; iletişimsel halüsinasyon. |
| MacNet | "ChatDev'i DAG aracılığıyla ölçeklendirin" | arXiv:2406.07155; Açık DAG yönlendirmesi yoluyla 1000'den fazla agent. |
| Açık Pençe | "Yerel ReAct döngüsü agent'lar" | Steinberger'in projesi; Mart 2026'ya kadar 247 bin yıldız. |
| Moltbook | "Agent-yalnızca sosyal ağ" | 2,3 milyon agent hesap; Mart 2026'da Meta tarafından satın alındı. |
| Gökkuşağı dağıtımı | "Birden fazla sürüm eşzamanlı" | Uçuş sırasında uzun süre çalışan agent'lar için eski çalışma zamanı sürümlerini canlı tutun. |
| İletişimsel halüsinasyon | "Yanıtlamadan önce sor" | Agent, tahminde bulunmak yerine akranlarından ayrıntılı bilgi ister. |
| WMAC 2026 | "AAAI çalıştayı" | Çoklu-agent koordinasyonu için Nisan 2026 topluluk odak noktası. |

## Daha Fazla Okuma

- [Antropik — Çoklu-agent araştırma sistemimizi nasıl oluşturduk](https://www.anthropic.com/engineering/multi-agent-research-system) — yönetici-işçi üretim referansı
- [MetaGPT — ÇokluAgent İşbirlikçi Framework](https://arxiv.org/abs/2308.00352) için Meta Programlama — SOP-rol ayrıştırması
- [ChatDev — Yazılım Geliştirme için İletişimsel Agent'ler](https://arxiv.org/abs/2307.07924) — iletişimsel halüsinasyon
- [MacNet — rol tabanlı agent'lari 1000+'ye ölçeklendirme](https://arxiv.org/abs/2406.07155) — DAG tabanlı ölçeklendirme
- [Wikipedia'da OpenClaw](https://en.wikipedia.org/wiki/OpenClaw) — ekosisteme genel bakış
- [WMAC 2026](https://multiagents.org/2026/) — AAAI 2026 Çoklu-Agent Koordinasyonu Üzerine Köprü Programı Çalıştayı
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — üretim lideri
- [CrewAI docs](https://docs.crewai.com/en/introduction) — rol tabanlı framework
