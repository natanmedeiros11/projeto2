const express = require("express");
const { Client } = require("pg"); // Importa o cliente PostgreSQL
const session = require("express-session");

const { initializeDatabase } = require("./helpers/dbHelper");
const {
  validateEmail,
  gerarHashSenha,
  compararSenha,
  updateObjective,
  renderObjectivePage,
} = require("./helpers/utilities");

const app = express();

// Função para conectar ao banco de dados PostgreSQL
async function main() {
  try {
    // Chama a função de inicialização do banco de dados
    const client = await initializeDatabase(); // Inicializa o banco de dados e retorna o cliente conectado

    require("./helpers/shceduller")(client) //Passa o client para o scheduler

    app.use(
      session({
        secret: "segredo_forte", // Usado para assinar o ID da sessão (alterar para algo mais seguro)
        resave: false, // Não regravar a sessão se ela não foi modificada
        saveUninitialized: false, // Não salva a sessão se ela não foi utilizada
        cookie: {
          secure: false, // Será TRUE se estiver em um https
          maxAge: 1000 * 60 * 60 * 24 * 20, // Sessão expira em 20 dias
          httpOnly: true, // Não acessível via JavaScript
          sameSite: "strict", // Protege contra CSRF
        },
      })
    );

    // Serve arquivos estáticos da pasta 'public'
    app.use(express.static("public"));

    // Define o diretório 'views' para armazenar os templates EJS
    app.set("view engine", "ejs");
    app.set("views", "./views");

    // Middleware para fazer o parsing de dados do formulário
    app.use(express.urlencoded({ extended: true })); // Para lidar com formulários com codificação URL-encoded
    app.use(express.json()); // Para habilitar o parsing de JSON no corpo das requisições POST

    // Página inicial do app
    app.get("/", async (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        return res.redirect("/login");
      }

      try {
        // 1. Seleciona os hábitos do usuário
        const { rows: habitos } = await client.query(
          "SELECT * FROM habitos WHERE id_usuario = $1",
          [req.session.userId]
        );

        // 2. Seleciona os ids das categorias
        const categoriesIds = habitos.map((row) => row.id_categoria);
        const categorias = {};

        if (categoriesIds.length > 0) {
          // 3. Organiza os placeholders para a consulta das categorias
          const placeholdersCategories = categoriesIds
            .map((_, idx) => `$${idx + 1}`)
            .join(",");
          const { rows: rowsCategories } = await client.query(
            `SELECT * FROM categorias WHERE id IN (${placeholdersCategories})`,
            categoriesIds
          );
          
          // 4. Organiza as categorias
          rowsCategories.forEach((category) => {
            categorias[category.id] = category.nome_categoria;
          });
        }


        // 5. Busca o nome e o objetivo do usuário
        const { rows: userRows } = await client.query(
          "SELECT nome, objetivo_id FROM usuarios WHERE id = $1",
          [req.session.userId]
        );
        const userName = userRows[0]?.nome || "Nome não encontrado";

        // 6. Busca o título do objetivo do usuário
        const { rows: objetivoRows } = await client.query(
          "SELECT titulo FROM objetivos WHERE id = $1",
          [userRows[0]?.objetivo_id]
        );
        const objetivo = objetivoRows[0]?.titulo || "Objetivo não definido";

        // 7. Renderiza a página com os dados
        return res.render("index", {
          habitos: habitos,
          categorias: categorias,
          username: userName,
          objetivo: objetivo,
        });
      } catch (err) {
        console.error(err.message);
        return res.render("error", {
          errorMessage: "Erro ao carregar a página inicial",
        });
      }
    });

    app.post("/searchHabit", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        return res.redirect("/login");
      }

      const query = req.body.query || ""; // Pega os dados da pesquisa do frontend, se não houver, usa uma string vazia
      const categoriesIds = req.body.selectedCategories || []; // Filtro de categorias

      // Monta o SQL para filtrar hábitos
      let sqlInstruction = "SELECT * FROM habitos WHERE id_usuario = $1"; // Altere o placeholder para $1
      const queryParams = [req.session.userId]; // Array que vai armazenar os dados que substituirão os placeholders

      // Verifica se alguma categoria foi enviada
      if (categoriesIds.length > 0) {
        const placeholders = categoriesIds
          .map((_, index) => `$${index + 2}`)
          .join(","); // Organiza os placeholders de $2, $3, etc.
        sqlInstruction += ` AND id_categoria IN (${placeholders})`; // Adiciona a parte de pedir os habitos pelas categorias à instrução
        queryParams.push(...categoriesIds); // Coloca os dados dentro do array de parâmetros
      }

      if (query.trim() !== "") {
        // Se query não for uma string, converta
        if (typeof query !== "string") {
          query = String(query); // Converte query para string caso não seja
        }

        // Use o próximo placeholder disponível para a pesquisa (já usamos $1 e os placeholders das categorias)
        const queryPlaceholder = `$${queryParams.length + 1}`; // O próximo parâmetro será o último + 1
        sqlInstruction += ` AND LOWER(descricao) LIKE ${queryPlaceholder}`; // Converte para minúsculo na comparação
        queryParams.push(`${query.toLowerCase()}%`); // Passa a consulta em minúsculas para a busca
      }

      // Vai pegar os habitos do usuário que parecem com a consulta
      client.query(sqlInstruction, queryParams, (err, result) => {
        if (err) {
          console.error(err.message);
          return res.json({ habitos: [], categorias: {} });
        }

        if (result.rows.length === 0) {
          return res.json({ habitos: [], categorias: {} }); // Nenhum hábito encontrado
        }

        const categoriesFromHabits = result.rows.map((row) => row.id_categoria); // Separa os ids das categorias dos habitos
        const placeholdersCategories = categoriesFromHabits
          .map((_, index) => `$${index + 1}`)
          .join(","); // Organiza os placeholders para as categorias
        const selectCategoriesInstruction = `SELECT * FROM categorias WHERE id IN (${placeholdersCategories})`; // Organiza a instrução SQL

        const categorias = {}; // Vai armazenar as categorias em uma relação de "id": "categoria"
        categoriesIds.includes(0) ? (categorias["0"] = "Outros") : ""; // Para habitos sem categoria definida

        // Seleciona todas as categorias
        client.query(
          selectCategoriesInstruction,
          categoriesFromHabits,
          (err, resultCategories) => {
            if (err) {
              console.error(err.message);
              return res.json({ habitos: [], categorias: {} });
            }

            // Preenche o objeto de categorias
            resultCategories.rows.forEach((category) => {
              categorias[category.id] = category.nome_categoria;
            });

            return res.json({ habitos: result.rows, categorias: categorias }); // Retorna os dados para o frontend
          }
        );
      });
    });

    app.post("/completeHabit", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        return res.status(400).send("usuário não registrado");
      }

      const habitId = req.body.habitId; // Obtém o ID do hábito do corpo da requisição

      // Verifica se o ID do hábito foi fornecido
      if (!habitId) {
        return res.status(400).send("Hábito não fornecido"); // Retorna erro 400 se o ID não for enviado
      }

      // Busca o hábito no banco de dados com base no ID fornecido
      client.query(
        "SELECT * FROM habitos WHERE id_habito = $1",
        [habitId],
        (err, result) => {
          if (err) {
            console.error(err.message); // Loga o erro no console
            return res.status(500).send("Erro ao buscar o hábito"); // Retorna erro 500 em caso de falha no banco
          }

          // Verifica se o hábito foi encontrado
          if (result.rows.length === 0) {
            return res.status(404).send("Hábito não encontrado"); // Retorna erro 404 se o hábito não existir
          }

          const row = result.rows[0]; // O hábito encontrado

          // Inverte o status de completado: se o hábito estiver completo, marca como não completo, e vice-versa
          const novoStatus = row.completado ? false : true;

          // Atualiza o status do hábito no banco de dados
          client.query(
            "UPDATE habitos SET completado = $1 WHERE id_habito = $2",
            [novoStatus, habitId],
            (err) => {
              if (err) {
                return res.status(500).send("Erro interno do servidor"); // Retorna erro 500 se houver problema na atualização
              }

              // Envia uma resposta de sucesso ao cliente após a atualização do hábito
              return res.status(200).send("Hábito atualizado com sucesso");
            }
          );
        }
      );
    });

    app.post("/editHabit", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        // Se o usuário não estiver logado, redireciona para a página de login
        return res.redirect("/login");
      }

      const habitId = req.body.habitId; // Obtém o ID do hábito enviado pelo corpo da requisição

      // Consulta o banco de dados para buscar o hábito com o ID fornecido
      client.query(
        "SELECT * FROM habitos WHERE id_habito = $1",
        [habitId],
        (err, result) => {
          if (err) {
            // Se ocorrer algum erro durante a consulta ao banco, exibe uma mensagem de erro
            console.error(err.message);
            return res.render("error", {
              errorMessage: "Erro ao acessar banco de dados",
            });
          }
          if (result.rows.length === 0) {
            // Se não encontrar o hábito com o ID fornecido, exibe uma mensagem de erro
            return res.render("error", { errorMessage: "Hábito inexistente" });
          }

          // Consulta o banco de dados para obter todas as categorias
          client.query("SELECT * FROM categorias", (err, rows) => {
            if (err) {
              // Se ocorrer um erro ao carregar as categorias, exibe uma mensagem de erro
              console.error(err.message);
              return res.render("error", {
                errorMessage: "Erro ao carregar categorias",
              });
            }

            // Se tudo correr bem, renderiza a página 'addHabito' passando as categorias e o hábito encontrado
            return res.render("addHabito", {
              categorias: rows.rows,
              habito: result.rows[0],
            });
          });
        }
      );
    });

    app.post("/updateHabit", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        // Se o usuário não estiver logado, redireciona para a página de login
        return res.redirect("/login");
      }

      // Extrai os dados enviados do frontend: descrição, categoria, repetição diária, hora limite e habitId
      let { descricao, categoria, repeticao_diaria, hora_limite, habitId } =
        req.body;

      // Verifica se a categoria foi fornecida
      if (categoria) {
        // Se a categoria foi fornecida, verifica se ela existe no banco de dados
        client.query(
          "SELECT * FROM categorias WHERE id = $1 LIMIT 1",
          [categoria],
          (err, result) => {
            if (err) {
              // Se ocorrer um erro ao consultar a categoria, exibe uma mensagem de erro
              console.error(err.message);
              return res.render("error", {
                errorMessage: "Erro ao atualizar o hábito",
              });
            }

            // Se a categoria não for encontrada, define categoria como 0 (sem categoria)
            if (result.rows.length === 0) {
              categoria = 0;
            }

            // A seguir, o processo de atualização do hábito começa

            const userId = req.session.userId; // Obtém o ID do usuário logado

            // Verifica se o hábito existe no banco de dados e se pertence ao usuário logado
            client.query(
              "SELECT * FROM habitos WHERE id_habito = $1 AND id_usuario = $2",
              [habitId, userId],
              (err, result) => {
                if (err) {
                  // Se ocorrer um erro ao verificar o hábito, exibe uma mensagem de erro
                  console.error(err.message);
                  return res.render("error", {
                    errorMessage: "Erro ao verificar o hábito",
                  });
                }

                // Se o hábito não for encontrado ou não for do usuário, exibe uma mensagem de erro
                if (result.rows.length === 0) {
                  return res.render("error", {
                    errorMessage:
                      "Hábito não encontrado ou não autorizado a editar",
                  });
                }

                // Se o hábito for encontrado, atualiza os dados no banco
                client.query(
                  `UPDATE habitos 
                          SET id_categoria = $1, descricao = $2, horario_limite = $3, repeticao_diaria = $4
                          WHERE id_habito = $5 AND id_usuario = $6`,
                  [
                    categoria || null, // Se não houver categoria, define como null
                    descricao,
                    hora_limite || null, // Se não houver hora limite, define como null
                    !!repeticao_diaria, // Converte a repetição diária para um valor booleano (true/false)
                    habitId,
                    userId,
                  ],
                  (err) => {
                    if (err) {
                      // Se ocorrer erro ao atualizar o hábito, exibe uma mensagem de erro
                      console.error(err.message);
                      return res.render("error", {
                        errorMessage: "Erro ao atualizar o hábito",
                      });
                    }

                    // Se a atualização for bem-sucedida, redireciona para a página inicial
                    return res.redirect("/");
                  }
                );
              }
            );
          }
        );
      } else {
        // Se a categoria não foi fornecida, define categoria como 0
        categoria = 0;

        // Segue a mesma lógica para verificar e atualizar o hábito no banco de dados
        const userId = req.session.userId;

        // Verifica se o hábito existe no banco de dados e pertence ao usuário
        client.query(
          "SELECT * FROM habitos WHERE id_habito = $1 AND id_usuario = $2",
          [habitId, userId],
          (err, result) => {
            if (err) {
              // Se ocorrer um erro ao verificar o hábito, exibe uma mensagem de erro
              console.error(err.message);
              return res.render("error", {
                errorMessage: "Erro ao verificar o hábito",
              });
            }

            // Se o hábito não for encontrado ou não for do usuário, exibe uma mensagem de erro
            if (result.rows.length === 0) {
              return res.render("error", {
                errorMessage:
                  "Hábito não encontrado ou não autorizado a editar",
              });
            }

            // Se o hábito for encontrado, atualiza os dados no banco
            client.query(
              `UPDATE habitos 
                      SET id_categoria = $1, descricao = $2, horario_limite = $3, repeticao_diaria = $4
                      WHERE id_habito = $5 AND id_usuario = $6`,
              [
                categoria || null, // Se não houver categoria, define como null
                descricao,
                hora_limite || null, // Se não houver hora limite, define como null
                !!repeticao_diaria, // Converte a repetição diária para um valor booleano
                habitId,
                userId,
              ],
              (err) => {
                if (err) {
                  // Se ocorrer erro ao atualizar o hábito, exibe uma mensagem de erro
                  console.error(err.message);
                  return res.render("error", {
                    errorMessage: "Erro ao atualizar o hábito",
                  });
                }

                // Se a atualização for bem-sucedida, redireciona para a página inicial
                return res.redirect("/");
              }
            );
          }
        );
      }
    });

    // Rota para excluir um hábito
    app.post("/deleteHabit", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        // Se o usuário não estiver logado, retorna um erro 400 com a mensagem 'usuário não logado'
        return res.status(400).send("usuário não logado");
      }

      const habitId = req.body.habitId; // Extrai o ID do hábito a partir do corpo da requisição

      // Verifica se o ID do hábito foi fornecido
      if (!habitId) {
        // Se o ID do hábito não foi fornecido, retorna um erro 400 com a mensagem 'Hábito não fornecido'
        return res.status(400).send("Hábito não fornecido");
      }

      // Busca o hábito no banco de dados com base no ID fornecido
      client.query(
        "SELECT * FROM habitos WHERE id_habito = $1",
        [habitId],
        (err, result) => {
          if (err) {
            // Se ocorrer erro ao consultar o banco de dados, loga o erro e retorna um erro 500
            console.error(err.message);
            return res.status(500).send("Erro ao buscar o hábito");
          }

          // Verifica se o hábito foi encontrado
          if (result.rows.length === 0) {
            // Se o hábito não for encontrado, retorna um erro 404 com a mensagem 'Hábito não encontrado'
            return res.status(404).send("Hábito não encontrado");
          }

          // Deleta o hábito no banco de dados com base no ID fornecido
          client.query(
            "DELETE FROM habitos WHERE id_habito = $1",
            [habitId],
            (err) => {
              if (err) {
                // Se ocorrer erro ao deletar o hábito, loga o erro e retorna um erro 500
                console.error(err.message);
                return res.status(500).send("Erro ao deletar o hábito");
              }

              // Se a exclusão for bem-sucedida, retorna uma resposta de sucesso
              return res.status(200).send("Hábito deletado com sucesso");
            }
          );
        }
      );
    });

    // Rota para renderizar a página de adicionar um novo hábito
    app.get("/add", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        // Se o usuário não estiver logado, redireciona para a página de login
        return res.redirect("/login");
      }

      // Seleciona todas as categorias do banco de dados
      client.query("SELECT * FROM categorias", (err, result) => {
        if (err) {
          // Se ocorrer um erro ao carregar as categorias, loga o erro e retorna uma mensagem de erro
          console.error(err.message);
          return res.render("error", {
            errorMessage: "Erro ao carregar categorias",
          });
        }

        // Se as categorias forem carregadas com sucesso, renderiza a página 'addHabito' com as categorias
        return res.render("addHabito", {
          categorias: result.rows,
          habito: null,
        });
      });
    });

    // Rota para processar a criação de um novo hábito
    app.post("/add", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        // Se o usuário não estiver logado, redireciona para a página de login
        return res.redirect("/login");
      }

      // Extrai os dados do frontend: descrição, categoria, repetição diária e horário limite
      let { descricao, categoria, repeticao_diaria, hora_limite } = req.body;

      // Verifica se a categoria foi fornecida
      if (categoria) {
        // Se a categoria foi fornecida, verifica se ela existe no banco de dados
        client.query(
          "SELECT * FROM categorias WHERE id = $1 LIMIT 1",
          [categoria],
          (err, result) => {
            if (err) {
              // Se ocorrer um erro ao consultar a categoria, loga o erro e retorna uma mensagem de erro
              console.error(err.message);
              return res.render("error", {
                errorMessage: "Erro ao criar novo habito",
              });
            }

            // Se a categoria não for encontrada, define categoria como 0 (sem categoria)
            if (result.rows.length === 0) {
              categoria = 0;
            }
          }
        );
      } else {
        // Se a categoria não foi fornecida, define categoria como 0 (sem categoria)
        categoria = 0;
      }

      const userId = req.session.userId; // Obtém o ID do usuário logado

      // Insere os dados do novo hábito no banco de dados
      client.query(
        `INSERT INTO habitos (id_categoria, id_usuario, descricao, horario_limite, repeticao_diaria) 
      VALUES ($1, $2, $3, $4, $5)`,
        [
          categoria || null, // Se não houver categoria, define como null
          userId, // ID do usuário
          descricao, // Descrição do hábito
          hora_limite || null, // Se não houver hora limite, define como null
          !!repeticao_diaria, // Converte repetição diária para um valor booleano (true/false)
        ],
        (err) => {
          if (err) {
            // Se ocorrer um erro ao inserir o hábito, loga o erro e retorna uma mensagem de erro
            console.error(err.message);
            return res.render("error", {
              errorMessage: "Erro ao adicionar novo habito",
            });
          }
          // Se a inserção for bem-sucedida, redireciona para a página inicial
          return res.redirect("/");
        }
      );
    });

    // Renderiza a página de escolher um objetivo pela primeira vez
    app.get("/chooseObjective", (req, res) => {
      renderObjectivePage(client, req, res, false);
    });

    // Renderiza a página de escolher um objetivo
    app.get("/updateObjective", (req, res) => {
      renderObjectivePage(client, req, res, true);
    });

    // Escolher o objetivo pela primeira vez
    app.post("/chooseObjective", (req, res) => {
      updateObjective(client, req, res, "/chooseHabits");
    });

    // Vai atualizar o banco de dados e adicionar o id do objetivo no campo de objetivo_id da tabela dos usuarios
    app.post("/updateObjective", (req, res) => {
      updateObjective(client, req, res, "/");
    });

    // Página para escolher algum/alguns dos hábitos padrões (após se registrar)
    app.get("/chooseHabits", (req, res) => {
      // Checa se o usuário está logado, tentando acessar seu ID na sessão
      if (!req.session.userId) {
        return res.redirect("/login");
      }
      // Seleciona os hábitos padrão do banco de dados
      client.query("SELECT * FROM habitos_padroes", (err, result) => {
        if (err) {
          console.error(err.message);
          return res.render("error", {
            errorMessage: "Erro ao atualizar o banco de dados",
          }); // Renderiza a página de erro
        }
        // Renderiza a página para escolher os hábitos se tudo ocorrer bem
        return res.render("escolherHabitos", { habitos: result.rows });
      });
    });

    // Página que recebe os hábitos escolhidos pelo usuário
    app.post("/chooseHabits", async (req, res) => {
      if (!req.session.userId) {
        return res.redirect("/login"); // Verifica se o usuário está logado
      }

      const frontendData = req.body.habitos
        .map(Number) // Converte para números
        .filter((id) => !isNaN(id)); // Filtra IDs válidos

      const habitosIds = [...new Set(frontendData)]; // Garante que os IDs sejam únicos

      if (habitosIds.length === 0) {
        return res.redirect("/"); // Redireciona se não houver hábitos selecionados
      }

      try {
        // 1. Consulta os hábitos padrão
        const { rows: result } = await client.query(
          `SELECT * FROM habitos_padroes WHERE id_habito = ANY($1)`,
          [habitosIds]
        );

        // 2. Prepara os placeholders corretamente para o INSERT
        const placeholders = result
          .map(
            (_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`
          ) // Gera os placeholders: ($1, $2, $3), ($4, $5, $6), etc.
          .join(", ");

        const INSERTvalues = [];
        const userId = req.session.userId;

        result.forEach((habito) => {
          INSERTvalues.push(habito.id_categoria, userId, habito.descricao); // Preenche os valores para o INSERT
        });

        // 3. A instrução de INSERT com placeholders adequados
        const sqlIntructionINSERT = `INSERT INTO habitos (id_categoria, id_usuario, descricao) VALUES ${placeholders}`;

        // 4. Executa o INSERT
        await client.query(sqlIntructionINSERT, INSERTvalues);

        // 5. Redireciona após a inserção
        return res.redirect("/");
      } catch (err) {
        console.error(err.message);
        return res.render("error", {
          errorMessage: "Erro ao adicionar hábitos",
        });
      }
    });

    // Apenas renderiza a página de login sem erros
    app.get("/login", (req, res) => {
      res.render("login", { nome: "", email: "", senha: "", erros: {} });
    });

    // Função que ficará responsável por lidar com a tentativa de login do usuário
    app.post("/login", (req, res) => {
      let { email, senha } = req.body; // Informações do form
      // Remove os espaços antes e depois da string dos dados
      email = (email || "").trim();
      senha = (senha || "").trim();

      const erros = {};
      // Verificar o campo email
      if (!email) {
        erros.email = "Digite um email";
      }

      // Verifica o campo de senha
      if (!senha) {
        erros.senha = "Digite uma senha";
      }

      // Se houver erros, renderiza novamente a página com os erros
      if (Object.keys(erros).length > 0) {
        return res.render("login", { erros, email });
      }

      client.query(
        "SELECT id, email, senha_hash FROM usuarios WHERE email = $1 LIMIT 1",
        [email],
        async (err, result) => {
          if (err) {
            console.error(err.message);
            return res.render("login", { erros, email });
          }
          // Se o email não estiver registrado, o retorno será undefined
          if (result.rows.length === 0) {
            erros.email = "Email não registrado";
            return res.render("login", { erros, email });
          }
          // Espera a função ser executada para saber se a senha é válida
          const senhaValida = await compararSenha(
            senha,
            result.rows[0].senha_hash
          );
          if (!senhaValida) {
            erros.senha = "Senha incorreta";
            return res.render("login", { erros, email });
          }
          // Adiciona o ID e o nome do usuário à sessão
          req.session.userId = result.rows[0].id;
          req.session.userEmail = result.rows[0].email;
          // Redireciona para a página principal
          return res.redirect("/");
        }
      );
    });

    // Página de registro
    app.get("/register", (req, res) => {
      res.render("register", { nome: "", email: "", senha: "", erros: {} });
    });

    // Função para lidar com a tentativa de registro do usuário
    app.post("/register", async (req, res) => {
      const { nome, email, senha } = req.body; // Informações do form
      const erros = {}; // Vai armazenar as mensagens de erro para o frontend(se houver erros)

      // Verifica o campo de nome
      if (!nome) {
        erros.nome = "Digite um nome";
      }
      // Verificar o campo email
      if (!email) {
        erros.email = "Digite um email";
      } else if (!validateEmail(email.trim())) {
        erros.email = "O email fornecido é inválido.";
      }

      // Verifica o campo de senha
      if (!senha) {
        erros.senha = "Digite uma senha";
      } else if (/\s/.test(senha.trim())) {
        // Verifica se existe algum espaço na senha
        erros.senha = "A senha não pode conter espaços.";
      } else if (senha.trim().length < 8) {
        erros.senha = "A senha não pode conter menos que 8 caracteres";
      }

      // Se houver erros, renderiza novamente a página com os erros
      if (Object.keys(erros).length > 0) {
        return res.render("register", { erros, nome, email });
      }

      try {
        // Verificar se o email já está registrado
        client.query(
          "SELECT * FROM usuarios WHERE email = $1 LIMIT 1",
          [email.trim()],
          async (err, result) => {
            if (err) {
              console.error(err.message);
              return res.render("register", { erros, nome, email });
            }

            if (result.rows.length > 0) {
              // Se o email já está registrado, envia uma resposta
              erros.email = "Email já registrado";
              return res.render("register", { erros, nome, email });
            }

            // Se o email não foi encontrado, vamos gerar o hash da senha
            const senhaHash = await gerarHashSenha(senha.trim());

            // Inserir usuário no banco de dados
            client.query(
              "INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id",
              [nome.trim(), email.trim(), senhaHash],
              (err, result) => {
                if (err) {
                  console.error(err.message);
                  return res.render("register", { erros, nome, email });
                }

                // Pega o ID do usuário recém inserido
                const userId = result.rows[0].id;

                // Insere o ID e o email do usuário na sessão
                req.session.userId = userId;
                req.session.userEmail = email;

                // Se o usuário foi registrado com sucesso
                res.redirect("/chooseObjective");
              }
            );
          }
        );
      } catch (error) {
        // Se algum erro acontecer
        console.error(error.message);
        return res.render("register", { erros, nome, email });
      }
    });

    // Função de logout
    app.get("/logout", (req, res) => {
      if (!req.session.userId) {
        // Checa se o usuário está logado
        return res.redirect("/login");
      }
      // Destrói a sessão e redireciona o usuário para a página de login
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).send("Erro ao destruir a sessão");
        }
        return res.redirect("/login");
      });
    });

    // Inicia o servidor na porta 5000
    app.listen(5000, "0.0.0.0", () => {
      console.log("Servidor rodando em http://localhost:5000");
    });
  } catch (err) {
    console.error("Erro ao inicializar servidor", err);
  }
}

main();
