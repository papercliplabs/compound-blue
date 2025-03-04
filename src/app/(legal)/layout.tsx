import clsx from "clsx";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full justify-center pt-8">
      <div
        className={clsx(
          "flex w-full max-w-[600px] flex-col gap-6 text-content-secondary",
          "[&_h1]:text-content-primary",
          "[&_h3]:mt-[48px] [&_h3]:text-content-primary",
          "[&_h4]:mt-[12px] [&_h4]:text-content-primary",
          "[&_h5]:mt-[8px]",
          "[&_section]:flex [&_section]:flex-col [&_section]:gap-6",
          "[&_ul]:list-outside [&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:list-outside [&_ol]:list-decimal [&_ol]:pl-6"
        )}
      >
        {children}
      </div>
    </div>
  );
}
