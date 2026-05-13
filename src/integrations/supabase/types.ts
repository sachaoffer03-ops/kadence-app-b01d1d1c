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
          enforce_max_weekly_cdi: boolean
          enforce_rest_11h: boolean
          enforce_student_quota: boolean
          id: string
          strict_preferences: boolean
          updated_at: string
          updated_by: string | null
          weight_equity: number
          weight_performance: number
          weight_preference: number
          weight_random: number
        }
        Insert: {
          enforce_max_weekly_cdi?: boolean
          enforce_rest_11h?: boolean
          enforce_student_quota?: boolean
          id?: string
          strict_preferences?: boolean
          updated_at?: string
          updated_by?: string | null
          weight_equity?: number
          weight_performance?: number
          weight_preference?: number
          weight_random?: number
        }
        Update: {
          enforce_max_weekly_cdi?: boolean
          enforce_rest_11h?: boolean
          enforce_student_quota?: boolean
          id?: string
          strict_preferences?: boolean
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
          id: string
          slot: Database["public"]["Enums"]["availability_slot"]
          user_id: string
        }
        Insert: {
          avail_date: string
          created_at?: string
          id?: string
          slot: Database["public"]["Enums"]["availability_slot"]
          user_id: string
        }
        Update: {
          avail_date?: string
          created_at?: string
          id?: string
          slot?: Database["public"]["Enums"]["availability_slot"]
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
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          business_role: string
          created_at: string
          id: string
          items: Json
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          business_role: string
          created_at?: string
          id?: string
          items?: Json
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          business_role?: string
          created_at?: string
          id?: string
          items?: Json
          studio_id?: string | null
          updated_at?: string
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
      formation_completions: {
        Row: {
          completed_at: string
          formation_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          formation_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          formation_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_completions_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
        ]
      }
      formations: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number | null
          id: string
          path_id: string | null
          position: number
          required_role: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          path_id?: string | null
          position?: number
          required_role?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          path_id?: string | null
          position?: number
          required_role?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: []
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
          admin_response: string | null
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["modification_status"]
          type: Database["public"]["Enums"]["modification_type"]
          urgency: Database["public"]["Enums"]["modification_urgency"]
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          reason: string
          resolved_at?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["modification_status"]
          type: Database["public"]["Enums"]["modification_type"]
          urgency?: Database["public"]["Enums"]["modification_urgency"]
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
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
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
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
          iban: string | null
          id: string
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
          iban?: string | null
          id: string
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
          iban?: string | null
          id?: string
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
      shift_checklist_items: {
        Row: {
          checked_at: string | null
          created_at: string
          id: string
          label: string
          photo_url: string | null
          position: number
          shift_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          id?: string
          label: string
          photo_url?: string | null
          position: number
          shift_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          id?: string
          label?: string
          photo_url?: string | null
          position?: number
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_checklist_items_shift_id_fkey"
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
          clocked_in_at: string | null
          clocked_out_at: string | null
          created_at: string
          end_time: string
          id: string
          is_locked: boolean
          is_manual: boolean
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
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          created_at?: string
          end_time: string
          id?: string
          is_locked?: boolean
          is_manual?: boolean
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
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          created_at?: string
          end_time?: string
          id?: string
          is_locked?: boolean
          is_manual?: boolean
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
          business_role: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          required_count: number
          start_time: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          business_role: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          required_count?: number
          start_time: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          business_role?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          required_count?: number
          start_time?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      studios: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          opening_hours: string | null
          phone: string | null
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          opening_hours?: string | null
          phone?: string | null
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          opening_hours?: string | null
          phone?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      training_paths: {
        Row: {
          created_at: string
          description: string | null
          id: string
          position: number
          required_role: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          required_role?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          required_role?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
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
      can_see_handoff: {
        Args: { _from_shift_id: string; _user_id: string }
        Returns: boolean
      }
      get_default_admin: {
        Args: never
        Returns: {
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
