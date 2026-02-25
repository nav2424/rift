'use client'

import { useState } from 'react'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'

export type ItemType = 'SERVICES' | 'DIGITAL_GOODS'

interface ItemTypeSelectionProps {
  onSelect: (type: ItemType) => void
  role: 'BUYER' | 'SELLER'
}

const itemTypes = [
  {
    type: 'SERVICES' as ItemType,
    title: 'UGC Brand Deal',
    description: 'Escrow for UGC-only brand deals with milestones, approvals, and contract-style terms.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    features: ['UGC contract builder', 'Milestone-based escrow', 'On-platform delivery & dispute flow'],
  },
  {
    type: 'DIGITAL_GOODS' as ItemType,
    title: 'Content Deliverables',
    description: 'Video files, images, creative assets, and digital content with secure delivery',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    features: ['Secure file delivery', 'Brand approval before release', 'High-quality asset storage'],
  },
]

export default function ItemTypeSelection({ onSelect, role }: ItemTypeSelectionProps) {
  const [selectedType, setSelectedType] = useState<ItemType | null>(null)
  const isBuying = role === 'BUYER'
  const actionVerb = isBuying ? 'buying' : 'selling'

  return (
    <div className="space-y-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-light text-white mb-4">What type of {isBuying ? 'project' : 'work'} is this?</h2>
        <p className="text-lg text-white/60 font-light max-w-xl mx-auto mb-2">Select the deliverable type to customize the payment workflow</p>
        <p className="text-sm text-white/50 font-light max-w-xl mx-auto">Funds are secured upfront and released when content is approved.</p>
      </div>

      <div className="space-y-6">
        {/* Items in a 2-column grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {itemTypes.map((item) => (
            <button
              key={item.type}
              onClick={() => setSelectedType(item.type)}
              className={`text-left transition-all duration-300 group ${
                selectedType === item.type
                  ? 'scale-[1.02]'
                  : 'hover:scale-[1.01]'
              }`}
            >
              <GlassCard
                variant="glass"
                hover
                className={`p-8 cursor-pointer border-2 transition-all h-full ${
                  selectedType === item.type
                    ? 'border-white/30 bg-white/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    selectedType === item.type
                      ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 text-blue-400'
                      : 'bg-white/5 border border-white/10 text-white/60 group-hover:bg-white/10 group-hover:text-white/80'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-light text-white mb-3">{item.title}</h3>
                    <p className="text-white/70 text-sm font-light mb-6 leading-relaxed">{item.description}</p>
                    <ul className="space-y-2.5">
                      {item.features.map((feature, idx) => (
                        <li key={idx} className="text-white/60 text-sm font-light flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            selectedType === item.type ? 'bg-blue-400' : 'bg-white/40'
                          }`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selectedType === item.type && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-2 border-blue-400/50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      </div>

      {selectedType && (
        <div className="flex justify-center pt-6">
          <button
            onClick={() => onSelect(selectedType)}
            className="min-w-[260px] px-12 py-4 group relative overflow-hidden backdrop-blur-xl bg-white/[0.06] border border-white/20 hover:border-white/30 hover:bg-white/10 transition-all duration-300 shadow-lg shadow-black/20 rounded-lg text-white font-light text-base focus:outline-none focus:ring-2 focus:ring-white/20 active:scale-[0.98]"
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <span className="flex items-center justify-center gap-3 relative z-10">
              <span>Continue</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none" />
          </button>
        </div>
      )}
    </div>
  )
}
