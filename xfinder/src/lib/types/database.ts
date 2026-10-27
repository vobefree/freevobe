/**
 * Typer för databasen. Speglar supabase/migrations/*.sql exakt.
 *
 * Insert/Update är avsiktligt Partial<Row>: Postgres-villkoren, triggererna och
 * defaultvärdena avgör vad som faktiskt är obligatoriskt (t.ex. räknar
 * bookings_prepare fram priserna). Då slipper typerna driva ifrån schemat.
 *
 * När projektet är länkat kan filen regenereras med:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
 */

export type UserRole = "customer" | "companion" | "admin";
export type ListingStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "reviewed"
  | "cancelled"
  | "refunded"
  | "expired";
export type PaymentKind = "registration" | "first_booking_fee" | "booking";
export type PaymentStatus =
  | "requires_payment"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";
export type AiExercise =
  | "fritt"
  | "smalltalk"
  | "forsta_mote"
  | "jobb_fest"
  | "brollop"
  | "konflikt"
  | "granssattning";
export type AiPersona = "van" | "kollega" | "eventgast" | "coach";
export type MessageRole = "user" | "assistant" | "system";
export type ReportCategory =
  | "sexuell_tjanst"
  | "romantik_eller_intimitet"
  | "trakasserier"
  | "no_show"
  | "oroande_beteende"
  | "falsk_profil"
  | "utanfor_plattformen"
  | "annat";
export type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed";
export type ReviewRole = "customer" | "companion";

/** Ett tillgänglighetsfönster i companion_listings.availability. */
export type AvailabilitySlot = {
  /** 1 = måndag … 7 = söndag */
  weekday: number;
  /** "18:00" */
  from: string;
  /** "21:00" */
  to: string;
};

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string;
  city: string | null;
  languages: string[];
  interests: string[];
  desired_activities: string[];
  comfort_level: number;
  bio: string | null;
  avatar_url: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  registration_paid_at: string | null;
  onboarding_completed_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanionListing = {
  id: string;
  user_id: string;
  status: ListingStatus;
  headline: string;
  bio: string;
  photo_urls: string[];
  video_intro_url: string | null;
  city: string;
  languages: string[];
  interests: string[];
  activities: string[];
  hourly_rate_sek: number;
  min_minutes: number;
  availability: AvailabilitySlot[];
  boundaries: string;
  accepts_public_meeting: boolean;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  rating_avg: number;
  rating_count: number;
  completed_bookings: number;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  customer_id: string;
  companion_user_id: string;
  listing_id: string | null;
  last_message_at: string;
  last_message_from: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  flagged_at: string | null;
  flag_reason: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  customer_id: string;
  companion_user_id: string;
  listing_id: string;
  activity: string;
  city: string;
  meeting_point: string | null;
  starts_at: string;
  duration_minutes: number;
  hourly_rate_sek: number;
  companion_amount_sek: number;
  service_fee_sek: number;
  first_booking_fee_sek: number;
  total_sek: number;
  currency: string;
  status: BookingStatus;
  notes_to_companion: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  refund_amount_sek: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  paid_at: string | null;
  funds_captured_at: string | null;
  funds_released_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  pending_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Review = {
  id: string;
  booking_id: string;
  author_id: string;
  subject_id: string;
  author_role: ReviewRole;
  rating: number;
  body: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  booking_id: string | null;
  conversation_id: string | null;
  category: ReportCategory;
  details: string;
  status: ReportStatus;
  handled_by: string | null;
  handled_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Block = {
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  created_at: string;
};

export type AiSession = {
  id: string;
  user_id: string;
  exercise: AiExercise;
  persona: AiPersona;
  title: string;
  reality_next_step: string | null;
  crisis_flagged: boolean;
  message_count: number;
  started_at: string;
  last_activity_at: string;
  ended_at: string | null;
};

export type AiMessage = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

export type AiUsageDaily = {
  user_id: string;
  usage_date: string;
  message_count: number;
  last_message_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  booking_id: string | null;
  kind: PaymentKind;
  amount_sek: number;
  status: PaymentStatus;
  refunded_amount_sek: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type StripeEvent = {
  id: string;
  type: string;
  processed_at: string | null;
  error: string | null;
  created_at: string;
};

/** Svaret från rpc quote_booking – exakt samma siffror som Stripe får. */
export type BookingQuoteRow = {
  listing_id: string;
  hourly_rate_sek: number;
  duration_minutes: number;
  companion_amount_sek: number;
  service_fee_sek: number;
  first_booking_fee_sek: number;
  total_sek: number;
  currency: string;
};

/** Svaret från rpc consume_ai_message. */
export type AiUsageResult = {
  used: number;
  remaining: number;
  daily_limit: number;
  paused: boolean;
};

type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<Profile>;
      companion_listings: TableShape<CompanionListing>;
      conversations: TableShape<Conversation>;
      messages: TableShape<Message>;
      bookings: TableShape<Booking>;
      reviews: TableShape<Review>;
      reports: TableShape<Report>;
      blocks: TableShape<Block>;
      ai_sessions: TableShape<AiSession>;
      ai_messages: TableShape<AiMessage>;
      ai_usage_daily: TableShape<AiUsageDaily>;
      payments: TableShape<Payment>;
      stripe_events: TableShape<StripeEvent>;
    };
    Views: Record<string, never>;
    Functions: {
      quote_booking: {
        Args: { p_listing_id: string; p_duration_minutes: number };
        Returns: BookingQuoteRow[];
      };
      consume_ai_message: {
        Args: { p_session_id: string; p_daily_limit?: number };
        Returns: AiUsageResult[];
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      listing_status: ListingStatus;
      booking_status: BookingStatus;
      payment_kind: PaymentKind;
      payment_status: PaymentStatus;
      ai_exercise: AiExercise;
      ai_persona: AiPersona;
      message_role: MessageRole;
      report_category: ReportCategory;
      report_status: ReportStatus;
      review_role: ReviewRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

/** Bekvämlighetsalias: TableName, t.ex. "bookings". */
export type TableName = keyof Database["public"]["Tables"];

/** En rad av en tabell, t.ex. Row<"bookings"> = Booking. */
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
