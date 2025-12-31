import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Video, Play, Check, Clock, ChevronRight, AlertCircle } from 'lucide-react';

export default function VideoLearning({ currentUser }) {
  const [assignments, setAssignments] = useState([]);
  const [watchRecords, setWatchRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 현재 시청 중인 영상
  const [currentVideo, setCurrentVideo] = useState(null);
  const [watchStartTime, setWatchStartTime] = useState(null);
  const [watchSeconds, setWatchSeconds] = useState(0);
  
  // 타이머 ref
  const timerRef = useRef(null);

  useEffect(() => {
    loadData();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      // 내 배정된 영상
      const assignSnapshot = await getDocs(collection(db, 'videoAssignments'));
      const myAssignments = assignSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(a => a.studentId === currentUser.id);
      setAssignments(myAssignments);

      // 내 시청 기록
      const recordSnapshot = await getDocs(collection(db, 'videoWatchRecords'));
      const myRecords = recordSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => r.studentId === currentUser.id);
      setWatchRecords(myRecords);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
    setLoading(false);
  };

  // YouTube embed URL 생성
  const getYoutubeEmbedUrl = (url) => {
    const videoId = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  // YouTube 썸네일 URL
  const getYoutubeThumbnail = (url) => {
    const videoId = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  };

  // 영상 시청 시작
  const startWatching = async (assignment) => {
    setCurrentVideo(assignment);
    setWatchStartTime(new Date());
    setWatchSeconds(0);

    // 기존 기록 확인
    const existingRecord = watchRecords.find(r => r.videoId === assignment.videoId);
    
    if (!existingRecord) {
      // 새 시청 기록 생성
      try {
        await addDoc(collection(db, 'videoWatchRecords'), {
          studentId: currentUser.id,
          studentName: currentUser.name,
          videoId: assignment.videoId,
          videoTitle: assignment.videoTitle,
          startedAt: new Date().toISOString(),
          watchTime: 0,
          completed: false
        });
        loadData();
      } catch (error) {
        console.error('시청 기록 생성 실패:', error);
      }
    }

    // 시청 시간 타이머 시작
    timerRef.current = setInterval(() => {
      setWatchSeconds(prev => prev + 1);
    }, 1000);
  };

  // 영상 시청 종료
  const stopWatching = async (markComplete = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (currentVideo && watchSeconds > 0) {
      // 시청 기록 업데이트
      const record = watchRecords.find(r => r.videoId === currentVideo.videoId);
      if (record) {
        try {
          await updateDoc(doc(db, 'videoWatchRecords', record.id), {
            watchTime: (record.watchTime || 0) + watchSeconds,
            lastWatchedAt: new Date().toISOString(),
            completed: markComplete || record.completed
          });
        } catch (error) {
          console.error('시청 기록 업데이트 실패:', error);
        }
      }
    }

    setCurrentVideo(null);
    setWatchStartTime(null);
    setWatchSeconds(0);
    loadData();
  };

  // 시청 완료 표시
  const markAsComplete = async () => {
    await stopWatching(true);
    alert('영상 시청을 완료했습니다! 🎉');
  };

  // 시간 포맷
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 배정별 시청 상태
  const getWatchStatus = (videoId) => {
    return watchRecords.find(r => r.videoId === videoId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 현재 시청 중인 영상이 있으면
  if (currentVideo) {
    const embedUrl = getYoutubeEmbedUrl(currentVideo.videoUrl);
    
    return (
      <div className="space-y-6">
        {/* 영상 플레이어 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="aspect-video bg-black">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <p>영상을 불러올 수 없습니다.</p>
              </div>
            )}
          </div>
          
          {/* 영상 정보 */}
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {currentVideo.videoTitle}
            </h2>
            
            {/* 시청 시간 표시 */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <Clock size={18} />
                <span className="font-mono font-semibold">
                  {formatTime(watchSeconds)}
                </span>
                <span className="text-sm">시청 중</span>
              </div>
              
              {currentVideo.dueDate && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <AlertCircle size={16} />
                  마감: {currentVideo.dueDate}
                </div>
              )}
            </div>

            {/* 버튼들 */}
            <div className="flex gap-3">
              <button
                onClick={() => stopWatching(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition"
              >
                나중에 계속 보기
              </button>
              <button
                onClick={markAsComplete}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition"
              >
                <Check size={18} />
                시청 완료
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
            <Video className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              동영상 학습
            </h2>
            <p className="text-gray-500 text-sm">배정된 영상을 시청하고 학습하세요</p>
          </div>
        </div>
      </div>

      {/* 배정된 영상 목록 */}
      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
            <Video className="text-gray-400" size={48} />
          </div>
          <p className="text-gray-500 text-lg">배정된 영상이 없습니다.</p>
          <p className="text-gray-400 text-sm mt-2">선생님이 영상을 배정하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.map((assignment) => {
            const thumbnail = getYoutubeThumbnail(assignment.videoUrl);
            const watchStatus = getWatchStatus(assignment.videoId);
            const isCompleted = watchStatus?.completed;
            const isWatching = watchStatus && !isCompleted;
            
            return (
              <div 
                key={assignment.id}
                className={`bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition ${
                  isCompleted ? 'ring-2 ring-green-500' : ''
                }`}
              >
                {/* 썸네일 */}
                <div className="relative">
                  {thumbnail ? (
                    <img 
                      src={thumbnail}
                      alt={assignment.videoTitle}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                      <Video className="text-gray-400" size={48} />
                    </div>
                  )}
                  
                  {/* 상태 뱃지 */}
                  <div className="absolute top-3 right-3">
                    {isCompleted ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded-full text-sm font-medium">
                        <Check size={14} />
                        완료
                      </span>
                    ) : isWatching ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-medium">
                        <Clock size={14} />
                        시청중
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-800 bg-opacity-70 text-white rounded-full text-sm">
                        미시청
                      </span>
                    )}
                  </div>
                </div>

                {/* 정보 */}
                <div className="p-5">
                  <h3 className="font-bold text-lg text-gray-800 mb-2 line-clamp-2">
                    {assignment.videoTitle}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    {assignment.dueDate && (
                      <div className="flex items-center gap-1">
                        <AlertCircle size={14} />
                        마감: {assignment.dueDate}
                      </div>
                    )}
                    {watchStatus?.watchTime > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {Math.floor(watchStatus.watchTime / 60)}분 시청
                      </div>
                    )}
                  </div>

                  {/* 시청 버튼 */}
                  <button
                    onClick={() => startWatching(assignment)}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition ${
                      isCompleted
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg'
                    }`}
                  >
                    <Play size={18} />
                    {isCompleted ? '다시 보기' : isWatching ? '이어서 보기' : '시청 시작'}
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 시청 통계 */}
      {watchRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">📊 나의 학습 현황</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-indigo-50 rounded-xl">
              <p className="text-3xl font-bold text-indigo-600">
                {assignments.length}
              </p>
              <p className="text-sm text-gray-600">배정된 영상</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-3xl font-bold text-green-600">
                {watchRecords.filter(r => r.completed).length}
              </p>
              <p className="text-sm text-gray-600">완료한 영상</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <p className="text-3xl font-bold text-purple-600">
                {Math.floor(watchRecords.reduce((sum, r) => sum + (r.watchTime || 0), 0) / 60)}분
              </p>
              <p className="text-sm text-gray-600">총 시청 시간</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
