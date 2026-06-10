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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_messages: {
        Row: {
          body: string
          category: string
          created_at: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          sent_by: string
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_by: string
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_by?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_categories: {
        Row: {
          code: string
          created_at: string | null
          display_order: number | null
          icon_class: string | null
          id: string
          label: string
          translations: Json
        }
        Insert: {
          code: string
          created_at?: string | null
          display_order?: number | null
          icon_class?: string | null
          id?: string
          label: string
          translations?: Json
        }
        Update: {
          code?: string
          created_at?: string | null
          display_order?: number | null
          icon_class?: string | null
          id?: string
          label?: string
          translations?: Json
        }
        Relationships: []
      }
      attribute_options: {
        Row: {
          attribute_id: string
          code: string
          created_at: string | null
          display_order: number | null
          id: string
          label: string
          tier: number | null
          translations: Json
        }
        Insert: {
          attribute_id: string
          code: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          label: string
          tier?: number | null
          translations?: Json
        }
        Update: {
          attribute_id?: string
          code?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          label?: string
          tier?: number | null
          translations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_types: {
        Row: {
          code: string
          created_at: string | null
          id: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      attributes: {
        Row: {
          category_id: string | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          icon_class: string | null
          icon_url: string | null
          id: string
          is_approved: boolean | null
          is_enabled: boolean | null
          is_filterable: boolean | null
          is_highlighted: boolean | null
          label: string
          translations: Json
          type_id: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon_class?: string | null
          icon_url?: string | null
          id?: string
          is_approved?: boolean | null
          is_enabled?: boolean | null
          is_filterable?: boolean | null
          is_highlighted?: boolean | null
          label: string
          translations?: Json
          type_id: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon_class?: string | null
          icon_url?: string | null
          id?: string
          is_approved?: boolean | null
          is_enabled?: boolean | null
          is_filterable?: boolean | null
          is_highlighted?: boolean | null
          label?: string
          translations?: Json
          type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "attribute_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "attribute_types"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          action_category: string | null
          actor_email: string | null
          actor_id: string | null
          actor_type: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          action_category?: string | null
          actor_email?: string | null
          actor_id?: string | null
          actor_type: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_category?: string | null
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          best_offer_subtotal: number
          cancellation_policy_snapshot: Json | null
          check_in: string
          check_out: string
          commission_rate_id: string
          created_at: string | null
          escrow_status: string
          guests: number
          id: string
          is_check_in_confirmed: boolean | null
          listing_id: string
          paid_amount: number | null
          receipt_url: string | null
          reservation_code: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          subtotal: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_offer_subtotal?: number
          cancellation_policy_snapshot?: Json | null
          check_in: string
          check_out: string
          commission_rate_id: string
          created_at?: string | null
          escrow_status?: string
          guests?: number
          id?: string
          is_check_in_confirmed?: boolean | null
          listing_id: string
          paid_amount?: number | null
          receipt_url?: string | null
          reservation_code?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          subtotal: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_offer_subtotal?: number
          cancellation_policy_snapshot?: Json | null
          check_in?: string
          check_out?: string
          commission_rate_id?: string
          created_at?: string | null
          escrow_status?: string
          guests?: number
          id?: string
          is_check_in_confirmed?: boolean | null
          listing_id?: string
          paid_amount?: number | null
          receipt_url?: string | null
          reservation_code?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          subtotal?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_commission_rate_id_fkey"
            columns: ["commission_rate_id"]
            isOneToOne: false
            referencedRelation: "commission_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_policies: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          display_order: number
          full_refund_days_before: number
          is_enabled: boolean
          label: string
          no_refund_days_before: number
          partial_refund_days_before: number
          partial_refund_pct: number
          translations: Json
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          full_refund_days_before?: number
          is_enabled?: boolean
          label: string
          no_refund_days_before?: number
          partial_refund_days_before?: number
          partial_refund_pct?: number
          translations?: Json
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          full_refund_days_before?: number
          is_enabled?: boolean
          label?: string
          no_refund_days_before?: number
          partial_refund_days_before?: number
          partial_refund_pct?: number
          translations?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          country_iso2: string
          created_at: string
          id: string
          is_custom: boolean
          latitude: number | null
          longitude: number | null
          name: string
          state_iso2: string | null
          translations: Json
          updated_at: string
        }
        Insert: {
          country_iso2: string
          created_at?: string
          id?: string
          is_custom?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          state_iso2?: string | null
          translations?: Json
          updated_at?: string
        }
        Update: {
          country_iso2?: string
          created_at?: string
          id?: string
          is_custom?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          state_iso2?: string | null
          translations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_iso2_fkey"
            columns: ["country_iso2"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso2"]
          },
          {
            foreignKeyName: "cities_country_iso2_state_iso2_fkey"
            columns: ["country_iso2", "state_iso2"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["country_iso2", "iso2"]
          },
        ]
      }
      commission_rates: {
        Row: {
          best_offer_rate: number
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_to: string | null
          guest_rate: number
          host_rate: number
          id: string
          notes: string | null
        }
        Insert: {
          best_offer_rate: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          guest_rate: number
          host_rate: number
          id?: string
          notes?: string | null
        }
        Update: {
          best_offer_rate?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          guest_rate?: number
          host_rate?: number
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean
          iso2: string
          latitude: number | null
          longitude: number | null
          name: string
          translations: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          iso2: string
          latitude?: number | null
          longitude?: number | null
          name: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          iso2?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: []
      }
      custom_pages: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          is_published: boolean | null
          slug: string
          title: Json
          updated_at: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          slug: string
          title?: Json
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          slug?: string
          title?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      dispute_messages: {
        Row: {
          attachments: Json | null
          created_at: string | null
          dispute_id: string
          id: string
          is_internal: boolean | null
          message: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          dispute_id: string
          id?: string
          is_internal?: boolean | null
          message: string
          sender_id: string
          sender_type: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          dispute_id?: string
          id?: string
          is_internal?: boolean | null
          message?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          booking_id: string
          closed_at: string | null
          created_at: string | null
          description: string
          dispute_type: string
          guest_id: string
          host_id: string
          id: string
          opened_by: string
          priority: string | null
          refund_amount: number | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          booking_id: string
          closed_at?: string | null
          created_at?: string | null
          description: string
          dispute_type: string
          guest_id: string
          host_id: string
          id?: string
          opened_by: string
          priority?: string | null
          refund_amount?: number | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          booking_id?: string
          closed_at?: string | null
          created_at?: string | null
          description?: string
          dispute_type?: string
          guest_id?: string
          host_id?: string
          id?: string
          opened_by?: string
          priority?: string | null
          refund_amount?: number | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow: {
        Row: {
          booking_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          status: Database["public"]["Enums"]["escrow_status"]
          type: Database["public"]["Enums"]["escrow_type"]
        }
        Insert: {
          booking_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          type: Database["public"]["Enums"]["escrow_type"]
        }
        Update: {
          booking_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          type?: Database["public"]["Enums"]["escrow_type"]
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      image_categories: {
        Row: {
          created_at: string | null
          icon: string | null
          is_active: boolean | null
          label: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          is_active?: boolean | null
          label: string
          slug: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          is_active?: boolean | null
          label?: string
          slug?: string
        }
        Relationships: []
      }
      lifestyle_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_special: boolean | null
          name: string
          slug: string
          translations: Json
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_special?: boolean | null
          name: string
          slug: string
          translations?: Json
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_special?: boolean | null
          name?: string
          slug?: string
          translations?: Json
        }
        Relationships: []
      }
      listing_attributes: {
        Row: {
          attribute_id: string
          created_at: string | null
          id: string
          is_highlighted: boolean | null
          listing_id: string
          notes: string | null
          updated_at: string | null
          value_number: number | null
          value_option_id: string | null
        }
        Insert: {
          attribute_id: string
          created_at?: string | null
          id?: string
          is_highlighted?: boolean | null
          listing_id: string
          notes?: string | null
          updated_at?: string | null
          value_number?: number | null
          value_option_id?: string | null
        }
        Update: {
          attribute_id?: string
          created_at?: string | null
          id?: string
          is_highlighted?: boolean | null
          listing_id?: string
          notes?: string | null
          updated_at?: string | null
          value_number?: number | null
          value_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_attributes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_attributes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_attributes_value_option_id_fkey"
            columns: ["value_option_id"]
            isOneToOne: false
            referencedRelation: "attribute_options"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_availability: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_available: boolean | null
          listing_id: string
          note: string | null
          price_override: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_available?: boolean | null
          listing_id: string
          note?: string | null
          price_override?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_available?: boolean | null
          listing_id?: string
          note?: string | null
          price_override?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_best_offers: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          listing_id: string
          offer_price: number | null
          start_date: string
          status: Database["public"]["Enums"]["best_offer_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          listing_id: string
          offer_price?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["best_offer_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          listing_id?: string
          offer_price?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["best_offer_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_best_offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_condition_assignments: {
        Row: {
          condition_id: string
          created_at: string | null
          id: string
          is_required: boolean | null
          listing_id: string
        }
        Insert: {
          condition_id: string
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          listing_id: string
        }
        Update: {
          condition_id?: string
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_condition_assignments_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "listing_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_condition_assignments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_conditions: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_approved: boolean | null
          is_system: boolean | null
          name: string
          translations: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_approved?: boolean | null
          is_system?: boolean | null
          name: string
          translations?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_approved?: boolean | null
          is_system?: boolean | null
          name?: string
          translations?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_conditions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          caption: string | null
          category: string
          created_at: string | null
          id: string
          listing_id: string
          order: number | null
          url: string
        }
        Insert: {
          caption?: string | null
          category?: string
          created_at?: string | null
          id?: string
          listing_id: string
          order?: number | null
          url: string
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string | null
          id?: string
          listing_id?: string
          order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "image_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_lifestyles: {
        Row: {
          created_at: string | null
          is_primary: boolean | null
          lifestyle_category_id: string
          listing_id: string
        }
        Insert: {
          created_at?: string | null
          is_primary?: boolean | null
          lifestyle_category_id: string
          listing_id: string
        }
        Update: {
          created_at?: string | null
          is_primary?: boolean | null
          lifestyle_category_id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_lifestyles_lifestyle_category_id_fkey"
            columns: ["lifestyle_category_id"]
            isOneToOne: false
            referencedRelation: "lifestyle_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_lifestyles_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_price_adjustments: {
        Row: {
          adjustment_type: string
          adjustment_value: number
          applies_to_days: string[] | null
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          listing_id: string
          name: string
          priority: number | null
          specific_dates: string[] | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          adjustment_type: string
          adjustment_value: number
          applies_to_days?: string[] | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          listing_id: string
          name: string
          priority?: number | null
          specific_dates?: string[] | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string
          adjustment_value?: number
          applies_to_days?: string[] | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          listing_id?: string
          name?: string
          priority?: number | null
          specific_dates?: string[] | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_price_adjustments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          beds: number | null
          cancellation_policy: string | null
          city_id: string | null
          cleaning_fee: number | null
          country_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          google_maps_link: string | null
          id: string
          is_guest_favorite: boolean | null
          is_published: boolean | null
          listing_code: string | null
          location: string
          location_geo: unknown
          max_guests: number | null
          min_nights: number | null
          price_per_night: number
          property_type_id: string | null
          state_id: string | null
          title: string
          translations: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          beds?: number | null
          cancellation_policy?: string | null
          city_id?: string | null
          cleaning_fee?: number | null
          country_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          google_maps_link?: string | null
          id?: string
          is_guest_favorite?: boolean | null
          is_published?: boolean | null
          listing_code?: string | null
          location: string
          location_geo?: unknown
          max_guests?: number | null
          min_nights?: number | null
          price_per_night: number
          property_type_id?: string | null
          state_id?: string | null
          title: string
          translations?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          beds?: number | null
          cancellation_policy?: string | null
          city_id?: string | null
          cleaning_fee?: number | null
          country_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          google_maps_link?: string | null
          id?: string
          is_guest_favorite?: boolean | null
          is_published?: boolean | null
          listing_code?: string | null
          location?: string
          location_geo?: unknown
          max_guests?: number | null
          min_nights?: number | null
          price_per_night?: number
          property_type_id?: string | null
          state_id?: string | null
          title?: string
          translations?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_cancellation_policy_fkey"
            columns: ["cancellation_policy"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_verifications: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          guest_id: string
          id: string
          payment_method: string
          receipt_url: string | null
          rejection_reason: string | null
          status: string
          transaction_reference: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          guest_id: string
          id?: string
          payment_method: string
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: string
          transaction_reference?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          guest_id?: string
          id?: string
          payment_method?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: string
          transaction_reference?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_verifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_verifications_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          completed_at: string | null
          created_at: string | null
          host_id: string
          id: string
          notes: string | null
          payout_method:
            | Database["public"]["Enums"]["payout_method_type"]
            | null
          payout_reference: string | null
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          host_id: string
          id?: string
          notes?: string | null
          payout_method?:
            | Database["public"]["Enums"]["payout_method_type"]
            | null
          payout_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          host_id?: string
          id?: string
          notes?: string | null
          payout_method?:
            | Database["public"]["Enums"]["payout_method_type"]
            | null
          payout_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string
          fcm_token: string | null
          full_name: string | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          is_host: boolean | null
          phone: string | null
          selfie_url: string | null
          updated_at: string | null
          verification_notes: string | null
          verification_status_id: number | null
          verification_submitted_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          fcm_token?: string | null
          full_name?: string | null
          id: string
          id_back_url?: string | null
          id_front_url?: string | null
          is_host?: boolean | null
          phone?: string | null
          selfie_url?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status_id?: number | null
          verification_submitted_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          fcm_token?: string | null
          full_name?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          is_host?: boolean | null
          phone?: string | null
          selfie_url?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status_id?: number | null
          verification_submitted_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_verification_status_id_fkey"
            columns: ["verification_status_id"]
            isOneToOne: false
            referencedRelation: "verification_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          translations: Json
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          translations?: Json
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          translations?: Json
          type?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          booking_id: string
          created_at: string | null
          id: string
          initiated_by: string | null
          policy_applied: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          refund_type: Database["public"]["Enums"]["refund_type"]
          status: Database["public"]["Enums"]["refund_status"]
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          policy_applied?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          refund_type?: Database["public"]["Enums"]["refund_type"]
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          policy_applied?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          refund_type?: Database["public"]["Enums"]["refund_type"]
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_policy_applied_fkey"
            columns: ["policy_applied"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          is_hidden: boolean | null
          listing_id: string
          private_feedback: Json | null
          rating: number
          rating_accuracy: number | null
          rating_check_in: number | null
          rating_cleanliness: number | null
          rating_communication: number | null
          rating_location: number | null
          rating_value: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          listing_id: string
          private_feedback?: Json | null
          rating: number
          rating_accuracy?: number | null
          rating_check_in?: number | null
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_location?: number | null
          rating_value?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          listing_id?: string
          private_feedback?: Json | null
          rating?: number
          rating_accuracy?: number | null
          rating_check_in?: number | null
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_location?: number | null
          rating_value?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_destinations: {
        Row: {
          country: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          include_surrounding: boolean | null
          is_active: boolean | null
          label: string
          listing_ids: string[] | null
          location: unknown
          radius_km: number | null
          translations: Json | null
          type: Database["public"]["Enums"]["destination_type"] | null
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          include_surrounding?: boolean | null
          is_active?: boolean | null
          label: string
          listing_ids?: string[] | null
          location?: unknown
          radius_km?: number | null
          translations?: Json | null
          type?: Database["public"]["Enums"]["destination_type"] | null
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          include_surrounding?: boolean | null
          is_active?: boolean | null
          label?: string
          listing_ids?: string[] | null
          location?: unknown
          radius_km?: number | null
          translations?: Json | null
          type?: Database["public"]["Enums"]["destination_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          banners_config: Json
          footer_config: Json
          hero_config: Json
          id: number
          navbar_config: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          banners_config?: Json
          footer_config?: Json
          hero_config?: Json
          id?: number
          navbar_config?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          banners_config?: Json
          footer_config?: Json
          hero_config?: Json
          id?: number
          navbar_config?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      staff_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_name: string
          email: string
          fcm_token: string | null
          id: string
          is_active: boolean | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_name: string
          email: string
          fcm_token?: string | null
          id: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string
          email?: string
          fcm_token?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          country_iso2: string
          created_at: string
          id: string
          iso2: string
          latitude: number | null
          longitude: number | null
          name: string
          translations: Json
          updated_at: string
        }
        Insert: {
          country_iso2: string
          created_at?: string
          id?: string
          iso2: string
          latitude?: number | null
          longitude?: number | null
          name: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          country_iso2?: string
          created_at?: string
          id?: string
          iso2?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "states_country_iso2_fkey"
            columns: ["country_iso2"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso2"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          id: string
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          balance_impact: boolean
          booking_id: string | null
          created_at: string
          id: string
          notes: string | null
          payout_id: string | null
          refund_id: string | null
          reversal_of_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_impact?: boolean
          booking_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payout_id?: string | null
          refund_id?: string | null
          reversal_of_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_impact?: boolean
          booking_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payout_id?: string | null
          refund_id?: string | null
          reversal_of_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_by: string
          created_at: string | null
          details: string | null
          duration_days: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          reason: string
          unbanned_at: string | null
          unbanned_by: string | null
          user_id: string
        }
        Insert: {
          ban_type: string
          banned_by: string
          created_at?: string | null
          details?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason: string
          unbanned_at?: string | null
          unbanned_by?: string | null
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_by?: string
          created_at?: string | null
          details?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string
          unbanned_at?: string | null
          unbanned_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bans_unbanned_by_fkey"
            columns: ["unbanned_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: string | null
          user_id: string | null
        }
        Insert: {
          role?: string | null
          user_id?: string | null
        }
        Update: {
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          acknowledged_at: string | null
          created_at: string | null
          details: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          issued_by: string
          reason: string
          related_entity_id: string | null
          related_entity_type: string | null
          user_id: string
          warning_level: number
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string | null
          details?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_by: string
          reason: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id: string
          warning_level: number
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string | null
          details?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_by?: string
          reason?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id?: string
          warning_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_warnings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_statuses: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: number
          label: string
          label_ar: string | null
          sort_order: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: number
          label: string
          label_ar?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: number
          label?: string
          label_ar?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          wishlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      calc_booking_fees: {
        Args: { p_booking_id: string }
        Returns: {
          guest_fee: number
          host_fee: number
          host_payout: number
          platform_earnings: number
          subtotal: number
          total_with_fees: number
        }[]
      }
      calc_refund_amount: { Args: { p_refund_id: string }; Returns: number }
      calculate_listing_price: {
        Args: { p_date: string; p_listing_id: string }
        Returns: number
      }
      check_listing_availability: {
        Args: { p_check_in: string; p_check_out: string; p_listing_id: string }
        Returns: {
          conflict_reason: string
          has_conflict: boolean
        }[]
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_name?: string
          p_entity_type?: string
          p_metadata?: Json
          p_new_data?: Json
          p_notes?: string
          p_old_data?: Json
        }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_destinations_with_coords: {
        Args: { p_locale?: string }
        Returns: {
          country: string
          created_at: string
          description: string
          display_order: number
          en_label: string
          id: string
          image_url: string
          include_surrounding: boolean
          is_active: boolean
          label: string
          lat: number
          listing_ids: string[]
          lng: number
          radius_km: number
          type: string
        }[]
      }
      get_booking_dispute_count: {
        Args: { p_booking_id: string }
        Returns: number
      }
      get_commission_rates_at: {
        Args: { p_ts: string }
        Returns: {
          best_offer_rate: number
          effective_from: string
          effective_to: string
          guest_rate: number
          host_rate: number
          id: string
        }[]
      }
      get_current_commission_rates: {
        Args: never
        Returns: {
          best_offer_rate: number
          effective_from: string
          guest_rate: number
          host_rate: number
          id: string
        }[]
      }
      get_destination_with_wkt: {
        Args: { dest_id: string }
        Returns: {
          country: string
          created_at: string
          description: string
          display_order: number
          id: string
          image_url: string
          include_surrounding: boolean
          is_active: boolean
          label: string
          listing_ids: string[]
          location: string
          radius_km: number
          type: string
          updated_at: string
        }[]
      }
      get_listing_booked_dates: {
        Args: { listing_uuid: string }
        Returns: {
          check_in: string
          check_out: string
        }[]
      }
      get_listing_rating: { Args: { listing_uuid: string }; Returns: number }
      get_listing_review_count: {
        Args: { listing_uuid: string }
        Returns: number
      }
      get_listings_nearby: {
        Args: { lat: number; lng: number; radius_km: number }
        Returns: {
          bathrooms: number | null
          bedrooms: number | null
          beds: number | null
          cancellation_policy: string | null
          city_id: string | null
          cleaning_fee: number | null
          country_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          google_maps_link: string | null
          id: string
          is_guest_favorite: boolean | null
          is_published: boolean | null
          listing_code: string | null
          location: string
          location_geo: unknown
          max_guests: number | null
          min_nights: number | null
          price_per_night: number
          property_type_id: string | null
          state_id: string | null
          title: string
          translations: Json | null
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_listings_with_coords: {
        Args: never
        Returns: {
          amenities: string[]
          bathrooms: number
          bedrooms: number
          beds: number
          cancellation_policy: string
          city: string
          cleaning_fee: number
          country: string
          created_at: string
          currency: string
          description: string
          google_maps_link: string
          house_rules: string
          id: string
          is_guest_favorite: boolean
          is_pets_allowed: boolean
          is_published: boolean
          lat: number
          listing_code: string
          lng: number
          location: string
          max_guests: number
          min_nights: number
          price_per_night: number
          property_type_id: string
          special_conditions: string
          state: string
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      get_platform_setting: { Args: { p_key: string }; Returns: string }
      get_staff_role: { Args: { user_id?: string }; Returns: string }
      get_unread_admin_message_count: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_user_active_disputes: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_user_balance: {
        Args: { p_user_id: string }
        Returns: {
          available_balance: number
          on_hold_balance: number
          total_earned: number
        }[]
      }
      get_user_max_warning_level: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_verification_status: {
        Args: { user_id: string }
        Returns: string
      }
      get_user_warning_count: { Args: { p_user_id: string }; Returns: number }
      gettransactionid: { Args: never; Returns: unknown }
      is_admin: { Args: { user_id?: string }; Returns: boolean }
      is_staff: { Args: { user_id?: string }; Returns: boolean }
      is_user_banned: { Args: { p_user_id: string }; Returns: boolean }
      is_user_verified: { Args: { user_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      search_listings: {
        Args: {
          p_attribute_codes?: string[]
          p_best_offer?: boolean
          p_category_slug?: string
          p_check_in?: string
          p_check_out?: string
          p_country?: string
          p_geo_lat?: number
          p_geo_lng?: number
          p_geo_radius_km?: number
          p_guests?: number
          p_include_surrounding?: boolean
          p_limit?: number
          p_locale?: string
          p_location?: string
          p_offset?: number
          p_price_max?: number
          p_price_min?: number
          p_property_type_slugs?: string[]
          p_specific_ids?: string[]
        }
        Returns: {
          avg_rating: number
          bathrooms: number
          bedrooms: number
          beds: number
          best_offer_price: number
          cancellation_policy: string
          city: string
          cleaning_fee: number
          country: string
          created_at: string
          currency: string
          description: string
          display_price: number
          host_json: Json
          id: string
          images_json: Json
          is_guest_favorite: boolean
          is_published: boolean
          lat: number
          lifestyles_json: Json
          listing_code: string
          lng: number
          location: string
          max_guests: number
          num_nights: number
          price_per_night: number
          property_type_id: string
          property_type_json: Json
          review_count: number
          state: string
          title: string
          total_count: number
          total_price: number
          updated_at: string
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_commission_rates: {
        Args: {
          p_best_offer_rate: number
          p_created_by: string
          p_guest_rate: number
          p_host_rate: number
          p_notes: string
        }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      best_offer_status:
        | "requested"
        | "approved"
        | "rejected"
        | "expired"
        | "cancelled"
      booking_status:
        | "pending"
        | "active"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "rejected"
        | "stalled"
      destination_type: "city" | "area" | "curated"
      escrow_status: "pending" | "completed" | "failed" | "cancelled"
      escrow_type: "hold" | "release" | "refund"
      payout_method_type: "bank_transfer" | "vodafone_cash" | "instapay"
      payout_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      refund_status: "pending" | "approved" | "rejected" | "processed"
      refund_type: "full" | "partial"
      transaction_type:
        | "payment"
        | "guest_fee"
        | "earning"
        | "commission_base"
        | "commission_promo"
        | "refund"
        | "withdrawal"
        | "cash_commission"
        | "reversal"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      best_offer_status: [
        "requested",
        "approved",
        "rejected",
        "expired",
        "cancelled",
      ],
      booking_status: [
        "pending",
        "active",
        "confirmed",
        "cancelled",
        "completed",
        "rejected",
        "stalled",
      ],
      destination_type: ["city", "area", "curated"],
      escrow_status: ["pending", "completed", "failed", "cancelled"],
      escrow_type: ["hold", "release", "refund"],
      payout_method_type: ["bank_transfer", "vodafone_cash", "instapay"],
      payout_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      refund_status: ["pending", "approved", "rejected", "processed"],
      refund_type: ["full", "partial"],
      transaction_type: [
        "payment",
        "guest_fee",
        "earning",
        "commission_base",
        "commission_promo",
        "refund",
        "withdrawal",
        "cash_commission",
        "reversal",
      ],
    },
  },
} as const