# Plano de Alteração de IaC: Configuração de Autenticação IAM (SigV4) na Lambda Function URL

> **Status**: Proposta para Revisão & Aprovação  
> **Data**: 2026-09-11  
> **Repositório Alvo**: `15-soat-tech-challenge-lamda`  
> **Autor**: Engenheiro de DevOps & Especialista Cloud  

---

## 1. Contexto & Diagnóstico

O teste E2E no Cucumber foi configurado para assinar as requisições HTTP do REST Assured com **AWS SigV4** utilizando as credenciais da sessão ativa em `~/.aws/credentials`.

Contudo, no Terraform atual de [`main.tf`](file:///c:/git/fiap/15-soat-tech-challenge-lamda/main.tf#L101-L125), o recurso `aws_lambda_function_url` está configurado com `authorization_type = "NONE"`. 

Por especificação da AWS:
1. Uma Function URL com `authorization_type = "NONE"` **rejeita chamadas que contêm cabeçalhos SigV4** (`Authorization: AWS4-HMAC-SHA256...`).
2. Requisições anônimas diretas sofrem restrição de borda no AWS Academy.
3. Para aceitar a assinatura criptográfica SigV4 enviada pelo Cucumber, o `authorization_type` da Function URL deve ser alterado para **`AWS_IAM`**.

---

## 2. Opção Recomendada: Function URL Protegida com `authorization_type = "AWS_IAM"`

No arquivo `main.tf`:
```hcl
# --- Lambda Function URL (IAM Protected Endpoint) ---
resource "aws_lambda_function_url" "auth_url" {
  function_name      = aws_lambda_function.auth_handler.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["Content-Type", "Authorization", "X-Requested-With", "x-amz-date", "x-amz-security-token"]
    expose_headers    = ["*"]
    max_age           = 300
  }
}

# --- Permission for IAM Function URL Invocation ---
resource "aws_lambda_permission" "iam_function_url" {
  statement_id           = "FunctionURLAllowIAMAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.auth_handler.function_name
  principal              = "*"
  function_url_auth_type = "AWS_IAM"
}
```

### Vantagens:
- ✅ **Compatibilidade 100% com o `AwsSigV4Filter`**: O REST Assured calcula a assinatura com o `~/.aws/credentials` e a AWS valida e autoriza imediatamente.
- ✅ **Segurança Zero-Trust**: O endpoint requer identidade IAM válida.
- ✅ **Totalmente suportado no AWS Academy**: `AuthType = AWS_IAM` é a prática recomendada em contas com restrições educacionais.
