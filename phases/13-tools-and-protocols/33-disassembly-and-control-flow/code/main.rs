// Lesson: Disassembly and Control Flow (phase 13 / lesson 33)
// Rust port of code/main.py. Standard library only.
// Source: phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

#![allow(dead_code)]

use std::cell::OnceCell;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_INSTRUCTION_LENGTH: usize = 15;
const SHT_SYMTAB: u32 = 2;
const SHT_STRTAB: u32 = 3;
const SHT_RELA: u32 = 4;
const SHT_NOBITS: u32 = 8;
const STT_SECTION: u8 = 3;
const STT_FUNC: u8 = 2;
const EM_X86_64: u16 = 62;

fn relocation_name(t: u32) -> String {
    match t {
        0 => "R_X86_64_NONE".into(),
        1 => "R_X86_64_64".into(),
        2 => "R_X86_64_PC32".into(),
        4 => "R_X86_64_PLT32".into(),
        10 => "R_X86_64_32".into(),
        11 => "R_X86_64_32S".into(),
        _ => format!("R_X86_64_{}", t),
    }
}

fn pc_relative(t: u32) -> bool {
    t == 2 || t == 4
}

#[derive(Clone, Debug)]
enum J {
    Null,
    Bool(bool),
    Int(i64),
    Str(String),
    Arr(Vec<J>),
    Obj(Vec<(String, J)>),
}

impl J {
    fn obj() -> J {
        J::Obj(Vec::new())
    }

    fn set(&mut self, key: &str, value: J) {
        if let J::Obj(pairs) = self {
            if let Some(slot) = pairs.iter_mut().find(|(k, _)| k == key) {
                slot.1 = value;
            } else {
                pairs.push((key.to_string(), value));
            }
        }
    }

    fn with(mut self, key: &str, value: J) -> J {
        self.set(key, value);
        self
    }

    fn extend(mut self, other: J) -> J {
        if let J::Obj(pairs) = other {
            for (k, v) in pairs {
                self.set(&k, v);
            }
        }
        self
    }

    fn get(&self, key: &str) -> Option<&J> {
        match self {
            J::Obj(pairs) => pairs.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    fn dump(&self, indent: Option<usize>) -> String {
        let mut out = String::new();
        self.write(&mut out, indent, 0);
        out
    }

    fn write(&self, out: &mut String, indent: Option<usize>, depth: usize) {
        let (item_sep, key_sep) = match indent {
            Some(_) => (",", ": "),
            None => (",", ":"),
        };
        let newline = |out: &mut String, d: usize| {
            if let Some(n) = indent {
                out.push('\n');
                out.push_str(&" ".repeat(n * d));
            }
        };
        match self {
            J::Null => out.push_str("null"),
            J::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
            J::Int(i) => out.push_str(&i.to_string()),
            J::Str(s) => out.push_str(&json_quote(s)),
            J::Arr(items) => {
                if items.is_empty() {
                    out.push_str("[]");
                    return;
                }
                out.push('[');
                for (i, item) in items.iter().enumerate() {
                    if i > 0 {
                        out.push_str(item_sep);
                    }
                    newline(out, depth + 1);
                    item.write(out, indent, depth + 1);
                }
                newline(out, depth);
                out.push(']');
            }
            J::Obj(pairs) => {
                if pairs.is_empty() {
                    out.push_str("{}");
                    return;
                }
                out.push('{');
                for (i, (k, v)) in pairs.iter().enumerate() {
                    if i > 0 {
                        out.push_str(item_sep);
                    }
                    newline(out, depth + 1);
                    out.push_str(&json_quote(k));
                    out.push_str(key_sep);
                    v.write(out, indent, depth + 1);
                }
                newline(out, depth);
                out.push('}');
            }
        }
    }
}

fn json_quote(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 || ((c as u32) > 0x7e && (c as u32) < 0x10000) => {
                out.push_str(&format!("\\u{:04x}", c as u32))
            }
            c if (c as u32) >= 0x10000 => {
                let mut buf = [0u16; 2];
                for unit in c.encode_utf16(&mut buf) {
                    out.push_str(&format!("\\u{:04x}", unit));
                }
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn s(v: impl Into<String>) -> J {
    J::Str(v.into())
}

fn hx(v: u64) -> String {
    format!("0x{:x}", v)
}

fn hex_spaced(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(" ")
}

#[derive(Clone)]
struct Section {
    index: usize,
    name: String,
    type_: u32,
    flags: u64,
    offset: u64,
    size: u64,
    link: u32,
    info: u32,
    entsize: u64,
    data: Vec<u8>,
}

#[derive(Clone)]
struct Symbol {
    name: String,
    value: u64,
    size: u64,
    type_: u8,
    bind: u8,
    shndx: u16,
    section: String,
}

#[derive(Clone)]
struct Relocation {
    section: String,
    offset: u64,
    type_: u32,
    symbol: Symbol,
    addend: i64,
}

impl Relocation {
    fn type_name(&self) -> String {
        relocation_name(self.type_)
    }

    fn symbol_name(&self) -> String {
        if self.symbol.type_ == STT_SECTION {
            self.symbol.section.clone()
        } else {
            self.symbol.name.clone()
        }
    }

    fn describe(&self) -> String {
        if self.addend == 0 {
            return format!("{} {}", self.type_name(), self.symbol_name());
        }
        let sign = if self.addend > 0 { "+" } else { "-" };
        format!("{} {}{}0x{:x}", self.type_name(), self.symbol_name(), sign, self.addend.unsigned_abs())
    }
}

fn rd<const N: usize>(data: &[u8], offset: u64) -> Result<[u8; N], String> {
    let o = offset as usize;
    data.get(o..o + N)
        .map(|b| b.try_into().unwrap())
        .ok_or_else(|| format!("unpack_from requires a buffer of at least {} bytes", o + N))
}

fn u16_at(d: &[u8], o: u64) -> Result<u16, String> {
    Ok(u16::from_le_bytes(rd::<2>(d, o)?))
}

fn u32_at(d: &[u8], o: u64) -> Result<u32, String> {
    Ok(u32::from_le_bytes(rd::<4>(d, o)?))
}

fn u64_at(d: &[u8], o: u64) -> Result<u64, String> {
    Ok(u64::from_le_bytes(rd::<8>(d, o)?))
}

fn slice_clamped(data: &[u8], start: u64, len: u64) -> Vec<u8> {
    let n = data.len() as u64;
    let a = start.min(n);
    let b = start.saturating_add(len).min(n);
    if b <= a {
        Vec::new()
    } else {
        data[a as usize..b as usize].to_vec()
    }
}

fn cstring(table: &[u8], offset: u64) -> String {
    let start = (offset as usize).min(table.len());
    let end = table[start..].iter().position(|&b| b == 0).map(|p| start + p).unwrap_or(table.len());
    table[start..end].iter().map(|&b| if b < 0x80 { b as char } else { '\u{fffd}' }).collect()
}

struct ElfObject {
    machine: u16,
    sections: Vec<Section>,
    symbols: Vec<Symbol>,
    relocations: Vec<(String, Vec<Relocation>)>,
}

impl ElfObject {
    fn new(data: &[u8]) -> Result<ElfObject, String> {
        if data.len() < 4 || &data[..4] != b"\x7fELF" {
            return Err("not an ELF file".into());
        }
        if data[4] != 2 || data[5] != 1 {
            return Err("only ELF64 little-endian objects are supported".into());
        }
        let machine = u16_at(data, 18)?;
        if machine != EM_X86_64 {
            return Err(format!("e_machine {} is not x86-64", machine));
        }
        let shoff = u64_at(data, 40)?;
        let shentsize = u16_at(data, 58)? as u64;
        let shnum = u16_at(data, 60)? as u64;
        let shstrndx = u16_at(data, 62)? as usize;
        let mut raw = Vec::new();
        for index in 0..shnum {
            let b = shoff + index * shentsize;
            raw.push((
                u32_at(data, b)?,
                u32_at(data, b + 4)?,
                u64_at(data, b + 8)?,
                u64_at(data, b + 24)?,
                u64_at(data, b + 32)?,
                u32_at(data, b + 40)?,
                u32_at(data, b + 44)?,
                u64_at(data, b + 56)?,
            ));
        }
        let names = raw.get(shstrndx).ok_or("list index out of range")?;
        let name_table = slice_clamped(data, names.3, names.4);
        let mut sections = Vec::new();
        for (index, r) in raw.iter().enumerate() {
            let payload = if r.1 == SHT_NOBITS { Vec::new() } else { slice_clamped(data, r.3, r.4) };
            sections.push(Section {
                index,
                name: cstring(&name_table, r.0 as u64),
                type_: r.1,
                flags: r.2,
                offset: r.3,
                size: r.4,
                link: r.5,
                info: r.6,
                entsize: r.7,
                data: payload,
            });
        }
        let mut elf = ElfObject { machine, sections, symbols: vec![], relocations: vec![] };
        elf.symbols = elf.read_symbols()?;
        elf.relocations = elf.read_relocations()?;
        Ok(elf)
    }

    fn read_symbols(&self) -> Result<Vec<Symbol>, String> {
        let mut out = Vec::new();
        for section in &self.sections {
            if section.type_ != SHT_SYMTAB {
                continue;
            }
            let strings = &self.sections.get(section.link as usize).ok_or("list index out of range")?.data;
            let mut offset = 0;
            while offset < section.size {
                let d = &section.data;
                let st_name = u32_at(d, offset)?;
                let st_info = rd::<1>(d, offset + 4)?[0];
                let st_shndx = u16_at(d, offset + 6)?;
                let section_name = self.sections.get(st_shndx as usize).map(|s| s.name.clone()).unwrap_or_default();
                out.push(Symbol {
                    name: cstring(strings, st_name as u64),
                    value: u64_at(d, offset + 8)?,
                    size: u64_at(d, offset + 16)?,
                    type_: st_info & 0xF,
                    bind: st_info >> 4,
                    shndx: st_shndx,
                    section: section_name,
                });
                offset += 24;
            }
        }
        Ok(out)
    }

    fn read_relocations(&self) -> Result<Vec<(String, Vec<Relocation>)>, String> {
        let mut table: Vec<(String, Vec<Relocation>)> = Vec::new();
        for section in &self.sections {
            if section.type_ != SHT_RELA {
                continue;
            }
            let target = self.sections.get(section.info as usize).ok_or("list index out of range")?.name.clone();
            let mut offset = 0;
            while offset < section.size {
                let d = &section.data;
                let r_offset = u64_at(d, offset)?;
                let r_info = u64_at(d, offset + 8)?;
                let r_addend = u64_at(d, offset + 16)? as i64;
                let symbol = self.symbols.get((r_info >> 32) as usize).ok_or("list index out of range")?.clone();
                let rel = Relocation {
                    section: target.clone(),
                    offset: r_offset,
                    type_: (r_info & 0xFFFF_FFFF) as u32,
                    symbol,
                    addend: r_addend,
                };
                match table.iter_mut().find(|(k, _)| *k == target) {
                    Some((_, list)) => list.push(rel),
                    None => table.push((target.clone(), vec![rel])),
                }
                offset += 24;
            }
        }
        Ok(table)
    }

    fn section(&self, name: &str) -> Result<&Section, String> {
        self.sections.iter().find(|s| s.name == name).ok_or_else(|| format!("no section named {}", name))
    }

    fn functions(&self, section: &str) -> Vec<&Symbol> {
        let mut found: Vec<&Symbol> =
            self.symbols.iter().filter(|s| s.type_ == STT_FUNC && s.section == section).collect();
        found.sort_by_key(|s| s.value);
        found
    }

    fn relocation_at(&self, section: &str, offset: i64) -> Option<&Relocation> {
        self.relocations
            .iter()
            .find(|(k, _)| k == section)
            .and_then(|(_, list)| list.iter().find(|r| r.offset as i64 == offset))
    }

    fn symbolize(&self, address: u64, section: &str) -> String {
        let mut best: Option<&Symbol> = None;
        for symbol in self.functions(section) {
            if symbol.value <= address && best.map_or(true, |b| symbol.value >= b.value) {
                best = Some(symbol);
            }
        }
        match best {
            None => format!("{}+0x{:x}", section, address),
            Some(b) if address == b.value => b.name.clone(),
            Some(b) => format!("{}+0x{:x}", b.name, address - b.value),
        }
    }

    fn function_extent(&self, name: &str, section: &str) -> Result<(u64, u64, u64), String> {
        let functions = self.functions(section);
        for (position, symbol) in functions.iter().enumerate() {
            if symbol.name == name {
                let following = match functions.get(position + 1) {
                    Some(next) => next.value,
                    None => self.section(section)?.size,
                };
                return Ok((symbol.value, symbol.value + symbol.size, following));
            }
        }
        Err(format!("no function symbol named {}", name))
    }
}

fn fixtures_dir() -> PathBuf {
    let source = Path::new(file!());
    let source = if source.is_absolute() {
        source.to_path_buf()
    } else {
        std::env::current_dir().map(|d| d.join(source)).unwrap_or_else(|_| source.to_path_buf())
    };
    source.parent().unwrap_or(Path::new(".")).join("fixtures")
}

fn load_fixture(name: &str) -> Result<ElfObject, String> {
    let path = fixtures_dir().join(name);
    ElfObject::new(&fs::read(&path).map_err(|e| format!("{}: {}", path.display(), e))?)
}

const LEGACY_PREFIXES: [u8; 11] = [0xF0, 0xF2, 0xF3, 0x2E, 0x36, 0x3E, 0x26, 0x64, 0x65, 0x66, 0x67];

fn segment_prefix(p: u8) -> Option<&'static str> {
    Some(match p {
        0x2E => "cs",
        0x36 => "ss",
        0x3E => "ds",
        0x26 => "es",
        0x64 => "fs",
        0x65 => "gs",
        _ => return None,
    })
}

const XMM: u32 = 0;
const R64: [&str; 16] =
    ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"];
const R32: [&str; 16] = [
    "eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", "r8d", "r9d", "r10d", "r11d", "r12d", "r13d", "r14d", "r15d",
];
const R16: [&str; 16] =
    ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di", "r8w", "r9w", "r10w", "r11w", "r12w", "r13w", "r14w", "r15w"];
const R8: [&str; 16] = [
    "al", "cl", "dl", "bl", "spl", "bpl", "sil", "dil", "r8b", "r9b", "r10b", "r11b", "r12b", "r13b", "r14b", "r15b",
];
const LEGACY_BYTE_REGISTERS: [&str; 8] = ["al", "cl", "dl", "bl", "ah", "ch", "dh", "bh"];
const CONDITIONS: [&str; 16] =
    ["o", "no", "b", "ae", "e", "ne", "be", "a", "s", "ns", "p", "np", "l", "ge", "le", "g"];
const GROUP1: [&str; 8] = ["add", "or", "adc", "sbb", "and", "sub", "xor", "cmp"];
const GROUP2: [&str; 8] = ["rol", "ror", "rcl", "rcr", "shl", "shr", "shl", "sar"];
const GROUP3: [&str; 8] = ["test", "test", "not", "neg", "mul", "imul", "div", "idiv"];

fn registers(size: u32) -> &'static [&'static str; 16] {
    match size {
        64 => &R64,
        32 => &R32,
        16 => &R16,
        _ => &R8,
    }
}

fn suffix(size: u32) -> &'static str {
    match size {
        8 => "b",
        16 => "w",
        32 => "l",
        _ => "q",
    }
}

fn alu_rm_r(op: u8) -> Option<&'static str> {
    Some(match op {
        0x01 => "add",
        0x09 => "or",
        0x11 => "adc",
        0x19 => "sbb",
        0x21 => "and",
        0x29 => "sub",
        0x31 => "xor",
        0x39 => "cmp",
        0x85 => "test",
        0x89 => "mov",
        _ => return None,
    })
}

