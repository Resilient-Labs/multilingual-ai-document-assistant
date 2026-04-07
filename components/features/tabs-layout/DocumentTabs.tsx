import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export interface DocumentTabsProps {
  detectContent: React.ReactNode
  askContent: React.ReactNode
  className?: string
}

export function DocumentTabs({
  detectContent,
  askContent,
  className,
}: DocumentTabsProps) {
  return (
    <Tabs defaultValue="detect" className={className}>
      <TabsList variant="line">
        <TabsTrigger value="detect">Detect</TabsTrigger>
        <TabsTrigger value="ask">Ask</TabsTrigger>
      </TabsList>
      <TabsContent value="detect">{detectContent}</TabsContent>
      <TabsContent value="ask">{askContent}</TabsContent>
    </Tabs>
  )
}
