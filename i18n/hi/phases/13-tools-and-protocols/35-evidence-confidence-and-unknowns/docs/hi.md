# द्विआधारी विश्लेषण में साक्ष्य, विश्वास और अज्ञात

> एक संकलित कार्यक्रम के बारे में एक निष्कर्ष एक हैश, एक विश्वास, एक प्राधिकरण और एक सूची के साथ एक रिकॉर्ड है जो यह नहीं दिखा सकता है।

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## सीखने के लक्ष्य

- एक सबूत रिकॉर्ड बनाएँ जो रियल के मॉडल पर आधारित हो।`Evidence`अवलोकन, व्युत्पन्न और निष्कर्ष के साथ विश्वास।
- सामग्री-हैश आईडी की गणना करें जो फ़ाइल को दूसरे फ़ोल्डर में स्थानांतरित करने पर समान रहें।
- रिकॉर्ड के साथ यात्रा करने वाली सीमाओं के रूप में प्रत्येक प्रदाता क्या नहीं दिखा सकता है, उसे रिकॉर्ड करें।
- फ़ंक्शन के एक अवलोकन किए गए रन द्वारा समर्थित होने तक परिणाम का उल्लेख करने से इनकार करें।
- शेष अज्ञात को एक हैश श्रृंखला द्वारा जोड़ा गया संशोधित रिकॉर्ड के रूप में रखें।
- कैश प्रदाता एक सटीक कुंजी के तहत जवाब देता है और एक पुराने पुनरावृत्ति से इनकार करता है।

## समस्या

आप एक एजेंट से पूछें कि क्या`grade`में `ledger-x86_64-O1.o`एक समीक्षक पूछता है कि एजेंट कैसे जानता है। एजेंट के पास एक पाठ ब्लॉक है कि गिदरा प्रिंट किया गया है। डिफ़ॉल्ट पथ के लिए, यह पाठ पढ़ता है`uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`. उस बिंदु पर बाइट कहते हैं`xor eax, eax`. .

अभिव्यक्ति और निर्देश दोनों प्रत्येक इनपुट के लिए 0 उत्पन्न करते हैं। एजेंट को यह नहीं पता था। यह पाठ पर भरोसा करता था क्योंकि एक उपकरण ने इसे उत्पन्न किया। 2026 के एक अध्ययन में 24 रिवर्स इंजीनियरिंग कार्यों पर तीन एजेंटों को चलाया गया ([NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)) इसमें चार आवर्ती कमजोरीएं बताई गई हैंः प्रशिक्षण पूर्वाग्रह, अवलोकनों में अत्यधिक विश्वास, संदर्भ सीमाएं और योजना की दृढ़ता। एक अन्य 2026 अध्ययन ने बाइनरी के अंदर पाठ लगाया और पाया कि मॉडल 40 मामलों में से 35 में लगाए गए असुरक्षित कार्रवाई का प्रस्ताव दिया ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507)) ।

rea 6.5.0 एजेंट को इसके लिए एक शब्दावली देता है। प्रत्येक सफल उपकरण कॉल एक उत्पन्न करता है।`Evidence`एक के साथ रिकॉर्ड`confidence``observed`,`derived`या `inferred`, एक `authority`, और एक सूची `limitations`. पैकेज्ड कौशल एजेंट को बताता हैः "हर निष्कर्ष को अवलोकन, निष्कर्ष और अज्ञात को अलग करना चाहिए। साक्ष्य आईडी का उल्लेख करें, सीमाओं और अपूर्ण कवरेज को बनाए रखें, और कभी भी यह नहीं बताएं कि स्थैतिक विश्लेषण ने अवलोकन निष्पादन का संकेत दिया है। "

तीन चीजें वास्तव में आपको छोड़ देती हैं। इसके स्नैपशॉट सटीक क्वेरी परिणामों को कैश करते हैं, विश्लेषण नहीं करते हैं। इसकी सत्यापन एक दावे को पारित करता है जब तुलना आयाम अपरिवर्तित होता है, और इसकी अपनी टिप्पणी कहती है कि एक पास "वैश्विक कार्यान्वयन समकक्षता स्थापित नहीं करता है।" इसकी बाध्यता लेजर केवल जावास्क्रिप्ट और प्रबंधित ग्राफ से उम्मीदवारों को लेता है, इसलिए एक मूल फ़ंक्शन कभी नहीं पहुंचता है।`verified`इसके माध्यम से.

इस पाठ में सादे पायथन में गायब टुकड़ा बनाया जाता है. आप एक प्रमुख लिखते हैं जो एक सामग्री हैश के साथ एक रिकॉर्ड के रूप में फिक्स्चर के बारे में हर तथ्य को संग्रहीत करता है. आप भविष्यवाणियां करते हैं`percent_change`और `grade`आप दो असली rea रिकॉर्ड और स्नैपशॉट वे से आए आयात करते हैं, और अपनी कैडर हर हैश rea लिखा फिर से गणना करता है.

```figure
re-evidence-ledger
```

## विश्वास के लिए तीन शब्द, अधिकार के लिए पांच शब्द

`confidence`तीन मानों वाला एक enum है, कभी भी एक संख्या नहीं। `authority`जब कोई उत्पादक कुछ नहीं कहता है, तो rea उपयोग करता है`shipped-artifact`के साथ`observed`. .

| Value | Meaning on the fixture | Records in this lesson |
|---|---|---|
| `observed` | A fact read from bytes or from a run | the ELF reader's section and symbol reads, the two Ghidra records, 17 host runs |
| `derived` | A fact computed from observed records | the switch table model, the division model, every unknown mutation |
| `inferred` | An expectation that no observation states yet | 18 predictions |
| `shipped-artifact` | The file on disk was the source | every read of `ledger-x86_64-O1.o` |
| `controlled-replay` | A run you controlled produced the fact | the host runs of `harness.c` |
| `analyst-inference` | Your own judgement | predictions and unknown mutations |
| `historical-reference` | An older source tree or document | none here |
| `external-service` | A service outside the file and the host | none here |

