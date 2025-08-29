// --- VARIÁVEIS GLOBAIS E CONSTANTES ---
const API_URL = 'https://meu-treino-api-1bh7.onrender.com';
let planosDisponiveis = [];
let exercicioAtual = null;
let serieAtualIndex = 0;
let idCronometro = null;

// --- ELEMENTOS DA PÁGINA (DOM) ---
const planSelectionSection = document.getElementById('plan-selection');
const workoutListSection = document.getElementById('workout-list');
const activeWorkoutSection = document.getElementById('active-workout-screen');
const workoutTitle = document.getElementById('workout-title');
const exerciseContainer = document.getElementById('exercise-container');
const activeExerciseTitle = document.getElementById('active-exercise-title');
const currentSetInfo = document.getElementById('current-set-info');
const targetRepsInfo = document.getElementById('target-reps-info');
const lastPerformanceInfo = document.getElementById('last-performance-info');
const logSetForm = document.getElementById('log-set-form');
const weightInput = document.getElementById('weight');
const repsInput = document.getElementById('reps');
const timerContainer = document.getElementById('timer-container');
const timerDisplay = document.getElementById('timer-display');
const skipRestBtn = document.getElementById('skip-rest-btn');
const finishExerciseBtn = document.getElementById('finish-exercise-btn');

// --- FUNÇÕES PRINCIPAIS ---

/** 1. Busca os planos disponíveis na API e renderiza os botões de seleção */
async function setupPlanSelection() {
    try {
        const response = await fetch(`${API_URL}/workout-plans`);
        planosDisponiveis = await response.json();

        planSelectionSection.innerHTML = ''; // Limpa botões estáticos

        planosDisponiveis.forEach(plan => {
            const button = document.createElement('button');
            button.className = 'plan-btn';
            button.dataset.planName = plan.name;
            button.textContent = plan.name;
            planSelectionSection.appendChild(button);
        });

    } catch (error) {
        console.error("Falha ao buscar planos de treino:", error);
        planSelectionSection.innerHTML = "<p>Erro ao carregar treinos. Verifique se o backend está rodando.</p>";
    }
}

/** 2. Renderiza a lista de exercícios do plano selecionado */
function renderWorkoutList(planoDeExercicios) {
    exerciseContainer.innerHTML = '';
    planoDeExercicios.forEach(ex => {
        const exerciseCard = document.createElement('div');
        exerciseCard.className = 'exercise-card';
        exerciseCard.innerHTML = `
            <div>
                <h3>${ex.exercise.name}</h3>
                <p>${ex.plannedSets.length} séries</p>
            </div>
            <button data-exercise-id="${ex.id}">Iniciar</button>
        `;
        exerciseContainer.appendChild(exerciseCard);
    });
}

/** 3. Inicia o modo de treino para um exercício específico */
function startExercise(exerciseId) {
    // Encontra o plano de treino ativo para achar o exercício clicado
    const planoAtivo = planosDisponiveis.find(p => p.name === workoutTitle.textContent);
    exercicioAtual = planoAtivo.plannedExercises.find(ex => ex.id === Number(exerciseId));

    serieAtualIndex = 0;

    workoutListSection.classList.add('hidden');
    activeWorkoutSection.classList.remove('hidden');
    finishExerciseBtn.classList.add('hidden');
    logSetForm.classList.remove('hidden');
    timerContainer.classList.add('hidden');

    activeExerciseTitle.textContent = exercicioAtual.exercise.name;
    updateSetInformation();
}

/** 4. Atualiza a UI com as informações da série atual e busca o histórico */
async function updateSetInformation() {
 if (!exercicioAtual || !exercicioAtual.plannedSets[serieAtualIndex]) {
        console.error("Exercício atual ou série não definidos");
        return;
    }
    const serie = exercicioAtual.plannedSets[serieAtualIndex];
    currentSetInfo.textContent = `${serieAtualIndex + 1} - ${serie.type}`;
    targetRepsInfo.textContent = serie.targetReps;

    lastPerformanceInfo.textContent = "Carregando...";
    const lastPerformance = await fetchLastPerformance(exercicioAtual.exercise.id, serieAtualIndex);

    if (lastPerformance) {
        lastPerformanceInfo.textContent = `Peso: ${lastPerformance.weight}kg | Reps: ${lastPerformance.repetitions}`;
        weightInput.value = lastPerformance.weight;
        repsInput.value = lastPerformance.repetitions;
    } else {
        lastPerformanceInfo.textContent = "Primeira vez executando esta série!";
        weightInput.value = 0;
        repsInput.value = 0;
    }

    weightInput.focus();
}

