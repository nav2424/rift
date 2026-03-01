'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import GlassCard from './ui/GlassCard'

// Icon components
const ChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const TrendingIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

const PackageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const ScaleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
)

const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

function getIconComponent(iconName: string): ComponentType<{ className?: string }> {
  const icons: Record<string, ComponentType<{ className?: string }>> = {
    chart: ChartIcon,
    bell: BellIcon,
    trending: TrendingIcon,
    zap: ZapIcon,
    lock: LockIcon,
    package: PackageIcon,
    scale: ScaleIcon,
    file: FileIcon,
    check: CheckIcon,
  }
  return icons[iconName] || ChartIcon
}

export default function ProductDemo() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transaction' | 'dispute'>('dashboard')
  const [isAnimating, setIsAnimating] = useState(false)

  const handleTabChange = (tab: 'dashboard' | 'transaction' | 'dispute') => {
    setIsAnimating(true)
    setActiveTab(tab)
    setTimeout(() => setIsAnimating(false), 300)
  }

  const demos = {
    dashboard: {
      title: 'Dashboard Overview',
      description: 'Real-time tracking of all your creator-brand deals with clear analytics',
      features: [
        { icon: 'chart', text: 'Live transaction status' },
        { icon: 'bell', text: 'Instant notifications' },
        { icon: 'trending', text: 'Analytics & insights' },
      ],
      mockup: (
        <div className="space-y-5">
          {/* Header with search */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-10 bg-gray-100 rounded-lg border border-gray-300 flex items-center px-4 backdrop-blur-sm">
              <svg className="w-4 h-4 text-[#86868b] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div className="flex-1 h-2 bg-gray-100 rounded" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center backdrop-blur-sm">
              <div className="w-6 h-6 rounded-full bg-white/20" />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Open', value: '12', color: 'bg-white/15' },
              { label: 'Disputed', value: '2', color: 'bg-gray-100' },
              { label: 'Released', value: '48', color: 'bg-white/15' },
            ].map((stat, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl border border-gray-300 p-4 flex flex-col justify-between backdrop-blur-sm">
                <div className="h-2.5 bg-white/15 rounded w-16" />
                <div className="flex items-baseline gap-2">
                  <div className={`h-8 ${stat.color} rounded w-12`} />
                  <div className="h-2 bg-gray-100 rounded w-8" />
                </div>
              </div>
            ))}
          </div>

          {/* Transaction List */}
          <div className="space-y-2">
            {[
              { title: 'UGC Video Bundle', amount: '$1,200', status: 'In Review', progress: 75 },
              { title: 'Instagram Reels', amount: '$2,400', status: 'Awaiting Upload', progress: 50 },
              { title: 'Brand Deal Retainer', amount: '$3,000', status: 'Completed', progress: 100 },
            ].map((item, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl border border-gray-300 p-4 flex items-center justify-between group hover:bg-white/[0.12] transition-colors backdrop-blur-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-300" />
                    <div className="flex-1">
                      <div className="h-3 bg-white/25 rounded w-32 mb-1.5" />
                      <div className="h-2 bg-gray-100 rounded w-20" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-1.5 bg-white/15 rounded-full flex-1 max-w-24">
                      <div className="h-full bg-white/40 rounded-full" style={{ width: `${item.progress}%` }} />
                    </div>
                    <div className="h-2 bg-gray-100 rounded w-16" />
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="h-4 bg-white/25 rounded w-20 mb-1" />
                  <div className="h-2.5 bg-gray-100 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    transaction: {
      title: 'Deal Flow',
      description: 'Seamless Rift creation and management for creator-brand deals',
      features: [
        { icon: 'zap', text: 'One-click creation' },
        { icon: 'lock', text: 'Secure payment protection' },
        { icon: 'package', text: 'Deliverable tracking' },
      ],
      mockup: (
        <div className="space-y-5">
          {/* Form Header */}
          <div className="h-12 bg-gray-100 rounded-xl border border-gray-300 flex items-center px-4 backdrop-blur-sm">
            <div className="h-3 bg-white/25 rounded w-40" />
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="h-14 bg-gray-100 rounded-xl border border-gray-300 p-4 backdrop-blur-sm">
              <div className="h-2 bg-white/15 rounded w-24 mb-2" />
              <div className="h-4 bg-white/15 rounded w-full" />
            </div>
            <div className="h-14 bg-gray-100 rounded-xl border border-gray-300 p-4 backdrop-blur-sm">
              <div className="h-2 bg-white/15 rounded w-32 mb-2" />
              <div className="h-4 bg-white/15 rounded w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-14 bg-gray-100 rounded-xl border border-gray-300 p-4 backdrop-blur-sm">
                <div className="h-2 bg-white/15 rounded w-20 mb-2" />
                <div className="h-4 bg-white/15 rounded w-full" />
              </div>
              <div className="h-14 bg-gray-100 rounded-xl border border-gray-300 p-4 backdrop-blur-sm">
                <div className="h-2 bg-white/15 rounded w-16 mb-2" />
                <div className="h-4 bg-white/15 rounded w-full" />
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between py-4">
            {[
              { active: true, label: 'Create' },
              { active: true, label: 'Fund' },
              { active: false, label: 'Deliver' },
              { active: false, label: 'Complete' },
            ].map((step, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center backdrop-blur-sm ${
                  step.active ? 'bg-white/15 border-white/40' : 'bg-gray-100 border-gray-300'
                }`}>
                  {step.active && <div className="w-2 h-2 rounded-full bg-white/70" />}
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step.active ? 'bg-white/30' : 'bg-gray-100'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Action Button */}
          <div className="h-12 bg-white/[0.12] rounded-xl border border-gray-300 flex items-center justify-center backdrop-blur-sm">
            <div className="h-4 bg-white/40 rounded w-32" />
          </div>
        </div>
      ),
    },
    dispute: {
      title: 'Dispute Resolution',
      description: 'Fair and transparent dispute handling with expert review',
      features: [
        { icon: 'scale', text: 'Expert review' },
        { icon: 'file', text: 'Evidence submission' },
        { icon: 'check', text: 'Fast resolution' },
      ],
      mockup: (
        <div className="space-y-5">
          {/* Dispute Header */}
          <div className="h-16 bg-gray-100 rounded-xl border border-gray-300 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 bg-white/25 rounded w-32" />
              <div className="h-5 bg-white/15 rounded w-16" />
            </div>
            <div className="h-2 bg-gray-100 rounded w-full" />
          </div>

          {/* Evidence Cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Buyer Evidence', items: 3 },
              { title: 'Seller Evidence', items: 2 },
            ].map((side, i) => (
              <div key={i} className="bg-gray-100 rounded-xl border border-gray-300 p-4 backdrop-blur-sm">
                <div className="h-3 bg-white/25 rounded w-28 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: side.items }).map((_, j) => (
                    <div key={j} className="h-12 bg-gray-100 rounded-lg border border-gray-300 p-2 flex items-center gap-2 backdrop-blur-sm">
                      <div className="w-8 h-8 rounded bg-white/15" />
                      <div className="flex-1">
                        <div className="h-2 bg-white/15 rounded w-24 mb-1" />
                        <div className="h-1.5 bg-gray-100 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="h-2 bg-gray-100 rounded w-20 mb-2" />
            {[
              { time: '2h ago', action: 'Dispute raised' },
              { time: '1h ago', action: 'Evidence submitted' },
              { time: 'Now', action: 'Under review' },
            ].map((event, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-white/40 mt-1.5" />
                <div className="flex-1">
                  <div className="h-2.5 bg-white/15 rounded w-32 mb-1" />
                  <div className="h-2 bg-gray-100 rounded w-24" />
                </div>
                <div className="h-2 bg-gray-100 rounded w-12" />
              </div>
            ))}
          </div>

          {/* Resolution Actions */}
          <div className="flex gap-3">
            <div className="flex-1 h-12 bg-white/[0.12] rounded-xl border border-gray-300 flex items-center justify-center backdrop-blur-sm">
              <div className="h-3 bg-white/40 rounded w-24" />
            </div>
            <div className="flex-1 h-12 bg-gray-100 rounded-xl border border-gray-300 flex items-center justify-center backdrop-blur-sm">
              <div className="h-3 bg-white/15 rounded w-20" />
            </div>
          </div>
        </div>
      ),
    },
  }

  return (
    <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 z-10" style={{ minHeight: '600px' }}>
      <div className="text-center mb-16">
        <div className="inline-block mb-6">
          <span className="glass px-5 py-2 rounded-full text-xs text-gray-600 font-medium uppercase tracking-wider">
            Product Demo
          </span>
        </div>
        <h2 className="text-4xl md:text-5xl font-medium text-[#1d1d1f] mb-4 tracking-tight">
          See It In Action
        </h2>
        <p className="text-lg text-[#86868b] max-w-2xl mx-auto font-light">
          Experience enterprise-grade rift protection
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        {/* Enhanced Demo Preview */}
        <div className="relative w-full min-h-[500px]">
          <GlassCard variant="glass" hover className="p-0 overflow-hidden relative group w-full">
            
            {/* Browser Chrome - Enhanced */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/30" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 h-9 bg-gray-50 rounded-lg border border-gray-200 ml-4 flex items-center px-4">
                  <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <div className="flex-1 h-2 bg-gray-50 rounded" />
                  <div className="w-4 h-4 rounded bg-gray-100 ml-2" />
                </div>
                <div className="flex gap-2 ml-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200" />
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200" />
                </div>
              </div>
            </div>

            {/* Demo Content with Animation */}
            <div className={`p-8 transition-all duration-500 ease-out ${isAnimating ? 'opacity-0 scale-[0.98] translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`} style={{ minHeight: '400px' }}>
              {demos[activeTab].mockup}
            </div>
          </GlassCard>

          {/* Floating Badge */}
          <div className="absolute -top-4 -right-4 glass px-4 py-2 rounded-full text-xs text-gray-600 font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            Live Preview
          </div>
        </div>

        {/* Enhanced Demo Controls */}
        <div className="space-y-6 w-full">
          <div>
            <h3 className="text-2xl font-medium text-[#1d1d1f] mb-3">{demos[activeTab].title}</h3>
            <p className="text-[#86868b] font-light leading-relaxed mb-6 text-sm">
              {demos[activeTab].description}
            </p>
          </div>

          {/* Enhanced Tab Selector */}
          <GlassCard variant="glass" className="p-2">
            <div className="flex gap-2">
              {(['dashboard', 'transaction', 'dispute'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden ${
                    activeTab === tab
                      ? 'bg-white text-black'
                      : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-gray-50'
                  }`}
                >
                  <span className="relative z-10">
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Enhanced Features */}
          <GlassCard variant="glass" hover className="p-6">
            <div className="space-y-4">
              {demos[activeTab].features.map((feature, index) => {
                const IconComponent = getIconComponent(feature.icon);
                return (
                  <div key={index} className="flex items-center gap-4 group/item">
                    <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center group-hover/item:bg-gray-100 transition-all duration-300">
                      <IconComponent className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#1d1d1f] font-light text-sm">{feature.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Enhanced Key Benefits */}
          <div className="space-y-4">
            <GlassCard variant="glass" hover className="p-6 relative group">
              <div className="relative z-10 flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-100 transition-all duration-300">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-medium text-[#1d1d1f] mb-1">Instant Protection</h4>
                  <p className="text-[#86868b] font-light text-sm leading-relaxed">Your funds are secured the moment you create a rift</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard variant="glass" hover className="p-6 relative group">
              <div className="relative z-10 flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-100 transition-all duration-300">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-medium text-[#1d1d1f] mb-1">Lightning Fast</h4>
                  <p className="text-[#86868b] font-light text-sm leading-relaxed">Complete transactions in minutes, not days</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard variant="glass" hover className="p-6 relative group">
              <div className="relative z-10 flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-100 transition-all duration-300">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-medium text-[#1d1d1f] mb-1">Transparent Pricing</h4>
                  <p className="text-[#86868b] font-light text-sm leading-relaxed">Buyers pay 0%. Sellers pay 8%. Simple and transparent.</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  )
}
