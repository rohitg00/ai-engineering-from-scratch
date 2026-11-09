# ASCII Sanat ve Görsel Hapishane Çıkışları

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art tabanlı Ceilbreak Attacks against Alligned LLMs" (ACL 2024, arXiv:2402.11753). Güvenlik ile ilgili belirtileri zararlı bir talepte gizleyin, aynı harflerin ASCII sanatı gösterileri ile değiştirin ve gizlenmiş bir istek gönderin. GPT-3.5, GPT-4, Gemini, Claude, Llama-2 hepsi ASCII sanatı simgelerini güçlü bir şekilde tanımamaktadır. Saldırı PPL (kafas karışıklığı filtreleri), Parafraze savunmaları ve Retokenizasyon'u atlıyor. İlgili: ViTC referans ölçüsü semantik olmayan görsel isteklerin tanınmasını ölçer; StructuralSleight, kodlama saldırıları ailesi olarak Usual Metin Kodlanmış Yapılara (ağaçlar, grafikler, yuvalanmış JSON) genelleştirir.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- ArtPrompt saldırısını açıklayın: kelime tanımlama adım, ASCII-art değiştirme, son gizlenmiş istek.
- Standart savunmaların (PPL, Parafraze, Retokenization) ArtPrompt'te neden başarısız olduğunu açıklayın.
- ViTC'yi tanımlayın ve ölçümlerini açıklayın.
- StructuralSleight'ı keyfi olmayan Uygulanabilir Metin Kodlanmış Yapılara genelleştirme olarak tanımlayın.

## Sorun

Parafrase ve rol oynaması (Daahi 12) ve uzun bağlam (Daahi 13) yoluyla saldırılar metin düzeyde bir patern üzerinde çalışır. ArtPrompt tanıma düzeyinde çalışır: model yasaklı jetonu analiz etmez.

## Anlaşım

### ArtPrompt, iki adım

Adım 1. Sözcük Tanımlama. Zararlı bir talebe göre saldırgan, güvenlikle ilgili kelimeleri tanımlamak için bir LLM kullanır (örneğin, "bomba nasıl yapılır"daki "bomba"). 

Adım 2. Gizli Çözüm Yükleme. Her tanımlanan kelimeyi ASCII sanatı gösterimiyle değiştirin (harf şeklini oluşturan 7x5 veya 7x7 karakter blokları). Modelle yeterli derecede yetenekli bir modelin kelime olarak tanıyabileceği noktalama ve boşluklar bir şebekesi gelir; güvenlik filtre sadece şebekesi görür.

Sonuç: GPT-4, Gemini, Claude, Llama-2, GPT-3.5 hepsi başarısız oldu.

### Standart savunma neden başarısız oluyor

- **PPL (perplexity filter).**ASCII sanatı yüksek karmaşıklığa sahiptir  ama tüm yeni girişler de aynıdır. ArtPrompt'i engelleyen eşiği seçimler de meşru yapılandırılmış girişleri engeller.
- **Paraphrase.**Promptu'nun parafrase edilmesi ASCII sanatını yok eder.
- **Retokenization.**Tokenleri farklı bir şekilde bölmek, modelin görmesinin harf şekillerini tanıdığını değiştirmez.

Temel sorun, güvenlik filtrelerinin token veya semantik düzeyde olmasıdır; ArtPrompt görsel tanıma düzeyinde çalışır.

### ViTC referans değerini

Semantik olmayan görsel isteklerin tanınması. Modelin ASCII-art, wingdings ve diğer metin-semantik olmayan görsel içeriği okumayı ölçer. ArtPrompt'in etkinliği ViTC doğruluğu ile ilişkilidir: model görsel metni ne kadar iyi okursa ArtPrompt üzerinde o kadar iyi çalışır. Bu bir yetenek-güvenlik pazarlamasıdır.

### YapısalSleight

ArtPrompt: Usual Metin Kodlanmış Yapılar (UTES) Genelleştirir. Ağaclar, grafikler, yuvalanmış JSON, CSV-in-JSON, farklı stil kod blokları.

Savunma anlamı: modelin analiz edebileceği yapılandırılmış temsiller boyunca güvenlik genelleşmelidir.

### Görüntü-modallik analog

Görsel LLM'ler (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) saldırı yüzeyini genişletiyor.

### Bu 18 fazaya uygun.

Ders 12-14 üç ortogonal saldırı vektörünü tanımlar: İteratif Düzeltme (PAIR), Konekst Uzunluğu (MSJ) ve Kodlama (ArtPrompt/StructuralSleight).15 ders model merkezli saldırılardan sistem sınırlı saldırılara (indirekt acil enjeksiyon) geçiyor.16 ders savunma araç tepkisini tanımlar.

```figure
al-ascii-cloak
```

## Kullan

`code/main.py`ASCII-art gliflerle zararlı bir sorguda belirli kelimeleri gizleyebilir, gizlenmiş dizinin anahtar kelime filtresi geçmesini doğrulayabilir ve (veya seçeneği olarak) gizlenmiş dizinin basit bir tanıtıcı kullanarak tekrar şifreleyebilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-encoding-audit.md`. Bir jailbreak savunma raporu göz önüne alındığında, kapsamlı kodlama saldırı aileleri (ASCII sanatı, base64, leet-speak, UTF-8 homoglif, UTES) ve her birini yakalayan savunma katmanı sayılır.

## Egzersizler

1. Çık .`code/main.py`Gizli dizinin basit bir anahtar kelime filtreyi geçtiğini kontrol edin.

2. İkinci bir kodlama uygulayın: base64 aynı hedef kelime için. ArtPrompt ile filtre-önleme oranını ve kurtarma zorluğunu karşılaştırın.

3. Jiang et al. 2024 Bölüm 4.3 (beş model sonuçları) okuyun.

4. ASCII sanat şeklinde bölgeleri anında algılayan bir ön nesil savunma tasarlayın. Kanunlu kod, tablolar ve matematiksel notasyonda yanlış pozitif oranı ölçün.

5. StructuralSleight 10 kodlama yapısını listeler. 10'u ele alan genel bir savunma çizin ve savunulan bir istek için hesaplama maliyetini tahmin edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## Daha Fazla Okumak

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) ASCII-art jailbreak kağıdı
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) UTES genelleşimi
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) Ek iteratif saldırı
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) Ek uzunluk saldırısı
