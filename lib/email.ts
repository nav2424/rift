/**
 * Email notification system
 */

import nodemailer from 'nodemailer'

// Create transporter (using Gmail as default, but can be configured)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

/**
 * Send email notification
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  // In development without SMTP configured, just log
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log('📧 Email would be sent:', { to, subject })
    return true
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    })
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

/**
 * Send escrow created notification
 */
export async function sendEscrowCreatedEmail(
  buyerEmail: string,
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  amount: number,
  currency: string
) {
  const buyerHtml = `
    <h2>Escrow Created</h2>
    <p>You've created an escrow transaction for <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    <p>Please proceed to make payment to complete the transaction.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/escrows/${escrowId}">View Escrow</a></p>
  `

  const sellerHtml = `
    <h2>New Escrow Transaction</h2>
    <p>You have a new escrow transaction for <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    <p>Please wait for the buyer to complete payment.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/escrows/${escrowId}">View Escrow</a></p>
  `

  await Promise.all([
    sendEmail(buyerEmail, 'Escrow Created - Rift', buyerHtml),
    sendEmail(sellerEmail, 'New Escrow Transaction - Rift', sellerHtml),
  ])
}

/**
 * Send payment received notification
 */
export async function sendPaymentReceivedEmail(
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  amount: number,
  currency: string
) {
  const html = `
    <h2>Payment Received</h2>
    <p>Payment has been received for your escrow transaction: <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    <p>Please proceed to ship the item and upload proof of shipment.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/escrows/${escrowId}">View Escrow</a></p>
  `

  await sendEmail(sellerEmail, 'Payment Received - Rift', html)
}

/**
 * Send shipment proof uploaded notification
 */
export async function sendShipmentProofEmail(
  buyerEmail: string,
  escrowId: string,
  itemTitle: string
) {
  const html = `
    <h2>Shipment Proof Uploaded</h2>
    <p>The seller has uploaded proof of shipment for: <strong>${itemTitle}</strong>.</p>
    <p>Please track your shipment and confirm receipt when it arrives.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/escrows/${escrowId}">View Escrow</a></p>
  `

  await sendEmail(buyerEmail, 'Shipment Proof Uploaded - Rift', html)
}

/**
 * Send item received notification
 */
export async function sendItemReceivedEmail(
  sellerEmail: string,
  escrowId: string,
  itemTitle: string
) {
  const html = `
    <h2>Item Received</h2>
    <p>The buyer has confirmed receipt of: <strong>${itemTitle}</strong>.</p>
    <p>Funds are now pending release. The buyer will release funds shortly.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/escrows/${escrowId}">View Escrow</a></p>
  `

  await sendEmail(sellerEmail, 'Item Received - Rift', html)
}

/**
 * Send funds released notification
 */
export async function sendFundsReleasedEmail(
  sellerEmail: string,
  escrowId: string,
  itemTitle: string,
  amount: number,
  currency: string,
  platformFee?: number
) {
  // Calculate total fee (8%) from the amount seller receives
  // sellerReceives = originalAmount * 0.92, so originalAmount = sellerReceives / 0.92
  // totalFee = originalAmount * 0.08
  const originalAmount = amount / 0.92
  const totalFee = originalAmount * 0.08
  
  const feeBreakdown = platformFee 
    ? `<p><strong>Total Fee (8%):</strong> ${currency} ${totalFee.toFixed(2)} (includes platform fee: ${currency} ${platformFee.toFixed(2)} and payment processing)</p>`
    : ''
  
  const html = `
    <h2>Funds Released</h2>
    <p>Funds have been released for your escrow transaction: <strong>${itemTitle}</strong>.</p>
    <p><strong>Amount You Receive:</strong> ${currency} ${amount.toFixed(2)}</p>
    ${feeBreakdown}
    <p>The funds should appear in your account within 1-2 business days.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/escrows/${escrowId}">View Escrow</a></p>
  `

  await sendEmail(sellerEmail, 'Funds Released - Rift', html)
}

/**
 * Send dispute raised notification
 */
export async function sendDisputeRaisedEmail(
  buyerEmail: string,
  sellerEmail: string,
  adminEmail: string,
  escrowId: string,
  itemTitle: string,
  reason: string
) {
  const buyerSellerHtml = `
    <h2>Dispute Raised</h2>
    <p>A dispute has been raised for escrow transaction: <strong>${itemTitle}</strong>.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>An admin will review and resolve the dispute shortly.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/escrows/${escrowId}">View Escrow</a></p>
  `

  const adminHtml = `
    <h2>New Dispute Requires Attention</h2>
    <p>A dispute has been raised for escrow transaction: <strong>${itemTitle}</strong>.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>Please review and resolve the dispute.</p>
    <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin">Admin Dashboard</a></p>
  `

  await Promise.all([
    sendEmail(buyerEmail, 'Dispute Raised - Rift', buyerSellerHtml),
    sendEmail(sellerEmail, 'Dispute Raised - Rift', buyerSellerHtml),
    sendEmail(adminEmail, 'New Dispute - Rift', adminHtml),
  ])
}

