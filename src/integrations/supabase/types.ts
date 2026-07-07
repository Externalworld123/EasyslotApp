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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          approved_by: string | null
          center_id: string
          created_at: string
          discount_percent: number
          id: string
          reason: string | null
          requested_by: string
          session_id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          center_id: string
          created_at?: string
          discount_percent: number
          id?: string
          reason?: string | null
          requested_by: string
          session_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          center_id?: string
          created_at?: string
          discount_percent?: number
          id?: string
          reason?: string | null
          requested_by?: string
          session_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          center_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          center_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          center_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_schedule: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_closed: boolean
          resource_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          is_closed?: boolean
          resource_id: string
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_closed?: boolean
          resource_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_schedule_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_policies: {
        Row: {
          center_id: string
          created_at: string
          hours_before: number
          id: string
          is_active: boolean
          refund_percent: number
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          hours_before?: number
          id?: string
          is_active?: boolean
          refund_percent?: number
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          hours_before?: number
          id?: string
          is_active?: boolean
          refund_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_policies_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      center_settings: {
        Row: {
          center_id: string
          created_at: string
          default_currency: string
          default_session_duration: number
          id: string
          min_deposit_percent: number
          payment_mode: string
          tax_percent: number
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          default_currency?: string
          default_session_duration?: number
          id?: string
          min_deposit_percent?: number
          payment_mode?: string
          tax_percent?: number
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          default_currency?: string
          default_session_duration?: number
          id?: string
          min_deposit_percent?: number
          payment_mode?: string
          tax_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_settings_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: true
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          address: string | null
          area: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          image_url: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string | null
          phone: string | null
          slug: string | null
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id?: string | null
          phone?: string | null
          slug?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          slug?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          center_id: string
          created_at: string
          email: string | null
          id: string
          lifetime_value: number
          name: string
          notes: string | null
          phone: string | null
          total_sessions: number
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          email?: string | null
          id?: string
          lifetime_value?: number
          name: string
          notes?: string | null
          phone?: string | null
          total_sessions?: number
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          email?: string | null
          id?: string
          lifetime_value?: number
          name?: string
          notes?: string | null
          phone?: string | null
          total_sessions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          center_id: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          recorded_by: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          center_id: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          recorded_by: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          center_id?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_key: string
          id: string
          is_active: boolean
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_key: string
          id?: string
          is_active?: boolean
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_key?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          center_id: string
          comment: string | null
          created_at: string
          customer_name: string
          id: string
          rating: number
          session_id: string
        }
        Insert: {
          center_id: string
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          rating: number
          session_id: string
        }
        Update: {
          center_id?: string
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          rating?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_content: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          metadata: Json | null
          section_key: string
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          metadata?: Json | null
          section_key: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          metadata?: Json | null
          section_key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          center_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_plans: {
        Row: {
          center_id: string
          created_at: string
          created_by: string
          customer_name: string
          customer_phone: string | null
          days_of_week: number[]
          duration_minutes: number
          end_date: string
          group_name: string | null
          id: string
          is_active: boolean
          leader_name: string | null
          notes: string | null
          plan_type: string
          resource_id: string
          slot_time: string
          start_date: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          created_by: string
          customer_name: string
          customer_phone?: string | null
          days_of_week?: number[]
          duration_minutes?: number
          end_date: string
          group_name?: string | null
          id?: string
          is_active?: boolean
          leader_name?: string | null
          notes?: string | null
          plan_type?: string
          resource_id: string
          slot_time: string
          start_date: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          created_by?: string
          customer_name?: string
          customer_phone?: string | null
          days_of_week?: number[]
          duration_minutes?: number
          end_date?: string
          group_name?: string | null
          id?: string
          is_active?: boolean
          leader_name?: string | null
          notes?: string | null
          plan_type?: string
          resource_id?: string
          slot_time?: string
          start_date?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_plans_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_plans_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          amount_agreed: number | null
          billing_status: string
          created_at: string
          grace_period_days: number
          id: string
          is_active: boolean
          name: string
          owner_id: string
          plan_id: string | null
          renew_date: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end: string | null
          subscription_start: string | null
          updated_at: string
        }
        Insert: {
          amount_agreed?: number | null
          billing_status?: string
          created_at?: string
          grace_period_days?: number
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          plan_id?: string | null
          renew_date?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string
        }
        Update: {
          amount_agreed?: number | null
          billing_status?: string
          created_at?: string
          grace_period_days?: number
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          plan_id?: string | null
          renew_date?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          center_id: string
          created_at: string
          id: string
          method: string
          payment_type: string
          received_by: string
          session_id: string
        }
        Insert: {
          amount: number
          center_id: string
          created_at?: string
          id?: string
          method?: string
          payment_type?: string
          received_by: string
          session_id: string
        }
        Update: {
          amount?: number
          center_id?: string
          created_at?: string
          id?: string
          method?: string
          payment_type?: string
          received_by?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_participants: {
        Row: {
          amount: number
          created_at: string
          id: string
          name: string
          payment_status: string
          phone: string | null
          plan_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          name: string
          payment_status?: string
          phone?: string | null
          plan_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          name?: string
          payment_status?: string
          phone?: string | null
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_participants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "monthly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          allow_bookings: boolean
          created_at: string
          features: Json | null
          id: string
          is_active: boolean
          max_centers: number
          max_resources: number
          max_users: number
          module_access: Json
          name: string
          price_monthly: number
          updated_at: string
        }
        Insert: {
          allow_bookings?: boolean
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          max_centers?: number
          max_resources?: number
          max_users?: number
          module_access?: Json
          name: string
          price_monthly?: number
          updated_at?: string
        }
        Update: {
          allow_bookings?: boolean
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          max_centers?: number
          max_resources?: number
          max_users?: number
          module_access?: Json
          name?: string
          price_monthly?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          center_id: string
          created_at: string
          day_of_week: number | null
          end_time: string | null
          flat_price: number | null
          id: string
          is_active: boolean
          name: string
          price_multiplier: number
          resource_id: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          flat_price?: number | null
          id?: string
          is_active?: boolean
          name: string
          price_multiplier?: number
          resource_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          flat_price?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price_multiplier?: number
          resource_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          center_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          center_id?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          center_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      public_payments: {
        Row: {
          amount: number
          center_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          payment_method: string
          session_id: string
          status: string
          transaction_id: string
          updated_at: string
          utr_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount?: number
          center_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_method?: string
          session_id: string
          status?: string
          transaction_id?: string
          updated_at?: string
          utr_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          center_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_method?: string
          session_id?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          utr_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_payments_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          capacity: number | null
          center_id: string
          created_at: string
          hourly_rate: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          pricing_type: string | null
          status: string | null
          type: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          center_id: string
          created_at?: string
          hourly_rate?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          pricing_type?: string | null
          status?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          center_id?: string
          created_at?: string
          hourly_rate?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          pricing_type?: string | null
          status?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          base_amount: number
          center_id: string
          checked_in_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          discount_percent: number
          duration_minutes: number | null
          end_time: string | null
          final_amount: number
          id: string
          notes: string | null
          payment_status: string
          phone: string | null
          qr_code: string | null
          reminder_sent: boolean
          resource_id: string
          scheduled_end_time: string
          session_time_range: unknown
          start_time: string
          started_by: string
          status: Database["public"]["Enums"]["session_status"]
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          base_amount?: number
          center_id: string
          checked_in_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          discount_percent?: number
          duration_minutes?: number | null
          end_time?: string | null
          final_amount?: number
          id?: string
          notes?: string | null
          payment_status?: string
          phone?: string | null
          qr_code?: string | null
          reminder_sent?: boolean
          resource_id: string
          scheduled_end_time?: string
          session_time_range?: unknown
          start_time?: string
          started_by: string
          status?: Database["public"]["Enums"]["session_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          base_amount?: number
          center_id?: string
          checked_in_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount_percent?: number
          duration_minutes?: number | null
          end_time?: string | null
          final_amount?: number
          id?: string
          notes?: string | null
          payment_status?: string
          phone?: string | null
          qr_code?: string | null
          reminder_sent?: boolean
          resource_id?: string
          scheduled_end_time?: string
          session_time_range?: unknown
          start_time?: string
          started_by?: string
          status?: Database["public"]["Enums"]["session_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          bio: string | null
          center_id: string
          created_at: string
          email: string | null
          experience_years: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          phone: string | null
          rating: number
          sport: string
          total_reviews: number
          updated_at: string
        }
        Insert: {
          bio?: string | null
          center_id: string
          created_at?: string
          email?: string | null
          experience_years?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          phone?: string | null
          rating?: number
          sport?: string
          total_reviews?: number
          updated_at?: string
        }
        Update: {
          bio?: string | null
          center_id?: string
          created_at?: string
          email?: string | null
          experience_years?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          phone?: string | null
          rating?: number
          sport?: string
          total_reviews?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainers_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      turfs: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          center_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          center_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          center_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_center_id: { Args: { _user_id: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_resource_publicly_visible: {
        Args: { _resource_id: string }
        Returns: boolean
      }
      is_subscription_valid: { Args: { _org_id: string }; Returns: boolean }
      org_can_book: { Args: { _org_id: string }; Returns: boolean }
      org_has_module_access: {
        Args: { _module: string; _org_id: string }
        Returns: boolean
      }
      user_belongs_to_center: {
        Args: { _center_id: string; _user_id: string }
        Returns: boolean
      }
      user_belongs_to_organization: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "center_admin"
        | "staff"
        | "marshal"
        | "organization_admin"
      approval_status: "pending" | "approved" | "rejected"
      session_status:
        | "active"
        | "completed"
        | "cancelled"
        | "scheduled"
        | "no_show"
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
      app_role: [
        "super_admin",
        "center_admin",
        "staff",
        "marshal",
        "organization_admin",
      ],
      approval_status: ["pending", "approved", "rejected"],
      session_status: [
        "active",
        "completed",
        "cancelled",
        "scheduled",
        "no_show",
      ],
    },
  },
} as const
