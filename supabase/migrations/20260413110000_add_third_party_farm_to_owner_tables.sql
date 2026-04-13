ALTER TABLE public.animal_owners
  ADD COLUMN IF NOT EXISTS third_party_farm_id UUID REFERENCES public.third_party_farms(id) ON DELETE CASCADE;

ALTER TABLE public.pregnancy_owners
  ADD COLUMN IF NOT EXISTS third_party_farm_id UUID REFERENCES public.third_party_farms(id) ON DELETE CASCADE;

ALTER TABLE public.aspiration_owners
  ADD COLUMN IF NOT EXISTS third_party_farm_id UUID REFERENCES public.third_party_farms(id) ON DELETE CASCADE;

ALTER TABLE public.embryo_transfer_owners
  ADD COLUMN IF NOT EXISTS third_party_farm_id UUID REFERENCES public.third_party_farms(id) ON DELETE CASCADE;
