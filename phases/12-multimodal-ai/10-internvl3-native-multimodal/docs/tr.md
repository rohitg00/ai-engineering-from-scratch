# InternVL3: Yerel Multimodal Ön Eğitim

> InternVL3'ten önceki her açık VLM, aynı üç adımlı tarifi izledi: Trilyonlarca metin token ile eğitilmiş bir metin LLM'si alın, bir görüntü kodlayıcıyı takın ve ardından dikişlere fine-tuning yapın. Bu işe yarıyor ancak hizalama borcu var — metin Yüksek Lisans eğitimi ön eğitim bütçesinin tamamını saf metin üzerinde harcadı ve görsel token'leri yerel olarak anlamıyor. Post-hoc vizyonu eklediğinizde, LLM'nin metni unutmadan görsel girdiyi metin muhakemesi ile nasıl ilişkilendireceğini yeniden öğrenmesi gerekir. InternVL3 (Zhu ve diğerleri, Nisan 2025) post-hoc yaklaşımı reddeder: bir ön eğitim çalışması, birinci adımdan itibaren metin ve çok modlu serpiştirilmiş. Sonuç, 78B parametreleri açıkken MMMU-Pro'daki Gemini 2.5 Pro ile eşleşiyor. Bu derste yerel ön eğitimin durumu ve bunu yaptığınızda nelerin değiştiği anlatılmaktadır.

**Tür:** Öğren
**Diller:** Python (stdlib, eğitim derlem karıştırıcısı)
**Önkoşullar:** Aşama 12 · 05, Aşama 12 · 07 (tarifler)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Ölçülebilir üç semptomu (felaket derecede unutma, cevap kayması, görsel metin tutarsızlığı) öne sürerek post-hoc VLM eğitiminin neden uyum borcu biriktirdiğini açıklayın.
- InternVL3'ün yerel ön eğitim derlem karışımını ve metin: aralıklı: altyazı oranının neden önemli olduğunu açıklayın.
- V2PE'yi (değişken görsel konum kodlaması) Qwen2-VL'nin M-RoPE'si ile karşılaştırın.
- Görsel Çözünürlük Yönlendiricisi (ViR) ve Ayrıştırılmış Görüş Dili (DvD) deployment optimizasyonlarını adlandırın.

## Sorun

Post-hoc VLM eğitimi varsayılandır. LLaVA, BLIP-2, Qwen-VL, Idefics — hepsi önceden eğitilmiş bir LLM (Llama, Vicuna, Qwen, Mistral) alır ve vizyon ekler. Eğitim aşamaları genellikle şöyle görünür:

1. Frozen LLM + dondurulmuş görüş kodlayıcı + eğitilebilir projektör, embedding'ları hizalamak için altyazı çiftleri üzerinde eğitilmiştir.
2. LLM'yi çözün, talimat verileri üzerinde eğitim alın (LLaVA-Instruct, ShareGPT4V).
3. İsteğe bağlı göreve özel fine-tuning.

Uyum borcunun üç belirtisi ortaya çıkıyor:

- Felaket derecede unutma. Post-hoc VLM salt metin becerilerini unutur. GSM8K puanları 5-10 puan düşüyor. Hellaswag puanları düşüyor. Saf metin agent'nin gerilemesi.
- Drift'e cevap ver. Aynı görsel sorunun küçük ifadeleri farklı yanıtlar alır. Görüntü kodlayıcı, LLM'ye LLM'nin kendi token'lerinden daha zayıf bağlantılarla bağlanır.
- Görsel metin tutarsızlığı. VLM, bir görüntüyü doğru şekilde tanımlayabilir ve ardından kendi açıklamasıyla çelişen bir soruyu yanıtlayabilir. Görsel token'ler, LLM'nin iç tutarlılık kontrollerine metinle aynı şekilde katılmazlar.

Bu semptomlar iyi belgelenmiştir. MM1.5 Bölüm 4 bunları niceliksel olarak belirtmektedir. LLaVA-OneVision'ın ablasyonları onlara işaret ediyor. Cevap yerel ön eğitimdir.

## Konsept

### Yerel çok modlu ön eğitim

InternVL3, ilk adımdan itibaren yerel çok modlu bir yapı üzerinde sıfırdan eğitim verir. Karışım:

- %40 salt metin verileri (FineWeb, Proof-Pile-2, vb.)
- %35 aralıklı resim-metin verileri (OBELICS, MMC4 tarzı)
- %20 eşleştirilmiş resim yazısı verisi
- %5 video-metin verisi

Vizyon token'lar, metin token'ler ve modlar arası etkileşimlerin tümü, ilk gradient adımından itibaren aynı kayba katılır. Hizalama ön eğitimi yok, projektörün donma aşaması yok, toparlanmayı gerektiren feci bir unutma yok.

