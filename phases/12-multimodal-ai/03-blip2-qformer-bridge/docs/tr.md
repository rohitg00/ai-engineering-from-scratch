# CLIP'ten BLIP-2'ye — Modalite Köprüsü olarak Q-Former

> CLIP, görüntüyü ve metni hizalar ancak altyazı oluşturamaz, soruları yanıtlayamaz veya bir görüşme gerçekleştiremez. BLIP-2 (Salesforce, 2023) bunu küçük, eğitilebilir bir köprüyle çözdü: 32 öğrenilebilir sorgu vektörü, dondurulmuş bir ViT'nin özelliklerine çapraz dikkat yoluyla katılır, ardından doğrudan dondurulmuş bir LLM'nin giriş akışına yerleştirilir. 11B LLM'yi ViT-g/14'e bağlayan köprünün 188 milyon parametresi. 2026'ya kadar her adaptör tabanlı VLM (MiniGPT-4, InstructBLIP, LLaVA'nın kuzenleri) bir nesildir. Bu ders, Q-Former'ın mimarisini okur, iki aşamalı eğitimini açıklar ve görsel token'leri donmuş bir metin kod çözücüye besleyen bir oyuncak versiyonunu oluşturur.

**Tür:** Yapım
**Diller:** Python (stdlib, çapraz dikkat + öğrenilebilir sorgu demosu)
**Önkoşullar:** Aşama 12 · 02 (CLIP), Aşama 7 (Transformers)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Dondurulmuş görüntü kodlayıcı ile donmuş LLM arasındaki eğitilebilir darboğazın, maliyet ve kararlılık açısından uçtan uca fine-tuningı neden geride bıraktığını açıklayın.
- Sabit bir dizi öğrenilebilir sorgunun harici görüntü özelliklerine katıldığı bir çapraz dikkat bloğu uygulayın.
- BLIP-2'nin iki aşamalı ön eğitimini inceleyin: temsil (ITC + ITM + ITG), ardından üretken (donmuş kod çözücüyle LM kaybı).
- Q-Former'ı LLaVA'da kullanılan daha basit MLP projektörle karşılaştırın ve her seçeneğin ne zaman kazanacağını tartışın.

## Sorun

Görüntü başına 256 yama tokens sönük 1408 üreten donmuş bir ViT'niz var. token embeddings loş 4096 bekleyen donmuş bir 7B LLM'niz var. Açık köprü - 1408'den 4096'ya kadar doğrusal bir katman - işe yarıyor, ancak 256 yama token'nın tamamını LLM'nin bağlamına beslemek görüntü başına 256 ekstra token'ye mal oluyor. Yalnızca görsel yöntem tarafından 8192 token tüketilen 32 görüntüden oluşan bir grup.

BLIP-2 sorusu: 256-token görüntü temsilini çok daha az sayıda token saniyeye (örneğin 32) sıkıştırabilirken, LLM'nin resim hakkında altyazı yazması, soruları yanıtlaması ve gerekçe vermesi için yeterli bilgiyi koruyabilir misiniz? Ve bu köprüyü, donmuş omurgalara dokunmadan, eğitim maliyetini yalnızca köprünün parametrelerinde tutarak eğitebilir misiniz?

Cevap: Bir Q-Former. ViT'nin yama token'larına çapraz katılım sağlayan 32 öğrenilebilir "sorgu" vektörü, LLM'nin tükettiği 32-token görsel özetini üretir. Toplam 188M parametre. LLM'ye hiç dokunmadan önce karşılaştırmalı, eşleştirme ve üretken hedeflerle eğitildi.

## Konsept

### Öğrenilebilir sorgular

Q-Former'ın temel numarası: Yüksek Lisans'ın metin token'lerinin görüntü yamalarıyla ilgilenmesine izin vermek yerine, 32 adet öğrenilebilir sorgu vektörü `Q` içeren yeni bir set tanıtın ve *onların* görüntü yamalarıyla ilgilenmesine izin verin. Sorgular modelin parametreleridir; eğitim sırasında öğrenilirler ve her görüntü için aynı 32 sorgu kullanılır.

