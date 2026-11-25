-- ============================================================================
-- PINJAMKUY PRODUCTION DATABASE SCHEMA FOR SUPABASE (POSTGRESQL)
-- Salin seluruh isi file ini ke Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Terhubung 1-ke-1 dengan auth.users Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'renter' CHECK (role IN ('renter', 'owner', 'admin')),
  avatar_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Jakarta Selatan',
  bio TEXT DEFAULT '',
  ktp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  response_rate TEXT NOT NULL DEFAULT 'Baru bergabung',
  joined_at TEXT NOT NULL DEFAULT 'Baru bergabung',
  lat DOUBLE PRECISION NOT NULL DEFAULT -6.2607,
  lng DOUBLE PRECISION NOT NULL DEFAULT 106.8135,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Items Table (Barang yang disewakan)
CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  price_per_day INTEGER NOT NULL CHECK (price_per_day > 0),
  stock INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 1),
  deposit_amount INTEGER NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  description TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'Sangat Baik & Siap Pakai',
  completeness JSONB NOT NULL DEFAULT '[]'::jsonb,
  specs JSONB NOT NULL DEFAULT '[]'::jsonb,
  rental_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  images TEXT[] NOT NULL DEFAULT '{}',
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  address_hint TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL DEFAULT -6.2607,
  lng DOUBLE PRECISION NOT NULL DEFAULT 106.8135,
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  rented_count INTEGER NOT NULL DEFAULT 0,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Favorites Table (Simpan Favorit)
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- 5. Rentals Table (Pengajuan & Riwayat Sewa)
CREATE TABLE IF NOT EXISTS public.rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  item_title TEXT NOT NULL,
  item_image TEXT NOT NULL DEFAULT '',
  renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  renter_name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL CHECK (total_days >= 1),
  price_per_day INTEGER NOT NULL CHECK (price_per_day > 0),
  protection_fee INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Reviews Table (Ulasan + Bintang + Foto)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_avatar TEXT DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  photos TEXT[] NOT NULL DEFAULT '{}',
  variant_info TEXT DEFAULT 'Penyewa Terverifikasi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Conversations Table (Ruang Percakapan)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids UUID[] NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_title TEXT,
  item_image TEXT,
  item_price INTEGER,
  last_message TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Messages Table (Chatting Penyewa & Pemilik Barang)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Notifications Table (Notifikasi Real-time)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('chat', 'rental_request', 'rental_status', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_view TEXT NOT NULL DEFAULT 'notifications',
  target_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Helper Functions & Triggers
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_avatar TEXT;
BEGIN
  v_role := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'role', '') = 'owner' THEN 'owner'
    ELSE 'renter'
  END;

  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'pengguna'), '@', 1)
  );

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  INSERT INTO public.profiles (
    id, email, full_name, role, avatar_url, email_verified, joined_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    v_role,
    v_avatar,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE),
    TO_CHAR(NOW(), 'FMMonth YYYY')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = GREATEST(public.profiles.email_verified, EXCLUDED.email_verified),
    avatar_url = CASE
      WHEN public.profiles.avatar_url = '' THEN EXCLUDED.avatar_url
      ELSE public.profiles.avatar_url
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.items
  SET
    review_count = (SELECT COUNT(*) FROM public.reviews WHERE item_id = NEW.item_id),
    rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE item_id = NEW.item_id),
      5.0
    )
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_review();

CREATE OR REPLACE FUNCTION public.handle_rental_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.items
    SET rented_count = rented_count + NEW.quantity
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rental_completed ON public.rentals;
CREATE TRIGGER on_rental_completed
  AFTER UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.handle_rental_completed();

-- 11. Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role IN ('renter', 'owner') AND ktp_verified = FALSE);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role IN ('renter', 'owner')
      AND ktp_verified = (SELECT p.ktp_verified FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- Items
DROP POLICY IF EXISTS "Approved items are viewable by everyone" ON public.items;
CREATE POLICY "Approved items are viewable by everyone"
  ON public.items FOR SELECT
  USING (is_approved = TRUE OR auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners can insert own items" ON public.items;
CREATE POLICY "Owners can insert own items"
  ON public.items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners and admins can update items" ON public.items;
CREATE POLICY "Owners and admins can update items"
  ON public.items FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners and admins can delete items" ON public.items;
CREATE POLICY "Owners and admins can delete items"
  ON public.items FOR DELETE
  USING (auth.uid() = owner_id OR public.is_admin());

-- Favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites"
  ON public.favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Rentals
DROP POLICY IF EXISTS "Users can view own rentals" ON public.rentals;
CREATE POLICY "Users can view own rentals"
  ON public.rentals FOR SELECT
  USING (auth.uid() = renter_id OR auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can create rentals" ON public.rentals;
CREATE POLICY "Users can create rentals"
  ON public.rentals FOR INSERT
  WITH CHECK (auth.uid() = renter_id AND status = 'pending');

DROP POLICY IF EXISTS "Renters owners and admins can update rentals" ON public.rentals;
CREATE POLICY "Renters owners and admins can update rentals"
  ON public.rentals FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = renter_id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (auth.uid() = owner_id AND status IN ('approved', 'rejected', 'completed'))
    OR (auth.uid() = renter_id AND status = 'cancelled')
  );

-- Reviews
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;
CREATE POLICY "Authenticated users can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Conversations
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = ANY(participant_ids));

DROP POLICY IF EXISTS "Participants can create conversations" ON public.conversations;
CREATE POLICY "Participants can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = ANY(participant_ids) AND array_length(participant_ids, 1) = 2);

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = ANY(participant_ids));

-- Messages
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND auth.uid() = ANY(c.participant_ids)
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND auth.uid() = ANY(c.participant_ids)
    )
  );

DROP POLICY IF EXISTS "Participants can mark messages read" ON public.messages;
CREATE POLICY "Participants can mark messages read"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND auth.uid() = ANY(c.participant_ids)
    )
  );

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;
CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 12. Storage Bucket for Photos (Avatars, Items, Reviews, Chat)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pinjamkuy-media', 'pinjamkuy-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public media read access" ON storage.objects;
CREATE POLICY "Public media read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pinjamkuy-media');

DROP POLICY IF EXISTS "Authenticated media upload access" ON storage.objects;
CREATE POLICY "Authenticated media upload access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pinjamkuy-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
CREATE POLICY "Users can delete own media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pinjamkuy-media' AND auth.uid() = owner);

-- 13. Enable Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rentals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
