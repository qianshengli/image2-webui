"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSiteUser,
  deleteSiteUser,
  listSiteUsers,
  type SiteUser,
  updateSiteUser,
} from "@/store/site-user-auth";

export default function SiteUsersPage() {
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [quota, setQuota] = useState("20");

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const items = await listSiteUsers();
      setUsers(items);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const totalQuota = useMemo(
    () => users.reduce((sum, item) => sum + Math.max(0, item.total_quota - item.used_quota), 0),
    [users],
  );

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("请输入用户名和密码");
      return;
    }
    try {
      const items = await createSiteUser({
        username,
        password,
        totalQuota: Number(quota || 0),
      });
      setUsers(items);
      setUsername("");
      setPassword("");
      setQuota("20");
      toast.success("网站账号已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    }
  };

  return (
    <div className="h-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">网站用户管理</h1>
        <span className="text-sm text-stone-500">今日总剩余额度 {totalQuota}</span>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用户名" className="rounded-md" />
        <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码" className="rounded-md" />
        <Input value={quota} onChange={(event) => setQuota(event.target.value)} placeholder="日额度" className="rounded-md" />
        <Button className="rounded-md bg-stone-950 text-white hover:bg-stone-800" onClick={() => void handleCreate()}>
          <Plus className="size-4" />
          新增用户
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <LoaderCircle className="size-4 animate-spin" />
          加载中
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((item) => {
            const remaining = Math.max(0, item.total_quota - item.used_quota);
            return (
              <div key={item.id} className="grid items-center gap-2 rounded-md border border-stone-200 p-3 md:grid-cols-[1.1fr_1fr_1fr_auto_auto]">
                <div className="text-sm font-medium">{item.username}</div>
                <div className="text-xs text-stone-500">今日已用 {item.used_quota} / 日额度 {item.total_quota}</div>
                <div className="text-xs text-stone-500">今日剩余 {remaining}</div>
                <Button
                  variant="outline"
                  className="h-8 rounded-md"
                  onClick={async () => {
                    const next = await updateSiteUser(item.id, { disabled: !item.disabled });
                    setUsers(next);
                  }}
                >
                  {item.disabled ? "启用" : "禁用"}
                </Button>
                <Button
                  variant="outline"
                  className="h-8 rounded-md text-rose-600"
                  onClick={async () => {
                    const next = await deleteSiteUser(item.id);
                    setUsers(next);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
