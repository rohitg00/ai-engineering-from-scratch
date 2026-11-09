# AlphaEvolve  Evrimsel Kodlama Ajanları

> Devrimsel bir döngü ve makine kontrol edilebilir bir değerlendirici ile sınır kodlama modeli eşleştirin. Çubuk yeterince uzun sürsün. Bu, 48 skalar çarpımı kullanan 4x4 kompleks-matris çarpma prosedürünü keşfeder. 56 yıl içinde Strassen'in ilk gelişimi. Ayrıca, üretimde bulunan klüster hesaplamalarının %0,7'ini geri alan Google genelinde bir Borg programlama heuristik bulur. Mimarlık kasten sıkıcı. Kazançlar değerlendirici'nin katılamasından kaynaklanmaktadır.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## Sorun

Büyük dil modelleri kod yazabilir. Evrimsel algoritmalar kod üzerinde arama yapabilir. Her ikisi de on yıllardır ayrı olarak denedilir; her ikisi de tavanlara çarptır. LLM tavanı bir konfabulatsiyondur: model iddia ettiği şeyi yapmayan makul kod yazar. Evrimsel tavan arama maliyetidir: sentaks üzerinde rastgele mutasyonlar nadiren kompile edilebilir programlar üretir, daha iyi programları bile söylemeyiz.

AlphaEvolve (Novikov et al., DeepMind, arXiv:2506.13131, Haziran 2025) bunları birleştirir. LLM bir program veritabanına hedeflenmiş düzenlemeler önerir; otomatik bir değerlendirici her variansı puanlar; yüksek puanlı varianlar gelecek nesiller için ebeveyn olur. LLM makul kod yazmanın pahalı adımı ele alır; değerlendirici konfabulasiyonları yakalar.

Sonuçlar bildirildi: 48-skala-koşul-koşul 4x4 kompleks matris çarpımı (Strassen'in 1969 sınırı 49 idi), Google üretiminde bir Borg programlama heuristik, %32,5 FlashAttention çekirdek hızlandırması, Gemini eğitim geçiş gelişimleri.

Arsitektur çalışır çünkü değerlendirici makine kontrol edilebilir. değerlendirici olmayan yerde çalışmaz. Bu asimetri ders.

## Anlaşım

### Çubuk

1. Tohum programından başla `P_0`Bu doğru ama optimum değil.
2. Değişiklik programlarının bir veritabanını tutmak, her biri değerlendirici tarafından puanlanmıştır.
3. Veritabanın (MAP-elite tarzı veya ada tabanlı) bir veya daha fazla ebeveyn örneği.
4. LLM'yi (Biri Flash birçok aday için, İkiz Pro zor olanlar için) değiştirilmiş bir ana variansı üretmek için çağırın.
5. Sürekli değerlendirme cihazında variansı oluştur, çalıştır ve değerlendirin.
6. Skor ve özellik vektörü ile anahtarlanmış veritabanına ekle.
7. Tekrar ediyorum.

İki detay önemlidir. Birincisi, LLM ana programdan daha fazlasıyla  genellikle veritabanından birkaç üst varyant ile teşvik edilir.

### Değerlendiriciyi pazarlık edilemez kılan şey

AlphaEvolve'in kazançları, değerlendirici hızlı, belirleyici ve zor oynadığı alanlardan gelir:

- **Matrix multiplication algorithm**: matrisleri çarpıtan ve eşitliği bit-tıpkı bir şekilde kontrol eden birim testi.
- **Borg scheduling heuristic**: tarihi küme yükünü yeniden oynayan ve boşa harcanmış hesaplama ölçümlerini yapan üretim derecesi simülatörü.
- **FlashAttention kernel**: gerçek donanım üzerinde doğrulık testi ve duvar saati referans göstergesi.
- **Gemini training throughput**: adım başına GPU saniye ölçülmüştür.

Her durumda değerlendirici, öte yandan üstünlük sağlayacak LLM hataları sınıfını yakalar: konfabulated doğruluk iddiaları, donanım üzerinde kaybolan performans iddiaları ve kenar durum hataları.

### Ödül hackeri bu ifadeye karşı bir yönüdür.

Değerlendirici ölçümleri için evrim optimize eder. Eğer değerlendirici kusurlu ise, döngü kusurlu bulur. Doğrulanmamış bir alanda döngü, amaçlanan davranış için değil yüzey özelliği için optimize eder. DeepMind bu açıkça kağıda işaretler: AlphaEvolve'un başarıları yalnızca değerlendirici sıkıntısının arama hedeflerine uyduğu alanlara aktarılır.

2025-2026 yılları arasında kod arama döngüslerinde ödül hackleme örnekleri:

- "Bütünleşme zamanı" ödülünü veren optimizasyon hedefleri boş çözümler göndermekle ödüllendirildi.
- Benchmark puanları doğruluk testi altındaki hatırlarlık testleri ve aşırı uygunlukları ödüllendirir.
- "Kod kalitesi" proxy, yorumları kaldırmak ve semantik bir değişiklik olmadan değişken isimleri yeniden yazmakla ödüllendirildi.

AlphaEvolve'de çözüm: LLM'nin hiç görmediği bir değerlendirmeci gönderir ve değerlendirme sırasında üretilen girişler.

### Neden LLM + arama tek başına ya da

LLM, kompüle edilebilir, anlamsal olarak makul değişiklikler üretebilir. 2000 satırlı Python dosyasında rastgele mutasyon GA neredeyse her zaman sözcük hatası üretir. LLM ayrıca rastgele komşularda aramaları yoğunlaştırır (herhangi bir fonksiyonu değiştir, rastgele bayt değil), bu da değerlendirmeci çağrıları çarpıcı bir şekilde azaltır.

Değerlendirici, LLM'nin konfabulatlarını yakalar. LLM'ler bir fonksiyonun "$O(n \log n)$"Sınır"da aslında.$O(n^2)$Bu soru, duvar saatinin bir referans göstergesiyle çözülmüştür.

### AlphaEvolve sınırda yer alırken

| System | Generator | Evaluator | Domain | Example win |
|---|---|---|---|---|
| AlphaEvolve | Gemini | correctness + benchmark | algorithms, kernels, schedulers | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | correctness | combinatorial math | cap-set lower bounds |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM critique + experiment | ML research | ICLR workshop paper |
| Darwin Godel Machine (L4) | agent scaffolding | SWE-bench / Polyglot | agent code | 20% → 50% SWE-bench |

Dörtü de aynı tarifin değişikliği: jeneratör artı değerlendirici, döngü. Farklılıklar değerlendirici notlarının ne kadar sıkı olduğu.

```figure
alphaevolve-loop
```

## Kullan

`code/main.py`Oyuncak simbolik gerileme sorunu üzerinde minimal AlphaEvolve benzeri bir döngü uyguluyor. "LLM" bir hedef işlevi hesaplayan bir programa küçük sentaksik mutasyonlar öneren bir stdlib proxy. "Değerleyicisi" ölçümleri, tutulan test noktalarında karelerden bir hata anlamına gelir.

- Gözleyin.

- En iyi notun nesiller boyunca nasıl geliştiğini.
- Bir MAP elit şebekesi çeşitli çözümleri nasıl canlı tutar ki bu da halka yerel minimumlara doğru birleştiği için değil.
- Nasıl bir şekilde, beklenmedik bir denemeyi (tekrar eğitimli değerlendirmeci) kaldırmak, döngüyi çarpıcı bir şekilde uyumlandırır.

## Gönder

`outputs/skill-evaluator-rigor-audit.md`Yeni bir alanda AlphaEvolve tarzında bir döngü düşünmenin ön koşuludur: değerlendirici gerçekten önem verdiğiniz başarısızlıkları algılar mı?

## Egzersizler

1. Çık .`code/main.py`. En iyi puan çizgisini not edin.`--no-holdout`) ve tekrar çalıştırmak.

