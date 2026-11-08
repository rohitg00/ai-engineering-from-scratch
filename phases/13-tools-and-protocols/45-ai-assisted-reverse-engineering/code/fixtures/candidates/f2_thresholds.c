int grade_points(int score) {
    if (score >= 90) return 4;
    if (score >= 80) return 3;
    if (score >= 70) return 2;
    if (score >= 60) return 1;
    return 0;
}
