# Kırmızı Takım Oluşturma: EŞLEŞTİRME ve Otomatik Saldırılar

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419). PAIR — Prompt Otomatik Yinelemeli İyileştirme — standart otomatik kara kutu jailbreak işlemidir. Kırmızı takım sistemine sahip bir saldırgan LLM prompt, hedef LLM için yinelemeli olarak jailbreak'ler önerir, girişimleri ve yanıtları bağlam içi geri bildirim olarak kendi sohbet geçmişinde biriktirir. PAIR genellikle 20 sorgu içinde başarılı olur; bu, GCG'den çok daha verimlidir (Zou ve arkadaşlarının token düzeyindeki gradient araması) ve beyaz kutu erişimi gerektirmeden. PAIR artık GCG, AutoDAN, TAP ve Persuasive Adversarial Prompt ile birlikte JailbreakBench (arXiv:2404.01318) ve HarmBench'te standart bir temeldir.

**Tür:** Yapım
**Diller:** Python (stdlib, oyuncak hedefe karşı sahte PAIR döngüsü)
**Önkoşullar:** Aşama 18 · 01 (talimatları takip etme), Aşama 14 (agent mühendislik)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- PAIR algoritmasını açıklayın: saldırgan sistemi prompt, yinelemeli iyileştirme, bağlam içi geri bildirim.
- Hedef kara kutu olduğunda PAIR'in neden GCG'den kesinlikle daha verimli olduğunu açıklayın.
- Diğer dört otomatik saldırı temelini (GCG, AutoDAN, TAP, PAP) adlandırın ve her birinin ayırt edici bir özelliğini belirtin.
- JailbreakBench ve HarmBench değerlendirme protokollerini ve her birinin altında "saldırı başarı oranının" ne anlama geldiğini açıklayın.

## Sorun

Kırmızı takım oluşturma eskiden manuel bir aktiviteydi. Az sayıda uzman test uzmanı rakip prompt'lar oluşturdu ve hangilerinin işe yaradığını takip etti. Bu ölçeklenmez: Saldırı başarı oranı istatistiksel bir örneğe ihtiyaç duyar ve hedef, her model sürümünde hareketli bir hedeftir. PAIR, kırmızı takım oluşturmayı kara kutu hedefiyle bir optimizasyon problemi olarak işlevselleştirir.

## Konsept

### ÇİFT algoritması

Girişler:
- LLM T'yi (saldırdığımız model) hedefleyin.
- Yargıç LLM J (bir yanıtın jailbreak olup olmadığını puanlar).
- Saldırgan LLM A (kırmızı takım iyileştiricisi).
- Hedef dizisi G: "[zararlı talimat] ile yanıt verin."
- Bütçe K (genellikle 20 sorgu).

Döngü, 1..K'deki k için:
1. A, G hedefi ve (prompt, yanıt) çiftlerinin şu ana kadarki geçmişiyle promptedilir.
2. A yeni bir prompt p_k yayar.
3. p_k'yi T'ye gönderin; yanıt al r_k.
4. J kaleye gol atar (p_k, r_k).
5. Eğer puan >= eşik ise, durdurun — jailbreak bulundu.
6. Aksi takdirde, A'nın geçmişine (p_k, r_k) ekleyin; devam etmek.

Ampirik sonuç (NeurIPS 2023): GPT-3.5-turbo, Llama-2-7B-chat'e karşı >%50 saldırı başarı oranı; 10-20 aralığında başarıya giden ortalama sorgular.

### PAIR neden verimlidir?

GCG (Zou ve ark. 2023), gradient ile karşıtsal token soneklerini arar; beyaz kutu model erişimi gerektirir ve okunamayan son ekler üretir. PAIR kara kutudur ve modeller arasında aktarım yapan doğal dil saldırıları üretir. PAIR'in bağlam içi geri bildirimi, saldırganın her reddedilmeden ders almasını sağlar; GCG'nin eşdeğeri yoktur (her yeni token güncellemesinin önceki ilerlemeyi yeniden keşfetmesi gerekir).

### İlgili otomatik saldırılar

- **GCG (Zou ve ark. 2023, arXiv:2307.15043).** Token düzeyinde gradient çekişmeli son ekleri arar. Aktarılabilir beyaz kutu, okunamayan dizeler üretir.
- **AutoDAN (Liu ve diğerleri 2023).** Hiyerarşik bir hedefin rehberliğinde prompt'lar üzerinde evrimsel arama.
- **TAP (Mehrotra ve ark. 2024).** Budama ile saldırı ağacı — birden fazla PAIR tarzı sunumu dallara ayırır.
- **PAP (Zeng ve ark. 2024).** İkna Edici Çekişmeli Prompt'ler — insanı ikna etme tekniklerini prompt şablonları olarak kodlar.

### JailbreakBench ve HarmBench

Her ikisi de (2024) değerlendirmeyi standartlaştırıyor:

- JailbreakBench (arXiv:2404.01318). 10 OpenAI politikası kategorisinde 100 zararlı davranış. Birincil ölçüm olarak saldırı başarı oranı (ASR). Bir hakem gerektirir (GPT-4-turbo, Llama Guard veya StrongREJECT).
- HarmBench (Mazeika ve ark. 2024). Anlamsal ve işlevsel zarar testleri ile 7 kategoride 510 davranış. 18 saldırıyı 33 modelle karşılaştırır.

