import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtractedDataPanel } from "@/components/features/document/ExtractedDataPanel";

interface DocumentPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: DocumentPageProps): Promise<Metadata> {
  const { id } = await params;

  if (!id || id.trim() === "") return {};

  return {
    title: `Document ${id} — AI Document Translator`,
    description: `View extracted data and complete fields for document ${id}.`,
    alternates: { canonical: `/document/${id}` },
  };
}

export default async function DocumentPage({
  params,
}: DocumentPageProps): Promise<React.ReactElement> {
  const { id } = await params;

  if (!id || id.trim() === "") {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <div className="w-full overflow-y-auto border-b border-border p-6 md:w-1/2 md:border-b-0 md:border-r">
        <ExtractedDataPanel sessionId={id} />
      </div>
      <div className="flex w-full items-center justify-center overflow-y-auto p-6 md:w-1/2">
        <p className="text-sm text-muted-foreground">
          Team 2, 3, 4, 5 panels go here
        </p>
      </div>
    </div>
  );
}
