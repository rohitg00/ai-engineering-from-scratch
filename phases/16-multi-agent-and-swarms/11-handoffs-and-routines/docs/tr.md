# Aktarmalar ve Rutinler — Durum Bilgisiz Düzenleme

> OpenAI'nin Swarm'ı (Ekim 2024), çoklu-agent orkestrasyonunu iki temel öğeye ayırdı: **rutinler** (sistem olarak talimatlar + araçlar prompt) ve **aktarım** (başka bir Agent döndüren bir araç). Durum makinesi yok, dallara ayrılan DSL yok; LLM, sağ geçiş aracını çağırarak yönlendirir. OpenAI Agent'nin SDK'sı (Mart 2025), üretimin devamıdır. Swarm'ın kendisi en net kavramsal referans olmaya devam ediyor; kaynağının tamamı birkaç yüz satıra sığıyor. Model viraldir çünkü API yüzeyi kabaca "agent = prompt + araçlar; aktarım = agent döndüren işlev." Sınırlama: durum bilgisi yoktur, dolayısıyla hafıza arayanın sorunudur.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model)
**Süre:** ~60 dakika

## Sorun

Her multi-agent framework DSL'sini öğrenmenizi ister: LangGraph düğümleri ve kenarları, CrewAI ekipleri ve görevleri, AutoGen GroupChat ve yöneticileri. DSL'ler gerçek soyutlamalardır, ancak nesneyi olması gerekenden daha ağır hissettirirler.

Sürü ters yönde ilerlemektedir: Modelin halihazırda sahip olduğu araç çağırma yeteneğini kullanın. Aktarmalar araç çağrılarına dönüşür. Orkestratör, şu anda konuşmayı yürüten agent kişidir. Durum makinesi agent'larin sistemi prompt'larde örtülüdür.

## Konsept

### İki ilkel

**Rutin.** Bir agent'ın rolünü ve mevcut araçları tanımlayan bir sistem prompt. Bunu kapsamlı bir talimatlar dizisi gibi düşünün: "siz bir önceliklendirmelisiniz agent; kullanıcı geri ödeme talebinde bulunursa geri ödemeyi agent yapın."

**Handoff.** agent'ın çağırabileceği ve yeni bir Agent nesnesi döndüren bir araç. Swarm çalışma zamanı, Agent dönüş değerini algılar ve bir sonraki tur için aktif agent'ı değiştirir.

Bütün soyutlama budur.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

Triyaj agent'ın sistemi prompt, kullanıcı mesajına dayalı olarak doğru geçişi seçmesini sağlar. Yüksek Lisans'ın araç çağrısı yönlendirmeyi yapar.

### Neden viral?

- **Küçük API.** Öğrenilecek iki kavram.
- **Modelin halihazırda yaptığını kullanır.** Tool calling zaten sağlayıcılar genelinde üretim düzeyindedir.
- **Durum-makine yükü yok.** Grafiği tanımlamıyorsunuz; agent'ların prompt'ları kime devrettiklerini açıklar.

### Vatansız ticaret

Swarm, çalıştırmalar arasında açıkça vatansızdır. framework, çalıştırma sırasında bir mesaj geçmişi tutar, ancak hiçbir şeyi kalıcı hale getirmez. Bellek, süreklilik, uzun süren görevler; tüm arayanın sorunudur.

Üretimde (OpenAI AgentSDK'sı, Mart 2025) değişen ana şeylerden biri şuydu: SDK, aktarımı ilkel tutarken yerleşik oturum yönetimi, korumalar ve izleme ekler.

### Sürü/aktarma uygun olduğunda

- **Triyaj modelleri.** Ön hat agent kullanıcıyı bir uzmana yönlendirir.
- **Beceriye dayalı aktarımlar.** "Görev kod gerektiriyorsa kodlayıcıyı arayın; araştırma gerektiriyorsa araştırmacıyı arayın."
- **Kısa, sınırlı görüşmeler.** Müşteri desteği, SSS'den bildirime, basit iş akışları.

### Swarm mücadele ederken

- **Paylaşılan hafızaya sahip uzun oturumlar.** Aktarmalar, konuşma durumunu yeni agent'ın prompt artı geçmişine sıfırlar. Arayan tarafından yönetilen bellek olmadan agent'lar arasında kalıcı durum yok.
- **Paralel yürütme.** Aktarma teker teker yapılır; etkin agent anahtarları. Paralellik, arayanın birden fazla Swarm çalışmasını düzenlemesini gerektirir.
- **Denetim ve tekrar oynatma.** Durum bilgisi olmayan çalıştırmaların tam olarak tekrar oynatılması zordur; LLM'nin devir seçimi deterministik değildir.

### OpenAI Agent SDK'sı (Mart 2025)

Üretimin halefi şunları ekliyor:

- **Oturum durumu.** Çalışmalar arasında kalıcı iş parçacığı.
- **Korkuluklar.** Giriş/çıkış doğrulama kancaları.
- **İzleme.** Her takım çağrısı ve aktarım günlüğe kaydedilir.
- **Dağıtım filtreleri.** Aktarma sırasında hangi bağlamın aktarılacağını kontrol edin.

Aktarılan ilkel hayatta kalır; üretim ergonomisi de buna ekleniyor.

### Swarm ve Grup Sohbeti

Her ikisi de Yüksek Lisans odaklı yönlendirmeyi kullanır, ancak **sonraki kişiyi kimin seçeceği** konusunda farklılık gösterirler:

- Grup Sohbeti: bir seçici (işlev veya LLM) bir sonraki konuşmacıyı dışarıdan seçer.
- Swarm: mevcut agent, bir aktarma aracını çağırarak halefini seçer.

Swarm "agent sırada ne olacağına karar verir"; GroupChat "sırada ne olacağına yönetici karar verir" demektir. Swarm'ın kararı aktif agent'ın araç çağrısında yatıyor; GroupChat `GroupChatManager`'da yaşıyor.

## Build It — Kendin Geliştir

`code/main.py` , Swarm'ı sıfırdan uygular: bir Agent veri sınıfı, bir aktarma mekanizması (araç, Agent'yi döndürür) ve agent anahtarlarını algılayan bir çalıştırma döngüsü.

