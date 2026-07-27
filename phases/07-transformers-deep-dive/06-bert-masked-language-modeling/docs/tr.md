# BERT — Maskeli Dil Modellemesi

> GPT bir sonraki kelimeyi tahmin eder. BERT eksik bir kelimeyi tahmin eder. Bir cümle farklılık — ve her şeyin yarım on yılı embedding şeklinde.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 05 (Tam Transformer), Aşama 5 · 02 (Metin Gösterimi)
**Süre:** ~45 dakika

## Sorun

2018'de her NLP görevi (duyarlılık, NER, QA, gereklilik) kendi etiketli verileri üzerinde kendi modelini sıfırdan eğitti. İnce ayar yapabileceğiniz önceden eğitilmiş bir "İngilizce anlama" kontrol noktası yoktu. ELMo (2018), bağlamsal embedding'leri çift yönlü bir LSTM ile önceden eğitebileceğinizi gösterdi; yardımcı oldu ama genelleme yapmadı.

BERT (Devlin ve diğerleri 2018) şunu sordu: Bir transformer kodlayıcı alıp onu internetteki her cümle için eğitsek ve onu her iki taraftaki bağlamdan eksik kelimeleri tahmin etmeye zorlasak ne olur? Daha sonra bir kafanın aşağı yöndeki görevine ince ayar yaparsınız. Parametre verimliliği bir keşifti.

Sonuç: 18 ay içinde BERT ve çeşitleri (RoBERTa, ALBERT, ELECTRA) var olan tüm NLP skor tablolarına hakim oldu. 2020 yılına gelindiğinde dünyadaki her arama motoru, içerik denetleme hattı ve anlamsal arama sisteminin içinde bir BERT vardı.

2026'da yalnızca kodlayıcılı modeller sınıflandırma, erişim ve yapılandırılmış çıkarma için hala doğru araçtır; kod çözücülere göre token başına 5-10 kat daha hızlı çalışırlar ve embedding'leri her modern erişim yığınının omurgasıdır. ModernBERT (Aralık 2024), Flash Attention + RoPE + GeGLU ile mimariyi 8K bağlamına taşıdı.

## Konsept

