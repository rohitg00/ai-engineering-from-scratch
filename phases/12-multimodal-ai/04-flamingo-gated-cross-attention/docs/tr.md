# Birkaç Çekimli VLM'ler için Flamingo ve Kapılı Çapraz Dikkat

> DeepMind'ın Flamingo'su (2022) iki şeyi herkesten önce yaptı. Tek bir modelin keyfi olarak serpiştirilmiş görüntü, video ve metin dizilerini işleyebileceğini gösterdi. Ve VLM'lerin bağlam içinde öğrenebildiğini gösterdi; üç örnek (resim, resim yazısı) çiftiyle birkaç çekim prompt verin ve model, herhangi bir gradient adımı olmadan yeni bir resme resim yazısı ekler. Mekanizma: donmuş LLM'nin mevcut katmanları arasına yerleştirilen, sıfırdan başlayan öğrenilmiş bir tanh kapısı ile kapılı çapraz dikkat katmanları, böylece LLM'nin metin özelliği başlatma sırasında korunur. Bu derste Flamingo'nun Perceiver yeniden örnekleyicisi ve geçitli çapraz dikkat mimarisi (Gemini'nin aralıklı girdileri ve Idefics2'nin görsel token'lerinin atası) anlatılmaktadır.

**Tür:** Öğren
**Diller:** Python (stdlib, geçitli çapraz dikkat + Algılayıcı yeniden örnekleyici demosu)
**Önkoşullar:** Aşama 12 · 03 (BLIP-2 Q-Former)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Geçitli çapraz dikkatin donmuş bir LLM'nin başlatma sırasında metin yeteneğini tanh(gate) = 0 aracılığıyla nasıl koruduğunu açıklayın.
- Bir Perceiver yeniden örnekleyicisini inceleyin: N görüntü yaması → Çapraz dikkat yoluyla K sabit "gizli" sorgu.
- Flamingo'nun aralıklı görüntü-metin dizilerini, görüntü yerleşimine saygı duyan nedensel maskelemeyle nasıl işlediğini açıklayın.
- Birkaç çekimlik çok modlu prompt yapısını yeniden oluşturun (3 resim yazısı örneği, ardından bir sorgu resmi).

## Sorun

BLIP-2, donmuş bir Yüksek Lisans'ın giriş katmanına 32 görsel token besler. prompt başına bir görüntü için çalışır. Peki ya "burada resim A, resim yazısı; işte resim B, resim yazısı; şimdi işte resim C, resim yazısı" gibi metinle serpiştirilmiş *birçok* görsel beslemek istiyorsanız ne olur? LLM'nin öz dikkatinin, görüntü token'leri ve metin token'leri tek bir akışta ele alması ve hangi görüntülerin karmaşıklaştığına hangi pozisyonların katılabileceği sorusunun ele alınması gerekir.

Flamingo'nun cevabı: Yüksek Lisans'ın giriş akışını hiçbir şekilde değiştirmeyin. Mevcut LLM bloklarının arasına ekstra çapraz dikkat katmanları ekleyin. Metin token'ler hâlâ her zaman olduğu gibi Yüksek Lisans'ın nedensel öz-dikkatinden akıyor. Her birkaç LLM bloğu arasında, metin token'ler ayrıca yeni bir geçit katmanı aracılığıyla görüntü özelliklerine çapraz katılım sağlar. Geçit (sıfıra başlatılmış), sıfır adımında yeni katmanların işlem yapılmadığı anlamına gelir; model tam olarak önceden eğitilmiş LLM gibi davranır. Eğitim ilerledikçe kapı açılır ve görsel bilgiler akmaya başlar.

Flamingo'nun yanıtladığı ikinci soru: prompt başına değişken sayıdaki görüntüleri (0, 1 veya daha fazla) nasıl idare edersiniz? Bir Perceiver yeniden örnekleyici — sahip olduğunuz sayıda yamayı alan ve sabit sayıda görsel gizli token'ler üreten küçük bir çapraz dikkat modülü. LLM çapraz dikkat katmanı, prompt'de kaç görüntü olduğuna bakılmaksızın aynı şekli görür.

## Konsept

### Dondurulmuş Yüksek Lisans

Flamingo, donmuş bir Chinchilla 70B LLM ile başlıyor. 70B ağırlıklarının tümüne dokunulmadı. Mevcut metin öz-dikkat ve FFN normal şekilde çalışır.

### Algılayıcı yeniden örnekleyici

prompt'daki her görüntü için ViT, N adet token yamasını üretir. Perceiver yeniden örnekleyicide K adet sabit öğrenilebilir gizli öğe bulunur (Flamingo, K=64 kullanır). Her yeniden örnekleyici bloğu iki alt adımdan oluşur:

1. Çapraz dikkat: K latentleri N yama token'lar boyunca katılır (Q latentlerden, K/V yamalardan).
2. Gizli dikkat + FFN.

6 yeniden örnekleyici bloktan sonra, ViT'nin kaç tane yama ürettiğine bakılmaksızın çıktı, dim 1024'ün K=64 görsel token'sidir. 224x224 görüntü (196 yama) ve 480x480 görüntü (900 yama) her ikisi de 64 yeniden örnekleyici tokens olarak çıkar.

Video için yeniden örnekleyici geçici olarak uygulanır: her karenin yamaları 64 latent üretir ve zamansal konumsal kodlama, modelin t=0'ı t=N'den ayırt etmesini sağlar. Videonun tamamı T * 64 görsel tokens olur.

### Geçitli çapraz dikkat

Dondurulmuş LLM'nin her M katmanı arasına (Flamingo M=4 kullanır), yeni bir kapılı çapraz dikkat bloğu ekleyin:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` sıfıra sıfırlanan öğrenilebilir bir skalerdir.
- `tanh(0) = 0`, yani başlangıçta kapılı dalın katkısı sıfırdır.
- `alpha` sıfırdan uzaklaştıkça çapraz dikkat katkısı sorunsuz bir şekilde artar.
- Artık bağlantı, tamamen açık bir kapının bile LLM'nin metin gösteriminin üzerine yazmayacağı anlamına gelir; sadece üstüne görsel bilgi ekler.

Bu, Flamingo'daki en önemli tasarım tercihidir: görsel koşullandırma, eklemeli, kapılı ve başlatma sırasında sıfırdır. 0. adımdaki Flamingo, salt metin girişlerinde mükemmel bir Chinchilla 70B'dir.

### Aralıklı girişler için maskelenmiş çapraz dikkat

"<image A> caption A <image B> caption B <image C>?" gibi bir prompt'da, her token metni yalnızca dizide kendisinden önce gelen görselleri görmelidir. Çapraz dikkat maskesi şunları uygular: `t` konumundaki metin token, yalnızca görüntü dizini `i < i_t` olan görüntü yeniden örnekleyicisi token'lere katılır; burada `i_t`, `t` konumundan önceki en son görüntüdür. "Yalnızca önceki son resmi görür" veya "önceki tüm resimleri görür" seçeneklerinin her ikisi de geçerli seçimlerdir; Flamingo ilkini seçti.

### Bağlam içi birkaç adımlı öğrenme

Bir Flamingo prompt şuna benzer:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

Model tamamlama modelini görür ve "kuş" (veya image3'te gösterilen her şey) çıktısını alır. gradient adım yok. Dondurulmuş LLM'nin bağlam içi öğrenme yeteneği, kapılı çapraz dikkati taşır - bu, makalenin can alıcı noktasıdır ve neden önemli olduğudur.

### Eğitim verileri

Flamingo üç datasetsaniyede eğitildi:

1. MultiModal MassiveWeb (M3W): Okuma sırasını yeniden oluşturan, aralıklı resim ve metin içeren 43 milyon web sayfası.
2. Resim-Metin Çiftleri (ALIGN + LTIP): 4,4B çift.
3. Video-Metin Çiftleri (VTP): 27 milyon kısa video klip.

OBELICS (2023), Idefics, Idefics2 ve çoğu açık "Flamingo benzeri" modelin üzerinde eğitim aldığı aralıklı web topluluğunun açık bir kopyasıdır.

### AçıkFlamingo ve Su Samuru

OpenFlamingo (2023) açık reprodüksiyondur. Mimarinin aynısı (Algılayıcı yeniden örnekleyici + donmuş LLaMA veya MPT'de kapılı çapraz dikkat). 3B, 4B, 9B'deki kontrol noktaları. Daha küçük LLM tabanı ve daha az veri nedeniyle kalite Flamingo'nun gerisinde kalıyor.

Otter (2023), MIMIC-IT (multimodal talimatlardan oluşan bir dataset) üzerinde talimat ayarlaması ile OpenFlamingo'yu temel alır ve talimat takibi için de kapılı çapraz dikkat çalışmalarını gösterir.

### Torunlar

- Idefics / Idefics2 / Idefics3: Hugging Face'in kapılı çapraz dikkat çizgisi, giderek daha basit (Idefics2, uyarlamalı havuzlama ile doğrudan yama token'lar lehine yeniden örnekleyiciyi bıraktı).
- Flamingo'dan Bukalemun'a geçiş: 2024 yılına gelindiğinde birçok takım early fusiona geçti (Ders 12.11); Flamingo tarzı kapılı çapraz dikkat, omurganın dondurulmasının gerekli olduğu üretimde kalır.
- Gemini'nin aralıklı girişi: Kavramsal olarak Flamingo'nun aralıklı format esnekliğini devralır, ancak tam mekanizma özeldir.

### BLIP-2 ile karşılaştırma

| | BLIP-2 | Flamingo |
|---|---|---|
| Görsel köprü | Q-Eski girişte bir kez | Her M katmanında kapılı çapraz dikkat |
| Görsel token'ler | Resim başına 32 | Çapraz attn katmanı başına görüntü başına 64 |
| Dondurulmuş Yüksek Lisans | Evet | Evet |
| Bağlamda birkaç çekim | Zayıf | Güçlü — gazetenin odak noktası |
| Aralıklı girişler | Yerel destek yok | Evet, tasarım hedefi |
| Eğitim verileri | 130M çift | 1,3 milyar çift + 43 milyon aralıklı sayfa |
| Parametre sayısı | 188 milyon eğitimli | ~10B eğitimli (çapraz attn katmanları) |
| Hesapla | 8 A100'lü Günler | Binlerce TPUv4'te haftalar |

Uygun bir bütçeyle tek görüntülü VQA için BLIP-2'yi seçin. Aralıklı, az çekimli veya çoklu görüntülü akıl yürütme için Flamingo/Idefics2'yi seçin.

## Kullan onu

`code/main.py` şunları gösterir:

1. 8 öğrenilebilir gizliliğe (saf Python çapraz dikkat) sahip 36 sahte yama token üzerinde bir Perceiver yeniden örnekleyici.
2. `alpha = 0` → çıktı eşittir girdi (LLM değişmez), ardından `alpha = 2.0` → görsel katkının karıştırıldığı kapılı bir çapraz dikkat adımı.
3. Bir "(görüntü 1) (metin 1) (görüntü 2) (metin 2)" dizisi için 2 boyutlu dikkat maskesini üreten bir aralıklı maske oluşturucu.

## Gönderin

Bu ders `outputs/skill-gated-bridge-diagnostic.md` üretir. Açık bir VLM'nin yapılandırması (yeniden örnekleyici Y/N, çapraz attn frekansı, geçit şeması) verildiğinde, Flamingo soyunun elemanlarını tanımlar ve dondurma stratejisini açıklar. Metin performansının neden düştüğü fine-tuningın hatalarını ayıklamak için kullanışlıdır (cevap: geçit çok hızlı bir şekilde genişledi).

## Egzersizler

1. Flamingo-9B'nin görsel parametre sayısını hesaplayın: 9B LLM + 1.4B kapılı çapraz dikkat katmanları + 64M yeniden örnekleyici. Toplam parametrelerin ne kadarı eğitiliyor?

2. Geçitli kalıntı `y = tanh(alpha) * cross + x`'yı PyTorch'a uygulayın. Bunu deneysel olarak `alpha=0`, `y==x` ile tam başlangıçta gösterin.

3. Her prompt farklı bir görüntü sayısına sahip olduğunda bir toplu iş içindeki birden fazla görüntüyü nasıl işlediklerini öğrenmek için OpenFlamingo Bölüm 3.2'yi (arXiv:2308.01390) okuyun. Doldurma stratejisini açıklayın.

4. Flamingo'nun çapraz dikkat maskesi neden bir metnin token tüm önceki görseller yerine *yalnızca en yeni* önceki görsele odaklanmasına izin veriyor? Flamingo makalesi Bölüm 2.4'ü okuyun ve aradaki farkı açıklayın.

5. Bağlam içi birkaç çekim: Yeni bir Flamingo çeşidi için 4 "görüntü → ana nesnenin rengi" örneğini içeren bir prompt oluşturun. Örnek sayısını 0'dan 8'e kadar değiştirdikçe beklenen doğruluk modelini tanımlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Algılayıcı yeniden örnekleyici | "Sabit gizli çapraz dikkat" | Değişken sayıda giriş yamasından K adet sabit token üreten modül |
| Geçitli çapraz dikkat | "Tanh kapılı köprü" | Artık katman `y = tanh(alpha)*cross + x`, öğrenilebilir alfa, başlangıç ​​0 |
| Aralıklı giriş | "Karışık sıra" | Okuma sırasına göre serbestçe karıştırılmış resim ve metin içeren Prompt biçimi |
| Dondurulmuş Yüksek Lisans | "LLM gradient yok" | LLM'nin ağırlıkları metni güncellenmez; yalnızca yeniden örnekleyici + çapraz attn katmanları dizisi |
| Birkaç atış | "Bağlam içi örnekler" | prompt'da birkaç (resim, cevap) çifti verin; model fine-tuning yapılmadan genelleştirilir |
| OBELİKLER | "Araya eklenmiş web külliyatı" | Resim ve metin içeren 141 milyon web sayfasından dataset tanesini okuma sırasına göre açın |
| Çinçilla | "70B donmuş baz" | Flamingo'nun dondurulmuş metni LLM, DeepMind'ın Chinchilla makalesinden |
| Kapı programı | "Alfa nasıl hareket eder" | Eğitim sırasında çapraz dikkat kapısının açılma hızı |
| Çapraz attn frekansı | "Her M katman" | Kapılı bir çapraz dikkat bloğunun ne sıklıkla eklendiği; Flamingo M=4 kullanıyor |
| OpenFlamingo | "Açık üreme" | MosaicML/LAION 3-9B'de açık kontrol noktası; Flamingo'nun mimarisiyle aynı |

## Daha Fazla Okuma

- [Alayrac ve ark. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) — orijinal makale.
- [Awadalla ve ark. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) — açık üreme.
- [Laurençon ve ark. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) — serpiştirilmiş web külliyatı.
- [Jaegle ve ark. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — genel Perceiver mimarisi.
- [Li ve ark. — Su samuru (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) — talimat ayarlı Flamingo soyundan.
- [Laurençon ve ark. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) — Flamingo yaklaşımının modern basitleştirilmesi.
