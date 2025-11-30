// Server Component - Static content, no interactivity needed
export default function LoginHeader() {
  return (
    <div className="text-center mb-8">
      <div className="mb-4">
        <div className="w-16 h-16 mx-auto bg-primary-600 rounded-full flex items-center justify-center mb-2 shadow-md">
          <span className="text-white text-2xl font-bold" aria-hidden="true">Q</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800">Qa-Hub</h1>
        <p className="text-sm text-gray-600 mt-1">Quality Management System</p>
      </div>
    </div>
  )
}

