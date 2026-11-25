import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { IMAGES } from '../data/seedData';
import {
  AppNotification,
  AppView,
  ChatConversation,
  ChatMessage,
  NotificationType,
  ProductItem,
  ProductReview,
  ProductSpec,
  RentalOrder,
  RentalStatus,
  User,
  UserRole,
} from '../types';
import { supabase } from './supabase';

const MEDIA_BUCKET = 'pinjamkuy-media';

function formatRelativeOrTime(isoString?: string | null): string {
  if (!isoString) return 'Baru saja';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function mapProfileRow(row: Record<string, unknown>): User {
  const roleVal = row.role;
  const role: UserRole =
    roleVal === 'owner' || roleVal === 'admin' ? roleVal : 'renter';

  return {
    id: String(row.id),
    name: String(row.full_name || 'Pengguna PinjamKuy'),
    email: String(row.email || ''),
    role,
    avatar: String(row.avatar_url || '') || IMAGES.avatarRaka,
    phone: String(row.phone || ''),
    city: String(row.city || 'Jakarta Selatan'),
    bio: String(row.bio || ''),
    ktpVerified: Boolean(row.ktp_verified),
    emailVerified: Boolean(row.email_verified),
    rating: Number(row.rating ?? 5.0),
    responseRate: String(row.response_rate || 'Baru bergabung'),
    joinedAt: String(row.joined_at || 'Baru bergabung'),
    lat: Number(row.lat ?? -6.2607),
    lng: Number(row.lng ?? 106.8135),
  };
}

export function mapItemRow(row: Record<string, unknown>): ProductItem {
  const completeness = Array.isArray(row.completeness)
    ? row.completeness.map(String)
    : [];
  const specs = Array.isArray(row.specs)
    ? (row.specs as ProductSpec[]).map((s) => ({
        label: String(s?.label || ''),
        value: String(s?.value || ''),
      }))
    : [];
  const rentalTerms = Array.isArray(row.rental_terms)
    ? row.rental_terms.map(String)
    : [];
  const images = Array.isArray(row.images) && row.images.length > 0
    ? row.images.map(String)
    : [IMAGES.camera];

  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    title: String(row.title || ''),
    category: String(row.category || 'Lainnya'),
    pricePerDay: Number(row.price_per_day ?? 0),
    stock: Number(row.stock ?? 1),
    depositAmount: Number(row.deposit_amount ?? 0),
    description: String(row.description || ''),
    condition: String(row.condition || 'Sangat Baik & Siap Pakai'),
    completeness,
    specs,
    rentalTerms,
    images,
    city: String(row.city || 'Jakarta Selatan'),
    district: String(row.district || ''),
    addressHint: String(row.address_hint || ''),
    lat: Number(row.lat ?? -6.2607),
    lng: Number(row.lng ?? 106.8135),
    rating: Number(row.rating ?? 5.0),
    reviewCount: Number(row.review_count ?? 0),
    rentedCount: Number(row.rented_count ?? 0),
    isApproved: row.is_approved !== false,
    createdAt: String(row.created_at || new Date().toISOString()).split('T')[0],
  };
}

export function mapReviewRow(row: Record<string, unknown>): ProductReview {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    userId: String(row.user_id),
    userName: String(row.user_name || 'Pengguna'),
    userAvatar: String(row.user_avatar || '') || IMAGES.avatarRaka,
    rating: Number(row.rating ?? 5),
    comment: String(row.comment || ''),
    photos: Array.isArray(row.photos) ? row.photos.map(String) : [],
    variantInfo: row.variant_info ? String(row.variant_info) : undefined,
    createdAt: String(row.created_at || '').split('T')[0] || 'Baru saja',
  };
}

export function mapRentalRow(row: Record<string, unknown>): RentalOrder {
  const statusVal = String(row.status || 'pending');
  const status: RentalStatus =
    statusVal === 'approved' ||
    statusVal === 'rejected' ||
    statusVal === 'completed' ||
    statusVal === 'cancelled'
      ? statusVal
      : 'pending';

  return {
    id: String(row.id),
    itemId: String(row.item_id),
    itemTitle: String(row.item_title || ''),
    itemImage: String(row.item_image || IMAGES.camera),
    renterId: String(row.renter_id),
    renterName: String(row.renter_name || 'Penyewa'),
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name || 'Pemilik'),
    quantity: Number(row.quantity ?? 1),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || ''),
    totalDays: Number(row.total_days ?? 1),
    pricePerDay: Number(row.price_per_day ?? 0),
    protectionFee: Number(row.protection_fee ?? 0),
    totalPrice: Number(row.total_price ?? 0),
    status,
    notes: String(row.notes || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function mapConversationRow(row: Record<string, unknown>): ChatConversation {
  return {
    id: String(row.id),
    participantIds: Array.isArray(row.participant_ids)
      ? row.participant_ids.map(String)
      : [],
    itemId: row.item_id ? String(row.item_id) : undefined,
    itemTitle: row.item_title ? String(row.item_title) : undefined,
    itemImage: row.item_image ? String(row.item_image) : undefined,
    itemPrice: row.item_price != null ? Number(row.item_price) : undefined,
    lastMessage: String(row.last_message || ''),
    lastMessageAt: formatRelativeOrTime(
      typeof row.last_message_at === 'string' ? row.last_message_at : null
    ),
  };
}

export function mapMessageRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    content: String(row.content || ''),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    createdAt: formatRelativeOrTime(
      typeof row.created_at === 'string' ? row.created_at : null
    ),
    isRead: Boolean(row.is_read),
  };
}

