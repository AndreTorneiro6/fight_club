import { Application } from "@/components/application";
import { notFound } from "next/navigation";
const routes = new Set([
  "",
  "auth",
  "inscricao",
  "privacidade",
  "inicio",
  "ranking",
  "desafios",
  "jogos",
  "perfil",
  "notificacoes",
  "admin",
  "title-fight",
  "campeoes",
  "epocas",
  "estatisticas",
  "regras",
  "premios",
]);
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const route = path.join("/");
  if (!routes.has(route) && !/^desafios\/[^/]+$/.test(route)) notFound();
  if (route === "privacidade")
    return (
      <main className="content">
        <article className="panel stack">
          <h1>Privacidade · Fight Club Padel League</h1>
          <p>
            Versão 2026-10. O Neiva Padel Club organiza esta liga e gere os
            dados necessários à inscrição, autenticação, desafios, jogos,
            ranking e apoio aos jogadores.
          </p>
          <p>
            Usamos nome, email, contacto, fotografia opcional, disponibilidade e
            histórico da competição. Os jogadores aprovados veem nomes,
            fotografias e classificações da liga; o email, telefone e
            disponibilidades privadas não são apresentados aos outros jogadores.
            O chat de cada desafio é acessível aos participantes e ao
            administrador.
          </p>
          <p>
            A inscrição exige confirmação de email e aprovação pelo clube. Os
            alertas operacionais por email podem ser desativados no perfil. As
            mensagens WhatsApp exigem autorização separada, revogável no perfil.
            Os fornecedores de alojamento/base de dados e dos canais de
            mensagens tratam os dados necessários a esses serviços.
          </p>
          <p>
            Os resultados e o histórico desportivo são conservados para manter a
            integridade da liga. O clube deve definir e comunicar os prazos de
            conservação dos contactos, contas e mensagens, bem como avaliar
            pedidos de anonimização ou eliminação face ao histórico da
            competição.
          </p>
          <p>
            Podes pedir acesso, correção, informação sobre conservação,
            eliminação ou oposição junto do Neiva Padel Club, na receção
            {process.env.PRIVACY_CONTACT_EMAIL
              ? ` ou por email: ${process.env.PRIVACY_CONTACT_EMAIL}`
              : ""}
            . Podes apresentar reclamação à CNPD.
          </p>
          <p>
            Usamos cookies de sessão para autenticação e armazenamento local
            para as preferências de apresentação. O WhatsApp é opcional; não
            condiciona a participação na liga.
          </p>
          <a href="/auth">Voltar à entrada</a>
        </article>
      </main>
    );
  return (
    <Application
      route={route}
      googleEnabled={!!process.env.GOOGLE_CLIENT_ID}
      demo={process.env.DEMO_MODE === "true"}
    />
  );
}
