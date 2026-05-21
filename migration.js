// migration.js — Roda migrações de banco na inicialização
// Adicione novas migrações ao array; elas rodam uma única vez.

const db = require("./config/db");

const MIGRATIONS = [
  {
    id: "001_soft_delete_transacoes",
    sql: "ALTER TABLE Transacoes ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL",
  },
  {
    id: "002_soft_delete_categorias",
    sql: "ALTER TABLE Categorias ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL",
  },
  {
    id: "003_index_transacoes_deleted_at",
    sql: "ALTER TABLE Transacoes ADD INDEX idx_deleted_at (deleted_at)",
  },
  {
    id: "004_index_transacoes_usuario_data",
    sql: "ALTER TABLE Transacoes ADD INDEX idx_usuario_data (usuario_id, data)",
  },
];

async function rodarMigrations() {
  // Garante que a tabela de controle existe
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          VARCHAR(100) PRIMARY KEY,
      aplicada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [aplicadas] = await db.query("SELECT id FROM _migrations");
  const aplicadasSet = new Set(aplicadas.map((r) => r.id));

  for (const m of MIGRATIONS) {
    if (aplicadasSet.has(m.id)) continue;
    try {
      await db.query(m.sql);
      await db.query("INSERT INTO _migrations (id) VALUES (?)", [m.id]);
      console.log(`✅ Migration aplicada: ${m.id}`);
    } catch (err) {
      // "Duplicate column" significa que a coluna já existe — ignora
      if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_DUP_KEYNAME") {
        await db.query("INSERT IGNORE INTO _migrations (id) VALUES (?)", [
          m.id,
        ]);
        console.log(`⏭️  Migration já existia: ${m.id}`);
      } else {
        console.error(`❌ Erro na migration ${m.id}:`, err.message);
      }
    }
  }
}

module.exports = { rodarMigrations };
