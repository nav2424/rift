# Fraud Prevention & Risk Management System

## Overview

Comprehensive AI-powered fraud prevention system with 10 major feature areas covering risk scoring, proof verification, vault intelligence, dispute automation, and more.

## System Architecture

### 1. Enhanced Risk Scoring (`lib/ai/enhanced-risk-scoring.ts`)

**Features:**
- Dynamic risk score per rift combining buyer + seller + transaction factors
- Velocity spike detection (sudden transaction increases)
- Device fingerprint and IP risk analysis
- Anomaly detection (high-value spikes, many buyers on one seller)
- Chargeback probability model

**API:** `GET /api/rifts/[id]/risk-score`

**Usage:**
```typescript
import { computeEnhancedRiskScore, predictChargebackProbability } from '@/lib/ai/enhanced-risk-scoring'

const riskFactors = await computeEnhancedRiskScore(riftId, deviceFingerprint)
const chargebackPred = await predictChargebackProbability(riftId)
```

### 2. AI Proof Classifier (`lib/ai/proof-classifier.ts`)

**Features:**
- Detects if upload matches item type (tickets vs digital vs services)
- Document authenticity signals (blank PDFs, templates, low quality)
- Ticket proof validation (extracts event name/date/venue)
- Service completion validation (checks deliverables)

**API:** `POST /api/rifts/[id]/proof/classify`

**Usage:**
```typescript
import { classifyProof, extractTicketInfo, validateServiceDeliverables } from '@/lib/ai/proof-classifier'

const classification = await classifyProof(assetId, expectedItemType)
const ticketInfo = await extractTicketInfo(assetId)
const serviceValidation = await validateServiceDeliverables(riftId, assetIds)
```

### 3. Duplicate Proof Detection (`lib/duplicate-proof-detection.ts`)

**Features:**
- Exact SHA-256 matching (already implemented)
- Perceptual hashing support (framework ready)
- Risk level assessment (LOW/MEDIUM/HIGH/CRITICAL)
- Fraud ring detection integration

**Enhanced with:** Perceptual hashing framework in `lib/ai/perceptual-hashing.ts`

### 4. Dispute Triage Automation (`lib/ai/dispute-triage.ts`)

**Features:**
- Auto-routes to: AUTO_REFUND, AUTO_DENY, or MANUAL_REVIEW
- Reason matching (e.g., "not received" but logs show access)
- Decision assistant for admins
- Evidence strength analysis

**API:** `POST /api/rifts/[id]/dispute/triage`

**Usage:**
```typescript
import { triageDispute, generateDecisionAssistant } from '@/lib/ai/dispute-triage'

const triage = await triageDispute(disputeId, riftId)
const assistant = await generateDecisionAssistant(disputeId, riftId)
```

### 5. Vault Intelligence (`lib/vault/intelligence.ts`)

**Features:**
- Auto-generate "Evidence Packet" (timeline, chat, uploads, hashes, logs)
- Vault content summarizer
- Risk flag explanations (human-readable)
- Sensitive data detection (passport, credit card, SSN)

**API:** `GET /api/rifts/[id]/vault/evidence-packet`

**Usage:**
```typescript
import { generateEvidencePacket, summarizeVaultContent, detectSensitiveData } from '@/lib/vault/intelligence'

const packet = await generateEvidencePacket(riftId)
const summary = await summarizeVaultContent(riftId)
const sensitive = await detectSensitiveData(assetId)
```

### 6. Messaging Intelligence (`lib/ai/messaging-intelligence.ts`)

**Features:**
- Agreement capture (detects when terms agreed in chat)
- Off-platform risk detection (warns about moving to SMS/IG)
- Conflict detection (rising hostility signals)
- Pre-flight checklist for rift creation

**Usage:**
```typescript
import { captureAgreement, detectOffPlatformRisk, detectConflict, generatePreFlightChecklist } from '@/lib/ai/messaging-intelligence'

const agreement = await captureAgreement(riftId)
const offPlatform = await detectOffPlatformRisk(riftId)
const conflict = await detectConflict(riftId)
const checklist = await generatePreFlightChecklist(riftData)
```

### 7. Fraud Ring Detection (`lib/ai/fraud-ring-detection.ts`)

**Features:**
- Clusters accounts by device/IP/payment patterns
- Behavioral trust scoring
- Verification recommendations (3DS, phone verification)

**Usage:**
```typescript
import { detectFraudRings, computeBehavioralTrustScore, getVerificationRecommendations } from '@/lib/ai/fraud-ring-detection'

const rings = await detectFraudRings(userId)
const trust = await computeBehavioralTrustScore(userId)
const verification = await getVerificationRecommendations(riftId)
```

