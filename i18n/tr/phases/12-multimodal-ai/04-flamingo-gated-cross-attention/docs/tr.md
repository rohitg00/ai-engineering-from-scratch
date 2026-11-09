# Birkaç VLM için Flamingo ve Kapalı Çaplak Dikkat

> DeepMind's Flamingo (2022) herkesten önce iki şey yaptı. Tek bir modelin, resimlerin, videoların ve metinlerin kendiliğinden birbirine karışmış dizilerini işleyebileceğini gösterdi. Ve VLM'lerin bağlamda öğrendiğini gösterdi  üç örnek (resim, başlık) çiftle birkaç çekim sorgulaması vererek ve model herhangi bir gradient adım olmadan yeni bir resim başlıklı. Mekanizm: donmuş LLM'nin mevcut katmanları arasında yerleştirilen kapalı çapraz dikkat katmanları, sıfırdan başlayan öğrenilmiş bir tanh kapısı ile LLM'nin metin yeteneği başlangıçta korunmaktadır. Bu ders Flamingo'nun Perceiver resampler ve kapalı çapraz dikkat mimarisini izler. Gemini'nin birbirine karışmış girişlerinin ve Idefics2'nin görsel jetonlarının ataları.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Kapalı çapraz dikkatin, donmuş bir LLM'nin tanh(gate) = 0 üzerinden başlangıçta metin yeteneğini nasıl koruduğunu açıklayın.
- Bir Perceiver resampler üzerinden yürüyün: N görüntü yamaları → K sabit "latent" sorular aracılığıyla çapraz dikkat.
- Flamingo'nun, görüntü yerleştirilmesine saygı gösteren sebep maskeli olarak birbirine karışmış görüntü-metin dizilerini nasıl ele aldığını açıklayın.
- Birkaç çekimden oluşan bir multimodal istek yapısını yeniden üretin (3 resim başlık örneği ve ardından bir sorgu görüntüsü).

## Sorun

BLIP-2, 32 görsel tokeni dondurulmuş bir LLM'nin giriş katmanına ekler. Tek istek için bir görüntü için çalışır. Ama ne olacak eğer "böyle bir resim A, başlıklı olsun; işte bir resim B, başlıklı olsun; şimdi bir resim C, başlıklı olsun" gibi metinlerle birbirine karışmış *çok* resimleri beslemek istiyorsanız? LLM'nin kendine özgü dikkatini tek bir akışta görüntü simgelerini ve metin simgelerini ele alması gerekecek ve hangi pozisyonların hangi görüntülere katılabileceği sorusu kargaşa olur.

Flamingo'nun cevabı: LLM'nin giriş akışını hiç değiştirmeyin. Mevcut LLM blokları arasında ek çapraz dikkat katmanları ekleyin. Metin işaretleri her zamanki gibi LLM'nin sebepli öz dikkatini akıttır. LLM blokları arasında, metin tokenleri de yeni kapalı bir katman üzerinden görüntü özelliklerine karşı karşıya gelir. Geçit (sıfır olarak başlangıç yapılır) sıfır adımda yeni katmanların hiç çalışmadığını gösterir. Eğitim ilerledikçe kapı açılır ve görsel bilgi akmaya başlar.

Flamingo ikinci soruya cevap verdi: Bir istek için değişken bir görüntü sayısını (0, 1 veya çok) nasıl ele alırsınız? Bir Perceiver resampler  küçük bir çapraz dikkat modülü, sahip olduğunuz herhangi bir sayıda yama alır ve her görüntü için sabit bir sayıda görsel gizli jeton üretir. Toplam görüntü sayısıyla birlikte büyür, ancak her metin işaretinin yalnızca bir görüntüün gizlilerini okumasına izin verilir. Bu nedenle herhangi bir tek metin işaretinin çapraz ilgi içinde gördüğü şey, isteklendirme sırasında kaç görüntü bulunmasına bakmaksızın aynı şekle sahiptir.

## Anlaşım

### Dondurulmuş LLM

Flamingo, dondurulmuş bir Chinchilla 70B LLM ile başlar. Tüm 70B ağırlıkları dokunmamıştır.

### Algılayıcı resampler

