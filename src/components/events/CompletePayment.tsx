import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import AuthGate from "./AuthGate";
import { removePendingPass } from "./pendingPassStorage";

type CompletePaymentProps = {
  eventId?: string | null;
  reference?: string | null;
  tier?: string | null;
  callbackStatus?: string | null;
};

export default function CompletePayment({
  eventId,
  reference,
  tier,
  callbackStatus,
}: CompletePaymentProps) {
  return (
    <AuthGate>
      {(user) => (
        <CompletePaymentContent
          eventId={eventId ?? ""}
          reference={reference ?? ""}
          tier={tier ?? ""}
          callbackStatus={callbackStatus ?? ""}
          user={user}
        />
      )}
    </AuthGate>
  );
}

function CompletePaymentContent({
  eventId,
  reference,
  tier,
  callbackStatus,
  user,
}: {
  eventId: string;
  reference: string;
  tier: string;
  callbackStatus: string;
  user: User;
}) {
  const [status, setStatus] = useState<"ready" | "working" | "success" | "error">(
    "ready",
  );
  const [message, setMessage] = useState(
    "Paystack sent you back to Campus XI. Verify this transaction to secure your tournament pass.",
  );
  const [confirmedTier, setConfirmedTier] = useState("");

  useEffect(() => {
    if (!eventId || !reference) {
      setStatus("error");
      setMessage("Invalid or missing transaction details.");
    }

    if (!callbackStatus || status === "success") {
      return;
    }

    const statusValue = callbackStatus.trim().toLowerCase();

    if (statusValue === "success") {
      void completePayment();
      return;
    }

    if (statusValue === "cancelled" || statusValue === "failed") {
      setStatus("error");
      setMessage(
        "Payment was not completed. Use the button below if the charge succeeded or try again from the event page.",
      );
    }
  }, [eventId, reference]);

  async function completePayment() {
    if (!eventId || !reference) {
      setStatus("error");
      setMessage("Invalid or missing transaction details.");
      return;
    }

    setStatus("working");
    setMessage("Verifying your payment...");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/verify-pass-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          eventId,
          purchase: {
            platform: "paystack",
            reference,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not complete this pass.");
      }

      const confirmedPass = await loadConfirmedPass(eventId, user.uid);

      if (confirmedPass.tier) {
        setConfirmedTier(confirmedPass.tier);
      }

      removePendingPass(eventId, reference);
      setStatus("success");
      setMessage(
        confirmedPass.isPaid
          ? "Payment verified. Your pass is active. Redirecting to your event..."
          : "Payment verified. Redirecting to your event...",
      );

      setTimeout(() => {
        window.location.replace(`/events/${encodeURIComponent(eventId)}`);
      }, 1500);
    } catch (error) {
      console.error("Payment completion failed:", error);

      const code = getErrorCode(error);
      const errorMessage = error instanceof Error ? error.message : "";

      if (code === "already-exists" || errorMessage.includes("already-exists")) {
        removePendingPass(eventId, reference);
        setStatus("success");
        setMessage("Pass already secured. Redirecting to your event...");
        setTimeout(() => {
          window.location.replace(`/events/${encodeURIComponent(eventId)}`);
        }, 1500);
        return;
      }

      setStatus("error");
      setMessage("We could not verify this payment yet. Please try again.");
    }
  }

  const isWorking = status === "working";
  const isDone = status === "success";
  const isMissingTransaction = !eventId || !reference;
  const passType = formatPassType(confirmedTier || tier);

  return (
    <section className="completion-screen">
      <article className={`completion-card completion-card--${status}`}>
        <div className="completion-card__mark" aria-hidden="true">
          {status === "success" ? "✓" : "•"}
        </div>

        <p className="eyebrow">Paystack return</p>
        <h1>Verify your pass</h1>
        <p>{message}</p>

        <dl className="completion-reference">
          <div className="completion-reference__primary">
            <dt>Pass type</dt>
            <dd>{passType}</dd>
          </div>
          <div className="completion-reference__muted">
            <dt>Reference</dt>
            <dd>{reference || "Missing"}</dd>
          </div>
        </dl>

        <button
          className="events-button events-button--full"
          disabled={isWorking || isDone || isMissingTransaction}
          onClick={completePayment}
          type="button"
        >
          {isWorking ? "Verifying..." : isDone ? "Verified" : "Verify payment"}
        </button>
      </article>
    </section>
  );
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    return String(error.code);
  }

  return "";
}

function formatPassType(tier: string) {
  const cleanTier = tier.trim().toLowerCase();

  const passLabels: Record<string, string> = {
    bronze: "Bronze pass",
    silver: "Silver pass",
    gold: "Gold pass",
  };

  if (passLabels[cleanTier]) {
    return passLabels[cleanTier];
  }

  return "Tournament pass";
}

async function loadConfirmedPass(eventId: string, userId: string) {
  const snapshot = await getDoc(doc(db, "events", eventId, "user_details", userId));
  const data = snapshot.exists() ? snapshot.data() : {};
  const tier = readFirstString(data, [
    "pass.value",
    "pass.tier",
    "pass.currentTier",
    "passTier",
    "tier",
    "purchase.tier",
    "purchase.passTier",
    "premiumPass.tier",
  ]);
  const status = readFirstString(data, [
    "pass.source",
    "pass.status",
    "purchase.status",
    "payment.status",
    "pass.paymentStatus",
    "purchase.verificationStatus",
  ]).toLowerCase();

  return {
    tier,
    isPaid: ["payment", "paid", "active", "verified", "success", "successful"].includes(status),
  };
}

function readFirstString(data: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, data);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}
