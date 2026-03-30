import { useUser, useClerk } from "@clerk/clerk-react";
import { useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const { user, isLoaded } = useUser();
  const { openSignIn, signOut } = useClerk();

  const login = useCallback(() => {
    openSignIn({
      afterSignInUrl: "/",
      afterSignUpUrl: "/",
    });
  }, [openSignIn]);

  const logout = useCallback(() => {
    signOut().then(() => {
      window.location.href = "/";
    });
  }, [signOut]);

  const authUser: AuthUser | null =
    isLoaded && user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          profileImageUrl: user.imageUrl ?? null,
        }
      : null;

  return {
    user: authUser,
    isLoading: !isLoaded,
    isAuthenticated: isLoaded && !!user,
    login,
    logout,
  };
}
