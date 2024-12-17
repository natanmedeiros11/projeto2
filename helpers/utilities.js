const bcrypt = require("bcrypt");
const { Client } = require("pg"); // Importação do cliente PostgreSQL

// Expressão regular de email
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Função para validar e-mail
function validateEmail(email) {
  return emailRegex.test(email);
}

// Função assíncrona para gerar o hash da senha
async function gerarHashSenha(senha) {
  const salt = await bcrypt.genSalt(10); // Gera um salt
  const hash = await bcrypt.hash(senha, salt); // Gera o hash usando o salt
  return hash;
}

// Função assíncrona para comparar senha com hash
async function compararSenha(senha, hash) {
  // Função assíncrona para comparar senha com hash
  if (!senha || !hash) {
    throw new Error("Senha ou hash inválido.");
  }

  try {
    const match = await bcrypt.compare(senha, hash); // Compara a senha com o hash
    return match; // retorna o resultado
  } catch (err) {
    console.error("Erro ao comparar senha:", err.message);
    throw err;
  }
}

async function updateObjective(client, req, res, redirectUrl){
  // Checa se o usuário está logado
  if(!req.session.userId){
    return res.redirect("/login");
  }

  const objetivoId = req.body.objetivo // Id do objetivo escolhido pelo usuário
  try {
    // Checa se o objetivo existe no banco de dados
    const result = await client.query("SELECT * FROM objetivos WHERE id = $1 LIMIT 1", [objetivoId]);

    if(result.rows.length === 0){
      return res.render("error", {errorMessage: "Objetivo inválido"});
    }

    // Atualiza o objetivo do usuário
    await client.query("UPDATE usuarios SET objetivo_id = $1 WHERE id = $2", [objetivoId, req.session.userId]);

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error(err.message);
    return res.render("error", {errorMessage: "Erro ao definir objetivo"});
  }
}

async function renderObjectivePage(client, req, res, update){
  // Checa se o usuário está logado, tentando acessar seu ID na sessão
  if(!req.session.userId){
    return res.redirect("/login");
  }

  try {
    // Seleciona os objetivos no banco de dados
    const result = await client.query("SELECT * FROM objetivos");

    // Renderiza a página onde o usuário escolhe seus objetivos
    return res.render("objetivo", {objetivos: result.rows, update:update});
  } catch (err) {
    console.error(err.message);
    return res.render("error", {errorMessage: "Erro ao acessar o banco de dados"});
  }
}

module.exports = { validateEmail, gerarHashSenha, compararSenha, updateObjective, renderObjectivePage };
