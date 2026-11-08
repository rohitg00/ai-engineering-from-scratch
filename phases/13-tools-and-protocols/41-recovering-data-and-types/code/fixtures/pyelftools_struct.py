import sys

from elftools.elf.elffile import ELFFile


def type_name(die):
    tag = die.tag
    if tag == "DW_TAG_base_type":
        return die.attributes["DW_AT_name"].value.decode()
    if tag == "DW_TAG_structure_type":
        return die.attributes["DW_AT_name"].value.decode()
    inner = die.get_DIE_from_attribute("DW_AT_type") if "DW_AT_type" in die.attributes else None
    if tag == "DW_TAG_pointer_type":
        return (type_name(inner) if inner else "void") + " *"
    if tag == "DW_TAG_const_type":
        return "const " + type_name(inner)
    return tag


def main(path):
    with open(path, "rb") as handle:
        elf = ELFFile(handle)
        dwarf = elf.get_dwarf_info()
        for unit in dwarf.iter_CUs():
            header = unit.header
            print(f"unit version {header['version']} unit_type {header['unit_type']} address_size {header['address_size']}")
            for die in unit.iter_DIEs():
                if die.tag != "DW_TAG_structure_type":
                    continue
                name = die.attributes["DW_AT_name"].value.decode()
                size = die.attributes["DW_AT_byte_size"].value
                print(f"struct {name} byte_size {size}")
                for child in die.iter_children():
                    if child.tag != "DW_TAG_member":
                        continue
                    member = child.attributes["DW_AT_name"].value.decode()
                    offset = child.attributes["DW_AT_data_member_location"].value
                    kind = child.get_DIE_from_attribute("DW_AT_type")
                    print(f"  +{offset} {type_name(kind)} {member}")


if __name__ == "__main__":
    main(sys.argv[1])