Temel model için eğitim tek aşamalıdır. Talimat ayarlaması bunu takip eder, ancak temel model zaten görsel token'leri birinci sınıf vatandaşlar olarak anlıyor.

### V2PE (değişken görsel konum kodlaması)

Qwen2-VL, sabit eksen tahsisli M-RoPE'yi kullanır. InternVL3, V2PE'yi sunar: konum kodlaması, öğrenilebilir ölçeklendirmeyle modalite türüne (metin, resim, video) göre değişir. Pratikte:

- Metin token'ler 1B konumunu alır (metin dizini).
- Görüntü yamaları 2B konum alır (satır, sütun).
- Video kareleri 3 boyutlu konum alır (zaman, satır, sütun).

Üçü aynı RoPE frekans tabanını paylaşıyor ancak bant başına gizli karartma tahsisi, sabit bir bölünmeden ziyade öğrenilmiş bir parametredir. Ön eğitim sırasında zamansal ve uzaysal frekans çözünürlüğü arasında geçiş yapma özgürlüğü.

V2PE'nin ablasyon iddiası: Aynı hesaplamada M-RoPE üzerinden video benchmark'larda 1-2 puan. Bir devrim değil, daha temiz.

### Görsel Çözünürlük Yönlendiricisi (ViR)

Deployment optimizasyonu. Tüm görüntülerin tam çözünürlüklü kodlamaya ihtiyacı yoktur. Düşük ayrıntıya sahip bir nesne içeren fotoğraf, 1280 piksel native resolutionte kodlandığında token saniyeleri boşa harcar. ViR, kodlamadan önce soruyu yanıtlamak için gereken minimum çözünürlüğü tahmin eden küçük bir sınıflandırıcıdır.

Yönlendirmenin üç katmanı vardır: düşük çözünürlüklü (256 tokens), orta (576), yüksek (2048+). Üretim trafiğindeki sorguların %60'ı için düşük veya orta yeterlidir. Net etki: Eşit kalitede 2-3 kat verim.

### Ayrılmış Görüş Dili deployment (DvD)

Büyük bir VLM sunduğunuzda, görüntü kodlayıcı görüntü başına bir kez çalışır ancak LLM, her token çıkışı için otomatik regresif olarak çalışır. İki bileşenin farklı darboğazları vardır (görüş = dönüşüm + dikkat için GPU bellek bant genişliği; LLM = KV önbellek). DVD, bunları aralarında akış olacak şekilde ayrı GPU'lara böler.

8B + 400M kodlayıcı modeli için DVD, aynı konuma kıyasla düğüm başına verimi kabaca iki katına çıkarır.

### Tek aşamalı ve çok aşamalı kalite

InternVL3'ün birincil benchmark iddiası: 78B parametrelerinde Gemini 2.5 Pro'nun MMMU-Pro'suyla eşleşin. 38B'de GPT-4o'yu eşleştirin. 8B'de açık 8B sıralamasında lider olun. Hepsi tek aşamalı bir ön eğitim + talimat-ayar tarifinde.

Uyum-borç hipotezi ölçülebilir: InternVL3-8B, görüş birimi başına Qwen2.5-VL-7B-benchmark kazancından daha az text-benchmark puanı (MMLU, GSM8K) kaybeder. Model daha genel bir yaklaşıma sahip çünkü eğitim iki parça değil tek parçaydı.

### InternVL3.5 ve InternVL-U

InternVL3.5 (Ağustos 2025) tarifi ölçeklendirir. Aynı yerel ön eğitim yaklaşımı, daha fazla veri, daha fazla parametre. MMMU iyileştirmeleri aşamalıdır.

InternVL-U (2026), aynı omurganın üzerinde MMDiT kafaları aracılığıyla görüntü çıkışı sağlayan birleşik nesil ekler. "U", Transfüzyon tarzı birleştirilmiş modelleri takip eden "Anlama + nesil" anlamına gelir (Ders 12.13). Aynı yerel ön eğitim omurgası hem anlayışı hem de nesil kafalarını destekler.

### Yerel ön eğitimin ödünleri

Yerel ön eğitim ücretsiz değildir:

- Hesapla. Yeni bir VLM'yi sıfırdan eğitmek, bir metin LLM'yi eğitmekle aynı maliyete sahiptir (milyonlarca GPU saati). Post-hoc uyarlama, mevcut LLM ağırlıklarını yeniden kullanır ve maliyetin büyük bir kısmından tasarruf sağlar.
- Veri. Geniş ölçekte aralıklı resim-metin bütünleri nadirdir. OBELICS 141M belgedir; MMC4 571M'dir. Yalnızca metin 15T tokensn hızla gönderilir. Çok modlu ön eğitim veri kıtlığı zorlu bir kısıtlamadır.
- Base-LLM'nin yeniden kullanımı. Yerel ön eğitim, daha sonra yeni bir LLM'ye girme seçeneğinden vazgeçer. Post-hoc, yalnızca bağdaştırıcıyı yeniden eğiterek Llama-3.1'i Llama-4 ile değiştirmenize olanak tanır.

