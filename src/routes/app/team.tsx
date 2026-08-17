import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getBearerToken } from "@/lib/auth/client";
import { canManageTeam, ROLE_LABELS, TEAM_ROLES, type TeamRole } from "@/lib/core/roles";

export const Route = createFileRoute("/app/team")({
  component: TeamAdminPage,
});

type MemberRow = {
  id: string;
  email: string;
  role: TeamRole;
  roleLabel: string;
  linked: boolean;
  displayName: string | null;
  invitedBy: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const bearer = getBearerToken();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  } catch {
    /* optional */
  }
  return headers;
}

function TeamAdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("coach");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/members", {
        credentials: "include",
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed (${res.status})`);
      }
      const data = (await res.json()) as { members: MemberRow[] };
      setMembers(data.members);
    } catch (err) {
      toast.message(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (canManageTeam(user?.role)) void load();
  }, [isPending, user?.role, load]);

  if (isPending) return null;
  if (!user || !canManageTeam(user.role)) {
    return <Navigate to="/app" />;
  }

  async function invite() {
    setSaving(true);
    try {
      const res = await fetch("/api/team/members", {
        method: "POST",
        credentials: "include",
        headers: await authHeaders(),
        body: JSON.stringify({ email, role }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Invite failed");
      toast.success("Invite saved", {
        description: `${email.trim().toLowerCase()} → ${ROLE_LABELS[role]}`,
      });
      setEmail("");
      await load();
    } catch (err) {
      toast.message(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(id: string, next: TeamRole) {
    try {
      const res = await fetch("/api/team/members", {
        method: "PATCH",
        credentials: "include",
        headers: await authHeaders(),
        body: JSON.stringify({ id, role: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success("Role updated");
      await load();
    } catch (err) {
      toast.message(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this team member invite?")) return;
    try {
      const res = await fetch(`/api/team/members?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: await authHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Remove failed");
      toast.success("Removed");
      await load();
    } catch (err) {
      toast.message(err instanceof Error ? err.message : "Remove failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Admin</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Team</h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          Invite staff by email. They sign in with Google or X; the role attaches
          automatically. Parents can be invited but should use share links for teach
          reels.
        </p>
      </div>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold">Invite</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-xs text-fg-subtle">
            Email
            <Input
              className="mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@example.com"
            />
          </label>
          <label className="block text-xs text-fg-subtle sm:w-44">
            Role
            <select
              className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm text-fg focus-ring"
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
            >
              {TEAM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={saving || !email.trim()}
            onClick={() => void invite()}
          >
            {saving ? "Saving…" : "Save invite"}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Members</h2>
        {loading ? (
          <p className="text-sm text-fg-muted">Loading…</p>
        ) : members.length === 0 ? (
          <div className="panel p-6 text-sm text-fg-muted">
            No invites yet. Set <code className="text-fg">PLAYIQ_ADMIN_EMAILS</code> for
            bootstrap admins, or invite yourself first after signing in as an env admin.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-bg-subtle/50 text-xs uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Linked</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.email}</div>
                      {m.displayName ? (
                        <div className="text-xs text-fg-muted">{m.displayName}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="h-9 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm focus-ring"
                        value={m.role}
                        onChange={(e) => void changeRole(m.id, e.target.value as TeamRole)}
                      >
                        {TEAM_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {m.linked ? "Yes" : "Pending sign-in"}
                    </td>
                    <td className="px-4 py-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void remove(m.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
