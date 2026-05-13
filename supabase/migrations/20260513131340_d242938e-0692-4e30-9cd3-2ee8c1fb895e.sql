
UPDATE auth.users
SET encrypted_password = crypt('KadenceQA2026!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'qa-admin@kadence.test';

UPDATE auth.users
SET encrypted_password = crypt('TestStaff2026!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'weavebusiness20@gmail.com';
