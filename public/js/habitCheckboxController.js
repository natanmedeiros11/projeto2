const checkboxes = document.querySelectorAll('.chooseHabitsForm input[type="checkbox"]')
checkboxes.forEach((checkbox) => {
    // Adiciona um event listener para checar quando alguma checkbox é marcada ou desmarcada
    checkbox.addEventListener("change", function(){
        const isChecked = Array.from(checkboxes).some(checkbox => checkbox.checked); // Checa na lista de checkboxes se algum está marcado
        const submitButton = document.querySelector(".chooseHabitsButtonArea button") // Botão que envia o forms
        // Se houver algum checkbox marcado o botão é reabilitado
        if(isChecked){
            submitButton.disabled = false
        } else {
        // Se nenhum checkbox estiver marcado então o botão é desabilitado novamente
            submitButton.disabled = true
        }
    })
})