दो भ्रम सबसे अधिक समय खर्च करते हैं। पहला व्यवहार के अवलोकन के रूप में छद्म कोड को संबोधित करता है। यह गिदरा द्वारा छापे गए कार्यों का अवलोकन है। दूसरा अनुपस्थिति के प्रमाण के रूप में एक खाली सूची को संबोधित करता है। rea का डिज़ाइन नोट सख्त हैः "अज्ञात कवरेज गायब है, अनुपस्थिति नहीं।"`code/main.py`दोनों नियमों को एन्कोड करता है।

## रिकॉर्ड

एक रिकॉर्ड में ठीक 16 फ़ील्ड होते हैं, और rea 6.5.0 किसी अन्य फ़ील्ड को अस्वीकार करता है। `code/main.py`रिया के समान नाम रखता है, इसलिए एक रिकॉर्ड दोनों तरफ से दूसरे पर मान्य करता है।`relationship_coverage`, कॉलर्स या कॉलर्स की सूची कितनी पूर्ण है, यह बताता है। इसका मूल्य है`complete`,`partial`या `unknown`या `null`जब ऑपरेशन कोई कॉल संबंध नहीं रिपोर्ट करता है।

| Field | What it holds |
| --- | --- |
| `evidence_id` | `ev_` and 64 hex digits, a hash of the content |
| `subject` | `name`, `digest.sha256`, `format`, `architecture`, `local_path`, or `null` |
| `provider` | `id`, `name`, `version` or `null` |
| `analysis_profile` | the provider's settings and their digest, or `null`, always present |
| `predicate_type` | a tag, `rea.analysis` by default |
| `operation`, `parameters` | the tool and its input |
| `raw_result`, `normalized_result` | provider output and the canonical result |
| `confidence`, `authority` | the enums above |
| `environment` | `id`, `platform`, `architecture`, `isolation`, or `null` |
| `limitations` | plain sentences |
| `relationship_coverage` | `status` `complete`, `partial`, or `unknown` with diagnostics, or `null` |
| `locations` | `address`, `address-range`, `artifact-path`, `file-offset`, `file-offset-range` |
| `evidence_links` | the `ev_` ids this record rests on |

यह वास्तविक रिकॉर्ड है जो उसने लिखा था`grade`, क्षेत्र जो यहाँ महत्वपूर्ण हैं काट दिया. पूरी फ़ाइल है`code/fixtures/rea-evidence-grade.json`, 37,573 बाइट्स.

```json
{
  "evidence_id": "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1",
  "subject": {
    "name": "ledger-x86_64-O1.o",
    "digest": { "sha256": "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f" },
    "format": "elf",
    "architecture": "x86_64",
    "local_path": "/private/tmp/aiefs-re/phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures/ledger-x86_64-O1.o"
  },
  "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
  "analysis_profile": {
    "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
    "parameters": { "jump_table_evidence": "typed-case-default-blocks-v1", "import_mode": "ephemeral-source-immutable" },
    "digest": "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
  },
  "operation": "analyze_function",
  "parameters": { "procedure": "grade" },
  "confidence": "observed",
  "authority": "shipped-artifact",
  "environment": null,
  "limitations": [
    "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>.",
    "Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals."
  ],
  "relationship_coverage": {
    "status": "complete",
    "diagnostics": [
      "Only resolved Ghidra call references are returned; unresolved computed or indirect calls remain unknown, while function classifications distinguish thunks and externals."
    ]
  },
  "locations": [],
  "evidence_links": []
}
```

असली `parameters`प्रोफ़ाइल के वस्तु में 25 कुंजी है. असली `limitations`सूची में दस वाक्य हैं. उन्हें रखें. एक सीमा सामग्री का हिस्सा है, तो एक छोड़ने आईडी बदलता है, और अपनी बड़ी तब रिकॉर्ड को अस्वीकार कर देगा।

ध्यान दें कि रिकॉर्ड क्या नहीं कहता है।`environment`है `null`क्योंकि गिदरा ने एक फाइल पढ़ी और कुछ नहीं खोला।`locations`खाली है क्योंकि इस ऑपरेशन रिपोर्ट में पता अंदर है `normalized_result`. .`relationship_coverage`स्थिति है `complete`. इसका निदान कहता है कि केवल हल किए गए गिद्रा कॉल संदर्भ लौटाए जाते हैं, और अनसुलझे कंप्यूटर या अप्रत्यक्ष कॉल अज्ञात रहते हैं। इसलिए कॉलर और कॉलली सूची केवल हल किए गए कॉल के लिए पूरी होती है।

## पहचान सामग्री का एक हश है, और मार्ग उसमें नहीं है

वास्तविक कम्प्यूटर `evidence_id`जैसे `ev_`आरएफसी 8785 के काननिकल JSON पर एक रिकॉर्ड के प्रोजेक्शन के साथ SHA-256। प्रोजेक्शन विषय की रखती है `digest`,`format`और `architecture`और बूंदें `name`और `local_path`. . . यह गिर जाता है .`relationship_coverage`जब इसका मूल्य `null`, तो कॉल संबंध के बिना एक रिकॉर्ड एक ही आईडी रखता है कि क्षेत्र अस्तित्व में से पहले के रूप में.`raw_result`और हर सीमा, हैश किया जाता है।

