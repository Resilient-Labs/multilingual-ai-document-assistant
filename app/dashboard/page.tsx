'use client'

import { useIsMobile } from '@/hooks/use-mobile'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
export default function Page() {
  const isMobile = useIsMobile()

  return (
    <>
      {isMobile ? (
        <Tabs defaultValue="upload" className="flex h-[100dvh] flex-1 flex-col">
          <header className="flex flex-col justify-center gap-1.5 px-4 py-4 sm:px-6">
            <span className="text-lg font-semibold">
              Title of document goes here
            </span>
            <span className="text-sm text-muted-foreground">
              Document type goes here — medical / financial / housing / other
            </span>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <TabsContent value="upload" className="mt-0 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Upload</CardTitle>
                  <CardDescription>
                    Upload documents for translation and analysis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Upload content placeholder.
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="translate" className="mt-0 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Translate</CardTitle>
                  <CardDescription>Translate your documents.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Translation content placeholder.
                </CardContent>
              </Card>
            </TabsContent>
          </main>
          <footer className="min-h-[64px] w-full border-t border-border px-2">
            <TabsList className="w-full" variant="line">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="translate">Translate</TabsTrigger>
            </TabsList>
          </footer>
        </Tabs>
      ) : (
        <section className="flex min-h-[100dvh] flex-col md:h-screen">
          <header className="content-center min-h-[72px] border-b border-border px-6 py-3 md:px-8 md:py-4">
            <h1 className="text-base font-semibold sm:text-lg">
              Place Holder Header
            </h1>
          </header>
          <main className="flex flex-1 flex-col gap-6 px-6 py-6 md:flex-row md:px-8 md:py-8 lg:px-12">
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex-2 rounded-xl border border-border bg-card p-6">
                Left top
              </div>
              <div className="flex-1 rounded-xl border border-border bg-card p-6">
                Left bottom
              </div>
            </div>
          </main>
        </section>
      )}
    </>
  )
}
