# Çoklu-Agent İlkel Model

> Dört temel öğe, başka bir şey değil - agent, aktarım, paylaşılan durum, orkestratör - dört boyutlu bir tasarım alanını kaplar ve 2026'daki başlıca çoklu-agent framework'ler (AutoGen, LangGraph, CrewAI, OpenAI Agent'nin SDK'sı, Microsoft Agent Framework) içindeki noktalardır. Bu ders onları sıfırdan oluşturur, dördünde de bir oyuncak sistemi çalıştırır, ardından her ana framework'ü aynı eksenlere eşler, böylece herhangi bir yeni sürümü tek bir paragrafta okuyabilirsiniz.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 (Agent Mühendislik), Aşama 16 · 01 (Neden Çoklu-Agent)
**Süre:** ~60 dakika

## Sorun

Her altı ayda bir yeni bir çoklu-agent framework gönderilir. 2023'te AutoGen. 2024'te CrewAI. 2024'te LangGraph ve OpenAI Swarm. Nisan 2025'te Google ADK. Şubat 2026'da Microsoft Agent Framework RC. Her basın bülteni "doğru soyutlama" olduğunu iddia ediyor.

Bunları birer birer öğrenmeye çalışırsanız tükenirsiniz. API'ler farklı görünüyor. Dokümanlar "agent"nin ne olduğu konusunda hemfikir değiller. framework'lerdan biri, paylaşılan hafızasına "karatahta" diyor, bir diğeri "mesaj havuzu" diyor, üçüncüsü ise "StateGraph" diyor. Alanın çalkalandığından şüphelenmeye başlıyorsunuz.

Değil. Pazarlamanın altında dört ilkel istikrarlıdır. Bunları bir kez öğrenin, her yeni framework'ü tek paragrafta okuyun.

## Konsept

### Dört ilkel

1. **Agent** — bir sistem prompt artı bir araç listesi. Vatansız; her çalıştırma kendi sisteminden prompt ve mevcut mesaj geçmişinden başlar.
2. **Handoff** — kontrolün bir agent'tan diğerine yapısal aktarımı. Mekanik olarak, yeni bir agent döndüren bir araç çağrısı veya bir koşulu takip eden bir grafik kenarı.
3. **Paylaşılan durum** — birden fazla agent'ın okuyabildiği (bazen yazabildiği) herhangi bir veri yapısı. Mesaj havuzu, yazı tahtası, anahtar-değer deposu, vektör belleği.
4. **Orkestratör** — bir sonraki kimin konuşacağına kim karar verirse. Seçenekler: açık bir grafik (deterministik), bir LLM hoparlör seçici (yumuşak), son konuşmacının geçiş çağrısı (OpenAI Swarm) veya bir kuyruk üzerinde bir zamanlayıcı (sürü mimarisi).

Tüm tasarım alanı budur. Her framework, her eksen için varsayılanları seçer; gerisi yüzey sözdizimidir.

### Her 2026 framework ona nasıl eşleşir?

| Framework | Agent | Aktarma | Paylaşılan durum | Orkestratör |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK'sı | `Agent(instructions, tools)` | araç şunu döndürür: Agent | arayanın sorunu | Yüksek Lisans'ın bir sonraki geçiş çağrısı |
| Otomatik Oluşturma v0.4 / AG2 | `ConversableAgent` | GroupChat'te konuşmacı seçici | mesaj havuzu | seçici işlevi (LLM veya hepsini bir kez deneme) |
| MürettebatAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Görev çıktıları zincirlendi | yöneticisi LLM veya statik sipariş |
| LangGrafik | düğüm işlevi | grafik kenarı + koşulu | `StateGraph` redüktör | grafik, deterministik |
| Microsoft Agent Framework | agent + orkestrasyon kalıpları | desene özel | konu / bağlam | desene özel |
| Google ADK'sı | agent + A2A kartı | A2A görevi | A2A artifacts | ev sahibi karar verir |

Yüzey farklılıkları çok büyük görünüyor. Altında: aynı dört düğme.

### Bu neden önemli?

İlkelleri gördüğünüzde, framework karşılaştırması kısa bir kontrol listesine dönüşür:

- Orkestratör yönlendirme konusunda LLM'ye güveniyor mu (Swarm) yoksa yönlendirmeyi koda mı sabitliyor (LangGraph)?
- Paylaşılan durum tam geçmiş mi (GroupChat) yoksa yansıtılmış mı (StateGraph azaltıcı)?
- agent'lar birbirlerinin prompt'larini (CrewAI yöneticisi) değiştirebilir mi, yoksa yalnızca devredebilir mi (Swarm)?

Bu üç soru %80'ini yanıtlıyor ve bunların framework belirli bir probleme uyuyor. "En iyi çoklu-agent framework" için alışveriş yapmayı bırakırsınız ve gerçekten önemsediğiniz eksen için tasarım yapmaya başlarsınız.

### Vatansızlık içgörüsü

