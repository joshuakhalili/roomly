import { authDestination } from "@/lib/auth/destination";
import { environment } from "@/lib/env";
import { RoomlyLogo } from "@/components/roomly/primitives";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const destination = authDestination(query.next, query.role);
  return (
    <main id="main" className="invite-page">
      <RoomlyLogo />
      <span className="eyebrow">Welcome to Roomly</span>
      <h1>Come on in.</h1>
      <p>
        {query.next?.startsWith("/invite/")
          ? "Sign in to continue to your private invitation."
          : "One place for the things that make a home work."}
      </p>
      {environment().demo ? (
        <>
          <div className="identity-grid">
            {[
              ["resident", "Maya", "Resident · explore Roomly Home"],
              ["manager", "Elena", "Manager · manage the home"],
              [
                "newResident",
                "New resident",
                "Claim an invitation and settle in",
              ],
              ["newManager", "New manager", "Set up a home from the beginning"],
            ].map(([id, name, description]) => (
              <form action="/api/demo" method="post" key={id}>
                <input type="hidden" name="identity" value={id} />
                <input
                  type="hidden"
                  name="next"
                  value={query.next ? destination : ""}
                />
                <button>
                  <strong>{name}</strong>
                  <small>{description}</small>
                </button>
              </form>
            ))}
          </div>
        </>
      ) : (
        <form action="/api/auth" method="post" className="form-stack section">
          <input type="hidden" name="next" value={destination} />
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <small>For a new account, use at least ten characters.</small>
          <button className="button primary" name="mode" value="sign-in">
            Sign in
          </button>
          <button className="button secondary" name="mode" value="sign-up">
            Create account
          </button>
          {query.error && (
            <p role="alert" className="error">
              {query.error === "validation"
                ? "Check your email and password. New accounts require at least ten password characters."
                : "We could not sign you in. Check your email and password."}
            </p>
          )}
          {query.check && (
            <p role="status">
              Check your email to confirm your account and continue where you
              left off.
            </p>
          )}
        </form>
      )}
      <section className="entry-next">
        <h2>From a good welcome to everyday help.</h2>
        <p>
          Residents join through a private invitation. Managers set up a home,
          publish its guide and welcome their residents.
        </p>
      </section>
    </main>
  );
}
