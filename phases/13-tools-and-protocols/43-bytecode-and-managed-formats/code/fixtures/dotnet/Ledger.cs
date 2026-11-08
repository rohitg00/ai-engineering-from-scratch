using System;

public static class Ledger
{
    static readonly string[] Labels = { "F", "D", "C", "B", "A" };

    public static int PercentChange(int before, int after)
    {
        if (before == 0) return 0;
        return (after - before) * 100 / before;
    }

    public static int Grade(int score)
    {
        switch (score / 10)
        {
            case 10:
            case 9: return 4;
            case 8: return 3;
            case 7: return 2;
            case 6: return 1;
            default: return 0;
        }
    }

    public static int Total(int[] values)
    {
        int sum = 0;
        foreach (int v in values) sum += v;
        return sum;
    }

    public static string GradeLabel(int score)
    {
        return Labels[Grade(score)];
    }

    public static void Main()
    {
        int[] scores = { 95, 82, 61 };
        Console.WriteLine(PercentChange(100, 125) + " " + Total(scores) + " " + GradeLabel(95));
    }
}