export function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  const typeVal = String(row.type || 'system');
  const type: NotificationType =
    typeVal === 'chat' ||
    typeVal === 'rental_request' ||
    typeVal === 'rental_status'
      ? typeVal
      : 'system';

  const viewVal = String(row.target_view || 'notifications');
  const targetView: AppView =
    viewVal === 'home' ||
    viewVal === 'product-detail' ||
    viewVal === 'auth' ||
    viewVal === 'account' ||
    viewVal === 'add-item' ||
    viewVal === 'chat' ||
    viewVal === 'info'
      ? viewVal
      : 'notifications';

  return {
    id: String(row.id),
    userId: String(row.user_id),
    type,
    title: String(row.title || ''),
    body: String(row.body || ''),
    targetView,
    targetId: row.target_id ? String(row.target_id) : undefined,
    isRead: Boolean(row.is_read),
    createdAt: formatRelativeOrTime(
      typeof row.created_at === 'string' ? row.created_at : null
    ),
  };
}

export async function ensureSupabaseProfile(
  authUser: SupabaseAuthUser
): Promise<User | null> {
  if (!supabase) return null;

  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (fetchErr) {
    console.error('Supabase fetch profile error:', fetchErr.message);
  }

  if (existing) {
    return mapProfileRow(existing);
  }

  const meta = authUser.user_metadata || {};
  const role: UserRole = meta.role === 'owner' ? 'owner' : 'renter';
  const fullName =
    String(meta.full_name || meta.name || '').trim() ||
    authUser.email?.split('@')[0] ||
    'Pengguna PinjamKuy';
  const avatarUrl = String(meta.avatar_url || meta.picture || '') || '';

  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: authUser.id,
        email: authUser.email || '',
        full_name: fullName,
        role,
        avatar_url: avatarUrl,
        email_verified: Boolean(authUser.email_confirmed_at),
        ktp_verified: false,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (insertErr) {
    console.error('Supabase create profile error:', insertErr.message);
    return {
      id: authUser.id,
      name: fullName,
      email: authUser.email || '',
      role,
      avatar: avatarUrl || IMAGES.avatarRaka,
      phone: '',
      city: 'Jakarta Selatan',
      bio: '',
      ktpVerified: false,
      emailVerified: Boolean(authUser.email_confirmed_at),
      rating: 5.0,
      responseRate: 'Baru bergabung',
      joinedAt: 'Baru bergabung',
      lat: -6.2607,
      lng: 106.8135,
    };
  }

  return mapProfileRow(created);
}

export async function fetchPublicCatalogData(): Promise<{
  users: User[];
  items: ProductItem[];
  reviews: ProductReview[];
}> {
  if (!supabase) {
    return { users: [], items: [], reviews: [] };
  }

  const [profilesRes, itemsRes, reviewsRes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('items').select('*').order('created_at', { ascending: false }),
    supabase.from('reviews').select('*').order('created_at', { ascending: false }),
  ]);

  return {
    users: (profilesRes.data || []).map(mapProfileRow),
    items: (itemsRes.data || []).map(mapItemRow),
    reviews: (reviewsRes.data || []).map(mapReviewRow),
  };
}

export async function fetchUserScopedData(userId: string): Promise<{
  favorites: string[];
  rentals: RentalOrder[];
  conversations: ChatConversation[];
  messages: ChatMessage[];
  notifications: AppNotification[];
}> {
  if (!supabase) {
    return {
      favorites: [],
      rentals: [],
      conversations: [],
      messages: [],
      notifications: [],
    };
  }

  const [favRes, rentalRes, convRes, notifRes] = await Promise.all([
    supabase.from('favorites').select('item_id').eq('user_id', userId),
    supabase
      .from('rentals')
      .select('*')
      .or(`renter_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('conversations')
      .select('*')
      .contains('participant_ids', [userId])
      .order('last_message_at', { ascending: false }),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const conversations = (convRes.data || []).map(mapConversationRow);
  let messages: ChatMessage[] = [];

  if (conversations.length > 0) {
    const convIds = conversations.map((c) => c.id);
    const msgRes = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });
    messages = (msgRes.data || []).map(mapMessageRow);
  }

  return {
    favorites: (favRes.data || []).map((f) => String(f.item_id)),
    rentals: (rentalRes.data || []).map(mapRentalRow),
    conversations,
    messages,
    notifications: (notifRes.data || []).map(mapNotificationRow),
  };
}

export async function uploadMediaFile(
  file: File,
  folder: 'avatars' | 'items' | 'reviews' | 'chat',
  userId?: string
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran gambar maksimal 5 MB.');
  }

  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Gagal membaca file gambar.'));
      };
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.readAsDataURL(file);
    });

  if (!supabase || !userId) {
    return readAsDataUrl();
  }

  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
  const safePath = `${folder}/${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(safePath, file, { upsert: false, contentType: file.type });

  if (uploadError) {
    console.warn('Supabase storage upload fallback to local DataURL:', uploadError.message);
    return readAsDataUrl();
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(safePath);
  return data.publicUrl;
}
