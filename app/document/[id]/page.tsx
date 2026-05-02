import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ExtractedDataPanel } from '@/components/features/document/ExtractedDataPanel'

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: DocumentPageProps): Promise<Metadata> {
  const { id } = await params

  if (!id || id.trim() === '') return {}

  return {
    title: `Document ${id} — AI Document Translator`,
    description: `View extracted data and complete fields for document ${id}.`,
    alternates: { canonical: `/document/${id}` },
  }
}

export default async function DocumentPage({
  params,
}: DocumentPageProps): Promise<React.ReactElement> {
  const { id } = await params

  if (!id || id.trim() === '') {
    notFound()
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background md:h-screen md:min-h-0 md:flex-row">
      <div className="w-full min-h-0 flex-1 overflow-y-auto border-b border-border p-4 md:w-1/2 md:border-b-0 md:border-r md:p-6">
        <ExtractedDataPanel sessionId={id} />
      </div>
      <div className="flex w-full min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 md:w-1/2 md:p-6">
        <p className="text-sm text-muted-foreground">
          Team 2, 3, 4, 5 panels go here
        </p>
      </div>
    </div>
  )
}
