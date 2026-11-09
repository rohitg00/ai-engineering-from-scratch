# CLIP'den BLIP-2'ye  Modalite Köprüsü olarak Q-Former

> CLIP, resim ve metni bir arada tutar, ancak başlıkları oluşturamaz, soruları cevaplayamaz veya bir sohbet yapamaz. BLIP-2 (Salesforce, 2023) bunu küçük bir eğitimli köprü ile çözdü: 32 öğrenilebilir sorgu vektörü, dondurulmuş bir ViT'nin özelliklerini çapraz dikkat yoluyla takip ederek, sonra dondurulmuş bir LLM'nin giriş akışına doğrudan yerleştirir. 188M köprü parametresi bir ViT-g/14'i 11B Flan-T5-XXL kadar büyük dondurulmuş LLM'lere bağladı. 2026 yılına kadar her adaptör tabanlı VLM  MiniGPT-4, InstructBLIP, LLaVA'nın kuzenleri  bir soylu. Bu ders, Q-Former'ın mimarisini okuyor, iki aşamalı eğitimini açıklıyor ve donmuş bir metin dekodere görsel jetonları besleyen bir oyuncak versiyonu oluşturur.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Dondurulmuş bir görme kodlayıcı ile dondurulmuş LLM arasındaki eğitimlenebilir bir boğazın maliyet ve istikrar konusunda son-son düzeltmeyi neden yendiğini açıklayın.
- Dış görüntü özelliklerine göre öğrenilebilir sorguların sabit bir kümesi uygulanmış bir çapraz dikkat bloğu uygulanmalıdır.
- BLIP-2'nin iki aşamalı öncesi antrenmanını geçin: temsil (ITC + ITM + ITG) sonra üreticidir (dondurulmuş dekodör ile LM kaybı).
- Q-Former'ı LLaVA'da kullanılan basit MLP projeksiyonu ile karşılaştırın ve her seçim ne zaman kazanırsa tartışın.

## Sorun

Bir donmuş ViT'de, görüntü başına 256 parç tokeni üretilir. Dimin 4096'nın token yerleştirmelerini bekleyen donmuş 7B LLM'de bulunur. Açık bir köprü  1408'den 4096'a kadar bir doğrusal katman çalışır, ancak LLM'nin bağlamına tüm 256 parç tokeni eklemek, görüntü başına 256 ekstra tokeni maliyetindedir. 32 görüntüden oluşan bir partiye göre sadece görsel modalite tarafından tüketilen 8192 token.

BLIP-2 sorusu: 256 token resmi temsilini daha az token olarak (sayın 32) sıkıştırıp, LLM'nin resim hakkında başlık, soruları cevaplamak ve mantık yürütmek için yeterli bilgiyi koruyabilir mi? Ve bu köprüyü dondurulmuş omurganlara dokunmadan, eğitim maliyetini köprünün parametrelerine kadar tutabilir mi?

Cevap: Bir Q-Former. 32 öğrenilebilir "sorum" vektörleri, ViT'nin yama tokensine karşı karşıya giderek LLM'nin tükettiği 32 tokenli görsel bir özet üretir. 188M parametreler toplam. LLM'ye dokunmadan önce kontrast, eşleşme ve üretken hedeflerle eğitilmiştir.

## Anlaşım

### Öğrenilme Sorular

Q-Former'ın temel hilesi: LLM'nin metin tokenlerinin görüntü yamalarına bakmasına izin vermek yerine, 32 öğrenilebilir sorgu vektörünün yeni bir seti sunulmalıdır `Q`*Tarifler modelin parametreleridir  eğitim sırasında öğrenildi ve her görüntü için aynı 32 sorgu kullanılır.

Çelişkili dikkatten sonra, her sorgu resmin sıkıştırılmış bir özetini tutar  " ana nesneyi açıklayın", " arka planı açıklayın", " nesneleri sayın" vb. Sorgular kelimenin tam anlamıyla semantik etiketlere odaklanmaz; aşağıdaki kayıpları düşüren her kodlamayı öğrenirler.

### Mimarlık

Q-Former, iki yollu küçük bir transformatördür (12 katman, ~ 100M param)

1. Sorgu yolu: 32 sorgu vektörü kendi kendine (kendileri arasında) akıyor, sonra dondurulmuş ViT'nin yama tokenleri üzerinde çapraz ilgi, sonra FFN.
2. Metin yolu: BERT benzeri bir metin kodlayıcı sorgu yolu ile kendi dikkatini ve FFN ağırlıklarını paylaşır.

