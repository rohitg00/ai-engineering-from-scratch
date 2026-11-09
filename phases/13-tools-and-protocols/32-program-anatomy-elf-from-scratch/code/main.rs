// Lesson: Program Anatomy: An ELF Reader From Scratch (phase 13 / lesson 32)
// Rust port of code/main.py. Standard library only.
// Source: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

type Res<T> = Result<T, String>;

const ELF_MAGIC: &[u8] = b"\x7fELF";
const ELFCLASS64: u8 = 2;
const ELFDATA2LSB: u8 = 1;
const EHDR_SIZE: u64 = 64;
const SHDR_SIZE: u64 = 64;
const PHDR_SIZE: u64 = 56;
const SYM_SIZE: u64 = 24;
const RELA_SIZE: u64 = 24;

const SHT_NOBITS: u32 = 8;
const SHT_SYMTAB: u32 = 2;
const SHT_RELA: u32 = 4;
const SHF: [(u64, &str); 11] = [
    (0x1, "W"),
    (0x2, "A"),
    (0x4, "X"),
    (0x10, "M"),
    (0x20, "S"),
    (0x40, "I"),
    (0x80, "L"),
    (0x100, "O"),
    (0x200, "G"),
    (0x400, "T"),
    (0x80000000, "E"),
];
const SHF_ALLOC: u64 = 0x2;
const SHF_EXECINSTR: u64 = 0x4;

const SHN_UNDEF: u16 = 0;
const SHN_LORESERVE: u16 = 0xFF00;
const SHN_ABS: u16 = 0xFFF1;
const SHN_COMMON: u16 = 0xFFF2;

const STT_FUNC: u8 = 2;
const STT_SECTION: u8 = 3;
const PT_LOAD: u32 = 1;

fn e_type_name(v: u16) -> Option<&'static str> {
    Some(match v {
        0 => "ET_NONE",
        1 => "ET_REL",
        2 => "ET_EXEC",
        3 => "ET_DYN",
        4 => "ET_CORE",
        _ => return None,
    })
}

fn e_machine_name(v: u16) -> Option<&'static str> {
    Some(match v {
        0 => "EM_NONE",
        3 => "EM_386",
        40 => "EM_ARM",
        62 => "EM_X86_64",
        183 => "EM_AARCH64",
        243 => "EM_RISCV",
        _ => return None,
    })
}

fn osabi_name(v: u8) -> Option<&'static str> {
    Some(match v {
        0 => "SYSV",
        3 => "LINUX",
        9 => "FREEBSD",
        _ => return None,
    })
}

fn sht_name(v: u32) -> Option<&'static str> {
    Some(match v {
        0 => "NULL",
        1 => "PROGBITS",
        2 => "SYMTAB",
        3 => "STRTAB",
        4 => "RELA",
        5 => "HASH",
        6 => "DYNAMIC",
        7 => "NOTE",
        8 => "NOBITS",
        9 => "REL",
        10 => "SHLIB",
        11 => "DYNSYM",
        14 => "INIT_ARRAY",
        15 => "FINI_ARRAY",
        16 => "PREINIT_ARRAY",
        17 => "GROUP",
        18 => "SYMTAB_SHNDX",
        0x6FFF4C03 => "LLVM_ADDRSIG",
        _ => return None,
    })
}

fn stb_name(v: u8) -> Option<&'static str> {
    Some(match v {
        0 => "LOCAL",
        1 => "GLOBAL",
        2 => "WEAK",
        _ => return None,
    })
}

fn stt_name(v: u8) -> Option<&'static str> {
    Some(match v {
        0 => "NOTYPE",
        1 => "OBJECT",
        2 => "FUNC",
        3 => "SECTION",
        4 => "FILE",
        5 => "COMMON",
        6 => "TLS",
        _ => return None,
    })
}

fn stv_name(v: u8) -> Option<&'static str> {
    Some(match v {
        0 => "DEFAULT",
        1 => "INTERNAL",
        2 => "HIDDEN",
        3 => "PROTECTED",
        _ => return None,
    })
}

fn pt_name(v: u32) -> Option<&'static str> {
    Some(match v {
        0 => "PT_NULL",
        1 => "PT_LOAD",
        2 => "PT_DYNAMIC",
        3 => "PT_INTERP",
        4 => "PT_NOTE",
        5 => "PT_SHLIB",
        6 => "PT_PHDR",
        7 => "PT_TLS",
        0x6474E550 => "PT_GNU_EH_FRAME",
        0x6474E551 => "PT_GNU_STACK",
        0x6474E552 => "PT_GNU_RELRO",
        0x6474E553 => "PT_GNU_PROPERTY",
        _ => return None,
    })
}

fn r_x86_64_name(v: u64) -> Option<&'static str> {
    Some(match v {
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
        12 => "R_X86_64_16",
        13 => "R_X86_64_PC16",
        14 => "R_X86_64_8",
        15 => "R_X86_64_PC8",
        16 => "R_X86_64_DTPMOD64",
        17 => "R_X86_64_DTPOFF64",
        18 => "R_X86_64_TPOFF64",
        19 => "R_X86_64_TLSGD",
        20 => "R_X86_64_TLSLD",
        21 => "R_X86_64_DTPOFF32",
        22 => "R_X86_64_GOTTPOFF",
        23 => "R_X86_64_TPOFF32",
        24 => "R_X86_64_PC64",
        25 => "R_X86_64_GOTOFF64",
        26 => "R_X86_64_GOTPC32",
        32 => "R_X86_64_SIZE32",
        33 => "R_X86_64_SIZE64",
        34 => "R_X86_64_GOTPC32_TLSDESC",
        35 => "R_X86_64_TLSDESC_CALL",
        36 => "R_X86_64_TLSDESC",
        37 => "R_X86_64_IRELATIVE",
        41 => "R_X86_64_GOTPCRELX",
        42 => "R_X86_64_REX_GOTPCRELX",
        _ => return None,
    })
}

fn r_aarch64_name(v: u64) -> Option<&'static str> {
    Some(match v {
        257 => "R_AARCH64_ABS64",
        275 => "R_AARCH64_ADR_PREL_PG_HI21",
        277 => "R_AARCH64_ADD_ABS_LO12_NC",
        282 => "R_AARCH64_JUMP26",
        283 => "R_AARCH64_CALL26",
        299 => "R_AARCH64_LDST128_ABS_LO12_NC",
        1025 => "R_AARCH64_GLOB_DAT",
        1026 => "R_AARCH64_JUMP_SLOT",
        1027 => "R_AARCH64_RELATIVE",
        1031 => "R_AARCH64_TLSDESC",
        _ => return None,
    })
}

fn relocation_name(machine: u16, r_type: u64) -> Option<&'static str> {
    match machine {
        62 => r_x86_64_name(r_type),
        183 => r_aarch64_name(r_type),
        _ => None,
    }
}

fn hex(value: u64) -> String {
    format!("0x{:x}", value)
}

fn hex_signed(value: i64) -> String {
    if value < 0 {
        format!("0x-{:x}", value.unsigned_abs())
    } else {
        format!("0x{:x}", value)
    }
}

