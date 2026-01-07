/**
 * Stripe Idempotency Key Generation
 * 
 * Generates stable, unique idempotency keys for Stripe operations.
 * Keys must be stable across retries (no timestamps).
 */

/**
 * Generate idempotency key for PaymentIntent creation
 */
export function getPaymentIntentIdempotencyKey(riftId: string): string {
  return `pi:create:rift:${riftId}:v1`
}

/**
 * Generate idempotency key for full release transfer
 */
export function getFullReleaseTransferIdempotencyKey(riftId: string): string {
  return `xfer:release:rift:${riftId}:v1`
}

/**
 * Generate idempotency key for milestone release transfer
 */
export function getMilestoneTransferIdempotencyKey(riftId: string, milestoneIndex: number): string {
  return `xfer:release:rift:${riftId}:ms:${milestoneIndex}:v1`
}

/**
 * Generate idempotency key for refund
 */
export function getRefundIdempotencyKey(riftId: string, refundRecordId: string): string {
  return `rfnd:rift:${riftId}:${refundRecordId}:v1`
}

/**
 * Generate idempotency key for transfer reversal
 */
export function getTransferReversalIdempotencyKey(transferId: string, amountCents: number): string {
  return `xfer:reverse:${transferId}:amt:${amountCents}:v1`
}

