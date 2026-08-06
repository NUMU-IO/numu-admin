/**
 * Pricing Plans configuration API service.
 */

import { apiClient } from "@/lib/apiClient";

export interface PlanFeature {
  en: string;
  ar: string;
}

export interface PlanConfig {
  key: string;
  name_en: string;
  name_ar: string;
  price_monthly: number; // EGP, -1 = custom
  price_annual: number;
  currency: string;
  cta: string; // try_demo, subscribe, contact
  popular: boolean;
  features: PlanFeature[];
}

export interface PromoConfig {
  code: string;
  text_en: string;
  text_ar: string;
}

export interface PricingPlansConfig {
  plans: PlanConfig[];
  promo?: PromoConfig;
}

export async function getPricingPlans(): Promise<PricingPlansConfig> {
  return apiClient<PricingPlansConfig>("/admin/landing-config/pricing-plans");
}

export async function updatePricingPlans(
  data: PricingPlansConfig,
): Promise<PricingPlansConfig> {
  return apiClient<PricingPlansConfig>("/admin/landing-config/pricing-plans", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── Signup & trial settings ────────────────────────────────────────────────
// Controls registration behaviour + landing visibility: the free-trial
// switch/length and whether the Pay-as-you-Grow card is injected into
// the public pricing payload (its commission % comes from Merchant
// Wallets → Settings, not from here).

export interface SignupSettings {
  trial_enabled: boolean;
  trial_days: number;
  trial_visible_on_landing: boolean;
  payg_visible_on_landing: boolean;
}

export async function getSignupSettings(): Promise<SignupSettings> {
  return apiClient<SignupSettings>("/admin/landing-config/signup");
}

export async function updateSignupSettings(
  patch: Partial<SignupSettings>,
): Promise<SignupSettings> {
  return apiClient<SignupSettings>("/admin/landing-config/signup", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
