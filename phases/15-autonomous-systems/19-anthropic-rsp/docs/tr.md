# Antropik Sorumlu Ölçeklendirme Politikası v3.0

> RSP v3.0 , 2023 politikasının yerine geçerek 24 Şubat 2026'da yürürlüğe girdi. İki aşamalı hafifletme: Anthropic'in tek taraflı olarak yapacağı şey ile sektör çapında bir öneri olarak çerçevelenen şey (RAND SL-4 güvenlik standartları dahil). Sınır Güvenliği Yol Haritalarını ve Risk Raporlarını tek seferlik çıktılar yerine kalıcı belgeler olarak ekler. 2023 duraklatma taahhüdünü kaldırır. Yapay Zeka Ar-Ge-4 eşiğini tanıttı: Anthropic, bu eşik aşıldığında yanlış hizalama risklerini ve hafifletici önlemleri tanımlayan olumlu bir vaka yayınlamalıdır. Claude Opus 4.6 bunu geçmiyor. Antropik, v3.0 duyurusunda "bunu güvenle göz ardı etmenin zorlaştığını" belirtiyor. SaferAI, 2023 RSP'yi 2,2 olarak derecelendirdi; v3.0 'yi 1.9'a düşürerek Anthropic'i OpenAI ve DeepMind'ın yanında "zayıf" RSP kategorisine yerleştirdiler. Niteliksel eşikler, 2023 niceliksel taahhütlerinin yerini aldı; duraklatma cümlesinin kaldırılması en keskin gerilemedir.

**Tür:** Öğren
**Diller:** Python (stdlib, RSP eşik karar motoru)
**Önkoşullar:** Aşama 15 · 06 (AAR), Aşama 15 · 07 (RSI)
**Süre:** ~45 dakika

## Sorun

Sınır laboratuvarları, kısmen teknik belgeler, kısmen yönetişim belgeleri ve kısmen de düzenleyicilere sinyal niteliğindeki ölçeklendirme politikalarını yayınlamaktadır. RSP v3.0 mevcut Antropik belgedir. Bunu yakından okumak, ona uymanın bağlayıcı olması nedeniyle değil (değildir), ancak çerçevenin, bir laboratuvarın felaket riskini nasıl algıladığını ve ödünleri halka nasıl ilettiğini şekillendirdiği için önemlidir.

v3.0 ve v2.0 farkı yararlı birimdir. Neler eklendi: Sınır Güvenliği Yol Haritaları, Risk Raporları, Yapay Zeka Ar-Ge-4 eşiği. Kaldırılanlar: 2023 duraklatma taahhüdü. Yeniden çerçevelenen şey: Antropik tek taraflı ve endüstri tavsiyesi arasında bölünmüş iki aşamalı bir hafifletme programı. Harici inceleme — SaferAI — puanı 2,2'den (v2) 1,9'a (v3.0) düşürdü. Bir ölçeklendirme politikası bu şekilde daha gösterişli görünürken daha az katı hale gelebilir.

## Konsept

### İki aşamalı azaltma planı

- **Antropik tek taraflı eylemler**: Anthropic'in diğer laboratuvarların ne yaptığından bağımsız olarak yapacağı şey. Eğitim bir eşiğin üzerinde durur, belirli güvenlik önlemleri, belirli deployment geçitleri.
- **Sektör çapında öneriler**: Anthropic, sektörün kolektif olarak yapması gerektiğini düşünüyor. RAND SL-4 güvenlik standartlarını içerir. Bunlar Anthropic'in taahhütleri değil; bunlar politika savunuculuğudur.

İki katmanlı yapı v2'de değildi. Bu, okuyucunun her taahhüdün hangi sütunda yer aldığına bakması gerektiği anlamına gelir. "Sektör çapında öneri" sütununda bir güvenlik önlemi alınması Anthropic'in vaadi değildir; Antropik'in umudu bu.

### Yapay Zeka Ar-Ge-4 eşiği

Bu, bir sonraki önemli eşik olarak yetenek düzeyi RSP v3.0 adlarıdır. Spesifik olarak: AI araştırmasının önemli bir kısmını rekabetçi maliyetle otomatikleştirebilecek bir model. Anthropic, bir modelin bunu aştığını düşündüğünde, ölçeklendirmeye devam etmeden önce yanlış hizalama risklerini ve azaltımları tanımlayan olumlu bir vaka yayınlamalıdır.

