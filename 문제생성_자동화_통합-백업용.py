# -*- coding: utf-8 -*-
"""
국어 문제 자동 생성 + 한글 자동화 통합 (강력한 프롬프트)
"""

import anthropic
import os
from datetime import datetime
import pyautogui
import time
import pyperclip
import re
from bs4 import BeautifulSoup

# ========== 설정 ==========
API_KEY = "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"
MODEL = "claude-sonnet-4-20250514"
# ============================

# ========== 강력한 프롬프트 (Few-shot Examples) ==========
보기형_프롬프트 = """
<중요한_출력_규칙>
**절대 규칙: 아래 태그 형식을 정확히 따라야 합니다**
- [문제] 태그로 문제 시작
- [보기] 태그로 보기 각 줄
- [선택지] 태그로 각 선택지
- [교사용정답] 태그로 정답과 해설 (한 줄로)
- 문제 번호(1., 2., 3.)를 절대 붙이지 마세요
- [Odyssey], 특수문자(󰂼, 󰃛) 등 불필요한 내용 절대 금지
</중요한_출력_규칙>

**정확한 출력 예시 1:**

[문제] 다음 <보기>를 참고하여 윗글을 이해한 내용으로 적절한 것은?

[보기] 물리학에서 파동-입자 이중성은 빛과 전자가 파동과 입자의 성질을 동시에 가진다는 개념이다.
[보기] 이는 양자역학의 핵심 원리로, 관찰 방법에 따라 결과가 달라진다.

[선택지] ① 빛은 파동의 성질만 갖는다.
[선택지] ② 양자역학은 관찰과 무관하게 작동한다.
[선택지] ③ 전자는 관찰 방법에 따라 다르게 나타난다.
[선택지] ④ 파동-입자 이중성은 거시세계에만 적용된다.
[선택지] ⑤ 양자역학에서는 확률이 중요하지 않다.

[교사용정답] 정답) ③ 해설) 지문 2문단에서 양자역학의 관측 의존성을 설명했고, 보기에서 관찰 방법에 따라 결과가 달라진다고 했으므로 ③이 적절하다.

**정확한 출력 예시 2:**

[문제] 다음 <보기>의 상황을 윗글의 내용과 관련지어 이해한 것으로 적절하지 않은 것은?

[보기] A국은 경제 성장을 위해 금리를 인하했다. 그 결과 기업 투자가 증가했지만 물가도 상승했다.

[선택지] ① 금리 인하는 투자 심리를 개선시켰다.
[선택지] ② 저금리 정책이 인플레이션을 유발했다.
[선택지] ③ 경제 성장과 물가 안정은 상충될 수 있다.
[선택지] ④ 금리 정책은 경제에 영향을 미치지 않는다.
[선택지] ⑤ 통화정책은 여러 변수를 고려해야 한다.

[교사용정답] 정답) ④ 해설) 지문 3문단에서 금리 정책이 경제 전반에 영향을 미친다고 설명했고, 보기의 사례도 이를 보여주므로 ④는 부적절하다.

**정확한 출력 예시 3:**

[문제] <보기>는 윗글의 이론을 실제 사례에 적용한 것이다. 적절하지 않은 것은?

[보기] 기업 X는 시장 점유율을 높이기 위해 가격을 대폭 인하했다.
[보기] 경쟁사들도 가격을 낮추면서 가격 경쟁이 심화되었다.
[보기] 결국 모든 기업의 수익성이 악화되는 결과를 낳았다.

[선택지] ① 개별 기업의 합리적 선택이 집단적으로는 비합리적일 수 있다.
[선택지] ② 시장 경쟁은 항상 소비자에게 유리하다.
[선택지] ③ 가격 경쟁의 심화는 산업 전체에 부정적일 수 있다.
[선택지] ④ 단기 이익 추구가 장기적으로는 손해를 가져올 수 있다.
[선택지] ⑤ 죄수의 딜레마 상황이 발생했다고 볼 수 있다.

[교사용정답] 정답) ② 해설) 지문 4문단에서 과도한 가격 경쟁이 시장 전체의 파이를 줄일 수 있다고 했으므로, 항상 소비자에게 유리하다는 ②는 적절하지 않다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 세 가지 예시의 형식을 **정확히** 따라서 보기형 문제 3개를 출제하세요.
- 반드시 태그를 사용하세요
- 문제 번호를 붙이지 마세요
- 정답과 해설은 한 줄로 작성하세요
"""

