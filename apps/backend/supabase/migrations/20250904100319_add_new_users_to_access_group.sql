-- insert default access group if not exists
INSERT INTO
    public.access_groups (name)
VALUES
    ('Alle')
ON CONFLICT (name) DO NOTHING;

-- ensure a unique constraint exists for (user_id, access_group_id)
ALTER TABLE public.access_group_members
DROP CONSTRAINT if EXISTS access_group_members_user_access_group_key;

ALTER TABLE public.access_group_members
ADD CONSTRAINT access_group_members_user_access_group_key UNIQUE (user_id, access_group_id);

-- add all current users to the default access group
INSERT INTO
    public.access_group_members (user_id, access_group_id)
SELECT
    p.id,
    ag.id
FROM
    public.profiles p,
    public.access_groups ag
WHERE
    ag.name = 'Alle'
ON CONFLICT (user_id, access_group_id) DO NOTHING;

CREATE OR REPLACE FUNCTION add_user_to_access_group () returns trigger language plpgsql security definer
SET
    search_path = '' AS $$
BEGIN
    -- insert default access group in case it was deleted somehow beforehand
    INSERT INTO
        public.access_groups (name)
    VALUES
        ('Alle')
    ON CONFLICT (name) DO NOTHING;
    -- add new user to default access group
    INSERT INTO public.access_group_members (user_id, access_group_id)
    SELECT NEW.id, ag.id
    FROM public.access_groups ag
    WHERE ag.name = 'Alle'
    LIMIT 1
    ON CONFLICT (user_id, access_group_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER add_new_user_to_access_group_trigger
AFTER insert ON public.profiles FOR each ROW
EXECUTE function add_user_to_access_group ();
