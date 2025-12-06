import { useState, useCallback } from 'react'
import { api } from '../../../../../../../../lib/api'
import { Comment } from '../types'

export function useComments(testRunId: string, testCaseId: string | null) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<Array<{ url: string; type: string; name: string }>>([])
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null)
  const [isDeletingComment, setIsDeletingComment] = useState(false)

  const fetchComments = useCallback(async () => {
    if (!testCaseId) {
      setComments([])
      return
    }

    try {
      // Get current user ID
      try {
        const userResponse = await api.get('/users/me')
        if (userResponse.data?.data?.user?.id) {
          setCurrentUserId(String(userResponse.data.data.user.id))
        }
      } catch (err: any) {
        console.warn('Could not fetch current user:', err)
        const token = localStorage.getItem('token')
        if (token) {
          try {
            const tokenData = JSON.parse(atob(token.split('.')[1]))
            if (tokenData.userId || tokenData.id) {
              setCurrentUserId(String(tokenData.userId || tokenData.id))
            }
          } catch (decodeErr) {
            console.warn('Could not decode token:', decodeErr)
          }
        }
      }

      const [commentsResponse, attachmentsResponse] = await Promise.all([
        api.get(`/test-runs/${testRunId}/comments`, {
          params: { page: 1, limit: 100 }
        }),
        api.get(`/test-runs/${testRunId}/attachments`, {
          params: { testCaseId, page: 1, limit: 100 }
        })
      ])

      const attachments = attachmentsResponse.data?.data?.attachments || []
      const allComments = commentsResponse.data?.data?.comments || []

      const commentsWithAttachments = allComments.map((comment: any) => {
        // Use attachments directly from comment if available, otherwise match by commentId
        const commentAttachments = comment.attachments || attachments.filter((att: any) => {
          return att.commentId && String(att.commentId) === String(comment.id)
        })

        return {
          ...comment,
          content: comment.comments || comment.content,
          userId: comment.userId || comment.user?.id,
          attachments: commentAttachments.map((att: any) => ({
            id: att.id,
            url: att.url,
            createdAt: att.createdAt,
          })),
        }
      })

      setComments(commentsWithAttachments)
    } catch (err: any) {
      console.error('Fetch comments error:', err)
      setComments([])
    }
  }, [testRunId, testCaseId])

  return {
    comments,
    newComment,
    setNewComment,
    commentFiles,
    setCommentFiles,
    filePreviews,
    setFilePreviews,
    isSubmittingComment,
    setIsSubmittingComment,
    editingCommentId,
    setEditingCommentId,
    editingCommentText,
    setEditingCommentText,
    currentUserId,
    commentToDelete,
    setCommentToDelete,
    isDeletingComment,
    setIsDeletingComment,
    fetchComments,
  }
}

