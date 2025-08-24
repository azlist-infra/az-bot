/**
 * Message Templates Configuration
 * Centralized messages for the WhatsApp bot
 */

export const MESSAGES = {
  // Initial greeting when user sends first message
  INITIAL_PROMPT: `Olá, aqui você pode consultar o seu QR Code de acesso para o FENTY BEAUTY COFFEE PARTY!

Digite o seu CPF (00000000000 ou 000.000.000-00).`,

  // When CPF format is invalid
  INVALID_CPF: `CPF inválido. Tente novamente (apenas números, 11 dígitos).`,

  // When CPF is found in AZ List
  FOUND_MESSAGE: `Localizamos o seu cadastro, segue o seu QR Code de Acesso.`,

  // Caption for QR Code image when found
  FOUND_CAPTION: `APRESENTE NA ENTRADA – NÃO REPASSE PARA NINGUÉM`,

  // When CPF is not found in AZ List
  NOT_FOUND: `Que pena, não foi possível localizar o seu agendamento.

Caso já tenha feito o agendamento, verifique o horário e o seu QR Code de acesso no link abaixo:
https://www.azcorporate.com.br/bvolt/46110/fenty`,

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
