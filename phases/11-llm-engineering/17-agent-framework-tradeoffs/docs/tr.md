# Agent Framework Takaslar — Grafik, Rol ve Aktör Düzenlemesi

> Her framework aynı demoyu satar (agent araştırması bir rapor oluşturur) ve aynı hatayı gizler (durum şeması düzenleme katmanıyla kavga eder). Soyutlamaları probleminizin şekliyle eşleşen framework'yi seçin; geri kalan her şey tutkaldır, iki kere yazarsın.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 11 · 09 (İşlev Çağrısı), Aşama 11 · 16 (LangGraph)
**Süre:** ~45 dakika

## Sorun

Birden fazla LLM çağrısı gerektiren bir göreviniz var. Belki bir araştırma iş akışıdır (planla, araştır, özetle, alıntı yap). Belki bu bir kod inceleme hattıdır (fark ayrıştırma, eleştiri, yama, doğrulama). Belki de uçuş rezervasyonu yapan, e-posta yazan ve gider raporlarını dosyalayan çok yönlü bir asistandır. Bir framework seçersiniz.

Üç gün sonra, framework'nin soyutlamalarının sızıntısını keşfedersiniz. CrewAI size roller verir ancak "araştırmacının" yapılandırılmış bir planı "yazar"a vermesi gerektiğinde sizinle savaşır. AutoGen size agent'lar arasında sohbet etme imkanı verir ancak birinci sınıf durumu yoktur, dolayısıyla kontrol noktanız konuşma günlüğünün bir kısmıdır. LangGraph size bir durum grafiği verir ancak agent'nin ne yapacağını bilmeden sizi her geçişe isim vermeye zorlar. Agno size, eşzamanlı üç çalışana yayılmaya çalıştığınızda çığlık atan tek-agent soyutlama verir.

Çözüm "en iyiyi seç framework" değil. framework'nin temel soyutlamasını probleminizin şekliyle eşleştirmektir. Bu ders o haritayı çiziyor.

## Konsept

![Agent framework matrisi: temel soyutlamaya karşı problem şekli](../assets/framework-matrix.svg)

2026 manzarasına dört framework hakim. Temel soyutlamaları aynı değil.

| Framework | Çekirdek soyutlama | En uygun | En kötü uyum |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — yazılan durum, düğümler, koşullu kenarlar, denetim noktası. | Açık durum ve döngüdeki insan kesintilerine sahip iş akışları; üretim agent'nin zaman yolculuğunda hata ayıklaması gerekiyor. | Topolojinin bilinmediği gevşek, rol odaklı beyin fırtınası. |
| **Mürettebat AI** | `Crew` — roller (hedef, arka plan), görevler, süreç (sıralı veya hiyerarşik). | Kısa doğrusal/hiyerarşik plana sahip rol yapma veya kişiye dayalı iş akışları. | Mürettebatın sıra geçmişinin ötesinde durum bilgisi olan herhangi bir şey; karmaşık dallanma. |
| **OtoGen** | `ConversableAgent` çifti — bir çıkış koşuluna kadar sırayla konuşan iki veya daha fazla agent. | Düşüncenin sohbetten ortaya çıktığı çoklu-agent *diyalog* (öğretmen-öğrenci, önerici-eleştirmen, aktör-eleştirmen). | Bilinen bir DAG ile deterministik iş akışları; yeniden başlatmalarda dayanıklı duruma ihtiyaç duyan her şey. |
| **Agno** | `Agent` — ekipler halinde oluşturulabilen tek bir LLM + araçlar + bellek. | Hızlı oluşturulan tekli agent'ler ve hafif ekipler; güçlü çoklu mod ve yerleşik depolama sürücüleri. | Özel azaltıcılara sahip derin, açıkça dallandırılmış grafikler. |

### "Soyutlama" aslında ne anlama gelir?

Bir framework'nin temel soyutlaması, mimariyi tanıtırken beyaz tahtaya çizdiğiniz şeydir.

- **LangGraph** → bir grafik çizersiniz. Düğümler adımlardır, kenarlar geçişlerdir ve her noktadaki durum nesnesi yazılır. Zihinsel model bir durum makinesidir.
- **CrewAI** → bir organizasyon şeması çizersiniz. Her rolün bir iş tanımı vardır ve bir yönetici görevleri yönlendirir. Zihinsel model, uzmanlardan oluşan küçük bir ekiptir.
- **AutoGen** → bir Slack DM çizersiniz. İki agent birbirine mesaj gönderir; Bir moderatöre ihtiyacınız varsa üçüncüsü katılır. Zihinsel model sohbettir.
- **Agno** → üzerinde aletler asılı olan tek bir kutu çizersiniz. Bir takım için kutuları yan yana koyun. Zihinsel model "agent piller dahil."

