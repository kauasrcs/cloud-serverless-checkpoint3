// Segundo passo do pipeline: grava o pedido, de forma idempotente.
//
// Usa o id do pedido como chave e uma condicao "attribute_not_exists" na
// gravacao: se o pedido ja tiver sido salvo antes (por exemplo, apos um
// retry do proprio Step Functions), a gravacao e recusada.
//
// "Ja salvo" nao e o mesmo que "ja processado por completo": se o pedido foi
// salvo mas a notificacao seguinte falhou, um novo pedido com o mesmo id deve
// ainda passar pela notificacao. Por isso, quando o pedido ja existe, a
// funcao confere o campo notificado (gravado pela funcao notificar) antes de
// decidir se pula a proxima etapa.
//
// Logging estruturado e metricas (Checkpoint 4): cada log e uma linha JSON, e
// as metricas usam o formato CloudWatch Embedded Metric Format (EMF) - uma
// linha de log com uma forma especifica que o CloudWatch extrai
// automaticamente como metrica, sem chamada de API nem permissao adicional.

const TABELA = process.env.TABLE_NAME;
const NAMESPACE = 'PucCheckpoint3';
const SERVICO = 'salvar';

function log(nivel, mensagem, campos = {}) {
  console.log(JSON.stringify({ nivel, mensagem, ...campos }));
}

function metrica(nome, valor, unidade) {
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{ Namespace: NAMESPACE, Dimensions: [['Servico']], Metrics: [{ Name: nome, Unit: unidade }] }],
    },
    Servico: SERVICO,
    [nome]: valor,
  }));
}

exports.handler = async (input) => {
  const inicio = Date.now();
  const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
  const db = new DynamoDBClient({});
  const pedido = input.pedido;

  try {
    await db.send(new PutItemCommand({
      TableName: TABELA,
      Item: {
        id: { S: pedido.id },
        dados: { S: JSON.stringify(pedido) },
      },
      ConditionExpression: 'attribute_not_exists(id)',
    }));
    log('INFO', 'Pedido salvo', { id: pedido.id });
    metrica('PedidosSalvos', 1, 'Count');
    metrica('DuracaoMs', Date.now() - inicio, 'Milliseconds');
    return { ...input, salvo: true, jaProcessado: false };
  } catch (erro) {
    if (erro.name !== 'ConditionalCheckFailedException') {
      log('ERROR', 'Falha ao salvar pedido', { id: pedido.id, erro: erro.message });
      metrica('DuracaoMs', Date.now() - inicio, 'Milliseconds');
      throw erro;
    }
    const existente = await db.send(new GetItemCommand({
      TableName: TABELA,
      Key: { id: { S: pedido.id } },
    }));
    const jaNotificado = existente.Item?.notificado?.BOOL === true;
    log('INFO', 'Pedido ja existia', { id: pedido.id, jaNotificado });
    metrica('PedidosJaProcessados', 1, 'Count');
    metrica('DuracaoMs', Date.now() - inicio, 'Milliseconds');
    return { ...input, salvo: true, jaProcessado: jaNotificado };
  }
};