fn py_str_repr(s: &str) -> String {
    let quote = if s.contains('\'') && !s.contains('"') { '"' } else { '\'' };
    let mut out = String::new();
    out.push(quote);
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c == quote => {
                out.push('\\');
                out.push(c);
            }
            c if (c as u32) < 0x20 || c as u32 == 0x7f => out.push_str(&format!("\\x{:02x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push(quote);
    out
}

fn py_bytes_repr(b: &[u8]) -> String {
    let mut out = String::from("b'");
    for &byte in b {
        match byte {
            b'\\' => out.push_str("\\\\"),
            b'\'' => out.push_str("\\'"),
            b'\n' => out.push_str("\\n"),
            b'\r' => out.push_str("\\r"),
            b'\t' => out.push_str("\\t"),
            0x20..=0x7e => out.push(byte as char),
            _ => out.push_str(&format!("\\x{:02x}", byte)),
        }
    }
    out.push('\'');
    out
}

fn py_list_repr(items: &BTreeSet<String>) -> String {
    let parts: Vec<String> = items.iter().map(|s| py_str_repr(s)).collect();
    format!("[{}]", parts.join(", "))
}

fn hex_spaced(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(" ")
}

fn need(data: &[u8], offset: u64, size: u64) -> Res<usize> {
    let end = offset.checked_add(size).ok_or("offset overflow")?;
    if end > data.len() as u64 {
        return Err(format!("unpack_from requires a buffer of at least {} bytes", end));
    }
    Ok(offset as usize)
}

fn u8_at(data: &[u8], offset: u64) -> Res<u8> {
    Ok(data[need(data, offset, 1)?])
}

fn u16_at(data: &[u8], offset: u64) -> Res<u16> {
    let o = need(data, offset, 2)?;
    Ok(u16::from_le_bytes(data[o..o + 2].try_into().unwrap()))
}

fn u32_at(data: &[u8], offset: u64) -> Res<u32> {
    let o = need(data, offset, 4)?;
    Ok(u32::from_le_bytes(data[o..o + 4].try_into().unwrap()))
}

fn i32_at(data: &[u8], offset: u64) -> Res<i32> {
    Ok(u32_at(data, offset)? as i32)
}

fn u64_at(data: &[u8], offset: u64) -> Res<u64> {
    let o = need(data, offset, 8)?;
    Ok(u64::from_le_bytes(data[o..o + 8].try_into().unwrap()))
}

fn i64_at(data: &[u8], offset: u64) -> Res<i64> {
    Ok(u64_at(data, offset)? as i64)
}

fn bytes_at(data: &[u8], offset: u64, size: u64) -> Res<&[u8]> {
    let o = need(data, offset, size)?;
    Ok(&data[o..o + size as usize])
}

fn slice_clamped(data: &[u8], start: u64, len: u64) -> &[u8] {
    let n = data.len() as u64;
    let s = start.min(n);
    let e = start.saturating_add(len).min(n);
    if e <= s {
        &[]
    } else {
        &data[s as usize..e as usize]
    }
}

fn fixed_name(raw: &[u8]) -> String {
    let mut end = raw.len();
    while end > 0 && raw[end - 1] == 0 {
        end -= 1;
    }
    raw[..end].iter().map(|&b| if b < 0x80 { b as char } else { '\u{fffd}' }).collect()
}

fn read_cstring(table: &[u8], offset: u64) -> Res<String> {
    if offset >= table.len() as u64 {
        return Err(format!("string offset {} is outside a {}-byte string table", hex(offset), table.len()));
    }
    let start = offset as usize;
    match table[start..].iter().position(|&b| b == 0) {
        Some(len) => Ok(String::from_utf8_lossy(&table[start..start + len]).into_owned()),
        None => Err(format!("string at {} has no terminating zero byte", hex(offset))),
    }
}

struct ElfHeader {
    osabi: u8,
    e_type: u16,
    e_machine: u16,
    e_entry: u64,
    e_phoff: u64,
    e_shoff: u64,
    e_phentsize: u16,
    e_phnum: u16,
    e_shentsize: u16,
    e_shnum: u16,
    e_shstrndx: u16,
}

impl ElfHeader {
    fn type_name(&self) -> String {
        e_type_name(self.e_type).map(String::from).unwrap_or_else(|| hex(self.e_type as u64))
    }

    fn machine_name(&self) -> String {
        e_machine_name(self.e_machine).map(String::from).unwrap_or_else(|| hex(self.e_machine as u64))
    }
}

#[derive(Clone)]
struct Section {
    index: usize,
    name: String,
    sh_type: u32,
    sh_flags: u64,
    sh_addr: u64,
    sh_offset: u64,
    sh_size: u64,
    sh_link: u32,
    sh_info: u32,
    sh_addralign: u64,
    sh_entsize: u64,
}

impl Section {
    fn type_name(&self) -> String {
        sht_name(self.sh_type).map(String::from).unwrap_or_else(|| hex(self.sh_type as u64))
    }

    fn flags_text(&self) -> String {
        SHF.iter().filter(|(bit, _)| self.sh_flags & bit != 0).map(|(_, l)| *l).collect()
    }

    fn file_size(&self) -> u64 {
        if self.sh_type == SHT_NOBITS {
            0
        } else {
            self.sh_size
        }
    }

    #[allow(dead_code)]
    fn objdump_kind(&self) -> &'static str {
        if self.sh_flags & SHF_EXECINSTR != 0 {
            "TEXT"
        } else if self.sh_flags & SHF_ALLOC != 0 && self.sh_type == SHT_NOBITS {
            "BSS"
        } else if self.sh_flags & SHF_ALLOC != 0 {
            "DATA"
        } else {
            ""
        }
    }
}

struct Symbol {
    index: usize,
    name: String,
    st_info: u8,
    st_other: u8,
    st_shndx: u16,
    st_value: u64,
    st_size: u64,
    section_name: String,
}

impl Symbol {
    fn bind(&self) -> String {
        let v = self.st_info >> 4;
        stb_name(v).map(String::from).unwrap_or_else(|| v.to_string())
    }

    fn type_(&self) -> String {
        let v = self.st_info & 0xF;
        stt_name(v).map(String::from).unwrap_or_else(|| v.to_string())
    }

    #[allow(dead_code)]
    fn visibility(&self) -> String {
        let v = self.st_other & 0x3;
        stv_name(v).map(String::from).unwrap_or_else(|| v.to_string())
    }

    fn display_name(&self) -> String {
        if self.st_info & 0xF == STT_SECTION && self.name.is_empty() {
            self.section_name.clone()
        } else {
            self.name.clone()
        }
    }
}

struct Relocation {
    table: String,
    target_section: String,
    r_offset: u64,
    type_name: String,
    symbol: String,
    r_addend: i64,
}

impl Relocation {
    fn value_text(&self) -> String {
        if self.r_addend > 0 {
            format!("{}+{}", self.symbol, hex(self.r_addend as u64))
        } else if self.r_addend < 0 {
            format!("{}-{}", self.symbol, hex(self.r_addend.unsigned_abs()))
        } else {
            self.symbol.clone()
        }
    }
}

struct ProgramHeader {
    p_type: u32,
    p_flags: u32,
    p_offset: u64,
    p_vaddr: u64,
    p_filesz: u64,
    p_memsz: u64,
    p_align: u64,
}

impl ProgramHeader {
    fn type_name(&self) -> String {
        pt_name(self.p_type).map(String::from).unwrap_or_else(|| hex(self.p_type as u64))
    }

    fn flags_text(&self) -> String {
        let f = |bit: u32, c: char| if self.p_flags & bit != 0 { c } else { '-' };
        [f(4, 'r'), f(2, 'w'), f(1, 'x')].iter().collect()
    }
}

struct Span {
    file_offset: u64,
    size: u64,
}

struct Region {
    name: String,
    kind: &'static str,
    offset: u64,
    size: u64,
}

struct ElfFile {
    data: Vec<u8>,
    header: ElfHeader,
    sections: Vec<Section>,
    program_headers: Vec<ProgramHeader>,
    symbols: Vec<Symbol>,
    relocations: Vec<Relocation>,
}

impl ElfFile {
    fn new(data: Vec<u8>) -> Res<ElfFile> {
        let header = read_elf_header(&data)?;
        let mut elf = ElfFile { data, header, sections: vec![], program_headers: vec![], symbols: vec![], relocations: vec![] };
        elf.sections = elf.read_sections()?;
        elf.program_headers = elf.read_program_headers()?;
        elf.symbols = elf.read_symbols()?;
        elf.relocations = elf.read_relocations()?;
        Ok(elf)
    }

    fn from_path(path: &Path) -> Res<ElfFile> {
        ElfFile::new(fs::read(path).map_err(|e| format!("{}: {}", path.display(), e))?)
    }

    fn table(&self, offset: u64, count: u64, entry_size: u64, what: &str) -> Res<&[u8]> {
        let end = offset as u128 + count as u128 * entry_size as u128;
        if end > self.data.len() as u128 {
            return Err(format!("{} ends at 0x{:x}, past the {}-byte file", what, end, self.data.len()));
        }
        Ok(&self.data[offset as usize..end as usize])
    }

    fn read_sections(&self) -> Res<Vec<Section>> {
        let h = &self.header;
        if h.e_shoff == 0 || h.e_shnum == 0 {
            return Ok(vec![]);
        }
        let raw = self.table(h.e_shoff, h.e_shnum as u64, SHDR_SIZE, "section header table")?;
        let mut rows = Vec::new();
        for i in 0..h.e_shnum as u64 {
            let b = i * SHDR_SIZE;
            rows.push((
                u32_at(raw, b)?,
                u32_at(raw, b + 4)?,
                u64_at(raw, b + 8)?,
                u64_at(raw, b + 16)?,
                u64_at(raw, b + 24)?,
                u64_at(raw, b + 32)?,
                u32_at(raw, b + 40)?,
                u32_at(raw, b + 44)?,
                u64_at(raw, b + 48)?,
                u64_at(raw, b + 56)?,
            ));
        }
        if h.e_shstrndx >= h.e_shnum {
            return Err(format!("e_shstrndx {} is outside the {} section headers", h.e_shstrndx, h.e_shnum));
        }
        let shstr = rows[h.e_shstrndx as usize];
        let strtab = slice_clamped(&self.data, shstr.4, shstr.5);
        let mut out = Vec::new();
        for (index, r) in rows.iter().enumerate() {
            out.push(Section {
                index,
                name: read_cstring(strtab, r.0 as u64)?,
                sh_type: r.1,
                sh_flags: r.2,
                sh_addr: r.3,
                sh_offset: r.4,
                sh_size: r.5,
                sh_link: r.6,
                sh_info: r.7,
                sh_addralign: r.8,
                sh_entsize: r.9,
            });
        }
        Ok(out)
    }

    fn section(&self, name: &str) -> Res<&Section> {
        self.sections.iter().find(|s| s.name == name).ok_or_else(|| format!("no section named {}", py_str_repr(name)))
    }

    fn section_bytes(&self, section: &Section) -> &[u8] {
        if section.sh_type == SHT_NOBITS {
            return &[];
        }
        slice_clamped(&self.data, section.sh_offset, section.sh_size)
    }

    fn section_name_for_index(&self, shndx: u64) -> String {
        if shndx == SHN_UNDEF as u64 {
            return "*UND*".into();
        }
        if shndx == SHN_ABS as u64 {
            return "*ABS*".into();
        }
        if shndx == SHN_COMMON as u64 {
            return "*COM*".into();
        }
        if shndx >= SHN_LORESERVE as u64 || shndx >= self.sections.len() as u64 {
            return hex(shndx);
        }
        self.sections[shndx as usize].name.clone()
    }

    fn read_program_headers(&self) -> Res<Vec<ProgramHeader>> {
        let h = &self.header;
        if h.e_phoff == 0 || h.e_phnum == 0 {
            return Ok(vec![]);
        }
        let raw = self.table(h.e_phoff, h.e_phnum as u64, PHDR_SIZE, "program header table")?;
        let mut out = Vec::new();
        for i in 0..h.e_phnum as u64 {
            let b = i * PHDR_SIZE;
            out.push(ProgramHeader {
                p_type: u32_at(raw, b)?,
                p_flags: u32_at(raw, b + 4)?,
                p_offset: u64_at(raw, b + 8)?,
                p_vaddr: u64_at(raw, b + 16)?,
                p_filesz: u64_at(raw, b + 32)?,
                p_memsz: u64_at(raw, b + 40)?,
                p_align: u64_at(raw, b + 48)?,
            });
        }
        Ok(out)
    }

    fn read_symbols(&self) -> Res<Vec<Symbol>> {
        let symtab = match self.sections.iter().find(|s| s.sh_type == SHT_SYMTAB) {
            Some(s) => s,
            None => return Ok(vec![]),
        };
        if symtab.sh_entsize != 0 && symtab.sh_entsize != SYM_SIZE {
            return Err(format!(".symtab sh_entsize is {}, expected {}", symtab.sh_entsize, SYM_SIZE));
        }
        let raw = self.section_bytes(symtab);
        let strtab_section = self.sections.get(symtab.sh_link as usize).ok_or("list index out of range")?;
        let strtab = self.section_bytes(strtab_section);
        let mut out = Vec::new();
        for index in 0..raw.len() as u64 / SYM_SIZE {
            let b = index * SYM_SIZE;
            let st_name = u32_at(raw, b)?;
            let st_shndx = u16_at(raw, b + 6)?;
            out.push(Symbol {
                index: index as usize,
                name: read_cstring(strtab, st_name as u64)?,
                st_info: u8_at(raw, b + 4)?,
                st_other: u8_at(raw, b + 5)?,
                st_shndx,
                st_value: u64_at(raw, b + 8)?,
                st_size: u64_at(raw, b + 16)?,
                section_name: self.section_name_for_index(st_shndx as u64),
            });
        }
        Ok(out)
    }

    fn symbol(&self, name: &str) -> Res<&Symbol> {
        self.symbols.iter().find(|s| s.name == name).ok_or_else(|| format!("no symbol named {}", py_str_repr(name)))
    }

    fn read_relocations(&self) -> Res<Vec<Relocation>> {
        let mut out = Vec::new();
        for section in &self.sections {
            if section.sh_type != SHT_RELA {
                continue;
            }
            if section.sh_entsize != 0 && section.sh_entsize != RELA_SIZE {
                return Err(format!("{} sh_entsize is {}, expected {}", section.name, section.sh_entsize, RELA_SIZE));
            }
            let target = self.section_name_for_index(section.sh_info as u64);
            let raw = self.section_bytes(section);
            for i in 0..raw.len() as u64 / RELA_SIZE {
                let b = i * RELA_SIZE;
                let r_offset = u64_at(raw, b)?;
                let r_info = u64_at(raw, b + 8)?;
                let r_addend = i64_at(raw, b + 16)?;
                let sym_index = r_info >> 32;
                let r_type = r_info & 0xFFFF_FFFF;
                let symbol = match self.symbols.get(sym_index as usize) {
                    Some(s) => s.display_name(),
                    None => hex(sym_index),
                };
                let type_name = relocation_name(self.header.e_machine, r_type)
                    .map(String::from)
                    .unwrap_or_else(|| format!("R_{}", r_type));
                out.push(Relocation {
                    table: section.name.clone(),
                    target_section: target.clone(),
                    r_offset,
                    type_name,
                    symbol,
                    r_addend,
                });
            }
        }
        Ok(out)
    }

    fn relocations_for(&self, target: &str) -> Vec<&Relocation> {
        self.relocations.iter().filter(|r| r.target_section == target).collect()
    }

    fn function_span(&self, name: &str) -> Res<Span> {
        let symbol = self.symbol(name)?;
        if symbol.st_info & 0xF != STT_FUNC {
            return Err(format!("{} is a {} symbol, not a FUNC", py_str_repr(name), symbol.type_()));
        }
        if symbol.st_shndx == SHN_UNDEF || symbol.st_shndx >= SHN_LORESERVE {
            return Err(format!(
                "{} has no section in this file (st_shndx {})",
                py_str_repr(name),
                hex(symbol.st_shndx as u64)
            ));
        }
        let section = self
            .sections
            .get(symbol.st_shndx as usize)
            .ok_or_else(|| format!("IndexError: section {} out of range", symbol.st_shndx))?;
        if symbol.st_value < section.sh_addr {
            return Err(format!("{} starts before {}", py_str_repr(name), section.name));
        }
        let rel = symbol.st_value - section.sh_addr;
        if rel.saturating_add(symbol.st_size) > section.sh_size {
            return Err(format!("{} runs past the end of {}", py_str_repr(name), section.name));
        }
        Ok(Span { file_offset: section.sh_offset + rel, size: symbol.st_size })
    }

    fn function_bytes(&self, name: &str) -> Res<&[u8]> {
        let span = self.function_span(name)?;
        Ok(slice_clamped(&self.data, span.file_offset, span.size))
    }

    fn address_to_file_offset(&self, address: u64) -> Res<u64> {
        if self.header.e_type == 1 {
            return Err("relocatable object: every address is relative to its section, use function_span".into());
        }
        for ph in &self.program_headers {
            if ph.p_type == PT_LOAD && ph.p_vaddr <= address && address < ph.p_vaddr + ph.p_filesz {
                return Ok(ph.p_offset + (address - ph.p_vaddr));
            }
        }
        for s in &self.sections {
            if s.sh_flags & SHF_ALLOC == 0 || s.sh_type == SHT_NOBITS {
                continue;
            }
            if s.sh_addr <= address && address < s.sh_addr + s.sh_size {
                return Ok(s.sh_offset + (address - s.sh_addr));
            }
        }
        Err(format!("address {} is in no PT_LOAD segment and no allocated section", hex(address)))
    }

    fn file_offset_map(&self) -> Res<Vec<Region>> {
        let h = &self.header;
        let mut regions = vec![Region { name: "ELF header".into(), kind: "header", offset: 0, size: EHDR_SIZE }];
        if h.e_phnum != 0 {
            regions.push(Region {
                name: "program header table".into(),
                kind: "table",
                offset: h.e_phoff,
                size: h.e_phnum as u64 * PHDR_SIZE,
            });
        }
        for s in &self.sections {
            if s.index == 0 || s.file_size() == 0 {
                continue;
            }
            regions.push(Region { name: s.name.clone(), kind: "section", offset: s.sh_offset, size: s.file_size() });
        }
        if h.e_shnum != 0 {
            regions.push(Region {
                name: "section header table".into(),
                kind: "table",
                offset: h.e_shoff,
                size: h.e_shnum as u64 * SHDR_SIZE,
            });
        }
        regions.sort_by_key(|r| (r.offset, r.size));
        let mut filled = Vec::new();
        let mut cursor = 0u64;
        let len = self.data.len() as u64;
        for region in regions {
            if region.offset < cursor {
                return Err(format!("{} at {} overlaps the region before it", region.name, hex(region.offset)));
            }
            if region.offset > cursor {
                filled.push(Region { name: "inactive space".into(), kind: "gap", offset: cursor, size: region.offset - cursor });
            }
            cursor = region.offset + region.size;
            filled.push(region);
        }
        if cursor < len {
            filled.push(Region { name: "inactive space".into(), kind: "gap", offset: cursor, size: len - cursor });
        }
        if cursor > len {
            return Err(format!("structures end at {}, past the {}-byte file", hex(cursor), len));
        }
        Ok(filled)
    }
}

fn read_elf_header(data: &[u8]) -> Res<ElfHeader> {
    if (data.len() as u64) < EHDR_SIZE {
        return Err(format!("file is {} bytes, shorter than the 64-byte ELF header", data.len()));
    }
    if &data[..4] != ELF_MAGIC {
        return Err(format!("magic is {}, expected {}", py_bytes_repr(&data[..4]), py_bytes_repr(ELF_MAGIC)));
    }
    if data[4] != ELFCLASS64 {
        return Err(format!("EI_CLASS is {}, this reader handles ELFCLASS64 (2) only", data[4]));
    }
    if data[5] != ELFDATA2LSB {
        return Err(format!("EI_DATA is {}, this reader handles ELFDATA2LSB (1) only", data[5]));
    }
    let h = ElfHeader {
        osabi: data[7],
        e_type: u16_at(data, 16)?,
        e_machine: u16_at(data, 18)?,
        e_entry: u64_at(data, 24)?,
        e_phoff: u64_at(data, 32)?,
        e_shoff: u64_at(data, 40)?,
        e_phentsize: u16_at(data, 54)?,
        e_phnum: u16_at(data, 56)?,
        e_shentsize: u16_at(data, 58)?,
        e_shnum: u16_at(data, 60)?,
        e_shstrndx: u16_at(data, 62)?,
    };
    if h.e_shnum != 0 && h.e_shentsize as u64 != SHDR_SIZE {
        return Err(format!("e_shentsize is {}, expected {}", h.e_shentsize, SHDR_SIZE));
    }
    if h.e_phnum != 0 && h.e_phentsize as u64 != PHDR_SIZE {
        return Err(format!("e_phentsize is {}, expected {}", h.e_phentsize, PHDR_SIZE));
    }
    Ok(h)
}

const MH_MAGIC_64: u32 = 0xFEEDFACF;
const MH_CIGAM_64: u32 = 0xCFFAEDFE;
const MH_MAGIC_32: u32 = 0xFEEDFACE;
const FAT_MAGIC: u32 = 0xCAFEBABE;
const MACH_HEADER_64_SIZE: u64 = 32;
const LC_REQ_DYLD: u32 = 0x80000000;
const LC_SEGMENT_64: u32 = 0x19;
const LC_SYMTAB: u32 = 0x2;
const LC_BUILD_VERSION: u32 = 0x32;
const N_STAB: u8 = 0xE0;
const N_TYPE: u8 = 0x0E;
const N_EXT: u8 = 0x01;
const N_SECT: u8 = 0xE;
const MH_FLAGS: [(u32, &str); 6] = [
    (0x1, "MH_NOUNDEFS"),
    (0x4, "MH_DYLDLINK"),
    (0x80, "MH_TWOLEVEL"),
    (0x2000, "MH_SUBSECTIONS_VIA_SYMBOLS"),
    (0x200000, "MH_PIE"),
    (0x800000, "MH_HAS_TLV_DESCRIPTORS"),
];

fn cpu_type_name(v: u32) -> Option<&'static str> {
    Some(match v {
        0x01000007 => "CPU_TYPE_X86_64",
        0x0100000C => "CPU_TYPE_ARM64",
        7 => "CPU_TYPE_X86",
        12 => "CPU_TYPE_ARM",
        _ => return None,
    })
}

