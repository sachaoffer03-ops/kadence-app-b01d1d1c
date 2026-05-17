export type ResourceType = "video" | "pdf" | "note" | "link";
export type ProgressStatus = "not_started" | "in_progress" | "completed";

export interface TrainingFolder {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order_index: number;
  required_for_roles: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TrainingStep {
  id: string;
  folder_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingResource {
  id: string;
  step_id: string;
  type: ResourceType;
  title: string;
  content: string;
  duration_seconds: number | null;
  order_index: number;
  is_uploaded_video?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingProgress {
  id: string;
  user_id: string;
  resource_id: string;
  status: ProgressStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderWithContent extends TrainingFolder {
  steps: (TrainingStep & { resources: TrainingResource[] })[];
}

export interface FolderInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  required_for_roles?: string[];
}

export interface StepInput {
  title: string;
  description?: string | null;
}

export interface ResourceInput {
  type: ResourceType;
  title: string;
  content: string;
  duration_seconds?: number | null;
  is_uploaded_video?: boolean;
}
