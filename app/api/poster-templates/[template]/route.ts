import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireActor } from "@/lib/auth";
import { ensure } from "@/lib/rules";
import { failure } from "@/lib/http";
import { posterTemplates, type PosterTemplate } from "@/lib/poster-templates";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ template: string }> },
) {
  try {
    const actor = await requireActor();
    ensure(
      actor.role === "admin",
      "Apenas administradores podem gerar cartazes.",
      403,
    );
    const { template } = await params;
    ensure(
      Object.prototype.hasOwnProperty.call(posterTemplates, template),
      "Modelo não encontrado.",
      404,
    );
    const bytes = await readFile(
      path.join(
        process.cwd(),
        "templates",
        posterTemplates[template as PosterTemplate],
      ),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": posterTemplates[template as PosterTemplate].endsWith(
          ".png",
        )
          ? "image/png"
          : "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