Çapraz dikkatin ardından, her sorgu görüntünün sıkıştırılmış bir özetini tutar - "ana nesneyi tanımlayın", "arka planı tanımlayın", "nesneleri sayın" vb. Sorgular tam anlamıyla anlamsal etiketler üzerinde uzmanlaşmaz; downstream kayıplarını azaltan kodlamayı öğrenirler.

### Mimarlık

Q-Former, iki yola sahip küçük bir transformer'dır (12 katman, ~100M parametre):

1. Sorgu yolu: 32 sorgu vektörü self-attention (kendi aralarında) boyunca akar, ardından donmuş ViT'nin token yaması token'lar ve ardından FFN üzerinden çapraz dikkat yoluyla akar.
2. Metin yolu: BERT benzeri bir metin kodlayıcı, self-attention ve FFN ağırlıklarını sorgu yolu ile paylaşır. Metin yolu için çapraz dikkat devre dışı bırakıldı.

Eğitim zamanında her iki yol da çalışır. Sorgular ve metin, paylaşılan öz-dikkat yoluyla etkileşime girer; bu, sorguların, ona ihtiyaç duyan görevler (ITM, ITG) için metni koşullandırabileceği anlamına gelir. VLM aktarımı için inference zamanında, yalnızca sorgular akar ve 32 görsel token elde edilir.

### İki aşamalı eğitim

BLIP-2 iki aşamada ön eğitim alır:

Aşama 1: temsil öğrenimi (LLM yok). Üç kayıp:
- ITC (görüntü-metin karşılaştırmalı): Havuzlanmış sorgu token'lar ile metin CLS token arasındaki CLIP tarzı karşılaştırmalı.
- ITM (resim-metin eşleştirme): ikili sınıflandırıcı — bu resim-metin çifti bir eşleşme mi? Sert-negatif-mayınlı.
- ITG (görüntü temelli metin üretimi): sorgulara bağlı olarak metin üzerinde nedensel LM. Metin tarafından oluşturulabilen içeriği kodlamak için sorguları zorlar.

Yalnızca Q-Former trenleri. ViT donmuş durumda. LLM dahil değil.

Aşama 2: üretken öğrenme. Dondurulmuş bir LLM (OPT-2.7B veya Flan-T5-XL, vb.) ekleyin. 32 sorgu çıkışını küçük bir doğrusal katman aracılığıyla LLM'nin embedding dim'ine yansıtın. Bunları prompt metninin başına ekleyin. Birleştirilmiş prompt + görüntü + altyazı dizisi üzerinde yalnızca doğrusal projeksiyonu ve Q-Former'ı LM kaybı konusunda eğitin.

2. aşamadan sonra Q-Former + projeksiyonu tam görsel adaptör haline gelir. inference konumunda: görüntü → ViT → Q-Former → doğrusal proje → metne eklenmiş → donmuş LLM çıktıyı yayar.

### Parametre ekonomisi

ViT-g/14 (1,1B, dondurulmuş) + OPT-6,7B (6,7B, dondurulmuş) + Q-Former (188M, eğitimli) ile BLIP-2 = toplam 8B, 188M eğitimli. Tek başına Q-Former, tüm yığının parametrelerinin ~%2,4'üdür. Eğitim maliyeti şunu yansıtıyor: Bir avuç A100'de günler, uçtan uca haftalar.

Kalite: BLIP-2, 50 kat daha küçük olmasına rağmen sıfır atışlı VQA'da Flamingo-80B ile eşleşir veya onu yener. Köprü çalışıyor.

### InstructBLIP ve talimatlara duyarlı Q-Former

InstructBLIP (2023), Q-Former'ı ekstra bir girdiyle genişletiyor: talimat metninin kendisi. Çapraz dikkat zamanında, sorgular artık hem görüntü yamalarına hem de talimatlara erişebilir. Sorgular, tek bir sabit özeti öğrenmek yerine talimat başına uzmanlaşabilir ("arabaları say", "ruh halini tanımla"). Uzatılan görevlerde Benchmark kazanç sağlar.

