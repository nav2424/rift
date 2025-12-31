/**
 * Password validation utility
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 */

export interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

export function validatePassword(password: string): {
  valid: boolean
  requirements: PasswordRequirements
  errors: string[]
} {
  const requirements: PasswordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
  }

  const errors: string[] = []
  if (!requirements.minLength) {
    errors.push('Password must be at least 8 characters')
  }
  if (!requirements.hasUppercase) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!requirements.hasLowercase) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!requirements.hasNumber) {
    errors.push('Password must contain at least one number')
  }
  if (!requirements.hasSpecialChar) {
    errors.push('Password must contain at least one special character')
  }

  const valid = Object.values(requirements).every(Boolean)

  return { valid, requirements, errors }
}

