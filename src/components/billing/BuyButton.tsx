"use client";

import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { PaidPlanId, PricingVariant } from "@/lib/billing/plans";
import { openBillingPortal, startCheckout } from "./client";

export function BuyButton({
  plan,
  variant,
  label,
  buttonVariant = "outline",
  size = "md",
  fullWidth = true,
}: {
  plan: PaidPlanId;
  variant: PricingVariant | null;
  label: string;
  buttonVariant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <Button
      variant={buttonVariant}
      size={size}
      fullWidth={fullWidth}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await startCheckout(plan, variant);
          // Navigation is underway; leave the spinner on.
        } catch (err) {
          setBusy(false);
          toast({ tone: "bad", title: "Checkout didn't open", description: err instanceof Error ? err.message : undefined });
        }
      }}
    >
      {label}
    </Button>
  );
}

export function ManageSubscriptionButton({
  label = "Manage subscription",
  variant = "outline",
  size = "md",
  fullWidth = false,
}: {
  label?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await openBillingPortal();
        } catch (err) {
          setBusy(false);
          toast({ tone: "bad", title: "Billing portal didn't open", description: err instanceof Error ? err.message : undefined });
        }
      }}
    >
      {label}
    </Button>
  );
}
