# Uzmanlar Karması (MEB)

> Yoğun bir 70B transformer, her token için her parametreyi etkinleştirir. Bir 671B MoE, token başına yalnızca 37B'yi etkinleştirir ve her benchmark'de onu geçer. Seyreklik son on yılın en önemli ölçeklendirme fikridir.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 05 (Tam Transformer), Aşama 7 · 07 (GPT)
**Süre:** ~45 dakika

## Sorun

Yoğun bir transformer'nin inference noktasındaki FLOP'ları parametre sayısına eşittir (ileri geçiş için 2 katı). Yoğun bir modelin ölçeğini büyütün ve her token faturanın tamamını ödesin. 2024 yılına gelindiğinde sınır bilgi işlem duvarına çarpıyordu: anlamlı bir şekilde daha akıllı olmak için token başına katlanarak daha fazla FLOP'a ihtiyacınız vardı.

Uzmanların Karışımı bu bağlantıyı keser. Her FFN'yi `E` bağımsız uzman + token başına `k` uzmanı seçen bir yönlendirici ile değiştirin. Toplam parametreler = `E × FFN_size`. token = `k × FFN_size` başına aktif parametreler. Tipik 2026 yapılandırması: `E=256`, `k=8`. Depolama `E` ile ölçeklenir, hesaplama `k` ile ölçeklenir.

2026 sınırının neredeyse tamamı MoE'den oluşuyor: DeepSeek-V3 (toplam 671B / 37B aktif), Mixtral 8×22B, Qwen2.5-MoE, Llama 4, Kimi K2, gpt-oss. Yapay Analiz'in bağımsız sıralamasında ilk 10 açık kaynaklı modelin tamamı MoE'dir.

## Konsept

![MoE katmanı: yönlendirici, token](../assets/moe.svg) başına k adet E uzmanı seçer

### FFN değişimi

Yoğun transformer bloğu:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MEB bloğu:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

Her uzman bağımsız bir FFN'dir (tipik olarak SwiGLU). Yönlendirici tek bir doğrusal katmandır. Her token kendi `k` uzmanını seçer ve çıktılarının kapalı bir karışımını alır.

### Yük dengeleme sorunu

Yönlendirici, token'ların %90'ını uzman 3'e geçirirse, diğer uzmanlar açlıktan ölür. Üç düzeltme denendi:

1. **Yardımcı yük dengeleme kaybı** (Anahtar Transformer, Mixtral). Uzman kullanımındaki varyansa orantılı bir ceza ekleyin. Çalışır, ancak bir hiperparametre ve ikinci bir gradient sinyali ekler.
2. **Uzman kapasitesi + token düşüşü** (erken Geçiş). Her uzman en fazla `C × N/E` tokens'yi işler; taşma tokens katmanı atlar. Kaliteye zarar verir.
3. **Yardımcı kayıpsız dengeleme** (DeepSeek-V3). Yönlendiricinin en üstteki seçimini değiştiren, uzman başına öğrenilmiş bir önyargı ekleyin. Bias, eğitim kaybı dışında güncellenir. Ana kalede penaltı yok. 2024'ün büyük kilidi.

DeepSeek-V3'ün yaklaşımı: Her eğitim adımından sonra her uzman için kullanımının hedefin üstünde mi yoksa altında mı olduğunu kontrol edin. Sapmayı `±γ` kadar dürt. Seçimde `scores + bias` kullanılır. Geçitleme için kullanılan uzman olasılıkları ham `scores` değişmeden kalır. Yönlendirmeyi ifadeden ayırır.

### Paylaşılan uzmanlar

DeepSeek-V2/V3 ayrıca uzmanları *paylaşılan* ve *yönlendirilen* olarak ikiye ayırır. Her token, tüm paylaşılan uzmanlardan geçer. Yönlendirilen uzmanlar top-k aracılığıyla seçilir. Paylaşılan uzmanlar ortak bilgiyi yakalar; yönlendirilmiş uzmanlar uzmanlaşır. V3, 1 paylaşılan uzmanın yanı sıra 256 yönlendirmeden ilk 8'ini çalıştırır.

