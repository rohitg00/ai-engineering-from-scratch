# ControlNet, LoRA ve Koşullandırma

> Metin tek başına beceriksiz bir kontrol sinyalidir. ControlNet, önceden eğitilmiş bir yayılma modelini klonlamanıza ve bunu bir derinlik haritası, poz iskeleti, karalama veya kenar görüntüsü ile yönlendirmenize olanak tanır. LoRA, 10 milyon parametreyi eğiterek 2B parametreli bir modele ince ayar yapmanızı sağlar. Birlikte Stable Diffusion'u bir oyuncaktan her ajansa gönderilen 2026 imaj hattına dönüştürdüler.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 8 · 07 (Gizli Yayılım), Aşama 10 (Sıfırdan Yüksek Lisans - LoRA temeli için)
**Süre:** ~75 dakika

## Sorun

"Kırmızı elbiseli bir kadın kalabalık bir caddede köpeğini gezdiriyor" gibi bir prompt, modele köpeğin *nerede* olduğu, kadının *hangi pozda* olduğu veya sokağın *perspektifi* hakkında hiçbir bilgi vermez. Metin, bir görseli belirtmek için ihtiyacınız olanın yaklaşık %10'unu belirtir. Gerisi görseldir ve kelimelerle verimli bir şekilde anlatılamaz.

Her sinyal için (poz, derinlik, canny, segmentasyon) sıfırdan yeni bir koşullu modelin eğitilmesi engelleyicidir. 2.6B paramlı SDXL omurgasını donmuş halde tutmak, koşullandırmayı okuyan küçük bir yan ağ eklemek ve omurganın ara özelliklerini dürtmek istiyorsunuz. Bu ControlNet'tir.

Ayrıca modelin tamamını yeniden eğitmeden modele yeni konseptleri (yüzünüz, ürününüz, tarzınız) öğretmek istiyorsunuz. 100 kat daha küçük bir delta istiyorsunuz. Bu, LoRA'dır; mevcut dikkat ağırlıklarına bağlanan düşük dereceli adaptörler.

ControlNet + LoRA + text = 2026 uygulayıcı araç seti. Çoğu üretim görüntüsü ardışık düzeni, bir SDXL / SD3 / Flux tabanının üstüne 2-5 LoRA, 1-3 ControlNet ve bir IP Adaptörü katar.

## Konsept

![ControlNet kodlayıcıyı klonlar; LoRA düşük dereceli deltalar ekler](../assets/controlnet-lora.svg)

### ControlNet (Zhang ve diğerleri, 2023)

Önceden eğitilmiş bir SD alın. U-Net'in kodlayıcı yarısını *klonlayın*. Orijinali dondurun. Ekstra bir koşullandırma girdisini (kenarlar, derinlik, poz) kabul etmesi için klonu eğitin. Klonu, *sıfır evrişim* atlama bağlantılarıyla orijinalin kod çözücü yarısına geri bağlayın (sıfır olarak başlatılan 1×1 dönüşümler — işlemsiz olarak başlayın, bir delta öğrenin).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

Sıfır dönüşümlü başlangıç, ControlNet'in kimlik olarak başladığı anlamına gelir; eğitimden önce bile zararı yoktur. 1M (prompt, durum, görüntü) üzerinde eğitim standart difüzyon kaybıyla üç katına çıkar.

Her modalite için ControlNet'ler küçük yan modeller olarak gönderilir (SDXL için ~360M, SD 1.5 için ~70M). Bunları inference sırasında oluşturabilirsiniz:

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu ve diğerleri, 2021)

Modeldeki herhangi bir doğrusal katman `W ∈ R^{d×d}` için, `W`'yi dondurun ve düşük dereceli bir delta ekleyin:

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

