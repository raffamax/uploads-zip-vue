import { onMounted, onUnmounted, ref } from "vue";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

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
      const result =
        mode.value === "login"
          ? await supabase.auth.signInWithPassword({
              email: email.value,
              password: password.value,
            })
          : await supabase.auth.signUp({
              email: email.value,
              password: password.value,
            });
      if (result.error) throw result.error;
      if (mode.value === "signup" && !result.data.session) {
        message.value =
          "Cadastro realizado. Verifique seu e-mail para confirmar a conta.";
        mode.value = "login";
        return;
      }
      user.value = result.data.user;
      email.value = "";
      password.value = "";
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Não foi possível autenticar.";
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