OX_프롬프트 = """
<중요한_출력_규칙>
**절대 규칙: 아래 형식을 정확히 따라야 합니다**
- [문제] 태그로 각 문제 시작
- [교사용정답] 태그로 정답과 해설 (한 줄로)
- 문제 번호(1., 2., 3.)를 절대 붙이지 마세요
- 불필요한 특수문자, [Odyssey] 등 절대 금지
</중요한_출력_규칙>

**정확한 출력 예시:**

[문제] 윗글에 따르면 맹자는 인간의 본성이 선천적으로 악하다고 보았다. (O/X)
[교사용정답] 정답) X 해설) 지문 1문단에서 맹자는 인간의 본성이 선하다고 보았다고 명시되어 있다.

[문제] 순자는 인간의 생리적 욕구가 이기심의 근원이라고 생각했다. (O/X)
[교사용정답] 정답) O 해설) 지문 1문단에서 순자는 배고프면 먹고 싶은 등의 생리적 욕구에 바탕한 이기심이 있다고 했다.

[문제] 순자의 '위'는 본성을 그대로 따르는 행위를 의미한다. (O/X)
[교사용정답] 정답) X 해설) 지문 3문단에서 '위'는 본성을 거스르는 의지적 실천이라고 설명했다.

[문제] 맹자는 모든 사람이 도덕성을 가지고 태어난다고 보았다. (O/X)
[교사용정답] 정답) O 해설) 지문 5문단에서 맹자는 인간의 본성이 착하다고 했으며, 이는 모든 인간이 도덕성을 가진다는 의미이다.

[문제] 순자는 요순과 걸·도척의 본성이 다르다고 주장했다. (O/X)
[교사용정답] 정답) X 해설) 지문 5문단에서 순자는 요순과 걸·도척의 본성이 같다고 보았다고 명시되어 있다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 형식을 **정확히** 따라서 OX 문제 15개를 출제하세요.
"""

최다선지_프롬프트 = """
<중요한_출력_규칙>
**절대 규칙: 아래 형식을 정확히 따라야 합니다**
- [문제] 태그로 문제 시작
- [선택지] 태그로 각 선택지 (①~⑳)
- [교사용정답] 태그로 정답
- [해설] 태그 없이 교사용정답에 모두 포함
- 불필요한 특수문자 절대 금지
</중요한_출력_규칙>

**정확한 출력 예시:**

[문제] 윗글의 내용으로 맞는 것을 모두 고르시오.

[선택지] ① 맹자는 인간의 본성이 선천적으로 선하다고 보았다.
[선택지] ② 순자는 인간의 도덕성이 본성에서 나온다고 생각했다.
[선택지] ③ 순자의 '성'은 날 때부터 가진 본성을 의미한다.
[선택지] ④ 맹자는 군자와 소인의 본성이 다르다고 보았다.
[선택지] ⑤ 순자는 본성대로 살면 악한 결과가 나온다고 했다.
[선택지] ⑥ 맹자는 모든 사람에게 동등한 도덕성을 인정했다.
[선택지] ⑦ 순자의 '려'는 감정이 생긴 후 선택하는 사고 작용이다.
[선택지] ⑧ 맹자는 인간의 생리적 측면을 본성으로 인정하지 않았다.
[선택지] ⑨ 순자는 요순과 걸의 본성이 동일하다고 보았다.
[선택지] ⑩ 맹자는 훌륭한 제도가 필요 없다고 주장했다.
[선택지] ⑪ 순자의 '위'는 본성을 억누르는 의지적 실천이다.
[선택지] ⑫ 맹자와 순자 모두 본성을 선천적이라고 규정했다.
[선택지] ⑬ 순자는 인간의 마음을 네 단계로 나누어 설명했다.
[선택지] ⑭ 맹자는 일반 백성의 도덕성을 전적으로 부정했다.
[선택지] ⑮ 순자는 도덕성이 후천적 노력의 결과라고 보았다.
[선택지] ⑯ 맹자의 이론은 현실의 악한 행위를 설명하기 어렵다.
[선택지] ⑰ 순자의 '정'은 외부 사물과 만나 생기는 감정이다.
[선택지] ⑱ 맹자는 군자만이 진정한 도덕성을 가진다고 보았다.
[선택지] ⑲ 순자는 본성이 악하므로 교화가 불가능하다고 했다.
[선택지] ⑳ 순자에게 선은 본성을 거스른 결과이다.

[교사용정답] 정답) ①, ③, ⑤, ⑦, ⑨, ⑪, ⑫, ⑬, ⑮, ⑰, ⑳ 해설) ② X - 순자는 도덕성이 본성이 아닌 후천적 노력의 결과라고 했다. ④ X - 맹자는 군자와 소인이 본성을 보는 관점이 다를 뿐 본성 자체는 같다고 봤다. ⑥ X - 맹자는 군자의 도덕성을 강조했다. ⑧ X - 맹자도 생리적 측면을 인정했으나 소인의 관점으로 봤다. ⑩ X - 맹자가 이렇게 주장했다는 내용은 없다. ⑭ X - 맹자는 백성도 교화받을 자질이 있다고 봤다. ⑯ X - 이는 순자의 맹자 비판 내용이다. ⑱ O - 지문에 명시되어 있다. ⑲ X - 순자는 오히려 교화를 통한 변화를 강조했다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 형식을 **정확히** 따라서 최다선지 문제 1개 (선택지 20개)를 출제하세요.
"""


