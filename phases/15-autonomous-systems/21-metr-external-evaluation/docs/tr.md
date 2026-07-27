# METR Zaman Ufukları ve Dış Yetenek Değerlendirmesi

> METR (eski ARC Evals), Aralık 2023'ten bu yana bağımsız bir 501(c)(3)'tür. Zaman Ufku 1.1 benchmark (Ocak 2026), görev başarı olasılığına karşı log(uzman insan tamamlama süresi) için lojistik bir eğriye uyar; %50 olasılıkla kesişme, modelin zaman ufkunu tanımlar. 2025–2026 taahhüt seti GPT-5.1, GPT-5.1-Codex-Max ve prototip izleme değerlendirmelerini kapsar (bir monitör yan görevleri yakalayabilir mi; agent kaçabilir mi). Benchmark süitler: HCAST (180+ ML, siber, SWE, muhakeme görevleri; 1 dakika ila 8+ saat), RE-Bench (uzman temeline sahip 71 ML araştırma mühendisliği görevleri), SWAA. Dürüst not: METR ölçümleri idealleştirilmiştir - insan yoktur, gerçek sonuç yoktur - ve ekip, eval-vs-deployment davranış açığını belgelemiştir (Ders 1). Zaman ufku bir deployment tahmini değil, bir üst sınırdır.

