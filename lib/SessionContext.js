"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getOrCreateSession, registerUser } from "./api-client";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    getOrCreateSession()
      .then((data) => {
        setState({
          user: data.user || null,
          session: data.session || data,
          loading: false,
        });
      })
      .catch(() => {
        setState((s) => ({ ...s, loading: false }));
      });
  }, []);

  const login = useCallback((userData) => {
    setState((s) => ({ ...s, user: userData }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("debate_session_token");
    setState({ user: null, session: null, loading: false });
    // Re-create anonymous session
    getOrCreateSession().then((data) => {
      setState({ user: null, session: data.session || data, loading: false });
    });
  }, []);

  const register = useCallback(
    async (username, email) => {
      const result = await registerUser(username, email, state.session?.id);
      if (result.user) {
        setState((s) => ({ ...s, user: result.user }));
      }
      return result;
    },
    [state.session]
  );

  return (
    <SessionContext.Provider value={{ ...state, login, logout, register }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