fn mh_filetype_name(v: u32) -> Option<&'static str> {
    Some(match v {
        0x1 => "MH_OBJECT",
        0x2 => "MH_EXECUTE",
        0x3 => "MH_FVMLIB",
        0x4 => "MH_CORE",
        0x5 => "MH_PRELOAD",
        0x6 => "MH_DYLIB",
        0x7 => "MH_DYLINKER",
        0x8 => "MH_BUNDLE",
        0x9 => "MH_DYLIB_STUB",
        0xA => "MH_DSYM",
        0xB => "MH_KEXT_BUNDLE",
        0xC => "MH_FILESET",
        _ => return None,
    })
}

fn lc_name(v: u32) -> Option<&'static str> {
    Some(match v {
        0x1 => "LC_SEGMENT",
        0x2 => "LC_SYMTAB",
        0x5 => "LC_UNIXTHREAD",
        0xB => "LC_DYSYMTAB",
        0xC => "LC_LOAD_DYLIB",
        0xD => "LC_ID_DYLIB",
        0xE => "LC_LOAD_DYLINKER",
        0x19 => "LC_SEGMENT_64",
        0x1B => "LC_UUID",
        x if x == 0x1C | LC_REQ_DYLD => "LC_RPATH",
        0x1D => "LC_CODE_SIGNATURE",
        0x22 => "LC_DYLD_INFO",
        x if x == 0x22 | LC_REQ_DYLD => "LC_DYLD_INFO_ONLY",
        0x26 => "LC_FUNCTION_STARTS",
        x if x == 0x28 | LC_REQ_DYLD => "LC_MAIN",
        0x29 => "LC_DATA_IN_CODE",
        0x2A => "LC_SOURCE_VERSION",
        0x2E => "LC_LINKER_OPTIMIZATION_HINT",
        0x32 => "LC_BUILD_VERSION",
        x if x == 0x33 | LC_REQ_DYLD => "LC_DYLD_EXPORTS_TRIE",
        x if x == 0x34 | LC_REQ_DYLD => "LC_DYLD_CHAINED_FIXUPS",
        _ => return None,
    })
}

