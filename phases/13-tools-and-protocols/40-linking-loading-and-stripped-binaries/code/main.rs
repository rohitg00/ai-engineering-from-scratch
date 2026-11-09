// Lesson: Linking, Loading, and Stripped Binaries (phase 13 / lesson 40)
// Rust port of code/main.py. Standard library only.
// Source: phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

#![allow(dead_code)]

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

type Res<T> = Result<T, String>;

#[derive(Clone, Debug)]
enum J {
    Null,
    Bool(bool),
    Int(i128),
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

    fn is_empty_obj(&self) -> bool {
        matches!(self, J::Obj(p) if p.is_empty())
    }

    fn only(&self, keys: &[&str]) -> J {
        match self {
            J::Obj(pairs) => J::Obj(pairs.iter().filter(|(k, _)| keys.contains(&k.as_str())).cloned().collect()),
            other => other.clone(),
        }
    }

    fn dump(&self, indent: Option<usize>) -> String {
        let mut out = String::new();
        self.write(&mut out, indent, 0);
        out
    }

    fn write(&self, out: &mut String, indent: Option<usize>, depth: usize) {
        let key_sep = if indent.is_some() { ": " } else { ":" };
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
                        out.push(',');
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
                        out.push(',');
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

fn int(v: impl TryInto<i128>) -> J {
    J::Int(v.try_into().unwrap_or(i128::MAX))
}

fn strs<T: AsRef<str>>(items: &[T]) -> J {
    J::Arr(items.iter().map(|x| s(x.as_ref())).collect())
}

fn hx(value: u64) -> String {
    format!("0x{:x}", value)
}

fn hxi(value: i64) -> String {
    if value < 0 {
        format!("0x-{:x}", value.unsigned_abs())
    } else {
        format!("0x{:x}", value)
    }
}

fn hexbytes(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(" ")
}

fn signed(value: u64, bits: u32) -> i64 {
    if value & (1 << (bits - 1)) != 0 {
        value as i64 - (1i64 << bits)
    } else {
        value as i64
    }
}

fn slice(data: &[u8], start: u64, len: u64) -> &[u8] {
    let n = data.len() as u64;
    let a = start.min(n);
    let b = start.saturating_add(len).min(n);
    if b <= a {
        &[]
    } else {
        &data[a as usize..b as usize]
    }
}

fn cstring(table: &[u8], offset: u64) -> String {
    if offset >= table.len() as u64 {
        return String::new();
    }
    let start = offset as usize;
    let end = table[start..].iter().position(|&b| b == 0).map(|p| start + p).unwrap_or(table.len());
    String::from_utf8_lossy(&table[start..end]).into_owned()
}

fn fixed_name(raw: &[u8]) -> String {
    let mut end = raw.len();
    while end > 0 && raw[end - 1] == 0 {
        end -= 1;
    }
    raw[..end].iter().map(|&b| if b < 0x80 { b as char } else { '\u{fffd}' }).collect()
}

fn need(data: &[u8], offset: u64, size: u64) -> Res<usize> {
    if offset.saturating_add(size) > data.len() as u64 {
        return Err(format!("unpack_from requires a buffer of at least {} bytes", offset.saturating_add(size)));
    }
    Ok(offset as usize)
}

fn u8_at(d: &[u8], o: u64) -> Res<u8> {
    Ok(d[need(d, o, 1)?])
}

fn u16_at(d: &[u8], o: u64) -> Res<u16> {
    let o = need(d, o, 2)?;
    Ok(u16::from_le_bytes([d[o], d[o + 1]]))
}

fn i16_at(d: &[u8], o: u64) -> Res<i16> {
    Ok(u16_at(d, o)? as i16)
}

fn u32_at(d: &[u8], o: u64) -> Res<u32> {
    let o = need(d, o, 4)?;
    Ok(u32::from_le_bytes(d[o..o + 4].try_into().unwrap()))
}

fn i32_at(d: &[u8], o: u64) -> Res<i32> {
    Ok(u32_at(d, o)? as i32)
}

fn u64_at(d: &[u8], o: u64) -> Res<u64> {
    let o = need(d, o, 8)?;
    Ok(u64::from_le_bytes(d[o..o + 8].try_into().unwrap()))
}

fn i64_at(d: &[u8], o: u64) -> Res<i64> {
    Ok(u64_at(d, o)? as i64)
}

fn add_signed(base: u64, delta: i64) -> u64 {
    (base as i64).wrapping_add(delta) as u64
}

fn read_uleb128(data: &[u8], mut offset: usize) -> Res<(u64, usize)> {
    let mut value: u64 = 0;
    let mut shift = 0;
    loop {
        let byte = *data.get(offset).ok_or("IndexError: index out of range")?;
        offset += 1;
        if shift < 64 {
            value |= ((byte & 0x7f) as u64) << shift;
        }
        shift += 7;
        if byte & 0x80 == 0 {
            return Ok((value, offset));
        }
    }
}

fn crc16(data: &[u8]) -> u32 {
    if data.is_empty() {
        return 0;
    }
    let mut crc: u32 = 0xFFFF;
    for &b in data {
        let mut byte = b as u32;
        for _ in 0..8 {
            if (crc ^ byte) & 1 != 0 {
                crc = (crc >> 1) ^ 0x8408;
            } else {
                crc >>= 1;
            }
            byte >>= 1;
        }
    }
    crc = !crc & 0xFFFF;
    ((crc << 8) | (crc >> 8)) & 0xFFFF
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

fn read_file(path: &Path) -> Res<Vec<u8>> {
    fs::read(path).map_err(|e| format!("{}: {}", path.display(), e))
}

const SHT_SYMTAB: u32 = 2;
const SHT_STRTAB: u32 = 3;
const SHT_RELA: u32 = 4;
const SHT_NOBITS: u32 = 8;
const SHT_DYNSYM: u32 = 11;
const STT_SECTION: u8 = 3;
const STT_FUNC: u8 = 2;
const SHN_UNDEF: u16 = 0;
const PT_DYNAMIC: u32 = 2;
const PT_INTERP: u32 = 3;
const ET_REL: u16 = 1;
const ET_EXEC: u16 = 2;
const ET_DYN: u16 = 3;
const DT_NEEDED: i64 = 1;
const DT_PLTRELSZ: i64 = 2;
const DT_PLTGOT: i64 = 3;
const DT_STRTAB: i64 = 5;
const DT_SYMTAB: i64 = 6;
const DT_STRSZ: i64 = 10;
const DT_PLTREL: i64 = 20;
const DT_JMPREL: i64 = 23;
const DT_FLAGS_1: i64 = 0x6FFFFFFB;
const DF_1_NOW: u64 = 0x1;
const DF_1_PIE: u64 = 0x08000000;

fn elf_relocation_name(t: u32) -> String {
    let name = match t {
        0 => "R_X86_64_NONE",
        1 => "R_X86_64_64",
        2 => "R_X86_64_PC32",
        3 => "R_X86_64_GOT32",
        4 => "R_X86_64_PLT32",
        5 => "R_X86_64_COPY",
        6 => "R_X86_64_GLOB_DAT",
        7 => "R_X86_64_JUMP_SLOT",
        8 => "R_X86_64_RELATIVE",
        9 => "R_X86_64_GOTPCREL",
        10 => "R_X86_64_32",
        11 => "R_X86_64_32S",
        24 => "R_X86_64_PC64",
        26 => "R_X86_64_GOTPC32",
        37 => "R_X86_64_IRELATIVE",
        41 => "R_X86_64_GOTPCRELX",
        42 => "R_X86_64_REX_GOTPCRELX",
        _ => return format!("R_X86_64_{}", t),
    };
    name.to_string()
}

fn elf_relocation_formula(t: u32) -> Option<&'static str> {
    Some(match t {
        1 => "S + A",
        2 => "S + A - P",
        3 => "G + A",
        4 => "L + A - P",
        6 => "S",
        7 => "S",
        8 => "B + A",
        9 => "G + GOT + A - P",
        10 => "S + A",
        11 => "S + A",
        24 => "S + A - P",
        26 => "GOT + A - P",
        37 => "indirect (B + A)",
        41 => "G + GOT + A - P",
        42 => "G + GOT + A - P",
        _ => return None,
    })
}

fn dynamic_tag_name(tag: i64) -> String {
    let name = match tag {
        0 => "DT_NULL",
        1 => "DT_NEEDED",
        2 => "DT_PLTRELSZ",
        3 => "DT_PLTGOT",
        4 => "DT_HASH",
        5 => "DT_STRTAB",
        6 => "DT_SYMTAB",
        7 => "DT_RELA",
        8 => "DT_RELASZ",
        9 => "DT_RELAENT",
        10 => "DT_STRSZ",
        11 => "DT_SYMENT",
        12 => "DT_INIT",
        13 => "DT_FINI",
        14 => "DT_SONAME",
        15 => "DT_RPATH",
        16 => "DT_SYMBOLIC",
        17 => "DT_REL",
        18 => "DT_RELSZ",
        19 => "DT_RELENT",
        20 => "DT_PLTREL",
        21 => "DT_DEBUG",
        22 => "DT_TEXTREL",
        23 => "DT_JMPREL",
        24 => "DT_BIND_NOW",
        25 => "DT_INIT_ARRAY",
        26 => "DT_FINI_ARRAY",
        27 => "DT_INIT_ARRAYSZ",
        28 => "DT_FINI_ARRAYSZ",
        29 => "DT_RUNPATH",
        30 => "DT_FLAGS",
        32 => "DT_PREINIT_ARRAY",
        33 => "DT_PREINIT_ARRAYSZ",
        36 => "DT_RELR",
        0x6FFFFEF5 => "DT_GNU_HASH",
        0x6FFFFFF0 => "DT_VERSYM",
        0x6FFFFFF9 => "DT_RELACOUNT",
        0x6FFFFFFB => "DT_FLAGS_1",
        0x6FFFFFFC => "DT_VERDEF",
        0x6FFFFFFD => "DT_VERDEFNUM",
        0x6FFFFFFE => "DT_VERNEED",
        0x6FFFFFFF => "DT_VERNEEDNUM",
        _ => return hxi(tag),
    };
    name.to_string()
}

fn pt_name(t: u32) -> String {
    let name = match t {
        1 => "PT_LOAD",
        2 => "PT_DYNAMIC",
        3 => "PT_INTERP",
        4 => "PT_NOTE",
        6 => "PT_PHDR",
        0x6474E550 => "PT_GNU_EH_FRAME",
        0x6474E551 => "PT_GNU_STACK",
        0x6474E552 => "PT_GNU_RELRO",
        _ => return hx(t as u64),
    };
    name.to_string()
}

#[derive(Clone)]
struct ElfSection {
    index: usize,
    name: String,
    type_: u32,
    flags: u64,
    addr: u64,
    offset: u64,
    size: u64,
    link: u32,
    info: u32,
    entsize: u64,
    data: Vec<u8>,
}

#[derive(Clone)]
struct ElfSymbol {
    name: String,
    value: u64,
    size: u64,
    type_: u8,
    bind: u8,
    shndx: u16,
    section: String,
}

impl ElfSymbol {
    fn defined(&self) -> bool {
        self.shndx != SHN_UNDEF
    }
}

#[derive(Clone)]
struct ElfRelocation {
    section: String,
    offset: u64,
    type_: u32,
    symbol: ElfSymbol,
    addend: i64,
}

impl ElfRelocation {
    fn type_name(&self) -> String {
        elf_relocation_name(self.type_)
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

struct ProgramHeader {
    type_: u32,
    flags: u32,
    offset: u64,
    vaddr: u64,
    filesz: u64,
    memsz: u64,
    align: u64,
}

impl ProgramHeader {
    fn type_name(&self) -> String {
        pt_name(self.type_)
    }

    fn flags_text(&self) -> String {
        [(4, 'r'), (2, 'w'), (1, 'x')].iter().map(|&(bit, c)| if self.flags & bit != 0 { c } else { '-' }).collect()
    }
}

struct DynamicEntry {
    tag: i64,
    value: u64,
    text: String,
}

impl DynamicEntry {
    fn tag_name(&self) -> String {
        dynamic_tag_name(self.tag)
    }
}

struct PltEntry {
    index: usize,
    address: u64,
    raw: Vec<u8>,
    slot: u64,
    push_index: u32,
    plt0: u64,
    slot_initial: u64,
    symbol: String,
}

impl PltEntry {
    fn lines(&self) -> Vec<String> {
        vec![
            format!("jmpq *{}(%rip)   -> GOT slot {}", hxi(self.slot as i64 - (self.address as i64 + 6)), hx(self.slot)),
            format!("pushq ${}   (index into DT_JMPREL)", hx(self.push_index as u64)),
            format!("jmp {} <.plt>   (PLT0, into the dynamic linker)", hx(self.plt0)),
        ]
    }
}

struct ElfFile {
    data: Vec<u8>,
    type_: u16,
    machine: u16,
    entry: u64,
    program_headers: Vec<ProgramHeader>,
    sections: Vec<ElfSection>,
    symbol_tables: Vec<(usize, Vec<ElfSymbol>)>,
    relocations: Vec<(String, Vec<ElfRelocation>)>,
}

impl ElfFile {
    fn new(data: Vec<u8>) -> Res<ElfFile> {
        if data.len() < 4 || &data[..4] != b"\x7fELF" {
            return Err("not an ELF file".into());
        }
        if data[4] != 2 || data[5] != 1 {
            return Err("only ELF64 little-endian files are supported".into());
        }
        need(&data, 0, 64)?;
        let type_ = u16_at(&data, 16)?;
        let machine = u16_at(&data, 18)?;
        let entry = u64_at(&data, 24)?;
        let phoff = u64_at(&data, 32)?;
        let shoff = u64_at(&data, 40)?;
        let phentsize = u16_at(&data, 54)? as u64;
        let phnum = u16_at(&data, 56)? as u64;
        let shentsize = u16_at(&data, 58)? as u64;
        let shnum = u16_at(&data, 60)? as u64;
        let shstrndx = u16_at(&data, 62)? as usize;
        let mut program_headers = Vec::new();
        for index in 0..phnum {
            let b = phoff + index * phentsize;
            program_headers.push(ProgramHeader {
                type_: u32_at(&data, b)?,
                flags: u32_at(&data, b + 4)?,
                offset: u64_at(&data, b + 8)?,
                vaddr: u64_at(&data, b + 16)?,
                filesz: u64_at(&data, b + 32)?,
                memsz: u64_at(&data, b + 40)?,
                align: u64_at(&data, b + 48)?,
            });
        }
        let mut raw = Vec::new();
        for index in 0..shnum {
            let b = shoff + index * shentsize;
            raw.push((
                u32_at(&data, b)?,
                u32_at(&data, b + 4)?,
                u64_at(&data, b + 8)?,
                u64_at(&data, b + 16)?,
                u64_at(&data, b + 24)?,
                u64_at(&data, b + 32)?,
                u32_at(&data, b + 40)?,
                u32_at(&data, b + 44)?,
                u64_at(&data, b + 56)?,
            ));
        }
        let name_table: Vec<u8> = if shnum > 0 {
            let names = raw.get(shstrndx).ok_or("list index out of range")?;
            slice(&data, names.4, names.5).to_vec()
        } else {
            Vec::new()
        };
        let mut sections = Vec::new();
        for (index, r) in raw.iter().enumerate() {
            sections.push(ElfSection {
                index,
                name: cstring(&name_table, r.0 as u64),
                type_: r.1,
                flags: r.2,
                addr: r.3,
                offset: r.4,
                size: r.5,
                link: r.6,
                info: r.7,
                entsize: r.8,
                data: if r.1 == SHT_NOBITS { Vec::new() } else { slice(&data, r.4, r.5).to_vec() },
            });
        }
        let mut elf =
            ElfFile { data, type_, machine, entry, program_headers, sections, symbol_tables: vec![], relocations: vec![] };
        let mut tables = Vec::new();
        for section in &elf.sections {
            if section.type_ == SHT_SYMTAB || section.type_ == SHT_DYNSYM {
                tables.push((section.index, elf.read_symbols(section)?));
            }
        }
        elf.symbol_tables = tables;
        elf.relocations = elf.read_relocations()?;
        Ok(elf)
    }

    fn type_name(&self) -> String {
        match self.type_ {
            ET_REL => "ET_REL".into(),
            ET_EXEC => "ET_EXEC".into(),
            ET_DYN => "ET_DYN".into(),
            t => hx(t as u64),
        }
    }

    fn read_symbols(&self, section: &ElfSection) -> Res<Vec<ElfSymbol>> {
        let strings = &self.sections.get(section.link as usize).ok_or("list index out of range")?.data;
        let mut out = Vec::new();
        let mut offset = 0;
        while offset < section.size {
            let d = &section.data;
            let info = u8_at(d, offset + 4)?;
            let shndx = u16_at(d, offset + 6)?;
            out.push(ElfSymbol {
                name: cstring(strings, u32_at(d, offset)? as u64),
                value: u64_at(d, offset + 8)?,
                size: u64_at(d, offset + 16)?,
                type_: info & 0xF,
                bind: info >> 4,
                shndx,
                section: self.sections.get(shndx as usize).map(|s| s.name.clone()).unwrap_or_default(),
            });
            offset += 24;
        }
        Ok(out)
    }

    fn table_for(&self, index: usize) -> Option<&Vec<ElfSymbol>> {
        self.symbol_tables.iter().find(|(i, _)| *i == index).map(|(_, t)| t)
    }

    fn read_relocations(&self) -> Res<Vec<(String, Vec<ElfRelocation>)>> {
        let mut table: Vec<(String, Vec<ElfRelocation>)> = Vec::new();
        let empty = Vec::new();
        for section in &self.sections {
            if section.type_ != SHT_RELA {
                continue;
            }
            let target = match self.sections.get(section.info as usize) {
                Some(t) => t.name.clone(),
                None => section.name.clone(),
            };
            let symbols = self.table_for(section.link as usize).unwrap_or(&empty);
            let key = if self.type_ != ET_REL { section.name.clone() } else { target.clone() };
            let mut offset = 0;
            while offset < section.size {
                let d = &section.data;
                let r_offset = u64_at(d, offset)?;
                let r_info = u64_at(d, offset + 8)?;
                let r_addend = i64_at(d, offset + 16)?;
                let symbol = symbols.get((r_info >> 32) as usize).ok_or("list index out of range")?.clone();
                let rel = ElfRelocation {
                    section: target.clone(),
                    offset: r_offset,
                    type_: (r_info & 0xFFFF_FFFF) as u32,
                    symbol,
                    addend: r_addend,
                };
                match table.iter_mut().find(|(k, _)| *k == key) {
                    Some((_, list)) => list.push(rel),
                    None => table.push((key.clone(), vec![rel])),
                }
                offset += 24;
            }
        }
        Ok(table)
    }

    fn symbols(&self) -> Vec<ElfSymbol> {
        for section in &self.sections {
            if section.type_ == SHT_SYMTAB {
                return self.table_for(section.index).cloned().unwrap_or_default();
            }
        }
        Vec::new()
    }

    fn dynamic_symbols(&self) -> Vec<ElfSymbol> {
        for section in &self.sections {
            if section.type_ == SHT_DYNSYM {
                return self.table_for(section.index).cloned().unwrap_or_default();
            }
        }
        Vec::new()
    }

    fn section(&self, name: &str) -> Res<&ElfSection> {
        self.sections.iter().find(|s| s.name == name).ok_or_else(|| format!("no section named {}", name))
    }

    fn vaddr_to_offset(&self, address: u64) -> Res<u64> {
        for h in &self.program_headers {
            if h.type_ == 1 && h.vaddr <= address && address < h.vaddr + h.filesz {
                return Ok(address - h.vaddr + h.offset);
            }
        }
        Err(format!("address {} is in no PT_LOAD segment", hx(address)))
    }

    fn read(&self, address: u64, size: u64) -> Res<Vec<u8>> {
        Ok(slice(&self.data, self.vaddr_to_offset(address)?, size).to_vec())
    }

    fn dynamic_entries(&self) -> Res<Vec<DynamicEntry>> {
        let header = match self.program_headers.iter().find(|h| h.type_ == PT_DYNAMIC) {
            Some(h) => h,
            None => return Ok(vec![]),
        };
        let mut raw = Vec::new();
        let mut offset = header.offset;
        while offset < header.offset + header.filesz {
            let tag = i64_at(&self.data, offset)?;
            let value = u64_at(&self.data, offset + 8)?;
            raw.push((tag, value));
            if tag == 0 {
                break;
            }
            offset += 16;
        }
        let strtab = raw.iter().find(|(t, _)| *t == DT_STRTAB).map(|(_, v)| *v);
        let mut entries = Vec::new();
        for &(tag, value) in &raw {
            let mut text = hx(value);
            if tag == DT_NEEDED && strtab.is_some() {
                text = cstring(&self.data, self.vaddr_to_offset(strtab.unwrap())? + value);
            } else if tag == DT_PLTREL {
                text = match value {
                    7 => "RELA".into(),
                    17 => "REL".into(),
                    _ => hx(value),
                };
            } else if tag == DT_FLAGS_1 {
                let names: Vec<&str> = [(DF_1_NOW, "DF_1_NOW"), (DF_1_PIE, "DF_1_PIE")]
                    .iter()
                    .filter(|(bit, _)| value & bit != 0)
                    .map(|(_, n)| *n)
                    .collect();
                text = if names.is_empty() { hx(value) } else { names.join(" ") };
            }
            entries.push(DynamicEntry { tag, value, text });
        }
        Ok(entries)
    }

    fn dynamic(&self, tag: i64) -> Res<Option<u64>> {
        Ok(self.dynamic_entries()?.iter().find(|e| e.tag == tag).map(|e| e.value))
    }

    fn jump_slots(&self) -> Res<Vec<ElfRelocation>> {
        let (jmprel, size) = match (self.dynamic(DT_JMPREL)?, self.dynamic(DT_PLTRELSZ)?) {
            (Some(j), Some(s)) => (j, s),
            _ => return Ok(vec![]),
        };
        let symbols = self.dynamic_symbols();
        let base = self.vaddr_to_offset(jmprel)?;
        let mut slots = Vec::new();
        let mut offset = base;
        while offset < base + size {
            let r_offset = u64_at(&self.data, offset)?;
            let r_info = u64_at(&self.data, offset + 8)?;
            let r_addend = i64_at(&self.data, offset + 16)?;
            slots.push(ElfRelocation {
                section: ".got.plt".into(),
                offset: r_offset,
                type_: (r_info & 0xFFFF_FFFF) as u32,
                symbol: symbols.get((r_info >> 32) as usize).ok_or("list index out of range")?.clone(),
                addend: r_addend,
            });
            offset += 24;
        }
        Ok(slots)
    }

    fn plt_entries(&self) -> Res<Vec<PltEntry>> {
        let plt = self.section(".plt")?;
        let slots: HashMap<u64, String> = self.jump_slots()?.iter().map(|r| (r.offset, r.symbol_name())).collect();
        let mut entries = Vec::new();
        let count = (plt.size / 16) as i64 - 1;
        for index in 0..count.max(0) as u64 {
            let address = plt.addr + 16 * (index + 1);
            let raw = slice(&plt.data, 16 * (index + 1), 16).to_vec();
            if raw.len() < 12 {
                return Err("IndexError: index out of range".into());
            }
            if raw[..2] != [0xff, 0x25] || raw[6] != 0x68 || raw[11] != 0xE9 {
                return Err(format!("PLT entry at {} does not match Figure 5.2", hx(address)));
            }
            let slot = add_signed(address + 6, i32_at(&raw, 2)? as i64);
            let push_index = u32_at(&raw, 7)?;
            let plt0 = add_signed(address + 16, i32_at(&raw, 12)? as i64);
            let initial_bytes = self.read(slot, 8)?;
            if initial_bytes.len() != 8 {
                return Err("unpack requires a buffer of 8 bytes".into());
            }
            entries.push(PltEntry {
                index: index as usize,
                address,
                raw,
                slot,
                push_index,
                plt0,
                slot_initial: u64_at(&initial_bytes, 0)?,
                symbol: slots.get(&slot).cloned().unwrap_or_else(|| "?".into()),
            });
        }
        Ok(entries)
    }

    fn plt0(&self) -> Res<J> {
        let plt = self.section(".plt")?;
        let raw = slice(&plt.data, 0, 16);
        if raw.len() < 8 || raw[..2] != [0xff, 0x35] || raw[6..8] != [0xff, 0x25] {
            return Err("PLT0 does not match Figure 5.2".into());
        }
        let got8 = add_signed(plt.addr + 6, i32_at(raw, 2)? as i64);
        let got16 = add_signed(plt.addr + 12, i32_at(raw, 8)? as i64);
        Ok(J::obj()
            .with("address", int(plt.addr))
            .with("bytes", s(hexbytes(raw)))
            .with("pushes", int(got8))
            .with("jumpsThrough", int(got16))
            .with(
                "lines",
                strs(&[
                    format!("pushq {}(%rip)   (GOT[1], the link_map)", hx(got8)),
                    format!("jmpq *{}(%rip)   (GOT[2], the resolver)", hx(got16)),
                    "nopl (%rax)".to_string(),
                ]),
            ))
    }

    fn got_plt_words(&self) -> Res<Vec<u64>> {
        let got = self.section(".got.plt")?;
        (0..got.size / 8).map(|k| u64_at(&got.data, 8 * k)).collect()
    }

    fn functions(&self, section: &str) -> Vec<ElfSymbol> {
        let mut found: Vec<ElfSymbol> =
            self.symbols().into_iter().filter(|s| s.type_ == STT_FUNC && s.section == section).collect();
        found.sort_by_key(|s| s.value);
        found
    }
}

fn load_elf(name: &str) -> Res<ElfFile> {
    ElfFile::new(read_file(&fixtures_dir().join(name))?)
}

struct LinkDecision {
    object: String,
    relocation: ElfRelocation,
    kind: &'static str,
    outcome: String,
}

impl LinkDecision {
    fn to_json(&self) -> J {
        J::obj()
            .with("object", s(&self.object))
            .with("section", s(&self.relocation.section))
            .with("offset", s(hx(self.relocation.offset)))
            .with("relocation", s(self.relocation.describe()))
            .with("kind", s(self.kind))
            .with("outcome", s(&self.outcome))
    }
}

fn plan_dynamic_link(objects: &[(String, ElfFile)]) -> J {
    let mut defined: HashSet<String> = HashSet::new();
    for (_, elf) in objects {
        for sym in elf.symbols() {
            if sym.defined() && !sym.name.is_empty() && sym.type_ != STT_SECTION {
                defined.insert(sym.name.clone());
            }
        }
    }
    let mut decisions = Vec::new();
    let mut plt_symbols: Vec<String> = Vec::new();
    for (object_name, elf) in objects {
        for (_, relocations) in &elf.relocations {
            for relocation in relocations {
                let name = relocation.symbol_name();
                let is_defined = relocation.symbol.defined() || defined.contains(&name);
                let (kind, outcome): (&str, String) = match relocation.type_ {
                    4 => {
                        if is_defined {
                            ("direct", "the link editor writes S + A - P into the call: no PLT entry (the PLT32 to PC32 reduction)".into())
                        } else {
                            if !plt_symbols.contains(&name) {
                                plt_symbols.push(name.clone());
                            }
                            ("plt", "a 16-byte PLT entry, an 8-byte .got.plt slot, and one R_X86_64_JUMP_SLOT in .rela.plt".into())
                        }
                    }
                    2 => {
                        if is_defined {
                            ("in-place", "the link editor writes S + A - P: the distance is fixed inside the image".into())
                        } else {
                            ("error", "a PC32 against an undefined symbol cannot be used in a PIE".into())
                        }
                    }
                    1 => {
                        if is_defined {
                            ("relative", "an 8-byte field that needs the load base: one R_X86_64_RELATIVE (B + A) in .rela.dyn".into())
                        } else {
                            ("dynamic-64", "one R_X86_64_64 dynamic relocation against the symbol in .rela.dyn".into())
                        }
                    }
                    41 | 42 | 9 => (
                        "got",
                        "an 8-byte .got slot and one R_X86_64_GLOB_DAT; relaxed to a direct lea or call when the symbol is local (psABI Appendix B)".into(),
                    ),
                    10 | 11 => ("error", "a 32-bit absolute field cannot hold a PIE address".into()),
                    t => ("other", elf_relocation_formula(t).unwrap_or("see Table 4.9").into()),
                };
                decisions.push(LinkDecision { object: object_name.clone(), relocation: relocation.clone(), kind, outcome });
            }
        }
    }
    let mut counts = J::obj();
    for d in &decisions {
        let current = match counts.get(d.kind) {
            Some(J::Int(n)) => *n,
            _ => 0,
        };
        counts.set(d.kind, J::Int(current + 1));
    }
    let n = plt_symbols.len() as i128;
    let relatives = match counts.get("relative") {
        Some(J::Int(n)) => *n,
        _ => 0,
    };
    let mut tags: Vec<&str> =
        vec!["DT_NEEDED", "DT_STRTAB", "DT_SYMTAB", "DT_STRSZ", "DT_SYMENT", "DT_PLTGOT", "DT_PLTRELSZ", "DT_PLTREL", "DT_JMPREL"];
    if relatives > 0 {
        tags.extend(["DT_RELA", "DT_RELASZ", "DT_RELAENT", "DT_RELACOUNT"]);
    }
    tags.push("DT_FLAGS_1");
    J::obj()
        .with("objects", J::Arr(objects.iter().map(|(n, _)| s(n)).collect()))
        .with("decisions", J::Arr(decisions.iter().map(|d| d.to_json()).collect()))
        .with("counts", counts)
        .with("pltSymbols", strs(&plt_symbols))
        .with(
            "sizes",
            J::obj()
                .with(".plt", J::Int(16 * (n + 1)))
                .with(".got.plt", J::Int(8 * (n + 3)))
                .with(".rela.plt", J::Int(24 * n))
                .with(".rela.dyn", J::Int(24 * relatives)),
        )
        .with("dynamicTags", strs(&tags))
        .with("jumpSlots", J::Arr(plt_symbols.iter().map(|n| s(format!("R_X86_64_JUMP_SLOT {}", n))).collect()))
}

fn image_file_machine_name(m: u16) -> Option<&'static str> {
    Some(match m {
        0x8664 => "IMAGE_FILE_MACHINE_AMD64",
        0xAA64 => "IMAGE_FILE_MACHINE_ARM64",
        0x14C => "IMAGE_FILE_MACHINE_I386",
        _ => return None,
    })
}

fn coff_relocation_name(t: u16) -> String {
    let name = match t {
        0 => "IMAGE_REL_AMD64_ABSOLUTE",
        1 => "IMAGE_REL_AMD64_ADDR64",
        2 => "IMAGE_REL_AMD64_ADDR32",
        3 => "IMAGE_REL_AMD64_ADDR32NB",
        4 => "IMAGE_REL_AMD64_REL32",
        5 => "IMAGE_REL_AMD64_REL32_1",
        6 => "IMAGE_REL_AMD64_REL32_2",
        7 => "IMAGE_REL_AMD64_REL32_3",
        8 => "IMAGE_REL_AMD64_REL32_4",
        9 => "IMAGE_REL_AMD64_REL32_5",
        10 => "IMAGE_REL_AMD64_SECTION",
        11 => "IMAGE_REL_AMD64_SECREL",
        _ => return hx(t as u64),
    };
    name.to_string()
}

const IMAGE_SCN_FLAGS: [(u32, &str); 9] = [
    (0x00000020, "CNT_CODE"),
    (0x00000040, "CNT_INITIALIZED_DATA"),
    (0x00000080, "CNT_UNINITIALIZED_DATA"),
    (0x00000800, "LNK_REMOVE"),
    (0x00001000, "LNK_COMDAT"),
    (0x02000000, "MEM_DISCARDABLE"),
    (0x20000000, "MEM_EXECUTE"),
    (0x40000000, "MEM_READ"),
    (0x80000000, "MEM_WRITE"),
];
const DLL_CHARACTERISTICS: [(u16, &str); 11] = [
    (0x0020, "HIGH_ENTROPY_VA"),
    (0x0040, "DYNAMIC_BASE"),
    (0x0080, "FORCE_INTEGRITY"),
    (0x0100, "NX_COMPAT"),
    (0x0200, "NO_ISOLATION"),
    (0x0400, "NO_SEH"),
    (0x0800, "NO_BIND"),
    (0x1000, "APPCONTAINER"),
    (0x2000, "WDM_DRIVER"),
    (0x4000, "GUARD_CF"),
    (0x8000, "TERMINAL_SERVER_AWARE"),
];
const DATA_DIRECTORY_NAMES: [&str; 16] = [
    "Export",
    "Import",
    "Resource",
    "Exception",
    "Certificate",
    "Base Relocation",
    "Debug",
    "Architecture",
    "Global Ptr",
    "TLS",
    "Load Config",
    "Bound Import",
    "IAT",
    "Delay Import",
    "CLR Runtime Header",
    "Reserved",
];

fn base_relocation_name(t: u16) -> String {
    match t {
        0 => "IMAGE_REL_BASED_ABSOLUTE".into(),
        3 => "IMAGE_REL_BASED_HIGHLOW".into(),
        10 => "IMAGE_REL_BASED_DIR64".into(),
        _ => hx(t as u64),
    }
}

#[derive(Clone)]
struct CoffSymbol {
    index: u32,
    name: String,
    value: u32,
    section_number: i16,
    type_: u16,
    storage_class: u8,
    aux: Vec<Vec<u8>>,
}

struct CoffRelocation {
    section: String,
    offset: u32,
    symbol_index: u32,
    type_: u16,
    symbol_name: String,
}

struct CoffSection {
    number: usize,
    name: String,
    virtual_size: u32,
    virtual_address: u32,
    raw_size: u32,
    raw_offset: u32,
    reloc_offset: u32,
    reloc_count: u16,
    characteristics: u32,
    data: Vec<u8>,
}

impl CoffSection {
    fn flag_names(&self) -> Vec<&'static str> {
        IMAGE_SCN_FLAGS.iter().filter(|(bit, _)| self.characteristics & bit != 0).map(|(_, n)| *n).collect()
    }
}

struct CoffObject {
    data: Vec<u8>,
    machine: u16,
    timestamp: u32,
    characteristics: u16,
    symtab_offset: u32,
    symbol_count: u32,
    string_table: Vec<u8>,
    sections: Vec<CoffSection>,
    symbols: Vec<CoffSymbol>,
    relocations: Vec<(String, Vec<CoffRelocation>)>,
}

impl CoffObject {
    fn new(data: Vec<u8>) -> Res<CoffObject> {
        let machine = u16_at(&data, 0)?;
        let nsections = u16_at(&data, 2)?;
        let timestamp = u32_at(&data, 4)?;
        let symtab = u32_at(&data, 8)?;
        let nsymbols = u32_at(&data, 12)?;
        let optional_size = u16_at(&data, 16)?;
        let characteristics = u16_at(&data, 18)?;
        if image_file_machine_name(machine).is_none() || optional_size != 0 {
            return Err("not a COFF object this reader knows".into());
        }
        let strings_offset = symtab as u64 + 18 * nsymbols as u64;
        let strings_size = if symtab != 0 { u32_at(&data, strings_offset)? as u64 } else { 4 };
        let string_table = slice(&data, strings_offset, strings_size).to_vec();
        let mut sections = Vec::new();
        for index in 0..nsections as u64 {
            let base = 20 + optional_size as u64 + 40 * index;
            let mut name = fixed_name(slice(&data, base, 8));
            if let Some(rest) = name.strip_prefix('/') {
                if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                    name = cstring(&string_table, rest.parse::<u64>().unwrap_or(u64::MAX));
                }
            }
            let raw_size = u32_at(&data, base + 16)?;
            let raw_offset = u32_at(&data, base + 20)?;
            sections.push(CoffSection {
                number: index as usize + 1,
                name,
                virtual_size: u32_at(&data, base + 8)?,
                virtual_address: u32_at(&data, base + 12)?,
                raw_size,
                raw_offset,
                reloc_offset: u32_at(&data, base + 24)?,
                reloc_count: u16_at(&data, base + 32)?,
                characteristics: u32_at(&data, base + 36)?,
                data: if raw_offset != 0 { slice(&data, raw_offset as u64, raw_size as u64).to_vec() } else { Vec::new() },
            });
        }
        let mut coff = CoffObject {
            data,
            machine,
            timestamp,
            characteristics,
            symtab_offset: symtab,
            symbol_count: nsymbols,
            string_table,
            sections,
            symbols: vec![],
            relocations: vec![],
        };
        coff.symbols = coff.read_symbols()?;
        coff.relocations = coff.read_relocations()?;
        Ok(coff)
    }

    fn machine_name(&self) -> String {
        image_file_machine_name(self.machine).unwrap_or("").to_string()
    }

    fn symbol_name(&self, raw: &[u8]) -> Res<String> {
        if raw[..4] == [0, 0, 0, 0] {
            return Ok(cstring(&self.string_table, u32_at(raw, 4)? as u64));
        }
        Ok(fixed_name(raw))
    }

    fn read_symbols(&self) -> Res<Vec<CoffSymbol>> {
        let mut symbols = Vec::new();
        let mut index = 0u32;
        while index < self.symbol_count {
            let base = self.symtab_offset as u64 + 18 * index as u64;
            let raw_name = slice(&self.data, base, 8).to_vec();
            if raw_name.len() < 8 {
                return Err("unpack_from requires a buffer of 18 bytes".into());
            }
            let aux_count = u8_at(&self.data, base + 17)?;
            let aux = (0..aux_count as u64).map(|k| slice(&self.data, base + 18 * (k + 1), 18).to_vec()).collect();
            symbols.push(CoffSymbol {
                index,
                name: self.symbol_name(&raw_name)?,
                value: u32_at(&self.data, base + 8)?,
                section_number: i16_at(&self.data, base + 12)?,
                type_: u16_at(&self.data, base + 14)?,
                storage_class: u8_at(&self.data, base + 16)?,
                aux,
            });
            index += 1 + aux_count as u32;
        }
        Ok(symbols)
    }

    fn symbol_at(&self, index: u32) -> Res<&CoffSymbol> {
        self.symbols.iter().find(|s| s.index == index).ok_or_else(|| format!("no symbol at index {}", index))
    }

    fn read_relocations(&self) -> Res<Vec<(String, Vec<CoffRelocation>)>> {
        let mut table: Vec<(String, Vec<CoffRelocation>)> = Vec::new();
        for section in &self.sections {
            if section.reloc_count == 0 {
                continue;
            }
            let mut rows = Vec::new();
            for k in 0..section.reloc_count as u64 {
                let b = section.reloc_offset as u64 + 10 * k;
                let symbol_index = u32_at(&self.data, b + 4)?;
                rows.push(CoffRelocation {
                    section: section.name.clone(),
                    offset: u32_at(&self.data, b)?,
                    symbol_index,
                    type_: u16_at(&self.data, b + 8)?,
                    symbol_name: self.symbol_at(symbol_index)?.name.clone(),
                });
            }
            match table.iter_mut().find(|(k, _)| *k == section.name) {
                Some((_, list)) => list.extend(rows),
                None => table.push((section.name.clone(), rows)),
            }
        }
        Ok(table)
    }

    fn section_definitions(&self) -> Res<J> {
        let mut rows = Vec::new();
        for sym in &self.symbols {
            if sym.storage_class == 3 && !sym.aux.is_empty() && sym.section_number > 0 {
                let a = &sym.aux[0];
                rows.push(
                    J::obj()
                        .with("section", s(&sym.name))
                        .with("number", int(sym.section_number))
                        .with("length", int(u32_at(a, 0)?))
                        .with("relocations", int(u16_at(a, 4)?))
                        .with("checksum", int(u32_at(a, 8)?))
                        .with("comdat", int(u8_at(a, 14)?)),
                );
            }
        }
        Ok(J::Arr(rows))
    }

    fn functions(&self) -> Vec<&CoffSymbol> {
        self.symbols.iter().filter(|s| s.type_ == 0x20 && s.section_number > 0).collect()
    }

    fn undefined(&self) -> Vec<String> {
        self.symbols.iter().filter(|s| s.section_number == 0 && s.storage_class == 2).map(|s| s.name.clone()).collect()
    }
}

fn load_coff(name: &str) -> Res<CoffObject> {
    CoffObject::new(read_file(&fixtures_dir().join(name))?)
}

struct PeSection {
    name: String,
    virtual_size: u32,
    virtual_address: u32,
    raw_size: u32,
    raw_offset: u32,
    characteristics: u32,
}

struct ImportEntry {
    index: u64,
    slot_rva: u64,
    lookup: u64,
    by_ordinal: bool,
    ordinal: Option<u64>,
    hint: Option<u16>,
    name: Option<String>,
}

struct ImportDescriptor {
    rva: u64,
    lookup_rva: u32,
    timestamp: u32,
    forwarder: u32,
    name_rva: u32,
    iat_rva: u32,
    dll: String,
    entries: Vec<ImportEntry>,
}

struct PeImage {
    data: Vec<u8>,
    e_lfanew: u32,
    machine: u16,
    section_count: u16,
    optional_size: u16,
    magic: u16,
    entry_point: u32,
    image_base: u64,
    section_alignment: u32,
    file_alignment: u32,
    size_of_image: u32,
    subsystem: u16,
    dll_characteristics: u16,
    data_directories: Vec<(String, u32, u32)>,
    sections: Vec<PeSection>,
}

impl PeImage {
    fn new(data: Vec<u8>) -> Res<PeImage> {
        if data.len() < 2 || &data[..2] != b"MZ" {
            return Err("DOS header magic not found".into());
        }
        let e_lfanew = u32_at(&data, 0x3C)?;
        if slice(&data, e_lfanew as u64, 4) != b"PE\0\0" {
            return Err("PE signature not found".into());
        }
        let coff = e_lfanew as u64 + 4;
        let machine = u16_at(&data, coff)?;
        let section_count = u16_at(&data, coff + 2)?;
        let optional_size = u16_at(&data, coff + 16)?;
        let optional = coff + 20;
        let magic = u16_at(&data, optional)?;
        if magic != 0x20B {
            return Err("only PE32+ (magic 0x20b) is supported".into());
        }
        need(&data, optional, 112)?;
        let directory_count = u32_at(&data, optional + 108)?;
        let directories = optional + 112;
        let mut data_directories = Vec::new();
        for index in 0..directory_count as u64 {
            let name = if index < 16 { DATA_DIRECTORY_NAMES[index as usize].to_string() } else { index.to_string() };
            data_directories.push((name, u32_at(&data, directories + 8 * index)?, u32_at(&data, directories + 8 * index + 4)?));
        }
        let table = optional + optional_size as u64;
        let mut sections = Vec::new();
        for index in 0..section_count as u64 {
            let b = table + 40 * index;
            need(&data, b, 40)?;
            sections.push(PeSection {
                name: fixed_name(slice(&data, b, 8)),
                virtual_size: u32_at(&data, b + 8)?,
                virtual_address: u32_at(&data, b + 12)?,
                raw_size: u32_at(&data, b + 16)?,
                raw_offset: u32_at(&data, b + 20)?,
                characteristics: u32_at(&data, b + 36)?,
            });
        }
        Ok(PeImage {
            machine,
            section_count,
            optional_size,
            magic,
            entry_point: u32_at(&data, optional + 16)?,
            image_base: u64_at(&data, optional + 24)?,
            section_alignment: u32_at(&data, optional + 32)?,
            file_alignment: u32_at(&data, optional + 36)?,
            size_of_image: u32_at(&data, optional + 56)?,
            subsystem: u16_at(&data, optional + 68)?,
            dll_characteristics: u16_at(&data, optional + 70)?,
            data_directories,
            sections,
            e_lfanew,
            data,
        })
    }

