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
          cep: string | null
          cidade: string | null
          created_at: string
          edge_device_id: string | null
          endereco: string | null
          estado: string | null
          final_overlay_url: string | null
          foto_url: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          nome: string
          sponsor_logo_center: string | null
          sponsor_logo_left: string | null
          sponsor_logo_right: string | null
          telefone: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          edge_device_id?: string | null
          endereco?: string | null
          estado?: string | null
          final_overlay_url?: string | null
          foto_url?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome: string
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          telefone?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          edge_device_id?: string | null
          endereco?: string | null
          estado?: string | null
          final_overlay_url?: string | null
          foto_url?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome?: string
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arenas_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arenas_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices_public"
            referencedColumns: ["id"]
          },
        ]
      }
      botoeiras: {
        Row: {
          botoeira_id: string
          camera_id: string
          created_at: string
          id: string
          ip_local: string
          local_key: string
          updated_at: string
        }
        Insert: {
          botoeira_id: string
          camera_id: string
          created_at?: string
          id?: string
          ip_local: string
          local_key: string
          updated_at?: string
        }
        Update: {
          botoeira_id?: string
          camera_id?: string
          created_at?: string
          id?: string
          ip_local?: string
          local_key?: string
          updated_at?: string
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
          protocol_settings: Json
          quadra_id: string | null
          replay_seconds: number | null
          rtmp_stream_key: string
          rtsp_url: string | null
          sponsor_logo_center: string | null
          sponsor_logo_left: string | null
          sponsor_logo_right: string | null
          stream_protocol: string
          streaming_error: string | null
          streaming_status: string | null
          trigger_button: string | null
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
          protocol_settings?: Json
          quadra_id?: string | null
          replay_seconds?: number | null
          rtmp_stream_key?: string
          rtsp_url?: string | null
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          stream_protocol?: string
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
          protocol_settings?: Json
          quadra_id?: string | null
          replay_seconds?: number | null
          rtmp_stream_key?: string
          rtsp_url?: string | null
          sponsor_logo_center?: string | null
          sponsor_logo_left?: string | null
          sponsor_logo_right?: string | null
          stream_protocol?: string
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
            foreignKeyName: "cameras_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices_public"
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
      clients: {
        Row: {
          cidade: string | null
          created_at: string
          documento: string | null
          documento_tipo: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          frozen_at: string | null
          frozen_reason: string | null
          id: string
          is_frozen: boolean
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          documento?: string | null
          documento_tipo?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          is_frozen?: boolean
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          documento?: string | null
          documento_tipo?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          is_frozen?: boolean
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          target_id: string
          target_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          client_id: string | null
          cpu_percent: number | null
          created_at: string | null
          disk_percent: number | null
          edge_token: string | null
          edge_version: string | null
          hostname: string | null
          id: string
          install_passphrase: string
          last_seen: string | null
          load_avg_1m: number | null
          local_ip: string | null
          memory_percent: number | null
          memory_total_mb: number | null
          memory_used_mb: number | null
          name: string
          net_rx_bps: number | null
          net_tx_bps: number | null
          status: string | null
          temperature_c: number | null
          uptime_seconds: number | null
        }
        Insert: {
          arena_id?: string | null
          client_id?: string | null
          cpu_percent?: number | null
          created_at?: string | null
          disk_percent?: number | null
          edge_token?: string | null
          edge_version?: string | null
          hostname?: string | null
          id?: string
          install_passphrase?: string
          last_seen?: string | null
          load_avg_1m?: number | null
          local_ip?: string | null
          memory_percent?: number | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          name: string
          net_rx_bps?: number | null
          net_tx_bps?: number | null
          status?: string | null
          temperature_c?: number | null
          uptime_seconds?: number | null
        }
        Update: {
          arena_id?: string | null
          client_id?: string | null
          cpu_percent?: number | null
          created_at?: string | null
          disk_percent?: number | null
          edge_token?: string | null
          edge_version?: string | null
          hostname?: string | null
          id?: string
          install_passphrase?: string
          last_seen?: string | null
          load_avg_1m?: number | null
          local_ip?: string | null
          memory_percent?: number | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          name?: string
          net_rx_bps?: number | null
          net_tx_bps?: number | null
          status?: string | null
          temperature_c?: number | null
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
          {
            foreignKeyName: "edge_devices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "input_boards_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices_public"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      manual_replay_triggers: {
        Row: {
          camera_id: string
          consumed_at: string | null
          created_at: string
          edge_device_id: string | null
          id: string
          requested_by: string | null
          status: string
        }
        Insert: {
          camera_id: string
          consumed_at?: string | null
          created_at?: string
          edge_device_id?: string | null
          id?: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          camera_id?: string
          consumed_at?: string | null
          created_at?: string
          edge_device_id?: string | null
          id?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_replay_triggers_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_replay_triggers_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_replay_triggers_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arena_id: string | null
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          client_id: string | null
          consent_accepted: boolean | null
          consent_timestamp: string | null
          cpf: string | null
          created_at: string
          email: string | null
          favorite_arenas: string[]
          favorite_sports: string[]
          full_name: string | null
          gender: string | null
          id: string
          is_arena_owner: boolean | null
          is_super_admin: boolean | null
          role: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          arena_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          client_id?: string | null
          consent_accepted?: boolean | null
          consent_timestamp?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          favorite_arenas?: string[]
          favorite_sports?: string[]
          full_name?: string | null
          gender?: string | null
          id: string
          is_arena_owner?: boolean | null
          is_super_admin?: boolean | null
          role?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          client_id?: string | null
          consent_accepted?: boolean | null
          consent_timestamp?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          favorite_arenas?: string[]
          favorite_sports?: string[]
          full_name?: string | null
          gender?: string | null
          id?: string
          is_arena_owner?: boolean | null
          is_super_admin?: boolean | null
          role?: string | null
          state?: string | null
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
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quadras: {
        Row: {
          arena_id: string
          cover_image_url: string | null
          created_at: string
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          arena_id: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          arena_id?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          nome?: string
          tipo?: string | null
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
          status: string
          user_id: string | null
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
          status?: string
          user_id?: string | null
          video_url?: string
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
          status?: string
          user_id?: string | null
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
            foreignKeyName: "replays_edge_device_id_fkey"
            columns: ["edge_device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices_public"
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
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          action: string
          arena_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          arena_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          arena_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_logs_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          arena_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          arena_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          arena_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      edge_devices_public: {
        Row: {
          arena_id: string | null
          created_at: string | null
          edge_version: string | null
          hostname: string | null
          id: string | null
          last_seen: string | null
          local_ip: string | null
          name: string | null
          status: string | null
          uptime_seconds: number | null
        }
        Insert: {
          arena_id?: string | null
          created_at?: string | null
          edge_version?: string | null
          hostname?: string | null
          id?: string | null
          last_seen?: string | null
          local_ip?: string | null
          name?: string | null
          status?: string | null
          uptime_seconds?: number | null
        }
        Update: {
          arena_id?: string | null
          created_at?: string | null
          edge_version?: string | null
          hostname?: string | null
          id?: string | null
          last_seen?: string | null
          local_ip?: string | null
          name?: string | null
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
    }
    Functions: {
      admin_assign_role: {
        Args: {
          p_arena_id?: string
          p_client_id?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_list_users: {
        Args: never
        Returns: {
          arena_id: string
          arena_nome: string
          client_id: string
          client_nome: string
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_arena_owner: boolean
          is_super_admin: boolean
          roles: Json
        }[]
      }
      admin_revoke_role: {
        Args: {
          p_arena_id?: string
          p_client_id?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      fn_expire_replays: {
        Args: never
        Returns: {
          r2_key: string
          replay_id: string
        }[]
      }
      fn_generate_edge_token: { Args: never; Returns: string }
      fn_generate_install_passphrase: { Args: never; Returns: string }
      fn_get_camera_for_replay: { Args: { p_quadra_id: string }; Returns: Json }
      fn_is_edge_client_active: {
        Args: { p_edge_token: string }
        Returns: boolean
      }
      fn_register_replay: {
        Args: {
          p_duration_sec: number
          p_edge_token: string
          p_file_size_bytes: number
          p_quadra_id: string
          p_r2_key: string
          p_video_url: string
        }
        Returns: {
          arena_id: string | null
          created_at: string
          duration_sec: number | null
          edge_device_id: string | null
          file_size_bytes: number | null
          id: string
          quadra_id: string
          r2_key: string | null
          user_id: string | null
          video_url: string
        }
        SetofOptions: {
          from: "*"
          to: "replays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_touch_edge_heartbeat: {
        Args: {
          p_edge_token: string
          p_hostname: string
          p_local_ip: string
          p_uptime_seconds?: number
          p_version: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_arena_manager: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_user_action: {
        Args: {
          p_action: string
          p_arena_id?: string
          p_metadata?: Json
          p_resource_id?: string
          p_resource_type?: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "client_owner" | "arena_owner" | "arena_user"
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
      app_role: ["super_admin", "client_owner", "arena_owner", "arena_user"],
    },
  },
} as const
