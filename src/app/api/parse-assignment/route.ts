import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";

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

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
    const pdfResult = await parser.getText();
    const extractedText = pdfResult.text;

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    // Generate checklist using Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an expert academic advisor. Analyze the following assignment and create a step-by-step checklist for completing it.

Return your response as JSON with this exact structure:
{
  "title": "A short descriptive title for the assignment",
  "steps": [
    {
      "title": "Short step title",
      "description": "1-2 sentence explanation of what to do for this step"
    }
  ]
}

Guidelines:
- Create 5-15 ordered, actionable steps
- Order them logically (research → outline → draft → revise, etc.)
- Each step should be concrete and specific to this assignment
- Keep titles short (under 10 words)
- Keep descriptions to 1-2 sentences max
- Return ONLY valid JSON, no other text

Assignment text:
${extractedText}`,
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

    // Parse the JSON response
    const parsed = JSON.parse(content.text);
    const { title, steps } = parsed as {
      title: string;
      steps: { title: string; description: string }[];
    };

    // Save assignment to database
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .insert({
        user_id: user.id,
        title,
        original_text: extractedText,
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