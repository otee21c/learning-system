import React, { useRef, useEffect } from 'react';
import { storage } from '../../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// React 19 호환 - 라이브러리 없이 구현한 Rich Text Editor
const RichTextEditor = ({ value, onChange, placeholder = '내용을 입력하세요...' }) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const isInitialized = useRef(false);

  // 초기값 설정
  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = value || '';
      isInitialized.current = true;
    }
  }, [value]);

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

  // 키 입력 처리 (엔터키 문제 해결)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // 현재 선택 영역 가져오기
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // 줄바꿈 삽입
      const br = document.createElement('br');
      range.deleteContents();
      range.insertNode(br);
      
      // 커서를 줄바꿈 다음으로 이동
      range.setStartAfter(br);
      range.setEndAfter(br);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // 빈 줄을 위해 추가 br 삽입 (마지막 줄일 때)
      if (!br.nextSibling || br.nextSibling.nodeName === 'BR') {
        const extraBr = document.createElement('br');
        br.parentNode.insertBefore(extraBr, br.nextSibling);
      }
      
      handleChange();
    }
  };

  // 이미지 업로드
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 확인
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하만 가능합니다.');
      return;
    }

    try {
      // Firebase Storage에 업로드
      const fileName = `editor-images/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      // 에디터에 이미지 삽입
      editorRef.current?.focus();
      document.execCommand('insertImage', false, url);
      handleChange();
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      alert('이미지 업로드에 실패했습니다.');
    }

    // 파일 입력 초기화
    e.target.value = '';
  };

  // 이미지 버튼 클릭
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="hp-simple-editor">
      {/* 툴바 */}
      <div className="hp-simple-editor-toolbar">
        {/* 제목 크기 */}
        <select 
          onChange={(e) => {
            if (e.target.value) {
              execCommand('formatBlock', e.target.value);
            }
            e.target.value = '';
          }}
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
          ⫷
        </button>
        <button type="button" onClick={() => execCommand('justifyCenter')} className="hp-toolbar-btn" title="가운데 정렬">
          ☰
        </button>
        <button type="button" onClick={() => execCommand('justifyRight')} className="hp-toolbar-btn" title="오른쪽 정렬">
          ⫸
        </button>

        <div className="hp-toolbar-divider"></div>

        {/* 인용구 */}
        <button type="button" onClick={() => execCommand('formatBlock', 'blockquote')} className="hp-toolbar-btn" title="인용구">
          ❝
        </button>

        {/* 이미지 삽입 */}
        <button type="button" onClick={handleImageClick} className="hp-toolbar-btn" title="이미지 삽입">
          🖼️
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />

        <div className="hp-toolbar-divider"></div>

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
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
