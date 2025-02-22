import { cn } from "@/utils/shadcn";
import { SVGProps } from "react";

type SortState = "asc" | "desc" | false;

interface SortIconProps extends SVGProps<SVGSVGElement> {
  state: SortState;
}

export default function SortIcon({ state, className, ...props }: SortIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("h-6 w-6 shrink-0", className)} {...props}>
      <path
        className={state == "asc" ? "fill-gray-600" : "fill-gray-300"}
        d="M9.40988 10.25C9.24682 10.2499 9.08676 10.2127 8.94646 10.1422C8.80615 10.0716 8.69073 9.97039 8.61228 9.84904C8.53383 9.72769 8.49521 9.59067 8.50047 9.45232C8.50574 9.31397 8.55468 9.17936 8.64219 9.06255L11.2317 5.60788C11.3139 5.49821 11.4274 5.40791 11.5616 5.34535C11.6959 5.2828 11.8466 5.25 11.9997 5.25C12.1528 5.25 12.3035 5.2828 12.4377 5.34535C12.572 5.40791 12.6855 5.49821 12.7677 5.60788L15.3578 9.06255C15.4453 9.17939 15.4943 9.31405 15.4995 9.45245C15.5048 9.59085 15.4661 9.7279 15.3876 9.84926C15.309 9.97063 15.1935 10.0719 15.0532 10.1424C14.9128 10.2128 14.7526 10.25 14.5895 10.25H9.40988Z"
      />
      <path
        className={state == "desc" ? "fill-gray-600" : "fill-gray-300"}
        d="M14.5901 13.75C14.7532 13.7501 14.9132 13.7873 15.0535 13.8578C15.1939 13.9284 15.3093 14.0296 15.3877 14.151C15.4662 14.2723 15.5048 14.4093 15.4995 14.5477C15.4943 14.686 15.4453 14.8206 15.3578 14.9374L12.7683 18.3921C12.6861 18.5018 12.5726 18.5921 12.4384 18.6546C12.3041 18.7172 12.1534 18.75 12.0003 18.75C11.8472 18.75 11.6965 18.7172 11.5623 18.6546C11.428 18.5921 11.3145 18.5018 11.2323 18.3921L8.64219 14.9374C8.55465 14.8206 8.50571 14.6859 8.50047 14.5476C8.49523 14.4092 8.5339 14.2721 8.61243 14.1507C8.69095 14.0294 8.80645 13.9281 8.94685 13.8576C9.08724 13.7872 9.24737 13.75 9.41049 13.75H14.5901Z"
      />
    </svg>
  );
}
