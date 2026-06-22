import BrandRouteGuard from '@/components/requests/BrandRouteGuard'

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <BrandRouteGuard>{children}</BrandRouteGuard>
}