### 8. Dynamic Rules Engine (`lib/ai/dynamic-rules-engine.ts`)

**Features:**
- Adaptive thresholds based on live dispute rates
- Real-time hold windows (adjusts based on risk)
- Smart requirements (AI decides mandatory fields per scenario)

**Usage:**
```typescript
import { getAdaptiveThresholds, getSmartRequirements, calculateHoldWindow } from '@/lib/ai/dynamic-rules-engine'

const thresholds = await getAdaptiveThresholds('TICKETS')
const requirements = await getSmartRequirements(riftId)
const holdWindow = await calculateHoldWindow(riftId)
```

### 9. Buyer Protection UX (`lib/buyer/protection-assistant.ts`)

**Features:**
- "What proof should I ask for?" assistant
- Pre-flight checklist (detects missing fields)
- Auto-fill from screenshots/links

**Usage:**
```typescript
import { getProofRecommendations, runPreFlightChecklist, autoFillFromProof } from '@/lib/buyer/protection-assistant'

const recommendations = await getProofRecommendations('TICKETS')
const checklist = await runPreFlightChecklist(riftData)
const autoFill = await autoFillFromProof(assetId)
```

### 10. Seller Enablement (`lib/seller/proof-builder.ts`)

**Features:**
- Proof builder guide (tells sellers what to upload)
- Proof quality scoring (warns if submission is weak)
- Service proof templates

**Usage:**
```typescript
import { scoreProofQuality, getProofBuilderGuide, getServiceProofTemplates } from '@/lib/seller/proof-builder'

const quality = await scoreProofQuality(riftId, assetIds)
const guide = await getProofBuilderGuide('TICKETS')
const templates = getServiceProofTemplates()
```

### 11. Ops & Growth (`lib/ops/fraud-intelligence.ts`)

**Features:**
- Top fraud patterns dashboard
- Churn prediction
- Support copilot

**Usage:**
```typescript
import { getTopFraudPatterns, predictChurn, supportCopilot } from '@/lib/ops/fraud-intelligence'

const patterns = await getTopFraudPatterns(7) // Last 7 days
const churn = await predictChurn(userId)
const support = await supportCopilot(question, userId, riftId)
```

## Integration Points

### Proof Submission Flow
- ✅ AI proof classification integrated
- ✅ Duplicate detection enhanced
- ✅ Risk scoring on submission

### Dispute Creation
- ✅ Sellers can now open disputes
- ✅ Fee disclosure added
- ✅ Triage system ready

### Rift Creation
- ✅ Pre-flight checklist available
- ✅ Proof recommendations available

## Next Steps for Full Implementation

1. **Perceptual Hashing**: Integrate image-hash or similar library
2. **Chat Integration**: Connect messaging intelligence to actual chat system
3. **Device Tracking**: Create device_fingerprints table for fraud ring detection
4. **AI/ML Models**: Train models for proof classification (currently rule-based)
5. **Evidence Packet Export**: Add PDF generation for evidence packets
6. **Admin Dashboard**: Create UI for fraud intelligence dashboard
7. **Real-time Monitoring**: Set up alerts for high-risk transactions

## API Endpoints Created

- `GET /api/rifts/[id]/risk-score` - Get enhanced risk score
- `POST /api/rifts/[id]/proof/classify` - Classify proof assets
- `POST /api/rifts/[id]/dispute/triage` - Triage dispute (admin)
- `GET /api/rifts/[id]/vault/evidence-packet` - Generate evidence packet

## Files Created

1. `lib/ai/enhanced-risk-scoring.ts` - Enhanced risk scoring
2. `lib/ai/proof-classifier.ts` - AI proof classifier
3. `lib/ai/dispute-triage.ts` - Dispute triage automation
4. `lib/vault/intelligence.ts` - Vault intelligence
5. `lib/ai/messaging-intelligence.ts` - Messaging intelligence
6. `lib/ai/fraud-ring-detection.ts` - Fraud ring detection
7. `lib/ai/dynamic-rules-engine.ts` - Dynamic rules engine
8. `lib/buyer/protection-assistant.ts` - Buyer protection UX
9. `lib/seller/proof-builder.ts` - Seller enablement
10. `lib/ops/fraud-intelligence.ts` - Ops & growth
11. `lib/ai/perceptual-hashing.ts` - Perceptual hashing framework

All systems are ready for integration and can be enhanced with actual AI/ML models as needed.

