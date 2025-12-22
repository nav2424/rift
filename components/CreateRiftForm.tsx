'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'
import { ItemType } from './ItemTypeSelection'
import { calculateBuyerFee, calculateSellerFee, calculateSellerNet, calculateBuyerTotal } from '@/lib/fees'
import { useToast } from './ui/Toast'

interface User {
  id: string
  name: string | null
  email: string
  riftUserId: string | null
}

interface CreateEscrowFormProps {
  users: User[]
  itemType: ItemType
  creatorRole: 'BUYER' | 'SELLER'
}

export default function CreateEscrowForm({ users, itemType, creatorRole }: CreateEscrowFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState({
    itemTitle: '',
    itemDescription: '',
    amount: '',
    currency: 'CAD',
    sellerId: '',
    sellerEmail: '',
    buyerId: '',
    buyerEmail: '',
    notes: '',
    // Type-specific fields
    eventDate: '',
    venue: '',
    transferMethod: '',
    downloadLink: '',
    licenseKey: '',
    serviceDate: '',
    quantity: '1', // For tickets
  })

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  
  // Total steps: Basic Info, Payment, Partner, Type-specific, Review
  const totalSteps = 5

  // Character limits
  const TITLE_MAX_LENGTH = 100
  const DESCRIPTION_MAX_LENGTH = 1000
  const AMOUNT_MIN = 5
  const AMOUNT_MAX = 100000

  // Currency symbols mapping
  const currencySymbols: Record<string, string> = {
    CAD: '$',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AUD: '$',
    JPY: '¥',
  }

  // Reduced currencies (most common)
  const currencies = [
    { value: 'CAD', label: 'CAD - Canadian Dollar' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'AUD', label: 'AUD - Australian Dollar' },
    { value: 'JPY', label: 'JPY - Japanese Yen' },
  ]

  // Validation functions
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'itemTitle':
        if (!value.trim()) return 'Item title is required'
        if (value.length > TITLE_MAX_LENGTH) return `Title must be ${TITLE_MAX_LENGTH} characters or less`
        return ''
      case 'itemDescription':
        if (!value.trim()) return 'Description is required'
        if (value.length > DESCRIPTION_MAX_LENGTH) return `Description must be ${DESCRIPTION_MAX_LENGTH} characters or less`
        return ''
      case 'amount':
        if (!value) return 'Amount is required'
        const num = parseFloat(value)
        if (isNaN(num) || num <= 0) return 'Amount must be a positive number'
        if (num < AMOUNT_MIN) return `Minimum amount is ${currencySymbols[formData.currency] || ''}${AMOUNT_MIN}`
        if (num > AMOUNT_MAX) return `Maximum amount is ${currencySymbols[formData.currency] || ''}${AMOUNT_MAX.toLocaleString()}`
        return ''
      case 'downloadLink':
        if (itemType === 'DIGITAL' && !value.trim()) return 'Download link is required'
        if (value && !/^https?:\/\/.+/.test(value)) return 'Please enter a valid URL (must start with http:// or https://)'
        return ''
      case 'eventDate':
        if (itemType === 'TICKETS' && !value) return 'Event date is required'
        if (value) {
          const selectedDate = new Date(value)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          if (selectedDate < today) return 'Event date must be in the future'
        }
        return ''
      case 'venue':
        if (itemType === 'TICKETS' && !value.trim()) return 'Venue is required'
        return ''
      case 'transferMethod':
        if (itemType === 'TICKETS' && !value) return 'Transfer method is required'
        return ''
      case 'serviceDate':
        if (itemType === 'SERVICES' && !value.trim()) return 'Service date/timeline is required'
        return ''
      default:
        return ''
    }
  }

  // Auto-save draft to localStorage
  const DRAFT_KEY = `rift-draft-${itemType}-${creatorRole}`
  
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFormData(parsed)
      } catch (e) {
        console.error('Failed to load draft:', e)
      }
    }
  }, [DRAFT_KEY])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
    }, 1000)
    return () => clearTimeout(timer)
  }, [formData, DRAFT_KEY])

  // Search by Rift User ID (exact match only)
  const searchUsers = useCallback(
    async (query: string) => {
      // Require exact Rift User ID format (e.g., RIFT111111)
      if (!query || query.trim().length === 0) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      setSearchLoading(true)
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          // Only show results if exact match found
          setSearchResults(data.users || [])
          setShowResults(data.users && data.users.length > 0)
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
        setShowResults(false)
        showToast('Failed to search users. Please try again.', 'error')
      } finally {
        setSearchLoading(false)
      }
    },
    []
  )

  // Search when user stops typing (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery)
      } else {
        setSearchResults([])
        setShowResults(false)
      }
    }, 500) // Longer debounce for exact match

    return () => clearTimeout(timer)
  }, [searchQuery, searchUsers])

  // Handle user selection
  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setSearchQuery(user.riftUserId || '')
    setShowResults(false)
    if (creatorRole === 'BUYER') {
      setFormData({ ...formData, sellerId: user.id, sellerEmail: user.email })
    } else {
      setFormData({ ...formData, buyerId: user.id, buyerEmail: user.email })
    }
  }

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedUser(null)
    setShowResults(false)
    if (creatorRole === 'BUYER') {
      setFormData({ ...formData, sellerId: '', sellerEmail: '' })
    } else {
      setFormData({ ...formData, buyerId: '', buyerEmail: '' })
    }
  }

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate all fields
    const allErrors: Record<string, string> = {}
    Object.keys(formData).forEach((key) => {
      if (key === 'quantity' && itemType !== 'TICKETS') return // Skip quantity for non-tickets
      if (key === 'licenseKey') return // Optional field
      if (key === 'notes') return // Optional field
      if (key === 'sellerId' || key === 'sellerEmail' || key === 'buyerId' || key === 'buyerEmail') return // Handled separately
      
      const error = validateField(key, formData[key as keyof typeof formData] as string)
      if (error) allErrors[key] = error
    })
    
    // Validate partner selection
    const hasSeller = creatorRole === 'BUYER' && (formData.sellerId || selectedUser)
    const hasBuyer = creatorRole === 'SELLER' && (formData.buyerId || selectedUser)
    
    if (creatorRole === 'BUYER' && !hasSeller) {
      allErrors.partner = 'Please search and select a seller'
    }
    if (creatorRole === 'SELLER' && !hasBuyer) {
      allErrors.partner = 'Please search and select a buyer'
    }
    
    // Validate terms acceptance
    if (!acceptedTerms) {
      allErrors.terms = 'You must accept the terms of service'
    }
    
    setErrors(allErrors)
    
    if (Object.keys(allErrors).length > 0) {
      showToast('Please fix all errors before submitting', 'error')
      return
    }
    
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to create this rift?\n\n` +
      `Item: ${formData.itemTitle}\n` +
      `Amount: ${currencySymbols[formData.currency] || formData.currency}${parseFloat(formData.amount).toFixed(2)}\n` +
      `${creatorRole === 'BUYER' ? 'Seller' : 'Buyer'}: ${selectedUser?.name || 'User'}\n\n` +
      `This action cannot be undone.`
    )
    
    if (!confirmed) {
      return
    }
    
    setLoading(true)

    try {
      // Verify authentication before submitting
      const authCheck = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      
      if (!authCheck.ok) {
        setLoading(false)
        showToast('Your session has expired. Please sign in again.', 'error')
        router.push('/auth/signin')
        return
      }

      const payload: any = {
        itemTitle: formData.itemTitle,
        itemDescription: formData.itemDescription,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        itemType,
        creatorRole,
        notes: formData.notes || null,
      }

      // Set buyer/seller based on creator role
      if (creatorRole === 'BUYER') {
        // User is buyer, they select seller
        payload.sellerId = formData.sellerId
        payload.sellerEmail = formData.sellerEmail
        payload.buyerId = session?.user?.id
      } else {
        // User is seller, they select buyer
        payload.buyerId = formData.buyerId
        payload.buyerEmail = formData.buyerEmail
        payload.sellerId = session?.user?.id
      }

      // Add type-specific fields
      if (itemType === 'TICKETS') {
        payload.eventDate = formData.eventDate
        payload.venue = formData.venue
        payload.transferMethod = formData.transferMethod
        payload.quantity = parseInt(formData.quantity) || 1
      } else if (itemType === 'DIGITAL') {
        payload.downloadLink = formData.downloadLink
        payload.licenseKey = formData.licenseKey || null
      } else if (itemType === 'SERVICES') {
        payload.serviceDate = formData.serviceDate
      }

      const response = await fetch('/api/rifts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let error: any = {}
        try {
          error = await response.json()
        } catch (parseError) {
          error = { error: response.statusText || 'Failed to create rift' }
        }
        
        const errorMessage = error.error || error.message || 'Failed to create rift'
        console.error('Rift creation error:', {
          status: response.status,
          error: errorMessage,
          statusText: response.statusText,
          details: error.details,
        })
        
        if (response.status === 401) {
          showToast('You are not authenticated. Please sign in again.', 'error')
          router.push('/auth/signin')
        } else {
          showToast(errorMessage, 'error')
        }
        setLoading(false)
        return
      }

      const data = await response.json()
      
      // Clear draft on success
      localStorage.removeItem(DRAFT_KEY)
      
      showToast('Rift created successfully!', 'success')
      router.push(`/rifts/${data.escrowId}`)
    } catch (error) {
      console.error('Error creating rift:', error)
      showToast('Failed to create rift. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Step validation
  const validateStep = (step: number): boolean => {
    const stepErrors: Record<string, string> = {}
    
    switch (step) {
      case 1: // Basic Information
        const titleError = validateField('itemTitle', formData.itemTitle)
        const descError = validateField('itemDescription', formData.itemDescription)
        if (titleError) stepErrors.itemTitle = titleError
        if (descError) stepErrors.itemDescription = descError
        break
      case 2: // Payment
        const amountError = validateField('amount', formData.amount)
        if (amountError) stepErrors.amount = amountError
        break
      case 3: // Partner
        const hasSeller = creatorRole === 'BUYER' && (formData.sellerId || selectedUser)
        const hasBuyer = creatorRole === 'SELLER' && (formData.buyerId || selectedUser)
        if (creatorRole === 'BUYER' && !hasSeller) stepErrors.partner = 'Please select a seller'
        if (creatorRole === 'SELLER' && !hasBuyer) stepErrors.partner = 'Please select a buyer'
        break
      case 4: // Type-specific
        if (itemType === 'TICKETS') {
          const dateError = validateField('eventDate', formData.eventDate)
          const venueError = validateField('venue', formData.venue)
          const methodError = validateField('transferMethod', formData.transferMethod)
          if (dateError) stepErrors.eventDate = dateError
          if (venueError) stepErrors.venue = venueError
          if (methodError) stepErrors.transferMethod = methodError
        } else if (itemType === 'DIGITAL') {
          const linkError = validateField('downloadLink', formData.downloadLink)
          if (linkError) stepErrors.downloadLink = linkError
        } else if (itemType === 'SERVICES') {
          const serviceError = validateField('serviceDate', formData.serviceDate)
          if (serviceError) stepErrors.serviceDate = serviceError
        }
        break
    }
    
    setErrors({ ...errors, ...stepErrors })
    return Object.keys(stepErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, totalSteps))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      showToast('Please fix the errors before continuing', 'error')
    }
  }

  const handleBack = () => {
    setCurrentStep(Math.max(currentStep - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stepLabels = [
    'Basic Information',
    'Payment Details',
    'Partner Selection',
    itemType === 'TICKETS' ? 'Event Details' : itemType === 'DIGITAL' ? 'Delivery Details' : 'Service Details',
    'Review & Submit'
  ]

  return (
    <GlassCard variant="glass" className="p-8 lg:p-10">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {stepLabels.map((label, index) => {
            const stepNum = index + 1
            const isActive = stepNum === currentStep
            const isCompleted = stepNum < currentStep
            return (
              <div key={stepNum} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : isActive
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span className={`text-xs font-light mt-2 text-center ${isActive ? 'text-white' : 'text-white/40'}`}>
                    {label}
                  </span>
                </div>
                {stepNum < totalSteps && (
                  <div className={`flex-1 h-0.5 mx-2 ${stepNum < currentStep ? 'bg-green-500/50' : 'bg-white/10'}`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="text-center">
          <p className="text-sm text-white/60 font-light">
            Step {currentStep} of {totalSteps}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Basic Information</h2>
            </div>

          <div>
            <label className="block text-sm font-light text-white/80 mb-3">
              Item Title *
              <span className="ml-2 text-xs text-white/50 font-light">
                ({formData.itemTitle.length}/{TITLE_MAX_LENGTH} characters)
              </span>
            </label>
            <input
              type="text"
              required
              maxLength={TITLE_MAX_LENGTH}
              value={formData.itemTitle}
              onChange={(e) => {
                setFormData({ ...formData, itemTitle: e.target.value })
                const error = validateField('itemTitle', e.target.value)
                setErrors({ ...errors, itemTitle: error })
              }}
              onBlur={(e) => {
                const error = validateField('itemTitle', e.target.value)
                setErrors({ ...errors, itemTitle: error })
              }}
              className={`w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all font-light ${
                errors.itemTitle 
                  ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                  : 'border-white/10 focus:ring-white/20 focus:border-white/20'
              }`}
              placeholder={
                itemType === 'TICKETS' ? 'e.g., Taylor Swift Concert Tickets' :
                itemType === 'DIGITAL' ? 'e.g., Premium Software License' :
                'e.g., Web Development Service'
              }
            />
            {errors.itemTitle && (
              <p className="mt-2 text-sm text-red-400 font-light">{errors.itemTitle}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-light text-white/80 mb-3">
              Description *
              <span className="ml-2 text-xs text-white/50 font-light">
                ({formData.itemDescription.length}/{DESCRIPTION_MAX_LENGTH} characters)
              </span>
            </label>
            <textarea
              required
              maxLength={DESCRIPTION_MAX_LENGTH}
              value={formData.itemDescription}
              onChange={(e) => {
                setFormData({ ...formData, itemDescription: e.target.value })
                const error = validateField('itemDescription', e.target.value)
                setErrors({ ...errors, itemDescription: error })
              }}
              onBlur={(e) => {
                const error = validateField('itemDescription', e.target.value)
                setErrors({ ...errors, itemDescription: error })
              }}
              className={`w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all resize-none font-light ${
                errors.itemDescription 
                  ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                  : 'border-white/10 focus:ring-white/20 focus:border-white/20'
              }`}
              rows={5}
              placeholder="Describe the item in detail..."
            />
            {errors.itemDescription && (
              <p className="mt-2 text-sm text-red-400 font-light">{errors.itemDescription}</p>
            )}
          </div>
          </div>
        )}

        {/* Step 2: Payment Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-light text-white">Payment Details</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Transaction Amount (Subtotal) *
                <span className="ml-2 text-xs text-white/50 font-light">
                  Min: {currencySymbols[formData.currency] || ''}{AMOUNT_MIN}, Max: {currencySymbols[formData.currency] || ''}{AMOUNT_MAX.toLocaleString()}
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/60 font-light">
                  {currencySymbols[formData.currency] || ''}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min={AMOUNT_MIN}
                  max={AMOUNT_MAX}
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: e.target.value })
                    const error = validateField('amount', e.target.value)
                    setErrors({ ...errors, amount: error })
                  }}
                  onBlur={(e) => {
                    const error = validateField('amount', e.target.value)
                    setErrors({ ...errors, amount: error })
                  }}
                  className={`w-full pl-8 pr-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all font-light ${
                    errors.amount 
                      ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                      : 'border-white/10 focus:ring-white/20 focus:border-white/20'
                  }`}
                  placeholder="0.00"
                />
              </div>
              {errors.amount && (
                <p className="mt-2 text-sm text-red-400 font-light">{errors.amount}</p>
              )}
              {formData.amount && parseFloat(formData.amount) > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60 font-light mb-3 uppercase tracking-wider">Fee Breakdown</p>
                  {creatorRole === 'BUYER' ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 font-light text-sm">Listed Price</span>
                        <span className="text-white font-light">{currencySymbols[formData.currency] || formData.currency} {parseFloat(formData.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 font-light text-sm">Processing Fee (3%)</span>
                        <span className="text-white/70 font-light">+{currencySymbols[formData.currency] || formData.currency} {calculateBuyerFee(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-white font-light">You Pay</span>
                        <span className="text-green-400 font-light text-lg">{currencySymbols[formData.currency] || formData.currency} {calculateBuyerTotal(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 font-light text-sm">Transaction Amount</span>
                        <span className="text-white font-light">{currencySymbols[formData.currency] || formData.currency} {parseFloat(formData.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 font-light text-sm">Platform Fee (5%)</span>
                        <span className="text-white/70 font-light">-{currencySymbols[formData.currency] || formData.currency} {calculateSellerFee(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-white font-light">You Receive</span>
                        <span className="text-green-400 font-light text-lg">{currencySymbols[formData.currency] || formData.currency} {calculateSellerNet(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-green-400/80 font-light mt-2 text-center">
                        You keep 95% of the transaction
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Currency *
              </label>
              <select
                required
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1rem center',
                  paddingRight: '2.5rem',
                }}
              >
                {currencies.map((curr) => (
                  <option key={curr.value} value={curr.value} className="bg-black text-white">
                    {curr.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </div>
        )}

        {/* Step 3: Partner Selection */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-light text-white">
                  {creatorRole === 'BUYER' ? 'Seller Information' : 'Buyer Information'}
                </h2>
                <p className="text-sm text-white/60 font-light mt-1">
                  {creatorRole === 'BUYER' 
                    ? "You are the buyer. Enter the seller's Rift User ID to create a rift."
                    : "You are the seller. Enter the buyer's Rift User ID to create a rift."}
                </p>
              </div>
            </div>

            <div className="relative" ref={searchRef}>
            <label className="block text-sm font-light text-white/80 mb-3">
              {creatorRole === 'BUYER' ? "Seller's Rift User ID *" : "Buyer's Rift User ID *"}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value.toUpperCase())}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setShowResults(true)
                  }
                }}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light font-mono"
                placeholder={creatorRole === 'BUYER' 
                  ? "Enter seller's Rift User ID (e.g., RIFT111111)"
                  : "Enter buyer's Rift User ID (e.g., RIFT111111)"}
                required
              />
              {searchLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user)}
                      className="w-full px-5 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="text-white font-light">{user.name || 'User'}</span>
                        <span className="text-white/60 text-sm font-light font-mono">{user.riftUserId || 'No Rift ID'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected User Display */}
            {selectedUser && (
              <div className="mt-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-light">{selectedUser.name || 'User'}</p>
                    <p className="text-white/60 text-sm font-light font-mono">{selectedUser.riftUserId || 'No Rift ID'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null)
                      setSearchQuery('')
                      if (creatorRole === 'BUYER') {
                        setFormData({ ...formData, sellerId: '', sellerEmail: '' })
                      } else {
                        setFormData({ ...formData, buyerId: '', buyerEmail: '' })
                      }
                    }}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* No Results Message */}
            {showResults && searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
              <div className="mt-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-white/60 text-sm font-light">
                  No user found with Rift User ID "{searchQuery}". The {creatorRole === 'BUYER' ? 'seller' : 'buyer'} must have a valid Rift User ID.
                </p>
              </div>
            )}

            {/* Info Message / Help Text */}
            {!selectedUser && !searchQuery.trim() && (
              <p className="text-xs text-white/60 mt-3 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong className="text-white/80">How to find a Rift User ID:</strong> Ask the {creatorRole === 'BUYER' ? 'seller' : 'buyer'} for their Rift User ID. It looks like <code className="bg-white/10 px-1 rounded font-mono">RIFT111111</code>. Only exact matches will appear in search results.
                </span>
              </p>
            )}
          </div>
          </div>
        )}

        {/* Step 4: Type-specific fields */}
        {currentStep === 4 && (
          <>
            {itemType === 'TICKETS' && (
              <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4v-3a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Event Details</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-light text-white/80 mb-3">
                  Event Date *
                  <span className="ml-2 text-xs text-white/50 font-light">
                    Must be in the future
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.eventDate}
                    onChange={(e) => {
                      setFormData({ ...formData, eventDate: e.target.value })
                      const error = validateField('eventDate', e.target.value)
                      setErrors({ ...errors, eventDate: error })
                    }}
                    onBlur={(e) => {
                      const error = validateField('eventDate', e.target.value)
                      setErrors({ ...errors, eventDate: error })
                    }}
                    className={`w-full px-5 py-3.5 pr-12 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all font-light date-input-visible ${
                      errors.eventDate 
                        ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                        : 'border-white/10 focus:ring-white/20 focus:border-white/20'
                    }`}
                    style={{
                      colorScheme: 'dark',
                    }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                {errors.eventDate && (
                  <p className="mt-2 text-sm text-red-400 font-light">{errors.eventDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-light text-white/80 mb-3">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => {
                    setFormData({ ...formData, venue: e.target.value })
                    const error = validateField('venue', e.target.value)
                    setErrors({ ...errors, venue: error })
                  }}
                  onBlur={(e) => {
                    const error = validateField('venue', e.target.value)
                    setErrors({ ...errors, venue: error })
                  }}
                  className={`w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all font-light ${
                    errors.venue 
                      ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                      : 'border-white/10 focus:ring-white/20 focus:border-white/20'
                  }`}
                  placeholder="e.g., Rogers Centre, Toronto"
                />
                {errors.venue && (
                  <p className="mt-2 text-sm text-red-400 font-light">{errors.venue}</p>
                )}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-light text-white/80 mb-3">
                  Quantity *
                  <span className="ml-2 text-xs text-white/50 font-light">
                    Number of tickets
                  </span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-light text-white/80 mb-3">
                  Transfer Method *
                </label>
                <select
                  required
                  value={formData.transferMethod}
                  onChange={(e) => {
                    setFormData({ ...formData, transferMethod: e.target.value })
                    const error = validateField('transferMethod', e.target.value)
                    setErrors({ ...errors, transferMethod: error })
                  }}
                  onBlur={(e) => {
                    const error = validateField('transferMethod', e.target.value)
                    setErrors({ ...errors, transferMethod: error })
                  }}
                  className={`w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white focus:outline-none focus:ring-2 transition-all font-light ${
                    errors.transferMethod 
                      ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                      : 'border-white/10 focus:ring-white/20 focus:border-white/20'
                  }`}
                >
                  <option value="" className="bg-black/90">Select transfer method...</option>
                  <option value="email" className="bg-black/90">Email Transfer</option>
                  <option value="mobile_app" className="bg-black/90">Mobile App (Ticketmaster, etc.)</option>
                  <option value="pdf" className="bg-black/90">PDF Download</option>
                  <option value="other" className="bg-black/90">Other</option>
                </select>
                {errors.transferMethod && (
                  <p className="mt-2 text-sm text-red-400 font-light">{errors.transferMethod}</p>
                )}
              </div>
            </div>
              </div>
            )}

            {itemType === 'DIGITAL' && (
              <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Delivery Details</h2>
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Download Link *
                <span className="ml-2 text-xs text-white/50 font-light">
                  Must be a valid URL (http:// or https://)
                </span>
              </label>
              <input
                type="url"
                required
                value={formData.downloadLink}
                onChange={(e) => {
                  setFormData({ ...formData, downloadLink: e.target.value })
                  const error = validateField('downloadLink', e.target.value)
                  setErrors({ ...errors, downloadLink: error })
                }}
                onBlur={(e) => {
                  const error = validateField('downloadLink', e.target.value)
                  setErrors({ ...errors, downloadLink: error })
                }}
                className={`w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all font-light ${
                  errors.downloadLink 
                    ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                    : 'border-white/10 focus:ring-white/20 focus:border-white/20'
                }`}
                placeholder="https://example.com/download"
              />
              {errors.downloadLink && (
                <p className="mt-2 text-sm text-red-400 font-light">{errors.downloadLink}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                License Key <span className="text-white/50">(if applicable)</span>
              </label>
              <input
                type="text"
                value={formData.licenseKey}
                onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                placeholder="Enter license key..."
              />
            </div>
          </div>
            )}

            {itemType === 'SERVICES' && (
              <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Service Details</h2>
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Service Date / Timeline *
              </label>
              <input
                type="text"
                required
                value={formData.serviceDate}
                onChange={(e) => {
                  setFormData({ ...formData, serviceDate: e.target.value })
                  const error = validateField('serviceDate', e.target.value)
                  setErrors({ ...errors, serviceDate: error })
                }}
                onBlur={(e) => {
                  const error = validateField('serviceDate', e.target.value)
                  setErrors({ ...errors, serviceDate: error })
                }}
                className={`w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all font-light ${
                  errors.serviceDate 
                    ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50' 
                    : 'border-white/10 focus:ring-white/20 focus:border-white/20'
                }`}
                placeholder="e.g., January 15, 2024 or Within 2 weeks"
              />
              {errors.serviceDate && (
                <p className="mt-2 text-sm text-red-400 font-light">{errors.serviceDate}</p>
              )}
            </div>
              </div>
            )}
          </>
        )}

        {/* Step 5: Review & Submit */}
        {currentStep === 5 && (
          <div className="space-y-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center shadow-lg shadow-black/20">
                <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-light text-white mb-1">Review & Submit</h2>
                <p className="text-white/50 font-light text-sm">Please review all details before creating your rift</p>
              </div>
            </div>

            {/* Review Summary - Enhanced Design */}
            <div className="space-y-0 p-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
              {/* Item Section */}
              <div className="p-6 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs text-white/50 font-light uppercase tracking-widest mb-3">Item</h4>
                    <p className="text-white font-light text-xl mb-2">{formData.itemTitle}</p>
                    <p className="text-white/60 text-sm font-light leading-relaxed">{formData.itemDescription}</p>
                  </div>
                </div>
              </div>
              
              {/* Payment Section */}
              <div className="p-6 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs text-white/50 font-light uppercase tracking-widest mb-3">Payment</h4>
                    <p className="text-white font-light text-2xl mb-2">
                      {currencySymbols[formData.currency] || formData.currency} {parseFloat(formData.amount || '0').toFixed(2)} {formData.currency}
                    </p>
                    {creatorRole === 'BUYER' ? (
                      <div className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <p className="text-green-300 text-sm font-light whitespace-nowrap">
                          You'll pay: <span className="font-medium">{currencySymbols[formData.currency] || formData.currency} {formData.amount ? calculateBuyerTotal(parseFloat(formData.amount)).toFixed(2) : '0.00'}</span> (includes 3% fee)
                        </p>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <p className="text-green-300 text-sm font-light whitespace-nowrap">
                          You'll receive: <span className="font-medium">{currencySymbols[formData.currency] || formData.currency} {formData.amount ? calculateSellerNet(parseFloat(formData.amount)).toFixed(2) : '0.00'}</span> (after 5% platform fee)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Partner Section */}
              <div className="p-6 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs text-white/50 font-light uppercase tracking-widest mb-3">{creatorRole === 'BUYER' ? 'Seller' : 'Buyer'}</h4>
                    <p className="text-white font-light text-lg mb-1">{selectedUser?.name || 'User'}</p>
                    <p className="text-white/50 text-sm font-light font-mono">{selectedUser?.riftUserId}</p>
                  </div>
                </div>
              </div>
              
              {/* Type-specific Details */}
              {itemType === 'TICKETS' && (
                <div className="p-6 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4v-3a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs text-white/50 font-light uppercase tracking-widest mb-3">Event Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-white/50 text-xs font-light mb-1">Date</p>
                          <p className="text-white font-light">{formData.eventDate ? new Date(formData.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs font-light mb-1">Venue</p>
                          <p className="text-white font-light">{formData.venue || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs font-light mb-1">Quantity</p>
                          <p className="text-white font-light">{formData.quantity} {formData.quantity === '1' ? 'ticket' : 'tickets'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs font-light mb-1">Transfer</p>
                          <p className="text-white font-light capitalize">{formData.transferMethod?.replace('_', ' ') || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {itemType === 'DIGITAL' && (
                <div className="p-6 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs text-white/50 font-light uppercase tracking-widest mb-3">Delivery</h4>
                      <p className="text-white font-light break-all mb-3">{formData.downloadLink || 'Not set'}</p>
                      {formData.licenseKey && (
                        <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-white/50 text-xs font-light mb-1">License Key</p>
                          <p className="text-white font-light font-mono text-sm">{formData.licenseKey}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {itemType === 'SERVICES' && (
                <div className="p-6 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs text-white/50 font-light uppercase tracking-widest mb-3">Service Timeline</h4>
                      <p className="text-white font-light text-lg">{formData.serviceDate || 'Not set'}</p>
                    </div>
                  </div>
                </div>
              )}

              {formData.notes && (
                <div className="p-6 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs text-white/50 font-light uppercase tracking-widest mb-3">Additional Notes</h4>
                      <p className="text-white/70 text-sm font-light leading-relaxed">{formData.notes}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl">
              <label className="block text-sm font-light text-white/80 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Additional Notes <span className="text-white/50 font-light">(optional)</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all resize-none font-light"
                rows={3}
                placeholder="Any additional information or special instructions..."
              />
            </div>

            {/* Terms Acceptance - Enhanced */}
            <div className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/5 border border-blue-500/20 rounded-2xl">
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-white/30 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/30 cursor-pointer transition-all checked:bg-blue-500/20 checked:border-blue-400/50"
                  />
                  {acceptedTerms && (
                    <svg className="absolute top-0.5 left-0.5 w-4 h-4 text-blue-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm text-white/80 font-light leading-relaxed block">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" className="text-blue-400 hover:text-blue-300 underline transition-colors">
                      Terms of Service
                    </a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline transition-colors">
                      Privacy Policy
                    </a>
                    . I understand that Rift facilitates protected transactions and charges fees as displayed.
                  </span>
                  {!acceptedTerms && Object.keys(errors).length === 0 && (
                    <p className="mt-3 text-sm text-red-400/80 font-light flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      You must accept the terms to create a rift
                    </p>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-8 flex gap-4 border-t border-white/10">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white font-light flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 px-6 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all text-white font-light flex items-center justify-center gap-2"
            >
              Next
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <PremiumButton 
              type="submit" 
              disabled={loading || !acceptedTerms} 
              variant="outline"
              className="flex-1 py-3 text-base backdrop-blur-xl bg-white/[0.06] border border-white/20 hover:border-white/30 hover:bg-white/10 transition-all duration-300 font-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Rift...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <span>Create Rift</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              )}
            </PremiumButton>
          )}
        </div>

        {/* Form Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-black/95 border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-light text-white">Review Your Rift</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm text-white/60 font-light mb-2">Item</h4>
                  <p className="text-white font-light">{formData.itemTitle}</p>
                  <p className="text-white/70 text-sm font-light mt-2">{formData.itemDescription}</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-white/60 font-light mb-2">Amount</h4>
                  <p className="text-white font-light text-lg">
                    {currencySymbols[formData.currency] || formData.currency} {parseFloat(formData.amount).toFixed(2)} {formData.currency}
                  </p>
                  {creatorRole === 'BUYER' ? (
                    <p className="text-white/60 text-sm font-light mt-1">
                      You'll pay: {currencySymbols[formData.currency] || formData.currency} {calculateBuyerTotal(parseFloat(formData.amount)).toFixed(2)} (includes 3% fee)
                    </p>
                  ) : (
                    <p className="text-white/60 text-sm font-light mt-1">
                      You'll receive: {currencySymbols[formData.currency] || formData.currency} {calculateSellerNet(parseFloat(formData.amount)).toFixed(2)} (after 5% platform fee)
                    </p>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm text-white/60 font-light mb-2">{creatorRole === 'BUYER' ? 'Seller' : 'Buyer'}</h4>
                  <p className="text-white font-light">{selectedUser?.name || 'User'}</p>
                  <p className="text-white/60 text-sm font-light font-mono">{selectedUser?.riftUserId}</p>
                </div>
                
                {itemType === 'TICKETS' && (
                  <div>
                    <h4 className="text-sm text-white/60 font-light mb-2">Event Details</h4>
                    <p className="text-white font-light">Date: {new Date(formData.eventDate).toLocaleDateString()}</p>
                    <p className="text-white font-light">Venue: {formData.venue}</p>
                    <p className="text-white font-light">Quantity: {formData.quantity}</p>
                    <p className="text-white font-light">Transfer: {formData.transferMethod}</p>
                  </div>
                )}
                
                {itemType === 'DIGITAL' && (
                  <div>
                    <h4 className="text-sm text-white/60 font-light mb-2">Delivery</h4>
                    <p className="text-white font-light break-all">{formData.downloadLink}</p>
                    {formData.licenseKey && (
                      <p className="text-white font-light mt-2">License Key: {formData.licenseKey}</p>
                    )}
                  </div>
                )}
                
                {itemType === 'SERVICES' && (
                  <div>
                    <h4 className="text-sm text-white/60 font-light mb-2">Service Timeline</h4>
                    <p className="text-white font-light">{formData.serviceDate}</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white font-light"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    setShowPreview(false)
                    // Create a synthetic submit event
                    const syntheticEvent = {
                      preventDefault: () => {},
                    } as React.FormEvent
                    await handleSubmit(syntheticEvent)
                  }}
                  className="flex-1 px-6 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all text-white font-light"
                >
                  Confirm & Create
                </button>
              </div>
            </div>
          </div>
        )}

      </form>
    </GlassCard>
  )
}
