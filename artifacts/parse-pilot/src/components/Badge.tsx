import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "destructive" | "draft" | "analyzed" | "exported"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive/10 text-destructive",
    success: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    outline: "text-foreground",
    draft: "border-transparent bg-slate-100 text-slate-600 border border-slate-200",
    analyzed: "border-transparent bg-primary/10 text-primary border border-primary/20",
    exported: "border-transparent bg-emerald-500/15 text-emerald-700 border border-emerald-500/20",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
