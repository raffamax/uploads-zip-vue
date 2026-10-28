import { onMounted, onUnmounted, ref } from "vue";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../utils/errors";

export function useAuth() {
  const user = ref<User | null>(null);
  const mode = ref<"login" | "signup">("login");
  const email = ref("");
  const password = ref("");
  const loading = ref(false);
  const error = ref("");
  const message = ref("");
  let unsubscribe = () => {};

  async function submit() {
    error.value = "";
    message.value = "";
    loading.value = true;
    try {
      if (mode.value === "login") {
        const result = await supabase.auth.signInWithPassword({
          email: email.value,
          password: password.value,
        });
        if (result.error) throw result.error;
        user.value = result.data.user;
      } else {
        const result = await supabase.auth.signUp({
          email: email.value,
          password: password.value,
        });
        if (result.error) throw result.error;

        if (result.data.session) {
          user.value = result.data.user;
        } else {
          // Fallback para projetos que não retornam a sessão imediatamente.
          const login = await supabase.auth.signInWithPassword({
            email: email.value,
            password: password.value,
          });
          if (login.error) throw login.error;
          user.value = login.data.user;
        }
      }

      email.value = "";
      password.value = "";
    } catch (cause) {
      error.value = friendlyError(cause, "Não foi possível concluir a autenticação.");
    } finally {
      loading.value = false;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    user.value = null;
  }

  onMounted(async () => {
    const { data } = await supabase.auth.getSession();
    user.value = data.session?.user ?? null;
    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null;
    });
    unsubscribe = () => listener.data.subscription.unsubscribe();
  });
  onUnmounted(() => unsubscribe());

  return {
    user,
    mode,
    email,
    password,
    loading,
    error,
    message,
    submit,
    signOut,
  };
}
