// Simula a execucao do pipeline localmente, chamando validar, salvar e
// notificar na mesma ordem que o Step Functions chamaria na nuvem. Usa um
// armazenamento em memoria no lugar da tabela, entao nao precisa de
// credencial nem de dependencia externa para rodar.

const validar = require('./functions/validar').handler;

const pedidosSalvos = new Map();
const pedidosNotificados = new Set();

async function salvarLocal(input) {
  const pedido = input.pedido;
  if (pedidosSalvos.has(pedido.id)) {
    return { ...input, salvo: true, jaProcessado: pedidosNotificados.has(pedido.id) };
  }
  pedidosSalvos.set(pedido.id, pedido);
  return { ...input, salvo: true, jaProcessado: false };
}

async function notificarLocal(input) {
  const pedido = input.pedido;
  const mensagem = `Pedido ${pedido.id} confirmado para ${pedido.cliente}.`;
  pedidosNotificados.add(pedido.id);
  return { ...input, notificado: true, mensagem };
}

async function executarPipeline(pedido) {
  console.log(`\n== Executando pipeline para ${pedido.id} ==`);
  try {
    let estado = { pedido };
    estado = await validar(estado);
    console.log('1. validar   -> ok');
    estado = await salvarLocal(estado);
    console.log(`2. salvar    -> ok (jaProcessado: ${estado.jaProcessado})`);

    if (estado.jaProcessado) {
      console.log('3. notificar -> pulado (pedido ja notificado antes)');
      return estado;
    }

    estado = await notificarLocal(estado);
    console.log(`3. notificar -> ${estado.mensagem}`);
    return estado;
  } catch (erro) {
    console.log(`FALHOU: ${erro.message} (na nuvem, isso vai para a fila de dead-letter)`);
    return null;
  }
}

(async () => {
  const pedido = { id: 'pedido-local-1', cliente: 'Kaua', valor: 250 };

  await executarPipeline(pedido);
  await executarPipeline(pedido); // mesmo id de novo: mostra a idempotencia
  await executarPipeline({ id: 'pedido-local-2', cliente: 'Maria' }); // sem valor: mostra a falha tratada
})();
