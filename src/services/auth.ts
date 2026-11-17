import {
  UserAccount,
  UserRole,
  PromoCode,
  CreditActionType,
  INITIAL_FREE_CREDITS,
  DAILY_FREE_CREDITS,
  DAILY_FREE_RESET_MS,
  CREDIT_COST_VIEW,
  CREDIT_COST_ACCESS,
  APP_LAUNCH_CREDIT_COST,
  PROMO_CODE_REGEX,
} from '../types';
import {
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import { signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';

export const ADMIN_PHONE = '0775987267';

export const ADMIN_CREDENTIALS = {
  email: 'vanloiphuhiep.09@gmail.com',
  password: 'Quantri@26',
  phone: ADMIN_PHONE,
};

const TEACHERS_STORAGE_KEY = 'hoclieuso_teachers_v1';
const SESSION_STORAGE_KEY = 'hoclieuso_current_user_v1';
const PROMO_CODES_STORAGE_KEY = 'hoclieuso_promo_codes_v1';

function toMillis(val: any, fallback = Date.now()): number {
  if (typeof val === 'number') return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  return fallback;
}

class AuthService {
  private cachedTeachers: UserAccount[] = [];
  private cachedPromoCodes: PromoCode[] = [];
  private syncingProfilePromises = new Map<
    string,
    Promise<{ success: boolean; message: string; user?: UserAccount }>
  >();

  constructor() {
    this.initFromStorage();
  }

  private initFromStorage(): void {
    try {
      const data = localStorage.getItem(TEACHERS_STORAGE_KEY);
      if (data) this.cachedTeachers = JSON.parse(data);
    } catch {
      this.cachedTeachers = [];
    }
    try {
      const codes = localStorage.getItem(PROMO_CODES_STORAGE_KEY);
      if (codes) this.cachedPromoCodes = JSON.parse(codes);
    } catch {
      this.cachedPromoCodes = [];
    }
  }

  private async getFirebaseHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      await auth.authStateReady?.();
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
    return headers;
  }

  private async getAdminHeaders(): Promise<Record<string, string>> {
    const headers = await this.getFirebaseHeaders();
    const current = this.getCurrentUser();
    if (current?.role === 'admin') {
      headers['x-admin-email'] = ADMIN_CREDENTIALS.email;
      headers['x-admin-password'] = ADMIN_CREDENTIALS.password;
    }
    return headers;
  }

  getTotalCredits(user: UserAccount | null): number {
    if (!user) return 0;
    if (user.role === 'admin') return 999999;
    return Math.max(0, Math.floor(user.credits ?? 0));
  }

  getNextFreeResetTimestamp(user: UserAccount | null): number | null {
    if (!user || user.role === 'admin') return null;
    const base =
      typeof user.lastFreeResetAt === 'number' && Number.isFinite(user.lastFreeResetAt)
        ? user.lastFreeResetAt
        : user.createdAt;
    if (!base) return null;
    return base + DAILY_FREE_RESET_MS;
  }

  formatTimeUntilFreeReset(user: UserAccount | null): string | null {
    const nextAt = this.getNextFreeResetTimestamp(user);
    if (!nextAt) return null;
    const diff = Math.max(0, nextAt - Date.now());
    if (diff === 0) return 'sắp làm mới';
    const totalMinutes = Math.ceil(diff / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours} giờ ${minutes > 0 ? `${minutes} phút` : ''}`.trim();
    }
    return `${minutes} phút`;
  }

  async fetchTeachersFromServer(): Promise<UserAccount[]> {
    try {
      const headers = await this.getAdminHeaders();
      const res = await fetch('/api/teachers', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.teachers)) {
          this.cachedTeachers = data.teachers;
          localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(data.teachers));
          return data.teachers;
        }
      }
    } catch (err) {
      console.warn('Could not fetch teachers from server, using local cache:', err);
    }

    if (auth.currentUser?.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()) {
      const path = 'users';
      try {
        const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            email: data.email,
            fullName: data.fullName,
            photoURL: data.photoURL,
            role: data.role || 'teacher',
            status: 'active',
            credits: typeof data.credits === 'number' ? data.credits : INITIAL_FREE_CREDITS,
            lastFreeResetAt: toMillis(data.lastFreeResetAt ?? data.createdAt),
            lastRedeemedCode: data.lastRedeemedCode,
            createdAt: toMillis(data.createdAt),
            updatedAt: toMillis(data.updatedAt),
          } as UserAccount;
        });
        this.cachedTeachers = list;
        localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(list));
        return list;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    }

    return this.getTeachers();
  }

  getTeachers(): UserAccount[] {
    try {
      const data = localStorage.getItem(TEACHERS_STORAGE_KEY);
      if (data) return JSON.parse(data);
      return this.cachedTeachers;
    } catch {
      return this.cachedTeachers;
    }
  }

  saveTeachers(teachers: UserAccount[]): void {
    this.cachedTeachers = teachers;
    localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(teachers));
  }

  getPromoCodes(): PromoCode[] {
    try {
      const data = localStorage.getItem(PROMO_CODES_STORAGE_KEY);
      if (data) return JSON.parse(data);
      return this.cachedPromoCodes;
    } catch {
      return this.cachedPromoCodes;
    }
  }

  async fetchPromoCodes(): Promise<PromoCode[]> {
    try {
      const headers = await this.getAdminHeaders();
      const res = await fetch('/api/promo-codes', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.promoCodes)) {
          this.cachedPromoCodes = data.promoCodes;
          localStorage.setItem(PROMO_CODES_STORAGE_KEY, JSON.stringify(data.promoCodes));
          return data.promoCodes;
        }
      }
    } catch (err) {
      console.warn('Could not fetch promo codes from server:', err);
    }

    if (auth.currentUser?.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()) {
      const path = 'promo_codes';
      try {
        const snap = await getDocs(query(collection(db, path), orderBy('created_at', 'desc')));
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            code: data.code || d.id,
            credit_value: Number(data.credit_value || 0),
            is_used: Boolean(data.is_used),
            used_by: data.used_by ?? null,
            used_at: data.used_at ? toMillis(data.used_at) : null,
            created_by: data.created_by || ADMIN_CREDENTIALS.email,
            created_at: toMillis(data.created_at),
          } as PromoCode;
        });
        this.cachedPromoCodes = list;
        localStorage.setItem(PROMO_CODES_STORAGE_KEY, JSON.stringify(list));
        return list;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    }

    return this.getPromoCodes();
  }

  getCurrentUser(): UserAccount | null {
    try {
      const session = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!session) return null;
      const parsed = JSON.parse(session);
      if (parsed && typeof parsed.credits !== 'number') {
        parsed.credits =
          typeof parsed.freeCredits === 'number' || typeof parsed.paidCredits === 'number'
            ? (parsed.freeCredits || 0) + (parsed.paidCredits || 0)
            : INITIAL_FREE_CREDITS;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  setCurrentUser(user: UserAccount | null): void {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  getCurrentRole(): UserRole {
    const user = this.getCurrentUser();
    if (!user) return 'guest';
    if (user.role === 'admin') return 'admin';
    if (user.role === 'teacher' && user.status !== 'blocked') return 'teacher';
    return 'guest';
  }

  async refreshCurrentUser(user: UserAccount): Promise<UserAccount> {
    if (user.role === 'admin') return user;
    try {
      const headers = await this.getFirebaseHeaders();
      const res = await fetch(`/api/auth/me?uid=${encodeURIComponent(user.id)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          this.setCurrentUser(data.user);
          return data.user;
        }
      }
    } catch {}
    return user;
  }

  // Google Sign-In for Users & Admin
  async signInWithGoogle(): Promise<{
    success: boolean;
    message: string;
    user?: UserAccount;
  }> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      return await this.syncFirebaseUserProfile(fbUser);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { success: false, message: 'Bạn đã đóng cửa sổ đăng nhập Google.' };
      }
      if (code === 'auth/popup-blocked') {
        return {
          success: false,
          message: 'Trình duyệt đang chặn cửa sổ bật lên. Vui lòng cho phép popup để đăng nhập bằng Google.',
        };
      }
      return {
        success: false,
        message: err?.message || 'Không thể đăng nhập bằng tài khoản Google. Vui lòng thử lại.',
      };
    }
  }

  // Sync Firebase User with Firestore /users/{uid} (credits: 10 for new users) & backend /api/auth/google
  // Deduplicates concurrent calls for the same UID (e.g. signInWithPopup + onAuthStateChanged firing together)
  async syncFirebaseUserProfile(fbUser: FirebaseUser): Promise<{
    success: boolean;
    message: string;
    user?: UserAccount;
  }> {
    const existingSync = this.syncingProfilePromises.get(fbUser.uid);
    if (existingSync) {
      return existingSync;
    }

    const syncPromise = this.performSyncFirebaseUserProfile(fbUser).finally(() => {
      this.syncingProfilePromises.delete(fbUser.uid);
    });
    this.syncingProfilePromises.set(fbUser.uid, syncPromise);
    return syncPromise;
  }

  private async performSyncFirebaseUserProfile(fbUser: FirebaseUser): Promise<{
    success: boolean;
    message: string;
    user?: UserAccount;
  }> {
    const email = (fbUser.email || '').trim().toLowerCase();
    const fullName = fbUser.displayName?.trim() || email.split('@')[0] || 'Giáo viên';
    const photoURL = fbUser.photoURL || undefined;

    if (email === ADMIN_CREDENTIALS.email.toLowerCase()) {
      const adminUser: UserAccount = {
        id: 'admin_root',
        email: ADMIN_CREDENTIALS.email,
        fullName: fullName || 'Quản trị viên Hệ thống',
        photoURL,
        role: 'admin',
        status: 'active',
        credits: 999999,
        createdAt: 1700000000000,
      };
      this.setCurrentUser(adminUser);
      return {
        success: true,
        message: 'Đăng nhập Quản trị viên thành công',
        user: adminUser,
      };
    }

    const userDocPath = `users/${fbUser.uid}`;
    const userRef = doc(db, 'users', fbUser.uid);
    let firestoreCredits = INITIAL_FREE_CREDITS;
    let firestoreCreatedAt = Date.now();
    let firestoreLastFreeResetAt = firestoreCreatedAt;
    let firestoreLastRedeemedCode: string | undefined = undefined;
    let isNewUser = false;

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        isNewUser = true;
        const payload: Record<string, any> = {
          uid: fbUser.uid,
          email,
          fullName,
          role: 'teacher',
          credits: INITIAL_FREE_CREDITS,
          lastFreeResetAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (photoURL) payload.photoURL = photoURL.slice(0, 500);
        try {
          await setDoc(userRef, payload);
        } catch (writeErr) {
          handleFirestoreError(writeErr, OperationType.CREATE, userDocPath);
        }
      } else {
        const data = snap.data();
        firestoreCredits =
          typeof data.credits === 'number' ? data.credits : INITIAL_FREE_CREDITS;
        firestoreCreatedAt = toMillis(data.createdAt);
        firestoreLastFreeResetAt = toMillis(data.lastFreeResetAt ?? data.createdAt, firestoreCreatedAt);
        if (typeof data.lastRedeemedCode === 'string' && data.lastRedeemedCode.trim()) {
          firestoreLastRedeemedCode = data.lastRedeemedCode.trim();
        }

        if (
          Date.now() - firestoreLastFreeResetAt >= DAILY_FREE_RESET_MS &&
          firestoreCredits < DAILY_FREE_CREDITS
        ) {
          try {
            await updateDoc(userRef, {
              credits: DAILY_FREE_CREDITS,
              lastFreeResetAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            firestoreCredits = DAILY_FREE_CREDITS;
            firestoreLastFreeResetAt = Date.now();
          } catch (resetErr) {
            console.warn('Firestore 24h daily credit reset warning:', resetErr);
          }
        }

        if (data.fullName !== fullName || (photoURL && data.photoURL !== photoURL)) {
          const profilePatch: Record<string, any> = {
            fullName,
            updatedAt: serverTimestamp(),
          };
          if (photoURL) profilePatch.photoURL = photoURL.slice(0, 500);
          try {
            await updateDoc(userRef, profilePatch);
          } catch (updErr) {
            handleFirestoreError(updErr, OperationType.UPDATE, userDocPath);
          }
        }
      }
    } catch (readErr) {
      handleFirestoreError(readErr, OperationType.GET, userDocPath);
    }

    let finalUser: UserAccount = {
      id: fbUser.uid,
      email,
      fullName,
      photoURL,
      role: 'teacher',
      status: 'active',
      credits: firestoreCredits,
      lastFreeResetAt: firestoreLastFreeResetAt,
      lastRedeemedCode: firestoreLastRedeemedCode,
      createdAt: firestoreCreatedAt,
      updatedAt: Date.now(),
    };

    try {
      const headers = await this.getFirebaseHeaders();
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid: fbUser.uid,
          email,
          fullName,
          photoURL,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          finalUser = data.user;
        }
      }
    } catch (err) {
      console.warn('Server sync warning during Google sign-in:', err);
    }

    this.setCurrentUser(finalUser);
    return {
      success: true,
      user: finalUser,
      message: isNewUser
        ? `Đăng nhập thành công! Bạn nhận được ${INITIAL_FREE_CREDITS} tín dụng AI miễn phí mỗi ngày (tự động làm mới sau 24 giờ).`
        : 'Đăng nhập thành công!',
    };
  }

  getCreditCostForAction(action: CreditActionType): number {
    if (action === 'access') return CREDIT_COST_ACCESS;
    return CREDIT_COST_VIEW;
  }

  // Consume AI credits via authoritative Backend endpoint according to action tier:
  // view=1 (Xem nội dung Kho ứng dụng / Học liệu số / Thí nghiệm mô phỏng)
  // access=2 (Truy cập Học liệu số / Thí nghiệm mô phỏng)
  async consumeCreditsForApp(
    user: UserAccount,
    action: CreditActionType = 'view'
  ): Promise<{
    success: boolean;
    insufficientCredits?: boolean;
    requiredCredits?: number;
    user: UserAccount;
    message?: string;
  }> {
    if (user.role === 'admin') {
      return { success: true, user };
    }

    const expectedCost = this.getCreditCostForAction(action);

    try {
      const headers = await this.getFirebaseHeaders();
      const res = await fetch('/api/credits/consume', {
        method: 'POST',
        headers,
        body: JSON.stringify({ teacherId: user.id, action }),
      });
      const data = await res.json();

      if (res.status === 402 || data.insufficientCredits) {
        if (data.user) this.setCurrentUser(data.user);
        return {
          success: false,
          insufficientCredits: true,
          requiredCredits: data.requiredCredits || expectedCost,
          user: data.user || user,
          message:
            data.message ||
            `Số dư tín dụng AI không đủ hoặc đã hết (cần ${expectedCost} tín dụng AI). Vui lòng liên lạc Quản trị viên qua số điện thoại ${ADMIN_PHONE} để nhận mã kích hoạt.`,
        };
      }

      if (res.ok && data.success && data.user) {
        this.setCurrentUser(data.user);
        return { success: true, user: data.user };
      }

      return {
        success: false,
        user,
        message: data.message || 'Không thể trừ tín dụng AI. Vui lòng thử lại.',
      };
    } catch {
      return {
        success: false,
        user,
        message: 'Lỗi kết nối máy chủ khi kiểm tra tín dụng AI.',
      };
    }
  }

  // Redeem Promo Code via Backend (anti-cheat: verified Firebase ID Token + Firestore promo_codes check & credit increment)
  async redeemPromoCode(
    user: UserAccount,
    rawCode: string
  ): Promise<{
    success: boolean;
    addedCredits?: number;
    user?: UserAccount;
    message: string;
  }> {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode || !PROMO_CODE_REGEX.test(cleanCode)) {
      return {
        success: false,
        message: 'Mã kích hoạt không hợp lệ (chỉ gồm 3-64 ký tự chữ hoa, số, dấu - hoặc _).',
      };
    }

    try {
      const headers = await this.getFirebaseHeaders();
      const res = await fetch('/api/promo-codes/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: cleanCode, teacherId: user.id }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        this.setCurrentUser(data.user);
        return {
          success: true,
          addedCredits: data.addedCredits,
          user: data.user,
          message:
            data.message ||
            `Kích hoạt thành công! Đã cộng +${data.addedCredits} tín dụng AI vào tài khoản.`,
        };
      }

      return {
        success: false,
        message: data.message || 'Mã kích hoạt không hợp lệ hoặc đã được sử dụng.',
      };
    } catch {
      return {
        success: false,
        message: 'Lỗi kết nối máy chủ khi xác nhận mã kích hoạt.',
      };
    }
  }

  // Admin creates a Promo Code
  async adminCreatePromoCode(payload: {
    code?: string;
    credit_value: number;
  }): Promise<{ success: boolean; promoCode?: PromoCode; message: string }> {
    try {
      const headers = await this.getAdminHeaders();
      const res = await fetch('/api/promo-codes', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await this.fetchPromoCodes();
        return {
          success: true,
          promoCode: data.promoCode,
          message: data.message || 'Đã tạo mã kích hoạt thành công!',
        };
      }
      return { success: false, message: data.message || 'Không thể tạo mã kích hoạt.' };
    } catch {
      return { success: false, message: 'Lỗi kết nối máy chủ khi tạo mã kích hoạt.' };
    }
  }

  // Admin deletes a Promo Code
  async adminDeletePromoCode(code: string): Promise<boolean> {
    try {
      const headers = await this.getAdminHeaders();
      const res = await fetch(`/api/promo-codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        await this.fetchPromoCodes();
        return true;
      }
    } catch {}
    return false;
  }

  // Admin directly adds credits / issues an activation code to a teacher account (records in lastRedeemedCode & promo_codes)
  async adminTopUpCredits(
    teacherId: string,
    amount: number,
    code?: string
  ): Promise<{ success: boolean; message: string; user?: UserAccount; code?: string }> {
    try {
      const headers = await this.getAdminHeaders();
      const res = await fetch('/api/credits/topup', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          teacherId,
          amount,
          ...(code ? { code: code.trim().toUpperCase() } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const issuedCode: string | undefined = data.code || data.user?.lastRedeemedCode;
        const addedAmount = Number(data.addedCredits || amount || 0);

        if (auth.currentUser?.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()) {
          try {
            if (issuedCode && PROMO_CODE_REGEX.test(issuedCode)) {
              const promoRef = doc(db, 'promo_codes', issuedCode);
              const promoSnap = await getDoc(promoRef);
              if (!promoSnap.exists()) {
                await setDoc(promoRef, {
                  code: issuedCode,
                  credit_value: addedAmount,
                  is_used: true,
                  used_by: teacherId,
                  used_at: serverTimestamp(),
                  created_by: ADMIN_CREDENTIALS.email,
                  created_at: serverTimestamp(),
                });
              } else if (!promoSnap.data()?.is_used) {
                await updateDoc(promoRef, {
                  is_used: true,
                  used_by: teacherId,
                  used_at: serverTimestamp(),
                });
              }
            }

            const teacherRef = doc(db, 'users', teacherId);
            const snap = await getDoc(teacherRef);
            if (snap.exists()) {
              const currCredits = Number(snap.data().credits || 0);
              const userPatch: Record<string, any> = {
                credits: currCredits + addedAmount,
                updatedAt: serverTimestamp(),
              };
              if (issuedCode && PROMO_CODE_REGEX.test(issuedCode)) {
                userPatch.lastRedeemedCode = issuedCode;
              }
              await updateDoc(teacherRef, userPatch);
            }
          } catch (err) {
            console.warn('Firestore admin topup/code sync warning:', err);
          }
        }

        await Promise.all([this.fetchTeachersFromServer(), this.fetchPromoCodes()]);
        return {
          success: true,
          message: data.message,
          user: data.user,
          code: issuedCode,
        };
      }
      return { success: false, message: data.message || 'Không thể cấp mã / cộng tín dụng' };
    } catch {
      return { success: false, message: 'Lỗi kết nối máy chủ khi cấp mã kích hoạt' };
    }
  }

  // Admin login check
  async loginAdmin(password: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_CREDENTIALS.email, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.setCurrentUser(data.user);
        return { success: true, message: data.message || 'Đăng nhập Quản trị viên thành công', user: data.user };
      }
      return { success: false, message: data.message || 'Mật khẩu quản trị viên không chính xác' };
    } catch {
      if (password === ADMIN_CREDENTIALS.password) {
        const adminUser: UserAccount = {
          id: 'admin_root',
          email: ADMIN_CREDENTIALS.email,
          fullName: 'Quản trị viên Hệ thống',
          role: 'admin',
          status: 'active',
          credits: 999999,
          createdAt: 1700000000000,
        };
        this.setCurrentUser(adminUser);
        return { success: true, message: 'Đăng nhập Quản trị viên thành công', user: adminUser };
      }
      return { success: false, message: 'Mật khẩu quản trị viên không chính xác' };
    }
  }

  // Admin deletes teacher account
  async adminDeleteTeacher(teacherId: string): Promise<boolean> {
    try {
      const headers = await this.getAdminHeaders();
      await fetch(`/api/teachers/${teacherId}`, { method: 'DELETE', headers });
    } catch (err) {
      console.warn('Server delete failed, deleting locally:', err);
    }

    let teachers = this.getTeachers();
    teachers = teachers.filter((t) => t.id !== teacherId);
    this.saveTeachers(teachers);

    const current = this.getCurrentUser();
    if (current && current.id === teacherId) {
      this.setCurrentUser(null);
    }
    return true;
  }

  // Logout
  logout(): void {
    this.setCurrentUser(null);
    signOut(auth).catch(() => {});
  }
}

export const authService = new AuthService();
export { APP_LAUNCH_CREDIT_COST };
