# Özenli Sistemler  OpenAI, Perspektif, Llama Guard

> Üretim moderasyon sistemleri, Ders 12-16'da tanımlanan güvenlik politikalarını işlevsel hale getirir. OpenAI Moderation API: `omni-moderation-latest`GPT-4o'ya dayanan (2024) tek çağrıda metin + görüntüleri sınıflandırır; çok dilli test setinde önceki sürümden %42 daha iyi; yanıt şeması 13 kategori boolean  taciz, taciz/ tehdit, nefret, nefret/ tehdit, yasadışı, yasadışı/ şiddeti, kendini incitme, kendini incitme/ niyet, kendini incitme/ talimatlar, cinsel, cinsel/yetime azınlık, şiddet, şiddet/grafik; çoğu geliştiriciler için ücretsizdir. Katlı kalıplar: Giriş moderatörü (önceden üretilen), Çıktı moderatörü (sonraki üretilen), Özel moderatörü (domen kuralları). Async paralel çağrılar gecikmeyi gizler; yer tutucu cevabı giriş moderatörlüğü tamamlanırken beklemeyi kapsayabilir. Llama Guard 3/4 (Denevi 16): 14 MLCommons tehlikeleri, Kod Anlatıcısı İstifadesi, 8 dil (v3), çoklu görüntü (v4). Perspektif API (Google Jigsaw): LLM-moderator dalgasından önceki toksisite puanlaması; öncelikle şiddetli toksisite / hakaret / sövme / sövme çeşitleri ile tek boyutlu toksisite; içeriği modere eden araştırma için temel çizgi. Deprecations: Azure Content Moderator'u Şubat 2024'te iptal etti, Şubat 2027'de emekli oldu ve Azure AI İçerik Güvenliği ile değiştirildi.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, three-layer moderation harness)
**Prerequisites:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- OpenAI Moderation API'nin kategoriler taksonomisi ve Llama Guard 3'ün MLCommons kümesinden nasıl farklı olduğunu açıklayın.
- Üç moderasyon katman örneğini (girme, çıkış, özel) tanımlayın ve her birinin başarısızlık modunun adını verin.
- Perspective API'nin, LLM öncesi bir temel çizgi olarak konumunu ve neden araştırmalarda kullanılmaya devam ettiğini açıklayın.
- Azure'da gerileme zaman çizelgesini belirtin.

## Sorun

Ders 12-16 saldırı ve savunma aletlerini tanımlar. Ders 29 kullanıcıların ürüne dokunduğu yüzeyde savunmayı işlevsel hale getiren dağıtılmış moderasyon sistemlerini kapsar. Üç katlı örnektir 2026 varsayılan yapılandırması.

## Anlaşım

### OpenAI Moderation API

`omni-moderation-latest`(2024). GPT-4o üzerine kurulmuş. Tek çağrıda metin + görüntü sınıflandırır. Çoğu geliştiriciler için ücretsizdir.

Kategorilar (13 cevap şemasındaki boolean):
- taciz, taciz/ tehdit
- nefret, nefret/ tehdit
- Kendine zarar vermek, kendine zarar vermek/niyetlenmek, kendine zarar vermek/ talimatlar
- cinsel, cinsel/kiçik yaşta olanlar
- şiddet, şiddet/grafik
- yasadışı, yasadışı/şiddetli

Multimodal destek `violence`- Evet .`self-harm`ve`sexual`Ama hayır .`sexual/minors`Gerisi sadece metin.

Kod harness için `code/main.py`Biz de yıkıyoruz.`/threatening`- Evet .`/intent`- Evet .`/instructions`ve`/graphic`Üretim kodu 13 kategorinin tamamını kullanmalıdır.

Çok dilli test setinde önceki nesil ölçüm son noktasından %42 daha iyi.

### Llama Gardiyan 3/4

Ders 16. 14 MLCommons tehlike kategorileri kapsamaktadır (OpenAI'nin 13 yanıt-sema boolean'larından farklı olarak düzenlenmiştir). 8 dil (v3). Llama Guard 4 (April 2025) doğuştan multimodal, 12B.

OpenAI ve Llama Guard taksonomileri üst üste gelir ancak farklıdır. OpenAI'nin "yasadışı" olarak geniş bir kategorisi vardır; Llama Guard'ın "şiddetli suçlar" ve "şiddetsiz suçlar" ayrı ayrı vardır.

### Perspective API (Google Jigsaw)

TÜSİLEM-Moderator dalgasından önceki toksisite puanlama sistemi (2020 yılına kadar). Kategori: TOXİK, SEVERE_TOXİK, INSULT, PROFANITY, THREAT, IDENTITY_ATTACK. Tek boyutlu birincil puan (TOXİK) alt boyutlu varyantlarla.

