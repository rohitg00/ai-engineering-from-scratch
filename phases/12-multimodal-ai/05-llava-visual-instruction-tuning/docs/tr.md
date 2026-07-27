# LLaVA ve Görsel Talimat Ayarlama

> LLaVA (Nisan 2023), gezegende en çok kopyalanan multimodal mimaridir. BLIP-2'nin Q-Former'ını 2 katmanlı bir MLP ile değiştirdi, Flamingo'nun kapılı çapraz dikkatini saf token birleştirmeyle değiştirdi ve GPT-4 tarafından salt metin altyazılarından oluşturulan 158k görsel talimat dönüşü konusunda eğitildi. 2023 ile 2026 yılları arasında bir VLM oluşturan herhangi bir uygulayıcı, LLaVA'nın bir çeşidini geliştirmiştir. LLaVA-1.5 AnyRes'i ekledi. LLaVA-NeXT'nin çözünürlüğü arttı. LLaVA-OneVision tek bir tarifte birleşik görüntü, çoklu görüntü ve video. Bu derste tarifi okur, projektörü uygular ve neden "daha basit olanın kazandığını" açıklar.

**Tür:** Yapım
**Diller:** Python (stdlib, projektör + talimat şablonu oluşturucu)
**Önkoşullar:** Aşama 12 · 02 (CLIP), Aşama 11 (LLM Mühendislik - talimat ayarlama)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- ViT yama embedding'larını (dim 1024) bir LLM'nin embedding loş (dim 4096) ile eşleştiren 2 katmanlı bir MLP projektörü oluşturun.
- LLaVA'nın iki aşamalı tarifini uygulayın: (1) 558k altyazı çiftinde projektör hizalaması, (2) 158k GPT-4 tarafından oluşturulan dönüşlerde görsel talimat ayarı.
- Görüntü token yer tutucusu, sistem prompt ve kullanıcı/asistan dönüşleriyle bir LLaVA biçimli prompt oluşturun.
- Q-Former'ın token-bütçe kazanmasına rağmen topluluğun neden Q-Former'dan MLP'ye geçtiğini açıklayın.

## Sorun

BLIP-2'nin Q-Former'ı (Ders 12.03) bir görüntüyü 32 tokens'ye sıkıştırır. Temiz, verimli, benchmark'lar için iyi. Ama iki sorunu var.

Birincisi, Q-Former eğitilebilir ancak onun kaybı nihai görev değildir. Aşama 1, ITC+ITM+ITG'yi eğitiyor. Aşama 2, LM kaybını eğitir. Sorgular, LLM'nin daha sonra kodunu çözmesi gereken bazı ara temsilleri öğrenir. Darboğazda bilgi kaybolur.

İkincisi, Q-Former 188M parametre alır ve LLaVA'nın 2023 ölçeğinde onu hedef LLM'nizle birlikte tasarlamanız gerekiyordu. LLM'yi değiştirin, Q-Former'ı yeniden eğitin. Görüntü kodlayıcıyı değiştirin, yeniden eğitin. Her kombinasyon ayrı bir Ar-Ge projesiydi.

LLaVA'nın cevabı basitliği nedeniyle utanç vericiydi: ViT'nin 576 yamasını token alın, her birini 2 katmanlı bir MLP'den (`1024 → 4096 → 4096`) geçirin ve 576'nın tamamını LLM'nin giriş dizisine boşaltın. Darboğaz yok. Tuhaf hedefler üzerine 1. aşama ön eğitimi yok. Sadece MLP'yi doğrudan LM kaybı konusunda eğitin.

Veriler nereden geliyor? LLaVA'nın ikinci görüşü: talimat verilerini oluşturmak için GPT-4'ü (yalnızca metin) kullanın. GPT-4'e bir görsel için COCO başlığını ve sınırlayıcı kutu verilerini besleyin, konuşmalar, açıklamalar ve karmaşık akıl yürütme soruları üretmesini isteyin. 158 bin talimat-yanıt dönüşü ücretsiz. İnsan açıklaması yok.

Sonuç: Bir gün boyunca 8 A100'de çalışan, MMMU'da Flamingo'yu yenen ve topluluğun genişletebileceği açık bir kontrol noktası sağlayan bir VLM. 2023'ün sonlarına doğru 50'den fazla çatal ortaya çıktı.

## Konsept

### Mimari

13B'de LLaVA-1.5:
- Vision enkoder: CLIP ViT-L/14 @ 336 (1. aşamada dondurulmuş, isteğe bağlı olarak 2. aşamada dondurulmamış).
- Projektör: GELU etkinleştirmeli 2 katmanlı MLP, `1024 → 4096 → 4096`.
- Yüksek Lisans: Vicuna-13B (daha sonra Llama-3.1-8B).

Bir görseli + metni prompt ilet:

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

Resim LLM içeriğinin 576 tokens'sini kaplıyor. 2048 bağlamında, metin için 1472 tokens kalır. 32k bağlamında bu bir yuvarlama hatasıdır.

### Aşama 1: projektör hizalaması

