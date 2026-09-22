"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="invite-page">
      <h1>We couldn’t open this page.</h1>
      <p role="alert">
        Check your connection and try again. Your saved changes are safe.
      </p>
      <button className="button primary section" onClick={() => reset()}>
        Retry
      </button>
    </main>
  );
}
