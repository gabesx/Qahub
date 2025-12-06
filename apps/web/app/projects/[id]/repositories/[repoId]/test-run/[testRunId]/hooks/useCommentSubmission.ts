import { useState, useCallback } from 'react'
import { api } from '../../../../../../../../lib/api'
import { Comment } from '../types'

interface UseCommentSubmissionProps {
  testRunId: string
  onError: (error: string) => void
  onSuccess: () => void
}

export function useCommentSubmission({
  testRunId,
  onError,
  onSuccess,
}: UseCommentSubmissionProps) {
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  const handleSubmitComment = useCallback(async (
    newComment: string,
    commentFiles: File[],
    filePreviews: Array<{ url: string; type: string; name: string }>,
    selectedTestCaseForModal: any,
    setNewComment: (value: string) => void,
    setCommentFiles: (files: File[]) => void,
    setFilePreviews: (previews: Array<{ url: string; type: string; name: string }>) => void,
    fetchComments: () => Promise<void>
  ) => {
    if (!newComment.trim() && commentFiles.length === 0) return
    if (!selectedTestCaseForModal) return

    setIsSubmittingComment(true)
    onError(null as any)
    
    try {
      const uploadedAttachmentUrls: string[] = []
      
      if (commentFiles.length > 0) {
        for (const file of commentFiles) {
          try {
            const formData = new FormData()
            formData.append('image', file)
            
            const uploadResponse = await api.post('/editor/images', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            })
            
            const imageData = uploadResponse.data?.data?.image || uploadResponse.data?.image
            if (imageData) {
              let fileUrl: string | null = null
              
              if (imageData.url) {
                const url = imageData.url
                fileUrl = url.startsWith('http://') || url.startsWith('https://')
                  ? url
                  : url.startsWith('/')
                  ? `${window.location.origin}${url}`
                  : `${window.location.origin}/${url}`
              } else if (imageData.path && !imageData.path.startsWith('database://')) {
                const path = imageData.path
                const normalizedPath = path.startsWith('/') ? path : `/${path}`
                fileUrl = path.startsWith('http://') || path.startsWith('https://')
                  ? path
                  : `${window.location.origin}${normalizedPath}`
              } else if (imageData.filename && imageData.storageType !== 'database') {
                const filename = imageData.filename
                fileUrl = `${window.location.origin}/uploads/editor-images/${filename}`
              } else {
                console.warn('Cannot determine file URL from upload response:', imageData)
                onError('File uploaded but URL could not be determined. Please check storage configuration.')
              }
              
              if (fileUrl) {
                try {
                  new URL(fileUrl)
                  uploadedAttachmentUrls.push(fileUrl)
                } catch (urlError) {
                  console.error('Invalid URL format:', fileUrl, urlError)
                  onError(`Invalid URL format for uploaded file: ${fileUrl}`)
                }
              }
            }
          } catch (uploadErr: any) {
            console.error('File upload error:', uploadErr)
            const errorMessage = uploadErr.response?.data?.error?.message || uploadErr.message || `Failed to upload ${file.name}`
            onError(errorMessage)
          }
        }
      }

      if (newComment.trim() || uploadedAttachmentUrls.length > 0) {
        const commentText = newComment.trim() || '(No comment text)'
        
        try {
          const commentResponse = await api.post(`/test-runs/${testRunId}/comments`, {
            comments: commentText,
          })

          if (commentResponse.data?.data?.comment) {
            const newCommentData = commentResponse.data.data.comment

            if (uploadedAttachmentUrls.length > 0 && newCommentData.id) {
              const attachmentPromises = uploadedAttachmentUrls.map(async (url) => {
                try {
                  let validUrl = url
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    if (url.startsWith('/')) {
                      validUrl = `${window.location.origin}${url}`
                    } else {
                      validUrl = `${window.location.origin}/${url}`
                    }
                  }
                  
                  const testCaseIdStr = String(selectedTestCaseForModal.id)
                  const commentIdStr = String(newCommentData.id)
                  
                  await api.post(`/test-runs/${testRunId}/attachments`, {
                    url: validUrl,
                    testCaseId: testCaseIdStr,
                    commentId: commentIdStr,
                  })
                } catch (attErr: any) {
                  console.error('Create attachment error:', attErr)
                  const errorDetails = attErr.response?.data?.error
                  const errorMessage = errorDetails?.message || `Failed to create attachment: ${url}`
                  onError(errorMessage)
                }
              })

              await Promise.all(attachmentPromises)
            }

            await fetchComments()
            onSuccess()
          }
        } catch (commentErr: any) {
          console.error('Create comment error:', commentErr)
          onError(commentErr.response?.data?.error?.message || 'Failed to create comment')
          throw commentErr
        }
      }

      setNewComment('')
      filePreviews.forEach(preview => {
        if (preview.url) {
          URL.revokeObjectURL(preview.url)
        }
      })
      setCommentFiles([])
      setFilePreviews([])
    } catch (err: any) {
      console.error('Submit comment error:', err)
      onError(err.response?.data?.error?.message || 'Failed to submit comment')
    } finally {
      setIsSubmittingComment(false)
    }
  }, [testRunId, onError, onSuccess])

  return {
    isSubmittingComment,
    handleSubmitComment,
  }
}

