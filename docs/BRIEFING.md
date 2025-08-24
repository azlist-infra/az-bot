# AZ-WhatsApp - Briefing do Projeto

## 📋 Escopo (MVP)

### Fluxo Principal
1. **Receber mensagem** → pedir CPF → validar CPF
2. **Consultar AZ List** `GET /api/pax/cpf/{cpf}/event/{idEvent}`
3. **Se existir**: gerar QR (base64 do `{"SearchKey": "<SearchKey>"}`) e enviar imagem + caption
4. **Se não existir**: enviar mensagem com link de auto-consulta
5. **Persistir** mensagens e estado básico da conversa

## 🔄 Fluxo Detalhado

### 1. Usuário manda qualquer mensagem
**Bot responde:**
```
Olá, aqui você pode consultar o seu QR Code de acesso para o FENTY BEAUTY COFFEE PARTY!

Digite o seu CPF (00000000000 ou 000.000.000-00).
```

### 2. Usuário envia CPF

#### ✅ Se encontrado:
**Mensagem:**
```
Localizamos o seu cadastro, segue o seu QR Code de Acesso.
```

**Imagem:** QRCode gerado + Caption:
```
APRESENTE NA ENTRADA – NÃO REPASSE PARA NINGUÉM
```

#### ❌ Se não encontrado:
**Mensagem:**
```
Que pena, não foi possível localizar o seu agendamento.

Caso já tenha feito o agendamento, verifique o horário e o seu QR Code de acesso no link abaixo:
https://www.azcorporate.com.br/bvolt/46110/fenty
```

#### ⚠️ CPF Inválido:
```
CPF inválido. Tente novamente (apenas números, 11 dígitos).
```

## 🔗 Integrações

### AZ List API
- **Produção:** `https://api-rds-aztools.onrender.com`
- **Token:** `YmxzLmZlbGlwZWRhczpkaXdlZndoaXVkamlvYXNkam5lYm5lbw==`
- **Endpoint:** `GET /api/pax/cpf/{cpf}/event/{idEvent}`
- **Retorna:** dados do pax e listas

### Z-API (WhatsApp)
- **Docs:** https://developer.z-api.io/
- **Base URL:** `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`
- **Envio Texto:** `POST /send-text`
- **Envio Imagem:** `POST /send-image` (base64 com prefixo `data:image/png;base64,`)

## ✅ Requisitos Funcionais

- [x] Validar formato de CPF (11 dígitos) e dígitos verificadores
- [x] Perguntar novamente em caso de CPF inválido
- [x] **Idempotência:** múltiplas mensagens não devem duplicar envios
- [x] **Estado por remetente:** `awaiting_cpf` → `resolved_found` | `resolved_not_found`
- [x] Template de mensagens parametrizável

## 🏗️ Requisitos Não-Funcionais

- **Stack:** TypeScript + Express + Mongoose (MongoDB)
- **Arquitetura:** controllers / services / repositories / models / utils / config / middlewares
- **Escalabilidade:** Estrutura preparada para crescimento

## 🗄️ Modelagem do Banco de Dados

### Collection: `messages`
```typescript
{
  _id: ObjectId,
  from: string,              // telefone/whatsapp (obrigatório)
  message: string,           // conteúdo recebido ou enviado (obrigatório)
  caption?: string,          // opcional
  deliveredAt: Date,         // quando recebemos/enviamos (obrigatório)
  status: 'sent' | 'failed' | 'pending',
  direction: 'in' | 'out',   // entrada ou saída
  kind: 'text' | 'image' | 'system',
  meta?: object,             // ids da Z-API, etc.
  createdAt: Date,
  updatedAt: Date
}
```

### Collection: `conversations` (sugestão adicional)
```typescript
{
  _id: ObjectId,
  phoneNumber: string,       // chave única
  state: 'initial' | 'awaiting_cpf' | 'resolved_found' | 'resolved_not_found',
  cpf?: string,             // CPF fornecido
  lastMessageAt: Date,
  attempts: number,         // tentativas de CPF inválido
  createdAt: Date,
  updatedAt: Date
}
```

## 🌐 API Interna

### Webhook Z-API
```
POST /webhook/zapi/receive
```
Recebe mensagens do WhatsApp via webhook da Z-API.

## 📝 Templates de Mensagens

### Configuráveis via Environment/Config

```typescript
const MESSAGES = {
  INITIAL_PROMPT: `Olá, aqui você pode consultar o seu QR Code de acesso para o FENTY BEAUTY COFFEE PARTY!

Digite o seu CPF (00000000000 ou 000.000.000-00).`,

  INVALID_CPF: `CPF inválido. Tente novamente (apenas números, 11 dígitos).`,

  FOUND_CAPTION: `Localizamos o seu cadastro, segue o seu QR Code de Acesso.

APRESENTE NA ENTRADA – NÃO REPASSE PARA NINGUÉM.`,

  NOT_FOUND: `Que pena, não foi possível localizar o seu agendamento.

Caso já tenha feito o agendamento, verifique o horário e o seu QR Code de acesso no link abaixo:
https://www.azcorporate.com.br/bvolt/46110/fenty`
};
```

## 🔒 Segurança

- **QR Code Content:** Base64 de `{"SearchKey": "valor_do_searchkey"}`
- **Nota:** Base64 não é criptografia, mas o leitor já espera esse formato

## 🔧 Variáveis de Ambiente

```bash
# Server
PORT=3000
MONGO_URI=mongodb://localhost:27017/az-whatsapp

# Z-API
ZAPI_INSTANCE_ID=3E61A257DA964054FE9AEE8B84927FE4
ZAPI_TOKEN=0B77F300F002A58B8FCA3EBD
ZAPI_CLIENT_TOKEN=<preencher>

# AZ List
AZLIST_BASE_URL=https://api-rds-aztools.onrender.com
AZLIST_TOKEN=YmxzLmZlbGlwZWRhczpkaXdlZndoaXVkamlvYXNkam5lYm5lbw==
AZLIST_EVENT_ID=46110

# QR Code
QR_SIGN_SECRET=<opcional>
QR_WIDTH=512
```

## 🚀 Plano de Implementação

### Fase 1: Core (MVP)
1. ✅ Estrutura base do projeto
2. 🔄 Models (Message, Conversation)
3. 🔄 Service AZ List (consulta CPF)
4. 🔄 Service Z-API (envio mensagens/imagens)
5. 🔄 Service QR Code (geração)
6. 🔄 Controller Webhook
7. 🔄 Lógica de estado da conversa

### Fase 2: Melhorias
- Rate limiting por usuário
- Cache de consultas
- Métricas e analytics
- Interface admin
- Testes automatizados

### Fase 3: Escalabilidade
- Queue system (Redis/Bull)
- Multi-instância Z-API
- Logs estruturados
- Monitoramento
- CI/CD

## 📊 Métricas Importantes
- Mensagens processadas/hora
- Taxa de conversão (CPF encontrado vs não encontrado)
- Tempo de resposta médio
- Erros de integração
- QR Codes gerados

---

## 🎯 Objetivo
Criar um sistema simples, funcional e escalável para distribuição de QR Codes via WhatsApp com validação automatizada de cadastros.