Bu istekle ilgili her görüntü için ViT üretir.$N$- Farkçı resampler'in var.$K$sabit öğrenilme yeteneği (Flamingo kullanıyor $K=64$). Her resampler bloğu iki alt adımdan oluşur:

1. Çelişkili dikkat:$K$$N$Patch tokens (Q latenti, K/V patchlerden).
2. Kendine dikkat + FFN gizlilerde.

6 resampler bloktan sonra, çıkış $K=64$ViT'nin ürettiği kaç tane token olursa olsun, dim 1024'lik görsel tokenler. 224x224 görüntü (196 token) ve 480x480 görüntü (900 token) her ikisi de 64 resampler token olarak çıkıyor.

Video için resampler zamanlı olarak uygulanır: her çerçevenin yamaları 64 laten üretir ve zamanlı konum kodlaması modeli ayırt eder.$t=0$-$t=N$- Tüm videolar $T \cdot 64$Görsel simgeler.

### Çaplaklı dikkat

Her biri arasında .$M$Dondurulmuş LLM katmanları (Flamingo kullanımı $M=4$), yeni kapalı çapraz dikkat blokunu ekler:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha`0'ya initialize edilen öğrenilebilir bir skalar.
- `tanh(0) = 0`, yani init'te kapalı dal sıfır katkı sağlar.
- - Evet .`alpha`sıfırdan uzaklaşırsa, dikkat katkı sorunsuz bir şekilde büyür.
- Geri kalan bağlantı, tamamen açık bir kapının bile LLM'nin metin temsilini üstü yazmaması anlamına gelir; sadece yukarıda görsel bilgi eklenir.

Flamingo'da en önemli tasarım seçeneği bu: görsel kondisyona sahip olmak, başlangıçta eklenir, kapalıdır ve sıfırdır.

### Çelişkili girişler için maskeli çapraz dikkat

"<image A> caption A <image B> caption B <image C> ?" gibi bir istekle, her metin simgesi sırada sadece ondan önce gelen resimleri görmelidir.`t`Sadece resampler simgelerini kullanır `i_t`, nerede `i_t`konumdan önce en son görüntüdür `t`Flamingo, "sonuncu önceki görüntüyü sadece görür" veya "sonraki tüm görüntüleri görür" iki geçerli seçimdir.

### Konekst içi az çekimli öğrenme

Flamingo'nun bir mesajı şöyle görünüyor:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

Model tamamlama kalıbını görür ve "kuş" (veya görüntü 3 gösterdiği her neyse) çıkışları yapar. Gradient adımları yoktur. Dondurulmuş LLM'nin bağlam içi öğrenme yeteneği kapalı çapraz dikkatin üzerinden taşır.

### Eğitim verileri

Flamingo üç veri kümesi üzerine eğitilmiştir:

1. MultiModal MassiveWeb (M3W): 43M web sayfası, birbirine karışmış görüntüler ve metinlerle okuma sırasını yeniden yapılandırır.
2. Resim-Messim Çiftleri: ALIGN (1.8B çift) artı LTIP (312M çift), toplamda yaklaşık 2.1B çift.
3. Video-Text Çiftleri (VTP): 27M kısa video klipi.

OBELICS (2023), Idefics, Idefics2 ve en açık "Flamingo benzeri" modellerin eğitildiği birbirine yapışmış web corpusunun açık bir çoğaltmasıdır.

### OpenFlamingo ve Otter

OpenFlamingo (2023) açık yeniden üretimdir. Arsitektur aynı (Perceiver resampler + donmuş LLaMA veya MPT'de kapalı çapraz dikkat). 3B, 4B, 9B'deki kontrol noktaları. Kalite daha küçük taban LLM ve daha az veri nedeniyle Flamingo'nun geride kalır.

Otter (2023) OpenFlamingo'yu MIMIC-IT'de (mültimodaal talimatların bir veri kümesi) talimat ayarlaması ile inşa eder.

### Soyları

- Idefics / Idefics2 / Idefics3: Hugging Face'ın kapalı çapraz dikkat soyundan, giderek daha basit (Idefics2 uyarlayıcı birleştirme ile doğrudan yama tokenlerinin lehine resampler düşürdü).
- Flamingo-Chameleon geçimi: 2024 yılına kadar birçok ekip erken birleştirmeye (Düşünme 12.11) geçti; omurgan donması gerektiğinde Flamingo tarzı kapalı çapraz dikkat üretiminde kalıyor.
- İkizlerin birbirine karışmış girişleri: kavramsal olarak Flamingo'nun birbirine karışmış biçim esnekliğini miras alır, ancak tam mekanizma mülkiyetlidir.

### BLIP-2 ile karşılaştırma

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | Q-Former once at input | Gated cross-attention at every M layers |
| Visual tokens | 32 per image | 64 per image per cross-attn layer |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — the paper's centerpiece |
| Interleaved inputs | No native support | Yes, the design target |
| Training data | 130M pairs | ~2.1B pairs + 27M video clips + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | Days on 8 A100s | Weeks on thousands of TPUv4 |

Bütçeye göre tek görüntü VQA için BLIP-2'yi seçin.

```figure
cross-attention-fusion
```

## Kullan

`code/main.py`gösterir:

1. 36 sahte patch token'da 8 öğrenilebilir latente (temiz Python çapraz dikkat) bir Perceiver resampler.
2. Kapalı bir çapraz dikkat adımı ile .`alpha = 0`→ çıkış giriş eşit (LLM değişmedi), o zaman `alpha = 2.0`→ görsel katkıda bulunur.
3. "(İs) 1) (metin 1) (İs) 2) (metin 2)" dizisi için 2D dikkat maskasını üreten bir yapışkanlık maskesi yapıştırıcı.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-gated-bridge-diagnostic.md`Açık bir VLM'nin yapılandırmasını (resampler Y/N, çapraz atn frekansı, kapı şeması) göz önüne alındığında, Flamingo soy unsurlarını tanımlar ve dondurma stratejisini açıklar.

