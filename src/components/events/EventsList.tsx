import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../../firebase/config";
import AuthGate from "./AuthGate";
import { assetUrl } from "./eventsUtils";
import UserProfileCard from "./UserProfileCard";

type EventCard = {
  id: string;
  eventName: string;
  shortName: string;
  logoUrl: string;
};

export default function EventsList() {
  return (
    <AuthGate>
      {(user) => <EventsContent user={user} />}
    </AuthGate>
  );
}

function EventsContent({ user }: { user: User }) {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const openEventsQuery = query(
          collection(db, "events"),
          where("stage", "==", "open"),
        );
        const eventsSnapshot = await getDocs(openEventsQuery);
        const nextEvents: EventCard[] = [];

        for (const eventDoc of eventsSnapshot.docs) {
          const detailsSnapshot = await getDoc(
            doc(db, "events", eventDoc.id, "app", "details"),
          );

          if (!detailsSnapshot.exists()) {
            continue;
          }

          const details = detailsSnapshot.data();
          const identity = details.identity ?? {};
          const logo = details.logo ?? {};
          const logoPath = logo.lightObjectPath ?? "";

          nextEvents.push({
            id: eventDoc.id,
            eventName:
              identity.eventName ?? identity.shortName ?? "Untitled Event",
            shortName: identity.shortName ?? "Unknown",
            logoUrl: logoPath ? assetUrl(logoPath) : "",
          });
        }

        if (!isMounted) return;
        setEvents(nextEvents);
        setStatus(nextEvents.length ? "ready" : "empty");
      } catch (error) {
        console.error(error);
        if (isMounted) setStatus("error");
      }
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="events-stack">
      <header className="events-hero">
        <div>
          <p className="eyebrow">Events</p>
          <h1>Open events</h1>
          <p>Choose an event and buy the tournament pass attached to it.</p>
        </div>

        <UserProfileCard user={user} />
      </header>

      {status === "loading" ? <LoadingState label="Loading events..." /> : null}
      {status === "empty" ? <EmptyState label="No open events found." /> : null}
      {status === "error" ? (
        <EmptyState label="Failed to load events. Please refresh this page." tone="error" />
      ) : null}

      {status === "ready" ? (
        <div className="event-grid">
          {events.map((event) => (
            <a className="event-tile" href={`/events/${event.id}`} key={event.id}>
              <div className="event-tile__media">
                {event.logoUrl ? (
                  <img src={event.logoUrl} alt={`${event.eventName} logo`} />
                ) : (
                  <span>{event.shortName.charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div className="event-tile__body">
                <p>{event.shortName}</p>
                <h2>{event.eventName}</h2>
              </div>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <section className="events-state">
      <div className="events-spinner" aria-hidden="true" />
      <p>{label}</p>
    </section>
  );
}

function EmptyState({
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
