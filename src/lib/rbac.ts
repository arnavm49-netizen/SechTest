import type { UserRole } from "@prisma/client";

export type NavItem = {
  description: string;
  href: string;
  label: string;
  roles: UserRole[];
};

export const ADMIN_TABS: NavItem[] = [
  {
    href: "/admin/question-bank",
    label: "Question Bank Manager",
    description: "Item authoring, version control, review workflow, and exposure controls.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/role-families",
    label: "Role Family Manager",
    description: "Role-family definitions, weight matrices, and publish controls.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/scoring",
    label: "Scoring Configuration",
    description: "Classical scoring, IRT readiness, and publish/version governance.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/assessment-configuration",
    label: "Assessment Configuration",
    description: "Assessment versions, section ordering, consent, and runtime rules.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/kpis",
    label: "KPI Management",
    description: "Role-family KPI mapping and downstream outcome linkage.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/validity",
    label: "Validity Dashboard",
    description: "Criterion, construct, reliability, and adverse-impact evidence.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/multi-rater",
    label: "360 Configuration",
    description: "Rater workflows, calibration steps, and relationship settings.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/development",
    label: "Development Plan Configuration",
    description: "Gap-to-intervention mapping, IDP defaults, and reassessment triggers.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/users",
    label: "User Management",
    description: "User CRUD, role assignment, activation controls, and bulk import.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/campaigns",
    label: "Campaigns",
    description: "Invite templates, reminder cadences, and campaign administration.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/reports",
    label: "Reports Configuration",
    description: "Report templates, branding, and distribution rules.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/compliance",
    label: "Compliance and Audit",
    description: "DPDP controls, consent records, and immutable activity trails.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/system-health",
    label: "System Health",
    description: "Environment status, service checks, and operational readiness.",
    roles: ["SUPER_ADMIN"],
  },
];

export const TEAM_TABS: NavItem[] = [
  {
    href: "/team",
    label: "Team Workspace",
    description: "Assessment status, role-fit views, heatmaps, and development tracking.",
    roles: ["MANAGER", "SUPER_ADMIN", "HR_ADMIN"],
  },
];

export const ASSESSOR_TABS: NavItem[] = [
  {
    href: "/assessor",
    label: "Assessor Workspace",
    description: "Campaign monitoring, invite operations, and export-ready progress views.",
    roles: ["ASSESSOR", "SUPER_ADMIN", "HR_ADMIN"],
  },
];

export function can_access_admin(role: UserRole) {
  return role === "SUPER_ADMIN" || role === "HR_ADMIN";
}

export function can_access_system_health(role: UserRole) {
  return role === "SUPER_ADMIN";
}

export function can_manage_super_admins(actor_role: UserRole) {
  return actor_role === "SUPER_ADMIN";
}

export function can_access_team(role: UserRole) {
  return role === "MANAGER" || role === "SUPER_ADMIN" || role === "HR_ADMIN";
}

export function can_access_assessor_workspace(role: UserRole) {
  return role === "ASSESSOR" || role === "SUPER_ADMIN" || role === "HR_ADMIN";
}

export function get_admin_tabs_for_role(role: UserRole) {
  return ADMIN_TABS.filter((tab) => tab.roles.includes(role));
}

export function get_role_home(role: UserRole) {
  switch (role) {
    case "SUPER_ADMIN":
    case "HR_ADMIN":
      return "/admin";
    case "MANAGER":
      return "/team";
    case "ASSESSOR":
      return "/assessor";
    case "CANDIDATE":
      return "/candidate";
    case "RATER":
      return "/rater";
    default:
      return "/dashboard";
  }
}

export function get_primary_navigation(role: UserRole): NavItem[] {
  const base: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      description: "Role-aware launchpad for the current user.",
      roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "CANDIDATE", "RATER", "ASSESSOR"],
    },
  ];

  return [
    ...base.filter((item) => item.roles.includes(role)),
    ...get_admin_tabs_for_role(role),
    ...TEAM_TABS.filter((item) => item.roles.includes(role)),
    ...ASSESSOR_TABS.filter((item) => item.roles.includes(role)),
  ];
}
