import { useMemo } from "react";
import { Control, FieldPath, FieldPathValue, FieldValues, useWatch } from "react-hook-form";
import { parseUnits } from "viem";

// Watch a react-hook-form field which is a string representation of a number
// Note there may be precision loss converting to a number, so this should be used for informational purposes only
export function useWatchNumberField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ control, name }: { control?: Control<TFieldValues>; name: TName }): number {
  const rawValue = useWatch({ control, name }) as unknown as string | undefined | null;

  const numericValue = useMemo(() => {
    if (rawValue === undefined || rawValue === null || rawValue === "" || rawValue == ".") {
      return 0;
    }

    const num = Number(rawValue);
    return isNaN(num) ? 0 : num;
  }, [rawValue]);

  return numericValue;
}

// Watch a react-hook-form field which is a string representation of an asset value
export function useWatchParseUnits<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  decimals,
}: {
  control?: Control<TFieldValues>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: TName extends any ? (FieldPathValue<TFieldValues, TName> extends string ? TName : never) : never;
  decimals: number;
}): bigint {
  const stringValue = useWatch({ control, name }) as string | undefined | null;

  const bigIntValue = useMemo(() => {
    if (stringValue === undefined || stringValue === null || stringValue === "" || stringValue == ".") {
      return 0n;
    }

    try {
      return parseUnits(stringValue, decimals);
    } catch {
      console.error(`Error parsing as bigint: ${stringValue}`);
      return 0n;
    }
  }, [stringValue, decimals]);

  return bigIntValue;
}
