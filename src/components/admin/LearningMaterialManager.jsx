import React, { useState, useEffect } from 'react';
import { 
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { 
  BookOpen, Upload, Trash2, FileText, Eye, Loader2, 
  ChevronDown, ChevronUp, Search, Filter, Plus, X,
  CheckCircle, AlertCircle
} from 'lucide-react';

const LearningMaterialManager = () => {
  // 학습 자료 목록
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  
  // 업로드 폼
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    grade: '',
    course: '',
    bookName: '',
    chapter: '',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  
  // 필터
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 확장된 항목
  const [expandedId, setExpandedId] = useState(null);
  
  // 텍스트 추출 상태
  const [extractionStatus, setExtractionStatus] = useState({});

  const grades = ['중1', '중2', '중3', '고1', '고2', '고3'];
  const courses = ['내신과정', '수능과정', '문학', '독서', '언어와매체', '화법과작문', '기타'];

  // 데이터 로드
  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'learningMaterials'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const materialList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMaterials(materialList);
    } catch (error) {
      console.error('학습 자료 로드 실패:', error);
    }
    setLoading(false);
  };

  // 파일 선택
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // PDF 또는 이미지만 허용
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('PDF 또는 이미지 파일(JPG, PNG)만 업로드할 수 있습니다.');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB 제한
        alert('파일 크기는 10MB 이하만 가능합니다.');
        return;
      }
      
      setSelectedFile(file);
      
      // 이미지인 경우 미리보기
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  // 자료 업로드
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!formData.grade || !formData.course || !formData.bookName) {
      alert('학년, 과정, 교재명은 필수입니다.');
      return;
    }
    
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }
    
    setUploading(true);
    
    try {
      // 1. 파일 업로드
      const timestamp = Date.now();
      const fileName = `learning-materials/${formData.grade}/${formData.course}/${timestamp}_${selectedFile.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, selectedFile);
      const fileUrl = await getDownloadURL(storageRef);
      
      // 2. DB에 저장
      const materialData = {
        grade: formData.grade,
        course: formData.course,
        bookName: formData.bookName,
        chapter: formData.chapter,
        description: formData.description,
        fileName: selectedFile.name,
        fileUrl: fileUrl,
        fileType: selectedFile.type,
        storagePath: fileName,
        extractedText: '', // 텍스트 추출은 별도로
        textExtracted: false,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'learningMaterials'), materialData);
      
      alert('학습 자료가 업로드되었습니다.\n텍스트 추출 버튼을 눌러 AI가 읽을 수 있게 해주세요.');
      
      // 폼 초기화
      setFormData({
        grade: '',
        course: '',
        bookName: '',
        chapter: '',
        description: ''
      });
      setSelectedFile(null);
      setFilePreview(null);
      setShowForm(false);
      loadMaterials();
      
    } catch (error) {
      console.error('업로드 실패:', error);
      alert('업로드에 실패했습니다.');
    }
    
    setUploading(false);
  };

  // 텍스트 추출 (Claude Vision API)
  const handleExtractText = async (material) => {
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      alert('Anthropic API 키가 설정되지 않았습니다.\n.env 파일에 VITE_ANTHROPIC_API_KEY를 추가해주세요.');
      return;
    }
    
    setExtractionStatus(prev => ({ ...prev, [material.id]: 'extracting' }));
    setExtracting(true);
    
    try {
      // 이미지/PDF를 base64로 변환
      const response = await fetch(material.fileUrl);
      const blob = await response.blob();
      
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      
      // Claude API 호출
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: material.fileType === 'application/pdf' ? 'image/png' : material.fileType,
                    data: base64
                  }
                },
                {
                  type: 'text',
                  text: `이 학습 자료의 내용을 정확하게 텍스트로 추출해주세요.

교재명: ${material.bookName}
${material.chapter ? `단원: ${material.chapter}` : ''}

다음 형식으로 정리해주세요:
1. 본문 내용 (지문, 설명 등)
2. 문제가 있다면 문제 번호와 내용
3. 보기/선택지가 있다면 번호와 함께
4. 핵심 개념이나 용어 정리

가능한 원문 그대로 추출하되, 학생이 질문할 때 참고할 수 있도록 구조화해주세요.`
                }
              ]
            }
          ]
        })
      });
      
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error?.message || 'API 호출 실패');
      }
      
      const data = await apiResponse.json();
      const extractedText = data.content[0].text;
      
      // DB 업데이트
      await updateDoc(doc(db, 'learningMaterials', material.id), {
        extractedText: extractedText,
        textExtracted: true,
        extractedAt: serverTimestamp()
      });
      
      setExtractionStatus(prev => ({ ...prev, [material.id]: 'success' }));
      loadMaterials();
      
    } catch (error) {
      console.error('텍스트 추출 실패:', error);
      setExtractionStatus(prev => ({ ...prev, [material.id]: 'error' }));
      alert(`텍스트 추출에 실패했습니다: ${error.message}`);
    }
    
    setExtracting(false);
  };

  // 자료 삭제
  const handleDelete = async (material) => {
    if (!window.confirm(`"${material.bookName}" 자료를 삭제하시겠습니까?`)) return;
    
    try {
      // Storage에서 파일 삭제
      if (material.storagePath) {
        const storageRef = ref(storage, material.storagePath);
        await deleteObject(storageRef).catch(() => {});
      }
      
      // DB에서 삭제
      await deleteDoc(doc(db, 'learningMaterials', material.id));
      
      loadMaterials();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 필터링
  const filteredMaterials = materials.filter(m => {
    if (filterGrade !== 'all' && m.grade !== filterGrade) return false;
    if (filterCourse !== 'all' && m.course !== filterCourse) return false;
    if (searchTerm && !m.bookName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !m.chapter?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
              <BookOpen className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                학습 자료 관리
              </h2>
              <p className="text-gray-500 text-sm">AI 질문 피드백을 위한 학습 자료를 업로드하세요</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              showForm 
                ? 'bg-gray-200 text-gray-700' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg'
            }`}
          >
            {showForm ? <X size={20} /> : <Plus size={20} />}
            {showForm ? '취소' : '자료 추가'}
          </button>
        </div>

        {/* 업로드 폼 */}
        {showForm && (
          <form onSubmit={handleUpload} className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-lg mb-4">새 학습 자료 업로드</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학년 *</label>
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">선택하세요</option>
                  {grades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">과정 *</label>
                <select
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">선택하세요</option>
                  {courses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">교재명 *</label>
                <input
                  type="text"
                  value={formData.bookName}
                  onChange={(e) => setFormData({ ...formData, bookName: e.target.value })}
                  placeholder="예: 비상 문학 교과서"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">단원/범위</label>
                <input
                  type="text"
                  value={formData.chapter}
                  onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                  placeholder="예: 2단원 현대시"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="이 자료에 대한 추가 설명"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">파일 업로드 *</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-emerald-500 transition">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,image/*"
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="text-emerald-600" size={24} />
                      <span className="text-emerald-600 font-medium">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                      <p className="text-gray-500">PDF 또는 이미지 파일을 선택하세요</p>
                      <p className="text-gray-400 text-sm">최대 10MB</p>
                    </div>
                  )}
                </label>
              </div>
              
              {filePreview && (
                <div className="mt-2">
                  <img src={filePreview} alt="미리보기" className="max-h-40 mx-auto rounded-lg" />
                </div>
              )}
            </div>
            
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  업로드
                </>
              )}
            </button>
          </form>
        )}

        {/* 필터 */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">전체 학년</option>
              {grades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">전체 과정</option>
            {courses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          
          <div className="relative flex-1 max-w-xs">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="교재명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 자료 목록 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <p className="text-sm text-gray-600">
            총 <span className="font-bold text-emerald-600">{filteredMaterials.length}</span>개의 학습 자료
          </p>
        </div>
        
        {filteredMaterials.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
            <p>등록된 학습 자료가 없습니다.</p>
            <p className="text-sm">위의 "자료 추가" 버튼을 눌러 학습 자료를 업로드하세요.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredMaterials.map((material) => (
              <div key={material.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {expandedId === material.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                          {material.grade}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          {material.course}
                        </span>
                        {material.textExtracted ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded flex items-center gap-1">
                            <CheckCircle size={12} />
                            텍스트 추출됨
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded flex items-center gap-1">
                            <AlertCircle size={12} />
                            추출 필요
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">{material.bookName}</p>
                      {material.chapter && (
                        <p className="text-sm text-gray-500">{material.chapter}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <a
                      href={material.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                      title="원본 보기"
                    >
                      <Eye size={18} />
                    </a>
                    
                    {!material.textExtracted && (
                      <button
                        onClick={() => handleExtractText(material)}
                        disabled={extracting}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                      >
                        {extractionStatus[material.id] === 'extracting' ? (
                          <>
                            <Loader2 className="animate-spin" size={14} />
                            추출 중...
                          </>
                        ) : (
                          <>
                            <FileText size={14} />
                            텍스트 추출
                          </>
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(material)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {/* 확장된 내용 */}
                {expandedId === material.id && (
                  <div className="mt-4 ml-10 p-4 bg-gray-50 rounded-lg">
                    {material.description && (
                      <p className="text-sm text-gray-600 mb-3">{material.description}</p>
                    )}
                    
                    {material.textExtracted && material.extractedText ? (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">📝 추출된 텍스트:</p>
                        <div className="max-h-60 overflow-y-auto bg-white p-3 rounded border text-sm whitespace-pre-wrap">
                          {material.extractedText}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        텍스트가 아직 추출되지 않았습니다. "텍스트 추출" 버튼을 눌러주세요.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 안내 */}
      <div className="bg-emerald-50 rounded-xl p-4">
        <h4 className="font-medium text-emerald-800 mb-2">💡 사용 방법</h4>
        <ul className="text-sm text-emerald-700 space-y-1">
          <li>1. 학년과 과정을 선택하고 교재 파일(PDF 또는 이미지)을 업로드하세요.</li>
          <li>2. 업로드 후 "텍스트 추출" 버튼을 눌러 AI가 내용을 읽을 수 있게 해주세요.</li>
          <li>3. 학생들이 해당 교재에 대해 질문하면 AI가 추출된 내용을 바탕으로 답변합니다.</li>
          <li>• 이미지가 선명할수록 텍스트 추출 정확도가 높아집니다.</li>
        </ul>
      </div>
    </div>
  );
};

export default LearningMaterialManager;
