import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardIndicators from "@/components/DashboardIndicators";

interface PendingTask {
  id: string;
  title: string;
}

const POPUP_SHOWN_KEY = 'pendingTasksPopupShown';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const navigate = useNavigate();
  const hasShownPopupRef = useRef(false);

  const fetchPendingTasks = async (userId: string) => {
    try {
      const { data: memberTasks } = await supabase
        .from('task_members')
        .select('task_id')
        .eq('user_id', userId);

      if (memberTasks && memberTasks.length > 0) {
        const taskIds = memberTasks.map(mt => mt.task_id);
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title')
          .in('id', taskIds)
          .in('status', ['open', 'active']);

        if (tasks) {
          setPendingTasks(tasks);
          return tasks.length;
        }
      }
      setPendingTasks([]);
      return 0;
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
      setPendingTasks([]);
      return 0;
    }
  };

  const showPopupIfNeeded = async (userId: string) => {
    // Verificar se o popup já foi mostrado nesta sessão do navegador
    const alreadyShown = sessionStorage.getItem(POPUP_SHOWN_KEY);
    
    if (alreadyShown || hasShownPopupRef.current) {
      // Apenas atualizar as tarefas sem mostrar o popup
      await fetchPendingTasks(userId);
      return;
    }

    const count = await fetchPendingTasks(userId);
    if (count > 0) {
      setShowPendingPopup(true);
      sessionStorage.setItem(POPUP_SHOWN_KEY, 'true');
      hasShownPopupRef.current = true;
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        // Mostrar popup apenas no primeiro carregamento após login
        await showPopupIfNeeded(session.user.id);
      } else {
        // Limpar flag ao não ter sessão (logout)
        sessionStorage.removeItem(POPUP_SHOWN_KEY);
        navigate("/auth");
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          
          // Mostrar popup APENAS no evento SIGNED_IN real (não em TOKEN_REFRESHED ou visibilitychange)
          if (event === 'SIGNED_IN') {
            // Verificar se é um login genuíno (não apenas refresh de token)
            const alreadyShown = sessionStorage.getItem(POPUP_SHOWN_KEY);
            if (!alreadyShown && !hasShownPopupRef.current) {
              setTimeout(async () => {
                await showPopupIfNeeded(session.user.id);
              }, 100);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          // Limpar flag ao fazer logout
          sessionStorage.removeItem(POPUP_SHOWN_KEY);
          hasShownPopupRef.current = false;
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user} pendingTasks={pendingTasks}>
      {/* Conteúdo do Dashboard */}
      <DashboardIndicators userId={user?.id} />

      {/* Popup de tarefas pendentes ao logar */}
      <Dialog open={showPendingPopup} onOpenChange={setShowPendingPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-destructive" />
              Tarefas Pendentes
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-lg">
              Você possui <span className="font-bold text-destructive">{pendingTasks.length}</span> tarefa(s) pendente(s).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPendingPopup(false)}>
              Fechar
            </Button>
            <Button onClick={() => { setShowPendingPopup(false); navigate('/tasks'); }}>
              Ver Tarefas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Dashboard;
