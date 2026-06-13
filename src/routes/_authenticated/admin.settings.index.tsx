import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings/")({
  component: () => <Navigate to="/admin/settings/accounts" replace />,
});
