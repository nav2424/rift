/**
 * Fee calculation and management
 * Handles platform fees and payment processing fee accounting
 * 
 * Rift Transaction Fee Model:
 * - Buyer Fee: 3% "Payment processing & card network fee"
 * - Seller Fee: 5% "Rift platform fee"
 * - Fees are calculated on the transaction subtotal
 * - Buyer pays: subtotal + buyerFee
 * - Seller receives: subtotal - sellerFee (net amount)
 */

// Buyer fee percentage (3% - payment processing & card network fee)
export const BUYER_FEE_PERCENTAGE = 0.03

// Seller fee percentage (5% - Rift platform fee)
export const SELLER_FEE_PERCENTAGE = 0.05

// Payment processing fees (Stripe fees - separate from buyer fee)
export const PAYMENT_PROCESSING_FEE_PERCENTAGE = 0.029 // 2.9%
export const PAYMENT_PROCESSING_FIXED_FEE = 0.30 // $0.30 (in dollars/cents depending on currency)

/**
 * Calculate buyer fee amount (3%)
 * 
 * @param subtotal - The transaction subtotal
 * @returns The buyer fee amount
 */
export function calculateBuyerFee(subtotal: number): number {
  return roundCurrency(subtotal * BUYER_FEE_PERCENTAGE)
}

/**
 * Calculate seller fee amount (5%)
 * 
 * @param subtotal - The transaction subtotal
 * @returns The seller fee amount
 */
export function calculateSellerFee(subtotal: number): number {
  return roundCurrency(subtotal * SELLER_FEE_PERCENTAGE)
}

/**
 * Calculate seller net amount (subtotal - seller fee)
 * 
 * @param subtotal - The transaction subtotal
 * @returns The amount seller receives (net)
 */
export function calculateSellerNet(subtotal: number): number {
  const sellerFee = calculateSellerFee(subtotal)
  return roundCurrency(subtotal - sellerFee)
}

/**
 * Calculate total amount buyer pays (subtotal + buyer fee)
 * 
 * @param subtotal - The transaction subtotal
 * @returns The total amount buyer pays
 */
export function calculateBuyerTotal(subtotal: number): number {
  const buyerFee = calculateBuyerFee(subtotal)
  return roundCurrency(subtotal + buyerFee)
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
 * Get fee breakdown for a Rift transaction
 * Shows complete fee structure: buyer pays subtotal + 3%, seller receives subtotal - 5%
 * 
 * @param subtotal - The transaction subtotal
 * @returns Complete fee breakdown
 */
export function getFeeBreakdown(subtotal: number): {
  subtotal: number
  buyerFee: number
  sellerFee: number
  buyerTotal: number
  sellerNet: number
  paymentProcessingFees: {
    percentageFee: number
    fixedFee: number
    totalFee: number
  }
} {
  const buyerFee = calculateBuyerFee(subtotal)
  const sellerFee = calculateSellerFee(subtotal)
  const buyerTotal = calculateBuyerTotal(subtotal)
  const sellerNet = calculateSellerNet(subtotal)
  
  // Calculate Stripe payment processing fees (for reference)
  const processingFees = calculatePaymentProcessingFees(buyerTotal)

  return {
    subtotal,
    buyerFee,
    sellerFee,
    buyerTotal,
    sellerNet,
    paymentProcessingFees: {
      percentageFee: processingFees.percentageFee,
      fixedFee: processingFees.fixedFee,
      totalFee: processingFees.totalFee,
    },
  }
}

/**
 * Round to 2 decimal places (for currency calculations)
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}
