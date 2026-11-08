import json
import marshal
import re
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
SITE_MODULE = Path(__file__).resolve().parents[5] / "site" / "figures-re-43.js"
PYC_TAGS = ("cpython-311", "cpython-312", "cpython-313", "cpython-314")
RUNNING_TAG = f"cpython-{sys.version_info[0]}{sys.version_info[1]}"


class PycTests(unittest.TestCase):
    def test_pyc_headers_name_the_interpreter_that_wrote_them(self) -> None:
        expected = {"cpython-311": (3495, "a7 0d 0d 0a", 1054), "cpython-312": (3531, "cb 0d 0d 0a", 937), "cpython-313": (3571, "f3 0d 0d 0a", 943), "cpython-314": (3627, "2b 0e 0d 0a", 965)}
        for tag, (word, magic, size) in expected.items():
            pyc = main.load_pyc(f"ledger.{tag}.pyc")
            self.assertEqual((pyc.header.magic_word, main.hex_bytes(pyc.header.magic), len(pyc.data)), (word, magic, size), tag)
            self.assertEqual(pyc.header.version, "3." + tag[-2:])
            self.assertEqual(pyc.header.flags, 3)
            self.assertTrue(pyc.header.hash_based and pyc.header.check_source)
            self.assertEqual(len(pyc.header.source_hash), 8)

    def test_timestamp_headers_carry_the_source_mtime_and_size(self) -> None:
        for tag in PYC_TAGS:
            header = main.load_pyc(f"ledger.{tag}.timestamp.pyc").header
            self.assertEqual((header.flags, header.source_mtime, header.source_size, header.source_hash), (0, 1791975565, 497, None), tag)

    def test_magic_words_follow_the_2900_plus_50n_rule(self) -> None:
        for word, version in main.PYC_MAGIC_WORDS.items():
            minor = int(version.split(".")[1])
            if minor >= 11:
                self.assertTrue(2900 + 50 * minor <= word < 2900 + 50 * (minor + 1), version)

    def test_unmarshaller_agrees_with_the_running_interpreter(self) -> None:
        path = FIXTURES / "python" / f"ledger.{RUNNING_TAG}.pyc"
        if not path.exists():
            self.skipTest(f"no fixture for {RUNNING_TAG}")
        pyc = main.PycFile(path.read_bytes())
        native = marshal.loads(path.read_bytes()[16:])
        self.assertEqual(pyc.module.names, native.co_names)
        self.assertEqual(pyc.module.code, native.co_code)
        grade = pyc.functions()["grade"]
        native_grade = next(c for c in native.co_consts if hasattr(c, "co_code") and c.co_name == "grade")
        self.assertEqual(grade.code, native_grade.co_code)
        self.assertEqual(grade.consts, native_grade.co_consts)
        self.assertEqual(grade.varnames, native_grade.co_varnames)
        self.assertEqual((grade.firstlineno, grade.qualname, grade.filename), (native_grade.co_firstlineno, native_grade.co_qualname, native_grade.co_filename))
        self.assertEqual(grade.linetable, native_grade.co_linetable)

    def test_code_objects_keep_names_and_line_numbers_in_every_version(self) -> None:
        for tag in PYC_TAGS:
            pyc = main.load_pyc(f"ledger.{tag}.pyc")
            self.assertEqual(pyc.module.names, ("LABELS", "percent_change", "grade", "total", "grade_label"), tag)
            self.assertEqual(sorted(pyc.functions()), ["grade", "grade_label", "percent_change", "total"], tag)
            grade = pyc.functions()["grade"]
            self.assertEqual((grade.argnames, grade.varnames, grade.firstlineno, grade.filename), (("score",), ("score", "bucket"), 10, "ledger.py"), tag)
            self.assertGreater(len(grade.linetable), 0, tag)
            self.assertEqual(pyc.functions()["total"].varnames, ("values", "s", "v"), tag)

    def test_grade_bytecode_size_changes_with_the_version(self) -> None:
        sizes = {tag: len(main.load_pyc(f"ledger.{tag}.pyc").functions()["grade"].code) for tag in PYC_TAGS}
        self.assertEqual(sizes, {"cpython-311": 80, "cpython-312": 62, "cpython-313": 70, "cpython-314": 96})

    def test_dis_fixtures_show_the_opcode_changes_between_versions(self) -> None:
        listings = {tag: main.dis_fixture_listing(tag)["grade"] for tag in PYC_TAGS}
        self.assertEqual({tag: len(rows) for tag, rows in listings.items()}, {"cpython-311": 31, "cpython-312": 26, "cpython-313": 26, "cpython-314": 35})
        opnames = {tag: {row["opname"] for row in rows} for tag, rows in listings.items()}
        self.assertIn("POP_JUMP_FORWARD_IF_FALSE", opnames["cpython-311"])
        self.assertIn("RETURN_CONST", opnames["cpython-312"])
        self.assertIn("RETURN_CONST", opnames["cpython-313"])
        self.assertNotIn("RETURN_CONST", opnames["cpython-314"])
        self.assertTrue({"LOAD_SMALL_INT", "LOAD_FAST_BORROW", "NOT_TAKEN"} <= opnames["cpython-314"])
        self.assertEqual(listings["cpython-311"][0]["offset"], 0)
        self.assertIsNone(listings["cpython-313"][0]["offset"])

    def test_cache_entries_and_specialised_forms_in_314(self) -> None:
        rows = main.dis_fixture_listing("cpython-314", caches=True)["grade"]
        caches = [row["offset"] for row in rows if row["opname"] == "CACHE"]
        self.assertEqual(len(caches), 13)
        self.assertEqual(caches[:5], [8, 10, 12, 14, 16])
        self.assertEqual(main.python_structure(rows), {"instructions": 35, "jumps": 4, "compares": 4, "returns": 5, "caches": 13, "structured": 0})
        adaptive = (FIXTURES / "python" / "ledger.cpython-314.adaptive.txt").read_text()
        for specialised in ("RESUME_CHECK", "COMPARE_OP_INT", "BINARY_OP_ADD_INT", "FOR_ITER_LIST"):
            self.assertIn(specialised, adaptive)

    def test_pyc_reader_rejects_bad_magic_and_truncation(self) -> None:
        with self.assertRaises(main.FormatError):
            main.read_pyc_header(b"\x2b\x0e\x0d\x0a\x03\x00")
        with self.assertRaises(main.FormatError):
            main.read_pyc_header(b"\x2b\x0e\x00\x00" + bytes(12))
        with self.assertRaises(main.FormatError):
            main.PycFile(bytes.fromhex("2b0e0d0a03000000") + bytes(8) + b"N")

    def test_instruction_listing_exists_only_for_the_running_interpreter(self) -> None:
        for tag in PYC_TAGS:
            pyc = main.load_pyc(f"ledger.{tag}.pyc")
            rows = pyc.instructions("grade")
            if tag != RUNNING_TAG:
                self.assertIsNone(rows, tag)
                continue
            self.assertIsNotNone(rows)
            fixture = [row["opname"] for row in main.dis_fixture_listing(tag)["grade"]]
            self.assertEqual([row["opname"] for row in rows], fixture)