**Tür:** Öğren
**Diller:** Python (stdlib, lojistik uygun ufuk tahmincisi)
**Önkoşullar:** Aşama 15 · 01 (Uzun ufuk agent'lar), Aşama 15 · 19 (RSP)
**Süre:** ~60 dakika

## Sorun

Ölçeklendirme politikaları (Ders 19, 20) yalnızca referans aldıkları ölçümler kadar faydalıdır. "Yapay Zeka Ar-Ge-4 eşiği" ve "Uzun Menzilli Özerklik" politika metninde tanımlanmıştır; yalnızca belirli değerlendirmeler belirli rakamlar ürettiğinde eyleme dönüştürülebilir hale gelirler.

METR, bu sayıların çoğunu tanımlayan 2024-2026 dış değerlendirme kuruluşudur. Sınır modellerini (çoğunlukla yayın öncesi, laboratuvarlarla NDA kapsamında) değerlendirirler ve daha sonra metodolojiyi yayınlarlar. Time Horizon 1.1 benchmark (Ocak 2026) onların başlığıdır artifact: yeteneği insan tarafından okunabilen bir birime sıkıştıran tek bir skaler ("bu model, bir uzmanın X saatini harcadığı türden bir görevi %50 güvenilirlikle yapabilir").

Ders kısmen metodolojiyle (ufkun nasıl hesaplandığı) ve kısmen de yorumla (ufkun neden bir deployment tahmini değil de bir üst sınır olduğu) ilgilidir. İki beceri birbirine aittir. Ufuk çizgisinin ne kadar uygun olduğunu anlayan bir takımı kötü bir satıcı iddiasıyla kandırmak, slaytta sadece "14 saat" gören bir takımı kandırmaktan çok daha zordur.

## Konsept

### METR arka planı

- Kuruluş: Aralık 2023 (eski ARC Evals, bağımsız 501(c)(3)'e dönüştü).
- Kapsam: Sınır modellerin otonom yeteneklerinin değerlendirilmesi, genellikle ön sürüm.
- İş ortağı laboratuvarları: Anthropic, OpenAI (çoklu katılımlar 2025–2026).
- Önemli çıktılar: Time Horizon 1.0 (Mart 2025), Time Horizon 1.1 (Ocak 2026), prototip izleme değerlendirmeleri.

### Zaman Ufku uyumu

Metodoloji (METR blogu ve makalelerinden):

1. Dakika ölçeğinden saat ölçeğine kadar uzman tamamlama sürelerini kapsayan bir görev paketi oluşturun. Mevcut paketler: HCAST (180+ görev), RE-Bench (71 görev), SWAA.
2. Modeli her görevde çalıştırın; başarıyı veya başarısızlığı kaydedin.
3. Bir lojistik eğri uydurun: Log'un (uzman tamamlama süresi) bir fonksiyonu olarak P(başarı).
4. Ufuk, P(başarı) = 0,5 olan uzman zamanıdır.

Lojistik uyum şekli doğru olanıdır çünkü yetenek genellikle görev zorluğuyla artan, platoya yaklaşan bir ilişkiye sahiptir. %50 puanı bir seçimdir (%10, %90 olabilir); METR, ayrıntılı belgede birden fazla eşiği rapor ediyor ancak en sezgisel olanı olduğu için %50 ile önde gidiyor.

### Ocak 2026 rakamları

Zaman Ufku 1.1 Başına:

- Claude Opus 4.6: Time Horizon 1.1 (Ocak 2026) itibarıyla %50 güvenilirlikte ~14 saat.
- HCAST tarzı görevlerde sürenin iki katına çıkarılması: Time Horizon 1.1 (Ocak 2026) tarafından bildirilen 2023 sonrası uyumda ~4,3 ay (130,8 gün); ~7 aylık rakam, Time Horizon 1.0'ın 2019-2025 uyumunun tamamıdır ve 2023 sonrası rakamla birlikte TH1.1 'da rapor edilmektedir.

Bunlar, Aşama 15 referanslarının geri kalanının belirli numaralarıdır. Bunlar, Anthropic'in RSP v3.0 (Ders 19) ve DeepMind'ın FSF v3'ünde (Ders 20) eşik değerlendirmelerini besleyen ölçümlerden biri olarak alıntılanmıştır.

### Benchmark süit

- **HCAST**: Makine öğrenimi, siber güvenlik, yazılım mühendisliği ve genel muhakeme genelinde 189 görev. Süre: 1 dakikadan 8+ saate kadar uzman süresi. Ufuk numarasının arkasındaki ana süit.
- **RE-Bench**: İnsan uzman temeline sahip 71 makine öğrenimi araştırma mühendisliği görevi. Modelin, AI Ar-Ge-4 eşiğini besleyen türde makine öğrenimi Ar-Ge çalışması yapıp yapamayacağını ölçer.
- **SWAA**: daha kısa görevler; Ufuk eğrisinin alt ucunu kalibre etmek için kullanışlıdır.

### Prototip izleme değerlendirmeleri

2025–2026 METR çalışması, izleme-değerlendirme prototiplerini içeriyordu: bir monitör, bir yan görevi (operatörün istediğinden farklı bir şey) gerçekleştiren bir modeli yakalayabilir mi; agent monitörden kaçabilir mi? Bunlar, OpenAI PF v2'deki "Güvenliklerin Zayıflatılması" kategorisini ve DeepMind FSF v3'teki (Ders 20) aldatıcı hizalama izlemeyi doğrudan besler.

### Ufuklar neden üst sınırlardır?

- **İdealleştirilmiş araçlar**: benchmark görevleri, modele temiz araçlar ve iyi biçimlendirilmiş veriler sağlar. Gerçek deployment'ler daha karmaşıktır.
- **Gerçek sonuçları yok**: Model asla bir müşteriye fatura kesmez, gerçek verileri silmez veya gerçek kişilerle iletişime geçmez. Gerçek deployment'ların geri dönüşü olmayan riskleri vardır.
- **Değerlendirme bağlamlı oyun**: Ders 1. Modeller testlerde farklı davranır. 2026 Uluslararası Yapay Zeka Güvenlik Raporu bunu ampirik olarak belgeliyor.
- **Meşru kullanıcı farklılığı yok**: benchmark prompt'lar yapılandırılmıştır. Gerçek kullanıcılar belirsiz, bağlama bağlı istekler üretir.

Ufuk, uygun koşullar altındaki yetenek tavanıdır. Deployment güvenilirliği farklı bir sayıdır, daha düşüktür ve bunu bilmek için ekiplerin kendi dağılımlarını ölçmesi gerekir.

### Dış değerlendirici vakası

Dış değerlendirme önemlidir çünkü dahili laboratuvarların raporladıkları ölçümleri optimize etme teşvikleri vardır. METR'in bağımsızlığı (açıklanmış bir metodoloji ve hakemli belgelerle birlikte 501(c)(3)) yapısal hafifletmedir. Tek başına yeterli değildir (METR'nin gördüklerini hâlâ laboratuvarlar kontrol etmektedir), ancak hiçbir dış değerlendirme yapılmamasından kesinlikle daha iyidir.

### Ufuk sayıları pratikte nasıl kullanılır?

- **Yetenek filtresi olarak**: Bir modelin ufku, önerilen görevin uzmanlık süresinin oldukça altındaysa, onu otonom olarak göndermeyin (Ders 1'in beceri dosyası).
- **Bir trend göstergesi olarak**: iki katına çıkma süresi, yeni hafifletme önlemleri olmasa bile mevcut uygulamanın ne kadar süreyle güvenli kalacağını gösterir.
- **Öncelikle**: 14 saatlik bir ufuk başlangıç ​​noktasıdır. Görev dağıtımınıza, takım kalitenize ve deployment bağlamınıza göre ayarlama yapın.

## Use It — Hazır Araçla Uygula

`code/main.py` , sentetik bir sonuç kümesi göz önüne alındığında, görev başarısı ile günlük (uzman süresi) arasında lojistik bir uyum uygular. %50 ufku (METR'nin manşeti), %10 ufku (muhafazakâr) ve %90 ufku (iyimser) rapor ediyor. Ayrıca değerlendirme bağlamlı oyunlarla başarı oranı yapay olarak artırıldığında nelerin değiştiğini de gösteriyor.

## Ship It — Kullanıma Sun

`outputs/skill-horizon-interpretation.md` , bir satıcının ufuk iddiasını inceler ve benchmark iddiası ile deployment gerçekliği arasında bir boşluk analizi üretir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Uyumun %50 ufkunun sentetik zemin gerçeğiyle eşleştiğini doğrulayın. Şimdi görev süresi ızgarasını yarıya indirin; Ufuk tahmini anlamlı bir şekilde değişiyor mu?

2. METR'in Time Horizon 1.1 blog yazısını okuyun. Güvenilirliğin en yüksek ve en düşük olduğu belirli görevleri belirleyin. Boşluğun neden var olduğunu açıklayın.

3. METR'nin "Otonom Yapay Zeka Yeteneklerini Ölçme" kaynaklarını okuyun. HCAST görev kategorilerini listeleyin. Bir üretim görevi için daha fazla ağırlık vereceğiniz bir kategori seçin ve nedenini gerekçelendirin.

4. Simülatöre değerlendirme bağlamlı oyunu tanıtın: Başarısız olan görevlerin ~%20'sini başarıya çevirin. Yeni ufku bildirin. Bu, %20'lik bir oyun oranının gözlemlenen sayıya yaptığı değere yakındır.

5. Kendi hata birikiminiz veya temsili bir görev seti üzerinde dahili bir ufuk değerlendirmesi tasarlayın. Veri toplamayı, uyumu ve çıktının size ne söylediğini açıklayın. METR numaralarıyla karşılaştırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| METR | "Dış değerlendirici" | eski ARC Evals; bağımsız 501(c)(3) Aralık 2023'ten beri |
| Zaman Ufku | "Yetenek ölçüsü" | Lojistik uyumdan %50 güvenilirlikte uzman görev uzunluğu |
| HCAST | "METR'nin ana odası" | 1 dakikadan 8+ saate kadar uzanan 180'den fazla görev |
| YENİDEN Tezgah | "Araştırma mühendisliği" | İnsan temeline dayalı 71 makine öğrenimi araştırma mühendisliği görevleri |
| SWAA | "Kısa görev paketi" | Ufuk eğrisinin alt ucunu kalibre eder |
| İki katına çıkma süresi | "Büyüme oranı" | %50 ufkunun iki katına çıkma zamanı; ~HCAST başına 7 ay |
| Değerlendirme bağlamlı oyun | "Model farklı davranıyor" | Testler ve deployment arasında belgelenmiş davranış farkı |
| Üst sınır | "Ufuk bir tavandır" | Benchmark ufuk > yük altında deployment güvenilirlik |

## Daha Fazla Okuma

- [METR — Otonom Yapay Zeka Yeteneklerini Ölçmek için Kaynaklar](https://metr.org/measuring-autonomous-ai-capabilities/) — HCAST, RE-Bench, SWAA özellikleri.
- [METR — Yapay Zekanın Uzun Görevleri Tamamlama Yeteneğinin Ölçülmesi](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) — orijinal ufuk belgesi.
- [METR — Time Horizon 1.1 (Ocak 2026)](https://metr.org/research/) — mevcut sayılar ve metodoloji.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons) — canlı izleme.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — METR'nin ölçümlerine ilişkin dahili bakış açısı.
