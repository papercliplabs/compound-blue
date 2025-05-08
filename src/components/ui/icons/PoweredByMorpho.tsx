"use client";
import Image from "next/image";
import { ComponentProps } from "react";

import { useTheme } from "@/hooks/useTheme";
export default function PoweredByMorpho({
  ...props
}: Omit<ComponentProps<typeof Image>, "src" | "alt" | "width" | "height">) {
  const { theme } = useTheme();
  return (
    <Image
      src={theme == "light" ? "/powered-by-morpho-light.svg" : "/powered-by-morpho-dark.svg"}
      width={140}
      height={20}
      alt="Morpho"
      {...props}
    />
  );
}
