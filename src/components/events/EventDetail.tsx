import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import AuthGate from "./AuthGate";
import { assetUrl, formatPrice } from "./eventsUtils";
import { getPendingPass, savePendingPass, type PendingPass } from "./pendingPassStorage";
import UserProfileCard from "./UserProfileCard";

type Offer = {
  label: string;
  tier: string;
  summary: string;
  paystackProductId: string;
  price: number | null;
  currency: string;
  active: boolean;
  perks: string[];
};

type EventDetails = {
  eventName: string;
  shortName: string;
  identityId: string;
  logoUrl: string;
  eventKey: string;
  offers: Offer[];
};

type UserPass = {
  value: string;
  source: string;
};

type EventDetailProps = {
  eventId?: string;
};

export default function EventDetail({ eventId }: EventDetailProps) {
  return (
    <AuthGate>
      {(user) => <EventDetailContent eventId={eventId ?? ""} user={user} />}
    </AuthGate>
  );
}

function EventDetailContent({ eventId, user }: { eventId: string; user: User }) {
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [userPass, setUserPass] = useState<UserPass | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [pendingPass, setPendingPass] = useState<PendingPass | null>(null);

  useEffect(() => {
    if (eventId) {
      setPendingPass(getPendingPass(eventId));
    }
  }, [eventId]);

  useEffect(() => {
    let isMounted = true;

    async function loadEvent() {
      if (!eventId) {
        setStatus("missing");
        return;
      }

      try {
        const [detailsSnapshot, passSnapshot, userDetailsSnapshot] = await Promise.all([
          getDoc(doc(db, "events", eventId, "app", "details")),
          getDoc(doc(db, "events", eventId, "app", "pass")),
          getDoc(doc(db, "events", eventId, "user_details", user.uid)),
        ]);

        if (!detailsSnapshot.exists()) {
          if (isMounted) setStatus("missing");
          return;
        }

        const rawDetails = detailsSnapshot.data();
        const pass = passSnapshot.exists() ? passSnapshot.data() : null;
        const userDetails = userDetailsSnapshot.exists() ? userDetailsSnapshot.data() : {};
        const currentPass = readUserPass(userDetails);
        const identity = rawDetails.identity ?? {};
        const logo = rawDetails.logo ?? {};
        const logoPath = logo.lightObjectPath ?? "";
        let offers: Offer[] = [];

        if (pass?.enabled && Array.isArray(pass.offers)) {
          const paystackProductIds = pass.offers
            .map((offer) => String(offer.paystackProductId ?? "").trim())
            .filter(Boolean);

          if (paystackProductIds.length) {
            const pricesResponse = await fetch("/api/paystack-product-prices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paystackProductIds }),
            });
            const pricesData = await pricesResponse.json();
            const pricesByProductId = pricesData.productsById ?? {};

            offers = pass.offers.map((offer) => {
              const paystackProductId = String(offer.paystackProductId ?? "").trim();
              const priceData = pricesByProductId[paystackProductId];

              return {
                label: offerLabel(offer),
                tier: offer.tier ?? "pass",
                summary: offerSummary(offer),
                paystackProductId,
                price: priceData?.price ?? null,
                currency: priceData?.currency ?? "NGN",
                active: Boolean(priceData?.active),
                perks: offerPerks(offer),
              };
            });
          }
        }

        if (!isMounted) return;

        setDetails({
          eventName: identity.eventName ?? identity.shortName ?? "Untitled Event",
          shortName: identity.shortName ?? "Unknown",
          identityId: identity.id ?? eventId,
          logoUrl: logoPath ? assetUrl(logoPath) : "",
          eventKey: pass?.eventKey ?? "",
          offers,
        });
        setUserPass(currentPass);
        setStatus("ready");
      } catch (error) {
        console.error(error);
        if (isMounted) setStatus("error");
      }
    }

    loadEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  async function startCheckout(offer: Offer) {
    if (!details?.eventKey) {
      setCheckoutError("This event is not ready for checkout yet.");
      return;
    }

    setCheckoutError("");
    setCheckoutTier(offer.tier);

    try {
      const idToken = await user.getIdToken();
      const checkoutResponse = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          eventId,
          eventKey: details.eventKey,
          tier: offer.tier,
          paystackProductId: offer.paystackProductId,
        }),
      });
      const checkoutData = await checkoutResponse.json();

      if (!checkoutResponse.ok) {
        throw new Error(checkoutData.error ?? "Could not start checkout.");
      }

      savePendingPass({
        eventId,
        reference: checkoutData.reference,
        tier: offer.tier,
        createdAt: Date.now(),
        authorizationUrl: checkoutData.authorization_url,
        accessCode: checkoutData.access_code,
        paystackProductId: offer.paystackProductId,
      });
      setPendingPass(getPendingPass(eventId));
      window.location.href = checkoutData.authorization_url;
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Could not start checkout.",
      );
      setCheckoutTier(null);
    }
  }

  async function continueCheckoutAttempt(pendingPass: PendingPass) {
    setCheckoutError("");

  const matchingOffer = details?.offers.find(
      (offer) =>
        offer.paystackProductId === pendingPass.paystackProductId ||
        offer.tier === pendingPass.tier,
    );

    if (matchingOffer && !matchingOffer.active) {
      setCheckoutError("This checkout attempt is no longer available. Please choose another pass below.");
      return;
    }

    if (!matchingOffer) {
      setCheckoutError("This checkout attempt is no longer available. Please choose a pass below.");
      return;
    }

    await startCheckout(matchingOffer);
  }

  if (status === "loading") {
    return <EventsState label="Loading event..." />;
  }

  if (status === "missing") {
    return <EventsState label="Event details not found." />;
  }

  if (status === "error" || !details) {
    return <EventsState label="Failed to load event. Please refresh this page." tone="error" />;
  }

  const currentPassRank = passRank(userPass?.value);
  const visibleOffers = details.offers.filter(
    (offer) => passRank(offer.tier) > currentPassRank,
  );
  const hasPaidPass = currentPassRank >= passRank("bronze");
  const passLabel = hasPaidPass ? formatPassLabel(userPass?.value ?? "") : "No pass yet";

  return (
    <section className="events-stack">
      <header className="event-detail-topbar">
        <a className="events-back-link" href="/events">
          Back to events
        </a>
        <UserProfileCard user={user} />
      </header>

      <article className="event-detail-panel event-detail-panel--dashboard">
        <div className="event-detail-panel__logo">
          {details.logoUrl ? (
            <img src={details.logoUrl} alt={`${details.eventName} logo`} />
          ) : (
            <span>{details.shortName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="event-detail-panel__copy">
          <p className="eyebrow">{details.shortName}</p>
          <h1>{details.eventName}</h1>
          <p className="event-detail-panel__summary">
            Manage your tournament access, finish a pending payment, or upgrade
            your pass for this event.
          </p>

          <dl className="event-meta-grid">
            <div>
              <dt>Event ID</dt>
              <dd>{details.identityId}</dd>
            </div>
          </dl>
        </div>

        <aside className="pass-status-panel">
          <p className="eyebrow">Pass status</p>
          <strong>{passLabel}</strong>
          {hasPaidPass ? (
            <p>
              Your pass should now be reflecting in the app. If you have not
              completed registration, go back to the app to complete it.
            </p>
          ) : (
            <p>Select a pass below to unlock premium access for this event.</p>
          )}

          {pendingPass ? (
            <button
              className="pending-pass-card pending-pass-card--compact"
              disabled={checkoutTier === pendingPass.tier}
              onClick={() => continueCheckoutAttempt(pendingPass)}
              type="button"
            >
              <span>
                <strong>Continue {formatPassLabel(pendingPass.tier)} payment</strong>
                <small>Return to Paystack to finish payment before verification.</small>
              </span>
              <b>{checkoutTier === pendingPass.tier ? "Opening..." : "Continue"}</b>
            </button>
          ) : null}
        </aside>
      </article>

      <section className="offers-panel">
        <div className="events-section-heading">
          <p className="eyebrow">Passes</p>
          <h2>{hasPaidPass ? "Upgrade your pass" : "Available passes"}</h2>
        </div>

        {hasPaidPass ? (
          <p className="events-alert events-alert--success">
            You have {formatPassLabel(userPass?.value ?? "")}. Lower pass tiers are hidden.
          </p>
        ) : null}

        {checkoutError ? (
          <p className="events-alert events-alert--error">{checkoutError}</p>
        ) : null}

        {visibleOffers.length ? (
          <div className="offer-list">
            {visibleOffers.map((offer) => (
              <article className="offer-row" key={`${offer.tier}-${offer.paystackProductId}`}>
                <div className="offer-row__content">
                  <h3>{offer.label}</h3>
                  <p>{offer.summary}</p>
                  {offer.perks.length ? (
                    <ul className="offer-perks">
                      {offer.perks.map((perk) => (
                        <li key={perk}>{perk}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="offer-row__action">
                  <strong>
                    {offer.price !== null
                      ? formatPrice(offer.price, offer.currency)
                      : "Price unavailable"}
                  </strong>
                  <button
                    className="events-button"
                    disabled={!offer.active || checkoutTier === offer.tier}
                    onClick={() => startCheckout(offer)}
                    type="button"
                  >
                    {checkoutTier === offer.tier ? "Opening..." : "Purchase"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="events-muted">
            {hasPaidPass
              ? "There are no higher pass upgrades available for this event."
              : "No payment offers available for this event."}
          </p>
        )}
      </section>
    </section>
  );
}

function offerPerks(offer: Record<string, unknown>) {
  const tierDefaults = passPlanDefaults(tierValue(offer.tier));
  const possibleLists = [offer.perks, offer.benefits, offer.features];

  for (const list of possibleLists) {
    if (Array.isArray(list)) {
      const values = list
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);

      if (values.length) return values;
    }
  }

  const possibleText = [offer.description, offer.summary, offer.subtitle];

  const textValues = possibleText
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  return textValues.length ? textValues : tierDefaults.features;
}

function offerLabel(offer: Record<string, unknown>) {
  const label = String(offer.label ?? "").trim();
  if (label) return label;

  return passPlanDefaults(tierValue(offer.tier)).label;
}

function offerSummary(offer: Record<string, unknown>) {
  const summary = String(offer.summary ?? offer.description ?? "").trim();
  if (summary) return summary;

  return passPlanDefaults(tierValue(offer.tier)).summary;
}

function tierValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function readUserPass(userDetails: Record<string, unknown>): UserPass | null {
  const pass = userDetails.pass;

  if (!pass || typeof pass !== "object") {
    return null;
  }

  const passRecord = pass as Record<string, unknown>;
  const value = tierValue(passRecord.value);
  const source = String(passRecord.source ?? "").trim().toLowerCase();

  if (!value || value === "none") {
    return null;
  }

  return { value, source };
}

function passRank(tier: unknown) {
  const ranks: Record<string, number> = {
    none: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
  };

  return ranks[tierValue(tier)] ?? 0;
}

function formatPassLabel(tier: string) {
  return passPlanDefaults(tierValue(tier)).label;
}

function passPlanDefaults(tier: string) {
  const defaults = {
    bronze: {
      label: "Bronze Pass",
      summary: "Extra control and convenience for this event.",
      features: [
        "Rename your team at any time during the tournament",
        "Use any formation for your team",
        "Track the Top XI players each matchday",
        "Browse tournament player stats and prices",
        "Set 1 custom deadline reminder per matchday",
        "Unlock a premium profile and leaderboard badge",
        "Enjoy improved action rate limits",
        "See your rank progression badges",
        "Use enhanced share card styles",
      ],
    },
    silver: {
      label: "Silver Pass",
      summary: "The best-value tier for managers who want deeper tools.",
      features: [
        "Everything in Bronze",
        "Use Smart XI for suggested lineups and key squad decisions",
        "Unlock squad insights and deeper manager comparison",
        "Follow live fixture updates during the matchday",
        "View full published squad history for managers on the leaderboard",
        "Set 2 custom deadline reminders per matchday",
        "Enjoy further improved action rate limits",
      ],
    },
    gold: {
      label: "Gold Pass",
      summary: "The highest tier for maximum visibility and premium access.",
      features: [
        "Everything in Silver",
        "Follow live activities and fixture score updates during the matchday",
        "Get instant alerts for key fixture activity",
        "Set 3 custom deadline reminders per matchday",
        "View live activities and squads of managers on the leaderboard",
        "See leaderboard rank progression badges",
        "Enjoy the most generous action rate limits",
      ],
    },
  } as const;

  return defaults[tier as keyof typeof defaults] ?? {
    label: "Tournament pass",
    summary: "Unlock premium access for this event.",
    features: [],
  };
}

function EventsState({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "error";
}) {
  return (
    <section className={`events-state ${tone === "error" ? "events-state--error" : ""}`}>
      <p>{label}</p>
    </section>
  );
}
