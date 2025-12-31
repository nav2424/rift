# UI Changes Needed for LICENSE_KEYS Support

## Status: ⚠️ Not Yet Implemented

The backend/API changes are complete, but the UI components need to be updated to support `LICENSE_KEYS` as a separate item type.

## Required Changes

### 1. ItemTypeSelection.tsx ⚠️
**File:** `components/ItemTypeSelection.tsx`

**Changes Needed:**
- Add `LICENSE_KEYS` to the `ItemType` type definition (line 7)
- Add LICENSE_KEYS option to `itemTypes` array with appropriate icon, title, description, and features

**Current:**
```typescript
export type ItemType = 'TICKETS' | 'DIGITAL' | 'SERVICES'
```

**Should be:**
```typescript
export type ItemType = 'TICKETS' | 'DIGITAL' | 'SERVICES' | 'LICENSE_KEYS'
```

### 2. CreateRiftForm.tsx ⚠️
**File:** `components/CreateRiftForm.tsx`

**Changes Needed:**
- Add `LICENSE_KEYS` handling in Step 4 (type-specific fields section, around line 1170)
- Add form fields for license key creation (software name, license type, etc.)
- Add validation for LICENSE_KEYS item type
- Update preview section to show LICENSE_KEYS details

**Required Fields (from proof-type-validation.ts):**
- `softwareName` (required)
- `licenseType` (required)

### 3. submit-proof/page.tsx ⚠️
**File:** `app/rifts/[id]/submit-proof/page.tsx`

**Changes Needed:**
- Update `RiftTransaction` interface to include `LICENSE_KEYS` in itemType (line 14)
- Add LICENSE_KEYS case in `getProofTypeText()` function (line 76)
- Add LICENSE_KEYS-specific form fields and validation
- Update submit handler to handle LICENSE_KEYS proof submission

**Current:** Only handles DIGITAL with optional license key
**Needed:** Separate LICENSE_KEYS handling with required softwareName/licenseType fields

### 4. DeliveryStatus.tsx ⚠️
**File:** `components/DeliveryStatus.tsx`

**Changes Needed:**
- Update `itemType` prop type to include `LICENSE_KEYS` (line 9)

**Current:**
```typescript
itemType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES'
```

**Should be:**
```typescript
itemType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES' | 'LICENSE_KEYS'
```

### 5. RiftActions.tsx ⚠️
**File:** `components/RiftActions.tsx`

**Changes Needed:**
- Check if LICENSE_KEYS needs separate handling (may reuse DIGITAL logic)
- Verify action buttons work correctly for LICENSE_KEYS rifts

### 6. VaultAssetsViewer.tsx ✅
**Status:** Already supports LICENSE_KEY asset type for reveals
- No changes needed

## Summary

**Backend:** ✅ Complete
- Schema migration applied
- API endpoints support LICENSE_KEYS
- Proof validation includes LICENSE_KEYS
- Rate limits applied

**Frontend:** ⚠️ Needs Implementation
- Item type selection
- Create rift form
- Proof submission form
- Type definitions

## Next Steps

1. Update ItemTypeSelection.tsx to add LICENSE_KEYS option
2. Add LICENSE_KEYS form section to CreateRiftForm.tsx
3. Update submit-proof page to handle LICENSE_KEYS
4. Update type definitions throughout UI components
5. Test the full flow: Create → Pay → Submit Proof → Reveal Key

---

**Last Updated:** 2025-01-22
