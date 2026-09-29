"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Confirmation shown before signing out, shared by the navbar and dashboard. */
export function SignOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [signingOut, setSigningOut] = useState(false);

  const confirm = async () => {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!signingOut) onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} className="border border-border/60 bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl italic">Sign out of CPBoard?</DialogTitle>
          <DialogDescription>
            To come back, you&apos;ll need a new sign-in link sent to your university email.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-card">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={signingOut}
          >
            Stay signed in
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirm()} disabled={signingOut}>
            <LogOut aria-hidden="true" />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
