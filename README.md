# Checkpoint 3 - Orquestracao de Funcoes Serverless

Evolucao dos checkpoints anteriores. Em vez de uma unica funcao, este projeto
tem tres funcoes pequenas (validar, salvar, notificar) chamadas na ordem
certa por um workflow. O workflow cuida de repetir chamadas que falharem por
motivo transitorio, de nao processar o mesmo pedido duas vezes e de enviar o
pedido para uma fila separada quando o processamento falha de vez.

A URL usada para testar nao esta neste arquivo. Ela foi enviada no campo de
comentarios da entrega no Canvas.

## Provedor Utilizado

* AWS (Step Functions + Lambda + DynamoDB + SQS)

O Step Functions e o servico de orquestracao de workflows da AWS, equivalente
ao Google Cloud Workflows: um arquivo de definicao descreve os passos, a
ordem entre eles e o que fazer quando um passo falha.

## O workflow

A definicao completa esta em [`workflow.yaml`](workflow.yaml). Resumo do fluxo:

    validar -> salvar -> (ja processado?) -> notificar

* **Retry**: cada passo tenta de novo automaticamente (ate 3 vezes, com
  espera crescente) se a chamada falhar por motivo transitorio.
* **Idempotencia**: `salvar` so grava o pedido se o id ainda nao existir. Se
  o mesmo pedido chegar de novo (por exemplo, apos um retry), o passo
  `notificar` e pulado, evitando notificar o cliente duas vezes.
* **Dead-letter queue**: se um passo falhar mesmo apos as tentativas de
  retry, o pedido e enviado para uma fila separada em vez de ser perdido.

## Como rodar localmente

### Pre-requisitos

* Node.js instalado (versao 18 ou superior)
* Terminal de comandos aberto

### Passo a passo

1. Clone o repositorio para sua maquina:

       git clone https://github.com/kauasrcs/cloud-serverless-checkpoint3.git

2. Entre na pasta do projeto:

       cd cloud-serverless-checkpoint3

3. Instale as dependencias do projeto:

       npm install

4. Rode o teste local:

       npm start

O teste local executa o pipeline tres vezes em sequencia: um pedido normal,
o mesmo pedido de novo (mostrando a idempotencia) e um pedido invalido
(mostrando o tratamento de falha). Nao precisa de credencial da nuvem.

## Arquivos

* `workflow.yaml` - definicao do workflow (ordem das chamadas, retry, dead-letter)
* `functions/validar.js` - valida os dados do pedido
* `functions/salvar.js` - grava o pedido de forma idempotente
* `functions/notificar.js` - confirma o pedido processado
* `functions/trigger.js` - recebe a chamada HTTP e inicia o workflow
* `local.js` - roda o pipeline localmente para teste
