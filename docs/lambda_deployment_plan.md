# Plano de Implementação: Deploy da Auth & User Management Lambda (`15-soat-tech-challenge-lamda`)

Este documento descreve a estratégia técnica e arquitetural para provisionar e subir o componente serverless **Auth & User Management Lambda** na AWS, integrado à VPC privada do cluster EKS, ao Keycloak e ao New Relic One.

---

## 🎯 Objetivo

1. Subir a função AWS Lambda `garage-auth-handler` (`Node.js 20.x`) acoplada às subnets privadas da VPC do cluster EKS (`vpc-093f6d8202d981ab8`).
2. Configurar a **AWS Lambda Function URL** com acesso público HTTPS e suporte a CORS para consumo do frontend e integrações externas.
3. Atualizar os apontamentos de rede internos para os Network Load Balancers (NLB) ativos do Keycloak e da API Garage no cluster EKS.
4. Ajustar a esteira de CI/CD no GitHub Actions (`.github/workflows/terraform.yml`) com validação do bucket S3 do Terraform State (`techchallenge-fiap-tfstate-890958457263`).
5. Executar o deploy automatizado via pipeline de CI/CD (GitOps / IaC Mandatory - Diretriz Global nº 5).

---

## 🧭 Análise de Alternativas Técnicas

### 🥇 Opção 1 (Recomendada - Best Practice & GitOps)
* **Abordagem**: 
  - Atualizar os endpoints padrão em `variables.tf` para os NLBs internos da VPC (`a26160f64b78c49e287dc98c721e2c50...` para Keycloak e `a01f2f3e1486a4eb6bd751ae3744a3f1...` para API Garage).
  - Incluir a etapa de idempotência do bucket S3 no workflow do GitHub Actions.
  - Submeter as alterações para aprovação do usuário, efetuar commit/push e acionar a pipeline automatizada do GitHub Actions.
* **Prós**:
  - Respeita 100% o princípio de Zero Manual Drift (Diretriz nº 5).
  - Histórico rastreável e auditável em Git e GitHub Actions.
  - Garante que futuros pushes na branch `master` executem com sucesso e sem divergências.
* **Contras**:
  - Requer a aprovação formal e o tempo de execução da esteira (~1 a 2 minutos).

### 🥈 Opção 2 (Alternativa - Deploy Manual Local / Break-Glass)
* **Abordagem**:
  - Executar `terraform apply -auto-approve` diretamente da máquina local usando o CLI do Terraform.
* **Prós**:
  - Execução imediata sem depender do runner do GitHub.
* **Contras**:
  - Viola a Diretriz Global nº 5 (Zero Manual Drift via CLI).
  - O código local precisaria ser sincronizado posteriormente com o repositório remoto.

---

## 📝 Mudanças Propostas no Repositório `15-soat-tech-challenge-lamda`

### 1. `variables.tf`
Atualização das URLs padrão de comunicação privada dentro da VPC:
```hcl
variable "keycloak_url" {
  type        = string
  description = "Keycloak endpoint URL"
  default     = "http://a26160f64b78c49e287dc98c721e2c50-6be6a7545633c425.elb.us-east-1.amazonaws.com:8080"
}

variable "garage_api_url" {
  type        = string
  description = "api-garage endpoint URL for catalog propagation"
  default     = "http://a01f2f3e1486a4eb6bd751ae3744a3f1-d565b930af7e7fc5.elb.us-east-1.amazonaws.com:8080"
}
```

### 2. `.github/workflows/terraform.yml`
Adição da verificação/criação preventiva do bucket S3 antes do `terraform init`:
```yaml
      - name: Ensure Terraform State S3 Bucket Exists
        run: |
          BUCKET="techchallenge-fiap-tfstate-890958457263"
          if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
            echo "Bucket $BUCKET does not exist. Creating via pipeline..."
            aws s3 mb "s3://$BUCKET" --region "${{ env.AWS_REGION }}"
            aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
          else
            echo "Bucket $BUCKET already exists."
          fi
```

---

## 🧪 Plano de Verificação

1. **Testes Unitários**:
   - `npm test` local executando os 19 testes de algoritmo Módulo 11 (CPF/CNPJ) e orquestração de Saga.
2. **Execução da Pipeline CI/CD**:
   - Acompanhar execução da action `Auth Lambda CI/CD Pipeline`.
   - Garantir que todas as etapas (`npm test`, `terraform init`, `terraform validate`, `terraform apply`) finalizem com sucesso.
3. **Teste Funcional da Lambda Function URL**:
   - Capturar a URL pública da Lambda gerada no output (`lambda_function_url`).
   - Realizar requisição HTTP de Health Check:
     ```bash
     curl -i https://<function-url>.lambda-url.us-east-1.on.aws/
     ```
   - Realizar requisição de teste de consulta de usuário ou registro de cliente via payload JSON.
