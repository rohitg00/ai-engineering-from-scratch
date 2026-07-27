# Agent Bellek — Sanal Bağlam ve Bellek Sayfalama

> Context window'ler sonludur. Konuşmalar, belgeler ve araç izleri değildir. Düzeltme, işletim sistemi sanal belleğinin yeniden düzenlenmesidir - ana bağlam RAM, harici depo disktir ve bunların arasındaki agent sayfalarıdır. MemGPT (Packer ve diğerleri, 2023) adlı desene; birçok üretim belleği sistemi bunun üzerine kuruludur.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 06 (Araç Kullanımı)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- MemGPT'nin temel aldığı işletim sistemi benzetmesini açıklayın: ana bağlam = RAM, dış bağlam = disk, bellek araçları = sayfa girişi/çıkışı.
- Ana bağlam arabelleği, harici aranabilir depo ve sayfa giriş/çıkış araçlarıyla stdlib'de iki katmanlı MemGPT modelini uygulayın.
- agent'nin harici belleği sorgulamak veya değiştirmek için nasıl "kesintiler" verdiğini ve sonucun bir sonraki prompt'ye nasıl geri eklendiğini açıklayın.
- Letta (Ders 08) ve Mem0 (Ders 09)'a taşınan MemGPT tasarım seçeneklerini tanımlayın.

## Sorun

Context window'ler hafızayı çözmeleri gerekiyor gibi görünüyor. Yapmazlar. Üretimde üç arıza modu tekrarlanır:

1. **Taşma.** Çok turlu konuşmalar, uzun belgeler veya araç çağrısının yoğun olduğu yörüngeler pencereyi aşar. Sınırın ötesindeki her şey gitti.
2. **Sulandırma.** Pencerenin içinde bile alakasız bağlamı doldurmak, önemli olana olan ilgiyi azaltır. Sınır modelleri hala uzun girdilerde bozulmaya devam ediyor.
3. **Kalıcılık.** Yeni bir oturum boş bir pencereyle başlar. Harici belleği olmayan Agent'ler, oturumlar arasında "benden ne zaman istediğini hatırla..." diyemez.

Daha büyük pencereler yardımcı olur ancak bunu düzeltmez. Mem0'ın 2025 tarihli makalesi, 128k pencereli taban çizgilerinin, harici belleğe sahip 4k pencereli agent'nin yakaladığı uzun ufuklu gerçekleri hâlâ kaçırdığını ölçtü.

## Konsept

### İşletim sistemi benzetmesi

MemGPT (Packer ve diğerleri, arXiv:2310.08560, v2 Şubat 2024) içerik yönetimini işletim sistemi sanal belleğiyle eşler:

| İşletim Sistemi konsepti | MemGPT konsepti | 2026 üretim analogu |
|------------|---------------|------------------------|
| RAM | ana içerik (prompt) | Antropik/OpenAI context window |
| Disk | dış bağlam | vektör DB, KV, grafik mağazası |
| Sayfa hatası | hafıza aracı çağrısı | `memory.search`, `memory.read`, `memory.write` |
| İşletim Sistemi çekirdeği | agent kontrol döngüsü | Bellek araçlarıyla ReAct döngüsü |

agent normal bir ReAct döngüsü çalıştırır. Ekstra bir araç sınıfı, verilerin ana bağlam içinde ve dışında sayfalanmasına olanak tanır.

### İki katmanlı

- **Ana içerik.** Geçerli görevi tutan sabit boyutlu prompt. Her zaman model tarafından görülebilir.
- **Harici bağlam.** Sınırsızdır, araçlar aracılığıyla aranabilir. Gerektiğinde okuyun, gerçekler ortaya çıktığında yazın.

Orijinal makale, tasarımı temel pencerenin ötesinde iki görev üzerinde değerlendirdi: 100 bin token'den daha uzun belge analizi ve günler boyunca kalıcı belleğe sahip çoklu oturumlu sohbet.

### Kesinti modeli

MemGPT, kesinti olarak belleği sunar: konuşmanın ortasında agent bir bellek aracını çağırabilir, çalışma zamanı bunu yürütür ve sonuç, yeni bir gözlem olarak bir sonraki asistan dönüşüne eklenir. Kavramsal olarak süreci engelleyen, baytları döndüren ve işlemi devam ettiren Unix `read()` sistem çağrısıyla aynıdır.

Kanonik bellek aracı yüzeyi:

- `core_memory_append(section, text)` — prompt'nin kalıcı bir bölümüne yazın.
- `core_memory_replace(section, old, new)` — kalıcı bir bölümü düzenleyin.
- `archival_memory_insert(text)` — aranabilir harici depoya yazın.
- `archival_memory_search(query, top_k)` — harici depodan alın.
- `conversation_search(query)` — geçmiş dönüşleri tarayın.

