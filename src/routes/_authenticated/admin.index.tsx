import { createFileRoute } from "@tanstack/react-router";
import { MyDashboard } from "./my.index";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: MyDashboard,
});
