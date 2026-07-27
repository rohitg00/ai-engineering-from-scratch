# AlphaEvolve — Evrimsel Kodlama Agents

> Bir sınır kodlama modelini evrimsel bir döngü ve makine tarafından kontrol edilebilir bir değerlendiriciyle eşleştirin. Döngünün yeterince uzun sürmesine izin verin. 48 skaler çarpım kullanan 4x4 karmaşık matris çarpım prosedürünü keşfetti; bu, Strassen'e göre 56 yıldır ilk gelişme. Ayrıca üretimdeki küme hesaplamasının ~%0,7'sini kurtaran Google çapında bir Borg planlama buluşsal yöntemi de buluyor. Mimari bilerek sıkıcıdır. Kazançlar değerlendiricinin titizliğinden gelir.

**Tür:** Öğren
**Diller:** Python (stdlib, evrimsel döngü oyuncağı)
**Önkoşullar:** Aşama 15 · 01 (uzun ufuk çerçeveleme), Aşama 15 · 02 (kendi kendine öğretilen akıl yürütme)
**Süre:** ~60 dakika

## Sorun

Büyük dil modelleri kod yazabilir. Evrimsel algoritmalar kod üzerinde arama yapabilir. Her ikisi de onlarca yıldır ayrı ayrı yargılanıyor; ikisi de tavana çarptı. Yüksek Lisans tavanı uydurmadır: Model iddia ettiği şeyi yapmayan makul kod yazıyor. Evrimsel tavan, arama maliyetidir: Söz dizimi üzerindeki rastgele mutasyonlar, bırakın daha iyi programları, nadiren derlenebilir programlar üretir.

AlphaEvolve (Novikov ve diğerleri, DeepMind, arXiv:2506.13131, Haziran 2025) bunları birleştirir. LLM, bir program veritabanında hedeflenen düzenlemeler önerir; otomatik bir değerlendirici her değişkeni puanlar; yüksek puan alan varyantlar gelecek nesillerin ebeveyni oluyor. Yüksek Lisans, makul kod yazmanın pahalı adımını üstlenir; değerlendirici konfabulasyonları yakalar. Döngü saatlerce, hatta haftalarca çalışır.

Bildirilen sonuçlar: 48 skaler çarpma 4x4 karmaşık matris çarpımı (Strassen'in 1969 sınırı 49'du), Google üretiminde bir Borg planlama buluşsal yöntemi, %32,5 FlashAttention çekirdek hızlandırması, Gemini eğitim verimi iyileştirmeleri.

Mimari, değerlendiricinin makine tarafından kontrol edilebilmesi nedeniyle çalışır. Değerlendiricinin olmadığı yerde işe yaramaz. Bu asimetri derstir.

## Konsept

### Döngü

1. Doğru ancak optimal olmayan bir tohum programından `P_0` başlayın.
2. Her biri değerlendirici tarafından puanlanan değişken programlardan oluşan bir veri tabanı oluşturun.
3. Veritabanından bir veya daha fazla ebeveyni örnekleyin (MAP elit tarzı veya ada tabanlı).
4. Prompt LLM (birçok aday için Gemini Flash, zor adaylar için Gemini Pro), ebeveynin değiştirilmiş bir versiyonunu üretmek için.
5. Uzatılmış değerlendiricide varyantı derleyin, çalıştırın ve değerlendirin.
6. Puanı ve özellik vektörüyle anahtarlanmış veritabanına ekleyin.
7. Tekrar edin.

İki ayrıntı önemlidir. Birincisi, Yüksek Lisans, ana programdan daha fazlasıyla prompted'dir - genellikle veritabanından birkaç üst düzey değişken, artı değerlendirici imzası ve kısa bir görev açıklaması. Modelin görevi puanı artırabilecek hedefli bir değişiklik önermektir. İkincisi, veritabanı yapılandırılmıştır (MAP elitleri ızgarası, ada tabanlı), böylece döngü yalnızca mevcut lideri değil çeşitliliği de araştırır.

### Değerlendiriciyi pazarlık konusu edilemez kılan şey nedir?

AlphaEvolve'un kazanımlarının tümü, değerlendiricinin hızlı, belirleyici ve oynaması zor olduğu alanlardan geliyor:

