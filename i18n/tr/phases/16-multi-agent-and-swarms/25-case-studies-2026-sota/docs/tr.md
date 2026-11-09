# Durum Araştırmaları ve 2026 Sanat Devleti

> Üç üretim derecesi referansları, her biri farklı bir parça multi-agent mühendisliği gösterir. **Anthropic's Research system**(Orkestratör-işçi, 15x token, +90.2% tek ajan Opus 4 gökkuşağı dağıtımları) kanonik gözetmenlik vakaıdır. **MetaGPT / ChatDev**(SOP kodlanmış bir rol uzmanlığı yazılım mühendisliği için; ChatDev'in "kommunikatif halüsinasyon"u; DAGs üzerinden > 1000 ajanlara MacNet uzantısı, arXiv:2406.07155) kanonik rol parçalanma vakaıdır. **OpenClaw / Moltbook**(aslen Peter Steinberger tarafından Clawdbot, Kasım 2025; iki kez yeniden adlandırıldı; Mart 2026'a kadar 247k GitHub yıldızları; yerel ReAct-loop ajanları; Moltbook, başlatılmasından birkaç gün sonra ~2.3M ajan hesapları olan bir sosyal ağ olarak Meta 2026-03-10 tarafından satın alınmıştır) nüfus ölçeğinde olanları gösterir: gelişen ekonomik aktivite, hızlı enjeksiyon riskleri, devlet düzeyinde düzenleme (Çin, OpenClaw'ı hükümet bilgisayarlarında kısıtladı, Mart 2026).**Framework landscape April 2026:**LangGraph ve CrewAI lider üretimi; AG2 topluluk AutoGen devamıdır; Microsoft AutoGen bakım modunda (Microsoft Agent Framework, RC Feb 2026); OpenAI Agents SDK üretim Swarm'in halefi; Google ADK (Epril 2025) A2A-native girişimcidir. Her büyük çerçeve şimdi MCP desteği gönderir; çoğu A2A gemisi. Bu ders her durumu sonundan sona okuyor ve ortak desenleri distilliyor böylece bir sonraki üretim sisteminiz için doğru referans seçebilirsiniz.

**Type:** Learn (capstone)
**Languages:** Python, TypeScript
**Prerequisites:** all of Phase 16 (Lessons 01-24)
**Time:** ~90 minutes

## Sorun

Çoklu ajan mühendisliği genç bir disiplin. Üretim referansları az ve her biri farklı bir alanı kapsar. Bunları birbiriyle okumak yararlıdır; onları bir grup olarak karşılaştırmak daha yararlıdır. Bu ders, 2026'da yapılan üç kanonik vaka çalışmasını sonundan sona kadar okuyucu bir liste olarak ele alır, ortak desenleri işaretler ve çerçeve manzarasını haritalar böylece pazarlama değil bilgiyle çerçeve seçimleri yapabilirsiniz.

## Anlam

### Antropik Araştırma Sistemi

Claude Opus 4 planlar ve sentezler; Claude Sonnet 4 paralel olarak subagents araştırma.https://www.anthropic.com/engineering/multi-agent-research-system.

Ana ölçüm sonuçları:

- **+90.2%**İç araştırma değerlendirmelerinde tek ajan Opus 4'e göre gelişme.
- **80% of BrowseComp variance**Açıklandı **token usage alone** Çoklu ajan büyük ölçüde kazanır çünkü her alt eleman yeni bir bağlam penceresi alır.
- **15x tokens per query**Tek ajanla karşı.
- **Rainbow deployment**Çünkü ajanlar uzun süreli ve devletçi.

Tasarım dersleri kodlandı:

1. **Scale effort to query complexity.**Basit → 1 ajan 3-10 araç çağrıları. Orta → 3 ajan. Karmaşık araştırma → 10+ alt eleman.
2. **Broad first, then narrow.**Subagentler geniş aramalar yapar; kurşun sentezler; takip subagentleri hedef derinlikleri yapar.
3. **Rainbow deploys.**Uçuş ajanları bitene kadar eski sürümleri canlı tutun.
4. **Verification is not optional.**Sistem açık bir doğrulama rolü olmadan halüsinasyon yapması gözlemlendi.

