# Agent'lar için Konsensüs ve Bizans Hata Toleransı

> Klasik dağıtılmış sistemler BFT, stokastik LLM'lerle buluşuyor. 2025-2026'da üç araştırma yönü ortaya çıktı: **CP-WBFT** (arXiv:2511.10400) her oyu bir güven araştırması ile tartıyor; **DecentLLM'ler** (arXiv:2507.14928) paralel çalışan önerileri ve geometrik medyan toplamayla lidersiz hale geliyor; **WBFT** (arXiv:2505.05103), Çekirdek ve Uç düğümleri bölmek için ağırlıklı oylamayı Hiyerarşik Yapı Kümelemesi ile birleştirir. "Yapay Zeka AgentKabul Edebilir mi?" çalışmasının dürüst ampirik sonucu (arXiv:2603.01213) şu anlama gelir ki, günümüzde skaler anlaşma bile kırılgandır; tek bir aldatıcı agent, bir-Agent karışımını tehlikeye atabilir. BFT gerekli ama yeterli değil. Bu ders minimal bir BFT protokolü oluşturur, agent'a özgü üç saldırıyı (Bizans yalanı, dalkavuk uyumluluk, ilişkili hata monokültürü) enjekte eder ve her fikir birliği değişkeninin bununla nasıl başa çıktığını ölçer.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 07 (Zihin ve Tartışma Topluluğu), Aşama 16 · 13 (Paylaşılan Bellek)
**Süre:** ~75 dakika

## Sorun

Her biri bir cevap üreten N LLM agent var. Aynı fikirde değiller. Çoğunluk oyu yanlış olanı seçiyor çünkü iki agent birbiriyle ilişkili (aynı temel model, aynı eğitim verileri, aynı arıza modları). Üçüncü bir agent alışılmadık bir şekilde hatalıdır — yani çoğunluk sahte çoğunluktur.

Şimdi yanıltıcı bir agent ekleyin: bilerek yalan söylüyor. Veya dalkavuk agent: son konuşanla aynı fikirdedir. Klasik BFT'de varsayım, Bizans düğümlerinin `f < n/3` kesirli olduğu ve keyfi davrandığı yönündedir. 2026 gerçeği, LLM düğümlerinin dürüst, modeller arasında korelasyonlu ve birbirlerinin çıktılarından etkilendiğinde bile stokastik olduğudur. Onlara bağımsız Bernoulli seçmeni muamelesi yapamazsınız.

Klasik BFT (PBFT, 1999) yanlış değil, eksiktir. Rastgele bit çevirmeyi yönetir. "Üç dürüst agenteğitim verilerini paylaştıkları için halüsinasyon paylaşıyorlar." Bu ders, PBFT'nin temelinden ve katmanlarından yola çıkarak üç 2025-2026 uyarlamasına dayanmaktadır.

## Konsept

### Klasik BFT'nin size sunduğu şeyler

Pratik Bizans Hata Toleransı (Castro & Liskov, OSDI 1999), `f < n/3` Bizans düğümlerini tolere eder. Protokolün üç aşaması (ön hazırlık, hazırlık, taahhüt) ve iki temel öğesi (imzalı mesajlar, çekirdek sertifikaları) vardır. `n >= 3f + 1` dürüst veya kötü niyetli düğüm arasında tek bir değer üzerinde anlaşma.

Garantiler güçlü ancak şunu varsayalım:

1. **Bağımsız faylar.** Bizanslılar koordine değildir.
2. **Dürüst düğümler gerçekten dürüsttür.** Dürüst çıktıların doğruluğu sorun değildir; protokol yalnızca anlaşmazlığı hizalar.
3. **Sorunun gerçekçi bir cevabı var.** Yanlış bir gerçek üzerinde fikir birliği hâlâ fikir birliğidir.

Yüksek Lisans agent'lar üçünü de ihlal ediyor. Aynı temel modeli çalıştıran iki agent, hataları paylaşıyor. "Dürüst" bir Yüksek Lisans hala halüsinasyon görüyor. Ve belirsiz sorularda, agent'larin karar verdiği şey "gerçek"tir - harici bir kehanet yoktur.