`r << d` ile. Sıralama 4-16 dikkat için standarttır, dereceler 64-128 ağır ince ayarlar için. Yeni parametre sayısı: `d²` yerine `2 · d · r`. `d=640`, `r=16` ile SDXL dikkati için: adaptör başına 410k yerine 20k parametre — 20 kat azalma. Modelin tamamında: LoRA genellikle 20-200 MB, temel 5 GB'tır.

inference'da LoRA'yı ölçeklendirebilirsiniz: `W' = W + α · B @ A`. `α = 0.5-1.5` normaldir. Çoklu LoRA'lar ek olarak istiflenir (doğrusal olmayan şekillerde etkileşime girdikleri yönündeki olağan uyarıyla birlikte).

### IP Adaptörü (Ye ve diğerleri, 2023)

Bir *görüntüyü* koşullandırma olarak (metnin yanında) kabul eden küçük bir bağdaştırıcı. token görüntülerini üretmek için CLIP görüntü kodlayıcıyı kullanır, bunları metin token'lerin yanında çapraz dikkat içine enjekte eder. Temel model başına ~20MB. LoRA olmadan "bu referansın tarzında bir resim oluşturmanızı" sağlar.

## Şekillendirilebilirlik matrisi

| Araç | Neleri kontrol ediyor | Boyut | Ne zaman kullanılır |
|------|------------------|------|-------------|
| ControlNet | Uzamsal yapı (poz, derinlik, kenarlar) | 70-360MB | Tam düzen, kompozisyon |
| LoRA | Stil, konu, konsept | 20-200MB | Kişiselleştirme, stil |
| IP Adaptörü | Referans görselden stil veya konu | 20 MB | Hiçbir metin görünümü tanımlayamaz |
| Metin Ters Çevirme | Yeni bir token olarak tek konsept | 10KB | Eski, çoğunlukla LoRA ile değiştirildi |
| Rüya Kabini | Bir konuya tam ince ayar | 2-5GB | Güçlü kimlik, yüksek bilgi işlem |
| T2I-Adaptör | Daha hafif ControlNet alternatifi | 70MB | Edge cihazları, inference bütçe |

ControlNet ≈ uzaysal. LoRA ≈ anlamsal. Her ikisini de kullanın.

## İnşa Et

`code/main.py` iki mekanizmayı 1 boyutlu olarak simüle eder:

1. **LoRA.** Önceden eğitilmiş bir doğrusal katman `W`. Dondur. Düşük dereceli bir `B @ A`'yi, `W + BA` hedef doğrusal katmanla eşleşecek şekilde eğitin. `r = 1`'nin derece 1 düzeltmesini mükemmel bir şekilde öğrenmek için yeterli olduğunu gösterin.

2. **ControlNet-lite.** Bir "dondurulmuş taban" tahmincisi ve ekstra bir sinyal okuyan bir "yan ağ". Yan ağın çıkışı, sıfıra başlatılan öğrenilebilir bir skaler (sıfır dönüşüm versiyonumuz) tarafından kontrol edilir. Antrenman yapın ve kapının yükselişini izleyin.

### Adım 1: LoRA matematiği

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Adım 2: sıfır başlangıçlı yan ağ

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

Adım 0'da çıkış tabanla aynıdır. Erken eğitim güncellemeleri `gate` yavaş yavaş yapılıyor; felaket niteliğinde bir sapma yok.

## Tuzaklar