    fn directory(&self, name: &str) -> Res<(u64, u64)> {
        self.data_directories
            .iter()
            .find(|(n, _, _)| n == name)
            .map(|(_, r, s)| (*r as u64, *s as u64))
            .ok_or_else(|| format!("no data directory named {}", name))
    }

    fn dll_characteristic_names(&self) -> Vec<&'static str> {
        DLL_CHARACTERISTICS.iter().filter(|(bit, _)| self.dll_characteristics & bit != 0).map(|(_, n)| *n).collect()
    }

    fn section_of(&self, rva: u64) -> Res<&PeSection> {
        self.sections
            .iter()
            .find(|s| {
                let start = s.virtual_address as u64;
                start <= rva && rva < start + s.virtual_size.max(s.raw_size) as u64
            })
            .ok_or_else(|| format!("RVA {} is in no section", hx(rva)))
    }

    fn rva_to_offset(&self, rva: u64) -> Res<u64> {
        let section = self.section_of(rva)?;
        Ok(rva - section.virtual_address as u64 + section.raw_offset as u64)
    }

    fn read_rva(&self, rva: u64, size: u64) -> Res<Vec<u8>> {
        Ok(slice(&self.data, self.rva_to_offset(rva)?, size).to_vec())
    }

    fn string_at(&self, rva: u64) -> Res<String> {
        Ok(cstring(&self.data, self.rva_to_offset(rva)?))
    }

