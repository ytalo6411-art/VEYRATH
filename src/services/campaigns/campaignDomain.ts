import type { CampaignDraft } from '../../types/campaign';

export function validateCampaignDraft(draft: CampaignDraft): CampaignDraft {
  const name = draft.name.trim();
  const description = draft.description.trim();

  if (name.length < 3) {
    throw new Error('O nome da campanha precisa ter pelo menos 3 caracteres.');
  }
  if (name.length > 80) {
    throw new Error('O nome da campanha não pode passar de 80 caracteres.');
  }
  if (description.length > 500) {
    throw new Error('A descrição não pode passar de 500 caracteres.');
  }

  return { name, description };
}

export function normalizeInviteCode(rawCode: string): string {
  return rawCode.trim().replace(/[\s-]/g, '').toUpperCase();
}

export function validateInviteCode(rawCode: string): string {
  const inviteCode = normalizeInviteCode(rawCode);
  if (!/^[A-F0-9]{16}$/.test(inviteCode)) {
    throw new Error('O código de convite deve conter 16 caracteres hexadecimais.');
  }
  return inviteCode;
}
