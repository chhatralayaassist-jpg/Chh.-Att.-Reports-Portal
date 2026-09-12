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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          created_at: string
          dec_day: Database["public"]["Enums"]["dec_day"] | null
          ekant: Database["public"]["Enums"]["attendance_status"] | null
          gdc: Database["public"]["Enums"]["attendance_status"] | null
          id: string
          last_sheet_sync_at: string | null
          lib: Database["public"]["Enums"]["attendance_status"] | null
          locked: boolean
          ma: Database["public"]["Enums"]["attendance_status"] | null
          pooja: Database["public"]["Enums"]["attendance_status"] | null
          recorded_by: string | null
          sa: Database["public"]["Enums"]["attendance_status"] | null
          sabha: Database["public"]["Enums"]["attendance_status"] | null
          ss: Database["public"]["Enums"]["attendance_status"] | null
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          dec_day?: Database["public"]["Enums"]["dec_day"] | null
          ekant?: Database["public"]["Enums"]["attendance_status"] | null
          gdc?: Database["public"]["Enums"]["attendance_status"] | null
          id?: string
          last_sheet_sync_at?: string | null
          lib?: Database["public"]["Enums"]["attendance_status"] | null
          locked?: boolean
          ma?: Database["public"]["Enums"]["attendance_status"] | null
          pooja?: Database["public"]["Enums"]["attendance_status"] | null
          recorded_by?: string | null
          sa?: Database["public"]["Enums"]["attendance_status"] | null
          sabha?: Database["public"]["Enums"]["attendance_status"] | null
          ss?: Database["public"]["Enums"]["attendance_status"] | null
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          dec_day?: Database["public"]["Enums"]["dec_day"] | null
          ekant?: Database["public"]["Enums"]["attendance_status"] | null
          gdc?: Database["public"]["Enums"]["attendance_status"] | null
          id?: string
          last_sheet_sync_at?: string | null
          lib?: Database["public"]["Enums"]["attendance_status"] | null
          locked?: boolean
          ma?: Database["public"]["Enums"]["attendance_status"] | null
          pooja?: Database["public"]["Enums"]["attendance_status"] | null
          recorded_by?: string | null
          sa?: Database["public"]["Enums"]["attendance_status"] | null
          sabha?: Database["public"]["Enums"]["attendance_status"] | null
          ss?: Database["public"]["Enums"]["attendance_status"] | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_slips: {
        Row: {
          activities: string[]
          created_at: string
          date_from: string
          date_to: string
          decline_reason: string | null
          id: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_ids: string[]
          updated_at: string
        }
        Insert: {
          activities?: string[]
          created_at?: string
          date_from: string
          date_to: string
          decline_reason?: string | null
          id?: string
          reason?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_ids?: string[]
          updated_at?: string
        }
        Update: {
          activities?: string[]
          created_at?: string
          date_from?: string
          date_to?: string
          decline_reason?: string | null
          id?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      gate_passes: {
        Row: {
          created_at: string
          decline_reason: string | null
          duration: string
          id: string
          pass_date: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_ids: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          duration: string
          id?: string
          pass_date: string
          reason: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_ids?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          duration?: string
          id?: string
          pass_date?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      google_oauth_connection: {
        Row: {
          access_token: string
          connected_by: string | null
          connected_email: string | null
          created_at: string
          id: number
          refresh_token: string
          scope: string | null
          spreadsheet_id: string | null
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_by?: string | null
          connected_email?: string | null
          created_at?: string
          id?: number
          refresh_token: string
          scope?: string | null
          spreadsheet_id?: string | null
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_by?: string | null
          connected_email?: string | null
          created_at?: string
          id?: number
          refresh_token?: string
          scope?: string | null
          spreadsheet_id?: string | null
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_oauth_state: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      leave_slips: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          decided_return_time: string | null
          decline_reason: string | null
          id: string
          late_days: number | null
          late_fine: number | null
          late_message: string | null
          leave_time: string | null
          permitted_by: string[]
          reason: string
          requested_by: string
          return_date: string | null
          return_submitted_at: string | null
          return_time: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          decided_return_time?: string | null
          decline_reason?: string | null
          id?: string
          late_days?: number | null
          late_fine?: number | null
          late_message?: string | null
          leave_time?: string | null
          permitted_by?: string[]
          reason?: string
          requested_by: string
          return_date?: string | null
          return_submitted_at?: string | null
          return_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          decided_return_time?: string | null
          decline_reason?: string | null
          id?: string
          late_days?: number | null
          late_fine?: number | null
          late_message?: string | null
          leave_time?: string | null
          permitted_by?: string[]
          reason?: string
          requested_by?: string
          return_date?: string | null
          return_submitted_at?: string | null
          return_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_slips_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          file_name: string | null
          file_url: string | null
          id: string
          recipient_ids: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          recipient_ids?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          recipient_ids?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      permitters: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "report_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      report_groups: {
        Row: {
          created_at: string
          id: string
          leader_student_id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_student_id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_student_id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_groups_leader_student_id_fkey"
            columns: ["leader_student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets_connections: {
        Row: {
          access_token: string | null
          connected: boolean
          created_at: string
          refresh_token: string | null
          spreadsheet_id: string | null
          spreadsheet_url: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected?: boolean
          created_at?: string
          refresh_token?: string | null
          spreadsheet_id?: string | null
          spreadsheet_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected?: boolean
          created_at?: string
          refresh_token?: string | null
          spreadsheet_id?: string | null
          spreadsheet_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sheets_sync_log: {
        Row: {
          activity: string | null
          at: string
          attendance_date: string | null
          direction: string
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          student_id: string | null
          user_id: string
        }
        Insert: {
          activity?: string | null
          at?: string
          attendance_date?: string | null
          direction: string
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          student_id?: string | null
          user_id: string
        }
        Update: {
          activity?: string | null
          at?: string
          attendance_date?: string | null
          direction?: string
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          student_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      slips_attendance: {
        Row: {
          activity: string
          attendance_date: string
          created_at: string
          id: string
          slip_id: string
          source: string
          student_id: string
        }
        Insert: {
          activity: string
          attendance_date: string
          created_at?: string
          id?: string
          slip_id: string
          source: string
          student_id: string
        }
        Update: {
          activity?: string
          attendance_date?: string
          created_at?: string
          id?: string
          slip_id?: string
          source?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slips_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          created_by: string | null
          enrollment_no: string
          group_name: string
          id: string
          name: string
          nickname: string | null
          qr_token: string
          standard: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enrollment_no: string
          group_name: string
          id?: string
          name: string
          nickname?: string | null
          qr_token?: string
          standard: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enrollment_no?: string
          group_name?: string
          id?: string
          name?: string
          nickname?: string | null
          qr_token?: string
          standard?: string
          updated_at?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          created_at: string
          created_by: string
          entry_date: string
          id: string
          remark: string | null
          screenshot_url: string | null
          status: string
          student_id: string | null
          suggestion: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entry_date?: string
          id?: string
          remark?: string | null
          screenshot_url?: string | null
          status?: string
          student_id?: string | null
          suggestion?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_date?: string
          id?: string
          remark?: string | null
          screenshot_url?: string | null
          status?: string
          student_id?: string | null
          suggestion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
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
      app_role: "admin" | "attendance_taker" | "rector" | "group_leader"
      attendance_status: "P" | "P1" | "P2" | "AB"
      dec_day: "day1" | "day2" | "day3"
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
      app_role: ["admin", "attendance_taker", "rector", "group_leader"],
      attendance_status: ["P", "P1", "P2", "AB"],
      dec_day: ["day1", "day2", "day3"],
    },
  },
} as const
