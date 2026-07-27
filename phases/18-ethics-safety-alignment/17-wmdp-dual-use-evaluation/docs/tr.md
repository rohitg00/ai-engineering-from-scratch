# WMDP ve Çift Kullanım Yeteneği Değerlendirmesi

> Li ve diğerleri, "WMDP Benchmark: Öğrenmemeyle Kötü Amaçlı Kullanımın Ölçülmesi ve Azaltılması" (ICML 2024, arXiv:2403.03218). Biyogüvenlik (1.520), siber güvenlik (2.225) ve kimya (412) alanlarında 4.157 çoktan seçmeli soru. Sorular, birden fazla uzmanın incelemesi ve ITAR/EAR yasal uyumluluğu tarafından filtrelenen, yaklaşık etkinleştirme bilgisi olan "sarı bölgede" işler. İkili amaç: ikili kullanım özelliğinin proxy değerlendirmesi ve benchmark öğrenmesinin iptal edilmesi (yardımcı RMU yöntemi, genel yeteneği korurken WMDP performansını azaltır). 2024-2025 saha anlatımı: İlk OpenAI/Antropik 2024 değerlendirmeleri internet aramasında "hafif bir artış" olduğunu bildirdi; Nisan 2025 itibarıyla OpenAI'nin Hazırlık Framework v2'sinde modellerin "acemilerin bilinen biyolojik tehditleri oluşturmasına anlamlı bir şekilde yardımcı olmanın eşiğinde" olduğu belirtildi. Anthropic'in biyolojik silah edinme denemesi, ASL-3'ü dışlamak için yeterli olmayan 2,53 kat artış gösterdi.

**Tür:** Öğren
**Diller:** Python (stdlib, WMDP şekilli yükseltme değerlendirme donanımı)
**Önkoşullar:** Aşama 18 · 16 (kırmızı takımla takımlama), Aşama 14 (agent mühendislik)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- WMDP'nin üç alanını, soru sayısını ve "sarı bölge" filtre kriterini açıklayın.
- RMU'yu ve WMDP'nin neden hem bir değerlendirme hem de öğrenmeyi bırakma benchmark olduğunu açıklayın.
- 2024-2025 artış öyküsünü açıklayın: "hafif bir artış" -> "çıkışta" -> "ASL-3'ü dışlamak için yeterli değil."
- Acemi-göreceli gelişmeyi, uzman-mutlak yetenekten ayırın.

## Sorun

Çift kullanım özelliği, her laboratuvarın sınır güvenliği framework kapsamındaki ölçüm problemidir (Ders 18). Soru şu: Model X, bir aceminin biyo, kimya veya siber alanda kitlesel zarara neden olma yeteneğini maddi olarak geliştiriyor mu? Doğrudan ölçüm (modelden gerçekten zarar vermesini istemek) yasa dışıdır ve etik değildir. Proxy ölçümü, modelin reddedemeyeceği (dürüst yetenek sayıları üretmek için) ancak soruları zararlı yayınlar olmayan bir benchmark'a ihtiyaç duyar.

## Konsept

### "Sarı bölge"

Doğrudan sentez tarifi olmadan, zararlı bir sürecin bilgisine olanak sağlayan, yakınlık gerektiren sorular. "[Yayınlanan yol]'un 4. adımınıagent yeniden katalize eden şey nedir?" "[tehlikeli bileşiği] nasıl yaparım?" değil Her soru birden fazla alan uzmanı tarafından incelenir; ITAR/EAR ihracat kontrolü uyumluluğu için filtrelendi.

Toplam 4.157 soru:
- Biyogüvenlik: 1.520
- Siber güvenlik: 2.225
- Kimya: 412

Çoktan seçmeli format. Modeller herhangi bir konuda yardımcı olmaları istenmeden cevap verir; Yetenek, zararlı davranışlara yol açmadan ölçülebilir.

