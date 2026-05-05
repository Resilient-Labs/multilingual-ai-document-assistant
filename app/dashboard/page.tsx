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
        <section className="flex flex-col h-[100dvh] bg-background overflow-hidden">
          <Tabs
            defaultValue="upload"
            className="flex flex-col flex-1 min-h-0 overflow-hidden gap-0"
          >
            <header className="shrink-0 flex flex-col gap-1 px-4 pt-6 pb-3">
              <span className="text-xl font-bold font-display">
                Title of document goes here
              </span>
              <span className="text-sm text-muted-foreground">
                Document type goes here — medical / financial / housing / other
              </span>
            </header>
            <main className="flex-1 min-h-0 overflow-auto px-4 pb-2">
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
            <footer className="shrink-0 w-full border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
              <TabsList
                className="w-full h-16 rounded-none bg-transparent p-0 gap-0"
                variant="line"
              >
                <TabsTrigger
                  value="upload"
                  className="flex-1 rounded-none border-0 h-16 text-sm"
                >
                  Upload
                </TabsTrigger>
                <TabsTrigger
                  value="translate"
                  className="flex-1 rounded-none border-0 h-16 text-sm"
                >
                  Translate
                </TabsTrigger>
              </TabsList>
            </footer>
          </Tabs>
        </section>
      ) : (
        <section className="flex flex-col min-h-screen bg-background">
          <header className="shrink-0 border-b border-border px-6 py-4 md:px-8">
            <span className="text-sm font-medium text-muted-foreground">
              Placeholder header
            </span>
          </header>
          <main className="flex flex-1 min-h-0 flex-col px-6 py-6 md:px-8">
            <div className="flex flex-1 min-h-0 flex-col gap-4">
              <div className="min-h-[120px] flex-[2] rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Left top
              </div>
              <div className="min-h-[120px] flex-1 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Left bottom
              </div>
            </div>
          </main>
        </section>
      )}
    </>
  )
}