### Yüksek Lisans'a özgü üç saldırı

**Bizans yalanı.** Bir agent kasıtlı olarak yanlış cevap verir. Klasik BFT, eğer `f < n/3` ise bunu halleder.

**dalkavuk uyumluluk.** Bir agent, oy vermeden önce diğerlerinin cevaplarını okur ve en son konuşan kişiyle aynı hizaya gelir. Kötü niyetli değildir ancak en yüksek sesle ilişkilidir. Klasik BFT bunu engellemez çünkü agent her imza kontrolünden geçer.

**İlişkili hata monokültürü.** Üç agent bir temel modeli paylaşıyor. Aynı yanlış cevabın halüsinasyonunu görüyorlar. Çoğunluk yanılıyor. Klasik BFT yardımcı olmuyor çünkü üçü de "dürüstçe" aynı fikirde.

### 2025-2026 yanıtları

**CP-WBFT** (arXiv:2511.10400) — Güven İncelemeli Ağırlıklı BFT. Her seçmen, cevabına bir güven araştırması ekler (kendisinin bildirdiği bir olasılık veya ayrı bir kalibrasyon modelinin tahmini). Oy ağırlıkları güvenle ölçeklenir. Tam grafiklerde +%85,71 BFT iyileşmesi rapor edildi. Azaltma: dalkavukluk uyumu (uyumlu agent'lar, gönüllü oldukları konum konusunda düşük güvene sahip olma eğilimindedirler).

**DecentLLM'ler** (arXiv:2507.14928) — Lidersiz. İşçinin agent paralel olarak önerisi, değerlendiricinin agent puan önerileri, son cevap puanlanan konumların geometrik medyanıdır. `f < n/2` olduğunda sağlam. Azaltma: Bizans yalanı ve ilişkili hatalar (geometrik medyan aykırı değerlere karşı dayanıklıdır ve model taraflı ortalamaya değil, yoğun kümeye doğru çeker).

**WBFT** (arXiv:2505.05103) — Hiyerarşik Yapı Kümelemesi ile Ağırlıklı BFT. Oy ağırlıkları, yanıt kalitesine ve geçmişten öğrenilen bir güven puanına göre belirlenir. agent'ları Çekirdek ve Kenar halinde kümeleyin; Önce çekirdek agent'lar fikir birliğine varmalı, Edge agent'lar bunu takip etmelidir. Azaltma: ölçeklenebilirlik (Çekirdek fikir birliği küçük ve hızlıdır) ve kısmen monokültür için (Çekirdek çeşitlilik için seçilebilir).

### Ampirik: "Yapay Zeka AgentKabul Edebilir mi?" (arXiv:2603.01213)

Makale, birden fazla sınır modeli boyunca skaler anlaşmayı (LLM agent'larin tek bir sayısal değer üzerinde anlaşması) ölçer. Bulgu rahatsız edici:

- Rakipleri olmasa bile, LLM agent'lar skaler sorular konusunda birçok benchmark'da %30'un üzerinde oranlarda anlaşamıyorlar.
- Aldatıcı bir kişiliği benimseyen tek bir agent, Agent-Karışımı'nın fikir birliğini dürüst temel çizgisinden yüzde 40'tan fazla puan çekebilir.
- Anlaşmazlık oranları model çeşitliliği ile ilişkilidir - heterojen topluluklar homojen olanlardan daha fazla fikir ayrılığına düşer (iyi: ilişkisiz hatalar) ama aynı zamanda daha yavaş sürüklenir (kötü: anlaşmaya varma süresi daha uzun).

Çıkarılan sonuç: BFT size çıktıları hizalamanız için makine verir, ancak hizalanmış çıktının doğru olup olmadığını size söylemez. Doğrulama (Aşama 16 · 08 rol uzmanlığı), çeşitlilik (Aşama 16 · 15 tartışma çeşitleri) ve değerlendirici agent'lar (Aşama 16 · 24 benchmark'lar) ile birleştirin.

### Temel protokol sadeleştirildi

Yüksek Lisans agent'lar için minimum BFT turu:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

Anlamsal kümeleme adımı LLM'ye özgü bir değişikliktir. "Çalışma %4,2 rapor ediyor" ve "%4,2 iyileşme" şeklinde iki yanıt aynı kümedir. Saf bir dize eşitliği kontrolü bunu kaçırır. Üretimde ucuz bir embedding modeli veya açık kanonikleştirme kullanın.

### Eşik ayarı

`threshold` parametresi ne zaman kabul edileceğine ve ne zaman yeniden deneneceğine karar verir. Çok düşük: Zayıf çoğunlukları kabul ediyorsunuz. Çok yüksek: Asla hiçbir şeyi kabul etmiyorsun. Ampirik aralık: `n=5-7` agents için 0,5-0,67, daha küçük `n` için daha yüksek. Bir eşiğin altında bir insana veya farklı bir agent topluluğuna ilerleyin.

### Fikir birliğinin yardımcı olmadığı durumlar

- **Belirsiz sorular.** Sorunun temel bir gerçeği yoksa fikir birliği bir görüştür. Öyle deyin.
- **Bileşik sorular.** "Kodu yazın ve açıklayın" — iki yanıt. Her birine bağımsız olarak oy verin.
- **Çekişmeli çok yönlü.** Eğer agent'lar önceki turları gözlemleyebilir ve taklit edebilirlerse (Du 2023 tartışması), gerçek ne olursa olsun birbirleriyle aynı fikirde olmaya başlarlar. Turları bağlayın (tipik olarak 2-3).

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `AgentVoter` — (cevap, güven) içeren kodlanmış bir politika.
- `MajorityVote` — klasik çoğulluk.
- `CPWBFT` — semantik kümelemeyle güven ağırlıklı oylama.
- `DecentLLMs` — puanlanan tekliflerde geometrik medyan toplama.
- `Scenario` — her toplayıcıyı üç saldırı modeli altında çalıştırır.

Uygulanan saldırı modelleri:

1. `byzantine`: bir agent yüksek güvenle yatıyor.
2. `sycophancy`: bir agent, gördüğü ilk cevabı eşleşen güvenle kopyalar.
3. `monoculture`: üç agent orta derecede güvenle yanlış cevabı (ilişkili hata) paylaşıyor.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: doğru cevabın vurgulandığı bir (saldırı, toplayıcı) -> son cevap tablosu. Çoğulluk, monokültür durumunu başarısızlığa uğratır. CPWBFT'nin güven ağırlığı dalkavukluğu azaltır. Monokültürün nüfusun yarısından az olduğu durumlarda makul LLM'lerin geometrik medyanı dürüst kümelenmeye doğru çekiliyor.

## Use It — Hazır Araçla Uygula

`outputs/skill-consensus-designer.md` , çoklu agent topluluğu için bir fikir birliği protokolü tasarlar: kümeleme yöntemi, ağırlıklandırma, eşik ve eşik altı turlar için yükseltme politikası.

## Ship It — Kullanıma Sun

Herhangi bir fikir birliği mekanizmasını göndermeden önce:

- **Yukarıdaki en az üç modelle saldırı testi**. Protokolünüz sessizce değil, öngörülebilir bir şekilde başarısız olmalıdır.
- **Her azınlık kümesini kökenle birlikte günlüğe kaydedin**. Azınlık kümeleri, ilişkili hatalara yönelik erken uyarı sisteminizdir.
- **Sınırlı turlar uygulayın.** "Anlaşmaya varıncaya kadar tartışmaya devam etmek" yok; bu, dalkavukluğu ödüllendirir.
- **Anlaşmayı doğruluktan ayırın.** Mutabakat çıktısı bir doğrulayıcıya gider; doğrulayıcı topluluktan bağımsızdır.
- **Anlaşma oranını izleyin.** Keskin bir artış, uygunluk yanlılığı anlamına gelir; keskin bir düşüş modelin kayması anlamına gelir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Çoğulluğun monokültür saldırısını başarısızlığa uğrattığını doğrulayın ancak CPWBFT, monokültür güveni 0,7'nin altında olduğunda bunu kısmen hafifletir.
2. Dördüncü bir saldırı modeli ekleyin: **sessiz çekimserlik** — bir agent yanıt vermeyi reddediyor ("Bilmiyorum"). Toplayıcıların her biri çekimserliğe nasıl davranmalıdır? Seçiminizi uygulayın.
3. Semantik kümelemeyi dize kanonikleştirmesinden embedding-benzerliğe değiştirin (herhangi bir açık kaynaklı embedding modelini kullanın). Dalkavukluk saldırısına ne olur?
4. CP-WBFT'yi (arXiv:2511.10400) okuyun. Güven araştırması kalibrasyon adımını uygulayın (ayrı bir kalibrasyon modeli, her agent'ın kendi bildirdiği güveni kontrol eder). Monokültür senaryosunda doğruluk kazancını ölçün.
5. "Yapay Zeka AgentKabul Edebilir mi?" konusunu okuyun. (arXiv:2603.01213). Basitleştirilmiş bir skaler anlaşma deneyini yeniden oluşturun: üç agent, bir skaler soru, aldatıcı-kişilik prompt. CPWBFT veya DecentLLM'ler bunu yakalıyor mu?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| BFT | "Bizans hata toleransı" | `f < n/3` keyfi hatalarla fikir birliği için Castro-Liskov 1999 protokolü. |
| Bizans | "Herhangi bir kötü davranış" | Yalan söyleyebilen, mesaj bırakabilen, sessizce başarısız olabilen, güvenli bir şekilde çökme dışında her şeyi yapabilen bir düğüm. |
| Güven araştırması | "Ne kadar eminsin?" | Bir oylamaya eklenen, kişinin kendisi tarafından bildirilen veya kalibratör tarafından tahmin edilen olasılık. |
| Anlamsal kümeleme | "Aynı cevap, farklı kelimeler" | Oyları saymadan önce eşdeğer yanıtları gruplamak. |
| Geometrik ortanca | "Sağlam merkez" | Örnek noktalara olan mesafelerin toplamını en aza indiren nokta. Ortalamanın aksine aykırı değerlere karşı dayanıklıdır. |
| Monokültür | "Aynı model, aynı arızalar" | agent'lar eğitim verilerini veya temel modeli paylaştığında ilişkili hatalar. |
| Dalkavuk uygunluk | "Yüksek sese katılıyorum" | Bir agent'ın oyu, ilk/en yüksek sesle konuşan kişiye karşı önyargılıdır. |
| Çekirdek/Kenar | "Hiyerarşik BFT" | WBFT bölünmesi: önce küçük Çekirdek konsensüsü, Kenar düğümleri takip eder. Gecikmeyi sınırlar. |

## Daha Fazla Okuma

- [Castro ve Liskov — Pratik Bizans Hata Toleransı (OSDI 1999)](https://pmg.csail.mit.edu/papers/osdi99.pdf) — temel
- [CP-WBFT — Güven Probu Ağırlıklı BFT](https://arxiv.org/abs/2511.10400) — güvene göre oy ağırlıklandırması
- [DecentLLM'ler — lidersiz çoklu-agent fikir birliği](https://arxiv.org/abs/2507.14928) — geometrik medyan toplama
- [WBFT — Hiyerarşik Yapı Kümelemesi ile Ağırlıklı BFT](https://arxiv.org/abs/2505.05103) — Sınırlı gecikme için Çekirdek/Kenar bölünmesi
- [Yapay Zeka AgentKabul Edebilir mi?](https://arxiv.org/abs/2603.01213) — sayısal anlaşma kırılganlığı ve aldatıcı kişilik saldırısı
