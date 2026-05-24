import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Session, User } from "@supabase/supabase-js";

export interface RouterContext {
  queryClient: QueryClient;
  auth?: {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
  };
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { 
      queryClient,
      auth: undefined, // This will be provided by the RouterProvider
    } as RouterContext,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