आरएफसी 8785 ऑब्जेक्ट कुंजी को सॉर्ट करता है, व्हाइटस्पेस को हटाता है, और संख्या और स्ट्रिंग फॉर्म को ठीक करता है। उन रिकॉर्ड के लिए जिनके संख्याएं पूर्णांक हैं, पायथन की मानक पुस्तकालय समान बाइट्स उत्पन्न करती हैः

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py`यह हैश करने से पहले फ्लोट्स से इनकार करता है, क्योंकि आरएफसी 8785 और पायथन कुछ फ्लोट्स को अलग तरह से प्रिंट करते हैं। दो रियल रिकॉर्ड और स्नैपशॉट में कोई फ्लोट्स नहीं होते हैं, इसलिए नुस्खा हर रियल हैश को पुनः प्रस्तुत करता हैः

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

पथ को क्यों बाहर किया जाए? एक ही बाइट्स के एक ही अवलोकन को किसी भी मशीन पर और किसी भी फ़ोल्डर में एक ही आईडी मिलती है।`local_path`उपरोक्त सूची में एक मैक पर फ़ोल्डर के नाम हैं. जब आप फ़िक्स्चर को कॉपी करते हैं तो आईडी नहीं बदलता है `/home/you/re`. .`rebind_subject_path()`यह एक नए पथ के तहत एक रिकॉर्ड दिखाता है. यह जब इनकार करता है`sha256`,`format`या `architecture`6.5.0 के साथ भी ऐसा ही होता है `rebindEvidenceToTargetPath`जब यह एक नए पथ पर एक लक्ष्य के लिए एक स्नैपशॉट रिकॉर्ड को पुनः चलाता है।

`validate_evidence()`यह आईडी को पुनः गणना करता है और रेआ के वाक्य के साथ एक असंगतता को अस्वीकार करता है, "सबूत अर्थिक पहचानकर्ता उसके रिकॉर्ड से मेल नहीं खाता है।" यह एक रिकॉर्ड को भी अस्वीकार करता है जिसका `analysis_profile.provider`अपने से भिन्न है `provider`. . परीक्षण`test_tampered_id_and_mismatched_profile_are_rejected`वास्तविक के अंदर एक पंक्ति के छद्म कोड संपादित करता है `grade`रिकॉर्ड और देख लेजर इसे अस्वीकार कर दिया।

## वस्तु को स्वयं देखें

किसी भी प्रदाता से पहले, लेजर फाइल पढ़ता है।`observe_object()`ELF64 अनुभाग के शीर्षकों का विश्लेषण करता है, `.symtab`,`.strtab`और `.rela.text`के साथ`struct.unpack_from`. . यह एक लिखता है `inspect_object`रिकॉर्ड और एक `read_function_bytes`प्रत्येक फ़ंक्शन प्रतीक पर रिकॉर्ड। सभी पांच हैं `observed`अधिकार के साथ`shipped-artifact`, क्योंकि स्रोत डिस्क पर फ़ाइल थी.

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t`सहमत हैः `grade`पर`0000000000000010`आकार के साथ `2e`. तीन स्थानान्तरणों में `.rela.text`हैं`R_X86_64_PC32``.rodata`ऑफसेट पर `0x36`,`0x84`और `0x93`, जोड़े के साथ `0x10`,`0x24`और `-0x4`. प्रत्येक रिकॉर्ड में एक `file-offset-range`स्थान और एक सीमाः "डिस्क पर फ़ाइल से खंड बाइट्स पढ़ा जाता है। पाठक कोई स्थानांतरण लागू नहीं करता है और कोई कोड चलाता है। "

पाठ 32 इस पाठ को पूरी तरह से बनाता है। यहाँ यह 60 पंक्तियाँ है, क्योंकि यह पाठ आपके द्वारा पाठ के बारे में क्या रिकॉर्ड किया जाता है, इसके बारे में है।

## तालिका का उत्पत्ति करो, और कहो कि तुम ही इसे उत्पत्ति कर रहे हो

 के 46 बाइट्स`grade`चार पैटर्न है कि पाठ 33 को डिकोड शामिल हैंः

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

 द्वारा गुणा`0x66666667`इसके बाद 34 का शिफ्ट है एक हस्ताक्षरित विभाजन 10 से फ़ाइल 10 नंबर रखता है।`derive_grade_model()`यह तथ्य एक सीमा के रूप में लिखा हैः "विभाजक 10 गुणक 0x66666667 और शिफ्ट 34 से व्युत्पन्न है। फ़ाइल में 10 नहीं है। "

`add ecx, -6`पहले मामले को 6 पर सेट करता है।`cmp ecx, 4`एक असीमित छलांग के साथ पांच मामलों, 6 से 10 के लिए स्वीकार करता है।

`lea`पर`.text+0x33`अतिरिक्त के साथ स्थानांतरण को ले जाता है `0x10`. एक PC32 4 बाइट स्थानांतरण के अंत से स्थानांतरण उपायों, तो तालिका शुरू होता है `.rodata+0x14`. वहाँ पांच छोटे-अर्थी शब्द पढ़ते हैं .`1, 2, 3, 4, 4`. . स्विच में .`ledger.c`60 से 69 के लिए 1 लौटाता है, 2 सत्तर के लिए, 3 के लिए 80 के लिए, और 4 के लिए 90 से 100 के लिए। संकलक ने स्विच को रिटर्न मानों की खोज तालिका में बदल दिया।

परिणाम स्वरूप रिकॉर्ड `ev_605106bff2d9998f…`है`confidence` `derived`, और इसके `evidence_links`नाम दो अवलोकन रिकॉर्ड यह पर आधारित है. लेजर से बाइट्स रिकॉर्ड को हटा दें और व्युत्पन्न रिकॉर्ड एक लटकता लिंक है. ऊपर आंकड़ा यह स्थिति दिखाता है जब आप बंद कर देते हैं`ev_a467c242…`. .

अब Ghidra के साथ तुलना करें. यह एक ही बाइट्स के लिए एक छद्म कोड हैः

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

गिदरा ने स्थानांतरण को लागू किया और तालिका का नाम दिया `DAT_001000b4`, जो है `.rodata+0x14`यह रखा गया था के बाद`.text`पर`0x100000`. यह 10 से विभाजन और पांच मामलों को बहाल किया। डिफ़ॉल्ट मान के लिए यह एक अभिव्यक्ति प्रिंट की है जो हमेशा 0 है और कभी नहीं कहता है 0.`native_value_flow`उन कार्यों को चिह्नित करता है `is_dead: true`यह रिकॉर्ड गिदरा का एक विश्वसनीय अवलोकन है, जिसका अर्थ आप पढ़ते हैं, और जो मूल्य आप दौड़ से उम्मीद करते हैं, वह अनुमानित है।

`percent_change`रिकॉर्ड अन्य विफलता दिखाता है.`undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`स्रोत कहता है`int percent_change(int before, int after)`. .`idiv`लिखता है `EDX:EAX`, और शून्य पथ छोड़ता है `EDX`अनटच, तो decompiler एक 16 बाइट्स वापसी और एक तीसरा पैरामीटर का अनुमान लगाया।`native_api.return_type.confidence`के लिए`grade`है `"low"`. एक बरामद हस्ताक्षर को प्रदाता का निष्कर्ष माना जाए, और इसे इस तरह से रिकॉर्ड किया जाए।

## भविष्यवाणियां संदिग्ध हैं

