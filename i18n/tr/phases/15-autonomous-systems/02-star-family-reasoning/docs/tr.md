# STAR, V-STAR, Silenç STAR  Kendi Kendine Öğretilmiş Dönüşüm

> En küçük kendi kendini geliştirme döngüsü mantık içinde yer alır. Bir model bir düşünce zinciri oluşturur, doğru cevaplara ulaşanları tutar ve bu cevaplara ince ayarlar verir. Bu STAR. V-STaR bir doğrulama ekler, böylece sonuçlama zaman seçimi daha iyidir. Sessiz-STAR mantıkları her noktaya doğru yönlendirir. Üçü de çalışıyor. Bunlardan hiçbiri sihirli değil. Bu sarmalık doğru cevaba ulaşmak için herhangi bir kısayolunu korur.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## Sorun

Bir modelin akıl yürütmesini öğretmenin en kolay yolu, insan tarafından yazılmış akıl yürütme izlerini toplamak.

STaR (Self-Teught Reasoner, Zelikman et al., 2022) soruyor: model kendi mantıklılıklarını yazarsa ve bilinen cevaplara göre sınıflandırırsa ne olur?

1. Bir mantık izini ve yanıtını örnekleyin.
2. Son cevabı doğruysa, izini tut.
3. - Saklı izleri inceleme.
4. Tekrar ediyorum.

GSM8K ve CommonsenseQA her ikisi de yeni insan notasyonu olmadan iyileşti. Ancak döngüde yerleşik bir önyargı vardır: doğru cevabı üreten herhangi bir mantık, mantıkın kendisinin sağlam olup olmadığından bağımsız olarak korunur. V-STaR (Hosseini et al., 2024) bunu öğrenilmiş bir doğrulayıcı ile düzeltir; Quiet-STaR (Zelikman et al., 2024) fikri iç mantıkları belirleyen genelleştirir.

## Anlaşım

### STaR: işe yarayanları başlat

Her eğitim sorunu üzerinde bir mantık artı cevap örnekleyin. Eğer cevap etiketle eşleşirse, (problemi, mantık, cevap) üçlü tutun. Modelli tutulan seti ince ayarlayın. Tekrarlayın.

Bir dönüş önemli. Eğer model bir sorunu asla düzeltemezse, döngü üzerinde öğrenemez.**rationalization**Bu nedenle, modelin başarısız olduğu sorunlarda, doğru cevabı bir ipucu olarak enjekte edin ve modelin buna yol açan bir mantık oluşturması için tekrar teşvik edin.

Başlangıç kağıdında (Zelikman et al., 2022) sonuç: GSM8K'de tekrarlanan STaR turları ile 5.8%'den 10.7%'ye kadar gelişmiş bir GPT-J temel modeli  yaklaşık 5 yüzde puan mutlak olarak                                                                                                                                                                                                                                   

### V-STaR: DPO ile bir doğrulayıcı eğit

STaR yanlış mantıklılıkları atıyor. Hosseini et al. (2024) bunları da veriler olarak gözlemledi: her çift (rational, "bu doğru mu") bir doğrulayıcıyı eğitebilir. Bir sıralamacı oluşturmak için hem doğru hem de yanlış çözümler üzerinde doğrudan tercih optimizasyonu kullanırlar.

Raporlanan delta: GSM8K ve MATH'de önceki kendi kendini geliştirme temellerinden +4 ila +17 yüzde puan, kazancın büyük kısmı, ek jeneratör ince ayarlamaları yerine sonuçlama zaman seçimi için doğrulayıcı kullanmaktan kaynaklanır.

### Quiet-STaR: iç mantıklar per token

Zelikman et al. (2024) sordu: model sadece sorun ve cevap arasında değil, her simge pozisyonunda kısa bir iç mantık oluşturmayı öğrenirse ne olacak? Sessiz-STaR, bir modelin her tahmin edilen simge öncesi gizli bir "düşünce" yaymasını eğitir, sonra düşünce bilincinde tahminleri öğrenilmiş bir ağırlık aracılığıyla temel tahminle karıştırır.

