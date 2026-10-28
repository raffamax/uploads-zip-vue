export function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("over_email_send_rate_limit") || message.includes("email rate limit exceeded")) {
    return "O limite de e-mails de cadastro foi atingido. Aguarde um pouco ou configure um servidor SMTP no Supabase.";
  }
  if (message.includes("invalid login credentials")) return "E-mail ou senha inválidos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered")) return "Este e-mail já está cadastrado.";
  if (message.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (message.includes("invalid email")) return "Informe um e-mail válido.";
  if (message.includes("network") || message.includes("fetch")) return "Não foi possível conectar ao servidor. Tente novamente.";
  if (message.includes("duplicate") || message.includes("already exists")) return "Já existe um arquivo com este nome.";
  if (message.includes("payload too large") || message.includes("file size")) return "O arquivo é muito grande para ser enviado.";
  if (message.includes("permission") || message.includes("not authorized") || message.includes("row-level security")) return "Você não tem permissão para realizar esta ação.";
  return fallback;
}
