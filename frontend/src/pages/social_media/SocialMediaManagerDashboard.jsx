import React from 'react';
import { useLocation } from 'react-router-dom';
import StaffManagement from '../../components/common/StaffManagement';
import SocialMediaTaskOverview from './components/SocialMediaTaskOverview';
import VideoEditor from './components/VideoEditor';
import AIVideoGenerator from './components/AIVideoGenerator';
import SocialMediaCalendarView from './components/SocialMediaCalendarView';
import AIMusicMatcher from './components/AIMusicMatcher';

export default function SocialMediaManagerDashboard({ loggedInUser }) {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'overview';

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in-up">
      {/* Content Area Driven Directly by Sidebar */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {activeTab === 'overview' && (
          <div className="h-full">
            <SocialMediaTaskOverview loggedInUser={loggedInUser} />
          </div>
        )}

        {activeTab === 'team' && (
          <div className="h-full">
            <StaffManagement loggedInUser={loggedInUser} />
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="h-full">
            <SocialMediaCalendarView loggedInUser={loggedInUser} />
          </div>
        )}

        {activeTab === 'ai_video' && (
          <div className="h-full">
            <AIVideoGenerator loggedInUser={loggedInUser} />
          </div>
        )}

        {activeTab === 'video_editor' && (
          <div className="h-full">
            <VideoEditor />
          </div>
        )}

        {activeTab === 'ai_music_matcher' && (
          <div className="h-full">
            <AIMusicMatcher />
          </div>
        )}
      </div>
    </div>
  );
}
