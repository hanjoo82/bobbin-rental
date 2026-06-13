import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { UserCog, Upload } from "lucide-react";
import { SegmentedTabs } from "./my";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsLayout,
});

const SUB_NAV = [
  { to: "/admin/settings/accounts", icon: UserCog, label: "소유주계정관리" },
  { to: "/admin/settings/upload", icon: Upload, label: "렌탈현황업로드" },
] as const;

function SettingsLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">설정</h1>
        <SegmentedTabs items={SUB_NAV} />
      </div>
      <Outlet />
    </div>
  );
}
