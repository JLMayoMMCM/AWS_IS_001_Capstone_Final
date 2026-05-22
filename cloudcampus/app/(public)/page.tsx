import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BlogPreviewCard } from "@/components/cloudcampus/blog-preview-card";
import { EventPreviewCard } from "@/components/cloudcampus/event-preview-card";
import { OfficerPreviewCard } from "@/components/cloudcampus/officer-preview-card";
import { PlaceholderImage } from "@/components/cloudcampus/placeholder-image";
import {
  getLatestPublicBlogs,
  getOrg,
  getUpcomingPublicEvents,
  listOfficers,
} from "@/lib/queries";

/** Heading shared by the welcome page's content sections. */
function SectionHeading({
  children,
  seeAll,
}: {
  children: React.ReactNode;
  seeAll?: { href: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-[-0.01em] md:text-3xl">
        {children}
      </h2>
      {seeAll && (
        <Link
          href={seeAll.href}
          className="shrink-0 rounded-sm text-sm text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {seeAll.label} →
        </Link>
      )}
    </div>
  );
}

export default async function WelcomePage() {
  const [org, upcomingEvents, officers, latestBlogs] = await Promise.all([
    getOrg(),
    getUpcomingPublicEvents(3),
    listOfficers(),
    getLatestPublicBlogs(3),
  ]);
  const officerPreview = officers.slice(0, 4);

  return (
    <div className="space-y-12 md:space-y-20">
      {/* Hero */}
      <section className="grid gap-8 pt-4 md:pt-8 lg:grid-cols-12 lg:items-center">
        <div className="max-w-2xl text-center lg:col-span-7 lg:text-left">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.02em] md:text-5xl">
            {org.tagline}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {org.about[0]}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row sm:justify-start sm:gap-3">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/login">Join {org.shortName}</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <a href="#about">Learn more</a>
            </Button>
          </div>
        </div>
        <div className="lg:col-span-5">
          <PlaceholderImage
            alt="Students collaborating at a CloudCampus workshop"
            aspect="aspect-[4/3]"
            className="rounded-xl ring-1 ring-foreground/10"
          />
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 space-y-4">
        <h2 className="text-2xl font-semibold tracking-[-0.01em] md:text-3xl">
          About
        </h2>
        <div className="max-w-prose space-y-4 leading-relaxed text-foreground/90">
          {org.about.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <section className="space-y-4">
          <SectionHeading seeAll={{ href: "/events", label: "See all" }}>
            Upcoming events
          </SectionHeading>
          <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventPreviewCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Current officers */}
      {officerPreview.length > 0 && (
        <section className="space-y-4">
          <SectionHeading seeAll={{ href: "/officers", label: "See all" }}>
            Current officers
          </SectionHeading>
          <div className="grid gap-4 lg:grid-cols-4">
            {officerPreview.map((officer) => (
              <OfficerPreviewCard
                key={officer.id}
                name={officer.name}
                position={officer.position}
              />
            ))}
          </div>
        </section>
      )}

      {/* Latest blogs */}
      {latestBlogs.length > 0 && (
        <section className="space-y-4">
          <SectionHeading seeAll={{ href: "/blogs", label: "All posts" }}>
            Latest from the blog
          </SectionHeading>
          <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
            {latestBlogs.map((blog) => (
              <BlogPreviewCard key={blog.id} blog={blog} />
            ))}
          </div>
        </section>
      )}

      {/* Get involved */}
      <section className="-mx-4 rounded-xl bg-muted px-4 py-10 md:-mx-6 md:px-6 md:py-14 lg:-mx-8 lg:px-8">
        <div className="grid gap-4 md:grid-cols-12 md:items-center">
          <div className="md:col-span-8">
            <h2 className="text-2xl font-semibold tracking-[-0.01em] md:text-3xl">
              Ready to get involved?
            </h2>
            <p className="mt-2 max-w-prose text-muted-foreground">
              Membership is open to every student curious about technology.
              Sign in to access the member directory, private resources, and
              event submissions — or reach out to an officer to learn more.
            </p>
          </div>
          <div className="md:col-span-4 md:text-right">
            <Button asChild>
              <Link href="/login">Become a member</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
