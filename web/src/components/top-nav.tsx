"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, Ban, ChevronLeft, ImageIcon, LogOut, PanelLeftClose, PanelLeftOpen, Settings2, Shield, Users } from "lucide-react";

import { fetchVersionInfo } from "@/lib/api";
import { clearStoredAuthKey } from "@/store/auth";
import { cn } from "@/lib/utils";
import { ThemeToggleButton } from "@/components/theme-toggle-button";

function formatVersionLabel(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "读取中";
  }

  const semanticMatch = normalized.match(/v?(\d+\.\d+\.\d+)/i);
  if (semanticMatch?.[1]) {
    return `v${semanticMatch[1]}`;
  }

  return normalized;
}

const workspaceNavItems = [
  { href: "/image/workspace", matchPrefix: "/image", label: "文生图工作台", description: "仅文本生成图片", icon: ImageIcon },
  { href: "/admin/settings", matchPrefix: "/admin", label: "管理页面", description: "进入账号与配置管理", icon: Settings2 },
] as const;

const adminNavItems = [
  { href: "/admin/accounts", matchPrefix: "/admin/accounts", label: "账号管理", description: "号池、额度与同步", icon: Shield },
  { href: "/admin/site-users", matchPrefix: "/admin/site-users", label: "网站用户", description: "网站登录账号与额度", icon: Users },
  { href: "/admin/forbidden-words", matchPrefix: "/admin/forbidden-words", label: "违禁词管理", description: "图片提示词黑名单维护", icon: Ban },
  { href: "/admin/settings", matchPrefix: "/admin/settings", label: "配置管理", description: "模式、接口与后端配置", icon: Settings2 },
  { href: "/admin/requests", matchPrefix: "/admin/requests", label: "调用请求", description: "查看官方与 CPA 请求方向", icon: Activity },
] as const;

function BrandCopy({ subtitle }: { subtitle: string }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-semibold tracking-tight text-stone-900 dark:text-[var(--studio-text-strong)]">
        image2 webui
      </span>
      <span className="block truncate text-xs text-stone-500 dark:text-[var(--studio-text)]">
        {subtitle}
      </span>
    </span>
  );
}

function isNavItemActive(pathname: string, href: string, matchPrefix?: string) {
  if (matchPrefix) {
    return pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);
  }
  return pathname === href;
}

type DesktopTopNavProps = {
  pathname: string;
  defaultCollapsed: boolean;
  navItems: readonly { href: string; matchPrefix?: string; label: string; description: string; icon: ComponentType<{ className?: string }> }[];
  versionLabel: string;
  onLogout: () => Promise<void>;
};

