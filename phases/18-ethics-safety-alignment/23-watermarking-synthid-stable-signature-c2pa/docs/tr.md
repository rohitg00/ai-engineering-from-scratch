# Filigran Ekleme — SynthID, Kararlı İmza, C2PA

> Üç teknoloji, 2026'da yapay zeka tarafından oluşturulan içerik kaynağını yapılandırıyor. SynthID (Google DeepMind) — görüntü filigranı Ağustos 2023'te, metin+video Mayıs 2024'te (Gemini + Veo), Responsible GenAI Araç Seti aracılığıyla Ekim 2024'te açık kaynaklı metin, Gemini 3 Pro ile birlikte Kasım 2025'te birleşik multimedya dedektörü kullanıma sunuldu. Metin filigranı sonraki-token örnekleme olasılığını fark edilmeden ayarlar; görüntü/video filigranları sıkıştırma, kırpma, filtreler ve kare hızı değişikliklerinden etkilenmez. Kararlı İmza (Fernandez ve diğerleri, ICCV 2023, arXiv:2303.15435) — her çıkışın sabit bir mesaj içermesi için gizli yayılma kod çözücüsüne ince ayar yapar; kırpılmış (içeriğin %10'u) oluşturulan görüntüler FPR<1e-6'da >%90 olarak algılandı. "Kararlı İmza Kararsız" takibi (arXiv:2405.07145, Mayıs 2024) — fine-tuning kaliteyi korurken filigranı kaldırır. C2PA — kriptografik olarak imzalanmış, kurcalanmaya karşı korumalı meta veri standardı (C2PA 2.2 Açıklayıcı 2025). Filigranlama ve C2PA tamamlayıcıdır: meta veriler çıkarılabilir ancak daha zengin bir kaynak taşır; filigranlar kod dönüştürme yoluyla varlığını sürdürür ancak daha az bilgi taşır.

**Tür:** Yapım
**Diller:** Python (stdlib, token-filigran yerleştirme + algılama)
**Önkoşullar:** Aşama 10 · 04 (örnekleme), Aşama 01 · 09 (bilgi teorisi)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- token düzeyindeki filigranı (SynthID-metin stili) ve bunun tespit edilebildiği mekanizmayı açıklayın.
- Kararlı İmzayı ve onu bozan 2024 kaldırma saldırısını açıklayın.
- C2PA'nın rolünü ve neden filigranlamayı tamamlayıcı olduğunu belirtin.
- Temel sınırlamaları açıklayın: modele özgü sinyal, açıklama altında sağlamlık ve anlamı koruyan saldırılar (arXiv:2508.20228).

## Sorun

2023-2024, derin sahtekarlıkların ve yapay zeka tarafından oluşturulan içeriğin geniş ölçekte siyasi ve tüketici bağlamlarına girdiğine tanık oldu. Filigranlama, önerilen teknik kaynak sinyalidir: nesilleri oluşturma sırasında işaretleyin, daha sonra tespit edin. 2025 kanıtı: Hiçbir filigran koşulsuz olarak sağlam değildir, ancak C2PA meta verileriyle katmanlanan kombinasyon, kullanılabilir bir kaynak hikayesi sağlar.

## Konsept

### Metin filigranı (SynthID-metin stili)

Kirchenbauer ve ark. Google tarafından üretilen 2023 mekanizması:

1. Her kod çözme adımında, sözcük dağarcığının sözde rastgele bir bölümünü "yeşil" ve "kırmızı" kümeler halinde oluşturmak için önceki K token'ları hashleyin.
2. Yeşil logitlere δ ekleyerek yeşil kümeye doğru önyargılı örnekleme.
3. Nesil, şansın üretebileceğinden daha fazla yeşil token içeriyor.

Tespit: her öneki yeniden düzenleyin, nesildeki yeşil token'lari sayın, bir z puanı hesaplayın. Z-puanı filigranlı metin için >0, insan metni için ~0'dır.

Özellikler:
- Okuyucular tarafından algılanamaz (δ, kalite kaybının çok az olmasını sağlayacak kadar küçüktür).
- Kelime bölümü işlevine erişimle tespit edilebilir.
- Başka sözcüklerle ifade etmeye dayanıklı değil — metnin yeniden yazılması sinyali yok eder.

SynthID-text, Google'ın Sorumlu GenAI Araç Seti aracılığıyla Ekim 2024'te açık kaynaklıdır.

### Kararlı İmza (resim)

Fernandez ve ark. ICCV 2023. Gizli yayılma kod çözücüsüne ince ayar yapın, böylece oluşturulan her görüntü, gizli gösterime gömülü sabit bir ikili mesaj içerir. Tespitin kodu, sinirsel bir kod çözücüyle gizli durumdan çözülür. FPR<1e-6'da kırpılmış (içeriğin %10'una kadar) görüntüler >%90 olarak algılandı.

Mayıs 2024 "Sabit İmza Kararsız" (arXiv:2405.07145): fine-tuning kod çözücü, görüntü kalitesini korurken filigranı kaldırır. Çelişkili nesil sonrası fine-tuning ucuzdur; filigranın rakiplere karşı dayanıklılığı sınırlıdır.

### SynthID birleştirilmiş dedektör (Kasım 2025)

Gemini 3 Pro'nun yanı sıra: tek bir API'de metin, görüntü, ses ve videodan SynthID sinyallerini okuyan bir multimedya dedektörü. Google kaynak yığınını birleştirir.

### C2PA

