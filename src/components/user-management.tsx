"use client";

import type { UserRole } from "@prisma/client";
import { useDeferredValue, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format_date, format_role_label } from "@/lib/utils";

type UserTableRow = {
  created_at: string;
  email: string;
  id: string;
  is_active: boolean;
  last_login: string | null;
  name: string;
  role: UserRole;
};

const blank_form = {
  email: "",
  id: "",
  is_active: true,
  name: "",
  password: "",
  role: "CANDIDATE" as UserRole,
};

const all_roles: UserRole[] = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "ASSESSOR", "CANDIDATE", "RATER"];

export function UserManagement({
  current_user_role,
  initial_users,
}: {
  current_user_role: UserRole;
  initial_users: UserTableRow[];
}) {
  const [users, set_users] = useState(initial_users);
  const [form, set_form] = useState(blank_form);
  const [message, set_message] = useState("");
  const [csv_text, set_csv_text] = useState("");
  const [import_errors, set_import_errors] = useState<Array<{ line_number: number; message: string }>>([]);
  const [import_summary, set_import_summary] = useState("");
  const [search, set_search] = useState("");
  const [is_pending, start_transition] = useTransition();
  const deferred_search = useDeferredValue(search);
  const available_roles = current_user_role === "SUPER_ADMIN" ? all_roles : all_roles.filter((role) => role !== "SUPER_ADMIN");

  const filtered_users = users.filter((user) => {
    const haystack = `${user.name} ${user.email} ${user.role}`.toLowerCase();
    return haystack.includes(deferred_search.toLowerCase());
  });

  function update_form(field: keyof typeof blank_form, value: string | boolean) {
    set_form((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function refresh_users() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const payload = (await response.json()) as { message?: string; users?: UserTableRow[] };

    if (!response.ok || !payload.users) {
      set_message(payload.message ?? "Unable to refresh users.");
      return;
    }

    set_users(payload.users);
  }

  function handle_submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    set_message("");

    start_transition(async () => {
      const payload = {
        email: form.email,
        is_active: form.is_active,
        name: form.name,
        password: form.password,
        role: form.role,
      };

      const is_edit = Boolean(form.id);
      const response = await fetch(is_edit ? `/api/admin/users/${form.id}` : "/api/admin/users", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: is_edit ? "PATCH" : "POST",
      });

      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        set_message(json.message ?? "Unable to save user.");
        return;
      }

      set_message(json.message ?? (is_edit ? "User updated." : "User created."));
      set_form(blank_form);
      await refresh_users();
    });
  }

  function handle_edit(user: UserTableRow) {
    set_form({
      email: user.email,
      id: user.id,
      is_active: user.is_active,
      name: user.name,
      password: "",
      role: user.role,
    });
    set_message(`Editing ${user.name}. Leave password blank to keep the current password.`);
  }

  function handle_toggle_active(user: UserTableRow, next_value: boolean) {
    start_transition(async () => {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        body: JSON.stringify({ is_active: next_value }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        set_message(json.message ?? "Unable to update activation state.");
        return;
      }

      set_message(json.message ?? "User updated.");
      await refresh_users();
    });
  }

  async function load_file(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    set_csv_text(await file.text());
  }

  function handle_bulk_import() {
    set_import_errors([]);
    set_import_summary("");

    start_transition(async () => {
      const response = await fetch("/api/admin/users/bulk-import", {
        body: JSON.stringify({ csv_text }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as {
        errors?: Array<{ line_number: number; message: string }>;
        message?: string;
      };

      if (!response.ok) {
        set_import_errors(payload.errors ?? []);
        set_import_summary(payload.message ?? "Bulk import failed.");
        return;
      }

      set_import_errors(payload.errors ?? []);
      set_import_summary(payload.message ?? "Bulk import completed.");
      set_csv_text("");
      await refresh_users();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge tone="red">Step 1 complete area</Badge>
              <CardTitle className="mt-3">User directory and controls</CardTitle>
              <CardDescription>
                Manage users, role assignment, activation state, and last-login visibility for the current organisation.
              </CardDescription>
            </div>
            <div className="w-full max-w-sm">
              <input
                className="w-full rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none transition focus:border-brand-red"
                onChange={(event) => set_search(event.target.value)}
                placeholder="Search by name, email, or role"
                type="search"
                value={search}
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-left">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-brand-black/55">
                  <th className="px-3">Name</th>
                  <th className="px-3">Role</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Last login</th>
                  <th className="px-3">Created</th>
                  <th className="px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered_users.map((user) => (
                  <tr className="rounded-[1.4rem] bg-brand-grey" key={user.id}>
                    <td className="rounded-l-[1.4rem] px-3 py-4 align-top">
                      <p className="font-semibold">{user.name}</p>
                      <p className="mt-1 text-sm text-brand-black/65">{user.email}</p>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <Badge tone={user.role === "SUPER_ADMIN" ? "red" : "neutral"}>{format_role_label(user.role)}</Badge>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <Badge tone={user.is_active ? "success" : "neutral"}>{user.is_active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-3 py-4 align-top text-sm text-brand-black/70">{format_date(user.last_login)}</td>
                    <td className="px-3 py-4 align-top text-sm text-brand-black/70">{format_date(user.created_at)}</td>
                    <td className="rounded-r-[1.4rem] px-3 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handle_edit(user)} type="button" variant="outline">
                          Edit
                        </Button>
                        <Button
                          disabled={is_pending || user.role === "SUPER_ADMIN"}
                          onClick={() => handle_toggle_active(user, !user.is_active)}
                          type="button"
                          variant={user.is_active ? "danger" : "secondary"}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk import users</CardTitle>
            <CardDescription>
              Paste CSV or upload a file with headers <span className="font-semibold text-brand-black">name,email,role,password,is_active</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input accept=".csv,text/csv" className="block w-full text-sm" onChange={load_file} type="file" />
            <textarea
              className="min-h-48 w-full rounded-[1.5rem] border border-brand-black/15 bg-brand-grey px-4 py-4 outline-none transition focus:border-brand-red"
              onChange={(event) => set_csv_text(event.target.value)}
              placeholder={"name,email,role,password,is_active\nAsha Singh,asha.singh@example.com,MANAGER,Password@123,true"}
              value={csv_text}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={is_pending || !csv_text.trim()} onClick={handle_bulk_import} type="button">
                {is_pending ? "Importing..." : "Run bulk import"}
              </Button>
              {import_summary ? <p className="text-sm text-brand-black/70">{import_summary}</p> : null}
            </div>

            {import_errors.length > 0 ? (
              <div className="rounded-[1.5rem] border border-brand-red/25 bg-brand-red/8 p-4">
                <p className="font-semibold text-brand-red">Line-level import errors</p>
                <ul className="mt-3 space-y-2 text-sm text-brand-black/80">
                  {import_errors.map((error) => (
                    <li key={`${error.line_number}-${error.message}`}>
                      Line {error.line_number}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Edit user" : "Create user"}</CardTitle>
          <CardDescription>
            Use this form for individual user CRUD. HR Admin can manage all non-super-admin accounts; Super Admin can manage every role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handle_submit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Full name</span>
              <input
                className="w-full rounded-[1.25rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none transition focus:border-brand-red"
                onChange={(event) => update_form("name", event.target.value)}
                required
                type="text"
                value={form.name}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Email</span>
              <input
                className="w-full rounded-[1.25rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none transition focus:border-brand-red"
                onChange={(event) => update_form("email", event.target.value)}
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Role</span>
              <select
                className="w-full rounded-[1.25rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none transition focus:border-brand-red"
                onChange={(event) => update_form("role", event.target.value)}
                value={form.role}
              >
                {available_roles.map((role) => (
                  <option key={role} value={role}>
                    {format_role_label(role)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">{form.id ? "New password (optional)" : "Password"}</span>
              <input
                className="w-full rounded-[1.25rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none transition focus:border-brand-red"
                minLength={8}
                onChange={(event) => update_form("password", event.target.value)}
                required={!form.id}
                type="password"
                value={form.password}
              />
            </label>

            <label className="flex items-center gap-3 rounded-[1.25rem] bg-brand-grey px-4 py-3">
              <input checked={form.is_active} onChange={(event) => update_form("is_active", event.target.checked)} type="checkbox" />
              <span className="text-sm font-semibold">Account is active</span>
            </label>

            {message ? <p className="rounded-[1rem] bg-brand-grey px-4 py-3 text-sm text-brand-black/75">{message}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending} type="submit">
                {form.id ? "Save changes" : "Create user"}
              </Button>
              <Button
                onClick={() => {
                  set_form(blank_form);
                  set_message("");
                }}
                type="button"
                variant="outline"
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