function DesktopTopNav({ pathname, defaultCollapsed, navItems, versionLabel, onLogout }: DesktopTopNavProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside className={cn("hidden shrink-0 transition-[width] duration-200 lg:flex", collapsed ? "w-[92px]" : "w-[228px]")}>
      <div className="studio-shell flex h-full w-full flex-col p-3 transition-colors duration-200">
        <div className={cn("gap-2", collapsed ? "flex flex-col items-center" : "flex items-center justify-between")}>
          <div className={cn(collapsed ? "flex flex-col items-center gap-2" : "flex min-w-0 flex-1 items-center gap-3")}>
            <ThemeToggleButton
              className={cn(collapsed ? "size-11" : "size-10")}
              iconClassName={cn(collapsed ? "size-5" : "size-4")}
            />
            {!collapsed ? (
              <Link
                to="/image/workspace"
                className="min-w-0 flex-1 rounded-md px-2 py-2 transition hover:bg-stone-100/80 dark:hover:bg-[var(--studio-panel-soft)]"
              >
                <BrandCopy subtitle="浅色 / 深黑主题切换" />
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            className={cn(
              "studio-btn inline-flex items-center justify-center",
              collapsed ? "size-11" : "size-10",
            )}
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "展开导航" : "收起导航"}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="mt-4 space-y-1">
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href, item.matchPrefix);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "studio-nav-item flex",
                  collapsed ? "justify-center px-0 py-3.5" : "items-center gap-3 px-3 py-3",
                  active
                    ? "studio-nav-item-active"
                    : "text-stone-600 hover:bg-white/65 hover:text-stone-900 dark:text-[var(--studio-text)] dark:hover:bg-[#303030] dark:hover:text-[var(--studio-text-strong)]",
                )}
                title={collapsed ? item.label : undefined}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-md",
                    collapsed ? "size-11" : "size-9",
                    active
                      ? "bg-stone-950 text-white dark:bg-[var(--studio-accent-strong)] dark:text-[var(--studio-accent-foreground)]"
                      : "bg-white/80 text-stone-600 dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text)]",
                  )}
                >
                  <Icon className={cn(collapsed ? "size-5" : "size-4")} />
                </span>
                {!collapsed ? (
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-stone-500 dark:text-[var(--studio-text)]">{item.description}</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div
            className={cn(
              "block rounded-md bg-stone-100/90 text-xs text-stone-500 shadow-none dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text)]",
              collapsed ? "px-2 py-3 text-center" : "px-4 py-3",
            )}
          >
            {!collapsed ? <div className="font-medium text-stone-700 dark:text-[var(--studio-text)]">版本</div> : null}
            <div className={cn(!collapsed ? "mt-1" : "font-medium")}>{versionLabel}</div>
          </div>
          <button
            type="button"
            className={cn(
              "studio-btn flex w-full items-center text-sm font-medium text-stone-600 hover:text-stone-800 dark:text-[var(--studio-text)] dark:hover:text-[var(--studio-text-strong)]",
              collapsed ? "justify-center px-0 py-3" : "justify-center gap-2 px-4 py-3",
            )}
            onClick={() => void onLogout()}
            title={collapsed ? "退出登录" : undefined}
          >
            <LogOut className="size-4" />
            {!collapsed ? "退出登录" : null}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function TopNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isImageRoute = pathname === "/image" || pathname?.startsWith("/image/");
  const isAdminRoute = pathname === "/admin" || pathname?.startsWith("/admin/");
  const navItems = isAdminRoute ? adminNavItems : workspaceNavItems;
  const isMobileWorkspaceRoute = pathname === "/image/workspace";
  const [versionLabel, setVersionLabel] = useState("读取中");
  const [mobileNavExpanded, setMobileNavExpanded] = useState(false);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
  const [mobileWorkspaceHeaderHeight, setMobileWorkspaceHeaderHeight] = useState(0);
  const [mobileWorkspaceTitle, setMobileWorkspaceTitle] = useState<string | null>(null);
  const mobileFallbackHeaderHeight = 72;
  const mobileFallbackWorkspaceHeaderHeight = 70;
  const mobileHeaderRef = useRef<HTMLElement | null>(null);
  const mobileWorkspaceHeaderRef = useRef<HTMLDivElement | null>(null);
  const setMobileHeaderRef = (node: HTMLElement | null) => {
    mobileHeaderRef.current = node;
  };

  useEffect(() => {
    let cancelled = false;

    const loadVersion = async () => {
      try {
        const payload = await fetchVersionInfo();
        if (!cancelled) {
          setVersionLabel(formatVersionLabel(payload.version));
        }
      } catch {
        if (!cancelled) {
          setVersionLabel("未知版本");
        }
      }
    };

    void loadVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileNavExpanded(false);
  }, [pathname]);

  useEffect(() => {
    const element = mobileHeaderRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setMobileHeaderHeight(element.offsetHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(element);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [mobileNavExpanded, pathname, isMobileWorkspaceRoute]);

  useEffect(() => {
    if (!isMobileWorkspaceRoute) {
      setMobileWorkspaceHeaderHeight(0);
      return;
    }

    const element = mobileWorkspaceHeaderRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setMobileWorkspaceHeaderHeight(element.offsetHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(element);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [isMobileWorkspaceRoute, mobileWorkspaceTitle]);

  useEffect(() => {
    if (!isImageRoute) {
      setMobileWorkspaceTitle(null);
      return;
    }

    const handleWorkspaceTitle = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string | null }>).detail;
      setMobileWorkspaceTitle(detail?.title ? String(detail.title) : null);
    };

    window.addEventListener("image2-webui:mobile-workspace-title", handleWorkspaceTitle as EventListener);
    return () => {
      window.removeEventListener("image2-webui:mobile-workspace-title", handleWorkspaceTitle as EventListener);
    };
  }, [isImageRoute]);

  const handleLogout = async () => {
    await clearStoredAuthKey();
    setMobileNavExpanded(false);
    if (isAdminRoute) {
      navigate("/login", { replace: true });
      return;
    }
    navigate("/image/workspace", { replace: true });
  };

  if (pathname === "/login" || pathname === "/login.html" || pathname.startsWith("/login/")) {
    return null;
  }

  return (
    <>
      <div
        className="lg:hidden"
        style={{
          height: isMobileWorkspaceRoute
            ? Math.max(mobileWorkspaceHeaderHeight, mobileFallbackWorkspaceHeaderHeight) + (mobileNavExpanded ? Math.max(mobileHeaderHeight, mobileFallbackHeaderHeight) : 0)
            : Math.max(mobileHeaderHeight, mobileFallbackHeaderHeight),
        }}
      />
      {!isMobileWorkspaceRoute ? (
        <header ref={setMobileHeaderRef} className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(env(safe-area-inset-top),0px)] lg:hidden">
        <div className="studio-shell p-3 transition-colors duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ThemeToggleButton className="size-10 shrink-0" />
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center rounded-md px-1 py-1 text-left transition hover:bg-white/70 dark:hover:bg-[var(--studio-panel-soft)]"
                onClick={() => setMobileNavExpanded((current) => !current)}
                aria-label={mobileNavExpanded ? "收起导航" : "展开导航"}
              >
                <BrandCopy subtitle={mobileNavExpanded ? "点击收起导航" : "点击展开导航"} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/image/history"
                className="hidden rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 shadow-sm dark:border-[var(--studio-border)] dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text)] sm:inline-flex"
              >
                {navItems.find((item) => isNavItemActive(pathname, item.href, item.matchPrefix))?.label ?? "导航"}
              </Link>
              <button
                type="button"
                className="studio-btn inline-flex size-10 shrink-0 items-center justify-center"
                onClick={() => setMobileNavExpanded((current) => !current)}
                aria-label={mobileNavExpanded ? "收起导航" : "展开导航"}
                title={mobileNavExpanded ? "收起导航" : "展开导航"}
              >
                {mobileNavExpanded ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </button>
              <button
                type="button"
                className="studio-btn inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-medium text-stone-600 hover:text-stone-800 dark:text-[var(--studio-text)] dark:hover:text-[var(--studio-text-strong)]"
                onClick={() => void handleLogout()}
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">退出</span>
              </button>
            </div>
          </div>

          {mobileNavExpanded ? (
            <nav className="hide-scrollbar mt-3 -mx-1 overflow-x-auto px-1">
              <div className="inline-flex min-w-full gap-2 rounded-lg bg-white/55 p-1">
                {navItems.map((item) => {
                  const active = isNavItemActive(pathname, item.href, item.matchPrefix);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex min-w-[104px] shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-white text-stone-950 shadow-sm dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text-strong)]"
                          : "text-stone-600 hover:bg-white/75 hover:text-stone-900 dark:text-[var(--studio-text)] dark:hover:bg-[var(--studio-panel-soft)] dark:hover:text-[var(--studio-text-strong)]",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </div>
        </header>
      ) : null}
      {isMobileWorkspaceRoute ? (
        <div
          ref={mobileWorkspaceHeaderRef}
          className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(env(safe-area-inset-top),0px)] lg:hidden"
          style={{ top: mobileNavExpanded ? Math.max(mobileHeaderHeight, mobileFallbackHeaderHeight) : 0 }}
        >
          <div className="studio-shell min-w-0 p-3 transition-colors duration-200">
            <div className="flex min-w-0 items-center gap-2">
              {isAdminRoute ? (
                <button
                  type="button"
                  onClick={() => navigate("/image/workspace", { replace: true })}
                  className="studio-btn inline-flex h-10 shrink-0 items-center gap-2 px-4"
                >
                  <ChevronLeft className="size-4" />
                  返回工作台
                </button>
              ) : null}
              {!isAdminRoute ? (
                <button
                  type="button"
                  onClick={() => navigate("/image/history")}
                  className="studio-btn inline-flex h-10 shrink-0 items-center gap-2 px-4"
                >
                  历史对话
                </button>
              ) : null}
              {!mobileNavExpanded ? (
                <>
                  <ThemeToggleButton className="ml-auto size-9 shrink-0 rounded-md" />
                  <button
                    type="button"
                    onClick={() => setMobileNavExpanded((current) => !current)}
                    className="studio-btn inline-flex size-9 shrink-0 items-center justify-center shadow-none"
                    aria-label="显示导航"
                    title="显示导航"
                  >
                    <PanelLeftOpen className="size-4" />
                  </button>
                </>
              ) : null}
            </div>
            {mobileWorkspaceTitle ? (
              <div className="mt-3">
                <span className="inline-flex max-w-full truncate rounded-md bg-white/80 px-3 py-1 text-xs font-medium text-stone-600 dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text)]">
                  {mobileWorkspaceTitle}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {isMobileWorkspaceRoute && mobileNavExpanded ? (
        <div
          ref={setMobileHeaderRef}
          className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(env(safe-area-inset-top),0px)] lg:hidden"
        >
          <div className="studio-shell p-3 transition-colors duration-200">
            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="studio-btn inline-flex size-10 shrink-0 items-center justify-center"
                  onClick={() => setMobileNavExpanded(false)}
                  aria-label="收起导航"
                  title="收起导航"
                >
                  <PanelLeftClose className="size-4" />
                </button>
                <button
                  type="button"
                  className="studio-btn inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-medium text-stone-600 hover:text-stone-800 dark:text-[var(--studio-text)] dark:hover:text-[var(--studio-text-strong)]"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </div>
            </div>
            <nav className="hide-scrollbar mt-3 -mx-1 overflow-x-auto px-1">
              <div className="inline-flex min-w-full gap-2 rounded-lg bg-white/55 p-1">
                {navItems.map((item) => {
                  const active = isNavItemActive(pathname, item.href, item.matchPrefix);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex min-w-[104px] shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-white text-stone-950 shadow-sm dark:bg-[var(--studio-panel-soft)] dark:text-[var(--studio-text-strong)]"
                          : "text-stone-600 hover:bg-white/75 hover:text-stone-900 dark:text-[var(--studio-text)] dark:hover:bg-[var(--studio-panel-soft)] dark:hover:text-[var(--studio-text-strong)]",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      ) : null}
      <DesktopTopNav
        key={isImageRoute ? "image-route" : "non-image-route"}
        pathname={pathname}
        defaultCollapsed={isImageRoute}
        navItems={navItems}
        versionLabel={versionLabel}
        onLogout={handleLogout}
      />
    </>
  );
}
