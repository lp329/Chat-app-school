import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  EyeOff,
  Flag,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Moon,
  Power,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sun,
  ThumbsUp,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  clearAdminSession,
  grantAdminSession,
  isAdminSessionActive,
  verifyAdminStep1Credentials,
  verifyAdminStep2Pin,
} from '../lib/adminAuth';
import {
  createMockAnnouncement,
  deleteMockAnnouncement,
  deleteMockFeatureRequest,
  deleteMockReport,
  loadMockAdminStats,
  loadMockAnnouncements,
  loadMockFeatureRequests,
  loadMockMaintenanceMode,
  loadMockReports,
  purgeOldMockMessages,
  saveMockMaintenanceMode,
  subscribeToAllMockEvents,
  updateMockFeatureRequest,
  updateMockReportStatus,
} from '../lib/storage';
import {
  createOfficialAnnouncementInSupabase,
  deleteFeatureRequestFromSupabase,
  deleteOfficialAnnouncementFromSupabase,
  deleteReportFromSupabase,
  fetchAdminStatsFromSupabase,
  fetchFeatureRequestsFromSupabase,
  fetchMaintenanceModeFromSupabase,
  fetchOfficialAnnouncementsFromSupabase,
  fetchReportsFromSupabase,
  purgeOldMessagesFromSupabase,
  setMaintenanceModeInSupabase,
  subscribeToFeatureRequestsRealtime,
  subscribeToMaintenanceModeRealtime,
  subscribeToOfficialAnnouncementsRealtime,
  subscribeToReportsRealtime,
  updateFeatureRequestStatusInSupabase,
  updateReportStatusInSupabase,
} from '../lib/supabaseService';
import type {
  AdminSystemStats,
  FeatureRequest,
  FeatureRequestStatus,
  OfficialAnnouncement,
  ReportStatus,
  SupabaseConfig,
  ThemeMode,
  UserReport,
} from '../types/chat';

interface AdminPortalProps {
  supabaseConfig: SupabaseConfig;
  isSupabaseConfigured: boolean;
  themeMode: ThemeMode;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onExitToLobby: () => void;
}

type AdminConsoleTab =
  | 'announcements'
  | 'reports'
  | 'feature_requests'
  | 'maintenance';

function formatDateTimeJP(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--/-- --:--';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}/${m}/${d} ${hh}:${mm}`;
}

const REPORT_STATUS_META: Record<
  ReportStatus,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: '未対応',
    badgeClass:
      'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40',
  },
  reviewed: {
    label: '確認済み',
    badgeClass:
      'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40',
  },
  resolved: {
    label: '対応完了',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40',
  },
};

const FEATURE_STATUS_META: Record<
  FeatureRequestStatus,
  { label: string; badgeClass: string }
> = {
  検討中: {
    label: '検討中',
    badgeClass:
      'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40',
  },
  開発中: {
    label: '開発中',
    badgeClass:
      'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/40',
  },
  実装済み: {
    label: '実装済み',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40',
  },
};

