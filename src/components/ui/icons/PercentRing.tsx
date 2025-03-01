import { cn } from "@/utils/shadcn";
import { HTMLAttributes } from "react";

interface PercentRingProps extends HTMLAttributes<SVGElement> {
  percent: number;
  size?: number;
  strokeWidth?: number;
  innerClassName?: string;
}

export default function PercentRing({
  percent,
  size = 18,
  strokeWidth = 3,
  innerClassName,
  className,
  ...props
}: PercentRingProps) {
  const normalizedPercent = Math.min(Math.max(percent, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${circumference}`;
  const strokeDashoffset = circumference * (1 - normalizedPercent);

  return (
    <svg width={size} height={size} className={className} {...props}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-border-primary"
      />
      {/* Foreground circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
        className={cn("stroke-accent-secondary transition-all duration-300", innerClassName)}
      />
    </svg>
  );
}