fn platform_name(v: u32) -> Option<&'static str> {
    Some(match v {
        1 => "macos",
        2 => "ios",
        3 => "tvos",
        4 => "watchos",
        5 => "bridgeos",
        6 => "maccatalyst",
        7 => "iossimulator",
        _ => return None,
    })
}

fn section_type_name(v: u32) -> Option<&'static str> {
    Some(match v {
        0x0 => "S_REGULAR",
        0x1 => "S_ZEROFILL",
        0x2 => "S_CSTRING_LITERALS",
        0x6 => "S_NON_LAZY_SYMBOL_POINTERS",
        0x7 => "S_LAZY_SYMBOL_POINTERS",
        0x8 => "S_SYMBOL_STUBS",
        0x9 => "S_MOD_INIT_FUNC_POINTERS",
        0x16 => "S_INIT_FUNC_OFFSETS",
        _ => return None,
    })
}

fn n_type_name(v: u8) -> Option<&'static str> {
    Some(match v {
        0x0 => "N_UNDF",
        0x2 => "N_ABS",
        0xA => "N_INDR",
        0xC => "N_PBUD",
        0xE => "N_SECT",
        _ => return None,
    })
}

fn arm64_reloc_name(v: u32) -> Option<&'static str> {
    Some(match v {
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
        11 => "ARM64_RELOC_AUTHENTICATED_POINTER",
        _ => return None,
    })
}