# ========== API 함수 (System Prompt 추가) ==========
def claude_호출(지문, 프롬프트_종류):
    """Claude API 호출 (강력한 제약 조건)"""
    
    프롬프트_맵 = {
        "보기형": 보기형_프롬프트,
        "OX": OX_프롬프트,
        "최다선지": 최다선지_프롬프트
    }
    
    try:
        client = anthropic.Anthropic(api_key=API_KEY)
        print(f"\n[{프롬프트_종류} 문제 생성 중...]")
        
        message = client.messages.create(
            model=MODEL,
            max_tokens=16000,
            temperature=0,  # 일관성 강화
            system="""당신은 한글 자동화 태그 형식을 정확히 준수하는 문제 출제 전문가입니다.

**절대 규칙:**
1. [문제], [선택지], [보기], [교사용정답] 태그를 정확히 사용
2. 문제 번호(1., 2., 3.)를 절대 붙이지 않음
3. [Odyssey], 특수문자(󰂼, 󰃛) 등 불필요한 내용 절대 금지
4. 제시된 예시 형식을 정확히 따름""",
            messages=[{
                "role": "user", 
                "content": f"{프롬프트_맵[프롬프트_종류]}\n\n===지문===\n{지문}"
            }]
        )
        
        결과 = message.content[0].text
        print(f"[{프롬프트_종류} 완료!]")
        return 결과
        
    except Exception as e:
        print(f"오류: {str(e)}")
        return ""


# ========== 텍스트 처리 함수 ==========
def 지문_문단별_태그(지문):
    """지문을 문단별로 태그 적용"""
    문단들 = [p.strip() for p in 지문.split('\n\n') if p.strip()]
    
    if len(문단들) <= 1:
        문단들 = [p.strip() for p in 지문.split('\n') if p.strip()]
    
    결과 = []
    for 문단 in 문단들:
        if 문단:
            결과.append(f'[지문또는문단] {문단}')
    
    return '\n\n'.join(결과)


def 문제번호_제거(텍스트):
    """문제 번호 제거"""
    lines = 텍스트.split('\n')
    결과 = []
    
    for line in lines:
        if line.strip().startswith('[문제]'):
            line = re.sub(r'^\[문제\]\s*\d+\.\s*', '[문제] ', line)
        결과.append(line)
    
    return '\n'.join(결과)


