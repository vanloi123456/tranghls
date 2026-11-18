import React, { useState, useEffect, useCallback } from 'react';
import { Home, ChevronRight, Play } from 'lucide-react';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { ControlDeck } from './components/ControlDeck';
import { ZoneAppsRepository } from './components/ZoneAppsRepository';
import { ZoneInteractiveGames } from './components/ZoneInteractiveGames';
import { ZoneSimulations } from './components/ZoneSimulations';
import { Footer } from './components/Footer';

// Modals
import { AddEditContentModal } from './components/AddEditContentModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { AppPlayerModal } from './components/AppPlayerModal';
import { GamePlayerModal } from './components/GamePlayerModal';
import { SimulationPlayerModal } from './components/SimulationPlayerModal';
import { AuthModal } from './components/AuthModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { RedeemCodeModal } from './components/RedeemCodeModal';
import { ContentViewModal } from './components/ContentViewModal';

// Storage, Auth, Routing & Firebase
import { storageService } from './services/storage';
import { authService, ADMIN_PHONE } from './services/auth';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import edtechBackdrop from './assets/images/edtech_canvas_backdrop_1794922302891.jpg';
import {
  ZONE_ROUTES,
  buildHomePath,
  buildZonePath,
  buildItemPath,
  parsePathname,
  findItemByRouteSegment,
  getZoneFromSectionId,
} from './utils/routing';
import {
  ContentItem,
  UserRole,
  UserAccount,
  ZoneType,
  SiteBranding,
  CreditActionType,
  MIN_CREDIT_COST,
} from './types';

