import type { PlanTier } from '@/types/database';

export interface PlanConfig {
  id: Exclude<PlanTier, 'free_trial'>;
  name: string;
  tagline: string;
  priceInr: number;
  priceUsd: number;
  storageLimitBytes: number;
  storageLabel: string;
  maxProjects: number;
  maxTeamMembers: number;
  recommended?: boolean;
  features: string[];
}

const GB = 1024 * 1024 * 1024;

export const SAAS_PLANS: Record<Exclude<PlanTier, 'free_trial'>, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'For solo photographers & small studios',
    priceInr: 999,
    priceUsd: 19,
    storageLimitBytes: 50 * GB,
    storageLabel: '50 GB Storage',
    maxProjects: 50,
    maxTeamMembers: 5,
    features: [
      'Up to 50 projects',
      '5 team members (admin & editors)',
      '50 GB photo & video storage',
      'Client portal, invoices & digital signatures',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Best for growing wedding & event studios',
    priceInr: 2499,
    priceUsd: 39,
    storageLimitBytes: 250 * GB,
    storageLabel: '250 GB Storage',
    maxProjects: 500,
    maxTeamMembers: 15,
    recommended: true,
    features: [
      'Up to 500 projects',
      '15 team members',
      '250 GB photo & video storage',
      'Custom studio logo, brand colors & reports',
    ],
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    tagline: 'For high-volume multi-team agencies',
    priceInr: 4999,
    priceUsd: 79,
    storageLimitBytes: 1024 * GB,
    storageLabel: '1 TB Storage',
    maxProjects: 10000,
    maxTeamMembers: 100,
    features: [
      'Up to 10,000 projects',
      '100 team members',
      '1 TB photo & video storage',
      'Priority onboarding & full audit logs',
    ],
  },
};

export function getPlanConfig(plan: string): PlanConfig | null {
  if (plan === 'starter' || plan === 'pro' || plan === 'studio') {
    return SAAS_PLANS[plan];
  }
  return null;
}
