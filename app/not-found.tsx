import Link from "next/link";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <Container>
      <div className="flex flex-col items-start gap-3 py-10">
        <h1 className="text-xl font-bold text-zinc-900">Page not found.</h1>
        <p className="max-w-md text-sm text-zinc-500">
          The page you are looking for does not exist (yet — the storefront
          lands in the next phase).
        </p>
        <Link
          href="/"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Back to home
        </Link>
      </div>
    </Container>
  );
}
