# AI Bilimci v2  Atölyel-Denevi Otonom Araştırma

> Sakana'nın AI Bilimcisi v2 (Yamada et al., arXiv:2504.08066) tam araştırma döngüsünü yürütüyor: hipotez, kod, deneyler, rakamlar, yazma, gönderme. Bu, ICLR 2025 atölyesinde bir kağıt geçiş eşcinsel incelemesine sahip olan ilk sistemdir. Bağımsız değerlendirme (Beel et al.) deneylerin %42'si kodlama hatalarından başarısız olduğunu ve literatür incelemesi sıklıkla kurulmuş kavramları yeni olarak yanlış etiketlediğini buldu. Sakana'nın doktorları kod tabanının LLM yazılı kodunu uyguladığını ve Docker izolasyonunu önerdiğini uyarıyor. Bu resmin her iki yarısı da önemli.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Sorun

Araştırma açık bir görevdir. AlphaEvolve'ın algoritmik arama veya DGM'in referans sınırlı kendi kendine değiştirmesinden farklı olarak, bir araştırma sonucu makine kontrol edilebilir doğruluk kriterine sahip değildir. Bir makale birim testleri değil, inceleyiciler tarafından değerlendirilir. Bu da döngüyü kapatmayı zorlaştırır  ve kapatıldığında daha değerli olur, çünkü araştırma karmaşık ilerlemenin yaşadığı yerdir.

AI Bilimci v1 (Sakana, 2024) insan tarafından yazılan şablonlardan başlayarak döngüyü kapattı. LLM, sabit bir heykel içinde deneyler yaptı. AI Scientist v2 (Yamada et al., 2025) görme dili modeli eleştirisi döngüsü ile ajanistik ağaç arama kullanılarak şablon gereksinimini kaldırır. Sistem fikirler üretiyor, deneyler uyguluyor, rakamlar üretir, bir makale yazıyor ve eleştirmen geri bildirimlerini tekrarlıyor.

Eşcinsel değerlendirme hükümü: bir v2 üretilen makale ICLR 2025 atölyesinde kabul edildi (açıklama ile). Bağımsız değerlendirme hükümü: sistem güvenilir olmaktan çok uzak. Her ikisi de doğru.

## Anlaşım

### Mimarlık

1. **Idea generation.**LLM, bir konu ve önceki literatür üzerinde koşullanmış araştırma fikirlerini önerir. v1 şablonları kullanır; v2 bir hipotez alanı üzerinde ajantik arama kullanır.
2. **Novelty check.**Bir edebiyat kurtarma adım fikri yayınlanmış olup olmadığını kontrol eder. Bu Beel et al's değerlendirmesinin yanlış etiketleme bulduğu adımdır  sıklıkla yenilik olarak sınıflandırılan kurulmuş yöntemler.
3. **Experiment plan.**Ajan bir deneysel protokol hazırlıyor ve kod yazıyor.
4. **Execution.**Beel et al'ın ölçümlerinde, bu aşamada yapılan deneylerin %42'si kodlama hatalarından dolayı başarısız oldu.
5. **Figure generation.**Görüş dil modelinde oluşturulan rakamları okuyor ve açıklık için yeniden yazıyor.
6. **Writeup.**LLM bir makale hazırlar, iç bir inceleyicilerle tekrarlar.
7. **Optional: submission.**Kağıt bir yere teslim edilir.

### Atölyenin kabul sonucu ne anlama geliyor

Bir v2 üretilen makale ICLR 2025 atölyesinde bir eşeğince incelemeyi geçti. Yazarlar makaleyi program komitesine açıkladı. Kabul bir veri noktasıdır; sistemin " Araştırma yapıyor " diyerek iddia etmek için bir lisans değildir.

Önemli bağlam: atölye makaleleri ana konferans makaleleri ile karşılaştırıldığında daha düşük bir bardır. Eşcinsel inceleme gürültülüdür; verilen bir günde gönderilenlerin küçük bir kısmı kabul edilir. Bir başarı bir konsept kanıtıdır, güvenilirlik iddiası değildir. Nature 2026 makalesi son-son döngüyü belgelendirir ve kendisi insan araştırmacıları tarafından birlikte yazılmıştır; "sistem bir Nature makalesi yazmadı".

### Bağımsız değerlendirme ne buldu

