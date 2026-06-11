import { useState } from "react";
import type { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";

type UserProfileCardProps = {
  user: User;
};

export default function UserProfileCard({ user }: UserProfileCardProps) {
  const displayName = user.displayName ?? user.email?.split("@")[0] ?? "Player";
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);

    try {
      await signOut(auth);
      window.location.replace("/login");
    } catch (signOutError) {
      console.error("Sign out failed:", signOutError);
      setError("Could not sign out.");
      setIsSigningOut(false);
    }
  }

  return (
    <aside className="profile-card" aria-label="Signed-in user">
      <div className="profile-card__summary">
        <span className="profile-card__avatar">{initial}</span>
        <span>
          <strong>{displayName}</strong>
          <small>{user.email}</small>
        </span>
      </div>

      {error ? <p className="profile-card__error">{error}</p> : null}

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
    </aside>
  );
}
