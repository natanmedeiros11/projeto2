function resetDailyHabits(client) {
    const query = `
      UPDATE habitos 
      SET completado = false 
      WHERE repeticao_diaria = true
    `;
  
    client.query(query, (err, result) => {
      if (err) {
        console.error("Erro ao resetar hábitos diários:", err);
      } else {
        console.log("Hábitos diários resetados com sucesso");
      }
    });
  }
  
  module.exports = { resetDailyHabits };
  