Beel et al. (arXiv:2502.14297) bir dış değerlendirme yaptı.

- **Experiment failures.**Deneyimlerin %42'si kodlama hataları (kötü ithalatlar, şekil eşleşme eksikliği, tanımlanamayan değişkenler) nedeniyle başarısız oldu.
- **Novelty mislabeling.**Edebiyat-içinde bulma adımları sıklıkla kurulmuş kavramları yeni olarak işaretler. Bu, halüsinasyonun araştırma eşdeğeri.
- **Presentation-quality gap.**Görme dili figür eleştirisi, temel deneysel zayıflıkları gizleyen yayın derecesi görseller üretti.

Bu aşamada son bulgu önemli bir sonuç olarak görülüyor. İkna edici araştırma yapmadan ikna edici sonuçlar üreten bir sistem, açıkça başarısız olanlardan daha tehlikeli, daha güvenli değil.

### Kum Kutusu kaçış endişesi

Sakana'nın kendi depoları README uyarıyor:

> LLM'den kaynaklanan kodları uygulayan bu yazılımın doğası nedeniyle, güvenliğini garanti edemeyiz. Tehlikeli paketlerin, kontrolsüz web erişiminin ve istenmeyen süreçlerin doğuşu riskleri vardır.

Bu, doğrulanmamış bir alanda özerkliğin işletim şeklidir. LLM kod yazar; kod çalışır; kod işlemin yapmasına izin verilen her şeyi yapabilir. Dosya sistemi, ağ ve işlem eylemlerini zor sınırlayan kum kutusu olmadan, herhangi bir kendi kendini yönlendiren araştırma ajanı verileri sızdırır, hesapları yakır veya kendini yeniden yazabilir.

AlphaEvolve'in kum kutu hikayesi, değerlendirici sıkı olduğu için daha kolaydır. AI Scientist v2'nin döngüsü açık sonlu hedeflerle açık sonlu kod çalıştırır. Bu nedenle sistemden ayrılmadan önce daha güçlü bir izolasyon (Docker minimum; seccomp / gVisor tercih edilir) ve her gönderimin manuel bir incelemesine ihtiyaç duyar.

### Sınır yığınında v2 yer alırken

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

V2 üçten en zayıf otomatik değerlendirici, en geniş çıkış yüzeyi ve kamu eserlerine en kısa yolu vardır.

```figure
mx-research-loop
```

## Kullan

`code/main.py`v2 döngüsünü bir durum makinesi olarak simüle eder: fikir → yenilik kontrol → deney → figür → yazma → inceleme → kabul-veya tekrarlama. Her durum Beel et al. bulgularından alınan yapılandırılabilir bir başarısızlık olasılığına sahiptir. Simülatörü N döngüsleri için çalıştırın ve sayın:

- Ne kadar fikirler teslim olur.
- Kaç tane yazının inceleme kağıdındaki kritik bir deney hatası olabilir.
- Yeniden deneme bütçeleri kalite karşı verim ile nasıl değişir.

## Gönder

`outputs/skill-ai-scientist-sandbox-review.md`Araştırma döngüsü ajanı tarafından sandbox'dan çıkmadan önce üretilen her şey için iki kapı bir inceleme kontrol listesi.

## Egzersizler

1. Çık .`code/main.py`Bu, bir "temiz" kağıt üreten bir döngü çalışmasının hangi bölümüdür?

2. Defaultlar zaten Beel et al. ' nin % 42 / 25% ' si kullanıyor .`--experiment-failure 0.20 --novelty-mislabel 0.10`Sonra da `--experiment-failure 0.60 --novelty-mislabel 0.40`- Peki iki koşuk arasında nasıl bir parçanın değişmesi olur?

3. Sakana'nın AI Scientist v2 repo README'sini sandbox gereksinimleri üzerine okuyun.

4. Beel et al. bölüm 4'ü okuyun.

5. Araştırma ajanlarının sonuçları için "doktor her makaleyi okuyor"dan daha iyi ölçülecek bir insan inceleme protokolü önerin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## Daha Fazla Okumak

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066)Kağıt.
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) Tıpkı bir eşeğen değerlendirme bağlamı ile tedarikçi özet.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) Dış değerlendirme numaraları.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) Şablonlu öncü.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) Açık araştırma ajanlarının daha geniş bir çerçevesinde.
