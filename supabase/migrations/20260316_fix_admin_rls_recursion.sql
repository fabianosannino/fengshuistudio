-- ============================================================
-- FIX: Admin RLS policy infinite recursion on profiles table
--
-- The old "Admin lê todos os perfis" policy queried profiles
-- within its own USING clause, causing recursive RLS evaluation
-- and 500 errors on every profiles query.
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS
-- for the admin check.
-- ============================================================

-- Step 1: Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Replace the recursive policy
DROP POLICY IF EXISTS "Admin lê todos os perfis" ON profiles;
CREATE POLICY "Admin lê todos os perfis"
  ON profiles FOR SELECT
  USING (public.is_admin());
