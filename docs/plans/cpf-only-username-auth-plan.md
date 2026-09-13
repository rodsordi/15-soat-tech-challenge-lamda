# Plano de Implementação: Restringir Username Estritamente ao CPF na Lambda de Autenticação

Este documento detalha o planejamento técnico para restringir a autenticação da Lambda (`garage-auth-handler`) para que o `username` seja **exclusivamente o CPF da pessoa** (validado pelo algoritmo oficial do Módulo 11 da Receita Federal).

---

## 🎯 Objetivo
Atualmente, o handler de autenticação ([`src/handlers/authHandler.js`](file:///C:/git/fiap/15-soat-tech-challenge-lamda/src/handlers/authHandler.js)) aceita `username`, `cpf` ou `email`, permitindo que identificadores arbitrários ou e-mails sejam encaminhados ao Keycloak.

O objetivo desta mudança é:
1. **Restringir o identificador de login exclusivamente a CPFs válidos**:
   - O valor informado no campo `username` (ou `cpf`) deve ser obrigatoriamente um CPF válido.
   - Rejeitar e-mails ou nomes de usuário alfanuméricos arbitrários com `HTTP 400 Bad Request`.
2. **Validação Rigorosa de Integridade (Módulo 11)**:
   - Validar se o CPF possui 11 dígitos numéricos e dígitos verificadores matematicamente válidos utilizando [`src/documentValidator.js`](file:///C:/git/fiap/15-soat-tech-challenge-lamda/src/documentValidator.js).
3. **Sanitização Automática para o Keycloak**:
   - O CPF pode ser enviado com máscara (`000.000.000-00`) ou limpo (`00000000000`). A Lambda sempre converterá para os 11 dígitos numéricos limpos antes de repassar ao Keycloak, garantindo total alinhamento com a forma como o usuário foi provisionado no cadastro (`createUser`).

---

## 🏛️ Opções Técnicas Consideradas

### 🥇 Opção 1 (Recomendada - Best Practice): Validação Estrita de CPF com Suporte a Campos `username` e `cpf`
- **Como funciona**:
  - O endpoint aceita tanto `{ "username": "<CPF>", "password": "..." }` quanto `{ "cpf": "<CPF>", "password": "..." }`.
  - O valor contido é submetido à função `validateDocument(userIdentifier)`.
  - Se não for um CPF válido (ou for e-mail, texto arbitrário, etc.), retorna `400 Bad Request` informando o erro antes mesmo de onerar o Keycloak.
  - Se for válido, extrai o CPF limpo (`validation.clean`) e envia para `keycloakService.authenticate({ username: cleanCpf, password })`.
- **Vantagens**:
  - Compatibilidade com clientes HTTP que usam a convenção padrão OAuth2/OIDC (`username`) e clientes que preferem o campo semântico `cpf`.
  - Impede requisições com dados incorretos de chegarem ao Keycloak (Fail-Fast).

### 🥈 Opção 2 (Alternativa): Campo Único Exclusivo `cpf` no Payload JSON
- **Como funciona**:
  - Rejeita qualquer requisição que não contenha explicitamente a chave `cpf` no JSON body (descontinuando o campo `username`).
- **Trade-offs**:
  - Quebra a compatibilidade com o padrão OAuth2 Resource Owner Password Credentials que usa a convenção `username`/`password`.

### 🥉 Opção 3 (Abordagem Minimalista): Apenas Checagem de Regex de 11 Dígitos
- **Como funciona**:
  - Verifica apenas se a string possui 11 números, sem validar os dígitos verificadores (sem Módulo 11).
- **Trade-offs**:
  - Permite que CPFs matematicamente inválidos gerem chamadas indevidas ao Keycloak.

---

## 🛠️ Arquivos e Mudanças Propostas

### Repositório: `15-soat-tech-challenge-lamda`

#### [MODIFY] [`src/handlers/authHandler.js`](file:///C:/git/fiap/15-soat-tech-challenge-lamda/src/handlers/authHandler.js)
- Importar `validateDocument` de `../documentValidator`.
- Alterar a extração do identificador para considerar apenas `username` ou `cpf` (removendo `email`).
- Validar se o identificador informado é um CPF válido (`validation.isValid && validation.type === 'CPF'`).
- Retornar `HTTP 400` caso o CPF seja inválido ou não seja informado.
- Chamar `authenticate` com `username: validation.clean`.

#### [NEW] [`test/authHandler.test.js`](file:///C:/git/fiap/15-soat-tech-challenge-lamda/test/authHandler.test.js)
- Testes unitários com Node.js test runner nativo (`node:test`):
  1. Rejeição de payload sem identificador ou sem senha (400 Bad Request).
  2. Rejeição de e-mail como username (400 Bad Request - `O username deve ser um CPF válido`).
  3. Rejeição de CPF com dígitos verificadores inválidos (400 Bad Request).
  4. Aceitação de CPF válido com máscara (200 / autenticação chamada com CPF limpo).
  5. Aceitação de CPF válido sem máscara (200 / autenticação chamada com CPF limpo).

---

## 🔬 Plano de Verificação

### 1. Testes Automatizados Unitários (Lambda)
Executar os testes no repositório `15-soat-tech-challenge-lamda`:
```bash
npm test
```

### 2. Validação da Pipeline de CI/CD (GitOps)
- Fazer commit e push no repositório `15-soat-tech-challenge-lamda` (após autorização explícita).
- Acompanhar a pipeline do GitHub Actions efetuando o deploy na AWS Lambda.

### 3. Testes E2E em Produção (AWS Academy)
Executar os testes E2E Cucumber no repositório `15-soat-tech-challenge-garage`:
```bash
mvn test -pl e2e -Pmanual-e2e -Denv=prd --no-transfer-progress
```
Confirmar que a autenticação via Lambda SigV4 utilizando o CPF configurado (`529.982.247-25`) continua com 100% de sucesso.
