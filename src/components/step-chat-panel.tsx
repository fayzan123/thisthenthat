"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Check, Send, MessageCircle, Sparkles } from "lucide-react";
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
      <div className="fixed inset-y-0 right-0 z-50 hidden w-110 border-l bg-card shadow-xl md:flex md:flex-col">
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

      {/* Mobile: full-screen overlay */}
      <div className="fixed inset-0 z-50 flex flex-col bg-card md:hidden">
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
      <div className="flex items-center justify-between border-b bg-background/50 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {step.step_number}
          </span>
          <p className="truncate text-sm font-medium">
            {step.title}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={step.completed ? "secondary" : "default"}
            size="sm"
            className="h-8 text-xs"
            onClick={onToggleComplete}
          >
            <Check className="mr-1 h-3 w-3" />
            {step.completed ? "Done" : "Complete"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-12">
            <div className="rounded-full bg-primary/10 p-3">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Need help with this step?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask a question and get advice tailored to your assignment.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-background/50 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Ask about this step..."
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            className="min-h-10 resize-none rounded-xl"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            onClick={onSend}
            disabled={!input.trim() || streaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
