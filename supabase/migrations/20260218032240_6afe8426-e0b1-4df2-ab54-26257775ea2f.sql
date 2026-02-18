
-- Add aspiration_id column to embryo_transfer_management to link back to source aspiration
ALTER TABLE public.embryo_transfer_management 
ADD COLUMN aspiration_id uuid REFERENCES public.aspiration_management(id);

-- Create index for performance
CREATE INDEX idx_embryo_transfer_aspiration_id ON public.embryo_transfer_management(aspiration_id);
