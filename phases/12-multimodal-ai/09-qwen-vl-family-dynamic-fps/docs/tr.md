# Qwen-VL Ailesi ve Dinamik FPS Videosu

> Qwen-VL ailesi — Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025) — 2026'daki en etkili açık görüş dili modeli neslidir. Her nesil, açık ekosistemin geri kalanının on iki ay içinde kopyalayacağı tek ve belirleyici bir mimari iddiaya girdi: M-RoPE aracılığıyla yerel dinamik çözünürlük, mutlak zamanlı dinamik FPS örnekleme hizalama, ViT'deki pencere dikkati ve yapılandırılmış agent çıktı formatları. Qwen3-VL ile tarif stabil hale getirildi: yerel en boy oranı girişlerine sahip bir 2D-RoPE-ViT kodlayıcı, geniş bir Qwen3 dil tabanına bir MLP projektörü ve birinci sınıf hedefler olarak OCR, grounding ve agent davranışını vurgulayan eğitim aşamaları. Bu ders aileyi kronolojik olarak okur, böylece her düğmenin neden olduğu yerde olduğunu anlarsınız.

**Tür:** Öğren
**Diller:** Python (stdlib, M-RoPE kodlayıcı + dinamik-FPS örnekleyici)
**Önkoşullar:** Aşama 12 · 06 (yama ve paket)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- M-RoPE'nin üç eksenli dönüşlerini (zamansal, yükseklik, genişlik) hesaplayın ve üçüne neden ihtiyaç duyulduğunu açıklayın.
- Bir video için bir dinamik FPS örnekleme stratejisi seçin ve saniye başına tokens ile olay algılama doğruluğunun karşılaştırmasını yapın.
- Dört Qwen-VL nesil yükseltmesini sırayla adlandırın ve her birinin neyi etkinleştirdiğini belirtin.
- Qwen2.5-VL tarzı JSON agent çıkış biçimini bağlayın ve bir VLM yanıtından yapılandırılmış araç çağrılarını ayrıştırın.

## Sorun

Qwen-VL, LLaVA-1.5 ve BLIP-2'ye doğrudan yanıt olarak Ağustos 2023'te sevk edildi. Qwen ekibinin hedeflediği boşluk üç yönlüydü: çözünürlük, video ve yapılandırılmış çıktı.

Çözünürlük: LLaVA-1.5, 336x336'da çalıştı. Fotoğraflar için iyi, Çince bir fatura veya yoğun bir e-tablo ekran görüntüsü için işe yaramaz. Qwen-VL'nin ilk yeniliği 448x448 ve modelin nesnelere işaret etmesine olanak tanıyan topraklanmış sınırlayıcı kutu çıktısıydı.

Video: Video-LLaMA, kare başına kodlayıcıları yığınladı ve bunları LLM'ye besledi. Zamansal eksenin sinyal olduğu çok dakikalık videolarda değil, kısa kliplerde işe yaradı. Qwen ekibi zamanı anlayan tek bir kodlayıcı istiyordu.

Yapılandırılmış çıktı: LLaVA serbest biçimli metin yayınladı. Bir agent'nin JSON'a ihtiyacı vardır. Qwen-VL, metin olarak sınırlayıcı kutu koordinatları da dahil olmak üzere açık JSON çıktı formatları konusunda eğitildi.

Her Qwen-VL nesli bu üç eksenden birini genişletir.

## Konsept

### Qwen-VL (Ağustos 2023)

Birinci nesil: Kodlayıcı olarak OpenCLIP ViT-bigG/14 (2,5B parametreler), LLama uyumlu Q-Former (256 sorgu ile 1 adım), Qwen-7B tabanı. Katkılar:

- 448x448 çözünürlük (daha sonra açık bir VLM için SOTA).
- Grounding: açık koordinat-token çıktısına sahip görüntü-metin çiftleri üzerinde eğitilmiştir. "Kedi <box>(112, 204), (280, 344)</box>'ta".
- Başlangıçtan itibaren Çince + İngilizce çok dilli eğitim.

O zamanlar Benchmark'lar: İngilizcede GPT-4V ile rekabet halinde, Çincede baskındı. Temel denetimi asıl başlıktı.

### Qwen2-VL (Eylül 2024) — M-RoPE ve native resolution

Qwen2-VL, sabit çözünürlüklü + Q-Former yığınını doğal olarak dinamik çözünürlüklü bir ViT kodlayıcıyla değiştirdi. Anahtar değişiklikler:

- Yerel dinamik çözünürlük. ViT, 28'e bölünebilen herhangi bir HxW'yi kabul eder (2x uzaysal birleştirme ile yama 14). 1120x672 (40x24 birleştirilmiş yamalar) boyutundaki bir görüntü 960 görsel token üretir. Yeniden boyutlandırma yok, döşeme yok, küçük resim yok.
- M-RoPE (Multimodal RoPE). Her token, 1B yerine 3B bir konum (t, h, w) taşır. Görüntüler için t=0, video için t = Frame_index. RoPE, sorgu/anahtar vektörlerini eksen başına bir frekansa göre döndürür. Konumsal embedding tablosu yok.
- MLP projektörü. Q-Former'ı bırakın; birleştirilmiş yama token'larda 2 katmanlı bir MLP kullanın.
- Dinamik FPS'li video. Video varsayılan olarak 1-2 FPS'de örneklenir, ancak model rastgele kare sayımlarını kabul eder.

