# Ölçeklenebilir Gözetim ve Zayıftan Güçlüye Genelleme

> Burns ve ark. (OpenAI Süper Hizalama, "Zayıftan Güçlüye Genelleştirme", 2023) süper hizalama sorunu için bir temsil önerdi: Daha zayıf bir model tarafından üretilen etiketleri kullanarak güçlü bir modele ince ayar yapın. Güçlü model, kusurlu zayıf denetimden doğru şekilde genelleme yaparsa, mevcut insan ölçeğindeki hizalama yöntemleri insanüstü sistemlere kadar genişletilebilir. Ölçeklenebilir gözetim ve W2SG tamamlayıcıdır. Ölçeklenebilir gözetim (tartışma, özyinelemeli ödül modelleme, görev ayrıştırma), gözetmenin etkili kapasitesini artırır, böylece gözetim altındaki modele ayak uydurabilir. W2SG, güçlü modelin gözetmenin sağladığı kusurlu denetimden doğru şekilde genelleme yapmasını sağlar. Tartışma W2SG'nin (arXiv:2501.13124, Ocak 2025) bunları birleştirmesine yardımcı olur.

**Tür:** Öğren
**Diller:** Python (stdlib, W2SG boşluk simülatörü)
**Önkoşullar:** Aşama 18 · 01 (talimatların takibi), Aşama 18 · 10 (Yapay Zeka Kontrolü), Aşama 09 (RL temelleri)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Ölçeklenebilir gözetimi ve zayıftan güçlüye genellemeyi tanımlayın ve bunların nasıl tamamlayıcı olduğunu açıklayın.
- Burns ve diğerlerini tanımlayın. 2023 deneysel kurulumu: GPT-2'deki etiketleri kullanarak GPT-4'e ince ayar yapın.
- Kurtarılan performans açığı (PGR) metriğini ve neyi ölçtüğünü açıklayın.
- Üç ana ölçeklenebilir gözetim mekanizmasını (tartışma, yinelenen ödül modelleme, görev ayrıştırma) ve her birinin güçlü yönünü belirtin.

## Sorun

18. Aşamada şimdiye kadarki her hizalama tekniği, denetçinin modelin davranışını değerlendirebileceğini varsayıyor. Model insanüstü olduğunda gözetmen zayıf halkadır. Süper hizalama sorusu: Daha zayıf bir denetçi, güvenilir bir şekilde daha güçlü, uyumlu bir model üretebilir mi?

Burns ve ark. bunu işlevselleştirilmiş ampirik bir düzene indirgeyin: güçlüyü zayıfla denetleyin, güçlü modelin kapasitesinin ne kadarının zayıf denetime dayandığını ölçün. Bu, aşırı hizalamaya bir çözüm değildir; ilerlemeyi ölçmemize olanak tanıyan bir temsilidir.

## Konsept

### W2SG: Burns ve ark. kurmak

- Zayıf model: GPT-2 sınıfı.
- Güçlü model: GPT-4 sınıfı.
- Hedef: Görevde güçlü GPT-4 tavanı.

Prosedür:
1. Zayıf modelin bir görevle ilgili sıfır atış tahminlerini alın.
2. Zayıf etiketli veriler üzerinde güçlü modele ince ayar yapın.
3. Güçlü ince ayarlı modelin doğruluğunu ölçün.

Temel çizgiler: zayıf modelin kendi doğruluğu, güçlü modelin altın etiketlerde denetlenen tavanı.

Boşluk metriği: Giderilen Performans Farkı (PGR) = (ince ayar - zayıf) / (tavan - zayıf). 1,0'lık PGR, zayıf denetimin açığı tamamen kapattığı anlamına gelir; PGR'nin 0 olması, zayıf denetimin işe yaramadığı anlamına gelir.

### Burns ve ark. ampirik bulgular

