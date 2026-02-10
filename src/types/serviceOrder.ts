export interface ServiceOrder {
  id: string;
  store_id: string;
  os_date: string;
  registration_date: string;
  os_number: string;
  nf_number: string | null;
  supplier_id: string | null;
  description: string;
  value: number | null;
  status: string;
  attachments: any[];
  created_by: string;
  created_at?: string;
  updated_by?: string | null;
  updated_at?: string | null;
  stores?: { name: string; code: string };
  suppliers?: { name: string } | null;
}

export interface Store {
  id: string;
  name: string;
  code: string;
}

export interface Supplier {
  id: string;
  name: string;
}
