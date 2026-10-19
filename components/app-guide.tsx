"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import WalkthroughExercise from "./walkthrough-exercise";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Check,
  MousePointer2,
} from "lucide-react";

type Step = {
  title: string;
  text: string;
  screen: string;
  options: string[];
  selected: number;
};
type Lesson = { title: string; href: string; steps: Step[] };
const step = (
  title: string,
  text: string,
  screen: string,
  options: string[],
  selected = 0,
): Step => ({ title, text, screen, options, selected });
const playerLessons: Lesson[] = [
  {
    title: "Entrar na liga",
    href: "/perfil",
    steps: [
      step(
        "Criar a conta",
        "Abre o convite recebido e preenche a inscrição. Com um convite válido, a entrada é aprovada automaticamente; sem convite, o clube precisa de aprovar a inscrição.",
        "Inscrição",
        ["Nome e contacto", "Email e palavra-passe", "Criar conta"],
        2,
      ),
      step(
        "Confirmar o email",
        "Abre a mensagem de confirmação e segue o link. Se não aparecer, verifica o spam. A confirmação do email continua a ser necessária com convite.",
        "Caixa de entrada",
        ["Fight Club · Confirmar email", "Abrir ligação de confirmação"],
      ),
      step(
        "Verificar o estado",
        "Depois da confirmação, entra na app. Se a inscrição estiver pendente, aguarda a decisão do clube.",
        "A tua conta",
        ["Email confirmado", "Aprovação do clube", "Entrar na arena"],
        2,
      ),
    ],
  },
  {
    title: "Desafiar esta semana",
    href: "/desafios",
    steps: [
      step(
        "Consultar o papel semanal",
        "O administrador publica os papéis da semana. A espada identifica quem ataca; o escudo identifica quem defende. Só depois da publicação é possível desafiar.",
        "Desafios · Esta semana",
        [
          "⚔ Atacante · Tu",
          "🛡 Defensor · Jogador de exemplo",
          "Papéis publicados",
        ],
      ),
      step(
        "Escolher um adversário disponível",
        "Consulta os jogadores da tua categoria. A app mostra quem podes desafiar e explica os impedimentos. As regras do ranking e o limite semanal continuam a aplicar-se.",
        "Quem posso desafiar?",
        [
          "Jogador de exemplo · Pode ser desafiado",
          "Outro jogador · Indisponível nesta semana",
        ],
      ),
      step(
        "Enviar o desafio",
        "Abre o jogador elegível e confirma o desafio. Acompanha a resposta em Desafios e usa o chat para combinar os detalhes.",
        "Novo desafio",
        ["Adversário escolhido", "Enviar desafio", "Aguardar resposta"],
        1,
      ),
    ],
  },
  {
    title: "Combinar e jogar",
    href: "/desafios",
    steps: [
      step(
        "Responder ao desafio",
        "Abre o desafio recebido e consulta as opções disponíveis. Os prazos e as consequências de uma recusa seguem as regras da liga.",
        "Detalhe do desafio",
        ["Consultar desafio", "Aceitar desafio", "Chat dos participantes"],
        1,
      ),
      step(
        "Combinar um horário",
        "Propõe um horário na agenda semanal. O outro jogador confirma a sua disponibilidade antes da confirmação final do campo pelo clube.",
        "Agenda · Segunda a domingo",
        ["Propor horário", "Confirmação dos jogadores", "Confirmação do campo"],
      ),
      step(
        "Consultar o jogo",
        "Depois da confirmação, consulta data, hora e campo em Jogos. Se houver férias, o desafio pode ficar adiado até ao regresso.",
        "Jogos",
        ["Data e hora confirmadas", "Campo atribuído", "Ver detalhes do jogo"],
      ),
      step(
        "Consultar o resultado",
        "Depois do jogo, comunica o resultado ao clube. Só o administrador pode registar ou corrigir o vencedor. O ranking atualiza-se quando o resultado é guardado.",
        "Resultado do jogo",
        ["Jogo terminado", "Clube regista o resultado", "Ranking atualizado"],
        2,
      ),
    ],
  },
  {
    title: "Férias e ranking congelado",
    href: "/perfil",
    steps: [
      step(
        "Indicar a ausência",
        "No Perfil, regista o período de férias para congelar o ranking. Se já houver um jogo confirmado nesse período, combina primeiro a alteração com o clube.",
        "Perfil · Ausências",
        ["Data de início", "Data de regresso", "Guardar férias"],
        2,
      ),
      step(
        "Durante as férias",
        "A posição fica protegida durante o período. Podes receber desafios, mas jogas quando regressares. O clube também pode gerir o congelamento.",
        "Estado do jogador",
        [
          "Ranking congelado",
          "Pode receber desafios",
          "Jogo adiado para o regresso",
        ],
      ),
      step(
        "Regressar à competição",
        "O congelamento termina automaticamente no fim do período. Se regressares mais cedo, pede ao administrador para terminar o congelamento.",
        "Regresso",
        [
          "Fim das férias",
          "Ranking descongelado",
          "Combinar o desafio pendente",
        ],
        1,
      ),
    ],
  },
  {
    title: "Instalar e receber alertas",
    href: "/perfil",
    steps: [
      step(
        "Android · Chrome",
        "Abre a app no Chrome. No menu ⋮, escolhe Instalar aplicação ou Adicionar ao ecrã principal. O nome da opção pode variar conforme o telemóvel.",
        "Chrome · Android",
        ["Menu ⋮", "Instalar aplicação", "Adicionar"],
        1,
      ),
      step(
        "iPhone · Safari",
        "Abre o site no Safari, toca em Partilhar e escolhe Adicionar ao ecrã principal. Abre depois a app através desse ícone. As notificações exigem iOS 16.4 ou posterior.",
        "Safari · iPhone",
        ["Partilhar", "Adicionar ao ecrã principal", "Abrir pelo novo ícone"],
        1,
      ),
      step(
        "Permitir notificações",
        "Abre o Perfil na app instalada e ativa as notificações neste dispositivo. Aceita o pedido de permissão do sistema. Cada dispositivo precisa da sua própria ativação.",
        "Perfil · Notificações",
        ["Ativar notificações", "Permitir no sistema", "Dispositivo registado"],
      ),
      step(
        "Se não receberes alertas",
        "Confirma as permissões nas definições do telemóvel e do navegador, a ligação à internet e as preferências do Perfil. Consulta também Notificações dentro da app.",
        "Verificar alertas",
        [
          "Permissão do dispositivo",
          "Preferências no Perfil",
          "Notificações na app",
        ],
        2,
      ),
    ],
  },
];
const adminLessons: Lesson[] = [
  {
    title: "Preparar a semana",
    href: "/admin",
    steps: [
      step(
        "Abrir os papéis semanais",
        "Em Administração → Papéis semanais, escolhe a semana de segunda-feira a domingo que vais preparar.",
        "Administração",
        ["Jogadores", "Papéis semanais", "Parceiros"],
        1,
      ),
      step(
        "Atribuir ataque e defesa",
        "Define espada para atacantes e escudo para defensores. Todos os jogadores ativos e aprovados precisam de um papel antes da publicação.",
        "Papéis semanais",
        [
          "Jogador A · ⚔ Atacante",
          "Jogador B · 🛡 Defensor",
          "Jogador C · ⚔ Atacante",
        ],
        1,
      ),
      step(
        "Publicar a semana",
        "Revê as escolhas e publica. Os jogadores passam a ver o seu papel e quem podem desafiar. A app aplica o limite de um jogo semanal e as restantes regras da liga.",
        "Revisão da semana",
        ["Papéis completos", "Publicar semana", "Desafios disponíveis"],
        1,
      ),
    ],
  },
  {
    title: "Aprovar ou recusar inscrições",
    href: "/admin",
    steps: [
      step(
        "Filtrar inscrições",
        "Na gestão de jogadores, usa Pendentes, Recusadas e Aprovadas. Inscrições através de um convite válido são aprovadas automaticamente após a confirmação do email; as outras exigem decisão.",
        "Jogadores",
        ["Pendentes", "Recusadas", "Aprovadas"],
      ),
      step(
        "Tomar a decisão",
        "Abre a inscrição pendente e aprova ou recusa. Confirma a identidade e a categoria do jogador antes de permitir a entrada.",
        "Inscrição de exemplo",
        ["Rever dados", "Aprovar inscrição", "Recusar inscrição"],
        1,
      ),
      step(
        "Rever as recusadas",
        "As recusadas ficam numa lista separada e a conta é eliminada automaticamente 48 horas após a recusa. Uma reaprovação antes desse prazo cancela a eliminação.",
        "Recusadas",
        ["Inscrição recusada", "Prazo: 48 horas", "Reaprovar, se necessário"],
        2,
      ),
    ],
  },
  {
    title: "Atribuir parceiros",
    href: "/admin",
    steps: [
      step(
        "Escolher a categoria",
        "Abre Administração → Parceiros. Os jogadores aparecem agrupados por categoria.",
        "Parceiros",
        ["Categoria", "Jogador", "Parceiro"],
      ),
      step(
        "Selecionar um parceiro",
        "A lista apresenta jogadores aprovados da mesma categoria e exclui a própria pessoa. Escolhe Sem parceiro para remover a atribuição.",
        "Parceiro do Jogador A",
        ["Sem parceiro", "Jogador B", "Jogador C"],
        1,
      ),
      step(
        "Guardar a atribuição",
        "Guarda a seleção. A atribuição identifica o parceiro no perfil do jogador; a gestão dos desafios e do ranking continua a ser por jogador.",
        "Parceiros",
        ["Parceiro selecionado", "Guardar", "Atribuição atualizada"],
        1,
      ),
    ],
  },
  {
    title: "Gerir jogos e resultados",
    href: "/admin",
    steps: [
      step(
        "Confirmar a marcação",
        "Revê o horário aceite pelos jogadores e confirma um campo disponível. O jogo só fica marcado após a confirmação final do clube.",
        "Marcação",
        ["Horário aceite", "Campo disponível", "Confirmar campo e marcar jogo"],
        2,
      ),
      step(
        "Registar o resultado",
        "Depois do fim do horário do jogo, abre Resultados e seleciona o vencedor. Podes indicar os sets e guardar para atualizar as estatísticas e o ranking.",
        "Resultados",
        [
          "Jogo terminado",
          "Selecionar vencedor",
          "Guardar resultado e atualizar ranking",
        ],
        2,
      ),
      step(
        "Corrigir um jogo",
        "Usa as ações de edição do jogo para corrigir os dados permitidos. Para um resultado já registado, usa Corrigir resultado e revê o impacto no ranking.",
        "Gestão do jogo",
        ["Editar jogo", "Corrigir resultado", "Rever alterações"],
      ),
      step(
        "Eliminar com cuidado",
        "A eliminação remove os dados relacionados com esse jogo, incluindo reserva, resultado e chat. Revê o aviso: alterações posteriores no ranking podem exigir revisão manual. O registo de auditoria é preservado.",
        "Eliminar jogo",
        ["Rever impacto", "Confirmar eliminação", "Consultar auditoria"],
        0,
      ),
    ],
  },
  {
    title: "Congelar e descongelar ranking",
    href: "/admin",
    steps: [
      step(
        "Escolher o jogador",
        "Em Administração → Jogadores, abre Congelar ranking na linha do jogador.",
        "Jogadores",
        ["Jogador de exemplo", "Congelar ranking"],
        1,
      ),
      step(
        "Definir o período",
        "Preenche o início, o fim e a nota. Um jogo confirmado nesse período precisa de ser reagendado primeiro. Guarda para proteger a posição durante as férias.",
        "Congelar ranking",
        ["Data de início", "Data de fim e nota", "Guardar congelamento"],
        2,
      ),
      step(
        "Terminar o congelamento",
        "O período termina automaticamente na data definida. Para antecipar o regresso, abre Gerir congelamento e escolhe Terminar congelamento. O jogador recebe um aviso.",
        "Gerir congelamento",
        ["Período atual", "Terminar congelamento", "Jogador avisado"],
        1,
      ),
    ],
  },
];

