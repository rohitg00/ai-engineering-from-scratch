# Kırmızı takım: PAIR ve Otomatik Saldırılar

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419). PAIR  Hızlı Otomatik İteratif Düzeltme , kanonik otomatik kara kutu hapishane kırılmasıdır. Kızıl takım sistemi ile saldırgan bir LLM, hedef bir LLM için tekrar tekrar jailbreaks önerir ve kendi sohbet geçmişinde bağlamda geri bildirim olarak denemeleri ve cevapları biriktirir. PAIR tipik olarak 20 sorgu içinde başarılı olur, büyüklük sıralamaları GCG'den daha verimli (Zou et al.'s token seviyesindeki gradient arama) ve beyaz kutu erişiminin gereksiz. PAIR, şimdi GCG, AutoDAN, TAP ve Yönetici Karşılıklı İndirim ile birlikte JailbreakBench (arXiv:2404.01318) ve HarmBench'de standart bir temel çizgidir.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- PAIR algoritmasını açıklayın: saldırgan sistem istekleri, tekrarlı gelişmeler, bağlam içi geri bildirimler.
- Hedef kara kutu olduğunda PAIR'in neden GCG'den kesinlikle daha verimli olduğunu açıklayın.
- Diğer dört otomatik saldırı tabanını (GCG, AutoDAN, TAP, PAP) isimlendirin ve her birinin bir farklılık belirtin.
- JailbreakBench ve HarmBench değerlendirme protokollerini ve her biri altında "saldırı başarısı oranı" ne anlama geldiğini açıklayın.

## Sorun

Red-teaming eskiden manuel bir aktiviteydi. Küçük sayıda uzman denetçi karşıtlık uyarıları oluşturdu ve hangi uyarıları işe yaradı izledi. Bu ölçeklenmez: saldırı başarısı oranı istatistiksel bir örnek gerektirir ve hedef her model yayınıyla birlikte hareket eden bir hedefdir. PAIR, kırmızı takımları bir kara kutu hedefi ile optimizasyon sorunu olarak çalıştırır.

## Anlaşım

### PAIR algoritması

Girişler:
- Hedef LLM T (saldırma modemiz).
- Yargıç LLM J (responun bir hapishaneden çıkış olup olmadığını belirler).
- Saldırgan LLM A (kırmızı takım optimizörü).
- Hedef hattı G: " [Zararlı talimatlarla] yanıt ver".
- Bütçe K (genellikle 20 soru).

Çubuk, k için 1..K:
1. A, G hedefi ve bugüne kadar (sürekli, yanıt) çiftlerin geçmişi ile uyarılır.
2. Bir yeni uyarı gönderir .$p_k$- Evet .
3. Gönder .$p_k$T 'ye cevap al $r_k$- Evet .
4. J puanları $(p_k, r_k)$- Hedef üzerine.
5. Eğer puan >= eğim varsa, durdur  hapishane kırılması bulunmuştur.
6. Başka bir şey, ekle $(p_k, r_k)$A'nın geçmişine devam et.

Empirik sonuç (NeurIPS 2023): GPT-3.5-turbo, Llama-2-7B-chat karşı saldırı başarısı oranı %50'dir; 10-20 aralığında başarının ortalama sorguları.

### PAIR neden verimli

GCG (Zou et al. 2023) karşıtlıklı token sufifiklerini gradient olarak arar; beyaz kutu modeline erişimi gerektirir ve okunamayan sufifikler üretir. PAIR kara kutu ve modeller arasında aktarılan doğal dil saldırıları üretir. PAIR'in bağlam içi geri bildirimi saldırganın her reddedilmeden öğrenmesine izin verir; GCG'nin eşdeğerleri yoktur (her yeni token güncelleştirmesi önceki ilerlemeyi yeniden keşfetmelidir).

### Bağlı otomatik saldırılar

- **GCG (Zou et al. 2023, arXiv:2307.15043).**Token seviyesinde, karşıtlıklı sufiksler için gradient arama.
- **AutoDAN (Liu et al. 2023).**Bir hiyerarşik hedefle yönlendirilmiş, istekler üzerinde evrimsel arama.
- **TAP (Mehrotra et al. 2024).** dalları kesmek ile saldırı ağacı, PAIR tarzı birden fazla dağıtım.
- **PAP (Zeng et al. 2024).**Yönlendirici Zararlı İstekler  insan ikna etme tekniklerini istekli şablonlar olarak kodlar.