fn alu_r_rm(op: u8) -> Option<&'static str> {
    Some(match op {
        0x03 => "add",
        0x0B => "or",
        0x13 => "adc",
        0x1B => "sbb",
        0x23 => "and",
        0x2B => "sub",
        0x33 => "xor",
        0x3B => "cmp",
        0x8B => "mov",
        _ => return None,
    })
}

fn alu_acc_imm(op: u8) -> Option<&'static str> {
    Some(match op {
        0x05 => "add",
        0x0D => "or",
        0x15 => "adc",
        0x1D => "sbb",
        0x25 => "and",
        0x2D => "sub",
        0x35 => "xor",
        0x3D => "cmp",
        _ => return None,
    })
}

fn sse_xmm_xmmm(mandatory: Option<u8>, op: u8) -> Option<&'static str> {
    Some(match (mandatory?, op) {
        (0x66, 0xEF) => "pxor",
        (0x66, 0xFE) => "paddd",
        (0x66, 0xFA) => "psubd",
        (0x66, 0xDB) => "pand",
        (0x66, 0xEB) => "por",
        (0x66, 0x6F) => "movdqa",
        (0xF3, 0x6F) => "movdqu",
        _ => return None,
    })
}

#[derive(Debug)]
struct DecodeError {
    address: u64,
    reason: String,
}

fn derr<T>(address: u64, reason: impl Into<String>) -> Result<T, DecodeError> {
    Err(DecodeError { address, reason: reason.into() })
}

#[derive(Clone)]
struct Memory {
    base: Option<String>,
    index: Option<String>,
    scale: u32,
    displacement: i64,
    rip_relative: bool,
    segment: Option<String>,
}

impl Memory {
    fn render(&self) -> String {
        let inner = if self.rip_relative {
            "(%rip)".to_string()
        } else if self.base.is_none() && self.index.is_none() {
            String::new()
        } else {
            let mut parts = vec![self.base.as_ref().map(|b| format!("%{}", b)).unwrap_or_default()];
            if let Some(index) = &self.index {
                parts.push(format!("%{}", index));
                if self.scale != 1 {
                    parts.push(self.scale.to_string());
                }
            }
            format!("({})", parts.join(","))
        };
        let show = self.displacement != 0 || (self.base.is_none() && !self.rip_relative);
        let text = format!("{}{}", if show { format_signed(self.displacement) } else { String::new() }, inner);
        match &self.segment {
            Some(seg) => format!("%{}:{}", seg, text),
            None => text,
        }
    }
}

