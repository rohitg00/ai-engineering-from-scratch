# Ajan belleği  Sanal bağlam ve bellek sayfalama

> Kontext pencereleri sınırlıdır. Konuşmalar, belgeler ve araç izleri yoktur. Düzeltme OS sanal bellek yeniden düzenlenmiştir.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- MemGPT'nin OS analogisi üzerinde inşa ettiği durumu açıklayın: ana bağlam = RAM, dış bağlam = disk, bellek araçları = sayfa giriş/çıktı.
- Stdlib'de iki katlı MemGPT kalıbını ana bağlam tamponu, dış arama edilebilir bir depo ve sayfa giriş/çıktı araçlarıyla uygulayın.
- Ajanın dış hafızayı sorgulama veya değiştirme için "kesinleştirme" verisini nasıl çıkardığını ve sonuç nasıl bir sonraki çağrıya geri döndürüldüğünü açıklayın.
- Letta (Desin 08) ve Mem0 (Desin 09) ile ilgili MemGPT tasarım seçeneklerini tanımlayın.

## Sorun

Kontext pencereleri hafıza çözmek zorunda gibi görünüyor.

1. **Overflow.**Çoklu dönüşlü konuşmalar, uzun belgeler ya da araçlar ağırlıklı yollar pencereden geçer.
2. **Dilution.**Pencerede bile, alakasız bağlamı doldurmak önem taşıyan şeylere odaklanmayı azaltır.
3. **Persistence.**Dış hafızası olmayan ajanlar, seanslar boyunca "benimden istediğin zaman hatırladın" demezler.

Mem0'un 2025 makalesinde 128k penceresi taban çizgilerinin hala dış bellek ile 4k penceresi ajanının yakaladığı uzun ufaklık gerçekleri kaçırdıklarını ölçtüler.

## Anlaşım

### OS Analogisi

MemGPT (Packer et al., arXiv:2310.08560, v2 Şubat 2024) işletim sisteminin sanal belleğine bağlam yönetimini haritası yapar:

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

Ajan normal bir ReAct döngüsünü çalışır. Bir ek araç sınıfı, ana bağlamdan içeri ve dışarıdaki verileri sayfalamalarına izin verir.

### İki kat

- **Main context.**Sürekli çalıştırılan görevleri sabit boyutta bekliyor.
- **External context.**Sınırsız, araçlarla arama yapılabilir, uygun olduğunda okuyun, gerçekler ortaya çıktığında yazın.

Orijinal makalede tasarım temel pencerenin ötesinde iki görev üzerinde değerlendirilmiştir: 100k tokenden uzun bir belge analizi ve günler boyunca sürekli bellek ile çok seanslı sohbet.

### Kesinleşme örneği

MemGPT, bir konuşmanın ortasında bir hafıza aracı çağırabilir, çalıştırma zamanı onu yürütür ve sonuç yeni bir gözlem olarak bir sonraki yardımcı dönüşe karışır.`read()`Syscall işlemin engellenmesini sağlar, bytes iade eder ve işlem devam eder.

Canonical bellek alet yüzeyi:

- `core_memory_append(section, text)` istekli bir bölümde yazın.
- `core_memory_replace(section, old, new)` kalıcı bir bölüm düzenle.
- `archival_memory_insert(text)` arama yapılabilir dış mağazaya yazın.
- `archival_memory_search(query, top_k)` Dış dükkandan alın.
- `conversation_search(query)` dönüşlerin geçmişini tarayın.

### Kağıtın bittiği ve üretimin başladığı yer

Eylül 2024'te MemGPT Letta oldu.`cpacker/MemGPT`Letta tasarımı genişletiyor:

- İki yerine üç kat (core, recall, archive  Lesson 08).
- Dönemli bir mantık , `send_message`/kalp atış tarzı (Denevi 08).
- Asynk hafıza çalışmasını yapan uyku zamanı ajanları (Denevi 08).

MemGPT kağıdı, üretim sistemleri Letta, Mem0 veya özel iki katlı bir mağaza çalıştırsa bile 2026'da temel olur.

### Bu kalıp yanlış gittiğinde

- **Memory rot.**Yazılar okuduklardan daha hızlı birikir; geri alınma eski gerçeklere boğulur.
- **Memory poisoning.**Dış hafıza, alınan metin. Eğer saldırgan kontrolü altındaki içerik bir hafıza notuna yer alırsa, ajan onu bir sonraki oturumda yeniden yerleştiriyor. Bu Greshake et al. (Daahi 27) saldırısı. Zamanla yeniden düzenlenmiştir.
- **Citation loss.**Ajan "kullanıcı bana X'i göndermemi istedi" diyerek hatırlıyor ama hangi sırayı belirleyemiyor.

```figure
context-budget
```

## Yapın

`code/main.py`MemGPT'nin stdlib'de iki katlı kalıpını uyguluyor:

