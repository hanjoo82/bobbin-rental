import { createFileRoute } from "@tanstack/react-router";
import { MyTrendsPage } from "./my.trends";

export const Route = createFileRoute("/_authenticated/admin/trends")({
  component: MyTrendsPage,
});