export default function App() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backdropFailed, setBackdropFailed] = useState<boolean>(false);

  // Site branding (avatars for home and zones uploaded by admin)
  const [branding, setBranding] = useState<SiteBranding>(() => storageService.getBranding());

  const handleUpdateBranding = (newBranding: SiteBranding) => {
    storageService.saveBranding(newBranding);
    setBranding(newBranding);
  };

  // Authentication & Role states
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => authService.getCurrentUser());
  const [role, setRole] = useState<UserRole>(() => authService.getCurrentRole());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<'teachers' | 'branding'>('teachers');

  // AI Credits / Contact Admin modal
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditModalReason, setCreditModalReason] = useState<string | undefined>(undefined);
  const [requiredCreditsForModal, setRequiredCreditsForModal] = useState<number>(MIN_CREDIT_COST);
  const [pendingLaunch, setPendingLaunch] = useState<{
    type: 'item';
    item: ContentItem;
    action: CreditActionType;
    opener: (item: ContentItem) => void;
  } | null>(null);

  const handleOpenAdminPanel = (tab: 'teachers' | 'branding' = 'teachers') => {
    setAdminPanelTab(tab);
    setIsAdminPanelOpen(true);
  };

  // Content Selection & Modals
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [targetZone, setTargetZone] = useState<ZoneType>('apps');
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ContentItem | null>(null);

  // Active Viewers / Players
  const [viewingItem, setViewingItem] = useState<ContentItem | null>(null);
  const [runningApp, setRunningApp] = useState<ContentItem | null>(null);
  const [playingGame, setPlayingGame] = useState<ContentItem | null>(null);
  const [runningSimulation, setRunningSimulation] = useState<ContentItem | null>(null);

  // Per-teacher permanent app data & real-time external sync state
  const activeTeacherId = currentUser?.id || (role === 'admin' ? 'admin_root' : null);
  const [teacherAppData, setTeacherAppData] = useState<Record<string, Record<string, string>>>({});
  const [externalSyncEvent, setExternalSyncEvent] = useState<{
    itemId: string;
    data: Record<string, string>;
    ts: number;
  } | null>(null);

  // Layout & UI
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeZoneRoute, setActiveZoneRoute] = useState<ZoneType | null>(() => {
    if (typeof window === 'undefined') return null;
    return parsePathname(window.location.pathname).zone || null;
  });
  const [deepLinkBannerItem, setDeepLinkBannerItem] = useState<ContentItem | null>(null);
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (typeof window === 'undefined') return 'trang-chu';
    const parsed = parsePathname(window.location.pathname);
    return parsed.zone ? ZONE_ROUTES[parsed.zone].sectionId : 'trang-chu';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const normalizeItems = (storedItems: any[]): ContentItem[] =>
    storedItems
      .map((item: any) => {
        if (item.zone === 'documents') return { ...item, zone: 'simulations', type: 'simulation' };
        if (item.zone === 'images') return { ...item, zone: 'apps', type: 'app' };
        return item;
      })
      .filter((item: any) => item.zone !== 'videos');

  // Load items and branding from permanent server storage on mount
  useEffect(() => {
    async function initStorage() {
      try {
        const [storedItems, serverBranding] = await Promise.all([
          storageService.getAllItems(),
          storageService.fetchBrandingFromServer(),
        ]);
        setItems(normalizeItems(storedItems));

        if (serverBranding && Object.keys(serverBranding).length > 0) {
          setBranding(serverBranding);
        }
      } catch (err) {
        console.error('Failed to load items from server storage:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initStorage();

    const unsubscribeFsItems = storageService.subscribeItemsRealtime((latestItems) => {
      setItems(normalizeItems(latestItems));
      setIsLoading(false);
    });
    const unsubscribeFsBranding = storageService.subscribeBrandingRealtime((latestBranding) => {
      setBranding(latestBranding);
    });

    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      unsubscribeFsItems();
      unsubscribeFsBranding();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Listen to Firebase Auth state & sync user profile on boot/login (including redirect return on Vercel)
  useEffect(() => {
    authService.handleGoogleRedirectResult().then((redirectRes) => {
      if (redirectRes?.success && redirectRes.user) {
        setCurrentUser(redirectRes.user);
        setRole(authService.getCurrentRole());
        if (redirectRes.user.role === 'admin') {
          storageService.ensureCatalogSeededToFirestore().catch(() => {});
        }
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const synced = await authService.syncFirebaseUserProfile(fbUser);
          if (synced.success && synced.user) {
            setCurrentUser(synced.user);
            setRole(authService.getCurrentRole());
            if (synced.user.role === 'admin') {
              storageService.ensureCatalogSeededToFirestore().catch(() => {});
            }
          }
        } catch (err) {
          console.error('Error syncing Google auth session:', err);
        }
      } else {
        const existing = authService.getCurrentUser();
        if (existing && existing.role === 'teacher') {
          const refreshedUser = await authService.refreshCurrentUser(existing);
          setCurrentUser(refreshedUser);
          setRole(authService.getCurrentRole());
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Automatically check and refresh 5 daily free credits after 24 hours (on timer & tab focus)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'teacher') return;

    let cancelled = false;
    const checkAndRefreshIfDue = async () => {
      const nextResetAt = authService.getNextFreeResetTimestamp(currentUser);
      if (nextResetAt && Date.now() >= nextResetAt) {
        const refreshed = await authService.refreshCurrentUser(currentUser);
        if (!cancelled) {
          setCurrentUser(refreshed);
          setRole(authService.getCurrentRole());
        }
      }
    };

    checkAndRefreshIfDue();

    const nextResetAt = authService.getNextFreeResetTimestamp(currentUser);
    let timerId: number | undefined;
    if (nextResetAt) {
      const remainingMs = Math.max(1000, nextResetAt - Date.now() + 2000);
      if (remainingMs <= 2147483647) {
        timerId = window.setTimeout(checkAndRefreshIfDue, remainingMs);
      }
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefreshIfDue();
      }
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.lastFreeResetAt, currentUser?.credits]);

  // Load teacher's saved app data whenever logged-in account changes
  useEffect(() => {
    let cancelled = false;
    if (!activeTeacherId) {
      setTeacherAppData({});
      return;
    }
    storageService.getTeacherAppData(activeTeacherId).then((data) => {
      if (!cancelled) {
        setTeacherAppData(data || {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTeacherId]);

  // Real-time Server-Sent Events subscription for items, branding, teacher credits & app data
  useEffect(() => {
    const unsubscribe = storageService.subscribeRealtime(async (ev) => {
      if (!ev || !ev.type) return;

      if (ev.type === 'items_updated') {
        try {
          const latest = await storageService.getAllItems();
          setItems(normalizeItems(latest));
        } catch {}
      } else if (ev.type === 'branding_updated' && ev.branding) {
        setBranding(ev.branding);
      } else if (
        ev.type === 'teachers_updated' &&
        currentUser &&
        currentUser.role === 'teacher' &&
        (!ev.teacherId || ev.teacherId === currentUser.id)
      ) {
        const refreshed = await authService.refreshCurrentUser(currentUser);
        setCurrentUser(refreshed);
      } else if (
        ev.type === 'teacher_app_data_updated' &&
        activeTeacherId &&
        ev.teacherId === activeTeacherId &&
        ev.clientId !== storageService.clientId
      ) {
        const nextItemData = ev.data || {};
        setTeacherAppData((prev) => ({
          ...prev,
          [ev.itemId]: nextItemData,
        }));
        setExternalSyncEvent({
          itemId: ev.itemId,
          data: nextItemData,
          ts: ev.ts || Date.now(),
        });
      }
    });

    return unsubscribe;
  }, [activeTeacherId, currentUser]);

  const handleTeacherStorageMutation = (
    itemId: string,
    payload: { op: 'set' | 'remove' | 'clear'; key?: string; value?: string }
  ) => {
    if (!activeTeacherId) return;

    setTeacherAppData((prev) => {
      const currentItemMap = { ...(prev[itemId] || {}) };
      if (payload.op === 'set' && typeof payload.key === 'string') {
        currentItemMap[payload.key] = String(payload.value ?? '');
      } else if (payload.op === 'remove' && typeof payload.key === 'string') {
        delete currentItemMap[payload.key];
      } else if (payload.op === 'clear') {
        for (const k of Object.keys(currentItemMap)) delete currentItemMap[k];
      }
      return {
        ...prev,
        [itemId]: currentItemMap,
      };
    });

    storageService.mutateTeacherAppData(activeTeacherId, itemId, payload);
  };

  const pushUrlPath = useCallback((path: string) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== path) {
      window.history.pushState({ path }, '', path);
    }
  }, []);

  const closeAllContentModals = useCallback(() => {
    setViewingItem(null);
    setRunningApp(null);
    setPlayingGame(null);
    setRunningSimulation(null);
  }, []);

  const navigateToHome = useCallback(() => {
    closeAllContentModals();
    setSelectedItem(null);
    setDeepLinkBannerItem(null);
    setActiveZoneRoute(null);
    setActiveSection('trang-chu');
    pushUrlPath(buildHomePath());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [closeAllContentModals, pushUrlPath]);

  const navigateToZone = useCallback(
    (zone: ZoneType) => {
      closeAllContentModals();
      setSelectedItem(null);
      setDeepLinkBannerItem(null);
      setActiveZoneRoute(zone);
      const meta = ZONE_ROUTES[zone];
      setActiveSection(meta.sectionId);
      pushUrlPath(buildZonePath(zone));
      const el = document.getElementById(meta.sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [closeAllContentModals, pushUrlPath]
  );

  // Sync deep-linked route after items load & handle browser Back/Forward (popstate)
  useEffect(() => {
    if (isLoading) return;

    const syncFromCurrentPath = (isInitialLoad: boolean) => {
      const parsed = parsePathname(window.location.pathname);
      if (parsed.type === 'home') {
        closeAllContentModals();
        setSelectedItem(null);
        setDeepLinkBannerItem(null);
        setActiveZoneRoute(null);
        setActiveSection('trang-chu');
        return;
      }

      if (parsed.zone) {
        setActiveZoneRoute(parsed.zone);
        setActiveSection(ZONE_ROUTES[parsed.zone].sectionId);
        if (isInitialLoad && parsed.type === 'zone') {
          setTimeout(() => {
            const el = document.getElementById(ZONE_ROUTES[parsed.zone!].sectionId);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 120);
        }
      }

      if (parsed.type === 'item' && parsed.itemSlugOrId) {
        const matched = findItemByRouteSegment(items, parsed.itemSlugOrId, parsed.zone);
        if (matched) {
          setActiveZoneRoute(matched.zone);
          setActiveSection(ZONE_ROUTES[matched.zone].sectionId);
          setSelectedItem(matched);
          setDeepLinkBannerItem(matched);
          if (isInitialLoad) {
            setTimeout(() => {
              const el = document.getElementById(ZONE_ROUTES[matched.zone].sectionId);
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 120);
          }
        }
      } else {
        closeAllContentModals();
        setSelectedItem(null);
        setDeepLinkBannerItem(null);
      }
    };

    syncFromCurrentPath(true);

    const onPopState = () => {
      syncFromCurrentPath(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isLoading, items, closeAllContentModals]);

  // Track active section for navigation
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveSection('trang-chu');
        return;
      }

      const sections = ['kho-ung-dung', 'tro-choi-tuong-tac', 'thi-nghiem-mo-phong'];
      const scrollPosition = window.scrollY + 200;

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auth Handlers
  const handleOpenAuth = () => {
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (user: UserAccount | null) => {
    if (user) {
      authService.setCurrentUser(user);
    }
    setCurrentUser(user);
    setRole(
      user
        ? user.role === 'admin'
          ? 'admin'
          : user.status !== 'blocked'
          ? 'teacher'
          : 'guest'
        : authService.getCurrentRole()
    );
    if (user && pendingLaunch) {
      const nextLaunch = pendingLaunch;
      setPendingLaunch(null);
      handleLaunchContentWithCredits(nextLaunch.item, nextLaunch.action, nextLaunch.opener, user);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setRole('guest');
    setPendingLaunch(null);
  };

  const isAdmin = role === 'admin';

  // Launch content with tiered credit deduction:
  // - view: 1 tín dụng (Xem nội dung Kho ứng dụng, Học liệu số, Thí nghiệm mô phỏng)
  // - access: 2 tín dụng (Thực hiện truy cập Học liệu số / Thí nghiệm mô phỏng)
  const handleLaunchContentWithCredits = async (
    item: ContentItem,
    action: CreditActionType,
    onAuthorizedOpen: (item: ContentItem) => void,
    overrideUser?: UserAccount
  ) => {
    setSelectedItem(item);
    const activeUser = overrideUser || currentUser;
    const isActiveTeacherOrAdmin =
      role === 'admin' ||
      activeUser?.role === 'admin' ||
      (Boolean(activeUser) && activeUser?.status !== 'blocked');

    if (!isActiveTeacherOrAdmin || !activeUser) {
      setPendingLaunch({ type: 'item', item, action, opener: onAuthorizedOpen });
      handleOpenAuth();
      return;
    }

    if (role === 'admin' || activeUser.role === 'admin') {
      setPendingLaunch(null);
      onAuthorizedOpen(item);
      return;
    }

    const res = await authService.consumeCreditsForApp(activeUser, action);
    setCurrentUser(res.user);
    setRole(authService.getCurrentRole());

    const needed = res.requiredCredits || authService.getCreditCostForAction(action);
    const remainingCredits = authService.getTotalCredits(res.user);

    if (res.insufficientCredits || (!res.success && remainingCredits < needed)) {
      setPendingLaunch({ type: 'item', item, action, opener: onAuthorizedOpen });
      setRequiredCreditsForModal(needed);
      setCreditModalReason(
        res.message ||
          `Số dư tín dụng AI không đủ hoặc đã hết (cần ${needed} tín dụng AI). Vui lòng liên hệ Quản trị viên qua số điện thoại ${ADMIN_PHONE} để tiếp tục sử dụng.`
      );
      setIsCreditModalOpen(true);
      return;
    }

    if (!res.success) {
      alert(res.message || 'Không thể kiểm tra tín dụng AI. Vui lòng thử lại.');
      return;
    }

    setPendingLaunch(null);
    setDeepLinkBannerItem(null);
    setActiveZoneRoute(item.zone);
    setActiveSection(ZONE_ROUTES[item.zone].sectionId);
    pushUrlPath(buildItemPath(item));
    onAuthorizedOpen(item);
  };

  // Content Handlers: Chỉ Quản trị viên có quyền thêm/sửa/xóa nội dung
  const handleOpenEditModal = (item: ContentItem) => {
    if (!isAdmin) return;
    setTargetZone(item.zone);
    setEditingItem(item);
    setIsAddEditModalOpen(true);
  };

  const handlePromptDelete = (item: ContentItem) => {
    if (!isAdmin) return;
    setItemToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!isAdmin || !itemToDelete) return;
    try {
      await storageService.deleteItem(itemToDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      if (selectedItem?.id === itemToDelete.id) {
        setSelectedItem(null);
      }
      setItemToDelete(null);
    } catch (err) {
      console.error('Lỗi khi xóa nội dung:', err);
      alert('Không thể xóa nội dung. Vui lòng thử lại.');
    }
  };

  const handleSaveItem = async (data: Partial<ContentItem>) => {
    if (!isAdmin) return;

    const now = Date.now();
    let savedItem: ContentItem;

    if (editingItem) {
      savedItem = {
        ...editingItem,
        ...data,
        updatedAt: now,
      } as ContentItem;
    } else {
      savedItem = {
        id: 'item_' + now + '_' + Math.random().toString(36).substr(2, 6),
        zone: data.zone || 'apps',
        title: data.title || '',
        description: data.description || '',
        type: data.type || 'app',
        createdAt: now,
        updatedAt: now,
        order: items.length + 1,
        embedCode: data.embedCode,
        grade: data.grade,
        subject: data.subject,
      };
    }

    await storageService.saveItem(savedItem);

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === savedItem.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedItem;
        return next;
      }
      return [...prev, savedItem];
    });

    setSelectedItem(savedItem);
  };

  // Fullscreen & Reset View
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleResetView = () => {
    navigateToHome();
  };

  // Export / Import
  const handleExport = async () => {
    try {
      const jsonStr = await storageService.exportData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoc-lieu-so-giao-vien-sang-tao-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Không thể xuất dữ liệu học liệu.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const result = await storageService.importData(content);
        setItems(result.items);
        if (result.branding) {
          setBranding(result.branding);
        }
        alert(`Đã nhập thành công ${result.items.length} mục nội dung!`);
      } catch (err: any) {
        alert(err.message || 'Lỗi khi nhập tệp học liệu.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter items
  const appItems = items.filter((i) => i.zone === 'apps');
  const gameItems = items.filter((i) => i.zone === 'games');
  const simItems = items.filter((i) => i.zone === 'simulations');

  return (
    <div className="relative min-h-screen flex flex-col edtech-canvas-fallback text-slate-800 pb-16 md:pl-72">
      {/* Atmospheric Educational Canvas Backdrop */}
      <div
        className="fixed inset-0 md:left-72 z-0 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        {!backdropFailed && (
          <img
            src={edtechBackdrop}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBackdropFailed(true)}
            className="w-full h-full object-cover object-center scale-[1.01] opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-sky-50/48 to-white/75 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.8),transparent_58%),radial-gradient(ellipse_at_bottom_right,rgba(240,253,250,0.75),transparent_62%)]" />
      </div>

      {/* Fixed Left Navigation Bar */}
      <LeftSidebar
        role={role}
        currentUser={currentUser}
        branding={branding}
        onOpenAuth={handleOpenAuth}
        onOpenAdminPanel={() => handleOpenAdminPanel('teachers')}
        onOpenContactAdmin={() => {
          setPendingLaunch(null);
          setRequiredCreditsForModal(MIN_CREDIT_COST);
          setCreditModalReason(undefined);
          setIsCreditModalOpen(true);
        }}
        onLogout={handleLogout}
        activeSection={activeSection}
        onNavigate={(sectionId) => {
          if (sectionId === 'trang-chu') {
            navigateToHome();
            return;
          }
          const zone = getZoneFromSectionId(sectionId);
          if (zone) {
            navigateToZone(zone);
            return;
          }
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onResetView={handleResetView}
        onExport={handleExport}
        onImport={handleImport}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        counts={{
          apps: appItems.length,
          games: gameItems.length,
          sims: simItems.length,
        }}
      />

      {/* Fixed Sticky Top Area (Compact Top Banner + Workspace Control Deck + Breadcrumb Bar) */}
      <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-sky-200/75 shadow-xs">
        <Header
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigateHome={navigateToHome}
        />
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          <ControlDeck
            role={role}
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            onOpenAdminPanel={() => handleOpenAdminPanel('teachers')}
            onOpenAdminPanelTab={handleOpenAdminPanel}
            onOpenContactAdmin={() => {
              setPendingLaunch(null);
              setRequiredCreditsForModal(MIN_CREDIT_COST);
              setCreditModalReason(undefined);
              setIsCreditModalOpen(true);
            }}
            onLogout={handleLogout}
            selectedItem={selectedItem}
            onEditSelected={() => selectedItem && handleOpenEditModal(selectedItem)}
            onDeleteSelected={() => selectedItem && handlePromptDelete(selectedItem)}
            onResetView={handleResetView}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>

        {/* Sticky Breadcrumb Path Bar: Trang chủ > Trang con > Nội dung trên link */}
        {(() => {
          const activeContentItem =
            runningApp || playingGame || runningSimulation || viewingItem || selectedItem;
          const resolvedZone =
            activeContentItem?.zone ||
            activeZoneRoute ||
            getZoneFromSectionId(activeSection);
          const resolvedZoneMeta = resolvedZone ? ZONE_ROUTES[resolvedZone] : null;
          const currentLinkPath = activeContentItem
            ? buildItemPath(activeContentItem)
            : resolvedZone
            ? buildZonePath(resolvedZone)
            : buildHomePath();

          return (
            <div className="border-t border-sky-100/80 bg-sky-50/70">
              <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <nav
                  aria-label="Đường dẫn trang"
                  className="flex items-center gap-1.5 flex-wrap text-slate-600"
                >
                  <button
                    type="button"
                    onClick={navigateToHome}
                    className={`inline-flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                      !resolvedZoneMeta && !activeContentItem
                        ? 'text-sky-800'
                        : 'text-slate-600 hover:text-sky-700'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5 text-sky-600" />
                    <span>Trang chủ</span>
                  </button>

                  {resolvedZoneMeta && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={() => navigateToZone(resolvedZoneMeta.zone)}
                        className={`font-semibold transition-colors cursor-pointer ${
                          !activeContentItem
                            ? 'text-sky-800'
                            : 'text-slate-600 hover:text-sky-700'
                        }`}
                      >
                        {resolvedZoneMeta.label}
                      </button>
                    </>
                  )}

                  {activeContentItem && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold text-sky-900 truncate max-w-[260px] sm:max-w-sm">
                        {activeContentItem.title}
                      </span>
                    </>
                  )}
                </nav>

                <div className="flex items-center gap-2 flex-wrap">
                  {deepLinkBannerItem &&
                    !runningApp &&
                    !playingGame &&
                    !runningSimulation &&
                    !viewingItem && (
                      <button
                        type="button"
                        onClick={() => {
                          const item = deepLinkBannerItem;
                          if (item.zone === 'games') {
                            handleLaunchContentWithCredits(item, 'access', setPlayingGame);
                          } else if (item.zone === 'simulations') {
                            handleLaunchContentWithCredits(item, 'access', setRunningSimulation);
                          } else {
                            handleLaunchContentWithCredits(item, 'view', setRunningApp);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Mở nội dung</span>
                      </button>
                    )}

                  <span
                    className="hidden sm:inline font-mono text-[11px] text-slate-500 bg-white/80 px-2 py-0.5 rounded-md border border-sky-100 truncate max-w-[260px]"
                    title={currentLinkPath}
                  >
                    {currentLinkPath}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-8">

        {/* Loading state indicator */}
        {isLoading ? (
          <div className="py-12 px-6 max-w-md mx-auto rounded-2xl bg-white/85 backdrop-blur-md border border-sky-100 shadow-xs text-center text-slate-500 text-sm">
            Đang khởi động không gian học liệu số...
          </div>
        ) : (
          <div className="space-y-14">
            {/* Zone 1: Kho Ứng Dụng */}
            <ZoneAppsRepository
              items={appItems}
              role={role}
              currentUser={currentUser}
              onOpenAuth={handleOpenAuth}
              onSelectZone={() => navigateToZone('apps')}
              avatarUrl={branding.appsAvatar}
              onUploadAvatar={(url) => handleUpdateBranding({ ...branding, appsAvatar: url })}
              onRemoveAvatar={() => {
                const next = { ...branding };
                delete next.appsAvatar;
                handleUpdateBranding(next);
              }}
              onEditItem={handleOpenEditModal}
              onDeleteItem={handlePromptDelete}
              onLaunchApp={(item) => handleLaunchContentWithCredits(item, 'view', setRunningApp)}
            />

            {/* Zone 2: Học Liệu Số */}
            <ZoneInteractiveGames
              items={gameItems}
              role={role}
              currentUser={currentUser}
              onSelectZone={() => navigateToZone('games')}
              avatarUrl={branding.gamesAvatar}
              onUploadAvatar={(url) => handleUpdateBranding({ ...branding, gamesAvatar: url })}
              onRemoveAvatar={() => {
                const next = { ...branding };
                delete next.gamesAvatar;
                handleUpdateBranding(next);
              }}
              onEditItem={handleOpenEditModal}
              onDeleteItem={handlePromptDelete}
              onViewGame={(item) => handleLaunchContentWithCredits(item, 'view', setViewingItem)}
              onPlayGame={(item) => handleLaunchContentWithCredits(item, 'access', setPlayingGame)}
            />

            {/* Zone 3: Thí Nghiệm Mô Phỏng */}
            <ZoneSimulations
              items={simItems}
              role={role}
              currentUser={currentUser}
              onSelectZone={() => navigateToZone('simulations')}
              avatarUrl={branding.simsAvatar}
              onUploadAvatar={(url) => handleUpdateBranding({ ...branding, simsAvatar: url })}
              onRemoveAvatar={() => {
                const next = { ...branding };
                delete next.simsAvatar;
                handleUpdateBranding(next);
              }}
              onEditItem={handleOpenEditModal}
              onDeleteItem={handlePromptDelete}
              onViewSimulation={(item) => handleLaunchContentWithCredits(item, 'view', setViewingItem)}
              onLaunchSimulation={(item) =>
                handleLaunchContentWithCredits(item, 'access', setRunningSimulation)
              }
            />
          </div>
        )}
      </main>

      {/* Fixed Footer */}
      <Footer />

      {/* Modals & Dialogs */}
      <ContentViewModal
        item={viewingItem}
        onNavigateHome={navigateToHome}
        onNavigateZone={() =>
          viewingItem ? navigateToZone(viewingItem.zone) : navigateToHome()
        }
        onClose={() => {
          const z = viewingItem?.zone;
          setViewingItem(null);
          if (z) pushUrlPath(buildZonePath(z));
        }}
      />

      <AddEditContentModal
        isOpen={isAddEditModalOpen}
        defaultZone={targetZone}
        editingItem={editingItem}
        onSave={handleSaveItem}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingItem(null);
        }}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(itemToDelete)}
        title="Xác nhận xóa nội dung"
        itemTitle={itemToDelete?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />

      <AppPlayerModal
        item={runningApp}
        teacherId={activeTeacherId}
        initialAppData={runningApp ? teacherAppData[runningApp.id] : undefined}
        externalSyncEvent={externalSyncEvent}
        onStorageMutation={handleTeacherStorageMutation}
        onNavigateHome={navigateToHome}
        onNavigateZone={() => navigateToZone('apps')}
        onClose={() => {
          setRunningApp(null);
          pushUrlPath(buildZonePath('apps'));
        }}
      />

      <GamePlayerModal
        item={playingGame}
        teacherId={activeTeacherId}
        initialAppData={playingGame ? teacherAppData[playingGame.id] : undefined}
        externalSyncEvent={externalSyncEvent}
        onStorageMutation={handleTeacherStorageMutation}
        onNavigateHome={navigateToHome}
        onNavigateZone={() => navigateToZone('games')}
        onClose={() => {
          setPlayingGame(null);
          pushUrlPath(buildZonePath('games'));
        }}
      />

      <SimulationPlayerModal
        item={runningSimulation}
        teacherId={activeTeacherId}
        initialAppData={runningSimulation ? teacherAppData[runningSimulation.id] : undefined}
        externalSyncEvent={externalSyncEvent}
        onStorageMutation={handleTeacherStorageMutation}
        onNavigateHome={navigateToHome}
        onNavigateZone={() => navigateToZone('simulations')}
        onClose={() => {
          setRunningSimulation(null);
          pushUrlPath(buildZonePath('simulations'));
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onSuccess={handleAuthSuccess}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <RedeemCodeModal
        isOpen={isCreditModalOpen}
        user={currentUser}
        reasonMessage={creditModalReason}
        pendingItemTitle={pendingLaunch ? pendingLaunch.item.title : undefined}
        requiredCredits={requiredCreditsForModal}
        onUserUpdated={(updated) => {
          authService.setCurrentUser(updated);
          setCurrentUser(updated);
          setRole(authService.getCurrentRole());
        }}
        onContinueAfterRedeem={async (updatedUser) => {
          const nextLaunch = pendingLaunch;
          setIsCreditModalOpen(false);
          setCreditModalReason(undefined);
          setPendingLaunch(null);
          if (nextLaunch) {
            await handleLaunchContentWithCredits(
              nextLaunch.item,
              nextLaunch.action,
              nextLaunch.opener,
              updatedUser
            );
          }
        }}
        onClose={() => {
          setIsCreditModalOpen(false);
          setPendingLaunch(null);
        }}
      />

      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        initialTab={adminPanelTab}
        onClose={() => setIsAdminPanelOpen(false)}
        onLogout={handleLogout}
        branding={branding}
        onUpdateBranding={handleUpdateBranding}
        contentCounts={{
          apps: appItems.length,
          games: gameItems.length,
          simulations: simItems.length,
        }}
      />
    </div>
  );
}