class ClassFileTests(unittest.TestCase):
    def test_class_header_versions_and_sizes(self) -> None:
        expected = {"Ledger": (65, 1581, 82), "Ledger-g": (65, 1832, 94), "Ledger-gnone": (65, 1404, 79), "Ledger-jdk25": (69, 1581, 82)}
        for variant, (major, size, pool_count) in expected.items():
            class_file = main.load_class(f"{variant}.class")
            self.assertEqual((class_file.magic, class_file.minor_version, class_file.major_version), (0xCAFEBABE, 0, major), variant)
            self.assertEqual((len(class_file.data), len(class_file.constant_pool)), (size, pool_count), variant)
            self.assertEqual(class_file.name, "Ledger")

    def test_constant_pool_entries_resolve_like_javap(self) -> None:
        class_file = main.load_class("Ledger-g.class")
        self.assertEqual(class_file.describe_constant(13), "Method Ledger.grade:(I)I")
        self.assertEqual(class_file.utf8(16), "(I)I")
        self.assertEqual(class_file.constant(35).kind, "InvokeDynamic")
        self.assertEqual(class_file.describe_constant(47), "String F")
        self.assertEqual(class_file.class_name(class_file.super_class), "java/lang/Object")
        self.assertEqual(class_file.source_file(), "Ledger.java")
        self.assertEqual([m.name for m in class_file.methods], ["<init>", "percentChange", "grade", "total", "gradeLabel", "main", "<clinit>"])
        self.assertEqual(class_file.method("total").descriptor, "([I)I")

    def test_disassembler_agrees_with_javap_on_every_variant(self) -> None:
        for variant in ("Ledger", "Ledger-g", "Ledger-gnone", "Ledger-jdk25"):
            class_file = main.load_class(f"{variant}.class")
            report = main.compare_with_javap(class_file, (FIXTURES / "java" / f"{variant}.javap-c.txt").read_text())
            self.assertEqual(report["mismatches"], [], variant)
            self.assertEqual(report["compared"], 108, variant)

    def test_grade_tableswitch_has_five_targets_and_a_default(self) -> None:
        class_file = main.load_class("Ledger-g.class")
        code = class_file.method("grade").code
        instructions = main.disassemble_jvm(class_file, code.code)
        self.assertEqual((len(code.code), len(instructions), code.max_stack, code.max_locals), (50, 14, 2, 1))
        switch = instructions[3]
        self.assertEqual((switch.offset, switch.mnemonic, len(switch.raw)), (4, "tableswitch", 36))
        self.assertEqual(switch.switch, {"low": 6, "high": 10, "default": 48, "targets": {6: 46, 7: 44, 8: 42, 9: 40, 10: 40}})
        self.assertEqual(main.jvm_structure(instructions), {"instructions": 14, "jumps": 0, "switches": 1, "returns": 5, "structured": 0})

    def test_debug_flags_change_the_attributes_and_not_the_code(self) -> None:
        full = main.load_class("Ledger-g.class")
        default = main.load_class("Ledger.class")
        none = main.load_class("Ledger-gnone.class")
        for variant in (full, default, none):
            self.assertEqual(variant.method("grade").code.code, full.method("grade").code.code)
        self.assertEqual(sum("LocalVariableTable" in m.attribute_names() for m in full.methods), 6)
        self.assertEqual(sum("LineNumberTable" in m.attribute_names() for m in full.methods), 7)
        self.assertEqual(sum("LocalVariableTable" in m.attribute_names() for m in default.methods), 0)
        self.assertEqual(sum("LineNumberTable" in m.attribute_names() for m in none.methods), 0)
        self.assertIsNone(none.source_file())
        locals_table = full.method("grade").code.attribute("LocalVariableTable").parsed
        self.assertEqual(locals_table, [{"start": 0, "length": 50, "slot": 0, "name": "score", "descriptor": "I"}])
        self.assertTrue({"values", "sum", "v"} <= {row["name"] for row in full.method("total").code.attribute("LocalVariableTable").parsed})
        self.assertEqual(full.method("grade").code.attribute("LineNumberTable").parsed[0], (0, 10))

    def test_branch_offsets_are_relative_to_the_branch_instruction(self) -> None:
        class_file = main.load_class("Ledger.class")
        percent = main.disassemble_jvm(class_file, class_file.method("percentChange").code.code)
        self.assertEqual((percent[1].mnemonic, percent[1].targets), ("ifne", (6,)))
        total = {i.offset: i for i in main.disassemble_jvm(class_file, class_file.method("total").code.code)}
        self.assertEqual((total[13].text, total[30].text), ("if_icmpge 33", "goto 10"))
        self.assertEqual(total[27].text, "iinc 4, 1")
        hand_built = main.disassemble_jvm(class_file, bytes.fromhex("9a 00 05 03 ac 10 7f"))
        self.assertEqual([i.text for i in hand_built], ["ifne 5", "iconst_0", "ireturn", "bipush 127"])

    def test_class_parser_rejects_wrong_magic_and_trailing_bytes(self) -> None:
        data = (FIXTURES / "java" / "Ledger.class").read_bytes()
        with self.assertRaises(main.FormatError):
            main.ClassFile(b"\xca\xfe\xba\xbf" + data[4:])
        with self.assertRaises(main.FormatError):
            main.ClassFile(data + b"\0")
        with self.assertRaises(main.FormatError):
            main.disassemble_jvm(main.ClassFile(data), b"\xcb")


