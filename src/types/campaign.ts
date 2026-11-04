export type CampaignRole = 'master' | 'player';
export type WorkspaceMode = 'local' | 'cloud';

export interface CampaignDraft {
  name: string;
  description: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  description: string;
  inviteCode: string | null;
  createdAt: string;
  role: CampaignRole;
  mode: WorkspaceMode;
}
