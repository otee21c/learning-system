import React, { useState } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function HomeworkSubmission({ currentUser, homeworks = [] }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [selectedHomework, setSelectedHomework] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('image'); // 'image' or 'pdf'

  // 파일 선택 핸들러
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (uploadType === 'image' && files.length > 10) {
      alert('이미지는 최대 10장까지 업로드 가능합니다!');
      return;
    }

    if (uploadType === 'pdf' && files.length > 1) {
      alert('PDF는 1개만 업로드 가능합니다!');
      return;
    }

    setSelectedFiles(files);

    // 미리보기 생성
    const previews = files.map(file => {
      if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ type: 'image', url: reader.result, name: file.name });
          reader.readAsDataURL(file);
        });
      } else if (file.type === 'application/pdf') {
        return Promise.resolve({ type: 'pdf', name: file.name });
      }
    });

    Promise.all(previews).then(setFilePreviews);
  };

  // 과제 제출
  const handleSubmit = async () => {
    if (!selectedHomework) {
      alert('과제를 선택해주세요!');
      return;
    }

    if (selectedFiles.length === 0) {
      alert('파일을 선택해주세요!');
      return;
    }

    setUploading(true);

    try {
      // 파일 업로드
      const uploadedUrls = [];
      for (const file of selectedFiles) {
        const storageRef = ref(storage, `homework-submissions/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push({ url, name: file.name, type: file.type });
      }

      // Firestore에 저장
      await addDoc(collection(db, 'homeworkSubmissions'), {
        studentId: currentUser.id,
        studentName: currentUser.name,
        homeworkId: selectedHomework,
        homeworkTitle: homeworks.find(h => h.id === selectedHomework)?.title || '',
        files: uploadedUrls,
        fileCount: uploadedUrls.length,
        uploadType: uploadType,
        submittedAt: new Date().toISOString(),
        status: '제출완료'
      });

      alert('과제가 성공적으로 제출되었습니다!');
      
      // 초기화
      setSelectedFiles([]);
      setFilePreviews([]);
      setSelectedHomework('');

    } catch (error) {
      console.error('과제 제출 오류:', error);
      alert('과제 제출 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 초기화
  const handleReset = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setSelectedHomework('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
        📝 과제 제출
      </h2>

      <div className="space-y-6">
        {/* 과제 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            제출할 과제 선택
          </label>
          {homeworks && homeworks.length > 0 ? (
            <select
              value={selectedHomework}
              onChange={(e) => setSelectedHomework(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">과제를 선택하세요</option>
              {homeworks.map((homework) => (
                <option key={homework.id} value={homework.id}>
                  {homework.title} - 마감: {homework.deadline || '미정'}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-gray-500 text-sm p-4 bg-gray-50 rounded-lg">
              현재 제출 가능한 과제가 없습니다.
            </div>
          )}
        </div>

        {/* 업로드 타입 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            제출 방법 선택
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => { setUploadType('image'); handleReset(); }}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                uploadType === 'image'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🖼️ 이미지 (최대 10장)
            </button>
            <button
              onClick={() => { setUploadType('pdf'); handleReset(); }}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                uploadType === 'pdf'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📄 PDF 파일
            </button>
          </div>
        </div>

        {/* 파일 업로드 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {uploadType === 'image' ? '이미지 업로드 (최대 10장)' : 'PDF 파일 업로드'}
          </label>
          <input
            type="file"
            accept={uploadType === 'image' ? 'image/*' : 'application/pdf'}
            multiple={uploadType === 'image'}
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-indigo-500 file:to-purple-500 file:text-white hover:file:from-indigo-600 hover:file:to-purple-600"
          />
        </div>

        {/* 파일 미리보기 */}
        {filePreviews.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              미리보기 ({filePreviews.length}개 파일)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {filePreviews.map((preview, index) => (
                <div key={index} className="relative">
                  {preview.type === 'image' ? (
                    <img 
                      src={preview.url} 
                      alt={`미리보기 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg shadow-md border border-gray-200"
                    />
                  ) : (
                    <div className="w-full h-32 bg-red-50 rounded-lg shadow-md border border-red-200 flex flex-col items-center justify-center">
                      <span className="text-4xl mb-2">📄</span>
                      <span className="text-xs text-gray-600 px-2 text-center truncate w-full">
                        {preview.name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex gap-4">
          {selectedFiles.length > 0 && (
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              초기화
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={uploading || selectedFiles.length === 0}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
              uploading || !selectedHomework || selectedFiles.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg hover:shadow-xl'
            }`}
          >
            {uploading ? '🔄 제출 중...' : '📤 과제 제출하기'}
          </button>
        </div>
      </div>

      {/* 업로드 중 로딩 */}
      {uploading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <div className="text-lg font-medium">과제를 제출하고 있습니다...</div>
              <div className="text-sm text-gray-500">잠시만 기다려주세요</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
