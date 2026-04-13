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
    label: "Question Bank",
    description: "Create and manage assessment questions, review status, and version history.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/role-families",
    label: "Role Families",
    description: "Define job profiles and set how much each skill area matters per role.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/scoring",
    label: "Scoring Setup",
    description: "Configure how assessments are scored and publish scoring models.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/assessment-configuration",
    label: "Assessment Builder",
    description: "Set up test versions, section order, consent screens, and timing rules.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/kpis",
    label: "KPI Tracking",
    description: "Link performance indicators to roles and track real-world outcomes.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/validity",
    label: "Assessment Quality",
    description: "Check whether assessments are accurate, reliable, and fair across groups.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/multi-rater",
    label: "360 Feedback Setup",
    description: "Set up multi-rater feedback by assigning peers, managers, and direct reports.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/development",
    label: "Development Plans",
    description: "Configure growth plans, skill gap defaults, and reassessment triggers.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Add users, assign roles, and manage account access.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/campaigns",
    label: "Campaigns",
    description: "Create test campaigns, send invitations, and schedule reminders.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/administered-tests",
    label: "Direct Test Links",
    description: "Generate one-off candidate links and track completion status.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/reports",
    label: "Reports",
    description: "Customise report templates, branding, and distribution rules.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/compliance",
    label: "Privacy & Audit",
    description: "Review consent records, data requests, and activity logs.",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/admin/system-health",
    label: "System Health",
    description: "Monitor assessment quality signals and operational readiness.",
    roles: ["SUPER_ADMIN"],
  },
];

export const TEAM_TABS: NavItem[] = [
  {
    href: "/team",
    label: "My Team",
    description: "See how your direct reports performed, their strengths, and areas for growth.",
    roles: ["MANAGER", "SUPER_ADMIN", "HR_ADMIN"],
  },
];

export const ASSESSOR_TABS: NavItem[] = [
  {
    href: "/assessor",
    label: "Test Delivery",
    description: "Send assessment links, monitor campaign progress, and track completions.",
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
      label: "Home",
      description: "Your personalised overview based on your role.",
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
