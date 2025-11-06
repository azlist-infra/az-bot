/**
 * Message Templates Configuration
 * Centralized messages for the WhatsApp bot
 */

export const MESSAGES = {
  // Initial greeting when user sends first message - CPF flow
  INITIAL_PROMPT_CPF: `Olá, sou o assistente virtual do *AZ List*  🤩!\n
  Por aqui você pode consultar o seu QR Code de acesso ao evento.\n
  É bem sim simples, vou te ajudar! 🦾\n

  Digite o seu CPF, sem espaços, sem pontos, sem hífens, apenas números e sem outro texto.\n
  Exemplo: 00000000000 `,

  // Initial greeting when user sends first message - Email flow  
  INITIAL_PROMPT_EMAIL: `Olá, sou o assistente virtual do *AZ List*  🤩!\n
  Aqui você pode consultar *o seu QR Code de acesso ao evento* de forma rápida e fácil..\n
  🦾 Vamos lá!\n

  Digite *somente o e-mail* utilizado no seu cadastro — sem textos adicionais.\n
  Exemplo: email@example.com `,

  // When CPF format is invalid
  INVALID_CPF: `CPF inválido. Tente novamente (apenas números, 11 dígitos).`,

  // When Email format is invalid
  INVALID_EMAIL: `E-mail inválido. Tente novamente com um formato válido.\nExemplo: email@example.com`,

  // When CPF is found in AZ List
  FOUND_MESSAGE: `Localizamos o seu cadastro, segue o seu QR Code de Acesso.`,

  // Caption for QR Code image when found
  FOUND_CAPTION: `\n\nSegue o seu QR Code de acesso ao evento. Você pode conferir também no link abaixo:\nhttps://www.azcorporate.com.br/tm1/46367/nba-house\n\n📍 Villaggio JK | R. Funchal, 500 - Vila Olímpia, São Paulo - SP, 04551-060\n📅 Data: 09 de dezembro de 2025\n⏰ Das 18h00 às 21h00\n\nNos vemos lá! 👋🏼`,

  // When CPF is not found in AZ List
  NOT_FOUND: `Que pena, não foi possível localizar a sua confirmação de presença.

Caso já tenha feito a confirmação de presença, verifsique o seu QR Code de acesso no link abaixo:
https://www.netflixfeitoaqui.com.br \n

Lembrando que você precisa utilizar O mesmo e-mail que você recebeu o seu convite.
`,

  // System messages
  SYSTEM: {
    ERROR: `Desculpe, ocorreu um erro interno. Tente novamente em alguns minutos.`,
    RATE_LIMIT: `Muitas mensagens em pouco tempo. Aguarde um momento antes de tentar novamente.`,
    MAINTENANCE: `Sistema em manutenção. Tente novamente mais tarde.`,
  },

  // Validation messages
  VALIDATION: {
    CPF_EMPTY: `Por favor, digite seu CPF.`,
    CPF_TOO_SHORT: `CPF deve conter 11 dígitos. Tente novamente.`,
    CPF_TOO_LONG: `CPF deve conter apenas 11 dígitos. Tente novamente.`,
    CPF_INVALID_DIGITS: `CPF com dígitos verificadores inválidos. Verifique e tente novamente.`,
    CPF_ALL_SAME: `CPF não pode ter todos os dígitos iguais. Tente novamente.`,
  },
} as const;

/**
 * Get initial prompt message based on flow type
 */
export function getInitialPrompt(flowType: 'cpf' | 'email'): string {
  return flowType === 'email' ? MESSAGES.INITIAL_PROMPT_EMAIL : MESSAGES.INITIAL_PROMPT_CPF;
}

/**
 * Get invalid format message based on flow type
 */
export function getInvalidFormatMessage(flowType: 'cpf' | 'email'): string {
  return flowType === 'email' ? MESSAGES.INVALID_EMAIL : MESSAGES.INVALID_CPF;
}

/**
 * Get personalized message with user data
 */
export function getPersonalizedMessage(template: string, data: Record<string, string>): string {
  let message = template;
  
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    message = message.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return message;
}

/**
 * Get CPF validation message based on error type
 */
export function getCpfValidationMessage(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length === 0) {
    return MESSAGES.VALIDATION.CPF_EMPTY;
  }
  
  if (cleaned.length < 11) {
    return MESSAGES.VALIDATION.CPF_TOO_SHORT;
  }
  
  if (cleaned.length > 11) {
    return MESSAGES.VALIDATION.CPF_TOO_LONG;
  }
  
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return MESSAGES.VALIDATION.CPF_ALL_SAME;
  }
  
  return MESSAGES.VALIDATION.CPF_INVALID_DIGITS;
}