ViT'yi dondurun. LLM'yi dondurun. Yalnızca 2 katmanlı MLP'yi eğitin. Dataset: 558 bin resim yazısı çifti (LAION-CC-SBU). Kayıp: altyazıdaki dil modellemesi, yansıtılan görüntü token'lere göre koşullandırılmıştır.

Parti 128'deki tek bir dönemde bu, birkaç saat içinde yapılır. Projektör ViT alanını LLM alanına eşlemeyi öğrenir. Göreve özel denetim yok.

### Aşama 2: görsel talimat ayarı

Projektörün buzunu çözün (hala eğitilebilir). LLM'yi çözün (genellikle tamamen, bazen LoRA). 158 bin görsel talimatlı dönüşte antrenman yapın.

Talimat verileri işin püf noktasıdır. Liu ve diğerleri. tarafından oluşturuldu:
1. Bir COCO görüntüsü çekin.
2. Metin açıklamasını çıkarın (5 insan altyazı + sınırlayıcı kutu listesi).
3. Üç prompt şablonuyla GPT-4'e gönderin:
- Konuşma: "Kullanıcı ile asistan arasında bu resim hakkında ileri geri bir diyalog oluşturun."
- Ayrıntılı açıklama: "Resmin zengin ve ayrıntılı bir açıklamasını verin."
- Karmaşık akıl yürütme: "Resim hakkında akıl yürütmeyi gerektiren bir soru sorun, ardından yanıtlayın."
4. GPT-4'ün çıktısını (talimat, yanıt) çiftlerine ayrıştırın.

Bunların hiçbiri görsele doğrudan dokunmuyor; yalnızca metin açıklaması. GPT-4 makul görüntü içeriğini halüsinasyona uğratıyor. Biraz gürültü vardı ama işe yaradı: Diyalogun kilidini açmak için 158 bin dönüş yeterliydi.

### Topluluk bunu neden kopyaladı?

- Ayarlanacak aşama 1'e özgü kayıp yok. Boyunca LM kaybı.
- Projektör günlerce değil, saatler içinde eğitilir.
- LLM, yalnızca projektörün yeniden eğitilmesiyle değiştirilebilir (LLaVA-Llama2, LLaVA-Mistral, LLaVA-Llama3).
- Görsel talimat veri hattı GPT-4 kullanır ve yeni bir alan adı için yeniden oluşturulması ucuzdur.

### LLaVA-1.5 ve LLaVA-NeXT

LLaVA-1.5 (Ekim 2023) eklendi:
- Akademik görev verileri (VQA, OKVQA, RefCOCO) talimat ayarlamasına karıştırıldı.
- Daha iyi sistem prompt.
- 2048 → 32k bağlam.

LLaVA-NeXT (Ocak 2024) şunu ekledi:
- AnyRes: Yüksek çözünürlüklü görüntüleri 336x336 kırpmadan oluşan 2x2 veya 1x3 ızgaraya ve ayrıca bir global düşük çözünürlüklü küçük resme bölün. Her mahsul 576 tokens olur; resim başına toplamda yaklaşık 2880 görsel tokens. OCR ve grafik görevleri arttı.
- ShareGPT4V (yüksek kaliteli GPT-4V altyazıları) ile daha iyi talimat verileri karışımı.
- Daha güçlü temel LLM'ler (Mistral-7B, Yi-34B).

### LLaVA-OneVision

Ders 12.08, OneVision'ı derinlemesine ele alıyor. Kısa versiyon: aynı projektör, ancak paylaşılan görsel-token bütçeyle tek modelde tek görüntü, çoklu görüntü ve videoyu kapsayan bir müfredatla eğitilmiştir.

### Q-Former ile karşılaştırma

| | Q-Eski (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Resim başına görsel token'ler | 32 | 576 (taban) veya 2880 (AnyRes) |
| Eğitilebilir parametreler | 188M + LM | 40M + LM |
| 1. Aşama mağlubiyeti | ITC+ITM+ITG | Yalnızca LM |
| LLM girişli | Yeniden eğitim gerektirir | Minimum yeniden eğitimle değiştirme |
| Çoklu görüntü | Garip | Doğal (birleştirilmiş) |
| Videosu | Garip | Doğal (kare başına birleştirme) |
| Token bütçe | Küçük | Büyük |

MLP basitlik ve token esneklik sayesinde kazanır. Q-Former token bütçeyle kazandı. 2023'ün sonlarına doğru token bütçesi artık bağlayıcı kısıtlama değildi (LLM bağlamları 32 bin-128 bin+'a yükseldi) ve basitlik hakim oldu.

