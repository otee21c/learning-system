import pyautogui
import time
from bs4 import BeautifulSoup
import tkinter as tk
from tkinter import filedialog
import re
import pyperclip

def select_html_file():
    """HTML 파일 선택 대화상자"""
    root = tk.Tk()
    root.withdraw()
    
    file_path = filedialog.askopenfilename(
        title="HTML 파일을 선택하세요",
        filetypes=[("HTML files", "*.html"), ("모든 파일", "*.*")],
        initialdir="."
    )
    
    root.destroy()
    return file_path

def get_style_shortcut(text):
    """텍스트 내용에 따라 한글 스타일 단축키 반환"""
    if text.startswith('[문제]'):
        return 'ctrl+3'  # a.문제
    elif text.startswith('[교사용정답]') or text.startswith('[정답해설]'):
        return 'ctrl+5'  # a.교사용정답  
    elif text.startswith('[선택지]'):
        return 'ctrl+4'  # a.문항제시문
    elif text.startswith('[보기]'):
        return 'ctrl+6'  # a.보기내어쓰기
    elif text.startswith('[지문또는문단]') or text.startswith('[지문]') or text.startswith('[문단]'):
        return 'ctrl+2'  # a.본문
    elif text.startswith('[희곡지문]'):
        return 'ctrl+8'  # a.박스안희곡
    elif text.startswith('[밑줄]'):
        return 'ctrl+9'  # a.밑줄_노랑
    elif text.startswith('[학생용]'):
        return 'ctrl+0'  # a.학생용정답
    else:
        return 'ctrl+1'  # 바탕글

def clean_text_content(text):
    """태그를 제거하고 순수 내용만 반환"""
    cleaned_text = re.sub(r'^\[[^\]]+\]\s*', '', text)
    return cleaned_text.strip()

def get_content_type(text):
    """텍스트 유형 판단"""
    if text.startswith('[지문또는문단]') or text.startswith('[지문]') or text.startswith('[문단]'):
        return 'content'
    elif text.startswith('[문제]'):
        return 'question'
    elif text.startswith('[보기]'):
        return 'choice'
    elif text.startswith('[선택지]'):
        return 'option'
    elif text.startswith('[교사용정답]') or text.startswith('[정답해설]'):
        return 'answer'
    else:
        return 'other'

def apply_hwp_formatting(text, font_weight, font_size):
    """한글에서 스타일 단축키를 사용하여 서식 적용 - 완전한 간격 제어"""
    try:
        clean_content = clean_text_content(text)
        
        # 현재 항목 유형 판단
        current_type = get_content_type(text)
        
        # 새로운 문제 시작시 플래그 초기화
        if current_type == 'question':
            apply_hwp_formatting.boxgi_started = False
            apply_hwp_formatting.option_started = False
            print("    새 문제 시작 - 플래그 초기화")
        
        # 이전 항목과의 관계에 따른 공백 처리
        if hasattr(apply_hwp_formatting, 'prev_type') and apply_hwp_formatting.prev_type:
            prev_type = apply_hwp_formatting.prev_type
            
            # 공백줄이 필요한 상황들
            need_blank_line = False
            
            # 1. 지문 → 문제
            if prev_type == 'content' and current_type == 'question':
                need_blank_line = True
                print("    지문→문제 공백줄 추가")
            
            # 2. 문제 → 보기 (첫 번째 보기만)
            elif prev_type == 'question' and current_type == 'choice' and not apply_hwp_formatting.boxgi_started:
                need_blank_line = True
                apply_hwp_formatting.boxgi_started = True
                print("    문제→보기 공백줄 추가")
            
            # 3. 보기 → 선택지 (첫 번째 선택지만)
            elif prev_type == 'choice' and current_type == 'option' and not apply_hwp_formatting.option_started:
                need_blank_line = True
                apply_hwp_formatting.option_started = True
                print("    보기→선택지 공백줄 추가")
            
            # 공백줄 삽입 (교사용정답 스타일로 변경)
            if need_blank_line:
                pyautogui.hotkey('ctrl', '5')  # 교사용정답 스타일
                time.sleep(0.1)
                pyautogui.press('enter')
                time.sleep(0.1)
        
        # 내용 입력
        pyperclip.copy(clean_content)
        time.sleep(0.1)
        
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(0.4)
        
        # 안정적인 선택: Shift+Home (현재 줄만)
        pyautogui.hotkey('shift', 'home')
        time.sleep(0.1)
        
        style_shortcut = get_style_shortcut(text)
        print(f"    스타일 적용: {style_shortcut}")
        
        if '+' in style_shortcut:
            keys = style_shortcut.split('+')
            pyautogui.hotkey(*keys)
        else:
            pyautogui.press(style_shortcut)
        
        time.sleep(0.3)
        
        pyautogui.press('end')
        
        # 개별 항목별 간격 처리 (수정됨)
        if current_type in ['choice', 'option']:
            # 보기와 선택지는 1번 엔터 (붙어서 나옴)
            pyautogui.press('enter', presses=1)
        else:
            # 나머지는 2번 엔터 (구분됨)
            pyautogui.press('enter', presses=2)
        
        time.sleep(0.1)
        
        # 현재 유형을 다음 처리를 위해 저장
        apply_hwp_formatting.prev_type = current_type
        
        return True
        
    except Exception as e:
        print(f"서식 적용 중 오류: {e}")
        return False

