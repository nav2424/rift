/**
 * User Factory
 * Creates test users (buyers, sellers, admins)
 */

import { randomUUID } from 'crypto'

export interface UserFactoryOptions {
  email?: string
  name?: string
  role?: 'USER' | 'ADMIN'
  emailVerified?: boolean
  phoneVerified?: boolean
  idVerified?: boolean
}

export function createTestUser(options: UserFactoryOptions = {}) {
  const id = randomUUID()
  const email = options.email || `test-${id.substring(0, 8)}@test.com`
  
  return {
    id,
    email,
    name: options.name || 'Test User',
    role: options.role || 'USER',
    emailVerified: options.emailVerified ?? true,
    phoneVerified: options.phoneVerified ?? true,
    idVerified: options.idVerified ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function createTestBuyer(email?: string) {
  return createTestUser({
    email: email || 'buyer@test.com',
    name: 'Test Buyer',
    role: 'USER',
  })
}

export function createTestSeller(email?: string) {
  return createTestUser({
    email: email || 'seller@test.com',
    name: 'Test Seller',
    role: 'USER',
  })
}

export function createTestAdmin(email?: string) {
  return createTestUser({
    email: email || 'admin@test.com',
    name: 'Test Admin',
    role: 'ADMIN',
  })
}

export function createTestUnverifiedUser() {
  return createTestUser({
    email: 'unverified@test.com',
    emailVerified: false,
    phoneVerified: false,
  })
}

