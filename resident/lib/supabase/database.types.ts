// Generated from the applied PostgreSQL migrations (PGlite introspection).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          display_name: string;
          preferred_name: string | null;
          pronouns: string | null;
          locale: string;
          notification_preference: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      organisations: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          slug: string;
          created_by: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organisations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organisations"]["Row"]>;
        Relationships: [];
      };
      organisation_members: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          organisation_id: string;
          profile_id: string;
          role: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["organisation_members"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["organisation_members"]["Row"]
        >;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          organisation_id: string;
          name: string;
          address_line_1: string;
          address_line_2: string;
          city: string;
          postcode: string;
          country_code: string;
          timezone: string;
          property_type: string;
          published_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["properties"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["properties"]["Row"]>;
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          property_id: string;
          name: string;
          capacity: number;
          manager_contact_json: Json;
          emergency_contact_json: Json;
          default_locale: string;
          supported_locales: string[];
          languages_reviewed: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["rooms"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["rooms"]["Row"]>;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          room_id: string;
          profile_id: string;
          status: string;
          move_in_at: string | null;
          move_out_at: string | null;
          onboarding_completed_at: string | null;
          onboarding_step: number;
        };
        Insert: Partial<Database["public"]["Tables"]["memberships"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["memberships"]["Row"]>;
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          room_id: string;
          created_by: string;
          invitee_email: string | null;
          token_hash: string;
          expires_at: string;
          claimed_at: string | null;
          revoked_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["invites"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["invites"]["Row"]>;
        Relationships: [];
      };
      content_blocks: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          room_id: string;
          kind: string;
          title: string;
          body: string;
          data: Json;
          position: number;
          visibility: string;
          visible_from: string | null;
          required_acknowledgement: boolean;
          status: string;
          source_type: string;
          source_excerpt: string | null;
          owner_id: string;
          verified_at: string | null;
          published_at: string | null;
          version: number;
          published_version: number | null;
          published_snapshot: Json | null;
        };
        Insert: Partial<Database["public"]["Tables"]["content_blocks"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["content_blocks"]["Row"]>;
        Relationships: [];
      };
      content_versions: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          content_block_id: string;
          version: number;
          snapshot: Json;
          changed_by: string;
          change_reason: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["content_versions"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["content_versions"]["Row"]
        >;
        Relationships: [];
      };
      translations: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          content_block_id: string;
          locale: string;
          title: string;
          body: string;
          data: Json;
          status: string;
          reviewed_by: string | null;
          source_version: number;
          published_snapshot: Json | null;
        };
        Insert: Partial<Database["public"]["Tables"]["translations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["translations"]["Row"]>;
        Relationships: [];
      };
      acknowledgements: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          membership_id: string;
          content_block_id: string;
          content_version: number;
          acknowledged_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["acknowledgements"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["acknowledgements"]["Row"]
        >;
        Relationships: [];
      };
      onboarding_tasks: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          room_id: string;
          title: string;
          description: string;
          position: number;
          required: boolean;
          completion_kind: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["onboarding_tasks"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["onboarding_tasks"]["Row"]
        >;
        Relationships: [];
      };
      onboarding_task_completions: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          membership_id: string;
          onboarding_task_id: string;
          completed_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["onboarding_task_completions"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["onboarding_task_completions"]["Row"]
        >;
        Relationships: [];
      };
      question_logs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          membership_id: string;
          room_id: string;
          question_redacted: string;
          category: string;
          outcome: string;
          cited_block_ids: string[];
          feedback: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["question_logs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["question_logs"]["Row"]>;
        Relationships: [];
      };
      ai_runs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          organisation_id: string;
          room_id: string;
          actor_id: string;
          purpose: string;
          provider: string;
          model: string;
          input_hash: string;
          status: string;
          latency_ms: number;
          result_metadata: Json;
          error_code: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_runs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ai_runs"]["Row"]>;
        Relationships: [];
      };
      ai_suggestions: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          ai_run_id: string;
          room_id: string;
          kind: string;
          proposed_data: Json;
          source_excerpt: string;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_suggestions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ai_suggestions"]["Row"]>;
        Relationships: [];
      };
      maintenance_requests: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          room_id: string;
          membership_id: string;
          title: string;
          description: string;
          location: string;
          category: string;
          priority: string;
          status: string;
          availability_json: Json;
          assigned_to: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["maintenance_requests"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["maintenance_requests"]["Row"]
        >;
        Relationships: [];
      };
      maintenance_attachments: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          maintenance_request_id: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          name: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["maintenance_attachments"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["maintenance_attachments"]["Row"]
        >;
        Relationships: [];
      };
      maintenance_events: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          maintenance_request_id: string;
          actor_id: string | null;
          event_type: string;
          note: string;
          resident_visible: boolean;
        };
        Insert: Partial<
          Database["public"]["Tables"]["maintenance_events"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["maintenance_events"]["Row"]
        >;
        Relationships: [];
      };
      manager_onboarding: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          profile_id: string;
          step: number;
          organisation_id: string | null;
          property_id: string | null;
          room_id: string | null;
          values: Json;
          completed: boolean;
        };
        Insert: Partial<
          Database["public"]["Tables"]["manager_onboarding"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["manager_onboarding"]["Row"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: Json }>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
