import os
import json
import time
import urllib.request
import urllib.parse

def translate_text(text, target_lang='vi'):
    if not text:
        return text
    
    # Try using free Google Translate API endpoint
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={}&dt=t&q={}".format(
        target_lang, urllib.parse.quote(text)
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                translated = "".join([segment[0] for segment in result[0]])
                return translated
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"  [!] Lỗi dịch thuật '{text[:30]}...': {e}")
                return text
            time.sleep(2)

def process_quiz_file(filepath):
    print(f"Đang xử lý: {filepath}")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        changed = False
        if 'questions' in data:
            for idx, q in enumerate(data['questions']):
                # Dịch câu hỏi
                if 'question' in q and isinstance(q['question'], str):
                    # Check if already translated to Vietnamese (basic heuristic)
                    if not any(vietnamese_word in q['question'].lower() for vietnamese_word in [' là gì', 'tại sao', 'như thế nào']):
                        translated_q = translate_text(q['question'])
                        if translated_q and translated_q != q['question']:
                            q['question'] = translated_q
                            changed = True
                
                # Dịch giải thích
                if 'explanation' in q and isinstance(q['explanation'], str):
                    if not any(vietnamese_word in q['explanation'].lower() for vietnamese_word in [' là ', 'được']):
                        translated_e = translate_text(q['explanation'])
                        if translated_e and translated_e != q['explanation']:
                            q['explanation'] = translated_e
                            changed = True
                
                # Dịch các lựa chọn
                if 'options' in q and isinstance(q['options'], list):
                    new_options = []
                    for opt in q['options']:
                        if isinstance(opt, str) and not any(v_word in opt.lower() for v_word in ['của', 'trong', 'các']):
                            translated_opt = translate_text(opt)
                            new_options.append(translated_opt if translated_opt else opt)
                            if translated_opt and translated_opt != opt:
                                changed = True
                        else:
                            new_options.append(opt)
                    q['options'] = new_options
                
                # Nghỉ ngắn để tránh bị rate limit
                time.sleep(0.5)
        
        if changed:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f" -> Đã dịch và lưu thành công!")
        else:
            print(f" -> Không có thay đổi (có thể đã được dịch).")
            
    except Exception as e:
        print(f"Lỗi khi xử lý file: {e}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    count = 0
    # Tìm tất cả các file quiz.json
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file == "quiz.json":
                filepath = os.path.join(root, file)
                process_quiz_file(filepath)
                count += 1
                
    print(f"\nĐã hoàn tất duyệt qua {count} file quiz.json!")

if __name__ == "__main__":
    print("Bắt đầu tự động dịch các file quiz.json sang tiếng Việt...")
    main()
