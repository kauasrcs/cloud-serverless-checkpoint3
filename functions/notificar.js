// Terceiro passo do pipeline: confirma o pedido processado.
// So e chamado quando o pedido ainda nao foi notificado (o workflow pula
// esta etapa se o campo "notificado" ja estiver gravado, evitando notificar
// duas vezes). Ao terminar, marca o pedido como notificado na tabela, para
// que um retry futuro com o mesmo id saiba que esta etapa ja foi cumprida.
//
// Logging estruturado e metricas (Checkpoint 4): cada log e uma linha JSON, e
// as metricas usam o formato CloudWatch Embedded Metric Format (EMF) - uma
// linha de log com uma forma especifica que o CloudWatch extrai
// automaticamente como metrica, sem chamada de API nem permissao adicional.

const TABELA = process.env.TABLE_NAME;
const NAMESPACE = 'PucCheckpoint3';
const SERVICO = 'notificar';

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
  const pedido = input.pedido;
  const mensagem = `Pedido ${pedido.id} confirmado para ${pedido.cliente}.`;
  log('INFO', mensagem, { id: pedido.id });

  const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
  const db = new DynamoDBClient({});
  await db.send(new UpdateItemCommand({
    TableName: TABELA,
    Key: { id: { S: pedido.id } },
    UpdateExpression: 'SET notificado = :sim',
    ExpressionAttributeValues: { ':sim': { BOOL: true } },
  }));

  metrica('PedidosNotificados', 1, 'Count');
  metrica('DuracaoMs', Date.now() - inicio, 'Milliseconds');

  return { ...input, notificado: true, mensagem };
};
