import React, { useState } from 'react';
import { Video, Plus, Trash2 } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function VideoManager({ videos }) {
  const [newVideo, setNewVideo] = useState({ 
    subject: '', 
    unit: '', 
    title: '', 
    url: '' 
  });

  const handleAddVideo = async () => {
    if (!newVideo.subject || !newVideo.unit || !newVideo.title || !newVideo.url) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'videos'), {
        ...newVideo,
        uploadDate: new Date().toISOString().split('T')[0]
      });
      
      setNewVideo({ subject: '', unit: '', title: '', url: '' });
      alert('동영상이 추가되었습니다!');
    } catch (error) {
      alert('동영상 추가 실패: ' + error.message);
    }
  };

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

  return (
    <div className="space-y-6">
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
              placeholder="단원 (예: 문학)"
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
            placeholder="YouTube URL"
            value={newVideo.url}
            onChange={(e) => setNewVideo({ ...newVideo, url: e.target.value })}
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

      {/* 동영상 목록 */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          등록된 동영상
        </h2>
        <div className="space-y-3">
          {videos.map((video) => (
            <div key={video.id} className="p-5 bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl hover:shadow-md transition-all border-2 border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                    <Video className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{video.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{video.subject} - {video.unit}</p>
                    <p className="text-xs text-gray-500 mt-1">등록일: {video.uploadDate}</p>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm mt-2 inline-block"
                    >
                      영상 보기 →
                    </a>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteVideo(video.id)}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {videos.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
              <Video className="text-gray-400" size={48} />
            </div>
            <p className="text-gray-500 text-lg">등록된 동영상이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
