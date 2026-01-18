# Data Retention Periods

This document defines specific data retention periods for Rift based on legal requirements, operational needs, and the Data Retention and Disposal Policy.

**Last Updated**: January 2026

---

## Overview

Retention periods are defined based on:
- **Legal requirements** (tax, accounting, consumer protection laws)
- **Operational needs** (dispute resolution, fraud prevention)
- **Data minimization principles** (retain only as long as necessary)

Rift operates primarily in **Quebec, Canada**, but serves users globally. Retention periods reflect the most stringent requirements.

---

## Retention Periods by Data Type

### 1. Financial and Transaction Records

#### Completed Transactions
- **Retention Period**: **7 years** from transaction completion
- **Legal Basis**: Tax and accounting record requirements (Canada Revenue Agency)
- **Includes**: 
  - Transaction records (RiftTransaction)
  - Payment metadata
  - Fee records
  - Payout records
- **Disposal**: Anonymization or deletion after retention period

#### Cancelled/Refunded Transactions
- **Retention Period**: **7 years** from cancellation/refund date
- **Legal Basis**: Accounting and tax requirements
- **Includes**: Transaction records, refund records
- **Disposal**: Anonymization or deletion after retention period
- **Note**: Vault assets (files) are deleted immediately upon cancellation/refund

#### Payment Records
- **Retention Period**: **7 years** from payment date
- **Legal Basis**: Financial record-keeping requirements
- **Includes**: Stripe payment metadata, payout records
- **Disposal**: Anonymization or deletion after retention period

### 2. Dispute Records

#### Resolved Disputes
- **Retention Period**: **7 years** from resolution date
- **Legal Basis**: Legal liability and dispute resolution requirements
- **Includes**: Dispute records, evidence packets, resolution decisions
- **Disposal**: Anonymization or deletion after retention period

#### Active Disputes
- **Retention Period**: Indefinite until resolved, then 7 years
- **Legal Basis**: Active legal matters
- **Includes**: All dispute-related data
- **Disposal**: After resolution + 7 years

### 3. User Account Data

#### Active Accounts
- **Retention Period**: While account is active + 90 days after deletion request
- **Legal Basis**: User service provision
- **Includes**: Profile information, preferences, verification status
- **Disposal**: Deleted upon account deletion (with cascading deletes)

#### Deleted Accounts
- **Retention Period**: **90 days** after deletion (soft delete grace period)
- **Legal Basis**: Account recovery window, fraud prevention
- **Includes**: User record (if soft delete), related data
- **Disposal**: Permanent deletion after grace period

### 4. Communication Data

#### Messages and Conversations
- **Retention Period**: **7 years** from last message or transaction completion (whichever is later)
- **Legal Basis**: Dispute resolution, legal evidence
- **Includes**: Messages, files shared in conversations
- **Disposal**: Deletion after retention period

### 5. Verification and Compliance Data

#### Verification Codes
- **Retention Period**: **24 hours** after expiration
- **Legal Basis**: Operational necessity (no legal requirement)
- **Includes**: Email/phone verification codes
- **Disposal**: Automatic deletion via scheduled cleanup (daily)

#### Signup Sessions
- **Retention Period**: **24 hours** after expiration
- **Legal Basis**: Operational necessity
- **Includes**: Incomplete signup session data
- **Disposal**: Automatic deletion via scheduled cleanup (daily)

#### Identity Verification Data
- **Retention Period**: **7 years** from verification date (if applicable)
- **Legal Basis**: KYC/AML requirements (if applicable)
- **Includes**: ID verification status, verification metadata
- **Disposal**: Anonymization or deletion after retention period

### 6. Vault Assets (Files)

#### Active Transactions
- **Retention Period**: While transaction is active
- **Legal Basis**: Transaction completion requirements
- **Includes**: Files uploaded to vault, proof submissions
- **Disposal**: 
  - **Cancelled/Refunded**: Immediate deletion (on cancellation/refund)
  - **Completed**: 7 years from transaction completion
  - **Disputed**: Until dispute resolved + 7 years

