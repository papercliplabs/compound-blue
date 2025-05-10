"use client";
import { ComponentProps, ReactNode } from "react";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface NumberInputFormFieldProps<TFieldValues extends Record<string, any>>
  extends Omit<ComponentProps<typeof FormField<TFieldValues>>, "render"> {
  labelContent: ReactNode;
  unit?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function NumberInputFormField<TFieldValues extends Record<string, any>>({
  labelContent,
  unit,
  ...props
}: NumberInputFormFieldProps<TFieldValues>) {
  return (
    <FormField
      {...props}
      render={({ field: { value, onChange } }) => (
        <FormItem className="flex w-full flex-col">
          <div className="flex w-full items-center justify-between">
            <FormLabel className="w-full text-content-secondary">{labelContent}</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  placeholder="0"
                  inputMode="decimal"
                  type="text"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^0*(\d+)?(\.\d*)?$/.test(value)) {
                      onChange(value);
                    }
                  }}
                  value={value ?? ""}
                  className="w-[56px] border p-2 pr-[18px] label-sm"
                  {...props}
                />
                {unit && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-content-secondary label-sm">
                    {unit}
                  </div>
                )}
              </div>
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