### Devlet sorusu

Eyalet, çoğu framework seçeneğin üretimde bozulduğu yerdir.

- **LangGraph.** Yazılı durum (`TypedDict` veya Pydantic modeli), alan başına düşürücüler, birinci sınıf denetim noktası (SQLite/Postgres/Redis). Devam etme, ara verme ve zaman yolculuğu ücretsizdir. *(Bkz. Aşama 11 · 16.)*
- **CrewAI.** Durum, `context` alanı aracılığıyla veya `output_pydantic` aracılığıyla yapılandırılmış olarak görevler arasında dizeler halinde akar. Kutudan çıktığı haliyle mürettebat başına dayanıklı bir depo yok; Mürettebatın yeniden başlatmadan sağ çıkması gerekiyorsa kendi başınıza kaçarsınız.
- **AutoGen.** Durum, sohbet geçmişi ve herhangi bir kullanıcı tanımlı `context`'dır. Konuşma transkriptleri devam ediyor; bağdaştırıcılar yazmadığınız sürece isteğe bağlı iş akışı durumu olmaz.
- **Agno.** `storage=` aracılığıyla bir `Agent`'ye eklenen yerleşik depolama sürücüleri (SQLite, Postgres, Mongo, Redis, DynamoDB) — konuşma oturumları ve kullanıcı anıları otomatik olarak devam eder. Tam bir grafik kontrol noktası değil; bir oturum deposu.

### Dallara ayrılan soru

Önemsiz olmayan her agent dal. Şubeye kimin karar vereceği önemli.

- **LangGraph** — koşullu kenarlar aracılığıyla siz karar verirsiniz. Yönlendirme, adlandırılmış dallara sahip bir Python işlevidir. Derlenmiş grafikte dallar birinci sınıftır; kontrol noktası hangi dalın alındığını kaydeder.
- **CrewAI** — yönetici hiyerarşik modda karar verir; sıralı modda, derleme sırasında karar verirsiniz. Yönlendirme görev listesinde örtülüdür; yöneticinin prompt dışında birinci sınıf bir "eğer" yoktur.
- **AutoGen** — agent'lar sohbet yoluyla karar verir. Dallanma, daha sonra kimin konuşacağına göre ortaya çıkar. `GroupChatManager` sonraki konuşmacıyı seçer; bir `speaker_selection_method`'yi elle yazabilirsiniz ancak varsayılan LLM odaklıdır.
- **Agno** — agent bir sonraki çağrının hangi araçla yapılacağına karar verir. Takımların bir koordinatör/yönlendirici/ortak çalışan modu vardır; bunun ötesine dallanmak geliştiricinin sorumluluğundadır.

### observability sorusu

- **LangGraph** — LangSmith veya herhangi bir OTel ihracatçısı aracılığıyla OpenTelemetry. Her düğüm geçişi bir izleme aralığıdır; kontrol noktaları tekrar oynatılabilir izler olarak iki katına çıkar. LangSmith birinci taraf seçeneğidir; Langfuse/Phoenix'in ayrıca adaptörleri vardır.
- **CrewAI** — 2025'in sonlarından bu yana birinci sınıf OpenTelemetry; Langfuse, Phoenix, Opik, AgentOps ile entegrasyonlar.
- **AutoGen** — `autogen-core` aracılığıyla OpenTelemetry entegrasyonu; AgentOps ve Opik'in bağlayıcıları var. İzleme ayrıntı düzeyi düğüm başına değil, agent mesaj başına yapılır.
- **Agno** — yerleşik `monitoring=True` bayrağı artı OpenTelemetry dışa aktarıcıları; Oturum izlemeleri için Langfuse ile sıkı entegrasyon.

### Maliyet ve gecikme

Dört framework'nin tümü çağrı başına ek yük ekler (framework mantık, doğrulama, serileştirme). Artan yükün kaba sıralaması: Agno ≈ LangGraph < CrewAI ≈ AutoGen. Aradaki fark, framework'nin ne kadar ekstra LLM yönlendirmesi yaptığına bağlıdır. CrewAI'nin hiyerarşik yöneticisi bir sonraki kimin gideceğine karar vermek için tokenzaman harcıyor; AutoGen'in `GroupChatManager`'si de aynı şekilde. LangGraph yalnızca `llm.invoke` yazdığınız yerde tokens harcıyor. Agno'nun tek-agent yolu incedir.

