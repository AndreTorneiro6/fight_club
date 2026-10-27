import {
  mailConfiguration,
  sendEmail,
  verifyEmailTransport,
} from "../lib/mail";

const target = "no-reply@wbglabs.io";
const testRecipient = "atorneiro507@gmail.com";
async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--verify", "--send-test"].includes(arg)) ||
    (args.includes("--verify") && args.includes("--send-test"))
  ) {
    throw new Error(
      "Usa --verify ou --send-test. O destinatário de teste é fixo.",
    );
  }
  if (process.env.SMTP_USER && !process.env.SMTP_PASSWORD)
    throw new Error(
      "Preenche SMTP_PASSWORD em .env.resend.local com a API key da Resend.",
    );
  const config = mailConfiguration();
  if (
    config.mailbox !== target ||
    config.host !== "smtp.resend.com" ||
    config.user !== "resend"
  ) {
    throw new Error(
      `Configura a Resend (smtp.resend.com, utilizador resend) com remetente ${target} antes de testar a migração.`,
    );
  }
  const verified = await verifyEmailTransport();
  console.log(JSON.stringify({ ...verified, messageSent: false }));
  if (args.includes("--send-test")) {
    const messageId = await sendEmail({
      to: testRecipient,
      subject: "Fight Club · Teste de entrega de email",
      text: `Olá André,\n\nEste é um teste solicitado da configuração de email da Fight Club Padel League, enviado por ${target}.\n\nConfirma a pasta de chegada e consulta os cabeçalhos Authentication-Results, DKIM-Signature e Return-Path para verificar SPF, DKIM e DMARC.\n\nNão foi criada nenhuma ação ou notificação na liga.`,
    });
    console.log(
      JSON.stringify({
        recipient: testRecipient,
        messageId,
        smtpAccepted: true,
        inboxDeliveryConfirmed: false,
      }),
    );
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "A verificação de email falhou.",
  );
  process.exitCode = 1;
});
