# Paralel / Sürü / Ağ Bağlantılı Mimariler

> Denetleyiciyle zıtlık: merkezi bir karar verici yoktur. Agentpaylaşılan bir olay veriyolunu okur, işi eşzamansız olarak alır, sonuçları geri yazar. LangGraph, merkezi olmayan, dinamik ortamlar için "Sürü Mimarisini" açıkça destekler. Matris (arXiv:2511.21686), orkestratör darboğazını ortadan kaldırmak için dağıtılmış kuyruklardan geçen serileştirilmiş mesajlar olarak hem kontrolü hem de veri akışını temsil eder. Aradaki fark açıktır: ölçeklenebilirlik için determinizm ve izlenebilirlik. Swarm, görevleri birçok bağımsız alt problemle eşleştirir; tek ve tutarlı bir plan gerektiren görevlere uymaz.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib, `threading`, `queue`)
**Önkoşullar:** Aşama 16 · 05 (Süpervizör Kalıbı), Aşama 16 · 04 (İlkel Model)
**Süre:** ~75 dakika

## Sorun

Yönetici birkaç işçiye ölçeklenir. Peki ya yüzlerce? Denetleyicinin kendisi darboğaz haline gelir: Kimin ne yapacağına ilişkin her karar tek bir agent üzerinden akıp gider. Yavaş bir plan adımı tüm sistemi durdurur.

Sürü mimarileri tasarımı tersine çevirir. İşi dağıtan merkezi bir planlamacı yerine, işçiler işleri paylaşılan bir kuyruktan seçiyor. "Koordinasyon" olay veriyolu anlambilimine dahil edilmiştir. Orkestratör yok; sistem kuyruk ölçeklenene kadar ölçeklenir.

## Konsept

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

Orkestratör yok. Her çalışan şunu tekrar eder: bir görevi çekin, işleyin, sonucu yazın (ve isteğe bağlı olarak takipleri sıraya alın).

### Sürü uyduğunda

- **Birçok bağımsız görev.** Kazıma, dönüştürme, sınıflandırma. Görevler birbirine bağlı değildir.
- **Değişken süreli çalışma.** Bazı görevler 100 ms, bazıları ise 10 saniye sürüyorsa, bir sürü yükü otomatik olarak dengeler; hızlı çalışanlar sonraki işleri çeker. Bir denetçinin süreyi tahmin etmesi gerekir.
- **Determinizm yerine verim.** Kesin sıralamayı değil, toplam tamamlanma süresini önemsiyorsunuz.

### Sürü başarısız olduğunda

- **Sıralı iş akışları.** 3. adım, 2. adımın çıktısına ihtiyaç duyuyorsa, sürünün, 2. adım tamamlanmadan 3. adımın tetiklenmesi riski vardır.
- **Küresel plan görevleri.** Karmaşık araştırma soruları bir planlayıcıdan faydalanır. Bir sürü araştırmacı tutarlı bir rapor değil, bağımsız gerçekler üretiyor.
- **Hata ayıklama.** Merkezi günlük olmadığı ve eşzamansız çalışma olmadığı için hatanın yeniden üretilmesi pahalıdır.

### Matris (arXiv:2511.21686)

Matrix, sürüyü doğal sonucuna götüren 2025 makalesidir: hem kontrol akışı hem de veri akışı, dağıtılmış kuyruklardaki serileştirilmiş mesajlardır. Merkezi bir koordinatör yok. Hata toleransı mesajın dayanıklılığından gelir. Ölçeklenebilirlik sistemin değil, mesaj aracısının sorunudur.

Katkı: çoklu-agent koordinasyonunun "bu agent hangi mesaj konusuna abone oluyor?" olduğu bir programlama modeli. "Süpervizör bundan sonra hangi agent'ı seçecek?" yerine Bu, sistemin bir pub/sub etkinlik ağına benzemesini sağlar.

### frameworks grafiğindeki sürü

LangGraph 2025 belgeleri "Sürü Mimarisini" çoklu-agent modellerden biri olarak açıkça tanımlamaktadır: agent'lar düğümlerdir, ancak kenarlar döngülerle yönlendirilmiş bir grafik oluşturur ve herhangi bir düğüm havuzdan etkinleştirilebilir. Bir işçi, mevcut işten yönetici atamasına göre değil, duruma göre seçim yapar.

### Arıza modu: açlık ve sıcak lekelenme

Tüm çalışanlar mümkün olan en hızlı görevi üstlenirse, uzun süredir devam eden görevler, yalnızca onlar kalana kadar asla seçilmez. Klasik kuyruk açlığı.

Azaltmalar:
- Açık yaşlanmaya sahip öncelik kuyrukları (bekleme süresiyle önceliği artırın).
- İşçi uzmanlığı: Bazı işçiler yalnızca "uzun" görevler alırlar.
- Karşı basınç: kuyruğa giren hızlı görev sayısını sınırlayın.

### İçerik tabanlı yönlendirme bağlantısı

Swarm, içerik tabanlı yönlendirmeyle doğal olarak eşleşir (Ders 22). Genel bir sıra yerine her mesaj türü için bir sıra kullanın. Uzman işçiler yalnızca kendi türlerine abone olurlar. Bu, binlerce agent'a ölçeklenen mesaj veri yolu mimarilerinin temelidir.

## Build It — Kendin Geliştir