Çalıştırma başına maliyet önemli olduğunda, LLM tarafından seçilen yönlendirme yerine açık yönlendirmeyi (LangGraph kenarları, AutoGen `speaker_selection_method`) tercih edin.

### Birlikte Çalışabilirlik

- **LangGraph** ↔ **LangChain** araçları, alıcılar, LLM'ler. Birinci sınıf MCP adaptörü (MCP sunucuları olarak içe aktarılan araçlar).
- **CrewAI** ↔ araçlar `BaseTool`'dan devralınır; LangChain araçları, LlamaIndex araçları ve MCP araçlarının tümü uyum sağlar. `allow_delegation=True` aracılığıyla mürettebattan ekibe yetki verme.
- **AutoGen** → `FunctionTool` çağrılabilir herhangi bir Python'u sarar; MCP adaptörü mevcut. agent-to-agent kalıpları için AG2 ekosistemiyle sıkı bağlantı.
- **Agno** → `@tool` dekoratör veya BaseTool alt sınıfı; MCP adaptörü; araçlar agent'lar ve ekipler arasında paylaşılabilir.

## Beceri

> Belirli bir framework'nin belirli bir agent problemi için neden doğru olduğunu bir cümleyle açıklayabilirsiniz.

Oluşturma öncesi kontrol listesi:

1. **Şekli çizin.** Bu bir grafik mi (yazılan durum, geçişler olarak adlandırılıyor)? Bir rol oyunu mu (uzmanlar işi devreder)? Sohbet mi edelim (agentbitene kadar konuşacağız)? Araçlarla birlikte tek bir agent mi?
2. **Kimin dallanacağına karar verin.** Geliştiricinin karar verdiği dallanma → LangGraph. Yönetici-agent-karar verdi → Mürettebat AI hiyerarşik. Sohbetle ortaya çıkan → AutoGen. Araç çağrısıyla karar verilen → Agno.
3. **Devlet bütçesini kontrol edin.** Kontrol noktasından özgeçmişe mi ihtiyacınız var? Zaman yolculuğu mu? İnsan koşunun ortasında kesintiye uğrar mı? Evetse, LangGraph varsayılandır; Agno oturumları konuşma kapsamlı durumu kapsar.
4. **Maliyet bütçesini kontrol edin.** LLM tarafından seçilen yönlendirmenin tur başına ekstra token maliyeti vardır. agent günde binlerce kez çalışıyorsa açık yönlendirmeyi tercih edin.
5. **framework ek yükünü bütçeleyin.** Her framework başka bir bağımlılıktır. Görev iki LLM çağrısı ve bir araçsa, 30 satırlık düz Python yazın; hiçbir framework, hiçbir framework'den daha ucuz değildir.

Grafiği, kuruluş şemasını, sohbeti veya agent kutusunu çizebilmeniz için önce framework'ye ulaşmayı reddedin. Gerçekten ihtiyacınız olan şey için sizi devlet modeliyle savaşmaya zorlayan birini seçmeyi reddedin.

## Karar Matrisi

| Sorun şekli | Tercih edilen framework | Neden |
|---------------|---------------------|-----|
| Yazılı durum, insan onayı, uzun süreli iş akışı DAG | LangGrafik | Birinci sınıf durum, kontrol noktası, kesintiler, zaman yolculuğu. |
| Farklı rollere sahip araştırma / yazma hattı | CrewAI (sıralı) veya LangGraph alt grafikleri | Görev başına rolün CrewAI'de ifade edilmesi ucuzdur; Dallanma karmaşıklaştığında LangGraph ile ölçeklendirin. |
| Teklif sahibi-eleştirmen veya öğretmen-öğrenci diyaloğu | OtoGen | İki-agent sohbet onun doğal şeklidir. |
| Araçlar, oturumlar, hafıza içeren tek agent | Agno | En ince kurulum, yerleşik depolama ve bellek. |
| Redüktörlü binlerce paralel yayılım | LangGraph + `Send` | Birinci sınıf paralel dağıtım API'sine sahip tek ürün. |
| Hızlı prototip, framework taahhüt yok | Düz Python + sağlayıcı SDK'sı | Hayır framework en hızlı framework değildir. |

