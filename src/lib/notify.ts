/**
 * Aviso de coincidencias: agrupa las Match en estado NEW por usuario y envía
 * un email por usuario con todas sus coincidencias pendientes. Solo se marcan
 * como NOTIFIED si el envío se realizó de verdad — si Resend no está
 * configurado o falla, quedan en NEW y se reintentará en el siguiente ciclo.
 */

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mail";
import { matchesEmail, type MatchEmailItem } from "@/lib/emails";

export interface NotifySummary {
  usersNotified: number;
  matchesNotified: number;
  usersFailed: number;
  reason?: string;
}

export async function notifyNewMatches(): Promise<NotifySummary> {
  const pending = await prisma.match.findMany({
    where: {
      status: "NEW",
      profile: {
        user: {
          notifyEmail: true,
          // Solo avisamos a cuentas con suscripción vigente (o en gracia por
          // impago). Las cuentas sin plan ven sus coincidencias en el panel
          // pero no reciben emails.
          subscription: { is: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } } },
        },
      },
    },
    include: {
      publication: { include: { source: true } },
      profile: { include: { user: true } },
    },
    orderBy: { publication: { publishedAt: "desc" } },
    take: 2000,
  });

  const byUser = new Map<string, typeof pending>();
  for (const m of pending) {
    const list = byUser.get(m.profile.userId) ?? [];
    list.push(m);
    byUser.set(m.profile.userId, list);
  }

  const summary: NotifySummary = { usersNotified: 0, matchesNotified: 0, usersFailed: 0 };

  for (const [, matches] of byUser) {
    const user = matches[0].profile.user;
    const items: MatchEmailItem[] = matches.map((m) => ({
      profileName: m.profile.fullName,
      title: m.publication.title,
      sourceCode: m.publication.source.code,
      publishedAt: m.publication.publishedAt,
      url: m.publication.url,
    }));

    const { subject, html } = matchesEmail(items);
    const result = await sendEmail({ to: user.email, subject, html });

    if (!result.sent) {
      summary.usersFailed++;
      summary.reason = result.reason;
      continue;
    }

    const ids = matches.map((m) => m.id);
    await prisma.$transaction([
      prisma.match.updateMany({
        where: { id: { in: ids }, status: "NEW" },
        data: { status: "NOTIFIED" },
      }),
      prisma.notification.createMany({
        data: ids.map((matchId) => ({ matchId, channel: "EMAIL" as const, sentAt: new Date() })),
      }),
    ]);
    summary.usersNotified++;
    summary.matchesNotified += ids.length;
  }

  return summary;
}
