import { cn } from "@/lib/utils";

export const SOLE_MARK = "/brand/sole-mark.png";

const sizes = {
  header: "h-10 w-10",
  hero: "h-16 w-16 lg:h-20 lg:w-20",
  form: "h-14 w-14",
  mobile: "h-14 w-14",
} as const;

const frames = {
  header: "",
  hero: "rounded-2xl border border-white/80 bg-white/75 backdrop-blur-sm p-3.5 shadow-sm",
  form: "",
  mobile: "rounded-2xl border border-slate-200/70 bg-white/95 p-3.5 shadow-[0_12px_40px_-24px_oklch(0.45_0.08_270/0.35)]",
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
        src={SOLE_MARK}
        alt="SOLE"
        className={cn("object-contain", sizes[variant])}
        draggable={false}
      />
    </div>
  );
}
