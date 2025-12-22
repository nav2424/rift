import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative border-t border-white/8 bg-black">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-10">
          <div>
            <h3 className="text-lg font-medium text-white mb-3">Rift</h3>
            <p className="text-white/50 text-sm leading-relaxed font-light">
              Secure buyer protection for marketplace transactions.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-white/70 mb-4 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/pricing" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Legal
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-white/70 mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Careers
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-white/70 mb-4 uppercase tracking-wider">Support</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
                  Status
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-white/8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/50 text-sm font-light">
            © {new Date().getFullYear()} Rift. All rights reserved.
          </p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
              Privacy
            </a>
            <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
              Terms
            </a>
            <a href="#" className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-light">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
