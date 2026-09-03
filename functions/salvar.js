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

const TABELA = process.env.TABLE_NAME;

exports.handler = async (input) => {
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
    return { ...input, salvo: true, jaProcessado: false };
  } catch (erro) {
    if (erro.name !== 'ConditionalCheckFailedException') {
      throw erro;
    }
    const existente = await db.send(new GetItemCommand({
      TableName: TABELA,
      Key: { id: { S: pedido.id } },
    }));
    const jaNotificado = existente.Item?.notificado?.BOOL === true;
    return { ...input, salvo: true, jaProcessado: jaNotificado };
  }
};
