"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "danger" | "ghost" | "outline" | "primary" | "secondary";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "border-brand-red bg-brand-red text-brand-white hover:border-brand-black hover:bg-brand-black",
        variant === "secondary" && "border-brand-black bg-brand-black text-brand-white hover:border-brand-red hover:bg-brand-red",
        variant === "outline" && "border-brand-black bg-brand-white text-brand-black hover:border-brand-red hover:text-brand-red",
        variant === "ghost" && "border-transparent bg-transparent text-brand-black hover:text-brand-red",
        variant === "danger" && "border-brand-red bg-brand-white text-brand-red hover:bg-brand-red hover:text-brand-white",
        className,
      )}
      {...props}
    />
  );
}