İçerik moderasyonu araştırma tabanı olarak yaygın olarak kullanılır çünkü API istikrarlıdır, belgelemiştir ve yıllarca kalibrasyon verilerine sahiptir.

### Üç katlı kalıp

1. **Input moderation.**Kullanıcının isteklerini jenerasyondan önce sınıflandırın.
2. **Output moderation.**Model'in çıkışını teslimattan önce sınıflandırın. işaretli ise reddetme ile değiştirin. Gecikme: bir sınıflandırıcı nesne sonrası çağrı.
3. **Custom moderation.**Alan-specifik kurallar (regex, allowlists, iş politikası).

Üç katman tasarım olarak sırayildir: Giriş moderatörü jenerasyondan önce tamamlanmalı ve çıkış moderatörü jenerasyondan sonra çalışmalıdır. Paralellik,  bir katman içinde uygulanır. Birden fazla sınıflandırıcı (örneğin, OpenAI Moderation + Llama Guard + Perspective) aynı anda aynı metinde sınıflandırıcıya göre gecikmeyi gizler. Seçenekli bir optimizasyon olarak, giriş moderesinin tamamlanmasıyla ve token-1 akışı ertelenirken bir yer tutma yanıtı ("bir an, kontrol...") gösterilebilir. Bayrak davranışları yapılandırılabilir: reddetmek, temizlemek, insan incelemesine tırmanmak.

### Başarısızlık modları

- **Input only.**Çıkış halüsinasyonlarını yakalamaz (Learning 12-14 kodlama saldırıları giriş sınıflandırıcılarını atlatır).
- **Output only.**Herhangi bir giriş modeline ulaşmasına izin verir; maliyetleri artırır; saldırganın iç mantıklılığını ortaya çıkarır.
- **Custom only.**Kategoriler arasında sağlam değil; regexler kırılgan.

Öntanımlı olarak katlanmış.

### Azure Değersizliği

Azure İçerik Moderatörü: Şubat 2024'te geçersiz hale geldi, Şubat 2027'te emekli oldu. LLM tabanlı ve Azure OpenAI ile entegre olan Azure AI İçerik Güvenliği ile değiştirildi. Göçme Azure dağıtımları için 2024-2027 alan düzeyde bir proje.

### Bu 18 fazaya uygun.

Ders 16 kırmızı takım bağlamında moderasyon araçlarını kapsar. Ders 29 dağıtılan moderasyonu kapsar. Ders 30 mevcut çift kullanım yetenekleri kanıtlarıyla kapanır.

```figure
an-moderation-layers
```

## Kullan

`code/main.py`Üç katmanlı bir moderasyon harnessini oluşturur: giriş moderatörü (kilit kelime + kategoriler puanı), çıkış moderatörü (çıkışta aynı sınıflandırıcı), özel moderatör (domen kuralları). Girişleri çalıştırıp hangi katmanın neyi yakaladığını gözlemleyebilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-moderation-stack.md`. Bir dağıtım göz önüne alındığında, bir moderasyon yığınının yapılandırmasını önerir: hangi sınıflandırıcı giriş, hangi çıkış, hangi özel kurallar ve kenar durumları için hangi yargılama.

## Egzersizler

1. Çık .`code/main.py`- Üç katman boyunca iyi huylu, sınırlı ve zararlı bir giriş yapın.

2. Harneleri belirli bir kategori için Perspective API tarzı toksisite puanıyla genişletin.

3. OpenAI Moderation API belgeleri ve Llama Guard 3 kategorisi listesini okuyun. Her OpenAI kategorisini en yakın Llama Guard kategorilerine haritasın. Temiz haritası yapmayan üç kategorinin kimliğini belirleyin.

4. Bir kod asistanı dağıtımı için bir moderasyon yığını tasarlayın (örneğin GitHub Copilot). En ve en az ilgili kategorileri tanımlayın ve özel kurallar önerin.

5. Azure İçerik Moderator Şubat 2027'de emekli olur. Azure AI İçerik Güvenliği'ne bir göç planlayın. Göçmenin en yüksek riskli öğesini belirleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | GPT-4o-based 13-category (text) classifier with partial multimodal support |
| Perspective API | "Google Jigsaw toxicity" | Pre-LLM-era toxicity scoring baseline |
| Llama Guard | "MLCommons 14-category" | Meta's hazard classifier (v3: 8B text, 8 langs; v4: 12B multimodal) |
| Input moderation | "pre-generation filter" | Classifier on user prompt before model call |
| Output moderation | "post-generation filter" | Classifier on model output before delivery |
| Custom moderation | "domain rules" | Deployment-specific rules (regex, allowlist, policy) |
| Layered moderation | "all three layers" | Standard production deployment pattern |

## Daha Fazla Okumak

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) Omni-moderasyon son noktası
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) Llama Gardiyan repo
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) Toksisite puanlaması
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) Azure'ı değiştirmek
