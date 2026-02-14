import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, steps, originalText } = (await request.json()) as {
      title: string;
      steps: { title: string; description: string }[];
      originalText: string;
    };

    if (!title || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "Invalid assignment data" },
        { status: 400 }
      );
    }

    // Save assignment to database
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .insert({
        user_id: user.id,
        title,
        original_text: originalText,
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
    console.error("Save assignment error:", error);
    return NextResponse.json(
      { error: "Failed to save assignment" },
      { status: 500 }
    );
  }
}
