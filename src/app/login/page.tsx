"use client"

import { Navbar } from "@/components/navbar"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/auth/passwordless/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      router.push(`/login/verify?email=${encodeURIComponent(email)}`)
    } else {
      const data = await res.json()
      setError(data.error?.error || "Failed to send code")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="flex justify-center items-center w-full">
          <div className="w-[350px] p-8 border border-border rounded-lg bg-card shadow-lg">
            <h2 className="mb-6 text-center text-card-foreground">Login with Email</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="p-3 rounded border border-input text-base bg-background text-foreground disabled:opacity-50"
                disabled={loading}
              />
              <button
                type="submit"
                className="p-3 border-none rounded bg-blue-600 text-white text-base cursor-pointer text-center transition-colors hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </form>
            {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              You'll receive a verification code via email to complete the process.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