    fn imports(&self) -> Res<Vec<ImportDescriptor>> {
        let (mut rva, _) = self.directory("Import")?;
        let mut descriptors = Vec::new();
        loop {
            let o = self.rva_to_offset(rva)?;
            let lookup_rva = u32_at(&self.data, o)?;
            let timestamp = u32_at(&self.data, o + 4)?;
            let forwarder = u32_at(&self.data, o + 8)?;
            let name_rva = u32_at(&self.data, o + 12)?;
            let iat_rva = u32_at(&self.data, o + 16)?;
            if lookup_rva == 0 && name_rva == 0 && iat_rva == 0 {
                break;
            }
            let mut entries = Vec::new();
            let mut index = 0u64;
            loop {
                let value = u64_at(&self.data, self.rva_to_offset(lookup_rva as u64 + 8 * index)?)?;
                if value == 0 {
                    break;
                }
                let slot = iat_rva as u64 + 8 * index;
                if value >> 63 != 0 {
                    entries.push(ImportEntry {
                        index,
                        slot_rva: slot,
                        lookup: value,
                        by_ordinal: true,
                        ordinal: Some(value & 0xFFFF),
                        hint: None,
                        name: None,
                    });
                } else {
                    let hint_rva = value & 0x7FFFFFFF;
                    let hint = u16_at(&self.data, self.rva_to_offset(hint_rva)?)?;
                    entries.push(ImportEntry {
                        index,
                        slot_rva: slot,
                        lookup: value,
                        by_ordinal: false,
                        ordinal: None,
                        hint: Some(hint),
                        name: Some(self.string_at(hint_rva + 2)?),
                    });
                }
                index += 1;
            }
            descriptors.push(ImportDescriptor {
                rva,
                lookup_rva,
                timestamp,
                forwarder,
                name_rva,
                iat_rva,
                dll: self.string_at(name_rva as u64)?,
                entries,
            });
            rva += 20;
        }
        Ok(descriptors)
    }

