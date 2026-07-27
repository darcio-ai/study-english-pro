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
      achievements: {
        Row: {
          code: string
          created_at: string | null
          criteria: Json
          description_pt: string
          emoji: string
          title: string
          xp_reward: number
        }
        Insert: {
          code: string
          created_at?: string | null
          criteria: Json
          description_pt: string
          emoji: string
          title: string
          xp_reward?: number
        }
        Update: {
          code?: string
          created_at?: string | null
          criteria?: Json
          description_pt?: string
          emoji?: string
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      attempts: {
        Row: {
          correction: Json | null
          created_at: string | null
          exercise_id: string | null
          grammar_focus: string | null
          id: string
          level: string | null
          mode: string | null
          reading_text_id: string | null
          score: number | null
          transcript: string | null
          user_id: string
          user_input: string
        }
        Insert: {
          correction?: Json | null
          created_at?: string | null
          exercise_id?: string | null
          grammar_focus?: string | null
          id?: string
          level?: string | null
          mode?: string | null
          reading_text_id?: string | null
          score?: number | null
          transcript?: string | null
          user_id: string
          user_input: string
        }
        Update: {
          correction?: Json | null
          created_at?: string | null
          exercise_id?: string | null
          grammar_focus?: string | null
          id?: string
          level?: string | null
          mode?: string | null
          reading_text_id?: string | null
          score?: number | null
          transcript?: string | null
          user_id?: string
          user_input?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_reading_text_id_fkey"
            columns: ["reading_text_id"]
            isOneToOne: false
            referencedRelation: "reading_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          audio_script: string | null
          content: string | null
          created_at: string | null
          expected_response: string | null
          grammar_focus: string
          id: string
          language: string
          lesson_id: string | null
          lesson_order: number | null
          level: string
          mode: string
          model_answer: string
          prompt_en: string
          prompt_pt: string
          track: string | null
          type: string
        }
        Insert: {
          audio_script?: string | null
          content?: string | null
          created_at?: string | null
          expected_response?: string | null
          grammar_focus: string
          id?: string
          language?: string
          lesson_id?: string | null
          lesson_order?: number | null
          level: string
          mode?: string
          model_answer: string
          prompt_en: string
          prompt_pt: string
          track?: string | null
          type: string
        }
        Update: {
          audio_script?: string | null
          content?: string | null
          created_at?: string | null
          expected_response?: string | null
          grammar_focus?: string
          id?: string
          language?: string
          lesson_id?: string | null
          lesson_order?: number | null
          level?: string
          mode?: string
          model_answer?: string
          prompt_en?: string
          prompt_pt?: string
          track?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string | null
          description_pt: string
          emoji: string | null
          grammar_focus: string
          id: string
          language: string
          lesson_number: number
          level: string
          title: string
          track: string
          unit_number: number
        }
        Insert: {
          created_at?: string | null
          description_pt: string
          emoji?: string | null
          grammar_focus: string
          id?: string
          language?: string
          lesson_number: number
          level: string
          title: string
          track?: string
          unit_number: number
        }
        Update: {
          created_at?: string | null
          description_pt?: string
          emoji?: string | null
          grammar_focus?: string
          id?: string
          language?: string
          lesson_number?: number
          level?: string
          title?: string
          track?: string
          unit_number?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          placement_done: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          placement_done?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          placement_done?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_texts: {
        Row: {
          body: string
          created_at: string | null
          id: string
          key_vocabulary: Json | null
          language: string
          level: string
          questions: Json
          title: string
          track: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          key_vocabulary?: Json | null
          language?: string
          level: string
          questions: Json
          title: string
          track?: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          key_vocabulary?: Json | null
          language?: string
          level?: string
          questions?: Json
          title?: string
          track?: string
        }
        Relationships: []
      }
      review_queue: {
        Row: {
          created_at: string | null
          exercise_id: string
          id: string
          interval_days: number
          last_score: number
          next_review_at: string
          review_count: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          id?: string
          interval_days?: number
          last_score: number
          next_review_at?: string
          review_count?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          id?: string
          interval_days?: number
          last_score?: number
          next_review_at?: string
          review_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_queue_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_code: string
          id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_code: string
          id?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_code?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
      }
      user_lesson_progress: {
        Row: {
          avg_score: number | null
          completed_at: string | null
          exercises_done: number
          id: string
          lesson_id: string
          started_at: string | null
          total_exercises: number
          user_id: string
        }
        Insert: {
          avg_score?: number | null
          completed_at?: string | null
          exercises_done?: number
          id?: string
          lesson_id: string
          started_at?: string | null
          total_exercises?: number
          user_id: string
        }
        Update: {
          avg_score?: number | null
          completed_at?: string | null
          exercises_done?: number
          id?: string
          lesson_id?: string
          started_at?: string | null
          total_exercises?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          created_at: string | null
          exercises_completed: number | null
          id: string
          last_activity_at: string | null
          level: string
          preferred_language: string
          preferred_track: string | null
          streak_days: number | null
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string | null
          exercises_completed?: number | null
          id?: string
          last_activity_at?: string | null
          level?: string
          preferred_language?: string
          preferred_track?: string | null
          streak_days?: number | null
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string | null
          exercises_completed?: number | null
          id?: string
          last_activity_at?: string | null
          level?: string
          preferred_language?: string
          preferred_track?: string | null
          streak_days?: number | null
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      user_vocabulary: {
        Row: {
          context_sentence: string | null
          created_at: string | null
          ease: number
          id: string
          interval_days: number
          next_review_at: string
          review_count: number
          source_exercise_id: string | null
          translation_pt: string | null
          user_id: string
          word_en: string
        }
        Insert: {
          context_sentence?: string | null
          created_at?: string | null
          ease?: number
          id?: string
          interval_days?: number
          next_review_at?: string
          review_count?: number
          source_exercise_id?: string | null
          translation_pt?: string | null
          user_id: string
          word_en: string
        }
        Update: {
          context_sentence?: string | null
          created_at?: string | null
          ease?: number
          id?: string
          interval_days?: number
          next_review_at?: string
          review_count?: number
          source_exercise_id?: string | null
          translation_pt?: string | null
          user_id?: string
          word_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vocabulary_source_exercise_id_fkey"
            columns: ["source_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
