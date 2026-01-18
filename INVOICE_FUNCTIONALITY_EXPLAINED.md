# Invoice Functionality Explained

## Overview

The invoicing system is designed for **Service-based Rifts only**. It allows sellers (businesses/freelancers/agencies) to create, send, and manage professional invoices for their service transactions.

## Key Features

- ✅ **Sequential invoice numbering**: `RIFT-YYYY-000001` format (year-based)
- ✅ **Token-based public access**: Secure links that don't require authentication
- ✅ **PDF generation**: Automatic PDF creation for invoices
- ✅ **Email delivery**: Professional email templates with invoice links
- ✅ **Status tracking**: draft → sent → paid/overdue/void
- ✅ **Line items**: Support for multiple items with quantities and prices

---

## Complete Flow

### 1. **Invoice Creation** (Seller Action)

**Endpoint**: `POST /api/rifts/[riftId]/invoice`

**What happens**:
1. Seller initiates invoice creation from a Service-based Rift
2. System validates:
   - Rift is of type `SERVICES`
   - User is the seller
   - No invoice already exists for this rift
3. Generates unique invoice number: `RIFT-2025-000001` (sequential, year-based)
4. Creates invoice record with status `draft`
5. Creates default invoice item from the Rift's details
6. Returns complete invoice with items

**Initial State**:
- Status: `draft`
- Contains buyer info, amounts, currency from the Rift
- Can be edited before sending

---

### 2. **Invoice Editing** (Seller Action)

**Endpoint**: `PATCH /api/invoices/[invoiceId]`

**What can be updated** (only in `draft` or `sent` status):
- Buyer name/email
- Due date
- Notes
- Invoice items (add/edit/remove)
- Tax amount

**What happens**:
- Totals are automatically recalculated
- Invoice items are updated
- Status remains unchanged (unless explicitly changed)

---

### 3. **PDF Generation** (Automatic or Manual)

**Endpoint**: `POST /api/invoices/[invoiceId]/pdf`

**What happens**:
1. Generates PDF using PDFKit library
2. Uploads PDF to Supabase Storage (`invoices` bucket)
3. Updates invoice with `pdf_url`
4. PDF includes: invoice number, buyer/seller info, items, totals, due date

**Note**: PDF is automatically generated when sending invoice if it doesn't exist

---

### 4. **Sending Invoice** (Seller Action)

**Endpoint**: `POST /api/invoices/[invoiceId]/send`

**What happens**:
1. Validates seller ownership
2. Generates PDF if it doesn't exist
3. Creates secure token for public access (valid for 30 days)
4. Sends email to buyer with:
   - Invoice details
   - Secure view link (tokenized)
   - PDF download link
   - Payment link (if configured)
5. Updates invoice status to `sent`
6. Sets `issued_at` and `sent_at` timestamps

**Email includes**:
- Invoice number and total
- Due date
- "View Invoice" button (tokenized link)
- "Pay Now" button (if payment URL exists)
- PDF download link

---

### 5. **Public Invoice View** (Buyer Access)

**URL**: `/invoice/[invoiceId]?token=[token]`

**Security**:
- Uses HMAC-signed tokens (SHA-256)
- Token expires after 30 days
- Timing-safe comparison to prevent timing attacks
- No authentication required (buyer-friendly)

**What buyer sees**:
- Full invoice details (number, status, dates)
- Buyer information
- Line items table
- Subtotal, tax, total
- Notes
- Payment button (if not paid)
- PDF download button
- Status badge (sent/paid/overdue/void)

---

### 6. **Payment Processing**

**Current Status**: Payment link integration is optional
- Invoices can use existing Rift payment flow
- Can be extended with Stripe Payment Links
- `payment_url` field exists in invoice schema

---

## Database Schema

### `invoices` Table