### İnce taneli uzmanlar

Klasik MoE (GShard, Switch): Her uzman tam bir FFN kadar geniştir. `E` küçüktür (8–64), `k` küçüktür (1–2).

Modern ince taneli MoE (DeepSeek-V3, Qwen-MoE): her uzman daha dardır (1/8 FFN boyutu). `E` büyüktür (256+), `k` daha büyüktür (8+). Toplam parametreler aynı ancak kombinasyonlar çok daha hızlı ölçekleniyor. token başına `C(256, 8) = 400 trillion` olası "uzman". Kalite artar, gecikme sabit kalır.

### Maliyet profili

token başına, katman başına:

| Yapılandırma | Aktif parametreler / token | Toplam parametreler |
|--------|-----------------------|--------------|
| Karışımtral 8×22B | ~39B | 141B |
| Llama 3 70B (yoğun) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MEB) | ~32B | 1T |

DeepSeek-V3, **token** başına daha az aktif FLOP yaparken hemen hemen her benchmark'da Llama 3 70B'yi (yoğun) yener. Daha fazla parametre = daha fazla bilgi. Daha aktif FLOP'lar = token başına daha fazla işlem. MEB bunları ayırıyor.

### Önemli nokta: hafıza

Hangisinin ateşlendiğine bakılmaksızın tüm uzmanlar GPU'da yaşar. 671B modelinin FP16 ağırlıkları için ~1,3 TB VRAM'e ihtiyacı vardır. Sınır MoE deployment uzman paralelliği gerektirir - GPU'lar genelinde parça uzmanları, ağ genelinde token'leri yönlendirir. Gecikmeye matmul değil, hepsine iletişim hakimdir.

## Build It — Kendin Oluştur

Bkz. `code/main.py`. Saf stdlib'de aşağıdakilere sahip kompakt bir MoE katmanı:

- `n_experts=8` SwiGLU benzeri uzmanlar (gösterim amacıyla her biri bir doğrusal)
- top-k=2 yönlendirme
- softmax ile normalize edilmiş geçit ağırlıkları
- uzman başına önyargı yoluyla yardımcı kayıpsız dengeleme

### Adım 1: Yönlendirici

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

Önyargı kapı ağırlığını değil seçimi etkiler. DeepSeek-V3'ün püf noktası budur; önyargı, modelin tahminlerini yönlendirmeden yük dengesizliğini düzeltir.

### Adım 2: yönlendirici üzerinden 100 tokens çalıştırın

Hangi uzmanların ne sıklıkta ateş açtığını takip edin. Önyargı olmadan kullanım çarpıktır. Önyargı güncelleme döngüsüyle (aşırı kullanılan uzmanlar için `-γ`, az kullanılan uzmanlar için `+γ`), kullanım birkaç yinelemede tekdüze bir dağılıma yakınsar.

### Adım 3: parametre sayısı karşılaştırması

Bir MoE yapılandırmasının "yoğun eşdeğerini" yazdırın. DeepSeek-V3 şeklinde: 256 yönlendirilmiş + 1 paylaşılan, 8 aktif, d_model=7168. Toplam parametre sayısı göz yaşartıcıdır. Aktif sayı, yoğun bir Llama 3 70B'nin yedide biridir.

## Use It — Uygula

HuggingFace yükleme:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 üretimi inference: vLLM, MoE yönlendirmesini yerel olarak destekler. SGLang en hızlı uzman-paralel yola sahiptir. Her ikisi de otomatik olarak en iyi seçimi ve uzman paralelliğini yönetir.

**MoE ne zaman seçilmelidir:**
- token başına daha düşük inference maliyetle sınır kalitesini istiyorsunuz.
- VRAM/uzman-paralel altyapıya sahipsiniz.
- İş yükünüz token ağırlıklı (sohbet, kod), içerik ağırlıklı değil (uzun dokümanlar).

