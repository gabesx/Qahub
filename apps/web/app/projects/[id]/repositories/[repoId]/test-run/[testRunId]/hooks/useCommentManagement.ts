import { useState, useCallback } from 'react'
import { api } from '../../../../../../../../lib/api'
import { Comment } from '../types'

export function useCommentManagement(testRunId: string, testCaseId: string | null) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState<string>('')
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null)
  const [isDeletingComment, setIsDeletingComment] = useState(false)

  const handleEditComment = useCallback((comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditingCommentText(comment.content || comment.comments || '')
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null)
    setEditingCommentText('')
  }, [])

  const handleSaveEdit = useCallback(async (
    commentId: string,
    fetchComments: () => Promise<void>,
    onError: (error: string) => void
  ) => {
    if (!editingCommentText.trim()) {
      onError('Comment cannot be empty')
      return
    }

    try {
      await api.patch(`/test-runs/${testRunId}/comments/${commentId}`, {
        comments: editingCommentText.trim(),
      })
      
      await fetchComments()
      setEditingCommentId(null)
      setEditingCommentText('')
    } catch (err: any) {
      console.error('Update comment error:', err)
      onError(err.response?.data?.error?.message || 'Failed to update comment')
    }
  }, [testRunId, editingCommentText])

  const handleDeleteComment = useCallback((comment: Comment) => {
    setCommentToDelete(comment)
  }, [])

  const confirmDeleteComment = useCallback(async (
    fetchComments: () => Promise<void>,
    onError: (error: string) => void
  ) => {
    if (!commentToDelete) return

    try {
      setIsDeletingComment(true)
      await api.delete(`/test-runs/${testRunId}/comments/${commentToDelete.id}`)
      await fetchComments()
      setCommentToDelete(null)
    } catch (err: any) {
      console.error('Delete comment error:', err)
      onError(err.response?.data?.error?.message || 'Failed to delete comment')
    } finally {
      setIsDeletingComment(false)
    }
  }, [testRunId, commentToDelete])

  return {
    editingCommentId,
    editingCommentText,
    setEditingCommentText,
    commentToDelete,
    isDeletingComment,
    handleEditComment,
    handleCancelEdit,
    handleSaveEdit,
    handleDeleteComment,
    confirmDeleteComment,
    setCommentToDelete,
  }
}

