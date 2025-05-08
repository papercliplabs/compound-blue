"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme as useNextTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

export function ModeToggle() {
  const { theme } = useTheme();
  const { setTheme } = useNextTheme();

  return (
    <Button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      variant="ghost"
      size="icon"
      className="h-fit w-fit"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
