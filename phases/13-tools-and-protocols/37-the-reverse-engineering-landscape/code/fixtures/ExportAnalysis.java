import java.io.FileWriter;
import java.util.Iterator;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.framework.Application;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSetView;
import ghidra.program.model.block.BasicBlockModel;
import ghidra.program.model.block.CodeBlock;
import ghidra.program.model.block.CodeBlockIterator;
import ghidra.program.model.block.CodeBlockReference;
import ghidra.program.model.block.CodeBlockReferenceIterator;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.pcode.PcodeOp;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;
import ghidra.program.model.symbol.SymbolType;

public class ExportAnalysis extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outputPath = args[0];
        JsonObject root = new JsonObject();
        root.addProperty("tool", "ghidra");
        root.addProperty("version", Application.getApplicationVersion());
        root.addProperty("fixture", currentProgram.getName());
        root.addProperty("language", currentProgram.getLanguageID().getIdAsString());
        root.addProperty("compilerSpec", currentProgram.getCompilerSpec().getCompilerSpecID().getIdAsString());
        root.addProperty("imageBase", currentProgram.getImageBase().getOffset());
        root.addProperty("executableFormat", currentProgram.getExecutableFormat());

        JsonArray blocks = new JsonArray();
        for (MemoryBlock block : currentProgram.getMemory().getBlocks()) {
            JsonObject item = new JsonObject();
            item.addProperty("name", block.getName());
            item.addProperty("start", block.getStart().getOffset());
            item.addProperty("size", block.getSize());
            item.addProperty("execute", block.isExecute());
            blocks.add(item);
        }
        root.add("memoryBlocks", blocks);

        JsonArray symbols = new JsonArray();
        SymbolIterator symbolIterator = currentProgram.getSymbolTable().getAllSymbols(false);
        while (symbolIterator.hasNext()) {
            Symbol symbol = symbolIterator.next();
            if (symbol.getSymbolType() != SymbolType.FUNCTION && symbol.getSymbolType() != SymbolType.LABEL) {
                continue;
            }
            JsonObject item = new JsonObject();
            item.addProperty("name", symbol.getName());
            item.addProperty("addr", symbol.getAddress().getOffset());
            item.addProperty("type", symbol.getSymbolType().toString());
            item.addProperty("source", symbol.getSource().toString());
            symbols.add(item);
        }
        root.add("symbols", symbols);

        DecompInterface decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);
        BasicBlockModel model = new BasicBlockModel(currentProgram);
        JsonArray functions = new JsonArray();
        FunctionIterator functionIterator = currentProgram.getFunctionManager().getFunctions(true);
        while (functionIterator.hasNext()) {
            Function function = functionIterator.next();
            JsonObject item = new JsonObject();
            item.addProperty("name", function.getName());
            item.addProperty("entry", function.getEntryPoint().getOffset());
            AddressSetView body = function.getBody();
            item.addProperty("bodySize", body.getNumAddresses());
            item.addProperty("bodyMin", body.getMinAddress().getOffset());
            item.addProperty("bodyMax", body.getMaxAddress().getOffset());
            item.addProperty("symbolSource", function.getSymbol().getSource().toString());

            JsonArray instructions = new JsonArray();
            InstructionIterator instructionIterator = currentProgram.getListing().getInstructions(body, true);
            while (instructionIterator.hasNext()) {
                Instruction instruction = instructionIterator.next();
                JsonObject insn = new JsonObject();
                insn.addProperty("addr", instruction.getAddress().getOffset());
                insn.addProperty("size", instruction.getLength());
                StringBuilder hex = new StringBuilder();
                for (byte b : instruction.getBytes()) {
                    hex.append(String.format("%02x", b & 0xff));
                }
                insn.addProperty("bytes", hex.toString());
                insn.addProperty("text", instruction.toString());
                insn.addProperty("flowType", instruction.getFlowType().toString());
                JsonArray pcode = new JsonArray();
                for (PcodeOp op : instruction.getPcode()) {
                    pcode.add(op.toString());
                }
                insn.add("pcode", pcode);
                instructions.add(insn);
            }
            item.add("instructions", instructions);

            JsonArray codeBlocks = new JsonArray();
            CodeBlockIterator blockIterator = model.getCodeBlocksContaining(body, monitor);
            while (blockIterator.hasNext()) {
                CodeBlock block = blockIterator.next();
                JsonObject blockItem = new JsonObject();
                blockItem.addProperty("start", block.getFirstStartAddress().getOffset());
                blockItem.addProperty("size", block.getNumAddresses());
                JsonArray destinations = new JsonArray();
                CodeBlockReferenceIterator destinationIterator = block.getDestinations(monitor);
                while (destinationIterator.hasNext()) {
                    CodeBlockReference reference = destinationIterator.next();
                    JsonObject edge = new JsonObject();
                    edge.addProperty("to", reference.getDestinationAddress().getOffset());
                    edge.addProperty("flow", reference.getFlowType().toString());
                    destinations.add(edge);
                }
                blockItem.add("destinations", destinations);
                codeBlocks.add(blockItem);
            }
            item.add("blocks", codeBlocks);

            DecompileResults results = decompiler.decompileFunction(function, 60, monitor);
            if (results != null && results.decompileCompleted() && results.getDecompiledFunction() != null) {
                item.addProperty("decompiled", results.getDecompiledFunction().getC());
            } else {
                item.addProperty("decompileError", results == null ? "no results" : results.getErrorMessage());
            }
            functions.add(item);
        }
        root.add("functions", functions);

        JsonArray references = new JsonArray();
        Iterator<Address> fromIterator = currentProgram.getReferenceManager().getReferenceSourceIterator(currentProgram.getMemory(), true);
        while (fromIterator.hasNext()) {
            Address from = fromIterator.next();
            for (Reference reference : currentProgram.getReferenceManager().getReferencesFrom(from)) {
                if (!reference.getReferenceType().isData()) {
                    continue;
                }
                JsonObject edge = new JsonObject();
                edge.addProperty("from", from.getOffset());
                edge.addProperty("to", reference.getToAddress().getOffset());
                edge.addProperty("type", reference.getReferenceType().toString());
                references.add(edge);
            }
        }
        root.add("dataReferences", references);
        decompiler.dispose();

        try (FileWriter writer = new FileWriter(outputPath)) {
            writer.write(new GsonBuilder().setPrettyPrinting().create().toJson(root));
            writer.write("\n");
        }
        println("wrote " + outputPath);
    }
}