struct MachHeader {
    magic: u32,
    cputype: u32,
    filetype: u32,
    ncmds: u32,
    sizeofcmds: u32,
    flags: u32,
}

impl MachHeader {
    fn cputype_name(&self) -> String {
        cpu_type_name(self.cputype).map(String::from).unwrap_or_else(|| hex(self.cputype as u64))
    }

    fn filetype_name(&self) -> String {
        mh_filetype_name(self.filetype).map(String::from).unwrap_or_else(|| hex(self.filetype as u64))
    }

    fn flags_text(&self) -> String {
        MH_FLAGS.iter().filter(|(bit, _)| self.flags & bit != 0).map(|(_, n)| *n).collect::<Vec<_>>().join(" ")
    }
}

struct LoadCommand {
    index: usize,
    cmd: u32,
    cmdsize: u32,
    offset: u64,
}

impl LoadCommand {
    fn name(&self) -> String {
        lc_name(self.cmd).map(String::from).unwrap_or_else(|| hex(self.cmd as u64))
    }
}

#[derive(Clone)]
struct MachSection {
    index: usize,
    sectname: String,
    segname: String,
    addr: u64,
    size: u64,
    offset: u32,
    reloff: u32,
    nreloc: u32,
    flags: u32,
}

impl MachSection {
    fn type_name(&self) -> String {
        let t = self.flags & 0xFF;
        section_type_name(t).map(String::from).unwrap_or_else(|| hex(t as u64))
    }

    fn qualified_name(&self) -> String {
        format!("{},{}", self.segname, self.sectname)
    }
}

struct Segment {
    segname: String,
    vmaddr: u64,
    vmsize: u64,
    fileoff: u64,
    filesize: u64,
    nsects: u32,
    sections: Vec<MachSection>,
}

struct SymtabCommand {
    symoff: u32,
    nsyms: u32,
    stroff: u32,
    strsize: u32,
}

struct BuildVersion {
    platform: u32,
    minos: String,
    sdk: String,
}

struct Nlist {
    index: usize,
    name: String,
    n_type: u8,
    n_sect: u8,
    n_value: u64,
    section_name: String,
}

impl Nlist {
    fn external(&self) -> bool {
        self.n_type & N_EXT != 0
    }

    fn type_name(&self) -> String {
        if self.n_type & N_STAB != 0 {
            return "N_STAB".into();
        }
        let t = self.n_type & N_TYPE;
        n_type_name(t).map(String::from).unwrap_or_else(|| hex(t as u64))
    }
}

struct MachRelocation {
    section: String,
    r_address: i32,
    r_pcrel: bool,
    r_length: u32,
    type_name: String,
    symbol: String,
}

fn version_text(packed: u32) -> String {
    let (major, minor, patch) = (packed >> 16, (packed >> 8) & 0xFF, packed & 0xFF);
    if patch == 0 {
        format!("{}.{}", major, minor)
    } else {
        format!("{}.{}.{}", major, minor, patch)
    }
}

struct MachOFile {
    data: Vec<u8>,
    header: MachHeader,
    load_commands: Vec<LoadCommand>,
    segments: Vec<Segment>,
    sections: Vec<MachSection>,
    symtab_command: Option<SymtabCommand>,
    build_version: Option<BuildVersion>,
    symbols: Vec<Nlist>,
    relocations: Vec<MachRelocation>,
}

