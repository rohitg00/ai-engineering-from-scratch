# कैपस्टोन 01  टर्मिनल-निवासी कोडिंग एजेंट

> 2026 तक एक कोडिंग एजेंट का आकार तय हो जाएगा। एक TUI हर्न, एक राज्यपूर्ण योजना, एक सैंडबॉक्स उपकरण सतह, एक लूप जो योजना, कार्य करता है, देखता है, पुनर्प्राप्त करता है। क्लाउड कोड, cursor 3, और ओपनकोड सभी 50 फीट से एक ही दिखते हैं। यह capstone आप में एक अंत के लिए एक अंत बनाने के लिए कहता है  CLI में, अनुरोध खींचें  और इसे मापने के लिए के खिलाफ मिनी-स्वे एजेंट और लाइव-स्वे एजेंट पर SWE-बेंच प्रो. आप सीखेंगे कि मुश्किल हिस्सा मॉडल कॉल नहीं है बल्कि उपकरण लूप, रेत बॉक्स और 50 वक्र रन पर लागत की सीमा है।

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## समस्या

2026 में कोडिंग एजेंट प्रमुख एआई एप्लिकेशन श्रेणी बन गए। क्लाउड कोड (एंट्रोपिक), कर्सर 3 कंपाउंडर 2 और एजेंट टैब (कर्सर), एम्प (सॉर्सेग्राफ), ओपनकोड (112k सितारे), फैक्टरी ड्रोइड्स और गूगल जूल्स सभी एक ही वास्तुकला के शिप वेरिएंट हैंः एक टर्मिनल हर्न, एक अनुमति उपकरण सतह, एक रेत बॉक्स, और एक सीमा मॉडल के आसपास बनाया गया एक योजना-कार्य-निरीक्षण लूप। सीमा संकीर्ण है  लाइव-एसईई एजेंट 79.2% पर पहुंच गया है SWE-बेंच पर ओपस 4.5  के साथ सत्यापित लेकिन इंजीनियरिंग शिल्प व्यापक है। अधिकांश विफलता मोड मॉडल त्रुटियां नहीं हैं। वे उपकरण लूप अस्थिरता, संदर्भ विषाक्तता, रनवे टोकन लागत, और विनाशकारी फ़ाइल सिस्टम संचालन हैं।

आप इन एजेंटों के बारे में बाहर से तर्क नहीं कर सकते. आप एक बनाने के लिए है, लूप को देखने के लिए बारी 47 पर दुर्घटनाग्रस्त जब ripgrep 8MB मिलान वापस, और ट्रंकिंग परत को फिर से बनाने के लिए है. यह इस capstone के बिंदु है.

## अवधारणा

हर्नेस में चार सतहें हैं।**Plan**TodoWrite शैली राज्य वस्तु बनाए रखता है कि मॉडल प्रत्येक बारी को फिर से लिखता है। **Act**उपकरण कॉल (पढ़ें, संपादित करें, चलाएं, खोजें, गिट) भेजता है। **Observe**stdout / stderr / exit कोड को कैप्चर करता है, truncates, और सारांश वापस फ़ीड करता है। **Recover**संदर्भ विंडो फटा या लूपिंग के बिना हमेशा के लिए उपकरण त्रुटियों को संभालता है। 2026 आकार एक और बात जोड़ता हैः **hooks**. .`PreToolUse`,`PostToolUse`,`SessionStart`,`SessionEnd`,`UserPromptSubmit`,`Notification`,`Stop`और `PreCompact` संरेखित विस्तार बिंदु जहां ऑपरेटर नीति, दूरदर्शन और सुरक्षा रैलियों को इंजेक्ट करता है।