class WasmTests(unittest.TestCase):
    def test_sections_match_wasm_objdump_h(self) -> None:
        plain = main.load_wasm("ledger.wasm")
        self.assertEqual(len(plain.data), 290)
        self.assertEqual([(s.name, s.payload_start, s.end) for s in plain.sections], [("Type", 10, 26), ("Import", 28, 39), ("Function", 41, 46), ("Memory", 48, 51), ("Export", 53, 110), ("Code", 113, 271), ("Data", 273, 290)])
        named = main.load_wasm("ledger-names.wasm")
        self.assertEqual(len(named.data), 425)
        self.assertEqual((named.sections[-1].custom_name, named.sections[-1].payload_start, named.sections[-1].end), ("name", 293, 425))

    def test_types_imports_exports_and_data_segment(self) -> None:
        module = main.load_wasm("ledger.wasm")
        self.assertEqual([t.render() for t in module.types], ["(i32) -> nil", "(i32, i32) -> i32", "(i32) -> i32"])
        self.assertEqual(module.imports, [{"module": "env", "name": "log", "kind": "func", "type": 0}])
        self.assertEqual([(e["name"], e["kind"], e["index"]) for e in module.exports], [("memory", "memory", 0), ("percent_change", "func", 1), ("grade", "func", 2), ("total", "func", 3), ("grade_label", "func", 4)])
        self.assertEqual(module.memories, [{"min": 1, "max": None}])
        self.assertEqual(module.data_segments[0]["offset"], 1024)
        self.assertEqual(module.data_segments[0]["bytes"], b"F\0D\0C\0B\0A\0")
        self.assertEqual([f.body_size for f in module.functions], [23, 63, 44, 23])

    def test_disassembler_agrees_with_wasm_objdump_d(self) -> None:
        for variant in ("ledger", "ledger-names"):
            module = main.load_wasm(f"{variant}.wasm")
            report = main.compare_with_wasm_objdump(module, (FIXTURES / "wasm" / f"{variant}.objdump.txt").read_text())
            self.assertEqual(report["mismatches"], [], variant)
            self.assertEqual(report["compared"], 77, variant)

    def test_grade_is_structured_control_flow(self) -> None:
        module = main.load_wasm("ledger.wasm")
        grade = module.function("grade")
        self.assertEqual(main.wasm_structure(grade.instructions), {"instructions": 28, "structured": 6, "branches": 5, "tables": 1, "jumps": 0})
        table = next(i for i in grade.instructions if i.mnemonic == "br_table")
        self.assertEqual(table.operands, (4, 4, 4, 4, 4, 4, 3, 2, 1, 0, 0, 4))
        self.assertEqual((table.offset, table.depth, len(table.raw)), (0xA3, 6, 14))
        self.assertEqual(grade.locals, [(1, "i32")])
        self.assertEqual(module.signature(grade).render(), "(i32) -> i32")

    def test_names_come_from_exports_and_local_names_only_from_the_name_section(self) -> None:
        plain = main.load_wasm("ledger.wasm")
        named = main.load_wasm("ledger-names.wasm")
        self.assertFalse(plain.has_name_section())
        self.assertEqual(plain.names, {})
        self.assertEqual(plain.function_name(2), "grade")
        self.assertEqual(plain.function_name(0), "env.log")
        self.assertTrue(named.has_name_section())
        self.assertEqual(named.names["functions"], {0: "log", 1: "percent_change", 2: "grade", 3: "total", 4: "grade_label"})
        self.assertEqual(named.names["locals"][2], {0: "score", 1: "bucket"})
        self.assertEqual(named.names["locals"][3], {0: "values", 1: "count", 2: "sum", 3: "i"})

    def test_leb128_and_block_types_decode(self) -> None:
        self.assertEqual(main.Reader(bytes([0xE4, 0x00])).uleb(), 100)
        self.assertEqual(main.Reader(bytes([0x7F])).sleb(), -1)
        self.assertEqual(main.Reader(bytes([0x80, 0x08])).sleb(), 1024)
        rows = [i.text for i in main.disassemble_wasm(bytes.fromhex("02 40 02 7f 41 80 08 0b 0b 0b"), 0, 10)]
        self.assertEqual(rows, ["block", "block i32", "i32.const 1024", "end", "end", "end"])
        label = main.load_wasm("ledger.wasm").function("grade_label")
        self.assertIn(("41 80 08", "i32.const 1024"), [(main.hex_bytes(i.raw), i.text) for i in label.instructions])

    def test_wasm_reader_rejects_bad_preambles_and_unknown_opcodes(self) -> None:
        with self.assertRaises(main.FormatError):
            main.WasmModule(b"\0asn\x01\0\0\0")
        with self.assertRaises(main.FormatError):
            main.WasmModule(b"\0asm\x02\0\0\0")
        with self.assertRaises(main.FormatError):
            main.disassemble_wasm(b"\xff\x0b", 0, 2)
        with self.assertRaises(main.FormatError):
            main.WasmModule(b"\0asm\x01\0\0\0\x01\x7f")

    def test_wasm_section_order_uses_canonical_positions(self) -> None:
        preamble = b"\0asm\x01\0\0\0"
        types = bytes.fromhex("01 04 01 60 00 00")
        functions = bytes.fromhex("03 02 01 00")
        data_count = bytes.fromhex("0c 01 00")
        code = bytes.fromhex("0a 04 01 02 00 0b")
        module = main.WasmModule(preamble + types + functions + data_count + code)
        self.assertEqual([section.name for section in module.sections], ["Type", "Function", "DataCount", "Code"])
        self.assertEqual(len(module.functions), 1)
        tagged = main.WasmModule(preamble + bytes.fromhex("05 03 01 00 01") + bytes.fromhex("0d 01 00") + bytes.fromhex("06 01 00"))
        self.assertEqual([section.name for section in tagged.sections], ["Memory", "Tag", "Global"])
        with self.assertRaises(main.FormatError):
            main.WasmModule(preamble + types + functions + code + data_count)
        with self.assertRaises(main.FormatError):
            main.WasmModule(preamble + bytes.fromhex("06 01 00") + bytes.fromhex("0d 01 00"))


