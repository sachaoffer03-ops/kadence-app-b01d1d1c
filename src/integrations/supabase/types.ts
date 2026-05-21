export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_planning_settings: {
        Row: {
          availability_deadline_day: number | null
          cdi_hours_tolerance: number
          default_score_when_null: number
          enforce_max_weekly_cdi: boolean
          enforce_rest_11h: boolean
          enforce_student_quota: boolean
          id: string
          max_shift_hours: number
          max_shift_hours_cdi: number
          max_shift_hours_flexi: number
          max_shift_hours_student: number
          max_weekly_cdi_hours: number
          max_weekly_flexi_hours: number
          max_weekly_student_hours: number
          min_shift_hours: number
          strict_preferences: boolean
          target_weekly_cdi_hours: number
          updated_at: string
          updated_by: string | null
          weight_equity: number
          weight_performance: number
          weight_preference: number
          weight_random: number
        }
        Insert: {
          availability_deadline_day?: number | null
          cdi_hours_tolerance?: number
          default_score_when_null?: number
          enforce_max_weekly_cdi?: boolean
          enforce_rest_11h?: boolean
          enforce_student_quota?: boolean
          id?: string
          max_shift_hours?: number
          max_shift_hours_cdi?: number
          max_shift_hours_flexi?: number
          max_shift_hours_student?: number
          max_weekly_cdi_hours?: number
          max_weekly_flexi_hours?: number
          max_weekly_student_hours?: number
          min_shift_hours?: number
          strict_preferences?: boolean
          target_weekly_cdi_hours?: number
          updated_at?: string
          updated_by?: string | null
          weight_equity?: number
          weight_performance?: number
          weight_preference?: number
          weight_random?: number
        }
        Update: {
          availability_deadline_day?: number | null
          cdi_hours_tolerance?: number
          default_score_when_null?: number
          enforce_max_weekly_cdi?: boolean
          enforce_rest_11h?: boolean
          enforce_student_quota?: boolean
          id?: string
          max_shift_hours?: number
          max_shift_hours_cdi?: number
          max_shift_hours_flexi?: number
          max_shift_hours_student?: number
          max_weekly_cdi_hours?: number
          max_weekly_flexi_hours?: number
          max_weekly_student_hours?: number
          min_shift_hours?: number
          strict_preferences?: boolean
          target_weekly_cdi_hours?: number
          updated_at?: string
          updated_by?: string | null
          weight_equity?: number
          weight_performance?: number
          weight_preference?: number
          weight_random?: number
        }
        Relationships: []
      }
      availabilities: {
        Row: {
          avail_date: string
          created_at: string
          end_time: string
          id: string
          start_time: string
          user_id: string
        }
        Insert: {
          avail_date: string
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          user_id: string
        }
        Update: {
          avail_date?: string
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      business_roles: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_kitchen: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_kitchen?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_kitchen?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      checklist_submission_items: {
        Row: {
          checked_at: string | null
          id: string
          is_checked: boolean
          submission_id: string
          template_item_id: string
        }
        Insert: {
          checked_at?: string | null
          id?: string
          is_checked?: boolean
          submission_id: string
          template_item_id: string
        }
        Update: {
          checked_at?: string | null
          id?: string
          is_checked?: boolean
          submission_id?: string
          template_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_submission_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "checklist_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submission_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_submission_photos: {
        Row: {
          ai_validated_at: string | null
          ai_validation_message: string | null
          ai_validation_status: string | null
          id: string
          photo_url: string | null
          submission_id: string
          template_photo_id: string
          uploaded_at: string | null
        }
        Insert: {
          ai_validated_at?: string | null
          ai_validation_message?: string | null
          ai_validation_status?: string | null
          id?: string
          photo_url?: string | null
          submission_id: string
          template_photo_id: string
          uploaded_at?: string | null
        }
        Update: {
          ai_validated_at?: string | null
          ai_validation_message?: string | null
          ai_validation_status?: string | null
          id?: string
          photo_url?: string | null
          submission_id?: string
          template_photo_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_submission_photos_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "checklist_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submission_photos_template_photo_id_fkey"
            columns: ["template_photo_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_submissions: {
        Row: {
          admin_feedback: string | null
          created_at: string
          employee_note: string | null
          id: string
          phase: string
          reviewed_by_admin_at: string | null
          reviewed_by_admin_id: string | null
          shift_id: string
          status: string
          submitted_at: string | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_feedback?: string | null
          created_at?: string
          employee_note?: string | null
          id?: string
          phase?: string
          reviewed_by_admin_at?: string | null
          reviewed_by_admin_id?: string | null
          shift_id: string
          status?: string
          submitted_at?: string | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_feedback?: string | null
          created_at?: string
          employee_note?: string | null
          id?: string
          phase?: string
          reviewed_by_admin_at?: string | null
          reviewed_by_admin_id?: string | null
          shift_id?: string
          status?: string
          submitted_at?: string | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          label: string
          order_index: number
          photo_zone_id: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label: string
          order_index?: number
          photo_zone_id?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label?: string
          order_index?: number
          photo_zone_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_photo_zone_id_fkey"
            columns: ["photo_zone_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_photos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          label: string
          order_index: number
          reference_photo_url: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label: string
          order_index?: number
          reference_photo_url?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label?: string
          order_index?: number
          reference_photo_url?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_photos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          ai_detection_hint: string | null
          ai_validation_threshold: number
          analyze_with_ai: boolean
          business_role_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_blocking: boolean
          min_photos_required: number
          name: string
          phase: string
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          ai_detection_hint?: string | null
          ai_validation_threshold?: number
          analyze_with_ai?: boolean
          business_role_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          min_photos_required?: number
          name: string
          phase?: string
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_detection_hint?: string | null
          ai_validation_threshold?: number
          analyze_with_ai?: boolean
          business_role_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          min_photos_required?: number
          name?: string
          phase?: string
          studio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_business_role_id_fkey"
            columns: ["business_role_id"]
            isOneToOne: false
            referencedRelation: "business_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      closure_question_responses: {
        Row: {
          created_at: string
          id: string
          question_id: string
          stars_value: number | null
          submission_id: string
          text_value: string | null
          yesno_value: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          stars_value?: number | null
          submission_id: string
          text_value?: string | null
          yesno_value?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          stars_value?: number | null
          submission_id?: string
          text_value?: string | null
          yesno_value?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "closure_question_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "closure_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closure_question_responses_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "checklist_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      closure_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          order_index: number
          question_text: string
          response_type: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          order_index?: number
          question_text: string
          response_type?: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          order_index?: number
          question_text?: string
          response_type?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closure_questions_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          description: string | null
          file_mime_type: string | null
          file_path: string
          file_size_bytes: number
          first_viewed_at: string | null
          id: string
          is_archived: boolean
          period_end: string | null
          period_start: string | null
          title: string
          type: string
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_mime_type?: string | null
          file_path: string
          file_size_bytes?: number
          first_viewed_at?: string | null
          id?: string
          is_archived?: boolean
          period_end?: string | null
          period_start?: string | null
          title: string
          type: string
          updated_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_mime_type?: string | null
          file_path?: string
          file_size_bytes?: number
          first_viewed_at?: string | null
          id?: string
          is_archived?: boolean
          period_end?: string | null
          period_start?: string | null
          title?: string
          type?: string
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          admin_reply: string | null
          author_id: string
          created_at: string
          id: string
          message: string | null
          rating: number
          read_at: string | null
          shift_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          author_id: string
          created_at?: string
          id?: string
          message?: string | null
          rating: number
          read_at?: string | null
          shift_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          author_id?: string
          created_at?: string
          id?: string
          message?: string | null
          rating?: number
          read_at?: string | null
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          app_role: Database["public"]["Enums"]["app_role"]
          business_roles: string[]
          contract: Database["public"]["Enums"]["contract_type"] | null
          contracts: Database["public"]["Enums"]["contract_type"][]
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          studio_id: string | null
          studio_ids: string[]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          app_role?: Database["public"]["Enums"]["app_role"]
          business_roles?: string[]
          contract?: Database["public"]["Enums"]["contract_type"] | null
          contracts?: Database["public"]["Enums"]["contract_type"][]
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          studio_id?: string | null
          studio_ids?: string[]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          app_role?: Database["public"]["Enums"]["app_role"]
          business_roles?: string[]
          contract?: Database["public"]["Enums"]["contract_type"] | null
          contracts?: Database["public"]["Enums"]["contract_type"][]
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          studio_id?: string | null
          studio_ids?: string[]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      modification_requests: {
        Row: {
          admin_actor_id: string | null
          admin_response: string | null
          created_at: string
          id: string
          proposed_end_date: string | null
          proposed_end_time: string | null
          proposed_start_date: string | null
          proposed_start_time: string | null
          reason: string
          resolved_at: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["modification_status"]
          type: Database["public"]["Enums"]["modification_type"]
          urgency: Database["public"]["Enums"]["modification_urgency"]
          user_id: string
        }
        Insert: {
          admin_actor_id?: string | null
          admin_response?: string | null
          created_at?: string
          id?: string
          proposed_end_date?: string | null
          proposed_end_time?: string | null
          proposed_start_date?: string | null
          proposed_start_time?: string | null
          reason: string
          resolved_at?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["modification_status"]
          type: Database["public"]["Enums"]["modification_type"]
          urgency?: Database["public"]["Enums"]["modification_urgency"]
          user_id: string
        }
        Update: {
          admin_actor_id?: string | null
          admin_response?: string | null
          created_at?: string
          id?: string
          proposed_end_date?: string | null
          proposed_end_time?: string | null
          proposed_start_date?: string | null
          proposed_start_time?: string | null
          reason?: string
          resolved_at?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["modification_status"]
          type?: Database["public"]["Enums"]["modification_type"]
          urgency?: Database["public"]["Enums"]["modification_urgency"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modification_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          priority: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_publications: {
        Row: {
          id: string
          period_end: string
          period_start: string
          published_at: string
          published_by: string
          shifts_count: number
        }
        Insert: {
          id?: string
          period_end: string
          period_start: string
          published_at?: string
          published_by: string
          shifts_count?: number
        }
        Update: {
          id?: string
          period_end?: string
          period_start?: string
          published_at?: string
          published_by?: string
          shifts_count?: number
        }
        Relationships: []
      }
      planning_runs: {
        Row: {
          alerts: Json | null
          completed_at: string | null
          coverage_rate: number | null
          dry_run: boolean
          duration_ms: number | null
          error_message: string | null
          id: string
          marked_review_at: string | null
          marked_review_by: string | null
          month_end_date: string
          month_start_date: string
          preserve_locked: boolean
          preserve_manual: boolean
          published_at: string | null
          published_by: string | null
          shifts_generated: number
          shifts_with_holes: number
          solver_logs: Json | null
          started_at: string
          status: string
          studios_included: string[]
          triggered_by: string | null
          unpublished_at: string | null
          unpublished_by: string | null
          unpublished_reason: string | null
          workflow_status: string | null
        }
        Insert: {
          alerts?: Json | null
          completed_at?: string | null
          coverage_rate?: number | null
          dry_run?: boolean
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          marked_review_at?: string | null
          marked_review_by?: string | null
          month_end_date: string
          month_start_date: string
          preserve_locked?: boolean
          preserve_manual?: boolean
          published_at?: string | null
          published_by?: string | null
          shifts_generated?: number
          shifts_with_holes?: number
          solver_logs?: Json | null
          started_at?: string
          status: string
          studios_included?: string[]
          triggered_by?: string | null
          unpublished_at?: string | null
          unpublished_by?: string | null
          unpublished_reason?: string | null
          workflow_status?: string | null
        }
        Update: {
          alerts?: Json | null
          completed_at?: string | null
          coverage_rate?: number | null
          dry_run?: boolean
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          marked_review_at?: string | null
          marked_review_by?: string | null
          month_end_date?: string
          month_start_date?: string
          preserve_locked?: boolean
          preserve_manual?: boolean
          published_at?: string | null
          published_by?: string | null
          shifts_generated?: number
          shifts_with_holes?: number
          solver_logs?: Json | null
          started_at?: string
          status?: string
          studios_included?: string[]
          triggered_by?: string | null
          unpublished_at?: string | null
          unpublished_by?: string | null
          unpublished_reason?: string | null
          workflow_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_runs_marked_review_by_fkey"
            columns: ["marked_review_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_runs_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_runs_unpublished_by_fkey"
            columns: ["unpublished_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          contract: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          iban: string | null
          id: string
          is_protected: boolean
          is_test: boolean
          last_name: string
          nationality: string | null
          niss: string | null
          phone: string | null
          quota_max: number | null
          quota_used: number | null
          score: number | null
          status: Database["public"]["Enums"]["profile_status"]
          student_card_valid: boolean | null
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          iban?: string | null
          id: string
          is_protected?: boolean
          is_test?: boolean
          last_name?: string
          nationality?: string | null
          niss?: string | null
          phone?: string | null
          quota_max?: number | null
          quota_used?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["profile_status"]
          student_card_valid?: boolean | null
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          iban?: string | null
          id?: string
          is_protected?: boolean
          is_test?: boolean
          last_name?: string
          nationality?: string | null
          niss?: string | null
          phone?: string | null
          quota_max?: number | null
          quota_used?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["profile_status"]
          student_card_valid?: boolean | null
          studio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_settings: {
        Row: {
          checklist_bonus_per_photo_item: number
          checklist_complete: number
          checklist_penalty_per_missed: number
          checklist_strictness: string
          expert_mode_unlocked: boolean
          id: string
          photos_all_validated: number
          photos_importance: string
          photos_penalty_per_refused: number
          profile_name: string
          punct_0min: number
          punct_15min: number
          punct_30min: number
          punct_5min: number
          punct_noshow: number
          punct_over: number
          punctuality_tolerance: string
          updated_at: string
          updated_by: string | null
          weight_checklist: number
          weight_photos: number
          weight_punctuality: number
        }
        Insert: {
          checklist_bonus_per_photo_item?: number
          checklist_complete?: number
          checklist_penalty_per_missed?: number
          checklist_strictness?: string
          expert_mode_unlocked?: boolean
          id?: string
          photos_all_validated?: number
          photos_importance?: string
          photos_penalty_per_refused?: number
          profile_name?: string
          punct_0min?: number
          punct_15min?: number
          punct_30min?: number
          punct_5min?: number
          punct_noshow?: number
          punct_over?: number
          punctuality_tolerance?: string
          updated_at?: string
          updated_by?: string | null
          weight_checklist?: number
          weight_photos?: number
          weight_punctuality?: number
        }
        Update: {
          checklist_bonus_per_photo_item?: number
          checklist_complete?: number
          checklist_penalty_per_missed?: number
          checklist_strictness?: string
          expert_mode_unlocked?: boolean
          id?: string
          photos_all_validated?: number
          photos_importance?: string
          photos_penalty_per_refused?: number
          profile_name?: string
          punct_0min?: number
          punct_15min?: number
          punct_30min?: number
          punct_5min?: number
          punct_noshow?: number
          punct_over?: number
          punctuality_tolerance?: string
          updated_at?: string
          updated_by?: string | null
          weight_checklist?: number
          weight_photos?: number
          weight_punctuality?: number
        }
        Relationships: []
      }
      shift_clock_audit: {
        Row: {
          action: string
          actor_id: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          note: string | null
          shift_id: string
        }
        Insert: {
          action: string
          actor_id: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          shift_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_clock_audit_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handoffs: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          shift_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          shift_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_handoffs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_proposals: {
        Row: {
          id: string
          replacement_request_id: string | null
          responded_at: string | null
          sent_at: string
          sent_by: string | null
          shift_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          replacement_request_id?: string | null
          responded_at?: string | null
          sent_at?: string
          sent_by?: string | null
          shift_id: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          replacement_request_id?: string | null
          responded_at?: string | null
          sent_at?: string
          sent_by?: string | null
          shift_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_proposals_replacement_request_id_fkey"
            columns: ["replacement_request_id"]
            isOneToOne: false
            referencedRelation: "modification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_proposals_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_reports: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          resolved: boolean
          shift_id: string | null
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          shift_id?: string | null
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          business_role: string
          clock_admin_note: string | null
          clocked_in_at: string | null
          clocked_out_at: string | null
          created_at: string
          dimona_status: string | null
          end_time: string
          id: string
          is_locked: boolean
          is_manual: boolean
          minutes_late: number | null
          notes: string | null
          published_at: string | null
          shift_date: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          studio_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_role: string
          clock_admin_note?: string | null
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          created_at?: string
          dimona_status?: string | null
          end_time: string
          id?: string
          is_locked?: boolean
          is_manual?: boolean
          minutes_late?: number | null
          notes?: string | null
          published_at?: string | null
          shift_date: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          studio_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_role?: string
          clock_admin_note?: string | null
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          created_at?: string
          dimona_status?: string | null
          end_time?: string
          id?: string
          is_locked?: boolean
          is_manual?: boolean
          minutes_late?: number | null
          notes?: string | null
          published_at?: string | null
          shift_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          studio_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signalements: {
        Row: {
          author_id: string
          category: Database["public"]["Enums"]["signalement_category"]
          created_at: string
          id: string
          message: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          studio_id: string | null
        }
        Insert: {
          author_id: string
          category: Database["public"]["Enums"]["signalement_category"]
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          studio_id?: string | null
        }
        Update: {
          author_id?: string
          category?: Database["public"]["Enums"]["signalement_category"]
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          studio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signalements_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_templates: {
        Row: {
          allowed_contracts: Database["public"]["Enums"]["contract_type"][]
          allowed_roles: string[]
          business_role: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_optional: boolean
          required_contract: Database["public"]["Enums"]["contract_type"] | null
          required_count: number
          start_time: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          allowed_contracts?: Database["public"]["Enums"]["contract_type"][]
          allowed_roles?: string[]
          business_role: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_optional?: boolean
          required_contract?:
            | Database["public"]["Enums"]["contract_type"]
            | null
          required_count?: number
          start_time: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          allowed_contracts?: Database["public"]["Enums"]["contract_type"][]
          allowed_roles?: string[]
          business_role?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_optional?: boolean
          required_contract?:
            | Database["public"]["Enums"]["contract_type"]
            | null
          required_count?: number
          start_time?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_business_roles: {
        Row: {
          created_at: string
          role: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          role: string
          studio_id: string
        }
        Update: {
          created_at?: string
          role?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_business_roles_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_exceptions: {
        Row: {
          created_at: string
          date_label: string | null
          description: string | null
          exception_date: string
          exception_type: string
          hours_adjust: string | null
          id: string
          staff_adjustments: Json
          studio_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_label?: string | null
          description?: string | null
          exception_date: string
          exception_type: string
          hours_adjust?: string | null
          id?: string
          staff_adjustments?: Json
          studio_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_label?: string | null
          description?: string | null
          exception_date?: string
          exception_type?: string
          hours_adjust?: string | null
          id?: string
          staff_adjustments?: Json
          studio_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_exceptions_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          clock_in_grace_period_min: number
          clock_out_button_appears_before_min: number
          clock_out_grace_period_min: number
          clock_out_overdue_action: string
          color: string | null
          created_at: string
          current_qr_code: string | null
          deleted_at: string | null
          description: string | null
          email: string | null
          geofencing_enabled: boolean
          geofencing_radius_m: number
          has_kitchen: boolean
          id: string
          internal_notes: string | null
          lat: number | null
          lng: number | null
          manager_id: string | null
          manager_name: string | null
          name: string
          opened_at: string | null
          opening_hours: string | null
          phone: string | null
          postal_code: string | null
          qr_display_support: string
          qr_renewal_seconds: number
          role_hours: Json
          short_name: string | null
          surface_m2: number | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          clock_in_grace_period_min?: number
          clock_out_button_appears_before_min?: number
          clock_out_grace_period_min?: number
          clock_out_overdue_action?: string
          color?: string | null
          created_at?: string
          current_qr_code?: string | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          geofencing_enabled?: boolean
          geofencing_radius_m?: number
          has_kitchen?: boolean
          id?: string
          internal_notes?: string | null
          lat?: number | null
          lng?: number | null
          manager_id?: string | null
          manager_name?: string | null
          name: string
          opened_at?: string | null
          opening_hours?: string | null
          phone?: string | null
          postal_code?: string | null
          qr_display_support?: string
          qr_renewal_seconds?: number
          role_hours?: Json
          short_name?: string | null
          surface_m2?: number | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          clock_in_grace_period_min?: number
          clock_out_button_appears_before_min?: number
          clock_out_grace_period_min?: number
          clock_out_overdue_action?: string
          color?: string | null
          created_at?: string
          current_qr_code?: string | null
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          geofencing_enabled?: boolean
          geofencing_radius_m?: number
          has_kitchen?: boolean
          id?: string
          internal_notes?: string | null
          lat?: number | null
          lng?: number | null
          manager_id?: string | null
          manager_name?: string | null
          name?: string
          opened_at?: string | null
          opening_hours?: string | null
          phone?: string | null
          postal_code?: string | null
          qr_display_support?: string
          qr_renewal_seconds?: number
          role_hours?: Json
          short_name?: string | null
          surface_m2?: number | null
        }
        Relationships: []
      }
      training_content_progress: {
        Row: {
          completed_at: string | null
          content_id: string
          first_accessed_at: string | null
          id: string
          last_accessed_at: string | null
          progress_pct: number
          status: string
          time_spent_seconds: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          first_accessed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          progress_pct?: number
          status?: string
          time_spent_seconds?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          first_accessed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          progress_pct?: number
          status?: string
          time_spent_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_content_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "training_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      training_contents: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          external_url: string | null
          id: string
          module_id: string
          position: number
          text_content: string | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          id?: string
          module_id: string
          position?: number
          text_content?: string | null
          title: string
          type: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          id?: string
          module_id?: string
          position?: number
          text_content?: string | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_contents_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_course_completions: {
        Row: {
          completed_at: string
          course_id: string
          id: string
          total_time_spent_seconds: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          course_id: string
          id?: string
          total_time_spent_seconds?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          course_id?: string
          id?: string
          total_time_spent_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_course_completions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      training_courses: {
        Row: {
          business_role_id: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_published: boolean
          is_required_for_all: boolean
          passing_quiz_score: number
          position: number
          required_for_planning: boolean
          title: string
          updated_at: string
        }
        Insert: {
          business_role_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          is_required_for_all?: boolean
          passing_quiz_score?: number
          position?: number
          required_for_planning?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          business_role_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          is_required_for_all?: boolean
          passing_quiz_score?: number
          position?: number
          required_for_planning?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_courses_business_role_id_fkey"
            columns: ["business_role_id"]
            isOneToOne: false
            referencedRelation: "business_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          created_at: string
          description: string | null
          duration_estimate_min: number | null
          has_final_quiz: boolean
          id: string
          position: number
          section_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_estimate_min?: number | null
          has_final_quiz?: boolean
          id?: string
          position?: number
          section_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_estimate_min?: number | null
          has_final_quiz?: boolean
          id?: string
          position?: number
          section_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option_ids: string[]
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean
          question_id: string
          selected_option_ids?: string[]
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "training_quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "training_quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_attempts: {
        Row: {
          attempt_number: number
          completed_at: string | null
          id: string
          passed: boolean | null
          quiz_id: string
          score: number | null
          started_at: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          attempt_number?: number
          completed_at?: string | null
          id?: string
          passed?: boolean | null
          quiz_id: string
          score?: number | null
          started_at?: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          id?: string
          passed?: boolean | null
          quiz_id?: string
          score?: number | null
          started_at?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_options: {
        Row: {
          id: string
          is_correct: boolean
          option_text: string
          position: number
          question_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          option_text: string
          position?: number
          question_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          option_text?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "training_quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          position: number
          question_text: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          position?: number
          question_text: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          position?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quizzes: {
        Row: {
          created_at: string
          id: string
          module_id: string
          passing_score: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          passing_score?: number
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          passing_score?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sections: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      unavailability_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          source_request_id: string | null
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          source_request_id?: string | null
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          source_request_id?: string | null
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unavailability_periods_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "modification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_business_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_contracts: {
        Row: {
          contract: Database["public"]["Enums"]["contract_type"]
          created_at: string
          user_id: string
        }
        Insert: {
          contract: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          user_id: string
        }
        Update: {
          contract?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_studios: {
        Row: {
          created_at: string
          studio_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          studio_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_profile_score: {
        Args: { target_user_id: string }
        Returns: number
      }
      can_see_handoff: {
        Args: { _from_shift_id: string; _user_id: string }
        Returns: boolean
      }
      force_delete_studio: { Args: { _studio_id: string }; Returns: Json }
      get_default_admin: {
        Args: never
        Returns: {
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      get_worked_hours: {
        Args: {
          period_end?: string
          period_start?: string
          target_user_id: string
        }
        Returns: {
          avg_minutes_late: number
          shift_count: number
          total_hours: number
          total_minutes: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_studio: { Args: { dst_id: string; src_id: string }; Returns: Json }
      migrate_studios_v2: {
        Args: { caller_id: string; pairs: Json }
        Returns: Json
      }
      recalculate_all_scores: { Args: never; Returns: number }
      studio_blockers: { Args: { _studio_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      availability_slot: "matin" | "midi" | "soir"
      contract_type: "Étudiant" | "Flexi" | "CDI"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      modification_status: "pending" | "accepted" | "refused"
      modification_type: "swap" | "cancel" | "time_change" | "unavailable"
      modification_urgency: "normal" | "urgent" | "critique"
      profile_status: "invited" | "active" | "suspended"
      shift_status: "scheduled" | "completed" | "cancelled" | "open" | "draft"
      signalement_category: "stock" | "materiel" | "hygiene" | "autre"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "employee"],
      availability_slot: ["matin", "midi", "soir"],
      contract_type: ["Étudiant", "Flexi", "CDI"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      modification_status: ["pending", "accepted", "refused"],
      modification_type: ["swap", "cancel", "time_change", "unavailable"],
      modification_urgency: ["normal", "urgent", "critique"],
      profile_status: ["invited", "active", "suspended"],
      shift_status: ["scheduled", "completed", "cancelled", "open", "draft"],
      signalement_category: ["stock", "materiel", "hygiene", "autre"],
    },
  },
} as const
