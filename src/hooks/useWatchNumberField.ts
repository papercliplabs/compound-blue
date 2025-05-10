import { useMemo } from "react";
import { Control, FieldPath, FieldValues, useWatch } from "react-hook-form";

// React hook form has some issues with string->number conversion with zodResolver.
// The output is correctly typed, but it causes input typing problems, this solves types.
export function useWatchNumberField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ control, name }: { control?: Control<TFieldValues>; name: TName }): number {
  // React hook form incorrectly types this (based on zodResolver output instead of input)
  const rawValue = useWatch({ control, name }) as unknown as string | undefined | null;

  const numericValue = useMemo(() => {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return 0;
    }

    const num = Number(rawValue);
    return isNaN(num) ? 0 : num;
  }, [rawValue]);

  return numericValue;
}
