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
      account_groups: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable: {
        Row: {
          account_id: string | null
          amount: number
          attachments: Json | null
          created_at: string
          created_by: string
          data_competencia: string | null
          description: string
          document_number: string | null
          document_type: string | null
          due_date: string
          employee_id: string | null
          id: string
          issue_date: string | null
          notes: string | null
          payment_date: string | null
          status: string
          store_id: string
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachments?: Json | null
          created_at?: string
          created_by: string
          data_competencia?: string | null
          description: string
          document_number?: string | null
          document_type?: string | null
          due_date: string
          employee_id?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          payment_date?: string | null
          status?: string
          store_id: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachments?: Json | null
          created_at?: string
          created_by?: string
          data_competencia?: string | null
          description?: string
          document_number?: string | null
          document_type?: string | null
          due_date?: string
          employee_id?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          payment_date?: string | null
          status?: string
          store_id?: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable_installments: {
        Row: {
          account_payable_id: string
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          payment_date: string | null
          updated_at: string
        }
        Insert: {
          account_payable_id: string
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          payment_date?: string | null
          updated_at?: string
        }
        Update: {
          account_payable_id?: string
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          payment_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_installments_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable_items: {
        Row: {
          account_payable_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          store_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          account_payable_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          store_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          account_payable_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          store_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_items_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable_payments: {
        Row: {
          account_payable_id: string
          amount_paid: number
          created_at: string
          created_by: string
          discount_amount: number
          discount_product_id: string | null
          id: string
          installment_id: string
          interest_amount: number
          interest_product_id: string | null
          notes: string | null
          payment_account_id: string | null
          payment_account_type: string | null
          payment_date: string
          updated_at: string
        }
        Insert: {
          account_payable_id: string
          amount_paid?: number
          created_at?: string
          created_by: string
          discount_amount?: number
          discount_product_id?: string | null
          id?: string
          installment_id: string
          interest_amount?: number
          interest_product_id?: string | null
          notes?: string | null
          payment_account_id?: string | null
          payment_account_type?: string | null
          payment_date: string
          updated_at?: string
        }
        Update: {
          account_payable_id?: string
          amount_paid?: number
          created_at?: string
          created_by?: string
          discount_amount?: number
          discount_product_id?: string | null
          id?: string
          installment_id?: string
          interest_amount?: number
          interest_product_id?: string | null
          notes?: string | null
          payment_account_id?: string | null
          payment_account_type?: string | null
          payment_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_payments_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_payments_discount_product_id_fkey"
            columns: ["discount_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_payments_interest_product_id_fkey"
            columns: ["interest_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          account_id: string | null
          amount: number
          attachments: Json | null
          created_at: string
          created_by: string
          creditor_id: string | null
          data_competencia: string | null
          description: string
          document_number: string | null
          document_type: string | null
          due_date: string
          id: string
          issue_date: string | null
          notes: string | null
          payment_date: string | null
          status: string
          store_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachments?: Json | null
          created_at?: string
          created_by: string
          creditor_id?: string | null
          data_competencia?: string | null
          description: string
          document_number?: string | null
          document_type?: string | null
          due_date: string
          id?: string
          issue_date?: string | null
          notes?: string | null
          payment_date?: string | null
          status?: string
          store_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachments?: Json | null
          created_at?: string
          created_by?: string
          creditor_id?: string | null
          data_competencia?: string | null
          description?: string
          document_number?: string | null
          document_type?: string | null
          due_date?: string
          id?: string
          issue_date?: string | null
          notes?: string | null
          payment_date?: string | null
          status?: string
          store_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "creditors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_installments: {
        Row: {
          account_receivable_id: string
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          payment_date: string | null
          updated_at: string
        }
        Insert: {
          account_receivable_id: string
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          payment_date?: string | null
          updated_at?: string
        }
        Update: {
          account_receivable_id?: string
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          payment_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_installments_account_receivable_id_fkey"
            columns: ["account_receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_items: {
        Row: {
          account_receivable_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          store_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          account_receivable_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          store_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          account_receivable_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          store_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_items_account_receivable_id_fkey"
            columns: ["account_receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_payments: {
        Row: {
          account_receivable_id: string
          amount_paid: number
          created_at: string
          created_by: string
          discount_amount: number
          discount_product_id: string | null
          id: string
          installment_id: string
          interest_amount: number
          interest_product_id: string | null
          notes: string | null
          payment_account_id: string | null
          payment_account_type: string | null
          payment_date: string
          updated_at: string
        }
        Insert: {
          account_receivable_id: string
          amount_paid?: number
          created_at?: string
          created_by: string
          discount_amount?: number
          discount_product_id?: string | null
          id?: string
          installment_id: string
          interest_amount?: number
          interest_product_id?: string | null
          notes?: string | null
          payment_account_id?: string | null
          payment_account_type?: string | null
          payment_date: string
          updated_at?: string
        }
        Update: {
          account_receivable_id?: string
          amount_paid?: number
          created_at?: string
          created_by?: string
          discount_amount?: number
          discount_product_id?: string | null
          id?: string
          installment_id?: string
          interest_amount?: number
          interest_product_id?: string | null
          notes?: string | null
          payment_account_id?: string | null
          payment_account_type?: string | null
          payment_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_payments_account_receivable_id_fkey"
            columns: ["account_receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_payments_discount_product_id_fkey"
            columns: ["discount_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_payments_interest_product_id_fkey"
            columns: ["interest_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_batches: {
        Row: {
          code: number
          created_at: string
          description: string | null
          id: string
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          code: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_breeds: {
        Row: {
          code: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          code: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_breeds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_categories: {
        Row: {
          code: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          code: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          auction_id: string | null
          auction_lot: string | null
          batch_id: string | null
          birth_date: string | null
          breed_id: string | null
          category_id: string | null
          code: number
          cover_photo: string | null
          created_at: string
          dam_id: string | null
          ear_tag: number | null
          farm_entry_date: string | null
          farm_id: string | null
          farm_type: string | null
          first_weighing_date: string | null
          first_weight: number | null
          id: string
          is_active: boolean
          name: string
          observations: string | null
          photos: Json | null
          recipient_id: string | null
          registration: string | null
          sex: string
          sire_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          auction_id?: string | null
          auction_lot?: string | null
          batch_id?: string | null
          birth_date?: string | null
          breed_id?: string | null
          category_id?: string | null
          code: number
          cover_photo?: string | null
          created_at?: string
          dam_id?: string | null
          ear_tag?: number | null
          farm_entry_date?: string | null
          farm_id?: string | null
          farm_type?: string | null
          first_weighing_date?: string | null
          first_weight?: number | null
          id?: string
          is_active?: boolean
          name: string
          observations?: string | null
          photos?: Json | null
          recipient_id?: string | null
          registration?: string | null
          sex: string
          sire_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          auction_id?: string | null
          auction_lot?: string | null
          batch_id?: string | null
          birth_date?: string | null
          breed_id?: string | null
          category_id?: string | null
          code?: number
          cover_photo?: string | null
          created_at?: string
          dam_id?: string | null
          ear_tag?: number | null
          farm_entry_date?: string | null
          farm_id?: string | null
          farm_type?: string | null
          first_weighing_date?: string | null
          first_weight?: number | null
          id?: string
          is_active?: boolean
          name?: string
          observations?: string | null
          photos?: Json | null
          recipient_id?: string | null
          registration?: string | null
          sex?: string
          sire_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "leiloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "animal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "animal_breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "animal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "breeding_animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "breeding_animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      aspiration_management: {
        Row: {
          auction_id: string | null
          auction_lot: string | null
          breed_id: string | null
          category_id: string | null
          code: number
          created_at: string
          dam_id: string | null
          expected_aspiration_month: string | null
          farm_id: string | null
          farm_type: string | null
          id: string
          name: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          auction_id?: string | null
          auction_lot?: string | null
          breed_id?: string | null
          category_id?: string | null
          code: number
          created_at?: string
          dam_id?: string | null
          expected_aspiration_month?: string | null
          farm_id?: string | null
          farm_type?: string | null
          id?: string
          name: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          auction_id?: string | null
          auction_lot?: string | null
          breed_id?: string | null
          category_id?: string | null
          code?: number
          created_at?: string
          dam_id?: string | null
          expected_aspiration_month?: string | null
          farm_id?: string | null
          farm_type?: string | null
          id?: string
          name?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aspiration_management_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "leiloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiration_management_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "animal_breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiration_management_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "animal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiration_management_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "breeding_animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aspiration_management_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      breeding_animals: {
        Row: {
          created_at: string
          dam_id: string | null
          id: string
          is_active: boolean
          name: string
          registration: string | null
          sex: string
          sire_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dam_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          registration?: string | null
          sex: string
          sire_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dam_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          registration?: string | null
          sex?: string
          sire_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeding_animals_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "breeding_animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_animals_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "breeding_animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_animals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      card_account_stores: {
        Row: {
          account_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_account_stores_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_account_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      card_accounts: {
        Row: {
          account_number: string
          bank: string
          created_at: string
          id: string
          initial_balance: number
          initial_balance_date: string
          is_active: boolean
          is_blocked: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_number: string
          bank: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date: string
          is_active?: boolean
          is_blocked?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          bank?: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          is_active?: boolean
          is_blocked?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_account_stores: {
        Row: {
          account_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_account_stores_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_account_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_accounts: {
        Row: {
          account_number: string | null
          bank: string | null
          created_at: string
          id: string
          initial_balance: number
          initial_balance_date: string
          is_active: boolean
          is_blocked: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank?: string | null
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date: string
          is_active?: boolean
          is_blocked?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank?: string | null
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          is_active?: boolean
          is_blocked?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_control: {
        Row: {
          anexos: Json | null
          approved_at: string | null
          approved_by: string | null
          approved_status: boolean | null
          attachment_status: Json | null
          closing_balance: number
          contagem_dinheiro: number | null
          created_at: string
          created_by: string
          created_by_name: string | null
          date: string
          despesas_pagas: number | null
          diferenca: number | null
          edit_history: Json | null
          edited_at: string | null
          edited_by: string | null
          edited_by_name: string | null
          faturamento_cartao: number | null
          faturamento_conta: number | null
          faturamento_delivery: number | null
          faturamento_dinheiro: number | null
          faturamento_total: number | null
          id: string
          image_urls: string[] | null
          notes: string | null
          opening_balance: number
          saldo_inicial: number | null
          store_id: string
          total_expenses: number
          total_sales: number
          updated_at: string
          valor_fechamento_pdv: number | null
          valor_mantido_caixa: number | null
        }
        Insert: {
          anexos?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_status?: boolean | null
          attachment_status?: Json | null
          closing_balance?: number
          contagem_dinheiro?: number | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          date: string
          despesas_pagas?: number | null
          diferenca?: number | null
          edit_history?: Json | null
          edited_at?: string | null
          edited_by?: string | null
          edited_by_name?: string | null
          faturamento_cartao?: number | null
          faturamento_conta?: number | null
          faturamento_delivery?: number | null
          faturamento_dinheiro?: number | null
          faturamento_total?: number | null
          id?: string
          image_urls?: string[] | null
          notes?: string | null
          opening_balance?: number
          saldo_inicial?: number | null
          store_id: string
          total_expenses?: number
          total_sales?: number
          updated_at?: string
          valor_fechamento_pdv?: number | null
          valor_mantido_caixa?: number | null
        }
        Update: {
          anexos?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_status?: boolean | null
          attachment_status?: Json | null
          closing_balance?: number
          contagem_dinheiro?: number | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          date?: string
          despesas_pagas?: number | null
          diferenca?: number | null
          edit_history?: Json | null
          edited_at?: string | null
          edited_by?: string | null
          edited_by_name?: string | null
          faturamento_cartao?: number | null
          faturamento_conta?: number | null
          faturamento_delivery?: number | null
          faturamento_dinheiro?: number | null
          faturamento_total?: number | null
          id?: string
          image_urls?: string[] | null
          notes?: string | null
          opening_balance?: number
          saldo_inicial?: number | null
          store_id?: string
          total_expenses?: number
          total_sales?: number
          updated_at?: string
          valor_fechamento_pdv?: number | null
          valor_mantido_caixa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_control_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_control_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_control_account_items: {
        Row: {
          cash_control_id: string
          created_at: string
          current_account_id: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          cash_control_id: string
          created_at?: string
          current_account_id: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cash_control_id?: string
          created_at?: string
          current_account_id?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_control_account_items_cash_control_id_fkey"
            columns: ["cash_control_id"]
            isOneToOne: false
            referencedRelation: "cash_control"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_control_account_items_current_account_id_fkey"
            columns: ["current_account_id"]
            isOneToOne: false
            referencedRelation: "current_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_control_card_items: {
        Row: {
          card_account_id: string
          cash_control_id: string
          created_at: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          card_account_id: string
          cash_control_id: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          card_account_id?: string
          cash_control_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_control_card_items_card_account_id_fkey"
            columns: ["card_account_id"]
            isOneToOne: false
            referencedRelation: "card_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_control_card_items_cash_control_id_fkey"
            columns: ["cash_control_id"]
            isOneToOne: false
            referencedRelation: "cash_control"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_control_cash_items: {
        Row: {
          cash_account_id: string
          cash_control_id: string
          created_at: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          cash_account_id: string
          cash_control_id: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cash_account_id?: string
          cash_control_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      cash_control_delivery_items: {
        Row: {
          cash_control_id: string
          created_at: string
          delivery_account_id: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          cash_control_id: string
          created_at?: string
          delivery_account_id: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cash_control_id?: string
          created_at?: string
          delivery_account_id?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_control_delivery_items_cash_control_id_fkey"
            columns: ["cash_control_id"]
            isOneToOne: false
            referencedRelation: "cash_control"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_control_delivery_items_delivery_account_id_fkey"
            columns: ["delivery_account_id"]
            isOneToOne: false
            referencedRelation: "delivery_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_control_expenses: {
        Row: {
          amount: number
          attachment_status: Json | null
          attachments: Json | null
          created_at: string
          created_by: string
          created_by_name: string | null
          description: string
          edit_history: Json | null
          expense_type: string
          id: string
          is_disabled: boolean
          issue_date: string
          linked_account_payable_id: string | null
          reference_month: number
          reference_year: number
          store_id: string
          supplier: string
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_status?: Json | null
          attachments?: Json | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          description: string
          edit_history?: Json | null
          expense_type: string
          id?: string
          is_disabled?: boolean
          issue_date: string
          linked_account_payable_id?: string | null
          reference_month?: number
          reference_year?: number
          store_id: string
          supplier: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_status?: Json | null
          attachments?: Json | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          description?: string
          edit_history?: Json | null
          expense_type?: string
          id?: string
          is_disabled?: boolean
          issue_date?: string
          linked_account_payable_id?: string | null
          reference_month?: number
          reference_year?: number
          store_id?: string
          supplier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_control_expenses_linked_account_payable_id_fkey"
            columns: ["linked_account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_control_expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      creditors: {
        Row: {
          address: string | null
          city: string | null
          cnpj_cpf: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_creditors_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      current_account_stores: {
        Row: {
          account_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "current_account_stores_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "current_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "current_account_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      current_accounts: {
        Row: {
          account_number: string
          bank: string
          created_at: string
          id: string
          initial_balance: number
          initial_balance_date: string
          is_active: boolean
          is_blocked: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_number: string
          bank: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date: string
          is_active?: boolean
          is_blocked?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          bank?: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          is_active?: boolean
          is_blocked?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_account_stores: {
        Row: {
          account_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_account_stores_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "delivery_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_account_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_accounts: {
        Row: {
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          initial_balance: number
          initial_balance_date: string
          is_active: boolean
          is_blocked: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          initial_balance?: number
          initial_balance_date: string
          is_active?: boolean
          is_blocked?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          is_active?: boolean
          is_blocked?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dre_entries: {
        Row: {
          created_at: string
          created_by: string
          id: string
          month: number
          store_id: string
          structure_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          month: number
          store_id: string
          structure_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          month?: number
          store_id?: string
          structure_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "dre_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_entries_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "dre_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_entry_values: {
        Row: {
          comment: string | null
          created_at: string
          entry_id: string
          id: string
          structure_item_id: string
          updated_at: string
          value: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          entry_id: string
          id?: string
          structure_item_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          structure_item_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "dre_entry_values_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "dre_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_entry_values_structure_item_id_fkey"
            columns: ["structure_item_id"]
            isOneToOne: false
            referencedRelation: "dre_structure_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_structure_items: {
        Row: {
          account_group_id: string | null
          created_at: string
          description: string | null
          id: string
          item_type: string
          name: string
          operation_type: string
          parent_id: string | null
          position_order: number
          structure_id: string
          sum_items: string[] | null
        }
        Insert: {
          account_group_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          name: string
          operation_type?: string
          parent_id?: string | null
          position_order: number
          structure_id: string
          sum_items?: string[] | null
        }
        Update: {
          account_group_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          name?: string
          operation_type?: string
          parent_id?: string | null
          position_order?: number
          structure_id?: string
          sum_items?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_structure_items_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_structure_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "dre_structure_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_structure_items_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "dre_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_structures: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_structures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_obligation_attachments: {
        Row: {
          completion_id: string
          file_name: string
          file_path: string
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          completion_id: string
          file_name: string
          file_path: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          completion_id?: string
          file_name?: string
          file_path?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_obligation_attachments_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "employee_obligation_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_obligation_completions: {
        Row: {
          attachment_url: string | null
          completed_at: string
          completed_by: string
          created_at: string
          due_date: string | null
          employee_id: string
          id: string
          notes: string | null
          obligation_id: string
          reference_month: number | null
          reference_year: number | null
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          completed_at?: string
          completed_by: string
          created_at?: string
          due_date?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          obligation_id: string
          reference_month?: number | null
          reference_year?: number | null
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          completed_at?: string
          completed_by?: string
          created_at?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          obligation_id?: string
          reference_month?: number | null
          reference_year?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_obligation_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_obligation_completions_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "employee_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_obligations: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          recurrence_months: number | null
          recurrence_type: string
          store_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          recurrence_months?: number | null
          recurrence_type?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          recurrence_months?: number | null
          recurrence_type?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          address: string | null
          attachments: Json | null
          bank_account: string | null
          base_salary: number
          birth_date: string | null
          cpf: string
          created_at: string
          dismissal_date: string | null
          email: string | null
          gender: string | null
          id: string
          is_active: boolean
          job_function_id: string | null
          marital_status: string | null
          name: string
          observations: string | null
          phone: string | null
          registration_date: string
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          attachments?: Json | null
          bank_account?: string | null
          base_salary?: number
          birth_date?: string | null
          cpf: string
          created_at?: string
          dismissal_date?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean
          job_function_id?: string | null
          marital_status?: string | null
          name: string
          observations?: string | null
          phone?: string | null
          registration_date?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          attachments?: Json | null
          bank_account?: string | null
          base_salary?: number
          birth_date?: string | null
          cpf?: string
          created_at?: string
          dismissal_date?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean
          job_function_id?: string | null
          marital_status?: string | null
          name?: string
          observations?: string | null
          phone?: string | null
          registration_date?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          store_id: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          created_by: string
          description: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          store_id: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      job_function_obligations: {
        Row: {
          created_at: string
          id: string
          job_function_id: string
          obligation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_function_id: string
          obligation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_function_id?: string
          obligation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_function_obligations_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_function_obligations_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "employee_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_functions: {
        Row: {
          base_salary: number
          code: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          base_salary?: number
          code: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          base_salary?: number
          code?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leiloes: {
        Row: {
          city: string
          code: number
          created_at: string
          date: string
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          city: string
          code: number
          created_at?: string
          date: string
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          city?: string
          code?: number
          created_at?: string
          date?: string
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leiloes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      period_blocks: {
        Row: {
          block_type: Database["public"]["Enums"]["block_type"]
          blocked_modules: string[]
          created_at: string
          created_by: string
          id: string
          month: number
          store_id: string
          updated_at: string
          year: number
        }
        Insert: {
          block_type: Database["public"]["Enums"]["block_type"]
          blocked_modules?: string[]
          created_at?: string
          created_by: string
          id?: string
          month: number
          store_id: string
          updated_at?: string
          year: number
        }
        Update: {
          block_type?: Database["public"]["Enums"]["block_type"]
          blocked_modules?: string[]
          created_at?: string
          created_by?: string
          id?: string
          month?: number
          store_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      pregnancy_management: {
        Row: {
          auction_id: string | null
          auction_lot: string | null
          breed_id: string | null
          category_id: string | null
          code: number
          created_at: string
          dam_id: string | null
          expected_birth_month: string | null
          farm_id: string | null
          farm_type: string | null
          id: string
          name: string
          recipient_id: string | null
          sex: string
          sire_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          auction_id?: string | null
          auction_lot?: string | null
          breed_id?: string | null
          category_id?: string | null
          code: number
          created_at?: string
          dam_id?: string | null
          expected_birth_month?: string | null
          farm_id?: string | null
          farm_type?: string | null
          id?: string
          name: string
          recipient_id?: string | null
          sex: string
          sire_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          auction_id?: string | null
          auction_lot?: string | null
          breed_id?: string | null
          category_id?: string | null
          code?: number
          created_at?: string
          dam_id?: string | null
          expected_birth_month?: string | null
          farm_id?: string | null
          farm_type?: string | null
          id?: string
          name?: string
          recipient_id?: string | null
          sex?: string
          sire_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancy_management_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "leiloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancy_management_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "animal_breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancy_management_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "animal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancy_management_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "breeding_animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancy_management_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancy_management_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "breeding_animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancy_management_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_supplier_codes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          supplier_code: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          supplier_code: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          supplier_code?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          code: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          function_type: string | null
          group_id: string | null
          id: string
          is_active: boolean
          is_blocked: boolean
          name: string
          product_type: string | null
          subgroup_id: string | null
          unit_id: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          code?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          function_type?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          name: string
          product_type?: string | null
          subgroup_id?: string | null
          unit_id?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          code?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          function_type?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          name?: string
          product_type?: string | null
          subgroup_id?: string | null
          unit_id?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_permissions: {
        Row: {
          created_at: string
          id: string
          module: string
          permission: Database["public"]["Enums"]["permission_type"]
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          permission: Database["public"]["Enums"]["permission_type"]
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          profile_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          name: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_control: {
        Row: {
          created_at: string
          created_by: string
          id: string
          month: number
          notes: string | null
          store_id: string
          total_value: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          month: number
          notes?: string | null
          store_id: string
          total_value?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          month?: number
          notes?: string | null
          store_id?: string
          total_value?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      stock_control_items: {
        Row: {
          category: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          stock_control_id: string
          total_cost: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          stock_control_id: string
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          stock_control_id?: string
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          cnpj: string | null
          code: string
          created_at: string
          id: string
          manager_name: string | null
          name: string
          opening_date: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          code: string
          created_at?: string
          id?: string
          manager_name?: string | null
          name: string
          opening_date?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          code?: string
          created_at?: string
          id?: string
          manager_name?: string | null
          name?: string
          opening_date?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          cnpj_cpf: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_suppliers_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      system_parameters: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          parameter_key: string
          product_id: string | null
          subgroup_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          parameter_key: string
          product_id?: string | null
          subgroup_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          parameter_key?: string
          product_id?: string | null
          subgroup_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_parameters_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_parameters_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_parameters_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_farms: {
        Row: {
          city: string | null
          code: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          owner: string | null
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          owner?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          owner?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_farms_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          destination_account_id: string
          destination_account_type: string
          id: string
          source_account_id: string
          source_account_type: string
          store_id: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          description?: string | null
          destination_account_id: string
          destination_account_type: string
          id?: string
          source_account_id: string
          source_account_type: string
          store_id: string
          transfer_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          destination_account_id?: string
          destination_account_type?: string
          id?: string
          source_account_id?: string
          source_account_type?: string
          store_id?: string
          transfer_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      units_of_measure: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          module: string
          permission: Database["public"]["Enums"]["permission_type"]
          store_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          permission: Database["public"]["Enums"]["permission_type"]
          store_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_stores_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_stores_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weighing_records: {
        Row: {
          animal_id: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weighing_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighing_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "weighing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      weighing_sessions: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          observations: string | null
          store_id: string
          updated_at: string
          weighing_type: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by: string
          date: string
          id?: string
          observations?: string | null
          store_id: string
          updated_at?: string
          weighing_type: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          observations?: string | null
          store_id?: string
          updated_at?: string
          weighing_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "weighing_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "animal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighing_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighing_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_animal_batch_code: {
        Args: { store_uuid: string }
        Returns: number
      }
      get_next_animal_breed_code: {
        Args: { store_uuid: string }
        Returns: number
      }
      get_next_animal_category_code: {
        Args: { store_uuid: string }
        Returns: number
      }
      get_next_animal_code: { Args: { store_uuid: string }; Returns: number }
      get_next_job_function_code: {
        Args: { store_uuid: string }
        Returns: number
      }
      get_next_leilao_code: { Args: { store_uuid: string }; Returns: number }
      get_next_product_code: { Args: never; Returns: number }
      get_next_third_party_farm_code:
        | { Args: never; Returns: number }
        | { Args: { store_uuid: string }; Returns: number }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_store_id: { Args: never; Returns: string }
      user_has_permission: {
        Args: {
          module_name: string
          required_permission: Database["public"]["Enums"]["permission_type"]
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "receita" | "despesa" | "ativo" | "passivo"
      block_type: "competencia" | "pagamento"
      permission_type: "read" | "write" | "admin"
      transaction_type: "entrada" | "saida"
      user_role: "admin" | "manager" | "operator" | "viewer"
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
      account_type: ["receita", "despesa", "ativo", "passivo"],
      block_type: ["competencia", "pagamento"],
      permission_type: ["read", "write", "admin"],
      transaction_type: ["entrada", "saida"],
      user_role: ["admin", "manager", "operator", "viewer"],
    },
  },
} as const
