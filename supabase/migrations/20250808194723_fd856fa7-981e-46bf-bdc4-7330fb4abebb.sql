-- Create junction table for user-store relationships
CREATE TABLE public.user_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  store_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- Enable RLS
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;

-- Create policies for user_stores
CREATE POLICY "Admins can manage user stores" 
ON public.user_stores 
FOR ALL 
USING (get_user_role() = 'admin'::user_role);

CREATE POLICY "Users can view their own store access" 
ON public.user_stores 
FOR SELECT 
USING (user_id = auth.uid());

-- Add foreign key constraints
ALTER TABLE public.user_stores 
ADD CONSTRAINT fk_user_stores_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_stores 
ADD CONSTRAINT fk_user_stores_store_id 
FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;