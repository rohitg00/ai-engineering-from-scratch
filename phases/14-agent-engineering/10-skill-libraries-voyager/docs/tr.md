# Beceri Kütüphaneleri ve Yaşam Boyu Öğrenme (Voyager)

> Voyager (Wang ve diğerleri, TMLR 2024) çalıştırılabilir kodu bir beceri olarak ele alır. Beceriler çevreden gelen geri bildirimlerle adlandırılır, geri alınabilir, düzenlenebilir ve geliştirilebilir. Bu, Claude Agent SDK becerileri, beceri seti ve 2026 beceri kitaplığı modeli için referans mimarisidir.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 07 (MemGPT), Aşama 14 · 08 (Letta Blokları)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Voyager'ın üç bileşenini (otomatik müfredat, beceri kitaplığı, yinelemeli prompting) ve her birinin rolünü adlandırın.
- Voyager'ın neden ilkel komutlar değil de eylem alanı kodunu yaptığını açıklayın.
- Kayıt, erişim, kompozisyon ve hataya dayalı iyileştirme ile bir stdlib beceri kütüphanesi uygulayın.
- Voyager'ın modelini 2026 Claude Agent SDK becerileri ve beceri seti ekosistemiyle eşleyin.

## Sorun

Her oturumda her yeteneği sıfırdan yeniden oluşturan Agent'lar üç şeyi yanlış yapar:

1. **tokens israfı.** Her görev aynı mantığı yeniden ortaya çıkarır.
2. **İlerleme kaybı.** A oturumunda öğrenilen bir düzeltme B oturumuna aktarılmaz.
3. **Uzun vadeli kompozisyonda başarısız olun.** Karmaşık görevler, yetenek hiyerarşilerine ihtiyaç duyar; tek seferlik prompt'lar bunları ifade edemez.

Voyager'ın cevabı: Her yeniden kullanılabilir yeteneği, bir kitaplıkta depolanan, benzerlik yoluyla geri alınabilen, diğer becerilerle birleştirilebilen ve yürütme geri bildirimi ile geliştirilebilen adlandırılmış bir kod parçası olarak ele alın.

## Konsept

### Üç bileşen

Voyager (arXiv:2305.16291) bir agent'yı aşağıdakiler etrafında yapılandırır:

1. **Otomatik müfredat.** Merak odaklı bir önerici, bir sonraki görevi agent'nin mevcut beceri seti ve ortam durumuna göre seçer. Keşif aşağıdan yukarıya doğru yapılır.
2. **Beceri kütüphanesi.** Her beceri çalıştırılabilir koddur. Bir görev başarılı olduğunda yeni beceriler eklenir. Beceriler sorgudan açıklamaya benzerliğe göre alınır.
3. **Yinelemeli prompting mekanizması.** Başarısızlık durumunda, agent yürütme hatalarını, ortam geri bildirimini ve kendi kendini doğrulama çıktısını alır ve ardından beceriyi geliştirir.

Minecraft değerlendirmesi (Wang ve diğerleri, 2024): 3,3 kat daha fazla benzersiz öğe, 8,5 kat daha hızlı taş aletler, 6,4 kat daha hızlı demir aletler, taban çizgilerine göre 2,3 kat daha uzun harita geçişi. Sayılar Minecraft'a özgüdür ancak desen aktarılır.

### Eylem alanı = kod

Çoğu agent ilkel komutlar yayar. Voyager, JavaScript işlevlerini yayar. Bir beceri:

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Alt becerilerden oluşur. Açıklama ve embedding anahtarlanarak saklandı. prompt olarak değil, program olarak alındı.

Bu, 2026 Claude Agent SDK becerisidir: adlandırılmış, geri alınabilir bir kod parçası artı agent'nin talep üzerine yükleyeceği talimatlar.

### Beceri alımı

Yeni görev "elmas kazma yap." Agent:

