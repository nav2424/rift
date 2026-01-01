'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface User {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
}

interface AdminUserActionsProps {
  user: User
}

export default function AdminUserActions({ user }: AdminUserActionsProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: user.name || '',
    email: user.email,
    phone: user.phone || '',
    role: user.role,
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleDelete = async () => {
    if (deleteConfirm !== user.email) {
      setError('Please type the user email to confirm deletion')
      return
    }

    if (user.role === 'ADMIN') {
      setError('Cannot delete admin users')
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        let errorMessage = 'Failed to delete user'
        try {
          const text = await response.text()
          if (text && text.trim().length > 0) {
            const data = JSON.parse(text)
            errorMessage = data.error || errorMessage
          } else {
            errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`
          }
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`
        }
        throw new Error(errorMessage)
      }

      // Handle successful deletion - response might be empty
      const text = await response.text()
      if (text && text.trim().length > 0) {
        try {
          const data = JSON.parse(text)
          if (data.error) {
            throw new Error(data.error)
          }
        } catch (parseError) {
          // If parsing fails but status is OK, assume success
          console.log('Delete successful (empty or non-JSON response)')
        }
      }

      router.push('/admin')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting the user')
      setIsDeleting(false)
    }
  }

  const handleEdit = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch(`/api/admin/users/${user.id}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update user')
      }

      showToast('User updated successfully', 'success')
      setIsEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the user')
      setIsSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-light text-white mb-4">Admin Actions</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-light">{error}</p>
        </div>
      )}

      {!isEditing && !showDeleteConfirm && (
        <div className="space-y-4">
          <p className="text-white/60 text-sm font-light">
            Warning: These actions cannot be undone. Use with caution.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-6 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg transition-colors font-light"
            >
              Edit User
            </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting || user.role === 'ADMIN'}
              className="flex-1 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {user.role === 'ADMIN' ? 'Cannot Delete Admin' : 'Delete User'}
            </button>
          </div>
        </div>
      )}

      {isEditing && !showDeleteConfirm && (
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 font-light text-sm mb-2">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-light"
            />
          </div>
          <div>
            <label className="block text-white/70 font-light text-sm mb-2">Email</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="w-full px-4 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-light"
            />
          </div>
          <div>
            <label className="block text-white/70 font-light text-sm mb-2">Phone</label>
            <input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-4 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-light"
            />
          </div>
          <div>
            <label className="block text-white/70 font-light text-sm mb-2">Role</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full px-4 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-light"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleEdit}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditForm({
                  name: user.name || '',
                  email: user.email,
                  phone: user.phone || '',
                  role: user.role,
                })
                setError(null)
              }}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors font-light disabled:opacity-50"
            >
              Cancel
          </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="space-y-4">
          <div>
            <p className="text-white/80 font-light mb-2">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <p className="text-white/60 text-sm font-light mb-4">
              Type <span className="font-mono text-white/80">{user.email}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={user.email}
              className="w-full px-4 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all font-light"
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirm !== user.email || user.role === 'ADMIN'}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => {
                setShowDeleteConfirm(false)
                setDeleteConfirm('')
                setError(null)
              }}
              disabled={isDeleting}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors font-light disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

