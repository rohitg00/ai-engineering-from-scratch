# AI Scientist v2 — Atölye Düzeyinde Otonom Araştırma

> Sakana'nın AI Scientist v2'si (Yamada ve diğerleri, arXiv:2504.08066) tüm araştırma döngüsünü yürütür: hipotez, kod, deneyler, rakamlar, yazılar, sunum. Bir ICLR 2025 çalıştayında kağıt üzerinden geçiş hakem incelemesi oluşturulan ilk sistemdir. Bağımsız değerlendirme (Beel ve diğerleri), deneylerin %42'sinin kodlama hatalarından dolayı başarısız olduğunu ve literatür incelemesinin sıklıkla yerleşik kavramları yeni olarak yanlış etiketlediğini ortaya çıkardı. Sakana'nın kendi belgeleri, kod tabanının LLM tarafından yazılan kodu çalıştırdığı konusunda uyarıyor ve Docker izolasyonunu öneriyor. Bu resmin her iki yarısı da önemli.

**Tür:** Öğren
**Diller:** Python (stdlib, araştırma döngüsü durum makinesi oyuncağı)
**Önkoşullar:** Aşama 15 · 03 (AlphaEvolve), Aşama 15 · 04 (DGM)
**Süre:** ~60 dakika

## Sorun

Araştırma açık uçlu bir görevdir. AlphaEvolve'un algoritmik aramasından veya DGM'nin benchmark sınırlı kendi kendine modifikasyonundan farklı olarak, bir araştırma sonucunun makine tarafından kontrol edilebilir bir doğruluk kriteri yoktur. Bir makale, birim testleri tarafından değil, hakemler tarafından değerlendirilir. Bu, döngünün kapatılmasını zorlaştırır ve kapatıldığında daha değerli hale gelir, çünkü araştırma, ilerlemenin gerçekleştiği yerdir.

AI Scientist v1 (Sakana, 2024), insan tarafından yazılan şablonlardan başlayarak döngüyü kapattı. LLM, sabit bir iskele içindeki deneyleri doldurdu. AI Scientist v2 (Yamada ve diğerleri, 2025), bir vizyon dili modeli eleştiri döngüsüyle agentic ağaç aramasını kullanarak şablon gereksinimini ortadan kaldırır. Sistem fikirler üretir, deneyler uygular, rakamlar üretir, bir makale yazar ve hakemlerin geri bildirimlerini yineler.

Hakem değerlendirmesi kararı: ICLR 2025 çalıştayında v2 tarafından oluşturulan bir makale kabul edildi (açıklamayla birlikte). Bağımsız değerlendirme kararı: Sistem güvenilir olmaktan uzaktır. Her ikisi de doğrudur.

## Konsept

### Mimari

1. **Fikir üretme.** Yüksek Lisans, bir konu ve önceki literatüre dayalı araştırma fikirleri önerir. v1 kullanılan şablonlar; v2, bir hipotez alanı üzerinde agentic aramasını kullanır.
2. **Yenilik kontrolü.** Literatür arama adımı, fikrin yayınlanıp yayınlanmadığını kontrol eder. Bu, Beel ve diğerlerinin değerlendirmesinin yanlış etiketlemeyi bulduğu adımdır; yerleşik yöntemler sıklıkla yeni olarak sınıflandırılır.
3. **Deneme planı.** agent bir deneysel protokol taslağı hazırlar ve kod yazar.
4. **Yürütme.** Kod, korumalı alanda çalışır. Başarısızlıklar yeniden deneme döngüsüne geri beslenir. Beel ve arkadaşlarının ölçümlerinde deneylerin %42'si bu aşamada kodlama hatalarından dolayı başarısız oldu.
5. **Şekil oluşturma.** Bir vizyon dili modeli, oluşturulan rakamları okur ve netlik sağlamak için yeniden yazar. Bu, v2'nin temel teknik ilavesiydi.
6. **Yazma.** LLM bir makale taslağı hazırlar ve dahili bir incelemeci ile yineler.
7. **İsteğe bağlı: gönderim.** Makale bir yere teslim edilir.

### Atölye kabul sonucunun anlamı nedir?

