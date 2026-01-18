# Invoicing System Implementation Status

## ✅ Completed Components

### 1. Database Schema (Supabase)
- ✅ **Migration file**: `supabase/migrations/008_create_invoices.sql`
- ✅ Created `invoices` table with all required fields
- ✅ Created `invoice_items` table
- ✅ Added indexes for performance
- ✅ Added trigger for `updated_at` auto-update
- ✅ RLS policies (note: require Supabase Auth - currently disabled as project uses NextAuth)
- ⚠️ **Note**: RLS policies use `auth.uid()` which requires Supabase Auth. Since the project uses NextAuth, access control is handled at the API level instead.

### 2. Core Libraries
- ✅ **Invoice Number Generation**: `lib/invoice-number.ts`
  - Generates sequential numbers: `RIFT-YYYY-000001`
  - Handles year-based sequences
  - Includes fallback for errors

- ✅ **PDF Generation**: `lib/invoice-pdf.ts`
  - Uses PDFKit for PDF generation
  - Premium, clean design
  - Includes all invoice details
  - Uploads to Supabase storage

- ✅ **Email Templates**: `lib/invoice-email.ts`
  - Professional email template
  - Includes invoice details, payment links, PDF links
  - Responsive HTML design

### 3. API Routes
- ✅ **POST `/api/rifts/[id]/invoice`**: Create draft invoice
  - Validates service type
  - Generates invoice number
  - Creates default invoice item
  - Returns complete invoice with items

- ✅ **GET `/api/rifts/[id]/invoice`**: Get invoice for a rift
  - Verifies seller ownership
  - Returns invoice with items

- ✅ **PATCH `/api/invoices/[id]`**: Update invoice
  - Only allows updates for draft/sent status
  - Recalculates totals
  - Updates invoice items

- ✅ **GET `/api/invoices/[id]`**: Get invoice by ID
  - Verifies seller ownership
  - Returns invoice with items

- ✅ **POST `/api/invoices/[id]/pdf`**: Generate PDF
  - Generates PDF
  - Uploads to Supabase storage
  - Updates invoice with PDF URL

- ✅ **POST `/api/invoices/[id]/send`**: Send invoice email
  - Generates PDF if missing
  - Sends email to buyer
  - Updates status to 'sent'
  - Sets issued_at and sent_at

## ⚠️ Remaining Components

### 1. Public Invoice View (Token System)
- ❌ **GET `/invoice/[invoiceId]`**: Public invoice view page
- ❌ Token generation/signing for secure access
- ❌ Token validation middleware
- **Status**: Not started

### 2. Payment Integration (Stripe)
- ❌ **POST `/api/invoices/[id]/payment-link`**: Create Stripe payment link
- ❌ Webhook handler for invoice payment updates
- ❌ Payment link storage in invoice
- **Status**: Not started

### 3. UI Components
- ❌ Invoice tab in Service Rift detail page
- ❌ Invoice editor/form component
- ❌ Invoice preview component
- ❌ Invoice status badges
- ❌ Invoice items editor
- **Status**: Not started

### 4. Background Logic
- ❌ Overdue status cron job or check
- ❌ Automatic status updates
- **Status**: Not started

### 5. Additional Features
- ❌ Mark invoice as void
- ❌ Resend invoice
- ❌ Copy payment link
- ❌ Download PDF button

## 🔧 Setup Requirements

### 1. Database Migration
Run the Supabase migration:
```bash
# Apply migration to Supabase
# This should be done via Supabase CLI or dashboard
```

### 2. Supabase Storage Bucket
Create a storage bucket named `invoices`:
```sql
-- Run in Supabase SQL editor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true);
```

### 3. Environment Variables
Already configured (using existing email and Supabase setup):
- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_*` variables (for email sending)

### 4. Dependencies
✅ Installed:
- `pdfkit` (PDF generation)
- `@types/pdfkit` (TypeScript types)

## 📋 Next Steps

### Priority 1: Public Invoice View
1. Create token generation utility (HMAC-based)
2. Create `/invoice/[invoiceId]` page
3. Add token validation middleware
4. Test public access

### Priority 2: Payment Integration
1. Create Stripe payment link endpoint
2. Update invoice send to create payment link
3. Add webhook handler for payments
4. Update invoice status on payment

### Priority 3: UI Components
1. Add Invoice tab to Service Rift detail page
2. Create invoice editor component
3. Create invoice preview component
4. Add status badges and actions

### Priority 4: Background Logic
1. Create overdue check cron job
2. Implement automatic status updates

## 🧪 Testing Checklist

### API Routes
- [ ] Create invoice for service rift
- [ ] Create invoice fails for non-service rift
- [ ] Update invoice (draft status)
- [ ] Update invoice fails (paid status)
- [ ] Generate PDF
- [ ] Send invoice email
- [ ] Verify email content
- [ ] Verify PDF generation

### Database
- [ ] Invoice number generation (sequential)
- [ ] Invoice items cascade delete
- [ ] Updated_at trigger works
- [ ] Foreign key constraints (if enabled)

### Security
- [ ] Seller can only access their invoices
- [ ] Buyer cannot access invoices directly (without token)
- [ ] API-level authentication works

## 📝 Notes

1. **RLS Policies**: Currently disabled because the project uses NextAuth instead of Supabase Auth. Access control is handled at the API level. If you migrate to Supabase Auth, the RLS policies in the migration will work.

2. **Foreign Keys**: Foreign key constraints to `EscrowTransaction` and `User` tables are commented out because those tables are managed by Prisma. If you want to add them, update the migration file.

3. **Storage**: The PDF upload assumes a Supabase storage bucket named `invoices`. Create this bucket before using the PDF generation feature.

4. **Email**: Uses existing email infrastructure (nodemailer). Make sure SMTP is configured.

5. **Invoice Numbering**: Uses year-based sequential numbering. Reset each year automatically.

## 🚀 Quick Start

### 1. Run Migration
```bash
# Via Supabase CLI
supabase db push

# Or via Supabase Dashboard SQL Editor
# Copy contents of supabase/migrations/008_create_invoices.sql
```

### 2. Create Storage Bucket
```sql
-- In Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true);
```

### 3. Test API
```bash
# Create invoice for a service rift
curl -X POST http://localhost:3000/api/rifts/{riftId}/invoice \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"

# Generate PDF
curl -X POST http://localhost:3000/api/invoices/{invoiceId}/pdf \
  -H "Cookie: next-auth.session-token=..."

# Send invoice
curl -X POST http://localhost:3000/api/invoices/{invoiceId}/send \
  -H "Cookie: next-auth.session-token=..."
```

## 📚 File Structure

```
supabase/migrations/
  └── 008_create_invoices.sql

lib/
  ├── invoice-number.ts (✅)
  ├── invoice-pdf.ts (✅)
  └── invoice-email.ts (✅)

app/api/
  ├── rifts/[id]/invoice/
  │   └── route.ts (✅)
  └── invoices/[id]/
      ├── route.ts (✅)
      ├── pdf/
      │   └── route.ts (✅)
      └── send/
          └── route.ts (✅)
```

## 🎯 Implementation Summary

**Completed**: ~60% of core functionality
- Database schema ✅
- Core libraries ✅
- API routes (create, update, get, PDF, send) ✅
- Email templates ✅

**Remaining**: ~40% of functionality
- Public invoice view (token system)
- Payment integration (Stripe)
- UI components
- Background logic (overdue status)
- Additional features (void, resend, etc.)

The foundation is solid and ready for the remaining components to be built on top of it.