NLP, satranç bulmacası ve ödül modelleme görevlerinde PGR sürekli olarak olumluydu: Güçlü model, zayıf denetçinin hatalarının ötesinde genelleştirildi. Göreve özgü PGR ~%20 ila ~%80 arasında değişmektedir. Güçlü model, kusurlu etiketlerden amaçlanan görevi "anlar" ve önceden eğitilmiş öncelikleriyle doldurur.

Sınırlamalar Burns ve ark. Not:
- Buradaki zayıf-güçlü fark uyum değil yetenektir. Zayıf model hizalanmıştır; Gerçek anlamda insanüstü bir model, bir insan tarafından hizalanabilir ancak çok daha büyük bir yetenek boşluğuna sahiptir.
- Güçlü modelin genellemesi, temel gerçek niyetini kurtarmaktan ziyade görev öncelikleriyle ilgili olabilir.
- Güçlü modelin gizli bilgisini ortaya çıkarmak asıl sorundur; PGR belirli bir operasyonelleştirmeyi ölçer.

### Ölçeklenebilir gözetim: üç mekanizma

- **Tartışma (Irving ve ark. 2018).** İki U örneği zıt tarafları tartışıyor; zayıf yargıç karar verir. Varsayım: İkna edici bir doğru cevap bulmak, ikna edici bir yanlış cevap bulmaktan daha kolaydır. Son 2024-2025 çalışmaları (Khan ve diğerleri, Michael ve diğerleri), tartışmanın bazen işe yarayıp bazen yaramadığını ve yardımcı olup olmadığının görev yapısına bağlı olduğunu gösteriyor.
- **Özinelemeli Ödül Modellemesi (Leike ve diğerleri 2018).** U, insanın ödül modelini U+1 için eğitmesine yardımcı olur. Gözetmenin etkili kapasitesi modelinkiyle birlikte artar.
- **Görev Ayrıştırma (Christiano, Shlegeris, Amodei 2018).** Zor bir görevi, insanın tekrar tekrar kontrol edebileceği alt görevlere ayırın. Ayrışabilirliği varsayar.

Her mekanizma, görevin yapısı veya ara bileşenlerin hizalanması hakkında bir şeyler varsayar.

### Ölçeklenebilir gözetim ve W2SG neden tamamlayıcıdır?

Ölçeklenebilir gözetim, gözetmenin etkin sinyal kalitesini artırır.
W2SG, gözetmenin sağlayabileceği kusurlu sinyaller arasındaki boşluğu kapatır.

Lang ve ark. — Tartışma Zayıftan Güçlüye Genellemeye Yardımcı Olur (arXiv:2501.13124) bunları birleştirir: bir tartışma protokolü daha iyi zayıf etiketler sağlar ve güçlü model bu etiketler üzerinde eğitilir. NLP görevlerinde bildirilen PGR kazanımları.

### Organizasyon draması

OpenAI'nin Superalignment ekibi, Jan Leike'nin Anthropic'e ayrılmasının ardından Mayıs 2024'te dağıldı. Gündem (ölçeklenebilir gözetim, W2SG, otomatik hizalama araştırması) Anthropic'te ve MATS (Ders 28), Redwood (Ders 10), Apollo (Ders 8), METR (Ders 28) akademik laboratuvarlarında devam etti. Organizasyon yapısı değişti; araştırma soruları olmadı.

### Bunun 18. Aşamada yeri nedir

6-10 arasındaki dersler, U'nun güvenilmez olduğu varsayımı altındaki tehdidi ve savunma paradigmasını açıklamaktadır. 11. Ders saldırgan paradigmadır: gözetmenin U'nun hizalamasını doğrulayacak kadar güçlü olmasını sağlayın. 12-16. dersler daha sonra çekişmeli değerlendirmenin pratik araçlarına dönüyor.

## Use It — Hazır Araçla Uygula

