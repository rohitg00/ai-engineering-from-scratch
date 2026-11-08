import java.util.Collection;
import java.util.List;

import ghidra.feature.vt.AbstractGhidraVersionTrackingScript;
import ghidra.feature.vt.api.main.VTMatch;
import ghidra.feature.vt.api.main.VTMatchSet;
import ghidra.framework.Application;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Program;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.symbol.Symbol;

public class ListVersionTrackingMatches extends AbstractGhidraVersionTrackingScript {

	private static final String[] CORRELATORS = {
		"Exact Symbol Name Match",
		"Exact Data Match",
		"Exact Function Bytes Match",
		"Exact Function Instructions Match",
		"Exact Function Mnemonics Match",
		"Duplicate Function Instructions Match",
	};

	@Override
	protected void run() throws Exception {
		String[] args = getScriptArgs();
		if (args.length != 2) {
			println("VT|usage|/SourceProgram /DestinationProgram");
			return;
		}
		println("VT|ghidra|" + Application.getApplicationVersion());
		createVersionTrackingSession(args[0], args[1]);
		try {
			describe("source", getSourceProgram());
			describe("destination", getDestinationProgram());
			List<String> available = getProgramCorrelators();
			for (String name : available) {
				println("VT|correlator-available|" + name);
			}
			for (String name : CORRELATORS) {
				if (!available.contains(name)) {
					println("VT|correlator-missing|" + name);
					continue;
				}
				runCorrelator(name);
				Collection<VTMatch> matches = getMatchesFromLastRunCorrelator();
				println("VT|correlator|" + name + "|" + matches.size());
				for (VTMatch match : matches) {
					report(name, match);
				}
			}
			for (VTMatchSet set : getVTSession().getMatchSets()) {
				println("VT|match-set|" + set.getProgramCorrelatorInfo().getName() + "|" + set.getMatchCount());
			}
		}
		finally {
			closeVersionTrackingSession();
		}
	}

	private void describe(String role, Program program) {
		println("VT|program|" + role + "|" + program.getName() + "|" + program.getLanguageID() + "|" + program.getImageBase());
		for (MemoryBlock block : program.getMemory().getBlocks()) {
			println("VT|block|" + role + "|" + block.getName() + "|" + block.getStart() + "|" + block.getEnd() + "|" + block.getSize());
		}
		for (ghidra.program.model.listing.Function function : program.getFunctionManager().getFunctions(true)) {
			long size = function.getBody().getNumAddresses();
			println("VT|function|" + role + "|" + function.getName() + "|" + function.getEntryPoint() + "|" + size);
		}
	}

	private void report(String correlator, VTMatch match) {
		Address source = match.getSourceAddress();
		Address destination = match.getDestinationAddress();
		println("VT|match|" + correlator + "|" + nameAt(getSourceProgram(), source) + "|" + source + "|" + match.getSourceLength() + "|" + nameAt(getDestinationProgram(), destination) + "|" + destination + "|" + match.getDestinationLength() + "|" + match.getAssociation().getType() + "|" + match.getSimilarityScore().getFormattedScore() + "|" + match.getConfidenceScore().getFormattedScore());
	}

	private String nameAt(Program program, Address address) {
		Symbol symbol = program.getSymbolTable().getPrimarySymbol(address);
		return symbol == null ? "?" : symbol.getName();
	}
}