- **LoRA'ların aşırı ölçeklendirilmesi.** `α = 2` veya `α = 3`, aşırı stilize / bozuk çıktılar üreten yaygın bir "daha güçlü hale getirme" hack'idir. `α ≤ 1.5`'yi koruyun.
- **ControlNet ağırlık çatışması.** 1,0 ağırlıkta bir Pose ControlNet ve 1,0 ağırlıkta bir Depth ControlNet kullanmak genellikle hedefi aşmaktadır. Ağırlıkların toplamı ≈ 1,0 güvenli bir varsayılandır.
- **LoRA yanlış tabanda.** Dikkat boyutları eşleşmediğinden SDXL LoRA'lar SD 1.5'te sessizce işlem dışıdır. Difüzörler 0,30+ seviyesinde uyarı verecektir.
- **Metni Ters Çevirme sürüklenmesi.** Tokenbir kontrol noktasında eğitilmişler, diğerinde kötü sürükleniyorlar. LoRA daha taşınabilir.
- **LoRA ağırlık birleştirme ve depolama.** Daha hızlı inference (çalışma zamanı eklemesi yok) için temel model ağırlıklarına bir LoRA oluşturabilirsiniz, ancak çalışma zamanında `α` ölçeklendirme yeteneğini kaybedersiniz. Her iki versiyonu da koruyun.

## Kullan onu

| Gol | 2026 boru hattı |
|------|---------------|
| Bir markanın sanat tarzını yeniden üretin | LoRA, 32. sırada ~30 küratörlü görsel üzerinde eğitim aldı |
| Yüzümü oluşturulan görüntüye koy | DreamBooth veya LoRA + IP-Adaptör-FaceID |
| Belirli poz + prompt | ControlNet-Openpose + SDXL + metin |
| Derinliğe duyarlı kompozisyon | ControlNet Derinliği + SD3 |
| Referans + prompt | IP Adaptörü + metin |
| Tam düzen | ControlNet-Scribble veya ControlNet-Canny |
| Arka plan değiştirme | ControlNet-Seg + İç Boyama (Ders 09) |
| Hızlı 1 adımlı stil | SDXL-Turbo'da LCM-LoRA |

## Gönderin

`outputs/skill-sd-toolkit-composer.md`'yi kaydet. Beceri bir görevi alır (girdi varlıkları: prompt, isteğe bağlı referans görüntüsü, isteğe bağlı poz, isteğe bağlı derinlik, isteğe bağlı karalama) ve araç yığınını, ağırlıkları ve tekrarlanabilir bir çekirdek protokolünü çıkarır.

## Egzersizler

1. **Kolay.** `code/main.py`'da, LoRA sıralamasını `r` 1'den 4'e değiştirin. LoRA, hangi sıralamada bir sıralama-2 hedef deltasıyla tam olarak eşleşir?
2. **Orta.** İki hedef dönüşümünde iki ayrı LoRA'yı eğitin. Bunları bir araya yükleyin ve toplamsal etkileşimlerini gösterin. Etkileşim doğrusallığı ne zaman bozar?
3. **Sert** İstiflemek için difüzörleri kullanın: SDXL tabanı + Canny-ControlNet (ağırlık 0,8) + stil LoRA (α 0,8) + IP Adaptörü (ağırlık 0,6). Yığın ağırlıkları değiştikçe FID-prompt-bağlılık dengesini ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| ControlNet | "Uzaysal kontrol" | Klonlanmış kodlayıcı + sıfır dönüşüm atlamaları; bir koşullandırma görüntüsünü okur. |
| Sıfır evrişim | "Kimlik olarak başlar" | 1×1 dönüşüm sıfıra başlatıldı; ControlNet operasyon dışı olarak başlar. |
| LoRA | "Düşük dereceli adaptör" | `W + B @ A`, `r << d`; Tam ince ayardan 100 kat daha az parametre. |
| rütbe r | "Düğme" | LoRA sıkıştırması; 4-16 tipik, 64+ yoğun kişiselleştirme için. |
| α | "LoRA'nın gücü" | LoRA deltasının çalışma zamanı ölçeklendirmesi. |
| IP Adaptörü | "Referans resmi" | CLIP-image tokens aracılığıyla küçük görüntü koşullandırma adaptörü. |
| Rüya Kabini | "Tüm konuya ince ayar" | Tam modeli bir konunun ~30 görüntüsü üzerinde eğitin. |
| Metin Ters Çevirme | "Yeni token" | Yalnızca embedding yeni bir kelime öğrenin; miras, çoğunlukla değiştirildi. |

