import { createFileRoute } from "@tanstack/react-router";
import { MyRenters } from "./my.renters";

export const Route = createFileRoute("/_authenticated/admin/renters")({
  component: MyRenters,
});
