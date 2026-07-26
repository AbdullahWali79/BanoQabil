import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';

function App() {
  const { setUser, setRole, setStatus, setLoading } = useAuthStore();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch role and status from profiles
        supabase
          .from('profiles')
          .select('status, roles(name)')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            // @ts-ignore
            setRole(data?.roles?.name ?? null);
            setStatus(data?.status ?? null);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('status, roles(name)')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
             // @ts-ignore
            setRole(data?.roles?.name ?? null);
            setStatus(data?.status ?? null);
            setLoading(false);
          });
      } else {
        setRole(null);
        setStatus(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setRole, setStatus, setLoading]);

  return <AppRoutes />;
}

export default App;