रेत बॉक्स E2B या डेटोनाना है। प्रत्येक कार्य एक नए डेव कंटेनर में चलाया जाता है जिसमें एक गिट वर्क ट्री में स्थापित रीड-राइट होता है। हर्नस कभी भी होस्ट फ़ाइल सिस्टम को छूता नहीं है। सफलता या असफलता पर कामकाजी वृक्ष काटा जाता है। लागत नियंत्रण तीन परतों पर लागू किया जाता हैः प्रति मोड़ टोकन सीमा, प्रति सत्र डॉलर बजट, और एक कठिन मोड़ सीमा (आमतौर पर 50) । अवलोकन की क्षमता की परत GenAI सेमैंटिक सम्मेलनों के साथ OpenTelemetry के दायरे में है, जो स्वयं होस्ट किए गए Langfuse में भेज दिया जाता है।

## वास्तुकला

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## स्टैक

- हर्नस रनटाइमः Bun 1.2 + Ink 5 (रेक्ट इन टर्मिनल)
- मॉडल एक्सेसः क्लाउड सोनट 4.7, जीपीटी-5.4-कोडेक्स, जेमिनी 3 प्रो, ओपस 4.5 (सबसे कठिन कार्यों के लिए) के साथ ओपनराउटर एकीकृत एपीआई
- उपकरण परिवहनः मॉडल संदर्भ प्रोटोकॉल StreamableHTTP (MCP 2026 संशोधन)
- रेत बॉक्सः E2B रेत बॉक्स (JS SDK) या डेटोन डेव कंटेनर
- कोड खोजः 17 भाषाओं के लिए ripgrep उपप्रक्रिया, पेड़-निवासी पार्सर (पूर्व-संकलित)
- अलगाव: `git worktree add`प्रति कार्य, सफलता/असफलता पर सफाई
- Eval Harness: SWE-bench Pro (verified subset) + Terminal-Bench 2.0 + अपना 30-कार्य होल्डआउट
- अवलोकनशीलताः OpenTelemetry SDK के साथ `gen_ai.*`semconv → स्व-होस्टिंग Langfuse
- पीआर पोस्टिंगः फाइन ग्रेनेड टोकन वाला GitHub ऐप, लक्ष्य रेपो तक सीमित दायरा

```figure
ce-agent-loop
```

## इसे बनाओ

1. **TUI and command loop.**इंक के साथ एक बून परियोजना को स्टैफल्ड करें। स्वीकार `agent run <repo> "<task>"`. एक विभाजित दृश्य प्रिंट करेंः योजना फ़लक (ऊपर), उपकरण-कॉल स्ट्रीम (मध्य), टोकन बजट (नीचे) । Ctrl-C पर रद्द जोड़ें जो फायर करता है `SessionEnd`बाहर निकलने से पहले हुक.

2. **Plan state.**एक टाइप TodoWrite योजना (प्रलंबित / in_progress / नोट्स के साथ किया आइटम) को परिभाषित करें। मॉडल प्रत्येक बारी में एक उपकरण कॉल के रूप में पूर्ण स्थिति को फिर से लिखता है  इसे क्रमिक रूप से उत्परिवर्तन नहीं होने दें। योजना को बनाए रखें `.agent/state.json`ताकि दुर्घटनाएं फिर से शुरू हो सकें।

3. **Tool surface.**छः उपकरणों को परिभाषित करें: `read_file`,`edit_file`(विभिन्न पूर्वावलोकन के साथ), `ripgrep`,`tree_sitter_symbols`,`run_shell`(समय के साथ), `git`(स्थिति / अंतर / प्रतिबद्ध / पुश) MCP StreamableHTTP पर एक्सपोज करें ताकि हर्नस परिवहन-अज्ञानी हो। प्रत्येक उपकरण काटा आउटपुट लौटाता है (प्रति कॉल 4k टोकन पर कैप) ।

4. **Sandbox wrapping.**प्रत्येक कार्य में एक E2B सैंडबॉक्स उत्पन्न होता है। `git worktree add -b agent/$TASK_ID`सभी उपकरण कॉल रेत बॉक्स के अंदर निष्पादित. होस्ट फ़ाइल सिस्टम अछूता है.

5. **Hooks.**सभी आठ 2026 हुक प्रकारों को लागू करें। कम से कम चार उपयोगकर्ता द्वारा लिखित हुक तारः (क) `PreToolUse`विनाशकारी-कमान गार्ड जो ब्लॉक करता है `rm -rf`कार्यवृक्ष के बाहर, (ख) `PostToolUse`प्रतीकात्मक लेखांकन, (ग) `SessionStart`बजट प्रारंभ करना, (घ) `Stop`एक अंतिम निशान बंडल लिखता है।

