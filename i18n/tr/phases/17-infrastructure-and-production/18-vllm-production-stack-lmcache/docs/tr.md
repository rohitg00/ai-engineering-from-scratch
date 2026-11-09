# Üretim Hizmetleme Stack  KV Çıkartma ve Kaş Bilgisi Routing

> Bir üretim servisinde bir Kubernetes dağıtımında yığın teller yönlendiricisi, motorlar ve gözlemliliği  ve GPU'yu bırakabilecek bir kaynak olarak KV önbelleği ile davranır. KV boşaltma, GPU belleğinden KV önbelleğini çıkarır ve sorgular ve motorlar (CPU DRAM, sonra disk/Ceph) arasında tekrar kullanır. vLLM'nin üretim-buğdayı referans dağıtımdır; LMCache, boşaltma katmanıdır. vLLM 0.11.0 KV Deşüt Bağlantısı (Ocak 2026) bu asinkron ve Bağlantı API (v0.9.0+) üzerinden bağlanabilir hale getirir. Çıkış yolu genellikle istek yolundan gizlenir, ancak önbelleğin eksikliği ve promosyonlar son-son gecikmeyi ekleyebilir. LMCache paylaşılan önleme olmadan bile değerlidir  bir GPU'nun KV boşluklarından yoksun kalması durumunda, önceden gönderilen istekler yeniden hesaplama yerine CPU'dan geri yüklenebilir. 4 a3-highgpu-4g'de 16x H100 (80GB HBM) üzerinde yayınlanan referans değerleri: KV önbelleği HBM'yi aşırırken, hem yerel CPU yükü hem de LMCache geçiş hızını önemli ölçüde artırır; düşük KV ayak izi durumunda, tüm yapılandırmalar küçük genel maliyetlerle temel çizgiyi eşleştiriyor.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- VLLM üretim katmanlarının çizimini çizin: yönlendiricisi, motorlar, KV yükü çıkartılması, gözlemlenebilirlik.
- KV Deşüt Bağlantısı API'sini (v0.9.0+) ve 0.11.0 asinkron yolunun nasıl deşüt gecikmesini sakladığını açıklayın.
- LMCache CPU-DRAM'ın (KV > HBM) vs. overhead (KV HBM'ye uygun olmak için yeterince küçük) yardımı ne zaman ölçülüyor.
- Yerel vLLM CPU yüklenmesi ve LMCache bağlantısı arasında seçim, dağıtım kısıtlamaları verildi.

## Sorun

VLLM servisiniz, GPU'ları %100 HBM'de gösterir ve eşzamanlılık yükseldiğinde önleme olayları gösterir. Talepler çıkarılır, sıraya alınır ve aynı 2K-token istekini dakikada dört kez yeniden doldurursunuz. GPU hesaplamaları redundant prefills için harcanır; goodput hamı throughput'un çok altında.

Daha fazla GPU eklemek lineer olarak maliyetlidir. Daha fazla HBM eklemek mümkün değildir. Ama CPU DRAM ucuz  bir soket HBM'den daha kötü bir büyüklükteki gecikme siparişinde 512 GB +'e sahiptir, ancak "vazgeçmeden sıcak" KV önbelleği için iyidir.

LMCache, KV önbelleğini CPU DRAM'a çıkarır, böylece önceleri istenen istekler hızlıca geri kazanılır ve her motor yeniden doldurulmadan motorlar arasında tekrarlanan önbellekler önbelleği paylaşır.

## Anlaşım

### vLLM üretim aşaması

`github.com/vllm-project/production-stack`referans Kubernetes dağıtımıdır:

- **Router** cache-aware (Fase 17 · 11). KV olaylarını tüketir.
- **Engines** VLLM çalışanları. GPU veya TP/PP grubuna bir kişi.
- **KV cache offload** LMCache dağıtım veya yerel bağlantı.
- **Observability**Prometheus kazı, Grafana ara çubuğu, OTel izleri.
- **Control plane** hizmet keşfi, yapılandırma, süren güncellemeler.

Helm chart + operatörü olarak gönderildi.

### KV Şarj Bağlantısı API (v0.9.0+)

vLLM 0.9.0, eklenebilir KV önbelleği arka planları için bir Connector API'yi tanıttı. Motorunuz blokları bağlantıya yükler; bağlantı onları depolar (RAM, disk, nesne depolama, LMCache).

vLLM 0.11.0 (Ocak 2026) asinkron bir boş yük yolu ekler  boş yük arka planda gerçekleşebilir, böylece motor normal durumlarda onu engellemez. Sonundan sonuna kadar gecikme ve geçiş hala iş yükünün şekli, KV önbelleği isabet oranı ve sistem basıncından bağlıdır; vLLM'in kendi notları, özel çekirdeğin boş yükünün düşük isabet oranlarında geçiş oranını düşürdüğünü ve async programlamanın spekülasyonsal dekodla etkileşim sorunları olduğunu belirtmektedir.

### Doğal CPU yükleme karşı LMCache

