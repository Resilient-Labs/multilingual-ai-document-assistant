import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MessageRole = "user" | "assistant";

export interface MessageBubbleProps {
  role: MessageRole;
  content: React.ReactNode;
  className?: string;
}

export function MessageBubble({ role, content, className }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser && "flex-row-reverse",
        className
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 border border-border">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            AI
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2.5 text-sm shadow-sm",
          isUser ? "bg-chat-user text-primary-foreground" : "bg-chat-assistant border border-chat-assistant-border"
        )}
      >
        {content}
      </div>
    </div>
  );
}
