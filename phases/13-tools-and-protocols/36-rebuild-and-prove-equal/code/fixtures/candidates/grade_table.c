int grade(int score) {
    static const int points[] = { 1, 2, 3, 4, 4 };
    unsigned int slot = (unsigned int)(score / 10 - 6);
    return slot < 5 ? points[slot] : 0;
}