Claude Opus 4.6, v3.0 duyurusuna göre bu sınırı geçmiyor. Belge şunu ekliyor: "Bunu güvenle göz ardı etmek zorlaşıyor." Bu ifade önemlidir; eşiğin spekülatif bir sınır değil, canlı bir endişe olmaya yetecek kadar yakın olduğunu kabul ediyor.

Ders 6 (Otomatik Hizalama Araştırması) ve Ders 7 (Yinelemeli Kişisel Gelişim) doğrudan bu eşiği besler. Otomatik hizalama araştırmacılarının araştırma kalitesi çıtasını aşması, AI Ar-Ge-4 eşiğinin yaklaştığının kanıtıdır.

### Sınır Güvenliği Yol Haritaları ve Risk Raporları

v3.0 , iki artifact türünü ayakta duran belgeler düzeyine yükseltir:

- **Sınır Güvenliği Yol Haritası**: Planlanan güvenlik çalışmalarını, yetenek beklentilerini ve hafifletme araştırmalarını açıklayan ileriye dönük belge.
- **Risk Raporu**: piyasaya sürüldükten sonra belirli modellere ilişkin, gözlemlenen kapasiteyi ve kalan riski açıklayan geriye dönük belge.

İkisi de halka açık. Her ikisi de beyan edilen bir ritimle güncellenir. Faydası şudur: okuyucu, Anthropic'in Yol Haritasında yapacaklarını söylediği şeylerin Risk Raporunda rapor ettikleriyle karşılaştırıldığında nasıl olduğunu izleyebilir.

### Duraklatma cümlesinin kaldırılması

2023 RSP'sinde açık bir duraklatma taahhüdü yer alıyordu: Bir model belirli yetenek eşiklerini aşarsa, azaltımlar uygulanana kadar eğitim duraklatılacaktı. v3.0 açık duraklamayı daha yumuşak bir formülasyonla değiştirir (olumlu bir durum yayınlayın, hafifletici önlemler yeterliyse devam edin). SaferAI ve diğer analistler bunu doğrudan yeni belgedeki en güçlü gerileme olarak nitelendirdi.

Değişime ilişkin politika argümanı: 2023'teki niceliksel eşiklerin, 2026 dönemi yetenekleri benchmark'lar tarafından ulaşılamaz olduğu ortaya çıktı çünkü benchmark'lar yeniden ölçeklendirildi. Karşı argüman ise şu: ölçeklendirme politikasındaki duraklatma maddesi bir taahhüt aracıdır; bunu kaldırmak politikanın güvenilirliğini ortadan kaldırır.

### SaferAI'nin sürümü düşürüldü

SaferAI, RSP tarzı belgeleri derecelendiren bağımsız bir kuruluştur. Kamuya açık derecelendirmeleri: 2023 Anthropic RSP 2,2 puan aldı (4,0'ın mevcut en iyi RSP olduğu ve 1,0'ın nominal olduğu bir ölçek üzerinden). v3.0 1,9 puan aldı. Bu, Anthropic'i "orta"dan "zayıf"a taşıyarak zayıf kategoride OpenAI ve DeepMind'a katıldı.

SaferAI'ye göre sürüm düşürme faktörleri:
- Niceliksel eşiklerin yerini niteliksel eşikler aldı.
- Duraklatma taahhüdü kaldırıldı.
- Yapay Zeka Ar-Ge-4 eşik azaltımları, spesifik önlemlerden ziyade "olumlu durum" olarak tanımlanmaktadır.
- İnceleme mekanizmaları, sınırlı bağımsız denetimle Anthropic'in Güvenlik Danışma Grubuna bağlıdır.

### Bu ders ne değildir

Bu bir uyum dersi değil. RSP v3.0 bir düzenleme değildir; hiçbir şey Antropik'i onu takip etmeye zorlamaz. Ders, belgeyi hak ettiği özgüllük ve şüphecilikle okumaktır. Ölçeklendirme politikaları, sınır laboratuarlarının felaket riski durumu hakkında yaydığı birincil kamu sinyalidir. Bunları iyi okumak, işi ileri düzey yeteneklere bağlı olan herkes için pratik bir beceridir.