### RMU — Öğrenmeyi Unutmak için Temsilin Yanlış Yönlendirilmesi

Yardımcı öğrenme yöntemi. LLaMa-2-7B'ye uygulanarak WMDP puanları neredeyse rastgele seviyeye düşürülürken MMLU ve diğer genel yetenek benchmark'lar birkaç yüzde puanı içinde korundu. Yayınlanan yöntem, sonraki her biyo-kimya-siber öğrenmeyi bırakma makalesi için öğrenmeyi bırakmanın temel çizgisidir.

### 2024-2025'in yükseliş öyküsü

Üç aşama:

1. **2024 "hafif bir iyileşme."** Erken OpenAI ve Antropik Hazırlık/RSP değerlendirmeleri, biyo-bitişik görevleri deneyen acemiler için internet aramasına göre küçük avantajlar bildirdi. Kamusal çerçeveleme: sınır modelleri yardımcı olur, ancak Google'dan çok daha fazla değil.

2. **Nisan 2025 "başlangıçta."** OpenAI'nin Hazırlık Framework v2 raporunda "acemilerin bilinen biyolojik tehditler oluşturmasına anlamlı bir şekilde yardımcı olmanın eşiğinde" modeller rapor edildi. Bir yetenek iddiası değil, zirvenin yaklaştığı uyarısı.

3. **Anthropic'in 2025 biyolojik silah edinme denemesi.** Acemi katılımcılarla yapılan kontrollü çalışma, edinme aşaması görevlerindeki göreceli başarıyı ölçtü. 2,53 kat artış bildirildi. ASL-3'ü hariç tutmak yeterli değil (Ders 18) — Anthropic'in Sorumlu Ölçeklendirme Politikası 3. kademe eşiğine ulaşıldı veya bu eşiklere yaklaşıldı.

### Acemi akraba vs mutlak uzman

Çok önemli bir ayrım:

- **Acemi göreceli olarak iyileşme.** Model, uzman olmayan birine ne kadar yardımcı oluyor? Çarpımsal. Göreceli avantaj yüksektir çünkü acemiler çok az şey bilir; mütevazı bilgiler bile yardımcı olur.
- **Uzman-mutlak yetenek.** Model maksimum çabayla ne kadar bilgi üretiyor? Bir uzman bir acemiden daha fazlasını çıkarabilir. Mutlak tavan yüksektir.

Güvenlik durumları (Ders 18) her ikisini de hedefler: "model, acemi bir kişiye uygulamaya yetecek kadar destek sağlayamaz" artı "bir uzman, modelden henüz yayınlanmamış bilgileri çıkaramaz."

### Ölçüm tuzağı

WMDP bir deployment ölçümü değil, bir yetenek proxy'sidir. WMDP'de yüksek puan alan bir model, aşağıdakilere bağlı olarak pratikte acemi biri tarafından kullanılabilir veya kullanılamayabilir:
- Ortaya çıkma direnci (güvenlik filtrelerini tetiklemeden bu yeteneği ortaya çıkarmak ne kadar zor)
- Örtülü bilgi (bilgi değil, ıslak laboratuvar becerisi gerektiren yetenek)
- Uygulama engelleri (tedarik, ekipman)

Anthropic'in 2025 biyolojik silah edinme denemesi, WMDP tarzı yeteneğin üzerine acemi-ortaya çıkarma katmanını ekliyor: çoktan seçmeli yeteneği değil, gerçek görev başarısını ölçer.

### Bunun 18. Aşamada yeri nedir

12-16. dersler, model çıktılarına ilişkin saldırı ve savunma araçlarıdır. Ders 17, ikili kullanım yeteneği katmanıdır — sınır güvenliği framework'lerin (Ders 18) değerlendirdiği ölçüm. Ders 30, mevcut 2026 siber/biyo/kimya/nükleer yükseliş kanıtlarıyla konuyu kapatıyor.

## Use It — Hazır Araçla Uygula

