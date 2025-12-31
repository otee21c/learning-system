import React, { useState, useEffect } from 'react';
import { Video, Plus, Trash2, Users, Eye, Check, X, Play, Clock, UserCheck, Search, Filter } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

export default function VideoManager({ videos, students = [] }) {
  // 새 동영상 추가
  const [newVideo, setNewVideo] = useState({ 
    subject: '', 
    unit: '', 
    title: '', 
    url: '',
    description: ''
  });

  // 탭 상태
  const [activeTab, setActiveTab] = useState('videos'); // 'videos' | 'assign' | 'records'

  // 배정 모달
  const [assignModal, setAssignModal] = useState({
    isOpen: false,
    videoId: '',
    videoTitle: ''
  });
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [dueDate, setDueDate] = useState('');

  // 배정 데이터
  const [assignments, setAssignments] = useState([]);
  
  // 시청 기록
  const [watchRecords, setWatchRecords] = useState([]);

  // 검색/필터
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 영상 배정 데이터
      const assignSnapshot = await getDocs(collection(db, 'videoAssignments'));
      setAssignments(assignSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // 시청 기록
      const recordSnapshot = await getDocs(collection(db, 'videoWatchRecords'));
      setWatchRecords(recordSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  // 동영상 추가
  const handleAddVideo = async () => {
    if (!newVideo.subject || !newVideo.unit || !newVideo.title || !newVideo.url) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    // YouTube URL 유효성 검사
    if (!newVideo.url.includes('youtube.com') && !newVideo.url.includes('youtu.be')) {
      alert('유효한 YouTube URL을 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'videos'), {
        ...newVideo,
        uploadDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      
      setNewVideo({ subject: '', unit: '', title: '', url: '', description: '' });
      alert('동영상이 추가되었습니다!');
    } catch (error) {
      alert('동영상 추가 실패: ' + error.message);
    }
  };

  // 동영상 삭제
  const handleDeleteVideo = async (videoId) => {
    if (!confirm('정말 이 동영상을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'videos', videoId));
      alert('동영상이 삭제되었습니다.');
    } catch (error) {
      alert('동영상 삭제 실패: ' + error.message);
    }
  };

  // 배정 모달 열기
  const openAssignModal = (video) => {
    setAssignModal({
      isOpen: true,
      videoId: video.id,
      videoTitle: video.title
    });
    setSelectedStudents([]);
    setDueDate('');
  };

  // 배정 모달 닫기
  const closeAssignModal = () => {
    setAssignModal({ isOpen: false, videoId: '', videoTitle: '' });
    setSelectedStudents([]);
    setDueDate('');
  };

  // 학생 선택 토글
  const toggleStudent = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // 전체 선택
  const selectAllStudents = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  // 영상 배정
  const handleAssign = async () => {
    if (selectedStudents.length === 0) {
      alert('학생을 선택해주세요.');
      return;
    }

    try {
      const video = videos.find(v => v.id === assignModal.videoId);
      
      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        
        // 이미 배정되어 있는지 확인
        const existing = assignments.find(a => 
          a.videoId === assignModal.videoId && a.studentId === studentId
        );
        
        if (!existing) {
          await addDoc(collection(db, 'videoAssignments'), {
            videoId: assignModal.videoId,
            videoTitle: video?.title || '',
            videoUrl: video?.url || '',
            studentId: studentId,
            studentName: student?.name || '',
            dueDate: dueDate || null,
            assignedAt: new Date().toISOString(),
            completed: false
          });
        }
      }

      alert(`${selectedStudents.length}명의 학생에게 영상이 배정되었습니다.`);
      closeAssignModal();
      loadData();
    } catch (error) {
      alert('배정 실패: ' + error.message);
    }
  };

  // 배정 삭제
  const handleDeleteAssignment = async (assignmentId) => {
    if (!confirm('이 배정을 삭제하시겠습니까?')) return;
    
    try {
      await deleteDoc(doc(db, 'videoAssignments', assignmentId));
      loadData();
    } catch (error) {
      alert('삭제 실패: ' + error.message);
    }
  };

  // YouTube 썸네일 URL 추출
  const getYoutubeThumbnail = (url) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  };

  // YouTube embed URL 생성
  const getYoutubeEmbedUrl = (url) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  // 과목 목록 추출
  const subjects = [...new Set(videos.map(v => v.subject).filter(Boolean))];

  // 필터링된 영상
  const filteredVideos = videos.filter(video => {
    const matchSearch = video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       video.unit?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSubject = filterSubject === 'all' || video.subject === filterSubject;
    return matchSearch && matchSubject;
  });

  // 학생별 시청 현황
  const getStudentWatchStatus = (studentId, videoId) => {
    const record = watchRecords.find(r => r.studentId === studentId && r.videoId === videoId);
    return record;
  };

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-2xl shadow-lg p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
              activeTab === 'videos'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Video size={18} />
            동영상 관리
          </button>
          <button
            onClick={() => setActiveTab('assign')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
              activeTab === 'assign'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={18} />
            배정 현황
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
              activeTab === 'records'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Eye size={18} />
            시청 기록
          </button>
        </div>
      </div>

      {/* 동영상 관리 탭 */}
      {activeTab === 'videos' && (
        <>
          {/* 새 동영상 추가 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Plus size={24} />
              새 동영상 추가
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="과목 (예: 국어)"
                  value={newVideo.subject}
                  onChange={(e) => setNewVideo({ ...newVideo, subject: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="단원 (예: 문학, 비문학)"
                  value={newVideo.unit}
                  onChange={(e) => setNewVideo({ ...newVideo, unit: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <input
                type="text"
                placeholder="동영상 제목"
                value={newVideo.title}
                onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <input
                type="url"
                placeholder="YouTube URL (예: https://www.youtube.com/watch?v=...)"
                value={newVideo.url}
                onChange={(e) => setNewVideo({ ...newVideo, url: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <textarea
                placeholder="설명 (선택사항)"
                value={newVideo.description}
                onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button 
                onClick={handleAddVideo}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg hover:shadow-lg transition-all font-semibold"
              >
                동영상 추가
              </button>
            </div>
          </div>

          {/* 검색/필터 */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="영상 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">전체 과목</option>
                {subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 동영상 목록 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              등록된 동영상 ({filteredVideos.length}개)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => {
                const thumbnail = getYoutubeThumbnail(video.url);
                const assignedCount = assignments.filter(a => a.videoId === video.id).length;
                
                return (
                  <div key={video.id} className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-xl overflow-hidden hover:shadow-lg transition border-2 border-gray-100">
                    {/* 썸네일 */}
                    {thumbnail && (
                      <div className="relative">
                        <img 
                          src={thumbnail} 
                          alt={video.title}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition"
                          >
                            <Play className="text-indigo-600" size={24} />
                          </a>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                          {video.subject}
                        </span>
                        <span className="text-xs text-gray-500">
                          {video.uploadDate}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">
                        {video.title}
                      </h3>
                      <p className="text-sm text-gray-500 mb-3">
                        {video.unit}
                      </p>

                      {/* 배정 현황 */}
                      <div className="flex items-center gap-2 mb-3 text-sm">
                        <UserCheck size={16} className="text-green-500" />
                        <span className="text-gray-600">
                          {assignedCount}명 배정됨
                        </span>
                      </div>

                      {/* 버튼들 */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => openAssignModal(video)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm font-medium"
                        >
                          <Users size={16} />
                          배정
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredVideos.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
                  <Video className="text-gray-400" size={48} />
                </div>
                <p className="text-gray-500 text-lg">
                  {searchTerm || filterSubject !== 'all' 
                    ? '검색 결과가 없습니다.' 
                    : '등록된 동영상이 없습니다.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 배정 현황 탭 */}
      {activeTab === 'assign' && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <Users size={24} />
            배정 현황
          </h2>

          {assignments.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
                <Users className="text-gray-400" size={48} />
              </div>
              <p className="text-gray-500 text-lg">아직 배정된 영상이 없습니다.</p>
              <p className="text-gray-400 text-sm mt-2">동영상 관리 탭에서 학생에게 영상을 배정해주세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">학생</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">영상</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">마감일</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">상태</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => {
                    const watchRecord = watchRecords.find(r => 
                      r.studentId === assignment.studentId && r.videoId === assignment.videoId
                    );
                    
                    return (
                      <tr key={assignment.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{assignment.studentName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{assignment.videoTitle}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-600">
                            {assignment.dueDate || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {watchRecord?.completed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                              <Check size={12} />
                              완료
                            </span>
                          ) : watchRecord ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                              <Clock size={12} />
                              시청중
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                              미시청
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                            title="배정 삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 시청 기록 탭 */}
      {activeTab === 'records' && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <Eye size={24} />
            시청 기록
          </h2>

          {watchRecords.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
                <Eye className="text-gray-400" size={48} />
              </div>
              <p className="text-gray-500 text-lg">아직 시청 기록이 없습니다.</p>
              <p className="text-gray-400 text-sm mt-2">학생들이 영상을 시청하면 여기에 기록됩니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">학생</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">영상</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">시청 시작</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">시청 시간</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">완료</th>
                  </tr>
                </thead>
                <tbody>
                  {watchRecords.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{record.studentName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{record.videoTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">
                          {record.startedAt ? new Date(record.startedAt).toLocaleString('ko-KR') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">
                          {record.watchTime ? `${Math.floor(record.watchTime / 60)}분 ${record.watchTime % 60}초` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {record.completed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            <Check size={12} />
                            완료
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            미완료
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 배정 모달 */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              📹 영상 배정
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-indigo-600">{assignModal.videoTitle}</span>
            </p>

            {/* 마감일 설정 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                마감일 (선택)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 학생 선택 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  학생 선택
                </label>
                <button
                  onClick={selectAllStudents}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {selectedStudents.length === students.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {students.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.grade}</p>
                    </div>
                  </label>
                ))}
              </div>
              
              <p className="text-sm text-gray-500 mt-2">
                {selectedStudents.length}명 선택됨
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={closeAssignModal}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition"
              >
                취소
              </button>
              <button
                onClick={handleAssign}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition"
              >
                배정하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