def 태그_수정(텍스트):
    """잘못된 태그 구조 수정"""
    
    lines = 텍스트.split('\n')
    결과 = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 쓰레기 문자 제거
        if any(x in line for x in ['[Odyssey]', '󰂼', '󰃛', '[세부 정보', '[세부 내용']):
            continue
        
        # [지문또는문단] [문제] → [문제]
        if '[지문또는문단]' in line and '[문제]' in line:
            line = line.replace('[지문또는문단]', '').strip()
        
        # [지문또는문단] [선택지] → [선택지]
        elif '[지문또는문단]' in line and '[선택지]' in line:
            line = line.replace('[지문또는문단]', '').strip()
        
        # [지문또는문단] [보기] → [보기]
        elif '[지문또는문단]' in line and '[보기]' in line:
            line = line.replace('[지문또는문단]', '').strip()
        
        # [지문또는문단] [교사용정답] → [교사용정답]
        elif '[지문또는문단]' in line and ('[교사용정답]' in line or '[해설]' in line):
            line = line.replace('[지문또는문단]', '').replace('[해설]', '[교사용정답]').strip()
        
        # [지문또는문단] ① → [선택지] ①
        elif '[지문또는문단]' in line and re.search(r'[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]', line):
            line = line.replace('[지문또는문단]', '[선택지]')
        
        # 실제 지문 문단만 유지
        elif line.startswith('[지문또는문단]'):
            내용 = line.replace('[지문또는문단]', '').strip()
            if len(내용) > 30:  # 충분히 긴 경우만
                결과.append(line)
                continue
            else:
                continue
        
        결과.append(line)
    
    return '\n'.join(결과)


def 태그텍스트를_HTML로_변환(태그텍스트):
    """태그 텍스트 → HTML"""
    
    html_lines = ['<!DOCTYPE html>', '<html>', '<head>', 
                  '<meta charset="UTF-8">', '</head>', '<body>']
    
    lines = 태그텍스트.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        html_lines.append(f'<div>{line}</div>')
    
    html_lines.extend(['</body>', '</html>'])
    
    return '\n'.join(html_lines)


def HTML파일_저장(html_내용, 파일명):
    """HTML 파일 저장"""
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    전체파일명 = f"{timestamp}_{파일명}"
    
    with open(전체파일명, 'w', encoding='utf-8') as f:
        f.write(html_내용)
    
    print(f"✓ HTML 저장: {전체파일명}")
    return 전체파일명


# ========== 한글 자동화 함수 ==========
def get_style_shortcut(text):
    """태그에 따라 단축키 반환"""
    if text.startswith('[문제]'):
        return 'ctrl+3'
    elif text.startswith('[교사용정답]'):
        return 'ctrl+5'
    elif text.startswith('[선택지]'):
        return 'ctrl+4'
    elif text.startswith('[보기]'):
        return 'ctrl+7'
    elif text.startswith('[지문또는문단]'):
        return 'ctrl+2'
    else:
        return 'ctrl+1'


def clean_text_content(text):
    """태그 제거"""
    cleaned = re.sub(r'^\[[^\]]+\]\s*', '', text)
    return cleaned.strip()


def get_content_type(text):
    """내용 유형 판단"""
    if text.startswith('[지문또는문단]'):
        return 'content'
    elif text.startswith('[문제]'):
        return 'question'
    elif text.startswith('[보기]'):
        return 'choice'
    elif text.startswith('[선택지]'):
        return 'option'
    elif text.startswith('[교사용정답]'):
        return 'answer'
    else:
        return 'other'


def apply_hwp_formatting(text):
    """한글에 서식 적용"""
    
    try:
        clean_content = clean_text_content(text)
        current_type = get_content_type(text)
        
        if current_type == 'question':
            apply_hwp_formatting.choice_started = False
            apply_hwp_formatting.option_started = False
        
        if hasattr(apply_hwp_formatting, 'prev_type') and apply_hwp_formatting.prev_type:
            prev_type = apply_hwp_formatting.prev_type
            need_blank = False
            
            if prev_type == 'content' and current_type == 'question':
                need_blank = True
            elif prev_type == 'question' and current_type == 'choice' and not apply_hwp_formatting.choice_started:
                need_blank = True
                apply_hwp_formatting.choice_started = True
            elif prev_type == 'choice' and current_type == 'option' and not apply_hwp_formatting.option_started:
                need_blank = True
                apply_hwp_formatting.option_started = True
            
            if need_blank:
                pyautogui.hotkey('ctrl', '5')
                time.sleep(0.1)
                pyautogui.press('enter')
                time.sleep(0.1)
        
        pyperclip.copy(clean_content)
        time.sleep(0.1)
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(0.4)
        
        pyautogui.hotkey('shift', 'home')
        time.sleep(0.1)
        
        style = get_style_shortcut(text)
        keys = style.split('+')
        pyautogui.hotkey(*keys)
        time.sleep(0.3)
        
        pyautogui.press('end')
        
        if current_type in ['choice', 'option']:
            pyautogui.press('enter', presses=1)
        else:
            pyautogui.press('enter', presses=2)
        
        time.sleep(0.1)
        
        apply_hwp_formatting.prev_type = current_type
        return True
        
    except Exception as e:
        print(f"서식 적용 오류: {e}")
        return False


