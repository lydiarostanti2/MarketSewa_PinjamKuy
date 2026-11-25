import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  INITIAL_CONVERSATIONS,
  INITIAL_ITEMS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
  INITIAL_RENTALS,
  INITIAL_REVIEWS,
  INITIAL_USERS,
  IMAGES,
} from '../data/seedData';
import {
  AppNotification,
  AppView,
  ChatConversation,
  ChatMessage,
  FooterPageId,
  ProductItem,
  ProductReview,
  RentalOrder,
  RentalStatus,
  User,
} from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  ensureSupabaseProfile,
  fetchPublicCatalogData,
  fetchUserScopedData,
  mapConversationRow,
  mapItemRow,
  mapMessageRow,
  mapNotificationRow,
  mapProfileRow,
  mapRentalRow,
  mapReviewRow,
  uploadMediaFile,
} from '../lib/supabaseDb';

interface AppContextValue {
  isSupabaseMode: boolean;
  isLoadingData: boolean;
  view: AppView;
  selectedItemId: string;
  activeChatId: string;
  footerPage: FooterPageId;
  currentUser: User | null;
  users: User[];
  items: ProductItem[];
  reviews: ProductReview[];
  favorites: string[];
  rentals: RentalOrder[];
  conversations: ChatConversation[];
  messages: ChatMessage[];
  notifications: AppNotification[];
  toastMessage: string | null;
  userCoords: { lat: number; lng: number } | null;
  setUserCoords: (coords: { lat: number; lng: number }) => void;
  showToast: (msg: string) => void;
  navigateTo: (
    view: AppView,
    options?: { itemId?: string; chatId?: string; footerPage?: FooterPageId }
  ) => void;
  uploadMedia: (
    file: File,
    folder: 'avatars' | 'items' | 'reviews' | 'chat'
  ) => Promise<string>;
  loginWithEmail: (
    email: string,
    password?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  registerAccount: (data: {
    name: string;
    email: string;
    password: string;
    role: 'renter' | 'owner';
  }) => Promise<{ ok: boolean; needsEmailConfirmation?: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  toggleFavorite: (itemId: string) => Promise<void>;
  submitRental: (payload: {
    item: ProductItem;
    quantity: number;
    startDate: string;
    endDate: string;
    totalDays: number;
    totalPrice: number;
    protectionFee: number;
    notes: string;
  }) => Promise<boolean>;
  updateRentalStatus: (rentalId: string, status: RentalStatus) => Promise<void>;
  addReview: (payload: {
    itemId: string;
    rating: number;
    comment: string;
    photos: string[];
  }) => Promise<void>;
  addItem: (
    newItem: Omit<
      ProductItem,
      | 'id'
      | 'ownerId'
      | 'rating'
      | 'reviewCount'
      | 'rentedCount'
      | 'isApproved'
      | 'createdAt'
    >
  ) => Promise<void>;
  updateItemStock: (itemId: string, stock: number) => Promise<void>;
  toggleItemApproval: (itemId: string) => Promise<void>;
  verifyUserKtp: (userId: string) => Promise<void>;
  openChatWithOwner: (ownerId: string, item?: ProductItem) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    imageUrl?: string
  ) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const STORAGE_KEY = 'pinjamkuy_state_v1';

interface PersistedState {
  currentUserId: string | null;
  users: User[];
  items: ProductItem[];
  reviews: ProductReview[];
  favorites: string[];
  rentals: RentalOrder[];
  conversations: ChatConversation[];
  messages: ChatMessage[];
  notifications: AppNotification[];
}

function loadLocalFallback(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted local storage
  }
  return {
    currentUserId: 'user-renter-1',
    users: INITIAL_USERS,
    items: INITIAL_ITEMS,
    reviews: INITIAL_REVIEWS,
    favorites: ['item-sony-a7iii', 'item-projector-cinema'],
    rentals: INITIAL_RENTALS,
    conversations: INITIAL_CONVERSATIONS,
    messages: INITIAL_MESSAGES,
    notifications: INITIAL_NOTIFICATIONS,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialLocal = !isSupabaseConfigured ? loadLocalFallback() : null;

  const [isLoadingData, setIsLoadingData] = useState<boolean>(isSupabaseConfigured);
  const [view, setView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('item')) return 'product-detail';
    return 'home';
  });
  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('item') || initialLocal?.items[0]?.id || '';
  });
  const [activeChatId, setActiveChatId] = useState<string>(
    initialLocal?.conversations[0]?.id || ''
  );
  const [footerPage, setFooterPage] = useState<FooterPageId>('about');

  const [users, setUsers] = useState<User[]>(initialLocal?.users || []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    initialLocal?.currentUserId ?? null
  );
  const [items, setItems] = useState<ProductItem[]>(initialLocal?.items || []);
  const [reviews, setReviews] = useState<ProductReview[]>(initialLocal?.reviews || []);
  const [favorites, setFavorites] = useState<string[]>(initialLocal?.favorites || []);
  const [rentals, setRentals] = useState<RentalOrder[]>(initialLocal?.rentals || []);
  const [conversations, setConversations] = useState<ChatConversation[]>(
    initialLocal?.conversations || []
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialLocal?.messages || []);
  const [notifications, setNotifications] = useState<AppNotification[]>(
    initialLocal?.notifications || []
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const currentUserIdRef = useRef<string | null>(currentUserId);
  currentUserIdRef.current = currentUserId;

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  // Persist local fallback state ONLY when Supabase is not configured
  useEffect(() => {
    if (isSupabaseConfigured) return;
    const stateToSave: PersistedState = {
      currentUserId,
      users,
      items,
      reviews,
      favorites,
      rentals,
      conversations,
      messages,
      notifications,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // ignore storage quota errors
    }
  }, [
    currentUserId,
    users,
    items,
    reviews,
    favorites,
    rentals,
    conversations,
    messages,
    notifications,
  ]);

  // Load Supabase public catalog, auth session, user-scoped data & realtime
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setIsLoadingData(false);
      return;
    }

    let cancelled = false;

    const loadUserSessionData = async (userId: string) => {
      const scoped = await fetchUserScopedData(userId);
      if (cancelled) return;
      setFavorites(scoped.favorites);
      setRentals(scoped.rentals);
      setConversations(scoped.conversations);
      setMessages(scoped.messages);
      setNotifications(scoped.notifications);
      if (scoped.conversations.length > 0) {
        setActiveChatId((prev) => prev || scoped.conversations[0].id);
      }
    };

    const bootstrapSupabase = async () => {
      setIsLoadingData(true);
      try {
        const [publicData, sessionRes] = await Promise.all([
          fetchPublicCatalogData(),
          client.auth.getSession(),
        ]);
        if (cancelled) return;

        setUsers(publicData.users);
        setItems(publicData.items);
        setReviews(publicData.reviews);
        if (publicData.items.length > 0) {
          setSelectedItemId((prev) => prev || publicData.items[0].id);
        }

        const authUser = sessionRes.data.session?.user;
        if (authUser) {
          const profile = await ensureSupabaseProfile(authUser);
          if (!cancelled && profile) {
            setUsers((prev) =>
              prev.some((u) => u.id === profile.id)
                ? prev.map((u) => (u.id === profile.id ? profile : u))
                : [...prev, profile]
            );
            setCurrentUserId(profile.id);
            await loadUserSessionData(profile.id);
          }
        }
      } catch (err) {
        console.error('Supabase bootstrap error:', err);
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    };

    void bootstrapSupabase();

    const { data: authListener } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;
        const authUser = session?.user;
        if (authUser) {
          const profile = await ensureSupabaseProfile(authUser);
          if (!cancelled && profile) {
            setUsers((prev) =>
              prev.some((u) => u.id === profile.id)
                ? prev.map((u) => (u.id === profile.id ? profile : u))
                : [...prev, profile]
            );
            setCurrentUserId(profile.id);
            await loadUserSessionData(profile.id);
            if (event === 'SIGNED_IN') {
              setView((prevView) => (prevView === 'auth' ? 'home' : prevView));
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUserId(null);
          setFavorites([]);
          setRentals([]);
          setConversations([]);
          setMessages([]);
          setNotifications([]);
        }
      }
    );

    const channel = client
      .channel('pinjamkuy-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const mapped = mapItemRow(payload.new as Record<string, unknown>);
            setItems((prev) =>
              prev.some((it) => it.id === mapped.id) ? prev : [mapped, ...prev]
            );
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const mapped = mapItemRow(payload.new as Record<string, unknown>);
            setItems((prev) =>
              prev.map((it) => (it.id === mapped.id ? mapped : it))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const oldId = String((payload.old as Record<string, unknown>).id || '');
            setItems((prev) => prev.filter((it) => it.id !== oldId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rentals' },
        (payload) => {
          const uid = currentUserIdRef.current;
          if (!uid || !payload.new) return;
          const mapped = mapRentalRow(payload.new as Record<string, unknown>);
          if (mapped.renterId !== uid && mapped.ownerId !== uid) return;
          setRentals((prev) =>
            prev.some((r) => r.id === mapped.id)
              ? prev.map((r) => (r.id === mapped.id ? mapped : r))
              : [mapped, ...prev]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          const uid = currentUserIdRef.current;
          if (!uid || !payload.new) return;
          const mapped = mapConversationRow(payload.new as Record<string, unknown>);
          if (!mapped.participantIds.includes(uid)) return;
          setConversations((prev) =>
            prev.some((c) => c.id === mapped.id)
              ? prev.map((c) => (c.id === mapped.id ? mapped : c))
              : [mapped, ...prev]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (!payload.new) return;
          const mapped = mapMessageRow(payload.new as Record<string, unknown>);
          if (payload.eventType === 'INSERT') {
            setMessages((prev) =>
              prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]
            );
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => (m.id === mapped.id ? mapped : m))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const uid = currentUserIdRef.current;
          if (!uid || !payload.new) return;
          const mapped = mapNotificationRow(payload.new as Record<string, unknown>);
          if (mapped.userId !== uid) return;
          setNotifications((prev) =>
            prev.some((n) => n.id === mapped.id)
              ? prev.map((n) => (n.id === mapped.id ? mapped : n))
              : [mapped, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const navigateTo = (
    nextView: AppView,
    options?: { itemId?: string; chatId?: string; footerPage?: FooterPageId }
  ) => {
    if (options?.itemId) {
      setSelectedItemId(options.itemId);
      const url = new URL(window.location.href);
      url.searchParams.set('item', options.itemId);
      window.history.replaceState({}, '', url.toString());
    } else if (nextView !== 'product-detail') {
      const url = new URL(window.location.href);
      url.searchParams.delete('item');
      window.history.replaceState({}, '', url.toString());
    }
    if (options?.chatId) setActiveChatId(options.chatId);
    if (options?.footerPage) setFooterPage(options.footerPage);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadMedia = async (
    file: File,
    folder: 'avatars' | 'items' | 'reviews' | 'chat'
  ): Promise<string> => {
    return uploadMediaFile(file, folder, currentUser?.id);
  };

  const loginWithEmail = async (
    email: string,
    password?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      if (!password) {
        return { ok: false, error: 'Kata sandi wajib diisi.' };
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        return {
          ok: false,
          error:
            error.message === 'Invalid login credentials'
              ? 'Email atau kata sandi tidak sesuai.'
              : error.message,
        };
      }
      if (data.user) {
        const profile = await ensureSupabaseProfile(data.user);
        if (profile) {
          setUsers((prev) =>
            prev.some((u) => u.id === profile.id)
              ? prev.map((u) => (u.id === profile.id ? profile : u))
              : [...prev, profile]
          );
          setCurrentUserId(profile.id);
          showToast(`Selamat datang kembali, ${profile.name}!`);
        }
        navigateTo('home');
      }
      return { ok: true };
    }

    const found = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (found) {
      setCurrentUserId(found.id);
      showToast(`Selamat datang kembali, ${found.name}!`);
      navigateTo('home');
      return { ok: true };
    }
    const localName = email.split('@')[0].replace(/[._]/g, ' ');
    const formattedName = localName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: formattedName || 'Pengguna PinjamKuy',
      email: email.trim().toLowerCase(),
      role: 'renter',
      avatar: IMAGES.avatarRaka,
      phone: '0812-0000-0000',
      city: 'Jakarta Selatan',
      bio: 'Anggota baru PinjamKuy.',
      ktpVerified: false,
      emailVerified: true,
      rating: 5.0,
      responseRate: 'Baru bergabung',
      joinedAt: 'November 2026',
      lat: -6.2442,
      lng: 106.7995,
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    showToast(`Berhasil masuk dengan akun ${newUser.email}`);
    navigateTo('home');
    return { ok: true };
  };

  const loginWithGoogle = async (): Promise<{ ok: boolean; error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) {
        return {
          ok: false,
          error: `Gagal memulai login Google Supabase: ${error.message}`,
        };
      }
      return { ok: true };
    }

    return {
      ok: false,
      error:
        'Konfigurasi Supabase (.env) belum diisi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY untuk mengaktifkan Login Google Supabase.',
    };
  };

  const registerAccount = async (data: {
    name: string;
    email: string;
    password: string;
    role: 'renter' | 'owner';
  }): Promise<{ ok: boolean; needsEmailConfirmation?: boolean; error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        options: {
          data: {
            full_name: data.name.trim(),
            role: data.role,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (signUpData.session && signUpData.user) {
        const profile = await ensureSupabaseProfile(signUpData.user);
        if (profile) {
          setUsers((prev) =>
            prev.some((u) => u.id === profile.id)
              ? prev.map((u) => (u.id === profile.id ? profile : u))
              : [...prev, profile]
          );
          setCurrentUserId(profile.id);
        }
        showToast('Pendaftaran berhasil! Selamat datang di PinjamKuy.');
        navigateTo('home');
        return { ok: true };
      }

      showToast(`Link konfirmasi dikirim ke ${data.email.trim().toLowerCase()}`);
      return { ok: true, needsEmailConfirmation: true };
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      role: data.role,
      avatar: data.role === 'owner' ? IMAGES.avatarNadia : IMAGES.avatarRaka,
      phone: '0812-1122-3344',
      city: 'Jakarta Selatan',
      bio:
        data.role === 'owner'
          ? 'Pemilik barang terverifikasi di PinjamKuy.'
          : 'Penyewa terverifikasi di PinjamKuy.',
      ktpVerified: false,
      emailVerified: true,
      rating: 5.0,
      responseRate: 'Baru bergabung',
      joinedAt: 'November 2026',
      lat: -6.255,
      lng: 106.805,
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    showToast('Pendaftaran akun berhasil!');
    navigateTo('home');
    return { ok: true };
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUserId(null);
    showToast('Anda telah keluar dari akun.');
    navigateTo('auth');
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;

    if (isSupabaseConfigured && supabase) {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.full_name = updates.name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;

      const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', currentUser.id)
        .select('*')
        .single();

      if (error) {
        showToast(`Gagal memperbarui profil: ${error.message}`);
        return;
      }
      if (data) {
        const mapped = mapProfileRow(data);
        setUsers((prev) => prev.map((u) => (u.id === mapped.id ? mapped : u)));
      }
      showToast('Profil berhasil diperbarui di Supabase!');
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, ...updates } : u))
    );
    showToast('Profil berhasil diperbarui!');
  };

  const toggleFavorite = async (itemId: string) => {
    if (!currentUser) {
      showToast('Silakan masuk terlebih dahulu untuk menyimpan favorit.');
      navigateTo('auth');
      return;
    }

    const exists = favorites.includes(itemId);

    if (isSupabaseConfigured && supabase) {
      if (exists) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('item_id', itemId);
        if (error) {
          showToast(`Gagal menghapus favorit: ${error.message}`);
          return;
        }
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: currentUser.id, item_id: itemId });
        if (error) {
          showToast(`Gagal menyimpan favorit: ${error.message}`);
          return;
        }
      }
    }

    setFavorites((prev) => {
      const next = exists ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      showToast(exists ? 'Dihapus dari daftar favorit' : 'Barang disimpan ke favorit!');
      return next;
    });
  };

  const submitRental: AppContextValue['submitRental'] = async ({
    item,
    quantity,
    startDate,
    endDate,
    totalDays,
    totalPrice,
    protectionFee,
    notes,
  }) => {
    if (!currentUser) {
      showToast('Silakan masuk terlebih dahulu untuk mengajukan sewa.');
      navigateTo('auth');
      return false;
    }
    if (quantity < 1 || quantity > item.stock) {
      showToast(`Jumlah sewa maksimal ${item.stock} unit.`);
      return false;
    }

    const owner = users.find((u) => u.id === item.ownerId);
    const ownerName = owner?.name || 'Pemilik Barang';

    if (isSupabaseConfigured && supabase) {
      const { data: insertedRental, error } = await supabase
        .from('rentals')
        .insert({
          item_id: item.id,
          item_title: item.title,
          item_image: item.images[0] || '',
          renter_id: currentUser.id,
          renter_name: currentUser.name,
          owner_id: item.ownerId,
          owner_name: ownerName,
          quantity,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          price_per_day: item.pricePerDay,
          protection_fee: protectionFee,
          total_price: totalPrice,
          status: 'pending',
          notes,
        })
        .select('*')
        .single();

      if (error || !insertedRental) {
        showToast(`Gagal mengirim pengajuan sewa: ${error?.message || 'Unknown error'}`);
        return false;
      }

      const mappedRental = mapRentalRow(insertedRental);
      setRentals((prev) => [mappedRental, ...prev]);

      await supabase.from('notifications').insert([
        {
          user_id: item.ownerId,
          type: 'rental_request',
          title: `Pengajuan Sewa Baru (${quantity} Unit)`,
          body: `${currentUser.name} ingin menyewa ${item.title} selama ${totalDays} hari.`,
          target_view: 'account',
          target_id: mappedRental.id,
        },
        {
          user_id: currentUser.id,
          type: 'rental_status',
          title: 'Pengajuan Sewa Terkirim',
          body: `Permintaan sewa ${item.title} (${quantity} unit) telah dikirim ke ${ownerName}.`,
          target_view: 'account',
          target_id: mappedRental.id,
        },
      ]);

      showToast('Pengajuan sewa berhasil disimpan & dikirim ke pemilik!');
      return true;
    }

    const newRental: RentalOrder = {
      id: `rent-${Date.now()}`,
      itemId: item.id,
      itemTitle: item.title,
      itemImage: item.images[0],
      renterId: currentUser.id,
      renterName: currentUser.name,
      ownerId: item.ownerId,
      ownerName,
      quantity,
      startDate,
      endDate,
      totalDays,
      pricePerDay: item.pricePerDay,
      protectionFee,
      totalPrice,
      status: 'pending',
      notes,
      createdAt: new Date().toISOString(),
    };
    setRentals((prev) => [newRental, ...prev]);
    const nowNotifs: AppNotification[] = [
      {
        id: `notif-owner-${Date.now()}`,
        userId: item.ownerId,
        type: 'rental_request',
        title: `Pengajuan Sewa Baru (${quantity} Unit)`,
        body: `${currentUser.name} ingin menyewa ${item.title} selama ${totalDays} hari.`,
        targetView: 'account',
        targetId: newRental.id,
        isRead: false,
        createdAt: 'Baru saja',
      },
      {
        id: `notif-renter-${Date.now() + 1}`,
        userId: currentUser.id,
        type: 'rental_status',
        title: 'Pengajuan Sewa Terkirim',
        body: `Permintaan sewa ${item.title} (${quantity} unit) telah dikirim ke ${ownerName}.`,
        targetView: 'account',
        targetId: newRental.id,
        isRead: false,
        createdAt: 'Baru saja',
      },
    ];
    setNotifications((prev) => [...nowNotifs, ...prev]);
    showToast('Pengajuan sewa berhasil dikirim ke pemilik barang!');
    return true;
  };

  const updateRentalStatus = async (rentalId: string, status: RentalStatus) => {
    const target = rentals.find((r) => r.id === rentalId);
    if (!target) return;

    const statusLabel =
      status === 'approved'
        ? 'disetujui'
        : status === 'rejected'
        ? 'ditolak'
        : status === 'completed'
        ? 'selesai'
        : 'dibatalkan';

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('rentals')
        .update({ status })
        .eq('id', rentalId);

      if (error) {
        showToast(`Gagal memperbarui status sewa: ${error.message}`);
        return;
      }

      await supabase.from('notifications').insert({
        user_id: target.renterId,
        type: 'rental_status',
        title: `Sewa ${statusLabel.toUpperCase()}`,
        body: `Pengajuan sewa "${target.itemTitle}" telah ${statusLabel} oleh pemilik.`,
        target_view: 'account',
        target_id: rentalId,
      });

      setRentals((prev) =>
        prev.map((r) => (r.id === rentalId ? { ...r, status } : r))
      );
      showToast(`Status pengajuan sewa diperbarui menjadi ${statusLabel}.`);
      return;
    }

    setRentals((prev) =>
      prev.map((r) => (r.id === rentalId ? { ...r, status } : r))
    );
    setNotifications((prev) => [
      {
        id: `notif-status-${Date.now()}`,
        userId: target.renterId,
        type: 'rental_status',
        title: `Sewa ${statusLabel.toUpperCase()}`,
        body: `Pengajuan sewa "${target.itemTitle}" telah ${statusLabel} oleh pemilik.`,
        targetView: 'account',
        targetId: rentalId,
        isRead: false,
        createdAt: 'Baru saja',
      },
      ...prev,
    ]);
    showToast(`Status pengajuan sewa diperbarui menjadi ${statusLabel}.`);
  };

  const addReview: AppContextValue['addReview'] = async ({
    itemId,
    rating,
    comment,
    photos,
  }) => {
    if (!currentUser) {
      showToast('Masuk terlebih dahulu untuk menulis ulasan.');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('reviews')
        .insert({
          item_id: itemId,
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_avatar: currentUser.avatar,
          rating,
          comment,
          photos,
          variant_info: 'Penyewa Terverifikasi',
        })
        .select('*')
        .single();

      if (error || !inserted) {
        showToast(`Gagal mengirim ulasan: ${error?.message || 'Unknown error'}`);
        return;
      }

      const mappedRev = mapReviewRow(inserted);
      setReviews((prev) => [mappedRev, ...prev]);
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const nextCount = it.reviewCount + 1;
          const nextRating =
            Math.round(((it.rating * it.reviewCount + rating) / nextCount) * 10) /
            10;
          return { ...it, reviewCount: nextCount, rating: nextRating };
        })
      );
      showToast('Ulasan dan foto Anda berhasil dipublikasikan!');
      return;
    }

    const newRev: ProductReview = {
      id: `rev-${Date.now()}`,
      itemId,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      rating,
      comment,
      photos,
      variantInfo: 'Penyewa Terverifikasi',
      createdAt: 'Baru saja',
    };
    setReviews((prev) => [newRev, ...prev]);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const nextCount = it.reviewCount + 1;
        const nextRating =
          Math.round(((it.rating * it.reviewCount + rating) / nextCount) * 10) / 10;
        return { ...it, reviewCount: nextCount, rating: nextRating };
      })
    );
    showToast('Ulasan dan foto Anda berhasil dipublikasikan!');
  };

  const addItem: AppContextValue['addItem'] = async (newItem) => {
    if (!currentUser) return;

    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('items')
        .insert({
          owner_id: currentUser.id,
          title: newItem.title,
          category: newItem.category,
          price_per_day: newItem.pricePerDay,
          stock: newItem.stock,
          deposit_amount: newItem.depositAmount,
          description: newItem.description,
          condition: newItem.condition,
          completeness: newItem.completeness,
          specs: newItem.specs,
          rental_terms: newItem.rentalTerms,
          images: newItem.images,
          city: newItem.city,
          district: newItem.district,
          address_hint: newItem.addressHint,
          lat: newItem.lat,
          lng: newItem.lng,
          is_approved: true,
        })
        .select('*')
        .single();

      if (error || !inserted) {
        showToast(`Gagal menambahkan barang: ${error?.message || 'Unknown error'}`);
        return;
      }

      const mapped = mapItemRow(inserted);
      setItems((prev) =>
        prev.some((it) => it.id === mapped.id) ? prev : [mapped, ...prev]
      );
      showToast('Barang baru berhasil disimpan ke katalog Supabase!');
      return;
    }

    const item: ProductItem = {
      ...newItem,
      id: `item-${Date.now()}`,
      ownerId: currentUser.id,
      rating: 5.0,
      reviewCount: 0,
      rentedCount: 0,
      isApproved: true,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setItems((prev) => [item, ...prev]);
    showToast('Barang baru berhasil ditambahkan ke katalog PinjamKuy!');
  };

  const updateItemStock = async (itemId: string, stock: number) => {
    const safeStock = Math.max(1, stock);
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('items')
        .update({ stock: safeStock })
        .eq('id', itemId);
      if (error) {
        showToast(`Gagal memperbarui stok: ${error.message}`);
        return;
      }
    }
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, stock: safeStock } : it))
    );
    showToast('Stok unit barang diperbarui.');
  };

  const toggleItemApproval = async (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    if (!target) return;
    const nextApproved = !target.isApproved;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('items')
        .update({ is_approved: nextApproved })
        .eq('id', itemId);
      if (error) {
        showToast(`Gagal memperbarui moderasi barang: ${error.message}`);
        return;
      }
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, isApproved: nextApproved } : it
      )
    );
    showToast('Status moderasi barang diperbarui.');
  };

  const verifyUserKtp = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const nextVerified = !target.ktpVerified;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ ktp_verified: nextVerified })
        .eq('id', userId);
      if (error) {
        showToast(`Gagal memperbarui verifikasi KTP: ${error.message}`);
        return;
      }
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, ktpVerified: nextVerified } : u
      )
    );
    showToast('Status verifikasi KTP pengguna diperbarui.');
  };

  const openChatWithOwner = async (ownerId: string, item?: ProductItem) => {
    if (!currentUser) {
      showToast('Silakan masuk terlebih dahulu untuk mengirim pesan ke pemilik.');
      navigateTo('auth');
      return;
    }
    if (ownerId === currentUser.id) {
      navigateTo('chat');
      return;
    }

    const existing = conversations.find(
      (c) =>
        c.participantIds.includes(currentUser.id) &&
        c.participantIds.includes(ownerId) &&
        (!item || c.itemId === item.id)
    );
    if (existing) {
      navigateTo('chat', { chatId: existing.id });
      return;
    }

    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('conversations')
        .insert({
          participant_ids: [currentUser.id, ownerId],
          item_id: item?.id || null,
          item_title: item?.title || null,
          item_image: item?.images[0] || null,
          item_price: item?.pricePerDay || null,
          last_message: item
            ? `Menanyakan tentang ${item.title}`
            : 'Memulai percakapan',
        })
        .select('*')
        .single();

      if (error || !inserted) {
        showToast(`Gagal membuka percakapan: ${error?.message || 'Unknown error'}`);
        return;
      }

      const mapped = mapConversationRow(inserted);
      setConversations((prev) =>
        prev.some((c) => c.id === mapped.id) ? prev : [mapped, ...prev]
      );
      navigateTo('chat', { chatId: mapped.id });
      return;
    }

    const newConv: ChatConversation = {
      id: `conv-${Date.now()}`,
      participantIds: [currentUser.id, ownerId],
      itemId: item?.id,
      itemTitle: item?.title,
      itemImage: item?.images[0],
      itemPrice: item?.pricePerDay,
      lastMessage: item ? `Menanyakan tentang ${item.title}` : 'Memulai percakapan',
      lastMessageAt: 'Baru saja',
    };
    setConversations((prev) => [newConv, ...prev]);
    navigateTo('chat', { chatId: newConv.id });
  };

  const sendMessage = async (
    conversationId: string,
    content: string,
    imageUrl?: string
  ) => {
    if (!currentUser || (!content.trim() && !imageUrl)) return;
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    const trimmed = content.trim();
    const recipientId = conv.participantIds.find((id) => id !== currentUser.id);

    if (isSupabaseConfigured && supabase) {
      const { data: insertedMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          content: trimmed,
          image_url: imageUrl || null,
          is_read: false,
        })
        .select('*')
        .single();

      if (error || !insertedMsg) {
        showToast(`Gagal mengirim pesan: ${error?.message || 'Unknown error'}`);
        return;
      }

      const mappedMsg = mapMessageRow(insertedMsg);
      setMessages((prev) =>
        prev.some((m) => m.id === mappedMsg.id) ? prev : [...prev, mappedMsg]
      );

      await supabase
        .from('conversations')
        .update({
          last_message: trimmed || 'Mengirim foto',
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: trimmed || 'Mengirim foto',
                lastMessageAt: mappedMsg.createdAt,
              }
            : c
        )
      );

      if (recipientId) {
        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: 'chat',
          title: `Chat masuk dari ${currentUser.name}`,
          body: trimmed || 'Mengirim lampiran gambar',
          target_view: 'chat',
          target_id: conversationId,
        });
      }
      return;
    }

    const timeStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      content: trimmed,
      imageUrl,
      createdAt: timeStr,
      isRead: false,
    };
    setMessages((prev) => [...prev, newMsg]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: trimmed || 'Mengirim foto', lastMessageAt: timeStr }
          : c
      )
    );
    if (recipientId) {
      setNotifications((prev) => [
        {
          id: `notif-chat-${Date.now()}`,
          userId: recipientId,
          type: 'chat',
          title: `Chat masuk dari ${currentUser.name}`,
          body: trimmed || 'Mengirim lampiran gambar',
          targetView: 'chat',
          targetId: conversationId,
          isRead: false,
          createdAt: 'Baru saja',
        },
        ...prev,
      ]);
    }
  };

  const markConversationRead = async (conversationId: string) => {
    if (!currentUser) return;

    const hasUnreadMsgs = messages.some(
      (m) =>
        m.conversationId === conversationId &&
        m.senderId !== currentUser.id &&
        !m.isRead
    );
    const hasUnreadNotifs = notifications.some(
      (n) =>
        n.userId === currentUser.id &&
        n.type === 'chat' &&
        n.targetId === conversationId &&
        !n.isRead
    );

    if (!hasUnreadMsgs && !hasUnreadNotifs) return;

    if (isSupabaseConfigured && supabase) {
      if (hasUnreadMsgs) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', currentUser.id)
          .eq('is_read', false);
      }
      if (hasUnreadNotifs) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUser.id)
          .eq('type', 'chat')
          .eq('target_id', conversationId)
          .eq('is_read', false);
      }
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.conversationId === conversationId && m.senderId !== currentUser.id && !m.isRead
          ? { ...m, isRead: true }
          : m
      )
    );
    setNotifications((prev) =>
      prev.map((n) =>
        n.userId === currentUser.id &&
        n.type === 'chat' &&
        n.targetId === conversationId &&
        !n.isRead
          ? { ...n, isRead: true }
          : n
      )
    );
  };

  const markNotificationRead = async (notifId: string) => {
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsRead = async () => {
    if (!currentUser) return;
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.userId === currentUser.id ? { ...n, isRead: true } : n))
    );
    showToast('Semua notifikasi ditandai sudah dibaca.');
  };

  return (
    <AppContext.Provider
      value={{
        isSupabaseMode: isSupabaseConfigured,
        isLoadingData,
        view,
        selectedItemId,
        activeChatId,
        footerPage,
        currentUser,
        users,
        items,
        reviews,
        favorites,
        rentals,
        conversations,
        messages,
        notifications,
        toastMessage,
        userCoords,
        setUserCoords,
        showToast,
        navigateTo,
        uploadMedia,
        loginWithEmail,
        loginWithGoogle,
        registerAccount,
        logout,
        updateProfile,
        toggleFavorite,
        submitRental,
        updateRentalStatus,
        addReview,
        addItem,
        updateItemStock,
        toggleItemApproval,
        verifyUserKtp,
        openChatWithOwner,
        sendMessage,
        markConversationRead,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