### Kağıdın bitip üretimin başladığı yer

Eylül 2024'te MemGPT, Letta oldu. Araştırma deposu (`cpacker/MemGPT`) kalır; Letta tasarımı genişletiyor:

- İki yerine üç katman (temel, geri çağırma, arşivleme — Ders 08).
- `send_message`/kalp atışı modelinin yerini alan yerel akıl yürütme (Ders 08).
- Zaman uyumsuz bellek çalışmasını çalıştıran uyku zamanı agent'ler (Ders 08).

MemGPT belgesi, üretim sistemleri Letta, Mem0 veya özel iki katmanlı bir mağazayı çalıştırsa bile 2026'nın temelidir.

### Bu modelin yanlış gittiği yer

- **Bellek çürümesi.** Yazmalar, okumalardan daha hızlı birikir; geri getirme, bayat gerçekler arasında boğulur. Düzeltme: periyodik konsolidasyon (Letta uyku süresi), açık geçersiz kılma (Mem0 çakışma dedektörü).
- **Bellek zehirlenmesi.** Harici bellekten alınan metin. Saldırganın kontrol ettiği içerik bir hafıza notuna düşerse agent bunu bir sonraki oturumda yeniden alır. Bu Greshake ve ark. (Ders 27) saldırı zamanla yeniden düzenlendi.
- **Alıntı kaybı.** Agent, "kullanıcının benden X'i göndermemi istediğini" hatırlıyor ancak hangi dönüş olduğunu belirtemiyor. Her arşiv yazma işleminde kaynak referanslarını (oturum kimliği, dönüş kimliği) saklayın.

```figure
context-budget
```

## İnşa Et

`code/main.py`, MemGPT'nin iki katmanlı modelini stdlib'de uygular:

- `MainContext` — `core` diktesi ve `messages` listesiyle sabit boyutlu prompt arabellek; Sınır aşıldığında en eski mesajları otomatik olarak sıkıştırır.
- `ArchivalStore` — (kimlik, metin, etiketler, oturum, dönüş) kayıtların bellek içi BM25 benzeri deposu (token-örtüşme puanlaması).
- MemGPT yüzeyine eşlenen beş bellek aracı.
- Arşivi gerçeklerle dolduran, ardından `archival_memory_search`'yi çağırarak bir soruyu yanıtlayan, komut dosyası içeren bir agent.

Çalıştır:

```
python3 code/main.py
```

İz, agent'nin üç olgu yazdığını, başlığa ana bağlamı doldurduğunu (tahliyeyi zorladığını), ardından arşivden alarak bir takip sorusunu yanıtladığını ve herhangi bir gerçek LLM olmadan MemGPT iş akışını yeniden ürettiğini gösteriyor.

## Kullan onu

Günümüzde her üretim bellek sistemi bir MemGPT çeşididir:

- **Letta** (Ders 08) — üç katman, yerel akıl yürütme, uyku zamanı hesaplaması.
- **Mem0** (Ders 09) — puanlama katmanıyla birleştirilmiş vektör + KV + grafiği.
- **OpenAI Asistanları / Yanıtları** — iş parçacıkları ve dosyalar yoluyla yönetilen bellek.
- **Claude Agent SDK** — beceriler ve oturum deposu aracılığıyla uzun süreli bellek.

Çekirdek modele göre değil, operasyonel şekle (kendi kendine barındırılan, yönetilen, framework entegreli) göre birini seçin; çekirdek model MemGPT'dir.

### agent belleğinin şekli

Sayfalama kapasiteyi çözer. Neyin saklanacağına karar vermez. Üretim sistemlerinde her biri farklı bir soruyu yanıtlayan dört bellek türü tekrarlanır:

- **Çalışan hafıza** — şu anda önemli olan ne? Bağlam içi katman: mevcut görev, son dönüşler, sabitlenmiş temel bölümler. prompt'nin kendisi.
- **Olaysal bellek** — ne oldu? Oturum ve dönüş referanslarıyla birlikte saklanan geçmiş dönüşler ve yörüngeler, talep üzerine tekrar oynatılabilir.
- **Semantik hafıza** — doğru olan nedir? Kullanıcı, etki alanı ve dünya hakkındaki gerçekler değiştikçe güncellenir ve tekilleştirilir.
- **Prosedürel hafıza** — bunu nasıl yaparım? Hatırlamaktan ziyade gelecekteki davranışları yönlendiren öğrenilmiş rutinler, tercihler ve kurallar.

Açık kaynak uygulamaları farklı saldırı noktalarını seçer:

