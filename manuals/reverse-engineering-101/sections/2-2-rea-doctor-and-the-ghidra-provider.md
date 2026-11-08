# rea doctor and the Ghidra provider

> rea doctor runs nine checks for the Ghidra scope, and the provider is available only when the install directory, version, analyzeHeadless, native decompiler, and JDK 21 all pass.

You installed rea with `npm` and Ghidra with Homebrew, and your first `rea function` ended with `provider_unavailable`. The message tells you to run `rea doctor`. The report has nine checks for the Ghidra scope, each with a name, an `ok` flag, and the path or version it found. The first check that fails names the fix.

When you finish this section, you can read a doctor report, name the check that failed, and repair the install from its remediation text.

## What the Ghidra provider needs

**Ghidra provider:** the rea adapter that drives an existing Ghidra install through `analyzeHeadless`. It needs two absolute paths from the environment, `GHIDRA_INSTALL_DIR` and `JAVA_HOME`, and it rejects relative ones. The policy fixes the versions: `SUPPORTED_GHIDRA_VERSION = "12.1.4"` and `SUPPORTED_GHIDRA_JAVA_MAJOR = 21`. In practice, the provider accepts Ghidra 12.1.x with a 64-bit full JDK inside the range that the install declares in `application.java.min` and `application.java.max` {{install Ghidra}}. The install must also hold the native decompiler for the host, under `Ghidra/Features/Decompiler/os/<platform>/`. REA does not build or install native tools, and it does not change the Gatekeeper quarantine settings {{install Ghidra}}.

On the capture Mac, Homebrew put both tools in place:

```listing
title: the Ghidra and JDK paths on the capture Mac
source: capture/out/00-versions.txt
lang: text
note: Cut to the Ghidra and Java blocks. The rea, node, clang, llvm-objdump, macOS, and WABT blocks are cut.
---
…
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec
application.build.date=2026-Sep-21 2017 GMT
application.version=12.1.4
application.release.name=PUBLIC

JAVA_HOME=/opt/homebrew/opt/openjdk@21
$ /opt/homebrew/opt/openjdk@21/bin/java -version
openjdk version "21.0.12.1" 2026-08-18
OpenJDK Runtime Environment Homebrew (build 21.0.12.1)
OpenJDK 64-Bit Server VM Homebrew (build 21.0.12.1, mixed mode, sharing)
[exit 0]
…
```

The install docs give the same steps for any host: extract Ghidra, install the JDK outside REA, and export the two absolute paths {{install Ghidra}}. On a Mac with Homebrew, that is:

```bash
export GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
rea doctor --provider ghidra --format json
```

`--provider ghidra` narrows the report to one scope. Without it, the report also covers the Hopper, IDA, JADX, and Kuna providers, the installed skill, and the agent registrations on the machine.

## The nine checks

```listing
title: the doctor report for the Ghidra scope
source: capture/out/01-doctor-ghidra.json
lang: json
note: Cut to the head, the first check, and the two checks that read the install. The other six checks are cut.
---
{
  "healthy": true,
  "environment_healthy": false,
  "scope": {
    "mode": "explicit",
    "clients": [],
    "providers": [
      "ghidra"
    ],
    "skill": false,
    "target": null
  },
  "scope_checks": [
    {
      "name": "node",
      "ok": true,
      "classification": "healthy",
      "detail": "22.22.0",
      "details": {
        "runtime": "node",
        "version": "22.22.0"
      }
    },
    …
    {
      "name": "ghidra-native_decompiler",
      "ok": true,
      "classification": "healthy",
      "detail": "/opt/homebrew/Cellar/ghidra/12.1.4/libexec/Ghidra/Features/Decompiler/os/mac_arm_64/decompile reports mach-o arm64, which matches darwin/arm64"
    },
    {
      "name": "ghidra-java",
      "ok": true,
      "classification": "healthy",
      "detail": "21.0.12.1; 64-bit; JDK; /opt/homebrew/Cellar/openjdk@21/21.0.12.1/libexec/openjdk.jdk/Contents/Home; accepted a 64-bit full JDK 21 or newer"
    }
  ]
}
```

`inspectGhidraInstallation` runs the eight Ghidra checks without importing anything. Their order is `configuration`, `platform`, `architecture`, `installation`, `version`, `headless`, `native_decompiler`, and `java`, and the doctor prefixes each name with `ghidra-`. A `node` check comes first. The table names what each one reads and the code it returns when it fails.

