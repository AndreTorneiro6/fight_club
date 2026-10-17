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
      admin_actions: {
        Row: {
          action: string
          admin_user: string | null
          created_at: string | null
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          admin_user?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          admin_user?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      availability: {
        Row: {
          end_time: string
          id: string
          player_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          player_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          player_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exceptions: {
        Row: {
          from_date: string
          id: string
          note: string | null
          player_id: string
          to_date: string
        }
        Insert: {
          from_date: string
          id?: string
          note?: string | null
          player_id: string
          to_date: string
        }
        Update: {
          from_date?: string
          id?: string
          note?: string | null
          player_id?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_messages: {
        Row: {
          body: string
          challenge_id: string
          created_at: string | null
          id: string
          player_id: string | null
        }
        Insert: {
          body: string
          challenge_id: string
          created_at?: string | null
          id?: string
          player_id?: string | null
        }
        Update: {
          body?: string
          challenge_id?: string
          created_at?: string | null
          id?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_messages_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_slots: {
        Row: {
          challenge_id: string
          created_at: string | null
          ends_at: string
          id: string
          player_id: string
          starts_at: string
        }
        Insert: {
          challenge_id: string
          created_at?: string | null
          ends_at: string
          id?: string
          player_id: string
          starts_at: string
        }
        Update: {
          challenge_id?: string
          created_at?: string | null
          ends_at?: string
          id?: string
          player_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_slots_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_slots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenger_id: string
          challenger_pos: number
          completed_at: string | null
          court_id: string | null
          created_at: string
          defender_id: string
          defender_pos: number
          dispute_note: string | null
          division_id: string
          duration_minutes: number | null
          id: string
          number: number
          play_by: string
          refuse_note: string | null
          refuse_reason: string | null
          reported_by: string | null
          respond_by: string
          schedule_by: string
          scheduled_at: string | null
          score: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          challenger_pos: number
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          defender_id: string
          defender_pos: number
          dispute_note?: string | null
          division_id: string
          duration_minutes?: number | null
          id?: string
          number?: number
          play_by: string
          refuse_note?: string | null
          refuse_reason?: string | null
          reported_by?: string | null
          respond_by: string
          schedule_by: string
          scheduled_at?: string | null
          score?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          challenger_pos?: number
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          defender_id?: string
          defender_pos?: number
          dispute_note?: string | null
          division_id?: string
          duration_minutes?: number | null
          id?: string
          number?: number
          play_by?: string
          refuse_note?: string | null
          refuse_reason?: string | null
          reported_by?: string | null
          respond_by?: string
          schedule_by?: string
          scheduled_at?: string | null
          score?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_defender_id_fkey"
            columns: ["defender_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          active: boolean
          external_ref: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          external_ref?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          external_ref?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      divisions: {
        Row: {
          code: string
          created_at: string | null
          id: string
          max_players: number
          name: string
          tier: number
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          max_players?: number
          name: string
          tier: number
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          max_players?: number
          name?: string
          tier?: number
        }
        Relationships: []
      }
      league_settings: {
        Row: {
          accept_hours: number
          id: number
          match_minutes: number
          max_active_challenges: number
          max_positions_above: number
          min_days_between: number
          play_days: number
          promote_count: number
          ranking_model: string
          refusal_rule: string
          relegate_count: number
          schedule_days: number
          slot_minutes: number
          updated_at: string | null
        }
        Insert: {
          accept_hours?: number
          id?: number
          match_minutes?: number
          max_active_challenges?: number
          max_positions_above?: number
          min_days_between?: number
          play_days?: number
          promote_count?: number
          ranking_model?: string
          refusal_rule?: string
          relegate_count?: number
          schedule_days?: number
          slot_minutes?: number
          updated_at?: string | null
        }
        Update: {
          accept_hours?: number
          id?: number
          match_minutes?: number
          max_active_challenges?: number
          max_positions_above?: number
          min_days_between?: number
          play_days?: number
          promote_count?: number
          ranking_model?: string
          refusal_rule?: string
          relegate_count?: number
          schedule_days?: number
          slot_minutes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          challenge_id: string | null
          created_at: string | null
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          challenges_lost: number
          challenges_won: number
          created_at: string | null
          division_id: string
          email: string | null
          id: string
          losses: number
          name: string
          partner_name: string | null
          phone: string | null
          player_number: number
          position: number
          previous_position: number | null
          status: string
          user_id: string | null
          wins: number
        }
        Insert: {
          avatar_url?: string | null
          challenges_lost?: number
          challenges_won?: number
          created_at?: string | null
          division_id: string
          email?: string | null
          id?: string
          losses?: number
          name: string
          partner_name?: string | null
          phone?: string | null
          player_number?: number
          position: number
          previous_position?: number | null
          status?: string
          user_id?: string | null
          wins?: number
        }
        Update: {
          avatar_url?: string | null
          challenges_lost?: number
          challenges_won?: number
          created_at?: string | null
          division_id?: string
          email?: string | null
          id?: string
          losses?: number
          name?: string
          partner_name?: string | null
          phone?: string | null
          player_number?: number
          position?: number
          previous_position?: number | null
          status?: string
          user_id?: string | null
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_history: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          division_id: string | null
          id: string
          new_position: number | null
          old_position: number | null
          player_id: string
          reason: string | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          division_id?: string | null
          id?: string
          new_position?: number | null
          old_position?: number | null
          player_id: string
          reason?: string | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          division_id?: string | null
          id?: string
          new_position?: number | null
          old_position?: number | null
          player_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ranking_history_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_history_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string | null
          ends_on: string | null
          id: string
          name: string
          starts_on: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          ends_on?: string | null
          id?: string
          name: string
          starts_on?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          starts_on?: string | null
          status?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_result: { Args: { _cid: string }; Returns: undefined }
      _is_participant: {
        Args: { _c: Database["public"]["Tables"]["challenges"]["Row"] }
        Returns: boolean
      }
      _log: { Args: { _action: string; _details: Json }; Returns: undefined }
      _notify_admins: {
        Args: { _body: string; _ch: string; _title: string }
        Returns: undefined
      }
      _notify_player: {
        Args: { _body: string; _ch: string; _player: string; _title: string }
        Returns: undefined
      }
      add_slot: {
        Args: {
          _challenge: string
          _end: string
          _player?: string
          _start: string
        }
        Returns: undefined
      }
      admin_move_division: {
        Args: { _division: string; _player: string }
        Returns: undefined
      }
      admin_resolve: {
        Args: {
          _action: string
          _id: string
          _score?: string
          _winner?: string
        }
        Returns: undefined
      }
      admin_set_court: {
        Args: { _court: string; _id: string; _minutes: number; _start: string }
        Returns: undefined
      }
      admin_set_position: {
        Args: { _player: string; _pos: number }
        Returns: undefined
      }
      confirm_result: { Args: { _id: string }; Returns: undefined }
      create_challenge: { Args: { _defender: string }; Returns: string }
      delete_slot: { Args: { _slot: string }; Returns: undefined }
      dispute_result: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_player_id: { Args: never; Returns: string }
      report_result: {
        Args: { _id: string; _score?: string; _winner: string }
        Returns: undefined
      }
      respond_challenge: {
        Args: {
          _accept: boolean
          _id: string
          _note?: string
          _reason?: string
        }
        Returns: undefined
      }
      schedule_challenge: {
        Args: { _id: string; _start: string }
        Returns: undefined
      }
      update_my_profile: {
        Args: { _name: string; _partner: string; _phone: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "player"
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
      app_role: ["admin", "player"],
    },
  },
} as const
