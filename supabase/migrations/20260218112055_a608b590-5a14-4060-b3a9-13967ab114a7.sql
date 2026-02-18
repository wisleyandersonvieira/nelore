-- Add embryo_transfer_id to pregnancy_management to link back to Pós TE
ALTER TABLE public.pregnancy_management 
ADD COLUMN embryo_transfer_id UUID REFERENCES public.embryo_transfer_management(id);

-- Create index for performance
CREATE INDEX idx_pregnancy_management_embryo_transfer_id ON public.pregnancy_management(embryo_transfer_id);