"use client";
import { useState } from "react";
import { Check, MousePointer2 } from "lucide-react";

type Props = { admin: boolean; index: number; onComplete: () => void };
const playerTasks = [
  "Toca em Ranking para consultar a classificação.",
  "Toca na espada para consultar o papel de atacante.",
  "Escolhe o defensor disponível e envia um desafio de treino.",
  "Escolhe um dia e uma hora e propõe o horário.",
  "Abre o resultado que o administrador registou.",
  "Preenche as datas e guarda um período de férias de treino.",
];
const adminTasks = [
  "Atribui ataque ao Jogador A e defesa ao Jogador B. Depois publica a semana de treino.",
  "Abre Pendentes e aprova a inscrição de exemplo.",
  "Escolhe um parceiro para o Jogador A e guarda a atribuição.",
  "Seleciona o vencedor e guarda o resultado de treino.",
  "Define as datas e guarda o congelamento de treino.",
];

export default function WalkthroughExercise({
  admin,
  index,
  onComplete,
}: Props) {
  const [done, setDone] = useState(false);
  const [choice, setChoice] = useState("");
  const [second, setSecond] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hint, setHint] = useState("");
  const [feedback, setFeedback] = useState("");
  const task = (admin ? adminTasks : playerTasks)[index];
  function complete(message: string) {
    setDone(true);
    setHint("");
    setFeedback(message);
    onComplete();
  }
  function submit(event: React.FormEvent, message: string) {
    event.preventDefault();
    complete(message);
  }
  const isDates = (admin && index === 4) || (!admin && index === 5);
  const target = (label: string, action: () => void) => (
    <button
      type="button"
      className="guide-option guide-practice-target"
      onClick={action}
      disabled={done}
    >
      <MousePointer2 size={18} aria-hidden="true" />
      {label}
    </button>
  );
  return (
    <div className="walkthrough-exercise stack">
      <p className="practice-task">
        <MousePointer2 size={18} aria-hidden="true" />
        <strong>{task}</strong>
      </p>
      <span className="badge">
        Treino · dados fictícios · não altera a liga
      </span>
      <div className="guide-demo">
        <div className="guide-demo-header">
          FIGHT CLUB <span>{admin ? "ADMINISTRAÇÃO" : "A TUA ARENA"}</span>
        </div>
        <div className="guide-scene">
          {!admin && index === 0 && (
            <>
              <div className="guide-practice-nav">
                {["Início", "Ranking", "Desafios", "Perfil"].map((label) => (
                  <button
                    key={label}
                    disabled={done}
                    className={
                      label === "Ranking" ? "guide-practice-target" : ""
                    }
                    onClick={() =>
                      label === "Ranking"
                        ? complete(
                            "Abriste o Ranking. Aqui consultas a tua posição e os jogadores da tua categoria.",
                          )
                        : setHint("Para este exercício, abre Ranking.")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {done && (
                <div className="guide-option">
                  1.º Jogador A · 2.º Tu · 3.º Jogador B
                </div>
              )}
            </>
          )}
          {!admin && index === 1 && (
            <>
              {target("⚔ Atacante · Tu", () =>
                complete(
                  "Certo! A espada indica ataque: podes iniciar um desafio a um defensor elegível.",
                ),
              )}
              <div className="guide-option">🛡 Defensor · Jogador B</div>
            </>
          )}
          {!admin && index === 2 && (
            <>
              <button
                className={`guide-option ${choice === "B" ? "guide-focus" : "guide-practice-target"}`}
                aria-pressed={choice === "B"}
                disabled={done}
                onClick={() => {
                  setChoice("B");
                  setHint("");
                }}
              >
                🛡 Jogador B · Pode ser desafiado
              </button>
              <button
                className="guide-option"
                disabled={done}
                onClick={() =>
                  setHint(
                    "Este jogador já tem jogo nesta semana. Escolhe o defensor disponível.",
                  )
                }
              >
                Jogador C · Limite semanal atingido
              </button>
              {choice === "B" &&
                target("Enviar desafio de treino", () =>
                  complete(
                    "Desafio de treino enviado. Na app, o adversário recebe o pedido e pode responder.",
                  ),
                )}
            </>
          )}
          {!admin && index === 3 && (
            <form
              className="stack"
              onSubmit={(event) =>
                submit(
                  event,
                  "Horário proposto. O outro jogador confirma a disponibilidade e o clube confirma o campo.",
                )
              }
            >
              <label>
                Dia do jogo
                <select
                  required
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  disabled={done}
                >
                  <option value="">Escolher dia</option>
                  <option>Quarta-feira</option>
                  <option>Sexta-feira</option>
                  <option>Sábado</option>
                </select>
              </label>
              <label>
                Hora
                <select
                  required
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                  disabled={done}
                >
                  <option value="">Escolher hora</option>
                  <option>18:00</option>
                  <option>19:30</option>
                  <option>21:00</option>
                </select>
              </label>
              <button
                className="guide-practice-target"
                disabled={done || !choice || !second}
              >
                Propor horário
              </button>
            </form>
          )}
          {!admin && index === 4 && (
            <>
              {target("Ver resultado · Tu vs. Jogador B", () =>
                complete(
                  "Resultado consultado: vitória tua, registada pelo administrador. O ranking e as estatísticas foram atualizados no exemplo.",
                ),
              )}
              {done && (
                <div className="guide-option">
                  ✓ Vitória · Resultado registado pelo clube
                </div>
              )}
            </>
          )}
          {admin && index === 0 && (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (choice !== "attack" || second !== "defend") {
                  setHint(
                    "Neste exercício, escolhe ataque para A e defesa para B.",
                  );
                  return;
                }
                complete(
                  "Semana de treino publicada. Os jogadores já podem consultar os papéis e desafiar de acordo com as regras.",
                );
              }}
            >
              <label>
                Jogador A
                <select
                  required
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  disabled={done}
                >
                  <option value="">Escolher papel</option>
                  <option value="attack">⚔ Atacante</option>
                  <option value="defend">🛡 Defensor</option>
                </select>
              </label>
              <label>
                Jogador B
                <select
                  required
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                  disabled={done}
                >
                  <option value="">Escolher papel</option>
                  <option value="attack">⚔ Atacante</option>
                  <option value="defend">🛡 Defensor</option>
                </select>
              </label>
              <button
                className="guide-practice-target"
                disabled={done || !choice || !second}
              >
                Publicar semana de treino
              </button>
            </form>
          )}
          {admin && index === 1 && (
            <>
              {target("Pendentes (1)", () => setChoice("pending"))}
              {choice === "pending" && (
                <div className="stack">
                  <div className="guide-option">
                    Jogador de exemplo · Email confirmado · Aguarda aprovação
                  </div>
                  {target("Aprovar inscrição de treino", () =>
                    complete(
                      "Inscrição aprovada no treino. Na app, o jogador passa para Aprovadas e recebe um aviso.",
                    ),
                  )}
                </div>
              )}
            </>
          )}
          {admin && index === 2 && (
            <form
              className="stack"
              onSubmit={(event) =>
                submit(
                  event,
                  "Parceiro atribuído no treino. A lista exclui o próprio jogador e mostra opções da mesma categoria.",
                )
              }
            >
              <label>
                Parceiro do Jogador A
                <select
                  required
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  disabled={done}
                >
                  <option value="">Escolher parceiro</option>
                  <option>Jogador B</option>
                  <option>Jogador C</option>
                </select>
              </label>
              <button
                className="guide-practice-target"
                disabled={done || !choice}
              >
                Guardar parceiro
              </button>
            </form>
          )}
          {admin && index === 3 && (
            <form
              className="stack"
              onSubmit={(event) =>
                submit(
                  event,
                  "Resultado guardado no treino. Na liga, esta ação atualiza vitórias, derrotas e o ranking conforme as regras.",
                )
              }
            >
              <div className="guide-option">
                Jogo de exemplo · Terminado · Resultado pendente
              </div>
              <label>
                Vencedor
                <select
                  required
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  disabled={done}
                >
                  <option value="">Selecionar vencedor</option>
                  <option>Jogador A</option>
                  <option>Jogador B</option>
                </select>
              </label>
              <button
                className="guide-practice-target"
                disabled={done || !choice}
              >
                Guardar resultado de treino
              </button>
            </form>
          )}
          {isDates && (
            <form
              className="stack"
              onSubmit={(event) =>
                submit(
                  event,
                  "Congelamento guardado no treino. A posição fica protegida durante as férias; os desafios podem ser jogados no regresso.",
                )
              }
            >
              <label>
                Data de início
                <input
                  type="date"
                  required
                  value={start}
                  disabled={done}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Data de regresso
                <input
                  type="date"
                  required
                  min={start || undefined}
                  value={end}
                  disabled={done}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <button
                className="guide-practice-target"
                disabled={done || !start || !end || end < start}
              >
                {admin
                  ? "Guardar congelamento de treino"
                  : "Guardar férias de treino"}
              </button>
            </form>
          )}
        </div>
      </div>
      {hint && (
        <p role="status" className="practice-hint">
          {hint}
        </p>
      )}
      {done && (
        <p role="status" className="practice-success">
          <Check size={20} aria-hidden="true" />
          {feedback}
        </p>
      )}
    </div>
  );
}
