import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "../../firebase/config";

type UserProfileCardProps = {
  user?: User | null;
  className?: string;
  openMode?: "inline" | "dropdown";
};

export default function UserProfileCard({
  user = null,
  className = "",
  openMode = "inline",
}: UserProfileCardProps) {
  const [resolvedUser, setResolvedUser] = useState<FirebaseUser | null>(
    user as FirebaseUser | null,
  );
  const [isLoadingUser, setIsLoadingUser] = useState(!Boolean(user));
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDropdown = openMode === "dropdown";

  useEffect(() => {
    if (user) {
      setResolvedUser(user);
      setIsLoadingUser(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setResolvedUser(nextUser);
      setIsLoadingUser(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!isDropdown || !isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        event.target &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdown, isOpen]);

  const displayUser = resolvedUser;
  if (!displayUser || isLoadingUser) {
    return null;
  }

  const displayName = displayUser.displayName ?? displayUser.email?.split("@")[0] ?? "Player";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);
    setIsOpen(false);

    try {
      await signOut(auth);
      window.location.replace("/login");
    } catch (signOutError) {
      console.error("Sign out failed:", signOutError);
      setError("Could not sign out.");
      setIsOpen(true);
      setIsSigningOut(false);
    }
  }

  return (
    <aside
      ref={containerRef}
      className={`profile-card profile-card--${isDropdown ? "dropdown" : "inline"} ${
        isOpen ? "profile-card--open" : ""
      } ${className}`.trim()}
      aria-label="Signed-in user menu"
    >
      <button
        className="profile-card__summary"
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup={isDropdown ? "dialog" : undefined}
        aria-label={`${isOpen ? "Close" : "Open"} account menu`}
      >
        <span className="profile-card__avatar">{initial}</span>
        <span>
          <strong>{displayName}</strong>
          <small>Signed in</small>
        </span>
        <span className="profile-card__chevron">{isOpen ? "▾" : "▸"}</span>
      </button>

      {isDropdown
        ? isOpen
          ? (
            <div className="profile-card__popover" role="dialog" aria-label="Account actions">
              {error ? <p className="profile-card__error">{error}</p> : null}
              <p className="profile-card__email">{displayUser.email}</p>
              <div className="profile-card__actions">
                <button
                  className="profile-card__button"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  type="button"
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </div>
          )
          : null
        : (
          <>
            {error ? <p className="profile-card__error">{error}</p> : null}
            <p className="profile-card__email">{displayUser.email}</p>
            <div className="profile-card__actions">
              <button
                className="profile-card__button"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </>
        )}
    </aside>
  );
}