भविष्यवाणी व्यवहार के बारे में एक दावा है जिसे किसी अवलोकन ने नहीं बताया है। `claim_suite()`इनमे से 18 का निर्माण व्युत्पन्न मॉडल और स्रोत से किया जाता है। `record_prediction()`प्रत्येक को एक रिकॉर्ड के रूप में संग्रहीत करता है `confidence` `inferred`और `authority` `analyst-inference`, जो उस रिकॉर्ड से जुड़ा हुआ है जिस पर यह आधार रखता है।

| Claim | Predicted value | Rests on |
|---|---|---|
| `percent_change(12400, 15500)` | 25, from 310000 / 12400 | division model `ev_076a9167…` |
| `percent_change(0, 5)` | 0, the zero guard | division model |
| `percent_change(100, 50)` | -50 | division model |
| `percent_change(-7, 3)` | -142, because `idiv` truncates toward zero | division model |
| `grade(55)` | 0, index -1 fails the unsigned compare | table model `ev_605106bf…` |
| `grade(60)`, `grade(69)` | 1, 1 | table model |
| `grade(70)`, `grade(85)` | 2, 3 | table model |
| `grade(95)`, `grade(100)`, `grade(105)` | 4, 4, 4 | table model |
| `grade(110)`, `grade(-5)` | 0, 0 | table model |
| `total(1, 2, 3)`, `total()` | 6, 0 | source record `ev_2f1e6d25…` |
| `grade_label(85)` | `"B"` | source record and table model |
| `grade(score)` for 90 to 100 | 4 for all eleven inputs | table model |

`predict()`सी अर्थशास्त्र का उपयोग करता है, पायथन अर्थशास्त्र नहीं। `c_div()`शून्य की ओर ट्रंक करता है, और `wrap32()`32 बिट्स में प्रत्येक मध्यवर्ती तह। पायथन के `//`नकारात्मक अनंत की ओर राउंड्स, तो `(3 - -7) * 100 // -7`-143 देता है और C कार्यक्रम -142 देता है। पाठ 36 इस ग्रिड को बहुत बड़ा बनाता है।

प्रत्येक भविष्यवाणी एक शेष अज्ञात खोले। अज्ञात पूछता है`observed`अधिकार के साथ साक्ष्य `controlled-replay`और एक जांच की सिफारिश करता हैः `execute_function`अगले खंड में यह सबूत प्रस्तुत किया गया है। प्रथम श्रेणी के दावे के लिए प्रश्न "क्या ग्रेड ((95) == 4 संकलित फ़ंक्शन चलाने पर रहता है?

## दौड़ के खिलाफ जांचें

`code/fixtures/harness.c`शामिल है `ledger.c`और प्रति आह्वान एक परिणाम प्रिंट करता है। `observe_runs()``clang`,`cc`या `gcc`अपने पथ पर और ग्रिड में प्रत्येक इनपुट एक बार चलाता है। प्रत्येक रन एक रिकॉर्ड बन जाता हैः

```json
{
  "operation": "execute_function",
  "parameters": { "function": "grade", "args": [95] },
  "normalized_result": { "result": 4, "stdout": "4\n", "exit_code": 0 },
  "confidence": "observed",
  "authority": "controlled-replay",
  "environment": { "id": "host-process", "platform": "darwin", "architecture": "arm64", "isolation": "process" },
  "limitations": [
    "The run executed a host build of ledger.c, not the x86-64 object. The claim about the object rests on the shared source and on the compiler.",
    "One run observes one input. It proves nothing about other inputs."
  ]
}
```

एक रन रिकॉर्ड का विषय है हर्नस बाइनरी, एक Mach-O arm64 फ़ाइल इस मैक पर, अपने स्वयं के SHA-256 के साथ. प्रदाता है`course-harness`संग्राहक के संस्करण लाइन के साथ, यहाँ `Apple clang version 17.0.0 (clang-1700.6.3.2)`. . .`evidence_links`स्रोत रिकॉर्ड का नाम `ev_2f1e6d251543d017…`, क्योंकि दौड़ और वस्तु साझा `ledger.c`और कुछ नहीं।

पहले सीमा को दो बार पढ़ें. x86-64 ऑब्जेक्ट इस मशीन पर कभी नहीं चलाया गया। जो चला गया वह एक ही स्रोत का दूसरा निर्माण था एक अन्य वास्तुकला के लिए। यह अभी भी एक अवलोकन है, और यह एक एमुलेटर के बिना उपलब्ध सबसे मजबूत है, इसलिए दावा उस वाक्य के साथ गुजरता है। एक रिपोर्ट जो इसे छोड़ती है, उसे पाठक की जरूरत की जानकारी खो गई है।

17 एकल-इनपुट रन सभी भविष्यवाणियों के साथ सहमत हैं।`code/fixtures/run-evidence.json`उन 17 रिकॉर्ड और स्रोत रिकॉर्ड के साथ निर्यात किया गया है `--record`2026-10-13 पर जब कोई संकलक मौजूद नहीं है,`build_ledger()`यह रिपोर्ट में कहा गया है कि यह बंडल चलाने के बजाय आयात करता है।`runs`क्षेत्र।

## पदोन्नति नियम