#[derive(Clone)]
struct Instruction {
    address: u64,
    raw: Vec<u8>,
    mnemonic: String,
    operands: Vec<String>,
    flow: &'static str,
    target: Option<u64>,
    memory: Option<Memory>,
    displacement_offset: Option<u64>,
    immediate_offset: Option<u64>,
    prefixes: Vec<u8>,
    rex: Option<u8>,
    opcode: Vec<u8>,
    modrm: Option<u8>,
}

impl Instruction {
    fn bare(address: u64, raw: Vec<u8>, mnemonic: &str, flow: &'static str) -> Instruction {
        Instruction {
            address,
            raw,
            mnemonic: mnemonic.into(),
            operands: vec![],
            flow,
            target: None,
            memory: None,
            displacement_offset: None,
            immediate_offset: None,
            prefixes: vec![],
            rex: None,
            opcode: vec![],
            modrm: None,
        }
    }

    fn length(&self) -> u64 {
        self.raw.len() as u64
    }

    fn end(&self) -> u64 {
        self.address + self.length()
    }

    fn text(&self) -> String {
        if self.operands.is_empty() {
            self.mnemonic.clone()
        } else {
            format!("{}\t{}", self.mnemonic, self.operands.join(", "))
        }
    }

    fn hex(&self) -> String {
        hex_spaced(&self.raw)
    }

    fn covers(&self, address: u64) -> bool {
        self.address <= address && address < self.end()
    }
}

fn format_signed(value: i64) -> String {
    if value < 0 {
        format!("-0x{:x}", value.unsigned_abs())
    } else {
        format!("0x{:x}", value)
    }
}

fn format_immediate(value: i64) -> String {
    format!("${}", format_signed(value))
}

struct Cursor<'a> {
    code: &'a [u8],
    start: u64,
    position: u64,
}

impl Cursor<'_> {
    fn byte(&mut self) -> Result<u8, DecodeError> {
        if self.position >= self.code.len() as u64 {
            return derr(self.start, "instruction runs past the end of the section");
        }
        if (self.position - self.start) as usize >= MAX_INSTRUCTION_LENGTH {
            return derr(self.start, "instruction longer than 15 bytes");
        }
        let value = self.code[self.position as usize];
        self.position += 1;
        Ok(value)
    }

    fn peek(&self) -> Option<u8> {
        self.code.get(self.position as usize).copied()
    }

    fn integer(&mut self, size: usize, signed: bool) -> Result<i64, DecodeError> {
        let mut value: u64 = 0;
        for i in 0..size {
            value |= (self.byte()? as u64) << (8 * i);
        }
        if signed && size < 8 && value & (1 << (8 * size - 1)) != 0 {
            value |= u64::MAX << (8 * size);
        }
        Ok(value as i64)
    }
}

struct State<'a> {
    cursor: Cursor<'a>,
    prefixes: Vec<u8>,
    rex: Option<u8>,
    memory: Option<Memory>,
    modrm_byte: Option<u8>,
    displacement_offset: Option<u64>,
    immediate_offset: Option<u64>,
    opcode_start: u64,
    mandatory_consumed: bool,
}

fn full_immediate_size(operand_size: u32) -> usize {
    if operand_size == 16 {
        2
    } else {
        4
    }
}

impl State<'_> {
    fn rex_bit(&self, bit: u8) -> bool {
        self.rex.map_or(false, |r| r & bit != 0)
    }

    fn rex_w(&self) -> bool {
        self.rex_bit(0x8)
    }

    fn rex_r(&self) -> usize {
        if self.rex_bit(0x4) {
            8
        } else {
            0
        }
    }

    fn rex_x(&self) -> usize {
        if self.rex_bit(0x2) {
            8
        } else {
            0
        }
    }

    fn rex_b(&self) -> usize {
        if self.rex_bit(0x1) {
            8
        } else {
            0
        }
    }

    fn operand_size(&self) -> u32 {
        if self.rex_w() {
            64
        } else if self.prefixes.contains(&0x66) && !self.mandatory_consumed {
            16
        } else {
            32
        }
    }

    fn mandatory_prefix(&self) -> Option<u8> {
        for candidate in [0xF2, 0xF3] {
            if self.prefixes.contains(&candidate) {
                return Some(candidate);
            }
        }
        if self.prefixes.contains(&0x66) {
            Some(0x66)
        } else {
            None
        }
    }

    fn segment(&self) -> Option<String> {
        self.prefixes.iter().find_map(|&p| segment_prefix(p)).map(String::from)
    }

    fn read_immediate(&mut self, size: usize, signed: bool) -> Result<i64, DecodeError> {
        self.immediate_offset = Some(self.cursor.position - self.cursor.start);
        self.cursor.integer(size, signed)
    }

    fn read_displacement(&mut self, size: usize) -> Result<i64, DecodeError> {
        self.displacement_offset = Some(self.cursor.position - self.cursor.start);
        self.cursor.integer(size, true)
    }

    fn register_name(&self, size: u32, number: usize) -> String {
        if size == XMM {
            return format!("%xmm{}", number);
        }
        if size == 8 && self.rex.is_none() && number < 8 {
            return format!("%{}", LEGACY_BYTE_REGISTERS[number]);
        }
        format!("%{}", registers(size)[number])
    }

    fn modrm(&mut self, reg_size: u32, rm_size: u32) -> Result<(String, String), DecodeError> {
        let modrm = self.cursor.byte()?;
        self.modrm_byte = Some(modrm);
        let (md, reg, rm) = (modrm >> 6, ((modrm >> 3) & 7) as usize, (modrm & 7) as usize);
        let reg_text = self.register_name(reg_size, reg | self.rex_r());
        if md == 3 {
            return Ok((reg_text, self.register_name(rm_size, rm | self.rex_b())));
        }
        let mut base = None;
        let mut index = None;
        let mut scale = 1;
        let mut rip_relative = false;
        let mut displacement = 0;
        if rm == 4 {
            let sib = self.cursor.byte()?;
            scale = 1 << (sib >> 6);
            let index_number = (((sib >> 3) & 7) as usize) | self.rex_x();
            let base_number = ((sib & 7) as usize) | self.rex_b();
            if index_number != 4 {
                index = Some(R64[index_number].to_string());
            }
            if sib & 7 == 5 && md == 0 {
                displacement = self.read_displacement(4)?;
            } else {
                base = Some(R64[base_number].to_string());
            }
        } else if rm == 5 && md == 0 {
            rip_relative = true;
            displacement = self.read_displacement(4)?;
        } else {
            base = Some(R64[rm | self.rex_b()].to_string());
        }
        if md == 1 {
            displacement = self.read_displacement(1)?;
        } else if md == 2 {
            displacement = self.read_displacement(4)?;
        }
        let memory = Memory { base, index, scale, displacement, rip_relative, segment: self.segment() };
        let text = memory.render();
        self.memory = Some(memory);
        Ok((reg_text, text))
    }

    fn modrm_group(&mut self, rm_size: u32, reuse: bool) -> Result<(usize, String), DecodeError> {
        if !reuse || self.modrm_byte.is_none() {
            self.modrm(rm_size, rm_size)?;
        }
        let byte = self.modrm_byte.unwrap();
        let digit = ((byte >> 3) & 7) as usize;
        if byte >> 6 == 3 {
            return Ok((digit, self.register_name(rm_size, ((byte & 7) as usize) | self.rex_b())));
        }
        Ok((digit, self.memory.as_ref().unwrap().render()))
    }

    fn branch(&mut self, mnemonic: &str, size: usize, flow: &'static str) -> Result<Instruction, DecodeError> {
        let offset = self.read_immediate(size, true)?;
        let target = self.cursor.position.wrapping_add(offset as u64);
        Ok(self.finish_with(mnemonic, vec![format!("0x{:x}", target)], flow, Some(target)))
    }

    fn finish(&self, mnemonic: impl Into<String>, operands: Vec<String>) -> Result<Instruction, DecodeError> {
        Ok(self.finish_with(&mnemonic.into(), operands, "next", None))
    }

    fn finish_with(&self, mnemonic: &str, operands: Vec<String>, flow: &'static str, target: Option<u64>) -> Instruction {
        let raw = self.cursor.code[self.cursor.start as usize..self.cursor.position as usize].to_vec();
        let first = (self.opcode_start - self.cursor.start) as usize;
        let width = if raw[first] == 0x0F { 2 } else { 1 };
        let opcode = raw[first..(first + width).min(raw.len())].to_vec();
        Instruction {
            address: self.cursor.start,
            raw,
            mnemonic: mnemonic.to_string(),
            operands,
            flow,
            target,
            memory: self.memory.clone(),
            displacement_offset: self.displacement_offset,
            immediate_offset: self.immediate_offset,
            prefixes: self.prefixes.clone(),
            rex: self.rex,
            opcode,
            modrm: self.modrm_byte,
        }
    }
}

fn reg64(state: &State, opcode: u8) -> String {
    format!("%{}", R64[((opcode & 7) as usize) | state.rex_b()])
}