1. Görev açıklamasını ekler.
2. En iyi benzer beceriler için beceri kitaplığını sorgular.
3. `craftIronPickaxe`, `mineDiamond`, {`placeCraftingTable` vb.'yi alır.
4. Alınan ilkellerden + yeni mantıktan yeni beceriyi oluşturur.

Bu, MCP kaynaklarının (Aşama 13) ve Agent SDK becerilerinin uyguladığı kalıptır: mevcut göreve göre belirlenmiş bir bilgi/kod yüzeyi üzerinden erişim.

### Yinelemeli iyileştirme

Voyager'ın geri bildirim döngüsü:

1. Agent bir beceri yazar.
2. Beceri çevreye karşı çalışır.
3. Üç sinyalden biri şunu döndürür: `success`, `error` (yığın izlemeli), {`self-verification failure`.
4. Agent sinyali bağlam olarak kullanarak beceriyi yeniden yazar.
5. Başarıya veya maksimum tura kadar döngü yapın.

Bu, ortama dayalı doğrulamayla kod oluşturmaya uygulanan Kendi Kendini İyileştirmedir (Ders 05). ELEŞTİRİ (Ders 05), doğrulayıcı ile harici araçlarla aynı modeldir.

### Müfredat ve keşif

Voyager'ın müfredat modülü, agent'nın sahip olduğu ve henüz yapmadığı şeylere dayanarak "göl yakınında bir barınak inşa etmek" gibi görevler önermektedir. Teklif sahibi, mevcut yeteneğin hemen üzerindeki bir görevi (keşif için en uygun nokta) seçmek için ortam durumu + beceri envanterini kullanır.

Üretim agent'leri için bu, "eksik olan" operatörü anlamına gelir: mevcut beceri kitaplığı ve alan adı göz önüne alındığında, henüz hangi becerileri kapsamıyoruz? Ekipler genellikle bunu müfredat incelemesi olarak manuel olarak uygular.

### Bu modelin yanlış gittiği yer

- **Beceri kitaplığı çürüyor.** Aynı beceri, biraz farklı açıklamalarla 10 kez eklendi. Yazma sırasında tekilleştirme ekleyin; alma yalnızca bir tane döndürür.
- **Oluşturulmuş beceri kayması.** Ebeveyn becerisi, çocuğun gelişmiş olmasına bağlıdır. Sürüm becerileri; v1'e sabitlenmiş bir ebeveyn sihirli bir şekilde v3'ü algılamaz.
- **Geri alma kalitesi.** Kitaplık birkaç yüzden fazla büyüdükçe beceri açıklamaları üzerinden vektör alma özelliği düşer. Etiket filtreleri ve katı kısıtlamalarla destek ("yalnızca `category=tooling` ile beceriler").

## İnşa Et

`code/main.py` bir stdlib beceri kitaplığı uygular:

- `Skill` — ad, açıklama, kod (dize olarak), sürüm, etiketler, bağımlılıklar.
- `SkillLibrary` — kaydedin, arayın (token çakışma), oluşturun (topolojik derinlik türleri) ve hassaslaştırın (güncellemede sürüm artışı).
- Üç temel beceriyi kaydeden, dördüncüyü oluşturan, başarısızlığa uğrayan ve hassaslaştıran komut dosyasıyla yazılmış bir agent.

Çalıştır:

```
python3 code/main.py
```

İz, kitaplık yazma, alma, oluşturma, başarısız bir yürütme ve v2 iyileştirmesini (Voyager'ın uçtan uca döngüsü) gösterir.

## Kullan onu

- **Claude Agent SDK becerileri** (Antropik) — 2026 referansı: her becerinin bir açıklaması, kodu ve talimatları vardır; agent oturumu sırasında talep üzerine yüklendi.
- **skillkit** (npm: skillkit) — 32'den fazla AI kodlama agent için çaprazagent beceri yönetimi.
- **Özel beceri kitaplıkları** — alana özgü (veri agent'ler için SQL becerileri, alt agent'lar için Terraform becerileri). Voyager modeli küçülür.
- **OpenAI Agent'nin SDK'sı `tools`** — alt uçta; her araç hafif bir beceridir.

## Gönderin

`outputs/skill-skill-library.md`, herhangi bir hedef çalışma zamanı için kayıt, erişim, sürüm oluşturma ve iyileştirme ile Voyager şeklinde bir beceri kitaplığı oluşturur.

## Egzersizler

1. `compose()`'ya bir bağımlılık döngüsü dedektörü ekleyin. A becerisi A'ya bağlı olan B'ye bağlı olduğunda ne olur? Hata mı uyarı mı?
2. Beceri başına sürüm sabitlemeyi uygulayın. Bir ana beceri, `crafting@1` alt öğesini oluşturduğunda, `crafting@2` üzerinde yapılan bir iyileştirme, üst öğeyi sessizce yükseltmemelidir.
3. token-overlap alımını cümle-transformers embedding'ler (veya bir BM25 stdlib impl) ile değiştirin. 50 beceriye sahip bir oyuncak kütüphanesinde geri kazanımı @5 ölçün.
4. Bir "müfredat" agent ekleyin: mevcut kitaplık ve alan açıklaması göz önüne alındığında, 5 eksik beceriyi önerin. Haftalık olarak arayın.
5. Anthropic'in Claude Agent SDK beceri belgelerini okuyun. Oyuncak kitaplığını SDK'nın beceri şemasına taşıyın. Keşfedilebilirlikle ilgili ne gibi değişiklikler var?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Beceri | "Yeniden kullanılabilirlik" | Adlandırılmış kod parçası + açıklama, benzerliğe göre alınabilir |
| Beceri kütüphanesi | "Agent nasıl yapılır anısı" | Aranabilir ve oluşturulabilir kalıcı beceriler deposu |
| Müfredat | "Görev teklif eden" | Mevcut yetenek açığına dayalı aşağıdan yukarıya hedef oluşturucu |
| Kompozisyon | "Beceri DAG'ı" | Becerileri çağıran beceriler; yürütme sırasında topolojik olarak sıralanmıştır |
| Yinelemeli iyileştirme | "Kendi kendini düzelten döngü" | Env geri bildirimi + hatalar + kendi kendini doğrulama bir sonraki sürüme geri katlanır |
| Kod olarak eylem alanı | "Programatik eylemler" | Geçici olarak genişletilmiş davranış için ilkel komutlar yerine işlevler yayınlayın |
| Yazma sırasında yinelenenleri kaldırma | "Beceri çöküşü" | Neredeyse yinelenen açıklamalar tek bir standart beceriye indirgeniyor |

## Daha Fazla Okuma

- [Wang ve diğerleri, Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) — orijinal beceri kütüphanesi makalesi
- [Claude Agent SDK'ya genel bakış](https://platform.claude.com/docs/en/agent-sdk/overview) — 2026 ürünü olarak beceriler
- [Antropik, Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) ile agent'ler oluşturma — pratikte beceriler ve altagent'lar
- [Madaan ve diğerleri, Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — Voyager'ın altındaki iyileştirme döngüsü