`code/main.py` , paylaşılan bir `queue.Queue`'den çekilen 4 çalışan iş parçacığından oluşan bir sürüyü uygular. Görevlerin değişken süreleri vardır (bazıları hızlı, bazıları yavaş). Demo tezat oluşturuyor:

- **Sıralı temel:** bir çalışan tüm görevleri seri olarak işler.
- **Sabit atama:** her görev belirli bir çalışana önceden atanmıştır (yönetici stili).
- **Sürü:** işçiler paylaşılan bir kuyruktan çekim yapar.

Sürü yükü otomatik olarak dengeler; Sabit atama, hızlı çalışanları, atanan görevleri yavaş olduğunda boşta bırakır.

Koşmak:

```
python3 code/main.py
```

Çıktı, çalışan başına görev sayısını (sürü eşit olmayan ancak en iyi şekilde dağıtılır) ve duvar saati sürelerini gösterir.

## Use It — Hazır Araçla Uygula

`outputs/skill-swarm-fit.md` , bir görevin yönetici mi yoksa sürü mü kullanması gerektiğini değerlendirir. Girdiler: görev bağımsızlığı, süre farkı, sıralama gereksinimleri, hata ayıklama ihtiyaçları.

## Ship It — Kullanıma Sun

Kontrol listesi:

- **Yaşlanmayla birlikte öncelik sırası.** Uzun süreli görev açlığını önleyin.
- **İşçinin bağımsızlığı.** Bir çalışanın çalışma ortasında çökmesi durumunda bir görev birden fazla kez çekilebilir. İşçiler idempotent olmalıdır.
- **Dayanıklı kuyruk.** Üretim için Kafka, Redis Streams veya veritabanı destekli bir kuyruk kullanın. `queue.Queue` yalnızca bellek içidir.
- **Observability görev başına.** Her görevin bir izleme kimliği vardır; Her çalışanın günlükleri onunla başlar/biter.
- **Karşı baskı.** Kuyruk, işçilerin boşaltmasından daha hızlı büyüyorsa, üreticiyi yavaşlatın.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Değişken süreli iş yükünde sürü, sıralıya göre ne kadar hızlıdır? Sabit atamadan ne kadar daha hızlı?
2. Bir öncelik sırası değişkeni ekleyin ( `queue.PriorityQueue` kullanın). Görevin "önem" alanına göre öncelik atayın. Düşük öncelikli görevlerin sürekli yük altında hiç bitip bitmediğini gözlemleyin.
3. Bir sıcak nokta dedektörü uygulayın: Herhangi bir çalışan, en yavaş çalışandan 3 kat daha fazla görev işlediğinde bunu kaydedin. Bu, görev-süre dağılımı hakkında ne gösteriyor?
4. Matrix makalesinin (arXiv:2511.21686) özetini ve Bölüm 3'ü okuyun. Matrix'in kabul ettiği (ölçeklenebilirlik kazancı) ve vazgeçtiği belirli bir ödünleşimi (izlenebilirlik, determinizm) belirleyin.
5. Sürü demosunu, çalışanların yalnızca belirli türlere abone olduğu bir `queue.Queue` (task_type, payload) tuple'ı kullanacak şekilde dönüştürün. Görevler heterojen olduğunda hangi yönlendirme kuralları anlamlıdır?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Sürü mimarisi | "Merkezi Olmayan agent'lar" | İşçiler paylaşılan kuyruktan çeker; merkezi orkestratör yok. |
| Etkinlik otobüsü | "Agentkonulara abone olun" | Görevleri türe veya içeriğe göre çalışanlara yönlendiren mesaj aracısı. |
| Açlık | "Görev hiçbir zaman çalıştırılmıyor" | Düşük öncelikli görev hiçbir zaman seçilmez çünkü yüksek öncelikli işler sürekli olarak gelir. |
| Sıcak nokta tespiti | "Bir işçi boğuldu" | Bir çalışanın çoğu görevi üstlendiği yük dengesizliği. |
| Geri basınç | "Üreticiyi yavaşlatın" | Kuyruk dolduğunda üretimin durdurulması için yukarı yönde sinyal veren mekanizma. |
| İdemsiz işçi | "Yeniden çalıştırmak güvenli" | İki kez işlenen bir görev aynı sonucu üretir. İşçiler çalışma sırasında kaza yapabileceği için gereklidir. |
| Dayanıklı kuyruk | "Çökmelerden sağ kurtuldu" | Disk veya çoğaltılmış depolama tarafından desteklenen kuyruk; Bir işçi kaza yaptığında görevler kaybolmaz. |
| Matris framework | "Tam mesaj ileten sürü" | Hem veri hem de kontrol akışı, dağıtılmış kuyruklardaki serileştirilmiş mesajlardır. |

## Daha Fazla Okuma

- [LangGraph iş akışları ve agent'lar — Sürü Mimarisi](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — açık sürü desteği
- [Matrix — Çoklu-Agent Sistemler için Merkezi Olmayan Bir Framework](https://arxiv.org/abs/2511.21686) — tam mesaj ileten sürü
- [Antropik mühendislik — neden süpervizör Araştırmada sürülmüyor](https://www.anthropic.com/engineering/multi-agent-research-system) — neden belirli bir üretim sistemi süpervizörü sürü yerine açıkça seçti
- [AutoGen v0.4 aktör-model belgeleri](https://microsoft.github.io/autogen/stable/) — olay odaklı aktörün yeniden yazılması, sürüye v0.2'nin Grup Sohbetinden daha yakın
