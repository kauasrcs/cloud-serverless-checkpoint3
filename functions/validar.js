// Primeiro passo do pipeline: valida o pedido recebido.
// Se faltar campo obrigatorio, lanca erro - o Step Functions trata isso
// pelo mecanismo de retry/catch definido no workflow.
//
// Logging estruturado e metricas (Checkpoint 4): cada log e uma linha JSON, e
// as metricas usam o formato CloudWatch Embedded Metric Format (EMF) - uma
// linha de log com uma forma especifica que o CloudWatch extrai
// automaticamente como metrica, sem chamada de API nem permissao adicional.

const NAMESPACE = 'PucCheckpoint3';
const SERVICO = 'validar';

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
  const pedido = input.pedido || {};
  log('INFO', 'Validando pedido', { id: pedido.id });

  function falhar(mensagem) {
    log('ERROR', mensagem, { id: pedido.id });
    metrica('PedidosInvalidos', 1, 'Count');
    metrica('DuracaoMs', Date.now() - inicio, 'Milliseconds');
    throw new Error(mensagem);
  }

  if (!pedido.id || !pedido.cliente || !pedido.valor) {
    falhar('Pedido invalido: faltam campos obrigatorios (id, cliente, valor).');
  }
  if (!Number.isFinite(Number(pedido.valor)) || Number(pedido.valor) <= 0) {
    falhar('Pedido invalido: valor deve ser um numero finito maior que zero.');
  }
  if (/[\r\n\x00-\x1f]/.test(pedido.cliente)) {
    falhar('Pedido invalido: campo cliente contem caracteres invalidos.');
  }

  metrica('PedidosValidados', 1, 'Count');
  metrica('DuracaoMs', Date.now() - inicio, 'Milliseconds');
  log('INFO', 'Pedido validado', { id: pedido.id });
  return { ...input, validado: true };
};
