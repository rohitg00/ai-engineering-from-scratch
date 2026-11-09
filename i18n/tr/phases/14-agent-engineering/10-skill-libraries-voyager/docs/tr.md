# Yetenek kütüphaneleri ve ömür boyu öğrenme (Voyager)

> Voyager (Wang et al., TMLR 2024) yürütülebilir kodu bir beceri olarak değerlendirir. beceriler çevre geri bildirimleri ile adlandırılır, geri alınır, yapılandırılır ve gelişir. Bu Claude Agent SDK beceri, beceri kit ve 2026 beceri kütüphane örneği için referans mimarisi.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Voyager'ın üç bileşeninin adını verin  otomatik ders programı, beceri kütüphanesi, tekrarlayıcı uyarı  ve her birinin rolü.
- Voyager'ın neden primitif emirler yerine hareket alanı kodunu oluşturduğunu açıkla.
- Kayıt, çekim, kompozisyon ve başarısızlık yönlendirilmiş geliştirme ile stdlib beceri kütüphanesi uygulayın.
- Voyager'ın örneğini 2026 Claude Ajanı SDK becerileri ve beceriler ekosistemi üzerine haritasın.

## Sorun

Her seansta her yeteneği sıfırdan yeniden inşa eden ajanlar üç yanlış şeyi yapar:

1. **Waste tokens.**Her görev aynı mantıkları tekrar ortaya çıkarır.
2. **Lose progress.**A seansında öğrenilen bir düzeltme, B seansına geçmez.
3. **Fail on long-horizon composition.**Karmaşık görevler yetenek hiyerarşilerine ihtiyaç duyar; tek atışlı istekler bunları ifade edemez.

Voyager'ın cevabı: Her tekrar kullanılabilir yeteneği bir kütüphaneye kaydedilen, benzerlik ile geri alabilen, diğer becerilerle uyumlu ve uygulamalar tarafından geri bildirimlerle geliştirilen bir kod parçası olarak değerlendirin.

## Anlaşım

### Üç bileşen

Voyager (arXiv:2305.16291) bir ajanı çevreleyen bir yapı:

1. **Automatic curriculum.**Meraklılık yönlendirilen bir teklifçi, ajanın mevcut beceri setine ve çevre durumuna göre bir sonraki görevi seçer.
2. **Skill library.**Her beceri uygulanabilir bir koddur. Bir görev başarılı olduğunda yeni beceri eklenir. beceri sorgu-tökümsel benzerlik ile alınır.
3. **Iterative prompting mechanism.**Başarısız olduğunda, ajan, yürütme hataları, çevre geri bildirimleri ve kendi kendini doğrulama çıkışı alır, sonra becerileri geliştirir.

Minecraft değerlendirmesi (Wang et al., 2024): 3.3 kat daha benzersiz öğeler, 8.5 kat daha hızlı taş aletler, 6.4 kat daha hızlı demir aletler, 2.3 kat daha uzun harita geçişleri ile temel çizgiler.

### Eylem alanı = kod

Çoğu ajan ilkel komutlar gönderir. Voyager JavaScript fonksiyonlarını gönderir.

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Alt yeteneklerden oluşan, açıklama ve yerleştirme üzerine tuşlanmış, bir istek değil bir program olarak alınan.

Bu 2026 Claude Agent SDK yeteneği: Adlı, geri alabilir bir kod parçası ve ajanın talep üzerine yüklediği talimatlar.

### Yeteneklerin alınması

Yeni görev "Elmas Çekimci Yap".

1. Görev tanımını yerleştirir.
2. Top-k benzer beceriler için beceri kütüphanesine sor.
3. Geri alınır `craftIronPickaxe`- Evet .`mineDiamond`- Evet .`placeCraftingTable`Veb.
4. Yeni beceriyi geri alınan ilkelerden + yeni mantıktan oluşturur.

Bu, MCP kaynakları (Fase 13) ve Agent SDK becerileri uygulamasının kalıbıdır: mevcut göreve yönelik bir bilgi/kod yüzeyi üzerinde geri alınma.

### İteratif rafine

Voyager'ın geri bildirim döngüsü:

1. Ajan bir beceri yazıyor.
2. Yetenek çevreyle karşı karşıya.
3. Üç sinyalden biri geri geliyor:`success`- Evet .`error`(Tapalı izlerle),`self-verification failure`- Evet .
4. Ajan, sinyali bağlam olarak kullanarak yeteneği yeniden yazıyor.
5. Başarıya veya maksimum atışlara kadar.

