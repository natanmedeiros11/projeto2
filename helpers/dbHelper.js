const fs = require("fs");
const { Client } = require("pg");

// Caminho do banco de dados e do arquivo SQL
const sqlScriptPath = 'setup_database.sql';

// Configuração do cliente PostgreSQL
const clientConfig = {
  user: 'postgres',         // usuário do PostgreSQL
  host: 'localhost',           // Endereço do servidor (normalmente 'localhost')
  database: 'projeto2',       // Nome do banco de dados
  password: 'pabd',       // Senha
  port: 5432,                  // Porta padrão do PostgreSQL
};

// Função que inicia e cria o banco de dados (se necessário)
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Conecta ao banco de dados PostgreSQL
    const client = new Client(clientConfig);

    client.connect((err) => {
      if (err) {
        reject("Erro ao conectar ao PostgreSQL: " + err.message);
        return;
      }

      console.log("Conectado ao banco de dados PostgreSQL.");

      // Verifica se o banco de dados já contém alguma tabela
      client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 1", (err, res) => {
        if (err) {
          reject("Erro ao verificar o banco de dados: " + err.message);
          return;
        }

        // Se não houver nenhuma tabela (res.rows está vazio), significa que o banco está vazio
        if (res.rows.length === 0) {
          // Lê o arquivo SQL e executa seus comandos
          fs.readFile(sqlScriptPath, 'utf-8', (err, data) => {
            if (err) {
              reject("Erro ao ler Script SQL: " + err.message);
              return;
            }

            // Executa os comandos SQL no banco de dados
            client.query(data, (err) => {
              if (err) {
                reject("Erro ao executar o script SQL: " + err.message);
                return;
              }
              console.log("Banco de dados inicializado com sucesso.");
              resolve(client); // Retorna o cliente após a execução dos scripts
            });
          });
        } else {
          // Banco de dados já contém tabelas, retornamos o cliente
          resolve(client);
        }
      });
    });
  });
}

module.exports = { initializeDatabase };
