'use client'

import { useState } from 'react'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'

export type ItemType = 'SERVICES' | 'OWNERSHIP_TRANSFER' | 'DIGITAL_GOODS'

interface ItemTypeSelectionProps {
  onSelect: (type: ItemType) => void
  role: 'BUYER' | 'SELLER'
}

const itemTypes = [
  {
    type: 'SERVICES' as ItemType,
    title: 'Service',
    description: 'Consulting, freelance work, professional services',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    features: ['Milestone-based release', 'Delivery confirmation', 'Dispute protection built-in']
  },
  {
    type: 'OWNERSHIP_TRANSFER' as ItemType,
    title: 'Ownership Transfer',
    description: 'Assets that require verified transfer',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    features: ['Ownership change confirmation', 'Released only after transfer', 'Best for high-value deals']
  },
  {
    type: 'DIGITAL_GOODS' as ItemType,
    title: 'Digital Goods',
    description: 'Software, licenses, downloads, and digital assets',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    features: ['Secure file or key delivery', 'Buyer verification before release', 'Instant or scheduled delivery']
  }
]

export default function ItemTypeSelection({ onSelect, role }: ItemTypeSelectionProps) {
  const [selectedType, setSelectedType] = useState<ItemType | null>(null)
  const isBuying = role === 'BUYER'
  const actionVerb = isBuying ? 'buying' : 'selling'

  return (
    <div className="space-y-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-light text-white mb-4">What are you {actionVerb}?</h2>
        <p className="text-lg text-white/60 font-light max-w-xl mx-auto mb-2">Select the type of item to customize the rift process</p>
        <p className="text-sm text-white/50 font-light max-w-xl mx-auto">Funds are released only when delivery is confirmed.</p>
      </div>

      <div className="space-y-6">
        {/* First two items in a 2-column grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {itemTypes.slice(0, 2).map((item) => (
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

        {/* Third item in a single column (centered) */}
        <div className="flex justify-center">
          <div className="w-full md:max-w-[calc(50%-12px)]">
            {itemTypes.slice(2).map((item) => (
              <button
                key={item.type}
                onClick={() => setSelectedType(item.type)}
                className={`text-left transition-all duration-300 group w-full ${
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
