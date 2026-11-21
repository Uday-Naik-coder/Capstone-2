import { useAuth } from './AuthContext.jsx';
import { LoginPage } from './LoginPage.jsx';

// Gates children behind authentication. Shows the login page when signed out.
export function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;
  return children;
}