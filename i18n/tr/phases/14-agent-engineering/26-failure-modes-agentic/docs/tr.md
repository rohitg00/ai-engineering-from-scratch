# Başarısızlık Modları: Neden Ajanlar Ayrılır

> MASFT (Berkeley, 2025) 3 kategoride 14 çoklu ajan başarısızlık modunu kataloglar. Microsoft Taksonomi, mevcut AI başarısızlıklarının ajan ayarlarında nasıl güçlendirdiğini belgelendirir. Endüstri alanı verileri beş tekrarlayan modda birleşti: halüsinasyonlu eylemler, kapsam sürüklenmesi, kaskad hatalar, bağlam kaybı, araç kötüye kullanımı.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- MASFT'nin üç başarısızlık kategorisini ve her birinde en az dört özel modunu belirtin.
- Ajantik başarısızlığın mevcut AI başarısızlık modlarını (bias, halüsinasyon) neden güçlendirdiğini açıklayın.
- Endüstriye sık sık rastlanan beş mod ve onların hafiflemelerini açıklayın.
- Ajanı etiketlenen bir stdlib dedektörü uygulamak başarısızlık modunun etiketleri ile izler.

## Sorun

Takımlar, izlerin %90'ında çalışan ajanları gönderir. %10'luk hatalar rastgele gürültü değildir  küçük sayıda tekrarlayan kategorilere düşer.

## Anlaşım

### MASFT (Berkeley, arXiv:2503.13657)

Çoklu ajan sistem başarısızlık taksonomisi. 14 başarısızlık modunun 3 kategoride gruplandırılması.

Merkez iddiası: Eksiklikler, çoklu ajan sistemlerinde temel tasarım hatalarıdır, daha iyi temel modellerle düzeltilmesi gereken LLM sınırlamaları değildir.

### Microsoft Taksonomiyi Ajantik AI Sistemlerinde Başarısızlık Modu

- Mevcut AI başarısızlıkları (bias, halüsinasyon, veri sızması) ajantik ayarlarda güçlenir.
- Otonomiden yeni başarısızlıklar ortaya çıkıyor: ölçekte niyetlenmeyen eylemler, araçların kötüye kullanımı, görev sürüşü.
- Beyaz kağıt, ajan ürünleri için risk kayıtlarıdır.

### Agentic AI'de Karakterizasyon Hataları (arXiv:2603.06847)

- Başarısızlıklar orkestrasyon, iç durum evrimleri ve çevre etkileşiminden kaynaklanır.
- Sadece "kötü kod" veya "kötü model çıkışı" değil.

### LLM Ajan Halüsinasyonları Araştırması (arXiv:2509.18970)

İki ana gösterim:

1. **Instruction-following Deviation**- Ajan sistem uyarısını takip etmiyor.
2. **Long-range Contextual Misuse** ajan önceki dönüşlerden bağlamı unuttu veya yanlış uyguladı.

Alt amaçlı hatalar: Uyum (uysamadığı adım), Kayıp (sıradan yapılan adım), Bozukluk (sıradan çıkmış adımlar).

### Endüstriye yönelik beş düzenleme modusu

Arize, Galileo, NimbleBrain 2024-2026 alan analizleri aşağıdaki konular üzerinde birleşti:

1. **Hallucinated actions.**Ajan var olmayan bir aracı çağırır ya da argüman uydururururur.
2. **Scope creep.**Ajan, görevleri kullanıcının isteklerinin ötesine çıkarır (daha fazladan PR oluşturur, ek e-posta gönderir).
3. **Cascading errors.**Bir yanlış çağrı aşağı akıntılı etkiler tetikler. Hayalet SKU halüsinasyonu dört API çağrısı  bir çok sistem olayı tetikler.
4. **Context loss.**Uzun vadede yapılacak işler erken dönüş kısıtlamalarını unutur.
5. **Tool misuse.**Yanlış argümanlar ile doğru aracı çağırır, ya da tamamen yanlış aracı.