impl MachOFile {
    fn new(data: Vec<u8>) -> Res<MachOFile> {
        let header = read_mach_header(&data)?;
        let mut m = MachOFile {
            data,
            header,
            load_commands: vec![],
            segments: vec![],
            sections: vec![],
            symtab_command: None,
            build_version: None,
            symbols: vec![],
            relocations: vec![],
        };
        m.load_commands = m.read_load_commands()?;
        m.segments = m.read_segments()?;
        m.sections = m.segments.iter().flat_map(|s| s.sections.clone()).collect();
        m.symtab_command = m.read_symtab_command()?;
        m.build_version = m.read_build_version()?;
        m.symbols = m.read_symbols()?;
        m.relocations = m.read_relocations()?;
        Ok(m)
    }

    fn from_path(path: &Path) -> Res<MachOFile> {
        MachOFile::new(fs::read(path).map_err(|e| format!("{}: {}", path.display(), e))?)
    }

    fn read_load_commands(&self) -> Res<Vec<LoadCommand>> {
        let mut commands = Vec::new();
        let mut offset = MACH_HEADER_64_SIZE;
        let end = MACH_HEADER_64_SIZE + self.header.sizeofcmds as u64;
        if end > self.data.len() as u64 {
            return Err(format!("load commands end at {}, past the {}-byte file", hex(end), self.data.len()));
        }
        for index in 0..self.header.ncmds as usize {
            if offset + 8 > end {
                return Err(format!("load command {} starts past sizeofcmds", index));
            }
            let cmd = u32_at(&self.data, offset)?;
            let cmdsize = u32_at(&self.data, offset + 4)?;
            if cmdsize < 8 || offset + cmdsize as u64 > end {
                return Err(format!("load command {} has cmdsize {}", index, cmdsize));
            }
            commands.push(LoadCommand { index, cmd, cmdsize, offset });
            offset += cmdsize as u64;
        }
        Ok(commands)
    }

    fn read_segments(&self) -> Res<Vec<Segment>> {
        let d = &self.data;
        let mut segments = Vec::new();
        let mut section_index = 1;
        for command in &self.load_commands {
            if command.cmd != LC_SEGMENT_64 {
                continue;
            }
            let b = command.offset + 8;
            let nsects = u32_at(d, b + 56)?;
            let mut sections = Vec::new();
            let mut cursor = command.offset + 72;
            for _ in 0..nsects {
                sections.push(MachSection {
                    index: section_index,
                    sectname: fixed_name(bytes_at(d, cursor, 16)?),
                    segname: fixed_name(bytes_at(d, cursor + 16, 16)?),
                    addr: u64_at(d, cursor + 32)?,
                    size: u64_at(d, cursor + 40)?,
                    offset: u32_at(d, cursor + 48)?,
                    reloff: u32_at(d, cursor + 56)?,
                    nreloc: u32_at(d, cursor + 60)?,
                    flags: u32_at(d, cursor + 64)?,
                });
                u32_at(d, cursor + 76)?;
                section_index += 1;
                cursor += 80;
            }
            segments.push(Segment {
                segname: fixed_name(bytes_at(d, b, 16)?),
                vmaddr: u64_at(d, b + 16)?,
                vmsize: u64_at(d, b + 24)?,
                fileoff: u64_at(d, b + 32)?,
                filesize: u64_at(d, b + 40)?,
                nsects,
                sections,
            });
        }
        Ok(segments)
    }

    fn read_symtab_command(&self) -> Res<Option<SymtabCommand>> {
        for c in &self.load_commands {
            if c.cmd == LC_SYMTAB {
                let b = c.offset + 8;
                return Ok(Some(SymtabCommand {
                    symoff: u32_at(&self.data, b)?,
                    nsyms: u32_at(&self.data, b + 4)?,
                    stroff: u32_at(&self.data, b + 8)?,
                    strsize: u32_at(&self.data, b + 12)?,
                }));
            }
        }
        Ok(None)
    }

    fn read_build_version(&self) -> Res<Option<BuildVersion>> {
        for c in &self.load_commands {
            if c.cmd == LC_BUILD_VERSION {
                let b = c.offset + 8;
                return Ok(Some(BuildVersion {
                    platform: u32_at(&self.data, b)?,
                    minos: version_text(u32_at(&self.data, b + 4)?),
                    sdk: version_text(u32_at(&self.data, b + 8)?),
                }));
            }
        }
        Ok(None)
    }

    fn section_name_for_ordinal(&self, n_sect: u8) -> String {
        if n_sect == 0 || n_sect as usize > self.sections.len() {
            return "*UND*".into();
        }
        self.sections[n_sect as usize - 1].qualified_name()
    }

    fn read_symbols(&self) -> Res<Vec<Nlist>> {
        let cmd = match &self.symtab_command {
            Some(c) => c,
            None => return Ok(vec![]),
        };
        let strtab = slice_clamped(&self.data, cmd.stroff as u64, cmd.strsize as u64);
        let mut out = Vec::new();
        for index in 0..cmd.nsyms as u64 {
            let b = cmd.symoff as u64 + index * 16;
            let n_strx = u32_at(&self.data, b)?;
            let n_sect = u8_at(&self.data, b + 5)?;
            let name = if n_strx != 0 { read_cstring(strtab, n_strx as u64)? } else { String::new() };
            out.push(Nlist {
                index: index as usize,
                name,
                n_type: u8_at(&self.data, b + 4)?,
                n_sect,
                n_value: u64_at(&self.data, b + 8)?,
                section_name: self.section_name_for_ordinal(n_sect),
            });
        }
        Ok(out)
    }

    fn read_relocations(&self) -> Res<Vec<MachRelocation>> {
        let mut out = Vec::new();
        for section in &self.sections {
            for i in 0..section.nreloc as u64 {
                let b = section.reloff as u64 + i * 8;
                let r_address = i32_at(&self.data, b)?;
                let bits = u32_at(&self.data, b + 4)?;
                let symnum = bits & 0xFFFFFF;
                let extern_ = (bits >> 27) & 1 == 1;
                let r_type = (bits >> 28) & 0xF;
                let symbol = if extern_ {
                    match self.symbols.get(symnum as usize) {
                        Some(s) => s.name.clone(),
                        None => hex(symnum as u64),
                    }
                } else if symnum > 0 && symnum as usize <= self.sections.len() {
                    self.sections[symnum as usize - 1].sectname.clone()
                } else {
                    hex(symnum as u64)
                };
                out.push(MachRelocation {
                    section: section.qualified_name(),
                    r_address,
                    r_pcrel: (bits >> 24) & 1 == 1,
                    r_length: (bits >> 25) & 3,
                    type_name: arm64_reloc_name(r_type).map(String::from).unwrap_or_else(|| format!("R_{}", r_type)),
                    symbol,
                });
            }
        }
        Ok(out)
    }

    fn symbol(&self, name: &str) -> Res<&Nlist> {
        self.symbols.iter().find(|s| s.name == name).ok_or_else(|| format!("no symbol named {}", py_str_repr(name)))
    }

