import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Compass,
  MessageSquare,
  Repeat2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";

const exchangeSteps = [
  { icon: Compass, title: "Find the right person", description: "Search by skill, experience, format, availability, and verified teaching evidence." },
  { icon: Repeat2, title: "Agree on a fair exchange", description: "Swap skills directly or use SkillCredits when the exchange is not mutual." },
  { icon: CalendarDays, title: "Book time that works", description: "Set a format and schedule with conflict-safe availability and clear confirmations." },
  { icon: BadgeCheck, title: "Build lasting proof", description: "Reviews, projects, progress, and certificates strengthen your professional profile." },
];

export default function HomePage() {
  const { isAuthenticated, databaseMode } = useSelector((state) => state.auth);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <section className="grid min-h-[calc(100dvh-7.5rem)] items-center gap-10 py-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-16 lg:py-16">
        <div className="max-w-xl">
          <p className="mb-5 text-sm font-semibold text-accent">Peer-to-peer learning</p>
          <h1 className="font-heading text-4xl font-bold leading-[1.06] tracking-[-0.045em] text-text-primary sm:text-5xl lg:text-6xl">
            Teach one skill. Learn another.
          </h1>
          <p className="mt-6 max-w-[58ch] text-base leading-7 text-text-secondary sm:text-lg">
            Learn through a direct skill exchange, use SkillCredits when the trade is not mutual, or review a mentor's paid terms before you book.
          </p>
          <p className="mt-3 max-w-[58ch] text-sm leading-6 text-text-secondary">
            Paid checkout is intentionally disabled in this local build until an approved payment provider is configured.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Button asChild size="lg">
                <Link to="/dashboard">Open dashboard <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg"><Link to={databaseMode === "demo" ? "/login" : "/register"}>{databaseMode === "demo" ? "Open read-only demo" : "Create account"}</Link></Button>
                <Button asChild size="lg" variant="secondary"><Link to="/login">{databaseMode === "demo" ? "Choose demo role" : "Log in"}</Link></Button>
              </>
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" />Privacy controls</span>
            <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-accent" />Verified evidence</span>
            <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4 text-accent" />Relationship-safe chat</span>
          </div>
        </div>

        <figure className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-glass">
          <img
            src="/images/skillswap-collaboration-hero.webp"
            alt="Two peers sharing software and design skills at a studio table"
            width="1448"
            height="1086"
            loading="eager"
            fetchpriority="high"
            decoding="async"
            className="aspect-[4/3] h-full w-full object-cover"
          />
        </figure>
      </section>

      <section className="grid gap-10 border-t border-border py-16 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:py-24">
        <div>
          <h2 className="font-heading text-3xl font-bold text-text-primary sm:text-4xl">A clear path from interest to progress</h2>
          <p className="mt-4 max-w-lg leading-7 text-text-secondary">
            SkillSwap keeps discovery, agreements, sessions, and proof connected so every exchange has useful context.
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {exchangeSteps.map(({ icon: Icon, title, description }) => (
            <article key={title} className="border-t border-border pt-5">
              <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-bold text-text-primary sm:text-4xl">More than a directory</h2>
          <p className="mt-4 leading-7 text-text-secondary">Move from a useful introduction to a completed learning outcome without stitching together separate tools.</p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-12">
          <Card className="overflow-hidden border-accent/25 bg-accent/10 lg:col-span-7 lg:row-span-2">
            <CardContent className="flex h-full min-h-72 flex-col justify-between p-7 sm:p-9">
              <Sparkles className="h-7 w-7 text-accent" aria-hidden="true" />
              <div>
                <h3 className="font-heading text-2xl font-semibold text-text-primary">Relevant people, with reasons</h3>
                <p className="mt-3 max-w-xl leading-7 text-text-secondary">Explainable matching weighs complementary skills, availability, learning preferences, reputation, and compatible exchange terms.</p>
                <Button asChild variant="secondary" className="mt-6"><Link to={isAuthenticated ? "/discover" : databaseMode === "demo" ? "/login" : "/register"}>Explore matches <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-5">
            <CardContent className="p-7">
              <MessageSquare className="h-6 w-6 text-accent" aria-hidden="true" />
              <h3 className="mt-5 font-heading text-xl font-semibold text-text-primary">One accountable conversation</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Keep proposals, bookings, shared resources, and session context close to the people involved.</p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-5">
            <CardContent className="p-7">
              <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
              <h3 className="mt-5 font-heading text-xl font-semibold text-text-primary">Trust you can inspect</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Verified skills, structured reviews, privacy choices, reporting, and credential checks make evidence visible.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {!isAuthenticated && (
        <section className="border-y border-border py-16 sm:py-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-text-primary sm:text-3xl">Start with one skill</h2>
              <p className="mt-2 max-w-xl text-text-secondary">Add what you can teach and what you want to learn. SkillSwap will help with the rest.</p>
            </div>
            <Button asChild size="lg"><Link to={databaseMode === "demo" ? "/login" : "/register"}>{databaseMode === "demo" ? "Open demo" : "Create account"}</Link></Button>
          </div>
        </section>
      )}

      <footer className="flex flex-col gap-4 py-8 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="font-heading text-base font-semibold text-text-primary">SkillSwap</Link>
        <div className="flex items-center gap-5">
          <Link to={isAuthenticated ? "/safety" : "/login"} className="hover:text-text-primary">Safety</Link>
          <Link to={isAuthenticated ? "/settings" : "/register"} className="hover:text-text-primary">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
