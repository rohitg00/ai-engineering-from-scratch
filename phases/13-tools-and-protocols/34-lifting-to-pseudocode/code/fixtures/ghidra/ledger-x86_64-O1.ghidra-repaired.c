/* The Ghidra text from ledger-x86_64-O1.ghidra.c with the smallest edits that make it compile.
   Every edit is listed in ../README.md. grade and total keep their original lines. */
typedef unsigned int uint;
typedef unsigned long ulong;

/* .rodata bytes 0x14 to 0x27 of ledger-x86_64-O1.o: the five int32 values 1, 2, 3, 4, 4. */
static _Alignas(4) const unsigned char DAT_001000b4_bytes[20] = {
  1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0
};
#define DAT_001000b4 (*DAT_001000b4_bytes)

/* Edited: return type undefined1 [16] became int, param_3 was removed,
   and the 16-byte auVar temporaries became the low eight bytes truncated to int. */
int percent_change(int param_1,int param_2)

{
  long lVar1;

  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    return (int)(lVar1 / (long)param_1 & 0xffffffff);
  }
  return 0;
}

uint grade(int param_1)

{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}

int total(long param_1,uint param_2)

{
  int iVar1;
  ulong uVar2;

  if (0 < (int)param_2) {
    uVar2 = 0;
    iVar1 = 0;
    do {
      iVar1 = iVar1 + *(int *)(param_1 + uVar2 * 4);
      uVar2 = uVar2 + 1;
    } while (param_2 != uVar2);
    return iVar1;
  }
  return 0;
}