    fn function_span(&self, name: &str) -> Res<Span> {
        let symbol = self.symbol(name)?;
        if symbol.n_type & N_TYPE != N_SECT {
            return Err(format!("{} is {}, not defined in a section", py_str_repr(name), symbol.type_name()));
        }
        let index = symbol.n_sect as usize;
        if index < 1 || index > self.sections.len() {
            return Err(format!("{} names section {}, but the file has {} sections", py_str_repr(name), index, self.sections.len()));
        }
        let section = &self.sections[index - 1];
        if symbol.n_value < section.addr {
            return Err(format!("{} at {:#x} is below its section start {:#x}", py_str_repr(name), symbol.n_value, section.addr));
        }
        let end = self
            .symbols
            .iter()
            .filter(|s| s.n_sect == symbol.n_sect && s.n_value > symbol.n_value)
            .map(|s| s.n_value)
            .min()
            .unwrap_or(section.addr + section.size);
        Ok(Span { file_offset: section.offset as u64 + (symbol.n_value - section.addr), size: end - symbol.n_value })
    }
}

fn read_mach_header(data: &[u8]) -> Res<MachHeader> {
    if (data.len() as u64) < MACH_HEADER_64_SIZE {
        return Err(format!("file is {} bytes, shorter than the 32-byte mach_header_64", data.len()));
    }
    let magic = u32_at(data, 0)?;
    if magic == FAT_MAGIC || magic == 0xBEBAFECA {
        return Err("universal (fat) Mach-O: extract one slice first".into());
    }
    if magic == MH_MAGIC_32 {
        return Err("32-bit Mach-O: this reader handles MH_MAGIC_64 only".into());
    }
    if magic == MH_CIGAM_64 {
        return Err("big-endian Mach-O: this reader handles little-endian files only".into());
    }
    if magic != MH_MAGIC_64 {
        return Err(format!("magic is {}, expected {}", hex(magic as u64), hex(MH_MAGIC_64 as u64)));
    }
    Ok(MachHeader {
        magic,
        cputype: u32_at(data, 4)?,
        filetype: u32_at(data, 12)?,
        ncmds: u32_at(data, 16)?,
        sizeofcmds: u32_at(data, 20)?,
        flags: u32_at(data, 24)?,
    })
}

fn render_elf(elf: &ElfFile) -> Res<String> {
    let h = &elf.header;
    let osabi = osabi_name(h.osabi).map(String::from).unwrap_or_else(|| h.osabi.to_string());
    let mut lines = vec![
        format!("ELF header: {} {} osabi={} entry={}", h.type_name(), h.machine_name(), osabi, hex(h.e_entry)),
        format!("  program headers: {} x {} bytes at {}", h.e_phnum, h.e_phentsize, hex(h.e_phoff)),
        format!(
            "  section headers: {} x {} bytes at {}, names in section {}",
            h.e_shnum,
            h.e_shentsize,
            hex(h.e_shoff),
            h.e_shstrndx
        ),
        String::new(),
        "Sections:".into(),
        format!(
            "{:>3} {:<16} {:<12} {:<5} {:>8} {:>8} {:>10} {:>4} {:>4} {:>5}",
            "Idx", "Name", "Type", "Flags", "Offset", "Size", "Addr", "Link", "Info", "Align"
        ),
    ];
    for s in &elf.sections {
        lines.push(format!(
            "{:>3} {:<16} {:<12} {:<5} {:>8} {:>8} {:>10} {:>4} {:>4} {:>5}",
            s.index,
            s.name,
            s.type_name(),
            s.flags_text(),
            hex(s.sh_offset),
            hex(s.sh_size),
            hex(s.sh_addr),
            s.sh_link,
            s.sh_info,
            s.sh_addralign
        ));
    }
    if !elf.program_headers.is_empty() {
        lines.push(String::new());
        lines.push("Program headers:".into());
        for p in &elf.program_headers {
            lines.push(format!(
                "  {:<16} {} offset={} vaddr={} filesz={} memsz={} align={}",
                p.type_name(),
                p.flags_text(),
                hex(p.p_offset),
                hex(p.p_vaddr),
                hex(p.p_filesz),
                hex(p.p_memsz),
                hex(p.p_align)
            ));
        }
    }
    lines.push(String::new());
    lines.push("Symbols:".into());
    lines.push(format!("{:>3} {:>16} {:>6} {:<6} {:<7} {:<16} Name", "Idx", "Value", "Size", "Bind", "Type", "Section"));
    for sym in &elf.symbols {
        lines.push(format!(
            "{:>3} {:>16} {:>6} {:<6} {:<7} {:<16} {}",
            sym.index,
            hex(sym.st_value),
            sym.st_size,
            sym.bind(),
            sym.type_(),
            sym.section_name,
            sym.display_name()
        ));
    }
    if !elf.relocations.is_empty() {
        lines.push(String::new());
        lines.push("Relocations:".into());
        for r in &elf.relocations {
            lines.push(format!("  {:<14} {:>6} {:<22} {}", r.table, hex(r.r_offset), r.type_name, r.value_text()));
        }
    }
    lines.push(String::new());
    lines.push("File offset map:".into());
    for region in elf.file_offset_map()? {
        lines.push(format!("  {:>6} +{:<5} {:<8} {}", hex(region.offset), region.size, region.kind, region.name));
    }
    Ok(lines.join("\n"))
}

fn render_macho(m: &MachOFile) -> String {
    let h = &m.header;
    let mut lines = vec![
        format!(
            "mach_header_64: {} {} ncmds={} sizeofcmds={} flags={}",
            h.cputype_name(),
            h.filetype_name(),
            h.ncmds,
            h.sizeofcmds,
            h.flags_text()
        ),
        String::new(),
        "Load commands:".into(),
    ];
    for c in &m.load_commands {
        lines.push(format!("  {} {:<28} cmdsize={} at {}", c.index, c.name(), c.cmdsize, hex(c.offset)));
    }
    for seg in &m.segments {
        lines.push(String::new());
        lines.push(format!(
            "LC_SEGMENT_64 {}: vmaddr={} vmsize={} fileoff={} filesize={} nsects={}",
            py_str_repr(&seg.segname),
            hex(seg.vmaddr),
            hex(seg.vmsize),
            seg.fileoff,
            seg.filesize,
            seg.nsects
        ));
        lines.push(format!(
            "  {:>3} {:<24} {:>6} {:>6} {:>6} {:>6} {:>6} Type",
            "Idx", "Section", "Addr", "Size", "Offset", "Reloff", "Nreloc"
        ));
        for s in &seg.sections {
            lines.push(format!(
                "  {:>3} {:<24} {:>6} {:>6} {:>6} {:>6} {:>6} {}",
                s.index,
                s.qualified_name(),
                hex(s.addr),
                hex(s.size),
                s.offset,
                s.reloff,
                s.nreloc,
                s.type_name()
            ));
        }
    }
    if let Some(b) = &m.build_version {
        let platform = platform_name(b.platform).map(String::from).unwrap_or_else(|| b.platform.to_string());
        lines.push(String::new());
        lines.push(format!("LC_BUILD_VERSION: platform={} minos={} sdk={}", platform, b.minos, b.sdk));
    }
    if let Some(c) = &m.symtab_command {
        lines.push(String::new());
        lines.push(format!("LC_SYMTAB: symoff={} nsyms={} stroff={} strsize={}", c.symoff, c.nsyms, c.stroff, c.strsize));
        lines.push(format!("  {:>3} {:>6} {:<3} {:<6} {:<24} Name", "Idx", "Value", "Ext", "Type", "Section"));
        for sym in &m.symbols {
            lines.push(format!(
                "  {:>3} {:>6} {:<3} {:<6} {:<24} {}",
                sym.index,
                hex(sym.n_value),
                if sym.external() { "ext" } else { "loc" },
                sym.type_name(),
                sym.section_name,
                sym.name
            ));
        }
    }
    if !m.relocations.is_empty() {
        lines.push(String::new());
        lines.push("Relocations:".into());
        for r in &m.relocations {
            lines.push(format!(
                "  {:<18} {:>6} {:<28} pcrel={} len={} {}",
                r.section,
                hex_signed(r.r_address as i64),
                r.type_name,
                r.r_pcrel as u8,
                r.r_length,
                r.symbol
            ));
        }
    }
    lines.join("\n")
}

