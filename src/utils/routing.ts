import { ContentItem, ZoneType } from '../types';

export interface ZoneRouteMeta {
  zone: ZoneType;
  slug: string;
  sectionId: string;
  label: string;
}

export const ZONE_ROUTES: Record<ZoneType, ZoneRouteMeta> = {
  apps: {
    zone: 'apps',
    slug: 'kho-ung-dung',
    sectionId: 'kho-ung-dung',
    label: 'Kho Ứng Dụng',
  },
  games: {
    zone: 'games',
    slug: 'hoc-lieu-so',
    sectionId: 'tro-choi-tuong-tac',
    label: 'Học Liệu Số',
  },
  simulations: {
    zone: 'simulations',
    slug: 'thi-nghiem-mo-phong',
    sectionId: 'thi-nghiem-mo-phong',
    label: 'Thí Nghiệm Mô Phỏng',
  },
};

export function slugifyVietnamese(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function getZoneFromSectionId(sectionId: string): ZoneType | null {
  if (sectionId === 'kho-ung-dung') return 'apps';
  if (sectionId === 'tro-choi-tuong-tac' || sectionId === 'hoc-lieu-so') return 'games';
  if (sectionId === 'thi-nghiem-mo-phong') return 'simulations';
  return null;
}

export function buildHomePath(): string {
  return '/';
}

export function buildZonePath(zone: ZoneType): string {
  return `/${ZONE_ROUTES[zone].slug}`;
}

export function buildItemPath(item: ContentItem): string {
  const zoneSlug = ZONE_ROUTES[item.zone]?.slug || 'kho-ung-dung';
  const titleSlug = slugifyVietnamese(item.title);
  return titleSlug
    ? `/${zoneSlug}/${titleSlug}--${item.id}`
    : `/${zoneSlug}/${item.id}`;
}

export interface ParsedRoute {
  type: 'home' | 'zone' | 'item';
  zone?: ZoneType;
  itemSlugOrId?: string;
}

export function parsePathname(pathname: string): ParsedRoute {
  const cleaned = (pathname || '/').replace(/^\/+|\/+$/g, '');
  if (!cleaned) {
    return { type: 'home' };
  }

  const parts = cleaned.split('/').filter(Boolean);
  const firstSegment = decodeURIComponent(parts[0] || '').toLowerCase();

  let matchedZone: ZoneType | undefined;
  if (firstSegment === 'kho-ung-dung' || firstSegment === 'apps') {
    matchedZone = 'apps';
  } else if (
    firstSegment === 'hoc-lieu-so' ||
    firstSegment === 'tro-choi-tuong-tac' ||
    firstSegment === 'games'
  ) {
    matchedZone = 'games';
  } else if (firstSegment === 'thi-nghiem-mo-phong' || firstSegment === 'simulations') {
    matchedZone = 'simulations';
  }

  if (!matchedZone) {
    return { type: 'home' };
  }

  if (parts.length >= 2 && parts[1]) {
    const rawSegment = decodeURIComponent(parts[1]);
    return {
      type: 'item',
      zone: matchedZone,
      itemSlugOrId: rawSegment,
    };
  }

  return {
    type: 'zone',
    zone: matchedZone,
  };
}

export function findItemByRouteSegment(
  items: ContentItem[],
  segment: string,
  zone?: ZoneType
): ContentItem | null {
  if (!segment) return null;
  const pool = zone ? items.filter((i) => i.zone === zone) : items;

  // Format: "<slug>--<id>"
  const doubleDashIdx = segment.lastIndexOf('--');
  const candidateId = doubleDashIdx >= 0 ? segment.slice(doubleDashIdx + 2) : segment;

  const exactById =
    pool.find((i) => i.id === candidateId) || items.find((i) => i.id === candidateId);
  if (exactById) return exactById;

  const slugLower = segment.toLowerCase();
  return (
    pool.find((i) => slugifyVietnamese(i.title) === slugLower) ||
    items.find((i) => slugifyVietnamese(i.title) === slugLower) ||
    null
  );
}
