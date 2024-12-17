document.querySelectorAll('.chooseObjectiveForm input[type="radio"').forEach((radio) => {
    radio.addEventListener("change", () => {
        document.querySelector(".objectiveButtonsArea button").disabled = false // Reabilita o botão de submit se algum radio for selecionado
    })
})