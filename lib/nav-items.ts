export type NavItem = {
  href: string
  label: string
  icon?: string
}

const DASHBOARD: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
}

const MESSAGES: NavItem = {
  href: '/messages',
  label: 'Messages',
  icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
}

const ACCOUNT: NavItem = {
  href: '/account',
  label: 'Account',
  icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
}

const BRAND_CAMPAIGNS: NavItem = {
  href: '/brand/campaigns',
  label: 'Campaigns',
  icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5z',
}

const CREATOR_ASSIGNMENTS: NavItem = {
  href: '/creator/assignments',
  label: 'Assignments',
  icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
}

const ADMIN_HOME: NavItem = { href: '/admin', label: 'Admin' }
const ADMIN_CAMPAIGNS: NavItem = { href: '/admin/campaigns', label: 'Campaigns' }
const ADMIN_SUPPORT: NavItem = { href: '/admin/support', label: 'Support' }

/** Primary app navigation — legacy escrow routes intentionally excluded. */
export function getAppNavItems(platformRole: string | null): NavItem[] {
  if (platformRole === 'BRAND') {
    return [DASHBOARD, BRAND_CAMPAIGNS, MESSAGES, ACCOUNT]
  }
  if (platformRole === 'CREATOR') {
    return [DASHBOARD, CREATOR_ASSIGNMENTS, MESSAGES, ACCOUNT]
  }
  return [DASHBOARD, MESSAGES, ACCOUNT]
}

export function getAdminNavItems(): NavItem[] {
  return [ADMIN_HOME, ADMIN_CAMPAIGNS, ADMIN_SUPPORT]
}

/** Primary CTA href for dashboard header by role */
export function getPrimaryActionHref(platformRole: string | null): string | null {
  if (platformRole === 'BRAND') return '/brand/campaigns'
  if (platformRole === 'CREATOR') return '/creator/assignments'
  return null
}

export function getPrimaryActionLabel(platformRole: string | null): string {
  if (platformRole === 'BRAND') return 'New Campaign'
  if (platformRole === 'CREATOR') return 'My Assignments'
  return 'Get Started'
}
