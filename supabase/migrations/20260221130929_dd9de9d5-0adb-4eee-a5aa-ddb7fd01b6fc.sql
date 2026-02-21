
-- Remove the unique constraint that prevents multiple subgroups per parameter_key + matrix_id
ALTER TABLE public.system_parameters DROP CONSTRAINT IF EXISTS system_parameters_parameter_key_matrix_id_key;