def analyze_html(file_path):
    """HTML 파일 분석하여 항목들 추출 - 순서 보장"""
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    print(f"HTML 파일 크기: {len(content)} 문자")
    
    soup = BeautifulSoup(content, 'html.parser')
    items = []
    
    # HTML div 요소들을 순서대로 처리
    divs = soup.find_all('div')
    print(f"발견된 div 요소: {len(divs)}개")
    
    for div in divs:
        text = div.get_text(strip=True)
        if text:  # 텍스트가 있는 div만 처리
            style = div.get('style', '')
            font_weight = 'bold' if 'font-weight: bold' in style else 'normal'
            font_size = '12pt'
            
            # 폰트 크기 추출
            if 'font-size:' in style:
                size_match = re.search(r'font-size:\s*(\d+(?:\.\d+)?)pt', style)
                if size_match:
                    font_size = f"{size_match.group(1)}pt"
            
            items.append({
                'text': text,
                'font_weight': font_weight,
                'font_size': font_size,
                'style': style,
                'tag': 'div'
            })
    
    print(f"최종 추출된 항목: {len(items)}개")
    return items

def preview_items(items):
    """분석된 항목들 미리보기"""
    print(f"\n분석 결과: {len(items)}개 항목")
    print("=" * 70)
    
    for i, item in enumerate(items, 1):
        style_shortcut = get_style_shortcut(item['text'])
        style_name = {
            'ctrl+1': '바탕글',
            'ctrl+2': 'a.본문', 
            'ctrl+3': 'a.문제',
            'ctrl+4': 'a.문항제시문',
            'ctrl+5': 'a.교사용정답',
            'ctrl+6': 'a.보기내어쓰기',
            'ctrl+7': 'a.보기들여쓰기',
            'ctrl+8': 'a.박스안희곡',
            'ctrl+9': 'a.밑줄_노랑',
            'ctrl+0': 'a.학생용정답'
        }.get(style_shortcut, '알 수 없음')
        
        clean_content = clean_text_content(item['text'])
        preview_text = clean_content[:40] + "..." if len(clean_content) > 40 else clean_content
        
        content_type = get_content_type(item['text'])
        print(f"{i:2d}. [{style_name}] ({content_type}) {preview_text}")
        
        if i >= 10:
            if len(items) > 10:
                print(f"    ... 외 {len(items) - 10}개 항목")
            break
    
    print("=" * 70)

def countdown(seconds):
    """카운트다운 표시"""
    for i in range(seconds, 0, -1):
        print(f"자동화 시작까지 {i}초...")
        time.sleep(1)
    print("시작!")

def main():
    print("=" * 60)
    print("HTML -> 한글 완전 자동화 프로그램 v2.1")
    print("=" * 60)
    
    # 상태 플래그 초기화
    apply_hwp_formatting.prev_type = None
    apply_hwp_formatting.boxgi_started = False
    apply_hwp_formatting.option_started = False
    
    html_file = select_html_file()
    
    if not html_file:
        print("파일이 선택되지 않았습니다.")
        return
    
    items = analyze_html(html_file)
    
    if not items:
        print("분석할 항목이 없습니다.")
        return
    
    preview_items(items)
    
    response = input(f"\n{len(items)}개 항목을 자동 처리하시겠습니까? (y/n): ").lower().strip()
    
    if response != 'y':
        print("자동화를 취소했습니다.")
        return
    
    try:
        windows = pyautogui.getWindowsWithTitle('한글')
        if windows:
            windows[0].activate()
            time.sleep(1)
    except:
        print("한글 창을 활성화할 수 없습니다.")
    
    countdown(5)
    
    success_count = 0
    
    for i, item in enumerate(items, 1):
        try:
            content_type = get_content_type(item['text'])
            print(f"처리 중 ({i}/{len(items)}) [{content_type}]: {item['text'][:20]}...")
            
            success = apply_hwp_formatting(
                item['text'], 
                item['font_weight'], 
                item['font_size']
            )
            
            if success:
                success_count += 1
                print(f"  ✅ 성공")
            else:
                print(f"  ❌ 실패")
            
            time.sleep(0.3)
            
        except KeyboardInterrupt:
            print("\n사용자가 중단했습니다.")
            break
        except Exception as e:
            print(f"  오류: {e}")
    
    print(f"\n🎉 자동화 완료! ({success_count}/{len(items)}개 성공)")

# 상태 관리용 플래그들
apply_hwp_formatting.prev_type = None
apply_hwp_formatting.boxgi_started = False
apply_hwp_formatting.option_started = False

if __name__ == "__main__":
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.1
    
    try:
        main()
    except KeyboardInterrupt:
        print("\n프로그램이 중단되었습니다.")
    except Exception as e:
        print(f"\n오류: {e}")
    
    input("\nEnter를 눌러 종료하세요...")