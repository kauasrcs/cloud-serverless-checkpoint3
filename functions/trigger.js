// Ponto de entrada HTTP: monta o pedido a partir da query string e inicia
// a execucao do workflow, devolvendo o resultado do pipeline completo.
//
// Logging estruturado e metricas (Checkpoint 4): cada log e uma linha JSON, e
// as metricas usam o formato CloudWatch Embedded Metric Format (EMF) - uma
// linha de log com uma forma especifica que o CloudWatch extrai
// automaticamente como metrica, sem chamada de API nem permissao adicional.
// A duracao aqui e a mais representativa do pipeline inteiro, ja que cobre
// desde a chamada HTTP ate a resposta final, incluindo as 3 funcoes internas.

const MAQUINA_ARN = process.env.STATE_MACHINE_ARN;
const NAMESPACE = 'PucCheckpoint3';
const SERVICO = 'trigger';

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

exports.handler = async (event) => {
  const inicio = Date.now();
  const { SFNClient, StartSyncExecutionCommand } = require('@aws-sdk/client-sfn');
  const sfn = new SFNClient({});

  const params = event.queryStringParameters || {};
  const pedido = {
    id: params.id || `pedido-${Date.now()}`,
    cliente: params.cliente || 'cliente-teste',
    valor: Number(params.valor || 100),
  };

  log('INFO', 'Iniciando pipeline', { id: pedido.id });

  const execucao = await sfn.send(new StartSyncExecutionCommand({
    stateMachineArn: MAQUINA_ARN,
    input: JSON.stringify({ pedido }),
  }));

  const duracao = Date.now() - inicio;
  metrica('DuracaoMs', duracao, 'Milliseconds');

  if (execucao.status !== 'SUCCEEDED') {
    log('ERROR', 'Pipeline falhou', { id: pedido.id, status: execucao.status, erro: execucao.error });
    metrica('PipelineFalha', 1, 'Count');
    return responder(500, {
      mensagem: 'O pipeline nao terminou com sucesso.',
      status: execucao.status,
      erro: execucao.error,
      causa: execucao.cause,
    });
  }

  log('INFO', 'Pipeline concluido', { id: pedido.id, duracaoMs: duracao });
  metrica('PipelineSucesso', 1, 'Count');

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