## Üretim notu: LoRA takasları, ControlNet hatları, çok kiracılı hizmet

Gerçek bir metinden görüntüye SaaS, aynı temel kontrol noktası üzerinden yüzlerce LoRA'ya ve bir düzine ControlNet'e hizmet eder. Sunum sorunu, LLM çoklu kiracılığına çok benziyor (üretim literatürü, sürekli toplu işleme ve LoRAX / S-LoRA kapsamındaki LLM durumunu kapsamaktadır):

- **Çalışırken değiştirilebilir LoRA'lar, birleşmeyin.** `W' = W + α·B·A`'yi tabanla birleştirmek, inference adımı başına ~%3-5 daha hızlı verir, ancak `α`'yi ve tabanı dondurur. LoRA'ları VRAM'de rütbe-r deltaları olarak sıcak tutun; difüzörler istek başına aktivasyon için `pipe.load_lora_weights()` + `pipe.set_adapters([...], adapter_weights=[...])`'yi gösterir. Takas maliyeti `2 · d · r · num_layers` ağırlıktır — MB ölçeğinde, saniyenin altında.
- **İkinci dikkat şeridi olarak ControlNet.** Klonlanan kodlayıcı, tabana paralel olarak çalışır. Her biri 1,0 ağırlığında iki ControlNet = birleştirilmiş bir geçiş değil, adım başına iki ekstra ileri geçiş. Parti boyutu boşluk payı ikinci dereceden düşer. Aktif ControlNet başına ~1,5× adım maliyeti için bütçe.
- **LoRA'lar da kuantize edilmiştir.** Tabanı kuantize ettiyseniz (bkz. Ders 07, 8GB'ta Flux), LoRA deltası da temiz bir şekilde 8 bit veya 4 bit olarak nicelenir. QLoRA tarzı yükleme, belleği boşaltmadan 5-10 LoRA'yı 4 bitlik Flux tabanının üzerine istiflemenize olanak tanır.

Flux'a özgü: Niels'in Flux-on-8GB dizüstü bilgisayarı, tabanı 4 bit olarak nicemler; bir stil LoRA'yı (`pipe.load_lora_weights("user/style-lora")`) o nicelenmiş taban üzerinde `weight_name="pytorch_lora_weights.safetensors"`'da istiflemek hala işe yarıyor. Bu, çoğu SaaS ajansının 2026'da gönderdiği reçetedir.

## Daha Fazla Okuma

- [Zhang, Rao, Agrawala (2023). Metinden Görüntüye Dağıtım Modellerine Koşullu Kontrol Ekleme](https://arxiv.org/abs/2302.05543) — ControlNet.
- [Hu ve ark. (2021). LoRA: Büyük Dil Modellerinin Düşük Sıralı Uyarlanması](https://arxiv.org/abs/2106.09685) — LoRA (başlangıçta Yüksek Lisans'lar için; dağıtıma yönelik bağlantı noktaları).
- [Ye ve ark. (2023). IP Adaptörü: Metin Uyumlu Görüntü Prompt Adapter](https://arxiv.org/abs/2308.06721) — IP Adaptörü.
- [Mou ve ark. (2023). T2I-Adapter: Daha Fazla Kontrol Edilebilir Yeteneği Ortaya Çıkarmak için Öğrenme Adaptörleri](https://arxiv.org/abs/2302.08453) — ControlNet'e daha hafif bir alternatif.
- [Ruiz ve ark. (2023). DreamBooth: Konuya Dayalı Üretim için Metinden Görüntüye Yayılma Modellerinin İnce Ayarı](https://arxiv.org/abs/2208.12242) — DreamBooth.
- [HuggingFace Difüzörleri — ControlNet / LoRA / IP-Adapter belgeleri](https://huggingface.co/docs/diffusers/training/controlnet) — referans ardışık düzenleri.
