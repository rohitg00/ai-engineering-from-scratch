using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Reflection.Emit;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;

public static class Program
{
    static string Hex(byte[] bytes)
    {
        var parts = new List<string>();
        foreach (var b in bytes) parts.Add(b.ToString("x2"));
        return string.Join(" ", parts);
    }

    public static int Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine("usage: MetaDump ASSEMBLY.dll");
            return 2;
        }
        using var stream = File.OpenRead(args[0]);
        using var pe = new PEReader(stream);
        var headers = pe.PEHeaders;
        Console.WriteLine("[pe]");
        Console.WriteLine("machine " + headers.CoffHeader.Machine + " 0x" + ((int)headers.CoffHeader.Machine).ToString("x4"));
        Console.WriteLine("sections " + headers.SectionHeaders.Length);
        foreach (var section in headers.SectionHeaders)
        {
            Console.WriteLine("section " + section.Name + " va=0x" + section.VirtualAddress.ToString("x") + " vsize=0x" + section.VirtualSize.ToString("x") + " raw=0x" + section.PointerToRawData.ToString("x") + " rawsize=0x" + section.SizeOfRawData.ToString("x"));
        }
        Console.WriteLine("pe32plus " + (headers.PEHeader.Magic == PEMagic.PE32Plus));
        Console.WriteLine("clrdir rva=0x" + headers.PEHeader.CorHeaderTableDirectory.RelativeVirtualAddress.ToString("x") + " size=" + headers.PEHeader.CorHeaderTableDirectory.Size);
        var cor = headers.CorHeader;
        Console.WriteLine("[cli]");
        Console.WriteLine("runtime " + cor.MajorRuntimeVersion + "." + cor.MinorRuntimeVersion);
        Console.WriteLine("metadata rva=0x" + cor.MetadataDirectory.RelativeVirtualAddress.ToString("x") + " size=" + cor.MetadataDirectory.Size);
        Console.WriteLine("flags 0x" + ((int)cor.Flags).ToString("x") + " " + cor.Flags);
        Console.WriteLine("entrypoint 0x" + cor.EntryPointTokenOrRelativeVirtualAddress.ToString("x8"));

        var reader = pe.GetMetadataReader();
        Console.WriteLine("[metadata]");
        Console.WriteLine("version " + reader.MetadataVersion);
        foreach (HeapIndex heap in Enum.GetValues(typeof(HeapIndex)))
        {
            Console.WriteLine("heap " + heap + " size=" + reader.GetHeapSize(heap) + " offset=0x" + reader.GetHeapMetadataOffset(heap).ToString("x"));
        }
        foreach (TableIndex table in Enum.GetValues(typeof(TableIndex)))
        {
            int rows = reader.GetTableRowCount(table);
            if (rows == 0) continue;
            Console.WriteLine("table " + table + " id=0x" + ((int)table).ToString("x2") + " rows=" + rows + " rowsize=" + reader.GetTableRowSize(table) + " offset=0x" + reader.GetTableMetadataOffset(table).ToString("x"));
        }

        Console.WriteLine("[typedefs]");
        foreach (var handle in reader.TypeDefinitions)
        {
            var type = reader.GetTypeDefinition(handle);
            Console.WriteLine("typedef 0x" + MetadataTokens.GetToken(handle).ToString("x8") + " " + reader.GetString(type.Namespace) + (type.Namespace.IsNil ? "" : ".") + reader.GetString(type.Name) + " flags=0x" + ((int)type.Attributes).ToString("x") + " fields=" + type.GetFields().Count + " methods=" + type.GetMethods().Count);
        }

        Console.WriteLine("[fields]");
        foreach (var handle in reader.FieldDefinitions)
        {
            var fieldDef = reader.GetFieldDefinition(handle);
            Console.WriteLine("field 0x" + MetadataTokens.GetToken(handle).ToString("x8") + " " + reader.GetString(fieldDef.Name) + " sig=" + Hex(reader.GetBlobBytes(fieldDef.Signature)));
        }

        Console.WriteLine("[methods]");
        foreach (var handle in reader.MethodDefinitions)
        {
            var method = reader.GetMethodDefinition(handle);
            var parameters = new List<string>();
            foreach (var p in method.GetParameters())
            {
                var param = reader.GetParameter(p);
                parameters.Add(param.SequenceNumber + ":" + reader.GetString(param.Name));
            }
            Console.WriteLine("method 0x" + MetadataTokens.GetToken(handle).ToString("x8") + " " + reader.GetString(method.Name) + " rva=0x" + method.RelativeVirtualAddress.ToString("x") + " flags=0x" + ((int)method.Attributes).ToString("x") + " implflags=0x" + ((int)method.ImplAttributes).ToString("x") + " sig=" + Hex(reader.GetBlobBytes(method.Signature)) + " params=[" + string.Join(",", parameters) + "]");
            if (method.RelativeVirtualAddress == 0) continue;
            var body = pe.GetMethodBody(method.RelativeVirtualAddress);
            var locals = body.LocalSignature.IsNil ? "" : Hex(reader.GetBlobBytes(reader.GetStandaloneSignature(body.LocalSignature).Signature));
            Console.WriteLine("body 0x" + MetadataTokens.GetToken(handle).ToString("x8") + " size=" + body.Size + " maxstack=" + body.MaxStack + " codesize=" + body.GetILBytes().Length + " localsinit=" + body.LocalVariablesInitialized + " localsig=0x" + (body.LocalSignature.IsNil ? 0 : MetadataTokens.GetToken(body.LocalSignature)).ToString("x8") + " locals=[" + locals + "] exceptions=" + body.ExceptionRegions.Length);
            Console.WriteLine("il 0x" + MetadataTokens.GetToken(handle).ToString("x8") + " " + Hex(body.GetILBytes()));
        }

        Console.WriteLine("[memberrefs]");
        foreach (var handle in reader.MemberReferences)
        {
            var member = reader.GetMemberReference(handle);
            string parent = "";
            if (member.Parent.Kind == HandleKind.TypeReference)
            {
                var typeRef = reader.GetTypeReference((TypeReferenceHandle)member.Parent);
                parent = reader.GetString(typeRef.Namespace) + "." + reader.GetString(typeRef.Name);
            }
            else if (member.Parent.Kind == HandleKind.TypeSpecification)
            {
                parent = "typespec";
            }
            Console.WriteLine("memberref 0x" + MetadataTokens.GetToken(handle).ToString("x8") + " " + parent + "::" + reader.GetString(member.Name) + " sig=" + Hex(reader.GetBlobBytes(member.Signature)));
        }

        Console.WriteLine("[typerefs]");
        foreach (var handle in reader.TypeReferences)
        {
            var typeRef = reader.GetTypeReference(handle);
            Console.WriteLine("typeref 0x" + MetadataTokens.GetToken(handle).ToString("x8") + " " + reader.GetString(typeRef.Namespace) + "." + reader.GetString(typeRef.Name));
        }

        Console.WriteLine("[userstrings]");
        var userString = MetadataTokens.UserStringHandle(1);
        while (!userString.IsNil)
        {
            var text = reader.GetUserString(userString);
            Console.WriteLine("userstring 0x" + MetadataTokens.GetHeapOffset(userString).ToString("x") + " " + Uri.EscapeDataString(text));
            userString = reader.GetNextHandle(userString);
        }

        Console.WriteLine("[opcodes]");
        foreach (var fieldInfo in typeof(OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static))
        {
            var opcode = (OpCode)fieldInfo.GetValue(null);
            Console.WriteLine("opcode 0x" + ((ushort)opcode.Value).ToString("x4") + " " + opcode.Name + " " + opcode.OperandType + " size=" + opcode.Size);
        }
        return 0;
    }
}
