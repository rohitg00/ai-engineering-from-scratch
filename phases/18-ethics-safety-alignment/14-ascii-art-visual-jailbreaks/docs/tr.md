# ASCII Sanat ve Görsel Jailbreak'ler

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: Hizalanmış LLM'lere Karşı ASCII Sanat Tabanlı Jailbreak Saldırıları" (ACL 2024, arXiv:2402.11753). Zararlı bir istekte güvenlikle ilgili token'lari maskeleyin, bunları aynı harflerin ASCII çizimleriyle değiştirin ve gizlenmiş prompt'u gönderin. GPT-3.5, GPT-4, Gemini, Claude, Llama-2'nin tümü ASCII-art token'ları sağlam bir şekilde tanımada başarısız oluyor. Saldırı, PPL'yi (karmaşıklık filtreleri), Açıklama savunmalarını ve Yenidentokenleştirmeyi atlar. İlgili: ViTC benchmark anlamsal olmayan görsel prompt'larin tanınmasını ölçer; StructuralSleight, bir kodlama saldırıları ailesi olarak Yaygın Olmayan Metin Kodlu Yapıları (ağaçlar, grafikler, iç içe JSON) genelleştirir.

**Tür:** Yapım
**Diller:** Python (stdlib, ArtPrompt token-maskeleme koşum takımı)
**Önkoşullar:** Aşama 18 · 12 (PAIR), Aşama 18 · 13 (MSJ)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- ArtPrompt saldırısını açıklayın: kelime tanımlama adımı, ASCII-sanat değişikliği, son gizlenmiş prompt.
- Standart savunmaların (PPL, Paraphrase, RetokenRetokenization) ArtPrompt'da neden başarısız olduğunu açıklayın.
- ViTC'yi tanımlayın ve neyi ölçtüğünü açıklayın.
- StructuralSleight'ı rastgele Yaygın Olmayan Metin Kodlu Yapılara yönelik bir genelleme olarak tanımlayın.

## Sorun

Açıklama ve rol yapma (Ders 12) ve uzun bağlam (Ders 13) yoluyla yapılan saldırılar, metin düzeyindeki model üzerinde çalışır. ArtPrompt tanıma seviyesinde çalışır: model yasaklı token'ı ayrıştırmaz. Karakterlerle oluşturulan bir görüntüyü ayrıştırır. Güvenlik filtresi zararsız noktalama işaretlerini görür. Model bir kelime görüyor.

## Konsept

### SanatPrompt, iki adım

Adım 1. Kelime Tanımlama. Zararlı bir istek verildiğinde, saldırgan güvenlikle ilgili kelimeleri (e.g., "bomba", "nasıl bomba yapılır") tanımlamak için bir LLM kullanır.

Adım 2. Gizlenmiş Prompt Nesli. Tanımlanan her sözcüğü ASCII resimli görselleştirmesiyle (harf şeklini oluşturan 7x5 veya 7x7 karakter bloğu) değiştirin. Model, yeterince yetenekli bir modelin kelime olarak tanıyabileceği bir noktalama işaretleri ve boşluklar tablosu alır; bir güvenlik filtresi yalnızca ızgarayı görür.

Sonuç: GPT-4, Gemini, Claude, Llama-2, GPT-3.5'in tümü başarısız. benchmark alt kümesinde saldırı başarı oranı %75'in üzerinde.

### Standart savunmalar neden başarısız oluyor?

- **PPL (şaşkınlık filtresi).** ASCII sanatının karmaşıklığı yüksektir - ancak tüm yeni girdiler de öyle. ArtPrompt'yı engelleyen eşik seçenekleri aynı zamanda yasal yapılandırılmış girişi de engeller.
- **Açıklama.** prompt'nın başka sözcüklerle ifade edilmesi ASCII resmini yok eder. Uygulamada, yüksek lisans eğitimleri sıklıkla sanatı korur veya yeniden yapılandırır.
- **Yenidentokenleştirme.** token'lari farklı şekilde bölmek, modelin görüşünün harf şekillerini tanıdığını değiştirmez.

Temel sorun, güvenlik filtrelerinin token- veya anlamsal düzeyde olmasıdır; ArtPrompt görsel tanıma düzeyinde çalışır.

### ViTC benchmark

Anlamsal olmayan görsel prompt'larin tanınması. Modelin ASCII sanatı, kanatlar ve diğer metin dışı anlamsal görsel içeriği okuma yeteneğini ölçer. ArtPrompt'ın etkinliği ViTC doğruluğuyla ilişkilidir: model görsel metni ne kadar iyi okursa, ArtPrompt onun üzerinde o kadar iyi çalışır. Bu bir yetenek-güvenlik dengesidir.

### Yapısal Hafiflik