    fn exports(&self) -> Res<J> {
        let (rva, _) = self.directory("Export")?;
        if rva == 0 {
            return Ok(J::obj());
        }
        let o = self.rva_to_offset(rva)?;
        let d = &self.data;
        let name_rva = u32_at(d, o + 12)? as u64;
        let ordinal_base = u32_at(d, o + 16)? as u64;
        let address_count = u32_at(d, o + 20)? as u64;
        let name_count = u32_at(d, o + 24)? as u64;
        let eat = u32_at(d, o + 28)? as u64;
        let enpt = u32_at(d, o + 32)? as u64;
        let eot = u32_at(d, o + 36)? as u64;
        let mut addresses = Vec::new();
        for k in 0..address_count {
            addresses.push(u32_at(d, self.rva_to_offset(eat + 4 * k)?)?);
        }
        let mut names = Vec::new();
        let mut ordinals = Vec::new();
        for k in 0..name_count {
            names.push(self.string_at(u32_at(d, self.rva_to_offset(enpt + 4 * k)?)? as u64)?);
            ordinals.push(u16_at(d, self.rva_to_offset(eot + 2 * k)?)? as u64);
        }
        let mut entries = Vec::new();
        for k in 0..name_count as usize {
            let rva = *addresses.get(ordinals[k] as usize).ok_or("list index out of range")?;
            entries.push(
                J::obj().with("ordinal", int(ordinal_base + ordinals[k])).with("rva", int(rva)).with("name", s(&names[k])),
            );
        }
        Ok(J::obj()
            .with("name", s(self.string_at(name_rva)?))
            .with("ordinalBase", int(ordinal_base))
            .with("addressCount", int(address_count))
            .with("nameCount", int(name_count))
            .with("tables", J::obj().with("eat", int(eat)).with("enpt", int(enpt)).with("eot", int(eot)))
            .with("entries", J::Arr(entries)))
    }

    fn base_relocations(&self) -> Res<J> {
        let (mut rva, size) = self.directory("Base Relocation")?;
        let end = rva + size;
        let mut blocks = Vec::new();
        while rva < end {
            let o = self.rva_to_offset(rva)?;
            let page = u32_at(&self.data, o)? as u64;
            let block_size = u32_at(&self.data, o + 4)? as u64;
            if block_size < 8 {
                return Err(format!("base relocation block of size {} is smaller than its 8-byte header", block_size).into());
            }
            let mut entries = Vec::new();
            for k in 0..(block_size - 8) / 2 {
                let word = u16_at(&self.data, self.rva_to_offset(rva + 8 + 2 * k)?)?;
                entries.push(
                    J::obj()
                        .with("type", int(word >> 12))
                        .with("typeName", s(base_relocation_name(word >> 12)))
                        .with("offset", int(word & 0xFFF))
                        .with("rva", int(page + (word & 0xFFF) as u64)),
                );
            }
            blocks.push(J::obj().with("pageRva", int(page)).with("blockSize", int(block_size)).with("entries", J::Arr(entries)));
            rva += block_size;
        }
        Ok(J::Arr(blocks))
    }

    fn iat_calls(&self) -> Res<Vec<IatCall>> {
        let code = self.section_of(self.entry_point as u64)?;
        let data = self.read_rva(code.virtual_address as u64, code.virtual_size as u64)?;
        let mut slots: HashMap<u64, (String, String)> = HashMap::new();
        for descriptor in self.imports()? {
            for entry in &descriptor.entries {
                let name = entry.name.clone().unwrap_or_else(|| format!("#{}", entry.ordinal.unwrap_or(0)));
                slots.insert(entry.slot_rva, (descriptor.dll.clone(), name));
            }
        }
        let mut calls = Vec::new();
        for position in 0..data.len().saturating_sub(5) {
            if data[position..position + 2] != [0xff, 0x15] {
                continue;
            }
            let rva = code.virtual_address as u64 + position as u64;
            let displacement = i32_at(&data, position as u64 + 2)?;
            let slot = add_signed(rva + 6, displacement as i64);
            if let Some((dll, name)) = slots.get(&slot) {
                calls.push(IatCall {
                    rva,
                    bytes: hexbytes(&data[position..position + 6]),
                    text: format!("call qword ptr [rip + {}]", hxi(displacement as i64)),
                    slot,
                    dll: dll.clone(),
                    name: name.clone(),
                });
            }
        }
        Ok(calls)
    }
}

struct IatCall {
    rva: u64,
    bytes: String,
    text: String,
    slot: u64,
    dll: String,
    name: String,
}

fn load_pe(name: &str) -> Res<PeImage> {
    PeImage::new(read_file(&fixtures_dir().join(name))?)
}

const MH_MAGIC_64: u32 = 0xFEEDFACF;
const LC_REQ_DYLD: u32 = 0x80000000;
const LC_SEGMENT_64: u32 = 0x19;
const LC_SYMTAB: u32 = 0x2;
const LC_DYSYMTAB: u32 = 0xB;
const LC_LOAD_DYLIB: u32 = 0xC;
const LC_ID_DYLIB: u32 = 0xD;
const LC_LOAD_DYLINKER: u32 = 0xE;
const LC_LOAD_WEAK_DYLIB: u32 = 0x18 | LC_REQ_DYLD;
const LC_REEXPORT_DYLIB: u32 = 0x1F | LC_REQ_DYLD;
const LC_RPATH: u32 = 0x1C | LC_REQ_DYLD;
const LC_MAIN: u32 = 0x28 | LC_REQ_DYLD;
const LC_DYLD_INFO: u32 = 0x22;
const LC_DYLD_INFO_ONLY: u32 = 0x22 | LC_REQ_DYLD;
const LC_FUNCTION_STARTS: u32 = 0x26;
const LC_DYLD_EXPORTS_TRIE: u32 = 0x33 | LC_REQ_DYLD;
const LC_DYLD_CHAINED_FIXUPS: u32 = 0x34 | LC_REQ_DYLD;

fn lc_name(cmd: u32) -> Option<&'static str> {
    Some(match cmd {
        0x1 => "LC_SEGMENT",
        LC_SYMTAB => "LC_SYMTAB",
        0x5 => "LC_UNIXTHREAD",
        LC_DYSYMTAB => "LC_DYSYMTAB",
        LC_LOAD_DYLIB => "LC_LOAD_DYLIB",
        LC_ID_DYLIB => "LC_ID_DYLIB",
        LC_LOAD_DYLINKER => "LC_LOAD_DYLINKER",
        LC_LOAD_WEAK_DYLIB => "LC_LOAD_WEAK_DYLIB",
        LC_SEGMENT_64 => "LC_SEGMENT_64",
        0x1B => "LC_UUID",
        LC_RPATH => "LC_RPATH",
        0x1D => "LC_CODE_SIGNATURE",
        LC_REEXPORT_DYLIB => "LC_REEXPORT_DYLIB",
        LC_DYLD_INFO => "LC_DYLD_INFO",
        LC_DYLD_INFO_ONLY => "LC_DYLD_INFO_ONLY",
        LC_FUNCTION_STARTS => "LC_FUNCTION_STARTS",
        LC_MAIN => "LC_MAIN",
        0x29 => "LC_DATA_IN_CODE",
        0x2A => "LC_SOURCE_VERSION",
        0x2E => "LC_LINKER_OPTIMIZATION_HINT",
        0x32 => "LC_BUILD_VERSION",
        LC_DYLD_EXPORTS_TRIE => "LC_DYLD_EXPORTS_TRIE",
        LC_DYLD_CHAINED_FIXUPS => "LC_DYLD_CHAINED_FIXUPS",
        _ => return None,
    })
}

const MH_FLAGS: [(u32, &str); 6] = [
    (0x1, "MH_NOUNDEFS"),
    (0x4, "MH_DYLDLINK"),
    (0x80, "MH_TWOLEVEL"),
    (0x2000, "MH_SUBSECTIONS_VIA_SYMBOLS"),
    (0x200000, "MH_PIE"),
    (0x800000, "MH_HAS_TLV_DESCRIPTORS"),
];

fn mh_filetype_name(t: u32) -> String {
    match t {
        0x1 => "MH_OBJECT".into(),
        0x2 => "MH_EXECUTE".into(),
        0x6 => "MH_DYLIB".into(),
        0x7 => "MH_DYLINKER".into(),
        0x8 => "MH_BUNDLE".into(),
        0xA => "MH_DSYM".into(),
        _ => hx(t as u64),
    }
}

const S_NON_LAZY_SYMBOL_POINTERS: u32 = 0x6;
const S_LAZY_SYMBOL_POINTERS: u32 = 0x7;
const S_SYMBOL_STUBS: u32 = 0x8;
const N_STAB: u8 = 0xE0;
const N_TYPE: u8 = 0x0E;
const N_EXT: u8 = 0x01;
const N_UNDF: u8 = 0x0;
const N_SECT: u8 = 0xE;
const REFERENCED_DYNAMICALLY: u16 = 0x0010;
const DYLD_CHAINED_PTR_64: u16 = 2;
const DYLD_CHAINED_PTR_64_OFFSET: u16 = 6;
const DYLD_CHAINED_PTR_START_NONE: u16 = 0xFFFF;
const DYLD_CHAINED_IMPORT: u32 = 1;
const EXPORT_SYMBOL_FLAGS_REEXPORT: u64 = 0x08;
const EXPORT_SYMBOL_FLAGS_STUB_AND_RESOLVER: u64 = 0x10;

fn arm64_relocation_name(t: u32) -> String {
    let name = match t {
        0 => "ARM64_RELOC_UNSIGNED",
        1 => "ARM64_RELOC_SUBTRACTOR",
        2 => "ARM64_RELOC_BRANCH26",
        3 => "ARM64_RELOC_PAGE21",
        4 => "ARM64_RELOC_PAGEOFF12",
        5 => "ARM64_RELOC_GOT_LOAD_PAGE21",
        6 => "ARM64_RELOC_GOT_LOAD_PAGEOFF12",
        7 => "ARM64_RELOC_POINTER_TO_GOT",
        8 => "ARM64_RELOC_TLVP_LOAD_PAGE21",
        9 => "ARM64_RELOC_TLVP_LOAD_PAGEOFF12",
        10 => "ARM64_RELOC_ADDEND",
        _ => return hx(t as u64),
    };
    name.to_string()
}

struct LoadCommand {
    index: usize,
    cmd: u32,
    offset: u64,
    size: u32,
}

impl LoadCommand {
    fn name(&self) -> String {
        lc_name(self.cmd).map(String::from).unwrap_or_else(|| hx(self.cmd as u64))
    }
}

#[derive(Clone)]
struct MachSection {
    sectname: String,
    segname: String,
    addr: u64,
    size: u64,
    offset: u32,
    flags: u32,
    reserved1: u32,
    reserved2: u32,
    reloff: u32,
    nreloc: u32,
}

impl MachSection {
    fn type_(&self) -> u32 {
        self.flags & 0xFF
    }

    fn contains(&self, address: u64) -> bool {
        self.addr <= address && address < self.addr + self.size
    }
}

struct Segment {
    name: String,
    vmaddr: u64,
    vmsize: u64,
    fileoff: u64,
    filesize: u64,
    initprot: i32,
    sections: Vec<MachSection>,
}

impl Segment {
    fn contains(&self, address: u64) -> bool {
        self.vmaddr <= address && address < self.vmaddr + self.vmsize
    }
}

#[derive(Clone)]
struct Nlist {
    index: usize,
    name: String,
    type_: u8,
    sect: u8,
    desc: u16,
    value: u64,
}

impl Nlist {
    fn is_stab(&self) -> bool {
        self.type_ & N_STAB != 0
    }

    fn kind(&self) -> u8 {
        self.type_ & N_TYPE
    }

    fn external(&self) -> bool {
        self.type_ & N_EXT != 0
    }

    fn library_ordinal(&self) -> u64 {
        ((self.desc >> 8) & 0xFF) as u64
    }
}

struct MachRelocation {
    address: i32,
    symbolnum: u32,
    pcrel: bool,
    length: u32,
    extern_: bool,
    type_: u32,
    name: String,
}

impl MachRelocation {
    fn size(&self) -> i64 {
        1 << self.length
    }

    fn type_name(&self) -> String {
        arm64_relocation_name(self.type_)
    }
}

struct Fixup {
    offset: u64,
    address: u64,
    segment: String,
    section: String,
    raw: u64,
    kind: &'static str,
    next: u64,
    ordinal: Option<u64>,
    addend: Option<u64>,
    target: Option<u64>,
}

impl Fixup {
    fn to_json(&self) -> J {
        let row = J::obj()
            .with("offset", s(hx(self.offset)))
            .with("address", s(hx(self.address)))
            .with("segment", s(&self.segment))
            .with("section", s(&self.section))
            .with("raw", s(format!("0x{:016x}", self.raw)))
            .with("kind", s(self.kind))
            .with("next", int(self.next));
        if self.kind == "bind" {
            row.with("ordinal", self.ordinal.map_or(J::Null, int)).with("addend", self.addend.map_or(J::Null, int))
        } else {
            row.with("target", s(hx(self.target.unwrap_or(0))))
        }
    }
}

struct ChainedImport {
    index: u64,
    lib_ordinal: u64,
    weak: bool,
    name: String,
    library: String,
}

struct ChainedFixups {
    dataoff: u32,
    datasize: u32,
    header: J,
    segments: Vec<J>,
    fixups: Vec<Fixup>,
    imports: Vec<ChainedImport>,
}

struct Stub {
    index: u64,
    address: u64,
    raw: Vec<u8>,
    page: u64,
    slot: u64,
    symbol: String,
}

impl Stub {
    fn lines(&self) -> Vec<String> {
        vec![
            format!("adrp x16, {}", hx(self.page)),
            format!("ldr x16, [x16, #{}]   -> slot {}", hxi(self.slot as i64 - self.page as i64), hx(self.slot)),
            "br x16".to_string(),
        ]
    }
}

fn short_library_name(path: &str) -> String {
    let last = path.rsplit('/').next().unwrap_or(path);
    last.split('.').next().unwrap_or(last).to_string()
}

struct ExportEntry {
    name: String,
    flags: u64,
    reexport: Option<u64>,
    import_name: Option<String>,
    offset: Option<u64>,
    resolver: Option<u64>,
}