Sonuç: Qwen2-VL-7B, çeşitli multimodal benchmark'larda GPT-4o ile eşleşti ve DocVQA'da onu yendi (94,5'e karşı 88,4). Mimari değişiklik belirleyici hamleydi.

### Qwen2.5-VL (Şubat 2025) — dinamik FPS + mutlak zaman

Qwen2.5-VL'nin en büyük değişimi videoydu. Dinamik FPS yalnızca "gerektiğinde daha fazla kare örneklemek" değildir. Makale şu şekilde resmileştirildi:

- Mutlak süre tokens. Konumsal indeksler (kare 0, 1, 2...) yerine gerçek zaman damgalarını kullanın. "0:04'te kedi atlıyor." Model, `<time>0.04</time>` token'lerin token'ler çerçevesiyle serpiştirilmiş olduğunu görüyor.
- Dinamik FPS. Yavaş çekim için 1 FPS'de, aksiyon için 4+ FPS'de örnekleme. Kullanıcı veya eğitmen seçer; M-RoPE uyum sağlar.
- ViT'de pencere dikkati. Uzamsal dikkat, verim için pencerelidir (bloklar içinde yerel); Her birkaç katmanda bir küresel ilgi.
- Açık JSON çıktı formatı. Araç çağrısı verileri üzerine eğitim verildi: "{\"tool\": \"click\", \"coords\": [380, 220]}". Agent-kutudan çıktığı gibi hazır.
- MRoPE-v2 ölçeklendirmesi. Konumlar maksimum giriş boyutuyla ölçeklenir, böylece 10 dakikalık bir video frekans aralığının dışına çıkmaz.

Benchmarks: Qwen2.5-VL-72B, çoğu video benchmark'da GPT-4o'yu yener, belgelerde Gemini 2.0 ile eşleşir ve GUI temeli için açık model SOTA'yı ayarlar (ScreenSpot: GPT-4o için %84'e karşı %38 doğruluk).

### Qwen3-VL (Kasım 2025)

Qwen3-VL, yeniden icat etmek yerine pekiştiren artımlı bir yükseltmedir: daha büyük LLM omurgası (Qwen3-72B), genişletilmiş eğitim verileri, geliştirilmiş OCR, Qwen3 "düşünme modu" aracılığıyla daha güçlü muhakeme. ViT ve M-RoPE kalır. Makale, mimari üzerindeki veri ve eğitim iyileştirmelerine odaklanmaktadır.

Kökten çıkarım: 2025 yılına gelindiğinde Qwen-VL mimarisi istikrara kavuşmuştu. Ek nesiller, ilkelleri değil, bilgi işlem ve verileri ölçeklendirir.

### M-RoPE matematiksel olarak

Klasik RoPE, eşleştirilmiş koordinatları kullanarak `d` boyutunun `q` sorgusunu `m` konumuna göre döndürür:

```
q_rot[2i]   = q[2i]   * cos(m * theta_i) - q[2i+1] * sin(m * theta_i)
q_rot[2i+1] = q[2i]   * sin(m * theta_i) + q[2i+1] * cos(m * theta_i)
theta_i     = 10000^(-2i/d)
```

M-RoPE gizli karartmayı üç banda böler. `d = 96` deyin. 32'yi zamansala, 32'yi yüksekliğe, 32'yi genişliğe atayın. Her bant kendi eksen konumuna göre döner. (t=5, h=10, w=20) konumundaki bir yama, üç bandına uygulanan `R_t(5)`, `R_h(10)`, `R_w(20)` dönüşlerini alır.

Metin token'ler, uyumluluğu koruyarak `t = text_index, h = 0, w = 0` (veya normalleştirilmiş bir seçim) kullanır. Video kareleri `t = frame_time, h = row, w = col` kullanır. Tek görseller `t = 0` kullanır.

Avantajı: Tek konumlu kodlama, dallanma kodu veya farklı konum tabloları olmadan metin, resim ve videoyu yönetir.

### Dinamik-FPS örnekleme mantığı

Süresi `T` saniye olan bir video ve hedeftokensn'lik bir bütçe `B` verildiğinde:

1. Ödeyebileceğiniz maksimum FPS'yi hesaplayın: `fps_max = B / (T * tokens_per_frame)`.
2. `{1, 2, 4, 8}` arasından `fps <= fps_max` şartlarını karşılayan bir hedef FPS seçin.
3. Hareket yüksekse (optik akış buluşsal yöntemi veya açık kullanıcı isteği), daha yüksek FPS'yi seçin. Hareket düşükse, daha düşük olanı seçin.
4. Seçilen FPS'de eşit şekilde örnek alın; çerçevelerin arasına `<time>t</time>` tokens ekleyin.