## Egzersizler

1. Flamingo-9B'nin görsel parametrelerinin sayısını hesaplayın: 9B LLM + 1.4B kapalı çapraz dikkat katmanları + 64M resampler.

2. Kapalı kalanı uygula `y = tanh(alpha) * cross + x`PyTorch'de deneysel olarak bunu göster.`alpha=0`- Evet .`y==x`Tam olarak başlangıçta.

3. OpenFlamingo Bölümü 3.2 (arXiv:2308.01390) her sorunun farklı bir görüntü sayısına sahip olduğu bir partide birden fazla görüntüyi nasıl işlediği hakkında bilgi ver.

4. Flamingo'nun dikkat çekici maskası neden bir metin simgesini, önceki tüm görüntülerden ziyade * sadece en son* önceki görüntüyü kullanmasına izin verir?

5. Konekst içi birkaç çekim: yeni Flamingo variansı için "image → color of main object" adlı 4 örnekle bir istekle oluşturun. Örnek sayısını 0'dan 8'e kadar değiştirip beklenen doğruluk örneğini açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Perceiver resampler | "Fixed-latent cross-attention" | Module that produces K fixed tokens from a variable number of input patches |
| Gated cross-attention | "Tanh-gated bridge" | Residual layer `y = tanh(alpha)*cross + x`, learnable alpha, init 0 |
| Interleaved input | "Mixed sequence" | Prompt format with images and text mixed freely in reading order |
| Frozen LLM | "No LLM gradients" | The text LLM's weights do not update; only resampler + cross-attn layers train |
| Few-shot | "In-context examples" | Give a few (image, answer) pairs in the prompt; model generalizes without finetuning |
| OBELICS | "Interleaved web corpus" | Open dataset of 141M web pages with images and text in reading order |
| Chinchilla | "70B frozen base" | Flamingo's frozen text LLM, from DeepMind's Chinchilla paper |
| Gate schedule | "How alpha moves" | The rate at which the cross-attention gate opens during training |
| Cross-attn frequency | "Every M layers" | How often a gated cross-attention block is inserted; Flamingo uses $M=4$ |
| OpenFlamingo | "Open reproduction" | MosaicML/LAION open checkpoint at 3-9B; architecture-identical to Flamingo |

## Daha Fazla Okumak

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198)- Orijinal kağıt.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) açık üreme.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) birbirine karışmış web corpus.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) genel algılayıcı mimarisi.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) talimat ayarlanmış Flamingo soylu.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) Flamingo yaklaşımının modern basitleştirilmesi.
