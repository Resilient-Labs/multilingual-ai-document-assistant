'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircleIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useErrorPopup } from '@/hooks/useErrorPopup'

export function ErrorPopup() {
  const router = useRouter()
  const { isOpen, title, description, redirectPath, clearError } =
    useErrorPopup()

  const handleDismiss = useCallback(() => {
    const shouldRedirect = redirectPath
    clearError()
    if (shouldRedirect) {
      router.push(shouldRedirect)
    }
  }, [clearError, redirectPath, router])

  return (
    <AlertDialog open={isOpen} onOpenChange={handleDismiss}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <AlertCircleIcon className="text-destructive" aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction variant="destructive" onClick={handleDismiss}>
            Dismiss
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