`code/main.py` sentetik bir görevde W2SG ince ayarını simüle eder. Zayıf etiketleyici, yapılandırılmış hatalarda %70 doğruluğa sahiptir; güçlü model altın etiketlerde %95 tavana sahiptir. Zayıf etiketlerde güçlü modele ince ayar yapar, PGR'yi ölçer ve altın üzerinde güçlü ve tek başına zayıf ile karşılaştırırsınız.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-w2sg-pgr.md` üretir. Bir gözetim kurulumu açıklaması verildiğinde, zayıf denetçiyi, güçlü modeli, denetim kalitesini tanımlar ve PGR'yi hesaplar (veya talep eder). İddianın "zayıf güçlüyü denetleyebilir" mi yoksa "zayıf + gözetim mekanizması güçlüyü denetleyebilir" mi olduğunu işaretler.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Zayıf_doğruluk için PGR'yi rapor edin = 0,60, 0,70, 0,80. PGR eğrisinin şeklini açıklayınız.

2. Zayıf etiketleyiciyi yapısal hataya sahip olacak şekilde değiştirin (e.g., belirli bir giriş sınıfında her zaman yanlış). PGR artıyor mu, azalıyor mu yoksa aynı mı kalıyor? Açıklamak.

3. Burns ve ark.'nı okuyun. 2023 Bölüm 4.3 (NLP görevleri). "Güven yardımcı kaybı" sezgisini yeniden üretin: Güçlü model zayıf etiketlerden daha emin olduğunda kim kazanır?

4. Bir yazılım mühendisliği görevi için tartışmayı ve görev ayrıştırmayı birleştiren ölçeklenebilir bir gözetim protokolü tasarlayın. Her bir bileşenin bir arıza modunu adlandırın ve kombinasyonun her birine nasıl hitap ettiğini veya başarısız olduğunu açıklayın.

5. "Zayıftan güçlüye genelleme süper hizalamaya giden geçerli bir yoldur" iddiasını neyin yanlışlayabileceğini ifade edin. Görmeniz gereken ampirik imza konusunda spesifik olun.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Ölçeklenebilir gözetim | "gözetmenin daha güçlü kılınması" | Bir gözetmenin daha yetenekli bir modeli değerlendirme yeteneğini artıran mekanizmalar |
| W2SG | "zayıf güçlüyü denetler" | Fine-tuning zayıf etiketler üzerine güçlü bir model ve kurtarılan yeteneğin ölçülmesi |
| PGR | "performans açığı düzeldi" | (ince ayarlı - zayıf) / (tavan - zayıf); 1,0 = tamamen kapalı, 0 = yardım yok |
| Tartışma | "iki U örneği tartışıyor" | Zayıf bir hakemin iki ABD savunma oyuncusu arasında seçim yaptığı ölçeklenebilir gözetim mekanizması |
| RRM | "özyinelemeli ödül modelleme" | U, U+1 için ödül modelinin eğitilmesine yardımcı olur; gözetmen kapasitesi U |
| Görev ayrıştırması | "insanın denetlediği alt görevler" | Zor bir görevi, insanın yinelemeli olarak doğrulayabileceği alt görevlere bölün |
| Süper Hizalama | "insanüstü yapay zekayı hizalama" | İnsanın doğrudan değerlendiremeyeceği modelleri hizalamayla ilgili araştırma gündemi |

## Daha Fazla Okuma

- [Burns ve ark. — Zayıftan Güçlüye Genelleme (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) — W2SG makalesi
- [Irving, Christiano, Amodei — Tartışma yoluyla yapay zeka güvenliği (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) — tartışma mekanizması
- [Leike ve ark. — Ödül modelleme aracılığıyla ölçeklenebilir agent hizalaması (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) — özyinelemeli ödül modelleme
- [Khan ve diğerleri. — Daha İkna Edici Yüksek Lisans Programlarıyla Tartışmak Daha Doğru Yanıtlara Yol Açar (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) — Daha güçlü tartışmacılarla yapılan 2024 ampirik tartışma çalışması
- [Lang ve ark. — Tartışma Zayıftan Güçlüye Genellemeye Yardımcı Olur (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) — 2025 tartışma kombinasyonu + W2SG