Eğitim sırasında her iki yol da çalışır. Sorgular ve metin ortak kendi dikkat yoluyla etkileşim kurar, bu da sorguların metine ihtiyaç duyan görevler için şartlanabileceği anlamına gelir. VLM teslimatı için sonuçlama zamanında, yalnızca sorgular akıyor ve 32 görsel jeton üretir.

### İki aşamalı eğitim

BLIP-2 iki aşamada hazırlanır:

Eğitim aşaması 1: temsilcilik öğrenimi (LLM yok).
- ITC (image-text contrast): Toplanmış sorgu simgelerinin ve metin CLS simgelerinin arasındaki CLIP tarzı kontrast.
- ITM (resim-metin eşleşimi): ikili sınıflandırıcı  bu resim-metin çift eşleşebilir mi?
- ITG (resim tabanlı metin oluşturma): sorgulara bağlı olarak metin üzerine nedençi LM başlığı.

Sadece Q-Former trenleri, ViT dondurulmuş, LLM dahil değil.

2. aşama: üretken öğrenme. Dondurulmuş bir LLM (OPT-2.7B veya Flan-T5-XL, vb.) ekleyin. 32 sorgu çıkışlarını küçük bir doğrusal katman yoluyla LLM'nin gömülme zayıflığına projekte edin. Metin uyarısına hazırlayın. Sadece doğrusal projeksiyonu ve LM kayıpına LM üzerinde tren yapın.

2. aşamaldan sonra, Q-Former + projeksiyon tam görsel adaptördür.

### Parametre ekonomisi

BLIP-2 ViT-g/14 (1.1B, dondurulmuş) + OPT-6.7B (6.7B, dondurulmuş) + Q-Former (188M, eğitilmiş) = 8B toplam, 188M eğitilmiş.

Kalite: BLIP-2 sıfır vQA'da Flamingo-80B'ye eşleşir veya yenir.

### InstructBLIP ve talimatları bilen Q-Former

InstructBLIP (2023) Q-Former'ı ek bir girişle genişletiyor: talimat metni kendisi. Çelişkili dikkat zamanında, sorgular artık hem görüntü yamalarına hem de talimata erişebilir. Sorgular tek sabit bir özet öğrenmek yerine talimat başına uzmanlaşabilen (" arabaları sayın", "ruhiyyeti açıklayın"). Benchmark, tutulan görevlerde kazanç sağlar.

### MiniGPT-4 ve sadece projektorla yaklaşım

MiniGPT-4 Q-Former'i korudu ancak diğer her şeyi dondururken sadece çıkış çizgisi projeksiyonunu eğitdi.

### Neden LLaVA daha basit oldu ?

LLaVA (2023, Ders 12.05) Q-Former'ı, LLM alanına her ViT patch tokenini  576 token / görüntü için 24x24 şebekesi için projekt eden basit 2 katlı MLP ile değiştirdi. Daha kötü sıkıştırma ama LLM'nin incelemesini bırakır. O zamanlar bu tartışmalıydı; 2023'ün sonuna kadar baskınydı çünkü görsel talimat verileri (LLaVA-Instruct-150k) MLP'nin yeterli sinyal korumak için eğitilebileceğini kanıtladı. Tasarım: LLaVA'nın bağlamı daha hızlı dolduruyor, ancak doğal olarak çoklu görüntü ve videoya ölçeklendiriyor.

2026 yılına kadar alan bölünmesi: Q-Former, token bütçesi önemli olan yerlerde hayatta kalır (uzun video, birçok görüntü); MLP projeksiyonu, token başına çiğ kalitenin öncelikli olduğu yerlerde baskınlık yapmaktadır.

### Çapalı dikkat: Flamingo, ata

Flamingo (Denevi 12.04) BLIP-2'den önce aynı çapraz dikkat fikrini kullandı ancak her dondurulmuş LLM katmanında tek bir köprü olarak değil. BLIP-2 sadece giriş katmanına sıkıştırılabileceğini ve hala çalışabileceğini gösterdi. Gemini ve Idefics her ikisini birleştirdi: birbirine karışmış giriş jetonları ve bağlamda birkaç çekim için seçmeli kapalı çapraz dikkat.

### 2026'daki soylular

