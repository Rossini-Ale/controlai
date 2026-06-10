// Script de reset — apaga TODAS as transações de um usuário pelo email
// Uso: node scripts/reset-transacoes.js <email>
// Ex:  node scripts/reset-transacoes.js alexandrejrrossini@gmail.com

require("dotenv").config();
const db = require("../config/db");

const email = process.argv[2];
if (!email) {
  console.error("❌ Informe o email: node scripts/reset-transacoes.js <email>");
  process.exit(1);
}

async function main() {
  try {
    // 1. Encontra o usuário
    const [[usuario]] = await db.query(
      "SELECT id, nome, email FROM Usuarios WHERE email = ? LIMIT 1",
      [email]
    );
    if (!usuario) {
      console.error(`❌ Nenhum usuário encontrado com email: ${email}`);
      process.exit(1);
    }

    // 2. Conta o que vai ser apagado
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM Transacoes WHERE usuario_id = ?",
      [usuario.id]
    );

    console.log(`\n👤 Usuário: ${usuario.nome} (${usuario.email}) — ID ${usuario.id}`);
    console.log(`🗑️  Transações que serão apagadas: ${total}`);

    if (total === 0) {
      console.log("ℹ️  Nada a apagar.");
      process.exit(0);
    }

    // 3. Apaga definitivamente
    const [result] = await db.query(
      "DELETE FROM Transacoes WHERE usuario_id = ?",
      [usuario.id]
    );

    console.log(`✅ ${result.affectedRows} transações apagadas com sucesso.`);
  } catch (err) {
    console.error("❌ Erro:", err.message);
  } finally {
    process.exit(0);
  }
}

main();