Ajanlar "Başarısız oldum" ve "iş imkansız" arasındaki farkı göremiyorlar ve genellikle bu döngüyü kapatmak için 400 hata üzerine bir başarı mesajı halüsinasyonlarına getiriyorlar.

### Yumuşak başlılık: her adımda kapılar

Bir akıl zincirinin her aşamasında otomatik doğrulama kapıları, gerçeklerin çevre durumuna karşı yerleştirilmesini kontrol eder.

- Adımlık güvenlik sınıflandırması (Denevi 21).
- Araç çağrısı argümanlarının doğrulanması (Deneyim 06).
- Alınan içeriği bilinen gerçeklerle karşılaştır (ÇOK 05, KRITİK).
- Başarılı halüsinasyonları yeniden deneme durumundan tespit edin (dosya gerçekten oluşturuldu mu?).

### Başarısızlıkların denetimi yanlış gittiği yerlerde

- **Tagging only crashes.**Çoğu ajan başarısızlığı geçerli görünümlü bir çıkış üretir.
- **No baseline.**Akıntı algılama son bilinen iyi bir şeye ihtiyaç duyar; olmadan "bu daha da kötüye gidiyor" demezsiniz.
- **Over-alerting.**Her başarısızlık bir sayfa oluşturur.

```figure
failure-cascade
```

## Yapın

`code/main.py`stdlib başarısızlık modunun etiketini uyguluyor:

- Beş modı kapsayan sentetik bir iz verisi kümesi.
- Detektor fonksiyonları mod başına (alıcı çağrılarında imzalı kalıplar, çıkışlar, tekrarlı eylemler).
- Her izini etiketleyen ve mod dağıtımını bildiren bir etiket.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Üretim: iz başına etiketler + toplu dağılım, Phoenix'in iz kümesi yüzeylerinin ucuz bir çoğaltımı.

## Kullan

- **Phoenix**üretim sürükleme gruplamaları için (Desin 24).
- **Langfuse**Oturum tekrarlaması + notlama için.
- **Custom**Görülebilirlik platformu alanı özel imzalar için algılayamaz.

## Gönder

`outputs/skill-failure-detector.md`Alanınıza göre uyarlanmış, izleme mağazasına bağlanmış, başarısızlık modunun algılayıcılarını üretir.

## Egzersizler

1. "Başarılı halüsinasyon" için bir detektör ekleyin: ajan başarıyı iade eder, ama hedef durum değişmez.
2. Yaptığın bir ürünün 100 gerçek izini etiketle. Hangi mod hakim?
3. "Kaskad radyüsü" ölçüsünü uygulayın: N adımdaki bir başarısızlığı göz önünde bulundurarak, aşağıdaki kaç adım etkiledi?
4. MASFT'in 14 başarısızlık modunu okuyun, ürününüz için geçerli olan üç tane seçin.
5. Bir detektörü bir CI görevine bağlayın: bir modun etiketi olarak izlerin %5'i üzerindeyse yapılamayı başarısız edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley 14-mode categorization |
| Cascading error | "Ripple failure" | One early mistake propagates through N steps |
| Context loss | "Forgot the constraint" | Long-horizon turn drops early-turn facts |
| Tool misuse | "Wrong tool / wrong args" | Valid call, wrong invocation |
| Success hallucination | "Faked completion" | Agent claims success on a 400; state unchanged |
| Scope creep | "Overreach" | Agent does more than asked |
| Instruction-following deviation | "Disobedience" | Ignores system prompt or user constraint |
| Sub-intention errors | "Plan bugs" | Omission, redundancy, disorder in plan execution |

## Daha Fazla Okumak

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) 14 başarısızlık modusu, 3 kategori
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) Risk kayıtları
- [Arize Phoenix](https://docs.arize.com/phoenix) Drift gruplama uygulamasında
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) daha basit desenler modlardan tamamen kaçındığında
