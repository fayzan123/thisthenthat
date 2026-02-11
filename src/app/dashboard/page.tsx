"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Upload, LogOut, FileText, User, MoreVertical, Trash2, CheckCircle2, Archive, RotateCcw, ChevronDown } from "lucide-react";
import type { Assignment, ChecklistStep } from "@/lib/types";

interface AssignmentWithProgress extends Assignment {
  steps: ChecklistStep[];
  completedCount: number;
  totalSteps: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const { data: assignments = [], mutate } = useSWR<AssignmentWithProgress[]>(
    "/api/assignments",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const activeAssignments = assignments.filter((a) => !a.completed);
  const completedAssignments = assignments.filter((a) => a.completed);

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
      mutate();
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

  async function handleDelete(assignmentId: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm("Delete this assignment? This cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
      mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete assignment");
    }
  }

  async function handleToggleComplete(assignmentId: string, currentlyCompleted: boolean, e: React.MouseEvent) {
    e.stopPropagation();

    try {
      const { error } = await supabase
        .from("assignments")
        .update({ completed: !currentlyCompleted })
        .eq("id", assignmentId);

      if (error) throw error;
      mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update assignment");
    }
  }

  function renderAssignmentCard(assignment: AssignmentWithProgress) {
    const progress =
      assignment.totalSteps > 0
        ? (assignment.completedCount / assignment.totalSteps) * 100
        : 0;

    return (
      <Card
        key={assignment.id}
        className={`group relative cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
          assignment.completed ? "opacity-75" : ""
        }`}
        onClick={() => router.push(`/dashboard/${assignment.id}`)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="line-clamp-2 text-base">
                {assignment.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {new Date(assignment.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => handleToggleComplete(assignment.id, assignment.completed, e)}
                >
                  {assignment.completed ? (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reopen
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Mark Complete
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => handleDelete(assignment.id, e)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {assignment.completedCount}/{assignment.totalSteps} steps
              </p>
              {assignment.completed && (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold tracking-tight text-primary">ThisThenThat</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Your Assignments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a PDF to generate a step-by-step checklist.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setSelectedFile(null);
                setError(null);
              }
            }}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Assignment
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
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 p-10 transition-colors hover:border-primary/40 hover:bg-primary/10">
                  <label className="flex cursor-pointer flex-col items-center gap-3">
                    {selectedFile ? (
                      <>
                        <div className="rounded-full bg-primary/10 p-3">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-sm font-medium">
                          {selectedFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Click to change file
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="rounded-full bg-muted p-3">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">
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
                <Button type="submit" className="h-11 w-full text-base" disabled={uploading || !selectedFile}>
                  {uploading ? "Processing..." : "Generate Checklist"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 py-20">
            <div className="rounded-full bg-primary/10 p-4">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <p className="mt-4 text-lg font-medium">
              No assignments yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first assignment to get started
            </p>
          </div>
        ) : (
          <>
            {/* Active assignments */}
            {activeAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 py-16">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <p className="mt-4 text-lg font-medium">All caught up!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No active assignments. Upload a new one to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeAssignments.map(renderAssignmentCard)}
              </div>
            )}

            {/* Completed assignments */}
            {completedAssignments.length > 0 && (
              <div className="mt-10">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowCompleted(!showCompleted)}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showCompleted ? "" : "-rotate-90"}`} />
                  Completed ({completedAssignments.length})
                </button>

                {showCompleted && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {completedAssignments.map(renderAssignmentCard)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
