/**
 * Fee calculation and management
 * Handles platform fees and payment processing fee accounting
 * 
 * Rift Platform Fee Strategy (FINALIZED):
 * - Buyer Fee: 0% (buyer pays listed price only)
 * - Total Fee: 8% (platform fee + Stripe fees combined, paid by seller)
 * - Platform Fee: ~5.1% (calculated as 8% total minus Stripe fees)
 * - Stripe Fee: 2.9% + $0.30 (passed to seller, included in 8% total)
 */

// Total fee percentage (8% - includes platform fee + Stripe fees, paid by seller)
export const TOTAL_FEE_PERCENTAGE = 0.08

// Buyer fee percentage (0% - no buyer fees)
export const BUYER_FEE_PERCENTAGE = 0

// Payment processing fees (Stripe fees - included in the 8% total)
export const PAYMENT_PROCESSING_FEE_PERCENTAGE = 0.029 // 2.9%
export const PAYMENT_PROCESSING_FIXED_FEE = 0.30 // $0.30 (in dollars/cents depending on currency)

/**
 * Calculate the platform fee amount
 * Platform fee = Total fee (8%) - Stripe fees
 * This ensures the total fee (platform + Stripe) equals 8% of the transaction
 * 
 * @param amount - The original escrow amount (what buyer pays)
 * @returns The platform fee amount (8% total minus Stripe fees)
 */
export function calculatePlatformFee(amount: number): number {
  // Total fee = 8% of original amount
  const totalFee = amount * TOTAL_FEE_PERCENTAGE
  
  // Calculate Stripe fees
  const processingFees = calculatePaymentProcessingFees(amount)
  
  // Platform fee = Total fee - Stripe fees
  // This ensures total deduction is exactly 8%
  const platformFee = totalFee - processingFees.totalFee
  
  // Ensure platform fee is never negative (in case transaction is very small)
  return Math.max(0, platformFee)
}

/**
 * Calculate the seller payout amount
 * Seller receives: original amount - total fee (8%)
 * 
 * @param amount - The escrow amount (original payment amount that buyer pays)
 * @returns The amount to pay to the seller (after 8% total fee)
 */
export function calculateSellerPayout(amount: number): number {
  // Total fee = 8% of original amount (includes platform fee + Stripe fees)
  const totalFee = amount * TOTAL_FEE_PERCENTAGE
  
  // Seller receives: original amount - total fee (8%)
  return amount - totalFee
}

/**
 * Calculate payment processing fees (Stripe fees - included in 8% total)
 * Note: Payment processing fees are automatically deducted from payments by Stripe
 * These fees are part of the 8% total fee paid by the seller
 * 
 * @param amount - The payment amount (original escrow amount)
 * @returns Object with payment processing fee breakdown
 */
export function calculatePaymentProcessingFees(amount: number): {
  percentageFee: number
  fixedFee: number
  totalFee: number
  netAmount: number
} {
  const percentageFee = amount * PAYMENT_PROCESSING_FEE_PERCENTAGE
  const fixedFee = PAYMENT_PROCESSING_FIXED_FEE
  const totalFee = percentageFee + fixedFee
  const netAmount = amount - totalFee

  return {
    percentageFee,
    fixedFee,
    totalFee,
    netAmount,
  }
}

/**
 * Get fee breakdown for an escrow transaction
 * Shows complete fee structure: buyer pays listed price, seller pays 8% total fee
 * 
 * @param amount - The escrow amount (original payment amount that buyer pays)
 * @returns Complete fee breakdown
 */
export function getFeeBreakdown(amount: number): {
  escrowAmount: number
  buyerPays: number
  platformFee: number
  paymentProcessingFees: {
    percentageFee: number
    fixedFee: number
    totalFee: number
  }
  sellerReceives: number
  platformReceives: number
  netAmount: number
  totalSellerDeduction: number
} {
  // Buyer pays the listed price (0% fee)
  const buyerPays = amount
  
  // Calculate Stripe payment processing fees
  const processingFees = calculatePaymentProcessingFees(amount)
  
  // Total fee = 8% of original amount (platform fee + Stripe fees combined)
  const totalFee = amount * TOTAL_FEE_PERCENTAGE
  
  // Platform fee = Total fee - Stripe fees
  const platformFee = calculatePlatformFee(amount)
  
  // Seller receives: original amount - total fee (8%)
  const sellerReceives = calculateSellerPayout(amount)
  
  // Platform receives: platform fee portion of the 8% total
  const platformReceives = platformFee
  
  // Amount platform actually receives after Stripe fees
  const netAmountAfterStripe = processingFees.netAmount

  return {
    escrowAmount: amount,
    buyerPays,
    platformFee,
    paymentProcessingFees: {
      percentageFee: processingFees.percentageFee,
      fixedFee: processingFees.fixedFee,
      totalFee: processingFees.totalFee,
    },
    sellerReceives,
    platformReceives,
    netAmount: netAmountAfterStripe, // Amount platform actually received after payment processing fees
    totalSellerDeduction: totalFee, // Total fee is 8%
  }
}

/**
 * Round to 2 decimal places (for currency calculations)
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}
