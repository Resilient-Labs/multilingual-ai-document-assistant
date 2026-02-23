"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Image as ImageIcon, Link2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttachmentType = "text" | "image" | "link";

export interface AttachmentChip {
  id: string;
  type: AttachmentType;
  label: string;
}

export interface ChatComposerProps {
  placeholder?: string;
  attachmentChips?: AttachmentChip[];
  onPasteText?: () => void;
  onAddImage?: () => void;
  onInsertLink?: () => void;
  onSend?: () => void;
  className?: string;
}

const attachmentLabels: Record<AttachmentType, string> = {
  text: "Pasted text",
  image: "Image",
  link: "Link",
};

export function ChatComposer({
  placeholder = "Ask about your document, paste content, or add context…",
  attachmentChips = [],
  onPasteText,
  onAddImage,
  onInsertLink,
  onSend,
  className,
}: ChatComposerProps) {
  return (
    <div
      className={cn(
        "border-t border-border bg-card p-4",
        className
      )}
    >
      {attachmentChips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachmentChips.map((chip) => (
            <Badge
              key={chip.id}
              variant="secondary"
              className="gap-1.5 bg-secondary/80 text-secondary-foreground"
            >
              {chip.type === "text" && <Paperclip className="h-3 w-3" />}
              {chip.type === "image" && <ImageIcon className="h-3 w-3" />}
              {chip.type === "link" && <Link2 className="h-3 w-3" />}
              {chip.label}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          placeholder={placeholder}
          className="min-h-[44px] resize-none border-border bg-background"
          rows={1}
        />
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-border"
              onClick={onPasteText}
              type="button"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-border"
              onClick={onAddImage}
              type="button"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-border"
              onClick={onInsertLink}
              type="button"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            className="h-9 flex-1"
            onClick={onSend}
            type="button"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Paste text, add images, or insert links to provide document context
      </p>
    </div>
  );
}