// Versioned and scoped by player: shared devices keep each account's choice separate.
export function FirstVisitWalkthrough({
  playerId,
  admin = false,
  automatic = true,
}: {
  playerId: string;
  admin?: boolean;
  automatic?: boolean;
}) {
  const storageKey = `fightclub:walkthrough:v2:${playerId}:${admin ? "admin" : "player"}`;
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const frames = admin
    ? adminLessons.map((lesson) => ({
        ...lesson.steps[0],
        title: lesson.title,
      }))
    : [
        step(
          "Bem-vindo ao Fight Club",
          "Experimenta os controlos para aprender a usar a app. Conclui cada tarefa para avançar; podes saltar a visita ou repeti-la mais tarde em Como usar a app.",
          "A tua arena",
          [
            "Início · Resumo da liga",
            "Ranking · A tua posição",
            "Desafios · O próximo jogo",
          ],
        ),
        playerLessons[1].steps[0],
        playerLessons[1].steps[1],
        playerLessons[2].steps[1],
        playerLessons[2].steps[3],
        step(
          "Perfil, férias e notificações",
          "No Perfil, atualiza os teus dados, regista férias para congelar o ranking e ativa notificações neste dispositivo. Podes continuar a receber desafios durante as férias e jogar no regresso.",
          "Perfil",
          [
            "Dados do jogador",
            "Férias e ranking congelado",
            "Notificações neste dispositivo",
          ],
          2,
        ),
      ];
  const current = frames[index];
  useEffect(() => {
    if (!automatic) return;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    setIndex(0);
    setCompletedSteps([]);
    setOpen(true);
  }, [automatic, storageKey]);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);
  function finish() {
    try {
      localStorage.setItem(storageKey, "seen");
    } catch {
      /* Keep the app usable without browser storage. */
    }
    setOpen(false);
  }
  return (
    <>
      {!automatic && (
        <button
          onClick={() => {
            setIndex(0);
            setCompletedSteps([]);
            setOpen(true);
          }}
        >
          <RotateCcw size={16} aria-hidden="true" /> Repetir visita guiada
        </button>
      )}
      {open && (
        <dialog
          ref={dialog}
          className="walkthrough-dialog"
          aria-labelledby="walkthrough-title"
          onCancel={(event) => {
            event.preventDefault();
            finish();
          }}
        >
          <div className="stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="eyebrow">
                {admin ? "VISITA GUIADA · ADMIN" : "VISITA GUIADA"}
              </span>
              <button onClick={finish}>Saltar visita</button>
            </div>
            <div aria-live="polite" aria-atomic="true">
              <span className="muted">
                Passo {index + 1} de {frames.length}
              </span>
              <h2 id="walkthrough-title">{current.title}</h2>
              <WalkthroughExercise
                key={`${index}-${open}`}
                admin={admin}
                index={index}
                onComplete={() =>
                  setCompletedSteps((previous) =>
                    previous.includes(index) ? previous : [...previous, index],
                  )
                }
              />
              <p className="walkthrough-description">{current.text}</p>
            </div>
            <div className="guide-controls">
              <button
                disabled={index === 0}
                onClick={() => {
                  setCompletedSteps((previous) =>
                    previous.filter((value) => value !== index - 1),
                  );
                  setIndex(index - 1);
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" /> Anterior
              </button>
              <button
                disabled={!completedSteps.includes(index)}
                onClick={() =>
                  index === frames.length - 1
                    ? finish()
                    : (setCompletedSteps((previous) =>
                        previous.filter((value) => value !== index + 1),
                      ),
                      setIndex(index + 1))
                }
              >
                {index === frames.length - 1 ? "Concluir visita" : "Seguinte"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            <p className="muted">
              Podes repetir esta visita e consultar as animações em{" "}
              {admin ? "Manual do administrador" : "Como usar a app"}.
            </p>
          </div>
        </dialog>
      )}
    </>
  );
}

export default function AppGuide({
  admin = false,
  playerId,
}: {
  admin?: boolean;
  playerId: string;
}) {
  const lessons = admin ? adminLessons : playerLessons;
  const [lessonIndex, setLessonIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const lesson = lessons[lessonIndex];
  const current = lesson.steps[index];
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(query.matches);
      if (query.matches) setPlaying(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (index === lesson.steps.length - 1) setPlaying(false);
      else setIndex(index + 1);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [playing, index, lesson]);
  function move(next: number) {
    setPlaying(false);
    setIndex(next);
  }
  return (
    <section className="app-guide stack">
      <div>
        <span className="eyebrow">GUIA INTERATIVO</span>
        <h1>{admin ? "Manual do administrador" : "Como usar a app"}</h1>
        <p>
          Escolhe um tema e acompanha a demonstração passo a passo. Podes
          pausar, repetir ou avançar ao teu ritmo.
        </p>
      </div>
      <FirstVisitWalkthrough
        playerId={playerId}
        admin={admin}
        automatic={false}
      />
      {admin && <Link href="/ajuda">Ver também o guia do jogador →</Link>}
      <div className="guide-layout">
        <nav className="panel guide-lessons" aria-label="Temas do guia">
          {lessons.map((l, i) => (
            <button
              key={l.title}
              aria-current={lessonIndex === i ? "true" : undefined}
              className={lessonIndex === i ? "active" : ""}
              onClick={() => {
                setLessonIndex(i);
                move(0);
              }}
            >
              {i + 1}. {l.title}
            </button>
          ))}
        </nav>
        <div className="panel stack">
          <h2>{lesson.title}</h2>
          <span className="badge">Demonstração · dados de exemplo</span>
          <div
            className={`guide-demo ${playing ? "is-playing" : ""}`}
            aria-label="Pré-visualização da demonstração"
          >
            <div className="guide-demo-header">
              FIGHT CLUB <span>{admin ? "ADMIN" : "JOGADOR"}</span>
            </div>
            <div key={`${lessonIndex}-${index}`} className="guide-scene">
              <h3>{current.screen}</h3>
              {current.options.map((option, i) => (
                <div
                  key={option}
                  className={`guide-option ${current.selected === i ? "guide-focus" : ""}`}
                >
                  {current.selected === i && (
                    <MousePointer2 size={18} aria-hidden="true" />
                  )}
                  <span>{option}</span>
                  {current.selected === i && (
                    <Check size={18} aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            <div className="guide-progress" aria-hidden="true">
              {lesson.steps.map((_, i) => (
                <span key={i} className={i <= index ? "done" : ""} />
              ))}
            </div>
          </div>
          <div
            className="guide-explanation"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="eyebrow">
              PASSO {index + 1} DE {lesson.steps.length}
            </span>
            <h3>{current.title}</h3>
            <p>{current.text}</p>
          </div>
          <div className="guide-controls">
            <button
              onClick={() => {
                if (playing) setPlaying(false);
                else {
                  if (index === lesson.steps.length - 1) setIndex(0);
                  setPlaying(true);
                }
              }}
            >
              <span aria-hidden="true">
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </span>
              {playing ? "Pausar" : "Reproduzir"}
            </button>
            <button
              onClick={() => {
                setIndex(0);
                setPlaying(true);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Repetir
            </button>
            <button
              aria-label="Passo anterior"
              disabled={index === 0}
              onClick={() => move(index - 1)}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              aria-label="Próximo passo"
              disabled={index === lesson.steps.length - 1}
              onClick={() => move(index + 1)}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          {reducedMotion && (
            <p className="muted">
              Movimento reduzido ativo. Usa os botões para avançar ou inicia a
              reprodução quando quiseres.
            </p>
          )}
          <details>
            <summary>Todos os passos por escrito</summary>
            <ol className="guide-written">
              {lesson.steps.map((s, i) => (
                <li key={s.title}>
                  <button
                    aria-current={index === i ? "step" : undefined}
                    onClick={() => move(i)}
                  >
                    {s.title}
                  </button>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </details>
          <Link className="button" href={lesson.href}>
            Abrir{" "}
            {admin
              ? "Administração"
              : lesson.href === "/perfil"
                ? "Perfil"
                : "Desafios"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
