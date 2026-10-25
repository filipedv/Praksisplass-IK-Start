// GENERATED from the live database — do not edit by hand.
// Regenerate after every migration:  npm run gen:types  (in this folder)

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          at: string
          changes: Json
          id: number
          record_id: string | null
          subject_user_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          at?: string
          changes?: Json
          id?: never
          record_id?: string | null
          subject_user_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          at?: string
          changes?: Json
          id?: never
          record_id?: string | null
          subject_user_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          created_at: string
          entered_by: string | null
          height_cm: number | null
          id: string
          measured_on: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          height_cm?: number | null
          id?: string
          measured_on?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          height_cm?: number | null
          id?: string
          measured_on?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_settings: {
        Row: {
          club_name: string
          default_goal_carbs_g: number
          default_goal_fat_g: number
          default_goal_kcal: number
          default_goal_protein_g: number
          default_goal_water_ml: number
          fatsecret_trial_started_on: string | null
          foods_seeded_at: string | null
          id: number
          updated_at: string
        }
        Insert: {
          club_name?: string
          default_goal_carbs_g?: number
          default_goal_fat_g?: number
          default_goal_kcal?: number
          default_goal_protein_g?: number
          default_goal_water_ml?: number
          fatsecret_trial_started_on?: string | null
          foods_seeded_at?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          club_name?: string
          default_goal_carbs_g?: number
          default_goal_fat_g?: number
          default_goal_kcal?: number
          default_goal_protein_g?: number
          default_goal_water_ml?: number
          fatsecret_trial_started_on?: string | null
          foods_seeded_at?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      fixture_reminders: {
        Row: {
          anchor: string
          at_time: string | null
          body_en: string | null
          body_nb: string
          fixture_id: string
          id: string
          offset_minutes: number | null
          send_at: string
          template_id: string | null
        }
        Insert: {
          anchor: string
          at_time?: string | null
          body_en?: string | null
          body_nb: string
          fixture_id: string
          id?: string
          offset_minutes?: number | null
          send_at: string
          template_id?: string | null
        }
        Update: {
          anchor?: string
          at_time?: string | null
          body_en?: string | null
          body_nb?: string
          fixture_id?: string
          id?: string
          offset_minutes?: number | null
          send_at?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixture_reminders_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_reminders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_teams: {
        Row: {
          fixture_id: string
          team_id: string
        }
        Insert: {
          fixture_id: string
          team_id: string
        }
        Update: {
          fixture_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_teams_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          home_away: string | null
          id: string
          kind: string
          location: string | null
          opponent: string | null
          starts_at: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          home_away?: string | null
          id?: string
          kind: string
          location?: string | null
          opponent?: string | null
          starts_at: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          home_away?: string | null
          id?: string
          kind?: string
          location?: string | null
          opponent?: string | null
          starts_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_dismissals: {
        Row: {
          dismissed_at: string
          dismissed_by: string | null
          expires_at: string | null
          item_key: string
        }
        Insert: {
          dismissed_at?: string
          dismissed_by?: string | null
          expires_at?: string | null
          item_key: string
        }
        Update: {
          dismissed_at?: string
          dismissed_by?: string | null
          expires_at?: string | null
          item_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_dismissals_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          food_id: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          food_id: string
          id?: string
          label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          food_id?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_aliases_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          created_at: string
          id: string
          name_en: string | null
          name_nb: string
          nutrition: Json
          portions: Json
          search_keywords: string[]
          source: string
          source_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name_en?: string | null
          name_nb: string
          nutrition: Json
          portions?: Json
          search_keywords?: string[]
          source: string
          source_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name_en?: string | null
          name_nb?: string
          nutrition?: Json
          portions?: Json
          search_keywords?: string[]
          source?: string
          source_id?: string | null
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          amount_g: number
          created_at: string
          detected_label: string | null
          food_id: string | null
          food_name: string
          id: string
          meal_id: string
          nutrition: Json
        }
        Insert: {
          amount_g: number
          created_at?: string
          detected_label?: string | null
          food_id?: string | null
          food_name: string
          id?: string
          meal_id: string
          nutrition: Json
        }
        Update: {
          amount_g?: number
          created_at?: string
          detected_label?: string | null
          food_id?: string | null
          food_name?: string
          id?: string
          meal_id?: string
          nutrition?: Json
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          admin_changed_at: string | null
          created_at: string
          eaten_at: string
          id: string
          recognizer: string | null
          user_id: string
        }
        Insert: {
          admin_changed_at?: string | null
          created_at?: string
          eaten_at?: string
          id?: string
          recognizer?: string | null
          user_id?: string
        }
        Update: {
          admin_changed_at?: string | null
          created_at?: string
          eaten_at?: string
          id?: string
          recognizer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_goals: {
        Row: {
          goal_carbs_g: number | null
          goal_fat_g: number | null
          goal_kcal: number | null
          goal_protein_g: number | null
          goal_water_ml: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          goal_carbs_g?: number | null
          goal_fat_g?: number | null
          goal_kcal?: number | null
          goal_protein_g?: number | null
          goal_water_ml?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          goal_carbs_g?: number | null
          goal_fat_g?: number | null
          goal_kcal?: number | null
          goal_protein_g?: number | null
          goal_water_ml?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_goals_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          display_name: string
          id: string
          is_active: boolean
          numbers_visible: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          team_id: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          id: string
          is_active?: boolean
          numbers_visible?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          numbers_visible?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      recognition_events: {
        Row: {
          created_at: string
          id: string
          labels: string[]
          provider: string
          unmatched_labels: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          labels: string[]
          provider: string
          unmatched_labels: string[]
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          labels?: string[]
          provider?: string
          unmatched_labels?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_templates: {
        Row: {
          anchor: string
          at_time: string | null
          body_en: string | null
          body_nb: string
          created_at: string
          default_selected: boolean
          id: string
          kind: string
          name: string
          offset_minutes: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          anchor: string
          at_time?: string | null
          body_en?: string | null
          body_nb: string
          created_at?: string
          default_selected?: boolean
          id?: string
          kind: string
          name: string
          offset_minutes?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          anchor?: string
          at_time?: string | null
          body_en?: string | null
          body_nb?: string
          created_at?: string
          default_selected?: boolean
          id?: string
          kind?: string
          name?: string
          offset_minutes?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          goal_carbs_g: number | null
          goal_fat_g: number | null
          goal_kcal: number | null
          goal_protein_g: number | null
          goal_water_ml: number | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          goal_carbs_g?: number | null
          goal_fat_g?: number | null
          goal_kcal?: number | null
          goal_protein_g?: number | null
          goal_water_ml?: number | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          goal_carbs_g?: number | null
          goal_fat_g?: number | null
          goal_kcal?: number | null
          goal_protein_g?: number | null
          goal_water_ml?: number | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          logged_at: string
          user_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          id?: string
          logged_at?: string
          user_id?: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          logged_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_meal_item: {
        Args: { p_amount_g: number; p_food_id: string; p_meal_id: string }
        Returns: string
      }
      daily_summary: {
        Args: {
          p_from: string
          p_to: string
          p_tz?: string
          p_user_id?: string
        }
        Returns: {
          carbs_g: number
          day: string
          fat_g: number
          kcal: number
          meals: number
          protein_g: number
          user_id: string
          water_ml: number
        }[]
      }
      delete_meal_item: { Args: { p_item_id: string }; Returns: undefined }
      effective_goals: {
        Args: { p_user_id?: string }
        Returns: {
          goal_carbs_g: number
          goal_fat_g: number
          goal_kcal: number
          goal_protein_g: number
          goal_water_ml: number
        }[]
      }
      goals_for: {
        Args: { p_user_id?: string }
        Returns: {
          goal_carbs_g: number
          goal_fat_g: number
          goal_kcal: number
          goal_protein_g: number
          goal_water_ml: number
          has_custom: boolean
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      last_activity: {
        Args: never
        Returns: {
          last_meal_at: string
          last_water_at: string
          user_id: string
        }[]
      }
      log_meal: {
        Args: { p_eaten_at?: string; p_items: Json; p_recognizer?: string }
        Returns: string
      }
      my_team_id: { Args: never; Returns: string }
      recent_foods: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          last_used: string
          name_en: string
          name_nb: string
          nutrition: Json
          portions: Json
          source: string
          times_used: number
          typical_amount_g: number
        }[]
      }
      reminder_send_at: {
        Args: {
          p_anchor: string
          p_at: string
          p_end: string
          p_offset: number
          p_start: string
        }
        Returns: string
      }
      save_fixture: {
        Args: {
          p_fixture: Json
          p_id: string
          p_reminders: Json
          p_team_ids: string[]
        }
        Returns: string
      }
      search_foods: {
        Args: { max_results?: number; search_text: string }
        Returns: {
          id: string
          name_en: string
          name_nb: string
          nutrition: Json
          portions: Json
          score: number
          source: string
        }[]
      }
      update_meal_item_amount: {
        Args: { p_amount_g: number; p_item_id: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "player" | "coach" | "guardian" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      user_role: ["player", "coach", "guardian", "admin"],
    },
  },
} as const
