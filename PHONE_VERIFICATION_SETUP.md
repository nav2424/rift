# Phone Verification Setup Guide

## Overview

Phone verification uses **Twilio** to send SMS verification codes to mobile numbers. The system now includes improved phone number formatting to handle various input formats.

## Features

✅ **Automatic Phone Number Formatting**
- Handles various input formats (with/without country code, spaces, dashes, etc.)
- Converts to E.164 format (required by Twilio)
- US/Canada numbers: Automatically adds +1 if missing
- International numbers: Ensures + prefix

✅ **Validation**
- Validates phone number format before sending
- Provides clear error messages
- Handles common formatting issues

✅ **Development Mode**
- Returns verification code in API response (for testing)
- Logs code to console
- Works without Twilio configured (for local testing)

## Setup

### 1. Twilio Account Setup

1. **Sign up for Twilio** at https://www.twilio.com
2. **Get your credentials:**
   - Account SID
   - Auth Token
   - Phone Number (from Twilio)

3. **Add to environment variables:**

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number in E.164 format
```

### 2. Supported Phone Number Formats

The system accepts phone numbers in various formats:

**US/Canada Numbers:**
- `1234567890` → Converts to `+11234567890`
- `(123) 456-7890` → Converts to `+11234567890`
- `123-456-7890` → Converts to `+11234567890`
- `+1 123 456 7890` → Converts to `+11234567890`
- `+11234567890` → Uses as-is

**International Numbers:**
- `+44 20 7946 0958` → Converts to `+442079460958`
- `+33 1 23 45 67 89` → Converts to `+33123456789`
- Must include country code (with + prefix)

## API Endpoints

### POST `/api/verify/phone/send`

Sends a verification code to the provided phone number.

**Request:**
```json
{
  "phone": "1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Verification code sent to your phone",
  "code": "123456"  // Only in development mode
}
```

**Response (Error):**
```json
{
  "error": "Invalid phone number format. Please include country code (e.g., +1 for US/Canada)"
}
```

### POST `/api/verify/phone/verify`

Verifies the phone number with the code.

**Request:**
```json
{
  "code": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Phone number verified successfully"
}
```

## Testing

### Development Mode (Without Twilio)

In development, if Twilio is not configured:
- Code is logged to console
- Code is returned in API response
- No actual SMS is sent

Example console output:
```
📱 SMS verification code for +11234567890: 123456
⚠️ Twilio not configured. SMS not sent: SMS service not configured
```

### Production Mode

In production, Twilio credentials are required:
- SMS is actually sent via Twilio
- Code is NOT returned in API response
- Returns error if SMS fails

## Phone Number Formatting

The system uses E.164 format for storage and SMS sending:

**E.164 Format:**
- Starts with `+`
- Followed by country code
- Followed by subscriber number
- Maximum 15 digits total
- Example: `+11234567890` (US), `+442079460958` (UK)

**Automatic Conversions:**

| Input | Output | Notes |
|-------|--------|-------|
| `1234567890` | `+11234567890` | 10 digits → Assumes US (+1) |
| `11234567890` | `+11234567890` | 11 digits starting with 1 → US |
| `+11234567890` | `+11234567890` | Already formatted |
| `(123) 456-7890` | `+11234567890` | Removes formatting |
| `123-456-7890` | `+11234567890` | Removes dashes |
| `+44 20 7946 0958` | `+442079460958` | International format |

## Error Handling

### Common Errors

**"Invalid phone number format"**
- Phone number doesn't match expected patterns
- Solution: Include country code (e.g., +1 for US/Canada)

**"Invalid international phone number format"**
- International number doesn't have proper format
- Solution: Ensure it starts with + and country code

**"Phone number cannot receive SMS messages"**
- Twilio error (e.g., landline number, blocked number)
- Solution: Use a valid mobile number

**"SMS service not configured"**
- Twilio credentials missing
- Solution: Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to environment variables

## Implementation Details

### Phone Number Validation

The system validates phone numbers using these rules:

1. **Removes formatting** (spaces, dashes, parentheses)
2. **Detects format:**
   - Starts with `+` → International format
   - 10 digits → US number (adds +1)
   - 11 digits starting with 1 → US number (adds +)
   - Other → Attempts to add + prefix

3. **Validates E.164 format:**
   - Must match `/^\+\d{1,15}$/` (starts with +, followed by 1-15 digits)

### Storage

Phone numbers are stored in the database in **E.164 format** for consistency:
- Easy to compare
- Compatible with Twilio
- Standard international format

### Code Generation

Verification codes:
- 6 digits
- Expires in 15 minutes
- One-time use
- Tied to user ID and phone number

## Production Checklist

- [ ] Twilio account created
- [ ] Twilio credentials added to environment variables
- [ ] Twilio phone number verified
- [ ] Test SMS sending works
- [ ] Test verification flow end-to-end
- [ ] Verify phone numbers are stored in E.164 format
- [ ] Test with various phone number formats
- [ ] Test with international numbers (if needed)

## Troubleshooting

**SMS not being sent:**
1. Check Twilio credentials are set correctly
2. Verify Twilio phone number is in E.164 format
3. Check Twilio account balance (if on pay-as-you-go)
4. Verify phone number is valid and can receive SMS
5. Check Vercel logs for error messages

**Invalid format errors:**
1. Ensure phone number includes country code
2. For US/Canada, you can omit +1 (system adds it automatically)
3. For international, must include country code with + prefix
4. Remove any special characters except +

**Code not received:**
1. Check spam folder (some carriers filter SMS)
2. Verify phone number is correct
3. Check Twilio logs in dashboard
4. Ensure phone number can receive SMS (not landline)

---

**Need Help?**
- Twilio Documentation: https://www.twilio.com/docs
- E.164 Format: https://en.wikipedia.org/wiki/E.164
- Check server logs for detailed error messages

