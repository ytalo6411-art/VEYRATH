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
    };
    Enums: {};
    CompositeTypes: { [_ in never]: never };
  };
}
