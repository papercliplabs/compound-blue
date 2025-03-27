import { ReactNode } from "react";

export interface EducationalSummaryTemplateProps {
  title: string;
  subtitle: string;
  items: { name: string; icon: ReactNode }[];
  children?: ReactNode;
}

export default function EducationalSummaryTemplate({
  title,
  subtitle,
  items,
  children,
}: EducationalSummaryTemplateProps) {
  return (
    <div className="flex w-full flex-col justify-center gap-4 rounded-[16px] bg-background-inverse p-4 text-center md:max-w-[360px]">
      <div className="flex flex-col gap-1">
        <h2 className="title-5">{title}</h2>
        <p className="text-content-secondary">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-4 rounded-[12px] bg-background-secondary p-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-2">
            {item.icon}
            <p className="text-content-secondary label-sm">{item.name}</p>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