fn compare_formats(elf: &ElfFile, m: &MachOFile, function: &str) -> Res<Vec<(String, String, String)>> {
    let text = elf.section(".text")?;
    let symtab = elf.sections.iter().find(|s| s.sh_type == SHT_SYMTAB).ok_or("no .symtab")?;
    let strtab = &elf.sections[symtab.sh_link as usize];
    let rela_text = elf.relocations_for(".text");
    let mtext = m.sections.iter().find(|s| s.sectname == "__text").ok_or("no __text")?;
    let mcmd = m.symtab_command.as_ref().ok_or("no LC_SYMTAB")?;
    let espan = elf.function_span(function)?;
    let mspan = m.function_span(&format!("_{}", function))?;
    let segment = &m.segments[0];
    let elf_types: BTreeSet<String> = rela_text.iter().map(|r| r.type_name.clone()).collect();
    let mach_types: BTreeSet<String> = m
        .relocations
        .iter()
        .filter(|r| r.section == mtext.qualified_name())
        .map(|r| r.type_name.clone())
        .collect();
    let row = |a: &str, b: String, c: String| (a.to_string(), b, c);
    Ok(vec![
        row(
            "file identity",
            format!("e_ident {} class 64 data LSB", py_bytes_repr(ELF_MAGIC)),
            format!("magic {} (MH_MAGIC_64)", hex(m.header.magic as u64)),
        ),
        row(
            "machine",
            format!("e_machine {} ({})", elf.header.e_machine, elf.header.machine_name()),
            format!("cputype {} ({})", hex(m.header.cputype as u64), m.header.cputype_name()),
        ),
        row(
            "file kind",
            format!("e_type {} ({})", elf.header.e_type, elf.header.type_name()),
            format!("filetype {} ({})", m.header.filetype, m.header.filetype_name()),
        ),
        row(
            "where the tables are",
            format!("e_shoff {}, {} section headers", hex(elf.header.e_shoff), elf.header.e_shnum),
            format!("{} load commands, {} bytes after the header", m.header.ncmds, m.header.sizeofcmds),
        ),
        row(
            "the code",
            format!(
                "section .text: offset {}, size {}, flags {}",
                hex(text.sh_offset),
                hex(text.sh_size),
                text.flags_text()
            ),
            format!(
                "section {}: offset {}, size {}, in segment {}",
                mtext.qualified_name(),
                mtext.offset,
                hex(mtext.size),
                py_str_repr(&segment.segname)
            ),
        ),
        row(
            "symbol names",
            format!(".symtab (section {}) with names in {} (sh_link {})", symtab.index, strtab.name, symtab.sh_link),
            format!("LC_SYMTAB symoff {} nsyms {}, names at stroff {}", mcmd.symoff, mcmd.nsyms, mcmd.stroff),
        ),
        row(
            "symbol size",
            format!("st_size: {} = {} bytes", function, espan.size),
            format!("no size field in nlist_64: next symbol minus this one = {} bytes", mspan.size),
        ),
        row(
            "relocations",
            format!(".rela.text: {} Elf64_Rela, types {}", rela_text.len(), py_list_repr(&elf_types)),
            format!("__text reloff {} nreloc {}, types {}", mtext.reloff, mtext.nreloc, py_list_repr(&mach_types)),
        ),
        row(
            "function bytes",
            format!("{}: {} bytes at file offset {}", function, espan.size, hex(espan.file_offset)),
            format!("_{}: {} bytes at file offset {}", function, mspan.size, hex(mspan.file_offset)),
        ),
    ])
}

fn render_comparison(rows: &[(String, String, String)]) -> String {
    let width = rows.iter().map(|r| r.0.chars().count()).max().unwrap_or(0);
    let mut lines = Vec::new();
    for (concept, elf_text, macho_text) in rows {
        lines.push(format!("{:<w$}  ELF    {}", concept, elf_text, w = width));
        lines.push(format!("{:<w$}  Mach-O {}", "", macho_text, w = width));
    }
    lines.join("\n")
}

enum Parsed {
    Elf(ElfFile),
    MachO(MachOFile),
}

fn open_file(path: &str) -> Res<Parsed> {
    let data = fs::read(path).map_err(|e| format!("{}: {}", path, e))?;
    if data.len() >= 4 && &data[..4] == ELF_MAGIC {
        return Ok(Parsed::Elf(ElfFile::new(data)?));
    }
    if data.len() >= 4 {
        let magic = u32::from_le_bytes(data[..4].try_into().unwrap());
        if [MH_MAGIC_64, MH_CIGAM_64, MH_MAGIC_32, FAT_MAGIC].contains(&magic) {
            return Ok(Parsed::MachO(MachOFile::new(data)?));
        }
    }
    let first: String = data.iter().take(4).map(|b| format!("{:02x}", b)).collect();
    Err(format!("{}: not an ELF or Mach-O file (first bytes {})", path, first))
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

fn demo() -> Res<String> {
    let fixtures = fixtures_dir();
    let elf = ElfFile::from_path(&fixtures.join("ledger-x86_64-O1.o"))?;
    let macho = MachOFile::from_path(&fixtures.join("ledger-arm64-O1.o"))?;
    let tiny = ElfFile::from_path(&fixtures.join("tiny-x86_64"))?;
    let mut out = vec!["== ledger-x86_64-O1.o ==".to_string(), render_elf(&elf)?, String::new()];
    for name in ["percent_change", "grade", "total", "grade_label"] {
        let span = elf.function_span(name)?;
        out.push(format!(
            "{}: {} bytes at file offset {}: {}",
            name,
            span.size,
            hex(span.file_offset),
            hex_spaced(elf.function_bytes(name)?)
        ));
    }
    out.extend([String::new(), "== ledger-arm64-O1.o ==".into(), render_macho(&macho), String::new()]);
    out.extend([
        "== the same ideas in two formats ==".to_string(),
        render_comparison(&compare_formats(&elf, &macho, "percent_change")?),
        String::new(),
    ]);
    out.extend([
        "== tiny-x86_64 (an executable with program headers) ==".to_string(),
        render_elf(&tiny)?,
        String::new(),
    ]);
    let entry = tiny.header.e_entry;
    out.push(format!("entry {} is file offset {} through PT_LOAD", hex(entry), hex(tiny.address_to_file_offset(entry)?)));
    Ok(out.join("\n"))
}

fn run(args: &[String]) -> Res<()> {
    if args.is_empty() {
        println!("{}", demo()?);
        return Ok(());
    }
    for arg in args {
        let parsed = open_file(arg)?;
        println!("== {} ==", arg);
        match parsed {
            Parsed::Elf(e) => println!("{}", render_elf(&e)?),
            Parsed::MachO(m) => println!("{}", render_macho(&m)),
        }
    }
    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(e) = run(&args) {
        eprintln!("FormatError: {}", e);
        std::process::exit(1);
    }
}