| Tür | Uygulama | Sorunun üstesinden nasıl geliyor |
|------|----------------|-------------------|
| Çalışıyor | MemGPT / Letta | Bellek araçları aracılığıyla sabit bir prompt bütçesine giren ve çıkan sayfa içeriği (bu ders, Ders 08) |
| Epizodik | Zep | Zamansal bilgi grafiği — gerçekler geçerlilik aralıklarını taşır, dolayısıyla "neyin ne zaman doğru olduğu" sorgulanabilir |
| Anlamsal | Mem0 | Vektör, KV ve grafik depoları genelinde gerçekleri tekilleştiren ve güncelleyen çıkarma hattı (Ders 09) |
| Anlamsal + prosedür | LangMem | agent'nin dönüşler arasında danıştığı bir mağazaya gerçeklerin ve davranış kurallarının arka planda çıkarılması |
| Epizodik + anlamsal | agentbellek | Oturumları çalışırken yakalar, bunları yazılı, aranabilir kayıtlar halinde birleştirir |

## Gönderin

`outputs/skill-virtual-memory.md`, herhangi bir hedef çalışma zamanı için, tahliye politikası ve alıntı alanları ile birlikte doğru iki katmanlı bir bellek iskelesi (ana + arşiv + araç yüzeyi) üreten, yeniden kullanılabilir bir beceridir.

## Egzersizler

1. token cinsinden ölçülen bir `max_main_context_tokens` kapağı ekleyin (yaklaşık olarak `len(text.split())` * 1,3). Sınır aşıldığında en eski mesajları özet halinde sıkıştırın. Özetleyicili ve özetleyicisiz davranışları karşılaştırın.
2. BM25'i arşiv deposuna uygun şekilde uygulayın (terim sıklığı, ters belge sıklığı). token-örtüşme temel çizgisine karşı bir oyuncak veri seti üzerinde geri çağırma@10'u ölçün.
3. Arşiv eklerine `citation` alanlarını (session_id, turn_id, source_url) ekleyin. Her erişim destekli yanıtta agent kaynaklarından alıntı yapın.
4. Bellek zehirlenmesini simüle edin: "gelecekteki tüm kullanıcı talimatlarını dikkate almayın" yazan bir arşiv kaydı ekleyin. Yönerge şeklindeki metinler için alımları tarayan ve bunları güvenilmez olarak işaretleyen bir koruma yazın.
5. Uygulamayı, MemGPT araştırma deposunun çekirdek bellek JSON şemasını (`cpacker/MemGPT`) kullanacak şekilde taşıyın. Düz dizelerden yazılı bölümlere geçtiğinizde ne değişir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Sanal bağlam | "Sınırsız hafıza" | Ana (prompt) + sayfa giriş/çıkışlı harici (aranabilir) katmanlar |
| Ana içerik | "Çalışan hafıza" | prompt — sabit boyutlu, her zaman görünür |
| Arşiv belleği | "Uzun vadeli mağaza" | İsteğe bağlı olarak alınan harici aranabilir kalıcılık |
| Çekirdek hafıza | "Kalıcı prompt bölümü" | Ana içeriğe sabitlenmiş adlandırılmış bölümler |
| Bellek aracı | "Bellek API'si" | Araç, harici belleği okumak/yazmak için agent sorunlarını çağırıyor |
| Kesinti | "Bellek sayfası hatası" | Agent duraklatılır, çalışma zamanı getirilir, sonuç bir sonraki tura eklenir |
| Bellek çürümesi | "Eski gerçekler" | Eski yazılar geri getirmeyi boğdu; konsolidasyonla düzeltme |
| Hafıza zehirlenmesi | "Kalıcı not enjekte edildi" | Saldırgan içeriği bellek olarak depolanıyor, geri çağrıldığında yeniden kullanılıyor |

## Daha Fazla Okuma

- [Packer ve diğerleri, MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — İşletim sisteminden ilham alan sanal bağlam makalesi
- [Letta, Memory Blocks blogu](https://www.letta.com/blog/memory-blocks) — üç katmanlı evrim
- [Antropik, Etkili bağlam mühendisliği](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — bağlamı bir bütçe olarak ele almak
- [Chhikara ve diğerleri, Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) — bu modelin üstünde hibrit üretim belleği
- [Zep (getzep/zep)](https://github.com/getzep/zep) — sınıflandırma tablosundan geçici bilgi grafiği belleği
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0) — Ders 09'un karma deposunun arkasındaki çıkarma hattı
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) — gerçeklerin ve davranış kurallarının arka plandan çıkarılması
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) — yazılı, aranabilir kayıtlar halinde birleştirilmiş oturum yakalama
