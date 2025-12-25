import React, { useRef } from 'react';

// React 19 호환 - 라이브러리 없이 구현한 Rich Text Editor
const RichTextEditor = ({ value, onChange, placeholder = '내용을 입력하세요...' }) => {
  const editorRef = useRef(null);

  // 서식 적용 함수
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleChange();
  };

  // 내용 변경 처리
  const handleChange = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // 색상 선택
  const handleColorChange = (e, command) => {
    execCommand(command, e.target.value);
  };

  return (
    <div className="hp-simple-editor">
      {/* 툴바 */}
      <div className="hp-simple-editor-toolbar">
        {/* 제목 크기 */}
        <select 
          onChange={(e) => execCommand('formatBlock', e.target.value)}
          defaultValue=""
          className="hp-toolbar-select"
        >
          <option value="" disabled>글씨 크기</option>
          <option value="h1">제목 1</option>
          <option value="h2">제목 2</option>
          <option value="h3">제목 3</option>
          <option value="p">본문</option>
        </select>

        <div className="hp-toolbar-divider"></div>

        {/* 기본 서식 */}
        <button type="button" onClick={() => execCommand('bold')} className="hp-toolbar-btn" title="굵게">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => execCommand('italic')} className="hp-toolbar-btn" title="기울임">
          <em>I</em>
        </button>
        <button type="button" onClick={() => execCommand('underline')} className="hp-toolbar-btn" title="밑줄">
          <u>U</u>
        </button>
        <button type="button" onClick={() => execCommand('strikeThrough')} className="hp-toolbar-btn" title="취소선">
          <s>S</s>
        </button>

        <div className="hp-toolbar-divider"></div>

        {/* 색상 */}
        <label className="hp-toolbar-color" title="글자 색상">
          <span style={{ color: '#e74c3c' }}>A</span>
          <input 
            type="color" 
            onChange={(e) => handleColorChange(e, 'foreColor')}
            defaultValue="#000000"
          />
        </label>
        <label className="hp-toolbar-color" title="배경 색상">
          <span style={{ backgroundColor: '#f1c40f', padding: '0 4px' }}>A</span>
          <input 
            type="color" 
            onChange={(e) => handleColorChange(e, 'hiliteColor')}
            defaultValue="#ffffff"
          />
        </label>

        <div className="hp-toolbar-divider"></div>

        {/* 정렬 */}
        <button type="button" onClick={() => execCommand('justifyLeft')} className="hp-toolbar-btn" title="왼쪽 정렬">
          ≡
        </button>
        <button type="button" onClick={() => execCommand('justifyCenter')} className="hp-toolbar-btn" title="가운데 정렬">
          ≡
        </button>
        <button type="button" onClick={() => execCommand('justifyRight')} className="hp-toolbar-btn" title="오른쪽 정렬">
          ≡
        </button>

        <div className="hp-toolbar-divider"></div>

        {/* 목록 */}
        <button type="button" onClick={() => execCommand('insertOrderedList')} className="hp-toolbar-btn" title="번호 목록">
          1.
        </button>
        <button type="button" onClick={() => execCommand('insertUnorderedList')} className="hp-toolbar-btn" title="점 목록">
          •
        </button>

        <div className="hp-toolbar-divider"></div>

        {/* 인용구 */}
        <button type="button" onClick={() => execCommand('formatBlock', 'blockquote')} className="hp-toolbar-btn" title="인용구">
          "
        </button>

        {/* 서식 제거 */}
        <button type="button" onClick={() => execCommand('removeFormat')} className="hp-toolbar-btn" title="서식 제거">
          ✕
        </button>
      </div>

      {/* 에디터 영역 */}
      <div
        ref={editorRef}
        className="hp-simple-editor-content"
        contentEditable
        onInput={handleChange}
        onBlur={handleChange}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