Paylaşılan durum dışındaki her ilkel durum vatansızdır. Agent, (prompt, araçlar)'ın bir fonksiyonudur. Handoff bir işlev çağrısıdır. Orkestratör bir zamanlayıcıdır. **Sistemde durum bilgisi olan tek şey paylaşılan durumdur.** Tüm ilginç hataların yaşadığı yer burasıdır: bellek zehirlenmesi (Ders 15), mesaj sıralaması, sürüm oluşturma, yazma çekişmesi.

Paylaşılan durumu (Swarm) gizleyen Framework'ler sorunu arayana iletir. Merkezileştiren Framework'ler (LangGraph kontrol noktası, AutoGen havuzu) denetlenebilir hale getirir ancak koordinasyon maliyetini paylaşılan durum uygulamasına kaydırır.

### Tek bir ilkelin anatomisi

#### Agent

```
Agent = (system_prompt, tools, model, optional_name)
```

Bellek yok. Devlet yok. Aynı sistem prompt ve araçlara sahip iki agent birbiriyle değiştirilebilir. Her-agent durumu gibi görünen her şey aslında paylaşılan durumda veya aktarım protokolündedir.

#### Dokunma

```
Handoff = (from_agent, to_agent, reason, payload)
```

Üç uygulama hakimdir:

- **Fonksiyon dönüşü** — araç sonraki agent değerini döndürür. Bu OpenAI Swarm modelidir. Agent'lar araç şemalarında yönlendirme taşırlar.
- **Grafik kenarı** — LangGraph. Kenarlar bildirimseldir. Yüksek Lisans bir değer üretir; bir koşul bir sonraki düğümü seçer.
- **Hoparlör seçimi** — AutoGen GroupChat. Bir seçici işlevi (bazen kendisi de bir LLM çağrısıdır) havuzu okur ve bir sonraki konuşanı seçer.

#### Paylaşılan durum

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

En azından bir mesaj listesi. Genellikle daha fazlası: yapılandırılmış artifact'lar (CrewAI Görev çıktıları), yazılı bağlam (LangGraph azaltıcılar), harici bellek (MCP, vektör DB).