fn decode(code: &[u8], address: u64) -> Result<Instruction, DecodeError> {
    if address >= code.len() as u64 {
        return derr(address, "address is past the end of the section");
    }
    let mut cursor = Cursor { code, start: address, position: address };
    let mut prefixes = Vec::new();
    while cursor.peek().map_or(false, |b| LEGACY_PREFIXES.contains(&b)) {
        prefixes.push(cursor.byte()?);
    }
    let mut rex = None;
    if let Some(b) = cursor.peek() {
        if (0x40..=0x4F).contains(&b) {
            rex = Some(cursor.byte()?);
        }
    }
    let opcode_start = cursor.position;
    let mut state = State {
        cursor,
        prefixes,
        rex,
        memory: None,
        modrm_byte: None,
        displacement_offset: None,
        immediate_offset: None,
        opcode_start,
        mandatory_consumed: false,
    };
    let opcode = state.cursor.byte()?;
    if opcode == 0x0F {
        let second = state.cursor.byte()?;
        return two_byte(&mut state, second);
    }
    one_byte(&mut state, opcode)
}

fn one_byte(state: &mut State, opcode: u8) -> Result<Instruction, DecodeError> {
    let size = state.operand_size();
    let start = state.cursor.start;
    let sfx = suffix(size);
    if let Some(m) = alu_rm_r(opcode) {
        let (reg, rm) = state.modrm(size, size)?;
        return state.finish(format!("{}{}", m, sfx), vec![reg, rm]);
    }
    if let Some(m) = alu_r_rm(opcode) {
        let (reg, rm) = state.modrm(size, size)?;
        return state.finish(format!("{}{}", m, sfx), vec![rm, reg]);
    }
    if let Some(m) = alu_acc_imm(opcode) {
        let imm = state.read_immediate(full_immediate_size(size), true)?;
        return state.finish(format!("{}{}", m, sfx), vec![format_immediate(imm), format!("%{}", registers(size)[0])]);
    }
    match opcode {
        0x50..=0x57 => return state.finish("pushq", vec![reg64(state, opcode)]),
        0x58..=0x5F => return state.finish("popq", vec![reg64(state, opcode)]),
        0x63 => {
            if size != 64 {
                return derr(start, "opcode 63 without REX.W is not in the subset");
            }
            let (reg, rm) = state.modrm(64, 32)?;
            return state.finish("movslq", vec![rm, reg]);
        }
        0x69 | 0x6B => {
            let (reg, rm) = state.modrm(size, size)?;
            let n = if opcode == 0x6B { 1 } else { full_immediate_size(size) };
            let imm = state.read_immediate(n, true)?;
            return state.finish(format!("imul{}", sfx), vec![format_immediate(imm), rm, reg]);
        }
        0x70..=0x7F => return state.branch(&format!("j{}", CONDITIONS[(opcode & 0xF) as usize]), 1, "branch"),
        0x81 | 0x83 => {
            let (digit, rm) = state.modrm_group(size, false)?;
            let n = if opcode == 0x83 { 1 } else { full_immediate_size(size) };
            let imm = state.read_immediate(n, true)?;
            return state.finish(format!("{}{}", GROUP1[digit], sfx), vec![format_immediate(imm), rm]);
        }
        0x8D => {
            let (reg, rm) = state.modrm(size, size)?;
            if state.memory.is_none() {
                return derr(start, "lea needs a memory operand");
            }
            return state.finish(format!("lea{}", sfx), vec![rm, reg]);
        }
        0x90 => return state.finish("nop", vec![]),
        0x99 => {
            let m = match size {
                16 => "cwtd",
                32 => "cltd",
                _ => "cqto",
            };
            return state.finish(m, vec![]);
        }
        0xB8..=0xBF => {
            let register = format!("%{}", registers(size)[((opcode & 7) as usize) | state.rex_b()]);
            if size == 64 {
                let imm = state.read_immediate(8, true)?;
                return state.finish("movabsq", vec![format_immediate(imm), register]);
            }
            let imm = state.read_immediate(full_immediate_size(size), true)?;
            return state.finish(format!("mov{}", sfx), vec![format_immediate(imm), register]);
        }
        0xC1 => {
            let (digit, rm) = state.modrm_group(size, false)?;
            let imm = state.read_immediate(1, false)?;
            return state.finish(format!("{}{}", GROUP2[digit], sfx), vec![format_immediate(imm), rm]);
        }
        0xC3 => return Ok(state.finish_with("retq", vec![], "return", None)),
        0xC7 => {
            let (digit, rm) = state.modrm_group(size, false)?;
            if digit != 0 {
                return derr(start, format!("opcode C7 /{} is not mov", digit));
            }
            let imm = state.read_immediate(full_immediate_size(size), true)?;
            return state.finish(format!("mov{}", sfx), vec![format_immediate(imm), rm]);
        }
        0xCC => return state.finish("int3", vec![]),
        0xE8 => return state.branch("callq", 4, "call"),
        0xE9 => return state.branch("jmp", 4, "jump"),
        0xEB => return state.branch("jmp", 1, "jump"),
        0xF4 => return state.finish("hlt", vec![]),
        0xF7 => {
            let (digit, rm) = state.modrm_group(size, false)?;
            if digit <= 1 {
                let imm = state.read_immediate(full_immediate_size(size), true)?;
                return state.finish(format!("test{}", sfx), vec![format_immediate(imm), rm]);
            }
            return state.finish(format!("{}{}", GROUP3[digit], sfx), vec![rm]);
        }
        0xFF => {
            let (digit, rm) = state.modrm_group(size, false)?;
            match digit {
                0 => return state.finish(format!("inc{}", sfx), vec![rm]),
                1 => return state.finish(format!("dec{}", sfx), vec![rm]),
                2 | 4 | 6 => {
                    let (_, rm64) = state.modrm_group(64, true)?;
                    return match digit {
                        6 => state.finish("pushq", vec![rm64]),
                        2 => Ok(state.finish_with("callq", vec![format!("*{}", rm64)], "indirect-call", None)),
                        _ => Ok(state.finish_with("jmpq", vec![format!("*{}", rm64)], "indirect-jump", None)),
                    };
                }
                _ => return derr(start, format!("opcode FF /{} is not in the subset", digit)),
            }
        }
        _ => {}
    }
    derr(start, format!("opcode {:02x} is not in the subset", opcode))
}

fn two_byte(state: &mut State, opcode: u8) -> Result<Instruction, DecodeError> {
    let mandatory = state.mandatory_prefix();
    if let Some(m) = sse_xmm_xmmm(mandatory, opcode) {
        state.mandatory_consumed = true;
        let (reg, rm) = state.modrm(XMM, XMM)?;
        return state.finish(m, vec![rm, reg]);
    }
    if mandatory == Some(0x66) && opcode == 0x70 {
        state.mandatory_consumed = true;
        let (reg, rm) = state.modrm(XMM, XMM)?;
        let imm = state.read_immediate(1, false)?;
        return state.finish("pshufd", vec![format_immediate(imm), rm, reg]);
    }
    if mandatory == Some(0x66) && (opcode == 0x6E || opcode == 0x7E) {
        state.mandatory_consumed = true;
        let w = state.rex_w();
        let (reg, rm) = state.modrm(XMM, if w { 64 } else { 32 })?;
        let operands = if opcode == 0x7E { vec![reg, rm] } else { vec![rm, reg] };
        return state.finish(if w { "movq" } else { "movd" }, operands);
    }
    let size = state.operand_size();
    let sfx = suffix(size);
    let cond = CONDITIONS[(opcode & 0xF) as usize];
    match opcode {
        0x0B => return state.finish("ud2", vec![]),
        0x1F => {
            let (_, rm) = state.modrm_group(size, false)?;
            return state.finish(format!("nop{}", sfx), vec![rm]);
        }
        0x80..=0x8F => return state.branch(&format!("j{}", cond), 4, "branch"),
        0x90..=0x9F => {
            let (_, rm) = state.modrm_group(8, false)?;
            return state.finish(format!("set{}", cond), vec![rm]);
        }
        0x40..=0x4F => {
            let (reg, rm) = state.modrm(size, size)?;
            return state.finish(format!("cmov{}{}", cond, sfx), vec![rm, reg]);
        }
        0xAF => {
            let (reg, rm) = state.modrm(size, size)?;
            return state.finish(format!("imul{}", sfx), vec![rm, reg]);
        }
        0xB6 | 0xB7 | 0xBE | 0xBF => {
            let source = if opcode == 0xB6 || opcode == 0xBE { 8 } else { 16 };
            let (reg, rm) = state.modrm(size, source)?;
            let kind = if opcode == 0xB6 || opcode == 0xB7 { "movz" } else { "movs" };
            return state.finish(format!("{}{}{}", kind, suffix(source), sfx), vec![rm, reg]);
        }
        _ => {}
    }
    derr(state.cursor.start, format!("opcode 0f {:02x} is not in the subset", opcode))
}