```sql
- id: TEXT (UUID)
- rift_id: TEXT (links to RiftTransaction)
- seller_id: TEXT (links to User)
- buyer_email: TEXT
- buyer_name: TEXT
- invoice_number: TEXT (unique, format: RIFT-YYYY-000001)
- status: TEXT (draft, sent, paid, overdue, void)
- currency: TEXT (default: USD)
- subtotal: NUMERIC
- tax: NUMERIC
- total: NUMERIC
- due_date: DATE
- issued_at: TIMESTAMPTZ
- sent_at: TIMESTAMPTZ
- paid_at: TIMESTAMPTZ
- notes: TEXT
- payment_url: TEXT (optional)
- pdf_url: TEXT (Supabase Storage URL)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ (auto-updated)
```

### `invoice_items` Table

```sql
- id: TEXT (UUID)
- invoice_id: TEXT (foreign key, cascade delete)
- name: TEXT
- description: TEXT
- quantity: NUMERIC
- unit_price: NUMERIC
- amount: NUMERIC (quantity × unit_price)
- created_at: TIMESTAMPTZ
```

---

## Token System

### How Tokens Work

**Generation** (`lib/invoice-token.ts`):
```
1. Create message: "invoiceId:timestamp"
2. Generate HMAC-SHA256 signature using secret key
3. Encode as base64url: "invoiceId:timestamp:signature"
```

**Verification**:
```
1. Decode base64url token
2. Extract invoiceId, timestamp, signature
3. Check expiry (30 days)
4. Recompute signature and compare (timing-safe)
5. Return invoiceId if valid
```

**Security Features**:
- Uses environment variable: `INVOICE_TOKEN_SECRET` (falls back to `JWT_SECRET`)
- Timing-safe comparison prevents timing attacks
- 30-day expiration
- Stateless (no database lookup needed)

**Token URL Format**:
```
https://joinrift.co/invoice/[invoiceId]?token=[base64url-encoded-token]
```

---

## API Endpoints

### Seller Endpoints (Authenticated)

1. **Create Invoice**
   - `POST /api/rifts/[riftId]/invoice`
   - Creates draft invoice for a Service Rift

2. **Get Invoice**
   - `GET /api/rifts/[riftId]/invoice` - Get invoice for a rift
   - `GET /api/invoices/[invoiceId]` - Get invoice by ID

3. **Update Invoice**
   - `PATCH /api/invoices/[invoiceId]`
   - Update invoice details (draft/sent only)

4. **Generate PDF**
   - `POST /api/invoices/[invoiceId]/pdf`
   - Generate and upload PDF

5. **Send Invoice**
   - `POST /api/invoices/[invoiceId]/send`
   - Generate PDF, send email, update status

### Public Endpoint (Token-based)

1. **Public Invoice View**
   - `GET /api/invoices/[invoiceId]/public?token=[token]`
   - Returns invoice data (validated via token)

---

## Invoice Numbering

**Format**: `RIFT-YYYY-000001`

**How it works** (`lib/invoice-number.ts`):
1. Gets current year (e.g., 2025)
2. Searches for highest invoice number with prefix `RIFT-2025-`
3. Extracts sequence number from last invoice
4. Increments by 1
5. Formats with 6-digit zero-padding

**Examples**:
- First invoice in 2025: `RIFT-2025-000001`
- Second invoice: `RIFT-2025-000002`
- First invoice in 2026: `RIFT-2026-000001` (resets)

**Fallback**: If database query fails, uses timestamp-based number

---

## Status Lifecycle

```
draft → sent → paid/overdue/void
```

**Status Definitions**:
- `draft`: Invoice created but not sent
- `sent`: Invoice emailed to buyer
- `paid`: Payment received (manual or automated)
- `overdue`: Past due date, not paid (requires cron job)
- `void`: Invoice cancelled/voided

**Status Rules**:
- Only `draft` and `sent` invoices can be edited
- `paid`, `overdue`, and `void` invoices are locked
- Status changes are logged via timestamps (`sent_at`, `paid_at`)

---

## Integration with Rifts

### Relationship

- **One Rift → One Invoice** (Service Rifts only)
- Invoice is created from Rift data:
  - Buyer info (email, name)
  - Amount (subtotal)
  - Currency
  - Item title (default invoice item)
