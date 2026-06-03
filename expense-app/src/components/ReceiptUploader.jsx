import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ReceiptUploader({ receiptUrl, onUploaded, onRemoved, readOnly = false  }) {
  const { user }            = useAuth()
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox]   = useState(false)
  const [error, setError]         = useState('')
  const inputRef                  = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size — max 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    setUploading(true)
    setError('')

    try {
      // If existing receipt, delete it first
      if (receiptUrl) {
        const oldPath = receiptUrl.split('/receipts/')[1]
        if (oldPath) {
          await supabase.storage.from('receipts').remove([oldPath])
        }
      }

      // Upload new image — stored under user's ID folder
      const ext      = file.name.split('.').pop()
      const path     = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('receipts')
        .getPublicUrl(path)

      onUploaded(data.publicUrl)

    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      // Reset input so same file can be selected again
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!receiptUrl) return
    const path = receiptUrl.split('/receipts/')[1]
    if (path) {
      await supabase.storage.from('receipts').remove([path])
    }
    onRemoved()
  }

  return (
    <div>
      <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
        Receipt
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* Thumbnail or upload button */}
        {receiptUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            {/* Thumbnail — always visible */}
            <div
              onClick={() => setLightbox(true)}
              style={{
                width: '52px', height: '52px',
                borderRadius: '8px', overflow: 'hidden',
                border: '1px solid #e2e8f0', cursor: 'pointer',
                flexShrink: 0, position: 'relative',
              }}
            >
              <img
                src={receiptUrl}
                alt="Receipt"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '16px' }}>🔍</span>
              </div>
            </div>

            {/* Change + Remove — only in edit mode */}
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px', fontSize: '13px',
                    color: '#64748b', cursor: 'pointer',
                  }}
                >
                  {uploading ? 'Uploading...' : '↺ Change'}
                </button>

                <button
                  type="button"
                  onClick={handleRemove}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px', fontSize: '13px',
                    color: '#dc2626', cursor: 'pointer',
                  }}
                >
                  ✕ Remove
                </button>
              </>
            )}
          </div>
        ) : (
          // Upload button — only in edit mode
          !readOnly && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '10px', fontSize: '13px',
                color: '#64748b', cursor: 'pointer',
                width: '100%', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '18px' }}>📷</span>
              {uploading ? 'Uploading...' : 'Add receipt photo'}
            </button>
          )
        )}
      </div>

      {/* Hidden file input — accepts images, camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {error && (
        <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{error}</p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'none', border: 'none',
              color: 'white', fontSize: '28px', cursor: 'pointer',
            }}
          >✕</button>
          <img
            src={receiptUrl}
            alt="Receipt"
            style={{
              maxWidth: '100%', maxHeight: '90vh',
              borderRadius: '8px', objectFit: 'contain',
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
