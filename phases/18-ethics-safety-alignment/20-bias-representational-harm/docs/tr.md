# Yüksek Lisans'ta Önyargı ve Temsili Zarar

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Computational Linguistics 2024, arXiv:2309.00770). Temsili zararları (klişeler, silme) tahsis zararlarından (eşitsiz kaynak dağıtımı) ayıran ve değerlendirme metriklerini embedding tabanlı, olasılık tabanlı veya oluşturulan metin tabanlı olarak kategorize eden temel 2024 araştırması. 2024-2025 ampirik: An ve ark. (PNAS Nexus, Mart 2025), 20 giriş seviyesi iş için otomatik özgeçmiş değerlendirmesinde GPT-3.5 Turbo, GPT-4o, Gemini 1.5 Flash, Claude 3.5 Sonnet, Llama 3-70B genelinde kesişimsel cinsiyet x ırk önyargısını ölçtü. WinoIdentity (COLM 2025, arXiv:2508.07111), kesişimsel kimlikler için belirsizliğe dayalı adalet değerlendirmesini sunar. Yu ve Ananiadou 2025, MLP katmanlarındaki cinsiyet nöronlarını tanımlamaktadır; Ahsan ve Wallace 2025, klinik ırksal önyargıyı ortaya çıkarmak için SAE'leri kullanıyor; Zhou ve diğerleri. 2024 (UniBias), önyargıyı ortadan kaldırmak için dikkat kafalarını yönlendirir. Meta-eleştiri (arXiv:2508.11067): 10 yıllık literatür orantısız bir şekilde ikili cinsiyet önyargısına odaklanıyor.

**Tür:** Yapım
**Diller:** Python (stdlib, toy embedding tabanlı önyargı araştırması)
**Önkoşullar:** Aşama 05 (kelime embeddings), Aşama 18 · 01 (talimat takip ediyor)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Temsil ve tahsis zararını tanımlayın ve her birine yüksek lisansta birer örnek verin deployment.
- Gallegos ve diğerlerinin sunduğu üç değerlendirme metriği kategorisini adlandırın. 2024 ve her birinden bir metrik açıklayın.
- Kesişimselliği ve WinoIdentity'nin belirsizliğe dayalı adalet ölçümünün neden tek eksenli önyargı değerlendirmesindeki boşlukları ele aldığını açıklayın.
- Önyargıya yönelik iki mekanik yorumlanabilirlik yaklaşımını tanımlayın (cinsiyet nöronları, SAE özellikleri, dikkat-kafa manipülasyonu).

## Sorun

Önceki dersler kasıtlı zarar verme (hapisten kaçış, entrika) ve güvenlik yönetimi konularını kapsıyordu. Önyargı, eğitim verisi dağıtımlarından, prompt çerçevelemeden, birikmiş tasarım tercihlerinden kasıtsız olarak ortaya çıkan zarardır. Bunu ölçmek ve azaltmak, rakip sağlamlıktan farklı bir metodolojik zorluktur.

## Konsept

### Temsili ve tahsisli

- **Temsili zarar.** Kalıp yargılar, silme, aşağılayıcı tasvirler. Hemşireleri yalnızca kadın olarak tasvir eden bir yüksek lisans, temsili zarara yol açıyor.
- **Tahsis zararı.** Eşit olmayan maddi sonuçlar. Siyah başvuru sahiplerinin özgeçmişlerini sistematik olarak daha düşük puanlayan bir Yüksek Lisans, tahsisat açısından zarar yaratıyor.

Bunlar aynı değil. Bir model "temsil açısından tarafsız" olabilir (çeşitli tasvirler üretir), "tahsis açısından önyargılı" olabilir (eşit olmayan önerilerde bulunur). Değerlendirmelerin her ikisini de ölçmesi gerekir.

### Üç değerlendirme metriği kategorisi (Gallegos ve diğerleri 2024)

- **Embedding-tabanlı.** RLHF öncesi embedding'lerde WEAT tarzı testler. Kimlik terimleri ve öznitelik terimleri arasındaki istatistiksel ilişkileri ölçer. Sınırlı: Davranışı değil temsili ölçer.
- **Olasılığa dayalı.** Basmakalıp yargıları doğrulayan ve stereotipleri ihlal eden tamamlamaların günlük olasılığı. Kod çözücü tarafı ölçümü. Bazı davranışsal önyargıları yakalar.
- **Oluşturulan metin tabanlı.** Oluşturulan metin üzerinde aşağı yönlü görev ölçümü. Özgeçmiş puanlama, öneri yazma, diyalog. Ekolojik olarak en geçerli; çoğaltılması en zor olanıdır.

### Kesişimsellik

"Cinsiyet" konusundaki önyargı değerlendirmesi, yalnızca (cinsiyet, ırk) çiftlere yol açan önyargıyı gözden kaçırıyor. An ve ark. 2025 bulgusu GPT-4o, özgeçmişte Siyah kadınları Siyah erkeklerden ve beyaz kadınlardan ayrı ayrı daha fazla puan alarak cezalandırıyor. Tek eksenli değerlendirme bunu yakalayamaz.

WinoIdentity (COLM 2025) belirsizliğe dayalı kesişimsel adaleti tanıtıyor. Yalnızca nokta tahmininde değil, modelin sonuçlara ilişkin belirsizliğinin kesişimsel kimlik grupları arasında farklılık gösterip göstermediğini ölçer. Bu, modelin gruplar arasında eşit derecede yanlış olduğu, ancak bazıları için daha belirsiz olduğu ve bu durumun farklı alt dağıtım davranışları ürettiği durumları yakalar.

