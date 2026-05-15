export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  business_role_id: string | null;
  studio_id: string | null;
  is_blocking: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  label: string;
  description: string | null;
  is_required: boolean;
  order_index: number;
  created_at: string;
}

export interface ChecklistTemplatePhoto {
  id: string;
  template_id: string;
  label: string;
  description: string | null;
  reference_photo_url: string | null;
  is_required: boolean;
  order_index: number;
  created_at: string;
}

export interface ChecklistSubmission {
  id: string;
  shift_id: string;
  template_id: string;
  user_id: string;
  status: "pending" | "in_progress" | "submitted" | "reviewed";
  employee_note: string | null;
  submitted_at: string | null;
  reviewed_by_admin_at: string | null;
  reviewed_by_admin_id: string | null;
  admin_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistSubmissionItem {
  id: string;
  submission_id: string;
  template_item_id: string;
  is_checked: boolean;
  checked_at: string | null;
}

export interface ChecklistSubmissionPhoto {
  id: string;
  submission_id: string;
  template_photo_id: string;
  photo_url: string | null;
  uploaded_at: string | null;
  ai_validation_status: string | null;
  ai_validation_message: string | null;
  ai_validated_at: string | null;
}

export interface TemplateWithContent extends ChecklistTemplate {
  items: ChecklistTemplateItem[];
  photos: ChecklistTemplatePhoto[];
}