6. **Eval loop.**SWE-bench Pro Python के 30 अंक के उपसमूह का क्लोन करें। प्रत्येक के खिलाफ अपना हर्नेंस चलाएं। पास@1, टर्न-पर-टास्क और $-पर-टास्क पर मिनी-स्वे-एजेंट (कम से कम बेसलाइन) की तुलना करें। परिणामों को लिखें `eval/results.jsonl`. .

7. **Cost control.**कठिन कटऑफः 50 मोड़, 200 हजार संदर्भ, $ 5 प्रति कार्य। `PreCompact`हुक 150k के निशान पर एक पूर्व-राज्य ब्लॉक में पुराने मोड़ को सारांशित करता है, योजना खोने के बिना नए अवलोकन के लिए जगह मुक्त.

8. **PR posting.**सफलता के लिए अंतिम कदम है`git push`+ एक GitHub एपीआई कॉल जो एक योजना और शरीर में अंतर सारांश के साथ एक पीआर खोलता है।

## इसका प्रयोग करें

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## इसे भेजें

उपलब्ध कौशल में रहता है `outputs/skill-terminal-coding-agent.md`. एक रेपो पथ और एक कार्य विवरण को देखते हुए, यह एक सैंडबॉक्स में पूर्ण योजना-कार्य-निरीक्षण लूप चलाता है और एक PR URL प्लस एक ट्रैक बंडल देता है। इस कैपस्टोन के लिए अनुच्छेदः

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## व्यायाम

1. क्लाउड सोनट 4.7 से बैकअप मॉडल को VLLM पर सेवा देने वाले Qwen3-Coder-30B में बदलें। पास@1 और $-प्रति-कार्य की तुलना करें। रिपोर्ट करें कि ओपन मॉडल का प्रदर्शन कहां है।

2. एक जोड़ें `reviewer`उप-एजेंट जो पीआर पोस्टिंग से पहले अंतर पढ़ता है और एक संशोधन लूप का अनुरोध कर सकता है। मापें कि क्या झूठी सकारात्मक समीक्षाएं एकल-एजेंट बेसलाइन से नीचे SWE बेंच पास दर को गिरा देती हैं (संकेतः आमतौर पर हाँ) ।

3. तनाव परीक्षण रेत बॉक्सः एक कार्य लिखें जो करने की कोशिश करता है `curl`एक बाहरी URL और एक कार्य है कि worktree के बाहर लिखता है. पुष्टि दोनों PreToolUse हुक द्वारा अवरुद्ध कर रहे हैं. प्रयासों को लॉग.

4. कार्यान्वयन`PreCompact`एक छोटे मॉडल के साथ सारांश (हाइकू 4.5) । 3x संपीड़न पर योजना की निष्ठा का कितना नुकसान होता है, इसका माप करें।

5. स्टूडियो के लिए MCP StreamableHTTP परिवहन बदलें. ठंड प्रारंभ और प्रति कॉल विलंबता बेंचमार्क. स्थानीय उपयोग के लिए एक विजेता चुनें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## आगे पढ़ना

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) एंथ्रोपिक से संदर्भ हर्न
- [Cursor 3 changelog](https://cursor.com/changelog) एजेंट टैब और कंपोजर 2 उत्पाद नोट्स
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) SWE-बेंच हर्न की तुलना के लिए न्यूनतम आधार रेखा
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79.2% SWE-बेंच Opus 4.5 के साथ सत्यापित
- [OpenCode](https://opencode.ai) खुला हर्न, 112k सितारे
- [SWE-bench Pro leaderboard](https://www.swebench.com) इस लक्ष्य के मूल्यांकन के लिए
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) स्ट्रीम करने योग्य HTTP, क्षमता मेटाडेटा
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) टूल कॉल और टोकन उपयोग के लिए अवधि योजना