İçerik Kaynağı ve Özgünlük Koalisyonu. Kriptografik olarak imzalanmış, kurcalanmaya karşı dayanıklı meta veri standardı. C2PA 2.2 Açıklayıcı (2025). Bir C2PA manifestosu, yaratıcının anahtarı tarafından imzalanan kaynak iddialarını (kim, ne zaman, hangi dönüşümleri yarattı) kaydeder.

Filigranlamayı tamamlayıcı:
- Meta veriler çıkarılabilir; filigranlar (kolayca) yapamaz.
- Meta veriler zengindir (tam kaynak zinciri); filigranlar bitler taşır.
- C2PA platformun benimsenmesine bağlıdır; filigranlar otomatik olarak yerleştirilir.

Google, hem Arama'ya, Reklamlara hem de "Bu resim hakkında"ya entegre olur.

### Sınırlamalar

- **Modele özgü.** SynthID özellikli modellerden SynthID filigran nesilleri. SynthID'siz bir modelden gelen nesil filigranlı değildir, dolayısıyla "SynthID sinyali yok" orijinalliğin kanıtı değildir.
- **Açıklama.** Metin filigranları, anlamı koruyan açıklamalardan etkilenmez.
- **Dönüşüm saldırıları.** arXiv:2508.20228 (2025), hem metin filigranlarını hem de birçok resim filigranını yok eden, anlamı koruyan saldırıları gösterir.
- **Kaldırma işleminde ince ayar yapın.** "Kararlı İmza Kararsızdır" uyarınca, nesil sonrası fine-tuning gömülü filigranları kaldırır.

### AB AI Yasası Madde 50

Yapay zeka tarafından oluşturulan içerik etiketleme için Şeffaflık Kodu (ilk taslak Aralık 2025, ikinci taslak Mart 2026, [Avrupa Komisyonu durum sayfası](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) uyarınca son Haziran 2026'da bekleniyor). Kurallar Nisan 2026 itibarıyla taslak halindedir ve zaman çizelgesi değişebilir. Teknik katmanı gerektiren düzenleyici katman. Deepfake'ler etiketlenmelidir.

### Bunun 18. Aşamada yeri nedir

22-23. dersler modelin ne yaydığıyla ilgilidir (özel veriler, kaynak sinyali). Ders 27 eğitim-veri yönetimini kapsar. Ders 24, bu teknik önlemleri gerektiren düzenleyici framework'dir.

## Use It — Hazır Araçla Uygula

`code/main.py` bir oyuncak metin filigranı oluşturur. Token'lar 0..N-1 tam sayılarıdır; karma tanımlı yeşil kümeye doğru filigranlı örnekleme önyargıları. Bir dedektör yeşil-token z-puanını hesaplar. 1000-token nesilde algılamayı gözlemleyebilir, yorumlamanın sinyali yok etmesini izleyebilir ve insan metnindeki yanlış pozitif oranını ölçebilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-provenance-audit.md` üretir. Kaynak iddiası olan bir deployment içeriği verildiğinde, şunları denetler: filigran mekanizması (varsa), C2PA imzalama zinciri (varsa), her birinin rakip sağlamlığı ve yöntem başına kapsam.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Filigranlı 1000-token nesil ile insan tarafından yazılan metinlerin z puanlarını raporlayın. %95 güven eşiğinde yanlış pozitiflik oranını belirleyin.

2. token'ların %30'unu eşanlamlılarla değiştiren bir açıklama saldırısı uygulayın. Z-puanını yeniden ölçün.

3. Kirchenbauer ve ark.'yı okuyun. 2023 Bölüm 6 sağlamlığa ilişkin. Metin filigranları neden başka kelimelerle ifade edildiğinde başarısız oluyor, ancak resim filigranları kırpılırken neden hayatta kalıyor?

4. SynthID metni + C2PA meta verilerini kullanan bir deployment tasarlayın. Tüketicinin gördüğü menşe zincirini açıklayın. Her bileşenin bir arıza modunu tanımlayın.

5. 2024 "Sabit İmza Kararsız" sonucu, fine-tuning'nin görüntü filigranını kaldırdığını gösterir. Bu saldırıyı sınırlayan bir deployment kontrolü tasarlayın; örneğin, ince ayarlı kontrol noktalarının imzalı sürümlerini zorunlu kılın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| SynthID | "Google'ın filigranı" | Çapraz modal kaynak sinyali; metin, resim, ses, video |
| Token filigranı | "Kirchenbauer tarzı" | Green-token z-score aracılığıyla tespit edilebilen önyargılı örneklemeli metin filigranı |
| Kararlı İmza | "görüntü filigranı" | İnce ayarlı kod çözücü filigranı; ICCV 2023 |
| C2PA | "meta veri standardı" | Şifrelenmiş olarak imzalanmış, kurcalanmaya açık kaynak meta verileri |
| Açıklama sağlamlığı | "yeniden ifade etmek onu bozar mı?" | Metin filigranı özelliği; şu anda sınırlı |
| İnce ayar kaldırma | "düşmanca filigransız" | fine-tuning kod çözücü aracılığıyla görüntü filigranını kaldıran saldırı |
| Çapraz modal dedektör | "birleşik SynthID" | Kasım 2025, çeşitli yöntemlerde birleştirilmiş API |

## Daha Fazla Okuma

- [Kirchenbauer ve ark. — Büyük Dil Modelleri için Bir Filigran (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — token-filigran mekanizması
- [Fernandez ve ark. — Kararlı İmza (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — resim filigran kağıdı
- ["Kararlı İmza Kararsız" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — kaldırma saldırısı
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — modlar arası filigran
- [C2PA 2.2 Açıklayıcı (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) — meta veri standardı
