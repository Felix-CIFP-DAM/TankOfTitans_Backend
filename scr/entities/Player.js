export class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.pa = 5;
        this.selectedTanks = []; // Aquí guardaremos el tipo de tanque seleccionado 
        this.isReady = false;
    }

    // Método para que el jugador elija su equipo
    setTeam(typesArray) {
        if (typesArray.length === 3) {
            this.selectedTanks = typesArray;
            this.isReady = true;
        }
    }
}