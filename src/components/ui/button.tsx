"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "danger" | "ghost" | "outline" | "primary" | "secondary";
  size?: "sm" | "default" | "lg";
};

export function Button({ className, variant = "primary", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red",
        "disabled:pointer-events-none disabled:opacity-40",
        "active:scale-[0.98]",

        size === "sm" && "h-8 rounded-lg px-3 text-[13px]",
        size === "default" && "h-10 rounded-xl px-5 text-sm",
        size === "lg" && "h-12 rounded-xl px-6 text-[15px]",

        variant === "primary" &&
          "bg-brand-black text-brand-white shadow-sm hover:bg-brand-black/85",
        variant === "secondary" &&
          "bg-brand-red text-brand-white shadow-sm hover:bg-brand-red/90",
        variant === "outline" &&
          "border border-brand-black/[0.12] bg-brand-white text-brand-black hover:bg-brand-grey",
        variant === "ghost" &&
          "text-brand-black/70 hover:bg-brand-black/[0.04] hover:text-brand-black",
        variant === "danger" &&
          "bg-red-50 text-brand-red hover:bg-red-100",

        className,
      )}
      {...props}
    />
  );
}