fn listing_line(instruction: &Instruction, elf: Option<&ElfObject>) -> String {
    let mut text = instruction.text();
    if let (Some(target), Some(elf)) = (instruction.target, elf) {
        text += &format!(" <{}>", elf.symbolize(target, ".text"));
    }
    format!("{:8x}: {:<30}\t{}", instruction.address, instruction.hex(), text)
}

struct Reference {
    instruction: u64,
    relocation: Relocation,
    section: String,
    offset: i64,
    field: &'static str,
}

impl Reference {
    fn describe(&self) -> String {
        format!("{}+{}", self.section, format_signed(self.offset).replace("-0x", "0x-"))
    }
}

fn symbol_base(symbol: &Symbol) -> i64 {
    if symbol.type_ == STT_SECTION {
        0
    } else {
        symbol.value as i64
    }
}

fn resolve_reference(elf: &ElfObject, instruction: &Instruction, section: &str) -> Option<Reference> {
    for (field, field_offset) in
        [("displacement", instruction.displacement_offset), ("immediate", instruction.immediate_offset)]
    {
        let Some(field_offset) = field_offset else { continue };
        let Some(relocation) = elf.relocation_at(section, (instruction.address + field_offset) as i64) else {
            continue;
        };
        let base = symbol_base(&relocation.symbol);
        let offset = if pc_relative(relocation.type_) {
            base + relocation.addend + (instruction.end() as i64 - (instruction.address + field_offset) as i64)
        } else {
            base + relocation.addend
        };
        return Some(Reference {
            instruction: instruction.address,
            relocation: relocation.clone(),
            section: relocation.symbol.section.clone(),
            offset,
            field,
        });
    }
    None
}

struct SweepResult {
    instructions: Vec<Instruction>,
    undecodable: Vec<(u64, u8)>,
}

impl SweepResult {
    fn at(&self, address: u64) -> Option<&Instruction> {
        self.instructions.iter().find(|i| i.address == address)
    }

    fn covering(&self, address: u64) -> Option<&Instruction> {
        self.instructions.iter().find(|i| i.covers(address))
    }
}

fn linear_sweep(code: &[u8], start: u64, end: Option<u64>) -> SweepResult {
    let end = end.unwrap_or(code.len() as u64);
    let window = &code[..(end as usize).min(code.len())];
    let mut instructions = Vec::new();
    let mut undecodable = Vec::new();
    let mut position = start;
    while position < end {
        match decode(window, position) {
            Ok(instruction) => {
                position = instruction.end();
                instructions.push(instruction);
            }
            Err(_) => {
                undecodable.push((position, code[position as usize]));
                position += 1;
            }
        }
    }
    SweepResult { instructions, undecodable }
}

#[derive(Clone)]
struct JumpTable {
    section: String,
    offset: i64,
    entry_size: u32,
    count: i64,
    targets: Vec<i64>,
    evidence: &'static str,
    bounds_instruction: Option<u64>,
    lea_instruction: u64,
    load_instruction: u64,
    jump_instruction: Option<u64>,
}

impl JumpTable {
    fn is_jump_table(&self) -> bool {
        self.jump_instruction.is_some()
    }

    fn to_json(&self) -> J {
        let entries = if self.is_jump_table() {
            self.targets.iter().map(|&v| s(format_signed(v).replace("-0x", "0x-"))).collect()
        } else {
            self.targets.iter().map(|&v| J::Int(v)).collect()
        };
        J::obj()
            .with("kind", s(if self.is_jump_table() { "jump-table" } else { "value-table" }))
            .with("table", s(format!("{}+{}", self.section, format_signed(self.offset).replace("-0x", "0x-"))))
            .with("entrySize", J::Int(self.entry_size as i64))
            .with("count", J::Int(self.count))
            .with("entries", J::Arr(entries))
            .with("evidence", s(self.evidence))
            .with("boundsCheck", self.bounds_instruction.map_or(J::Null, |a| s(hx(a))))
            .with("lea", s(hx(self.lea_instruction)))
            .with("load", s(hx(self.load_instruction)))
            .with("jump", self.jump_instruction.map_or(J::Null, |a| s(hx(a))))
    }
}

struct DescentResult {
    instructions: HashMap<u64, Instruction>,
    order: Vec<u64>,
    unresolved: Vec<Instruction>,
    conflicts: Vec<(u64, u64)>,
    calls: Vec<(u64, Option<u64>)>,
    resolved_tables: Vec<(u64, JumpTable)>,
}

impl DescentResult {
    fn sorted_instructions(&self) -> Vec<Instruction> {
        let keys: BTreeSet<u64> = self.instructions.keys().copied().collect();
        keys.iter().map(|k| self.instructions[k].clone()).collect()
    }

    fn claimed_bytes(&self) -> HashSet<u64> {
        let mut claimed = HashSet::new();
        for i in self.instructions.values() {
            claimed.extend(i.address..i.end());
        }
        claimed
    }
}

type Resolver<'a> = dyn Fn(&Instruction, &HashMap<u64, Instruction>) -> Option<JumpTable> + 'a;

fn recursive_descent(code: &[u8], entries: &[u64], end: Option<u64>, resolver: Option<&Resolver>) -> DescentResult {
    let end = end.unwrap_or(code.len() as u64);
    let window = &code[..(end as usize).min(code.len())];
    let mut instructions: HashMap<u64, Instruction> = HashMap::new();
    let mut order: Vec<u64> = Vec::new();
    let mut unresolved = Vec::new();
    let mut conflicts = Vec::new();
    let mut calls = Vec::new();
    let mut tables: Vec<(u64, JumpTable)> = Vec::new();
    let mut worklist: Vec<u64> = entries.iter().rev().copied().collect();
    while let Some(mut address) = worklist.pop() {
        while address < end && !instructions.contains_key(&address) {
            if let Some(inside) = order.iter().map(|a| &instructions[a]).find(|i| i.covers(address)) {
                conflicts.push((address, inside.address));
                break;
            }
            let instruction = match decode(window, address) {
                Ok(i) => i,
                Err(_) => {
                    let a = address as usize;
                    unresolved.push(Instruction::bare(address, code.get(a..a + 1).unwrap_or(&[]).to_vec(), "(undecodable)", "stop"));
                    break;
                }
            };
            instructions.insert(address, instruction.clone());
            order.push(address);
            match instruction.flow {
                "return" => break,
                "jump" => {
                    address = instruction.target.unwrap_or(end);
                    continue;
                }
                "branch" => {
                    worklist.push(instruction.target.unwrap_or(end));
                    address = instruction.end();
                    continue;
                }
                "call" => {
                    calls.push((instruction.address, instruction.target));
                    address = instruction.end();
                    continue;
                }
                "indirect-jump" => {
                    let table = resolver.and_then(|r| r(&instruction, &instructions));
                    match table {
                        None => unresolved.push(instruction.clone()),
                        Some(table) => {
                            let targets: BTreeSet<i64> = table.targets.iter().copied().collect();
                            worklist.extend(targets.iter().rev().map(|&t| t as u64));
                            tables.push((instruction.address, table));
                        }
                    }
                    break;
                }
                "indirect-call" => calls.push((instruction.address, None)),
                _ => {}
            }
            address = instruction.end();
        }
    }
    DescentResult { instructions, order, unresolved, conflicts, calls, resolved_tables: tables }
}

fn register_of(operand: &str) -> Option<&str> {
    operand.strip_prefix('%')
}

fn parse_hex_signed(text: &str) -> Option<i64> {
    let (neg, rest) = match text.strip_prefix('-') {
        Some(r) => (true, r),
        None => (false, text.strip_prefix('+').unwrap_or(text)),
    };
    let rest = rest.strip_prefix("0x").or_else(|| rest.strip_prefix("0X")).unwrap_or(rest);
    let v = i64::from_str_radix(rest, 16).ok()?;
    Some(if neg { -v } else { v })
}

fn bounds_count(instructions: &[Instruction], before: u64) -> (Option<i64>, Option<u64>) {
    let earlier: Vec<&Instruction> = instructions.iter().filter(|i| i.address < before).collect();
    for position in (1..earlier.len()).rev() {
        let prev = earlier[position - 1];
        if earlier[position].mnemonic == "ja" && ["cmpl", "subl", "cmpq", "subq"].contains(&prev.mnemonic.as_str()) {
            if let Some(imm) = prev.operands[0].strip_prefix('$') {
                return (parse_hex_signed(imm), Some(prev.address));
            }
        }
    }
    (None, None)
}

