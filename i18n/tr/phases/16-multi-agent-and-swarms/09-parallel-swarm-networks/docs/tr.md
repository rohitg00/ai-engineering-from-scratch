# Paralel / Swarm / Ağlı Arsitekler

> Gözetmen ile karşılaştırıldığında, merkezi karar verme yetkisi yoktur. Ajanlar ortak etkinlik otobüsünü okuyor, işleri asinkron olarak alıyor, sonuçları yazıyor. LangGraph, merkezi olmayan, dinamik ortamlar için açıkça "Swarm Architecture" i destekler. Matrix (arXiv:2511.21686) hem kontrol hem de veri akışını, orkestratör botluğunun ortadan kaldırılması için dağıtılmış kuyruklar üzerinden geçen serileşmiş mesajlar olarak temsil eder. Bu anlaşma açıkça belirlenmiştir: ölçeklendirme için belirleme ve izlenebilirlik. Swarm birçok bağımsız alt sorunlu görevlere uyum sağlar; tek tutarlı bir plana ihtiyaç duyan görevlere uyum sağlamır.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Sorun

Gözetmen birkaç işçiye kadar ölçeyor. Yüzlerce ne olacak? Gözetmenin kendisi şişlik boğaz haline geliyor: kim ne yapması hakkında her karar bir ajan aracılığıyla yürütülüyor.

Swarm mimarileri tasarımı tersine çevirir. Merkez planlayıcı çalışmayı göndermek yerine, işçiler ortak bir kuyruktan çalışmayı seçerler. "Koordinasyon" etkinlik otobüsü semantikasına eklenir. Orkestratör yok; kuyruk yapana kadar sistem ölçeklenir.

## Anlam

### Şekil

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

Her işçi tekrar eder: bir görevi çek, işlem yap, sonuç yaz (ve seçeneği olarak takip takipleri).

### Bir sürü uyum sağladığında

- **Many independent tasks.**Çekim, dönüşüm, sınıflandırma.
- **Variable-duration work.**Bazı görevler 100 ms alıyorsa diğerleri 10s alıyorsa, bir sürüm yükleri otomatik olarak dengeleyecektir  hızlı işçiler sonraki görevleri çekmek.
- **Throughput over determinism.**Tamamen tamamlanma süresiyle ilgileniyorsun, sıkı siparişlerle değil.

### # Bir sürü düştüğünde #

- **Ordered workflows.**Eğer 3 adım 2'nin çıkışına ihtiyaç duyarsa, bir soğan 2 adım tamamlanmadan önce 3 adım ateşleme riski taşır.
- **Global-plan tasks.**Karmaşık araştırma soruları planlamacıdan yararlanır.
- **Debugging.**Merkez kayıtları ve asinkron çalışmalar olmadığından, bir böceği yeniden üretmek pahalıdır.

### Matrix (arXiv:2511.21686)

Matrix, 2025'te yayımlanan bir makaledir ve bu sayede hem kontrol akışı hem de veri akışı, dağıtılmış kuyruklarda serilize edilmiş mesajlardır. Merkez koordinatörü yoktur. Hata toleransı mesaj dayanıklılığından kaynaklanır. Skalabillik mesaj aracı'nın sorunu, sistemin değil.

Katkı: çoklu ajan koordinasyonunun "bu ajan hangi mesaj konuyu abone ediyor?" yerine "önetici hangi ajanı seçer?" şeklinde bir programlama modeli. Bu, sistemin bir pub/altı etkinlik ağına benziyor.

### Grafik çerçevelerinde bir sürü

LangGraph 2025 belgelerinde "Swarm Architecture" açıkça çoklu ajan modellerinden biri olarak tanımlanır: ajanlar düğümlerdir, ancak kenarlar döngülerle yönlendirilmiş bir grafik oluşturur ve herhangi bir düğüm havuzdan etkinleştirilebilir.

### Başarısızlık modusu: açlık ve sıcak noktalama

Eğer tüm işçiler en hızlı görevi yaparlarsa, uzun süreli görevler tek kalana kadar asla seçilmez.

Yumuşak başlılık:
- Açıkça yaşlanarak öncelikli kuyruklar (bekleme süresi ile önceliği artırın).
- İşçi uzmanlığı: Bazı işçiler sadece "uzun" görevler alır.
- Geri basınç: sıraya kaç hızlı görev girdiyse sınırlayın.

