export const CONCEPT = {
  header: "HEADER",
  sections: "SECTIONS",
  disasm: "DISASSEMBLY",
  cfg: "CFG",
  lift: "LIFT",
  types: "TYPES",
  structure: "STRUCTURE",
  pseudocode: "PSEUDOCODE",
  ledger: "LEDGER",
  carriage: "ANALYSIS",
};

export const PART_ORDER = ["header", "sections", "disasm", "cfg", "lift", "types", "structure", "pseudocode", "ledger", "carriage"];

const lesson = (path, title) => ({ href: `/lesson?path=${encodeURIComponent(path)}`, title });
const RE = "phases/13-tools-and-protocols/";

export const INFO = {
  header: {
    name: "ELF file card",
    is: "The first bytes of the file and the ELF header.",
    does: "The card shows what the first 64 bytes say. The yellow band is the magic number 7f 45 4c 46. Below it: ELF64, little-endian (LSB), a relocatable object (REL) for x86-64, and the number of section headers. The three fixture objects agree on every line except the section count.",
    why: "Every later station trusts these fields. A wrong byte order or a wrong machine number makes every instruction wrong.",
    without: "The machine cannot find the section table, so it has no code to decode.",
    code: "magic = data[:4]; assert magic == b'\\x7fELF'; e_type, e_machine = struct.unpack_from('<HH', data, 16)",
    lesson: lesson(RE + "32-program-anatomy-elf-from-scratch", "Program Anatomy: An ELF Reader From Scratch"),
  },
  sections: {
    name: "Section cabinet and symbol index",
    is: "The section header table and the symbol table.",
    does: "Each drawer is one real section header of the object, in file order and with its real name. The yellow drawer is .text, where the code is, and it opens. The index box on top is .symtab. A symbol gives the name of the function, its start and its size. Switch symbols off and a bar locks the index box.",
    why: "With a symbol, the decoder knows where the function starts and ends. Without one, it knows only the start of the section.",
    without: "With the symbol table locked, the name is unknown and the end is unknown. The machine names the function fn_0 and records both gaps in the ledger.",
    code: "for s in sections: if s.name == '.text': code = data[s.offset:s.offset + s.size]. symbol = symtab['percent_change'] gives value and size.",
    lesson: lesson(RE + "40-linking-loading-and-stripped-binaries", "Linking, Loading, and Stripped Binaries"),
  },
  disasm: {
    name: "Decoder chip and output bed",
    is: "The disassembler. It turns bytes into instructions.",
    does: "The byte strip feeds a decoder chip. The 16 lanes on the chip are one 16-byte window of the function: yellow and white lanes mark the bytes of each decoded instruction in turn, grey lanes are bytes decoded but never reached, and dark lanes are bytes that no decoded instruction covers. The decoded instructions come out as tiles on the bed behind the chip. Recursive descent follows each jump. Linear sweep decodes every byte in address order. A tall tile is an instruction that a path reaches. A low tile is one that no path reaches.",
    why: "Code and data can sit in the same section. Only the jumps tell you which bytes are code.",
    without: "Linear sweep decodes data and padding as instructions. On the data-in-code program, it decodes four data bytes and then misses the real instruction at 0x14. The pin shows where the jump lands.",
    code: "descent: worklist = [entry]; decode until ret or jmp; push every branch target. sweep: pos = start; while pos < end: insn = decode(pos); pos += insn.length",
    lesson: lesson(RE + "33-disassembly-and-control-flow", "Disassembly and Control Flow"),
  },
  cfg: {
    name: "Routing board and drop bin",
    is: "Basic blocks and the control-flow graph.",
    does: "Each cube is a basic block: one entry at the top, one exit at the bottom. The traces on the board are the edges, and the board prints the real count of blocks and edges. Blocks that no path from the entry reaches fall into the bin.",
    why: "Every later stage works on the graph, not on the list of instructions. The shape of the graph gives the ifs and the loops.",
    without: "Without the reachability check, padding and data stay in the function and the lifter tries to explain them.",
    code: "leaders = {entry} | jump targets | addresses after a jump or ret. blocks = split at leaders. drop blocks not reachable from entry.",
    lesson: lesson(RE + "33-disassembly-and-control-flow", "Disassembly and Control Flow"),
  },
  lift: {
    name: "Lift press and IR stack",
    is: "The lifter. It turns each instruction into statements of a small IR.",
    does: "The press comes down and stacks one IR plate for each statement. The flags become a variable, cltd and idiv become one division, and the frame instructions give no statements. On the data-in-code program, the lifter does not know the opcode 0f b6, and the bolt stops the press.",
    why: "Machine instructions have side effects. The IR writes each effect as a plain assignment, so later passes can reason about it.",
    without: "There is no IR, so there are no types, no structure and no pseudocode. The ledger records what the lifter could not read.",
    code: "testl %edi, %edi -> flags = test(edi, edi). je 0xd -> if je(flags) goto 0xd else goto 0x4. retq -> return rax.",
    lesson: lesson(RE + "34-lifting-to-pseudocode", "Lifting to Pseudocode"),
  },
  types: {
    name: "Register and stack slots",
    is: "Data flow and type recovery.",
    does: "The front row holds register slots: RDI and RSI for the two parameters, and RAX for the return value. The back row holds stack slots, named by their offset from rbp: at -O0 the lifter finds local_4, local_8 and local_c at rbp-0x4, rbp-0x8 and rbp-0xc. At -O2 there are none. A yellow token drops into each slot when its type is recovered.",
    why: "Machine code has widths, not types. A 32-bit value becomes int. The source names are gone, so the parameters become param_1 and param_2.",
    without: "Without data flow, every register read stays a raw register, and the output does not say which values are inputs.",
    code: "params = [r for r in ('rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9') if read_before_write(r)]. type = 'int' if width == 32 else 'long'.",
    lesson: lesson(RE + "41-recovering-data-and-types", "Recovering Data and Types"),
  },
  structure: {
    name: "Structuring jig",
    is: "Structuring. It turns the graph back into ifs and loops.",
    does: "The jaws close round the condition block. At -O2 one jaw closes: an if with an early return. At -O0 both jaws close: an if/else that joins before the return.",
    why: "A graph with gotos is hard to read. The post-dominator of a branch is its join, and that gives the shape of the if.",
    without: "The pseudocode is a list of blocks joined by goto statements.",
    code: "join = ipdom[branch]. if join is the exit: emit the early return. else: emit if (cond) { a } else { b } and continue at join.",
    lesson: lesson(RE + "34-lifting-to-pseudocode", "Lifting to Pseudocode"),
  },
  pseudocode: {
    name: "Pseudocode printer",
    is: "The output: C-like pseudocode.",
    does: "The printer feeds the sheet up one line for each line of pseudocode. The length of each printed line follows the length of the real line.",
    why: "People and agents read pseudocode faster than assembly. It is still a claim about the bytes, not a fact.",
    without: "The reader has the IR, which is correct but slow to read.",
    code: "int percent_change(int param_1, int param_2) { if (param_1 == 0) { return 0; } return (param_2 - param_1) * 100 / param_1; }",
    lesson: lesson(RE + "36-rebuild-and-prove-equal", "Rebuild and Prove Equal"),
  },
  ledger: {
    name: "Evidence ledger",
    is: "The evidence ledger: what was observed, what was derived, what was inferred, and what is unknown.",
    does: "Each station files cards in four trays. Observed: read from the bytes. Derived: computed from observed facts. Inferred: a claim that no observation states yet. Unknown: a gap the machine could not close.",
    why: "Pseudocode looks like a fact. The ledger shows which parts rest on bytes and which parts rest on a guess. An agent cites the ledger, not the pseudocode.",
    without: "A wrong decode and a right decode look the same. Nothing tells the reader that the function name was a placeholder or that the types came from widths.",
    code: "record = {claim, confidence: 'observed' | 'derived' | 'inferred', stage}; unknowns are records too. Never drop a limitation.",
    lesson: lesson(RE + "35-evidence-confidence-and-unknowns", "Evidence, Confidence, and Unknowns"),
  },
  carriage: {
    name: "Analysis carriage",
    is: "The analysis so far. One plate for each stage that finished.",
    does: "The carriage carries the work from station to station along the rail. Each head presses one plate onto the stack.",
    why: "Each stage uses the output of the stage before it. A mistake at one station rides on the carriage to every later station.",
    without: "The stages do not connect.",
    code: "state = read_header(data); state = read_sections(state); state = decode(state); ...",
    lesson: lesson(RE + "34-lifting-to-pseudocode", "Lifting to Pseudocode"),
  },
};

