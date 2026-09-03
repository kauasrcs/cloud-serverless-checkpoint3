// Terceiro passo do pipeline: confirma o pedido processado.
// So e chamado quando o pedido ainda nao foi notificado (o workflow pula
// esta etapa se o campo "notificado" ja estiver gravado, evitando notificar
// duas vezes). Ao terminar, marca o pedido como notificado na tabela, para
// que um retry futuro com o mesmo id saiba que esta etapa ja foi cumprida.

const TABELA = process.env.TABLE_NAME;

exports.handler = async (input) => {
  const pedido = input.pedido;
  const mensagem = `Pedido ${pedido.id} confirmado para ${pedido.cliente}.`;
  console.log(mensagem);

  const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
  const db = new DynamoDBClient({});
  await db.send(new UpdateItemCommand({
    TableName: TABELA,
    Key: { id: { S: pedido.id } },
    UpdateExpression: 'SET notificado = :sim',
    ExpressionAttributeValues: { ':sim': { BOOL: true } },
  }));

  return { ...input, notificado: true, mensagem };
};