![Maskeli dil modelleme: token'ları seç, maskele, orijinalleri tahmin et](../assets/bert-mlm.svg)

### Eğitim sinyali

Bir cümle al: `the quick brown fox jumps over the lazy dog`.

token'ların %15'ini rastgele maskele:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Modeli, maskelenmiş konumlardaki orijinal token'ları tahmin edecek şekilde eğitin. Kodlayıcı çift yönlü olduğundan, 1. konumdaki `[MASK]`'yi tahmin etmek, 2+ konumlarındaki `brown fox jumps`'yi kullanabilir. GPT'nin yapamayacağı şey budur.

### BERT maskesi kuralları

Tahmin için seçilen token'ların %15'inden:

- %80'i `[MASK]` ile değiştirilir.
- %10'u rastgele bir token ile değiştirilir.
- %10 değişmeden kalır.

Neden her zaman `[MASK]` değil? Çünkü `[MASK]` asla inference zamanında görünmez. Modeli, maskelenmiş konumların %100'ünde `[MASK]` bekleyecek şekilde eğitmek, ön eğitim ile fine-tuning arasında bir dağılım değişikliği yaratacaktır. %10 rastgele + %10 değişmeyen modelin dürüst olmasını sağlar.

### Sonraki Cümle Tahmini (NSP) — ve neden kaldırıldı

Orijinal BERT aynı zamanda NSP konusunda da eğitim almıştır: A ve B olmak üzere iki cümle verildiğinde, B'nin A'yı takip edip etmediğini tahmin edin. RoBERTa (2019) bunu ortadan kaldırdı ve NSP'nin yardım etmediğini, zarar verdiğini gösterdi. Modern kodlayıcılar bunu atlıyor.

### 2026'da neler değişti: ModernBERT

2024 ModernBERT makalesi bloğu 2026 ilkelleriyle yeniden inşa etti:

| Bileşen | Orijinal BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| konumsal | Mutlak öğrenildi | RoPE |
| Aktivasyon | GEL | GeGLU |
| Normalleştirme | Katman Normu | Ön norm RMSNorm |
| Dikkat | Tam yoğun | Alternatif yerel (128) + küresel |
| Bağlam uzunluğu | 512 | 8192 |
| Tokenizer | Kelime Parçası | BPE |

Ve 2018 yığınının aksine, Flash-Attention'da yereldir. Inference, 8K dizi uzunluğunda DeBERTa-v3'e göre 2–3 kat daha hızlıdır ve daha iyi GLUE puanlarına sahiptir.

### 2026'da hâlâ kodlayıcı seçen durumları kullanın

| Görev | Kodlayıcı neden kod çözücüden üstündür |
|------|---------------------------|
| Alma / anlamsal arama embeddings | Çift yönlü bağlam = token başına daha iyi embedding kalitesi |
| Sınıflandırma (duyarlılık, niyet, toksisite) | Bir ileri pas; üretim yükü yok |
| NER / token etiketleme | Pozisyon başına çıktı, doğal olarak çift yönlü |
| Sıfır atış zorunluluğu (NLI) | Kodlayıcının üstünde sınıflandırıcı kafası |
| RAG için yeniden sıralama | Kodlayıcılar arası puanlama, LLM yeniden sıralamalarından 10 kat daha hızlı |

```figure
transformer-residual
```

## Build It — Kendin Oluştur

### Adım 1: maskeleme mantığı

Bkz. `code/main.py`. `create_mlm_batch` işlevi, token kimliklerinin bir listesini, sözcük boyutunu ve maske olasılığını alır. Giriş kimliklerini (maskeler uygulanmış halde) ve etiketleri (yalnızca maskelenmiş konumlarda, başka yerlerde -100 - PyTorch'un yoksayma dizin kuralı) döndürür.

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Adım 2: MLM tahminini küçük bir derlemede çalıştırın

2 katmanlı kodlayıcı + MLM kafasını 20 kelime ve 200 cümleden oluşan bir kelime dağarcığıyla eğitin. Hayır gradient — ileri geçiş akıl sağlığı kontrolleri yapıyoruz. Tam eğitim PyTorch'a ihtiyaç duyar.

### 3. Adım: maske türlerini karşılaştırın

Üç yol kuralının modeli `[MASK]` olmadan nasıl kullanılabilir durumda tuttuğunu gösterin. Maskelenmemiş bir cümle ve maskelenmiş bir cümle hakkında tahminde bulunun. Her ikisi de makul token dağılımları üretmelidir çünkü model eğitimde her iki modeli de görmüştür.

### Adım 4: kafaya ince ayar yapın

MLM kafasını oyuncak duyarlılığı dataset üzerindeki sınıflandırma başlığıyla değiştirin. Yalnızca kafa trenleri; kodlayıcı donmuştur. Bu, her BERT uygulamasının takip ettiği modeldir.

## Use It — Uygula

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding modelleri ince ayarlı BERT'lerdir.** `all-MiniLM-L6-v2` gibi `sentence-transformers` modelleri karşılaştırmalı kayıpla eğitilmiş BERT'lerdir. Kodlayıcı aynıdır. Kayıp değişti.

**Kodlayıcılar arası yeniden sıralamalar da ince ayarlı BERT'tir.** `[CLS] query [SEP] doc [SEP]` üzerinde çift sınıflandırma. Sorgu ve belge arasındaki çift yönlü dikkat, tam olarak çapraz kodlayıcılara çift kodlayıcılara göre kalite avantajı sağlayan şeydir.

**2026'da BERT'i ne zaman seçmemelisiniz.** Üretken olan her şey. Kodlayıcının otomatik regresif olarak token'ları üretmenin mantıklı bir yolu yoktur. Ayrıca: küçük bir kod çözücünün kaliteyi daha fazla esneklikle eşleştirebildiği 1B parametrelerinin altındaki her şey (Phi-3-Mini, Qwen2-1.5B).

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-bert-finetuner.md`. Beceri, yeni bir sınıflandırma veya çıkarma görevi için BERT ince ayarını (omurga seçimi, kafa spesifikasyonu, veri, değerlendirme, durdurma) kapsar.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın ve 10.000 token saniye boyunca maske dağılımını yazdırın. ~%15'in seçildiğini ve bunların ~%80'inin `[MASK]` olduğunu onaylayın.
2. **Orta.** Tam kelime maskelemeyi uygulayın: eğer bir kelime alt kelimelere tokenözelleştirilmişse, tüm alt kelimeleri birlikte maskeleyin veya hiçbirini maskeleyin. Bunun 500 cümlelik bir külliyatta MLM doğruluğunu iyileştirip iyileştirmediğini ölçün.
3. **Zor.** Küçük (2 katmanlı, d=64) bir BERT'i herkese açık bir dataset'dan 10.000 cümle üzerinde eğitin. SST-2 duyarlılığı için `[CLS]` token'ye ince ayar yapın. Eşleşen parametrelerde yalnızca kod çözücünün temel çizgisiyle karşılaştırın; hangisi kazanır?

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| MLM | "Maskeli dil modelleme" | Eğitim sinyali: token'ların %15'ini rastgele `[MASK]` ile değiştirin, orijinalleri tahmin edin. |
| Çift Yönlü | "Her iki yönde de görünüyor" | Kodlayıcının dikkatinin nedensellik maskesi yoktur; her konum diğer tüm konumları görür. |
| `[CLS]` | "Havuzcu token" | Her dizinin başına özel bir token eklenir; son embedding cümle düzeyinde temsil olarak kullanılır. |
| `[SEP]` | "Bölüm ayırıcı" | Eşleştirilmiş dizileri ayırır (e.g. query/doc, cümle A/B). |
| NSP | "Sonraki cümle tahmini" | BERT'in ikinci ön eğitim görevi; RoBERTa'da işe yaramaz olduğu görüldü, 2019'dan sonra kaldırıldı. |
| Fine-tuning | "Bir göreve uyum sağlayın" | Kodlayıcıyı çoğunlukla donmuş halde tutun; aşağı yöndeki görev için üstüne küçük bir kafa eğitin. |
| Çapraz kodlayıcı | "Yeniden sıralama" | Hem sorguyu hem de belgeyi girdi olarak alan bir BERT, bir alaka puanı verir. |
| ModernBERT | "2024 yenilemesi" | Kodlayıcı, RoPE, RMSNorm, GeGLU, alternatif yerel/küresel dikkat ve 8K bağlamı ile yeniden oluşturuldu. |

## Daha Fazla Okuma

- [Devlin ve ark. (2018). BERT: Dil Anlamak için Derin Çift Yönlü Transformer'lerin Ön Eğitimi](https://arxiv.org/abs/1810.04805) — orijinal makale.
- [Liu ve ark. (2019). RoBERTa: Sağlam Şekilde Optimize Edilmiş BERT Eğitim Öncesi Yaklaşımı](https://arxiv.org/abs/1907.11692) — BERT'in doğru şekilde nasıl eğitileceği; NSP'yi öldürür.
- [Clark ve ark. (2020). ELECTRA: Metin Kodlayıcıları Oluşturucular Yerine Ayırıcılar Olarak Ön Eğitmek](https://arxiv.org/abs/2003.10555) — değiştirildi-token algılama, eşleşen hesaplamada MLM'yi geride bırakıyor.
- [Warner ve ark. (2024). Daha Akıllı, Daha İyi, Daha Hızlı, Daha Uzun: Modern Çift Yönlü Kodlayıcı](https://arxiv.org/abs/2412.13663) — ModernBERT makalesi.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) — kurallı kodlayıcı referansı.
