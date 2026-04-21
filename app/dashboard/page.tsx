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
        <Tabs defaultValue="upload" className="flex flex-col flex-1 h-screen">
          <header className="flex flex-col py-4 px-4 justify-center gap-2">
            <span className="text-lg">Title of document goes here</span>
            <span className="text-md">
              Document type goes here- medical / financial / housing / other
            </span>
          </header>
          <main className="flex-1 overflow-auto p-4">
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
          <footer className="min-h-[80px] w-full px-2">
            <TabsList className="w-full" variant="line">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="translate">Translate</TabsTrigger>
            </TabsList>
          </footer>
        </Tabs>
      ) : (
        <section className="flex flex-col h-screen">
          <header className="min-h-[80px] px-8 py-2 content-center">
            Place Holder Header
          </header>
          <main className="flex flex-1 px-8">
            <div className="flex flex-1 flex-col">
              <div className="flex-2">Left top</div>
              <div className="flex-1">Left bottom</div>
            </div>
          </main>
        </section>
      )}
    </>
  )
}
