"use client";

import { Moon, Sun, Monitor, Download, Upload, Trash2, LogOut } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/lib/auth/AuthContext";
import { useLocalUser } from "@/lib/local/useLocalUser";
import { getAllForExport, importAll, wipeAllData } from "@/lib/local/repo";
import { useTheme } from "@/lib/theme/ThemeContext";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const username = useLocalUser();
  const { theme, setTheme } = useTheme();

  const exportData = async () => {
    if (!username) return;
    const data = await getAllForExport(username);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `classvault-backup-${username}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    if (!username) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await importAll(username, data);
      alert("Backup imported. Reloading…");
      window.location.reload();
    } catch {
      alert("That file doesn't look like a valid ClassVault backup.");
    }
  };

  const clearAll = async () => {
    if (!username) return;
    if (!confirm("This permanently deletes every subject, lecture, note, and file in your account from the cloud. This cannot be undone. Continue?")) return;
    await wipeAllData(username);
    window.location.reload();
  };

  return (
    <div>
      <TopBar crumbs={["Workspace", "Settings"]} />
      <div className="px-8 pb-14 max-w-2xl space-y-6">
        <div className="card p-6">
          <h2 className="font-bold text-ink dark:text-white mb-1">Appearance</h2>
          <p className="text-sm text-muted mb-4">Choose how ClassVault looks on this device.</p>
          <div className="flex gap-2">
            {[
              { id: "light" as const, label: "Light", icon: Sun },
              { id: "dark" as const, label: "Dark", icon: Moon },
              { id: "system" as const, label: "System", icon: Monitor },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={theme === t.id ? "btn-primary text-sm flex-1 justify-center" : "btn-secondary text-sm flex-1 justify-center"}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-ink dark:text-white mb-1">Backup &amp; restore</h2>
          <p className="text-sm text-muted mb-4">
            Your data syncs to your account and is available on any device you log in from. Export a
            backup any time as extra peace of mind.
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm flex-1 justify-center" onClick={exportData}>
              <Download className="h-4 w-4" /> Export backup
            </button>
            <label className="btn-secondary text-sm flex-1 justify-center cursor-pointer">
              <Upload className="h-4 w-4" /> Import backup
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-ink dark:text-white mb-1">Account</h2>
          <p className="text-sm text-muted mb-4">
            Signed in as <span className="font-semibold">@{user?.username}</span>
          </p>
          <button className="btn-secondary text-sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>

        <div className="card p-6 border-red-200 dark:border-red-500/20">
          <h2 className="font-bold text-red-500 mb-1">Danger zone</h2>
          <p className="text-sm text-muted mb-4">
            Permanently delete all ClassVault data for this account from the cloud.
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-xl2 border border-red-200 dark:border-red-500/20 text-red-500 px-4 py-2.5 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            onClick={clearAll}
          >
            <Trash2 className="h-4 w-4" /> Delete all my data
          </button>
        </div>
      </div>
    </div>
  );
}