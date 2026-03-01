'use client'

import GlassCard from './ui/GlassCard'

interface FeeBreakdownProps {
  subtotal: number
  buyerFee: number
  sellerFee: number
  sellerNet: number
  currency: string
  showBuyer?: boolean
  showSeller?: boolean
}

export default function FeeBreakdown({
  subtotal,
  buyerFee,
  sellerFee,
  sellerNet,
  currency,
  showBuyer = true,
  showSeller = true,
}: FeeBreakdownProps) {
  const buyerTotal = subtotal + buyerFee

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-light text-[#1d1d1f] mb-6">Fee Breakdown</h3>
      
      <div className="space-y-6">
        {showBuyer && (
          <div className="pb-6 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h4 className="text-base font-light text-[#1d1d1f]">Buyer Pays</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-light text-sm">Listed Price</span>
                <span className="text-[#1d1d1f] font-light">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#86868b] font-light text-sm">Processing Fee (3%)</span>
                <span className="text-gray-600 font-light">+{formatCurrency(buyerFee)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-[#1d1d1f] font-light">Total</span>
                <span className="text-green-400 font-light text-xl">{formatCurrency(buyerTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {showSeller && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-base font-light text-[#1d1d1f]">Seller Receives</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-light text-sm">Transaction Amount</span>
                <span className="text-[#1d1d1f] font-light">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#86868b] font-light text-sm">Platform Fee (5%)</span>
                <span className="text-gray-600 font-light">-{formatCurrency(sellerFee)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-[#1d1d1f] font-light">Net Amount</span>
                <span className="text-green-400 font-light text-xl">{formatCurrency(sellerNet)}</span>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-green-400/90 font-light text-sm text-center">
                You keep <strong className="font-normal">95%</strong> of the transaction
              </p>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
