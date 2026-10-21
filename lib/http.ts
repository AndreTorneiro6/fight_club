import { EMAIL_IN_USE } from "./email";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LeagueError } from "./rules";
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((x) => `${x.path.join(".")}: ${x.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof LeagueError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  )
    return NextResponse.json(
      {
        error:
          "keyPattern" in error &&
          error.keyPattern &&
          typeof error.keyPattern === "object" &&
          "email" in error.keyPattern
            ? EMAIL_IN_USE
            : "Já existe um registo com estes dados.",
      },
      { status: 409 },
    );
  console.error(
    "Unhandled request failure:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    {
      error:
        "Não foi possível concluir a operação. Verifica a ligação à base de dados.",
    },
    { status: 500 },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new URL(process.env.APP_URL ?? request.url).origin;
  if (!origin || origin !== allowed)
    throw new LeagueError("Origem do pedido inválida.", 403);
}
