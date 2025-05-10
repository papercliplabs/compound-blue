"use client";
import { ComponentProps, ReactNode, useMemo } from "react";

import { formatNumber } from "@/utils/format";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Slider } from "../ui/slider";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SliderFormFieldProps<TFieldValues extends Record<string, any>>
  extends Omit<ComponentProps<typeof FormField<TFieldValues>>, "render"> {
  includeInput?: boolean;
  labelContent: ReactNode;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  showTicks?: boolean;
  unit?: string;
  supply?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function SliderFormField<TFieldValues extends Record<string, any>>({
  labelContent,
  includeInput = true,
  sliderMin,
  sliderMax,
  sliderStep,
  showTicks = true,
  unit,
  supply = false,
  ...props
}: SliderFormFieldProps<TFieldValues>) {
  const ticks = useMemo(() => {
    const sliderRange = sliderMax - sliderMin;
    return [
      `${formatNumber(sliderMin, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}${unit}`,
      `${formatNumber(sliderMin + sliderRange / 4, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}${unit}`,
      `${formatNumber(sliderMin + sliderRange / 2, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}${unit}`,
      `${formatNumber(sliderMin + (sliderRange * 3) / 4, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}${unit}`,
      "Max",
    ];
  }, [sliderMin, sliderMax, unit]);

  return (
    <FormField
      {...props}
      render={({ field: { value, onChange } }) => (
        <FormItem className="flex flex-col gap-4">
          <div className="flex w-full items-center justify-between gap-2">
            <FormLabel className="w-full text-content-secondary">{labelContent}</FormLabel>
            {includeInput && (
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
            )}
          </div>

          <FormControl>
            <Slider
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={[value]}
              onValueChange={(value) => onChange(value[0])}
              supply={supply}
            />
          </FormControl>

          {showTicks && (
            <div className="flex items-center justify-between text-content-secondary label-sm">
              {ticks.map((tick, i) => (
                <span key={i}>{tick}</span>
              ))}
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
