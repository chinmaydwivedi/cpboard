import "server-only";

import { cache } from "react";
import { auth } from "@/lib/auth";

/** Deduplicates Auth.js session work across layouts and pages in one request. */
export const getCurrentSession = cache(async () => auth());
