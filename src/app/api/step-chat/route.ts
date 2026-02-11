import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@/lib/types";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { assignmentId, stepId, message, history } = (await request.json()) as {
      assignmentId: string;
      stepId: string;
      message: string;
      history: ChatMessage[];
    };

    // Load assignment and steps for context
    const [{ data: assignment }, { data: steps }, { data: currentStep }] =
      await Promise.all([
        supabase
          .from("assignments")
          .select("*")
          .eq("id", assignmentId)
          .single(),
        supabase
          .from("checklist_steps")
          .select("*")
          .eq("assignment_id", assignmentId)
          .order("step_number"),
        supabase
          .from("checklist_steps")
          .select("*")
          .eq("id", stepId)
          .single(),
      ]);

    if (!assignment || !currentStep) {
      return new Response("Assignment or step not found", { status: 404 });
    }

    const checklistContext = (steps || [])
      .map(
        (s: { step_number: number; title: string; completed: boolean }) =>
          `${s.step_number}. [${s.completed ? "x" : " "}] ${s.title}`
      )
      .join("\n");

    const systemPrompt = `You are a helpful academic assistant. The student is working on an assignment and needs help with a specific step.

ASSIGNMENT TITLE: ${assignment.title}

ASSIGNMENT TEXT:
${assignment.original_text}

FULL CHECKLIST:
${checklistContext}

CURRENT STEP (Step ${currentStep.step_number}): ${currentStep.title}
${currentStep.description}

Help the student with this specific step. Be concise, practical, and encouraging. Give actionable advice specific to their assignment. If they ask about other steps, you can help but gently guide them back to the current step.`;

    // Build message history for Claude
    const claudeMessages = [
      ...history.map((msg: ChatMessage) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Stream the response
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Step chat error:", error);
    return new Response("Failed to process chat request", { status: 500 });
  }
}