struct MachoFile {
    data: Vec<u8>,
    cputype: i32,
    filetype: u32,
    ncmds: u32,
    flags: u32,
    load_commands: Vec<LoadCommand>,
    segments: Vec<Segment>,
    dylibs: Vec<String>,
    rpaths: Vec<String>,
    symtab: Option<(u32, u32, u32, u32)>,
    indirect_symbols: Vec<u32>,
    entryoff: Option<u64>,
    linkedit: Vec<(&'static str, (u32, u32))>,
    dyld_info: Option<Vec<(&'static str, u32)>>,
    nlists: Vec<Nlist>,
}

impl MachoFile {
    fn new(data: Vec<u8>) -> Res<MachoFile> {
        if data.len() < 32 || u32_at(&data, 0)? != MH_MAGIC_64 {
            return Err("not a 64-bit little-endian Mach-O file".into());
        }
        let mut m = MachoFile {
            cputype: i32_at(&data, 4)?,
            filetype: u32_at(&data, 12)?,
            ncmds: u32_at(&data, 16)?,
            flags: u32_at(&data, 24)?,
            data: Vec::new(),
            load_commands: vec![],
            segments: vec![],
            dylibs: vec![],
            rpaths: vec![],
            symtab: None,
            indirect_symbols: vec![],
            entryoff: None,
            linkedit: vec![],
            dyld_info: None,
            nlists: vec![],
        };
        let d = &data;
        let mut offset = 32u64;
        for index in 0..m.ncmds as usize {
            let cmd = u32_at(d, offset)?;
            let cmdsize = u32_at(d, offset + 4)?;
            m.load_commands.push(LoadCommand { index, cmd, offset, size: cmdsize });
            match cmd {
                LC_SEGMENT_64 => {
                    let b = offset + 8;
                    let nsects = u32_at(d, b + 56)?;
                    let mut sections = Vec::new();
                    for k in 0..nsects as u64 {
                        let base = offset + 72 + 80 * k;
                        need(d, base, 80)?;
                        sections.push(MachSection {
                            sectname: fixed_name(slice(d, base, 16)),
                            segname: fixed_name(slice(d, base + 16, 16)),
                            addr: u64_at(d, base + 32)?,
                            size: u64_at(d, base + 40)?,
                            offset: u32_at(d, base + 48)?,
                            reloff: u32_at(d, base + 56)?,
                            nreloc: u32_at(d, base + 60)?,
                            flags: u32_at(d, base + 64)?,
                            reserved1: u32_at(d, base + 68)?,
                            reserved2: u32_at(d, base + 72)?,
                        });
                    }
                    m.segments.push(Segment {
                        name: fixed_name(slice(d, b, 16)),
                        vmaddr: u64_at(d, b + 16)?,
                        vmsize: u64_at(d, b + 24)?,
                        fileoff: u64_at(d, b + 32)?,
                        filesize: u64_at(d, b + 40)?,
                        initprot: i32_at(d, b + 52)?,
                        sections,
                    });
                }
                LC_SYMTAB => {
                    let b = offset + 8;
                    m.symtab = Some((u32_at(d, b)?, u32_at(d, b + 4)?, u32_at(d, b + 8)?, u32_at(d, b + 12)?));
                }
                LC_DYSYMTAB => {
                    let indirectsymoff = u32_at(d, offset + 8 + 48)? as u64;
                    let nindirect = u32_at(d, offset + 8 + 52)? as u64;
                    m.indirect_symbols = (0..nindirect).map(|k| u32_at(d, indirectsymoff + 4 * k)).collect::<Res<_>>()?;
                }
                LC_LOAD_DYLIB | LC_LOAD_WEAK_DYLIB | LC_REEXPORT_DYLIB => {
                    let name_offset = u32_at(d, offset + 8)? as u64;
                    m.dylibs.push(cstring(d, offset + name_offset));
                }
                LC_RPATH => {
                    let name_offset = u32_at(d, offset + 8)? as u64;
                    m.rpaths.push(cstring(d, offset + name_offset));
                }
                LC_MAIN => m.entryoff = Some(u64_at(d, offset + 8)?),
                LC_FUNCTION_STARTS | LC_DYLD_EXPORTS_TRIE | LC_DYLD_CHAINED_FIXUPS | 0x29 | 0x1D => {
                    let name = lc_name(cmd).unwrap();
                    let value = (u32_at(d, offset + 8)?, u32_at(d, offset + 12)?);
                    match m.linkedit.iter_mut().find(|(k, _)| *k == name) {
                        Some(slot) => slot.1 = value,
                        None => m.linkedit.push((name, value)),
                    }
                }
                LC_DYLD_INFO | LC_DYLD_INFO_ONLY => {
                    let keys = [
                        "rebase_off",
                        "rebase_size",
                        "bind_off",
                        "bind_size",
                        "weak_bind_off",
                        "weak_bind_size",
                        "lazy_bind_off",
                        "lazy_bind_size",
                        "export_off",
                        "export_size",
                    ];
                    let mut values = Vec::new();
                    for (k, key) in keys.iter().enumerate() {
                        values.push((*key, u32_at(d, offset + 8 + 4 * k as u64)?));
                    }
                    m.dyld_info = Some(values);
                }
                _ => {}
            }
            offset += cmdsize as u64;
        }
        m.data = data;
        m.nlists = m.read_nlists()?;
        Ok(m)
    }

    fn filetype_name(&self) -> String {
        mh_filetype_name(self.filetype)
    }

    fn flag_names(&self) -> Vec<&'static str> {
        MH_FLAGS.iter().filter(|(bit, _)| self.flags & bit != 0).map(|(_, n)| *n).collect()
    }

    fn command_names(&self) -> Vec<String> {
        self.load_commands.iter().map(|c| c.name()).collect()
    }

    fn linkedit_get(&self, name: &str) -> Option<(u32, u32)> {
        self.linkedit.iter().find(|(k, _)| *k == name).map(|(_, v)| *v)
    }

    fn read_nlists(&self) -> Res<Vec<Nlist>> {
        let (symoff, nsyms, stroff, strsize) = match self.symtab {
            Some(t) => t,
            None => return Ok(vec![]),
        };
        let strings = slice(&self.data, stroff as u64, strsize as u64);
        let mut rows = Vec::new();
        for index in 0..nsyms as u64 {
            let b = symoff as u64 + 16 * index;
            rows.push(Nlist {
                index: index as usize,
                name: cstring(strings, u32_at(&self.data, b)? as u64),
                type_: u8_at(&self.data, b + 4)?,
                sect: u8_at(&self.data, b + 5)?,
                desc: u16_at(&self.data, b + 6)?,
                value: u64_at(&self.data, b + 8)?,
            });
        }
        Ok(rows)
    }

    fn base_address(&self) -> u64 {
        if let Some(seg) = self.segments.iter().find(|s| s.name == "__TEXT") {
            return seg.vmaddr;
        }
        self.segments.first().map_or(0, |s| s.vmaddr)
    }

    fn segment(&self, name: &str) -> Res<&Segment> {
        self.segments.iter().find(|s| s.name == name).ok_or_else(|| format!("no segment named {}", name))
    }

    fn section(&self, segname: &str, sectname: &str) -> Res<&MachSection> {
        self.segments
            .iter()
            .flat_map(|s| s.sections.iter())
            .find(|s| s.segname == segname && s.sectname == sectname)
            .ok_or_else(|| format!("no section {},{}", segname, sectname))
    }

    fn sections(&self) -> Vec<&MachSection> {
        self.segments.iter().flat_map(|s| s.sections.iter()).collect()
    }

    fn section_bytes(&self, section: &MachSection) -> &[u8] {
        slice(&self.data, section.offset as u64, section.size)
    }

    fn locate(&self, address: u64) -> Res<(String, String)> {
        for segment in &self.segments {
            for section in &segment.sections {
                if section.contains(address) {
                    return Ok((segment.name.clone(), section.sectname.clone()));
                }
            }
            if segment.contains(address) {
                return Ok((segment.name.clone(), String::new()));
            }
        }
        Err(format!("address {} is in no segment", hx(address)))
    }

    fn address_to_offset(&self, address: u64) -> Res<u64> {
        for segment in &self.segments {
            if segment.contains(address) && segment.filesize != 0 {
                return Ok(address - segment.vmaddr + segment.fileoff);
            }
        }
        Err(format!("address {} is not in the file", hx(address)))
    }

    fn read(&self, address: u64, size: u64) -> Res<Vec<u8>> {
        Ok(slice(&self.data, self.address_to_offset(address)?, size).to_vec())
    }

    fn word(&self, address: u64) -> Res<u32> {
        let bytes = self.read(address, 4)?;
        if bytes.len() != 4 {
            return Err("unpack requires a buffer of 4 bytes".into());
        }
        u32_at(&bytes, 0)
    }

    fn library_name(&self, ordinal: u64) -> String {
        if ordinal >= 1 && ordinal as usize <= self.dylibs.len() {
            return short_library_name(&self.dylibs[ordinal as usize - 1]);
        }
        match ordinal {
            0 => "self".into(),
            0xFE => "dynamic-lookup".into(),
            0xFF => "executable".into(),
            _ => hx(ordinal),
        }
    }

    fn two_level_imports(&self) -> Vec<(String, String)> {
        let mut rows: Vec<(String, String)> = self
            .nlists
            .iter()
            .filter(|n| !n.is_stab() && n.kind() == N_UNDF && n.external())
            .map(|n| (n.name.clone(), self.library_name(n.library_ordinal())))
            .collect();
        rows.sort();
        rows
    }

    fn nm_lines(&self) -> Vec<String> {
        let mut sorted: Vec<&Nlist> = self.nlists.iter().collect();
        sorted.sort_by(|a, b| a.name.cmp(&b.name));
        let sections = self.sections();
        let mut lines = Vec::new();
        for n in sorted {
            if n.is_stab() {
                continue;
            }
            let visibility = if n.external() { "external" } else { "non-external" };
            if n.kind() == N_UNDF {
                lines.push(format!("(undefined) {} {} (from {})", visibility, n.name, self.library_name(n.library_ordinal())));
                continue;
            }
            let mut place = "(absolute)".to_string();
            if n.kind() == N_SECT && n.sect > 0 && n.sect as usize <= sections.len() {
                let sec = sections[n.sect as usize - 1];
                place = format!("({},{})", sec.segname, sec.sectname);
            }
            let flags = if n.desc & REFERENCED_DYNAMICALLY != 0 { " [referenced dynamically]" } else { "" };
            lines.push(format!("{:016x} {}{} {} {}", n.value, place, flags, visibility, n.name));
        }
        lines
    }

    fn function_starts(&self) -> Res<Vec<u64>> {
        let (dataoff, datasize) = match self.linkedit_get("LC_FUNCTION_STARTS") {
            Some(v) => v,
            None => return Ok(vec![]),
        };
        let blob = slice(&self.data, dataoff as u64, datasize as u64);
        let mut starts = Vec::new();
        let mut address = self.base_address();
        let mut position = 0;
        while position < blob.len() {
            let (delta, next) = read_uleb128(blob, position)?;
            position = next;
            if delta == 0 && !starts.is_empty() {
                break;
            }
            address = address.wrapping_add(delta);
            starts.push(address);
        }
        Ok(starts)
    }

    fn decode_arm64_stub(address: u64, raw: &[u8]) -> Res<(u64, u64)> {
        if raw.len() < 12 {
            return Err("unpack requires a buffer of 12 bytes".into());
        }
        let adrp = u32_at(raw, 0)?;
        let ldr = u32_at(raw, 4)?;
        let br = u32_at(raw, 8)?;
        if (adrp & 0x9F000000) != 0x90000000 || (ldr & 0xFFC00000) != 0xF9400000 || (br & 0xFFFFFC1F) != 0xD61F0000 {
            return Err(format!("stub at {} is not adrp/ldr/br", hx(address)));
        }
        let immlo = ((adrp >> 29) & 0x3) as u64;
        let immhi = ((adrp >> 5) & 0x7FFFF) as u64;
        let page_delta = signed((immhi << 2) | immlo, 21) << 12;
        let page = add_signed(address & !0xFFF, page_delta);
        let slot = page + ((((ldr >> 10) & 0xFFF) as u64) << 3);
        Ok((page, slot))
    }

    fn stubs(&self) -> Res<Vec<Stub>> {
        let mut stubs = Vec::new();
        for section in self.sections() {
            if section.type_() != S_SYMBOL_STUBS {
                continue;
            }
            let size = if section.reserved2 != 0 { section.reserved2 as u64 } else { 12 };
            let data = self.section_bytes(section);
            for index in 0..section.size / size {
                let address = section.addr + index * size;
                let raw = slice(data, index * size, size).to_vec();
                let (page, slot) = MachoFile::decode_arm64_stub(address, &raw)?;
                let indirect = if self.indirect_symbols.is_empty() {
                    None
                } else {
                    Some(
                        *self
                            .indirect_symbols
                            .get((section.reserved1 as u64 + index) as usize)
                            .ok_or("list index out of range")?,
                    )
                };
                let name = match indirect {
                    Some(i) if (i as usize) < self.nlists.len() => self.nlists[i as usize].name.clone(),
                    _ => "?".into(),
                };
                stubs.push(Stub { index, address, raw, page, slot, symbol: name });
            }
        }
        Ok(stubs)
    }

    fn indirect_table(&self) -> Res<J> {
        let mut rows = Vec::new();
        for section in self.sections() {
            let t = section.type_();
            if t != S_SYMBOL_STUBS && t != S_NON_LAZY_SYMBOL_POINTERS && t != S_LAZY_SYMBOL_POINTERS {
                continue;
            }
            let stride = if t == S_SYMBOL_STUBS { section.reserved2 as u64 } else { 8 };
            if stride == 0 {
                return Err("integer division or modulo by zero".into());
            }
            for index in 0..section.size / stride {
                let symbol =
                    *self.indirect_symbols.get((section.reserved1 as u64 + index) as usize).ok_or("list index out of range")?;
                let name = if (symbol as usize) < self.nlists.len() {
                    self.nlists[symbol as usize].name.clone()
                } else {
                    hx(symbol as u64)
                };
                rows.push(
                    J::obj()
                        .with("section", s(format!("{},{}", section.segname, section.sectname)))
                        .with("address", int(section.addr + index * stride))
                        .with("index", int(symbol))
                        .with("name", s(name)),
                );
            }
        }
        Ok(J::Arr(rows))
    }

    fn chained_fixups(&self) -> Res<Option<ChainedFixups>> {
        let (dataoff, datasize) = match self.linkedit_get("LC_DYLD_CHAINED_FIXUPS") {
            Some(v) => v,
            None => return Ok(None),
        };
        let d = &self.data;
        let o = dataoff as u64;
        let fields: Vec<u32> = (0..7).map(|k| u32_at(d, o + 4 * k)).collect::<Res<_>>()?;
        let (version, starts_offset, imports_offset, symbols_offset, imports_count, imports_format, symbols_format) =
            (fields[0], fields[1], fields[2], fields[3], fields[4], fields[5], fields[6]);
        let header = J::obj()
            .with("fixups_version", int(version))
            .with("starts_offset", int(starts_offset))
            .with("imports_offset", int(imports_offset))
            .with("symbols_offset", int(symbols_offset))
            .with("imports_count", int(imports_count))
            .with("imports_format", int(imports_format))
            .with("symbols_format", int(symbols_format));
        if imports_format != DYLD_CHAINED_IMPORT {
            return Err(format!("imports_format {} is not DYLD_CHAINED_IMPORT", imports_format));
        }
        let symbols = o + symbols_offset as u64;
        let mut imports = Vec::new();
        for index in 0..imports_count as u64 {
            let packed = u32_at(d, o + imports_offset as u64 + 4 * index)?;
            let lib_ordinal = (packed & 0xFF) as u64;
            imports.push(ChainedImport {
                index,
                lib_ordinal,
                weak: (packed >> 8) & 1 == 1,
                name: cstring(d, symbols + (packed >> 9) as u64),
                library: self.library_name(lib_ordinal),
            });
        }
        let starts = o + starts_offset as u64;
        let seg_count = u32_at(d, starts)? as u64;
        let seg_info: Vec<u32> = (0..seg_count).map(|k| u32_at(d, starts + 4 + 4 * k)).collect::<Res<_>>()?;
        let mut segments_out = Vec::new();
        let mut fixups = Vec::new();
        for (seg_index, &info_offset) in seg_info.iter().enumerate() {
            if info_offset == 0 {
                continue;
            }
            let base = starts + info_offset as u64;
            let size = u32_at(d, base)?;
            let page_size = u16_at(d, base + 4)?;
            let pointer_format = u16_at(d, base + 6)?;
            let segment_offset = u64_at(d, base + 8)?;
            let max_valid = u32_at(d, base + 16)?;
            let page_count = u16_at(d, base + 20)?;
            let page_starts: Vec<u16> = (0..page_count as u64).map(|k| u16_at(d, base + 22 + 2 * k)).collect::<Res<_>>()?;
            let segment = self.segments.get(seg_index).ok_or("list index out of range")?;
            segments_out.push(
                J::obj()
                    .with("segment", s(&segment.name))
                    .with("size", int(size))
                    .with("page_size", int(page_size))
                    .with("pointer_format", int(pointer_format))
                    .with("segment_offset", int(segment_offset))
                    .with("max_valid_pointer", int(max_valid))
                    .with("page_count", int(page_count))
                    .with("page_start", J::Arr(page_starts.iter().map(|&p| int(p)).collect())),
            );
            if pointer_format != DYLD_CHAINED_PTR_64 && pointer_format != DYLD_CHAINED_PTR_64_OFFSET {
                return Err(format!("pointer_format {} is not a 64-bit chain", pointer_format));
            }
            for (page_index, &page_start) in page_starts.iter().enumerate() {
                if page_start == DYLD_CHAINED_PTR_START_NONE {
                    continue;
                }
                let mut offset = segment.fileoff + page_index as u64 * page_size as u64 + page_start as u64;
                let mut hops = 0;
                loop {
                    let raw = u64_at(d, offset)?;
                    let address = segment.vmaddr + (offset - segment.fileoff);
                    let (seg_name, sect_name) = self.locate(address)?;
                    let nxt = (raw >> 51) & 0xFFF;
                    if raw >> 63 != 0 {
                        fixups.push(Fixup {
                            offset,
                            address,
                            segment: seg_name,
                            section: sect_name,
                            raw,
                            kind: "bind",
                            next: nxt,
                            ordinal: Some(raw & 0xFFFFFF),
                            addend: Some((raw >> 24) & 0xFF),
                            target: None,
                        });
                    } else {
                        let mut target = raw & ((1u64 << 36) - 1);
                        if pointer_format == DYLD_CHAINED_PTR_64_OFFSET {
                            target += self.base_address();
                        }
                        fixups.push(Fixup {
                            offset,
                            address,
                            segment: seg_name,
                            section: sect_name,
                            raw,
                            kind: "rebase",
                            next: nxt,
                            ordinal: None,
                            addend: None,
                            target: Some(target),
                        });
                    }
                    hops += 1;
                    if nxt == 0 || hops > 100000 {
                        break;
                    }
                    offset += nxt * 4;
                }
            }
        }
        Ok(Some(ChainedFixups { dataoff, datasize, header, segments: segments_out, fixups, imports }))
    }

    fn fixup_rows(&self) -> Res<Vec<(String, String, u64, &'static str, String)>> {
        let info = match self.chained_fixups()? {
            Some(i) => i,
            None => return Ok(vec![]),
        };
        let mut rows = Vec::new();
        for f in &info.fixups {
            let target = if f.kind == "bind" {
                let entry = info.imports.get(f.ordinal.unwrap_or(0) as usize).ok_or("list index out of range")?;
                let addend = f.addend.unwrap_or(0);
                format!("{}/{}{}", entry.library, entry.name, if addend != 0 { format!("+{}", hx(addend)) } else { String::new() })
            } else {
                hx(f.target.unwrap_or(0))
            };
            rows.push((f.segment.clone(), f.section.clone(), f.address, f.kind, target));
        }
        Ok(rows)
    }

    fn exports_trie(&self) -> Res<Vec<ExportEntry>> {
        let (dataoff, datasize) = match self.linkedit_get("LC_DYLD_EXPORTS_TRIE") {
            Some(v) => v,
            None => return Ok(vec![]),
        };
        let blob = slice(&self.data, dataoff as u64, datasize as u64);
        let mut exports = Vec::new();
        fn visit(blob: &[u8], offset: usize, prefix: &str, exports: &mut Vec<ExportEntry>) -> Res<()> {
            let (terminal_size, position) = read_uleb128(blob, offset)?;
            if terminal_size != 0 {
                let (flags, mut cursor) = read_uleb128(blob, position)?;
                let mut entry =
                    ExportEntry { name: prefix.to_string(), flags, reexport: None, import_name: None, offset: None, resolver: None };
                if flags & EXPORT_SYMBOL_FLAGS_REEXPORT != 0 {
                    let (ordinal, next) = read_uleb128(blob, cursor)?;
                    cursor = next;
                    entry.reexport = Some(ordinal);
                    entry.import_name = Some(cstring(blob, cursor as u64));
                } else {
                    let (address, next) = read_uleb128(blob, cursor)?;
                    cursor = next;
                    entry.offset = Some(address);
                    if flags & EXPORT_SYMBOL_FLAGS_STUB_AND_RESOLVER != 0 {
                        entry.resolver = Some(read_uleb128(blob, cursor)?.0);
                    }
                }
                exports.push(entry);
            }
            let children = position + terminal_size as usize;
            let count = *blob.get(children).ok_or("IndexError: index out of range")?;
            let mut cursor = children + 1;
            for _ in 0..count {
                let edge_end = blob[cursor..].iter().position(|&b| b == 0).map(|p| cursor + p).unwrap_or(blob.len());
                let edge = String::from_utf8_lossy(&blob[cursor..edge_end]).into_owned();
                cursor = edge_end + 1;
                let (child, next) = read_uleb128(blob, cursor)?;
                cursor = next;
                visit(blob, child as usize, &format!("{}{}", prefix, edge), exports)?;
            }
            Ok(())
        }
        if !blob.is_empty() {
            visit(blob, 0, "", &mut exports)?;
        }
        exports.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(exports)
    }

    fn relocations(&self) -> Res<Vec<(String, Vec<MachRelocation>)>> {
        let sections = self.sections();
        let mut table: Vec<(String, Vec<MachRelocation>)> = Vec::new();
        for section in &sections {
            for index in 0..section.nreloc as u64 {
                let b = section.reloff as u64 + 8 * index;
                let r_address = i32_at(&self.data, b)?;
                let packed = u32_at(&self.data, b + 4)?;
                let symbolnum = packed & 0xFFFFFF;
                let extern_ = (packed >> 27) & 1 == 1;
                let name = if extern_ {
                    self.nlists.get(symbolnum as usize).ok_or("list index out of range")?.name.clone()
                } else if symbolnum > 0 && symbolnum as usize <= sections.len() {
                    sections[symbolnum as usize - 1].sectname.clone()
                } else {
                    hx(symbolnum as u64)
                };
                let rel = MachRelocation {
                    address: r_address,
                    symbolnum,
                    pcrel: (packed >> 24) & 1 == 1,
                    length: (packed >> 25) & 3,
                    extern_,
                    type_: (packed >> 28) & 0xF,
                    name,
                };
                match table.iter_mut().find(|(k, _)| *k == section.sectname) {
                    Some((_, list)) => list.push(rel),
                    None => table.push((section.sectname.clone(), vec![rel])),
                }
            }
        }
        Ok(table)
    }

    fn text_section(&self) -> Res<&MachSection> {
        self.section("__TEXT", "__text")
    }

    fn text_functions(&self) -> Res<Vec<(String, u64, u64)>> {
        let text = self.text_section()?;
        let mut starts: BTreeMap<u64, String> = BTreeMap::new();
        for n in &self.nlists {
            if n.is_stab() || n.kind() != N_SECT || !text.contains(n.value) || n.name.starts_with("ltmp") {
                continue;
            }
            if !starts.contains_key(&n.value) || n.external() {
                starts.insert(n.value, n.name.clone());
            }
        }
        let ordered: Vec<u64> = starts.keys().copied().collect();
        let mut rows = Vec::new();
        for (position, &start) in ordered.iter().enumerate() {
            let end = ordered.get(position + 1).copied().unwrap_or(text.addr + text.size);
            rows.push((starts[&start].clone(), start, end));
        }
        Ok(rows)
    }
}

fn load_macho(name: &str) -> Res<MachoFile> {
    MachoFile::new(read_file(&fixtures_dir().join(name))?)
}

const STP_FRAME_WORD: u32 = 0xA9BF7BFD;

fn prologue_matches(pattern: &str, w: u32) -> bool {
    match pattern {
        "stp-frame" => w == STP_FRAME_WORD,
        _ => (w & 0xFF0003FF) == 0xD10003FF,
    }
}

fn decode_bl(word: u32, address: u64) -> Option<u64> {
    if (word & 0xFC000000) != 0x94000000 {
        return None;
    }
    Some(add_signed(address, signed((word & 0x03FFFFFF) as u64, 26) << 2))
}

struct FunctionFinder<'a> {
    macho: &'a MachoFile,
    text: MachSection,
    words: Vec<u32>,
}

