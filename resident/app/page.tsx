import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RoomlyLogo } from "@/components/roomly/primitives";
export default function Page() {
  return (
    <>
      <header className="landing-header">
        <RoomlyLogo />
        <Link href="/sign-in" className="button secondary">
          Come on in
          <ArrowRight size={16} aria-hidden />
        </Link>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="landing-wordmark">roomly.</div>
            <h1>
              Everything you need
              <br />
              to feel at home.
            </h1>
            <p>
              Your home’s essentials, helpful answers and the people who keep
              things running. All in one familiar place.
            </p>
            <Link className="button primary" href="/sign-in">
              Find your home
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link className="button secondary" href="/sign-in?role=manager">
              I manage a home
            </Link>
          </div>
          <div className="landing-art" aria-hidden />
        </section>
        <section className="landing-detail">
          <div>
            <span className="eyebrow">A warmer welcome</span>
            <h2 className="section">
              Less wondering.
              <br />
              More settling in.
            </h2>
          </div>
          <div>
            <p>
              From the Wi-Fi to the recycling, Roomly keeps the everyday details
              clear and current. Ask a question, find your guide, or let your
              manager know something needs attention.
            </p>
            <Link className="text-button" href="/sign-in">
              Open Roomly
              <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
