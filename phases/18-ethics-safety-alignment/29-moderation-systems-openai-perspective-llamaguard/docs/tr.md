# Moderasyon Sistemleri — OpenAI, Perspective, Llama Guard

> Üretim denetleme sistemleri, Dersler 12-16'da tanımlanan güvenlik politikalarını işler hale getirir. OpenAI Moderasyon API'si: GPT-4o üzerine kurulu `omni-moderation-latest` (2024), tek çağrıda metin + görselleri sınıflandırır; Çok dilli test setinde önceki versiyona göre %42 daha iyi; yanıt şeması 13 kategori boolean'ı döndürür: taciz, taciz/tehdit, nefret, nefret/tehdit, yasa dışı, yasa dışı/şiddet, kendine zarar verme, kendine zarar verme/niyet, kendine zarar verme/talimatlar, cinsel, cinsel/reşit olmayanlar, şiddet, şiddet/grafik; çoğu geliştirici için ücretsizdir. Katmanlı modeller: Giriş denetimi (oluşturma öncesi), Çıkış denetimi (oluşturma sonrası), Özel denetleme (etki alanı kuralları). Zaman uyumsuz paralel çağrılar gecikmeyi gizler; bayraktaki yer tutucu yanıtları. Llama Guard 3/4 (Ders 16): 14 MLCommons tehlikeleri, Code Interpreter Abuse, 8 dil (v3), çoklu görüntü (v4). Perspective API (Google Jigsaw): moderatör olarak LLM dalgasından önce gelen toksisite puanlaması; öncelikle şiddetli toksisite/hakaret/küfür çeşitleriyle tek boyutlu toksisite; içerik denetleme araştırması için temel. Kullanımdan kaldırılmalar: Azure İçerik Moderatörü Şubat 2024'te kullanımdan kaldırıldı, Şubat 2027'de kullanımdan kaldırıldı ve yerini Azure AI İçerik Güvenliği aldı.

**Tür:** Yapım
**Diller:** Python (stdlib, üç katmanlı denetim donanımı)
**Önkoşullar:** Aşama 18 · 16 (Llama Guard / Garak / PyRIT)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- OpenAI Moderation API'nin kategori sınıflandırmasını ve Llama Guard 3'ün MLCommons setinden ne kadar farklı olduğunu açıklayın.
- Üç denetleme katmanı modelini (giriş, çıkış, özel) açıklayın ve her birinin bir hata modunu adlandırın.
- Perspective API'nin Yüksek Lisans dönemi öncesi temel olarak konumunu ve araştırmada neden kullanılmaya devam ettiğini açıklayın.
- Azure'un kullanımdan kaldırılması zaman çizelgesini belirtin.

## Sorun

12-16. derslerde saldırılar ve savunma araçları anlatılmaktadır. Ders 29, kullanıcıların ürüne dokunduğu yüzeydeki savunmaları operasyonel hale getiren konuşlandırılmış denetleme sistemlerini kapsar. Üç katmanlı desen 2026 varsayılan yapılandırmasıdır.

## Konsept

### OpenAI Moderasyon API'si

`omni-moderation-latest` (2024). GPT-4o üzerine inşa edilmiştir. Tek çağrıda metin + görselleri sınıflandırır. Çoğu geliştirici için ücretsizdir.

Kategoriler (yanıt şemasında 13 boole):
- Taciz, taciz/tehdit
- nefret, nefret/tehdit
- kendine zarar verme, kendine zarar verme/niyet, kendine zarar verme/talimatlar
- cinsel, cinsel/reşit olmayanlar
- şiddet, şiddet/grafik
- yasa dışı, yasa dışı/şiddet içeren

Multimodal destek `violence`, `self-harm` ve `sexual` için geçerlidir ancak `sexual/minors` için geçerli değildir; geri kalanı yalnızca metindir.

`code/main.py` 'daki kod donanımı için, pedagojik basitlik amacıyla `/threatening`, `/intent`, `/instructions` ve `/graphic` alt kategorilerini üst düzey ebeveynlerine daraltıyoruz. Üretim kodu 13 kategorili şemanın tamamını kullanmalıdır.

Çok dilli test setinde önceki nesil denetleme uç noktasına göre %42 daha iyi. Kategori başına puanlar; uygulamalar eşikleri belirler.

### Lama Muhafızı 3/4

Ders 16'da ele alınmıştır. 14 MLCommons tehlike kategorisi (OpenAI'nin 13 yanıt şeması booleanından farklı şekilde düzenlenmiştir). 8 dili destekler (v3). Llama Guard 4 (Nisan 2025) doğal olarak çok modludur, 12B.

OpenAI ve Llama Guard sınıflandırmaları örtüşüyor ancak farklılaşıyor. OpenAI'de geniş bir kategori olarak "yasadışı" vardır; Llama Guard'ın "şiddet içeren suçlar" ve "şiddet içermeyen suçlar" ayrı ayrı vardır. Deployment'nin seçimi politika sınıflandırma uyumuna göre yapılır.

### Perspektif API'si (Google Yapboz)

Yüksek Lisans moderatör dalgasından (2020 öncesi) önce gelen toksisite puanlama sistemi. Kategoriler: ZEHİRLİLİK, ŞİDDETLİ_ZEHİRLİLİK, HAKARET, KÜFÜR, TEHDİT, KİMLİK_SALDIRI. Alt boyut değişkenleriyle birlikte tek boyutlu birincil puan (ZEHİRLİLİK).

API'nin kararlı olması, belgelenmesi ve yıllarca süren kalibrasyon verilerine sahip olması nedeniyle içerik denetimi araştırma temeli olarak yaygın şekilde kullanılır. Modern LLM'ye bitişik kullanım durumları için, Llama Guard veya OpenAI Moderation genellikle daha iyi bir seçimdir.

