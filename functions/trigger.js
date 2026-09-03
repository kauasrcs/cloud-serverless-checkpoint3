// Ponto de entrada HTTP: monta o pedido a partir da query string e inicia
// a execucao do workflow, devolvendo o resultado do pipeline completo.

const MAQUINA_ARN = process.env.STATE_MACHINE_ARN;

exports.handler = async (event) => {
  const { SFNClient, StartSyncExecutionCommand } = require('@aws-sdk/client-sfn');
  const sfn = new SFNClient({});

  const params = event.queryStringParameters || {};
  const pedido = {
    id: params.id || `pedido-${Date.now()}`,
    cliente: params.cliente || 'cliente-teste',
    valor: Number(params.valor || 100),
  };

  const execucao = await sfn.send(new StartSyncExecutionCommand({
    stateMachineArn: MAQUINA_ARN,
    input: JSON.stringify({ pedido }),
  }));

  if (execucao.status !== 'SUCCEEDED') {
    return responder(500, {
      mensagem: 'O pipeline nao terminou com sucesso.',
      status: execucao.status,
      erro: execucao.error,
      causa: execucao.cause,
    });
  }

  return responder(200, {
    mensagem: 'Pipeline executado com sucesso.',
    resultado: JSON.parse(execucao.output),
  });
};

function responder(statusCode, corpo) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo, null, 2),
  };
}