- Q-Former: BLIP-2, InstructBLIP, MiniGPT-4, ve çoğu video dil modeli token bütçe nedenleri için.
- Algılayıcı resampler: Flamingo'nun varianti (Denevi 12.04); Idefics ailesi, Eagle, OmniMAE.
- MLP projekörü: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Cambrian-1.
- Dikkat havuzu: VILA, PaliGemma.

Dörtü de geçerlidir. Önemli soru, simge bütçesi mi yoksa simge başına kalite mi kısıtlı?

```figure
modality-projection
```

## Kullan

`code/main.py`Stdlib Q-Former tarzı bir çapraz dikkat oluşturur:

1. 256 görüntü yama tokeni (dim 128) simüle edin.
2. 32 öğrenilme sorguyu (dim 128)
3. Skalalı nokta- ürün çaplı dikkatini çalıştırın (Çeviri sorgularından, K/V'den yamalar).
4. Proje ile LLM-dim (512) bir çizgi katman üzerinden.
5. 32 LLM hazır görsel tokeni çıkart.

Tüm matematikler saf Python'da (vektorlar üzerinde yuva döngüleri). Oyuncak ama doğru şekil. Dikkat ağırlığı matrisi basılır, böylece her sorunun hangi yamalardan çekildiğini görebilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-modality-bridge-picker.md`. Hedef bir VLM yapılandırmasını (görünüş kodlayıcı token sayımı, LLM bağlam bütçesi, dağıtım kısıtlamaları, kalite hedefi) göz önüne alındığında, her köprü için kısa bir tembih ve parametreler sayısının tahminini ile Q-Former vs. MLP vs. Perceiver resampler önerir.

## Egzersizler

1. PyTorch'te çapraz dikkat blokunu uygulayın. 32 sorgu ve 256 anahtar/değer ile dikkat ağırlığı matrisinin 32 x 256 olduğunu ve her satırın softmax'den sonra 1'e kadar olduğunu kontrol edin.

2. BLIP-2 aşamasında Q-Former aynı anda üç kayıp yürütür: ITC, ITM, ITG. Her biri için ileriye imza yazın. Hangisi aktif olması için metin kodlayıcı yolunu gerektirir?

3. Parametre sayısını karşılaştırın: Q-Former (12 katman, 768 gizli) vs. 2 katman MLP projeksiyonu (1408 → 4096, iki katman).

4. BLIP-2 makalesinin (arXiv:2301.12597) 3.2. bölümünü okuyun. Q-Former'in nasıl initialize edildiğini açıklayın.

5. 60 çerçeveye kadar örneklenen 1 FPS'de 10 dakikalık bir video için, çerçeve başına token maliyetini (Q-Former → 32 token/frame) vs (MLP projeksiyonu → 576 token/frame) hesaplayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | Small transformer with 32 learnable query vectors that cross-attend to frozen ViT features |
| Learnable queries | "Soft prompt for vision" | A fixed set of parameters that serve as the query side of cross-attention; learned per model, shared across all inputs |
| Cross-attention | "Q from here, K/V from there" | Attention where query, key, and value come from different sources; how the queries pull from ViT patches |
| ITC | "Image-text contrastive" | CLIP-style loss applied to Q-Former pooled queries vs text CLS |
| ITM | "Image-text matching" | Binary classifier on hard-negative-mined pairs; forces the queries to discriminate fine-grained mismatches |
| ITG | "Image-grounded text generation" | Causal LM loss where text is generated conditioned on queries; forces queries to encode text-decodable content |
| Two-stage pretraining | "Representation then generative" | Stage 1 trains Q-Former alone (ITC/ITM/ITG); Stage 2 attaches frozen LLM and trains only the projection + Q-Former |
| Frozen backbone | "Do not finetune" | The vision encoder and LLM weights are fixed; only the bridge trains |
| Projection head | "Linear to LLM dim" | Final linear layer mapping Q-Former output to the LLM's embedding dimension |
| Perceiver resampler | "Flamingo's version" | Similar learnable-query cross-attention; Flamingo runs it once per image to make fixed latents, then reads them through gated cross-attention at every LLM layer |

## Daha Fazla Okumak

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) çekirdek kağıt.
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) ITC/ITM/ITG üçlü ile önceki.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) "Fusadan önce uyum"  1. aşamalı eğitimin kavramsal ataları.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) talimatları bilen Q-Former.
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) Sadece projektorla yaklaşım.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) Öğrenilebilir-soru sorusu çapraz ilgi için genel mimarlık.
