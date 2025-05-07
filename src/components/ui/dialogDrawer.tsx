"use client";
import { HTMLAttributes, ReactNode, useMemo, useState } from "react";
import { createContext, useContext } from "react";

import { useResponsiveContext } from "@/providers/ResponsiveProvider";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "./drawer";

const DialogDrawerContext = createContext<{ dismissible?: boolean }>({});

// Context to synchronize to ensure they all use the same media query
export const useDialogDrawerContext = () => {
  const context = useContext(DialogDrawerContext);
  if (context === undefined) {
    throw new Error("useDialogDrawerContext must be used within a DialogDrawer");
  }
  return context;
};

interface DialogDrawerProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  dismissible?: boolean; // Via interact outside, or drag (for drawer)
}

export function DialogDrawer({ open, onOpenChange, dismissible, children }: DialogDrawerProps) {
  // Syncronize state, allow for controlled or "uncontrolled" use
  const [openUncontrolled, setOpenUncontrolled] = useState<boolean>(false);
  const { openInternal, setOpenInternal } = useMemo(() => {
    return {
      openInternal: open ?? openUncontrolled,
      setOpenInternal: onOpenChange ?? setOpenUncontrolled,
    };
  }, [open, onOpenChange, openUncontrolled, setOpenUncontrolled]);

  const { isDesktop } = useResponsiveContext();
  return (
    <DialogDrawerContext.Provider value={{ dismissible }}>
      {isDesktop ? (
        <Dialog open={openInternal} onOpenChange={setOpenInternal}>
          {children}
        </Dialog>
      ) : (
        <Drawer open={openInternal} onOpenChange={setOpenInternal} dismissible={dismissible}>
          {children}
        </Drawer>
      )}
    </DialogDrawerContext.Provider>
  );
}

export function DialogDrawerTrigger(props: HTMLAttributes<HTMLButtonElement>) {
  const { isDesktop } = useResponsiveContext();
  return isDesktop ? <DialogTrigger {...props} /> : <DrawerTrigger {...props} />;
}

export function DialogDrawerContent({
  hideCloseButton, // For using a custom one...
  overrideDismissible, // kinda hacky...
  ...props
}: { hideCloseButton?: boolean; overrideDismissible?: boolean } & HTMLAttributes<HTMLDivElement>) {
  const { isDesktop } = useResponsiveContext();
  const { dismissible } = useDialogDrawerContext();
  return isDesktop ? (
    <DialogContent
      onInteractOutside={(event) => (dismissible || overrideDismissible ? event.preventDefault() : {})}
      hideClose={hideCloseButton}
      {...props}
    />
  ) : (
    <DrawerContent {...props} />
  );
}

export function DialogDrawerTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  const { isDesktop } = useResponsiveContext();
  return isDesktop ? <DialogTitle {...props} /> : <DrawerTitle {...props} />;
}