एक दावा केवल अवलोकन किए गए रन के माध्यम से अनुमानित से समर्थित तक जाता है। `check_claim()`खोजता है`execute_function`एक ही फ़ंक्शन और तर्क के साथ रिकॉर्ड करता है, प्रत्येक परिणाम की भविष्यवाणी के साथ तुलना करता है, और कवर किए गए इनपुट की गणना करता हैः

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()`यह सख्त रूप है। यह उठाता है`ClaimError`जब कोई आईडी है`inferred`या `derived`. यह तब उठता है जब एक id किसी अन्य फ़ंक्शन या अन्य तर्कों के रन का नाम देता है. यह तब उठता है जब सूची खाली होती है, और जब रन दावा से कम इनपुट को कवर करते हैं। गिड्रा छद्म कोड रिकॉर्ड और तालिका मॉडल दोनों के लिए मौजूद हैं `grade(55)`और न ही इसे बढ़ावा दे सकते हैं. बंद करो.`ev_7be90c0c…`आंकड़े में और दावे गिरते देखने के लिए `unsupported`जबकि दो रिकॉर्ड के बारे में `grade`रहने के लिए।

रेंज क्लेम आंशिक मामला दिखाता है। इसके ग्यारह इनपुट में से केवल दो, 95 और 100, रन ग्रिड में दिखाई देते हैं। `check_claim()`रिटर्न `unknown`के साथ`covered`11 में से 2 और `promote_claim()`"11 में से 2 इनपुटों में से एक ने देखा है रन" के साथ इनकार करता है।

`completion_ledger()`रिया के दर्पण `EvidenceCompletionLedger`. इसकी पहचान है `ecl_`इसके अलावा उसके रिकॉर्ड के हैश, और `complete`केवल तभी सही होता है जब `pass`बराबर `total`. डेमो प्रिंट्स `ecl_da64933ea13befed…`के साथ`complete: false`, उस एक सीमा दावा के कारण.

## अज्ञात एक हैश चेन के साथ रिकॉर्ड हैं

rea एक अवशिष्ट अज्ञात को एक सख्त रिकॉर्ड के रूप में संग्रहीत करता है। `code/main.py`एक ही क्षेत्रों और एक ही अपरिवर्तित रखता है।

आईडी है `unk_`और SHA-256 के ऊपर `{domain, question, scope_digest}`एक ही फ़ाइल के बारे में एक ही प्रश्न पूछने वाले दो विश्लेषकों को एक ही पहचान मिलती है।`scope_digest`वस्तु का SHA-256 है।

प्रत्येक परिवर्तन एक नया संशोधन है।`previous_revision_digest` `null`. प्रत्येक बाद में संशोधन नामों को `revision_digest`और (अज़ाब) उसके सामने से है और (अज़ाब) हर एक खेत को (भी) ढक लेता है मगर खुद को`verify_unknown_chain()`यह जाँच करता है कि प्रत्येक लिंक पिछले संशोधन पर इंगित करता है। यह जांचता है कि उत्परिवर्तन सबूत प्रत्येक संशोधन नाम में है।

प्रत्येक उत्परिवर्तन स्वयं एक साक्ष्य रिकॉर्ड है, जैसा कि प्रदाता के साथ होता है `rea-unknown-registry`. हमारे वाहक `confidence` `derived`,`authority` `analyst-inference`इसकी सीमा पढ़ती है "एक रजिस्ट्री उत्परिवर्तन रिकॉर्ड करता है कि विश्लेषक ने क्या फैसला किया है. यह जवाब का सबूत नहीं है। "

यही कारण है कि डेमो के 81 रिकॉर्ड में 36 व्युत्पन्न उत्परिवर्तन रिकॉर्ड शामिल हैंः 18 उद्घाटन और 18 अद्यतन।

प्रत्येक संशोधन पर तीन अपरिवर्तनीयताएं लागू की जाती हैंः

- केवल एक `resolved`अज्ञात एक ले जाता है `resolution`, और केवल संशोधन 1 में कोई पूर्ववर्ती नहीं है।
- ए `contradicted`अज्ञात नाम कम से कम एक परस्पर विरोधी आईडी, और कोई आईडी दोनों सूचियों में दिखाई नहीं देता है।
- ए `verified`संकल्प आवश्यक विश्वास और अधिकार के साथ कम से कम एक सबूत आईडी का नाम।

तीसरा नियम है कि जहां लेजर सबसे अधिक बार मना करता है। rea के वर्कफ़्लो नोट्स कहते हैं "केवल योग्य अवलोकन सबूत एक संकल्प की पुष्टि कर सकते हैं। "`resolve_unknown()`इसलिए तालिका मॉडल को अस्वीकार करता है, एक निरीक्षण रिकॉर्ड को प्राधिकरण के साथ अस्वीकार करता है `shipped-artifact`, और रन रिकॉर्ड स्वीकार करता है `ev_f4ffbe8f922ec7fe…`. `grade(95)`संशोधन 2 है, और इसके `previous_revision_digest`है `ffca840b55a8a188…`, संशोधन 1 का पाचन।

`update_unknown()`लेता है`expected_revision`और बढ़ता है `revision-conflict`जब यह पुराना है, जैसा कि रियल है `update_unknown`सही प्रतिक्रिया एक ही rea के नोट्स देते हैंः वर्तमान संशोधन को फिर से पढ़ें और फिर से निर्णय लें।

डेमो के बाद एक अज्ञात खुला रहता हैः`unk_f2eb0d7f84c80a19…`, "क्या रेटिंग ((स्कोर) == 4 90 से 100 तक के प्रत्येक स्कोर के लिए जब संकलित फ़ंक्शन चलती है? " इसकी स्थिति है `investigating`, इसके समर्थन आईडी में दो रन शामिल हैं, और इसके जांच अभी भी रन के बिना नौ इनपुट का नाम है।

## उत्तरों का कैश विश्लेषण का डेटाबेस नहीं है

rea में तीन चीजें हैं जो एक कैश की तरह दिखती हैं। Ghidra लक्ष्य स्नैपशॉट इनपुट की एक निजी प्रति है, आयातित के साथ `-readOnly -deleteProject`और बंद पर हटा दिया गया।`AnalysisSnapshotCache`एक द्विआधारी पहचान के लिए 10,000 प्रविष्टियों तक रखता है। स्नैपशॉट फ़ाइल रखता है `target`,`binding`,`entries`,`workflow_entries`, और एक `evidence_bundle`. .

कैश कुंजी है `query_`और SHA-256 के ऊपर `{target, binding, operation, parameters}`. .`target`है `{sha256, kind, format, architecture}`, और एक `raw-binary`लक्ष्य भी है `entry_point`. .`binding`प्रोफाइल के किसी भी 25 पैरामीटर में से किसी एक को बदलें, उदाहरण के लिए `jump_table_evidence`से`typed-case-default-blocks-v1`एक `v2`, और पाचन बदलता है, तो हर कुंजी बदलता है.

`code/fixtures/rea-snapshot.json`यह फ़ाइल rea दो रन के दौरान लिखी गई थी, 142,690 बाइट्स। rea ने इसे केवल मालिक के अनुमतियों के साथ लिखा था, और प्रतिबद्ध प्रति सभी द्वारा पठनीय है। इसमें दो प्रविष्टियां और एक सबूत बंडल है जिसमें एक ही दो रिकॉर्ड हैं। `AnswerCache.import_snapshot()`प्रत्येक को पुनः गणना करता है `query_id`और फ़ाइल को अस्वीकार करता है जब कोई भी अलग है. यह एक स्नैपशॉट को अस्वीकार करता है जिसका `target`या `binding`सक्रिय से भिन्न है, rea के वाक्यांश के साथ `profile_mismatch`. यह एक स्नैपशॉट को अस्वीकार करता है जिसका `format_version`नहीं है`course-answer-cache-1`. .

इस मशीन से तीन माप. पहला.`grade`प्रश्न 8.6 सेकंड के लिए लिया, एक ताजा Ghidra आयात के साथ।`percent_change`एक ही स्नैपशॉट के खिलाफ क्वेरी 8.5 सेकंड लिया, क्योंकि एक अलग क्वेरी एक कैश चूक है। एक तीसरा `grade`क्वेरी 2.1 सेकंड ले लिया और एक ही रिकॉर्ड के साथ एक ही लौटा `evidence_id`. rea में इन-मेमोरी रीप्ले में सीमा जोड़ा गया है "एक स्थानीय REA विश्लेषण स्नैपशॉट से लोड; इस कॉल प्रदाता को फिर से नहीं चलाया। " हमारे `lookup()`एक ही तरह का वाक्य जोड़ता है, ताकि पाठक एक नए उत्तर से एक पुनरावृत्ति को अलग कर सके।

एक उत्परिवर्तन कैश को समाप्त करता है। rea 6.5.0 में, एक नाम बदलने या टिप्पणी से स्नैपशॉट कैश को साफ कर दिया जाता है। rea प्रदाता को कॉल भेजने से पहले। एक विफल उत्तर यह साबित नहीं कर सकता है कि लेखन वापस रोल किया गया है, इसलिए एक विफल लेखन भी पुनःप्ले को रोकता है। एक मेटाडेटा आयात जो डेटाबेस को बदलता है वही करता है।

## एक एजेंट को इसकी आवश्यकता क्यों है

एक एजेंट जो MCP के माध्यम से रिया चलाता है प्रत्येक कॉल पर पूरा रिकॉर्ड देखता है और उद्धृत कर सकता है`evidence_id`2026 से अनुसंधान बताता है कि यह गलत कहां जाता है। NDSS BAR अध्ययन में उपकरण आउटपुट में अत्यधिक विश्वास चार कमजोरियों में से एक था। लगाए गए पाठ अध्ययन में, डेटा के रूप में बाइनरी सामग्री को दिखाने से अकेले 40 में से 15 असुरक्षित प्रस्तावों को छोड़ दिया गया था, और उपकरण प्राधिकरण के साथ प्रवासन जांच ने उन्हें हटा दिया। एक तीसरे अध्ययन में एक एजेंट ने MCP के माध्यम से Ghidra को ड्राइव किया ([arXiv 2606.06838](https://arxiv.org/abs/2606.06838)) सैकड़ों कार्यों वाले बाइनरी में, एजेंट ने स्टब उत्पन्न करने से पहले केवल 10 से 15 प्रतिशत को वास्तविक विश्लेषण प्राप्त हुआ।

एक प्रमुख इन सभी का जवाब एक रिकॉर्ड के साथ देता है, और एजेंट केवल रिपोर्ट करता है कि प्रमुख क्या रखता है। एक दावा बिना एक अवलोकन रन है`unsupported`. कुछ रन के साथ एक दावा है`unknown`. एक प्रदाता पाठ है `observed`प्रदाता के बारे में और कुछ नहीं। एजेंट कौशल फ़ाइल में दे`outputs/`और लेजर को एकमात्र स्थान बनाओ जहां यह निष्कर्ष लिखता है जो क्लाउड, कर्सर, कोडेक्स, ओपनक्लाउ, हर्मेस, या किसी भी एजेंट के लिए लागू होता है जो SKILL.md पढ़ता है।

## इसे बनाओ

मानक पुस्तकालय डेमो चलाएंः

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
```