**Native vLLM CPU offload**: motor-yalı. KV bloklarını host RAM'de saklar. uygulamaya hızlı, sıfır ağ hop. Motorları geçmez.

**LMCache connector**: cluster ölçeği. Blükleri ortak bir LMCache sunucusunda (CPU DRAM + Ceph/S3 seviyesinde) depolar. Blükler herhangi bir motor için erişilebilir. 16x H100 referansları yayınlandı.

Tek bir motor HBM basıncı olduğunda yerel seçin. Çoklu motorlar öntanımları paylaştığında LMCache seçin (orta sistem istekleri olan RAG, paylaşılan şablonlarla çoklu kiracı).

### Benchmark davranışları

16x H100 (80 GB HBM) 4 a3-highgpu-4g testinde yayılmış:

- Düşük KV ayak izleri (kısık istekler, düşük eşzamanlılık): tüm yapılandırmalar temel çizgiyle eşleşir, LMCache ~ 3-5% genel maliyeti ekler.
- Orta derecede ayak izleri: LMCache, motorlar arasında ön işaretlerin yeniden kullanılmasına yardımcı olmaya başlar.
- KV HBM'yi aşar: yerel CPU yükü ve LMCache ikisi de geçiş hızı önemli ölçüde artırır; LMCache motor çapındaki paylaşım nedeniyle daha büyük kazanç elde eder.

### LMCache belirgin olduğunda

- Çoklu kiracı servisinde, sistem istekleri kiracılara paylaşılan bir servis.
- RAG, belgelerin parçalarının sorular arasında tekrarlandığı yer.
- Bas model KV'nin yeniden kullanılması gereksiz işlerin kesildiği aynı bazda ince ayarlanmış variantlar (LoRA).
- Önleme ağır iş yükleri: CPU'dan yeniden doldurmaktan daha ucuz bir şekilde geri yüklenir.

### Ne zaman etkinleştirmemek

- Küçük HBM basıncı  Üst maliyetini ödemeyi ücretsiz olarak yaparsın.
- Kısa bağlamlar (< 1K token)  transfer zaman > yeniden doldurma.
- Tek kiracı tek seferlik iş yükü  yakalamak için tekrar kullanılamaz.

### Ayrıntılı servis ile entegrasyon

17 · 17 aşama ayrıştırılmış servis + LMCache bileşikleri: KV, LMCache'deki önceden doldurma havuzundan kullanılmazsa havuz topraklarını çözmeye aktarır; sonraki sorular LMCache'den çekilir. 17 · 11 aşama önbelleği bilen yönlendirici, yerel veya LMCache- paylaşılmış önbelleği eşleşen motora yönlendirebilir.

### Hatırlamalısın numaralar

- vLLM 0.9.0: Bağlantı API gönderildi.
- vLLM 0.11.0 (Jan 2026): asinkron boş yük yolu; uçtan sonuna gecikme etkisi iş yüküne, KV çarpma hızına ve sistem basıncına bağlıdır (mutlak bir garanti değil).
- 16x H100 referans değer: KV ayak izi HBM' den fazla olduğunda LMCache yardımcı olur.
- Küçük HBM basıncı: 3-5% üst maliyet, fayda olmadan.

```figure
zero-sharding
```

## Kullan

`code/main.py`LMCache ile ve olmadan önleme ağır bir iş yükünü simüle eder.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-vllm-stack-decider.md`. İş yükünün şekli ve vLLM dağıtımını göz önüne alarak, native vs LMCache vs. hiçbirini belirler.

## Egzersizler

1. Çık .`code/main.py`LMCache hangi HBM kullanımı ile ödeme yapmaya başlar?
2. Bir kiracı, 6K-token sistemi ile 200 sorgu / saat boyunca paylaşır. Kiracı başına beklenen LMCache tasarrufu hesaplayın.
3. LMCache sunucusu tek bir başarısızlık noktasıdır. HA stratejisini (replikler, doğaya geri dönüş) tasarlayın.
4. LMCache, Ceph'e dönüm disken depolar. 70B FP8 (500 MB) 4K-token KV için okuma süresi vs. yeniden doldurma ne kadar?
5. VLLM 0.11.0 asinkron yolunun "beyaz" olup olmadığını tartışın  üst uç nerede saklanıyor?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Production-stack | "the reference deployment" | vLLM's Kubernetes Helm chart + operator |
| Connector API | "KV backend interface" | vLLM 0.9.0+ pluggable KV store interface |
| Native CPU offload | "engine-local spill" | Store KV in host RAM of same engine |
| LMCache | "cluster KV cache" | Cross-engine KV cache server on CPU DRAM + disk |
| 0.11.0 async | "non-blocking offload" | Offload hidden behind engine stream |
| Preemption | "evict to make room" | KV cache shuffle when HBM full |
| Prefix reuse | "same system prompt" | Multiple queries share beginning; cache hit |
| Ceph tier | "disk tier" | Durable storage below DRAM in the cache hierarchy |

## Daha Fazla Okumak

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) Helm grafik + operatör.
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) Bağlantı uygulaması.
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) Asinkron yol ayrıntıları.