/** 5. Busca o desempenho da última vez para uma série específica */
async function fetchLastPerformance(exerciseId, setIndex) {
    try {
        const response = await fetch(`${API_URL}/workouts/exercise/${exerciseId}/last-performance?setIndex=${setIndex}`);
        if (response.status === 404) {
            return null; // Não encontrado é normal para primeira execução
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar último desempenho:", error);
        return null;
    }
}

/** 6. Lida com o registro de uma nova série */
async function handleLogSet(event) {
    event.preventDefault();

    const logData = {
        exerciseId: exercicioAtual.exercise.id,
        setIndex: serieAtualIndex,
        weight: weightInput.value,
        repetitions: repsInput.value
    };

    try {
        const response = await fetch(`${API_URL}/workouts/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logData)
        });

        if (response.ok) {
            console.log("Série registrada com sucesso!");
        } else {
            alert('Erro ao registrar série.');
        }
    } catch (error) {
        console.error('Erro de rede ao registrar série:', error);
    }

    logSetForm.reset();

    const serieAtual = exercicioAtual.plannedSets[serieAtualIndex];
    startTimer(serieAtual.restTimeSeconds);

    serieAtualIndex++;
    if (serieAtualIndex >= exercicioAtual.plannedSets.length) {
        logSetForm.classList.add('hidden');
        finishExerciseBtn.classList.remove('hidden');
    } else {
        updateSetInformation();
    }
}

/** 7. Inicia o cronômetro de descanso */
function startTimer(seconds) {
    clearInterval(idCronometro);
    let tempoRestante = seconds;

    timerContainer.classList.remove('hidden');
    logSetForm.classList.add('hidden');

    const updateDisplay = () => {
        const minutes = Math.floor(tempoRestante / 60).toString().padStart(2, '0');
        const secs = (tempoRestante % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${minutes}:${secs}`;
    };

    updateDisplay();

    idCronometro = setInterval(() => {
        tempoRestante--;
        updateDisplay();
        if (tempoRestante <= 0) {
            finishRest();
        }
    }, 1000);
}

/** 8. Finaliza o descanso e prepara para a próxima série */
function finishRest() {
    clearInterval(idCronometro);
    timerContainer.classList.add('hidden');
    if (serieAtualIndex < exercicioAtual.plannedSets.length) {
        logSetForm.classList.remove('hidden');
        weightInput.focus();
    }
}

// --- EVENT LISTENERS (QUEM "ESCUTA" AS AÇÕES DO USUÁRIO) ---

// Delegação de evento para os botões de seleção de plano
planSelectionSection.addEventListener('click', async (event) => {
    if (event.target.classList.contains('plan-btn')) {
        const planName = event.target.dataset.planName;
        try {
            const response = await fetch(`${API_URL}/workout-plans/${planName}`);
            const planoDetalhado = await response.json();

            planSelectionSection.classList.add('hidden');
            workoutListSection.classList.remove('hidden');
            workoutTitle.textContent = planoDetalhado.name;

            renderWorkoutList(planoDetalhado.plannedExercises);
        } catch (error) {
            console.error(`Falha ao buscar detalhes do ${planName}:`, error);
        }
    }
});

// Delegação de evento para os botões "Iniciar"
workoutListSection.addEventListener('click', (event) => {
    if (event.target.dataset.exerciseId) {
        const exerciseId = parseInt(event.target.dataset.exerciseId);
        startExercise(exerciseId);
    }
});

// Registrar série
logSetForm.addEventListener('submit', handleLogSet);

// Pular descanso
skipRestBtn.addEventListener('click', finishRest);

// Finalizar exercício e voltar para a lista
finishExerciseBtn.addEventListener('click', () => {
    activeWorkoutSection.classList.add('hidden');
    workoutListSection.classList.remove('hidden');
});

// --- INICIALIZAÇÃO ---
// Chama a função inicial quando a página carrega
document.addEventListener('DOMContentLoaded', setupPlanSelection);