### Mekanik yaklaşımlar

2024-2025 yorumlanabilirlik çalışması, mekanik müdahaleye karşı önyargıyı ortaya çıkarıyor:

- **Cinsiyet nöronları (Yu ve Ananiadou 2025).** Belirli MLP nöronları cinsiyete özgü davranışlarla ilişkilidir. Bu nöronların ortadan kaldırılması, sınırlı yetenek maliyetiyle cinsiyet farkı ölçümlerini azaltır.
- **SAE'ler yoluyla klinik ırksal önyargı (Ahsan ve Wallace 2025).** Seyrek otomatik kodlayıcı özellikleri, dahili temsili yorumlanabilir boyutlara ayırır; ırkla ilişkili özellikler belirlenebilir ve bastırılabilir.
- **UniBias (Zhou ve ark. 2024).** Sıfır atışta önyargı giderme için dikkat-kafa manipülasyonu. Belirli başlıklar kimlik sınıfı duyarlılığını artırır; bu kafaların sıfırlanması veya yeniden ağırlıklandırılması, fine-tuning olmadan önyargıyı azaltır.

### Meta eleştiri

10 yıllık literatür taraması (arXiv:2508.11067, 2025), alanın orantısız bir şekilde ikili cinsiyet önyargısına odaklandığını ortaya koyuyor. Diğer eksenler (engellilik, din, göç durumu, çok dilli kimlik) çok daha az ilgi görüyor. Meta-eleştiri, dar odaklanmanın marjinalleştirilmiş gruplara ihmal nedeniyle zarar verebileceğini savunuyor: ikili cinsiyet konusunda iyi bir şekilde önyargılı olan bir model, kimsenin kontrol etmediği boyutlar konusunda kötü bir şekilde önyargılı olabilir.

### Bunun 18. Aşamada yeri nedir

20-21. dersler resmi olarak önyargı ve adaleti ele alıyor. Ders 22 gizliliği kapsar. Ders 23 filigranlamayı kapsar. Bunlar, daha önceki aldatma/güvenlik katmanını tamamlayan kullanıcıya zarar katmanıdır.

## Use It — Hazır Araçla Uygula

`code/main.py` , oyuncak embedding tabanlı bir önyargı probu oluşturur: basit bir birlikte oluşumda kimlik terimleri ve nitelik terimleri arasındaki WEAT tarzı mesafeyi ölçer embedding. Bir önyargı enjekte edebilir ve metrik ateşi gözlemleyebilirsiniz; basit bir önyargı giderme işlemi uygulayın ve kısmi iyileşmeyi gözlemleyin.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-bias-eval.md` üretir. Bir model kartı veya adalet iddiası verildiğinde, değerlendirmeyi üç metrik kategori (embedding, olasılık, oluşturulan metin), kesişimsellik kapsamı ve herhangi bir önyargı azaltıcı müdahale mekanizması genelinde denetler.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Önyargı giderme adımından önce ve sonra WEAT tarzı önyargı puanlarını rapor edin. Metriğin neden sıfıra düşmediğini açıklayın.

2. Araştırmayı kesişimsel bir testle genişletin: (cinsiyet, ırk) x (kariyer, aile). Çapraz eksen sapması puanlarını bildirin.

3. An ve ark.'yı okuyun. 2025 (PNAS Nexus). Tek eksenli toplumsal cinsiyet değerlendirmesinin kaçıracağını bildirdikleri iki kesişimsel etkiyi tanımlayın.

4. Yu ve Ananiadou 2025 cinsiyet nöronlarını tanımlar. "Bu nöronlar cinsiyet yanlılığına neden oluyor" ifadesini "bu nöronlar cinsiyet yanlılığıyla ilişkilidir" ifadesinden ayıracak bir yanlışlama deneyi taslağı çizin.

5. Meta-eleştiri, alanın ikili cinsiyete çok dar bir şekilde odaklandığını ileri sürüyor. Az çalışılmış bir eksen seçin ve bunun için temsili zarar ölçüm protokolünü tanımlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Temsili zarar | "klişeler / silme" | Bir grubun taraflı tasviri |
| Tahsis zararı | "eşit olmayan kararlar" | Bir grup için taraflı maddi sonuç |
| WEAT | "embedding testi" | Kelime Embedding İlişkilendirme Testi; eş-oluşmaya dayalı önyargı araştırması |
| Kesişme | "birleşik kimlik efektleri" | Çoklu kimlik eksenlerinin kesişiminde ortaya çıkan önyargı |
| Cinsiyet nöronları | "MLP önyargı nöronları" | Aktivasyonları cinsiyete özgü davranışlarla ilişkili olan spesifik nöronlar |
| SAE özelliği | "yorumlanabilir boyut" | Seyrek otomatik kodlayıcı tarafından tanımlanan özellik; mekanik sapma analizi için kullanışlıdır |
| UniBias | "dikkatin önyargıdan arındırılması" | Dikkatleri yeniden ağırlıklandırarak sıfır atışla önyargı giderme |

## Daha Fazla Okuma

- [Gallegos ve ark. — Yüksek Lisans'ta Önyargı ve Adillik: Bir Anket (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) — kanonik anket
- [An ve ark. — Kesişen özgeçmiş değerlendirme yanlılığı (PNAS Nexus, Mart 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) — beş modelli kesişimsel çalışma
- [WinoIdentity — belirsizliğe dayalı kesişimsel adalet (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) — yeni benchmark
- [UniBias — dikkat-kafa manipülasyonu (Zhou ve ark. 2024, ACL)](https://arxiv.org/abs/2405.20612) — sıfır atışlı önyargı giderme
