"use client";
import { ComponentProps, HTMLAttributes, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActionFlowProvider, ActionFlowState, ActionState, useActionFlowContext } from "./ActionFlowProvider";
import { cn } from "@/utils/shadcn";
import { Button } from "../ui/button";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { LinkExternalBlockExplorer } from "../LinkExternal";
import PercentRing from "../ui/icons/PercentRing";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle } from "../ui/dialogDrawer";

interface ActionFlowDialogProps extends ComponentProps<typeof ActionFlowProvider> {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footerImage?: ReactNode;
}

const TITLE_MAP: Record<ActionFlowState, string> = {
  review: "Review",
  active: "Confirm",
  success: "Success",
  failed: "Failed",
};

export function ActionFlowDialog({
  open,
  onOpenChange,
  children,
  footerImage,
  ...providerProps
}: ActionFlowDialogProps) {
  const [render, setRender] = useState<boolean>(open);

  const closeDialog = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Falling edge delay so we get the nice close animation
  useEffect(() => {
    if (open) {
      setRender(true);
      return;
    }

    const timeout = setTimeout(() => {
      setRender(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [open]);

  // Don't render at all if not open to let react lifecycle reset the flow provider
  return (
    render && (
      <ActionFlowProvider {...providerProps}>
        <DialogDrawer open={open} onOpenChange={onOpenChange}>
          <ActionFlowDialogContent closeDialog={closeDialog} footerImage={footerImage}>
            {children}
          </ActionFlowDialogContent>
        </DialogDrawer>
      </ActionFlowProvider>
    )
  );
}

function ActionFlowDialogContent({
  children,
  closeDialog,
  footerImage,
  ...dialogContentProps
}: ComponentProps<typeof DialogDrawerContent> & { closeDialog: () => void; footerImage: ReactNode }) {
  const { flowState } = useActionFlowContext();
  const preventClose = useMemo(() => flowState == "active", [flowState]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <DialogDrawerContent
      overrideDismissible={preventClose}
      hideCloseButton // We use custom close logic instead to prevent accidentally aborting the flow
      {...dialogContentProps}
    >
      <DialogDrawerTitle>{TITLE_MAP[flowState]}</DialogDrawerTitle>
      <div className="absolute right-10 top-10">
        <Popover open={popoverOpen}>
          <PopoverTrigger />
          <PopoverContent className="flex max-w-[256px] flex-col gap-4 text-center" side="top">
            <div className="w-full title-5">Cancel transaction</div>
            <p className="font-medium text-content-secondary">
              If you close this modal, your transaction will be canceled, and you&apos;ll need to start over.
            </p>
            <Button
              variant="negative"
              onClick={() => {
                closeDialog();
                setPopoverOpen(false);
              }}
            >
              Cancel Transaction
            </Button>
            <Button variant="ghost" onClick={() => setPopoverOpen(false)}>
              Go back
            </Button>
          </PopoverContent>
        </Popover>

        <Button
          onClick={() => (preventClose ? setPopoverOpen(true) : closeDialog())}
          className="a h-5 w-5 bg-content-ternary"
          variant="none"
          size="icon"
        >
          <X size={8} className="h-2 w-2 stroke-background-inverse" />
        </Button>
      </div>

      {children}
      <ActionFlowSteps />
      <ActionFlowComplete closeDialog={closeDialog} />
      {footerImage && <div className="flex w-full items-center justify-center">{footerImage}</div>}
    </DialogDrawerContent>
  );
}

// Hide when in txn state
export function ActionFlowButton({ className, ...props }: ComponentProps<typeof Button>) {
  const { flowState, startFlow } = useActionFlowContext();
  const hidden = useMemo(() => flowState != "review", [flowState]);

  return (
    <div className={clsx("flex w-full flex-col gap-2", hidden && "!hidden")}>
      <Button className={cn("", className)} {...props} onClick={startFlow} />
      <ActionFlowError />
    </div>
  );
}

function ActionFlowError({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { flowState, error } = useActionFlowContext();
  const hidden = useMemo(() => flowState != "review" || !error, [flowState, error]);

  return (
    <div
      className={cn("max-h-[50px] overflow-y-auto text-semantic-negative paragraph-sm", hidden && "hidden", className)}
      {...props}
    >
      {error}
    </div>
  );
}

function ActionFlowStepIcon({
  stepNumber,
  status,
  actionState,
}: {
  stepNumber: number;
  status: "complete" | "active" | "pending";
  actionState: ActionState;
}) {
  switch (status) {
    case "complete":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background-primary">
          <Check size={16} className="stroke-semantic-positive" />
        </div>
      );
    case "active":
      return actionState == "pending-transaction" ? (
        <div className="h-8 w-8 animate-spin p-1">
          <PercentRing
            percent={0.35}
            size={24}
            className="stroke-accent-primary"
            innerClassName="stroke-accent-primary"
          />
        </div>
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-accent-primary bg-background-secondary font-semibold">
          {stepNumber}
        </div>
      );
    case "pending":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background-secondary font-semibold text-content-secondary">
          {stepNumber}
        </div>
      );
  }
}

function ActionFlowSteps() {
  const { flowState, activeStep, actionState, signatureRequests, transactionRequests } = useActionFlowContext();
  const hidden = useMemo(() => flowState != "active", [flowState]);

  const metadatas = useMemo(() => {
    return [...signatureRequests, ...transactionRequests].map((request, i) => ({
      name: request.name,
      learnMore: request.learnMore,
      type: i < signatureRequests.length ? "signature" : "transaction",
    }));
  }, [signatureRequests, transactionRequests]);

  return (
    <div className={clsx("flex flex-col gap-2", hidden && "hidden")}>
      {metadatas.map((metadata, i) => {
        const status = i == activeStep ? "active" : i < activeStep ? "complete" : "pending";
        return (
          <div key={i} className="flex flex-col gap-2">
            {i != 0 && <div className="ml-[15px] h-[10px] w-[2px] bg-border-primary" />}

            <div className="flex items-center gap-4">
              <ActionFlowStepIcon stepNumber={i + 1} status={status} actionState={actionState} />
              <span
                className={clsx(
                  "font-semibold",
                  status == "active" ? "text-content-primary" : "text-content-secondary"
                )}
              >
                {metadata.name}
                {status == "active" && (actionState == "pending-wallet" ? " In wallet" : " Pending...")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionFlowComplete({ closeDialog }: { closeDialog: () => void }) {
  const { flowState, lastTransactionHash } = useActionFlowContext();
  const hidden = useMemo(() => flowState == "review" || flowState == "active", [flowState]);

  return (
    <div className={clsx("flex flex-col justify-center gap-10 text-center", hidden && "hidden")}>
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background-secondary">
          {flowState == "success" ? (
            <Check size={32} className="stroke-semantic-positive" />
          ) : (
            <X size={32} className="stroke-semantic-negative" />
          )}
        </div>
        <p>
          {" "}
          {flowState == "success"
            ? "Transaction successful! You can now close this dialog or view details on the explorer."
            : "You can check the explorer. Our team has been notified and is investigating the issue."}
        </p>
      </div>

      {lastTransactionHash && (
        <LinkExternalBlockExplorer
          txHash={lastTransactionHash}
          className="block text-center font-medium text-accent-primary"
          hideArrow
        >
          View on Explorer
        </LinkExternalBlockExplorer>
      )}
      <Button onClick={closeDialog} variant="secondary">
        Close
      </Button>
    </div>
  );
}

export * from "./ActionFlowSummary";
export * from "./ActionFlowReview";