export const SCENARIOS = [
  { label: "Healthy run", note: "-O2, symbols, recursive descent.", config: {} },
  { label: "Unoptimized build", note: "-O0: stack slots and an if/else.", config: { opt: "O0" } },
  { label: "Strip the symbols", note: "The name and the end are unknown.", config: { symbols: false } },
  { label: "Linear sweep at -O0", note: "Padding decoded as code.", config: { opt: "O0", sweep: "linear" } },
  { label: "Linear sweep, no symbols", note: "The sweep runs to the end of .text.", config: { symbols: false, sweep: "linear" } },
  { label: "Data in code, linear sweep", note: "Data decoded, a real instruction missed.", config: { program: "trap", sweep: "linear" } },
  { label: "Data in code, descent", note: "The jump skips the data.", config: { program: "trap" } },
];

export const STEPS = {
  header: { label: "Read the header", hint: "The machine reads the first bytes. They say: this is a program file.", sound: "tap tap" },
  sections: { label: "Open the sections", hint: "It opens the drawer that holds the code.", sound: "skreek" },
  decode: { label: "Decode the bytes", hint: "It reads the bytes and turns them into small commands.", sound: "tik tik" },
  cfg: { label: "Join the blocks", hint: "It puts the commands in blocks and draws the roads between them.", sound: "plok" },
  prune: { label: "Drop dead blocks", hint: "A block that no road reaches falls in the bin.", sound: "thud" },
  lift: { label: "Lift to plain steps", hint: "It turns each command into a plain, simple step.", sound: "shff" },
  refuse: { label: "Stop and refuse", hint: "It stops. It does not know what these bytes do.", sound: "bzzt" },
  types: { label: "Find the types", hint: "It looks at each box and guesses what kind of number it holds.", sound: "tink" },
  structure: { label: "Find the if", hint: "It finds the place where the code goes one way or the other.", sound: "clack" },
  emit: { label: "Print the code", hint: "It prints code that a person can read.", sound: "brrr" },
  ledger: { label: "Sort the evidence", hint: "It puts what it saw in one tray and what it guessed in another.", sound: "flap" },
  exit: { label: "Finish", hint: "Done. A green lamp means it worked. A red lamp means it stopped.", sound: "ding" },
};

export const READY_HINT = "Press step 1. The machine reads one small program, one step at a time.";
