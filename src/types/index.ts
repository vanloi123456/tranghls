export type ContentType = 'app' | 'game' | 'simulation';

export type ZoneType = 'apps' | 'games' | 'simulations';

export type GradeLevel = 'all' | 'lop-1' | 'lop-2' | 'lop-3' | 'lop-4' | 'lop-5';

export const GRADE_OPTIONS: { id: GradeLevel; label: string }[] = [
  { id: 'all', label: 'Tất cả khối lớp' },
  { id: 'lop-1', label: 'Lớp 1' },
  { id: 'lop-2', label: 'Lớp 2' },
  { id: 'lop-3', label: 'Lớp 3' },
  { id: 'lop-4', label: 'Lớp 4' },
  { id: 'lop-5', label: 'Lớp 5' },
];

export type SubjectType =
  | 'all'
  | 'toan'
  | 'tieng-viet'
  | 'tieng-anh'
  | 'tnxh-khoa-hoc'
  | 'lich-su-dia-li'
  | 'dao-duc'
  | 'tin-hoc'
  | 'cong-nghe'
  | 'mi-thuat'
  | 'am-nhac'
  | 'hdtn'
  | 'gdtc';

export const SUBJECT_OPTIONS: { id: SubjectType; label: string; grades?: string }[] = [
  { id: 'all', label: 'Tất cả môn học' },
  { id: 'toan', label: 'Toán' },
  { id: 'tieng-viet', label: 'Tiếng Việt' },
  { id: 'tieng-anh', label: 'Tiếng Anh' },
  { id: 'tnxh-khoa-hoc', label: 'Tự nhiên & Xã hội / Khoa học' },
  { id: 'lich-su-dia-li', label: 'Lịch sử & Địa lí' },
  { id: 'dao-duc', label: 'Đạo đức' },
  { id: 'tin-hoc', label: 'Tin học' },
  { id: 'cong-nghe', label: 'Công nghệ' },
  { id: 'mi-thuat', label: 'Mĩ thuật' },
  { id: 'am-nhac', label: 'Âm nhạc' },
  { id: 'hdtn', label: 'Hoạt động trải nghiệm' },
  { id: 'gdtc', label: 'Giáo dục thể chất' },
];

export interface ContentItem {
  id: string;
  zone: ZoneType;
  title: string;
  description?: string;
  type: ContentType;
  createdAt: number;
  updatedAt: number;
  order: number;

  // Grade & Subject classifications
  grade?: GradeLevel;
  subject?: SubjectType;

  // App, Game & Simulation HTML embed code
  embedCode?: string;
  instructions?: string;
}

export type UserRole = 'guest' | 'teacher' | 'admin';

export type CreditActionType = 'view' | 'access';

export const INITIAL_FREE_CREDITS = 5;
export const DAILY_FREE_CREDITS = 5;
export const DAILY_FREE_RESET_MS = 24 * 60 * 60 * 1000;
export const CREDIT_COST_VIEW = 1; // Xem nội dung Kho ứng dụng, Học liệu số, Thí nghiệm mô phỏng
export const CREDIT_COST_ACCESS = 2; // Thực hiện truy cập nội dung Học liệu số, Thí nghiệm mô phỏng
export const MIN_CREDIT_COST = CREDIT_COST_VIEW;
export const APP_LAUNCH_CREDIT_COST = CREDIT_COST_VIEW;
export const PROMO_CODE_REGEX = /^[A-Z0-9_-]{3,64}$/;

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  photoURL?: string;
  school?: string;
  role: 'admin' | 'teacher';
  status: 'active' | 'blocked';
  credits: number;
  lastFreeResetAt?: number;
  lastRedeemedCode?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface PromoCode {
  code: string;
  credit_value: number;
  is_used: boolean;
  used_by: string | null;
  used_at?: number | null;
  created_by: string;
  created_at: number;
}

export interface SiteBranding {
  homeAvatar?: string;
  appsAvatar?: string;
  gamesAvatar?: string;
  simsAvatar?: string;
}