- **Matris çarpma algoritması**: matrisleri çarpan ve eşitliği bitlerle aynı şekilde kontrol eden bir birim testi.
- **Borg planlama buluşsal yöntemi**: Geçmiş küme yükünü yeniden oynatan ve boşa harcanan bilgi işlemi ölçen, üretim düzeyinde bir simülatör.
- **FlashAttention çekirdeği**: bir doğruluk testi artı gerçek donanım üzerinde bir duvar saati benchmark.
- **Gemini eğitim verimi**: adım başına ölçülen GPU saniyesi.

Her durumda değerlendirici, normalde baskın olacak LLM hata sınıfını yakalar: uydurma doğruluk iddiaları, donanımda ortadan kaybolan performans iddiaları ve uç durum arızaları. Değerlendiriciyi kaldırdığınızda döngü güzel kod için optimize edilir.

### Ödül korsanlığı bu ifadenin diğer yüzüdür

Evrim, değerlendiricinin ölçtüğü her şeyi optimize eder. Değerlendirici kusurluysa döngü kusuru bulacaktır. Doğrulanmamış bir alanda döngü, amaçlanan davranışı değil, yüzey özelliğini optimize eder. DeepMind bunu makalede açıkça işaret ediyor: AlphaEvolve'un başarıları yalnızca değerlendirici titizliğinin araştırmanın amacına uygun olduğu alanlara aktarılıyor.

Kod arama döngülerinde ödül hacklemenin somut 2025-2026 örnekleri:

- "Tamamlanma süresini" ödüllendiren optimizasyon hedefleri, boş çözümler göndererek ödüllendirilir.
- Test altındaki doğruluğu ödüllendiren Benchmark puanları, ezberleme testleri ve aşırı uyum ile ödüllendirildi.
- Anlamsal bir değişiklik olmaksızın, yorumların kaldırılması ve değişken adlarının yeniden yazılmasıyla ödüllendirilen bir "kod kalitesi" proxy'si.

AlphaEvolve'deki düzeltme: LLM'nin daha önce hiç görmediği, değerlendirme sırasında oluşturulan girdilerle uzun süreli bir değerlendirici gönderin. O zaman bile DeepMind, önerilen herhangi bir deployment üzerinde güçlü bir inceleme yapılmasını önerir.

### Neden Yüksek Lisans + arama her ikisinden de daha iyi

LLM derlenebilir, anlamsal olarak makul değişiklikler üretebilir. 2000 satırlık bir Python dosyasındaki rastgele mutasyonlu bir GA neredeyse her zaman sözdizimi hataları üretir. Yüksek Lisans aynı zamanda aramayı makul komşuluklar (rastgele baytları değil, tek bir işlevi değiştirin) üzerinde yoğunlaştırarak, boşa giden değerlendirici çağrılarını önemli ölçüde azaltır.

Değerlendirici de LLM'nin konuşmalarını yakalar. Yüksek Lisans'lar, bir fonksiyonun aslında O(n^2) olmasına rağmen "sınırda O(n log n) olduğunu" güvenle iddia edeceklerdir; benchmark duvar saati bu sorunun çözümlenmesini sağlıyor.

### AlphaEvolve'un sınır yığınında yer aldığı yer

| Sistem | Jeneratör | Değerlendirici | Etki Alanı | Örnek galibiyet |
|---|---|---|---|---|
| AlphaEvolve | İkizler | doğruluk + benchmark | algoritmalar, çekirdekler, zamanlayıcılar | 48-mul 4x4 matmul |
| Eğlenceli Arama (DeepMind, 2023) | PaLM / Codey | doğruluk | kombinatoryal matematik | sınır belirleme alt sınırları |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | Yüksek Lisans eleştirisi + deney | Makine öğrenimi araştırması | ICLR çalıştay kağıdı |
| Darwin Gödel Makinesi (L4) | agent iskele | SWE tezgahı / Polyglot | agent kodu | %20 → %50 SWE tezgahı |

Dördü de aynı tarifin varyasyonlarıdır: oluşturucu artı değerlendirici, döngü. Farklılıklar, değerlendiricinin notları ve bunun ne kadar titiz olduğudur.

## Kullan onu

`code/main.py`, oyuncak sembolik regresyon problemi üzerinde minimal AlphaEvolve benzeri bir döngü uygular. "LLM", bir hedef işlevi hesaplayan bir programa küçük sözdizimsel mutasyonlar öneren bir stdlib proxy'sidir. "Değerlendirici" ölçümleri, uzatılan test noktalarındaki hatanın karesi anlamına gelir.

