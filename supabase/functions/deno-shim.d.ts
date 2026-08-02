// Ambient types for Supabase Edge Functions (Deno).
// This folder is NOT part of the Vite/Node app build.

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  export const env: Env;
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.49.1' {
  // Minimal typing — runtime is Deno on Supabase, not the Vite TS project.
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Record<string, unknown>,
  ): {
    auth: {
      getUser: (jwt?: string) => Promise<{
        data: { user: { id: string; email?: string | null } | null };
        error: { message: string } | null;
      }>;
      admin: {
        updateUserById: (
          id: string,
          attributes: Record<string, unknown>,
        ) => Promise<{
          data: { user: { id: string } | null };
          error: { message: string } | null;
        }>;
      };
    };
    from: (table: string) => {
      select: (columns?: string) => any;
      update: (values: Record<string, unknown>) => any;
      eq: (column: string, value: unknown) => any;
      maybeSingle: () => any;
    };
  };
}