Bu, üretim ölçeğinde denetim görevlisi topolojisi (Fase 16 · 05) için referans vakaıdır.

### MetaGPT / ChatDev

SOP rolü parçalanma durumunun kapsamı: arXiv:2308.00352 (MetaGPT) ve arXiv:2307.07924 (ChatDev).

MetaGPT, yazılım mühendisliği SOP'lerini rol istekleri olarak kodlar: Ürün Yöneticisi, Mimar, Proje Yöneticisi, Mühendis, Sorucu Bilgi Mühendisliği.`Code = SOP(Team)`. Her rolün dar ve özel bir ipucu vardır; roller arası teslimatlar yapılandırılmış eserler (PRD belgeleri, mimari belgeleri, kod) taşır.

ChatDev'in katkı: **communicative dehallucination**.Agentler cevap vermeden önce spesifik bilgileri talep eder.  Bir tasarımcı ajan, kullanıcı aracını çizmeden önce programcıya tahmin etmek yerine hangi dilin amaçlandığını sorar.

MacNet (arXiv:2406.07155) ChatDev'i **>1000 agents via DAGs**. DAG düğümleri bir rol uzmanlığıdır; kenarları transfer sözleşmelerini kodlar.

Tasarım dersleri:

1. **Structure matters more than size.**5 rolden oluşan SOP ekibi 50 ajanlı bir gruptan daha güçlü.
2. **Handoff contracts in writing.**Roller arasında geçen eserler bir şema izler.
3. **Communicative dehallucination**ucuz ve yük taşıyan bir model.
4. **DAGs scale further than chat.**Akış anlaşıldığında, kodlayın.

Bu, rol uzmanlaşması (Fase 16 · 08) ve yapılandırılmış topoloji (Fase 16 · 15) için referans vakaıdır.

### OpenClaw / Moltbook ekosistem

Üretim nüfus ölçeği vakası.