Sonuç: Mistral 7B GSM8K'de 5.9%'den 10.9%'a ve CommonsenseQA'da görev-özel ince ayarlama olmadan 36.3%'den 47.2%'e mutlak sıfır çekim iyileştirmeler elde etti.

### Üçü de neden güvenlik konusunda endişeli?

Üç yöntem de son cevabı gradient sinyali olarak kullanır. Kusurlu bir mantıklama yoluyla doğru cevaba ulaşan bir mantık  bir kısayol kullanmak, tahmin etmek veya genelleştirme olmayan bir kalıp kullanmak  olumlu bir şekilde güçlendirilir. Dağıtım içindeki sorunlarda kısayol çalışır. Dağıtım dışındaki sorunlarda sessizce kırılır.

V-STaR'in doğrulayıcısı, mantıklıları sıralamayı öğrenerek hafifletiyor, ancak doğrulayıcı aynı etiket seti üzerinde eğitilmiştir. Dürüst belirsizlikten çok iyi biçimlendirilmiş yanlış bir mantıklamayı tercih etmeyi öğrenebilir. Daha güvenli tasarım, (a) süreç denetimli ödül modelleri (sadece cevaplar değil, ödüller veren ara adımlar) ve (b) basit kısayolları kıran uzun süren OOD değerlendirme ile STaR tarzındaki verileri birleştirmektir.

### Karşılaştırma

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### 2026'da bu yerle bir olur.

STAR eski. Ama 2025-2026 yıllarında bu model her yerde tekrar ortaya çıkıyor. Denebilir matematik problemlerinde RL (DeepSeek-R1, Kimi-k1.5, o1) STaR'in cevap koşullu gradient sinyali, ölçeklendirilmiştir. İşlem ödül modelleri (Lightman et al., 2023; OpenAI'nin "Hatır adım doğrulayalım") süreç denetim altyapıdır. AlphaEvolve (Learning 3) bir etiket yerine bir program değerlendirici ile kod için STaR. Darwin Godel Makinesi (Denevi 4) ajan asfaltı için STaR'dir.

STaR'i anlamak tüm bu tıklamaları yapar. Bu en az yaşanabilir kendi kendini geliştirme döngüsü.

```figure
reflection-loop
```

## Kullan

`code/main.py`Oyuncak bir aritmetik görevde simülasyonlu bir STaR döngüsü çalıştırır.

- Ne kadar doğru bir şekilde atışın üstündeki atışları aşırıyor.
- Kısa yolu nasıl gizlice girer: Simülatörde doğru cevabı %40'da doğru bulur ama kötü bir şekilde genelleştirir.
- Bir doğrulayıcı (V-STaR tarzı) sonuca çıkarmaya nasıl yardımcı olur, ancak eğitim sırasında kurulan kısayolları tam olarak kesemez.

## Gönder

`outputs/skill-star-loop-reviewer.md`Bu, eğitimden önce önerilen kendi kendine akıl yürütme borusunu denetlemenize yardımcı olur.

## Egzersizler

1. Simülatörü çalıştırın. Kısa yolu frekansını sıfır, sonra da 0.4'e ayarlayın.

2. Simülatörde bir OOD testi ekleyin. Farklı bir dağılımdan sorunlar çizin ve hem dağılım içindeki hem de OOD setlerinde başlatılmış modeli değerlendirin. Boşluğu ölçün.

3. Sessiz-STaR kağıdı'nı okuyun (arXiv:2403.09629) Bölüm 3. "Düşünme sonu" simgesini ve karışım ağırlığı başını her biri üç cümle ile açıklayın.

4. STaR'ın doğru tutmak filtresini her mantıklı adımı bağımsız olarak ödüllendiren, süreçle denetlenen bir alternatifle karşılaştırın.

5. Uygulan bir modelde kısayolların rasyonalleri yakalayacağı bir değerlendirme tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## Daha Fazla Okumak

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465)- Orijinal kağıt.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) sonuç zaman seçimi için bir DPO doğrulayıcısı eklenir.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) iç ratsiyonlar.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) işlem ödül modelleri, alternatif gradient sinyali.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) Kontrol edilebilir görevler için RL, STaR sınır eğitimine kadar uzanmıştır.
