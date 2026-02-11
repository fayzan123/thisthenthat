export interface Assignment {
  id: string;
  user_id: string;
  title: string;
  original_text: string;
  created_at: string;
}

export interface ChecklistStep {
  id: string;
  assignment_id: string;
  step_number: number;
  title: string;
  description: string;
  completed: boolean;
  chat_history: ChatMessage[];
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}