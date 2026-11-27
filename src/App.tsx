import { useCallback, useState } from 'react';
import { ChatRoomView } from './components/ChatRoomView';
import { LobbyView } from './components/LobbyView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { Sidebar } from './components/Sidebar';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { generateGuestName } from './lib/constants';
import {
  clearSupabaseConfig,
  loadRecentRooms,
  loadSupabaseConfig,
  loadUserProfile,
  removeRecentRoom,
  saveSupabaseConfig,
  saveUserProfile,
  upsertRecentRoom,
} from './lib/storage';
import { resetSupabaseClientCache } from './lib/supabaseService';
import type {
  ActiveTab,
  ChatMessage,
  RoomHistoryItem,
  SupabaseConfig,
  UserProfile,
} from './types/chat';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [supabaseState, setSupabaseState] = useState(() => loadSupabaseConfig());
  const [recentRooms, setRecentRooms] = useState<RoomHistoryItem[]>(() =>
    loadRecentRooms()
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isSupabaseConfigured = Boolean(
    supabaseState.config.url && supabaseState.config.anonKey
  );

  const handleUpdateProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    saveUserProfile(next);
  }, []);

  const handleNicknameChange = useCallback((nickname: string) => {
    setProfile((prev) => {
      const next = { ...prev, nickname };
      saveUserProfile(next);
      return next;
    });
  }, []);

  const handleEnterRoom = useCallback(
    (roomCode: string) => {
      const cleanCode = roomCode.replace(/\D/g, '').slice(0, 6);
      if (cleanCode.length !== 6) return;

      // Ensure user has a nickname even if entering directly from sidebar history
      if (!profile.nickname.trim()) {
        const autoName = generateGuestName();
        const updated = { ...profile, nickname: autoName };
        setProfile(updated);
        saveUserProfile(updated);
      }

      setActiveRoomCode(cleanCode);
      setActiveTab('rooms');

      setRecentRooms((prev) => {
        const existing = prev.find((r) => r.roomCode === cleanCode);
        return upsertRecentRoom({
          roomCode: cleanCode,
          lastMessage: existing?.lastMessage || 'ルームに入室しました',
          lastSender: existing?.lastSender || '',
          lastAt: new Date().toISOString(),
        });
      });
    },
    [profile]
  );

  const handleLeaveRoom = useCallback(() => {
    setActiveRoomCode(null);
    setActiveTab('rooms');
  }, []);

  const handleLatestMessageUpdate = useCallback(
    (roomCode: string, message: ChatMessage) => {
      setRecentRooms(() =>
        upsertRecentRoom({
          roomCode,
          lastMessage: message.content,
          lastSender: message.sender_name,
          lastAt: message.created_at,
        })
      );
    },
    []
  );

  const handleDeleteRecentRoom = useCallback(
    (roomCode: string) => {
      setRecentRooms(removeRecentRoom(roomCode));
      if (activeRoomCode === roomCode) {
        setActiveRoomCode(null);
      }
    },
    [activeRoomCode]
  );

  const handleSaveSupabaseConfig = useCallback((config: SupabaseConfig) => {
    saveSupabaseConfig(config);
    resetSupabaseClientCache();
    setSupabaseState(loadSupabaseConfig());
  }, []);

  const handleClearSupabaseConfig = useCallback(() => {
    clearSupabaseConfig();
    resetSupabaseClientCache();
    setSupabaseState(loadSupabaseConfig());
  }, []);

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        profile={profile}
        activeTab={activeTab}
        activeRoomCode={activeRoomCode}
        recentRooms={recentRooms}
        isSupabaseConfigured={isSupabaseConfigured}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'profile') {
            // Keep room code remembered only if desired, or clear on mobile
          }
        }}
        onSelectRoom={handleEnterRoom}
        onDeleteRecentRoom={handleDeleteRecentRoom}
        onOpenLobby={() => {
          setActiveRoomCode(null);
          setActiveTab('rooms');
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {activeTab === 'profile' ? (
          <ProfileSettingsView
            profile={profile}
            hasActiveRoom={Boolean(activeRoomCode)}
            onUpdateProfile={handleUpdateProfile}
            onBackToLobby={() => setActiveTab('rooms')}
          />
        ) : activeRoomCode ? (
          <ChatRoomView
            roomCode={activeRoomCode}
            profile={profile}
            supabaseConfig={supabaseState.config}
            isSupabaseConfigured={isSupabaseConfigured}
            onLeaveRoom={handleLeaveRoom}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenProfile={() => setActiveTab('profile')}
            onLatestMessageUpdate={handleLatestMessageUpdate}
          />
        ) : (
          <LobbyView
            profile={profile}
            isSupabaseConfigured={isSupabaseConfigured}
            recentRooms={recentRooms}
            onNicknameChange={handleNicknameChange}
            onEnterRoom={handleEnterRoom}
            onOpenProfile={() => setActiveTab('profile')}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
      </main>

      <SupabaseSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={supabaseState.config}
        configSource={supabaseState.source}
        onSave={handleSaveSupabaseConfig}
        onClear={handleClearSupabaseConfig}
      />
    </div>
  );
}