Bu, çevre temelli doğrulama ile kod üretimi için uygulanan Self-Refine (Dene 05) dir. CRITIC (Dene 05), doğrulayıcı ile aynı dış araçlarla örnektir.

### Eğitim programı ve araştırmalar

Voyager'ın eğitim modülü, ajanın ne yaptığını ve henüz yapmadığını temel alarak "öldeki yakınlarda bir sığınak inşa et" gibi görevleri önerir.

Üretim ajanları için bu, "kayıp olan" operatör olarak çevrilmektedir: mevcut beceri kütüphanesi ve bir alan göz önüne alındığında, henüz hangi beceriyi kapsamıyoruz?

### Bu kalıp yanlış gittiğinde

- **Skill library rot.**Aynı beceri, biraz farklı tanımlarla 10 kez eklenir. Yazdığında deduplasyon eklenir; geri alınan sadece bir tane verir.
- **Composed-skill drift.**Ana baba yeteneği, çocukların geliştirdiği versiyon yeteneğine bağlıdır.
- **Retrieval quality.**Bilgi tanımları üzerinde vektör geri alımı, kütüphanenin birkaç yüzü geçtikçe azalır.`category=tooling`").

```figure
voyager-skills
```

## Yapın

`code/main.py`STDlib beceri kütüphanesi uyguluyor:

- `Skill` isim, açıklama, kod (sırç olarak), versiyon, etiket, bağımlılıklar.
- `SkillLibrary` kayıt, arama (token üst üste geçişi), oluştur (topolojik tür deps), ve geliştir (versiyon güncelleme üzerine çarpma).
- Üç ilkel becerisi kayıtlı bir senaryo ajanı, dördüncüyi oluşturur, bir başarısızlığa uğrar ve geliştirir.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İz kitaplık yazıları, çekim, kompozisyon, başarısız bir yürütme ve v2 gelişimi gösterir. Voyager'ın döngüsü sonuna kadar.

## Kullan

- **Claude Agent SDK skills**(Antropik)  2026 referansı: her beceri bir tanım, kod ve talimatlara sahiptir; bir ajan oturumunda talep üzerine yüklenir.
- **skillkit**(npm: skillkit)  32+ AI kodlama ajanları için ajanlar arası beceri yönetimi.
- **Custom skill libraries** Alan-özel (veriler ajanları için SQL becerileri, alt-üst ajanlar için Terraform becerileri).
- **OpenAI Agents SDK `tools`** aşağıda; her alet hafif bir beceri.

## Gönder

`outputs/skill-skill-library.md`Voyager şeklinde bir beceri kütüphanesi oluşturur. Herhangi bir hedef çalıştırma süresi için kayıt, arama, sürüm düzenleme ve geliştirme ile bağlantılıdır.

## Egzersizler

1.  Dependency Cycle Detektoru ekle`compose()`A'nın A'ya bağlı olduğu A'ya bağlı olan A'nın becerisi A'ya bağlı olduğunda ne olur?
2. Ana baba yeteneği çocuğu oluşturduğunda`crafting@1`, bir inceleme `crafting@2`Ana babasını sessizce yükseltmemelidir.
3. Token-overlap geri alımı cümle dönüştürücü yerleştirmelerle (veya BM25 stdlib implant) değiştirin. 50 yetenekli oyuncak kütüphanesinde geri alımı ölçün.
4. "Eğitim" ajanı ekleyin: mevcut kütüphaneden ve alan tanımından dolayı, 5 eksik beceri önerin.
5. Anthropic'in Claude Agent SDK yetenek belgeleri okuyun oyuncak kütüphanesini SDK'nin yetenek skemasına aktarın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | "Reusable capability" | Named chunk of code + description, retrievable by similarity |
| Skill library | "Agent memory of how-to" | Persistent store of skills, searchable and composable |
| Curriculum | "Task proposer" | Bottom-up goal generator driven by current capability gap |
| Composition | "Skill DAG" | Skills invoking skills; topologically sorted on execution |
| Iterative refinement | "Self-correcting loop" | Env feedback + errors + self-verification fold back into the next version |
| Action-space-as-code | "Programmatic actions" | Emit functions, not primitive commands, for temporally extended behavior |
| Dedup on write | "Skill collapse" | Near-duplicate descriptions collapse to one canonical skill |

## Daha Fazla Okumak

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) orijinal beceriler kitaplığı kağıdı
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) 2026 üretiminde beceriler
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) pratik beceriler ve alt yetenekler
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651)Voyager'ın altındaki rafinecilik döngüsü
