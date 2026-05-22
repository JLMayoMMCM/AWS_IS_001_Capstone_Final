import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { BackLink } from "@/components/cloudcampus/back-link";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { getSession } from "@/lib/auth";
import {
  getBlogsByAuthor,
  getMember,
  getOfficerHistory,
  getProjectsByContributor,
} from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const { id } = await params;
  const member = await getMember(id);
  return { title: member ? member.name : "Member" };
}

export default async function MemberDetailPage({ params }: Params) {
  const { id } = await params;
  const session = await getSession();

  // Member detail is gated to logged-in members (FR-PUB-04 / FR-MEM-02).
  if (session.role === "guest") return <AccessDenied />;

  const member = await getMember(id);
  if (!member) notFound();

  const [history, contributed, authored] = await Promise.all([
    getOfficerHistory(member.id),
    getProjectsByContributor(member.id),
    getBlogsByAuthor(member.id),
  ]);

  const isMe = session.memberId === member.id;
  const yearLabel =
    member.status === "Alumni"
      ? "Alumni"
      : member.year
        ? `Year ${member.year}`
        : "Member";

  return (
    <div className="space-y-6">
      <BackLink href="/members" label="Members" />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Profile header */}
        <div className="lg:col-span-4">
          <div className="space-y-3 rounded-xl bg-card p-6 text-center text-card-foreground ring-1 ring-foreground/10 lg:sticky lg:top-20">
            <div className="flex justify-center">
              <UserAvatar
                name={member.name}
                memberId={member.id}
                size="3xl"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                {member.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {[member.course, yearLabel].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex justify-center">
              <Badge
                variant={member.status === "Alumni" ? "outline" : "secondary"}
              >
                {member.status}
              </Badge>
            </div>
            <Separator />
            {isMe ? (
              <Button asChild className="w-full">
                <Link href="/profile">Edit profile</Link>
              </Button>
            ) : (
              member.email && (
                <Button asChild variant="secondary" className="w-full">
                  <a href={`mailto:${member.email}`}>
                    <Mail /> Email
                  </a>
                </Button>
              )
            )}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8 lg:col-span-8">
          {member.bio && (
            <section className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">
                About
              </h2>
              <p className="max-w-prose leading-relaxed text-foreground/90">
                {member.bio}
              </p>
            </section>
          )}

          {history.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">
                Officer history
              </h2>
              <div className="space-y-2">
                {history.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-xl bg-card p-4 ring-1 ring-foreground/10"
                  >
                    <div>
                      <div className="font-medium">{o.position}</div>
                      <div className="text-sm text-muted-foreground">
                        {o.term}
                      </div>
                    </div>
                    {o.isApprover && (
                      <Badge variant="outline">Approver</Badge>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {contributed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">
                Projects contributed
              </h2>
              <div className="space-y-2">
                {contributed.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <div className="font-medium">{p.title}</div>
                    <div className="line-clamp-1 text-sm text-muted-foreground">
                      {p.summary}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {authored.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">
                Blogs authored
              </h2>
              <ul className="space-y-1">
                {authored.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/blogs/${b.slug}`}
                      className="flex items-center justify-between gap-3 rounded-md p-3 transition-colors hover:bg-accent"
                    >
                      <span className="font-medium">{b.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {b.dateLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
