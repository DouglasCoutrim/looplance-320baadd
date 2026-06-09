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
      arena_settings: {
        Row: {
          arena_id: string
          auto_cleanup_enabled: boolean
          created_at: string | null
          id: string
          replay_retention_days: number
          updated_at: string | null
        }
        Insert: {
          arena_id: string
          auto_cleanup_enabled?: boolean
          created_at?: string | null
          id?: string
          replay_retention_days?: number
          updated_at?: string | null
        }
        Update: {
          arena_id?: string
          auto_cleanup_enabled?: boolean
          created_at?: string | null
          id?: string
          replay_retention_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_settings_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: true
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas: {
        Row: {
          cidade: string | null
          created_at: string
          endereco: string | null
          final_overlay_url: string | null
          foto_url: string | null
          id: string
          nome: string
          sponsor_logo_center: string | null
          sponsor_logo_left: string | null
          sponsor_logo_right: string | null
          telefone: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          final_overlay_url?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          telefone?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          final_overlay_url?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      cameras: {
        Row: {
          active: boolean | null
          aspect_ratio: string | null
          buffer_seconds: number | null
          created_at: string | null
          edge_device_id: string | null
          final_overlay_url: string | null
          id: string
          input_board_id: string | null
          name: string
          overlay_url: string | null
          quadra_id: string | null
          replay_seconds: number | null
          rtsp_url: string | null
          sponsor_logo_center: string | null
          sponsor_logo_left: string | null
          sponsor_logo_right: string | null
          streaming_error: string | null
          streaming_status: string | null
          trigger_button: number | null
          video_height: number | null
          video_width: number | null
          video_x: number | null
          video_y: number | null
        }
        Insert: {
          active?: boolean | null
          aspect_ratio?: string | null
          buffer_seconds?: number | null
          created_at?: string | null
          edge_device_id?: string | null
          final_overlay_url?: string | null
          id?: string
          input_board_id?: string | null
          name: string
          overlay_url?: string | null
          quadra_id?: string | null
          replay_seconds?: number | null
          rtsp_url?: string | null
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          streaming_error?: string | null
          streaming_status?: string | null
          trigger_button?: number | null
          video_height?: number | null
          video_width?: number | null
          video_x?: number | null
          video_y?: number | null
        }
        Update: {
          active?: boolean | null
          aspect_ratio?: string | null
          buffer_seconds?: number | null
          created_at?: string | null
          edge_device_id?: string | null
          final_overlay_url?: string | null
          id?: string
          input_board_id?: string | null
          name?: string
          overlay_url?: string | null
          quadra_id?: string | null
          replay_seconds?: number | null
          rtsp_url?: string | null
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          streaming_error?: string | null
          streaming_status?: string | null
          trigger_button?: number | null
          video_height?: number | null
          video_width?: number | null
          video_x?: number | null
          video_y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cameras_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cameras_input_board_id_fkey"
            columns: ["input_board_id"]
            isOneToOne: false
            referencedRelation: "input_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cameras_quadra_id_fkey"
            columns: ["quadra_id"]
            isOneToOne: false
            referencedRelation: "quadras"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
        }
        Relationships: []
      }
      edge_devices: {
        Row: {
          arena_id: string | null
          created_at: string | null
          edge_token: string | null
          edge_version: string | null
          hostname: string | null
          id: string
          last_seen: string | null
          local_ip: string | null
          name: string
          status: string | null
          uptime_seconds: number | null
        }
        Insert: {
          arena_id?: string | null
          created_at?: string | null
          edge_token?: string | null
          edge_version?: string | null
          hostname?: string | null
          id?: string
          last_seen?: string | null
          local_ip?: string | null
          name: string
          status?: string | null
          uptime_seconds?: number | null
        }
        Update: {
          arena_id?: string | null
          created_at?: string | null
          edge_token?: string | null
          edge_version?: string | null
          hostname?: string | null
          id?: string
          last_seen?: string | null
          local_ip?: string | null
          name?: string
          status?: string | null
          uptime_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_devices_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      input_boards: {
        Row: {
          created_at: string | null
          device_name: string | null
          edge_device_id: string | null
          id: string
          name: string
          product_id: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          edge_device_id?: string | null
          id?: string
          name: string
          product_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          edge_device_id?: string | null
          id?: string
          name?: string
          product_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "input_boards_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arena_id: string | null
          birth_date: string | null
          consent_accepted: boolean | null
          consent_timestamp: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_arena_owner: boolean | null
          is_super_admin: boolean | null
          role: string | null
          updated_at: string
        }
        Insert: {
          arena_id?: string | null
          birth_date?: string | null
          consent_accepted?: boolean | null
          consent_timestamp?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_arena_owner?: boolean | null
          is_super_admin?: boolean | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string | null
          birth_date?: string | null
          consent_accepted?: boolean | null
          consent_timestamp?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_arena_owner?: boolean | null
          is_super_admin?: boolean | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      quadras: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadras_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      r2_deletion_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          r2_key: string
          replay_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          r2_key: string
          replay_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          r2_key?: string
          replay_id?: string
          status?: string
        }
        Relationships: []
      }
      replays: {
        Row: {
          arena_id: string | null
          created_at: string
          duration_sec: number | null
          edge_device_id: string | null
          file_size_bytes: number | null
          id: string
          quadra_id: string
          r2_key: string | null
          video_url: string
        }
        Insert: {
          arena_id?: string | null
          created_at?: string
          duration_sec?: number | null
          edge_device_id?: string | null
          file_size_bytes?: number | null
          id?: string
          quadra_id: string
          r2_key?: string | null
          video_url: string
        }
        Update: {
          arena_id?: string | null
          created_at?: string
          duration_sec?: number | null
          edge_device_id?: string | null
          file_size_bytes?: number | null
          id?: string
          quadra_id?: string
          r2_key?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "replays_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replays_quadra_id_fkey"
            columns: ["quadra_id"]
            isOneToOne: false
            referencedRelation: "quadras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_user_profile:
        | {
            Args: {
              new_is_arena_owner: boolean
              new_is_super_admin: boolean
              new_role: string
              user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              new_arena_id?: string
              new_is_arena_owner: boolean
              new_is_super_admin: boolean
              new_role: string
              user_id: string
            }
            Returns: undefined
          }
      fn_get_camera_for_replay: { Args: { p_quadra_id: string }; Returns: Json }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_arena_manager: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
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