fn recover_table(
    elf: &ElfObject,
    instructions: &[Instruction],
    load: &Instruction,
    jump: Option<&Instruction>,
    section: &str,
) -> Option<JumpTable> {
    let memory = load.memory.as_ref()?;
    let base = memory.base.as_deref()?;
    memory.index.as_ref()?;
    let mut lea = None;
    for candidate in instructions.iter().filter(|i| i.address < load.address).rev() {
        let rip = candidate.memory.as_ref().map_or(false, |m| m.rip_relative);
        if candidate.mnemonic == "leaq" && rip && candidate.operands.get(1).and_then(|o| register_of(o)) == Some(base) {
            lea = Some(candidate);
            break;
        }
        if candidate.operands.last().and_then(|o| register_of(o)) == Some(base) {
            return None;
        }
    }
    let lea = lea?;
    let reference = resolve_reference(elf, lea, section)?;
    let (limit, bounds_address) = bounds_count(instructions, load.address);
    let count = limit.map_or(0, |l| l + 1);
    let entry_size = memory.scale as i64;
    let table_section = elf.section(&reference.section).ok()?;
    let mut entries = Vec::new();
    let mut evidence = "bytes";
    for index in 0..count.max(0) {
        let entry_offset = reference.offset + index * entry_size;
        match elf.relocation_at(&reference.section, entry_offset) {
            Some(relocation) if pc_relative(relocation.type_) => {
                entries.push(symbol_base(&relocation.symbol) + relocation.addend + (reference.offset - entry_offset));
                evidence = "relocation";
            }
            _ => {
                if entry_offset < 0 {
                    return None;
                }
                let raw = slice_clamped(&table_section.data, entry_offset as u64, entry_size as u64);
                if (raw.len() as i64) < entry_size {
                    return None;
                }
                let mut value: u64 = 0;
                for (i, b) in raw.iter().enumerate() {
                    value |= (*b as u64) << (8 * i);
                }
                let n = raw.len();
                let signed_value = if jump.is_some() && n < 8 && value & (1 << (8 * n - 1)) != 0 {
                    (value | (u64::MAX << (8 * n))) as i64
                } else {
                    value as i64
                };
                entries.push(if jump.is_some() { reference.offset + signed_value } else { signed_value });
            }
        }
    }
    Some(JumpTable {
        section: reference.section.clone(),
        offset: reference.offset,
        entry_size: memory.scale,
        count,
        targets: entries,
        evidence,
        bounds_instruction: bounds_address,
        lea_instruction: lea.address,
        load_instruction: load.address,
        jump_instruction: jump.map(|j| j.address),
    })
}

fn jump_table_resolver<'a>(elf: &'a ElfObject, section: &'a str) -> Box<Resolver<'a>> {
    Box::new(move |jump: &Instruction, decoded: &HashMap<u64, Instruction>| {
        let first = jump.operands.first()?;
        let register = register_of(first.strip_prefix('*')?)?;
        let keys: BTreeSet<u64> = decoded.keys().copied().filter(|&a| a < jump.address).collect();
        let instructions: Vec<Instruction> = keys.iter().map(|k| decoded[k].clone()).collect();
        let add = instructions
            .iter()
            .rev()
            .find(|i| i.mnemonic == "addq" && i.operands.get(1).and_then(|o| register_of(o)) == Some(register))?;
        let base = register_of(&add.operands[0]);
        let load = instructions.iter().rev().find(|i| {
            i.address < add.address
                && i.mnemonic == "movslq"
                && i.operands.get(1).and_then(|o| register_of(o)) == Some(register)
                && i.memory.as_ref().map_or(false, |m| m.base.as_deref() == base)
        })?;
        recover_table(elf, &instructions, load, Some(jump), section)
    })
}

fn find_value_tables(elf: &ElfObject, instructions: &[Instruction], section: &str) -> Vec<JumpTable> {
    let mut tables = Vec::new();
    for instruction in instructions {
        if !["movl", "movq", "movslq", "movzbl"].contains(&instruction.mnemonic.as_str()) {
            continue;
        }
        let Some(memory) = &instruction.memory else { continue };
        if memory.base.is_none() || memory.index.is_none() {
            continue;
        }
        let following: Vec<&Instruction> =
            instructions.iter().filter(|i| i.address > instruction.address).take(3).collect();
        if following.iter().any(|i| i.flow == "indirect-jump") {
            continue;
        }
        if let Some(table) = recover_table(elf, instructions, instruction, None, section) {
            tables.push(table);
        }
    }
    tables
}

struct Block {
    start: u64,
    instructions: Vec<Instruction>,
    successors: Vec<(u64, &'static str)>,
}

impl Block {
    fn end(&self) -> u64 {
        self.instructions.last().unwrap().end()
    }

    fn last(&self) -> &Instruction {
        self.instructions.last().unwrap()
    }

    fn size(&self) -> u64 {
        self.end() - self.start
    }
}

struct ControlFlowGraph {
    entry: u64,
    tables: HashMap<u64, JumpTable>,
    instructions: Vec<Instruction>,
    blocks: BTreeMap<u64, Block>,
    unresolved: Vec<u64>,
    edges: Vec<(u64, u64, &'static str)>,
    idom: OnceCell<HashMap<u64, u64>>,
}

impl ControlFlowGraph {
    fn new(entry: u64, instructions: Vec<Instruction>, tables: &[(u64, JumpTable)], limit: Option<u64>) -> Self {
        let mut ordered = instructions;
        ordered.sort_by_key(|i| i.address);
        if let Some(limit) = limit {
            ordered.retain(|i| i.address < limit);
        }
        let mut cfg = ControlFlowGraph {
            entry,
            tables: tables.iter().cloned().collect(),
            instructions: ordered,
            blocks: BTreeMap::new(),
            unresolved: vec![],
            edges: vec![],
            idom: OnceCell::new(),
        };
        cfg.build();
        cfg.edges = cfg
            .blocks
            .values()
            .flat_map(|b| b.successors.iter().map(move |&(t, k)| (b.start, t, k)))
            .collect();
        cfg
    }

    fn leaders(&self) -> HashSet<u64> {
        let mut leaders = HashSet::from([self.entry]);
        let addresses: HashSet<u64> = self.instructions.iter().map(|i| i.address).collect();
        for (position, instruction) in self.instructions.iter().enumerate() {
            if ["jump", "branch", "return", "indirect-jump"].contains(&instruction.flow) {
                if let Some(next) = self.instructions.get(position + 1) {
                    leaders.insert(next.address);
                }
            }
            if ["jump", "branch"].contains(&instruction.flow) {
                if let Some(t) = instruction.target {
                    if addresses.contains(&t) {
                        leaders.insert(t);
                    }
                }
            }
            if let Some(table) = self.tables.get(&instruction.address) {
                leaders.extend(table.targets.iter().map(|&t| t as u64).filter(|t| addresses.contains(t)));
            }
        }
        leaders
    }

    fn build(&mut self) {
        let leaders = self.leaders();
        let mut current: Option<u64> = None;
        for instruction in &self.instructions {
            let start_new = match current {
                None => true,
                Some(c) => leaders.contains(&instruction.address) || self.blocks[&c].end() != instruction.address,
            };
            if start_new {
                self.blocks.insert(
                    instruction.address,
                    Block { start: instruction.address, instructions: vec![], successors: vec![] },
                );
                current = Some(instruction.address);
            }
            self.blocks.get_mut(&current.unwrap()).unwrap().instructions.push(instruction.clone());
        }
        let starts: Vec<u64> = self.blocks.keys().copied().collect();
        for (position, &start) in starts.iter().enumerate() {
            let block = &self.blocks[&start];
            let last = block.last().clone();
            let following = starts.get(position + 1).copied();
            let falls_through = following == Some(block.end());
            let mut successors = Vec::new();
            match last.flow {
                "return" => {}
                "jump" => {
                    if let Some(t) = last.target.filter(|t| self.blocks.contains_key(t)) {
                        successors.push((t, "jump"));
                    }
                }
                "branch" => {
                    if let Some(t) = last.target.filter(|t| self.blocks.contains_key(t)) {
                        successors.push((t, "taken"));
                    }
                    if falls_through {
                        successors.push((following.unwrap(), "fallthrough"));
                    }
                }
                "indirect-jump" => match self.tables.get(&last.address) {
                    None => self.unresolved.push(last.address),
                    Some(table) => {
                        let targets: BTreeSet<i64> = table.targets.iter().copied().collect();
                        for t in targets {
                            if self.blocks.contains_key(&(t as u64)) {
                                successors.push((t as u64, "table"));
                            }
                        }
                    }
                },
                _ => {
                    if falls_through {
                        successors.push((following.unwrap(), "fallthrough"));
                    }
                }
            }
            self.blocks.get_mut(&start).unwrap().successors = successors;
        }
    }

    fn predecessors(&self, start: u64) -> Vec<u64> {
        self.edges.iter().filter(|e| e.1 == start).map(|e| e.0).collect()
    }

    fn reverse_postorder(&self) -> Vec<u64> {
        fn visit(cfg: &ControlFlowGraph, start: u64, seen: &mut HashSet<u64>, post: &mut Vec<u64>) {
            seen.insert(start);
            for &(target, _) in &cfg.blocks[&start].successors {
                if !seen.contains(&target) {
                    visit(cfg, target, seen, post);
                }
            }
            post.push(start);
        }
        let mut seen = HashSet::new();
        let mut post = Vec::new();
        if self.blocks.contains_key(&self.entry) {
            visit(self, self.entry, &mut seen, &mut post);
        }
        post.reverse();
        post
    }

    fn reachable(&self) -> HashSet<u64> {
        self.reverse_postorder().into_iter().collect()
    }

    fn unreachable(&self) -> Vec<u64> {
        let reachable = self.reachable();
        self.blocks.keys().copied().filter(|s| !reachable.contains(s)).collect()
    }

