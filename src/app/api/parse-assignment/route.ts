import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 uploads per 10 minutes per user
    const { allowed, retryAfterMs } = rateLimit(
      `parse:${user.id}`,
      5,
      10 * 60 * 1000
    );
    if (!allowed) {
      const minutes = Math.ceil(retryAfterMs / 60000);
      return NextResponse.json(
        { error: `Too many uploads. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.` },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("pdf") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    // Send PDF directly to Claude (native PDF support)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const message = await anthropic.messages.create({
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

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected AI response" },
        { status: 500 }
      );
    }

    // Parse the JSON response (strip markdown fences if present)
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.valid) {
      return NextResponse.json(
        { error: parsed.reason || "This PDF does not appear to be a valid assignment." },
        { status: 400 }
      );
    }

    const { title, steps } = parsed as {
      title: string;
      steps: { title: string; description: string }[];
    };

    // Save assignment to database (store the raw AI text as original_text)
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .insert({
        user_id: user.id,
        title,
        original_text: content.text,
      })
      .select()
      .single();

    if (assignmentError) {
      return NextResponse.json(
        { error: "Failed to save assignment" },
        { status: 500 }
      );
    }

    // Save checklist steps
    const stepsToInsert = steps.map(
      (step: { title: string; description: string }, index: number) => ({
        assignment_id: assignment.id,
        step_number: index + 1,
        title: step.title,
        description: step.description,
        completed: false,
        chat_history: [],
      })
    );

    const { error: stepsError } = await supabase
      .from("checklist_steps")
      .insert(stepsToInsert);

    if (stepsError) {
      return NextResponse.json(
        { error: "Failed to save checklist steps" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: assignment.id,
      title,
      steps,
    });
  } catch (error) {
    console.error("Parse assignment error:", error);
    return NextResponse.json(
      { error: "Failed to process assignment" },
      { status: 500 }
    );
  }
}