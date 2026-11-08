(function () {
  "use strict";
  const hex = (n) => (n < 0 ? "-0x" + (-n).toString(16) : "0x" + n.toString(16));
  const REG64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"];
  const REG32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", "r8d", "r9d", "r10d", "r11d", "r12d", "r13d", "r14d", "r15d"];

  function dominatorFacts(nodes, edges, entry) {
    const succ = new Map(nodes.map((n) => [n, []]));
    const pred = new Map(nodes.map((n) => [n, []]));
    edges.forEach(([a, b]) => {
      succ.get(a).push(b);
      pred.get(b).push(a);
    });
    const seen = new Set();
    const post = [];
    const visit = (n) => {
      seen.add(n);
      succ.get(n).forEach((s) => {
        if (!seen.has(s)) visit(s);
      });
      post.push(n);
    };
    visit(entry);
    const order = post.slice().reverse();
    const number = new Map(order.map((n, i) => [n, i]));
    const idom = new Map([[entry, entry]]);
    const intersect = (a, b) => {
      while (a !== b) {
        while (number.get(a) > number.get(b)) a = idom.get(a);
        while (number.get(b) > number.get(a)) b = idom.get(b);
      }
      return a;
    };
    let changed = true;
    let rounds = 0;
    while (changed) {
      changed = false;
      rounds += 1;
      order.slice(1).forEach((n) => {
        const done = pred.get(n).filter((p) => idom.has(p));
        if (!done.length) return;
        let c = done[0];
        done.slice(1).forEach((o) => {
          c = intersect(o, c);
        });
        if (idom.get(n) !== c) {
          idom.set(n, c);
          changed = true;
        }
      });
    }
    const dominates = (d, n) => {
      for (;;) {
        if (n === d) return true;
        const p = idom.get(n);
        if (p === undefined || p === n) return false;
        n = p;
      }
    };
    const df = new Map(order.map((n) => [n, new Set()]));
    order.forEach((n) => {
      const ps = pred.get(n).filter((p) => idom.has(p));
      const root = idom.get(n) === n;
      if (ps.length < 2 && !(root && ps.length)) return;
      ps.forEach((p) => {
        let r = p;
        while (root || r !== idom.get(n)) {
          df.get(r).add(n);
          if (idom.get(r) === r) break;
          r = idom.get(r);
        }
      });
    });
    const back = edges.filter(([a, b]) => idom.has(a) && dominates(b, a));
    return { order, idom, df, back, pred, rounds };
  }

  const elfLab = {
    controls: [
      { key: "base", label: "Symbol value S (.rodata section symbol)", type: "range", value: 0, min: 0, max: 64, step: 4 },
      { key: "addend", label: "Addend A", type: "range", value: -4, min: -16, max: 16, step: 1 },
      { key: "field", label: "Field offset P in .text", type: "range", value: 95, min: 80, max: 120, step: 1 },
      { key: "size", label: "Instruction end minus P (bytes after the field)", type: "range", value: 4, min: 4, max: 8, step: 1 },
      { key: "pcrel", label: "PC-relative record (R_X86_64_PC32)", type: "checkbox", value: true },
    ],
    calculate(v) {
      const end = v.field + v.size;
      const stored = v.pcrel ? v.base + v.addend - v.field : v.base + v.addend;
      const target = v.pcrel ? stored + end : stored;
      return {
        summary: v.pcrel
          ? "The link editor stores S + A - P. The processor adds the field to the end of the instruction, so the operand reaches .rodata+" + hex(target) + "."
          : "An absolute record stores S + A. The operand is .rodata+" + hex(target) + " with no instruction-end correction.",
        formula: v.pcrel ? "target = S + A + (end - P) = " + v.base + " + (" + v.addend + ") + " + v.size + " = " + target : "target = S + A = " + target,
        metrics: [
          { label: "Field value after linking", value: stored },
          { label: "Instruction end", value: hex(end) },
          { label: "Target offset in .rodata", value: hex(target) },
        ],
        columns: ["quantity", "value"],
        rows: [
          ["P (field offset)", hex(v.field)],
          ["end of instruction", hex(end)],
          ["S + A", v.base + v.addend],
          ["resolved target", ".rodata+" + hex(target)],
        ],
      };
    },
  };

  const decoderLab = {
    controls: [
      { key: "bytes", label: "Instruction bytes (hex)", type: "text", value: "48 69 c0 67 66 66 66" },
    ],
    calculate(v) {
      const parts = String(v.bytes).trim().split(/\s+/).filter(Boolean);
      const bytes = parts.map((p) => parseInt(p, 16));
      if (!bytes.length || bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) {
        return { summary: "Enter bytes as two-digit hex values separated by spaces.", metrics: [], rows: [] };
      }
      let i = 0;
      const rows = [];
      const prefixes = [];
      while (i < bytes.length && [0x66, 0x67, 0xf2, 0xf3, 0x2e, 0x3e, 0x26, 0x36, 0x64, 0x65, 0xf0].includes(bytes[i])) {
        prefixes.push(bytes[i]);
        rows.push(["prefix", hex(bytes[i]), bytes[i] === 0x66 ? "operand size 16" : "legacy prefix"]);
        i += 1;
      }
      let rex = 0;
      if (i < bytes.length && bytes[i] >= 0x40 && bytes[i] <= 0x4f) {
        rex = bytes[i];
        rows.push(["REX", hex(rex), "W=" + ((rex >> 3) & 1) + " R=" + ((rex >> 2) & 1) + " X=" + ((rex >> 1) & 1) + " B=" + (rex & 1)]);
        i += 1;
      }
      if (i >= bytes.length) return { summary: "The bytes end before the opcode. The decoder raises an error with the address.", rows };
      const two = bytes[i] === 0x0f;
      const opcode = two ? [bytes[i], bytes[i + 1]] : [bytes[i]];
      i += opcode.length;
      rows.push(["opcode", opcode.filter((b) => b !== undefined).map((b) => b.toString(16).padStart(2, "0")).join(" "), two ? "two-byte map" : "one-byte map"]);
      const width = rex & 8 ? 64 : prefixes.includes(0x66) ? 16 : 32;
      const names = width === 64 ? REG64 : REG32;
      const usesModrm = !(opcode[0] >= 0x50 && opcode[0] <= 0x5f) && ![0xc3, 0x90, 0x99, 0xe8, 0xe9, 0xeb].includes(opcode[0]) && !(opcode[0] >= 0x70 && opcode[0] <= 0x7f);
      let length = i;
      if (usesModrm && i < bytes.length) {
        const m = bytes[i];
        const mod = m >> 6;
        const reg = ((m >> 3) & 7) | (rex & 4 ? 8 : 0);
        let rm = (m & 7) | (rex & 1 ? 8 : 0);
        rows.push(["ModRM", hex(m), "mod=" + mod + " reg=" + reg + " (" + names[reg] + ") rm=" + rm]);
        length += 1;
        if (mod !== 3 && (m & 7) === 4) {
          const sib = bytes[length];
          if (sib === undefined) return { summary: "ModRM asks for a SIB byte that is not there.", rows };
          const scale = 1 << (sib >> 6);
          const index = ((sib >> 3) & 7) | (rex & 2 ? 8 : 0);
          const base = (sib & 7) | (rex & 1 ? 8 : 0);
          rows.push(["SIB", hex(sib), "scale=" + scale + " index=" + (index === 4 ? "none" : REG64[index]) + " base=" + REG64[base]]);
          length += 1;
          rm = base;
        }
        const disp = mod === 1 ? 1 : mod === 2 || (mod === 0 && (m & 7) === 5) ? 4 : 0;
        if (disp) {
          rows.push(["displacement", disp + " byte(s) at offset " + length, mod === 0 && (m & 7) === 5 ? "RIP-relative" : "signed"]);
          length += disp;
        }
        if (mod === 3) rows.push(["r/m operand", names[rm], "register form"]);
      }
      const immediate = Math.max(0, bytes.length - length);
      if (immediate) rows.push(["immediate", immediate + " byte(s) at offset " + length, "little-endian"]);
      return {
        summary: "Operand size " + width + " bits. REX.W " + (rex & 8 ? "selects" : "does not select") + " 64-bit registers.",
        metrics: [
          { label: "Operand size", value: width },
          { label: "Fields before the immediate", value: length },
          { label: "Total length", value: bytes.length },
        ],
        bars: [{ label: "Length of 15 allowed", value: Math.min(bytes.length, 15), max: 15 }],
        columns: ["field", "bytes", "meaning"],
        rows,
      };
    },
  };

  const graphLab = {
    controls: [
      { key: "back", label: "Back edge 4 -> 2 (loop)", type: "checkbox", value: false },
      { key: "entryLoop", label: "Back edge 4 -> 1 (loop to the entry)", type: "checkbox", value: false },
      { key: "skip", label: "Edge 1 -> 4 (skip both arms)", type: "checkbox", value: false },
    ],
    calculate(v) {
      const edges = [[1, 2], [1, 3], [2, 4], [3, 4], [4, 5]];
      if (v.back) edges.push([4, 2]);
      if (v.entryLoop) edges.push([4, 1]);
      if (v.skip) edges.push([1, 4]);
      const facts = dominatorFacts([1, 2, 3, 4, 5], edges, 1);
      const rows = facts.order.map((n) => [n, facts.idom.get(n), [...facts.df.get(n)].sort().join(", ") || "none", facts.pred.get(n).join(", ") || "none"]);
      return {
        summary: facts.back.length ? "Back edges: " + facts.back.map((e) => e.join(" -> ")).join(", ") + ". The target dominates the source, so each one closes a natural loop." : "No edge returns to a dominator, so the graph has no loop.",
        metrics: [
          { label: "Edges", value: edges.length },
          { label: "Back edges", value: facts.back.length },
          { label: "Rounds until stable", value: facts.rounds },
        ],
        columns: ["block", "immediate dominator", "dominance frontier", "predecessors"],
        rows,
      };
    },
  };

  const ssaLab = {
    controls: [
      { key: "left", label: "x assigned in block 2 (then arm)", type: "checkbox", value: true },
      { key: "right", label: "x assigned in block 3 (else arm)", type: "checkbox", value: false },
      { key: "loop", label: "Back edge 4 -> 1 and x assigned in block 4", type: "checkbox", value: false },
    ],
    calculate(v) {
      const edges = [[1, 2], [1, 3], [2, 4], [3, 4], [4, 5]];
      if (v.loop) edges.push([4, 1]);
      const facts = dominatorFacts([1, 2, 3, 4, 5], edges, 1);
      const defs = [];
      if (v.left) defs.push(2);
      if (v.right) defs.push(3);
      if (v.loop) defs.push(4);
      const phis = new Set();
      const work = defs.slice();
      while (work.length) {
        const n = work.pop();
        facts.df.get(n).forEach((j) => {
          if (phis.has(j)) return;
          phis.add(j);
          if (!defs.includes(j)) work.push(j);
        });
      }
      const rows = [...phis].sort().map((j) => {
        const sources = facts.pred.get(j).map((p) => "from " + p);
        if (j === 1) sources.unshift("entry value x_0");
        return [j, "x = phi(" + sources.join(", ") + ")", sources.length];
      });
      return {
        summary: defs.length ? "Definitions in blocks " + defs.join(", ") + " reach joins through the iterated dominance frontier." : "x is never assigned, so every use reads the entry value x_0 and no phi is needed.",
        metrics: [
          { label: "Definition sites", value: defs.length },
          { label: "Phi statements", value: phis.size },
        ],
        columns: ["block", "phi", "sources"],
        rows,
      };
    },
  };

  const magicLab = {
    controls: [
      { key: "divisor", label: "Divisor d", type: "range", value: 10, min: 2, max: 100, step: 1 },
      { key: "shift", label: "Total shift s", type: "range", value: 34, min: 32, max: 40, step: 1 },
      { key: "x", label: "Input x", type: "number", value: -7, min: -2147483648, max: 2147483647, step: 1 },
    ],
    calculate(v) {
      const s = BigInt(v.shift);
      const d = BigInt(v.divisor);
      const power = 1n << s;
      const m = (power + d - 1n) / d;
      const error = m * d - power;
      const bound = power >> 31n;
      const x = BigInt(v.x);
      const product = x * m;
      const floor = product >= 0n ? product >> s : -((-product + power - 1n) >> s);
      const sign = product < 0n ? 1n : 0n;
      const idiom = floor + sign;
      const c = x / d;
      const fits = m < 1n << 31n;
      const ok = error <= bound && fits;
      return {
        summary: ok ? "m = " + hex(Number(m)) + " passes the error bound, so the shift-and-add sequence equals x / " + v.divisor + " for every int x." : fits ? "The error m*d - 2^s exceeds 2^s / 2^31. Some int inputs would land on the wrong quotient, so the pass must not fold this pair." : "m does not fit in a signed 32-bit immediate, so the compiler cannot emit this form with imul.",
        formula: "m = ceil(2^" + v.shift + " / " + v.divisor + ") = " + m + "\nerror = m*d - 2^s = " + error + " (bound " + bound + ")",
        metrics: [
          { label: "Multiplier m", value: hex(Number(m)) },
          { label: "Idiom result", value: Number(idiom) },
          { label: "C division", value: Number(c) },
        ],
        bars: [{ label: "Error against bound", value: Number(error > bound * 4n ? bound * 4n : error), max: Number(bound * 4n || 1n) }],
        columns: ["step", "value"],
        rows: [
          ["(long)x * m", product.toString()],
          ["product >> s (floor)", floor.toString()],
          ["sign bit of product", sign.toString()],
          ["quotient", idiom.toString()],
          ["fold allowed", ok ? "yes" : "no"],
        ],
      };
    },
  };

  const signatureLab = {
    controls: [
      { key: "rdi", label: "%rdi read before any write", type: "checkbox", value: true },
      { key: "rsi", label: "%rsi read before any write", type: "checkbox", value: true },
      { key: "rdx", label: "%rdx read before any write", type: "checkbox", value: false },
      {
        key: "shape",
        label: "How %rdi is used",
        type: "select",
        value: "offsets",
        options: [
          { value: "scalar", label: "Arithmetic only" },
          { value: "scaled", label: "Base of (rdi, index, 4)" },
          { value: "offsets", label: "Base of 0(rdi) and 4(rdi)" },
        ],
      },
      {
        key: "sign",
        label: "Instructions that touch %esi",
        type: "select",
        value: "signed",
        options: [
          { value: "none", label: "add and mov only" },
          { value: "signed", label: "cltd and idivl" },
          { value: "compare", label: "cmp then ja (range check)" },
          { value: "unsigned", label: "shrl" },
        ],
      },
    ],
    calculate(v) {
      const order = ["rdi", "rsi", "rdx"];
      const highest = order.reduce((acc, r, i) => (v[r] ? i : acc), -1);
      const params = [];
      for (let i = 0; i <= highest; i += 1) {
        let type = "int";
        let evidence = v[order[i]] ? "read before write" : "unused, but a later argument register is read";
        if (i === 0 && v.rdi && v.shape === "scaled") {
          type = "int *";
          evidence = "scaled element access";
        } else if (i === 0 && v.rdi && v.shape === "offsets") {
          type = "struct f_param_1 *";
          evidence = "constant offsets 0x0, 0x4";
        } else if (i === 1) {
          const labels = { none: "none", signed: "signed", compare: "unsigned-compare", unsigned: "unsigned" };
          evidence = "signedness: " + labels[v.sign];
          if (v.sign === "unsigned") type = "unsigned int";
        }
        params.push([("param_" + (i + 1)), "%" + order[i], type, evidence]);
      }
      const decl = "int f(" + (params.length ? params.map((p) => (p[2].endsWith("*") ? p[2] + p[0] : p[2] + " " + p[0])).join(", ") : "void") + ")";
      return {
        summary: decl,
        metrics: [
          { label: "Parameters", value: params.length },
          { label: "Highest argument register", value: highest < 0 ? "none" : "%" + order[highest] },
        ],
        columns: ["name", "register", "type", "evidence"],
        rows: params,
      };
    },
  };

  const structureLab = {
    controls: [
      {
        key: "join",
        label: "Immediate post-dominator of the branch block",
        type: "select",
        value: "fall",
        options: [
          { value: "fall", label: "The fallthrough block" },
          { value: "taken", label: "The taken block" },
          { value: "other", label: "A third block after both arms" },
          { value: "exit", label: "The virtual exit (both arms return)" },
        ],
      },
      { key: "taken", label: "Blocks in the taken arm", type: "range", value: 1, min: 1, max: 6, step: 1 },
      { key: "fall", label: "Blocks in the fallthrough arm", type: "range", value: 2, min: 1, max: 6, step: 1 },
      { key: "headerExit", label: "Loop header has the exit branch", type: "checkbox", value: false },
    ],
    calculate(v) {
      let lines;
      if (v.join === "fall") lines = ["if (cond) {", "  /* taken arm: " + v.taken + " block(s) */", "}", "/* join */"];
      else if (v.join === "taken") lines = ["if (!cond) {", "  /* fallthrough arm: " + v.fall + " block(s) */", "}", "/* join */"];
      else if (v.join === "exit") {
        const smallFirst = v.fall < v.taken;
        lines = ["if (" + (smallFirst ? "!cond" : "cond") + ") {", "  /* " + (smallFirst ? v.fall : v.taken) + " block(s), ends in return */", "}", "/* " + (smallFirst ? v.taken : v.fall) + " block(s), ends in return */"];
      } else lines = ["if (cond) {", "  /* " + v.taken + " block(s) */", "} else {", "  /* " + v.fall + " block(s) */", "}", "/* join */"];
      const loop = v.headerExit ? ["while (cond) {", "  /* body */", "}"] : ["do {", "  /* body */", "} while (cond);"];
      return {
        summary: "The branch becomes " + (v.join === "other" ? "if-else" : v.join === "exit" ? "an early-return if" : "a single if") + ". The loop becomes " + (v.headerExit ? "while" : "do-while") + ".",
        formula: lines.concat([""], loop).join("\n"),
        metrics: [
          { label: "Emitted lines", value: lines.length + loop.length },
          { label: "goto statements", value: 0 },
        ],
      };
    },
  };

  const verifyLab = {
    controls: [
      { key: "scalars", label: "int parameters", type: "range", value: 1, min: 0, max: 3, step: 1 },
      { key: "pointer", label: "One pointer parameter", type: "checkbox", value: false },
      { key: "constants", label: "Distinct compare constants outside the base values", type: "range", value: 1, min: 0, max: 4, step: 1 },
      { key: "mismatch", label: "Cells where original and candidate differ", type: "range", value: 0, min: 0, max: 5, step: 1 },
      { key: "bytes", label: "Unmasked bytes that differ", type: "range", value: 0, min: 0, max: 8, step: 1 },
      { key: "clang", label: "clang on PATH", type: "checkbox", value: true },
    ],
    calculate(v) {
      const base = v.pointer ? 6 : 10;
      const perScalar = base + 2 * v.constants;
      const cells = Math.min(400, (v.pointer ? 5 : 1) * Math.pow(perScalar, v.scalars));
      const behaviour = !v.clang ? "unknown" : v.mismatch ? "fail" : "pass";
      const bytes = !v.clang ? "unknown" : v.bytes ? "differs" : "pass";
      const status = behaviour === "fail" ? "fail" : behaviour === "unknown" || bytes === "unknown" ? "unknown" : bytes === "pass" ? "pass" : "behaviour-only";
      return {
        summary: "Aggregate status: " + status + ". Fail wins over unknown, and unknown wins over pass.",
        metrics: [
          { label: "Grid cells", value: v.clang ? cells : 0 },
          { label: "Behaviour leg", value: behaviour },
          { label: "Bytes leg", value: bytes },
        ],
        bars: [{ label: "Cells of the 400 cap", value: v.clang ? cells : 0, max: 400 }],
        columns: ["leg", "status", "reason"],
        rows: [
          ["behaviour", behaviour, v.clang ? v.mismatch + " mismatching cell(s)" : "clang is not on PATH"],
          ["bytes", bytes, v.clang ? (v.bytes ? v.bytes + " unmasked byte(s) differ" : "masked bytes equal") : "no recompiled object"],
        ],
      };
    },
  };

  const figures = [
    ["Read an ELF relocatable object", "ElfObject, relocation_target", "Validate the header, read sections, symbols and RELA records, and resolve a PC-relative field to the offset it reaches.", "band at -O1 has one R_X86_64_PC32 record at 0x5f with addend -4; the lea ends at 0x63, so the table is at .rodata+0x0.", elfLab],
    ["Decode the x86-64 subset", "decode, linear_sweep", "Prefixes, REX, opcode, ModRM, SIB, displacement and immediate are read in that order, and each field position is recorded.", "48 69 c0 67 66 66 66 is imulq $0x66666667, %rax, %rax: REX.W, opcode 69, ModRM c0, a 4-byte immediate at offset 3.", decoderLab],
    ["Recover control flow", "recursive_descent, ControlFlowGraph", "Recursive descent follows targets, a jump table adds table edges, and the iterative algorithm computes immediate dominators and frontiers.", "A back edge goes to a block that dominates its source. A back edge to the entry puts the entry in its own frontier.", graphLab],
    ["Lift to IR and build SSA", "lift_instruction, insert_phis, rename", "Each instruction becomes IR statements with flags as a variable. Phis go on the iterated dominance frontier of every definition site.", "fold at -O1 gets four phis at the loop header 0x80: esi, rdx, eax and flags.", ssaLab],
    ["Simplify and fold idioms", "magic_divisor, optimize", "Flags become comparisons, copies and dead definitions go away, and a multiply-shift-sign sequence folds to a division when the bound holds.", "0x66666667 with shift 34 is division by 10: the error 6 is below the bound 8.", magicLab],
    ["Recover the signature and types", "collect_params, infer_types, recover_signature", "Argument registers read before a write fix the parameter count. Memory shapes give pointer and struct types; instruction choices give signedness.", "record reads 0(%rdi) and 4(%rdi), so param_1 is a pointer to a struct with fields at 0x0 and 0x4.", signatureLab],
    ["Structure the graph and emit C", "Structurer, decompile", "The immediate post-dominator is the join of a conditional. Loops come first, then two-way and n-way branches.", "band at -O0 becomes a switch with six cases and a default and no goto.", structureLab],
    ["Prove the output", "mask_relocations, input_grid, verify", "Recompile, compare masked bytes and referenced constants, run the grid on both versions, and aggregate fail-closed.", "At -O1 every function passes the grid; fold differs by two bytes, so the aggregate is behaviour-only.", verifyLab],
  ];

  const config = ([title, contract, mechanism, observe, lab]) => ({
    title,
    steps: [
      { label: "Input contract", detail: contract },
      { label: title, detail: mechanism },
      { label: "Observe the result", detail: observe },
    ],
    caption: "Change the inputs and read the computed values before you run the stage tests.",
    lab,
  });
  window.AIFSProjectFigures.register("pj-mini-decompiler-1", config(figures[0]));
  window.AIFSProjectFigures.register("pj-mini-decompiler-2", config(figures[1]));
  window.AIFSProjectFigures.register("pj-mini-decompiler-3", config(figures[2]));
  window.AIFSProjectFigures.register("pj-mini-decompiler-4", config(figures[3]));
  window.AIFSProjectFigures.register("pj-mini-decompiler-5", config(figures[4]));
  window.AIFSProjectFigures.register("pj-mini-decompiler-6", config(figures[5]));
  window.AIFSProjectFigures.register("pj-mini-decompiler-7", config(figures[6]));
  window.AIFSProjectFigures.register("pj-mini-decompiler-8", config(figures[7]));
})();