### Üç katmanlı desen

1. **Giriş denetimi.** Oluşturmadan önce kullanıcının prompt'sini sınıflandırın. İşaretlenmişse reddet. Gecikme: bir sınıflandırıcı çağrısı.
2. **Çıktı denetimi.** Teslimattan önce modelin çıktısını sınıflandırın. İşaretlenmişse ret ile değiştirin. Gecikme: nesilden sonra bir sınıflandırıcı çağrısı.
3. **Özel denetleme.** Etki alanına özgü kurallar (regex, izin verilenler listeleri, iş politikası). Girişte veya çıkışta çalışır.

Üç katman tasarım gereği sıralıdır: Giriş denetiminin üretimden önce tamamlanması gerekir ve çıkış denetimi üretimden sonra çalıştırılır. Paralellik bir katman içinde geçerlidir; aynı metin üzerinde birden fazla sınıflandırıcının (e.g., OpenAI Moderation + Llama Guard + Perspective) eşzamanlı olarak çalıştırılması, sınıflandırıcı başına gecikmeyi gizler. İsteğe bağlı bir optimizasyon olarak, giriş denetimi tamamlanırken ve token-1 akışı ertelenirken bir yer tutucu yanıtı ("bir dakika, kontrol ediliyor...") gösterilebilir. İşaretleme davranışı yapılandırılabilir: Reddet, sterilize et, insan incelemesine ilet.

### Arıza modları

- **Yalnızca giriş.** Çıkış halüsinasyonlarını yakalamaz (Ders 12-14 kodlama saldırıları giriş sınıflandırıcılarını atlar).
- **Yalnızca çıkış.** Herhangi bir girişin modele ulaşmasına izin verir; maliyeti artırır; Saldırganın iç muhakemesini ortaya çıkarır.
- **Yalnızca özel.** Kategoriler arasında sağlam değildir; Regex'ler kırılgandır.

Katmanlı varsayılandır. Kemer ve askılar.

### Azure'un kullanımdan kaldırılması

Azure İçerik Moderatörü: Şubat 2024'te kullanımdan kaldırıldı, Şubat 2027'de kullanımdan kaldırıldı. Onun yerine LLM tabanlı olan ve Azure OpenAI ile entegre olan Azure AI İçerik Güvenliği getirildi. Geçiş, Azure deployment'lar için 2024-2027 alan düzeyinde bir projedir.

### Bunun 18. Aşamada yeri nedir

Ders 16, kırmızı takım bağlamında denetim araçlarının kullanımını kapsamaktadır. Ders 29 dağıtılan denetimi kapsar. Ders 30, mevcut ikili kullanım yeteneği kanıtıyla sona eriyor.

## Use It — Hazır Araçla Uygula

`code/main.py` üç katmanlı bir denetleme donanımı oluşturur: giriş moderatörü (anahtar kelime + kategori puanı), çıktı moderatörü (çıkışta aynı sınıflandırıcı), özel moderatör (etki alanı kuralları). Girişleri çalıştırabilir ve hangi katmanın neyi yakaladığını gözlemleyebilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-moderation-stack.md` üretir. Bir deployment verildiğinde, bir denetleme yığını yapılandırması önerir: girişte hangi sınıflandırıcı, çıktıda hangisi, hangi özel kurallar ve uç durumlar için neyin yargılandığı.

## Egzersizler

1. `code/main.py`'yı çalıştırın. İyi huylu, sınırda ve zararlı bir girdiyi üç katmandan da geçirin. Her biri için hangi katmanın tetiklendiğini bildirin.

2. Belirli bir kategoride Perspektif API tarzı toksisite puanlamasıyla emniyet kemerini genişletin. Eşik davranışını kategori puanıyla karşılaştırın.

3. OpenAI Moderation API belgelerini ve Llama Guard 3 kategori listesini okuyun. Her OpenAI kategorisini en yakın Llama Guard kategorileriyle eşleştirin. Temiz bir şekilde eşlenmeyen üç kategoriyi tanımlayın.

4. Kod asistanı deployment (e.g., GitHub Copilot) için bir denetleme yığını tasarlayın. En çok ve en az alakalı kategorileri belirleyin ve özel kurallar önerin.

5. Azure Content Moderator, Şubat 2027'de kullanımdan kaldırılıyor. Azure AI İçerik Güvenliği'ne geçiş planlayın. Geçişin en yüksek riskli öğesini belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| OpenAI Moderasyon | "çoklu-denetleme-en son" | Kısmi multimodal destekli GPT-4o tabanlı 13 kategorili (metin) sınıflandırıcı |
| Perspektif API'si | "Google Yapboz toksisitesi" | Yüksek Lisans dönemi öncesi toksisite puanlama temeli |
| Lama Muhafızı | "MLCommons 14-kategorisi" | Meta'nın tehlike sınıflandırıcısı (v3: 8B metin, 8 dil; v4: 12B multimodal) |
| Giriş denetimi | "ön üretim filtresi" | Model çağrısından önce prompt kullanıcısındaki sınıflandırıcı |
| Çıktı denetimi | "nesil sonrası filtre" | Teslimattan önce model çıktısına ilişkin sınıflandırıcı |
| Özel denetleme | "etki alanı kuralları" | Deployment-belirli kurallar (regex, izin verilenler listesi, politika) |
| Katmanlı denetleme | "üç katmanın tümü" | Standart üretim deployment modeli |

## Daha Fazla Okuma

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) — çok yönlü denetim uç noktası
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Lama Guard deposu
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — toksisite puanlaması
- [Azure AI İçerik Güvenliği](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure'un değiştirilmesi