v2 tarafından oluşturulan bir makale, ICLR 2025 çalıştayında hakem değerlendirmesinden geçti. Yazarlar makalenin kaynağını program komitesine açıkladılar. Kabul bir veri noktasıdır; sistemin "araştırma yaptığını" iddia etmek bir lisans değildir.

Önemli bağlam: Çalıştay bildirileri ana konferans bildirilerine göre daha düşük bir çıtaya sahiptir. Akran değerlendirmesi gürültülüdür; herhangi bir günde başvuruların küçük bir kısmı kabul edilir. Bir başarı, bir güvenilirlik iddiası değil, konseptin kanıtıdır. Nature 2026 makalesi uçtan uca döngüyü belgeliyor ve kendisi de insan araştırmacıların ortak yazarı; "sistem bir Nature makalesi yazdı" değildir.

### Bağımsız değerlendirmenin bulguları

Beel ve ark. (arXiv:2502.14297) harici bir değerlendirme gerçekleştirdi. Başlık bulguları:

- **Deneme başarısızlıkları.** Deneylerin %42'si kodlama hatalarından (kötü içe aktarma, şekil uyuşmazlıkları, tanımsız değişkenler) başarısız oldu. Yeniden deneme döngüsü hepsini değil bazılarını yakaladı.
- **Yeniliğin yanlış etiketlenmesi.** Literatür bulma adımı sıklıkla yerleşik kavramları yeni olarak işaretliyordu. Bu halüsinasyonun araştırmadaki eşdeğeridir.
- **Sunum kalitesi farkı.** Vizyon-dil şekil eleştirisi, altta yatan deneysel zayıflıkları maskeleyen yayın düzeyinde görseller üretti.

Son bulgu bu aşama için önemli olanıdır. İkna edici araştırmalar yapmadan ikna edici çıktılar üreten bir sistem, açıkça başarısız olan bir sistemden daha güvenli değil, daha tehlikelidir. Değerlendirme rakamla sınırlı değil, temel iddialara ulaşmalıdır.

### Korumalı alandan kaçış sorunu

Sakana'nın kendi deposu README uyarıyor:

> LLM tarafından oluşturulan kodu çalıştıran bu yazılımın doğası gereği güvenliği garanti edemeyiz. Tehlikeli paketler, kontrolsüz web erişimi ve istenmeyen süreçlerin ortaya çıkması riskleri vardır. Riski size ait olmak üzere kullanın ve Docker yalıtımını düşünün.

Bu, doğrulanmamış bir alandaki özerkliğin operasyonel şeklidir. LLM kod yazar; kod çalışır; kod, sürecin yapmasına izin verilen her şeyi yapabilir. Dosya sistemini, ağı ve süreç eylemlerini katı bir şekilde sınırlayan bir sanal alan olmadan, agent kendi kendini yönlendiren herhangi bir araştırma verileri sızdırabilir, bilgi işlemi yakabilir veya kendini yeniden yazabilir.

AlphaEvolve'un sandbox hikayesi daha kolaydır çünkü değerlendiricisi sıkıdır. AI Scientist v2'nin döngüsü, açık uçlu hedeflerle açık uçlu kod çalıştırır. Bu nedenle daha güçlü bir izolasyona (minimum Docker; seccomp / gVisor tercih edilir) ve sistemden ayrılmadan önce her gönderimin manuel olarak incelenmesine ihtiyaç duyar.

### v2'nin sınır yığınında bulunduğu yer

| Sistem | Hedef | Çıkış türü | Değerlendirici | Bilinen arıza |
|---|---|---|---|---|
| AlphaEvolve | algoritmalar | kodu | birim + benchmark | değerlendiricinin titizliğiyle sınırlanmıştır |
| DGM | agent iskele | kodu | SWE-bank | ödül hackleme |
| Yapay Zeka Bilimcisi v2 | araştırma kağıtları | metin + kod + rakamlar | hakem değerlendirmesi (zayıf) | deney başarısızlıkları, yanlış etiketleme, maskeleme zayıflığının cilalanması |

v2, üçü arasında en zayıf otomatik değerlendiriciye, en geniş çıktı yüzeyine ve genel artifact'lere giden en kısa yola sahiptir. Operasyonel kontroller (korumalı alan, inceleme, açıklama) güvenlik çalışmalarının çoğunu gerçekleştiriyor.

## Kullan onu

