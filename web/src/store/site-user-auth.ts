"use client";

import {
  consumeSiteUserQuota,
  createSiteUser as createSiteUserApi,
  deleteSiteUser as deleteSiteUserApi,
  fetchSiteUserMe,
  fetchSiteUsers,
  loginSiteUser as loginSiteUserApi,
  type SiteUser,
  updateSiteUser as updateSiteUserApi,
} from "@/lib/api";

const SESSION_TOKEN_KEY = "site_user_token";

export async function loginSiteUser(username: string, password: string) {
  const response = await loginSiteUserApi(username, password);
  localStorage.setItem(SESSION_TOKEN_KEY, response.token);
  return response.user;
}

export async function logoutSiteUser() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function getSiteUserToken() {
  return localStorage.getItem(SESSION_TOKEN_KEY) || "";
}

export async function getCurrentSiteUser() {
  const token = getSiteUserToken();
  if (!token) {
    return null;
  }
  try {
    const response = await fetchSiteUserMe(token);
    return response.user;
  } catch {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    return null;
  }
}

export function getSiteUserRemainingQuota(user: SiteUser | null) {
  if (!user) {
    return 0;
  }
  return Math.max(0, Number(user.total_quota || 0) - Number(user.used_quota || 0));
}

export async function consumeCurrentSiteUserQuota(amount: number) {
  const token = getSiteUserToken();
  if (!token) {
    throw new Error("当前未登录网站账号");
  }
  const response = await consumeSiteUserQuota(token, amount);
  return response.user;
}

export async function listSiteUsers() {
  const response = await fetchSiteUsers();
  return response.items;
}

export async function createSiteUser(payload: {
  username: string;
  password: string;
  totalQuota: number;
}) {
  const response = await createSiteUserApi({
    username: payload.username,
    password: payload.password,
    total_quota: payload.totalQuota,
  });
  return response.items;
}

export async function updateSiteUser(
  userId: string,
  payload: {
    password?: string;
    totalQuota?: number;
    usedQuota?: number;
    disabled?: boolean;
  },
) {
  const response = await updateSiteUserApi({
    id: userId,
    password: payload.password,
    total_quota: payload.totalQuota,
    used_quota: payload.usedQuota,
    disabled: payload.disabled,
  });
  return response.items;
}

export async function deleteSiteUser(userId: string) {
  const response = await deleteSiteUserApi(userId);
  return response.items;
}

export type { SiteUser };
