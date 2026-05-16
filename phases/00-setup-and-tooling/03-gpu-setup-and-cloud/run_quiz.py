import json
import os
import time

def run_quiz():
    quiz_file = "quiz.json"
    
    # Lấy đường dẫn tuyệt đối của thư mục chứa script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    quiz_path = os.path.join(script_dir, quiz_file)

    if not os.path.exists(quiz_path):
        print(f"❌ Lỗi: Không tìm thấy file '{quiz_file}' tại {quiz_path}.")
        return

    with open(quiz_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get('questions', [])
    if not questions:
        print("Không có câu hỏi nào trong file quiz.")
        return

    print("=" * 60)
    print("🚀 BÀI KIỂM TRA: THIẾT LẬP GPU & CLOUD 🚀")
    print("=" * 60)
    print()

    score = 0
    total = len(questions)

    for i, q in enumerate(questions, 1):
        print(f"Câu hỏi {i}/{total}: {q['question']}")
        print("-" * 60)
        
        options = q['options']
        for j, opt in enumerate(options):
            print(f"  [{j}] {opt}")
        
        print()
        
        while True:
            try:
                answer_str = input("👉 Lựa chọn của bạn (nhập số từ 0 đến " + str(len(options)-1) + "): ")
                answer = int(answer_str)
                if 0 <= answer < len(options):
                    break
                else:
                    print(f"⚠️ Vui lòng nhập số từ 0 đến {len(options)-1}.")
            except ValueError:
                print("⚠️ Lựa chọn không hợp lệ. Vui lòng nhập một số.")
        
        if answer == q['correct']:
            print("\n✅ CHÍNH XÁC!")
            score += 1
        else:
            print(f"\n❌ SAI RỒI. Đáp án đúng là [{q['correct']}]: {options[q['correct']]}")
            
        print(f"💡 Giải thích: {q['explanation']}\n")
        time.sleep(1)
        print("=" * 60)

    print(f"🎉 Hoàn thành bài kiểm tra! Điểm của bạn: {score}/{total} ({(score/total)*100:.1f}%)")
    print("=" * 60)

if __name__ == "__main__":
    try:
        run_quiz()
    except KeyboardInterrupt:
        print("\n\nĐã hủy bài kiểm tra. Hẹn gặp lại!")