डेमो ऑब्जेक्ट को पढ़ता है, दो वास्तविक रिकॉर्ड्स आयात करता है, वास्तविक स्नैपशॉट की पुष्टि करता है, और दो मॉडल प्राप्त करता है। फिर यह 18 भविष्यवाणियों को रिकॉर्ड करता है, 18 अज्ञात खोला जाता है, हर्नस को संकलित और चलाता है, प्रत्येक दावे की जांच करता है, और 17 अज्ञात को हल करता है। अपेक्षित आकारः

```json
{
  "records": 81,
  "by_confidence": { "observed": 25, "derived": 38, "inferred": 18 },
  "rea_snapshot": { "entries": 2, "replay_hit": true, "stale_profile_refused": true },
  "grade_table": [1, 2, 3, 4, 4],
  "runs": "live: Apple clang version 17.0.0 (clang-1700.6.3.2)",
  "claims": [ { "claim_id": "grade(95)", "status": "pass", "covered": "1/1" }, { "claim_id": "grade(90..100)", "status": "unknown", "covered": "2/11" } ],
  "completion_ledger_id": "ecl_da64933ea13befed9483f8b00447bb3f4ceb74324c01e2515eff03f3af3ca750",
  "complete": false,
  "unknowns": { "resolved": 17, "investigating": 1 }
}
```

एक सी संकलक के बिना, `runs`पढ़ता है `imported 17 recorded run records from run-evidence.json`और बाकी सब समान है।

पढ़िए `code/main.py`इस क्रम मेंः

1. `canonical_json()`और `compute_evidence_id()`हैश नुस्खा और अर्थिक प्रक्षेपण रखें।
2. `create_evidence()`और `validate_evidence()`एक रिकॉर्ड बनाने और जांचें।
3. `EvidenceLedger.record()`और `import_bundle()`रिकॉर्ड स्टोर करें और संघर्षों को अस्वीकार करें।
4. `open_unknown()`,`update_unknown()`और `resolve_unknown()`समीक्षा श्रृंखला बनाए रखें।
5. `observe_object()`ELF पढ़ता है, और `derive_grade_model()`टेबल पढ़ता है।
6. `claim_suite()`,`predict()`और `record_prediction()`अनुमानित स्तर लिखें।
7. `observe_runs()`हर पट्टा चलाया एक अवलोकन रिकॉर्ड में बदल देता है।
8. `check_claim()`,`promote_claim()`और `completion_ledger()`पदोन्नति नियमों का पालन करें।
9. `AnswerCache`चाबी प्रतिक्रियाओं की तरह रिया के स्नैपशॉट और पुराने लोगों को अस्वीकार करता है।