## Egzersizler

1. **Kolay.** Aynı görevi üstlenin - "Anthropic'in merkezini araştırın, 200 kelimelik bir özet yazın, kaynaklardan alıntı yapın" - ve bunu LangGraph'ta (dört düğüm: planla, ara, yaz, alıntı yap) ve CrewAI'de (üç rol: araştırmacı, yazar, editör) uygulayın. Çalıştırma başına maliyeti ve kod satırlarını token olarak bildirin.
2. **Medium.** Aynı görevi AutoGen'de (araştırmacı ↔ yazar sohbeti, editör `GroupChat` aracılığıyla katılır) ve Agno'da (`search_tools` ve `write_tools` ile tek bir agent, artı bir oturum deposu) oluşturun. Dört uygulamayı (a) çalıştırma başına maliyet, (b) bir çökme sonrasında devam etme yeteneği, (c) yazma adımından önce insan onayı verme becerisine göre sıralayın.
3. **Zor.** Kısa bir sorun açıklaması (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`) alan ve tek cümlelik gerekçeyle bir öneri döndüren bir karar ağacı komut dosyası `pick_framework.py` oluşturun. Bunu kendi tasarladığınız altı kasa üzerinde doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Orkestrasyon | "agent'ların koordinatı nasıl" | Bundan sonra hangi düğümün/rolün/agent'nin çalışacağına karar veren katman. |
| Dayanıklı durum | "Yeniden başlattıktan sonra devam et" | Bir kontrol noktasına veya oturum deposuna bağlı, süreç ölümünden sağ kurtulan durum. |
| LLM seçilmiş yönlendirme | "Bırakın model karar versin" | Bir planlamacı LLM her turda bir sonraki adımı seçer; esnektir ancak her kararda tokens öder. |
| Açık yönlendirme | "Geliştirici karar verir" | Bir Python işlevi veya statik kenar bir sonraki adımı seçer; ucuz ve denetlenebilir. |
| Mürettebat | "Bir CrewAI ekibi" | Roller + görevler + süreç (sıralı veya hiyerarşik) tek bir çalıştırılabilirde birleştirilir. |
| Grup Sohbeti | "AutoGen'in çokluagent sohbeti" | N agent arasında konuşmacı seçiciyle yönetilen bir görüşme. |
| Takım (Agno) | "Çoklu-agent Agno" | Bir dizi agent üzerinden yönlendir / koordine et / işbirliği yap. |
| Durum Grafiği | "LangGraph'ın grafiği" | Yazılı durum, düğüm, koşullu kenar, denetim noktası soyutlaması. |

## Daha Fazla Okuma

- [LangGraph belgeleri](https://langchain-ai.github.io/langgraph/) — StateGraph, kontrol noktaları, kesintiler, zaman yolculuğu.
- [CrewAI belgeleri](https://docs.crewai.com/) — Ekipler, Akışlar, Agent'lar, Görevler, Süreçler.
- [AutoGen belgeleri](https://microsoft.github.io/autogen/) — DönüştürülebilirAgent, GroupChat, ekipler, araçlar.
- [Agno belgeleri](https://docs.agno.com/) — Agent, Ekip, İş Akışı, depolama, bellek.
- [Anthropic — Etkili agent'ler oluşturma (Aralık 2024)](https://www.anthropic.com/research/building-effective-agents) — model kitaplığı (prompt zincirleme, yönlendirme, paralelleştirme, orkestratör-çalışanlar, değerlendirici-optimizer) framework-agnostik.
- [Yao ve diğerleri, "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) - her framework döngüsü süsleniyor.
- [Wu ve diğerleri, "AutoGen: Multi-Agent Konuşma yoluyla Yeni Nesil LLM Uygulamalarını Etkinleştirme" (2023)](https://arxiv.org/abs/2308.08155) — AutoGen'in tasarım makalesi.
- [Park ve diğerleri, "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) — CrewAI tarzı kişilik yığınlarının üzerine inşa edildiği rol oynama temeli.
- Aşama 11 · 16 (LangGraph) — bu dersin framework karşısı benchmark.
- Aşama 11 · 19 (Yansıma) — LangGraph ile net bir şekilde ancak CrewAI ile garip bir şekilde eşleşen bir model.
- Aşama 11 · 22 (Üretim observability) — hangisini seçerseniz seçin framework nasıl enstrümanlandırılır.