impl<'a> FunctionFinder<'a> {
    fn new(macho: &'a MachoFile) -> Res<FunctionFinder<'a>> {
        let text = macho.text_section()?.clone();
        let code = macho.section_bytes(&text);
        let mut words = Vec::new();
        let mut k = 0;
        while k + 3 < code.len() {
            words.push(u32::from_le_bytes(code[k..k + 4].try_into().unwrap()));
            k += 4;
        }
        Ok(FunctionFinder { macho, text, words })
    }

    fn symbols(&self) -> Res<Vec<u64>> {
        Ok(self.macho.text_functions()?.iter().map(|f| f.1).collect())
    }

    fn function_starts(&self) -> Res<Vec<u64>> {
        Ok(self.macho.function_starts()?.into_iter().filter(|&a| self.text.contains(a)).collect())
    }

    fn prologue_scan(&self, pattern: &str) -> Vec<u64> {
        self.words
            .iter()
            .enumerate()
            .filter(|(_, &w)| prologue_matches(pattern, w))
            .map(|(k, _)| self.text.addr + 4 * k as u64)
            .collect()
    }

    fn call_targets(&self) -> Vec<u64> {
        let mut targets: BTreeSet<u64> = BTreeSet::new();
        for (k, &word) in self.words.iter().enumerate() {
            if let Some(t) = decode_bl(word, self.text.addr + 4 * k as u64) {
                if self.text.contains(t) {
                    targets.insert(t);
                }
            }
        }
        if let Some(entryoff) = self.macho.entryoff {
            targets.insert(self.macho.base_address() + entryoff);
        }
        targets.into_iter().collect()
    }

    fn score(found: &[u64], truth: &[u64]) -> J {
        let truth_set: HashSet<u64> = truth.iter().copied().collect();
        let found_set: HashSet<u64> = found.iter().copied().collect();
        let true_positives = found.iter().filter(|a| truth_set.contains(a)).count();
        J::obj()
            .with("hits", int(found.len()))
            .with("truePositives", int(true_positives))
            .with("falsePositives", J::Arr(found.iter().filter(|a| !truth_set.contains(a)).map(|&a| s(hx(a))).collect()))
            .with("missed", J::Arr(truth.iter().filter(|a| !found_set.contains(a)).map(|&a| s(hx(a))).collect()))
            .with("recall", s(format!("{}/{}", true_positives, truth.len())))
    }

    fn methods(&self) -> Res<Vec<(&'static str, Vec<u64>)>> {
        Ok(vec![
            ("functionStarts", self.function_starts()?),
            ("prologueSub", self.prologue_scan("sub-sp")),
            ("prologueStp", self.prologue_scan("stp-frame")),
            ("callTargets", self.call_targets()),
        ])
    }
}

const PATTERN_LENGTH: usize = 32;

#[derive(Clone)]
struct Signature {
    name: String,
    pattern: Vec<Option<u8>>,
    crc_length: usize,
    crc: u32,
    length: usize,
    masked: Vec<Option<u8>>,
    referenced: Vec<String>,
}

impl Signature {
    fn pat_line(&self) -> String {
        let pattern: String = self.pattern.iter().map(|b| b.map_or("..".to_string(), |v| format!("{:02X}", v))).collect();
        let refs: String = self.referenced.iter().enumerate().map(|(i, n)| format!(" ^{:04X} {}", i, n)).collect();
        format!("{} {:02X} {:04X} {:04X} :0000 {}{}", pattern, self.crc_length, self.crc, self.length, self.name, refs)
    }

    fn matches(&self, data: &[u8]) -> bool {
        if data.len() < self.pattern.len() {
            return false;
        }
        for (byte, expected) in data.iter().zip(self.pattern.iter()) {
            if let Some(e) = expected {
                if byte != e {
                    return false;
                }
            }
        }
        if self.crc_length != 0 && crc16(slice(data, PATTERN_LENGTH as u64, self.crc_length as u64)) != self.crc {
            return false;
        }
        true
    }

    fn tail_matches(&self, data: &[u8]) -> bool {
        if data.len() < self.length {
            return false;
        }
        self.masked.iter().enumerate().all(|(k, e)| e.map_or(true, |v| data[k] == v))
    }
}

fn signatures_from_object(macho: &MachoFile) -> Res<Vec<Signature>> {
    let text = macho.text_section()?;
    let code = macho.section_bytes(text);
    let relocations = macho.relocations()?;
    let empty = Vec::new();
    let text_relocations = relocations.iter().find(|(k, _)| k == "__text").map(|(_, v)| v).unwrap_or(&empty);
    let mut variant: HashSet<i64> = HashSet::new();
    let mut referenced_at: BTreeMap<i64, String> = BTreeMap::new();
    for r in text_relocations {
        for a in r.address as i64..r.address as i64 + r.size() {
            variant.insert(a);
        }
        if r.extern_ {
            referenced_at.insert(r.address as i64, r.name.clone());
        }
    }
    let mut signatures = Vec::new();
    for (name, start, end) in macho.text_functions()? {
        let body = slice(code, start - text.addr, end - start);
        let masked: Vec<Option<u8>> = body
            .iter()
            .enumerate()
            .map(|(k, &b)| if variant.contains(&((start - text.addr) as i64 + k as i64)) { None } else { Some(b) })
            .collect();
        let pattern: Vec<Option<u8>> = masked.iter().take(PATTERN_LENGTH).copied().collect();
        let mut crc_length = 0;
        for item in masked.iter().skip(PATTERN_LENGTH) {
            if item.is_none() {
                break;
            }
            crc_length += 1;
        }
        let crc = if crc_length > 0 {
            let bytes: Vec<u8> = masked[PATTERN_LENGTH..PATTERN_LENGTH + crc_length].iter().map(|b| b.unwrap()).collect();
            crc16(&bytes)
        } else {
            0
        };
        let lo = (start - text.addr) as i64;
        let hi = (end - text.addr) as i64;
        let referenced = referenced_at.iter().filter(|(&a, _)| lo <= a && a < hi).map(|(_, n)| n.clone()).collect();
        signatures.push(Signature { name, pattern, crc_length, crc, length: body.len(), masked, referenced });
    }
    Ok(signatures)
}

fn first_tail_difference(signatures: &[&Signature]) -> J {
    let (first, second) = (signatures[0], signatures[1]);
    let limit = first.masked.len().min(second.masked.len());
    let lengths =
        J::obj().with(&first.name, int(first.length)).with(&second.name, int(second.length));
    for k in PATTERN_LENGTH..limit {
        if let (Some(a), Some(b)) = (first.masked[k], second.masked[k]) {
            if a != b {
                return J::obj()
                    .with("tailOffset", int(k))
                    .with("bytes", J::obj().with(&first.name, s(format!("{:02x}", a))).with(&second.name, s(format!("{:02x}", b))))
                    .with("lengths", lengths);
            }
        }
    }
    J::obj().with("tailOffset", J::Null).with("lengths", lengths)
}

struct SignatureMatch {
    names: BTreeMap<u64, String>,
    collisions: Vec<J>,
    unmatched: Vec<u64>,
}

impl SignatureMatch {
    fn names_json(&self) -> J {
        J::Obj(self.names.iter().map(|(a, n)| (hx(*a), s(n))).collect())
    }

