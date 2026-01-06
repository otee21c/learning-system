import React, { useState, useEffect } from 'react';
import { 
  collection, addDoc, getDocs, deleteDoc, doc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { 
  BookOpen, Upload, Trash2, FileText, Eye, Loader2, 
  ChevronDown, ChevronUp, Search, Filter, Plus, X,
  CheckCircle, AlertCircle, Image as ImageIcon, File
} from 'lucide-react';

const LearningMaterialManager = ({ branch }) => {
  // 학습 자료 목록
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // 업로드 폼
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    grade: '',
    course: '',
    bookName: '',
    chapter: '',
    description: ''
  });
  
  // 자료 유형 선택
  const [materialType, setMaterialType] = useState('pdf'); // 'pdf' or 'text'
  
  // PDF 파일
  const [pdfFile, setPdfFile] = useState(null);
  
  // 텍스트 파일 (기존 호환)
  const [textFile, setTextFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  
  // 보조 이미지 (최대 3장)
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
  // 필터
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 확장된 항목
  const [expandedId, setExpandedId] = useState(null);

  const grades = ['중1', '중2', '중3', '고1', '고2', '고3'];
  const courses = ['내신과정', '수능과정', '문학', '독서', '언어와매체', '화법과작문', '기타'];

  // 데이터 로드
  useEffect(() => {
    loadMaterials();
  }, [branch]);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'learningMaterials'));
      let materialList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // ★ 지점별 필터링 (branch가 없거나 현재 지점과 일치하는 것만)
      if (branch) {
        materialList = materialList.filter(m => !m.branch || m.branch === branch);
      }
      
      // 클라이언트에서 정렬
      materialList.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      setMaterials(materialList);
    } catch (error) {
      console.error('학습 자료 로드 실패:', error);
    }
    setLoading(false);
  };

  // PDF 파일 선택
  const handlePdfFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('PDF 파일(.pdf)만 업로드할 수 있습니다.');
        return;
      }
      
      if (file.size > 20 * 1024 * 1024) {
        alert('파일 크기는 20MB 이하만 가능합니다.');
        return;
      }
      
      setPdfFile(file);
    }
  };

  // 텍스트 파일 선택
  const handleTextFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.txt')) {
        alert('텍스트 파일(.txt)만 업로드할 수 있습니다.');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하만 가능합니다.');
        return;
      }
      
      setTextFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setTextContent(e.target.result);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  // 이미지 파일 선택 (최대 3장)
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (imageFiles.length + files.length > 3) {
      alert('이미지는 최대 3장까지 업로드할 수 있습니다.');
      return;
    }
    
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name}은 이미지 파일이 아닙니다.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}의 크기가 5MB를 초과합니다.`);
        return false;
      }
      return true;
    });
    
    setImageFiles(prev => [...prev, ...validFiles]);
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // 이미지 제거
  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // 자료 업로드
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!formData.grade || !formData.course || !formData.bookName) {
      alert('학년, 과정, 교재명은 필수입니다.');
      return;
    }
    
    if (materialType === 'pdf' && !pdfFile) {
      alert('PDF 파일을 선택해주세요.');
      return;
    }
    
    if (materialType === 'text' && !textFile && !textContent) {
      alert('텍스트 파일을 선택하거나 직접 입력해주세요.');
      return;
    }
    
    setUploading(true);
    
    try {
      const timestamp = Date.now();
      let pdfUrl = null;
      let pdfStoragePath = null;
      const imageUrls = [];
      
      // PDF 업로드
      if (materialType === 'pdf' && pdfFile) {
        const pdfFileName = `learning-materials/${formData.grade}/${formData.course}/${timestamp}_${pdfFile.name}`;
        const pdfStorageRef = ref(storage, pdfFileName);
        
        await uploadBytes(pdfStorageRef, pdfFile);
        pdfUrl = await getDownloadURL(pdfStorageRef);
        pdfStoragePath = pdfFileName;
      }
      
      // 이미지 업로드
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fileName = `learning-materials/${formData.grade}/${formData.course}/${timestamp}_img${i+1}_${file.name}`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        imageUrls.push({
          url: url,
          storagePath: fileName,
          name: file.name
        });
      }
      
      const materialData = {
        grade: formData.grade,
        course: formData.course,
        bookName: formData.bookName,
        chapter: formData.chapter,
        description: formData.description,
        materialType: materialType,
        // PDF 정보
        pdfUrl: pdfUrl,
        pdfStoragePath: pdfStoragePath,
        pdfFileName: pdfFile?.name || null,
        // 텍스트 정보 (기존 호환)
        textContent: materialType === 'text' ? textContent : '',
        textFileName: materialType === 'text' ? (textFile?.name || '직접 입력') : null,
        // 이미지 정보
        imageUrls: imageUrls,
        // ★ 지점 정보
        branch: branch || '',
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'learningMaterials'), materialData);
      
      alert('학습 자료가 업로드되었습니다!');
      
      // 폼 초기화
      setFormData({
        grade: '',
        course: '',
        bookName: '',
        chapter: '',
        description: ''
      });
      setPdfFile(null);
      setTextFile(null);
      setTextContent('');
      setImageFiles([]);
      setImagePreviews([]);
      setShowForm(false);
      loadMaterials();
      
    } catch (error) {
      console.error('업로드 실패:', error);
      alert('업로드에 실패했습니다: ' + error.message);
    }
    
    setUploading(false);
  };

  // 자료 삭제
  const handleDelete = async (material) => {
    if (!window.confirm(`"${material.bookName}" 자료를 삭제하시겠습니까?`)) return;
    
    try {
      // PDF 삭제
      if (material.pdfStoragePath) {
        try {
          await deleteObject(ref(storage, material.pdfStoragePath));
        } catch (e) {
          console.log('PDF 삭제 실패:', e);
        }
      }
      
      // 이미지 삭제
      if (material.imageUrls && material.imageUrls.length > 0) {
        for (const img of material.imageUrls) {
          if (img.storagePath) {
            try {
              await deleteObject(ref(storage, img.storagePath));
            } catch (e) {
              console.log('이미지 삭제 실패:', e);
            }
          }
        }
      }
      
      await deleteDoc(doc(db, 'learningMaterials', material.id));
      
      alert('삭제되었습니다.');
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
    if (searchTerm && !m.bookName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
              <BookOpen className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                학습자료 관리
              </h2>
              <p className="text-sm text-gray-500">
                문제집 내용을 업로드하여 AI 질문 답변에 활용
              </p>
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
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? '닫기' : '자료 추가'}
          </button>
        </div>

        {/* 업로드 폼 */}
        {showForm && (
          <form onSubmit={handleUpload} className="bg-gray-50 rounded-xl p-6 mb-6 space-y-4">
            <h3 className="font-bold text-lg mb-4">📚 새 학습자료 등록</h3>
            
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학년 *</label>
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">선택</option>
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
                  <option value="">선택</option>
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
                  placeholder="예: 수능특강 문학"
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
                  placeholder="예: 1단원"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="자료에 대한 간단한 설명"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            {/* 자료 유형 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">자료 유형 *</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setMaterialType('pdf');
                    setTextFile(null);
                    setTextContent('');
                  }}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                    materialType === 'pdf'
                      ? 'bg-red-100 text-red-700 border-2 border-red-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <File size={20} />
                  PDF 파일 (추천)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMaterialType('text');
                    setPdfFile(null);
                  }}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                    materialType === 'text'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <FileText size={20} />
                  텍스트 파일
                </button>
              </div>
            </div>
            
            {/* PDF 업로드 */}
            {materialType === 'pdf' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📄 PDF 파일 업로드 *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  문제집 PDF를 업로드하면 AI가 내용을 분석하여 질문에 답변합니다. (최대 20MB)
                </p>
                
                {pdfFile ? (
                  <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                    <File className="text-red-500" size={24} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{pdfFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="p-1 hover:bg-red-200 rounded"
                    >
                      <X size={18} className="text-red-600" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-red-500 transition">
                    <input
                      type="file"
                      onChange={handlePdfFileSelect}
                      accept=".pdf"
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <File className="mx-auto text-gray-400 mb-2" size={36} />
                      <p className="text-gray-600">PDF 파일을 선택하세요</p>
                      <p className="text-sm text-gray-400">클릭하여 파일 선택</p>
                    </label>
                  </div>
                )}
              </div>
            )}
            
            {/* 텍스트 업로드 */}
            {materialType === 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 텍스트 파일 업로드 또는 직접 입력 *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  문제집 내용을 텍스트로 정리해서 업로드하세요. (최대 5MB)
                </p>
                
                <div className="mb-3">
                  <input
                    type="file"
                    onChange={handleTextFileSelect}
                    accept=".txt"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                  />
                </div>
                
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="또는 여기에 직접 내용을 입력하세요..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                
                {textContent && (
                  <p className="text-xs text-gray-500 mt-1">
                    입력된 내용: {textContent.length.toLocaleString()}자
                  </p>
                )}
              </div>
            )}
            
            {/* 보조 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🖼️ 보조 이미지 (선택, 최대 3장)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                도표, 그림, 핵심 개념 정리 이미지 등을 추가할 수 있습니다.
              </p>
              
              <div className="flex flex-wrap gap-3 mb-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={preview} 
                      alt={`이미지 ${index + 1}`} 
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                
                {imageFiles.length < 3 && (
                  <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-emerald-500 transition">
                    <input
                      type="file"
                      onChange={handleImageSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer text-center">
                      <ImageIcon className="mx-auto text-gray-400" size={24} />
                      <span className="text-xs text-gray-400">추가</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
            
            <button
              type="submit"
              disabled={uploading || (materialType === 'pdf' && !pdfFile) || (materialType === 'text' && !textContent)}
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
        
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="mx-auto animate-spin text-emerald-500 mb-2" size={32} />
            <p className="text-gray-500">로딩 중...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
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
                        {/* PDF/텍스트 구분 */}
                        {material.pdfUrl ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded flex items-center gap-1">
                            <File size={12} />
                            PDF
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded flex items-center gap-1">
                            <FileText size={12} />
                            텍스트
                          </span>
                        )}
                        {material.imageUrls?.length > 0 && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                            <ImageIcon size={12} />
                            이미지 {material.imageUrls.length}장
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
                    <button
                      onClick={() => handleDelete(material)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {/* 확장된 상세 정보 */}
                {expandedId === material.id && (
                  <div className="mt-4 ml-10 p-4 bg-gray-50 rounded-lg">
                    {material.description && (
                      <p className="text-sm text-gray-600 mb-3">{material.description}</p>
                    )}
                    
                    {/* PDF 정보 */}
                    {material.pdfUrl && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">📄 PDF 파일:</p>
                        <a 
                          href={material.pdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                        >
                          <File size={16} />
                          {material.pdfFileName || 'PDF 보기'}
                        </a>
                      </div>
                    )}
                    
                    {/* 이미지 */}
                    {material.imageUrls?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">🖼️ 참고 이미지:</p>
                        <div className="flex flex-wrap gap-2">
                          {material.imageUrls.map((img, idx) => (
                            <a 
                              key={idx}
                              href={img.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img 
                                src={img.url} 
                                alt={`참고 이미지 ${idx + 1}`}
                                className="w-32 h-32 object-cover rounded-lg border hover:shadow-lg transition"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 텍스트 내용 */}
                    {material.textContent && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          📝 텍스트 내용 ({material.textContent?.length?.toLocaleString() || 0}자):
                        </p>
                        <div className="max-h-60 overflow-y-auto bg-white p-3 rounded border text-sm whitespace-pre-wrap">
                          {material.textContent?.substring(0, 2000) || '내용 없음'}
                          {material.textContent?.length > 2000 && '... (더보기)'}
                        </div>
                      </div>
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
          <li>1. <strong>PDF 업로드 (추천)</strong>: 문제집 PDF를 그대로 업로드하면 AI가 표, 그림, 텍스트를 모두 인식합니다.</li>
          <li>2. 텍스트 업로드: PDF가 없는 경우 내용을 텍스트로 정리해서 업로드할 수 있습니다.</li>
          <li>3. 보조 이미지를 추가하면 도표, 그림 등을 참고하여 더 정확한 답변이 가능합니다.</li>
          <li>4. 학생들이 해당 교재에 대해 질문하면 등록된 내용을 바탕으로 답변합니다.</li>
        </ul>
      </div>
    </div>
  );
};

export default LearningMaterialManager;
