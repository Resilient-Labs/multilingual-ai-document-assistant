"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export default function Page() {

  const isMobile = useIsMobile()

  return (<>
      {isMobile ? <section className="flex flex-col flex-1 h-screen"> 
        <header className="flex flex-col py-4 px-4 justify-center gap-2">
          <span className="text-lg">PlaceHolder</span>
          <span className="text-md">Subtitle</span>
        </header>
        <main className="flex-1">
        <Tabs defaultValue="overview" className="w-full p-4 h-full">
      <TabsList className="m-auto w-full">
        <TabsTrigger value="overview">Translation</TabsTrigger>
        <TabsTrigger value="analytics">Summary</TabsTrigger>
      </TabsList>
      <TabsContent className="h-full" value="overview">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              View your key metrics and recent project activity. Track progress
              across all your active projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You have 12 active projects and 3 pending tasks.
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent className="h-full" value="analytics">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>
              Track performance and user engagement metrics. Monitor trends and
              identify growth opportunities.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Page views are up 25% compared to last month.
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
        </main>
        <footer className="min-h-[80px]">
        <Tabs  defaultValue="upload">
      <TabsList className="m-auto" variant="line">
        <TabsTrigger value="upload">Upload</TabsTrigger>
        <TabsTrigger value="translate">Translate</TabsTrigger>
        <TabsTrigger value="detect">Detect</TabsTrigger>
        <TabsTrigger value="ask">Ask</TabsTrigger>
      </TabsList>
    </Tabs>
        </footer>
      </section> : <section className="flex flex-col h-screen">
      <header className="min-h-[80px] px-8 py-2 content-center">
        Place Holder Header
      </header>
      <main className="flex flex-1 px-8">
        <div className="flex flex-1 flex-col">
          <div className="flex-2">
            Left top
          </div>
          <div className="flex-1">
              Left bottom
          </div>
        </div>
        <div className="flex-1">
          Right
        </div>
      </main>
    </section>
    }
  </>

  );
}