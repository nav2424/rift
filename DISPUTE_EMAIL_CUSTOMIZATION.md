# Dispute Email Customization Guide

This guide explains how to customize the emails sent to users about disputes.

## Current Email Functionality

### When Disputes Are Opened

When a dispute is submitted (via `/api/disputes/[id]/submit`), the system sends emails to:
- **Buyer** - Notification that they opened a dispute
- **Seller** - Notification that a dispute was opened against them
- **Admin** - Notification that a new dispute requires attention

The email function is: `sendDisputeRaisedEmail()` in `lib/email.ts`

### Email Content Location

The email templates are defined in `lib/email.ts` starting at line 197. The function builds HTML email content with:

1. **Dispute Information Section** - Dispute type, ID, rift number, amount, item type, raised date
2. **Transaction Details Section** - Item title, description, shipping address
3. **Party Information Section** - Buyer and seller names/emails
4. **Dispute Reason Section** - The reason and summary provided by the buyer

## How to Customize Emails

### Option 1: Edit the Email Function Directly

**File:** `lib/email.ts`  
**Function:** `sendDisputeRaisedEmail()` (lines 197-370)

You can customize:
- Email subject lines
- Email body content and formatting
- Information included in the emails
- Styling and layout

**Example:** To change the buyer email subject:
```typescript
// Find around line 326-345
const buyerSellerHtml = `
  <div style="...">
    <h2 style="color: #111827; margin-bottom: 20px;">Dispute Raised</h2>
    // ... rest of content
  </div>
`

// Change the subject when calling sendEmail:
await sendEmail(
  buyerEmail, 
  'Your Custom Subject Here - Rift',  // Change this
  buyerSellerHtml
)
```

### Option 2: Create Separate Email Templates

For more advanced customization, you can:

1. **Create a new template file** (e.g., `lib/email-templates/dispute-raised.ts`)
2. **Extract the HTML templates** into separate functions
3. **Import and use** them in `sendDisputeRaisedEmail()`

**Example structure:**
```typescript
// lib/email-templates/dispute-raised.ts
export function getBuyerEmailTemplate(data: DisputeEmailData): string {
  return `
    <div>Your custom HTML here</div>
  `
}

export function getSellerEmailTemplate(data: DisputeEmailData): string {
  return `
    <div>Your custom HTML here</div>
  `
}

export function getAdminEmailTemplate(data: DisputeEmailData): string {
  return `
    <div>Your custom HTML here</div>
  `
}
```

Then update `lib/email.ts`:
```typescript
import { getBuyerEmailTemplate, getSellerEmailTemplate, getAdminEmailTemplate } from './email-templates/dispute-raised'

// In sendDisputeRaisedEmail function:
const buyerHtml = getBuyerEmailTemplate({
  itemTitle,
  reason,
  disputeDetails,
  riftUrl
})
await sendEmail(buyerEmail, 'Dispute Opened - Rift', buyerHtml)
```

### Option 3: Add Environment Variables for Customization

You can add environment variables for email customization:

```typescript
// In sendDisputeRaisedEmail function:
const customSubjectPrefix = process.env.DISPUTE_EMAIL_SUBJECT_PREFIX || 'Dispute'
const supportEmail = process.env.SUPPORT_EMAIL || 'support@joinrift.co'
const companyName = process.env.COMPANY_NAME || 'Rift'

// Use in emails:
await sendEmail(
  buyerEmail, 
  `${customSubjectPrefix} Opened - ${companyName}`, 
  buyerHtml
)
```

## Adding Status Update Emails

Currently, **status update emails are NOT automatically sent** when dispute status changes. If you want to add this functionality:

### Step 1: Create a New Email Function

Add to `lib/email.ts`:

```typescript
/**
 * Send dispute status update notification
 */
export async function sendDisputeStatusUpdateEmail(
  buyerEmail: string,
  sellerEmail: string,
  adminEmail: string,
  disputeId: string,
  riftId: string,
  itemTitle: string,
  oldStatus: string,
  newStatus: string,
  adminNotes?: string
) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const riftUrl = `${baseUrl}/rifts/${riftId}`
  
  const statusLabels: Record<string, string> = {
    'submitted': 'Submitted',
    'under_review': 'Under Review',
    'needs_info': 'Needs Information',
    'resolved_buyer': 'Resolved (Buyer Wins)',
    'resolved_seller': 'Resolved (Seller Wins)',
    'auto_rejected': 'Auto-Rejected',
  }
  
  const buyerSellerHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #111827; margin-bottom: 20px;">Dispute Status Update</h2>
      <p style="color: #374151; line-height: 1.6;">
        The status of your dispute for <strong>${itemTitle}</strong> has been updated.
      </p>
      
      <div style="background: #f9fafb; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #111827;">
          <strong>Previous Status:</strong> ${statusLabels[oldStatus] || oldStatus}<br>
          <strong>New Status:</strong> ${statusLabels[newStatus] || newStatus}
        </p>
        ${adminNotes ? `
        <p style="margin-top: 12px; color: #374151;">
          <strong>Admin Notes:</strong><br>
          ${adminNotes}
        </p>
        ` : ''}
      </div>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <a href="${riftUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Dispute</a>
      </div>
    </div>
  `
  
  await Promise.all([
    sendEmail(buyerEmail, `Dispute Status Update - ${statusLabels[newStatus]} - Rift`, buyerSellerHtml),
    sendEmail(sellerEmail, `Dispute Status Update - ${statusLabels[newStatus]} - Rift`, buyerSellerHtml),
  ])
}
```

### Step 2: Call the Function on Status Updates

Add to the admin dispute resolution endpoints:

**File:** `app/api/admin/disputes/[id]/resolve-buyer/route.ts`  
**File:** `app/api/admin/disputes/[id]/resolve-seller/route.ts`  
**File:** `app/api/admin/disputes/[id]/request-info/route.ts`  
**File:** `app/api/admin/disputes/[id]/reject/route.ts`

**Example (in resolve-buyer/route.ts):**
```typescript
import { sendDisputeStatusUpdateEmail } from '@/lib/email'

// After updating dispute status:
const rift = await prisma.riftTransaction.findUnique({
  where: { id: dispute.rift_id },
  include: { buyer: true, seller: true }
})

const admin = await prisma.user.findFirst({
  where: { role: 'ADMIN' }
})

if (rift && admin) {
  await sendDisputeStatusUpdateEmail(
    rift.buyer.email,
    rift.seller.email,
    admin.email,
    disputeId,
    dispute.rift_id,
    rift.itemTitle,
    dispute.status, // old status
    'resolved_buyer', // new status
    body.adminNotes // optional admin notes
  )
}
```

## Email Styling Tips

The emails use inline CSS for maximum compatibility. You can customize:

- **Colors:** Change hex colors (e.g., `#3b82f6` for blue, `#ef4444` for red)
- **Fonts:** Modify the `font-family` in the main container
- **Layout:** Adjust padding, margins, and spacing
- **Buttons:** Customize the CTA button styling
- **Borders:** Add or modify borders for sections

## Testing Emails

To test email changes:

1. **Development mode:** Emails are logged to console when SMTP is not configured
2. **Check console:** Look for `📧 Email would be sent:` messages
3. **Use test SMTP:** Configure real SMTP credentials for actual email sending
4. **Use a test dispute:** Create a test dispute to trigger the email

## Important Notes

- Email HTML uses inline styles for email client compatibility
- Always test emails in multiple email clients (Gmail, Outlook, Apple Mail)
- Keep email content concise and scannable
- Include clear call-to-action buttons/links
- Make sure links use absolute URLs (with `baseUrl`)
- The `sendEmail()` function handles SMTP configuration automatically

## Files to Modify

1. **`lib/email.ts`** - Main email function (`sendDisputeRaisedEmail`)
2. **`app/api/disputes/[id]/submit/route.ts`** - Where dispute opened emails are triggered
3. **`app/api/admin/disputes/[id]/*/route.ts`** - Where you can add status update emails

## Need Help?

- Check `lib/email.ts` for the current email implementation
- Review `app/api/disputes/[id]/submit/route.ts` to see when emails are sent
- Test changes in development mode first (emails will be logged to console)