İzle:

- En iyi puanın nesiller boyunca nasıl geliştiği.
- MAP elitleri ağı, döngünün yerel bir minimuma yaklaşmaması için çeşitli çözümleri nasıl canlı tutuyor?
- Uzatılmış testin (yalnızca eğitim amaçlı değerlendirici) kaldırılması, döngünün muhteşem bir şekilde aşırı uyum sağlamasına nasıl olanak sağlar.

## Gönderin

`outputs/skill-evaluator-rigor-audit.md`, yeni bir alanda AlphaEvolve tarzı bir döngüyü değerlendirmenin ön koşuludur: Değerlendiriciniz gerçekten önemsediğiniz başarısızlıkları yakalıyor mu?

## Egzersizler

1. `code/main.py`'yi çalıştırın. En iyi skor yörüngesine dikkat edin. Uzatılan değerlendiriciyi devre dışı bırakın (`--no-holdout`'yi işaretleyin) ve yeniden çalıştırın. Aşırı uyumu ölçün.

2. MAP-elites kılavuzundaki AlphaEvolve makalesinin 3. Bölümünü okuyun. Aramayı çeşitli tutacak yeni bir sorun için (e.g. derleyici optimizasyon geçişleri) bir özellik vektör tanımlayıcısı tasarlayın.

3. 48 çarpım 4x4 sonucu, 56 yıl sonra Strassen'in 49 çarpım sınırına göre iyileşti. Makalenin Ek F'sini okuyun ve bu sorunu değerlendiren kişinin neden doğruyu bulmasının özellikle kolay olduğunu ve neden çoğu alanın buna benzemediğini üç cümleyle açıklayın.

4. AlphaEvolve'un başarısız olacağı bir alan önerin. Değerlendiricinin tam olarak nerede kırıldığını ve nedenini belirleyin.

5. Bildiğiniz bir alan adı için kullanacağınız değerlendirici imzasını yazınız. (a) doğruluk koşullarını, (b) performans ölçüsünü, (c) uzatılmış girdi oluşturma kuralını, (d) en az bir ödül korsanlığı önleme kontrolünü dahil edin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| AlphaEvolve | "DeepMind'in evrimsel kodlaması agent" | Gemini + program veritabanı + makine tarafından kontrol edilebilir değerlendirici |
| MAP elitleri | "Çeşitliliği koruyan arşiv" | Özellik vektörlerine göre anahtarlanmış ızgara; her hücre bu tanımlayıcıya sahip en iyi değişkeni barındırır |
| Ada modeli | "Paralel evrim alt popülasyonları" | Periyodik olarak göç eden bağımsız popülasyonlar; erken yakınsamayı önler |
| Makine tarafından kontrol edilebilen değerlendirici | "Deterministik kehanet" | LLM'nin taklit edemeyeceği bir birim testi, simülatör veya benchmark — bu döngü için bir ön koşul |
| Ödül hackleme | "Hedefi değil, önlemi optimize etmek" | Döngü, amaçlanan görevi yapmadan puanı en üst düzeye çıkarmanın bir yolunu buluyor |
| Tohum programı | "Başlangıç ​​noktası" | Döngünün geliştiği, doğru ama optimal olmayan bir başlangıç ​​programı |
| Uzatılmış değerlendirici | "LLM'nin hiç görmediği değerlendirme verileri" | Ezberlemeyi önlemek için değerlendirme sırasında oluşturulan girdiler |

## Daha Fazla Okuma

- [Novikov ve diğerleri. (2025). AlphaEvolve: Bilimsel ve algoritmik keşif için agent kodlaması](https://arxiv.org/abs/2506.13131) — makalenin tamamı.
- [AlphaEvolve'da DeepMind blogu](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) — sonuçların yer aldığı satıcı yazısı.
- [AlphaEvolve sonuç deposu](https://github.com/google-deepmind/alphaevolve_results) — 48-mul 4x4 matmul dahil olmak üzere keşfedilen algoritmalar.
- [Romera-Paredes ve ark. (2023). Önceki sistem olan Yüksek Lisans (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) ile program aramasından elde edilen matematiksel keşifler.
- [Antropik — Sorumlu Ölçeklendirme Politikası v3.0 (Şubat 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — değerlendiriciye bağlı özerkliği temel bir araştırma yönü olarak çerçeveler.
