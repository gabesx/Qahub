'use client'

import { useState, useEffect } from 'react'
import { Comment } from '../types'
import { formatDateTime } from '../utils/formatters'
import { api } from '../../../../../../../lib/api'

interface CommentsSectionProps {
  comments: Comment[]
  newComment: string
  setNewComment: (value: string) => void
  commentFiles: File[]
  filePreviews: Array<{ url: string; type: string; name: string }>
  isSubmittingComment: boolean
  editingCommentId: string | null
  editingCommentText: string
  currentUserId: string | null
  testRunId: string
  testCaseId: string | null
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmitComment: () => Promise<void>
  onEditComment: (comment: Comment) => void
  onCancelEdit: () => void
  onSaveEdit: (commentId: string) => Promise<void>
  onDeleteComment: (comment: Comment) => void
  onError: (error: string) => void
}

export default function CommentsSection({
  comments,
  newComment,
  setNewComment,
  commentFiles,
  filePreviews,
  isSubmittingComment,
  editingCommentId,
  editingCommentText,
  currentUserId,
  testRunId,
  testCaseId,
  onFileSelect,
  onSubmitComment,
  onEditComment,
  onCancelEdit,
  onSaveEdit,
  onDeleteComment,
  onError,
}: CommentsSectionProps) {
  return (
    <>
      <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
        {comments.length > 0 ? (
          comments.map((comment) => {
            const isEditing = editingCommentId === comment.id
            const commentUserId = comment.userId || comment.user?.id
            const canEdit = currentUserId && commentUserId && String(currentUserId) === String(commentUserId)
            
            return (
              <div key={comment.id} className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {comment.user?.name || 'Unknown User'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(comment.createdAt)}
                    </span>
                    {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                      <span className="text-xs text-gray-400 italic">
                        (edited)
                      </span>
                    )}
                  </div>
                  {canEdit && !isEditing && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditComment(comment)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit comment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteComment(comment)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete comment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editingCommentText}
                      onChange={(e) => {
                        // This will be handled by parent
                        const event = { target: { value: e.target.value } } as any
                        // We need to pass this to parent, but for now just update local state
                      }}
                      className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm shadow-sm"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSaveEdit(comment.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">
                    {comment.content || comment.comments || '(No comment text)'}
                  </p>
                )}
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Attachments ({comment.attachments.length}):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {comment.attachments.map((attachment) => {
                        const isImage = attachment.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
                        const isVideo = attachment.url.match(/\.(mp4|webm|ogg|mov)$/i)
                        const isDatabaseStorage = attachment.url.includes('/api/editor-images/')
                        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                        const imageUrl = isDatabaseStorage && token
                          ? `${attachment.url}?token=${encodeURIComponent(token)}`
                          : attachment.url
                        
                        return (
                          <div key={attachment.id} className="relative group">
                            {isImage ? (
                              <img
                                src={imageUrl}
                                alt="Attachment"
                                className="w-full h-24 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(imageUrl, '_blank')}
                                onError={(e) => {
                                  console.error('Failed to load image:', imageUrl)
                                  if (isDatabaseStorage && token) {
                                    const fallbackUrl = attachment.url
                                    e.currentTarget.src = fallbackUrl
                                  }
                                }}
                              />
                            ) : isVideo ? (
                              <video
                                src={imageUrl}
                                className="w-full h-24 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                controls
                                onClick={(e) => {
                                  e.preventDefault()
                                  window.open(imageUrl, '_blank')
                                }}
                              />
                            ) : (
                              <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-full h-24 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                              </a>
                            )}
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded"
                              title="Open in new tab"
                            >
                              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <p className="text-sm text-gray-500 italic text-center py-4">No comments yet. Be the first to comment!</p>
        )}
      </div>

      {/* Comment Input */}
      <div className="border-t border-gray-200 pt-5">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none text-sm shadow-sm hover:shadow-md transition-shadow"
          rows={3}
        />
        <div className="space-y-3">
          {/* File selection display with thumbnails */}
          {commentFiles.length > 0 && (
            <div className="p-3 bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-xl shadow-sm">
              <p className="text-xs font-medium text-gray-700 mb-3">Selected Files ({commentFiles.length}):</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {commentFiles.map((file, index) => {
                  const preview = filePreviews[index]
                  const isImage = file.type.startsWith('image/')
                  const isVideo = file.type.startsWith('video/')
                  
                  return (
                    <div key={index} className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {preview?.url && (isImage || isVideo) ? (
                        <div className="relative aspect-square">
                          {isImage ? (
                            <img
                              src={preview.url}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={preview.url}
                              className="w-full h-full object-cover"
                              muted
                            />
                          )}
                          {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square flex items-center justify-center bg-gray-100">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </div>
                      )}
                      <div className="p-2 bg-white border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-900 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (preview?.url) {
                            URL.revokeObjectURL(preview.url)
                          }
                          // This will be handled by parent
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 z-10"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-all text-sm shadow-sm hover:shadow-md">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Choose Files</span>
              <input
                type="file"
                multiple
                onChange={onFileSelect}
                className="hidden"
                accept="image/*,video/*"
              />
            </label>
            <button
              onClick={onSubmitComment}
              disabled={isSubmittingComment || (!newComment.trim() && commentFiles.length === 0)}
              className="ml-auto px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              {isSubmittingComment ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20a7.962 7.962 0 01-8-8H4z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit Comment'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

