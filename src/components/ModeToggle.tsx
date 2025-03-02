"use client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <Button
      onClick={() => setTheme((theme) => (theme === "light" ? "dark" : "light"))}
      variant="ghost"
      size="icon"
      className="h-fit w-fit"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