def analyze_html_content(html_content):
    """HTML 파싱"""
    
    soup = BeautifulSoup(html_content, 'html.parser')
    items = []
    
    divs = soup.find_all('div')
    
    for div in divs:
        text = div.get_text(strip=True)
        if text:
            items.append({'text': text})
    
    return items


def 한글자동화_실행(html_파일경로):
    """한글 자동화 실행"""
    
    print("\n[한글 자동화 시작]")
    
    with open(html_파일경로, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    items = analyze_html_content(html_content)
    print(f"→ {len(items)}개 항목 감지")
    
    print("→ 5초 후 한글에 자동 입력 시작...")
    print("   (한글 창을 활성화하세요)")
    
    try:
        windows = pyautogui.getWindowsWithTitle('한글')
        if windows:
            windows[0].activate()
    except:
        pass
    
    for i in range(5, 0, -1):
        print(f"   {i}초...")
        time.sleep(1)
    
    print("→ 시작!")
    
    apply_hwp_formatting.prev_type = None
    apply_hwp_formatting.choice_started = False
    apply_hwp_formatting.option_started = False
    
    success = 0
    for i, item in enumerate(items, 1):
        try:
            if apply_hwp_formatting(item['text']):
                success += 1
            
            if i % 10 == 0:
                print(f"   진행: {i}/{len(items)}")
            
        except KeyboardInterrupt:
            print("\n중단됨")
            break
        except Exception as e:
            print(f"오류: {e}")
    
    print(f"✓ 완료: {success}/{len(items)} 성공")


# ========== 메인 함수 ==========
def 메인실행():
    """통합 메인"""
    
    print("=" * 60)
    print("     국어 문제 자동 생성 + 한글 자동화 통합")
    print("=" * 60)
    
    if API_KEY == "여기에_실제_API_키_입력":
        print("⚠️  API 키를 설정하세요")
        input("\nEnter...")
        return
    
    print("\n지문을 입력하세요 (Enter 3번):")
    print("-" * 60)
    
    lines = []
    empty = 0
    while empty < 2:
        line = input()
        if line == "":
            empty += 1
        else:
            empty = 0
            lines.append(line)
    
    지문 = "\n".join(lines)
    
    if not 지문.strip():
        print("지문 없음")
        return
    
    print(f"\n✓ 지문 입력 완료 ({len(지문)}자)")
    
    print("\n" + "=" * 60)
    print("문제 생성 중...")
    print("=" * 60)
    
    결과 = {}
    for 종류 in ["보기형", "OX", "최다선지"]:
        결과[종류] = claude_호출(지문, 종류)
        결과[종류] = 문제번호_제거(결과[종류])
        결과[종류] = 태그_수정(결과[종류])
    
    태그_지문 = 지문_문단별_태그(지문)
    
    전체내용 = f"""{태그_지문}

━━━━━━━━━━━━━━━━━━━━━━

▣ 보기형 문제

{결과["보기형"]}

━━━━━━━━━━━━━━━━━━━━━━

▣ OX 문제

{결과["OX"]}

━━━━━━━━━━━━━━━━━━━━━━

▣ 최다선지 문제

{결과["최다선지"]}
"""
    
    print("\n" + "=" * 60)
    print("HTML 변환 중...")
    print("-" * 60)
    
    html내용 = 태그텍스트를_HTML로_변환(전체내용)
    html파일 = HTML파일_저장(html내용, "문제.html")
    
    print("\n" + "=" * 60)
    한글자동화_실행(html파일)
    
    print("\n" + "=" * 60)
    print("     🎉 모든 작업 완료!")
    print("=" * 60)
    input("\nEnter를 눌러 종료...")


# ========== 프로그램 시작 ==========
if __name__ == "__main__":
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.1
    
    try:
        메인실행()
    except KeyboardInterrupt:
        print("\n중단됨")
    except Exception as e:
        print(f"\n오류: {e}")