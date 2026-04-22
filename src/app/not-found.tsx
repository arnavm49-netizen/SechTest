import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-grey px-6">
      <div className="max-w-sm text-center">
        <p className="text-6xl font-semibold tracking-tight text-brand-red">404</p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-brand-black">Page not found</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-brand-black/50">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-brand-black px-5 text-sm font-medium text-brand-white transition-colors hover:bg-brand-black/85"
          href="/"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
