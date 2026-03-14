"use client";

import Image from "next/image";
import { GlobeIcon, MessageSquareIcon, ShieldCheckIcon, UploadCloudIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { UploadForm } from "@/components/upload-form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const NAV_TABS = [
  { value: "upload", label: "Upload", icon: UploadCloudIcon },
  { value: "translate", label: "Translate", icon: GlobeIcon },
  { value: "detect", label: "Detect", icon: ShieldCheckIcon },
  { value: "ask", label: "Ask", icon: MessageSquareIcon },
];

export default function Page() {
  const isMobile = useIsMobile();

  /* ── Mobile ─────────────────────────────────────────────────────── */
  if (isMobile) {
    return (
      <section className="flex flex-col h-[100dvh] bg-background overflow-hidden">
        <header className="shrink-0 px-5 pt-6 pb-3">
          <h1 className="text-xl font-bold font-display">AI Document Translator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a document to translate and analyze easy!
          </p>
        </header>

        <Tabs defaultValue="upload" className="flex flex-col flex-1 overflow-hidden gap-0">
          <main className="flex-1 overflow-auto px-4 pb-2">
            <TabsContent value="upload" className="h-full mt-0">
              <UploadForm mobile />
            </TabsContent>
            <TabsContent value="translate" className="mt-0">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
                Translate coming soon
              </div>
            </TabsContent>
            <TabsContent value="detect" className="mt-0">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
                Detect coming soon
              </div>
            </TabsContent>
            <TabsContent value="ask" className="mt-0">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
                Ask coming soon
              </div>
            </TabsContent>
          </main>

          {/* Bottom tab bar */}
          <footer className="shrink-0 border-t border-border bg-background overflow-hidden">
            <TabsList className="w-full h-16 rounded-none bg-transparent p-0 gap-0 overflow-hidden">
              {NAV_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex-1 flex-col items-center justify-center gap-1
                    h-16 min-h-0 w-full rounded-none border-0 px-1 py-2
                    text-[11px] font-medium leading-none
                    text-muted-foreground
                    data-active:text-indigo-600 data-active:bg-transparent data-active:shadow-none
                    after:hidden overflow-hidden"
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="truncate w-full text-center">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </footer>
        </Tabs>
      </section>
    );
  }

  /* ── Desktop ─────────────────────────────────────────────────────── */
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 py-12 w-[42%] bg-muted/20 border-r border-border">
        <div className="max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <Image
              src="/logo.svg"
              alt="Resilient Labs"
              width={44}
              height={44}
              className="rounded-full"
            />
            <span className="font-bold text-base font-display">Resilient Labs</span>
          </div>

          <h1 className="text-4xl font-bold font-display leading-tight mb-4">
            Breaking Language Barriers
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed mb-10">
            Upload any document and translate it instantly into your language of choice with AI-powered accuracy.
          </p>

          <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <GlobeIcon className="size-4 text-indigo-500 shrink-0" />
              Supports 19+ languages
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheckIcon className="size-4 text-indigo-500 shrink-0" />
              Zero data retention — your files stay private
            </li>
            <li className="flex items-center gap-3">
              <MessageSquareIcon className="size-4 text-indigo-500 shrink-0" />
              Ask questions about your translated document
            </li>
          </ul>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        {/* Logo shown on md screens where left panel is hidden */}
        <div className="lg:hidden flex items-center gap-3 mb-8 self-start">
          <Image src="/logo.svg" alt="Resilient Labs" width={36} height={36} className="rounded-full" />
          <span className="font-bold font-display">Resilient Labs</span>
        </div>

        <div className="w-full max-w-2xl">
          <h2 className="text-3xl font-bold font-display mb-2">Upload a document</h2>
          <p className="text-base text-muted-foreground mb-8">
            Supports PDF, DOC, DOCX, TXT, and images up to 10 MB.
          </p>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <UploadForm />
          </div>
        </div>
      </div>
    </div>
  );
}
