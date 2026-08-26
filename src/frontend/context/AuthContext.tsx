import React from 'react';

export interface UserContextType {
  id: string;
  email: string;
  companyId: string | null;
  companyName: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  plants: Array<{ id: string; code: string; name: string }>;
  departments: Array<{ id: string; code: string; name: string }>;
  isSuperAdmin?: boolean;
}

export interface AuthContextType {
  token: string | null;
  user: UserContextType | null;
  activePlantId: string | null;
  setActivePlantId: (id: string | null) => void;
  login: (token: string, user: UserContextType) => void;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = React.useState<string | null>(() => localStorage.getItem('p1_token'));
  const [user, setUser] = React.useState<UserContextType | null>(() => {
    const saved = localStorage.getItem('p1_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return {
      ...parsed,
      isSuperAdmin: parsed.roles?.includes('Super Admin'),
    };
  });
  const [activePlantId, setActivePlantId] = React.useState<string | null>(() => {
    return localStorage.getItem('p1_active_plant');
  });

  const login = (newToken: string, newUser: UserContextType) => {
    const formattedUser = {
      ...newUser,
      isSuperAdmin: newUser.roles?.includes('Super Admin'),
    };
    setToken(newToken);
    setUser(formattedUser);
    localStorage.setItem('p1_token', newToken);
    localStorage.setItem('p1_user', JSON.stringify(formattedUser));
    if (formattedUser.plants.length > 0) {
      setActivePlantId(formattedUser.plants[0].id);
      localStorage.setItem('p1_active_plant', formattedUser.plants[0].id);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setActivePlantId(null);
    localStorage.removeItem('p1_token');
    localStorage.removeItem('p1_user');
    localStorage.removeItem('p1_active_plant');
  };

  const handleSetActivePlant = (id: string | null) => {
    setActivePlantId(id);
    if (id) localStorage.setItem('p1_active_plant', id);
    else localStorage.removeItem('p1_active_plant');
  };

  return (
    <AuthContext.Provider value={{ token, user, activePlantId, setActivePlantId: handleSetActivePlant, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
