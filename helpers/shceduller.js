const cron = require("node-cron");
const { resetDailyHabits } = require("./habitReset");  // Importa a função de reset

// Função que vai ser chamada ao inicializar o agendador
module.exports = function(client) {
  // Passa o client para a função de reset dos hábitos
  cron.schedule("0 0 * * *", () => {
    resetDailyHabits(client); // Passa o client para a função de reset
    console.log("Reset dos hábitos diários realizado.");
  });
};

