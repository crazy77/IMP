import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

// Disable static generation for this route
export const dynamic = 'force-dynamic';

