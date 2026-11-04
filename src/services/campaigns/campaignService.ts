import { supabase } from '../supabase/client';
import type { CampaignDraft, CampaignRole, CampaignSummary } from '../../types/campaign';
import { validateCampaignDraft, validateInviteCode } from './campaignDomain';

function requireClient() {
  if (!supabase) {
    throw new Error('O Supabase não está configurado. Nenhuma campanha online foi salva.');
  }
  return supabase;
}

function campaignFromRow(
  row: { id: string; name: string; description: string; invite_code: string; created_at: string },
  role: CampaignRole,
): CampaignSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    role,
    mode: 'cloud',
  };
}

export const campaignService = {
  async listCampaigns(userId: string): Promise<CampaignSummary[]> {
    const client = requireClient();
    const { data: memberships, error: membershipError } = await client
      .from('campaign_members')
      .select('campaign_id, role')
      .eq('user_id', userId);

    if (membershipError) throw new Error(membershipError.message);
    if (!memberships?.length) return [];

    const roleByCampaign = new Map<string, CampaignRole>(
      memberships.map((membership) => [membership.campaign_id, membership.role]),
    );
    const { data: campaigns, error: campaignError } = await client
      .from('campaigns')
      .select('id, name, description, invite_code, created_at')
      .in('id', [...roleByCampaign.keys()])
      .order('created_at', { ascending: false });

    if (campaignError) throw new Error(campaignError.message);
    return (campaigns ?? []).map((campaign) =>
      campaignFromRow(campaign, roleByCampaign.get(campaign.id) ?? 'player'),
    );
  },

  async createCampaign(userId: string, draft: CampaignDraft): Promise<CampaignSummary> {
    const client = requireClient();
    const validDraft = validateCampaignDraft(draft);
    const { data, error } = await client
      .from('campaigns')
      .insert({
        name: validDraft.name,
        description: validDraft.description,
        created_by: userId,
      })
      .select('id, name, description, invite_code, created_at')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('O banco não retornou a campanha criada.');
    return campaignFromRow(data, 'master');
  },

  async joinByInviteCode(rawCode: string): Promise<string> {
    const client = requireClient();
    const inviteCode = validateInviteCode(rawCode);
    const { data, error } = await client.rpc('join_campaign_by_code', {
      p_invite_code: inviteCode,
    });

    if (error) throw new Error(error.message);
    const joinedCampaign = data?.[0];
    if (!joinedCampaign?.campaign_id) {
      throw new Error('O servidor não confirmou a entrada na campanha.');
    }
    return joinedCampaign.campaign_id;
  },
};