#### Completed Transactions
- **Retention Period**: **7 years** from transaction completion
- **Legal Basis**: Dispute resolution, evidence requirements
- **Includes**: All vault assets associated with completed transactions
- **Disposal**: Deletion after retention period

### 7. Activity and Analytics Data

#### Activity Feed Data
- **Retention Period**: **2 years** from activity date
- **Legal Basis**: User engagement, analytics
- **Includes**: Public activity feed entries
- **Disposal**: Deletion after retention period
- **Note**: Respects user privacy settings (showInActivityFeed)

#### Analytics Data
- **Retention Period**: **2 years** from collection date
- **Legal Basis**: Service improvement, analytics
- **Includes**: Usage logs, performance metrics
- **Disposal**: Anonymization or deletion after retention period

### 8. Policy Acceptance Records

#### Policy Acceptances
- **Retention Period**: **7 years** from acceptance date
- **Legal Basis**: Legal compliance, dispute resolution
- **Includes**: Terms of Service and Privacy Policy acceptance records
- **Disposal**: Deletion after retention period

### 9. Audit and Security Logs

#### Admin Audit Logs
- **Retention Period**: **7 years** from log date
- **Legal Basis**: Compliance, security auditing
- **Includes**: Admin actions, access logs
- **Disposal**: Deletion after retention period

#### Security Events
- **Retention Period**: **2 years** from event date
- **Legal Basis**: Security monitoring, fraud prevention
- **Includes**: Security events, fraud detection logs
- **Disposal**: Anonymization or deletion after retention period

---

## Special Cases

### Legal Holds
- **Retention Period**: Indefinite until legal hold is released
- **Legal Basis**: Legal obligations, court orders
- **Includes**: Any data subject to legal hold
- **Disposal**: After legal hold is released + standard retention period
- **Note**: Legal hold system not yet implemented (future enhancement)

### Backup Data
- **Retention Period**: **30 days** for automated backups
- **Legal Basis**: Operational continuity
- **Includes**: Database backups, storage backups
- **Disposal**: Automatic deletion after retention period
- **Note**: Backup deletion from backups is limited by Supabase/Vercel capabilities

---

## Implementation Notes

### Scheduled Cleanup
- **Daily cleanup**: Expired verification codes, signup sessions
- **Weekly cleanup**: (Future) Activity data, analytics data past retention
- **Monthly cleanup**: (Future) Completed transactions past retention period
- **Manual cleanup**: As needed for specific data types

### Anonymization vs Deletion
- **Deletion**: Preferred for user data, personal information
- **Anonymization**: Used for aggregated analytics, statistical data
- **Decision criteria**: 
  - If data contains PII → Delete
  - If data is needed for analytics → Anonymize
  - If data is required for legal compliance → Retain (with access restrictions)

### Grace Periods
- **Account deletion**: 90-day soft delete grace period
- **Backup cleanup**: 30-day backup retention
- **Recovery windows**: Built into retention periods

---

## Compliance Notes

### Jurisdictional Requirements
- **Canada (Quebec)**: Primary jurisdiction (7 years for financial records)
- **United States**: Varies by state (typically 3-7 years)
- **EU (GDPR)**: Data minimization, purpose-based retention
- **Other jurisdictions**: Follow most stringent requirement

### Legal Requirements Met
- ✅ Tax record retention (7 years)
- ✅ Accounting record retention (7 years)
- ✅ Consumer protection (dispute resolution)
- ✅ Data minimization (purpose-based retention)
- ✅ User rights (deletion, access)

---

## Review and Updates

This document is reviewed:
- **Annually**: Regular review of retention periods
- **When laws change**: Update retention periods as needed
- **When new data types are added**: Define retention periods
- **When operational needs change**: Adjust as necessary

**Next Review Date**: January 2027

---

## Questions or Concerns

For questions about data retention or to request data deletion, contact:
- **Email**: [Contact information to be added]
- **Legal page**: `/legal`
- **Data Retention Policy**: `DATA_RETENTION_AND_DISPOSAL_POLICY.md`
