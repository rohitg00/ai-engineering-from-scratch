(function () {
  "use strict";
  const hex = (n) => "0x" + n.toString(16);
  const log2 = (x) => Math.log(x) / Math.LN2;
  const round4 = (x) => Math.round(x * 10000) / 10000;

  const headerLab = {
    controls: [
      {
        key: "magic", label: "First bytes", type: "select", value: "elf",
        options: [
          { value: "elf", label: "7f 45 4c 46 (ELF)" },
          { value: "mz", label: "4d 5a (MZ, PE image)" },
          { value: "macho64", label: "cf fa ed fe (Mach-O 64)" },
          { value: "macho32", label: "ce fa ed fe (Mach-O 32)" },
          { value: "fat", label: "ca fe ba be (universal)" },
          { value: "coff", label: "64 86 (COFF machine x86-64)" },
          { value: "text", label: "69 6e 74 20 (C source text)" },
        ],
      },
      { key: "size", label: "File size in bytes", type: "range", value: 2152, min: 0, max: 4096, step: 1 },
      { key: "eiclass", label: "ELF EI_CLASS (1 = 32-bit, 2 = 64-bit)", type: "range", value: 2, min: 1, max: 2, step: 1 },
      { key: "eidata", label: "ELF EI_DATA (1 = little, 2 = big)", type: "range", value: 1, min: 1, max: 2, step: 1 },
      { key: "lfanew", label: "PE e_lfanew", type: "range", value: 64, min: 0, max: 4096, step: 4 },
      { key: "optional", label: "COFF SizeOfOptionalHeader", type: "range", value: 0, min: 0, max: 240, step: 16 },
      { key: "sections", label: "COFF NumberOfSections", type: "range", value: 10, min: 0, max: 120, step: 1 },
    ],
    calculate(v) {
      const rows = [];
      const check = (label, ok, detail) => {
        rows.push([label, ok ? "pass" : "fail", detail]);
        return ok;
      };
      let result = null;
      if (!check("at least 4 bytes", v.size >= 4, v.size + " bytes")) result = "FormatError: file too short";
      else if (v.magic === "elf") {
        if (!check("EI_CLASS is 2", v.eiclass === 2, "EI_CLASS " + v.eiclass)) result = "FormatError: only ELF64 is supported";
        else if (!check("EI_DATA is 1", v.eidata === 1, "EI_DATA " + v.eidata)) result = "FormatError: only little-endian ELF";
        else if (!check("64-byte header fits", v.size >= 64, "needs 64")) result = "FormatError: truncated header";
        else result = "elf64";
      } else if (v.magic === "mz") {
        const end = v.lfanew + 4;
        if (!check("e_lfanew field fits", v.size >= 0x40, "needs 0x40 bytes")) result = "FormatError: truncated at 0x3c";
        else if (!check("PE\\0\\0 inside the file", end <= v.size, "signature at " + hex(v.lfanew) + ", ends " + hex(end))) result = "FormatError: no PE signature at " + hex(v.lfanew);
        else result = "pe";
      } else if (v.magic === "macho64") result = check("magic 0xfeedfacf", true, "little-endian word") && "macho64";
      else if (v.magic === "macho32") { check("magic 0xfeedface", false, "32-bit Mach-O"); result = "FormatError: 32-bit Mach-O is not supported"; }
      else if (v.magic === "fat") { check("fat header", false, "several architectures"); result = "FormatError: universal Mach-O, extract one slice"; }
      else {
        const machine = v.magic === "coff";
        const fits = check("20-byte file header", v.size >= 20, v.size + " bytes");
        const known = fits && check("machine in COFF_MACHINES", machine, machine ? "0x8664" : "0x6e69");
        const object = known && check("SizeOfOptionalHeader is 0", v.optional === 0, String(v.optional));
        const count = object && check("1 to 96 sections", v.sections >= 1 && v.sections <= 96, String(v.sections));
        result = count ? "coff" : "FormatError: unknown format";
      }
      const ok = !String(result).startsWith("FormatError");
      return {
        summary: ok ? "detect_format returns \"" + result + "\"." : result + ".",
        metrics: [
          { label: "Result", value: result },
          { label: "Checks passed", value: rows.filter((r) => r[1] === "pass").length + " of " + rows.length },
        ],
        bars: [{ label: "Bytes available for the header", value: Math.min(v.size, 4096), max: 4096 }],
        columns: ["check", "outcome", "value"],
        rows,
      };
    },
  };

  const entropyLab = {
    controls: [
      { key: "length", label: "Region length in bytes", type: "range", value: 768, min: 0, max: 4096, step: 1 },
      { key: "distinct", label: "Distinct byte values", type: "range", value: 120, min: 1, max: 256, step: 1 },
      { key: "share", label: "Share of the most common value (%)", type: "range", value: 12, min: 0, max: 100, step: 1 },
      { key: "zerofill", label: "Zero-fill section (no file bytes)", type: "checkbox", value: false },
      { key: "alloc", label: "ELF SHF_ALLOC", type: "checkbox", value: true },
      { key: "write", label: "ELF SHF_WRITE", type: "checkbox", value: false },
      { key: "exec", label: "ELF SHF_EXECINSTR", type: "checkbox", value: true },
    ],
    calculate(v) {
      const k = Math.max(1, Math.round(v.distinct));
      let s = v.share / 100;
      if (k === 1) s = 1;
      s = Math.max(s, 1 / k);
      const rest = k > 1 ? (1 - s) / (k - 1) : 0;
      let h = 0;
      if (s > 0) h += s * log2(1 / s);
      if (rest > 0) h += (k - 1) * rest * log2(1 / rest);
      const fileBytes = v.zerofill ? 0 : v.length;
      const entropy = fileBytes ? round4(h) : 0;
      const perms = v.alloc ? (v.alloc ? "r" : "-") + (v.write ? "w" : "-") + (v.exec ? "x" : "-") : "---";
      const flags = (v.write ? 1 : 0) | (v.alloc ? 2 : 0) | (v.exec ? 4 : 0);
      return {
        summary: "sh_flags " + hex(flags) + " gives \"" + perms + "\". Entropy over " + fileBytes + " file bytes is " + entropy + " bits per byte.",
        metrics: [
          { label: "Most common value p", value: round4(s) },
          { label: "Each other value p", value: round4(rest) },
          { label: "file_size", value: fileBytes },
          { label: "perms", value: perms },
        ],
        bars: [
          { label: "Entropy (bits per byte)", value: entropy, max: 8 },
          { label: "Upper bound log2(distinct)", value: round4(log2(k)), max: 8 },
        ],
        columns: ["term", "count", "p", "p log2(1/p)"],
        rows: [
          ["most common value", 1, round4(s), round4(s > 0 ? s * log2(1 / s) : 0)],
          ["other values", k - 1, round4(rest), round4(rest > 0 ? rest * log2(1 / rest) : 0)],
        ],
      };
    },
  };

  const BUILTINS = { v: "void", b: "bool", c: "char", a: "signed char", h: "unsigned char", s: "short", t: "unsigned short", i: "int", j: "unsigned int", l: "long", m: "unsigned long", x: "long long", y: "unsigned long long", f: "float", d: "double", e: "long double", w: "wchar_t", z: "..." };

  function demangleTrace(name) {
    const steps = [];
    const subs = [];
    let text = name.startsWith("__Z") ? name.slice(1) : name;
    if (!text.startsWith("_Z")) return { result: null, steps: [["start", "no _Z prefix", "not mangled"]], subs };
    text = text.slice(2);
    let pos = 0;
    const peek = (n = 1) => text.slice(pos, pos + n);
    const fail = (why) => { throw new Error(why); };
    const take = (n = 1) => { if (pos + n > text.length) fail("unexpected end"); const s = text.slice(pos, pos + n); pos += n; return s; };
    const sourceName = () => {
      const start = pos;
      while (/[0-9]/.test(peek())) pos += 1;
      if (start === pos) fail("expected a length");
      const length = Number(text.slice(start, pos));
      if (!length || pos + length > text.length) fail("bad source name");
      const value = take(length);
      steps.push([text.slice(start, pos), "source name", value]);
      return value;
    };
    const addSub = (parts) => {
      const key = parts.join("::");
      if (!subs.includes(key)) {
        subs.push(key);
        steps.push(["", "record " + (subs.length === 1 ? "S_" : "S" + (subs.length - 2).toString(36).toUpperCase() + "_"), key]);
      }
    };
    const substitution = () => {
      const start = pos;
      take();
      if (peek() === "t") { take(); steps.push(["St", "std", "std"]); return ["std"]; }
      let index = 0;
      if (peek() === "_") take();
      else {
        let digits = "";
        while (peek() && peek() !== "_") digits += take();
        take();
        index = parseInt(digits, 36) + 1;
      }
      if (!(index < subs.length)) fail("substitution out of range");
      steps.push([text.slice(start, pos), "substitution " + index, subs[index]]);
      return subs[index].split("::");
    };
    const nested = (isFunction) => {
      take();
      let isConst = false;
      if (peek() === "K") { take(); isConst = true; steps.push(["K", "const member", ""]); }
      let parts = [];
      while (peek() !== "E") {
        if (!peek()) fail("unterminated nested name");
        if (peek() === "S") parts = substitution().slice();
        else if (/[0-9]/.test(peek())) parts.push(sourceName());
        else if (peek() === "C" || peek() === "D") {
          const code = take(2);
          if (!"123".includes(code[1]) || !parts.length) fail("unsupported constructor form");
          parts.push((code[0] === "D" ? "~" : "") + parts[parts.length - 1]);
        } else fail("unsupported nested component");
        if (peek() !== "E" || !isFunction) addSub(parts);
      }
      take();
      return { parts, isConst };
    };
    const type = () => {
      const code = peek();
      if (BUILTINS[code]) { take(); steps.push([code, "builtin", BUILTINS[code]]); return BUILTINS[code]; }
      if ("PROK".includes(code) && code) {
        take();
        const inner = type();
        const out = { P: inner + "*", R: inner + "&", O: inner + "&&", K: inner + " const" }[code];
        steps.push([code, "qualifier", out]);
        addSub([out]);
        return out;
      }
      if (code === "N") return nested(false).parts.join("::");
      if (code === "S") {
        const value = substitution();
        if (value.length === 1 && value[0] === "std") { const n = "std::" + sourceName(); addSub([n]); return n; }
        return value.join("::");
      }
      if (/[0-9]/.test(code)) { const n = sourceName(); addSub([n]); return n; }
      fail("unsupported type code " + JSON.stringify(code));
    };
    try {
      let parts;
      let isConst = false;
      if (peek() === "N") ({ parts, isConst } = nested(true));
      else if (peek(2) === "St") { take(2); parts = ["std", sourceName()]; }
      else if (/[0-9]/.test(peek())) parts = [sourceName()];
      else fail("unsupported name");
      if (pos === text.length) return { result: parts.join("::"), steps, subs };
      let params = [];
      while (pos < text.length) params.push(type());
      if (params.length === 1 && params[0] === "void") params = [];
      return { result: parts.join("::") + "(" + params.join(", ") + ")" + (isConst ? " const" : ""), steps, subs };
    } catch (error) {
      steps.push(["", "stop", error.message]);
      return { result: null, steps, subs };
    }
  }

  const demangleLab = {
    controls: [
      { key: "name", label: "Mangled name", type: "text", value: "_ZN5tally5resetEPNS_7CounterE" },
      {
        key: "example", label: "Or pick a fixture name", type: "select", value: "typed",
        options: [
          { value: "typed", label: "Use the text field" },
          { value: "_ZNK5tally7Counter5totalEv", label: "_ZNK5tally7Counter5totalEv" },
          { value: "_ZN5tally5scaleEdi", label: "_ZN5tally5scaleEdi" },
          { value: "_Z1fRKiS_", label: "_Z1fRKiS_" },
          { value: "_Z3fooIiEvT_", label: "_Z3fooIiEvT_ (template, outside the subset)" },
        ],
      },
    ],
    calculate(v) {
      const name = v.example === "typed" ? String(v.name || "").trim() : v.example;
      const traced = demangleTrace(name);
      return {
        summary: traced.result === null ? "demangle(\"" + name + "\") returns None." : "demangle returns \"" + traced.result + "\".",
        metrics: [
          { label: "Tokens read", value: traced.steps.length },
          { label: "Substitutions recorded", value: traced.subs.length },
        ],
        bars: [{ label: "Substitution table size", value: traced.subs.length, max: 8 }],
        columns: ["input", "rule", "value"],
        rows: traced.steps.slice(0, 24),
      };
    },
  };

  const fixupLab = {
    controls: [
      { key: "word", label: "Fixup word (hex)", type: "text", value: "0x001000000000098d" },
      {
        key: "format", label: "Pointer format", type: "select", value: "6",
        options: [
          { value: "6", label: "6, DYLD_CHAINED_PTR_64_OFFSET" },
          { value: "2", label: "2, DYLD_CHAINED_PTR_64" },
        ],
      },
      { key: "offset", label: "File offset of this word", type: "range", value: 16416, min: 16384, max: 32760, step: 8 },
      { key: "imports", label: "Entries in the imports table", type: "range", value: 4, min: 0, max: 16, step: 1 },
    ],
    calculate(v) {
      let raw;
      try {
        raw = BigInt(String(v.word).trim());
      } catch (error) {
        return { summary: "Enter a hexadecimal word such as 0x8010000000000000.", metrics: [], bars: [] };
      }
      if (raw < 0n || raw >= 1n << 64n) return { summary: "A fixup word has 64 bits.", metrics: [], bars: [] };
      const bits = (shift, width) => Number((raw >> BigInt(shift)) & ((1n << BigInt(width)) - 1n));
      const bind = bits(63, 1) === 1;
      const next = bits(51, 12);
      const pageEnd = 16384 + 16384 * Math.floor((v.offset - 16384) / 16384) + 16384;
      const nextOffset = next ? v.offset + next * 4 : null;
      const leaves = nextOffset !== null && nextOffset + 8 > pageEnd;
      const rows = [["bit 63 bind", bits(63, 1), bind ? "bind" : "rebase"], ["bits 51 to 62 next", next, next ? "+" + next * 4 + " bytes" : "end of chain"]];
      let summary;
      const metrics = [{ label: "Kind", value: bind ? "bind" : "rebase" }];
      if (bind) {
        const ordinal = bits(0, 24);
        const addend = bits(24, 8);
        rows.push(["bits 0 to 23 ordinal", ordinal, ordinal < v.imports ? "import " + ordinal : "outside the table"]);
        rows.push(["bits 24 to 31 addend", addend, ""]);
        metrics.push({ label: "Import ordinal", value: ordinal });
        summary = ordinal < v.imports ? "Bind to import " + ordinal + "." : "FormatError: bind ordinal " + ordinal + " with " + v.imports + " imports.";
      } else {
        let target = BigInt(bits(0, 36)) | (BigInt(bits(36, 8)) << 56n);
        if (v.format === "6") target += 0x100000000n;
        rows.push(["bits 0 to 35 target", hex(bits(0, 36)), v.format === "6" ? "vm offset, add 0x100000000" : "vm address"]);
        rows.push(["bits 36 to 43 high8", bits(36, 8), "top byte of the pointer"]);
        metrics.push({ label: "Target", value: "0x" + target.toString(16) });
        summary = "Rebase: dyld writes 0x" + target.toString(16) + " plus the slide.";
      }
      if (leaves) summary = "FormatError: the next fixup at " + hex(nextOffset) + " leaves its page.";
      metrics.push({ label: "Next offset", value: nextOffset === null ? "none" : hex(nextOffset) });
      return {
        summary,
        metrics,
        bars: [{ label: "next in 4-byte steps", value: next, max: 4095 }],
        columns: ["field", "value", "meaning"],
        rows,
      };
    },
  };

  const TRUTH = {
    O2: ["0x1000005e8", "0x100000740", "0x100000848", "0x100000868", "0x100000890", "0x1000008b4"],
    O0: ["0x1000005e8", "0x10000075c", "0x1000007d8", "0x100000800", "0x100000878", "0x1000008d0"],
  };
  const METHODS = {
    O2: { table: [0, 1, 2, 3, 4, 5], calls: [1, 2, 3, 4, 5], entry: [0], prologues: [0] },
    O0: { table: [0, 1, 2, 3, 4, 5], calls: [1, 2, 3, 4, 5], entry: [0], prologues: [0, 1, 2, 3, 4, 5] },
  };
  const startsLab = {
    controls: [
      { key: "build", label: "Build", type: "select", value: "O2", options: [{ value: "O2", label: "-O2 stripped" }, { value: "O0", label: "-O0 stripped" }] },
      { key: "table", label: "LC_FUNCTION_STARTS", type: "checkbox", value: false },
      { key: "calls", label: "Call targets", type: "checkbox", value: true },
      { key: "entry", label: "Entry point", type: "checkbox", value: true },
      { key: "prologues", label: "Prologue scan", type: "checkbox", value: true },
      { key: "noise", label: "Prologue matches inside functions", type: "range", value: 0, min: 0, max: 6, step: 1 },
    ],
    calculate(v) {
      const methods = METHODS[v.build];
      const found = new Set();
      const rows = [];
      ["table", "calls", "entry", "prologues"].forEach((name) => {
        if (!v[name]) return;
        methods[name].forEach((i) => found.add(i));
        rows.push([name, methods[name].length, methods[name].map((i) => TRUTH[v.build][i]).join(" ")]);
      });
      const falsePositives = v.prologues ? v.noise : 0;
      if (falsePositives) rows.push(["prologue noise", falsePositives, "addresses inside functions"]);
      const tp = found.size;
      const reported = tp + falsePositives;
      const precision = reported ? round4(tp / reported) : 0;
      const recall = round4(tp / 6);
      return {
        summary: "Union of the selected methods: " + tp + " of 6 true starts, " + falsePositives + " false positives.",
        metrics: [
          { label: "True positives", value: tp },
          { label: "False positives", value: falsePositives },
          { label: "Precision", value: precision },
          { label: "Recall", value: recall },
        ],
        bars: [
          { label: "Precision", value: precision, max: 1 },
          { label: "Recall", value: recall, max: 1 },
        ],
        columns: ["method", "found", "addresses"],
        rows,
      };
    },
  };

  const mapLab = {
    controls: [
      { key: "size", label: "File size in bytes", type: "range", value: 50264, min: 1, max: 65536, step: 1 },
      { key: "cells", label: "Cells", type: "range", value: 128, min: 1, max: 256, step: 1 },
      { key: "start", label: "Section file offset (__text)", type: "range", value: 1512, min: 0, max: 65536, step: 8 },
      { key: "length", label: "Section file size", type: "range", value: 768, min: 0, max: 8192, step: 8 },
    ],
    calculate(v) {
      const cells = Math.min(v.cells, v.size) || 1;
      const sectionEnd = v.start + v.length;
      const rows = [];
      let owned = 0;
      let headers = 0;
      for (let i = 0; i < cells; i += 1) {
        const a = Math.floor((i * v.size) / cells);
        const b = Math.floor(((i + 1) * v.size) / cells);
        const overlap = v.length ? Math.max(0, Math.min(b, sectionEnd) - Math.max(a, v.start)) : 0;
        const region = overlap > 0 ? "__text" : b <= v.start ? "headers" : "segment or unmapped";
        if (overlap > 0) owned += 1;
        if (region === "headers") headers += 1;
        const near = overlap > 0 || (a < v.start + 1 && b > v.start - 2 * (v.size / cells)) || i < 2;
        if (near && rows.length < 12) rows.push([i, a + " to " + b, overlap, region]);
      }
      return {
        summary: "Cell width is about " + Math.round(v.size / cells) + " bytes. The section owns " + owned + " cells; " + headers + " cells come before it.",
        metrics: [
          { label: "Cells drawn", value: cells },
          { label: "Cells labeled __text", value: owned },
          { label: "Cells labeled headers", value: headers },
        ],
        bars: [{ label: "Share of cells for the section", value: owned, max: cells }],
        columns: ["cell", "byte range", "overlap", "region"],
        rows,
      };
    },
  };

  const figures = [
    {
      title: "Detect the format and parse the header",
      steps: [
        { label: "Read the magic", detail: "7f 45 4c 46 is ELF, MZ leads to a PE signature at e_lfanew, cf fa ed fe is Mach-O 64. A COFF object has no magic, so the machine field and SizeOfOptionalHeader 0 decide." },
        { label: "Check the variant", detail: "ELF needs EI_CLASS 2 and EI_DATA 1. A PE optional header needs magic 0x20b. Mach-O 32 and universal files fail with a named reason." },
        { label: "Parse one shape", detail: "parse_header returns format, arch, kind, entry, and the raw fields. LC_MAIN entryoff 0x5e8 plus __TEXT 0x100000000 gives entry 0x1000005e8." },
      ],
      caption: "Every read goes through unpack, which raises FormatError with the offset when a record runs past the end.",
      lab: headerLab,
    },
    {
      title: "Sections, segments, permissions, and entropy",
      steps: [
        { label: "Read the section table", detail: "ELF has 64-byte section headers, COFF and PE 40-byte entries, Mach-O 80-byte section_64 records inside each LC_SEGMENT_64." },
        { label: "Translate permission bits", detail: "ELF uses SHF_ALLOC, SHF_WRITE, and SHF_EXECINSTR. COFF and PE use MEM_READ, MEM_WRITE, and MEM_EXECUTE. Mach-O uses initprot of the segment." },
        { label: "Measure the file bytes", detail: "Entropy is the sum of p log2(1/p) over byte values, only over bytes in the file. NOBITS, uninitialized, and zerofill regions report 0." },
      ],
      caption: "tally report v3 gives 3.3736 bits per byte. __TEXT,__text of the arm64 build gives 5.8595.",
      lab: entropyLab,
    },
    {
      title: "Symbols, string tables, and demangled names",
      steps: [
        { label: "Read the record", detail: "Elf64_Sym 24 bytes, COFF symbol 18 bytes plus auxiliary records, nlist_64 16 bytes." },
        { label: "Resolve the name", detail: "Each name is an offset into a string table. read_cstring refuses an offset outside the table or a name with no NUL." },
        { label: "Demangle the subset", detail: "Nested names record substitutions S_, S0_, S1_. _ZN5tally5resetEPNS_7CounterE becomes tally::reset(tally::Counter*)." },
      ],
      caption: "A name outside the documented subset returns None. The demangler never raises.",
      lab: demangleLab,
    },
    {
      title: "Imports, exports, relocations, and chained fixups",
      steps: [
        { label: "Find the chain", detail: "LC_DYLD_CHAINED_FIXUPS gives a header, one start per segment, and one page start per page." },
        { label: "Decode each word", detail: "Bit 63 selects bind or rebase. Bits 51 to 62 give the distance to the next word in 4-byte steps. Zero ends the chain." },
        { label: "Name the slot", detail: "A bind ordinal indexes the imports table: library ordinal, weak bit, and name offset. A rebase target plus the __TEXT base is the pointer value." },
      ],
      caption: "The word 0x8010000000000003 at 0x100004018 binds _puts from libSystem.",
      lab: fixupLab,
    },
    {
      title: "Strings with sections and recovered function starts",
      steps: [
        { label: "Run five methods", detail: "Symbols, LC_FUNCTION_STARTS, prologue patterns, bl and call targets, and the entry point each produce a list of addresses." },
        { label: "Take the truth", detail: "The function symbols of the unstripped build are the answer key: six starts for the tally executable." },
        { label: "Score each method", detail: "Precision is true starts over reported starts. Recall is true starts over all six." },
      ],
      caption: "At -O2 the prologue scan finds 1 of 6, because the five leaf functions build no stack frame.",
      lab: startsLab,
    },
    {
      title: "JSON report, HTML byte map, and build diff",
      steps: [
        { label: "Slice the file", detail: "Cell i covers i times size // cells up to (i + 1) times size // cells, so the cells cover every byte once." },
        { label: "Label each cell", detail: "The section with the largest overlap wins. Before the first section the label is headers, then the segment, then unmapped." },
        { label: "Shade by entropy", detail: "Opacity is 0.25 + 0.75 times entropy / 8, so padding is faint and code is bright." },
      ],
      caption: "The diff of the -O0 and -O2 builds shows __TEXT,__text 848 to 768 bytes and every function after main moved.",
      lab: mapLab,
    },
  ];

  window.AIFSProjectFigures.register("pj-binary-inspector-1", figures[0]);
  window.AIFSProjectFigures.register("pj-binary-inspector-2", figures[1]);
  window.AIFSProjectFigures.register("pj-binary-inspector-3", figures[2]);
  window.AIFSProjectFigures.register("pj-binary-inspector-4", figures[3]);
  window.AIFSProjectFigures.register("pj-binary-inspector-5", figures[4]);
  window.AIFSProjectFigures.register("pj-binary-inspector-6", figures[5]);
})();
