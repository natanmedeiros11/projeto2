const searchBar = document.getElementById("searchHabit");
const habitsArea = document.getElementById("habitArea");

const categoriesCheckboxes = document.querySelectorAll(
  ".categoryFilterCheckbox"
);
const habitCheckboxes = document.querySelectorAll(".habitCheckbox");

const habitDeleteButton = document.querySelectorAll(".delete-btn");

let selectedCategories = []; // Armazena as categorias selecionadas

// Evento de input na barra de pesquisa
searchBar.addEventListener("input", function () {
  const value = this.value;
  fetchHabits(value, selectedCategories); // Chama a função com o valor da pesquisa e as categorias
});

// Evento de mudança nas categorias
categoriesCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const categoryId = checkbox.getAttribute("id");
    // Pega apenas as categorias marcadas
    if (checkbox.checked) {
      selectedCategories.push(categoryId); // Adiciona a categoria ao array
    } else {
      selectedCategories = selectedCategories.filter((id) => id !== categoryId); // Remove a categoria do array
    }

    // Chama a função com a pesquisa atual e as categorias selecionadas
    fetchHabits(searchBar.value, selectedCategories);
  });
});

habitCheckboxes.forEach((habit) => {
  habit.addEventListener("change", function () {
    completeHabit(habit)
  });
});

function completeHabit(habit){
  fetch("/completeHabit", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      habitId: habit.getAttribute("id").replace("habit", ""),
    }), // Remove "habit" para enviar o ID correto
  })
    .then((response) => {
      if (!response.ok) {
        alert("Ocorreu um erro");
      }
    })
    .catch((err) => {
      console.error(err.message);
    });
}

habitDeleteButton.forEach((button) => {
  button.addEventListener("click", function () {
    deleteHabit(button);
  });
});

function deleteHabit(button) {
  const confirmation = confirm("Deseja deletar esse hábito?");

  if (confirmation) {
    fetch("/deleteHabit", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        habitId: button.getAttribute("id").replace("habit", ""),
      }), // Remove "habit" para enviar o ID correto
    })
      .then((response) => {
        if (!response.ok) {
          alert("Ocorreu um erro");
        } else {
          // remova o elemento da lista de hábitos ou atualize a interface
          button.closest(".habit").remove(); // Supondo que o botão esteja dentro de um elemento representando o hábito
          alert("Hábito deletado");
        }
      })
      .catch((err) => {
        console.error(err.message);
      });
  }
}

// Função principal que faz a requisição ao backend com os filtros
function fetchHabits(query, selectedCategories) {
  fetch("/searchHabit", {
    method: "post", // Método da requisição
    headers: {
      "Content-Type": "application/json", // Informa que os dados enviados serão um JSON
    },
    body: JSON.stringify({
      query: query,
      selectedCategories: selectedCategories,
    }), // Envia tanto a pesquisa quanto as categorias
  })
    .then((response) => response.json())
    .then((data) => {
      // Atualiza a interface com os hábitos retornados
      if (data.habitos.length > 0) {
        habitsArea.innerHTML = loadHabits(data);
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", function (event) {
            deleteHabit(button); // Chama a função que você deseja para deletar o hábito.
          });
        });

        document.querySelectorAll(".habitCheckbox").forEach((habit) => {
          habit.addEventListener("change", function () {
            console.log("evento adicionado")
            completeHabit(habit) // Chama a função para completar o habito
          });
        });
      } else {
        habitsArea.innerHTML = "Nenhum hábito encontrado :/";
      }
    })
    .catch((err) => {
      console.error(err.message);
    });
}

function loadHabits(data) {
  let html = "";

  // Organiza os hábitos para que os completados fiquem por último
  const sortedHabits = data.habitos.sort((a, b) => {
    // Se ambos ou nenhum hábito estão completados, não muda a ordem
    if (a.completado === b.completado) {
      return 0;
    }
    // Se o hábito 'a' estiver completado, ele vai para o final
    return a.completado ? 1 : -1;
  });

  // Agora percorre a lista de hábitos já ordenados
  sortedHabits.forEach((habito) => {
    html += `
    ${
      habito.completado
        ? `<input type="checkbox" checked id="habit${habito.id_habito}" class='habitCheckbox'>`
        : `<input type="checkbox" id="habit${habito.id_habito}" class='habitCheckbox'>`
    }

    <label for="habit${habito.id_habito}" class="habit-container">
        <div class="habit">
            <div class="checkmark">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19L21 7l-1.41-1.41z" />
                </svg>
            </div>
            <div class="habit-description">${habito.descricao}</div>
            <div class="habit-repeat">${
              habito.repeticao_diaria ? "Todos os dias" : "Hoje"
            }</div>
            <div class="habit-time">${habito.horario_limite || ""}</div>
            <div class="habit-category">${
              data.categorias[habito.id_categoria]
            }</div>
            <div class="habit-actions">
                <form action="/editHabit" method="post">
                    <input type="hidden" name="habitId" value="${
                      habito.id_habito
                    }">
                    <button type="submit" class="edit-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M5 19h1.425L16.2 9.225L14.775 7.8L5 17.575zm-2 2v-4.25L16.2 3.575q.3-.275.663-.425t.762-.15t.775.15t.65.45L20.425 5q.3.275.438.65T21 6.4q0 .4-.137.763t-.438.662L7.25 21zM19 6.4L17.6 5zm-3.525 2.125l-.7-.725L16.2 9.225z" />
                        </svg>
                    </button>
                </form>
                <button class="delete-btn" id='habit${habito.id_habito}'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M7.616 20q-.672 0-1.144-.472T6 18.385V6H5V5h4v-.77h6V5h4v1h-1v12.385q0 .69-.462 1.153T16.384 20zM17 6H7v12.385q0 .269.173.442t.443.173h8.769q.23 0 .423-.192t.192-.424zM9.808 17h1V8h-1zm3.384 0h1V8h-1zM7 6v13z" />
                  </svg>
                </button>
            </div>
        </div>
      </label>
    `;
  });
  return html;
}