**MoE ne zaman seçilmemelidir:**
- Edge deployment — herhangi bir aktif FLOP için depolama alanının tamamını ödersiniz.
- Gecikme açısından kritik tek kullanıcılı hizmet — uzman yönlendirme ek yük getirir.
- Küçük modeller (<7B) — MoE'nin kalite avantajı yalnızca bir hesaplama eşiğinin (~6B aktif parametreler) üzerinde görünür.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-moe-configurator.md`. Beceri, yeni bir MoE tarafından verilen parametre bütçesi, eğitim token'leri ve deployment hedefi için E, k ve paylaşılan uzman düzenini seçer.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. Yardımcı kayıpsız önyargı güncellemesinin, 50 yineleme boyunca uzman kullanımını nasıl eşitlediğini izleyin.
2. **Orta.** Öğrenilen yönlendiriciyi karma tabanlı bir yönlendiriciyle değiştirin (deterministik, öğrenme yok). Kaliteyi ve dengeyi karşılaştırın. Öğrenilen yönlendirici neden daha iyi?
3. **Zor.** GRPO tarzı "kullanıma uygun yönlendirme" uygulayın (DeepSeek-V3.2 hilesi): inference sırasında hangi uzmanların ateşlendiğini günlüğe kaydedin, gradient hesaplaması sırasında aynı yönlendirmeyi zorlayın. Bir oyuncak politikası-gradient kurulumu üzerindeki etkiyi ölçün.

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Uzman | "Birçok FFN'den biri" | Bağımsız bir ileri besleme ağı; FFN hesaplamasının seyrek bir dilimine ayrılmış parametreler. |
| Yönlendirici | "Kapı" | Her uzmana karşı her token'yi puanlayan küçük doğrusal bir katman; üst-k seçimi. |
| En iyi yönlendirme | "token başına k aktif uzman" | Her token'nin FFN hesaplaması, kapıya göre ağırlıklandırılmış tam olarak k uzmandan geçer. |
| Yardımcı kayıp | "Yük dengesi cezası" | Çarpık uzman kullanımını cezalandıran ekstra kayıp terimi. |
| Yardımcı kayıpsız | "DeepSeek-V3'ün numarası" | Yalnızca yönlendiricinin seçiminde uzman başına önyargı yoluyla denge; fazladan gradient yok. |
| Paylaşılan uzman | "Her zaman açık" | Her token'nin içinden geçtiği ekstra uzman; ortak bilgiyi yakalar. |
| Uzman paralelliği | "Uzman tarafından parça" | Farklı uzmanları farklı GPU'lara dağıtın; token'ları ağ üzerinden yönlendir. |
| seyreklik | "Etkin parametreler < toplam parametreler" | Oran `k × expert_size / (E × expert_size)`; 37/671 ≈ DeepSeek-V3 için %5,5. |

## Daha Fazla Okuma

- [Shazeer ve ark. (2017). Aşırı Büyük Neural Network'ler: Seyrek Kapılı Uzmanlar Karması Katmanı](https://arxiv.org/abs/1701.06538) — fikir.
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Basit ve Verimli Seyreklik ile Trilyon Parametre Modellerine Ölçeklendirme](https://arxiv.org/abs/2101.03961) — Switch, klasik MoE.
- [Jiang ve ark. (2024). Uzmanların Karışımı](https://arxiv.org/abs/2401.04088) — Karışımtral 8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Teknik Raporu](https://arxiv.org/abs/2412.19437) — MLA + yardımcı kayıpsız MoE + MTP.
- [Wang ve ark. (2024). Uzman Karması için Yardımcı Kayıpsız Yük Dengeleme Stratejisi](https://arxiv.org/abs/2408.15664) — önyargıya dayalı dengeleme kağıdı.
- [Dai ve ark. (2024). DeepSeekMoE: Uzmanların Karma Dil Modellerinde Üstün Uzman Uzmanlığına Doğru](https://arxiv.org/abs/2401.06066) — bu dersin yönlendiricisinin kullandığı ayrıntılı + paylaşımlı uzman ayrımı.
- [Kim ve ark. (2022). DeepSpeed-MoE: Gelişmiş Uzman Karması Inference ve Eğitim](https://arxiv.org/abs/2201.05596) — orijinal, paylaşılan uzman makalesi.