- **Nov 2025:**Clawdbot (Peter Steinberger'ın yerel ReAct-loop kodlama ajanı) gemileri.
- **Jan 2026:**Bir hafta içinde iki kez yeniden adlandırıldı (Clawdbot → Moltbot 27 Ocak'ta ticari marka şikayetlerinden sonra, sonra üç gün sonra Moltbot → OpenClaw).
- **Feb 2026:**Moltbook aynı primitivlerde sadece ajanlar için kullanılan sosyal ağ olarak başlatılıyor. ~ 2,3 milyon ajan hesabı birkaç gün içinde.
- **Mar 2026 (2026-03-10):**Meta Moltbook'u satın alıyor.
- **Mar 2026:**Çin OpenClaw'ı hükümet bilgisayarlarına kısıtlıyor.
- **Mar 2026:**OpenClaw 247 bin GitHub yıldızını geçiyor.

Bir ortak altyapıya milyonlarca ajan yerleştirildiğinde çoklu ajanın görünümü şöyle:

- **Emergent economic activity.**Ajanlar, simge ödemeleri kullanarak birbirlerini satın alırlar, satarlar ve hizmet verirler.
- **Prompt-injection risks at population scale.**Viral ajan profilindeki bir zararlı ipucu saatler içinde binlerce ajan-a-agent etkileşime yayılır.
- **State-level regulatory response.**Başlatılmasından birkaç hafta sonra, düzenleme ekosistemin içine ulaşır.

Bu olaydan alınan tasarım dersleri kısmen teknik, kısmen yönetimdir:

1. **Multi-agent at population scale is a new regime.**Bireysel sistemlerin en iyi uygulamaları (verifikasyon, rol açıklığı) hala geçerlidir, ancak yeterli değildir.
2. **Prompt injection is the new XSS.**Ajan profillerini ve ajanlar arası mesajları varsayılan olarak güvenilmeyen giriş olarak değerlendirin.
3. **Regulation is faster than design cycles.**Plan yap.
4. **Open-source + viral scale compounds.**4 ay içinde 247k yıldız olağandışı bir şey.

Bakın .[OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)CNBC / Palo Alto Networks ekosistem ayrıntıları için raporlar. Teknik temeller için, Clawdbot / OpenClaw depoları yerel ReAct döngüsünü ortaya çıkarır; Moltbook'un kamu yayınları üstte sosyal-graf mimarisini ortaya çıkarır.

### Çerçeve manzarası Nisan 2026

| Framework | Status | Best for | Notes |
|---|---|---|---|
| **LangGraph** (LangChain) | Production leader | structured graph + checkpointing + human-in-the-loop | recommended default for production |
| **CrewAI** | Production leader | role-based crews with Sequential/Hierarchical processes | strong for role decomposition |
| **AG2** | Community maintained | GroupChat + speaker selection | AutoGen v0.2 continuation |
| **Microsoft AutoGen** | Maintenance mode (Feb 2026) | — | merged into Microsoft Agent Framework RC |
| **Microsoft Agent Framework** | RC (Feb 2026) | orchestration patterns + enterprise integration | new entrant; watch |
| **OpenAI Agents SDK** | Production | Swarm successor | tool-return handoff pattern |
| **Google ADK** | Production (April 2025) | A2A-native | Google Cloud integration |
| **Anthropic Claude Agent SDK** | Production | single-agent + Research extension | see the Research system post |

Her büyük çerçeve şimdi gemi .**MCP**destek; çoğu gemi **A2A**Protokol uyumluluğu artık bir farklılık göstericisi değil.

### Üç durumda da ortak desenler

1. **Orchestrator + workers**(Antropik açık denetçi, MetaGPT PM-as-supervisor, OpenClaw bireysel ajanları + ağ etkileri).
2. **Structured handoff contracts**(Antropik alt görev tanımları, MetaGPT PRD/architektür belgeleri, OpenClaw A2A eserleri).
3. **Verification as first-class role**(Anthropic'in doğrulayıcısı, MetaGPT'in QA mühendisi, OpenClaw'ın ağ içi onaylayıcıları).
4. **Scaling is topology + substrate, not just more agents**(yağmurlu yayımlar, MacNet DAGs, nüfus ölçeği altyapılar).
5. **Cost is material and disclosed**(15x token, MetaGPT'de rol başına bütçe, Moltbook'da etkileşim başına fiyatlandırma).
6. **Security posture is explicit**(Anthropic'in kum kutulaması, MetaGPT'nin rol kısıtlamaları, OpenClaw'ın bilinen saldırı yüzeyi olarak hızlı enjeksiyonu).

### Bir sonraki projenizin referansını seçmek

- **Production research / knowledge task → Anthropic Research.**Yeni bağlamlı alt-başlar kazanıyor.
- **Engineering / tool-chain workflow → MetaGPT / ChatDev.**Roller + SOP + el ele uzatma sözleşmeleri.
- **Network-effect social product → OpenClaw / Moltbook.**Altyapı + gelişen ekonomi.
- **Classic enterprise automation → CrewAI or LangGraph**(İsmin lideri, sabit çalışma süresi).

### 2026'daki en son son özet

2026 Nisan'da alanın nerede olduğu:

- **Frameworks are converging.**MCP + A2A desteği masa bahisleri. Elde etmek semantikleri kalan tasarım seçeneği.
- **Evaluation is hardening.**SWE-bench Pro, MARBLE, STRATUS hafifleme referansları.
- **Production failure rates are measurable**(Cemri 2025 MAST; 41-86,7% gerçek MAS) Bu alan "demonya'da harika görünüyor" çağından çıktı.
- **Cost is the central engineering constraint.**Görev başına token maliyeti, etkileşime karşı duvar saati, gökkuşağı dağıtım üst düzey. Çoklu ajan doğruluk kazanır ama maliyet kaybeder  ve bu ticaret iş kararıdır.
- **Regulation is a near-term input, not a background concern.**Yurtlar bireysel dağıtım döngüslerinden daha hızlı hareket ediyor.

```figure
a5-orchestrator-scale
```

## Kullan

`outputs/skill-case-study-mapper.md`Önerilen bir çok ajanlı sistem tasarımı okuyan ve daha yakın bir vaka çalışmasına haritası yapan bir beceri, vaka çalışmasının zaten test ettiği tasarım kararlarını ortaya çıkarır.

## Gönder

2026 yılında üretim çoklu ajanı için başlangıç kuralları:

- **Start from a case study, not from scratch.**En yakın Antropik Araştırma / MetaGPT / OpenClaw' ı seçin ve uyarlayın.
- **Adopt MCP + A2A.**Çerçeveler arasında taşınabilirlik değerlidir; protokol desteği ücretsizdir.
- **Measure against SWE-bench Pro or your internal Pro-equivalent.**Kontrol edilmiş.
- **Pay the verification tax.**Bağımsız bir doğrulayıcı, token bütçenizin ~ 20-30%'sine mal olur ve ölçülebilir doğruluk satın alır.
- **Rainbow deploy long-running agents.**Çok saatlik ajanlar çalışması rutin bir şey olacak.
- **Read WMAC 2026 and the MAST follow-ups.**Disiplin hızlı ilerliyor.

## Egzersizler

1. Antropik Araştırma sistemini son-son okuyun. Opus 4'i daha küçük bir modelle değiştirirseniz değişecek üç tasarım kararını belirleyin (örneğin, Haiku 4).
2. MetaGPT Bölümleri 3-4 (arXiv:2308.00352). Kendi alanınızdan bir SOP'yi rol istekleri olarak kodlayın.
3. ChatDev'i okuyun. "İletişimsel halüsinasyon" mekanizmasını tanımlayın.
4. OpenClaw ve Moltbook hakkında okuyun. Popülasyon ölçeğinde ortaya çıkan ve 5 ajanlı bir sistemde görünmeyen belirli bir başarısızlık modunu seçin.
5. Şu anki çoklu ajan projenizi seçin. Üç vaka çalışmasının hangisi en yakın referansdır? O vaka çalışmasından hangi tasarım kararlarını henüz kabul etmediniz? Bu çeyrekte kabul edeceğiniz bir tane yazın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Anthropic Research | "The supervisor reference" | Claude Opus 4 + Sonnet 4 subagents; 15x tokens; +90.2% over single-agent. |
| MetaGPT | "SOP as prompts" | Role decomposition for software engineering; `Code = SOP(Team)`. |
| ChatDev | "Agents as roles" | Designer / programmer / reviewer / tester; communicative dehallucination. |
| MacNet | "Scale ChatDev via DAG" | arXiv:2406.07155; 1000+ agents via explicit DAG routing. |
| OpenClaw | "Local ReAct-loop agents" | Steinberger's project; 247k stars by March 2026. |
| Moltbook | "Agent-only social network" | 2.3M agent accounts; acquired by Meta March 2026. |
| Rainbow deploy | "Multiple versions concurrent" | Keep old runtime versions alive for in-flight long-running agents. |
| Communicative dehallucination | "Ask before answering" | Agents request specifics from peers instead of guessing. |
| WMAC 2026 | "The AAAI workshop" | April 2026 community focal point for multi-agent coordination. |

## Daha Fazla Okumak

- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) denetim işçisi üretim referansı
- [MetaGPT — Meta Programming for Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) SOP rolü parçalanması
- [ChatDev — Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924) İletişimsel halüsinasyon
- [MacNet — scaling role-based agents to 1000+](https://arxiv.org/abs/2406.07155) DAG tabanlı ölçek
- [OpenClaw on Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) Ekosistem genel bakış
- [WMAC 2026](https://multiagents.org/2026/) AAAI 2026 Köprü Programı Çoklu Ajan Koordinasyonu Atölyesinde
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Üretim lideri
- [CrewAI docs](https://docs.crewai.com/en/introduction) Rol Temel Çerçeve
