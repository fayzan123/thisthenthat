import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: assignmentData } = await supabase
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false });

    if (!assignmentData) {
      return NextResponse.json([]);
    }

    const withProgress = await Promise.all(
      assignmentData.map(async (assignment) => {
        const { data: steps } = await supabase
          .from("checklist_steps")
          .select("*")
          .eq("assignment_id", assignment.id)
          .order("step_number");

        const stepsArr = steps || [];
        return {
          ...assignment,
          steps: stepsArr,
          completedCount: stepsArr.filter((s) => s.completed).length,
          totalSteps: stepsArr.length,
        };
      })
    );

    return NextResponse.json(withProgress);
  } catch (error) {
    console.error("Fetch assignments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}