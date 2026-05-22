import { SiteHeader } from "@/components/cloudcampus/site-header";
import { SiteFooter } from "@/components/cloudcampus/site-footer";

/**
 * Shell for all public, member, and officer pages: sticky top nav, a centred
 * content column, and the footer. Admin pages use a separate route group with
 * their own sidebar shell (added in a later phase).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-12 md:px-6 md:pt-10 lg:px-8"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
