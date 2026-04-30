'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface ErrorPopupState {
  isOpen: boolean
  title: string
  description: string
}

interface ErrorPopupContextValue extends ErrorPopupState {
  showError: (title: string, description: string) => void
  clearError: () => void
}

const ErrorPopupContext = createContext<ErrorPopupContextValue | null>(null)

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ErrorPopupState>({
    isOpen: false,
    title: '',
    description: '',
  })

  const showError = useCallback((title: string, description: string) => {
    setError({
      isOpen: true,
      title,
      description,
    })
  }, [])

  const clearError = useCallback(() => {
    setError((current) => ({
      ...current,
      isOpen: false,
    }))
  }, [])

  const value = useMemo(
    () => ({
      ...error,
      showError,
      clearError,
    }),
    [clearError, error, showError]
  )

  return (
    <ErrorPopupContext.Provider value={value}>
      {children}
    </ErrorPopupContext.Provider>
  )
}

export function useErrorPopup() {
  const context = useContext(ErrorPopupContext)

  if (!context) {
    throw new Error('useErrorPopup must be used within ErrorProvider')
  }

  return context
}
