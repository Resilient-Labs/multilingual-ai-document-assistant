"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function ChatHeader({
  className,
  isExpanded = true,
  onToggleExpand,
}: ChatHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-9 w-9 shrink-0 border-2 border-border">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            AI
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm font-semibold text-foreground">
            Document Translation Assistant
          </h1>
          <p className="text-xs text-muted-foreground">
            Ask about your documents, clarify content, or check requirements
          </p>
        </div>
      </div>
      {onToggleExpand && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={onToggleExpand}
          aria-label={isExpanded ? "Shrink chat window" : "Expand chat window"}
        >
          {isExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </header>
  );
}
