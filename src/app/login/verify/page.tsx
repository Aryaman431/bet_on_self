"use client"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export default function VerifyPage() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const router = useRouter()
  const { setAuthState } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)
    const res = await fetch("/api/auth/passwordless/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    })
    if (res.ok) {
      setSuccess(true)
      setAuthState(true, email) // Update auth state with email
      router.push("/")
    } else {
      const data = await res.json()
      setError(data.error?.error || "Invalid code")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="flex justify-center items-center w-full">
          <div className="w-[350px] p-8 border border-border rounded-lg bg-card shadow-lg">
            <h2 className="mb-6 text-center text-card-foreground">Check your email</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Enter the code"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                className="p-3 rounded border border-input text-base bg-background text-foreground disabled:opacity-50"
                disabled={loading}
              />
              <button
                type="submit"
                className="p-3 border-none rounded bg-blue-600 text-white text-base cursor-pointer text-center transition-colors hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
            </form>
            {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}
            {success && <p className="mt-6 text-center text-sm text-green-600">Success! You are logged in.</p>}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Enter the code sent to <b>{email}</b>.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
