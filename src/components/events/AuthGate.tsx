import { type ReactNode, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase/config";

type AuthGateProps = {
  children: (user: User) => ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isChecking, setIsChecking] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const loginPath = `/login?redirect=${encodeURIComponent(returnPath)}`;
        setIsChecking(false);
        setIsRedirecting(true);
        window.location.replace(loginPath);
        return;
      }

      setUser(nextUser);
      setIsChecking(false);
    });
  }, []);

  if (isChecking || !user) {
    return (
      <section className="events-state">
        <div className="events-spinner" aria-hidden="true" />
        <p>{isRedirecting ? "Redirecting to login..." : "Checking authentication..."}</p>
      </section>
    );
  }

  return <>{children(user)}</>;
}
