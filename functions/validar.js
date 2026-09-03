// Primeiro passo do pipeline: valida o pedido recebido.
// Se faltar campo obrigatorio, lanca erro - o Step Functions trata isso
// pelo mecanismo de retry/catch definido no workflow.

exports.handler = async (input) => {
  const pedido = input.pedido || {};

  if (!pedido.id || !pedido.cliente || !pedido.valor) {
    throw new Error('Pedido invalido: faltam campos obrigatorios (id, cliente, valor).');
  }
  if (!Number.isFinite(Number(pedido.valor)) || Number(pedido.valor) <= 0) {
    throw new Error('Pedido invalido: valor deve ser um numero finito maior que zero.');
  }
  if (/[\r\n\x00-\x1f]/.test(pedido.cliente)) {
    throw new Error('Pedido invalido: campo cliente contem caracteres invalidos.');
  }

  return { ...input, validado: true };
};