`code/main.py`, v2 döngüsünü bir durum makinesi olarak simüle eder: fikir → yenilik kontrolü → deney → şekil → yazma → inceleme → kabul et veya yinele. Her durumun Beel ve diğerlerinden alınan yapılandırılabilir bir arıza olasılığı vardır. bulgular. Simülatörü N döngü için çalıştırın ve sayın:

- Kaç fikrin gönderime ulaştığı.
- Kaç başvurunun cilalı kağıdın gizlediği kritik bir deneysel kusura sahip olacağı.
- Bütçeleri yeniden denemede kalite ve getiri arasında nasıl bir denge kurulur?

## Gönderin

`outputs/skill-ai-scientist-sandbox-review.md`, agent araştırma döngüsü tarafından korumalı alandan ayrılmadan önce üretilen her şey için iki kapılı bir inceleme kontrol listesidir.

## Egzersizler

1. `code/main.py`'yi varsayılan parametrelerle çalıştırın. Döngü işlemlerinin ne kadarı "temiz" bir kağıt üretir? Şekil eleştirisinin cilaladığı deney-başarısızlık kusuruna sahip bir makalenin hangi kısmı üretir?

2. Varsayılanlar zaten Beel ve diğerlerinin %42 / %25'ini kullanıyor. `--experiment-failure 0.20 --novelty-mislabel 0.10` ve ardından `--experiment-failure 0.60 --novelty-mislabel 0.40` ile yeniden çalıştırın. Gösterişli ama kusurlu pay iki çalışma arasında nasıl değişiyor?

3. Sandbox gereksinimleriyle ilgili Sakana'nın AI Scientist v2 deposu README'yi okuyun. Çok günlü otonom çalıştırma için uygulayacağınız iki ek kısıtlamayı (Docker'ın ötesinde) belirtin.

4. Beel ve ark.'nı okuyun. Bölüm 4, sunum kalitesi boşluğu ile ilgili. Parlak görünümlü ancak deneysel açıdan kusurlu kağıtları yakalayacak ek bir değerlendirici tasarlayın.

5. Araştırma çıktıları için "bir doktora öğrencisi her makaleyi okur"dan daha iyi ölçeklenen bir insan incelemesi protokolü önerin. Darboğazı tanımlayın ve etrafındaki tasarımı yapın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Yapay Zeka Bilimcisi v1 | "Sakana'nın şablonlu araştırması agent" | Sabit bir iskelede doldurulmuş deneyler |
| Yapay Zeka Bilimcisi v2 | "Şablonsuz araştırma agent" | VLM şekil eleştirisi ile Agentic ağaç araması |
| Agentic ağaç arama | "Araştırmanın dallara ayrılması agent" | Birden fazla deneme planını paralel olarak genişletir; iç eleştirmenden kuru erik |
| Vizyon-dil eleştirisi | "Rakamlarda VLM cilası" | Multimodal model, rakamları okur ve netlik sağlamak için yeniden yazar |
| Literatür alımı | "Yenilik kontrolü" | Fikrin yeniliğini doğrulamak için önceki çalışmaları arar - yanlış etiketleme için belgelenmiştir |
| Polonya maskeleme | "Güzel kağıt, bozuk araştırma" | Sunum kalitesi deneysel kaliteyi aşıyor; zayıflıkları gizler |
| Korumalı alandan kaçış | "LLM kodu çıkıyor" | Agent ile yürütülen kod, döngü tasarımcısının amaçlamadığı şeyleri yapar |

## Daha Fazla Okuma

- [Yamada ve ark. (2025). AI Scientist-v2](https://arxiv.org/abs/2504.08066) — makale.
- [Nature 2026 yayınındaki Sakana blogu](https://sakana.ai/ai-scientist-nature/) — hakem değerlendirmesi bağlamıyla tedarikçi özeti.
- [Beel ve ark. (2025). The AI ​​Scientist'in bağımsız değerlendirmesi](https://arxiv.org/abs/2502.14297) — harici değerlendirme numaraları.
- [Sakana AI Scientist v1 makalesi](https://arxiv.org/abs/2408.06292) — şablonlu öncül.
- [Antropik — Yapay Zeka agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — açık uçlu araştırma agent'lerin daha geniş çerçevesi.