2. MAP-elite grid'deki AlphaEvolve makalesinin 3. bölümünü okuyun. Aramaları çeşitlilikte tutmak için yeni bir sorun için bir özellik vektörü tanımlayıcısı tasarlayın (örneğin, kompiliör optimizasyonu geçişleri).

3. Strassen'in 49-mul sınırında 48 çarpma 4x4 sonucu 56 yıl sonra iyileşti. Kağıtın F ekini okuyun ve bu sorunun değerlendirici neden özellikle doğru olmak için kolay olduğunu ve çoğu alanın neden bu şekilde olmadığını üç cümleyle açıklayın.

4. AlphaEvolve'in başarısız olduğu bir alan önerin.

5. Bildiğiniz bir alan için kullanmak istediğiniz değerlendirmeci imzasını yazın. (a) doğruluk koşulları, (b) performans metrikleri, (c) devamlı giriş üretimi kuralları, (d) en az bir ödül saldırısına karşı kontrolü ekleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| AlphaEvolve | "DeepMind's evolutionary coding agent" | Gemini + program database + machine-checkable evaluator |
| MAP-elites | "Diversity-preserving archive" | Grid keyed by feature vectors; each cell holds the best variant with that descriptor |
| Island model | "Parallel evolution subpopulations" | Independent populations that migrate periodically; prevents premature convergence |
| Machine-checkable evaluator | "Deterministic oracle" | A unit test, simulator, or benchmark the LLM cannot fake — a prerequisite for this loop |
| Reward hacking | "Optimizing the measure, not the goal" | Loop finds a way to maximize score without doing the intended task |
| Seed program | "The starting point" | An initial correct-but-suboptimal program the loop evolves from |
| Held-out evaluator | "Evaluation data the LLM never saw" | Inputs generated at evaluation time to prevent memorization |

## Daha Fazla Okumak

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131)- Tüm kağıt.
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) Satıcı kayıtları sonuçlarla.
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results)48-mul 4x4 matmul dahil olmak üzere algoritmalar keşfedildi.
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) Önceki sistem.
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) değerlendiriciye bağlı otonomluk, temel bir araştırma yönü olarak çerçeveliyor.