    fn dominators(&self) -> &HashMap<u64, u64> {
        self.idom.get_or_init(|| {
            let order = self.reverse_postorder();
            let number: HashMap<u64, usize> = order.iter().enumerate().map(|(p, &s)| (s, p)).collect();
            let mut idom: HashMap<u64, u64> = HashMap::from([(self.entry, self.entry)]);
            let intersect = |idom: &HashMap<u64, u64>, mut first: u64, mut second: u64| {
                while first != second {
                    while number[&first] > number[&second] {
                        first = idom[&first];
                    }
                    while number[&second] > number[&first] {
                        second = idom[&second];
                    }
                }
                first
            };
            let mut changed = true;
            while changed {
                changed = false;
                for &start in order.iter().skip(1) {
                    let processed: Vec<u64> =
                        self.predecessors(start).into_iter().filter(|p| idom.contains_key(p)).collect();
                    let mut candidate = processed[0];
                    for &other in &processed[1..] {
                        candidate = intersect(&idom, other, candidate);
                    }
                    if idom.get(&start) != Some(&candidate) {
                        idom.insert(start, candidate);
                        changed = true;
                    }
                }
            }
            idom
        })
    }

    fn dominates(&self, dominator: u64, mut start: u64) -> bool {
        let idom = self.dominators();
        loop {
            if start == dominator {
                return true;
            }
            match idom.get(&start) {
                None => return false,
                Some(&parent) if parent == start => return false,
                Some(&parent) => start = parent,
            }
        }
    }

    fn back_edges(&self) -> Vec<(u64, u64)> {
        let reachable = self.reachable();
        self.edges
            .iter()
            .filter(|(s, t, _)| reachable.contains(s) && reachable.contains(t) && self.dominates(*t, *s))
            .map(|(s, t, _)| (*s, *t))
            .collect()
    }