### JailbreakBench ve HarmBench

Her ikisi de (2024) standart değerlendirme:

- JailbreakBench (arXiv:2404.01318). 10 OpenAI-politik kategorisi boyunca 100 zararlı davranış. Hasar başarısı oranı (ASR) ana ölçüt olarak. Bir yargıç (GPT-4-turbo, Llama Guard veya StrongREJECT) gerektirir.
- HarmBench (Mazeika et al. 2024). 510 davranış 7 kategoride semantik ve fonksiyonel zarar testleri ile.

ASR genellikle sabit bir sorgu bütçesi ile bildirilir.Söz saldırıları karşılaştırmak eşleşen bütçeler gerektirir; 200 sorguda %90 ASR, 20'de %85 ASR ile karşılaştırılamaz.

### 2026'da yerleştirilmesinin nedenleri

Her sınır laboratuvarı şimdi yayınlanmadan önce PAIR ve TAP'yi üretim modelleri karşısında çalıştırır. ASR yolları model kartlarında (Desin 26) ve güvenlik durumları eklemlerinde (Desin 18) görünür.

### Bu 18 fazaya uygun.

Ders 12 otomatik saldırı temelidir. Ders 13 (Many-Shot Jailbreaking) bir tamamlayıcı uzunluk-saldırma. Ders 14 (ASCII Art / Visual) bir kodlama saldırısı. Ders 15 (Indirect Prompt Injection) 2026 üretim saldırı yüzeyidir. Ders 16 savunma aletleri eşyalarını kapsar (Llama Guard, Garak, PyRIT).

```figure
al-pair-loop
```

## Kullan

`code/main.py`Oyuncak bir PAIR döngüsü oluşturur. Hedef "açık" zararlı ipuçlarını reddeden sahte bir sınıflandırıcıdır (kilit kelime filtresi). Saldırıcı, parafrase, rol oynaması çerçevesini ve kodlamayı deneden kurallara dayalı bir rafineci. Yargıç yanıtını puanlar. Saldırıcının anahtar kelime filtreye karşı ~ 5-15 tekrarlamada başarılı olduğunu ve semantik bir filtreye karşı başarısız olduğunu izlersiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-attack-audit.md`. Kızıl takım değerlendirme raporu göz önünde bulundurarak, hangi saldırıların (PAIR, GCG, TAP, AutoDAN, PAP) gerçekleştiğini, hangi bütçeye, hangi yargıçla hangi zararlı davranışın (JailbreakBench, HarmBench, iç) düzenlendiğini denetler.

## Egzersizler

1. Çık .`code/main.py`- Üç içe gömülü saldırgan stratejisi için ortalama başarı sorgularını ölçmek.

2. Dördüncü saldırgan stratejisini uygulayın (örneğin, başka bir dile çevirme, base64 kodlama).

3. Chao et al. 2023 Resim 5 (PAIR vs GCG karşılaştırması) PAIR'in verimlilik avantajına rağmen GCG'nin tercih edildiği iki senaryoyu açıklayın.

4. JailbreakBench, ASR'yi sabit bir hedef seti karşı rapor eder.Saldırı çeşitliliğini ölçen bir ek ölçüm tasarlayın (başarılı isteklerin değişimi).

5. TAP (Mehrotra 2024) PAIR'i dallama + kesim ile uzattı.`code/main.py`ve hesaplama maliyetleri ile başarı oranı arasındaki karşılaştırmayı açıklar.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| PAIR | "automated jailbreak" | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | "gradient jailbreak" | White-box token-level gradient search for adversarial suffixes |
| Attack success rate (ASR) | "% jailbreaks at k queries" | Primary metric; must be reported with query budget and judge identity |
| Judge LLM | "the scorer" | LLM that grades whether a response satisfies the harmful goal |
| JailbreakBench | "the evaluation" | Standardized harmful-behaviour set with tagged categories |
| HarmBench | "the broader bench" | 510 behaviours, functional + semantic harm tests |
| TAP | "tree of attacks" | PAIR with branching + pruning; better ASR at higher compute |

## Daha Fazla Okumak

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) PAIR kağıdı, NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) GCG kağıdı
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) Standart değerlendirme
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) daha geniş bir değerlendirme
