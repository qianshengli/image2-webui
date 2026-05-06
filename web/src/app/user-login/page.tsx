"use client";

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoaderCircle, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSiteUser } from "@/store/site-user-auth";

export default function UserLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password.trim()) {
      toast.error("请输入用户名和密码");
      return;
    }
    setIsSubmitting(true);
    try {
      await loginSiteUser(normalizedUsername, password);
      const redirect = searchParams.get("redirect");
      navigate(redirect?.startsWith("/image") ? redirect : "/image/workspace", {
        replace: true,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] w-full items-start justify-center px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 sm:min-h-full sm:items-center sm:px-0 sm:pt-0 sm:pb-0">
      <div className="w-full max-w-[440px] rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-md bg-stone-950 text-white">
            <UserRound className="size-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">网站账号登录</h1>
          </div>
        </div>
        <div className="space-y-3">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="用户名"
            className="h-11 rounded-md"
          />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="密码"
            className="h-11 rounded-md"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleLogin();
              }
            }}
          />
          <Button
            className="h-11 w-full rounded-md bg-stone-950 text-white hover:bg-stone-800"
            onClick={() => void handleLogin()}
            disabled={isSubmitting}
          >
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            进入工作台
          </Button>
        </div>
      </div>
    </div>
  );
}
