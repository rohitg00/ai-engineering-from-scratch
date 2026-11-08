# The README use rule and the law

> You analyze a program only when you have the right to, and in this manual that right comes from writing every target yourself.

A vendor sent you a binary, and an agent at your side can decompile it in eight seconds. Before the first command, two questions stand. Who owns the program, and what does the law allow you to do with a copy you did not write? rea asks neither question. Its `DISCLAIMER.md` puts the answer on you, and the statutes and decisions below say what the answer has to contain.

When you finish this section, you can say which rule lets you analyze a program, and why every target in this manual passes that test. This section reads primary sources and gives no legal advice.

## The use rule at the tag

```rule
label: the use rule
source: readme DISCLAIMER.md, Responsible use
---
You must get any permission that you need, and you must follow the law, the license agreement, and the terms of service. Your jurisdiction or the license of the software can limit reverse engineering.
```

The rule is a paragraph under the heading `Responsible use` in `DISCLAIMER.md` at the tag. The README has a `Disclaimer` heading that sends you to that file. It limits REA to lawful research, education, interoperability, software preservation, and the analysis of software that you own or have permission to examine {{readme Disclaimer}}. It adds that this position covers all REA versions and distribution channels.

`DISCLAIMER.md` also lists the uses that the project does not support. The first item is the circumvention of DRM, licence checks, anti-cheat systems, and other protection measures. Then come game cheats, the bypass of authentication or access controls, and copies of proprietary software. The last two items are the evasion of AI provider usage policies and the resale or sharing of AI accounts.

## United States: 17 U.S.C. 1201

**Circumvention:** under 1201(a)(3)(A), the act of getting around a technological protection measure without the permission of the copyright owner. Descrambling, decrypting, bypassing, removing, deactivating, and impairing the measure all count {{law 17 U.S.C. 1201(a)(3)(A)}}. Section 1201(a)(1)(A) forbids it.

Section 1201(f) is the reverse engineering exception, and it stacks four limits. The person must have a lawful right to use the copy of the program. The circumvention must have one purpose only. That purpose is to find and analyze the parts of the program that an independently created program needs to interoperate with other programs. Those parts must not have been readily available to the person before. The acts must not infringe copyright under the same title {{law 17 U.S.C. 1201(f)(1)}}.

Section 1201(f)(4) defines the key word. Interoperability is the ability of programs to exchange information and to use the information that they exchanged {{law 17 U.S.C. 1201(f)(4)}}. Section 1201(j) covers security testing. It defines security testing as access to a computer, a system, or a network for one purpose only. That purpose is to test, investigate, or correct a security flaw in good faith. The owner or operator must give permission {{law 17 U.S.C. 1201(j)(1)}}.

Section 1201(f) is an exception to the anti-circumvention rule only. It does not decide whether the copies you make while analyzing infringe copyright. Section 1201(c)(1) leaves that question to copyright law. It states that section 1201 does not change the rights, remedies, limits, or defenses of copyright infringement. Fair use is one of those defenses {{law 17 U.S.C. 1201(c)(1)}}. The two decisions below answer it.

## European Union: Directive 2009/24/EC

Article 1(2) sets the ground. The Directive gives no copyright protection to the ideas and principles behind any part of a program. That includes the ideas behind its interfaces {{law Directive 2009/24/EC Article 1(2)}}. Two articles then give a lawful user two rights.

Article 5(3) is the right to study a running program. A person with a right to use a copy can observe, study, or test how the program works, without permission from the rightholder. The goal must be to find the ideas and principles behind a part of the program. The condition is that the person does this while doing what the license already allows: loading, displaying, running, transmitting, or storing the program {{law Directive 2009/24/EC Article 5(3)}}. The Court of Justice applied it in C-406/10. There a licensee studied the SAS System to reproduce its functionality in a second program, without decompilation, and did not infringe.

Article 6(1) is the decompilation right. It needs no permission when copying the code and translating its form are necessary to get some information. That information is what an independently created program needs to interoperate with other programs {{law Directive 2009/24/EC Article 6(1)}}.

Three conditions follow. First, a person with a right to use a copy does the acts. Second, the information for interoperability was not readily available before {{law Directive 2009/24/EC Article 6(1)(b)}}. Third, the acts stay inside the parts of the program that interoperability needs {{law Directive 2009/24/EC Article 6(1)(c)}}.

