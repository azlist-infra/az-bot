/**
 * CPF Validation Utilities
 * Validates Brazilian CPF format and check digits
 */

/**
 * Removes all non-numeric characters from CPF
 */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Formats CPF string to XXX.XXX.XXX-XX pattern
 */
export function formatCpf(cpf: string): string {
  const cleaned = cleanCpf(cpf);
  
  if (cleaned.length !== 11) {
    return cpf; // Return original if invalid length
  }
  
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Validates CPF format (11 digits)
 */
export function isValidCpfFormat(cpf: string): boolean {
  const cleaned = cleanCpf(cpf);
  
  // Must have exactly 11 digits
  if (cleaned.length !== 11) {
    return false;
  }
  
  // Cannot be all same digits (like 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Calculates CPF check digit
 */
function calculateCpfDigit(cpf: string, position: number): number {
  let sum = 0;
  let weight = position + 1;
  
  for (let i = 0; i < position; i++) {
    sum += parseInt(cpf[i]!) * weight--;
  }
  
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Validates CPF check digits (full validation)
 */
export function isValidCpf(cpf: string): boolean {
  // First check format
  if (!isValidCpfFormat(cpf)) {
    return false;
  }
  
  const cleaned = cleanCpf(cpf);
  
  // Calculate first check digit
  const firstDigit = calculateCpfDigit(cleaned, 9);
  if (firstDigit !== parseInt(cleaned[9]!)) {
    return false;
  }
  
  // Calculate second check digit
  const secondDigit = calculateCpfDigit(cleaned, 10);
  if (secondDigit !== parseInt(cleaned[10]!)) {
    return false;
  }
  
  return true;
}

/**
 * Extracts and validates CPF from message text
 * Supports formats: 12345678901, 123.456.789-01
 */
export function extractCpfFromMessage(message: string): string | null {
  // Remove extra whitespace and convert to lowercase
  const cleanMessage = message.trim().toLowerCase();
  
  // Pattern to match CPF in various formats
  const cpfPatterns = [
    /\b\d{11}\b/,                          // 12345678901
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,      // 123.456.789-01
    /\b\d{3}\s\d{3}\s\d{3}\s\d{2}\b/,     // 123 456 789 01
  ];
  
  for (const pattern of cpfPatterns) {
    const match = cleanMessage.match(pattern);
    if (match) {
      const extracted = cleanCpf(match[0]);
      if (isValidCpf(extracted)) {
        return extracted;
      }
    }
  }
  
  return null;
}

/**
 * Generates validation error message
 */
export function getCpfValidationError(cpf: string): string {
  const cleaned = cleanCpf(cpf);
  
  if (cleaned.length === 0) {
    return 'CPF não informado';
  }
  
  if (cleaned.length !== 11) {
    return 'CPF deve conter 11 dígitos';
  }
  
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return 'CPF não pode ter todos os dígitos iguais';
  }
  
  if (!isValidCpf(cpf)) {
    return 'CPF inválido (dígitos verificadores incorretos)';
  }
  
  return 'CPF válido';
}