    fn summary(&self) -> J {
        let idom: BTreeMap<u64, u64> = self.dominators().iter().map(|(&k, &v)| (k, v)).collect();
        J::obj()
            .with("blocks", J::Int(self.blocks.len() as i64))
            .with("edges", J::Int(self.edges.len() as i64))
            .with("unreachableBlocks", J::Arr(self.unreachable().into_iter().map(|a| s(hx(a))).collect()))
            .with("unresolvedIndirectJumps", J::Arr(self.unresolved.iter().map(|&a| s(hx(a))).collect()))
            .with(
                "backEdges",
                J::Arr(self.back_edges().into_iter().map(|(a, b)| s(format!("0x{:x}->0x{:x}", a, b))).collect()),
            )
            .with("immediateDominators", J::Obj(idom.into_iter().map(|(k, v)| (hx(k), s(hx(v)))).collect()))
    }
}

struct FunctionAnalysis {
    name: String,
    start: u64,
    end: u64,
    gap_end: u64,
    sweep: SweepResult,
    descent: DescentResult,
    descent_plain: DescentResult,
    cfg: ControlFlowGraph,
    cfg_plain: ControlFlowGraph,
    cfg_sweep: ControlFlowGraph,
    value_tables: Vec<JumpTable>,
}

impl FunctionAnalysis {
    fn to_json(&self) -> J {
        let tables: Vec<J> = self
            .descent
            .resolved_tables
            .iter()
            .map(|(_, t)| t.to_json())
            .chain(self.value_tables.iter().map(|t| t.to_json()))
            .collect();
        J::obj()
            .with("range", s(format!("0x{:x}-0x{:x}", self.start, self.end)))
            .with("paddingBytes", J::Int(self.gap_end as i64 - self.end as i64))
            .with(
                "linearSweep",
                J::obj().with("instructions", J::Int(self.sweep.instructions.len() as i64)).extend(self.cfg_sweep.summary()),
            )
            .with(
                "recursiveDescent",
                J::obj()
                    .with("instructions", J::Int(self.descent_plain.instructions.len() as i64))
                    .extend(self.cfg_plain.summary()),
            )
            .with(
                "recursiveDescentWithTables",
                J::obj().with("instructions", J::Int(self.descent.instructions.len() as i64)).extend(self.cfg.summary()),
            )
            .with("tables", J::Arr(tables))
    }
}

fn analyze_function(elf: &ElfObject, name: &str, section: &str) -> Result<FunctionAnalysis, String> {
    let code = &elf.section(section)?.data;
    let (start, end, gap_end) = elf.function_extent(name, section)?;
    let sweep = linear_sweep(code, start, Some(gap_end));
    let plain = recursive_descent(code, &[start], Some(gap_end), None);
    let resolver = jump_table_resolver(elf, section);
    let resolved = recursive_descent(code, &[start], Some(gap_end), Some(resolver.as_ref()));
    let cfg = ControlFlowGraph::new(start, resolved.sorted_instructions(), &resolved.resolved_tables, None);
    let cfg_plain = ControlFlowGraph::new(start, plain.sorted_instructions(), &[], None);
    let cfg_sweep = ControlFlowGraph::new(start, sweep.instructions.clone(), &[], None);
    let value_tables = find_value_tables(elf, &resolved.sorted_instructions(), section);
    Ok(FunctionAnalysis {
        name: name.into(),
        start,
        end,
        gap_end,
        sweep,
        descent: resolved,
        descent_plain: plain,
        cfg,
        cfg_plain,
        cfg_sweep,
        value_tables,
    })
}

fn parse_objdump(text: &str) -> Vec<(u64, String, String)> {
    let mut rows = Vec::new();
    for line in text.lines() {
        if !line.contains(':') || !line.contains('\t') {
            continue;
        }
        let (head, rest) = line.split_once('\t').unwrap();
        let head = head.trim();
        let (address_text, byte_text) = head.split_once(':').unwrap_or((head, ""));
        if address_text.is_empty() || !address_text.chars().all(|c| "0123456789abcdef".contains(c)) {
            continue;
        }
        let body = rest.split('#').next().unwrap_or("");
        let address = match u64::from_str_radix(address_text, 16) {
            Ok(a) => a,
            Err(_) => continue,
        };
        rows.push((
            address,
            byte_text.split_whitespace().collect::<Vec<_>>().join(" "),
            body.split_whitespace().collect::<Vec<_>>().join(" "),
        ));
    }
    rows
}

fn compare_with_oracle(elf: &ElfObject, oracle_text: &str, section: &str) -> Result<J, String> {
    let code = &elf.section(section)?.data;
    let ours = linear_sweep(code, 0, None);
    let expected = parse_objdump(oracle_text);
    let by_address: HashMap<u64, &Instruction> = ours.instructions.iter().map(|i| (i.address, i)).collect();
    let mut mismatches = Vec::new();
    for (address, byte_text, text) in &expected {
        let Some(instruction) = by_address.get(address) else {
            mismatches.push(
                J::obj()
                    .with("address", s(hx(*address)))
                    .with("expected", s(text.clone()))
                    .with("got", s("(no instruction starts here)")),
            );
            continue;
        };
        let line = listing_line(instruction, Some(elf));
        let after_tab = line.split_once('\t').map(|(_, r)| r).unwrap_or("");
        let got = after_tab.split_whitespace().collect::<Vec<_>>().join(" ");
        if instruction.hex() != *byte_text || got != *text {
            mismatches.push(
                J::obj()
                    .with("address", s(hx(*address)))
                    .with("expected", s(format!("{} {}", byte_text, text)))
                    .with("got", s(format!("{} {}", instruction.hex(), got))),
            );
        }
    }
    let agree = mismatches.is_empty() && expected.len() == ours.instructions.len();
    Ok(J::obj()
        .with("compared", J::Int(expected.len() as i64))
        .with("ours", J::Int(ours.instructions.len() as i64))
        .with("mismatches", J::Arr(mismatches))
        .with("agree", J::Bool(agree)))
}

fn figure_data(elf: &ElfObject, name: &str) -> Result<J, String> {
    let analysis = analyze_function(elf, name, ".text")?;
    let block_entries = |cfg: &ControlFlowGraph| {
        J::Arr(
            cfg.blocks
                .values()
                .map(|b| {
                    J::obj()
                        .with("s", J::Int(b.start as i64))
                        .with("e", J::Int(b.end() as i64))
                        .with("n", J::Int(b.instructions.len() as i64))
                })
                .collect(),
        )
    };
    let edge_entries = |cfg: &ControlFlowGraph| {
        J::Arr(
            cfg.edges
                .iter()
                .map(|&(f, t, k)| J::obj().with("f", J::Int(f as i64)).with("t", J::Int(t as i64)).with("k", s(k)))
                .collect(),
        )
    };
    let mut layer: Vec<(u64, i64)> = vec![(analysis.start, 0)];
    let lookup = |layer: &Vec<(u64, i64)>, k: u64| layer.iter().find(|(a, _)| *a == k).map(|(_, l)| *l);
    for start in analysis.cfg.reverse_postorder().into_iter().skip(1) {
        let forward: Vec<i64> = analysis
            .cfg
            .predecessors(start)
            .into_iter()
            .filter(|&p| lookup(&layer, p).is_some() && !analysis.cfg.dominates(start, p))
            .map(|p| lookup(&layer, p).unwrap())
            .collect();
        let value = 1 + *forward.iter().max().ok_or("max() arg is an empty sequence")?;
        match layer.iter_mut().find(|(a, _)| *a == start) {
            Some(slot) => slot.1 = value,
            None => layer.push((start, value)),
        }
    }
    let mut deepest = layer.iter().map(|(_, l)| *l).max().unwrap_or(0);
    for &start in analysis.cfg_sweep.blocks.keys() {
        if lookup(&layer, start).is_none() {
            deepest += 1;
            layer.push((start, deepest));
        }
    }
    let table = analysis.descent.resolved_tables.first().map(|(_, t)| t);
    let instructions: Vec<J> = analysis
        .sweep
        .instructions
        .iter()
        .map(|i| {
            J::obj()
                .with("a", J::Int(i.address as i64))
                .with("n", J::Int(i.length() as i64))
                .with("b", s(i.hex()))
                .with("t", s(i.text().split_whitespace().collect::<Vec<_>>().join(" ")))
                .with("f", s(i.flow))
                .with("g", i.target.map_or(J::Null, |t| J::Int(t as i64)))
        })
        .collect();
    let table_json = match table {
        None => J::Null,
        Some(t) => {
            let targets: BTreeSet<i64> = t.targets.iter().copied().collect();
            J::obj()
                .with("at", s(format!("{}+{}", t.section, format_signed(t.offset).replace("-0x", "0x-"))))
                .with("count", J::Int(t.count))
                .with("targets", J::Arr(targets.into_iter().map(J::Int).collect()))
                .with("jump", t.jump_instruction.map_or(J::Null, |a| J::Int(a as i64)))
        }
    };
    let addresses = |list: &[Instruction]| J::Arr(list.iter().map(|i| J::Int(i.address as i64)).collect());
    let order = |list: &[u64]| J::Arr(list.iter().map(|&a| J::Int(a as i64)).collect());
    Ok(J::obj()
        .with("function", s(name))
        .with("start", J::Int(analysis.start as i64))
        .with("end", J::Int(analysis.end as i64))
        .with("gapEnd", J::Int(analysis.gap_end as i64))
        .with("instructions", J::Arr(instructions))
        .with("layers", J::Obj(layer.iter().map(|(a, l)| (a.to_string(), J::Int(*l))).collect()))
        .with("table", table_json)
        .with(
            "methods",
            J::obj()
                .with(
                    "linear",
                    J::obj()
                        .with("order", addresses(&analysis.sweep.instructions))
                        .with("blocks", block_entries(&analysis.cfg_sweep))
                        .with("edges", edge_entries(&analysis.cfg_sweep)),
                )
                .with(
                    "descent",
                    J::obj()
                        .with("order", order(&analysis.descent_plain.order))
                        .with("blocks", block_entries(&analysis.cfg_plain))
                        .with("edges", edge_entries(&analysis.cfg_plain))
                        .with("unresolved", addresses(&analysis.descent_plain.unresolved)),
                )
                .with(
                    "table",
                    J::obj()
                        .with("order", order(&analysis.descent.order))
                        .with("blocks", block_entries(&analysis.cfg))
                        .with("edges", edge_entries(&analysis.cfg))
                        .with("unresolved", addresses(&analysis.descent.unresolved)),
                ),
        ))
}

const FIXTURE_OBJECTS: [&str; 4] = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o", "sweep-trap.o"];

fn trap_report(elf: &ElfObject) -> Result<J, String> {
    let code = &elf.section(".text")?.data;
    let (start, end, gap_end) = elf.function_extent("lookup", ".text")?;
    let sweep = linear_sweep(code, start, Some(gap_end));
    let descent = recursive_descent(code, &[start], Some(gap_end), None);
    let sorted = descent.sorted_instructions();
    let jump = sorted.iter().find(|i| i.flow == "jump").ok_or("StopIteration")?;
    let target = jump.target.ok_or("jump without target")?;
    let at_target = sweep.covering(target);
    let claimed = descent.claimed_bytes();
    let in_data = |a: u64| jump.end() <= a && a < target;
    let data_bytes = slice_clamped(code, jump.end(), target.saturating_sub(jump.end()));
    Ok(J::obj()
        .with("function", s("lookup"))
        .with("jump", s(format!("0x{:x} {} -> 0x{:x}", jump.address, jump.text(), target)))
        .with(
            "dataBytes",
            J::obj()
                .with("range", s(format!("0x{:x}-0x{:x}", jump.end(), target)))
                .with("hex", s(hex_spaced(&data_bytes))),
        )
        .with(
            "linearSweep",
            J::obj()
                .with("instructions", J::Int(sweep.instructions.len() as i64))
                .with(
                    "atJumpTarget",
                    at_target.map_or(J::Null, |i| {
                        J::obj()
                            .with("starts", s(hx(i.address)))
                            .with("text", s(i.text()))
                            .with("startsAtTarget", J::Bool(i.address == target))
                    }),
                )
                .with(
                    "claimedDataBytes",
                    J::Int(sweep.instructions.iter().flat_map(|i| i.address..i.end()).filter(|&a| in_data(a)).count() as i64),
                )
                .with(
                    "claimedPaddingBytes",
                    J::Int(sweep.instructions.iter().flat_map(|i| i.address..i.end()).filter(|&a| a >= end).count() as i64),
                ),
        )
        .with(
            "recursiveDescent",
            J::obj()
                .with("instructions", J::Int(descent.instructions.len() as i64))
                .with("atJumpTarget", descent.instructions.get(&target).map_or(J::Null, |i| s(i.text())))
                .with("claimedDataBytes", J::Int(claimed.iter().filter(|&&a| in_data(a)).count() as i64))
                .with("claimedPaddingBytes", J::Int(claimed.iter().filter(|&&a| a >= end).count() as i64)),
        ))
}

fn demo() -> Result<J, String> {
    let mut fixtures = J::obj();
    for object_name in FIXTURE_OBJECTS {
        let elf = load_fixture(object_name)?;
        let oracle_path = fixtures_dir().join(object_name.replace(".o", ".objdump.txt"));
        let mut entry = J::obj();
        if oracle_path.exists() {
            let text = fs::read_to_string(&oracle_path).map_err(|e| e.to_string())?;
            let comparison = compare_with_oracle(&elf, &text, ".text")?;
            let compared = match comparison.get("compared") {
                Some(J::Int(n)) => *n,
                _ => 0,
            };
            let mismatches = match comparison.get("mismatches") {
                Some(J::Arr(m)) => m.len() as i64,
                _ => 0,
            };
            entry.set(
                "oracle",
                s(format!("{}/{} instructions agree with llvm-objdump", compared - mismatches, compared)),
            );
        }
        let mut functions = J::obj();
        for symbol in elf.functions(".text") {
            functions.set(&symbol.name, analyze_function(&elf, &symbol.name, ".text")?.to_json());
        }
        entry.set("functions", functions);
        fixtures.set(object_name, entry);
    }
    Ok(J::obj().with("fixtures", fixtures).with("sweepTrap", trap_report(&load_fixture("sweep-trap.o")?)?))
}

fn disassemble(path: &str) -> Result<String, String> {
    let elf = ElfObject::new(&fs::read(path).map_err(|e| format!("{}: {}", path, e))?)?;
    let code = &elf.section(".text")?.data;
    let mut functions: HashMap<u64, String> = HashMap::new();
    for symbol in elf.functions(".text") {
        functions.insert(symbol.value, symbol.name.clone());
    }
    let mut lines = Vec::new();
    for instruction in linear_sweep(code, 0, None).instructions {
        if let Some(name) = functions.get(&instruction.address) {
            lines.push(format!("\n{:016x} <{}>:", instruction.address, name));
        }
        let mut line = listing_line(&instruction, Some(&elf));
        if let Some(reference) = resolve_reference(&elf, &instruction, ".text") {
            line += &format!("\t; {} -> {}", reference.relocation.describe(), reference.describe());
        }
        lines.push(line);
    }
    Ok(lines.join("\n").trim_start_matches('\n').to_string())
}

fn run(args: &[String]) -> Result<i32, String> {
    if args.is_empty() {
        println!("{}", demo()?.dump(Some(2)));
        return Ok(0);
    }
    match (args[0].as_str(), args.len()) {
        ("disasm", 2) => {
            println!("{}", disassemble(&args[1])?);
            Ok(0)
        }
        ("cfg", 3) => {
            let elf = ElfObject::new(&fs::read(&args[1]).map_err(|e| format!("{}: {}", args[1], e))?)?;
            println!("{}", analyze_function(&elf, &args[2], ".text")?.to_json().dump(Some(2)));
            Ok(0)
        }
        ("figure-data", _) => {
            println!("{}", figure_data(&load_fixture("ledger-x86_64-O0.o")?, "grade")?.dump(None));
            Ok(0)
        }
        _ => {
            eprintln!("usage: main.py [disasm FILE.o | cfg FILE.o FUNCTION | figure-data]");
            Ok(2)
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(code) => std::process::exit(code),
        Err(e) => {
            eprintln!("ElfError: {}", e);
            std::process::exit(1);
        }
    }
}
