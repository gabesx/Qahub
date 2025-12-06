interface ErrorMessageProps {
  message: string | null
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) {
    return null
  }

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
      {message}
    </div>
  )
}