InternVL3'ün yaptığı bahis: hizalama borcu yeniden kullanım kaybından daha kötü. benchmark iddiayı destekliyor. Üretim maliyeti gelecekteki laboratuvarların ucuza kopyalanmasını engelliyor. Post-hoc VLM'ler çoğu proje için daha ucuz oldukları için mevcut olmaya devam edecekler.

## Kullan onu

`code/main.py` bir eğitim derlem karıştırıcısı ve ViR yönlendirici simülatörüdür. BT:

- Hedef derlem karışımını (%metin, %interleaved, %caption, %video) alır ve yöntem başına beklenen adımları hesaplar.
- Bir grup sorgu üzerinde ViR yönlendirmesini simüle eder (dağıtım: %50 düşük ayrıntı, %30 orta, %20 yüksek ayrıntı) ve ortalama token sayısını raporlar.
- LLM FLOP'lara karşı kodlayıcıya göre DVD üretim tahminlerini raporlar.
- Paramler, hesaplama, veriler ve beklenen uyum-borç belirtileri açısından post-hoc ve yerel ön eğitimin yan yana çıktısını alır.

## Gönderin

Bu ders `outputs/skill-native-vs-posthoc-auditor.md` üretir. Önerilen bir VLM eğitim planı göz önüne alındığında, yerel mi yoksa post-hoc mu gidileceğini denetler, uyum-borç riskini işaretler ve bir derlem karışımı önerir. Yeni bir açık VLM projesini boyutlandırırken ve eğitim stratejisini seçmeniz gerektiğinde bunu kullanın.

## Egzersizler

1. InternVL3-8B (yerel ön eğitim) ve LLaVA-OneVision-7B (post-hoc) arasındaki hesaplama deltasını tahmin edin. GPU saatlerinin oranı yaklaşık olarak? Aradaki farkı ne açıklıyor?

2. InternVL3 %40 metin / %35 aralıklı / %20 altyazı / %5 video bildirir. Hedef göreviniz video ağırlıklıysa yeni bir oran önerin ve temel modelin neden hala önemli metin ve altyazı verilerine ihtiyaç duyduğunu tartışın.

3. Unutmayla ilgili MM1.5 Bölüm 4'ü okuyun. Post-hoc eğitimin en büyük regresyonu gösterdiği yerin tam olarak benchmark adını verin. Regresyonun maliyeti ne kadar oldu?

4. ViR, trafiğin %60'ını düşük çözünürlüklü kodlamaya yönlendirir. Ne tür sorguları yanlış yönlendiriyor (yüksek çözünürlüğe ihtiyaç duyulduğunda düşük çözünürlüğe gönderiyor)? Üç yönlendirici arıza modu önerin.

5. DVD, vizyonu ve LLM'yi ayrı GPU'lara böler. DVD hangi trafik düzeni altında iş hacmine yardımcı olmak yerine zarar veriyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Yerel çok modlu ön eğitim | "Sıfırdan birlikte" | Metin + resim + video token'lar 1. adımdaki kayba katılır, daha sonra eklenmez |
| Hizalama borcu | "Post-hoc ceza" | Dondurulmuş bir yüksek lisans üzerine vizyonun cıvatalanmasından kaynaklanan metin becerilerinde ve cevap tutarlılığında ölçülebilir gerileme |
| V2PE | "Değişken görsel konum kodlaması" | Modaliteye göre öğrenilebilir konum kodlama tahsisi; InternVL3'ün M-RoPE halefi |
| Vir | "Çözünürlük yönlendiricisi" | Kodlamadan önce sorgu başına gereken minimum çözünürlüğü seçen küçük sınıflandırıcı, inference tokens |
| DVD | "Ayrılmış deployment" | Bir GPU'da görüntü kodlayıcı, diğerinde LLM, akış aktarımıyla; büyük VLM'ler için verimi iki katına çıkarır |
| StajyerVL-U | "Birleşik anlayış + nesil" | Yerel ön eğitim omurgasına görüntü oluşturma kafaları ekleyen 2026 takibi |
| Aralıklı külliyat | "OBELİKLER / MMC4" | Doğal okuma sırasına göre metin ve görseller içeren belgeler; yerel ön eğitimin hammaddesi |

## Daha Fazla Okuma

- [Chen ve ark. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu ve ark. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang ve ark. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
