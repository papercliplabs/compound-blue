"use client";
import { useTheme } from "next-themes";
import Image from "next/image";
import { ComponentProps, useEffect, useMemo, useState } from "react";

export default function PoweredByMorpho({
  ...props
}: Omit<ComponentProps<typeof Image>, "src" | "alt" | "width" | "height">) {
  const { theme } = useTheme();

  // Prevent hydration error from theme...
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isLight = useMemo(() => theme === "light" && mounted, [theme, mounted]);

  // 265 x 38
  return (
    <Image
      src={isLight ? "/powered-by-morpho-light.svg" : "/powered-by-morpho-dark.svg"}
      width={140}
      height={20}
      alt="Morpho"
      {...props}
    />
  );
}
