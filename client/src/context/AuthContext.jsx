import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

// Set up axios to always include Authorization header when token exists
const setupAxiosInterceptor = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // check localStorage on mount

  // On app load: restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("ib_token");
    const savedUser = localStorage.getItem("ib_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setupAxiosInterceptor(savedToken);
    }
    setLoading(false);
  }, []);

  const login = (tokenVal, userVal) => {
    setToken(tokenVal);
    setUser(userVal);
    localStorage.setItem("ib_token", tokenVal);
    localStorage.setItem("ib_user", JSON.stringify(userVal));
    setupAxiosInterceptor(tokenVal);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("ib_token");
    localStorage.removeItem("ib_user");
    setupAxiosInterceptor(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
