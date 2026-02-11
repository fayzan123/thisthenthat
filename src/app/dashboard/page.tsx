"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Upload, LogOut, FileText, User } from "lucide-react";
import type { Assignment, ChecklistStep } from "@/lib/types";

interface AssignmentWithProgress extends Assignment {
  steps: ChecklistStep[];
  completedCount: number;
  totalSteps: number;
}

export default function DashboardPage() {
  const [assignments, setAssignments] = useState<AssignmentWithProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadAssignments = useCallback(async () => {
    const { data: assignmentData } = await supabase
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false });

    if (!assignmentData) return;

    const withProgress: AssignmentWithProgress[] = await Promise.all(
      assignmentData.map(async (assignment: Assignment) => {
        const { data: steps } = await supabase
          .from("checklist_steps")
          .select("*")
          .eq("assignment_id", assignment.id)
          .order("step_number");

        const stepsArr = (steps || []) as ChecklistStep[];
        return {
          ...assignment,
          steps: stepsArr,
          completedCount: stepsArr.filter((s) => s.completed).length,
          totalSteps: stepsArr.length,
        };
      })
    );

    setAssignments(withProgress);
  }, [supabase]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("pdf") as File;

    if (!file || file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setUploading(false);
      return;
    }

    try {
      const uploadData = new FormData();
      uploadData.append("pdf", file);

      const res = await fetch("/api/parse-assignment", {
        method: "POST",
        body: uploadData,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to process assignment");
      }

      setDialogOpen(false);
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold">ThisThenThat</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Your Assignments</h2>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setSelectedFile(null);
                setError(null);
              }
            }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Upload Assignment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Assignment</DialogTitle>
                <DialogDescription>
                  Upload a PDF of your assignment and we&apos;ll generate a
                  step-by-step checklist for you.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-8">
                  <label className="flex cursor-pointer flex-col items-center gap-2">
                    {selectedFile ? (
                      <>
                        <FileText className="h-8 w-8 text-primary" />
                        <span className="text-sm font-medium">
                          {selectedFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Click to change file
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Click to select a PDF
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      name="pdf"
                      accept="application/pdf"
                      className="hidden"
                      required
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? "Processing..." : "Generate Checklist"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              No assignments yet
            </p>
            <p className="text-sm text-muted-foreground">
              Upload your first assignment to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => {
              const progress =
                assignment.totalSteps > 0
                  ? (assignment.completedCount / assignment.totalSteps) * 100
                  : 0;

              return (
                <Card
                  key={assignment.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() =>
                    router.push(`/dashboard/${assignment.id}`)
                  }
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-base">
                      {assignment.title}
                    </CardTitle>
                    <CardDescription>
                      {new Date(assignment.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {assignment.completedCount}/{assignment.totalSteps}{" "}
                        steps complete
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}