# Üretim Hizmet Yığını — KV Boşaltma ve Önbelleğe Duyarlı Yönlendirme

> Yığın hizmet veren bir üretim, yönlendiriciyi, motorları ve observability'yi tek bir Kubernetes deployment'ye bağlar ve KV önbelleğini GPU'dan ayrılabilecek bir kaynak olarak görür. KV boşaltma, KV önbelleğini GPU belleğinden çıkarır ve onu sorgular ve motorlar (CPU DRAM, ardından disk/Ceph) genelinde yeniden kullanır. vLLM'nin üretim yığını deployment referansıdır; LMCache boşaltma katmanıdır. vLLM 0.11.0 KV Boşaltma Bağlayıcısı (Ocak 2026), bunu Bağlayıcı API'si (v0.9.0+) aracılığıyla eşzamansız ve takılabilir hale getirir. Boşaltma yolu genellikle istek yolundan gizlenir, ancak önbellek eksiklikleri ve promosyonlar uçtan uca gecikmeye neden olabilir. LMCache, paylaşılan önekler olmasa bile değerlidir; GPU'nun KV yuvaları tükendiğinde, önceden doldurulan istekler yeniden hesaplamak yerine CPU'dan geri yüklenebilir. 4 a3-highgpu-4g genelinde 16x H100 (80 GB HBM) üzerinde benchmark'ler yayınlandı: KV önbelleği HBM'yi aştığında, hem yerel CPU aktarımı hem de LMCache verimi önemli ölçüde artırır; düşük KV ayak izinde, tüm yapılandırmalar küçük ek yük ile temel çizgiyle eşleşir.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak KV dökülme simülatörü)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Parçalarına Hizmet Verme), Aşama 17 · 06 (SGLang/RadixAttention)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- vLLM üretim yığını katmanlarının diyagramını çizin: yönlendirici, motorlar, KV aktarımı, observability.
- KV Boşaltma Bağlayıcısı API'sini (v0.9.0+) ve 0.11.0 eşzamansız yolunun boşaltma gecikmesini nasıl gizlediğini açıklayın.
- LMCache CPU-DRAM'in ne zaman yardımcı olduğunu (KV > HBM) ve ne zaman ek yük getirdiğini (KV HBM'ye sığacak kadar küçük) ölçün.
- deployment kısıtlamalarına göre yerel vLLM CPU yükü ve LMCache konektörü arasında seçim yapın.

## Sorun

vLLM sunumunuz, eş zamanlılık arttığında GPU'ları önleme etkinlikleriyle birlikte %100 HBM'de gösterir. İstekler tahliye edilir, yeniden sıraya alınır ve siz aynı 2K-token prompt'yi dakikada dört kez yeniden doldurursunuz. GPU hesaplaması gereksiz ön doldurmalara harcanır; iyi çıktı, ham çıktının oldukça altındadır.

Daha fazla GPU eklemenin maliyeti doğrusaldır. Daha fazla HBM eklemek mümkün değildir. Ancak CPU DRAM'i ucuzdur; bir sokette HBM'den daha kötü gecikme derecelerinde 512 GB+ bulunur ancak "geçici olarak sıcak" KV önbellek için iyidir.

LMCache, KV önbelleğini CPU DRAM'e ayıklayarak, öncelikli isteklerin hızlı bir şekilde kurtarılmasını sağlar ve motorlar arasında tekrarlanan önekler, her motorun yeniden doldurulmasına gerek kalmadan önbelleği paylaşır.

## Konsept

### vLLM üretim yığını

`github.com/vllm-project/production-stack`, Kubernetes deployment referansıdır:

- **Yönlendirici** — önbelleğe duyarlı (Aşama 17 · 11). KV olaylarını tüketir.
- **Motorlar** — vLLM çalışanları. GPU başına veya TP/PP grubu başına bir tane.
- **KV önbellek boşaltma** — LMCache deployment veya yerel bağlayıcı.
- **Observability** — Prometheus kazıması, Grafana gösterge tabloları, OTel izleri.
- **Kontrol düzlemi** — hizmet keşfi, yapılandırma, güncellemeler devam ediyor.

Dümen haritası + operatör olarak gönderilir.

### KV Boşaltma Bağlayıcı API'si (v0.9.0+)

vLLM 0.9.0, takılabilir KV önbellek arka uçları için bir Bağlayıcı API'sini kullanıma sundu. Motorunuz blokları konnektöre aktarır; bağlayıcı bunları saklar (RAM, disk, nesne depolama, LMCache). İsteğin bir bloğa ihtiyacı var, bağlayıcı onu geri yüklüyor.

vLLM 0.11.0 (Ocak 2026) eşzamansız bir yük boşaltma yolu ekler; boşaltma arka planda gerçekleşebilir, böylece genel durumda motor bu yolu engellemez. Uçtan uca gecikme ve aktarım hızı hâlâ iş yükünün şekline, KV önbellek isabet oranına ve sistem basıncına bağlıdır; vLLM'nin kendi notları, özel çekirdek boşaltmanın düşük isabet oranlarında verimi düşürebileceğini ve eşzamansız planlamanın spekülatif kod çözme ile bilinen etkileşim sorunlarına sahip olduğunu belirtiyor.

### Yerel CPU aktarımı ve LMCache karşılaştırması

**Yerel vLLM CPU aktarımı**: motor-yerel. KV bloklarını ana bilgisayarın RAM'inde saklar. Uygulaması hızlı, sıfır ağ atlamalı. Motorları geçmez.

**LMCache konektörü**: küme ölçeğinde. Blokları paylaşılan bir LMCache sunucusunda (CPU DRAM + Ceph/S3 katmanı) saklar. Bloklara herhangi bir motor erişebilir. 16x H100 benchmark yayınlandı.

