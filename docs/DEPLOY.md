# Guia de Deploy - AZ-WhatsApp

## 🚀 Deploy para Produção

### ✅ **Método Padrão (Node.js)**

```bash
# 1. Clone o repositório
git clone git@github.com:azlist-infra/az-bot.git
cd az-bot

# 2. Configure variáveis de ambiente
cp env.example .env
# Edite o .env com suas credenciais reais

# 3. Instale dependências
npm install

# 4. Build para produção
npm run build

# 5. Execute em produção
npm run start:prod
```

### 🐳 **Deploy com Docker**

```bash
# 1. Build da imagem
docker build -t az-whatsapp .

# 2. Execute o container
docker run -d \
  --name az-whatsapp \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  az-whatsapp
```

### ☁️ **Deploy em Plataformas Cloud**

#### **Railway**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login e deploy
railway login
railway init
railway up
```

#### **Heroku**
```bash
# 1. Install Heroku CLI
# 2. Setup
heroku create az-whatsapp-prod
git push heroku main

# 3. Configure env vars
heroku config:set MONGO_URI="mongodb+srv://..."
heroku config:set ZAPI_INSTANCE_ID="..."
heroku config:set ZAPI_TOKEN="..."
# ... outras variáveis
```

#### **Vercel**
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod
```

#### **DigitalOcean App Platform**
```bash
# Use o GitHub integration
# Configure as env vars no painel
```

### 🔧 **Scripts de Produção**

| Script | Descrição |
|--------|-----------|
| `npm run build` | Compila TypeScript para JavaScript |
| `npm start` | Executa versão compilada |
| `npm run start:prod` | Executa com NODE_ENV=production |
| `npm run deploy` | Instala deps + build + start |
| `npm run clean` | Remove pasta dist |

### 📋 **Variáveis de Ambiente Obrigatórias**

```bash
# Servidor
NODE_ENV=production
PORT=3000

# MongoDB (use MongoDB Atlas para produção)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/az-whatsapp

# Z-API (suas credenciais reais)
ZAPI_INSTANCE_ID=SEU_INSTANCE_ID
ZAPI_TOKEN=SEU_TOKEN
ZAPI_CLIENT_TOKEN=SEU_CLIENT_TOKEN

# AZ List (configurações do briefing)
AZLIST_BASE_URL=https://api-rds-aztools.onrender.com
AZLIST_TOKEN=YmxzLmZlbGlwZWRhczpkaXdlZndoaXVkamlvYXNkam5lYm5lbw==
AZLIST_EVENT_ID=46110

# QR Code
QR_SIGN_SECRET=sua_chave_secreta_opcional
QR_WIDTH=512

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CORS
CORS_ORIGIN=*
```

### 🗄️ **Configuração MongoDB Produção**

**Recomendado:** MongoDB Atlas (Cloud)

1. Crie conta em [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crie cluster gratuito
3. Configure IP whitelist (0.0.0.0/0 para começar)
4. Crie usuário de banco
5. Obtenha string de conexão
6. Configure `MONGO_URI` no .env

### 🔗 **Configuração Z-API**

1. **Configure webhook** para:
   ```
   https://seu-dominio.com/api/webhook/zapi/receive
   ```

2. **Teste conexão:**
   ```bash
   curl https://seu-dominio.com/api/webhook/health
   ```

### 🌐 **Configuração de Domínio**

#### **Com Nginx (Reverse Proxy)**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### **SSL com Certbot**
```bash
sudo certbot --nginx -d seu-dominio.com
```

### 📊 **Monitoramento**

#### **Health Checks**
```bash
# API geral
curl https://seu-dominio.com/api/health

# Webhook específico
curl https://seu-dominio.com/api/webhook/health

# Estatísticas
curl https://seu-dominio.com/api/webhook/stats
```

#### **Logs**
```bash
# Ver logs em tempo real
tail -f logs/app.log

# Logs de erro
tail -f logs/error.log
```

### 🔄 **Process Manager (PM2)**

Para manter a aplicação rodando:

```bash
# 1. Instalar PM2
npm install -g pm2

# 2. Criar ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'az-whatsapp',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# 3. Iniciar com PM2
pm2 start ecosystem.config.js

# 4. Configurar para iniciar no boot
pm2 startup
pm2 save
```

### 🛡️ **Segurança em Produção**

1. **Firewall:**
   ```bash
   # Liberar apenas portas necessárias
   ufw allow 22    # SSH
   ufw allow 80    # HTTP
   ufw allow 443   # HTTPS
   ufw enable
   ```

2. **Environment:**
   - Use variáveis de ambiente para credenciais
   - Nunca commite .env no Git
   - Use secrets management (AWS Secrets, Azure Key Vault, etc.)

3. **Rate Limiting:**
   - Configure adequadamente no .env
   - Considere CloudFlare ou AWS WAF

### 🧪 **Teste de Produção**

```bash
# 1. Health check
curl https://seu-dominio.com/api/health

# 2. Webhook test
curl -X POST https://seu-dominio.com/api/webhook/zapi/receive \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "test",
    "message": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test123"
      },
      "messageTimestamp": 1640995200,
      "message": {
        "conversation": "teste"
      }
    }
  }'

# 3. Teste fluxo completo
# Envie mensagem via WhatsApp e verifique logs
```

### 🚨 **Troubleshooting**

#### **Aplicação não inicia**
1. Verificar logs: `tail -f logs/app.log`
2. Verificar variáveis: `env | grep -E "(MONGO|ZAPI|AZLIST)"`
3. Testar conexão MongoDB: `mongo $MONGO_URI`

#### **Webhook não recebe mensagens**
1. Verificar URL webhook na Z-API
2. Verificar SSL: `curl -I https://seu-dominio.com`
3. Verificar logs Z-API

#### **CPF não encontrado**
1. Testar AZ List API manualmente
2. Verificar AZLIST_TOKEN e AZLIST_EVENT_ID
3. Verificar logs de integração

---

## ✅ **Checklist Deploy**

- [ ] **MongoDB** configurado e acessível
- [ ] **Variáveis de ambiente** configuradas
- [ ] **Build** executado com sucesso
- [ ] **Aplicação** rodando e respondendo
- [ ] **Webhook Z-API** configurado
- [ ] **SSL** configurado (HTTPS)
- [ ] **Logs** funcionando
- [ ] **Health checks** passando
- [ ] **Teste fluxo completo** WhatsApp
- [ ] **Monitoramento** configurado

**Parabéns! Seu sistema está em produção! 🎉**