Demo: geri ödeme, satış veya destek uzmanlarına giden bir önceliklendirme agent yönlendirir. Her uzmanın kendi araçları vardır. Çalıştırma döngüsü her aktarımı yazdırır.

Koşmak:

```
python3 code/main.py
```

## Use It — Hazır Araçla Uygula

`outputs/skill-handoff-designer.md` , belirli bir görev için bir aktarım topolojisi tasarlar: hangi agent'lar mevcuttur, hangi aktarımları çağırabilirler, hangi bağlam aktarımlarını gerçekleştirirler.

## Ship It — Kullanıma Sun

Kontrol listesi:

- **Handoff günlüğü.** Her aktarım, from-agent, to-agent bağlam anlık görüntüsüyle bir izleme olayı yazar.
- **Bağlam aktarım kuralları.** Aktarma sırasında neyin hareket edeceğine karar verin: tam geçmiş (pahalı), son N mesaj veya özet.
- **Atlatma sırasında korkuluk.** Farklı araç izinlerine sahip bir uzmana aktarmanın doğrulanması gerekir; aksi takdirde prompt enjeksiyonu, istenmeyen aktarımlara neden olabilir.
- **Döngü tespiti.** İki agent'ın ileri geri teslim edilmesi yaygın bir başarısızlıktır; basit bir son K halkası kontrolüyle tespit edin.
- **Geri çekilme agent.** Aktarma hedefi mevcut değilse, güvenli bir varsayılana geri dönün.

## Egzersizler

1. `code/main.py` komutunu çalıştırın, agent geri ödemesine öncelik verin. İkinci turun aktif agent'sinin iade olduğunu onaylayın.
2. Bir döngü algılama kuralı ekleyin: eğer aynı iki agent art arda 3 kez dağıtıldıysa, çıkışı zorlayın. Geri dönüşü tasarlayın.
3. OpenAI Agent'nin aktarım filtreleriyle ilgili SDK belgelerini okuyun. Bir "devrederken özetleme" versiyonunu uygulayın: Giden agent, gelen agent devralmadan önce bağlamı bir madde işareti özetine sıkıştırır.
4. Swarm aktarımını GroupChatManager seçiciyle karşılaştırın. Hangi model prompt enjeksiyonunu daha da kötüleştirir ve neden?
5. Swarm yemek kitabını okuyun (https://developers.openai.com/cookbook/examples/orchestrating_agents). Swarm'ın OpenAI AgentSDK'sını değiştirmesi veya saklaması konusunda verdiği açık bir tasarım kararını tanımlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Rutin | "agent prompt" | Sistem prompt + araç listesi. Rolü ve mevcut aktarımları tanımlar. |
| Aktarma | "Başka bir agent'a aktar" | Aktif agent'ın çağırabileceği ve yeni bir Agent döndüren bir araç. Çalışma zamanı anahtarları etkin agent. |
| Vatansız | "Çalıştırmalar arasında bellek yok" | Swarm hiçbir şeye ısrar etmez; hafıza arayanın sorumluluğundadır. |
| Aktif agent | "Şu anda kim konuşuyor" | Şu anda konuşmayı yürüten agent. Handoff bunu değiştirir. |
| Bağlam aktarımı | "Devirde ne hareket eder" | Gelen agent'ın hangi geçmişi göreceğine ilişkin politika: tam, son N veya özet. |
| Aktarma döngüsü | "Agentmasa tenisi" | İki agent'ın birbirine geri vermeye devam ettiği arıza modu. |
| OpenAI Agent'nin SDK'sı | "Üretim Sürüsü" | Mart 2025 halefi; devretme ilkelinin üstüne oturumlar, korkuluklar ve izleme ekler. |
| Aktarma filtresi | "Transfer kapısı" | Aktarım sınırındaki bağlamı incelemek ve değiştirmek için SDK özelliği. |

## Daha Fazla Okuma

- [OpenAI yemek kitabı — Agent'ları Düzenlemek: Rutinler ve Aktarmalar](https://developers.openai.com/cookbook/examples/orchestrating_agents) — referans eklemleme
- [OpenAI Swarm repo](https://github.com/openai/swarm) — orijinal uygulama, kavramsal referans olarak tutuldu
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — oturumlar ve izlemeyle üretim halefi
- [Claude'da antropik aktarım notları](https://docs.anthropic.com/en/docs/claude-code) — Claude Kodu altagent'ları, `Task` aracılığıyla aktarıma benzer bir modeli nasıl kullanır?
