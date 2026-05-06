import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import AccountsPage from "@/app/accounts/page";
import ImagePage from "@/app/image/page";
import AppShell from "@/app/layout";
import LoginPage from "@/app/login/page";
import HomePage from "@/app/page";
import UserLoginPage from "@/app/user-login/page";
import RequestsPage from "@/app/requests/page";
import SettingsPage from "@/app/settings/page";
import StartupCheckPage from "@/app/startup-check/page";
import SiteUsersPage from "@/app/site-users/page";
import ForbiddenWordsPage from "@/app/forbidden-words/page";
import { login } from "@/lib/api";
import { clearStoredAuthKey, getStoredAuthKey } from "@/store/auth";
import { getCurrentSiteUser } from "@/store/site-user-auth";

function AdminGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "allowed" | "blocked">("checking");

  useEffect(() => {
    let disposed = false;

    const checkAccess = async () => {
      const authKey = await getStoredAuthKey();
      if (!authKey) {
        if (!disposed) {
          setStatus("blocked");
        }
        return;
      }
      try {
        await login(authKey);
        if (!disposed) {
          setStatus("allowed");
        }
      } catch {
        await clearStoredAuthKey();
        if (!disposed) {
          setStatus("blocked");
        }
      }
    };

    void checkAccess();
    return () => {
      disposed = true;
    };
  }, [location.pathname]);

  if (status === "blocked") {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  if (status === "checking") {
    return null;
  }
  return <>{children}</>;
}

function WorkspaceUserGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let disposed = false;
    const check = async () => {
      const user = await getCurrentSiteUser();
      if (!disposed) {
        setAllowed(Boolean(user && !user.disabled));
      }
    };
    void check();
    return () => {
      disposed = true;
    };
  }, [location.pathname]);

  if (allowed === null) {
    return null;
  }
  if (!allowed) {
    return <Navigate to={`/user-login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/user-login" element={<UserLoginPage />} />
        <Route path="/image" element={<Navigate to="/image/workspace" replace />} />
        <Route path="/image/history" element={<WorkspaceUserGuard><ImagePage /></WorkspaceUserGuard>} />
        <Route path="/image/workspace" element={<WorkspaceUserGuard><ImagePage /></WorkspaceUserGuard>} />
        <Route path="/admin" element={<Navigate to="/admin/settings" replace />} />
        <Route path="/admin/accounts" element={<AdminGuard><AccountsPage /></AdminGuard>} />
        <Route path="/admin/site-users" element={<AdminGuard><SiteUsersPage /></AdminGuard>} />
        <Route path="/admin/forbidden-words" element={<AdminGuard><ForbiddenWordsPage /></AdminGuard>} />
        <Route path="/admin/settings" element={<AdminGuard><SettingsPage /></AdminGuard>} />
        <Route path="/admin/requests" element={<AdminGuard><RequestsPage /></AdminGuard>} />
        <Route path="/accounts" element={<Navigate to="/admin/accounts" replace />} />
        <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
        <Route path="/startup-check" element={<StartupCheckPage />} />
        <Route path="/requests" element={<Navigate to="/admin/requests" replace />} />
      </Routes>
    </AppShell>
  );
}