| Check | What it reads | On the capture Mac | Failure code |
|---|---|---|---|
| `node` | the Node version | `22.22.0` | `missing_dependency` |
| `ghidra` | `GHIDRA_INSTALL_DIR`, set and absolute | `/opt/homebrew/Cellar/ghidra/12.1.4/libexec` | `not_configured` |
| `ghidra-platform` | the host OS | `darwin` | `unsupported_host` |
| `ghidra-architecture` | the host CPU | `arm64` | `unsupported_host` |
| `ghidra-installation` | `Ghidra/application.properties` under the install | the properties file | `executable_missing` |
| `ghidra-version` | `application.version` against 12.1.x | `12.1.4` | `unsupported_version` or `version_unresolved` |
| `ghidra-headless` | `support/analyzeHeadless`, or `.bat` on Windows | `support/analyzeHeadless` | `executable_missing` |
| `ghidra-native_decompiler` | `Ghidra/Features/Decompiler/os/mac_arm_64/decompile` and its executable header | `mach-o arm64`, which matches `darwin/arm64` | `executable_missing` |
| `ghidra-java` | the JDK, its major version against `application.java.min`, 64-bit, `javac` present | `21.0.12.1`, 64-bit, JDK | one code for each failed property |


The native decompiler check reads the executable header of the `decompile` binary and compares it with the host. A build for another platform is therefore reported as incompatible, even when its directory name looks right {{install Ghidra}}. The doctor checks the platform, the architecture, and the Ghidra 12.1.x version. It also checks `support/analyzeHeadless` or `support/analyzeHeadless.bat`, the Java major range of the install, a 64-bit JDK, and `javac` or `javac.exe` {{install Ghidra}}. [Figure](#fig-2-2) draws the nine in order.

```figure
id: fig-2-2
kind: flow
title: the nine checks of rea doctor for the Ghidra scope
claim: rea doctor runs nine checks for the Ghidra scope in a fixed order, and on the capture Mac every one passed with the path or version it found.
caption: Read left to right, then down, and the two boxes at the bottom are the report's two verdicts. From capture/out/01-doctor-ghidra.json and 00-commands.txt, with the order from src/ghidra/GhidraInstallation.ts at the tag.
```

## healthy and environment_healthy

The report has two verdicts. `healthy` is the verdict for the selected scope, here `explicit` with `providers: ["ghidra"]`, and `scope_checks` lists only the checks in that scope. `environment_healthy` is the verdict for the audit-wide set. It is true only when every check outside the providers passes, every configured provider passes, and at least one provider is available.

On the capture Mac `healthy` is true and `environment_healthy` is false. Hopper, IDA, and Kuna are not configured there, so the formula ignores them, and Ghidra is configured and passes. The false verdict therefore comes from a check outside the Ghidra scope. That check is in the set the capture's `--filter-output` left out, which names this user's skill install and agent registrations ([the capture](manuals/reverse-engineering-101/capture/README.md)). The exit status follows the scope. `rea doctor` returned 0 ([the capture](manuals/reverse-engineering-101/capture/out/00-commands.txt)), because a missing optional provider only produces a note for tasks that do not use it {{cli Output and exit status}}.

## When a check fails

The capture kit did not record a failing doctor, because Ghidra was installed. The source says what you would see. With `GHIDRA_INSTALL_DIR` unset, the `configuration` check fails with the detail `GHIDRA_INSTALL_DIR is not set` and the remediation `Set GHIDRA_INSTALL_DIR to an extracted Ghidra 12.1.x release directory.`. With a relative path, the detail is `GHIDRA_INSTALL_DIR must be absolute`.

A `rea function --provider ghidra` on such a machine fails selection with the code `provider_unavailable`, the category `unavailable`, and `retryable: true`. The message is `The selected analysis provider is unavailable. Review the reported local diagnostics or run rea doctor, then retry.`. Its `details.rejections[].diagnostics.checks[]` holds the same eight checks as the doctor. [Section 2.3](#s-rea-capabilities) shows those diagnostics inside `rea capabilities`, and [the errors reference](#s-ref-errors) lists the codes.

One check has no fix in rea. Every Ghidra record on macOS carries the limitation that "macOS sessions require a matching executable Ghidra native decompiler; REA checks for it but does not build native components or change Gatekeeper quarantine state." ([the capture](manuals/reverse-engineering-101/capture/out/06-function-percent-change.json)). If the Homebrew build of `decompile` is missing or quarantined, you repair Ghidra, not rea.

```takeaways
- Export `GHIDRA_INSTALL_DIR` and `JAVA_HOME` as absolute paths before the first rea command.
- Run `rea doctor --provider ghidra --format json` and read `scope_checks` for the first `ok: false`.
- Fix the install from the check's remediation, then run the doctor again.
- Read `environment_healthy` as a report on the whole machine, and `healthy` as the verdict for your scope.
```

Sources: install Ghidra (rea docs/installation.md); cli Output and exit status (rea docs/cli.md); rea at 27dc42d: src/config/environment.ts, src/ghidra/GhidraInstallationPolicy.ts, src/ghidra/GhidraReleasePolicy.ts, src/ghidra/GhidraInstallation.ts, src/ghidra/GhidraDoctor.ts, src/application/Doctor.ts, src/application/DoctorDiagnostics.ts, src/application/DoctorProviderIds.ts, src/domain/providerSelectionError.ts, src/domain/analysisErrorProjection.ts; capture/README.md; capture/out/00-commands.txt, 00-versions.txt, 01-doctor-ghidra.json, 06-function-percent-change.json
