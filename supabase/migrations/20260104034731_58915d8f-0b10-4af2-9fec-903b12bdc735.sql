-- Add farm fields to animals table
ALTER TABLE public.animals 
ADD COLUMN farm_id UUID,
ADD COLUMN farm_type TEXT;

-- farm_type can be 'own' for stores or 'third_party' for third_party_farms
-- farm_id references the id from the respective table based on farm_type

COMMENT ON COLUMN public.animals.farm_id IS 'ID of the farm (stores or third_party_farms based on farm_type)';
COMMENT ON COLUMN public.animals.farm_type IS 'Type of farm: own (from stores) or third_party (from third_party_farms)';