Qwen2.5-VL bu mantığı örtülü olarak eğitir; inference'da kullanıcı `fps` parametresi aracılığıyla kontrol eder. Kare başına 81 tokens = 19440 tokens ile 4 FPS'de 60 saniyelik bir aksiyon sekansı, 32k bağlamda yönetilebilir.

### Yapılandırılmış agent çıkışı

Qwen2.5-VL'nin agent eğitimi açıkça yapılandırılmış araç çağrılarını hedefler:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

Ayrıştırma deterministiktir: modelin çıktısı üzerinden JSON.parse. Normal ifade ve belirsizlik yönetimi gerektiren serbest biçimli "(1024, 512)'ye tıklayın" ile karşılaştırın. Bu değişim, Qwen2.5-VL'nin ScreenSpot puanlarının Qwen2-VL'nin %55'inden %84'e çıkmasının nedenidir.

## Kullan onu

`code/main.py` şunu uygular:

- Metin, görüntü yamaları ve video karelerini karıştıran paketlenmiş bir dizi için M-RoPE konum hesaplaması.
- Dinamik FPS örnekleyici: verilen (süre, bütçe, hareket_seviyesi), FPS'yi seçin ve kare zaman damgalarını yayınlayın.
- Koordinat alanlarıyla araç çağrısı yanıtlarını işleyen bir oyuncak Qwen2.5-VL JSON çıkış ayrıştırıcısı.

Çalıştırın ve 5 dakikalık bir videoda sabit FPS'yi dinamik FPS ile değiştirdiğinizde farkı hissedin.

## Gönderin

Bu ders `outputs/skill-qwen-vl-pipeline-designer.md` üretir. Bir video görevi verildiğinde (izleme, agent, eylem tanıma, erişilebilirlik), Qwen2.5-VL yapılandırmasını (çerçeve bütçesi, FPS stratejisi, pencere dikkat işareti, agent-çıkış modu) ve bir gecikme tahmini yayınlar. Bir video ürünü için Qwen-VL ailesi modelini dağıttığınızda bunu kullanın.

## Egzersizler

1. Gizli 48 (bant başına 16, temel teta 10000) ile (t=3, h=5, w=7)'deki bir yama için M-RoPE rotasyonlarını hesaplayın. Her banttaki ilk üç çiftin dönüş açılarını gösterin.

2. 1 FPS'de 10 dakikalık bir güvenlik kamerası kaydı kaç kare üretir? 3x havuzlu 384 çözünürlükte toplam kaç token var? Qwen2.5-VL'nin varsayılan 32k içeriği bunu hallediyor mu?

3. 30 saniyelik tenis rallisi, 30 saniyelik tarif demosu ve 30 saniyelik UI-agent kaydı için FPS'yi seçin. Her birini dinamik FPS mantığıyla gerekçelendirin.

4. Qwen2.5-VL, Q-Former'ı tamamen bırakır. Basit bir MLP neden 2025'te çalışıyor da 2023'te çalışmıyor? (İpucu: veri ölçeği ve kodlayıcı kalitesi.)

5. Üç Qwen2.5-VL JSON araç çağrısı çıkışını Python sözlerine ayrıştırın. Hatalı biçimlendirilmiş JSON için ne başarısız olur ve Qwen yemek kitabı hangi kurtarma stratejisini önerir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| M-HALAT | "Multimodal Halat" | Gizli loşlukta zamansal, yükseklik ve genişlik bantlarıyla 3 boyutlu döner konum embedding |
| Dinamik FPS | "Akıllı örnekleme" | Hareket, süre ve token bütçeye göre video başına seçilen kare örnekleme oranı |
| Mutlak zaman token | "Zaman damgası token" | `<time>t</time>`, modelin çerçeve indeksini değil gerçek saniyeleri görmesi için diziye serpiştirilmiştir |
| Pencere dikkati | "Yerel ilgi" | Hız için küçük pencerelerle sınırlı olan mekansal self-attention; periyodik olarak küresel ilgi eklendi |
| Yapılandırılmış agent çıkışı | "JSON modu" | VLM'ye kodlar ve araç adlarıyla ayrıştırılabilir JSON yayınlamayı öğreten eğitim verileri denetimi |
| min_pixels / max_pixels | "Çözünürlük sınırları" | İstek başına Qwen2.5-VL, sınırlayıcı toplam piksel sayısını ve dolayısıyla token sayısını kontrol eder |
| Grounding | "İşaret et" | Sınırlayıcı kutu koordinatlarının tokens metni olarak çıktısı alınıyor; Qwen-VL v1'den beri kullanılıyor |

## Daha Fazla Okuma

- [Bai ve ark. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang ve ark. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Ekibi — Qwen2.5-VL Teknik Raporu (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Takımı — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu ve ark. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