İki topoloji: **tam havuz** (her agent her mesajı görür) ve **öngörülen** (agent'lar rol kapsamlı bir görünüm görür). Dolu havuzlar basittir ve kötü ölçeklenir. Öngörülen havuzlar ölçeklenir ancak önceden şema tasarımı gerektirir.

#### Orkestratör

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Dört tat:

- **Statik** — grafik oluşturma sırasında sabitlenir (LangGraph deterministik, CrewAI Sıralı).
- **LLM seçili** — Yüksek Lisans, havuzu okur ve bir sonraki konuşmacıyı seçer (AutoGen, CrewAI Hiyerarşik).
- **Handoff odaklı** — geçerli agent, bir aktarım aracını (Swarm) çağırarak karar verir.
- **Kuyruk odaklı** — çalışanlar paylaşılan bir kuyruktan çekim yapar; açık bir sonraki konuşmacı yok (sürü mimarileri, Matrix).

### framework'ler arasında neler değişir?

İlkeller sabitlendikten sonra geri kalan tasarım kararları şunlardır:

- **Bellek stratejisi** — geçici ve kalıcı kontrol noktası oluşturma (LangGraph kontrol noktası).
- **Güvenlik sınırı** — aktarımı kim onaylayabilir (döngüdeki insan).
- **Maliyet muhasebesi** — agent token bütçe başına.
- **Observability** — aktarımların izlenmesi, tekrar oynatma için kalıcı durum.

Hepsi ilkellerin üzerine uygulanabilir. Hiçbiri yeni ilkel değil.

## Build It — Kendin Geliştir

`code/main.py` dört temel öğeyi stdlib Python'un ~150 satırında uygular. Gerçek bir LLM yok — her agent kodlanmış bir politikadır, dolayısıyla odak noktası koordinasyon yapısı üzerinde kalır.

Dosya dışa aktarılır:

- `Agent` — ad, sistem prompt, araçlar, politika işlevinden oluşan bir veri sınıfı.
- `Handoff` — yeni bir agent döndüren işlev.
- `SharedState` — iş parçacığı açısından güvenli bir mesaj havuzu.
- `Orchestrator` — üç değişken: `StaticOrchestrator`, `HandoffOrchestrator`, `LLMSelectorOrchestrator` (simüle edilmiş).

Demo, üç orkestratör türünün tümü aracılığıyla aynı üç-agent ardışık düzenini (araştırma → yazma → inceleme) çalıştırır ve sonunda mesaj havuzunu yazdırır. Çıktıların yalnızca *sonraki kişiyi seçecek* açısından farklılık gösterdiğini görebilirsiniz; agent'lar ve paylaşılan durum, çalıştırmalar arasında aynıdır.

Çalıştır:

```
python3 code/main.py
```

Beklenen çıktı: desen başına bir tane olmak üzere üç orkestratör çalışması. Her biri son mesaj havuzunu yazdırır. Eğer araştırmacı bunun erken yapıldığına karar verirse, aktarmaya dayalı çalıştırma daha az agent saniyeye ulaşır; bu, LLM yönlendirme değiş tokuşunun minyatür halidir.

## Use It — Hazır Araçla Uygula

`outputs/skill-primitive-mapper.md` , herhangi bir çoklu-agent kod tabanını veya framework belgesini okuyan ve dört temel eşlemeyi döndüren bir beceridir. Dokümanları derinlemesine okumadan önce tek paragraflık bir anlayış elde etmek için bunu yeni bir framework sürümünde çalıştırın.

## Ship It — Kullanıma Sun

Yeni bir framework'yı benimsemeden önce, onun ilkel eşlemesini yazın. Bunu yapamıyorsanız, dokümanlar eksiktir veya framework beşinci bir ilkel icat ediyordur (nadir — görmediğiniz bir paylaşılan durum çeşidini kontrol edin).

Eşlemeyi mimari belgenize sabitleyin. Yeni bir ekip üyesi katıldığında, eşlemeyi API belgelerinden önce onlara gönderin. framework sürümü değiştiğinde, değişiklik günlüğünü değil eşlemeyi farklılaştırın.

## Egzersizler

1. `code/main.py` 'yi farklı agent politikalarıyla üç kez çalıştırın. Orkestratör seçiminin hangi agent'larin çalıştırıldığını nasıl değiştirdiğini gözlemleyin.
2. Dördüncü bir orkestratör türü uygulayın: agent'ın iş için paylaşılan durumu yokladığı sıraya dayalı bir orkestratör türü. Hangi kilitlenme meydana gelebilir ve bunu nasıl tespit edersiniz?
3. LangGraph hızlı başlangıcını (https://docs.langchain.com/oss/python/langgraph/workflows-agents) alın ve onu dört temel öğe olarak yeniden yazın. LangGraph'ın soyutlamalarından hangisi 1:1'i eşler ve hangileri kolaylık sarmalayıcıdır?
4. OpenAI Swarm yemek kitabını (https://developers.openai.com/cookbook/examples/orchestrating_agents) okuyun. Swarm'ın dört temel özellikten hangisini en ergonomik hale getirdiğini ve hangisini arayan kişiye ilettiğini belirleyin.
5. Bu tabloda paylaşılan durumu tamamen gizleyen bir framework bulun. agent'ların geçmişi yeniden okumadan aktarımlar arasında koordinasyon sağlaması gerektiğinde neyin bozulduğunu açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agent | "Araçlarla birlikte bir Yüksek Lisans" | Bir `(system_prompt, tools, model)` üçlüsü. Vatansız. |
| Aktarma | "Kontrolün devri" | Sonraki agent ve isteğe bağlı yükü adlandıran yapılandırılmış bir çağrı. Üç uygulama: fonksiyon dönüşü, grafik kenarı, hoparlör seçimi. |
| Paylaşılan durum | "Bellek" / "bağlam" | Çoklu-agent sisteminin durum bilgisi olan tek kısmı. Mesaj havuzu veya yazı tahtası. |
| Orkestratör | "Koordinatör" | Sırada kimin koşacağına kim karar verirse. Statik grafik, LLM seçici, aktarmaya dayalı veya sıraya dayalı. |
| İlkel | "Soyutlama" | Her framework'ün parametrelediği dört eksenden biri. Bir framework özelliği değildir. |
| Mesaj havuzu | "Paylaşılan sohbet geçmişi" | Tam geçmiş paylaşılan durumu. Mantık yürütmek kolay, kötü ölçekleniyor. |
| Öngörülen durum | "Kapsamlı görünüm" | Paylaşılan duruma göre role özgü görünüm. Ölçekler, şema tasarımı gerektirir. |
| Hoparlör seçimi | "Sırada kim konuşacak" | Bir işlevin (genellikle bir LLM) bir gruptan sonraki agent öğesini seçtiği Orkestratör modeli. |

## Daha Fazla Okuma

- [OpenAI yemek kitabı: Orchestrating Agent'lar — Rutinler ve Aktarmalar](https://developers.openai.com/cookbook/examples/orchestrating_agents) — aktarıma dayalı düzenlemenin en net ifadesi
- [AutoGen stabil docs](https://microsoft.github.io/autogen/stable/) — GroupChat + hoparlör seçimi, LLM tarafından seçilen orkestrasyon için referanstır
- [LangGraph iş akışları ve agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — grafik kenarı orkestrasyonu ve azaltıcı tabanlı paylaşımlı durum
- [CrewAI tanıtımı](https://docs.crewai.com/en/introduction) — rol-hedef-arka plan hikayesi agent'lar, Sıralı / Hiyerarşik süreçler
- [AG2 (topluluk AutoGen devamı)](https://github.com/ag2ai/ag2) — Microsoft'un v0.4 bakıma almasından sonra canlı AutoGen v0.2 hattı
