"use client";
import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useMemo } from "react";
import { useState } from "react";

type Theme = "dark" | "light";

export function useTheme(): { theme: Theme } {
  const { resolvedTheme } = useNextTheme();

  // Prevent hydration error from theme...
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const theme = useMemo(() => {
    if (mounted) {
      if (resolvedTheme == "light" || resolvedTheme == "dark") {
        return resolvedTheme;
      } else {
        return "dark";
      }
    } else {
      return "dark";
    }
  }, [mounted, resolvedTheme]);

  return { theme };
}
