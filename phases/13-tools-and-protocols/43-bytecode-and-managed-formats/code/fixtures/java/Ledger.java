public class Ledger {
    static final String[] LABELS = { "F", "D", "C", "B", "A" };

    static int percentChange(int before, int after) {
        if (before == 0) return 0;
        return (after - before) * 100 / before;
    }

    static int grade(int score) {
        switch (score / 10) {
            case 10:
            case 9: return 4;
            case 8: return 3;
            case 7: return 2;
            case 6: return 1;
            default: return 0;
        }
    }

    static int total(int[] values) {
        int sum = 0;
        for (int v : values) sum += v;
        return sum;
    }

    static String gradeLabel(int score) {
        return LABELS[grade(score)];
    }

    public static void main(String[] args) {
        int[] scores = { 95, 82, 61 };
        System.out.println(percentChange(100, 125) + " " + total(scores) + " " + gradeLabel(95));
    }
}