### İçeriğe dayalı yönlendirme bağlantısı

İçerik tabanlı yönlendirme ile doğal olarak bir dizi çift oluşturun (Dene 22. Genel bir kuyruk yerine, mesaj tipi başına bir kuyruk vardır. Uzman işçiler yalnızca tiplerine abone olurlar. Bu, binlerce ajanın ölçekine kadar uzanan mesaj otobüs mimarlarının temelini oluşturur.

```figure
sw-work-stealing
```

## Yapın

`code/main.py`paylaşılan bir ipten çekilen 4 işçi iplik bir sürüsü uyguluyor `queue.Queue`Görevlerin değişken süresi vardır (bazı hızlı, bazıları yavaş).

- **Sequential baseline:**Bir işçi tüm görevleri seri olarak işliyor.
- **Fixed assignment:**belirli bir işçiye önceden atanan her görev (nözetçi tarzında).
- **Swarm:**İşçiler ortak bir kuyruktan çekiliyorlar.

Swarm balances otomatik olarak yüklenir; sabit görevler verilen görev yavaş olduğunda hızlı çalışanları hareketsiz bırakır.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktılık, çalışan başına görev sayısını (sürük eşitsiz ama optimal bir şekilde dağıtılır) ve duvar saatini gösterir.

## Kullan

`outputs/skill-swarm-fit.md`Bir görevden swarm vs. supervisor kullanılması gerektiğini değerlendirir. Girişler: görev bağımsızlığı, süresi varyansi, sipariş gereksinimleri, hata çözülebilirliği gereksinimleri.

## Gönder

Kontrol listesini:

- **Priority queue with aging.**Uzun görevli açlıktan kaçınmak.
- **Worker idempotency.**Bir işçi çalışmanın ortasında kaza yaparsa bir görev birden fazla kez atılabilir.
- **Durable queue.**Yapım için Kafka, Redis Akışları veya veritabanı destekleyen bir kuyruk kullanın. `queue.Queue`Sadece hafıza.
- **Observability per task.**Her görevde bir iz kimliği vardır; her işçi bu işten başlayıp biter.
- **Back-pressure.**Eğer sıra işçilerin boşaltmasından daha hızlı büyürse, üreticinin yavaşlamasını sağlayın.

## Egzersizler

1. Çık .`code/main.py`Değişken süresi iş yükü üzerinde süren sürenden ne kadar hızlı?
2. Öncelik kuyruk variansı ekle (kullanım `queue.PriorityQueue`) Görev "Önem" alanına öncelik belirleyin.
3. Bir işçi en yavaş işçiye göre 3 kat daha fazla görev işlediğinde sıcak nokta algılayıcısını uygulayın.
4. Matrix makalesini okuyun (arXiv:2511.21686) soyut ve Bölüm 3. Matrix'in kabul ettiği (skalabilme kazancı) ve bıraktığı (içime geçiş, belirleme) belirli bir ödemeyi tanımlayın.
5. Swarm demo'sunu bir `queue.Queue`Görevler heterogen olduğunda hangi yönlendirme kuralları mantıklıdır?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | Workers pull from shared queue; no central orchestrator. |
| Event bus | "Agents subscribe to topics" | Message broker that routes tasks to workers by type or content. |
| Starvation | "Task never runs" | Low-priority task never gets picked because higher-priority work arrives continuously. |
| Hot-spotting | "One worker drowns" | Load imbalance where one worker gets most tasks. |
| Back-pressure | "Slow down the producer" | Mechanism that signals upstream to stop producing when the queue fills up. |
| Idempotent worker | "Safe to re-run" | A task processed twice produces the same result. Required because workers may crash mid-run. |
| Durable queue | "Survives crashes" | Queue backed by disk or replicated storage; tasks are not lost when a worker crashes. |
| Matrix framework | "Full message-passing swarm" | Both data and control flow are serialized messages on distributed queues. |

## Daha Fazla Okumak

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) açık bir sürüm desteği
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) Tam mesaj geçiren bir sürüm
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) belirli bir üretim sistemi neden açıkça sürüden önce denetçiyi seçti
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) olay yönlendirici aktör yeniden yazmak, v0.2'nin GroupChat'ten daha yakındır