Tek bir motor HBM basıncına sahip olduğunda yerel seçimi yapın. Birden fazla motor önekleri paylaştığında LMCache'i seçin (ortak sistem prompt'lerle RAG, paylaşılan şablonlarla çok kiracılı).

### Benchmark davranışı

16x H100 (80 GB HBM), 4 a3-highgpu-4g testine yayıldı:

- Düşük KV ayak izi (kısa prompt'ler, düşük eşzamanlılık): tüm yapılandırmalar taban çizgisiyle eşleşir, LMCache ~%3-5 ek yük ekler.
- Orta düzeyde kaplama alanı: LMCache, motorlarda öneklerin yeniden kullanılmasına yardımcı olmaya başlar.
- KV, HBM'yi aşıyor: yerel CPU aktarımı ve LMCache, verimi önemli ölçüde artırıyor; LMCache, motorlar arası paylaşım nedeniyle daha büyük kazanç sağlar.

### LMCache belirleyici olduğunda

- Sistem prompt'lerin kiracılar arasında paylaşıldığı çok kiracılı hizmet.
- Belge parçalarının sorgular arasında tekrarlandığı RAG.
- Temel model KV'nin yeniden kullanımının gereksiz işleri ortadan kaldırdığı aynı temel üzerinde ince ayarlı değişkenler (LoRA).
- Ön alım ağırlıklı iş yükleri: CPU'dan geri yükleme, yeniden doldurmadan daha ucuzdur.

### Ne zaman etkinleştirilmemeli

- Küçük HBM basıncı — herhangi bir fayda sağlamadan genel giderleri ödersiniz.
- Kısa bağlamlar (<1K tokens) — aktarım süresi > yeniden doldurma.
- Tek kiracılı tek prompt iş yükü — yakalamanın yeniden kullanılması gerekmez.

### Ayrıştırılmış sunumla entegrasyon

Aşama 17 · 17 ayrıştırılmış sunum + LMCache bileşikleri: Kullanılmadığı takdirde, ön doldurma havuzundan LMCache'deki havuz alanının kodunu çözmek için KV transferleri; sonraki sorgular LMCache'den alınır. Aşama 17 · 11 önbelleğe duyarlı yönlendirici, yerel OR LMCache paylaşımlı önbelleğiyle eşleşen motora yönlendirebilir.

### Hatırlamanız gereken sayılar

- vLLM 0.9.0: Bağlayıcı API'si gönderildi.
- vLLM 0.11.0 (Ocak 2026): eşzamansız yük boşaltma yolu; uçtan uca gecikme etkisi iş yüküne, KV isabet oranına ve sistem basıncına bağlıdır (mutlak bir garanti değildir).
- 16x H100 benchmark: LMCache, KV ayak izi HBM'yi aştığında yardımcı olur.
- Küçük HBM basıncı: %3-5 ek yük, fayda sağlamaz.

```figure
zero-sharding
```

## Kullan onu

`code/main.py`, LMCache ile ve LMCache olmadan, önleme ağırlıklı iş yükünü simüle eder. Raporların önceden doldurulması önlenir, üretim artışı sağlanır ve başa baş HBM kullanımı sağlanır.

## Gönderin

Bu ders `outputs/skill-vllm-stack-decider.md`'yi üretir. İş yükü şekli ve vLLM deployment göz önüne alındığında, yerel mi, LMCache mi, yoksa hiçbiri mi olduğuna karar verir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. LMCache hangi HBM kullanımında ödeme yapmaya başlar?
2. Bir kiracı, 200 sorgu/saatte 6K-token sistemi prompt'yi paylaşır. Kiracı başına beklenen LMCache tasarrufunu hesaplayın.
3. LMCache sunucusu tek bir hata noktasıdır. HA stratejisini tasarlayın (kopyalar, yerel stratejiye geri dönüş).
4. LMCache, dönen diskteki Ceph'e depolanır. 70B FP8'de (500 MB) 4K-token KV için, yeniden doldurmaya karşı okuma süresi nedir?
5. vLLM 0.11.0 eşzamansız yolunun "serbest" olup olmadığını tartışın; ek yük nerede saklanıyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Üretim yığını | "referans deployment" | vLLM'nin Kubernetes Helm grafiği + operatörü |
| Bağlayıcı API'si | "KV arka uç arayüzü" | vLLM 0.9.0+ takılabilir KV deposu arayüzü |
| Yerel CPU yükü | "motorun yerel sızıntısı" | KV'yi aynı motorun ana bilgisayar RAM'inde saklayın |
| LMCache | "küme KV önbelleği" | CPU DRAM + disk üzerinde çapraz motor KV önbellek sunucusu |
| 0.11.0 eşzamansız | "engellenmeyen boşaltma" | Motor akışının arkasında gizli yük boşaltma |
| Önalma | "yer açmak için tahliye" | HBM dolduğunda KV önbelleği karıştırılır |
| Ön ekin yeniden kullanımı | "aynı sistem prompt" | Birden çok sorgu başlangıcı paylaşır; önbellek isabeti |
| Ceph katmanı | "disk katmanı" | Önbellek hiyerarşisinde DRAM'in altında dayanıklı depolama |

## Daha Fazla Okuma

- [vLLM Blogu — KV Boşaltma Bağlayıcısı (Ocak 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Üretim Yığını GitHub](https://github.com/vllm-project/production-stack) — Dümen grafiği + operatör.
- [Kurumsal Ölçekte Yüksek Lisans için LMCache Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) — Bağlayıcı uygulaması.
- [vLLM 0.11.0 sürüm notları](https://github.com/vllm-project/vllm/releases) — eşzamansız yol ayrıntıları.
