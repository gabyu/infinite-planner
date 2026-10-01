-- One-time setup, per environment (staging and production are separate projects).
-- The admin dashboard can only create admins from an existing admin, so the very first
-- one is created by hand:
--
-- 1. Supabase dashboard -> Authentication -> Users -> "Add user" -> "Create new user".
--    Enter the email and a strong password, and tick "Auto Confirm User".
-- 2. Run the statement below in the SQL Editor, with that email.
-- 3. Sign in at /admin-dashboard/login.
--
-- must_change_password stays false for this account: you chose the password yourself.
INSERT INTO public.profiles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'you@example.com'; -- <- your email
