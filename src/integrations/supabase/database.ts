import type { Database as GeneratedDatabase, Json } from "./types";

type ExistingTables = GeneratedDatabase["public"]["Tables"];
type ExistingFunctions = GeneratedDatabase["public"]["Functions"];
type ExistingInterpreted = ExistingTables["interpreted_contents"];

type InterpretedContents = {
  Row: ExistingInterpreted["Row"] & { time_was_informed: boolean | null };
  Insert: ExistingInterpreted["Insert"] & { time_was_informed?: boolean | null };
  Update: ExistingInterpreted["Update"] & { time_was_informed?: boolean | null };
  Relationships: ExistingInterpreted["Relationships"];
};

type CommunityTables = {
  community_profiles: {
    Row: {
      id: string;
      display_name: string | null;
      artistic_name: string | null;
      profile_type: string;
      short_bio: string | null;
      full_bio: string | null;
      city: string | null;
      neighborhood: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      categories: string[];
      skills: string[];
      collaboration_interests: string[];
      contact_email: string | null;
      contact_phone: string | null;
      instagram: string | null;
      website: string | null;
      visibility: string;
      onboarding_status: string;
      verified: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id: string;
      display_name?: string | null;
      artistic_name?: string | null;
      profile_type?: string;
      short_bio?: string | null;
      full_bio?: string | null;
      city?: string | null;
      neighborhood?: string | null;
      avatar_url?: string | null;
      cover_url?: string | null;
      categories?: string[];
      skills?: string[];
      collaboration_interests?: string[];
      contact_email?: string | null;
      contact_phone?: string | null;
      instagram?: string | null;
      website?: string | null;
      visibility?: string;
      onboarding_status?: string;
      verified?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<CommunityTables["community_profiles"]["Insert"]>;
    Relationships: [];
  };
  portfolio_items: {
    Row: {
      id: string;
      profile_id: string;
      media_type: string;
      title: string | null;
      description: string | null;
      media_url: string;
      thumbnail_url: string | null;
      alt_text: string | null;
      sort_order: number;
      is_public: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      profile_id: string;
      media_type: string;
      title?: string | null;
      description?: string | null;
      media_url: string;
      thumbnail_url?: string | null;
      alt_text?: string | null;
      sort_order?: number;
      is_public?: boolean;
      created_at?: string;
    };
    Update: Partial<CommunityTables["portfolio_items"]["Insert"]>;
    Relationships: [
      {
        foreignKeyName: "portfolio_items_profile_id_fkey";
        columns: ["profile_id"];
        isOneToOne: false;
        referencedRelation: "community_profiles";
        referencedColumns: ["id"];
      },
    ];
  };
  marketplace_listings: {
    Row: {
      id: string;
      owner_id: string;
      listing_type: string;
      title: string;
      description: string | null;
      category: string | null;
      price_amount: number | null;
      price_label: string | null;
      city: string | null;
      contact_url: string | null;
      cover_url: string | null;
      gallery_urls: string[];
      status: string;
      moderation_notes: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      owner_id: string;
      listing_type: string;
      title: string;
      description?: string | null;
      category?: string | null;
      price_amount?: number | null;
      price_label?: string | null;
      city?: string | null;
      contact_url?: string | null;
      cover_url?: string | null;
      gallery_urls?: string[];
      status?: string;
      moderation_notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<CommunityTables["marketplace_listings"]["Insert"]>;
    Relationships: [
      {
        foreignKeyName: "marketplace_listings_owner_id_fkey";
        columns: ["owner_id"];
        isOneToOne: false;
        referencedRelation: "community_profiles";
        referencedColumns: ["id"];
      },
    ];
  };
  platform_tools: {
    Row: {
      id: string;
      title: string;
      slug: string;
      short_description: string | null;
      description: string | null;
      cover_url: string | null;
      sales_url: string | null;
      price_label: string | null;
      benefits: string[];
      is_featured: boolean;
      status: string;
      sort_order: number;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      title: string;
      slug: string;
      short_description?: string | null;
      description?: string | null;
      cover_url?: string | null;
      sales_url?: string | null;
      price_label?: string | null;
      benefits?: string[];
      is_featured?: boolean;
      status?: string;
      sort_order?: number;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<CommunityTables["platform_tools"]["Insert"]>;
    Relationships: [];
  };
  community_spaces: {
    Row: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      icon: string | null;
      visibility: string;
      posting_policy: string;
      active: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      slug: string;
      description?: string | null;
      icon?: string | null;
      visibility?: string;
      posting_policy?: string;
      active?: boolean;
      created_at?: string;
    };
    Update: Partial<CommunityTables["community_spaces"]["Insert"]>;
    Relationships: [];
  };
  community_posts: {
    Row: {
      id: string;
      space_id: string;
      author_id: string;
      title: string | null;
      body: string;
      media_urls: string[];
      status: string;
      pinned: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      space_id: string;
      author_id: string;
      title?: string | null;
      body: string;
      media_urls?: string[];
      status?: string;
      pinned?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<CommunityTables["community_posts"]["Insert"]>;
    Relationships: [
      {
        foreignKeyName: "community_posts_space_id_fkey";
        columns: ["space_id"];
        isOneToOne: false;
        referencedRelation: "community_spaces";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "community_posts_author_id_fkey";
        columns: ["author_id"];
        isOneToOne: false;
        referencedRelation: "community_profiles";
        referencedColumns: ["id"];
      },
    ];
  };
  chat_rooms: {
    Row: {
      id: string;
      owner_id: string;
      name: string | null;
      room_type: string;
      description: string | null;
      related_event_id: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      owner_id: string;
      name?: string | null;
      room_type?: string;
      description?: string | null;
      related_event_id?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<CommunityTables["chat_rooms"]["Insert"]>;
    Relationships: [
      {
        foreignKeyName: "chat_rooms_owner_id_fkey";
        columns: ["owner_id"];
        isOneToOne: false;
        referencedRelation: "community_profiles";
        referencedColumns: ["id"];
      },
    ];
  };
  chat_room_members: {
    Row: {
      room_id: string;
      profile_id: string;
      member_role: string;
      joined_at: string;
    };
    Insert: {
      room_id: string;
      profile_id: string;
      member_role?: string;
      joined_at?: string;
    };
    Update: Partial<CommunityTables["chat_room_members"]["Insert"]>;
    Relationships: [
      {
        foreignKeyName: "chat_room_members_room_id_fkey";
        columns: ["room_id"];
        isOneToOne: false;
        referencedRelation: "chat_rooms";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "chat_room_members_profile_id_fkey";
        columns: ["profile_id"];
        isOneToOne: false;
        referencedRelation: "community_profiles";
        referencedColumns: ["id"];
      },
    ];
  };
  chat_messages: {
    Row: {
      id: string;
      room_id: string;
      sender_id: string;
      body: string | null;
      media_urls: string[];
      reply_to_id: string | null;
      created_at: string;
      deleted_at: string | null;
    };
    Insert: {
      id?: string;
      room_id: string;
      sender_id: string;
      body?: string | null;
      media_urls?: string[];
      reply_to_id?: string | null;
      created_at?: string;
      deleted_at?: string | null;
    };
    Update: Partial<CommunityTables["chat_messages"]["Insert"]>;
    Relationships: [
      {
        foreignKeyName: "chat_messages_room_id_fkey";
        columns: ["room_id"];
        isOneToOne: false;
        referencedRelation: "chat_rooms";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "chat_messages_sender_id_fkey";
        columns: ["sender_id"];
        isOneToOne: false;
        referencedRelation: "community_profiles";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "chat_messages_reply_to_id_fkey";
        columns: ["reply_to_id"];
        isOneToOne: false;
        referencedRelation: "chat_messages";
        referencedColumns: ["id"];
      },
    ];
  };
  chat_read_receipts: {
    Row: {
      room_id: string;
      profile_id: string;
      last_read_at: string;
    };
    Insert: {
      room_id: string;
      profile_id: string;
      last_read_at?: string;
    };
    Update: {
      last_read_at?: string;
    };
    Relationships: [];
  };
  community_event_submissions: {
    Row: {
      id: string;
      author_id: string;
      input_type: string;
      source_text: string | null;
      source_urls: string[];
      title: string | null;
      description: string | null;
      event_date: string | null;
      start_time: string | null;
      end_time: string | null;
      venue_name: string | null;
      address: string | null;
      city: string | null;
      price_info: string | null;
      category: string | null;
      contact_info: string | null;
      ticket_url: string | null;
      cover_url: string | null;
      ai_extracted_data: Json;
      duplicate_of: string | null;
      status: string;
      moderation_notes: string | null;
      published_event_id: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      author_id: string;
      input_type: string;
      source_text?: string | null;
      source_urls?: string[];
      title?: string | null;
      description?: string | null;
      event_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      venue_name?: string | null;
      address?: string | null;
      city?: string | null;
      price_info?: string | null;
      category?: string | null;
      contact_info?: string | null;
      ticket_url?: string | null;
      cover_url?: string | null;
      ai_extracted_data?: Json;
      duplicate_of?: string | null;
      status?: string;
      moderation_notes?: string | null;
      published_event_id?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<CommunityTables["community_event_submissions"]["Insert"]>;
    Relationships: [
      {
        foreignKeyName: "community_event_submissions_author_id_fkey";
        columns: ["author_id"];
        isOneToOne: false;
        referencedRelation: "community_profiles";
        referencedColumns: ["id"];
      },
    ];
  };
};

type CommunityFunctions = {
  can_read_chat_attachment: {
    Args: { object_name: string };
    Returns: boolean;
  };
  create_private_chat: {
    Args: {
      room_name: string;
      room_description?: string | null;
      invited_profile_ids?: string[];
    };
    Returns: string;
  };
  get_chat_unread_counts: {
    Args: Record<PropertyKey, never>;
    Returns: Array<{ chat_room_id: string; unread_count: number }>;
  };
  is_chat_room_member: {
    Args: { target_room_id: string; target_profile_id?: string };
    Returns: boolean;
  };
  manage_chat_member: {
    Args: { target_room_id: string; target_profile_id: string; operation: string };
    Returns: undefined;
  };
  mark_chat_read: {
    Args: { target_room_id: string; read_through?: string };
    Returns: undefined;
  };
  moderate_marketplace_listing: {
    Args: { listing_id: string; decision: string; notes?: string | null };
    Returns: undefined;
  };
  normalize_event_price_storage: {
    Args: { value: string | null };
    Returns: string | null;
  };
  publish_community_event: {
    Args: { submission_id: string };
    Returns: string | null;
  };
};

type PublicSchema = GeneratedDatabase["public"];

type ExtendedPublicSchema = Omit<PublicSchema, "Tables" | "Functions"> & {
  Tables: Omit<ExistingTables, "interpreted_contents"> &
    CommunityTables & {
      interpreted_contents: InterpretedContents;
    };
  Functions: ExistingFunctions & CommunityFunctions;
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: ExtendedPublicSchema;
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
