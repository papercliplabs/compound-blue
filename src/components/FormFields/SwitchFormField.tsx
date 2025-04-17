"use client";
import { ComponentProps, ReactNode } from "react";
import { FormControl, FormField, FormItem } from "../ui/form";
import { Switch } from "../ui/switch";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SwitchFormFieldProps<TFieldValues extends Record<string, any>>
  extends Omit<ComponentProps<typeof FormField<TFieldValues>>, "render"> {
  labelContent: ReactNode;
  switchLabel?: ReactNode;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function SwitchFormField<TFieldValues extends Record<string, any>>({
  labelContent,
  switchLabel,
  ...props
}: SwitchFormFieldProps<TFieldValues>) {
  return (
    <FormField
      {...props}
      render={({ field: { value, onChange } }) => (
        <FormItem className="flex w-full items-center justify-between gap-2">
          {/* Don't use form label here becuase it will associate a click with the switch */}
          <div className="text-content-secondary label-sm" onClick={(e) => e.stopPropagation()}>
            <span onClick={(e) => e.stopPropagation()}>{labelContent}</span>
          </div>

          <div className="flex items-center gap-2 label-sm">
            {switchLabel}
            <FormControl>
              <Switch checked={value} onCheckedChange={onChange} />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