class CliAssemblyTests(unittest.TestCase):
    def test_pe_and_cli_headers(self) -> None:
        assembly = main.load_assembly("LedgerNet.dll")
        self.assertEqual((assembly.machine, assembly.pe32plus, [s.name for s in assembly.sections]), (0x14C, False, [".text", ".rsrc", ".reloc"]))
        self.assertEqual((assembly.cli_header_rva, assembly.cli_header_size, assembly.cli_header_cb), (0x2008, 72, 72))
        self.assertEqual((assembly.runtime_major, assembly.runtime_minor, assembly.cli_flags, assembly.entry_point_token), (2, 5, 1, 0x06000005))
        self.assertEqual((assembly.metadata_rva, assembly.metadata_size, assembly.rva_to_offset(0x2178)), (0x2178, 1924, 0x378))

    def test_metadata_root_streams_and_table_rows(self) -> None:
        assembly = main.load_assembly("LedgerNet.dll")
        self.assertEqual(assembly.metadata_version, "v4.0.30319")
        self.assertEqual(list(assembly.streams), ["#~", "#Strings", "#US", "#GUID", "#Blob"])
        self.assertEqual(assembly.heap_sizes, 0)
        self.assertEqual({main.TABLE_NAMES[t]: n for t, n in assembly.row_counts.items()}, {"Module": 1, "TypeRef": 21, "TypeDef": 4, "Field": 2, "MethodDef": 6, "Param": 5, "MemberRef": 16, "CustomAttribute": 12, "ClassLayout": 1, "StandAloneSig": 3, "FieldRva": 1, "Assembly": 1, "AssemblyRef": 2, "NestedClass": 1})
        self.assertEqual((assembly.row_sizes[0x00], assembly.row_sizes[0x02], assembly.row_sizes[0x06], assembly.row_sizes[0x20], assembly.row_sizes[0x23]), (10, 14, 14, 22, 20))
        self.assertEqual([t["TypeName"] for t in assembly.type_defs()], ["<Module>", "Ledger", "<PrivateImplementationDetails>", "__StaticArrayInitTypeSize=12"])

    def test_reader_agrees_with_system_reflection_metadata(self) -> None:
        assembly = main.load_assembly("LedgerNet.dll")
        report = main.compare_with_metadump(assembly, (FIXTURES / "dotnet" / "LedgerNet.metadump.txt").read_text())
        self.assertEqual(report["mismatches"], [])
        self.assertEqual(report["compared"], 246)

    def test_method_defs_keep_names_parameters_and_signatures(self) -> None:
        assembly = main.load_assembly("LedgerNet.dll")
        grade = assembly.method("Grade")
        body = assembly.method_body(grade["RVA"])
        self.assertEqual((grade["token"], grade["params"], grade["signatureText"]), (0x06000002, ["score"], "static int32(int32)"))
        self.assertEqual((body.fat, body.max_stack, body.code_size, body.init_locals, body.local_signature_token), (True, 2, 45, True, 0x11000001))
        self.assertEqual(main.describe_locals_signature(assembly.row(0x11, 1)["Signature"]), "(int32)")
        percent = assembly.method("PercentChange")
        percent_body = assembly.method_body(percent["RVA"])
        self.assertEqual((percent["params"], percent_body.fat, percent_body.code_size, percent_body.max_stack), (["before", "after"], False, 14, 8))
        self.assertEqual(main.describe_locals_signature(assembly.row(0x11, 2)["Signature"]), "(int32, int32[], int32, int32)")
        self.assertEqual(assembly.method("Total")["signatureText"], "static int32(int32[])")

    def test_cil_switch_branches_and_tokens_resolve(self) -> None:
        assembly = main.load_assembly("LedgerNet.dll")
        rows = main.cil_listing(assembly, "Grade")
        texts = [row["text"] for row in rows]
        self.assertEqual(texts[:9], ["ldarg.0", "ldc.i4.s 10", "div", "stloc.0", "ldloc.0", "ldc.i4.6", "sub", "switch (IL_0029, IL_0027, IL_0025, IL_0023, IL_0023)", "br.s IL_002b"])
        self.assertEqual(main.cil_structure(main.disassemble_cil(assembly.method_body(assembly.method("Grade")["RVA"]).code)), {"instructions": 19, "jumps": 1, "switches": 1, "returns": 5, "structured": 0})
        label = [row["text"] for row in main.cil_listing(assembly, "GradeLabel")]
        self.assertEqual(label, ["ldsfld Labels", "ldarg.0", "call Grade", "ldelem.ref", "ret"])
        main_texts = [row["text"] for row in main.cil_listing(assembly, "Main")]
        self.assertIn("call System.Console::WriteLine", main_texts)
        self.assertIn("ldstr ' '", main_texts)
        self.assertEqual(main.disassemble_cil(bytes.fromhex("2b 02 00 00 2a"))[0].targets, (4,))

    def test_cil_opcode_table_covers_the_runtime_table(self) -> None:
        dump = main.parse_metadump((FIXTURES / "dotnet" / "LedgerNet.metadump.txt").read_text())
        real = {value: row for value, row in dump["opcodes"].items() if not row["name"].startswith("prefix")}
        self.assertEqual(len(real), 218)
        ours = set(main.CIL_ONE_BYTE) | {0xFE00 | second for second in main.CIL_TWO_BYTE}
        self.assertEqual(set(real) - ours, set())
        self.assertEqual([main.CIL_TWO_BYTE[v & 0xFF][0] for v in ours - set(real)], ["no."])
        with self.assertRaises(main.FormatError):
            main.disassemble_cil(b"\x24")
        with self.assertRaises(main.FormatError):
            main.disassemble_cil(b"\xfe\x08")


