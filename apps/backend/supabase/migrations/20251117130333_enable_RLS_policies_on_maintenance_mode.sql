ALTER TABLE public.maintenance_mode enable ROW level security;

REVOKE insert,
UPDATE,
delete ON public.maintenance_mode
FROM
    anon,
    authenticated;
