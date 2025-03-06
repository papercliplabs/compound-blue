"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle } from "./ui/dialogDrawer";
import { useAcknowledgeTermsContext } from "../providers/AcknowledgeTermsProvider";
import LinkExternal from "./LinkExternal";
import TermsPage from "@/app/(legal)/terms/page";
import LegalLayout from "@/app/(legal)/layout";

export default function AcknowledgeTerms({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { setAcknowledgement } = useAcknowledgeTermsContext();
  const [checked, setChecked] = useState<boolean>(false);

  return (
    <DialogDrawer open={open} onOpenChange={onOpenChange}>
      <DialogDrawerContent className="w-full max-w-[680px]">
        <DialogDrawerTitle>Acknowledge Terms</DialogDrawerTitle>
        <div className="max-h-[280px] overflow-y-auto rounded-[9px] bg-background-primary p-6 pt-0 md:max-h-[400px]">
          <LegalLayout>
            <TermsPage />
          </LegalLayout>
        </div>
        <div className="flex gap-5">
          <Checkbox
            className="m-1"
            checked={checked}
            onCheckedChange={(checked) => setChecked(checked === "indeterminate" ? false : checked)}
          />
          <div className="label-md">
            By checking this box, you agree to the{" "}
            <LinkExternal
              href="/terms"
              className="inline text-accent-primary transition-all hover:brightness-75"
              hideArrow
            >
              Terms of Use
            </LinkExternal>
            , and{" "}
            <LinkExternal
              href="/privacy"
              className="inline text-accent-primary transition-all hover:brightness-75"
              hideArrow
            >
              Privacy Policy
            </LinkExternal>
            , and confirm that you are not a resident of any prohibited jurisdictions.
          </div>
        </div>
        <div className="flex gap-7">
          <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Reject
          </Button>
          <Button className="flex-1" disabled={!checked} onClick={setAcknowledgement}>
            Accept
          </Button>
        </div>
      </DialogDrawerContent>
    </DialogDrawer>
  );
}