### prompt biçimi

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` bir token yer tutucusudur. tokenizasyondan önce, 576 görsel token'lerle (veya 2880, AnyRes'le) değiştirilir. Tokenizer üzerinde eğitim verildiğinden biraz daha uzun bir dizi görüyor, ancak LLM yeni girdiyi ele alıyor çünkü aşama 1 bunu öğretiyor.

### Parametre ekonomisi

LLaVA-1.5-7B dökümü:
- CLIP ViT-L/14 @ 336: 303M (dondurulmuş aşama 1, genellikle dondurulmamış aşama 2).
- Projektör (2x doğrusal): ~22M eğitilebilir.
- Lama-7B: 7B.
- Toplam: 7,3B parametre. 2. aşamada eğitilebilir: tam 7B + 22M projektör.

2. aşama için eğitim maliyeti: 8xA100'de ~20 saat. Bu anahtar sayıdır; bir gün, bir düğüm, tekrarlanabilir. LLaVA'nın yayılmasının nedeni budur.

## Kullan onu

`code/main.py` şunu uygular:

1. Saf Python'da 2 katmanlı MLP projektör (oyuncak ölçeği için loş 16 → 32 → 32).
2. prompt-bina hattı: sistem prompt + `<image>`, N öngörülen token'ler + kullanıcı sırası + asistan oluşturma yer tutucusu ile değiştirildi.
3. 576-token görsel bloğunun LLM bağlamında nasıl göründüğüne ilişkin bir görselleştirici (tüketilen 2k / 32k / 128k bağlam yüzdesi).

## Gönderin

Bu ders `outputs/skill-llava-vibes-eval.md` üretir. Bir LLaVA ailesi kontrol noktası verildiğinde, 10-prompt titreşim değerlendirme paketini (3 altyazı, 3 VQA, 2 muhakeme, 2 ret) çalıştırır ve insan tarafından okunabilen bir puan kartı bildirir. benchmark değil; projektör ve LLM'nin iyi bağlandığını doğrulamak için bir duman testi.

## Egzersizler

1. `1024 → 4096 → 4096`'daki 2 katmanlı MLP projektörü için eğitilebilir parametre sayısını hesaplayın. GELU ve önyargı ile LLaVA-13B'nin hangi kısmını temsil ediyor?

2. Bir "reddetme" durumu için bir LLaVA prompt oluşturun — görüntü özel bir kişiyi içeriyor. Beklenen asistan yanıtını yazın. LLaVA neden bu sıfır atışı reddetmeli ve bu reddi güçlendirmek için hangi eğitim verilerine ihtiyaç duyulacak?

3. LLaVA-NeXT blogunun AnyRes bölümünü okuyun. AnyRes'te 1344x672'lik bir görüntü için görsel token sayısını hesaplayın. 336x336'daki 576 token tabanıyla karşılaştırın.

4. LLaVA aşama-1 projektörü, altyazılarda LM kaybıyla eğitilir. 1. aşamayı atlayıp doğrudan 2. aşamaya (görsel talimat ayarı) geçerseniz ne olur? Cevap için Prizmatik VLM ablasyonundan (arXiv:2402.07865) bahsedin.

5. LLaVA-Instruct-150k, talimatlar oluşturmak için COCO altyazılı GPT-4'ü kullanır. Yeni bir alan için (tıbbi röntgenler, uydu görüntüleri), alan talimatlarını oluşturmak için dört adımlı veri hattını tanımlayın. Her adımda ne yanlış gidebilir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Projektör | "MLP köprüsü" | ViT dim'i LLM dim'e eşleyen GELU'lu 2 katmanlı MLP |
| Resim token | "<image> yer tutucu" | Prompt işaretçisi, inference öncesinde N adet öngörülen görsel tokens ile değiştirildi |
| Görsel talimat ayarı | "LLaVA 2. aşama" | GPT-4 tarafından oluşturulan (resim, talimat, yanıt) üçlülere ilişkin eğitim |
| Aşama 1 hizalaması | "Projektör ön eğitimi" | ViT ve LLM'yi dondurun, başlıklarda LM kaybıyla projektörü eğitin |
| Herhangi Bir Res | "Çoklu mahsul döşeme" | Yüksek çözünürlüklü görüntüyü bir döşeme ızgarasına bölün ve her döşemenin görsel token'lerini |
| LLaVA-Talimat | "GPT-4 tarafından oluşturulan" | COCO altyazılarından + GPT-4'ten sentezlenen 158 bin talimat-yanıt çifti |
| Görüntü kodlayıcı donması | "Omurga kilitli" | CLIP ağırlıkları 1. aşamada güncellenmez, bazen 2. aşamada da güncellenmez |
| PaylaşGPT4V | "Daha iyi altyazılar" | Daha yüksek kalitede hizalama için kullanılan, GPT-4V tarafından oluşturulan 1 milyon yoğun altyazı |
| MYK | "Görsel soru yanıtlama" | Bir görselle ilgili serbest biçimli bir soruyu yanıtlama görevi |
| Prizmatik VLM'ler | "Tasarım alanı kağıdı" | Karamcheti 2024 ablasyon projektör ve veri seçimlerini sistematik olarak test ediyor |

## Daha Fazla Okuma

- [Liu ve ark. — Görsel Talimat Ayarlama (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) — LLaVA makalesi.
- [Liu ve ark. — Görsel Talimat Ayarlaması ile Geliştirilmiş Taban Çizgileri (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) — LLaVA-1.5.
- [Chen ve ark. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) — yoğun altyazılar dataset.
- [Karamcheti ve ark. — Prizmatik VLM'ler (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) — tasarım alanı ablasyonları.
- [Li ve ark. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) — birleşik tek görüntü, çoklu görüntü, video.
