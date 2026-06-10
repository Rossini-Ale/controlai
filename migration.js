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
  {
    id: "005_password_resets",
    sql: `CREATE TABLE IF NOT EXISTS PasswordResets (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      token      VARCHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used       TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE
    )`,
  },
  {
    id: "006_plano_usuario",
    sql: "ALTER TABLE Usuarios ADD COLUMN plano VARCHAR(10) NOT NULL DEFAULT 'free'",
  },
  {
    id: "007_stripe_campos",
    sql: "ALTER TABLE Usuarios ADD COLUMN stripe_customer_id VARCHAR(100) NULL, ADD COLUMN stripe_subscription_id VARCHAR(100) NULL",
  },
  {
    id: "008_fatura_alerta_atraso",
    sql: "ALTER TABLE FaturasCartao ADD COLUMN alerta_atraso_enviado TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    // Cobre o padrão WHERE usuario_id=? AND deleted_at IS NULL ORDER BY data DESC
    id: "009_index_transacoes_usuario_deleted_data",
    sql: "ALTER TABLE Transacoes ADD INDEX idx_usuario_deleted_data (usuario_id, deleted_at, data)",
  },
  {
    id: "010_orcamentos",
    sql: `CREATE TABLE IF NOT EXISTS Orcamentos (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id   INT NOT NULL,
      categoria_id INT NULL,
      mes          TINYINT NOT NULL,
      ano          SMALLINT NOT NULL,
      limite       DECIMAL(10,2) NOT NULL DEFAULT 0,
      alerta_80_enviado  TINYINT(1) NOT NULL DEFAULT 0,
      alerta_100_enviado TINYINT(1) NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_orc (usuario_id, categoria_id, mes, ano),
      FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_id) REFERENCES Categorias(id) ON DELETE CASCADE
    )`,
  },
  {
    id: "011_metas",
    sql: `CREATE TABLE IF NOT EXISTS Metas (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nome       VARCHAR(255) NOT NULL,
      valor_alvo DECIMAL(10,2) NOT NULL DEFAULT 0,
      valor_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
      prazo      DATE NULL,
      status     VARCHAR(20) NOT NULL DEFAULT 'ativa',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE
    )`,
  },
  {
    // Impede que a mesma recorrência gere duas transações no mesmo dia
    // (proteção contra reinicializações do servidor no mesmo dia)
    id: "012_unique_recorrente_data",
    sql: "ALTER TABLE Transacoes ADD UNIQUE KEY uq_recorrente_data (recorrente_id, data)",
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
