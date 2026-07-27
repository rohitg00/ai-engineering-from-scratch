# Yüksek Lisans Üretimi için Kaos Mühendisliği

> Yüksek Lisans'lar için kaos mühendisliği, 2026'da kendi disiplinidir. Üretimde denemeler çalıştırmadan önce önkoşullar: tanımlanmış SLI/SLO, trace+metric+log observability, otomatik geri alma, runbook'lar, çağrı sırasında. Mimarinin dört düzlemi vardır: kontrol (deney zamanlayıcı), hedef (hizmetler, altyapı, veri depoları), güvenlik (korumalar + iptal + trafik filtreleri), observability (metrikler + izlemeler + günlükler), geri bildirim (SLO ayarlamalarına). Korkuluklar zorunludur: Günlük hata bütçesi tüketimi beklenenin 2 katından fazlaysa, yakma hızı uyarıları deneyleri duraklatır; bastırma pencereleri + izleme kimliği korelasyonu uyarı gürültüsünü tekilleştirir. Ritim: haftalık küçük kanarya + SLO incelemesi; aylık oyun günü + ölüm sonrası; üç aylık ekipler arası dayanıklılık denetimi + bağımlılık haritalaması. Yüksek Lisans'a özgü deneyler: aşırı bellek, ağ arızaları, sağlayıcı kesintileri, hatalı biçimlendirilmiş prompt'lar, KV önbellek tahliye fırtınaları. Kalıplama: Harness Chaos Engineering (LLM'den türetilen öneriler, patlama yarıçapının küçültülmesi, MCP araç entegrasyonu); LitmusKaos (CNCF); Kaos Mesh (CNCF Kubernetes'te yerel).

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak kaos deneyi koşucusu)
**Önkoşullar:** Aşama 17 · 23 (AI için SRE), Aşama 17 · 13 (Observability)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Beş kaos mühendisliği önkoşulunu (SLI/SLO, observability, geri alma, runbook'lar, çağrı sırasında) adlandırın ve herhangi bir şeyin atlanmasının uygulamayı neden bozduğunu açıklayın.
- Dört düzlemin (kontrol, hedef, güvenlik, observability) ve geri besleme döngüsünün diyagramını SLO'ya çizin.
- LLM'ye özgü beş deneyi sıralayın (belleğin aşırı yüklenmesi, ağ arızası, sağlayıcı kesintisi, hatalı biçimlendirilmiş prompt, KV tahliye fırtınası).
- Verilen yığından bir araç seçin - Harness, LitmusChaos, Chaos Mesh -.

## Sorun

Geleneksel yığınlarda kaos testi oluşturulmuştur. LLM yığınları yeni hata modları ekler. Zehir karakterli bir 4K-token prompt, tokenizer'yı 12 saniye boyunca oyalar. Bir yukarı akış sağlayıcısı (429s); ağ geçidiniz yeniden deneme yapar; yeniden denemeyle güçlendirilmiş eşzamanlılıktaki hizmet OOM'larınız. Ani yük altındaki bir KV önbellek çıkarma fırtınası, bilgi işlemin doymasına neden olan yeniden doldurma basamaklarına neden olur.

Bunların hiçbiri birim testlerinde görünmüyor. Kaos mühendisliği, bunları kullanıcılar keşfetmeden önce sizin keşfetme şeklinizdir.

## Konsept

### Önkoşullar

Aşağıdakileri yapmadan üretimde kaosu çalıştırmayın:

1. **SLI/SLO** — tanımlanmış hizmet düzeyi göstergeleri ve hedefleri.
2. **Observability** — kontrol panellerine bağlı izler, ölçümler, günlükler.
3. **Otomatik geri alma** — Aşama 17 · 20 politika bayrağını geri alma.
4. **Runbook'lar** — yapılandırılmış, Aşama 17 · 23.
5. **Çağrı sırasında** — yanıt verecek biri.

Herhangi bir şeyi kaçırmak, kaosun gerçek bir olaya dönüşmesi anlamına gelir.

### Dört düzlem + geri bildirim

**Kontrol düzlemi** — deney planlayıcı (Litmus iş akışı, Chaos Mesh programı, Harness UI).

**Hedef düzlem** — hizmetler, bölmeler, düğümler, yük dengeleyiciler, veri depoları.

**Güvenlik düzlemi** — durdurma anahtarı, bastırma pencereleri, patlama yarıçapı sınırları, hata bütçesi kapıları.

**Observability düzlemi** — kaosun neden olduğu arızaları doğal arızalardan ayırmak için normal ölçümler + izleme kimliği korelasyonu.

**Geri bildirim döngüsü** — Bulgular SLO düzenlemesine, runbook güncellemelerine ve kod düzeltmelerine geri bildirim sağlar.

### Korkuluklar zorunludur

- **Yakma oranı uyarısı**: Günlük hata bütçesi yakımı beklenenin 2 katını aşarsa denemeyi duraklatın.
- **Bastırma pencereleri**: deneme sırasında patlama yarıçapındaki deney dışı uyarıları susturur.
- **İzleme Kimliği korelasyonu**: denemeden kaynaklanan tüm hatalar bir etiket taşır, böylece çağrı sırasında tekilleştirme yapılabilir.

### Yüksek Lisans'a özgü beş deney

1. **Bellek aşırı yüklemesi** — Yüksek eş zamanlılığa sahip uzun bağlamlı istekler göndererek KV önbellek önleme fırtınasını zorlayın. Gözlemleyin: Hizmet zarif bir şekilde dökülüyor veya çöküyor mu?

2. **Ağ hatası** — inference ağ geçidi ile sağlayıcı arasındaki bağlantıyı kesin. Gözlemleyin: SLA kapsamında geri dönüş devreye giriyor mu? (Aşama 17 · 19)

3. **Sağlayıcı kesinti simülasyonu** — OpenAI'den %100 429. Gözlemleyin: Anthropic'e yönlendirme yük devrediyor mu? (Aşama 17 · 16, 19)

4. **Kötü biçimlendirilmiş prompt** — tokenizer-stalling yükünü (e.g., derinlemesine yuvalanmış unicode, büyük UTF-8 kod noktası) enjekte edin. Gözlemleyin: Tek bir istek bir çalışanı kilitler mi?

5. **KV tahliye fırtınası** — vLLM blok bütçesini doyurarak zorla tahliye. Gözlemleyin: LMCache düzeliyor mu yoksa hizmet bozuluyor mu?

### Ritim

- **Haftalık** — evrelemede küçük kanarya deneyleri, belki %5 üretim.
- **Aylık** — belirli bir senaryoya göre planlanmış oyun günü; takımlar arası katılım; ölüm sonrası.
- **Üç ayda bir** — ekipler arası dayanıklılık denetimi; bağımlılık haritası güncellemesi.

### Takımlama

- **Harness Chaos Engineering** — ticari; Yapay zekadan türetilmiş deney önerileri; patlama yarıçapının küçültülmesi; MCP aracı entegrasyonu.
- **LitmusChaos** — CNCF mezun oldu; Kubernetes iş akışı tabanlı.
- **Chaos Mesh** — CNCF korumalı alan; Kubernetes'te yerel CRD stili.
- **Gremlin** — ticari; geniş destek.
- **AWS FIS** / **Azure Chaos Studio** — yönetilen bulut teklifleri.

### Küçük başlangıç

İlk deney: Sabit trafik altında bir kod çözme kopyasını kapsülle sonlandırın. Yeniden yönlendirmeyi ve kurtarmayı gözlemleyin. Bu işe yararsa ve güvenli görünüyorsa, ağ kaosuna geçiş yapın.

Yüksek Lisans'a özgü ilk deney: bir sağlayıcı 429'u 5 dakika boyunca enjekte edin. Geri dönüşü gözlemleyin. Çoğu ekip, geri dönüşlerinin tam olarak test edilmediğini keşfeder.

### Hatırlamanız gereken sayılar

- Dört uçak: kontrol, hedef, güvenlik, observability.
- Yakma hızı duraklaması: Beklenen günlük bütçe harcamasının 2 katı.
- Ritim: haftalık kanarya, aylık oyun günü, üç aylık denetim.
- Beş LLM deneyi: bellek, ağ, sağlayıcı, hatalı biçimlendirilmiş prompt, KV fırtınası.

## Use It — Hazır Araçla Uygula

`code/main.py` , emniyet düzlemi kapılarıyla üç kaos deneyini simüle eder. Hangi deneylerin yanma hızı iptalini tetikleyeceğini bildirir.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-chaos-plan.md` üretir. Yığın ve olgunluk göz önüne alındığında, ilk üç deneyi ve araçları seçer.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Hangi deney yanma hızı kapısını tetikliyor ve neden?
2. vLLM tabanlı bir RAG hizmeti için ilk beş kaos deneyini tasarlayın. Başarı kriterlerini ekleyin.
3. Yanma hızı uyarınız bir deneyi duraklattı. Temel nedeni nasıl belirlersiniz - kaos mu yoksa doğal mı?
4. Kaosun yapımda mı yoksa sadece sahnelemede mi olması gerektiğini tartışın. Üretim ne zaman doğru cevaptır?
5. Genel ağ kaosunun yeniden üretemeyeceği yüksek lisansa özgü üç hata modunu adlandırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| SLI / SLO | "hizmet hedefleri" | Gösterge + amaç; gerekli önkoşul |
| Patlama yarıçapı | "kapsam" | Denemeden etkilenen hizmet/kullanıcı kümesi |
| Yanma hızı uyarısı | "bütçe kapısı" | Hata bütçesi yazma oranı > beklenenin 2 katı olduğunda tetiklenir |
| Oyun günü | "aylık tatbikat" | Takımlar arası planlanmış kaos egzersizi |
| LitmusKaos | "CNCF iş akışı" | Dereceli CNCF Kubernetes kaos aracı |
| Kaos Ağı | "CNCF CRD" | CNCF korumalı alan Kubernetes'te yerel kaos |
| Emniyet Kemeri CE | "ticari yapay zeka destekli" | Yapay zeka önerileriyle kaosu kontrol altına alın |
| Hatalı Biçimlendirilmiş prompt | "tokenizer bomba" | tokenoluşturmayı durduran giriş |
| KV tahliye fırtınası | "önleme kademesi" | Yeniden doldurmaları tetikleyen toplu tahliye |

## Daha Fazla Okuma

- [DevSecOps Okulu — Kaos Mühendisliği 2026 Kılavuzu](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Yüksek Lisans (LLM) için Observability (kitap)](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Kaos Ağı (CNCF)](https://chaos-mesh.org/)
- [Kaos Mühendisliğini Kullanın](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