class CrossFormatTests(unittest.TestCase):
    def test_what_each_keeps_measures_the_five_containers(self) -> None:
        keeps = main.what_each_keeps()
        self.assertEqual((keeps["native"]["parameterNames"], keeps["native"]["parameterTypes"], keeps["native"]["lineNumbers"], keeps["native"]["bodyBytes"]), ([], None, False, 118))
        self.assertEqual((keeps["python"]["parameterNames"], keeps["python"]["localNames"], keeps["python"]["parameterTypes"], keeps["python"]["lineNumbers"]), (["score"], ["bucket"], None, True))
        self.assertEqual((keeps["jvm"]["parameterNames"], keeps["jvm"]["parameterTypes"], keeps["jvm"]["returnType"], keeps["jvm"]["lineNumbers"]), (["score"], "I", "I", True))
        self.assertEqual((keeps["wasm"]["parameterNames"], keeps["wasm"]["parameterTypes"], keeps["wasm"]["localNames"], keeps["wasm"]["lineNumbers"], keeps["wasm"]["structure"]["structured"]), (["score"], "i32", ["bucket"], False, 6))
        self.assertEqual((keeps["dotnet"]["parameterNames"], keeps["dotnet"]["parameterTypes"], keeps["dotnet"]["localNames"], keeps["dotnet"]["localTypes"]), (["score"], "static int32(int32)", [], "(int32)"))
        self.assertEqual({k: v["structure"].get("jumps", 0) + v["structure"].get("indirectJumps", 0) for k, v in keeps.items()}, {"native": 6, "python": 4, "jvm": 0, "wasm": 0, "dotnet": 1})

    def test_demo_reports_every_oracle_agreeing(self) -> None:
        report = main.demo()
        for variant, entry in report["jvm"].items():
            self.assertEqual(entry["oracle"], "108/108 instructions agree with javap -c", variant)
        for variant, entry in report["wasm"].items():
            self.assertEqual(entry["oracle"], "77/77 instructions agree with wasm-objdump -d", variant)
        self.assertEqual(report["dotnet"]["oracle"], "246/246 checks agree with System.Reflection.Metadata")
        self.assertEqual([report["python"][tag]["gradeInstructions"] for tag in PYC_TAGS], [31, 26, 26, 35])
        self.assertEqual(report["jvm"]["Ledger-gnone"]["fileBytes"], 1404)

    def test_figure_data_is_derived_from_the_five_fixtures(self) -> None:
        data = main.figure_data()
        self.assertEqual([p["id"] for p in data["panels"]], ["native", "python", "jvm", "wasm", "dotnet"])
        self.assertEqual([p["bodyBytes"] for p in data["panels"]], [118, 96, 50, 63, 45])
        self.assertEqual([len(p["rows"]) for p in data["panels"]], [33, 35, 14, 28, 19])
        self.assertEqual([p["name"] for p in data["panels"]], ["grade", "grade", "grade", "grade", "Grade"])
        python = data["panels"][1]
        self.assertEqual(python["rows"][1], {"o": 2, "b": "56 00", "t": "LOAD_FAST_BORROW 0 (score)", "k": "name"})
        self.assertEqual(sum(1 for r in data["panels"][3]["rows"] if r["k"] == "structure"), 14)

    def test_site_figure_module_embeds_the_same_data(self) -> None:
        if not SITE_MODULE.exists():
            self.skipTest("site module not present in this checkout")
        source = SITE_MODULE.read_text()
        match = re.search(r"var DATA = (\{.*?\});\n", source, re.S)
        assert match is not None, "figures-re-43.js must define var DATA = {...};"
        embedded = json.loads(match.group(1))
        expected = json.loads(json.dumps(main.figure_data()))
        self.assertEqual(embedded, expected)
        code_only = source.replace(match.group(1), "")
        for forbidden in ("=>", "let ", "const ", "`"):
            self.assertNotIn(forbidden, code_only, f"ES5 only: found {forbidden!r}")

    def test_compare_interpreters_reads_every_installed_header(self) -> None:
        if not main.available_interpreters():
            self.skipTest("no python3.11 to python3.15 on PATH")
        rows = main.compare_interpreters()
        self.assertEqual(len(rows), len(main.available_interpreters()))
        for row in rows:
            self.assertNotIn("error", row, row)
            self.assertTrue(row["version"].startswith(row["headerFromOurReader"]["version"]), row)
            tag = "cpython-" + row["headerFromOurReader"]["version"].replace(".", "")
            fixture = FIXTURES / "python" / f"ledger.{tag}.pyc"
            if fixture.exists():
                self.assertEqual(row["gradeCodeBytes"], len(main.PycFile(fixture.read_bytes()).functions()["grade"].code), tag)


if __name__ == "__main__":
    unittest.main()
