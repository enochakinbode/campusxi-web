import { type FormEvent, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { FaApple } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";
import { auth } from "../../firebase/config";

type ProviderName = "google" | "apple" | "email";

export default function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pendingProvider, setPendingProvider] = useState<ProviderName | null>(
    null,
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        window.location.replace(getRedirectPath());
      }
    });
  }, []);

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPendingProvider("email");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = getRedirectPath();
    } catch (loginError) {
      setError(errorMessage(loginError, "Failed to log in."));
      setPendingProvider(null);
    }
  }

  async function handleProviderLogin(providerName: Exclude<ProviderName, "email">) {
    setError("");
    setPendingProvider(providerName);

    const provider =
      providerName === "google"
        ? new GoogleAuthProvider()
        : new OAuthProvider("apple.com");

    try {
      await signInWithPopup(auth, provider);
      window.location.href = getRedirectPath();
    } catch (loginError) {
      setError(
        errorMessage(
          loginError,
          providerName === "google"
            ? "Google sign-in failed."
            : "Apple sign-in failed.",
        ),
      );
      setPendingProvider(null);
    }
  }

  const isPending = pendingProvider !== null;

  return (
    <section className="auth-screen">
      <div className="auth-panel">
        <div className="auth-panel__brand">
          <img src="/brand/cxi-ball-mark.png" alt="" />
        </div>

        <header className="auth-panel__header">
          <p className="eyebrow">Campus XI</p>
          <h1>Welcome back</h1>
          <p>Sign in to manage event passes and tournament access.</p>
        </header>

        <div className="auth-provider-grid">
          <button
            className="auth-provider auth-provider--light"
            type="button"
            disabled={isPending}
            onClick={() => handleProviderLogin("google")}
          >
            <FcGoogle className="auth-provider__icon" aria-hidden="true" />
            {pendingProvider === "google" ? "Connecting..." : "Google"}
          </button>

          <button
            className="auth-provider"
            type="button"
            disabled={isPending}
            onClick={() => handleProviderLogin("apple")}
          >
            <FaApple className="auth-provider__icon" aria-hidden="true" />
            {pendingProvider === "apple" ? "Connecting..." : "Apple"}
          </button>
        </div>

        <div className="auth-divider">
          <span>Email sign in</span>
        </div>

        <form className="auth-form" onSubmit={handleEmailLogin}>
          <label>
            Email address
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@campusxi.edu"
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="events-alert events-alert--error">{error}</p> : null}

          <button className="events-button events-button--full" disabled={isPending} type="submit">
            {pendingProvider === "email" ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getRedirectPath() {
  const params = new URLSearchParams(window.location.search);
  const redirectPath = params.get("redirect");

  if (!redirectPath?.startsWith("/") || redirectPath.startsWith("//")) {
    return "/events";
  }

  return redirectPath;
}