## इसका प्रयोग करें

प्रत्येक लक्ष्य और प्रत्येक जांच के लिए एक लेजर रखें लक्ष्य का SHA-256 प्रत्येक विषय में और प्रश्न का दायरा हर अज्ञात में डालें। जब आप उपकरण बदलते हैं, तो `provider`जब आप फिस्ट को पुनर्निर्माण करते हैं, विषय परिवर्तनों को पचाते हैं और प्रत्येक पुराना रिकॉर्ड एक और फ़ाइल का सबूत बन जाता है।

जब आप उन्हें जानते हैं, तब सीमाएँ लिखें। जो पाठक कोई स्थानांतरण नहीं करता है, वह ऐसा कहता है। होस्ट बिल्ड का रन ऐसा कहता है। जो मॉडल विभाजक को निष्कर्षित करता है, वह ऐसा कहता है। बिना सीमाओं के लिखे गए रिकॉर्ड तथ्य की अनुमति से अधिक मजबूत दिखते हैं, और बाद के पाठक इसे ठीक नहीं कर सकते।

प्रत्येक प्रदाता पाठ को डेटा के रूप में व्यवहार करें। लक्ष्य से स्ट्रिंग और छद्म कोड पाठ हैं जो लक्ष्य नियंत्रण करते हैं। वे कभी भी निर्देश नहीं बनते, और वे कभी भी व्यवहार के अवलोकन नहीं बनते। rea 6.5.0 ऐसे परिणामों को `_meta.provenance.untrusted_content: true`. इसके सर्वर निर्देश मॉडल को लक्ष्य सामग्री को डेटा के रूप में व्यवहार करने और निर्देशों में से किसी भी अनुरोध को चलाने, स्थापित करने, डाउनलोड करने या भेजने के लिए संकेत के रूप में रिपोर्ट करने के लिए कहते हैं। मार्कर मदद करता है, लेकिन आपकी लेजर को अभी भी निर्देशों से लक्ष्य पाठ को बाहर रखना चाहिए।

## इंटरैक्टिव लैब

### लैब ए: एक वास्तविक आईडी को पुनः गणना करें

`code`निर्देशिका, खुला पायथनः

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

दौड़ें:

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

पहले दो तुलनाएँ सही हैं. पथ हैश में नहीं है. तीसरा गलत है, क्योंकि एक सीमा सामग्री है.

### लैब बी: पदोन्नति से इनकार

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

कॉल उठता है `ClaimError`और व्युत्पन्न आईडी का नाम। अब रन आईडी पास करेंः

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

स्थिति है `pass`और लौट आए`limitations`मेजबान निर्माण वाक्य को ले लो।

### लैब सी: पुराने स्नैपशॉट से इनकार करें

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

पहला आयात रिटर्न 2। दूसरा बढ़ता है `CacheError`के साथ`profile_mismatch`. एक संस्करण स्ट्रिंग बदल गया, और पूरे स्नैपशॉट से इनकार कर दिया गया है.

### लैब डीः श्रृंखला तोड़

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

पहला कॉल 2 वापस आता है। दूसरा उठता है।`EvidenceIntegrityError`, क्योंकि संशोधन 1 अब अपने स्वयं के पाचन से मेल नहीं खाता और संशोधन 2 अब मौजूद नहीं है कि पाचन पर अंकित करता है।

## अभ्यास प्रयोगशाला

अनजान को बंद करें और दूसरा प्रदाता जोड़ें।

आवश्यकताएँः

- विस्तार `run_grid()`तो रेंज दावा की नौ गायब इनपुट चलाने, तो पुष्टि अज्ञात कदम करने के लिए`resolved`संशोधन 3 में।
- जोड़ें `llvm-objdump -d`एक दूसरे प्रदाता के रूप में अपने स्वयं के साथ `provider``grade`जैसे `observed`. .
- एक लिखें `derived`रिकॉर्ड जो दो सूची, गिदरा और llvm-objdump के बताता है, एक ही 14 निर्देशों को डिकोड, और दोनों लिंक.
- एक अज्ञात के लिए खोलें `grade_label(105)`गंभीरता से`high`, चूंकि तालिका सूचकांक 4 पढ़ता है `labels[4]`, और इसे एक दौड़ के साथ हल.
-  के साथ लेजर निर्यात करें`export_bundle()`, इसे एक नई पुस्तिका में आयात, और हर श्रृंखला अभी भी सत्यापित साबित.

सफलता का अर्थ है एक रिपोर्ट जिसमें प्रत्येक वाक्य में बंडल से एक आईडी और एक का उल्लेख होता है।`unknown`दावा गायब हो गया है।

## ग्रेड लैब

इस पाठ के फिक्स्चर के बारे में पांच प्रश्न. प्रत्येक उत्तर को आपके द्वारा निर्मित कोड के साथ खोजें, फिर इसे लिखें `code/lab_answers.json`. संख्याओं को संख्याओं या हेक्स स्ट्रिंग के रूप में लिखें जैसे `"0x40"`, और JSON सूची के रूप में सूची।

1. `t1`: प्रमाण आईडी जो compute_evidence_id real-evidence-grade.json के लिए देता है।
2. `t2`: ग्रेड रिकॉर्ड में सीमाओं की संख्या।
3. `t3`: ग्रेड रिकॉर्ड की संबंध_कवरेज स्थिति।
4. `t4`: दो स्ट्रिंगों की सूची के रूप में ग्रेड रिकॉर्ड का विश्वास और प्राधिकरण।
5. `t5`: ग्रेड रिकॉर्ड के विषय का SHA-256

