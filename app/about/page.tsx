import GlassCard from '@/components/ui/GlassCard'

export default function About() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-black pt-4 pb-32">
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-light text-white mb-4 tracking-tight">
            About Rift
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto font-light">
            Building trust in every transaction
          </p>
        </div>

        <div className="space-y-8">
          {/* Our Mission */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-white">Our Mission</h2>
              </div>
              <p className="text-white/80 leading-relaxed font-light mb-4 text-lg">
                Rift was created to solve a simple but critical problem: marketplace transactions lack trust and protection. 
                Too many people have lost money to scams, fraud, or dishonest sellers when buying and selling online.
              </p>
              <p className="text-white/80 leading-relaxed font-light text-lg">
                We provide a secure platform that holds funds until both parties are satisfied, giving buyers the confidence 
                to make purchases and sellers the assurance they'll get paid fairly.
              </p>
            </div>
          </GlassCard>

          {/* What We Do */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-white">What We Do</h2>
              </div>
              <p className="text-white/80 leading-relaxed font-light mb-4 text-lg">
                Rift is a transaction facilitation platform that helps buyers and sellers complete transactions safely. 
                We provide payment flow structure, secure communication channels, and conditional fund release mechanisms.
              </p>
              <p className="text-white/80 leading-relaxed font-light mb-6 text-lg">
                We're not a marketplace, bank, or payment provider. Instead, we act as a trusted intermediary that ensures 
                transactions proceed smoothly and fairly for both parties.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-8">
                {[
                  { icon: '🔒', text: 'Secure payment processing through industry-leading providers' },
                  { icon: '💬', text: 'Protected communication channels for transaction coordination' },
                  { icon: '⚖️', text: 'Fair dispute resolution when issues arise' },
                  { icon: '💳', text: 'Transparent fee structure with no hidden costs' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="text-2xl flex-shrink-0">{item.icon}</span>
                    <span className="text-white/80 font-light leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Our Values */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-white">Our Values</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    title: 'Trust',
                    description: 'We believe that secure, protected transactions should be accessible to everyone, not just large corporations.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    )
                  },
                  {
                    title: 'Transparency',
                    description: 'No hidden fees, no surprises. What you see is what you get, and all fees are clearly disclosed upfront.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )
                  },
                  {
                    title: 'Fairness',
                    description: 'We work to ensure both buyers and sellers are treated fairly, with clear processes and impartial dispute resolution.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )
                  },
                  {
                    title: 'Security',
                    description: 'Your financial information is never stored on our servers. All payments are processed through secure, PCI-compliant payment processors.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )
                  }
                ].map((value, idx) => (
                  <div key={idx} className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group/item">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-white/80 group-hover/item:text-white transition-colors">
                        {value.icon}
                      </div>
                      <h3 className="text-xl font-light text-white/90">{value.title}</h3>
                    </div>
                    <p className="text-white/70 leading-relaxed font-light">
                      {value.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Get in Touch */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-white">Get in Touch</h2>
              </div>
              <p className="text-white/80 leading-relaxed font-light mb-4 text-lg">
                Have questions or feedback? We'd love to hear from you.
              </p>
              <a 
                href="mailto:support@joinrift.co" 
                className="inline-flex items-center gap-2 text-white hover:text-cyan-400 transition-colors font-light text-lg group/link"
              >
                <span>support@joinrift.co</span>
                <svg className="w-5 h-5 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