ASR genellikle sabit bir sorgu bütçesinde raporlanır. Saldırıları karşılaştırmak, bütçelerin eşleştirilmesini gerektirir; 200 sorgudaki %90 ASR, 20 sorgudaki %85 ASR ile karşılaştırılamaz.

### 2026 deployment'lar için önemli olmasının nedeni

Artık her sınır laboratuvarı, piyasaya sürülmeden önce üretim modellerinde PAIR ve TAP çalıştırıyor. ASR yörüngeleri model kartlarında (Ders 26) ve güvenlik durumu eklerinde (Ders 18) görülmektedir. Saldırı egzotik değil; standart altyapıdır.

### Bunun 18. Aşamada yeri nedir

Ders 12, otomatik saldırının temelidir. Ders 13 (Çoklu Çekim Jailbreaking) tamamlayıcı bir uzunluk istismarıdır. Ders 14 (ASCII Sanat/Görsel) bir kodlama saldırısıdır. Ders 15 (Dolaylı Prompt Ekleme), 2026 üretim saldırı yüzeyidir. Ders 16 savunma araçlarının benzerlerini kapsar (Llama Guard, Garak, PyRIT).

## Use It — Hazır Araçla Uygula

`code/main.py` bir oyuncak EŞLEŞTİRME döngüsü oluşturur. Hedef, "bariz" zararlı prompt'ları (anahtar kelime filtresi) reddeden sahte bir sınıflandırıcıdır. Saldırgan, açıklamayı, rol yapma çerçevelemeyi ve kodlamayı deneyen kural tabanlı bir arıtıcıdır. Hakim cevabı puanlıyor. Saldırganın anahtar kelime filtresine karşı ~5-15 yinelemede başarılı olduğunu ve anlamsal filtreye karşı başarısız olduğunu izlersiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-attack-audit.md` üretir. Kırmızı takım değerlendirme raporu verildiğinde, şunları denetler: hangi saldırılar gerçekleştirildi (PAIR, GCG, TAP, AutoDAN, PAP), her biri hangi bütçeyle, hangi yargıçla, hangi zararlı davranışlara göre ayarlandı (JailbreakBench, HarmBench, dahili).

## Egzersizler

1. `code/main.py`'yı çalıştırın. Üç yerleşik saldırgan stratejisi için ortalama sorguların başarıya ulaşmasını ölçün. Her birinin hangi hedef savunma varsayımından yararlandığını açıklayın.

2. Dördüncü saldırgan stratejisini uygulayın (e.g., başka bir dile çeviri, base64 kodlaması). Yeni ortalama sorguları anahtar kelime filtresi hedefine ve anlamsal filtre hedefine göre raporlayın.

3. Chao ve ark.'nı okuyun. 2023 Şekil 5 (PAIR ve GCG karşılaştırması). PAIR'in verimlilik avantajına rağmen GCG'nin tercih edildiği iki senaryoyu açıklayın.

4. JailbreakBench, ASR'yi sabit bir hedefe göre rapor eder. Saldırı çeşitliliğini (başarılı prompt'lardaki fark) ölçen ek bir ölçüm tasarlayın. Savunma değerlendirmesinde çeşitliliğin neden önemli olduğunu açıklayın.

5. TAP (Mehrotra 2024), PAIR'i dallanma + budama ile genişletir. `code/main.py` 'ye TAP tarzı bir uzantı çizin ve hesaplama maliyeti ile başarı oranı arasındaki dengeyi açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| ÇİFT | "otomatik jailbreak" | Prompt Otomatik Yinelemeli İyileştirme; saldırgan-LLM + yargıç-LLM döngüsü |
| GCG | "gradient jailbreak" | Çekişmeli sonekler için beyaz kutu token düzeyinde gradient arama |
| Saldırı başarı oranı (ASR) | "K sorguda jailbreak yüzdesi" | Birincil metrik; sorgu bütçesi ve hakim kimliği ile raporlanmalıdır |
| Yargıç Yüksek Lisans | "golcü" | Bir yanıtın zararlı hedefi karşılayıp karşılamadığını derecelendiren LLM |
| JailbreakBench | "değerlendirme" | Etiketli kategorilerle standartlaştırılmış zararlı davranış kümesi |
| HarmBench | "daha geniş tezgah" | 510 davranış, işlevsel + anlamsal zarar testleri |
| DOKUN | "saldırı ağacı" | Dallanma + budama ile EŞLEŞTİRİN; daha yüksek bilgi işlemde daha iyi ASR |

## Daha Fazla Okuma

- [Chao ve ark. — Yirmi Sorguda Jailbreak Kara Kutu Yüksek Lisansı (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR makalesi, NeurIPS 2023
- [Zou ve ark. — Hizalanmış LLM'lere Yönelik Evrensel ve Aktarılabilir Çekişmeli Saldırılar (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG makalesi
- [Chao ve ark. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — standartlaştırılmış değerlendirme
- [Mazeika ve diğerleri. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — daha geniş değerlendirme