`code/main.py` , oyuncak WMDP şeklinde bir değerlendirme donanımı oluşturuyor. Sahte bir model, kategori gruplu sorular üzerinde test edilir; scores per domain are reported. Basit bir öğrenmeyi durdurma müdahalesi (alanına özgü temsilin sıfırlanması) puanları azaltır; genel kapasiteye karşı dengeyi ölçebilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-wmdp-eval.md` üretir. İkili kullanım yeteneği iddiası göz önüne alındığında ("modelimiz biyolojik silahlara anlamlı bir şekilde yardımcı olmuyor"), hangi benchmark'larin çalıştırıldığını, değerlendirme için hangi ret yolunun kullanıldığını (ham tamamlama vs politika kapılı) ve acemi ortaya çıkarma çalışmalarının çoktan seçmeli sonucu tamamlayıp tamamlamadığını denetler.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Oyuncak öğrenme adımından önce ve sonra alan başına doğruluğu raporlayın. Explain the general-capability trade-off.

2. Oyuncak WMDP'yi dördüncü bir alanla (e.g., radyolojik) artırın. Sarı bölgede iki açıklayıcı soru türünü belirtin. Bu tür soruları hazırlamanın neden MMLU şeklindeki soruları eklemekten daha zor olduğunu açıklayın.

3. Read WMDP 2024 Section 5 (RMU methodology). Daha basit bir öğrenmeyi bırakma yaklaşımının taslağını çizin (e.g., etki alanı içeriği için en üstteki nöronları bastırın) ve bunun beklenen genel yetenek maliyetini açıklayın.

4. Antropik 2025'in biyolojik silah edinme denemesi 2,53 kat artış bildirdi. Bu sayının yukarıya doğru (acemi örneklem büyüklüğü, göreve uygunluk) ve aşağıya doğru (ortaya çıkarma tavanı, model güvenlik kapısı) iki yolunu açıklayın.

5. ASL-3 için bir güvenlik durumunun, WMDP öğrenmesini iptal etmenin ötesinde neleri gerektirdiğini açıklayın. En az iki tamamlayıcı ortaya çıkarma çalışmasını adlandırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| WMDP | "the dual-use benchmark" | Sarı bölgede biyo/siber/kimya genelinde 4.157 ÇSS sorusu |
| Sarı bölge | "etkinleştirme ama sentezleme değil" | Bir sentez tarifi olmadan zararlı yeteneğe bitişik yakın bilgi |
| RMU | "öğrenmeyi unutmanın temel çizgisi" | Öğrenmeyi Unutma İçin Temsilin Yanlış Yönlendirilmesi; WMDP puanlarını azaltır, genel yeteneği korur |
| Acemilere göre yükselme | "uzman olmayanlara ne kadar yardımcı oluyor" | Bir acemi için mevcut internet aramasına göre kat kat avantaj |
| Uzman-mutlak yetenek | "uzmanlar için tavan" | Motivasyonlu bir uzman tarafından modelden elde edilebilecek maksimum bilgi |
| Edinme aşaması görevi | "sentezden önceki adımlar" | Tedarik, ekipman, izinler — zarar yolunun ilk kısımları |
| ITAR/KULAK | "ihracat kontrolü uyumluluğu" | Belirli etkinleştirme bilgilerinin yayınlanmasını kısıtlayan yasal framework'ler |

## Daha Fazla Okuma

- [Li ve ark. — WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) — benchmark ve RMU belgesi
- [OpenAI — Hazırlık Framework v2 (15 Nisan 2025)](https://openai.com/index/updating-our-preparedness-framework/) — "doğrulukta" dili
- [Antropik — Sorumlu Ölçeklendirme Politikası v3.0 (Şubat 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL-3 biyo eşiği ve edinme deneme sonuçları
- [DeepMind — Sınır Güvenliği Framework v3.0 (Eylül 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — biyolojik iyileştirme CCL
