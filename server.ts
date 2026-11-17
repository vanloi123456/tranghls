import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const DATA_DIR = path.resolve(__dirname, 'data');
const TEACHERS_FILE = path.join(DATA_DIR, 'teachers.json');
const BRANDING_FILE = path.join(DATA_DIR, 'branding.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const TEACHER_APP_DATA_FILE = path.join(DATA_DIR, 'teacher_app_data.json');
const PROMO_CODES_FILE = path.join(DATA_DIR, 'promo_codes.json');
const FIREBASE_CONFIG_FILE = path.resolve(__dirname, 'firebase-applet-config.json');

const INITIAL_FREE_CREDITS = 5;
const DAILY_FREE_CREDITS = 5;
const DAILY_FREE_RESET_MS = 24 * 60 * 60 * 1000;
const CREDIT_ACTION_COSTS: Record<string, number> = {
  view: 1,
  access: 2,
};
const PROMO_CODE_REGEX = /^[A-Z0-9_-]{3,64}$/;

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

function getFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    if (!fs.existsSync(FIREBASE_CONFIG_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8'));
    if (raw?.projectId && raw?.apiKey && raw?.firestoreDatabaseId) {
      return {
        projectId: String(raw.projectId),
        apiKey: String(raw.apiKey),
        firestoreDatabaseId: String(raw.firestoreDatabaseId),
      };
    }
    return null;
  } catch {
    return null;
  }
}

const firebaseConfig = getFirebaseConfig();

function getStoredItems(): any[] {
  try {
    if (!fs.existsSync(ITEMS_FILE)) return [];
    const content = fs.readFileSync(ITEMS_FILE, 'utf-8');
    return JSON.parse(content) || [];
  } catch (err) {
    console.error('Error reading items.json:', err);
    return [];
  }
}

function saveStoredItems(items: any[]): void {
  try {
    fs.writeFileSync(ITEMS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing items.json:', err);
  }
}

// Helpers for reading and writing teachers & promo codes
interface StoredTeacher {
  id: string;
  email: string;
  fullName: string;
  photoURL?: string;
  school?: string;
  role: 'teacher';
  status: 'active' | 'blocked';
  credits: number;
  lastFreeResetAt?: number;
  lastRedeemedCode?: string;
  createdAt: number;
  updatedAt?: number;
}

interface StoredPromoCode {
  code: string;
  credit_value: number;
  is_used: boolean;
  used_by: string | null;
  used_at?: number | null;
  created_by: string;
  created_at: number;
}

function normalizeTeacher(teacher: any): StoredTeacher {
  const now = Date.now();
  let credits = INITIAL_FREE_CREDITS;
  if (typeof teacher.credits === 'number' && Number.isFinite(teacher.credits)) {
    credits = Math.max(0, Math.floor(teacher.credits));
  } else if (
    typeof teacher.freeCredits === 'number' ||
    typeof teacher.paidCredits === 'number'
  ) {
    credits = Math.max(
      0,
      Math.floor((teacher.freeCredits || 0) + (teacher.paidCredits || 0))
    );
  }

  const createdAt = typeof teacher.createdAt === 'number' ? teacher.createdAt : now;
  const lastFreeResetAt =
    typeof teacher.lastFreeResetAt === 'number' && Number.isFinite(teacher.lastFreeResetAt)
      ? teacher.lastFreeResetAt
      : createdAt;

  return {
    id: String(teacher.id),
    email: String(teacher.email || '').trim().toLowerCase(),
    fullName: teacher.fullName || 'Giáo viên',
    photoURL: teacher.photoURL,
    school: teacher.school,
    role: 'teacher',
    status: teacher.status === 'blocked' ? 'blocked' : 'active',
    credits,
    lastFreeResetAt,
    lastRedeemedCode: teacher.lastRedeemedCode,
    createdAt,
    updatedAt: teacher.updatedAt || now,
  };
}

function applyDailyFreeCreditReset(teacher: StoredTeacher, now = Date.now()): boolean {
  const lastReset =
    typeof teacher.lastFreeResetAt === 'number' && Number.isFinite(teacher.lastFreeResetAt)
      ? teacher.lastFreeResetAt
      : teacher.createdAt || now;
  if (now - lastReset >= DAILY_FREE_RESET_MS) {
    teacher.lastFreeResetAt = now;
    if (teacher.credits < DAILY_FREE_CREDITS) {
      teacher.credits = DAILY_FREE_CREDITS;
    }
    teacher.updatedAt = now;
    return true;
  }
  return false;
}

function getStoredTeachers(): StoredTeacher[] {
  try {
    if (!fs.existsSync(TEACHERS_FILE)) return [];
    const content = fs.readFileSync(TEACHERS_FILE, 'utf-8');
    const raw = JSON.parse(content) || [];
    return Array.isArray(raw) ? raw.map(normalizeTeacher) : [];
  } catch (err) {
    console.error('Error reading teachers.json:', err);
    return [];
  }
}

function saveStoredTeachers(teachers: StoredTeacher[]): void {
  try {
    fs.writeFileSync(TEACHERS_FILE, JSON.stringify(teachers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing teachers.json:', err);
  }
}

function getStoredPromoCodes(): StoredPromoCode[] {
  try {
    if (!fs.existsSync(PROMO_CODES_FILE)) return [];
    const content = fs.readFileSync(PROMO_CODES_FILE, 'utf-8');
    const raw = JSON.parse(content) || [];
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.error('Error reading promo_codes.json:', err);
    return [];
  }
}

function saveStoredPromoCodes(codes: StoredPromoCode[]): void {
  try {
    fs.writeFileSync(PROMO_CODES_FILE, JSON.stringify(codes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing promo_codes.json:', err);
  }
}

function getStoredBranding(): any {
  try {
    if (!fs.existsSync(BRANDING_FILE)) return {};
    const content = fs.readFileSync(BRANDING_FILE, 'utf-8');
    return JSON.parse(content) || {};
  } catch {
    return {};
  }
}

function saveStoredBranding(data: any): void {
  try {
    fs.writeFileSync(BRANDING_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing branding.json:', err);
  }
}

type TeacherAppDataMap = Record<string, Record<string, Record<string, string>>>;

function getStoredTeacherAppData(): TeacherAppDataMap {
  try {
    if (!fs.existsSync(TEACHER_APP_DATA_FILE)) return {};
    const content = fs.readFileSync(TEACHER_APP_DATA_FILE, 'utf-8');
    return JSON.parse(content) || {};
  } catch (err) {
    console.error('Error reading teacher_app_data.json:', err);
    return {};
  }
}

function saveStoredTeacherAppData(data: TeacherAppDataMap): void {
  try {
    fs.writeFileSync(TEACHER_APP_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing teacher_app_data.json:', err);
  }
}

const ADMIN_CREDENTIALS = {
  email: 'vanloiphuhiep.09@gmail.com',
  password: 'Quantri@26',
};

// --- Firebase Auth ID Token Verification & Firestore REST Helpers ---
interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoUrl?: string;
  idToken: string;
}

function extractBearerToken(authHeader?: string | string[]): string | null {
  if (!authHeader || Array.isArray(authHeader)) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function verifyFirebaseIdToken(
  authHeader?: string | string[]
): Promise<VerifiedFirebaseUser | null> {
  const idToken = extractBearerToken(authHeader);
  if (!idToken || !firebaseConfig?.apiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        firebaseConfig.apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const user = data?.users?.[0];
    if (!user?.localId || !user?.email) return null;
    return {
      uid: String(user.localId),
      email: String(user.email).trim().toLowerCase(),
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName ? String(user.displayName) : undefined,
      photoUrl: user.photoUrl ? String(user.photoUrl) : undefined,
      idToken,
    };
  } catch (err) {
    console.warn('Firebase token verification error:', err);
    return null;
  }
}

function firestoreDocPath(collection: string, docId: string): string {
  return `projects/${firebaseConfig!.projectId}/databases/${firebaseConfig!.firestoreDatabaseId}/documents/${collection}/${encodeURIComponent(
    docId
  )}`;
}

function firestoreDocUrl(collection: string, docId: string): string {
  return `https://firestore.googleapis.com/v1/${firestoreDocPath(collection, docId)}`;
}

function firestoreCommitUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig!.projectId}/databases/${firebaseConfig!.firestoreDatabaseId}:commit`;
}

async function fetchFirestoreDoc(
  collection: string,
  docId: string,
  idToken: string
): Promise<any | null> {
  if (!firebaseConfig) return null;
  try {
    const resp = await fetch(firestoreDocUrl(collection, docId), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function readFsInt(field: any, fallback = 0): number {
  if (!field) return fallback;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Math.floor(Number(field.doubleValue));
  return fallback;
}

function readFsBool(field: any, fallback = false): boolean {
  if (!field) return fallback;
  if (field.booleanValue !== undefined) return Boolean(field.booleanValue);
  return fallback;
}

function readFsString(field: any): string | null {
  if (!field || field.nullValue !== undefined) return null;
  return typeof field.stringValue === 'string' ? field.stringValue : null;
}

function readFsTimestamp(field: any, fallback: number): number {
  if (!field) return fallback;
  if (typeof field.timestampValue === 'string') {
    const parsed = Date.parse(field.timestampValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (field.integerValue !== undefined) return Number(field.integerValue);
  return fallback;
}

async function syncFirestoreDailyResetIfDue(
  fsDoc: any,
  targetUid: string,
  idToken: string,
  now = Date.now()
): Promise<any> {
  if (!fsDoc?.fields || !firebaseConfig) return fsDoc;
  const fsCredits = readFsInt(fsDoc.fields.credits, INITIAL_FREE_CREDITS);
  const fsCreatedAt = readFsTimestamp(fsDoc.fields.createdAt, now);
  const fsLastReset = readFsTimestamp(fsDoc.fields.lastFreeResetAt, fsCreatedAt);

  if (now - fsLastReset >= DAILY_FREE_RESET_MS && fsCredits < DAILY_FREE_CREDITS) {
    const commitResp = await fetch(firestoreCommitUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: firestoreDocPath('users', targetUid),
              fields: {
                ...fsDoc.fields,
                credits: { integerValue: String(DAILY_FREE_CREDITS) },
              },
            },
            updateMask: { fieldPaths: ['credits', 'lastFreeResetAt', 'updatedAt'] },
            updateTransforms: [
              { fieldPath: 'lastFreeResetAt', setToServerValue: 'REQUEST_TIME' },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { updateTime: fsDoc.updateTime },
          },
        ],
      }),
    }).catch(() => null);

    if (commitResp?.ok) {
      const refreshed = await fetchFirestoreDoc('users', targetUid, idToken);
      if (refreshed) return refreshed;
    }
  }
  return fsDoc;
}

async function verifyAdminRequest(req: express.Request): Promise<{
  isAdmin: boolean;
  adminEmail: string;
  idToken?: string;
}> {
  const verified = await verifyFirebaseIdToken(req.headers.authorization);
  if (verified && verified.email === ADMIN_CREDENTIALS.email.toLowerCase()) {
    return { isAdmin: true, adminEmail: verified.email, idToken: verified.idToken };
  }

  const headerEmail = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
  const headerPass = String(req.headers['x-admin-password'] || '');
  if (
    headerEmail === ADMIN_CREDENTIALS.email.toLowerCase() &&
    headerPass === ADMIN_CREDENTIALS.password
  ) {
    return { isAdmin: true, adminEmail: ADMIN_CREDENTIALS.email };
  }

  return { isAdmin: false, adminEmail: '' };
}

function generateRandomPromoCode(prefix = 'HLS'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // --- Real-time SSE clients ---
  const sseClients = new Set<express.Response>();

  function broadcastRealtime(payload: Record<string, any>): void {
    const line = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(line);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  app.get('/api/realtime', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // --- API Endpoints ---

  // 1. Get all teachers (for Admin panel) — cross-reference promo_codes so lastRedeemedCode is always synced
  app.get('/api/teachers', async (req, res) => {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập danh sách người dùng' });
    }
    const teachers = getStoredTeachers();
    const promoCodes = getStoredPromoCodes();
    const now = Date.now();
    let changed = false;

    for (const teacher of teachers) {
      if (applyDailyFreeCreditReset(teacher, now)) {
        changed = true;
      }

      const usedCodes = promoCodes
        .filter((p) => p.is_used && p.used_by === teacher.id)
        .sort((a, b) => (b.used_at || b.created_at || 0) - (a.used_at || a.created_at || 0));

      if (usedCodes.length > 0 && teacher.lastRedeemedCode !== usedCodes[0].code) {
        teacher.lastRedeemedCode = usedCodes[0].code;
        changed = true;
      }
    }

    if (changed) {
      saveStoredTeachers(teachers);
    }
    res.json({ success: true, teachers });
  });

  // 1b. Get current authenticated user's profile & credits (auto-refresh 5 daily credits after 24h)
  app.get('/api/auth/me', async (req, res) => {
    const verified = await verifyFirebaseIdToken(req.headers.authorization);
    const uid = verified?.uid || (typeof req.query.uid === 'string' ? req.query.uid : '');
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực tài khoản' });
    }
    const now = Date.now();
    const teachers = getStoredTeachers();
    const idx = teachers.findIndex((t) => t.id === uid);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng' });
    }

    const found = teachers[idx];
    let changed = applyDailyFreeCreditReset(found, now);

    if (verified && firebaseConfig) {
      let fsDoc = await fetchFirestoreDoc('users', uid, verified.idToken);
      fsDoc = await syncFirestoreDailyResetIfDue(fsDoc, uid, verified.idToken, now);
      if (fsDoc?.fields?.credits !== undefined) {
        const fsCredits = readFsInt(fsDoc.fields.credits, found.credits);
        const fsReset = readFsTimestamp(
          fsDoc.fields.lastFreeResetAt,
          found.lastFreeResetAt || found.createdAt || now
        );
        if (fsReset > (found.lastFreeResetAt || 0) && fsCredits > found.credits) {
          found.credits = fsCredits;
          found.lastFreeResetAt = fsReset;
          changed = true;
        }
      }
    }

    if (changed) {
      teachers[idx] = found;
      saveStoredTeachers(teachers);
      broadcastRealtime({ type: 'teachers_updated', teacherId: found.id, ts: now });
    }

    res.json({ success: true, user: found });
  });

  // 2. Sync Google Authenticated User (5 daily free credits, automatically refreshed every 24 hours)
  app.post('/api/auth/google', async (req, res) => {
    try {
      const verified = await verifyFirebaseIdToken(req.headers.authorization);
      const body = req.body || {};

      const uid = verified ? verified.uid : String(body.uid || '').trim();
      const email = verified
        ? verified.email
        : String(body.email || '').trim().toLowerCase();
      const fullName =
        String(body.fullName || verified?.displayName || '').trim() ||
        email.split('@')[0] ||
        'Giáo viên';
      const photoURL = verified?.photoUrl || body.photoURL || undefined;

      if (!uid || !email) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin tài khoản Google' });
      }

      if (email === ADMIN_CREDENTIALS.email.toLowerCase()) {
        const adminUser = {
          id: 'admin_root',
          email: ADMIN_CREDENTIALS.email,
          fullName: fullName || 'Quản trị viên Hệ thống',
          photoURL,
          role: 'admin',
          status: 'active',
          credits: 999999,
          createdAt: 1700000000000,
        };
        return res.json({ success: true, user: adminUser, isNewUser: false });
      }

      const now = Date.now();

      // Check Firestore doc if verified idToken is supplied & trigger 24h daily reset if due
      let firestoreCredits: number | null = null;
      let firestoreLastCode: string | undefined = undefined;
      let firestoreLastResetAt: number | null = null;
      if (verified && firebaseConfig) {
        let fsDoc = await fetchFirestoreDoc('users', uid, verified.idToken);
        fsDoc = await syncFirestoreDailyResetIfDue(fsDoc, uid, verified.idToken, now);
        if (fsDoc?.fields?.credits !== undefined) {
          firestoreCredits = readFsInt(fsDoc.fields.credits, INITIAL_FREE_CREDITS);
          firestoreLastCode = readFsString(fsDoc.fields.lastRedeemedCode) || undefined;
          firestoreLastResetAt = readFsTimestamp(
            fsDoc.fields.lastFreeResetAt,
            readFsTimestamp(fsDoc.fields.createdAt, now)
          );
        }
      }

      const teachers = getStoredTeachers();
      const idx = teachers.findIndex(
        (t) => t.id === uid || t.email.toLowerCase() === email
      );

      let isNewUser = false;
      let user: StoredTeacher;

      if (idx === -1) {
        const initialCredits =
          firestoreCredits !== null
            ? firestoreCredits
            : INITIAL_FREE_CREDITS;

        const promoCodes = getStoredPromoCodes();
        const latestUsed = promoCodes
          .filter((p) => p.is_used && p.used_by === uid)
          .sort((a, b) => (b.used_at || b.created_at || 0) - (a.used_at || a.created_at || 0))[0];

        user = {
          id: uid,
          email,
          fullName,
          photoURL,
          role: 'teacher',
          status: 'active',
          credits: initialCredits,
          lastFreeResetAt: firestoreLastResetAt ?? now,
          lastRedeemedCode: firestoreLastCode || latestUsed?.code,
          createdAt: now,
          updatedAt: now,
        };
        teachers.push(user);
        isNewUser = true;
      } else {
        const existing = teachers[idx];
        existing.id = uid;
        existing.role = 'teacher';
        existing.status = 'active';
        existing.fullName = fullName || existing.fullName;
        if (photoURL) existing.photoURL = photoURL;
        if (firestoreLastResetAt && firestoreLastResetAt > (existing.lastFreeResetAt || 0)) {
          existing.lastFreeResetAt = firestoreLastResetAt;
          if (firestoreCredits !== null && firestoreCredits > existing.credits) {
            existing.credits = firestoreCredits;
          }
        }
        // Adopt Firestore credits / lastRedeemedCode if missing or updated directly in Firestore
        if (
          firestoreCredits !== null &&
          firestoreLastCode &&
          firestoreLastCode !== existing.lastRedeemedCode &&
          firestoreCredits > existing.credits
        ) {
          existing.credits = firestoreCredits;
          existing.lastRedeemedCode = firestoreLastCode;
        } else if (firestoreLastCode && !existing.lastRedeemedCode) {
          existing.lastRedeemedCode = firestoreLastCode;
        } else if (!existing.lastRedeemedCode) {
          const latestUsed = getStoredPromoCodes()
            .filter((p) => p.is_used && p.used_by === uid)
            .sort((a, b) => (b.used_at || b.created_at || 0) - (a.used_at || a.created_at || 0))[0];
          if (latestUsed) existing.lastRedeemedCode = latestUsed.code;
        }
        applyDailyFreeCreditReset(existing, now);
        existing.updatedAt = now;
        teachers[idx] = existing;
        user = existing;
      }

      saveStoredTeachers(teachers);
      broadcastRealtime({ type: 'teachers_updated', teacherId: user.id, ts: now });

      res.json({
        success: true,
        user,
        isNewUser,
        message: isNewUser
          ? `Đăng nhập thành công! Tài khoản mới nhận được ${INITIAL_FREE_CREDITS} tín dụng AI miễn phí mỗi ngày (tự động làm mới sau 24 giờ).`
          : 'Đăng nhập thành công!',
      });
    } catch (err: any) {
      console.error('Google auth sync error:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đồng bộ tài khoản' });
    }
  });

  // 3. Admin Email/Password Login
  app.post('/api/login', (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
      }

      const cleanEmail = String(email).trim().toLowerCase();

      if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase()) {
        if (password === ADMIN_CREDENTIALS.password) {
          const adminUser = {
            id: 'admin_root',
            email: ADMIN_CREDENTIALS.email,
            fullName: 'Quản trị viên Hệ thống',
            role: 'admin',
            status: 'active',
            credits: 999999,
            createdAt: 1700000000000,
          };
          return res.json({ success: true, message: 'Đăng nhập Quản trị viên thành công', user: adminUser });
        }
        return res.status(401).json({ success: false, message: 'Mật khẩu quản trị viên không chính xác' });
      }

      return res.status(400).json({
        success: false,
        message: 'Vui lòng sử dụng tài khoản Google để đăng nhập.',
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập' });
    }
  });

  // 4. Consume AI Credits on backend according to verified action tier:
  //    view=1 (Xem nội dung Kho ứng dụng, Học liệu số, Thí nghiệm mô phỏng)
  //    access=2 (Thực hiện truy cập Học liệu số, Thí nghiệm mô phỏng)
  app.post('/api/credits/consume', async (req, res) => {
    try {
      const verified = await verifyFirebaseIdToken(req.headers.authorization);
      const bodyTeacherId = req.body?.teacherId ? String(req.body.teacherId) : '';
      const rawAction = String(req.body?.action || 'view').trim().toLowerCase();
      const cost = CREDIT_ACTION_COSTS[rawAction];

      if (!cost) {
        return res.status(400).json({
          success: false,
          message: 'Loại thao tác tín dụng không hợp lệ.',
        });
      }

      const targetUid = verified ? verified.uid : bodyTeacherId;

      if (!targetUid) {
        return res.status(401).json({
          success: false,
          message: 'Vui lòng đăng nhập để sử dụng tính năng này.',
        });
      }

      if (verified && bodyTeacherId && verified.uid !== bodyTeacherId) {
        return res.status(403).json({
          success: false,
          message: 'Xác thực tài khoản không khớp.',
        });
      }

      const now = Date.now();
      const teachers = getStoredTeachers();
      let idx = teachers.findIndex((t) => t.id === targetUid);

      // Sync from Firestore /users/{uid} if token verified & auto-refresh 24h free credits if due
      let fsDoc: any = null;
      if (verified && firebaseConfig) {
        fsDoc = await fetchFirestoreDoc('users', targetUid, verified.idToken);
        fsDoc = await syncFirestoreDailyResetIfDue(fsDoc, targetUid, verified.idToken, now);
      }

      if (idx === -1 && verified) {
        const fsCredits = fsDoc?.fields?.credits !== undefined
          ? readFsInt(fsDoc.fields.credits, INITIAL_FREE_CREDITS)
          : INITIAL_FREE_CREDITS;
        const fsResetAt = fsDoc?.fields
          ? readFsTimestamp(fsDoc.fields.lastFreeResetAt, readFsTimestamp(fsDoc.fields.createdAt, now))
          : now;
        const created: StoredTeacher = {
          id: verified.uid,
          email: verified.email,
          fullName: verified.displayName || verified.email.split('@')[0],
          photoURL: verified.photoUrl,
          role: 'teacher',
          status: 'active',
          credits: fsCredits,
          lastFreeResetAt: fsResetAt,
          createdAt: now,
          updatedAt: now,
        };
        teachers.push(created);
        idx = teachers.length - 1;
      }

      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
      }

      const teacher = teachers[idx];
      applyDailyFreeCreditReset(teacher, now);

      if (teacher.credits < cost) {
        saveStoredTeachers(teachers);
        return res.status(402).json({
          success: false,
          insufficientCredits: true,
          requiredCredits: cost,
          action: rawAction,
          user: teacher,
          message:
            `Số dư tín dụng AI không đủ hoặc đã hết (thao tác này cần ${cost} tín dụng AI). Hệ thống sẽ tự động làm mới 5 tín dụng AI miễn phí sau 24 giờ, hoặc liên lạc Quản trị viên qua số điện thoại 0775987267 để nhận mã kích hoạt.`,
        });
      }

      const nextCredits = teacher.credits - cost;

      // Best-effort sync deduction to Firestore when Firestore doc has sufficient balance
      if (verified && fsDoc?.fields && firebaseConfig) {
        const currentFsCredits = readFsInt(fsDoc.fields.credits, 0);
        if (currentFsCredits >= cost) {
          const fsNextCredits = currentFsCredits - cost;
          await fetch(firestoreCommitUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${verified.idToken}`,
            },
            body: JSON.stringify({
              writes: [
                {
                  update: {
                    name: firestoreDocPath('users', targetUid),
                    fields: {
                      ...fsDoc.fields,
                      credits: { integerValue: String(fsNextCredits) },
                    },
                  },
                  updateMask: { fieldPaths: ['credits', 'updatedAt'] },
                  updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
                  currentDocument: { updateTime: fsDoc.updateTime },
                },
              ],
            }),
          }).catch((err) => console.warn('Firestore consume sync warning:', err));
        }
      }

      teacher.credits = nextCredits;

      teacher.updatedAt = now;
      teachers[idx] = teacher;
      saveStoredTeachers(teachers);
      broadcastRealtime({ type: 'teachers_updated', teacherId: teacher.id, ts: now });

      res.json({ success: true, user: teacher });
    } catch (err: any) {
      console.error('Consume credit error:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi trừ tín dụng AI' });
    }
  });

  // 5. Anti-cheat Promo Code Redemption (Backend checks promo_codes, flips is_used -> true, saves used_by, adds credit_value)
  app.post('/api/promo-codes/redeem', async (req, res) => {
    try {
      const verified = await verifyFirebaseIdToken(req.headers.authorization);
      const bodyTeacherId = req.body?.teacherId ? String(req.body.teacherId) : '';
      const rawCode = String(req.body?.code || '').trim().toUpperCase();

      if (!rawCode || !PROMO_CODE_REGEX.test(rawCode)) {
        return res.status(400).json({
          success: false,
          message: 'Mã kích hoạt không đúng định dạng (chỉ gồm chữ in hoa, số, dấu - hoặc _).',
        });
      }

      const targetUid = verified ? verified.uid : bodyTeacherId;
      if (!targetUid) {
        return res.status(401).json({
          success: false,
          message: 'Vui lòng đăng nhập trước khi nhập mã kích hoạt.',
        });
      }

      if (verified && bodyTeacherId && verified.uid !== bodyTeacherId) {
        return res.status(403).json({
          success: false,
          message: 'Không được phép kích hoạt mã cho tài khoản khác.',
        });
      }

      const now = Date.now();
      const teachers = getStoredTeachers();
      let tIdx = teachers.findIndex((t) => t.id === targetUid);

      // Step A: Attempt authoritative Firestore transaction commit when user has verified ID token
      let redeemedViaFirestore = false;
      let addedCredits = 0;
      let updatedCredits = 0;

      if (verified && firebaseConfig) {
        const [promoDoc, userDoc] = await Promise.all([
          fetchFirestoreDoc('promo_codes', rawCode, verified.idToken),
          fetchFirestoreDoc('users', targetUid, verified.idToken),
        ]);

        if (promoDoc?.fields) {
          const isUsed = readFsBool(promoDoc.fields.is_used, false);
          if (isUsed) {
            return res.status(409).json({
              success: false,
              message: 'Mã kích hoạt này đã được sử dụng.',
            });
          }

          const creditValue = readFsInt(promoDoc.fields.credit_value, 0);
          if (creditValue <= 0) {
            return res.status(400).json({
              success: false,
              message: 'Giá trị tín dụng của mã kích hoạt không hợp lệ.',
            });
          }

          if (userDoc?.fields) {
            const currentFsCredits = readFsInt(userDoc.fields.credits, INITIAL_FREE_CREDITS);
            const nextFsCredits = currentFsCredits + creditValue;

            const commitResp = await fetch(firestoreCommitUrl(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${verified.idToken}`,
              },
              body: JSON.stringify({
                writes: [
                  {
                    update: {
                      name: firestoreDocPath('promo_codes', rawCode),
                      fields: {
                        ...promoDoc.fields,
                        is_used: { booleanValue: true },
                        used_by: { stringValue: targetUid },
                      },
                    },
                    updateMask: { fieldPaths: ['is_used', 'used_by', 'used_at'] },
                    updateTransforms: [
                      { fieldPath: 'used_at', setToServerValue: 'REQUEST_TIME' },
                    ],
                    currentDocument: { updateTime: promoDoc.updateTime },
                  },
                  {
                    update: {
                      name: firestoreDocPath('users', targetUid),
                      fields: {
                        ...userDoc.fields,
                        credits: { integerValue: String(nextFsCredits) },
                        lastRedeemedCode: { stringValue: rawCode },
                      },
                    },
                    updateMask: {
                      fieldPaths: ['credits', 'lastRedeemedCode', 'updatedAt'],
                    },
                    updateTransforms: [
                      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
                    ],
                    currentDocument: { updateTime: userDoc.updateTime },
                  },
                ],
              }),
            });

            if (!commitResp.ok) {
              const errText = await commitResp.text();
              console.warn('Firestore atomic promo commit rejected:', errText);
              return res.status(409).json({
                success: false,
                message: 'Mã kích hoạt không hợp lệ hoặc đã có người vừa sử dụng.',
              });
            }

            redeemedViaFirestore = true;
            addedCredits = creditValue;
            updatedCredits = nextFsCredits;
          }
        }
      }

      // Step B: Sync or redeem against backend promo_codes store
      const promoCodes = getStoredPromoCodes();
      const pIdx = promoCodes.findIndex((p) => p.code.toUpperCase() === rawCode);

      if (!redeemedViaFirestore) {
        if (pIdx === -1) {
          return res.status(404).json({
            success: false,
            message: 'Mã kích hoạt không tồn tại. Vui lòng kiểm tra lại với Quản trị viên.',
          });
        }

        const promo = promoCodes[pIdx];
        if (promo.is_used) {
          return res.status(409).json({
            success: false,
            message: 'Mã kích hoạt này đã được sử dụng.',
          });
        }

        if (!Number.isInteger(promo.credit_value) || promo.credit_value <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Giá trị tín dụng của mã kích hoạt không hợp lệ.',
          });
        }

        if (tIdx === -1) {
          if (!verified) {
            return res.status(404).json({
              success: false,
              message: 'Không tìm thấy tài khoản giáo viên.',
            });
          }
          teachers.push({
            id: verified.uid,
            email: verified.email,
            fullName: verified.displayName || verified.email.split('@')[0],
            photoURL: verified.photoUrl,
            role: 'teacher',
            status: 'active',
            credits: INITIAL_FREE_CREDITS,
            createdAt: now,
            updatedAt: now,
          });
          tIdx = teachers.length - 1;
        }

        addedCredits = promo.credit_value;
        updatedCredits = teachers[tIdx].credits + addedCredits;

        promoCodes[pIdx] = {
          ...promo,
          is_used: true,
          used_by: targetUid,
          used_at: now,
        };
      } else {
        if (pIdx >= 0) {
          promoCodes[pIdx] = {
            ...promoCodes[pIdx],
            is_used: true,
            used_by: targetUid,
            used_at: now,
          };
        } else {
          promoCodes.unshift({
            code: rawCode,
            credit_value: addedCredits,
            is_used: true,
            used_by: targetUid,
            used_at: now,
            created_by: ADMIN_CREDENTIALS.email,
            created_at: now,
          });
        }

        if (tIdx === -1 && verified) {
          teachers.push({
            id: verified.uid,
            email: verified.email,
            fullName: verified.displayName || verified.email.split('@')[0],
            photoURL: verified.photoUrl,
            role: 'teacher',
            status: 'active',
            credits: updatedCredits,
            lastRedeemedCode: rawCode,
            createdAt: now,
            updatedAt: now,
          });
          tIdx = teachers.length - 1;
        }
      }

      if (tIdx >= 0) {
        teachers[tIdx].credits = updatedCredits;
        teachers[tIdx].lastRedeemedCode = rawCode;
        teachers[tIdx].updatedAt = now;
      }

      saveStoredPromoCodes(promoCodes);
      saveStoredTeachers(teachers);
      broadcastRealtime({ type: 'promo_codes_updated', code: rawCode, ts: now });
      broadcastRealtime({ type: 'teachers_updated', teacherId: targetUid, ts: now });

      res.json({
        success: true,
        addedCredits,
        user: teachers[tIdx],
        message: `Kích hoạt mã ${rawCode} thành công! Đã cộng +${addedCredits} tín dụng AI vào tài khoản.`,
      });
    } catch (err: any) {
      console.error('Redeem promo code error:', err);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi kiểm tra và kích hoạt mã.',
      });
    }
  });

  // 6. Admin Promo Codes Management (promo_codes)
  app.get('/api/promo-codes', async (req, res) => {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Quản trị viên mới được phép xem danh sách mã kích hoạt.',
      });
    }
    const promoCodes = getStoredPromoCodes();
    res.json({ success: true, promoCodes });
  });

  app.post('/api/promo-codes', async (req, res) => {
    try {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ Quản trị viên mới có quyền tạo mã kích hoạt.',
        });
      }

      const requestedCode = String(req.body?.code || '').trim().toUpperCase();
      const creditValue = Math.floor(Number(req.body?.credit_value));

      if (!Number.isFinite(creditValue) || creditValue <= 0 || creditValue > 100000) {
        return res.status(400).json({
          success: false,
          message: 'Số điểm tín dụng của mã kích hoạt phải nằm trong khoảng 1 - 100.000.',
        });
      }

      const promoCodes = getStoredPromoCodes();
      let finalCode = requestedCode || generateRandomPromoCode();
      while (!requestedCode && promoCodes.some((p) => p.code === finalCode)) {
        finalCode = generateRandomPromoCode();
      }

      if (!PROMO_CODE_REGEX.test(finalCode)) {
        return res.status(400).json({
          success: false,
          message: 'Mã kích hoạt chỉ được gồm 3-64 ký tự chữ hoa (A-Z), số (0-9), dấu gạch ngang (-) hoặc gạch dưới (_).',
        });
      }

      if (promoCodes.some((p) => p.code === finalCode)) {
        return res.status(409).json({
          success: false,
          message: `Mã ${finalCode} đã tồn tại. Vui lòng chọn tên mã khác.`,
        });
      }

      const now = Date.now();
      const newPromo: StoredPromoCode = {
        code: finalCode,
        credit_value: creditValue,
        is_used: false,
        used_by: null,
        used_at: null,
        created_by: adminCheck.adminEmail || ADMIN_CREDENTIALS.email,
        created_at: now,
      };

      // Sync to Firestore if Google Admin ID token is present
      if (adminCheck.idToken && firebaseConfig) {
        await fetch(firestoreCommitUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminCheck.idToken}`,
          },
          body: JSON.stringify({
            writes: [
              {
                update: {
                  name: firestoreDocPath('promo_codes', finalCode),
                  fields: {
                    code: { stringValue: finalCode },
                    credit_value: { integerValue: String(creditValue) },
                    is_used: { booleanValue: false },
                    used_by: { nullValue: null },
                    created_by: { stringValue: newPromo.created_by },
                  },
                },
                updateTransforms: [
                  { fieldPath: 'created_at', setToServerValue: 'REQUEST_TIME' },
                ],
                currentDocument: { exists: false },
              },
            ],
          }),
        }).catch((err) => console.warn('Firestore create promo code warning:', err));
      }

      promoCodes.unshift(newPromo);
      saveStoredPromoCodes(promoCodes);
      broadcastRealtime({ type: 'promo_codes_updated', code: finalCode, ts: now });

      res.json({
        success: true,
        promoCode: newPromo,
        message: `Đã tạo mã kích hoạt ${finalCode} (+${creditValue} tín dụng AI).`,
      });
    } catch (err: any) {
      console.error('Create promo code error:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo mã kích hoạt' });
    }
  });

  app.delete('/api/promo-codes/:code', async (req, res) => {
    try {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ Quản trị viên mới có quyền xóa mã kích hoạt.',
        });
      }

      const cleanCode = String(req.params.code || '').trim().toUpperCase();
      let promoCodes = getStoredPromoCodes();
      promoCodes = promoCodes.filter((p) => p.code !== cleanCode);
      saveStoredPromoCodes(promoCodes);

      if (adminCheck.idToken && firebaseConfig && cleanCode) {
        await fetch(firestoreDocUrl('promo_codes', cleanCode), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminCheck.idToken}` },
        }).catch(() => {});
      }

      broadcastRealtime({ type: 'promo_codes_updated', code: cleanCode, ts: Date.now() });
      res.json({ success: true, message: `Đã xóa mã ${cleanCode}` });
    } catch (err: any) {
      console.error('Delete promo code error:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa mã kích hoạt' });
    }
  });

  // 7. Admin Top-Up Credits / Issue Activation Code for a teacher (persists code in lastRedeemedCode & promo_codes)
  app.post('/api/credits/topup', async (req, res) => {
    try {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ Quản trị viên mới có quyền cấp mã kích hoạt hoặc cộng tín dụng.',
        });
      }

      const { teacherId, amount, code } = req.body || {};
      const cleanTeacherId = String(teacherId || '').trim();
      const requestedCode = String(code || '').trim().toUpperCase();
      let numericAmount = Number.isFinite(Number(amount)) ? Math.floor(Number(amount)) : 0;

      if (!cleanTeacherId) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin tài khoản giáo viên.' });
      }

      if (requestedCode && !PROMO_CODE_REGEX.test(requestedCode)) {
        return res.status(400).json({
          success: false,
          message: 'Mã kích hoạt chỉ gồm 3-64 ký tự chữ hoa (A-Z), số (0-9), dấu - hoặc _.',
        });
      }

      const now = Date.now();
      const teachers = getStoredTeachers();
      const idx = teachers.findIndex((t) => t.id === cleanTeacherId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
      }

      const promoCodes = getStoredPromoCodes();
      let finalCode = requestedCode;
      let savedPromo: StoredPromoCode;

      if (finalCode) {
        const existingPromoIdx = promoCodes.findIndex((p) => p.code.toUpperCase() === finalCode);
        if (existingPromoIdx >= 0) {
          const existingPromo = promoCodes[existingPromoIdx];
          if (existingPromo.is_used) {
            return res.status(409).json({
              success: false,
              message: `Mã kích hoạt ${finalCode} đã được sử dụng. Vui lòng nhập hoặc tạo mã khác.`,
            });
          }
          numericAmount = existingPromo.credit_value;
          savedPromo = {
            ...existingPromo,
            is_used: true,
            used_by: cleanTeacherId,
            used_at: now,
          };
          promoCodes[existingPromoIdx] = savedPromo;
        } else {
          if (numericAmount <= 0 || numericAmount > 100000) {
            return res.status(400).json({
              success: false,
              message: 'Số tín dụng AI cấp mới phải nằm trong khoảng 1 - 100.000.',
            });
          }
          savedPromo = {
            code: finalCode,
            credit_value: numericAmount,
            is_used: true,
            used_by: cleanTeacherId,
            used_at: now,
            created_by: adminCheck.adminEmail || ADMIN_CREDENTIALS.email,
            created_at: now,
          };
          promoCodes.unshift(savedPromo);
        }
      } else {
        if (numericAmount <= 0 || numericAmount > 100000) {
          return res.status(400).json({
            success: false,
            message: 'Thông tin cộng tín dụng không hợp lệ (1 - 100.000).',
          });
        }
        finalCode = generateRandomPromoCode();
        while (promoCodes.some((p) => p.code === finalCode)) {
          finalCode = generateRandomPromoCode();
        }
        savedPromo = {
          code: finalCode,
          credit_value: numericAmount,
          is_used: true,
          used_by: cleanTeacherId,
          used_at: now,
          created_by: adminCheck.adminEmail || ADMIN_CREDENTIALS.email,
          created_at: now,
        };
        promoCodes.unshift(savedPromo);
      }

      teachers[idx].credits = (teachers[idx].credits || 0) + numericAmount;
      teachers[idx].lastRedeemedCode = finalCode;
      teachers[idx].updatedAt = now;

      saveStoredPromoCodes(promoCodes);
      saveStoredTeachers(teachers);

      // Sync to Firestore if Admin Google ID token is available
      if (adminCheck.idToken && firebaseConfig) {
        try {
          const [fsUserDoc, fsPromoDoc] = await Promise.all([
            fetchFirestoreDoc('users', cleanTeacherId, adminCheck.idToken),
            fetchFirestoreDoc('promo_codes', finalCode, adminCheck.idToken),
          ]);

          const writes: any[] = [];
          if (fsPromoDoc?.fields) {
            writes.push({
              update: {
                name: firestoreDocPath('promo_codes', finalCode),
                fields: {
                  ...fsPromoDoc.fields,
                  is_used: { booleanValue: true },
                  used_by: { stringValue: cleanTeacherId },
                },
              },
              updateMask: { fieldPaths: ['is_used', 'used_by', 'used_at'] },
              updateTransforms: [{ fieldPath: 'used_at', setToServerValue: 'REQUEST_TIME' }],
            });
          } else {
            writes.push({
              update: {
                name: firestoreDocPath('promo_codes', finalCode),
                fields: {
                  code: { stringValue: finalCode },
                  credit_value: { integerValue: String(numericAmount) },
                  is_used: { booleanValue: true },
                  used_by: { stringValue: cleanTeacherId },
                  created_by: { stringValue: savedPromo.created_by },
                },
              },
              updateTransforms: [
                { fieldPath: 'created_at', setToServerValue: 'REQUEST_TIME' },
                { fieldPath: 'used_at', setToServerValue: 'REQUEST_TIME' },
              ],
            });
          }

          if (fsUserDoc?.fields) {
            const fsCredits = readFsInt(fsUserDoc.fields.credits, 0);
            writes.push({
              update: {
                name: firestoreDocPath('users', cleanTeacherId),
                fields: {
                  ...fsUserDoc.fields,
                  credits: { integerValue: String(fsCredits + numericAmount) },
                  lastRedeemedCode: { stringValue: finalCode },
                },
              },
              updateMask: { fieldPaths: ['credits', 'lastRedeemedCode', 'updatedAt'] },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            });
          }

          if (writes.length > 0) {
            await fetch(firestoreCommitUrl(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminCheck.idToken}`,
              },
              body: JSON.stringify({ writes }),
            });
          }
        } catch (fsErr) {
          console.warn('Firestore admin issue code sync warning:', fsErr);
        }
      }

      broadcastRealtime({ type: 'promo_codes_updated', code: finalCode, ts: now });
      broadcastRealtime({ type: 'teachers_updated', teacherId: cleanTeacherId, ts: now });

      res.json({
        success: true,
        user: teachers[idx],
        promoCode: savedPromo,
        code: finalCode,
        addedCredits: numericAmount,
        message: `Đã cấp mã ${finalCode} (+${numericAmount} tín dụng AI) cho ${teachers[idx].fullName}.`,
      });
    } catch (err: any) {
      console.error('Top-up / issue code error:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cấp mã kích hoạt & cộng tín dụng AI' });
    }
  });

  // 8. Admin delete teacher
  app.delete('/api/teachers/:id', async (req, res) => {
    try {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ Quản trị viên mới có quyền xóa tài khoản.',
        });
      }

      const teacherId = req.params.id;
      let teachers = getStoredTeachers();
      teachers = teachers.filter((t) => t.id !== teacherId);
      saveStoredTeachers(teachers);

      const allAppData = getStoredTeacherAppData();
      if (allAppData[teacherId]) {
        delete allAppData[teacherId];
        saveStoredTeacherAppData(allAppData);
      }

      broadcastRealtime({ type: 'teachers_updated', teacherId, ts: Date.now() });
      res.json({ success: true, message: 'Đã xóa tài khoản khỏi máy chủ' });
    } catch (err: any) {
      console.error('Delete teacher error:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa tài khoản' });
    }
  });

  // 9. Site Branding
  app.get('/api/branding', (req, res) => {
    const branding = getStoredBranding();
    res.json({ success: true, branding });
  });

  app.post('/api/branding', (req, res) => {
    try {
      const branding = req.body;
      saveStoredBranding(branding);
      broadcastRealtime({ type: 'branding_updated', branding, ts: Date.now() });
      res.json({ success: true, branding });
    } catch {
      res.status(500).json({ success: false, message: 'Không thể lưu hình đại diện trên máy chủ' });
    }
  });

  // 10. Content Items Endpoints (Kho Ứng Dụng, Học Liệu Số, Thí Nghiệm Mô Phỏng)
  app.get('/api/items', (req, res) => {
    try {
      const items = getStoredItems();
      res.json({ success: true, items });
    } catch (err: any) {
      console.error('Error getting items:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải danh sách học liệu' });
    }
  });

  app.post('/api/items', (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id) {
        return res.status(400).json({ success: false, message: 'Dữ liệu học liệu không hợp lệ' });
      }

      const items = getStoredItems();
      const existingIdx = items.findIndex((i) => i.id === item.id);
      if (existingIdx >= 0) {
        items[existingIdx] = item;
      } else {
        items.push(item);
      }
      saveStoredItems(items);
      broadcastRealtime({ type: 'items_updated', itemId: item.id, ts: Date.now() });
      res.json({ success: true, item, message: 'Đã lưu thành công trên máy chủ' });
    } catch (err: any) {
      console.error('Error saving item:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu học liệu' });
    }
  });

  app.delete('/api/items/:id', (req, res) => {
    try {
      const { id } = req.params;
      let items = getStoredItems();
      items = items.filter((i) => i.id !== id);
      saveStoredItems(items);
      broadcastRealtime({ type: 'items_updated', itemId: id, ts: Date.now() });
      res.json({ success: true, message: 'Đã xóa nội dung khỏi máy chủ' });
    } catch (err: any) {
      console.error('Error deleting item:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa học liệu' });
    }
  });

  app.post('/api/items/batch', (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, message: 'Danh sách học liệu không hợp lệ' });
      }
      saveStoredItems(items);
      broadcastRealtime({ type: 'items_updated', ts: Date.now() });
      res.json({ success: true, count: items.length, message: 'Đã nhập học liệu thành công trên máy chủ' });
    } catch (err: any) {
      console.error('Error batch saving items:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu danh sách học liệu' });
    }
  });

  app.post('/api/items/clear', (req, res) => {
    try {
      saveStoredItems([]);
      broadcastRealtime({ type: 'items_updated', ts: Date.now() });
      res.json({ success: true, message: 'Đã xóa toàn bộ học liệu trên máy chủ' });
    } catch (err: any) {
      console.error('Error clearing items:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi làm trống học liệu' });
    }
  });

  // 11. Per-Teacher Permanent App Data Storage
  app.get('/api/teacher-app-data/:teacherId', (req, res) => {
    try {
      const { teacherId } = req.params;
      const allData = getStoredTeacherAppData();
      res.json({ success: true, data: allData[teacherId] || {} });
    } catch (err: any) {
      console.error('Error reading teacher app data:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải dữ liệu tài khoản' });
    }
  });

  app.get('/api/teacher-app-data/:teacherId/:itemId', (req, res) => {
    try {
      const { teacherId, itemId } = req.params;
      const allData = getStoredTeacherAppData();
      res.json({ success: true, data: (allData[teacherId] && allData[teacherId][itemId]) || {} });
    } catch (err: any) {
      console.error('Error reading item teacher app data:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải dữ liệu ứng dụng' });
    }
  });

  app.post('/api/teacher-app-data/:teacherId/:itemId', (req, res) => {
    try {
      const { teacherId, itemId } = req.params;
      const { op, key, value, data: replaceData, clientId } = req.body || {};

      if (!teacherId || !itemId) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin tài khoản hoặc ứng dụng' });
      }

      const allData = getStoredTeacherAppData();
      if (!allData[teacherId]) {
        allData[teacherId] = {};
      }
      if (!allData[teacherId][itemId]) {
        allData[teacherId][itemId] = {};
      }

      const itemStore = allData[teacherId][itemId];

      if (op === 'set' && typeof key === 'string') {
        itemStore[key] = typeof value === 'string' ? value : String(value ?? '');
      } else if (op === 'remove' && typeof key === 'string') {
        delete itemStore[key];
      } else if (op === 'clear') {
        allData[teacherId][itemId] = {};
      } else if (op === 'replace' && replaceData && typeof replaceData === 'object') {
        allData[teacherId][itemId] = { ...replaceData };
      } else {
        return res.status(400).json({ success: false, message: 'Thao tác cập nhật không hợp lệ' });
      }

      saveStoredTeacherAppData(allData);

      const updatedStore = allData[teacherId][itemId];
      broadcastRealtime({
        type: 'teacher_app_data_updated',
        teacherId,
        itemId,
        data: updatedStore,
        clientId: clientId || null,
        ts: Date.now(),
      });

      res.json({ success: true, data: updatedStore });
    } catch (err: any) {
      console.error('Error saving teacher app data:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu dữ liệu ứng dụng' });
    }
  });

  const httpServer = http.createServer(app);

  // --- Vite Dev Server Middleware or Static Production ---
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
