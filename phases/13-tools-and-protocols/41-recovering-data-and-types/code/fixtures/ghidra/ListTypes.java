import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.data.DataType;
import ghidra.program.model.data.Structure;
import ghidra.program.model.data.DataTypeComponent;
import ghidra.program.model.listing.Function;
import java.util.Iterator;

public class ListTypes extends GhidraScript {
    @Override
    public void run() throws Exception {
        Iterator<DataType> it = currentProgram.getDataTypeManager().getAllDataTypes();
        while (it.hasNext()) {
            DataType dt = it.next();
            if (dt instanceof Structure) {
                Structure s = (Structure) dt;
                println("STRUCT " + s.getPathName() + " size=" + s.getLength() + " align=" + s.getAlignment());
                for (DataTypeComponent c : s.getDefinedComponents()) {
                    println("  +" + c.getOffset() + " " + c.getDataType().getName() + " " + c.getFieldName());
                }
            }
        }
        DecompInterface d = new DecompInterface();
        d.openProgram(currentProgram);
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            String name = f.getName();
            if (!name.equals("bump") && !name.equals("sum_balances") && !name.equals("tag") && !name.equals("projected") && !name.equals("label_length")) continue;
            println("SIG " + f.getPrototypeString(true, false));
            DecompileResults r = d.decompileFunction(f, 60, monitor);
            if (r.decompileCompleted()) {
                for (String line : r.getDecompiledFunction().getC().split("\n")) println("C " + line);
            } else {
                println("DECOMPILE FAILED " + r.getErrorMessage());
            }
        }
        d.dispose();
    }
}
