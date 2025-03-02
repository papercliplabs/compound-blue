"use client";
import { useContext, useEffect, useState } from "react";
import { createContext } from "react";
import { useMediaQuery } from "usehooks-ts";

const ResponsiveContext = createContext<{ isDesktop: boolean; hasMounted: boolean }>({
  isDesktop: true,
  hasMounted: false,
});

// Context to synchronize to ensure they all use the same media query
export const useResponsiveContext = () => {
  const context = useContext(ResponsiveContext);
  if (context === undefined) {
    throw new Error("useTooltipPopover must be used within a TooltipPopoverProvider");
  }
  return context;
};

// Syncronized provider any components can use
export const ResponsiveProvider = ({ children }: { children: React.ReactNode }) => {
  const isDesktop = useMediaQuery("(min-width: 1080px)", { defaultValue: true });
  const [isDesktopHydrated, setIsDesktopHydrated] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Prevent hydration errors, always just render desktop first
  // Components can use hasMounted to not render anything until the hydration is complete if they prefer
  useEffect(() => {
    setIsDesktopHydrated(isDesktop);
    setHasMounted(true);
  }, [isDesktop]);

  return (
    <ResponsiveContext.Provider value={{ isDesktop: isDesktopHydrated, hasMounted }}>
      {children}
    </ResponsiveContext.Provider>
  );
};