Sanatı GenelleştirirPrompt: Yaygın Olmayan Metin Kodlu Yapılar (UTES). Ağaçlar, grafikler, iç içe JSON, JSON'da CSV, diff tarzı kod blokları. Bir yapı, eğitim güvenliği verilerinde nadirse ancak model tarafından ayrıştırılabilirse, zararlı içeriği gizleyebilir.

Savunmanın anlamı: Güvenlik, modelin ayrıştırabileceği yapılandırılmış temsiller boyunca genelleştirilmelidir. Set büyük ve büyüyor.

### Görüntü modalitesi analogu

Görsel LLM'ler (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) saldırı yüzeyini genişletir. Gerçek görüntülerle yapılan ArtPrompt tarzı saldırılar, ASCII sanat analoglarından daha güçlüdür çünkü görüntü kodlayıcılar daha zengin sinyal üretir.

### Bunun 18. Aşamada yeri nedir

12-14. Dersler üç ortogonal saldırı vektörünü tanımlar: yinelemeli iyileştirme (PAIR), bağlam uzunluğu (MSJ) ve kodlama (ArtPrompt/StructuralSleight). Ders 15, model merkezli saldırılardan sistem sınırı saldırılarına (dolaylı prompt enjeksiyon) geçiş yapar. Ders 16, savunma araçlarının tepkisini açıklamaktadır.

## Use It — Hazır Araçla Uygula

`code/main.py` bir oyuncak SanatıPrompt yapıyor. Zararlı bir sorgudaki belirli kelimeleri ASCII-art glifleriyle gizleyebilir, gizlenmiş dizenin bir anahtar sözcük filtresinden geçtiğini doğrulayabilir ve (isteğe bağlı olarak) basit bir tanıyıcı kullanarak gizlenmiş dizenin kodunu geri çözebilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-encoding-audit.md` üretir. Bir jailbreak savunma raporu verildiğinde, kapsanan kodlama saldırısı ailelerini (ASCII art, base64, leet-speak, UTF-8 homoglyph, UTES) ve her birini yakalayan savunma katmanını sıralar.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Gizlenmiş dizenin basit bir anahtar kelime filtresinden geçtiğini doğrulayın. Gereken karakter düzeyindeki değişikliği bildirin.

2. Aynı hedef kelime için ikinci bir kodlama uygulayın: base64. Filtre atlama oranını ArtPrompt ve kurtarma zorluğuyla karşılaştırın.

3. Jiang ve ark.'nı okuyun. 2024 Bölüm 4.3 (beş model sonuçları). Claude'un SanatPrompt-direncinin aynı benchmark üzerinde Gemini'ninkinden daha yüksek olmasının bir nedenini önerin.

4. prompt'da ASCII sanatı şeklindeki bölgeleri tespit eden bir nesil öncesi savunma tasarlayın. Meşru kod, tablolar ve matematiksel gösterimde yanlış pozitiflik oranını ölçün.

5. StructuralSleight 10 kodlama yapısını listeler. 10 savunmanın tamamını kapsayan genelleştirilmiş bir savunma taslağı çizin ve savunulan prompt başına hesaplama maliyetini tahmin edin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| SanatPrompt | "ASCII sanatı saldırısı" | Güvenlik sözcüklerini ASCII sanat görselleriyle maskeleyen iki adımlı jailbreak |
| Gizleme | "kelimeyi gizle" | Yasaklanmış bir token'ı, modelin okuduğu ancak filtrenin okumadığı görsel bir temsille değiştirin |
| UTES | "yaygın olmayan yapı" | Yaygın Olmayan Metin Kodlu Yapı — içerik kaçakçılığı için kullanılan ağaç, grafik, iç içe JSON vb. |
| ViTC | "görsel metin özelliği" | Modelin anlamsal olmayan görsel kodlamayı okuma yeteneği için Benchmark |
| Şaşkınlık filtresi | "PPL savunması" | prompt'ları büyük bir şaşkınlıkla reddet; başarısız çünkü yasal yapılandırılmış girdi de yüksek puan alıyor |
| YenidentokenKaldırma | "tokenizer vardiya savunması" | prompt'u farklı bir tokenizer ile önceden işleyin; başarısız oluyor çünkü tanıma görseldir |
| Homoglif | "benzer karakterler" | Latin harfleriyle aynı görünen Unicode karakterler; alt dize kontrollerini atla |

## Daha Fazla Okuma

- [Jiang ve ark. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — ASCII-art jailbreak makalesi
- [Li ve ark. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — UTES genellemesi
- [Chao ve ark. — PAIR (Ders 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — tamamlayıcı yinelemeli saldırı
- [Anıl ve ark. — Çok atışlı Jailbreaking (Ders 13)](https://www.anthropic.com/research/many-shot-jailbreaking) — tamamlayıcı uzunluklu saldırı
