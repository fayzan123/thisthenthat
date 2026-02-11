"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, MessageCircle, CheckCircle2, Archive, RotateCcw } from "lucide-react";
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

  async function toggleAssignmentComplete() {
    if (!assignment) return;
    const newCompleted = !assignment.completed;

    await supabase
      .from("assignments")
      .update({ completed: newCompleted })
      .eq("id", assignment.id);

    setAssignment({ ...assignment, completed: newCompleted });
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
  const isComplete = progress === 100 && steps.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">{assignment.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {completedCount}/{steps.length} steps complete
              </p>
              {isComplete && (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
            </div>
          </div>
          <Button
            variant={assignment.completed ? "secondary" : "default"}
            size="sm"
            onClick={toggleAssignmentComplete}
          >
            {assignment.completed ? (
              <>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reopen
              </>
            ) : (
              <>
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Complete
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2.5" />
        </div>

        <div className="space-y-2">
          {steps.map((step) => {
            const isActive = activeStep?.id === step.id;
            const hasChat = step.chat_history && step.chat_history.length > 0;

            return (
              <div
                key={step.id}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-sm ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : step.completed
                      ? "border-transparent bg-muted/50"
                      : "hover:bg-accent"
                }`}
                onClick={() => setActiveStep(step)}
              >
                <div
                  className="mt-0.5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStep(step);
                  }}
                >
                  <Checkbox checked={step.completed} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {step.step_number}
                    </span>
                    <p
                      className={`font-medium ${
                        step.completed ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                <div className="shrink-0 mt-0.5">
                  {hasChat ? (
                    <MessageCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </div>
              </div>
            );
          })}
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