    fn to_json(&self) -> J {
        J::obj()
            .with("names", self.names_json())
            .with("collisions", J::Arr(self.collisions.clone()))
            .with("unmatched", J::Arr(self.unmatched.iter().map(|&a| s(hx(a))).collect()))
    }
}

fn match_signatures(signatures: &[Signature], macho: &MachoFile, candidates: &[u64]) -> Res<SignatureMatch> {
    let text = macho.text_section()?;
    let code = macho.section_bytes(text);
    let mut names = BTreeMap::new();
    let mut collisions = Vec::new();
    let mut unmatched = Vec::new();
    for &address in candidates {
        let window = slice(code, address.wrapping_sub(text.addr), u64::MAX);
        let mut hits: Vec<&Signature> = signatures.iter().filter(|s| s.matches(window)).collect();
        if hits.is_empty() {
            unmatched.push(address);
            continue;
        }
        if hits.len() > 1 {
            let tail: Vec<&Signature> = hits.iter().copied().filter(|s| s.tail_matches(window)).collect();
            let split = first_tail_difference(&hits);
            collisions.push(
                J::obj()
                    .with("address", s(hx(address)))
                    .with("candidates", J::Arr(hits.iter().map(|h| s(&h.name)).collect()))
                    .with("resolvedBy", split)
                    .with("winner", if tail.len() == 1 { s(&tail[0].name) } else { J::Null }),
            );
            hits = if tail.len() == 1 { tail } else { hits[..1].to_vec() };
        }
        names.insert(address, hits[0].name.clone());
    }
    Ok(SignatureMatch { names, collisions, unmatched })
}

fn elf_report(elf: &ElfFile) -> Res<J> {
    let mut report = J::obj()
        .with("type", s(elf.type_name()))
        .with("entry", s(hx(elf.entry)))
        .with(
            "sections",
            J::Arr(
                elf.sections
                    .iter()
                    .filter(|sec| !sec.name.is_empty())
                    .map(|sec| J::obj().with("name", s(&sec.name)).with("size", int(sec.size)).with("addr", s(hx(sec.addr))))
                    .collect(),
            ),
        );
    if !elf.program_headers.is_empty() {
        report.set(
            "programHeaders",
            J::Arr(
                elf.program_headers
                    .iter()
                    .map(|h| {
                        J::obj()
                            .with("type", s(h.type_name()))
                            .with("offset", s(hx(h.offset)))
                            .with("vaddr", s(hx(h.vaddr)))
                            .with("filesz", s(hx(h.filesz)))
                            .with("flags", s(h.flags_text()))
                    })
                    .collect(),
            ),
        );
    }
    if elf.type_ != ET_REL {
        report.set(
            "dynamic",
            J::Arr(elf.dynamic_entries()?.iter().map(|e| J::obj().with("tag", s(e.tag_name())).with("value", s(&e.text))).collect()),
        );
        report.set(
            "dynamicSymbols",
            J::Arr(elf.dynamic_symbols().iter().filter(|x| !x.name.is_empty()).map(|x| s(&x.name)).collect()),
        );
        report.set(
            "jumpSlots",
            J::Arr(
                elf.jump_slots()?
                    .iter()
                    .map(|r| J::obj().with("slot", s(hx(r.offset))).with("relocation", s(r.describe())))
                    .collect(),
            ),
        );
        report.set("plt0", elf.plt0()?);
        report.set(
            "plt",
            J::Arr(
                elf.plt_entries()?
                    .iter()
                    .map(|e| {
                        J::obj()
                            .with("symbol", s(&e.symbol))
                            .with("address", s(hx(e.address)))
                            .with("bytes", s(hexbytes(&e.raw)))
                            .with("slot", s(hx(e.slot)))
                            .with("pushIndex", int(e.push_index))
                            .with("slotInitial", s(hx(e.slot_initial)))
                            .with("lines", strs(&e.lines()))
                    })
                    .collect(),
            ),
        );
        report.set("gotPlt", J::Arr(elf.got_plt_words()?.iter().map(|&w| s(hx(w))).collect()));
    } else {
        report.set(
            "relocations",
            J::Obj(
                elf.relocations
                    .iter()
                    .map(|(target, rows)| {
                        (
                            target.clone(),
                            J::Arr(
                                rows.iter()
                                    .map(|r| {
                                        J::obj()
                                            .with("offset", s(hx(r.offset)))
                                            .with("relocation", s(r.describe()))
                                            .with("formula", s(elf_relocation_formula(r.type_).unwrap_or("")))
                                    })
                                    .collect(),
                            ),
                        )
                    })
                    .collect(),
            ),
        );
        report.set("functions", J::Arr(elf.functions(".text").iter().map(|x| s(&x.name)).collect()));
        report.set(
            "undefined",
            J::Arr(elf.symbols().iter().filter(|x| !x.defined() && !x.name.is_empty()).map(|x| s(&x.name)).collect()),
        );
    }
    Ok(report)
}

fn coff_report(coff: &CoffObject) -> Res<J> {
    Ok(J::obj()
        .with("machine", s(coff.machine_name()))
        .with(
            "sections",
            J::Arr(
                coff.sections
                    .iter()
                    .map(|sec| {
                        J::obj()
                            .with("number", int(sec.number))
                            .with("name", s(&sec.name))
                            .with("size", int(sec.raw_size))
                            .with("relocations", int(sec.reloc_count))
                            .with("flags", strs(&sec.flag_names()))
                    })
                    .collect(),
            ),
        )
        .with(
            "symbols",
            J::Arr(
                coff.symbols
                    .iter()
                    .map(|x| {
                        J::obj()
                            .with("index", int(x.index))
                            .with("name", s(&x.name))
                            .with("section", int(x.section_number))
                            .with("value", s(hx(x.value as u64)))
                            .with("storageClass", int(x.storage_class))
                            .with("type", s(hx(x.type_ as u64)))
                            .with("aux", int(x.aux.len()))
                    })
                    .collect(),
            ),
        )
        .with("sectionDefinitions", coff.section_definitions()?)
        .with(
            "relocations",
            J::Obj(
                coff.relocations
                    .iter()
                    .map(|(name, rows)| {
                        (
                            name.clone(),
                            J::Arr(
                                rows.iter()
                                    .map(|r| {
                                        J::obj()
                                            .with("offset", s(hx(r.offset as u64)))
                                            .with("type", s(coff_relocation_name(r.type_)))
                                            .with("symbol", s(&r.symbol_name))
                                    })
                                    .collect(),
                            ),
                        )
                    })
                    .collect(),
            ),
        )
        .with("functions", J::Arr(coff.functions().iter().map(|x| s(&x.name)).collect()))
        .with("undefined", strs(&coff.undefined())))
}

fn pe_report(pe: &PeImage) -> Res<J> {
    Ok(J::obj()
        .with("e_lfanew", s(hx(pe.e_lfanew as u64)))
        .with("machine", s(image_file_machine_name(pe.machine).map(String::from).unwrap_or_else(|| hx(pe.machine as u64))))
        .with("magic", s(hx(pe.magic as u64)))
        .with("entryPoint", s(hx(pe.entry_point as u64)))
        .with("imageBase", s(hx(pe.image_base)))
        .with("sectionAlignment", s(hx(pe.section_alignment as u64)))
        .with("fileAlignment", s(hx(pe.file_alignment as u64)))
        .with("sizeOfImage", s(hx(pe.size_of_image as u64)))
        .with("subsystem", int(pe.subsystem))
        .with("dllCharacteristics", strs(&pe.dll_characteristic_names()))
        .with(
            "dataDirectories",
            J::Arr(
                pe.data_directories
                    .iter()
                    .filter(|(_, r, sz)| *r != 0 || *sz != 0)
                    .map(|(n, r, sz)| J::obj().with("name", s(n)).with("rva", s(hx(*r as u64))).with("size", int(*sz)))
                    .collect(),
            ),
        )
        .with(
            "sections",
            J::Arr(
                pe.sections
                    .iter()
                    .map(|sec| {
                        J::obj()
                            .with("name", s(&sec.name))
                            .with("rva", s(hx(sec.virtual_address as u64)))
                            .with("virtualSize", int(sec.virtual_size))
                            .with("rawSize", int(sec.raw_size))
                            .with("rawOffset", s(hx(sec.raw_offset as u64)))
                    })
                    .collect(),
            ),
        )
        .with(
            "imports",
            J::Arr(
                pe.imports()?
                    .iter()
                    .map(|d| {
                        J::obj()
                            .with("dll", s(&d.dll))
                            .with("descriptor", s(hx(d.rva)))
                            .with("lookupTable", s(hx(d.lookup_rva as u64)))
                            .with("iat", s(hx(d.iat_rva as u64)))
                            .with(
                                "entries",
                                J::Arr(
                                    d.entries
                                        .iter()
                                        .map(|e| {
                                            J::obj()
                                                .with("slot", s(hx(e.slot_rva)))
                                                .with("hint", e.hint.map_or(J::Null, int))
                                                .with("name", e.name.as_ref().map_or(J::Null, s))
                                                .with("lookup", s(hx(e.lookup)))
                                        })
                                        .collect(),
                                ),
                            )
                    })
                    .collect(),
            ),
        )
        .with("exports", pe.exports()?)
        .with("baseRelocations", pe.base_relocations()?)
        .with(
            "iatCalls",
            J::Arr(
                pe.iat_calls()?
                    .iter()
                    .map(|c| {
                        J::obj()
                            .with("rva", s(hx(c.rva)))
                            .with("bytes", s(&c.bytes))
                            .with("text", s(&c.text))
                            .with("slot", s(hx(c.slot)))
                            .with("dll", s(&c.dll))
                            .with("name", s(&c.name))
                    })
                    .collect(),
            ),
        ))
}

fn macho_report(m: &MachoFile) -> Res<J> {
    let mut report = J::obj()
        .with("filetype", s(m.filetype_name()))
        .with("flags", s(hx(m.flags as u64)))
        .with("flagNames", strs(&m.flag_names()))
        .with("loadCommands", strs(&m.command_names()))
        .with("libraries", strs(&m.dylibs))
        .with("rpaths", strs(&m.rpaths))
        .with("entry", m.entryoff.map_or(J::Null, |e| s(hx(m.base_address() + e))))
        .with("symtab", m.symtab.map_or(J::Null, |t| J::obj().with("nsyms", int(t.1)).with("strsize", int(t.3))))
        .with("functionStarts", J::Arr(m.function_starts()?.iter().map(|&a| s(hx(a))).collect()))
        .with(
            "twoLevelImports",
            J::Arr(m.two_level_imports().iter().map(|(n, l)| s(format!("{} (from {})", n, l))).collect()),
        );
    if m.filetype == 0x1 {
        report.set(
            "relocations",
            J::Obj(
                m.relocations()?
                    .iter()
                    .map(|(sec, rows)| {
                        (
                            sec.clone(),
                            J::Arr(
                                rows.iter()
                                    .map(|r| {
                                        J::obj()
                                            .with("address", s(hxi(r.address as i64)))
                                            .with("type", s(r.type_name()))
                                            .with("symbol", s(&r.name))
                                            .with("size", int(r.size()))
                                    })
                                    .collect(),
                            ),
                        )
                    })
                    .collect(),
            ),
        );
        report.set(
            "functions",
            J::Arr(
                m.text_functions()?
                    .iter()
                    .map(|(n, st, e)| J::obj().with("name", s(n)).with("start", s(hx(*st))).with("end", s(hx(*e))))
                    .collect(),
            ),
        );
        return Ok(report);
    }
    if m.sections().iter().any(|sec| sec.type_() == S_SYMBOL_STUBS) {
        report.set(
            "stubs",
            J::Arr(
                m.stubs()?
                    .iter()
                    .map(|st| {
                        J::obj()
                            .with("symbol", s(&st.symbol))
                            .with("address", s(hx(st.address)))
                            .with("bytes", s(hexbytes(&st.raw)))
                            .with("slot", s(hx(st.slot)))
                            .with("lines", strs(&st.lines()))
                    })
                    .collect(),
            ),
        );
    }
    if let Some(info) = m.chained_fixups()? {
        report.set(
            "chainedFixups",
            J::obj()
                .with("dataoff", int(info.dataoff))
                .with("datasize", int(info.datasize))
                .with("header", info.header.clone())
                .with("segments", J::Arr(info.segments.clone()))
                .with("fixups", J::Arr(info.fixups.iter().map(|f| f.to_json()).collect()))
                .with(
                    "imports",
                    J::Arr(
                        info.imports
                            .iter()
                            .map(|i| {
                                J::obj()
                                    .with("index", int(i.index))
                                    .with("libOrdinal", int(i.lib_ordinal))
                                    .with("weak", J::Bool(i.weak))
                                    .with("name", s(&i.name))
                                    .with("library", s(&i.library))
                            })
                            .collect(),
                    ),
                ),
        );
        report.set(
            "fixupRows",
            J::Arr(
                m.fixup_rows()?
                    .iter()
                    .map(|(seg, sect, addr, kind, target)| s(format!("{} {} {} {} {}", seg, sect, hx(*addr), kind, target)))
                    .collect(),
            ),
        );
    }
    if let Some(info) = &m.dyld_info {
        if !info.is_empty() {
            report.set("dyldInfo", J::Obj(info.iter().map(|(k, v)| (k.to_string(), int(*v))).collect()));
            report.set(
                "legacySections",
                J::Arr(
                    m.sections()
                        .iter()
                        .filter(|sec| ["__stub_helper", "__la_symbol_ptr", "__nl_symbol_ptr", "__got"].contains(&sec.sectname.as_str()))
                        .map(|sec| s(format!("{},{}", sec.segname, sec.sectname)))
                        .collect(),
                ),
            );
        }
    }
    let exports = m.exports_trie()?;
    if !exports.is_empty() {
        report.set(
            "exports",
            J::Arr(
                exports
                    .iter()
                    .map(|e| J::obj().with("name", s(&e.name)).with("offset", s(hx(e.offset.unwrap_or(0)))).with("flags", int(e.flags)))
                    .collect(),
            ),
        );
    }
    Ok(report)
}

fn strip_report(before: &MachoFile, after: &MachoFile) -> Res<J> {
    let names = |m: &MachoFile| {
        let mut v: Vec<String> = m.nlists.iter().filter(|n| !n.is_stab()).map(|n| n.name.clone()).collect();
        v.sort();
        v
    };
    let names_before = names(before);
    let names_after = names(after);
    let removed: Vec<String> = names_before.iter().filter(|n| !names_after.contains(n)).cloned().collect();
    Ok(J::obj()
        .with("nsymsBefore", int(before.symtab.map_or(0, |t| t.1)))
        .with("nsymsAfter", int(after.symtab.map_or(0, |t| t.1)))
        .with("removed", strs(&removed))
        .with("kept", strs(&names_after))
        .with("functionStartsBefore", int(before.function_starts()?.len()))
        .with("functionStartsAfter", int(after.function_starts()?.len()))
        .with("exportsBefore", J::Arr(before.exports_trie()?.iter().map(|e| s(&e.name)).collect()))
        .with("exportsAfter", J::Arr(after.exports_trie()?.iter().map(|e| s(&e.name)).collect())))
}

fn identification_report(unstripped: &MachoFile, stripped: &MachoFile, objects: &[MachoFile]) -> Res<J> {
    let truth = unstripped.text_functions()?;
    let truth_starts: Vec<u64> = truth.iter().map(|t| t.1).collect();
    let finder = FunctionFinder::new(stripped)?;
    let methods = finder.methods()?;
    let mut signatures = Vec::new();
    for m in objects {
        signatures.extend(signatures_from_object(m)?);
    }
    let function_starts = methods.iter().find(|(n, _)| *n == "functionStarts").map(|(_, f)| f.clone()).unwrap_or_default();
    let matched = match_signatures(&signatures, stripped, &function_starts)?;
    let correct = truth.iter().filter(|(n, st, _)| matched.names.get(st) == Some(n)).count();
    Ok(J::obj()
        .with(
            "truth",
            J::Arr(truth.iter().map(|(n, st, e)| J::obj().with("name", s(n)).with("start", s(hx(*st))).with("size", int(e - st))).collect()),
        )
        .with("strippedSymbolsInText", J::Arr(finder.symbols()?.iter().map(|&a| s(hx(a))).collect()))
        .with(
            "methods",
            J::Obj(
                methods
                    .iter()
                    .map(|(name, found)| {
                        (
                            name.to_string(),
                            J::obj()
                                .with("found", J::Arr(found.iter().map(|&a| s(hx(a))).collect()))
                                .extend(FunctionFinder::score(found, &truth_starts)),
                        )
                    })
                    .collect(),
            ),
        )
        .with(
            "signatures",
            J::obj().with("pat", J::Arr(signatures.iter().map(|x| s(x.pat_line())).collect())).extend(matched.to_json()),
        )
        .with("correctNames", int(correct)))
}

const FIXTURE_ELF_OBJECTS: [&str; 2] = ["main-x86_64-O1.o", "ledger-x86_64-O1.o"];
const FIXTURE_COFF_OBJECTS: [&str; 2] = ["main-x86_64.obj", "ledger-x86_64.obj"];

fn demo() -> Res<J> {
    let mut objects = Vec::new();
    for name in FIXTURE_ELF_OBJECTS {
        objects.push((name.to_string(), load_elf(name)?));
    }
    let tiny = load_elf("tiny-dyn-x86_64")?;
    let exe = load_macho("ledger_main")?;
    let stripped_exe = load_macho("ledger_main.stripped")?;
    let dylib = load_macho("libledger.dylib")?;
    let stripped_dylib = load_macho("libledger.stripped.dylib")?;
    let mut elf_objects = J::obj();
    for (name, elf) in &objects {
        elf_objects.set(
            name,
            J::obj()
                .with("relocations", J::Obj(elf.relocations.iter().map(|(t, r)| (t.clone(), int(r.len()))).collect()))
                .with("functions", J::Arr(elf.functions(".text").iter().map(|x| s(&x.name)).collect()))
                .with(
                    "undefined",
                    J::Arr(elf.symbols().iter().filter(|x| !x.defined() && !x.name.is_empty()).map(|x| s(&x.name)).collect()),
                ),
        );
    }
    let plan = plan_dynamic_link(&objects);
    let link_plan = match plan {
        J::Obj(pairs) => J::Obj(pairs.into_iter().filter(|(k, _)| k != "decisions").collect()),
        other => other,
    };
    let mut coff = J::obj();
    for name in FIXTURE_COFF_OBJECTS {
        coff.set(name, coff_report(&load_coff(name)?)?.only(&["machine", "sections", "relocations", "functions", "undefined"]));
    }
    let mut identification = J::obj();
    for level in ["O0", "O2"] {
        let objs = vec![load_macho(&format!("main-arm64-{}.o", level))?, load_macho(&format!("ledger-arm64-{}.o", level))?];
        identification.set(
            level,
            identification_report(
                &load_macho(&format!("static-arm64-{}", level))?,
                &load_macho(&format!("static-arm64-{}.stripped", level))?,
                &objs,
            )?,
        );
    }
    Ok(J::obj()
        .with(
            "elf",
            J::obj().with("objects", elf_objects).with("linkPlan", link_plan).with("tiny-dyn-x86_64", elf_report(&tiny)?),
        )
        .with("coff", coff)
        .with("pe", pe_report(&load_pe("tiny-x86_64.exe")?)?)
        .with(
            "macho",
            J::obj()
                .with("ledger_main", macho_report(&exe)?)
                .with(
                    "ledger_main_nochain",
                    macho_report(&load_macho("ledger_main_nochain")?)?.only(&["flags", "flagNames", "loadCommands", "dyldInfo", "legacySections"]),
                )
                .with(
                    "libledger.dylib",
                    macho_report(&dylib)?.only(&["filetype", "flagNames", "exports", "functionStarts", "symtab"]),
                )
                .with(
                    "strip",
                    J::obj()
                        .with("ledger_main", strip_report(&exe, &stripped_exe)?)
                        .with("libledger.dylib", strip_report(&dylib, &stripped_dylib)?),
                ),
        )
        .with("identification", identification))
}

fn figure_data() -> Res<J> {
    let tiny = load_elf("tiny-dyn-x86_64")?;
    let entries = tiny.plt_entries()?;
    let entry = entries.iter().find(|e| e.symbol == "puts").ok_or("StopIteration")?;
    let text = tiny.section(".text")?;
    let mut call_at = None;
    for position in 0..text.size.saturating_sub(4) {
        if text.data[position as usize] == 0xE8 {
            let disp = i32_at(&text.data, position + 1)? as i64;
            if add_signed(text.addr + position + 5, disp) == entry.address {
                call_at = Some(text.addr + position);
                break;
            }
        }
    }
    let call_at = call_at.ok_or("AssertionError")?;
    let plt0 = tiny.plt0()?;
    let jump_slots = tiny.jump_slots()?;
    let jump_slot = jump_slots.iter().find(|r| r.offset == entry.slot).ok_or("StopIteration")?;
    let elf = J::obj()
        .with("file", s("tiny-dyn-x86_64"))
        .with("symbol", s("puts"))
        .with(
            "call",
            J::obj()
                .with("address", int(call_at))
                .with("bytes", s(hexbytes(&tiny.read(call_at, 5)?)))
                .with("text", s(format!("callq {} <puts@plt>", hx(entry.address))))
                .with("target", int(entry.address)),
        )
        .with(
            "stub",
            J::obj()
                .with("label", s("puts@plt"))
                .with("address", int(entry.address))
                .with("bytes", s(hexbytes(&entry.raw)))
                .with("lines", strs(&entry.lines()))
                .with("slot", int(entry.slot)),
        )
        .with(
            "plt0",
            J::obj()
                .with("address", plt0.get("address").cloned().unwrap_or(J::Null))
                .with("bytes", plt0.get("bytes").cloned().unwrap_or(J::Null))
                .with("lines", plt0.get("lines").cloned().unwrap_or(J::Null)),
        )
        .with(
            "slot",
            J::obj()
                .with("label", s(".got.plt"))
                .with("address", int(entry.slot))
                .with("initial", s(hx(entry.slot_initial)))
                .with(
                    "initialMeaning",
                    s(format!("{} = the pushq inside puts@plt, so the first call falls into PLT0", hx(entry.slot_initial))),
                )
                .with("relocation", s(jump_slot.describe()))
                .with("after", s("ld.so writes the address of puts from libc.so.6 here on the first call, or at startup with DF_BIND_NOW")),
        )
        .with(
            "dynamic",
            J::Arr(
                tiny.dynamic_entries()?
                    .iter()
                    .filter(|e| [DT_NEEDED, DT_PLTGOT, DT_JMPREL, DT_PLTRELSZ, DT_PLTREL, DT_FLAGS_1].contains(&e.tag))
                    .map(|e| J::Arr(vec![s(e.tag_name()), s(&e.text)]))
                    .collect(),
            ),
        );
    let pe = load_pe("tiny-x86_64.exe")?;
    let calls = pe.iat_calls()?;
    let call = calls.iter().find(|c| c.name == "puts").ok_or("StopIteration")?;
    let imports = pe.imports()?;
    let descriptor = imports.first().ok_or("list index out of range")?;
    let import_entry = descriptor.entries.iter().find(|e| e.name.as_deref() == Some("puts")).ok_or("StopIteration")?;
    let hint_text = import_entry.hint.map_or("None".to_string(), |h| h.to_string());
    let pe_data = J::obj()
        .with("file", s("tiny-x86_64.exe"))
        .with("symbol", s("puts"))
        .with(
            "call",
            J::obj().with("address", int(call.rva)).with("bytes", s(&call.bytes)).with("text", s(&call.text)).with("target", int(call.slot)),
        )
        .with(
            "slot",
            J::obj()
                .with("label", s("IAT"))
                .with("address", int(import_entry.slot_rva))
                .with("initial", s(hx(import_entry.lookup)))
                .with(
                    "initialMeaning",
                    s(format!("{} = RVA of the hint/name entry: hint {}, name puts", hx(import_entry.lookup), hint_text)),
                )
                .with("relocation", s(format!("import descriptor at {}: {}", hx(descriptor.rva), descriptor.dll)))
                .with("after", s("the Windows loader writes the address of puts from msvcrt.dll here before the entry point runs")),
        )
        .with(
            "descriptor",
            J::obj()
                .with("address", int(descriptor.rva))
                .with("lookup", int(descriptor.lookup_rva))
                .with("name", int(descriptor.name_rva))
                .with("iat", int(descriptor.iat_rva))
                .with("dll", s(&descriptor.dll)),
        );
    let exe = load_macho("ledger_main")?;
    let stubs = exe.stubs()?;
    let stub = stubs.iter().find(|st| st.symbol == "_puts").ok_or("StopIteration")?;
    let main_start = exe.base_address() + exe.entryoff.unwrap_or(0);
    let text_section = exe.text_section()?;
    let code = exe.section_bytes(text_section);
    let mut bl_at = None;
    let mut k = 0usize;
    while k + 3 < code.len() {
        let address = text_section.addr + k as u64;
        if address >= main_start && decode_bl(u32_at(code, k as u64)?, address) == Some(stub.address) {
            bl_at = Some(address);
            break;
        }
        k += 4;
    }
    let bl_at = bl_at.ok_or("AssertionError")?;
    let info = exe.chained_fixups()?.ok_or("chained fixups missing")?;
    let fixup = info.fixups.iter().find(|f| f.address == stub.slot).ok_or("StopIteration")?;
    let ordinal = fixup.ordinal.unwrap_or(0);
    let chained_import = info.imports.get(ordinal as usize).ok_or("list index out of range")?;
    let ordinal_text = fixup.ordinal.map_or("None".to_string(), |o| o.to_string());
    let macho = J::obj()
        .with("file", s("ledger_main"))
        .with("symbol", s("_puts"))
        .with(
            "call",
            J::obj()
                .with("address", int(bl_at))
                .with("bytes", s(hexbytes(&exe.read(bl_at, 4)?)))
                .with("text", s(format!("bl {}", hx(stub.address))))
                .with("target", int(stub.address)),
        )
        .with(
            "stub",
            J::obj()
                .with("label", s("__stubs"))
                .with("address", int(stub.address))
                .with("bytes", s(hexbytes(&stub.raw)))
                .with("lines", strs(&stub.lines()))
                .with("slot", int(stub.slot)),
        )
        .with(
            "slot",
            J::obj()
                .with("label", s("__got"))
                .with("address", int(stub.slot))
                .with("initial", s(format!("0x{:016x}", fixup.raw)))
                .with(
                    "initialMeaning",
                    s(format!(
                        "0x{:016x} is not an address: bit 63 = bind, next = {} (x4 bytes), ordinal = {}",
                        fixup.raw, fixup.next, ordinal_text
                    )),
                )
                .with(
                    "relocation",
                    s(format!("chained import {}: {} (from {})", ordinal_text, chained_import.name, chained_import.library)),
                )
                .with("after", s("dyld writes the address of _puts from libSystem here while it walks the chain, before main runs")),
        )
        .with(
            "imports",
            J::Arr(info.imports.iter().map(|i| J::Arr(vec![int(i.index), s(&i.name), s(&i.library)])).collect()),
        );
    let unstripped = load_macho("static-arm64-O2")?;
    let stripped = load_macho("static-arm64-O2.stripped")?;
    let truth = unstripped.text_functions()?;
    let finder = FunctionFinder::new(&stripped)?;
    let methods = finder.methods()?;
    let mut signatures = Vec::new();
    for name in ["main-arm64-O2.o", "ledger-arm64-O2.o"] {
        signatures.extend(signatures_from_object(&load_macho(name)?)?);
    }
    let function_starts = methods.iter().find(|(n, _)| *n == "functionStarts").map(|(_, f)| f.clone()).unwrap_or_default();
    let matched = match_signatures(&signatures, &stripped, &function_starts)?;
    let label = |id: &str| -> &'static str {
        match id {
            "functionStarts" => "LC_FUNCTION_STARTS",
            "prologueSub" => "prologue scan: sub sp, sp, #imm",
            "prologueStp" => "prologue scan: stp x29, x30, [sp, #-0x10]!",
            "callTargets" => "bl targets + LC_MAIN entry",
            _ => "signatures from our objects",
        }
    };
    let mut method_rows: Vec<J> = methods
        .iter()
        .map(|(name, found)| {
            J::obj().with("id", s(*name)).with("label", s(label(name))).with("found", J::Arr(found.iter().map(|&a| int(a)).collect()))
        })
        .collect();
    method_rows.push(
        J::obj()
            .with("id", s("signatures"))
            .with("label", s(label("signatures")))
            .with("found", J::Arr(matched.names.keys().map(|&a| int(a)).collect()))
            .with("names", matched.names_json()),
    );
    let stripped_text = stripped.text_section()?;
    Ok(J::obj().with("elf", elf).with("pe", pe_data).with("macho", macho).with(
        "stripped",
        J::obj()
            .with("file", s("static-arm64-O2.stripped"))
            .with("textStart", int(stripped_text.addr))
            .with("textEnd", int(stripped_text.addr + stripped_text.size))
            .with(
                "truth",
                J::Arr(truth.iter().map(|(n, st, e)| J::obj().with("name", s(n)).with("start", int(*st)).with("end", int(*e))).collect()),
            )
            .with("methods", J::Arr(method_rows))
            .with("collisions", J::Arr(matched.collisions.clone())),
    ))
}