अपने उत्तरों की जाँच करेंः

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
npx tsx code/lab.ts
```

चेकर प्रत्येक अपेक्षित मूल्य की गणना करता है `code/main.py`यह प्रिंट करता है`PASS`,`FAIL`या `TODO`प्रत्येक कार्य के लिए और एक स्कोर, और यह 0 से केवल जब सभी पांच पास छोड़ देता है। `python3 code/lab.py my-answers.json`एक और फ़ाइल की जाँच करता है। `code/tests/test_lab.py`यह साबित करता है कि जांचकर्ता सही उत्तरों को स्वीकार करता है और गलत उत्तरों को अस्वीकार करता है।

### इसे चलते देखें

[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off)मशीन चार ट्रे के साथ एक सबूत लेजर रखती हैः अवलोकन, व्युत्पन्न, अनुमानित और अज्ञात। यह लिंक प्रतीक तालिका बंद के साथ रन खोलता है, इसलिए फ़ंक्शन फ़ाइल का नाम और अंत अज्ञात के रूप में और प्रारंभ फ़ाइलें अनुमानित के रूप में।

## पाठ कलाकृतियाँ

यह सबक हमें फल देता है`outputs/skill-evidence-ledger.md`यह एजेंट को बताता है कि कैसे प्रत्येक निष्कर्ष को विश्वास, अधिकार, सीमाओं और लिंक के साथ रिकॉर्ड के रूप में लिखना है। यह एजेंट को बताता है कि कैसे अज्ञात को संशोधन के रूप में रखना है, और जब एक दावा है।`pass`,`fail`,`unknown`या `unsupported`. .

## जाँचें

डेमो और निर्धारक सूट चलाएंः

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

28 परीक्षणों से पता चलता हैः

- दोनों ही वास्तविक`evidence_id`मान, प्रोफ़ाइल डाइजेस्ट, और दोनों स्नैपशॉट `query_id`सामग्री से मानों को पुनः गणना
- एक बदल गया पथ आईडी रखता है और एक बदल गई सीमा इसे बदलती है
- एक गड़बड़ रिकॉर्ड, एक असंगत प्रोफ़ाइल प्रदाता, एक फ्लोट, और एक अज्ञात enum मूल्य अस्वीकार कर रहे हैं
- एक दोहरी रिकॉर्ड रिटर्न `duplicate`, एक विरोधाभासी रिकॉर्ड बढ़ता है, और एक बंडल आयात परमाणु है
- 18 रिकॉर्ड और कोई लटकने वाली लिंक के साथ दर्ज किए गए रन बंडल आयात
- एक अज्ञात संस्करण 1 पर खुलता है, एक पुराने से इनकार करता है `expected_revision`, और केवल अवलोकन के साथ हल करता है`controlled-replay`साक्ष्य
- एक संपादित संशोधन श्रृंखला तोड़ता है
- प्रमोशन का निष्कर्ष निकाला गया, व्युत्पन्न, खाली और संबंधित सबूतों से इनकार करता है, और सहमत रन के साथ पारित होता है
- आंशिक कवरेज `unknown`और एक असहमत दौड़ है`fail`
- कैश सटीक कुंजी पर हिट करता है और अन्य मापदंडों पर चूकता है
- कैश एक गड़बड़ प्रोफ़ाइल संस्करण, एक गलत लक्ष्य, एक गलत प्रारूप संस्करण, और एक छेड़छाड़ कुंजी से इनकार करता है
- ELF पाठक सहमत है `llvm-objdump`ऑफसेट, आकार, बाइट्स, और स्थानांतरण पर, और तालिका पढ़ता है `1, 2, 3, 4, 4`
- भविष्यवाणियों C विभाजन का उपयोग करते हैं, और रिकॉर्ड रन सभी 17 एकल-इनपुट दावे के साथ सहमत हैं
- एक संकलक के साथ मौजूद, लाइव रन भी सहमत

## उत्पादन विफलता मोड

| Failure | What the weak report says | What the ledger requires |
|---|---|---|
| Pseudocode read as behaviour | "grade returns 0 for failing scores" | an `execute_function` record for that input, or `unsupported` |
| Decompiler signature trusted | "percent_change returns 16 bytes" | the signature marked as the provider's inference with its `low` confidence |
| Empty list read as absence | "the function has no callers" | an `unknown` status, or a coverage field when the tool provides one |
| Path hashed into the id | "the record changed" after a copy | the semantic projection without `name` and `local_path` |
| Limitation dropped from a copy | a record that looks stronger than the source | id mismatch and rejection on import |
| Partial grid rounded up | "all scores from 90 pass" | `unknown` with `covered` 2 of 11 |
| Host run presented as the object's run | "the x86-64 object returned 25" | the host-build limitation carried on the claim |
| Unknown closed by a sentence | "resolved, see above" | a `verified` resolution with observed ids of the required authority |
| Stale revision overwritten | two analysts' edits collide | `revision-conflict` and a reread |
| Old snapshot replayed after a release | answers from a changed contract | `profile_mismatch` on import |
| Cache kept after a rename | a replay that hides a metadata write | invalidation before dispatch and a failed export |

## परिचालन नियम

आप जो पढ़ते हैं, जो गणना करते हैं और जो आप तीन शब्दों के साथ रिकॉर्ड के तीन प्रकार के रूप में रिकॉर्ड करते हैं। एक अज्ञात को एक आईडी के साथ बंद करें, कभी भी एक वाक्य के साथ नहीं। एक उत्तर को केवल उस कुंजी के तहत दोहराएं जिसके साथ यह संग्रहीत किया गया था, और जब एक संस्करण स्ट्रिंग अलग हो तो इसे अस्वीकार करें।

## आगे पढ़ना

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- Tag पर स्रोत `3b79af2`कि यह पाठ वर्णन करता हैः `src/domain/evidence.ts`,`.agents/skills/reverse-engineer-anything/SKILL.md`,`docs/cli.md`,`src/domain/reconstructionVerification.ts`,`src/application/ReconstructionObligationCandidates.ts`,`docs/tool-design.md`,`src/domain/evidenceCompletionLedger.ts`,`src/domain/residualUnknown.ts`,`src/application/investigation/UnknownEvidence.ts`,`.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`,`src/application/binary/AnalysisSnapshotCache.ts`,`src/domain/analysisSnapshot.ts`,`src/application/binary/BinarySession.ts`,`src/application/binary/BinarySessionRecords.ts`,`docs/mcp-contracts.md`. .
