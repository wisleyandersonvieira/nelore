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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
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
      accounts_receivable: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string
          creditor_id: string | null
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
          account_id: string
          amount: number
          created_at?: string
          created_by: string
          creditor_id?: string | null
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
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string
          creditor_id?: string | null
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
      cash_control: {
        Row: {
          closing_balance: number
          created_at: string
          created_by: string
          date: string
          id: string
          image_urls: string[] | null
          notes: string | null
          opening_balance: number
          store_id: string
          total_expenses: number
          total_sales: number
          updated_at: string
        }
        Insert: {
          closing_balance?: number
          created_at?: string
          created_by: string
          date: string
          id?: string
          image_urls?: string[] | null
          notes?: string | null
          opening_balance?: number
          store_id: string
          total_expenses?: number
          total_sales?: number
          updated_at?: string
        }
        Update: {
          closing_balance?: number
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          image_urls?: string[] | null
          notes?: string | null
          opening_balance?: number
          store_id?: string
          total_expenses?: number
          total_sales?: number
          updated_at?: string
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
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "current_accounts"
            referencedColumns: ["id"]
          },
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
          group_id: string | null
          id: string
          is_active: boolean
          is_blocked: boolean
          name: string
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
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          name: string
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
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          name?: string
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
          id: string
          parameter_key: string
          product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          parameter_key: string
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          parameter_key?: string
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_parameters_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_product_code: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_store_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
      permission_type: ["read", "write", "admin"],
      transaction_type: ["entrada", "saida"],
      user_role: ["admin", "manager", "operator", "viewer"],
    },
  },
} as const
