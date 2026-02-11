import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

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
      max_tokens: 4096,
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
              text: `You are an expert academic advisor. First, determine if this PDF is a valid school or university assignment. Then, if valid, create a step-by-step checklist for completing it.

A valid assignment is a document that asks a student to complete academic work — essays, problem sets, lab reports, research papers, projects, presentations, reading responses, etc. Invalid documents include: receipts, invoices, resumes, random articles, blank pages, memos, personal documents, or anything that is clearly not an assignment given to a student.

Return your response as JSON with this exact structure:

If the PDF is NOT a valid assignment:
{
  "valid": false,
  "reason": "Brief explanation of why this is not a valid assignment"
}

If the PDF IS a valid assignment:
{
  "valid": true,
  "title": "A short descriptive title for the assignment",
  "steps": [
    {
      "title": "Short step title",
      "description": "1-2 sentence explanation of what to do for this step"
    }
  ]
}

Guidelines for steps (only if valid):
- Create 5-15 ordered, actionable steps
- Order them logically (research → outline → draft → revise, etc.)
- Each step should be concrete and specific to this assignment
- Keep titles short (under 10 words)
- Keep descriptions to 1-2 sentences max
- Return ONLY valid JSON, no other text`,
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