# AZ-WhatsApp

Sistema de envio de QR Code via WhatsApp com validação de CPF utilizando a Z-API.

## 📋 Descrição

Este projeto permite que usuários solicitem QR Codes através do WhatsApp. O sistema valida o CPF do usuário em uma API externa e, caso o cadastro seja encontrado, gera e envia um QR Code personalizado.

## 🏗️ Arquitetura

- **Backend**: Node.js com TypeScript
- **Banco de Dados**: MongoDB
- **WhatsApp Integration**: Z-API
- **QR Code Generation**: qrcode library
- **Validação**: Joi para validação de dados

## 🚀 Funcionalidades

- ✅ Recebimento de mensagens via WhatsApp
- ✅ Validação de CPF em API externa
- ✅ Geração de QR Code personalizado
- ✅ Controle de estado de conversação
- ✅ Rate limiting e segurança
- ✅ Logging completo
- ✅ Configuração por variáveis de ambiente

## 📁 Estrutura do Projeto

```
src/
├── config/          # Configurações (database, environment)
├── controllers/     # Controllers da API
├── services/        # Lógica de negócio
├── models/          # Modelos do MongoDB
├── routes/          # Rotas da API
├── middleware/      # Middlewares customizados
├── utils/           # Utilitários e helpers
├── types/           # Definições de tipos TypeScript
└── index.ts         # Entry point da aplicação
```

## 🛠️ Instalação

1. Clone o repositório:
```bash
git clone <repository-url>
cd az-whatsapp
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp env.example .env
# Edite o arquivo .env com suas configurações
```

4. Execute o projeto:

**Desenvolvimento:**
```bash
npm run dev
```

**Produção:**
```bash
npm run build
npm start
```

## 🔧 Configuração

### Variáveis de Ambiente Obrigatórias

- `MONGODB_URI`: String de conexão do MongoDB
- `Z_API_URL`: URL da Z-API
- `Z_API_TOKEN`: Token da Z-API
- `Z_API_INSTANCE_ID`: ID da instância Z-API
- `CPF_VALIDATION_API_URL`: URL da API de validação de CPF
- `CPF_VALIDATION_API_KEY`: Chave da API de validação
- `QR_CODE_BASE_URL`: URL base para os QR Codes
- `JWT_SECRET`: Secret para JWT (mínimo 32 caracteres)

### MongoDB

Certifique-se de ter o MongoDB rodando localmente ou configure uma instância remota.

### Z-API

1. Crie uma conta na Z-API
2. Configure uma instância do WhatsApp
3. Obtenha o token e instance ID
4. Configure o webhook para apontar para sua aplicação

## 📝 Scripts Disponíveis

- `npm run dev`: Executa em modo desenvolvimento com hot reload
- `npm run build`: Compila o projeto TypeScript
- `npm start`: Executa a versão compilada
- `npm test`: Executa os testes
- `npm run lint`: Verifica o código com ESLint
- `npm run lint:fix`: Corrige automaticamente problemas do ESLint

## 🔒 Segurança

- Rate limiting configurado
- Helmet para headers de segurança
- Validação de entrada com Joi
- Logs de segurança
- CORS configurável

## 📊 Monitoramento

- Logs estruturados com Winston
- Métricas de performance
- Health checks
- Error tracking

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar em modo watch
npm run test:watch

# Coverage
npm run test -- --coverage
```

## 📚 API Documentation

### Endpoints Principais

- `GET /`: Status da API
- `POST /api/webhook/whatsapp`: Webhook para mensagens do WhatsApp
- `GET /api/health`: Health check

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, entre em contato através do email ou abra uma issue no repositório.

