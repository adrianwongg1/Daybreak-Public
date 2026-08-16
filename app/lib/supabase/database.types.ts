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
      briefing_jobs: {
        Row: {
          attempts: number
          briefing_date: string
          created_at: string
          finished_at: string | null
          id: string
          last_error_code: string | null
          locked_until: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          briefing_date: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error_code?: string | null
          locked_until?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          briefing_date?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error_code?: string | null
          locked_until?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          date: string
          generated_at: string
          id: string
          market_json: Json | null
          news_json: Json | null
          news_refreshed_at: string | null
          outfit_suggestion: Json | null
          saved_cities_weather_json: Json | null
          user_id: string
          weather_json: Json | null
        }
        Insert: {
          date: string
          generated_at?: string
          id?: string
          market_json?: Json | null
          news_json?: Json | null
          news_refreshed_at?: string | null
          outfit_suggestion?: Json | null
          saved_cities_weather_json?: Json | null
          user_id: string
          weather_json?: Json | null
        }
        Update: {
          date?: string
          generated_at?: string
          id?: string
          market_json?: Json | null
          news_json?: Json | null
          news_refreshed_at?: string | null
          outfit_suggestion?: Json | null
          saved_cities_weather_json?: Json | null
          user_id?: string
          weather_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          location: string | null
          start_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          location?: string | null
          start_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          location?: string | null
          start_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commands_log: {
        Row: {
          created_at: string
          id: string
          input_text: string
          parsed_intent_json: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_text: string
          parsed_intent_json?: Json | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_text?: string
          parsed_intent_json?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commands_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          display_name: string
          fetched_at: string
          latitude: number
          location_key: string
          longitude: number
        }
        Insert: {
          display_name: string
          fetched_at?: string
          latitude: number
          location_key: string
          longitude: number
        }
        Update: {
          display_name?: string
          fetched_at?: string
          latitude?: number
          location_key?: string
          longitude?: number
        }
        Relationships: []
      }
      market_quote_cache: {
        Row: {
          as_of: string
          change_pct: number
          name: string
          price: number
          symbol: string
        }
        Insert: {
          as_of?: string
          change_pct: number
          name: string
          price: number
          symbol: string
        }
        Update: {
          as_of?: string
          change_pct?: number
          name?: string
          price?: number
          symbol?: string
        }
        Relationships: []
      }
      news_source_cache: {
        Row: {
          candidates_json: Json
          fetched_at: string
          provider: string
          topic_key: string
        }
        Insert: {
          candidates_json: Json
          fetched_at?: string
          provider: string
          topic_key: string
        }
        Update: {
          candidates_json?: Json
          fetched_at?: string
          provider?: string
          topic_key?: string
        }
        Relationships: []
      }
      news_summary_cache: {
        Row: {
          briefing_date: string
          fetched_at: string
          headlines_json: Json
          topic_set_key: string
        }
        Insert: {
          briefing_date: string
          fetched_at?: string
          headlines_json: Json
          topic_set_key: string
        }
        Update: {
          briefing_date?: string
          fetched_at?: string
          headlines_json?: Json
          topic_set_key?: string
        }
        Relationships: []
      }
      preferences: {
        Row: {
          cold_tolerance: string | null
          command_suggestions: string[]
          market_tickers: string[]
          news_sources: string[]
          news_topics: string[]
          notification_email: string | null
          saved_cities: Json
          section_order: string[]
          style_preference: string | null
          user_id: string
        }
        Insert: {
          cold_tolerance?: string | null
          command_suggestions?: string[]
          market_tickers?: string[]
          news_sources?: string[]
          news_topics?: string[]
          notification_email?: string | null
          saved_cities?: Json
          section_order?: string[]
          style_preference?: string | null
          user_id: string
        }
        Update: {
          cold_tolerance?: string | null
          command_suggestions?: string[]
          market_tickers?: string[]
          news_sources?: string[]
          news_topics?: string[]
          notification_email?: string | null
          saved_cities?: Json
          section_order?: string[]
          style_preference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          remind_at: string | null
          text: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          remind_at?: string | null
          text: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          remind_at?: string | null
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          briefing_time_weekday: string
          briefing_time_weekend: string | null
          created_at: string
          display_name: string | null
          email: string
          home_location: string | null
          id: string
          onboarding_completed_at: string | null
          onboarding_last_step: string | null
          timezone: string
        }
        Insert: {
          briefing_time_weekday?: string
          briefing_time_weekend?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          home_location?: string | null
          id: string
          onboarding_completed_at?: string | null
          onboarding_last_step?: string | null
          timezone?: string
        }
        Update: {
          briefing_time_weekday?: string
          briefing_time_weekend?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          home_location?: string | null
          id?: string
          onboarding_completed_at?: string | null
          onboarding_last_step?: string | null
          timezone?: string
        }
        Relationships: []
      }
      weather_forecast_cache: {
        Row: {
          coordinate_key: string
          fetched_at: string
          forecast_json: Json
        }
        Insert: {
          coordinate_key: string
          fetched_at?: string
          forecast_json: Json
        }
        Update: {
          coordinate_key?: string
          fetched_at?: string
          forecast_json?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_briefing_jobs: {
        Args: { p_limit: number; p_user_id?: string }
        Returns: {
          attempts: number
          briefing_date: string
          created_at: string
          finished_at: string | null
          id: string
          last_error_code: string | null
          locked_until: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "briefing_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      enqueue_briefing_job: {
        Args: {
          p_briefing_date: string
          p_scheduled_at?: string
          p_user_id: string
        }
        Returns: {
          attempts: number
          briefing_date: string
          created_at: string
          finished_at: string | null
          id: string
          last_error_code: string | null
          locked_until: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "briefing_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
