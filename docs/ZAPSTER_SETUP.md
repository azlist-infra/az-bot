# Configuração do Zapster API

Este documento explica como migrar do Z-API para o Zapster API temporariamente.

## Configuração das Variáveis de Ambiente

1. **Edite o arquivo `.env` do seu projeto:**

```bash
# Habilitar Zapster (desabilita Z-API automaticamente)
USE_ZAPSTER=true

# Configurações do Zapster
ZAPSTER_BASE_URL=https://api.zapsterapi.com/v1
ZAPSTER_TOKEN=seu_token_aqui
ZAPSTER_INSTANCE_ID=seu_instance_id_aqui
```

2. **Mantenha as configurações do Z-API para facilitar o retorno:**

```bash
# Z-API Configuration (será ignorada quando USE_ZAPSTER=true)
ZAPI_INSTANCE_ID=3E61A257DA964054FE9AEE8B84927FE4
ZAPI_TOKEN=0B77F300F002A58B8FCA3EBD
ZAPI_CLIENT_TOKEN=<opcional>
```

## Configuração do Webhook no Zapster

1. **Obtenha seu `instance_id` e `token`:**
   - Acesse o painel do Zapster
   - Anote o `instance_id` da sua instância
   - Obtenha seu token de autenticação

2. **Configure o webhook via API:**

```bash
curl --request POST \
  --url https://api.zapsterapi.com/v1/wa/instances/SEU_INSTANCE_ID/webhooks \
  --header 'Authorization: Bearer SEU_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "enabled": true,
  "events": [
    "message.received"
  ],
  "name": "AZ WhatsApp Bot Webhook",
  "url": "https://seu-dominio.com/webhook/zapster/receive"
}'
```

3. **URL do webhook:**
   - Para desenvolvimento: `http://localhost:3000/webhook/zapster/receive`
   - Para produção: `https://seu-dominio.com/webhook/zapster/receive`

## Endpoints Disponíveis

### Webhooks
- `POST /webhook/zapster/receive` - Recebe eventos do Zapster
- `PUT /webhook/zapster/receive` - Recebe eventos do Zapster (método alternativo)
- `GET /webhook/zapster/receive` - Health check básico

### Health Check
- `GET /webhook/health` - Verifica status do serviço ativo (Zapster ou Z-API)

## Estrutura dos Eventos Zapster

### Evento `message.received`

```json
{
  "created_at": "2025-01-30T13:55:46.420Z",
  "data": {
    "content": {
      "text": "Oi"
    },
    "id": "3AAB4DA4297176B74E38",
    "recipient": {
      "name": "Nome do Destinatário",
      "id": "551112341234",
      "profile_picture": "https://zapsterapi.s3.us-east-1.amazonaws.com/...",
      "type": "chat"
    },
    "sender": {
      "name": "Nome do Remetente",
      "id": "551112341234",
      "profile_picture": "https://zapsterapi.s3.us-east-1.amazonaws.com/..."
    },
    "sent_at": "2025-01-30T13:55:46.000Z",
    "type": "text"
  },
  "id": "y66lhiw5la6z3r8f1urm0",
  "type": "message.received"
}
```

## Testando a Configuração

1. **Inicie o servidor:**
```bash
npm start
# ou
npm run dev
```

2. **Verifique o health check:**
```bash
curl http://localhost:3000/webhook/health
```

Resposta esperada:
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "zapster": "connected"
  },
  "activeService": "zapster",
  "timestamp": "2025-01-30T14:00:00.000Z"
}
```

3. **Teste enviando uma mensagem:**
   - Envie uma mensagem para o número conectado à instância Zapster
   - Verifique os logs do servidor para confirmar o recebimento
   - O bot deve responder pedindo o CPF

## Logs e Debugging

O sistema salva logs detalhados de todas as requisições webhook para debugging. Os logs incluem:

- Headers da requisição
- Corpo da requisição
- IP de origem
- Timestamp
- Resultado do processamento

## Voltando para Z-API

Para voltar a usar Z-API, simplesmente altere:

```bash
USE_ZAPSTER=false
```

O sistema automaticamente voltará a usar o Z-API e o endpoint `/webhook/zapi/receive`.

## Tipos de Mensagem Suportados

Atualmente o bot processa apenas mensagens de texto (`type: "text"`). Outros tipos de mensagem são ignorados:

- `image` - Mensagens com imagem
- `audio` - Mensagens de áudio
- `location` - Mensagens de localização
- `sticker` - Stickers
- `document` - Documentos
- `video` - Vídeos

## Troubleshooting

### Erro: "Zapster instance ID not configured"
- Verifique se `ZAPSTER_INSTANCE_ID` está definido no `.env`
- Confirme que `USE_ZAPSTER=true`

### Webhook não recebe mensagens
- Verifique se a URL do webhook está correta no painel Zapster
- Confirme que o servidor está acessível publicamente
- Verifique os logs do Zapster no painel administrativo

### Mensagens não são enviadas
- Verifique se `ZAPSTER_TOKEN` está correto
- Confirme se a instância está conectada no painel Zapster
- Verifique os logs do servidor para erros de API

### Health check retorna "disconnected"
- Confirme se o token e instance_id estão corretos
- Verifique se a instância está ativa no painel Zapster
- Teste a conectividade com a API Zapster manualmente

## Documentação Adicional

- [Zapster API Documentation](https://developer.zapsterapi.com/pt-BR/v1/webhooks/setting-up-webhook)
- [Zapster Webhook Events](https://developer.zapsterapi.com/pt-BR/v1/webhooks/available-events)
- [Zapster Message Sending](https://developer.zapsterapi.com/pt-BR/v1/api-reference/messages/sending)