- Invoice is independent of Rift payment flow
- Payment can happen via invoice link or Rift payment

### When to Use

- **Service Rifts**: Professional invoicing for services
- **Client Billing**: Send invoices to clients for work completed
- **Recurring Services**: Generate invoices for service milestones
- **Tax Compliance**: Generate invoices for accounting/tax purposes

---

## Email Integration

**Template** (`lib/invoice-email.ts`):
- Professional HTML email
- Includes invoice summary
- Tokenized "View Invoice" link
- "Pay Now" button (if payment URL exists)
- PDF download link
- Responsive design

**Email Flow**:
1. Seller clicks "Send Invoice"
2. PDF generated (if missing)
3. Token generated for invoice
4. Email sent to buyer's email address
5. Buyer clicks link → views invoice (no login required)
6. Buyer can pay or download PDF

---

## File Structure

```
lib/
├── invoice-number.ts      # Sequential invoice number generation
├── invoice-token.ts       # Token generation/verification (HMAC)
├── invoice-pdf.ts         # PDF generation (PDFKit)
└── invoice-email.ts       # Email templates and sending

app/api/
├── rifts/[id]/invoice/
│   └── route.ts           # Create/Get invoice for rift
└── invoices/[id]/
    ├── route.ts           # Get/Update invoice
    ├── pdf/
    │   └── route.ts       # Generate PDF
    ├── send/
    │   └── route.ts       # Send invoice email
    └── public/
        └── route.ts       # Public invoice view (token-based)

app/invoice/
└── [invoiceId]/
    └── page.tsx           # Public invoice view page

supabase/migrations/
└── 008_create_invoices.sql  # Database schema
```

---

## Security Considerations

1. **Token-Based Access**:
   - No authentication required for buyers
   - Secure HMAC signatures
   - Time-limited tokens (30 days)

2. **Access Control**:
   - Only sellers can create/edit invoices
   - API-level authentication (NextAuth)
   - Token validation for public access

3. **Data Privacy**:
   - Sensitive fields (seller_id) not exposed in public view
   - PDF stored in Supabase Storage (secure)
   - Email contains no sensitive payment data

---

## Future Enhancements (Optional)

1. **Stripe Payment Links**: Direct payment integration
2. **Overdue Status**: Cron job to mark overdue invoices
3. **Void Functionality**: Cancel invoices
4. **Resend Invoice**: Re-send invoice email
5. **Invoice UI Component**: Seller dashboard integration
6. **Payment Webhooks**: Automatic status updates on payment
7. **Multiple Currencies**: Enhanced currency support
8. **Recurring Invoices**: Subscription/recurring billing

---

## Usage Examples

### Seller Creates Invoice

```bash
POST /api/rifts/rift-123/invoice
Authorization: Bearer [seller-token]

# Creates draft invoice
# Returns: { id, invoice_number: "RIFT-2025-000001", status: "draft", ... }
```

### Seller Sends Invoice

```bash
POST /api/invoices/inv-123/send
Authorization: Bearer [seller-token]

# Generates PDF, sends email, updates status to "sent"
# Buyer receives email with tokenized link
```

### Buyer Views Invoice

```
GET https://joinrift.co/invoice/inv-123?token=[token]

# Public page, no authentication
# Shows full invoice details
# Can pay or download PDF
```

---

## Summary

The invoice system provides a complete invoicing solution for Service-based Rifts:

✅ **Creation**: Sellers create invoices from Service Rifts
✅ **Management**: Edit invoices (draft/sent status)
✅ **Delivery**: Send professional emails with secure links
✅ **Access**: Token-based public viewing (buyer-friendly)
✅ **PDFs**: Automatic PDF generation
✅ **Tracking**: Status lifecycle (draft → sent → paid/overdue/void)

The system is designed to be:
- **Seller-friendly**: Easy to create and send invoices
- **Buyer-friendly**: No login required to view invoices
- **Secure**: Token-based access with HMAC signatures
- **Professional**: PDF generation and email templates
- **Flexible**: Extensible for future payment integrations