fn run(args: &[String]) -> Res<i32> {
    if args.is_empty() {
        println!("{}", demo()?.dump(Some(2)));
        return Ok(0);
    }
    let command = args[0].as_str();
    if command == "figure-data" {
        println!("{}", figure_data()?.dump(None));
        return Ok(0);
    }
    if args.len() == 2 && ["elf", "coff", "pe", "macho"].contains(&command) {
        let data = read_file(Path::new(&args[1]))?;
        let report = match command {
            "elf" => elf_report(&ElfFile::new(data)?)?,
            "coff" => coff_report(&CoffObject::new(data)?)?,
            "pe" => pe_report(&PeImage::new(data)?)?,
            _ => macho_report(&MachoFile::new(data)?)?,
        };
        println!("{}", report.dump(Some(2)));
        return Ok(0);
    }
    if command == "plan" && args.len() >= 2 {
        let mut objects = Vec::new();
        for p in &args[1..] {
            let path = Path::new(p);
            let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            match objects.iter_mut().find(|(n, _): &&mut (String, ElfFile)| *n == name) {
                Some(slot) => slot.1 = ElfFile::new(read_file(path)?)?,
                None => objects.push((name, ElfFile::new(read_file(path)?)?)),
            }
        }
        println!("{}", plan_dynamic_link(&objects).dump(Some(2)));
        return Ok(0);
    }
    if command == "functions" && (3..=5).contains(&args.len()) {
        let stripped = MachoFile::new(read_file(Path::new(&args[1]))?)?;
        let unstripped = MachoFile::new(read_file(Path::new(&args[2]))?)?;
        let mut objects = Vec::new();
        for p in &args[3..] {
            objects.push(MachoFile::new(read_file(Path::new(p))?)?);
        }
        println!("{}", identification_report(&unstripped, &stripped, &objects)?.dump(Some(2)));
        return Ok(0);
    }
    eprintln!(
        "usage: main.py [elf FILE | coff FILE | pe FILE | macho FILE | plan OBJECT... | functions STRIPPED UNSTRIPPED [OBJECT...] | figure-data]"
    );
    Ok(2)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(code) => std::process::exit(code),
        Err(e) => {
            eprintln!("FormatError: {}", e);
            std::process::exit(1);
        }
    }
}
