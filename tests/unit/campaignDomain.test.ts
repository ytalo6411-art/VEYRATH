import { describe, expect, it } from 'vitest';
import { normalizeInviteCode, validateCampaignDraft, validateInviteCode } from '../../src/services/campaigns/campaignDomain';

describe('campaign domain validation', () => {
  it('trims campaign fields before saving', () => {
    expect(validateCampaignDraft({ name: '  Vigília do Norte  ', description: '  A velha estrada.  ' })).toEqual({
      name: 'Vigília do Norte',
      description: 'A velha estrada.',
    });
  });

  it('rejects names outside the documented limits', () => {
    expect(() => validateCampaignDraft({ name: 'No', description: '' })).toThrow(/3 caracteres/);
    expect(() => validateCampaignDraft({ name: 'a'.repeat(81), description: '' })).toThrow(/80 caracteres/);
    expect(() => validateCampaignDraft({ name: 'Vigília', description: 'x'.repeat(501) })).toThrow(/500 caracteres/);
  });

  it('normalizes a shared invite code and enforces its format', () => {
    expect(normalizeInviteCode(' a1b2-c3d4-e5f6-a7b8 ')).toBe('A1B2C3D4E5F6A7B8');
    expect(validateInviteCode('a1b2-c3d4-e5f6-a7b8')).toBe('A1B2C3D4E5F6A7B8');
    expect(() => validateInviteCode('not-a-code')).toThrow(/16 caracteres/);
  });
});
