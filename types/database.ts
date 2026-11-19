export type UserRole = 'super_admin' | 'editor' | 'client';

export type PlanTier = 'free_trial' | 'starter' | 'pro' | 'studio';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'AUD' | 'CAD' | 'SGD';

export type ProjectStatus = 'active' | 'completed' | 'on_hold';
export type StageStatus = 'pending' | 'in_progress' | 'completed';
export type MediaCategory = 'raw_preview' | 'edited_photo' | 'album_file' | 'teaser' | 'highlight_video' | 'full_film';
export type PaymentStatus = 'pending' | 'paid';
export type PaymentType = 'advance' | 'balance' | 'partial';
export type AssignmentRole = 'lead_editor' | 'editor' | 'videographer' | 'assistant';

export const STAGE_NAMES = [
  'Booking Confirmed',
  'Event Completed',
  'Data Backup Completed',
  'Photo Selection Started',
  'Photo Editing In Progress',
  'Album Designing',
  'Video Editing',
  'Client Review',
  'Corrections',
  'Final Delivery',
] as const;

export const MEDIA_CATEGORIES: { value: MediaCategory; label: string; type: 'image' | 'video' }[] = [
  { value: 'raw_preview', label: 'RAW Previews', type: 'image' },
  { value: 'edited_photo', label: 'Edited Photos', type: 'image' },
  { value: 'album_file', label: 'Album Files', type: 'image' },
  { value: 'teaser', label: 'Teaser', type: 'video' },
  { value: 'highlight_video', label: 'Highlight Video', type: 'video' },
  { value: 'full_film', label: 'Full Event Film', type: 'video' },
];

export interface Studio {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  logo_url: string;
  brand_color: string;
  currency: CurrencyCode;
  plan: PlanTier;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  max_projects: number;
  max_team_members: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  studio_id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Profile {
  id: string;
  studio_id?: string;
  role: UserRole;
  full_name: string;
  phone: string;
  avatar_url: string;
  created_at: string;
}

export interface Client {
  id: string;
  studio_id?: string;
  user_id: string | null;
  bride_name: string;
  groom_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  studio_id?: string;
  client_id: string;
  title: string;
  event_date: string | null;
  event_type: string;
  event_venue: string;
  package_name: string;
  package_amount: number;
  status: ProjectStatus;
  current_stage: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectStage {
  id: string;
  studio_id?: string;
  project_id: string;
  stage_number: number;
  stage_name: string;
  status: StageStatus;
  notes: string;
  updated_by: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProjectAssignment {
  id: string;
  studio_id?: string;
  project_id: string;
  user_id: string;
  role: AssignmentRole;
  created_at: string;
}

export interface MediaItem {
  id: string;
  studio_id?: string;
  project_id: string;
  category: MediaCategory;
  title: string;
  file_url: string;
  thumbnail_url: string;
  file_type: 'image' | 'video';
  file_size: number;
  approved: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  studio_id?: string;
  project_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  studio_id?: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_url: string;
  attachment_type: '' | 'image' | 'file' | 'voice';
  read_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  studio_id?: string;
  project_id: string;
  client_id: string;
  amount: number;
  payment_type: PaymentType;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: string | null;
  method: string;
  notes: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      studios: { Row: Studio; Insert: Partial<Studio>; Update: Partial<Studio> };
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog>; Update: Partial<AuditLog> };
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client> };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> };
      project_stages: { Row: ProjectStage; Insert: Partial<ProjectStage>; Update: Partial<ProjectStage> };
      project_assignments: { Row: ProjectAssignment; Insert: Partial<ProjectAssignment>; Update: Partial<ProjectAssignment> };
      media: { Row: MediaItem; Insert: Partial<MediaItem>; Update: Partial<MediaItem> };
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> };
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> };
    };
  };
}
