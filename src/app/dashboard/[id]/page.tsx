"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";
import type { Assignment, ChecklistStep } from "@/lib/types";
import { StepChatPanel } from "@/components/step-chat-panel";

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [activeStep, setActiveStep] = useState<ChecklistStep | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: assignmentData }, { data: stepsData }] = await Promise.all([
      supabase.from("assignments").select("*").eq("id", id).single(),
      supabase
        .from("checklist_steps")
        .select("*")
        .eq("assignment_id", id)
        .order("step_number"),
    ]);

    if (assignmentData) setAssignment(assignmentData);
    if (stepsData) setSteps(stepsData);
  }, [id, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleStep(step: ChecklistStep) {
    const newCompleted = !step.completed;

    await supabase
      .from("checklist_steps")
      .update({ completed: newCompleted })
      .eq("id", step.id);

    setSteps((prev) =>
      prev.map((s) =>
        s.id === step.id ? { ...s, completed: newCompleted } : s
      )
    );

    if (activeStep?.id === step.id) {
      setActiveStep({ ...step, completed: newCompleted });
    }
  }

  if (!assignment) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{assignment.title}</h1>
            <p className="text-sm text-muted-foreground">
              {completedCount}/{steps.length} steps complete
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <Progress value={progress} className="mb-6 h-2" />

        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent ${
                activeStep?.id === step.id ? "border-primary bg-accent" : ""
              }`}
              onClick={() => setActiveStep(step)}
            >
              <div
                className="mt-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStep(step);
                }}
              >
                <Checkbox checked={step.completed} />
              </div>
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    step.completed ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {step.step_number}. {step.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeStep && (
        <StepChatPanel
          step={activeStep}
          assignment={assignment}
          steps={steps}
          onClose={() => setActiveStep(null)}
          onToggleComplete={() => toggleStep(activeStep)}
        />
      )}
    </div>
  );
}