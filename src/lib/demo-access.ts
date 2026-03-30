import { UserRole } from "@prisma/client";
import { hash_password } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export const DEMO_SUPER_ADMIN_EMAIL = "superadmin@secheron.example.com";
export const DEMO_SUPER_ADMIN_NAME = "Aarav Kulkarni";
export const DEMO_PASSWORD = "Password@123";
export const DEMO_ORGANIZATION_NAME = "D&H Secheron Psychometrics";

const demo_dpdp_consent_template =
  "I consent to D&H Secheron collecting, processing, storing, and analysing my assessment responses and related employment data for hiring, development, validity analysis, and reporting in accordance with the DPDP Act 2023 and the organisation's privacy policy.";

const demo_organization_settings = {
  assessment_time_limit_minutes: 80,
  candidate_feedback_enabled: true,
  compliance: {
    candidate_feedback_enabled: true,
    challenge_process_enabled: true,
    data_fiduciary_registration_required: false,
    retention_raw_responses_months: 12,
    retention_scores_years: 5,
    self_service_access_enabled: true,
  },
  high_contrast_mode_enabled: true,
  locale_primary: "en-IN",
  locale_secondary: "hi-IN",
  multi_rater_config: {
    blind_spot_flag_threshold: 1.5,
    icc_threshold: 0.7,
    max_ratees_per_rater: 8,
    max_raters_per_subject: 8,
    min_raters_per_subject: 4,
  },
};

export function is_demo_super_admin_credentials(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_SUPER_ADMIN_EMAIL && password === DEMO_PASSWORD;
}

export async function ensure_demo_super_admin(options: {
  org_id?: string;
  reset_password?: boolean;
} = {}) {
  const organization =
    options.org_id
      ? await prisma.organization.findUnique({
          where: { id: options.org_id },
        })
      : await prisma.organization.findFirst({
          where: { deleted_at: null },
          orderBy: [{ created_at: "asc" }],
        }) ??
        (await prisma.organization.create({
          data: {
            dpdp_consent_template: demo_dpdp_consent_template,
            name: DEMO_ORGANIZATION_NAME,
            settings: demo_organization_settings,
          },
        }));

  if (!organization) {
    return null;
  }

  const password_hash = await hash_password(DEMO_PASSWORD);
  const existing_user = await prisma.user.findUnique({
    where: { email: DEMO_SUPER_ADMIN_EMAIL },
  });

  if (existing_user) {
    return prisma.user.update({
      where: { id: existing_user.id },
      data: {
        deleted_at: null,
        is_active: true,
        name: DEMO_SUPER_ADMIN_NAME,
        org_id: existing_user.org_id ?? organization.id,
        password_hash: options.reset_password === false ? existing_user.password_hash : password_hash,
        role: UserRole.SUPER_ADMIN,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: DEMO_SUPER_ADMIN_EMAIL,
      is_active: true,
      name: DEMO_SUPER_ADMIN_NAME,
      org_id: organization.id,
      password_hash,
      role: UserRole.SUPER_ADMIN,
    },
  });
}
