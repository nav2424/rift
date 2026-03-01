import GlassCard from '@/components/ui/GlassCard'

export default function Careers() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-white pt-4 pb-32">
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-light text-[#1d1d1f] mb-4 tracking-tight">
            Careers
          </h1>
          <p className="text-xl text-[#86868b] max-w-2xl mx-auto font-light">
            Join us in building the future of secure transactions
          </p>
        </div>

        <div className="space-y-8">
          {/* Work at Rift */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-[#1d1d1f]">Work at Rift</h2>
              </div>
              <p className="text-gray-700 leading-relaxed font-light mb-4 text-lg">
                We're building a platform that makes online transactions safer and more trustworthy for everyone. 
                If you're passionate about solving real problems and creating products that matter, we'd love to hear from you.
              </p>
              <p className="text-gray-700 leading-relaxed font-light text-lg">
                While we don't have any open positions listed at the moment, we're always interested in connecting 
                with talented individuals who share our vision.
              </p>
            </div>
          </GlassCard>

          {/* Open Positions */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-[#1d1d1f]">Open Positions</h2>
              </div>
              <p className="text-gray-700 leading-relaxed font-light mb-6 text-lg">
                We're currently not hiring for any specific roles, but that could change quickly as we grow.
              </p>
              <p className="text-gray-700 leading-relaxed font-light mb-8 text-lg">
                If you're interested in working with us, please reach out even if there's no specific role listed. 
                We're particularly interested in:
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: '💻', text: 'Full-stack engineers with experience in Next.js, TypeScript, and PostgreSQL' },
                  { icon: '🎨', text: 'Product designers focused on user experience and security' },
                  { icon: '🔒', text: 'Security and compliance specialists' },
                  { icon: '💬', text: 'Customer support and operations team members' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
                    <span className="text-2xl flex-shrink-0">{item.icon}</span>
                    <span className="text-gray-700 font-light leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* How to Apply */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-[#1d1d1f]">How to Apply</h2>
              </div>
              <p className="text-gray-700 leading-relaxed font-light mb-6 text-lg">
                Interested in joining the Rift team? Send us an email with:
              </p>
              <div className="space-y-3 mb-8">
                {[
                  'Your resume or LinkedIn profile',
                  'A brief note about why you\'re interested in Rift',
                  'Any relevant portfolio or work samples (if applicable)'
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-400 text-sm font-medium">{idx + 1}</span>
                    </div>
                    <span className="text-gray-700 font-light leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
              <a 
                href="mailto:support@joinrift.co" 
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20 text-[#1d1d1f] hover:border-green-500/40 hover:from-green-500/20 hover:to-green-500/10 transition-all font-light text-lg group/link"
              >
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>support@joinrift.co</span>
                <svg className="w-5 h-5 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </GlassCard>

          {/* What We Offer */}
          <GlassCard variant="liquid" className="p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-[#1d1d1f]">What We Offer</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    title: 'Meaningful Work',
                    description: 'Solve real problems that impact thousands of users and help make online transactions safer.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )
                  },
                  {
                    title: 'Flexible Environment',
                    description: 'Remote-first culture with flexible hours and the autonomy to do your best work.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )
                  },
                  {
                    title: 'Growth Opportunity',
                    description: 'Join an early-stage company where you can have a significant impact and grow with the team.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    )
                  },
                  {
                    title: 'Competitive Compensation',
                    description: 'Fair pay, equity participation, and benefits package for full-time employees.',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )
                  }
                ].map((benefit, idx) => (
                  <div key={idx} className="p-6 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all group/item">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-gray-300 flex items-center justify-center text-gray-700 group-hover/item:text-[#1d1d1f] transition-colors">
                        {benefit.icon}
                      </div>
                      <h3 className="text-xl font-light text-gray-800">{benefit.title}</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed font-light">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
