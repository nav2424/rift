import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative border-t border-gray-200 bg-[#f5f5f7]">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-10">
          <div>
            <h3 className="text-lg font-medium text-[#1d1d1f] mb-3">Rift</h3>
            <p className="text-[#86868b] text-sm leading-relaxed font-light">
              Secure payment protection for brand deals, UGC content, and influencer partnerships.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-4 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/pricing" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
                  Legal
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/about" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
                  About
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
                  Careers
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-4 uppercase tracking-wider">Support</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/support?type=faq" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/support?type=contact" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center">
          <p className="text-[#86868b] text-sm font-light">
            © {new Date().getFullYear()} Rift. All rights reserved.
          </p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="/legal" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
              Privacy
            </Link>
            <Link href="/legal" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
              Terms
            </Link>
            <Link href="/legal" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 text-sm font-light">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
