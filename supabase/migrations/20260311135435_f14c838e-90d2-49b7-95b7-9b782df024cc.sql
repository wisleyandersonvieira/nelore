
-- Adicionar proprietário do tipo STORE (Fazenda Própria) para o animal ficar ATIVO
INSERT INTO animal_owners (
  animal_id,
  owner_id,
  owner_type,
  store_owner_id,
  percentage,
  created_by
)
VALUES (
  '0c4942b1-57ec-4822-a1dc-9b6615ca214d',
  NULL,
  'store',
  '1ab3c49a-88c8-4d12-80e9-36c2deea9964', -- store_id do animal
  100,
  NULL
);
