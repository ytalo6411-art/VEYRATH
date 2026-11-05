export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          name: string;
          description: string;
          invite_code: string;
          created_by: string;
          status: 'active' | 'archived';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          invite_code?: string;
          created_by: string;
          status?: 'active' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          invite_code?: string;
          created_by?: string;
          status?: 'active' | 'archived';
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_members: {
        Row: {
          campaign_id: string;
          user_id: string;
          role: 'master' | 'player';
          joined_at: string;
        };
        Insert: {
          campaign_id: string;
          user_id: string;
          role: 'master' | 'player';
          joined_at?: string;
        };
        Update: {
          role?: 'master' | 'player';
        };
        Relationships: [];
      };
      campaign_game_state: {
        Row: {
          campaign_id: string;
          region_id: 'clareira-da-vigilia';
          slime_hp: number;
          revision: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          region_id?: 'clareira-da-vigilia';
          slime_hp?: number;
          revision?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          region_id?: 'clareira-da-vigilia';
          slime_hp?: number;
          revision?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          id: string;
          campaign_id: string;
          user_id: string;
          name: string;
          character_class: 'guardian' | 'ranger' | 'arcanist';
          level: number;
          experience: number;
          hp: number;
          max_hp: number;
          attack_bonus: number;
          defense: number;
          col: number;
          row: number;
          quest_status: 'unstarted' | 'active' | 'completed';
          state_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          user_id: string;
          name: string;
          character_class: 'guardian' | 'ranger' | 'arcanist';
          level?: number;
          experience?: number;
          hp: number;
          max_hp: number;
          attack_bonus: number;
          defense: number;
          col?: number;
          row?: number;
          quest_status?: 'unstarted' | 'active' | 'completed';
          state_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          character_class?: 'guardian' | 'ranger' | 'arcanist';
          level?: number;
          experience?: number;
          hp?: number;
          max_hp?: number;
          attack_bonus?: number;
          defense?: number;
          col?: number;
          row?: number;
          quest_status?: 'unstarted' | 'active' | 'completed';
          state_version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      character_inventory: {
        Row: {
          character_id: string;
          item_id: 'amber-shard';
          quantity: number;
          updated_at: string;
        };
        Insert: {
          character_id: string;
          item_id: 'amber-shard';
          quantity: number;
          updated_at?: string;
        };
        Update: {
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_game_events: {
        Row: {
          id: number;
          campaign_id: string;
          actor_id: string | null;
          character_id: string | null;
          event_type: 'character_created' | 'moved' | 'quest_accepted' | 'combat' | 'quest_completed' | 'rested' | 'region_reset';
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          campaign_id: string;
          actor_id?: string | null;
          character_id?: string | null;
          event_type: 'character_created' | 'moved' | 'quest_accepted' | 'combat' | 'quest_completed' | 'rested' | 'region_reset';
          payload?: Json;
          created_at?: string;
        };
        Update: {
          payload?: Json;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      join_campaign_by_code: {
        Args: { p_invite_code: string };
        Returns: {
          campaign_id: string;
          campaign_name: string;
          role: 'master' | 'player';
        }[];
      };
      is_campaign_member: {
        Args: { p_campaign_id: string };
        Returns: boolean;
      };
      is_campaign_master: {
        Args: { p_campaign_id: string };
        Returns: boolean;
      };
      get_campaign_game_snapshot: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      create_campaign_character: {
        Args: { p_campaign_id: string; p_name: string; p_character_class: 'guardian' | 'ranger' | 'arcanist' };
        Returns: Json;
      };
      move_campaign_character: {
        Args: { p_campaign_id: string; p_direction: 'up' | 'right' | 'down' | 'left' };
        Returns: Json;
      };
      accept_campaign_quest: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      attack_campaign_slime: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      deliver_campaign_quest: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      rest_campaign_character: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
      master_reset_campaign_region: {
        Args: { p_campaign_id: string };
        Returns: Json;
      };
    };
    Enums: {};
    CompositeTypes: { [_ in never]: never };
  };
}