### MiniGPT-4 ve yalnızca projektör yaklaşımı

MiniGPT-4, Q-Former'ı korudu ancak diğer her şeyi dondururken yalnızca çıktı doğrusal projeksiyonunu eğitti. Ucuz, ancak maliyet kalitedir; sorgular BLIP-2'ye aitti, sizinkine değil. Hızlı yineleme için iyi, en iyi mimari değil.

### LLaVA neden daha basit hale geldi?

LLaVA (2023, Ders 12.05), Q-Former'ı, her ViT yamasını token LLM alanına yansıtan düz 2 katmanlı bir MLP ile değiştirdi - 24x24 ızgara için görüntü başına 576 token, tümü LLM'ye beslenir. Daha kötü sıkıştırma ancak LLM'nin ham yamalara katılmasına izin verir. O zamanlar bu tartışmalıydı; 2023'ün sonlarında baskın hale geldi çünkü görsel talimat verileri (LLaVA-Instruct-150k), MLP'nin yeterli sinyali koruyacak şekilde eğitilebileceğini kanıtladı. Takas: LLaVA'nın bağlamı daha hızlı doluyor, ancak doğal olarak çoklu görüntü ve videoya ölçekleniyor.

2026'ya gelindiğinde alan ikiye bölünüyor: Q-Former, token bütçenin önemli olduğu yerlerde (uzun video, birçok resim) varlığını sürdürüyor; MLP projektör, token başına ham kalitenin öncelikli olduğu yerde hakimdir.

### Kapılı çapraz dikkat: Flamingo, atası

Flamingo (Ders 12.04) BLIP-2'den önceydi ve aynı çapraz dikkat fikrini kullandı ancak tek bir köprü olarak değil, her donmuş LLM katmanında. BLIP-2, yalnızca giriş katmanına sıkıştırma yapabileceğinizi ve hala çalışabileceğinizi gösterdi. Gemini ve Idefics her ikisini de birleştirir: aralıklı giriş token'ler artı bağlam içi birkaç çekim için isteğe bağlı kapılı çapraz dikkat.

### 2026'nın soyundan gelenler

- Q-Former: BLIP-2, InstructBLIP, MiniGPT-4 ve token bütçe nedenleriyle çoğu video dili modeli.
- Algılayıcı yeniden örnekleyici: Flamingo'nun varyantı (Ders 12.04); Idefics ailesi, Eagle, OmniMAE.
- MLP projektör: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Kambriyen-1.
- Dikkat havuzu: VILA, PaliGemma.

Dördü de geçerlidir. Karar vermeniz gereken soru, token bütçesiyle mi, yoksa token başına kaliteyle mi sınırlı olduğunuzdur.

## Kullan onu

`code/main.py`, stdlib Q-Former tarzı bir çapraz dikkat oluşturur:

1. 256 görüntü yamasını tokens (dim 128) simüle edin.
2. 32 öğrenilebilir sorguyu (dim 128) başlatın.
3. Ölçeklendirilmiş nokta ürünü çapraz dikkati çalıştırın (sorgulardan Q, yamalardan K/V).
4. Doğrusal bir katman yoluyla LLM-dim'e (512) yansıtın.
5. 32 LLM'ye hazır görsel token'lerin çıktısını alın.

Tüm matematik saf Python'da (vektörler üzerinde iç içe döngüler). Oyuncak ama şekli doğru. Dikkat ağırlığı matrisi yazdırılır, böylece her sorgunun hangi yamalardan alındığını görebilirsiniz.

## Gönderin

Bu ders `outputs/skill-modality-bridge-picker.md` üretir. Hedef VLM yapılandırması (görüntü kodlayıcı token sayısı, LLM bağlam bütçesi, deployment kısıtlamaları, kalite hedefi) verildiğinde, kısa bir gerekçeyle ve her köprü için bir parametre sayısı tahminiyle Q-Former, MLP ve Perceiver yeniden örnekleyicisini önerir.

## Egzersizler