export function AdminPortal({
  supabaseConfig,
  isSupabaseConfigured,
  themeMode,
  onChangeThemeMode,
  onExitToLobby,
}: AdminPortalProps) {
  // --- 2-Step Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    isAdminSessionActive()
  );
  const [authStep, setAuthStep] = useState<1 | 2>(1);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const failedAttemptsRef = useRef<number>(0);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // --- Console Data State ---
  const [activeConsoleTab, setActiveConsoleTab] =
    useState<AdminConsoleTab>('announcements');
  const [announcements, setAnnouncements] = useState<OfficialAnnouncement[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [stats, setStats] = useState<AdminSystemStats>({
    totalMessages: 0,
    activeEncryptedRooms: 0,
    pendingReports: 0,
  });
  const [loadingData, setLoadingData] = useState(false);
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [consoleSuccess, setConsoleSuccess] = useState<string | null>(null);

  // Announcement composer state
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annImportant, setAnnImportant] = useState(false);
  const [sendingAnn, setSendingAnn] = useState(false);
  const [confirmDeleteAnnId, setConfirmDeleteAnnId] = useState<string | null>(null);

  // Reports filter & delete confirm
  const [reportFilter, setReportFilter] = useState<'all' | ReportStatus>('all');
  const [confirmDeleteReportId, setConfirmDeleteReportId] = useState<string | null>(null);

  // Feature Requests filter, sort & delete confirm
  const [featureFilter, setFeatureFilter] = useState<'all' | FeatureRequestStatus>('all');
  const [featureSort, setFeatureSort] = useState<'popular' | 'newest'>('popular');
  const [confirmDeleteFeatureId, setConfirmDeleteFeatureId] = useState<string | null>(null);

  // Maintenance & Purge state
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purging, setPurging] = useState(false);

  const flashSuccess = useCallback((msg: string) => {
    setConsoleSuccess(msg);
    setConsoleError(null);
    window.setTimeout(() => {
      setConsoleSuccess((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  // --- Load & Subscribe Admin Data once Authenticated ---

  const refreshAllData = useCallback(async () => {
    setLoadingData(true);
    setConsoleError(null);

    try {
      if (!isSupabaseConfigured) {
        setAnnouncements(loadMockAnnouncements());
        setReports(loadMockReports());
        setFeatureRequests(loadMockFeatureRequests());
        setMaintenanceMode(loadMockMaintenanceMode());
        setStats(loadMockAdminStats());
        return;
      }

      const [annRes, repRes, featRes, maintRes, statsRes] = await Promise.all([
        fetchOfficialAnnouncementsFromSupabase(supabaseConfig),
        fetchReportsFromSupabase(supabaseConfig),
        fetchFeatureRequestsFromSupabase(supabaseConfig),
        fetchMaintenanceModeFromSupabase(supabaseConfig),
        fetchAdminStatsFromSupabase(supabaseConfig),
      ]);

      if (annRes.error || repRes.error || featRes.error || maintRes.error) {
        setConsoleError(
          `一部データの取得に失敗しました: ${
            annRes.error || repRes.error || featRes.error || maintRes.error
          }`
        );
      }

      setAnnouncements(annRes.data);
      setReports(repRes.data);
      setFeatureRequests(featRes.data);
      setMaintenanceMode(maintRes.enabled);
      setStats(statsRes.stats);
    } catch {
      setConsoleError('データの取得中に予期しないエラーが発生しました。');
    } finally {
      setLoadingData(false);
    }
  }, [isSupabaseConfigured, supabaseConfig]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshAllData();

    if (!isSupabaseConfigured) {
      return subscribeToAllMockEvents({
        onAnnouncementInsert: (item) => {
          setAnnouncements((prev) =>
            prev.some((a) => a.id === item.id) ? prev : [item, ...prev]
          );
        },
        onAnnouncementDelete: (id) => {
          setAnnouncements((prev) => prev.filter((a) => a.id !== id));
        },
        onReportInsert: (rep) => {
          setReports((prev) =>
            prev.some((r) => r.id === rep.id) ? prev : [rep, ...prev]
          );
          setStats(loadMockAdminStats());
        },
        onReportUpdate: (rep) => {
          setReports((prev) => prev.map((r) => (r.id === rep.id ? rep : r)));
          setStats(loadMockAdminStats());
        },
        onReportDelete: (id) => {
          setReports((prev) => prev.filter((r) => r.id !== id));
          setStats(loadMockAdminStats());
        },
        onFeatureRequestInsert: (req) => {
          setFeatureRequests((prev) =>
            prev.some((r) => r.id === req.id) ? prev : [req, ...prev]
          );
        },
        onFeatureRequestUpdate: (req) => {
          setFeatureRequests((prev) =>
            prev.map((r) => (r.id === req.id ? req : r))
          );
        },
        onFeatureRequestDelete: (id) => {
          setFeatureRequests((prev) => prev.filter((r) => r.id !== id));
        },
        onMaintenanceUpdate: (enabled) => {
          setMaintenanceMode(enabled);
        },
        onMessageInsert: () => setStats(loadMockAdminStats()),
        onMessageDelete: () => setStats(loadMockAdminStats()),
      });
    }

    const unsubAnn = subscribeToOfficialAnnouncementsRealtime(supabaseConfig, {
      onInsert: (item) => {
        setAnnouncements((prev) =>
          prev.some((a) => a.id === item.id) ? prev : [item, ...prev]
        );
      },
      onDelete: (id) => {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      },
    });

    const unsubReports = subscribeToReportsRealtime(supabaseConfig, {
      onInsert: (rep) => {
        setReports((prev) =>
          prev.some((r) => r.id === rep.id) ? prev : [rep, ...prev]
        );
      },
      onUpdate: (rep) => {
        setReports((prev) => prev.map((r) => (r.id === rep.id ? rep : r)));
      },
      onDelete: (id) => {
        setReports((prev) => prev.filter((r) => r.id !== id));
      },
    });

    const unsubFeatureReqs = subscribeToFeatureRequestsRealtime(supabaseConfig, {
      onInsert: (req) => {
        setFeatureRequests((prev) =>
          prev.some((r) => r.id === req.id) ? prev : [req, ...prev]
        );
      },
      onUpdate: (req) => {
        setFeatureRequests((prev) =>
          prev.map((r) => (r.id === req.id ? req : r))
        );
      },
      onDelete: (id) => {
        setFeatureRequests((prev) => prev.filter((r) => r.id !== id));
      },
    });

    const unsubMaint = subscribeToMaintenanceModeRealtime(
      supabaseConfig,
      setMaintenanceMode
    );

    return () => {
      unsubAnn();
      unsubReports();
      unsubFeatureReqs();
      unsubMaint();
    };
  }, [isAuthenticated, isSupabaseConfigured, supabaseConfig, refreshAllData]);

  // Keep pendingReports KPI strictly synced with live reports list
  const livePendingReportsCount = useMemo(
    () => reports.filter((r) => r.status === 'pending').length,
    [reports]
  );

  // --- Auth Handlers ---

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    if (Date.now() < lockoutUntil) {
      setAuthError('連続試行制限中です。数秒お待ちください。');
      return;
    }

    setVerifying(true);
    setAuthError(null);
    let ok = false;
    try {
      ok = await verifyAdminStep1Credentials(adminEmail, adminPassword);
    } catch {
      setAuthError('このブラウザ環境では暗号化認証を実行できません（HTTPS接続をご確認ください）。');
      return;
    } finally {
      setVerifying(false);
    }

    if (!ok) {
      failedAttemptsRef.current += 1;
      if (failedAttemptsRef.current >= 3) {
        setLockoutUntil(Date.now() + 3000);
      }
      setAuthError('ユーザーIDまたはパスワードが一致しません。');
      return;
    }

    failedAttemptsRef.current = 0;
    setAdminPassword('');
    setPinDigits(['', '', '', '']);
    setAuthStep(2);
    setTimeout(() => pinInputRefs.current[0]?.focus(), 50);
  };

  const handlePinChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    setAuthError(null);
    if (!cleaned) {
      const next = [...pinDigits];
      next[index] = '';
      setPinDigits(next);
      return;
    }
    const chars = cleaned.slice(0, 4 - index).split('');
    const next = [...pinDigits];
    chars.forEach((ch, offset) => {
      next[index + offset] = ch;
    });
    setPinDigits(next);
    const nextIdx = Math.min(index + chars.length, 3);
    pinInputRefs.current[nextIdx]?.focus();
  };

  const handlePinKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace') {
      setAuthError(null);
      if (pinDigits[index]) {
        const next = [...pinDigits];
        next[index] = '';
        setPinDigits(next);
      } else if (index > 0) {
        const next = [...pinDigits];
        next[index - 1] = '';
        setPinDigits(next);
        pinInputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const next = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setPinDigits(next);
    setAuthError(null);
    pinInputRefs.current[Math.min(pasted.length, 3)]?.focus();
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinValue = pinDigits.join('');
    if (pinValue.length !== 4 || verifying) return;
    if (Date.now() < lockoutUntil) {
      setAuthError('連続試行制限中です。数秒お待ちください。');
      return;
    }

    setVerifying(true);
    setAuthError(null);
    let ok = false;
    try {
      ok = await verifyAdminStep2Pin(pinValue);
    } catch {
      setAuthError('このブラウザ環境ではPIN認証を実行できません（HTTPS接続をご確認ください）。');
      return;
    } finally {
      setVerifying(false);
    }

    if (!ok) {
      failedAttemptsRef.current += 1;
      if (failedAttemptsRef.current >= 3) {
        setLockoutUntil(Date.now() + 3000);
      }
      setAuthError('4桁のセキュリティPINコードが一致しません。');
      setPinDigits(['', '', '', '']);
      setTimeout(() => pinInputRefs.current[0]?.focus(), 40);
      return;
    }

    failedAttemptsRef.current = 0;
    grantAdminSession();
    setPinDigits(['', '', '', '']);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAdminSession();
    setIsAuthenticated(false);
    setAuthStep(1);
    setAdminEmail('');
    setAdminPassword('');
    setPinDigits(['', '', '', '']);
    setAuthError(null);
  };

  // --- Admin Console Action Handlers ---

  const handleBroadcastAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = annTitle.trim();
    const cleanContent = annContent.trim();
    if (!cleanTitle || !cleanContent || sendingAnn) return;

    setSendingAnn(true);
    setConsoleError(null);

    if (!isSupabaseConfigured) {
      const created: OfficialAnnouncement = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: cleanTitle,
        content: cleanContent,
        is_important: annImportant,
        created_at: new Date().toISOString(),
      };
      createMockAnnouncement(created);
      setAnnouncements((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      setAnnTitle('');
      setAnnContent('');
      setAnnImportant(false);
      setSendingAnn(false);
      flashSuccess('ROOMLINE公式メッセージを全ユーザーへ配信しました。');
      return;
    }

    const { data, error } = await createOfficialAnnouncementInSupabase(supabaseConfig, {
      title: cleanTitle,
      content: cleanContent,
      is_important: annImportant,
    });
    setSendingAnn(false);

    if (error) {
      setConsoleError(`配信エラー: ${error}`);
      return;
    }
    if (data) {
      setAnnouncements((prev) =>
        prev.some((a) => a.id === data.id) ? prev : [data, ...prev]
      );
    }
    setAnnTitle('');
    setAnnContent('');
    setAnnImportant(false);
    flashSuccess('ROOMLINE公式メッセージをリアルタイム配信しました。');
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    setConfirmDeleteAnnId(null);
    setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));

    if (!isSupabaseConfigured) {
      deleteMockAnnouncement(announcementId);
      flashSuccess('公式メッセージを削除しました。');
      return;
    }

    const { error } = await deleteOfficialAnnouncementFromSupabase(
      supabaseConfig,
      announcementId
    );
    if (error) {
      setConsoleError(`削除エラー: ${error}`);
      void refreshAllData();
      return;
    }
    flashSuccess('公式メッセージを削除しました。');
  };

  const handleChangeReportStatus = async (
    reportId: string,
    nextStatus: ReportStatus
  ) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: nextStatus } : r))
    );

    if (!isSupabaseConfigured) {
      updateMockReportStatus(reportId, nextStatus);
      setStats(loadMockAdminStats());
      return;
    }

    const { error } = await updateReportStatusInSupabase(
      supabaseConfig,
      reportId,
      nextStatus
    );
    if (error) {
      setConsoleError(`ステータス更新エラー: ${error}`);
      void refreshAllData();
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    setConfirmDeleteReportId(null);
    setReports((prev) => prev.filter((r) => r.id !== reportId));

    if (!isSupabaseConfigured) {
      deleteMockReport(reportId);
      setStats(loadMockAdminStats());
      flashSuccess('通報レコードを削除しました。');
      return;
    }

    const { error } = await deleteReportFromSupabase(supabaseConfig, reportId);
    if (error) {
      setConsoleError(`通報削除エラー: ${error}`);
      void refreshAllData();
      return;
    }
    flashSuccess('通報レコードを削除しました。');
  };

  const handleToggleMaintenance = async () => {
    if (togglingMaintenance) return;
    const nextEnabled = !maintenanceMode;
    setTogglingMaintenance(true);
    setConsoleError(null);

    if (!isSupabaseConfigured) {
      saveMockMaintenanceMode(nextEnabled);
      setMaintenanceMode(nextEnabled);
      setTogglingMaintenance(false);
      flashSuccess(
        nextEnabled
          ? '緊急メンテナンスモードをONにしました。一般画面での送信を一時停止しています。'
          : 'メンテナンスモードを解除しました。通常稼働に戻りました。'
      );
      return;
    }

    const { enabled, error } = await setMaintenanceModeInSupabase(
      supabaseConfig,
      nextEnabled
    );
    setTogglingMaintenance(false);
    if (error) {
      setConsoleError(`メンテナンス切替エラー: ${error}`);
      return;
    }
    setMaintenanceMode(enabled);
    flashSuccess(
      enabled
        ? '緊急メンテナンスモードをONにしました（全クライアントへ即時反映）。'
        : 'メンテナンスモードを解除しました（全クライアントへ即時反映）。'
    );
  };

  const handlePurgeOldMessages = async () => {
    if (purging) return;
    setPurging(true);
    setConsoleError(null);

    if (!isSupabaseConfigured) {
      const deleted = purgeOldMockMessages(24);
      setStats(loadMockAdminStats());
      setPurging(false);
      setShowPurgeConfirm(false);
      flashSuccess(
        `24時間以上前の古い暗号化メッセージ ${deleted} 件を一括削除しました。`
      );
      return;
    }

    const { deletedCount, error } = await purgeOldMessagesFromSupabase(
      supabaseConfig,
      24
    );
    setPurging(false);
    setShowPurgeConfirm(false);
    if (error) {
      setConsoleError(`パージエラー: ${error}`);
      return;
    }
    flashSuccess(
      `24時間以上前の古い暗号化メッセージ ${deletedCount} 件を一括削除しました。`
    );
    void refreshAllData();
  };

  const handleChangeFeatureStatus = async (
    requestId: string,
    nextStatus: FeatureRequestStatus
  ) => {
    setFeatureRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: nextStatus } : r))
    );

    if (!isSupabaseConfigured) {
      updateMockFeatureRequest(requestId, (r) => ({ ...r, status: nextStatus }));
      flashSuccess(`改善要望のステータスを「${nextStatus}」に変更しました。`);
      return;
    }

    const { error } = await updateFeatureRequestStatusInSupabase(
      supabaseConfig,
      requestId,
      nextStatus
    );
    if (error) {
      setConsoleError(`改善要望のステータス更新エラー: ${error}`);
      void refreshAllData();
      return;
    }
    flashSuccess(`改善要望のステータスを「${nextStatus}」に変更しました。`);
  };

  const handleDeleteFeatureRequest = async (requestId: string) => {
    setConfirmDeleteFeatureId(null);
    setFeatureRequests((prev) => prev.filter((r) => r.id !== requestId));

    if (!isSupabaseConfigured) {
      deleteMockFeatureRequest(requestId);
      flashSuccess('改善要望を削除しました。');
      return;
    }

    const { error } = await deleteFeatureRequestFromSupabase(
      supabaseConfig,
      requestId
    );
    if (error) {
      setConsoleError(`改善要望の削除エラー: ${error}`);
      void refreshAllData();
      return;
    }
    flashSuccess('改善要望を削除しました。');
  };

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return reports;
    return reports.filter((r) => r.status === reportFilter);
  }, [reports, reportFilter]);

  const filteredFeatureRequests = useMemo(() => {
    const base =
      featureFilter === 'all'
        ? featureRequests
        : featureRequests.filter((r) => r.status === featureFilter);
    return [...base].sort((a, b) => {
      if (featureSort === 'popular' && b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [featureRequests, featureFilter, featureSort]);

  // =========================================================================
  // RENDER 1: 2-Step Admin Authentication Gate (`/admin` unauthenticated)
  // =========================================================================
  if (!isAuthenticated) {
    const pinComplete = pinDigits.join('').length === 4;

    return (
      <div className="min-h-[100dvh] w-full overflow-x-clip bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Minimal top bar */}
        <header className="min-h-16 px-4 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              RoomLine Admin Gate
            </span>
          </div>

          <button
            type="button"
            onClick={onExitToLobby}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            通常アプリ（ロビー）へ戻る
          </button>
        </header>

        {/* Auth Card */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl dark:shadow-2xl overflow-hidden">
            {/* Step Progress Header */}
            <div className="px-6 pt-6 pb-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    {authStep === 1 ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <KeyRound className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-slate-900 dark:text-white">
                      管理者ログイン
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {authStep === 1
                        ? 'ステップ 1 / 2 · ID・パスワード認証'
                        : 'ステップ 2 / 2 · 4桁セキュリティPIN認証'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    authStep >= 1 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    authStep === 2 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              </div>
            </div>

            {authStep === 1 ? (
              <form onSubmit={handleStep1Submit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-email-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    管理者ID（メールアドレス）
                  </label>
                  <input
                    id="admin-email-input"
                    type="email"
                    autoComplete="username"
                    required
                    value={adminEmail}
                    onChange={(e) => {
                      setAdminEmail(e.target.value);
                      setAuthError(null);
                    }}
                    placeholder="admin@example.com"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-password-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    パスワード
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password-input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setAuthError(null);
                      }}
                      placeholder="パスワードを入力"
                      className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying || !adminEmail.trim() || !adminPassword}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-xs shadow-emerald-500/20 disabled:shadow-none"
                >
                  {verifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>次へ（PIN認証へ進む）</span>
                </button>

                <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-1">
                  認証情報はブラウザ内で SHA-256 ハッシュ照合されます
                </p>
              </form>
            ) : (
              <form onSubmit={handleStep2Submit} className="p-6 space-y-5">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  第1認証を通過しました。管理者ダッシュボードへ入るには4桁のセキュリティPINコードを入力してください。
                </p>

                <div
                  className="grid grid-cols-4 gap-3"
                  role="group"
                  aria-label="4桁セキュリティPIN入力"
                >
                  {pinDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        pinInputRefs.current[index] = el;
                      }}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={digit}
                      aria-label={`セキュリティPIN ${index + 1}桁目`}
                      onChange={(e) => handlePinChange(index, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(index, e)}
                      onPaste={handlePinPaste}
                      onFocus={(e) => e.target.select()}
                      placeholder="•"
                      className="w-full h-14 text-center text-2xl font-bold font-mono tabular-nums rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all"
                    />
                  ))}
                </div>

                {authError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="submit"
                    disabled={!pinComplete || verifying}
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-xs shadow-emerald-500/20 disabled:shadow-none"
                  >
                    {verifying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>認証して管理コンソールを開く</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep(1);
                      setPinDigits(['', '', '', '']);
                      setAuthError(null);
                    }}
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    ステップ1（ID・パスワード入力）へ戻る
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER 2: Authenticated Admin Console Dashboard (`/admin`)
  // =========================================================================
  return (
    <div className="min-h-[100dvh] w-full overflow-x-clip bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Admin Console Top Header */}
      <header className="sticky top-0 z-30 min-h-[68px] px-4 sm:px-6 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                ROOMLINE 管理コンソール
              </h1>
              {maintenanceMode && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-[10px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                  メンテナンス中
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {isSupabaseConfigured
                ? 'Supabase Realtime 連携中 · ゼロ知識保護モード'
                : 'ゼロ知識保護モード'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshAllData()}
            disabled={loadingData}
            title="統計とデータを再読み込み"
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">更新</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            aria-label={
              themeMode === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'
            }
            title={
              themeMode === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'
            }
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {themeMode === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onExitToLobby}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>通常アプリ（ロビー）へ戻る</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-800/70 text-xs font-semibold text-rose-700 dark:text-rose-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ログアウト</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <div className="flex-1 overflow-y-auto chat-scroll">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Feedback Banners */}
          {consoleError && (
            <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{consoleError}</span>
            </div>
          )}

          {consoleSuccess && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>{consoleSuccess}</span>
            </div>
          )}

          {/* System Statistics KPI Cards */}
          <section aria-label="システム統計" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/85 shadow-xs dark:shadow-none p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>総メッセージ件数（暗号化）</span>
                <MessageSquare className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.totalMessages.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                全件 AES-256-GCM 暗号化保存
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/85 shadow-xs dark:shadow-none p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>アクティブ暗号化ルーム数</span>
                <BarChart3 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.activeEncryptedRooms.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                SHA-256 ハッシュ化IDのみ集計
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/85 shadow-xs dark:shadow-none p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>未対応の通報件数</span>
                <Flag
                  className={`w-4 h-4 ${
                    livePendingReportsCount > 0
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-emerald-500 dark:text-emerald-400'
                  }`}
                />
              </div>
              <div
                className={`text-3xl font-bold font-mono tabular-nums ${
                  livePendingReportsCount > 0
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {livePendingReportsCount.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                通報総数 {reports.length.toLocaleString()} 件中
              </p>
            </div>
          </section>

          {/* Console Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveConsoleTab('announcements')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                activeConsoleTab === 'announcements'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>公式チャット一斉送信</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono tabular-nums ${
                  activeConsoleTab === 'announcements'
                    ? 'bg-black/15 text-white'
                    : 'bg-slate-100 dark:bg-black/20 text-slate-600 dark:text-slate-300'
                }`}
              >
                {announcements.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveConsoleTab('reports')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                activeConsoleTab === 'reports'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Flag className="w-4 h-4" />
              <span>通報管理</span>
              {livePendingReportsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-bold font-mono tabular-nums">
                  {livePendingReportsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveConsoleTab('feature_requests')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                activeConsoleTab === 'feature_requests'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>改善要望の管理</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono tabular-nums ${
                  activeConsoleTab === 'feature_requests'
                    ? 'bg-black/15 text-white'
                    : 'bg-slate-100 dark:bg-black/20 text-slate-600 dark:text-slate-300'
                }`}
              >
                {featureRequests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveConsoleTab('maintenance')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                activeConsoleTab === 'maintenance'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>メンテナンス・保守</span>
              {maintenanceMode && (
                <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* =============================================================== */}
          {/* TAB 1: Official Announcements Broadcast                         */}
          {/* =============================================================== */}
          {activeConsoleTab === 'announcements' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Broadcast Composer */}
              <section className="lg:col-span-5 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs dark:shadow-none p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <BadgeCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      ROOMLINE公式 一斉配信
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      全ユーザーの「ROOMLINE公式」へリアルタイム配信されます
                    </p>
                  </div>
                </div>

                <form onSubmit={handleBroadcastAnnouncement} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="ann-title"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      件名（タイトル）
                    </label>
                    <input
                      id="ann-title"
                      type="text"
                      maxLength={80}
                      required
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      placeholder="例: システムアップデートのお知らせ"
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="ann-content"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      本文
                    </label>
                    <textarea
                      id="ann-content"
                      rows={5}
                      maxLength={1200}
                      required
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                      placeholder="全ユーザーに配信するメッセージ本文を入力してください"
                      className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    />
                  </div>

                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={annImportant}
                      onChange={(e) => setAnnImportant(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-rose-500 focus:ring-rose-500/40"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        重要（緊急メンテナンス・警告バッジを付与）
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        チェックを入れると公式トーク上で赤枠＋警告バッジで強調表示されます
                      </span>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={sendingAnn || !annTitle.trim() || !annContent.trim()}
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:pointer-events-none text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-xs shadow-emerald-500/20 disabled:shadow-none"
                  >
                    {sendingAnn ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>全ユーザーへ一斉送信する</span>
                  </button>
                </form>
              </section>

              {/* Past Announcements History */}
              <section className="lg:col-span-7 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs dark:shadow-none p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">配信済みの公式メッセージ</h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {announcements.length} 件
                  </span>
                </div>

                {announcements.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                    配信済みの公式メッセージはまだありません。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((item) => (
                      <article
                        key={item.id}
                        className={`rounded-xl border p-4 space-y-2 ${
                          item.is_important
                            ? 'bg-rose-50/80 dark:bg-rose-950/25 border-rose-200 dark:border-rose-500/35'
                            : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.is_important && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                  <AlertTriangle className="w-3 h-3" />
                                  重要
                                </span>
                              )}
                              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
                                {item.title}
                              </h3>
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTimeJP(item.created_at)}
                            </p>
                          </div>

                          {confirmDeleteAnnId === item.id ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleDeleteAnnouncement(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white transition-colors"
                              >
                                削除確定
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAnnId(null)}
                                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAnnId(item.id)}
                              aria-label="この公式メッセージを削除"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                          {item.content}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: User Reports Management                                  */}
          {/* =============================================================== */}
          {activeConsoleTab === 'reports' && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs dark:shadow-none p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">ユーザー通報一覧</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    通報フォームから送信された内容のみをリアルタイム管理します（暗号化チャット本文は含まれません）
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['all', 'すべて'],
                      ['pending', '未対応'],
                      ['reviewed', '確認済み'],
                      ['resolved', '対応完了'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setReportFilter(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        reportFilter === key
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredReports.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <Flag className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    該当する通報はありません
                  </p>
                  <p className="text-xs text-slate-500">
                    新しい通報が送信されると自動的にここへ反映されます。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReports.map((rep) => {
                    const statusMeta = REPORT_STATUS_META[rep.status];
                    return (
                      <article
                        key={rep.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/75 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                                {rep.reason}
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                                {formatDateTimeJP(rep.created_at)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              <span className="text-slate-500 dark:text-slate-400">
                                対象ユーザー:{' '}
                                <strong className="text-rose-600 dark:text-rose-200 font-semibold">
                                  {rep.target_user_name}
                                </strong>
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                通報者:{' '}
                                <strong className="text-slate-800 dark:text-slate-200 font-medium">
                                  {rep.reporter_name}
                                </strong>
                              </span>
                            </div>
                          </div>

                          {/* Delete report button */}
                          {confirmDeleteReportId === rep.id ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleDeleteReport(rep.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white transition-colors"
                              >
                                削除確定
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteReportId(null)}
                                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteReportId(rep.id)}
                              aria-label="通報を削除"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 whitespace-pre-wrap break-words">
                          {rep.details || '（詳細コメントなし）'}
                        </p>

                        {/* One-click status switcher */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[11px] text-slate-500 mr-1">
                            ステータス変更:
                          </span>
                          {(
                            [
                              ['pending', '未対応'],
                              ['reviewed', '確認済み'],
                              ['resolved', '対応完了'],
                            ] as const
                          ).map(([statusKey, label]) => (
                            <button
                              key={statusKey}
                              type="button"
                              onClick={() =>
                                void handleChangeReportStatus(rep.id, statusKey)
                              }
                              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                rep.status === statusKey
                                  ? REPORT_STATUS_META[statusKey].badgeClass
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* =============================================================== */}
          {/* TAB 3: Feature Requests Management                              */}
          {/* =============================================================== */}
          {activeConsoleTab === 'feature_requests' && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs dark:shadow-none p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    改善お願い投票ボックス管理
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ユーザーから投稿された要望のステータス変更・不適切な投稿の削除を行えます
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFeatureSort('popular')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        featureSort === 'popular'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      人気順
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeatureSort('newest')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        featureSort === 'newest'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      新着順
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', '検討中', '開発中', '実装済み'] as const).map(
                      (statusKey) => (
                        <button
                          key={statusKey}
                          type="button"
                          onClick={() => setFeatureFilter(statusKey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            featureFilter === statusKey
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {statusKey === 'all' ? 'すべて' : statusKey}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {filteredFeatureRequests.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <Lightbulb className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    該当する改善要望はありません
                  </p>
                  <p className="text-xs text-slate-500">
                    ユーザーから新しい要望が投稿されると自動的に反映されます。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFeatureRequests.map((req) => {
                    const statusMeta =
                      FEATURE_STATUS_META[req.status] ||
                      FEATURE_STATUS_META['検討中'];

                    return (
                      <article
                        key={req.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/75 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                                <ThumbsUp className="w-3 h-3" />
                                {req.votes} 票
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                投稿者: <strong className="font-semibold text-slate-700 dark:text-slate-200">{req.author_name}</strong>
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                                {formatDateTimeJP(req.created_at)}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
                              {req.title}
                            </h3>
                          </div>

                          {/* Delete feature request button (2-step confirm) */}
                          {confirmDeleteFeatureId === req.id ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteFeatureRequest(req.id)
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white transition-colors"
                              >
                                削除確定
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteFeatureId(null)}
                                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteFeatureId(req.id)}
                              aria-label="この改善要望を削除"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {req.description && (
                          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 whitespace-pre-wrap break-words">
                            {req.description}
                          </p>
                        )}

                        {/* One-click status switcher */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[11px] text-slate-500 mr-1">
                            ステータス変更:
                          </span>
                          {(['検討中', '開発中', '実装済み'] as const).map(
                            (st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  void handleChangeFeatureStatus(req.id, st)
                                }
                                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                  req.status === st
                                    ? FEATURE_STATUS_META[st].badgeClass
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                {st}
                              </button>
                            )
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* =============================================================== */}
          {/* TAB 4: Maintenance Mode & Old Data Cleanup                      */}
          {/* =============================================================== */}
          {activeConsoleTab === 'maintenance' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Emergency Maintenance Mode Control */}
              <section className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs dark:shadow-none p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        maintenanceMode
                          ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Power className="w-5 h-5" />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        maintenanceMode
                          ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {maintenanceMode ? 'メンテナンス中 (ON)' : '通常稼働中 (OFF)'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      緊急メンテナンスモード切替
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      ONにすると全一般ユーザー画面に「現在ROOMLINEはシステムメンテナンス中です」という案内画面が即座に表示され、新規メッセージ送信を一時停止します。管理者画面（/admin）は引き続き操作可能です。
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleMaintenance()}
                  disabled={togglingMaintenance}
                  className={`w-full min-h-[48px] px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    maintenanceMode
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {togglingMaintenance ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                  <span>
                    {maintenanceMode
                      ? 'メンテナンスモードを解除する (OFF)'
                      : '緊急メンテナンスモードを有効にする (ON)'}
                  </span>
                </button>
              </section>

              {/* Old Encrypted Messages Bulk Purge */}
              <section className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs dark:shadow-none p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      古いデータのクリーンアップ（一括パージ）
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      24時間以上前に保存された暗号化メッセージをデータベースから一括削除し、ストレージ容量を軽量化します。この操作は取り消せません。
                    </p>
                  </div>
                </div>

                {showPurgeConfirm ? (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 space-y-3">
                    <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-200 leading-relaxed">
                      <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        本当に24時間以上前の古い暗号化メッセージをすべて削除しますか？
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handlePurgeOldMessages()}
                        disabled={purging}
                        className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {purging ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>一括削除を実行</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPurgeConfirm(false)}
                        disabled={purging}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPurgeConfirm(true)}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-800/70 text-sm font-semibold text-rose-700 dark:text-rose-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>24時間以上前の古い暗号化メッセージを一括削除</span>
                  </button>
                )}
              </section>

              {/* Zero-Knowledge Architecture Assurance Card */}
              <section className="md:col-span-2 min-w-0 rounded-2xl border border-sky-200 dark:border-sky-500/25 bg-sky-50/70 dark:bg-sky-950/15 p-5 flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs leading-relaxed">
                  <h3 className="font-bold text-sky-900 dark:text-sky-200">
                    ゼロ知識セキュリティ設計（管理者閲覧不可）
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    本コンソールでは件数統計・公式配信・通報管理・保守操作のみを行います。各ルームの6桁番号と合言葉は SHA-256 で不可逆ハッシュ化され、会話内容とリプライ引用はユーザーのブラウザ内で AES-256-GCM 暗号化されているため、管理者から私的な会話内容を閲覧・復号することはできません。
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
