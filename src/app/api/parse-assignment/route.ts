import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rate-limit";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Rate limit: 1 upload per day per user
    const { allowed, retryAfterMs } = await rateLimit(
      supabase,
      `parse:${user.id}`,
      1,
      24 * 60 * 60 * 1000
    );
    if (!allowed) {
      const hours = Math.ceil(retryAfterMs / 3600000);
      return new Response(
        JSON.stringify({
          error: `Daily limit reached. Try again in ${hours} hour${hours > 1 ? "s" : ""}.`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("pdf") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No PDF file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send PDF directly to Claude (native PDF support) with streaming
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `You are a study planner tool. Your job is to break down assignments into an organized task list — like a to-do list. You do NOT solve, write, or complete any part of the assignment. You only help students plan their workflow.

If this document is NOT a school/university assignment, respond with JSON: {"valid":false,"reason":"..."}
If it IS an assignment, respond with JSON: {"valid":true,"title":"...","steps":[{"title":"...","description":"..."}]}

Steps should be planning/organizational tasks (e.g. "Review lecture notes on X", "Outline your approach", "Write first draft", "Test your code"), NOT answers or solutions. 5-15 steps, logical order, titles <10 words, descriptions 1-2 sentences. JSON only, no markdown fences.`,
            },
          ],
        },
      ],
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
    console.error("Parse assignment error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process assignment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
