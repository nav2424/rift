export type NavItem = {
  href: string
  label: string
  icon?: string
}

const BRAND_REQUESTS: NavItem = {
  href: '/brand/requests',
  label: 'Requests',
}

const BRAND_NEW: NavItem = {
  href: '/brand/new',
  label: 'New request',
}

const ACCOUNT: NavItem = {
  href: '/account',
  label: 'Account',
  icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
}

const ADMIN_DASHBOARD: NavItem = { href: '/admin', label: 'Dashboard' }
const ADMIN_REQUESTS: NavItem = { href: '/admin/requests', label: 'Requests' }
const ADMIN_BRANDS: NavItem = { href: '/admin/brands', label: 'Brands' }

/** Primary app navigation — legacy escrow/creator routes intentionally excluded. */
export function getAppNavItems(platformRole: string | null): NavItem[] {
  if (platformRole === 'BRAND') {
    return [BRAND_REQUESTS, BRAND_NEW, ACCOUNT]
  }
  return [ACCOUNT]
}

export function getAdminNavItems(): NavItem[] {
  return [ADMIN_DASHBOARD, ADMIN_REQUESTS, ADMIN_BRANDS]
}

export function getBrandNavItems(): NavItem[] {
  return [BRAND_REQUESTS, BRAND_NEW]
}

/** Primary CTA href for dashboard header by role */
export function getPrimaryActionHref(platformRole: string | null, userRole?: string | null): string | null {
  if (userRole === 'ADMIN') return '/admin/requests'
  if (platformRole === 'BRAND') return '/brand/new'
  return null
}

export function getPrimaryActionLabel(platformRole: string | null, userRole?: string | null): string {
  if (userRole === 'ADMIN') return 'View requests'
  if (platformRole === 'BRAND') return 'New request'
  return 'Get Started'
}
