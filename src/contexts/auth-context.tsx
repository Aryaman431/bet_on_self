"use client"
import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthContextType {
  isLoggedIn: boolean
  userEmail: string | null
  setAuthState: (loggedIn: boolean, email?: string | null) => void
  checkAuthStatus: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children, initialIsLoggedIn, initialUserEmail }: {
  children: ReactNode,
  initialIsLoggedIn: boolean,
  initialUserEmail: string | null
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn)
  const [userEmail, setUserEmail] = useState<string | null>(initialUserEmail)

  const setAuthState = (loggedIn: boolean, email: string | null = null) => {
    setIsLoggedIn(loggedIn)
    setUserEmail(email)
  }

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      const { isLoggedIn: currentStatus, userEmail: currentEmail } = await response.json()
      setIsLoggedIn(currentStatus)
      setUserEmail(currentEmail)
    } catch (error) {
      setIsLoggedIn(false)
      setUserEmail(null)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setIsLoggedIn(false)
      setUserEmail(null)
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, userEmail, setAuthState, checkAuthStatus, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