Article 6(2)(c) then forbids using the result to develop, produce, or market a program whose expression is substantially similar {{law Directive 2009/24/EC Article 6(2)(c)}}. A contract cannot take these rights away. Under Article 8, a contract term that goes against Article 6 or against the exceptions in Article 5(2) and 5(3) is void {{law Directive 2009/24/EC Article 8}}. In C-13/20 the Court added a third route. A lawful purchaser can decompile to correct errors under Article 5(1), without the Article 6 conditions. The decompilation must not go further than the correction needs {{law C-13/20 ruling 2}}.

## Two decisions: Sega v. Accolade and Sony v. Connectix

In Sega Enterprises Ltd. v. Accolade, Inc., 977 F.2d 1510 (9th Cir. 1992), Accolade bought a Genesis console and cartridges, disassembled the object code, wrote a manual of interface requirements, and then wrote its own games.

The court held that disassembly is fair use as a matter of law when two conditions hold. Disassembly is the only way to reach the ideas and functional elements of a copyrighted program. There is a legitimate reason to reach them {{law Sega v. Accolade, 977 F.2d at 1527-1528}}. The only code Accolade kept was a header of 20 to 25 bytes that the console required.

In Sony Computer Entertainment, Inc. v. Connectix Corp., 203 F.3d 596 (9th Cir. 2000), Connectix copied the PlayStation BIOS into memory many times while it built an emulator that contained none of Sony's code. The court held that the intermediate copies Connectix made while it reverse engineered the Sony BIOS were fair use. Those copies were necessary to make its own non-infringing Virtual Game Station run PlayStation games {{law Sony v. Connectix, 203 F.3d 596}}.

The court listed four ways to reach the functional elements of a program. Two of them are the static examination of the instructions and the dynamic examination of a running program, and it called both disassembly. Both decisions protect the intermediate copies and say nothing about copied code in the finished product.

```figure
id: fig-2-1
kind: decision
title: five questions before the first command
claim: Five questions from 17 USC 1201(f), Directive 2009/24/EC, Sega, and Connectix stand before the first command, and the fixtures of this manual answer all five by construction.
caption: Read the five questions from the top down, and follow a dashed rose arrow at the first no. The references are the statutes and decisions that the sources reference lists.
```

## The rule of this manual

Every target in this manual is a program written for it. `ledger.c` and `ledger-main.c` are the C sources, `js-app/` is a six-file application, and `wasm/ledger.wat` is a hand-written module. The capture kit records their hashes and sizes:

```listing
title: the fixtures and their hashes
source: capture/out/00-fixtures.txt
lang: text
note: Cut to the two C sources, the two arm64 executables, the module, and its text. The object files, the JavaScript files, and the smoke-test program are cut.
---
01b5d08b…   33872  fixtures/ledger-arm64-O1
…
8bbbaa58…   33872  fixtures/ledger-arm64-O2
…
80af384b…     743  fixtures/ledger-main.c
…
4564c3e7…     568  fixtures/ledger.c
…
699f6ff7…     290  fixtures/wasm/ledger.wasm
2e0b5792…    1841  fixtures/wasm/ledger.wat
```

For these files the five questions in [figure](#fig-2-1) answer themselves. You hold the copy because you compiled it. The purpose is study. No other way is needed because the source is beside the binary, and the comparison of the two is the point. The whole program is yours, so the parts and the expression are yours.

This manual never analyzes a protection, a licence check, an anti-tamper scheme, a game, or a program you do not own. It never instruments a running program other than its own fixtures.

For any other program, answer the five questions first and write the answers down. Start from a copy you obtained lawfully. Name the purpose the law names. The law names interoperability under 1201(f) and Article 6, study under Article 5(3), and error correction under Article 5(1). It also names security testing with the owner's authorization under 1201(j).

Check that the facts are not already published. Confine the work to the parts you need, and make the final product your own expression. Where a licence or a contract says more, read it. Section 1201(f) does not override contract law, and Article 8 voids only terms contrary to Articles 5(2), 5(3), and 6.

```takeaways
- Read `DISCLAIMER.md` once. Getting authorization is your task, and rea does not check it.
- Write down the lawful copy, the named purpose, and the missing facts before the first command.
- Analyze only programs you wrote or are authorized to examine, as every section of this manual does.
- Keep intermediate copies for analysis, and keep copied code out of anything you release.
```

Sources: readme Disclaimer (rea README.md); rea DISCLAIMER.md, Responsible use, at 27dc42d; law: 17 U.S.C. 1201(a)(1)(A), (a)(3)(A), (c)(1), (f)(1), (f)(4), (j)(1), Directive 2009/24/EC Articles 1(2), 5(1), 5(3), 6(1), 6(2)(c), 8, CJEU C-406/10 and C-13/20, Sega v. Accolade, 977 F.2d 1510, Sony v. Connectix, 203 F.3d 596; capture/out/00-fixtures.txt
