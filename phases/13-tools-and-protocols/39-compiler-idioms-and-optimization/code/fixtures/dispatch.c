int f0(int); int f1(int); int f2(int); int f3(int); int f4(int); int f5(int); int f6(int); int f7(int);
int f8(int); int f9(int); int f10(int); int f11(int); int f12(int); int f13(int); int f14(int); int f15(int);

int dispatch(int k, int a) {
    switch (k) {
    case 0: return f0(a); case 1: return f1(a); case 2: return f2(a); case 3: return f3(a);
    case 4: return f4(a); case 5: return f5(a); case 6: return f6(a); case 7: return f7(a);
    case 8: return f8(a); case 9: return f9(a); case 10: return f10(a); case 11: return f11(a);
    case 12: return f12(a); case 13: return f13(a); case 14: return f14(a); case 15: return f15(a);
    default: return -1;
    }
}
