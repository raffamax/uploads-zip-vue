<script setup lang="ts">
defineProps<{
  mode: "login" | "signup";
  email: string;
  password: string;
  loading: boolean;
  error: string;
  message: string;
}>();
const emit = defineEmits<{
  submit: [];
  switchMode: [];
  "update:email": [value: string];
  "update:password": [value: string];
}>();
</script>
<template>
  <section class="card auth-card">
    <h1>{{ mode === "login" ? "Entrar" : "Criar conta" }}</h1>
    <p>
      {{
        mode === "login"
          ? "Entre para acessar seus arquivos enviados."
          : "Crie sua conta para manter seus arquivos privados e vinculados a você."
      }}
    </p>
    <form class="auth-form" @submit.prevent="emit('submit')">
      <label
        >E-mail<input
          :value="email"
          type="email"
          autocomplete="email"
          required
          @input="
            $emit('update:email', ($event.target as HTMLInputElement).value)
          "
      /></label>
      <label
        >Senha<input
          :value="password"
          type="password"
          autocomplete="current-password"
          minlength="6"
          required
          @input="
            $emit('update:password', ($event.target as HTMLInputElement).value)
          "
      /></label>
      <button class="primary" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner" aria-hidden="true"></span
        >{{
          loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"
        }}
      </button>
    </form>
    <p v-if="message" class="success">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>
    <button class="auth-switch" type="button" @click="emit('switchMode')">
      {{
        mode === "login" ? "Ainda não tenho uma conta" : "Já tenho uma conta"
      }}
    </button>
  </section>
</template>
