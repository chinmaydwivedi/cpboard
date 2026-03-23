import Link from "next/link";
import { Mail } from "lucide-react";

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-sm px-5 pt-24">
      <div className="rounded-lg border border-border/60 p-8 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <h1 className="font-heading text-xl italic">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A sign-in link has been sent to your email address.
          Click the link to complete your sign in.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Didn&apos;t receive it? Try again
        </Link>
      </div>
    </div>
  );
}
