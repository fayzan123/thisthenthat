"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Check, Send } from "lucide-react";
import type { Assignment, ChecklistStep, ChatMessage } from "@/lib/types";

interface StepChatPanelProps {
  step: ChecklistStep;
  assignment: Assignment;
  steps: ChecklistStep[];
  onClose: () => void;
  onToggleComplete: () => void;
}

export function StepChatPanel({
  step,
  assignment,
  steps,
  onClose,
  onToggleComplete,
}: StepChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    step.chat_history || []
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Reset messages when step changes
  useEffect(() => {
    setMessages(step.chat_history || []);
  }, [step.id, step.chat_history]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || streaming) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/step-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          stepId: step.id,
          message: userMessage.content,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          assistantContent += chunk;

          setMessages([
            ...newMessages,
            { role: "assistant", content: assistantContent },
          ]);
        }
      }

      // Save updated chat history
      const finalMessages: ChatMessage[] = [
        ...newMessages,
        { role: "assistant", content: assistantContent },
      ];

      await supabase
        .from("checklist_steps")
        .update({ chat_history: finalMessages })
        .eq("id", step.id);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Desktop: side panel */}
      <div className="fixed inset-y-0 right-0 z-50 hidden w-[440px] border-l bg-background shadow-lg md:flex md:flex-col">
        <PanelContent
          step={step}
          messages={messages}
          input={input}
          streaming={streaming}
          scrollRef={scrollRef}
          onClose={onClose}
          onToggleComplete={onToggleComplete}
          onInputChange={setInput}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Mobile: full-screen bottom sheet */}
      <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
        <PanelContent
          step={step}
          messages={messages}
          input={input}
          streaming={streaming}
          scrollRef={scrollRef}
          onClose={onClose}
          onToggleComplete={onToggleComplete}
          onInputChange={setInput}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
        />
      </div>
    </>
  );
}

interface PanelContentProps {
  step: ChecklistStep;
  messages: ChatMessage[];
  input: string;
  streaming: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onToggleComplete: () => void;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function PanelContent({
  step,
  messages,
  input,
  streaming,
  scrollRef,
  onClose,
  onToggleComplete,
  onInputChange,
  onSend,
  onKeyDown,
}: PanelContentProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex-1 pr-2">
          <p className="text-sm font-medium">
            Step {step.step_number}: {step.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={step.completed ? "secondary" : "default"}
            size="sm"
            onClick={onToggleComplete}
          >
            <Check className="mr-1 h-3 w-3" />
            {step.completed ? "Completed" : "Mark Complete"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="border-b px-4 py-2">
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center py-12">
            <p className="text-center text-sm text-muted-foreground">
              Ask a question about this step and the AI will help you with
              context from your assignment.
            </p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <Badge variant="secondary" className="animate-pulse">
                Thinking...
              </Badge>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Input */}
      <div className="flex items-end gap-2 p-4">
        <Textarea
          placeholder="Ask about this step..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          className="min-h-[40px] resize-none"
        />
        <Button
          size="icon"
          onClick={onSend}
          disabled={!input.trim() || streaming}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}