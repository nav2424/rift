/**
 * Invoice email templates and sending
 */

import { sendEmail } from './email'
import { getInvoiceViewUrl } from './invoice-token'

/**
 * Get base URL (reuse logic from email.ts)
 */
function getBaseUrl(): string {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && !appUrl.includes('.vercel.app')) {
    return appUrl.trim().replace(/\/$/, '')
  }
  const authUrl = process.env.NEXTAUTH_URL
  if (authUrl && !authUrl.includes('.vercel.app')) {
    return authUrl.trim().replace(/\/$/, '')
  }
  return 'https://joinrift.co'
}

/**
 * Send invoice email to buyer
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  invoiceNumber: string,
  buyerEmail: string,
  buyerName: string | null,
  sellerName: string | null,
  total: number,
  currency: string,
  dueDate: string | null,
  pdfUrl: string | null,
  paymentUrl: string | null
): Promise<boolean> {
  const baseUrl = getBaseUrl()
  const invoiceViewUrl = getInvoiceViewUrl(invoiceId, baseUrl)

  const subject = `Invoice ${invoiceNumber} from ${sellerName || 'Rift'}`

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(total)

  const dueDateText = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #000; color: #fff; padding: 20px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 300;">Rift</h1>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 400;">Invoice ${invoiceNumber}</h2>
        <p style="margin: 0; color: #666; font-size: 14px;">${sellerName ? `from ${sellerName}` : 'from Rift'}</p>
      </div>

      <div style="margin-bottom: 30px;">
        <p style="margin: 0 0 10px 0;">${buyerName ? `Hi ${buyerName},` : 'Hi,'}</p>
        <p style="margin: 0 0 10px 0;">You have received an invoice for your service transaction.</p>
        ${dueDateText ? `<p style="margin: 0 0 10px 0;"><strong>Due Date:</strong> ${dueDateText}</p>` : ''}
        <p style="margin: 20px 0; font-size: 24px; font-weight: 300;"><strong>Total: ${formattedTotal}</strong></p>
      </div>

      <div style="margin: 30px 0; text-align: center;">
        <a href="${invoiceViewUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 500;">View Invoice</a>
        ${paymentUrl ? `<a href="${paymentUrl}" style="display: inline-block; background: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 500;">Pay Now</a>` : ''}
      </div>

      ${pdfUrl ? `
      <div style="margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 6px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Download PDF:</p>
        <a href="${pdfUrl}" style="color: #000; text-decoration: underline; font-size: 14px;">${pdfUrl}</a>
      </div>
      ` : ''}

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
        <p style="margin: 0;">Powered by Rift</p>
      </div>
    </body>
    </html>
  `

  const text = `
Invoice ${invoiceNumber} from ${sellerName || 'Rift'}

Hi ${buyerName || 'there'},

You have received an invoice for your service transaction.
${dueDateText ? `Due Date: ${dueDateText}` : ''}

Total: ${formattedTotal}

View Invoice: ${invoiceViewUrl}
${paymentUrl ? `Pay Now: ${paymentUrl}` : ''}
${pdfUrl ? `Download PDF: ${pdfUrl}` : ''}

Powered by Rift
  `

  return await sendEmail(buyerEmail, subject, html, text)
}