## Use It — Hazır Araçla Uygula

`code/main.py` , RSP eşik değerlendirme şeklini yansıtan küçük bir karar motoru uygular: bir aday modeli ve bir dizi yetenek ölçümü verildiğinde, AI Ar-Ge-4 eşiğinin aşılıp aşılmadığını, gerekli olumlu durum bölümlerini ve deployment'nin ilerleyip ilerlemeyeceğini geri gönderin. Kasıtlı olarak basittir; amaç belgenin mantığını açık hale getirmektir.

## Ship It — Kullanıma Sun

`outputs/skill-scaling-policy-review.md` , bir ölçeklendirme politikasını (Antropik, OpenAI, DeepMind veya dahili) v3.0 referansına göre inceler: iki katmanlı yapı, eşikler, duraklatma taahhütleri, bağımsız inceleme.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Farklı yetenek seviyelerinde üç sentetik modelle besleme yapın. Eşik değerlendiricisinin beklendiği gibi davrandığını ve doğru olumlu durum şablonunu ürettiğini doğrulayın.

2. RSP v3.0 'yi tam olarak okuyun (32 sayfa). "Sektör çapında öneri" katmanında yer alan her taahhüdü tanımlayın. Bu taahhütlerden hangisi v2'de "Antropik tek taraflı" olurdu?

3. SaferAI'nin RSP derecelendirme metodolojisini okuyun. Puan anahtarını belgeye uygulayarak v3.0 için 1,9 puanlarını yeniden oluşturun. Not düşüşüne en çok hangi puan anahtarı satırı neden oldu?

4. 2023 duraklatma taahhüdü kaldırıldı. 2026 benchmark yeniden ölçeklendirme sorununu kabul ederken politikanın güvenilirliğini koruyan bir değiştirme taahhüdü önerin.

5. RSP v3.0 ile OpenAI Hazırlık Framework v2'yi karşılaştırın (Ders 20). v3.0 'nin daha güçlü olduğu bir alanı seçin. Hazırlıklılığın Framework daha güçlü olduğu bir alanı seç.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| RSP | "Anthropic'in ölçeklendirme politikası" | Sorumlu Ölçeklendirme Politikası; v3.0 24 Şubat 2026 tarihinden itibaren geçerlidir |
| Yapay Zeka Ar-Ge-4 | "Araştırma otomasyonu eşiği" | Önemli yapay zeka araştırmalarını rekabetçi maliyetle otomatikleştirme yeteneği |
| Olumlu durum | "Güvenlik gerekçesi" | Risklerin tanımlandığına ve hafifletme önlemlerinin yeterli olduğuna dair yayınlanmış argüman |
| Sınır Güvenliği Yol Haritası | "İleri plan" | Planlanan güvenlik çalışmaları ve beklenen yeteneklere ilişkin geçerli belge |
| Risk Raporu | "Bir model üzerinde retrospektif" | Gözlemlenen yetenek ve piyasaya sürüldükten sonra kalan riske ilişkin geçerli belge |
| İki aşamalı azaltım | "Tek taraflı sanayiye karşı" | Antropik taahhütler ve endüstri tavsiyeleri, ayrı |
| Taahhüdü duraklat | "2023 maddesi" | Eğitimin duraklatılacağına ilişkin açık söz; v3.0 'da kaldırıldı |
| SaferAI derecelendirmesi | "Bağımsız RSP notu" | Üçüncü taraf değerlendirme listesi; v3.0 1,9 puan aldı (v2 2,2 idi) |

## Daha Fazla Okuma

- [Antropik — Sorumlu Ölçeklendirme Politikası v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 32 sayfalık politikanın tamamı.
- [Antropik — RSP v3.0 duyurusu](https://www.anthropic.com/news/responsible-scaling-policy-v3) — v2'deki değişikliklerin özeti.
- [Antropik — Sınır Güvenliği Yol Haritası](https://www.anthropic.com/research/frontier-safety) — RSP v3.0'den bağlantısı verilen mevcut belge.
- [Antropik — Risk Raporu: Claude Opus 4.6](https://www.anthropic.com/research/risk-report-claude-opus-4-6) — mevcut sınır modeline ilişkin geriye dönük.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — Yapay Zeka Ar-Ge-4'ü ölçülen özerkliğe bağlar.
