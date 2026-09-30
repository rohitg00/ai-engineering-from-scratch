(function () {
  "use strict";
  // Generated from Python 3.14 str.casefold(), Unicode 16.0.0.
  // Ranges encode [first, last, stride, delta]; exceptions include full folds.
  const foldRanges = [[65,90,1,32],[192,214,1,32],[216,222,1,32],[256,302,2,1],[306,310,2,1],[313,327,2,1],[330,374,2,1],[377,381,2,1],[416,420,2,1],[459,475,2,1],[478,494,2,1],[504,542,2,1],[546,562,2,1],[582,590,2,1],[904,906,1,37],[913,929,1,32],[931,939,1,32],[984,1006,2,1],[1021,1023,1,-130],[1024,1039,1,80],[1040,1071,1,32],[1120,1152,2,1],[1162,1214,2,1],[1217,1229,2,1],[1232,1326,2,1],[1329,1366,1,48],[4256,4293,1,7264],[5112,5117,1,-8],[7312,7354,1,-3008],[7357,7359,1,-3008],[7680,7828,2,1],[7840,7934,2,1],[7944,7951,1,-8],[7960,7965,1,-8],[7976,7983,1,-8],[7992,7999,1,-8],[8008,8013,1,-8],[8025,8031,2,-8],[8040,8047,1,-8],[8136,8139,1,-86],[8544,8559,1,16],[9398,9423,1,26],[11264,11311,1,48],[11367,11371,2,1],[11392,11490,2,1],[42560,42604,2,1],[42624,42650,2,1],[42786,42798,2,1],[42802,42862,2,1],[42878,42886,2,1],[42902,42920,2,1],[42932,42946,2,1],[42966,42970,2,1],[43888,43967,1,-38864],[65313,65338,1,32],[66560,66599,1,40],[66736,66771,1,40],[66928,66938,1,39],[66940,66954,1,39],[66956,66962,1,39],[68736,68786,1,64],[68944,68965,1,32],[71840,71871,1,32],[93760,93791,1,32],[125184,125217,1,34]];
  const foldExceptions = {"181":"μ","223":"ss","304":"i̇","329":"ʼn","376":"ÿ","383":"s","385":"ɓ","386":"ƃ","388":"ƅ","390":"ɔ","391":"ƈ","393":"ɖ","394":"ɗ","395":"ƌ","398":"ǝ","399":"ə","400":"ɛ","401":"ƒ","403":"ɠ","404":"ɣ","406":"ɩ","407":"ɨ","408":"ƙ","412":"ɯ","413":"ɲ","415":"ɵ","422":"ʀ","423":"ƨ","425":"ʃ","428":"ƭ","430":"ʈ","431":"ư","433":"ʊ","434":"ʋ","435":"ƴ","437":"ƶ","439":"ʒ","440":"ƹ","444":"ƽ","452":"ǆ","453":"ǆ","455":"ǉ","456":"ǉ","458":"ǌ","496":"ǰ","497":"ǳ","498":"ǳ","500":"ǵ","502":"ƕ","503":"ƿ","544":"ƞ","570":"ⱥ","571":"ȼ","573":"ƚ","574":"ⱦ","577":"ɂ","579":"ƀ","580":"ʉ","581":"ʌ","837":"ι","880":"ͱ","882":"ͳ","886":"ͷ","895":"ϳ","902":"ά","908":"ό","910":"ύ","911":"ώ","912":"ΐ","944":"ΰ","962":"σ","975":"ϗ","976":"β","977":"θ","981":"φ","982":"π","1008":"κ","1009":"ρ","1012":"θ","1013":"ε","1015":"ϸ","1017":"ϲ","1018":"ϻ","1216":"ӏ","1415":"եւ","4295":"ⴧ","4301":"ⴭ","7296":"в","7297":"д","7298":"о","7299":"с","7300":"т","7301":"т","7302":"ъ","7303":"ѣ","7304":"ꙋ","7305":"ᲊ","7830":"ẖ","7831":"ẗ","7832":"ẘ","7833":"ẙ","7834":"aʾ","7835":"ṡ","7838":"ss","8016":"ὐ","8018":"ὒ","8020":"ὔ","8022":"ὖ","8064":"ἀι","8065":"ἁι","8066":"ἂι","8067":"ἃι","8068":"ἄι","8069":"ἅι","8070":"ἆι","8071":"ἇι","8072":"ἀι","8073":"ἁι","8074":"ἂι","8075":"ἃι","8076":"ἄι","8077":"ἅι","8078":"ἆι","8079":"ἇι","8080":"ἠι","8081":"ἡι","8082":"ἢι","8083":"ἣι","8084":"ἤι","8085":"ἥι","8086":"ἦι","8087":"ἧι","8088":"ἠι","8089":"ἡι","8090":"ἢι","8091":"ἣι","8092":"ἤι","8093":"ἥι","8094":"ἦι","8095":"ἧι","8096":"ὠι","8097":"ὡι","8098":"ὢι","8099":"ὣι","8100":"ὤι","8101":"ὥι","8102":"ὦι","8103":"ὧι","8104":"ὠι","8105":"ὡι","8106":"ὢι","8107":"ὣι","8108":"ὤι","8109":"ὥι","8110":"ὦι","8111":"ὧι","8114":"ὰι","8115":"αι","8116":"άι","8118":"ᾶ","8119":"ᾶι","8120":"ᾰ","8121":"ᾱ","8122":"ὰ","8123":"ά","8124":"αι","8126":"ι","8130":"ὴι","8131":"ηι","8132":"ήι","8134":"ῆ","8135":"ῆι","8140":"ηι","8146":"ῒ","8147":"ΐ","8150":"ῖ","8151":"ῗ","8152":"ῐ","8153":"ῑ","8154":"ὶ","8155":"ί","8162":"ῢ","8163":"ΰ","8164":"ῤ","8166":"ῦ","8167":"ῧ","8168":"ῠ","8169":"ῡ","8170":"ὺ","8171":"ύ","8172":"ῥ","8178":"ὼι","8179":"ωι","8180":"ώι","8182":"ῶ","8183":"ῶι","8184":"ὸ","8185":"ό","8186":"ὼ","8187":"ώ","8188":"ωι","8486":"ω","8490":"k","8491":"å","8498":"ⅎ","8579":"ↄ","11360":"ⱡ","11362":"ɫ","11363":"ᵽ","11364":"ɽ","11373":"ɑ","11374":"ɱ","11375":"ɐ","11376":"ɒ","11378":"ⱳ","11381":"ⱶ","11390":"ȿ","11391":"ɀ","11499":"ⳬ","11501":"ⳮ","11506":"ⳳ","42873":"ꝺ","42875":"ꝼ","42877":"ᵹ","42891":"ꞌ","42893":"ɥ","42896":"ꞑ","42898":"ꞓ","42922":"ɦ","42923":"ɜ","42924":"ɡ","42925":"ɬ","42926":"ɪ","42928":"ʞ","42929":"ʇ","42930":"ʝ","42931":"ꭓ","42948":"ꞔ","42949":"ʂ","42950":"ᶎ","42951":"ꟈ","42953":"ꟊ","42955":"ɤ","42956":"ꟍ","42960":"ꟑ","42972":"ƛ","42997":"ꟶ","64256":"ff","64257":"fi","64258":"fl","64259":"ffi","64260":"ffl","64261":"st","64262":"st","64275":"մն","64276":"մե","64277":"մի","64278":"վն","64279":"մխ","66964":"𐖻","66965":"𐖼"};

  function casefold(text) {
    return Array.from(text, character => {
      const point = character.codePointAt(0);
      if (Object.prototype.hasOwnProperty.call(foldExceptions, point)) return foldExceptions[point];
      const range = foldRanges.find(entry => point >= entry[0] && point <= entry[1] && (point - entry[0]) % entry[2] === 0);
      return range ? String.fromCodePoint(point + range[3]) : character;
    }).join("");
  }
  function textStages(text) {
    if (typeof text !== "string") throw new Error("Text must be a string.");
    if (Array.from(text).some(c => c.codePointAt(0) >= 0xd800 && c.codePointAt(0) <= 0xdfff)) {
      throw new Error("An unpaired surrogate cannot be encoded as Python UTF-8 text.");
    }
    const nfkc = text.normalize("NFKC"), folded = casefold(nfkc);
    // Python split includes U+001C..U+001F and U+0085, but excludes U+FEFF.
    const normalized = folded.replace(/[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/gu, " ").replace(/^ | $/g, "");
    return { raw: text, nfkc, folded, normalized };
  }
  async function sha256(text) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("SHA-256 requires Web Crypto. Open this page on HTTPS or localhost.");
    }
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  async function fingerprint(record) {
    const stages = textStages(record.text);
    return { ...record, ...stages, fingerprint: await sha256(stages.normalized) };
  }
  function sorted(values) {
    return Array.from(values).sort((left, right) => {
      const a = Array.from(left, c => c.codePointAt(0)), b = Array.from(right, c => c.codePointAt(0));
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) return a[i] - b[i];
      }
      return a.length - b.length;
    });
  }
  function validate(records) {
    const seen = new Set();
    records.forEach(record => {
      if (!["id", "group", "text"].every(key => typeof record[key] === "string" && record[key].length > 0)) {
        throw new Error("Each visible record needs a nonempty id, group and text.");
      }
      if (seen.has(record.id)) {
        throw new Error("Duplicate record id " + JSON.stringify(record.id) + ". Give each row its own identity before auditing.");
      }
      seen.add(record.id);
    });
  }
  function rowItem(record, value, detail, tone = "neutral") {
    return { id: "record:" + record.id, label: record.id, value, detail, tone };
  }
  function rawItem(record) {
    return rowItem(record, JSON.stringify(record.text), "Group: " + JSON.stringify(record.group));
  }
  function partitions(train, test, render = rawItem) {
    return [{ id: "train", label: "Train", items: train.map(render) }, { id: "test", label: "Test", items: test.map(render) }];
  }
  async function inspect(train, test) {
    validate(train.concat(test));
    const trainDetails = await Promise.all(train.map(fingerprint)), testDetails = await Promise.all(test.map(fingerprint));
    function intersections(key) {
      const trainKeys = new Set(trainDetails.map(record => record[key])), testKeys = new Set(testDetails.map(record => record[key]));
      return sorted(Array.from(trainKeys).filter(value => testKeys.has(value)));
    }
    const content = intersections("fingerprint"), groups = intersections("group");
    function evidence(values, key) {
      return values.map(value => ({
        value,
        train_ids: trainDetails.filter(record => record[key] === value).map(record => record.id),
        test_ids: testDetails.filter(record => record[key] === value).map(record => record.id),
      }));
    }
    return {
      train: trainDetails, test: testDetails,
      audit: { content_leaks: content, group_leaks: groups, clean: content.length === 0 && groups.length === 0 },
      contentEvidence: evidence(content, "fingerprint"), groupEvidence: evidence(groups, "group"),
    };
  }
  function auditView(details) {
    const links = [];
    [["contentEvidence", "Same normalized content"], ["groupEvidence", "Same original group"]].forEach(([kind, label]) => {
      details[kind].forEach(entry => entry.train_ids.forEach(trainId => entry.test_ids.forEach(testId => {
        links.push({ from: "record:" + trainId, to: "record:" + testId, label, tone: "bad" });
      })));
    });
    return {
      lanes: partitions(details.train, details.test, record => {
        const content = details.audit.content_leaks.includes(record.fingerprint), group = details.audit.group_leaks.includes(record.group);
        return rowItem(record, JSON.stringify(record.text),
          "Group: " + JSON.stringify(record.group) + ". " + (content ? "Content overlaps. " : "") + (group ? "Group overlaps." : ""),
          content || group ? "bad" : "good");
      }),
      links,
      metrics: [
        { label: "Shared fingerprints", value: details.audit.content_leaks.length },
        { label: "Shared groups", value: details.audit.group_leaks.length },
        { label: "Audit clean", value: details.audit.clean },
      ],
      columns: ["Evidence", "Exact key", "Train record IDs", "Test record IDs"],
      rows: details.contentEvidence.map(entry => ["Content", entry.value, entry.train_ids.join(", "), entry.test_ids.join(", ")])
        .concat(details.groupEvidence.map(entry => ["Group", JSON.stringify(entry.value), entry.train_ids.join(", "), entry.test_ids.join(", ")])),
    };
  }
  const field = (key, label, value) => ({ key, label, type: "text", value });
  const count = (key, label, value, max) => ({ key, label, type: "range", value, min: 0, max, step: 1 });
  function rowCount(value) {
    if (!Number.isInteger(value) || value < 0 || value > 12) throw new Error("Row counts must be whole numbers between zero and twelve.");
    return value;
  }

  window.AIFSProjectFigures.register("pj-dataset-split-auditor-1", {
    title: "Watch two records become fingerprints",
    caption: "Follow actual text through normalization, Unicode casefolding, whitespace collapse and SHA-256.",
    lab: {
      question: "Will these two different text strings produce the same content fingerprint?",
      controls: [field("textA", "Record A text", "  Straße\t"), field("textB", "Record B text", "STRASSE")],
      scenarios: [
        { label: "German casefold", values: { textA: "  Straße\t", textB: "STRASSE" } },
        { label: "Greek sigma", values: { textA: "ΟΣ", textB: "ος" } },
        { label: "Compatible forms", values: { textA: "Ａ  ﬃ", textB: "a ffi" } },
        { label: "Different meaning", values: { textA: "rollout passed", textB: "rollout failed" } },
      ],
      calculate: async values => {
        const records = await Promise.all([fingerprint({ id: "record-a", text: values.textA }), fingerprint({ id: "record-b", text: values.textB })]);
        records.forEach(record => {
          record.utf8 = Array.from(new TextEncoder().encode(record.normalized), byte => byte.toString(16).padStart(2, "0")).join(" ");
        });
        const operations = [
          ["Raw text", "raw", "Start with two independent record IDs. Quotation marks make spaces and control characters visible."],
          ["Normalize compatible forms", "nfkc", "NFKC replaces compatible Unicode forms, such as full-width letters, before comparing content."],
          ["Apply Unicode casefold", "folded", "Python casefold can expand characters: ß becomes ss, and both Greek sigma forms become σ."],
          ["Collapse whitespace", "normalized", "Python split/join reduces whitespace runs to a single space and removes leading and trailing whitespace."],
          ["Encode UTF-8", "utf8", "Hash these actual UTF-8 bytes. Byte values are hexadecimal; equal byte sequences produce equal digests."],
          ["Compute SHA-256", "fingerprint", "The full SHA-256 digests below are computed by Web Crypto from the normalized UTF-8 bytes."],
        ];
        const frames = operations.map(([label, key, explanation], index) => ({
          label, explanation,
          lanes: [{ id: "records", label, items: records.map(record => rowItem(record,
            index < 4 ? JSON.stringify(record[key]) : record[key] || "(zero bytes)",
            "Record identity stays " + record.id, index === 5 ? "good" : "active")) }],
        }));
        const same = records[0].fingerprint === records[1].fingerprint;
        Object.assign(frames.at(-1), {
          summary: same ? "Two record identities share one content fingerprint." : "The records have different content fingerprints.",
          metrics: [{ label: "Same normalized content", value: same }],
          formula: "SHA-256(UTF-8(collapse_whitespace(casefold(NFKC(text)))))",
          receipt: { records },
        });
        return { frames };
      },
    },
  });

  window.AIFSProjectFigures.register("pj-dataset-split-auditor-2", {
    title: "Find the records behind an overlap",
    caption: "Content equality and group equality are separate checks. Every connection names the two records involved.",
    lab: {
      question: "Do these partitions share normalized content, a group identity, both, or neither?",
      controls: [
        field("trainId", "Train record ID", "train-a"), field("trainGroup", "Train group", "incident-A"),
        field("trainText", "Train text", "Timeout after rollout"), field("testId", "Test record ID", "test-b"),
        field("testGroup", "Test group", "incident-B"), field("testText", "Test text", " timeout AFTER rollout "),
      ],
      scenarios: [
        { label: "Content only", values: {} },
        { label: "Group only", values: { testGroup: "incident-A", testText: "Cache warmed" } },
        { label: "Both", values: { testGroup: "incident-A" } },
        { label: "Clean", values: { testText: "Cache warmed" } },
        { label: "Duplicate ID", values: { testId: "train-a" } },
      ],
      calculate: async values => {
        const train = [{ id: values.trainId, group: values.trainGroup, text: values.trainText }];
        const test = [{ id: values.testId, group: values.testGroup, text: values.testText }];
        const details = await inspect(train, test);
        return { frames: [
          {
            label: "Validate record identities",
            explanation: "Both records have nonempty IDs, groups and text. Their IDs are unique across the combined train and test arrays.",
            lanes: partitions(train, test), metrics: [{ label: "Validated record IDs", value: train.length + test.length }],
          },
          {
            label: "Index normalized content",
            explanation: "Each partition indexes full SHA-256 fingerprints. The record IDs remain separate even when their content keys match.",
            lanes: partitions(details.train, details.test, record => rowItem(record, record.fingerprint, "Normalized text: " + JSON.stringify(record.normalized), "active")),
            columns: ["Partition", "Record ID", "Normalized text", "Content key"],
            rows: details.train.map(record => ["train", record.id, record.normalized, record.fingerprint])
              .concat(details.test.map(record => ["test", record.id, record.normalized, record.fingerprint])),
          },
          {
            label: "Index original groups",
            explanation: "Group keys use the original strings. Unlike text fingerprints, group IDs are never casefolded or trimmed.",
            lanes: partitions(details.train, details.test, record => rowItem(record, JSON.stringify(record.group), "Group membership for " + record.id, "active")),
          },
          {
            label: "Intersect the two indexes",
            explanation: "Only keys present in both partitions are leaks. Follow each connection to inspect the named records.",
            summary: details.audit.clean ? "Both intersections are empty." : "The shared keys identify the records to investigate.",
            ...auditView(details),
            receipt: { audit: details.audit, content_evidence: details.contentEvidence, group_evidence: details.groupEvidence },
          },
        ] };
      },
    },
  });

  function groupRecords(values) {
    const rows = [];
    [["incident-A", "A", rowCount(values.groupASize)], ["incident-B", "B", rowCount(values.groupBSize)]].forEach(([group, prefix, size]) => {
      for (let index = 1; index <= size; index += 1) {
        rows.push({ id: prefix + "-" + String(index).padStart(2, "0"), group, text: "Message " + index + " from " + group });
      }
    });
    return values.reverseRows ? rows.reverse() : rows;
  }
  function groupItem(group, detail, value = group.records.length + " records", tone = "neutral") {
    return {
      id: "group:" + group.id, label: group.id, value,
      detail: "Members: " + group.records.map(record => record.id).join(", ") + ". " + detail, tone,
    };
  }

  window.AIFSProjectFigures.register("pj-dataset-split-auditor-3", {
    title: "Move whole groups across the split",
    caption: "A stable hash chooses a partition for every group. Group size changes the resulting row balance, not its bucket.",
    lab: {
      question: "Where will each incident group go, and why can the row split differ from the requested threshold?",
      controls: [
        field("seed", "Split seed", "course"),
        { key: "testFraction", label: "Requested test threshold", type: "range", value: 0.5, min: 0.01, max: 0.99, step: 0.01 },
        count("groupASize", "Rows in incident-A", 9, 12), count("groupBSize", "Rows in incident-B", 1, 12),
        { key: "reverseRows", label: "Reverse input row order", type: "checkbox", value: false },
      ],
      scenarios: [
        { label: "Nine plus one", values: {} }, { label: "Change the seed", values: { seed: "experiment-1" } },
        { label: "Equal group sizes", values: { groupASize: 5, groupBSize: 5 } },
        { label: "Reverse rows", values: { reverseRows: true } }, { label: "No records", values: { groupASize: 0, groupBSize: 0 } },
      ],
      calculate: async values => {
        if (typeof values.seed !== "string") throw new Error("Seed must be text.");
        if (!Number.isFinite(values.testFraction) || values.testFraction <= 0 || values.testFraction >= 1) {
          throw new Error("Test fraction must be strictly between zero and one.");
        }
        textStages(values.seed);
        const rows = groupRecords(values);
        validate(rows);
        const groups = await Promise.all(sorted(new Set(rows.map(record => record.group))).map(async id => {
          const key = values.seed + "\u0000" + id, digest = await sha256(key);
          const bucket = Number(BigInt("0x" + digest)) / (2 ** 256);
          return { id, records: rows.filter(record => record.group === id), key, digest, bucket, partition: bucket < values.testFraction ? "test" : "train" };
        }));
        const frames = [
          {
            label: "Read the input rows",
            explanation: "These are the actual synthetic fixture records. Row order may change, but each ID and group travels together.",
            lanes: [{ id: "input", label: "Input rows", items: rows.map(rawItem) }], metrics: [{ label: "Input records", value: rows.length }],
          },
          {
            label: "Collect whole groups",
            explanation: "Collect all record IDs with the same incident key. The split will make one decision for each complete group.",
            lanes: [{ id: "pending", label: "Groups awaiting a decision", items: groups.map(group => groupItem(group, "")) }],
            metrics: [{ label: "Distinct groups", value: groups.length }],
          },
          {
            label: "Hash seed, NUL and group",
            explanation: "The separator is a real NUL byte, shown escaped below. Interpret the full digest as an integer and divide by 2^256.",
            formula: 'bucket = int(SHA-256(UTF-8(seed + "\\u0000" + group)), 16) / 2^256',
            lanes: [{ id: "pending", label: "Stable group buckets", items: groups.map(group => groupItem(group, "SHA-256: " + group.digest, String(group.bucket), "active")) }],
            columns: ["Group", "Exact hash input", "Full SHA-256", "Bucket"],
            rows: groups.map(group => [group.id, JSON.stringify(group.key), group.digest, group.bucket]),
          },
          {
            label: "Compare with the threshold",
            explanation: "A group enters test only when its bucket is strictly less than the requested threshold. Equality goes to train.",
            formula: "test if bucket < " + values.testFraction + "; otherwise train",
            lanes: [{ id: "pending", label: "Computed decisions", items: groups.map(group => groupItem(group,
              group.bucket + " < " + values.testFraction + " is " + (group.bucket < values.testFraction), group.partition, "active")) }],
          },
        ];
        groups.forEach((movedGroup, movedIndex) => {
          const assigned = groups.slice(0, movedIndex + 1);
          frames.push({
            label: "Move " + movedGroup.id,
            explanation: movedGroup.records.length + " records move together into " + movedGroup.partition + ". No row is moved separately to force a balanced count.",
            lanes: ["pending", "train", "test"].map(partition => {
              const members = partition === "pending" ? groups.slice(movedIndex + 1) : assigned.filter(group => group.partition === partition);
              return {
                id: partition, label: partition === "pending" ? "Not moved yet" : partition === "train" ? "Train" : "Test",
                items: members.map(group => groupItem(group, "Bucket: " + group.bucket, undefined, group.id === movedGroup.id ? "active" : "neutral")),
              };
            }),
          });
        });
        const testGroups = new Set(groups.filter(group => group.partition === "test").map(group => group.id));
        const train = rows.filter(record => !testGroups.has(record.group)), test = rows.filter(record => testGroups.has(record.group));
        const observed = rows.length ? test.length / rows.length : null;
        const trainGroups = new Set(train.map(record => record.group));
        const overlap = Array.from(testGroups).filter(group => trainGroups.has(group));
        frames.push({
          label: "Measure the resulting rows",
          explanation: "The threshold controls each group's decision, not an exact row quota. An empty partition is a valid split result and must be reported honestly.",
          summary: rows.length ? test.length + " of " + rows.length + " rows are in test (" + Math.round(observed * 10000) / 100 + "%)." : "No records were supplied; there is no observed row fraction.",
          lanes: ["train", "test"].map(partition => ({
            id: partition, label: partition === "train" ? "Train" : "Test",
            items: groups.filter(group => group.partition === partition).map(group => groupItem(group, "Bucket: " + group.bucket, undefined, "good")),
          })),
          metrics: [{ label: "Train rows", value: train.length }, { label: "Test rows", value: test.length }, { label: "Groups crossing partitions", value: overlap.length }],
          bars: [{ label: "Requested test threshold", value: values.testFraction * 100, max: 100, unit: "%" }]
            .concat(observed === null ? [] : [{ label: "Observed test row share", value: observed * 100, max: 100, unit: "%" }]),
          receipt: {
            seed: values.seed, test_fraction: values.testFraction,
            groups: groups.map(group => ({ group: group.id, record_ids: group.records.map(record => record.id), hash_input: group.key, sha256: group.digest, bucket: group.bucket, partition: group.partition })),
            train, test, observed_test_fraction: observed,
          },
        });
        return { frames };
      },
    },
  });

  window.AIFSProjectFigures.register("pj-dataset-split-auditor-4", {
    title: "Decide whether the split is usable",
    caption: "Count the visible records, inspect leakage evidence, and require two nonempty partitions plus a clean audit.",
    lab: {
      question: "Can a clean audit still produce an unusable evaluation split?",
      controls: [
        count("trainRows", "Train record count", 1, 5), count("testRows", "Test record count", 1, 5),
        field("trainGroup", "Train group", "incident-A"), field("testGroup", "Test group", "incident-B"),
        field("trainText", "Text in each train record", "Rollout completed"), field("testText", "Text in each test record", "Cache warmed"),
      ],
      scenarios: [
        { label: "Clean and nonempty", values: {} }, { label: "Empty test", values: { testRows: 0 } },
        { label: "Content leakage", values: { testText: "ROLLOUT completed" } },
        { label: "Group leakage", values: { testGroup: "incident-A" } }, { label: "Both empty", values: { trainRows: 0, testRows: 0 } },
      ],
      calculate: async values => {
        const records = (partition, size, group, text) => Array.from({ length: rowCount(size) }, (_, index) => ({ id: partition + "-" + (index + 1), group, text }));
        const train = records("train", values.trainRows, values.trainGroup, values.trainText);
        const test = records("test", values.testRows, values.testGroup, values.testText);
        const details = await inspect(train, test);
        const receipt = {
          train_rows: train.length, test_rows: test.length,
          train_groups: new Set(train.map(record => record.group)).size,
          test_groups: new Set(test.map(record => record.group)).size,
          audit: details.audit, usable: train.length > 0 && test.length > 0 && details.audit.clean,
        };
        const counts = [
          { label: "Train rows", value: receipt.train_rows }, { label: "Test rows", value: receipt.test_rows },
          { label: "Train groups", value: receipt.train_groups }, { label: "Test groups", value: receipt.test_groups },
        ];
        const lanes = partitions(train, test);
        const checks = [
          { id: "check:train", label: "Train is nonempty", value: receipt.train_rows > 0, detail: receipt.train_rows + " > 0" },
          { id: "check:test", label: "Test is nonempty", value: receipt.test_rows > 0, detail: receipt.test_rows + " > 0" },
          { id: "check:audit", label: "Audit is clean", value: details.audit.clean, detail: details.audit.content_leaks.length + " content leaks; " + details.audit.group_leaks.length + " group leaks" },
        ].map(check => ({ ...check, tone: check.value ? "good" : "bad" }));
        return { frames: [
          { label: "Read the visible records", explanation: "Only these rows enter the report. Setting a count to zero removes those records entirely.", lanes },
          { label: "Count rows and groups", explanation: "Count rows directly, then count the unique original group strings in each partition. Empty partitions have zero groups.", lanes, metrics: counts },
          { label: "Inspect cross-partition evidence", explanation: "Run the content and group intersections against only the visible rows. Empty partitions cannot contribute an overlap.", ...auditView(details) },
          {
            label: "Require all three conditions",
            explanation: "A clean audit alone is insufficient. Both partitions must contain records, and neither kind of leakage may be present.",
            lanes: [{ id: "conditions", label: "Required conditions", items: checks }],
            formula: "usable = (train_rows > 0) && (test_rows > 0) && audit.clean",
          },
          {
            label: "Write the audit receipt",
            explanation: "This is the complete report produced from the visible records. The usable field is the Boolean conjunction of all three conditions.",
            summary: receipt.usable ? "This split passes the three usability conditions." : "This split is not usable; inspect the failed condition.",
            lanes: [{ id: "conditions", label: "Required conditions", items: checks }], metrics: counts.concat([{ label: "Usable", value: receipt.usable }]), receipt,
          },
        ] };
      },
    },
  });
})();