- `MainContext` Bir `core`dict ve a `messages`list; en eski mesajları otomatik olarak kapalı olduğunda kompakt eder.
- `ArchivalStore` BM25-esque depolama (token-overlap skorlama) (id, metin, etiket, seans, dönüş) kayıtları.
- MemGPT yüzeyine haritan beş bellek aracı.
- Bir senaryolu ajan, arşivini gerçeklerle doldurur, sonra bir soru sorarak cevap verir.`archival_memory_search`- Evet .

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İzleme, ajanın üç gerçek yazıp, kapıya ana bağlamı doldurduğunu (sürütme zorlaması) ve ardından arşivden alınarak bir sonraki soruya cevap verdiğini gösterir MemGPT iş akışını gerçek bir LLM olmadan yeniden üretir.

## Kullan

Günümüzde her üretim bellek sistemi MemGPT'nin bir variantidir:

- **Letta**Üç kat, yerli düşünce, uyku zamanı hesaplama.
- **Mem0**(Deneyim 09)  vektör + KV + grafik bir puanlama katmanı ile birleşmiştir.
- **OpenAI Assistants / Responses** İpuçlar ve dosyalar üzerinden bellek yönetimi.
- **Claude Agent SDK** Yetenekler ve seans depolama yoluyla uzun süreli hafıza.

Birini işletim şekli (kendini barındırmak, yönetmek, çerçeveye entegre olmak) ile seçin, temel örneğe göre değil.

### Ajan hafızasının şekli

Sayfalama kapasiteyi çözür. Neyi depolayacağına karar vermez.

- **Working memory** şu anda neyin önemi var? bağlam içi katman: mevcut görev, son dönümler, sabitlenmiş çekirdek bölümler.
- **Episodic memory**Geçmiş dönümler ve yörüngeler, seans ve dönüm referansları ile depolanır, talep üzerine tekrarlanabilir.
- **Semantic memory** Gerçek nedir? Kullanıcı, alan, dünya hakkındaki gerçekler, değişikliğiyle güncelleştirilmiş ve kopyalanmıştır.
- **Procedural memory**Bunu nasıl yapabilirim? Gelecekteki davranışları hatırlamak yerine yönlendiren rutinleri, tercihleri ve kuralları öğrendim.

Açık kaynaklı uygulamalar farklı saldırı noktalarını seçer:

| Type | Implementation | How it tackles it |
|------|----------------|-------------------|
| Working | MemGPT / Letta | Pages content in and out of a fixed prompt budget via memory tools (this lesson, Lesson 08) |
| Episodic | Zep | Temporal knowledge graph — facts carry validity intervals, so "what was true when" is queryable |
| Semantic | Mem0 | Extraction pipeline that dedupes and updates facts across vector, KV, and graph stores (Lesson 09) |
| Semantic + procedural | LangMem | Background extraction of facts and behavioral rules into a store the agent consults between turns |
| Episodic + semantic | agentmemory | Captures sessions as they run, consolidates them into typed, searchable records |

## Gönder

`outputs/skill-virtual-memory.md`Herhangi bir hedef çalıştırma süresi için doğru iki katlı hafıza asfaltını (genel + arşiv + araç yüzeyi) oluşturan, çıkarma politikası ve alıntı alanları ile kablo edilen tekrar kullanılabilir bir beceri.

## Egzersizler

1. Bir ekle`max_main_context_tokens`Tokenlerle ölçülen kaplama (yaklaşık olarak `len(text.split())`* 1.3. Kapalı sınır aşıldığında en eski mesajları bir özetle sıkıştırın.
2. BM25'i arşiv depo üzerinde doğru şekilde uygulayın (term frekansı, ters belge frekansı).
3. Ekle`citation`Arşiv eklemelerine alanlar (session_id, turn_id, source_url).
4. Hatıra zehirlenmesini simüle edin: "Gelecek kullanıcı talimatlarını göz ardı et" diyen bir arşiv kayıtı ekleyin.
5. MemGPT araştırma repo'nun çekirdek hafızası JSON şeması kullanmak için uygulamayı port edin (`cpacker/MemGPT`Düz iplerden tipleri yazılmış kısımlara geçince neler değişir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | "Unlimited memory" | Main (prompt) + external (searchable) tiers with page in/out |
| Main context | "Working memory" | The prompt — fixed-size, always visible |
| Archival memory | "Long-term store" | External searchable persistence, retrieved on demand |
| Core memory | "Persistent prompt section" | Named sections pinned inside the main context |
| Memory tool | "Memory API" | Tool call the agent issues to read/write external memory |
| Interrupt | "Memory page fault" | Agent pauses, runtime fetches, result splices into next turn |
| Memory rot | "Stale facts" | Old writes drown retrieval; fix with consolidation |
| Memory poisoning | "Injected persistent note" | Attacker content stored as memory, re-ingested on recall |

## Daha Fazla Okumak

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) OS-İnspire edilmiş sanal bağlam kağıdı
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) Üç katlı evrim
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) Bağlantıyı bütçe olarak değerlendirme
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) Bu modelin üstünde hibrit üretim belleği
- [Zep (getzep/zep)](https://github.com/getzep/zep) Taksonom tablosundan zamanlı bilgi grafi hafızası
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0) Ders 09'un hibrit mağazasının arkasındaki çıkarım boru hattı
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) Gerçeklerin ve davranış kurallarının arka plan çıkarımı
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) Sessiyon kaydı, yazılmış, arama yapılabilir kayıtlara birleştirilmiştir