1. PyTorch'ta çapraz dikkat bloğunu uygulayın. 32 sorgu ve 256 anahtar/değer ile dikkat ağırlığı matrisinin 32 x 256 olduğunu ve softmax'tan sonra her satırın toplamının 1 olduğunu doğrulayın.

2. BLIP-2 aşama 1'de Q-Former aynı anda üç kayıpla karşılaşır: ITC, ITM, ITG. Her biri için ileri imzayı sözde kodla yazın. Hangisi metin kodlayıcı yolunun etkin olmasını gerektirir?

3. Parametre sayılarını karşılaştırın: Q-Former (12 katman, 768 gizli) ile 2 katmanlı MLP projektör (1408 → 4096, iki katman). 188M Q-Former'ın maliyeti, eğitim verimliliği açısından hangi LLM ölçeğinde kendini amorti ediyor?

4. Q-Former'ın nasıl başlatıldığına ilişkin BLIP-2 belgesinin (arXiv:2301.12597) Bölüm 3.2'sini okuyun. BERT tabanından başlatmanın (rastgele değil) neden yakınsamayı hızlandırdığını açıklayın.

5. 60 kareye örneklenmiş 1 FPS'de 10 dakikalık bir video için, kare başına token maliyetini (Q-Former → 32 tokens/kare) ve (MLP projektör → 576 tokens/kare) olarak hesaplayın. Hangisi 128k-token LLM context window'ye sığar?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Q-Eski | "transformer sorgulanıyor" | Dondurulmuş ViT özelliklerine çapraz katılım sağlayan 32 öğrenilebilir sorgu vektörüne sahip küçük transformer |
| Öğrenilebilir sorgular | "Görme için yumuşak prompt" | Çapraz dikkatin sorgu tarafı olarak hizmet eden sabit bir parametreler kümesi; model başına öğrenilir, tüm girdilerde paylaşılır |
| Çapraz dikkat | "Q buradan, K/V oradan" | Sorgu, anahtar ve değerin farklı kaynaklardan geldiği yere dikkat edin; sorguların ViT yamalarından nasıl alındığı |
| ITC | "Resim-metin karşılaştırmalı" | Q-Former havuzlanmış sorgularına uygulanan CLIP tarzı kayıp ile metin CLS |
| ITM | "Resim-metin eşleştirme" | Sabit negatif mayınlı çiftlerde ikili sınıflandırıcı; sorguları ince taneli uyumsuzlukları ayırt etmeye zorlar |
| ITG | "Görüntüye dayalı metin oluşturma" | Metnin sorgulara göre oluşturulduğu nedensel LM kaybı; metin kodu çözülebilen içeriği kodlamak için sorguları zorlar |
| İki aşamalı ön eğitim | "Temsil daha sonra üretken" | Aşama 1 yalnızca Q-Former'ı eğitir (ITC/ITM/ITG); Aşama 2 donmuş LLM'yi ekler ve yalnızca projeksiyonu eğitir + Q-Former |
| Dondurulmuş omurga | "Fine-tuning yapmayın" | Görüntü kodlayıcı ve LLM ağırlıkları sabittir; sadece köprü trenleri |
| Projeksiyon kafası | "LLM dim'e Doğrusal" | Q-Former çıktısını LLM'nin embedding boyutuna eşleyen son doğrusal katman |
| Algılayıcı yeniden örnekleyici | "Flamingo'nun versiyonu" | Flamingo tarafından tek bir köprü yerine her katmanda kullanılan benzer öğrenilebilir sorgu çapraz dikkati |

## Daha Fazla Okuma

- [Li ve ark. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) — ana makale.
- [Li ve ark. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) — ITC/ITM/ITG üçlüsünün öncülü.
- [Li ve ark. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) — "sigortadan önce hizala" — 1. aşama eğitiminin kavramsal atası.
- [Dai ve ark. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) — talimatlara duyarlı Q-Former.
- [Zhu ve ark. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) — yalnızca projektör yaklaşımı.
- [Jaegle ve ark. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — öğrenilebilir sorgu çapraz dikkati için genel mimari.
