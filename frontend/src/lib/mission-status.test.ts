import { it, expect, describe } from 'vitest';
import {
  nextAgentStatus,
  lastAgentStatus,
  isAwaitingBuyerConfirmation,
  isTerminalMissionStatus,
} from './mission-status';

describe('nextAgentStatus — STANDARD (default)', () => {
  it('walks the full 5-step sequence', () => {
    expect(nextAgentStatus('RECU')).toBe('EN_ACHAT');
    expect(nextAgentStatus('EN_ACHAT')).toBe('ACHETE');
    expect(nextAgentStatus('ACHETE')).toBe('EMBALLE');
    expect(nextAgentStatus('EMBALLE')).toBe('EXPEDIE');
  });

  it('returns null at EXPEDIE (last agent status)', () => {
    expect(nextAgentStatus('EXPEDIE')).toBeNull();
  });

  it('behaves the same when STANDARD is passed explicitly', () => {
    expect(nextAgentStatus('ACHETE', 'STANDARD')).toBe('EMBALLE');
  });

  it('returns null for an unknown/terminal status', () => {
    expect(nextAgentStatus('LIVRE')).toBeNull();
    expect(nextAgentStatus('LITIGE')).toBeNull();
  });
});

describe('nextAgentStatus — INSTANTANE', () => {
  it('walks the shortened 3-step sequence, skipping EMBALLE/EXPEDIE', () => {
    expect(nextAgentStatus('RECU', 'INSTANTANE')).toBe('EN_ACHAT');
    expect(nextAgentStatus('EN_ACHAT', 'INSTANTANE')).toBe('ACHETE');
  });

  it('returns null at ACHETE (last agent status for this type)', () => {
    expect(nextAgentStatus('ACHETE', 'INSTANTANE')).toBeNull();
  });
});

describe('lastAgentStatus', () => {
  it('is EXPEDIE for STANDARD (default)', () => {
    expect(lastAgentStatus()).toBe('EXPEDIE');
    expect(lastAgentStatus('STANDARD')).toBe('EXPEDIE');
  });

  it('is ACHETE for INSTANTANE', () => {
    expect(lastAgentStatus('INSTANTANE')).toBe('ACHETE');
  });
});

describe('isAwaitingBuyerConfirmation', () => {
  it('is true only at EXPEDIE for a STANDARD mission', () => {
    expect(isAwaitingBuyerConfirmation('EXPEDIE')).toBe(true);
    expect(isAwaitingBuyerConfirmation('ACHETE')).toBe(false);
    expect(isAwaitingBuyerConfirmation('EXPEDIE', 'STANDARD')).toBe(true);
  });

  it('is true only at ACHETE for an INSTANTANE mission', () => {
    expect(isAwaitingBuyerConfirmation('ACHETE', 'INSTANTANE')).toBe(true);
    expect(isAwaitingBuyerConfirmation('EXPEDIE', 'INSTANTANE')).toBe(false);
    expect(isAwaitingBuyerConfirmation('EN_ACHAT', 'INSTANTANE')).toBe(false);
  });
});

describe('isTerminalMissionStatus', () => {
  it('is true for LIVRE, AUTO_LIVRE, LITIGE regardless of fulfillment type', () => {
    expect(isTerminalMissionStatus('LIVRE')).toBe(true);
    expect(isTerminalMissionStatus('AUTO_LIVRE')).toBe(true);
    expect(isTerminalMissionStatus('LITIGE')).toBe(true);
  });

  it('is false for any agent-settable status', () => {
    expect(isTerminalMissionStatus('RECU')).toBe(false);
    expect(isTerminalMissionStatus('ACHETE')).toBe(false);
    expect(isTerminalMissionStatus('EXPEDIE')).toBe(false);
  });
});
