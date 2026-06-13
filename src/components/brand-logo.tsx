import { cn } from "@/lib/utils";

export const SOLE_LOGO = "/brand/sole-logo.png";

const sizes = {
  header: "h-7 w-auto max-w-[96px] object-contain object-left",
  hero: "h-[52px] lg:h-[60px] w-auto max-w-[280px] object-contain object-left",
  form: "h-[44px] w-auto max-w-[240px] object-contain object-left",
  mobile: "h-[40px] w-auto max-w-[220px] object-contain object-left",
} as const;

const frames = {
  header: "",
  hero: "rounded-2xl border border-white/80 bg-white/75 backdrop-blur-sm px-5 py-3 shadow-sm",
  form: "",
  mobile: "rounded-2xl border border-slate-200/70 bg-white/95 px-5 py-3.5 shadow-[0_12px_40px_-24px_oklch(0.45_0.08_270/0.35)]",
} as const;

export function BrandLogo({
  variant = "form",
  className,
}: {
  variant?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <div className={cn("w-fit shrink-0", frames[variant], className)}>
      <img
        src={SOLE_LOGO}
        alt="SOLE Management Consulting Group"
        className={sizes[variant]}
        draggable={false}
      />
    </div>
  );
}
